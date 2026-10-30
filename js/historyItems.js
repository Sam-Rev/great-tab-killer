/*global chrome, gsSession, gsUtils, gsFavicon */
// eslint-disable-next-line no-unused-vars

import {gsSession} from "./helpers/gsSession.js";
import {gsUtils} from "./helpers/gsUtils.js";
import {gsFavicon} from "./helpers/gsFavicon.js";
import {isAllowedNavigationUrl} from "./helpers/safeNavigationUrl.js";

export var historyItems = (function(global) {
  'use strict';

  function createSessionHtml(session, showLinks) {
    session.windows = session.windows || [];

    var sessionType =
        session.sessionId === gsSession.getSessionId()
          ? 'current'
          : session.name
            ? 'saved'
            : 'recent',
      sessionContainer,
      sessionTitle,
      sessionSave,
      sessionDelete,
      sessionExport,
      sessionDiv,
      sessionIcon,
      windowResuspend,
      windowReload,
      titleText,
      winCnt = session.windows.length,
      tabCnt = session.windows.reduce(function(a, b) {
        return a + b.tabs.length;
      }, 0);

    if (sessionType === 'saved') {
      titleText = session.name;
    } else {
      titleText = gsUtils.getHumanDate(session.date);
    }
    const countText =
      '(' + winCnt + pluralise(
        ' ' + gsUtils.getMessage('js_history_window').toLowerCase(),
        winCnt
      ) +
      ', ' +
      tabCnt +
      pluralise(
        ' ' + gsUtils.getMessage('js_history_tab').toLowerCase(),
        tabCnt
      ) +
      ')';

    sessionIcon = createEl('i', {
      class: 'sessionIcon icon icon-plus-squared-alt',
      role: 'button',
      tabindex: '0',
      'aria-expanded': 'false',
      'aria-label': 'Toggle session: ' + titleText,
      title: 'Toggle session: ' + titleText,
    });

    sessionDiv = createEl('div', {
      class: 'sessionContents',
    });

    sessionTitle = createEl('span', {
      class: 'sessionLink',
    });
    sessionTitle.appendChild(document.createTextNode(titleText + '\u00A0\u00A0'));
    const counts = document.createElement('small');
    counts.textContent = countText;
    sessionTitle.appendChild(counts);

    sessionSave = createEl(
      'a',
      {
        class: 'groupLink saveLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_save')
    );

    sessionDelete = createEl(
      'a',
      {
        class: 'groupLink deleteLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_delete')
    );

    windowResuspend = createEl(
      'a',
      {
        class: 'groupLink resuspendLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_resuspend')
    );

    windowReload = createEl(
      'a',
      {
        class: 'groupLink reloadLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_reload')
    );

    sessionExport = createEl(
      'a',
      {
        class: 'groupLink exportLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_export')
    );

    sessionContainer = createEl('div', {
      class: 'sessionContainer',
    });
    sessionContainer.appendChild(sessionIcon);
    sessionContainer.appendChild(sessionTitle);
    if (showLinks && sessionType !== 'current') {
      sessionContainer.appendChild(windowResuspend);
      sessionContainer.appendChild(windowReload);
    }
    if (showLinks) {
      sessionContainer.appendChild(sessionExport);
    }
    if (showLinks && sessionType !== 'saved') {
      sessionContainer.appendChild(sessionSave);
    }
    if (showLinks && sessionType !== 'current') {
      sessionContainer.appendChild(sessionDelete);
    }

    sessionContainer.appendChild(sessionDiv);

    return sessionContainer;
  }

  function createWindowHtml(window, index, showLinks) {
    var groupHeading, windowContainer, groupUnsuspendCurrent, groupUnsuspendNew;

    groupHeading = createEl('div', {
      class: 'windowContainer',
    });

    var windowString = gsUtils.getMessage('js_history_window');
    windowContainer = createEl(
      'span',
      {},
      windowString + ' ' + (index + 1) + ':\u00A0'
    );

    groupUnsuspendCurrent = createEl(
      'a',
      {
        class: 'groupLink resuspendLink ',
        href: '#',
      },
      gsUtils.getMessage('js_history_resuspend')
    );

    groupUnsuspendNew = createEl(
      'a',
      {
        class: 'groupLink reloadLink',
        href: '#',
      },
      gsUtils.getMessage('js_history_reload')
    );

    groupHeading.appendChild(windowContainer);
    if (showLinks) {
      groupHeading.appendChild(groupUnsuspendCurrent);
      groupHeading.appendChild(groupUnsuspendNew);
    }

    return groupHeading;
  }

  async function createTabHtml(tab, showLinks) {
    var linksSpan, listImg, listLink, listHover;
    const safeUrl = isAllowedNavigationUrl(tab.url) ? tab.url : '';

    if (tab.sessionId) {
      linksSpan = createEl('div', {
        class: 'tabContainer',
        'data-tabId': tab.id || safeUrl || '',
        'data-url': safeUrl,
      });
    } else {
      linksSpan = createEl('div', {
        class: 'tabContainer',
        'data-url': safeUrl,
      });
    }

    listHover = createEl(
      'span',
      {
        class: 'itemHover removeLink',
      },
      '\u2716'
    );

    const faviconMeta = await gsFavicon.getFaviconMetaData(tab);
    const favIconUrl = faviconMeta.normalisedDataUrl;
    listImg = createEl('img', {
      src: favIconUrl,
      height: '16px',
      width: '16px',
    });

    const linkTitle = tab.title && tab.title.length > 1 ? tab.title : tab.url;
    listLink = safeUrl
      ? createEl('a', {class: 'historyLink', href: safeUrl, target: '_blank'}, linkTitle)
      : createEl('span', {class: 'historyLink'}, linkTitle || '');

    if (showLinks) {
      linksSpan.appendChild(listHover);
    }
    linksSpan.appendChild(listImg);
    linksSpan.appendChild(listLink);
    linksSpan.appendChild(createEl('br'));

    return linksSpan;
  }

  function createEl(elType, attributes, text) {
    var el = document.createElement(elType);
    attributes = attributes || {};
    el = setElAttributes(el, attributes);
    el.textContent = text || '';
    return el;
  }
  function setElAttributes(el, attributes) {
    for (var key in attributes) {
      if (attributes.hasOwnProperty(key)) {
        el.setAttribute(key, attributes[key]);
      }
    }
    return el;
  }

  function pluralise(text, count) {
    return (
      text + (count > 1 ? gsUtils.getMessage('js_history_plural') : '')
    );
  }

  return {
    createSessionHtml: createSessionHtml,
    createWindowHtml: createWindowHtml,
    createTabHtml: createTabHtml,
  };
})(this);
