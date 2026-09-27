import { findCompendiumItems, pickCompendiumItem } from "./item-picker.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Welds, Rivets, and Ideas (Decepticon Directive, Salvaged Origin Benefit, p.38): "By succeeding in
 * a DIF 12 Technology Skill Test that takes 2d6 × 5 minutes, you can emulate any single piece of
 * equipment, weapon upgrade, or armor upgrade (of no greater than Limited Access) using such
 * materials. The emulated item functions for a single scene."
 *
 * The DIF-12 Technology roll itself is a plain flat-DIF Skill Test attempt (same
 * actor._dice.rollSkill(...) + isXAttempt-flag + results[0].success dispatch shape
 * helpers/humanitarian.mjs's own doc comment already establishes) - the "2d6 x 5 minutes" is
 * flavor text with no in-game clock to consume, same as every other narrative-time cost this
 * codebase already leaves unenforced. On success, the actual item is chosen with
 * helpers/item-picker.mjs's own generic compendium picker (built for exactly this "choose an item
 * from a CATEGORY" shape - see its own doc comment) across gear (Equipment), and Armor/Weapon
 * Upgrades, filtered to Automatic/Standard/Limited Availability, and granted embedded on the actor
 * the same way perk-handler.mjs#grantPerkOutright grants a Perk. "Functions for a single scene" is
 * flagged with the current scene epoch (helpers/scene-clock.mjs) but not actively removed - the
 * same "approximate, a GM can delete it by hand" idiom this project already accepts for other
 * un-enforceable scene-end expirations (e.g. Hardened Armor's own Resistance-until-scene-end).
 */
export const WELDS_RIVETS_AND_IDEAS_ID = "Compendium.essence20.decepticon_directive.Item.a7KiUNWgLZgtQz6S";

const EMULATED_ITEM_AVAILABILITIES = ['automatic', 'standard', 'limited'];

/**
 * Kicks off the DIF 12 Technology Skill Test - the actual item emulation happens in
 * activateWeldsRivetsAndIdeas below, called from dice.mjs on a successful result.
 * @param {Actor} actor
 */
export async function rollWeldsRivetsAndIdeas(actor) {
  await actor._dice.rollSkill({
    skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12',
    isWeldsRivetsAndIdeasAttempt: true,
  }, actor);
}

/**
 * Every emulatable item - Equipment (gear), plus Armor/Weapon Upgrades - at Limited Access or
 * below.
 * @returns {Promise<Array<Object>>}
 */
async function findEmulatableItems() {
  const gear = await findCompendiumItems({ type: 'gear', availabilities: EMULATED_ITEM_AVAILABILITIES });
  const upgrades = await findCompendiumItems({
    type: 'upgrade', availabilities: EMULATED_ITEM_AVAILABILITIES, fields: ['system.type'],
  });

  return [...gear, ...upgrades].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Prompts for which item to emulate and grants it, flagged with the current scene epoch - called
 * once the DIF 12 Skill Test above has actually succeeded.
 * @param {Actor} actor
 */
export async function activateWeldsRivetsAndIdeas(actor) {
  const rows = await findEmulatableItems();
  if (!rows.length) {
    ui.notifications.warn(game.i18n.localize('E20.WeldsRivetsAndIdeasNothingAvailable'));
    return;
  }

  const uuid = await pickCompendiumItem(rows, {
    title: 'E20.WeldsRivetsAndIdeasPickTitle',
    label: 'E20.WeldsRivetsAndIdeasPickLabel',
  });
  if (!uuid) {
    return;
  }

  const source = await fromUuid(uuid);
  if (!source) {
    return;
  }

  const data = source.toObject();
  data.flags = { ...data.flags, essence20: { ...data.flags?.essence20, weldsRivetsAndIdeasEpoch: getSceneEpoch() } };
  await Item.create(data, { parent: actor });
}
