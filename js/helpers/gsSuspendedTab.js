/*global, gsFavicon, gsStorage, gsSession, gsUtils, gsIndexedDb */
// eslint-disable-next-line no-unused-vars

import {gsFavicon} from "./gsFavicon.js"
import {gsStorage} from "./gsStorage.js"
import {gsSession} from "./gsSession.js"
import {gsUtils} from "./gsUtils.js"
import {gsIndexedDb} from "./gsIndexedDb.js"
import {tgs} from "../tgs.js"
import {isAllowedNavigationUrl} from "./safeNavigationUrl.js"

export var gsSuspendedTab = (function () {
  "use strict";

  async function initTab(tab, { quickInit }) {
    const suspendedUrl = tab.url;

    // Set sessionId for subsequent checks
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setSessionId',
        sessionId: gsSession.getSessionId(),
      });
    } catch (e) {
      gsUtils.log(
        tab.id,
        'Failed to set session ID on tab. Tab might not be ready.'
      );
    }

    // not more applicable

    // Set title
    let title = gsUtils.getSuspendedTitle(suspendedUrl);
    setTitle(tab, title);

    // Set faviconMeta
    const faviconMeta = await gsFavicon.getFaviconMetaData(tab);
    setFaviconMeta(tab, faviconMeta);

    if (quickInit) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, {action: "localiseHtml"}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for localiseHtml");
      }
    });

    const options = await gsStorage.getSettings();
    const originalUrl = gsUtils.getOriginalUrl(suspendedUrl);
    setUnloadTabHandler(tab);

    // Set imagePreview
    const previewMode = options[gsStorage.SCREEN_CAPTURE];
    const previewUri = await getPreviewUri(suspendedUrl);
    await toggleImagePreviewVisibility(tab, previewMode, previewUri);

    // Set theme
    const theme = options[gsStorage.THEME];
    const isLowContrastFavicon = faviconMeta.isDark;
    setTheme(tab, theme, isLowContrastFavicon);


    // Set command
    const suspensionToggleHotkey = await tgs.getSuspensionToggleHotkey();
    if (chrome.runtime.lastError) {
      gsUtils.error("Error while trying to get suspension toggle hot key", chrome.runtime.lastError);
    }

    // Set command
    setCommand(tab, suspensionToggleHotkey);

    // Set url
    setUrl(tab, originalUrl);

    // Set reason
    const suspendReasonInt = tgs.getTabStatePropForTabId(
      tab.id,
      tgs.STATE_SUSPEND_REASON
    );

    let suspendReason = null;
    if (suspendReasonInt === 3) {
      suspendReason = chrome.i18n.getMessage("js_suspended_low_memory");
    }
    setReason(tab, suspendReason);

    // Show the view
    showContents(tab);

    // Set scrollPosition (must come after showing page contents)
    const scrollPosition = gsUtils.getSuspendedScrollPosition(suspendedUrl);
    setScrollPosition(tab, scrollPosition, previewMode);
  }

  function requestUnsuspendTab(tab) {
    const originalUrl = gsUtils.getOriginalUrl(tab.url);
    if (!isAllowedNavigationUrl(originalUrl)) return;
    unsuspendTab(tab, originalUrl);
  }

  function showNoConnectivityMessage(tab) {
    chrome.tabs.sendMessage(tab.id, {action: "showNoConnectivityMessage"}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.error("Error showing no connectivity message");
      }
    });
  }

  function updateCommand(tab, command) {
    setCommand(tab, command);
  }

  function updateTheme(tab, theme, isLowContrastFavicon) {
    setTheme(tab, theme, isLowContrastFavicon);
  }

  async function updatePreviewMode(tab, previewMode) {
    const previewUri = await getPreviewUri(tab.url);
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleImagePreviewVisibility',
        previewMode: previewMode,
        previewUri: previewUri,
      });
    } catch (e) {
      gsUtils.log(tab.id, 'Failed to toggle image preview visibility');
    }

    const scrollPosition = gsUtils.getSuspendedScrollPosition(tab.url);

    setScrollPosition(tab, scrollPosition, previewMode);
  }

  function setReason(tab, reason) {
    chrome.tabs.sendMessage(tab.id, {action: "setReason", reason: reason}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for setReason");
      }
    });
  }

  function showContents(tab) {
    chrome.tabs.sendMessage(tab.id, {action: "showContents"}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for showContents");
      }
    });
  }

  function setScrollPosition(tab, scrollPosition, previewMode) {
    chrome.tabs.sendMessage(tab.id, {action: "setScrollPosition", scrollPosition: scrollPosition, previewMode: previewMode}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for message");
      }
    });
  }

  function setTitle(tab, title) {
    chrome.tabs.sendMessage(tab.id, {action: "setTitle", title: title}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for setTitle");
      }
    });
  }

  function setUrl(tab, url) {
    chrome.tabs.sendMessage(tab.id, {action: "setUrl", url: url}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for setUrl");
      }
    });
  }

  function setFaviconMeta(tab, faviconMeta) {
    chrome.tabs.sendMessage(tab.id, {action: "setFaviconMeta", faviconMeta: faviconMeta}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for setFaviconMeta");
      }
    });
  }

  function setTheme(tab, theme, isLowContrastFavicon) {
    chrome.tabs.sendMessage(tab.id, {action: "setTheme", theme: theme, isLowContrastFavicon: isLowContrastFavicon}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for message");
      }
    });
  }

  async function getPreviewUri(suspendedUrl) {
    const originalUrl = gsUtils.getOriginalUrl(suspendedUrl);
    const preview = await gsIndexedDb.fetchPreviewImage(originalUrl);
    let previewUri = null;
    if (
      preview &&
      preview.img &&
      preview.img !== null &&
      preview.img !== "data:," &&
      preview.img.length > 10000
    ) {
      previewUri = preview.img;
    }
    return previewUri;
  }

  function toggleImagePreviewVisibility(tab, previewMode, previewUri) {
    chrome.tabs.sendMessage(tab.id, {action: "toggleImagePreviewVisibility", previewMode: previewMode, previewUri: previewUri}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for message");
      }
    });
  }

  function setCommand(tab, command) {
    chrome.tabs.sendMessage(tab.id, {action: "setCommand", command: command}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for setCommand");
      }
    });
  }

  function setUnloadTabHandler(tab) {
    chrome.tabs.sendMessage(tab.id, {action: "setUnloadTabHandler", tab: tab}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for message");
      }
    });
  }

  function unsuspendTab(tab, originalUrl) {
    chrome.tabs.sendMessage(tab.id, {action: "unsuspendTab", originalUrl: originalUrl}, function() {
      if (chrome.runtime.lastError) {
        gsUtils.warning(tab.id, "Tab not ready for unsuspendTab");
      }
    });
  }

  return {
    initTab,
    requestUnsuspendTab,
    showNoConnectivityMessage,
    updateCommand,
    updateTheme,
    updatePreviewMode,
  };
})();
