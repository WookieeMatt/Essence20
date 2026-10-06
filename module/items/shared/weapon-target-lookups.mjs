/**
 * Shared bits for the tf2 slice (Transformers: Technorganic Secrets, The Enigma of Combination and
 * the TF Core Rulebook): compendium ids, item identity, and small helpers. Light module - imports
 * nothing heavy (see the extension registry's import-cycle rule).
 */
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const TF2 = {
  // Technorganic Secrets
  mutantBeast: C('technorganic_secrets', 'gkcyg7KWih6QAZlq'),
  mutantBeastPerk: C('technorganic_secrets', 'R85uJNpYbXd9C9Eh'),
  // The Enigma of Combination
  notLikeThat: C('enigma_of_combination', 'OrK3XyNIyJcorMxp'),
  // Transformers Core Rulebook
  // Special-attack weapons the Technorganic Secrets Alt Modes print.
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  if (Array.isArray(items)) {
    return items;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/** The actor's first item copied from this compendium entry. */
export function itemOf(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

export const has = (actor, uuid) => !!itemOf(actor, uuid);

/** An item's name, or a fallback, for labels. */
export const nameOf = (actor, uuid, fallback) => itemOf(actor, uuid)?.name ?? fallback;

/** A weaponEffect's parent weapon, if it has one. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? itemsOf(actor).find(other => other.id == parentId) ?? null : null;
}

/** The upgrades of one compendium entry attached to this weapon. */
export function upgradesOn(actor, weapon, uuid) {
  if (!weapon) {
    return [];
  }

  return itemsOf(actor).filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weapon.id && sourceOf(item) == uuid);
}

/** The first targeted token's actor. */
export function targetedActor() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  return [...(globalThis.game?.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

/** A chat line spoken by the actor. */
export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Distance between two actors' tokens in feet, or null when either isn't on the canvas. */
export function feetBetween(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** Whether it is this actor's turn in the active combat. */
export function isOwnTurn(actor) {
  const combat = globalThis.game?.combat;
  return !!combat && combat.combatant?.actor?.id == actor?.id;
}

/** Write to an actor this user may not own, through the GM when needed. */
export async function writeActor(actor, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(actor)) {
    return relayToGm(actor, method, args);
  }

  return actor[method](...args);
}

/** The Defense total, or null. */
export const defenseOf = (actor, defense) => {
  const value = Number(actor?.system?.defenses?.[defense]?.total);
  return Number.isFinite(value) ? value : null;
};

/** Whether the one client that should do an automatic write is this one (active GM, else owner). */
export function isResponsible(doc) {
  const gm = globalThis.game?.users?.activeGM;
  if (gm) {
    return !!gm.isSelf;
  }

  return !!doc?.isOwner;
}

export { worldActors };
