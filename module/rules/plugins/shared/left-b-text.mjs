// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md): the strings of this part
// (E20.RulesExtLeftB16.*) and two small helpers its plug-ins share. Plain Node safe.

/** A string from the RulesExtLeftB16 block of the language file, or the key with its data. */
export function T(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtLeftB16.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

/** A text that may be an i18n key (E20.*), localized - else as it is. */
export function localized(text, data = null) {
  const value = String(text ?? '');
  if (!value.startsWith('E20.')) {
    return value;
  }

  const i18n = globalThis.game?.i18n;
  const out = data ? i18n?.format?.(value, data) : i18n?.localize?.(value);
  return out ?? value;
}

export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** An actor's items as an array. */
export function itemsOf(actor) {
  const items = actor?.items;
  return items?.contents ?? (items ? [...items] : []);
}
