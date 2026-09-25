import { jest } from '@jest/globals';
import { activateRottenTomatoes, canUseRottenTomatoes, getRottenTomatoesBonus } from './rotten-tomatoes.mjs';

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
    items: { documentsByType: { rolePoints: [rolePoints] } },
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value;
    }),
  };
}

describe("canUseRottenTomatoes", () => {
  test("true with Cheer, false without", () => {
    expect(canUseRottenTomatoes(makeActor({ cheer: 1 }))).toBe(true);
    expect(canUseRottenTomatoes(makeActor({ cheer: 0 }))).toBe(false);
  });
});

describe("activateRottenTomatoes / getRottenTomatoesBonus", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen Cheer and banks the equal Toughness/Evasion bonus", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    const actor = makeActor({ cheer: 3 });

    expect(await activateRottenTomatoes(actor)).toBe(true);
    expect(getRottenTomatoesBonus(actor)).toBe(2);
  });

  test("0 with nothing banked", () => {
    expect(getRottenTomatoesBonus(makeActor())).toBe(0);
  });
});
