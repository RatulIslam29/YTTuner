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

const elements = {
  videosPerRow: document.getElementById("videosPerRow"),
  videosPerRowValue: document.getElementById("videosPerRowValue"),
  playerSizePercent: document.getElementById("playerSizePercent"),
  playerSizePercentValue: document.getElementById("playerSizePercentValue"),
  hideShorts: document.getElementById("hideShorts"),
  hideSidebar: document.getElementById("hideSidebar"),
  defaultPlaybackRate: document.getElementById("defaultPlaybackRate"),
  hideAdPlaceholders: document.getElementById("hideAdPlaceholders"),
  focusMode: document.getElementById("focusMode"),
  searchGridView: document.getElementById("searchGridView"),
  autoScrollShorts: document.getElementById("autoScrollShorts"),
  pinVideoWhileScrolling: document.getElementById("pinVideoWhileScrolling"),
  showBackToTop: document.getElementById("showBackToTop"),
  hideLauncherButton: document.getElementById("hideLauncherButton")
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve({
        ...DEFAULT_SETTINGS,
        ...(result[STORAGE_KEY] || {})
      });
    });
  });
}

function saveSettings(nextSettings) {
  chrome.storage.local.set({
    [STORAGE_KEY]: nextSettings
  });
}

function render(settings) {
  elements.videosPerRow.value = String(settings.videosPerRow);
  elements.videosPerRowValue.textContent = String(settings.videosPerRow);
  elements.playerSizePercent.value = String(settings.playerSizePercent);
  elements.playerSizePercentValue.textContent = `${settings.playerSizePercent}%`;
  elements.hideShorts.checked = settings.hideShorts;
  elements.hideSidebar.checked = settings.hideSidebar;
  elements.defaultPlaybackRate.value = String(settings.defaultPlaybackRate);
  elements.hideAdPlaceholders.checked = settings.hideAdPlaceholders;
  elements.focusMode.checked = settings.focusMode;
  elements.searchGridView.checked = settings.searchGridView;
  elements.autoScrollShorts.checked = settings.autoScrollShorts;
  elements.pinVideoWhileScrolling.checked = settings.pinVideoWhileScrolling;
  elements.showBackToTop.checked = settings.showBackToTop;
  elements.hideLauncherButton.checked = settings.hideLauncherButton;
}

async function init() {
  let settings = await getSettings();
  settings.playerSizePercent = Math.max(50, Number(settings.playerSizePercent) || DEFAULT_SETTINGS.playerSizePercent);
  render(settings);

  elements.videosPerRow.addEventListener("input", () => {
    settings.videosPerRow = Number(elements.videosPerRow.value);
    saveSettings(settings);
    render(settings);
  });

  elements.playerSizePercent.addEventListener("input", () => {
    settings.playerSizePercent = Math.max(50, Number(elements.playerSizePercent.value));
    saveSettings(settings);
    render(settings);
  });

  ["defaultPlaybackRate"].forEach((key) => {
    elements[key].addEventListener("change", () => {
      settings[key] = elements[key].value;
      saveSettings(settings);
    });
  });

  [
    "hideShorts",
    "hideSidebar",
    "hideAdPlaceholders",
    "focusMode",
    "searchGridView",
    "autoScrollShorts",
    "pinVideoWhileScrolling",
    "showBackToTop",
    "hideLauncherButton"
  ].forEach((key) => {
    elements[key].addEventListener("change", () => {
      settings[key] = elements[key].checked;
      saveSettings(settings);
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = {
      ...DEFAULT_SETTINGS,
      ...(changes[STORAGE_KEY].newValue || {})
    };
    settings.playerSizePercent = Math.max(50, Number(settings.playerSizePercent) || DEFAULT_SETTINGS.playerSizePercent);
    render(settings);
  });
}

init();
