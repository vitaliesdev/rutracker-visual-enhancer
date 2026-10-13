(() => {
  "use strict";

  const STORAGE_KEY = "rveLanguage";
  const SUPPORTED = new Set(["en", "uk", "ru", "ro", "es"]);
  const LANGUAGE_NAMES = {
    en: "English",
    uk: "Українська",
    ru: "Русский",
    ro: "Română",
    es: "Español"
  };
  const support = globalThis.RVE_SUPPORT;

  const select = document.getElementById("language-select");
  const status = document.getElementById("save-status");
  const reloadRow = document.getElementById("reload-row");
  const reloadButton = document.getElementById("reload-page");
  const optionsHint = document.getElementById("options-hint");
  const nudge = document.getElementById("support-nudge");
  let appliedSetting = null;

  function browserLanguage() {
    return chrome.i18n.getUILanguage();
  }

  function resolveLanguage(setting) {
    if (SUPPORTED.has(setting)) return setting;
    const detected = browserLanguage().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.has(detected) ? detected : "en";
  }

  // Supported hosts come from the manifest's content script matches, so adding a
  // tracker there is enough for the Reload button to recognize it.
  const SUPPORTED_HOSTS = [...new Set(
    (chrome.runtime.getManifest().content_scripts || [])
      .flatMap(script => script.matches || [])
      .map(pattern => pattern.match(/^https:\/\/(?:\*\.)?([^/]+)\//)?.[1])
      .filter(Boolean)
  )];

  function isSupportedTrackerUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      const host = url.hostname.toLowerCase();
      return SUPPORTED_HOSTS.some(base => host === base || host.endsWith(`.${base}`));
    } catch {
      return false;
    }
  }

  // Opt-in sites: other trackers on the same engine are not declared in the manifest.
  // From the popup, the user grants access to the current site (an optional host
  // permission) and a persistent content script is registered for that origin only.
  const siteSection = document.getElementById("site-section");
  const siteStatus = document.getElementById("site-status");
  const siteToggle = document.getElementById("site-toggle");
  const site = { tabId: 0, origin: "", host: "", enabled: false };

  function siteScriptId(host) {
    return `site:${host}`;
  }

  async function isOptInSiteEnabled(origin, host) {
    if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) return false;
    return (await chrome.scripting.getRegisteredContentScripts({ ids: [siteScriptId(host)] })).length > 0;
  }

  async function looksLikeCompatibleTracker(tabId) {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(
        document.querySelector("#tor-tbl, #tr-form")
        || (document.querySelector('a[href*="viewtopic.php"]') && document.querySelector('a[href*="tracker.php"]'))
      )
    });
    return Boolean(injection?.result);
  }

  async function initSiteSection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || isSupportedTrackerUrl(tab.url)) return;
      const url = new URL(tab.url);
      if (url.protocol !== "https:") return;
      Object.assign(site, { tabId: tab.id, origin: url.origin, host: url.hostname });
      site.enabled = await isOptInSiteEnabled(site.origin, site.host);
      if (!site.enabled && !(await looksLikeCompatibleTracker(tab.id))) return;
      renderSite(resolveLanguage(select.value || appliedSetting || "auto"));
      siteSection.hidden = false;
    } catch {
      // Restricted pages (browser UI, the Web Store) cannot be inspected; keep the section hidden.
    }
  }

  function renderSite(language) {
    if (!site.origin) return;
    document.getElementById("site-heading").textContent = message(language, "siteHeading");
    siteStatus.textContent = site.enabled ? message(language, "siteEnabled", [site.host]) : message(language, "siteCompatible");
    siteToggle.textContent = message(language, site.enabled ? "siteDisable" : "siteEnable", [site.host]);
    siteToggle.classList.toggle("button-primary", !site.enabled);
    siteToggle.classList.toggle("button-quiet", site.enabled);
  }

  siteToggle.addEventListener("click", async () => {
    const language = resolveLanguage(select.value);
    const origins = [`${site.origin}/*`];
    const id = siteScriptId(site.host);
    try {
      if (site.enabled) {
        await chrome.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
        await chrome.permissions.remove({ origins });
      } else {
        // permissions.request must run before any other await so Chrome still sees the click.
        if (!(await chrome.permissions.request({ origins }))) {
          status.textContent = message(language, "siteDenied");
          return;
        }
        await chrome.scripting.unregisterContentScripts({ ids: [id] }).catch(() => {});
        await chrome.scripting.registerContentScripts([{
          id,
          matches: origins,
          css: ["content.css"],
          js: ["runtime-i18n.js", "support.js", "content.js"],
          runAt: "document_end",
          persistAcrossSessions: true
        }]);
      }
      await chrome.tabs.reload(site.tabId);
      window.close();
    } catch {
      status.textContent = message(language, "siteError");
    }
  });

  // Support links (footer, always visible) and the occasional nudge share the same targets.
  const SUPPORT_URLS = { rate: support.reviewUrl(), feedback: support.FEEDBACK_URL, coffee: support.KOFI_URL };
  document.querySelectorAll(".support-action").forEach(link => {
    link.href = SUPPORT_URLS[link.dataset.action];
    link.addEventListener("click", () => {
      void support.complete();
      void support.setBadge(false);
    });
  });
  document.querySelectorAll("[data-icon]").forEach(slot => slot.append(support.createIcon(slot.dataset.icon)));
  const dismissButton = document.getElementById("nudge-dismiss");
  dismissButton.append(support.createIcon("close"));
  dismissButton.addEventListener("click", async () => {
    nudge.hidden = true;
    await support.dismiss().catch(() => {});
    void support.setBadge(false);
  });

  async function initSupportNudge() {
    try {
      nudge.hidden = !support.isDue(await support.load());
    } catch {
      nudge.hidden = true;
    }
  }

  function message(language, key, substitutions = []) {
    let value = globalThis.RVE_I18N?.[language]?.[key] || globalThis.RVE_I18N?.en?.[key] || key;
    substitutions.forEach((substitution, index) => {
      value = value.replaceAll(`$${index + 1}`, String(substitution));
    });
    return value;
  }

  function updateReloadState(setting) {
    reloadRow.hidden = !(appliedSetting !== null && setting !== appliedSetting);
  }

  function render(setting, announce = false) {
    const language = resolveLanguage(setting);
    document.documentElement.lang = language;
    document.title = message(language, "optionsTitle");
    document.getElementById("app-version").textContent = chrome.runtime.getManifest().version;
    document.getElementById("language-label").textContent = message(language, "languageLabel");
    document.getElementById("browser-language").textContent = setting === "auto" ? message(language, "browserLanguage", [browserLanguage()]) : "";
    optionsHint.textContent = message(language, "optionsHint");
    document.getElementById("reload-label").textContent = message(language, "reloadPage");
    reloadButton.setAttribute("aria-label", message(language, "reloadPage"));
    document.getElementById("nudge-text").textContent = message(language, "supportPrompt");
    document.getElementById("nudge-rate").textContent = message(language, "supportRate");
    document.getElementById("nudge-feedback").textContent = message(language, "supportFeedback");
    document.getElementById("nudge-coffee").textContent = message(language, "supportCoffee");
    dismissButton.setAttribute("aria-label", message(language, "supportDismiss"));
    dismissButton.title = message(language, "supportDismiss");
    document.getElementById("footer-rate").textContent = message(language, "supportRate");
    document.getElementById("footer-feedback").textContent = message(language, "supportFeedback");
    document.getElementById("footer-kofi").textContent = message(language, "supportKofi");

    select.replaceChildren();
    const automatic = document.createElement("option");
    automatic.value = "auto";
    automatic.textContent = message(language, "languageAuto");
    select.append(automatic);
    for (const [value, label] of Object.entries(LANGUAGE_NAMES)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = setting;
    updateReloadState(setting);
    renderSite(language);
    status.textContent = announce ? message(language, "saved") : "";
  }

  select.addEventListener("change", async () => {
    const setting = select.value;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: setting });
      render(setting, true);
    } catch {
      const language = resolveLanguage(setting);
      render(appliedSetting || "auto");
      status.textContent = message(language, "saveFailed");
    }
  });

  reloadButton.addEventListener("click", async () => {
    const language = resolveLanguage(select.value);
    status.textContent = message(language, "reloadingPage");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const optIn = tab?.url?.startsWith("https://") && await isOptInSiteEnabled(new URL(tab.url).origin, new URL(tab.url).hostname);
      if (!tab?.id || !(isSupportedTrackerUrl(tab.url) || optIn)) throw new Error("No supported active tab");
      await chrome.tabs.reload(tab.id);
      appliedSetting = select.value;
      updateReloadState(select.value);
    } catch {
      status.textContent = message(language, "openSupportedPage");
    }
  });

  chrome.storage.local.get(STORAGE_KEY).then(settings => {
    const setting = settings[STORAGE_KEY];
    appliedSetting = setting === "auto" || SUPPORTED.has(setting) ? setting : "auto";
    render(appliedSetting);
  }).catch(() => {
    appliedSetting = "auto";
    render(appliedSetting);
  }).finally(() => {
    void initSupportNudge();
    void initSiteSection();
  });
})();
