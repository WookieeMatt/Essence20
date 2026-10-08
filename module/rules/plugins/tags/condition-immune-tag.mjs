import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (items2): `target:immune:<condition>` / `self:immune:<condition>` - the actor can't be given that Condition
 * (mechanics/combat/condition-immunity.mjs#isImmuneToCondition: the immunity Perks, ConditionImmunity rules, auras).
 * Terror's "provided they aren't immune to being Frightened". Loaded at setup (tests set immunityHelpers.isImmune);
 * before that, false.
 */
export const immunityHelpers = { isImmune: null };

globalThis.Hooks?.once?.('setup', () => {
  import("../../../mechanics/combat/condition-immunity.mjs")
    .then(module => {
      immunityHelpers.isImmune = module.isImmuneToCondition;
    })
    .catch(error => console.error('Essence20 | condition immunity tag failed to load', error));
});

function immune(actor, condition) {
  if (!actor || !condition) {
    return false;
  }

  return !!immunityHelpers.isImmune?.(actor, condition);
}

registerTag('target:immune', (rest, ctx) => immune(ctx?.other, rest), { phrase: ['{who} {is} immune to {arg}', '{who} {isnt} immune to {arg}'] });
registerTag('self:immune', (rest, ctx) => immune(ctx?.self, rest), { phrase: ['{who} {is} immune to {arg}', '{who} {isnt} immune to {arg}'] });
