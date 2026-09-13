import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Self-Revive (GI Joe CRB, Focus: Medic, 10th level, p.82): "once per combat, when you are
 * Defeated, you may use your turn to regain 1 Health." Approximated as once per encounter, this
 * project's usual idiom for a "once per combat" resource - self-contained (no roll, no Skill
 * Test), so unlike I've Got You/Up And At 'Em/Stim Dart this doesn't depend on this codebase's
 * still-unbuilt generic "recover a Defeated ally via a Medicine Skill Test" mechanic (that base
 * action's own rules live in the Core Rules combat chapter, not yet extracted/verified).
 */
const SELF_REVIVE_ENCOUNTER_FLAG = 'selfReviveUsedThisEncounter';

/**
 * Whether Self-Revive can actually be used right now - the actor must currently be Defeated, and
 * not have already used this ability this combat.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseSelfRevive(actor) {
  return !!actor.statuses?.has('defeated') && !hasUsedThisEncounter(actor, SELF_REVIVE_ENCOUNTER_FLAG);
}

/**
 * Regains 1 Health and clears Defeated, marking this combat's use.
 * @param {Actor} actor
 */
export async function activateSelfRevive(actor) {
  await actor.update({ 'system.health.value': 1 });
  await actor.toggleStatusEffect('defeated', { active: false });
  await markUsedThisEncounter(actor, SELF_REVIVE_ENCOUNTER_FLAG);
}
