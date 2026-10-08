import { resolveValue } from "../../formula.mjs";
import { linkedEntries } from "../../links.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): Defense rules decided EARLY in an attack's difficulty - `early: true` - at the point in
 * dice.mjs's per-target loop where the hand-written "use Evasion if it's better" Perks sat: after the target's base
 * Defense (getDefenseValue, the attack's ignore-armor and Bypassing), its Shield Upgrade, the deflective / computerized
 * / Anti-Tank / Titan Class reductions, Defend, a Story Point boost, Ground Suppression and Double Agent - and before
 * Cover, the Defense bonuses that follow, the banked bonuses and the other Defense rules (ruleDefenseAdjust's add / best
 * / halve / fail and group C's addAfter / instead).
 *
 *  - `mode: "best"` + `from: [defenses]` (+ `plus: <formula>`): the attack meets the better of the Defense as it stands
 *    and each `from` Defense's PER-ATTACK value - getDefenseValue with the same ignore-armor the attack has, plus that
 *    Defense's Shield Upgrade bonus, plus `plus` (Psychological Warfare, Evasive, Split-Second Reaction, Tactical
 *    Gymnastics, Scapegoat). (A plain `best` compares the sheet totals, after everything else.)
 *  - `mode: "add"` (or none) + `amount`: added at that point (Tactical Gymnastics' Acrobatics Ranks to Evasion).
 *
 * Order: `best` rules without `plus`, then the adds, then `best` rules with `plus` (the hand-written order); within each,
 * rules with no limit before limited ones. A `limit` is used up only when the rule changed the number (Scapegoat's
 * once per scene); `key` names the rule in what dice.mjs gets back (`changed`), so a paired rider can ask (Scapegoat's
 * Hang-Up). `when` sees the attack (`item:`, `weapon:`, `attack:`), `defense:` (the Defense attacked), self = the rule's
 * holder, target = the other party. `outgoing: true` puts the rule on the attacker.
 */

const DEFENSE = RULE_TYPES.Defense;
DEFENSE.params.early ??= { kind: 'bool' };
DEFENSE.params.plus ??= { kind: 'formula' };
DEFENSE.params.key ??= { kind: 'string' };
{
  const inner = DEFENSE.validate;
  DEFENSE.validate = rule => [
    ...inner(rule),
    ...(rule.early && !['add', 'best'].includes(rule.mode ?? 'add') ? ['early works with mode add or best'] : []),
    ...(rule.plus !== undefined && !(rule.early && rule.mode == 'best') ? ['plus needs early: true and mode best'] : []),
  ];
}

/** The early Defense rules reaching this attack: the defender's own, the attacker's outgoing ones. */
function earlyEntries(attacker, defender) {
  const of = actor => [...rulesOfType(actor, 'Defense', 'self').map(entry => ({ ...entry, holder: actor })), ...linkedEntries(actor, 'Defense')];
  return [
    ...of(defender).filter(({ rule }) => rule.early && !rule.outgoing).map(entry => ({ ...entry, self: defender, other: attacker })),
    ...(attacker ? of(attacker).filter(({ rule }) => rule.early && rule.outgoing).map(entry => ({ ...entry, self: attacker, other: defender })) : []),
  ];
}

/**
 * The difficulty after the early Defense rules.
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defenseType   The Defense the attack is against.
 * @param {Number} difficulty    The difficulty so far.
 * @param {Object} ctx   {item, rolledSkill, rolledEssence, valueOf: key => that Defense's per-attack value}
 * @returns {Promise<{difficulty: Number, changed: Array<String>}>}   `changed`: the keys of the rules that changed it.
 */
export async function earlyDefenseAdjust(attacker, defender, defenseType, difficulty, ctx = {}) {
  const changed = [];
  if (!defender) {
    return { difficulty, changed };
  }

  const isAttack = ctx.item?.type == 'weaponEffect';
  const facts = { item: ctx.item, rolledSkill: ctx.rolledSkill, rolledEssence: ctx.rolledEssence, isAttack,
    isMelee: isAttack && ctx.item?.system?.classification?.style == 'melee', defenseType };
  const phase = ({ rule }) => ((rule.mode ?? 'add') == 'add' ? 1 : rule.plus !== undefined ? 2 : 0);
  const entries = earlyEntries(attacker, defender)
    .filter(({ rule }) => rule.defense == 'any' || rule.defense == defenseType)
    .sort((a, b) => (phase(a) - phase(b)) || ((a.rule.limit?.per ? 1 : 0) - (b.rule.limit?.per ? 1 : 0)));
  let value = difficulty;
  for (const { rule, item, index, holder, self, other } of entries) {
    if (rule.limit?.per && usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...facts, self, holder, ruleItem: item, other })) !== true) {
      continue;
    }

    let next = value;
    if ((rule.mode ?? 'add') == 'add') {
      next = value + Math.round(resolveValue(rule.amount, { actor: holder, item, other }, 0));
    } else {
      const plus = rule.plus !== undefined ? Math.round(resolveValue(rule.plus, { actor: holder, item, other }, 0)) : 0;
      for (const key of rule.from ?? []) {
        const against = Number(ctx.valueOf ? ctx.valueOf(key) : defender.system?.defenses?.[key]?.total) || 0;
        next = Math.max(next, against + plus);
      }
    }

    if (next == value) {
      continue;
    }

    value = next;
    if (rule.key) {
      changed.push(rule.key);
    }

    if (rule.limit?.per) {
      await recordUse(holder, rule, item, index);
    }
  }

  return { difficulty: value, changed };
}
