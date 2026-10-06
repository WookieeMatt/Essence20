import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (items2): `target:keyedOnMe:<path><op><n>` - the other party keeps a number about THIS actor in a table keyed
 * by actor uuid (dots as dashes - the @targetKeyed shape, e.g. flags.essence20.analyzeTargetCounts), and it compares so
 * (op: >=, <=, >, <, =). With no op: the entry is above 0. An incoming rule's view of the roller's per-target records
 * (Anonymous: "from the second Analyze Target on"). No other party - false.
 */
export function keyedOnMe(rest, ctx) {
  const self = ctx?.self;
  const other = ctx?.other;
  const match = /^([\w.-]+?)(?:(>=|<=|>|<|=)(-?\d+(?:\.\d+)?))?$/.exec(String(rest ?? ''));
  if (!match || !self?.uuid || !other) {
    return false;
  }

  const table = match[1].split('.').reduce((at, part) => at?.[part], other);
  const value = Number(table?.[self.uuid.replace(/\./g, '-')]) || 0;
  const target = Number(match[3]);
  switch (match[2]) {
  case '>=': return value >= target;
  case '<=': return value <= target;
  case '>': return value > target;
  case '<': return value < target;
  case '=': return value == target;
  default: return value > 0;
  }
}

registerTag('target:keyedOnMe', keyedOnMe);
