import { bankPendingBonus } from "./perks.mjs";

/**
 * Power Strike (Power Rangers Core Rulebook, Grid Power, p.100 - distinct from Red Ranger's own
 * identically-named Role Points item, which needs no code of its own; disambiguated here by file
 * name only, sourceId already keeps the two apart everywhere they're actually checked): "While
 * wielding your summoned Power weapon, you can push raw energy into one of its attacks. You may
 * spend between 1 to 3 Power when making an attack action. If it hits, the target suffers an
 * additional 1 Energy damage per Power spent. If it misses, the attack fizzles and the Power is
 * wasted."
 *
 * A genuinely different shape from every other Grid Power this project has built so far: the
 * Power's own activation and the attack it boosts are two separate rolls/clicks in this system
 * (Powers and weapon attacks have no shared UI), so this banks the spent amount now for the
 * actor's own NEXT Power-Weapon attack to consume - the same bank-now/consume-on-next-matching-
 * roll shape Environmental Assist's own damage bonus already established in dice.mjs (see
 * PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY there), just with a variable amount instead of a fixed +1.
 * "Wielding your summoned Power weapon" at ACTIVATION time is trusted to the player (the same
 * self-policed-fictional-trigger idiom Aiming/Precision Aim's own checkboxes already use) - the
 * weapon-trait check itself is enforced at CONSUMPTION time in dice.mjs instead, so a bank made
 * without actually wielding one just sits until a Power-Weapon attack is actually made. "If it
 * misses, the Power is wasted" is already true structurally (damage only ever matters on a hit),
 * but the bank itself is cleared the moment a qualifying attack is attempted, hit or miss, so it
 * can never carry over to a later attack.
 */
export const PENDING_GRID_POWER_STRIKE_FLAG_KEY = 'pendingGridPowerStrikeDamage';

/**
 * @param {Actor} actor
 * @param {Number} amountSpent   How much Power was spent on this activation (1-3 per RAW, but
 *   nothing here enforces that cap - the variable-cost picker's own maxPowerCost already does).
 */
export async function activateGridPowerStrike(actor, amountSpent) {
  if (!amountSpent) {
    return;
  }

  await bankPendingBonus(actor, PENDING_GRID_POWER_STRIKE_FLAG_KEY, { damageBonus: amountSpent });
}
