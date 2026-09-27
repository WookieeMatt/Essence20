import { actorHasHangUp } from "./perks.mjs";

/**
 * No Fighting?! (Knights of Canterlot, Fighter Influence Hang-Up, p.16): "You always suffer a
 * Snag for the first Social-based Skill Test after a fight." Banked at combat's own end via the
 * `deleteCombat` hook - the same "combat has ended" signal helpers/hard-corps.mjs's own
 * applyHardCorpsDeferredDefeat first established for this codebase - rather than a scene-clock
 * window, since RAW's own trigger is "after A fight" specifically, not "for the rest of the
 * scene." "Social-based Skill Test" is read as rolledEssence == 'social', the same essence-scoped
 * idiom deceptive-warfare.mjs/menacing-glare.mjs already use for "a Social Skill" checks.
 */

const NO_FIGHTING_HANGUP_ID = "Compendium.essence20.knights_of_canterlot.Item.ddSnDksWfxPkekda";
export const NO_FIGHTING_FLAG = 'noFightingSnagPending';

/**
 * Called from the `deleteCombat` hook - banks a pending Snag onto every combatant holding No
 * Fighting?!, for their own first Social Skill Test afterward.
 * @param {Combat} combat
 * @returns {Promise<void>}
 */
export async function applyNoFightingSnag(combat) {
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (actor && actorHasHangUp(actor, NO_FIGHTING_HANGUP_ID)) {
      await actor.setFlag('essence20', NO_FIGHTING_FLAG, true);
    }
  }
}

