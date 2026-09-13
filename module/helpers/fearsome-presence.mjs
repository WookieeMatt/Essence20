/**
 * Fearsome Presence (GI Joe CRB, Renegade base, 14th level, p.97): "while in Reckless Abandon,
 * you may make a special Intimidation Skill Test as part of an attack. Choose up to three
 * characters within 20 feet and roll your Intimidation against their Willpower. If you are
 * successful, they gain the Frightened Condition towards you until the start of your next turn
 * and must move away from you if it is safe to do so."
 *
 * "Choose up to three characters" is the player's OWN choice, not an auto-detected area (unlike
 * Absolute Menace/Elemental Storm's own "every enemy within Xft") - this maps directly onto the
 * existing generic multi-target Skill-Test-vs-Defense mechanic (a plain, non-weaponEffect Skill
 * Test rolled with several tokens targeted already evaluates ONE roll and compares that ONE total
 * against each target's own Defense - see Absolute Menace's own doc comment for the full
 * reasoning), so this needs NO new targeting code at all - just trigger the roll against whatever
 * the player has already targeted (up to three, per RAW, not enforced beyond that - the player
 * self-polices the count same as every other unenforced narrative qualifier in this project).
 * "Within 20 feet" and "must move away if safe" are both dropped, same idiom. "Until the start of
 * your next turn" isn't actively expired - the same "grant, don't auto-revoke" idiom this project
 * already applies to every other Perk-applied Condition.
 */
export async function activateFearsomePresence(actor) {
  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isFearsomePresence: true,
  }, actor);
}
