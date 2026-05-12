// Copy-button content script. Storage keys: copy_enabled, copy_blacklist, position, opacity, size.
(() => {
  const HOVER_HIDE_DELAY = 150;
  const DEFAULTS = { copy_enabled: true, copy_blacklist: [], position: 'top-right', opacity: 70, size: 26 };

  // .ace_editor is excluded — those get a combined copy+format+wrap toolbar from ace-page.js
  const SELECTORS = [
    'textarea:not(.ace_text-input)',
    'input[type="text"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="email"]',
    'input[type="number"]',
    'input:not([type])',
    '.CodeMirror',
    '.cm-content',
    '[contenteditable="true"]:not([class*="ace_"])',
  ].join(',');

  const SVG_COPY  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="m12 15 2 2 4-4"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

  let active   = true;
  let settings = { position: 'top-right', opacity: 70, size: 26 };

  function isBlocked(bl) { return (bl || []).includes(location.hostname); }

  function refreshActive(raw) {
    active = !!raw.copy_enabled && !isBlocked(raw.copy_blacklist);
    if (!active && btn.parentElement) {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
      btn.parentElement.removeChild(btn);
      currentField = null;
    }
  }

  chrome.storage.sync.get(DEFAULTS, (raw) => {
    settings.position = raw.position;
    settings.opacity  = raw.opacity;
    settings.size     = raw.size;
    refreshActive(raw);
    applyBtnStyle();
  });

  chrome.storage.onChanged.addListener((_, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULTS, (raw) => {
      settings.position = raw.position;
      settings.opacity  = raw.opacity;
      settings.size     = raw.size;
      refreshActive(raw);
      applyBtnStyle();
    });
  });

  // ── Value extraction ──────────────────────────────────────────────────────

  function getAceInstance(el) {
    if (!el.classList.contains('ace_editor')) return null;
    try { return (window.ace && window.ace.edit(el)) || null; } catch (_) { return null; }
  }

  function getValue(el) {
    const ace = getAceInstance(el);
    if (ace) return ace.getValue();
    if (el.classList.contains('ace_editor')) {
      const lines = el.querySelectorAll('.ace_line');
      if (lines.length) return Array.from(lines).map(l => l.textContent).join('\n');
    }
    const cm5 = el.classList.contains('CodeMirror') && el.CodeMirror ? el.CodeMirror : null;
    if (cm5) return cm5.getValue();
    if ('value' in el) return el.value;
    return el.innerText || el.textContent || '';
  }

  // ── Button ────────────────────────────────────────────────────────────────

  const btn = document.createElement('button');
  btn.innerHTML = SVG_COPY;
  Object.assign(btn.style, {
    all: 'unset', position: 'fixed', zIndex: '2147483646',
    boxSizing: 'border-box', border: 'none', borderRadius: '5px',
    cursor: 'pointer', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: '0', pointerEvents: 'none', transition: 'opacity 0.15s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.55)', lineHeight: '1',
  });

  function applyBtnStyle() {
    const pad = Math.max(3, Math.round(settings.size / 6));
    btn.style.width      = settings.size + 'px';
    btn.style.height     = settings.size + 'px';
    btn.style.padding    = pad + 'px';
    btn.style.background = `rgba(0,0,0,${(settings.opacity / 100).toFixed(2)})`;
  }
  applyBtnStyle();

  let currentField = null, hideTimer = null, isOverField = false, isOverBtn = false;
  let resizeObs = null, copyResetTimer = null;

  function positionBtn() {
    if (!currentField) return;
    const rect = currentField.getBoundingClientRect();
    const s = settings.size, off = 4;
    const vh = window.innerHeight;
    let top, left;

    // Clamp vertical position if textarea is taller than viewport
    let effectiveTop = rect.top;
    let effectiveBottom = rect.bottom;

    if (rect.height > vh) {
      effectiveTop = Math.max(rect.top, 0);
      effectiveBottom = Math.min(rect.bottom, vh);
      // Ensure there's enough space for the button
      if (effectiveBottom - effectiveTop < s + off * 2) {
        if (rect.top > 0) effectiveTop = rect.top;
        else if (rect.bottom < vh) effectiveTop = rect.bottom - s - off * 2;
      }
    }

    switch (settings.position) {
      case 'top-left':      top = effectiveTop    + off; left = rect.left  + off; break;
      case 'top-center':    top = effectiveTop    + off; left = rect.left  + (rect.width  - s) / 2; break;
      case 'top-right':     top = effectiveTop    + off; left = rect.right - s - off; break;
      case 'left-center':   top = (effectiveTop + effectiveBottom - s) / 2; left = rect.left  + off; break;
      case 'right-center':  top = (effectiveTop + effectiveBottom - s) / 2; left = rect.right - s - off; break;
      case 'bottom-left':   top = effectiveBottom - s - off; left = rect.left  + off; break;
      case 'bottom-center': top = effectiveBottom - s - off; left = rect.left  + (rect.width  - s) / 2; break;
      case 'bottom-right':  top = effectiveBottom - s - off; left = rect.right - s - off; break;
      default:              top = effectiveTop    + off; left = rect.right - s - off;
    }
    btn.style.top = top + 'px'; btn.style.left = left + 'px';
  }

  function showBtn(el) {
    if (!active) return;
    currentField = el;
    if (!btn.parentElement) document.body.appendChild(btn);
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
    positionBtn();
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(positionBtn);
    resizeObs.observe(el);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isOverField && !isOverBtn) {
        btn.style.opacity = '0'; btn.style.pointerEvents = 'none';
        if (btn.parentElement) btn.parentElement.removeChild(btn);
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        currentField = null;
      }
    }, HOVER_HIDE_DELAY);
  }

  btn.addEventListener('mouseenter', () => { isOverBtn = true;  clearTimeout(hideTimer); });
  btn.addEventListener('mouseleave', () => { isOverBtn = false; scheduleHide(); });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentField) return;
    const text = getValue(currentField);
    const done = () => {
      btn.innerHTML = SVG_CHECK;
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => { btn.innerHTML = SVG_COPY; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
    } else {
      legacyCopy(text, done);
    }
  });

  function legacyCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); cb(); } catch (_) {}
    document.body.removeChild(ta);
  }

  window.addEventListener('scroll', positionBtn, true);
  window.addEventListener('resize', positionBtn);

  function initField(el) {
    if (el.dataset.copyInit) return;
    if (!el.classList.contains('ace_editor') && el.closest('.ace_editor')) return;
    el.dataset.copyInit = 'true';
    el.addEventListener('mouseenter', () => { isOverField = true;  clearTimeout(hideTimer); showBtn(el); });
    el.addEventListener('mouseleave', () => { isOverField = false; scheduleHide(); });
  }

  document.querySelectorAll(SELECTORS).forEach(initField);
  new MutationObserver((mutations) => {
    for (const mut of mutations)
      for (const node of mut.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches && node.matches(SELECTORS)) initField(node);
        if (node.querySelectorAll) node.querySelectorAll(SELECTORS).forEach(initField);
      }
  }).observe(document.body, { childList: true, subtree: true });
})();
