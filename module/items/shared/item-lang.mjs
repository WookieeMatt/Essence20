/**
 * The localize helpers the item files share. They differ in two ways, kept as separate functions so
 * every call site produces exactly the key it always did:
 * - T and TSafe prefix the key with "E20."; TFull takes the full key as written.
 * - TSafe answers the prefixed key itself when game.i18n isn't there (some tests); T and TFull
 *   expect it to be.
 * Importers usually bind the one they need as `T`.
 */

/** game.i18n for "E20.<key>" (formatted when data is given). */
export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** T, or "E20.<key>" itself when there is no game.i18n. */
export const TSafe = (key, data) => {
  const full = `E20.${key}`;
  const i18n = globalThis.game?.i18n;
  if (!i18n) {
    return full;
  }

  return data ? i18n.format(full, data) : i18n.localize(full);
};

/** game.i18n for a full key, no prefix added. */
export const TFull = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
