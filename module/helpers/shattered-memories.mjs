import { bankPendingBonus } from "./perks.mjs";

/**
 * Shattered Memories (Through the Shattered Grid, Grid Power, p.115): "You can recall previous
 * memories from the old universes and warped timelines... You can spend 1 Personal Power as a Free
 * action to recall details and motives of a character from one of the timelines to your advantage.
 * You gain an Edge when making a Social Skill Test on the chosen character. You can gain new
 * Contacts with a special ability... You can spend 1 Personal Power to gain ↑1 on Smarts Skill
 * Tests to recall details from the two timelines."
 *
 * Of the 3 named benefits, 2 are mechanical and built here as a picker (same "pick one of N
 * options at use time" shape as Grid Surge) - the compendium item's own fixed 1-Power cost already
 * covers either:
 * - **Recall a Character**: an Edge scoped to a chosen target's own Social Skill Tests - "the
 *   chosen character" is read as whichever token is currently targeted (the same auto-detect idiom
 *   Mark Target/Menacing Glare already use), banked as a self-Edge scoped to that one target's id,
 *   the same "self-Edge that only applies against one specific other actor" shape Menacing Glare's
 *   own identical clause already established - consumed in
 *   dice.mjs#_getAutomaticCombatModifiers's per-target block, gated on rolledEssence == 'social'
 *   rather than isAttack (RAW says "Skill Test," not "Attack").
 * - **Recall Timeline Details**: a plain ↑1 shiftUp on any Smarts Skill Test, banked the same way
 *   Think On It's own self-shiftUp already is, consumed in the self-status section.
 * The 3rd benefit ("gain new Contacts with a special ability") is a passive narrative capability,
 * not something to click for an effect - deliberately left OUT of the picker, the same "don't offer
 * a choice with nothing behind it" idiom Grid Surge's own Reshape the Power Weapon/en-route-Zord
 * options already establish.
 */
export const SHATTERED_MEMORIES_EDGE_FLAG = 'pendingShatteredMemoriesEdge';
export const SHATTERED_MEMORIES_SMARTS_FLAG = 'pendingShatteredMemoriesSmarts';

/**
 * Prompts for which Shattered Memories benefit to trigger.
 * @returns {Promise<String|null>}   'recallCharacter'/'recallTimeline', or null if cancelled.
 */
export async function pickShatteredMemoriesOption() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ShatteredMemoriesPickOptionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ShatteredMemoriesPickOptionLabel')
    }</label><select name="option">
      <option value="recallCharacter">${game.i18n.localize('E20.ShatteredMemoriesRecallCharacter')}</option>
      <option value="recallTimeline">${game.i18n.localize('E20.ShatteredMemoriesRecallTimeline')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.option.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Applies whichever Shattered Memories option was chosen - called once the resource spend itself
 * has already been confirmed/paid.
 * @param {Actor} actor
 * @param {String} option   pickShatteredMemoriesOption's own return value.
 * @returns {Promise<Boolean>}   False if 'recallCharacter' was chosen but nothing is targeted.
 */
export async function applyShatteredMemoriesOption(actor, option) {
  if (option == 'recallTimeline') {
    await bankPendingBonus(actor, SHATTERED_MEMORIES_SMARTS_FLAG);
    return true;
  }

  if (option == 'recallCharacter') {
    const targetActor = game.user.targets.first()?.actor;
    if (!targetActor) {
      return false;
    }

    await bankPendingBonus(actor, SHATTERED_MEMORIES_EDGE_FLAG, { targetId: targetActor.id });
    return true;
  }

  return false;
}
