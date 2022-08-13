import { registerSettings } from "./settings.js";
export let i18n = key => {
  return game.i18n.localize(key);
};
export let setting = key => {
  return game.settings.get("essence20", key);
};

/* -------------------------------------------- */
/*  Story Points Tracker Dialog                 */
/* -------------------------------------------- */

export class StoryPointsTracker extends Application {
  gmPoints = game.settings.get('essence20', 'gm-points');
  storyPoints = game.settings.get('essence20', 'story-points');

  static get defaultOptions() {
    let pos = game.user.getFlag("essence20", "storyPointsTrackerPos");
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

  // Returns true if the current user is able to modify Story Points and false otherwise
  get canChangeStoryPoints() {
    return game.user.isGM || (setting("modify-story-points-option"));
  }

  // Handles changing GM Points to given value
  changeGmPoints(value) {
    if (game.user.isGM) {
      this.gmPoints = Math.max(0, value);
      $('#gm-points-input', this.element).val(this.gmPoints);
      game.settings.set('essence20', 'gm-points', this.gmPoints);
    } else {
      $('#gm-points-input', this.element).val(this.gmPoints);
    }
  }

  // Handles changing Story Points to given value
  changeStoryPoints(value) {
    if (this.canChangeStoryPoints) {
      this.storyPoints = Math.max(0, value);
      $('#story-points-input', this.element).val(this.storyPoints);
      game.settings.set('essence20', 'story-points', this.storyPoints);
    } else {
      $('#story-points-input', this.element).val(this.storyPoints);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // GM Points changes
    html.find('#gm-points-btn-hurt').click(ev => {
      ev.preventDefault();
      if (game.user.isGM) {
        this.changeGmPoints(this.gmPoints - 1);
        this.sendMessage(`${i18n("E20.STORY_POINTS.gmPointSpent")}`);
      }
    });
    html.find('#gm-points-btn-heal').click(ev => {
      ev.preventDefault();
      if (game.user.isGM) {
        this.changeGmPoints(this.gmPoints + 1);
      }
    });
    html.find('#gm-points-input').focusout(ev => {
      ev.preventDefault();
      let value = $('#gm-points-input', this.element).val();
      this.changeGmPoints(value);
    });

    // Story Points changes
    html.find('#story-points-btn-hurt').click(ev => {
      ev.preventDefault();
      if (this.canChangeStoryPoints) {
        this.changeStoryPoints(this.storyPoints - 1);
        this.sendMessage(`${i18n("E20.STORY_POINTS.storyPointSpent")}`);
      }
    });
    html.find('#story-points-btn-heal').click(ev => {
      ev.preventDefault();
      if (this.canChangeStoryPoints) {
        this.changeStoryPoints(this.storyPoints + 1);
      }
    });
    html.find('#story-points-input').focusout(ev => {
      ev.preventDefault();
      let value = $('#story-points-input', this.element).val();
      this.changeStoryPoints(value);
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

  // Handles clicking Close button or toggling in toolbar
  async close(options) {
    // Deactivate in toolbar
    let toggleDialogControl = ui.controls.controls
      .find(control => control.name === "token").tools
      .find(control => control.name === "toggleDialog");
    toggleDialogControl.active = false;
    toggleDialogControl.onClick(true)
    ui.controls.render();

    super.close(options);
    game.StoryPointsTracker = null;
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on('init', () => {
  registerSettings();
});

Hooks.on('ready', () => {
  // Display the dialog if settings permit
  if ((setting("show-option") == 'on' || (setting("show-option") == 'toggle' && setting("show-dialog")))
    && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM))) {
    game.StoryPointsTracker = new StoryPointsTracker().render(true);
  }

  // Create hook that helps with persisting dialog position
  let oldDragMouseUp = Draggable.prototype._onDragMouseUp;
  Draggable.prototype._onDragMouseUp = function (event) {
    Hooks.call(`dragEnd${this.app.constructor.name}`, this.app);
    return oldDragMouseUp.call(this, event);
  }
});

// Persists dialog position when moved by the user
Hooks.on('dragEndStoryPointsTracker', (app) => {
  game.user.setFlag("essence20", "storyPointsTrackerPos", { left: app.position.left, top: app.position.top });
})

// Init the button in the controls for toggling the dialog
Hooks.on("getSceneControlButtons", (controls) => {
  if (setting("show-option") == 'toggle' && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM))) {
    let tokenControls = controls.find(control => control.name === "token")
    tokenControls.tools.push({
      name: "toggleDialog",
      title: "E20.STORY_POINTS.toggleDialog",
      icon: "fas fa-circle-s",
      toggle: true,
      active: setting('show-dialog'),
      onClick: toggled => {
        game.settings.set('essence20', 'show-dialog', toggled);
        if (toggled) {
          if (!game.StoryPointsTracker) {
            game.StoryPointsTracker = new StoryPointsTracker().render(true);
          }
        } else {
          if (game.StoryPointsTracker) {
            game.StoryPointsTracker.close();
          }
        }
      }
    });
  }
});
