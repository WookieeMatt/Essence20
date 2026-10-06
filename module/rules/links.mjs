import { companionsOf, ownerOf, worldActors } from "../helpers/companion-link.mjs";
import { LINK_HOLDERS, addLinkedScope, rulesOfType } from "./index.mjs";
import { feetBetween, setCrewLookup, sideActorsWithin } from "./predicate.mjs";
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

/**
 * Other ways a rule can reach an actor, added by plug-ins: fn(actor, type) => [{rule, item, index, holder}]
 * (rules/ext/c/marks.mjs - rules a mark carries onto the marked creature).
 */
export const LINK_SOURCES = [];

export const LINK_SCOPES = ['crew','pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'];

/* Plug-in scopes (module/rules/ext/*.mjs): `holdersOf(actor)` lists the actors whose `name`-scoped rules reach it. */
const EXTRA_LINKS = new Map();
export function registerLinkScope(name, holdersOf) {
  EXTRA_LINKS.set(name, holdersOf);
  if (!LINK_SCOPES.includes(name)) {
    LINK_SCOPES.push(name);
  }

  addLinkedScope(name);
}

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
  const radius = resolveValue(rule.radius ?? 0, { actor: holder, item }, 0);
  // Allies the way the rest of the system counts them (Frenemy, Betrayal, Ally Awareness) - the same
  // lookup ally:within uses - when the system has handed it in.
  if (affects == 'allies' && hasAllyLookup()) {
    return sideActorsWithin(actor, radius, 'ally').includes(holder);
  }

  const same = (own.document?.disposition ?? 0) == (theirs.document?.disposition ?? 0);
  if ((affects == 'allies' && !same) || (affects == 'enemies' && (same || (theirs.document?.disposition ?? 0) == 0))) {
    return false;
  }

  const distance = feetBetween(holder, actor);
  return distance !== null && distance <= radius;
}

let allyLookup = false;
/** Whether ally auras should count allies through the system's own lookup (set from essence20.mjs). */
export function useAllyLookup(on = true) {
  allyLookup = on;
}

function hasAllyLookup() {
  return allyLookup;
}

/** The book item a rule's item is (its source), so one Perk held by two allies is one aura. */
function sourceKey(item, index) {
  const source = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? item?.name ?? item?.id;
  return `${source}#${index}`;
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
  // Plug-in link sources (module/rules/ext/*.mjs) - asked even when no actor holds a linked rule.
  const extra = actor ? LINK_SOURCES.flatMap(source => source(actor, type) ?? []) : [];
  if (!actor || !LINK_HOLDERS.size) {
    return extra;
  }

  const out = [...extra];
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

  // stacks: false - one book item's plug-in-scoped rule counts once, however many of the holders carry it.
  const pluggedOnce = new Set();
  for (const [scope, holdersOf] of EXTRA_LINKS) {
    for (const holder of holdersOf(actor) ?? []) {
      for (const entry of holder && holder !== actor ? rulesOfType(holder, type, scope) : []) {
        const key = entry.rule.stacks === false ? sourceKey(entry.item, entry.index) : null;
        if (key && pluggedOnce.has(key)) {
          continue;
        }

        if (key) {
          pluggedOnce.add(key);
        }

        out.push({ ...entry, holder });
      }
    }
  }

  // team: a holder's rule reaches every other Player Character in the world; stacks: false counts one
  // book item's rule once, however many teammates hold it.
  if (actor.type == 'playerCharacter') {
    const teamOnce = new Set();
    for (const id of LINK_HOLDERS.keys?.() ?? LINK_HOLDERS) {
      const holder = globalThis.game?.actors?.get?.(id);
      if (holder?.type != 'playerCharacter' || holder === actor) {
        continue;
      }

      for (const entry of rulesOfType(holder, type, 'team')) {
        const key = entry.rule.stacks === false ? sourceKey(entry.item, entry.index) : null;
        if (key && teamOnce.has(key)) {
          continue;
        }

        if (key) {
          teamOnce.add(key);
        }

        out.push({ ...entry, holder });
      }
    }
  }

  // stacks: false - the same book item's aura counts once, however many allies in reach hold it.
  const once = new Set();
  for (const holder of auraHolders()) {
    if (holder === actor) {
      continue;
    }

    for (const entry of rulesOfType(holder, type, 'aura')) {
      if (!auraReaches(entry.rule, holder, actor, entry.item)) {
        continue;
      }

      if (entry.rule.stacks === false) {
        const key = sourceKey(entry.item, entry.index);
        if (once.has(key)) {
          continue;
        }

        once.add(key);
      }

      out.push({ ...entry, holder });
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
