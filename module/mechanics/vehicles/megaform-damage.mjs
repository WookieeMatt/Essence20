import { applyDamage } from "../combat/combat.mjs";
import { getMegaformParticipants } from "./megaform-participants.mjs";

/**
 * Megaform damage distribution (Power Rangers Core Rulebook, p.142): each participant keeps its own
 * Health, and damage to the Megaform is split evenly among them (rounded up, at least 1 each) unless
 * the attacker takes a Snag to aim at one participant. A participant already at 0 Health stops
 * soaking any share (same page) - excluded from the split entirely, not given a $0 share that still counts toward the
 * participant total. This is the entry point a Megaform actor needs instead of the ordinary
 * applyDamage(): even though a Megaform has a real system.health (Essence20Actor#
 * _prepareMegaformData computes it from its participants, same as its Defenses/Movement), RAW
 * doesn't pool damage against that single value - it always distributes across the linked
 * participants below, so applyDamage() is never called on the Megaform actor itself.
 *
 * Grounding (A Jump Through Time, p.84): Electric damage drops by 1 (not below 1) before it is
 * split - applied to the incoming total before dividing, if
 * any active participant holds it (the immunity half of Grounding is handled separately, as a
 * computed system.immunities.emp flag in actor.mjs).
 *
 * The attacker's take-a-Snag-to-focus option is a choice that belongs on the original
 * attack roll, which has already resolved by the time a GM clicks Apply Damage on the chat card -
 * approximated as a GM confirmation at apply-time (did the attacker actually take that Snag?)
 * rather than a live Roll Options Dialog toggle, the same "confirm after the fact" idiom
 * chat.mjs#onApplyDamage already uses for Sudden Death/Just a Graze/Hard Corps.
 *
 * Compensation (A Jump Through Time, p.84): the team may shift two damage from other Zords onto this
 * one - same total, but it can save a low-Health Zord from Defeat - a voluntary post-split reassignment, offered as a follow-up prompt only
 * when a still-active participant holds it and there's more than one recipient to move damage
 * from/to.
 */
const COMPENSATION_MOVE_AMOUNT = 2;

function hasMegaformTrait(actor, type) {
  return actor.items.some(item => item.type == 'megaformTrait' && item.system.type == type);
}

/**
 * Applies damage to a Megaform by distributing it across its active (>0 Health) participants,
 * per the rules above.
 * @param {Actor} megaformActor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>} The total amount actually applied across all participants.
 */
export async function applyMegaformDamage(megaformActor, damageValue, damageType) {
  const participants = getMegaformParticipants(megaformActor).filter(
    participant => participant.system.health.value > 0,
  );
  if (!participants.length) {
    return 0;
  }

  let amount = damageValue;
  if (damageType == 'electric' && participants.some(p => hasMegaformTrait(p, 'grounding'))) {
    amount = Math.max(1, amount - 1);
  }

  let focusTarget = null;
  if (participants.length > 1) {
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.MegaformDamageDistributionTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.MegaformDamageDistributionContent', { name: megaformActor.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.MegaformDamageDistributionSplit'), action: 'split', default: true },
        ...participants.map(participant => ({ label: participant.name, action: participant.uuid })),
      ],
    });

    if (choice && choice != 'split') {
      focusTarget = participants.find(participant => participant.uuid == choice) ?? null;
    }
  }

  if (focusTarget) {
    return await applyDamage(focusTarget, amount, damageType);
  }

  const perParticipantAmount = Math.max(1, Math.ceil(amount / participants.length));
  let totalApplied = 0;
  for (const participant of participants) {
    totalApplied += await applyDamage(participant, perParticipantAmount, damageType);
  }

  const compensationHolders = participants.filter(participant => hasMegaformTrait(participant, 'compensation'));
  for (const holder of compensationHolders) {
    const others = participants.filter(participant => participant != holder);
    if (!others.length) {
      continue;
    }

    const confirmation = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('E20.CompensationConfirmTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${game.i18n.format('E20.CompensationConfirmContent', { name: holder.name })}</p>`,
      modal: true,
      buttons: [
        { label: game.i18n.localize('E20.DialogYesButton'), action: 'yes' },
        { label: game.i18n.localize('E20.DialogNoButton'), action: 'no' },
      ],
    });

    if (confirmation == 'yes') {
      await moveCompensationDamage(holder, others);
    }
  }

  return totalApplied;
}

/**
 * Moves up to 2 points of already-applied damage from other participants onto the Compensation
 * holder (healing the others, further damaging the holder), spread across as many of the other
 * participants as needed to find that much damage to move.
 * @param {Actor} holder
 * @param {Actor[]} others
 */
async function moveCompensationDamage(holder, others) {
  let remaining = COMPENSATION_MOVE_AMOUNT;
  for (const other of others) {
    if (remaining <= 0) {
      break;
    }

    const damageAlreadyTaken = other.system.health.max - other.system.health.value;
    const toMove = Math.min(remaining, damageAlreadyTaken);
    if (toMove <= 0) {
      continue;
    }

    await other.update({ 'system.health.value': other.system.health.value + toMove });
    await holder.update({ 'system.health.value': Math.max(0, holder.system.health.value - toMove) });
    remaining -= toMove;
  }
}
