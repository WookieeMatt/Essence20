import { registerChatDecorator } from "../helpers/extensions.mjs";
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

/** Who the steps act as: the rule's actor, or the presser's own character. */
function actorFor(data, user) {
  if ((data.runAs ?? 'holder') == 'clicker') {
    return user?.character ?? (user?.isGM ? lookup(data.actorUuid) : null);
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
  if (!actor) {
    return false;
  }

  // Marked used first, so a quick second click (or another player) can't run it twice.
  if (data.once !== false) {
    const { needsGmRelay, relayToGm } = await import("../helpers/gm-relay.mjs");
    const update = [{ [`flags.essence20.${FLAG}.used`]: true }];
    await (needsGmRelay(message) ? relayToGm(message, 'update', update) : message.update(...update));
  }

  const targets = (data.targets ?? []).map(lookup).filter(Boolean);
  const ctx = stepContext({ actor, item: lookup(data.itemUuid), targets });
  await runSteps(data.steps ?? [], ctx);
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

  button.disabled = !canPress(data);
  button.addEventListener('click', async event => {
    event.preventDefault();
    button.disabled = true;
    const ran = await pressRuleButton(message);
    button.disabled = !ran ? !canPress(message.flags?.essence20?.[FLAG]) : data.once !== false;
  });
}

registerChatDecorator(decorateRuleButtonCard);
