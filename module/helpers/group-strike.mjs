import { getNearbyEnemyTokens } from "./enemies.mjs";

// Group Strike (Power Rangers CRB, Pink Ranger, 5th/10th/15th level, p.49): "After spending 1
// Personal Power, you choose a 10 foot by 10 foot area within range and line of sight, and make a
// ranged attack against all targets in that area. The area affected increases to 15 feet by 15
// feet at 10th level, and again at 15th level to 20 feet by 20 feet." The same Blast/AoE
// auto-target shape Whirlwind Strike's own corrected build uses (not the Multiple Targets trait -
// RAW here doesn't say "a single Skill Test" explicitly, but "a ranged attack against all targets
// in that area" reads the same way, one roll compared against every target in the area). "You
// choose a [...] area within range" - the player's own placement freedom - is approximated the
// same "drop the geometry, keep the target-based mechanic" way Absolute Menace/Elemental Storm
// already use: every nearby enemy within the area's own side length, treated as a radius from the
// caster, rather than a freely-placed template.

export function activateGroupStrike(actor, areaFeet) {
  const enemies = getNearbyEnemyTokens(actor, areaFeet);
  canvas.tokens.setTargets(enemies.map(token => token.id));
}
