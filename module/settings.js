import CompendiumBrowserSourceConfig from "./apps/compendium-browser-sources.mjs";

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

/**
 * Re-theme every chat message currently rendered in the log, the same way
 * refreshOpenThemeWrappers() does for sheets/apps - chat messages aren't .theme-wrapper
 * elements (see _chat.scss), so they're excluded from that query and need their own pass.
 */
export const refreshChatMessageThemes = () => {
  for (const element of document.querySelectorAll(".chat-message")) {
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

  // What the Effects tab's add button does. "ask" offers both; anyone who already knows the key
  // vocabulary can set "blank" and never see the prompt again, which is the whole premise of the
  // wizard being opt-in rather than a replacement for the effect sheet.
  const EFFECT_ADD_OPTIONS = {
    ask: game.i18n.localize("E20.EffectAddBehaviorAsk"),
    wizard: game.i18n.localize("E20.EffectAddBehaviorWizard"),
    blank: game.i18n.localize("E20.EffectAddBehaviorBlank"),
  };

  /* -------------------------------------------- */
  /*  Config settings                             */
  /* -------------------------------------------- */
  // How a Threat's Health carries across when a placed token is swapped between its Normal and
  // Grown forms - see helpers/monster-grow-swap.mjs#carryOverHealth for why both behaviours are
  // canon.
  game.settings.register(systemName, "monsterGrowHealthMode", {
    name: game.i18n.localize("E20.MonsterGrowHealthMode"),
    hint: game.i18n.localize("E20.MonsterGrowHealthModeHint"),
    scope: "world",
    config: true,
    default: "proportional",
    type: String,
    choices: {
      proportional: "E20.MonsterGrowHealthProportional",
      absolute: "E20.MonsterGrowHealthAbsolute",
      full: "E20.MonsterGrowHealthFull",
    },
  });
  game.settings.register(systemName, "sptAccess", {
    name: game.i18n.localize("E20.SptOptionAccess"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: ACCESS_OPTIONS,
    onChange: debouncedReload,
  });

  game.settings.register(systemName, "effectAddBehavior", {
    name: game.i18n.localize("E20.EffectAddBehaviorLabel"),
    hint: game.i18n.localize("E20.EffectAddBehaviorHint"),
    scope: "client",
    config: true,
    default: "ask",
    type: String,
    choices: EFFECT_ADD_OPTIONS,
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
  /*  Action Economy settings                     */
  /* -------------------------------------------- */
  const ACTION_ECONOMY_MODES = {};
  for (const [key, str] of Object.entries(CONFIG.E20.actionEconomyModes)) {
    ACTION_ECONOMY_MODES[key] = game.i18n.localize(str);
  }

  /* Default is "track", not "strict", and not as a hedge: the overwhelming majority of compendium
     items carry no authored action cost yet, so blocking on absent data would break every table on
     upgrade. See helpers/action-economy.mjs's own doc comment. */
  game.settings.register(systemName, "actionEconomyMode", {
    name: game.i18n.localize("E20.ActionEconomyOptionMode"),
    hint: game.i18n.localize("E20.ActionEconomyOptionModeHint"),
    scope: "world",
    config: true,
    default: "track",
    type: String,
    choices: ACTION_ECONOMY_MODES,
  });

  /* Whether a CombatantGroup (Foundry v14's own shared-initiative primitive) shares one action
     budget across all its members, rather than each member tracking their own. Off by default -
     whether a Zord crew or a vehicle's passengers share an action economy is a rules question that
     differs by game line, so it's the GM's call rather than something hard-coded per actor type. */
  game.settings.register(systemName, "actionEconomyGroupBudget", {
    name: game.i18n.localize("E20.ActionEconomyOptionGroupBudget"),
    hint: game.i18n.localize("E20.ActionEconomyOptionGroupBudgetHint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /* Charging token movement against the Move action. Off by default and separate from the main
     mode setting, because Foundry fires preMoveToken only on the client initiating the move - so
     anything decided there is advisory rather than authoritative. See helpers/token-movement.mjs. */
  game.settings.register(systemName, "actionEconomyMovement", {
    name: game.i18n.localize("E20.ActionEconomyOptionMovement"),
    hint: game.i18n.localize("E20.ActionEconomyOptionMovementHint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /* -------------------------------------------- */
  /*  Scene Clock settings                        */
  /* -------------------------------------------- */
  /* Whether a combat ending refreshes once-per-encounter abilities. On by default, because that
     is exactly what they did before the Scene Clock existed - they were stamped with the combat's
     own id, so every new combat refreshed them. Once-per-SCENE abilities are unaffected either
     way; only the GM's own "New Scene" refreshes those. See helpers/scene-clock.mjs. */
  game.settings.register(systemName, "sceneClockAdvanceOnCombatEnd", {
    name: game.i18n.localize("E20.SceneClockOptionAdvanceOnCombatEnd"),
    hint: game.i18n.localize("E20.SceneClockOptionAdvanceOnCombatEndHint"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  /* The counters themselves, and the GM's label for the current scene. Not shown in the settings
     UI - they're driven by the New Scene control on the Story Points tracker. */
  game.settings.register(systemName, "sceneClockScene", {
    scope: "world", config: false, default: 1, type: Number,
  });

  game.settings.register(systemName, "sceneClockEncounter", {
    scope: "world", config: false, default: 1, type: Number,
  });

  game.settings.register(systemName, "sceneClockLabel", {
    scope: "world", config: false, default: "", type: String,
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

  /* -------------------------------------------- */
  /*  Guided tours                                */
  /* -------------------------------------------- */

  /* Whether the one-off "there are guided tours" chat card has been posted in this world yet.
     World-scoped rather than per-client so a table of five players gets one card between them,
     not one each; the card is posted to everyone and any of them can take it up. */
  game.settings.register(systemName, "tourWelcomeOffered", {
    scope: "world",
    default: false,
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

  /* -------------------------------------------- */
  /*  Compendium Browser settings                  */
  /* -------------------------------------------- */
  game.settings.register(systemName, "enabledSourcebooks", {
    scope: "world",
    default: {},
    type: Object,
    config: false,
  });

  game.settings.registerMenu(systemName, "enabledSourcebooksMenu", {
    name: "E20.CompendiumBrowserSourceConfigMenuLabel",
    label: "E20.CompendiumBrowserConfigureSources",
    hint: "E20.CompendiumBrowserSourceConfigMenuHint",
    icon: "fa-solid fa-book-atlas",
    type: CompendiumBrowserSourceConfig,
    restricted: true,
  });
};
