import { registerTag } from "../../predicate.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md):
 *
 *   target:keptAt:<path>     the other party is the actor whose uuid this actor keeps at that path
 *                            (flags.essence20.nemesisUuid - Nemesis (Specific Threat)'s declared Nemesis)
 *   self:elevation:<op>N     this actor's token elevation (feet; >= <= > < = and N may be negative); false with no
 *                            token on the canvas - Lightspeed Boost's "in flight" (self:elevation:>0) / "submerged" (:<0)
 */

const readPath = (doc, path) => String(path ?? '').split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), doc);

registerTag('target:keptAt', (rest, ctx) => {
  if (!rest) {
    return null;
  }

  const kept = readPath(ctx.self, rest);
  return !!ctx.other?.uuid && !!kept && String(kept) == ctx.other.uuid;
});

const compare = (value, op, number) => ({ '>=': value >= number, '<=': value <= number, '>': value > number, '<': value < number, '=': value == number })[op];

registerTag('self:elevation', (rest, ctx) => {
  const match = /^(>=|<=|>|<|=)(-?\d+(?:\.\d+)?)$/.exec(String(rest ?? ''));
  if (!match) {
    return null;
  }

  const token = ctx.self?.getActiveTokens?.()?.[0] ?? null;
  if (!token) {
    return false;
  }

  return compare(Number(token.document?.elevation) || 0, match[1], Number(match[2]));
});
