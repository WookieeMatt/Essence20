/**
 * Area of Effect targeting - GitHub issue #824 ("Add a shape (?) field to weapon effects...
 * either burst or cone"), scoped to the Blast/AoE half of GI Joe CRB p.198's own combat rules
 * ("Some attacks... are noted as having Area of Effect or Blast qualities... you roll your attack
 * as normal, using a single test result against the Defense of all targets fully or partially in
 * the target area"). That's exactly what dice.mjs's existing checkEntries already does for
 * however many tokens happen to be in game.user.targets - one shared roll, compared per target -
 * so this file's only job is turning "a shape placed on the canvas" into "the right tokens
 * targeted." Nothing in the roll pipeline itself needs to change.
 *
 * The book's OTHER area-shaped mechanic, "Multiple Targets (X, ...)" (p.198), is a different
 * thing - the shape only caps who's ELIGIBLE, the player picks up to X of them, and the book's own
 * worked example rolls independently per target ("she rolls twice... getting a total of 10 and
 * 16"), not one shared roll. That needs a real second roll-resolution path in dice.mjs and isn't
 * built here.
 *
 * BUILT ON FOUNDRY v14's OWN REGION PLACEMENT API. MeasuredTemplate is deprecated outright in v14
 * ("merged into the functionality of the Region document"), and Region's interactive placement is
 * no longer something a system has to hand-roll: canvas.regions.placeRegion(data, options) runs
 * the whole gesture - a live preview that follows the cursor, mouse-wheel rotation, left-click to
 * confirm, right-click to skip, dismiss key to cancel - and hands back a RegionDocument. This file
 * previously implemented all of that itself (a raw pointer-event loop plus a PIXI.Graphics preview
 * painted onto canvas.controls) because v13 had no such API; that code is gone.
 *
 * `create: false` is the important option here: it runs the full placement gesture but never
 * writes the Region to the scene, which is exactly what an INSTANTANEOUS area wants - the shape
 * exists only long enough to decide who's caught by it. A longer-duration area is the same call
 * with `create: true`, which is why that flag, rather than a second code path, is the seam a
 * lingering-AoE feature would build on.
 *
 * Live-canvas code below (the actual placement call, token/grid geometry) has no unit test
 * coverage, consistent with every other Hooks/canvas-touching piece already in this codebase
 * (documents/combat.mjs's own rollInitiative override, essence20.mjs's Hooks.on wiring, etc.) -
 * it needs live verification in a running world instead. feetToPixels/angleBetweenPoints/
 * buildAoeShapeData are factored out specifically because they're pure data-shaping that CAN be
 * unit tested.
 */

import { isLingering } from "../data/duration-schema.mjs";
import { actorHasPerk } from "./perks.mjs";

const BIGGER_BOOMS_ID = "Compendium.essence20.gi_joe_crb.Item.8oGpBcKAnhJaSqVD";

// GI Joe's own "Blast (Xft cone)" quality never states a cone's angular width - this system has
// to pick one. 53 degrees is Foundry core's own long-standing default cone angle (originally
// popularized by the dnd5e system and widely reused since), the same "borrow an existing
// precedent rather than invent a number" reasoning Alpha Strike/Got To Get Tough's own
// unstated-range clauses already used.
export const DEFAULT_CONE_ANGLE_DEGREES = 53;

// A "Blast: Nft line" states its length but never its width, so this system has to pick one. 5ft
// is one grid square at this system's own scale (system.json's grid.distance), which is how a line
// effect reads on a battle map and the narrowest width that still covers whole squares - the same
// "borrow the obvious existing precedent rather than invent a number" reasoning
// DEFAULT_CONE_ANGLE_DEGREES already used for the unstated cone angle.
export const DEFAULT_LINE_WIDTH_FEET = 5;

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
 * The effective AoE radius, in feet, for this item's placed shape - the base system.radius plus
 * Bigger Booms' own bonus (Artillery Focus, 3rd level, p.80): "your attacks with explosives
 * increases their Area of Effect by 10 feet." (Its other two clauses - a free explosive weapon
 * Qualification, and extra equipment-loadout hands - are Equipment Assignment phase grants, not a
 * roll.) The classification read is weaponEffect-only by nature; a spell or Power has no
 * classification at all, so it optional-chains away to a plain base radius. Factored out as pure
 * math specifically so it can be unit tested, unlike the rest of placeAoeTemplate's own
 * live-canvas body - same reasoning as feetToPixels/angleBetweenPoints.
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect, spell or Power being placed.
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

/**
 * The Region shape data for one AoE, in the vocabulary Foundry's own shape types use - the
 * system.shape field deliberately stores those type names directly (see data/aoe-schema.mjs), so
 * this is a shape-specific assembly step rather than a translation table.
 *
 *   circle    - placed freely: x/y start at the origin and placeRegion's own cursor tracking moves
 *               it, so the stored coordinates here are only a starting point.
 *   cone      - apex pinned to the attacker's own token; only its rotation follows the cursor (see
 *               placeAoeTemplate's onMove).
 *   emanation - anchored to the attacker's token via a `token` base shape, so it's positioned
 *               entirely by whose token it belongs to and needs no placement gesture at all.
 *               gridBased, because an emanation reads as "every square within X feet" rather than
 *               as a drawn circle.
 *
 * @param {String} shape          One of E20.aoeShapes.
 * @param {Number} radiusPixels   The already-converted radius, in canvas pixels.
 * @param {Object} [token]        The attacker's own token document source ({x, y, width, height,
 *   shape}), required for cone and emanation, ignored for circle.
 * @param {{x: Number, y: Number}} [center]   The attacker's token centre, required for cone.
 * @returns {Object}   A single Region shape data object.
 */
export function buildAoeShapeData(shape, radiusPixels, { token, center, lineWidthPixels } = {}) {
  switch (shape) {
  case 'cone':
    return {
      type: 'cone',
      x: center.x,
      y: center.y,
      radius: radiusPixels,
      angle: DEFAULT_CONE_ANGLE_DEGREES,
      rotation: 0,
      gridBased: false,
    };
  case 'line':
    // Anchored exactly like a cone - it starts at the attacker and only its direction is chosen -
    // so radiusPixels is its LENGTH here rather than a radius.
    return {
      type: 'line',
      x: center.x,
      y: center.y,
      length: radiusPixels,
      width: lineWidthPixels,
      rotation: 0,
      gridBased: false,
    };
  case 'emanation':
    return {
      type: 'emanation',
      base: {
        type: 'token',
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
        shape: token.shape,
      },
      radius: radiusPixels,
      gridBased: true,
    };
  default:
    return { type: 'circle', x: 0, y: 0, radius: radiusPixels, gridBased: false };
  }
}

/**
 * The Region behaviors a lingering area carries - what actually makes standing in it DO something,
 * as opposed to just drawing a shape on the map.
 *
 * This is core's own `applyActiveEffect` behavior rather than a custom RegionBehaviorType of ours:
 * v14 ships one that takes a set of ActiveEffect UUIDs, applies them to a token's actor on
 * tokenEnter and removes them again on tokenExit, which is exactly "you have this effect while
 * you're standing in the area" and so exactly what a lingering spell or Power wants. A custom type
 * would only be needed for something the book-standard shape can't express - a per-round damage
 * tick, or a fresh attack roll on entry.
 *
 * An item with no Active Effects of its own gets no behavior at all: the area is then purely
 * visual, a marked patch of ground the GM narrates, which is still better than not drawing it.
 * @param {Item} item   The spell or Power that created this area.
 * @returns {Array<Object>}   RegionBehavior creation data.
 */
export function buildAoeBehaviors(item) {
  const effectUuids = (item?.effects?.contents ?? [...(item?.effects ?? [])])
    .map(effect => effect.uuid)
    .filter(uuid => !!uuid);

  if (!effectUuids.length) {
    return [];
  }

  return [{
    name: item.name,
    type: 'applyActiveEffect',
    system: { effects: effectUuids },
  }];
}

/**
 * The RegionDocument creation data for one placed area - shared by both routes onto the scene:
 * canvas.regions.placeRegion() for a circle or cone (which the player positions by hand) and a
 * direct createEmbeddedDocuments for an emanation (which has nothing to position, being anchored
 * to its caster). Factored out so those two can't drift apart, and so the provenance a lingering
 * area depends on is written in exactly one place.
 * @param {Actor} actor   The caster/attacker.
 * @param {Item} item   The weaponEffect, spell or Power.
 * @param {Object} shapeData   From buildAoeShapeData.
 * @param {Object} options
 * @param {Boolean} options.lingering   Whether this area persists past the roll.
 * @param {Token} [options.attachedToken]   Anchor the Region to this token so it moves with them.
 * @returns {Object}   RegionDocument creation data.
 */
export function buildAoeRegionData(actor, item, shapeData, { lingering, attachedToken = null } = {}) {
  const data = {
    name: item.name,
    shapes: [shapeData],
    color: game.user.color,
    // Scoped to the level the placer is actually looking at, so a blast doesn't catch anyone on
    // another floor. An empty set means "every level" (RegionDocument#includedInLevel returns true
    // when levels is empty), which is the right fallback on a scene with no levels at all and the
    // same thing core's own MeasuredTemplate-to-Region shim does. An attached Region has to sit in
    // its token's own level instead, which core enforces.
    levels: attachedToken
      ? [attachedToken.document.level].filter(level => !!level)
      : (canvas.level ? [canvas.level.id] : []),
    // Highlight the grid squares the shape actually covers and label its measurements - core's own
    // affordances for exactly this "see where the blast lands before committing" moment, and a
    // straight upgrade on the bare outline this file used to paint by hand.
    highlightMode: "coverage",
    displayMeasurements: true,
    visibility: CONST.REGION_VISIBILITY.ALWAYS,
  };

  if (!lingering) {
    return data;
  }

  // A lingering area has to be findable again after a reload, by a client that wasn't the one that
  // placed it - so who made it, what made it, and when it started all travel on the Region itself
  // rather than in any in-memory bookkeeping. None of this is written for an instantaneous area,
  // which never reaches the scene in the first place.
  return {
    ...data,
    ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    behaviors: buildAoeBehaviors(item),
    // An emanation follows its caster; core requires an attached Region to match that token's own
    // hidden state.
    ...(attachedToken
      ? { attachment: { token: attachedToken.id }, hidden: attachedToken.document.hidden }
      : {}),
    flags: {
      essence20: {
        aoe: {
          actorUuid: actor?.uuid ?? null,
          itemUuid: item.uuid ?? null,
          duration: { ...item.system.duration },
          // Stamped now so the expiry pass has an origin to measure from - a round-based duration
          // can't become an absolute deadline without knowing which round it started in.
          placedAtRound: game.combat?.round ?? null,
          placedAtWorldTime: game.time?.worldTime ?? null,
        },
      },
    },
  };
}

/**
 * An ephemeral RegionDocument - constructed, never persisted to the scene. Used purely to reuse
 * Region's own containment math against a shape nobody placed interactively (see
 * getTokensInShape). Nothing is written to the scene, so there's no REGION_CREATE permission
 * concern and nothing to clean up afterward.
 * @param {Array<Object>} shapes
 * @returns {RegionDocument}
 * @private
 */
function makeEphemeralRegion(shapes) {
  return new CONFIG.Region.documentClass(
    // name is a required RegionDocument field even though this one is never rendered/persisted -
    // just a throwaway label to satisfy schema validation.
    { name: 'AoE Preview', shapes },
    { parent: canvas.scene },
  );
}

/**
 * Every token on the current scene caught by the given Region, via v14's own
 * TokenDocument#testInsideRegion - a real footprint/shape/elevation test, the same one Foundry
 * uses internally to decide region membership. This file previously tested the token's single
 * centre point instead, which quietly missed a large token clipping the edge of a blast; v14's
 * own test is both more correct and no longer something this system has to approximate.
 * @param {RegionDocument} region
 * @param {Token} [exclude]   A token to leave out regardless - the attacker's own, for a shape
 *   anchored on them (a cone's apex and an emanation's base both trivially contain it).
 * @returns {Array<Token>}
 */
export function getTokensInRegion(region, exclude=null) {
  return canvas.tokens.placeables.filter(
    token => token !== exclude && token.document.testInsideRegion(region),
  );
}

/**
 * Every token on the current scene caught by the given raw shape data. Exported (not just an
 * internal step of placeAoeTemplate below) because Mighty Strikes (helpers/mighty-strikes.mjs)
 * reuses this exact containment math for its own AUTOMATIC self-centered area - no placement
 * gesture involved at all.
 * @param {Object} shapeData   A single Region shape data object, e.g.
 *   { type: 'circle', x, y, radius } or { type: 'cone', x, y, radius, angle, rotation }.
 * @returns {Array<Token>}
 */
export function getTokensInShape(shapeData) {
  return getTokensInRegion(makeEphemeralRegion([{ gridBased: false, ...shapeData }]));
}

/**
 * Places this item's AoE shape (item.system.shape/radius) and targets every token it catches, via
 * the same canvas.tokens.setTargets() API the native targeting tools (drag-select,
 * click-to-target) already use - so dice.mjs's own checkEntries (already built for "one roll vs
 * however many tokens are targeted") resolves the attack correctly with no changes of its own.
 *
 * A circle is placed freely at the cursor. A cone keeps its apex on the attacker's own token and
 * only turns to follow the cursor - placeRegion's default is to translate the whole shape to the
 * pointer, so onMove overrides the rotation and returns false to suppress that translation, which
 * still leaves core to commit and redraw the shape. An emanation is anchored to the attacker's
 * token by construction and so skips placement entirely, resolving immediately.
 *
 * No-ops (existing targets left alone) if the item has no shape set, a token-anchored shape has no
 * attacker token on the scene, or placement is cancelled.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect, spell or Power being rolled.
 * @returns {Promise<Array<Token>>}   The tokens caught by the shape, or [] if none/cancelled.
 */
export async function placeAoeTemplate(actor, item) {
  const shape = item?.system.shape;
  if (!shape) {
    return [];
  }

  const radiusPixels = feetToPixels(getEffectiveRadiusFeet(actor, item));

  // A weaponEffect has no duration field at all (an attack's damage is instantaneous by nature),
  // so it never lingers; a spell or Power lingers whenever its own duration isn't Instant.
  const lingering = isLingering(item.system.duration);

  // A cone and an emanation are both anchored to the attacker; a circle is placed wherever the
  // player clicks and so needs no token at all.
  const originToken = actor.getActiveTokens?.()?.[0] ?? null;
  const isAnchored = shape == 'cone' || shape == 'line' || shape == 'emanation';
  if (isAnchored && !originToken) {
    return [];
  }

  const shapeData = buildAoeShapeData(shape, radiusPixels, {
    token: originToken?.document._source,
    center: originToken?.center,
    lineWidthPixels: feetToPixels(DEFAULT_LINE_WIDTH_FEET),
  });

  // An emanation is fully determined by whose token it belongs to - there's nothing for the player
  // to place, so it never runs the placement gesture. An INSTANT one only has to decide who it
  // caught, so it stays ephemeral; a lingering one still has to become a real Region, attached to
  // the caster so it travels with them, which is the whole point of an emanation lasting.
  if (shape == 'emanation') {
    if (!lingering) {
      const tokens = getTokensInShape(shapeData);
      canvas.tokens.setTargets(tokens.map(token => token.id));
      return tokens;
    }

    const [created] = await canvas.scene.createEmbeddedDocuments('Region', [
      buildAoeRegionData(actor, item, shapeData, { lingering, attachedToken: originToken }),
    ]);
    if (!created) {
      return [];
    }

    const tokens = getTokensInRegion(created, originToken);
    canvas.tokens.setTargets(tokens.map(token => token.id));
    return tokens;
  }

  const origin = originToken?.center;
  const region = await canvas.regions.placeRegion(
    buildAoeRegionData(actor, item, shapeData, { lingering }),
    {
      // The instantaneous/lingering switch, and the whole of it. An Instant area only has to live
      // long enough to decide who it caught, so it's never written to the scene; anything with a
      // real duration is persisted instead and cleaned up when that duration runs out. See
      // data/duration-schema.mjs#isLingering and this file's own doc comment.
      create: lingering,
      // A cone turns in place about the attacker instead of being dragged around by the cursor.
      onMove: (shape == 'cone' || shape == 'line')
        ? ({ shape: coneShape, position }) => {
          coneShape.updateSource({ rotation: angleBetweenPoints(origin, position) });
          return false;
        }
        : undefined,
    },
  );

  if (!region) {
    return [];
  }

  // A cone's apex and a line's near end both sit exactly on the attacker's token, which trivially
  // satisfies "inside the shape" - exclude it, the same "never target yourself" precedent
  // getNearbyAllyTokens's own ally scan already established. A circle has no such issue (its centre
  // is wherever the player clicked, not necessarily the attacker), so it excludes nobody. This is
  // the same "anchored at the attacker" set isAnchored and onMove above already use; line was
  // missing from it here alone, and caught its own caster every time.
  const anchoredAtAttacker = shape == 'cone' || shape == 'line';
  const tokens = getTokensInRegion(region, anchoredAtAttacker ? originToken : null);
  canvas.tokens.setTargets(tokens.map(token => token.id));
  return tokens;
}
