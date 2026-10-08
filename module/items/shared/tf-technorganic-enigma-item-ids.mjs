/**
 * Compendium ids for the tf2 slice (Transformers: Technorganic Secrets, The Enigma of Combination
 * and the TF Core Rulebook), plus its parent-weapon reader. The lookups, chat and distance helpers
 * it used to carry live in item-lookups.mjs, chat-lines.mjs and sides.mjs.
 */
import { itemsOf } from "./item-lookups.mjs";

// (The TF2 id table went: nothing imported it - Mutant Beast, Not Like That, Like This! and the rest are their items' own
// rules.)

/** A weaponEffect's parent weapon, if it has one. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(other => other.id == parentId) ?? null : null;
}
