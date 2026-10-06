import { isExpired } from "../../expiry.mjs";
import { registerTag } from "../../predicate.mjs";
import { zonesOf } from "./canvas-points.mjs";

/**
 * Round 15 (items2): standing wholly inside a zone the rule's holder placed (canvas-points.mjs placeZone) - Perfect
 * Placement's "while wholly within this location".
 *
 *   zone:self:<key>     the actor's token footprint lies wholly inside a live <key> zone of the holder's, on this scene
 *   zone:target:<key>   ...the other party's (the roll's target) does
 *
 * A roll-time family (where a token stands changes between rolls), so a Defense rule reading it is worked out per
 * attack, not on the sheet. No token, no grid, another scene: false.
 */

const tokenOf = actor => actor?.token?.object ?? actor?.getActiveTokens?.()?.[0] ?? null;

/** The token's footprint in canvas pixels. */
function footprint(token) {
  const size = Number(globalThis.canvas?.grid?.size) || Number(globalThis.canvas?.dimensions?.size) || 0;
  const doc = token?.document;
  if (!doc || !size || !Number.isFinite(Number(doc.x)) || !Number.isFinite(Number(doc.y))) {
    return null;
  }

  return { x: Number(doc.x), y: Number(doc.y), width: (Number(doc.width) || 1) * size, height: (Number(doc.height) || 1) * size };
}

/** Whether a footprint lies wholly inside a square zone (its centre x, y; `half` grid squares each way). */
export function whollyInZone(bounds, zone) {
  const size = Number(globalThis.canvas?.grid?.size) || Number(globalThis.canvas?.dimensions?.size) || 0;
  if (!bounds || !zone || !size || zone.sceneId != globalThis.canvas?.scene?.id) {
    return false;
  }

  const reach = size * (Number(zone.half) || 0);
  return bounds.x >= zone.x - reach && bounds.y >= zone.y - reach && bounds.x + bounds.width <= zone.x + reach && bounds.y + bounds.height <= zone.y + reach;
}

function inHolderZone(actor, key, ctx) {
  const holder = ctx?.holder ?? ctx?.self;
  if (!actor || !holder || !key) {
    return false;
  }

  const bounds = footprint(tokenOf(actor));
  return zonesOf(holder).some(zone => zone.key == key && !isExpired(zone) && whollyInZone(bounds, zone));
}

registerTag('zone:self', (rest, ctx) => inHolderZone(ctx?.self, rest, ctx), { family: 'roll', param: 'key', phrase: ["you stand wholly inside its owner's {arg} zone", "you aren't wholly inside its owner's {arg} zone"] });
registerTag('zone:target', (rest, ctx) => inHolderZone(ctx?.other, rest, ctx), { phrase: ["the target stands wholly inside its owner's {arg} zone", "the target isn't wholly inside its owner's {arg} zone"] });
