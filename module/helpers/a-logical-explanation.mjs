/**
 * A Logical Explanation (WTNV Citizen's Guide, Scientist Role, University Of What It Is Focus,
 * p.46): "You can attempt a Science Skill Test against your enemy's Willpower Defense. On a
 * success, they become Stunned and can no longer attack you or your allies until the end of
 * their next turn. On a Critical Success, they leave and are no longer an active threat to you or
 * your party."
 *
 * A single-target Skill-Test-vs-Defense with a post-hit Condition - same "trigger a real dialog
 * roll via actor._dice.rollSkill()" shape Duty Of The Graphite already established, aimed at
 * whichever one enemy is currently targeted (resolved generically by rollSkill()'s own existing
 * "vs target Defense" flow, no bespoke targeting needed here). RAW states no cost or frequency
 * limit, so this is a plain "Use" button with no gate beyond taking the action itself.
 */
export async function activateALogicalExplanation(actor) {
  await actor._dice.rollSkill({
    skill: 'science',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isALogicalExplanation: true,
  }, actor);
}
