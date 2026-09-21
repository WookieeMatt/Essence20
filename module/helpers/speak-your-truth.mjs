import { E20 } from "./config.mjs";

/**
 * Speak Your Truth (MLP CRB, Spirit of Honesty, p.78): "Choose Strength, Speed, or Smarts.
 * Persuasion Skill Tests can now also draw from that Essence." The compendium item ships all 3
 * candidate essence-widening effects (system.skills.persuasion.essences.<essence>, the same
 * multi-Essence mechanism Terrifying Presence's own single always-on grant already established -
 * see helpers/skill-picker.mjs#getSkillEssences) `disabled: true`, since only ONE should ever be
 * live per instance - unlike every other choiceType picker in this project (which stores a
 * `system.choice` string and checks it in code), this Perk's own mechanical effect IS a real
 * compendium Active Effect already sitting on the item, so the "choice" is simply toggling ONE of
 * the 3 on - the same native `effect.update({disabled: false})` a player could otherwise click
 * themselves in the Effects tab, just driven by a picker at Perk-drop time instead of asking them
 * to find the right one manually.
 */
export const SPEAK_YOUR_TRUTH_ID = "Compendium.essence20.mlp_crb.Item.ki9HVmle77qJ5Yo8";

const CHOOSABLE_ESSENCES = ['strength', 'speed', 'smarts'];

/**
 * Prompts for which Essence to widen Persuasion to - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill/pickHobbleCondition.
 * @returns {Promise<String|null>}
 */
export async function pickSpeakYourTruthEssence() {
  const essenceOptions = CHOOSABLE_ESSENCES
    .map(key => `<option value="${key}">${game.i18n.localize(E20.essences[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SpeakYourTruthPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SpeakYourTruthPickLabel')
    }</label><select name="essence">${essenceOptions}</select></div>`,
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

/**
 * Prompts for an Essence, then enables the one matching bundled Active Effect on this Perk
 * instance (leaving the other two disabled forever on it).
 * @param {Item} perk   The actor-embedded Speak Your Truth instance just dropped.
 */
export async function grantSpeakYourTruthEssence(perk) {
  const chosen = await pickSpeakYourTruthEssence();
  if (!chosen) {
    return;
  }

  const effect = perk.effects.find(e =>
    e.changes.some(c => c.key == `system.skills.persuasion.essences.${chosen}`));
  if (effect) {
    await effect.update({ disabled: false });
  }
}
