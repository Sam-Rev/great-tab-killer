/*global chrome, gsUtils, gsStorage */
'use strict';

import {gsUtils} from "./gsUtils.js"
import {gsStorage} from "./gsStorage.js"

const ALARM_NAME = 'tgs-session-backup';

export var gsBackup = {

  performBackup: async function(label) {
    try {
      const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));

      // Group tabs by window
      const windowMap = new Map();
      tabs.forEach(tab => {
        if (!windowMap.has(tab.windowId)) windowMap.set(tab.windowId, []);
        const url = gsUtils.isSuspendedUrl(tab.url)
          ? gsUtils.getOriginalUrl(tab.url)
          : tab.url;
        windowMap.get(tab.windowId).push(url);
      });

      // Build text content
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const dateTag = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

      let lines = [
        'The Great Tab Killer — Session Backup',
        dateStr,
        label ? `(${label})` : '',
        'You can disable auto-backup or change its frequency in the extension settings.',
        '='.repeat(50),
        '',
      ].filter(l => l !== '');

      let winIdx = 1;
      for (const [, urls] of windowMap) {
        lines.push(`Window ${winIdx} (${urls.length} tab${urls.length !== 1 ? 's' : ''})`);
        urls.forEach(u => lines.push(u));
        lines.push('');
        winIdx++;
      }

      const content = lines.join('\n');
      const timeTag = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const suffix = label ? ` (${label})` : '';
      const filename = `Auto-backup The Great Tab Killer ${dateTag} ${timeTag}${suffix}.txt`;

      // Use offscreen document for <a download> trick (no `downloads` permission needed)
      console.log('[gsBackup] Step 0: chrome.offscreen exists?', !!chrome.offscreen);
      console.log('[gsBackup] Step 1: checking offscreen document...');
      const offscreenUrl = chrome.runtime.getURL('html/offscreen.html');
      console.log('[gsBackup] offscreen URL:', offscreenUrl);
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
      });
      const hasDoc = contexts.some((context) => context.documentUrl === offscreenUrl);
      console.log('[gsBackup] Step 2: hasDocument =', hasDoc);
      if (!hasDoc) {
        await chrome.offscreen.createDocument({
          url: offscreenUrl,
          reasons: [chrome.offscreen.Reason.BLOBS],
          justification: 'Save session backup file via anchor download',
        });
        console.log('[gsBackup] Step 2b: document created');
      }
      console.log('[gsBackup] Step 3: sending message...');
      const resp = await chrome.runtime.sendMessage({ action: 'tgs-download', content, filename });
      console.log('[gsBackup] Step 4: response:', resp);
      await chrome.offscreen.closeDocument();
      console.log('[gsBackup] Done:', filename);
    } catch (e) {
      console.error('[gsBackup] FAILED at:', e, 'message:', e?.message, 'name:', e?.name, 'stack:', e?.stack);
    }
  },

  setupAlarm: async function() {
    const freq = await gsStorage.getOption(gsStorage.BACKUP_FREQUENCY);
    const minutes = parseInt(freq, 10);

    // Check if alarm already exists with the correct period — don't reset it
    // on every service worker restart, or the countdown will never complete.
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (existing && minutes > 0 && existing.periodInMinutes === minutes) {
      gsUtils.log('gsBackup', 'Backup alarm already set, every', minutes, 'min — skipping');
      return;
    }

    await gsBackup.updateAlarm(freq);
  },

  updateAlarm: async function(frequencyMinutes) {
    await chrome.alarms.clear(ALARM_NAME);
    const minutes = parseInt(frequencyMinutes, 10);
    if (minutes > 0) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: minutes,
        periodInMinutes: minutes,
      });
      gsUtils.log('gsBackup', 'Backup alarm created, every', minutes, 'min');
    }
  },

  isBackupAlarm: function(alarm) {
    return alarm.name === ALARM_NAME;
  },
};
