import { isKnownKey, parseKey, suggestKey } from "./effect-catalog.mjs";

/**
 * Flags Active Effect change keys that will silently never apply, right where they're typed.
 *
 * A misspelled key is this system's most persistent Active Effect bug: Foundry resolves it to
 * nothing and moves on without a word, so the effect looks perfectly healthy on the sheet and
 * simply does nothing in play. Twenty-one such keys shipped in the compendium packs before the
 * validator (scripts/check-effect-keys.mjs) found them - "systen.skills.might.shiftUp",
 * "system.helath.bonus", "...intimidation.essence.social", and so on.
 *
 * Deliberately decoration only, attached to Foundry's own unmodified ActiveEffectConfig via its
 * render hook: it never rewrites a key on its own, and the row stays exactly as core rendered it.
 * The suggestion is click-to-apply, which is the author's action, not ours.
 */

/** Marks the elements this module adds, so a re-render can clear its own previous pass. */
const WARNING_CLASS = "essence20-key-warning";

/**
 * Build (or clear) the warning under one key input.
 * @param {HTMLInputElement} input  The change row's own key field.
 */
function refreshWarning(input) {
  // Appended to the change ROW, not to the narrow key column it belongs to - core's row is a
  // grid of key/type/value/priority, and a message squeezed into the first column wraps to one
  // word per line. The CSS spans it across the whole row instead.
  const container = input.closest("li") ?? input.parentElement;
  container?.querySelector(`.${WARNING_CLASS}`)?.remove();

  const key = input.value?.trim();

  // An empty key is core's own "not filled in yet" state on a freshly added row - nagging about
  // it while someone is still typing would be noise, so only a non-empty unknown key is flagged.
  if (!key || isKnownKey(key)) {
    // A key that resolves but targets a computed field is worth a quieter note: it is legal, it
    // just gets overwritten by derived-data prep every time (see the catalog's `readOnly`).
    const entry = parseKey(key);
    if (entry?.property.readOnly) {
      const note = document.createElement("p");
      note.className = `${WARNING_CLASS} notification info`;
      note.textContent = game.i18n.localize("E20.EffectKeyComputedWarning");
      container?.appendChild(note);
    }

    return;
  }

  const warning = document.createElement("p");
  warning.className = `${WARNING_CLASS} notification warning`;

  const suggestion = suggestKey(key);
  if (suggestion) {
    warning.textContent = `${game.i18n.localize("E20.EffectKeyUnknownWarning")} `;
    const link = document.createElement("a");
    link.textContent = game.i18n.format("E20.EffectKeyDidYouMean", { key: suggestion });
    link.dataset.tooltip = game.i18n.localize("E20.EffectKeyApplySuggestion");
    link.addEventListener("click", () => {
      input.value = suggestion;
      // Let the sheet's own change handling see it, exactly as if it had been typed.
      input.dispatchEvent(new Event("change", { bubbles: true }));
      refreshWarning(input);
    });
    warning.appendChild(link);
  } else {
    warning.textContent = game.i18n.localize("E20.EffectKeyUnknownWarning");
  }

  container?.appendChild(warning);
}

/**
 * Attach the key warnings to a rendered ActiveEffectConfig.
 * @param {ActiveEffectConfig} app
 * @param {HTMLElement} html  The sheet's own rendered element.
 */
export function addEffectKeyWarnings(app, html) {
  // v14 submits change rows under system.changes.<i>.key (changes moved into system data); the
  // suffix match also covers v13's top-level changes.<i>.key, so this works on both.
  for (const input of html.querySelectorAll('input[name$=".key"]')) {
    refreshWarning(input);

    if (!input.dataset.e20KeyWatched) {
      input.dataset.e20KeyWatched = "true";
      input.addEventListener("input", () => refreshWarning(input));
    }
  }
}
