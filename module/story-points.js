import { registerSettings } from "./settings.js";

export let i18n = key => {
    return game.i18n.localize(key);
};
export let setting = key => {
    return game.settings.get("essence20", key);
};

export class StoryPoints extends Application {
  tokenname = '';
  tokenstat = '';
  tokentemp = '';
  tokentooltip = '';
  color = "";
  valuePct = null;
  tempPct = null;

  static get defaultOptions() {
    let pos = null;
    return mergeObject(super.defaultOptions, {
      id: "story-points",
      template: "./systems/essence20/templates/story-points.hbs",
      classes: ["story-points"],
      popOut: true,
      resizable: false,
      top: pos?.top || 60,
      left: pos?.left || (($('#board').width / 2) - 150),
      width: 300,
    });
  }
}

Hooks.on('init', () => {
  registerSettings();
});
