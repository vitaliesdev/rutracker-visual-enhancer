(() => {
  "use strict";

  // Shared by the popup, the RuTracker content script and the service worker:
  // when the "support the project" nudge is due, where its links go, and its icons.
  // Everything stays in chrome.storage.local; nothing is sent anywhere.

  const DAY = 24 * 60 * 60 * 1000;
  const KEYS = Object.freeze({
    installedAt: "rveInstalledAt",
    searches: "rveVisualSearches",
    lastSearchDay: "rveLastSearchDay",
    nudge: "rveSupportNudge"
  });
  // Shown only to people who clearly use the extension, rarely, and never again
  // once they have acted on it or dismissed it a few times.
  const RULES = Object.freeze({ minDays: 7, minSearches: 30, snoozeDays: 60, maxDismissals: 3 });

  const FEEDBACK_URL = "https://vitaliesdev.github.io/rutracker-visual-enhancer/support.html";
  const KOFI_URL = "https://ko-fi.com/P5N4235C36";

  function reviewUrl() {
    return `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
  }

  function isDue(settings, now = Date.now()) {
    const nudge = settings[KEYS.nudge] || {};
    if (nudge.done || (nudge.dismissals || 0) >= RULES.maxDismissals) return false;
    const installedAt = Number(settings[KEYS.installedAt] || now);
    if (now - installedAt < RULES.minDays * DAY) return false;
    if (Number(settings[KEYS.searches] || 0) < RULES.minSearches) return false;
    return !nudge.dismissedAt || now - nudge.dismissedAt >= RULES.snoozeDays * DAY;
  }

  function load() {
    return chrome.storage.local.get(Object.values(KEYS));
  }

  async function updateNudge(change) {
    const stored = (await chrome.storage.local.get(KEYS.nudge))[KEYS.nudge] || {};
    await chrome.storage.local.set({ [KEYS.nudge]: { ...stored, ...change(stored) } });
  }

  // The user rated, left feedback or visited Ko-fi: never ask again.
  const complete = () => updateNudge(() => ({ done: true }));
  const dismiss = () => updateNudge(stored => ({ dismissals: (stored.dismissals || 0) + 1, dismissedAt: Date.now() }));

  // Duotone icons drawn for this extension (no emoji, no image files).
  const ICONS = Object.freeze({
    star: [
      { d: "M12 2.9l2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.93l-5.5 2.89 1.05-6.12L3.1 9.37l6.15-.9z", fill: "#FFC21A", stroke: "#F0A500", width: 1.4 },
      { d: "M8.6 9.9l2.2-.32", stroke: "#FFE38A", width: 1.4 }
    ],
    chat: [
      { d: "M6 4h12a2.5 2.5 0 0 1 2.5 2.5v7.5a2.5 2.5 0 0 1-2.5 2.5h-6l-4.3 3.6c-.4.35-1 .06-1-.47V16.5H6A2.5 2.5 0 0 1 3.5 14V6.5A2.5 2.5 0 0 1 6 4z", fill: "#2EA8F0", stroke: "#1B8AD3", width: 1.2 },
      { d: "M8 9h8M8 12h5", stroke: "#FFFFFF", width: 1.8 }
    ],
    coffee: [
      { d: "M3.8 9.5h12.4v4.7A5.3 5.3 0 0 1 10.9 19.5H9.1a5.3 5.3 0 0 1-5.3-5.3z", fill: "#FF5E5B", stroke: "#E8433F", width: 1.2 },
      { d: "M16.2 11h1.4a2.6 2.6 0 0 1 0 5.2h-1.9", stroke: "#FF5E5B", width: 1.9 },
      { d: "M10 16.4c-.3-.25-2.2-1.5-2.2-2.8a1.15 1.15 0 0 1 2.2-.45 1.15 1.15 0 0 1 2.2.45c0 1.3-1.9 2.55-2.2 2.8z", fill: "#FFFFFF" },
      { d: "M7.6 3.6c-.75.95.75 1.9 0 2.85M11.4 3.6c-.75.95.75 1.9 0 2.85", stroke: "#FF8A87", width: 1.6 }
    ],
    heart: [
      { d: "M12 20s-7.5-4.6-7.5-10A4.25 4.25 0 0 1 12 7.4 4.25 4.25 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z", fill: "#FF5E5B", stroke: "#E8433F", width: 1.2 }
    ],
    close: [
      { d: "M7 7l10 10M17 7L7 17", stroke: "currentColor", width: 2 }
    ]
  });

  function createIcon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (const part of ICONS[name] || []) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", part.d);
      path.setAttribute("fill", part.fill || "none");
      if (part.stroke) {
        path.setAttribute("stroke", part.stroke);
        path.setAttribute("stroke-width", String(part.width));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
      }
      svg.append(path);
    }
    return svg;
  }

  function setBadge(show) {
    return chrome.runtime.sendMessage({ type: "rve:support-badge", show: Boolean(show) }).catch(() => {});
  }

  globalThis.RVE_SUPPORT = Object.freeze({
    KEYS, isDue, load, complete, dismiss, reviewUrl, FEEDBACK_URL, KOFI_URL, createIcon, setBadge
  });
})();
