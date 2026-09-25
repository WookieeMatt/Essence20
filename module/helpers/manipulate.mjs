/**
 * Manipulate (Field Guide to Action & Adventure, Envoy Role Perk, 1st level, p.65): "As a Standard
 * action, you can attempt a Deception, Intimidation, or Persuasion Skill Test against a target's
 * Willpower or Cleverness. On a success, they are considered grappled, shoved, or tripped, as
 * though you'd used a weapon with a Maneuver effect on them; the grappled effect lasts until the
 * beginning of your next turn. This doesn't count as an attack."
 *
 * Same "trigger a real dialog roll via actor._dice.rollSkill()" shape Soothe/A Logical Explanation
 * already establish for an identically-worded RAW pattern. RAW offers a choice of 3 skills and 3
 * resulting Conditions; this always uses Persuasion (this project's own default when a Perk offers
 * an unenforced choice among equivalent options, see e.g. Show of Hands' own D/I/P-any wording) and
 * always applies Grappled specifically - the one of the three RAW itself gives an explicit duration
 * for, applied via helpers/timed-status.mjs#applyTimedCondition for that "until the beginning of
 * your next turn" (~1 round) window. Shoved/Tripped aren't offered as alternatives this pass.
 */
export async function activateManipulate(actor) {
  await actor._dice.rollSkill({
    skill: 'persuasion',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isManipulateAttempt: true,
  }, actor);
}
