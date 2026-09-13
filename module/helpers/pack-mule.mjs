// Pack Mule (Knights of Canterlot, Beam spell, p.44): "The caster makes a Spellcasting Attack
// Test against a target within range. On a success, the target suffers a downshift 2 to all
// Strength and Speed Skill Tests for the duration of the spell" (3 rounds). A round-scoped window
// read directly on the affected actor, the same shape Shining Leader's own 2-round Edge window
// already established (SHINING_LEADER_EDGE_FLAG in dice.mjs) rather than a one-shot
// getPendingBonus consumption, since this must keep applying across every qualifying roll for the
// full duration, not just the next one.

export const PACK_MULE_DOWNSHIFT_FLAG = 'pendingPackMuleDownshift';

export async function markPackMuleDownshift(targetActor) {
  if (!game.combat) {
    return;
  }

  await targetActor.setFlag('essence20', PACK_MULE_DOWNSHIFT_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
  });
}
