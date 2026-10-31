import {gsFavicon} from "./helpers/gsFavicon.js";
import {gsStorage} from "./helpers/gsStorage.js";
import {gsUtils} from "./helpers/gsUtils.js";
import {isAllowedNavigationUrl} from "./helpers/safeNavigationUrl.js";

// Display a fragment title immediately, before the worker finishes tab setup.
const fragmentTitle = gsUtils.getSuspendedTitle(document.location.href);
if (fragmentTitle) {
  document.title = fragmentTitle;
  document.getElementById("gsTitle").textContent = fragmentTitle;
  document.getElementById("gsTopBarTitle").textContent = fragmentTitle;
}

function buildUnsuspendTabHandler() {
  const originalUrl = gsUtils.getOriginalUrl(document.location.href);
  return function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAllowedNavigationUrl(originalUrl)) return;
    if (e.target.id === "setKeyboardShortcut") {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    } else if (e.which === 1) {
      unsuspendTab(originalUrl);
    }
  };
}

function buildImagePreview(previewUri) {
  return new Promise((resolve) => {
    const previewEl = document.createElement("div");
    const bodyEl = document.getElementsByTagName("body")[0];
    previewEl.setAttribute("id", "gsPreviewContainer");
    previewEl.classList.add("gsPreviewContainer");
    previewEl.appendChild(document.getElementById("previewTemplate").content.cloneNode(true));
    const unsuspendTabHandler = buildUnsuspendTabHandler();
    previewEl.onclick = unsuspendTabHandler;
    gsUtils.localiseHtml(previewEl);
    bodyEl.appendChild(previewEl);

    const previewImgEl = document.getElementById("gsPreviewImg");
    const onLoadedHandler = function () {
      previewImgEl.removeEventListener("load", onLoadedHandler);
      previewImgEl.removeEventListener("error", onLoadedHandler);
      resolve();
    };
    previewImgEl.setAttribute("src", previewUri);
    previewImgEl.addEventListener("load", onLoadedHandler);
    previewImgEl.addEventListener("error", onLoadedHandler);
  });
}

function addWatermarkHandler() {
  document.querySelector(".watermark").onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/about.html") });
  };
}

async function toggleImagePreviewVisibility(
    previewMode,
    previewUri
  ) {
  const builtImagePreview =
    document.getElementById("gsPreviewContainer") !== null;
  if (
    !builtImagePreview &&
    previewUri &&
    previewMode &&
    previewMode !== "0"
  ) {
    await buildImagePreview(previewUri);
  } else {
    addWatermarkHandler();
  }

  if (!document.getElementById("gsPreviewContainer")) {
    return;
  }
  const overflow = previewMode === "2" ? "auto" : "hidden";
    document.body.style["overflow"] = overflow;

  if (previewMode === "0" || !previewUri) {
    document.getElementById("gsPreviewContainer").style.display = "none";
    document.getElementById("suspendedMsg").style.display = "flex";
    document.body.classList.remove("img-preview-mode");
  } else {
    document.getElementById("gsPreviewContainer").style.display = "block";
    document.getElementById("suspendedMsg").style.display = "none";
    document.body.classList.add("img-preview-mode");
  }
}

function loadToastTemplate() {
  const toastEl = document.createElement("div");
  toastEl.setAttribute("id", "disconnectedNotice");
  toastEl.classList.add("toast-wrapper");
  toastEl.appendChild(document.getElementById("toastTemplate").content.cloneNode(true));
  gsUtils.localiseHtml(toastEl);
  document.getElementsByTagName("body")[0].appendChild(toastEl);
}

function unsuspendTab(originalUrl) {
  if (!isAllowedNavigationUrl(originalUrl)) return;
  if (document.body.classList.contains("img-preview-mode")) {
    document.getElementById("refreshSpinner").classList.add("spinner");
  } else {
    document.body.classList.add("waking");
    document.getElementById("snoozyImg").src = chrome.runtime.getURL(
      "images/snz_tab_awake.svg"
    );
    document.getElementById("snoozySpinner").classList.add("spinner");
  }
  document.location.replace(originalUrl);
}

function cleanUrl(urlStr) {
  // remove scheme
  if (urlStr.indexOf("//") > 0) {
    urlStr = urlStr.substring(urlStr.indexOf("//") + 2);
  }
  // remove query string
  let match = urlStr.match(/\/?[?#]+/);
  if (match) {
    urlStr = urlStr.substring(0, match.index);
  }
  // remove trailing slash
  match = urlStr.match(/\/$/);
  if (match) {
    urlStr = urlStr.substring(0, match.index);
  }
  return urlStr;
}


chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener(function(
    request,
    sender,
    sendResponse
  ) {
    var senderTab = sender.tab;
    if (senderTab !== undefined) {
      senderTab = senderTab.id;
    } else {
      senderTab = -1;
    }
    gsUtils.log(
      senderTab,
      "suspended message listener",
      request.action
    );

    if (request.hasOwnProperty('action')) {
      if (request.action === 'ping') {
        sendResponse({ pong: true });
        return false;
      } else if (request.action === 'isBodyVisible') {
        const bodyEl = document.getElementsByTagName('body')[0];
        if (!bodyEl) {
          sendResponse(false);
          return false;
        }
        sendResponse(!bodyEl.classList.contains('hide-initially'));
        return false;
      } else if (request.action === 'unsuspendTab') {
        if (isAllowedNavigationUrl(request.originalUrl)) unsuspendTab(request.originalUrl);
        sendResponse();
        return false;
      } else if (request.action === 'setSessionId') {
        document.sessionId = request.sessionId;
        sendResponse();
        return false;
      } else if (request.action === 'getSessionId') {
        sendResponse(document.sessionId);
        return false;
      } else if (request.action === 'setTitle') {
        const title = typeof request.title === 'string' ? request.title : '';
        document.title = title;
        document.getElementById("gsTitle").textContent = title;
        document.getElementById("gsTopBarTitle").textContent = title;
        // Prevent unsuspend by parent container
        // Using mousedown event otherwise click can still be triggered if
        // mouse is released outside of this element
        document.getElementById("gsTopBarTitle").onmousedown = function (e) {
          e.stopPropagation();
        };
        sendResponse();
        return false;
      } else if (request.action === 'setFaviconMeta') {
        document
          .getElementById("gsTopBarImg")
          .setAttribute("src", request.faviconMeta.normalisedDataUrl);
        document
          .getElementById("gsFavicon")
          .setAttribute("href", request.faviconMeta.transparentDataUrl);
          sendResponse();
        return false;
      } else if (request.action === 'localiseHtml') {
        gsStorage.getOption(gsStorage.LANGUAGE).then(lang => {
          const loadPromise = (lang && lang !== 'auto')
            ? gsUtils.loadCustomMessages(lang)
            : Promise.resolve();
          loadPromise.then(() => {
            const effectiveLocale = lang && lang !== 'auto' ? lang : chrome.i18n.getUILanguage();
            const baseLang = effectiveLocale.split(/[-_]/)[0].toLowerCase();
            if (gsUtils.RTL_LOCALES.includes(baseLang)) {
              document.documentElement.setAttribute('dir', 'rtl');
            }
            gsUtils.localiseHtml(document);
            sendResponse();
          });
        });
        return true;
      } else if (request.action === 'setUnloadTabHandler') {
        // beforeunload event will get fired if: the tab is refreshed, the url is changed, or the tab is closed.
        // when this happens the STATE_UNLOADED_URL gets set with the suspended tab url
        // if the tab is refreshed, then on reload the url will match and the tab will unsuspend
        // if the url is changed then on reload the url will not match
        // if the tab is closed, the reload will never occur
        window.addEventListener("beforeunload", function (e) {
          gsUtils.log(request.tab.id, "BeforeUnload triggered: " + request.tab.url);
          chrome.runtime.sendMessage({function: 'setTabStateUnloadedUrlForTabId', tabId: request.tab.id, value: request.tab.url}, function () {
            if (chrome.runtime.lastError) {
              gsUtils.warning("suspended", "Unload-state message failed", request.tab.id);
            }

            const scrollPosition = gsUtils.getSuspendedScrollPosition(request.tab.url);

            chrome.runtime.sendMessage({function: 'setTabStateScrollPosForTabId', tabId: request.tab.id, value: scrollPosition}, function () {
              if (chrome.runtime.lastError) {
                gsUtils.warning("suspended", "Scroll-position message failed", request.tab.id);
              }
            });
          });
        });

        sendResponse();
        return true;
      } else if (request.action === 'setUrl') {
        const urlLink = document.getElementById("gsTopBarUrl");
        const safeUrl = isAllowedNavigationUrl(request.url) ? request.url : '';
        urlLink.textContent = safeUrl ? cleanUrl(safeUrl) : String(request.url || '');
        if (safeUrl) urlLink.setAttribute("href", safeUrl);
        else urlLink.removeAttribute("href");
        document.getElementById("gsTopBarUrl").onmousedown = function (e) {
          e.stopPropagation();
        };
        const unsuspendTabHandler = buildUnsuspendTabHandler();
        urlLink.onclick = unsuspendTabHandler;
        if (safeUrl) {
          document.getElementById("gsTopBar").onmousedown = unsuspendTabHandler;
          document.getElementById("suspendedMsg").onclick = unsuspendTabHandler;
        }
        sendResponse();
        return false;
      } else if (request.action === 'setCommand') {
        const hotkeyEl = document.getElementById("hotkeyWrapper");
        hotkeyEl.replaceChildren();
        if (request.command) {
          const span = document.createElement('span');
          span.className = 'hotkeyCommand';
          span.textContent = `(${request.command})`;
          hotkeyEl.appendChild(span);
        } else {
          const reloadString = gsUtils.getMessage(
            "js_suspended_hotkey_to_reload"
          );
          const link = document.createElement('a');
          link.id = 'setKeyboardShortcut';
          link.href = '#';
          link.textContent = reloadString;
          hotkeyEl.appendChild(link);
        }
        sendResponse();
        return false;
      } else if (request.action === 'showContents') {
        document.querySelector("body").classList.remove("hide-initially");
        sendResponse();
        return false;
      } else if (request.action === 'setReason') {
        let reasonMsgEl = document.getElementById("reasonMsg");
        if (!reasonMsgEl) {
          reasonMsgEl = document.createElement("div");
          reasonMsgEl.setAttribute("id", "reasonMsg");
          reasonMsgEl.classList.add("reasonMsg");
          const containerEl = document.getElementById("suspendedMsg-instr");
          containerEl.insertBefore(reasonMsgEl, containerEl.firstChild);
        }
        reasonMsgEl.textContent = typeof request.reason === 'string' ? request.reason : '';

        sendResponse();
        return false;
      } else if (request.action === 'toggleImagePreviewVisibility') {
        toggleImagePreviewVisibility(request.previewMode, request.previewUri);
        sendResponse();
        return true;
      } else if (request.action === 'setScrollPosition') {
        const scrollPosAsInt = (request.scrollPosition && parseInt(request.scrollPosition)) || 0;
        const scrollImagePreview = request.previewMode === "2";
        if (scrollImagePreview && scrollPosAsInt > 15) {
          const offsetScrollPosition = scrollPosAsInt + 151;
          document.body.scrollTop = offsetScrollPosition;
          document.documentElement.scrollTop = offsetScrollPosition;
        } else {
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
        }
        sendResponse();
        return false;
      } else if (request.action === 'showNoConnectivityMessage') {
        if (!document.getElementById("disconnectedNotice")) {
          loadToastTemplate();
        }
        document.getElementById("disconnectedNotice").style.display =
          "none";
        setTimeout(function () {
          document.getElementById("disconnectedNotice").style.display =
            "block";
        }, 50);
        sendResponse();
        return true;
      } else if (request.action === 'setTheme') {
      if (request.theme === "dark") {
        document.querySelector("body").classList.add("dark");
      } else {
        document.querySelector("body").classList.remove("dark");
      }

      if (request.theme === "dark" && request.isLowContrastFavicon) {
        document
          .getElementById("faviconWrap")
          .classList.add("faviconWrapLowContrast");
      } else {
        document
          .getElementById("faviconWrap")
          .classList.remove("faviconWrapLowContrast");
      }
      sendResponse();
      return false;
    }
    gsUtils.warning("suspended", "Unhandled message action", request.action);
  }

  // No async response pending; default to false
  return false;
});

window.addEventListener("online", function () {
  chrome.runtime.sendMessage({function: 'online'});
});
window.addEventListener("offline", function () {
  chrome.runtime.sendMessage({function: 'offline'});
});
