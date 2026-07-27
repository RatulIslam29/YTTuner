const STORAGE_KEY = "ytLayoutStudioSettings";

const DEFAULT_SETTINGS = {
  videosPerRow: 4,
  hideShorts: true,
  hideSidebar: false,
  hideAdPlaceholders: true,
  focusMode: false,
  searchGridView: false,
  defaultPlaybackRate: "1",
  autoScrollShorts: false,
  pinVideoWhileScrolling: false,
  showBackToTop: true,
  playerSizePercent: 100,
  hideLauncherButton: false
};

let settings = { ...DEFAULT_SETTINGS };
let applyTimer = null;
let observer = null;
let panelElements = null;
let backToTopButton = null;
let shortsScrollTimer = null;
let lastShortAdvanceKey = "";
let boundShortVideo = null;

function debounceApply(delay = 120) {
  clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => {
    applySettings();
  }, delay);
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      settings = {
        ...DEFAULT_SETTINGS,
        ...(result[STORAGE_KEY] || {})
      };
      settings.playerSizePercent = Math.max(50, Number(settings.playerSizePercent) || DEFAULT_SETTINGS.playerSizePercent);
      resolve(settings);
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({
    [STORAGE_KEY]: settings
  });
}

function setRootVariables() {
  const root = document.documentElement;
  root.style.setProperty("--ytls-videos-per-row", String(settings.videosPerRow));
  root.classList.toggle("ytls-shorts-hide", settings.hideShorts);
  root.classList.toggle("ytls-sidebar-hide", settings.hideSidebar);
  root.classList.toggle("ytls-hide-ad-placeholders", settings.hideAdPlaceholders);
  root.classList.toggle("ytls-focus-mode", settings.focusMode);
  root.classList.toggle("ytls-search-grid", settings.searchGridView);
  root.classList.toggle("ytls-video-pinned", settings.pinVideoWhileScrolling);
  root.classList.toggle("ytls-launcher-hidden", settings.hideLauncherButton);
}

function ensurePanel() {
  if (panelElements?.root?.isConnected) {
    updatePanelUI();
    return;
  }

  const root = document.createElement("div");
  root.className = "ytls-root";
  root.innerHTML = `
    <button class="ytls-fab" type="button" aria-label="Toggle YT Tuner panel">YT</button>
    <section class="ytls-panel" aria-label="YT Tuner controls">
      <div class="ytls-panel__header">
        <div>
          <strong>YT Tuner</strong>
          <p>Shape YouTube your way</p>
        </div>
      </div>
      <div class="ytls-panel__body">
        <label class="ytls-control">
          <span>Videos per row</span>
          <div class="ytls-range-row">
            <input class="ytls-videos-range" type="range" min="2" max="10" step="1">
            <strong class="ytls-videos-value"></strong>
          </div>
        </label>

        <label class="ytls-control">
          <span>Player size</span>
          <div class="ytls-range-row">
            <input class="ytls-player-size-range" type="range" min="50" max="150" step="5">
            <strong class="ytls-player-size-value"></strong>
          </div>
        </label>

        <label class="ytls-switch">
          <span>Hide Shorts</span>
          <input class="ytls-hide-shorts-toggle" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Hide Sidebar</span>
          <input class="ytls-hide-sidebar-toggle" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>RIP AD</span>
          <input class="ytls-hide-ads" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Focus mode</span>
          <input class="ytls-focus-mode" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Search results grid</span>
          <input class="ytls-search-grid-toggle" type="checkbox">
        </label>

        <label class="ytls-control">
          <span>Default speed</span>
          <div class="ytls-dropdown">
            <button type="button" class="ytls-speed-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="ytls-speed-label">1x</span>
            </button>
            <ul class="ytls-dropdown__menu ytls-speed-menu" role="listbox" tabindex="-1">
              <li role="option" data-value="0.75">0.75x</li>
              <li role="option" data-value="1">1x</li>
              <li role="option" data-value="1.5">1.5x</li>
              <li role="option" data-value="2">2x</li>
              <li role="option" data-value="2.5">2.5x</li>
              <li role="option" data-value="3">3x</li>
            </ul>
          </div>
        </label>

        <label class="ytls-switch">
          <span>Auto-scroll Shorts</span>
          <input class="ytls-auto-scroll-shorts" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Pin video on scroll</span>
          <input class="ytls-pin-video" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Back to top button</span>
          <input class="ytls-back-to-top-toggle" type="checkbox">
        </label>

        <label class="ytls-switch">
          <span>Hide YT button</span>
          <input class="ytls-hide-launcher-toggle" type="checkbox">
        </label>
      </div>
    </section>
  `;

  document.documentElement.appendChild(root);

  const fab = root.querySelector(".ytls-fab");
  const videosRange = root.querySelector(".ytls-videos-range");
  const videosValue = root.querySelector(".ytls-videos-value");
  const playerSizeRange = root.querySelector(".ytls-player-size-range");
  const playerSizeValue = root.querySelector(".ytls-player-size-value");
  const hideShortsToggle = root.querySelector(".ytls-hide-shorts-toggle");
  const hideSidebarToggle = root.querySelector(".ytls-hide-sidebar-toggle");
  const hideAds = root.querySelector(".ytls-hide-ads");
  const focusMode = root.querySelector(".ytls-focus-mode");
  const searchGridToggle = root.querySelector(".ytls-search-grid-toggle");
  const speedDropdown = root.querySelector(".ytls-dropdown");
  const speedTrigger = root.querySelector(".ytls-speed-trigger");
  const speedLabel = root.querySelector(".ytls-speed-label");
  const speedMenu = root.querySelector(".ytls-speed-menu");
  const autoScrollShorts = root.querySelector(".ytls-auto-scroll-shorts");
  const pinVideo = root.querySelector(".ytls-pin-video");
  const backToTopToggle = root.querySelector(".ytls-back-to-top-toggle");
  const hideLauncherToggle = root.querySelector(".ytls-hide-launcher-toggle");

  fab.addEventListener("click", () => root.classList.toggle("ytls-open"));

  videosRange.addEventListener("input", (event) => {
    settings.videosPerRow = Number(event.target.value);
    saveSettings();
    debounceApply(0);
  });

  playerSizeRange.addEventListener("input", (event) => {
    settings.playerSizePercent = Math.max(50, Number(event.target.value));
    saveSettings();
    debounceApply(0);
  });

  hideShortsToggle.addEventListener("change", (event) => {
    settings.hideShorts = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  hideSidebarToggle.addEventListener("change", (event) => {
    settings.hideSidebar = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  hideAds.addEventListener("change", (event) => {
    settings.hideAdPlaceholders = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  focusMode.addEventListener("change", (event) => {
    settings.focusMode = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  searchGridToggle.addEventListener("change", (event) => {
    settings.searchGridView = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  speedTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = speedDropdown.classList.toggle("ytls-open");
    speedTrigger.setAttribute("aria-expanded", String(isOpen));
  });

  speedMenu.addEventListener("click", (event) => {
    const option = event.target.closest("li[data-value]");
    if (!option) {
      return;
    }
    settings.defaultPlaybackRate = option.dataset.value;
    saveSettings();
    debounceApply(0);
    updatePanelUI();
    speedDropdown.classList.remove("ytls-open");
    speedTrigger.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (event) => {
    if (!speedDropdown.contains(event.target)) {
      speedDropdown.classList.remove("ytls-open");
      speedTrigger.setAttribute("aria-expanded", "false");
    }
  });

  autoScrollShorts.addEventListener("change", (event) => {
    settings.autoScrollShorts = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  pinVideo.addEventListener("change", (event) => {
    settings.pinVideoWhileScrolling = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  backToTopToggle.addEventListener("change", (event) => {
    settings.showBackToTop = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  hideLauncherToggle.addEventListener("change", (event) => {
    settings.hideLauncherButton = event.target.checked;
    saveSettings();
    debounceApply(0);
  });

  panelElements = {
    root,
    fab,
    videosRange,
    videosValue,
    playerSizeRange,
    playerSizeValue,
    hideShortsToggle,
    hideSidebarToggle,
    hideAds,
    focusMode,
    searchGridToggle,
    speedDropdown,
    speedTrigger,
    speedLabel,
    speedMenu,
    autoScrollShorts,
    pinVideo,
    backToTopToggle,
    hideLauncherToggle
  };

  updatePanelUI();
}

function updatePanelUI() {
  if (!panelElements) {
    return;
  }

  panelElements.videosRange.value = String(settings.videosPerRow);
  panelElements.videosValue.textContent = String(settings.videosPerRow);
  panelElements.playerSizeRange.value = String(settings.playerSizePercent);
  panelElements.playerSizeValue.textContent = `${settings.playerSizePercent}%`;
  panelElements.hideShortsToggle.checked = settings.hideShorts;
  panelElements.hideSidebarToggle.checked = settings.hideSidebar;
  panelElements.hideAds.checked = settings.hideAdPlaceholders;
  panelElements.focusMode.checked = settings.focusMode;
  panelElements.searchGridToggle.checked = settings.searchGridView;
  panelElements.speedLabel.textContent = `${settings.defaultPlaybackRate}x`;
  panelElements.speedMenu.querySelectorAll("li").forEach((li) => {
    li.setAttribute(
      "aria-selected",
      li.dataset.value === String(settings.defaultPlaybackRate) ? "true" : "false"
    );
  });
  panelElements.autoScrollShorts.checked = settings.autoScrollShorts;
  panelElements.pinVideo.checked = settings.pinVideoWhileScrolling;
  panelElements.backToTopToggle.checked = settings.showBackToTop;
  panelElements.hideLauncherToggle.checked = settings.hideLauncherButton;
}

function setSidebarState() {
  // Sidebar visibility is now controlled only by the checkbox-driven CSS class.
}

function applyPlayerSize() {
  const playerOuter = document.querySelector("#player-container-outer");
  const player = document.querySelector("#player");
  const percent = Math.max(50, Number(settings.playerSizePercent) || 100);

  [playerOuter, player].forEach((node) => {
    if (!node) {
      return;
    }

    if (percent === 100) {
      node.style.removeProperty("width");
      node.style.removeProperty("max-width");
      node.style.removeProperty("margin-left");
      node.style.removeProperty("margin-right");
      return;
    }

    node.style.setProperty("width", `${percent}%`, "important");
    node.style.setProperty("max-width", "100%", "important");
    node.style.setProperty("margin-left", "auto", "important");
    node.style.setProperty("margin-right", "auto", "important");
  });
}

function markShortsContent() {
  const selectors = [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-rich-section-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer"
  ];

  document.querySelectorAll(selectors.join(",")).forEach((element) => {
    const shortsLink = element.querySelector('a[href*="/shorts/"], a[href="/shorts"], a[href^="/shorts"]');
    const isShelf = element.matches("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]");
    const titleText = (element.textContent || "").trim().toLowerCase();
    const looksLikeShortsSection =
      isShelf ||
      element.querySelector("ytd-reel-item-renderer") ||
      titleText === "shorts" ||
      titleText.startsWith("shorts\n") ||
      titleText.includes("\nshorts\n");

    if (shortsLink || looksLikeShortsSection) {
      element.dataset.ytlsShorts = "true";
    } else {
      delete element.dataset.ytlsShorts;
    }
  });
}

function applyPlaybackRate() {
  if (location.pathname !== "/watch" && !location.pathname.startsWith("/shorts")) {
    return;
  }

  const video = document.querySelector("video");
  const desiredRate = Number(settings.defaultPlaybackRate);
  if (!video || !Number.isFinite(desiredRate) || desiredRate <= 0) {
    return;
  }

  if (video.playbackRate !== desiredRate) {
    video.playbackRate = desiredRate;
  }

  if (!video.dataset.ytlsRateBound) {
    video.addEventListener("loadedmetadata", () => {
      video.playbackRate = Number(settings.defaultPlaybackRate);
    });
    video.dataset.ytlsRateBound = "true";
  }
}

function markAdContainers() {
  const adSelectors = [
    "ytd-display-ad-renderer",
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "#player-ads",
    ".ytp-ad-player-overlay"
  ];

  document.querySelectorAll(adSelectors.join(",")).forEach((adNode) => {
    const container = adNode.closest(
      [
        "ytd-rich-item-renderer",
        "ytd-rich-section-renderer",
        "ytd-video-renderer",
        "ytd-grid-video-renderer",
        "ytd-compact-video-renderer",
        "ytd-item-section-renderer",
        "ytd-ad-slot-renderer"
      ].join(",")
    );

    if (container) {
      container.dataset.ytlsAdContainer = "true";
    }
  });
}

function ensureBackToTopButton() {
  if (backToTopButton?.isConnected) {
    backToTopButton.classList.toggle("ytls-visible", settings.showBackToTop && window.scrollY > 500);
    return;
  }

  backToTopButton = document.createElement("button");
  backToTopButton.type = "button";
  backToTopButton.className = "ytls-back-to-top";
  backToTopButton.setAttribute("aria-label", "Back to top");
  backToTopButton.textContent = "↑";
  backToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.documentElement.appendChild(backToTopButton);
  backToTopButton.classList.toggle("ytls-visible", settings.showBackToTop && window.scrollY > 500);
}

function applyBackToTopVisibility() {
  ensureBackToTopButton();
  backToTopButton.classList.toggle("ytls-visible", settings.showBackToTop && window.scrollY > 500);
}

function startShortsAutoScroll() {
  window.clearInterval(shortsScrollTimer);
  shortsScrollTimer = null;
  lastShortAdvanceKey = "";
  boundShortVideo = null;

  if (!settings.autoScrollShorts || !location.pathname.startsWith("/shorts")) {
    return;
  }

  const advanceShort = () => {
    const nextButton = document.querySelector(
      [
        'button[aria-label*="Next"]',
        'button[title*="Next"]',
        '.navigation-button button',
        'ytd-button-renderer button'
      ].join(",")
    );

    if (nextButton) {
      nextButton.click();
    }

    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown",
      code: "ArrowDown",
      keyCode: 40,
      which: 40,
      bubbles: true
    }));

    window.scrollBy({ top: window.innerHeight * 0.92, behavior: "smooth" });
  };

  const bindCurrentVideo = () => {
    const video = document.querySelector("video");
    if (!video || video === boundShortVideo) {
      return;
    }

    boundShortVideo = video;
    video.addEventListener("ended", advanceShort);
  };

  bindCurrentVideo();

  shortsScrollTimer = window.setInterval(() => {
    if (document.hidden || !location.pathname.startsWith("/shorts")) {
      return;
    }

    bindCurrentVideo();

    const video = document.querySelector("video");
    if (!video) {
      return;
    }

    const remaining = video.duration - video.currentTime;
    const shouldAdvance = video.ended || (Number.isFinite(remaining) && remaining < 0.15);
    const advanceKey = `${location.pathname}${location.search}:${Math.floor(video.currentTime)}`;

    if (shouldAdvance && lastShortAdvanceKey !== advanceKey) {
      lastShortAdvanceKey = advanceKey;
      advanceShort();
    }
  }, 300);
}

function applySettings() {
  ensurePanel();
  ensureBackToTopButton();
  setRootVariables();
  markShortsContent();
  markAdContainers();
  setSidebarState();
  applyPlayerSize();
  applyPlaybackRate();
  applyBackToTopVisibility();
  startShortsAutoScroll();
  updatePanelUI();
}

function startObservers() {
  if (observer) {
    observer.disconnect();
  }

  // YouTube continuously mutates the page, so we debounce instead of reacting to every node.
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length)) {
        debounceApply();
        return;
      }
      if (mutation.type === "attributes") {
        debounceApply();
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "guide-persistent-and-visible", "is-shorts"]
  });
}

function attachStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = {
      ...DEFAULT_SETTINGS,
      ...(changes[STORAGE_KEY].newValue || {})
    };
    settings.playerSizePercent = Math.max(50, Number(settings.playerSizePercent) || DEFAULT_SETTINGS.playerSizePercent);
    debounceApply(0);
  });
}

function attachNavigationListeners() {
  const reapply = () => debounceApply(80);
  window.addEventListener("yt-navigate-finish", reapply, true);
  window.addEventListener("yt-page-data-updated", reapply, true);
  window.addEventListener("scroll", applyBackToTopVisibility, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      reapply();
    }
  });
}

async function init() {
  await loadSettings();
  ensurePanel();
  applySettings();
  startObservers();
  attachStorageListener();
  attachNavigationListeners();
}

init();
