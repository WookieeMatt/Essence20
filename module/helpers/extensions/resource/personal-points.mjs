/**
 * Ruthless Points - personal Story Points (Cobra Codex, Officer / Taskmaster, p.54-57).
 *
 * Play Favorites (Officer, 1st level, p.54): "as a Standard action during combat, you can assign
 * a Ruthless Point to yourself or an ally. A Ruthless Point is a Story Point that only the
 * character it was assigned to can use. Ruthless Points expire. Unless the source of the Ruthless
 * Point states otherwise, Ruthless Points unused by the end of your next turn are wasted."
 *
 * Play Favorites Against Each Other (15th level, p.54): "you can assign one Ruthless Point for two
 * allies to share. Once one ally uses the Ruthless Point, it is used up for both allies.
 * Additionally, assigning Ruthless Points now takes a Move action instead of a Standard action."
 *
 * This, I Command (Taskmaster, 6th level, p.57): "when you use an ability that grants an ally
 * Upshifts, one or more additional actions, or a Ruthless Point, you can deal 1 point of Psychic
 * Damage to that ally to double the benefit you grant them." Built for the Ruthless Point grant.
 *
 * Ruthless Efficiency (Taskmaster, 6th level, p.57): "if you or an ally ends their turn with an
 * unspent Ruthless Point, you begin your next turn with a Ruthless Point."
 *
 * A held point is spent before the table's pool whenever this actor spends a Story Point -
 * helpers/story-points.mjs asks personalStoryPoints()/spendPersonalStoryPoint() first (see the
 * integration patch). "The end of your next turn" is the holder's: a point assigned during the
 * holder's own turn survives that turn and the next; one assigned on someone else's turn lasts
 * until the end of the holder's next turn. Out of combat, points end with the scene.
 */
import {
  registerSceneAdvanced, registerTurnEnd, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import {
  IDS, T, has, isActiveGm, isItem, say, targetedActors, worldActors, writeActor,
} from "./common.mjs";

export const POINTS_FLAG = 'personalPoints';
const EFFICIENCY_FLAG = 'ruthlessEfficiencyPending';

export function pointsOf(actor) {
  const list = actor?.flags?.essence20?.[POINTS_FLAG];
  return Array.isArray(list) ? list : [];
}

/** How many personal Story Points the actor can spend right now. */
export function personalStoryPoints(actor) {
  return pointsOf(actor).length;
}

/**
 * A new Ruthless Point record.
 * @param {Object} options
 * @param {Boolean} options.onOwnTurn   Assigned during the holder's own turn.
 * @param {?String} [options.shareId]   Shared with another holder.
 * @param {String} [options.source]
 */
export function newPoint({ onOwnTurn, shareId = null, source = 'playFavorites', label = '' }) {
  return {
    id: foundry.utils.randomID(),
    source,
    label,
    shareId,
    turnEndsLeft: onOwnTurn ? 2 : 1,
  };
}

/**
 * The holder's points after one of their turns ends: each has one fewer turn end to live, and
 * those at zero are gone.
 * @param {Array} points
 * @returns {{kept: Array, expired: Array}}
 */
export function afterTurnEnd(points) {
  const kept = [];
  const expired = [];
  for (const point of points) {
    const next = { ...point, turnEndsLeft: (point.turnEndsLeft ?? 1) - 1 };
    (next.turnEndsLeft > 0 ? kept : expired).push(next);
  }

  return { kept, expired };
}

function isOwnTurn(actor) {
  const current = game.combat?.combatant?.actor;
  return !!current && !!actor && current.uuid == actor.uuid;
}

export async function givePoints(actor, count, options = {}) {
  const added = Array.from({ length: count }, () => newPoint({ onOwnTurn: isOwnTurn(actor), ...options }));
  await writeActor(actor, { [`flags.essence20.${POINTS_FLAG}`]: [...pointsOf(actor), ...added] });
  return added;
}

/**
 * Spend the actor's own points in place of the pool. Called by story-points.mjs before it spends
 * from the table's pool.
 * @param {?Actor} actor
 * @param {Number} amount
 * @param {Boolean} [announce]
 * @returns {Promise<Boolean>}   True if the whole amount came out of personal points.
 */
export async function spendPersonalStoryPoint(actor, amount = 1, announce = true) {
  const points = pointsOf(actor);
  if (!actor || amount < 1 || points.length < amount) {
    return false;
  }

  const spent = points.slice(0, amount);
  await writeActor(actor, { [`flags.essence20.${POINTS_FLAG}`]: points.slice(amount) });

  // A shared point is used up for both allies.
  for (const shareId of spent.map(p => p.shareId).filter(Boolean)) {
    for (const other of worldActors()) {
      if (other.uuid != actor.uuid && pointsOf(other).some(p => p.shareId == shareId)) {
        await writeActor(other, { [`flags.essence20.${POINTS_FLAG}`]: pointsOf(other).filter(p => p.shareId != shareId) });
      }
    }
  }

  if (announce) {
    await say(actor, T('ResRuthlessSpent', { name: actor.name, count: amount }));
  }

  return true;
}

/* -------------------------------------------- */
/*  Play Favorites (Use button)                  */
/* -------------------------------------------- */

async function choose(title, prompt, buttons) {
  const { chooseButtons } = await import("../../grants.mjs");
  return chooseButtons(title, prompt, buttons);
}

async function assignPoints(item, economy, pay) {
  const officer = item.parent;
  const canShare = has(officer, IDS.playFavoritesAgainst);
  const cost = canShare ? 'move' : 'standard';
  const targets = targetedActors();
  const recipients = targets.length ? targets : [officer];

  let mode = 'single';
  if (canShare && recipients.length >= 2) {
    mode = await choose(item.name, T('ResRuthlessSharePrompt', { a: recipients[0].name, b: recipients[1].name }), [
      ['share', T('ResRuthlessShare')], ['single', T('ResRuthlessSingle', { name: recipients[0].name })],
    ]);
    if (!mode) {
      return null;
    }
  }

  // This, I Command: 1 Psychic to an ally doubles what they're given.
  let count = 1;
  const ally = recipients[0];
  if (has(officer, IDS.thisICommand) && ally.uuid != officer.uuid && mode == 'single') {
    const pick = await choose(item.name, T('ResThisICommandPrompt', { name: ally.name }), [
      ['double', T('ResThisICommandDouble')], ['no', T('ResThisICommandNo')],
    ]);
    if (!pick) {
      return null;
    }

    if (pick == 'double') {
      count = 2;
    }
  }

  if (!(await pay(cost))) {
    return null;
  }

  if (count == 2) {
    const { applyDamage } = await import("../../combat.mjs");
    await applyDamage(ally, 1, 'psychic');
  }

  if (mode == 'share') {
    const shareId = foundry.utils.randomID();
    await givePoints(recipients[0], 1, { shareId, label: officer.name });
    await givePoints(recipients[1], 1, { shareId, label: officer.name });
    return T('ResRuthlessSharedLine', { officer: officer.name, a: recipients[0].name, b: recipients[1].name });
  }

  await givePoints(ally, count, { label: officer.name });
  return T('ResRuthlessLine', { officer: officer.name, name: ally.name, count });
}

registerUse({
  id: 'resPlayFavorites',
  matches: item => isItem(item, IDS.playFavorites) || isItem(item, IDS.playFavoritesAgainst),
  run: (item, economy, pay) => assignPoints(item, economy, pay),
});

/* -------------------------------------------- */
/*  Expiry and Ruthless Efficiency               */
/* -------------------------------------------- */

registerTurnEnd(async (actor) => {
  const points = pointsOf(actor);
  if (!points.length) {
    return;
  }

  // Ended a turn with an unspent point: every Ruthless Efficiency holder on this side (the holder
  // themself included) starts their next turn with one.
  for (const holder of worldActors().filter(a => has(a, IDS.ruthlessEfficiency))) {
    if (holder.uuid == actor.uuid || holder.type == actor.type) {
      await writeActor(holder, { [`flags.essence20.${EFFICIENCY_FLAG}`]: true });
    }
  }

  const { kept, expired } = afterTurnEnd(points);
  await writeActor(actor, { [`flags.essence20.${POINTS_FLAG}`]: kept });
  if (expired.length) {
    await say(actor, T('ResRuthlessExpired', { name: actor.name, count: expired.length }));
  }
});

registerTurnStart(async (actor) => {
  if (!actor?.flags?.essence20?.[EFFICIENCY_FLAG]) {
    return;
  }

  await writeActor(actor, { [`flags.essence20.${EFFICIENCY_FLAG}`]: false });
  if (has(actor, IDS.ruthlessEfficiency)) {
    // Given at the very start of the turn: it lasts through this turn's end and the next.
    const [point] = [newPoint({ onOwnTurn: true, source: 'ruthlessEfficiency', label: actor.name })];
    await writeActor(actor, { [`flags.essence20.${POINTS_FLAG}`]: [...pointsOf(actor), point] });
    await say(actor, T('ResRuthlessEfficiency', { name: actor.name }));
  }
});

registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    if (pointsOf(actor).length || actor.flags?.essence20?.[EFFICIENCY_FLAG]) {
      await actor.update({ [`flags.essence20.${POINTS_FLAG}`]: [], [`flags.essence20.${EFFICIENCY_FLAG}`]: false });
    }
  }
});
