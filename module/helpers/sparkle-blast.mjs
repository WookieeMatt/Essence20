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
  // Now a placed area (the spell's system.shape - a 15ft-radius circle standing in for the 30ft cube,
  // the nearest shape the AoE placer draws): whoever it caught is targeted, allies included - "(except
  // the caster but not their allies)". Blinded for the spell's 3 rounds. With nothing placed, the old
  // nearby-enemies reading stands.
  const targets = game.user?.targets;
  const caught = [...(typeof targets?.[Symbol.iterator] == 'function' ? targets : [])].map(token => token.actor).filter(a => a && a.uuid != actor.uuid);
  const victims = caught.length ? caught : getNearbyEnemyTokens(actor, 30).map(token => token.actor).filter(Boolean);
  const { applyTimedCondition } = await import("./timed-status.mjs");
  for (const victim of victims) {
    await applyTimedCondition(victim, 'blinded', 3);
  }
}
