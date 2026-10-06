/**
 * Rouse (GI Joe CRB, Officer base, 1st level, p.85): "As a Standard action during combat, you may
 * attempt a DIF 15 Persuasion Skill Test to add a Story Point to the team's Story Point pool."
 * A proactive, player-triggered flat-DIF Skill Test - same "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape Absolute Menace/Duty Of The Graphite/Exploit Weakness already
 * establish, but with no target at all (dataset.dif alone produces a single synthetic checkEntries
 * row, the same shape Watchful Eyes' own flat DIF 10 Alertness check already uses). On success,
 * grants a Story Point via the same requestStoryPointGrant relay Educated/Heroic Intervention/
 * Curb Your Enthusiasm already use - see isRouseAttempt's own consumption in dice.mjs.
 */
export async function activateRouse(actor) {
  await actor._dice.rollSkill({
    skill: 'persuasion', essence: 'social', dif: '15', isRouseAttempt: true,
  }, actor);
}
