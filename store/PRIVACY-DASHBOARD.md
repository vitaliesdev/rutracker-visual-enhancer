# Privacy tab — copy/paste answers

These answers describe version 1.0.0 as currently implemented. Keep the Store dashboard, public privacy policy, listing, and code consistent.

## Single purpose

Enhance the readability, visual presentation, filtering, and navigation of supported tracker result pages by adding posters, summaries, display controls, themes, optional infinite scrolling, and convenient access to the original download links already present on those pages.

## Permission justifications

### `storage`

Stores the user's extension preferences locally, including Visual view state, theme, language, poster size, visible columns, collapsed search state, and infinite-scroll preference. It also stores a bounded, seven-day cache of topic metadata so posters and summaries do not have to be downloaded repeatedly. This data is not sent to the developer.

### `activeTab`

Used only after the user clicks the pinned extension icon and presses Reload. It lets the popup reload the currently active supported tracker tab so a newly selected interface language can be applied. It is not used for background monitoring.

### Host access: `rutracker.org` and subdomains

Required to inject the visual interface into RuTracker pages, read result rows, and request same-origin topic pages for user-visible posters, summaries, author details, and original download links.

### `scripting`

Used only from the extension popup, after the user clicks the extension icon on a non-RuTracker page: (1) to check whether the current page looks like a compatible tracker (a one-time read of the page structure through `activeTab`), and (2) after the user clicks **Show posters on this site** and grants access, to register the extension's own packaged content script for that single site. No remote code is injected.

### Optional host permission: `https://*/*`

Never granted at install. It lets the popup ask, on an explicit user click, for access to the one site the user is viewing (`chrome.permissions.request` for that origin only), so posters can be shown on other trackers built on the same forum engine. The user can revoke it from the same popup or from the browser's extension settings.

## Remote code

Select: **No, I am not using remote code.**

All executable JavaScript and CSS ships inside the extension package. The extension downloads only page content and images needed for its visible features and never evaluates downloaded content as code.

## Data disclosure — conservative recommendation

Because Chrome defines local processing as data handling, disclose the following even though nothing is transmitted to the developer:

- **Website content: Yes.** Result rows and same-origin topic-page content are read to display posters, summaries, author details, availability, and original links.
- **Web history / browsing activity: Yes.** The extension acts on supported tracker URLs and uses topic URLs in a bounded local cache and temporary navigation restoration state.
- **User activity: Yes, local only.** Display preferences, filter choices, column choices, a temporary scroll/navigation position, and a local count of Visual view searches (used only to decide when the occasional support note may appear) are processed or stored locally to provide the interface.

Recommended unchecked categories:

- Personally identifiable information: No.
- Health information: No.
- Financial and payment information: No.
- Authentication information: No. Existing site cookies may accompany same-origin browser requests, but the extension never reads, copies, stores, or transmits credentials or cookies.
- Personal communications: No.
- Location: No.

## Data-use certifications

Certify all of the following because they match the code:

- Data is used only to provide or improve the extension's single purpose.
- Data is not sold or transferred to third parties.
- Data is not used for personalized advertising, creditworthiness, or lending.
- Humans do not read user data.
- The extension has no analytics or developer-operated telemetry.
- All network requests use HTTPS and go directly to the user-selected tracker or to a link the user explicitly opens.

## Privacy policy URL

Host `docs/privacy.html` on a public HTTPS site and paste that final URL into the dashboard. A local file path or repository file without a public rendered URL is not sufficient.
