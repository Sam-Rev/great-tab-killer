/*global chrome */

import {gsUtils} from "./helpers/gsUtils.js";
import {gsMemorySampler} from "./helpers/gsMemorySampler.js";

(function () {
  "use strict";

  /**
   * Resource monitor page.
   *
   * Measurement and estimation live in helpers/gsMemorySampler.js (shared
   * with the background sampling alarm in the service worker). This file is
   * the UI: table, sorting, header stats and per-tab actions.
   */

  const REFRESH_INTERVAL_MS = 15000;

  const SORT_STORAGE_KEY = "gsMonitorSort";
  const AUTOREFRESH_STORAGE_KEY = "gsMonitorAutoRefresh";

  const STATUS_ORDER = {
    active: 0,
    audible: 1,
    pinned: 2,
    normal: 3,
    frozen: 4,
    suspended: 5,
    discarded: 6,
    special: 7,
  };

  let _rows = [];
  let _sortCol = "memory";
  let _sortDir = "desc";
  let _autoRefresh = true;
  let _refreshTimer = null;
  let _measuring = false;
  let _systemPermissionsGranted = false;
  let _windowIndexById = {};
  let _windowCount = 1;
  const _tabActions = new Map();
  let _actionRevision = 0;
  const ACTION_TIMEOUT_MS = 12000;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function withDeadline(promise, ms = ACTION_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(gsUtils.getMessage("js_monitor_action_timeout"))), ms);
      Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }

  // ------------------------------------------------------------------
  // per-tab measurement
  // ------------------------------------------------------------------

  function getTabStatus(tab) {
    if (gsMemorySampler.isSuspendedTabUrl(tab.url)) return "suspended";
    if (tab.discarded) return "discarded";
    if (tab.frozen) return "frozen";
    if (!gsMemorySampler.isInjectableUrl(tab.url)) return "special";
    if (tab.audible) return "audible";
    if (tab.active) return "active";
    if (tab.pinned) return "pinned";
    return "normal";
  }

  async function measureAllTabs() {
    const [tabs, windows] = await Promise.all([
      chrome.tabs.query({}),
      chrome.windows.getAll(),
    ]);

    _windowIndexById = {};
    windows.forEach((win, index) => {
      _windowIndexById[win.id] = index + 1;
    });
    _windowCount = windows.length;

    const rows = tabs.map((tab) => ({
      tab: tab,
      status: getTabStatus(tab),
      memBytes: null,
      memMethod: "none", // estimate | fixed | stale | none
      memBreakdown: null, // estimate components, for the hover tooltip
      cpuPct: null,
    }));

    // live measurable tabs (frozen tabs keep their memory but cannot run
    // scripts until unfrozen, so they reuse the cached value below)
    const injectable = rows.filter(
      (row) => row.status !== "suspended" && row.status !== "discarded" &&
        row.status !== "frozen" && row.status !== "special" &&
        gsMemorySampler.isInjectableUrl(row.tab.url)
    );

    const measured = await gsMemorySampler.measureTabs(
      injectable.map((row) => row.tab)
    );

    const bytesByUrl = {};
    for (const row of injectable) {
      const m = measured.get(row.tab.id);
      if (!m) continue;
      row.memBytes = m.memBytes;
      row.memMethod = "estimate";
      row.memBreakdown = m.breakdown || null;
      if (m.cpuPct !== null && m.cpuPct !== undefined) {
        row.cpuPct = m.cpuPct;
      }
      bytesByUrl[row.tab.url] = m.memBytes;
    }

    // merge into the persistent cache; the returned cache also contains
    // values sampled in the background while the monitor was closed
    const memCache = await gsMemorySampler.updateMemCache(bytesByUrl);

    // Placeholder estimate stays at 4 MiB, even if the placeholder is discarded.
    // A discarded web page keeps its last URL-level estimate, not a claim
    // about memory currently resident or already released.
    for (const row of rows) {
      if (row.status === "suspended") {
        row.memBytes = gsMemorySampler.EST.SUSPENDED_BYTES;
        row.memMethod = "fixed";
      } else if (row.status === "discarded") {
        const cached = memCache[row.tab.url];
        row.memBytes = cached && Number.isFinite(cached.b) ? cached.b : null;
        row.memMethod = "historical";
      }
    }

    // frozen tabs and failed injections still hold their memory: fall back
    // to the last known value for the same url
    for (const row of rows) {
      if (row.memBytes !== null || row.status === "discarded") continue;
      const cached = memCache[row.tab.url];
      if (cached) {
        row.memBytes = cached.b;
        row.memMethod = "stale";
      }
    }

    return rows;
  }

  // ------------------------------------------------------------------
  // system-wide stats (header cards)
  // ------------------------------------------------------------------

  async function updateSystemStats() {
    if (!_systemPermissionsGranted) return;
    // physical memory. note: extensions cannot see swap usage — the
    // system.memory api only exposes capacity and availableCapacity
    try {
      const info = await chrome.system.memory.getInfo();
      const used = info.capacity - info.availableCapacity;
      const pct = Math.round((used / info.capacity) * 100);
      document.getElementById("statSysMem").textContent =
        formatBytes(used) + " / " + formatBytes(info.capacity);
      document.getElementById("statSysMemBar").style.width = pct + "%";
      document.getElementById("statSysMemSub").textContent =
        gsUtils.getMessage("js_monitor_free") + ": " +
        formatBytes(info.availableCapacity) + " · " + pct + "%";
    } catch (e) {
      gsUtils.warning("monitor", "system.memory unavailable");
    }
    // overall cpu load: two snapshots of the per-core cumulative counters
    // 600ms apart; usage = delta(user+kernel) / delta(total) over all cores
    try {
      const sampleA = await chrome.system.cpu.getInfo();
      await new Promise((r) => setTimeout(r, 600));
      const sampleB = await chrome.system.cpu.getInfo();
      let busy = 0;
      let total = 0;
      sampleB.processors.forEach((proc, i) => {
        const prev = sampleA.processors[i];
        if (!prev) return;
        busy += proc.usage.user + proc.usage.kernel -
          (prev.usage.user + prev.usage.kernel);
        total += proc.usage.total - prev.usage.total;
      });
      if (total > 0) {
        const pct = Math.round((busy / total) * 100);
        document.getElementById("statSysCpu").textContent = pct + "%";
        document.getElementById("statSysCpuBar").style.width = pct + "%";
        document.getElementById("statSysCpuSub").textContent =
          gsUtils.getMessage("js_monitor_cores") + ": " +
          sampleB.numOfProcessors;
      }
    } catch (e) {
      gsUtils.warning("monitor", "system.cpu unavailable");
    }
  }

  function containsSystemPermissions() {
    return new Promise((resolve) => {
      if (!chrome.permissions || typeof chrome.permissions.contains !== "function") {
        resolve(false);
        return;
      }
      try {
        chrome.permissions.contains(
          { permissions: ["system.cpu", "system.memory"] },
          (granted) => resolve(!chrome.runtime.lastError && granted === true)
        );
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function refreshSystemPermissionState() {
    _systemPermissionsGranted = await containsSystemPermissions();
    const note = document.getElementById("systemPermissionNote");
    const button = document.getElementById("enableSystemStats");
    note.hidden = _systemPermissionsGranted;
    button.hidden = _systemPermissionsGranted ||
      !chrome.permissions || typeof chrome.permissions.request !== "function";
    if (_systemPermissionsGranted) {
      document.getElementById("statSysMem").textContent = "—";
      document.getElementById("statSysCpu").textContent = "—";
    }
  }

  function requestSystemPermissionsFromClick() {
    const button = document.getElementById("enableSystemStats");
    button.addEventListener("click", () => {
      if (!chrome.permissions || typeof chrome.permissions.request !== "function") return;
      try {
        chrome.permissions.request(
          { permissions: ["system.cpu", "system.memory"] },
          (granted) => {
            if (chrome.runtime.lastError || !granted) {
              document.getElementById("systemPermissionNote").hidden = false;
              return;
            }
            refreshSystemPermissionState().then(refresh).catch(() => {
              document.getElementById("systemPermissionNote").hidden = false;
            });
          }
        );
      } catch (e) {
        document.getElementById("systemPermissionNote").hidden = false;
      }
    });
  }

  // ------------------------------------------------------------------
  // formatting helpers
  // ------------------------------------------------------------------

  function formatBytes(bytes) {
    const mb = bytes / 1048576;
    if (mb >= 1000) {
      return (
        (mb / 1024).toFixed(1).replace(/\.0$/, "") +
        " " + gsUtils.getMessage("js_monitor_gb")
      );
    }
    return Math.round(mb) + " " + gsUtils.getMessage("js_monitor_mb");
  }

  function getHost(url) {
    try {
      return new URL(url).host || url;
    } catch (e) {
      return url || "";
    }
  }

  function getDisplayUrl(tab) {
    if (gsMemorySampler.isSuspendedTabUrl(tab.url)) {
      return gsUtils.getOriginalUrl(tab.url) || tab.url;
    }
    return tab.url;
  }

  function getFaviconUrl(tab) {
    const url = getDisplayUrl(tab);
    return chrome.runtime.getURL(
      "/_favicon/?pageUrl=" + encodeURIComponent(url) + "&size=16"
    );
  }

  // ------------------------------------------------------------------
  // memory breakdown tooltip: explains how the displayed figure was
  // computed from estimate components, fixed values, and cached samples
  // ------------------------------------------------------------------

  // finer than formatBytes: small contributions would all round to "0 MB"
  function formatBytesFine(bytes) {
    const mb = bytes / 1048576;
    if (mb >= 1000) {
      return (
        (mb / 1024).toFixed(1).replace(/\.0$/, "") +
        " " + gsUtils.getMessage("js_monitor_gb")
      );
    }
    const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return rounded + " " + gsUtils.getMessage("js_monitor_mb");
  }

  function buildMemTipContent(row) {
    const frag = document.createDocumentFragment();

    const addNote = (key) => {
      const note = document.createElement("div");
      note.className = "memTipNote";
      note.textContent = gsUtils.getMessage(key);
      frag.appendChild(note);
    };
    const addLine = (label, bytes, isTotal) => {
      const line = document.createElement("div");
      line.className = "memTipRow" + (isTotal ? " memTipTotal" : "");
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      const valueEl = document.createElement("span");
      valueEl.className = "memTipValue";
      valueEl.textContent = (isTotal ? "≈" : "+") + formatBytesFine(bytes);
      line.appendChild(labelEl);
      line.appendChild(valueEl);
      frag.appendChild(line);
    };
    const msg = (key) => gsUtils.getMessage(key);

    if (row.status === "discarded") {
      addNote(row.memBytes === null ? "js_monitor_discard_unknown" : "js_monitor_discard_history_tip");
      return frag;
    }
    if (row.memMethod === "fixed") {
      addNote("js_monitor_tt_fixed_suspended");
      return frag;
    }
    if (row.memMethod === "stale") {
      addNote("js_monitor_tt_stale");
      return frag;
    }
    if (row.memMethod !== "estimate") return frag;

    const b = row.memBreakdown;
    if (b) {
      const shared = b.groupSize > 1 ? " ÷" + b.groupSize : "";
      addLine(msg("js_monitor_tt_base") + shared, b.baseBytes);
      addLine(
        msg("js_monitor_tt_heap") +
          " (" + formatBytesFine(b.heapUsedBytes) + ")" + shared,
        b.heapBytes
      );
      addLine(
        msg("js_monitor_tt_dom") + " (" + b.domNodes.toLocaleString() + ")",
        b.domBytes
      );
      if (b.imgBytes) addLine(msg("js_monitor_tt_images"), b.imgBytes);
      if (b.canvasBytes) addLine(msg("js_monitor_tt_canvas"), b.canvasBytes);
      if (b.mediaBytes) {
        addLine(
          msg("js_monitor_tt_media") + " (" + b.mediaCount + ")",
          b.mediaBytes
        );
      }
      if (b.cssFontBytes) addLine(msg("js_monitor_tt_css"), b.cssFontBytes);
      if (b.scriptBytes) {
        addLine(msg("js_monitor_tt_scripts"), b.scriptBytes);
      }
      if (b.iframeBytes) {
        addLine(
          msg("js_monitor_tt_iframes") + " (" + b.iframeCount + ")",
          b.iframeBytes
        );
      }
      addLine(msg("js_monitor_tt_total"), b.totalBytes, true);
      if (b.groupSize > 1) addNote("js_monitor_tt_shared");
    }
    addNote("js_monitor_tt_estimate_note");
    return frag;
  }

  let _memTipEl = null;

  function hideMemTip() {
    if (_memTipEl) _memTipEl.hidden = true;
  }

  function showMemTip(anchor, row) {
    if (!_memTipEl) {
      _memTipEl = document.createElement("div");
      _memTipEl.className = "memTip";
      _memTipEl.hidden = true;
      document.body.appendChild(_memTipEl);
      window.addEventListener("scroll", hideMemTip, true);
    }
    const content = buildMemTipContent(row);
    if (!content.childNodes.length) return;
    _memTipEl.textContent = "";
    _memTipEl.appendChild(content);
    _memTipEl.style.left = "0px";
    _memTipEl.style.top = "0px";
    _memTipEl.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const tipWidth = _memTipEl.offsetWidth;
    const tipHeight = _memTipEl.offsetHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + tipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tipWidth - 8;
    }
    if (top + tipHeight > window.innerHeight - 8) {
      top = rect.top - tipHeight - 6;
    }
    _memTipEl.style.left = Math.max(8, left) + "px";
    _memTipEl.style.top = Math.max(8, top) + "px";
  }

  function attachMemTip(anchor, row) {
    anchor.tabIndex = 0;
    anchor.addEventListener("focus", () => showMemTip(anchor, row));
    anchor.addEventListener("blur", hideMemTip);
    anchor.addEventListener("keydown", (event) => { if (event.key === "Escape") hideMemTip(); });
    anchor.addEventListener("mouseenter", () => showMemTip(anchor, row));
    anchor.addEventListener("mouseleave", hideMemTip);
  }

  // ------------------------------------------------------------------
  // rendering
  // ------------------------------------------------------------------

  const SVG_NS = "http://www.w3.org/2000/svg";
  const ACTION_ICON_PATHS = {
    goto: ["M5 11 L11 5", "M6 5 H11 V10", "M9 2 H3 A1 1 0 0 0 2 3 V13 A1 1 0 0 0 3 14 H13 A1 1 0 0 0 14 13 V7"],
    suspend: ["M6 3 V13", "M10 3 V13"],
    unsuspend: ["M5 3 L12 8 L5 13 Z"],
    discard: ["M8 2 L13 9 H3 Z", "M3 12 H13 V14 H3 Z"],
    close: ["M4 4 L12 12", "M12 4 L4 12"],
    power: ["M8 1.5 V7.5", "M4.9 3.8 A5.1 5.1 0 1 0 11.1 3.8"],
  };

  function buildActionButton(action, titleKey, handler, disabled = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.disabled = disabled;
    btn.dataset.action = action;
    btn.className = "actBtn" + (action === "close" ? " actClose" : "");
    btn.title = gsUtils.getMessage(titleKey);
    btn.setAttribute("aria-label", btn.title);
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    for (const d of ACTION_ICON_PATHS[action]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      if (action === "unsuspend") {
        path.setAttribute("fill", "currentColor");
        path.setAttribute("stroke", "none");
      }
      svg.appendChild(path);
    }
    btn.appendChild(svg);
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!btn.disabled) return handler();
    });
    return btn;
  }

  function buildTabActions(row) {
    const tab = row.tab;
    const actions = document.createElement("div");
    actions.className = "rowActions";
    actions.appendChild(
      buildActionButton("goto", "js_monitor_action_goto", () => gotoTab(tab))
    );

    // The second slot always toggles between pause and resume. Chrome
    // restores discarded/frozen pages on activation; placeholders use TGS.
    const resumable = ["suspended", "discarded", "frozen"].includes(row.status);
    actions.appendChild(buildActionButton(
      resumable ? "unsuspend" : "suspend",
      resumable ? "js_monitor_action_unsuspend" : "js_monitor_action_suspend",
      () => runTabAction(resumable ? "unsuspend" : "suspend", tab),
      !resumable && !gsMemorySampler.isInjectableUrl(tab.url)
    ));

    // Keep the eject icon in its slot even when Chrome cannot discard it.
    actions.appendChild(buildActionButton(
      "discard", "js_monitor_action_discard", () => runTabAction("discard", tab),
      !!tab.active || !!tab.discarded
    ));
    actions.appendChild(
      buildActionButton("close", "js_monitor_action_close", () => closeTab(tab))
    );
    return actions;
  }

  function sendTgsMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function gotoTab(tab) {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  }

  async function waitForTabAction(tabId, action) {
    const deadline = Date.now() + ACTION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const tab = await withDeadline(chrome.tabs.get(tabId), Math.max(1, deadline - Date.now()));
      const suspended = gsMemorySampler.isSuspendedTabUrl(tab.url);
      if (action === "suspend" ? suspended : action === "discard" ? tab.discarded
        : !suspended && !tab.discarded && !tab.frozen) return tab;
      await wait(200);
    }
    throw new Error(gsUtils.getMessage("js_monitor_action_timeout"));
  }

  async function performTabAction(action, tab) {
    // TGS acknowledges queued requests before navigation actually finishes.
    // Wait for the tab state, not just the messaging callback.
    if (action === "discard") await withDeadline(chrome.tabs.discard(tab.id));
    else if (action === "suspend" || gsMemorySampler.isSuspendedTabUrl(tab.url)) {
      await withDeadline(sendTgsMessage({ function: action === "suspend" ? "suspendTab" : "unsuspendTab", tab }));
    } else {
      await withDeadline(chrome.tabs.update(tab.id, { active: true }));
      await withDeadline(chrome.windows.update(tab.windowId, { focused: true }));
    }
    return waitForTabAction(tab.id, action);
  }

  async function rowAfterAction(previous, tab) {
    const row = { ...previous, tab, status: getTabStatus(tab), memBreakdown: null,
      cpuPct: null, memBytes: null, memMethod: "none" };
    if (row.status === "suspended") {
      row.memBytes = gsMemorySampler.EST.SUSPENDED_BYTES;
      row.memMethod = "fixed";
      return row;
    }
    const cache = await withDeadline(gsMemorySampler.updateMemCache({}));
    const cached = cache[tab.url];
    if (cached && Number.isFinite(cached.b)) row.memBytes = cached.b;
    else if (previous.tab.url === tab.url && previous.memMethod !== "fixed") row.memBytes = previous.memBytes;
    row.memMethod = row.status === "discarded" ? "historical" : row.memBytes !== null ? "stale" : "none";
    if (["discarded", "frozen", "special"].includes(row.status) || tab.status === "loading") return row;

    // Preserve the sampler's origin-group attribution when remeasuring a
    // restored page. Only this row will be updated on screen.
    const tabs = await withDeadline(chrome.tabs.query({}));
    const origin = new URL(tab.url).origin;
    const group = tabs.filter((t) => gsMemorySampler.isMeasurableTab(t) && new URL(t.url).origin === origin);
    const measured = await withDeadline(gsMemorySampler.measureTabs(group));
    const current = await withDeadline(chrome.tabs.get(tab.id));
    if (current.url !== tab.url || current.discarded || current.frozen) {
      throw new Error(gsUtils.getMessage("js_monitor_action_changed"));
    }
    const m = measured.get(tab.id);
    if (m) {
      row.memBytes = m.memBytes; row.memMethod = "estimate";
      row.memBreakdown = m.breakdown || null; row.cpuPct = m.cpuPct ?? null;
      await withDeadline(gsMemorySampler.updateMemCache({ [tab.url]: m.memBytes }));
    }
    return row;
  }

  function actionLabel(action) {
    return gsUtils.getMessage("js_monitor_action_pending_" + action);
  }

  function applyRowActionState(tr, row) {
    const state = _tabActions.get(row.tab.id);
    tr.setAttribute("aria-busy", state?.pending ? "true" : "false");
    if (state?.pending) {
      tr.classList.add("rowPending");
      const chip = tr.querySelector(".statusChip");
      chip.textContent = gsUtils.getMessage("js_monitor_action_pending");
      chip.className = "statusChip stPending";
      for (const button of tr.querySelectorAll(".actBtn")) {
        button.disabled = true;
        if (button.dataset.action === state.action) {
          button.classList.add("actionPending");
          button.setAttribute("aria-label", actionLabel(state.action));
          button.title = actionLabel(state.action);
          const spinner = document.createElement("span");
          spinner.className = "actionSpinner";
          spinner.setAttribute("aria-hidden", "true");
          button.appendChild(spinner);
        }
      }
    } else if (state?.error) {
      const error = document.createElement("div");
      error.className = "rowActionError";
      error.textContent = gsUtils.getMessage("js_monitor_action_failed");
      error.title = state.error;
      tr.querySelector(".tabCellText").appendChild(error);
    } else if (state?.done) tr.classList.add("rowActionDone");
  }

  function renderRowInPlace(tabId) {
    const row = _rows.find((r) => r.tab.id === tabId);
    const old = document.querySelector(`#monitorTableBody tr[data-tab-id="${tabId}"]`);
    if (!row || !old) return;
    hideMemTip();
    const focusedAction = old.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    const maxBytes = Math.max(1, ..._rows.map((r) => effectiveMemBytes(r) || 0));
    const replacement = buildRow(row, maxBytes);
    old.replaceWith(replacement); // same position; no sort or filter pass
    if (focusedAction) replacement.querySelector(`[data-action="${focusedAction}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }

  async function runTabAction(action, tab) {
    if (_tabActions.get(tab.id)?.pending) return;
    const previous = _rows.find((r) => r.tab.id === tab.id);
    if (!previous) return;
    _actionRevision++;
    _tabActions.set(tab.id, { action, pending: true });
    document.getElementById("refreshBtn").disabled = true;
    document.getElementById("monitorActionFeedback").textContent = actionLabel(action);
    renderRowInPlace(tab.id);
    try {
      const actual = await performTabAction(action, tab);
      const row = await rowAfterAction(previous, actual);
      const index = _rows.findIndex((r) => r.tab.id === tab.id);
      if (index !== -1) _rows[index] = row;
      _tabActions.set(tab.id, { action, done: true });
      document.getElementById("monitorActionFeedback").textContent = gsUtils.getMessage("js_monitor_action_done");
      renderTabStats();
    } catch (error) {
      _tabActions.set(tab.id, { action, error: error.message || String(error) });
      document.getElementById("monitorActionFeedback").textContent = gsUtils.getMessage("js_monitor_action_failed") + ": " + (error.message || error);
      gsUtils.warning("monitor", "tab action failed", tab.id, action);
    } finally {
      _actionRevision++;
      renderRowInPlace(tab.id);
      const pending = [..._tabActions.values()].some((state) => state.pending);
      document.getElementById("refreshBtn").disabled = _measuring || pending;
      // Give the result a full interval on screen before automatic sorting.
      if (!pending) setAutoRefresh(_autoRefresh);
    }
  }

  async function closeTab(tab) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch (e) {
      gsUtils.warning("monitor", "failed to close tab", tab.id);
    }
    _rows = _rows.filter((row) => row.tab.id !== tab.id);
    renderTable();
    renderTabStats();
  }

  function buildStatusChip(status) {
    const chip = document.createElement("span");
    const classByStatus = {
      normal: "stRunning",
      active: "stActive",
      audible: "stAudible",
      pinned: "stPinned",
      suspended: "stSuspended",
      discarded: "stDiscarded",
      frozen: "stFrozen",
    };
    chip.className = "statusChip " + (classByStatus[status] || "");
    const key =
      status === "special" || status === "normal"
        ? "js_monitor_status_" + (status === "special" ? "unmeasurable" : "normal")
        : "js_monitor_status_" + status;
    chip.textContent = gsUtils.getMessage(key);
    return chip;
  }

  function buildRow(row, maxMemBytes) {
    const tab = row.tab;
    const tr = document.createElement("tr");
    tr.dataset.tabId = tab.id;
    if (row.status === "suspended" || row.status === "discarded") {
      tr.className = "suspendedRow";
    }

    // tab cell: favicon, title, host + window index
    const tdTab = document.createElement("td");
    const cell = document.createElement("div");
    cell.className = "tabCell";
    const favicon = document.createElement("img");
    favicon.className = "tabFavicon";
    favicon.src = getFaviconUrl(tab);
    favicon.addEventListener("error", () => {
      favicon.src = "../images/ch-def-favicon-sml.png";
    });
    cell.appendChild(favicon);
    const text = document.createElement("div");
    text.className = "tabCellText";
    const title = document.createElement("div");
    title.className = "tabCellTitle gotoLink";
    title.textContent =
      tab.title ||
      (gsMemorySampler.isSuspendedTabUrl(tab.url) &&
        gsUtils.getSuspendedTitle(tab.url)) ||
      getDisplayUrl(tab);
    title.title = getDisplayUrl(tab);
    title.addEventListener("click", () => gotoTab(tab));
    text.appendChild(title);
    const host = document.createElement("div");
    host.className = "tabCellHost";
    let hostText = getHost(getDisplayUrl(tab));
    if (_windowCount > 1) {
      hostText +=
        " · " +
        gsUtils.getMessage("js_monitor_window") +
        " " +
        (_windowIndexById[tab.windowId] || "?");
    }
    host.textContent = hostText;
    text.appendChild(host);
    cell.appendChild(text);
    tdTab.appendChild(cell);
    tr.appendChild(tdTab);

    // status cell
    const tdStatus = document.createElement("td");
    tdStatus.appendChild(buildStatusChip(row.status));
    tr.appendChild(tdStatus);

    // Main estimate and compact provenance label.
    const tdMem = document.createElement("td");
    tdMem.className = "memCell";
    const displayBytes = effectiveMemBytes(row);
    const memValue = document.createElement("span");
    memValue.className = "memValue";
    tdMem.appendChild(memValue);
    if (displayBytes === null) {
      memValue.textContent = "—";
      memValue.className += " memNa";
    } else {
      memValue.textContent = formatBytes(displayBytes);
      memValue.classList.add("memHasTip");
      attachMemTip(tdMem, row);
      const method = document.createElement("span");
      method.className = "memMethod";
      if (["estimate", "stale", "fixed", "historical"].includes(row.memMethod)) {
        method.textContent = "~";
      }
      tdMem.appendChild(method);
      const bar = document.createElement("div");
      bar.className = "memBar";
      const fill = document.createElement("div");
      const mb = displayBytes / 1048576;
      fill.className = mb >= 400 ? "memHigh" : mb >= 150 ? "memMed" : "";
      fill.style.width =
        Math.max(2, Math.round((displayBytes / maxMemBytes) * 100)) + "%";
      bar.appendChild(fill);
      tdMem.appendChild(bar);
    }
    if (row.status === "discarded") {
      const provenance = document.createElement("div");
      provenance.className = "memProvenance";
      provenance.textContent = gsUtils.getMessage(row.memBytes === null ? "js_monitor_no_history" : "js_monitor_before_discard");
      tdMem.appendChild(provenance);
      if (row.memBytes === null) attachMemTip(tdMem, row);
    }
    tr.appendChild(tdMem);

    // cpu cell
    const tdCpu = document.createElement("td");
    tdCpu.className = "cpuCell";
    if (row.cpuPct === null) {
      tdCpu.textContent = "—";
      tdCpu.className += " cpuNa";
    } else {
      const dot = document.createElement("span");
      dot.className =
        "cpuDot" +
        (row.cpuPct >= 40 ? " cpuHigh" : row.cpuPct >= 10 ? " cpuMed" : "");
      tdCpu.appendChild(dot);
      const label = row.cpuPct < 1 ? "<1%" : Math.round(row.cpuPct) + "%";
      tdCpu.appendChild(document.createTextNode(label));
    }
    tr.appendChild(tdCpu);

    // actions cell
    const tdActions = document.createElement("td");
    tdActions.appendChild(buildTabActions(row));
    tr.appendChild(tdActions);
    applyRowActionState(tr, row);

    return tr;
  }

  // Historical values remain sortable, with their provenance shown in the row.
  function effectiveMemBytes(row) {
    return row.memBytes;
  }

  function compareRows(a, b) {
    let result = 0;
    if (_sortCol === "memory") {
      result = (effectiveMemBytes(a) || -1) - (effectiveMemBytes(b) || -1);
    } else if (_sortCol === "cpu") {
      result = (a.cpuPct === null ? -1 : a.cpuPct) -
        (b.cpuPct === null ? -1 : b.cpuPct);
    } else if (_sortCol === "status") {
      result = (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
    } else if (_sortCol === "title") {
      result = (a.tab.title || "").localeCompare(b.tab.title || "");
    }
    if (result === 0) {
      result = (effectiveMemBytes(b) || -1) - (effectiveMemBytes(a) || -1);
    }
    return _sortDir === "desc" ? -result : result;
  }

  function renderTable() {
    hideMemTip(); // rows are being replaced under the cursor
    const tbody = document.getElementById("monitorTableBody");
    const query = document.getElementById("monitorSearch").value.trim().toLocaleLowerCase();
    const sorted = _rows.filter((row) =>
      !query || `${row.tab.title || ""} ${getDisplayUrl(row.tab) || ""}`.toLocaleLowerCase().includes(query)
    ).sort(compareRows);
    document.getElementById("searchCount").textContent = sorted.length + " / " + _rows.length;
    let maxMemBytes = 1;
    for (const row of sorted) {
      const bytes = effectiveMemBytes(row);
      if (bytes && bytes > maxMemBytes) {
        maxMemBytes = bytes;
      }
    }
    const fragment = document.createDocumentFragment();
    for (const row of sorted) {
      fragment.appendChild(buildRow(row, maxMemBytes));
    }
    if (!sorted.length) {
      const empty = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6; cell.className = "monitorEmpty";
      cell.textContent = gsUtils.getMessage("js_monitor_search_empty");
      empty.appendChild(cell); fragment.appendChild(empty);
    }
    tbody.textContent = "";
    tbody.appendChild(fragment);
    renderSortIndicators();
  }

  function renderSortIndicators() {
    for (const th of document.querySelectorAll("th.sortable")) {
      const arrow = th.querySelector(".sortArrow");
      if (th.getAttribute("data-sort") === _sortCol) {
        th.classList.add("sorted");
        arrow.textContent = _sortDir === "desc" ? "▼" : "▲";
      } else {
        th.classList.remove("sorted");
        arrow.textContent = "";
      }
    }
  }

  function renderTabStats() {
    const total = _rows.length;
    let suspendedCount = 0;
    let memTotal = 0;
    let measuredCount = 0;
    let historicalCount = 0;
    for (const row of _rows) {
      if (row.status === "suspended" || row.status === "discarded") {
        suspendedCount++;
      }
      if (row.memBytes !== null && row.status !== "discarded") {
        memTotal += row.memBytes;
        measuredCount++;
      }
      if (row.status === "discarded" && row.memBytes !== null) historicalCount++;
    }
    document.getElementById("statTabCount").textContent = total;
    document.getElementById("statTabSub").textContent =
      suspendedCount + " " + gsUtils.getMessage("js_monitor_tabs_suspended");
    document.getElementById("statTabsMem").textContent =
      "~" + formatBytes(memTotal);
    let memSub =
      gsUtils.getMessage("js_monitor_tabs_measured") + ": " +
      measuredCount + " / " + total;
    if (historicalCount) memSub += " · " + gsUtils.getMessage("js_monitor_history_excluded") + ": " + historicalCount;
    document.getElementById("statTabsMemSub").textContent = memSub;
  }

  function renderLastUpdated() {
    document.getElementById("lastUpdated").textContent =
      gsUtils.getMessage("html_monitor_updated") + ": " +
      new Date().toLocaleTimeString();
  }

  // ------------------------------------------------------------------
  // refresh cycle
  // ------------------------------------------------------------------

  async function refresh() {
    if (_measuring || [..._tabActions.values()].some((state) => state.pending)) return;
    _measuring = true;
    const revision = _actionRevision;
    document.getElementById("refreshBtn").classList.add("refreshing");
    try {
      const systemStatsPromise = updateSystemStats();
      const freshRows = await measureAllTabs();
      await systemStatsPromise;
      if (revision !== _actionRevision) return; // a clicked row owns its newer result
      _rows = freshRows;
      _tabActions.clear();
      renderTable();
      renderTabStats();
      renderLastUpdated();
    } catch (e) {
      gsUtils.error("monitor", "Monitor refresh failed");
    } finally {
      _measuring = false;
      document.getElementById("refreshBtn").classList.remove("refreshing");
      document.getElementById("refreshBtn").disabled = [..._tabActions.values()].some((state) => state.pending);
    }
  }

  function setAutoRefresh(enabled) {
    _autoRefresh = enabled;
    localStorage.setItem(AUTOREFRESH_STORAGE_KEY, enabled ? "true" : "false");
    clearInterval(_refreshTimer);
    _refreshTimer = null;
    if (enabled) {
      _refreshTimer = setInterval(() => {
        if (!document.hidden) refresh();
      }, REFRESH_INTERVAL_MS);
    }
  }

  // ------------------------------------------------------------------
  // init
  // ------------------------------------------------------------------

  gsUtils.documentReadyAndLocalisedAsPromsied(document).then(async function () {
    // hide noIncognito items in incognito mode
    if (chrome.extension.inIncognitoContext) {
      Array.prototype.forEach.call(
        document.getElementsByClassName("noIncognito"),
        function (el) {
          el.style.display = "none";
        }
      );
    }

    // restore preferences
    try {
      const savedSort = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY));
      if (savedSort && savedSort.col) {
        _sortCol = savedSort.col;
        _sortDir = savedSort.dir === "asc" ? "asc" : "desc";
      }
    } catch (e) {}
    _autoRefresh = localStorage.getItem(AUTOREFRESH_STORAGE_KEY) !== "false";

    // sortable column headers
    for (const th of document.querySelectorAll("th.sortable")) {
      const arrow = document.createElement("span");
      arrow.className = "sortArrow";
      th.appendChild(arrow);
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (_sortCol === col) {
          _sortDir = _sortDir === "desc" ? "asc" : "desc";
        } else {
          _sortCol = col;
          _sortDir = col === "title" || col === "status" ? "asc" : "desc";
        }
        localStorage.setItem(
          SORT_STORAGE_KEY,
          JSON.stringify({ col: _sortCol, dir: _sortDir })
        );
        renderTable();
      });
    }

    // methodology tooltips
    document.getElementById("memHeader").title =
      gsUtils.getMessage("js_monitor_memory_tooltip");
    document.getElementById("cpuHeader").title =
      gsUtils.getMessage("js_monitor_cpu_tooltip");

    requestSystemPermissionsFromClick();
    await refreshSystemPermissionState();

    const sampleToggle = document.getElementById("backgroundSampling");
    try {
      const stored = await chrome.storage.local.get(gsMemorySampler.MONITOR_SAMPLING_ENABLED_STORAGE_KEY);
      sampleToggle.checked = !!stored[gsMemorySampler.MONITOR_SAMPLING_ENABLED_STORAGE_KEY];
    } catch (e) { sampleToggle.checked = false; }
    sampleToggle.addEventListener("change", async () => {
      const enabled = sampleToggle.checked;
      try {
        await chrome.storage.local.set({ [gsMemorySampler.MONITOR_SAMPLING_ENABLED_STORAGE_KEY]: enabled });
        if (enabled) await gsMemorySampler.setupAlarm();
        else await gsMemorySampler.clearAlarm();
      } catch (e) {
        sampleToggle.checked = !enabled;
      }
    });
    const search = document.getElementById("monitorSearch");
    search.placeholder = gsUtils.getMessage("js_monitor_search_placeholder");
    search.setAttribute("aria-label", search.placeholder);
    search.addEventListener("input", renderTable);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { search.value = ""; renderTable(); }
    });

    document.getElementById("refreshBtn").addEventListener("click", () => {
      refresh();
    });

    const autoRefreshEl = document.getElementById("autoRefresh");
    autoRefreshEl.checked = _autoRefresh;
    autoRefreshEl.addEventListener("change", () => {
      setAutoRefresh(autoRefreshEl.checked);
    });
    setAutoRefresh(_autoRefresh);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && _autoRefresh) refresh();
    });

    refresh();
  });
})();
