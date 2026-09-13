/**
 * MLP CRB "Princess of X" capstones (20th level, one per Role - all 6: Generosity p.77, Honesty
 * p.81, Kindness p.85, Laughter p.86-87, Loyalty p.91, Magic p.97 - share this exact text):
 * "...You become an Alicorn... You gain the Origin Perks of Earth Ponies (Adaptable and
 * Grounded), Pegasi (Air Born and Lighter Than Air), and Unicorns (Magical and Telekinesis). If
 * you already have Magical, you gain an ongoing upshift 1 to Spellcasting. You don't learn a
 * spell from this upshift, but it applies to your Spellcasting total." An UPSHIFT, not a flat
 * "+1" - Spellcasting is a Skill like any other, and shifts the same way Skills do
 * (system.skills.spellcasting.shiftUp), unlike the flat Health/Defense "+1"s this same
 * capstone-tier text uses elsewhere in the book for non-Skill stats.
 *
 * "Already have Magical" has to be checked BEFORE this very level-up also hands out a fresh copy
 * of Magical alongside the Princess Perk itself (see each Spirit-of-X Role item's own
 * system.items map - both are granted at level 20) - captured by
 * sheet-handlers/role-handler.mjs#setRoleValues around its own createItemCopies() call, using
 * this file's actorHadMagicalBeforeGrant/roleGrantsPrincessPerk/actorHasPrincessPerk to bracket
 * that call without needing to replicate its own level-window matching logic. Reversed
 * symmetrically from sheet-handlers/perk-handler.mjs#onPerkDelete, the same hook every other
 * Perk-specific teardown (Sorcery, Zord) already uses.
 *
 * Originally built for Princess of Laughter alone (hence the file's history), generalized to a
 * table keyed by Perk ID once all 6 Princesses turned out to share the identical grant text -
 * Loyalty/Magic/Generosity/Honesty/Kindness were all already half-built (the Health/Size half
 * only, missing the Origin Perk grants) before this.
 */
const PRINCESS_PERK_IDS = [
  "Compendium.essence20.mlp_crb.Item.8s7nIIf0XIpcoqYd", // Princess of Generosity
  "Compendium.essence20.mlp_crb.Item.QIJJ9472y6cG82i0", // Princess of Honesty
  "Compendium.essence20.mlp_crb.Item.nspTaeINRMztxFr5", // Princess of Kindness
  "Compendium.essence20.mlp_crb.Item.2LGYTCBeotSC1iln", // Princess of Laughter
  "Compendium.essence20.mlp_crb.Item.DUBbmWhwiUKmrifW", // Princess of Loyalty
  "Compendium.essence20.mlp_crb.Item.rz7nBLl6QTQRt3eu", // Princess of Magic
];
const MAGICAL_PERK_ID = "Compendium.essence20.mlp_crb.Item.WhTlZdUORCDpZwO2";
const UPSHIFT_GRANTED_FLAG = "princessSpellcastingUpshift";

// Dual-check idiom (flags.core.sourceId for a copy granted through a Role's own items map,
// _stats.compendiumSource for a manually-dropped or choice-picked one) - see perk-handler.mjs's
// own SORCERY_PERK_ID/ZORD_PERK_ID checks, the established way to ask "does this actor have
// compendium Perk X" regardless of which path granted it.
function actorHasCompendiumPerk(actor, perkId) {
  return actor.items.some(item =>
    item.type == "perk"
    && (item.flags.core?.sourceId == perkId || item._stats?.compendiumSource == perkId));
}

export function isPrincessPerk(perk) {
  const perkId = perk.flags.core?.sourceId ?? perk._stats?.compendiumSource;
  return PRINCESS_PERK_IDS.includes(perkId);
}

// Whether this Role's own items map could grant a Princess Perk at all - lets setRoleValues skip
// the (rare, MLP-only) before/after Magical check on every other Role's level-up for free,
// without needing to hardcode any specific Princess Perk by name.
export function roleGrantsPrincessPerk(role) {
  return Object.values(role.system?.items ?? {}).some(item => PRINCESS_PERK_IDS.includes(item.uuid));
}

export function actorHadMagicalBeforeGrant(actor) {
  return actorHasCompendiumPerk(actor, MAGICAL_PERK_ID);
}

export function actorHasPrincessPerk(actor) {
  return actor.items.some(item => item.type == "perk" && isPrincessPerk(item));
}

/**
 * Grants the ongoing upshift 1 to Spellcasting, idempotently (a flag guards against re-granting
 * it if this check is ever re-triggered for an actor who already has it).
 * @param {Actor} actor
 */
export async function applySpellcastingUpshift(actor) {
  if (actor.getFlag("essence20", UPSHIFT_GRANTED_FLAG)) {
    return;
  }

  await actor.update({
    "system.skills.spellcasting.shiftUp": actor.system.skills.spellcasting.shiftUp + 1,
  });
  await actor.setFlag("essence20", UPSHIFT_GRANTED_FLAG, true);
}

/**
 * Reverses applySpellcastingUpshift() - called from perk-handler.mjs#onPerkDelete whenever the
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
