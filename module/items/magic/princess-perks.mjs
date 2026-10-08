/**
 * MLP CRB "Princess of X" capstones (20th level, one per Role: Generosity, Honesty, Kindness, Laughter,
 * Loyalty, Magic). The Origin Perks come from each Spirit-of-X Role's own items map, and the
 * "already have Magical" ↑1 Spellcasting is an item rule on each Princess Perk: an `added` Trigger
 * sets a toggle when Magical is already owned (the Role grants the Princess Perk before its own copy
 * of Magical), and a DerivedStat reads it into system.skills.spellcasting.shiftUp.
 *
 * What stays here is cleanup for characters who got the upshift before it was a rule - it was written
 * straight into system.skills.spellcasting.shiftUp and flagged, so removing the Princess Perk still
 * takes it back off.
 */
const PRINCESS_PERK_IDS = [
  "Compendium.essence20.mlp_crb.Item.8s7nIIf0XIpcoqYd", // Princess of Generosity
  "Compendium.essence20.mlp_crb.Item.QIJJ9472y6cG82i0", // Princess of Honesty
  "Compendium.essence20.mlp_crb.Item.nspTaeINRMztxFr5", // Princess of Kindness
  "Compendium.essence20.mlp_crb.Item.2LGYTCBeotSC1iln", // Princess of Laughter
  "Compendium.essence20.mlp_crb.Item.DUBbmWhwiUKmrifW", // Princess of Loyalty
  "Compendium.essence20.mlp_crb.Item.rz7nBLl6QTQRt3eu", // Princess of Magic
];
const UPSHIFT_GRANTED_FLAG = "princessSpellcastingUpshift";

export function isPrincessPerk(perk) {
  const perkId = perk.flags.core?.sourceId ?? perk._stats?.compendiumSource ?? perk?.flags?.essence20?.rulesSource;
  return PRINCESS_PERK_IDS.includes(perkId);
}

/**
 * Takes back the upshift the old code wrote - called from perk-handler.mjs#onPerkDelete whenever the
 * actor's own Princess Perk item is removed (Role deletion, or a level-down past 20 that goes
 * through attachment-handler.mjs#deleteAttachmentsForItem's own onPerkDelete call).
 * @param {Actor} actor
 */
export async function removeSpellcastingUpshift(actor) {
  if (!actor.getFlag("essence20", UPSHIFT_GRANTED_FLAG)) {
    return;
  }

  await actor.update({
    "system.skills.spellcasting.shiftUp": Math.max(0, actor.system.skills.spellcasting.shiftUp - 1),
  });
  await actor.unsetFlag("essence20", UPSHIFT_GRANTED_FLAG);
}
