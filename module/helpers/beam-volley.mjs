import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Beam Volley (MLP CRB, Virtuoso Beam spell, p.138): "You fire a barrage of magical beams...
 * Make a Spellcasting Attack Test against 3 targets in range. You deal 2 Energy Damage to each
 * target you successfully hit."
 *
 * Same "auto-target, then feed a synthetic damage source into the existing per-target Defense-
 * comparison pipeline" shape as Explosive Beam - one roll compared against several targets at
 * once, not an independent re-roll per target. RAW's own "3 targets" (as opposed to Explosive
 * Beam's own unbounded area) is approximated as the 3 nearest enemies - this project's own
 * "Line of Sight" range has no fixed feet to check against anyway, so
 * getNearbyEnemyTokens(actor, Infinity) (the same unbounded-radius idiom
 * getNearbyAllyTokens(actor, Infinity) already established for "any ally on the scene") is
 * filtered down to the closest 3 rather than every enemy on the scene.
 */
export function autoTargetBeamVolley(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  const enemies = getNearbyEnemyTokens(actor, Infinity);
  const closest = actorToken
    ? [...enemies].sort((a, b) =>
      canvas.grid.measurePath([a.center, actorToken.center]).distance
        - canvas.grid.measurePath([b.center, actorToken.center]).distance)
    : enemies;

  canvas.tokens.setTargets(closest.slice(0, 3).map(token => token.id));
}
