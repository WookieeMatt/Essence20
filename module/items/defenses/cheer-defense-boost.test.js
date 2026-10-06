import { jest } from '@jest/globals';
import {
  activateCheerDefenseBoost, canAffordCheerDefenseBoost, getCheerDefenseBoost,
  pickCheerDefenseBoostAmount,
} from './cheer-defense-boost.mjs';

global.game = { i18n: { localize: (k) => k }, combat: null };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ cheer = 2 } = {}) {
  const rolePoints = {
    name: 'Cheer Points',
    system: { resource: { value: cheer } },
    update: jest.fn(async (data) => {
      rolePoints.system.resource.value = data['system.resource.value'];
    }),
  };
  const store = {};
  return {
    items: { documentsByType: { rolePoints: cheer == null ? [] : [rolePoints] } },
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete store[key];
    }),
    _rolePoints: rolePoints,
  };
}

describe("pickCheerDefenseBoostAmount", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns the chosen amount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    expect(await pickCheerDefenseBoostAmount(3)).toBe(2);
  });

  test("caps at maxAmount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(99);
    expect(await pickCheerDefenseBoostAmount(3)).toBe(3);
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickCheerDefenseBoostAmount(3)).toBeNull();
  });
});

describe("canAffordCheerDefenseBoost", () => {
  test("true with Cheer, false without", () => {
    expect(canAffordCheerDefenseBoost(makeActor({ cheer: 1 }))).toBe(true);
    expect(canAffordCheerDefenseBoost(makeActor({ cheer: 0 }))).toBe(false);
  });
});

describe("activateCheerDefenseBoost", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen amount and banks it", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    const actor = makeActor({ cheer: 3 });

    const activated = await activateCheerDefenseBoost(actor, 'pendingTestBoost');

    expect(activated).toBe(true);
    expect(actor._rolePoints.system.resource.value).toBe(1);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTestBoost', expect.objectContaining({ amount: 2 }),
    );
  });

  test("does nothing with no Cheer", async () => {
    const actor = makeActor({ cheer: 0 });

    const activated = await activateCheerDefenseBoost(actor, 'pendingTestBoost');

    expect(activated).toBe(false);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("spends nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ cheer: 3 });

    const activated = await activateCheerDefenseBoost(actor, 'pendingTestBoost');

    expect(activated).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("getCheerDefenseBoost", () => {
  test("returns the banked amount", async () => {
    const actor = makeActor();
    await actor.setFlag('essence20', 'pendingTestBoost', { amount: 2, combatId: null, round: null });
    expect(getCheerDefenseBoost(actor, 'pendingTestBoost')).toBe(2);
  });

  test("returns 0 with nothing banked", () => {
    const actor = makeActor();
    expect(getCheerDefenseBoost(actor, 'pendingTestBoost')).toBe(0);
  });
});
