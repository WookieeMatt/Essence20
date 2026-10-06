// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): the bonded-partner link scopes and tags.
// Registered on import; see module/rules/plugins/index.mjs.
import { bondOf, bondedAlly } from "../../../mechanics/companions/bonded-partners.mjs";
import { registerLinkScope } from "../../links.mjs";
import { registerTag } from "../../predicate.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";

/**
 * Headmasters, Powermasters and Targetmasters (mechanics/companions/bonded-partners.mjs) keep their bond on the Perk
 * holder (flags.essence20.bond = {partner, linked}).
 *
 * Scopes (every rule type that takes `vehicle` takes these):
 *   bondPartner  on the bond holder's item: reaches the bonded partner (Advanced Link's +1 Health on the partner).
 *   bondHolder   on the partner's item: reaches the bond holder.
 * Tags:
 *   self:bondLinked            the actor is in a bond that is linked now (either side).
 *   self:bondHolder            the actor is the side that made the bond.
 *   roll:bondAllySpecialized   the rolled Skill is one the bonded ally is Specialized in (its own Specialized flag, or a
 *                              named Specialization) - Bonded Proficiency.
 *   roll:bondPairTrained       the actor and its bonded ally (linked or not) both have the rolled Skill at d2 or better -
 *                              Synaptic Linkage's once-a-scene Edge switch.
 */
const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

registerLinkScope('bondPartner', actor => {
  const bond = bondOf(actor);
  return bond && sameActor(bond.partner, actor) && !sameActor(bond.holder, actor) ? [bond.holder] : [];
});

registerLinkScope('bondHolder', actor => {
  const bond = bondOf(actor);
  return bond && sameActor(bond.holder, actor) && !sameActor(bond.partner, actor) ? [bond.partner] : [];
});

for (const scope of ['bondPartner', 'bondHolder']) {
  if (!SCOPES.includes(scope)) {
    SCOPES.push(scope);
  }

  for (const definition of Object.values(RULE_TYPES)) {
    if (definition.scopes?.includes('vehicle') && !definition.scopes.includes(scope)) {
      definition.scopes.push(scope);
    }
  }
}

registerTag('self:bondLinked', (rest, ctx) => !!bondOf(ctx?.self)?.linked);
registerTag('self:bondHolder', (rest, ctx) => sameActor(bondOf(ctx?.self)?.holder, ctx?.self));

registerTag('roll:bondAllySpecialized', (rest, ctx) => {
  const skill = ctx?.rolledSkill;
  if (!ctx?.self || !skill) {
    return null;
  }

  const fields = bondedAlly(ctx.self)?.system?.skills?.[skill];
  return !!fields && (!!fields.isSpecialized || Object.values(fields.specializations ?? {}).some(entry => entry?.name));
});

registerTag('roll:bondPairTrained', (rest, ctx) => {
  const skill = ctx?.rolledSkill;
  if (!ctx?.self || !skill) {
    return null;
  }

  const order = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const trained = actor => order.indexOf(actor?.system?.skills?.[skill]?.shift ?? 'd20') <= order.indexOf('d2');
  const ally = bondedAlly(ctx.self);
  return !!ally && trained(ctx.self) && trained(ally);
});
