import { registerDerived, registerPostRoll } from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { T, escape, postLine, writeDoc } from "./common.mjs";

/**
 * Weapon rules for the data21 slice. (The "Finesse or Might" weapons - roll whichever of the two
 * Skills the attacker is better at - are SkillSubstitution rules on each weapon effect now, scope
 * item, so a vehicle's crew rolling them swaps too.)
 * - The Psycho Weapons' Alternate Effects (Finster's Monster-Matic Cookbook, Table 5-8, p.303):
 *   Axe/Blade "Shove 10ft away (↓)", Sword "Halve Movement values (round up) of target until end of
 *   their next turn", Trident "Disarm target of 1 wielded weapon (↓)". (The Staff's "Trip" rides on
 *   data1's generic onHitStatus flag; the Slinger's Impaired is the Impaired damage type.)
 */

/* -------------------------------------------- */
/*  Psycho Weapon Alternate Effects              */
/* -------------------------------------------- */

export const HALVE_KIND = 'd21HalveMovement';

/** Which alternate-effect rider an effect item carries, from its pack flags. */
export function psychoRiderOf(item) {
  const flags = item?.flags?.essence20 ?? {};
  if (flags.d21Shove) {
    return { kind: 'shove', feet: Number(flags.d21Shove) || 10 };
  }

  if (flags.d21HalveMovement) {
    return { kind: 'halve' };
  }

  if (flags.d21Disarm) {
    return { kind: 'disarm' };
  }

  return null;
}

export async function psychoAlternatePostRoll(actor, results, checkContext, { hits, rider } = {}) {
  if (!rider?.itemUuid || !hits?.some(h => h.hit)) {
    return;
  }

  const item = await fromUuid(rider.itemUuid);
  const spec = psychoRiderOf(item);
  if (!spec) {
    return;
  }

  for (const { target, hit } of hits) {
    if (!hit || !target) {
      continue;
    }

    if (spec.kind == 'shove') {
      const { pushActor } = await import("../../forced-movement.mjs");
      const moved = await pushActor(target, actor, spec.feet);
      await postLine(actor, T(moved ? 'D21Shoved' : 'D21ShoveBlocked', { name: escape(target.name), feet: spec.feet }));
    } else if (spec.kind == 'halve') {
      const { untilEndOfNextTurn } = await import("../../target-riders.mjs");
      const marks = (target.flags?.essence20?.riderMarks ?? []).filter(mark => !(mark.kind == HALVE_KIND && mark.by == actor.uuid));
      const mark = { kind: HALVE_KIND, by: actor.uuid, label: item.name, sceneEpoch: getSceneEpoch(), ...untilEndOfNextTurn(target) };
      await writeDoc(target, 'setFlag', ['essence20', 'riderMarks', [...marks, mark]]);
      await postLine(actor, T('D21MovementHalved', { name: escape(target.name) }));
    } else if (spec.kind == 'disarm') {
      const { disarm } = await import("../../target-riders.mjs");
      await disarm(actor, target, { maxHands: 2, source: item.name });
    }
  }
}

registerPostRoll(psychoAlternatePostRoll);

/**
 * "Halve Movement values (round up) of target until end of their next turn" - read off the live
 * mark (target-riders.mjs's riderMarks, same expiry rules).
 */
export function halveMovementDerived(actor) {
  const marks = actor?.flags?.essence20?.riderMarks;
  if (!Array.isArray(marks) || !marks.some(mark => mark?.kind == HALVE_KIND && isLive(mark))) {
    return;
  }

  for (const movement of Object.values(actor.system?.movement ?? {})) {
    if (movement && Number.isFinite(movement.total)) {
      movement.total = Math.ceil(movement.total / 2);
    }
  }
}

function isLive(mark) {
  const combat = game?.combat;
  if (mark.combatId && (!combat || combat.id != mark.combatId)) {
    return false;
  }

  if (mark.sceneEpoch != null && mark.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (mark.untilRound != null && combat
    && (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn))) {
    return false;
  }

  return true;
}

registerDerived(halveMovementDerived);
