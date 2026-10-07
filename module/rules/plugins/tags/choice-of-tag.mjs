// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerTag } from "../../predicate.mjs";
import { itemsOf, sourceOf } from "../shared/zord-crew-lookups.mjs";
import { hasAnyChoice } from "../../choice-read.mjs";

/**
 * self:choiceOf:<uuid> (target: too) - the actor holds a copy of that book item with a pick made on it (rules/choice-read.mjs):
 * the Empathy Perk's chosen Skill that Tender rolls (tender.mjs#getEmpathyChoice). A rollVsEach / roll `skill:
 * "choiceOf:<uuid>"` rolls that Skill.
 */
export function choiceOfTag(actor, rest) {
  const uuid = String(rest ?? '');
  if (!uuid || !actor) {
    return false;
  }

  return itemsOf(actor).some(item => (sourceOf(item) == uuid || item.uuid == uuid) && hasAnyChoice(item));
}

registerTag('self:choiceOf', (rest, ctx) => choiceOfTag(ctx?.self, rest), { phrase: ['{poss} choice for {name} matches', "{poss} choice for {name} doesn't match"] });
registerTag('target:choiceOf', (rest, ctx) => (ctx?.other ? choiceOfTag(ctx.other, rest) : null), { phrase: ['{poss} choice for {name} matches', "{poss} choice for {name} doesn't match"] });
