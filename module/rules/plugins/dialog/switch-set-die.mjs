// Rules-engine plug-ins, round 17 (split1 - docs/rules-batches/slSplit117.md): DialogSwitch setDie.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { ruleId, rulesOfType } from "../../index.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * `DialogSwitch setDie: <die>` - ticked, the roll's final Skill Die is that one, whatever the shifts made it, and the roll
 * has neither Edge nor Snag. Decided in dice.mjs#rollSkill once the final die is worked out (after a capDie switch's d12
 * cap) and BEFORE the automatic-failure check, so a roll shifted all the way down still gets the die - and the later
 * shots of a Fanning volley get it too. Savant Skill: `{setDie: "d4", when: ["skill:{item.choice}"]}`.
 */

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.setDie ??= { kind: 'string' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => [
    ...inner(rule).filter(error => !(rule.setDie && error == 'changes nothing')),
    ...(rule.setDie !== undefined && !/^d(2|4|6|8|10|12|20)$/.test(String(rule.setDie)) ? ['setDie must be a die (d2 ... d20)'] : []),
  ];
}

/**
 * The die a ticked setDie switch fixes the roll at, or null.
 * @param {Actor} actor
 * @param {Object} options   The Roll Options Dialog's options (ext - the ticked rule switches).
 * @returns {?String}
 */
export function ruleSetDie(actor, options) {
  const ticked = options?.ext ?? {};
  if (!actor) {
    return null;
  }

  const found = rulesOfType(actor, 'DialogSwitch').find(({ rule, item, index }) => rule.setDie && !!ticked[ruleId(item, index)]);
  return found ? found.rule.setDie : null;
}
