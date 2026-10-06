import { ruleQualifiedUpgrade } from "../../rules/adapter.mjs";
import { itemsOf } from "../shared/item-lookups.mjs";

/**
 * Equipment Training and Qualification Perks (qualify2 slice).
 *
 * G.I. Joe CRB p.72/80: trained gear can be requisitioned, and Qualified gear is available without
 * requisitioning. In this system that is
 * Requisition (mechanics/resources/requisition.mjs), which asks two hooks the qualify1 slice added:
 *   essence20.requisitionAccess (actor, item, out)        out.access 'qualified'|'trained'|'none'|'unknown'
 *   essence20.requisitionAvailability (actor, item, out)  out.availability, the tier the DIF is read from
 * The hook bodies here only ever widen access / lower the tier. Each Perk with a "take it" half also
 * gets a Use button that pulls a qualifying item straight from the compendium (flagged qualified,
 * no Requisition Test) - "access ... without requisitioning it".
 */

const TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];
const tierRank = tier => TIERS.indexOf(tier ?? 'standard');

// (Hardware Training's Qualification and its Use button are item rules now, and so is all of Weapon Enthusiast: its
// Use, its Qualification - rules/conv12-slI12.test.js - and its Hang-Up. Weapon types: rules/plugins/tags/checks-and-refs.mjs#weaponIsType.)

/* -------------------------------------------- */
/*  Requisition                                  */
/* -------------------------------------------- */

/**
 * What this slice's Perks add to an actor's access to a weapon or armor.
 * @returns {?'qualified'|'trained'}
 */
export function perkAccess(actor, item) {
  if (!actor || !['weapon', 'armor'].includes(item?.type)) {
    return null;
  }

  // A copy already taken through a "you are Qualified in ... of your choice" Use button.
  if (item.flags?.essence20?.qualified) {
    return 'qualified';
  }

  return null;
}

const ACCESS_ORDER = ['none', 'unknown', 'trained', 'qualified'];

export function onRequisitionAccess(actor, item, out) {
  const extra = perkAccess(actor, item);
  if (extra && ACCESS_ORDER.indexOf(extra) > ACCESS_ORDER.indexOf(out.access ?? 'unknown')) {
    out.access = extra;
  }
}

/**
 * Upgrades this actor is Qualified in: any Qualification rule's `upgrades` (Upgrade Training's recorded picks,
 * Oorah!'s Silent battledress upgrade among them).
 */
export function isQualifiedUpgrade(actor, upgrade) {
  return ruleQualifiedUpgrade(actor, upgrade);
}

function attachedUpgrades(item) {
  const owned = item?.parent ? itemsOf(item.parent).filter(other => other.type == 'upgrade' && other.flags?.essence20?.parentId == item.id) : [];
  if (owned.length) {
    return owned;
  }

  return Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'upgrade');
}

function combine(tierA, tierB) {
  if (tierA == 'theoretical' || tierB == 'theoretical') {
    return 'theoretical';
  }

  const plain = tier => (tier == 'automatic' ? 'standard' : tier);
  return CONFIG.E20?.upgradeAvailabilityMatrix?.[plain(tierA)]?.[plain(tierB)]
    ?? (tierRank(tierA) >= tierRank(tierB) ? tierA : tierB);
}

/** The item's Availability once the upgrades this actor is Qualified in are left out of the stacking. */
export function effectiveAvailability(actor, item) {
  const base = item?.system?.availability ?? 'standard';
  const total = item?.system?.totalAvailability ?? base;
  const upgrades = attachedUpgrades(item);
  const kept = upgrades.filter(upgrade => !isQualifiedUpgrade(actor, upgrade));
  if (kept.length == upgrades.length) {
    return total;
  }

  const tierOf = upgrade => upgrade.system?.availability ?? upgrade.availability ?? 'standard';
  const all = upgrades.reduce((tier, upgrade) => combine(tier, tierOf(upgrade)), base);
  const adjusted = kept.reduce((tier, upgrade) => combine(tier, tierOf(upgrade)), base);
  // Any other step already folded into totalAvailability is carried over.
  const steps = tierRank(total) - tierRank(all);
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, tierRank(adjusted) + steps))] ?? adjusted;
}

export function onRequisitionAvailability(actor, item, out) {
  const tier = effectiveAvailability(actor, item);
  if (tierRank(tier) >= 0 && tierRank(tier) < tierRank(out.availability ?? 'standard')) {
    out.availability = tier;
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

// (Weapon Enthusiast's Use button - the slice's last one - is a Use rule on the Perk: rules/conv12-slI12.test.js.)
export function registerQualifications() {
  // (Training Evolution's Specialization is RollModifier rules on the Perk - rules/conv10-slE10.test.js.)
  // (Trade School - the coach's Technology die and Specialization for the scene - is item rules on its Perk:
  // rules/conv17-perm.test.js.)
  if (globalThis.Hooks?.on) {
    Hooks.on('essence20.requisitionAccess', onRequisitionAccess);
    Hooks.on('essence20.requisitionAvailability', onRequisitionAvailability);
  }
}

registerQualifications();
