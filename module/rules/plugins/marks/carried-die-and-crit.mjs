// Rules-engine plug-ins, round 17 (perm - docs/rules-batches/slPerm17.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { LINK_SOURCES } from "../../links.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { carriedRules } from "./rule-marks.mjs";

/**
 * Marks that carry a die and a d2 crit (Trade School, Technical Mastery):
 *
 * - `DieSubstitution` and `CritOnD2` take `scope: "marked"` + `mark: "<key>"` - the rule sits on the setter's item and
 *   reaches every creature carrying the setter's <key> mark (rules/plugins/marks/rule-marks.mjs#carriedRules), the way the
 *   other marked rule types do. Both are read before the Roll Options Dialog (dice.mjs initialShift / canCritD2), so a
 *   RollModifier `consumeMark` on the same mark - spent once the roll is made - is still there when they are asked.
 * - `DieSubstitution` `dieOf: "holder"` - the Skill dice in `skills` are read off the rule's holder (for a marked rule: the
 *   setter) instead of the actor rolling: "use your Technology die in place of their own" is
 *   `{mode: best, skills: ["technology"], dieOf: holder, scope: marked, mark: ...}`. rules/adapter.mjs#ruleDieSubstitution
 *   reads it.
 */

export const DIE_AND_CRIT = ['DieSubstitution', 'CritOnD2'];

for (const type of DIE_AND_CRIT) {
  const definition = RULE_TYPES[type];
  if (!definition) {
    continue;
  }

  if (!definition.scopes.includes('marked')) {
    definition.scopes.push('marked');
  }

  definition.params.mark ??= { kind: 'string' };
  const inner = definition.validate;
  definition.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.scope == 'marked' && !rule.mark ? ['scope marked needs mark (the mark\'s key)'] : []),
    ...(rule.mark !== undefined && rule.scope != 'marked' ? ['mark only goes with scope marked'] : []),
  ];
}

if (RULE_TYPES.DieSubstitution) {
  RULE_TYPES.DieSubstitution.params.dieOf = { kind: 'enum', options: ['self', 'holder'] };
}

// The marked creature's own rolls (rules/links.mjs#linkedEntries, which rules/adapter.mjs#affecting reads).
LINK_SOURCES.push((actor, type) => (DIE_AND_CRIT.includes(type) ? carriedRules(actor, type) : []));
