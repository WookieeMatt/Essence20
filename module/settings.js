import CompendiumBrowserSourceConfig from "./apps/compendium-browser-sources.mjs";
import BookDescriptionImporter from "./apps/book-description-importer.mjs";
import AdventureImporter from "./apps/adventure-importer.mjs";
import { invalidateImportedDescriptions } from "./helpers/book-descriptions-store.mjs";
import { applyGameLineToSourcebooks } from "./helpers/compendium-browser.mjs";
import { E20 } from "./helpers/config.mjs";

export const setting = (key) => {
  return game.settings?.get("essence20", key) ?? "default";
};

/**
 * The game line this world is running, or "" when every line is available.
 *
 * Not routed through setting(): its not-ready fallback is the string "default", which is a
 * real theme name but not a real game line, and would read as a line nobody selected.
 * @returns {string} A key of E20.gameVersions, or "".
 */
export const getGameLine = () => game.settings?.get("essence20", "gameLine") ?? "";

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

/** The sheet frame theme class, e.g. "theme-default" or "theme-pony". */
export const getDefaultTheme = () => {
  const theme = setting("sheetTheme");
  return `theme-${theme}`;
};

/** The key this setting used to live under, kept only so its value can be carried across. */
const LEGACY_SHEET_THEME_KEY = "sptDefaultTheme";

/**
 * Carry a player's sheet theme across from the old sptDefaultTheme key to sheetTheme.
 *
 * The old key was named for the Story Point Tracker, which it has nothing to do with - it picks
 * the frame theme for every sheet in the system. Renaming a settings key does not move what is
 * already stored under it, so the old one stays registered (hidden) purely to be read once.
 *
 * This is client-scoped, so it runs once per browser rather than once per world: there is no
 * world-side pass that could do it on everyone's behalf.
 *
 * Idempotent by consuming the old value: the legacy key is blanked, so a second run finds
 * nothing to carry. That matters beyond just saving work - without it, a player who later chose
 * Sci-fi on the new key would have Pony silently restored from the old one on their next load.
 *
 * The legacy key is cleared BEFORE the new one is written. Writing sheetTheme fires its
 * onChange, which reloads the page; clearing first means the reload cannot strand a value that
 * would migrate all over again. (The legacy registration has no onChange of its own, so
 * clearing it reloads nothing.) One extra reload, once per browser, on first load after this
 * upgrade.
 * @returns {Promise<boolean>} Whether anything was carried across.
 */
export const migrateSheetThemeSetting = async () => {
  let legacy;
  try {
    legacy = game.settings.get("essence20", LEGACY_SHEET_THEME_KEY);
  } catch {
    return false;   // never registered in this world - nothing to carry
  }

  // "" is the consumed marker; "default" is the old default, which needs no carrying.
  if (!legacy || legacy === "default") {
    return false;
  }

  await game.settings.set("essence20", LEGACY_SHEET_THEME_KEY, "");
  await game.settings.set("essence20", "sheetTheme", legacy);
  return true;
};

/**
 * Swap an element's theme-light/theme-dark class for the currently active one.
 * Always removes both first so a stale class can't linger and win the cascade
 * over the newly-added one.
 * @param {HTMLElement} element
 */
/** Every frame theme this system offers, so a stale one can always be cleared. */
const FRAME_THEME_CLASSES = ["theme-default", "theme-pony"];

export const applyThemeClass = (element) => {
  if (!element) return;
  element.classList.remove("theme-light", "theme-dark");
  const themeClass = getCurrentThemeClass();
  if (themeClass) element.classList.add(themeClass);

  // The frame theme is a second, independent axis: theme-light/theme-dark comes from
  // Foundry's own colour scheme, while this comes from the system's "Default sheet theme"
  // setting. They combine - theme-pony + theme-dark is the MLP dark mode, theme-pony +
  // theme-light the MLP light one - which is why this adds a class rather than replacing
  // the colour-scheme one.
  //
  // Nothing applied this before: getDefaultTheme() was exported and never called, so the
  // theme-pony rules in _theme_wrapper.scss had never once matched an element and the
  // setting appeared to do nothing.
  element.classList.remove(...FRAME_THEME_CLASSES);
  const frameClass = getDefaultTheme();
  if (FRAME_THEME_CLASSES.includes(frameClass)) element.classList.add(frameClass);
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

/* -------------------------------------------- */
/*  Settings UI grouping                        */
/* -------------------------------------------- */

/**
 * The headings drawn over this system's settings, each naming the first setting beneath it.
 *
 * Foundry has no native grouping to hand: game.settings.register() takes no group or category
 * option (checked against v14.364), and the Settings app renders one flat list of .form-group
 * per namespace in registration order. So the order lives in registerSettings() and the
 * headings are drawn over it here.
 *
 * Submenus are the one thing Foundry does render out of order - always first - so the
 * Compendium Browser group leads whatever registerSettings() does.
 * @type {{label: string, firstKey: string}[]}
 */
export const SETTING_GROUPS = [
  { label: "E20.SettingsGroupCompendiumBrowser", firstKey: "enabledSourcebooksMenu" },
  { label: "E20.SettingsGroupBookDescriptions", firstKey: "bookDescriptionsMenu" },
  { label: "E20.SettingsGroupAdventure", firstKey: "adventureImporterMenu" },
  { label: "E20.SettingsGroupGameLine", firstKey: "gameLine" },
  { label: "E20.SettingsGroupStoryPointTracker", firstKey: "sptAccess" },
  { label: "E20.SettingsGroupCombat", firstKey: "actionEconomyMode" },
  { label: "E20.SettingsGroupSheets", firstKey: "sheetTheme" },
  { label: "E20.SettingsGroupThreats", firstKey: "monsterGrowHealthMode" },
];

/**
 * Insert the group headings into Foundry's Settings app.
 *
 * Only our own tab is touched, and a group whose first setting is not on the page is skipped
 * rather than guessed at - a setting can be absent because it is GM-only, or because someone
 * removed it and forgot this table. Either way a missing heading beats a misplaced one.
 * @param {HTMLElement} html The rendered SettingsConfig element.
 */
export const insertSettingGroupHeadings = (html) => {
  const section = html?.querySelector?.('section.tab[data-category="system"]');
  if (!section) return;

  for (const { label, firstKey } of SETTING_GROUPS) {
    const id = `essence20.${firstKey}`;
    // A plain setting is found by its control's name; a submenu renders a button instead.
    const control = section.querySelector(`[name="${id}"]`)
      ?? section.querySelector(`button[data-key="${id}"]`);
    const row = control?.closest(".form-group");
    if (!row) continue;
    // Re-renders re-run this hook; without the guard each one stacks another heading.
    if (row.previousElementSibling?.classList.contains("e20-settings-group")) continue;

    const heading = document.createElement("h3");
    heading.className = "e20-settings-group";
    heading.textContent = game.i18n.localize(label);
    row.before(heading);
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
  /*                                              */
  /*  Grouped, and the order matters. Foundry has no native grouping for settings:
      register() takes no group or category option (checked against v14.364) and the system tab
      renders one flat list in REGISTRATION order. So these calls ARE the display order, and the
      headings are drawn over them by insertSettingGroupHeadings(). Moving a setting between
      groups means moving its register() call; SETTING_GROUPS names the first key of each. */
  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Game Line                                   */
  /* -------------------------------------------- */

  /* Which of the five lines this world is playing. It names the Party sheet ("Strike Team",
     "Ranger Team", ...), decides whether that sheet offers Requisition at all, and on change
     switches off the other lines' sourcebooks - see applyGameLineToSourcebooks(). */
  game.settings.register(systemName, "gameLine", {
    name: game.i18n.localize("E20.SettingsGameLine"),
    hint: game.i18n.localize("E20.SettingsGameLineHint"),
    scope: "world",
    config: true,
    default: "",
    type: String,
    choices: {
      "": game.i18n.localize("E20.SettingsGameLineAll"),
      ...Object.fromEntries(Object.entries(E20.gameVersions)
        .map(([key, label]) => [key, game.i18n.localize(label)])),
    },
    onChange: async (line) => {
      await applyGameLineToSourcebooks(line);
      // The Party sheet takes its title, its sidebar caption and whether it shows the
      // Requisition tab from this setting, so any open one is now stale.
      for (const app of foundry.applications.instances.values()) {
        if (app.document?.type === "party") {
          app.render();
        }
      }

      // The tracker shows or hides the GM pool by line (My Little Pony has none).
      game.StoryPointsTracker?.render(false);
    },
  });

  /* -------------------------------------------- */
  /*  Story Point Tracker                         */
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
  /*  Combat                                      */
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

  /* -- Scene Clock ----------------------------- */
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

  /* -------------------------------------------- */
  /*  Sheets                                      */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sheetTheme", {
    name: game.i18n.localize("E20.ThemeOptionLabel"),
    hint: game.i18n.localize("E20.ThemeOptionHint"),
    scope: "client",
    config: true,
    default: "default",
    type: String,
    choices: THEME_OPTIONS,
    onChange: debouncedReload,
  });

  /* The key the setting above used to use. Registered only so migrateSheetThemeSetting() can
     read whatever a player already chose; hidden from the UI, and deliberately WITHOUT
     onChange, because the migration writes to it and a debouncedReload there would reload the
     page in the middle of migrating. Safe to delete once no world is upgrading from before
     the rename. */
  game.settings.register(systemName, LEGACY_SHEET_THEME_KEY, {
    scope: "client",
    config: false,
    default: "default",
    type: String,
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

  /* -------------------------------------------- */
  /*  Threats                                     */
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

  /* -------------------------------------------- */
  /*  Scene Clock state                           */
  /* -------------------------------------------- */
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

  // Where the points lived before they moved onto the primary Party (helpers/party.mjs moves
  // them across once and zeroes these). Still registered so that migration can read them.
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

  // The Party actor pinned as primary (Essence20Actors#party), which holds the Story Point
  // pool. "" = none - only ever briefly, since helpers/party.mjs pins one at every GM ready.
  game.settings.register(systemName, "primaryParty", {
    scope: "world",
    default: "",
    type: String,
    config: false,
    onChange: () => {
      ui.actors?.render();
      game.StoryPointsTracker?.render(false);
    },
  });

  // Per-client { [partyId]: boolean } expand/collapse state for the Actors-sidebar party
  // folders (used by the custom ActorDirectory in a later PR).
  game.settings.register(systemName, "partyFolderState", {
    scope: "client",
    default: {},
    type: Object,
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

  /* Item descriptions a GM has pulled out of their own copy of a rulebook, shaped as
     { [book]: { descriptions: { [compendium uuid]: text }, purchaser, purchaseDate, ... } }.

     World-scoped and config:false on purpose. This is the ONLY place imported book text is
     kept: it must never reach packs/, because those are the system's own files and would
     carry Renegade's text into the repository and out to every install. Living in the world
     means it stays with the GM who imported it. documents/item.mjs reads it back.

     Size: roughly 150KB per core rulebook (the GI Joe CRB matches 351 entries at a ~250
     character median), so a table with every book they own imported lands well under a
     megabyte. Worth knowing, since world settings load in full at startup. */
  game.settings.register(systemName, "bookDescriptions", {
    scope: "world",
    default: {},
    type: Object,
    config: false,
    // Another client importing a book, or this one clearing one, both land here.
    onChange: invalidateImportedDescriptions,
  });


  game.settings.registerMenu(systemName, "enabledSourcebooksMenu", {
    name: "E20.CompendiumBrowserSourceConfigMenuLabel",
    label: "E20.CompendiumBrowserConfigureSources",
    hint: "E20.CompendiumBrowserSourceConfigMenuHint",
    icon: "fa-solid fa-book-atlas",
    type: CompendiumBrowserSourceConfig,
    restricted: true,
  });

  /* -------------------------------------------- */
  /*  Book Descriptions                           */
  /* -------------------------------------------- */

  game.settings.registerMenu(systemName, "bookDescriptionsMenu", {
    name: "E20.BookImportMenuLabel",
    label: "E20.BookImportMenuButton",
    hint: "E20.BookImportMenuHint",
    icon: "fa-solid fa-book-open-reader",
    type: BookDescriptionImporter,
    restricted: true,
  });

  /* -------------------------------------------- */
  /*  Adventures                                  */
  /* -------------------------------------------- */

  game.settings.registerMenu(systemName, "adventureImporterMenu", {
    name: "E20.AdventureImportMenuLabel",
    label: "E20.AdventureImportMenuButton",
    hint: "E20.AdventureImportMenuHint",
    icon: "fa-solid fa-book-atlas",
    type: AdventureImporter,
    restricted: true,
  });
};
