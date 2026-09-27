import { bankPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Remote Operations (Factions in Action Vol 1: Ferocious Fighters, Force Recon Infantry option,
 * 10th Role Level, p.45): "when you are undetected by hostiles and in communication with friendly
 * forces, you can provide remote combat control to direct your allies. Attempt a DIF 10 Alertness
 * Skill Test as a Standard action. On a success, for the rest of this turn, you can Lend
 * Assistance as a Free action to any ally you can communicate with (even if you cannot see them)
 * against any target you can see. Each ally may only receive assistance from this ability once
 * per turn."
 *
 * Same overall shape as Voice of Primus's own assist half (helpers/voice-of-primus.mjs) - a flat
 * DIF Skill Test whose success is banked (not acted on immediately) and picked up by
 * lend-assistance.mjs's own canAssistWithSkill as a bypass for the normal skill-ranks
 * prerequisite - except NOT single-use: RAW grants "for the rest of this turn... to any ally"
 * (plural), so unlike Voice of Primus's own bankSkillAssist consumption this flag is never
 * cleared the moment one assist lands. The "undetected by hostiles"/"in communication with"
 * preconditions and the Free-action cost (vs. Lend Assistance's normal Standard action) are
 * unenforceable narrative/action-economy qualifiers this codebase already accepts elsewhere (this
 * system tracks no per-action-type budget to spend a Free action against - see
 * helpers/action-economy.mjs's own doc comment); the "once per ally per turn" cap is left
 * unenforced too, the same documented "until X"/"per turn" simplification bankPendingBonus's own
 * doc comment already applies to every other banked grant in this file's family (Antagonistic,
 * Flying Nuisance, Misled, etc.) - table trust decides it in practice, same as those.
 */
export const REMOTE_OPERATIONS_ID = "Compendium.essence20.ferocious_fighters.Item.HTQEaadz9eZ5ZkC1";
const REMOTE_OPERATIONS_FLAG = 'remoteOperationsReady';

/**
 * The DIF 10 Alertness Skill Test. Success is banked, not acted on immediately - see this file's
 * own doc comment.
 * @param {Actor} actor
 */
export async function activateRemoteOperations(actor) {
  await actor._dice.rollSkill({
    skill: 'alertness', shiftUp: 0, shiftDown: 0, dif: '10', isRemoteOperationsAttempt: true,
  }, actor);
}

/**
 * Called from dice.mjs's own post-roll success handling for a successful attempt.
 * @param {Actor} actor
 */
export async function bankRemoteOperationsReady(actor) {
  await bankPendingBonus(actor, REMOTE_OPERATIONS_FLAG, {});
}

/**
 * Whether this actor currently has a live, unspent DIF 10 Alertness success banked - see
 * helpers/lend-assistance.mjs's own canAssistWithSkill, the one caller.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasRemoteOperationsReady(actor) {
  return !!getPendingBonus(actor, REMOTE_OPERATIONS_FLAG);
}
