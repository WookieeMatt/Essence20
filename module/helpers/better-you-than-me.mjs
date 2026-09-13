/**
 * Better You Than Me (Finster's Monster-Matic Cookbook, Path of Frost, 2nd level, p.289): "Spend 1
 * Personal Power and touch a willing ally to regain 1 Health by inflicting 1 Void damage to the
 * touched ally; this damage can't be reduced in any way."
 *
 * The inverse of this project's usual ally-heal shape (Whatever Helps: heal an ally, cost yourself
 * Health) - here the actor heals THEMSELVES by damaging the ally, so it doesn't fit
 * banked-buffs.mjs's existing IMMEDIATE_ALLY_PERKS table (built only for "grant a benefit to the
 * ally" shapes) without a genuinely new dimension - a small standalone dispatch instead, matching
 * this project's own precedent for effects that don't cleanly fit an existing generalized table
 * (Absolute Menace, Duty Of The Graphite, etc.). "Can't be reduced in any way" means this bypasses
 * the normal applyDamage() pipeline (which respects Resistance/Immunity) entirely - a direct
 * system.health.value subtraction instead, floored at 0. The ally is the currently-targeted token,
 * the same auto-detect idiom this project's other single-ally-target Perks already use.
 */
const ACTIVATION_COST = 1;
const TRANSFER_AMOUNT = 1;

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the transfer actually happened.
 */
export async function activateBetterYouThanMe(actor) {
  const allyActor = game.user.targets.first()?.actor;
  if (!allyActor || (actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
    return false;
  }

  await actor.update({
    'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST,
    'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + TRANSFER_AMOUNT),
  });

  await allyActor.update({
    'system.health.value': Math.max(0, allyActor.system.health.value - TRANSFER_AMOUNT),
  });

  return true;
}
