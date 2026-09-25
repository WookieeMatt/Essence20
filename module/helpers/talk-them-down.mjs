import { getEffectiveLevel } from "./combat.mjs";

/**
 * Talk Them Down (Field Guide to Action & Adventure, Envoy Role Perk, 18th level, p.68): "as a
 * Standard action, you can target a creature who has taken damage equal to at least half their
 * total Health, and whose Threat Level is lower than your level. Attempt a Deception, Intimidation,
 * or Persuasion Skill Test against the target's Willpower or Cleverness. On a success, they're
 * immediately Defeated."
 *
 * Same "trigger a real dialog roll via actor._dice.rollSkill()" shape Soothe/A Logical Explanation
 * establish for a Skill-Test-vs-Defense-then-apply-effect Perk, with the two preconditions (health
 * threshold, Threat Level) checked up front - same "Use" button precondition-gate idiom Breaking
 * Point's own vehicle-only check already uses - rather than silently no-opping deep inside the roll
 * pipeline. RAW offers a choice of 3 skills; this always uses Persuasion, the same default
 * Manipulate/Talk Them Up's own doc comments already establish.
 */
export async function activateTalkThemDown(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TalkThemDownNoTarget'));
    return;
  }

  const health = targetActor.system?.health;
  const hasTakenHalfDamage = !!health && (health.max > 0) && (health.value <= health.max / 2);
  const targetThreatLevel = getEffectiveLevel(targetActor);
  const isLowerThreat = targetThreatLevel < getEffectiveLevel(actor);

  if (!hasTakenHalfDamage || !isLowerThreat) {
    ui.notifications.warn(game.i18n.localize('E20.TalkThemDownNotEligible'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'persuasion',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isTalkThemDownFgtaa: true,
  }, actor);
}
