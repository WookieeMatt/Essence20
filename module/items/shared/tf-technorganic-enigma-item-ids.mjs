/**
 * Compendium ids for the tf2 slice (Transformers: Technorganic Secrets, The Enigma of Combination
 * and the TF Core Rulebook), plus its parent-weapon reader. The lookups, chat and distance helpers
 * it used to carry live in item-lookups.mjs, chat-lines.mjs and sides.mjs.
 */
import { itemsOf } from "./item-lookups.mjs";

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const TF2 = {
  // Technorganic Secrets
  mutantBeast: C('technorganic_secrets', 'gkcyg7KWih6QAZlq'),
  mutantBeastPerk: C('technorganic_secrets', 'R85uJNpYbXd9C9Eh'),
  // The Enigma of Combination
  notLikeThat: C('enigma_of_combination', 'OrK3XyNIyJcorMxp'),
  // Transformers Core Rulebook
  // Special-attack weapons the Technorganic Secrets Alt Modes print.
};

/** A weaponEffect's parent weapon, if it has one. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(other => other.id == parentId) ?? null : null;
}
