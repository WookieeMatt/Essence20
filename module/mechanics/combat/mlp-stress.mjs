/**
 * My Little Pony: Stress.
 *
 * Stress (MLP CRB p.160, "Stress, Essence Loss and Consequences"): "When a character suffers stress,
 * one of two things can happen. They can suffer a point of Health damage, or they can suffer damage
 * to their Essence Scores." So healing Stress heals either; suffering it takes either - the pony
 * (or the GM) picks which.
 */
import { num } from "../../items/shared/numbers.mjs";
import { updateRelayedWithOptions as writeActor } from "../../items/shared/relayed-writes.mjs";

export function essenceDamage(actor) {
  let total = 0;
  for (const essence of Object.values(actor?.system?.essences ?? {})) {
    total += Math.max(0, num(essence?.max) - num(essence?.value));
  }

  return total;
}

export function healthDamage(actor) {
  return Math.max(0, num(actor?.system?.health?.max) - num(actor?.system?.health?.value));
}

/**
 * Heal Stress: Health or Essence damage.
 * @param {Actor} actor
 * @param {Number} amount
 * @param {'health'|'essence'} kind
 * @returns {Promise<Number>}   How much was healed.
 */
export async function healStress(actor, amount, kind) {
  if (kind == 'health') {
    const healed = Math.min(amount, healthDamage(actor));
    if (healed > 0) {
      await writeActor(actor, { 'system.health.value': num(actor.system.health.value) + healed });
    }

    return healed;
  }

  const { healEssenceDamage } = await import("./essence-damage.mjs");
  return healEssenceDamage(actor, amount);
}

// (Honest Compassion, the Spirit of Honesty's 3rd-level Perk, is its own Use rule: a rest-limited heal
// of 1 Health or 1 Essence on the target or the pony, asked before the Standard action is paid.)

// (Musical Interlude, the Knights of Canterlot Bard Hang-Up, is its own rules: a turnStart Trigger
// once per combat posting a "suffer 1 Stress" button.)

// (Camper is its own rules too: the camp Use with a per-member heal, and the ↑1 for the team while it stands.)

/* -------------------------------------------- */
/*  Zap Apple Jam                                */
/* -------------------------------------------- */

// Zap Apple Jam (In a Jam, Magic Object, p.32) is its item's own rules: the cups / pastries Use, the Edge, and
// a missionStart Trigger for its shelf life (marked stale at the first mission advance, gone at the second).
