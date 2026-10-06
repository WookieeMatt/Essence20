import { jest } from '@jest/globals';
import { isMountedWeaponSetUp, pickUpMountedWeapon, setUpMountedWeapon, ORDNANCE_EXPERT } from './mounted-weapons.mjs';

// spend() (mechanics/actions/action-economy.mjs) is run for real rather than module-mocked - see
// sheet-handlers/attachment-handler.test.js's own note on why unstable_mockModule isn't used in
// this project. Same combatant/ledger shape helpers/action-economy.test.js's own makeActor/
// setGame use.
let idCounter = 0;
global.foundry = {
  utils: { randomID: jest.fn(() => `id${++idCounter}`) },
};

function makeCombatant() {
  const flags = {};
  return {
    tokenId: 'token1',
    isOwner: true,
    group: null,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(),
  };
}

function makeActor({ standard = 1, free = 0 } = {}) {
  return {
    name: 'Duke',
    token: { id: 'token1' },
    system: {
      actions: {
        enabled: true,
        standard: { base: 1, bonus: 0, max: standard },
        move: { base: 1, bonus: 0, max: 1 },
        free: { base: 0, bonus: 0, max: free },
      },
    },
  };
}

function setGame({ combatant = null, mode = 'strict' } = {}) {
  global.game = {
    user: { isGM: false, isActiveGM: false },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: { get: jest.fn((scope, key) => (key == 'actionEconomyMode' ? mode : undefined)) },
    combat: combatant
      ? { combatants: [combatant], getCombatantsByActor: jest.fn(() => [combatant]) }
      : null,
  };
  global.ui = { notifications: { warn: jest.fn() } };
}

function makeWeapon(setUp = false) {
  const flags = { essence20: setUp ? { mountedSetUp: true } : {} };
  return {
    name: 'Tripod-Mounted Machine Gun',
    getFlag: jest.fn((scope, key) => flags[scope]?.[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[scope] = { ...flags[scope], [key]: value };
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[scope]?.[key];
    }),
  };
}

beforeEach(() => {
  idCounter = 0;
  setGame({ combatant: makeCombatant() });
});

describe("Mounted (GI Joe CRB, Weapon Effects and Traits, p.148)", () => {
  test("isMountedWeaponSetUp is false for a freshly-authored weapon", () => {
    expect(isMountedWeaponSetUp(makeWeapon())).toBe(false);
  });

  test("Ordnance Expert ignores the Mounted trait", () => {
    const weapon = makeWeapon();
    weapon.parent = { items: [{ flags: { core: { sourceId: ORDNANCE_EXPERT } } }] };
    expect(isMountedWeaponSetUp(weapon)).toBe(true);
  });

  test("isMountedWeaponSetUp is false without a weapon", () => {
    expect(isMountedWeaponSetUp(null)).toBe(false);
  });

  test("setUpMountedWeapon spends a Standard action and flags the weapon", async () => {
    const weapon = makeWeapon();
    const actor = makeActor({ standard: 1 });

    const result = await setUpMountedWeapon(actor, weapon);

    expect(weapon.setFlag).toHaveBeenCalledWith('essence20', 'mountedSetUp', true);
    expect(isMountedWeaponSetUp(weapon)).toBe(true);
    expect(result).toBe(true);
  });

  test("setUpMountedWeapon is refused (and warns) without a Standard action available", async () => {
    const weapon = makeWeapon();
    const actor = makeActor({ standard: 0 });

    const result = await setUpMountedWeapon(actor, weapon);

    expect(weapon.setFlag).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test("pickUpMountedWeapon spends a Free action and clears the flag", async () => {
    const weapon = makeWeapon(true);
    const actor = makeActor({ free: 1 });

    const result = await pickUpMountedWeapon(actor, weapon);

    expect(weapon.unsetFlag).toHaveBeenCalledWith('essence20', 'mountedSetUp');
    expect(isMountedWeaponSetUp(weapon)).toBe(false);
    expect(result).toBe(true);
  });

  test("pickUpMountedWeapon is refused without a Free action available", async () => {
    const weapon = makeWeapon(true);
    const actor = makeActor({ free: 0 });

    const result = await pickUpMountedWeapon(actor, weapon);

    expect(weapon.unsetFlag).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
