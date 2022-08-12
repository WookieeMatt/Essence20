import { registerSettings } from "./settings.js";

export class StoryPoints extends Application {
  gmPoints = game.settings.get('essence20', 'gm-points');
  storyPoints = game.settings.get('essence20', 'story-points');

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
      gmPoints: this.gmPoints,
      storyPoints: this.storyPoints,
    };
  }

  changeGmPoints(value) {
    this.gmPoints = value;
    $('#gmpoints-input', this.element).val(value);
    game.settings.set('essence20', 'gm-points', value);
  }

  changeStoryPoints(value) {
    this.storyPoints = value;
    $('#storypoints-input', this.element).val(value);
    game.settings.set('essence20', 'story-points', value);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('#gmpoints-btn-hurt').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(Math.max(0, this.gmPoints - 1));
    });
    html.find('#gmpoints-btn-heal').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(this.gmPoints + 1);
    });


    html.find('#storypoints-btn-hurt').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(Math.max(0, this.storyPoints - 1));
    });
    html.find('#storypoints-btn-heal').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(this.storyPoints + 1);
    });
  }
}

Hooks.on('init', () => {
  registerSettings();
});
