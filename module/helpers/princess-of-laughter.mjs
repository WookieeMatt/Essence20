/**
 * MLP CRB "Princess of Laughter" (Spirit of Laughter Role, 20th level, p.86-87): "...You gain the
 * Origin Perks of Earth Ponies (Adaptable and Grounded), Pegasi (Air Born and Lighter Than Air),
 * and Unicorns (Magical and Telekinesis). If you already have Magical, you gain an ongoing
 * upshift 1 to Spellcasting. You don't learn a spell from this upshift, but it applies to your
 * Spellcasting total." An UPSHIFT, not a flat "+1" - Spellcasting is a Skill like any other, and
 * shifts the same way Skills do (system.skills.spellcasting.shiftUp), unlike the flat Health/
 * Defense "+1"s this same capstone-tier text uses elsewhere in the book for non-Skill stats.
 *
 * "Already have Magical" has to be checked BEFORE this very level-up also hands out a fresh copy
 * of Magical alongside Princess of Laughter itself (see packs/mlpcrbitems/_source/
 * Spirit_of_Laughter_*.json's own items map - both are granted at level 20) - captured by
 * sheet-handlers/role-handler.mjs#setRoleValues around its own createItemCopies() call, using
 * this file's actorHadMagicalBeforeGrant/roleGrantsPrincessOfLaughter/actorHasPrincessOfLaughter
 * to bracket that call without needing to replicate its own level-window matching logic.
 * Reversed symmetrically from sheet-handlers/perk-handler.mjs#onPerkDelete, the same hook every
 * other Perk-specific teardown (Sorcery, Zord) already uses.
 */
const PRINCESS_OF_LAUGHTER_PERK_ID = "Compendium.essence20.mlp_crb.Item.2LGYTCBeotSC1iln";
const MAGICAL_PERK_ID = "Compendium.essence20.mlp_crb.Item.WhTlZdUORCDpZwO2";
const UPSHIFT_GRANTED_FLAG = "princessOfLaughterSpellcastingUpshift";

// Dual-check idiom (flags.core.sourceId for a copy granted through a Role's own items map,
// _stats.compendiumSource for a manually-dropped or choice-picked one) - see perk-handler.mjs's
// own SORCERY_PERK_ID/ZORD_PERK_ID checks, the established way to ask "does this actor have
// compendium Perk X" regardless of which path granted it.
function actorHasCompendiumPerk(actor, perkId) {
  return actor.items.some(item =>
    item.type == "perk"
    && (item.flags.core?.sourceId == perkId || item._stats?.compendiumSource == perkId));
}

export function isPrincessOfLaughterPerk(perk) {
  return perk.flags.core?.sourceId == PRINCESS_OF_LAUGHTER_PERK_ID
    || perk._stats?.compendiumSource == PRINCESS_OF_LAUGHTER_PERK_ID;
}

// Whether this Role's own items map could grant Princess of Laughter at all - lets
// setRoleValues skip the (rare, MLP-only) before/after Magical check on every other Role's
// level-up for free, without needing to hardcode "Spirit of Laughter" by name.
export function roleGrantsPrincessOfLaughter(role) {
  return Object.values(role.system?.items ?? {}).some(item => item.uuid == PRINCESS_OF_LAUGHTER_PERK_ID);
}

export function actorHadMagicalBeforeGrant(actor) {
  return actorHasCompendiumPerk(actor, MAGICAL_PERK_ID);
}

export function actorHasPrincessOfLaughter(actor) {
  return actorHasCompendiumPerk(actor, PRINCESS_OF_LAUGHTER_PERK_ID);
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
 * actor's own Princess of Laughter Perk item is removed (Role deletion, or a level-down past 20
 * that goes through attachment-handler.mjs#deleteAttachmentsForItem's own onPerkDelete call).
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
