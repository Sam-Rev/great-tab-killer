#!/usr/bin/env node
// Clean-profile Chrome smoke test. Uses only Node 22 built-ins and Chrome CDP.
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.env.EXTENSION_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const chromeBin = process.env.CHROME_BIN || 'google-chrome';
const errors = [];
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 90000);
let profile;
let chrome;
let server;
let cdp;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const payload = Buffer.concat([name, data]);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload));
  return Buffer.concat([header, payload, checksum]);
}

function solidPng([red, green, blue]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32, 0);
  header.writeUInt32BE(32, 4);
  header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(32 * (1 + 32 * 4));
  for (let y = 0; y < 32; y++) {
    const row = y * 129;
    for (let x = 0; x < 32; x++) {
      const pixel = row + 1 + x * 4;
      rows[pixel] = red; rows[pixel + 1] = green; rows[pixel + 2] = blue; rows[pixel + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(fn, label, timeout = timeoutMs) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function connectCdp(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 0;
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, method } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${method}: ${message.error.code}: ${message.error.message}`));
      else resolve(message.result || {});
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket connection failed')), { once: true });
  });
  return {
    ready,
    onMessage(listener) { listeners.add(listener); },
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return promise;
    },
    close() { ws.close(); },
  };
}

async function startServer() {
  const redPng = solidPng([238, 32, 48]);
  const bluePng = solidPng([24, 72, 232]);
  const greenPng = solidPng([24, 200, 72]);
  server = http.createServer((request, response) => {
    const parsed = new URL(request.url, 'http://127.0.0.1');
    const page = parsed.pathname;
    if (page === '/a.png' || page === '/b.png' || page === '/favicon.ico') {
      if (page === '/favicon.ico' && request.headers.host?.startsWith('localhost:')) { response.writeHead(404).end(); return; }
      const icon = page === '/b.png' ? bluePng : page === '/favicon.ico' ? greenPng : redPng;
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }).end(icon);
      return;
    }
    if (page === '/war-probe') {
      const id = parsed.searchParams.get('id') || '';
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><title>WAR probe</title><body><script>
        const base = 'chrome-extension://${id}/';
        window.warProbe = { attempts: [] };
        const urls = [base+'html/suspended.html#ttl=probe&pos=0&uri=https%3A%2F%2Fexample.com', base+'images/icon-16x16.png', base+'_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=16'];
        for (const url of urls) {
          fetch(url).then(r => warProbe.attempts.push({kind:'fetch', url, outcome:'response', status:r.status})).catch(() => warProbe.attempts.push({kind:'fetch', url, outcome:'blocked'}));
          const img = new Image(); img.onload = () => warProbe.attempts.push({kind:'img', url, outcome:'loaded'}); img.onerror = () => warProbe.attempts.push({kind:'img', url, outcome:'blocked'}); img.src = url;
        }
        const frame = document.createElement('iframe'); frame.src = urls[0]; frame.onload = () => warProbe.attempts.push({kind:'iframe', url:urls[0], outcome:'load-event'}); frame.onerror = () => warProbe.attempts.push({kind:'iframe', url:urls[0], outcome:'error-event'}); document.body.append(frame);
      </script></body>`);
      return;
    }
    if (page === '/a' || page === '/b') {
      const icon = page === '/a' ? '/a.png' : '/b.png';
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(`<!doctype html><link rel="icon" href="${icon}"><title>Icon page ${page.slice(1)}</title><h1>Icon page ${page.slice(1)}</h1>`);
      return;
    }
    if (page === '/ico' || page === '/no-icon') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(`<!doctype html><title>${page === '/ico' ? 'ICO' : 'No icon'} page</title><h1>${page === '/ico' ? 'ICO' : 'No icon'} page</h1>`);
      return;
    }
    if (!/^\/[1-5]$/.test(page)) { response.writeHead(404).end('not found'); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><title>Smoke ${page.slice(1)}</title><h1>Local page ${page.slice(1)}</h1>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function main() {
  const port = await startServer();
  profile = await mkdtemp(path.join(os.tmpdir(), 'tgs-smoke-'));
  chrome = spawn(chromeBin, [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--headless=new',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore' });
  const activePortPath = path.join(profile, 'DevToolsActivePort');
  const activePort = await waitFor(async () => {
    try { return (await readFile(activePortPath, 'utf8')).trim().split(/\r?\n/)[0]; }
    catch { return null; }
  }, 'Chrome remote debugging endpoint', 15000);
  const version = await (await fetch(`http://127.0.0.1:${activePort}/json/version`)).json();
  cdp = connectCdp(version.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  cdp.onMessage(async (message) => {
    if (message.method === 'Target.targetCreated') {
      const target = message.params.targetInfo;
      if (target.type !== 'service_worker' && !target.url.startsWith('chrome-extension://')) return;
      try {
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('Log.enable', {}, sessionId);
        const collect = (text) => errors.push(`${target.type} ${target.url}: ${text}`);
        // Events carry their sessionId in the outer protocol message.
        cdp.onMessage((event) => {
          if (event.sessionId !== sessionId) return;
          if (event.method === 'Runtime.exceptionThrown') collect(event.params.exceptionDetails?.text || 'uncaught exception');
          if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
            collect(event.params.args?.map((arg) => arg.value || arg.description || '').join(' '));
          }
          if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') collect(event.params.entry.text);
        });
      } catch (error) { errors.push(`Could not attach to ${target.url}: ${error.message}`); }
    }
  });

  let loaded;
  try {
    loaded = await cdp.send('Extensions.loadUnpacked', { path: root });
  } catch (error) {
    throw new Error(`Extensions.loadUnpacked unavailable/refused by Chrome ${version.Browser}: ${error.message}`);
  }
  const extensionId = loaded.id || loaded.extensionId;
  assert(extensionId, `Extensions.loadUnpacked returned no extensionId: ${JSON.stringify(loaded)}`);
  const extensionOrigin = `chrome-extension://${extensionId}/`;
  const targets = () => cdp.send('Target.getTargets');
  await waitFor(async () => (await targets()).targetInfos.some((target) => target.type === 'service_worker' && target.url.startsWith(extensionOrigin)), 'extension service worker');
  const hostileTitle = '<img src=x onerror=alert(1)>';
  const hostileFragment = `#ttl=${encodeURIComponent(hostileTitle)}&pos=0&uri=${encodeURIComponent('https://example.invalid/')}`;
  const hostileTarget = await cdp.send('Target.createTarget', {url: `${extensionOrigin}html/suspended.html${hostileFragment}`});
  await delay(1200);
  const hostilePage = (await targets()).targetInfos.find((target) => target.targetId === hostileTarget.targetId);
  assert(hostilePage?.url.includes('html/suspended.html'), 'Hostile-fragment page navigated away');
  const hostileSession = await cdp.send('Target.attachToTarget', {targetId: hostileTarget.targetId, flatten: true});
  await cdp.send('Runtime.enable', {}, hostileSession.sessionId);
  const hostileProbe = await cdp.send('Runtime.evaluate', {
    expression: `({injected:!!document.querySelector('#gsTopBarTitle img, img[src="x"]'), text:document.querySelector('#gsTopBarTitle')?.textContent || '', title:document.title})`,
    returnByValue: true,
  }, hostileSession.sessionId);
  const hostileResult = hostileProbe.result?.value;
  assert(hostileResult && !hostileResult.injected, `Hostile fragment injected an element: ${JSON.stringify(hostileResult)}`);
  assert(hostileResult.text === hostileTitle || hostileResult.title === hostileTitle, `Hostile title was not rendered as plain text: ${JSON.stringify(hostileResult)}`);

  const warTarget = await cdp.send('Target.createTarget', {url: 'about:blank'});
  const warSession = await cdp.send('Target.attachToTarget', {targetId: warTarget.targetId, flatten: true});
  await cdp.send('Runtime.enable', {}, warSession.sessionId);
  const warResponses = [];
  const warFrames = [];
  const warListener = (message) => {
    if (message.sessionId !== warSession.sessionId) return;
    if (message.method === 'Page.frameNavigated') warFrames.push(message.params.frame.url);
    if (message.method === 'Network.responseReceived' && message.params.response.url.startsWith(extensionOrigin)) warResponses.push({url: message.params.response.url, status: message.params.response.status});
  };
  cdp.onMessage(warListener);
  await cdp.send('Network.enable', {}, warSession.sessionId);
  await cdp.send('Page.enable', {}, warSession.sessionId);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/war-probe?id=${extensionId}`}, warSession.sessionId);
  const warProbe = await waitFor(async () => {
    const result = await cdp.send('Runtime.evaluate', {expression: 'window.warProbe?.attempts || []', returnByValue: true}, warSession.sessionId);
    const attempts = result.result?.value || [];
    return attempts.length >= 6 ? attempts : null;
  }, 'web-page WAR fetch/frame/image probe');
  await delay(1800);
  const warFrameCheck = await cdp.send('Runtime.evaluate', {expression: '({src:document.querySelector("iframe")?.src || null, attempts:window.warProbe?.attempts || []})', returnByValue: true}, warSession.sessionId);
  const warFrameResult = warFrameCheck.result?.value;
  assert(warFrameResult?.src?.startsWith(`${extensionOrigin}html/suspended.html`), `The web page did not attempt to frame suspended.html: ${JSON.stringify(warFrameResult)}`);
  const completedWarProbe = warFrameResult.attempts;
  assert(new Set(warProbe.map((attempt) => attempt.url.split('#')[0])).size === 3, `Probe did not try all three resource URLs: ${JSON.stringify(warProbe)}`);
  assert(warProbe.filter((attempt) => attempt.kind !== 'iframe').every((attempt) => attempt.outcome === 'blocked'), `Web page loaded a WAR image/fetch resource: ${JSON.stringify(warProbe)}`);
  assert(!warFrames.some((frameUrl) => frameUrl.startsWith(`${extensionOrigin}html/suspended.html`)), `Web page framed suspended.html successfully: frames=${JSON.stringify(warFrames)} probe=${JSON.stringify(completedWarProbe)}`);
  assert(warResponses.every((entry) => entry.status >= 400), `Extension resource returned a success status: ${JSON.stringify(warResponses)}`);
  const evalExtension = async (expression) => {
    let lastError;
    for (let attempt = 0; attempt < 12; attempt++) {
      const page = (await targets()).targetInfos.find((target) => target.type === 'page' && target.url.startsWith(extensionOrigin));
      if (!page) { await delay(200); continue; }
      try {
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
        await cdp.send('Runtime.enable', {}, sessionId);
        const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result?.value;
      } catch (error) { lastError = error; await delay(200); }
    }
    throw lastError || new Error('No stable extension page was available');
  };
  const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const saveScreenshot = async (sessionId, filename) => {
    if (!screenshotDir) return;
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    await writeFile(path.join(screenshotDir, filename), Buffer.from(screenshot.data, 'base64'));
  };
  const captureUiPage = async (url, filename, prepare) => {
    const target = await cdp.send('Target.createTarget', { url });
    const info = await waitFor(async () => (await targets()).targetInfos.find((entry) => entry.targetId === target.targetId), `${filename} page`);
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.setDeviceMetricsOverride', { width: 1365, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
    if (prepare) await prepare(sessionId);
    if (filename) await saveScreenshot(sessionId, filename);
    await cdp.send('Target.closeTarget', { targetId: info.targetId });
  };
  const optionPageUrl = `${extensionOrigin}html/options.html`;
  await captureUiPage(optionPageUrl, 'options.png', async (sessionId) => {
    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: 'document.body.hidden === false && document.querySelectorAll(".tooltipIcon.icon-help-circled").length >= 9', returnByValue: true }, sessionId);
      return result.result?.value;
    }, 'Options tooltip icons');
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'Array.from(document.querySelectorAll(".tooltipIcon.icon-help-circled")).map(el=>{const r=el.getBoundingClientRect();return {visible:el.getClientRects().length>0,width:r.width,height:r.height,mark:getComputedStyle(el,"::before").content}})',
      returnByValue: true,
    }, sessionId);
    assert(result.result.value.length >= 9 && (screenshotDir || (result.result.value.some(({visible}) => visible) && result.result.value.every(({visible,width,height,mark}) => mark === '"?"' && (!visible || (width > 0 && height > 0))))), `Options question-mark icons have no visible size or mark: ${JSON.stringify(result.result.value)}`);
  });
  const historyPageUrl = `${extensionOrigin}html/history.html`;
  await captureUiPage(historyPageUrl, null, async (sessionId) => {
    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: 'document.body.hidden === false && !!document.querySelector("#historySessions")', returnByValue: true }, sessionId);
      return result.result?.value;
    }, 'localized history page');
    await cdp.send('Runtime.evaluate', { expression: `(()=>{const container=document.createElement('div');container.className='sessionContainer';const icon=document.createElement('i');icon.className='sessionIcon icon icon-plus-squared-alt';icon.setAttribute('role','button');icon.setAttribute('aria-label','Toggle session: Icon preview');icon.setAttribute('aria-expanded','false');const title=document.createElement('span');title.className='sessionLink';title.textContent='Icon preview session';const contents=document.createElement('div');contents.className='sessionContents';const windowRow=document.createElement('div');windowRow.className='windowContainer';windowRow.textContent='Window 1';const tabRow=document.createElement('div');tabRow.className='tabContainer';tabRow.textContent='Example page — https://example.com/';contents.append(windowRow,tabRow);icon.onclick=()=>{const opening=icon.classList.contains('icon-plus-squared-alt');icon.classList.toggle('icon-plus-squared-alt',!opening);icon.classList.toggle('icon-minus-squared-alt',opening);icon.setAttribute('aria-expanded',String(opening));contents.hidden=!opening};contents.hidden=true;container.append(icon,title,contents);document.querySelector('#historySessions').append(container)})()`, returnByValue: true }, sessionId);
    const check = await cdp.send('Runtime.evaluate', { expression: '(()=>{const el=document.querySelector("#historySessions .sessionIcon.icon-plus-squared-alt");const r=el?.getBoundingClientRect();return {width:r?.width||0,height:r?.height||0,plus:getComputedStyle(el,"::after").display}})()', returnByValue: true }, sessionId);
    assert(screenshotDir || (check.result.value.width > 0 && check.result.value.height > 0), 'Collapsed session icon has no visible size');
    assert(screenshotDir || check.result.value.plus !== 'none', 'Collapsed session plus mark is missing');
    await saveScreenshot(sessionId, 'history-collapsed.png');
    await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("#historySessions .sessionIcon").click()', returnByValue: true }, sessionId);
    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("#historySessions .sessionIcon.icon-minus-squared-alt")?.getAttribute("aria-expanded") === "true"', returnByValue: true }, sessionId);
      return result.result?.value;
    }, 'expanded history session');
    const expanded = await cdp.send('Runtime.evaluate', { expression: '(()=>{const el=document.querySelector("#historySessions .sessionIcon.icon-minus-squared-alt");const r=el?.getBoundingClientRect();return {width:r?.width||0,height:r?.height||0,minus:getComputedStyle(el,"::before").display,plus:getComputedStyle(el,"::after").display}})()', returnByValue: true }, sessionId);
    assert(screenshotDir || (expanded.result.value.width > 0 && expanded.result.value.height > 0), 'Expanded session icon has no visible size');
    assert(screenshotDir || (expanded.result.value.minus !== 'none' && expanded.result.value.plus === 'none'), 'Expanded session minus mark is missing or plus mark remains');
    await saveScreenshot(sessionId, 'history-expanded.png');
  });
  await captureUiPage(`${extensionOrigin}html/shortcuts.html`, 'shortcuts.png', async (sessionId) => {
    await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: 'document.body.hidden === false && !!document.querySelector(".pageHeader h1")', returnByValue: true }, sessionId);
      return result.result?.value;
    }, 'localized shortcuts page');
  });
  const brandedPages = [
    ['about', 'about.html', '.pageBrandMark'],
    ['backup-setup', 'backup-setup.html', '.pageBrandMark'],
    ['broken', 'broken.html', '.brand-logo'],
    ['changelog', 'changelog.html', '.pageBrandMark'],
    ['history', 'history.html', '.pageBrandMark'],
    ['monitor', 'monitor.html', '.pageBrandMark'],
    ['options', 'options.html', '.pageBrandMark'],
    ['permissions', 'permissions.html', '.brand-logo'],
    ['popup', 'popup.html', '.popupBrand'],
    ['recovery', 'recovery.html', '.brand-logo'],
    ['restoring-window', 'restoring-window.html', '.brand-logo'],
    ['shortcuts', 'shortcuts.html', '.pageBrandMark'],
    ['suspended', 'suspended.html', '.suspendedProductLogo'],
    ['update', 'update.html', '.brand-logo'],
  ];
  const brandedPageResults = [];
  for (const [name, file, selector] of brandedPages) {
    const pageUrl = `${extensionOrigin}html/${file}`;
    const url = file === 'suspended.html' ? `${extensionOrigin}html/${file}#ttl=Brand%20check&pos=0&uri=https%3A%2F%2Fexample.com%2F` : pageUrl;
    const priorErrorCount = errors.length;
    let logoResult;
    await captureUiPage(url, null, async (sessionId) => {
      await waitFor(async () => {
        const result = await cdp.send('Runtime.evaluate', { expression: `document.readyState === 'complete' && Array.from(document.querySelectorAll(${JSON.stringify(selector)})).some(img => img.complete && img.naturalWidth > 0)`, returnByValue: true }, sessionId);
        return result.result?.value;
      }, `${name} logo image load`);
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(()=>{const all=Array.from(document.querySelectorAll(${JSON.stringify(selector)}));const shown=all.filter(img=>img.getClientRects().length>0);return {naturalWidth:Math.max(0,...all.map(img=>img.naturalWidth)),visible:shown.length,rects:shown.map(img=>{const r=img.getBoundingClientRect();return {width:r.width,height:r.height}})}})()`,
        returnByValue: true,
      }, sessionId);
      logoResult = result.result?.value;
      assert(logoResult?.visible > 0 && logoResult.rects.some(({width, height}) => width > 0 && height > 0), `${name} logo has no rendered size: ${JSON.stringify(logoResult)}`);
      await delay(350);
      assert(errors.length === priorErrorCount, `${name} page emitted a console/runtime error: ${JSON.stringify(errors.slice(priorErrorCount))}`);
    });
    brandedPageResults.push({page: name, logo: logoResult});
  }
  const faviconCases = [
    {name: 'a.png', host: '127.0.0.1', page: '/a', icon: '/a.png', rgb: [238, 32, 48]},
    {name: 'b.png', host: '127.0.0.1', page: '/b', icon: '/b.png', rgb: [24, 72, 232]},
    {name: 'favicon.ico', host: '127.0.0.1', page: '/ico', icon: '/favicon.ico', rgb: [24, 200, 72]},
    {name: 'no icon', host: 'localhost', page: '/no-icon', icon: null, rgb: null},
  ];
  const faviconResults = [];
  for (const item of faviconCases) {
    const pageUrl = `http://${item.host}:${port}${item.page}`;
    const target = await cdp.send('Target.createTarget', {url: pageUrl});
    const before = await waitFor(async () => {
      const state = await evalExtension(`(async()=>{const t=(await chrome.tabs.query({})).find(x=>x.url===${JSON.stringify(pageUrl)});return t&&t.status==='complete'?t:null})()`);
      if (!state) return null;
      if (item.icon && !state.favIconUrl?.endsWith(item.icon)) return null;
      return state;
    }, `${item.name} page and favicon loaded`);
    if (item.icon) assert(before.favIconUrl.endsWith(item.icon), `${item.name}: original tab favicon was ${before.favIconUrl}`);
    const suspendedUrlPrefix = `${extensionOrigin}html/suspended.html`;
    const suspended = await evalExtension(`(async()=>{const t=(await chrome.tabs.query({})).find(x=>x.url===${JSON.stringify(pageUrl)});if(!t)return null;await chrome.runtime.sendMessage({function:'suspendTab',tab:t});return t.id})()`);
    assert(suspended, `${item.name}: could not request suspension`);
    const stateWhileSuspended = await waitFor(async () => {
      const tabs = await evalExtension(`(async()=>await chrome.tabs.query({}))()`);
      return tabs.find((t) => t.id === suspended && t.url.startsWith(suspendedUrlPrefix)) || null;
    }, `${item.name} suspension`);
    const suspendedTarget = await waitFor(async () => (await targets()).targetInfos.find((entry) => entry.type === 'page' && entry.url === stateWhileSuspended.url) || null, `${item.name} suspended page target`);
    const {sessionId: suspendedSession} = await cdp.send('Target.attachToTarget', {targetId: suspendedTarget.targetId, flatten: true});
    await cdp.send('Runtime.enable', {}, suspendedSession);
    const iconProbe = await waitFor(async () => {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(async()=>{const href=document.getElementById('gsFavicon')?.href||'';if(!href.startsWith('data:image/'))return {href,loaded:false};const img=new Image();img.src=href;try{await img.decode();const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.drawImage(img,0,0,32,32);const d=x.getImageData(16,16,1,1).data;return {href,loaded:true,pixel:[d[0],d[1],d[2],d[3]]}}catch{return {href,loaded:false}}})()`,
        awaitPromise: true, returnByValue: true,
      }, suspendedSession);
      const value = result.result?.value;
      return value?.loaded ? value : null;
    }, `${item.name} suspended favicon image`);
    if (item.rgb) {
      const channelMatches = iconProbe.pixel.slice(0, 3).every((channel, index) => Math.abs(channel - item.rgb[index]) < 35);
      assert(channelMatches, `${item.name}: suspended favicon pixel ${JSON.stringify(iconProbe.pixel)} did not match ${JSON.stringify(item.rgb)}`);
    } else {
      assert(iconProbe.href.startsWith('data:image/'), 'No-icon page did not receive the documented data-URL fallback');
      const redSiteIconPixel = [238, 32, 48];
      const matchesRedSiteIcon = iconProbe.pixel.slice(0, 3).every((channel, index) => Math.abs(channel - redSiteIconPixel[index]) < 35);
      assert(!matchesRedSiteIcon, 'No-icon page showed the extension test site red icon');
    }
    await evalExtension(`(async()=>{const t=(await chrome.tabs.query({})).find(x=>x.id===${suspended});if(t)await chrome.runtime.sendMessage({function:'unsuspendTab',tab:t})})()`);
    const after = await waitFor(async () => {
      const tab = (await evalExtension(`(async()=>await chrome.tabs.query({}))()`)).find((t) => t.id === suspended && t.url === pageUrl && t.status === 'complete');
      if (!tab) return null;
      if (item.icon && !tab.favIconUrl?.endsWith(item.icon)) return null;
      return tab;
    }, `${item.name} restoration and favicon`);
    faviconResults.push({page: item.name, before: item.icon ? before.favIconUrl : 'no site icon', whileSuspended: item.rgb ? `site icon pixel ${iconProbe.pixel.slice(0, 3).join(',')}` : 'documented data-URL fallback', after: item.icon ? after.favIconUrl : 'restored without site icon'});
    await cdp.send('Target.closeTarget', {targetId: target.targetId});
  }
  const welcomeUrl = `${extensionOrigin}html/options.html?firstTime`;
  await waitFor(async () => (await targets()).targetInfos.filter((target) => target.url === welcomeUrl).length === 1, 'one first-run welcome tab');
  await delay(1500);
  assert((await targets()).targetInfos.filter((target) => target.url === welcomeUrl).length === 1, 'Welcome tab did not remain exactly once');
  const backupSetupTarget = (await targets()).targetInfos.filter((target) => target.url === `${extensionOrigin}html/backup-setup.html`);
  assert(backupSetupTarget.length === 1, 'Expected exactly one first-run backup setup tab');
  const initialState = await evalExtension(`(async()=>({backupEnabled:(await chrome.storage.local.get('gsBackupEnabled')).gsBackupEnabled===true,noticeShown:(await chrome.storage.local.get('gsBackupSetupNoticeShown')).gsBackupSetupNoticeShown===true,backupAlarm:!!(await chrome.alarms.get('tgs-session-backup'))}))()`);
  assert(initialState.noticeShown && !initialState.backupEnabled && !initialState.backupAlarm, `Unexpected first-run backup state: ${JSON.stringify(initialState)}`);
  await cdp.send('Target.closeTarget', { targetId: backupSetupTarget[0].targetId });
  const closedNoticeState = await evalExtension(`(async()=>({backupEnabled:(await chrome.storage.local.get('gsBackupEnabled')).gsBackupEnabled===true,backupAlarm:!!(await chrome.alarms.get('tgs-session-backup'))}))()`);
  assert(!closedNoticeState.backupEnabled && !closedNoticeState.backupAlarm, `Closing the setup tab enabled backups: ${JSON.stringify(closedNoticeState)}`);

  const urls = Array.from({ length: 5 }, (_, index) => `http://127.0.0.1:${port}/${index + 1}`);
  const ids = [];
  for (const url of urls) ids.push((await cdp.send('Target.createTarget', { url })).targetId);
  await waitFor(async () => {
    const state = await evalExtension(`(async()=>{const wanted=${JSON.stringify(urls)};return (await chrome.tabs.query({})).filter(t=>wanted.includes(t.url)).map(t=>({id:t.id,url:t.url}))})()`);
    if (state.length !== 5) return null;
    await evalExtension(`(async()=>{for(const t of await chrome.tabs.query({})){if(${JSON.stringify(urls)}.includes(t.url))await chrome.runtime.sendMessage({function:'suspendTab',tab:t})}})()`);
    return true;
  }, 'five local test tabs');
  const suspendedPattern = `${extensionOrigin}html/suspended.html`;
  const isTestSuspendedTab = (tab) => urls.some((url) => tab.url.includes(encodeURIComponent(url)));
  let suspendedFavicon;
  try {
    await waitFor(async () => {
      const tabs = await evalExtension(`(async()=>await chrome.tabs.query({}))()`);
      const matches = tabs.filter((tab) => tab.url.startsWith(suspendedPattern) && isTestSuspendedTab(tab));
      if (matches.length !== 5) return null;
      const suspendedPage = (await targets()).targetInfos.find((target) => target.type === 'page' && target.url.startsWith(suspendedPattern) && isTestSuspendedTab({url: target.url}));
      if (!suspendedPage) return null;
      const { sessionId: suspendedSession } = await cdp.send('Target.attachToTarget', {targetId: suspendedPage.targetId, flatten: true});
      await cdp.send('Runtime.enable', {}, suspendedSession);
      const faviconResult = await cdp.send('Runtime.evaluate', {expression: 'document.getElementById("gsFavicon")?.href || ""', returnByValue: true}, suspendedSession);
      suspendedFavicon = faviconResult.result?.value;
      if (!suspendedFavicon?.startsWith('data:image/')) return null;
      await evalExtension(`(async()=>{const wanted=${JSON.stringify(urls)};for(const t of await chrome.tabs.query({})){if(t.url.startsWith(${JSON.stringify(suspendedPattern)})&&wanted.some(u=>t.url.includes(encodeURIComponent(u))))await chrome.runtime.sendMessage({function:'unsuspendTab',tab:t})}})()`);
      return true;
    }, 'five suspended tabs');
  } catch (error) {
    const currentTabs = await evalExtension(`(async()=>await chrome.tabs.query({}))()`);
    throw new Error(`${error.message}; matching test tabs observed: ${currentTabs.filter((tab) => tab.url.startsWith(suspendedPattern) && isTestSuspendedTab(tab)).length}`);
  }
  await waitFor(async () => {
    const tabs = await evalExtension(`(async()=>await chrome.tabs.query({}))()`);
    return urls.every((url) => tabs.some((tab) => tab.url === url));
  }, 'five restored tabs');
  await delay(1500);
  const priorErrors = {
    missingSuspendedUrl: errors.some((entry) => entry.includes('tabProperties.url not set')),
    failedFetch: errors.some((entry) => entry.includes('Failed to fetch')),
    recoveryParse: errors.some((entry) => entry.includes('Failed to parse gsExtensionRecovery')),
  };
  process.stdout.write(`${JSON.stringify({ chrome: version.Browser, extensionId, brandedPages: brandedPageResults, faviconResults, welcomeTabs: 1, backupSetupTabs: 1, hostileFragmentProbe: hostileResult, webAccessibleResourceProbe: {attempts: completedWarProbe, framedDocumentUrls: warFrames, extensionResourceResponses: warResponses}, suspendedFavicon: 'fallback data URL for local pages without a favicon', faviconHrefPrefix: suspendedFavicon?.slice(0, 22), backupState: initialState, closedNoticeState, localPages: 5, suspendedAndRestored: true, priorErrors, extensionErrors: errors }, null, 2)}\n`);
  assert(errors.length === 0, `Collected ${errors.length} extension console error(s)`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`SMOKE TEST STOPPED: ${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  cdp?.close();
  if (chrome && chrome.exitCode === null) { chrome.kill('SIGTERM'); await delay(500); }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
}
