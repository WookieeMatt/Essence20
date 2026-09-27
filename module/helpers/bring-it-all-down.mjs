import { actorHasPerk } from "./perks.mjs";

/**
 * Bring It All Down (Decepticon Directive, Demolitionist Focus, 20th level, p.57): "When you have
 * the tools and the time, there isn't a structure too large that you couldn't raze to the ground.
 * At 20th level, you know the best places and techniques to use explosive devices to inflict
 * tremendous amounts of devastation. You can apply one of the following effects to your use of any
 * explosive device or weapon: Gain ↑2 on an Attack Skill Test / Double the blast area of effect
 * radius if used as part of a Contingency action / Add +2 damage to the device's effect / The
 * device gains the Armor-Piercing trait."
 *
 * A genuine per-attack, mutually-exclusive 4-way choice, not a standing toggle - so unlike most
 * declared-intent Perks in this project (a Roll Options Dialog checkbox), it's resolved up front
 * via its own DialogV2 picker, item.mjs's own "resolved once directly" idiom for a mid-roll pick
 * (see pickMindBeamEffect/pickEnchantSkill) rather than added to the dialog. It has to be resolved
 * BEFORE placeAoeTemplate runs (aoe-targeting.mjs), since the radius-doubling option has to be
 * known before the shape is even placed - a Roll Options Dialog checkbox (which only opens after
 * targets are already caught) couldn't feed that back in time anyway.
 *
 * "As part of a Contingency action" isn't itself tracked anywhere in this codebase (dice.mjs has no
 * live notion of "this attack is happening as a Contingency") - offering the radius option is
 * self-policed the same way Disarming Shot's own unenforced "a 1-handed weapon" declaration already
 * is (dice.mjs's own DISARMING_SHOT_ID comment): the player only picks it when it's actually true.
 *
 * The chosen effect is threaded through as a plain dataset.bringItAllDownEffect string
 * ('shiftUp'/'radius'/'damage'/'armorPiercing'/null), read back in dice.mjs at the three separate
 * sites RAW's other options land on (the shift computation, damageBonusValue, and the Armor
 * Piercing/ignoreArmor recompute) - the same "resolved once, read from dataset/context" shape
 * mindBeamEffect/enchantSkill already use, just three read sites instead of one.
 */
const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";
export const BRING_IT_ALL_DOWN_ID = `${DECEPTICON_DIRECTIVE}x4PS0cKR25og3lC0`;

/**
 * @param {Item} item   The weaponEffect being rolled.
 * @returns {Boolean}
 */
export function isExplosiveWeaponEffect(item) {
  return item?.type == 'weaponEffect' && item.system.classification?.style == 'explosive';
}

/**
 * Only ever prompts when there's an actual choice to make - a non-explosive attack or an actor
 * without the Perk just passes through with no effect, same "only prompt with something to
 * actually choose" idiom Shaped Charges' own applyShapedCharges already uses.
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect about to be rolled.
 * @returns {Promise<String|null>}   One of 'shiftUp'/'radius'/'damage'/'armorPiercing', or null if
 *   this attack doesn't qualify, the player declined, or the dialog was cancelled.
 */
export async function pickBringItAllDownEffect(actor, item) {
  if (!isExplosiveWeaponEffect(item) || !actorHasPerk(actor, BRING_IT_ALL_DOWN_ID)) {
    return null;
  }

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.BringItAllDownPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.BringItAllDownPickLabel')
    }</label><select name="effect">
      <option value="none">${game.i18n.localize('E20.BringItAllDownOptionNone')}</option>
      <option value="shiftUp">${game.i18n.localize('E20.BringItAllDownOptionShiftUp')}</option>
      <option value="radius">${game.i18n.localize('E20.BringItAllDownOptionRadius')}</option>
      <option value="damage">${game.i18n.localize('E20.BringItAllDownOptionDamage')}</option>
      <option value="armorPiercing">${game.i18n.localize('E20.BringItAllDownOptionArmorPiercing')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effect.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' && chosen != 'none' ? chosen : null;
}
