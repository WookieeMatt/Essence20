import { E20 } from "./config.mjs";
import { actorHasPerk, clearPendingBonus, getPendingBonus } from "./perks.mjs";

// Early Adopter (Quartermaster's Guide to Gear, Get in Gear Origin benefit, p.17): "...the DIF
// of any Skill Tests you might make to requisition Prototypical or Theoretical equipment is
// reduced by 5." Only this self-DIF-reduction half is built here - the other clause ("each of
// your allies gains a Standard Weapon Upgrade, Battledress Upgrade, or Kit without spending a
// requisition attempt") needs the Equipment Assignment phase's own allocation UI, which doesn't
// exist as addressable infrastructure yet.
const EARLY_ADOPTER_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.WrRChund2zAcHYfe";

// Expert Guidance - see its own check next to rollRequisition's own comment below.
const EXPERT_GUIDANCE_ID = "Compendium.essence20.intercontinental_adventures.Item.oUQUSWSj3JZ1tBR3";

// Benefits of Command - see its own helpers/banked-buffs.mjs BANKABLE_PERKS entry for the RAW
// text and Story-Point-spend/ally-picker dispatch. This is the one and only place the resulting
// banked Edge actually gets consumed, since a Requisition Skill Test is the only thing it grants
// Edge on.
const PENDING_BENEFITS_OF_COMMAND_FLAG = 'pendingBenefitsOfCommand';

/**
 * The Skill a Requisition Test for this item is rolled with (GI Joe CRB p.137-138): a weapon
 * uses Targeting; Armor uses Athletics when it grants a Toughness bonus, Acrobatics when it
 * only grants an Evasion bonus. (The CRB also allows Might / Finesse respectively - the player
 * can adjust in the roll dialog or roll that Skill by hand instead.)
 * @param {Item} item   A weapon or armor Item.
 * @returns {String}   A CONFIG.E20.skills key.
 */
export function requisitionSkill(item) {
  if (item.type == 'armor') {
    const evasionOnly = (item.system.totalBonusEvasion ?? 0) > 0
      && (item.system.totalBonusToughness ?? 0) <= 0;
    return evasionOnly ? 'acrobatics' : 'athletics';
  }

  return 'targeting';
}

/**
 * How a character may obtain an item, per GI Joe CRB p.72/80/138: you can REQUISITION
 * anything you are Trained in, and you can take anything you're QUALIFIED in without
 * requisitioning it at all - no Skill Test, no attempt spent.
 *
 * Returns "unknown" wherever the item simply does not carry the data to decide, which is
 * most of the time today and is deliberately not guessed at:
 *
 *   - A weapon has NO field corresponding to CONFIG.E20.weaponTypes. Its `classification`
 *     holds only `size`, so nothing on the item says whether it is an assaultRifle, a
 *     silent weapon, a finesse weapon, and so on - the very keys system.trained.weapons is
 *     keyed by. The CRB says training "usually indicates an element of the Classification
 *     or one of its traits", so closing this needs a real weaponType (or a trait mapping)
 *     on the weapon Item plus data entry across the compendia.
 *   - Armor DOES carry `classification`, but CONFIG.E20.armorClassifications is only
 *     non/light/medium/heavy/ultraHeavy - a subset of the eight armorTypes the character
 *     tracks. tactical, computerized, impulse and psycho have no representation on the
 *     armor Item, so an actor Qualified in Tactical armor cannot be matched to one.
 *
 * "unknown" is treated as "roll for it" by callers, which is the safe direction: it asks
 * for a test that might not have been needed, rather than silently handing over equipment
 * the character has no business carrying.
 * @param {Actor} actor   The squad member obtaining the item.
 * @param {Item} item   A weapon or armor Item.
 * @returns {'qualified'|'trained'|'none'|'unknown'}
 */
export function requisitionAccess(actor, item) {
  if (item.type != 'armor') {
    return 'unknown';
  }

  const classification = item.system.classification;
  if (!classification || classification == 'non') {
    return 'unknown';
  }

  if (actor.system.qualified?.armors?.[classification]) {
    return 'qualified';
  }

  if (actor.system.trained?.armors?.[classification]) {
    return 'trained';
  }

  return 'none';
}

/**
 * The combined Availability DIF to Requisition an item as currently upgraded (Table 8-1 via
 * Table 8-2's stacking, already resolved onto system.totalAvailability by the Item document).
 * @param {Item} item   A weapon or armor Item.
 * @returns {Number}
 */
export function requisitionDif(item, actor = null) {
  const availability = item.system.totalAvailability ?? item.system.availability ?? 'standard';
  let dif = E20.availabilityDifficulties[availability] ?? 0;

  if (actor && ['prototype', 'theoretical'].includes(availability) && actorHasPerk(actor, EARLY_ADOPTER_ID)) {
    dif = Math.max(0, dif - 5);
  }

  return dif;
}

/**
 * Runs a Requisition Test for one of a squad member's items (GI Joe CRB p.137-138 / TF CRB
 * p.115-116 / PR CRB p.103). The roll runs as the member through the normal dice pipeline (so
 * the roll dialog, the member's shifts/training, and the pass/fail chat card all apply); the
 * squad's pooled `system.requisition` (on the Party actor) is what's spent and logged. The
 * roll's success/failure is shown on the chat card, not read back here.
 * @param {Actor} member   The squad member making the Requisition (the roller).
 * @param {Item} item   The weapon or armor being Requisitioned (owned by `member`).
 * @param {Actor} pool   The Party actor whose `system.requisition` holds the shared attempt
 *                       budget and log.
 */
export async function rollRequisition(member, item, pool) {
  // Qualified equipment is taken, not requisitioned (GI Joe CRB p.72/80): no Skill Test and
  // nothing spent from the squad pool. Logged all the same, so the squad can see what went out.
  if (requisitionAccess(member, item) == 'qualified') {
    await logRequisition(pool, member, item, { spent: false });
    return { granted: true };
  }

  const skill = requisitionSkill(item);
  const dif = requisitionDif(item, member);

  // Availability automatic/standard is DIF 0, which no Skill Test can fail - so there is nothing
  // to roll, and the request simply succeeds. It also could not be rolled if we tried:
  // dice.mjs gates its flat-Difficulty branch on `else if (dataset.dif)`, and 0 is falsy, so a
  // DIF 0 builds no check entries at all and comes back reporting no successes - i.e. every
  // standard-issue item would read as denied. The attempt is still spent: the squad asked.
  if (dif <= 0) {
    await logRequisition(pool, member, item, { spent: true });
    return { granted: true, automatic: true };
  }

  // Expert Guidance (Factions in Action Vol. 2, General Perk, p.94; prerequisite: Technology +d8):
  // "You gain ↑2 on Skill Tests made to Requisition Theoretical equipment." Read directly off the
  // item's own totalAvailability, the same field Technostalgic's own downshift keys on.
  const expertGuidanceShiftUp = item.system.totalAvailability == 'theoretical'
    && actorHasPerk(member, EXPERT_GUIDANCE_ID) ? 2 : 0;

  // Benefits of Command - see PENDING_BENEFITS_OF_COMMAND_FLAG's own comment above.
  const hasBenefitsOfCommandEdge = !!getPendingBonus(member, PENDING_BENEFITS_OF_COMMAND_FLAG);

  const outcome = await member.rollSkill({
    skill,
    essence: E20.skillToEssence[skill],
    dif,
    shiftUp: expertGuidanceShiftUp,
    shiftDown: 0,
    edge: hasBenefitsOfCommandEdge,
    requisitionItemName: item.name,
  });

  // Backing out of the roll dialog is not a Requisition - nothing is spent and nothing logged,
  // and the banked Edge stays unspent for a future attempt (same "cancelling never consumes a
  // banked bonus" idiom this project applies everywhere else).
  if (outcome?.cancelled) {
    return { cancelled: true };
  }

  if (hasBenefitsOfCommandEdge) {
    await clearPendingBonus(member, PENDING_BENEFITS_OF_COMMAND_FLAG);
  }

  // The attempt is spent either way: "Failure means your request was denied" (GI Joe CRB
  // p.138) - a denial still used up one of the squad's attempts.
  await logRequisition(pool, member, item, { spent: true });
  return { granted: !!outcome?.success };
}

/**
 * The Item types a Requisition can be made for: the two that carry an Availability, which is
 * what the Requisition Test is rolled against.
 */
const REQUISITIONABLE_TYPES = ['weapon', 'armor'];

/**
 * Requisition an item for a squad member by dropping it on them.
 *
 * This is the acquiring end of Equipment Assignment and Requisition (GI Joe CRB p.137-138):
 * the item is not the member's yet. Qualified equipment is simply taken; anything else is
 * rolled for against its Availability DIF, and only lands on the character sheet if the
 * request is granted. A denial still costs the squad the attempt.
 * @param {Actor} member   The squad member the item was dropped on.
 * @param {Item} item   The weapon or armor being requisitioned. Not owned by `member` yet.
 * @param {Actor} pool   The Party actor holding the shared attempt budget.
 * @returns {Promise<Object>}   { granted } on a decision, { cancelled } if the roll dialog was
 *                              dismissed, or { refused } with a reason when it never got that far.
 */
export async function requisitionDrop(member, item, pool) {
  if (!REQUISITIONABLE_TYPES.includes(item?.type)) {
    ui.notifications?.warn(game.i18n.format("E20.RequisitionDropWrongType", { name: item?.name ?? "" }));
    return { refused: 'type' };
  }

  const access = requisitionAccess(member, item);

  // "You can requisition any battledress and weapons you are trained in" - something the
  // character is neither Trained nor Qualified in is not theirs to ask for.
  if (access == 'none') {
    ui.notifications?.warn(game.i18n.format("E20.RequisitionDropUntrained", {
      member: member.name, name: item.name,
    }));
    return { refused: 'untrained' };
  }

  // Only a real Requisition Test costs the squad an attempt, so only that path needs one.
  if (access != 'qualified' && (pool.system.requisition?.attempts ?? 0) <= 0) {
    ui.notifications?.warn(game.i18n.localize("E20.RequisitionDropNoAttempts"));
    return { refused: 'noAttempts' };
  }

  const outcome = await rollRequisition(member, item, pool);
  if (outcome?.cancelled) {
    return { cancelled: true };
  }

  if (!outcome?.granted) {
    ui.notifications?.info(game.i18n.format("E20.RequisitionDropDenied", {
      member: member.name, name: item.name,
    }));
    return { granted: false };
  }

  await member.createEmbeddedDocuments("Item", [item.toObject()]);
  const message = access == 'qualified' ? 'E20.RequisitionDropQualified' : 'E20.RequisitionDropGranted';
  ui.notifications?.info(game.i18n.format(message, { member: member.name, name: item.name }));
  return { granted: true };
}

/**
 * Records one Requisition on the squad pool, and spends an attempt unless the item was taken
 * on a Qualification (which costs nothing).
 * @param {Actor} pool   The Party actor holding the shared budget.
 * @param {Actor} member   The squad member.
 * @param {Item} item   The item requisitioned.
 * @param {Object} options
 * @param {Boolean} options.spent   Whether this consumes one of the pooled attempts.
 */
async function logRequisition(pool, member, item, { spent }) {
  const requisition = pool.system.requisition ?? { attempts: 0, log: [] };
  const entry = {
    memberName: member.name,
    itemName: item.name,
    availability: item.system.totalAvailability ?? item.system.availability ?? 'standard',
    dif: requisitionDif(item),
    time: Date.now(),
  };
  const log = [entry, ...requisition.log.map(e => ({ ...e }))].slice(0, 30);

  await pool.update({
    'system.requisition.attempts': spent
      ? Math.max(0, (requisition.attempts ?? 0) - 1)
      : (requisition.attempts ?? 0),
    'system.requisition.log': log,
  });
}
