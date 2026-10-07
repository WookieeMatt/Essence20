/**
 * Shared bits for the Decepticon Directive / Technorganic Secrets slice (tf1): item ids and the Favorite Weapon reader.
 * (Alt Mode Mimicry, the Drone Origin, Solid-State Energon and They Called It a Glitch! are their items' own rules now -
 * rules/conv15-items2.test.js - and took the damage button, pick and roll helpers with them.) The generic lookups, lang,
 * chat and token helpers live in item-lookups.mjs, item-lang.mjs, chat-lines.mjs and sides.mjs.
 */
import { findSourced } from "./item-lookups.mjs";
import { chosenOf } from "../../rules/choice-read.mjs";

const dd = id => `Compendium.essence20.decepticon_directive.Item.${id}`;

// (Brutal Display, Comms Assault, Flexible Switch and Make An Example are their items' own rules; nothing read their ids.)
export const TF1 = {
  favoriteWeapon: dd('emaXxo2XzoHMoNCe'),
};

export function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function isDefeated(actor) {
  return !!actor?.statuses?.has?.('defeated') || (Number(actor?.system?.health?.value) <= 0 && actor?.system?.health?.max > 0);
}

/**
 * The Favorite Weapon Perk's chosen weapon - its Use rule keeps the weapon's id on the Perk's system.choice (a uuid's last
 * part is read the same way).
 */
export function favoriteWeaponOf(actor) {
  const perk = findSourced(actor, TF1.favoriteWeapon);
  // Read through rules/choice-read.mjs (no primary key on this Perk yet, so its system.choice, as the Use rule writes it).
  const choice = chosenOf(perk);
  return choice ? actor.items?.get?.(String(choice).split('.').pop()) ?? null : null;
}
