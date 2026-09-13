import { jest } from '@jest/globals';
import {
  getGrowDamageBonus, getGrowDefenseBonus, getMonsterFormSkillBonus, getMonsterFormToughnessBonus,
  isGrowActive, isMonsterFormActive, toggleGrow, toggleMonsterMorph,
} from './monster-morph.mjs';

const PATH_CRUELTY_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.vWie8Dy4u54sf1hy";
const PATH_STONE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.TEjkVjIEFEbRI736";
const PATH_VENOM_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.rWoVOcNc3lXKDbhg";

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

describe("getMonsterFormToughnessBonus", () => {
  test("0 while inactive", () => {
    expect(getMonsterFormToughnessBonus(makeActor({ active: false }))).toBe(0);
  });

  test("the Path's own scaling Toughness bonus while active (Cruelty: +2)", () => {
    expect(getMonsterFormToughnessBonus(makeActor({ active: true, pathId: PATH_CRUELTY_ID }))).toBe(2);
  });

  test("Path of Stone's own higher +4 Toughness bonus", () => {
    expect(getMonsterFormToughnessBonus(makeActor({ active: true, pathId: PATH_STONE_ID }))).toBe(4);
  });
});

describe("getMonsterFormSkillBonus", () => {
  test("0 while inactive", () => {
    expect(getMonsterFormSkillBonus(makeActor({ active: false }), 'might')).toBe(0);
  });

  test("+1 on one of the Path's own named Skills while active", () => {
    const actor = makeActor({ active: true, pathId: PATH_CRUELTY_ID });
    expect(getMonsterFormSkillBonus(actor, 'might')).toBe(1);
    expect(getMonsterFormSkillBonus(actor, 'intimidation')).toBe(1);
    expect(getMonsterFormSkillBonus(actor, 'alertness')).toBe(1);
  });

  test("0 on a Skill not named by the Path", () => {
    const actor = makeActor({ active: true, pathId: PATH_CRUELTY_ID });
    expect(getMonsterFormSkillBonus(actor, 'deception')).toBe(0);
  });

  test("Path of Venom only names 2 Skills, not 3", () => {
    const actor = makeActor({ active: true, pathId: PATH_VENOM_ID });
    expect(getMonsterFormSkillBonus(actor, 'intimidation')).toBe(1);
    expect(getMonsterFormSkillBonus(actor, 'survival')).toBe(1);
    expect(getMonsterFormSkillBonus(actor, 'might')).toBe(0);
  });
});

describe("toggleMonsterMorph", () => {
  test("activates, spends 3 Personal Power, grows to Large, and adds the Health bonus", async () => {
    const actor = makeActor({ active: false, power: 3, pathId: PATH_CRUELTY_ID, size: 'common', healthBonus: 0 });
    const result = await toggleMonsterMorph(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterFormPreviousSize', 'common');
    expect(actor.update).toHaveBeenCalledWith({
      'system.powers.personal.value': 0,
      'system.size': 'large',
      'system.health.bonus': 2,
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterFormActive', true);
  });

  test("returns null and spends nothing when the actor can't afford activation", async () => {
    const actor = makeActor({ active: false, power: 2, pathId: PATH_CRUELTY_ID });
    const result = await toggleMonsterMorph(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("returns null when the actor doesn't follow a recognized Psycho Path", async () => {
    const actor = makeActor({ active: false, power: 3, pathId: null });
    const result = await toggleMonsterMorph(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deactivates for free, restoring the original Size and removing the Health bonus", async () => {
    const actor = makeActor({ active: true, power: 0, pathId: PATH_CRUELTY_ID, size: 'large', healthBonus: 2 });

    const result = await toggleMonsterMorph(actor);

    expect(result).toBe(false);
    expect(actor.update).toHaveBeenCalledWith({
      'system.size': 'common',
      'system.health.bonus': 0,
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterFormActive', false);
  });
});

function makeGrowActor({ monsterFormActive = true, growActive = false, size = 'large' } = {}) {
  const flagStore = { monsterFormActive };
  if (growActive) {
    flagStore.monsterGrowSelfActive = true;
    flagStore.monsterGrowSelfPreviousSize = 'large';
  }

  return {
    items: [{ type: 'role', flags: { core: { sourceId: PATH_CRUELTY_ID } } }],
    system: { powers: { personal: { value: 0 } }, size, health: { bonus: 0 } },
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

describe("isGrowActive", () => {
  test("false when neither flag is set", () => {
    expect(isGrowActive(makeGrowActor({ monsterFormActive: false, growActive: false }))).toBe(false);
  });

  test("true when both Monster Form and Grow are active", () => {
    expect(isGrowActive(makeGrowActor({ monsterFormActive: true, growActive: true }))).toBe(true);
  });

  test("false if Grow's own flag is set but Monster Form isn't active (stale flag)", () => {
    expect(isGrowActive(makeGrowActor({ monsterFormActive: false, growActive: true }))).toBe(false);
  });
});

describe("getGrowDamageBonus / getGrowDefenseBonus", () => {
  test("0/0 while inactive", () => {
    const actor = makeGrowActor({ growActive: false });
    expect(getGrowDamageBonus(actor)).toBe(0);
    expect(getGrowDefenseBonus(actor)).toBe(0);
  });

  test("1/2 while active", () => {
    const actor = makeGrowActor({ growActive: true });
    expect(getGrowDamageBonus(actor)).toBe(1);
    expect(getGrowDefenseBonus(actor)).toBe(2);
  });
});

describe("toggleGrow", () => {
  test("activates and grows to Towering while in Monster Form", async () => {
    const actor = makeGrowActor({ monsterFormActive: true, growActive: false, size: 'large' });
    const result = await toggleGrow(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterGrowSelfPreviousSize', 'large');
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'towering' });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterGrowSelfActive', true);
  });

  test("returns null and does nothing outside Monster Form", async () => {
    const actor = makeGrowActor({ monsterFormActive: false, growActive: false });
    const result = await toggleGrow(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deactivates, restoring the Size from before Grow was activated", async () => {
    const actor = makeGrowActor({ monsterFormActive: true, growActive: true, size: 'towering' });
    const result = await toggleGrow(actor);

    expect(result).toBe(false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'large' });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterGrowSelfActive', false);
  });
});
