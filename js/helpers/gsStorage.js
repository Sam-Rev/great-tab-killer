/*global chrome, gsSession, gsUtils */
'use strict';
import {gsUtils} from "./gsUtils.js"
import {gsSession} from "./gsSession.js"

export var gsStorage = {
  SCREEN_CAPTURE: 'screenCapture',
  SCREEN_CAPTURE_FORCE: 'screenCaptureForce',
  SUSPEND_IN_PLACE_OF_DISCARD: 'suspendInPlaceOfDiscard',
  UNSUSPEND_ON_FOCUS: 'gsUnsuspendOnFocus',
  SUSPEND_TIME: 'gsTimeToSuspend',
  IGNORE_WHEN_OFFLINE: 'onlineCheck',
  IGNORE_WHEN_CHARGING: 'batteryCheck',
  IGNORE_PINNED: 'gsDontSuspendPinned',
  IGNORE_FORMS: 'gsDontSuspendForms',
  IGNORE_AUDIO: 'gsDontSuspendAudio',
  IGNORE_ACTIVE_TABS: 'gsDontSuspendActiveTabs',
  IGNORE_CACHE: 'gsIgnoreCache',
  ADD_CONTEXT: 'gsAddContextMenu',
  SYNC_SETTINGS: 'gsSyncSettings',
  THEME: 'gsTheme',
  LANGUAGE: 'gsLanguage',
  BACKUP_FREQUENCY: 'gsBackupFrequency',
  WHITELIST: 'gsWhitelist',

  DISCARD_AFTER_SUSPEND: 'discardAfterSuspend',
  DISCARD_IN_PLACE_OF_SUSPEND: 'discardInPlaceOfSuspend',
  USE_ALT_SCREEN_CAPTURE_LIB: 'useAlternateScreenCaptureLib',

  APP_VERSION: 'gsVersion',
  STORAGE_SCHEMA_VERSION: 'schemaVersion',
  CURRENT_SCHEMA_VERSION: 1,
  LAST_EXTENSION_RECOVERY: 'gsExtensionRecovery',

  SM_SESSION_METRICS: 'gsSessionMetrics',
  SM_TIMESTAMP: 'sessionTimestamp',
  SM_SUSPENDED_TAB_COUNT: 'suspendedTabCount',
  SM_TOTAL_TAB_COUNT: 'totalTabCount',

  noop: function() {},

  initSchemaVersion: async function() {
    const key = gsStorage.STORAGE_SCHEMA_VERSION;
    const stored = await chrome.storage.local.get(key);
    const version = stored[key];
    if (version === undefined) {
      await chrome.storage.local.set({
        [key]: gsStorage.CURRENT_SCHEMA_VERSION,
      });
      return gsStorage.CURRENT_SCHEMA_VERSION;
    }
    if (
      !Number.isInteger(version) ||
      version < 1 ||
      version > gsStorage.CURRENT_SCHEMA_VERSION
    ) {
      throw new Error(`Unsupported storage schema version: ${version}`);
    }
    return version;
  },

  getSettingsDefaults: function() {
    const defaults = {};
    defaults[gsStorage.SCREEN_CAPTURE] = '0';
    defaults[gsStorage.SCREEN_CAPTURE_FORCE] = false;
    defaults[gsStorage.SUSPEND_IN_PLACE_OF_DISCARD] = false;
    defaults[gsStorage.DISCARD_IN_PLACE_OF_SUSPEND] = false;
    defaults[gsStorage.USE_ALT_SCREEN_CAPTURE_LIB] = false;
    defaults[gsStorage.DISCARD_AFTER_SUSPEND] = false;
    defaults[gsStorage.IGNORE_WHEN_OFFLINE] = false;
    defaults[gsStorage.IGNORE_WHEN_CHARGING] = false;
    defaults[gsStorage.UNSUSPEND_ON_FOCUS] = false;
    defaults[gsStorage.IGNORE_PINNED] = true;
    defaults[gsStorage.IGNORE_FORMS] = true;
    defaults[gsStorage.IGNORE_AUDIO] = true;
    defaults[gsStorage.IGNORE_ACTIVE_TABS] = true;
    defaults[gsStorage.IGNORE_CACHE] = false;
    defaults[gsStorage.ADD_CONTEXT] = true;
    defaults[gsStorage.SYNC_SETTINGS] = false;
    defaults[gsStorage.SUSPEND_TIME] = '60';
    defaults[gsStorage.WHITELIST] = '';
    defaults[gsStorage.THEME] = 'light';
    defaults[gsStorage.LANGUAGE] = 'auto';
    defaults[gsStorage.BACKUP_FREQUENCY] = '10080';

    return defaults;
  },

  /**
   * LOCAL STORAGE FUNCTIONS
   */

  // Initialize this project's schema before reading or writing its settings.
  initSettingsAsPromised: async function() {
    await gsStorage.initSchemaVersion();
    return new Promise(function(resolve) {
      var defaultSettings = gsStorage.getSettingsDefaults();
      var defaultKeys = Object.keys(defaultSettings);
      chrome.storage.local.get(['gsSettings'], function(localData) {
        let syncEnabledLocally = false;
        try {
          const localSettings = JSON.parse(localData['gsSettings'] || false) || {};
          syncEnabledLocally = localSettings[gsStorage.SYNC_SETTINGS] === true;
        } catch (e) {}
        const initialiseWithSyncSettings = function(syncedSettings) {
        syncedSettings = syncedSettings || {};
        gsUtils.log('gsStorage', 'syncedSettings on init: ', syncedSettings);
        gsSession.setSynchedSettingsOnInit(syncedSettings);

        var rawLocalSettings;
        try {
          rawLocalSettings = JSON.parse(localData['gsSettings'] || false);
        } catch (e) {
          gsUtils.error(
            'gsStorage',
            'Failed to parse gsSettings: ',
            localData['gsSettings']
          );
        }
        if (!rawLocalSettings) {
          rawLocalSettings = {};
        }
        gsUtils.log('gsStorage', 'localSettings on init: ', rawLocalSettings);
        var shouldSyncSettings = rawLocalSettings[gsStorage.SYNC_SETTINGS];

        var mergedSettings = {};
        for (const key of defaultKeys) {
          if (key === gsStorage.SYNC_SETTINGS) {
            if (chrome.extension.inIncognitoContext) {
              mergedSettings[key] = false;
            } else {
              mergedSettings[key] = rawLocalSettings.hasOwnProperty(key)
                ? rawLocalSettings[key]
                : defaultSettings[key];
            }
            continue;
          }
          // if synced setting exists and local setting does not exist or
          // syncing is enabled locally then overwrite with synced value
          if (
            syncedSettings.hasOwnProperty(key) &&
            shouldSyncSettings
          ) {
            mergedSettings[key] = syncedSettings[key];
          }
          //fallback on rawLocalSettings
          if (!mergedSettings.hasOwnProperty(key)) {
            mergedSettings[key] = rawLocalSettings[key];
          }
          //fallback on defaultSettings
          if (
            typeof mergedSettings[key] === 'undefined' ||
            mergedSettings[key] === null
          ) {
            gsUtils.errorIfInitialised(
              'gsStorage',
              'Missing key: ' + key + '! Will init with default.'
            );
            mergedSettings[key] = defaultSettings[key];
          }
        }
        gsStorage.saveSettings(mergedSettings);
        gsUtils.log('gsStorage', 'mergedSettings: ', mergedSettings);

        // if any of the new settings are different to those in sync, then trigger a resync
        var triggerResync = false;
        for (const key of defaultKeys) {
          if (
            key !== gsStorage.SYNC_SETTINGS &&
            syncedSettings[key] !== mergedSettings[key]
          ) {
            triggerResync = true;
          }
        }
        if (triggerResync) {
          gsStorage.syncSettings().then(() => {
            gsStorage.addSettingsSyncListener();
            gsUtils.log('gsStorage', 'init successful');
            resolve();
          });
        } else {
          gsStorage.addSettingsSyncListener();
          gsUtils.log('gsStorage', 'init successful');
          resolve();
        }
        };
        if (syncEnabledLocally) {
          chrome.storage.sync.get(defaultKeys, initialiseWithSyncSettings);
        } else {
          initialiseWithSyncSettings({});
        }
      });
    });
  },

  // Listen for changes to synced settings
  addSettingsSyncListener: function() {
    chrome.storage.onChanged.addListener(async function(remoteSettings, namespace) {
      if (namespace !== 'sync' || !remoteSettings) {
        return;
      }
      var shouldSync = await gsStorage.getOption(gsStorage.SYNC_SETTINGS);
      if (shouldSync) {
        var localSettings = await gsStorage.getSettings();
        var changedSettingKeys = [];
        var oldValueBySettingKey = {};
        var newValueBySettingKey = {};
        Object.keys(remoteSettings).forEach(function(key) {
          var remoteSetting = remoteSettings[key];

          if (localSettings[key] !== remoteSetting.newValue) {
            gsUtils.log(
              'gsStorage',
              'Changed value from sync',
              key,
              remoteSetting.newValue
            );
            changedSettingKeys.push(key);
            oldValueBySettingKey[key] = localSettings[key];
            newValueBySettingKey[key] = remoteSetting.newValue;
            localSettings[key] = remoteSetting.newValue;
          }
        });

        if (changedSettingKeys.length > 0) {
          gsStorage.saveSettings(localSettings);
          gsUtils.performPostSaveUpdates(
            changedSettingKeys,
            oldValueBySettingKey,
            newValueBySettingKey
          );
        }
      }
    });
  },

  //due to migration issues and new settings being added, i have built in some redundancy
  //here so that getOption will always return a valid value.
  getOption: async function(prop) {
    var settings = await gsStorage.getSettings();
    if (typeof settings[prop] === 'undefined' || settings[prop] === null) {
      settings[prop] = gsStorage.getSettingsDefaults()[prop];
      gsStorage.saveSettings(settings);
    }
    return settings[prop];
  },

  setOption: async function(prop, value) {
    var settings = await gsStorage.getSettings();
    settings[prop] = value;
    // gsUtils.log('gsStorage', 'gsStorage', 'setting prop: ' + prop + ' to value ' + value);
    gsStorage.saveSettings(settings);
  },

  // Important to note that setOption (and ultimately saveSettings) uses chrome.storage.local whereas
  // syncSettings saves to chrome.storage.
  // Calling syncSettings has the unfortunate side-effect of triggering the chrome.storage.onChanged
  // listener which re-saves the setting to chrome.storage.local a second time.
  setOptionAndSync: async function(prop, value) {
    await gsStorage.setOption(prop, value);
    gsStorage.syncSettings();
  },

  getSettings: async function() {
    var settings;
    try {
      settings = JSON.parse((await chrome.storage.local.get('gsSettings'))['gsSettings'])|| false;
    } catch (e) {
      chrome.storage.local.get('gsSettings', (d) => {
        gsUtils.error(
            'gsStorage',
            'Failed to parse gsSettings: ',
            settings
        );
      });
    }
    if (!settings) {
      settings = gsStorage.getSettingsDefaults();
      gsStorage.saveSettings(settings);
    }
    return settings;
  },

  saveSettings: function(settings) {
    try {
      chrome.storage.local.set({'gsSettings': JSON.stringify(settings)});
    } catch (e) {
      gsUtils.error(
        'gsStorage',
        'failed to save gsSettings to local storage',
        e
      );
    }
  },

  // Push settings to sync
  syncSettings: async function() {
    var settings = await gsStorage.getSettings();
    if (settings[gsStorage.SYNC_SETTINGS]) {
      // Since sync is a local setting, delete it to simplify things.
      delete settings[gsStorage.SYNC_SETTINGS];
      gsUtils.log(
        'gsStorage',
        'gsStorage',
        'Pushing local settings to sync',
        settings
      );
      chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
          gsUtils.error(
            'gsStorage',
            'failed to save to chrome.storage.sync: ',
            chrome.runtime.lastError
          );
        }
      });
    }
  },

  fetchLastVersion: function() {
    return new Promise(resolve => {
      chrome.storage.local.get(gsStorage.APP_VERSION, (d) => {
        try {
          var version = d[gsStorage.APP_VERSION];
          if (version) {
            version = JSON.parse(version);
          }
        } catch (e) {
          chrome.storage.local.get(gsStorage.APP_VERSION, (d) => {
            gsUtils.error(
                'gsStorage',
                'Failed to parse ' + gsStorage.APP_VERSION + ': ',
                d[gsStorage.APP_VERSION]
            );
          });
        }
        version = version || '0.0.0';
        resolve(version + '');
      });
    });
  },
  setLastVersion: function(newVersion) {
    try {
      var obj = {};
      obj[gsStorage.APP_VERSION] = JSON.stringify(newVersion);
      chrome.storage.local.set(obj);
    } catch (e) {
      gsUtils.error(
        'gsStorage',
        'failed to save ' + gsStorage.APP_VERSION + ' to local storage',
        e
      );
    }
  },

  fetchLastExtensionRecoveryTimestamp: async function() {
    try {
      const result = await chrome.storage.local.get([gsStorage.LAST_EXTENSION_RECOVERY]);
      const storedValue = result[gsStorage.LAST_EXTENSION_RECOVERY];
      if (storedValue === undefined || storedValue === null || storedValue === '') return undefined;
      try {
        const timestamp = JSON.parse(storedValue);
        return Number.isFinite(timestamp) ? timestamp : undefined;
      } catch (e) {
        gsUtils.warning('gsStorage', 'Ignoring invalid ' + gsStorage.LAST_EXTENSION_RECOVERY + ' state');
        return undefined;
      }
    } catch (e) {
      gsUtils.error('gsStorage', 'Failed to read ' + gsStorage.LAST_EXTENSION_RECOVERY);
      return undefined;
    }
  },
  setLastExtensionRecoveryTimestamp: function(extensionRecoveryTimestamp) {
    try {
      var obj = {};
      obj[gsStorage.LAST_EXTENSION_RECOVERY] = JSON.stringify(extensionRecoveryTimestamp);
      chrome.storage.local.set(obj);
    } catch (e) {
      gsUtils.error(
        'gsStorage',
        'failed to save ' +
          gsStorage.LAST_EXTENSION_RECOVERY +
          ' to local storage',
        e
      );
    }
  },

  fetchSessionMetrics: function() {
    return new Promise(resolve => {
      chrome.storage.local.get([gsStorage.SM_SESSION_METRICS]).then((result) => {
        var sessionMetrics = {};

        try {
          sessionMetrics = JSON.parse(
            result[gsStorage.SM_SESSION_METRICS]
          );
        } catch (e) {
          gsUtils.error(
            'gsStorage',
            'Failed to parse ' + gsStorage.SM_SESSION_METRICS + ': ',
            result[gsStorage.SM_SESSION_METRICS]
          );
        }

        resolve(sessionMetrics);
      });
    });
  },
  setSessionMetrics: function(sessionMetrics) {
    try {

      var obj = {};
      obj[gsStorage.SM_SESSION_METRICS] = JSON.stringify(sessionMetrics);
      chrome.storage.local.set(obj);

    } catch (e) {
      gsUtils.error(
        'gsStorage',
        'failed to save ' + gsStorage.SM_SESSION_METRICS + ' to local storage',
        e
      );
    }
  },
};
