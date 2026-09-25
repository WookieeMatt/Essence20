/**
 * Favorite Weapon (Decepticon Directive, Triggerbot Focus, 1st level, p.49): "Choose any two-
 * handed, non-Integrated, Targeting-based weapon without an area of effect to be your favorite
 * weapon. When making attacks with your favorite weapon, you always gain ↑1."
 *
 * "Which owned weapon" is a per-actor, dynamically-owned list that doesn't exist until the
 * character actually owns an eligible weapon - the exact same shape Mode Attachment's own Alt
 * Mode picker already establishes (helpers/mode-attachment.mjs's own doc comment) - so this is
 * its own small "configure" Use-button DialogV2.wait picker, storing the chosen weaponEffect's
 * parent weapon Item id directly in this Perk's own system.choice (reconfigurable any time, same
 * "offer the choice, don't gate WHEN it's set" idiom Mode Attachment/Chosen Specialization already
 * accept). Eligibility is read off the weaponEffect (classification.skill == 'targeting',
 * numHands == 2, no AoE shape - see module/data/item/weapon-effect.mjs) and its parent weapon
 * (classification.size != 'integrated' - module/data/item/weapon.mjs) since a weapon's own
 * printed traits live on the weaponEffect, not the equippable container itself (the same split
 * helpers/weapon-conversion.mjs's own getConvertibleWeaponEffects already reads through).
 *
 * The always-on ↑1 is consumed in dice.mjs's own updatedShiftDataset construction, matching a
 * rolled weaponEffect's parent weapon id against the stored choice (_getParentWeapon, the same
 * lookup Empty the Mag/Augment Power Weapon already use). Down the Barrel (this same Focus, 3rd
 * level, p.49) reads the stored choice back via getFavoriteWeaponItem() below for its own
 * "wielding your favorite weapon" Edge - see helpers/down-the-barrel... consumed directly in
 * dice.mjs instead, since it's a one-line self-status check with no banked state of its own.
 */
export const FAVORITE_WEAPON_ID = "Compendium.essence20.decepticon_directive.Item.emaXxo2XzoHMoNCe";

/**
 * The actor's own weaponEffect items eligible to be designated Favorite Weapon - two-handed,
 * Targeting-based, no Area of Effect, and whose parent weapon isn't Integrated-sized.
 * @param {Actor} actor
 * @returns {Array<{weapon: Item, weaponEffect: Item}>}
 */
function getEligibleFavoriteWeapons(actor) {
  const results = [];
  for (const weaponEffect of actor.items?.documentsByType?.weaponEffect ?? []) {
    if (weaponEffect.system.numHands != 2 || weaponEffect.system.classification?.skill != 'targeting'
      || weaponEffect.system.shape) {
      continue;
    }

    const parentId = weaponEffect.flags?.essence20?.parentId;
    const weapon = parentId ? actor.items.get(parentId) : null;
    if (weapon?.type == 'weapon' && weapon.system.classification?.size != 'integrated') {
      results.push({ weapon, weaponEffect });
    }
  }

  return results;
}

/**
 * Prompts for which eligible weapon to designate as this actor's favorite - null (no dialog) if
 * there isn't at least one to choose from.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The chosen weapon Item's own id, null if cancelled/ineligible.
 */
export async function pickFavoriteWeapon(actor) {
  const candidates = getEligibleFavoriteWeapons(actor);
  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize('E20.FavoriteWeaponNoneEligible'));
    return null;
  }

  const options = candidates
    .map(({ weapon }) => `<option value="${weapon.id}">${weapon.name}</option>`)
    .join('');
  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.FavoriteWeaponPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.FavoriteWeaponPickLabel')
    }</label><select name="weapon">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.weapon.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel', callback: () => null },
    ],
  });
}

/**
 * The actor's own designated Favorite Weapon Item, if any - read directly off the Perk's own
 * system.choice (see FAVORITE_WEAPON_ID's own comment above), null if never configured or the
 * stored id no longer resolves to an owned Item (e.g. the weapon was since deleted).
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function getFavoriteWeaponItem(actor) {
  const perk = actor?.items?.find(item => item.type == 'perk'
    && (item.flags?.core?.sourceId == FAVORITE_WEAPON_ID || item._stats?.compendiumSource == FAVORITE_WEAPON_ID));
  const choice = perk?.system.choice;
  return choice ? actor.items.get(choice) ?? null : null;
}
