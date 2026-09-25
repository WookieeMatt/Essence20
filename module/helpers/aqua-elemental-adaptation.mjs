import { E20 } from "./config.mjs";
import { pickSelfOrTeamMember } from "./team-member-picker.mjs";

export const AQUA_ELEMENTAL_ADAPTATION_ID = "Compendium.essence20.beneath_the_helmet.Item.06JVZqlBDXIfPKw8";
const AQUA_ELEMENTAL_ADAPTATION_FLAG = 'aquaElementalAdaptations';

/**
 * Elemental Adaptation (Beneath the Helmet, Aqua Ranger, Grid Science III choice, p.42): "Choose
 * an element. You or one member of your Power Ranger team ignores the element trait when they
 * take damage. For instance, a character that would take extra damage from a Fire element attack
 * doesn't [take that extra damage] if they have Elemental Adaptation: Fire. This Grid Science may
 * be chosen multiple times, once per team member. Each selection may choose the same or a
 * different element." Not to be confused with Across the Stars' own same-named Grid Power
 * (helpers/grid-elemental-adaptation.mjs) - an unrelated reactive-Resistance-after-a-hit mechanic;
 * this one is a permanent, always-on immunity to a SPECIFIC element's own core damage-type rule.
 *
 * "Ignores the element trait" only has something concrete to negate for Acid (+1 damage vs.
 * Toughness) and Fire (+1 damage vs. Evasion) - this codebase's own two damage types with a
 * target-defense-dependent bonus (dice.mjs's own "Acid / Fire (Damage Types)" core rule). Electric
 * damage's own core rule (+1 shiftUp on the ATTACKER's roll) has no target-side component to
 * ignore, and Cold/Sonic/Laser/EMP have no automatic bonus rule coded at all - so choosing one of
 * those 4 elements is a real, RAW-legal pick that's simply a no-op in this implementation, the
 * same "the choice still exists even when unautomated" idiom this project already accepts
 * elsewhere (offered in the picker regardless, not hidden).
 *
 * Uses the same self-or-teammate build-time picker Wind Whispers/Survival Training's own ally
 * cases already established (helpers/team-member-picker.mjs) - the choice is stored as a flag
 * ARRAY on the TARGET actor (not the caster's own Perk item), since each instance of this Perk can
 * target a different teammate and there's no single "which actor holds this" relationship once a
 * teammate is chosen.
 */
export async function grantAquaElementalAdaptation(caster) {
  const damageType = await pickAquaElementalAdaptationDamageType();
  if (!damageType) {
    return;
  }

  const target = await pickSelfOrTeamMember(caster, 'Elemental Adaptation');
  if (!target) {
    return;
  }

  const current = target.getFlag?.('essence20', AQUA_ELEMENTAL_ADAPTATION_FLAG) ?? [];
  await target.setFlag('essence20', AQUA_ELEMENTAL_ADAPTATION_FLAG, [...current, damageType]);
}

export async function pickAquaElementalAdaptationDamageType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: 'Elemental Adaptation' },
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
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasAquaElementalAdaptation(actor, damageType) {
  const adaptations = actor?.getFlag?.('essence20', AQUA_ELEMENTAL_ADAPTATION_FLAG);
  return Array.isArray(adaptations) && adaptations.includes(damageType);
}
