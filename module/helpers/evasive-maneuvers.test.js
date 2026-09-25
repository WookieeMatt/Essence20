import { jest } from '@jest/globals';
import {
  EVASIVE_MANEUVERS_FLAG, getPilotedAerialVehicle, isEvasiveManeuversActive, toggleEvasiveManeuvers,
} from './evasive-maneuvers.mjs';

function makePilot({ uuid = 'Actor.pilot1' } = {}) {
  return { uuid };
}

function makeVehicle({ aerial = 40, crewUuid = 'Actor.pilot1', active = false } = {}) {
  return {
    type: 'vehicle',
    system: { movement: { aerial: { base: aerial } }, actors: { c1: { uuid: crewUuid } } },
    getFlag: jest.fn((scope, key) => (key == EVASIVE_MANEUVERS_FLAG ? active : undefined)),
    setFlag: jest.fn(),
  };
}

afterEach(() => {
  global.game = undefined;
});

describe("getPilotedAerialVehicle", () => {
  test("finds the Aerial vehicle the pilot is crewing", () => {
    const vehicle = makeVehicle();
    global.game = { actors: [vehicle] };

    expect(getPilotedAerialVehicle(makePilot())).toBe(vehicle);
  });

  // RAW scopes this to an Aerial vehicle specifically.
  test("ignores a crewed vehicle with no Aerial movement", () => {
    global.game = { actors: [makeVehicle({ aerial: 0 })] };

    expect(getPilotedAerialVehicle(makePilot())).toBe(null);
  });

  test("ignores a vehicle the actor isn't crewing", () => {
    global.game = { actors: [makeVehicle({ crewUuid: 'Actor.someoneElse' })] };

    expect(getPilotedAerialVehicle(makePilot())).toBe(null);
  });

  // Same undefined == undefined guard as lend-assistance.mjs#isAboardVehicle.
  test("never matches an actor with no uuid against a crew entry with none", () => {
    global.game = { actors: [{ type: 'vehicle', system: { movement: { aerial: { base: 40 } }, actors: { c1: {} } } }] };

    expect(getPilotedAerialVehicle({})).toBe(null);
  });
});

describe("toggleEvasiveManeuvers", () => {
  test("flags the VEHICLE, not the pilot", async () => {
    const vehicle = makeVehicle();
    global.game = { actors: [vehicle] };

    expect(await toggleEvasiveManeuvers(makePilot())).toBe(true);
    expect(vehicle.setFlag).toHaveBeenCalledWith('essence20', EVASIVE_MANEUVERS_FLAG, true);
  });

  test("levels back out when already flying evasively", async () => {
    const vehicle = makeVehicle({ active: true });
    global.game = { actors: [vehicle] };

    expect(await toggleEvasiveManeuvers(makePilot())).toBe(false);
    expect(vehicle.setFlag).toHaveBeenCalledWith('essence20', EVASIVE_MANEUVERS_FLAG, false);
  });

  test("returns null with no Aerial vehicle to fly", async () => {
    global.game = { actors: [] };

    expect(await toggleEvasiveManeuvers(makePilot())).toBe(null);
  });
});

describe("isEvasiveManeuversActive", () => {
  test("reads the vehicle's own flag, and is safe on a flagless object", () => {
    expect(isEvasiveManeuversActive(makeVehicle({ active: true }))).toBe(true);
    expect(isEvasiveManeuversActive(makeVehicle())).toBe(false);
    expect(isEvasiveManeuversActive(undefined)).toBe(false);
    expect(isEvasiveManeuversActive({})).toBe(false);
  });
});
