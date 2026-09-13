import { actorHasPerk, hasUsedThisEncounter, markUsedThisEncounter, bankPendingBonus, getPendingBonus, clearPendingBonus } from "./perks.mjs";

// Technical Mastery (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 20th level,
// p.22): "...This also extends to allies benefiting from your Trade School ability" - see
// consumeTradeSchool's own doc comment below for how the granter's own Technical Mastery is
// checked before the pending grant is cleared. Kept as its own local constant (not imported from
// helpers/tech-specs.mjs) matching this project's own "each file keeps its own compendium ID
// constants rather than sharing them across files" convention.
const TECHNICAL_MASTERY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QKlXoVgNMq7Kv58L";

/**
 * Trade School (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22):
 * "you can coach a teammate in the proper care, handling, and use of sophisticated gear. Once per
 * day, an ally of your choice can use your Technology Skill and Specialization dice in place of
 * their own for the duration of one scene."
 *
 * "Once per day" approximated as once per scene, this project's own standard idiom. "For the
 * duration of one scene" (rather than a single roll) has no scene-boundary hook anywhere in this
 * codebase to expire it against - approximated as "the ally's next Technology Skill Test," the
 * same idiom Ageless Knowledge/Inner Magic/Grid Surge's own timed self-banks already use.
 *
 * "Use your... dice in place of their own" is modeled as a plain isSpecialized grant on the
 * ally's next Technology roll rather than literally copying the granter's own skill die/
 * Specialization data - the same simplification Data Bridge/Adaptable/Student of Divine Manuals
 * already establish for "borrow someone else's Skill capability" language (see
 * helpers/data-bridge.mjs's own doc comment for the fuller reasoning).
 */
const TRADE_SCHOOL_ENCOUNTER_FLAG = 'tradeSchoolUsedThisEncounter';
const PENDING_FLAG = 'pendingTradeSchool';

export function canUseTradeSchool(actor) {
  return !hasUsedThisEncounter(actor, TRADE_SCHOOL_ENCOUNTER_FLAG);
}

/**
 * Banks the borrowed-Technology-die grant on the given ally and marks the scene used.
 * @param {Actor} actor   The Tech Officer using Trade School.
 * @param {Actor} targetActor   The ally being coached.
 */
export async function activateTradeSchool(actor, targetActor) {
  await bankPendingBonus(targetActor, PENDING_FLAG, { granterId: actor.id });
  await markUsedThisEncounter(actor, TRADE_SCHOOL_ENCOUNTER_FLAG);
}

/**
 * Whether the actor currently has a banked Trade School grant, consuming it if so - checked on
 * the actor's own next Technology Skill Test. Also reports whether the ORIGINAL granter (looked
 * up by the id banked alongside the grant, not the actor consuming it) holds Technical Mastery -
 * checked here, before the grant is cleared, since that's the only point this data is still
 * available.
 * @param {Actor} actor
 * @returns {{isSpecialized: Boolean, canCritD2: Boolean}}   Both false if nothing was pending.
 */
export async function consumeTradeSchool(actor) {
  const pending = getPendingBonus(actor, PENDING_FLAG);
  if (!pending) {
    return { isSpecialized: false, canCritD2: false };
  }

  const granter = game.actors?.get(pending.granterId);
  const canCritD2 = !!granter && actorHasPerk(granter, TECHNICAL_MASTERY_ID);

  await clearPendingBonus(actor, PENDING_FLAG);
  return { isSpecialized: true, canCritD2 };
}
