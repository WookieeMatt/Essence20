import { registerRef } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * Which target this is (round 10, group D - docs/rules-batches/slD10.md): the target:uuid:<uuid> tag and the
 * @targetKeyed.<path> ref (a number kept per target).
 */

// target:uuid:<uuid> - the other party is that actor ({var.x} / {choice.x} filled first).
registerTag('target:uuid', (rest, ctx) => (ctx.other ? ctx.other.uuid == rest : false));

// @targetKeyed.<path>: a number this actor keeps per target under a flag object keyed by the target's uuid with its
// dots as dashes (flags.essence20.analyzeTargetCounts) - for the run's first target.
registerRef('targetKeyed', (key, scope) => {
  const other = scope.other;
  if (!other?.uuid) {
    return 0;
  }

  const table = key.split('.').reduce((at, part) => at?.[part], scope.actor);
  return Number(table?.[other.uuid.replace(/\./g, '-')]) || 0;
});
