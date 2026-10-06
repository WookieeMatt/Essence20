import {
  registerDamageModifier, registerSceneAdvanced, registerTurnStart, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { actorsInPlay, JTT, payPower, post } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import { combatStamp } from "../shared/turn-stamps.mjs";
import { isFrom } from "../shared/item-lookups.mjs";
import {
  setFlagRelayed as safeSetFlag, unsetFlagRelayed as safeUnsetFlag, updateRelayed as safeUpdate,
} from "../shared/relayed-writes.mjs";

/**
 * Interspatial Pause (A Jump Through Time, Quantum Power, p.45): "By spending three Personal Power,
 * you and all allies within 5 feet move outside the timestream to a temporary pocket dimension for
 * up to 1 round. While in this pocket dimension, you can act normally... you re-emerge exactly
 * where you were." Their tokens are hidden (nothing can target them) and they take no damage until
 * the Ranger's next turn starts, or the Ranger ends it early with the same button.
 *
 * (Time Strike, Evacuation Vents, Lance of Light, Across the Stars' Good with Both, Quantum Trigger and Savant
 * Skill's Story Point refund are item rules on their pack items. Lance of Light's strike is a Use rule on the
 * pack item - items/defenses/lance-of-light.mjs holds the toggle; Good with Both (Across the Stars p.69) is its own
 * DialogSwitch rule.)
 */
export const INTERSPATIAL_PAUSE_ID = JTT('InterspatialPaus');
const PAUSE_FLAG = 'o1InterspatialPause';

export function isPaused(actor) {
  return !!actor?.flags?.essence20?.[PAUSE_FLAG];
}

registerDamageModifier((actor, amount) => (isPaused(actor) ? 0 : amount));

async function setPaused(actor, by, paused) {
  for (const token of actor.getActiveTokens?.() ?? []) {
    await safeUpdate(token.document, { hidden: paused });
  }

  if (paused) {
    await safeSetFlag(actor, PAUSE_FLAG, { by, ...combatStamp() });
  } else {
    await safeUnsetFlag(actor, PAUSE_FLAG);
  }
}

async function releasePause(byUuid) {
  const released = [];
  for (const actor of await actorsInPlay()) {
    if (actor.flags?.essence20?.[PAUSE_FLAG]?.by == byUuid) {
      await setPaused(actor, byUuid, false);
      released.push(actor.name);
    }
  }

  return released;
}

registerUse({
  id: 'o1InterspatialPause',
  matches: isFrom(INTERSPATIAL_PAUSE_ID),
  canUse: item => isPaused(item.parent) || (item.parent?.system?.powers?.personal?.value ?? 0) >= 3,
  run: async (item) => {
    const actor = item.parent;
    if (isPaused(actor)) {
      const released = await releasePause(actor.uuid);
      return T('O1PauseEnds', { names: released.join(', ') || actor.name });
    }

    if (!(await payPower(actor, 3))) {
      return null;
    }

    const { getNearbyAllyTokens } = await import("../../mechanics/combat/nearby-allies.mjs");
    const group = [actor, ...getNearbyAllyTokens(actor, 5).map(token => token.actor)];
    for (const member of group) {
      await setPaused(member, actor.uuid, true);
    }

    return T('O1PauseStarts', { name: actor.name, names: group.map(member => member.name).join(', ') });
  },
});

registerTurnStart(async (actor) => {
  const released = await releasePause(actor.uuid);
  if (released.length) {
    await post(actor, T('O1PauseEnds', { names: released.join(', ') }));
  }
});

registerSceneAdvanced(async () => {
  if (!game.user?.isGM) {
    return;
  }

  for (const actor of await actorsInPlay()) {
    const pause = actor.flags?.essence20?.[PAUSE_FLAG];
    if (pause) {
      await setPaused(actor, pause.by, false);
    }
  }
});
