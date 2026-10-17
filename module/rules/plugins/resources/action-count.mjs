// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): ActionCount.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/actions/action-counts.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

/**
 * `ActionCount {action: free, essence? | add?}` - how many Free actions a turn gives (mechanics/actions/action-counts.mjs#
 * getNumActions: the Essence minus 2). `essence` - count them from that Essence instead of Speed (Quick Thinker,
 * University Days); `add` - treat the Essence as that much higher (Foot Soldier's +2 in Bot Mode: `when:
 * ["not:self:transformed"]`). An `essence` rule that applies wins over every `add` rule (the hand-written else-if);
 * otherwise the `add`s sum. Move and Standard actions still come from Speed.
 */
registerRuleType('ActionCount', {
  params: {
    action: { kind: 'enum', required: true, options: ['free'] },
    essence: { kind: 'enum', options: ESSENCES },
    add: { kind: 'number' },
  },
  scopes: ['self'],
  validate: rule => (rule.essence === undefined && rule.add === undefined ? ['needs essence or add'] : []),
});

/**
 * The Essence score Free actions are counted from, given the actor's Speed - or `speed` itself when no rule applies.
 * @param {Actor} actor
 * @param {Number} speed
 * @returns {Number}
 */
export function ruleFreeActionEssence(actor, speed) {
  const entries = rulesOfType(actor, 'ActionCount').filter(({ rule, item }) => rule.action == 'free'
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
  const swap = entries.find(({ rule }) => rule.essence);
  if (swap) {
    const essence = actor.system?.essences?.[swap.rule.essence];
    return essence?.max ?? essence?.value ?? 0;
  }

  return entries.reduce((total, { rule }) => total + (Number(rule.add) || 0), speed);
}
