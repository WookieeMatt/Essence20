import { feetBetween, registerTag } from "../../predicate.mjs";

/**
 * Group A (round 10): tag `target:notBeyond:<ft>` (the other party is no farther than that - off the canvas counts as
 * near enough).
 */

// target:notBeyond:<ft> - the other party isn't farther away than that (off the canvas counts as near enough - the old
// "warn only when measured too far" checks: Ninja Storm's blasts).
registerTag('target:notBeyond', (rest, ctx) => {
  if (!ctx.other) {
    return false;
  }

  const feet = feetBetween(ctx.self, ctx.other);
  return feet === null || !Number.isFinite(feet) || feet <= Number(rest) + 0.5;
}, { phrase: ['{who} {is} no more than {ft} away', '{who} {is} more than {ft} away'] });
