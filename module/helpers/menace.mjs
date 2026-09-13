import { E20 } from "./config.mjs";
import { getUsesThisScene, markUsedThisScene } from "./perks.mjs";

/**
 * Menace (Cobra Codex, Bully Origin benefit, p.41): "Once per scene as a Standard action, you can
 * attempt a Skill Test of your Origin skill against the Willpower of a target who can see or hear
 * you. On a success, you deal Stun 1."
 *
 * Same "trigger a real dialog roll via actor._dice.rollSkill()" shape Absolute Menace/Duty Of The
 * Graphite already established - single-target (whichever one token the player has targeted),
 * with the Origin skill resolved dynamically per-actor (system.originSkillsIncrease) the same way
 * It's A Gift's own scopeToOriginSkill reroll config already does. The synthetic damage flows
 * through the same dataset.isMenace -> menaceDamage fallback dice.mjs's Psychoanalyst/Explosive
 * Morph chain already established.
 */

export function canUseMenace(actor) {
  return getUsesThisScene(actor, 'menaceUsesThisScene') < 1;
}

export async function activateMenace(actor) {
  const originSkill = actor.system.originSkillsIncrease;
  if (!originSkill) {
    return;
  }

  await markUsedThisScene(actor, 'menaceUsesThisScene');
  await actor._dice.rollSkill({
    skill: originSkill,
    essence: E20.skillToEssence[originSkill],
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isMenace: true,
  }, actor);
}
