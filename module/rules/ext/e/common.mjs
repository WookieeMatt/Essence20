/**
 * Small shared helpers for group E's plug-ins (module/rules/ext/e/). Plain Node safe.
 */

/** A RulesExtE string (lang fragment), or the key with its data when there's no translation. */
export function T(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtE.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

/** One of the engine's own step lines (E20.Rules.Step.<key>), the same fallback as steps.mjs. */
export function S(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.Rules.Step.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

export function listOf(collection) {
  if (Array.isArray(collection)) {
    return collection;
  }

  return collection?.contents ?? (collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : []);
}

export const itemsOf = actor => listOf(actor?.items);

export const worldActors = () => listOf(globalThis.game?.actors);

/** An item's book source (or the item it acts as). */
export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

export const getProperty = (object, key) => String(key).split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), object);

export function setProperty(object, key, value) {
  const keys = String(key).split('.');
  const last = keys.pop();
  keys.reduce((at, part) => (at[part] ??= {}), object)[last] = value;
}

/** The same actor (by reference or uuid). */
export const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../helpers/gm-relay.mjs");
  return needsGmRelay(doc) ? relayToGm(doc, method, args) : doc[method](...args);
}

/** The actor holding an item (its parent), or null. */
export const holderOf = item => (item?.parent?.documentName == 'Actor' || item?.parent?.items ? item.parent : null);

/**
 * The team the GI Joe gear Perks hand out to: the primary Party's roster, or with no roster every Player Character
 * a player owns (gij3's partyMembers).
 */
export function teamMembers() {
  const members = globalThis.game?.actors?.party?.members ?? [];
  return members.length ? [...members] : worldActors().filter(actor => actor?.type == 'playerCharacter' && actor.hasPlayerOwner);
}

/** Same side: token dispositions on the canvas, else PC vs not (react/core.mjs#areAllies). */
export function allied(a, b) {
  if (!a || !b || sameActor(a, b)) {
    return false;
  }

  const ta = a.getActiveTokens?.()?.[0];
  const tb = b.getActiveTokens?.()?.[0];
  if (ta && tb) {
    return ta.document?.disposition === tb.document?.disposition;
  }

  return (a.type == 'playerCharacter') == (b.type == 'playerCharacter');
}

/** The scene an actor is on: its token's, else the one being viewed (situational2's sceneOf). */
export function sceneOf(actor) {
  const active = actor?.getActiveTokens?.(false, true)?.[0];
  const viewed = globalThis.canvas?.scene ?? globalThis.game?.scenes?.viewed ?? null;
  const token = active ?? viewed?.tokens?.find?.(t => t.actorId == actor?.id || t.actor == actor) ?? null;
  return token?.parent ?? viewed ?? null;
}

/** Availability steps for "one step harder" (gij1's Scavenger). */
export const AVAILABILITY_STEPS = ['standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical'];

export function oneStepHarder(availability) {
  const index = AVAILABILITY_STEPS.indexOf(availability ?? 'standard');
  return AVAILABILITY_STEPS[Math.min(AVAILABILITY_STEPS.length - 1, Math.max(0, index) + 1)];
}

/** An Availability tier's DIF (CONFIG.E20.availabilityDifficulties), 0 when unknown. */
export const availabilityDif = tier => Number(globalThis.CONFIG?.E20?.availabilityDifficulties?.[tier]) || 0;
