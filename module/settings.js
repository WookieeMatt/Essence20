export const registerSettings = function () {
  let systemName = "essence20";

  const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

  /* -------------------------------------------- */
  /*  Story Points Tracker settings               */
  /* -------------------------------------------- */

  const SHOW_OPTIONS = {
    on: game.i18n.localize("E20.spt.show.always"),
    off: game.i18n.localize("E20.spt.show.never"),
    toggle: game.i18n.localize("E20.spt.show.toggle"),
  };

  const ACCESS_OPTIONS = {
    everyone: game.i18n.localize("E20.spt.users.everyone"),
    gm: game.i18n.localize("E20.spt.users.gm"),
  };

  /* -------------------------------------------- */
  /*  Config settings                             */
  /* -------------------------------------------- */
  game.settings.register(systemName, "sptAccess", {
    name: game.i18n.localize("E20.spt.options.access.name"),
    scope: "world",
    config: true,
    default: "everyone",
    type: String,
    choices: ACCESS_OPTIONS,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "sptGmPointsArePublic", {
    name: game.i18n.localize("E20.spt.options.gmPointsArePublic.name"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "sptShow", {
    name: game.i18n.localize("E20.spt.options.show.name"),
    scope: "client",
    config: true,
    default: "toggle",
    type: String,
    choices: SHOW_OPTIONS,
    onChange: debouncedReload
  });

  game.settings.register(systemName, "sptMessage", {
    name: game.i18n.localize("E20.spt.options.message.name"),
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
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
