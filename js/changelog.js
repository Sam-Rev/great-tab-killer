import {gsUtils} from "./helpers/gsUtils.js";

gsUtils.documentReadyAndLocalisedAsPromsied(document).then(function() {
  if (chrome.extension.inIncognitoContext) {
    Array.prototype.forEach.call(
      document.getElementsByClassName('noIncognito'),
      function(el) { el.style.display = 'none'; }
    );
  }
  document.getElementById('currentVersion').textContent =
    chrome.runtime.getManifest().version;
});
