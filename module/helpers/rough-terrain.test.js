import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { ENVIRONMENT_EFFECT_PREFIX, ENVIRONMENT_REGION_BEHAVIOR_TYPE, ROUGH_TERRAIN_EFFECT, getTerrain } from './environment.mjs';
import { setWorldLookups } from '../rules/predicate.mjs';
import {
  resolveEnvironmentEffect,
  applyWreckerOnAutoFail, applyWreckerRoughTerrain, buildRoughTerrainRegionData, createRoughTerrainRegion, getTerrainCostMultiplier,
  getTokenFootprintShape, handleCreateRoughTerrainRequest, hasTakePointCover, ignoresRoughTerrain, isPiledriver,
  makeEssence20TerrainData, offerPiledriverRoughTerrain, paysRoughTerrainCost, PILEDRIVER_ID, TAKE_POINT_ID,
} from './rough-terrain.mjs';

const perk = sourceId => ({ type: 'perk', flags: { core: { sourceId } } });
// An item carrying its pack's rules (MovementAction), the way a character's copy does.
let ruledId = 1;
const ruled = (file, type = 'perk') => ({ id: `ruled${ruledId++}`, type, flags: {}, system: { rules: JSON.parse(readFileSync(`packs/${file}`, 'utf8')).system.rules } });
setWorldLookups({ terrain: actor => getTerrain(actor) });

const ENVIRONMENTAL_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ";
const OVER_THE_CANDLESTICK = 'tsitems/_source/Over_the_Candlestick_zKngKkwDyNv2nnH5.json';
const SEWER_TUNNELER = 'ghpfitems/_source/Sewer_Tunneler_gCbl6p64cEJjF2eJ.json';
const URBAN_JUNGLE = 'ccitems/_source/Urban_Jungle_wIesQd7U5W2azAWY.json';
const FEET_WET_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.7u3xCPPjxJlI7c61";
const HARD_TREAD_WHEELS = 'eocitems/_source/Hard_Tread_Wheels_ia0rEwWo5WP1zH58.json';
const CLAWED_FEET = 'eocitems/_source/Clawed_Feet_uDCcdAjDkKdDdlAm.json';

// A scene tagged with a terrain and one token on it, optionally inside Rough Terrain.
function makeTokenDoc({ terrain, rough = false, actor = null } = {}) {
  const scene = {
    uuid: 'Scene.s1',
    grid: { size: 100 },
    getFlag: (scope, key) => (key == 'terrain' ? terrain : undefined),
    createEmbeddedDocuments: jest.fn(async () => []),
  };
  const region = {
    behaviors: [{ type: ENVIRONMENT_REGION_BEHAVIOR_TYPE, disabled: false, system: { roughTerrain: rough } }],
  };
  scene.regions = [region];
  return { documentName: 'Token', regions: rough ? [region] : [], parent: scene, x: 200, y: 300, width: 2, height: 1, actor };
}

function makeActor({ items = [], terrain, transformed = false, type = 'character', system = {}, flags = {} } = {}) {
  const actor = {
    type,
    items,
    documentName: 'Actor',
    system: { isTransformed: transformed, ...system },
    getFlag: (scope, key) => flags[key],
  };
  const tokenDoc = makeTokenDoc({ terrain, actor });
  actor.getActiveTokens = () => [tokenDoc];
  return actor;
}

describe("ignoresRoughTerrain", () => {
  test("nothing ignores it by default, and a missing actor never does", () => {
    expect(ignoresRoughTerrain(makeActor())).toBe(false);
    expect(ignoresRoughTerrain(null)).toBe(false);
  });

  test("Take Point and Over the Candlestick ignore it unconditionally", () => {
    expect(ignoresRoughTerrain(makeActor({ items: [perk(TAKE_POINT_ID)] }))).toBe(true);
    expect(ignoresRoughTerrain(makeActor({ items: [ruled(OVER_THE_CANDLESTICK)] }))).toBe(true);
  });

  test("Environmental Expertise ignores it in an environment of expertise", () => {
    const system = { environments: ['woodlands'] };
    expect(ignoresRoughTerrain(makeActor({ items: [perk(ENVIRONMENTAL_EXPERTISE_ID)], terrain: 'woodlands', system }))).toBe(true);
    expect(ignoresRoughTerrain(makeActor({ items: [perk(ENVIRONMENTAL_EXPERTISE_ID)], terrain: 'desert', system }))).toBe(false);
    // No terrain set: the manual toggle decides, as for every other Environmental Expertise benefit.
    expect(ignoresRoughTerrain(makeActor({
      items: [perk(ENVIRONMENTAL_EXPERTISE_ID)], system, flags: { environmentalExpertiseActive: true },
    }))).toBe(true);
  });

  test("Sewer Tunneler and Urban Jungle ignore it only on urban terrain", () => {
    for (const file of [SEWER_TUNNELER, URBAN_JUNGLE]) {
      expect(ignoresRoughTerrain(makeActor({ items: [ruled(file)], terrain: 'urban' }))).toBe(true);
      expect(ignoresRoughTerrain(makeActor({ items: [ruled(file)], terrain: 'woodlands' }))).toBe(false);
      expect(ignoresRoughTerrain(makeActor({ items: [ruled(file)] }))).toBe(false);
    }
  });

  test("Feet Wet ignores it on sea terrain", () => {
    expect(ignoresRoughTerrain(makeActor({ items: [perk(FEET_WET_ID)], terrain: 'sea' }))).toBe(true);
    expect(ignoresRoughTerrain(makeActor({ items: [perk(FEET_WET_ID)], terrain: 'arctic' }))).toBe(false);
  });

  test("Hard Tread Wheels and Clawed Feet (gear) ignore it only in Alt Mode", () => {
    for (const file of [HARD_TREAD_WHEELS, CLAWED_FEET]) {
      expect(ignoresRoughTerrain(makeActor({ items: [ruled(file, 'gear')], transformed: true }))).toBe(true);
      expect(ignoresRoughTerrain(makeActor({ items: [ruled(file, 'gear')], transformed: false }))).toBe(false);
    }
  });

  test("a vehicle with All-Terrain / Heavy Wheels / 6-Wheel Drive ignores it; plain Treads doesn't", () => {
    for (const trait of ['allTerrain', 'heavyWheels', 'SixWheelDrive']) {
      expect(ignoresRoughTerrain(makeActor({ type: 'vehicle', system: { traits: { [trait]: true } } }))).toBe(true);
    }

    expect(ignoresRoughTerrain(makeActor({ type: 'vehicle', system: { traits: { treads: true } } }))).toBe(false);
    expect(ignoresRoughTerrain(makeActor({ type: 'character', system: { traits: { allTerrain: true } } }))).toBe(false);
  });
});

describe("paysRoughTerrainCost / getTerrainCostMultiplier", () => {
  const walker = { actor: makeActor() };
  const ignorer = { actor: makeActor({ items: [perk(TAKE_POINT_ID)] }) };

  test("walking pays, flying and teleporting don't, and neither does an actor who ignores it", () => {
    expect(paysRoughTerrainCost(walker, 'walk')).toBe(true);
    expect(paysRoughTerrainCost(walker, 'fly')).toBe(false);
    expect(paysRoughTerrainCost(walker, 'blink')).toBe(false);
    expect(paysRoughTerrainCost(ignorer, 'walk')).toBe(false);
  });

  test("doubles once for Rough Terrain, times any core difficulty", () => {
    expect(getTerrainCostMultiplier(null, walker, 'walk')).toBe(1);
    expect(getTerrainCostMultiplier({ difficulty: 1, roughTerrain: true }, walker, 'walk')).toBe(2);
    expect(getTerrainCostMultiplier({ difficulty: 1.5, roughTerrain: true }, walker, 'walk')).toBe(3);
    expect(getTerrainCostMultiplier({ difficulty: 1.5, roughTerrain: false }, walker, 'walk')).toBe(1.5);
    expect(getTerrainCostMultiplier({ difficulty: 1, roughTerrain: true }, ignorer, 'walk')).toBe(1);
    expect(getTerrainCostMultiplier({ difficulty: 1, roughTerrain: true }, walker, 'fly')).toBe(1);
  });
});

describe("Environment Movement costs (Across the Stars p.24) and Sputtering (p.26)", () => {
  const walker = { actor: makeActor() };
  const env = name => ({ name: `${ENVIRONMENT_EFFECT_PREFIX}${name}` });

  test("resolveEnvironmentEffect prefers the costliest environment, blank when none", () => {
    expect(resolveEnvironmentEffect([env('normal'), env('highGravity'), env('thickAtmosphere')])).toBe('highGravity');
    expect(resolveEnvironmentEffect([env('normal'), env('thickAtmosphere')])).toBe('thickAtmosphere');
    expect(resolveEnvironmentEffect([{ name: ROUGH_TERRAIN_EFFECT }])).toBe('');
  });

  test("High Gravity triples every Movement cost but teleporting", () => {
    const terrain = { difficulty: 1, roughTerrain: false, environment: 'highGravity' };
    expect(getTerrainCostMultiplier(terrain, walker, 'walk')).toBe(3);
    expect(getTerrainCostMultiplier(terrain, walker, 'fly')).toBe(3);
    expect(getTerrainCostMultiplier(terrain, walker, 'blink')).toBe(1);
    // Rough Terrain on top still doubles ("cumulative with other Movement penalties").
    expect(getTerrainCostMultiplier({ ...terrain, roughTerrain: true }, walker, 'walk')).toBe(6);
  });

  test("Thick Atmosphere is Rough Terrain for every Movement type, once, and ignorers skip it", () => {
    const terrain = { difficulty: 1, roughTerrain: false, environment: 'thickAtmosphere' };
    expect(getTerrainCostMultiplier(terrain, walker, 'walk')).toBe(2);
    expect(getTerrainCostMultiplier(terrain, walker, 'fly')).toBe(2);
    expect(getTerrainCostMultiplier({ ...terrain, roughTerrain: true }, walker, 'walk')).toBe(2);
    expect(getTerrainCostMultiplier(terrain, { actor: makeActor({ items: [perk(TAKE_POINT_ID)] }) }, 'walk')).toBe(1);
  });

  test("with no Environment Region, the scene's default environment applies; a Region's 'normal' overrides it", () => {
    const tokenDoc = { actor: makeActor(), parent: { getFlag: (scope, key) => (key == 'environment' ? 'highGravity' : undefined) } };
    expect(getTerrainCostMultiplier(null, tokenDoc, 'walk')).toBe(3);
    expect(getTerrainCostMultiplier({ difficulty: 1, environment: 'normal' }, tokenDoc, 'walk')).toBe(1);
  });

  test("a Sputtering vessel pays Rough Terrain on non-Ground Movement only", () => {
    const vessel = makeActor({ type: 'vehicle' });
    vessel.statuses = new Set(['sputtering']);
    expect(getTerrainCostMultiplier(null, { actor: vessel }, 'fly')).toBe(2);
    expect(getTerrainCostMultiplier(null, { actor: vessel }, 'swim')).toBe(2);
    expect(getTerrainCostMultiplier(null, { actor: vessel }, 'walk')).toBe(1);
  });
});

describe("makeEssence20TerrainData", () => {
  // Stand-in for core's TerrainData (client/data/terrain-data.mjs): multiplies "difficulty"
  // effects, null when there's nothing to say.
  class CoreTerrainData {
    constructor(data) {
      Object.assign(this, data);
    }

    static defineSchema() {
      return { difficulty: 'difficultyField' };
    }

    static resolveTerrainEffects(effects) {
      let difficulty = 1;
      for (const effect of effects) {
        if (effect.name == 'difficulty') difficulty *= effect.difficulty;
      }

      return difficulty === 1 ? null : new this({ difficulty });
    }

    equals(other) {
      return other.difficulty === this.difficulty;
    }
  }

  const TerrainData = makeEssence20TerrainData(CoreTerrainData);
  const rough = { name: ROUGH_TERRAIN_EFFECT };

  test("adds a roughTerrain field to core's schema", () => {
    expect(Object.keys(TerrainData.defineSchema())).toEqual(['difficulty', 'roughTerrain', 'environment']);
  });

  test("Rough Terrain counts once however many Regions overlap", () => {
    const terrain = TerrainData.resolveTerrainEffects([rough, rough, rough]);
    expect(terrain).toMatchObject({ difficulty: 1, roughTerrain: true });
  });

  test("keeps core difficulty alongside it, and leaves plain core terrain alone", () => {
    expect(TerrainData.resolveTerrainEffects([rough, { name: 'difficulty', difficulty: 2 }]))
      .toMatchObject({ difficulty: 2, roughTerrain: true });
    expect(TerrainData.resolveTerrainEffects([{ name: 'difficulty', difficulty: 2 }]).roughTerrain).toBeUndefined();
    expect(TerrainData.resolveTerrainEffects([])).toBeNull();
  });

  test("the cost function doubles a walker's Rough Terrain distance", () => {
    const cost = TerrainData.getMovementCostFunction({ actor: makeActor() });
    expect(cost(null, null, 10, { action: 'walk', terrain: { difficulty: 1, roughTerrain: true } })).toBe(20);
    expect(cost(null, null, 10, { action: 'walk', terrain: null })).toBe(10);
  });

  test("carries the worst Environment Region environment, even without Rough Terrain", () => {
    const env = name => ({ name: `${ENVIRONMENT_EFFECT_PREFIX}${name}` });
    expect(TerrainData.resolveTerrainEffects([env('lowGravity'), env('highGravity')]))
      .toMatchObject({ difficulty: 1, roughTerrain: false, environment: 'highGravity' });
    expect(TerrainData.resolveTerrainEffects([rough, env('thickAtmosphere')]))
      .toMatchObject({ roughTerrain: true, environment: 'thickAtmosphere' });
  });

  test("equals compares the roughTerrain flag too", () => {
    const a = new TerrainData({ difficulty: 1, roughTerrain: true });
    expect(a.equals(new TerrainData({ difficulty: 1, roughTerrain: true }))).toBe(true);
    expect(a.equals(new TerrainData({ difficulty: 1, roughTerrain: false }))).toBe(false);
  });
});

describe("hasTakePointCover", () => {
  test("in Cover while standing in Rough Terrain with Take Point", () => {
    const actor = makeActor({ items: [perk(TAKE_POINT_ID)] });
    expect(hasTakePointCover(actor, makeTokenDoc({ rough: true }))).toBe(true);
    expect(hasTakePointCover(actor, makeTokenDoc({ rough: false }))).toBe(false);
    expect(hasTakePointCover(makeActor(), makeTokenDoc({ rough: true }))).toBe(false);
  });
});

describe("Region building", () => {
  test("a token's footprint in pixels", () => {
    expect(getTokenFootprintShape(makeTokenDoc())).toEqual({ type: 'rectangle', x: 200, y: 300, width: 200, height: 100 });
  });

  test("the Region carries an Environment Behavior with only Rough Terrain set", () => {
    const data = buildRoughTerrainRegionData([{ type: 'rectangle' }], 'Rubble');
    // Always visible to the GM (CONST.REGION_VISIBILITY.GAMEMASTER).
    expect(data).toMatchObject({ name: 'Rubble', shapes: [{ type: 'rectangle' }], visibility: 1 });
    expect(data.behaviors[0]).toMatchObject({
      type: ENVIRONMENT_REGION_BEHAVIOR_TYPE,
      system: { environment: '', terrain: '', roughTerrain: true },
    });
  });
});

describe("createRoughTerrainRegion / handleCreateRoughTerrainRequest", () => {
  const originalUser = game.user;
  const originalSocket = game.socket;

  beforeEach(() => {
    game.socket = { emit: jest.fn() };
  });

  afterEach(() => {
    game.user = originalUser;
    game.socket = originalSocket;
    fromUuid.mockReset();
  });

  test("a GM creates it directly", async () => {
    game.user = { isGM: true };
    const { parent: scene } = makeTokenDoc();
    await createRoughTerrainRegion(scene, [{ type: 'rectangle' }], 'Rubble');
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledWith('Region', [expect.objectContaining({ name: 'Rubble' })]);
    expect(game.socket.emit).not.toHaveBeenCalled();
  });

  test("a player asks the GM over the socket", async () => {
    game.user = { isGM: false };
    const { parent: scene } = makeTokenDoc();
    await createRoughTerrainRegion(scene, [{ type: 'rectangle' }], 'Rubble');
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'createRoughTerrain', sceneUuid: 'Scene.s1', shapes: [{ type: 'rectangle' }], name: 'Rubble',
    });
  });

  test("nothing to do without a scene or shapes", async () => {
    game.user = { isGM: true };
    await createRoughTerrainRegion(null, [{ type: 'rectangle' }], 'Rubble');
    await createRoughTerrainRegion(makeTokenDoc().parent, [], 'Rubble');
    expect(game.socket.emit).not.toHaveBeenCalled();
  });

  test("only the active GM handles the request", async () => {
    const { parent: scene } = makeTokenDoc();
    fromUuid.mockResolvedValue(scene);

    game.user = { isActiveGM: false };
    await handleCreateRoughTerrainRequest({ sceneUuid: 'Scene.s1', shapes: [], name: 'Rubble' });
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled();

    game.user = { isActiveGM: true };
    await handleCreateRoughTerrainRequest({ sceneUuid: 'Scene.s1', shapes: [], name: 'Rubble' });
    expect(scene.createEmbeddedDocuments).toHaveBeenCalled();
  });
});

describe("applyWreckerRoughTerrain", () => {
  const originalUser = game.user;

  beforeEach(() => {
    game.user = { isGM: true };
    ChatMessage.create.mockClear();
  });

  afterEach(() => {
    game.user = originalUser;
    fromUuid.mockReset();
  });

  function makeAttacker(traits) {
    const weapon = { name: 'Wrecking Cannon', system: { traits } };
    const items = [];
    items.get = id => (id == 'w1' ? weapon : null);
    return { items };
  }

  const weaponEffect = { flags: { essence20: { parentId: 'w1' } } };

  test("each missed target's space becomes Rough Terrain", async () => {
    const missed = makeTokenDoc();
    const hit = makeTokenDoc();
    fromUuid.mockImplementation(async uuid => ({
      'Item.e1': weaponEffect,
      'Actor.missed': { token: missed },
      'Actor.hit': { token: hit },
    })[uuid]);

    const count = await applyWreckerRoughTerrain(makeAttacker(['wrecker']), [
      { success: false, targetUuid: 'Actor.missed' },
      { success: true, targetUuid: 'Actor.hit' },
    ], { isAttack: true, itemUuid: 'Item.e1' });

    expect(count).toBe(1);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.RoughTerrainWreckerChat' }));
    expect(missed.parent.createEmbeddedDocuments).toHaveBeenCalledWith('Region', [
      expect.objectContaining({ shapes: [{ type: 'rectangle', x: 200, y: 300, width: 200, height: 100 }] }),
    ]);
    expect(hit.parent.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("skips a target already in Rough Terrain, a non-Wrecker weapon, and a non-attack", async () => {
    const alreadyRough = makeTokenDoc({ rough: true });
    fromUuid.mockImplementation(async uuid => ({ 'Item.e1': weaponEffect, 'Actor.t': { token: alreadyRough } })[uuid]);
    const miss = [{ success: false, targetUuid: 'Actor.t' }];

    expect(await applyWreckerRoughTerrain(makeAttacker(['wrecker']), miss, { isAttack: true, itemUuid: 'Item.e1' })).toBe(0);
    expect(await applyWreckerRoughTerrain(makeAttacker(['blunt']), miss, { isAttack: true, itemUuid: 'Item.e1' })).toBe(0);
    expect(await applyWreckerRoughTerrain(makeAttacker(['wrecker']), miss, { isAttack: false, itemUuid: 'Item.e1' })).toBe(0);
    expect(await applyWreckerRoughTerrain(makeAttacker(['wrecker']), miss, null)).toBe(0);
    expect(alreadyRough.parent.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  // User ruling 2026-09-26: an automatic failure is a miss against every target.
  test("an automatic failure turns every target's space into Rough Terrain", async () => {
    const first = makeTokenDoc();
    const second = makeTokenDoc();
    fromUuid.mockImplementation(async uuid => ({
      'Item.e1': weaponEffect, 'Actor.a': { token: first }, 'Actor.b': { token: second },
    })[uuid]);
    const effect = { type: 'weaponEffect', uuid: 'Item.e1' };

    const count = await applyWreckerOnAutoFail(makeAttacker(['wrecker']), effect,
      [{ actor: { uuid: 'Actor.a' } }, { actor: { uuid: 'Actor.b' } }]);

    expect(count).toBe(2);
    expect(first.parent.createEmbeddedDocuments).toHaveBeenCalled();
    expect(second.parent.createEmbeddedDocuments).toHaveBeenCalled();
  });

  test("an automatic failure does nothing for a non-attack or with no targets", async () => {
    fromUuid.mockImplementation(async uuid => ({ 'Item.e1': weaponEffect })[uuid]);
    expect(await applyWreckerOnAutoFail(makeAttacker(['wrecker']), { type: 'weapon', uuid: 'Item.e1' }, [])).toBe(0);
    expect(await applyWreckerOnAutoFail(makeAttacker(['wrecker']), { type: 'weaponEffect', uuid: 'Item.e1' }, undefined)).toBe(0);
  });
});

describe("Piledriver", () => {
  test("isPiledriver matches by either source field", () => {
    expect(isPiledriver({ flags: { core: { sourceId: PILEDRIVER_ID } } })).toBe(true);
    expect(isPiledriver({ _stats: { compendiumSource: PILEDRIVER_ID } })).toBe(true);
    expect(isPiledriver({ flags: {} })).toBe(false);
  });

  describe("offerPiledriverRoughTerrain", () => {
    const originalUser = game.user;
    const originalDialog = foundry.applications.api.DialogV2;

    afterEach(() => {
      global.canvas = undefined;
      game.user = originalUser;
      foundry.applications.api.DialogV2 = originalDialog;
    });

    function setUp({ confirmed = true, placed = { shapes: [{ toObject: () => ({ type: 'rectangle', x: 5 }) }] } } = {}) {
      const scene = makeTokenDoc().parent;
      global.canvas = { ready: true, scene, regions: { placeRegion: jest.fn(async () => placed) } };
      foundry.applications.api.DialogV2 = { confirm: jest.fn(async () => confirmed) };
      game.user = { isGM: true };
      ChatMessage.create.mockClear();
      return scene;
    }

    test("in Alt Mode, confirming and placing a space creates the Region", async () => {
      const scene = setUp();
      expect(await offerPiledriverRoughTerrain({ system: { isTransformed: true } }, { name: 'Piledriver' })).toBe(true);
      expect(scene.createEmbeddedDocuments).toHaveBeenCalledWith('Region', [
        expect.objectContaining({ shapes: [{ type: 'rectangle', x: 5 }] }),
      ]);
      expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.RoughTerrainPiledriverChat' }));
    });

    test("does nothing outside Alt Mode, when declined, or when placement is cancelled", async () => {
      let scene = setUp();
      expect(await offerPiledriverRoughTerrain({ system: { isTransformed: false } }, { name: 'Piledriver' })).toBe(false);
      expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();

      scene = setUp({ confirmed: false });
      expect(await offerPiledriverRoughTerrain({ system: { isTransformed: true } }, { name: 'Piledriver' })).toBe(false);

      scene = setUp({ placed: null });
      expect(await offerPiledriverRoughTerrain({ system: { isTransformed: true } }, { name: 'Piledriver' })).toBe(false);
      expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled();
      expect(ChatMessage.create).not.toHaveBeenCalled();
    });
  });
});
