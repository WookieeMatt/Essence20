// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerRef } from "../../formula.mjs";

/**
 * @skillDie.<skill> - roll the Skill's own die (system.skills.<skill>.shift: d2 ... d12, 2d8, 3d6; d20 untrained) with no
 * shifts, Edge, Snag or modifier - the plain `new Roll(shift)` Hard Target, Resilience and Surface Read made. Like any
 * formula dice, the roll is noted in scope.dice (a step tells it in chat and keeps it as @var.rolled) and uses
 * scope.random in tests. `@skillDie.<skill>.self` is the same (the actor's own); with no actor or Skill it is 0.
 */
export function skillDieRef(key, scope) {
  const skill = String(key ?? '').split('.')[0];
  const shift = String(scope?.actor?.system?.skills?.[skill]?.shift ?? '');
  const match = /^(\d*)d(\d+)$/.exec(shift);
  if (!match) {
    return 0;
  }

  const count = Math.min(100, Number(match[1] || 1));
  const faces = Number(match[2]);
  const random = scope.random ?? Math.random;
  const results = Array.from({ length: count }, () => 1 + Math.floor(random() * faces));
  const total = results.reduce((sum, value) => sum + value, 0);
  scope.dice?.push?.({ formula: `${count}d${faces}`, results, total });
  return total;
}

registerRef('skillDie', skillDieRef);
