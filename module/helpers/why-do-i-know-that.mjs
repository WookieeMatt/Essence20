import { findCompendiumItems, pickCompendiumItem } from "./item-picker.mjs";
import { grantPerkOutright } from "../sheet-handlers/perk-handler.mjs";

/**
 * Why Do I Know That? (Across the Stars, Origin Perk): "Wherever you came from, it left a lasting
 * impact on what you know. You may choose any General Perk, provided you meet its prerequisites."
 *
 * FOUND 2026-09-15 by re-verifying a bundle the ledger had filed as narrative flavor. That bundle
 * carried an explicit caution - this book's original cached extraction silently omitted whole Perks,
 * so absence of mechanics from the cached text was not evidence of absence - and re-pulling the PDF
 * with text coordinates bore it out: of the ten items still unverified, not one was flavor.
 *
 * "Any General Perk" is exactly the choose-from-a-CATEGORY shape that had no mechanism until
 * helpers/item-picker.mjs landed earlier the same day, and the granting half
 * (perk-handler.mjs#grantPerkOutright) has existed for some time behind Change Its Stripes and
 * Combat Lifesaver. So this needed neither piece built - only the two connected.
 *
 * "Provided you meet its prerequisites" is NOT enforced. Prerequisites are free text on the Perk
 * (system.prerequisite: "Persuasion at +d6 or higher", "One or more Contacts with Threat stat
 * blocks", "12th Level or higher"), with no parser anywhere and no shared shape to parse - the
 * same honour-system drop this project applies to every other unverifiable qualifier. The picker
 * deliberately still offers everything rather than guessing at a filter, since a wrong filter would
 * hide legal choices rather than merely allow illegal ones.
 */
export const WHY_DO_I_KNOW_THAT_ID = "Compendium.essence20.across_the_stars.Item.ugJU6pzzWNesCn4f";

/**
 * Every General Perk in an enabled sourcebook, minus the ones the actor already holds - offering a
 * Perk they cannot gain would just fail silently inside grantPerkOutright.
 * @param {Actor} actor
 * @returns {Promise<Array<Object>>}
 */
export async function findGrantableGeneralPerks(actor) {
  const held = new Set((actor?.items ?? [])
    .filter(item => item.type == 'perk')
    .map(item => item.flags?.core?.sourceId ?? item._stats?.compendiumSource)
    .filter(Boolean));

  const rows = await findCompendiumItems({
    type: 'perk',
    fields: ['system.type'],
    matches: entry => entry.system?.type == 'general',
  });

  return rows.filter(row => !held.has(row.uuid));
}

/**
 * Prompts for a General Perk and grants it permanently.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The granted Perk's uuid, or null.
 */
export async function activateWhyDoIKnowThat(actor) {
  const rows = await findGrantableGeneralPerks(actor);
  if (!rows.length) {
    ui.notifications.warn(game.i18n.localize('E20.WhyDoIKnowThatNothingAvailable'));
    return null;
  }

  const uuid = await pickCompendiumItem(rows, {
    title: 'E20.WhyDoIKnowThatPickTitle',
    label: 'E20.WhyDoIKnowThatPickLabel',
  });
  if (!uuid) {
    return null;
  }

  await grantPerkOutright(actor, uuid);
  return uuid;
}
