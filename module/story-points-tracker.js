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
  gmPoints = game.settings.get('essence20', 'sptGmPoints');
  storyPoints = game.settings.get('essence20', 'sptStoryPoints');

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
      title: i18n('E20.SptTitle'),
    });
  }

  // Data to be access within the template
  getData() {
    return {
      gmPoints: this.gmPoints,
      storyPoints: this.storyPoints,
      isGm: game.user.isGM,
      gmPointsArePublic: game.user.isGM || setting('sptGmPointsArePublic'),
    };
  }

  // Handles changing GM Points to given value
  changeGmPoints(value) {
    if (game.user.isGM) {
      this.gmPoints = Math.max(0, value);
      $('#gm-points-input', this.element).val(this.gmPoints);
      game.settings.set('essence20', 'sptGmPoints', this.gmPoints);
      this.updateClients();
    } else {
      $('#gm-points-input', this.element).val(this.gmPoints);
    }
  }

  // Handles changing Story Points to given value
  changeStoryPoints(value) {
    if (game.user.isGM) {
      this.storyPoints = Math.max(0, value);
      $('#story-points-input', this.element).val(this.storyPoints);
      game.settings.set('essence20', 'sptStoryPoints', this.storyPoints);
      this.updateClients();
    } else {
      $('#story-points-input', this.element).val(this.storyPoints);
    }
  }

  // Called when the GM modifies a point value to update clients/players
  updateClients() {
    game.socket.emit('system.essence20', {
      gmPoints: this.gmPoints,
      storyPoints: this.storyPoints,
    });
  }

  // Called when a client/player receives an update from the GM
  handleUpdate(data) {
    this.gmPoints = data.gmPoints;
    $('#gm-points-input', this.element).val(this.gmPoints);
    this.storyPoints = data.storyPoints;
    $('#story-points-input', this.element).val(this.storyPoints);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // GM Points changes
    html.find('#gm-points-btn-dec').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(this.gmPoints - 1);
      this.sendMessage(`${i18n("E20.SptSpendGmPoint")}`);
    });
    html.find('#gm-points-btn-inc').click(ev => {
      ev.preventDefault();
      this.changeGmPoints(this.gmPoints + 1);
      this.sendMessage(`${i18n("E20.SptAddGmPoint")}`);
    });
    html.find('#gm-points-input').focusout(ev => {
      ev.preventDefault();
      let value = $('#gm-points-input', this.element).val();
      this.changeGmPoints(value);
      this.sendMessage(`${i18n("E20.SptSetGmPoints")} ${value}!`);
    });

    // Roll new major scene GM Points
    html.find('#major-scene-points-button').click(async (ev) => {
      ev.preventDefault();
      const user = game.user;
      if (user.isGM) {
        let roll = new Roll('d2 + 1');
        await roll.toMessage({
          speaker: game.user.name,
          flavor: `${i18n("E20.SptRollFlavor")}`,
          rollMode: game.settings.get('core', 'rollMode'),
        });
        this.changeGmPoints(this.gmPoints + roll.total);
      }
    });

    // Story Points changes
    html.find('#story-points-btn-dec').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(this.storyPoints - 1);
      this.sendMessage(`${i18n("E20.SptSpendStoryPoint")}`);
    });
    html.find('#story-points-btn-inc').click(ev => {
      ev.preventDefault();
      this.changeStoryPoints(this.storyPoints + 1);
      this.sendMessage(`${i18n("E20.SptAddStoryPoint")}`);
    });
    html.find('#story-points-input').focusout(ev => {
      ev.preventDefault();
      let value = $('#story-points-input', this.element).val();
      this.changeStoryPoints(value);
      this.sendMessage(`${i18n("E20.SptSetStoryPoints")} ${value}!`);
    });
  }

  // Outputs given message to chat
  sendMessage(content) {
    if (setting('sptMessage')) {
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

  // Handles clicking Close button or toggling in toolbar
  async close() {
    // Deactivate in toolbar
    let toggleDialogControl = ui.controls.controls
      .find(control => control.name === "token").tools
      .find(control => control.name === "toggleDialog");
    toggleDialogControl.active = false;
    toggleDialogControl.onClick(false)
    ui.controls.render();

    this.closeSpt();
  }

  // Helper close method that's called after toggling off in the toolbar
  closeSpt() {
    super.close();
    game.StoryPointsTracker = null;
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on('init', () => {
  registerSettings();

  // Clients (players) listen on the socket to update the UI whenever the GM changes values
  game.socket.on('system.essence20', (data) => {
    game.StoryPointsTracker.handleUpdate(data);
  });
});

Hooks.on('ready', () => {
  // Display the dialog if settings permit
  if ((setting("sptShow") == 'on' || (setting("sptShow") == 'toggle' && setting("sptToggleState")))
    && (setting("sptAccess") == 'everyone' || (setting("sptAccess") == 'gm' == game.user.isGM))) {
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
  if (setting("sptShow") == 'toggle' && (setting("sptAccess") == 'everyone' || (setting("sptAccess") == 'gm' == game.user.isGM))) {
    let tokenControls = controls.find(control => control.name === "token")
    tokenControls.tools.push({
      name: "toggleDialog",
      title: "E20.SptToggleDialog",
      icon: "fas fa-circle-s",
      toggle: true,
      active: setting('sptToggleState'),
      onClick: toggled => {
        if (toggled) {
          if (!game.StoryPointsTracker) {
            game.settings.set('essence20', 'sptToggleState', true);
            game.StoryPointsTracker = new StoryPointsTracker().render(true);
          }
        } else {
          game.settings.set('essence20', 'sptToggleState', false);
          game.StoryPointsTracker.closeSpt();
        }
      }
    });
  }
});
