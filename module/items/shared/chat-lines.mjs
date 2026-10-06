/**
 * Chat output and HTML escaping the item files share. Light on purpose - imports nothing.
 *
 * say posts the content as given; sayParagraph wraps it in <p>; postLine skips empty content and
 * resolves to nothing. The three escapers differ in what they touch: escapeHtml is Foundry's own
 * (text passed through when it isn't loaded), escapeMarkup covers & < > ", and
 * escapeMarkupAndApos adds the apostrophe.
 */

/** A chat card spoken by the actor (a no-op when there is no ChatMessage, as in some tests). */
export async function say(actor, content, extra = {}) {
  return globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, ...extra });
}

/** A chat card spoken by the actor, its content wrapped in one paragraph. */
export async function sayParagraph(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${content}</p>` });
}

/** A chat line spoken by the actor; nothing when there's no content or no ChatMessage. */
export async function postLine(actor, content, extra = {}) {
  const CM = globalThis.ChatMessage;
  if (!CM?.create || !content) {
    return;
  }

  await CM.create({ content, speaker: CM.getSpeaker?.({ actor }), ...extra });
}

/** foundry.utils.escapeHTML, or the text unchanged when Foundry's utils aren't loaded. */
export function escapeHtml(text) {
  return foundry?.utils?.escapeHTML ? foundry.utils.escapeHTML(String(text ?? '')) : String(text ?? '');
}

/** Escapes & < > and the double quote. */
export function escapeMarkup(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Escapes & < > " and the apostrophe. */
export function escapeMarkupAndApos(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
