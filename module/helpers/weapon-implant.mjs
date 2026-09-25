import { actorHasPerk } from "./perks.mjs";
import { findCompendiumItems, pickCompendiumItem } from "./item-picker.mjs";
import { grantIntegratedWeapon } from "../sheet-handlers/perk-handler.mjs";

/**
 * Weapon Implant (Decepticon Directive, Cyber Engineer Focus, 3rd level, p.52): "once per mission,
 * you can perform 1 hour of cybersurgery on a willing ally to graft a single Standard
 * non-Consumable weapon onto their body, even if weapons have already been installed in their
 * Integrated Hardpoints. This requires a successful DIF 14 Technology (Engineering) Skill Test."
 *
 * Its two later upgrades raise the ceiling by raising the Difficulty instead of adding a separate
 * ability - Major Augments (10th) offers a DIF 18 test for a Limited weapon, Extensive
 * Enhancements (17th) a DIF 20 test for a Restricted one - so the Difficulty the player rolls
 * against IS the choice of tier, and that is how this reads it.
 *
 * RECORDED BLOCKER RE-DERIVED 2026-09-15. The note read "item-grant/equipment-mutation"; neither
 * half was the real obstacle. Granting a weapon by uuid has worked since grantPerkEquipmentMap,
 * and its weaponEffects have come along since that was fixed the same day. What genuinely did not
 * exist was choosing an item from a CATEGORY rather than a fixed list - now helpers/item-picker.mjs.
 * And re-reading the RAW retired one more supposed blocker outright: "even if weapons have already
 * been installed in their Integrated Hardpoints" is PERMISSION to exceed a limit, not a mechanic
 * to implement, and this system enforces no hardpoint cap on grants - so there is nothing to do
 * for that clause rather than something missing.
 *
 * "Once per mission" has no scope in this codebase, so it is approximated as once per scene - the
 * same substitution every other per-day/per-mission resource here already makes.
 */
export const WEAPON_IMPLANT_ID = "Compendium.essence20.decepticon_directive.Item.j9xrYUKHvLkxdd9e";
const MAJOR_AUGMENTS_ID = "Compendium.essence20.decepticon_directive.Item.0XjyYHChhc0VStRn";
const EXTENSIVE_ENHANCEMENTS_ID = "Compendium.essence20.decepticon_directive.Item.UavRPwxwYnLr4BHA";

export const WEAPON_IMPLANT_ENCOUNTER_FLAG = 'weaponImplantUsedThisEncounter';

// Difficulty -> the availability tier it buys, and the Perk that unlocks rolling against it.
const IMPLANT_TIERS = [
  { dif: '14', availability: 'standard', requires: null },
  { dif: '18', availability: 'limited', requires: MAJOR_AUGMENTS_ID },
  { dif: '20', availability: 'restricted', requires: EXTENSIVE_ENHANCEMENTS_ID },
];

/**
 * Which availability tier a given Technology roll is attempting to implant, or null if this roll
 * isn't a Weapon Implant attempt at all.
 *
 * Auto-detected from the roll the way Watchful Eyes and Rallying Cry are, rather than driven from
 * a button: the Difficulty is the player's own declaration of which tier they are attempting, so a
 * button would have to ask them for it again.
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @param {String} dif   The flat Difficulty on the roll's own dataset.
 * @returns {String|null}
 */
export function getWeaponImplantTier(actor, rolledSkill, dif) {
  if (rolledSkill != 'technology' || !actorHasPerk(actor, WEAPON_IMPLANT_ID)) {
    return null;
  }

  const tier = IMPLANT_TIERS.find(t => t.dif == dif);
  if (!tier || (tier.requires && !actorHasPerk(actor, tier.requires))) {
    return null;
  }

  return tier.availability;
}

/**
 * Every weapon this actor could implant at the given tier: the right availability, and without the
 * Consumable trait ("a Standard NON-CONSUMABLE weapon"). Consumable is an ordinary weapon trait
 * here, so it is a predicate on the index rather than anything special.
 * @param {String} availability
 * @returns {Promise<Array<Object>>}
 */
export function findImplantableWeapons(availability) {
  return findCompendiumItems({
    type: 'weapon',
    availabilities: [availability],
    fields: ['system.traits'],
    matches: entry => !(entry.system?.traits ?? []).includes('consumable'),
  });
}

/**
 * Grafts a chosen weapon onto the patient - called from dice.mjs on a successful implant roll.
 *
 * The patient is whoever the surgeon has targeted, falling back to the surgeon themselves, which
 * is what Self-Adjustment (6th level, "you can attempt your Weapon Implant adjustments on
 * yourself") describes. That Perk's own Snag for operating on yourself is NOT applied here: the
 * roll has already happened by this point, so there is nothing left to Snag.
 * @param {Actor} actor   The surgeon.
 * @param {String} availability
 * @returns {Promise<String|null>}   The implanted weapon's uuid, or null.
 */
export async function implantWeapon(actor, availability) {
  const patient = game.user?.targets?.first()?.actor ?? actor;
  const rows = await findImplantableWeapons(availability);
  if (!rows.length) {
    ui.notifications.warn(game.i18n.localize('E20.WeaponImplantNothingAvailable'));
    return null;
  }

  const uuid = await pickCompendiumItem(rows, {
    title: 'E20.WeaponImplantPickTitle',
    label: 'E20.WeaponImplantPickLabel',
  });
  if (!uuid) {
    return null;
  }

  await grantIntegratedWeapon(patient, uuid);
  return uuid;
}
