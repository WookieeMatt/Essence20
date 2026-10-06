/**
 * Shared bits for the gij2 slice (G.I. JOE Roleplaying Game Core Rulebook items): the compendium
 * ids it keys on and a few small item/chat helpers.
 */

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

export const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

/** Every item on the actor carrying this compendium source, of any type. */
export function allSourced(actor, uuid) {
  return uuid ? itemsOf(actor).filter(item => sourceOf(item) == uuid) : [];
}

export function findSourced(actor, uuid) {
  return allSourced(actor, uuid)[0] ?? null;
}

export function hasItem(actor, uuid) {
  return !!findSourced(actor, uuid);
}

/** A plain chat card spoken by the actor. */
export async function post(actor, content, extra = {}) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, ...extra });
}

export function escape(text) {
  return foundry?.utils?.escapeHTML ? foundry.utils.escapeHTML(String(text ?? '')) : String(text ?? '');
}

/**
 * The speaking actor and its item when a chat message is helpers/perks.mjs#postPerkUseChatCard's
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

/** The combat round stamp used for "until" windows. */
export function roundStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round } : { combatId: null, round: null };
}
