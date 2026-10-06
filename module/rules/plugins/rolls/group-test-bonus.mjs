// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): GroupTestBonus.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/rolls/group-tests.mjs loads it directly.
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `GroupTestBonus {upshift?, edge?, who?: self | led}` - bonuses on Skill Tests made as part of a Group Test
 * (mechanics/rolls/group-tests.mjs#groupBonuses, the card's own rolls): `self` (default) - the holder's own roll;
 * `led` - every roll in a Group Test the holder leads, the holder's own included (Bowling Team: ↑1). Listed on the roll
 * by the rule's label. `when` sees the one rolling as `self:` and the holder as `holder:`.
 */
registerRuleType('GroupTestBonus', {
  params: { upshift: { kind: 'formula' }, edge: { kind: 'bool' }, who: { kind: 'enum', options: ['self', 'led'] } },
  scopes: ['self'],
  validate: rule => (rule.upshift === undefined && !rule.edge ? ['needs upshift or edge'] : []),
});

/**
 * Fold the GroupTestBonus rules that reach this roll into `out` ({shiftUp, edge, labels}).
 * @param {Actor} actor    Who rolls.
 * @param {?Actor} leader  Who leads the Group Test.
 * @param {Object} out
 * @returns {Object}   `out`.
 */
export function addGroupTestBonuses(actor, leader, out) {
  const apply = (holder, who) => {
    for (const { rule, item } of rulesOfType(holder, 'GroupTestBonus')) {
      if ((rule.who ?? 'self') != who || evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) !== true) {
        continue;
      }

      out.shiftUp += Math.max(0, Math.round(Number(resolveValue(rule.upshift ?? 0, { actor: holder, item }, 0)) || 0));
      out.edge ||= !!rule.edge;
      out.labels.push(ruleLabel(rule, item));
    }
  };

  if (actor) {
    apply(actor, 'self');
  }

  if (leader) {
    apply(leader, 'led');
  }

  return out;
}
