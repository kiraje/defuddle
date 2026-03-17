# Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome + Firefox MV3 browser extension that converts the current tab to clean Markdown using Defuddle + Turndown, triggered by toolbar click or Ctrl+Shift+D.

**Architecture:** A background service worker dynamically injects a content script on demand, which runs Defuddle + Turndown on the live DOM and returns the result. The background stores it in `chrome.storage.session` under a UUID key and opens `output.html?key=<uuid>` in a new tab.

**Tech Stack:** TypeScript, esbuild (bundler), Defuddle, Turndown, Chrome MV3 (compatible with Firefox 132+)

> **Bundling note:** The spec describes `extension/lib/defuddle.js` and `extension/lib/turndown.js` as separate lib files. This plan uses a simpler approach: each TypeScript entry point (`content.ts`, `background.ts`, `output.ts`) is bundled independently by esbuild with all dependencies inlined. No `extension/lib/` directory is created — `content.js` includes Defuddle and Turndown directly. This is functionally equivalent and removes the indirection of separate lib files.

> **Build timing note:** The `build:ext` script (added in Task 1) references source files that don't exist until Chunk 2. Running `npm run build:ext` will fail until all three `.ts` source files exist. Only run a full build after completing Task 3 (content.ts), Task 4 (background.ts), and Task 6 (output.ts).

---

## Chunk 1: Build Setup + Manifest

### Task 1: Install esbuild and verify entry points

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install esbuild as a dev dependency**

```bash
npm install --save-dev esbuild
```

Expected: `esbuild` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Verify defuddle and turndown entry points exist**

```bash
ls node_modules/defuddle/dist/index.js && ls node_modules/turndown/lib/turndown.es.js
```

Expected: Both files found. (These are the entry points esbuild will bundle.)

- [ ] **Step 3: Add `build:ext` script to `package.json`**

In the `"scripts"` object, add:

```json
"build:ext": "esbuild extension/src/content.ts --bundle --format=iife --footer:js=\"window.__defuddleResult\" --outfile=extension/content.js && esbuild extension/src/background.ts --bundle --format=iife --outfile=extension/background.js && esbuild extension/src/output.ts --bundle --format=iife --outfile=extension/output.js"
```

- [ ] **Step 4: Verify esbuild runs**

```bash
npx esbuild --version
```

Expected: prints a version like `0.x.x`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add esbuild for extension bundling"
```

---

### Task 2: Create extension directory structure and manifest

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/output.html`
- Create: `extension/icons/icon16.png` (placeholder)
- Create: `extension/icons/icon48.png` (placeholder)
- Create: `extension/icons/icon128.png` (placeholder)

- [ ] **Step 1: Create the extension directory skeleton**

```bash
mkdir -p extension/src extension/icons
```

- [ ] **Step 2: Create `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Defuddle",
  "version": "1.0.0",
  "description": "Convert any web page to clean Markdown",
  "permissions": ["scripting", "storage", "activeTab", "notifications", "clipboardWrite"],
  "action": {
    "default_title": "Convert to Markdown",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "commands": {
    "convert": {
      "suggested_key": {
        "default": "Ctrl+Shift+D",
        "mac": "MacCtrl+Shift+D"
      },
      "description": "Convert current page to Markdown"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

> Note: `"notifications"` is required for `chrome.notifications` in `background.ts`. `"clipboardWrite"` ensures `navigator.clipboard.writeText` works reliably in Firefox. Both are omitted from the spec's permissions list — include them here.

- [ ] **Step 3: Generate placeholder PNG icons**

These are functional 1x1 pixel placeholders. Task 7 in Chunk 3 includes replacing them with proper artwork.

```bash
node -e "
const fs = require('fs');
// Minimal valid 1x1 indigo PNG (placeholder — replaced in Task 7)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('extension/icons/icon16.png', png);
fs.writeFileSync('extension/icons/icon48.png', png);
fs.writeFileSync('extension/icons/icon128.png', png);
console.log('Icons created');
"
```

- [ ] **Step 4: Create `extension/output.html`**

Create this file with dark theme styling matching the existing `public/index.html` aesthetic:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Defuddle</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0a;
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 32px 24px;
    }
    .container { max-width: 860px; margin: 0 auto; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #1e1e2e;
    }
    .title { font-size: 14px; font-weight: 500; color: #818cf8; letter-spacing: 0.05em; text-transform: uppercase; }
    .copy-btn {
      background: #1e1e2e;
      color: #818cf8;
      border: 1px solid #2d2d44;
      border-radius: 6px;
      padding: 8px 18px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .copy-btn:hover { background: #2d2d44; color: #a5b4fc; }
    .copy-btn.copied { background: #1a2e1a; color: #4ade80; border-color: #2d4d2d; }
    .source-url {
      font-size: 12px;
      color: #4a5568;
      margin-bottom: 20px;
      font-family: 'JetBrains Mono', monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .markdown-output {
      background: #0f0f1a;
      border: 1px solid #1e1e2e;
      border-radius: 10px;
      padding: 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.7;
      color: #c8d3f5;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 200px;
    }
    .error-state { text-align: center; padding: 80px 24px; color: #64748b; }
    .error-title { font-size: 18px; color: #ef4444; margin-bottom: 8px; }
    .error-msg { font-size: 14px; }
  </style>
</head>
<body>
  <div class="container" id="container">
    <div class="header">
      <span class="title">Defuddle</span>
      <button class="copy-btn" id="copyBtn">Copy Markdown</button>
    </div>
    <div class="source-url" id="sourceUrl"></div>
    <pre class="markdown-output" id="output"></pre>
  </div>
  <script src="output.js"></script>
</body>
</html>
```

- [ ] **Step 5: Commit skeleton**

```bash
git add extension/
git commit -m "chore: add extension manifest, output.html, and placeholder icons"
```

---

## Chunk 2: Core Logic (content.ts + background.ts)

### Task 3: Write content.ts — extraction logic

**Files:**
- Create: `extension/src/content.ts`

content.ts runs inside the page via `executeScript`. It must return a plain serializable object (no class instances, no DOM nodes). The IIFE's return value is captured as `results[0].result` by the background.

- [ ] **Step 1: Create `extension/src/content.ts`**

```typescript
import Defuddle from 'defuddle';
import TurndownService from 'turndown';

// Note: spec included error? field on ConversionResult but it is never populated
// or consumed — omitted here per YAGNI.
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
}

// IMPORTANT: esbuild --format=iife wraps all code in (() => { ... })()
// The IIFE's return value is discarded by executeScript — it always sees undefined.
// Fix: assign to window.__defuddleResult, then use --footer:js="window.__defuddleResult"
// so that expression is the final evaluated value captured by executeScript.
declare global { interface Window { __defuddleResult: ConversionResult; } }

function buildFrontmatter(fm: ConversionResult['frontmatter']): string {
  const lines = ['---'];
  lines.push(`title: "${fm.title.replace(/"/g, '\\"')}"`);
  lines.push(`url: "${fm.url}"`);
  if (fm.author) lines.push(`author: "${fm.author}"`);
  if (fm.published) lines.push(`published: "${fm.published}"`);
  if (fm.description) lines.push(`description: "${fm.description.replace(/"/g, '\\"')}"`);
  lines.push(`domain: "${fm.domain}"`);
  lines.push(`word_count: ${fm.word_count}`);
  lines.push('---');
  return lines.join('\n');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const parsed = new Defuddle(document).parse();
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const markdown = td.turndown(parsed.content || document.body.outerHTML);

const fm: ConversionResult['frontmatter'] = {
  title: parsed.title || document.title || '',
  url: location.href,
  domain: location.hostname,
  word_count: countWords(markdown),
};

if (parsed.author) fm.author = parsed.author;
if (parsed.published) fm.published = parsed.published;
if (parsed.description) fm.description = parsed.description;

window.__defuddleResult = {
  title: fm.title,
  url: location.href,
  markdown: buildFrontmatter(fm) + '\n\n' + markdown,
  frontmatter: fm,
};
// window.__defuddleResult is appended as the final expression via --footer:js
// making it the value captured by chrome.scripting.executeScript
```

- [ ] **Step 2: Build only content.js and verify it is created**

```bash
npx esbuild extension/src/content.ts --bundle --format=iife --footer:js="window.__defuddleResult" --outfile=extension/content.js
```

Expected: `extension/content.js` created with no errors. The file should end with the line `window.__defuddleResult;` after the closing `})();`.

Verify:
```bash
tail -3 extension/content.js
```

Expected last line: `window.__defuddleResult;`

- [ ] **Step 3: Commit source only (not the generated JS — it will be gitignored in Task 9)**

```bash
git add extension/src/content.ts
git commit -m "feat: add content script for Defuddle + Turndown extraction"
```

---

### Task 4: Write background.ts — service worker

**Files:**
- Create: `extension/src/background.ts`

background.ts is the service worker. Both the toolbar click and keyboard command call the same `convert()` function. It handles restricted pages, injection errors, and missing results gracefully via Chrome notifications.

- [ ] **Step 1: Create `extension/src/background.ts`**

```typescript
interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
  frontmatter: object;
}

function showNotification(message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Defuddle',
    message,
  });
}

async function convert(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;

  // executeScript cannot access these URL schemes (spec lists file:// as restricted too)
  const restricted = /^(chrome|about|file|moz-extension|chrome-extension|devtools):/.test(tab.url);
  if (restricted) {
    showNotification("Can't convert this page.");
    return;
  }

  let result: ConversionResult | undefined;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    result = results[0]?.result as ConversionResult | undefined;
  } catch {
    showNotification("Can't convert this page.");
    return;
  }

  if (!result) {
    showNotification('Conversion failed — no content extracted.');
    return;
  }

  const key = crypto.randomUUID();
  await chrome.storage.session.set({ [key]: result });
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`output.html?key=${key}`),
  });
}

chrome.action.onClicked.addListener(() => { convert(); });
chrome.commands.onCommand.addListener((command) => {
  if (command === 'convert') convert();
});
```

- [ ] **Step 2: Build only background.js and verify it is created**

```bash
npx esbuild extension/src/background.ts --bundle --format=iife --outfile=extension/background.js
```

Expected: `extension/background.js` created, no errors.

- [ ] **Step 3: Commit source only**

```bash
git add extension/src/background.ts
git commit -m "feat: add background service worker with action and command triggers"
```

---

### Task 5: Manual smoke test — load extension and verify conversion runs

This is the first end-to-end test before the output tab is built.

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked" → select the `extension/` directory

Expected: Extension card appears. No errors shown in the card.

- [ ] **Step 2: Navigate to an article page**

Go to `https://en.wikipedia.org/wiki/Markdown`

- [ ] **Step 3: Click the Defuddle toolbar icon**

Expected: A new tab opens at `chrome-extension://.../output.html?key=<uuid>`. The page is mostly blank (output.js not yet built — that's expected at this stage).

- [ ] **Step 4: Verify storage contains the result**

In DevTools on the output tab → Console:

```js
chrome.storage.session.get(null, r => console.log(JSON.stringify(Object.values(r)[0], null, 2)))
```

Expected: A JSON object with `title`, `url`, `markdown` (containing YAML frontmatter + Markdown body), and `frontmatter`.

- [ ] **Step 5: Test restricted page**

Navigate to `chrome://settings`, click the toolbar icon.

Expected: A Chrome notification appears saying "Can't convert this page."

- [ ] **Step 6: Test keyboard shortcut**

Navigate to any article, press `Ctrl+Shift+D` (Windows/Linux) or `MacCtrl+Shift+D` (Mac).

Expected: Same behavior as clicking the icon.

---

## Chunk 3: Output Tab + Finishing

### Task 6: Write output.ts — result rendering

**Files:**
- Create: `extension/src/output.ts`

output.ts reads the result from `chrome.storage.session` using the UUID key from the URL query param, renders it as plain text (no HTML parsing), and wires up the copy button.

- [ ] **Step 1: Create `extension/src/output.ts`**

```typescript
interface ConversionResult {
  title: string;
  url: string;
  markdown: string;
}

function showError(container: HTMLElement, message: string): void {
  // Use safe DOM construction — no innerHTML with user content
  container.textContent = '';

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-state';

  const title = document.createElement('p');
  title.className = 'error-title';
  title.textContent = 'Something went wrong';

  const msg = document.createElement('p');
  msg.className = 'error-msg';
  msg.textContent = message;

  errorDiv.appendChild(title);
  errorDiv.appendChild(msg);
  container.appendChild(errorDiv);
}

async function init(): Promise<void> {
  const container = document.getElementById('container') as HTMLElement;
  const outputEl = document.getElementById('output') as HTMLPreElement;
  const sourceUrlEl = document.getElementById('sourceUrl') as HTMLDivElement;
  const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;

  const key = new URLSearchParams(location.search).get('key');

  if (!key) {
    showError(container, 'No conversion key found in URL. Try converting again.');
    return;
  }

  const stored = await chrome.storage.session.get(key);
  const result = stored[key] as ConversionResult | undefined;

  if (!result) {
    showError(container, 'Conversion result not found. It may have expired — try converting again.');
    return;
  }

  document.title = `${result.title} — Defuddle`;
  sourceUrlEl.textContent = result.url;
  outputEl.textContent = result.markdown;

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(result.markdown);
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy Markdown';
      copyBtn.classList.remove('copied');
    }, 2000);
  });
}

init();
```

- [ ] **Step 2: Run a full build for the first time (all three source files now exist)**

```bash
npm run build:ext
```

Expected: `extension/content.js`, `extension/background.js`, and `extension/output.js` all created with no errors.

- [ ] **Step 3: Reload extension in Chrome**

Go to `chrome://extensions`, click the refresh icon on the Defuddle card.

- [ ] **Step 4: Full end-to-end test**

1. Navigate to `https://en.wikipedia.org/wiki/Markdown`
2. Click the toolbar icon
3. Expected: New tab opens with YAML frontmatter block followed by raw Markdown, monospace font, dark background
4. Verify the source URL shown matches the article URL
5. Click "Copy Markdown" → paste into a text editor to verify content
6. Confirm "Copied!" feedback appears and resets after 2 seconds

- [ ] **Step 5: Test error state**

Open `output.html` directly without query params: go to `chrome-extension://<your-id>/output.html`

Expected: Error message rendered via DOM (no garbled content).

- [ ] **Step 6: Commit source only**

```bash
git add extension/src/output.ts
git commit -m "feat: add output tab rendering with copy button and error state"
```

---

### Task 7: Replace placeholder icons

**Files:**
- Modify: `extension/icons/icon16.png`
- Modify: `extension/icons/icon48.png`
- Modify: `extension/icons/icon128.png`

- [ ] **Step 1: Create proper icons**

Option A — If you have design tools, create 16×16, 48×48, and 128×128 PNG icons matching the extension's indigo (`#818cf8`) color scheme and save them to `extension/icons/`.

Option B — Generate simple but properly-sized icons using node:

```bash
node -e "
const fs = require('fs');
// Create minimal but valid PNG files at correct dimensions
// This uses a simple pure-node PNG encoder for a solid indigo square

function makePNG(size) {
  // PNG signature
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  // compression, filter, interlace = 0

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (const b of buf) {
      crc ^= b;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.concat([t, data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, t, data, c]);
  }

  // Raw image data: size rows of (filter byte + size * RGB)
  // Color: #818cf8 = rgb(129, 140, 248)
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) { row[1+x*3]=129; row[2+x*3]=140; row[3+x*3]=248; }
  const rows = Buffer.concat(Array.from({length: size}, () => row));

  const zlib = require('zlib');
  const idat = zlib.deflateSync(rows);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

fs.writeFileSync('extension/icons/icon16.png', makePNG(16));
fs.writeFileSync('extension/icons/icon48.png', makePNG(48));
fs.writeFileSync('extension/icons/icon128.png', makePNG(128));
console.log('Icons created');
"
```

- [ ] **Step 2: Reload the extension and verify the icon appears in the toolbar**

Go to `chrome://extensions`, reload Defuddle. The toolbar should show the indigo icon.

- [ ] **Step 3: Commit**

```bash
git add extension/icons/
git commit -m "chore: replace placeholder icons with proper sized PNGs"
```

---

### Task 9: Update .gitignore and README

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Add generated files to .gitignore**

Add to `.gitignore`:

```
# Extension build output (generated by npm run build:ext)
extension/content.js
extension/background.js
extension/output.js

# Visual companion brainstorm files
.superpowers/
```

The generated `.js` files were never committed (Tasks 3, 4, 6 only committed the `.ts` source files), so no `git rm --cached` is needed.

- [ ] **Step 2: Add extension section to README.md**

Add after the existing "Local Development" section:

```markdown
## Browser Extension

A companion browser extension converts the current tab to Markdown using your existing browser session — works on any site including those protected by bot detection or login walls.

**Supports:** Chrome (MV3) and Firefox 132+

### Build

```bash
npm run build:ext
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` directory

### Load in Firefox

1. Open `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on** → select `extension/manifest.json`

### Usage

Click the **Defuddle toolbar icon** or press **Ctrl+Shift+D** (Mac: **MacCtrl+Shift+D**). A new tab opens with the page as Markdown plus a copy button.
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: add extension build instructions and update .gitignore"
```

---

### Task 10: Firefox compatibility test

- [ ] **Step 1: Build the extension**

```bash
npm run build:ext
```

- [ ] **Step 2: Load in Firefox 132+**

1. Open `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on** → select `extension/manifest.json`

Expected: Extension loads. Check the Firefox console in `about:debugging` for errors.

- [ ] **Step 3: Full conversion test in Firefox**

1. Navigate to any article (e.g., `https://en.wikipedia.org/wiki/Markdown`)
2. Click the toolbar icon
3. Expected: New tab opens with the Markdown output, same behavior as Chrome

- [ ] **Step 4: Keyboard shortcut test in Firefox**

Press `Ctrl+Shift+D`. Expected: Conversion triggers normally.

Note: If the shortcut conflicts on the user's system, it can be remapped at `about:addons` → Extensions → Defuddle → three-dot menu → Manage Extension Shortcuts.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: browser extension complete — Chrome + Firefox MV3"
```
