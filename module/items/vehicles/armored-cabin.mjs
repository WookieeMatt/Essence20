import { registerPreRoll } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { T } from "../shared/item-lang.mjs";

/**
 * Armored Cabin (GI Joe CRB p.172): "Attacks can't target the vehicle's Crew." An attack with a crew member
 * of such a vehicle targeted is refused before it rolls. (Drive-By, p.172, is extensions/data1/weapon-rules.mjs's:
 * it asks before a Ram or Flyby attack with less than 15ft moved.)
 */

/** The vehicle this actor rides in, if any. */
export function vehicleOf(actor) {
  if (!actor?.uuid) {
    return null;
  }

  return worldActors().find(v => ['vehicle', 'zord'].includes(v.type)
    && Object.values(v.system?.actors ?? {}).some(crew => crew?.uuid == actor.uuid)) ?? null;
}

/** Feet this token has moved on the current turn (Foundry's movement history). */
export function feetMovedThisTurn(actor) {
  const token = actor?.getActiveTokens?.()?.[0]?.document;
  const history = token?.movementHistory;
  if (!Array.isArray(history) || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  let feet = 0;
  for (let i = 1; i < history.length; i++) {
    feet += canvas.grid.measurePath([history[i - 1], history[i]]).distance;
  }

  return feet;
}

registerPreRoll((actor, dataset, item) => {
  if (item?.type != 'weaponEffect' || dataset.cancelRoll) {
    return;
  }

  // Armored Cabin (GI Joe CRB p.172): "Attacks can't target the vehicle's Crew."
  for (const target of [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean)) {
    const vehicle = vehicleOf(target);
    if (vehicle?.system?.traits?.armoredCabin && vehicle.id != actor.id) {
      ui.notifications?.warn?.(T('O2ArmoredCabin', { name: target.name, vehicle: vehicle.name }));
      dataset.cancelRoll = true;
      return;
    }
  }
});
