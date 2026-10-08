import { D21 } from "../shared/finster-item-ids.mjs";
import { itemsOf, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Finster's Monster-Matic Cookbook's new rules (p.7) - Larger Than Life's Reach is its item's own rule
 * (rules/conv10-slC10.test.js):
 * - Non-Mystical: a target with no magical artifacts, Mystic trait, Sorcerous Powers or Supernatural
 *   Perks, or one the GM rules so. Read by the Mystic perk (Zen-Aku's stat block: some of his attacks
 *   and Powers are Mystical, ignoring armor Toughness and getting ↑1 against Non-Mystical targets) - every attack
 *   of a Mystic holder counts, since the system can't tell which printed attacks were "noted".
 *   The GM's clarification is flags.essence20.d21Mystical (true/false) on the actor.
 * - Sorcerous Tremors (p.274): a Standard action and DIF 12 Culture (Arcane) for Power Quake's effect.
 *   Power Quake (PR CRB p.100): a 15' radius tremor; everything in it passes Athletics or Acrobatics
 *   at DIF 12 + 3 per Power spent or goes Prone. The
 *   Sorcery's own 2-point cost replaces the Personal Power, so the caster picks the strength (1-3).
 */

/* -------------------------------------------- */
/*  Mystic / Non-Mystical                        */
/* -------------------------------------------- */

export function isMystical(actor) {
  const override = actor?.flags?.essence20?.d21Mystical;
  if (override === true || override === false) {
    return override;
  }

  return itemsOf(actor).some(item => {
    const source = sourceOf(item);
    return source == D21.mystic || source == D21.sorcery
      || (item.type == 'power' && item.system?.type == 'sorcerous')
      || (Array.isArray(item.system?.traits) && item.system.traits.includes('sorcerous'));
  });
}

export const isNonMystical = actor => !!actor && !isMystical(actor);
