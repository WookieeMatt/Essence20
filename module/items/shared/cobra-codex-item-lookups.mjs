/**
 * Compendium ids and the worn-upgrade lookup shared by the gij1 extension modules (Cobra Codex
 * gear, Perks and Hang-Ups, plus the GI Joe CRB's Asleep/Defeated Conditions). The generic item,
 * lang and chat helpers live in item-lookups.mjs, item-lang.mjs and chat-lines.mjs.
 */
import { itemsOf, sourceOf } from "./item-lookups.mjs";

export const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

export const G1 = {
  // Battledress upgrades (Cobra Codex, Table 3-5, p.100-101).
  anonymous: CC('yFikSROr3NzaEoaL'),
  // General Perks (p.79-81).
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  // Elsewhere.
  inundation: GIJ('Q09tkHIaVX65lokl'),
  informedAccuracy: 'Compendium.essence20.tf_crb.Item.JtWhjDRI0HDewaKe',
};

/** An upgrade counts while it is loose on the actor or sits on something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || upgrade.parent?.items?.get?.(parentId)?.system?.equipped !== false;
}

/** The actor's worn copy of an upgrade, if any. */
export function wornUpgrade(actor, uuid) {
  return itemsOf(actor).find(item => item.type == 'upgrade' && sourceOf(item) == uuid && isWorn(item)) ?? null;
}
