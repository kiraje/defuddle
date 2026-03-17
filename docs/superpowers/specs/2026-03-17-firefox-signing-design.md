# Firefox Extension Signing Design

## Overview

Enable permanent installation of the Defuddle extension in regular Firefox by signing it as an unlisted add-on via Mozilla's AMO (addons.mozilla.org). Unlisted extensions are signed by Mozilla automatically (no human review queue) and distributed as a `.xpi` file.

## Goals

- Permanent Firefox install without reloading after each restart
- No public AMO listing required
- No changes to extension behavior or code

## Non-Goals

- Public AMO listing (future option)
- Firefox Developer Edition workarounds
- Chrome signing (Chrome handles this via the Web Store)

## Changes

### `extension/manifest.json`

Add `browser_specific_settings` with a gecko ID and minimum Firefox version:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "defuddle@kiraje",
    "strict_min_version": "132.0"
  }
}
```

- `id` — required by Mozilla to sign any extension. Email-like format, does not need to be a real domain.
- `strict_min_version: "132.0"` — enforces the minimum version required for `chrome.storage.session`.

### `package.json`

Add `web-ext` as a dev dependency and a `sign` script:

```json
"sign": "web-ext sign --channel=unlisted --source-dir=extension"
```

`web-ext` is Mozilla's official CLI for building, linting, and signing extensions.

### `README.md`

Add a **Signing for Firefox** section documenting:

1. How to get AMO API credentials (addons.mozilla.org/developers → API Keys)
2. How to run `npm run sign` with credentials via env vars
3. How to install the output `.xpi` in Firefox

## Signing Flow

```
WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=... npm run sign
        ↓
web-ext submits extension/  to AMO unlisted channel
        ↓
Mozilla auto-signs (seconds, no human review)
        ↓
web-ext-artifacts/defuddle-1.0.0.xpi downloaded locally
        ↓
Drag .xpi into Firefox → permanent install
```

## Credentials

Required: Mozilla account + AMO API credentials (free).

- Generate at: addons.mozilla.org/developers → Tools → Manage API Keys
- Pass as env vars: `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`
- Never commit credentials to the repo

## Files Changed

| File | Change |
|------|--------|
| `extension/manifest.json` | Add `browser_specific_settings` |
| `package.json` | Add `web-ext` dev dep + `sign` script |
| `README.md` | Add signing instructions |
