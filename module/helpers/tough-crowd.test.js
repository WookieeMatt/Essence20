import { jest } from '@jest/globals';
import { activateToughCrowd, canUseToughCrowd, getToughCrowdBonus } from './tough-crowd.mjs';

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

describe("canUseToughCrowd", () => {
  test("true with Cheer, false without", () => {
    expect(canUseToughCrowd(makeActor({ cheer: 1 }))).toBe(true);
    expect(canUseToughCrowd(makeActor({ cheer: 0 }))).toBe(false);
  });
});

describe("activateToughCrowd / getToughCrowdBonus", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen Cheer and banks the equal Willpower/Cleverness bonus", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(3);
    const actor = makeActor({ cheer: 4 });

    expect(await activateToughCrowd(actor)).toBe(true);
    expect(getToughCrowdBonus(actor)).toBe(3);
  });

  test("0 with nothing banked", () => {
    expect(getToughCrowdBonus(makeActor())).toBe(0);
  });
});
