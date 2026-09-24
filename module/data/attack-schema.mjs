import { E20 } from "../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "./generic-makers.mjs";

/**
 * The fields that turn an item into an ATTACK - one that's rolled against a target's Defense and
 * deals damage on a hit - shared between SpellItemData (module/data/item/spell.mjs) and
 * PowerItemData (module/data/item/power.mjs).
 *
 * weaponEffect deliberately does NOT use this: its own damageValue/damageType/defenseType are
 * required with real defaults (every weapon effect is an attack), whereas a spell or Power is
 * overwhelmingly NOT one - so these default to null/0 and dice.mjs only builds its per-target
 * Defense comparison when a Defense is actually set.
 *
 * The Powers that need this are the Sorcerous attack Powers printed in Finster's Monster-Magic
 * Cookbook - Arcane Blast, Fireball, Volcanic Eruption and Icy Breath are each written as
 * "Targeting (Sorcery) attack; Range 30ft/60ft (N <type> damage Blast [Nft radius])", which is
 * structurally the same thing a weaponEffect is, just printed in a Power's entry. Before these
 * fields existed there was nowhere to record any of that, so those Powers could only ever post a
 * description to chat.
 * @returns {Object}   A plain object of schema fields, spread into the caller's own defineSchema().
 */
export const attackSchema = () => ({
  damageType: makeStrWithChoices(Object.keys(E20.damageTypes), null),
  damageValue: makeInt(0),
  // Null for the non-attack majority. Setting this is what marks an item as an attack at all -
  // see dice.mjs, which pre-selects the Roll Options Dialog's Defense from it, and
  // helpers/power-attack.mjs, which uses it to decide whether a Power is rolled or just narrated.
  defenseType: makeStrWithChoices(Object.keys(E20.defenses), null),
});
