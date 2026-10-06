import { evaluateTag, registerTag } from "../../predicate.mjs";

/**
 * `target:markedByMe:<key>` - the same test as the core `markedByMe:<key>` (the other party carries this actor's mark).
 * Rules naturally write it under the target: family, where it used to fall through to an unknown answer (null), so
 * a RollModifier using it turned into an unticked dialog switch and conditions using it never held.
 */
registerTag('target:markedByMe', (rest, ctx) => evaluateTag(`markedByMe:${rest}`, ctx));
