/**
 * Shared bits for the qualify1 extension modules: item identity, the compendium ids this slice
 * automates, and a tiny GM relay for writes to an actor the clicking user doesn't own.
 */

export const Q1 = {
  // Cobra Codex, Firestarter Ranger, 10th level, p.58
  // Decepticon Directive
  addictedDarkEnergon: 'Compendium.essence20.decepticon_directive.Item.e3c7wuCA7JQS7rTA',
  // G.I. Joe CRB
  // Intercontinental Adventures
  goodToGo: 'Compendium.essence20.intercontinental_adventures.Item.Yt3muowN1aALcqOj',
  ninpoJoes: 'Compendium.essence20.intercontinental_adventures.Item.8oZYgik001Dxxxa6',
  nothingPersonal: 'Compendium.essence20.intercontinental_adventures.Item.WsB4CydGzKF2g7Yi',
  nuPogodi: 'Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn',
};

/** Upgrades, by compendium _id (the same upgrade is reprinted under one _id across books). */
export const Q1_UPGRADE = {
  silencer: 'rSP76BWjYaifJLIZ',
};


export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

/** The trailing 16-char _id of a compendium uuid (or the id itself). */
export function idOf(uuid) {
  return uuid ? String(uuid).split('.').pop() : null;
}

/** The actor's items that came from this compendium uuid (or bare _id, any pack). */
export function itemsFrom(actor, uuidOrId) {
  if (!uuidOrId) {
    return [];
  }

  const wanted = idOf(uuidOrId);
  const full = String(uuidOrId).includes('.');
  const list = actor?.items?.filter ? actor.items.filter(() => true) : [...(actor?.items ?? [])];
  return list.filter(item => {
    const source = sourceOf(item);
    if (!source) {
      return false;
    }

    return full ? source == uuidOrId : idOf(source) == wanted;
  });
}

export function itemFrom(actor, uuidOrId) {
  return itemsFrom(actor, uuidOrId)[0] ?? null;
}

export function has(actor, uuidOrId) {
  return itemsFrom(actor, uuidOrId).length > 0;
}

export const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export function escape(text) {
  return foundry?.utils?.escapeHTML ? foundry.utils.escapeHTML(String(text ?? '')) : String(text ?? '');
}

/* -------------------------------------------- */
/*  A small GM relay for flag writes             */
/* -------------------------------------------- */

const SOCKET = 'system.essence20';
const ACTION = 'q1Relay';

/**
 * Set a flag on an actor, going through the active GM when this user can't write it (a shared,
 * once-per-scene ability used by an ally, a reroll pool one Perk-holder opened for the team).
 * Only essence20 flags whose key starts with "q1" can be written this way.
 * @param {Actor} actor
 * @param {String} key
 * @param {*} value
 */
export async function setQ1Flag(actor, key, value) {
  if (!String(key).startsWith('q1')) {
    throw new Error(`qualify1 relay: refused flag ${key}`);
  }

  const canWrite = game.user?.isGM || actor?.isOwner || !game.users?.activeGM;
  if (canWrite) {
    await actor.setFlag('essence20', key, value);
    return true;
  }

  game.socket?.emit(SOCKET, { action: ACTION, uuid: actor.uuid, key, value });
  return true;
}

export async function handleQ1Relay(data) {
  if (data?.action != ACTION || !game.user?.isActiveGM || !String(data.key).startsWith('q1')) {
    return false;
  }

  const actor = await fromUuid(data.uuid);
  if (!actor) {
    return false;
  }

  await actor.setFlag('essence20', data.key, data.value);
  return true;
}

export function registerQ1Relay() {
  game.socket?.on?.(SOCKET, data => {
    handleQ1Relay(data);
  });
}
