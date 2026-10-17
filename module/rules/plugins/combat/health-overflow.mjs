// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the HealthOverflow rule type.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { registerDamageModifier } from "../../../mechanics/item-hooks.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `HealthOverflow {into, keep?}` - Health and another resource act as one pool for damage: damage that would take the
 * holder's Health to 0 or below comes out of the resource at `into` (a stored number path, e.g.
 * `system.powers.personal.value`) first, Health staying at `keep` (default 1) until the pool is gone - then both are
 * emptied. Damage below the Health left lands as usual. The resource is written with `{essence20Loss: true}` (a loss,
 * not a spend). A damage modifier (mechanics/item-hooks.mjs#registerDamageModifier), registered after the rules'
 * reductions so it shares out what is left of the hit; on whichever client applies the damage. `when` sees the holder
 * and the damage (`damage:<type>`, `damage>=N`). The first rule whose `when` holds is used. Body of Energy:
 * `{into: "system.powers.personal.value", when: ["self:morphed", "not:damage:stun"]}`.
 */
registerRuleType('HealthOverflow', {
  params: { into: { kind: 'string', required: true }, keep: { kind: 'number' } },
  scopes: ['self'],
  validate: rule => (/^system\.[\w.]+$/.test(String(rule.into ?? '')) ? [] : ['into must be a system. path']),
});

const read = (doc, path) => Number(path.split('.').reduce((at, key) => at?.[key], doc)) || 0;

/**
 * The split of a hit between Health and the pooled resource.
 * @returns {{health: Number, pool: Number}}   The new values.
 */
export function overflowSplit(health, pool, damage, keep = 1) {
  const total = Math.max(0, health + pool - damage);
  if (total <= 0) {
    return { health: 0, pool: 0 };
  }

  const newHealth = Math.min(Math.max(keep, health - damage), total);
  return { health: newHealth, pool: Math.max(0, total - newHealth) };
}

/** Damage about to land on `actor` after its HealthOverflow rule (the resource is written here). */
export async function healthOverflow(actor, amount, damageType) {
  if (!(amount > 0) || !actor) {
    return amount;
  }

  const entry = rulesOfType(actor, 'HealthOverflow').find(({ rule, item }) => !rule.disabled
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, damageType: damageType ?? '', damageAmount: amount })) === true);
  if (!entry) {
    return amount;
  }

  const health = read(actor, 'system.health.value');
  const pool = read(actor, entry.rule.into);
  if (amount < health || pool <= 0) {
    return amount;
  }

  const split = overflowSplit(health, pool, amount, Number.isFinite(Number(entry.rule.keep)) ? Number(entry.rule.keep) : 1);
  await actor.update({ [entry.rule.into]: split.pool }, { essence20Loss: true });
  return health - split.health;
}

registerDamageModifier((actor, amount, damageType) => healthOverflow(actor, amount, damageType));
