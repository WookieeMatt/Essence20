import { jest } from "@jest/globals";
import {
  applyEnvironmentAtSceneEnd, applyEnvironmentAtTurnEnd, applyEssenceDamage, ENVIRONMENTAL_AEGIS_ID,
  ENVIRONMENTALLY_SEALED_ID, getEnvironmentProtection, getSceneEndHazard, getTurnEndHazard, isImpairedByEnvironment,
  nextExposure, resolveHazard,
} from "./environment-hazards.mjs";

const GAS_MASK_ID = "Compendium.essence20.gi_joe_crb.Item.d089BSbVVaXWWTx6";
const SCUBA_ID = "Compendium.essence20.mlp_crb.Item.cZpeYK7VoLJKGKL6";

// A scene whose default environment (and level) is set by flag.
function makeScene(environment, environmentLevel = "") {
  const flags = { environment, environmentLevel };
  return { getFlag: (scope, key) => flags[key], tokens: [] };
}

// A living creature standing on the given scene.
function makeCreature({ scene = makeScene("normal"), type = "playerCharacter", items = [], system = {}, flags = {} } = {}) {
  const actor = {
    type,
    name: "Rocky",
    documentName: "Actor",
    items,
    system: {
      essences: { strength: { value: 3 }, speed: { value: 2 }, smarts: { value: 0 }, social: { value: 1 } },
      health: { value: 10 },
      stun: { value: 0 },
      immunities: {},
      ...system,
    },
    statuses: new Set(),
    flags: { essence20: { ...flags } },
    getFlag: jest.fn((scope, key) => actor.flags.essence20[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags.essence20[key];
    }),
    update: jest.fn(async () => {}),
  };
  const tokenDoc = { documentName: "Token", regions: [], parent: scene, actor };
  actor.getActiveTokens = () => [tokenDoc];
  scene.tokens.push(tokenDoc);
  return actor;
}

const equipped = (type, sourceId, extra = {}) => ({
  type, name: "Kit", system: { equipped: true, ...extra }, _stats: { compendiumSource: sourceId },
});

beforeEach(() => {
  ChatMessage.create.mockClear();
  game.user = { isActiveGM: true };
});

describe("resolveHazard", () => {
  test("uses the given level when it belongs to the environment, else the default", () => {
    expect(resolveHazard("toxicAtmosphere", "lethal")).toMatchObject({ level: "lethal", interval: 1 });
    expect(resolveHazard("toxicAtmosphere", "")).toMatchObject({ level: "harmful", interval: "scene" });
    expect(resolveHazard("toxicAtmosphere", "intense")).toMatchObject({ level: "harmful" });
    expect(resolveHazard("corrosiveAtmosphere", "concentrated")).toMatchObject({ interval: 3 });
    expect(resolveHazard("extremeHeat", "lethal")).toMatchObject({ interval: 10 });
    expect(resolveHazard("extremeCold", "dangerous")).toMatchObject({ interval: "hour" });
    expect(resolveHazard("vacuum", "")).toMatchObject({ level: "", interval: 1 });
    expect(resolveHazard("normal", "")).toBeNull();
  });
});

describe("getTurnEndHazard / getSceneEndHazard", () => {
  test("Vacuum deals Strength, Speed and Smarts Essence damage every turn", () => {
    expect(getTurnEndHazard("vacuum", "", 1)).toEqual({ damageType: null, essences: ["strength", "speed", "smarts"] });
    expect(getTurnEndHazard("vacuum", "", 7)).not.toBeNull();
  });

  test("a round-counted level deals 1 damage on every Nth turn only", () => {
    expect(getTurnEndHazard("corrosiveAtmosphere", "strong", 4)).toBeNull();
    expect(getTurnEndHazard("corrosiveAtmosphere", "strong", 5)).toEqual({ damageType: "acid", essences: [] });
    expect(getTurnEndHazard("toxicAtmosphere", "lethal", 1)).toEqual({ damageType: "poison", essences: [] });
    expect(getTurnEndHazard("extremeCold", "lethal", 10)).toEqual({ damageType: "cold", essences: [] });
  });

  test("no turn damage for per-scene, per-hour or 0-damage levels, or harmless environments", () => {
    expect(getTurnEndHazard("toxicAtmosphere", "harmful", 1)).toBeNull();
    expect(getTurnEndHazard("extremeHeat", "dangerous", 10)).toBeNull();
    expect(getTurnEndHazard("extremeHeat", "uncomfortable", 10)).toBeNull();
    expect(getTurnEndHazard("thinAtmosphere", "", 1)).toBeNull();
    expect(getTurnEndHazard("lowGravity", "", 1)).toBeNull();
  });

  test("per-scene damage: Irradiated's Strength and Speed Essence, Harmful toxicity's Poison", () => {
    expect(getSceneEndHazard("irradiated", "")).toEqual({ damageType: null, essences: ["strength", "speed"] });
    expect(getSceneEndHazard("toxicAtmosphere", "harmful")).toEqual({ damageType: "poison", essences: [] });
    expect(getSceneEndHazard("toxicAtmosphere", "lethal")).toBeNull();
    expect(getSceneEndHazard("vacuum", "")).toBeNull();
  });
});

describe("nextExposure", () => {
  test("counts up in the same combat, environment and level, and restarts otherwise", () => {
    const current = { combatId: "c1", environment: "toxicAtmosphere", level: "strong" };
    expect(nextExposure(null, current).turns).toBe(1);
    expect(nextExposure({ ...current, turns: 4 }, current).turns).toBe(5);
    expect(nextExposure({ ...current, turns: 4, level: "lethal" }, current).turns).toBe(1);
    expect(nextExposure({ ...current, turns: 4, combatId: "c0" }, current).turns).toBe(1);
  });
});

describe("getEnvironmentProtection", () => {
  test("an unprotected creature has none; nothing needs protecting from a harmless environment", () => {
    expect(getEnvironmentProtection(makeCreature(), "vacuum")).toBeNull();
    expect(getEnvironmentProtection(makeCreature(), "lowGravity")).toBeNull();
  });

  test("Enviro-Sealed armor protects from every hazard", () => {
    const actor = makeCreature({ items: [{ type: "armor", system: { equipped: true, traits: ["enviroSealed"] } }] });
    for (const environment of ["vacuum", "toxicAtmosphere", "corrosiveAtmosphere", "extremeHeat", "irradiated", "thinAtmosphere"]) {
      expect(getEnvironmentProtection(actor, environment)).toBe("E20.ArmorTraitEnviroSealed");
    }
  });

  test("unequipped Enviro-Sealed armor doesn't", () => {
    const actor = makeCreature({ items: [{ type: "armor", system: { equipped: false, traits: ["enviroSealed"] } }] });
    expect(getEnvironmentProtection(actor, "vacuum")).toBeNull();
  });

  test("Environmentally Sealed covers the breathing hazards, only while Morphed", () => {
    const power = { type: "power", name: "Environmentally Sealed", _stats: { compendiumSource: ENVIRONMENTALLY_SEALED_ID } };
    const morphed = makeCreature({ items: [power], system: { isMorphed: true } });
    expect(getEnvironmentProtection(morphed, "vacuum")).toBe("Environmentally Sealed");
    expect(getEnvironmentProtection(morphed, "toxicAtmosphere")).toBe("Environmentally Sealed");
    expect(getEnvironmentProtection(morphed, "extremeHeat")).toBeNull();
    expect(getEnvironmentProtection(makeCreature({ items: [power] }), "vacuum")).toBeNull();
  });

  test("Environmental Aegis also covers temperature while Morphed", () => {
    const perk = { type: "perk", name: "Environmental Aegis", _stats: { compendiumSource: ENVIRONMENTAL_AEGIS_ID } };
    const morphed = makeCreature({ items: [perk], system: { isMorphed: true } });
    expect(getEnvironmentProtection(morphed, "extremeCold")).toBe("Environmental Aegis");
    expect(getEnvironmentProtection(morphed, "thickAtmosphere")).toBe("Environmental Aegis");
    expect(getEnvironmentProtection(morphed, "corrosiveAtmosphere")).toBeNull();
  });

  test("an equipped gas mask covers a Toxic Atmosphere only", () => {
    const actor = makeCreature({ items: [equipped("gear", GAS_MASK_ID)] });
    expect(getEnvironmentProtection(actor, "toxicAtmosphere")).toBe("Kit");
    expect(getEnvironmentProtection(actor, "vacuum")).toBeNull();
  });

  test("Scuba Gear's breathing assistance covers Thick and Thin Atmosphere", () => {
    const actor = makeCreature({ items: [equipped("gear", SCUBA_ID)] });
    expect(getEnvironmentProtection(actor, "thinAtmosphere")).toBe("E20.EnvironmentProtectionBreathingGear");
    expect(getEnvironmentProtection(actor, "thickAtmosphere")).toBe("E20.EnvironmentProtectionBreathingGear");
    expect(getEnvironmentProtection(actor, "vacuum")).toBeNull();
  });

  test("a machine only needs protecting from a Corrosive Atmosphere", () => {
    const ship = makeCreature({ type: "vehicle" });
    expect(getEnvironmentProtection(ship, "vacuum")).toBe("E20.EnvironmentProtectionNotLiving");
    expect(getEnvironmentProtection(ship, "corrosiveAtmosphere")).toBeNull();
  });
});

describe("isImpairedByEnvironment", () => {
  test("Extreme Temperature and Thick/Thin Atmosphere impair the unprotected", () => {
    const actor = makeCreature();
    expect(isImpairedByEnvironment(actor, "extremeHeat")).toBe(true);
    expect(isImpairedByEnvironment(actor, "thinAtmosphere")).toBe(true);
    expect(isImpairedByEnvironment(actor, "thickAtmosphere")).toBe(true);
    expect(isImpairedByEnvironment(actor, "vacuum")).toBe(false);
    expect(isImpairedByEnvironment(actor, "normal")).toBe(false);
    expect(isImpairedByEnvironment(makeCreature({ items: [equipped("gear", SCUBA_ID)] }), "thinAtmosphere")).toBe(false);
  });
});

describe("applyEssenceDamage", () => {
  test("takes 1 from each listed Essence that has any left", async () => {
    const actor = makeCreature();
    expect(await applyEssenceDamage(actor, ["strength", "speed", "smarts"])).toEqual(["strength", "speed"]);
    expect(actor.update).toHaveBeenCalledWith({ "system.essences.strength.value": 2, "system.essences.speed.value": 1 });
  });

  test("skips an actor with no Essence values", async () => {
    const actor = makeCreature({ system: { essences: undefined } });
    expect(await applyEssenceDamage(actor, ["strength"])).toEqual([]);
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("applyEnvironmentAtTurnEnd", () => {
  const combat = { id: "c1" };

  test("Vacuum: Essence damage at the end of every turn, with a chat line", async () => {
    const actor = makeCreature({ scene: makeScene("vacuum") });
    expect(await applyEnvironmentAtTurnEnd(actor, combat)).toEqual({ damageType: null, essences: ["strength", "speed", "smarts"] });
    expect(actor.update).toHaveBeenCalledWith({ "system.essences.strength.value": 2, "system.essences.speed.value": 1 });
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(actor.flags.essence20.environmentExposure).toMatchObject({ combatId: "c1", environment: "vacuum", turns: 1 });
  });

  test("a Strong Corrosive Atmosphere deals 1 Acid on the 5th turn of exposure", async () => {
    const actor = makeCreature({ scene: makeScene("corrosiveAtmosphere", "strong") });
    for (let turn = 1; turn <= 4; turn++) {
      expect(await applyEnvironmentAtTurnEnd(actor, combat)).toBeNull();
    }

    expect(await applyEnvironmentAtTurnEnd(actor, combat)).toEqual({ damageType: "acid", essences: [] });
    expect(actor.update).toHaveBeenCalledWith({ "system.health.value": 9 });
  });

  test("protected or in a normal environment: nothing, and the exposure count resets", async () => {
    const sealed = makeCreature({
      scene: makeScene("vacuum"),
      items: [{ type: "armor", system: { equipped: true, traits: ["enviroSealed"] } }],
      flags: { environmentExposure: { turns: 3 } },
    });
    expect(await applyEnvironmentAtTurnEnd(sealed, combat)).toBeNull();
    expect(sealed.unsetFlag).toHaveBeenCalledWith("essence20", "environmentExposure");

    const safe = makeCreature();
    expect(await applyEnvironmentAtTurnEnd(safe, combat)).toBeNull();
    expect(safe.setFlag).not.toHaveBeenCalled();
    expect(await applyEnvironmentAtTurnEnd(null, combat)).toBeNull();
  });
});

describe("applyEnvironmentAtSceneEnd", () => {
  test("Irradiated deals its per-scene Essence damage to each unprotected actor on the scene, once", async () => {
    const scene = makeScene("irradiated");
    const exposed = makeCreature({ scene });
    const sealed = makeCreature({ scene, items: [{ type: "armor", system: { equipped: true, traits: ["enviroSealed"] } }] });
    // A second token of the same actor doesn't double the damage.
    scene.tokens.push({ ...scene.tokens[0] });

    expect(await applyEnvironmentAtSceneEnd(scene)).toBe(1);
    expect(exposed.update).toHaveBeenCalledTimes(1);
    expect(sealed.update).not.toHaveBeenCalled();
  });

  test("only the active GM applies it, and a missing scene does nothing", async () => {
    const scene = makeScene("irradiated");
    makeCreature({ scene });
    game.user = { isActiveGM: false };
    expect(await applyEnvironmentAtSceneEnd(scene)).toBe(0);
    game.user = { isActiveGM: true };
    expect(await applyEnvironmentAtSceneEnd(null)).toBe(0);
  });
});
