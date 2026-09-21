import { bankPendingBonus } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Enchant (MLP CRB, Elementary Enchantment spell, p.136): "A creature better understands how to
 * perform a task... The target creature gains ↑1 in a Skill of your choice."
 *
 * The skill choice is picked BEFORE the roll (same "don't spend on a wasted cast" idiom Elemental
 * Storm/Bolster Defense already established), threaded through the cast's own synthetic dataset
 * from `documents/item.mjs`'s own spell-cast branch (the one hardcoded per-spell-id check in this
 * codebase's otherwise fully generic spell-casting path, alongside Efficient Spellcaster's own
 * Perk-id checks in that same branch). On a successful cast, the shiftUp is banked on whichever
 * token is currently targeted (or the caster themselves, matching this system's own "Target
 * Creature" rule that a spellcaster can always target themselves) - consumed on the target's own
 * next roll of that specific skill, the same shape Grid Surge's own Temporary Construct already
 * established. "3 rounds" is approximated as "the next matching roll," this project's usual
 * duration idiom for anything shorter than a full scene.
 */
export const ENCHANT_SHIFT_UP_FLAG = 'pendingEnchantShiftUp';

/**
 * @returns {Promise<String|null>}   The chosen skill key, or null if cancelled.
 */
export async function pickEnchantSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EnchantPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EnchantPickSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.skill.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Banks the shiftUp on the target - called from dice.mjs's own post-roll success handling.
 * @param {Actor} targetActor
 * @param {String} skill
 */
export async function applyEnchant(targetActor, skill) {
  await bankPendingBonus(targetActor, ENCHANT_SHIFT_UP_FLAG, { skill });
}
