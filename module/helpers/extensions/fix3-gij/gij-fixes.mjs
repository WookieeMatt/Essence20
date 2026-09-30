import {
  registerApplyDialog, registerCostRule, registerDialogToggles, registerRollSources,
} from "../../extensions.mjs";
import { angrySnagSkill } from "../../angry.mjs";
import { packAttackGrant } from "../../pack-attack.mjs";
import { findHangUp, findPerk } from "../../perks.mjs";

/**
 * Fix pass 3, GI JOE group: book-accuracy fixes that plug in through the extension points rather
 * than dice.mjs.
 * - Angry (Cobra Codex, Influence Hang-Up, p.26): the Snag on the chosen Skill for the rest of the
 *   scene (the record itself is written by helpers/angry.mjs).
 * - Pack Attack (Cobra Codex, Warthog, p.69): the allies' ↑1 on every attack against the Growled
 *   target until the start of the user's next turn (record written by helpers/pack-attack.mjs).
 * - Mega Training Regimen (Ferocious Fighters, p.74): the Snag on Grapple and Trip attempts against
 *   the holder, and Shoves made without a Maneuver attack (dice.mjs already covers Maneuver).
 * - Surgical Operators (Ferocious Fighters, p.72): its Science Edge as a Roll Options Dialog switch.
 * - One With Your Weapons (Intercontinental Adventures, p.13): switching weapons as a Free action.
 */

const ID = {
  angryHangUp: 'Compendium.essence20.cobra_codex.Item.wGMyGbySdNSgPs8B',
  megaTrainingRegimen: 'Compendium.essence20.ferocious_fighters.Item.nLT8HSCCGWEBiRlq',
  surgicalOperators: 'Compendium.essence20.ferocious_fighters.Item.JtRCN6ppDatZVmav',
  oneWithYourWeapon: 'Compendium.essence20.intercontinental_adventures.Item.RH3AFV38EBAfTvW1',
};

const L = (key, fallback) => (globalThis.game?.i18n?.has?.(key) ? game.i18n.localize(key) : fallback);

/* -------------------------------------------- */
/*  Angry                                        */
/* -------------------------------------------- */

export function angrySources(actor, ctx = {}) {
  const hangUp = findHangUp(actor, ID.angryHangUp);
  if (!hangUp || !ctx.rolledSkill || angrySnagSkill(actor) != ctx.rolledSkill) {
    return [];
  }

  return [{ id: 'fix3Angry', label: hangUp.name ?? 'Angry', snag: true }];
}

/* -------------------------------------------- */
/*  Pack Attack                                  */
/* -------------------------------------------- */

export function packAttackSources(actor, target, ctx = {}) {
  const grant = ctx.isAttack ? packAttackGrant(actor, target) : null;
  return grant ? [{ id: 'fix3PackAttack', label: grant.label ?? 'Pack Attack', shiftUp: 1 }] : [];
}

/* -------------------------------------------- */
/*  Mega Training Regimen                        */
/* -------------------------------------------- */

// "Attempts to Grapple, Shove, or Trip you suffer Snag." dice.mjs gives it for a Maneuver
// alternate effect; this covers the Grapple and Knock Prone (Trip) alternate effects, and a Shove
// rolled on its own (no Maneuver attack behind it).
const GRAPPLE_OR_TRIP = ['grapple', 'knocProne'];

export function megaTrainingSources(actor, target, ctx = {}) {
  const perk = target ? findPerk(target, ID.megaTrainingRegimen) : null;
  if (!perk) {
    return [];
  }

  const damageType = ctx.item?.type == 'weaponEffect' ? ctx.item.system?.damageType : null;
  const covered = (ctx.isAttack && GRAPPLE_OR_TRIP.includes(damageType)) || (ctx.isShove && damageType != 'maneuver');
  return covered ? [{ id: 'fix3MegaTrainingRegimen', label: perk.name ?? 'Mega Training Regimen', snag: true }] : [];
}

/* -------------------------------------------- */
/*  All roll sources                             */
/* -------------------------------------------- */

export function gijFixSources(actor, target, ctx = {}) {
  return {
    sources: [
      ...angrySources(actor, ctx),
      ...packAttackSources(actor, target, ctx),
      ...megaTrainingSources(actor, target, ctx),
    ],
    consumes: [],
  };
}

registerRollSources(gijFixSources);

/* -------------------------------------------- */
/*  Surgical Operators                           */
/* -------------------------------------------- */

// "You gain Edge on Science Skill Tests when treating poisons, toxins, or similar substances." Only
// the player knows what a Science test is for, so it's an off-by-default switch on Science tests.
export function surgicalOperatorsToggles(actor, { rolledSkill } = {}) {
  const perk = rolledSkill == 'science' ? findPerk(actor, ID.surgicalOperators) : null;
  if (!perk) {
    return [];
  }

  return [{
    name: 'fix3SurgicalOperators', type: 'checkbox', value: false,
    label: L('E20.Fix3GijSurgicalOperatorsToggle', `${perk.name}: treating a poison or toxin (Edge)`),
  }];
}

export function surgicalOperatorsApply(actor, options) {
  if (options?.ext?.fix3SurgicalOperators) {
    options.edge = true;
  }
}

registerDialogToggles(surgicalOperatorsToggles);
registerApplyDialog(surgicalOperatorsApply);

/* -------------------------------------------- */
/*  One With Your Weapons                        */
/* -------------------------------------------- */

// "Switching between Silent Martial Arts weapons is a Free action for you." Which weapons are
// being swapped isn't known when the Draw Weapon action is paid for, so it's asked.
export const ONE_WITH_YOUR_WEAPON_RULE = {
  id: 'fix3OneWithYourWeapon',
  label: 'One With Your Weapons',
  has: actor => !!findPerk(actor, ID.oneWithYourWeapon),
  matches: ctx => ctx?.key == 'drawWeapon',
  to: () => 'free',
  ask: 'E20.ActionPerkAskOneWithYourWeapon',
};

registerCostRule(ONE_WITH_YOUR_WEAPON_RULE);
