/**
 * Repair Zord (Power Rangers Core Rulebook, Grid Power, p.101): "While piloting your Zord, you may
 * spend any number of Power to repair damage it may have suffered. For each 2 Power spent, you
 * repair 1d2 damage. If healing a combined Megaform, the cost of this Grid Power increases by 1,
 * but the amount healed is divided evenly amongst all combined parts (minimum of 1)."
 *
 * Only the base (non-combined) case is built - dividing a heal evenly across a Megaform's own
 * combined parts needs per-part Health bookkeeping this project's Megaform data model
 * (data/actor/megaform.mjs) doesn't expose a clean hook for yet, and the "+1 cost while combined"
 * clause would need to know a Megaform is currently combined at spend time, which the variable-
 * cost picker (apps/power-cost-selector.mjs) has no way to condition its own max on. Flagged as a
 * gap, not silently dropped - a Megaform actor still gets healed by this (just not divided), which
 * is the closest available approximation rather than refusing to heal it at all.
 *
 * "Piloting" is resolved via actor._dice's own _getPilotedVehicle(actor, 'driver') - the same
 * generic crew-lookup Heavy Ordnance/Dogfighter/Motor Lancer already use (every Actor/Item/Combat
 * document carries its own Dice instance at _dice, see documents/actor.mjs), required 'driver'
 * since RAW says "piloting", not just "riding in".
 */

/**
 * Repairs 1d2 damage to the actor's piloted Zord for each 2 Power spent (rounded down).
 * @param {Actor} actor        The pilot activating the Power.
 * @param {Number} amountSpent How much Power was spent on this activation.
 * @returns {Promise<Number>}  The total damage actually repaired.
 */
export async function activateRepairZord(actor, amountSpent) {
  const numDice = Math.floor((amountSpent || 0) / 2);
  const zord = numDice > 0 ? actor._dice?._getPilotedVehicle(actor, 'driver') : null;
  if (!zord || numDice <= 0) {
    return 0;
  }

  const roll = await new Roll(`${numDice}d2`, actor.getRollData()).evaluate();
  const healAmount = roll.total;
  await zord.update({
    'system.health.value': Math.min(zord.system.health.max, zord.system.health.value + healAmount),
  });

  return healAmount;
}
