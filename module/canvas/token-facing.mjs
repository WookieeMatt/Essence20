/**
 * Facing for non-square tokens (a Long vehicle 2x1, an Extended Zord): Foundry rotates only a token's picture, so a 2x1
 * token turned 90° drew its art standing up across a footprint still lying down. Here the footprint follows the
 * picture: a non-square token's width and height swap whenever its rotation crosses to the other pair of facings
 * (0°/180° lie as authored, 90°/270° stand), and the picture is fitted at the token's natural, unturned size before it
 * rotates, so it's never squashed into the turned box. The picture may still turn to any angle; the footprint takes the
 * nearest of the four facings.
 *
 * The mouse wheel turns a non-square token a whole facing (90°) at a time while the world setting
 * `essence20.tokenFacingSnap` is on; holding Alt as well rotates freely, as Foundry does.
 *
 * Square and hex grids: square and gridless scenes only - a long token on a hex grid has no clean turned footprint.
 * A token with Lock Rotation never swaps (its picture doesn't turn either).
 *
 * Plain Node safe: the Foundry-side wiring is canvas/token.mjs, documents/token.mjs and mechanics/world/token-sync.mjs.
 */

export const FACING_SNAP_SETTING = 'tokenFacingSnap';

/** A rotation's facing, 0-3 (0°, 90°, 180°, 270°), by the nearest. */
export function facingOf(rotation) {
  const degrees = ((Number(rotation) || 0) % 360 + 360) % 360;
  return Math.round(degrees / 90) % 4;
}

/** Whether a rotation stands a token on its side (nearest facing 90° or 270°). */
export const isSideways = rotation => facingOf(rotation) % 2 == 1;

/** Whether a token's footprint isn't square. */
export const isOblong = ({ width, height } = {}) => Number(width) > 0 && Number(height) > 0 && Number(width) != Number(height);

/**
 * Whether facing applies on this grid: square or gridless.
 * @param {Object} grid   The scene's grid ({type}), CONST.GRID_TYPES values (0 gridless, 1 square).
 */
export const facingGrid = grid => [0, 1].includes(Number(grid?.type ?? 1));

/**
 * A size as it should stand on a token turned to `rotation`: swapped when sideways and not square.
 * resizeTokens uses it so a Size change (a Transform) keeps a turned token turned.
 */
export function orientedSize(width, height, rotation, { lockRotation = false } = {}) {
  return !lockRotation && width != height && isSideways(rotation) ? { width: height, height: width } : { width, height };
}

/**
 * The extra changes a rotation update needs so the footprint follows it: {width, height, x, y}, or null when nothing
 * swaps (no rotation change, a square token, the same pair of facings, Lock Rotation, a hex grid). The position keeps
 * the token's centre, snapped back onto the grid on a square grid.
 * @param {Object} source    The token's current data ({x, y, width, height, rotation, lockRotation}).
 * @param {Object} changes   The update ({rotation, and maybe width/height/lockRotation}).
 * @param {Object} grid      {type, size}.
 * @returns {Object|null}
 */
export function facingSwap(source, changes, grid) {
  if (!changes || !('rotation' in changes) || !facingGrid(grid)) {
    return null;
  }

  const lockRotation = 'lockRotation' in changes ? changes.lockRotation : source.lockRotation;
  const width = Number(changes.width ?? source.width);
  const height = Number(changes.height ?? source.height);
  if (lockRotation || !isOblong({ width, height }) || isSideways(source.rotation) == isSideways(changes.rotation)) {
    return null;
  }

  const size = Number(grid?.size) || 100;
  const x = Number(changes.x ?? source.x) || 0;
  const y = Number(changes.y ?? source.y) || 0;
  // Same centre, the turned box around it. On a square grid an odd-by-even box can't keep the exact centre, so it's
  // snapped down turning onto its side and up turning back: a full turn ends where it started, rather than creeping
  // half a square each time.
  let newX = x + (width - height) * size / 2;
  let newY = y + (height - width) * size / 2;
  if (Number(grid?.type ?? 1) == 1) {
    const snap = isSideways(changes.rotation) ? Math.floor : Math.ceil;
    newX = snap(Math.round(newX * 1000) / 1000 / size) * size;
    newY = snap(Math.round(newY * 1000) / 1000 / size) * size;
  }

  return { width: height, height: width, x: newX, y: newY };
}

/**
 * The picture's box for a token's mesh: its natural, unturned size - the token's own size swapped back while it's turned
 * sideways - so the art is fitted unsquashed and then rotated into the turned footprint.
 * @param {{width: Number, height: Number}} size   The token's size in pixels (TokenDocument#getSize).
 * @param {Object} document   {rotation, lockRotation, width, height}.
 * @param {Object} grid       {type}.
 */
export function naturalMeshSize(size, document, grid) {
  if (!facingGrid(grid) || document?.lockRotation || !isOblong(document) || !isSideways(document?.rotation)) {
    return size;
  }

  return { width: size.height, height: size.width };
}

/**
 * Whether Foundry would turn this move's token to face its direction (its own resolution: the move's autoRotate, else
 * the update's, else core's Automatic Token Rotation setting for a dragged or keyboard move). An undo never does.
 * @param {Object} movement   options.movement[tokenId] ({method, autoRotate}), if any.
 * @param {Object} options    The update options.
 * @param {Boolean} coreSetting   game.settings.get('core', 'tokenAutoRotate').
 */
export function wouldAutoRotate(movement, options, coreSetting) {
  const method = movement?.method ?? options?.method ?? 'api';
  if (method == 'undo' || options?.isUndo) {
    return false;
  }

  const chosen = movement?.autoRotate ?? options?.autoRotate;
  if (chosen !== undefined) {
    return !!chosen;
  }

  return ['dragging', 'keyboard'].includes(method) && !!coreSetting;
}

/**
 * The rotation a move faces, as Foundry's Automatic Token Rotation works it out - the direction of its last segment
 * that goes anywhere, from centre to centre - or null when it goes nowhere. Snapped to a whole facing when `snap`; a
 * move exactly between two facings (a diagonal) keeps the side the token already stands on.
 * @param {Object} origin      Where it starts ({x, y, width, height}).
 * @param {Array<Object>} waypoints   Where it goes (each may leave width/height out: the previous one's).
 * @param {Object} grid        {size}.
 * @param {Object} [options]   {snap, rotation, offset} - snapping, the token's rotation now, and degrees added to core's
 *                              reading (90 for a token whose art lies wide: see travelOffset).
 * @returns {Number|null}
 */
export function movementFacing(origin, waypoints, grid, { snap = false, rotation = 0, offset = 0 } = {}) {
  const size = Number(grid?.size) || 100;
  const points = [];
  let last = origin;
  for (const waypoint of [origin, ...(waypoints ?? [])]) {
    if (waypoint?.intermediate) {
      continue;
    }

    last = { x: waypoint.x ?? last.x, y: waypoint.y ?? last.y, width: waypoint.width ?? last.width, height: waypoint.height ?? last.height };
    points.push({ x: last.x + (Number(last.width) || 1) * size / 2, y: last.y + (Number(last.height) || 1) * size / 2 });
  }

  for (let i = points.length - 1; i > 0; i--) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.hypot(dx, dy) > 0.5) {
      const degrees = ((Math.atan2(dy, dx) * 180 / Math.PI - 90 + offset) % 360 + 360) % 360;
      if (!snap) {
        return Math.round(degrees * 1000) / 1000;
      }

      const quarters = degrees / 90;
      if (Math.abs(quarters - Math.floor(quarters) - 0.5) < 1e-6) {
        // Exactly diagonal: the neighbouring facing on the side it already stands.
        const down = Math.floor(quarters);
        return ((down % 2 == facingOf(rotation) % 2 ? down : down + 1) % 4) * 90;
      }

      return (Math.round(quarters) % 4) * 90;
    }
  }

  return null;
}

/**
 * How far a non-square token's travel facing sits from core's. Core's Automatic Token Rotation takes a token's art to
 * face down at 0° (top-down art walking south), so a wide vehicle - drawn lying left to right, 2x1 - rolled sideways down
 * the map like a crab. A long token travels along its long side instead: a token naturally wider than tall faces right at
 * 0° (+90° from core), one taller than wide faces down (core's own).
 * @param {Object} source   {width, height, rotation} as stored (turned tokens have their size swapped).
 */
export function travelOffset(source) {
  const wide = isSideways(source?.rotation) ? Number(source?.height) > Number(source?.width) : Number(source?.width) > Number(source?.height);
  return wide ? 90 : 0;
}

/**
 * Which way a token's art faces, set on its Token configuration ("Art Faces", flags.essence20.artFacing): the degrees
 * added to core's reading (core takes art to face down at 0°). "auto" (or unset) is travelOffset's guess from the shape.
 */
export const ART_FACINGS = Object.freeze({ down: 0, right: 90, up: 180, left: 270 });

/** A token's Art Faces choice: one of ART_FACINGS' keys, else 'auto'. */
export const artFacingOf = source => (Object.hasOwn(ART_FACINGS, source?.flags?.essence20?.artFacing ?? '') ? source.flags.essence20.artFacing : 'auto');

/** The offset its travel facing takes: its Art Faces choice, else the shape's guess. */
export function artFacingOffset(source) {
  const facing = artFacingOf(source);
  return facing == 'auto' ? travelOffset(source) : ART_FACINGS[facing];
}

/**
 * Whether this system turns a moving token rather than core: any non-square token, and a square one whose Art Faces is
 * set (left to itself, core would turn its art the wrong way).
 */
export const facesMovementItself = source => isOblong(source) || artFacingOf(source) != 'auto';

/**
 * The rotation step for the wheel on a non-square token: a whole facing (90°) - Alt held keeps Foundry's own.
 * @returns {{delta: Number, snap: Number}|null}   null: leave the rotation to Foundry.
 */
export function facingWheelStep({ delta = 0, angle = undefined } = {}, { oblong, enabled, free, rotation = 0 }) {
  // A set angle (a keyboard turn to a direction, a macro) is left as given; its footprint still follows.
  if (!oblong || !enabled || free || angle !== undefined) {
    return null;
  }

  // From the stored rotation, not the animated one - quick turns while the last is still animating add up right.
  return { angle: (Number(rotation) || 0) + 90 * Math.sign(delta || 0), snap: 90 };
}
