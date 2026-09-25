import { getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Expanded Mysticism (MLP CRB, Spirit of Magic Role, 9th level, p.95): "you can spend Mystical
 * Points to gain any of the following benefits, but each only once per scene: Fortify (spend 1
 * Mystical Point as a Free action to increase your Toughness or Evasion by 1 for the rest of the
 * scene), Heal (spend 1 Mystical Point per Health regained as a Standard action), Quicken (spend 1
 * Mystical Point as a Free action to double one of your Movements until the end of your turn)."
 *
 * RE-CATEGORIZED - the ledger's prior tag ("Spellcasting mastery/rank tracking") didn't match this
 * Perk's real RAW at all (that text describes a different Perk's own mechanic - Extensive
 * Research's spell-mastery tracking - and appears to have been copy-pasted onto the wrong entry).
 * Mystical Points is already a plain, generic `rolePoints` item (bonus.type: "none", a limited-use
 * pool) resolvable via the existing actor._getBaseRolePoints() lookup, exactly like Idea Points/
 * Terror Capacity/Grid Surges/Eltarian Tech before it - no new resource plumbing needed.
 *
 * Only the Heal option is built here. Unlike every prior "spend N of a resource for a fixed
 * benefit" Perk in this project, Heal's own spend amount is a genuine player choice (RAW: "1
 * Mystical Point PER Health regained") - the closest precedent is Powered Plating's own numeric
 * DialogV2 picker, capped here by whichever is smaller: the actor's remaining Mystical Points, or
 * their own missing Health (spending more than that would just waste points). Gated once per
 * scene via getUsesThisScene/markUsedThisScene, matching RAW's own "each only once per scene"
 * wording exactly.
 *
 * Fortify and Quicken built as same-day follow-ons (both once-per-scene, same shape as Heal):
 * - Fortify: "increase your Toughness or Evasion by 1 for the rest of the scene." A live,
 *   non-consumed read in dice.mjs's per-target checkEntries construction (the established
 *   "for the rest of the scene, no active clear hook" idiom already used for Hardened Armor's own
 *   resistance-after-hit half) - same shape as Powered Plating's Toughness bonus, just picking
 *   between Toughness/Evasion via a DialogV2 select instead of being fixed to one Defense.
 * - Quicken: "double one of your Movements until the end of your turn." Same on/off-flag-plus-
 *   turn-end-clear shape as Frictionless Movement (documents/actor.mjs#_prepareMovement +
 *   essence20.mjs's own combatTurn/combatRound hook, "the activating actor's own current turn"
 *   approximation already established there) - but scoped to ONE player-chosen Movement type
 *   (RAW: "one of your Movements") rather than Frictionless Movement's own "every type" reading.
 */
export const EXPANDED_MYSTICISM_ID = "Compendium.essence20.mlp_crb.Item.xL0lmmS7P046RNqO";
const HEAL_USES_THIS_SCENE_FLAG = 'expandedMysticismHealUsesThisScene';
const FORTIFY_USES_THIS_SCENE_FLAG = 'expandedMysticismFortifyUsesThisScene';
const FORTIFY_TYPE_FLAG = 'expandedMysticismFortifyType';
const QUICKEN_USES_THIS_SCENE_FLAG = 'expandedMysticismQuickenUsesThisScene';
const QUICKEN_TYPE_FLAG = 'expandedMysticismQuickenType';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseExpandedMysticismHeal(actor) {
  const mysticalPoints = actor._getBaseRolePoints?.();
  const hasPoints = !!mysticalPoints?.system.resource.value;
  const alreadyUsedThisScene = getUsesThisScene(actor, HEAL_USES_THIS_SCENE_FLAG) > 0;
  return hasPoints && !alreadyUsedThisScene;
}

/**
 * Prompts for how much Health to restore, capped by whichever is smaller: the actor's own
 * remaining Mystical Points, or their own missing Health.
 * @param {Number} maxAmount
 * @returns {Promise<Number|null>}
 */
async function pickExpandedMysticismHealAmount(maxAmount) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExpandedMysticismHealPickAmountTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExpandedMysticismHealPickAmountLabel')
    }</label><input type="number" name="amount" min="1" max="${maxAmount}" value="1" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => parseInt(button.form.elements.amount.value),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return Number.isInteger(chosen) && chosen > 0 ? Math.min(chosen, maxAmount) : null;
}

/**
 * Spends the chosen number of Mystical Points to regain that much Health, self-targeted.
 * @param {Actor} actor
 */
export async function activateExpandedMysticismHeal(actor) {
  if (!canUseExpandedMysticismHeal(actor)) {
    return;
  }

  const mysticalPoints = actor._getBaseRolePoints();
  const missingHealth = actor.system.health.max - actor.system.health.value;
  if (missingHealth <= 0) {
    ui.notifications.warn(game.i18n.localize('E20.ExpandedMysticismHealNoMissingHealth'));
    return;
  }

  const maxAmount = Math.min(mysticalPoints.system.resource.value, missingHealth);
  const amount = await pickExpandedMysticismHealAmount(maxAmount);
  if (!amount) {
    return;
  }

  await mysticalPoints.update({ 'system.resource.value': mysticalPoints.system.resource.value - amount });
  await actor.update({ 'system.health.value': actor.system.health.value + amount });
  await markUsedThisScene(actor, HEAL_USES_THIS_SCENE_FLAG);
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseExpandedMysticismFortify(actor) {
  const hasPoints = !!actor._getBaseRolePoints?.()?.system.resource.value;
  const alreadyUsedThisScene = getUsesThisScene(actor, FORTIFY_USES_THIS_SCENE_FLAG) > 0;
  return hasPoints && !alreadyUsedThisScene;
}

/**
 * Prompts for which Defense to Fortify - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill/pickHobbleCondition.
 * @returns {Promise<String|null>}
 */
async function pickExpandedMysticismFortifyDefense() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExpandedMysticismFortifyPickDefenseTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExpandedMysticismFortifyPickDefenseLabel')
    }</label><select name="defenseType">
      <option value="toughness">${game.i18n.localize('E20.DefenseToughness')}</option>
      <option value="evasion">${game.i18n.localize('E20.DefenseEvasion')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.defenseType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Spends 1 Mystical Point and banks the chosen Defense's own +1 for the rest of the scene.
 * @param {Actor} actor
 */
export async function activateExpandedMysticismFortify(actor) {
  if (!canUseExpandedMysticismFortify(actor)) {
    return;
  }

  const defenseType = await pickExpandedMysticismFortifyDefense();
  if (!defenseType) {
    return;
  }

  const mysticalPoints = actor._getBaseRolePoints();
  await mysticalPoints.update({ 'system.resource.value': mysticalPoints.system.resource.value - 1 });
  await actor.setFlag('essence20', FORTIFY_TYPE_FLAG, defenseType);
  await markUsedThisScene(actor, FORTIFY_USES_THIS_SCENE_FLAG);
}

/**
 * Live, non-consumed read for dice.mjs's per-target checkEntries construction - see this file's
 * own doc comment for why Fortify has no active end-of-scene clear.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}   1 if this actor Fortified this exact Defense, else 0.
 */
export function getExpandedMysticismFortifyBonus(actor, defenseType) {
  return actor?.getFlag?.('essence20', FORTIFY_TYPE_FLAG) == defenseType ? 1 : 0;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseExpandedMysticismQuicken(actor) {
  const hasPoints = !!actor._getBaseRolePoints?.()?.system.resource.value;
  const alreadyUsedThisScene = getUsesThisScene(actor, QUICKEN_USES_THIS_SCENE_FLAG) > 0;
  return hasPoints && !alreadyUsedThisScene;
}

/**
 * Prompts for which Movement type to double - same single-dropdown DialogV2 shape as
 * pickExpandedMysticismFortifyDefense above.
 * @returns {Promise<String|null>}
 */
async function pickExpandedMysticismQuickenMovementType() {
  const movementOptions = Object.keys(E20.movementTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.movementTypes[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExpandedMysticismQuickenPickMovementTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExpandedMysticismQuickenPickMovementLabel')
    }</label><select name="movementType">${movementOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.movementType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Spends 1 Mystical Point and activates the chosen Movement type's own double, until cleared at
 * the end of the activating actor's own turn (see deactivateExpandedMysticismQuickenAtTurnEnd).
 * @param {Actor} actor
 */
export async function activateExpandedMysticismQuicken(actor) {
  if (!canUseExpandedMysticismQuicken(actor)) {
    return;
  }

  const movementType = await pickExpandedMysticismQuickenMovementType();
  if (!movementType) {
    return;
  }

  const mysticalPoints = actor._getBaseRolePoints();
  await mysticalPoints.update({ 'system.resource.value': mysticalPoints.system.resource.value - 1 });
  await actor.setFlag('essence20', QUICKEN_TYPE_FLAG, movementType);
  await markUsedThisScene(actor, QUICKEN_USES_THIS_SCENE_FLAG);
}

/**
 * @param {Actor} actor
 * @param {String} movementType
 * @returns {Boolean}
 */
export function isExpandedMysticismQuickenActive(actor, movementType) {
  return actor?.getFlag?.('essence20', QUICKEN_TYPE_FLAG) == movementType;
}

/**
 * Clears the Quicken double at the end of the activating actor's own turn - same
 * end-of-turn-clear idiom as deactivateFrictionlessMovementAtTurnEnd.
 * @param {Actor} actor
 */
export async function deactivateExpandedMysticismQuickenAtTurnEnd(actor) {
  if (actor?.getFlag?.('essence20', QUICKEN_TYPE_FLAG)) {
    await actor.setFlag('essence20', QUICKEN_TYPE_FLAG, null);
  }
}

/**
 * Gates the sheet's single "Use" button - shown whenever at least one of the 3 benefits is
 * still usable this scene.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseExpandedMysticism(actor) {
  return canUseExpandedMysticismFortify(actor) || canUseExpandedMysticismHeal(actor)
    || canUseExpandedMysticismQuicken(actor);
}

/**
 * Prompts for which of the 3 benefits to use, listing only the ones still usable this scene - the
 * same dynamic-option-list idiom Eltarian Mettle's own Condition picker already established
 * (rather than a fixed option list, since each benefit independently drops off the list once its
 * own once-per-scene use is spent).
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
async function pickExpandedMysticismBenefit(actor) {
  const options = [];
  if (canUseExpandedMysticismFortify(actor)) {
    options.push(['fortify', game.i18n.localize('E20.ExpandedMysticismBenefitFortify')]);
  }

  if (canUseExpandedMysticismHeal(actor)) {
    options.push(['heal', game.i18n.localize('E20.ExpandedMysticismBenefitHeal')]);
  }

  if (canUseExpandedMysticismQuicken(actor)) {
    options.push(['quicken', game.i18n.localize('E20.ExpandedMysticismBenefitQuicken')]);
  }

  if (options.length == 1) {
    return options[0][0];
  }

  const benefitOptions = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExpandedMysticismPickBenefitTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExpandedMysticismPickBenefitLabel')
    }</label><select name="benefit">${benefitOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.benefit.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Dispatches to whichever benefit the player picks - see pickExpandedMysticismBenefit above.
 * @param {Actor} actor
 */
export async function activateExpandedMysticism(actor) {
  const benefit = await pickExpandedMysticismBenefit(actor);
  if (benefit == 'fortify') {
    await activateExpandedMysticismFortify(actor);
  } else if (benefit == 'heal') {
    await activateExpandedMysticismHeal(actor);
  } else if (benefit == 'quicken') {
    await activateExpandedMysticismQuicken(actor);
  }
}
