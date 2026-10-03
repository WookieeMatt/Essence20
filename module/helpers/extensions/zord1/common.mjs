/**
 * Shared bits for the zord1 extension modules (Forms, Emotional Mastery, Zord Feature slots,
 * Megaforms, size/mode items). Light on purpose: nothing heavy is imported at top level.
 */

export const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const jtt = pack('jump_through_time');
export const ats = pack('across_the_stars');
export const bth = pack('beneath_the_helmet');
export const cc = pack('cobra_codex');
export const dsoe = pack('dark_skies_over_equestria');
export const dd = pack('decepticon_directive');
export const fgaa = pack('field_guide_action_adventure');
export const prcrb = pack('pr_crb');

/** A localized string - keys live in scratchpad integration/zord1-lang.json as E20.<key>. */
export const T = (key, data) => {
  const full = `E20.${key}`;
  const i18n = globalThis.game?.i18n;
  if (!i18n) {
    return full;
  }

  return data ? i18n.format(full, data) : i18n.localize(full);
};

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

/** Every embedded item as a plain array (Collections, arrays and Maps all work). */
export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items;
  }

  if (Array.isArray(items.contents)) {
    return items.contents;
  }

  return typeof items[Symbol.iterator] == 'function' ? [...items].map(entry => (Array.isArray(entry) ? entry[1] : entry)) : [];
}

export function findSourced(actor, uuid) {
  if (!uuid) {
    return null;
  }

  return itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;
}

export function allSourced(actor, uuid) {
  return uuid ? itemsOf(actor).filter(item => sourceOf(item) == uuid) : [];
}

export const hasItem = (actor, uuid) => !!findSourced(actor, uuid);

export function flagOf(doc, key) {
  return doc?.flags?.essence20?.[key];
}

/* -------------------------------------------- */
/*  Personal Power                               */
/* -------------------------------------------- */

export function personalPower(actor) {
  return Number(actor?.system?.powers?.personal?.value) || 0;
}

/** Spend n Personal Power; false (and a warning) if the actor can't afford it. */
export async function spendPower(actor, n = 1) {
  if (n <= 0) {
    return true;
  }

  if (personalPower(actor) < n) {
    globalThis.ui?.notifications?.warn(T('Zord1NoPower', { name: actor?.name ?? '', n }));
    return false;
  }

  await writeActor(actor, 'update', [{ 'system.powers.personal.value': personalPower(actor) - n }]);
  return true;
}

export async function gainPower(actor, n) {
  const max = Number(actor?.system?.powers?.personal?.max);
  const next = personalPower(actor) + n;
  await writeActor(actor, 'update', [{ 'system.powers.personal.value': Number.isFinite(max) && max > 0 ? Math.min(max, next) : next }]);
}

/** actor[method](...args), relayed through the GM when this user can't write to that actor. */
export async function writeActor(actor, method, args) {
  if (!actor) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(actor)) {
    await relayToGm(actor, method, args);
    return;
  }

  await actor[method](...args);
}

/* -------------------------------------------- */
/*  Allies and enemies                           */
/* -------------------------------------------- */

export function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

export function isAllyOf(a, b) {
  return !!a && !!b && a !== b && a.uuid != b.uuid && dispositionOf(a) == dispositionOf(b);
}

export function isEnemyOf(a, b) {
  const da = dispositionOf(a);
  const db = dispositionOf(b);
  return !!a && !!b && da != db && da != 0 && db != 0;
}

/* -------------------------------------------- */
/*  "Until the start of your next turn"          */
/* -------------------------------------------- */

/** A stamp that stays live until the start of the actor's next turn (or for the scene, outside combat). */
export function untilNextTurnStamp(actor, sceneEpoch = null) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return { sceneEpoch };
  }

  const theirs = (combat.turns ?? []).findIndex(c => c.actor?.id == actor?.id);
  const turn = theirs < 0 ? combat.turn : theirs;
  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: turn - 1, sceneEpoch };
}

export function isStampLive(stamp, currentEpoch = null) {
  if (!stamp) {
    return false;
  }

  const combat = globalThis.game?.combat;
  if (stamp.combatId && (!combat || combat.id != stamp.combatId)) {
    return false;
  }

  if (stamp.sceneEpoch != null && currentEpoch != null && stamp.sceneEpoch != currentEpoch) {
    return false;
  }

  if (stamp.untilRound != null && combat) {
    if (combat.round > stamp.untilRound || (combat.round == stamp.untilRound && combat.turn > stamp.untilTurn)) {
      return false;
    }
  }

  return true;
}

/* -------------------------------------------- */
/*  Chat                                         */
/* -------------------------------------------- */

export async function postLine(actor, content) {
  const CM = globalThis.ChatMessage;
  if (!CM?.create || !content) {
    return;
  }

  await CM.create({ content, speaker: CM.getSpeaker?.({ actor }) });
}

/** The option-object Edge helper the dialog appliers share: Edge cancels a Snag first. */
export function giveEdge(options) {
  if (options.snag) {
    options.snag = false;
  } else {
    options.edge = true;
  }
}

/** The weapon a weaponEffect hangs off (null for an unarmed attack). */
export function parentWeaponOf(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const parentId = item.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? itemsOf(actor).find(i => i.id == parentId) ?? null : null;
}

export const isUnarmed = (actor, item) => item?.type == 'weaponEffect' && !parentWeaponOf(actor, item);
export const isBladeBlaster = weapon => !!weapon?.name?.includes?.('Blade Blaster');
export const isPowerWeapon = weapon => !isBladeBlaster(weapon) && !!weapon?.system?.traits?.includes?.('powerWeapon');
