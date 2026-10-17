// Round 15 (items1): reactions to an ally being rolled against, before the roll - events allyTargeted / allyDefended,
// step boostDefense. Defender Step (+ Swift Defender, Continuous Stance's number), Retribution.
import { RULE_TYPES, registerEvent } from "../../types.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerStep, runSteps, stepContext } from "../../steps.mjs";
import { resolveValue } from "../../formula.mjs";

/**
 * `allyTargeted` - a roll is about to be made against an ally's Defense (dice.mjs works out each target's DIF after the
 * Roll Options Dialog, before the dice): every OTHER actor on the target's side on the canvas
 * (mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens, any range) holding such a Trigger is asked in turn, on the
 * roller's client. The Trigger's target is the ally attacked; `@var.attacker` the attacker's uuid. `when` sees self =
 * the reactor, target = the ally. `prompt: true` asks first - `promptText` (an E20. key or text with {reactor}, {ally},
 * {attacker}) is the question. Step **`boostDefense {amount}`** raises the ally's Defense against this one roll; the
 * first reactor whose run finishes with a boost is the only one - nobody else is asked.
 *
 * `allyDefended` - once that roll's rows are worked out, on the reactor whose boost it was: `@var.outcome` is `hit` (it
 * hit the ally anyway), `turned` (it would have hit without the boost) or `missed` (it missed either way) - the raw total
 * against the boosted DIF, as computeMultiplier reads it. The Trigger's target is the attacker.
 */
registerEvent('allyTargeted');
registerEvent('allyDefended');

if (RULE_TYPES.Trigger && !RULE_TYPES.Trigger.params.promptText) {
  RULE_TYPES.Trigger.params.promptText = { kind: 'string' };
}

/** boostDefense {amount} - in an allyTargeted Trigger: the attacked ally's Defense against the coming roll goes up. */
registerStep('boostDefense', async (step, ctx) => {
  const amount = Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1));
  ctx.vars.defenseBoost = (Number(ctx.vars.defenseBoost) || 0) + amount;
}, { errors: (step, where) => (step.amount === undefined ? [`${where}: boostDefense needs an amount`] : []) });

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function confirmReaction(rule, item, names) {
  const i18n = globalThis.game?.i18n;
  const text = String(rule.promptText ?? '');
  const question = /^E20\./.test(text) && i18n?.has?.(text) ? i18n.format(text, names)
    : text ? text.replace(/\{(reactor|ally|attacker)\}/g, (match, key) => names[key] ?? '')
      : i18n?.format?.('E20.Rules.TriggerPrompt', { name: ruleLabel(rule, item) }) ?? ruleLabel(rule, item);
  const { DialogV2 } = globalThis.foundry.applications.api;
  return DialogV2.confirm({ window: { title: item?.name ?? '' }, content: `<p>${escape(question)}</p>`, rejectClose: false });
}

/**
 * Ask the target's allies' allyTargeted Triggers, for one target of a roll about to be made.
 * @param {Actor} target     The ally rolled against.
 * @param {?Actor} attacker  Who rolls.
 * @param {Object} [options]
 * @param {Function} [options.confirm]   (rule, item, names) => Promise<Boolean> (tests).
 * @returns {Promise<{bonus: Number, reactorUuid: ?String}>}   The boost, and whose it was.
 */
export async function allyDefenseReactions(target, attacker, { confirm = confirmReaction } = {}) {
  const none = { bonus: 0, reactorUuid: null };
  if (!target) {
    return none;
  }

  let tokens = [];
  try {
    const { getNearbyAllyTokens } = await import("../../../mechanics/combat/nearby-allies.mjs");
    tokens = getNearbyAllyTokens(target, Infinity) ?? [];
  } catch (error) {
    tokens = [];
  }

  const reactors = [...new Set(tokens.map(token => token?.actor).filter(reactor => reactor && reactor !== target))];
  for (const reactor of reactors) {
    for (const { rule, item, index } of rulesOfType(reactor, 'Trigger')) {
      if (rule.event != 'allyTargeted' || rule.disabled) {
        continue;
      }

      const vars = { attacker: attacker?.uuid ?? '' };
      if (evaluate(rule.when, contextFor({ self: reactor, holder: reactor, ruleItem: item, other: target, vars })) !== true
        || usesLeft(reactor, rule, item, index) <= 0) {
        continue;
      }

      if (rule.prompt && !(await confirm(rule, item, { reactor: reactor.name, ally: target.name, attacker: attacker?.name ?? '?' }))) {
        continue;
      }

      const ctx = stepContext({ actor: reactor, item, rule, targets: [target] });
      Object.assign(ctx.vars, vars, { defenseBoost: 0 });
      const finished = await runSteps(rule.steps, ctx);
      if (finished) {
        await recordUse(reactor, rule, item, index);
      }

      if (ctx.chat.length && globalThis.ChatMessage?.create) {
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor: reactor }), content: [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat].join('<br>') });
      }

      const bonus = Number(ctx.vars.defenseBoost) || 0;
      if (finished && bonus > 0) {
        return { bonus, reactorUuid: reactor.uuid ?? null };
      }
    }
  }

  return none;
}

/** A plain Degrees-of-Success read (mechanics/combat/combat.mjs#computeMultiplier). */
const succeeds = (total, difficulty) => !!difficulty && total >= difficulty;

/**
 * How a boosted row came out (see allyTargeted): 'hit', 'turned', 'missed' - or null when no reactor boosted it.
 * @param {Object} entry   The row: {difficulty, defenderStepBonus, defenderStepReactorUuid}.
 * @param {Number} total   The roll's total.
 */
export function allyDefenseOutcome(entry, total) {
  if (!entry?.defenderStepReactorUuid) {
    return null;
  }

  if (succeeds(total, entry.difficulty)) {
    return 'hit';
  }

  return succeeds(total, entry.difficulty - (Number(entry.defenderStepBonus) || 0)) ? 'turned' : 'missed';
}

/** Fire allyDefended on each reactor of a roll's boosted rows: [{reactorUuid, outcome}]. */
export async function fireAllyDefended(attacker, outcomes = []) {
  const { fireTriggers } = await import("../../triggers.mjs");
  for (const { reactorUuid, outcome } of outcomes) {
    const reactor = reactorUuid ? await globalThis.fromUuid?.(reactorUuid) : null;
    if (reactor && outcome) {
      await fireTriggers(reactor, 'allyDefended', { targets: attacker ? [attacker] : [], vars: { outcome } });
    }
  }
}
