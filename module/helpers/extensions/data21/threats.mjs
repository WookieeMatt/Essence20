import { D21, itemsOf, sourceOf } from "./common.mjs";

/**
 * Finster's Monster-Matic Cookbook's new rules (p.7) - Larger Than Life's Reach is its item's own rule
 * (rules/conv10-slC10.test.js):
 * - "Non-Mystical: A target is Non-Mystical if they do not possess Magical artifacts, the Mystic
 *   trait, Sorcerous Powers, Supernatural Perks, or by clarification of the GM." Read by the Mystic
 *   perk (Zen-Aku's stat block: "Some of Zen-Aku's Attacks and Powers are Mystical in nature ... ignore any
 *   armor bonuses to Toughness and gain ↑1 dice shift versus Non-Mystical targets") - every attack
 *   of a Mystic holder counts, since the system can't tell which printed attacks were "noted".
 *   The GM's clarification is flags.essence20.d21Mystical (true/false) on the actor.
 * - Sorcerous Tremors (p.274): "Effect: DIF 12 Culture (Arcane) as a Standard action to recreate the
 *   effects of the Power Quake Grid Power." Power Quake (PR CRB p.100): "a tremor out in a 15' radius
 *   ... Every creature or vehicle caught in the area must pass a Athletics or Acrobatics Skill Test
 *   or be knocked Prone. The DIF for this test is equal to 12 plus 3 for each Power spent." The
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
