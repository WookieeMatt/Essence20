import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `PetCommand {difTier}` (round 15, uses) - on a pet's item: commanding it is treated as that many Availability
 * steps different for the Command DIF (mechanics/companions/companions.mjs#commandDif: Standard 0, Limited 10, Restricted 15;
 * Agreeable: -1). The biggest step down counts. `when` sees the pet. Light on imports.
 */

// upshift (round 17, split3): ↑ on the Command a Pet roll for this pet, the commander's - companions.mjs#commandPet; the
// biggest counts (Agreeable, MLP: "Any Animal Handling Skill Test (by anyone) gains ↑1" - a command roll need not target it).
registerRuleType('PetCommand', {
  params: { difTier: { kind: 'number' }, upshift: { kind: 'number' } },
  scopes: ['self'],
  validate: rule => (rule.difTier === undefined && rule.upshift === undefined ? ['needs difTier or upshift'] : []),
});

/** The ↑ the pet's PetCommand rules give the roll that commands it (0 with none). */
export function rulePetCommandUpshift(pet) {
  return Math.max(0, ...rulesOfType(pet, 'PetCommand')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: pet, ruleItem: item })) === true)
    .map(({ rule }) => Number(rule.upshift) || 0));
}

/** The tier offset the pet's PetCommand rules give (0 with none). */
export function rulePetCommandTier(pet) {
  return Math.min(0, ...rulesOfType(pet, 'PetCommand')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: pet, ruleItem: item })) === true)
    .map(({ rule }) => Number(rule.difTier) || 0));
}
