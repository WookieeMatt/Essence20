/**
 * Weapon Conversion (Decepticon Directive Raider, Acquisitions Expert Focus, 10th level, p.63):
 * "Smaller weapons are easier for you to hide, access, and wield than heavier ones. At 10th
 * level, you can convert a two-handed ranged weapon to operate as a one-handed weapon in a
 * process that takes 10 minutes. The new one-handed weapon gains the Inaccurate (↓1) trait and
 * halves its previous range values."
 *
 * An earlier pass on this book left this "deliberately not attempted," reasoning that the weapon
 * item schema had no numeric "handedness" field to flip. Re-verified directly against the real
 * schema before building, rather than trusting that note at face value, and found it doesn't
 * hold up: `weaponEffect.system.numHands` IS exactly that field - a plain Integer already used
 * generically for every weapon's own printed "Hands: 1/2/0" stat (see data/item/weapon-effect.mjs)
 * - and `weaponEffect.system.shiftDown` is the SAME already-wired mechanism an existing weapon's
 * own inherent downshift (e.g. Chassis-Cracker/Multiple Missile System's own printed "Inaccurate
 * (↓1)") already relies on: `documents/item.mjs`'s own weaponEffect `roll()` method folds
 * `this.system.shiftDown` directly into the roll's dataset unconditionally, so no new mechanical
 * hook was needed for "gains the Inaccurate trait" - only its DISPLAY label (the parent Weapon
 * item's own `system.traits` array, a separate Item from the weaponEffect and with no bearing on
 * the roll itself) needed a one-line push for the sheet to correctly show the weapon as Inaccurate.
 *
 * A one-time, permanent `item.update()` (not a toggle) - matches RAW's own "a process that takes
 * 10 minutes," an out-of-combat preparation rather than something to switch back off. Only
 * ranged, two-handed weaponEffects are offered; converting one sets its own numHands to 1, so it
 * naturally drops out of the eligible list afterward (no separate "already converted" flag
 * needed). If the actor holds more than one eligible weapon, a picker lets them choose which -
 * the same single-dropdown DialogV2 shape as pickAgelessKnowledgeSkill/pickDefenseType. "Halves
 * its previous range values" is read as floor(range/2) for both range.value and range.long, this
 * project's own standard "halve, round down" default absent a stated rounding rule.
 */

/**
 * The actor's own ranged, two-handed weaponEffect items - the only ones eligible for conversion.
 * @param {Actor} actor
 * @returns {Item[]}
 */
function getConvertibleWeaponEffects(actor) {
  return actor.items.filter(item => item.type == 'weaponEffect'
    && item.system.numHands == 2
    && item.system.classification.style != 'melee');
}

/**
 * Whether the actor holds at least one weapon eligible for Weapon Conversion.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasConvertibleWeapon(actor) {
  return getConvertibleWeaponEffects(actor).length > 0;
}

/**
 * Prompts for which of several eligible weapons to convert.
 * @param {Item[]} candidates
 * @returns {Promise<String|null>}   The chosen weaponEffect's own id, null if cancelled.
 */
async function pickWeaponToConvert(candidates) {
  const options = candidates.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.WeaponConversionPickWeaponTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.WeaponConversionPickWeaponLabel')
    }</label><select name="weapon">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.weapon.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Converts a two-handed ranged weapon (the actor's only eligible one, or whichever the player
 * picks if there's more than one) into a one-handed weapon: numHands to 1, +1 shiftDown (the new
 * Inaccurate trait's own downshift), and both range values halved (floored). Also labels the
 * parent Weapon item itself with the 'inaccurate' trait, for display correctness.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False if there's nothing eligible, or the picker was cancelled.
 */
export async function convertWeapon(actor) {
  const candidates = getConvertibleWeaponEffects(actor);
  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize('E20.WeaponConversionNoEligibleWeapon'));
    return false;
  }

  let weaponEffect = candidates[0];
  if (candidates.length > 1) {
    const chosenId = await pickWeaponToConvert(candidates);
    if (!chosenId) {
      return false;
    }

    weaponEffect = candidates.find(item => item.id == chosenId);
  }

  const halve = value => (value == null ? value : Math.floor(value / 2));
  await weaponEffect.update({
    'system.numHands': 1,
    'system.shiftDown': weaponEffect.system.shiftDown + 1,
    'system.range.value': halve(weaponEffect.system.range.value),
    'system.range.long': halve(weaponEffect.system.range.long),
  });

  const parentId = weaponEffect.flags?.essence20?.parentId;
  const weapon = parentId ? actor.items.get(parentId) : null;
  if (weapon && !weapon.system.traits.includes('inaccurate')) {
    await weapon.update({ 'system.traits': [...weapon.system.traits, 'inaccurate'] });
  }

  return true;
}
