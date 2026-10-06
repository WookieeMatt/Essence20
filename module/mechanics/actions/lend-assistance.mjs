import { payForAssist, ruleAssistPayment } from "../../rules/plugins/picks/cross-item-picks.mjs";
// Those Who Know, Teach's lasting assist and Conniving's "roll it for you" are Assist rules (persist / rollFor).
import { recordRollFor, rollForAvailable, rollForOffered, useAssistPersist } from "../../rules/plugins/rolls/assist-extras.mjs";
import { ruleAssistGrantModes } from "../../rules/plugins/rolls/assist-next-turn.mjs";
import { describeGrant, setNextTurn } from "./action-economy.mjs";
import { E20 } from "../../util/config.mjs";
import { bankPendingBonus } from "../characters/perks.mjs";
import { getNearbyAllyTokens } from "../combat/nearby-allies.mjs";
import { getSkillRanks } from "../combat/combat.mjs";
import { ruleAssist } from "../../rules/adapter.mjs";
import { clearVoiceOfPrimusAssistReady, hasVoiceOfPrimusAssistReady } from "../../items/social/voice-of-primus.mjs";

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
 * items/social/shoulder-to-shoulder.mjs already established.
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

// (I Got You - Enigma of Combination, Team Leader Focus - is its item's own two Use rules: the Lend Assistance access
// and the once/round Energon-for-↑1. Its id and the never-called pickIGotYouAction() picker went; audit fix 2026-10-07.)

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

// Those Who Know, Teach (MLP CRB, Mentor Influence, p.53) - its lasting Skill assist is an Assist {effect: persist}
// rule (rules/plugins/rolls/assist-extras.mjs), banked as a `persistent` flag on the same pendingLendAssistanceShift
// grant (dice.mjs skips clearing it on consumption). Its id stays below only for the Lend Assistance button.
const THOSE_WHO_KNOW_TEACH_ID = "Compendium.essence20.mlp_crb.Item.Xi0qQqfZQJh0MBTu";

// Lackey (Decepticon Directive, Influence Perk, p.27): "You are completely accustomed to following
// orders, allowing any character you perceive as able to give you commands to Lend Assistance to
// you from any distance, as long as you can receive their believable verbal command to perform the
// task." Unlike every other Perk in this file, this one is held by the RECIPIENT, not the
// assister - it lifts the action's own 50ft radius for assists aimed at the holder. Both of RAW's
// qualifiers ("you perceive as able to give you commands", "believable verbal command") are
// unenforceable narrative framing, dropped the same way as Bits To Spare/Truthseeker's own.
const LACKEY_ID = "Compendium.essence20.decepticon_directive.Item.dXZpwsbvn6Jdgpsn";

// (Armchair General's +↑1 in combat is its Assist rule, and its weapon-type Qualification its Use rule - rules/conv17-split2.test.js.)

// Technological Assistance (Quartermaster's Guide to Gear, Tech Officer Focus, 17th level, p.22):
// "you can Lend Assistance as a Free action. However, allies can only take advantage of this for
// Driving, Targeting, or Technology Skill Tests." Read as: the Free-action Lend Assistance only
// helps with those three Skills - an assist with anything else still costs its usual Standard
// action. So it is an action-economy discount (an ActionCost rule on the item), offered when Lend
// Assistance is paid for and asked, since only the player knows which Skill the ally is about to
// roll. The ordinary "at least as many ranks as your ally" gate still applies. (It used to be
// built as a lift of that rank gate on those three Skills, which the book doesn't say.)
const TECHNOLOGICAL_ASSISTANCE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7b01zSdekhUugIod";

/**
 * Whether an actor has any real rank in a skill - i.e. its shift is an actually-trained die rather
 * than the untrained d20 default. E20.skillRollableShifts is exactly that trainable set.
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */

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
  // Use rule takes the DIF 10 Alertness Test, a SEPARATE action from Lend Assistance itself per RAW
  // ("attempt a... Skill Test to Lend Assistance", the same prerequisite-roll reading Voice of Primus's
  // own assist half uses) - Lend Assistance is already reachable to everyone via
  // mechanics/actions/named-actions.mjs once its Assist rule (anyRank while the mark lasts) applies.
  // Technological Assistance - see its own comment above.
  TECHNOLOGICAL_ASSISTANCE_ID,
  // Those Who Know, Teach only upgrades the skill half's duration (see its own comment above),
  // same "needs the button to matter" reasoning as Bureaucrat/Teacher.
  THOSE_WHO_KNOW_TEACH_ID,
  // (I Got You isn't listed: its item's own Use rules grant its Lend Assistance access.)
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
  // Item rules (rules/adapter.mjs#ruleAssist): Hang-Ups that refuse help (Conniving, Skeptical, Show
  // Off, Greenshirt, Acrobatic Outlook) and Perks that lift the rank requirement (Walk Them Through
  // It, Many Minds Make Light Work, Ship's Crew).
  const essence = Object.keys(E20.skillsByEssence ?? {}).find(key => E20.skillsByEssence[key].includes(skill)) ?? null;
  const assist = ruleAssist(actor, ally, skill, essence);
  if (assist.refused) {
    return false;
  }

  if (getSkillRanks(actor, skill) >= getSkillRanks(ally, skill) || assist.anyRank) {
    return true;
  }

  // Voice of Primus (Enigma of Combination, General Perk, p.41) - see its own doc comment. A
  // successful DIF 12 Persuasion Skill Test (banked by items/social/voice-of-primus.mjs) stands in for
  // the rank comparison, exactly like the two Perk bypasses just below.
  if (hasVoiceOfPrimusAssistReady(actor)) {
    return true;
  }

  // (Command & Control is an Assist {effect: anyRank} rule on its Perk, scopes self and companion.)

  // Extension rank-gate bypasses, fn(actor, ally, skill) => Boolean (Inspirational Leader -
  // helpers/extensions/react).
  if (ASSIST_RANK_BYPASSES.some(fn => {
    try {
      return !!fn(actor, ally, skill);
    } catch (error) {
      return false;
    }
  })) {
    return true;
  }

  return false;
}

export const ASSIST_RANK_BYPASSES = [];

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
  // Item rules (Assist, effect boost): Putting Others Before Yourself, Psychological Sway and Better
  // Together raise it to at least ↑2 (↑3); Armchair General adds ↑1 in combat.
  const boost = ruleAssist(actor, ally, skill);
  return Math.max(1, boost.atLeast) + boost.extra;
}

/**
 * Whether the skill half also grants an Edge: Bureaucrat and Greenshirt always, Teacher and
 * Lesson Plan only outside combat. See each id's own comment.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function getAssistEdge(actor) {
  // Item rules (Assist, effect boost, edge): Bureaucrat and Greenshirt; Teacher and Lesson Plan out of combat.
  return ruleAssist(actor, null, null).edge;
}

/**
 * Banks the skill half on the ally, or refuses and says why.
 * @param {Actor} actor
 * @param {Actor} ally
 * @param {String} skill
 * @returns {Promise<Boolean>}   Whether anything was banked.
 */
/**
 * Item rule Triggers for a finished assist (rules/triggers.mjs): `lendAssistance` on the helper,
 * aimed at the ally, and `assisted` on the ally, aimed at the helper. `kind` is 'skill' or 'attack'
 * (tags: `assist:skill`, `assist:attack`).
 */
async function fireAssistTriggers(actor, ally, kind) {
  const { fireTriggers } = await import("../../rules/triggers.mjs");
  await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: kind }, targets: [ally] });
  await fireTriggers(ally, 'assisted', { roll: { assistKind: kind }, targets: [actor] });
}

async function bankSkillAssist(actor, ally, skill) {
  const banked = await bankSkillAssistBonus(actor, ally, skill);
  if (banked) {
    await fireAssistTriggers(actor, ally, 'skill');
  }

  return banked;
}

async function bankSkillAssistBonus(actor, ally, skill) {
  /* The one hard prerequisite in the action (plus the Perks that move it). Refused rather than
     warned-and-allowed, because unlike the duration and range clauses this one decides whether
     the grant exists at all. */
  // Assist rules with effect "pay" (rules/plugins/picks/cross-item-picks.mjs) - BFF: "If you aren't qualified to Lend
  // Assistance ... you can spend a Friendship Point to Lend Assistance anyway."
  const payment = !canAssistWithSkill(actor, ally, skill) ? ruleAssistPayment(actor, ally, skill) : null;
  if (payment) {
    if (await payForAssist(actor, ally, payment)) {
      await bankPendingBonus(ally, LEND_ASSISTANCE_SHIFT_FLAG, {
        skill, shiftUp: getAssistShiftUp(actor, ally, skill), edge: getAssistEdge(actor), persistent: false, assisterUuid: actor.uuid ?? null,
      });
      return true;
    }
  }

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

  // Assist {effect: persist} rules (Those Who Know, Teach) - checked (and a use counted) here rather than in
  // getAssistShiftUp/getAssistEdge above, since this one consumes a limited resource.
  const isPersistent = await useAssistPersist(actor, ally, skill);

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
async function pickAssistance(allies, targetName, grantModes = []) {
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
    // Here, Let Me / No, I Insist - "instead of the normal effect" (mechanics/actions/action-perks.mjs).
    ...grantModes.map(mode => `<option value="${mode.mode}">${mode.label}</option>`),
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
  // An Assist rule refusing the helper outright, whatever the Skill (Treacherous's Hang-Up; Fun Exhaustion's, with its
  // own message).
  const refusal = ruleAssist(actor, null, null);
  if (refusal.refused) {
    ui.notifications.warn(game.i18n.format(refusal.message ?? 'E20.LendAssistanceTreacherous', { name: actor.name }));
    return { cancelled: true };
  }

  // Allies an Assist rule refuses whatever the Skill (Fun Exhaustion: "cannot ... be assisted by anyone else") aren't offered.
  const nearbyAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean)
    .filter(ally => !ruleAssist(actor, ally, null).refused);
  // An Assist rule letting the actor help themselves (One Pony Show).
  const allies = ruleAssist(actor, null, null).self ? [...nearbyAllies, actor] : nearbyAllies;
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

  // Assist {effect: nextTurnGrant} rules (Here, Let Me; No, I Insist): an action on the friend's next turn instead.
  const grantModes = ruleAssistGrantModes(actor);
  // Assist {side: receive, effect: rollFor} rules (Conniving): the helper may roll the ally's test for them, with the
  // ally's assistance. Offered when an ally holds one.
  if (rollForOffered(allies, actor)) {
    grantModes.push({ mode: 'conniving', label: game.i18n.localize('E20.ConnivingMode') });
  }

  const choice = await pickAssistance(allies, targetInRange ? targetToken.name : null, grantModes);
  if (!choice) {
    return { cancelled: true };
  }

  const ally = allies.find(a => a.id == choice.allyId);
  if (!ally) {
    return { cancelled: true };
  }

  if (choice.mode == 'conniving') {
    return rollForConniving(actor, ally, choice.skill);
  }

  // An extra action on the friend's next turn instead of the usual bonus.
  const grantMode = grantModes.find(mode => mode.mode == choice.mode);
  if (grantMode) {
    await setNextTurn(ally, { grant: grantMode.grant }, actor.name);
    return {
      message: game.i18n.format('E20.LendAssistanceNextTurnGranted', {
        name: actor.name, ally: ally.name, grant: describeGrant(grantMode.grant),
      }),
    };
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
    await fireAssistTriggers(actor, ally, 'attack');

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

  // (That's What Best Friends Are For's Friendship Point is a lendAssistance Trigger on the Perk.)

  return {
    message: game.i18n.format('E20.LendAssistanceSkillActivated', {
      name: actor.name,
      ally: ally.name,
      skill: game.i18n.localize(E20.skills[choice.skill] ?? choice.skill),
    }),
  };
}

/**
 * Conniving (an Assist rollFor rule): the ally (the one offering help) rolls the holder's test, with the holder's
 * assistance - the rule's limit counted on the helper, per holder.
 */
async function rollForConniving(actor, holder, skill) {
  const entry = rollForAvailable(actor, holder, skill);
  if (!entry) {
    ui.notifications.warn(game.i18n.localize('E20.OncePerScene'));
    return { cancelled: true };
  }

  await recordRollFor(actor, holder, entry);
  const essence = E20.skillToEssence[skill] ?? 'smarts';
  await actor._dice?.rollSkill({ skill, essence, shiftUp: getAssistShiftUp(holder, actor, skill), shiftDown: 0 }, actor);
  return { message: game.i18n.format('E20.ConnivingRolled', { name: actor.name, holder: holder.name, skill: game.i18n.localize(E20.skills[skill] ?? skill) }) };
}

/**
 * The skill half on its own, from a shorter reach - Help Yourself's clone helps from 15 ft (the spell's
 * lendAssistance {skillOnly} Use rule). Allies holding Lackey are offered at any distance, since that Perk
 * lets them be assisted from anywhere. No lendAssistance / assisted Triggers (Team Player's Story
 * Point): here the clone or pet acts, not the actor taking the action.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Number} [options.radiusFeet]
 * @returns {Promise<Boolean>}   Whether an assist was banked.
 */
export async function lendAssistanceSkill(actor, { radiusFeet = LEND_ASSISTANCE_RANGE_FEET } = {}) {
  if (ruleAssist(actor, null, null).refused) {
    ui.notifications.warn(game.i18n.format('E20.LendAssistanceTreacherous', { name: actor.name }));
    return false;
  }

  const nearby = getNearbyAllyTokens(actor, radiusFeet).map(token => token.actor).filter(Boolean);
  // Allies whose Assist rule lets them be helped from any distance (Lackey).
  const lackeys = getNearbyAllyTokens(actor, Infinity).map(token => token.actor)
    .filter(ally => ally && ruleAssist(actor, ally, null).anyRange);
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

  return bankSkillAssistBonus(actor, ally, choice.skill);
}
