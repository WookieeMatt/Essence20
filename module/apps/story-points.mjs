const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { registerSettings, getDefaultTheme } from "./settings.js";

function getPointsName(plural) {
  return `${
    CONFIG.E20.pointsNameOptions[setting("sptPointsName")]
  } ${game.i18n.localize(plural ? "E20.SptPointPlural" : "E20.SptPoint")}`;
}

export class StoryPoints extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(gmPoints, storyPoints) {
    super();
    this._gmPoints = gmPoints;
    this._storyPoints = storyPoints;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "story-points",
    classes: [
      "essence20",
      "theme-wrapper",
      getDefaultTheme(),
      "sliced-border --thick",
      "window-app", // can we remove?
    ],
    title: "",
    actions: {
      decrementGmPoints: StoryPoints.decrementGmPoints,
      incrementGmPoints: StoryPoints.incrementGmPoints,
      directSetGmPoints: StoryPoints.directSetGmPoints,
      decrementStoryPoints: StoryPoints.decrementStoryPoints,
      incrementStoryPoints: StoryPoints.incrementStoryPoints,
      directSetStoryPoints: StoryPoints.directSetStoryPoints,
      rollMajorSceneGmPoints: StoryPoints.rollMajorSceneGmPoints,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/story-points.hbs",
    },
  };

  get title() {
    return (
      game.i18n.localize(this._title, { name: getPointsName(false) }) ||
      game.i18n.localize(super.title, { name: getPointsName(false) })
    );
  }

  _prepareContext() {
    return {
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
      defaultTheme: getDefaultTheme(),
      isGm: game.user.isGM,
      gmPointsArePublic: game.user.isGM || setting("sptGmPointsArePublic"),
      pointsName: getPointsName(true),
    };
  }

  /**
   * Functions
   */

  changeGmPoints(value) {
    if (game.user.isGM) {
      this._gmPoints = Math.max(0, value);
      this.element.getElementById("gm-points-input").value = this._gmPoints;
      game.settings.set("essence20", "sptGmPoints", this._gmPoints);
      this.updateClients();
    } else {
      this.element.getElementById("gm-points-input").value = this._gmPoints;
    }
  }

  changeStoryPoints(value) {
    if (game.user.isGM) {
      this._storyPoints = Math.max(0, value);
      this.element.getElementById("story-points-input").value =
        this._storyPoints;
      game.settings.set("essence20", "sptStoryPoints", this._storyPoints);
      this.updateClients();
    } else {
      this.element.getElementById("story-points-input").value =
        this._storyPoints;
    }
  }

  updateClients() {
    game.socket.emit("system.essence20", {
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
      defaultTheme: getDefaultTheme(),
    });
  }

  // Called when a client/player receives an update from the GM
  handleUpdate(data) {
    this._gmPoints = data.gmPoints;
    this.element.getElementById("gm-points-input").value = this._gmPoints;
    this._storyPoints = data.storyPoints;
    this.element.getElementById("story-points-input").value = this._storyPoints;
  }

  // Outputs given message to chat
  sendMessage(content) {
    if (game.settings.get("essence20", "sptMessage")) {
      const speaker = ChatMessage.getSpeaker({ user: game.user.id });

      const messageData = {
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
    const toggleDialogControl = ui.controls.controls.tokens.tools.sptTracker;
    toggleDialogControl.active = false;
    toggleDialogControl.onChange(false);
    ui.controls.render();

    this.closeSpt();
  }

  // Helper close method that's called after toggling off in the toolbar
  closeSpt() {
    super.close();
    game.StoryPointsTracker = null;
  }

  /**
   * Actions
   */

  decrementGmPoints() {
    this.changeGmPoints(this._gmPoints - 1);
    this.sendMessage(game.i18n.localize("E20.SptSpendGmPoint"));
  }

  incrementGmPoints() {
    this.changeGmPoints(this._gmPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddGmPoint"));
  }

  directSetGmPoints() {
    const value = this.element.getElementById("gm-points-input").value;
    if (value != this._gmPoints) {
      this.changeGmPoints(value);
      this.sendMessage(`${game.i18n.localize("E20.SptSetGmPoints")} ${value}!`);
    }
  }

  decrementStoryPoints() {
    this.changeStoryPoints(this._storyPoints - 1);
    this.sendMessage(game.i18n.localize("E20.SptSpendStoryPoint"));
  }

  incrementStoryPoints() {
    this.changeStoryPoints(this._storyPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddStoryPoint"));
  }

  directSetStoryPoints() {
    const value = this.element.getElementById("story-points-input").value;
    if (value != this._storyPoints) {
      this.changeStoryPoints(value);
      this.sendMessage(
        `${game.i18n.localize("E20.SptSetStoryPoints")} ${value}!`,
      );
    }
  }

  async rollMajorSceneGmPoints() {
    try {
      const user = game.user;
      if (user.isGM) {
        const roll = new Roll("d2 + 1");
        await roll.toMessage({
          speaker: game.user.name,
          flavor: game.i18n.localize("E20.SptRollFlavor"),
          rollMode: game.settings.get("core", "rollMode"),
        }); // does this need to be an await?
        this.changeGmPoints(this._gmPoints + roll.total);
      }
    } catch (err) {
      console.error(err);
    }
  }
}

/**
 * Hooks
 */

Hooks.on("init", () => {
  registerSettings();

  // Clients (players) listen on the socket to update the UI whenever the GM changes values
  game.socket.on("system.essence20", (data) => {
    game.StoryPointsTracker.handleUpdate(data);
  });
});

Hooks.on("ready", () => {
  // Display the dialog if settings permit
  if (
    (setting("sptShow") == "on" ||
      (setting("sptShow") == "toggle" && setting("sptToggleState"))) &&
    (setting("sptAccess") == "everyone" ||
      (setting("sptAccess") == "gm") == game.user.isGM)
  ) {
    game.StoryPointsTracker = new StoryPointsTracker().render(true);
  }

  // Create hook that helps with persisting dialog position
  const oldDragMouseUp =
    foundry.applications.ux.Draggable.prototype._onDragMouseUp;
  foundry.applications.ux.Draggable.prototype._onDragMouseUp = (event) => {
    Hooks.call(`dragEnd${this.app.constructor.name}`, this.app);
    return oldDragMouseUp.call(this, event);
  };
});

// Persists dialog position when moved by the user
Hooks.on("dragEndStoryPointsTracker", (app) => {
  game.user.setFlag("essence20", "storyPointsTrackerPos", {
    left: app.position.left,
    top: app.position.top,
  });
});

// Init the button in the controls for toggling the dialog
Hooks.on("getSceneControlButtons", (controls) => {
  if (
    setting("sptShow") == "toggle" &&
    (setting("sptAccess") == "everyone" ||
      (setting("sptAccess") == "gm" && game.user.isGM))
  ) {
    const tokenControls = controls.tokens;
    const activeState = game.settings.get("essence20", "sptToggleState");
    tokenControls.tools.sptTracker = {
      active: activeState,
      icon: "fas fa-circle-s",
      name: "sptTracker",
      title: game.i18n.format("E20.SptToggleDialog", {
        name: getPointsName(false),
      }),
      toggle: true,
      visible: true,
      onChange: (event, toggle) => {
        if (toggle) {
          if (!game.StoryPointsTracker) {
            game.settings.set("essence20", "sptToggleState", true);
            game.StoryPointsTracker = new StoryPointsTracker().render(true);
            tokenControls.tools.sptTracker.active = true;
          }
        } else {
          game.settings.set("essence20", "sptToggleState", false);
          game.StoryPointsTracker.closeSpt();
          tokenControls.tools.sptTracker.active = false;
        }
      },
    };
  }
});
