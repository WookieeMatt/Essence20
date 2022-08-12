import { registerSettings } from "./settings.js";

export let i18n = key => {
  return game.i18n.localize(key);
};
export let setting = key => {
  return game.settings.get("essence20", key);
};

export class StoryPoints extends Application {
  gmPoints = 0;
  storyPoints = 0;

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
      storyPoints: 0,
    });
  }

  getData() {
    return {
        storyPoints: this.storyPoints,
    };
  }

  changePoints(value) {
    this.storyPoints = value;
    console.log(this.element)
    $('#storypoints-input', this.element).val(value);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#storypoints-btn-hurt').click(ev => {
        ev.preventDefault();
        console.log('set character to hurt');
        this.changePoints(Math.max(0, this.storyPoints - 1));
    });
    html.find('#storypoints-btn-heal').click(ev => {
        ev.preventDefault();
        console.log('set character to heal');
        this.changePoints(this.storyPoints + 1);
    });
  }
}

Hooks.on('init', () => {
  registerSettings();
});
