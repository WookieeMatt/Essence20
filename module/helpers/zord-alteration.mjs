import { E20 } from "./config.mjs";
import { getOwnedZord } from "./combat.mjs";

export const ZORD_ALTERATION_ID = "Compendium.essence20.across_the_stars.Item.j7VFi84N56KqKsFe";

/**
 * Zord Alterations (Across the Stars, General Perk, p.74): "Prerequisite: Zord Role Perk and at
 * least one instance of the Zord Feature Role Perk... Each time you choose this Perk, select one
 * of the following Zord alterations:
 * - Add 2 to the Strength or Speed Essence of your Zord, or 1 to both, choosing an equal number
 *   of Skill Ranks to increase accordingly.
 * - Increase the Zord's Size Class by one category and gain +1 Health.
 * - Decrease the Zord's Size Class by one category (minimum of Huge), and add 10 feet to all its
 *   Movement types.
 * - Grant the Zord Resistance to one damage Element.
 * - Add the following Critical Effect to one of the Zord's Attacks: 'Deal 1 extra damage.' When
 *   you choose this alteration, pick the damage type for this Critical Effect."
 *
 * This is a permanent, cross-actor grant chosen once per Perk instance - the pilot holds the
 * (repeatable, `hasChoice`-free) Perk item, but the effect lands on their own linked Zord
 * (getOwnedZord, the same "owns a Zord" lookup Torozord Feature's own grant already established -
 * distinct from getVehicleDriver's "who's currently seated in it"). Unlike every existing
 * `choiceType` Perk (which records its own choice on the SAME item via system.choice), there's no
 * cross-actor equivalent of that mechanism - see the Ledger's own "Cross-actor permanent grant
 * chosen at build time" gap - so this is dispatched directly from perk-handler.mjs#setPerkValues
 * at DROP time instead (the same inline-grant shape ZORD_PERK_ID/TOROZORD_ID already use), prompting
 * immediately rather than needing a separate "Use" button or a later-consumed flag.
 *
 * Built: both Essence-increase splits (the Skill Ranks half is NOT applied - RAW lets the player
 * freely distribute that many Ranks across any Skills, a distribution choice this project already
 * leaves manual for comparably free-form clauses, e.g. Warrior Mode's unapplied Towering Size),
 * both Size Class alterations (+1 Health / +10ft to every Movement type respectively), and the
 * Resistance grant (scoped to the same 7 concrete Element sub-types E20.elementDamageTypes already
 * curates, matching Adapted Wavelength's own identical RAW wording "a single type of Element
 * damage"). NOT built: the Critical Effect alteration - unlike Chrono Breaker's own criticalOptions
 * hook (which only ever stacks a weapon's PRE-EXISTING, printed Alternate Effects on a Critical
 * Success), this is a wholly new always-on "this specific Attack now also deals +1 damage of a
 * chosen type when it crits" effect requiring its own new hook plus a "which of the Zord's own
 * Attack items" picker - not offered in this picker at all (the "don't offer a choice with nothing
 * behind it" idiom Grid Surge's own 4th option already established), flagged as a gap rather than
 * silently dropped.
 */
export async function pickZordAlterationOption() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ZordAlterationPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ZordAlterationPickLabel')
    }</label><select name="option">
      <option value="essenceStrength">${game.i18n.localize('E20.ZordAlterationEssenceStrength')}</option>
      <option value="essenceSpeed">${game.i18n.localize('E20.ZordAlterationEssenceSpeed')}</option>
      <option value="essenceBoth">${game.i18n.localize('E20.ZordAlterationEssenceBoth')}</option>
      <option value="sizeIncrease">${game.i18n.localize('E20.ZordAlterationSizeIncrease')}</option>
      <option value="sizeDecrease">${game.i18n.localize('E20.ZordAlterationSizeDecrease')}</option>
      <option value="resistance">${game.i18n.localize('E20.ZordAlterationResistance')}</option>
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

export async function pickZordAlterationResistanceType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SelectElementDamageType') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SelectElementDamageType')
    }</label><select name="damageType">${
      Object.keys(E20.elementDamageTypes).map(damageType =>
        `<option value="${damageType}">${game.i18n.localize(E20.elementDamageTypes[damageType])}</option>`).join('')
    }</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.damageType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * @param {Actor} pilotActor
 */
export async function applyZordAlteration(pilotActor) {
  const zord = getOwnedZord(pilotActor);
  if (!zord) {
    ui.notifications.warn(game.i18n.localize('E20.ZordAlterationNoZord'));
    return;
  }

  const option = await pickZordAlterationOption();
  if (!option) {
    return;
  }

  if (option == 'essenceStrength') {
    await zord.update({ 'system.essences.strength.value': zord.system.essences.strength.value + 2 });
  } else if (option == 'essenceSpeed') {
    await zord.update({ 'system.essences.speed.value': zord.system.essences.speed.value + 2 });
  } else if (option == 'essenceBoth') {
    await zord.update({
      'system.essences.strength.value': zord.system.essences.strength.value + 1,
      'system.essences.speed.value': zord.system.essences.speed.value + 1,
    });
  } else if (option == 'sizeIncrease') {
    const sizeOrder = Object.keys(E20.actorSizes);
    const newIndex = Math.min(sizeOrder.length - 1, sizeOrder.indexOf(zord.system.size) + 1);
    await zord.update({
      'system.size': sizeOrder[newIndex],
      'system.health.max': zord.system.health.max + 1,
      'system.health.value': zord.system.health.value + 1,
    });
  } else if (option == 'sizeDecrease') {
    const sizeOrder = Object.keys(E20.actorSizes);
    const minIndex = sizeOrder.indexOf('huge');
    const newIndex = Math.max(minIndex, sizeOrder.indexOf(zord.system.size) - 1);
    await zord.update({
      'system.size': sizeOrder[newIndex],
      'system.movement.aerial.base': zord.system.movement.aerial.base + 10,
      'system.movement.climb.base': zord.system.movement.climb.base + 10,
      'system.movement.ground.base': zord.system.movement.ground.base + 10,
      'system.movement.swim.base': zord.system.movement.swim.base + 10,
    });
  } else if (option == 'resistance') {
    const damageType = await pickZordAlterationResistanceType();
    if (!damageType) {
      return;
    }

    await zord.update({ [`system.resistances.${damageType}`]: true });
  }
}
