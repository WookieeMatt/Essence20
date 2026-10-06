/**
 * Transformers (Enigma of Combination) - Perfect Placement's tactical square.
 */
import {
  registerConsumer, registerDefenseAdjust, registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { hasUsedThisRound, markUsedThisRound } from "../../mechanics/characters/perks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape } from "../shared/chat-lines.mjs";
import { findSourced as findItem, has, isItem } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { tokenOf } from "../shared/sides.mjs";

/*
 * Perfect Placement (Enigma of Combination, Surveyor, 20th level, p.37): "You can dictate a 25-foot ×
 * 25-foot area of the scene that is a perfectly tactical location. While wholly within this location,
 * you always have Cover, ignore other targets' Cover in that area, gain +2 to your Evasion Defense,
 * and gain ↑1 on the first Skill Test you make each round." The Use button places the square (a click
 * on the canvas) for the scene.
 */
const ZONE_FLAG = 'o3PerfectPlacement';
const ZONE_FEET = 25;

export function zoneOf(actor) {
  const zone = findItem(actor, O3.perfectPlacement)?.flags?.essence20?.[ZONE_FLAG];
  return zone && zone.epoch == getSceneEpoch() && zone.sceneId == canvas?.scene?.id ? zone : null;
}

/** Whether a token's footprint lies wholly inside a square zone centred on (x, y). */
export function whollyInside(bounds, zone, pxPerFoot) {
  if (!bounds || !zone) {
    return false;
  }

  const half = (ZONE_FEET * pxPerFoot) / 2;
  return bounds.x >= zone.x - half && bounds.y >= zone.y - half
    && bounds.x + bounds.width <= zone.x + half && bounds.y + bounds.height <= zone.y + half;
}

function pxPerFoot() {
  const d = canvas?.dimensions;
  return d?.size && d?.distance ? d.size / d.distance : 0;
}

function tokenBounds(token) {
  const doc = token?.document;
  const size = canvas?.dimensions?.size ?? 0;
  if (!doc) {
    return null;
  }

  return { x: doc.x, y: doc.y, width: num(doc.width) * size, height: num(doc.height) * size };
}

export function inPerfectPlacement(holder, actor = holder) {
  const zone = zoneOf(holder);
  return !!zone && whollyInside(tokenBounds(tokenOf(actor)), zone, pxPerFoot());
}

registerUse({
  id: 'o3PerfectPlacement',
  matches: item => isItem(item, O3.perfectPlacement),
  run: async (item) => {
    const { pickCanvasPoint } = await import("../../mechanics/combat/forced-movement.mjs");
    const point = await pickCanvasPoint(T('O3PerfectPlacementPick'));
    if (!point) {
      return null;
    }

    await item.setFlag('essence20', ZONE_FLAG, { sceneId: canvas.scene.id, x: point.x, y: point.y, epoch: getSceneEpoch() });
    return T('O3PerfectPlacementSet', { name: escape(item.parent.name) });
  },
});

registerRollSources((actor, target, ctx) => {
  const sources = [];
  const consumes = [];
  if (has(actor, O3.perfectPlacement) && inPerfectPlacement(actor)) {
    if (game.combat && !hasUsedThisRound(actor, ZONE_FLAG)) {
      sources.push({ id: 'o3PerfectPlacementFirst', label: 'Perfect Placement', shiftUp: 1 });
      consumes.push({ ext: 'o3PerfectPlacement', actorUuid: actor.uuid });
    }

    // Ignore the Cover of a target standing in the same square.
    if (target && ctx?.isAttack && !ctx.isMelee && target.statuses?.has?.('cover') && inPerfectPlacement(actor, target)) {
      sources.push({ id: 'o3PerfectPlacementIgnoreCover', label: 'Perfect Placement', shiftUp: 2 });
    }
  }

  // "You always have Cover" - the ↓2 a ranged attack against Cover takes (dice.mjs), when the
  // holder doesn't already have the Condition.
  if (target && ctx?.isAttack && !ctx.isMelee && has(target, O3.perfectPlacement) && inPerfectPlacement(target)
    && !target.statuses?.has?.('cover') && !target.statuses?.has?.('totalCover')) {
    sources.push({ id: 'o3PerfectPlacementCover', label: `${game.i18n.localize('E20.DamageCover')} (Perfect Placement)`, shiftDown: 2 });
  }

  return { sources, consumes };
});

registerConsumer('o3PerfectPlacement', async (consume) => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor?.isOwner) {
    await markUsedThisRound(actor, ZONE_FLAG);
  }
});

registerDefenseAdjust((attacker, defender, defenseType) => (defenseType == 'evasion' && has(defender, O3.perfectPlacement)
  && inPerfectPlacement(defender) ? 2 : 0));
