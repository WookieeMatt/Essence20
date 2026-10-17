import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): DialogSwitch `syntheticDamage: {value, type}` - ticked, a roll that isn't a weapon attack (a
 * Skill Test against a target's Defense) carries that damage: dice.mjs feeds it into the card's ordinary damage, so
 * each row it beats gets an Apply Damage button, x Degrees of Success (Psychoanalyst's 2 Stun, Coax Surrender's 1 Stun,
 * Grinder's 2 Blunt, Deceptive Warfare's 1 Psychic). The first ticked one counts; a weapon attack keeps its own damage.
 * rules/adapter.mjs#applyRuleSwitches hands it to dice.mjs as options.ruleSyntheticDamage.
 */

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.syntheticDamage ??= { kind: 'object' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => {
    const damage = rule.syntheticDamage;
    const errors = inner(rule).filter(error => !(damage && error == 'changes nothing'));
    if (damage !== undefined && !(damage && typeof damage == 'object' && Number.isFinite(Number(damage.value)) && typeof damage.type == 'string')) {
      errors.push('syntheticDamage needs {value (a number), type}');
    }

    return errors;
  };
}
