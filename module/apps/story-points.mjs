const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { applyThemeClass, getGameLine, setting } from "../settings.js";
import { advanceScene, getSceneEpoch, getSceneLabel } from "../helpers/scene-clock.mjs";
import {
  canWriteCircle, circlesLeftThisScene, drawForActor, endCircle, formCircle, FRIENDSHIP_CIRCLE_ID, getCircle,
  isCirclePony, joinLiveCircle, POOLS,
} from "../helpers/friendship-circle.mjs";
import { actorHasPerk } from "../helpers/perks.mjs";
import {
  canWriteStoryPoints, getGmPoints, getStoryPoints, getStoryPointsActor, gridPowerBloomResults, hasGmPool,
  hasGridPowerBloom, hasStoryPointsAvailable, ownsStoryPoints, requestStoryPointSpend, sessionResetUpdate,
  setGmPoints, setStoryPoints,
} from "../helpers/story-points.mjs";

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
  }

  /**
   * The points are read from the primary Party each render rather than cached here, so the
   * window can never show a stale total. Every client re-renders it from the updateActor
   * hook in essence20.mjs whenever that Party changes.
   */
  get _gmPoints() {
    return getGmPoints();
  }

  get _storyPoints() {
    return getStoryPoints();
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "story-points",
    tag: "div",
    classes: [
      "essence20",
      "theme-wrapper",
      "e20-window",
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
      newScene: StoryPoints.newScene,
      newSession: StoryPoints.newSession,
      spendNarrative: StoryPoints.spendNarrative,
      gridPowerBloom: StoryPoints.gridPowerBloom,
      circleForm: StoryPoints.circleForm,
      circleJoin: StoryPoints.circleJoin,
      circleDraw: StoryPoints.circleDraw,
      circleEnd: StoryPoints.circleEnd,
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
  /**
   * The pony this client acts for in a Friendship Circle: a player's own character; for the
   * GM, whichever member they picked in the tracker (the first, until they do).
   * @returns {?Actor}
   */
  #circleActor() {
    const members = getStoryPointsActor()?.members ?? [];
    if (!game.user.isGM) {
      const own = game.user.character;
      return own && members.some(member => member.uuid === own.uuid) ? own : null;
    }

    return members.find(member => member.uuid === this.#circleActorUuid) ?? members[0] ?? null;
  }

  /** @type {?string} The GM's chosen pony, by uuid. */
  #circleActorUuid = null;

  /**
   * Everything the Friendship Circle section shows, or null when the group has no such Perk
   * to show it for. See helpers/friendship-circle.mjs.
   * @returns {?Object}
   */
  #circleContext() {
    const members = getStoryPointsActor()?.members ?? [];
    if (!members.some(member => actorHasPerk(member, FRIENDSHIP_CIRCLE_ID))) {
      return null;
    }

    const circle = getCircle();
    const actor = this.#circleActor();
    const inCircle = !!actor && !!circle && circle.members.includes(actor.uuid);
    const writable = canWriteCircle();
    return {
      active: !!circle,
      left: circlesLeftThisScene(),
      former: circle ? fromUuidSync(circle.formerUuid)?.name : null,
      members: members.map(member => ({
        uuid: member.uuid, name: member.name, inCircle: !!circle?.members.includes(member.uuid),
        selected: member.uuid === actor?.uuid,
      })),
      pools: circle ? POOLS.map(pool => ({ pool, count: circle[pool], label: `E20.FriendshipCirclePool${pool.capitalize()}` })) : [],
      actor: actor?.name ?? null,
      pickActor: game.user.isGM && members.length > 1,
      canForm: writable && !circle && !!actor && isCirclePony(actor) && circlesLeftThisScene() > 0,
      canJoin: writable && !!circle && !!actor && isCirclePony(actor) && !inCircle,
      canDraw: writable && inCircle,
      canEnd: game.user.isGM && !!circle,
    };
  }

  _prepareContext() {
    return {
      friendshipCircle: this.#circleContext(),
      gmPoints: this._gmPoints,
      storyPoints: this._storyPoints,
      isGm: game.user.isGM,
      // A player the GM has made an owner of the primary Party spends from it directly - the
      // point of keeping the pool on an Actor. The GM's own points stay the GM's.
      canEditStoryPoints: ownsStoryPoints(),
      canEditGmPoints: game.user.isGM,
      // The two spends with no dice behind them - temporary equipment, a clue - are offered as
      // buttons here, for anyone who can spend from the pool: the point comes off and chat says
      // what it bought, and the rest is the table's. Power Rangers' Grid Power bloom is the one
      // team-wide spend, and needs the roster, so it is GM-only and line-gated.
      canSpendNarrative: canWriteStoryPoints() && hasStoryPointsAvailable(1),
      gridPowerBloom: game.user.isGM && hasGridPowerBloom(getGameLine()) ? {
        cost: getStoryPointsActor()?.members.length ?? 0,
        affordable: (getStoryPointsActor()?.members.length ?? 0) > 0
          && hasStoryPointsAvailable(getStoryPointsActor()?.members.length ?? 0),
      } : null,
      // The My Little Pony CRB has no GM pool (hasGmPool), so a Friend Group's tracker shows
      // none - to the GM as well, since there is nothing for them to spend it on.
      hasGmPool: hasGmPool(getGameLine()),
      gmPointsArePublic: hasGmPool(getGameLine()) && (game.user.isGM || setting("sptGmPointsArePublic")),
      pointsName: getPointsName(true),
      // Scene Clock - see helpers/scene-clock.mjs. Shown to everyone, advanced only by the GM:
      // players benefit from knowing which scene they are in, because it is what refreshes their
      // own once-per-scene abilities.
      sceneEpoch: getSceneEpoch(),
      sceneLabel: getSceneLabel(),
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

    // The GM's choice of which pony acts in the Friendship Circle section.
    this.element.querySelector('select[name="circleActor"]')?.addEventListener("change", (e) => {
      this.#circleActorUuid = e.target.value;
      this.render(false);
    });
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

  static async decrementGmPoints() {
    if (this._gmPoints > 0 && await this.setGmPoints(this._gmPoints - 1)) {
      this.sendMessage(game.i18n.localize("E20.SptSpendGmPoint"));
    }
  }

  static async incrementGmPoints() {
    if (await this.setGmPoints(this._gmPoints + 1)) {
      this.sendMessage(game.i18n.localize("E20.SptAddGmPoint"));
    }
  }

  static async decrementStoryPoints() {
    if (this._storyPoints > 0 && await this.setStoryPoints(this._storyPoints - 1)) {
      this.sendMessage(game.i18n.format("E20.SptSpendStoryPoint", {name: getPointsName(false)}));
    }
  }

  static async incrementStoryPoints() {
    if (await this.setStoryPoints(this._storyPoints + 1)) {
      this.sendMessage(game.i18n.format("E20.SptAddStoryPoint", {name: getPointsName(false)}));
    }
  }


  /**
   * Begin a new scene: both Scene Clock counters advance, refreshing every "once per scene" and
   * "once per encounter" ability at the table (see helpers/scene-clock.mjs).
   *
   * Lives on the Story Points tracker because that is already the one persistent GM widget this
   * system puts on screen - a second floating window for one button would be worse. Prompts for an
   * optional name, and does nothing if the GM backs out, so a misclick costs nothing.
   */
  static async newScene() {
    if (!game.user.isGM) {
      return;
    }

    const label = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("E20.SceneClockNewSceneTitle") },
      content: `<p>${game.i18n.localize("E20.SceneClockNewScenePrompt")}</p>`
        + `<input type="text" name="label" value="" placeholder="${
          game.i18n.localize("E20.SceneClockNewScenePlaceholder")}" />`,
      ok: {
        label: game.i18n.localize("E20.SceneClockNewSceneConfirm"),
        callback: (event, button) => button.form.elements.label.value,
      },
      rejectClose: false,
    });

    if (label === null || label === undefined) {
      return;
    }

    await advanceScene(label);
    ChatMessage.create({
      content: game.i18n.format("E20.SceneClockAdvanced", {
        number: getSceneEpoch(),
        label: label ? ` \u2014 ${label}` : "",
      }),
    });

    this.render();
  }

  /**
   * Begin a new session: the pool resets to one point per Player Character on the primary
   * Party's roster, and so does the GM's where the line has one (see sessionResetUpdate).
   *
   * Confirmed first, with the count shown, because it discards whatever was left over - which
   * is the rule, but a roster nobody has filled in yet would reset the pool to nothing, and the
   * GM should see that number before agreeing to it.
   */
  static async newSession() {
    const party = getStoryPointsActor();
    if (!game.user.isGM || !party) {
      return;
    }

    const line = getGameLine();
    // The live roster, not the derived system.memberCount: that is computed when the actor is
    // prepared and can lag a roster change made moments earlier, and a reset to the stale number
    // would be the wrong rule applied confidently.
    const update = sessionResetUpdate(party.members.length, line);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("E20.SptNewSessionTitle") },
      content: `<p>${game.i18n.format(hasGmPool(line) ? "E20.SptNewSessionPrompt" : "E20.SptNewSessionPromptNoGm", {
        count: update["system.storyPoints"],
        party: party.name,
        name: getPointsName(true),
      })}</p>`,
      rejectClose: false,
    });

    if (!confirmed) {
      return;
    }

    await party.update(update);
    this.sendMessage(game.i18n.format("E20.SptNewSessionReset", {
      count: update["system.storyPoints"],
      name: getPointsName(true),
    }));
  }

  /**
   * The spends that are pure narrative: "Gain temporary access to a minor piece of equipment or
   * tool useful in the scene" and "Get a clue when stumped" (GI Joe CRB p.127; PR p.91 keeps
   * the equipment one, MLP p.118 calls the clue "a hint"). Nothing to automate but the point
   * and the announcement - which is still worth having, so the pool the table sees is right.
   * @param {PointerEvent} event
   * @param {HTMLElement} target   The button, carrying data-spend.
   */
  static async spendNarrative(event, target) {
    const kind = target?.dataset?.spend;
    const keys = { equipment: "E20.SptSpendEquipment", clue: "E20.SptSpendClue" };
    if (!keys[kind] || !canWriteStoryPoints() || !hasStoryPointsAvailable(1)) {
      return;
    }

    // The spender is the user, not an actor: their own character if they have one, else their name.
    const who = game.user.character ?? { name: game.user.name };
    await requestStoryPointSpend(who, 1, { announce: false });
    this.sendMessage(game.i18n.format(keys[kind], { name: who.name }));
  }

  /**
   * Grid Power bloom (PR CRB p.91): "The Power Rangers team can spend 1 Story Point per team
   * member to cause a Grid Power bloom, generating 1d2 Personal Power for each team member."
   * The team is the primary Party's roster; the cost and the gains follow from it. Each gain is
   * capped at that member's own maximum (helpers/story-points.mjs#gridPowerBloomResults).
   */
  static async gridPowerBloom() {
    const party = getStoryPointsActor();
    const members = party?.members ?? [];
    if (!game.user.isGM || !hasGridPowerBloom(getGameLine()) || !members.length
      || !hasStoryPointsAvailable(members.length)) {
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("E20.SptGridPowerBloomTitle") },
      content: `<p>${game.i18n.format("E20.SptGridPowerBloomPrompt", { cost: members.length })}</p>`,
      rejectClose: false,
    });
    if (!confirmed) {
      return;
    }

    const rolls = [];
    for (let i = 0; i < members.length; i++) {
      rolls.push((await new Roll("1d2").evaluate()).total);
    }

    await setStoryPoints(getStoryPoints() - members.length);
    const lines = [];
    for (const { member, value, gained } of gridPowerBloomResults(members, rolls)) {
      await member.update({ "system.powers.personal.value": value });
      lines.push(game.i18n.format("E20.SptGridPowerBloomMember", { name: member.name, gained }));
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ user: game.user.id }),
      content: `<p>${game.i18n.format("E20.SptGridPowerBloom", { cost: members.length })}</p><ul>${
        lines.map(line => `<li>${line}</li>`).join("")}</ul>`,
    });
  }

  /** Form a Friendship Circle around this client's pony - see helpers/friendship-circle.mjs. */
  static async circleForm() {
    await formCircle(this.#circleActor());
  }

  /** Join the live Friendship Circle. */
  static async circleJoin() {
    await joinLiveCircle(this.#circleActor());
  }

  /**
   * Draw one from a pool: an upshift banked for the next Skill Test, a point of healing, or a
   * free Lend Assistance.
   * @param {PointerEvent} event
   * @param {HTMLElement} target   The button, carrying data-pool.
   */
  static async circleDraw(event, target) {
    await drawForActor(this.#circleActor(), target?.dataset?.pool);
  }

  /** End the Circle by hand - the GM's call for a scene that moved on without a turn ending. */
  static async circleEnd() {
    if (game.user.isGM) {
      await endCircle();
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
        await this.setGmPoints(this._gmPoints + roll.total);
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Functions
   */

  /**
   * Both writes go to the primary Party through helpers/story-points.mjs, which is where the
   * permission check lives. They resolve to whether the write was made, so the callers above
   * announce only what actually happened. The window re-renders from the updateActor hook
   * rather than here, the same way every other client's does.
   */
  setGmPoints(value) {
    return setGmPoints(value);
  }

  setStoryPoints(value) {
    return setStoryPoints(value);
  }

  async gmPointsInputHandler(value) {
    if (value != this._gmPoints && await this.setGmPoints(value)) {
      this.sendMessage(`${game.i18n.localize("E20.SptSetGmPoints")} ${value}!`);
    }
  }

  async storyPointsInputHandler(value) {
    if (value != this._storyPoints && await this.setStoryPoints(value)) {
      this.sendMessage(
        `${game.i18n.format("E20.SptSetStoryPoints", {name: getPointsName(true)})} ${value}!`,
      );
    }
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
