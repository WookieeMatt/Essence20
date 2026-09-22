import { actorHasPerk, bankPendingBonus, getPendingBonus } from "./perks.mjs";
import { activateLendAssistance } from "./lend-assistance.mjs";
import { getSceneEpoch, getUses, markUsed } from "./scene-clock.mjs";
import { canSpendForActor, getStoryPointsActor, spendForActor } from "./story-points.mjs";

/**
 * Friendship Circle (MLP CRB, every Spirit Role at 1st level, p.73/77/81):
 *
 * > "Once per scene, a pony in your group can spend a Friendship Point as a Standard action to
 * > form a Friendship Circle. All other ponies in your group can spend a Friendship Point to
 * > immediately move up to their current movement to get within 30 feet of the pony who formed
 * > the Friendship Circle. It's OK if the Friendship Circle isn't actually a circle. Everypony
 * > who spent a Friendship point to join the Friendship Circle shares the following pool of
 * > bonuses: ↑1 on a Skill Test per Pony in the Friendship Circle; Heal 1 damage per Pony in
 * > the Friendship Circle; Lend Assistance to anypony in the Friendship Circle as a Free action
 * > once per pony in the Friendship Circle. Everypony can take from this pool of bonuses
 * > equally, or the bonuses can be split unevenly. These bonuses last until the end of the pony
 * > who formed the Friendship Circle's next turn."
 *
 * Best Friendship Circle (Spirit of Loyalty, 17th level, p.91): "your group can form a
 * Friendship Circle twice per scene."
 *
 * The Circle is a thing the GROUP has, so it lives on the primary Party actor - the same
 * document that holds the Friendship Points it is paid from - as a flag every client can read and
 * any owner can write. Three pools sized by the ponies who paid in; each pony draws from them by
 * their own choice, which is what "split unevenly" means.
 *
 * What is enforced and what is not:
 *  - The Friendship Point costs, the once-per-scene limit (twice with Best Friendship Circle),
 *    and the three pools are all real.
 *  - The Standard action to form it is announced, not charged: this system's action economy
 *    charges actions where the sheet's own controls take them, and a tracker button is not one.
 *  - "move up to their current movement to get within 30 feet" is the joiner's own business.
 *    Tokens are not moved and distance is not checked; the chat line says what they did.
 *  - "until the end of the pony who formed the Circle's next turn" IS enforced in combat, from
 *    the turn-end hook in essence20.mjs; outside combat the Circle ends with the scene.
 *
 * The pure decisions - what forming and joining and drawing do to the record, when it has
 * ended - take and return plain objects and are tested; the functions that touch Foundry wrap
 * them.
 */

export const FRIENDSHIP_CIRCLE_ID = "Compendium.essence20.mlp_crb.Item.2qyftQYtr5noeJ6e";
export const BEST_FRIENDSHIP_CIRCLE_ID = "Compendium.essence20.mlp_crb.Item.f31hKc7pJiH60BJY";

/** The Party flag the live Circle sits in. */
export const CIRCLE_FLAG = "friendshipCircle";

/** The Party flag counting Circles formed this scene (helpers/scene-clock.mjs#getUses). */
export const CIRCLES_FORMED_FLAG = "friendshipCirclesFormed";

/** A pony's banked share of the ↑ pool, consumed by their next Skill Test (dice.mjs). */
export const CIRCLE_SHIFT_FLAG = "pendingFriendshipCircleShift";

/** The three pools, in the order the book lists them. */
export const POOLS = ["upshifts", "healing", "assists"];

/* -------------------------------------------- */
/*  The rules                                   */
/* -------------------------------------------- */

/**
 * How many Circles the group may form in a scene: two if anypony in it has reached Best
 * Friendship Circle, else one. "Your group can form" - the upgrade is the group's.
 * @param {Array<Actor>} members   The Party roster.
 * @returns {number}
 */
export function circleLimit(members) {
  return (members ?? []).some(member => actorHasPerk(member, BEST_FRIENDSHIP_CIRCLE_ID)) ? 2 : 1;
}

/**
 * A freshly formed Circle: the former alone, one of everything in each pool.
 * @param {string} formerUuid
 * @param {{epoch: number, combat: ?{id: string, round: number, turn: number}}} when
 * @returns {Object}
 */
export function newCircle(formerUuid, { epoch, combat }) {
  return {
    formerUuid,
    members: [formerUuid],
    upshifts: 1,
    healing: 1,
    assists: 1,
    epoch,
    combatId: combat?.id ?? null,
    round: combat?.round ?? null,
    turn: combat?.turn ?? null,
  };
}

/**
 * The Circle with one more pony in it. Each pool grows by one - "per Pony in the Friendship
 * Circle" - including whatever has already been drawn, since the pools are sized by who paid in,
 * not reset. A pony already in the Circle changes nothing.
 * @param {Object} circle
 * @param {string} memberUuid
 * @returns {Object}
 */
export function joinCircle(circle, memberUuid) {
  if (!circle || circle.members.includes(memberUuid)) {
    return circle;
  }

  return {
    ...circle,
    members: [...circle.members, memberUuid],
    upshifts: circle.upshifts + 1,
    healing: circle.healing + 1,
    assists: circle.assists + 1,
  };
}

/**
 * The Circle with one drawn from a pool, or null if that pool is empty or the pony is not in it.
 * @param {Object} circle
 * @param {string} pool   One of POOLS.
 * @param {string} memberUuid
 * @returns {?Object}
 */
export function drawFromPool(circle, pool, memberUuid) {
  if (!circle || !POOLS.includes(pool) || !circle.members.includes(memberUuid) || circle[pool] < 1) {
    return null;
  }

  return { ...circle, [pool]: circle[pool] - 1 };
}

/**
 * Whether a Circle has run out.
 *
 * In combat: at the end of the former's next turn after the one it was formed in - which the
 * turn-end hook decides with endsAtTurnEnd() and records by clearing the flag, so here it is
 * enough that the encounter it was formed in has gone. Out of combat: with the scene.
 * @param {?Object} circle
 * @param {{epoch: number, combat: ?{id: string}}} now
 * @returns {boolean}
 */
export function isCircleOver(circle, { epoch, combat }) {
  if (!circle) {
    return true;
  }

  if (circle.epoch !== epoch) {
    return true;
  }

  return !!circle.combatId && circle.combatId !== (combat?.id ?? null);
}

/**
 * Whether the turn now ending is the one the Circle lasts until: the former's, and a later turn
 * than the one it was formed in. Forming it as a Standard action on your own turn and having it
 * end with that same turn would give the group no turn to use it, which cannot be the reading.
 * @param {?Object} circle
 * @param {string} endingActorUuid
 * @param {{id: string, round: number, turn: number}} combat   The combat BEFORE the turn advances.
 * @returns {boolean}
 */
export function endsAtTurnEnd(circle, endingActorUuid, combat) {
  if (!circle || !combat || circle.combatId !== combat.id || circle.formerUuid !== endingActorUuid) {
    return false;
  }

  return combat.round > circle.round || (combat.round === circle.round && combat.turn > circle.turn);
}

/* -------------------------------------------- */
/*  The Foundry side                            */
/* -------------------------------------------- */

/** @returns {?Actor} The primary Party, which is where a Circle lives. */
function party() {
  return getStoryPointsActor();
}

/** The current combat's position, or null. */
function combatNow() {
  const combat = game.combat;
  return combat ? { id: combat.id, round: combat.round, turn: combat.turn } : null;
}

/**
 * The live Circle, or null if there is none or it has ended.
 * @returns {?Object}
 */
export function getCircle() {
  const circle = party()?.getFlag?.("essence20", CIRCLE_FLAG) ?? null;
  return isCircleOver(circle, { epoch: getSceneEpoch(), combat: combatNow() }) ? null : circle;
}

/**
 * How many more Circles the group may form this scene.
 * @returns {number}
 */
export function circlesLeftThisScene() {
  const group = party();
  if (!group) {
    return 0;
  }

  return Math.max(0, circleLimit(group.members) - getUses(group, CIRCLES_FORMED_FLAG, "scene"));
}

/**
 * Whether a pony is one of the group and has the Perk - the two things forming or joining need.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isCirclePony(actor) {
  const group = party();
  return !!actor && !!group && group.members.some(member => member.uuid === actor.uuid)
    && actorHasPerk(actor, FRIENDSHIP_CIRCLE_ID);
}

/**
 * Whether this client can write the Circle: it owns the Party (a GM always does).
 * @returns {boolean}
 */
export function canWriteCircle() {
  return !!party()?.isOwner;
}

/**
 * Form a Circle around an actor. Costs a Friendship Point, uses one of the scene's formings.
 * @param {Actor} actor
 * @returns {Promise<boolean>} Whether it was formed.
 */
export async function formCircle(actor) {
  const group = party();
  if (!group || !canWriteCircle() || !isCirclePony(actor) || getCircle() || !circlesLeftThisScene()
    || !canSpendForActor(actor)) {
    return false;
  }

  await spendForActor(actor, 1, { announce: false });
  await markUsed(group, CIRCLES_FORMED_FLAG, { window: "scene" });
  await group.setFlag("essence20", CIRCLE_FLAG, newCircle(actor.uuid, { epoch: getSceneEpoch(), combat: combatNow() }));
  announce("E20.FriendshipCircleFormed", { name: actor.name });
  return true;
}

/**
 * Join the live Circle. Costs a Friendship Point.
 * @param {Actor} actor
 * @returns {Promise<boolean>}
 */
export async function joinLiveCircle(actor) {
  const group = party();
  const circle = getCircle();
  if (!group || !canWriteCircle() || !isCirclePony(actor) || !circle || circle.members.includes(actor.uuid)
    || !canSpendForActor(actor)) {
    return false;
  }

  await spendForActor(actor, 1, { announce: false });
  await group.setFlag("essence20", CIRCLE_FLAG, joinCircle(circle, actor.uuid));
  const former = fromUuidSync(circle.formerUuid);
  announce("E20.FriendshipCircleJoined", { name: actor.name, former: former?.name ?? "?" });
  return true;
}

/**
 * Draw one from a pool for a pony in the Circle, and do what that pool does.
 * @param {Actor} actor
 * @param {string} pool   One of POOLS.
 * @returns {Promise<boolean>}
 */
export async function drawForActor(actor, pool) {
  const group = party();
  const drawn = drawFromPool(getCircle(), pool, actor?.uuid);
  if (!group || !canWriteCircle() || !drawn) {
    return false;
  }

  if (pool === "assists") {
    // The Lend Assistance picker can be cancelled, and an action that helped nobody was never
    // taken - so the pool is only charged once somebody was actually helped.
    const result = await activateLendAssistance(actor);
    if (result?.cancelled) {
      return false;
    }

    await group.setFlag("essence20", CIRCLE_FLAG, drawn);
    announce("E20.FriendshipCircleAssist", { name: actor.name, detail: result?.message ?? "" });
    return true;
  }

  await group.setFlag("essence20", CIRCLE_FLAG, drawn);

  if (pool === "healing") {
    const health = actor.system.health;
    await actor.update({ "system.health.value": Math.min(health.max, health.value + 1) });
    announce("E20.FriendshipCircleHeal", { name: actor.name });
    return true;
  }

  // The ↑ is banked on the pony and taken by their next Skill Test - see dice.mjs. Drawing twice
  // before rolling stacks, which is what letting Rarity "gain ↑3 on a Skill Test" means.
  const pending = getPendingBonus(actor, CIRCLE_SHIFT_FLAG);
  await bankPendingBonus(actor, CIRCLE_SHIFT_FLAG, { shiftUp: (pending?.shiftUp ?? 0) + 1 });
  announce("E20.FriendshipCircleUpshift", { name: actor.name, total: (pending?.shiftUp ?? 0) + 1 });
  return true;
}

/**
 * End the Circle early, by hand.
 * @returns {Promise<void>}
 */
export async function endCircle() {
  const group = party();
  if (group && canWriteCircle() && group.getFlag("essence20", CIRCLE_FLAG)) {
    await group.unsetFlag("essence20", CIRCLE_FLAG);
    announce("E20.FriendshipCircleEnded", {});
  }
}

/**
 * The turn-end check. Runs on every client from essence20.mjs; only the active GM writes, the
 * same one-writer rule helpers/party.mjs uses, since the hook fires everywhere at once.
 * @param {?Actor} endingActor   Whose turn is ending.
 * @param {Combat} combat   BEFORE the turn advances.
 */
export async function expireCircleAtTurnEnd(endingActor, combat) {
  if (game.users?.activeGM?.id !== game.user?.id) {
    return;
  }

  const group = party();
  const circle = group?.getFlag?.("essence20", CIRCLE_FLAG);
  if (circle && endsAtTurnEnd(circle, endingActor?.uuid, { id: combat.id, round: combat.round, turn: combat.turn })) {
    await group.unsetFlag("essence20", CIRCLE_FLAG);
    announce("E20.FriendshipCircleEnded", {});
  }
}

/**
 * A chat line, from the user who did the thing.
 * @param {string} key
 * @param {Object} data
 */
function announce(key, data) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ user: game.user.id }),
    content: game.i18n.format(key, data),
  });
}
