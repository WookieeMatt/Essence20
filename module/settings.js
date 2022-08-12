export const registerSettings = function () {
  let i18n = key => {
    return game.i18n.localize(key);
  };

  let systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

  let showoptions = {
    'on': game.i18n.localize("STORY_POINTS.alwaysshow"),
    'off': game.i18n.localize("STORY_POINTS.dontshow"),
    'toggle': game.i18n.localize("STORY_POINTS.allowtoggle"),
  };

  let loadoptions = {
    'everyone': game.i18n.localize("STORY_POINTS.everyone"),
    'gm': game.i18n.localize("STORY_POINTS.gm"),
    'players': game.i18n.localize("STORY_POINTS.players"),
  };

  game.settings.register(systemName, "load-option", {
    name: game.i18n.localize("STORY_POINTS.load-option.name"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: loadoptions,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "show-option", {
    name: game.i18n.localize("STORY_POINTS.show-option.name"),
    hint: game.i18n.localize("STORY_POINTS.show-option.hint"),
    scope: "client",
    config: true,
    default: "toggle",
    type: String,
    choices: showoptions,
    onChange: debouncedReload
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
