export const setting = (key) => {
  return game.settings?.get("essence20", key) ?? "default";
};


export const getCurrentUiTheme = () => {
  const coreUIConfig = game?.settings?.get?.("core", "uiConfig");
  const coreTheme = coreUIConfig?.colorScheme.applications;
  if (coreTheme === "light" || coreTheme === "dark") {
    return coreTheme;
  } else {
    return "dark";
  }
};

export const getCurrentThemeClass = () => `theme-${getCurrentUiTheme()}`;

export const getDefaultTheme = () => {
  const theme = setting("sptDefaultTheme");
  return `theme-${theme}`;
};

/**
 * Swap an element's theme-light/theme-dark class for the currently active one.
 * Always removes both first so a stale class can't linger and win the cascade
 * over the newly-added one.
 * @param {HTMLElement} element
 */
export const applyThemeClass = (element) => {
  if (!element) return;
  element.classList.remove("theme-light", "theme-dark");
  const themeClass = getCurrentThemeClass();
  if (themeClass) element.classList.add(themeClass);
};

/**
 * Re-theme every currently-open Essence20 sheet/app in place, without re-rendering
 * them. Foundry's own UI-config handler only re-themes core singletons (sidebar,
 * compendium, HUD, etc.) when the color scheme setting changes, so document sheets
 * and our apps are left stuck on whatever theme was active when they were opened
 * unless we do this ourselves.
 */
export const refreshOpenThemeWrappers = () => {
  for (const element of document.querySelectorAll(".theme-wrapper")) {
    applyThemeClass(element);
  }
};

export const registerSettings = function () {
  const systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () {
    window.location.reload();
  }, 100);

  /* -------------------------------------------- */
  /*  Story Points Tracker settings               */
  /* -------------------------------------------- */

  const SHOW_OPTIONS = {
    on: game.i18n.localize("E20.SptShowAlways"),
    off: game.i18n.localize("E20.SptShowNever"),
    toggle: game.i18n.localize("E20.SptShowToggle"),
  };

  const ACCESS_OPTIONS = {
    everyone: game.i18n.localize("E20.SptUserEveryone"),
    gm: game.i18n.localize("E20.SptUserGm"),
  };

  const POINTS_NAME_OPTIONS = {};
  for (let [name, str] of Object.entries(CONFIG.E20.pointsNameOptions)) {
    POINTS_NAME_OPTIONS[name] = str;
  }

  const THEME_OPTIONS = {
    default: game.i18n.localize("E20.ThemeDefault"),
    pony: game.i18n.localize("E20.ThemePony"),
  };

  /* -------------------------------------------- */
  /*  Config settings                             */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sptAccess", {
    name: game.i18n.localize("E20.SptOptionAccess"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: ACCESS_OPTIONS,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "sptGmPointsArePublic", {
    name: game.i18n.localize("E20.SptOptionGmPointsArePublic"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "sptShow", {
    name: game.i18n.localize("E20.SptOptionShow"),
    scope: "client",
    config: true,
    default: "toggle",
    type: String,
    choices: SHOW_OPTIONS,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "sptDefaultTheme", {
    name: game.i18n.localize("E20.ThemeOptionLabel"),
    scope: "client",
    config: true,
    default: "default",
    type: String,
    choices: THEME_OPTIONS,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "sptMessage", {
    name: game.i18n.localize("E20.SptOptionMessage"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "sptPointsName", {
    name: game.i18n.localize("E20.SptOptionPointsName"),
    scope: "world",
    config: true,
    default: "story",
    type: String,
    choices: POINTS_NAME_OPTIONS,
    onChange: debouncedReload,
  });

  /* -------------------------------------------- */
  /*  System state                                */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sptToggleState", {
    scope: "client",
    default: true,
    type: Boolean,
    config: false,
  });

  game.settings.register(systemName, "sptGmPoints", {
    scope: "world",
    default: 0,
    type: Number,
    config: false,
  });

  game.settings.register(systemName, "sptStoryPoints", {
    scope: "world",
    default: 0,
    type: Number,
    config: false,
  });
};
