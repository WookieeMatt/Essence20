import { jest } from '@jest/globals';
import { activateCleverMind, canUseCleverMind, consumeCleverMind } from './clever-mind.mjs';

global.game = { i18n: { localize: (k) => k } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor({ cheer = 1 } = {}) {
  const rolePoints = { name: 'Cheer Points', system: { resource: { value: cheer } }, update: jest.fn(async (data) => {
    rolePoints.system.resource.value = data['system.resource.value'];
  }) };
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

beforeEach(() => ui.notifications.warn.mockReset());

describe("canUseCleverMind / activateCleverMind", () => {
  test("false with no Cheer, true otherwise", () => {
    expect(canUseCleverMind(makeActor({ cheer: 0 }))).toBe(false);
    expect(canUseCleverMind(makeActor({ cheer: 1 }))).toBe(true);
  });

  test("spends 1 Cheer and banks the pending flag", async () => {
    const actor = makeActor({ cheer: 2 });

    const spent = await activateCleverMind(actor);

    expect(spent).toBe(true);
    expect(actor._rolePoints.system.resource.value).toBe(1);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingCleverMindDefense', expect.any(Object));
  });

  test("warns and returns false with no Cheer", async () => {
    const actor = makeActor({ cheer: 0 });

    const spent = await activateCleverMind(actor);

    expect(spent).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("consumeCleverMind", () => {
  function makeTarget({ banked = false, cleverness = 15, toughness = 10 } = {}) {
    const flags = banked ? { pendingCleverMindDefense: {} } : {};
    return {
      getFlag: jest.fn((scope, key) => flags[key]),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flags[key]; 
      }),
      system: { defenses: { toughness: { total: toughness }, cleverness: { total: cleverness } } },
    };
  }

  test("0 with nothing banked", async () => {
    const target = makeTarget({ banked: false });
    expect(await consumeCleverMind(target, 'toughness')).toBe(0);
  });

  test("0 when the attack already targeted Cleverness", async () => {
    const target = makeTarget({ banked: true });
    expect(await consumeCleverMind(target, 'cleverness')).toBe(0);
  });
});
