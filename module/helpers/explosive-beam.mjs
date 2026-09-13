import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Explosive Beam (MLP CRB, Superior Beam spell, p.137): "You aim your beam at an area instead of a
 * creature, affecting all creatures in that area... Pick a space within range. Make a Spellcasting
 * Attack Test against each target in a 15ft diameter circle of the chosen space. You deal 1 Energy
 * damage to each target successfully attacked."
 *
 * "Pick a space... within range" (60ft) containing a 15ft-diameter circle is approximated as
 * "every enemy within 60ft of the caster," the same "drop the geometry, keep the target-based
 * mechanic" idiom Absolute Menace/Elemental Storm/Explosive Morph already established for an AoE
 * this project doesn't model with real templates. Called from documents/item.mjs's own spell-cast
 * branch (a second per-spell-id pre-roll hook, alongside Enchant's own) to auto-target before the
 * roll fires - the damage itself is fed as a synthetic source in dice.mjs, identified by this
 * spell's own sourceId, the same shape Energy Beam/Lancing Beam already established.
 */
const RANGE_FEET = 60;

export function autoTargetExplosiveBeam(actor) {
  const enemies = getNearbyEnemyTokens(actor, RANGE_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));
}
