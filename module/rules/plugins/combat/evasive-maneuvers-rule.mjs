import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { crewing } from "../shared/zord-crew-lookups.mjs";

/**
 * Round 15 (items2) - rule EvasiveManeuvers {} (Fly In The Future: halving an Aerial vehicle's speed
 * makes every attack on it target Evasion instead of Toughness). With `scope: "vehicle"` a
 * crew member's rule reaches the vehicle they ride (rules/links.mjs). While one holds, an Aerial vehicle (Aerial base
 * speed above 0) flies evasively: documents/actor.mjs halves its Aerial Movement (rounded down, after Lightning Speed)
 * and dice.mjs turns a Toughness-targeted attack against it to Evasion (RollModifier immune: evasiveManeuvers lifts it).
 *
 * The vehicle's own flags.essence20.evasiveManeuversActive (Evasive Handling's rules keep it) counts too, Aerial or not.
 *
 * Tag self:crewsAerial - the actor is aboard (any seat) a vehicle or Zord with an Aerial base speed.
 * A crew member's toggle changing re-prepares the vehicle they ride, so its Movement shows the change at once.
 */
registerRuleType('EvasiveManeuvers', { params: {}, scopes: ['self', 'vehicle'] });

const aerial = actor => (Number(actor?.system?.movement?.aerial?.base) || 0) > 0;

export function ruleEvasiveManeuvers(actor) {
  if (actor?.flags?.essence20?.evasiveManeuversActive) {
    return true;
  }

  if (!actor || !aerial(actor)) {
    return false;
  }

  const entries = [...rulesOfType(actor, 'EvasiveManeuvers', 'self').map(entry => ({ ...entry, holder: actor })), ...linkedEntries(actor, 'EvasiveManeuvers')];
  return entries.some(({ rule, item, holder }) => evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === true);
}

registerTag('self:crewsAerial', (rest, ctx) => aerial(crewing(ctx?.self)?.vehicle), { phrase: ['{who} crew{s} a flying vehicle', '{who} {doesnt} crew a flying vehicle'] });

globalThis.Hooks?.on?.('updateItem', item => {
  const actor = item?.parent;
  if (!actor || !(item.system?.rules ?? []).some(rule => rule?.type == 'EvasiveManeuvers')) {
    return;
  }

  const vehicle = crewing(actor)?.vehicle;
  if (vehicle) {
    vehicle.reset?.();
    if (vehicle.sheet?.rendered) {
      vehicle.sheet.render?.(false);
    }
  }
});
