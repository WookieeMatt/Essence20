import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `Multiplier` - the roller's Degrees of Success on each row of the check card, worked out where
 * dice.mjs#_rollSkillHelper builds every row's multiplier (so damage, damage bonuses and Critical Success riders all
 * follow it).
 *
 *  - `doubleMargin: N` - a row with a DIF is a Critical Success (x2) when the total beats it by N or more, otherwise a
 *    plain success / failure (instead of the usual double-the-DIF; Precision: 10). First, before the rest.
 *  - `critMultiplier: N` - a x2 row becomes xN (Devastating Strike: 3 on melee attacks).
 *  - `promote: true` - a plain success (x1) becomes a Critical Success (x2) (Sucker Punch), after Powerful Suggestions.
 *
 * `when` sees the roll (`attack`, `attack:melee`, `item:`, `skill:`, switches) with the row's target as the other party
 * (`target:notActed`). `limit` is checked once per roll and used up once when some row changed.
 */

registerRuleType('Multiplier', {
  params: { doubleMargin: { kind: 'formula' }, critMultiplier: { kind: 'formula' }, promote: { kind: 'bool' }, limit: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => (rule.doubleMargin === undefined && rule.critMultiplier === undefined && !rule.promote ? ['changes nothing'] : []),
});

/**
 * The roller's Multiplier rules for one roll: `adjust(entry, multiplier, stage, total)` per row (stage `early` - the
 * margin and the crit multiplier - or `promote`), then `await spend()` to use up the limits of those that changed a row.
 * @param {Actor} actor
 * @param {Object} roll   {item, rolledSkill, isAttack, isMelee, switches, dataset}
 */
export function ruleMultipliers(actor, roll = {}) {
  const entries = (actor ? rulesOfType(actor, 'Multiplier') : []).filter(({ rule, item, index }) => !rule.limit?.per || usesLeft(actor, rule, item, index) > 0);
  const used = new Set();
  const holds = (entry, row) => {
    const other = row?.targetUuid ? globalThis.fromUuidSync?.(row.targetUuid) ?? null : null;
    return evaluate(entry.rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: entry.item, other })) === true;
  };

  return {
    any: entries.length > 0,
    adjust(row, multiplier, stage, total) {
      let value = multiplier;
      for (const entry of entries) {
        const { rule, item } = entry;
        const before = value;
        if (stage == 'early' && rule.doubleMargin !== undefined && Number(row?.difficulty) && holds(entry, row)) {
          const margin = Math.round(resolveValue(rule.doubleMargin, { actor, item }, 10));
          value = total - row.difficulty >= margin ? 2 : (total >= row.difficulty ? 1 : 0);
        }

        if (stage == 'early' && rule.critMultiplier !== undefined && value == 2 && holds(entry, row)) {
          value = Math.round(resolveValue(rule.critMultiplier, { actor, item }, 2));
        }

        if (stage == 'promote' && rule.promote && value == 1 && holds(entry, row)) {
          value = 2;
        }

        if (value != before) {
          used.add(entry);
        }
      }

      return value;
    },
    async spend() {
      for (const { rule, item, index } of used) {
        if (rule.limit?.per) {
          await recordUse(actor, rule, item, index);
        }
      }
    },
  };
}
