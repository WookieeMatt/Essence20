import { companionsOf, ownerOf, worldActors } from "../helpers/companion-link.mjs";
import { LINK_HOLDERS, rulesOfType } from "./index.mjs";
import { feetBetween, setCrewLookup } from "./predicate.mjs";
import { resolveValue } from "./formula.mjs";

/**
 * Rules that reach an actor from another actor it is linked to (docs/RULES_ENGINE_PLAN.md §5.3).
 * A rule's `scope` says which way it points:
 *
 *   crew       on a vehicle's or Zord's item - every actor crewing it (Pressurized Cabin)
 *   pilot      on a vehicle's or Zord's item - only whoever is driving it (Cowcatcher)
 *   vehicle    on a crew member's item - the vehicle or Zord they are crewing (a pilot's Perk)
 *   companion  on an owner's item - each of their companions (Favorite Command)
 *   owner      on a companion's item - the actor it belongs to
 *   party      on a party member's item - everyone else on a Party roster with them
 *   aura       on any actor's item - every token within `radius` feet of the holder's token, of the
 *              side `affects` names: "allies" (the default), "enemies" or "all". Never the holder.
 *
 * Vehicles and Zords record their crew in system.actors ({uuid, vehicleRole}), the same collection
 * helpers/vehicle-upgrades.mjs#getCrewedVehicle reads. Companions carry their owner in
 * flags.essence20.companionOf (helpers/companion-link.mjs).
 *
 * In a linked rule, `self:` tags still mean the actor the rule is changing - the one rolling or
 * being prepared - while formulas (@level, @pool...) read the actor and item that hold the rule.
 */

export const LINK_SCOPES = ['crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'aura'];

const CREWED = ['vehicle', 'zord'];

function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid) ?? null : null;
  } catch (error) {
    return null;
  }
}

/** A vehicle's or Zord's crew: [{actor, role}]. */
export function crewOf(vehicle) {
  if (!CREWED.includes(vehicle?.type)) {
    return [];
  }

  return Object.values(vehicle.system?.actors ?? {})
    .filter(entry => entry?.uuid)
    .map(entry => ({ actor: resolve(entry.uuid), role: entry.vehicleRole ?? 'passenger' }))
    .filter(entry => entry.actor);
}

/** The vehicle or Zord this actor is crewing, and in what role - or null. */
export function crewedBy(actor, actors = worldActors()) {
  if (!actor?.uuid) {
    return null;
  }

  for (const vehicle of actors) {
    if (!CREWED.includes(vehicle?.type)) {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

/** Everyone on a Party roster with this actor, not counting the actor. */
export function partyMates(actor, actors = worldActors()) {
  if (!actor?.uuid) {
    return [];
  }

  const mates = new Map();
  for (const party of actors) {
    const roster = party?.type == 'party' ? Object.values(party.system?.actors ?? {}) : [];
    if (!roster.some(entry => entry?.uuid == actor.uuid)) {
      continue;
    }

    for (const entry of roster) {
      const member = entry?.uuid != actor.uuid ? resolve(entry?.uuid) : null;
      if (member) {
        mates.set(member.uuid, member);
      }
    }
  }

  return [...mates.values()];
}

/** Whether an aura rule on `holder` reaches `actor`: in range, and on the side it affects. */
export function auraReaches(rule, holder, actor, item = null) {
  const own = holder?.getActiveTokens?.()?.[0];
  const theirs = actor?.getActiveTokens?.()?.[0];
  if (!own || !theirs || holder === actor) {
    return false;
  }

  const affects = rule.affects ?? 'allies';
  const same = (own.document?.disposition ?? 0) == (theirs.document?.disposition ?? 0);
  if ((affects == 'allies' && !same) || (affects == 'enemies' && (same || (theirs.document?.disposition ?? 0) == 0))) {
    return false;
  }

  const distance = feetBetween(holder, actor);
  return distance !== null && distance <= resolveValue(rule.radius ?? 0, { actor: holder, item }, 0);
}

/** The actors on the canvas holding an aura rule (cheap: LINK_HOLDERS says who might). */
function auraHolders() {
  const tokens = globalThis.canvas?.tokens?.placeables;
  if (!Array.isArray(tokens)) {
    return [];
  }

  const holders = new Set();
  for (const token of tokens) {
    if (token.actor && LINK_HOLDERS.has(token.actor.id)) {
      holders.add(token.actor);
    }
  }

  return [...holders];
}

// The vehicle:crew and vehicle:driving tags (rules/predicate.mjs) ask this file.
setCrewLookup(actor => crewedBy(actor));

/**
 * Every rule of a type that reaches this actor from a linked actor, each with `holder` (the actor the
 * rule's item is on).
 * @param {Actor} actor
 * @param {String} type
 * @returns {Array<{rule, item, index, holder}>}
 */
export function linkedEntries(actor, type) {
  if (!actor || !LINK_HOLDERS.size) {
    return [];
  }

  const out = [];
  const add = (holder, scope) => {
    if (holder && holder !== actor) {
      for (const entry of rulesOfType(holder, type, scope)) {
        out.push({ ...entry, holder });
      }
    }
  };

  const crewed = crewedBy(actor);
  if (crewed) {
    add(crewed.vehicle, 'crew');
    if (crewed.role == 'driver') {
      add(crewed.vehicle, 'pilot');
    }
  }

  add(ownerOf(actor), 'companion');
  for (const companion of companionsOf(actor)) {
    add(companion, 'owner');
  }

  for (const { actor: member, role } of crewOf(actor)) {
    add(member, 'vehicle');
    if (role == 'driver') {
      add(member, 'driven');
    }
  }

  for (const mate of partyMates(actor)) {
    add(mate, 'party');
  }

  for (const holder of auraHolders()) {
    if (holder === actor) {
      continue;
    }

    for (const entry of rulesOfType(holder, type, 'aura')) {
      if (auraReaches(entry.rule, holder, actor, entry.item)) {
        out.push({ ...entry, holder });
      }
    }
  }

  return out;
}

/**
 * Auras that change a sheet number (a Defense, Health) are worked out when an actor is prepared, so a
 * token moving re-prepares the tokens on its scene - but only while someone there holds a linked rule.
 */
function onTokenMoved(tokenDoc, changes) {
  if (!('x' in changes || 'y' in changes || 'disposition' in changes) || !LINK_HOLDERS.size) {
    return;
  }

  const actors = new Set((tokenDoc.parent?.tokens?.contents ?? []).map(token => token.actor).filter(Boolean));
  if (![...actors].some(actor => LINK_HOLDERS.has(actor.id))) {
    return;
  }

  for (const actor of actors) {
    actor.reset?.();
    if (actor.sheet?.rendered) {
      actor.sheet.render();
    }
  }
}

globalThis.Hooks?.on?.('updateToken', onTokenMoved);
