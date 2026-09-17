import { jest } from '@jest/globals';
import { clearWarriorMode, isWarriorModeActive, toggleWarriorMode } from './warrior-mode.mjs';

global.game = { i18n: { localize: (key) => key } };
global.ui = { notifications: { warn: jest.fn() } };
global.fromUuidSync = jest.fn();

const WARRIOR_MODE_ID = "Compendium.essence20.pr_crb.Item.RsrUlBazkPwpRfxi";

function makeDriver({ personalPower = 3 } = {}) {
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

// A Zord actor has no system.powers field of its own (confirmed against the real schema) -
// Personal Power always belongs to whichever driver is currently seated, resolved via
// helpers/combat.mjs#getVehicleDriver (system.actors -> fromUuidSync, mocked here the same way
// dice.test.js's own Martial Zord/Zero-G fixtures already resolve a driver).
function makeActor({ hasFeature = true, active = false, driver = null } = {}) {
  const flagStore = { warriorModeActive: active };
  const crewEntries = driver ? { crew1: { vehicleRole: 'driver', uuid: driver.uuid } } : {};
  global.fromUuidSync.mockImplementation((uuid) => (uuid === driver?.uuid ? driver : undefined));

  return {
    type: 'zord',
    items: hasFeature ? [{ type: 'feature', flags: { core: { sourceId: WARRIOR_MODE_ID } } }] : [],
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

describe("isWarriorModeActive", () => {
  test("true once the flag is set", () => {
    expect(isWarriorModeActive(makeActor({ active: true }))).toBe(true);
  });

  test("false without the flag", () => {
    expect(isWarriorModeActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("toggleWarriorMode", () => {
  test("activating spends 3 of the driver's own Personal Power and sets the flag", async () => {
    const driver = makeDriver({ personalPower: 5 });
    const actor = makeActor({ active: false, driver });

    await toggleWarriorMode(actor);

    expect(driver.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 2 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'warriorModeActive', true);
  });

  test("deactivating costs nothing and clears the flag", async () => {
    const actor = makeActor({ active: true });
    await toggleWarriorMode(actor);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'warriorModeActive');
  });

  test("refuses to activate without a driver seated", async () => {
    const actor = makeActor({ active: false, driver: null });
    await toggleWarriorMode(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("refuses to activate when the driver can't afford it", async () => {
    const driver = makeDriver({ personalPower: 2 });
    const actor = makeActor({ active: false, driver });

    await toggleWarriorMode(actor);

    expect(driver.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing for a non-Zord actor", async () => {
    const actor = { ...makeActor(), type: 'playerCharacter' };
    await toggleWarriorMode(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing without the Feature", async () => {
    const driver = makeDriver();
    const actor = makeActor({ hasFeature: false, driver });
    await toggleWarriorMode(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("clearWarriorMode", () => {
  test("clears an active flag", async () => {
    const actor = makeActor({ active: true });
    await clearWarriorMode(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'warriorModeActive');
  });

  test("no-ops when not active", async () => {
    const actor = makeActor({ active: false });
    await clearWarriorMode(actor);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
