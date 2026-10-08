import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `PartyRequisition {perMember}` (round 15, uses) - on a Party member's item: the Party's pooled Requisition
 * budget (requisitionMax, when it is worked out from the roster) gains `perMember` per Player Character member. One book
 * item counts once however many members hold it (Base Technological Advancements). Read by documents/actor.mjs
 * #_preparePartyData. `when` sees the member holding it. Light on imports.
 */

registerRuleType('PartyRequisition', {
  params: { perMember: { kind: 'number', required: true } },
  scopes: ['self'],
});

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? item?.name;

/** What the Party's members' PartyRequisition rules add per member (each book item once). */
export function rulePartyRequisitionPerMember(members) {
  const seen = new Map();
  for (const member of members ?? []) {
    for (const { rule, item } of rulesOfType(member, 'PartyRequisition')) {
      const key = sourceOf(item);
      if (!seen.has(key) && evaluate(rule.when, contextFor({ self: member, ruleItem: item })) === true) {
        seen.set(key, Number(rule.perMember) || 0);
      }
    }
  }

  return [...seen.values()].reduce((sum, value) => sum + value, 0);
}
