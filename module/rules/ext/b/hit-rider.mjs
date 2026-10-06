import { registerHitRider, registerPostRoll } from "../../../helpers/extensions.mjs";
import { formulaError, resolveValue } from "../../formula.mjs";
import { hostOf, ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import {
  damageTypeLabel, dispositionOf, itemsOf, marksOf, num, readPath, resolve, sourceOf, worldActors,
} from "./common.mjs";
// {switch.<prefix>} in an option's damageType - a generated DialogSelect option's key (round 11, group G).
import { fillSwitch } from "../g/select.mjs";

/**
 * HitRider - what a landed hit does on the check card, as a rule (round 10, group B). Read on each hit of a weapon
 * attack (helpers/extensions.mjs registerHitRider - target-riders.mjs#attackRiders, once the hit has damage) or, with
 * `on: "cast"`, on each successful row of a spell / power cast with damage (registerPostRoll):
 *
 *   note: formula       an unscaled damage bonus on the hit ("+1 (Focused Blast)") - not multiplied by Degrees of
 *                       Success, the same as an unscaled dealt DamageModifier, but able to read the roll's switches
 *   negate: true        the hit deals nothing (a note taking all its damage off - Softenblows)
 *   damageType: text    the hit deals this type instead ("Apply as X"): a type key, or {choice.<key>} (a pick)
 *   damageTypeFrom: p   ...the type stored at that path on the holder (left alone while it's empty)
 *   retypeFrom: type    ...only when the hit's type is this one now (Blunt unarmed hits become Sharp)
 *   retypeCrit: true    ...the Critical Success "double damage" option of that type too
 *   option: {damage, damageType, label?, key?, ignoreImmunity?}
 *                       an extra Apply button on the hit (a rider option): its own damage (a formula - @var.damage
 *                       is the hit's damage, @var.base the rolled attack's own damage value) and type
 *   siblings: {label?, fallback?: {damage, damageType, label?}}
 *                       every other attack of the rolled weapon as an option (its damage and type; "{effect}" in
 *                       the label is its name); none - the fallback option
 *   watch: "ally"       the rule acts on hits by OTHER actors on the holder's side (token disposition), the holder
 *                       anywhere in the world; one book item counts once however many hold it
 *   marked: <key>       the rule acts on hits by whoever carries that mark, set by the holder (mark step)
 *
 * `when` sees the hit: item: (the rolled attack), weapon:, skill:, attack:melee, roll:switch:<key>,
 * roll:dataset:<key>, item:damageType:<type> (the attack's own type), target: (the one hit); self: is the one who
 * hit, holder: the rule's holder.
 */

registerRuleType('HitRider', {
  params: {
    on: { kind: 'enum', options: ['attack', 'cast'] },
    note: { kind: 'formula' },
    negate: { kind: 'bool' },
    damageType: { kind: 'string' },
    damageTypeFrom: { kind: 'string' },
    retypeFrom: { kind: 'string' },
    retypeCrit: { kind: 'bool' },
    option: { kind: 'object' },
    siblings: { kind: 'object' },
    watch: { kind: 'enum', options: ['ally'] },
    marked: { kind: 'string' },
  },
  scopes: ['self', 'host'],
  validate: rule => [
    ...(['note', 'negate', 'damageType', 'damageTypeFrom', 'option', 'siblings'].some(key => rule[key] !== undefined && rule[key] !== false) ? [] : ['changes nothing']),
    ...(rule.option !== undefined ? optionErrors(rule.option, 'option') : []),
    ...(rule.siblings?.fallback !== undefined ? optionErrors(rule.siblings.fallback, 'siblings.fallback') : []),
    ...(rule.watch && rule.marked ? ['watch and marked can\'t both be set'] : []),
    ...(rule.retypeFrom && !rule.damageType && !rule.damageTypeFrom ? ['retypeFrom needs damageType or damageTypeFrom'] : []),
  ],
});

function optionErrors(option, where) {
  if (!option || typeof option != 'object') {
    return [`${where} must be {damage, damageType, label?}`];
  }

  const errors = [];
  if (option.damage === undefined || formulaError(option.damage)) {
    errors.push(`${where}.damage ${option.damage === undefined ? 'is required' : `: ${formulaError(option.damage)}`}`);
  }

  if (!option.damageType) {
    errors.push(`${where}.damageType is required`);
  }

  return errors;
}

/** The HitRider rules that bear on a hit by `attacker`: its own, those of whoever marked it, and allies' watch rules. */
export function hitRiderEntries(attacker) {
  const own = rulesOfType(attacker, 'HitRider').filter(({ rule }) => !rule.watch && !rule.marked).map(entry => ({ ...entry, holder: attacker }));
  const marked = [];
  for (const { key, mark } of marksOf(attacker)) {
    const setter = resolve(mark?.by);
    if (!setter) {
      continue;
    }

    for (const entry of rulesOfType(setter, 'HitRider')) {
      if (entry.rule.marked == key) {
        marked.push({ ...entry, holder: setter });
      }
    }
  }

  // watch: ally - the first holder of each book item on the attacker's side (the old "find a holder" reading).
  const watching = [];
  const seen = new Set();
  const side = dispositionOf(attacker);
  for (const other of worldActors()) {
    if (!other || other === attacker || (attacker?.uuid && other.uuid == attacker.uuid) || dispositionOf(other) != side) {
      continue;
    }

    for (const entry of rulesOfType(other, 'HitRider')) {
      const key = `${sourceOf(entry.item) ?? entry.item?.name}#${entry.index}`;
      if (entry.rule.watch == 'ally' && !seen.has(key)) {
        seen.add(key);
        watching.push({ ...entry, holder: other });
      }
    }
  }

  return [...own, ...marked, ...watching];
}

const noteOnAttack = tools => (result, amount, label) => tools.damageBonusNote(result, amount, label);

// A cast's rows have no damageBonusNote: "+N (label)" beside the rest, as More Bang for your Buck's own line did.
const noteOnCast = (result, amount, label) => {
  result.damageValue = num(result.damageValue) + amount;
  result.damageBonusLabel = [result.damageBonusLabel, `${amount < 0 ? '' : '+'}${amount} (${label})`].filter(Boolean).join(' ');
};

function addOption(result, option) {
  result.riderOptions = [...(result.riderOptions ?? []), { ...option, damageTypeLabel: damageTypeLabel(option.damageType) }];
}

function hostMatches(ruleItem, rolled) {
  const host = hostOf(ruleItem);
  return !!host && !!rolled && (rolled.id == host.id || rolled.flags?.essence20?.parentId == host.id);
}

/** One rule's effect on one hit. */
function applyEntry(entry, hit) {
  const { rule, item: ruleItem, holder, index } = entry;
  const { attacker, target, result, rolled, facts, note, mode } = hit;
  if ((rule.on ?? 'attack') != mode || ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, rolled))) {
    return;
  }

  if (evaluate(rule.when, contextFor({ ...facts, self: attacker, holder, ruleItem, other: target })) !== true) {
    return;
  }

  const vars = { damage: num(result.damageValue), base: num(rolled?.system?.damageValue) };
  const scope = { actor: holder, item: ruleItem, vars, other: target };
  const label = ruleLabel(rule, ruleItem);
  if (rule.negate) {
    if (num(result.damageValue)) {
      note(result, -num(result.damageValue), label);
    }
  } else if (rule.note !== undefined) {
    const amount = Math.round(resolveValue(rule.note, scope));
    if (amount) {
      note(result, amount, label);
    }
  }

  const type = rule.damageTypeFrom ? readPath(holder, rule.damageTypeFrom) : rule.damageType ? interpolate(String(rule.damageType), ruleItem) : null;
  if (type && (!rule.retypeFrom || result.damageType == rule.retypeFrom)) {
    const before = result.damageType;
    result.damageType = type;
    result.damageTypeLabel = damageTypeLabel(type);
    for (const option of rule.retypeCrit ? result.criticalOptions ?? [] : []) {
      if (option.key == 'double' && option.damageType == before) {
        option.damageType = type;
        option.damageTypeLabel = result.damageTypeLabel;
      }
    }
  }

  const key = `rule${ruleItem?.id ?? 'x'}${index}`;
  const optionFrom = (spec, suffix = '') => {
    const optionType = interpolate(fillSwitch(spec.damageType, facts.switches), ruleItem);
    if (!optionType) {
      return;
    }

    addOption(result, {
      key: spec.key ?? `${key}${suffix}`, label: spec.label ?? label,
      damageValue: Math.round(resolveValue(spec.damage, scope)), damageType: optionType,
      ...(spec.ignoreImmunity ? { ignoreImmunity: true } : {}),
    });
  };

  if (rule.option) {
    optionFrom(rule.option);
  }

  if (rule.siblings) {
    const parentId = rolled?.flags?.essence20?.parentId;
    const others = parentId ? itemsOf(attacker).filter(other => other.type == 'weaponEffect' && other.flags?.essence20?.parentId == parentId && other.id != rolled.id) : [];
    for (const other of others) {
      addOption(result, {
        key: `${key}${other.id}`, label: String(rule.siblings.label ?? '{effect}').replace(/\{effect\}/g, other.name ?? ''),
        damageValue: num(other.system?.damageValue), damageType: other.system?.damageType ?? 'maneuver',
      });
    }

    if (!others.length && rule.siblings.fallback) {
      optionFrom(rule.siblings.fallback, 'fallback');
    }
  }
}

/** A weapon attack's hit (target-riders.mjs#attackRiders, through registerHitRider). */
export function hitRiderOnAttack(attacker, target, result, rider = {}, tools = {}) {
  if (!result?.damageValue || !tools.damageBonusNote) {
    return;
  }

  const rolled = resolve(rider.itemUuid);
  const facts = {
    item: rolled, rolledSkill: rider.skill, isAttack: true, isMelee: rider.style == 'melee', switches: rider.switches ?? [],
    dataset: rider.dataset, damageType: rider.damageType ?? result.damageType, isCrit: !!tools.isCrit,
  };
  const hit = { attacker, target, result, rolled, facts, note: noteOnAttack(tools), mode: 'attack' };
  for (const entry of hitRiderEntries(attacker)) {
    applyEntry(entry, hit);
  }
}

/** A spell / power cast's successful rows with damage (registerPostRoll) - `on: "cast"` rules. */
export async function hitRiderOnCast(attacker, results, checkContext = {}, { rider = {} } = {}) {
  // rider.item: the spell itself, handed in by ext/i/cast.mjs#castHitDamage (a spell's later damage).
  const rolled = rider.item ?? resolve(rider.itemUuid);
  if (!rolled || rolled.type == 'weaponEffect') {
    return;
  }

  const entries = hitRiderEntries(attacker).filter(({ rule }) => rule.on == 'cast');
  if (!entries.length) {
    return;
  }

  for (const result of results ?? []) {
    if (!result?.success || !(num(result.damageValue) > 0)) {
      continue;
    }

    const target = result.targetUuid ? resolve(result.targetUuid) : null;
    const facts = { item: rolled, rolledSkill: rider.skill, isAttack: false, switches: rider.switches ?? [], dataset: rider.dataset, damageType: checkContext.damageType ?? rider.damageType };
    for (const entry of entries) {
      applyEntry(entry, { attacker, target, result, rolled, facts, note: noteOnCast, mode: 'cast' });
    }
  }
}

registerHitRider(hitRiderOnAttack);
registerPostRoll(hitRiderOnCast);
