# Chrome Web Store publishing checklist

Prepared for **RuTracker Visual Enhancer - Posters, Filters & Dark Mode 1.0.0** on 2026-07-13.

## Important policy check before submission

The Store package runs on `rutracker.org` and its subdomains; other compatible trackers are added only when the user grants access to them from the popup. It exposes the original `.torrent` and Magnet links already present on RuTracker.

Chrome Web Store policy prohibits products that facilitate unauthorized access to copyrighted content. Describe the extension as a visual and navigation enhancement, disclose its download actions to reviewers, describe only lawful uses, and do not claim affiliation with RuTracker.

## Account requirements

- [ ] Google Account with **2-Step Verification** enabled.
- [ ] Chrome Web Store developer registration completed.
- [ ] One-time developer registration fee paid.
- [ ] Publisher name chosen.
- [ ] Contact email verified in the Developer Dashboard.
- [ ] A monitored support email available.
- [ ] Physical address supplied only if the item offers paid functionality, purchases, or subscriptions.

## Package

- [x] Manifest V3.
- [x] Version `1.0.0`.
- [x] Store ZIP contains `manifest.json` at its root.
- [x] No remotely hosted executable code.
- [x] No development-only Markdown or SVG files in the ZIP.
- [x] Minimal declared API permissions: `storage` and `activeTab`.
- [ ] Load the exact final ZIP unpacked once in Chrome and complete the manual smoke test below.

Package: `../rutracker-visual-enhancer.zip`

## Store Listing tab

- [ ] Use the exact extension name already present in the manifest.
- [ ] Recommended primary category: **Productivity**.
- [ ] Add the detailed English description from `STORE-LISTING.md`.
- [ ] Add localized descriptions for Ukrainian, Russian, Romanian, and Spanish.
- [ ] Upload `assets/store-icon-128.png`.
- [ ] Upload between 1 and 5 real screenshots at exactly 1280x800 or 640x400.
- [ ] Upload `assets/small-promo-440x280.png`.
- [ ] Optionally upload `assets/marquee-1400x560.png`.
- [ ] Add a homepage URL that hosts the `docs/` folder (GitHub Pages).
- [ ] Add a support URL, or enable the Chrome Web Store Support hub.

## Privacy tab

- [ ] Paste the single-purpose statement from `PRIVACY-DASHBOARD.md`.
- [ ] Paste each permission and host-access justification.
- [ ] Select **No, I am not using remote code**.
- [ ] Disclose locally processed website content and browsing/navigation data conservatively as described in `PRIVACY-DASHBOARD.md`.
- [ ] Complete every Limited Use certification.
- [ ] Host `docs/privacy.html` publicly and paste its HTTPS URL into the privacy-policy field.

## Distribution tab

- [ ] Set the item to **Free**.
- [ ] Choose **Public** only after testing; use trusted testers first if desired.
- [ ] Select countries/regions. The default is worldwide distribution.

## Test instructions tab

- [ ] Paste `REVIEWER-NOTES.md`.
- [ ] If tracker search requires an account during review, provide a dedicated non-personal test account in the protected credentials fields. Never place credentials in the public description or privacy policy.

## Final manual smoke test

1. Remove or disable the development copy of the extension.
2. Extract the exact Store ZIP to an empty folder and load it through `chrome://extensions` → **Load unpacked**.
3. Open a supported tracker result page.
4. Verify Visual view on/off, Light/Dark, S/M/L poster sizes, column visibility, local filter, infinite scroll, search-panel collapse, `.torrent`, Magnet, author cards, and localized headers.
5. Change the popup language, reload, and verify the new language.
6. Test one topic without a poster and one without a Magnet link.
7. Confirm the browser console has no uncaught errors.
8. Capture the final Store screenshots from this exact build.

## What cannot be generated locally

The following require your identity or an externally hosted service:

- Developer registration and fee payment.
- Publisher name and verified contact email.
- Public HTTPS URLs for the generated website/privacy/support pages.
- Reviewer credentials if the site requires login.
- Final screenshots captured from the exact installed build in your Chrome profile.
