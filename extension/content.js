(() => {
  "use strict";

  const STORAGE = {
    enabled: "trackerLensEnabled",
    density: "trackerLensDensity",
    theme: "trackerLensTheme",
    searchCollapsed: "trackerLensSearchCollapsed",
    maintenance: "trackerLensLastCacheMaintenance",
    language: "rveLanguage",
    hiddenColumns: "rveHiddenColumns",
    infiniteScroll: "rveInfiniteScroll"
  };
  const LEGACY_SETTINGS = {
    enabled: "rutrackerVisualModernEnabled",
    density: "rutrackerVisualModernDensity"
  };
  // v2: http poster URLs are now upgraded to https, so v1 "no poster" entries are stale.
  const CACHE_PREFIX = "trackerLens:v2:";
  const LEGACY_CACHE_PREFIXES = ["rutrackerVisual:", "trackerLens:v1:"];
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
  const MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 300;
  const MAX_CONCURRENT_LOADS = 4;
  const MAX_POSTER_CANDIDATES = 3;
  const POSTER_PROBE_TIMEOUT = 2500;
  const FETCH_TIMEOUT = 15000;
  const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const ACTION_ICONS = Object.freeze({ torrent: "\u2193", magnet: "\u2197", loading: "\u29C9" });
  const VALID_DENSITIES = new Set(["compact", "normal", "large"]);
  const VALID_LANGUAGES = new Set(["auto", "en", "uk", "ru", "ro", "es"]);
  const COLUMN_DEFINITIONS = [
    { key: "forum", label: "forumColumn" },
    { key: "poster", label: "posterColumn" },
    { key: "topic", label: "topicColumn" },
    { key: "downloads", label: "downloadsColumn" },
    { key: "author", label: "authorColumn" },
    { key: "size", label: "sizeColumn" },
    { key: "seeds", label: "seedsColumn" },
    { key: "leeches", label: "leechesColumn" },
    { key: "completed", label: "completedColumn" },
    { key: "added", label: "addedColumn" }
  ];
  const DESCRIPTION_LABELS = new Set([
    "\u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435",
    "\u043e \u0444\u0438\u043b\u044c\u043c\u0435",
    "\u0441\u044e\u0436\u0435\u0442",
    "\u043e\u043f\u0438\u0441",
    "\u043e\u043f\u0438\u0441 \u0444\u0456\u043b\u044c\u043c\u0443",
    "description",
    "description du film",
    "descriere",
    "despre film",
    "descripcion",
    "descripci\u00f3n"
  ]);

  // RuTracker gets the full interface. Other trackers on the same engine run in
  // posters-only mode: the poster goes inside the title cell so no column shifts
  // (some of them use an old tablesorter that cannot be told about new columns),
  // and none of the RuTracker-tuned theming, toolbar or cell decorations apply.
  const FULL_SITE = /(^|\.)rutracker\.org$/i.test(location.hostname);

  const state = {
    enabled: false,
    density: "normal",
    theme: "light",
    searchCollapsed: false,
    language: "en",
    hasResultsTable: false,
    controller: null,
    observer: null,
    posterObserver: null,
    queue: [],
    queuedRows: new WeakSet(),
    running: 0,
    generation: 0,
    rows: [],
    itemsByRow: new WeakMap(),
    topicUrls: new Set(),
    filterControls: null,
    nextPageUrl: "",
    loadingNextPage: false,
    paginationPaused: false,
    restoringNavigation: false,
    totalResults: 0,
    loadedPages: 1,
    scrollScheduled: false,
    statusTimer: 0,
    hiddenColumns: new Set(),
    infiniteScroll: true,
    supportCounted: false
  };

  function t(key, substitutions) {
    const messages = globalThis.RVE_I18N || {};
    let value = messages[state.language]?.[key] || messages.en?.[key] || key;
    for (const [index, substitution] of (substitutions || []).entries()) {
      value = value.replaceAll(`$${index + 1}`, String(substitution));
    }
    return value;
  }

  function resolveLanguage(setting) {
    if (setting && setting !== "auto" && VALID_LANGUAGES.has(setting)) return setting;
    const browserLanguage = chrome.i18n.getUILanguage().toLowerCase().split(/[-_]/)[0];
    return VALID_LANGUAGES.has(browserLanguage) && browserLanguage !== "auto" ? browserLanguage : "en";
  }

  function createElement(tag, attributes = {}, text = "") {
    const element = document.createElement(tag);
    Object.assign(element, attributes);
    if (text) element.textContent = text;
    return element;
  }

  function addControls() {
    if (document.getElementById("tl-controls")) return;
    if (!FULL_SITE && !state.hasResultsTable) return;
    const controls = createElement("div", { id: "tl-controls", role: "group" });
    controls.setAttribute("aria-label", t("viewControlsLabel"));
    const toggle = createElement("button", { id: "tl-toggle", type: "button" });
    toggle.addEventListener("click", () => setEnabled(!state.enabled));

    const densityControls = createElement("div", { id: "tl-density", hidden: true, role: "group" });
    densityControls.setAttribute("aria-label", t("posterSizeLabel"));
    for (const [value, label, title] of [
      ["compact", "S", t("compactView")],
      ["normal", "M", t("mediumView")],
      ["large", "L", t("largeView")]
    ]) {
      const button = createElement("button", { type: "button", title }, label);
      button.dataset.density = value;
      button.addEventListener("click", () => setDensity(value));
      densityControls.append(button);
    }

    const themeControls = createElement("div", { id: "tl-theme", role: "group" });
    themeControls.setAttribute("aria-label", t("pageThemeLabel"));
    for (const [value, label] of [["light", t("lightTheme")], ["dark", t("darkTheme")]]) {
      const button = createElement("button", { type: "button", title: t("useTheme", [label]) }, label);
      button.dataset.theme = value;
      button.addEventListener("click", () => setTheme(value));
      themeControls.append(button);
    }

    controls.append(toggle, densityControls);
    if (FULL_SITE) controls.append(themeControls);
    document.documentElement.append(controls);
    updateControls();
  }

  function updateControls() {
    const toggle = document.getElementById("tl-toggle");
    if (toggle) {
      toggle.hidden = !state.hasResultsTable;
      toggle.setAttribute("aria-pressed", String(state.enabled));
      toggle.textContent = state.enabled ? t("visualViewOn") : t("simpleView");
      toggle.title = state.enabled ? t("returnOriginalTable") : t("loadPostersSummaries");
    }
    const densityControls = document.getElementById("tl-density");
    if (densityControls) densityControls.hidden = !state.enabled || !state.hasResultsTable;
    document.documentElement.dataset.tlActive = String(FULL_SITE && state.enabled);
    document.documentElement.dataset.tlDensity = state.density;
    document.documentElement.dataset.tlTheme = state.theme;
    document.querySelectorAll("#tl-density button").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.density === state.density));
    });
    document.querySelectorAll("#tl-theme button").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.theme === state.theme));
    });
  }

  function setupSearchCollapse() {
    const form = document.getElementById("tr-form");
    const header = form?.querySelector(":scope > table > tbody > tr:first-child th.thHead");
    if (!form || !header || header.querySelector(".tl-search-collapse")) return;
    const button = createElement("button", { className: "tl-search-collapse", type: "button" });
    button.setAttribute("aria-controls", form.id);
    button.addEventListener("click", () => {
      state.searchCollapsed = !state.searchCollapsed;
      updateSearchCollapse(form, button);
      void safeStorageSet({ [STORAGE.searchCollapsed]: state.searchCollapsed });
    });
    header.append(button);
    updateSearchCollapse(form, button);
  }

  function updateSearchCollapse(form, button) {
    form.classList.toggle("tl-search-collapsed", state.searchCollapsed);
    document.documentElement.dataset.tlSearchCollapsed = String(state.searchCollapsed);
    button.textContent = state.searchCollapsed ? t("showSearch") : t("hideSearch");
    button.setAttribute("aria-expanded", String(!state.searchCollapsed));
  }

  async function setDensity(value) {
    if (!VALID_DENSITIES.has(value)) return;
    state.density = value;
    updateControls();
    await safeStorageSet({ [STORAGE.density]: value });
  }

  async function setTheme(value) {
    if (value !== "light" && value !== "dark") return;
    state.theme = value;
    updateControls();
    await safeStorageSet({ [STORAGE.theme]: value });
  }

  async function setEnabled(enabled) {
    state.enabled = enabled;
    updateControls();
    await safeStorageSet({ [STORAGE.enabled]: enabled });
    if (enabled) startVisualView();
    else stopVisualView();
  }

  function getRows() {
    return [...document.querySelectorAll("#tor-tbl > tbody > tr")]
      .map(row => {
        const link = row.querySelector('a[href*="viewtopic"]');
        const url = link ? toSafeHttpUrl(link.getAttribute("href"), { sameOrigin: true }) : "";
        return { row, link, url };
      })
      .filter(item => item.link && item.url);
  }

  function startVisualView() {
    const rows = getRows();
    if (!rows.length) return;
    state.rows = rows;
    if (!FULL_SITE) {
      ensureInlinePosterSlots(rows);
      state.controller?.abort();
      state.controller = new AbortController();
      startPosterMemoryManagement();
      startLazyLoading(rows, state.controller.signal);
      return;
    }
    state.totalResults = parseTotalResults(document) || rows.length;
    state.loadedPages = getPageNumber(location.href, 1);
    state.paginationPaused = false;
    rows.forEach(item => { item.row.dataset.tlPage = String(state.loadedPages); });
    state.topicUrls = new Set(rows.map(item => item.url));
    ensurePosterColumn(rows);
    ensureActionColumn(rows);
    decorateRows(rows);
    localizeColumnHeaders();
    addFilterToolbar(rows);
    void updateSupportNudge();
    applyColumnVisibility();
    state.controller?.abort();
    state.controller = new AbortController();
    refreshTableSorter();
    startPosterMemoryManagement();
    startLazyLoading(rows, state.controller.signal);
    startAutoPagination();
    void restoreNavigationState();
  }

  function stopVisualView() {
    state.controller?.abort();
    state.controller = null;
    stopAutoPagination();
    stopPosterMemoryManagement();
    resetLoadState();
    undockControls();
    removePosterColumn();
    removeDecorations();
    refreshTableSorter();
  }

  // The site sorts #tor-tbl with jQuery tablesorter, whose column/row cache is built
  // before we inject columns and append pages. Content scripts cannot reach the page's
  // jQuery, but jQuery handlers also fire for native events, so a plain DOM event
  // makes tablesorter rebuild its headers and cache.
  // tablesorter counts columns from both <thead> and <tfoot>; RuTracker's footer is a
  // single full-width cell (colspan 10), so it must follow our added columns or the
  // last columns (Download count, Added) get no parser and stop sorting.
  function refreshTableSorter() {
    const table = document.querySelector("#tor-tbl");
    if (!table) return;
    const columnCount = table.tHead?.rows[0]?.cells.length || 0;
    for (const row of table.tFoot?.rows || []) {
      if (row.cells.length === 1 && columnCount) row.cells[0].colSpan = columnCount;
    }
    table.dispatchEvent(new Event("updateAll"));
  }

  function startLazyLoading(rows, signal) {
    resetLoadState();
    const generation = ++state.generation;
    state.itemsByRow = new WeakMap(rows.map(item => [item.row, item]));

    rows.slice(0, 3).forEach(item => enqueueLoad(item, signal, generation));
    if (!("IntersectionObserver" in window)) {
      rows.slice(3).forEach(item => enqueueLoad(item, signal, generation));
      return;
    }

    state.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        state.observer?.unobserve(entry.target);
        const item = state.itemsByRow.get(entry.target);
        if (item) enqueueLoad(item, signal, generation);
      }
    }, { rootMargin: "900px 0px" });
    rows.slice(3).forEach(item => state.observer.observe(item.row));
  }

  function enqueueLoad(item, signal, generation) {
    if (!state.enabled || signal.aborted || item.row.hidden || item.row.dataset.tlLoaded || state.queuedRows.has(item.row)) return;
    state.queuedRows.add(item.row);
    state.queue.push(item);
    processQueue(signal, generation);
  }

  function processQueue(signal, generation) {
    while (state.enabled && !signal.aborted && generation === state.generation && state.running < MAX_CONCURRENT_LOADS && state.queue.length) {
      const item = state.queue.shift();
      if (item.row.hidden) {
        state.queuedRows.delete(item.row);
        state.observer?.observe(item.row);
        continue;
      }
      state.running += 1;
      loadRow(item, signal).finally(() => {
        if (generation !== state.generation) return;
        state.running -= 1;
        state.queuedRows.delete(item.row);
        processQueue(signal, generation);
      });
    }
  }

  function resetLoadState() {
    state.generation += 1;
    state.observer?.disconnect();
    state.observer = null;
    state.queue = [];
    state.queuedRows = new WeakSet();
    state.running = 0;
  }

  function observeAdditionalRows(items) {
    const signal = state.controller?.signal;
    if (!signal || signal.aborted) return;
    for (const item of items) {
      state.itemsByRow.set(item.row, item);
      if (state.observer) state.observer.observe(item.row);
      else enqueueLoad(item, signal, state.generation);
    }
  }

  function startPosterMemoryManagement() {
    stopPosterMemoryManagement();
    if (!("IntersectionObserver" in window)) return;
    state.posterObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const image = entry.target;
        if (entry.isIntersecting) {
          if (image.dataset.tlUnloaded === "true" && image.dataset.tlOriginalSrc) {
            image.src = image.dataset.tlOriginalSrc;
            delete image.dataset.tlUnloaded;
          }
        } else if (image.src && image.src !== EMPTY_IMAGE && image.complete) {
          image.dataset.tlOriginalSrc = image.currentSrc || image.src;
          image.src = EMPTY_IMAGE;
          image.dataset.tlUnloaded = "true";
        }
      }
    }, { rootMargin: "2800px 0px" });
  }

  function stopPosterMemoryManagement() {
    state.posterObserver?.disconnect();
    state.posterObserver = null;
  }

  async function loadRow({ row, link, url }, signal) {
    if (!state.enabled || signal.aborted || row.dataset.tlLoaded) return;
    const posterCell = row.querySelector(":scope > .tl-poster-cell, :scope > td > .tl-poster-slot");
    if (!posterCell) return;
    const posterContainer = createElement("div", { className: "tl-poster", hidden: true });
    posterCell.append(posterContainer);

    try {
      const data = await getTopicData(url, signal);
      if (!state.enabled || signal.aborted) return;
      renderPoster(posterContainer, data.poster, link);
      if (FULL_SITE) {
        renderSummary(link, data.summary);
        renderRowActions(row, data);
        renderAuthor(row, data.author);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        posterContainer.remove();
        renderRowActions(row, { torrent: "", magnet: "" });
      }
    } finally {
      if (!signal.aborted) row.dataset.tlLoaded = "true";
    }
  }

  function ensureInlinePosterSlots(rows) {
    for (const { link } of rows) {
      const titleCell = link.closest("td");
      if (!titleCell || titleCell.querySelector(":scope > .tl-poster-slot")) continue;
      titleCell.prepend(createElement("div", { className: "tl-poster-slot" }));
    }
  }

  function ensurePosterColumn(rows) {
    const table = document.querySelector("#tor-tbl");
    const firstTitleCell = rows[0]?.link.closest("td");
    if (!table || !firstTitleCell) return;
    const titleIndex = firstTitleCell.cellIndex;
    const headerRow = table.querySelector(":scope > thead > tr");

    if (headerRow && !headerRow.querySelector(":scope > .tl-poster-header")) {
      const header = createElement("th", { className: "tl-poster-header sorter-false" }, t("posterHeader"));
      headerRow.insertBefore(header, headerRow.children[titleIndex] || null);
    }

    const colgroup = table.querySelector(":scope > colgroup");
    if (colgroup && !colgroup.querySelector(":scope > .tl-poster-col")) {
      const column = createElement("col", { className: "tl-poster-col" });
      colgroup.insertBefore(column, colgroup.children[titleIndex] || null);
    }

    for (const { row, link } of rows) {
      if (row.querySelector(":scope > .tl-poster-cell")) continue;
      const titleCell = link.closest("td");
      if (!titleCell) continue;
      titleCell.classList.add("tl-title-cell");
      // Keep the site's row styling but not our own title-cell layout (top-aligned).
      const rowStyleClasses = [...titleCell.classList].filter(name => !name.startsWith("tl-")).join(" ");
      const posterCell = createElement("td", { className: `${rowStyleClasses} tl-poster-cell`.trim() });
      row.insertBefore(posterCell, titleCell);
    }
  }

  function ensureActionColumn(rows) {
    const table = document.querySelector("#tor-tbl");
    const firstTitleCell = rows[0]?.link.closest("td");
    if (!table || !firstTitleCell) return;
    const actionIndex = firstTitleCell.cellIndex + 1;
    const headerRow = table.querySelector(":scope > thead > tr");

    if (headerRow && !headerRow.querySelector(":scope > .tl-action-header")) {
      const header = createElement("th", { className: "tl-action-header sorter-false" }, t("actionsHeader"));
      headerRow.insertBefore(header, headerRow.children[actionIndex] || null);
    }

    const colgroup = table.querySelector(":scope > colgroup");
    if (colgroup && !colgroup.querySelector(":scope > .tl-action-col")) {
      const column = createElement("col", { className: "tl-action-col" });
      colgroup.insertBefore(column, colgroup.children[actionIndex] || null);
    }

    for (const { row, link } of rows) {
      if (row.querySelector(":scope > .tl-action-cell")) continue;
      const titleCell = link.closest("td");
      if (!titleCell) continue;
      const rowStyleClasses = [...titleCell.classList].filter(name => !name.startsWith("tl-")).join(" ");
      const cell = createElement("td", { className: `${rowStyleClasses} tl-action-cell`.trim() });
      const actions = createElement("div", { className: "tl-row-actions", role: "group" });
      actions.setAttribute("aria-label", t("actionsFor", [shorten(link.textContent, 120)]));

      const rowDownload = row.querySelector('a.tr-dl[href], a.dl-stub[href*="dl.php"][href]');
      const downloadUrl = rowDownload ? toSafeHttpUrl(rowDownload.getAttribute("href"), { sameOrigin: true }) : "";
      actions.append(createTorrentAction(downloadUrl));

      const magnetButton = createElement("button", { type: "button", className: "tl-action-button tl-magnet-action", disabled: true });
      magnetButton.title = t("magnetLoading");
      magnetButton.setAttribute("aria-label", t("magnetLoading"));
      magnetButton.append(createElement("span", { className: "tl-action-icon", ariaHidden: "true" }, ACTION_ICONS.loading), createElement("span", { className: "tl-action-label" }, t("magnetLabel")));
      actions.append(magnetButton);
      cell.append(actions);
      row.insertBefore(cell, titleCell.nextSibling);
    }
  }

  function createTorrentAction(url) {
    if (!url) {
      const unavailable = createElement("span", { className: "tl-action-button tl-action-unavailable" });
      unavailable.title = t("torrentUnavailable");
      unavailable.setAttribute("aria-label", t("torrentUnavailable"));
      unavailable.append(createElement("span", { className: "tl-action-icon", ariaHidden: "true" }, ACTION_ICONS.torrent), createElement("span", { className: "tl-action-label" }, t("torrentLabel")));
      return unavailable;
    }
    const link = createElement("a", { href: url, className: "tl-action-button tl-torrent-action", title: t("downloadTorrent") });
    link.setAttribute("aria-label", t("downloadTorrent"));
    link.append(createElement("span", { className: "tl-action-icon", ariaHidden: "true" }, ACTION_ICONS.torrent), createElement("span", { className: "tl-action-label" }, t("torrentLabel")));
    return link;
  }

  function renderRowActions(row, data) {
    const actions = row.querySelector(":scope > .tl-action-cell > .tl-row-actions");
    if (!actions) return;
    if (data.torrent && !actions.querySelector(".tl-torrent-action")) {
      actions.querySelector(".tl-action-unavailable")?.replaceWith(createTorrentAction(data.torrent));
    }
    const button = actions.querySelector(".tl-magnet-action");
    if (!button) return;
    if (!data.magnet) {
      const unavailable = createElement("span", { className: "tl-action-button tl-action-unavailable tl-magnet-unavailable" });
      unavailable.title = t("magnetUnavailable");
      unavailable.setAttribute("aria-label", t("magnetUnavailable"));
      unavailable.append(createElement("span", { className: "tl-action-icon", ariaHidden: "true" }, ACTION_ICONS.magnet), createElement("span", { className: "tl-action-label" }, t("magnetLabel")));
      button.replaceWith(unavailable);
      return;
    }
    button.disabled = false;
    const magnetLink = createElement("a", { href: data.magnet, className: "tl-action-button tl-magnet-action", title: t("openMagnet") });
    magnetLink.setAttribute("aria-label", t("openMagnet"));
    magnetLink.append(createElement("span", { className: "tl-action-icon", ariaHidden: "true" }, ACTION_ICONS.magnet), createElement("span", { className: "tl-action-label" }, t("magnetLabel")));
    button.replaceWith(magnetLink);
  }

  function decorateRows(rows) {
    const columns = getColumnMap();
    const seedIndex = columns.get("seeds")?.index ?? -1;
    const leechIndex = columns.get("leeches")?.index ?? -1;
    const completedIndex = columns.get("completed")?.index ?? -1;

    for (const { row, link } of rows) {
      if (row.querySelector(".tl-meta")) continue;
      const titleCell = link.closest("td");
      if (!titleCell) continue;
      const seeds = seedIndex >= 0 ? parseNumber(row.cells[seedIndex]?.textContent) : null;
      row.dataset.tlSearch = normalizeText(titleCell.textContent);
      row.dataset.tlSeeds = seeds === null ? "" : String(seeds);
      row.cells[seedIndex]?.classList.add("tl-seed-cell");
      row.cells[leechIndex]?.classList.add("tl-leech-cell");
      decorateCompletedCell(row.cells[completedIndex]);
      row.querySelector(":scope > .u-name-col")?.classList.add("tl-author-cell");
      renderAuthor(row, null);
      decorateAddedCell(row.lastElementChild);

      const metadata = createElement("div", { className: "tl-meta" });
      for (const label of extractTags(link.textContent)) {
        metadata.append(createElement("span", { className: "tl-tag" }, label));
      }
      if (seeds !== null) addHealthIndicators(metadata, row.cells[seedIndex], seeds);
      if (metadata.childElementCount) titleCell.append(metadata);
    }
  }

  function addHealthIndicators(metadata, seedCell, seeds) {
    const health = getHealth(seeds);
    const badge = createElement("span", { className: `tl-health tl-health--${health.level}`, title: t("seedCount", [String(seeds)]) }, health.label);
    metadata.append(badge);
    if (seedCell && !seedCell.querySelector(".tl-seed-dot")) {
      seedCell.prepend(createElement("span", { className: `tl-seed-dot tl-health--${health.level}`, title: health.label }));
    }
  }

  function localizeColumnHeaders() {
    const map = getColumnMap();
    for (const definition of COLUMN_DEFINITIONS) {
      const header = map.get(definition.key)?.header;
      if (!header) continue;
      const target = header.querySelector(".tablesorter-header-inner") || header;
      const textNode = [...target.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!textNode && target.children.length) continue;
      if (target.dataset.tlOriginalHeader === undefined) target.dataset.tlOriginalHeader = target.textContent.trim();
      if (textNode) textNode.textContent = t(definition.label);
      else target.textContent = t(definition.label);
      header.classList.add("tl-localized-header");
    }
  }

  function addFilterToolbar(rows) {
    if (document.getElementById("tl-toolbar")) return;
    const table = document.querySelector("#tor-tbl");
    if (!table?.parentNode) return;
    const toolbar = createElement("div", { id: "tl-toolbar", role: "region" });
    toolbar.setAttribute("aria-label", t("filtersRegionLabel"));
    const search = createElement("input", { id: "tl-filter-text", type: "search", placeholder: t("filterPlaceholder") });
    search.setAttribute("aria-label", t("filterTextLabel"));

    const seeded = createElement("input", { id: "tl-filter-seeded", type: "checkbox" });
    const seededLabel = createElement("label");
    seededLabel.append(seeded, ` ${t("seededOnly")}`);
    const infiniteScroll = createElement("input", { id: "tl-infinite-scroll", type: "checkbox", checked: state.infiniteScroll });
    const infiniteScrollLabel = createElement("label", { className: "tl-infinite-scroll" });
    infiniteScrollLabel.append(infiniteScroll, ` ${t("infiniteScroll")}`);
    const columns = createColumnPicker();
    const clear = createElement("button", { id: "tl-filter-clear", type: "button", hidden: true }, t("clearFilters"));
    const count = createElement("span", { id: "tl-filter-count" });
    count.setAttribute("aria-live", "polite");
    const progress = createElement("div", { id: "tl-load-progress", title: t("loadedProgress") });
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", t("loadedProgress"));
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    const progressBar = createElement("span");
    progress.append(progressBar);
    const controls = { search, seeded, clear, count, progress, progressBar };
    state.filterControls = controls;

    toolbar.append(search, seededLabel, infiniteScrollLabel, columns, clear, count, progress);
    table.parentNode.insertBefore(toolbar, table);
    dockControls(toolbar);

    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFilters(state.rows, controls), 70);
    };
    search.addEventListener("input", schedule);
    seeded.addEventListener("change", schedule);
    infiniteScroll.addEventListener("change", () => setInfiniteScroll(infiniteScroll.checked));
    clear.addEventListener("click", () => {
      search.value = "";
      seeded.checked = false;
      applyFilters(state.rows, controls);
      search.focus();
    });
    applyFilters(rows, controls);
  }

  // Counts result pages opened in Visual view and, when the shared rules in
  // support.js say so, adds a one-line "support the project" note to the toolbar.
  async function updateSupportNudge() {
    const support = globalThis.RVE_SUPPORT;
    if (!support || state.supportCounted) return;
    state.supportCounted = true;
    try {
      const { KEYS } = support;
      const settings = await support.load();
      const today = new Date().toDateString();
      const update = { [KEYS.searches]: Number(settings[KEYS.searches] || 0) + 1, [KEYS.lastSearchDay]: today };
      if (!settings[KEYS.installedAt]) update[KEYS.installedAt] = Date.now();
      await chrome.storage.local.set(update);
      const due = support.isDue({ ...settings, ...update });
      void support.setBadge(due);
      // Never on the day's first search: people came for their results.
      if (due && settings[KEYS.lastSearchDay] === today) renderSupportNudge(support);
    } catch {
      // The nudge is optional; storage problems must not affect the page.
    }
  }

  function renderSupportNudge(support) {
    const toolbar = document.getElementById("tl-toolbar");
    if (!toolbar || !state.enabled || toolbar.querySelector("#tl-support")) return;
    const note = createElement("div", { id: "tl-support" });
    note.setAttribute("role", "note");
    note.append(createElement("span", { className: "tl-support-text" }, t("supportPrompt")));
    const finish = () => {
      note.remove();
      void support.complete();
      void support.setBadge(false);
    };
    for (const [action, icon, label, url] of [
      ["rate", "star", t("supportRate"), support.reviewUrl()],
      ["feedback", "chat", t("supportFeedback"), support.FEEDBACK_URL],
      ["coffee", "coffee", t("supportCoffee"), support.KOFI_URL]
    ]) {
      const link = createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "tl-support-link" });
      const tile = createElement("span", { className: `tl-support-tile tl-support-tile--${action}` });
      tile.append(support.createIcon(icon));
      link.append(tile, label);
      link.addEventListener("click", finish);
      note.append(link);
    }
    const close = createElement("button", { type: "button", className: "tl-support-close", title: t("supportDismiss") });
    close.setAttribute("aria-label", t("supportDismiss"));
    close.append(support.createIcon("close"));
    close.addEventListener("click", () => {
      note.remove();
      void support.dismiss().catch(() => {});
      void support.setBadge(false);
    });
    note.append(close);
    toolbar.append(note);
  }

  function createColumnPicker() {
    const picker = createElement("details", { id: "tl-column-picker" });
    const summary = createElement("summary", {}, t("columns"));
    summary.setAttribute("aria-label", t("columnVisibilityLabel"));
    const menu = createElement("div", { className: "tl-column-menu", role: "group" });
    menu.setAttribute("aria-label", t("columnVisibilityLabel"));
    const available = getColumnMap();

    for (const definition of COLUMN_DEFINITIONS) {
      if (!available.has(definition.key)) continue;
      const checkbox = createElement("input", { type: "checkbox", checked: !state.hiddenColumns.has(definition.key) });
      checkbox.dataset.column = definition.key;
      const label = createElement("label");
      label.append(checkbox, createElement("span", {}, t(definition.label)));
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.hiddenColumns.delete(definition.key);
        else state.hiddenColumns.add(definition.key);
        applyColumnVisibility();
        void safeStorageSet({ [STORAGE.hiddenColumns]: [...state.hiddenColumns] });
      });
      menu.append(label);
    }
    picker.append(summary, menu);
    picker.addEventListener("keydown", event => {
      if (event.key === "Escape" && picker.open) {
        event.stopPropagation();
        picker.open = false;
        summary.focus();
      }
    });
    return picker;
  }

  function getColumnMap() {
    const table = document.querySelector("#tor-tbl");
    const headers = [...(table?.querySelector(":scope > thead > tr")?.children || [])];
    const sampleRow = state.rows[0]?.row || table?.querySelector(":scope > tbody > tr");
    const map = new Map();
    headers.forEach((header, index) => {
      const key = resolveColumnKey(header, sampleRow?.children[index]);
      if (key && !map.has(key)) map.set(key, { index, header });
    });
    return map;
  }

  function resolveColumnKey(header, cell) {
    if (header.classList.contains("tl-poster-header")) return "poster";
    if (header.classList.contains("tl-action-header")) return "downloads";
    if (cell?.classList.contains("tl-seed-cell")) return "seeds";
    if (cell?.classList.contains("tl-leech-cell")) return "leeches";
    if (cell?.classList.contains("tl-completed-cell")) return "completed";
    if (cell?.classList.contains("tl-author-cell")) return "author";
    if (cell?.classList.contains("tl-added-cell")) return "added";
    if (cell?.querySelector('a[href*="viewtopic"]')) return "topic";
    if (cell?.querySelector('a[href*="viewforum"]')) return "forum";
    if (cell?.querySelector("a.tr-dl, a.dl-stub")) return "size";
    const text = normalizeText(header.textContent);
    if (text === "s") return "seeds";
    if (text === "l") return "leeches";
    if (text === "c") return "completed";
    if (/^(?:форум|forum)$/.test(text)) return "forum";
    if (/^(?:тема|topic)$/.test(text)) return "topic";
    if (/^(?:автор|author)$/.test(text)) return "author";
    if (/^(?:размер|size)$/.test(text)) return "size";
    if (/^(?:добавлен|added|date)$/.test(text)) return "added";
    return "";
  }

  function applyColumnVisibility() {
    const table = document.querySelector("#tor-tbl");
    if (!table) return;
    const map = getColumnMap();
    const columns = [...(table.querySelector(":scope > colgroup")?.children || [])];
    for (const definition of COLUMN_DEFINITIONS) {
      const entry = map.get(definition.key);
      if (!entry) continue;
      const hidden = state.hiddenColumns.has(definition.key);
      entry.header.classList.toggle("tl-column-hidden", hidden);
      columns[entry.index]?.classList.toggle("tl-column-hidden", hidden);
      for (const { row } of state.rows) row.children[entry.index]?.classList.toggle("tl-column-hidden", hidden);
    }
  }

  function dockControls(toolbar) {
    const controls = document.getElementById("tl-controls");
    if (!controls || controls.parentNode === toolbar) return;
    controls.classList.add("tl-controls--docked");
    toolbar.append(controls);
  }

  function undockControls() {
    const controls = document.getElementById("tl-controls");
    if (!controls || controls.parentNode === document.documentElement) return;
    controls.classList.remove("tl-controls--docked");
    document.documentElement.append(controls);
  }

  function startAutoPagination() {
    if (!state.infiniteScroll) return;
    const nextPageUrl = state.nextPageUrl || findNextPageUrl(document, location.href);
    stopAutoPagination({ preserveNextPage: true });
    state.nextPageUrl = nextPageUrl;
    if (!state.nextPageUrl) return;
    if (!ensurePageStatus()) return;
    window.addEventListener("scroll", handleAutoPaginationScroll, { passive: true });
  }

  function ensurePageStatus() {
    const current = document.getElementById("tl-page-status");
    if (current) return current;
    const table = document.querySelector("#tor-tbl");
    if (!table?.parentNode) return null;
    const status = createElement("div", { id: "tl-page-status", hidden: true });
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    table.parentNode.insertBefore(status, table.nextSibling);
    return status;
  }

  function stopAutoPagination({ preserveNextPage = false } = {}) {
    const nextPageUrl = state.nextPageUrl;
    const loadingNextPage = state.loadingNextPage;
    window.removeEventListener("scroll", handleAutoPaginationScroll);
    cancelAnimationFrame(state.scrollScheduled || 0);
    clearTimeout(state.statusTimer);
    document.getElementById("tl-page-status")?.remove();
    state.nextPageUrl = preserveNextPage ? nextPageUrl : "";
    state.loadingNextPage = preserveNextPage ? loadingNextPage : false;
    state.paginationPaused = false;
    state.restoringNavigation = false;
    state.scrollScheduled = false;
    state.statusTimer = 0;
  }

  function handleAutoPaginationScroll() {
    if (state.scrollScheduled || !state.enabled || !state.infiniteScroll || state.loadingNextPage || state.paginationPaused || state.restoringNavigation || !state.nextPageUrl) return;
    state.scrollScheduled = requestAnimationFrame(() => {
      state.scrollScheduled = false;
      const distanceToBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distanceToBottom <= 800) loadNextPage();
    });
  }

  function setInfiniteScroll(enabled) {
    state.infiniteScroll = Boolean(enabled);
    void safeStorageSet({ [STORAGE.infiniteScroll]: state.infiniteScroll });
    if (state.infiniteScroll) {
      if (state.loadingNextPage) {
        ensurePageStatus();
        showPageStatus(state.restoringNavigation ? t("restoringResults") : t("loadingMoreResults"), { persistent: true });
        window.addEventListener("scroll", handleAutoPaginationScroll, { passive: true });
        return;
      }
      startAutoPagination();
      handleAutoPaginationScroll();
    } else {
      stopAutoPagination({ preserveNextPage: true });
    }
  }

  async function loadNextPage({ restoring = false } = {}) {
    const signal = state.controller?.signal;
    const pageUrl = state.nextPageUrl;
    if (!signal || signal.aborted || !pageUrl || state.loadingNextPage) return;
    state.loadingNextPage = true;
    state.nextPageUrl = "";
    showPageStatus(restoring ? t("restoringResults") : t("loadingMoreResults"), { persistent: true });

    try {
      const pageDocument = await fetchDocument(pageUrl, signal);
      const newItems = [];
      const pageNumber = getPageNumber(pageUrl, state.loadedPages + 1);

      for (const sourceRow of pageDocument.querySelectorAll("#tor-tbl > tbody > tr")) {
        const sourceLink = sourceRow.querySelector('a[href*="viewtopic"]');
        if (!sourceLink) continue;
        const topicUrl = toSafeHttpUrl(sourceLink.getAttribute("href"), { sameOrigin: true });
        if (!topicUrl || state.topicUrls.has(topicUrl)) continue;
        const row = document.importNode(sourceRow, true);
        sanitizeImportedRow(row);
        const link = row.querySelector('a[href*="viewtopic"]');
        if (!link) continue;
        row.classList.add("tl-appended-row");
        row.dataset.tlPage = String(pageNumber);
        state.topicUrls.add(topicUrl);
        newItems.push({ row, link, url: topicUrl });
      }

      const tbody = document.querySelector("#tor-tbl > tbody");
      if (tbody && newItems.length) {
        const fragment = document.createDocumentFragment();
        const firstResult = getPageStart(pageUrl, state.rows.length) + 1;
        const lastResult = firstResult + newItems.length - 1;
        const divider = createPageDivider(pageNumber, firstResult, lastResult);
        fragment.append(divider);
        newItems.forEach(item => fragment.append(item.row));
        tbody.append(fragment);
        newItems.forEach(item => fixLowContrastColors(item.row));
        ensurePosterColumn(newItems);
        ensureActionColumn(newItems);
        decorateRows(newItems);
        state.rows.push(...newItems);
        applyColumnVisibility();
        if (state.filterControls) applyFilters(state.rows, state.filterControls);
        observeAdditionalRows(newItems);
        refreshTableSorter();
        state.loadedPages = Math.max(state.loadedPages, pageNumber);
      }

      const nextUrl = findNextPageUrl(pageDocument, pageUrl);
      state.nextPageUrl = nextUrl && nextUrl !== pageUrl ? nextUrl : "";
      state.paginationPaused = false;
      if (!restoring) showPageStatus(newItems.length ? t("moreResultsLoaded", [String(newItems.length)]) : t("allResultsLoaded"), { persistent: false });
    } catch (error) {
      if (error.name !== "AbortError") {
        state.nextPageUrl = pageUrl;
        state.paginationPaused = true;
        showPageStatus(t("loadMoreError"), { persistent: true, retry: true });
      }
    } finally {
      state.loadingNextPage = false;
    }
  }

  function findNextPageUrl(pageDocument, currentUrl = location.href) {
    const currentStart = getPageStart(currentUrl, 0);
    const candidates = [...pageDocument.querySelectorAll('a[href*="tracker.php"]')]
      .map(link => ({ link, url: toSafeHttpUrl(link.getAttribute("href"), { sameOrigin: true }) }))
      .filter(candidate => candidate.url);
    const explicit = candidates.find(({ link }) =>
      link.relList?.contains("next") || /^(?:[\s\u00bb\u203a\u2192]*)(?:\u0441\u043b\u0435\u0434|next|\u043d\u0430\u0441\u0442|urm|sig)/iu.test(link.textContent.trim())
    );
    if (explicit) return explicit.url;
    return candidates
      .map(candidate => ({ ...candidate, start: getPageStart(candidate.url, NaN) }))
      .filter(candidate => Number.isFinite(candidate.start) && candidate.start > currentStart)
      .sort((a, b) => a.start - b.start)[0]?.url || "";
  }

  function getPageNumber(pageUrl, fallback) {
    const start = getPageStart(pageUrl, NaN);
    return Number.isFinite(start) && start >= 0 ? Math.floor(start / 50) + 1 : fallback;
  }

  function getPageStart(pageUrl, fallback) {
    const value = new URL(pageUrl).searchParams.get("start");
    return value === null ? fallback : Number(value);
  }

  function createPageDivider(page, first, last) {
    const divider = createElement("tr", { className: "tl-page-divider tl-appended-row" });
    divider.dataset.tlPage = String(page);
    const cell = createElement("td", { colSpan: document.querySelector("#tor-tbl > thead > tr")?.children.length || 1 }, t("resultsDivider", [String(first), String(last), String(page)]));
    divider.append(cell);
    return divider;
  }

  function showPageStatus(message, { persistent = false, retry = false } = {}) {
    const status = document.getElementById("tl-page-status");
    if (!status) return;
    clearTimeout(state.statusTimer);
    status.replaceChildren(document.createTextNode(message));
    if (retry) {
      const button = createElement("button", { type: "button", className: "tl-page-retry" }, t("retry"));
      button.addEventListener("click", () => {
        state.paginationPaused = false;
        loadNextPage();
      }, { once: true });
      status.append(" ", button);
    }
    status.hidden = false;
    if (!persistent) state.statusTimer = setTimeout(() => { status.hidden = true; }, 1800);
  }

  function parseTotalResults(pageDocument) {
    const text = pageDocument.querySelector("#main_content_wrap")?.textContent || "";
    const match = text.match(/(?:\u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432 \u043f\u043e\u0438\u0441\u043a\u0430|search results|results found|\u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0456\u0432 \u043f\u043e\u0448\u0443\u043a\u0443|rezultate(?:le)? (?:c\u0103ut\u0103rii|de c\u0103utare)|resultados (?:de (?:la )?)?b\u00fasqueda)\D{0,30}([\d][\d\s.,]*)/iu);
    return match ? Number(match[1].replace(/\D/g, "")) : 0;
  }

  function saveNavigationState() {
    if (!state.enabled || !state.rows.length) return;
    const anchor = state.rows.find(item => item.row.getBoundingClientRect().bottom > 70);
    const data = {
      savedAt: Date.now(),
      loadedPages: state.loadedPages,
      scrollY: window.scrollY,
      anchorUrl: anchor?.url || "",
      anchorOffset: anchor ? anchor.row.getBoundingClientRect().top : 0
    };
    try {
      sessionStorage.setItem(getNavigationStorageKey(), JSON.stringify(data));
    } catch {
      // Navigation restoration is optional.
    }
  }

  async function restoreNavigationState() {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (navigation?.type !== "back_forward") return;
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(getNavigationStorageKey()) || "null");
    } catch {
      return;
    }
    if (!saved || Date.now() - saved.savedAt > 30 * 60 * 1000) return;

    state.restoringNavigation = true;
    while (state.loadedPages < Number(saved.loadedPages || 1) && state.nextPageUrl) {
      const previousPage = state.loadedPages;
      await loadNextPage({ restoring: true });
      if (state.loadedPages === previousPage || state.paginationPaused) break;
    }
    state.restoringNavigation = false;
    if (!state.enabled) return;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const anchor = saved.anchorUrl ? state.rows.find(item => item.url === saved.anchorUrl) : null;
      if (anchor) {
        const target = window.scrollY + anchor.row.getBoundingClientRect().top - Number(saved.anchorOffset || 0);
        window.scrollTo(0, Math.max(0, target));
      } else {
        window.scrollTo(0, Number(saved.scrollY || 0));
      }
      showPageStatus(t("previousPositionRestored"), { persistent: false });
    }));
  }

  function getNavigationStorageKey() {
    return `trackerLensNavigation:${location.pathname}${location.search}`;
  }

  function applyFilters(rows, controls) {
    const query = normalizeText(controls.search.value);
    const hasFilters = Boolean(query || controls.seeded.checked);
    let visible = 0;

    for (const { row } of rows) {
      const text = row.dataset.tlSearch || "";
      const seeds = Number(row.dataset.tlSeeds || 0);
      const matches = (!query || text.includes(query))
        && (!controls.seeded.checked || seeds > 0);
      const wasHidden = row.hidden;
      row.hidden = !matches;
      if (matches) {
        visible += 1;
        if (wasHidden && !row.dataset.tlLoaded && !state.queuedRows.has(row)) state.observer?.observe(row);
      }
    }

    if (state.queue.length) {
      state.queue = state.queue.filter(item => {
        if (!item.row.hidden) return true;
        state.queuedRows.delete(item.row);
        state.observer?.observe(item.row);
        return false;
      });
    }
    if (state.controller && !state.controller.signal.aborted) processQueue(state.controller.signal, state.generation);
    controls.clear.hidden = !hasFilters;
    const loaded = rows.length;
    const total = Math.max(state.totalResults, loaded);
    controls.count.textContent = t("resultCount", [String(visible), String(loaded), String(total)]);
    controls.progress.hidden = total <= loaded;
    const progress = Math.min(100, (loaded / total) * 100);
    controls.progressBar.style.width = `${progress}%`;
    controls.progress.setAttribute("aria-valuenow", String(Math.round(progress)));

    document.querySelectorAll(".tl-page-divider").forEach(divider => {
      const page = divider.dataset.tlPage;
      divider.hidden = !rows.some(item => item.row.dataset.tlPage === page && !item.row.hidden);
    });
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function extractTags(title) {
    const tags = [];
    const rules = [
      /\b(?:19|20)\d{2}\b/g,
      /\b(?:2160p|1080[pi]|720p|576p|480p|4K|UHD)\b/gi,
      /\b(?:WEB[- .]?DL|WEBRip|Blu[- .]?Ray|BDRip|HDRip|DVDRip|HDTV|IPTV)\b/gi,
      /\b(?:AV1|HEVC|H\.?265|H\.?264|x265|x264|HDR10\+?|Dolby Vision|DV)\b/gi,
      /\b(?:RUS|ENG|ESP|SPA|LAT|JAP|JPN|UKR|ITA|FRE|GER|MULTI)\b/gi
    ];
    for (const rule of rules) {
      for (const match of title.matchAll(rule)) {
        const label = match[0].replace(/WEB[ .]?DL/i, "WEB-DL").toUpperCase();
        if (!tags.includes(label)) tags.push(label);
      }
    }
    return tags.slice(0, 7);
  }

  function parseNumber(text) {
    const match = String(text || "").replace(/\s/g, "").match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function getHealth(seeds) {
    if (seeds >= 20) return { level: "high", label: t("highlyAvailable") };
    if (seeds >= 5) return { level: "good", label: t("available") };
    if (seeds >= 1) return { level: "low", label: t("lowSeeds") };
    return { level: "dead", label: t("noSeeds") };
  }

  async function getTopicData(url, signal) {
    const cacheKey = `${CACHE_PREFIX}${url}`;
    try {
      const cached = await chrome.storage.local.get(cacheKey);
      const entry = cached[cacheKey];
      if (entry && Date.now() - entry.savedAt < CACHE_TTL && Object.hasOwn(entry.data || {}, "magnet") && Object.hasOwn(entry.data || {}, "author")) return entry.data;
    } catch {
      // Cache reads are optional; network rendering must still work.
    }

    const documentNode = await fetchDocument(url, signal);
    const body = documentNode.querySelector("#topic_main .row1 .message .post_body") || documentNode.querySelector(".post_body");
    const data = {
      poster: await choosePoster(body, url),
      summary: extractSummary(body),
      torrent: extractTorrentUrl(documentNode, url),
      magnet: extractMagnetUrl(documentNode),
      author: extractAuthorInfo(documentNode, url)
    };
    void safeStorageSet({ [cacheKey]: { savedAt: Date.now(), data } });
    return data;
  }

  function extractTorrentUrl(documentNode, topicUrl) {
    const link = documentNode.querySelector('a.dl-link[href], a.dl-stub[href*="dl.php"][href], a[href*="/dl.php?t="][href]');
    return link ? toSafeHttpUrl(link.getAttribute("href"), { sameOrigin: true, base: topicUrl }) : "";
  }

  function extractMagnetUrl(documentNode) {
    return toSafeMagnetUrl(documentNode.querySelector('a[href^="magnet:"]')?.getAttribute("href") || "");
  }

  function extractAuthorInfo(documentNode, topicUrl) {
    const info = documentNode.querySelector("#topic_main .row1 .poster_info") || documentNode.querySelector(".poster_info");
    if (!info) return null;
    const valueWithoutLabel = selector => {
      const node = info.querySelector(selector)?.cloneNode(true);
      node?.querySelectorAll("em").forEach(label => label.remove());
      return node?.textContent.replace(/\s+/g, " ").trim() || "";
    };
    const body = documentNode.querySelector("#topic_main .row1 .post_body") || documentNode.querySelector(".post_body");
    let userId = "";
    try {
      userId = String(JSON.parse(body?.dataset.ext_link_data || "{}").u || "");
    } catch {
      // A profile link is optional; the visible author data remains usable.
    }
    return {
      name: info.querySelector(".nick-author")?.textContent.replace(/\s+/g, " ").trim() || "",
      avatar: toSafeHttpUrl(info.querySelector(".avatar img[src]")?.getAttribute("src") || "", { base: topicUrl }),
      rank: info.querySelector(".rank_img img")?.getAttribute("alt")?.trim() || valueWithoutLabel(".rank_img"),
      joined: valueWithoutLabel(".joined"),
      posts: valueWithoutLabel(".posts"),
      profile: userId ? toSafeHttpUrl(`profile.php?mode=viewprofile&u=${encodeURIComponent(userId)}`, { sameOrigin: true, base: topicUrl }) : ""
    };
  }

  // A hung request would otherwise hold one of the MAX_CONCURRENT_LOADS slots (or the
  // pagination lock) forever. Timeout errors are named "TimeoutError", so callers treat
  // them as failures, while user-initiated aborts keep surfacing as "AbortError".
  async function fetchDocument(url, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new DOMParser().parseFromString(await decodeResponse(response), "text/html");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  }

  async function decodeResponse(response) {
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "";
    const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || "windows-1251";
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return new TextDecoder("windows-1251").decode(bytes);
    }
  }

  function extractSummary(body) {
    if (!body) return "";
    const label = [...body.querySelectorAll(".post-b")].find(node => DESCRIPTION_LABELS.has(normalizeText(node.textContent)));
    if (label) {
      const parts = [];
      for (let node = label.nextSibling; node; node = node.nextSibling) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.matches("br, hr, .post-br, .post-b") || node.querySelector?.("br, hr"))) break;
        parts.push(node.textContent || "");
      }
      const exact = parts.join(" ").replace(/^\s*:\s*/, "").replace(/\s+/g, " ").trim();
      if (exact.length >= 40) return shorten(exact, 360);
    }

    const clone = body.cloneNode(true);
    clone.querySelectorAll("script, style, img, var, iframe, video, audio, blockquote, .q-wrap, .sp-wrap").forEach(node => node.remove());
    const fallback = [...clone.querySelectorAll("p, li")]
      .map(node => node.textContent.replace(/\s+/g, " ").trim())
      .find(text => text.length >= 80 && text.length <= 700 && !/(?:https?:\/\/|magnet:|\b(?:codec|bitrate)\s*:)/i.test(text));
    return fallback ? shorten(fallback, 360) : "";
  }

  function shorten(text, limit) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    const cut = clean.slice(0, limit - 1);
    const boundary = cut.lastIndexOf(" ");
    return `${cut.slice(0, boundary > limit * 0.7 ? boundary : cut.length)}…`;
  }

  async function choosePoster(body, topicUrl) {
    if (!body) return "";
    const primary = body.querySelector("img.postImgAligned.img-right[src], img.postImg.img-right[src], var.postImgAligned.img-right[title], var.postImg.img-right[title]");
    const primaryUrl = toSafeImageUrl(primary?.getAttribute(primary.tagName === "VAR" ? "title" : "src"), topicUrl);
    if (primaryUrl) return primaryUrl;

    const candidates = new Map();
    body.querySelectorAll("img.postImg[src]").forEach(node => {
      if (!node.closest(".sp-wrap") && !node.classList.contains("smile")) {
        candidates.set(node.getAttribute("src"), {
          priority: 100000,
          width: Number(node.getAttribute("width")) || 0,
          height: Number(node.getAttribute("height")) || 0
        });
      }
    });
    body.querySelectorAll("var.postImg[title], .postImg[title]").forEach(node => {
      if (!node.closest(".sp-wrap") && !candidates.has(node.getAttribute("title"))) {
        candidates.set(node.getAttribute("title"), { priority: 0, width: 0, height: 0 });
      }
    });
    const items = [...candidates]
      .map(([url, data]) => ({ url: toSafeImageUrl(url, topicUrl), ...data }))
      .filter(item => item.url)
      .slice(0, MAX_POSTER_CANDIDATES);
    if (!items.length) return "";
    if (items.length === 1) return items[0].url;

    const measured = await Promise.all(items.map(async (item, order) => {
      const size = item.width > 0 && item.height > 0 ? item : await measureImage(item.url);
      return { url: item.url, score: scorePoster(item.priority, size, order) };
    }));
    measured.sort((a, b) => b.score - a.score);
    return measured[0].url;
  }

  function scorePoster(priority, size, order) {
    if (!size?.width || !size?.height) return priority - order;
    const ratio = size.width / size.height;
    const portraitBonus = size.height >= size.width * 1.15 ? 100000 : 0;
    const ratioBonus = Math.max(0, 1 - Math.abs(ratio - 0.67)) * 10000;
    const areaBonus = Math.min(size.width * size.height, 1000000) / 1000;
    return priority + portraitBonus + ratioBonus + areaBonus - order;
  }

  function measureImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve(value);
      };
      const timeout = setTimeout(() => {
        image.src = EMPTY_IMAGE;
        finish(null);
      }, POSTER_PROBE_TIMEOUT);
      image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => finish(null);
      image.src = url;
    });
  }

  function renderPoster(container, poster, topicLink) {
    if (!poster) {
      container.remove();
      return;
    }
    const url = toSafeHttpUrl(poster);
    if (!url) {
      container.remove();
      return;
    }
    const topicUrl = toSafeHttpUrl(topicLink?.getAttribute("href"), { sameOrigin: true });
    if (!topicUrl) {
      container.remove();
      return;
    }
    const linkAttributes = { href: topicUrl };
    if (topicLink.target) linkAttributes.target = topicLink.target;
    if (topicLink.target === "_blank") linkAttributes.rel = "noopener noreferrer";
    const link = createElement("a", linkAttributes);
    const title = String(topicLink.textContent || "").replace(/\s+/g, " ").trim();
    const image = createElement("img", { src: url, alt: title ? t("posterFor", [shorten(title, 140)]) : t("topicPoster"), loading: "lazy", decoding: "async" });
    image.dataset.tlOriginalSrc = url;
    image.addEventListener("error", () => {
      if (image.src === EMPTY_IMAGE) return;
      state.posterObserver?.unobserve(image);
      container.remove();
    }, { once: true });
    image.addEventListener("load", () => {
      if (image.src !== EMPTY_IMAGE && image.naturalWidth && image.naturalHeight) {
        image.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      }
    });
    link.append(image);
    container.replaceChildren(link);
    container.hidden = false;
    state.posterObserver?.observe(image);
  }

  function renderSummary(link, text) {
    if (!text) return;
    const titleCell = link.closest("td");
    if (!titleCell || titleCell.querySelector(".tl-summary")) return;
    titleCell.append(createElement("div", { className: "tl-summary" }, text));
  }

  function renderAuthor(row, author) {
    const cell = row.querySelector(":scope > .tl-author-cell");
    const originalLink = cell?.querySelector("a[href]");
    if (!cell || !originalLink) return;
    if (!author && cell.querySelector(".tl-author-card")) return;
    const data = author || {};
    const displayName = data.name || originalLink.textContent.replace(/\s+/g, " ").trim();
    const card = createElement("div", { className: "tl-author-card" });
    const media = data.profile
      ? createElement("a", { href: data.profile, className: "tl-author-avatar-link", title: displayName })
      : createElement("span", { className: "tl-author-avatar-link" });

    if (data.avatar) {
      media.append(createElement("img", { className: "tl-author-avatar", src: data.avatar, alt: "", loading: "lazy", decoding: "async" }));
    } else {
      media.append(createElement("span", { className: "tl-author-avatar tl-author-avatar--fallback", ariaHidden: "true" }, displayName.slice(0, 1).toUpperCase()));
    }

    originalLink.classList.add("tl-author-name");
    const details = createElement("div", { className: "tl-author-details" });
    details.append(originalLink);
    if (data.rank) details.append(createElement("span", { className: "tl-author-rank", title: data.rank }, data.rank));
    const stats = createElement("div", { className: "tl-author-stats" });
    if (data.joined) stats.append(createElement("span", { title: t("authorJoined", [data.joined]), ariaLabel: t("authorJoined", [data.joined]) }, `\u25F7 ${data.joined}`));
    if (data.posts) stats.append(createElement("span", { title: t("authorPosts", [data.posts]), ariaLabel: t("authorPosts", [data.posts]) }, `# ${data.posts}`));
    card.append(media, details);
    if (stats.childElementCount) card.append(stats);
    cell.replaceChildren(card);
  }

  function decorateAddedCell(cell) {
    if (!cell || cell.classList.contains("tl-added-cell")) return;
    const parts = [...cell.querySelectorAll(":scope > p")];
    cell.classList.add("tl-added-cell");
    parts[0]?.classList.add("tl-added-date");
    parts[1]?.classList.add("tl-added-time");
    if (parts.length) {
      const card = createElement("div", { className: "tl-added-card" });
      card.append(...parts);
      cell.replaceChildren(card);
    }
  }

  function decorateCompletedCell(cell) {
    if (!cell || cell.classList.contains("tl-completed-cell")) return;
    const originalText = cell.textContent.trim();
    const count = parseNumber(originalText);
    if (count === null) return;
    cell.dataset.tlOriginalCompleted = originalText;
    if (!cell.hasAttribute("data-ts_text")) cell.dataset.tlAddedTsText = "true";
    cell.setAttribute("data-ts_text", String(count));
    cell.classList.add("tl-completed-cell");
    cell.textContent = formatDownloadCount(count);
  }

  function formatDownloadCount(count) {
    const absolute = Math.abs(Math.trunc(count));
    if (state.language === "ru" || state.language === "uk") {
      const last = absolute % 10;
      const lastTwo = absolute % 100;
      if (last === 1 && lastTwo !== 11) return t("downloadCountOne", [String(count)]);
      if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return t("downloadCountFew", [String(count)]);
    } else if (state.language === "ro") {
      const lastTwo = absolute % 100;
      if (absolute === 1) return t("downloadCountOne", [String(count)]);
      if (absolute === 0 || (lastTwo >= 2 && lastTwo <= 19)) return t("downloadCountFew", [String(count)]);
    } else if (absolute === 1) {
      return t("downloadCountOne", [String(count)]);
    }
    return t("downloadCountMany", [String(count)]);
  }

  function toSafeHttpUrl(value, { sameOrigin = false, base = location.href } = {}) {
    try {
      if (typeof value !== "string" || !value.trim()) return "";
      const url = new URL(value, base);
      if (url.protocol !== "https:") return "";
      if (sameOrigin && url.origin !== location.origin) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  // Older topics reference images over plain http (e.g. fastpic). Chrome would
  // auto-upgrade them as mixed content anyway, so upgrade explicitly to https.
  function toSafeImageUrl(value, base) {
    try {
      if (typeof value !== "string" || !value.trim()) return "";
      const url = new URL(value.trim(), base);
      if (url.protocol === "http:") url.protocol = "https:";
      return toSafeHttpUrl(url.href);
    } catch {
      return "";
    }
  }

  function toSafeMagnetUrl(value) {
    try {
      if (typeof value !== "string" || !value.trim()) return "";
      const url = new URL(value.trim());
      const exactTopics = url.searchParams.getAll("xt");
      const hasSupportedHash = exactTopics.some(topic =>
        /^urn:btih:[a-z0-9]{32,40}$/i.test(topic) || /^urn:btmh:1220[a-f0-9]{64}$/i.test(topic)
      );
      if (url.protocol !== "magnet:" || !hasSupportedHash) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function sanitizeImportedRow(row) {
    row.querySelectorAll("script, iframe, object, embed").forEach(node => node.remove());
    for (const element of [row, ...row.querySelectorAll("*")]) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
      }
    }
  }

  function removePosterColumn() {
    document.querySelectorAll(".tl-poster-cell, .tl-poster-header, .tl-poster-col, .tl-poster-slot, .tl-action-cell, .tl-action-header, .tl-action-col").forEach(element => element.remove());
  }

  function removeDecorations() {
    document.querySelectorAll(".tl-meta, .tl-seed-dot, .tl-summary").forEach(element => element.remove());
    document.getElementById("tl-toolbar")?.remove();
    document.querySelectorAll(".tl-title-cell").forEach(element => element.classList.remove("tl-title-cell"));
    document.querySelectorAll(".tl-seed-cell").forEach(element => element.classList.remove("tl-seed-cell"));
    document.querySelectorAll(".tl-leech-cell").forEach(element => element.classList.remove("tl-leech-cell"));
    document.querySelectorAll(".tl-completed-cell").forEach(cell => {
      cell.textContent = cell.dataset.tlOriginalCompleted || cell.textContent;
      delete cell.dataset.tlOriginalCompleted;
      if (cell.dataset.tlAddedTsText === "true") {
        cell.removeAttribute("data-ts_text");
        delete cell.dataset.tlAddedTsText;
      }
      cell.classList.remove("tl-completed-cell");
    });
    document.querySelectorAll(".tl-author-cell").forEach(cell => {
      const link = cell.querySelector(".tl-author-name");
      if (link) {
        link.classList.remove("tl-author-name");
        const wrapper = createElement("div", { className: "wbr u-name" });
        wrapper.append(link);
        cell.replaceChildren(wrapper);
      }
      cell.classList.remove("tl-author-cell");
    });
    document.querySelectorAll(".tl-added-cell").forEach(cell => {
      const card = cell.querySelector(":scope > .tl-added-card");
      const parts = card ? [...card.children] : [...cell.querySelectorAll(":scope > p")];
      parts.forEach(element => element.classList.remove("tl-added-date", "tl-added-time"));
      if (card) cell.replaceChildren(...parts);
      cell.classList.remove("tl-added-cell");
    });
    document.querySelectorAll(".tl-localized-header").forEach(header => {
      const target = header.querySelector(".tablesorter-header-inner") || header;
      if (target.dataset.tlOriginalHeader !== undefined) {
        const textNode = [...target.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = target.dataset.tlOriginalHeader;
        else if (!target.children.length) target.textContent = target.dataset.tlOriginalHeader;
        delete target.dataset.tlOriginalHeader;
      }
      header.classList.remove("tl-localized-header");
    });
    document.querySelectorAll(".tl-column-hidden").forEach(element => element.classList.remove("tl-column-hidden"));
    document.querySelectorAll("#tor-tbl > tbody > tr").forEach(row => {
      row.hidden = false;
      delete row.dataset.tlSearch;
      delete row.dataset.tlSeeds;
      delete row.dataset.tlLoaded;
      delete row.dataset.tlPage;
    });
    document.querySelectorAll(".tl-appended-row").forEach(row => row.remove());
    state.rows = [];
    state.topicUrls.clear();
    state.filterControls = null;
    state.totalResults = 0;
    state.loadedPages = 1;
  }

  // Authors pick inline/BBCode colors (darkred, navy, #880e4f...) for a white page.
  // For each one, store a lighter same-hue variant that the dark theme CSS applies,
  // so the light theme and theme switching need no extra work.
  const DARK_SURFACE_LUMINANCE = relativeLuminance([41, 49, 55]); // #293137, the lightest dark-theme surface
  const MIN_DARK_CONTRAST = 4.5;

  function fixLowContrastColors(root = document.body) {
    if (!root) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    for (const element of root.querySelectorAll('[style*="color" i], font[color]')) {
      if (element.hasAttribute("data-tl-dark-color") || element.closest("#tl-controls, #tl-toolbar")) continue;
      const rgb = parseCssColor(context, element.style.color || element.getAttribute("color"));
      const lighter = rgb && lightenForDarkSurface(rgb);
      if (!lighter) continue;
      element.style.setProperty("--tl-dark-color", lighter);
      element.setAttribute("data-tl-dark-color", "");
    }
  }

  function parseCssColor(context, value) {
    if (!value) return null;
    const sentinel = "#010203";
    context.fillStyle = sentinel;
    context.fillStyle = value;
    const normalized = context.fillStyle;
    if (normalized === sentinel && value.trim().toLowerCase() !== sentinel) return null;
    const hex = normalized.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (hex) return hex.slice(1).map(part => parseInt(part, 16));
    const rgba = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    return rgba && Number(rgba[4] ?? 1) > 0 ? rgba.slice(1, 4).map(Number) : null;
  }

  function relativeLuminance([r, g, b]) {
    const channel = value => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function lightenForDarkSurface(rgb) {
    const contrast = color => {
      const luminance = relativeLuminance(color);
      return (Math.max(luminance, DARK_SURFACE_LUMINANCE) + 0.05) / (Math.min(luminance, DARK_SURFACE_LUMINANCE) + 0.05);
    };
    if (contrast(rgb) >= MIN_DARK_CONTRAST) return "";
    for (let mix = 0.05; mix <= 1; mix += 0.05) {
      const candidate = rgb.map(channel => Math.round(channel + (255 - channel) * mix));
      if (contrast(candidate) >= MIN_DARK_CONTRAST) return `rgb(${candidate.join(", ")})`;
    }
    return "rgb(255, 255, 255)";
  }

  async function safeStorageSet(value) {
    try {
      await chrome.storage.local.set(value);
    } catch {
      // Storage is an optimization, never a rendering requirement.
    }
  }

  function scheduleCacheMaintenance() {
    const run = () => maintainCache().catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 2000);
  }

  async function maintainCache() {
    const marker = await chrome.storage.local.get(STORAGE.maintenance);
    const now = Date.now();
    if (now - Number(marker[STORAGE.maintenance] || 0) < MAINTENANCE_INTERVAL) return;
    const all = await chrome.storage.local.get(null);
    const current = [];
    const remove = [];

    for (const [key, value] of Object.entries(all)) {
      if (LEGACY_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) remove.push(key);
      else if (key.startsWith(CACHE_PREFIX)) {
        if (!value?.savedAt || now - value.savedAt >= CACHE_TTL) remove.push(key);
        else current.push([key, value.savedAt]);
      }
    }
    current.sort((a, b) => b[1] - a[1]);
    remove.push(...current.slice(MAX_CACHE_ENTRIES).map(([key]) => key));
    if (remove.length) await chrome.storage.local.remove(remove);
    await safeStorageSet({ [STORAGE.maintenance]: now });
  }

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !state.enabled) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    setEnabled(false);
  });
  window.addEventListener("pagehide", saveNavigationState);

  async function init() {
    state.hasResultsTable = Boolean(document.querySelector("#tor-tbl"));
    scheduleCacheMaintenance();
    try {
      const settings = await chrome.storage.local.get([STORAGE.enabled, STORAGE.density, STORAGE.theme, STORAGE.searchCollapsed, STORAGE.language, STORAGE.hiddenColumns, STORAGE.infiniteScroll, LEGACY_SETTINGS.enabled, LEGACY_SETTINGS.density]);
      const savedDensity = settings[STORAGE.density] ?? settings[LEGACY_SETTINGS.density];
      const savedEnabled = settings[STORAGE.enabled] ?? settings[LEGACY_SETTINGS.enabled];
      state.density = VALID_DENSITIES.has(savedDensity) ? savedDensity : "normal";
      state.enabled = Boolean(savedEnabled);
      state.theme = FULL_SITE && settings[STORAGE.theme] === "dark" ? "dark" : "light";
      state.searchCollapsed = Boolean(settings[STORAGE.searchCollapsed]);
      const languageSetting = VALID_LANGUAGES.has(settings[STORAGE.language]) ? settings[STORAGE.language] : "auto";
      state.language = resolveLanguage(languageSetting);
      state.hiddenColumns = new Set(Array.isArray(settings[STORAGE.hiddenColumns]) ? settings[STORAGE.hiddenColumns].filter(value => COLUMN_DEFINITIONS.some(column => column.key === value)) : []);
      state.infiniteScroll = settings[STORAGE.infiniteScroll] !== false;
      if (settings[STORAGE.enabled] === undefined || settings[STORAGE.density] === undefined) {
        void safeStorageSet({ [STORAGE.enabled]: state.enabled, [STORAGE.density]: state.density, [STORAGE.infiniteScroll]: state.infiniteScroll });
      } else if (settings[STORAGE.infiniteScroll] === undefined) {
        void safeStorageSet({ [STORAGE.infiniteScroll]: state.infiniteScroll });
      }
    } catch {
      state.enabled = false;
    }
    addControls();
    if (FULL_SITE) {
      setupSearchCollapse();
      fixLowContrastColors();
    }
    if (state.enabled) startVisualView();
    // Releases the toolbar space content.css reserves before first paint.
    document.documentElement.dataset.tlReady = "true";
  }

  init();
})();
