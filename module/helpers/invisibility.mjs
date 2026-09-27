import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Invisibility (Technorganic Secrets, Mutant Beast Influence Perk, p.47): "One of your Alt Modes
 * gains the following ability: Once per scene, you may use a Standard action to become invisible
 * for 1 minute or until you take the Attack, Lend Assistance, or Use a Non-Combat Skill actions."
 *
 * Toggles this system's own real `invisible` status Condition (E20.statusEffects) - a "Use"
 * button, once per scene to activate (the same hasUsedThisEncounter/markUsedThisEncounter idiom
 * this project already uses for every other once-per-scene grant), free to switch back off
 * manually at any time. "1 minute" has no duration hook to expire it automatically (the same
 * accepted "grant, don't auto-revoke" gap every other timed status in this project already lives
 * with), but the "until you take the Attack action" half IS directly trackable - auto-cleared the
 * moment the actor makes any Attack roll (dice.mjs's own isAttack flag), matching RAW's own "the
 * attempt itself ends it" framing rather than requiring a successful hit. "Lend Assistance" is now
 * ALSO directly trackable, since helpers/named-actions.mjs's own Lend Assistance handler exists to
 * hook onto (see deactivateInvisibilityOnLendAssistance below, called from there) - re-verified
 * 2026-09-24, no longer the gap this doc comment used to describe. "Use a Non-Combat Skill" still
 * has no generic action-type detection to hook the same auto-clear onto: named-actions.mjs's own
 * useASkill action is deliberately left with no handler at all (see its own NOT_AUTOMATED entry -
 * rolling the skill itself needs a real UI this system doesn't have), and giving it one JUST to
 * clear this flag would falsely mark that action as automated in the Actions tab. Left as the
 * player's own responsibility to toggle off, same as every other narrative-duration approximation
 * in this project.
 */
const INVISIBILITY_FLAG = 'invisibilityActive';
const INVISIBILITY_ENCOUNTER_FLAG = 'invisibilityUsedThisEncounter';

/**
 * Whether the actor can still activate Invisibility this scene (already-active doesn't need the
 * gate - deactivating is always free).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseInvisibility(actor) {
  return isInvisibilityActive(actor) || !hasUsedThisEncounter(actor, INVISIBILITY_ENCOUNTER_FLAG);
}

/**
 * Whether the actor currently has Invisibility toggled on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isInvisibilityActive(actor) {
  return !!actor.getFlag?.('essence20', INVISIBILITY_FLAG);
}

/**
 * Flips the toggle, applying/clearing the real `invisible` status Condition to match. Marks the
 * scene used only when switching ON. Returns the new state (true = now invisible).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleInvisibility(actor) {
  const nowActive = !isInvisibilityActive(actor);
  if (nowActive && !canUseInvisibility(actor)) {
    return isInvisibilityActive(actor);
  }

  await actor.setFlag('essence20', INVISIBILITY_FLAG, nowActive);
  await actor.toggleStatusEffect('invisible', { active: nowActive });
  if (nowActive) {
    await markUsedThisEncounter(actor, INVISIBILITY_ENCOUNTER_FLAG);
  }

  return nowActive;
}

/**
 * Auto-clears Invisibility the moment the actor makes an Attack - called from dice.mjs's own
 * post-roll processing, regardless of whether the attack hits.
 * @param {Actor} actor
 */
export async function deactivateInvisibilityOnAttack(actor) {
  await clearInvisibility(actor);
}

/**
 * Auto-clears Invisibility the moment the actor takes the Lend Assistance action - called from
 * helpers/named-actions.mjs's own lendAssistance handler, the exact same shape as
 * deactivateInvisibilityOnAttack above (both just call the shared clearInvisibility below), kept
 * as its own named export so each call site reads as "why" rather than "what."
 * @param {Actor} actor
 */
export async function deactivateInvisibilityOnLendAssistance(actor) {
  await clearInvisibility(actor);
}

/**
 * The shared no-op-if-already-off clear both auto-clear triggers above call.
 * @param {Actor} actor
 */
async function clearInvisibility(actor) {
  if (!isInvisibilityActive(actor)) {
    return;
  }

  await actor.setFlag('essence20', INVISIBILITY_FLAG, false);
  await actor.toggleStatusEffect('invisible', { active: false });
}
