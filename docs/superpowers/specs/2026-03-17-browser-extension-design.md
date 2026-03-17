# Browser Extension Design

## Overview

A Chrome + Firefox browser extension that converts the current tab's web page to clean Markdown using Defuddle and Turndown — running entirely in the browser session, bypassing bot protection and login walls that block the existing Cloudflare Worker.

## Goals

- Convert any web page to Markdown using the user's existing browser session
- Support Chrome (MV3) and Firefox 132+ (MV3)
- Trigger via toolbar icon click or keyboard shortcut
- Output clean Markdown with YAML frontmatter in a new tab

## Non-Goals

- X/Twitter support (web pages only)
- Publishing to browser extension stores
- An options/settings page
- Support for Firefox below version 132

## Architecture

### Approach: Dynamic Injection

Background service worker listens for the toolbar click and keyboard shortcut. On trigger, it dynamically injects a content script into the active tab via `chrome.scripting.executeScript`. The content script processes the live DOM and returns the result. The background stores it in `chrome.storage.session` (available in Firefox 132+) using a UUID key and opens the output tab with that key as a query param.

This avoids running a content script on every page load while keeping the trigger logic centralized in the background.

### Data Flow

```
User clicks icon OR presses Ctrl+Shift+D
        ↓
background.js (service worker)
  → chrome.scripting.executeScript() injects content.js into active tab
  → InjectionResult[] returned; extract results[0].result
  → On error (undefined result, restricted page): show notification
        ↓
content.js (runs in page context, returns value via executeScript)
  → new Defuddle(document).parse()        ← live DOM, no fetch needed
  → TurndownService().turndown(content)   ← HTML → Markdown
  → returns ConversionResult object (or throws on failure)
        ↓
background.js
  → const key = crypto.randomUUID()
  → await chrome.storage.session.set({ [key]: result })
  → chrome.tabs.create({ url: `output.html?key=${key}` })
        ↓
output.js
  → const key = new URLSearchParams(location.search).get('key')
  → chrome.storage.session.get(key)
  → If no result: show error state
  → Renders YAML frontmatter + raw Markdown using textContent (no innerHTML)
  → Copy to Clipboard button
```

### ConversionResult Shape

The content script returns (and storage stores) this object:

```typescript
interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
  frontmatter: {
    title: string;
    url: string;
    author?: string;
    published?: string;
    description?: string;
    domain: string;
    word_count: number;
  };
  error?: string; // set if extraction partially failed
}
```

### File Structure

```
extension/
├── manifest.json          # MV3, Chrome + Firefox compatible
├── background.js          # Service worker: handles triggers, injects, opens tab
├── content.js             # Runs Defuddle + Turndown on live document
├── output.html            # New tab shown after conversion
├── output.js              # Reads from storage via key, renders Markdown
├── icons/                 # 16/48/128px icons
└── lib/
    ├── defuddle.js        # Bundled IIFE: global name `Defuddle`
    └── turndown.js        # Bundled IIFE: global name `TurndownService`
```

## Key Technical Decisions

### Browser Compatibility (Chrome + Firefox 132+)

Firefox supports the `chrome.*` namespace in MV3. `chrome.storage.session` was added in Firefox 132 (released October 2024) — this is the minimum supported version.

The same JS runs on both browsers with no polyfills.

### No polyfill.ts needed

The Worker required `polyfill.ts` to fake `DOMParser`, `document`, and `window` for Defuddle and Turndown. The extension runs in a real browser context — all DOM APIs are natively available.

### Permissions

- `scripting` — required for `executeScript`
- `storage` — required for `chrome.storage.session`
- `activeTab` — required to access the current tab without broad host permissions

### Restricted Pages

`chrome.scripting.executeScript` will fail on `chrome://`, `about:`, `file://`, extension pages, and the Chrome Web Store. The background should catch this and show a `chrome.notifications` message: "Can't convert this page."

### Keyboard Shortcut

`Ctrl+Shift+D` (Windows/Linux) / `MacCtrl+Shift+D` (Mac). Avoids `Ctrl+Shift+M` which conflicts with Firefox's built-in Responsive Design Mode shortcut.

Declared in `manifest.json` under `commands`:
```json
"commands": {
  "convert": {
    "suggested_key": { "default": "Ctrl+Shift+D", "mac": "MacCtrl+Shift+D" },
    "description": "Convert current page to Markdown"
  }
}
```

### Storage Key Collision Prevention

Each conversion generates a `crypto.randomUUID()` key. The key is passed to `output.html` as a query param (`?key=<uuid>`). This prevents rapid conversions from overwriting each other in storage.

### Race Condition Prevention

`chrome.tabs.create` is called inside the resolved promise of `chrome.storage.session.set`, guaranteeing the data is written before the output tab loads.

```js
await chrome.storage.session.set({ [key]: result });
await chrome.tabs.create({ url: `output.html?key=${key}` });
```

### esbuild Bundling

Defuddle (`defuddle` npm package v0.8.x) ships an ES module at `dist/index.js`. Turndown ships at `lib/turndown.es.js`. Both are bundled as IIFE globals:

```json
"build:ext": "esbuild node_modules/defuddle/dist/index.js --bundle --format=iife --global-name=Defuddle --outfile=extension/lib/defuddle.js && esbuild node_modules/turndown/lib/turndown.es.js --bundle --format=iife --global-name=TurndownService --outfile=extension/lib/turndown.js"
```

Content Security Policy for `output.html` is MV3-default (`script-src 'self'`) — safe because Markdown is rendered via `textContent`, not `innerHTML`.

### Output Tab Rendering

Markdown is displayed using `element.textContent = markdownString` — plain text, no HTML parsing. This is safe under MV3's default CSP and avoids XSS risk from untrusted page content.

The YAML frontmatter is shown as a fenced code block above the Markdown body.

## Loading the Extension

- **Chrome**: `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `extension/`
- **Firefox 132+**: `about:debugging` → This Firefox → Load Temporary Add-on → select `extension/manifest.json`
