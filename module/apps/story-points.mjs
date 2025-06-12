const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { getDefaultTheme, setting } from "../settings.js";

console.warn("story-points.mjs");
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
    tag: "div",
    classes: [
      "essence20",
      "theme-wrapper",
      "story-points",
      "sliced-border --thick",
      "theme-dark",
      getDefaultTheme(),
    ],
    window: {
      // icon: "fas fa-gear",
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

  _prepareContext() {
    return {
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
      isGm: game.user.isGM,
      gmPointsArePublic: game.user.isGM || setting("sptGmPointsArePublic"),
      pointsName: getPointsName(true),
      defaultTheme: getDefaultTheme(),
    };
  }

  // eslint-disable-next-line no-unused-vars
  _onRender(context, options) {
    this.element
      .querySelector("#gm-points-input")
      .addEventListener("focusout", (e) => StoryPoints.directSetGmPoints(e.target.value));

    this.element
      .querySelector("#story-points-input")
      .addEventListener("focusout", (e) => StoryPoints.directSetStoryPoints(e.target.value));
  }

  /**
   * Functions
   */

  static changeGmPoints(value) {
    if (game.user.isGM) {
      this._gmPoints = Math.max(0, value);
      this.element.getElementById("gm-points-input").value = this._gmPoints;
      game.settings.set("essence20", "sptGmPoints", this._gmPoints);
      this.updateClients();
    } else {
      this.element.getElementById("gm-points-input").value = this._gmPoints;
    }
  }

  static changeStoryPoints(value) {
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

  static decrementGmPoints() {
    this.changeGmPoints(this._gmPoints - 1);
    this.sendMessage(game.i18n.localize("E20.SptSpendGmPoint"));
  }

  static incrementGmPoints() {
    this.changeGmPoints(this._gmPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddGmPoint"));
  }

  static directSetGmPoints() {
    const value = this.element.getElementById("gm-points-input").value;
    if (value != this._gmPoints) {
      this.changeGmPoints(value);
      this.sendMessage(`${game.i18n.localize("E20.SptSetGmPoints")} ${value}!`);
    }
  }

  static decrementStoryPoints() {
    this.changeStoryPoints(this._storyPoints - 1);
    this.sendMessage(game.i18n.localize("E20.SptSpendStoryPoint"));
  }

  static incrementStoryPoints() {
    this.changeStoryPoints(this._storyPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddStoryPoint"));
  }

  static directSetStoryPoints() {
    const value = this.element.getElementById("story-points-input").value;
    if (value != this._storyPoints) {
      this.changeStoryPoints(value);
      this.sendMessage(
        `${game.i18n.localize("E20.SptSetStoryPoints")} ${value}!`,
      );
    }
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
        StoryPoints.changeGmPoints(this._gmPoints + roll.total);
      }
    } catch (err) {
      console.error(err);
    }
  }
}
