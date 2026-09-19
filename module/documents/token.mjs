import { consumeForMovement } from "../helpers/token-movement.mjs";

export class Essence20TokenDocument extends TokenDocument {
  /**
   * Charge a pending token movement against the action economy, and reject it when the world is
   * enforcing strictly and the actor cannot afford it.
   *
   * _preUpdateMovement is Foundry v14's own document-level extension point, called just before the
   * preMoveToken hook and honoured the same way: returning false rejects the movement outright.
   * It is preferred here for the same reason Combat#_onStartTurn is preferred over the combatTurn
   * hook elsewhere in this system - a subclass override is a first-class extension point, while a
   * hook is a shared bus every module also writes to.
   *
   * Everything about what does and does not get charged lives in helpers/token-movement.mjs; this
   * is only the wiring. Note that v14 fires this ONLY on the client initiating the move, which is
   * what makes movement enforcement advisory and why it sits behind its own opt-in setting.
   *
   * @param {Object} movement   The pending TokenMovementOperation.
   * @param {Object} operation  The update operation carrying it.
   * @returns {Promise<Boolean|void>}   False to prevent the movement.
   * @override
   */
  async _preUpdateMovement(movement, operation) {
    const allowed = await super._preUpdateMovement(movement, operation);
    if (allowed === false) {
      return false;
    }

    return consumeForMovement(this, movement);
  }
}
