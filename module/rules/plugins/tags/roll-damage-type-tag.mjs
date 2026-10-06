// Round 14 (dice): roll:damageType:<type> - the damage type the roll's chat card deals (the attack's final type after
// every override, a spell's or a synthetic Skill Test's), read by hit / miss / targeted / afterRoll Triggers.
// rules/triggers.mjs puts it in the roll facts as rollDamageType (checkContext.damageType).
import { registerTag } from "../../predicate.mjs";

/**
 * roll:damageType:<type> - the roll deals that damage type (case ignored). Unknown (null) where the roll's damage type
 * isn't known (outside a posted roll).
 */
export function rollDamageTypeTag(rest, ctx) {
  if (ctx?.rollDamageType === undefined) {
    return null;
  }

  return String(ctx.rollDamageType ?? '').toLowerCase() == String(rest ?? '').toLowerCase();
}

registerTag('roll:damageType', rollDamageTypeTag);
