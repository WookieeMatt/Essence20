/**
 * Soothe (General Hawk's Personnel Files, General Perk, p.175): "As a Standard action, you can
 * attempt an Animal Handling Skill Test against an animal target's Willpower. On a success, the
 * target is Mesmerized until the beginning of your next turn."
 *
 * Same "trigger a real dialog roll via actor._dice.rollSkill()" shape A Logical Explanation
 * already established (an identically-worded RAW pattern - "you can attempt a Skill Test against
 * [defense]. On a success, [Condition]") - a single-target Skill-Test-vs-Defense with a post-hit
 * Condition, aimed at whichever one token is currently targeted, resolved generically by
 * rollSkill()'s own existing "vs target Defense" flow. RAW states no cost beyond the Standard
 * action itself, so this is a plain "Use" button with no gate. "An animal target" is unenforced -
 * this system has no dedicated animal actor-type/classification to check against (every actor is
 * playerCharacter/npc/vehicle/zord/megaform) - the same "drop the unverifiable narrative
 * qualifier, keep the mechanic" idiom this project already applies elsewhere (e.g. Bits To Spare/
 * Truthseeker's own dropped qualifiers).
 */
export async function activateSoothe(actor) {
  await actor._dice.rollSkill({
    skill: 'animalHandling',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isSoothe: true,
  }, actor);
}
