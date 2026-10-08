// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerTag } from "../../predicate.mjs";

/**
 * Tag `target:exists` - there is another party (the roll's or the run's first target; the roller for an incoming rule).
 * With `not:` - "nothing is targeted" (Dominate's "target the creature to infect first").
 */
registerTag('target:exists', (rest, ctx) => !!ctx?.other, { phrase: ['there is a target', 'there is no target'] });
