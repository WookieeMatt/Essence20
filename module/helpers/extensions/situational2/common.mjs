/**
 * Shared lookups for the situational2 extension (helpers/extensions/situational2/situational2.mjs):
 * the items it automates, "does this actor hold/wear it", and the situation checks - terrain,
 * water, land, darkness, libraries, StrexCorp - each answering true, false, or null ("nothing on
 * the scene says"), so a roll can apply a known situation automatically and offer a dialog
 * checkbox for an unknown one.
 *
 * The heavier helpers (environment.mjs, vessel lookups) are filled into `deps` at init by
 * situational2.mjs with dynamic imports, so this file imports nothing that can loop back.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

// Several of these ids exist in more than one pack (the MLP CRB clothing and the PR Weatherproof are
// copies of the GI Joe CRB entries), so items are matched by their compendium _id, not the full uuid.
export const S2 = {
  stumbleThroughTheCity: 'sTmqok0MEmOQeboN',
  ambushProne: 'k4gjxfSo6BkE6wd0',
  arcticExpedition: 'pWRpmsOcWIv9trHP',
  competitive: 'Vk2EFSSBfmunP5fk',
  desertExpedition: 'SQzr6PhXZQ338BBh',
  forgiving: '985JSL4ANRcKb1EX',
  misplacedConfidence: 'LcKUw5rQd19ovk4I',
  stubbornlyLoyal: 'zqsFMIRKaA0Ev62Y',
  takeInAScene: 'gT6SEHJIK6ob0v7T',
  caltrops: 'LN0w8SB1fHhidIVp',
  amphibiousAssault: 'X2atZm3eoIBJcwF6',
  rifleTritium: 'zIyTgNkWkKUcWBSR',
  seafarerHangUp: 'ahWxUG3w6KkfgUDw',
  seafarer: 'vZjp9ncpzhgLIzSm',
  sharksFin: 'c3tBbGzXDar3DA1E',
  shipShape: 'MejI6WIShcA0GdoW',
  feetWet: '7u3xCPPjxJlI7c61',
  tritiumSights: 'dyNyzaagojOboB3y',
  cartographySuite: 'l2dioJyakPropGEx',
  layOfTheLand: 'CTt9gmibpffGC0N4',
  plow: 'y7VBydpKD8O63C3b',
  bookworm: 'p2Qk0B5PWp10ZaqN',
  business: '6Vke4qKEaYjjRWQt',
  desertGear: 'tv0pOgALa608pw8i',
  trackingOutfit: 'NHhNnkBBM29NpGpL',
};

export const S2_UUID = {
  bookworm: uuid('wtnv_citizens_guide', S2.bookworm),
};

export const FLAG = {
  competitive: 's2CompetitiveSnag',
  forgiving: 's2ForgivingAggressors',
  misplaced: 's2MisplacedConfidence',
  plowRam: 's2PlowRam',
  survey: 's2CartographySurvey',
};

/** Filled at init (situational2.mjs#loadDeps) - tests set them directly. */
export const deps = {
  getTerrain: () => null,
  getEnvironment: () => 'normal',
  getSceneEpoch: () => 0,
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? '';
}

export const idOf = value => String(value ?? '').split('.').pop();

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/**
 * The actor's item copied from the given compendium _id, optionally of one type. A Hang-Up ignored
 * through Matured (helpers/matured.mjs) doesn't count, same as perks.mjs#findHangUp.
 * @param {Actor} actor
 * @param {String} id
 * @param {String} [type]
 * @returns {?Item}
 */
export function findById(actor, id, type = null) {
  return itemsOf(actor).find(item => (!type || item.type == type)
    && idOf(sourceOf(item)) == id
    && !(item.type == 'hangUp' && item.flags?.essence20?.maturedIgnored)) ?? null;
}

export const has = (actor, id, type = null) => !!findById(actor, id, type);

/** Worn gear (the gear data model's own `equipped`, true by default). */
export function wornGear(actor, id) {
  const item = findById(actor, id, 'gear');
  return item && item.system?.equipped !== false ? item : null;
}

/* -------------------------------------------- */
/*  Where the actor is                          */
/* -------------------------------------------- */

export function tokenDocOf(actor) {
  const active = actor?.getActiveTokens?.(false, true)?.[0];
  if (active) {
    return active;
  }

  const scene = globalThis.canvas?.scene ?? game?.scenes?.viewed ?? null;
  return scene?.tokens?.find?.(token => token.actorId == actor?.id || token.actor == actor) ?? null;
}

export function sceneOf(actor) {
  return tokenDocOf(actor)?.parent ?? globalThis.canvas?.scene ?? game?.scenes?.viewed ?? null;
}

export const terrainOf = actor => deps.getTerrain(actor) ?? null;

/** Urban terrain: true/false when the scene says, null when no terrain is set. */
export function isUrban(actor) {
  const terrain = terrainOf(actor);
  return terrain ? terrain == 'urban' : null;
}

/** "In the wild" (Tracking Outfit) - any terrain the GM set that isn't urban. */
export function isWild(actor) {
  const terrain = terrainOf(actor);
  return terrain ? terrain != 'urban' : null;
}

/** The first vehicle this actor crews, with their seat. */
export function crewedVehicle(actor) {
  if (!actor?.uuid) {
    return null;
  }

  const actors = game?.actors;
  const list = Array.isArray(actors?.contents) ? actors.contents : (actors && typeof actors[Symbol.iterator] == 'function' ? [...actors] : []);
  for (const vehicle of list) {
    if (vehicle?.type != 'vehicle') {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

/** A vehicle with an Aquatic Movement - an "aquatic vessel". */
export function isAquaticVehicle(vehicle) {
  const swim = vehicle?.system?.movement?.swim;
  return vehicle?.type == 'vehicle' && ((swim?.base ?? 0) > 0 || (swim?.total ?? 0) > 0);
}

export const isAboardAquaticVessel = actor => isAquaticVehicle(crewedVehicle(actor)?.vehicle);

/** In the water: underwater environment, or the token moving by swimming. */
export function isInWater(actor) {
  return deps.getEnvironment(actor) == 'underwater' || tokenDocOf(actor)?.movementAction == 'swim';
}

/**
 * On land (Seafarer's Hang-Up): not in the water, not at sea, not aboard an aquatic vessel.
 * @returns {Boolean}
 */
export function isOnLand(actor) {
  return !isInWater(actor) && terrainOf(actor) != 'sea' && !isAboardAquaticVessel(actor);
}

/** Sea or wetlands (Shark's Fin), or aboard an aquatic vessel. */
export function isSeaOrWetlands(actor) {
  return ['sea', 'wetlands'].includes(terrainOf(actor)) || isAboardAquaticVessel(actor);
}

/**
 * Complete darkness: the scene's own darkness level at full. Anything less may still be dark where
 * the token stands (a darkness Region, no light source), so that answers null - "ask".
 * @returns {?Boolean}
 */
export function isCompleteDarkness(actor) {
  const scene = sceneOf(actor);
  const level = scene?.environment?.darknessLevel ?? scene?.darkness;
  return typeof level == 'number' && level >= 0.95 ? true : null;
}

function tagsOf(actor) {
  const typed = actor?.system?.creatureTags;
  return (Array.isArray(typed) ? typed : String(typed ?? '').split(',')).map(tag => String(tag).trim().toLowerCase());
}

const nameMatches = (doc, pattern) => pattern.test(String(doc?.name ?? ''));

/** A Librarian (WTNV) - by creature tag or name. */
export function isLibrarian(actor) {
  return !!actor && (tagsOf(actor).includes('librarian') || nameMatches(actor, /librarian/i));
}

/** A StrexCorp agent (WTNV) - by creature tag or name. */
export function isStrexAgent(actor) {
  return !!actor && (tagsOf(actor).some(tag => tag.startsWith('strex')) || nameMatches(actor, /strex/i));
}

/**
 * Bookworm's "in a library or facing a Librarian": true when the targeted creature is a Librarian
 * or the scene is named as a library, else null.
 */
export function isLibrarySituation(actor, target) {
  if (isLibrarian(target) || nameMatches(sceneOf(actor), /librar/i)) {
    return true;
  }

  return null;
}

/** The first targeted token's actor on this client. */
export function currentTarget() {
  const targets = game?.user?.targets;
  const first = targets?.first?.() ?? (targets && typeof targets[Symbol.iterator] == 'function' ? [...targets][0] : null);
  return first?.actor ?? null;
}

/** Same side: both tokens share a disposition, or (no tokens) both are Player Characters. */
export function sameSide(a, b) {
  const ta = tokenDocOf(a);
  const tb = tokenDocOf(b);
  if (ta && tb && ta.disposition !== undefined && tb.disposition !== undefined) {
    return ta.disposition === tb.disposition;
  }

  return a?.type == 'playerCharacter' && b?.type == 'playerCharacter';
}

/** A weaponEffect's parent weapon on the same actor. */
export function parentWeapon(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}

export function weaponHasUpgradeId(actor, weapon, id) {
  return !!weapon && itemsOf(actor).some(item => item.type == 'upgrade'
    && item.flags?.essence20?.parentId == weapon.id && idOf(sourceOf(item)) == id);
}
