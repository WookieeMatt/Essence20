/**
 * Your Safety's On (Quartermaster's Guide to Gear, General Perk, p.31, prereq Deception +d2): "As
 * a Standard action, make a Deception (Bluff) Skill Test against the target's Cleverness. On a
 * success, the enemy's next attack suffers Snag as they fumble with their weapon following your
 * sly gambit. On a Critical Success, the enemy is so flustered that they suffer Snag on all
 * attacks until the end of your next turn."
 *
 * The roll itself is a genuine single-target Skill-Test-vs-Defense - same "trigger a real dialog
 * roll via actor._dice.rollSkill()" shape Duty Of The Graphite/Absolute Menace already establish,
 * aimed at whichever one enemy the player has targeted. Unlike those two, this Perk names a real
 * skill (Deception) rather than a generic "a Social Skill Test," so no representative-skill
 * judgment call is needed here.
 */
export async function activateYourSafetysOn(actor) {
  await actor._dice.rollSkill({
    skill: 'deception',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'cleverness',
    isYourSafetysOn: true,
  }, actor);
}
