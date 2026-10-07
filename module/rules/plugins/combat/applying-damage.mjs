// Round 15 (items1): damage about to land - events applyingDamage (the chat card's Apply Damage) and damageLanding (any
// damage, the GM's client), steps takeAsEssence / unmorph. Interpose x2, Body Shield, Heroic Sacrifice, Golden Guardian
// (+ Counterstrike), Stand By Me, Fe-BURN!, Cyborg.
import { registerDamageModifier } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES, registerEvent } from "../../types.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerStep, runSteps, stepContext } from "../../steps.mjs";

/**
 * `applyingDamage` - the GM pressed a check card's Apply Damage for a hit with damage (chat.mjs#onApplyDamage, where the
 * hand-written "take the hit for them" checks sat, before Fortitude, Just a Graze and the rest of the reductions):
 *
 * 1. Protectors: an ally of the one hit (any other token on its side - mechanics/combat/nearby-allies.mjs) whose Trigger
 *    has `redirect: true` and `within` (feet, a formula read for the protector - "2 * @actor.system.movement.ground.total"
 *    for a Sprint) reaching the one hit, its `when` (self = the protector, target = the attacker), limit and cost
 *    holding. Only the FIRST such candidate - lowest `priority`, then token order - is offered (the damage-redirect
 *    question); if the GM agrees its steps run and the hit lands on the protector instead (its whole damage, against
 *    the protector's own resistances). Steps see the attacker as target (`setTargets {to: target}` - Counterstrike).
 * 2. The one it now lands on: its own applyingDamage Triggers (no `redirect`) - `prompt` asks first (`promptText`: an
 *    E20. key or text with {name}, {amount} and {@formula}); `@var.damage` / `@var.damageType` are the hit, and a step
 *    may change `@var.damage` (setVar) - what lands. `@var.dropSecondary` set to 1 drops the hit's second damage too.
 *
 * `damageLanding` - damage about to land on an actor by any path (mechanics/combat/combat.mjs#applyDamage, among the
 * extensions' damage modifiers), on the GM's client only: the actor's Triggers with `@var.damage` / `@var.damageType`;
 * steps change `@var.damage` (Cyborg's `takeAsEssence`).
 */
registerEvent('applyingDamage');
registerEvent('damageLanding');

const TRIGGER = RULE_TYPES.Trigger;
if (TRIGGER) {
  TRIGGER.params.redirect ??= { kind: 'bool' };
  TRIGGER.params.priority ??= { kind: 'number' };
  TRIGGER.params.promptText ??= { kind: 'string' };
  if (!TRIGGER.params.within || TRIGGER.params.within.kind == 'number') {
    // A Sprint's reach is a formula ("2 * @actor.system.movement.ground.total"); watch Triggers keep reading numbers.
    TRIGGER.params.within = { kind: 'formula' };
  }
}

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function post(actor, rule, item, ctx) {
  if (ctx.chat.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: [`<strong>${escape(ruleLabel(rule, item))}</strong>`, ...ctx.chat].join('<br>') });
  }
}

function promptOf(rule, item, actor, data) {
  const i18n = globalThis.game?.i18n;
  const raw = String(rule.promptText ?? '');
  const text = /^E20\./.test(raw) && i18n?.has?.(raw) ? i18n.localize(raw) : raw;
  if (!text) {
    return i18n?.format?.('E20.Rules.TriggerPrompt', { name: ruleLabel(rule, item) }) ?? ruleLabel(rule, item);
  }

  return text.replace(/\{(\w+)\}/g, (match, key) => (data[key] ?? match))
    .replace(/\{(@[^}]+)\}/g, (match, formula) => String(Math.round(resolveValue(formula, { actor, item, vars: data }, 0))));
}

async function confirm(title, content) {
  const { DialogV2 } = globalThis.foundry.applications.api;
  return DialogV2.confirm({ window: { title }, content: `<p>${escape(content)}</p>`, rejectClose: false });
}

/** The ally Triggers that could take this hit, best first: [{holder, rule, item, index}]. */
async function redirectCandidates(target, attacker) {
  let tokens = [];
  try {
    const { getNearbyAllyTokens } = await import("../../../mechanics/combat/nearby-allies.mjs");
    tokens = getNearbyAllyTokens(target, Infinity) ?? [];
    const near = async (holder, feet) => getNearbyAllyTokens(holder, feet).some(token => token?.actor === target);
    const out = [];
    for (const [order, holder] of [...new Set(tokens.map(token => token?.actor).filter(actor => actor && actor !== target))].entries()) {
      for (const { rule, item, index } of rulesOfType(holder, 'Trigger')) {
        if (rule.event != 'applyingDamage' || !rule.redirect || rule.disabled) {
          continue;
        }

        const feet = rule.within === undefined ? Infinity : Number(resolveValue(rule.within, { actor: holder, item }, 0)) || 0;
        if (!(await near(holder, feet)) || usesLeft(holder, rule, item, index) <= 0
          || evaluate(rule.when, contextFor({ self: holder, holder, ruleItem: item, other: attacker })) !== true) {
          continue;
        }

        out.push({ holder, rule, item, index, order, priority: Number(rule.priority) || 100 });
      }
    }

    return out.sort((a, b) => a.priority - b.priority || a.order - b.order);
  } catch (error) {
    console.error('Essence20 | applyingDamage redirect lookup failed', error);
    return [];
  }
}

/**
 * The rules' answer to a hit about to land from the chat card (see the file comment).
 * @param {Actor} target
 * @param {Number} damage
 * @param {Object} [options]
 * @param {?Actor} [options.attacker]
 * @param {?String} [options.damageType]
 * @param {Boolean} [options.redirect]   Ask the protectors (false: a hand-written one already answered).
 * @param {Function} [options.ask]   (title, content) => Promise<Boolean> (tests).
 * @returns {Promise<{target: Actor, damage: Number, dropSecondary: Boolean}>}
 */
export async function applyingDamage(target, damage, { attacker = null, damageType = null, redirect = true, ask = confirm } = {}) {
  let landsOn = target;
  if (redirect && damage > 0) {
    const [best] = await redirectCandidates(target, attacker);
    const i18n = globalThis.game?.i18n;
    if (best && await ask(i18n?.localize?.('E20.DamageRedirectConfirmTitle') ?? 'Redirect', i18n?.format?.('E20.DamageRedirectConfirmContent', { protector: best.holder.name, target: target.name }) ?? best.holder.name)) {
      const ctx = stepContext({ actor: best.holder, item: best.item, rule: best.rule, targets: attacker ? [attacker] : [] });
      Object.assign(ctx.vars, { damage, damageType: damageType ?? '' });
      if (await runSteps(best.rule.steps, ctx)) {
        await recordUse(best.holder, best.rule, best.item, best.index);
        landsOn = best.holder;
      }

      await post(best.holder, best.rule, best.item, ctx);
    }
  }

  const vars = { damage, damageType: damageType ?? '', dropSecondary: 0 };
  for (const { rule, item, index } of rulesOfType(landsOn, 'Trigger')) {
    // A staged one (rules/plugins/combat/applying-damage-stages.mjs) runs at its own place in the chain instead.
    // redirectTo: the one hit's own redirect, asked first (rules/plugins/combat/self-redirect.mjs).
    if (rule.event != 'applyingDamage' || rule.redirect || rule.redirectTo || rule.stage || rule.disabled || !(Number(vars.damage) > 0)) {
      continue;
    }

    const ctxFacts = { self: landsOn, holder: landsOn, ruleItem: item, other: attacker, vars, damageType: vars.damageType, damageAmount: vars.damage };
    if (evaluate(rule.when, contextFor(ctxFacts)) !== true || usesLeft(landsOn, rule, item, index) <= 0) {
      continue;
    }

    if (rule.prompt && !(await ask(item?.name ?? '', promptOf(rule, item, landsOn, { name: landsOn.name, amount: vars.damage, ...vars })))) {
      continue;
    }

    const ctx = stepContext({ actor: landsOn, item, rule, targets: attacker ? [attacker] : [] });
    Object.assign(ctx.vars, vars);
    const finished = await runSteps(rule.steps, ctx);
    Object.assign(vars, { damage: Math.max(0, Math.round(Number(ctx.vars.damage) || 0)), dropSecondary: ctx.vars.dropSecondary });
    if (finished) {
      await recordUse(landsOn, rule, item, index);
    }

    await post(landsOn, rule, item, ctx);
  }

  return { target: landsOn, damage: vars.damage, dropSecondary: !!Number(vars.dropSecondary) };
}

/** damageLanding (see the file comment): the actor's Triggers may change the damage about to land. */
export async function damageLanding(actor, amount, damageType, { ask = confirm } = {}) {
  if (!(amount > 0) || !globalThis.game?.user?.isGM) {
    return amount;
  }

  const vars = { damage: amount, damageType: damageType ?? '' };
  for (const { rule, item, index } of rulesOfType(actor, 'Trigger')) {
    if (rule.event != 'damageLanding' || rule.disabled || !(Number(vars.damage) > 0)
      || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, vars, damageType: vars.damageType, damageAmount: vars.damage })) !== true
      || usesLeft(actor, rule, item, index) <= 0) {
      continue;
    }

    if (rule.prompt && !(await ask(item?.name ?? '', promptOf(rule, item, actor, { name: actor.name, amount: vars.damage, ...vars })))) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets: [] });
    Object.assign(ctx.vars, vars);
    const finished = await runSteps(rule.steps, ctx);
    vars.damage = Math.max(0, Math.round(Number(ctx.vars.damage) || 0));
    if (finished) {
      await recordUse(actor, rule, item, index);
    }

    await post(actor, rule, item, ctx);
  }

  return vars.damage;
}

registerDamageModifier((actor, amount, damageType) => damageLanding(actor, amount, damageType));

/**
 * `takeAsEssence {prompt?}` - in a damageLanding Trigger: the player picks one of the actor's Essences that still has
 * points (none: nothing happens); up to `@var.damage` comes off it instead, and `@var.damage` drops by what it took.
 */
registerStep('takeAsEssence', async (step, ctx) => {
  const actor = ctx.actor;
  const { currentEssence, currentEssenceUpdate } = await import("../../../mechanics/combat/essence-current.mjs");
  const essences = Object.keys(actor?.system?.essences ?? {}).filter(key => Number(currentEssence(actor, key)) > 0).map(key => [key]);
  const damage = Math.max(0, Math.round(Number(ctx.vars.damage) || 0));
  if (!essences.length || !damage) {
    return;
  }

  const label = key => globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.essences?.[key] ?? key) ?? key;
  const { chooseSelect } = ctx.grantHelpers ?? await import("../../../mechanics/resources/grants.mjs");
  const essence = await chooseSelect(ctx.item?.name ?? '', escape(step.prompt ?? ''), essences.map(([key]) => ({ value: key, label: label(key) })));
  if (!essence || !actor.system.essences[essence]) {
    return false;
  }

  const current = Number(currentEssence(actor, essence)) || 0;
  const taken = Math.min(current, damage);
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  const update = [currentEssenceUpdate(actor, essence, current - taken)];
  await (needsGmRelay(actor) ? relayToGm(actor, 'update', update) : actor.update(...update));
  ctx.vars.damage = damage - taken;
  ctx.chat.push(globalThis.game?.i18n?.format?.('E20.ReactCyborgTaken', { name: escape(actor.name), amount: taken, essence: escape(label(essence)) }) ?? `${actor.name}: ${taken}`);
});

/** `unmorph {}` - a Morphed actor un-Morphs through the sheet's own Morph flow (power-ranger-handler.mjs#onMorph). */
registerStep('unmorph', async (step, ctx) => {
  const actor = ctx.actor;
  if (!actor?.system?.isMorphed) {
    return;
  }

  const { onMorph } = await import("../../../sheet-handlers/power-ranger-handler.mjs");
  await onMorph(actor);
});
