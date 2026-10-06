import { registerPostRoll, registerPreRoll, registerTurnStart } from "../../mechanics/item-hooks.mjs";
import { hasSourced } from "../../mechanics/companions/companion-link.mjs";
import { actorsInPlay, BTH, post } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import {
  setFlagRelayed as safeSetFlag, unsetFlagRelayed as safeUnsetFlag, updateRelayed as safeUpdate,
} from "../shared/relayed-writes.mjs";

/**
 * Unlucky (For You) (Beneath the Helmet, Dark Ranger, 13th level, p.40) - the Terror half: "that character suffers
 * Snag on the next Skill Test they make before the start of your next turn. If they fail this Skill Test and you
 * are aware of it, you gain 1 Terror. This Role Perk can only affect each target once per combat scene." The Snag
 * is dice.mjs's; this watches that same next test.
 */
export const UNLUCKY_FOR_YOU_ID = BTH('hSzY2uhu3L9nGP6o');

/** Whether every compared result of a roll failed - "if you fail a Skill Test". */
export function allFailed(results) {
  return Array.isArray(results) && results.length > 0 && results.every(result => result && result.success === false);
}

// An armed Unlucky (For You) watch (this roll is the "next Skill Test").
const armedUnlucky = new Map();

registerPreRoll(async actor => {
  if (!actor?.uuid) {
    return;
  }

  armedUnlucky.delete(actor.uuid);
  const watch = actor.flags?.essence20?.o1UnluckyWatch;
  if (watch?.by) {
    armedUnlucky.set(actor.uuid, watch);
    await safeUnsetFlag(actor, 'o1UnluckyWatch');
  }
});

registerPostRoll(async (actor, results, checkContext, { hits = [] } = {}) => {
  // The watched creature's own next test.
  const watch = armedUnlucky.get(actor.uuid);
  if (watch) {
    armedUnlucky.delete(actor.uuid);
    if (allFailed(results)) {
      await grantUnluckyTerror(watch.by, actor);
    }
  }

  if (!checkContext?.isAttack || !game.combat || !hasSourced(actor, UNLUCKY_FOR_YOU_ID)) {
    return;
  }

  const stored = actor.flags?.essence20?.o1UnluckyWatched;
  const ids = stored?.combatId == game.combat.id ? [...(stored.ids ?? [])] : [];
  let changed = false;
  for (const { target, hit } of hits) {
    if (!hit || !target?.uuid || ids.includes(target.uuid)) {
      continue;
    }

    ids.push(target.uuid);
    changed = true;
    await safeSetFlag(target, 'o1UnluckyWatch', { by: actor.uuid, combatId: game.combat.id });
  }

  if (changed) {
    await actor.setFlag('essence20', 'o1UnluckyWatched', { combatId: game.combat.id, ids });
  }
});

async function grantUnluckyTerror(byUuid, victim) {
  const ranger = await fromUuid(byUuid);
  if (!ranger) {
    return;
  }

  const { hasTerror } = await import("./terror.mjs");
  const { isImmuneToCondition } = await import("../../mechanics/combat/condition-immunity.mjs");
  // Terror (p.39) only accrues "provided they aren't immune to being Frightened".
  if (!hasTerror(ranger) || isImmuneToCondition(victim, 'frightened')) {
    return;
  }

  const capacity = ranger._getBaseRolePoints?.();
  if (!capacity) {
    return;
  }

  const value = Math.min(capacity.system.resource.max ?? Infinity, (capacity.system.resource.value ?? 0) + 1);
  await safeUpdate(capacity, { 'system.resource.value': value });
  await post(ranger, T('O1UnluckyTerror', { name: ranger.name, target: victim.name }));
}

// "Before the start of your next turn": the Dark Ranger's turn ends every watch they placed.
registerTurnStart(async (actor) => {
  for (const other of await actorsInPlay()) {
    if (other.flags?.essence20?.o1UnluckyWatch?.by == actor.uuid) {
      await safeUnsetFlag(other, 'o1UnluckyWatch');
    }
  }

  for (const [uuid, watch] of armedUnlucky) {
    if (watch.by == actor.uuid) {
      armedUnlucky.delete(uuid);
    }
  }
});
