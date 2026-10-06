/**
 * Humanitarian (PR CRB, General Perk, p.96, Social 3+): "You can attempt a DIF 12 Survival Skill
 * Test on any human to heal them of 1 damage." Same "trigger a real flat-DIF roll via
 * actor._dice.rollSkill(), heal on success" shape Healing Bandages already established for a
 * targeted heal - on success, heals whichever token is currently targeted (or the actor
 * themselves with nothing targeted). "On any human" isn't enforced (no "is this a human"
 * classification exists anywhere in this codebase - the same confirmed gap Bot-Hunter's own
 * inverse "is this a robot" check is already blocked on). The Edge-on-Insight-and-Diplomacy-vs-
 * humans clause is a separate, already-built compendium Active Effect (granted unconditionally,
 * same simplification); the Edge-on-acquiring-resources-from-humans clause names no fixed skill
 * to hook an Edge onto and stays unbuilt.
 */
export async function activateHumanitarianRoll(actor) {
  await actor._dice.rollSkill({
    skill: 'survival', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12',
    isHumanitarianAttempt: true,
  }, actor);
}
