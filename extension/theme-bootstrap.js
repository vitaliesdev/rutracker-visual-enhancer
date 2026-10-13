(() => {
  "use strict";

  // Runs at document_start so theme, search-collapse and Visual view state apply
  // before first paint (content.css reserves the toolbar space while data-tl-active
  // is "true" and content.js has not marked the page ready yet).
  // Only RuTracker (and the extension's own popup) get the full interface; other
  // compatible trackers run in posters-only mode and keep their own look.
  const fullSite = location.protocol === "chrome-extension:" || /(^|\.)rutracker\.org$/i.test(location.hostname);
  if (!fullSite) return;

  chrome.storage.local.get(["trackerLensTheme", "trackerLensSearchCollapsed", "trackerLensEnabled", "rutrackerVisualModernEnabled"]).then(settings => {
    const root = document.documentElement;
    root.dataset.tlTheme = settings.trackerLensTheme === "dark" ? "dark" : "light";
    root.dataset.tlSearchCollapsed = String(Boolean(settings.trackerLensSearchCollapsed));
    if (root.dataset.tlReady !== "true") {
      root.dataset.tlActive = String(Boolean(settings.trackerLensEnabled ?? settings.rutrackerVisualModernEnabled));
    }
  }).catch(() => {
    document.documentElement.dataset.tlTheme = "light";
    document.documentElement.dataset.tlSearchCollapsed = "false";
  });
})();
