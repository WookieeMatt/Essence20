import { jest } from '@jest/globals';
import { isMonsterFormActive } from './monster-morph.mjs';

const PATH_CRUELTY_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.vWie8Dy4u54sf1hy";

function makeActor({ active = false, power = 3, pathId = PATH_CRUELTY_ID, size = 'common', healthBonus = 0 } = {}) {
  const flagStore = { monsterFormActive: active };
  if (active) {
    flagStore.monsterFormPreviousSize = 'common';
  }

  const items = pathId ? [{ type: 'role', flags: { core: { sourceId: pathId } } }] : [];

  return {
    items,
    system: { powers: { personal: { value: power } }, size, health: { bonus: healthBonus } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
    update: jest.fn(),
  };
}

describe("isMonsterFormActive", () => {
  test("false by default", () => {
    expect(isMonsterFormActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isMonsterFormActive(makeActor({ active: true }))).toBe(true);
  });
});

