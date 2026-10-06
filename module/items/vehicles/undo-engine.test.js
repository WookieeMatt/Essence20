import { jest } from '@jest/globals';
import { triggerUndoEngineCheck, markUndoEngineMovementDisabled, isUndoEngineMovementDisabled } from './undo-engine.mjs';

function makeVehicle() {
  const flagStore = {};
  return {
    uuid: 'Actor.vehicle1',
    type: 'vehicle',
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

function makeDriver() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("triggerUndoEngineCheck", () => {
  test("fires a flat DIF 20 Driving Skill Test on the driver, threading the vehicle's uuid", async () => {
    const driver = makeDriver();
    const vehicle = makeVehicle();

    await triggerUndoEngineCheck(driver, vehicle);

    expect(driver._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'driving', essence: 'speed', dif: '20',
        isUndoEngineCheckAttempt: true, undoEngineVehicleUuid: 'Actor.vehicle1',
      }),
      driver,
    );
  });
});

describe("markUndoEngineMovementDisabled / isUndoEngineMovementDisabled", () => {
  test("false with no flag set", () => {
    expect(isUndoEngineMovementDisabled(makeVehicle())).toBe(false);
  });

  test("true once marked", async () => {
    const vehicle = makeVehicle();

    await markUndoEngineMovementDisabled(vehicle);

    expect(vehicle.setFlag).toHaveBeenCalledWith('essence20', 'undoEngineMovementDisabled', true);
    expect(isUndoEngineMovementDisabled(vehicle)).toBe(true);
  });

  test("false for an actor with no getFlag method", () => {
    expect(isUndoEngineMovementDisabled({})).toBe(false);
  });
});
