const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { getDefaultTheme, setting } from "../settings.js";

export function getPointsName(plural) {
  return `${
    CONFIG.E20.pointsNameOptions[setting("sptPointsName")]
  } ${game.i18n.localize(plural ? "E20.SptPointPlural" : "E20.SptPoint")}`;
}

function getPosition() {
  const pos = game.user?.getFlag("essence20", "storyPointsTrackerPos") ?? {top: 120, left: 120};
  return pos;
}
  
function storePosition(position) {
  game.user.setFlag("essence20", "storyPointsTrackerPos", {
    left: parseFloat(position.left),
    top: parseFloat(position.top),
  });
}

export class StoryPoints extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor() {
    super({position: getPosition()});
    this._gmPoints = game.settings.get("essence20", "sptGmPoints") ?? 0;
    this._storyPoints = game.settings.get("essence20", "sptStoryPoints") ?? 0;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "story-points",
    tag: "div",
    classes: [
      "essence20",
      "theme-wrapper theme-dark", // TODO: get light/dark from settings/browser
      "story-points",
      "sliced-border --thick",
      getDefaultTheme(),
    ],
    window: {
      icon: "fas fa-circle-s",
      title: "E20.SptWindowTitle",
    },
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
      template: "systems/essence20/templates/dialog/story-points.hbs",
    },
  };

  get title() {
    return (
      game.i18n.localize(this._title, { name: getPointsName(false) }) ||
      game.i18n.localize(super.title, { name: getPointsName(false) })
    );
  }

  /**
   * ApplicationV2 hook functions
   */
  _prepareContext() {
    return {
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
      isGm: game.user.isGM,
      gmPointsArePublic: game.user.isGM || setting("sptGmPointsArePublic"),
      pointsName: getPointsName(true),
    };
  }

  // eslint-disable-next-line no-unused-vars
  _onRender(context, options) {
    super._onRender(context, options);

    this.element
      .querySelector("#gm-points-input")
      .addEventListener("focusout", (e) =>
        this.gmPointsInputHandler(e.target.value),
      );

    this.element
      .querySelector("#story-points-input")
      .addEventListener("focusout", (e) =>
        this.storyPointsInputHandler(e.target.value),
      );
  }

  _onPosition(position) {
    super._onPosition(position);

    storePosition(position);
  }

  /**
   * Functions
   */
  setGmPoints(value) {
    if (game.user.isGM) {
      this._gmPoints = Math.max(0, value);
      this.element.querySelector("#gm-points-input").value = this._gmPoints;
      game.settings.set("essence20", "sptGmPoints", this._gmPoints);
      this.updateClients();
    } else {
      this.element.querySelector("#gm-points-input").value = this._gmPoints;
    }
  }

  setStoryPoints(value) {
    if (game.user.isGM) {
      this._storyPoints = Math.max(0, value);
      this.element.querySelector("#story-points-input").value =
        this._storyPoints;
      game.settings.set("essence20", "sptStoryPoints", this._storyPoints);
      this.updateClients();
    } else {
      this.element.querySelector("#story-points-input").value =
        this._storyPoints;
    }
  }

  gmPointsInputHandler(value) {
    if (value != this._gmPoints) {
      this.setGmPoints(value);
      this.sendMessage(`${game.i18n.localize("E20.SptSetGmPoints")} ${value}!`);
    }
  }

  storyPointsInputHandler(value) {
    if (value != this._storyPoints) {
      this.setStoryPoints(value);
      this.sendMessage(
        `${game.i18n.localize("E20.SptSetStoryPoints")} ${value}!`
      );
    }
  }

  updateClients() {
    game.socket.emit("system.essence20", {
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
    });
  }

  // Called when a client/player receives an update from the GM
  handleUpdate(data) {
    this._gmPoints = data.gmPoints;
    this._storyPoints = data.storyPoints;

    // update display
    this.element.querySelector("#gm-points-input").value = this._gmPoints;
    this.element.querySelector("#story-points-input").value = this._storyPoints;
  }

  // Outputs given message to chat
  sendMessage(content) {
    if (game.settings.get("essence20", "sptMessage")) {
      const speaker = ChatMessage.getSpeaker({ user: game.user.id });

      const messageData = {
        user: game.user.id,
        speaker: speaker,
        type: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content,
      };

      ChatMessage.create(messageData);
    }
  }

  // Handles clicking Close button or toggling in toolbar
  close() {
    // Deactivate in toolbar
    const toggleDialogControl = ui.controls.controls.tokens.tools.sptTracker;
    toggleDialogControl.active = false;
    game.settings.set("essence20", "sptToggleState", false);
    ui.controls.render();
    game.StoryPointsTracker = null;
    super.close();
  }
  
  /**
   * Actions, these should be static. If they need to access this
   */
  static async open() {
    try {
      const toggleDialogControl = ui.controls.controls.tokens.tools.sptTracker;
      game.settings.set("essence20", "sptToggleState", true);
      game.StoryPointsTracker = await new StoryPoints().render(true);
      toggleDialogControl.active = true;
    } catch (err) {
      console.error(err);
    }
  }

  static decrementGmPoints() {
    if (this._gmPoints > 0) {
      this.setGmPoints(this._gmPoints - 1);
      this.sendMessage(game.i18n.localize("E20.SptSpendGmPoint"));
    } else {
      this.sendMessage(game.i18n.localize("E20.SptSpendGmPointDenied"));
    }
  }

  static incrementGmPoints() {
    this.setGmPoints(this._gmPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddGmPoint"));
  }

  static decrementStoryPoints() {
    if (this._storyPoints > 0) {
      this.setStoryPoints(this._storyPoints - 1);
      this.sendMessage(game.i18n.localize("E20.SptSpendStoryPoint"));
    } else {
      this.sendMessage(game.i18n.localize("E20.SptSpendStoryPointDenied"));
    }
  }

  static incrementStoryPoints() {
    this.setStoryPoints(this._storyPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddStoryPoint"));
  }

  static async rollMajorSceneGmPoints() {
    try {
      const user = game.user;
      if (user.isGM) {
        const roll = new Roll("d2 + 1");
        await roll.toMessage({
          speaker: game.user.name,
          flavor: game.i18n.localize("E20.SptRollFlavor"),
          rollMode: game.settings.get("core", "rollMode"),
        }); // does this need to be an await?
        this.setGmPoints(this._gmPoints + roll.total);
      }
    } catch (err) {
      console.error(err);
    }
  }
}