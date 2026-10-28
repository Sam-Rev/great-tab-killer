'use strict';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'tgs-download') return false;

  try {
    const blob = new Blob([message.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = message.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
  return true;
});
