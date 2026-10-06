/**
 * Shared bits for the tf3 slice - Transformers Core Rulebook and Transformers One Sourcebook items.
 * Light on purpose (no heavy imports), so every file in this folder can use it.
 */

const tf = id => `Compendium.essence20.tf_crb.Item.${id}`;
const tf1s = id => `Compendium.essence20.transformers_one_sourcebook.Item.${id}`;

export const TF3 = {
  multiplication: tf('K3FNcAMjjek1UaJk'),
  thirdDimension: tf('4pyOcetfAuXZlXmH'),
  unexpectedAlternative: tf('UNe8N1eZWjWxDTIz'),
  deceptiveWarfare: tf1s('OJcHMBA3QYgPp5w0'),
  oneBotOverAnother: tf1s('n5dNCOPVTsqLAapp'),
};

export const SCOPE = 'essence20';

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

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

/** The actor's item sourced from uuid (any type), or null. Guards an undefined uuid. */
export function held(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

export const holds = (actor, uuid) => !!held(actor, uuid);

export const nameOf = (actor, uuid, fallback = '') => held(actor, uuid)?.name ?? fallback;

export const flagOf = (doc, key) => doc?.flags?.[SCOPE]?.[key];

/** A Transformer in Bot Mode (Alt Mode Gear's "Bot Mode" half). */
export const inBotMode = actor => !actor?.system?.isTransformed;

/** A Transformer in Alt Mode. */
export const inAltMode = actor => !!actor?.system?.isTransformed;

export function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/** Feet between two actors' tokens on the current scene, or Infinity when either is off it. */
export function feetBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return Infinity;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** Same side: token disposition when both are placed, else PC vs non-PC. */
export function areAllies(a, b) {
  if (!a || !b || a === b || (a.uuid && a.uuid == b.uuid)) {
    return false;
  }

  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (ta && tb) {
    return ta.document?.disposition === tb.document?.disposition;
  }

  return (a.type == 'playerCharacter') == (b.type == 'playerCharacter');
}

export function areEnemies(a, b) {
  if (!a || !b || a === b || (a.uuid && a.uuid == b.uuid)) {
    return false;
  }

  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (ta && tb) {
    const da = ta.document?.disposition;
    const db = tb.document?.disposition;
    return da !== db && da !== 0 && db !== 0;
  }

  return (a.type == 'playerCharacter') != (b.type == 'playerCharacter');
}

/** The one client that acts for an actor: its first active non-GM owner, else the active GM. */
export function isResponsible(actor) {
  if (!actor || !game.user) {
    return false;
  }

  const users = game.users?.contents ?? [...(game.users ?? [])];
  const owners = users.filter(user => user.active && !user.isGM && actor.testUserPermission?.(user, 'OWNER'))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (owners.length) {
    return owners[0].id == game.user.id;
  }

  return game.user.id == game.users?.activeGM?.id;
}

export function ownerIds(actor) {
  const users = game.users?.contents ?? [...(game.users ?? [])];
  return users.filter(user => user.isGM || actor?.testUserPermission?.(user, 'OWNER')).map(user => user.id);
}

export function esc(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function say(actor, content, extra = {}) {
  return globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, ...extra });
}

/** Write to an actor this user may not own - directly when it can, else relayed to the GM. */
export async function writeActor(actor, changes) {
  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  return needsGmRelay(actor) ? relayToGm(actor, 'update', [changes]) : actor.update(changes);
}

/** The weapon a weaponEffect belongs to, or null (unarmed). */
export function parentWeapon(actor, effect) {
  const id = effect?.flags?.[SCOPE]?.parentId;
  return id ? itemsOf(actor).find(item => item.id == id) ?? null : null;
}

/** "Until the end of your next turn" as a combat stamp; outside combat, the scene. */
export function stampNow(sceneEpoch = null) {
  const combat = game.combat;
  return combat ? { combatId: combat.id, round: combat.round ?? 0 } : { scene: sceneEpoch };
}

/** Whether a stampNow() window is still open: this round or the next, or the same scene. */
export function stampOpen(stamp, sceneEpoch = null) {
  if (!stamp) {
    return false;
  }

  const combat = game.combat;
  if (stamp.combatId) {
    return !!combat && combat.id == stamp.combatId && (combat.round ?? 0) <= (stamp.round ?? 0) + 1;
  }

  return !combat && stamp.scene === sceneEpoch;
}
