import { actorHasPerk, findPerk, hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { E20 } from "./config.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Emotional Mastery (A Jump Through Time, Purple Ranger, 1st level, p.37) - the project's first
 * runtime-swappable active-option Perk. Every other `hasChoice` picker in this codebase (Power
 * Adaptation, Wisdom of the Elders, Phantom Focus, ...) is a ONE-TIME PERMANENT pick per Perk
 * instance; Emotional Mastery instead notes several named options up front, then lets the player
 * spend a resource at any time to make exactly one of them active "for the remainder of the
 * scene," switching to a different one later for the same cost. No existing choiceType/toggle
 * shape fits that - this file is the new mechanism.
 *
 * Scope of this pass: this codebase has no slot-count enforcement anywhere (Perks, Powers, Focus
 * choices, Zord Features - see helpers/torozord-feature.mjs's own note on this precedent), so
 * "note a number of options equal to your Emotional Range" isn't separately tracked here either -
 * the activation picker below simply offers all 12 named options, self-policed the same way
 * every other unenforced RAW budget in this project already is. What IS built is the actual
 * missing piece: activating/switching the ACTIVE option(s), Adaptation's "more than one active at
 * once" exception, Heart's Calling's "one option is free and works unmorphed" exception, and
 * Team Spirit's cross-actor grant.
 *
 * All 12 named options now have real mechanical effects. The first 6 (Fear, Sadness, Interest,
 * Anger, Guilt, Surprise) were chosen to prove the mechanism against 5 different effect shapes;
 * the remaining 6 (Contempt, Disgust, Distress, Joy, Shame, Shyness) each reuse
 * isEmotionalMasteryOptionActive() the same way, just against a different established pattern:
 * - Contempt: Resistance to one damage type, chosen at activation time (own sub-picker, stored
 *   separately from the option itself since only one type applies at once) - a live check
 *   parallel to the static system.resistances field, the same shape Lance of Light/Defensive
 *   Flexibility's own toggleable Resistances already use (see hasContemptResistance below).
 * - Disgust: a reciprocal downshift on the first Skill Test to target the holder each turn - the
 *   same "checked on the TARGET, hasUsedThisTurn-gated, reported back for rollSkill() to mark"
 *   shape Move Like a Song's identical "first attack each round" clause already established (see
 *   dice.mjs's own disgustTriggered handling).
 * - Distress: +10ft to all Movement while a nearby enemy is present - a live read in
 *   documents/actor.mjs#_prepareMovement, the same touch-point Warrior Rush's own movement
 *   modifier already uses (see getDistressMovementBonus below).
 * - Joy: ↑1 on the holder's own first Skill Test each turn while near an ally - a plain
 *   hasUsedThisTurn-gated self-status shiftUp, checked directly in dice.mjs.
 * - Shame: a banked ↑1 (↑2 on a Critical Success) on the holder's own next Skill Test, banked the
 *   moment ANY Skill Test successfully targets them - the same "bank on the target after being
 *   successfully targeted" shape Unlucky (For You) already established (see dice.mjs's own
 *   post-roll processing and EMOTIONAL_MASTERY_SHAME_FLAG's consumption).
 * - Shyness: toggles the real `invisible` status Condition on activation, auto-cleared the moment
 *   the holder makes an Attack or suffers damage - the same flag+status toggle and auto-clear
 *   shape helpers/invisibility.mjs already established (see deactivateShynessOnAttack/
 *   deactivateShynessOnDamage below).
 */
export const EMOTIONAL_MASTERY_ID = "Compendium.essence20.jump_through_time.Item.bWAncoQxwfCLtn2v";
export const EMOTIONAL_STRENGTH_ID = "Compendium.essence20.jump_through_time.Item.BODEMNm0GIAsMMm0";
export const TEAM_SPIRIT_ID = "Compendium.essence20.jump_through_time.Item.cGI21L1eFai4IfqJ";
export const HEARTS_CALLING_ID = "Compendium.essence20.jump_through_time.Item.Eg5LUM4lWf7X7yGs";
const ADAPTION_1_ID = "Compendium.essence20.jump_through_time.Item.diexsL5zyTuJsSPu";
const ADAPTION_2_ID = "Compendium.essence20.jump_through_time.Item.0bw6c3XfIYcQeGgN";

const ACTIVE_FLAG = 'activeEmotionalMastery';
const HEARTS_CALLING_FLAG = 'heartsCallingOption';
const TEAM_SPIRIT_FLAG = 'teamSpiritOption';
export const EMOTIONAL_STRENGTH_ENCOUNTER_FLAG = 'emotionalStrengthUsedThisEncounter';
const CONTEMPT_DAMAGE_TYPE_FLAG = 'contemptDamageType';
export const DISGUST_TURN_FLAG = 'disgustUsedThisTurn';
export const EMOTIONAL_MASTERY_SHAME_FLAG = 'pendingEmotionalMasteryShame';

const EMOTIONAL_MASTERY_OPTIONS = [
  'anger', 'contempt', 'disgust', 'distress', 'fear', 'guilt',
  'interest', 'joy', 'sadness', 'shame', 'shyness', 'surprise',
];

/**
 * @param {Actor} actor
 * @returns {Number}   1 normally, 2 with Adaption 1 (7th level), 3 with Adaption 2 (17th level).
 */
export function getMaxActiveEmotionalMastery(actor) {
  if (actorHasPerk(actor, ADAPTION_2_ID)) {
    return 3;
  }

  return actorHasPerk(actor, ADAPTION_1_ID) ? 2 : 1;
}

/**
 * @param {Actor} actor
 * @returns {String[]}   The option keys this actor currently has active themselves (not
 *   counting one borrowed via a Team Spirit grant - see isEmotionalMasteryOptionActive below).
 */
export function getActiveEmotionalMasteryOptions(actor) {
  const value = actor?.getFlag?.('essence20', ACTIVE_FLAG);
  return Array.isArray(value) ? value : [];
}

/**
 * Whether the given option is active for this actor right now - either because they activated it
 * themselves, or because a Team Spirit grant from another actor who STILL has it active is
 * currently applied to them. Every per-option mechanical check in dice.mjs/combat.mjs reads this,
 * never getActiveEmotionalMasteryOptions directly, so Team Spirit needs no separate wiring at
 * each of those call sites.
 * @param {Actor} actor
 * @param {String} option
 * @returns {Boolean}
 */
export function isEmotionalMasteryOptionActive(actor, option) {
  if (!actor) {
    return false;
  }

  if (getActiveEmotionalMasteryOptions(actor).includes(option)) {
    return true;
  }

  const teamSpirit = actor.getFlag?.('essence20', TEAM_SPIRIT_FLAG);
  if (teamSpirit?.option != option) {
    return false;
  }

  const caster = fromUuidSync(teamSpirit.casterUuid);
  return !!caster && getActiveEmotionalMasteryOptions(caster).includes(option);
}

/**
 * Single-dropdown DialogV2 offering all 12 named options - same shape as
 * pickHobbleCondition/pickAgelessKnowledgeSkill.
 * @returns {Promise<String|null>}
 */
async function pickEmotionalMasteryOption() {
  const options = EMOTIONAL_MASTERY_OPTIONS
    .map(key => `<option value="${key}">${game.i18n.localize(`E20.EmotionalMastery${key.capitalize()}`)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EmotionalMasteryPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EmotionalMasteryPickLabel')
    }</label><select name="option">${options}</select></div>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.option.value },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Contempt's own sub-picker ("Resistance to any one type of damage") - a single-dropdown
 * DialogV2 over the real E20.damageTypes catalog, the same "choose an element" shape Adapted
 * Wavelength's own elementDamageType choiceType already established, just resolved at
 * ACTIVATION time (via a plain flag) rather than a one-time permanent choiceType pick, since the
 * option itself can be reactivated later with a different type chosen.
 * @returns {Promise<String|null>}
 */
async function pickContemptDamageType() {
  const options = Object.keys(E20.damageTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EmotionalMasteryContempt') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EmotionalMasteryContemptPickLabel')
    }</label><select name="damageType">${options}</select></div>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.damageType.value },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Contempt: "You gain Resistance to any one type of damage" while active - read live, parallel to
 * the static system.resistances field, the same shape Lance of Light/Defensive Flexibility's own
 * toggleable Resistances already use in dice.mjs's own Resistance-Snag check.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasContemptResistance(actor, damageType) {
  if (!damageType || !isEmotionalMasteryOptionActive(actor, 'contempt')) {
    return false;
  }

  return actor?.getFlag?.('essence20', CONTEMPT_DAMAGE_TYPE_FLAG) == damageType;
}

/**
 * Guilt ("you may re-roll any d20 result of 1") is expressed by toggling the Emotional Mastery
 * item's OWN generic system.reroll field on/off - the exact same schema every Perk-driven reroll
 * grant already reads (helpers/reroll.mjs#getRerollConfigs iterates every item on the actor
 * looking at this field), so activating/deactivating Guilt reuses the entire existing reroll
 * pipeline (the chat button, cost/condition checks, consumption) with no new code there at all.
 * @param {Actor} actor
 * @param {String[]} activeOptions
 */
async function applyGuiltRerollToggle(actor, activeOptions) {
  const item = findPerk(actor, EMOTIONAL_MASTERY_ID);
  if (!item) {
    return;
  }

  const shouldBeEnabled = activeOptions.includes('guilt');
  if (!!item.system.reroll?.enabled == shouldBeEnabled) {
    return;
  }

  await item.update({
    'system.reroll': shouldBeEnabled
      ? { enabled: true, mode: 'ones', target: 'd20', maxUses: 0, reset: 'none', recursive: true }
      : { enabled: false },
  });
}

/**
 * Shyness ("You become Invisible until you make an Attack or suffer damage") - toggles the real
 * `invisible` status Condition to match whether 'shyness' is currently active, the same
 * flag+status shape helpers/invisibility.mjs's own toggle already establishes. Called alongside
 * applyGuiltRerollToggle everywhere the active-options list changes (activate/deactivate/clear-
 * on-Morph-off), so switching AWAY from Shyness correctly clears the status too, not just
 * switching into it.
 * @param {Actor} actor
 * @param {String[]} activeOptions
 */
async function applyShynessStatusToggle(actor, activeOptions) {
  const shouldBeInvisible = activeOptions.includes('shyness');
  const isCurrentlyInvisible = !!actor.statuses?.has?.('invisible');
  if (shouldBeInvisible == isCurrentlyInvisible) {
    return;
  }

  await actor.toggleStatusEffect('invisible', { active: shouldBeInvisible });
}

/**
 * Activates (or switches) the actor's Emotional Mastery. Prompts for which of the 12 options,
 * gates on being Morphed (unless it's the actor's own free Heart's Calling option, which works
 * unmorphed too), spends 1 Personal Power (free only for the Heart's Calling option), and - if
 * the actor already has an option active and holds Adaption 1/2 with room to spare - offers to
 * add this as an ADDITIONAL simultaneously-active option instead of replacing the current one(s),
 * per RAW's own "spend an additional Personal Power for the second Emotional option."
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether an option was actually activated.
 */
export async function activateEmotionalMastery(actor) {
  const option = await pickEmotionalMasteryOption();
  if (!option) {
    return false;
  }

  const isFree = actor.getFlag?.('essence20', HEARTS_CALLING_FLAG) == option;
  if (!actor.system.isMorphed && !isFree) {
    ui.notifications.warn(game.i18n.localize('E20.EmotionalMasteryNotMorphed'));
    return false;
  }

  const current = getActiveEmotionalMasteryOptions(actor);
  let asAdditional = false;
  if (current.length > 0 && current.length < getMaxActiveEmotionalMastery(actor)) {
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.EmotionalMasteryPickTitle') },
      classes: ["window-app"],
      content: `<p>${game.i18n.localize('E20.EmotionalMasteryReplaceOrAdd')}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.EmotionalMasteryAddButton'), action: 'add' },
        { label: game.i18n.localize('E20.EmotionalMasteryReplaceButton'), action: 'replace' },
      ],
    });

    asAdditional = choice == 'add';
  }

  // Contempt's own damage-type sub-choice - prompted before committing the Power spend/flag
  // write below, so cancelling it doesn't burn the activation. A re-activation always re-prompts
  // (even if already active), matching RAW's own "any one type" wording as a fresh choice each
  // time rather than a permanent one.
  let contemptDamageType = null;
  if (option == 'contempt') {
    contemptDamageType = await pickContemptDamageType();
    if (!contemptDamageType) {
      return false;
    }
  }

  if (!isFree) {
    if ((actor.system.powers?.personal?.value ?? 0) < 1) {
      ui.notifications.warn(game.i18n.localize('E20.EmotionalMasteryCannotAfford'));
      return false;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  }

  if (contemptDamageType) {
    await actor.setFlag('essence20', CONTEMPT_DAMAGE_TYPE_FLAG, contemptDamageType);
  }

  const newActive = asAdditional ? [...current, option] : [option];
  await actor.setFlag('essence20', ACTIVE_FLAG, newActive);
  await applyGuiltRerollToggle(actor, newActive);
  await applyShynessStatusToggle(actor, newActive);

  // Surprise's own effect (placing yourself in the Initiative order) only makes sense at the
  // moment it's actually activated, not as a separately-tracked passive - offered right here
  // rather than needing its own dispatch/button. A no-op outside combat or with nothing
  // targeted (activateEmotionalMasterySurprise's own guards).
  if (option == 'surprise') {
    await activateEmotionalMasterySurprise(actor);
  }

  return true;
}

/**
 * Manually deactivates one active option (a Free action per RAW, no cost to turn off).
 * @param {Actor} actor
 * @param {String} option
 */
export async function deactivateEmotionalMastery(actor, option) {
  const newActive = getActiveEmotionalMasteryOptions(actor).filter(o => o != option);
  await actor.setFlag('essence20', ACTIVE_FLAG, newActive);
  await applyGuiltRerollToggle(actor, newActive);
  await applyShynessStatusToggle(actor, newActive);
}

/**
 * Clears every active option on de-Morphing, except the actor's own Heart's Calling option (which
 * RAW explicitly keeps working unmorphed). Called from sheet-handlers/power-ranger-handler.mjs's
 * onMorph, the same "clear on the way OUT of Morphed" idiom Powered Plating/Mysterious Aura
 * already establish there.
 * @param {Actor} actor
 */
export async function clearEmotionalMasteryOnMorphOff(actor) {
  const heartsCalling = actor.getFlag?.('essence20', HEARTS_CALLING_FLAG);
  const current = getActiveEmotionalMasteryOptions(actor);
  const kept = heartsCalling && current.includes(heartsCalling) ? [heartsCalling] : [];
  if (kept.length == current.length) {
    return;
  }

  await actor.setFlag('essence20', ACTIVE_FLAG, kept);
  await applyGuiltRerollToggle(actor, kept);
  await applyShynessStatusToggle(actor, kept);
}

/**
 * Heart's Calling (18th level): "Select one of your Emotional Mastery options. This option no
 * longer costs you Power to activate, and you can activate it even when you are not Morphed."
 * Prompted once, at Perk-grant time, the same shape Speak Your Truth's own picker uses.
 * @param {Actor} actor
 */
export async function pickHeartsCallingOption(actor) {
  const option = await pickEmotionalMasteryOption();
  if (option) {
    await actor.setFlag('essence20', HEARTS_CALLING_FLAG, option);
  }
}

/**
 * Team Spirit (9th level): "you can spend one Personal Power to apply your Emotional Mastery to
 * any ally within 30 feet when you activate it. Your allies can only benefit from one Team Spirit
 * at a time." Applies whichever of the caster's own currently-active options they choose (if more
 * than one, via Adaptation) to the currently-targeted ally - stored as a live pointer back to the
 * caster (isEmotionalMasteryOptionActive re-checks the caster is still active every time, rather
 * than copying a snapshot that could go stale the moment the caster switches).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateTeamSpirit(actor) {
  const active = getActiveEmotionalMasteryOptions(actor);
  if (!active.length) {
    ui.notifications.warn(game.i18n.localize('E20.TeamSpiritNoActiveOption'));
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  if ((actor.system.powers?.personal?.value ?? 0) < 1) {
    ui.notifications.warn(game.i18n.localize('E20.EmotionalMasteryCannotAfford'));
    return false;
  }

  let option = active[0];
  if (active.length > 1) {
    const choice = await pickEmotionalMasteryOption();
    if (!choice || !active.includes(choice)) {
      return false;
    }

    option = choice;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  await targetActor.setFlag('essence20', TEAM_SPIRIT_FLAG, { option, casterUuid: actor.uuid });
  return true;
}

/**
 * Surprise: "Instead of rolling normally, you may set your place in the Initiative order
 * immediately after any other participant in the Combat scene's order." Dispatched as its own
 * "Use" action rather than folded into prepareInitiativeRoll() (which always rolls) - same
 * Combatant#initiative write as Right Behind You (helpers/right-behind-you.mjs), just unscoped to
 * allies (RAW says "any other participant") and gated on Surprise being the active option instead
 * of a Power spend / round-1 restriction.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateEmotionalMasterySurprise(actor) {
  if (!isEmotionalMasteryOptionActive(actor, 'surprise') || !game.combat) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  const combatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const targetCombatant = game.combat.combatants.find(c => c.actor?.id == targetActor.id);
  if (!combatant || !targetCombatant || targetCombatant.initiative == null) {
    return false;
  }

  await combatant.update({ initiative: targetCombatant.initiative - 0.01 });
  return true;
}

/**
 * Emotional Strength (2nd level): "you can regain 1d2 Power Points immediately once you
 * experience a specific trigger attached to whatever Emotional Mastery options you have active
 * at the time... once per scene." Each of the 12 options has its own printed trigger (Anger:
 * "you suffer damage"; Fear: "you gain the Frightened or Impaired condition"; Surprise: "you roll
 * a result of exactly 2 or of 25+"; etc.) - only Anger's own trigger is wired this pass, called
 * from combat.mjs#applyDamage's own reactive-grant tail (the same chokepoint Hardened Armor/Push
 * Through Pain's identical "something just happened to me" checks already use). The other 11
 * triggers each need their own detection point (several - a Group Test failing, discovering
 * something hidden, benefiting from another character's Lend Assistance - have no chokepoint
 * anywhere in this codebase at all yet) and are deliberately left unbuilt rather than
 * approximated against the wrong trigger.
 * @param {Actor} actor
 */
export async function checkEmotionalStrengthAngerTrigger(actor) {
  if (!actorHasPerk(actor, EMOTIONAL_STRENGTH_ID) || !isEmotionalMasteryOptionActive(actor, 'anger')) {
    return;
  }

  if (hasUsedThisEncounter(actor, EMOTIONAL_STRENGTH_ENCOUNTER_FLAG)) {
    return;
  }

  const roll = new Roll('1d2');
  await roll.evaluate();
  const max = actor.system.powers?.personal?.max ?? 0;
  const newValue = Math.min(max, (actor.system.powers?.personal?.value ?? 0) + roll.total);
  await actor.update({ 'system.powers.personal.value': newValue });
  await markUsedThisEncounter(actor, EMOTIONAL_STRENGTH_ENCOUNTER_FLAG);
}

/**
 * Distress: "Your Movement values increase by 10 feet whenever you begin your turn within 10
 * feet of an enemy." A live read in documents/actor.mjs#_prepareMovement (the same touch-point
 * Warrior Rush's own movement modifier already uses) rather than a turn-start hook - "whenever
 * you begin your turn" is approximated as "currently," the same "closest deterministic
 * approximation" idiom this project already accepts for Warrior Rush/Light Chassis's own
 * Initiative-adjacent live reads.
 * @param {Actor} actor
 * @returns {Number}   10, or 0.
 */
export function getDistressMovementBonus(actor) {
  if (!isEmotionalMasteryOptionActive(actor, 'distress')) {
    return 0;
  }

  return getNearbyEnemyTokens(actor, 10).length > 0 ? 10 : 0;
}

/**
 * Shyness's own auto-clear on making an Attack - called from rollSkill's post-roll processing
 * unconditionally on any Attack roll (hit or miss), the same "the attempt itself ends it" shape
 * helpers/invisibility.mjs#deactivateInvisibilityOnAttack already establishes.
 * @param {Actor} actor
 */
export async function deactivateShynessOnAttack(actor) {
  if (!isEmotionalMasteryOptionActive(actor, 'shyness')) {
    return;
  }

  await deactivateEmotionalMastery(actor, 'shyness');
}

/**
 * Shyness's own auto-clear on suffering damage - called from combat.mjs#applyDamage's own
 * reactive-grant tail, alongside Emotional Strength's Anger trigger.
 * @param {Actor} actor
 */
export async function deactivateShynessOnDamage(actor) {
  if (!isEmotionalMasteryOptionActive(actor, 'shyness')) {
    return;
  }

  await deactivateEmotionalMastery(actor, 'shyness');
}
