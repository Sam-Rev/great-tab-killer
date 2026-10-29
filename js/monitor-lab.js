/* Independent monitor. No imports, changes to settings, background tasks, or
 * writes to the original monitor's caches. Loaded by monitor-lab.html only. */
export const MIB = 1048576;
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const value = (n) => finite(n) ? n : 0;
export const formatBytes = (bytes) => !finite(bytes) ? '—' : bytes >= 1024 * MIB
  ? `${(bytes / (1024 * MIB)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ГиБ`
  : `${(bytes / MIB).toLocaleString('ru-RU', { maximumFractionDigits: bytes < MIB ? 2 : 1 })} МиБ`;
const makeElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text ?? '');
  return element;
};
export function median(numbers) {
  const a = numbers.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null;
}

// Passed directly to scripting.executeScript: must stay self-contained.
// Do not decode images, create canvas contexts, trigger GC, or start observers.
export function collectPageSignals() {
  const started = performance.now();
  const out = {
    href: location.href, origin: location.origin, sampledAt: Date.now(),
    heapUsed: null, heapTotal: null, nodes: 0, elements: 0, attributes: 0,
    shadowRoots: 0, imageElements: 0, imagesUnique: 0, visibleImageBytes: 0,
    otherImageBytes: 0, canvases: 0, canvasPixelsBytes: 0,
    videos: [], audioPlaying: 0, audioLoaded: 0, iframeElements: 0,
    resources: { script: { count: 0, bytes: 0 }, cssFont: { count: 0, bytes: 0 }, other: { count: 0, bytes: 0 } },
    resourceZeroSizes: 0, truncated: false, errors: [],
  };
  try {
    const m = performance.memory;
    if (m && Number.isFinite(m.usedJSHeapSize)) out.heapUsed = m.usedJSHeapSize;
    if (m && Number.isFinite(m.totalJSHeapSize)) out.heapTotal = m.totalJSHeapSize;
  } catch { out.errors.push('JS-куча недоступна'); }
  const images = new Map();
  try {
    const roots = [document];
    outer: for (let r = 0; r < roots.length; r++) {
      const walker = document.createTreeWalker(roots[r], NodeFilter.SHOW_ALL);
      let node;
      while ((node = walker.nextNode())) {
        if (out.nodes >= 30000 || (out.nodes % 128 === 0 && performance.now() - started > 65)) {
          out.truncated = true;
          break outer;
        }
        out.nodes++;
        if (node.nodeType !== 1) continue;
        out.elements++;
        out.attributes += node.attributes.length;
        if (node.shadowRoot) { roots.push(node.shadowRoot); out.shadowRoots++; }
        const tag = node.localName;
        if (tag === 'iframe' || tag === 'frame') out.iframeElements++;
        if (tag === 'img') {
          out.imageElements++;
          if (!node.complete || !node.naturalWidth || !node.currentSrc) continue;
          const bytes = node.naturalWidth * node.naturalHeight * 4;
          const rect = node.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
          const prev = images.get(node.currentSrc);
          images.set(node.currentSrc, { bytes: Math.max(bytes, prev?.bytes || 0), visible: visible || !!prev?.visible });
        } else if (tag === 'canvas') {
          out.canvases++;
          out.canvasPixelsBytes += node.width * node.height * 4;
        } else if (tag === 'video') {
          let bufferedSeconds = 0;
          for (let i = 0; i < node.buffered.length; i++) bufferedSeconds += node.buffered.end(i) - node.buffered.start(i);
          out.videos.push({ width: node.videoWidth, height: node.videoHeight, playing: !node.paused && !node.ended, readyState: node.readyState, bufferedSeconds });
        } else if (tag === 'audio') {
          if (node.readyState > 0) out.audioLoaded++;
          if (!node.paused && !node.ended) out.audioPlaying++;
        }
      }
    }
  } catch { out.errors.push('DOM собран не полностью'); out.truncated = true; }
  out.imagesUnique = images.size;
  for (const image of images.values()) {
    if (image.visible) out.visibleImageBytes += image.bytes;
    else out.otherImageBytes += image.bytes;
  }
  try {
    // Resource Timing describes transfer/decoded response bodies, not RAM.
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries.slice(0, 3000)) {
      const key = entry.initiatorType === 'script' ? 'script'
        : entry.initiatorType === 'css' || entry.initiatorType === 'link' || /\.(woff2?|ttf|otf)([?#]|$)/i.test(entry.name) ? 'cssFont' : 'other';
      const bytes = entry.decodedBodySize || 0;
      out.resources[key].count++;
      out.resources[key].bytes += bytes;
      if (!bytes) out.resourceZeroSizes++;
    }
    if (entries.length > 3000) out.truncated = true;
  } catch { out.errors.push('Resource Timing недоступен'); }
  out.elapsedMs = Math.round(performance.now() - started);
  return out;
}

export function buildEstimate(frames) {
  const top = frames.find((f) => f.frameId === 0)?.result;
  if (!top || !finite(top.heapUsed)) return null;
  const sum = (key) => frames.reduce((a, f) => a + value(f.result[key]), 0);
  const parts = [];
  const add = (name, raw, factor, lowFactor, highFactor, group, note) => {
    raw = value(raw);
    parts.push({ name, raw, factor, lowFactor, highFactor, group, note,
      bytes: raw * factor, low: raw * lowFactor, high: raw * highFactor });
  };
  add('JS: занятая куча', top.heapUsed, 1, 0, 1, 'heap', 'Только главный фрейм. Может включать другие документы; доля, возвращаемая ОС, неизвестна.');
  add('JS: свободная часть кучи', Math.max(0, value(top.heapTotal) - top.heapUsed), .25, 0, 1, 'heap', 'max(0, total − used). Учитываем четверть как предполагаемый освобождаемый запас.');
  add('Узлы DOM', sum('nodes'), 1024, 512, 2048, 'dom', 'Байт на узел, включая предполагаемые расходы структуры и layout. Это коэффициент модели.');
  add('Атрибуты DOM', sum('attributes'), 96, 32, 192, 'dom', 'Байт на атрибут. Размер строк и фактический layout неизвестны.');
  add('Изображения в области просмотра', sum('visibleImageBytes'), .5, 0, 1, 'media', 'Σ ширина × высота × 4, уникальные currentSrc внутри фрейма. Предполагаем 50% резидентности.');
  add('Остальные изображения', sum('otherImageBytes'), .05, 0, .5, 'media', 'Те же пиксельные данные; 5% для картинок за пределами экрана. Декодирование не запускается.');
  add('Canvas', sum('canvasPixelsBytes'), .75, 0, 2, 'media', 'Σ ширина × высота × 4. Контекст не создаётся; GPU и число копий неизвестны.');
  let videoBytes = 0;
  for (const frame of frames) for (const video of frame.result.videos || []) {
    if (video.readyState >= 2) videoBytes += value(video.width) * value(video.height) * 1.5 * (video.playing ? 8 : 2);
  }
  add('Декодированные видеокадры', videoBytes, 1, .25, 3, 'media', 'Σ W × H × 1,5 (YUV) × 8 кадров при воспроизведении или × 2 на паузе. MSE/сетевые буферы не измерены.');
  add('Аудиобуфер', sum('audioPlaying') * 48000 * 2 * 4, .25, .05, 1, 'media', 'Активные <audio> × 48 000 Гц × 2 канала × 4 байта × 0,25 секунды. Формат и длительность предполагаются.');
  add('Прочие расходы страницы', 16 * MIB, 1, 0, 2, 'base', 'Предположение: 16 МиБ на страницу. Это не измеренная память renderer-процесса.');
  add('Структуры дочерних документов', Math.max(0, frames.length - 1) * MIB, 1, 0, 2, 'base', '1 МиБ на доступный дочерний фрейм; не предполагаем отдельный процесс на каждый origin.');
  const resource = (key) => frames.reduce((a, f) => a + value(f.result.resources?.[key]?.bytes), 0);
  add('Загруженные скрипты', resource('script'), 0, 0, 0, 'base', 'Размер ответа не является памятью. Не прибавляем к уже учтённой JS-куче.');
  add('Загруженные CSS / шрифты / link', resource('cssFont'), 0, 0, 0, 'base', 'Resource Timing: только диагностические данные; нулевые размеры могут означать ограничение доступа.');
  add('Остальные ресурсы', resource('other'), 0, 0, 0, 'base', 'Не суммируем сетевой трафик с RAM.');
  const total = (key) => parts.reduce((a, p) => a + p[key], 0);
  return { bytes: total('bytes'), low: total('low'), high: total('high'), parts,
    sampledAt: top.sampledAt, frames, partial: frames.some((f) => f.result.truncated || f.result.errors?.length) || sum('iframeElements') > frames.length - 1,
    missingFrames: Math.max(0, sum('iframeElements') - (frames.length - 1)) };
}

// Raw union of associated processes. Never divide a process into invented tab
// shares; never silently turn a missing privateMemory field into a measured 0.
export function summarizeProcesses(snapshot) {
  const byTab = new Map();
  for (const [id, process] of Object.entries(snapshot || {})) {
    const tabIds = [...new Set((process.tasks || []).map((t) => t.tabId).filter((id) => Number.isInteger(id) && id >= 0))];
    const extraTasks = (process.tasks || []).filter((t) => !Number.isInteger(t.tabId) || t.tabId < 0).length;
    for (const tabId of tabIds) {
      const entry = byTab.get(tabId) || { bytes: 0, complete: true, shared: false, processes: [] };
      entry.complete &&= finite(process.privateMemory);
      entry.bytes += value(process.privateMemory);
      entry.shared ||= tabIds.length > 1 || extraTasks > 0;
      entry.processes.push({ id, osProcessId: process.osProcessId, bytes: finite(process.privateMemory) ? process.privateMemory : null, tabIds, extraTasks, type: process.type, tasks: process.tasks });
      byTab.set(tabId, entry);
    }
  }
  for (const entry of byTab.values()) if (!entry.complete) entry.bytes = null;
  return byTab;
}
export function processTotal(snapshot) {
  const processes = Object.values(snapshot || {});
  return processes.length && processes.every((p) => finite(p.privateMemory))
    ? processes.reduce((sum, p) => sum + p.privateMemory, 0) : null;
}
const stripHash = (url) => String(url || '').split('#')[0];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function withTimeout(promise, ms, message = 'Время ожидания истекло') {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
}
const time = (at) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

async function startMonitor() {
  const $ = (id) => document.getElementById(id);
  const api = globalThis.chrome;
  const available = !!(api?.runtime?.id && api?.tabs?.query && api?.scripting?.executeScript);
  let rows = [], byTab = new Map(), ownTabId = null, busy = false, testing = false;
  let sortKey = 'estimate', direction = -1, processEnabled = false, official = new Map();
  let inspectorId = null, inspectorKind = 'estimate', pinned = false, closeTimer, anchor;
  let suppressFocusPreview = false;
  let pendingTest = null, experimentTabId = null, timer, lastUpdate = null;
  const navigationEpoch = new Map();
  const results = [];
  let experimentDisturbed = false;
  const inspector = $('inspector');

  function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
  function status(tab) {
    if (tab.discarded) return ['Выгружена', 'sleep'];
    if (tab.frozen) return ['Заморожена', 'sleep'];
    if (tab.url?.startsWith(api?.runtime?.getURL('html/suspended.html') || 'never:')) return ['Приостановлена', 'sleep'];
    if (tab.id === ownTabId) return ['Этот монитор', ''];
    if (tab.audible) return ['Звучит', 'audio'];
    if (tab.active) return ['Активна', 'active'];
    if (tab.pinned) return ['Закреплена', ''];
    return ['В фоне', ''];
  }
  const measurable = (tab) => /^https?:|^file:/.test(tab.url || '') && !tab.discarded && !tab.frozen;
  const canTest = (tab) => measurable(tab) && tab.id !== ownTabId && !tab.active && !tab.pinned && !tab.audible && tab.status !== 'loading' && tab.autoDiscardable !== false;
  const hostname = (url) => { try { return new URL(url).host || new URL(url).protocol; } catch { return 'Адрес недоступен'; } };

  async function getProcesses() {
    if (!processEnabled || !api.processes?.getProcessInfo) return null;
    return withTimeout(new Promise((resolve, reject) => {
      api.processes.getProcessInfo([], true, (data) => {
        const error = api.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(data);
      });
    }), 5000, 'Chrome не ответил на запрос памяти процессов');
  }
  async function readSystem() {
    try { return await withTimeout(api.system.memory.getInfo(), 3000); } catch { return null; }
  }
  async function measure(tab) {
    const epoch = navigationEpoch.get(tab.id) || 0;
    const frames = await withTimeout(api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collectPageSignals }), 4000, 'Страница не ответила за 4 секунды');
    const usable = frames.filter((f) => f.result && !f.error);
    const top = usable.find((f) => f.frameId === 0);
    if (!top || stripHash(top.result.href) !== stripHash(tab.url) || epoch !== (navigationEpoch.get(tab.id) || 0)) throw new Error('Страница изменилась во время замера');
    const estimate = buildEstimate(usable);
    if (!estimate) throw new Error('JS-куча недоступна; полной оценки нет');
    return estimate;
  }
  function updateSystem(info) {
    $('system').textContent = formatBytes(info?.availableCapacity);
    $('system-note').textContent = info ? `из ${formatBytes(info.capacity)} · весь компьютер` : 'Системная метрика недоступна';
    $('system-bar').style.width = info && info.capacity > 0 ? `${Math.min(100, Math.max(0, info.availableCapacity / info.capacity * 100))}%` : '0';
  }
  function schedule() {
    clearTimeout(timer);
    if ($('auto').checked && !document.hidden) timer = setTimeout(refresh, 30000);
  }
  async function refresh() {
    if (!available || busy || testing) return;
    busy = true; $('refresh').disabled = true; document.body.classList.add('busy');
    if (!pinned) hideInspector();
    $('rows').setAttribute('aria-busy', 'true');
    try {
      const [tabsResult, systemResult, processResult] = await Promise.allSettled([api.tabs.query({}), readSystem(), getProcesses()]);
      if (tabsResult.status !== 'fulfilled') throw tabsResult.reason;
      const tabs = tabsResult.value;
      official = processResult.status === 'fulfilled' ? summarizeProcesses(processResult.value) : new Map();
      if (processResult.status === 'rejected') $('process-status').textContent = `Замер недоступен: ${processResult.reason.message}. Повторите измерение.`;
      else if (processEnabled) $('process-status').textContent = 'Подключены. Общие процессы помечены; наведите на число для просмотра PID.';
      updateSystem(systemResult.status === 'fulfilled' ? systemResult.value : null);
      const nextRows = [];
      for (let i = 0; i < tabs.length; i += 4) {
        $('progress').textContent = `Измеряем вкладки: ${Math.min(i + 4, tabs.length)} из ${tabs.length}…`;
        await Promise.all(tabs.slice(i, i + 4).map(async (tab) => {
          const epoch = navigationEpoch.get(tab.id) || 0;
          let estimate = null, error = '', stale = false;
          if (measurable(tab)) {
            try { estimate = await measure(tab); } catch (e) { error = e.message; }
          } else {
            const old = byTab.get(tab.id);
            if (tab.frozen && old?.estimate && stripHash(old.tab.url) === stripHash(tab.url)) { estimate = old.estimate; stale = true; }
            error = tab.discarded ? 'Страница уже выгружена. Нового измерения нет.' : tab.frozen ? 'Скрипты замороженной страницы не запускаются.' : 'Служебные страницы и страницы расширений не измеряются.';
          }
          nextRows.push({ tab, estimate, error, stale, epoch, official: official.get(tab.id) || null });
        }));
      }
      // Reconcile tabs closed, navigated, or discarded while sampling.
      const liveTabs = new Map((await api.tabs.query({})).map((tab) => [tab.id, tab]));
      rows = nextRows.filter((r) => liveTabs.has(r.tab.id)).map((row) => {
        const live = liveTabs.get(row.tab.id);
        if (stripHash(live.url) !== stripHash(row.tab.url) || live.discarded || row.epoch !== (navigationEpoch.get(live.id) || 0)) { row.estimate = null; row.official = null; row.error = 'Страница изменилась или была выгружена.'; }
        row.tab = live;
        return row;
      });
      byTab = new Map(rows.map((r) => [r.tab.id, r]));
      lastUpdate = Date.now();
      updateWindowFilter(); render();
      if (pinned && byTab.has(inspectorId)) showInspector(inspectorId, inspectorKind, anchor, true);
      else if (pinned) hideInspector();
      $('progress').textContent = `Последний замер ${time(lastUpdate)} · измерения выполняются только пока открыт этот монитор`;
    } catch (e) { notice(`Не удалось обновить монитор: ${e.message}`); $('progress').textContent = 'Замер не завершён. Можно повторить.'; }
    finally {
      busy = false; $('refresh').disabled = false; document.body.classList.remove('busy'); $('rows').removeAttribute('aria-busy');
      for (const button of $('rows').querySelectorAll('[data-test]')) button.disabled = testing || !canTest(byTab.get(Number(button.dataset.test))?.tab || {});
      schedule();
    }
  }
  function updateWindowFilter() {
    const previous = $('window-filter').value;
    const ids = [...new Set(rows.map((r) => r.tab.windowId))].sort((a, b) => a - b);
    $('window-filter').replaceChildren(new Option('Все окна', 'all'), ...ids.map((id, i) => new Option(`Окно ${i + 1}`, String(id))));
    if (ids.includes(Number(previous))) $('window-filter').value = previous;
  }
  function rowMemory(row) {
    if (!row.estimate) {
      const cell = document.createElement('div');
      const unavailable = makeElement('span', 'na', '—');
      const reason = makeElement('span', 'sub', row.tab.discarded ? 'Уже выгружена' : 'Нет измерения');
      reason.title = row.error || '';
      unavailable.title = row.error || '';
      cell.append(unavailable, reason);
      return cell;
    }
    const m = row.estimate;
    const groups = ['heap', 'dom', 'media', 'base'];
    const button = makeElement('button', 'mem-button');
    button.dataset.inspect = 'estimate'; button.dataset.id = String(row.tab.id);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `Расчёт ${formatBytes(m.bytes)}: ${row.tab.title || ''}`);
    button.append(makeElement('span', 'mem-main', `≈ ${formatBytes(m.bytes)}`), makeElement('span', 'sub', `${formatBytes(m.low)} – ${formatBytes(m.high)}`));
    const stack = makeElement('span', 'stack'); stack.setAttribute('aria-hidden', 'true');
    for (const group of groups) {
      const part = makeElement('span', group);
      const amount = m.bytes > 0 ? m.parts.filter((item) => item.group === group).reduce((sum, item) => sum + item.bytes, 0) / m.bytes * 100 : 0;
      part.style.width = `${Math.max(0, Math.min(100, amount))}%`;
      stack.appendChild(part);
    }
    button.append(stack, makeElement('span', 'sub', `${row.stale ? 'Предыдущий замер · ' : m.partial ? 'Частичные данные · ' : ''}${time(m.sampledAt)}`));
    return button;
  }
  function rowOfficial(row) {
    const o = row.official;
    if (!o) {
      const cell = document.createElement('div');
      cell.append(makeElement('span', 'na', '—'), makeElement('span', 'sub', processEnabled ? 'Нет связанных процессов' : 'Нужен Dev / Canary'));
      return cell;
    }
    const button = makeElement('button', 'mem-button');
    button.dataset.inspect = 'official'; button.dataset.id = String(row.tab.id);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `Процессы Chrome: ${row.tab.title || ''}`);
    button.append(makeElement('span', 'mem-main', formatBytes(o.bytes)), makeElement('span', 'sub', `${!o.complete ? 'Неполные данные' : o.shared ? 'Есть общие процессы' : 'Связанные процессы'} · ${o.processes.length}`));
    return button;
  }
  function render() {
    const query = $('search').value.toLocaleLowerCase('ru').trim();
    const windowId = $('window-filter').value;
    const state = $('state-filter').value;
    const visible = rows.filter((r) => (!query || `${r.tab.title} ${r.tab.url}`.toLocaleLowerCase('ru').includes(query)) &&
      (windowId === 'all' || String(r.tab.windowId) === windowId) &&
      (state === 'all' || state === 'loaded' && measurable(r.tab) || state === 'sleep' && status(r.tab)[1] === 'sleep' || state === 'unknown' && !r.estimate));
    visible.sort((a, b) => {
      if (sortKey === 'title') return direction * (a.tab.title || '').localeCompare(b.tab.title || '', 'ru');
      const av = sortKey === 'estimate' ? a.estimate?.bytes : a.official?.bytes;
      const bv = sortKey === 'estimate' ? b.estimate?.bytes : b.official?.bytes;
      if (!finite(av)) return finite(bv) ? 1 : a.tab.id - b.tab.id;
      if (!finite(bv)) return -1;
      return direction * (av - bv) || a.tab.id - b.tab.id;
    });
    $('row-count').textContent = `${visible.length} / ${rows.length}`;
    const windowIds = [...new Set(rows.map((r) => r.tab.windowId))].sort((a, b) => a - b);
    const rowsEl = $('rows'); rowsEl.replaceChildren();
    for (const row of visible) {
      const tab = row.tab, [label, css] = status(tab);
      const tr = document.createElement('tr'); tr.dataset.id = String(tab.id);
      if (inspectorId === tab.id) tr.classList.add('selected');
      const identity = makeElement('div', 'tab-name');
      const image = document.createElement('img'); image.className = 'favicon'; image.src = '../images/ch-def-favicon-sml.png'; image.alt = '';
      const textBox = makeElement('div', 'tab-text');
      const go = makeElement('button', 'tab-link', tab.title || 'Без названия'); go.dataset.go = String(tab.id); go.title = tab.title || tab.url || '';
      const domain = makeElement('span', 'domain', `${hostname(tab.url)} · окно ${windowIds.indexOf(tab.windowId) + 1}`); domain.title = tab.url || '';
      textBox.append(go, domain); identity.append(image, textBox);
      const identityCell = document.createElement('td'); identityCell.appendChild(identity);
      const statusCell = document.createElement('td'); statusCell.appendChild(makeElement('span', `badge ${css}`, label));
      const memoryCell = document.createElement('td'); memoryCell.appendChild(rowMemory(row));
      const officialCell = document.createElement('td'); officialCell.appendChild(rowOfficial(row));
      const actionCell = document.createElement('td');
      const action = makeElement('button', 'row-action', 'Проверить ↗'); action.dataset.test = String(tab.id);
      const availableTest = canTest(tab); action.disabled = !availableTest || testing || busy;
      action.title = availableTest ? 'Выгрузить и сравнить изменение памяти' : 'Проверка доступна для загруженной фоновой вкладки без звука и закрепления';
      actionCell.appendChild(action); tr.append(identityCell, statusCell, memoryCell, officialCell, actionCell); rowsEl.appendChild(tr);
    }
    if (!visible.length) {
      const tr = document.createElement('tr'), cell = makeElement('td', 'empty', 'Вкладки не найдены. Попробуйте изменить поиск или фильтры.');
      cell.colSpan = 5; tr.appendChild(cell); rowsEl.appendChild(tr);
    }
    // Use Chrome's local favicon endpoint. Never fetch a page's favicon URL.
    if (available) for (const tr of $('rows').querySelectorAll('tr[data-id]')) {
      const tab = byTab.get(Number(tr.dataset.id))?.tab;
      if (tab?.url && /^https?:/.test(tab.url)) {
        const url = new URL(api.runtime.getURL('_favicon/'));
        url.searchParams.set('pageUrl', tab.url); url.searchParams.set('size', '32');
        const image = tr.querySelector('img');
        image.onerror = () => { image.onerror = null; image.src = '../images/ch-def-favicon-sml.png'; };
        image.src = url.href;
      }
    }
    const measured = rows.filter((r) => r.estimate && !r.stale);
    const largest = measured.reduce((a, r) => !a || r.estimate.bytes > a.estimate.bytes ? r : a, null);
    $('largest').textContent = largest ? `≈ ${formatBytes(largest.estimate.bytes)}` : '—';
    $('largest-title').textContent = largest?.tab.title || 'Нет свежих оценок';
    $('coverage').textContent = `${measured.length} / ${rows.length}`;
    $('coverage-note').textContent = `${rows.filter((r) => r.tab.discarded).length} выгружено · ${measured.filter((r) => r.estimate.partial).length} частичных замеров`;
  }
  function hideInspector() {
    clearTimeout(closeTimer); inspector.hidden = true; pinned = false; inspectorId = null;
    for (const tr of $('rows').querySelectorAll('.selected')) tr.classList.remove('selected');
  }
  function scheduleClose() { clearTimeout(closeTimer); if (!pinned) closeTimer = setTimeout(hideInspector, 220); }
  function dismissInspector() {
    const returnTo = anchor;
    hideInspector(); suppressFocusPreview = true;
    returnTo?.focus({ preventScroll: true });
    queueMicrotask(() => { suppressFocusPreview = false; });
  }
  function showInspector(id, kind, target, pin = false) {
    const row = byTab.get(id);
    if (!row || kind === 'estimate' && !row.estimate || kind === 'official' && !row.official) return;
    if (pinned && !pin) return;
    clearTimeout(closeTimer); inspectorId = id; inspectorKind = kind; pinned = pin; anchor = target;
    const m = row.estimate;
    const o = row.official;
    inspector.replaceChildren();
    const header = document.createElement('header'), headerText = document.createElement('div');
    headerText.append(makeElement('h2', '', kind === 'estimate' ? 'Из чего складывается оценка' : 'Что сообщил Chrome'));
    headerText.appendChild(makeElement('p', '', `${row.tab.title || ''} · ${kind === 'estimate' ? time(m.sampledAt) : time(lastUpdate || Date.now())}`));
    const closeButton = makeElement('button', 'close', '×'); closeButton.setAttribute('aria-label', 'Закрыть расчёт');
    header.append(headerText, closeButton); inspector.appendChild(header);
    const total = makeElement('div', 'inspect-total');
    total.appendChild(makeElement('strong', '', kind === 'estimate' ? `≈ ${formatBytes(m.bytes)} (${formatBytes(m.low)} – ${formatBytes(m.high)})` : formatBytes(o.bytes)));
    total.appendChild(makeElement('span', '', kind === 'estimate' ? `${m.frames.length} frames${m.partial ? ` · partial, ${m.missingFrames} missing` : ''}${row.stale ? ' · previous sample' : ''}` : `${o.processes.length} processes${o.shared ? ' · shared process' : ''}`));
    inspector.appendChild(total);
    const details = document.createElement('details'), summary = makeElement('summary', '', kind === 'estimate' ? 'Frame and estimate data' : 'Process data');
    const data = document.createElement('pre'); data.textContent = JSON.stringify(kind === 'estimate' ? m : o, null, 2);
    details.append(summary, data); inspector.appendChild(details);
    inspector.appendChild(makeElement('p', 'inspect-note', 'Estimates are approximate. Process memory may be shared and is not guaranteed to be freed when a tab closes.'));
    const footer = document.createElement('footer');
    const pinButton = makeElement('button', 'button', pinned ? 'Расчёт закреплён' : 'Закрепить расчёт'); pinButton.dataset.pin = '';
    const copyButton = makeElement('button', 'button', 'Скопировать JSON'); copyButton.dataset.copy = '';
    footer.append(pinButton, copyButton); inspector.appendChild(footer);
    inspector.appendChild(makeElement('p', 'inspect-note', 'Наведите для просмотра · нажмите на число для закрепления · Esc закрывает'));
    inspector.hidden = false;
    const rect = target?.isConnected ? target.getBoundingClientRect() : { left: innerWidth / 2, top: 80, bottom: 100 };
    const leftRoom = rect.left - 24, rightRoom = innerWidth - (rect.right || rect.left) - 24;
    if (Math.max(leftRoom, rightRoom) >= 360) {
      const onLeft = leftRoom > rightRoom;
      inspector.style.width = `${Math.min(620, onLeft ? leftRoom : rightRoom)}px`;
      inspector.style.maxHeight = 'calc(100vh - 24px)';
      inspector.style.left = `${onLeft ? rect.left - inspector.offsetWidth - 12 : (rect.right || rect.left) + 12}px`;
      inspector.style.top = `${Math.max(12, Math.min(rect.top - 80, innerHeight - inspector.offsetHeight - 12))}px`;
    } else {
      // The hover preview must never cover its trigger before a click lands.
      const below = innerHeight - rect.bottom - 24, above = rect.top - 24;
      inspector.style.width = '620px';
      inspector.style.maxHeight = `${Math.max(100, Math.max(below, above))}px`;
      inspector.style.left = '12px';
      inspector.style.top = `${below >= above ? rect.bottom + 10 : Math.max(12, rect.top - inspector.offsetHeight - 10)}px`;
    }
    if (pin) { inspector.style.maxHeight = 'calc(100vh - 24px)'; inspector.style.top = `${Math.max(12, Math.min(parseFloat(inspector.style.top), innerHeight - inspector.offsetHeight - 12))}px`; }
    inspector.querySelector('.close').onclick = dismissInspector;
    inspector.querySelector('[data-pin]').onclick = () => { pinned = true; inspector.querySelector('[data-pin]').textContent = 'Расчёт закреплён'; };
    inspector.querySelector('[data-copy]').onclick = async (event) => {
      try { await navigator.clipboard.writeText(JSON.stringify(kind === 'estimate' ? m : row.official, null, 2)); event.target.textContent = 'Скопировано'; }
      catch { event.target.textContent = 'Выделите JSON вручную'; }
    };
    for (const tr of $('rows').querySelectorAll('tr[data-id]')) tr.classList.toggle('selected', Number(tr.dataset.id) === id);
  }

  async function sampleBaseline() {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const [system, process] = await Promise.allSettled([readSystem(), getProcesses()]);
      samples.push({ at: Date.now(), available: system.status === 'fulfilled' && finite(system.value?.availableCapacity) ? system.value.availableCapacity : null,
        processes: process.status === 'fulfilled' ? processTotal(process.value) : null });
      if (i < 2) await delay(600);
    }
    return samples;
  }
  function measuredDelta(before, after, field, sign) {
    if (before.some((s) => !finite(s[field])) || after.some((s) => !finite(s[field]))) return null;
    return sign * (median(after.map((s) => s[field])) - median(before.map((s) => s[field])));
  }
  const signedBytes = (n) => !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatBytes(Math.abs(n))}`;
  function renderResults() {
    $('results').hidden = !results.length;
    const container = $('experiments'); container.replaceChildren();
    for (const result of results) {
      const article = makeElement('article', 'experiment');
      article.appendChild(makeElement('h3', '', `${result.title || ''} · ${time(result.at)}`));
      const grid = makeElement('div', 'experiment-grid');
      for (const [label, value] of [
        ['Прогноз модели', `≈ ${formatBytes(result.estimate.bytes)} · Chrome до: ${formatBytes(result.official?.bytes)}`],
        ['Доступная RAM системы', signedBytes(result.systemDelta)],
        ['Снижение private memory Chrome', signedBytes(result.processDelta)],
      ]) { const cell = document.createElement('div'); cell.append(makeElement('span', 'label', label), makeElement('strong', '', value)); grid.appendChild(cell); }
      article.append(grid, makeElement('p', '', `${result.disturbed ? 'Во время проверки была другая активность; результат менее надёжен. ' : ''}Сравниваются медианы трёх замеров до и после выгрузки.`));
      const details = document.createElement('details'); details.append(makeElement('summary', 'sub', 'Все исходные замеры'));
      const data = document.createElement('pre'); data.style.whiteSpace = 'pre-wrap'; data.style.fontSize = '10px'; data.textContent = JSON.stringify({before: result.before, after: result.after}, null, 2);
      details.appendChild(data); article.appendChild(details); container.appendChild(article);
    }
  }
  async function runExperiment(id) {
    if (busy || testing) return;
    testing = true; experimentTabId = id; experimentDisturbed = false; clearTimeout(timer); $('refresh').disabled = true; hideInspector(); render();
    try {
      let tab = await api.tabs.get(id);
      if (!canTest(tab)) throw new Error('Для этой вкладки проверка сейчас недоступна. Выберите фоновую вкладку без звука и закрепления.');
      $('progress').textContent = 'Проверка: свежая оценка выбранной страницы…';
      const estimate = await measure(tab);
      const officialBefore = summarizeProcesses(await getProcesses()).get(id) || null;
      $('progress').textContent = 'Проверка: три замера до выгрузки…';
      const before = await sampleBaseline();
      if (before.every((s) => !finite(s.available) && !finite(s.processes))) throw new Error('Нет доступной метрики для сравнения; вкладка не выгружена.');
      const freshTab = await api.tabs.get(id);
      if (stripHash(freshTab.url) !== stripHash(tab.url) || !canTest(freshTab) || document.hidden) throw new Error('Состояние изменилось; проверка отменена до выгрузки.');
      $('progress').textContent = 'Проверка: выгружаем выбранную вкладку и ждём очистки…';
      // Explicit tabId only. Never fall back to Chrome choosing another tab.
      await api.tabs.discard(id);
      if (!(await api.tabs.get(id)).discarded) throw new Error('Chrome не подтвердил выгрузку вкладки.');
      const row = byTab.get(id); if (row) { row.tab.discarded = true; row.estimate = null; render(); }
      await delay(3500);
      $('progress').textContent = 'Проверка: три замера после выгрузки…';
      const after = await sampleBaseline();
      if (!(await api.tabs.get(id)).discarded) experimentDisturbed = true;
      results.unshift({ title: tab.title, at: Date.now(), estimate, official: officialBefore, before, after,
        systemDelta: measuredDelta(before, after, 'available', 1), processDelta: measuredDelta(before, after, 'processes', -1), disturbed: experimentDisturbed });
      results.splice(10); renderResults(); notice('Проверка завершена. Результат — под таблицей; вкладка осталась выгруженной.');
    } catch (e) { notice(`Проверка не завершена: ${e.message}`); }
    finally { testing = false; experimentTabId = null; $('refresh').disabled = false; await refresh(); }
  }

  $('refresh').onclick = () => { notice(''); refresh(); };
  $('auto').onchange = schedule;
  for (const id of ['search', 'window-filter', 'state-filter']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { hideInspector(); render(); });
  for (const button of document.querySelectorAll('[data-sort]')) button.onclick = () => {
    direction = sortKey === button.dataset.sort ? -direction : button.dataset.sort === 'title' ? 1 : -1;
    sortKey = button.dataset.sort;
    for (const th of document.querySelectorAll('th[aria-sort]')) th.setAttribute('aria-sort', 'none');
    button.closest('th').setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
    hideInspector(); render();
  };
  $('rows').addEventListener('click', async (event) => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.inspect) { showInspector(Number(target.dataset.id), target.dataset.inspect, target, true); inspector.querySelector('.close').focus(); }
    if (target.dataset.go) {
      try { const tab = await api.tabs.get(Number(target.dataset.go)); await api.windows.update(tab.windowId, { focused: true }); await api.tabs.update(tab.id, { active: true }); }
      catch { notice('Вкладка уже закрыта или недоступна. Обновите список.'); }
    }
    if (target.dataset.test && !busy && !testing) {
      pendingTest = Number(target.dataset.test);
      $('confirm-title').textContent = byTab.get(pendingTest)?.tab.title || 'Выбранная вкладка';
      $('confirm').showModal(); $('cancel-test').focus();
    }
  });
  $('rows').addEventListener('pointerover', (event) => { const button = event.target.closest('[data-inspect]'); if (button && !button.contains(event.relatedTarget)) showInspector(Number(button.dataset.id), button.dataset.inspect, button); });
  $('rows').addEventListener('pointerout', (event) => { const button = event.target.closest('[data-inspect]'); if (button && !button.contains(event.relatedTarget)) scheduleClose(); });
  $('rows').addEventListener('focusin', (event) => { const button = event.target.closest('[data-inspect]'); if (button && !suppressFocusPreview) showInspector(Number(button.dataset.id), button.dataset.inspect, button); });
  $('rows').addEventListener('focusout', (event) => { if (!inspector.contains(event.relatedTarget)) scheduleClose(); });
  inspector.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  inspector.addEventListener('pointerleave', scheduleClose);
  inspector.addEventListener('focusin', () => clearTimeout(closeTimer));
  inspector.addEventListener('focusout', (event) => { if (!inspector.contains(event.relatedTarget)) scheduleClose(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !inspector.hidden) dismissInspector(); });
  document.addEventListener('pointerdown', (event) => { if (!inspector.hidden && !inspector.contains(event.target) && !event.target.closest('[data-inspect]')) hideInspector(); });
  window.addEventListener('resize', hideInspector);
  document.addEventListener('scroll', (event) => { if (!pinned && !inspector.contains(event.target)) hideInspector(); }, true);
  $('cancel-test').onclick = () => { $('confirm').close(); pendingTest = null; };
  $('run-test').onclick = () => { const id = pendingTest; $('confirm').close(); pendingTest = null; if (Number.isInteger(id)) runExperiment(id); };
  $('clear-results').onclick = () => { results.length = 0; renderResults(); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); if (testing) experimentDisturbed = true; }
    else schedule();
  });
  $('enable-processes').onclick = async () => {
    // Request in the click handler to preserve the browser's user gesture.
    try {
      const granted = await api.permissions.request({ permissions: ['processes'] });
      if (!granted) { $('process-status').textContent = 'Разрешение не предоставлено. Оценка страниц продолжает работать.'; return; }
      processEnabled = !!api.processes?.getProcessInfo;
      $('enable-processes').hidden = processEnabled;
      $('process-status').textContent = processEnabled ? 'Подключено. Получаем первый замер…' : 'API недоступен в этой сборке Chrome. Нужен Dev / Canary.';
      await refresh();
    } catch (e) { $('process-status').textContent = `Не удалось подключить: ${e.message}`; }
  };
  if (!available) {
    notice('Это страница расширения. Для реальных вкладок откройте html/monitor-lab.html по адресу chrome-extension://ID_РАСШИРЕНИЯ/html/monitor-lab.html. Обычный HTML-предпросмотр не имеет доступа к вкладкам.');
    $('process-status').textContent = 'Вне расширения API Chrome недоступны.';
    $('refresh').disabled = true; $('auto').disabled = true;
    $('progress').textContent = 'Нет подключения к расширению';
    const emptyRow = document.createElement('tr'), emptyCell = makeElement('td', 'empty', 'Откройте эту страницу внутри The Great Tab Killer. Демонстрационные числа не подставляются вместо измерений.');
    emptyCell.colSpan = 5; emptyRow.appendChild(emptyCell); $('rows').replaceChildren(emptyRow);
    return;
  }
  try { ownTabId = (await api.tabs.getCurrent())?.id ?? null; } catch { /* popup-style context */ }
  const hasApi = !!api.processes?.getProcessInfo;
  let granted = false;
  try { granted = await api.permissions.contains({ permissions: ['processes'] }); } catch { /* unavailable */ }
  processEnabled = hasApi && granted;
  $('process-status').textContent = processEnabled ? 'Подключены. Получаем измерения…' : 'Нужны разрешение и Chrome Dev / Canary. В Stable и обычной Beta API недоступен.';
  // Some versions hide the namespace until the optional permission is granted.
  // Do not use a missing namespace to conclude that the channel is unsupported.
  $('enable-processes').hidden = processEnabled || !api.permissions?.request;
  api.tabs.onUpdated.addListener((id, change, tab) => {
    if (change.url || change.status === 'loading' || change.discarded) {
      navigationEpoch.set(id, (navigationEpoch.get(id) || 0) + 1);
      const row = byTab.get(id);
      if (row) { row.estimate = null; row.official = null; row.tab = tab; row.error = 'Страница изменилась. Нужен новый замер.'; }
      if (inspectorId === id) hideInspector();
    }
    const current = byTab.get(id); if (current) current.tab = tab;
    if (!busy && !testing) render();
    if (testing && id !== experimentTabId && (change.url || change.status === 'loading')) experimentDisturbed = true;
  });
  api.tabs.onRemoved.addListener((id) => { if (testing) experimentDisturbed = true; byTab.delete(id); navigationEpoch.delete(id); rows = rows.filter((r) => r.tab.id !== id); if (inspectorId === id) hideInspector(); if (!busy) render(); });
  api.tabs.onActivated.addListener(({ tabId, windowId }) => {
    if (testing) experimentDisturbed = true;
    for (const row of rows) if (row.tab.windowId === windowId) row.tab.active = row.tab.id === tabId;
    if (!busy && !testing) render();
  });
  await refresh();
}

if (typeof document !== 'undefined') startMonitor().catch((error) => {
  const notice = document.getElementById('notice');
  if (notice) { notice.hidden = false; notice.textContent = `Монитор не запустился: ${error.message}`; }
});
