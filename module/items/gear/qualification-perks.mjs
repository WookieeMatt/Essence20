import { registerPreRoll, registerSpecializes } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { ruleQualifiedUpgrade } from "../../rules/adapter.mjs";
import { itemsOf } from "../shared/qualification-item-lookups.mjs";

/**
 * Equipment Training and Qualification Perks (qualify2 slice).
 *
 * G.I. Joe CRB p.72/80: "You can requisition any battledress and weapons you are trained in ... You
 * can access any equipment you are Qualified in without requisitioning it." In this system that is
 * Requisition (mechanics/resources/requisition.mjs), which asks two hooks the qualify1 slice added:
 *   essence20.requisitionAccess (actor, item, out)        out.access 'qualified'|'trained'|'none'|'unknown'
 *   essence20.requisitionAvailability (actor, item, out)  out.availability, the tier the DIF is read from
 * The hook bodies here only ever widen access / lower the tier. Each Perk with a "take it" half also
 * gets a Use button that pulls a qualifying item straight from the compendium (flagged qualified,
 * no Requisition Test) - "access ... without requisitioning it".
 */

const TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];
const tierRank = tier => TIERS.indexOf(tier ?? 'standard');

export const TRADE_SCHOOL_FLAG = 'q2TradeSchool';

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
/*  Trade School - the whole scene               */
/* -------------------------------------------- */

// Trade School (Quartermaster's Guide p.22): "an ally of your choice can use your Technology Skill and
// Specialization dice in place of their own for the duration of one scene." Its Use button
// (mechanics/resources/banked-buffs.mjs / trade-school.mjs) banks `pendingTradeSchool` on the ally, which the
// ally's next Technology roll consumes. The first time that roll happens this records the grant for
// the rest of the scene, and every Technology roll that scene rolls the coach's die - and counts as
// Specialized when the coach is Specialized in Technology.
export function tradeSchoolCoach(actor) {
  const record = actor?.getFlag?.('essence20', TRADE_SCHOOL_FLAG);
  if (!record || record.scene !== getSceneEpoch()) {
    return null;
  }

  return worldActors().find(other => other.id == record.granterId) ?? null;
}

export async function tradeSchoolPreRoll(actor, dataset) {
  if (dataset?.skill != 'technology') {
    return;
  }

  const pending = actor.getFlag?.('essence20', 'pendingTradeSchool');
  if (pending?.granterId && actor.getFlag?.('essence20', TRADE_SCHOOL_FLAG)?.scene !== getSceneEpoch()) {
    await actor.setFlag('essence20', TRADE_SCHOOL_FLAG, { granterId: pending.granterId, scene: getSceneEpoch() });
  }

  const coach = tradeSchoolCoach(actor);
  const coachShift = coach?.system?.skills?.technology?.shift;
  const list = CONFIG.E20.skillShiftList ?? [];
  const mine = dataset.shift || actor.system?.skills?.technology?.shift || 'd20';
  if (coachShift && list.indexOf(coachShift) >= 0 && (list.indexOf(mine) < 0 || list.indexOf(coachShift) < list.indexOf(mine))) {
    dataset.shift = coachShift;
  }
}

export function tradeSchoolSpecializes(actor, skill) {
  if (skill != 'technology') {
    return false;
  }

  const tech = tradeSchoolCoach(actor)?.system?.skills?.technology;
  return !!tech && (!!tech.isSpecialized || Object.keys(tech.specializations ?? {}).length > 0);
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

// (Weapon Enthusiast's Use button - the slice's last one - is a Use rule on the Perk: rules/conv12-slI12.test.js.)
export function registerQualifications() {
  // (Training Evolution's Specialization is RollModifier rules on the Perk - rules/conv10-slE10.test.js.)
  registerSpecializes((actor, skill) => tradeSchoolSpecializes(actor, skill));
  registerPreRoll(async (actor, dataset) => {
    await tradeSchoolPreRoll(actor, dataset);
  });
  if (globalThis.Hooks?.on) {
    Hooks.on('essence20.requisitionAccess', onRequisitionAccess);
    Hooks.on('essence20.requisitionAvailability', onRequisitionAvailability);
  }
}

registerQualifications();
