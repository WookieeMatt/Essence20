const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";
const BOOSTED_VIGOR_HEALTH_BONUS = 3;

/**
 * Whether the actor picked the given Phantom Focus option (Across the Stars, Phantom Ranger,
 * 10th/15th level, p.62 - see helpers/banked-buffs.mjs's own PHANTOM_FOCUS_ID comment). Unlike
 * findPerk()'s single-match lookup, this checks EVERY Phantom Focus instance the actor holds -
 * selectionLimit: 2 lets a Phantom Ranger pick two different options, each its own separate Perk
 * item sharing the same compendium sourceId but a different system.choice.
 * @param {Actor} actor
 * @param {String} option   One of E20.phantomFocusOptions' own keys.
 * @returns {Boolean}
 */
export function hasPhantomFocusOption(actor, option) {
  return !!actor?.items?.some(item => {
    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    return sourceId == PHANTOM_FOCUS_ID && item.system.choice == option;
  });
}

/**
 * Boosted Vigor: "While Morphed, you gain 3 Temporary Health. When you exit your Morphed form,
 * these additional Health disappear." Applied as a flat system.health.bonus add/remove (the same
 * schema field, and the same "a plain actor.update(), not a change to _prepareHealth itself"
 * approach, Got To Get Tough's own Temporary Health grant already uses) - called from
 * sheet-handlers/power-ranger-handler.mjs#onMorph right before it flips isMorphed, so isAboutToMorph
 * reflects the state being entered, not the one being left.
 * @param {Actor} actor
 * @param {Boolean} isAboutToMorph   True if this call is about to Morph the actor, false if it's
 *   about to un-Morph them.
 */
export async function applyBoostedVigor(actor, isAboutToMorph) {
  if (!hasPhantomFocusOption(actor, 'boostedVigor')) {
    return;
  }

  const delta = isAboutToMorph ? BOOSTED_VIGOR_HEALTH_BONUS : -BOOSTED_VIGOR_HEALTH_BONUS;
  await actor.update({ 'system.health.bonus': actor.system.health.bonus + delta });
}
