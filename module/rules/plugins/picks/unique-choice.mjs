// Round 15 (systems - docs/rules-batches/slSystems15.md): UniqueChoice, AnyGeneralPerkChoice.
// Import-light: sheet-handlers/perk-handler.mjs loads it directly.
import { rulesOf } from "../../index.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `UniqueChoice {}` - on a Perk that is taken several times, each copy picking a Skill: a copy can't pick a Skill another
 * copy on the actor already has (sheet-handlers/perk-handler.mjs - the 'skills' picker leaves them out, and a pick that
 * repeats one is refused). Read from the Perk being set up itself (the compendium item or the actor's copy), so it holds
 * from the first drop on. Expertise (GI Joe CRB, Commando).
 */
registerRuleType('UniqueChoice', {
  params: {},
  scopes: ['self'],
});

/** Whether this Perk's copies must each pick a different Skill. */
export function hasUniqueChoice(perk) {
  return rulesOf(perk).some(rule => rule?.type == 'UniqueChoice' && !rule.disabled);
}

/**
 * `AnyGeneralPerkChoice {}` - on a Perk whose own drop-time picker offers any General Perk from every enabled book
 * (sheet-handlers/perk-handler.mjs#anyGeneralPerkChoices - grouped by game line, leaving out the ones the actor has) rather
 * than a fixed list; the picked Perk then goes through its own picker as usual. Read from the Perk being set up itself.
 * Nobody Like Me (PR CRB, Oddball).
 */
registerRuleType('AnyGeneralPerkChoice', {
  params: {},
  scopes: ['self'],
});

/** Whether this Perk offers any General Perk rather than a fixed list. */
export function hasAnyGeneralPerkChoice(perk) {
  return rulesOf(perk).some(rule => rule?.type == 'AnyGeneralPerkChoice' && !rule.disabled);
}
