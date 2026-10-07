import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { ruleBrawnBonus } from "../../rules/plugins/effects/brawn-requirement.mjs";
import { itemsOf } from "../shared/item-lookups.mjs";

/**
 * Armor rules for the data1 slice of the Item Review (Reinforced Shell's Alt Mode / Bot Mode split is its upgrade's own
 * Defense and HitRider rules):
 * - Brawn requirements on battledress (Tanker Armor, Marauder Armor), and on equipped shields (2026-10-07: the
 *   shield's requirements text, e.g. Through the Shattered Grid's Sentry and Vanguard Shields).
 */

const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/* -------------------------------------------- */
/*  Brawn requirement                            */
/* -------------------------------------------- */

// Ordered lowest to highest - the same ladder as CONFIG.E20.weaponRequirementShiftLadder, with an
// untrained d20 (and anything worse) sitting below d2.
const BRAWN_LADDER = ["none", "d2", "d4", "d6", "d8", "d10", "d12", "2d8", "3d6"];

function ladderIndex(shift) {
  if (['autoSuccess', 'criticalSuccess'].includes(shift)) {
    return BRAWN_LADDER.length - 1;
  }

  const index = BRAWN_LADDER.indexOf(shift);
  return index < 0 ? 0 : index;
}

/**
 * Die sizes the actor's Brawn counts as higher for an armor requirement - Infinity to ignore it. The Perks that
 * bend it (Over Brawn, The Heavy, Pack Mule) carry BrawnRequirement rules (rules/plugins/effects/brawn-requirement.mjs).
 */
export function brawnRequirementBonus(actor) {
  return ruleBrawnBonus(actor, 'requirement');
}

/**
 * A shield's printed Brawn requirement, read from its requirements text ("Brawn d4", or "Brawn +d6" as Through the
 * Shattered Grid's Table 2-7 prints it) - the same rule as armor's: ↓1 to the equipment's use for every rank of Brawn
 * short (Power Rangers CRB p.81). Null when the text names no Brawn die.
 * @param {Item} shield
 * @returns {String|null}
 */
export function shieldBrawnRequirement(shield) {
  const match = /\bbrawn\s*\+?\s*(\d?d\d+)\b/i.exec(shield?.system?.requirements ?? '');
  const shift = match?.[1]?.toLowerCase();
  return shift && BRAWN_LADDER.includes(shift) ? shift : null;
}

/**
 * How many die sizes of Brawn the actor lacks for this armor's (or shield's) printed Brawn requirement - GI Joe
 * CRB, Brawn (p.117): ↓1 while using the gear for every die size of Brawn short. Tanker Armor (Brawn d2) and Marauder Armor
 * (Brawn d4) print theirs in Table 8-5 (p.154-155); armor has no requirements field, so the pack
 * carries it as flags.essence20.brawnRequirement.
 * @param {Actor} actor
 * @param {Item} armor
 * @returns {Number}
 */
export function brawnShortfall(actor, armor) {
  const required = armor?.type == 'shield' ? shieldBrawnRequirement(armor) : armor?.flags?.essence20?.brawnRequirement;
  if (!required || required == 'none') {
    return 0;
  }

  const has = actor?.system?.skills?.brawn?.shift ?? 'd20';
  return Math.max(0, ladderIndex(required) - ladderIndex(has) - brawnRequirementBonus(actor));
}

/**
 * Worn battledress the actor is too weak for. "Using" armor is read as the physical
 * actions it encumbers: Strength- and Speed-based Skill Tests and every attack. Each armor is its
 * own dialog line, so a GM who reads it more narrowly can untick it.
 */
export function brawnRequirementSources(actor, ctx = {}) {
  const physical = ctx.isAttack || ['strength', 'speed'].includes(ctx.rolledEssence);
  if (!physical) {
    return [];
  }

  // An equipped shield counts the same way as worn armor (its requirement is in its requirements text).
  return itemsOf(actor)
    .filter(item => item.system?.equipped
      && ((item.type == 'armor' && !item.system?.isPowerArmor) || item.type == 'shield'))
    .map(armor => ({ armor, shortfall: brawnShortfall(actor, armor) }))
    .filter(entry => entry.shortfall > 0)
    .map(({ armor, shortfall }) => ({
      id: `d1BrawnReq-${armor.id}`,
      label: T('E20.D1BrawnRequirement', {
        name: armor.name,
        req: armor.type == 'shield' ? shieldBrawnRequirement(armor) : armor.flags.essence20.brawnRequirement,
      }),
      shiftDown: shortfall,
    }));
}

registerRollSources((actor, target, ctx) => ({ sources: brawnRequirementSources(actor, ctx) }));
