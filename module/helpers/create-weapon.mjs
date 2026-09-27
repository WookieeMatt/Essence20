import { grantIntegratedWeapon } from "../sheet-handlers/perk-handler.mjs";

/**
 * Create Weapon (Quartermaster's Guide to Gear, Grid Power, Standard availability): "The nanomites
 * within your body can turn your arm into a weapon, enabling you to produce thick knuckles or short
 * blades that protrude from your hand or forearm. When activated, you may choose whether it
 * generates a short blade or short bludgeon. The weapon may not be removed from your body and lasts
 * for 1 scene, after which the weapon dissolves."
 *
 * RECLASSIFIED 2026-09-15 out of a five-item "item-grant mechanism" cluster - and the only one of
 * the five that really was blocked on that, the other four having been mislabelled (see the
 * ledger). Nothing new was needed by the time it came up: perk-handler.mjs already grants a weapon
 * by uuid, and - crucially - only started bringing that weapon's own weaponEffects along earlier
 * this same day. Without that fix this Power would have grafted an arm-blade with no attack on it.
 *
 * RAW's two forms map exactly onto two weapons already in the packs rather than anything new:
 * GI Joe CRB's Close Combat Blade and Close Combat Bludgeoning, both Standard availability, which
 * is also this Power's own.
 *
 * "Lasts for 1 scene, after which the weapon dissolves" is NOT enforced - the weapon is granted
 * permanently and the table removes it, the same duration approximation this project applies to
 * every other "for 1 scene" clause (Hardened Armor's Resistance, Grid Surge's Temporary Construct).
 * Re-activating is harmlessly idempotent: grantIntegratedWeapon already no-ops when the actor
 * holds that weapon, so a second scene's use of the same form grants nothing twice, while
 * switching forms genuinely adds the other one.
 */
export const CREATE_WEAPON_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Qb0LifFSyfOCFIVd";

const CLOSE_COMBAT_BLADE_ID = "Compendium.essence20.gi_joe_crb.Item.8lNIijY5XompKHH7";
const CLOSE_COMBAT_BLUDGEONING_ID = "Compendium.essence20.gi_joe_crb.Item.ZNokHTRBa5aindap";

export const CREATE_WEAPON_FORMS = {
  blade: CLOSE_COMBAT_BLADE_ID,
  bludgeon: CLOSE_COMBAT_BLUDGEONING_ID,
};

/**
 * Asks which form to grow - the same single-select DialogV2 shape as pickHobbleCondition and
 * pickAgelessKnowledgeSkill. Asked at activation time rather than recorded once, because RAW
 * chooses per use ("when activated, you may choose").
 * @returns {Promise<String|null>}   'blade', 'bludgeon', or null if cancelled.
 */
export async function pickCreateWeaponForm() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.CreateWeaponPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.CreateWeaponPickLabel')
    }</label><select name="form">`
      + `<option value="blade">${game.i18n.localize('E20.CreateWeaponFormBlade')}</option>`
      + `<option value="bludgeon">${game.i18n.localize('E20.CreateWeaponFormBludgeon')}</option>`
      + `</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.form.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Grows the chosen weapon out of the actor's own arm.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The form actually grown, or null if the pick was cancelled.
 */
export async function activateCreateWeapon(actor) {
  const form = await pickCreateWeaponForm();
  const weaponId = CREATE_WEAPON_FORMS[form];
  if (!weaponId) {
    return null;
  }

  await grantIntegratedWeapon(actor, weaponId);
  return form;
}
