/**
 * Group A plug-ins (round 10): shared helpers - who belongs to which Megaform, whose Zord is whose. Plain Node safe:
 * Foundry globals are only read inside functions.
 */

export function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}

export const worldList = collection => collection?.contents ?? (collection ? [...collection] : []);
export const worldActors = () => worldList(globalThis.game?.actors);
export const itemsOf = actor => worldList(actor?.items);
export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

/** The actor holding an item (a rule's holder). */
export const holderOf = item => item?.parent ?? item?.actor ?? null;

/** A Megaform's participants (system.actors), resolved. */
export function rosterOf(megaform) {
  if (megaform?.type != 'megaform') {
    return [];
  }

  return Object.values(megaform.system?.actors ?? {}).map(entry => resolve(entry?.uuid)).filter(Boolean);
}

/** The Megaforms an actor is a participant of. */
export function megaformsContaining(actor) {
  if (!actor?.uuid) {
    return [];
  }

  return worldActors().filter(other => other?.type == 'megaform'
    && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor.uuid));
}

/** A Transformers Combiner form (a Megaform of the megaformCombiner subtype). */
export const isCombinerForm = form => form?.type == 'megaform' && !!form.system?.subtype?.includes?.('megaformCombiner');

/** The Zords listed on a character's sheet (system.actors entries of type zord). */
export function ownedZords(actor) {
  return Object.values(actor?.system?.actors ?? {}).filter(entry => entry?.type == 'zord').map(entry => resolve(entry.uuid)).filter(Boolean);
}

/** Whether `actor` lists this Zord on its sheet. */
export const listsZord = (actor, zord) => !!actor && !!zord?.uuid
  && Object.values(actor.system?.actors ?? {}).some(entry => entry?.type == 'zord' && entry.uuid == zord.uuid);

/** "Their own Zord": listed on the character's sheet (any entry), or linked to them as its owner. */
export function ownsZord(actor, zord) {
  if (!actor || !zord) {
    return false;
  }

  return Object.values(actor.system?.actors ?? {}).some(entry => entry?.uuid == zord.uuid) || zord.flags?.essence20?.companionOf == actor.uuid;
}

/** A vehicle's or Zord's crew rows, resolved: [{actor, role}]. */
export function crewRows(vehicle) {
  if (!['vehicle', 'zord'].includes(vehicle?.type)) {
    return [];
  }

  return Object.values(vehicle.system?.actors ?? {}).filter(entry => entry?.uuid)
    .map(entry => ({ actor: resolve(entry.uuid), role: entry.vehicleRole ?? 'passenger' })).filter(entry => entry.actor);
}

/** A vehicle's or Zord's driver. */
export const driverOf = vehicle => crewRows(vehicle).find(entry => entry.role == 'driver')?.actor ?? null;

/** The vehicle or Zord this actor is crewing (first found), and how. */
export function crewing(actor) {
  if (!actor?.uuid) {
    return null;
  }

  for (const vehicle of worldActors()) {
    if (!['vehicle', 'zord'].includes(vehicle?.type)) {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

export const flagOf = (doc, key) => doc?.flags?.essence20?.[key];

/** The weapon a weaponEffect hangs off (null for an unarmed attack). */
export function parentWeaponOf(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const parentId = item.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? itemsOf(actor).find(other => other.id == parentId) ?? null : null;
}

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../helpers/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/** A localized RulesExtA string (E20.RulesExtA.<key>), or the key when there's no game (tests). */
export function T(key, data) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtA.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
