import { getNearbyEnemyTokens } from "./enemies.mjs";

// Sparkle Blast (Knights of Canterlot, Superior Beam spell, p.48): "a shimmering cloud of
// sparkling particles appears in a 30-foot cube. Any creature caught within the cube (except the
// caster) has their vision obscured and is Blinded until they leave the affected area." Unlike
// every other AoE this project has built (Absolute Menace, Elemental Storm, Supreme Guardian's own
// Blind bullet), RAW never calls for an Attack Test against each creature at all - it's a pure
// area effect that lands automatically on a successful cast (the Spellcasting Test only
// determines whether the spell is cast, not who it hits). Approximated as every nearby enemy
// (getNearbyEnemyTokens) within the spell's own 30ft cube edge length, the same "drop the
// geometry, keep the target-based mechanic" idiom those Attack-based AoEs already use, just
// without their own per-target roll.

export async function applySparkleBlast(actor) {
  for (const enemyToken of getNearbyEnemyTokens(actor, 30)) {
    await enemyToken.actor?.toggleStatusEffect('blinded', { active: true });
  }
}
