import { resolveValue } from "../../formula.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { escape, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Step `moveTo {to?, maxRange?, forced?, animate?}` (round 15, uses) - each recipient's token is put on the point a
 * `pickPoint` step kept (@var.pointX / @var.pointY), centred on it.
 *   - `forced` (default true): moved by someone else - mechanics/combat/forced-movement.mjs#placeActorAt (snapped to the
 *     grid, Immovable Object / Bullbar may refuse, through the GM for a token the user can't move). `forced: false`: the
 *     actor moving itself (Ghillie Suit Sniping, Wrist Communicator) - the token is updated straight onto the point.
 *   - `maxRange` (feet, a formula): refused, with a warning, when the point is farther than that from the actor's token
 *     (no token - no check).
 *   - `animate: false` - the token jumps (a teleport).
 *   - `snap: true` (with forced: false) - snapped to the grid first (token.document.getSnappedPosition).
 * No point kept, or a recipient with no token: nothing happens. `@var.moved` counts who moved.
 */

const localize = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(key, data) : i18n?.localize?.(key);
  return text && text != key ? text : key;
};

const tokenOf = actor => actor?.token?.object ?? actor?.getActiveTokens?.()?.[0] ?? null;

registerStep('moveTo', async (step, ctx) => {
  const x = Number(ctx.vars?.pointX);
  const y = Number(ctx.vars?.pointY);
  ctx.vars.moved = 0;
  if (ctx.vars?.pointX === undefined || ctx.vars?.pointX === '' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  const point = { x, y };
  const own = tokenOf(ctx.actor);
  if (step.maxRange !== undefined && own?.center) {
    const max = resolveValue(step.maxRange, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 0);
    const { distanceFeet } = await import("../../../mechanics/combat/forced-movement.mjs");
    if (distanceFeet(own.center, point) > max) {
      globalThis.ui?.notifications?.warn?.(localize('E20.RulesExtUses.OutOfRange', { feet: max }));
      return;
    }
  }

  const forced = step.forced !== false;
  for (const actor of recipients(step, ctx)) {
    const token = tokenOf(actor);
    if (!token) {
      continue;
    }

    let moved;
    if (forced) {
      const { placeActorAt } = await import("../../../mechanics/combat/forced-movement.mjs");
      moved = await placeActorAt(actor, point);
    } else {
      let position = { x: point.x - token.w / 2, y: point.y - token.h / 2 };
      // snap: true - onto the grid the way a dropped token lands (round 15, items2 - Timeslide); a gridless scene keeps it.
      if (step.snap) {
        try {
          position = token.document?.getSnappedPosition?.(position) ?? position;
        } catch (error) {
          // Gridless scene.
        }
      }

      const update = { x: Math.round(position.x), y: Math.round(position.y) };
      await write(token.document, 'update', step.animate === false ? [update, { animate: false }] : [update]);
      moved = true;
    }

    if (moved) {
      ctx.vars.moved++;
      ctx.chat.push(localize('E20.RulesExtUses.Moved', { name: escape(actor.name) }));
    }
  }
}, {
  errors: (step, where) => (step.to !== undefined && typeof step.to != 'string' ? [`${where}: to must be text`] : []),
});
