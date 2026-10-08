// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): applyingDamage stages.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: chat.mjs loads it lazily.
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { DEFEAT_STAGES } from "./defeat-stage.mjs";

/**
 * applyingDamage Trigger `stage` (items1's event - rules/plugins/combat/applying-damage.mjs - fires its unstaged Triggers
 * once, before chat.mjs#onApplyDamage's reductions). A staged one runs at its own place in that chain instead:
 *   attacker      on the ATTACKER's items, before anything else (the hit can be taken over outright - Sudden Death):
 *                 `target:` is the one hit; the card's facts are `roll:dataset:<key>` (isMightMelee...); a step setting
 *                 `@var.handled` to 1 means the hit is dealt with - no damage is applied (the card's button is spent).
 *   reductions    on the one it lands on, right after the unstaged Triggers (Fortitude, Extra Plates, Didn't Even Feel It).
 *   lateReductions after Hard Corps (Invincibility Through Invisibility, Just a Graze).
 * Within a stage, by `priority`; each runs only while some damage is left. `@var.damage` / `@var.damageType` are the
 * hit; steps change `@var.damage` (setVar); `@var.dropSecondary` 1 drops the hit's second damage too. `prompt: true`
 * asks first (`promptText`: an E20. key or text with {name} - the one hit - and {amount}). Linked scopes reach too
 * (renegadeVehicle - Racer Abandon's driven vehicle): their limit is counted on the holder.
 */
export const DAMAGE_STAGES = ['attacker', 'reductions', 'lateReductions'];
for (const stage of DAMAGE_STAGES) {
  if (!DEFEAT_STAGES.includes(stage)) {
    DEFEAT_STAGES.push(stage);
  }
}

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function promptOf(rule, item, data) {
  const i18n = globalThis.game?.i18n;
  const raw = String(rule.promptText ?? '');
  if (!raw) {
    return i18n?.format?.('E20.Rules.TriggerPrompt', { name: ruleLabel(rule, item) }) ?? ruleLabel(rule, item);
  }

  return /^E20\./.test(raw) && i18n?.format ? i18n.format(raw, data) : raw.replace(/\{(\w+)\}/g, (match, key) => String(data[key] ?? match));
}

async function confirm(title, content) {
  const { DialogV2 } = globalThis.foundry.applications.api;
  return DialogV2.confirm({ window: { title }, content: `<p>${escape(content)}</p>`, rejectClose: false });
}

/**
 * Run one stage's applyingDamage Triggers.
 * @param {Actor} actor      Whose Triggers: the one hit, or (stage attacker) the attacker.
 * @param {Number} damage
 * @param {Object} options
 * @param {String} options.stage
 * @param {?Actor} [options.other]       The other party (the attacker, or - stage attacker - the one hit).
 * @param {?Actor} [options.hit]         The one hit (for {name} in a prompt).
 * @param {?String} [options.damageType]
 * @param {Object} [options.dataset]     The card's facts, for roll:dataset: tags.
 * @param {Function} [options.ask]       (title, content) => Promise<Boolean> (tests).
 * @returns {Promise<{damage: Number, dropSecondary: Boolean, handled: Boolean}>}
 */
export async function applyingDamageStage(actor, damage, { stage, other = null, hit = null, damageType = null, dataset = {}, ask = confirm } = {}) {
  const vars = { damage, damageType: damageType ?? '', dropSecondary: 0, handled: 0 };
  if (!actor) {
    return { damage, dropSecondary: false, handled: false };
  }

  const atStage = rule => rule?.event == 'applyingDamage' && rule.stage == stage && !rule.redirect && !rule.disabled;
  const own = rulesOfType(actor, 'Trigger').filter(entry => (entry.rule.scope ?? 'self') == 'self' && atStage(entry.rule)).map(entry => ({ ...entry, holder: actor }));
  const linked = linkedEntries(actor, 'Trigger').filter(entry => atStage(entry.rule));
  const entries = [...own, ...linked].sort((a, b) => (Number(a.rule.priority) || 0) - (Number(b.rule.priority) || 0));
  const { runSteps, stepContext } = entries.length ? await import("../../steps.mjs") : {};
  for (const { rule, item, index, holder } of entries) {
    // The attacker's stage may take over a hit of any amount; the reductions only run while damage is left.
    if ((stage != 'attacker' && !(Number(vars.damage) > 0)) || Number(vars.handled)) {
      break;
    }

    const facts = { self: actor, holder, ruleItem: item, other, vars, dataset, damageType: vars.damageType, damageAmount: vars.damage };
    if (evaluate(rule.when, contextFor(facts)) !== true || usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    if (rule.prompt && !(await ask(item?.name ?? '', promptOf(rule, item, { name: (hit ?? actor).name ?? '', amount: vars.damage })))) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets: other ? [other] : [] });
    Object.assign(ctx.vars, vars);
    const finished = await runSteps(rule.steps, ctx);
    Object.assign(vars, {
      damage: Math.max(0, Math.round(Number(ctx.vars.damage) || 0)), dropSecondary: ctx.vars.dropSecondary, handled: ctx.vars.handled,
    });
    if (finished) {
      await recordUse(holder, rule, item, index);
    }

    if (ctx.chat.length && globalThis.ChatMessage?.create) {
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: [`<strong>${escape(ruleLabel(rule, item))}</strong>`, ...ctx.chat].join('<br>') });
    }
  }

  return { damage: vars.damage, dropSecondary: !!Number(vars.dropSecondary), handled: !!Number(vars.handled) };
}
