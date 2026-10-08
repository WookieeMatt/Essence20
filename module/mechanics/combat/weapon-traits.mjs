import { isMonsterGrown } from "../../items/forms/monster-grow.mjs";
import { ruleFiresAsReinforced, ruleHardpoints, ruleWeaponTraits } from "../../rules/adapter.mjs";

/**
 * Weapon and armor trait rules that used to be labels only, and the Perks and gear that bend them.
 * dice.mjs asks these questions at the points where it builds an attack; nothing here rolls or
 * writes anything.
 */

const ID = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
// (Demolisher, Big Lobber and Fireball's traits are WeaponTrait item rules - ruleWeaponTraits - so their ids went.)
export const TRAIT_PERK = {
  mlpLightArmor: ID('mlp_crb', '4M1CnapdbRIBl3It'),
  mlpHeavyArmor: ID('mlp_crb', 'B8RcQxof4JmlbEHE'),
};

// My Little Pony's armor prints its own downshift (MLP CRB p.152) in place of G.I. Joe's "not
// Silent" Infiltration penalty - that downshift is a RollModifier rule on each armor now.
const MLP_ARMOR = [TRAIT_PERK.mlpLightArmor, TRAIT_PERK.mlpHeavyArmor];

// Items printed with "Ignores Defend" (A Jump Through Time, p.76-78).
const IGNORES_DEFEND = ['fp55vEQbwH92XrgI', '4nZgPVgqJm7nWgZE'];
// Items printed with "Reload ×2" (A Jump Through Time, p.78).
export const RELOAD_TWICE = ['UvWORzyYZ6kXfySK', 'kThg2spvAa9rTepi'];
// (Upgrades: Salvaged's Fumble is an afterRoll Trigger on the upgrade, Potent Poison's extra round an ItemModifier rule,
// Extended Mag's skipped reload a ReloadSkip rule.)

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? '';
}

const idOf = uuid => String(uuid ?? '').split('.').pop();

export function actorHas(actor, uuid) {
  return !!actor?.items?.find?.(item => sourceOf(item) == uuid);
}

/**
 * The traits a Perk adds to a weapon: Demolisher (Cobra Codex p.68, "all weapons gain Wrecker"), Big
 * Lobber (Quartermaster's Guide p.28, thrown grenades gain Indirect), Fireball (Cobra Codex p.59,
 * "weapons you use with the Fire trait gain the Antitank trait"), and a weapon Weapon Customizer
 * was used on - all WeaponTrait rules.
 * @param {Item} weapon
 * @param {String[]} traits   Its traits so far.
 * @returns {String[]}   Traits to add.
 */
export function perkGrantedTraits(weapon, traits) {
  const actor = weapon?.parent;
  const add = [];
  if (!actor) {
    return add;
  }

  // Demolisher, Big Lobber, Fireball and Weapon Customizer (a weapon it marked, while its holder has the Perk) are
  // WeaponTrait item rules (rules/adapter.mjs#ruleWeaponTraits).
  add.push(...ruleWeaponTraits(actor, weapon, traits));

  return add;
}

// (Ram Cone - Decepticon Directive gear, p.76 - is item rules now: AttackTraits for its Alt Mode rams, a RollModifier for
// the Bot Mode unarmed Blunt attack.)

// (Augur - Enigma of Combination gear, p.56 - is item rules: AttackTraits for its Alt Mode attacks' Armor Piercing, an
// ItemModifier stage item for their Sharp damage, a Use for the blade.)

/**
 * "Ignores Defend" - the printed rule on the Footman's Flail and Kusarigama.
 */
export function ignoresDefend(parentWeapon) {
  return IGNORES_DEFEND.includes(idOf(sourceOf(parentWeapon)));
}

/**
 * Energy (PR CRB, Weapon Traits): ↑1 for Energy weapons against any grown Threat.
 */
export function isGrownThreat(target) {
  return isMonsterGrown(target) || !!target?.getFlag?.('essence20', 'normalFormId');
}

/**
 * Ballistic (GI Joe CRB p.147): at long range the attack goes against Toughness, unless the target
 * has cover or a Perk that sets its Defense.
 * Long range is past the effect's first (effective) range.
 * @returns {Boolean}
 */
export function isBallisticLongRange(actor, item, parentWeapon, targetToken) {
  const range = item?.system?.range?.value;
  if (!parentWeapon?.system?.traits?.includes('ballistic') || !range || !targetToken?.center || !canvas?.grid) {
    return false;
  }

  const statuses = targetToken.actor?.statuses;
  if (statuses?.has?.('cover') || statuses?.has?.('totalCover')) {
    return false;
  }

  const attacker = actor?.getActiveTokens?.()?.[0];
  if (!attacker?.center) {
    return false;
  }

  return canvas.grid.measurePath([attacker.center, targetToken.center]).distance > range;
}

/**
 * Silent (GI Joe CRB, Battledress Traits): battledress without Silent costs its total bonus as a
 * penalty on Infiltration.
 * @returns {Number}   The shift down.
 */
export function noisyArmorPenalty(actor) {
  return (actor?.items ?? []).filter(item => item.type == 'armor' && item.system?.equipped
    && !item.system?.isPowerArmor && !(item.system?.traits ?? []).includes('silent')
    && !MLP_ARMOR.includes(sourceOf(item)))
    .reduce((sum, armor) => sum + (Number(armor.system.totalBonusToughness) || 0) + (Number(armor.system.totalBonusEvasion) || 0), 0);
}

/**
 * Computerized (battledress): its Evasion bonus doesn't count against Electromagnetic weapons.
 */
export function computerizedArmorEvasion(target) {
  return (target?.items ?? []).filter(item => item.type == 'armor' && item.system?.equipped
    && (item.system?.traits ?? []).includes('computerized'))
    .reduce((sum, armor) => sum + (Number(armor.system.totalBonusEvasion) || 0), 0);
}

// (HARDPOINT_PERK went: nothing read it - every one of those Perks is a Hardpoints item rule, read below.)

/**
 * Extra Hardpoints from Perks (TF CRB p.114 slots):
 * - Armament (Gunner, p.68): one more Integrated Weapon Hardpoint.
 * - Experiment (Influence, p.32): its extra Integrated Hardpoint option.
 * - In Case of Emergency (Support, p.54): two more non-weapon Internal Hardpoints. Only
 *   weapons are counted against the Integrated slots, so these two go in their own nonWeapon count
 *   instead of letting two more weapons in.
 * - The Fiercest Among You (Rainmaker, p.52): one more Reinforced Integrated Weapon Hardpoint.
 * - Quick Draw (Gunslinger, p.70): two holsters that count as External Weapon Hardpoints.
 * @param {Actor} actor
 * @returns {{external: Number, integrated: Number, nonWeapon: Number}}
 */
export function hardpointBonus(actor) {
  // Armament, Experiment's hardpoint option, In Case of Emergency, The Fiercest Among You and Quick
  // Draw are Hardpoints item rules (rules/adapter.mjs#ruleHardpoints).
  const { external, integrated, nonWeapon } = ruleHardpoints(actor);
  return { external, integrated, nonWeapon };
}

/**
 * Titan Hardpoint Upgrades (Enigma of Combination p.41): Integrated Hardpoint weapons ignore Size
 * requirements, but each takes one extra Hardpoint.
 */
export function integratedHardpointsPerWeapon(actor) {
  return ruleHardpoints(actor).perWeapon;
}

/**
 * Whether an Integrated Hardpoint weapon fires as if Reinforced: the Reinforced Hardpoint upgrade
 * (TF CRB p.128), The Fiercest Among You's Reinforced Hardpoint, or Gun Runner (Gunslinger, p.70:
 * an Integrated Hardpoint counts as Reinforced for ballistic weapons).
 */
export function firesAsReinforced(actor, weapon) {
  return !!weapon?.system?.hardpoint?.reinforced
    // The Reinforced Hardpoint upgrade, The Fiercest Among You and Gun Runner - Hardpoints item rules.
    || ruleFiresAsReinforced(actor, weapon);
}
