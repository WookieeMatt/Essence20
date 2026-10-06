// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the @rolePointsBonus ref.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { registerRef } from "../../formula.mjs";
import { rolePointsOf } from "../../steps.mjs";

/**
 * `@rolePointsBonus` - the bonus the actor's base Role Points item grants (its `system.bonus.value`, or
 * `system.bonus.level20Value` at 20th level - Reckless Abandon's Bonus Health); `@rolePointsBonus.<name>` reads the
 * Role Points item of that name ("_" for a space). 0 with none. Renegade Commander hands its own Bonus Health to the
 * ally it unleashes: `{key: "system.health.bonus", value: "@rolePointsBonus"}`.
 */
export function rolePointsBonus(actor, key = null) {
  const name = key ? String(key).replace(/_/g, ' ') : null;
  const bonus = rolePointsOf(actor, name)?.system?.bonus;
  const level = Number(actor?.system?.level) || 1;
  return Number(bonus?.[level == 20 ? 'level20Value' : 'value']) || 0;
}

registerRef('rolePointsBonus', (key, scope) => rolePointsBonus(scope.actor, key));
