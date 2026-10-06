import { jest } from "@jest/globals";
import {
  DEFAULT_ENVIRONMENT, ENVIRONMENT_EFFECT_PREFIX, ENVIRONMENT_REGION_BEHAVIOR_TYPE, EnvironmentRegionBehaviorType,
  getEnvironment, getEnvironmentLevel, getEnvironmentState, getSceneEnvironmentLevel, getVesselInteriorEnvironment,
  getSceneEnvironment, getSceneTerrain, getTerrain, hasEquippedEnviroSealedArmor, isEnviroSealedEdgeActive,
  isInRoughTerrain, refreshTerrainDependentActor, ROUGH_TERRAIN_EFFECT,
} from "./environment.mjs";

function makeScene(environment, terrain) {
  const flags = { environment, terrain };
  return {
    getFlag: (scope, key) => (scope == "essence20" ? flags[key] : undefined),
  };
}

function makeBehavior(environment, { disabled = false, terrain = "", roughTerrain = false, environmentLevel = "" } = {}) {
  return { type: ENVIRONMENT_REGION_BEHAVIOR_TYPE, disabled, system: { environment, terrain, roughTerrain, environmentLevel } };
}

function makeRegion(behaviors, elevationTop) {
  return { behaviors, elevation: { top: elevationTop } };
}

function makeToken(regions, scene) {
  return { regions, parent: scene };
}

function makeActorWithToken(token) {
  return { documentName: "Actor", getActiveTokens: () => [token] };
}

describe("getSceneEnvironment", () => {
  test("returns the scene flag when set", () => {
    expect(getSceneEnvironment(makeScene("vacuum"))).toBe("vacuum");
  });

  test("defaults to normal with no flag, or no scene at all", () => {
    expect(getSceneEnvironment(makeScene(undefined))).toBe(DEFAULT_ENVIRONMENT);
    expect(getSceneEnvironment(null)).toBe(DEFAULT_ENVIRONMENT);
  });
});

describe("getEnvironment", () => {
  test("falls back to the scene default with no Environment Region on the token", () => {
    const scene = makeScene("underwater");
    const token = makeToken([], scene);
    expect(getEnvironment(makeActorWithToken(token))).toBe("underwater");
  });

  test("falls back to normal for an Actor with no placed token and no scene", () => {
    const actor = { documentName: "Actor", getActiveTokens: () => [] };
    expect(getEnvironment(actor)).toBe(DEFAULT_ENVIRONMENT);
  });

  test("reads a single Environment Region's own override", () => {
    const scene = makeScene("normal");
    const region = makeRegion([makeBehavior("vacuum")], Infinity);
    const token = makeToken([region], scene);
    expect(getEnvironment(makeActorWithToken(token))).toBe("vacuum");
  });

  test("ignores a disabled Environment Behavior", () => {
    const scene = makeScene("normal");
    const region = makeRegion([makeBehavior("vacuum", { disabled: true })], Infinity);
    const token = makeToken([region], scene);
    expect(getEnvironment(makeActorWithToken(token))).toBe("normal");
  });

  test("prefers whichever overlapping Region was drawn later on the scene", () => {
    const cave = makeRegion([makeBehavior("underwater")]);
    const pool = makeRegion([makeBehavior("zeroGravity")]);
    const scene = { ...makeScene("normal"), regions: [cave, pool] };
    const token = makeToken([cave, pool], scene);
    expect(getEnvironment(makeActorWithToken(token))).toBe("zeroGravity");

    const reorderedScene = { ...makeScene("normal"), regions: [pool, cave] };
    const reorderedToken = makeToken([cave, pool], reorderedScene);
    expect(getEnvironment(makeActorWithToken(reorderedToken))).toBe("underwater");
  });

  test("resolves a canvas Token placeable or a bare TokenDocument the same way an Actor does", () => {
    const scene = makeScene("vacuum");
    const tokenDoc = makeToken([], scene);
    expect(getEnvironment({ ...tokenDoc, documentName: "Token" })).toBe("vacuum");
    expect(getEnvironment({ document: { ...tokenDoc, documentName: "Token" } })).toBe("vacuum");
  });

  describe("an Actor with no rendered token (no canvas drawn)", () => {
    afterEach(() => {
      delete global.canvas;
      delete global.game.scenes;
    });

    // getActiveTokens reads the canvas, so it finds nothing when none is drawn - the token is still
    // on the scene document, and its Region still applies.
    test("finds the Actor's token on the scene document and uses its Region", () => {
      const actor = { id: "a1", documentName: "Actor", getActiveTokens: () => [] };
      const sand = makeRegion([makeBehavior("normal")]);
      const scene = { ...makeScene("underwater"), regions: [sand] };
      const token = { ...makeToken([sand], scene), actorId: "a1" };
      scene.tokens = [token];
      global.canvas = { scene: null };
      global.game.scenes = { viewed: scene };

      expect(getEnvironment(actor)).toBe("normal");
    });

    test("falls back to the viewed scene's default, not Normal, when the Actor has no token there", () => {
      const actor = { id: "a1", documentName: "Actor", getActiveTokens: () => [] };
      const scene = { ...makeScene("vacuum"), regions: [], tokens: [] };
      global.canvas = { scene: null };
      global.game.scenes = { viewed: scene };

      expect(getEnvironment(actor)).toBe("vacuum");
    });
  });
});

describe("hasEquippedEnviroSealedArmor / isEnviroSealedEdgeActive", () => {
  const enviroSealedArmor = { system: { traits: ["enviroSealed", "deflective"] } };
  const plainArmor = { system: { traits: ["deflective"] } };

  test("detects Enviro-Sealed armor in the equipped set", () => {
    expect(hasEquippedEnviroSealedArmor([plainArmor, enviroSealedArmor])).toBe(true);
    expect(hasEquippedEnviroSealedArmor([plainArmor])).toBe(false);
    expect(hasEquippedEnviroSealedArmor([])).toBe(false);
  });

  test("grants the automatic Edge only while wearing it AND out of a normal environment", () => {
    expect(isEnviroSealedEdgeActive([enviroSealedArmor], "vacuum")).toBe(true);
    expect(isEnviroSealedEdgeActive([enviroSealedArmor], "normal")).toBe(false);
    expect(isEnviroSealedEdgeActive([plainArmor], "vacuum")).toBe(false);
  });
});

describe("getEnvironment with blank (inherit) Region environments", () => {
  test("a terrain-only Region on top doesn't reset an underlying Region's environment", () => {
    const lake = makeRegion([makeBehavior("underwater")]);
    const reeds = makeRegion([makeBehavior("", { terrain: "wetlands" })]);
    const scene = { ...makeScene("normal"), regions: [lake, reeds] };
    const token = makeToken([lake, reeds], scene);
    expect(getEnvironment(makeActorWithToken(token))).toBe("underwater");
  });

  test("a terrain-only Region alone falls back to the scene's environment", () => {
    const reeds = makeRegion([makeBehavior("", { terrain: "wetlands" })]);
    const scene = { ...makeScene("lowGravity"), regions: [reeds] };
    expect(getEnvironment(makeActorWithToken(makeToken([reeds], scene)))).toBe("lowGravity");
  });
});

describe("getSceneTerrain", () => {
  test("returns the scene's terrain flag when it's a known biome", () => {
    expect(getSceneTerrain(makeScene("normal", "desert"))).toBe("desert");
  });

  test("null when unset, blank, unknown, or no scene", () => {
    expect(getSceneTerrain(makeScene("normal", undefined))).toBeNull();
    expect(getSceneTerrain(makeScene("normal", ""))).toBeNull();
    expect(getSceneTerrain(makeScene("normal", "lava"))).toBeNull();
    expect(getSceneTerrain(null)).toBeNull();
  });
});

describe("getTerrain", () => {
  test("null when neither the scene nor any Region sets a terrain", () => {
    const token = makeToken([makeRegion([makeBehavior("vacuum")])], makeScene("normal"));
    expect(getTerrain(makeActorWithToken(token))).toBeNull();
  });

  test("falls back to the scene's terrain", () => {
    const token = makeToken([], makeScene("normal", "arctic"));
    expect(getTerrain(makeActorWithToken(token))).toBe("arctic");
  });

  test("a Region's terrain overrides the scene's", () => {
    const city = makeRegion([makeBehavior("", { terrain: "urban" })]);
    const scene = { ...makeScene("normal", "woodlands"), regions: [city] };
    expect(getTerrain(makeActorWithToken(makeToken([city], scene)))).toBe("urban");
  });

  test("an environment-only Region doesn't hide the scene's terrain", () => {
    const pool = makeRegion([makeBehavior("underwater")]);
    const scene = { ...makeScene("normal", "sea"), regions: [pool] };
    expect(getTerrain(makeActorWithToken(makeToken([pool], scene)))).toBe("sea");
  });

  test("the latest-drawn terrain Region wins, skipping later Regions that leave terrain blank", () => {
    const forest = makeRegion([makeBehavior("", { terrain: "woodlands" })]);
    const marsh = makeRegion([makeBehavior("", { terrain: "wetlands" })]);
    const pool = makeRegion([makeBehavior("underwater")]);
    const scene = { ...makeScene("normal", "grasslands"), regions: [forest, marsh, pool] };
    expect(getTerrain(makeActorWithToken(makeToken([pool, forest, marsh], scene)))).toBe("wetlands");
  });

  test("ignores a disabled Behavior's terrain", () => {
    const city = makeRegion([makeBehavior("", { terrain: "urban", disabled: true })]);
    const scene = { ...makeScene("normal", "desert"), regions: [city] };
    expect(getTerrain(makeActorWithToken(makeToken([city], scene)))).toBe("desert");
  });

  test("an Actor with no token uses the scene being played", () => {
    global.canvas = { scene: makeScene("normal", "mountains") };
    try {
      expect(getTerrain({ documentName: "Actor", getActiveTokens: () => [] })).toBe("mountains");
    } finally {
      global.canvas = undefined;
    }
  });
});

describe("EnvironmentRegionBehaviorType schema", () => {
  const schema = EnvironmentRegionBehaviorType.defineSchema();

  test("environment may be blank (inherit) but still starts as Underwater", () => {
    expect(schema.environment.options).toMatchObject({ blank: true, initial: "underwater" });
    expect(Object.keys(schema.environment.options.choices())).toContain("vacuum");
  });

  test("roughTerrain is a plain off-by-default boolean", () => {
    expect(schema.roughTerrain.options).toMatchObject({ initial: false });
  });

  test("environmentLevel is optional (existing Regions read blank) and offers every severity", () => {
    expect(schema.environmentLevel.options).toMatchObject({ blank: true, initial: "" });
    expect(Object.keys(schema.environmentLevel.options.choices())).toEqual(expect.arrayContaining(["intense", "lethal", "harmful"]));
  });

  test("every Across the Stars environment is a choice", () => {
    expect(Object.keys(schema.environment.options.choices())).toEqual(expect.arrayContaining([
      "corrosiveAtmosphere", "extremeCold", "extremeHeat", "highGravity", "irradiated", "lowGravity",
      "thickAtmosphere", "thinAtmosphere", "toxicAtmosphere", "vacuum", "zeroGravity",
    ]));
  });

  test("terrain is optional and offers the environment-of-expertise biomes", () => {
    expect(schema.terrain.options).toMatchObject({ blank: true, initial: "" });
    expect(Object.keys(schema.terrain.options.choices())).toEqual(expect.arrayContaining(["arctic", "urban"]));
  });
});

describe("refreshTerrainDependentActor", () => {
  function makeTokenDoc(environments, { rendered = false } = {}) {
    const actor = {
      system: { environments },
      reset: jest.fn(),
      sheet: { rendered, render: jest.fn() },
    };
    return { actor };
  }

  test("re-prepares an actor with environments of expertise when its Regions change", () => {
    const tokenDoc = makeTokenDoc(["arctic"], { rendered: true });
    expect(refreshTerrainDependentActor(tokenDoc, { _regions: ["r1"] })).toBe(true);
    expect(tokenDoc.actor.reset).toHaveBeenCalled();
    expect(tokenDoc.actor.sheet.render).toHaveBeenCalled();
  });

  test("leaves a closed sheet alone", () => {
    const tokenDoc = makeTokenDoc(["arctic"]);
    refreshTerrainDependentActor(tokenDoc, { _regions: [] });
    expect(tokenDoc.actor.sheet.render).not.toHaveBeenCalled();
  });

  test("does nothing for an update that didn't touch Regions, or an actor without expertise", () => {
    const tokenDoc = makeTokenDoc(["arctic"]);
    expect(refreshTerrainDependentActor(tokenDoc, { x: 100 })).toBe(false);
    expect(refreshTerrainDependentActor(makeTokenDoc([]), { _regions: [] })).toBe(false);
    expect(refreshTerrainDependentActor({ actor: null }, { _regions: [] })).toBe(false);
    expect(tokenDoc.actor.reset).not.toHaveBeenCalled();
  });
});

describe("Rough Terrain", () => {
  test("isInRoughTerrain: inside any enabled Rough Terrain Region", () => {
    const rubble = makeRegion([makeBehavior("", { roughTerrain: true })]);
    const scene = { ...makeScene("normal"), regions: [rubble] };
    expect(isInRoughTerrain(makeActorWithToken(makeToken([rubble], scene)))).toBe(true);
    expect(isInRoughTerrain(makeActorWithToken(makeToken([], scene)))).toBe(false);
  });

  test("isInRoughTerrain: a disabled Behavior, an unticked one, or no token at all don't count", () => {
    const off = makeRegion([makeBehavior("", { roughTerrain: true, disabled: true })]);
    const plain = makeRegion([makeBehavior("underwater")]);
    const scene = { ...makeScene("normal"), regions: [off, plain] };
    expect(isInRoughTerrain(makeActorWithToken(makeToken([off, plain], scene)))).toBe(false);
    expect(isInRoughTerrain({ documentName: "Actor", getActiveTokens: () => [] })).toBe(false);
  });

  test("the Behavior marks movement through it with the Rough Terrain effect only when ticked", () => {
    const behavior = new EnvironmentRegionBehaviorType();
    behavior.roughTerrain = true;
    expect(behavior._getTerrainEffects({}, { action: "walk" })).toEqual([{ name: ROUGH_TERRAIN_EFFECT }]);
    behavior.roughTerrain = false;
    expect(behavior._getTerrainEffects({}, { action: "walk" })).toEqual([]);
  });

  test("the Behavior also marks its own environment, for High Gravity/Thick Atmosphere movement costs", () => {
    const behavior = new EnvironmentRegionBehaviorType();
    behavior.roughTerrain = true;
    behavior.environment = "highGravity";
    expect(behavior._getTerrainEffects({}, { action: "walk" }))
      .toEqual([{ name: ROUGH_TERRAIN_EFFECT }, { name: `${ENVIRONMENT_EFFECT_PREFIX}highGravity` }]);
  });
});

describe("environment severity (getEnvironmentLevel)", () => {
  const levelScene = (environment, environmentLevel) => ({ getFlag: (scope, key) => ({ environment, environmentLevel })[key] });

  test("reads the scene's own level flag, blank when unset", () => {
    const scene = levelScene("toxicAtmosphere", "strong");
    expect(getSceneEnvironmentLevel(scene)).toBe("strong");
    expect(getSceneEnvironmentLevel(makeScene("vacuum"))).toBe("");
    expect(getSceneEnvironmentLevel(null)).toBe("");
    expect(getEnvironmentLevel(makeActorWithToken(makeToken([], scene)))).toBe("strong");
  });

  test("takes the level from the same Region that set the environment", () => {
    const fumes = makeRegion([makeBehavior("toxicAtmosphere", { environmentLevel: "lethal" })]);
    const scene = { ...makeScene("corrosiveAtmosphere"), regions: [fumes] };
    expect(getEnvironmentState(makeActorWithToken(makeToken([fumes], scene))))
      .toEqual({ environment: "toxicAtmosphere", level: "lethal" });
  });
});

describe("vessel interiors (Across the Stars p.25-26)", () => {
  const levelScene = (environment, environmentLevel) => ({ getFlag: (scope, key) => ({ environment, environmentLevel })[key] });

  function vessel(statuses) {
    return {
      type: "vehicle",
      statuses: new Set(Object.keys(statuses)),
      effects: Object.entries(statuses).map(([id, stacks]) => ({ statuses: new Set([id]), flags: { essence20: { stacks } } })),
      system: { actors: { a: { uuid: "Actor.crew" } } },
    };
  }

  test("Decompressed is Thin Atmosphere, then Vacuum; Leaking is Toxic, rising a level per stack", () => {
    expect(getVesselInteriorEnvironment(vessel({ decompressed: 1 }))).toEqual({ environment: "thinAtmosphere", level: "" });
    expect(getVesselInteriorEnvironment(vessel({ decompressed: 2 }))).toEqual({ environment: "vacuum", level: "" });
    expect(getVesselInteriorEnvironment(vessel({ leaking: 1 }))).toEqual({ environment: "toxicAtmosphere", level: "harmful" });
    expect(getVesselInteriorEnvironment(vessel({ leaking: 3 }))).toEqual({ environment: "toxicAtmosphere", level: "strong" });
    expect(getVesselInteriorEnvironment(vessel({ leaking: 9 }))).toEqual({ environment: "toxicAtmosphere", level: "lethal" });
    expect(getVesselInteriorEnvironment(vessel({ decompressed: 2, leaking: 4 })).environment).toBe("vacuum");
    expect(getVesselInteriorEnvironment(vessel({ decompressed: 1, leaking: 1 })).environment).toBe("toxicAtmosphere");
    expect(getVesselInteriorEnvironment(vessel({ jammed: 1 }))).toBeNull();
    expect(getVesselInteriorEnvironment(null)).toBeNull();
  });

  describe("getEnvironment for an actor aboard", () => {
    const party = global.game.actors.party;
    afterEach(() => {
      global.game.actors = { party };
    });

    const crewIn = scene => ({ uuid: "Actor.crew", ...makeActorWithToken(makeToken([], scene)) });

    test("uses the interior when it's worse than where the token stands", () => {
      global.game.actors = [vessel({ decompressed: 2 })];
      expect(getEnvironment(crewIn(makeScene("normal")))).toBe("vacuum");
      expect(getEnvironment(crewIn(makeScene("normal")), { includeInterior: false })).toBe("normal");
    });

    test("keeps the actor's own surroundings when those are worse, or the ship is fine", () => {
      global.game.actors = [vessel({ decompressed: 1 })];
      expect(getEnvironment(crewIn(makeScene("vacuum")))).toBe("vacuum");
      global.game.actors = [vessel({})];
      expect(getEnvironment(crewIn(makeScene("lowGravity")))).toBe("lowGravity");
    });

    test("a worse toxicity inside beats a milder one outside, and not the reverse", () => {
      const actor = crewIn(levelScene("toxicAtmosphere", "dangerous"));
      global.game.actors = [vessel({ leaking: 4 })];
      expect(getEnvironmentState(actor)).toEqual({ environment: "toxicAtmosphere", level: "lethal" });
      global.game.actors = [vessel({ leaking: 1 })];
      expect(getEnvironmentState(actor)).toEqual({ environment: "toxicAtmosphere", level: "dangerous" });
    });
  });
});

describe("refreshTerrainDependentActor for Low Gravity / Zero-G Movement", () => {
  test("re-prepares when the token's environment no longer matches the one Movement was prepared for", () => {
    const actor = { system: {}, reset: jest.fn(), sheet: { rendered: false }, _e20MovementEnvironment: "normal" };
    const tokenDoc = { documentName: "Token", regions: [], parent: makeScene("zeroGravity"), actor };
    expect(refreshTerrainDependentActor(tokenDoc, { _regions: [] })).toBe(true);

    actor._e20MovementEnvironment = "zeroGravity";
    expect(refreshTerrainDependentActor(tokenDoc, { _regions: [] })).toBe(false);
  });
});
