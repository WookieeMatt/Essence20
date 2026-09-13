/**
 * Castling (GI Joe CRB, Grandmaster Focus, 10th level, p.87): "designate two allies as a Standard
 * action. They each gain one Temporary Health and may immediately move up to their full Movement
 * Rating." Only the Temporary Health half is built - "move their full Movement Rating" is an
 * extra Move action this codebase has no per-turn action budget to grant. Same flat
 * health.bonus/.value bump Got To Get Tough/You Got This! already establish, just targeted at
 * exactly the 2 chosen allies (see banked-buffs.mjs's own dispatch, which resolves them via the
 * existing pickAllyTargets(actor, candidates, name, 2)) instead of a radius aura.
 */
export async function activateCastling(allies) {
  for (const ally of allies) {
    await ally.update({
      'system.health.bonus': ally.system.health.bonus + 1,
      'system.health.value': ally.system.health.value + 1,
    });
  }
}
