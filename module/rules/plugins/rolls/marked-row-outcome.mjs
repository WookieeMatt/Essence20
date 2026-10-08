// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { carriedRules } from "../marks/rule-marks.mjs";

/**
 * `MarkedRowOutcome {promote?, consume: promoted | x2}` (scope `marked` + `mark`) - what a creature carrying the setter's
 * mark gets on the rows of its own rolls, where dice.mjs#_rollSkillHelper works each row's Degrees of Success out (after
 * the Multiplier rules' early stage, before their promotion):
 *
 *  - `promote: true` - a plain success (x1) becomes a Critical Success (x2); with `consume: promoted` the carrier's mark
 *    is used up once a row was promoted (Powerful Suggestions' "excel": "turns their next Success ... into a Critical
 *    Success").
 *  - `consume: x2` - the mark is used up once a row reaches x2 or more ("until they prove you wrong with a Critical
 *    Success" - its "fail" half).
 *
 * `when` sees the roll (`skill:`, `self:markText:<key>=$skill`...), self = the carrier, holder = the setter.
 */

registerRuleType('MarkedRowOutcome', {
  params: {
    promote: { kind: 'bool' },
    consume: { kind: 'enum', options: ['promoted', 'x2'] },
    mark: { kind: 'string' },
  },
  scopes: ['marked'],
  validate: rule => [
    ...(rule.scope != 'marked' || !rule.mark ? ['MarkedRowOutcome needs scope marked and mark (the mark\'s key)'] : []),
    ...(!rule.promote && !rule.consume ? ['changes nothing'] : []),
  ],
});

/**
 * The MarkedRowOutcome rules a roll's carrier answers: `adjust(multiplier)` per row, then `await spend()` uses up the
 * marks whose rule said so.
 * @param {Actor} actor   The roller (the carrier).
 * @param {Object} roll   {item, rolledSkill, isAttack, isMelee}
 */
export function markedRowOutcomes(actor, roll = {}) {
  const entries = actor ? carriedRules(actor, 'MarkedRowOutcome', 'marked')
    .filter(({ rule, item, holder }) => evaluate(rule.when, contextFor({ ...roll, self: actor, holder, ruleItem: item })) === true) : [];
  const spent = new Set();
  return {
    any: entries.length > 0,
    adjust(multiplier) {
      let value = multiplier;
      for (const { rule } of entries) {
        if (rule.promote && value == 1) {
          value = 2;
          if (rule.consume == 'promoted') {
            spent.add(rule.mark);
          }
        } else if (rule.consume == 'x2' && value >= 2) {
          spent.add(rule.mark);
        }
      }

      return value;
    },
    async spend() {
      if (!spent.size) {
        return;
      }

      const marks = actor.flags?.essence20?.ruleMarks ?? {};
      const names = Object.keys(marks).filter(name => spent.has(name.split('--')[0]));
      if (!names.length) {
        return;
      }

      const update = Object.fromEntries(names.map(name => [`flags.essence20.ruleMarks.-=${name}`, null]));
      const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
      await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
    },
  };
}
