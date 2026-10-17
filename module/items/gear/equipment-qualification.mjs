import { sourceOf } from "../shared/item-lookups.mjs";
import { onHook } from "../shared/hooks-and-clients.mjs";
import { ruleQualifiedUpgrade } from "../../rules/adapter.mjs";

/**
 * Equipment Training and Qualification from Perks - extra Qualifications on top of the Role's own
 * (G.I. Joe CRB p.72/80: trained gear can be requisitioned; Qualified gear is available without
 * requisitioning).
 *
 * What it does in this system is Requisition (mechanics/resources/requisition.mjs): a Qualified item is taken
 * with no Skill Test and no attempt spent. A weapon carries no weapon-type field, so the Role
 * training booleans can't be matched to one - but the Perks here are phrased by Availability tier
 * ("all Standard weapons"), by trait ("weapons with the Injection trait"), or by a chosen item ("a
 * Limited or Restricted weapon of your choice"), all of which a weapon does carry. requisition.mjs
 * asks these rules through two hooks (see the qualify1 patch spec):
 *
 *   essence20.requisitionAccess (actor, item, out)       out.access: 'qualified'|'trained'|'none'|'unknown'
 *   essence20.requisitionAvailability (actor, item, out) out.availability: the tier the DIF is read from
 *
 * The second is for upgrade Qualification ("Qualified in Microtech Weapon and Microtech Armor
 * upgrades"): an upgrade you're Qualified in is simply fitted, so it no longer raises the combined
 * Availability (Table 8-2) the Requisition Test is rolled against.
 */

const TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];
const tierRank = tier => TIERS.indexOf(tier);

/* -------------------------------------------- */
/*  Rules                                        */
/* -------------------------------------------- */

// "Qualified in all Standard weapons" (Standard Weapon Training, Nu, Pogodi!, The Glory of Cobra-La,
// Ultra-Secret Strike Force) and every upgrade Qualification are Qualification rules on their items
// (item:availability<=standard reads the effective tier, rules/adapter.mjs#requisitionTier).

/**
 * Whether the actor is Qualified in this upgrade (an attached entry or an upgrade Item) - the
 * Qualification rules' `upgrades`.
 * @param {Actor} actor
 * @param {{uuid?: String, name?: String}|Item} upgrade
 */
export function isQualifiedUpgrade(actor, upgrade) {
  return ruleQualifiedUpgrade(actor, upgrade);
}

/** The upgrades attached to a weapon or armor - owned upgrade Items, else the item's own entries. */
function attachedUpgrades(item) {
  const owned = item?.parent?.items?.filter
    ? item.parent.items.filter(other => other.type == 'upgrade' && other.flags?.essence20?.parentId == item.id)
    : [];
  if (owned.length) {
    return owned.map(upgrade => ({ uuid: sourceOf(upgrade) ?? upgrade.uuid, name: upgrade.name, availability: upgrade.system?.availability }));
  }

  return Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'upgrade');
}

function combine(tierA, tierB) {
  if (tierA == 'theoretical' || tierB == 'theoretical') {
    return 'theoretical';
  }

  const normalize = tier => (tier == 'automatic' ? 'standard' : tier);
  const combined = CONFIG.E20?.upgradeAvailabilityMatrix?.[normalize(tierA)]?.[normalize(tierB)];
  if (combined) {
    return combined;
  }

  return tierRank(tierA) >= tierRank(tierB) ? tierA : tierB;
}

function step(tier, steps) {
  const rank = tierRank(tier);
  if (rank < 0 || !steps) {
    return tier;
  }

  return TIERS[Math.max(0, Math.min(TIERS.length - 1, rank + steps))];
}

/**
 * The Availability an item is requisitioned at, once the upgrades this actor is Qualified in are
 * left out of Table 8-2's stacking. Any other adjustment already folded into totalAvailability
 * (Fieldtest's one step) is carried over as the same number of steps.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {String}
 */
export function effectiveAvailability(actor, item) {
  const base = item?.system?.availability ?? 'standard';
  const total = item?.system?.totalAvailability ?? base;
  const upgrades = attachedUpgrades(item);
  const kept = upgrades.filter(upgrade => !isQualifiedUpgrade(actor, upgrade));
  if (kept.length == upgrades.length) {
    return total;
  }

  const all = upgrades.reduce((tier, upgrade) => combine(tier, upgrade.availability ?? 'standard'), base);
  const adjusted = kept.reduce((tier, upgrade) => combine(tier, upgrade.availability ?? 'standard'), base);
  return step(adjusted, tierRank(total) - tierRank(all));
}

// The chosen-item Qualifications (Service, Trade Goods, For The Syndicate, Good To Go, Nu, Pogodi!, Ninpō JOEs...) record
// their picks with item rules (pickGrant / pickEntry record + a Qualification over item:pickedSource), Good To Go's Kit
// prerequisite is a KitPrerequisite rule and Nothing Personal's free Silencer a Use rule (rules/conv10-slE10.test.js).
// (Roaming the Land's "energized close combat weapons" training is a Qualification rule on its item now.)

export function onRequisitionAvailability(actor, item, out) {
  const tier = effectiveAvailability(actor, item);
  if (tierRank(tier) >= 0 && tierRank(tier) < tierRank(out.availability ?? 'standard')) {
    out.availability = tier;
  }
}

// The faction Perks' vehicle Qualifications (Mega Training Regimen, Spared No Expense, Surgical
// Operators, Ultra-Secret Strike Force, The Glory of Cobra-La) and all of Cobra-La's Snags (weapons,
// vehicles and battledress that aren't Biomechanical) are their own item rules now.

/** Wired at load by ./qualification-setup.mjs. (Nu, Pogodi!'s seat swap is a Use rule on the Perk.) */
export function registerQualification() {
  onHook('essence20.requisitionAvailability', onRequisitionAvailability);
}
