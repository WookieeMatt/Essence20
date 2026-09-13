/**
 * Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86): "When you take damage, you may
 * attempt a DIF 20 Brawn Skill Test to add a Story Point to the team's Story Point pool." A
 * player-triggered flat-DIF Skill Test, same "trigger a real dialog roll via actor._dice.rollSkill()"
 * shape Rouse's own identical mechanic already establishes (just Brawn/DIF 20 instead of
 * Persuasion/DIF 15) - dispatched as a "Use" button rather than a truly automatic reaction, since
 * "you may attempt" is the player's own choice and "when you take damage" needs no special
 * detection (the player already knows they were just hit). See isRousingComebackAttempt's own
 * consumption in dice.mjs for the Story Point grant on success.
 */
export async function activateRousingComeback(actor) {
  await actor._dice.rollSkill({
    skill: 'brawn', essence: 'strength', dif: '20', isRousingComebackAttempt: true,
  }, actor);
}
