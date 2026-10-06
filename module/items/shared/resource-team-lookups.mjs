/**
 * Shared bits for the "resource" extension slice (Item Review 2026-09-28): the compendium uuids
 * this slice keys on, the Party-roster team reader and the update-diff readers. The generic item,
 * lang, chat, relayed-write, number and hook helpers live in item-lookups.mjs, item-lang.mjs,
 * chat-lines.mjs, relayed-writes.mjs, numbers.mjs and hooks-and-clients.mjs.
 *
 * Nothing in this file imports a heavy module - see mechanics/item-hooks.mjs's import-cycle note.
 */
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

const C = pack => `Compendium.essence20.${pack}.Item.`;

// (Motor Pool Connections, Beast Mode, the three Mutations and Camper went: nothing read their entries.)
export const IDS = {
  bodyOfEnergy: `${C('across_the_stars')}L2X2rIz2frulSajQ`,
  darkEnergon: `${C('decepticon_directive')}MO8ijgRUmLXcYnbL`,
  primalEnergon: `${C('decepticon_directive')}1mTrbliJVJvIl1qk`,
  redEnergon: `${C('decepticon_directive')}EzAE0hdxbgKtffKB`,
  synthEn: `${C('decepticon_directive')}SgYkXSFLiLT8hjMP`,
  addictedDarkEnergon: `${C('decepticon_directive')}e3c7wuCA7JQS7rTA`,
  weImprovise: `${C('transformers_one_sourcebook')}qnRFb2A0sLpSg2sL`,
  circleOfMagicalFriends: `${C('mlp_crb')}Evg7HVLPles0X9DM`,
};

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
