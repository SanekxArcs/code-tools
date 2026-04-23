// ACE bridge (isolated world). Storage keys: ace_enabled, ace_wrap, ace_autoExpand, ace_selectors, ace_blacklist, position, opacity, size.
(() => {
  const DEFAULTS = {
    ace_enabled:       true,
    ace_wrap:          true,
    ace_autoExpand:    false,
    ace_selectors: [
      '#custom-js-initialize',
      '#js-get-item-ids',
      '#js-global-init-css-editor',
      '#js-get-blacklisted-item-ids',
      '#js-global-init-js-editor',
      '#js-recommendation-context',
      '#js-settings-override',
      '#js-translations',
      '#js-custom-css',
      '#js-on-done',
      '#custom-template-1',
      '#custom-template-2',
    ],
    ace_blacklist: [],
    position: 'top-right',
    opacity:  70,
    size:     26,
  };

  function syncSettings(raw) {
    let el = document.getElementById('__acefmt');
    if (!el) {
      el = document.createElement('div');
      el.id = '__acefmt';
      el.style.display = 'none';
      document.documentElement.appendChild(el);
    }
    // Pass settings to main world with internal (un-prefixed) keys
    el.dataset.v = JSON.stringify({
      enabled:       raw.ace_enabled,
      wrap:          raw.ace_wrap,
      autoExpand:    raw.ace_autoExpand,
      selectors:   raw.ace_selectors,
      blacklist:   raw.ace_blacklist,
      position:    raw.position,
      opacity:     raw.opacity,
      size:        raw.size,
    });
    el.dataset.extUrl = chrome.runtime.getURL('');
    document.dispatchEvent(new CustomEvent('__acefmt:update'));
  }

  chrome.storage.sync.get(DEFAULTS, syncSettings);

  chrome.storage.onChanged.addListener((_, area) => {
    if (area === 'sync') chrome.storage.sync.get(DEFAULTS, syncSettings);
  });
})();
