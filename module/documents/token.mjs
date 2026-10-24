import { isBraced, setAiming, setBraced } from "../mechanics/actions/action-economy.mjs";
import { consumeForMovement } from "../mechanics/combat/token-movement.mjs";
import { FACING_SNAP_SETTING, artFacingOffset, facesMovementItself, facingGrid, facingSwap, isOblong, isSideways, movementFacing, wouldAutoRotate } from "../canvas/token-facing.mjs";
import { actorMidBuild } from "../util/token-actor.mjs";

export class Essence20TokenDocument extends TokenDocument {
  /**
   * No actor yet while its own unlinked actor is still being built further up the stack - reading it then would build
   * it again, forever (util/token-actor.mjs).
   * @override
   */
  get actor() {
    return actorMidBuild(this) ? null : super.actor;
  }

  /**
   * A non-square token placed already turned on its side (its prototype's rotation): the footprint stands with it
   * (canvas/token-facing.mjs).
   * @override
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }

    const source = this._source;
    if (!source.lockRotation && isOblong(source) && isSideways(source.rotation) && facingGrid(this.parent?.grid)) {
      this.updateSource({ width: source.height, height: source.width });
    }

    return allowed;
  }

  /**
   * A rotation that turns a non-square token onto its other pair of facings swaps its width and height around the same
   * centre (canvas/token-facing.mjs#facingSwap), so the footprint matches the picture. The shift is a displacement - it
   * costs no movement and isn't drawn as a walk - and a rotation that comes with its own movement is left alone.
   * @override
   */
  async _preUpdate(changes, options, user) {
    // A move Foundry would turn to face its direction (Automatic Token Rotation): turned here first, footprint included.
    if (!('rotation' in changes)) {
      this.#faceMovement(changes, options);
    }

    if ('rotation' in changes && !options.movement?.[this.id]) {
      const swap = facingSwap(this._source, changes, this.parent?.grid);
      if (swap) {
        Object.assign(changes, swap);
        const source = this._source;
        options.movement ??= {};
        options.movement[this.id] = {
          waypoints: [{
            x: swap.x, y: swap.y, elevation: changes.elevation ?? source.elevation ?? 0, width: swap.width, height: swap.height,
            depth: source.depth, shape: source.shape, level: source.level, action: 'displace', snapped: false, explicit: false,
            checkpoint: true,
          }],
        };
      }
    }

    return super._preUpdate(changes, options, user);
  }

  /**
   * Automatic Token Rotation for a non-square token. Core turns a moving token to face its last segment after it has
   * planned the move, so a long token's footprint never followed - and a diagonal step left it at 45°. Here the facing
   * is worked out before core plans it (canvas/token-facing.mjs#movementFacing: snapped to a whole facing while Snap
   * Long Tokens to Facings is on), and when that turns it onto its other side the move's destination carries the
   * turned footprint, centred where the unturned one would have stood. With a rotation already in the changes core
   * leaves the rotation alone. The token's Art Faces (canvas/token-facing.mjs#ART_FACINGS) says which way its art points; a
   * square token is only handled here when that's set. Lock Rotation and hex grids are core's as ever.
   */
  #faceMovement(changes, options) {
    const source = this._source;
    const grid = this.parent?.grid;
    if (source.lockRotation || !facesMovementItself(source) || !facingGrid(grid)) {
      return;
    }

    const movement = options.movement?.[this.id];
    const explicit = Array.isArray(movement?.waypoints) && movement.waypoints.length > 0;
    if (!explicit && !TokenDocument._isMovementUpdate(changes, source)) {
      return;
    }

    let coreSetting = false;
    let snap = true;
    try {
      coreSetting = !!game.settings.get('core', 'tokenAutoRotate');
      // Whole facings are for long tokens; a square one with its Art Faces set turns as freely as core turns it.
      snap = game.settings.get('essence20', FACING_SNAP_SETTING) !== false && isOblong(source);
    } catch {
      // Settings not ready: core's default off.
    }

    if (!wouldAutoRotate(movement, options, coreSetting)) {
      return;
    }

    const waypoints = explicit ? movement.waypoints : [{ x: changes.x, y: changes.y, width: changes.width, height: changes.height }];
    const rotation = movementFacing(source, waypoints, grid, { snap, rotation: source.rotation, offset: artFacingOffset(source) });
    if (rotation === null) {
      return;
    }

    changes.rotation = rotation;
    // The destination as planned, turned if the new facing is on the other side.
    let end = source;
    for (const waypoint of waypoints) {
      end = { ...end, ...Object.fromEntries(Object.entries(waypoint).filter(([, value]) => value !== undefined)) };
    }

    const swap = facingSwap({ ...end, rotation: source.rotation, lockRotation: false }, { rotation }, grid);
    if (!swap) {
      return;
    }

    if (explicit) {
      movement.waypoints[movement.waypoints.length - 1] = { ...movement.waypoints.at(-1), ...swap };
    } else {
      Object.assign(changes, swap);
    }
  }

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
   * Everything about what does and does not get charged lives in mechanics/combat/token-movement.mjs; this
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

    const allowedAfterCost = await consumeForMovement(this, movement);
    if (allowedAfterCost === false) {
      return false;
    }

    /* Moving cancels an aim: the shift holds "as long as you don't use Movement between your
       Aim and your attack" (GI Joe CRB p.193). Cleared only once the move is actually going
       to happen - a movement the economy just rejected never took place, so it must not cost
       the aim either. */
    await setAiming(this.actor, false);

    // Moving ends a brace, bipod or not (Quartermaster's Guide p.34: "stays braced until moving").
    if (this.actor && isBraced(this.actor) && !this.actor.statuses?.has?.('prone')) {
      await setBraced(this.actor, false);
    }

    return allowedAfterCost;
  }
}
