import { jest } from '@jest/globals';
import { HIGH_GEAR_ID, isHighGearActive, toggleHighGear } from './high-gear.mjs';

global.game = { i18n: { localize: (key) => key } };
global.ui = { notifications: { warn: jest.fn() } };
global.fromUuidSync = jest.fn();

function makeDriver({ personalPower = 1 } = {}) {
  const driver = {
    uuid: 'Actor.driver1',
    system: { powers: { personal: { value: personalPower } } },
    update: jest.fn(async (data) => {
      if (data['system.powers.personal.value'] !== undefined) {
        driver.system.powers.personal.value = data['system.powers.personal.value'];
      }
    }),
  };
  return driver;
}

function makeActor({ hasFeature = true, active = false, driver = null, usedThisScene = false } = {}) {
  const flagStore = {
    highGearActive: active,
    highGearUsedThisScene: usedThisScene ? { epoch: 1, window: 'scene', count: 1 } : undefined,
  };
  const crewEntries = driver ? { crew1: { vehicleRole: 'driver', uuid: driver.uuid } } : {};
  global.fromUuidSync.mockImplementation((uuid) => (uuid === driver?.uuid ? driver : undefined));

  return {
    type: 'zord',
    items: hasFeature ? [{ type: 'feature', flags: { core: { sourceId: HIGH_GEAR_ID } } }] : [],
    system: { actors: crewEntries },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn((scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn((scope, key) => {
      delete flagStore[key];
    }),
  };
}

afterEach(() => {
  global.fromUuidSync.mockReset();
});

describe("isHighGearActive", () => {
  test("true once the flag is set", () => {
    expect(isHighGearActive(makeActor({ active: true }))).toBe(true);
  });

  test("false without the flag", () => {
    expect(isHighGearActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleHighGear", () => {
  test("activating spends 1 of the driver's Personal Power, sets the flag, and marks the scene use", async () => {
    const driver = makeDriver({ personalPower: 2 });
    const actor = makeActor({ active: false, driver });

    await toggleHighGear(actor);

    expect(driver.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'highGearActive', true);
  });

  test("deactivating costs nothing and clears the flag", async () => {
    const actor = makeActor({ active: true });
    await toggleHighGear(actor);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'highGearActive');
  });

  test("refuses to activate a second time this scene", async () => {
    const driver = makeDriver();
    const actor = makeActor({ active: false, driver, usedThisScene: true });

    await toggleHighGear(actor);

    expect(driver.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("refuses to activate without a driver seated", async () => {
    const actor = makeActor({ active: false, driver: null });
    await toggleHighGear(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("refuses to activate when the driver can't afford it", async () => {
    const driver = makeDriver({ personalPower: 0 });
    const actor = makeActor({ active: false, driver });

    await toggleHighGear(actor);

    expect(driver.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing for a non-Zord actor", async () => {
    const actor = { ...makeActor(), type: 'playerCharacter' };
    await toggleHighGear(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing without the Feature", async () => {
    const driver = makeDriver();
    const actor = makeActor({ hasFeature: false, driver });
    await toggleHighGear(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
