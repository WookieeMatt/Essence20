import { jest } from '@jest/globals';
import { getEngineOverrideTarget, activateEngineOverride, isEngineOverrideBoostActive } from './engine-override.mjs';

global.game = { user: { targets: { first: jest.fn() } }, combat: null };

function makeVehicle() {
  const flagStore = {};
  return {
    type: 'vehicle',
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

function makeActor({ pilotedVehicle = null } = {}) {
  return { _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle) } };
}

describe("getEngineOverrideTarget", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("prefers the actor's own piloted vehicle over a targeted one", () => {
    const pilotedVehicle = makeVehicle();
    const actor = makeActor({ pilotedVehicle });
    game.user.targets.first.mockReturnValue({ actor: makeVehicle() });

    expect(getEngineOverrideTarget(actor)).toBe(pilotedVehicle);
  });

  test("falls back to the currently-targeted vehicle actor when not piloting one", () => {
    const targetedVehicle = makeVehicle();
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: targetedVehicle });

    expect(getEngineOverrideTarget(actor)).toBe(targetedVehicle);
  });

  test("returns null when the targeted actor isn't a vehicle", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: { type: 'character' } });

    expect(getEngineOverrideTarget(actor)).toBeNull();
  });

  test("returns null with no piloted vehicle and no target", () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    expect(getEngineOverrideTarget(actor)).toBeNull();
  });
});

describe("activateEngineOverride", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
    game.combat = null;
  });

  test("banks the boost flag on the resolved vehicle and returns it", async () => {
    const vehicle = makeVehicle();
    const actor = makeActor({ pilotedVehicle: vehicle });
    game.combat = { round: 2 };

    const result = await activateEngineOverride(actor);

    expect(result).toBe(vehicle);
    expect(vehicle.setFlag).toHaveBeenCalledWith('essence20', 'pendingEngineOverrideBoost', { round: 2 });
    expect(isEngineOverrideBoostActive(vehicle)).toBe(true);
  });

  test("returns null when there's no valid target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    expect(await activateEngineOverride(actor)).toBeNull();
  });
});

describe("isEngineOverrideBoostActive", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("false with no flag set", () => {
    expect(isEngineOverrideBoostActive(makeVehicle())).toBe(false);
  });

  test("false once the round has advanced past the granting round", async () => {
    const vehicle = makeVehicle();
    game.combat = { round: 1 };
    await vehicle.setFlag('essence20', 'pendingEngineOverrideBoost', { round: 1 });

    game.combat = { round: 2 };
    expect(isEngineOverrideBoostActive(vehicle)).toBe(false);
  });

  test("true outside of combat when granted outside of combat", async () => {
    const vehicle = makeVehicle();
    game.combat = null;
    await vehicle.setFlag('essence20', 'pendingEngineOverrideBoost', { round: null });

    expect(isEngineOverrideBoostActive(vehicle)).toBe(true);
  });
});
