# Reviewer test instructions

## Overview

RuTracker Visual Enhancer has one purpose: improve the readability and navigation of supported tracker result pages. It does not provide a search index, host files, bypass authentication, circumvent access controls, or execute remote code.

## Test flow

1. Install the extension and open `https://rutracker.org/forum/tracker.php`.
2. If the site requires authentication for search results, use the dedicated reviewer credentials supplied separately in the Chrome Web Store protected credentials fields.
3. Run a normal tracker search so that the result table with id `tor-tbl` is visible.
4. Confirm that the toolbar appears above the table and that Visual view is enabled according to the saved preference.
5. Verify posters, compact summaries, availability badges, localized headers, author/date cards, and the Download column.
6. Toggle Visual view to confirm that the original table can be restored.
7. Test Light/Dark, S/M/L poster sizes, column visibility, the local text filter, Seeded only, and Infinite scroll.
8. Click the extension icon, change the interface language, and use Reload. The reload button is contextual and appears only after a language change.
9. Click a column header (for example Size) in Visual view: rows sort as on the original site, including rows added by infinite scrolling.

## Network and data behavior

- Topic details are fetched only from the same tracker origin using the user's existing browser session.
- External poster/avatar images may be shown when they are embedded by the tracker page.
- `.torrent` and Magnet buttons open the original links already supplied by the tracker; the extension does not create, proxy, or modify them.
- Preferences and a bounded seven-day metadata cache remain in `chrome.storage.local`.
- No data is sent to the developer. There is no analytics, advertising SDK, or remote executable code.
- `background.js` is a minimal event-driven service worker: it records the install date in `chrome.storage.local` and sets or clears a small dot badge on the toolbar icon when asked by the content script or popup. It makes no network requests.
- The popup footer links to the Chrome Web Store reviews, the support page and Ko-fi; they open only after an explicit click.
- An occasional, dismissible note with the same three links appears at the end of the RuTracker filter toolbar and the top of the popup, only after 7 days of use and 30 Visual view searches, never on the day's first search, at most once per 60 days, and never again after 3 dismissals or one click. The counters stay in `chrome.storage.local`.

## Supported hosts in the submitted manifest

- `rutracker.org` and subdomains

## Optional per-site access

On any other HTTPS page that looks like a tracker built on the same forum engine, the popup offers **Show posters on [site name]**. Clicking it calls `chrome.permissions.request` for that single origin; if granted, the popup registers the packaged `content.js`/`content.css` for that origin with `chrome.scripting.registerContentScripts` and reloads the tab. On those sites only posters are added. **Turn off on this site** unregisters the script and removes the permission. No host beyond RuTracker is granted at install time.
