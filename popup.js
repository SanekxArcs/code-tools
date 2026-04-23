const SVG_COPY   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const SVG_FORMAT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h7"/><path d="M8 12h6"/><path d="M11 16h5"/></svg>`;
const SVG_WRAP   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="m16 16-3 3 3 3"/><path d="M3 12h14.5a1 1 0 0 1 0 7H13"/><path d="M3 19h6"/><path d="M3 5h18"/></svg>`;
const SVG_EXPAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:100%;height:100%"><path d="M19 3H5"/><path d="M12 21V7"/><path d="m6 15 6 6 6-6"/></svg>`;

// Storage keys:
//   Shared:  position, opacity, size
//   Copy:    copy_enabled, copy_blacklist
//   ACE:     ace_enabled, ace_wrap, ace_selectors, ace_blacklist

const DEFAULTS = {
  position:      'top-right',
  opacity:       70,
  size:          26,
  copy_enabled:  true,
  copy_blacklist: [],
  ace_enabled:       true,
  ace_wrap:          true,
  ace_autoExpand:    false,
  ace_selectors: [
    '#custom-js-initialize', '#js-get-item-ids', '#js-global-init-css-editor',
    '#js-get-blacklisted-item-ids', '#js-global-init-js-editor',
    '#js-recommendation-context', '#js-settings-override',
    '#js-translations', '#js-custom-css', '#js-on-done',
    '#custom-template-1', '#custom-template-2',
  ],
  ace_blacklist: [],
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

// Tabs
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Copy tab
const copyEnabledChk  = document.getElementById('copy-enabled');
const copyToggleLabel = document.getElementById('copy-toggle-label');
const copySettingsBody = document.getElementById('copy-settings-body');
const copyCurrentSite = document.getElementById('copy-current-site');
const copyBlockBtn    = document.getElementById('copy-block-btn');
const copyBlockedList = document.getElementById('copy-blocked-list');

// ACE tab
const aceEnabledChk   = document.getElementById('ace-enabled');
const aceToggleLabel  = document.getElementById('ace-toggle-label');
const aceSettingsBody = document.getElementById('ace-settings-body');
const aceWrapChk      = document.getElementById('ace-wrap');
const aceWrapLabel    = document.getElementById('ace-wrap-label');
const aceAutoExpandChk   = document.getElementById('ace-auto-expand');
const aceAutoExpandLabel = document.getElementById('ace-expand-label');
const aceCurrentSite  = document.getElementById('ace-current-site');
const aceBlockBtn     = document.getElementById('ace-block-btn');
const aceBlockedList  = document.getElementById('ace-blocked-list');
const aceSelectorList    = document.getElementById('ace-selector-list');
const aceAddInput        = document.getElementById('ace-add-input');
const aceAddBtn          = document.getElementById('ace-add-btn');
const aceScanBtn         = document.getElementById('ace-scan-btn');
const aceDiscoveredWrap  = document.getElementById('ace-discovered-wrap');
const aceDiscoveredList  = document.getElementById('ace-discovered-list');
const aceDiscoveredLabel = document.getElementById('ace-discovered-label');
const aceAddAllBtn       = document.getElementById('ace-add-all-btn');

// Shared appearance
const posCells     = document.querySelectorAll('#pos-grid .pos-cell[data-pos]');
const opacitySlider = document.getElementById('opacity');
const opacityVal   = document.getElementById('opacity-val');
const sizeSlider   = document.getElementById('size');
const sizeVal      = document.getElementById('size-val');
const previewCopy   = document.getElementById('preview-copy-btn');
const previewFmt    = document.getElementById('preview-fmt-btn');
const previewWrap   = document.getElementById('preview-wrap-btn');
const previewExpand = document.getElementById('preview-expand-btn');

let currentHostname = '';
let copyBlacklist   = [];
let aceBlacklist    = [];
let aceSelectors    = [];

// ── Tab switching ─────────────────────────────────────────────────────────────

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Shared appearance helpers ─────────────────────────────────────────────────

function setActivePos(pos) {
  posCells.forEach(c => c.classList.toggle('active', c.dataset.pos === pos));
}

function updatePreview(size, opacity) {
  const pad    = Math.max(3, Math.round(size / 6));
  const iconSz = (size - pad * 2) + 'px';
  const bg     = `rgba(0,0,0,${(opacity / 100).toFixed(2)})`;

  [previewCopy, previewFmt, previewWrap, previewExpand].forEach(btn => {
    btn.style.width      = size + 'px';
    btn.style.height     = size + 'px';
    btn.style.padding    = pad + 'px';
    btn.style.background = bg;
  });
  previewCopy.innerHTML   = SVG_COPY;
  previewFmt.innerHTML    = SVG_FORMAT;
  previewWrap.innerHTML   = SVG_WRAP;
  previewExpand.innerHTML = SVG_EXPAND;
  [previewCopy, previewFmt, previewWrap, previewExpand].forEach(btn => {
    const svg = btn.querySelector('svg');
    if (svg) { svg.style.width = iconSz; svg.style.height = iconSz; }
  });
}

posCells.forEach(cell => {
  cell.addEventListener('click', () => {
    setActivePos(cell.dataset.pos);
    chrome.storage.sync.set({ position: cell.dataset.pos });
  });
});

opacitySlider.addEventListener('input', () => {
  const v = parseInt(opacitySlider.value);
  opacityVal.textContent = v + '%';
  updatePreview(parseInt(sizeSlider.value), v);
  chrome.storage.sync.set({ opacity: v });
});

sizeSlider.addEventListener('input', () => {
  const v = parseInt(sizeSlider.value);
  sizeVal.textContent = v + 'px';
  updatePreview(v, parseInt(opacitySlider.value));
  chrome.storage.sync.set({ size: v });
});

// ── Copy Button helpers ───────────────────────────────────────────────────────

function updateCopyToggleUI(enabled) {
  copyToggleLabel.textContent = enabled ? 'ON' : 'OFF';
  copySettingsBody.classList.toggle('disabled', !enabled);
}

function renderCopyBlockedList() {
  copyBlockedList.innerHTML = '';
  copyBlacklist.forEach(host => {
    const row  = document.createElement('div');
    row.className = 'blocked-item';
    const span = document.createElement('span');
    span.className = 'bhost'; span.textContent = host;
    const rm = document.createElement('button');
    rm.className = 'btn-remove'; rm.textContent = '✕'; rm.title = 'Remove';
    rm.addEventListener('click', () => {
      copyBlacklist = copyBlacklist.filter(h => h !== host);
      chrome.storage.sync.set({ copy_blacklist: copyBlacklist });
      updateCopyBlockBtn(); renderCopyBlockedList();
    });
    row.appendChild(span); row.appendChild(rm);
    copyBlockedList.appendChild(row);
  });
}

function updateCopyBlockBtn() {
  const blocked = copyBlacklist.includes(currentHostname);
  copyBlockBtn.textContent = blocked ? 'Unblock' : 'Block';
  copyBlockBtn.classList.toggle('active-block', blocked);
}

copyEnabledChk.addEventListener('change', () => {
  const en = copyEnabledChk.checked;
  updateCopyToggleUI(en);
  chrome.storage.sync.set({ copy_enabled: en });
});

copyBlockBtn.addEventListener('click', () => {
  if (!currentHostname) return;
  if (copyBlacklist.includes(currentHostname)) {
    copyBlacklist = copyBlacklist.filter(h => h !== currentHostname);
  } else {
    copyBlacklist = [...copyBlacklist, currentHostname];
  }
  chrome.storage.sync.set({ copy_blacklist: copyBlacklist });
  updateCopyBlockBtn(); renderCopyBlockedList();
});

// ── ACE Formatter helpers ─────────────────────────────────────────────────────

function updateAceToggleUI(enabled) {
  aceToggleLabel.textContent = enabled ? 'ON' : 'OFF';
  aceSettingsBody.classList.toggle('disabled', !enabled);
}

function updateAceWrapUI(wrap) {
  aceWrapLabel.textContent = wrap ? 'ON' : 'OFF';
}

function updateAceAutoExpandUI(v) {
  aceAutoExpandLabel.textContent = v ? 'ON' : 'OFF';
}

// ── Page scan ─────────────────────────────────────────────────────────────────

let lastDiscovered = [];

// Detect CSS attribute-selector patterns from a list of raw IDs.
// Returns patterns like { selector: '[id^="job_feeds_"][id$="_transformations"]', count: 4 }
function detectIdPatterns(ids) {
  if (ids.length < 2) return [];
  const patterns = [];
  const seen = new Set();

  function add(sel, count) {
    if (!seen.has(sel) && count >= 2) { seen.add(sel); patterns.push({ selector: sel, count }); }
  }

  // ── 1. Common prefix ──────────────────────────────────────────────────────
  let prefix = ids[0];
  for (const id of ids) {
    let i = 0;
    while (i < prefix.length && i < id.length && prefix[i] === id[i]) i++;
    prefix = prefix.slice(0, i);
  }
  // Trim to last _ boundary so we don't cut mid-word
  const cut = prefix.lastIndexOf('_');
  const cleanPrefix = cut > 0 ? prefix.slice(0, cut + 1) : prefix; // keep trailing _

  if (cleanPrefix.length >= 3) {
    const prefixMatches = ids.filter(id => id.startsWith(cleanPrefix));
    add(`[id^="${cleanPrefix}"]`, prefixMatches.length);

    // ── 2. Suffix patterns within the prefix group ─────────────────────────
    // Strip prefix and the immediately following variable segment (e.g. the number)
    // to reveal the stable suffix after it.
    const suffixCount = new Map();
    for (const id of prefixMatches) {
      const rest = id.slice(cleanPrefix.length);        // e.g. "4976_transformations"
      const sep  = rest.indexOf('_');
      if (sep < 0) continue;
      const suffix = rest.slice(sep);                   // e.g. "_transformations"
      if (suffix.length < 2) continue;
      suffixCount.set(suffix, (suffixCount.get(suffix) || 0) + 1);
    }
    for (const [suffix, count] of suffixCount) {
      if (count >= 2) {
        // Combined: prefix + suffix is the tightest selector
        add(`[id^="${cleanPrefix}"][id$="${suffix}"]`, count);
        // Suffix alone (useful across different prefixes)
        const suffixAloneCount = ids.filter(id => id.endsWith(suffix)).length;
        add(`[id$="${suffix}"]`, suffixAloneCount);
      }
    }
  }

  // ── 3. Fallback: any suffix appearing ≥2 times regardless of prefix ───────
  const globalSuffix = new Map();
  for (const id of ids) {
    const parts = id.split('_');
    for (let n = 1; n <= Math.min(3, parts.length - 1); n++) {
      const suffix = '_' + parts.slice(-n).join('_');
      globalSuffix.set(suffix, (globalSuffix.get(suffix) || 0) + 1);
    }
  }
  for (const [suffix, count] of globalSuffix) {
    add(`[id$="${suffix}"]`, count);
  }

  // Sort: most specific (longest selector) first, then by count
  patterns.sort((a, b) => (b.selector.length - a.selector.length) || (b.count - a.count));
  return patterns;
}

function makeDiscoveredRow(sel, isNew, onAdd) {
  const row = document.createElement('div');
  row.className = 'discovered-item';

  const label = document.createElement('span');
  label.className = 'discovered-sel' + (isNew ? '' : ' already');
  label.textContent = sel;
  label.title = sel;
  row.appendChild(label);

  if (isNew) {
    const btn = document.createElement('button');
    btn.className   = 'btn-add-single';
    btn.textContent = '+ Add';
    btn.addEventListener('click', onAdd);
    row.appendChild(btn);
  } else {
    const chk = document.createElement('span');
    chk.className = 'discovered-check'; chk.textContent = '✓';
    row.appendChild(chk);
  }
  return row;
}

function addSelectorAndRefresh(sel) {
  if (!aceSelectors.includes(sel)) {
    aceSelectors.push(sel);
    chrome.storage.sync.set({ ace_selectors: [...aceSelectors] });
    renderSelectors();
  }
  renderDiscovered(lastDiscovered);
}

function renderDiscovered(found) {
  lastDiscovered = found;
  aceDiscoveredList.innerHTML = '';

  if (!found.length) {
    const msg = document.createElement('div');
    msg.className = 'scan-empty';
    msg.textContent = 'No ACE editors with IDs found on this page.';
    aceDiscoveredList.appendChild(msg);
    aceDiscoveredLabel.textContent = 'Found on page';
    aceAddAllBtn.style.display = 'none';
    aceDiscoveredWrap.style.display = 'block';
    return;
  }

  const newOnes = found.filter(s => !aceSelectors.includes(s));
  aceDiscoveredLabel.textContent =
    `Found ${found.length} editor${found.length !== 1 ? 's' : ''}` +
    (newOnes.length ? ` · ${newOnes.length} new` : ' · all added');
  aceAddAllBtn.style.display = newOnes.length ? 'inline-block' : 'none';

  // ── Patterns section ──────────────────────────────────────────────────────
  const rawIds = found.map(s => s.slice(1)); // strip leading #
  const patterns = detectIdPatterns(rawIds);
  const newPatterns = patterns.filter(p => !aceSelectors.includes(p.selector));

  if (patterns.length) {
    const ph = document.createElement('div');
    ph.className = 'discovered-group-label';
    ph.textContent = 'Suggested patterns';
    aceDiscoveredList.appendChild(ph);

    patterns.forEach(({ selector, count }) => {
      const isNew = !aceSelectors.includes(selector);
      const row = makeDiscoveredRow(
        `${selector}  (${count})`,
        isNew,
        () => addSelectorAndRefresh(selector)
      );
      // Store the real selector on the element for the "add all" handler
      row.dataset.realSel = selector;
      aceDiscoveredList.appendChild(row);
    });

    const divider = document.createElement('div');
    divider.className = 'discovered-divider';
    aceDiscoveredList.appendChild(divider);

    const ih = document.createElement('div');
    ih.className = 'discovered-group-label';
    ih.textContent = 'Individual editors';
    aceDiscoveredList.appendChild(ih);
  }

  // ── Individual IDs ────────────────────────────────────────────────────────
  found.forEach(sel => {
    const isNew = !aceSelectors.includes(sel);
    aceDiscoveredList.appendChild(
      makeDiscoveredRow(sel, isNew, () => addSelectorAndRefresh(sel))
    );
  });

  aceDiscoveredWrap.style.display = 'block';
}

aceAddAllBtn.addEventListener('click', () => {
  const newOnes = lastDiscovered.filter(s => !aceSelectors.includes(s));
  if (!newOnes.length) return;
  aceSelectors.push(...newOnes);
  chrome.storage.sync.set({ ace_selectors: [...aceSelectors] });
  renderSelectors();
  renderDiscovered(lastDiscovered);
});

aceScanBtn.addEventListener('click', async () => {
  aceScanBtn.classList.add('scanning');
  aceScanBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('no tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const escape = id => {
          if (typeof CSS !== 'undefined' && CSS.escape) return '#' + CSS.escape(id);
          return '#' + id.replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
        };
        return Array.from(document.querySelectorAll('.ace_editor[id]'))
          .map(el => escape(el.id))
          .filter(s => s.length > 1);
      },
    });

    renderDiscovered((results && results[0] && results[0].result) || []);
  } catch (_) {
    aceDiscoveredLabel.textContent = 'Could not scan this page';
    aceAddAllBtn.style.display = 'none';
    aceDiscoveredList.innerHTML = '<div class="scan-empty">Extension cannot access this page type.</div>';
    aceDiscoveredWrap.style.display = 'block';
  }

  aceScanBtn.classList.remove('scanning');
  aceScanBtn.querySelector('svg').style.animation = '';
});

function renderAceBlockedList() {
  aceBlockedList.innerHTML = '';
  aceBlacklist.forEach(host => {
    const row  = document.createElement('div');
    row.className = 'blocked-item';
    const span = document.createElement('span');
    span.className = 'bhost'; span.textContent = host;
    const rm = document.createElement('button');
    rm.className = 'btn-remove'; rm.textContent = '✕'; rm.title = 'Remove';
    rm.addEventListener('click', () => {
      aceBlacklist = aceBlacklist.filter(h => h !== host);
      chrome.storage.sync.set({ ace_blacklist: aceBlacklist });
      updateAceBlockBtn(); renderAceBlockedList();
    });
    row.appendChild(span); row.appendChild(rm);
    aceBlockedList.appendChild(row);
  });
}

function updateAceBlockBtn() {
  const blocked = aceBlacklist.includes(currentHostname);
  aceBlockBtn.textContent = blocked ? 'Unblock' : 'Block';
  aceBlockBtn.classList.toggle('active-block', blocked);
}

function renderSelectors() {
  aceSelectorList.innerHTML = '';
  aceSelectors.forEach((sel, idx) => {
    const row  = document.createElement('div');
    row.className = 'selector-row';
    const inp  = document.createElement('input');
    inp.type = 'text'; inp.className = 'selector-text'; inp.value = sel; inp.spellcheck = false;
    inp.addEventListener('change', () => {
      const v = inp.value.trim();
      if (v) { aceSelectors[idx] = v; } else { aceSelectors.splice(idx, 1); }
      chrome.storage.sync.set({ ace_selectors: [...aceSelectors] });
      if (!v) renderSelectors();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') { inp.value = sel; inp.blur(); }
    });
    const rm = document.createElement('button');
    rm.className = 'btn-remove'; rm.textContent = '✕'; rm.title = 'Remove';
    rm.addEventListener('click', () => {
      aceSelectors.splice(idx, 1);
      chrome.storage.sync.set({ ace_selectors: [...aceSelectors] });
      renderSelectors();
    });
    row.appendChild(inp); row.appendChild(rm);
    aceSelectorList.appendChild(row);
  });
}

function addSelector() {
  const v = aceAddInput.value.trim();
  if (!v || aceSelectors.includes(v)) { aceAddInput.value = ''; return; }
  aceSelectors.push(v);
  chrome.storage.sync.set({ ace_selectors: [...aceSelectors] });
  renderSelectors();
  aceAddInput.value = '';
}

aceEnabledChk.addEventListener('change', () => {
  const en = aceEnabledChk.checked;
  updateAceToggleUI(en);
  chrome.storage.sync.set({ ace_enabled: en });
});

aceWrapChk.addEventListener('change', () => {
  const w = aceWrapChk.checked;
  updateAceWrapUI(w);
  chrome.storage.sync.set({ ace_wrap: w });
});

aceAutoExpandChk.addEventListener('change', () => {
  const v = aceAutoExpandChk.checked;
  updateAceAutoExpandUI(v);
  chrome.storage.sync.set({ ace_autoExpand: v });
});

aceBlockBtn.addEventListener('click', () => {
  if (!currentHostname) return;
  if (aceBlacklist.includes(currentHostname)) {
    aceBlacklist = aceBlacklist.filter(h => h !== currentHostname);
  } else {
    aceBlacklist = [...aceBlacklist, currentHostname];
  }
  chrome.storage.sync.set({ ace_blacklist: aceBlacklist });
  updateAceBlockBtn(); renderAceBlockedList();
});

aceAddBtn.addEventListener('click', addSelector);
aceAddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSelector(); });

// ── Load all state ────────────────────────────────────────────────────────────

chrome.storage.sync.get(DEFAULTS, (s) => {
  copyBlacklist = s.copy_blacklist || [];
  aceBlacklist  = s.ace_blacklist  || [];
  aceSelectors  = s.ace_selectors  || [];

  // Copy tab
  copyEnabledChk.checked = !!s.copy_enabled;
  updateCopyToggleUI(s.copy_enabled);
  renderCopyBlockedList();

  // ACE tab
  aceEnabledChk.checked = !!s.ace_enabled;
  updateAceToggleUI(s.ace_enabled);
  aceWrapChk.checked = !!s.ace_wrap;
  updateAceWrapUI(s.ace_wrap);
  aceAutoExpandChk.checked = !!s.ace_autoExpand;
  updateAceAutoExpandUI(s.ace_autoExpand);
  renderAceBlockedList();
  renderSelectors();

  // Shared appearance
  setActivePos(s.position);
  opacitySlider.value    = s.opacity;
  opacityVal.textContent = s.opacity + '%';
  sizeSlider.value       = s.size;
  sizeVal.textContent    = s.size + 'px';
  updatePreview(s.size, s.opacity);
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0] || !tabs[0].url) return;
  try { currentHostname = new URL(tabs[0].url).hostname; } catch (_) {}
  const label = currentHostname || '—';
  copyCurrentSite.textContent = label;
  aceCurrentSite.textContent  = label;
  updateCopyBlockBtn();
  updateAceBlockBtn();
});
