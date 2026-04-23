# Code Tools — Chrome Extension

A single extension that adds two hover toolbars to every page:

- **Copy Button** — one-click copy on any input, textarea, or code editor
- **ACE Formatter** — format, word-wrap, and height-expand buttons on ACE code editors

---

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `code-tools/` folder
4. The extension icon appears in the toolbar

---

## Features

### Copy Button

Adds a hover button to every `<input>`, `<textarea>`, CodeMirror, and `contenteditable` element on the page.

- Hover any text field → copy button appears at the configured position
- Click → content is copied to clipboard; button briefly shows a green ✓
- ACE editors are excluded here (they get their own combined toolbar — see below)

### ACE Formatter

Adds a **row of 4 buttons** to ACE code editors matching your selector list.
Hover an editor → the toolbar appears:

| Button | Icon | Action |
|--------|------|--------|
| Copy | clipboard | Copies the full editor content |
| Format | gantt chart | Beautifies the code (`Ctrl+Shift+F` also works) |
| Wrap | text-wrap | Toggles word wrap on/off (blue = on) |
| Expand | arrow-down | Expands editor to fit all content / restores default height (purple = expanded) |

---

## Popup Settings

Click the extension icon to open the popup.

### Copy Button tab

| Setting | Description |
|---------|-------------|
| Enable toggle | Turns the copy button on/off globally |
| Site Blocklist | Block/unblock the current site; blocked sites never show the button |

### ACE Formatter tab

| Setting | Description |
|---------|-------------|
| Enable toggle | Turns the ACE toolbar on/off globally |
| Word Wrap Default | When ON, every editor starts with word wrap enabled |
| Auto-expand Height | When ON, every matched editor starts fully expanded to fit its content |
| Site Blocklist | Block/unblock the current site |
| ACE Editor Selectors | List of CSS selectors that identify which elements to target (see below) |

### Appearance — all buttons *(shared)*

These settings apply to **every button** from both features simultaneously.

| Setting | Description |
|---------|-------------|
| Position | 9-point grid — where the button(s) appear relative to the field |
| Opacity | Background opacity of all buttons (10–100%) |
| Button Size | Size of all buttons in px (18–44px) |
| Preview | Live preview showing all three button types at current size/opacity |

---

## Managing ACE Editor Selectors

The selector list tells the extension which elements on the page are ACE editors.
Any valid CSS selector works: `#my-editor`, `.ace_editor`, `[id^="feeds_"]`.

### Manual add

Type a selector into the input at the bottom of the list and press **Add** or `Enter`.
Click any existing selector to edit it inline; press `Enter` to save or `Escape` to cancel.
Click **✕** to remove a selector.

### Scan page

Click **Scan page for ACE editors** to automatically detect editors on the current tab.
The scan finds every element with class `ace_editor` and a non-empty `id`.

Results are shown in two groups:

**Suggested patterns** — CSS attribute selectors detected from the IDs' structure:

| Pattern type | Example selector | Matches |
|---|---|---|
| Prefix + suffix | `[id^="job_feeds_"][id$="_transformations"]` | all transformation editors across feeds |
| Prefix + suffix | `[id^="job_feeds_"][id$="_additional_properties"]` | all property editors across feeds |
| Prefix only | `[id^="job_feeds_"]` | every feed editor regardless of type |
| Suffix only | `[id$="_transformations"]` | transformation editors on any prefix |

Using a pattern selector means **new editors added to the page later are picked up automatically** — no need to scan again.

**Individual editors** — each found `#id` with an **+ Add** button.

Click **+ Add** on any item, or **Add all new** in the header to add everything at once.
Already-added selectors show a grey ✓.

---

## Tips

- **Pattern selectors** are the recommended approach for pages where the numeric part of an ID changes per record (e.g. `job_feeds_1234_transformations`). Add `[id^="job_feeds_"][id$="_transformations"]` once and it works for all records forever.
- **`Ctrl+Shift+F`** formats the focused ACE editor without using the mouse.
- The **Expand** button remembers the original height per editor, so collapse always restores exactly what was there before.
- Both blocklists are independent — you can allow Copy Button but block ACE Formatter on the same site.
- All settings sync via `chrome.storage.sync` and persist across browser restarts.
