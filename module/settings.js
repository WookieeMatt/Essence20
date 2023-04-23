export const registerSettings = function () {
  let systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

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

  let POINTS_NAME_OPTIONS = {};
  for (let [name, str] of Object.entries(CONFIG.E20.pointsNameOptions)) {
    POINTS_NAME_OPTIONS[name] = game.i18n.localize(str);
  }

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
    default: POINTS_NAME_OPTIONS.story,
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
}
