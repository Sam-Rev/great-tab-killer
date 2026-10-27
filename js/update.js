/*global chrome, historyUtils, gsSession, gsIndexedDb, gsUtils */

import {historyUtils} from "./historyUtils.js";
import {gsSession} from "./helpers/gsSession.js";
import {gsIndexedDb} from "./helpers/gsIndexedDb.js";
import {gsUtils} from "./helpers/gsUtils.js";

(function (global) {
  "use strict";

  function setRestartExtensionClickHandler() {
    document.getElementById("restartExtensionBtn").onclick = async function (
      e
    ) {
      const currentSession = await gsSession.buildCurrentSession();
      if (currentSession) {
        var currentVersion = chrome.runtime.getManifest().version;
        await gsIndexedDb.createOrUpdateSessionRestorePoint(
          currentSession,
          currentVersion
        );
      }
      chrome.runtime.reload();
    };
  }

  function setExportBackupClickHandler() {
    document.getElementById("exportBackupBtn").onclick = async function (e) {
      const currentSession = await gsSession.buildCurrentSession();
      historyUtils.exportSession(currentSession, function () {
        document.getElementById("exportBackupBtn").style.display = "none";
        setRestartExtensionClickHandler();
      });
    };
  }

  function setSessionManagerClickHandler() {
    document.getElementById("sessionManagerLink").onclick = function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("html/history.html") });
      setRestartExtensionClickHandler();
    };
  }

  gsUtils.documentReadyAndLocalisedAsPromsied(document).then(function () {
    setSessionManagerClickHandler();
    setRestartExtensionClickHandler();
    setExportBackupClickHandler();

    var currentVersion = chrome.runtime.getManifest().version;
    gsIndexedDb
      .fetchSessionRestorePoint(currentVersion)
      .then(function (sessionRestorePoint) {
        if (!sessionRestorePoint) {
          gsUtils.warning(
            "update",
            "Couldnt find session restore point. Something has gone horribly wrong!!"
          );
          document.getElementById("noBackupInfo").style.display = "block";
          document.getElementById("backupInfo").style.display = "none";
          document.getElementById("exportBackupBtn").style.display = "none";
        }
      });
  });
})(this);
