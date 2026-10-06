/**
 * Shared bits for the gij2 slice (G.I. JOE Roleplaying Game Core Rulebook items): the compendium
 * ids it keys on and the Perk-use chat-card reader. The generic item, lang, chat and stamp helpers
 * live in item-lookups.mjs, item-lang.mjs, chat-lines.mjs and turn-stamps.mjs.
 */
import { findSourced } from "./item-lookups.mjs";

export const GIJ = id => `Compendium.essence20.gi_joe_crb.Item.${id}`;

export const G2 = {
  artillerySupport: GIJ('MrDZK2ifJWpiH24D'),
  castling: GIJ('eB7jbgbevLVPxW4e'),
  martialArtist: GIJ('9Elbb94OPCPVSTxL'),
  noseForTrouble: GIJ('MH630UTgsJtbf3Y5'),
  personalShield: GIJ('84JYgd6kZgY41wge'),
  impenetrableShield: GIJ('eEUl7OA9yWAk0QD3'),
  planOfAction: GIJ('7wsu99k8v620IB2N'),
  inspiration: GIJ('j05tN97KZNzl5jTF'),
  queensGambit: GIJ('Frf5wHlBS2Tn24yB'),
  recklessAbandon: GIJ('84d0XTJwKCYMJUgY'),
  aegis: GIJ('0ZTjZ36gN74889am'),
};

/**
 * The speaking actor and its item when a chat message is mechanics/characters/perks.mjs#postPerkUseChatCard's
 * "{perk} used on {actor}." for this compendium item - how a follow-up reminder recognises a Perk
 * whose Use button lives in banked-buffs.mjs.
 * @returns {{actor: Actor, item: Item}|null}
 */
export function perkUseCard(message, uuid) {
  const actorId = message?.speaker?.actor;
  const actor = actorId ? game.actors?.get?.(actorId) : null;
  const item = findSourced(actor, uuid);
  if (!item) {
    return null;
  }

  const expected = game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name });
  return String(message.content ?? '').trim() == expected ? { actor, item } : null;
}
