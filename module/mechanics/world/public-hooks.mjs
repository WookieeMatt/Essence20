/**
 * Hooks other modules can listen to (essence20-fx's sounds and animations, Token Action HUD...). Each is
 * `essence20.<name>`, called with Hooks.callAll on the client that made the thing happen - so a listener that
 * broadcasts (Sequencer) plays it once for the table. Read-only: never awaited, the payload is not to be written to, and
 * a listener's error never reaches the game. The list and each payload: docs/ARCHITECTURE.md, "Hooks for modules".
 */

/**
 * @param {String} name     The hook's name after "essence20."
 * @param {Object} payload
 */
export function announce(name, payload) {
  try {
    globalThis.Hooks?.callAll?.(`essence20.${name}`, payload);
  } catch (err) {
    console.error(`essence20 | a listener of essence20.${name} failed`, err);
  }
}
