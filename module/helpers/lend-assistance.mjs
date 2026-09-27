import { E20 } from "./config.mjs";
import { actorHasHangUp, actorHasPerk, bankPendingBonus, getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { getSkillRanks } from "./combat.mjs";
import { requestStoryPointGrant } from "./story-points.mjs";
import { clearVoiceOfPrimusAssistReady, hasVoiceOfPrimusAssistReady } from "./voice-of-primus.mjs";
import { hasRemoteOperationsReady } from "./remote-operations.mjs";
import { PSYCHOLOGICAL_SWAY_ID } from "./psychological-sway.mjs";
import { isBlockedByFunExhaustion } from "./fun-exhaustion.mjs";

/**
 * The Lend Assistance action (GI Joe CRB p.197).
 *
 * > "A character may take the Lend Assistance Standard action to help another character in a
 * > specific Skill Test, including hitting an enemy target in combat. In a Combat scene, you can
 * > Lend Assistance to an ally for a specific target within 50 ft. Until the beginning of your next
 * > turn, the first attack against the specific target gains an Edge. Alternatively, if a character
 * > has at least as many levels in a given skill as their ally, they may Lend Assistance to that
 * > ally to give them an automatic up-1 shift to their use of that given skill."
 *
 * Two different grants, so two flags rather than one with a mode field - an ally could plausibly be
 * assisted both ways in a round, and a single flag would have the second quietly overwrite the
 * first. Both are banked on the ALLY and consumed by their own roll, the shape
 * helpers/shoulder-to-shoulder.mjs already established.
 *
 * What is enforced, and what is not:
 *
 * - The **50 ft** is measured from the assisting character to the target, and refused past it.
 *   "an ally for a specific target within 50 ft" could also be read as the ALLY being the thing
 *   within 50 ft; the target reading is taken because the target is what the sentence goes on to
 *   talk about, and because the ally is the one person in the exchange the assister is already
 *   choosing deliberately. The ally list is not distance-filtered as a result.
 * - The **skill-levels prerequisite** is enforced: getSkillRanks counts shifts above untrained plus
 *   a Specialization, and the assister needs at least as many as the ally. This is the one clause
 *   in the action with a hard numeric test, so leaving it to the table would be a waste of it.
 * - **"Until the beginning of your next turn"** is not enforced, matching every other banked bonus
 *   in this system - see perks.mjs#bankPendingBonus, which stamps a combat id so a bonus never
 *   survives into a new encounter but deliberately does not expire on a turn boundary. The Edge is
 *   consumed by the first attack against that target either way, which is the clause that decides
 *   it in practice.
 *
 * Perks that change the action hang off three helpers below, so the dialog flow itself never
 * needs to know about them: canAssistWithSkill (who may help whom - Many Minds and Ship's Crew
 * lift the levels gate, Conniving and Greenshirt refuse it), getAssistShiftUp (how big the
 * shift is) and getAssistEdge (whether the skill half also grants an Edge). The shift flag
 * carries both, and dice.mjs applies them when the ally rolls.
 */

/** The Edge on the first attack against one specific target. */
export const LEND_ASSISTANCE_EDGE_FLAG = 'pendingLendAssistanceEdge';

/** The up-1 shift on one specific skill. */
export const LEND_ASSISTANCE_SHIFT_FLAG = 'pendingLendAssistanceShift';

/** "a specific target within 50 ft" (GI Joe CRB p.197). */
export const LEND_ASSISTANCE_RANGE_FEET = 50;

// Team Player (Transformers CRB, Influence Perk, p.35): "If you spend a Standard action to Lend
// Assistance in a dangerous situation, the action generates one Story Point, if successful."
// Previously blocked outright on this whole gap - now just a post-assist hook on either half,
// since both report back whether an assist actually landed. "In a dangerous situation" is an
// unenforceable narrative qualifier, dropped the same way as Bits To Spare/Truthseeker's own.
// Only PR CRB's identically-named Perk is now excluded here, and only because its RAW has not been
// read (no cached extraction of that chapter exists). GI Joe's and WTNV's were both on this
// exclusion list until 2026-09-15, when reading their actual text showed both to be the same
// grant - a caution worth keeping for same-name Perks generally, but not a substitute for looking.
export const TEAM_PLAYER_TF_ID = "Compendium.essence20.tf_crb.Item.oWjvage64Y4KrWjw";

// I Got You (Enigma of Combination, Team Leader Focus, 3rd level, p.30): "Starting at 3rd level,
// you can always Lend Assistance to your teammates if they are within 60 feet of you." Grants
// access to the action itself, same "this button is the only way to take it at all" reasoning
// LEND_ASSISTANCE_PERK_IDS' own doc comment already gives for Bureaucrat/Teacher. The 60ft is
// approximated as this file's own existing 50ft LEND_ASSISTANCE_RANGE_FEET (used for the
// attack-assist target range check) rather than threading a second, per-Perk radius through
// activateLendAssistance's whole dialog flow - a minor undercount, not a missed clause. The
// separate once/round "spend 1 Energon Point for ↑1" clause is already built elsewhere
// (helpers/banked-buffs.mjs's own BANKABLE_PERKS entry).
export const I_GOT_YOU_ID = "Compendium.essence20.enigma_of_combination.Item.h8DuSX4N1buJb6uN";

/**
 * I Got You holds two independent grants behind one "Use" button - the unconditional Lend
 * Assistance access above, and the pre-existing once/round "spend 1 Energon Point for ↑1" bankable
 * entry (helpers/banked-buffs.mjs's own BANKABLE_PERKS[I_GOT_YOU_ID]) - so a click asks which one is
 * meant, rather than one silently shadowing the other.
 * @returns {Promise<'assist'|'energon'|null>}
 */
export async function pickIGotYouAction() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.IGotYouPickTitle') },
    classes: ["window-app"],
    modal: true,
    content: `<p>${game.i18n.localize('E20.IGotYouPickPrompt')}</p>`,
    buttons: [
      { label: game.i18n.localize('E20.IGotYouPickAssist'), action: 'assist' },
      { label: game.i18n.localize('E20.IGotYouPickEnergon'), action: 'energon' },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen == 'assist' || chosen == 'energon' ? chosen : null;
}

// Team Player (GI Joe CRB, General Perk, p.134): "When you spend a Standard action to Lend
// Assistance in a combat, the action generates one Story Point if successful." Mechanically the
// SAME grant as the Transformers Perk above, not a same-name-different-Perk case - the one real
// difference is that where TF says "in a dangerous situation" (unenforceable, dropped), this one
// says "in a combat", which is a plain game.combat test and so is actually enforced.
const TEAM_PLAYER_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.itmsNR7wtqJQp0rr";

// Team Player (WTNV Citizens' Guide, General Perk, p.47): "When you spend a Standard action to
// Lend Assistance and the Skill Test is successful, add 1 Story Point to the player pool." The
// same grant again, and the plainest printing of the three - no situational qualifier at all, so
// unlike GI Joe's it needs no combat gate.
const TEAM_PLAYER_WTNV_ID = "Compendium.essence20.wtnv_citizens_guide.Item.57KqLyhUgAHpCskm";

// Lesson Plan (WTNV Citizens' Guide, Teacher Origin Perk, p.30): "When you Lend Assistance to an
// ally for a non-combat Skill Test, they gain both ↑1 and an Edge." Word for word Teacher (PR CRB
// p.76) above, down to the non-combat qualifier, so it rides the same branch rather than its own.
const LESSON_PLAN_ID = "Compendium.essence20.wtnv_citizens_guide.Item.MRJ2g8hLTsD3XmiC";

// Greenshirt (GI Joe CRB, Influence Perk, p.49): "When you lend assistance, your ally gains both
// an Edge and ↑1 on their Skill Test." Word for word the same upgrade as Bureaucrat above, and
// unconditional like it - the ↑1 is already the base amount getAssistShiftUp returns, so what
// this adds is the Edge.
const GREENSHIRT_PERK_ID = "Compendium.essence20.gi_joe_crb.Item.XVu6skoSL0A3Hnve";

// Greenshirt's own paired Hang-Up (p.49): "Other Joes can't Lend you Assistance on Skill Tests
// unless they also have the Greenshirt Influence." A recipient-side refusal like Conniving's, and
// keyed on the HANG-UP Item for the same reason - the penalty belongs to the Hang-Up, never to the
// Influence Perk. Unlike Conniving's absolute refusal, this one has an escape hatch written into
// RAW: a fellow Greenshirt can still help.
const GREENSHIRT_HANGUP_ID = "Compendium.essence20.gi_joe_crb.Item.Exn9xZtJ9qoCNnZ8";

// Bureaucrat (Transformers CRB, Influence Perk, p.32): "When using the Lend Assistance action,
// you can grant the recipient both an Edge and a ↑1 to their Skill Test." An upgrade to the SKILL
// half specifically - "the recipient"/"their Skill Test" is the assisted ally, whereas the combat
// half's own Edge goes to whoever attacks the marked target and carries no ↑1 to upgrade. Banked
// alongside the ordinary shiftUp as a second field on the same flag, so consumption stays one
// read rather than two competing ones.
const BUREAUCRAT_TF_ID = "Compendium.essence20.tf_crb.Item.7XR1us1Zm4dKDrwW";

// Teacher (PR CRB, Influence Perk, p.76): "When you Lend Assistance to an ally for a non-combat
// Skill Test, they gain both ↑1 and Edge." Mechanically the same upgrade as Bureaucrat just
// above - the ↑1 is already the base amount getAssistShiftUp returns, so what this actually adds
// is the Edge - but with a real, checkable "non-combat" gate rather than Bureaucrat's unconditional
// grant. That gate is a plain !game.combat test: unusually for this project, the qualifier here is
// mechanical rather than narrative, so it is enforced instead of dropped.
//
// RE-CATEGORIZED 2026-09-15: this Perk's own infra note said only "general Lend Assistance action
// doesn't exist", which stopped being true when that action was built earlier the same session.
const TEACHER_ID = "Compendium.essence20.pr_crb.Item.kqkyJy7sEjBmmOp3";

// Putting Others Before Yourself (MLP CRB, Spirit of Generosity, 5th level, p.74): "when you Lend
// Assistance to a friend, they gain ↑2 instead of ↑1." The same shape as Bureaucrat above - a
// passive upgrade to the skill half, applied at bank time - just to the AMOUNT rather than adding
// an Edge, so the two stack naturally for anyone holding both.
const PUTTING_OTHERS_BEFORE_YOURSELF_ID = "Compendium.essence20.mlp_crb.Item.ZZTzjEEMljWoVJu6";

// Better Together (A Jump Through Time, ORANGE Ranger Role Perk, 5th level, p.33 - the ledger
// previously filed this under Purple Ranger, corrected 2026-09-15 against the real RAW): "when you
// choose to Lend Assistance to an ally who has a lower base Skill Ranks than you do in the
// applicable Skill, your action gives them ↑2 instead of the normal ↑1. This increased bonus
// becomes ↑3 at 13th Level." Note the gate is STRICTLY lower, narrower than the base action's own
// "at least as many levels" (which allows equal ranks) - an equal-rank assist still works, it just
// doesn't get the upgrade. Not to be confused with Through the Shattered Grid's own same-named
// Influence Perk, a completely different bonded-ally mechanic.
const BETTER_TOGETHER_JTT_ID = "Compendium.essence20.jump_through_time.Item.8ZGmg1hrNDmbO1B7";

// Many Minds Make Light Work (Dark Skies Over Equestria, Influence Perk, p.17): "As long as you're
// trained in Persuasion, you can Lend Assistance to your allies on any Skill Test you have at
// least one Skill Rank in from 50 feet away." The 50ft is already the base action's own radius, so
// the real mechanical content is the BYPASS: it lifts RAW's own "at least as many levels as their
// ally" gate entirely, letting a less-skilled character still assist, as long as they're trained
// in Persuasion and have at least one rank in the skill being assisted.
const MANY_MINDS_MAKE_LIGHT_WORK_ID = "Compendium.essence20.dark_skies_over_equestria.Item.D24JO5W03Amwwvzy";

// Ship's Crew (Across the Stars, Influence Perk, p.48): "...while on the vessel, you can offer aid
// to your crewmates and Lend Assistance even if you are unskilled in the Skill in question." The
// second Perk in this codebase to lift canAssistWithSkill's own rank gate, and a stronger lift
// than Many Minds Make Light Work's: that one still requires real training in both Persuasion and
// the assisted Skill, whereas this explicitly covers being UNSKILLED. RAW scopes it to being
// aboard the vessel; "a familiar ship" is not enforceable, so this checks only that the assister
// is actually aboard some vehicle right now, via the same _getPilotedVehicle-style crew lookup
// Peerless Pilot/Roadside Assistant already rely on - read inline here rather than through
// dice.mjs's own private method, which this file can't reach (the same reason Baby Hold Together
// reads a vehicle's crew map directly in combat.mjs).
const SHIPS_CREW_ID = "Compendium.essence20.across_the_stars.Item.HPEU2YVjQM6pEZ3i";

// Walk Them Through It (Transformers CRB, Scientist Role, 2nd level, p.79): "You help others help
// you. Allies without ranks in Technology or Science can Lend Assistance to you on Technology and
// Science Skill Tests." Held by the ALLY being helped (like Many Minds/Ship's Crew above, this
// lifts canAssistWithSkill's own rank gate), but unlike either of those it's scoped to the two
// named skills rather than being general, and the escape hatch belongs to the recipient's own Perk
// rather than the assister's.
const WALK_THEM_THROUGH_IT_ID = "Compendium.essence20.tf_crb.Item.7eWiN6w2TIBeSMoi";

// Conniving's own Hang-Up (Cobra Codex, p.28): "Suspicious that others are trying to manipulate
// you, you can't benefit from an ally who Lends Assistance." The first RECIPIENT-side gate on this
// action - every other check here is about the assister's own fitness to help (the rank gate, Many
// Minds, Ship's Crew). Keyed on the HANG-UP Item rather than Conniving's own Influence Perk, per
// the direction invariant this project just established: a penalty belongs to the Hang-Up, and
// Conniving's Influence offers a choice of Hang-Ups, so a holder who picked a different one must
// NOT be silently saddled with this. Its paired Perk ("once per scene, an ally who Lends Assistance
// may roll the Skill Test FOR you, and suffers the consequences of failing") is a role-reversal of
// the whole action and is not built - see the ledger.
const CONNIVING_HANGUP_ID = "Compendium.essence20.cobra_codex.Item.w8yTnTpOIUdFVm8u";

// Acrobatic Outlook's own Hang-Up (MLP CRB, Nimble Influence, p.55): "You don't see as many
// obstacles in your path as others... You cannot Lend Assistance on Speed based Skill Tests." An
// ASSISTER-side refusal scoped to one essence's skills (E20.skillsByEssence.speed), unlike
// Treacherous's own total refusal.
const ACROBATIC_OUTLOOK_HANGUP_ID = "Compendium.essence20.mlp_crb.Item.rLku8lFIvdPxDC2D";

// Show Off's own Hang-Up (WTNV Citizens' Guide, p.31): "You gain no benefits when an ally uses
// Lend Assistance on you." Word for word Skeptical's own clause, just a third RECIPIENT-side
// refusal to join Conniving/Skeptical below.
const SHOW_OFF_HANGUP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.R7DMglLJxy9d9und";

// Skeptical's own Hang-Up (Transformers CRB, p.43): "You are an objective observer, and concepts
// such as hope and inspiration don't impact you. You gain no benefits when an ally uses Lend
// Assistance on you." A second, unconditional RECIPIENT-side refusal, the same shape as
// Conniving's above - no escape hatch at all, unlike Greenshirt's own Hang-Up.
const SKEPTICAL_HANGUP_ID = "Compendium.essence20.tf_crb.Item.yoyifVDjpnLloHbK";

// Treacherous's own Hang-Up (Transformers CRB, p.43): "You are untrustworthy, unreliable, and
// everyone knows it. You can never use the Lend Assistance action, not because you don't want
// to, but because no one accepts your help." The first ASSISTER-side refusal in this file -
// every other gate here is about whether the ALLY benefits, not whether the actor can even take
// the action at all.
const TREACHEROUS_HANGUP_ID = "Compendium.essence20.tf_crb.Item.KwvsyHeuUqRbto9u";

/**
 * Whether the actor is currently aboard any vehicle as crew - see SHIPS_CREW_ID's own comment.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function isAboardVehicle(actor) {
  // Requiring a real uuid up front matters: a crew entry with no uuid would otherwise match an
  // actor with no uuid via undefined == undefined, the same false positive that has bitten Eye for
  // Appraisal, Menacing Glare and One-Upping in this project already.
  if (!actor?.uuid) {
    return false;
  }

  return !!game.actors?.find(
    candidate => candidate.type == 'vehicle'
      && Object.values(candidate.system?.actors ?? {}).some(crew => crew.uuid == actor.uuid),
  );
}

// Those Who Know, Teach (MLP CRB, Mentor Influence, p.53): "Three times per day, when you Lend
// Assistance, the creature you assist gains the benefits of your help for the rest of the
// scene/encounter instead of 1 Skill Test." A duration upgrade to the SKILL half (the combat
// half's own Edge is already "until the beginning of your next turn," not "1 Skill Test", so RAW's
// "instead of 1 Skill Test" only makes sense read against the skill half) - banked as a
// `persistent` flag on the same pendingLendAssistanceShift grant rather than a separate one, so
// consuming it stays a single read (same idiom Bureaucrat's own Edge piggybacks on that flag with).
// dice.mjs skips clearing the flag on consumption when persistent is set, so it keeps matching
// every one of the ally's own rolls of that skill until the bank naturally expires at encounter's
// end (bankPendingBonus's own combatId stamp). "Three times per day" approximated as three times
// per scene, this project's own standard idiom.
const THOSE_WHO_KNOW_TEACH_ID = "Compendium.essence20.mlp_crb.Item.Xi0qQqfZQJh0MBTu";
const THOSE_WHO_KNOW_TEACH_SCENE_FLAG = 'thoseWhoKnowTeachUsedThisScene';

// Lackey (Decepticon Directive, Influence Perk, p.27): "You are completely accustomed to following
// orders, allowing any character you perceive as able to give you commands to Lend Assistance to
// you from any distance, as long as you can receive their believable verbal command to perform the
// task." Unlike every other Perk in this file, this one is held by the RECIPIENT, not the
// assister - it lifts the action's own 50ft radius for assists aimed at the holder. Both of RAW's
// qualifiers ("you perceive as able to give you commands", "believable verbal command") are
// unenforceable narrative framing, dropped the same way as Bits To Spare/Truthseeker's own.
const LACKEY_ID = "Compendium.essence20.decepticon_directive.Item.dXZpwsbvn6Jdgpsn";

// One Pony Show (MLP CRB, Spirit of Laughter, 13th level, p.87): "you can Lend Assistance to
// yourself as a Move action." getNearbyAllyTokens excludes the actor's own token by design (see
// its own doc comment) - this Perk is the one deliberate exception, added back into the ally list
// at activation time rather than widened generically. The Move-action cost (instead of Standard)
// is left unenforced, the same "action-cost changes aren't modeled" gap every other Perk that
// changes THIS action's own cost has (Partnered's Free action, To The Rescue's Free action) -
// this codebase's action costs come from a fixed per-named-action lookup, not a per-Perk one.
const ONE_PONY_SHOW_ID = "Compendium.essence20.mlp_crb.Item.8Idk7YjylEf8c43U";

// Armchair General (Field Guide to Action and Adventure, Envoy Origin benefit, p.65) - see
// getAssistShiftUp's own comment below. The Perk's other clause ("qualified in a weapon type of
// your choice") is unrelated to Lend Assistance and lives with pack data instead.
const ARMCHAIR_GENERAL_ID = "Compendium.essence20.field_guide_action_adventure.Item.YPzpjKFz1yrwPHN6";

// Technological Assistance (Quartermaster's Guide to Gear, Tech Officer Focus, 17th level, p.22):
// "you can Lend Assistance as a Free action. However, allies can only take advantage of this for
// Driving, Targeting, or Technology Skill Tests." The Free-action cost change is the same
// unenforced "action-cost changes aren't modeled" gap Team Player/Partnered/To The Rescue's own
// identical Free-action grants already accept - this file has no per-Perk action-cost lookup to
// change. The skill restriction IS buildable though: rather than the normal "at least as many
// ranks as your ally" gate, this holder can assist with Driving/Targeting/Technology regardless of
// rank - the same assister-side rank-bypass shape Walk Them Through It already establishes from
// the ALLY's side.
const TECHNOLOGICAL_ASSISTANCE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7b01zSdekhUugIod";
const TECHNOLOGICAL_ASSISTANCE_SKILLS = ['driving', 'targeting', 'technology'];

/**
 * Whether an actor has any real rank in a skill - i.e. its shift is an actually-trained die rather
 * than the untrained d20 default. E20.skillRollableShifts is exactly that trainable set.
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
function isTrainedIn(actor, skill) {
  return E20.skillRollableShifts.includes(actor?.system?.skills?.[skill]?.shift);
}

// Perks whose own sheet "Use" button takes the Lend Assistance action. This is a stand-in for the
// Combat Actions menu this codebase doesn't have (see activateLendAssistance's own comment) - the
// action is available to everyone in RAW, but only these holders can currently reach it. Team
// Player keys off a successful assist; Bureaucrat only upgrades one, but its holder still needs
// some way to actually take the action for that upgrade to ever matter.
export const LEND_ASSISTANCE_PERK_IDS = [
  TEAM_PLAYER_TF_ID, TEAM_PLAYER_GIJ_ID, TEAM_PLAYER_WTNV_ID, GREENSHIRT_PERK_ID, BUREAUCRAT_TF_ID,
  // Teacher and its WTNV reprint modify the assist rather than granting the action, exactly as
  // Bureaucrat does - and like Bureaucrat they belong here, because this button is the only way to
  // take the action at all (see activateLendAssistance). Teacher was missing when it was built
  // earlier this same day, which left its holder unable to reach the very action it upgrades.
  TEACHER_ID, LESSON_PLAN_ID, PUTTING_OTHERS_BEFORE_YOURSELF_ID,
  BETTER_TOGETHER_JTT_ID, MANY_MINDS_MAKE_LIGHT_WORK_ID,
  // Lackey is held by the RECIPIENT, not the assister - its holder gets the button too, since
  // nothing stops a Lackey from also assisting someone else.
  LACKEY_ID,
  // Remote Operations is deliberately NOT included here, unlike every other entry above - its own
  // "Use" button takes the DIF 10 Alertness Test (see helpers/remote-operations.mjs), a SEPARATE
  // action from Lend Assistance itself per RAW ("attempt a... Skill Test to Lend Assistance", the
  // same prerequisite-roll reading Voice of Primus's own assist half uses) - Lend Assistance is
  // already reachable to everyone via helpers/named-actions.mjs once the bypass above is banked.
  // Technological Assistance - see its own comment above.
  TECHNOLOGICAL_ASSISTANCE_ID,
  // Those Who Know, Teach only upgrades the skill half's duration (see its own comment above),
  // same "needs the button to matter" reasoning as Bureaucrat/Teacher.
  THOSE_WHO_KNOW_TEACH_ID,
  // I Got You is deliberately NOT included here, unlike every other entry above - its "Use" button
  // already does something else too (the pre-existing once/round Energon-for-↑1 bankable grant),
  // so helpers/banked-buffs.mjs#onPerkUse handles it with its own dedicated pickIGotYouAction()
  // dispatch instead of this shared list, to avoid the Lend Assistance branch silently shadowing
  // the bankable one on every click.
];

/**
 * Whether the assisting actor may help this ally with this skill.
 *
 * The base rule is RAW's "at least as many levels in a given skill as their ally", counted by
 * getSkillRanks (shifts above untrained plus a Specialization). Two Perks lift that gate - Many
 * Minds Make Light Work and Ship's Crew - and two Hang-Ups on the ALLY refuse it outright -
 * Conniving, and Greenshirt unless the assister is a Greenshirt too. See each id's own comment.
 * @param {Actor} actor   The one lending assistance.
 * @param {Actor} ally    The one being helped.
 * @param {String} skill
 * @returns {Boolean}
 */
export function canAssistWithSkill(actor, ally, skill) {
  if (actorHasHangUp(ally, CONNIVING_HANGUP_ID) || actorHasHangUp(ally, SKEPTICAL_HANGUP_ID)
    || actorHasHangUp(ally, SHOW_OFF_HANGUP_ID)) {
    return false;
  }

  if (actorHasHangUp(ally, GREENSHIRT_HANGUP_ID) && !actorHasPerk(actor, GREENSHIRT_PERK_ID)) {
    return false;
  }

  if (E20.skillsByEssence.speed.includes(skill) && actorHasHangUp(actor, ACROBATIC_OUTLOOK_HANGUP_ID)) {
    return false;
  }

  if (getSkillRanks(actor, skill) >= getSkillRanks(ally, skill)) {
    return true;
  }

  if (['technology', 'science'].includes(skill) && actorHasPerk(ally, WALK_THEM_THROUGH_IT_ID)) {
    return true;
  }

  // Technological Assistance - see its own comment above.
  if (TECHNOLOGICAL_ASSISTANCE_SKILLS.includes(skill) && actorHasPerk(actor, TECHNOLOGICAL_ASSISTANCE_ID)) {
    return true;
  }

  // Voice of Primus (Enigma of Combination, General Perk, p.41) - see its own doc comment. A
  // successful DIF 12 Persuasion Skill Test (banked by helpers/voice-of-primus.mjs) stands in for
  // the rank comparison, exactly like the two Perk bypasses just below.
  if (hasVoiceOfPrimusAssistReady(actor)) {
    return true;
  }

  // Remote Operations - see hasRemoteOperationsReady's own comment above. Same bypass shape as
  // Voice of Primus just above, but NOT consumed here - see remote-operations.mjs's own doc
  // comment for why (RAW grants repeated assists "for the rest of this turn", not a single one).
  if (hasRemoteOperationsReady(actor)) {
    return true;
  }

  if (actorHasPerk(actor, MANY_MINDS_MAKE_LIGHT_WORK_ID)
    && isTrainedIn(actor, 'persuasion') && isTrainedIn(actor, skill)) {
    return true;
  }

  return actorHasPerk(actor, SHIPS_CREW_ID) && isAboardVehicle(actor);
}

/**
 * How big an upshift the skill half grants - normally 1, raised by Putting Others Before Yourself
 * (2) and Better Together (2, or 3 from 13th level, only against an ally with strictly fewer
 * ranks).
 * @param {Actor} actor
 * @param {Actor} ally
 * @param {String} skill
 * @returns {Number}
 */
export function getAssistShiftUp(actor, ally, skill) {
  let shiftUp = 1;

  if (actorHasPerk(actor, PUTTING_OTHERS_BEFORE_YOURSELF_ID)) {
    shiftUp = 2;
  }

  // Psychological Sway (Enigma of Combination, Counselor Focus, 10th level, p.37) - see its own
  // comment above PSYCHOLOGICAL_SWAY_ID. "Can grant ↑2 (instead of the normal ↑1)" - same
  // unconditional-upgrade shape as Putting Others Before Yourself just above ("who can hear your
  // voice and understand your words" is an unenforced narrative qualifier, same idiom this
  // codebase already accepts for similarly unverifiable conditions elsewhere).
  if (actorHasPerk(actor, PSYCHOLOGICAL_SWAY_ID)) {
    shiftUp = Math.max(shiftUp, 2);
  }

  if (actorHasPerk(actor, BETTER_TOGETHER_JTT_ID) && getSkillRanks(actor, skill) > getSkillRanks(ally, skill)) {
    shiftUp = Math.max(shiftUp, (actor?.system?.level ?? 0) >= 13 ? 3 : 2);
  }

  // Armchair General (Field Guide to Action and Adventure, Envoy Origin benefit, p.65): "When you
  // lend assistance in combat, your ally gains an additional ↑1 on their Skill Test." Additive on
  // top of whatever the shift is otherwise (it stacks with Putting Others Before Yourself/Better
  // Together above, unlike those two which only ever raise the base amount), and gated on
  // game.combat - the one Perk in this file whose bonus is conditioned on being IN a combat scene
  // rather than the more common "outside combat" gate (Teacher/Lesson Plan's own Edge).
  if (game.combat && actorHasPerk(actor, ARMCHAIR_GENERAL_ID)) {
    shiftUp += 1;
  }

  return shiftUp;
}

/**
 * Whether the skill half also grants an Edge: Bureaucrat and Greenshirt always, Teacher and
 * Lesson Plan only outside combat. See each id's own comment.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function getAssistEdge(actor) {
  return actorHasPerk(actor, BUREAUCRAT_TF_ID)
    || actorHasPerk(actor, GREENSHIRT_PERK_ID)
    || (!game.combat && (actorHasPerk(actor, TEACHER_ID) || actorHasPerk(actor, LESSON_PLAN_ID)));
}

/**
 * Banks the skill half on the ally, or refuses and says why.
 * @param {Actor} actor
 * @param {Actor} ally
 * @param {String} skill
 * @returns {Promise<Boolean>}   Whether anything was banked.
 */
async function bankSkillAssist(actor, ally, skill) {
  /* The one hard prerequisite in the action (plus the Perks that move it). Refused rather than
     warned-and-allowed, because unlike the duration and range clauses this one decides whether
     the grant exists at all. */
  if (!canAssistWithSkill(actor, ally, skill)) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceUnskilled', {
      name: actor.name,
      ally: ally.name,
      skill: game.i18n.localize(E20.skills[skill] ?? skill),
    }));
    return false;
  }

  // Voice of Primus - see hasVoiceOfPrimusAssistReady's own comment above. Consumed here, once
  // it's actually the thing that let this specific assist through, the same "spend it the moment
  // it's used, not the moment it's rolled" idiom every other banked-then-consumed grant follows.
  if (hasVoiceOfPrimusAssistReady(actor)) {
    await clearVoiceOfPrimusAssistReady(actor);
  }

  // Those Who Know, Teach - see THOSE_WHO_KNOW_TEACH_ID's own comment above. Checked (and its own
  // 3/scene use marked) here rather than in getAssistShiftUp/getAssistEdge above, since unlike
  // those two this one also consumes a limited resource rather than being a standing, free
  // modifier.
  const isPersistent = actorHasPerk(actor, THOSE_WHO_KNOW_TEACH_ID)
    && getUsesThisScene(actor, THOSE_WHO_KNOW_TEACH_SCENE_FLAG) < 3;
  if (isPersistent) {
    await markUsedThisScene(actor, THOSE_WHO_KNOW_TEACH_SCENE_FLAG);
  }

  await bankPendingBonus(ally, LEND_ASSISTANCE_SHIFT_FLAG, {
    skill,
    shiftUp: getAssistShiftUp(actor, ally, skill),
    edge: getAssistEdge(actor),
    persistent: isPersistent,
    // Misled (MLP CRB, Mentor Influence Hang-Up, p.53) - dice.mjs's own consumption reads this
    // back to check whether the ASSISTER (not the ally rolling) holds the Hang-Up, since the
    // penalty is keyed on who gave the assist, not who received it.
    assisterUuid: actor.uuid ?? null,
  });
  return true;
}

/**
 * Team Player's payoff - one Story Point when the action lands. The Transformers and Night Vale
 * printings have no qualifier this system can check; G.I. Joe's says "in a combat", which it can.
 * @param {Actor} actor
 */
function grantTeamPlayerStoryPoint(actor) {
  if (actorHasPerk(actor, TEAM_PLAYER_TF_ID)
    || actorHasPerk(actor, TEAM_PLAYER_WTNV_ID)
    || (game.combat && actorHasPerk(actor, TEAM_PLAYER_GIJ_ID))) {
    requestStoryPointGrant(actor);
  }
}

/**
 * How far the assisting character is from a token, in feet.
 *
 * Returns null when there is nothing to measure against - no scene, or neither of them placed on
 * it - which the caller treats as "cannot check" rather than "out of range". Refusing the action
 * because a GM is running theatre-of-the-mind would be the wrong way to fail.
 *
 * @param {Actor} actor
 * @param {Token} token
 * @returns {Number|null}
 */
function distanceFeet(actor, token) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !token || !canvas?.grid) {
    return null;
  }

  return canvas.grid.measurePath([token.center, actorToken.center]).distance;
}

/**
 * Asks who is being helped, and how.
 *
 * One dialog rather than a chain of them: the ally is needed either way, and the mode decides only
 * whether the skill dropdown matters. The skill select is always present and ignored in attack
 * mode, which keeps this to a single DialogV2 - the same single-form shape every other picker in
 * this file tree uses, just with three fields.
 *
 * @param {Array<Actor>} allies      Who can be helped.
 * @param {String|null} targetName   The currently targeted enemy, or null if there is none.
 * @returns {Promise<Object|null>}   {allyId, mode, skill}, or null if cancelled.
 */
async function pickAssistance(allies, targetName) {
  const allyOptions = allies
    .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join('');
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');

  /* Attack mode needs a target, so it is only offered when there is one - and when there is, it is
     listed first, since targeting an enemy and then taking this action is the combat case. */
  const modeOptions = [
    targetName
      ? `<option value="attack">${game.i18n.format('E20.LendAssistanceModeAttack', { target: targetName })}</option>`
      : '',
    `<option value="skill">${game.i18n.localize('E20.LendAssistanceModeSkill')}</option>`,
  ].join('');

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.LendAssistanceTitle') },
    classes: ["window-app", "e20-window"],
    content: `
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceAllyLabel')}</label>
        <select name="allyId">${allyOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceModeLabel')}</label>
        <select name="mode">${modeOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('E20.LendAssistanceSkillLabel')}</label>
        <select name="skill">${skillOptions}</select>
      </div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          allyId: button.form.elements.allyId.value,
          mode: button.form.elements.mode.value,
          skill: button.form.elements.skill.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return result && result != 'cancel' ? result : null;
}

/**
 * Take the Lend Assistance action.
 *
 * Returns {message} on success for the chat notice, or {cancelled: true} when nothing was banked -
 * which the caller uses to hand the Standard action back, since an action that helped nobody was
 * never taken.
 *
 * @param {Actor} actor
 * @returns {Promise<Object>}
 */
export async function activateLendAssistance(actor) {
  if (actorHasHangUp(actor, TREACHEROUS_HANGUP_ID)) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceTreacherous', { name: actor.name }));
    return { cancelled: true };
  }

  // Fun Exhaustion - see helpers/fun-exhaustion.mjs's own doc comment. "Cannot assist or be
  // assisted by anyone else" - refused here for the assisting half; the being-assisted half is
  // the candidate-list filter just below.
  if (isBlockedByFunExhaustion(actor)) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceFunExhaustion', { name: actor.name }));
    return { cancelled: true };
  }

  const nearbyAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean)
    .filter(ally => !isBlockedByFunExhaustion(ally));
  const allies = actorHasPerk(actor, ONE_PONY_SHOW_ID) ? [...nearbyAllies, actor] : nearbyAllies;
  if (!allies.length) {
    ui.notifications.warn(game.i18n.localize('E20.LendAssistanceNoAllies'));
    return { cancelled: true };
  }

  const targetToken = game.user.targets.first();
  const distance = targetToken ? distanceFeet(actor, targetToken) : null;
  /* Out of range is reported before the dialog rather than inside it: the player picked that
     target, and telling them afterwards that the mode they chose was never available is worse than
     telling them now. A distance that cannot be measured at all is not a refusal - see
     distanceFeet. */
  const targetInRange = !!targetToken
    && (distance === null || distance <= LEND_ASSISTANCE_RANGE_FEET);
  if (targetToken && !targetInRange) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceOutOfRange', {
      target: targetToken.name,
      range: LEND_ASSISTANCE_RANGE_FEET,
      distance: Math.round(distance),
    }));
  }

  const choice = await pickAssistance(allies, targetInRange ? targetToken.name : null);
  if (!choice) {
    return { cancelled: true };
  }

  const ally = allies.find(a => a.id == choice.allyId);
  if (!ally) {
    return { cancelled: true };
  }

  if (choice.mode == 'attack') {
    /* The attack option is only offered when a target is in range, but the dialog is a form and
       nothing stops the player untargeting while it is open. Treated as nothing chosen rather
       than banked against a null target, which would be an Edge no attack could ever match. */
    if (!targetInRange) {
      ui.notifications.warn(game.i18n.localize('E20.LendAssistanceNoTarget'));
      return { cancelled: true };
    }

    await bankPendingBonus(ally, LEND_ASSISTANCE_EDGE_FLAG, {
      targetId: targetToken.actor?.id ?? null,
      edge: true,
    });
    grantTeamPlayerStoryPoint(actor);

    return {
      message: game.i18n.format('E20.LendAssistanceAttackActivated', {
        name: actor.name,
        ally: ally.name,
        target: targetToken.name,
      }),
    };
  }

  if (!await bankSkillAssist(actor, ally, choice.skill)) {
    return { cancelled: true };
  }

  grantTeamPlayerStoryPoint(actor);

  return {
    message: game.i18n.format('E20.LendAssistanceSkillActivated', {
      name: actor.name,
      ally: ally.name,
      skill: game.i18n.localize(E20.skills[choice.skill] ?? choice.skill),
    }),
  };
}

/**
 * The skill half on its own, from a shorter reach - Help Yourself's clone helps from 15 ft
 * (helpers/help-yourself.mjs). Allies holding Lackey are offered at any distance, since that Perk
 * lets them be assisted from anywhere. No Team Player payoff: here the clone acts, not the caster.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Number} [options.radiusFeet]
 * @returns {Promise<Boolean>}   Whether an assist was banked.
 */
export async function lendAssistanceSkill(actor, { radiusFeet = LEND_ASSISTANCE_RANGE_FEET } = {}) {
  if (actorHasHangUp(actor, TREACHEROUS_HANGUP_ID)) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceTreacherous', { name: actor.name }));
    return false;
  }

  const nearby = getNearbyAllyTokens(actor, radiusFeet).map(token => token.actor).filter(Boolean);
  const lackeys = getNearbyAllyTokens(actor, Infinity).map(token => token.actor)
    .filter(ally => ally && actorHasPerk(ally, LACKEY_ID));
  const allies = [...new Set([...nearby, ...lackeys])];
  if (!allies.length) {
    ui.notifications.warn(game.i18n.localize('E20.LendAssistanceNoAllies'));
    return false;
  }

  const choice = await pickAssistance(allies, null);
  const ally = choice && allies.find(a => a.id == choice.allyId);
  if (!ally) {
    return false;
  }

  return bankSkillAssist(actor, ally, choice.skill);
}
