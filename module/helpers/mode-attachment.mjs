/**
 * Mode Attachment (Transformers CRB, Hang-Up, p.43): "You are deeply uncomfortable in one of your
 * Modes. When you choose this Hang-Up, choose either Bot Mode or one of your Alt Modes. When
 * converting into the selected mode, you must make a Technology Skill Test when converting
 * against a DIF equal to 10 + half your level (rounding up). If you fail, you can't change forms
 * that turn, and the action is lost."
 *
 * Which mode was chosen has no existing storage anywhere in this codebase - every other Hang-Up
 * choice picker (system.choice) draws from a fixed, static list (skills, essences, ...), but "one
 * of your Alt Modes" is a per-actor, dynamically-owned list that doesn't exist until the
 * character has Alt Modes to choose from. So this is its own small "configure" Use-button
 * (same DialogV2.wait picker idiom as e.g. Resourceful's own benefit picker) rather than a
 * chargen-time-only pick, storing 'botMode' or the chosen Alt Mode's own item id in system.choice
 * - reconfigurable any time, the same "offer the choice, don't gate WHEN it's set" idiom this
 * project already accepts (e.g. Chosen Specialization).
 *
 * The DIF is real and correct (10 + half level, rounding up), but whether a failed Skill Test
 * actually BLOCKS the transform is left to the player - this codebase has no established pattern
 * anywhere for gating a real game action on the pass/fail OUTCOME of a rollSkill() call (every
 * rollSkill() call is fire-and-forget, posting to chat for the table to read and adjudicate), so
 * automating the roll itself (remembering to roll, at the right DIF, at the right moment) is this
 * file's real contribution - the same "roll for real, self-adjudicate the consequence" idiom
 * Precision Aim/Empty the Mag's own "no fictional check" comments already establish elsewhere.
 */
export const MODE_ATTACHMENT_ID = "Compendium.essence20.tf_crb.Item.SgofEgBVvg4josSR";
const BOT_MODE_CHOICE = 'botMode';

/**
 * The DIF for this actor's own Mode Attachment Skill Test: 10 + half their level, rounded up.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getModeAttachmentDif(actor) {
  return 10 + Math.ceil((actor.system.level ?? 0) / 2);
}

/**
 * Prompts for which mode is uncomfortable: Bot Mode, or one of the actor's own current Alt Modes.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   'botMode', an Alt Mode item id, or null if cancelled/no choice
 *   is possible (no Alt Modes at all).
 */
export async function pickModeAttachmentChoice(actor) {
  const altModes = actor.items.documentsByType?.altMode ?? [];
  const options = [[BOT_MODE_CHOICE, game.i18n.localize('E20.ModeBotMode')],
    ...altModes.map(altMode => [altMode.id, altMode.name])];
  const optionsHtml = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ModeAttachmentPickModeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ModeAttachmentPickModeLabel')
    }</label><select name="mode">${optionsHtml}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.mode.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Whether entering the given mode is the one this actor is uncomfortable in.
 * @param {Actor} actor
 * @param {String} modeChoice   The Hang-Up item's own system.choice.
 * @param {Boolean} isEnteringBotMode
 * @param {String|null} altModeId   The Alt Mode being entered, if not Bot Mode.
 * @returns {Boolean}
 */
function isAttachedMode(modeChoice, isEnteringBotMode, altModeId) {
  if (!modeChoice) {
    return false;
  }

  return isEnteringBotMode ? modeChoice == BOT_MODE_CHOICE : modeChoice == altModeId;
}

/**
 * Rolls the Mode Attachment Technology Skill Test, if the mode being entered is the actor's own
 * configured uncomfortable one. A plain fire-and-forget roll, like every other rollSkill() call in
 * this codebase - see this file's own doc comment for why the pass/fail consequence isn't enforced.
 * @param {Actor} actor
 * @param {Boolean} isEnteringBotMode
 * @param {String|null} altModeId
 */
export async function triggerModeAttachmentCheck(actor, isEnteringBotMode, altModeId = null) {
  const hangUp = actor.items?.find(item => item.type == 'hangUp'
    && (item.flags?.core?.sourceId == MODE_ATTACHMENT_ID || item._stats?.compendiumSource == MODE_ATTACHMENT_ID));
  if (!hangUp || !isAttachedMode(hangUp.system.choice, isEnteringBotMode, altModeId)) {
    return;
  }

  await actor._dice.rollSkill({
    skill: 'technology', essence: 'smarts', dif: String(getModeAttachmentDif(actor)), isModeAttachmentAttempt: true,
  }, actor);
}
