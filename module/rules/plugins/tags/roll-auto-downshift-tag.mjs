// Round 14 (dice): roll:autoDownshift - the roll already carries an automatic ↓ from the system's own modifiers (dice.mjs
// hands the dialog hooks combatModifiers.shiftDown as autoShiftDown, before any rule switch). Straight Shooter.
import { registerTag } from "../../predicate.mjs";

/** roll:autoDownshift - the automatic modifiers put a ↓ on this roll. Unknown (null) where nobody said. */
export function autoDownshiftTag(rest, ctx) {
  if (ctx?.autoShiftDown === undefined || ctx?.autoShiftDown === null) {
    return null;
  }

  return (Number(ctx.autoShiftDown) || 0) > 0;
}

registerTag('roll:autoDownshift', autoDownshiftTag, { phrase: ['the roll takes an automatic downshift', 'the roll takes no automatic downshift'] });
