const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { getDefaultTheme, setting } from "../settings.js";

function getPointsName(plural) {
  return `${
    CONFIG.E20.pointsNameOptions[setting("sptPointsName")]
  } ${game.i18n.localize(plural ? "E20.SptPointPlural" : "E20.SptPoint")}`;
}

export class StoryPoints extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(gmPoints, storyPoints) {
    super();
    this._gmPoints = gmPoints ?? 0;
    this._storyPoints = storyPoints ?? 0;
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
    };
  }

  // eslint-disable-next-line no-unused-vars
  _onRender(context, options) {
    this.element
      .querySelector("#gm-points-input")
      .addEventListener("focusout", (e) =>
        this.gmPointsInputHandler(e.target.value)
      );

    this.element
      .querySelector("#story-points-input")
      .addEventListener("focusout", (e) =>
        this.storyPointsInputHandler(e.target.value)
      );
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
    this.element.querySelector("#gm-points-input").value = this._gmPoints;
    this._storyPoints = data.storyPoints;
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
  async close() {
    // Deactivate in toolbar
    console.log(ui.controls.controls.tokens.tools.sptTracker);
    const toggleDialogControl = ui.controls.controls.tokens.tools.sptTracker;
    toggleDialogControl.active = false;
    toggleDialogControl.onChange(false);
    ui.controls.render();

    console.log(this);
    this.closeSpt();
  }

  // Helper close method that's called after toggling off in the toolbar
  closeSpt() {
    super.close();
    game.StoryPointsTracker = null;
  }

  /**
   * Actions, these should be static. If they need to access this
   */

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

console.warn("set on ready");
Hooks.on("ready", async function () {
  console.warn("on ready");

  // Display the dialog if settings permit
  if (
    (setting("sptShow") == "on" ||
      (setting("sptShow") == "toggle" && setting("sptToggleState"))) &&
    (setting("sptAccess") == "everyone" ||
      (setting("sptAccess") == "gm" && game.user.isGM))
  ) {
    game.StoryPointsTracker = new StoryPoints().render(true);
    console.log(game.StoryPointsTracker);
  }
});

// Init the button in the controls for toggling the dialog
console.warn("set on getSceneControlButtons");
Hooks.on("getSceneControlButtons", (controls) => {
  console.warn("on getSceneControlButtons");
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
      onChange: async (event, toggle) => {
        try {
          if (toggle) {
            if (!game.StoryPointsTracker) {
              game.settings.set("essence20", "sptToggleState", true);
              game.StoryPointsTracker = await new StoryPoints().render(true);
              tokenControls.tools.sptTracker.active = true;
            }
          } else {
            game.settings.set("essence20", "sptToggleState", false);
            game.StoryPointsTracker.closeSpt();
            tokenControls.tools.sptTracker.active = false;
          }
        } catch (err) {
          console.error(err);
        }
      },
    };
  }
});
