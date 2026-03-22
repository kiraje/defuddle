# Firefox Signing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable permanent Firefox installation by signing the extension as an AMO unlisted add-on.

**Architecture:** Four file changes — add a gecko ID to the manifest, add `web-ext` and a `sign` script to package.json, exclude the artifacts directory from git, and document the signing flow in the README. No extension logic changes.

**Tech Stack:** `web-ext` (Mozilla CLI), AMO unlisted channel, esbuild (existing build)

---

## Chunk 1: All Changes

### Task 1: Add gecko ID to manifest

**Files:**
- Modify: `extension/manifest.json`

- [ ] **Step 1: Add `browser_specific_settings` to manifest.json**

Open `extension/manifest.json` and add the following block at the top level (after `"icons"`):

```json
"browser_specific_settings": {
  "gecko": {
    "id": "{a3e4f5b2-1c7d-4e8a-9f0b-2d6c8e1a4b7f}",
    "strict_min_version": "132.0"
  }
}
```

Full resulting `manifest.json`:

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
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "{a3e4f5b2-1c7d-4e8a-9f0b-2d6c8e1a4b7f}",
      "strict_min_version": "132.0"
    }
  }
}
```

- [ ] **Step 2: Verify with web-ext lint (after Task 2 installs web-ext)**

Skip for now — run after Task 2.

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "feat: add Firefox gecko ID and strict_min_version to manifest"
```

---

### Task 2: Add web-ext and sign script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install web-ext**

```bash
npm install --save-dev web-ext
```

- [ ] **Step 2: Add sign script to package.json**

In `package.json`, add `"sign"` to the `"scripts"` block:

```json
"scripts": {
  "build": "esbuild extension/src/content.ts --bundle --format=iife --footer:js=\"window.__defuddleResult\" --outfile=extension/content.js && esbuild extension/src/background.ts --bundle --format=iife --outfile=extension/background.js && esbuild extension/src/output.ts --bundle --format=iife --outfile=extension/output.js",
  "sign": "npm run build && web-ext sign --channel=unlisted --source-dir=extension"
}
```

- [ ] **Step 3: Verify lint passes**

```bash
npx web-ext lint --source-dir=extension
```

Expected: no errors. Warnings are acceptable — errors are not. Expected warnings include icon size notices and a `notifications` permission warning (Firefox handles it differently from Chrome; it does not block AMO signing).

- [ ] **Step 4: Verify build still works**

```bash
npm run build
```

Expected: three output files built successfully (same output as before).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add web-ext and sign script for Firefox AMO unlisted signing"
```

---

### Task 3: Gitignore web-ext-artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add web-ext-artifacts/ to .gitignore**

At the end of `.gitignore`, add:

```
# web-ext signed artifacts
web-ext-artifacts/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore web-ext-artifacts output directory"
```

---

### Task 4: Update README with signing instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Signing for Firefox section**

In `README.md`, add a new section after **Load the Extension** and before **Usage**:

```markdown
## Sign for Firefox (Permanent Install)

Firefox requires extensions to be signed by Mozilla for permanent installation. Use Mozilla's AMO unlisted channel to get a signed `.xpi` without a public listing.

### Prerequisites

1. Create a free [Mozilla account](https://accounts.firefox.com/signup)
2. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) → Tools → Manage API Keys
3. Generate a **JWT issuer** (API key) and **JWT secret** (API secret)

### Sign

```bash
WEB_EXT_API_KEY=your_jwt_issuer WEB_EXT_API_SECRET=your_jwt_secret npm run sign
```

This runs the build then submits to AMO. Mozilla auto-signs unlisted extensions in seconds.

The signed `.xpi` is saved to `web-ext-artifacts/`. Install it by dragging it into Firefox or via `about:addons` → gear icon → Install Add-on From File.

> **Note:** Never commit your API key or secret. Pass them as environment variables or store in a local `.env` file that is gitignored.
```

- [ ] **Step 2: Verify README renders correctly**

Read through the updated README and confirm the new section flows naturally after the load instructions.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Firefox signing instructions to README"
```

---

### Task 5: Push

- [ ] **Push all commits**

```bash
git push
```
