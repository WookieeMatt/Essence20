/**
 * Finster's Monster-Matic Cookbook leftovers: Aura of Decay's Health cost, Flames of Hate's
 * armor-ignore, Incineration Blast's Critical Success burn and Nemesis Drain's scene expiry.
 */
import {
  registerDefenseAdjust, registerHitRider, registerPreRoll, registerSceneAdvanced, registerTurnEnd,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { PR2, T, isActiveGm, parentOf, sourceOf } from "./common.mjs";
import { postLine, writeActor } from "../zord1/common.mjs";

/* -------------------------------------------- */
/*  Aura of Decay                                */
/* -------------------------------------------- */

// Aura of Decay (p.272): "Effect: Culture (Arcane) attack; Range 20ft in all directions (2 Void
// Damage); costs 1 Health to use." The Void armor-ignore is already dice.mjs's generic Void rule
// (voidIgnoresArmor reads the Power's own damageType). The Health is paid as the attack is made.
export async function auraOfDecayCost(actor, dataset, item) {
  if (item?.type != 'power' || sourceOf(item) != PR2.auraOfDecay || dataset?.rollType != 'power') {
    return;
  }

  const health = Number(actor?.system?.health?.value) || 0;
  await writeActor(actor, 'update', [{ 'system.health.value': Math.max(0, health - 1) }]);
  await postLine(actor, T('Pr2AuraOfDecayCost', { name: actor.name, power: item.name }));
}

registerPreRoll(auraOfDecayCost);

/* -------------------------------------------- */
/*  Flames of Hate                               */
/* -------------------------------------------- */

// Flames of Hate (p.284): "This attack ignores armor" - the armor share of whichever Defense it
// targets (Cleverness here) comes off, the same component getDefenseValue's ignoreArmor removes.
export function isFlamesOfHate(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  return PR2.flamesOfHateEffects.includes(sourceOf(item)) || sourceOf(parentOf(actor, item)) == PR2.flamesOfHateWeapon;
}

export function flamesOfHateDefense(attacker, defender, defenseType, ctx = {}) {
  if (!isFlamesOfHate(attacker, ctx.item) || defender?.statuses?.has?.('armorStripped')) {
    return 0;
  }

  const defense = defender?.system?.defenses?.[defenseType];
  const armor = Number(defender?.system?.isMorphed ? defense?.morphed : defense?.armor) || 0;
  return -armor;
}

registerDefenseAdjust(flamesOfHateDefense);

/* -------------------------------------------- */
/*  Incineration Blast                           */
/* -------------------------------------------- */

// Incineration Blast (p.288 / weapon p.302): "on a Critical Success, if the target moves on their
// next turn, they suffer an additional 1 Fire damage." A mark on the target; the GM's client burns
// them the first time their token moves on their own turn, and the mark ends with that turn.
export const SMOLDER_KIND = 'pr2IncinerationSmolder';

export function isIncinerationBlast(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  return sourceOf(item) == PR2.incinerationBlastEffect || sourceOf(parentOf(actor, item)) == PR2.incinerationBlastWeapon;
}

export async function incinerationRider(actor, target, result, rider, tools = {}) {
  if (!tools.isCrit || !target) {
    return;
  }

  const item = rider?.itemUuid ? (actor.items?.contents ?? [...(actor.items ?? [])]).find(i => i.uuid == rider.itemUuid) : null;
  if (!isIncinerationBlast(actor, item)) {
    return;
  }

  const { addMark, untilEndOfNextTurn } = await import("../../target-riders.mjs");
  await writeMark(target, addMark, { kind: SMOLDER_KIND, by: actor.uuid, label: item.name, ...untilEndOfNextTurn(target) });
  result.riderNote = [result.riderNote, T('Pr2IncinerationNote', { name: target.name })].filter(Boolean).join(' ');
}

async function writeMark(target, addMark, mark) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(target)) {
    const marks = [...(target.flags?.essence20?.riderMarks ?? []), mark];
    await relayToGm(target, 'setFlag', ['essence20', 'riderMarks', marks]);
    return;
  }

  await addMark(target, mark);
}

registerHitRider(incinerationRider);

export async function onTokenMoved(tokenDoc, change) {
  if (!isActiveGm() || (change?.x === undefined && change?.y === undefined)) {
    return;
  }

  const actor = tokenDoc?.actor;
  const combat = globalThis.game?.combat;
  if (!actor || !combat || combat.combatant?.actor?.id != actor.id) {
    return;
  }

  const { findMark, removeMark } = await import("../../target-riders.mjs");
  const mark = findMark(actor, SMOLDER_KIND);
  if (!mark) {
    return;
  }

  await removeMark(actor, SMOLDER_KIND);
  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(actor, 1, 'fire');
  await postLine(actor, T('Pr2IncinerationBurn', { name: actor.name, source: mark.label ?? 'Incineration Blast' }));
}

globalThis.Hooks?.on?.('updateToken', (...args) => onTokenMoved(...args).catch(error => console.error('Essence20 | pr2', error)));

// "Their next turn" only - once it ends without a move, the threat is gone.
registerTurnEnd(async actor => {
  const { findMark, removeMark } = await import("../../target-riders.mjs");
  if (actor && findMark(actor, SMOLDER_KIND)) {
    await removeMark(actor, SMOLDER_KIND);
  }
});

/* -------------------------------------------- */
/*  Nemesis Drain                                */
/* -------------------------------------------- */

// Nemesis Drain (p.284): the -1 lasts "until the end of the scene" - helpers/nemesis-drain.mjs never
// cleared it. (Its Toughness-only scope - It's Morphin Time!'s armor is a Toughness bonus - is the
// dice.mjs patch in scratchpad integration/pr2-patch.cjs.)
export const NEMESIS_PENALTY_FLAG = 'nemesisDrainPenaltyActive';

export async function clearNemesisDrain() {
  if (!isActiveGm()) {
    return;
  }

  const actors = new Set(worldActors());
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      actors.add(token.actor);
    }
  }

  for (const actor of actors) {
    if (actor?.flags?.essence20?.[NEMESIS_PENALTY_FLAG]) {
      await actor.unsetFlag('essence20', NEMESIS_PENALTY_FLAG);
    }
  }
}

registerSceneAdvanced(clearNemesisDrain);
