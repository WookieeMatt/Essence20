/**
 * Picking a point on the canvas, with a preview (mechanics/combat/forced-movement.mjs#pickCanvasPoint, the pickPoint
 * step): a crosshair cursor, a marker under it, and - for a move - a ghost of the token being moved, snapped to the grid
 * the way it will land (Shift holds the snap off, as when dragging a token). With a range, a ring around the mover's
 * token, the marker turning red past it. Click picks; Escape or a right click cancels.
 */

const OUT_OF_RANGE = 0xd33c3c;

/**
 * Where a pick lands for a cursor position: the centre of the token's snapped footprint (a ghost), the nearest grid
 * centre (snap), else the cursor itself.
 * @param {{x: Number, y: Number}} position   The cursor, in canvas coordinates.
 * @param {Object} [options]
 * @param {Token} [options.token]       The token being moved - its footprint is snapped.
 * @param {Boolean} [options.snap]      Snap a plain point to the nearest grid centre.
 * @param {Boolean} [options.free]      Snapping held off (Shift).
 * @param {Object} [options.grid]       The scene's grid (canvas.grid).
 * @returns {{x: Number, y: Number}}
 */
export function landingPoint(position, { token = null, snap = false, free = false, grid = globalThis.canvas?.grid } = {}) {
  const at = { x: position.x, y: position.y };
  if (token?.w && token?.h) {
    const corner = { x: at.x - token.w / 2, y: at.y - token.h / 2 };
    const snapped = free ? corner : token.document?.getSnappedPosition?.(corner) ?? corner;
    return { x: snapped.x + token.w / 2, y: snapped.y + token.h / 2 };
  }

  if (snap && !free && grid?.getSnappedPoint) {
    const mode = globalThis.CONST?.GRID_SNAPPING_MODES?.CENTER;
    return grid.getSnappedPoint(at, mode === undefined ? {} : { mode });
  }

  return at;
}

/** Whether a point is within `feet` of another (no range: always). */
export function withinRange(from, point, feet, measure) {
  if (!from || !(Number(feet) > 0)) {
    return true;
  }

  return measure(from, point) <= Number(feet) + 0.01;
}

const userColor = () => {
  const color = Number(globalThis.game?.user?.color);
  return Number.isFinite(color) ? color : 0xff8800;
};

/** The marker: the token's footprint and art, or a crosshair. */
function drawMarker(token) {
  const marker = new PIXI.Container();
  marker.eventMode = 'none';
  const outline = new PIXI.Graphics();
  marker.addChild(outline);
  let art = null;
  const texture = token?.mesh?.texture ?? token?.texture;
  if (token?.w && texture) {
    art = new PIXI.Sprite(texture);
    art.anchor.set(0.5);
    art.width = token.w;
    art.height = token.h;
    art.alpha = 0.5;
    marker.addChild(art);
  }

  const paint = (color) => {
    outline.clear();
    if (token?.w) {
      outline.lineStyle(3, color, 0.95).beginFill(color, 0.15).drawRect(-token.w / 2, -token.h / 2, token.w, token.h).endFill();
    } else {
      const r = (Number(globalThis.canvas?.grid?.size) || 100) * 0.3;
      outline.lineStyle(3, color, 0.95).drawCircle(0, 0, r).moveTo(-r * 1.4, 0).lineTo(r * 1.4, 0).moveTo(0, -r * 1.4).lineTo(0, r * 1.4);
    }
  };

  return { marker, paint };
}

/**
 * Wait for a click on the canvas, previewing where it lands.
 * @param {String} prompt   Shown as a notification while waiting.
 * @param {Object} [options]
 * @param {Token} [options.token]        The token being moved: a snapped ghost of it follows the cursor.
 * @param {Boolean} [options.snap]       Snap a plain point to the nearest grid centre.
 * @param {Token} [options.rangeFrom]    The token the range is measured from.
 * @param {Number} [options.range]       Feet: a ring around rangeFrom, the marker red past it.
 * @returns {Promise<{x: Number, y: Number}|null>}   The point (the ghost's centre), or null when cancelled.
 */
export function pickPointWithPreview(prompt, { token = null, snap = false, rangeFrom = null, range = null } = {}) {
  return new Promise((resolve) => {
    const canvas = globalThis.canvas;
    if (!canvas?.stage) {
      resolve(null);
      return;
    }

    if (prompt) {
      globalThis.ui?.notifications?.info?.(prompt);
    }

    const layer = canvas.controls ?? canvas.interface ?? canvas.stage;
    const color = userColor();
    const { marker, paint } = drawMarker(token);
    paint(color);
    marker.visible = false;
    layer.addChild(marker);

    let ring = null;
    const from = rangeFrom?.center ?? null;
    if (from && Number(range) > 0) {
      const radius = Number(range) * (canvas.dimensions?.distancePixels ?? ((canvas.dimensions?.size ?? 100) / (canvas.dimensions?.distance ?? 5)));
      ring = new PIXI.Graphics();
      ring.eventMode = 'none';
      ring.lineStyle(2, color, 0.8).beginFill(color, 0.06).drawCircle(from.x, from.y, radius).endFill();
      layer.addChild(ring);
    }

    const measure = (a, b) => canvas.grid.measurePath([a, b]).distance;
    // The pointer-over cursor styles PIXI swaps in (a token's pointer): crosshair everywhere while picking.
    const styles = canvas.app?.renderer?.events?.cursorStyles;
    const saved = styles ? { default: styles.default, pointer: styles.pointer } : null;
    if (styles) {
      styles.default = 'crosshair';
      styles.pointer = 'crosshair';
    }

    const view = canvas.app?.view;
    const savedCursor = view?.style?.cursor;
    if (view?.style) {
      view.style.cursor = 'crosshair';
    }

    let shift = false;
    let last = null;
    const place = (position) => {
      last = position;
      const at = landingPoint(position, { token, snap, free: shift, grid: canvas.grid });
      marker.position.set(at.x, at.y);
      marker.visible = true;
      paint(withinRange(from, at, range, measure) ? color : OUT_OF_RANGE);
      return at;
    };

    let done = false;
    const finish = (point) => {
      if (done) {
        return;
      }

      done = true;
      canvas.stage.off('pointermove', onMove);
      canvas.stage.off('pointerdown', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      document.removeEventListener('contextmenu', onContext, true);
      marker.destroy({ children: true });
      ring?.destroy();
      if (styles && saved) {
        Object.assign(styles, saved);
      }

      if (view?.style) {
        view.style.cursor = savedCursor ?? '';
      }

      resolve(point);
    };

    const local = event => event?.getLocalPosition?.(canvas.stage) ?? canvas.mousePosition ?? null;
    const onMove = (event) => {
      const position = local(event);
      if (position) {
        place(position);
      }
    };

    const onClick = (event) => {
      if (event?.button == 2) {
        finish(null);
        return;
      }

      const position = local(event);
      finish(position ? landingPoint(position, { token, snap, free: shift || !!event?.shiftKey, grid: canvas.grid }) : null);
    };

    const onKey = (event) => {
      if (event.type == 'keydown' && event.key == 'Escape') {
        finish(null);
        return;
      }

      if (event.key == 'Shift') {
        shift = event.type == 'keydown';
        if (last) {
          place(last);
        }
      }
    };

    const onContext = (event) => {
      event.preventDefault();
      finish(null);
    };

    canvas.stage.on('pointermove', onMove);
    canvas.stage.on('pointerdown', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    document.addEventListener('contextmenu', onContext, true);
    if (canvas.mousePosition) {
      place(canvas.mousePosition);
    }
  });
}
