import { registerUse } from "../../mechanics/item-hooks.mjs";
import { JTT } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import { isFrom } from "../shared/item-lookups.mjs";
import { updateRelayed as safeUpdate } from "../shared/relayed-writes.mjs";

/**
 * Timeslide (A Jump Through Time, Quantum Ranger, 15th level, p.46): "as a Move action, you may
 * instantly be placed anywhere within 200 feet of your current location that you could feasibly
 * reach with your existing Movement types." Click the spot; "feasibly reach" is the player's call.
 */
export const TIMESLIDE_ID = JTT('e70Jm3uH5A3mKmSM');
export const TIMESLIDE_FEET = 200;

registerUse({
  id: 'o1Timeslide',
  matches: isFrom(TIMESLIDE_ID),
  canUse: item => !!item.parent?.getActiveTokens?.()?.length,
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const token = actor.getActiveTokens()[0];
    const { pickCanvasPoint, distanceFeet } = await import("../../mechanics/combat/forced-movement.mjs");
    const point = await pickCanvasPoint(T('O1TimeslidePick', { feet: TIMESLIDE_FEET }));
    if (!point) {
      return null;
    }

    if (distanceFeet(token.center, point) > TIMESLIDE_FEET) {
      ui.notifications.warn(T('O1TimeslideTooFar', { feet: TIMESLIDE_FEET }));
      return null;
    }

    if (!(await pay('move'))) {
      return null;
    }

    let position = { x: point.x - token.w / 2, y: point.y - token.h / 2 };
    try {
      position = token.document.getSnappedPosition(position);
    } catch (error) {
      // Gridless scene.
    }

    await safeUpdate(token.document, { x: Math.round(position.x), y: Math.round(position.y) });
    return T('O1Timeslide', { name: actor.name });
  },
});
