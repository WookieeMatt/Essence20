import { rulesOfType } from "../../index.mjs";
import { LINK_SCOPES, linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (items2): rule type `EnvironmentalExpertise {shareEnvironments?}` - while `when` holds, the actor has
 * Environmental Expertise's benefits: an Edge on Skill Tests that aren't attacks (a Roll Options Dialog source labelled
 * with the rule's label, plus the scene's terrain when that's what put them in their environment), attacks Specialized,
 * Rough Terrain ignored - and every reader of mechanics/world/environmental-expertise.mjs#hasActiveEnvironmentalExpertise
 * (rerolls, environment-gated effects, the `check:environmentalExpertise` tag) sees it. Scopes `self` and `companion`
 * (a rule on the owner reaching their companions - In Their Element) and `driven` (on a driver, reaching the vehicle -
 * Adapted Vehicles). `shareEnvironments: true` on a companion-scoped
 * rule adds the holder's environments of expertise to the companion's own, whatever `when` says.
 * Tag `self:inExpertiseTerrain` - the scene's terrain where the actor stands is one of their environments of expertise
 * (false when no terrain is set - the toggle flag `self:data:flags.essence20.environmentalExpertiseActive` decides then).
 * Import-light: environmental-expertise.mjs imports this file and hands it its terrain reader.
 */
registerRuleType('EnvironmentalExpertise', { params: { shareEnvironments: { kind: 'bool' } }, scopes: ['self', 'companion', 'driven'] });

/**
 * The terrain readers, handed in when environmental-expertise.mjs loads: inEnvironment(actor, terrain?) =
 * isInEnvironmentOfExpertise (true / false / null with no terrain), terrainOf(actor) = the terrain where it stands.
 */
export const expertiseHelpers = { inEnvironment: null, terrainOf: null };

registerTag('self:inExpertiseTerrain', (rest, ctx) => expertiseHelpers.inEnvironment?.(ctx?.self) === true, { phrase: ['{who} {is} in an environment of expertise', '{who} {isnt} in an environment of expertise'] });

/**
 * self:onHolderExpertiseTerrain - the terrain where this actor stands (a vehicle) is one of the rule holder's
 * environments of expertise (its driver's - Adapted Vehicles, scope driven). False with no terrain set.
 */
registerTag('self:onHolderExpertiseTerrain', (rest, ctx) => {
  const terrain = expertiseHelpers.terrainOf?.(ctx?.self) ?? null;
  return !!terrain && !!ctx?.holder && expertiseHelpers.inEnvironment?.(ctx.holder, terrain) === true;
}, { phrase: ["{who} {is} in one of its owner's environments of expertise", "{who} {isnt} in one of its owner's environments of expertise"] });

/** Every EnvironmentalExpertise rule reaching the actor: its own (self scope), then linked ones, with their holder. */
function entriesFor(actor) {
  const own = rulesOfType(actor, 'EnvironmentalExpertise').filter(({ rule }) => !LINK_SCOPES.includes(rule.scope)).map(entry => ({ ...entry, holder: actor }));
  return [...own, ...linkedEntries(actor, 'EnvironmentalExpertise')];
}

/** The EnvironmentalExpertise rule giving the actor the benefits now ({rule, item, holder}), or null. */
export function ruleEnvironmentalExpertise(actor) {
  if (!actor) {
    return null;
  }

  return entriesFor(actor).find(({ rule, item, holder }) => evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === true) ?? null;
}

/** Environments of expertise a companion-scoped `shareEnvironments` rule adds (the holders' own). */
export function sharedExpertiseEnvironments(actor) {
  return linkedEntries(actor, 'EnvironmentalExpertise').filter(({ rule }) => rule.shareEnvironments)
    .flatMap(({ holder }) => (Array.isArray(holder?.system?.environments) ? holder.system.environments : []));
}
