import { hasVehicleUpgrade, VU } from "./vehicle-upgrades.mjs";
import {
  ENVIRONMENT_EFFECT_PREFIX, ENVIRONMENT_REGION_BEHAVIOR_TYPE, getSceneEnvironment, getTerrain, isInRoughTerrain,
  ROUGH_TERRAIN_EFFECT,
} from "./environment.mjs";
import { hasActiveEnvironmentalExpertise } from "./environmental-expertise.mjs";
import { actorHasPerk } from "./perks.mjs";

/**
 * Rough Terrain (GI Joe CRB p.219; TF CRB, PR CRB and MLP CRB say the same): "Moving through rough
 * terrain doubles Movement cost, cumulative with other Movement penalties... Rough terrain
 * penalties do not stack no matter how many types are present."
 *
 * A GM marks it by ticking Rough Terrain on an Environment Region Behavior
 * (helpers/environment.mjs). That Behavior feeds Foundry v14's own terrain-aware movement
 * measuring, so the doubled cost shows up in the ruler, in pathfinding and in each token's
 * measured movementHistory - which is what helpers/token-movement.mjs already checks a Move
 * against, so the action economy charges for it with no code of its own. Essence20TerrainData
 * below is the one place the doubling happens:
 *   - Once, however many Rough Terrain Regions overlap (RAW "do not stack"), still multiplying with
 *     any core "Modify Movement Cost" Region a GM also drew ("cumulative with other penalties").
 *   - Not for a token whose actor ignores Rough Terrain (ignoresRoughTerrain below), or while
 *     flying: the MLP CRB (p.103) says Rough Terrain doesn't affect fliers unless the air itself is
 *     turbulent, and no other line says otherwise - a GM can model turbulence with a core Modify
 *     Movement Cost Region instead.
 *
 * Things that MAKE Rough Terrain create a Region with the flag set: a Wrecker weapon's miss
 * (applyWreckerRoughTerrain) and the Piledriver's Alt Mode (offerPiledriverRoughTerrain). A player
 * can't create a Region with a Behavior (v14 BaseRegion#canCreate is GM-only for those), so a
 * player's request is relayed to the active GM over the system socket.
 */

// How much Rough Terrain multiplies Movement cost.
export const ROUGH_TERRAIN_COST_MULTIPLIER = 2;

// v14 movement actions that never pay for Rough Terrain - see this file's own doc comment.
const EXEMPT_MOVEMENT_ACTIONS = ['fly', 'blink', 'displace'];
// Teleport-style actions that cross no ground at all, so no environment cost applies either.
const TELEPORT_MOVEMENT_ACTIONS = ['blink', 'displace'];

/* Environment Movement costs (Across the Stars, Exploring Infinite Environments, p.24):
   High Gravity: "Movement is counted at 3 feet for every 1 foot traveled".
   Thick Atmosphere: "all Movement types treat the area as Rough Terrain" - so flying pays it too,
   unlike ordinary Rough Terrain, but the usual "ignore Rough Terrain" grants still apply and it
   doesn't stack with a Rough Terrain Region.
   The environment is the Region's own (EnvironmentRegionBehaviorType#_getTerrainEffects) or, with
   no Environment Region under the segment, the scene's default. */
export const ENVIRONMENT_MOVEMENT_COST = { highGravity: 3 };
const ROUGH_ENVIRONMENTS = ['thickAtmosphere'];
// Sputtering (Across the Stars, Space Vessel Condition, p.26): "The vessel treats its non-Ground
// Movement as if moving through Rough Terrain."
const NON_GROUND_MOVEMENT_ACTIONS = ['fly', 'swim', 'burrow'];

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const TF_CRB = "Compendium.essence20.tf_crb.Item.";
const ENIGMA_OF_COMBINATION = "Compendium.essence20.enigma_of_combination.Item.";

// Take Point (TF CRB, Outrider Origin Benefit, p.52): "You never suffer the negative effects of
// Rough Terrain, and on any turn in which you end your move in Rough Terrain, you are considered to
// be in Cover until the beginning of your next turn." The Cover half is hasTakePointCover below.
export const TAKE_POINT_ID = `${TF_CRB}efPOy3Owf2XIAykS`;
// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38): "...are
// unimpeded by rough terrain."
const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";
// Sewer Tunneler (Hawk's Personnel Files p.177): "In an urban environment, you ignore Rough
// Terrain." - the scene's terrain (helpers/environment.mjs#getTerrain) says whether it's urban.
const SEWER_TUNNELER_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.gCbl6p64cEJjF2eJ";
// Urban Jungle (Cobra Codex, Vanguard Citystriker Focus, 3rd level, p.68): "when in urban
// environments... You ignore the penalties for moving through Rough Terrain."
const URBAN_JUNGLE_ID = "Compendium.essence20.cobra_codex.Item.wIesQd7U5W2azAWY";
// Feet Wet (Quartermaster's Guide to Gear p.25): "while on board an aquatic vessel or in a sea
// environment... You ignore the penalties for moving through Rough Terrain." Only the "sea
// environment" half is checkable (the scene's terrain); being aboard a vessel isn't tracked.
const FEET_WET_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7u3xCPPjxJlI7c61";
// Hard Tread Wheels (Enigma of Combination, Combiner Feature, p.56): "Alt Mode: You ignore Rough
// Terrain..." and Clawed Feet (same page): "Alt Mode: You ignore Rough Terrain." Both are `gear`
// items, so they're matched by source id without actorHasPerk's perk-only type filter.
const HARD_TREAD_WHEELS_ID = `${ENIGMA_OF_COMBINATION}ia0rEwWo5WP1zH58`;
const CLAWED_FEET_ID = `${ENIGMA_OF_COMBINATION}uDCcdAjDkKdDdlAm`;
// Environmental Expertise (GI Joe CRB, Ranger base, p.90): "You ignore the penalties for moving
// through Rough Terrain in your environment of expertise." Read through
// hasActiveEnvironmentalExpertise, so it follows the scene's terrain when one is set.
const ENVIRONMENTAL_EXPERTISE_ID = `${GI_JOE_CRB}EbbSUA2vSHyv3MjQ`;
// Piledriver (TF CRB, Alt Mode gear, p.135): "Alt Mode: As a Free action, you can change one space
// within Reach of normal terrain into Rough Terrain."
export const PILEDRIVER_ID = `${TF_CRB}e4VcKpeXMlHOBkPV`;

// Vehicle Traits whose printed text is "...ignores Rough Terrain" (Heavy Wheels, 6-Wheel Drive -
// Ferocious Fighters; All-Terrain wheels/tracks - Quartermaster's Guide to Gear, Sgt. Slaughter's
// Marauders). Plain "Treads" is left out: some stat blocks print it as "ignores Rough Terrain",
// others as only "Edge on Driving Skill Tests in Rough Terrain", so the key alone can't say which.
const ROUGH_TERRAIN_IGNORING_VEHICLE_TRAITS = ['allTerrain', 'heavyWheels', 'SixWheelDrive'];

/**
 * Whether an actor holds an Item (of any type) copied from the given compendium entry.
 * @param {Actor} actor
 * @param {String} sourceId
 * @returns {Boolean}
 * @private
 */
function _hasItemFrom(actor, sourceId) {
  return !!actor?.items?.some?.(item =>
    item.flags?.core?.sourceId == sourceId || item._stats?.compendiumSource == sourceId);
}

const isAltMode = actor => actor.system?.isTransformed === true;
const isUrban = actor => getTerrain(actor) == 'urban';

// Every "ignore Rough Terrain" grant this file knows how to check, each `{id, isActive?, anyItem?}`
// or `{checkFn}` - the same table shape helpers/condition-immunity.mjs uses. Deliberately NOT here:
// Aggressive / Wrecking Ball / Plow (ignore it only during one specific Story-Point / Sprint / Ram
// move - no per-move hook to scope them to), and NPC-only stat-block perks with no compendium item.
const ROUGH_TERRAIN_IGNORERS = [
  // Wrecking Ball (GI Joe CRB, Juggernaut, 17th level, p.112): "You ignore Rough Terrain" for the
  // Sprint it was bought for - helpers/target-riders.mjs.
  { checkFn: actor => isWreckingBallFlagActive(actor) },
  // All-Terrain Steel-Reinforced Wheels (Quartermaster's Guide p.57): "The vehicle ignores Rough
  // Terrain."
  { id: 'allTerrainWheels', checkFn: actor => hasVehicleUpgrade(actor, VU.allTerrainWheels) },
  { id: ENVIRONMENTAL_EXPERTISE_ID, checkFn: hasActiveEnvironmentalExpertise },
  { id: TAKE_POINT_ID },
  { id: OVER_THE_CANDLESTICK_ID },
  { id: SEWER_TUNNELER_ID, isActive: isUrban },
  { id: URBAN_JUNGLE_ID, isActive: isUrban },
  { id: FEET_WET_ID, isActive: actor => getTerrain(actor) == 'sea' },
  { id: HARD_TREAD_WHEELS_ID, anyItem: true, isActive: isAltMode },
  { id: CLAWED_FEET_ID, anyItem: true, isActive: isAltMode },
  {
    checkFn: actor => actor.type == 'vehicle'
      && ROUGH_TERRAIN_IGNORING_VEHICLE_TRAITS.some(trait => actor.system?.traits?.[trait]),
  },
];

/**
 * Whether this actor currently ignores Rough Terrain, via any grant in ROUGH_TERRAIN_IGNORERS.
 * @param {Actor} actor
 * @returns {Boolean}
 */
/**
 * Wrecking Ball's flag, stamped for the turn it was used.
 */
function isWreckingBallFlagActive(actor) {
  const stamp = actor?.flags?.essence20?.wreckingBall;
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

export function ignoresRoughTerrain(actor) {
  if (!actor) {
    return false;
  }

  return ROUGH_TERRAIN_IGNORERS.some(entry => {
    if (entry.checkFn) {
      return !!entry.checkFn(actor);
    }

    const holds = entry.anyItem ? _hasItemFrom(actor, entry.id) : actorHasPerk(actor, entry.id);
    return holds && (!entry.isActive || entry.isActive(actor));
  });
}

/**
 * Whether a token moving with the given v14 movement action pays the Rough Terrain cost at all.
 * @param {TokenDocument} tokenDoc
 * @param {String} [action]   A CONFIG.Token.movement.actions key (walk, fly, swim...).
 * @returns {Boolean}
 */
export function paysRoughTerrainCost(tokenDoc, action) {
  if (EXEMPT_MOVEMENT_ACTIONS.includes(action)) {
    return false;
  }

  return !ignoresRoughTerrain(tokenDoc?.actor);
}

/**
 * The Movement cost multiplier one path segment's terrain applies: its own core difficulty (a
 * "Modify Movement Cost" Region), times ROUGH_TERRAIN_COST_MULTIPLIER once if any Rough Terrain
 * Region covers it and the token pays for it.
 * @param {?{difficulty: Number, roughTerrain: Boolean}} terrain   The segment's resolved terrain.
 * @param {TokenDocument} tokenDoc
 * @param {String} [action]
 * @returns {Number}
 */
export function getTerrainCostMultiplier(terrain, tokenDoc, action) {
  const difficulty = terrain?.difficulty ?? 1;
  const teleport = TELEPORT_MOVEMENT_ACTIONS.includes(action);
  const environment = terrain?.environment || getSceneEnvironment(tokenDoc?.parent);
  const environmentCost = teleport ? 1 : (ENVIRONMENT_MOVEMENT_COST[environment] ?? 1);
  const rough = (terrain?.roughTerrain && paysRoughTerrainCost(tokenDoc, action))
    || (!teleport && ROUGH_ENVIRONMENTS.includes(environment) && !ignoresRoughTerrain(tokenDoc?.actor))
    || (NON_GROUND_MOVEMENT_ACTIONS.includes(action) && !!tokenDoc?.actor?.statuses?.has?.('sputtering'));
  return difficulty * environmentCost * (rough ? ROUGH_TERRAIN_COST_MULTIPLIER : 1);
}

/**
 * The worst environment among a segment's Environment Region effects (highest Movement cost, then a
 * Rough Terrain environment, then any other), or "" when no Environment Region sets one. With several
 * overlapping Regions the costlier one is the safe reading - the ruler errs toward what the book charges.
 * @param {Array<{name: String}>} effects
 * @returns {String}
 */
export function resolveEnvironmentEffect(effects) {
  const environments = effects
    .filter(effect => effect.name?.startsWith(ENVIRONMENT_EFFECT_PREFIX))
    .map(effect => effect.name.slice(ENVIRONMENT_EFFECT_PREFIX.length));
  const rank = env => (ENVIRONMENT_MOVEMENT_COST[env] ?? 1) * 2 + (ROUGH_ENVIRONMENTS.includes(env) ? 1 : 0);
  environments.sort((a, b) => rank(b) - rank(a));
  return environments[0] ?? "";
}

/**
 * Take Point's Cover half (see TAKE_POINT_ID): a target holding it who's standing in Rough Terrain
 * counts as in Cover. "Ended your move there this turn, until your next turn" is read as "is in it
 * now" - the position a ranged attacker sees.
 * @param {Actor} targetActor
 * @param {Token|TokenDocument} [targetToken]
 * @returns {Boolean}
 */
export function hasTakePointCover(targetActor, targetToken) {
  return actorHasPerk(targetActor, TAKE_POINT_ID) && isInRoughTerrain(targetToken ?? targetActor);
}

/**
 * Builds the terrain-data class this system installs as CONFIG.Token.movement.TerrainData (see
 * essence20.mjs's init hook): core's TerrainData plus a `roughTerrain` flag. Built on demand from
 * the live core class rather than at import, so this file stays importable in unit tests.
 * @param {typeof foundry.data.TerrainData} TerrainData   Core's own TerrainData class.
 * @returns {Class}
 */
export function makeEssence20TerrainData(TerrainData) {
  return class Essence20TerrainData extends TerrainData {
    /** @override */
    static defineSchema() {
      return {
        ...super.defineSchema(),
        roughTerrain: new foundry.data.fields.BooleanField({ initial: false }),
        // The segment's own Environment Region environment ("" = the scene's default) - see
        // resolveEnvironmentEffect.
        environment: new foundry.data.fields.StringField({ required: true, blank: true, initial: "" }),
      };
    }

    /**
     * Rough Terrain counts once however many overlapping Regions supply it; core "difficulty"
     * effects still multiply as core resolves them. The environment is resolveEnvironmentEffect's.
     * @override
     */
    static resolveTerrainEffects(effects, options) {
      const isOwn = effect => effect.name == ROUGH_TERRAIN_EFFECT || effect.name?.startsWith(ENVIRONMENT_EFFECT_PREFIX);
      const roughTerrain = effects.some(effect => effect.name == ROUGH_TERRAIN_EFFECT);
      const environment = resolveEnvironmentEffect(effects);
      const base = super.resolveTerrainEffects(effects.filter(effect => !isOwn(effect)), options);
      if (!roughTerrain && !environment) {
        return base;
      }

      return new this({ difficulty: base?.difficulty ?? 1, roughTerrain, environment });
    }

    /** @override */
    static getMovementCostFunction(token, _options) {
      return (from, to, distance, segment) =>
        distance * getTerrainCostMultiplier(segment.terrain, token, segment.action);
    }

    /** @override */
    equals(other) {
      return super.equals(other) && !!other.roughTerrain == !!this.roughTerrain
        && (other.environment ?? "") == (this.environment ?? "");
    }
  };
}

// CONST.REGION_VISIBILITY.GAMEMASTER (v14), for when CONST isn't loaded (unit tests).
const GAMEMASTER_VISIBILITY = 1;

/**
 * The Region data for a Rough Terrain area.
 * @param {Array<Object>} shapes   Region shape data.
 * @param {String} name
 * @returns {Object}
 */
export function buildRoughTerrainRegionData(shapes, name) {
  return {
    name,
    color: "#8b5a2b",
    // Always shown to the GM, not only while the Regions layer is open - these appear on their own
    // mid-fight (Wrecker, Piledriver), so the GM should see where they landed.
    visibility: globalThis.CONST?.REGION_VISIBILITY?.GAMEMASTER ?? GAMEMASTER_VISIBILITY,
    shapes,
    behaviors: [{
      type: ENVIRONMENT_REGION_BEHAVIOR_TYPE,
      name,
      system: { environment: "", terrain: "", roughTerrain: true },
    }],
  };
}

/**
 * A rectangle shape covering a token's own footprint.
 * @param {TokenDocument} tokenDoc
 * @returns {Object}
 */
export function getTokenFootprintShape(tokenDoc) {
  const gridSize = tokenDoc.parent?.grid?.size ?? tokenDoc.parent?.dimensions?.size ?? 100;
  return {
    type: "rectangle",
    x: tokenDoc.x,
    y: tokenDoc.y,
    width: (tokenDoc.width ?? 1) * gridSize,
    height: (tokenDoc.height ?? 1) * gridSize,
  };
}

/**
 * Creates a Rough Terrain Region on a scene - directly for a GM, otherwise by asking the active GM
 * (a player may not create a Region carrying a Behavior).
 * @param {Scene} scene
 * @param {Array<Object>} shapes
 * @param {String} name
 * @returns {Promise<void>}
 */
export async function createRoughTerrainRegion(scene, shapes, name) {
  if (!scene || !shapes?.length) {
    return;
  }

  if (game.user?.isGM) {
    await scene.createEmbeddedDocuments("Region", [buildRoughTerrainRegionData(shapes, name)]);
    return;
  }

  game.socket.emit("system.essence20", { action: "createRoughTerrain", sceneUuid: scene.uuid, shapes, name });
}

/**
 * GM-side handler for createRoughTerrainRegion's socket request. Only the active GM acts, so
 * several connected GMs don't each create a copy.
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function handleCreateRoughTerrainRequest(data) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const scene = await fromUuid(data.sceneUuid);
  await scene?.createEmbeddedDocuments("Region", [buildRoughTerrainRegionData(data.shapes, data.name)]);
}

/**
 * Wrecker (GI Joe CRB, Weapon Effects and Traits, p.148): "On a miss, the area targeted becomes
 * rough terrain." After an attack with a Wrecker weapon, each missed target's own space becomes a
 * Rough Terrain Region (skipped where it already is Rough Terrain). "The area targeted" is read as
 * the target's own footprint - an area-of-effect Wrecker weapon's whole area isn't recorded on the
 * roll. Called from dice.mjs#_rollSkillHelper's post-roll processing.
 * @param {Actor} actor   The attacker.
 * @param {Array<Object>} results   The per-target result rows ({success, targetUuid}).
 * @param {Object} checkContext   Carries isAttack and the weaponEffect's itemUuid.
 * @returns {Promise<Number>}   How many Regions were requested.
 */
export async function applyWreckerRoughTerrain(actor, results, checkContext) {
  if (!checkContext?.isAttack || !checkContext.itemUuid) {
    return 0;
  }

  const weaponEffect = await fromUuid(checkContext.itemUuid);
  const parentId = weaponEffect?.flags?.essence20?.parentId;
  const weapon = parentId ? actor.items?.get?.(parentId) : null;
  if (!weapon?.system?.traits?.includes('wrecker')) {
    return 0;
  }

  const targetNames = [];
  for (const result of results ?? []) {
    if (result.success || !result.targetUuid) {
      continue;
    }

    const target = await fromUuid(result.targetUuid);
    const tokenDoc = target?.token ?? target?.getActiveTokens?.(false, true)?.[0];
    if (!tokenDoc?.parent || isInRoughTerrain(tokenDoc)) {
      continue;
    }

    await createRoughTerrainRegion(tokenDoc.parent, [getTokenFootprintShape(tokenDoc)],
      game.i18n.format('E20.RoughTerrainWreckerRegionName', { weapon: weapon.name }));
    targetNames.push(tokenDoc.name ?? target.name);
  }

  // Say so in chat - otherwise the new Rough Terrain appears on the map with no explanation.
  if (targetNames.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format('E20.RoughTerrainWreckerChat', { weapon: weapon.name, targets: targetNames.join(', ') }),
    });
  }

  return targetNames.length;
}

/**
 * Wrecker on an automatic failure: an attack shifted down to auto-fail or Fumble never reaches the
 * per-target roll, so it has no results - but it still misses every target (user ruling,
 * 2026-09-26), so each target's space becomes Rough Terrain the same as an ordinary miss.
 * @param {Actor} actor
 * @param {Item} item                         The weaponEffect being rolled.
 * @param {Iterable<Token>} targets           The attacker's current targets.
 * @returns {Promise<Number>}                 How many Regions were created.
 */
export async function applyWreckerOnAutoFail(actor, item, targets) {
  if (item?.type != 'weaponEffect') {
    return 0;
  }

  const results = [...(targets ?? [])]
    .map(token => ({ success: false, targetUuid: token.actor?.uuid ?? null }))
    .filter(result => result.targetUuid);
  return applyWreckerRoughTerrain(actor, results, { isAttack: true, itemUuid: item.uuid });
}

/**
 * Whether an Item is the Piledriver (see PILEDRIVER_ID).
 * @param {Item} item
 * @returns {Boolean}
 */
export function isPiledriver(item) {
  return item?.flags?.core?.sourceId == PILEDRIVER_ID || item?._stats?.compendiumSource == PILEDRIVER_ID;
}

/**
 * Piledriver (see PILEDRIVER_ID): offered when the gear is posted to chat from the sheet (its only
 * sheet action) while the owner is in Alt Mode - asks whether to use it, then lets the player place
 * a one-space Rough Terrain area on the canvas. "Within Reach" is left to the player, as for any
 * placed area.
 * @param {Actor} actor
 * @param {Item} item   The Piledriver gear item.
 * @returns {Promise<Boolean>}   Whether a Region was requested.
 */
export async function offerPiledriverRoughTerrain(actor, item) {
  if (!isAltMode(actor ?? {}) || !canvas?.ready || !canvas.scene) {
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: item.name },
    content: `<p>${game.i18n.localize('E20.RoughTerrainPiledriverPrompt')}</p>`,
  });
  if (!confirmed) {
    return false;
  }

  const gridSize = canvas.scene.grid.size;
  const placed = await canvas.regions.placeRegion({
    name: item.name,
    shapes: [{ type: "rectangle", x: 0, y: 0, width: gridSize, height: gridSize, gridBased: true }],
  }, { create: false, allowRotation: false });
  if (!placed) {
    return false;
  }

  const shapes = placed.shapes.map(shape => (shape.toObject ? shape.toObject() : shape));
  await createRoughTerrainRegion(canvas.scene, shapes, item.name);
  // Same chat record Wrecker posts, so the new Rough Terrain is announced rather than just appearing.
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: game.i18n.format('E20.RoughTerrainPiledriverChat', { name: actor?.name ?? '', item: item.name }),
  });
  return true;
}
