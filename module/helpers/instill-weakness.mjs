import { E20 } from "./config.mjs";

/**
 * Instill Weakness (Decepticon Directive, Raider, 10th level, p.41): "As a Standard action while
 * wielding this tool, you can target a creature within your line of sight and attempt a
 * Technology Skill Test against their Evasion Defense. On a success, spend 1 Energon Point and
 * choose a type of damage. All attacks or actions against the target that deal that type of
 * damage gain Edge for the remainder of the scene."
 *
 * Same "plain Skill Test vs. a manually-picked Defense, only the checkbox lives here" shape as
 * Menacing Glare's own doc comment (the player picks Evasion from the existing Defense dropdown,
 * same as any other Skill Test vs Defense) - the "unique piece of equipment" grant isn't modeled
 * (no item-grant mechanism exists for a GM-flavored custom tool, the same confirmed gap Zord
 * Feature/Unique Strike's own doc comments already establish), so this is offered unconditionally
 * on any Technology roll while the Perk is held and Energon is available.
 *
 * The reciprocal "ANY attacker gains Edge against this damage type" benefit is the same shape as
 * Spot's own target-side flag (dice.mjs's own spottedTarget check) - a plain getFlag/addSource
 * check in the per-target automatic combat modifiers block - except it isn't single-use and needs
 * a scene boundary, so it borrows Distracting Offer's own {sceneId, ...} shape (helpers/
 * distracting-offer.mjs) instead of a one-shot consumed flag.
 */
export const INSTILL_WEAKNESS_ID = "Compendium.essence20.decepticon_directive.Item.o00ALKAEGOlbWXzB";

const FLAG_KEY = 'instillWeaknessState';

/**
 * Prompts for which damage type to key the Edge grant to - a plain single-select DialogV2 picker,
 * same shape as pickMenacingGlareEffect/pickHobbleCondition.
 * @returns {Promise<String|null>}   One of E20.damageTypes' own keys, or null if cancelled.
 */
export async function pickInstillWeaknessDamageType() {
  const options = Object.keys(E20.damageTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.InstillWeaknessPickDamageTypeTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.InstillWeaknessPickDamageTypeLabel')
    }</label><select name="damageType">${options}</select></div>`,
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
 * Spends 1 Energon Point and, once a damage type is chosen, marks the target - called once an
 * Instill Weakness attempt has actually succeeded.
 * @param {Actor} actor   Whoever succeeded.
 * @param {Actor} target   Who they targeted.
 */
export async function applyInstillWeakness(actor, target) {
  if ((actor.system.energon?.normal?.value ?? 0) < 1) {
    return;
  }

  const damageType = await pickInstillWeaknessDamageType();
  if (!damageType) {
    return;
  }

  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await target.setFlag('essence20', FLAG_KEY, { sceneId: game.scenes?.current?.id ?? null, damageType });
}

/**
 * The damage type Instill Weakness currently has marked on this target, if any, scoped to the
 * scene it was set in - see FLAG_KEY's own comment above for why this needs a scene boundary
 * rather than a one-shot consumed flag.
 * @param {Actor} target
 * @returns {String|null}
 */
export function getInstillWeaknessDamageType(target) {
  const state = target?.getFlag?.('essence20', FLAG_KEY);
  const currentSceneId = game.scenes?.current?.id ?? null;
  return state && state.sceneId === currentSceneId ? state.damageType : null;
}
