// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; kept light so
// mechanics/resources/kits.mjs can import it (steps are loaded only when an option runs).
import { rulesOf } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rules a kit carries for its own Use button (mechanics/resources/kits.mjs#useKit, which comes before any rules Use):
 *
 *  - `KitOption {label, cost?: standard | move | free, steps}` - one more choice in the kit's "What do you do with the kit?"
 *    list, offered first while `when` holds (self = the user, `rule:` the kit). Chosen: the action is paid (in combat),
 *    the steps run as the user with the user's targets, and their chat lines are the kit's message. WTNV's Medicine Kit:
 *    used up as a Standard action in combat to heal 2 Health on the user or an ally.
 *  - `KitSkill {skill, spec?}` - the kit's Skill and Specialization, where its name doesn't say them (kits.mjs#kitInfo):
 *    Night Vale's Medicine, Science and Travel Reporter kits.
 */

registerRuleType('KitOption', {
  params: { cost: { kind: 'enum', options: ['standard', 'move', 'free'] }, steps: { kind: 'object', required: true } },
  scopes: ['self'],
});

registerRuleType('KitSkill', {
  params: { skill: { kind: 'string', required: true }, spec: { kind: 'string' } },
  scopes: ['self'],
});

const own = (item, type) => rulesOf(item).map((rule, index) => ({ rule, index })).filter(({ rule }) => rule?.type == type && !rule.disabled);

/** The kit's own KitSkill: {skill, spec} (spec null when none), or null. */
export function ruleKitSkill(item) {
  const found = own(item, 'KitSkill')[0]?.rule;
  return found?.skill ? { skill: found.skill, spec: found.spec ?? null } : null;
}

/** The kit's KitOption rules offered now: [{key, label, rule}]. */
export function ruleKitOptions(actor, item) {
  const localize = text => (String(text ?? '').startsWith('E20.') ? globalThis.game?.i18n?.localize?.(text) ?? text : String(text ?? ''));
  return own(item, 'KitOption')
    .filter(({ rule }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true)
    .map(({ rule, index }) => ({ key: `rule${index}`, label: localize(rule.label) || item.name, rule }));
}

/**
 * Run a chosen KitOption. `pay(action)` spends the action (false: not paid, nothing happens).
 * @returns {Promise<String|null>}   The chat line, or null when nothing happened.
 */
export async function runKitOption(actor, item, rule, pay) {
  if (rule.cost && !(await pay(rule.cost))) {
    return null;
  }

  const { runSteps, stepContext } = await import("../../steps.mjs");
  const ctx = stepContext({ actor, item, rule });
  const finished = await runSteps(rule.steps ?? [], ctx);
  return finished || ctx.chat.length ? ctx.chat.join(' ') || null : null;
}
