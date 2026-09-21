import { getNearbyAllyTokens } from "./allies.mjs";
import { isDataBridged } from "./data-bridge.mjs";

/**
 * Misery Loves Company (Enigma of Combination, Hub Focus, Analyst, 17th level, p.29): "By
 * spending an Energon Point as a Free action, you can remove one of the following conditions from
 * one ally and transmit it to another currently on the Data Bridge (including yourself):
 * Frightened, Impaired, Mesmerized, and Stunned."
 *
 * The Energon spend is a plain affordability gate (system.energon.normal.value >= 1, no Free
 * action to enforce - this project doesn't track action economy anywhere). "On the Data Bridge"
 * reads the same roster helpers/data-bridge.mjs#isDataBridged already established for Tactical
 * Triangulation - a real, populated roster now that Data Bridge itself broadcasts to every nearby
 * ally. Both the affected ally (who has one of the 4 named Conditions) and the recipient (anyone
 * currently Data Bridged, self included, other than the affected ally) are resolved via a single
 * combined picker - the same "two dropdowns, one dialog" shape Bolster Defense's own mode+
 * defenseType picker already establishes, rather than two separate sequential dialogs.
 */

const TRANSMISSIBLE_CONDITIONS = ['frightened', 'impaired', 'mesmerized', 'stunned'];

/**
 * Every (ally token, condition) pair currently eligible to have a Condition removed - the actor's
 * own token included.
 * @param {Actor} actor
 * @returns {Array<{token: Token, condition: String}>}
 */
export function getAffectedDataBridgeAllies(actor) {
  const actorToken = actor.getActiveTokens?.()?.[0];
  const tokens = [...(actorToken ? [actorToken] : []), ...getNearbyAllyTokens(actor, Infinity)];
  const pairs = [];
  for (const token of tokens) {
    for (const condition of TRANSMISSIBLE_CONDITIONS) {
      if (token.actor?.statuses?.has(condition)) {
        pairs.push({ token, condition });
      }
    }
  }

  return pairs;
}

/**
 * Every Data-Bridged ally (the actor's own token included) currently eligible to receive a
 * transmitted Condition.
 * @param {Actor} actor
 * @returns {Array<Token>}
 */
export function getDataBridgedAllyTokens(actor) {
  const actorToken = actor.getActiveTokens?.()?.[0];
  const tokens = [...(actorToken ? [actorToken] : []), ...getNearbyAllyTokens(actor, Infinity)];
  return tokens.filter(token => isDataBridged(token.actor));
}

/**
 * Prompts for which afflicted ally to cure and which Data-Bridged ally receives the Condition
 * instead.
 * @param {Actor} actor
 * @returns {Promise<{source: Actor, destination: Actor, condition: String}|null>}   Null if
 *   there's nothing eligible, or the picker was cancelled.
 */
export async function pickMiseryLovesCompanyTransfer(actor) {
  const affected = getAffectedDataBridgeAllies(actor);
  const bridged = getDataBridgedAllyTokens(actor);
  if (!affected.length || !bridged.length) {
    return null;
  }

  const affectedOptions = affected
    .map((pair, index) => `<option value="${index}">${pair.token.actor?.name} - ${game.i18n.localize(`E20.Status${pair.condition.charAt(0).toUpperCase()}${pair.condition.slice(1)}`)}</option>`)
    .join('');
  const bridgedOptions = bridged
    .map((token, index) => `<option value="${index}">${token.actor?.name}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MiseryLovesCompanyPickTransferTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MiseryLovesCompanyCureLabel')
    }</label><select name="affected">${affectedOptions}</select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.MiseryLovesCompanyTransmitLabel')
}</label><select name="bridged">${bridgedOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          affected: button.form.elements.affected.value, bridged: button.form.elements.bridged.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel') {
    return null;
  }

  const { token: sourceToken, condition } = affected[Number(chosen.affected)];
  const destinationToken = bridged[Number(chosen.bridged)];
  if (sourceToken === destinationToken) {
    return null;
  }

  return { source: sourceToken.actor, destination: destinationToken.actor, condition };
}

/**
 * Prompts for the transfer and applies it - cures the source, afflicts the destination with the
 * same Condition. The Energon spend itself is charged by the caller (banked-buffs.mjs), same
 * split as every other Power/Energon-costing dispatch in this project.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The Condition transmitted, or null if there was nothing
 *   eligible or the picker was cancelled.
 */
export async function applyMiseryLovesCompany(actor) {
  const transfer = await pickMiseryLovesCompanyTransfer(actor);
  if (!transfer) {
    return null;
  }

  await transfer.source.toggleStatusEffect(transfer.condition, { active: false });
  await transfer.destination.toggleStatusEffect(transfer.condition, { active: true });
  return transfer.condition;
}
