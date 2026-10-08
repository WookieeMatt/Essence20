import { RULE_TYPES } from "../../types.mjs";

/**
 * CriticalOption `defense: <toughness | evasion | willpower | cleverness>` (round 15, systems -
 * docs/rules-batches/slSystems15.md): a Critical Effect that deals 1 damage to the target's Defense instead of its
 * Essence (mechanics/combat/essence-damage.mjs - the Transformers printings of Bewildering, Traumatic, Maiming and
 * Surgical). rules/adapter.mjs#ruleCriticalOptions passes it on the option; the card labels it with the Defense's name.
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
const definition = RULE_TYPES.CriticalOption;
definition.params.defense = { kind: 'enum', options: DEFENSES };
{
  const inner = definition.validate;
  definition.validate = rule => (rule.defense
    ? (rule.essence || rule.status || rule.effect ? ['defense goes alone (no essence, status or effect with it)'] : [])
    : inner?.(rule) ?? []);
}
