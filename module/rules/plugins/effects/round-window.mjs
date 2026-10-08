import { registerUntil } from "../../expiry.mjs";

/**
 * Round 15 (dice part): `until: "throughRoundPlus2"` - in the combat it started in, through the end of the round two
 * after the one it started in (rounds r, r+1 and r+2 - a 3-round spell cast in round r). Over once that combat isn't
 * the running one, and never lasts outside combat. Pack Mule's window (items/magic/pack-mule.mjs kept
 * {combatId, round} and read `round <= stamped + 2`).
 */
registerUntil('throughRoundPlus2', {
  stamp: combat => ({ combatId: combat?.id ?? null, round: Number(combat?.round) || 0 }),
  expired: (stamp, combat) => !combat || !stamp.combatId || combat.id != stamp.combatId || (Number(combat.round) || 0) > (Number(stamp.round) || 0) + 2,
});
