/**
 * "I Know A Guy" (PR CRB, Kind Origin benefit, p.26): "Once per day you can communicate with a
 * friendly acquaintance and attempt a DIF 12 Persuasion Skill Test. If you are successful, your
 * acquaintance will gladly help you out with whatever you are lacking in the moment."
 *
 * Unlike every other flat-DIF "trigger a real roll" Perk in this project (Illusory Disguise,
 * Lucky Charm, Humanitarian), the payoff here has no fixed mechanical shape at all - "help you
 * out with whatever you are lacking" is pure GM narration, decided fresh each time it's used.
 * There's nothing to hook a post-roll success handler onto, so this needs no dice.mjs checkContext
 * flag - the roll's own standard chat card already reports success/failure, which is all the GM
 * needs to narrate from. "Once per day" is approximated as "once per encounter," this project's
 * usual idiom for a daily reset with no session-boundary hook to key off instead.
 */
export const I_KNOW_A_GUY_ENCOUNTER_FLAG = 'iKnowAGuyUsedThisEncounter';

export async function activateIKnowAGuyRoll(actor) {
  await actor._dice.rollSkill({
    skill: 'persuasion', essence: 'social', shiftUp: 0, shiftDown: 0, dif: '12',
  }, actor);
}
