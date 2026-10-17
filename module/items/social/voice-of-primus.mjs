import { clearPendingBonus, getPendingBonus } from "../../mechanics/characters/perks.mjs";

/**
 * Voice of Primus (Enigma of Combination, General Perk, p.41, prerequisite Huge Size or larger):
 * heard clearly up to half a mile; a DIF 12 Persuasion test to Lend Assistance to any ally in
 * earshot; and a Standard action Intimidation or Performance test against Willpower that deals 1
 * Psychic damage or Frightens for 2d2 rounds.
 *
 * "You can be heard clearly up to half a mile away" is pure narrative (no range-of-hearing
 * mechanic to hook) - it's already effectively covered anyway, since activateLendAssistance's own
 * ally list is unlimited-range (see lend-assistance.mjs's own doc comment).
 *
 * Both mechanical clauses share this Perk's one Use button, so there is one initial mode picker
 * (pickVoiceOfPrimusMode) rather than jumping straight to the attack's own skill picker - the same
 * "one Item, one button, so the button asks which clause" reasoning Heroic Intervention's own
 * comment (mechanics/resources/banked-buffs.mjs) already established, just via an explicit choice here instead
 * of a natural "already used" fallthrough, since neither clause has a usage cap to fall through on.
 *
 * ATTACK mode: the skill choice (Intimidation or Performance) is picked BEFORE the roll via a
 * small dialog - the same "don't spend anything on a cast that will be wasted" idiom Bolster
 * Defense/Elemental Storm already establish for their own pre-roll option pickers - then the
 * target is resolved (currently targeted) and a real Skill-Test-vs-Willpower roll is triggered via
 * actor._dice.rollSkill(), the same single-target Defense-vs-Defense shape Martial Leadership
 * just established. On success, a second post-hit picker (damage or Frightened) - Martial
 * Leadership's own picker shape again, just choosing between an immediate effect (damage) and a
 * Condition instead of Snag/Edge.
 *
 * ASSIST mode: a flat DIF 12 Persuasion Skill Test (activateVoiceOfPrimusAssist), the same flat-
 * Difficulty pipeline Consummate Performer's own roll uses. On success, dice.mjs's own post-roll
 * handling banks a pending flag (isVoiceOfPrimusAssistReady) rather than immediately opening the
 * Lend Assistance picker itself - the roll and the assist are two separate actions in RAW ("attempt
 * a... Skill Test to Lend Assistance", read as a prerequisite roll, not the action itself), so the
 * player takes the ordinary Lend Assistance action afterward (already reachable to everyone via
 * mechanics/actions/named-actions.mjs) and canAssistWithSkill's own bypass check picks the flag up from
 * there, consumed the moment it actually lets an otherwise-unqualified assist through.
 */

// Written by the Perk's own Use rule (the Assist mode's DIF 12 Persuasion success - an updateActor on this flag).
const VOICE_OF_PRIMUS_ASSIST_FLAG = 'voiceOfPrimusAssistReady';

/**
 * Whether this actor currently has a live, unspent DIF 12 Persuasion success banked - see
 * mechanics/actions/lend-assistance.mjs's own canAssistWithSkill, the one caller.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasVoiceOfPrimusAssistReady(actor) {
  return !!getPendingBonus(actor, VOICE_OF_PRIMUS_ASSIST_FLAG);
}

/**
 * Consumes the banked roll once it's actually let an assist through - see lend-assistance.mjs's
 * own bankSkillAssist, the one caller.
 * @param {Actor} actor
 */
export async function clearVoiceOfPrimusAssistReady(actor) {
  await clearPendingBonus(actor, VOICE_OF_PRIMUS_ASSIST_FLAG);
}
