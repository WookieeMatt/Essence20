import { registerSettings } from "./settings.js";
export let i18n = key => {
  return game.i18n.localize(key);
};

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
      title: i18n('E20.STORY_POINTS.title'),
    });
  }

  // Data to be access within the template
  getData() {
    return {
      gmPoints: this.gmPoints,
      storyPoints: this.storyPoints,
    };
  }

  // Handles changing GM Points to given value
  changeGmPoints(value) {
    this.gmPoints = value;
    $('#gmpoints-input', this.element).val(value);
    game.settings.set('essence20', 'gm-points', value);
  }

  // Handles changing Story Points to given value
  changeStoryPoints(value) {
    this.storyPoints = value;
    $('#storypoints-input', this.element).val(value);
    game.settings.set('essence20', 'story-points', value);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // GM Point clicks
    html.find('#gmpoints-btn-hurt').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(Math.max(0, this.gmPoints - 1));
      this.sendMessage(`${i18n("E20.STORY_POINTS.gmPointSpent")}`);
    });
    html.find('#gmpoints-btn-heal').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(this.gmPoints + 1);
    });

    // Story Point clicks
    html.find('#storypoints-btn-hurt').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(Math.max(0, this.storyPoints - 1));
      this.sendMessage(`${i18n("E20.STORY_POINTS.storyPointSpent")}`);
    });
    html.find('#storypoints-btn-heal').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(this.storyPoints + 1);
    });
  }

  // Outputs given message to chat
  sendMessage(content) {
    const speaker = ChatMessage.getSpeaker({ user: game.user.id });

    let messageData = {
      user: game.user.id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content,
    };

    ChatMessage.create(messageData);
  }
}

Hooks.on('init', () => {
  registerSettings();
});
