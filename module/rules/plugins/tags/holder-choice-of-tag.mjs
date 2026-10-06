import { registerTag } from "../../predicate.mjs";
import { itemsOf, sourceOf } from "../shared/card-text-helpers.mjs";

/**
 * Round 15 (items2): `holder:choiceOf:<uuid>` - the rolled Skill is the one chosen (system.choice) on the rule HOLDER's
 * copy of that book item: `skill:choiceOf:<uuid>` read on the actor whose item the rule is (an aura's holder), not on
 * the one rolling. False with no rolled Skill (so no switch is offered), or when the holder has no copy or no choice.
 * (Influential: the holder's Field.)
 */
export function holderChoiceOfTag(rest, ctx) {
  if (ctx?.rolledSkill === undefined || ctx?.rolledSkill === null) {
    return false;
  }

  const holder = ctx.holder ?? ctx.self;
  const chosen = itemsOf(holder).find(item => sourceOf(item) == rest || item.uuid == rest)?.system?.choice;
  return !!chosen && ctx.rolledSkill == chosen;
}

registerTag('holder:choiceOf', holderChoiceOfTag);
