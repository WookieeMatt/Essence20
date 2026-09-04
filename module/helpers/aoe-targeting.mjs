/**
 * Area of Effect targeting - GitHub issue #824 ("Add a shape (?) field to weapon effects...
 * either burst or cone"), scoped to the Blast/AoE half of GI Joe CRB p.198's own combat rules
 * ("Some attacks... are noted as having Area of Effect or Blast qualities... you roll your attack
 * as normal, using a single test result against the Defense of all targets fully or partially in
 * the target area"). That's exactly what dice.mjs's existing checkEntries already does for
 * however many tokens happen to be in game.user.targets - one shared roll, compared per target -
 * so this file's only job is turning "a burst/cone shape placed on the canvas" into "the right
 * tokens targeted." Nothing in the roll pipeline itself needs to change.
 *
 * The book's OTHER area-shaped mechanic, "Multiple Targets (X, ...)" (p.198), is a different
 * thing - the shape only caps who's ELIGIBLE, the player picks up to X of them, and the book's own
 * worked example rolls independently per target ("she rolls twice... getting a total of 10 and
 * 16"), not one shared roll. That needs a real second roll-resolution path in dice.mjs and isn't
 * built here - this file only unlocks Blast/AoE-shaped Perks (Horseshoes and Handgrenades, etc.).
 *
 * Built on Region shape data (foundry.data.CircleShapeData/ConeShapeData) rather than the older
 * MeasuredTemplate, which has been deprecated since Foundry v14 (sunset planned for v16) in favor
 * of Region. Region's own authoring tools (the Region Legend sidebar tab) are a slow, GM-oriented
 * scene-drawing workflow though, not built for "place a shape, resolve it, done" mid-combat - so
 * this builds one small, single-purpose interaction of its own instead: a single canvas click
 * supplies the placement point, and an EPHEMERAL RegionDocument (constructed, never persisted to
 * the scene) is used purely to reuse Region's own shape-containment math
 * (RegionDocument#testPoint). Nothing is ever written to the scene, so there's no REGION_CREATE
 * permission concern and nothing to clean up afterward.
 *
 * Live-canvas code below (the click listener, actual token/grid geometry) has no unit test
 * coverage, consistent with every other Hooks/canvas-touching piece already in this codebase
 * (documents/combat.mjs's own rollInitiative override, essence20.mjs's Hooks.on wiring, etc.) -
 * it needs live verification in a running world instead. feetToPixels/angleBetweenPoints are
 * factored out specifically because they're pure math that CAN be unit tested.
 *
 * The placement click also draws a live preview of the shape as the mouse moves, following the
 * cursor until the click lands - a blind click with no visual feedback at all would be a poor
 * player experience for something whose whole point is "see where the blast will land before you
 * commit." Drawn as a plain PIXI.Graphics added to canvas.controls (the same layer Foundry's own
 * drag-select rectangle and debug overlays use for exactly this kind of ephemeral, never-persisted
 * visual) - not a real Region/Template placeable, so there's still nothing written to the scene
 * and nothing left behind if the roll is cancelled mid-placement.
 */

import { actorHasPerk } from "./perks.mjs";

const BIGGER_BOOMS_ID = "Compendium.essence20.gi_joe_crb.Item.8oGpBcKAnhJaSqVD";

// GI Joe's own "Blast (Xft cone)" quality never states a cone's angular width - this system has
// to pick one. 53 degrees is Foundry core's own long-standing default cone angle (originally
// popularized by the dnd5e system and widely reused since), the same "borrow an existing
// precedent rather than invent a number" reasoning Alpha Strike/Got To Get Tough's own
// unstated-range clauses already used this session.
export const DEFAULT_CONE_ANGLE_DEGREES = 53;

/**
 * Converts a distance in feet (this system's own grid unit - every other radius/range field in
 * this codebase, e.g. Enemy Number One's 30ft, Battlefield Titan's 10ft, is already in feet) to
 * canvas pixels, the unit Region shape data is defined in.
 * @param {Number} feet
 * @returns {Number}
 */
export function feetToPixels(feet) {
  return feet * canvas.dimensions.distancePixels;
}

/**
 * The effective AoE radius, in feet, for this weaponEffect's placed shape - the base
 * system.radius plus Bigger Booms' own bonus (Artillery Focus, 3rd level, p.80): "your attacks
 * with explosives increases their Area of Effect by 10 feet." (Its other two clauses - a free
 * explosive weapon Qualification, and extra equipment-loadout hands - are Equipment Assignment
 * phase grants, not a roll, same as every other requisition/loadout clause left unautomated all
 * session.) Factored out as pure math specifically so it can be unit tested, unlike the rest of
 * placeAoeTemplate's own live-canvas body - same reasoning as feetToPixels/angleBetweenPoints.
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect being placed.
 * @returns {Number}
 */
export function getEffectiveRadiusFeet(actor, item) {
  const isExplosiveAttack = item.system.classification?.style == 'explosive';
  const biggerBoomsBonusFeet = isExplosiveAttack && actorHasPerk(actor, BIGGER_BOOMS_ID) ? 10 : 0;
  return (item.system.radius || 0) + biggerBoomsBonusFeet;
}

/**
 * The direction in degrees from one point to another, in Foundry's own clockwise-from-east
 * convention (matching Region shape data's own `rotation` field).
 * @param {{x: Number, y: Number}} origin
 * @param {{x: Number, y: Number}} target
 * @returns {Number}
 */
export function angleBetweenPoints(origin, target) {
  return Math.toDegrees(Math.atan2(target.y - origin.y, target.x - origin.x));
}

// Preview stroke/fill - a warm, high-visibility orange that reads clearly against any scene's own
// art (matching the color a lot of Foundry's own core/system template previews already reach for)
// rather than anything theme-derived, since this draws straight onto the PIXI canvas, not the DOM.
const PREVIEW_COLOR = 0xff8800;

/**
 * Waits for the next left click on the canvas and resolves with its world coordinates. Right
 * click or Escape cancels (resolves null) - the same cancel gesture Foundry's own placement tools
 * (template/region/ruler) already use. Calls onMove(worldPoint) on every pointer move in the
 * meantime, so the caller can redraw a live preview under the cursor.
 *
 * Listens on the actual DOM canvas element (canvas.app.view) rather than the PIXI stage - the
 * stage is a bare Container with no hitArea of its own, so it only ever receives pointer events
 * that land on an already-interactive child (a token, a tile, ...) and bubble up; empty ground,
 * exactly where a burst/cone origin is usually placed, would otherwise never reach it at all.
 * canvas.canvasCoordinatesFromClient is the same client-to-world conversion Foundry's own
 * drop-handling uses (client/canvas/board.mjs#_onDrop).
 * @param {Function} onMove   Called with the current world-space {x, y} on every pointer move.
 * @returns {Promise<{x: Number, y: Number}|null>}
 * @private
 */
function pickCanvasPoint(onMove) {
  return new Promise(resolve => {
    const view = canvas.app.view;

    const cleanup = () => {
      view.removeEventListener('pointerdown', onDown);
      view.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onPointerMove = event => {
      onMove(canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY }));
    };

    const onDown = event => {
      if (event.button === 2) {
        cleanup();
        resolve(null);
        return;
      }

      const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
      cleanup();
      resolve(point);
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };

    view.addEventListener('pointerdown', onDown);
    view.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
  });
}

/**
 * Redraws a burst preview: a circle of the given radius centered on the current cursor position.
 * @param {PIXI.Graphics} graphics
 * @param {{x: Number, y: Number}} center
 * @param {Number} radius
 * @private
 */
function drawBurstPreview(graphics, center, radius) {
  graphics.clear();
  graphics.lineStyle(3, PREVIEW_COLOR, 0.9).beginFill(PREVIEW_COLOR, 0.15);
  graphics.drawCircle(center.x, center.y, radius);
  graphics.endFill();
}

/**
 * Redraws a cone preview: a pie wedge from the fixed origin (the attacker's own token), aimed at
 * the current cursor position, at the same fixed angular width the final shape will use.
 * @param {PIXI.Graphics} graphics
 * @param {{x: Number, y: Number}} origin
 * @param {{x: Number, y: Number}} aim
 * @param {Number} radius
 * @private
 */
function drawConePreview(graphics, origin, aim, radius) {
  graphics.clear();
  graphics.lineStyle(3, PREVIEW_COLOR, 0.9).beginFill(PREVIEW_COLOR, 0.15);

  const rotation = Math.toRadians(angleBetweenPoints(origin, aim));
  const halfAngle = Math.toRadians(DEFAULT_CONE_ANGLE_DEGREES / 2);
  graphics.moveTo(origin.x, origin.y);
  graphics.arc(origin.x, origin.y, radius, rotation - halfAngle, rotation + halfAngle);
  graphics.lineTo(origin.x, origin.y);
  graphics.endFill();
}

/**
 * Every token on the current scene whose center falls inside the given shape. Exported (not just
 * an internal step of placeAoeTemplate below) because Mighty Strikes
 * (helpers/mighty-strikes.mjs) reuses this exact containment math for its own AUTOMATIC
 * self-centered area - no click, no placeAoeTemplate involved at all.
 * @param {Object} shapeData   A single Region shape data object, e.g.
 *   { type: 'circle', x, y, radius } or { type: 'cone', x, y, radius, angle, rotation }.
 * @returns {Array<Token>}
 */
export function getTokensInShape(shapeData) {
  const region = new CONFIG.Region.documentClass(
    // name is a required RegionDocument field even though this one is never rendered/persisted -
    // just a throwaway label to satisfy schema validation.
    { name: 'AoE Preview', shapes: [{ gridBased: false, ...shapeData }] },
    { parent: canvas.scene },
  );

  return canvas.tokens.placeables.filter(token =>
    region.testPoint({ x: token.center.x, y: token.center.y, elevation: token.document.elevation }),
  );
}

/**
 * Places a burst or cone AoE shape for the given weaponEffect (item.system.shape/radius) and
 * targets every token it catches, via the same canvas.tokens.setTargets() API the native
 * targeting tools (drag-select, click-to-target) already use - so dice.mjs's own checkEntries
 * (already built for "one roll vs however many tokens are targeted") resolves the attack
 * correctly with no changes of its own. A burst is centered on the clicked point; a cone
 * originates at the attacker's own token and is aimed at the clicked point. No-ops (existing
 * targets left alone) if the item has no shape set, the attacker has no token on the scene, or
 * placement is cancelled.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect being rolled.
 * @returns {Promise<Array<Token>>}   The tokens caught by the shape, or [] if none/cancelled.
 */
export async function placeAoeTemplate(actor, item) {
  const shape = item?.system.shape;
  if (!shape) {
    return [];
  }

  const radius = feetToPixels(getEffectiveRadiusFeet(actor, item));
  let shapeData;
  let originToken = null;

  // Live preview graphic (see this file's own doc comment) - created up front so it's already on
  // the canvas the moment the player starts moving the mouse, and always torn down via `finally`
  // below, cancellation included, so nothing is ever left behind on the canvas.
  const preview = canvas.controls.addChild(new PIXI.Graphics());

  try {
    if (shape === 'burst') {
      const center = await pickCanvasPoint(point => drawBurstPreview(preview, point, radius));
      if (!center) {
        return [];
      }

      shapeData = { type: 'circle', x: center.x, y: center.y, radius };
    } else {
      originToken = actor.getActiveTokens?.()?.[0];
      if (!originToken) {
        return [];
      }

      const origin = originToken.center;
      const aim = await pickCanvasPoint(point => drawConePreview(preview, origin, point, radius));
      if (!aim) {
        return [];
      }

      shapeData = {
        type: 'cone',
        x: origin.x,
        y: origin.y,
        radius,
        angle: DEFAULT_CONE_ANGLE_DEGREES,
        rotation: angleBetweenPoints(origin, aim),
      };
    }
  } finally {
    canvas.controls.removeChild(preview);
    preview.destroy();
  }

  // A cone's own apex sits exactly on the attacker's token, which trivially satisfies "inside the
  // shape" at distance 0 - exclude it, the same "never target yourself" precedent
  // getNearbyAllyTokens's own ally scan already established. A burst has no such issue (its
  // center is wherever the player clicked, not necessarily the attacker), so originToken stays
  // null there and this filter is a no-op.
  const tokens = getTokensInShape(shapeData).filter(token => token !== originToken);
  canvas.tokens.setTargets(tokens.map(token => token.id));
  return tokens;
}
