"use strict";

// Minimal, event-driven worker. Content scripts cannot touch the toolbar icon,
// so they ask here to show or clear the small "support the project" badge dot.
// It also records the install date the support nudge waits on.

const BADGE_COLOR = "#FF5E5B";

chrome.runtime.onInstalled.addListener(async () => {
  const { rveInstalledAt } = await chrome.storage.local.get("rveInstalledAt");
  if (!rveInstalledAt) await chrome.storage.local.set({ rveInstalledAt: Date.now() });
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== "rve:support-badge") return;
  if (message.show) {
    void chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    void chrome.action.setBadgeText({ text: " " });
  } else {
    void chrome.action.setBadgeText({ text: "" });
  }
});
