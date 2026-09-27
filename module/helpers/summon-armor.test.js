import { jest } from '@jest/globals';
import { applySummonArmor, getSummonArmorDefenseBonus, isSummonArmorActive } from './summon-armor.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { summonArmorActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isSummonArmorActive / applySummonArmor", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isSummonArmorActive(actor)).toBe(false);
    await applySummonArmor(actor);
    expect(isSummonArmorActive(actor)).toBe(true);
  });
});

describe("getSummonArmorDefenseBonus", () => {
  test("+2 to Toughness while active", () => {
    expect(getSummonArmorDefenseBonus(makeActor({ active: true }), 'toughness')).toBe(2);
  });

  test("+2 to Evasion while active", () => {
    expect(getSummonArmorDefenseBonus(makeActor({ active: true }), 'evasion')).toBe(2);
  });

  test("0 for an unrelated Defense, even while active", () => {
    expect(getSummonArmorDefenseBonus(makeActor({ active: true }), 'willpower')).toBe(0);
  });

  test("0 while inactive", () => {
    expect(getSummonArmorDefenseBonus(makeActor({ active: false }), 'toughness')).toBe(0);
  });
});
