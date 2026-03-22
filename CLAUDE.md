# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Local dev server at http://localhost:8787
npm test          # Run tests with Vitest (Cloudflare Workers pool)
npm run deploy    # Deploy to Cloudflare Workers via wrangler
npm run cf-typegen  # Regenerate worker-configuration.d.ts from wrangler.jsonc
```

No lint script is configured. Prettier is available via `npx prettier --write`.

## Architecture

**Defuddle** is a Cloudflare Worker that converts web pages and X/Twitter posts to clean Markdown with YAML frontmatter.

### Request Flow

```
Request → src/index.ts (routing + validation)
              ↓
          src/convert.ts
              ├── isXUrl() → fetchTweetData()   [FxTwitter API → rich Markdown]
              └── fetchAndParse()               [HTML → Defuddle → Turndown → Markdown]
              ↓
          formatResponse() → YAML frontmatter + content
```

### Key Files

- **`src/index.ts`** — Entry point. Two endpoints: `POST /api/convert` (JSON body with `url`) and `GET /{url}` (URL in path). Handles CORS, URL validation, content negotiation (markdown vs JSON via `Accept` header).
- **`src/convert.ts`** — All extraction logic. X/Twitter posts go through the [FxTwitter API](https://api.fxtwitter.com) and render tweets, polls, media, quotes, DraftJS articles, and engagement stats. Regular pages use Defuddle for extraction + Turndown for HTML→Markdown.
- **`src/polyfill.ts`** — Bridges browser APIs (`DOMParser`, `window`, `document`, `Node`, `getComputedStyle`) that Defuddle and Turndown expect but don't exist in the Workers runtime. Uses `linkedom` as the DOM implementation.
- **`public/index.html`** — Single-file frontend SPA. Calls `/api/convert`, renders output with `marked` and `prism`.

### Workers Runtime Constraints

- Requires `nodejs_compat` compatibility flag (needed by `linkedom`)
- `compatibility_date: 2026-03-01` in `wrangler.jsonc`
- Max 5MB page size enforced in `fetchAndParse()`
- Localhost URLs are blocked

### Code Style

- Tabs for indentation, single quotes, semicolons, 140 char line width (`.prettierrc`)
- Strict TypeScript, `es2024` target, `Bundler` module resolution
- Tests use `@cloudflare/vitest-pool-workers` — tests run inside the actual Workers runtime
