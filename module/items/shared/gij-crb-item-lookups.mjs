/**
 * Shared bits for the gij2 slice (G.I. JOE Roleplaying Game Core Rulebook items): the compendium
 * ids it keys on. The generic item, lang, chat and stamp helpers live in item-lookups.mjs,
 * item-lang.mjs, chat-lines.mjs and turn-stamps.mjs. (The Perk-use chat-card reader went with the last
 * decorator that read it - Plan of Action's Split is a button its Use rule posts now.)
 */
export const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

export const G2 = {
  personalShield: GIJ('84JYgd6kZgY41wge'),
};
