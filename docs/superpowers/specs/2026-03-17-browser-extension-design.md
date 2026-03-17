# Browser Extension Design

## Overview

A Chrome + Firefox browser extension that converts the current tab's web page to clean Markdown using Defuddle and Turndown — running entirely in the browser session, bypassing bot protection and login walls that block the existing Cloudflare Worker.

## Goals

- Convert any web page to Markdown using the user's existing browser session
- Support Chrome and Firefox (Manifest V3)
- Trigger via toolbar icon click or keyboard shortcut
- Output clean Markdown with YAML frontmatter in a new tab

## Non-Goals

- X/Twitter support (web pages only)
- Firefox-specific APIs or polyfills
- A popup UI before conversion

## Architecture

### Approach: Dynamic Injection

Background service worker listens for the toolbar click and keyboard shortcut. On trigger, it dynamically injects a content script into the active tab via `chrome.scripting.executeScript`. The content script processes the live DOM and returns the result. The background stores it in `chrome.storage.session` and opens the output tab.

This avoids running a content script on every page load while keeping the trigger logic centralized in the background.

### Data Flow

```
User clicks icon OR presses Ctrl+Shift+M
        ↓
background.js (service worker)
  → chrome.scripting.executeScript() injects content.js into active tab
        ↓
content.js (runs in page context)
  → new Defuddle(document).parse()        ← live DOM, no fetch needed
  → TurndownService().turndown(content)   ← HTML → Markdown
  → returns { title, markdown, url, author, published }
        ↓
background.js
  → chrome.storage.session.set({ result })
  → chrome.tabs.create({ url: 'output.html' })
        ↓
output.js
  → chrome.storage.session.get({ result })
  → renders raw Markdown with YAML frontmatter + copy button
```

### File Structure

```
extension/
├── manifest.json          # MV3, Chrome + Firefox compatible
├── background.js          # Service worker: handles triggers, injects, opens tab
├── content.js             # Runs Defuddle + Turndown on live document
├── output.html            # New tab shown after conversion
├── output.js              # Reads from storage, renders Markdown, copy button
├── icons/                 # 16/48/128px icons
└── lib/
    ├── defuddle.js        # Bundled IIFE from npm package
    └── turndown.js        # Bundled IIFE from npm package
```

## Key Technical Decisions

### Browser Compatibility (Chrome + Firefox MV3)

Firefox supports the `chrome.*` namespace in MV3, so no `browser.*` API polyfill is needed. The same JS runs on both browsers.

Manifest differences are handled via a single `manifest.json` with MV3 syntax — Firefox accepts MV3 since Firefox 109.

### No polyfill.ts needed

The Worker required `polyfill.ts` to fake `DOMParser`, `document`, and `window` for Defuddle and Turndown. The extension runs in a real browser context — all DOM APIs are natively available.

### Permissions

- `scripting` — required for `executeScript`
- `storage` — required for `chrome.storage.session`
- `activeTab` — required to access the current tab without broad host permissions

### Data Passing

`chrome.storage.session` is used to pass the conversion result from the content script (via background) to the output tab. This avoids URL length limits and keeps the data in memory only (cleared on browser restart).

### Output Tab

The output tab (`output.html`) shows:
- YAML frontmatter block (title, url, author, published, word_count)
- Raw Markdown content
- A "Copy to Clipboard" button

Styled to match the existing dark premium aesthetic of `public/index.html`.

### Build System

`esbuild` bundles `defuddle` and `turndown` from existing `node_modules` into `extension/lib/` as IIFE globals. Added as a `build:ext` script in the root `package.json` — no separate package manager setup needed.

```json
"build:ext": "esbuild ... --outfile=extension/lib/defuddle.js && esbuild ... --outfile=extension/lib/turndown.js"
```

## Loading the Extension

- **Chrome**: `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `extension/`
- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → select `extension/manifest.json`

## Out of Scope

- Publishing to Chrome Web Store or Firefox Add-ons
- Options/settings page
- X/Twitter rich extraction (handled by the Worker)
- Automatic re-conversion on page changes
