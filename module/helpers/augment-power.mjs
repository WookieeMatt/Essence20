import { bankPendingBonus, hasUsedThisEncounter, hasUsedThisTurn, markUsedThisEncounter, markUsedThisTurn, postPerkUseChatCard } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { pickAllyTargets } from "./banked-buffs.mjs";

/**
 * Augment Power (Transformers CRB, Scientist Role, 7th level, p.80): "once per turn, you can give
 * an ally ↑1 on a Skill Test as a Free action. Once per combat, you can give an ally ↑2 on a Skill
 * Test as a Free action." Two independent grants (a per-TURN ↑1 and a separate per-COMBAT ↑2), not
 * an either/or upgrade - needed its own file, the same reason Dig Deep (PR CRB) did, because
 * tracking two independent gates unlocking two different grant values on the SAME "Use" button
 * needs a real benefit picker (Expanded Mysticism's own multi-option idiom), which the generic
 * single-config-per-button BANKABLE_PERKS table (banked-buffs.mjs) can't express.
 */
export const AUGMENT_POWER_ID = "Compendium.essence20.tf_crb.Item.tByP34McuTkaTQWZ";
const AUGMENT_POWER_TURN_FLAG = 'augmentPowerUsedThisTurn';
const AUGMENT_POWER_COMBAT_FLAG = 'augmentPowerUsedThisCombat';
const PENDING_FLAG = 'pendingAugmentPower';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseAugmentPower(actor) {
  return !hasUsedThisTurn(actor, AUGMENT_POWER_TURN_FLAG) || !hasUsedThisEncounter(actor, AUGMENT_POWER_COMBAT_FLAG);
}

/**
 * Prompts for which of the 2 grants to use, listing only the ones still usable - same dynamic-
 * option-list idiom Dig Deep (PR CRB)'s own benefit picker already established.
 * @param {Actor} actor
 * @returns {Promise<Number|null>}   The shiftUp amount to grant (1 or 2), or null if cancelled.
 */
async function pickAugmentPowerShiftUp(actor) {
  const options = [];
  if (!hasUsedThisTurn(actor, AUGMENT_POWER_TURN_FLAG)) {
    options.push([1, game.i18n.localize('E20.AugmentPowerBenefitTurn')]);
  }

  if (!hasUsedThisEncounter(actor, AUGMENT_POWER_COMBAT_FLAG)) {
    options.push([2, game.i18n.localize('E20.AugmentPowerBenefitCombat')]);
  }

  if (options.length == 1) {
    return options[0][0];
  }

  const benefitOptions = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.AugmentPowerPickBenefitTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.AugmentPowerPickBenefitLabel')
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

  return chosen && chosen != 'cancel' ? parseInt(chosen) : null;
}

/**
 * @param {Actor} actor
 * @param {Item} item
 */
export async function activateAugmentPower(actor, item) {
  const shiftUp = await pickAugmentPowerShiftUp(actor);
  if (!shiftUp) {
    return;
  }

  const candidateAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  const targetActors = await pickAllyTargets(actor, candidateAllies, item.name, 1);
  if (!targetActors.length) {
    return;
  }

  for (const targetActor of targetActors) {
    await bankPendingBonus(targetActor, PENDING_FLAG, { shiftUp });
  }

  if (shiftUp == 1) {
    await markUsedThisTurn(actor, AUGMENT_POWER_TURN_FLAG);
  } else {
    await markUsedThisEncounter(actor, AUGMENT_POWER_COMBAT_FLAG);
  }

  const names = targetActors.map(a => a.name).join(', ');
  postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: names }));
}
