/**
 * Shared lookups for the situational2 extension (helpers/extensions/situational2/situational2.mjs):
 * the items it automates, "does this actor hold/wear it", and the situation checks - terrain,
 * water, land, darkness, StrexCorp - each answering true, false, or null ("nothing on
 * the scene says"), so a roll can apply a known situation automatically and offer a dialog
 * checkbox for an unknown one.
 *
 * The heavier helpers (environment.mjs, vessel lookups) are filled into `deps` at init by
 * situational2.mjs with dynamic imports, so this file imports nothing that can loop back.
 */

// Several of these ids exist in more than one pack (the MLP CRB clothing and the PR Weatherproof are
// copies of the GI Joe CRB entries), so items are matched by their compendium _id, not the full uuid.
export const S2 = {
  competitive: 'Vk2EFSSBfmunP5fk',
  misplacedConfidence: 'LcKUw5rQd19ovk4I',
  takeInAScene: 'gT6SEHJIK6ob0v7T',
};

export const FLAG = {
  competitive: 's2CompetitiveSnag',
  misplaced: 's2MisplacedConfidence',
};

/** Filled at init (situational2.mjs#loadDeps) - tests set them directly. */
export const deps = {
  getTerrain: () => null,
  getEnvironment: () => 'normal',
  getSceneEpoch: () => 0,
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? '';
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

/** Same side: both tokens share a disposition, or (no tokens) both are Player Characters. */
export function sameSide(a, b) {
  const ta = tokenDocOf(a);
  const tb = tokenDocOf(b);
  if (ta && tb && ta.disposition !== undefined && tb.disposition !== undefined) {
    return ta.disposition === tb.disposition;
  }

  return a?.type == 'playerCharacter' && b?.type == 'playerCharacter';
}
