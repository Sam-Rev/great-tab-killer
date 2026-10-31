import { tgs } from "./tgs.js"
import { gsUtils } from "./helpers/gsUtils.js"
import { gsStorage } from "./helpers/gsStorage.js"
import { gsTabCheckManager } from "./helpers/gsTabCheckManager.js"
import { gsFavicon } from "./helpers/gsFavicon.js"
import { gsTabSuspendManager } from "./helpers/gsTabSuspendManager.js"
import { gsTabDiscardManager } from "./helpers/gsTabDiscardManager.js"
import { gsSession } from "./helpers/gsSession.js"
import { gsChrome } from "./helpers/gsChrome.js"
import { gsBackup } from "./helpers/gsBackup.js"
import { gsMemorySampler } from "./helpers/gsMemorySampler.js"

const STARTUP_CHECKS_SESSION_KEY = "gsStartupChecksCompletedVersion";

function shouldSkipStartupChecks(currentVersion, completedVersion, storedVersion) {
  return completedVersion === currentVersion && storedVersion === currentVersion;
}

let startupChecksPromise;
let startupChecksCompletedVersionInWorker = null;

async function getCompletedStartupChecksVersion() {
  if (startupChecksCompletedVersionInWorker) {
    return startupChecksCompletedVersionInWorker;
  }
  if (!chrome.storage.session) {
    return null;
  }
  try {
    const storedState = await chrome.storage.session.get(
      STARTUP_CHECKS_SESSION_KEY
    );
    startupChecksCompletedVersionInWorker =
      storedState[STARTUP_CHECKS_SESSION_KEY] || null;
    return startupChecksCompletedVersionInWorker;
  } catch (error) {
    gsUtils.warning(
      "background",
      "Failed to read startup checks session state"
    );
    return null;
  }
}

async function markStartupChecksCompletedForVersion(version) {
  startupChecksCompletedVersionInWorker = version;
  if (!chrome.storage.session) {
    return;
  }
  try {
    await chrome.storage.session.set({
      [STARTUP_CHECKS_SESSION_KEY]: version,
    });
  } catch (error) {
    gsUtils.warning(
      "background",
      "Failed to save startup checks session state"
    );
  }
}

function ensureStartupChecks() {
  if (startupChecksPromise) {
    return startupChecksPromise;
  }

  startupChecksPromise = (async () => {
    const currentVersion = chrome.runtime.getManifest().version;
    const completedVersion = await getCompletedStartupChecksVersion();
    const storedVersion = await gsStorage.fetchLastVersion();

    if (shouldSkipStartupChecks(currentVersion, completedVersion, storedVersion)) {
      gsUtils.log(
        "background",
        "Startup checks already completed for version",
        currentVersion
      );
      return;
    }

    await gsSession.runStartupChecks();
    await markStartupChecksCompletedForVersion(currentVersion);
  })().catch((error) => {
    startupChecksPromise = null;
    throw error;
  });

  return startupChecksPromise;
}

const backgroundInitialisationPromise = Promise.resolve()
  .then(tgs.backgroundScriptsReadyAsPromised) // wait until all gsLibs have loaded
  .then(gsStorage.initSettingsAsPromised) // ensure settings have been loaded and synced
  .then(() => {
    // initialise other gsLibs
    return Promise.all([
      gsFavicon.initAsPromised(),
      gsTabSuspendManager.initAsPromised(),
      gsTabCheckManager.initAsPromised(),
      gsTabDiscardManager.initAsPromised(),
      gsSession.initAsPromised(),
      gsBackup.setupAlarm(),
      gsMemorySampler.setupAlarm(),
    ]);
  })
  .catch((error) => {
    gsUtils.error("background", "Background initialization failed");
  })
  .then(ensureStartupChecks) // performs install/update/recovery and tab responsiveness checks once per version/session
  .catch((error) => {
    gsUtils.error("background", "Startup checks failed");
  })
  .then(tgs.initAsPromised) // adds handle(Un)SuspendedTabChanged listeners!
  .catch((error) => {
    gsUtils.error("background", "Background listener initialization failed");
  })
  .finally(() => {
    tgs.startTimers();
  });

chrome.runtime.onStartup.addListener(function () {
  backgroundInitialisationPromise
    .then(ensureStartupChecks)
    .catch((error) => {
      gsUtils.error("background", "Browser-startup checks failed");
    });
});

// TODO: needs to be tested
// Migrate tabs from foreign suspended pages (with ttl, pos, uri in URL hash)
async function migrateForeignSuspendedTabs() {
  try {
    const tabs = await gsChrome.tabsQuery();
    for (const tab of tabs) {
      const tabUrl = (tab && tab.url) || "";

      // Skip if already our suspended page
      if (gsUtils.isSuspendedUrl(tabUrl)) {
        continue;
      }

      // Extract required parameters from hash
      const hasTitle = !!gsUtils.getHashVariable("ttl", tabUrl);
      const hasPos = !!gsUtils.getHashVariable("pos", tabUrl);
      const originalUrl = gsUtils.getOriginalUrl(tabUrl);

      if (!hasTitle || !hasPos || !originalUrl) {
        continue;
      }

      const title = gsUtils.getSuspendedTitle(tabUrl) || "";
      const scrollPos = gsUtils.getSuspendedScrollPosition(tabUrl) || "0";

      const localSuspendedUrl = gsUtils.generateSuspendedUrl(
        originalUrl,
        title,
        scrollPos
      );

      await gsChrome.tabsUpdate(tab.id, { url: localSuspendedUrl });
    }
  } catch (e) {
    gsUtils.error("migration", "Foreign suspended-tab conversion failed");
  }
}

// Session backup + memory sampling alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (gsBackup.isBackupAlarm(alarm)) {
    gsBackup.performBackup();
  } else if (gsMemorySampler.isSampleAlarm(alarm)) {
    // keeps the resource monitor's freed-memory data fresh for tabs that
    // get suspended/discarded while the monitor page is closed
    gsMemorySampler.runBackgroundSample();
  }
});

// Note: onUpdateAvailable is handled in gsSession.prepareForUpdate
// which does backup + restore point + reload
