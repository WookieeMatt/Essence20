import { registerRollSources } from "../../../helpers/extensions.mjs";
import { isExpired, stampFor } from "../../expiry.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRecipient, registerStep } from "../../steps.mjs";
import { escape, T, worldActors, write } from "./common.mjs";

/**
 * Points on the canvas (round 10, group D):
 *
 *  - Step `pickPoint {prompt?, at?}` - the player clicks a point (at: targetOrSelf - the first target's token, else
 *    the actor's own); kept as @var.pointX / @var.pointY and {var.pointScene}. A cancel stops the run.
 *  - Recipient `around:<ft>` - every token's actor within that many feet of the point (either side, the actor too).
 *  - Step `placeZone {key, label?, half?, until?, modifier: {when, upshift?, downshift?, edge?, snag?}}` - a zone on the
 *    point (a square reaching `half` grid squares each way, default 1), kept on the actor; anyone rolling from inside
 *    a live zone whose modifier `when` holds (self: the roller) gets its shifts as a roll source.
 */

/** Tokens whose centre is within `feet` of a point (the viewed scene). */
export function tokensAround(point, feet) {
  const grid = globalThis.canvas?.grid;
  if (!point || !grid?.measurePath) {
    return [];
  }

  return (globalThis.canvas?.tokens?.placeables ?? []).filter(token => token?.actor && token.center
    && grid.measurePath([{ x: point.x, y: point.y }, token.center]).distance <= feet);
}

function pointOf(ctx) {
  const x = Number(ctx.vars?.pointX);
  const y = Number(ctx.vars?.pointY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

registerStep('pickPoint', async (step, ctx) => {
  let point = null;
  if (step.at == 'targetOrSelf') {
    const target = ctx.targets[0]?.getActiveTokens?.()?.[0];
    point = target?.center ?? ctx.actor?.getActiveTokens?.()?.[0]?.center ?? null;
  } else if (step.at == 'actorOrKept') {
    // actorOrKept: where the actor named by `actor` ({var.x}, a uuid) stands now, else the point already kept.
    const uuid = String(step.actor ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
    const actor = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
    const kept = Number.isFinite(Number(ctx.vars?.pointX)) && ctx.vars?.pointX !== '' ? { x: Number(ctx.vars.pointX), y: Number(ctx.vars.pointY) } : null;
    point = actor?.getActiveTokens?.()?.[0]?.center ?? kept;
    if (point && !actor) {
      return;
    }
  } else if (ctx.pickPoint) {
    point = await ctx.pickPoint(step, ctx);
  } else {
    const { pickCanvasPoint } = await import("../../../helpers/forced-movement.mjs");
    point = await pickCanvasPoint(step.prompt ?? T('PickPoint'));
  }

  if (!point) {
    return false;
  }

  ctx.vars.pointX = point.x;
  ctx.vars.pointY = point.y;
  ctx.vars.pointScene = globalThis.canvas?.scene?.id ?? '';
}, { errors: (step, where) => (step.at && !['targetOrSelf', 'actorOrKept'].includes(step.at) ? [`${where}: at must be targetOrSelf or actorOrKept`] : []) });

registerRecipient(/^around:(\d+)$/, (match, ctx) => [...new Set(tokensAround(pointOf(ctx), Number(match[1])).map(token => token.actor))]);

/* -------------------------------------------- */
/*  Zones                                        */
/* -------------------------------------------- */

const ZONES = 'ruleZones';

export const zonesOf = actor => (Array.isArray(actor?.flags?.essence20?.[ZONES]) ? actor.flags.essence20[ZONES] : []);

registerStep('placeZone', async (step, ctx) => {
  const point = pointOf(ctx);
  if (!point || !step.key) {
    return false;
  }

  const zone = {
    key: step.key, label: step.label || ctx.item?.name || '', x: point.x, y: point.y, sceneId: globalThis.canvas?.scene?.id ?? null,
    half: Number(step.half) || 1, modifier: step.modifier ?? {}, until: step.until ?? 'scene',
    stamp: stampFor(step.until ?? 'scene', undefined, ctx.actor),
  };
  const kept = zonesOf(ctx.actor).filter(other => !isExpired(other));
  await write(ctx.actor, 'update', [{ [`flags.essence20.${ZONES}`]: [...kept, zone] }]);
  ctx.chat.push(escape(T('ZonePlaced', { name: ctx.actor?.name ?? '', zone: zone.label })));
}, { errors: (step, where) => (step.key ? [] : [`${where}: placeZone needs a key`]) });

/** Whether a token stands in a zone (its centre within `half` grid squares of the zone's point, same scene). */
export function inZone(token, zone) {
  const size = Number(globalThis.canvas?.grid?.size) || 0;
  if (!token?.center || !size || zone.sceneId != globalThis.canvas?.scene?.id) {
    return false;
  }

  const reach = size * (Number(zone.half) || 1);
  return Math.abs(token.center.x - zone.x) <= reach && Math.abs(token.center.y - zone.y) <= reach;
}

/** The roll sources from every live zone the roller stands in. */
export function zoneSources(actor, target, roll = {}) {
  const token = actor?.getActiveTokens?.()?.[0];
  const sources = [];
  if (!token) {
    return { sources, consumes: [] };
  }

  const seen = new Set();
  for (const owner of worldActors()) {
    for (const zone of zonesOf(owner)) {
      if (seen.has(zone.key) || isExpired(zone) || !inZone(token, zone)) {
        continue;
      }

      const modifier = zone.modifier ?? {};
      if (evaluate(modifier.when ?? [], contextFor({ ...roll, self: actor, other: target })) !== true) {
        continue;
      }

      seen.add(zone.key);
      sources.push({
        id: `ruleZone-${zone.key}`, label: zone.label, shiftUp: Number(modifier.upshift) || 0, shiftDown: Number(modifier.downshift) || 0,
        edge: !!modifier.edge, snag: !!modifier.snag,
      });
    }
  }

  return { sources, consumes: [] };
}

registerRollSources((actor, target, ctx) => zoneSources(actor, target, ctx ?? {}));
