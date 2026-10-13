# RuTracker Visual Enhancer 1.1.0 — Complete Feature List

RuTracker Visual Enhancer is a lightweight Manifest V3 extension that improves browsing and filtering on supported tracker result pages while preserving the original website and its links.

## Visual browsing

- Reversible **Visual view** and **Simple view** modes.
- Dedicated poster column that prevents long titles from wrapping around images.
- Three poster sizes: **S**, **M**, and **L**.
- CSS-only poster enlargement on hover.
- Poster clicks open the original topic, matching the title link.
- Poster selection prioritizes the topic's primary right-aligned cover.
- Older topics that link their images over plain `http` are upgraded to `https`, so their posters still appear; images from hosts that no longer exist are hidden instead of showing a broken image.
- When several images exist, portrait ratio, dimensions, area, and document order are used to select the most likely poster.
- Accessible poster alternative text derived from the topic title.
- Short topic summaries displayed directly in the result table when a reliable description is available.

## Download actions

- Dedicated compact Download column in Visual view.
- Direct `.torrent` action reuses the download link already provided by the result row.
- Magnet action opens the original topic `magnet:` URI and invokes the user's associated torrent client.
- Magnet data is extracted from the same lazily loaded topic page used for the poster and summary, with no additional request.
- Actions are added to initial results and every page appended by infinite scrolling.
- Download controls are removed completely when returning to Simple view.
- All labels, loading states, unavailable states, titles, and accessible names are localized.

## Result metadata

- Consistent author cards for every result, enhanced with avatar, rank, membership age, and message count when the topic provides them.
- Author details reuse the same lazy topic request and local cache as the poster, summary, and magnet link.
- Unified Added date/time card and a vertically centered, localized torrent download count with correct singular/plural wording.
- Automatic extraction of release years.
- Resolution tags including 4K, UHD, 2160p, 1080p, and 720p.
- Source tags including WEB-DL, WEBRip, Blu-ray, BDRip, HDTV, and IPTV.
- Codec and video tags including AV1, HEVC, H.265, H.264, HDR10, and Dolby Vision.
- Language tags including RUS, ENG, ESP, LAT, JPN, UKR, ITA, FRE, GER, and MULTI.
- Seed availability labels: **Highly available**, **Available**, **Low seeds**, and **No seeds**.
- Colored seed indicators in the original seed column.
- Dedicated dark-theme colors for seeders and leechers.

## Local filters

- Accent-insensitive and case-insensitive text filtering.
- **Seeded only** filter.
- One-click filter reset.
- Live visible, loaded, and total result counters.
- Filters apply to the initial page and every page added by infinite scrolling.
- Empty page dividers are hidden automatically while filters are active.

## Infinite scrolling

- Automatically starts loading the next result page near the bottom of the document.
- Persistent **Infinite scroll** switch in the result toolbar, enabled by default.
- Pausing infinite scroll preserves the next pending page so it can resume without resetting the result list.
- Loads one page at a time to avoid request bursts.
- Preserves the tracker's existing result order.
- Avoids duplicate topics when combining pages.
- Displays loaded-result progress in the sticky toolbar.
- Adds a clearly labeled divider between result batches.
- Uses a high-contrast Electric Indigo divider in Light mode.
- Uses a quieter deep-indigo divider with Soft Lilac text in Dark mode.
- Shows loading, completion, restoration, and error states.
- Provides a manual **Retry** button after pagination errors.
- Stops automatically when no next page remains.

## Navigation continuity

- Remembers how many result pages were loaded before opening a topic.
- Restores appended pages after browser back navigation.
- Restores the previous result anchor and vertical offset.
- Falls back to the saved scroll position when the exact anchor is unavailable.
- Navigation state expires after 30 minutes.
- Navigation restoration data remains in the current tab's session storage.

## Search-page controls

- Collapsible advanced tracker search form.
- Persistent **Show search** and **Hide search** preference.
- Early collapse state application to reduce layout movement during loading.
- Sticky local-filter toolbar on desktop result pages.
- Result-table headers follow the selected extension language and return to the site's original labels in Simple view.
- The site's own column sorting keeps working in Visual view, including rows added by infinite scrolling; page dividers hide while a column is sorted.
- Poster-size and theme controls dock into the result toolbar when Visual view is active.
- `Escape` returns the page to Simple view.
- Compact **Columns** menu for showing or hiding Forum, Poster, Topic, Download, Author, Size, Seeds, Leeches, Completed, and Added columns.
- Persistent **Infinite scroll** switch beside the filters.
- Column preferences persist locally and apply to all pages appended by infinite scrolling.
- Original table columns and injected visual columns return when their checkboxes are re-enabled.
- Simple view removes the custom visibility styling and restores the site's original table.

## Light and Dark themes

- Explicit **Light** and **Dark** theme controls.
- Full-site Dark theme for result pages, forums, home pages, and topic pages.
- Readable Dark theme contrast for spoiler headers, author details, seed and leech counts, status icons, and colors that release authors chose for a white page (each lightened in its own hue).
- Early theme bootstrap at `document_start` to reduce white flashes.
- Improved contrast for links, form controls, selected states, table headers, descriptions, seeders, and leechers.
- Electric Indigo (`#5B3DF5`) and Soft Lilac (`#E8DEFF`) design system.
- Dark-mode color variants designed to remain consistent without excessive brightness.
- Native system font stack with no remote font downloads.
- Respects the operating system's reduced-motion preference.

## Advertising and layout cleanup

- Visually hides known tracker advertising containers.
- Reclaims layout space occupied by hidden side and top advertisements.
- Does not intercept, redirect, or modify network requests.
- Does not alter torrent links or download behavior.

## Performance

- Loads topic data only for rows near the viewport.
- Immediately prepares only the first few visible results.
- Uses `IntersectionObserver` with controlled preloading distance.
- Limits topic processing to four concurrent tasks.
- Checks at most three poster candidates per topic, reuses declared dimensions, and cancels timed-out image probes.
- Uses native lazy image loading and asynchronous image decoding.
- Removes poster image data from memory several screens away.
- Restores unloaded images when the user approaches them again.
- Debounces text filtering to avoid excessive table updates.
- Uses passive scrolling and `requestAnimationFrame` for pagination checks.
- Runs cache maintenance during browser idle time when available.
- Uses no JavaScript framework, external API, or remote font. The only background code is a small event-driven service worker for the toolbar icon badge.
- Topic and page requests time out after 15 seconds, so a stalled request never blocks the rest of the loading queue.

## Local cache

- Seven-day cache for poster URLs, short summaries, download metadata, and compact author details.
- Maximum of 300 cached topic entries.
- Automatic removal of expired entries.
- Automatic removal of legacy cache entries.
- Daily maintenance limit to avoid repeated storage scans.
- Rendering and network loading continue if extension storage is unavailable.

## Security and privacy

- HTTPS-only supported-site patterns.
- Same-origin validation for topic and pagination requests.
- HTTPS validation for poster image URLs.
- Imported result rows are stripped of scripts, embedded objects, iframes, and inline event handlers.
- Uses safe DOM construction and `textContent`; it does not inject fetched HTML with `innerHTML`.
- Uses no `eval`, dynamic code execution, or remote executable code.
- Uses Chrome `storage` for local preferences and cache. `activeTab` and `scripting` are used only from the popup: to reload the page after a language change, to check whether the current page looks like a compatible tracker, and, after the user grants access to that one site, to register the extension there.
- Access to sites other than RuTracker is never requested at install; it is an optional permission granted per site by the user and can be revoked from the same popup.
- No analytics, telemetry, advertising, affiliate links, or user tracking.
- No data is transmitted to the developer.
- Preferences and cached topic metadata remain in local browser storage.

## Accessibility

- `aria-pressed` state on view, density, and theme buttons.
- Labeled control groups and toolbar region.
- Accessible names for filters and progress information.
- Live announcements for result counts and pagination status.
- Visible keyboard focus indicators.
- Accessible expanded/collapsed state for the advanced search form.
- Reduced-motion support.

## Languages and localization

- Uses the browser interface language by default.
- Falls back to English when the browser language is not supported.
- Optional language override directly from the pinned toolbar icon or the native extension Options page.
- Contextual localized **Reload** button that appears only after the language changes, recognizes every supported HTTPS tracker, and then hides again.
- The compact options popup follows the browser's light or dark scheme, with a flat, browser-native layout and the extension version in its header.
- English interface.
- Ukrainian interface.
- Russian interface.
- Romanian interface.
- Spanish interface.
- Localized extension name and description in Chrome's extension manager and Web Store surfaces.
- Language selection remains in local extension storage and adds no new permission.

## Supported websites

- `rutracker.org` and its subdomains.
- Other trackers built on the same forum engine, enabled per site from the extension popup (**Show posters on …**), which requests access to that site only. They run in posters-only mode (poster inside the title cell; no extra columns, toolbar, theme or cell decorations).

Support is limited to HTTPS pages whose tracker table and topic structure are compatible with RuTracker Visual Enhancer. Topic and pagination requests stay on the origin currently being viewed.

## Browser and package support

- Chrome and Chromium-based browsers, including Brave.
- Manifest V3.
- Minimum Chrome version: 105.
- Extension icons at 16, 32, 48, and 128 pixels.
- Adaptive rounded-square Electric Indigo icon with a simplified three-star mark for 16/32 px and a more detailed 48/128 px treatment.
- No build step is needed to run it: the `extension` folder loads as is. `npm run build` only zips it for the Chrome Web Store.
