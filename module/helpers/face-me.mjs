import { bankPendingBonus } from "./perks.mjs";

/**
 * Face Me! (Enigma of Combination, Pillar Origin Benefit, p.27): "As a Move action, you taunt and
 * cajole an opponent to attack you instead of your friends... You then attempt an Intimidate
 * Skill Test against the Willpower Defense of that opponent. On a success, that enemy must attack
 * you on their turn or suffer downshift 2 to attack any other opponent."
 *
 * RE-CATEGORIZED - previously bucketed as a "forced-targeting compulsion" gap (this codebase has
 * no NPC-targeting AI to actually compel an enemy's attack choice), but RAW's own "or suffer
 * downshift 2" clause is a real, concrete mechanical consequence that doesn't need any targeting
 * AI at all - "must attack you or be penalized" IS the mechanic, expressed as a downshift on any
 * attack that ISN'T against the Face Me! holder. This is the exact mirror image of Antagonistic's
 * own "Snag on attacks that target you" clause (helpers/antagonistic.mjs) - banked on the
 * compelled creature, scoped to a specific beneficiary (the Face Me! holder's own id), but the
 * comparison is inverted: Antagonistic penalizes attacking ONE specific person, Face Me! penalizes
 * attacking anyone EXCEPT one specific person. Consumed in dice.mjs#_getAutomaticCombatModifiers's
 * per-target block, same structural shape as Antagonistic's Snag check.
 */
export const FACE_ME_ID = "Compendium.essence20.enigma_of_combination.Item.JQE2rcrT4GSEHJCD";
export const FACE_ME_COMPELLER_FLAG = 'pendingFaceMeCompeller';

/**
 * Banks the compulsion on the successfully-intimidated target.
 * @param {Actor} holder   The Face Me! user who succeeded.
 * @param {Actor} target   Who they targeted.
 */
export async function applyFaceMeEffect(holder, target) {
  await bankPendingBonus(target, FACE_ME_COMPELLER_FLAG, { holderId: holder.id });
}

/**
 * Triggers the Intimidation-vs-Willpower Skill Test itself, aimed at whichever one token the
 * player has targeted - same single-target "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape as Antagonistic/Growl. The Move-action cost is self-policed, the
 * standard accepted action-economy simplification.
 * @param {Actor} actor
 */
export async function activateFaceMe(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.FaceMeNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isFaceMe: true,
  }, actor);
}
