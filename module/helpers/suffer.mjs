import { actorHasPerk } from "./perks.mjs";

/**
 * Suffer! (Finster's Monster-Matic Cookbook, Path of Thorns, 15th level, p.300): "After
 * successfully inflicting damage on a target with an attack, you can spend any number of Personal
 * Power as a Free action. That target is Impaired for a number of turns equal to the number of
 * Personal Power spent."
 *
 * Genuinely reactive (you only know you dealt damage once the roll resolves) with a player-chosen
 * spend amount - the same combination Spite (helpers/spite.mjs, a reactive post-roll chat button)
 * and Powered Plating (helpers/powered-plating.mjs, a numeric "how much to spend" DialogV2) each
 * only have one half of. See chat.mjs#addSufferButton for the button/click wiring itself (mirrors
 * addSpiteButton, but gated on a successful hit that dealt damage rather than a miss); this file
 * holds the actual prompt and grant.
 *
 * "Any number" has no upper cap in RAW beyond what the actor can actually afford, unlike Powered
 * Plating's own RAW-stated cap of 4 - so unlike that Perk's own picker, this one's maxAmount is
 * simply the actor's current Personal Power, nothing more.
 *
 * The turn-count itself isn't tracked - this codebase has no per-Condition duration counter
 * anywhere (the same gap already documented for every other "Impaired/Frightened/etc. for N
 * turns" clause this project has built - Menacing Glare, Elemental Storm, Duty Of The Graphite,
 * etc.) - so the actual mechanical grant is a flat Impaired toggle-on, the number spent left for
 * the GM to track/narrate as the effect's own duration, same "visible marker, not hard
 * enforcement" idiom used throughout.
 */
const SUFFER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4wCGBUae2VvEDVs9";

export function hasSuffer(actor) {
  return actorHasPerk(actor, SUFFER_ID);
}

/**
 * Prompts for how much Power to spend (1 up to what's actually available).
 * @param {Number} maxAmount
 * @returns {Promise<Number|null>}   The chosen amount, or null if cancelled/invalid.
 */
export async function pickSufferAmount(maxAmount) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SufferPickAmountTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SufferPickAmountLabel')
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
 * Prompts for an amount, spends that much Power, and applies Impaired to the target - called once
 * the chat button's own affordability/claimed checks have already passed.
 * @param {Actor} actor   The Path of Thorns holder who just dealt damage.
 * @param {String} targetUuid   The target that was hit.
 * @returns {Promise<Boolean>}   False (nothing spent) if there was no Power to spend, no target,
 *   or the picker was cancelled.
 */
export async function activateSuffer(actor, targetUuid) {
  const maxAmount = actor.system.powers.personal.value;
  if (maxAmount <= 0) {
    return false;
  }

  const targetActor = await fromUuid(targetUuid);
  if (!targetActor) {
    return false;
  }

  const amount = await pickSufferAmount(maxAmount);
  if (!amount) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - amount });
  await targetActor.toggleStatusEffect('impaired', { active: true });
  return true;
}
