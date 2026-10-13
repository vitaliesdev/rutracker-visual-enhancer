# RuTracker Visual Enhancer - Posters, Filters & Dark Mode

A lightweight visual search enhancer for supported torrent tracker result pages.

## Repository layout

| Folder | What it is |
| --- | --- |
| `extension/` | The extension source. This is the **only** editable copy and matches what is published on the Chrome Web Store (Manifest V3, v1.0.0). |
| `store/` | Chrome Web Store publishing kit: listing copy, screenshots, promo assets, and reviewer notes. |
| `docs/` | The GitHub Pages site (home, privacy, support), published from `main` → `/docs`. |

## Development & publishing

**Easiest way (Windows):** double-click **`release.cmd`**. It installs dependencies the first time, lints, bumps the patch version, and packages the zip into `dist/` — no typing required. Then upload the zip from `dist/` in the Chrome Web Store dashboard and `git commit`.

Prefer the terminal, or need a `minor`/`major` bump? Use the scripts directly (one-time setup: `npm install`):

| Command | What it does |
| --- | --- |
| `npm run lint` | Lints `extension/` and `scripts/` with ESLint. |
| `npm run bump -- patch\|minor\|major` | Bumps the version in `extension/manifest.json` and `package.json` (default: `patch`). Accepts an explicit `X.Y.Z` too. |
| `npm run build` | Packages the **contents** of `extension/` into `dist/rutracker-visual-enhancer-v<version>.zip`, ready to upload. |

Typical upgrade flow: edit under `extension/` → `npm run lint` → `npm run bump -- patch` → `npm run build` → upload the zip from `dist/` in the Chrome Web Store dashboard → `git commit`.

`dist/`, `node_modules/`, and any `*.zip`/`*.7z` are gitignored.

## Features

- Manifest V3 support for Chrome and Brave.
- Reversible visual mode with compact, medium, and large poster sizes.
- Poster clicks open the original topic, plus a compact Download column for `.torrent` and magnet actions.
- Persistent Columns menu for showing or hiding the main result-table columns.
- Compact author cards reuse the topic avatar, rank, membership age, and message count; Added dates use a clearer two-level layout.
- Posters and topic summaries loaded only near the viewport.
- Maximum of four simultaneous topic requests.
- Seven-day local cache with automatic expiry and size limits.
- Local filters for title text and seeded torrents.
- Optional one-page-at-a-time infinite scrolling, controlled from the result toolbar and remembered locally.
- Loaded/visible/total counters, batch dividers, progress line, and manual retry on pagination errors.
- Back-navigation restoration for loaded pages and the previous result position.
- Poster memory protection that unloads images several screens away and restores them on approach.
- Persistent Show/Hide control for the advanced tracker search form.
- Accent-insensitive search.
- Filters remain accurate across every page appended by infinite scrolling.
- Technical tags and availability indicators.
- Sticky desktop header and CSS-only poster zoom.
- Persistent Light/Dark theme for complete supported websites, including forums and topic pages.
- Consistent Electric Indigo and Soft Lilac design system in Light and Dark modes, using only local system fonts and lightweight CSS.
- High-contrast colored result-batch dividers for infinite scrolling.
- Early theme bootstrap at `document_start` to prevent the white-to-dark loading flash.
- Visual removal of known site advertising containers and reclaimed layout space.
- No analytics, advertisements, remote code, or external APIs.
- HTTPS-only navigation with same-origin pagination and sanitized appended rows.
- Automatic browser-language detection with optional language override in extension Options.
- Complete interface localization in English, Ukrainian, Russian, Romanian, and Spanish.
- Result-table headers follow the selected interface language and revert to the site's originals in Simple view.
- Adaptive rounded-square Indigo/Lilac icon artwork optimized separately for small toolbar sizes.

## Local installation

1. Open `chrome://extensions` or `brave://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this directory.

The extension runs only on the tracker domains declared in `manifest.json`. Press `Escape` or use the floating toggle to restore the original table.

## Interface language

The interface follows the browser UI language by default. Click the pinned extension icon to open the language selector, or use **Extension options** from the extension's **Details** page. Supported interface languages are English, Ukrainian, Russian, Romanian, and Spanish. Unsupported browser languages fall back to English. The compact **Reload** button appears only after the current panel changes the language. It refreshes an active HTTPS page on RuTracker or another supported tracker and disappears again after use. A normal browser reload applies the saved language as well. The popup follows the browser's own light or dark scheme; the extension's Light/Dark setting applies to RuTracker pages only.

## Supporting the project

The popup footer always shows three links: **Rate** (the extension's Chrome Web Store reviews), **Feedback** (the support page) and **Ko-fi**. They open only after a click; opening the popup contacts no one and loads no remote assets.

A one-line note with the same three links appears occasionally, at the end of the RuTracker filter toolbar and at the top of the popup, with a small dot on the toolbar icon:

- only after 7 days of use **and** 30 result pages opened in Visual view;
- never on the day's first search;
- dismissing it (✕) hides it for 60 days; after 3 dismissals, or once any of its links is used, it never returns.

The counters behind these rules stay in `chrome.storage.local`. A minimal, event-driven service worker (`background.js`) only records the install date and sets or clears the icon dot, because content scripts cannot change the toolbar icon.

## Supported sites

- `rutracker.org` and its subdomains
- Other trackers built on the same forum engine, **on request**. On such a site, click the extension icon and choose **Show posters on this site**: Chrome asks for access to that site only, and the extension then registers itself there permanently (turn it off from the same popup). No other site is declared in the manifest. These sites run in a **posters-only** mode: the poster is shown inside the title cell (no extra columns, toolbar, theme or cell decorations), so the site's own layout and column sorting stay untouched.

Only HTTPS pages are supported. Pagination and topic requests remain on the origin currently being viewed, while poster images may load from HTTPS image hosts referenced by that topic.
