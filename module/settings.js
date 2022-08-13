export const registerSettings = function () {
  let systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

  let showoptions = {
    'on': game.i18n.localize("E20.STORY_POINTS.alwaysShow"),
    'off': game.i18n.localize("E20.STORY_POINTS.dontShow"),
    'toggle': game.i18n.localize("E20.STORY_POINTS.allowToggle"),
  };

  let loadoptions = {
    'everyone': game.i18n.localize("E20.STORY_POINTS.everyone"),
    'gm': game.i18n.localize("E20.STORY_POINTS.gm"),
    'players': game.i18n.localize("E20.STORY_POINTS.players"),
  };

  /* -------------------------------------------- */
  /*  Config settings                             */
  /* -------------------------------------------- */
  game.settings.register(systemName, "load-option", {
    name: game.i18n.localize("E20.STORY_POINTS.loadOption.name"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: loadoptions,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "modify-story-points-option", {
    name: game.i18n.localize("E20.STORY_POINTS.modifyStoryPointsOption.name"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "show-option", {
    name: game.i18n.localize("E20.STORY_POINTS.showOption.name"),
    scope: "client",
    config: true,
    default: "toggle",
    type: String,
    choices: showoptions,
    onChange: debouncedReload
  });

  /* -------------------------------------------- */
  /*  System state                                */
  /* -------------------------------------------- */
  game.settings.register(systemName, "show-dialog", {
    scope: "client",
    default: true,
    type: Boolean,
    config: false
  });

  game.settings.register(systemName, "gm-points", {
    scope: "global",
    default: 0,
    type: Number,
    config: false
  });

  game.settings.register(systemName, "story-points", {
    scope: "global",
    default: 0,
    type: Number,
    config: false
  });
}
