/**
 * Imperial Machine Mantle (Power Rangers Adventures, Adventures in Angel Grove, p.90):
 * "[Melds] with any kind of existing energic shell (such as a Power Ranger's Morphed form)...
 * adding an additional 50% of the wearer's existing Armor Bonus (rounding up). The Mantle only
 * offers this protection until the wearer is attacked by a Critical Success, at which point the
 * Mantle falls to pieces." A one-off special case (USER RULING, 2026-09-24, confirmed there is no
 * other generic PR armor-upgrade item like it) rather than a general armorBonus mechanic - see
 * documents/actor.mjs#_prepareDefenses's own call site for how "existing Armor Bonus" (whichever
 * of system.defenses.toughness.morphed/.armor was just added for the wearer's current
 * Morphed/not-Morphed state) is read.
 */
export const IMPERIAL_MACHINE_MANTLE_ID = "Compendium.essence20.power_rangers_adventures.Item.CjYzIg9gVstsE0wg";

const BROKEN_FLAG = "imperialMachineMantleBroken";

/**
 * Finds the wearer's own intact copy of the Mantle - an `upgrade`-type Item, same
 * flags.core.sourceId/_stats.compendiumSource lookup pattern as helpers/perks.mjs#findPerk -
 * excluding any copy already flagged broken (see breakMachineMantleIfPresent() below).
 * @param {Actor} actor
 * @returns {Item|undefined}
 */
export function findIntactMachineMantle(actor) {
  return actor?.items?.find(item =>
    item.type == 'upgrade'
    && (item.flags?.core?.sourceId == IMPERIAL_MACHINE_MANTLE_ID || item._stats?.compendiumSource == IMPERIAL_MACHINE_MANTLE_ID)
    && !item.getFlag?.('essence20', BROKEN_FLAG),
  );
}

/**
 * The Mantle's own Toughness bonus, if the wearer has an intact one - ceil(50% of whatever "Armor
 * Bonus" value the wearer currently has, per _prepareDefenses's Morphed/not-Morphed branch).
 * @param {Actor} actor
 * @param {Number} currentArmorBonus   The armor/morphed value _prepareDefenses just added.
 * @returns {Number}
 */
export function getMachineMantleBonus(actor, currentArmorBonus) {
  return findIntactMachineMantle(actor) ? Math.ceil(currentArmorBonus * 0.5) : 0;
}

/**
 * Breaks the wearer's Mantle after a Critical Success hits them (chat.mjs#onApplyDamage already
 * knows isCrit) - sets a clearable flag rather than deleting the Item, so a GM can repair/replace
 * it later by unsetting the flag instead of re-granting the Item. No-ops if the wearer has no
 * intact Mantle.
 * @param {Actor} actor
 */
export async function breakMachineMantleIfPresent(actor) {
  const mantle = findIntactMachineMantle(actor);
  if (mantle) {
    await mantle.setFlag('essence20', BROKEN_FLAG, true);
  }
}
