/**
 * Wild Tales (MLP Adventurer Influence, p.42): "Once per scene, when you tell a short story about
 * your experiences, you gain Edge on a Smarts or Social Skill Test." The player picks which of
 * the two Essences the Edge applies to at USE time (same single-select DialogV2 shape as
 * pickHobbleCondition/pickAgelessKnowledgeSkill), then it's banked scoped to that Essence -
 * dice.mjs#_getAutomaticCombatModifiers reads it back via getPendingBonus and checks
 * rolledEssence against the banked value, the same "check inline, no config-table field" idiom
 * Inner Magic's own Spellcasting-scoped Edge already uses.
 */
export const PENDING_WILD_TALES_FLAG_KEY = 'pendingWildTales';

/**
 * Prompts for which of the 2 named Essences to apply Wild Tales' Edge to.
 * @returns {Promise<String|null>}   'smarts' or 'social', or null if cancelled.
 */
export async function pickWildTalesEssence() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.WildTalesPickEssenceTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.WildTalesPickEssenceLabel')
    }</label><select name="essence">
      <option value="smarts">${game.i18n.localize('E20.EssenceSmarts')}</option>
      <option value="social">${game.i18n.localize('E20.EssenceSocial')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.essence.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}
