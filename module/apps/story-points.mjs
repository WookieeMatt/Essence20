const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { applyThemeClass, setting } from "../settings.js";

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
      "theme-wrapper",
      "story-points",
      "sliced-border --thick",
    ],
    window: {
      icon: "fas fa-circle-s",
      title: "E20.SptWindowTitle", // TODO: figure out how to use i18n here
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
      template: "systems/essence20/templates/app/story-points.hbs",
    },
  };

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

    applyThemeClass(this.element);

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
    }
  }

  static incrementGmPoints() {
    this.setGmPoints(this._gmPoints + 1);
    this.sendMessage(game.i18n.localize("E20.SptAddGmPoint"));
  }

  static decrementStoryPoints() {
    if (this._storyPoints > 0) {
      this.setStoryPoints(this._storyPoints - 1);
      this.sendMessage(game.i18n.format("E20.SptSpendStoryPoint", {name: getPointsName(false)}));
    }
  }

  static incrementStoryPoints() {
    this.setStoryPoints(this._storyPoints + 1);
    this.sendMessage(game.i18n.format("E20.SptAddStoryPoint", {name: getPointsName(false)}));
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

  /**
   * Functions
   */

  setGmPoints(value) {
    if (game.user.isGM) {
      this._gmPoints = Math.max(0, value);
      game.settings.set("essence20", "sptGmPoints", this._gmPoints);
      this.updateClients();
      this.render(false);
    }
  }

  setStoryPoints(value) {
    if (game.user.isGM) {
      this._storyPoints = Math.max(0, value);
      game.settings.set("essence20", "sptStoryPoints", this._storyPoints);
      this.updateClients();
      this.render(false);
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
        `${game.i18n.format("E20.SptSetStoryPoints", {name: getPointsName(true)})} ${value}!`,
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
  handleStoryPointSignal(data) {
    this._gmPoints = data.gmPoints;
    this._storyPoints = data.storyPoints;

    this.render(false);
  }

  // Outputs given message to chat
  sendMessage(content) {
    if (game.settings.get("essence20", "sptMessage")) {
      const speaker = ChatMessage.getSpeaker({ user: game.user.id });

      const messageData = {
        user: game.user.id,
        speaker: speaker,
        // v14 split these apart: `type` is now the ChatMessage document subtype (a string, e.g.
        // "base") while the numeric CHAT_MESSAGE_STYLES value lives in `style`. Passing the
        // number as `type` fails validation outright — `"0" is not a valid type for the
        // ChatMessage Document class` — so every point adjustment threw a visible error and
        // announced nothing, even though the point value itself updated.
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content,
      };

      ChatMessage.create(messageData);
    }
  }

  // Handles clicking Close button or toggling in toolbar
  async close(options) {
    // Deactivate in toolbar. That tool only exists while sptShow is "toggle" (see the
    // getSceneControlButtons hook in essence20.mjs), so this reads through optional chaining
    // rather than straight off the object - reading .active from undefined threw, and a close()
    // that throws takes its caller down with it.
    const toggleDialogControl = ui.controls.controls.tokens?.tools?.sptTracker;
    if (toggleDialogControl) toggleDialogControl.active = false;
    game.settings.set("essence20", "sptToggleState", false);
    ui.controls.render();
    game.StoryPointsTracker = null;

    // ApplicationV2#close() is async. Overriding it without returning that promise made
    // `await app.close()` resolve before the window had gone, and `app.close().catch(...)`
    // throw outright on undefined.
    return super.close(options);
  }
}
