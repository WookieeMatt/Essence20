import { registerChatDecorator } from "../../../mechanics/item-hooks.mjs";
import { canPress } from "../../buttons.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerStep, runSteps, stepContext, stepErrors } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape, fillText, localize, lookup, say, T, write } from "../shared/card-text-helpers.mjs";

/**
 * Cards that other items add buttons to, and per-button counters (round 11, group G).
 *
 * - Step `postCard {key, text?}` - a chat card for the actor with `text` ({name}, {target}, {var.x}; an E20. key is
 *   localised) and a button for each `CardButtons` rule the actor holds for that `key` whose `when` holds (self: the
 *   actor, target: the run's first target). The run's targets go with the card.
 * - Rule `CardButtons {card, label, steps, each?: "target", who?}` - the buttons an item adds to the cards posted under
 *   `card`: one, or (each: target) one per target of the card, that target the button's own ({target} in the label).
 *   Pressed, the steps run as the card's actor (who: owner - the default -, gm, anyone, targets, others; as the
 *   `button` step's), with the button's targets; a button can be pressed again and again.
 * - Step `buttonCount {key, add?, max?, check?, message?}` - inside a button's steps (these cards' buttons, or a
 *   `button` step's): a counter kept on the pressed button, read as @var.<key> by the steps after it. `check: true` only
 *   checks: at `max` or more it stops with `message` as a warning. Otherwise it adds `add` (default 1) - and refuses at
 *   `max` the same way. Each button counts on its own.
 */

export const FLAG = 'ruleButtons';

registerRuleType('CardButtons', {
  params: {
    card: { kind: 'string', required: true },
    steps: { kind: 'object', required: true },
    each: { kind: 'enum', options: ['target'] },
    who: { kind: 'enum', options: ['owner', 'gm', 'anyone', 'targets', 'others'] },
  },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.steps) && rule.steps.length ? stepErrors(rule.steps) : ['needs steps']),
});

/** The buttons a card posted under `key` carries: [{itemUuid, label, steps, who, targets, vars}]. */
export function cardButtons(actor, key, targets = []) {
  const buttons = [];
  for (const { rule, item } of rulesOfType(actor, 'CardButtons')) {
    if (rule.card != key || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, other: targets[0] ?? null })) !== true) {
      continue;
    }

    const make = aimed => ({
      itemUuid: item?.uuid ?? null, steps: rule.steps, who: rule.who ?? 'owner', vars: {},
      label: fillText(ruleLabel(rule, item), { actor, targets: aimed }), targets: aimed.map(target => target.uuid),
    });
    if (rule.each == 'target') {
      buttons.push(...targets.map(target => make([target])));
    } else {
      buttons.push(make(targets));
    }
  }

  return buttons;
}

registerStep('postCard', async (step, ctx) => {
  const buttons = step.key ? cardButtons(ctx.actor, step.key, ctx.targets) : [];
  const text = step.text ? `<p>${escape(fillText(step.text, ctx))}</p>` : '';
  const html = buttons.map((button, index) => `<button type="button" data-e20-rule-buttons="${index}">${escape(button.label)}</button>`).join('');
  await say(ctx.actor, `<div class="e20-rule-button-card">${text}${html}</div>`, buttons.length ? {
    flags: { essence20: { [FLAG]: { actorUuid: ctx.actor?.uuid ?? null, buttons } } },
  } : {});
}, { errors: (step, where) => (step.key || step.text ? [] : [`${where}: postCard needs a key or text`]) });

/** Whether this user may press one of a card's buttons. */
export function canPressCardButton(card, button, user = globalThis.game?.user) {
  return !!card && !!button && canPress({ actorUuid: card.actorUuid, who: button.who, targets: button.targets, once: false }, user);
}

/**
 * Press button `index` of a CardButtons card: its steps, as the card's actor, with its targets and counters.
 * @returns {Promise<Boolean>} Whether it ran.
 */
export async function pressCardButton(message, index, user = globalThis.game?.user) {
  const card = message?.flags?.essence20?.[FLAG];
  const button = card?.buttons?.[index];
  const actor = lookup(card?.actorUuid);
  if (!actor || !canPressCardButton(card, button, user)) {
    return false;
  }

  const ctx = stepContext({ actor, item: lookup(button.itemUuid), targets: (button.targets ?? []).map(lookup).filter(Boolean) });
  Object.assign(ctx.vars, button.vars ?? {});
  ctx.buttonMessage = message;
  ctx.buttonIndex = index;
  await runSteps(button.steps ?? [], ctx);
  if (ctx.chat.length) {
    await say(actor, ctx.chat.join('<br>'));
  }

  return true;
}

export function decorateCardButtons(message, html) {
  const card = message?.flags?.essence20?.[FLAG];
  if (!card) {
    return;
  }

  for (const element of html?.querySelectorAll?.('[data-e20-rule-buttons]') ?? []) {
    const index = Number(element.dataset?.e20RuleButtons ?? element.getAttribute?.('data-e20-rule-buttons'));
    element.disabled = !canPressCardButton(card, card.buttons?.[index]);
    element.addEventListener('click', async event => {
      event.preventDefault();
      element.disabled = true;
      await pressCardButton(message, index);
      element.disabled = !canPressCardButton(message.flags?.essence20?.[FLAG], message.flags?.essence20?.[FLAG]?.buttons?.[index]);
    });
  }
}

registerChatDecorator(decorateCardButtons);

/* -------------------------------------------- */
/*  buttonCount                                  */
/* -------------------------------------------- */

/** A pressed button's stored counter (a CardButtons button by index, else a `button` step's card). */
function storedCount(message, index, key) {
  const value = index === undefined
    ? message?.flags?.essence20?.ruleButton?.vars?.[key]
    : message?.flags?.essence20?.[FLAG]?.buttons?.[index]?.vars?.[key];
  return Number(value) || 0;
}

registerStep('buttonCount', async (step, ctx) => {
  const message = ctx.buttonMessage;
  const key = String(step.key ?? '');
  if (!message || !key) {
    return false;
  }

  const index = ctx.buttonIndex;
  const current = storedCount(message, index, key);
  const max = step.max === undefined ? Infinity : Number(step.max);
  if (current >= max) {
    globalThis.ui?.notifications?.warn?.(step.message ? localize(step.message) : T('ButtonMax', { max }));
    return false;
  }

  ctx.vars[key] = current;
  if (step.check) {
    return;
  }

  const next = current + (step.add === undefined ? 1 : Number(step.add) || 0);
  if (index === undefined) {
    await write(message, 'update', [{ [`flags.essence20.ruleButton.vars.${key}`]: next }]);
  } else {
    const buttons = (message.flags?.essence20?.[FLAG]?.buttons ?? []).map((button, i) => (i == index ? { ...button, vars: { ...(button.vars ?? {}), [key]: next } } : button));
    await write(message, 'update', [{ [`flags.essence20.${FLAG}.buttons`]: buttons }]);
  }

  ctx.vars[key] = next;
}, {
  errors: (step, where) => [
    ...(step.key && /^[\w-]+$/.test(step.key) ? [] : [`${where}: buttonCount needs a plain key`]),
    ...(step.max !== undefined && !Number.isFinite(Number(step.max)) ? [`${where}: max must be a number`] : []),
    ...(step.add !== undefined && !Number.isFinite(Number(step.add)) ? [`${where}: add must be a number`] : []),
  ],
});
