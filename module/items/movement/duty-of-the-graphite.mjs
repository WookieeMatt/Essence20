/**
 * Duty Of The Graphite (Beneath the Helmet, Graphite Ranger, 7th level, p.47 - replaces Duty of
 * the Silver): "You can spend one of your Grid Surges and 2 Personal Power to instantly teleport
 * to the closest concentration of Power Rangers on that dimension or timeline. When you arrive,
 * you may choose one enemy you can see and make a Social Skill Test against their Cleverness. If
 * successful, that enemy gains the Blinded Condition against all of your allies as they focus on
 * battling you head-on."
 *
 * The teleport itself is pure narrative/token movement, same as every other teleport-flavored
 * Perk this project leaves ungeometried (Duty of the Silver's own identical clause, Through the
 * Arches, etc.). The arrival check is a genuine single-target Skill-Test-vs-Defense with a
 * post-hit Condition - same "trigger a real dialog roll via actor._dice.rollSkill()" shape
 * Absolute Menace/Consummate Performer already established, just aimed at whichever ONE enemy the
 * player has targeted rather than an auto-detected radius. RAW names "a Social Skill Test"
 * generically rather than one specific skill - Persuasion is used as the representative choice
 * (the player still gets the full interactive Roll Options Dialog and could mentally treat it as
 * whichever Social skill fits the fiction, the same "player self-polices the exact fictional
 * framing" idiom this project already applies to narrower narrative qualifiers elsewhere).
 */
export async function activateDutyOfTheGraphite(actor) {
  await actor._dice.rollSkill({
    skill: 'persuasion',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'cleverness',
    isDutyOfTheGraphite: true,
  }, actor);
}
