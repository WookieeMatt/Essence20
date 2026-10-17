import { resolveValue } from "../../formula.mjs";
import { hostOf, ruleLabel } from "../../index.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { damageTypeLabel, num, resolve } from "../shared/hit-rider-lookups.mjs";
import { hitRiderEntries } from "./hit-rider.mjs";

/**
 * Round 18 (convA): HitRider `stage: "late"` (+ `replace: true`) - a weapon hit's rule read at the END of the hit
 * (mechanics/combat/target-riders.mjs#attackRiders calls ruleLateHitRiders): after every other hit rider, Targetmaster
 * and All Out Attack have added their damage, before the poison coating, the on-hit Conditions and the Critical
 * Success riders. `@var.damage` is the hit's damage by then. Only `option` is read at this stage; `replace: true` makes
 * that option the hit's only Apply button (its own damage button goes, and with it the rules' Critical options).
 * Concentrated Fire: "treats Fire Immunity as Fire Resistance" - `{type: HitRider, stage: late, replace: true, when:
 * ["roll:dataset:concentratedFire", "item:damageType:fire", "target:data:system.immunities.fire"], option: {damage:
 * "@var.damage", damageType: fire, key: concentratedFire, ignoreImmunity: true}}`. A hit with no damage is skipped.
 */

const HIT_RIDER = RULE_TYPES.HitRider;
if (HIT_RIDER) {
  HIT_RIDER.params.stage ??= { kind: 'enum', options: ['late'] };
  HIT_RIDER.params.replace ??= { kind: 'bool' };
  const inner = HIT_RIDER.validate;
  HIT_RIDER.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.stage == 'late' && !rule.option ? ['stage late reads only option - give it one'] : []),
    ...(rule.replace && !rule.option ? ['replace needs an option'] : []),
  ];
}

function hostMatches(ruleItem, rolled) {
  const host = hostOf(ruleItem);
  return !!host && !!rolled && (rolled.id == host.id || rolled.flags?.essence20?.parentId == host.id);
}

/**
 * The late HitRider rules on one landed hit (see the file comment). Mutates result (riderOptions, damageValue).
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {Object} result   The hit's row on the card.
 * @param {Object} rider    target-riders.mjs#buildRiderContext's roll facts.
 * @param {Object} [tools]  {isCrit}
 */
export function ruleLateHitRiders(attacker, target, result, rider = {}, { isCrit = false } = {}) {
  if (!result?.damageValue) {
    return;
  }

  const rolled = resolve(rider.itemUuid);
  const facts = {
    item: rolled, rolledSkill: rider.skill, isAttack: true, isMelee: rider.style == 'melee', switches: rider.switches ?? [],
    dataset: rider.dataset, damageType: rider.damageType ?? result.damageType, isCrit: !!isCrit,
  };
  for (const { rule, item: ruleItem, holder, index } of hitRiderEntries(attacker, target)) {
    if (rule.stage != 'late' || (rule.on ?? 'attack') != 'attack' || !rule.option || !result.damageValue
      || ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, rolled))) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...facts, self: attacker, holder, ruleItem, other: target })) !== true) {
      continue;
    }

    const scope = { actor: holder, item: ruleItem, vars: { damage: num(result.damageValue), base: num(rolled?.system?.damageValue) }, other: target };
    const damageType = interpolate(String(rule.option.damageType ?? ''), ruleItem);
    if (!damageType) {
      continue;
    }

    result.riderOptions = [...(result.riderOptions ?? []), {
      key: rule.option.key ?? `rule${ruleItem?.id ?? 'x'}${index}`, label: rule.option.label ?? ruleLabel(rule, ruleItem),
      damageValue: Math.round(resolveValue(rule.option.damage, scope)), damageType, damageTypeLabel: damageTypeLabel(damageType),
      ...(rule.option.ignoreImmunity ? { ignoreImmunity: true } : {}),
    }];
    if (rule.replace) {
      result.damageValue = null;
    }
  }
}
