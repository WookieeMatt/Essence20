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

  game.settings.register(systemName, "resourcename", {
    name: i18n("STORY_POINTS.resourcename.name"),
    hint: i18n("STORY_POINTS.resourcename.hint"),
    scope: "world",
    default: (game.system.primaryTokenAttribute ?? game.system.data?.primaryTokenAttribute) || 'attributes.hp',
    type: String,
    config: true
  });

  game.settings.register(systemName, "add-defeated", {
    name: i18n("STORY_POINTS.add-defeated.name"),
    hint: i18n("STORY_POINTS.add-defeated.hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true
  });

  game.settings.register(systemName, "clear-savingthrows", {
    name: i18n("STORY_POINTS.clear-savingthrows.name"),
    hint: i18n("STORY_POINTS.clear-savingthrows.hint"),
    scope: "world",
    default: true,
    type: Boolean,
    config: true
  });

  game.settings.register(systemName, "clear-after-enter", {
    name: i18n("STORY_POINTS.clear-after-enter.name"),
    hint: i18n("STORY_POINTS.clear-after-enter.hint"),
    scope: "client",
    default: true,
    type: Boolean,
    config: true
  });

  game.settings.register(systemName, "double-click", {
    name: i18n("STORY_POINTS.double-click.name"),
    hint: i18n("STORY_POINTS.double-click.hint"),
    scope: "client",
    default: false,
    type: Boolean,
    config: true
  });

  game.settings.register(systemName, "allow-bar-click", {
    name: i18n("STORY_POINTS.allow-bar-click.name"),
    hint: i18n("STORY_POINTS.allow-bar-click.hint"),
    scope: "client",
    default: false,
    type: Boolean,
    config: true
  });

  /*
  game.settings.register(systemName, "gm-only", {
      name: i18n("STORY_POINTS.gm-only.name"),
      hint: i18n("STORY_POINTS.gm-only.hint"),
      scope: "world",
      default: false,
      type: Boolean,
      config: true
  });
  */

  //if (game.user.isGM || !game.settings.get("always-hp", "gm-only")){
  game.settings.register(systemName, "show-dialog", {
    name: i18n("STORY_POINTS.show-dialog.name"),
    hint: i18n("STORY_POINTS.show-dialog.hint"),
    scope: "client",
    default: true,
    type: Boolean,
    config: false
  });
  //}
}
