/*global chrome */
"use strict";

/**
 * Per-tab memory measurement shared by the resource monitor page and the
 * background sampling alarm in the service worker.
 *
 * Chrome does not expose real per-tab memory to extensions on the stable
 * channel, so every signal that IS available is combined into an estimate
 * calibrated against the "Memory usage" figure in Chrome's tab hover cards.
 * Measurements are cached in chrome.storage.local keyed by url, so that
 * suspended/discarded tabs can show how much memory unloading them freed.
 *
 * NOTE: deliberately has no imports (used from both the service worker and
 * extension pages; keeps the module graph cycle-free).
 */

const MEM_CACHE_STORAGE_KEY = "gsMonitorMemCache";
const MONITOR_SAMPLING_ENABLED_STORAGE_KEY = "gsMonitorSamplingEnabled";
const MEM_CACHE_MAX_ENTRIES = 800;
const MEM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SAMPLE_ALARM_NAME = "gsMonitorMemorySample";
const SAMPLE_PERIOD_MINUTES = 5;

const INJECTION_TIMEOUT_MS = 3000;
const INJECTION_CHUNK_SIZE = 10;
const CPU_WINDOW_MS = 30000;

// calibrated against the "Memory usage" figure in Chrome's tab hover cards,
// which shows the private memory footprint attributed to the tab. large
// components are damped/capped: the hover card grows sublinearly relative to
// naive sums (decoded images get discarded, big heaps have proportionally
// less native duplication, ad iframes share processes)
const EST = {
  BASE_BYTES: 40 * 1048576, // renderer process baseline (private footprint)
  HEAP_TIER1_BYTES: 50 * 1048576, // below this, native memory ~2.2x used heap
  HEAP_TIER1_FACTOR: 2.2,
  HEAP_TIER2_FACTOR: 1.5, // above tier1 the correlation flattens
  HEAP_TOTAL_FACTOR: 1.1, // reserved-but-free heap is still private memory
  BYTES_PER_DOM_NODE: 1400, // DOM node + layout tree + computed style
  DOM_CAP: 120 * 1048576,
  IMG_FACTOR: 0.5, // decoded bitmaps, partially discarded / on GPU
  IMG_TOTAL_CAP: 200 * 1048576, // decoded-image cache is bounded per process
  VIDEO_BYTES: 50 * 1048576, // demuxer + decoder + MSE frame buffers
  AUDIO_BYTES: 8 * 1048576,
  CSS_FONT_FACTOR: 1.5, // parsed stylesheets and font atlases
  SCRIPT_FACTOR: 0.4, // compiled-code part not already in the heap
  IFRAME_PROCESS_BYTES: 15 * 1048576, // process share per cross-origin origin
  IFRAME_UNATTRIBUTED_BYTES: 5 * 1048576, // iframes we could not inject into
  IFRAME_UNATTRIBUTED_MAX: 8,
  // Chrome's hover card attributes memory per tab (not per process), and
  // shows ~4MB for our suspended placeholder pages
  SUSPENDED_BYTES: 4 * 1048576,
  DISCARDED_BYTES: 512 * 1024,
};

// ------------------------------------------------------------------
// measurement script injected into each tab (must be self-contained)
// ------------------------------------------------------------------

async function collectFrameStats(cpuWindowMs) {
  const res = { origin: "", nodes: 0, heapUsed: 0, heapTotal: 0, imgBytes: 0,
    canvasBytes: 0, videos: 0, audios: 0, iframes: 0, cssFontBytes: 0,
    scriptBytes: 0, cpuBusyPct: null };
  try { res.origin = location.origin; } catch (e) {}
  try {
    const m = performance.memory;
    if (m && m.usedJSHeapSize) res.heapUsed = m.usedJSHeapSize;
    if (m && m.totalJSHeapSize) res.heapTotal = m.totalJSHeapSize;
  } catch (e) {}
  try { res.nodes = document.getElementsByTagName("*").length; } catch (e) {}
  try {
    res.iframes = document.getElementsByTagName("iframe").length;
  } catch (e) {}
  try {
    const imgs = document.images;
    const n = Math.min(imgs.length, 3000);
    for (let i = 0; i < n; i++) {
      const w = imgs[i].naturalWidth, h = imgs[i].naturalHeight;
      if (w && h) res.imgBytes += Math.min(w * h * 4, 67108864);
    }
  } catch (e) {}
  try {
    const cvs = document.getElementsByTagName("canvas");
    for (let i = 0; i < cvs.length; i++) {
      res.canvasBytes += (cvs[i].width * cvs[i].height * 4) || 0;
    }
  } catch (e) {}
  try {
    const vids = document.getElementsByTagName("video");
    for (let i = 0; i < vids.length; i++) {
      if (vids[i].currentSrc || vids[i].readyState > 0) res.videos++;
    }
    const auds = document.getElementsByTagName("audio");
    for (let i = 0; i < auds.length; i++) {
      if (auds[i].currentSrc || auds[i].readyState > 0) res.audios++;
    }
  } catch (e) {}
  try {
    for (const r of performance.getEntriesByType("resource")) {
      const s = r.decodedBodySize || r.transferSize || 0;
      const t = r.initiatorType;
      if (t === "script") res.scriptBytes += s;
      else if (t === "css" || t === "link" ||
          /\.(woff2?|ttf|otf)([?#]|$)/i.test(r.name)) res.cssFontBytes += s;
    }
  } catch (e) {}
  // main-thread busy share over the recent window, from buffered long tasks
  try {
    res.cpuBusyPct = await new Promise((resolve) => {
      const entries = [];
      let po;
      try {
        po = new PerformanceObserver((list) => {
          entries.push.apply(entries, list.getEntries());
        });
        po.observe({ type: "longtask", buffered: true });
      } catch (e) {
        resolve(null);
        return;
      }
      setTimeout(() => {
        try {
          entries.push.apply(entries, po.takeRecords());
          po.disconnect();
        } catch (e) {}
        const now = performance.now();
        const win = Math.min(now, cpuWindowMs);
        if (win < 500) {
          resolve(0);
          return;
        }
        let busyMs = 0;
        for (const e of entries) {
          if (e.startTime + e.duration > now - win) {
            busyMs += Math.min(e.duration, win);
          }
        }
        resolve(Math.min(100, (busyMs / win) * 100));
      }, 120);
    });
  } catch (e) {}
  return res;
}

// ------------------------------------------------------------------
// aggregation and estimation
// ------------------------------------------------------------------

async function injectAndCollect(tab) {
  // catch on the injection itself so a rejection after the timeout has won
  // the race does not surface as an unhandled promise rejection
  const injection = chrome.scripting
    .executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: collectFrameStats,
      args: [CPU_WINDOW_MS],
    })
    .catch(() => null);
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(null), INJECTION_TIMEOUT_MS)
  );
  const results = await Promise.race([injection, timeout]);
  if (!results) return null;

  const frames = results.map((r) => r && r.result).filter(Boolean);
  if (!frames.length) return null;

  // sum DOM-side stats across frames; count the JS heap once per unique
  // origin, since same-origin frames share a renderer process
  const agg = { nodes: 0, imgBytes: 0, canvasBytes: 0, videos: 0, audios: 0,
    iframeElements: 0, injectedChildFrames: 0, cssFontBytes: 0,
    scriptBytes: 0, heapByOrigin: {}, cpuBusyPct: null, topOrigin: "",
    crossOriginFrameOrigins: 0 };
  let topFrameResult = null;
  for (let i = 0; i < results.length; i++) {
    const frame = results[i];
    if (frame && frame.frameId === 0) topFrameResult = frame.result;
  }
  agg.topOrigin = (topFrameResult && topFrameResult.origin) ||
    frames[0].origin || "";
  agg.injectedChildFrames = Math.max(0, frames.length - 1);

  for (const f of frames) {
    agg.nodes += f.nodes || 0;
    agg.imgBytes += f.imgBytes || 0;
    agg.canvasBytes += f.canvasBytes || 0;
    agg.videos += f.videos || 0;
    agg.audios += f.audios || 0;
    agg.iframeElements += f.iframes || 0;
    agg.cssFontBytes += f.cssFontBytes || 0;
    agg.scriptBytes += f.scriptBytes || 0;
    const origin = f.origin || "unknown";
    const prev = agg.heapByOrigin[origin] || { used: 0, total: 0 };
    agg.heapByOrigin[origin] = {
      used: Math.max(prev.used, f.heapUsed || 0),
      total: Math.max(prev.total, f.heapTotal || 0),
    };
    if (f.cpuBusyPct !== null && f.cpuBusyPct !== undefined) {
      agg.cpuBusyPct = Math.max(agg.cpuBusyPct || 0, f.cpuBusyPct);
    }
  }
  for (const origin of Object.keys(agg.heapByOrigin)) {
    if (origin !== agg.topOrigin) agg.crossOriginFrameOrigins++;
  }
  return agg;
}

// returns the estimate broken down into its components (all byte values are
// the final, already scaled contributions), so the UI can explain the figure
function estimateBytes(agg, originGroupSize) {
  const groupSize = Math.max(1, originGroupSize);
  // per unique origin take whichever is larger: the used heap scaled by the
  // (tiered) native-memory correlation, or the reserved heap (free space in
  // the heap still counts towards the process' private footprint)
  let heap = 0;
  let heapUsed = 0;
  for (const origin of Object.keys(agg.heapByOrigin)) {
    const h = agg.heapByOrigin[origin];
    const tiered =
      h.used <= EST.HEAP_TIER1_BYTES
        ? h.used * EST.HEAP_TIER1_FACTOR
        : EST.HEAP_TIER1_BYTES * EST.HEAP_TIER1_FACTOR +
          (h.used - EST.HEAP_TIER1_BYTES) * EST.HEAP_TIER2_FACTOR;
    heap += Math.max(tiered, h.total * EST.HEAP_TOTAL_FACTOR);
    heapUsed += h.used;
  }
  // iframes we could not inject into (sandboxed, ads blocked from
  // injection, about:blank) still have processes behind them; every
  // cross-origin iframe origin runs its own renderer process, which the
  // hover card attributes to the tab in full
  const unattributed = Math.min(
    Math.max(0, agg.iframeElements - agg.injectedChildFrames),
    EST.IFRAME_UNATTRIBUTED_MAX
  );
  const parts = {
    groupSize: groupSize,
    baseBytes: Math.round(EST.BASE_BYTES / groupSize),
    heapBytes: Math.round(heap / groupSize),
    heapUsedBytes: Math.round(heapUsed),
    domNodes: agg.nodes,
    domBytes: Math.round(
      Math.min(agg.nodes * EST.BYTES_PER_DOM_NODE, EST.DOM_CAP)
    ),
    imgBytes: Math.round(
      Math.min(agg.imgBytes, EST.IMG_TOTAL_CAP) * EST.IMG_FACTOR
    ),
    canvasBytes: Math.round(agg.canvasBytes),
    mediaCount: agg.videos + agg.audios,
    mediaBytes: agg.videos * EST.VIDEO_BYTES + agg.audios * EST.AUDIO_BYTES,
    cssFontBytes: Math.round(agg.cssFontBytes * EST.CSS_FONT_FACTOR),
    scriptBytes: Math.round(agg.scriptBytes * EST.SCRIPT_FACTOR),
    iframeCount: agg.crossOriginFrameOrigins + unattributed,
    iframeBytes:
      agg.crossOriginFrameOrigins * EST.IFRAME_PROCESS_BYTES +
      unattributed * EST.IFRAME_UNATTRIBUTED_BYTES,
  };
  parts.totalBytes =
    parts.baseBytes +
    parts.heapBytes +
    parts.domBytes +
    parts.imgBytes +
    parts.canvasBytes +
    parts.mediaBytes +
    parts.cssFontBytes +
    parts.scriptBytes +
    parts.iframeBytes;
  return parts;
}

// ------------------------------------------------------------------
// public api
// ------------------------------------------------------------------

export const gsMemorySampler = {
  EST: EST,
  MONITOR_SAMPLING_ENABLED_STORAGE_KEY: MONITOR_SAMPLING_ENABLED_STORAGE_KEY,

  isInjectableUrl: function (url) {
    return /^(https?|file):/.test(url || "");
  },

  isSuspendedTabUrl: function (url) {
    return (
      (url || "").indexOf(chrome.runtime.getURL("html/suspended.html")) === 0
    );
  },

  // a tab whose memory can be measured by script injection right now
  isMeasurableTab: function (tab) {
    return (
      gsMemorySampler.isInjectableUrl(tab.url) &&
      !tab.discarded &&
      !tab.frozen &&
      !gsMemorySampler.isSuspendedTabUrl(tab.url)
    );
  },

  /**
   * Measure the given (measurable) tabs by injection.
   * Returns Map tabId -> { memBytes, cpuPct, breakdown }, where breakdown
   * holds the individual components of the estimate (for tooltips).
   */
  measureTabs: async function (tabs) {
    const measured = new Map();
    const aggByTabId = new Map();

    for (let i = 0; i < tabs.length; i += INJECTION_CHUNK_SIZE) {
      const chunk = tabs.slice(i, i + INJECTION_CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (tab) => {
          const agg = await injectAndCollect(tab).catch(() => null);
          if (agg) aggByTabId.set(tab.id, agg);
        })
      );
    }

    // same-origin tabs likely share one renderer process: divide the
    // process-wide parts of the estimate across the group
    const originCounts = {};
    for (const agg of aggByTabId.values()) {
      if (agg.topOrigin) {
        originCounts[agg.topOrigin] = (originCounts[agg.topOrigin] || 0) + 1;
      }
    }

    for (const tab of tabs) {
      const agg = aggByTabId.get(tab.id);
      if (!agg) continue;
      const parts = estimateBytes(agg, originCounts[agg.topOrigin] || 1);
      measured.set(tab.id, {
        memBytes: parts.totalBytes,
        cpuPct: agg.cpuBusyPct,
        breakdown: parts,
      });
    }
    return measured;
  },

  /**
   * Merge new url -> bytes measurements into the persistent cache and
   * return the full merged cache ({ url: { b: bytes, t: timestamp } }).
   */
  updateMemCache: async function (bytesByUrl) {
    let cache = {};
    try {
      const stored = await chrome.storage.local.get(MEM_CACHE_STORAGE_KEY);
      cache = stored[MEM_CACHE_STORAGE_KEY] || {};
    } catch (e) {}

    const now = Date.now();
    const cutoff = now - MEM_CACHE_TTL_MS;
    for (const key of Object.keys(cache)) {
      if (!cache[key] || cache[key].t < cutoff) delete cache[key];
    }
    for (const url of Object.keys(bytesByUrl || {})) {
      cache[url] = { b: bytesByUrl[url], t: now };
    }

    const keys = Object.keys(cache);
    if (keys.length > MEM_CACHE_MAX_ENTRIES) {
      keys.sort((a, b) => cache[a].t - cache[b].t);
      for (const key of keys.slice(0, keys.length - MEM_CACHE_MAX_ENTRIES)) {
        delete cache[key];
      }
    }

    try {
      await chrome.storage.local.set({ [MEM_CACHE_STORAGE_KEY]: cache });
    } catch (e) {}
    return cache;
  },

  // ----------------------------------------------------------------
  // background sampling (service worker)
  // ----------------------------------------------------------------

  setupAlarm: async function () {
    try {
      const stored = await chrome.storage.local.get(MONITOR_SAMPLING_ENABLED_STORAGE_KEY);
      if (!stored[MONITOR_SAMPLING_ENABLED_STORAGE_KEY]) {
        await chrome.alarms.clear(SAMPLE_ALARM_NAME);
        return;
      }
      await chrome.alarms.create(SAMPLE_ALARM_NAME, {
        delayInMinutes: 2,
        periodInMinutes: SAMPLE_PERIOD_MINUTES,
      });
    } catch (e) {}
  },

  clearAlarm: async function () {
    try {
      await chrome.alarms.clear(SAMPLE_ALARM_NAME);
    } catch (e) {}
  },

  isSampleAlarm: function (alarm) {
    return !!alarm && alarm.name === SAMPLE_ALARM_NAME;
  },

  /**
   * Periodically measure all measurable tabs so the cache has a recent
   * value when a tab later gets suspended or discarded. Only runs after
   * the user enables background sampling in the resource monitor, and skips
   * the cycle when a monitor page is open (it refreshes by itself).
   */
  runBackgroundSample: async function () {
    try {
      const stored = await chrome.storage.local.get(MONITOR_SAMPLING_ENABLED_STORAGE_KEY);
      if (!stored[MONITOR_SAMPLING_ENABLED_STORAGE_KEY]) return;

      if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime
          .getContexts({ contextTypes: ["TAB"] })
          .catch(() => []);
        const monitorUrl = chrome.runtime.getURL("html/monitor.html");
        if (
          contexts &&
          contexts.some(
            (c) => c.documentUrl && c.documentUrl.indexOf(monitorUrl) === 0
          )
        ) {
          return;
        }
      }

      const tabs = await chrome.tabs.query({});
      const measurable = tabs.filter(gsMemorySampler.isMeasurableTab);
      if (!measurable.length) return;
      const measured = await gsMemorySampler.measureTabs(measurable);
      const bytesByUrl = {};
      for (const tab of measurable) {
        const m = measured.get(tab.id);
        if (m) bytesByUrl[tab.url] = m.memBytes;
      }
      if (Object.keys(bytesByUrl).length) {
        await gsMemorySampler.updateMemCache(bytesByUrl);
      }
    } catch (e) {
      // background sampling must never break the service worker
    }
  },
};
