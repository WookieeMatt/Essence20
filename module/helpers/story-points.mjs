/**
 * The world's shared Story Point pool, and the GM's own points.
 *
 * Both live on the PRIMARY Party actor (Essence20Actors#party - see helpers/party.mjs for how
 * one is guaranteed to exist), in `system.storyPoints` and `system.gmPoints`. They used to be
 * world settings, and the reason they moved is permission: a setting can only be written by a
 * GM, so a player spending a Story Point (GI Joe CRB "In My Sights", MLP's Friendship Points)
 * had to ask a connected GM's client to do it for them over the socket, and could not spend at
 * all with no GM present. An Actor is something the GM can grant ownership of, and an owner
 * writes it directly.
 *
 * Both paths are kept. requestStoryPointSpend()/requestStoryPointGrant() write straight to the
 * Party when this client owns it, and otherwise fall back to the same fire-and-forget socket
 * request as before, answered by handleStoryPointSpendRequest()/handleStoryPointGrantRequest()
 * on the active GM's client. Every other client sees the change through the ordinary updateActor
 * hook - there is no longer a hand-rolled broadcast of the totals.
 *
 * Callers that gate an ability on the pool should ask canWriteStoryPoints() (is there anyone
 * who can perform the write?) and hasStoryPointsAvailable() (is there enough in it?), in that
 * order, for an honest upfront message.
 */

import { getGameLine } from "../settings.js";

/**
 * The Party that holds the pool.
 * @returns {?Actor}
 */
export function getStoryPointsActor() {
  return game.actors?.party ?? null;
}

/** @returns {number} */
export function getStoryPoints() {
  return getStoryPointsActor()?.system?.storyPoints ?? 0;
}

/** @returns {number} */
export function getGmPoints() {
  return getStoryPointsActor()?.system?.gmPoints ?? 0;
}

export function isGmConnected() {
  // Optional chaining for the unit-test harnesses that never define a users collection; a real
  // client always has one.
  return !!game.users?.some?.(user => user.isGM && user.active);
}

/**
 * Whether this client can change the pool itself - it owns the primary Party (a GM always does).
 * @returns {boolean}
 */
export function ownsStoryPoints() {
  return !!getStoryPointsActor()?.isOwner;
}

/**
 * Whether ANYONE can change the pool right now: this client directly, or a connected GM on its
 * behalf. This is the gate to check before offering something that costs a Story Point.
 * @returns {boolean}
 */
export function canWriteStoryPoints() {
  return ownsStoryPoints() || isGmConnected();
}

export function hasStoryPointsAvailable(amount = 1) {
  return getStoryPoints() >= amount;
}

/**
 * Set the pool outright. Owner only - a client that does not own the Party cannot, and should
 * be asking through requestStoryPointSpend()/requestStoryPointGrant() instead.
 * @param {number} value
 * @returns {Promise<boolean>} Whether the write was made.
 */
export async function setStoryPoints(value) {
  const party = getStoryPointsActor();
  if (!party?.isOwner) {
    return false;
  }

  await party.update({ "system.storyPoints": Math.max(0, Number(value) || 0) });
  return true;
}

/**
 * Set the GM's points outright. GM only: these are the GM's, whoever owns the Party.
 * @param {number} value
 * @returns {Promise<boolean>} Whether the write was made.
 */
export async function setGmPoints(value) {
  const party = getStoryPointsActor();
  if (!party || !game.user.isGM) {
    return false;
  }

  await party.update({ "system.gmPoints": Math.max(0, Number(value) || 0) });
  return true;
}

/**
 * Announce a spend or grant in chat, from whichever client made the write.
 * @param {string} key   An E20 string taking {actorName}.
 * @param {string} actorName
 */
function announce(key, actorName) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ user: game.user.id }),
    content: game.i18n.format(key, { actorName: actorName ?? "?" }),
  });
}

/**
 * Spend from the pool on an actor's behalf.
 *
 * Directly, when this client owns the Party; otherwise as a request to the GM's client, which
 * is fire-and-forget - callers should gate on canWriteStoryPoints()/hasStoryPointsAvailable()
 * first (see helpers/reroll.mjs#hasRerollCost) rather than wait for an answer this cannot give.
 * @param {Actor} actor   The actor spending, for the chat announcement.
 * @param {number} [amount]
 * @param {Object} [options]
 * @param {"story"|"gm"} [options.pool]   Which pool. See poolFor().
 * @param {boolean} [options.announce]   Post the generic "spends a Story Point" line. A caller
 *   that says what the point bought in a line of its own passes false, or the table reads two
 *   messages for one spend. Carried through the relay so the GM's client keeps quiet too.
 */
export async function requestStoryPointSpend(actor, amount = 1, { pool = "story", announce: say = true } = {}) {
  // The GM's own pool is the GM's to spend: no relay, no ownership question, and nothing to
  // do at all on a client that is not the GM. See poolFor() for which actors draw on it.
  if (pool === "gm") {
    await spendGm(amount, actor?.name, say);
    return;
  }

  if (ownsStoryPoints()) {
    await spend(amount, actor?.name, say);
    return;
  }

  game.socket.emit("system.essence20", {
    action: "spendStoryPoints",
    amount,
    actorName: actor?.name,
    // Only sent when off: the default stays the payload every client already understands.
    ...(say ? {} : { announce: false }),
  });
}

/**
 * Add to the pool on an actor's behalf - the mirror of requestStoryPointSpend (MLP CRB's "gain a
 * Friendship Point" Perks: Curb Your Enthusiasm, Stay Humble). No affordability gate, but the
 * same permission one.
 * @param {Actor} actor   The actor gaining the point, for the chat announcement.
 * @param {number} [amount]
 */
export async function requestStoryPointGrant(actor, amount = 1) {
  if (ownsStoryPoints()) {
    await grant(amount, actor?.name);
    return;
  }

  game.socket.emit("system.essence20", {
    action: "grantStoryPoints",
    amount,
    actorName: actor?.name,
  });
}

/**
 * Whether this client is the one GM who answers socket requests. With several GMs connected
 * each would otherwise perform the same spend, so only the active GM does.
 * @returns {boolean}
 */
function isAnsweringGm() {
  if (!game.user.isGM) {
    return false;
  }

  const active = game.users.activeGM;
  return !active || active.id === game.user.id;
}

/**
 * The GM-side handler for a spend request from a client that cannot write the Party itself.
 * @param {Object} data   {action: "spendStoryPoints", amount, actorName}
 */
export async function handleStoryPointSpendRequest(data) {
  if (!isAnsweringGm()) {
    return;
  }

  await spend(Number(data.amount) || 1, data.actorName, data.announce !== false);
}

/**
 * The GM-side handler for a grant request from a client that cannot write the Party itself.
 * @param {Object} data   {action: "grantStoryPoints", amount, actorName}
 */
export async function handleStoryPointGrantRequest(data) {
  if (!isAnsweringGm()) {
    return;
  }

  await grant(Number(data.amount) || 1, data.actorName);
}

/**
 * Take from the pool, refusing rather than going below zero.
 * @param {number} amount
 * @param {string} actorName
 */
async function spend(amount, actorName, say = true) {
  const current = getStoryPoints();
  if (current < amount) {
    ui.notifications.warn(game.i18n.format("E20.SptSpendRequestDenied", { actorName: actorName ?? "?" }));
    return;
  }

  if (await setStoryPoints(current - amount) && say) {
    announce("E20.SptSpendRequestGranted", actorName);
  }
}

/**
 * Take from the GM's pool, refusing rather than going below zero. GM only, by way of
 * setGmPoints; a Friend Group has no such pool at all (hasGmPool), so nothing is taken there.
 * @param {number} amount
 * @param {string} actorName
 */
async function spendGm(amount, actorName, say = true) {
  if (!hasGmPool(getGameLine())) {
    return;
  }

  const current = getGmPoints();
  if (current < amount) {
    ui.notifications.warn(game.i18n.format("E20.SptSpendRequestDenied", { actorName: actorName ?? "?" }));
    return;
  }

  if (await setGmPoints(current - amount) && say) {
    announce("E20.SptGmSpendGranted", actorName);
  }
}

/**
 * Add to the pool.
 * @param {number} amount
 * @param {string} actorName
 */
async function grant(amount, actorName) {
  if (await setStoryPoints(getStoryPoints() + amount)) {
    announce("E20.SptGrantRequestGranted", actorName);
  }
}

/* -------------------------------------------- */
/*  What the books say                          */
/* -------------------------------------------- */

/**
 * Whether the GM has a pool of their own in this game line.
 *
 * Three of the four core rulebooks give the GM Story Points of their own (GI Joe CRB p.127,
 * Power Rangers CRB p.91, Transformers CRB p.105). The My Little Pony CRB does not: Friendship
 * Points are the players' alone, and the book has no GM pool at all. A tracker that shows GM
 * Points to a Friend Group is showing a mechanic that line does not have.
 * @param {string} line   From getGameLine(); "" when no line is set.
 * @returns {boolean}
 */
export function hasGmPool(line) {
  return line != 'myLittlePony';
}

/**
 * The pool at the start of a session.
 *
 * Every session the players' pool resets to one point per Player Character, whatever was left
 * over - the same rule in all four books - and the GM's pool, where the line has one, starts
 * at the same size. The count comes from the primary Party's roster, which is the one place the
 * system knows who the Player Characters are; this is what the pool living on the Party makes
 * possible at all.
 * @param {number} memberCount   Player Characters on the primary Party's roster.
 * @param {string} line   From getGameLine().
 * @returns {Object} Update data for the Party.
 */
export function sessionResetUpdate(memberCount, line) {
  const points = Math.max(0, Number(memberCount) || 0);
  return {
    "system.storyPoints": points,
    "system.gmPoints": hasGmPool(line) ? points : 0,
  };
}

/* -------------------------------------------- */
/*  Who spends from which pool                  */
/* -------------------------------------------- */

/** The actor types on the players' side of the table. Everything else is the GM's. */
const PLAYER_TYPES = ["playerCharacter", "companion"];

/**
 * Which pool an actor draws on.
 *
 * "Both the players and the GM may always choose to spend their Story Points" (GI Joe CRB
 * p.127) - THEIR points. A Player Character spends the table's shared pool; an NPC, vehicle or
 * Threat under the GM's hand spends the GM's own. An actor with no type at all (a bare test
 * double, or a chat card with no speaker) is taken to be a player's.
 * @param {?Actor} actor
 * @returns {"story"|"gm"}
 */
export function poolFor(actor) {
  const type = actor?.type;
  return !type || PLAYER_TYPES.includes(type) ? "story" : "gm";
}

/**
 * Whether this client can make an actor spend, and its pool can afford it.
 *
 * The one gate to put in front of any of the universal spends. For a player-side actor that
 * is canWriteStoryPoints() and the shared pool; for the GM's own actors it is being the GM, in
 * a line that gives the GM a pool at all.
 * @param {?Actor} actor
 * @param {number} [amount]
 * @returns {boolean}
 */
export function canSpendForActor(actor, amount = 1) {
  if (poolFor(actor) === "gm") {
    return !!game.user?.isGM && hasGmPool(getGameLine()) && getGmPoints() >= amount;
  }

  return canWriteStoryPoints() && hasStoryPointsAvailable(amount);
}

/**
 * Spend on an actor's behalf from whichever pool is theirs. See canSpendForActor() for the
 * gate to check first.
 * @param {?Actor} actor
 * @param {number} [amount]
 */
export function spendForActor(actor, amount = 1, options = {}) {
  return requestStoryPointSpend(actor, amount, { ...options, pool: poolFor(actor) });
}

/* -------------------------------------------- */
/*  What each line lets a Story Point buy       */
/* -------------------------------------------- */

/**
 * Whether a Story Point can still buy +1 to a Defense AFTER the dice are rolled.
 *
 * GI Joe (p.127) and Transformers (p.105) offer "+5 to a Defense before dice are rolled, or +1
 * to a Defense after". Power Rangers (p.91) keeps only the +5 and says so - "must be spent
 * before die results are announced" - and My Little Pony (p.118) has only its scene-long +5.
 * A world with no line set gets the core-rules answer.
 * @param {string} line   From getGameLine().
 * @returns {boolean}
 */
export function defenseBoostAfterRoll(line) {
  return !['powerRangers', 'myLittlePony'].includes(line);
}

/**
 * Whether the +5 Defense spend lasts for the whole scene rather than one attack.
 *
 * Only My Little Pony: "Add +5 to any single Defense for the scene" (MLP CRB p.118). In the
 * other three books it is spent per roll.
 * @param {string} line   From getGameLine().
 * @returns {boolean}
 */
export function defenseBoostLastsScene(line) {
  return line === 'myLittlePony';
}

/**
 * Whether this line lets a whole team spend for a Grid Power bloom.
 *
 * Power Rangers only (PR CRB p.91): "The Power Rangers team can spend 1 Story Point per team
 * member to cause a Grid Power bloom, generating 1d2 Personal Power for each team member."
 * @param {string} line   From getGameLine().
 * @returns {boolean}
 */
export function hasGridPowerBloom(line) {
  return line === 'powerRangers';
}

/**
 * The Personal Power each team member ends up with after a bloom, from the dice already rolled.
 *
 * Capped at each member's own maximum - a full Ranger gains nothing from a bloom, which is
 * the price of spending on the team rather than on one person. Pure, so the roll can be made
 * where dice belong and the arithmetic tested where it does not.
 * @param {Array<{system: {powers: {personal: {value: number, max: number}}}}>} members
 * @param {Array<number>} rolls   One 1d2 result per member, in the same order.
 * @returns {Array<{member: Object, value: number, gained: number}>}
 */
export function gridPowerBloomResults(members, rolls) {
  return (members ?? []).map((member, i) => {
    const current = member.system?.powers?.personal?.value ?? 0;
    const max = member.system?.powers?.personal?.max ?? 0;
    const value = Math.min(max, current + (rolls[i] ?? 0));
    return { member, value, gained: value - current };
  });
}
