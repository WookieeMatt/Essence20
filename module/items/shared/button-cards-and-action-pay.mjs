/**
 * Small helpers for the tf2 slice's chat-card follow-ups (Mode Lock's Energon flush, Not Like That, Like This!): a
 * uuid read without throwing, paying an action in combat, and a chat card with one button.
 */

const escape = text => foundry.utils.escapeHTML(String(text ?? ''));

export function resolveSync(uuid) {
  try {
    return uuid && typeof fromUuidSync == 'function' ? fromUuidSync(uuid) : null;
  } catch (error) {
    return null;
  }
}

export async function payAction(actor, type, source) {
  if (!globalThis.game?.combat) {
    return true;
  }

  const { spend } = await import("../../mechanics/actions/action-economy.mjs");
  const result = await spend(actor, type, { source });
  return !result?.blocked;
}

export function buttonCard(actor, text, button = null) {
  const extra = button
    ? `<button type="button" data-e20-ext="${button.key}"${Object.entries(button.data ?? {}).map(([k, v]) => ` data-${k}="${escape(v)}"`).join('')}>${escape(button.label)}</button>`
    : '';
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>${extra}` });
}
