import { ruleId, rulesOfType } from "../../index.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): `DialogSwitch clearPenalties: true` - ticked, the roll ends up with no Snag and no ↓ at all,
 * decided at the very end of dice.mjs#rollSkill's post-dialog chain (after Observer, the Prime Snags and everything else
 * that adds a Snag or a ↓ once the dialog has closed) - where Ambitious's checkbox zeroed them. Its limit is spent as
 * for any switch, when it's ticked (so it is read here by its ticked box, not by asking which switches are still offered).
 */

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.clearPenalties ??= { kind: 'bool' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => inner(rule).filter(error => !(rule.clearPenalties && error == 'changes nothing'));
}

/**
 * Whether one of the actor's ticked switches clears the roll's penalties.
 * @param {Actor} actor
 * @param {Object} options   The Roll Options Dialog's options (ext).
 */
export function ruleClearsPenalties(actor, options) {
  const ticked = options?.ext ?? {};
  return !!actor && rulesOfType(actor, 'DialogSwitch').some(({ rule, item, index }) => rule.clearPenalties && !!ticked[ruleId(item, index)]);
}
