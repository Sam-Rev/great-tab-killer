export function excludeIncognitoTabs(tabs) {
  return tabs.filter(isRegularTab);
}

export function isRegularTab(tab) {
  return !!tab && tab.incognito !== true;
}
