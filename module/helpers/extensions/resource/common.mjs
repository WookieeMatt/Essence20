/**
 * Shared bits for the "resource" extension slice (Item Review 2026-09-28): item identity, the
 * compendium uuids this slice keys on, and small Foundry wrappers every module here needs.
 *
 * Nothing in this file imports a heavy module - see helpers/extensions.mjs's import-cycle note.
 */
import { hasSourced, worldActors } from "../../companion-link.mjs";

const C = pack => `Compendium.essence20.${pack}.Item.`;

export const IDS = {
  gotToGetTough: `${C('gi_joe_crb')}bIoMrn9aP9x6QYVL`,
  motorPool: `${C('quartermasters_guide_to_gear')}Lyb8wPzI0XUuwF3o`,
  desperate: `${C('cobra_codex')}ZBhsKnZBy9SmjGvO`,
  moneyTalks: `${C('cobra_codex')}sAY8uesn2NTTcDqi`,
  playFavorites: `${C('cobra_codex')}5HimuCoEpjYRiOSV`,
  playFavoritesAgainst: `${C('cobra_codex')}f6hlQSJhLCTSAILh`,
  profitDirector: `${C('cobra_codex')}dcwQ9rAAXGlsQ8p1`,
  ruthlessEfficiency: `${C('cobra_codex')}KQWE1o3PjguwjAD0`,
  thisICommand: `${C('cobra_codex')}SUc3emTvPnwB6W93`,
  beastMode: `${C('cobra_codex')}o4lqILvsxyU3LhBS`,
  engraftedMutation: `${C('cobra_codex')}zuR9YJ2Wy956VGGy`,
  evolvingMutation: `${C('cobra_codex')}7cL4aUwJwqvbhYCz`,
  outrightMutation: `${C('cobra_codex')}RcGUjeMpsNDFjwmL`,
  capableFreelancer: `${C('intercontinental_adventures')}PTEnW3QDpejzj27c`,
  repairProgressEnergon: `${C('cobra_con_fusion')}rPbEnrg7Qx2Lm9Vd`,
  bodyOfEnergy: `${C('across_the_stars')}L2X2rIz2frulSajQ`,
  voidWarrior: `${C('across_the_stars')}gyDCPmqswCQJYN6e`,
  dinoCharged: `${C('beneath_the_helmet')}n9ME10p6mfOJnUdE`,
  thinkFast: `${C('jump_through_time')}Sjx8BBENyDUTRJvs`,
  historyBuff: `${C('jump_through_time')}b3O5i3HMtaIHl6PD`,
  innerConservation: `${C('through_the_shattered_grid')}NkHKAb5TFc7n7C8k`,
  powerEfficiency: `${C('through_the_shattered_grid')}3fa8lKE6TpQ6lr0P`,
  fuelEfficient: `${C('tf_crb')}hW6ESJ1p7GvIGzBe`,
  darkEnergon: `${C('decepticon_directive')}MO8ijgRUmLXcYnbL`,
  primalEnergon: `${C('decepticon_directive')}1mTrbliJVJvIl1qk`,
  redEnergon: `${C('decepticon_directive')}EzAE0hdxbgKtffKB`,
  synthEn: `${C('decepticon_directive')}SgYkXSFLiLT8hjMP`,
  addictedDarkEnergon: `${C('decepticon_directive')}e3c7wuCA7JQS7rTA`,
  togetherWeStand: `${C('enigma_of_combination')}oj7vUwpB9EW8stUG`,
  sparkOfTheAncients: `${C('enigma_of_combination')}zqPSjUwr1Y7OvGfD`,
  weImprovise: `${C('transformers_one_sourcebook')}qnRFb2A0sLpSg2sL`,
  circleOfMagicalFriends: `${C('mlp_crb')}Evg7HVLPles0X9DM`,
  extensiveResearch: `${C('mlp_crb')}TwW8c51b3bCL9Rul`,
  honestCompassion: `${C('mlp_crb')}Dfjo9U9cAgigD9oA`,
  musicalInterlude: `${C('knights_of_canterlot')}0PVrQ1RsRNP023MO`,
  camper: `${C('knights_of_canterlot')}dMEFcqcain5oS2mJ`,
  zapAppleJam: `${C('in_a_jam')}L5B7d8mw0xeOHVkw`,
};

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? '';
}

/** Whether an item is (a copy of) the given compendium item. Never matches an empty uuid. */
export function isItem(item, uuid) {
  const source = sourceOf(item);
  return !!source && !!uuid && source == uuid;
}

/** Whether the actor carries any item (Perk, Hang-Up, gear...) copied from the uuid. */
export function has(actor, uuid) {
  return !!uuid && hasSourced(actor, uuid);
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

export function findItem(actor, uuid) {
  return itemsOf(actor).find(item => isItem(item, uuid)) ?? null;
}

export function countItems(actor, uuid) {
  return itemsOf(actor).filter(item => isItem(item, uuid)).length;
}

export { worldActors };

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** A plain chat line spoken by the actor. */
export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Whether this client should run a GM-side sweep (exactly one client does). */
export function isActiveGm() {
  const active = game.users?.activeGM;
  return active ? !!active.isSelf : !!game.user?.isGM;
}

/**
 * Update an actor this user may not own, through the GM when needed.
 * @param {Actor} actor
 * @param {Object} update
 * @param {Object} [options]
 */
export async function writeActor(actor, update, options = {}) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, 'update', [update, options]);
  }

  return actor.update(update, options);
}

/** The Party actors this actor is on the roster of. */
export function partiesOf(actor) {
  return worldActors().filter(party => party.type == 'party'
    && Object.values(party.system?.actors ?? {}).some(entry => entry?.uuid == actor?.uuid));
}

/** The actor's teammates: everyone on any Party roster with them (themselves included). */
export function teamOf(actor) {
  const seen = new Map([[actor?.uuid, actor]]);
  for (const party of partiesOf(actor)) {
    for (const member of party.members ?? []) {
      seen.set(member.uuid, member);
    }
  }

  return [...seen.values()].filter(Boolean);
}

/** The first targeted token's actor, if any. */
export function targetedActor() {
  const targets = game.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  return [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

/** Reads a numeric path off an actor, 0 when missing. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A (current, previous) pair for a numeric system path out of an update, or null if the update
 * doesn't touch it. `changes` is the diff Foundry hands the update hooks.
 */
export function changed(changes, path) {
  if (!changes) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(changes, path)) {
    return changes[path];
  }

  let node = changes;
  for (const key of path.split('.')) {
    if (node == null || typeof node != 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return undefined;
    }

    node = node[key];
  }

  return node;
}

/** Overwrite a value in an update diff, flat key or nested, whichever it uses. */
export function setChanged(changes, path, value) {
  if (Object.prototype.hasOwnProperty.call(changes, path)) {
    changes[path] = value;
    return;
  }

  const keys = path.split('.');
  let node = changes;
  for (const key of keys.slice(0, -1)) {
    node[key] ??= {};
    node = node[key];
  }

  node[keys.at(-1)] = value;
}

/** Hooks.on, when there is a Hooks (not under Jest). */
export function onHook(name, fn) {
  return globalThis.Hooks?.on?.(name, fn);
}
