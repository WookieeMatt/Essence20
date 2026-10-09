/**
 * Shared bits for the zord2 slice: compendium ids, item identity, who-writes-what, and a chat line.
 * Light module - imports nothing heavy (see the extension registry's import-cycle rule).
 */
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const ZORD2 = {
  // Enigma of Combination
  gestaltCombiner: C('enigma_of_combination', 'a4BfJxhUC7hAhgdZ'),
  matchedCombiner: C('enigma_of_combination', 'ZIJnA0z3Mrp8pfbd'),
  universalComponent: C('enigma_of_combination', 'pTx8Io4qekyeseKO'),
  efficientCombination: C('enigma_of_combination', 'tuQaie4eX4MLl1Wp'),
  invigoratingConnection: C('enigma_of_combination', 'wdJZaFhmwu3tig6K'),
  macroMagneticLinkage: C('enigma_of_combination', 'UHN5oz0FUoMPAB09'),
  gestaltHunter: C('enigma_of_combination', 'h6PEbQy4lgSaLhei'),
  safeRelease: C('enigma_of_combination', 'bnLzRj5psSjTVXUU'),
  titanHardpoint: C('enigma_of_combination', 'qrZRunCUyEGT9HE7'),
  universalReceptors: C('enigma_of_combination', 'MXwHqZJjYC94DVJx'),
  eocCoreBody: C('enigma_of_combination', 'Zd2CoreBodyEoC01'),
  additionalMovement: C('enigma_of_combination', '1qvmixV4VyiQVvsO'),
  eocEnhancedAttack: C('enigma_of_combination', 'Zd2EnhAttackEoC1'),
  // Power Rangers
  enhancedMeleeAttack: C('pr_crb', 'X6BPzpHr2cBq3jbt'),
  enhancedRangedAttack: C('pr_crb', 'lDHkwavMgjjDoy5U'),
  // (Warrior Mode - warrior-mode.mjs keeps its own id -, Zord Feature, Assault Weapon and Zord Ultra Mode went: nothing
  // read their entries here.)
  combiner: C('pr_crb', 'ZZMBVjmosr0VViMU'),
  prCoreBody: C('pr_crb', 'Q1FIsjWqvosX8Diw'),
  prCoreDefenses: C('pr_crb', 'YcqEl6Q6QkoXhuTH'),
  prMove: C('pr_crb', '3TeQStgfP5kQZmeL'),
  layeredSystems: C('across_the_stars', 'rAC7xWiUVAqXJFMJ'),
  adaptableFutureTech: C('through_the_shattered_grid', '35qov21Mglyqxql1'),
  defenderTorozord: C('through_the_shattered_grid', '8GrSnFescEVUt1nn'),
  versatileCombiner: C('through_the_shattered_grid', 'XbRfajp9KwfzDG5c'),
  // G.I. Joe
  // Transformers
};

export { sourceOf };

// Not item-lookups.mjs#itemsOf: a plain array is handed back as-is (that one copies it).
export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items;
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

/** Every item the actor holds sourced from `uuid` (never matches an undefined uuid). */
export const sourced = (actor, uuid) => (uuid ? itemsOf(actor).filter(item => sourceOf(item) == uuid) : []);
export const holds = (actor, uuid) => sourced(actor, uuid).length > 0;

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** The megaformTrait items an actor carries of one trait type. */
export const traitsOf = (actor, type) => itemsOf(actor).filter(item => item.type == 'megaformTrait' && item.system?.type == type);

/** Megaform actors whose roster (system.actors) lists this actor. */
export function megaformsContaining(actor) {
  if (!actor?.uuid) {
    return [];
  }

  return worldActors().filter(other => other?.type == 'megaform'
    && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor.uuid));
}

export const isCombinerForm = megaform => !!megaform?.system?.subtype?.includes?.('megaformCombiner');

/** Roster actors, resolved. */
export function rosterOf(megaform) {
  return Object.values(megaform?.system?.actors ?? {})
    .map(entry => (typeof fromUuidSync == 'function' ? fromUuidSync(entry.uuid) : null))
    .filter(Boolean);
}

/**
 * The one client that should do an automatic write for this document: the active GM, or - with no
 * GM on - an owner. Keeps hooks that fire on every client from writing N times.
 */
export function isResponsible(doc) {
  const gm = game.users?.activeGM;
  if (gm) {
    return gm.id == game.user?.id;
  }

  return !!doc?.isOwner;
}

/** Write to a document, relaying through the GM when this user can't. */
export async function writeDoc(doc, method, ...args) {
  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

export async function chat(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export const sizeIndex = size => Object.keys(CONFIG.E20?.actorSizes ?? {}).indexOf(size);
export const isGiganticOrLarger = size => sizeIndex(size) >= sizeIndex('gigantic') && sizeIndex('gigantic') >= 0;
