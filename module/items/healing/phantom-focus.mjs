import { hasChosen } from "../../rules/choice-read.mjs";

const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";

/**
 * Whether the actor picked the given Phantom Focus option (Across the Stars, Phantom Ranger,
 * 10th/15th level, p.62). Read by dice.mjs for Phase Defense; Boosted Vigor and Healing Light are rules on the Perk. Unlike
 * findPerk()'s single-match lookup, this checks EVERY Phantom Focus instance the actor holds -
 * selectionLimit: 2 lets a Phantom Ranger pick two different options, each its own separate Perk
 * item sharing the same compendium sourceId but a different system.choice.
 * @param {Actor} actor
 * @param {String} option   One of E20.phantomFocusOptions' own keys.
 * @returns {Boolean}
 */
export function hasPhantomFocusOption(actor, option) {
  return !!actor?.items?.some(item => {
    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
    return sourceId == PHANTOM_FOCUS_ID && hasChosen(item, option);
  });
}

