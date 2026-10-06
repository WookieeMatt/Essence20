// Round 15 (items1): marks that keep a word - tags self:markText / target:markText. Instill Weakness.
import { registerTag } from "../../predicate.mjs";
import { liveMarks } from "./rule-marks.mjs";

/**
 * `mark {key, text}` (rules/steps.mjs) keeps a word on the mark - `{choice.<key>}` / `{var.<key>}` filled, e.g. the damage
 * type a pick chose. The tags read it:
 *
 *   target:markText:<key>=<text>    the other party carries a live <key> mark (any setter's) whose text is that
 *   self:markText:<key>=<text>      ...this actor does
 *   ...:markText:<key>!=<text>      carries one whose text differs
 *   ...:markText:<key>              carries one with any text
 *
 * `<text>` may be `$skill` - the rolled Skill - or `$item.<path>` - a value on the rolled item (`target:markText:instillWeakness=$item.system.damageType`:
 * the attack deals the type the mark names). Compared ignoring case. No mark - false.
 */
export function markTexts(actor, key) {
  return liveMarks(actor).filter(mark => mark.key == key && mark.mark?.text !== undefined && mark.mark?.text !== null).map(mark => String(mark.mark.text));
}

function markTextTag(actor, rest, ctx) {
  const match = /^([\w-]+)(?:(!=|=)(.+))?$/.exec(rest);
  if (!match || !actor) {
    return match ? false : null;
  }

  const texts = markTexts(actor, match[1]);
  if (!match[2]) {
    return texts.length > 0;
  }

  // $skill: the rolled Skill (round 15, items2 - Not Like That, Like This!'s owed Skill Test).
  // $var.<key>: a value the run / event hands the Trigger (round 16, part a - combatEnd's @var.combatId: Hard Corps).
  const fromVar = match[3].startsWith('$var.') ? ctx.vars?.[match[3].slice(5)] : undefined;
  const wanted = match[3] == '$skill' ? ctx.rolledSkill
    : match[3].startsWith('$var.') ? fromVar
      : match[3].startsWith('$item.')
        ? globalThis.foundry?.utils?.getProperty?.(ctx.item ?? {}, match[3].slice(6))
        : match[3];
  if (wanted === undefined || wanted === null || wanted === '') {
    return false;
  }

  const lower = value => String(value).toLowerCase();
  const same = texts.some(text => lower(text) == lower(wanted));
  return match[2] == '=' ? same : texts.length > 0 && !same;
}

registerTag('target:markText', (rest, ctx) => markTextTag(ctx.other, rest, ctx));
registerTag('self:markText', (rest, ctx) => markTextTag(ctx.self, rest, ctx));
