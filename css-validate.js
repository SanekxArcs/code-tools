// CSS Validator content script for Code Tools extension.
// Storage key: css_validate_enabled (chrome.storage.sync)
// Scans for CodeMirror / ACE / textarea CSS editors and injects a Validate button.
// Uses toasts instead of alerts; highlights error lines and cycles through them.

(() => {
  const STORAGE_KEY = 'css_validate_enabled';
  const ERR_CLS     = 'ct-css-err-line';
  const STYLE_ID    = 'ct-css-validate-styles';
  const TOOLBAR_ATTR = 'data-ct-css-toolbar';
  const PROCESSED_ATTR = 'data-ct-css-validate';

  // ── State ────────────────────────────────────────────────────────────────────
  let enabled = true;
  let cssErrors = [];       // { line, col, message }[]
  let errCursor = 0;
  let activeEditorEl = null;
  let scanObserver = null;

  // ── Storage ──────────────────────────────────────────────────────────────────
  chrome.storage.sync.get({ [STORAGE_KEY]: true }, (data) => {
    enabled = !!data[STORAGE_KEY];
    if (enabled) activate();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !(STORAGE_KEY in changes)) return;
    enabled = !!changes[STORAGE_KEY].newValue;
    enabled ? activate() : deactivate();
  });

  // ── CSS parsing: two passes ───────────────────────────────────────────────────
  function parseCssErrors(css) {
    const errors = [];
    if (!css.trim()) return errors;
    const lines = css.split('\n');
    let depth = 0, inComment = false, inStr = null;
    const openBraceLines = [];

    // Pass 1 — structural balance
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      for (let j = 0; j < lines[i].length; j++) {
        const ch = lines[i][j], nxt = lines[i][j + 1] ?? '';
        if (inComment) { if (ch === '*' && nxt === '/') { inComment = false; j++; } continue; }
        if (inStr)     { if (ch === inStr && lines[i][j - 1] !== '\\') inStr = null; continue; }
        if (ch === '/' && nxt === '*') { inComment = true; j++; continue; }
        if (ch === '"' || ch === "'") { inStr = ch; continue; }
        if (ch === '{') { depth++; openBraceLines.push(lineNum); }
        else if (ch === '}') {
          if (depth <= 0) errors.push({ line: lineNum, col: j + 1, message: "Unexpected `}` — no matching `{`" });
          else { depth--; openBraceLines.pop(); }
        }
      }
    }
    if (inComment) errors.push({ line: lines.length, col: 1, message: "Unclosed comment `/* ... */`" });
    if (inStr)     errors.push({ line: lines.length, col: 1, message: `Unclosed string (${inStr}...${inStr})` });
    for (const l of [...openBraceLines]) errors.push({ line: l, col: 1, message: "Unclosed `{` — missing closing `}`" });

    if (errors.length > 0) return errors.sort((a, b) => a.line - b.line);

    // Pass 2 — browser CSS engine per top-level rule
    let i = 0, rDepth = 0, rStart = -1, rStartLine = 1, curLine = 1;
    let iC = false, iS = null;
    const topRules = [];

    while (i < css.length) {
      const c = css[i], n = css[i + 1] ?? '';
      if (c === '\n') { curLine++; i++; continue; }
      if (iC) { if (c === '*' && n === '/') { iC = false; i++; } i++; continue; }
      if (iS) { if (c === iS && css[i - 1] !== '\\') iS = null; i++; continue; }
      if (c === '/' && n === '*') { iC = true; i += 2; continue; }
      if (c === '"' || c === "'") { iS = c; i++; continue; }
      if (c === '{') {
        if (rDepth === 0) { rStart = i; rStartLine = curLine; }
        rDepth++;
      } else if (c === '}') {
        rDepth--;
        if (rDepth === 0 && rStart !== -1) {
          let sel = rStart - 1;
          while (sel > 0 && css[sel - 1] !== '\n' && css[sel - 1] !== '}') sel--;
          topRules.push({ text: css.slice(sel, i + 1).trim(), startLine: rStartLine });
          rStart = -1;
        }
      }
      i++;
    }

    for (const { text, startLine } of topRules) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.insertRule(text, 0);
      } catch (e) {
        const msg = String(e).replace(/^.*?(SyntaxError|Error):?\s*/i, '');
        errors.push({ line: startLine, col: 1, message: msg || String(e) });
      }
    }

    return errors.sort((a, b) => a.line - b.line);
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  function ensureToastStyles() {
    if (document.getElementById('ct-toast-kf')) return;
    const s = document.createElement('style');
    s.id = 'ct-toast-kf';
    s.textContent = `
      @keyframes ctIn  { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes ctOut { from{transform:translateY(0);opacity:1}    to{transform:translateY(10px);opacity:0} }
    `;
    document.head.appendChild(s);
  }

  function showToast(message, type = 'info', duration = 4000) {
    ensureToastStyles();
    document.getElementById('ct-css-toast')?.remove();
    const bg = { success: '#16a34a', error: '#dc2626', info: '#2563eb' }[type] || '#2563eb';
    const icon = { success: '✓', error: '✗', info: 'ℹ' }[type] || 'ℹ';
    const toast = document.createElement('div');
    toast.id = 'ct-css-toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483646',
      background: bg, color: '#fff', padding: '9px 14px', borderRadius: '7px',
      fontSize: '12px', fontWeight: '500',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex',
      alignItems: 'center', gap: '9px', maxWidth: '380px',
      animation: 'ctIn 0.2s ease-out',
    });
    const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    toast.innerHTML = `<span style="font-size:14px;line-height:1;flex-shrink:0">${icon}</span><span>${safe}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'ctOut 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 210);
    }, duration);
  }

  // ── Injected CSS styles ───────────────────────────────────────────────────────
  function ensureValidateStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .${ERR_CLS} {
        background: rgba(220,38,38,0.14) !important;
        outline: 2px solid rgba(220,38,38,0.6) !important;
        position: relative !important;
      }
      .ct-css-err-tip {
        position: absolute; left: 0; top: 100%; z-index: 99999; margin-top: 2px;
        background: #dc2626; color: #fff; font-size: 11px;
        font-family: 'Courier New', monospace; padding: 2px 8px;
        border-radius: 4px; white-space: nowrap; pointer-events: none;
        max-width: 360px; overflow: hidden; text-overflow: ellipsis; line-height: 1.6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      }
      .ct-css-err-line-gutter {
        display: inline-block; width: 14px; height: 14px; line-height: 14px;
        background: #dc2626; color: #fff; font-size: 9px; font-weight: 700;
        text-align: center; border-radius: 2px; margin-right: 4px; flex-shrink: 0;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Editor value extraction ───────────────────────────────────────────────────
  function getCm5(el) {
    return el.CodeMirror || null;
  }

  function getAceEditor(el) {
    // ACE stores editor on .ace_editor ancestor; code-tools uses window.ace.edit(id)
    const aceEl = el.classList?.contains('ace_editor') ? el : el.closest('.ace_editor');
    if (!aceEl) return null;
    try { return (window.ace && window.ace.edit(aceEl)) || null; } catch (_) { return null; }
  }

  function getCssFromEditor(editorEl) {
    const cm5 = getCm5(editorEl);
    if (cm5) return cm5.getValue();
    const ace = getAceEditor(editorEl);
    if (ace) return ace.getValue();
    const lineEls = editorEl.querySelectorAll('.CodeMirror-line, .cm-line, .ace_line');
    if (lineEls.length) return Array.from(lineEls).map(l => l.innerText ?? l.textContent ?? '').join('\n');
    if (editorEl.tagName === 'TEXTAREA') return editorEl.value;
    return editorEl.innerText || editorEl.textContent || '';
  }

  // ── Highlight helpers ─────────────────────────────────────────────────────────
  function clearHighlights(editorEl) {
    const cm5 = getCm5(editorEl);
    if (cm5) {
      for (let ln = 0; ln < cm5.lineCount(); ln++) {
        cm5.removeLineClass(ln, 'background', ERR_CLS);
      }
    }
    editorEl.querySelectorAll(`.${ERR_CLS}`).forEach(el => {
      el.classList.remove(ERR_CLS);
      el.querySelector('.ct-css-err-tip')?.remove();
    });
  }

  function highlightErrors(editorEl, errs) {
    clearHighlights(editorEl);
    const cm5 = getCm5(editorEl);

    errs.forEach(({ line, message }) => {
      if (cm5) {
        cm5.addLineClass(line - 1, 'background', ERR_CLS);
      } else {
        const lineEls = editorEl.querySelectorAll('.CodeMirror-line, .cm-line, .ace_line');
        const lineEl = lineEls[line - 1];
        if (!lineEl) return;
        lineEl.classList.add(ERR_CLS);
        lineEl.style.position = 'relative';
        if (!lineEl.querySelector('.ct-css-err-tip')) {
          const tip = document.createElement('span');
          tip.className = 'ct-css-err-tip';
          const safe = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          tip.innerHTML = `<span class="ct-css-err-line-gutter">!</span>Line ${line}: ${safe}`;
          lineEl.appendChild(tip);
        }
      }
    });
  }

  function scrollToLine(editorEl, lineNum) {
    const cm5 = getCm5(editorEl);
    if (cm5) {
      cm5.scrollIntoView({ line: lineNum - 1, ch: 0 }, 80);
    } else {
      const lineEls = editorEl.querySelectorAll('.CodeMirror-line, .cm-line, .ace_line');
      const el = lineEls[lineNum - 1];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Validation run ────────────────────────────────────────────────────────────
  function runValidation(editorEl, btn) {
    const css = getCssFromEditor(editorEl);
    if (!css.trim()) { showToast('CSS editor is empty', 'info'); return; }

    clearHighlights(editorEl);
    const errs = parseCssErrors(css);
    cssErrors = errs;
    errCursor = 0;
    activeEditorEl = editorEl;

    if (errs.length === 0) {
      btn.innerHTML = `${CSS_ICON}<span>CSS Valid ✓</span>`;
      btn.dataset.state = 'valid';
      Object.assign(btn.style, { borderColor: '#16a34a', color: '#16a34a', background: 'rgba(22,163,74,0.08)' });
      showToast('CSS is valid — no errors found ✓', 'success');
      return;
    }

    highlightErrors(editorEl, errs);
    scrollToLine(editorEl, errs[0].line);

    btn.innerHTML = `${CSS_ICON}<span>✗ ${errs.length} error${errs.length > 1 ? 's' : ''} — next</span>`;
    btn.dataset.state = 'errors';
    Object.assign(btn.style, { borderColor: '#dc2626', color: '#dc2626', background: 'rgba(220,38,38,0.07)' });
    showToast(
      `Found ${errs.length} CSS error${errs.length > 1 ? 's' : ''} — line ${errs[0].line}: ${errs[0].message}`,
      'error', 7000,
    );
  }

  function cycleError() {
    if (!activeEditorEl || cssErrors.length === 0) return;
    errCursor = (errCursor + 1) % cssErrors.length;
    const err = cssErrors[errCursor];
    scrollToLine(activeEditorEl, err.line);
    showToast(
      `Error ${errCursor + 1}/${cssErrors.length} — line ${err.line}: ${err.message}`,
      'error', 5000,
    );
  }

  const CSS_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;

  // ── Button injection ──────────────────────────────────────────────────────────
  function injectButton(editorEl) {
    editorEl.setAttribute(PROCESSED_ATTR, '1');
    ensureValidateStyles();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `${CSS_ICON}<span>Validate CSS</span>`;
    btn.dataset.state = 'idle';
    btn.title = 'Validate CSS — click again to cycle through errors';
    Object.assign(btn.style, {
      marginTop: '6px', padding: '5px 13px', fontSize: '11px', fontWeight: '600',
      border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer',
      background: '#fff', color: '#444', transition: 'all 0.15s',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    });

    const resetBtn = () => {
      if (btn.dataset.state === 'idle') return;
      btn.innerHTML = `${CSS_ICON}<span>Validate CSS</span>`;
      Object.assign(btn.style, { borderColor: '#ccc', color: '#444', background: '#fff' });
      clearHighlights(editorEl);
      if (activeEditorEl === editorEl) { cssErrors = []; activeEditorEl = null; }
    };

    btn.onmouseover = () => {
      if (btn.dataset.state === 'idle') Object.assign(btn.style, { borderColor: '#3b82f6', color: '#3b82f6' });
    };
    btn.onmouseout = () => {
      if (btn.dataset.state === 'idle') Object.assign(btn.style, { borderColor: '#ccc', color: '#444' });
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.state !== 'errors') {
        resetBtn();
        runValidation(editorEl, btn);
      } else {
        cycleError();
      }
    });

    // Reset when content changes
    const changeObs = new MutationObserver(resetBtn);
    changeObs.observe(editorEl, { childList: true, subtree: true, characterData: true });
    if (editorEl.tagName === 'TEXTAREA') editorEl.addEventListener('input', resetBtn);

    const wrap = document.createElement('div');
    wrap.setAttribute(TOOLBAR_ATTR, '1');
    wrap.style.cssText = 'margin-top:5px;';
    wrap.appendChild(btn);

    const parent = editorEl.closest('.form-group, .field, .control-group') || editorEl.parentElement;
    parent?.appendChild(wrap);
  }

  // ── Editor discovery ──────────────────────────────────────────────────────────
  function findEditors() {
    const found = [];

    // CodeMirror editors near a CSS-related label / container
    document.querySelectorAll('.CodeMirror').forEach(cm => {
      if (cm.getAttribute(PROCESSED_ATTR)) return;
      const container = cm.closest('.form-group, section, [class*="css"], [id*="css"]');
      const heading = container?.querySelector('label, h3, h4, .control-label, legend, p');
      const htxt = (heading?.innerText ?? heading?.textContent ?? '').toLowerCase();
      const cls  = (container?.className ?? '').toLowerCase();
      if (htxt.includes('css') || cls.includes('css') || cm.closest('[id*="css"],[class*="css"]')) {
        found.push(cm);
      }
    });

    // Plain textarea with CSS in name/id
    document.querySelectorAll('textarea').forEach(ta => {
      if (ta.getAttribute(PROCESSED_ATTR)) return;
      if ((ta.name || ta.id || '').toLowerCase().includes('css')) found.push(ta);
    });

    return found;
  }

  function scanAndInject() {
    if (!enabled) return;
    findEditors().forEach(injectButton);
  }

  // ── Activate / deactivate ─────────────────────────────────────────────────────
  function activate() {
    scanAndInject();
    if (!scanObserver) {
      scanObserver = new MutationObserver(scanAndInject);
      scanObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function deactivate() {
    scanObserver?.disconnect();
    scanObserver = null;

    if (activeEditorEl) clearHighlights(activeEditorEl);
    cssErrors = []; activeEditorEl = null;

    document.querySelectorAll(`[${TOOLBAR_ATTR}]`).forEach(el => el.remove());
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
    document.getElementById(STYLE_ID)?.remove();
  }
})();
