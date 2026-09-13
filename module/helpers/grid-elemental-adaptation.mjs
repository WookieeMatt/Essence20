import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { ENERGY_DAMAGE_TYPES } from "./combat.mjs";
import { actorHasPower } from "./powers.mjs";

const GRID_ELEMENTAL_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.5HNnSeIg4JKXiv2F";

/**
 * Elemental Adaptation (Across the Stars, Grid Power, p.72 - distinct from Beneath the Helmet's
 * own identically-named Aqua Ranger Role Perk, which is a different item with a broader "ignore
 * the element trait" effect still blocked on its own infra gap): "Once per scene, after suffering
 * any form of Elemental damage (Cold, Electricity, Fire, and so on), you may spend 1 Personal
 * Power immediately to gain Resistance to that type of Element damage to your Morphed form until
 * the end of the scene."
 *
 * Structurally identical to Hardened Armor's own reactive Resistance-after-hit grant
 * (helpers/combat.mjs#grantHardenedArmorResistance) - the only differences are the Power cost and
 * the once-per-scene cap, and that it only reacts to Energy/Element damage types specifically
 * (ENERGY_DAMAGE_TYPES, the same Element/Energy equivalence set Adapted Wavelength/Elemental
 * Shield/Supreme Guardian already use) rather than any damage type. RAW's "you may spend" implies
 * a real player choice, but this project has no established "react to just-taken damage with a
 * chat-button decision" pattern yet (Spite's own reactive button reacts to a MISS, not a hit) -
 * approximated as automatic whenever affordable, the same "a passive grant is always exercised"
 * idiom Supreme Guardian's own "you may roll a d20" clause already accepts.
 */
const ELEMENTAL_ADAPTATION_ENCOUNTER_FLAG = 'gridElementalAdaptationUsedThisEncounter';

/**
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Number} amount   The amount actually applied (0 means Immune/no-op).
 */
export async function grantGridElementalAdaptationResistance(actor, damageType, amount) {
  if (amount <= 0 || !ENERGY_DAMAGE_TYPES.has(damageType) || actor.system.resistances?.[damageType]) {
    return;
  }

  if (!actorHasPower(actor, GRID_ELEMENTAL_ADAPTATION_ID) || hasUsedThisEncounter(actor, ELEMENTAL_ADAPTATION_ENCOUNTER_FLAG)
    || actor.system.powers.personal.value < 1) {
    return;
  }

  await actor.update({
    [`system.resistances.${damageType}`]: true,
    'system.powers.personal.value': actor.system.powers.personal.value - 1,
  });
  await markUsedThisEncounter(actor, ELEMENTAL_ADAPTATION_ENCOUNTER_FLAG);
}
