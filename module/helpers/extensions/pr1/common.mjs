/**
 * Shared bits for the pr1 extension modules (A Jump Through Time, Across the Stars, Beneath the
 * Helmet, Adventures in Angel Grove items). Light on purpose: nothing heavy is imported at top level.
 */
import { worldActors } from "../../companion-link.mjs";

const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const jtt = pack('jump_through_time');
export const ats = pack('across_the_stars');
export const bth = pack('beneath_the_helmet');
export const pradv = pack('power_rangers_adventures');

export const PR1 = {
  // A Jump Through Time
  mobileHeadquarters: jtt('soCSwGBp0AZbEeZC'),
  overdrive: jtt('2JZSo4C7xDUMlPG2'),
  profiteerHangUp: jtt('FDf9ZhuajJb3U5un'),
  prospectorToolkit: jtt('anD2xly3g2CS45et'),
  spectrumShifted: jtt('sgRiSOX0hDIKkcMh'),
  timeDisplaced: jtt('N4OwC0gTkUtRwBKr'),
  warheadMagazines: jtt('57an1eB6FMmcpKlk'),
  // Across the Stars
  beAnExample: ats('zkxPG5mwAQl1vZOT'),
  destinyHangUp: ats('PRf5WTMgof11YCeE'),
  lightspeedBoost: ats('sap5gMPDrWvjLCCu'),
  nemesis: ats('bxGgq6PpfxeSRr7Q'),
  powerFlux: ats('zhfG2gH4IgIjMAzT'),
  powerWing: ats('aCPFmjY80u9671Hl'),
  swatUpgrade: ats('Ce5f5pQTNTSY6xgF'),
  standBehindMe: ats('PcezfGdjUtNUZHYH'),
  tacticalSizeShift: ats('tS3P7BZqnH9GGLux'),
  warzord: ats('jX5IHpydHimdjbGb'),
  combiner: 'Compendium.essence20.pr_crb.Item.ZZMBVjmosr0VViMU',
  // Beneath the Helmet
  advancedDinoGem: bth('K4CUMFhAjXRFzGbA'),
};

/** A localized string - keys live in scratchpad integration/pr1-lang.json as E20.<key>. */
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

export function allSourced(actor, uuid) {
  return uuid ? itemsOf(actor).filter(item => sourceOf(item) == uuid) : [];
}

export const findSourced = (actor, uuid) => allSourced(actor, uuid)[0] ?? null;
export const has = (actor, uuid) => allSourced(actor, uuid).length > 0;
export const isItem = (item, uuid) => !!uuid && sourceOf(item) == uuid;

/** An equipped copy of a weapon/armor/gear item. */
export const equipped = (actor, uuid) => allSourced(actor, uuid).find(item => item.system?.equipped !== false) ?? null;

export function flagOf(doc, key) {
  return doc?.flags?.essence20?.[key];
}

export const num = value => Number(value) || 0;

/** doc[method](...args), relayed through the GM when this user can't write to that document. */
export async function writeDoc(doc, method, ...args) {
  if (!doc) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    await relayToGm(doc, method, args);
    return;
  }

  await doc[method](...args);
}

export async function postLine(actor, content, extra = {}) {
  const CM = globalThis.ChatMessage;
  if (!CM?.create || !content) {
    return;
  }

  await CM.create({ content, speaker: CM.getSpeaker?.({ actor }), ...extra });
}

/* -------------------------------------------- */
/*  Vehicles, Zords and their crews              */
/* -------------------------------------------- */

export const isMachine = actor => ['zord', 'vehicle', 'megaform'].includes(actor?.type);

/** The Zords/vehicles this actor is seated in: [{vehicle, role}]. */
export function seatsOf(actor) {
  if (!actor?.uuid) {
    return [];
  }

  const seats = [];
  for (const vehicle of worldActors()) {
    if (!['zord', 'vehicle'].includes(vehicle?.type)) {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid && crew?.vehicleRole);
    if (entry) {
      seats.push({ vehicle, role: entry.vehicleRole });
    }
  }

  return seats;
}

/** Everyone seated in a vehicle/Zord: [{actor, role}]. */
export function crewOf(vehicle) {
  return Object.values(vehicle?.system?.actors ?? {})
    .filter(entry => entry?.vehicleRole)
    .map(entry => ({ actor: globalThis.fromUuidSync?.(entry.uuid) ?? null, role: entry.vehicleRole }))
    .filter(entry => entry.actor);
}

export const driverOf = vehicle => crewOf(vehicle).find(entry => entry.role == 'driver')?.actor ?? null;

/** The Zord components of a Megaform. */
export function componentsOf(megaform) {
  return Object.values(megaform?.system?.actors ?? {})
    .map(entry => globalThis.fromUuidSync?.(entry.uuid) ?? null)
    .filter(actor => actor?.type == 'zord');
}

/* -------------------------------------------- */
/*  Allies, enemies and distance                 */
/* -------------------------------------------- */

export const tokenOf = actor => actor?.getActiveTokens?.()?.[0] ?? null;

export function dispositionOf(actor) {
  return tokenOf(actor)?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

export function isAllyOf(a, b) {
  return !!a && !!b && dispositionOf(a) == dispositionOf(b);
}

export function isEnemyOf(a, b) {
  const da = dispositionOf(a);
  const db = dispositionOf(b);
  return !!a && !!b && da != db && da != 0 && db != 0;
}

/** Grid distance in feet between two actors' tokens, or null when either isn't on the canvas. */
export function feetBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb) {
    return null;
  }

  const measure = globalThis.canvas?.grid?.measurePath;
  if (measure) {
    try {
      return measure.call(globalThis.canvas.grid, [ta.center, tb.center]).distance;
    } catch (error) {
      // fall through to the plain geometry below
    }
  }

  const size = globalThis.canvas?.grid?.size || 100;
  const dist = globalThis.canvas?.grid?.distance || 5;
  return Math.hypot(ta.center.x - tb.center.x, ta.center.y - tb.center.y) / size * dist;
}

/** Actors with a token on the viewed scene. */
export function sceneActors() {
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  return tokens.map(token => token.actor).filter(Boolean);
}

/* -------------------------------------------- */
/*  Per-turn stamps                              */
/* -------------------------------------------- */

export function turnStamp() {
  const combat = globalThis.game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null };
}

export function isThisTurn(stamp) {
  const combat = globalThis.game?.combat;
  if (!stamp) {
    return false;
  }

  if (!combat) {
    return !stamp.combatId;
  }

  return stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

/** "Until the beginning of [actor]'s next turn": live until that actor's next turn starts. */
export function untilNextTurn(actor) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return { combatId: null };
  }

  return { combatId: combat.id, round: combat.round, turn: combat.turn, actorId: actor?.id ?? null };
}

export function isUntilLive(stamp) {
  const combat = globalThis.game?.combat;
  if (!stamp) {
    return false;
  }

  if (!stamp.combatId) {
    return !combat;
  }

  if (!combat || combat.id != stamp.combatId) {
    return false;
  }

  const turns = combat.turns ?? [];
  const theirs = turns.findIndex(c => c.actor?.id == stamp.actorId);
  if (theirs < 0) {
    return combat.round == stamp.round;
  }

  // Live through the rest of the stamping round, and next round until their own turn comes up.
  if (combat.round == stamp.round) {
    return true;
  }

  return combat.round == stamp.round + 1 && combat.turn < theirs;
}

/** The Roll Options Dialog's source id for one of ours (extensions.mjs prefixes 'ext-'). */
export const kept = (options, id) => !(options?.disabledModifierSourceIds ?? []).includes(`ext-${id}`);

/** Edge cancels a Snag first. */
export function giveEdge(options) {
  if (options.snag) {
    options.snag = false;
  } else {
    options.edge = true;
  }
}

export function giveSnag(options) {
  if (options.edge) {
    options.edge = false;
  } else {
    options.snag = true;
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

export const isRanged = item => item?.type == 'weaponEffect' && item.system?.classification?.style
  && item.system.classification.style != 'melee';
export const isMeleeEffect = item => item?.type == 'weaponEffect' && item.system?.classification?.style == 'melee';

/** Transient per-actor state carried from the Roll Options Dialog to the hit riders of the same roll. */
const PENDING = new Map();
export const pending = actor => PENDING.get(actor?.uuid) ?? {};
export function setPending(actor, data) {
  if (actor?.uuid) {
    PENDING.set(actor.uuid, { ...pending(actor), ...data });
  }
}

export function clearPending(actor) {
  PENDING.delete(actor?.uuid);
}

/** Whether a weaponEffect is an Area of Effect attack. */
export function isAreaAttack(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  const traits = parentWeaponOf(actor, item)?.system?.traits ?? [];
  return !!item.system?.shape || num(item.system?.radius) > 0 || traits.includes('area');
}

/** The action economy's spend, when combat is running; resolves false when the spend was blocked. */
export async function payAction(actor, cost, source) {
  if (!cost || cost == 'none' || !globalThis.game?.combat) {
    return true;
  }

  const { spend } = await import("../../action-economy.mjs");
  const result = await spend(actor, cost, { source });
  return !result?.blocked;
}
