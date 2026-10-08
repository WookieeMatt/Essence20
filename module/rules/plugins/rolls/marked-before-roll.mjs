import { registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { runSteps, stepContext } from "../../steps.mjs";
import { carriedRules } from "../marks/rule-marks.mjs";
// The BeforeRoll rule type itself (registered there) - this file adds its marked scope.
import "../dialog/dialog-select.mjs";

/**
 * Round 18 (convA): BeforeRoll `scope: "marked"` + `mark: "<key>"` - the rule sits on the setter's item and is asked
 * before the dialog of every roll made by a creature carrying the setter's `<key>` mark (rules/plugins/marks/
 * rule-marks.mjs#carriedRules), the way the carrier's own BeforeRoll rules are (rules/plugins/dialog/dialog-select.mjs).
 * `when` sees self = the roller, holder = the setter, target = the roller's first target, the rolled item, its Skill
 * and how many targets there are (`roll:targets`, `roll:anyTarget:`); `steps` run as the roller; `cancel: true` refuses
 * the roll with `message` (an `E20.` key or text: `{name}` the roller, `{holder}` the setter). Stand Behind Me!: a
 * creature that failed its test can attack only the Gold Ranger.
 */

const BEFORE_ROLL = RULE_TYPES.BeforeRoll;
if (BEFORE_ROLL) {
  if (!BEFORE_ROLL.scopes.includes('marked')) {
    BEFORE_ROLL.scopes.push('marked');
  }

  BEFORE_ROLL.params.mark ??= { kind: 'string' };
  const inner = BEFORE_ROLL.validate;
  BEFORE_ROLL.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.scope == 'marked' && !rule.mark ? ['scope marked needs mark (the mark\'s key)'] : []),
    ...(rule.mark !== undefined && rule.scope != 'marked' ? ['mark only goes with scope marked'] : []),
  ];
}

function targetedActors() {
  return [...(globalThis.game?.user?.targets ?? [])].map(token => token?.actor).filter(Boolean);
}

function message(text, data) {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  const raw = /^E20\./.test(value) && i18n?.has?.(value) ? i18n.localize(value) : value;
  return raw.replace(/\{(\w+)\}/g, (match, key) => (data[key] ?? match));
}

/**
 * The carried BeforeRoll rules for this roll (see the file comment). Mutates the dataset (cancelRoll).
 * @param {Actor} actor   The roller (the mark's carrier).
 * @param {Object} dataset
 * @param {Item} item     The rolled item.
 */
export async function markedBeforeRoll(actor, dataset, item) {
  if (!actor || dataset?.cancelRoll) {
    return;
  }

  const targets = targetedActors();
  const isAttack = item?.type == 'weaponEffect';
  for (const { rule, item: ruleItem, holder } of carriedRules(actor, 'BeforeRoll', 'marked')) {
    const ctx = contextFor({
      item, rolledSkill: dataset?.skill, dataset, isAttack, isMelee: isAttack && item?.system?.classification?.style == 'melee',
      self: actor, holder, ruleItem, other: targets[0] ?? null, targetCount: targets.length,
    });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if (Array.isArray(rule.steps)) {
      const stepCtx = stepContext({ actor, item: ruleItem, rule, targets });
      await runSteps(rule.steps, stepCtx);
      if (stepCtx.chat.length) {
        await globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: stepCtx.chat.join('<br>') });
      }
    }

    if (rule.cancel) {
      globalThis.ui?.notifications?.warn?.(message(rule.message, { name: actor.name ?? '', holder: holder?.name ?? '' }));
      dataset.cancelRoll = true;
      return;
    }
  }
}

registerPreRoll(markedBeforeRoll);
