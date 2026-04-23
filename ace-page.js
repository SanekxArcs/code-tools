// Main world: combined copy + format + wrap toolbar on ACE editors.
(() => {
  'use strict';

  const HOVER_HIDE_DELAY = 150;

  const SVG_COPY     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const SVG_CHECK    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="m12 15 2 2 4-4"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  const SVG_FORMAT   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h7"/><path d="M8 12h6"/><path d="M11 16h5"/></svg>`;
  const SVG_WRAP     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="m16 16-3 3 3 3"/><path d="M3 12h14.5a1 1 0 0 1 0 7H13"/><path d="M3 19h6"/><path d="M3 5h18"/></svg>`;
  // Expand to fit content height
  const SVG_EXPAND   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="M19 3H5"/><path d="M12 21V7"/><path d="m6 15 6 6 6-6"/></svg>`;
  // Collapse back to default height
  const SVG_COLLAPSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="M5 21h14"/><path d="M12 3v14"/><path d="m18 9-6-6-6 6"/></svg>`;

  let settings = null;
  let beautify  = null;
  let beautifyLoading = false;
  const editorMap = new Map();

  // ── Settings ──────────────────────────────────────────────────────────────

  function readSettings() {
    const el = document.getElementById('__acefmt');
    return el ? JSON.parse(el.dataset.v) : null;
  }

  function isActive(s) {
    s = s || settings;
    return !!(s && s.enabled && !(s.blacklist || []).includes(location.hostname));
  }

  // ── Beautify ──────────────────────────────────────────────────────────────

  function loadBeautify(cb) {
    if (beautify) { cb(beautify); return; }
    if (beautifyLoading) {
      document.addEventListener('__acefmt:beautifyReady', () => cb(beautify), { once: true });
      return;
    }
    beautifyLoading = true;
    const el = document.getElementById('__acefmt');
    const extUrl = el ? el.dataset.extUrl : null;
    if (!extUrl) { cb(null); return; }
    const script = document.createElement('script');
    script.src = extUrl + 'ace-ext-beautify.js';
    script.onload = () => {
      try { beautify = window.ace && ace.require('ace/ext/beautify'); } catch (_) {}
      document.dispatchEvent(new CustomEvent('__acefmt:beautifyReady'));
      cb(beautify);
    };
    script.onerror = () => cb(null);
    (document.head || document.documentElement).appendChild(script);
  }

  // ── ACE helpers ───────────────────────────────────────────────────────────

  function getAceEditor(el) {
    if (!window.ace || typeof ace.edit !== 'function') return null;
    if (!el.classList.contains('ace_editor')) return null;
    try {
      const editor = ace.edit(el);
      return (editor && editor.session) ? editor : null;
    } catch (_) { return null; }
  }

  // ── Button helpers ────────────────────────────────────────────────────────

  function applyBtnStyle(btn) {
    if (!settings) return;
    const s   = settings.size;
    const pad = Math.max(3, Math.round(s / 6));
    Object.assign(btn.style, {
      width:      s + 'px',
      height:     s + 'px',
      padding:    pad + 'px',
      background: `rgba(0,0,0,${(settings.opacity / 100).toFixed(2)})`,
    });
    const svg = btn.querySelector('svg');
    if (svg) {
      const iconSz = (s - pad * 2) + 'px';
      svg.style.width  = iconSz;
      svg.style.height = iconSz;
    }
  }

  function makeBtn(svgContent) {
    const btn = document.createElement('button');
    btn.innerHTML = svgContent;
    Object.assign(btn.style, {
      all:            'unset',
      boxSizing:      'border-box',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      borderRadius:   '4px',
      cursor:         'pointer',
      color:          'rgba(255,255,255,0.85)',
      border:         '1px solid rgba(255,255,255,0.15)',
      boxShadow:      '0 2px 6px rgba(0,0,0,0.55)',
      transition:     'background 0.1s, color 0.1s, border-color 0.1s',
      flexShrink:     '0',
    });
    return btn;
  }

  function setWrapStyle(btn, active) {
    btn.style.color       = active ? '#60a5fa' : 'rgba(255,255,255,0.7)';
    btn.style.borderColor = active ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.15)';
  }

  function setExpandStyle(btn, expanded) {
    btn.style.color       = expanded ? '#a78bfa' : 'rgba(255,255,255,0.7)';
    btn.style.borderColor = expanded ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.15)';
  }

  // ── Toolbar positioning ───────────────────────────────────────────────────

  function positionToolbar(toolbar, el) {
    if (!settings) return;
    const rect  = el.getBoundingClientRect();
    const s     = settings.size;
    const n     = toolbar.childElementCount;
    const tw    = s * n + 3 * (n - 1); // n buttons + (n-1) gaps of 3px
    const off   = 4;
    let top, left;

    switch (settings.position) {
      case 'top-left':      top = rect.top    + off;                    left = rect.left  + off;           break;
      case 'top-center':    top = rect.top    + off;                    left = rect.left  + (rect.width  - tw) / 2; break;
      case 'top-right':     top = rect.top    + off;                    left = rect.right - tw - off;      break;
      case 'left-center':   top = rect.top    + (rect.height - s) / 2; left = rect.left  + off;           break;
      case 'right-center':  top = rect.top    + (rect.height - s) / 2; left = rect.right - tw - off;      break;
      case 'bottom-left':   top = rect.bottom - s - off;               left = rect.left  + off;           break;
      case 'bottom-center': top = rect.bottom - s - off;               left = rect.left  + (rect.width  - tw) / 2; break;
      case 'bottom-right':  top = rect.bottom - s - off;               left = rect.right - tw - off;      break;
      default:              top = rect.top    + off;                    left = rect.right - tw - off;
    }

    toolbar.style.top  = top  + 'px';
    toolbar.style.left = left + 'px';
  }

  // ── Per-editor initialization ─────────────────────────────────────────────

  function initEditor(el) {
    if (el.dataset.acefmtInit) return;
    const editor = getAceEditor(el);
    if (!editor) return;

    el.dataset.acefmtInit = '1';

    const wrapDefault = settings ? settings.wrap : true;
    editor.setOption('wrap', wrapDefault);
    editor.setOption('wrapBehavioursEnabled', true);

    // Toolbar contains: [copy] [format] [wrap]
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      position:      'fixed',
      zIndex:        '2147483647',
      display:       'flex',
      gap:           '3px',
      opacity:       '0',
      pointerEvents: 'none',
      transition:    'opacity 0.15s',
    });

    // ── Copy button ──
    const copyBtn = makeBtn(SVG_COPY);
    copyBtn.title = 'Copy';
    let copyResetTimer = null;

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = editor.getValue();
      const showCheck = () => {
        copyBtn.innerHTML = SVG_CHECK;
        applyBtnStyle(copyBtn); // re-apply size/padding after innerHTML change
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
          copyBtn.innerHTML = SVG_COPY;
          applyBtnStyle(copyBtn);
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCheck).catch(() => legacyCopy(text, showCheck));
      } else {
        legacyCopy(text, showCheck);
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

    // ── Format button ──
    const fmtBtn = makeBtn(SVG_FORMAT);
    fmtBtn.title = 'Format code (Ctrl+Shift+F)';

    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadBeautify((b) => { if (b) b.beautify(editor.session); });
    });

    // ── Wrap button ──
    const wrapBtn = makeBtn(SVG_WRAP);
    wrapBtn.title = 'Toggle word wrap';
    setWrapStyle(wrapBtn, wrapDefault);

    wrapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.wrapActive = !state.wrapActive;
      editor.setOption('wrap', state.wrapActive);
      setWrapStyle(wrapBtn, state.wrapActive);
    });

    // ── Expand button ──
    const expandBtn = makeBtn(SVG_EXPAND);
    expandBtn.title = 'Expand to fit content / restore height';

    // Capture page-original height before we change anything
    const savedInlineHeight   = el.style.height;
    const savedComputedHeight = window.getComputedStyle(el).height;
    const savedMaxLines       = editor.getOption('maxLines');
    const restoreHeight       = savedInlineHeight || savedComputedHeight;

    function applyExpand(active) {
      if (active) {
        el.style.height = '';
        editor.setOption('maxLines', Infinity);
        editor.resize();
        expandBtn.innerHTML = SVG_COLLAPSE;
      } else {
        editor.setOption('maxLines', savedMaxLines || null);
        el.style.height = restoreHeight;
        editor.resize();
        expandBtn.innerHTML = SVG_EXPAND;
      }
      applyBtnStyle(expandBtn);
      setExpandStyle(expandBtn, active);
    }

    // Apply initial expand state from setting
    const expandDefault = !!(settings && settings.autoExpand);
    applyExpand(expandDefault);

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.expandActive = !state.expandActive;
      applyExpand(state.expandActive);
    });

    editor.commands.addCommand({
      name: 'acefmt-beautify',
      bindKey: { win: 'Ctrl-Shift-F', mac: 'Cmd-Shift-F' },
      exec: () => loadBeautify((b) => { if (b) b.beautify(editor.session); }),
    });

    // Order: copy | format | wrap | expand
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(fmtBtn);
    toolbar.appendChild(wrapBtn);
    toolbar.appendChild(expandBtn);
    document.body.appendChild(toolbar);

    applyBtnStyle(copyBtn);
    applyBtnStyle(fmtBtn);
    applyBtnStyle(wrapBtn);
    applyBtnStyle(expandBtn);

    const state = {
      toolbar, copyBtn, fmtBtn, wrapBtn, expandBtn,
      wrapActive: wrapDefault,
      expandActive: expandDefault,
      hideTimer: null, isOverEl: false, isOverToolbar: false, resizeObs: null,
    };
    editorMap.set(el, state);

    // ── Hover wiring ──
    function showToolbar() {
      if (!isActive()) return;
      clearTimeout(state.hideTimer);
      if (!toolbar.parentElement) document.body.appendChild(toolbar);
      toolbar.style.pointerEvents = 'auto';
      toolbar.style.opacity       = '1';
      positionToolbar(toolbar, el);
      if (!state.resizeObs) {
        state.resizeObs = new ResizeObserver(() => positionToolbar(toolbar, el));
        state.resizeObs.observe(el);
      }
    }

    function scheduleHide() {
      clearTimeout(state.hideTimer);
      state.hideTimer = setTimeout(() => {
        if (!state.isOverEl && !state.isOverToolbar) {
          toolbar.style.opacity       = '0';
          toolbar.style.pointerEvents = 'none';
        }
      }, HOVER_HIDE_DELAY);
    }

    el.addEventListener('mouseenter',      () => { state.isOverEl      = true;  clearTimeout(state.hideTimer); showToolbar(); });
    el.addEventListener('mouseleave',      () => { state.isOverEl      = false; scheduleHide(); });
    toolbar.addEventListener('mouseenter', () => { state.isOverToolbar = true;  clearTimeout(state.hideTimer); });
    toolbar.addEventListener('mouseleave', () => { state.isOverToolbar = false; scheduleHide(); });
  }

  // ── Scan & observe ────────────────────────────────────────────────────────

  function buildSelector() {
    return ((settings && settings.selectors) || []).filter(Boolean).join(',');
  }

  function scanPage() {
    if (!isActive()) return;
    const sel = buildSelector();
    if (!sel) return;
    try { document.querySelectorAll(sel).forEach(initEditor); } catch (_) {}
  }

  function applyUpdatedSettings() {
    const s = readSettings();
    if (!s) return;
    settings = s;
    const nowActive = isActive();

    editorMap.forEach((state, el) => {
      if (!nowActive) {
        state.toolbar.style.opacity       = '0';
        state.toolbar.style.pointerEvents = 'none';
        if (state.toolbar.parentElement) state.toolbar.parentElement.removeChild(state.toolbar);
        if (state.resizeObs) { state.resizeObs.disconnect(); state.resizeObs = null; }
      } else {
        applyBtnStyle(state.copyBtn);
        applyBtnStyle(state.fmtBtn);
        applyBtnStyle(state.wrapBtn);
        applyBtnStyle(state.expandBtn);
        setWrapStyle(state.wrapBtn, state.wrapActive);
        setExpandStyle(state.expandBtn, state.expandActive);
        if (parseFloat(state.toolbar.style.opacity) > 0) positionToolbar(state.toolbar, el);
      }
    });

    if (nowActive) scanPage();
  }

  function init() {
    if (settings) return;
    settings = readSettings();
    if (!settings || !isActive()) return;

    scanPage();

    new MutationObserver((mutations) => {
      if (!isActive()) return;
      const sel = buildSelector();
      if (!sel) return;
      for (const mut of mutations) {
        if (mut.type === 'attributes') {
          const el = mut.target;
          try { if (el.matches && el.matches(sel)) initEditor(el); } catch (_) {}
        }
        if (mut.type === 'childList') {
          for (const node of mut.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            try {
              if (node.matches && node.matches(sel)) initEditor(node);
              if (node.querySelectorAll) node.querySelectorAll(sel).forEach(initEditor);
            } catch (_) {}
          }
        }
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class'],
    });

    window.addEventListener('scroll', () => {
      editorMap.forEach((state, el) => {
        if (parseFloat(state.toolbar.style.opacity) > 0) positionToolbar(state.toolbar, el);
      });
    }, true);

    window.addEventListener('resize', () => {
      editorMap.forEach((state, el) => {
        if (parseFloat(state.toolbar.style.opacity) > 0) positionToolbar(state.toolbar, el);
      });
    });
  }

  document.addEventListener('__acefmt:update', () => {
    if (!settings) init(); else applyUpdatedSettings();
  });

  init();
  setTimeout(() => { if (!settings) init(); else scanPage(); }, 800);
  setTimeout(scanPage, 2500);
})();
