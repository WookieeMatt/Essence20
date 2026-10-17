import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { dispositionOf, sceneActors } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: `InitiativeEdge {}` - Edge on an Initiative roll (dice.mjs INITIATIVE_EXTENSIONS, after the dialog). Scope
 * `self`: the holder's own; scope `sceneAllies`: every OTHER actor on the holder's side (same token disposition - the
 * active token's, else the prototype's) while the holder has a token on the viewed scene. `when` is asked with self =
 * the roller and holder = the rule's holder. Read at roll time, never in derived data (other tokens' actors aren't
 * touched while one prepares).
 */

registerRuleType('InitiativeEdge', { params: {}, scopes: ['self', 'sceneAllies'] });

const sameActor = (a, b) => a === b || (!!a?.id && a.id == b?.id) || (!!a?.uuid && a.uuid == b?.uuid);

/** Whether an Initiative roll by `actor` gets Edge from its own or a scene ally's InitiativeEdge rule. */
export function initiativeEdgeFor(actor, others = sceneActors()) {
  if (!actor) {
    return false;
  }

  const holds = (holder, scope) => rulesOfType(holder, 'InitiativeEdge', scope)
    .some(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === true);
  if (holds(actor, 'self')) {
    return true;
  }

  const seen = new Set();
  for (const other of others) {
    if (!other || sameActor(other, actor) || seen.has(other) || dispositionOf(other) != dispositionOf(actor)) {
      continue;
    }

    seen.add(other);
    if (holds(other, 'sceneAllies')) {
      return true;
    }
  }

  return false;
}

export async function initiativeEdge(actor, options) {
  if (options && initiativeEdgeFor(actor)) {
    options.edge = true;
  }
}

globalThis.Hooks?.once?.('init', async () => {
  const dice = await import("../../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(initiativeEdge);
});
