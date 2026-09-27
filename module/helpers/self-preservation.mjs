import { bankPendingBonus, clearPendingBonus, findPerk, getPendingBonus, postPerkUseChatCard } from "./perks.mjs";
import { ENERGY_AFFINITY_ID } from "./energy-affinity.mjs";

/**
 * Self-Preservation (Decepticon Directive, Elementalist Focus, 3rd level, p.53): "You gain
 * Resistance to the Element chosen for your Energy Affinity. Additionally, if you spend an Energon
 * Point as a Free action, you gain Immunity to that same damage until the beginning of your next
 * turn."
 *
 * The always-on Resistance half is derived in documents/actor.mjs#_prepareSelfPreservationResistance,
 * the same additive "read Energy Affinity's own choice, set system.resistances" shape Fireproof's
 * own comment establishes for a Perk-driven Resistance. The Immunity half is a manual Use-button
 * activation (helpers/banked-buffs.mjs#onPerkUse) that spends 1 Energon Point and banks a pending
 * flag consumed by the next hit of that damage type - "until the beginning of your next turn" is
 * approximated as "the next matching hit," the same short-window idiom Dig Deep's own
 * PENDING_DIG_DEEP_FLAG_KEY comment (helpers/combat.mjs) already documents for this codebase.
 */
export const SELF_PRESERVATION_ID = "Compendium.essence20.decepticon_directive.Item.fsy9G9z8cKe3kObg";

const PENDING_SELF_PRESERVATION_FLAG_KEY = 'pendingSelfPreservationImmunity';

/**
 * Spends 1 Energon Point (if available) and banks the pending Immunity - see SELF_PRESERVATION_ID's
 * own comment above.
 * @param {Actor} actor
 */
export async function activateSelfPreservation(actor) {
  if ((actor.system.energon?.normal?.value ?? 0) < 1) {
    ui.notifications.warn(game.i18n.localize('E20.SelfPreservationNoEnergon'));
    return;
  }

  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await bankPendingBonus(actor, PENDING_SELF_PRESERVATION_FLAG_KEY, {});
  postPerkUseChatCard(actor, game.i18n.format('E20.SelfPreservationActivated', { name: actor.name }));
}

/**
 * Self-Preservation's banked Immunity - consumed by the next hit of the actor's own Energy
 * Affinity damage type, whichever comes first (see SELF_PRESERVATION_ID's own comment above).
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Promise<Boolean>}   true (and clears the bank) if this hit is Immune.
 */
export async function consumeSelfPreservationImmunity(actor, damageType) {
  if (!damageType || !getPendingBonus(actor, PENDING_SELF_PRESERVATION_FLAG_KEY)) {
    return false;
  }

  const choice = findPerk(actor, ENERGY_AFFINITY_ID)?.system.choice;
  if (choice != damageType) {
    return false;
  }

  await clearPendingBonus(actor, PENDING_SELF_PRESERVATION_FLAG_KEY);
  return true;
}
