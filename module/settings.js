export const registerSettings = function () {
  let systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

  /* -------------------------------------------- */
  /*  Story Points Tracker settings               */
  /* -------------------------------------------- */

  const SHOW_OPTIONS = {
    on: game.i18n.localize("E20.STORY_POINTS.alwaysShow"),
    off: game.i18n.localize("E20.STORY_POINTS.dontShow"),
    toggle: game.i18n.localize("E20.STORY_POINTS.allowToggle"),
  };

  const ACCESS_OPTIONS = {
    everyone: game.i18n.localize("E20.STORY_POINTS.everyone"),
    gm: game.i18n.localize("E20.STORY_POINTS.gm"),
    players: game.i18n.localize("E20.STORY_POINTS.players"),
  };

  /* -------------------------------------------- */
  /*  Config settings                             */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sptAccess", {
    name: game.i18n.localize("E20.STORY_POINTS.options.access.name"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: ACCESS_OPTIONS,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "sptShow", {
    name: game.i18n.localize("E20.STORY_POINTS.options.show.name"),
    scope: "client",
    config: true,
    default: "toggle",
    type: String,
    choices: SHOW_OPTIONS,
    onChange: debouncedReload
  });

  /* -------------------------------------------- */
  /*  System state                                */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sptToggleState", {
    scope: "client",
    default: true,
    type: Boolean,
    config: false
  });

  game.settings.register(systemName, "sptGmPoints", {
    scope: "world",
    default: 0,
    type: Number,
    config: false
  });

  game.settings.register(systemName, "sptStoryPoints", {
    scope: "world",
    default: 0,
    type: Number,
    config: false
  });
}
