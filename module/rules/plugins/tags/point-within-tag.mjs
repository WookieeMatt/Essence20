import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (items2): `self:pointWithin:<ft>` - the point a `pickPoint` step kept in this run (@var.pointX / @var.pointY)
 * is no farther than that from the centre of the actor's token (the grid's measured distance - forced-movement.mjs
 * #distanceFeet). False with no point kept; true when the actor has no token or there's no grid to measure on (nothing
 * to refuse it by). Pair it with a `warn {stop: true}` before a cost is paid: Timeslide's "anywhere within 200 feet".
 */
export function pointWithinTag(rest, ctx) {
  const x = Number(ctx?.vars?.pointX);
  const y = Number(ctx?.vars?.pointY);
  if (ctx?.vars?.pointX === undefined || ctx?.vars?.pointX === '' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const center = ctx.self?.getActiveTokens?.()?.[0]?.center;
  const measure = globalThis.canvas?.grid?.measurePath;
  if (!center || typeof measure != 'function') {
    return true;
  }

  return globalThis.canvas.grid.measurePath([center, { x, y }]).distance <= Number(rest);
}

registerTag('self:pointWithin', pointWithinTag, { phrase: ['{who} {is} within {ft} of the kept point', '{who} {is} more than {ft} from the kept point'] });
