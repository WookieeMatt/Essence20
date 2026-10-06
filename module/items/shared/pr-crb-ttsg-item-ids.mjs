/**
 * Compendium ids for the pr3 extension modules (Power Rangers CRB + Through the Shattered Grid
 * Perks, Hang-Ups, gear and Zord Features). The helpers they use live in item-lookups.mjs,
 * chat-lines.mjs, turn-stamps.mjs, relayed-writes.mjs and personal-power-and-ranger-weapons.mjs.
 */

export const PR_CRB = id => `Compendium.essence20.pr_crb.Item.${id}`;
export const TTSG = id => `Compendium.essence20.through_the_shattered_grid.Item.${id}`;

export const IDS = {
  ninjaPower: PR_CRB('wN5rjEQIJH68rWCd'),
};
