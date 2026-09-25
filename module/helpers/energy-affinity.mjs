import { getSceneEpoch } from "./scene-clock.mjs";
import { findPerk } from "./perks.mjs";
import { postPerkUseChatCard } from "./perks.mjs";

/**
 * Energy Affinity (Decepticon Directive, Elementalist Focus, 1st level, p.53-54): "You've focused
 * on one specific wavelength of energy. Choose one Element type from the following list: Acid,
 * Cold, Electric, Electromagnetic, Energy, Fire, Laser, and Sonic." The choice itself is a plain
 * choiceType:'elementDamageType' pick (system.choice), same shape as Adapted Wavelength/Ninja
 * Power - "Energy" (the generic, unscoped Element type) has no separate key of its own to choose,
 * same as every other elementDamageType-choiceType Perk (see E20.elementDamageTypes' own doc
 * comment for why the generic catch-all isn't offered).
 *
 * "By spending an Energon Point as a Free action, all your melee or ranged attacks (choose one)
 * inflict your chosen type of damage and gain the related trait (including any special
 * properties) for the remainder of the scene." This is the second, standalone mechanism this file
 * builds: a manual "Use" activation (helpers/banked-buffs.mjs#onPerkUse, the same click-to-trigger
 * idiom every other manually-activated Perk in this project already uses) that spends 1 Energon
 * Point and, for the rest of the current scene (helpers/scene-clock.mjs), overrides the damageType
 * of every attack of the chosen style (melee or ranged) to the actor's own Energy Affinity choice
 * - read back in dice.mjs's own overriddenDamageType chain, the same "a live Perk/Power-driven
 * damageType override checked at roll time" shape Void Warrior/Blazing Strikes/Cryogenic Touch/
 * Ninja Power already establish there. Only the damage TYPE itself is overridden; "and gains the
 * related trait (including any special properties)" is NOT built - RAW's own Element sub-types
 * each carry a different, unrelated bundle of real mechanical traits (Fire's ongoing burn, Acid's
 * corrosion, etc.), none of which are modeled as an attachable trait bundle anywhere in this
 * codebase (weapon traits are a static per-Item array, not something rolled attacks can pick up
 * live) - a documented, deliberate partial build, not a missed clause.
 */
export const ENERGY_AFFINITY_ID = "Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA";

const ENERGY_AFFINITY_ALTERED_FLAG = 'energyAffinityAltered';

/**
 * The style ('melee' or 'ranged') Energy Affinity's alteration currently applies to, or null if
 * it isn't active this scene (never activated, or activated in an earlier scene that has since
 * ended - see scene-clock.mjs's own epoch-based expiry).
 * @param {Actor} actor
 * @returns {String|null}
 */
export function getEnergyAffinityAlteredStyle(actor) {
  const flag = actor?.getFlag?.('essence20', ENERGY_AFFINITY_ALTERED_FLAG);
  if (!flag || flag.epoch !== getSceneEpoch()) {
    return null;
  }

  return flag.style ?? null;
}

/**
 * Activates Energy Affinity's alteration for the rest of the current scene, scoped to the chosen
 * style, and spends the Energon Point it costs.
 * @param {Actor} actor
 * @param {String} style   'melee' or 'ranged'.
 */
export async function activateEnergyAffinity(actor, style) {
  if ((actor.system.energon?.normal?.value ?? 0) < 1) {
    ui.notifications.warn(game.i18n.localize('E20.EnergyAffinityNoEnergon'));
    return;
  }

  await actor.setFlag('essence20', ENERGY_AFFINITY_ALTERED_FLAG, { epoch: getSceneEpoch(), style });
  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });

  const choice = findPerk(actor, ENERGY_AFFINITY_ID)?.system.choice;
  const damageTypeLabel = choice ? game.i18n.localize(`E20.Damage${choice.capitalize()}`) : '';
  postPerkUseChatCard(actor, game.i18n.format('E20.EnergyAffinityActivated', {
    name: actor.name,
    style: game.i18n.localize(style == 'melee' ? 'E20.EnergyAffinityStyleMelee' : 'E20.EnergyAffinityStyleRanged'),
    damageType: damageTypeLabel,
  }));
}

/**
 * Prompts for which style (melee or ranged) to alter, then activates it - the "Use" click handler
 * for Energy Affinity, called from helpers/banked-buffs.mjs#onPerkUse.
 * @param {Actor} actor
 */
export async function onEnergyAffinityUse(actor) {
  const style = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EnergyAffinityTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EnergyAffinityPickStyle')
    }</label><select name="style">
      <option value="melee">${game.i18n.localize('E20.EnergyAffinityStyleMelee')}</option>
      <option value="ranged">${game.i18n.localize('E20.EnergyAffinityStyleRanged')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.style.value },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!style || style == 'cancel') {
    return;
  }

  await activateEnergyAffinity(actor, style);
}
