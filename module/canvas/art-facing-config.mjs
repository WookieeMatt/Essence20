import { ART_FACINGS, artFacingOf } from "./token-facing.mjs";

/**
 * "Art Faces" on a token's configuration and its actor's prototype token (canvas/token-facing.mjs): which way the token's
 * art points, so Automatic Token Rotation turns it to travel the right way. Added under Lock Rotation; Foundry's own form
 * saves it as flags.essence20.artFacing.
 */

/** The select's HTML for a token (or prototype token) document. Exported for tests. */
export function artFacingField(document, localize = key => key) {
  const current = artFacingOf(document);
  const options = ['auto', ...Object.keys(ART_FACINGS)].map(value => {
    const key = `E20.ArtFacing${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    return `<option value="${value}"${value == current ? ' selected' : ''}>${localize(key)}</option>`;
  }).join('');
  return `<div class="form-group e20-art-facing">
    <label>${localize('E20.ArtFacingLabel')}</label>
    <div class="form-fields"><select name="flags.essence20.artFacing">${options}</select></div>
    <p class="hint">${localize('E20.ArtFacingHint')}</p>
  </div>`;
}

/** Put the field under Lock Rotation, once. */
export function addArtFacingField(app, element) {
  // Render hooks hand over the app's element (older ones a jQuery-wrapped one).
  const root = typeof element?.querySelector == 'function' ? element : app?.element;
  const document = app?.token ?? app?.document;
  const lock = root?.querySelector?.('[name="lockRotation"]')?.closest('.form-group');
  if (!lock || !document || root.querySelector('.e20-art-facing')) {
    return false;
  }

  lock.insertAdjacentHTML('afterend', artFacingField(document, key => globalThis.game?.i18n?.localize?.(key) ?? key));
  return true;
}

globalThis.Hooks?.on?.('renderTokenConfig', addArtFacingField);
globalThis.Hooks?.on?.('renderPrototypeTokenConfig', addArtFacingField);
