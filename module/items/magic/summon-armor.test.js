import { getSummonArmorDefenseBonus, isSummonArmorActive } from './summon-armor.mjs';

global.game = { combat: null };

// Summon Armor / Shield's own rules mark the target summonArmor (rules/conv14-dice.test.js covers the casts).
function makeActor({ active = false } = {}) {
  return { flags: { essence20: active ? { ruleMarks: { summonArmor: { by: 'Actor.caster', until: null, stamp: null } } } : {} } };
}

describe("isSummonArmorActive", () => {
  test("false without the mark, true with it", () => {
    expect(isSummonArmorActive(makeActor())).toBe(false);
    expect(isSummonArmorActive(makeActor({ active: true }))).toBe(true);
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
