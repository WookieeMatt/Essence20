import { ruleDialogSwitches } from "../../adapter.mjs";
import { ruleLabel } from "../../index.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): `DialogSwitch tradeUpshifts: N` (with `spend: {max}` for the number box) - the roll gives up
 * the number of ↑ entered for 1 extra damage per N traded. Traded late in dice.mjs#rollSkill, once the roll's own ↑
 * total is settled, so no more than the roll actually has can go (the damage counts only what was traded). Size
 * Matters: 1 per ↑ against a larger vehicle, 1 per ↑2 against a larger creature (two switches).
 */

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.tradeUpshifts ??= { kind: 'number' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => inner(rule).filter(error => !(rule.tradeUpshifts && error == 'changes nothing'));
}

/**
 * Trade the ↑ entered in the actor's tradeUpshifts switches off `options.shiftUp` (in place).
 * @param {Actor} actor
 * @param {Object} options   The Roll Options Dialog's options (ext, shiftUp).
 * @param {Object} ctx       The roll, as the dialog saw it.
 * @returns {{damage: Number, sources: String[]}}
 */
export function tradeRuleUpshifts(actor, options, ctx = {}) {
  let damage = 0;
  const sources = [];
  for (const { name, entry } of actor ? ruleDialogSwitches(actor, ctx) : []) {
    const per = Math.round(Number(entry.rule.tradeUpshifts) || 0);
    const asked = Math.max(0, Math.round(Number(options?.ext?.[name]) || 0));
    const traded = per > 0 ? Math.min(asked, entry.max ?? asked, Number(options.shiftUp) || 0) : 0;
    if (traded <= 0) {
      continue;
    }

    options.shiftUp -= traded;
    const gained = Math.floor(traded / per);
    if (gained > 0) {
      damage += gained;
      sources.push(ruleLabel(entry.rule, entry.item));
    }
  }

  return { damage, sources };
}
