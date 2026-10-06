/**
 * Hard Corps (Sgt Slaughter Sourcebook, Marine Origin Benefit, p.8): "Once per combat, you can
 * ignore the effects of one enemy attack until the end of the scene. For example, if a B.A.T.
 * deals 2 damage to Mainframe with a flamethrower attack, Mainframe can continue to fight as
 * though the attack didn't affect him until the end of combat. If he has less than 2 Health left
 * when combat ends, he's immediately Defeated."
 *
 * Two halves:
 * - The "ignore it now" half is the SAME "auto-detect eligibility, GM confirms via a chat-card
 *   dialog" shape Didn't Even Feel It already establishes in chat.mjs#onApplyDamage (which reduces
 *   damage to 0 outright, not just to 1 like Just a Graze) - "once per combat" is exactly
 *   hasUsedThisEncounter's own combat-scoped gate, no approximation needed. The one real
 *   difference: Didn't Even Feel It's negation is total and consequence-free, but Hard Corps
 *   defers a debt - the ignored amount is banked here instead of discarded.
 * - The "pay the debt at end of scene" half needed a genuinely new hook this codebase didn't have
 *   anywhere before: Foundry's own `deleteCombat` (fired when a GM ends/deletes the encounter) -
 *   the same "combat has ended" signal already flagged as missing in earlier categorization
 *   passes this session (Hardened Armor's "for the remainder of the scene," Resilient Armor,
 *   etc., which just never actively clear rather than needing an explicit deadline check). Once
 *   per combat, so at most one banked debt per actor per combat - no need to track more than one.
 */

const FLAG_KEY = 'hardCorpsIgnoredDamage';
const ENCOUNTER_FLAG = 'hardCorpsUsedThisEncounter';

/**
 * Banks the ignored damage amount against the current combat, for the end-of-scene check.
 * @param {Actor} actor
 * @param {Number} amount
 * @returns {Promise<void>}
 */
export async function bankHardCorpsDebt(actor, amount) {
  await actor.setFlag('essence20', FLAG_KEY, { combatId: game.combat?.id ?? null, amount });
}

/**
 * Called from the `deleteCombat` hook - Defeats any combatant who banked a Hard Corps debt this
 * same combat that their current Health can no longer cover.
 * @param {Combat} combat
 * @returns {Promise<void>}
 */
export async function applyHardCorpsDeferredDefeat(combat) {
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    const debt = actor?.getFlag?.('essence20', FLAG_KEY);
    if (!debt || debt.combatId != combat.id) {
      continue;
    }

    if (actor.system.health.value < debt.amount) {
      await actor.toggleStatusEffect('defeated', { active: true });
    }

    await actor.unsetFlag('essence20', FLAG_KEY);
  }
}

export { ENCOUNTER_FLAG as HARD_CORPS_ENCOUNTER_FLAG };
