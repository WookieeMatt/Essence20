import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { ruleBrawnBonus } from "../../rules/plugins/effects/brawn-requirement.mjs";
import { itemsOf } from "../shared/item-lookups.mjs";
import { parentWeaponOf } from "../shared/unarmed-attacks.mjs";
import { contextFor, evaluate } from "../../rules/predicate.mjs";

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
export function brawnRequirementBonus(actor, equipment = 'armor') {
  return ruleBrawnBonus(actor, 'requirement', equipment);
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
  return Math.max(0, ladderIndex(required) - ladderIndex(has) - brawnRequirementBonus(actor, 'armor'));
}

/**
 * A weapon's printed Brawn requirement (its structured requirements, skill brawn), or null. For a Transformer, a weapon
 * in an Integrated Hardpoint has it lowered one die (TF CRB p.114: d4 becomes d2) - Item#_prepareHardpointDerived's
 * effectiveBrawnReq. The hardpoint type defaults on every weapon, so only an actor that can transform reads it.
 * @param {Item} weapon
 * @param {Actor} [actor]
 * @returns {String|null}
 */
export function weaponBrawnRequirement(weapon, actor = null) {
  const requirements = weapon?.system?.requirements;
  if (requirements?.skill != 'brawn') {
    return null;
  }

  const shift = actor?.system?.canTransform ? (weapon.system.effectiveBrawnReq ?? requirements.shift) : requirements.shift;
  return BRAWN_LADDER.includes(shift) && shift != 'none' ? shift : null;
}

/**
 * Die sizes of Brawn the actor lacks for a weapon's Brawn requirement - ↓1 to its attacks for each (GI Joe CRB p.117,
 * TF CRB p.97, Power Rangers CRB p.81). Rules raising Brawn for requirements count (The Heavy, Ordnance Expert's
 * weapons-only ↑4); Over Brawn ignores it.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Number}
 */
export function weaponBrawnShortfall(actor, weapon) {
  const required = weaponBrawnRequirement(weapon, actor);
  if (!required || meetsBrawnAlternative(actor, weapon)) {
    return 0;
  }

  const has = actor?.system?.skills?.brawn?.shift ?? 'd20';
  return Math.max(0, ladderIndex(required) - ladderIndex(has) - brawnRequirementBonus(actor, 'weapon'));
}

/**
 * Whether the weapon's printed requirement offers something in place of the Brawn, and the actor has it: "Brawn d4/Huge"
 * (TF and PR CRB) or "Brawn/Targeting d4" (Power Cannon) are prerequisite `any` groups - a Huge character, or one with
 * the Targeting, meets the requirement without the Brawn. A Brawn tag on its own (the Forge of Solus Prime's d8 floor)
 * keeps the requirement whatever else is met.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function meetsBrawnAlternative(actor, weapon) {
  const when = weapon?.system?.prerequisites?.when ?? [];
  const isBrawnTag = tag => typeof tag == 'string' && /^self:skill:brawn>=/.test(tag);
  if (!Array.isArray(when) || when.some(isBrawnTag)) {
    return false;
  }

  const ctx = contextFor({ self: actor });
  return when.some(group => Array.isArray(group?.any) && group.any.some(isBrawnTag)
    && group.any.some(tag => !isBrawnTag(tag) && evaluate([tag], ctx) === true));
}

/** The attack's own weapon, when it is too heavy for the attacker: one dialog line, unticked by a GM who disagrees. */
export function weaponBrawnSources(actor, ctx = {}) {
  if (!ctx.isAttack || ctx.item?.type != 'weaponEffect') {
    return [];
  }

  const weapon = parentWeaponOf(ctx.item, actor);
  const shortfall = weapon ? weaponBrawnShortfall(actor, weapon) : 0;
  return shortfall > 0 ? [{
    id: `d1BrawnReqWeapon-${weapon.id}`,
    label: T('E20.D1BrawnRequirement', { name: weapon.name, req: weaponBrawnRequirement(weapon, actor) }),
    shiftDown: shortfall,
  }] : [];
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

registerRollSources((actor, target, ctx) => ({ sources: [...brawnRequirementSources(actor, ctx), ...weaponBrawnSources(actor, ctx)] }));
