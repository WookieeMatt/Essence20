/**
 * Personal Heirloom (A Jump Through Time, General Perk, p.55): "You may choose any piece of
 * standard equipment or a non-Power weapon as your Heirloom. When making Skill Tests that utilize
 * the item, you gain [+1]."
 *
 * RE-CATEGORIZED - previously bucketed with Inheritance's own "item-grant mechanism" gap, but
 * this Perk grants no item at all - it designates one of the actor's OWN ALREADY-OWNED items as
 * special, the same "flag a specific thing, read it back later" idiom Mark Target/Fight Me! already
 * establish, just applied to an Item instead of a token/actor.
 *
 * Scoped to the weapon half only. A weaponEffect roll's own parent weapon (via
 * dice.mjs#_getParentWeapon) is the only case this codebase can actually tell a Skill Test
 * "utilized" a specific owned item - no roll anywhere references a non-weapon "piece of standard
 * equipment" at all, so there's no hook to check the equipment half against. Matched by the
 * weapon's own LOCAL item id (actor.items.get's own id), not a compendium sourceId - this is the
 * first Perk in this project that needs to identify one SPECIFIC owned item instance rather than
 * any copy of a named weapon, since an actor could plausibly own two of the same weapon and only
 * one is the Heirloom.
 */
export const PERSONAL_HEIRLOOM_ID = "Compendium.essence20.jump_through_time.Item.LQGOwXCGvKlL4pzl";
const PERSONAL_HEIRLOOM_FLAG = 'personalHeirloomItemId';

/**
 * @param {Actor} actor
 * @returns {Item[]}   The actor's own non-Power-weapon weapon items - the only eligible,
 *   mechanically-checkable Heirloom candidates.
 */
function getEligibleHeirloomWeapons(actor) {
  return actor.items.filter(item => item.type == 'weapon' && !item.system.traits?.includes('powerWeapon'));
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canDesignateHeirloom(actor) {
  return getEligibleHeirloomWeapons(actor).length > 0;
}

/**
 * Prompts for which owned weapon to designate as the Heirloom - same single-dropdown DialogV2
 * shape as pickAgelessKnowledgeSkill, just listing owned Items instead of a fixed config list.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The chosen weapon's own local item id, or null if cancelled.
 */
async function pickHeirloomWeapon(actor) {
  const weapons = getEligibleHeirloomWeapons(actor);
  const weaponOptions = weapons.map(weapon => `<option value="${weapon.id}">${weapon.name}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PersonalHeirloomPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PersonalHeirloomPickLabel')
    }</label><select name="weaponId">${weaponOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.weaponId.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for and banks which owned weapon is the actor's Heirloom - re-triggerable to change the
 * designation later, the same "re-click to re-mark" idiom Mark Target/Fight Me! already use.
 * @param {Actor} actor
 */
export async function activateDesignateHeirloom(actor) {
  if (!canDesignateHeirloom(actor)) {
    return;
  }

  const weaponId = await pickHeirloomWeapon(actor);
  if (!weaponId) {
    return;
  }

  await actor.setFlag('essence20', PERSONAL_HEIRLOOM_FLAG, weaponId);
}

/**
 * Live, non-consumed read for dice.mjs's own self-status shiftUp computation.
 * @param {Actor} actor
 * @param {Item} weapon   The rolled weaponEffect's own parent weapon, if any.
 * @returns {Number}   1 if this is the actor's designated Heirloom, else 0.
 */
export function getPersonalHeirloomBonus(actor, weapon) {
  return weapon?.id && actor?.getFlag?.('essence20', PERSONAL_HEIRLOOM_FLAG) == weapon.id ? 1 : 0;
}
