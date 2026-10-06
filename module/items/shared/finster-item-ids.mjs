/**
 * Compendium ids for the data21 slice of the Item Review (data errors and missing items across the
 * lines). Its lookups, chat line and owner-or-GM write live in item-lookups.mjs, chat-lines.mjs and
 * relayed-writes.mjs.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const fmmc = id => uuid('finster_s_monster_matic_cookbook', id);

export const D21 = {
  // Finster's Monster-Matic Cookbook
  mystic: fmmc('SBlOGEnend5WYwgd'),
  sorcery: fmmc('xUBOE1s5pgVyUrwj'),
};
