import { registerChatDecorator } from "../helpers/extensions.mjs";
import { recordUse, usesLeft } from "./limits.mjs";
import { runSteps, stepContext } from "./steps.mjs";

/**
 * Chat-card buttons for item rules: the `button` step (rules/steps.mjs) posts a card whose button runs
 * more steps when it's pressed - a follow-up after a hit, a GM's damage button, something the other
 * players can take ("Follow Me!"), a group's answer.
 *
 * The card's flags.essence20.ruleButton holds what to run:
 *   {actorUuid, itemUuid, targets: [uuids], steps, label, who, runAs, once, used}
 * who:   owner (the rule's actor's owners, the default) | gm | anyone | targets (an owner of a target) |
 *        others (players who don't own the rule's actor)
 * runAs: holder (the rule's actor, the default) | clicker (the pressing player's own character)
 * once:  the card works once (the default) - it's marked used, through the GM when the presser can't
 *        write to it.
 * limit: {per, max, key} - counted on whoever the steps act as when pressed (each player's own, with
 *        runAs: clicker), across every card the rule posts: "once per round", "once per scene".
 */

export const FLAG = 'ruleButton';

const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);

/** Whether this user may press the button. */
export function canPress(data, user = globalThis.game?.user) {
  if (!data || !user || (data.once !== false && data.used)) {
    return false;
  }

  const actor = lookup(data.actorUuid);
  const owns = doc => !!doc && (doc.testUserPermission ? doc.testUserPermission(user, 'OWNER') : !!doc.isOwner);
  switch (data.who ?? 'owner') {
  case 'gm': return !!user.isGM;
  case 'anyone': return true;
  case 'targets': return user.isGM || (data.targets ?? []).some(uuid => owns(lookup(uuid)));
  case 'others': return !owns(actor) && !!user.character;
  }

  return user.isGM || owns(actor);
}

/** A button's limit, as a rule-shaped object for rules/limits.mjs. */
function limitRule(data) {
  return data?.limit?.per ? { limit: { ...data.limit, key: data.limit.key || `button-${data.itemUuid ?? 'x'}-${data.label ?? ''}`.replace(/[^\w-]/g, '_') } } : null;
}

/** Whether the acting actor still has a use of the button's limit. */
export function limitAllows(data, actor) {
  const rule = limitRule(data);
  return !rule || usesLeft(actor, rule, null, 0) > 0;
}

/** Who the steps act as: the rule's actor, or the presser's own character. */
function actorFor(data, user) {
  if ((data.runAs ?? 'holder') == 'clicker') {
    // The token the presser has selected first, then their own character (the GM: the rule's actor).
    const controlled = user && user === globalThis.game?.user ? globalThis.canvas?.tokens?.controlled?.[0]?.actor ?? null : null;
    return controlled ?? user?.character ?? (user?.isGM ? lookup(data.actorUuid) : null);
  }

  return lookup(data.actorUuid);
}

/**
 * Press a card's button: run its steps and post what happened.
 * @returns {Promise<Boolean>}   Whether it ran.
 */
export async function pressRuleButton(message, user = globalThis.game?.user) {
  const data = message?.flags?.essence20?.[FLAG];
  if (!canPress(data, user)) {
    return false;
  }

  const actor = actorFor(data, user);
  if (!actor || !limitAllows(data, actor)) {
    return false;
  }

  // Marked used first, so a quick second click (or another player) can't run it twice - unless usedWhenDone, which
  // waits for the steps to finish (a cancelled choice or a missing resource leaves the card pressable).
  if (data.once !== false && !data.usedWhenDone) {
    const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
    const update = [{ [`flags.essence20.${FLAG}.used`]: true }];
    await (needsGmRelay(message) ? relayToGm(message, 'update', update) : message.update(...update));
  }

  const targets = (data.targets ?? []).map(lookup).filter(Boolean);
  const ctx = stepContext({ actor, item: lookup(data.itemUuid), targets });
  Object.assign(ctx.vars, data.vars ?? {});
  // The card itself, for steps that act on it (rules/ext/d/misc.mjs claimCard).
  ctx.buttonMessage = message;
  const finished = await runSteps(data.steps ?? [], ctx);
  if (data.once !== false && data.usedWhenDone && finished !== false) {
    const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
    const update = [{ [`flags.essence20.${FLAG}.used`]: true }];
    await (needsGmRelay(message) ? relayToGm(message, 'update', update) : message.update(...update));
  }

  // The limit counts only a run that finished (a cancelled choice or a missing resource leaves the use).
  if (limitRule(data) && finished !== false) {
    await recordUse(actor, limitRule(data), null, 0);
  }

  if (ctx.chat.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: [`<strong>${data.label ?? ''}</strong>`, ...ctx.chat].join('<br>') });
  }

  return true;
}

/** Wire up (or disable) the button on a rendered card. */
export function decorateRuleButtonCard(message, html) {
  const data = message?.flags?.essence20?.[FLAG];
  const button = html?.querySelector?.('[data-e20-rule-button]');
  if (!data || !button) {
    return;
  }

  const acting = canPress(data) ? actorFor(data, globalThis.game?.user) : null;
  button.disabled = !acting || !limitAllows(data, acting);
  button.addEventListener('click', async event => {
    event.preventDefault();
    button.disabled = true;
    const ran = await pressRuleButton(message);
    button.disabled = !ran ? !canPress(message.flags?.essence20?.[FLAG]) : data.once !== false;
  });
}

registerChatDecorator(decorateRuleButtonCard);
