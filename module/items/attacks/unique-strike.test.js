import { jest } from '@jest/globals';
import { applyEnhanceStrike, findUniqueStrikeWeaponEffects, grantUniqueStrike } from './unique-strike.mjs';

global.ui = { notifications: { warn: jest.fn(), error: jest.fn() } };
global.game = { i18n: { localize: (k) => k, format: (k) => k } };

function makeActor(items = []) {
  return { items };
}

beforeEach(() => {
  foundry.applications.api.DialogV2 = { wait: jest.fn() };
  global.Item = {
    create: jest.fn(async (data) => ({
      id: data.name + '-id',
      _id: data.name + '-id',
      name: data.name,
      type: data.type,
      system: JSON.parse(JSON.stringify(data.system)),
      flags: data.flags ?? {},
      setFlag: jest.fn(async function (scope, key, value) {
        this.flags[scope] = this.flags[scope] ?? {};
        this.flags[scope][key] = value;
      }),
      update: jest.fn(async function (updateData) {
        for (const [path, value] of Object.entries(updateData)) {
          const keys = path.replace(/^system\./, '').split('.');
          let target = this.system;
          for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
          }

          target[keys[keys.length - 1]] = value;
        }
      }),
    })),
  };
});

describe("grantUniqueStrike - Melee", () => {
  test("creates a weapon+weaponEffect pair with the player's own choices", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Shadow Fang', skill: 'finesse', damageType: 'psychic', range: null, alternateEffect: 'none',
    });
    const actor = makeActor();

    await grantUniqueStrike(actor, false);

    expect(Item.create).toHaveBeenCalledTimes(2);
    const weaponCall = Item.create.mock.calls[0][0];
    const effectCall = Item.create.mock.calls[1][0];
    expect(weaponCall).toMatchObject({ name: 'Shadow Fang', type: 'weapon' });
    expect(effectCall).toMatchObject({
      name: 'Shadow Fang',
      type: 'weaponEffect',
      system: expect.objectContaining({
        classification: { skill: 'finesse', style: 'melee' },
        damageType: 'psychic',
        damageValue: 1,
      }),
    });
  });

  test("Accurate sets accurateShiftUp", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'might', damageType: 'blunt', range: null, alternateEffect: 'accurate',
    });
    await grantUniqueStrike(makeActor(), false);
    expect(Item.create.mock.calls[1][0].system.accurateShiftUp).toBe(1);
  });

  test("Armor Piercing sets hasArmorPiercing", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'might', damageType: 'blunt', range: null, alternateEffect: 'armorPiercing',
    });
    await grantUniqueStrike(makeActor(), false);
    expect(Item.create.mock.calls[1][0].system.hasArmorPiercing).toBe(true);
  });

  test("Maneuver overrides the damage type and adds a downshift", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'might', damageType: 'blunt', range: null, alternateEffect: 'maneuver',
    });
    await grantUniqueStrike(makeActor(), false);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.damageType).toBe('maneuver');
    expect(system.shiftDown).toBe(1);
  });

  test("Multiple Attacks sets numTargets and a downshift", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'might', damageType: 'blunt', range: null, alternateEffect: 'multipleAttacks',
    });
    await grantUniqueStrike(makeActor(), false);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.numTargets).toBe(2);
    expect(system.shiftDown).toBe(1);
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    await grantUniqueStrike(makeActor(), false);
    expect(Item.create).not.toHaveBeenCalled();
  });
});

describe("grantUniqueStrike - Ranged", () => {
  test("creates a fixed-Energy attack with the chosen range", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Photon Lance', skill: 'targeting', damageType: 'element', range: 'standard', alternateEffect: 'none',
    });
    await grantUniqueStrike(makeActor(), true);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.damageType).toBe('element');
    expect(system.range).toEqual({ min: null, reachMultiplier: 1, long: 60, value: 30 });
  });

  test("the flat range option sets an equal value/long", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'athletics', damageType: 'element', range: 'flat', alternateEffect: 'none',
    });
    await grantUniqueStrike(makeActor(), true);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.range).toEqual({ min: null, reachMultiplier: 1, long: 45, value: 45 });
  });

  test("the burst range option sets a self-centered radius instead of a value/long", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'athletics', damageType: 'element', range: 'burst', alternateEffect: 'none',
    });
    await grantUniqueStrike(makeActor(), true);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.radius).toBe(10);
    expect(system.shape).toBe('burst');
  });

  test("Area of Effect sets a radius independent of the chosen range", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({
      name: 'Test', skill: 'athletics', damageType: 'element', range: 'standard', alternateEffect: 'areaOfEffect',
    });
    await grantUniqueStrike(makeActor(), true);
    const system = Item.create.mock.calls[1][0].system;
    expect(system.radius).toBe(10);
    expect(system.shape).toBe('burst');
  });
});

describe("findUniqueStrikeWeaponEffects", () => {
  test("finds every flagged weaponEffect, ignoring everything else", () => {
    const uniqueStrike = { type: 'weaponEffect', flags: { essence20: { isUniqueStrike: true } } };
    const ordinaryEffect = { type: 'weaponEffect', flags: {} };
    const perk = { type: 'perk', flags: { essence20: { isUniqueStrike: true } } };
    const actor = makeActor([uniqueStrike, ordinaryEffect, perk]);

    expect(findUniqueStrikeWeaponEffects(actor)).toEqual([uniqueStrike]);
  });

  test("returns an empty array with no items at all", () => {
    expect(findUniqueStrikeWeaponEffects(makeActor())).toEqual([]);
  });
});

describe("applyEnhanceStrike", () => {
  function makeUniqueStrikeItem(overrides = {}) {
    return {
      id: 'strike1',
      name: 'Unique Strike',
      type: 'weaponEffect',
      flags: { essence20: { isUniqueStrike: true } },
      system: {
        classification: { skill: 'finesse', style: 'melee' },
        damageType: 'blunt',
        damageValue: 1,
        numTargets: 1,
        radius: 0,
        range: { min: null, reachMultiplier: 1, long: null, value: null },
        shiftDown: 0,
        accurateShiftUp: 0,
        hasArmorPiercing: false,
        ...overrides,
      },
      update: jest.fn(async function (updateData) {
        for (const [path, value] of Object.entries(updateData)) {
          const keys = path.replace(/^system\./, '').split('.');
          let target = this.system;
          for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
          }

          target[keys[keys.length - 1]] = value;
        }
      }),
    };
  }

  test("warns with no Unique Strike to enhance", async () => {
    await applyEnhanceStrike(makeActor());
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.EnhanceStrikeNoUniqueStrike');
  });

  test("increasing damage adds 1 to damageValue", async () => {
    const strike = makeUniqueStrikeItem();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('damage');
    await applyEnhanceStrike(makeActor([strike]));
    expect(strike.system.damageValue).toBe(2);
  });

  test("changing the damage type prompts for an Element and applies it", async () => {
    const strike = makeUniqueStrikeItem();
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('elementType')
      .mockResolvedValueOnce('fire');
    await applyEnhanceStrike(makeActor([strike]));
    expect(strike.system.damageType).toBe('fire');
  });

  test("adding an Alternate Effect not already possessed prompts and applies it", async () => {
    const strike = makeUniqueStrikeItem();
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('alternateEffect')
      .mockResolvedValueOnce('armorPiercing');
    await applyEnhanceStrike(makeActor([strike]));
    expect(strike.system.hasArmorPiercing).toBe(true);
  });

  test("range extension only offered for a Ranged Unique Strike, not Melee", async () => {
    const meleeStrike = makeUniqueStrikeItem();
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ content }) => {
      // Range should not appear as a selectable enhancement for a melee strike.
      expect(content).not.toContain('value="range"');
      return 'damage';
    });
    await applyEnhanceStrike(makeActor([meleeStrike]));
  });

  test("range extension adds 10ft to a Ranged Unique Strike's value and long", async () => {
    const rangedStrike = makeUniqueStrikeItem({
      classification: { skill: 'targeting', style: 'element' },
      range: { min: null, reachMultiplier: 1, long: 60, value: 30 },
    });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('range');
    await applyEnhanceStrike(makeActor([rangedStrike]));
    expect(rangedStrike.system.range.value).toBe(40);
    expect(rangedStrike.system.range.long).toBe(70);
  });

  test("prompts which Unique Strike when the actor has more than one", async () => {
    const meleeStrike = makeUniqueStrikeItem({ classification: { skill: 'finesse', style: 'melee' } });
    const rangedStrike = makeUniqueStrikeItem({
      classification: { skill: 'targeting', style: 'element' },
      range: { min: null, reachMultiplier: 1, long: 60, value: 30 },
    });
    rangedStrike.id = 'strike2';
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('strike2')
      .mockResolvedValueOnce('damage');

    await applyEnhanceStrike(makeActor([meleeStrike, rangedStrike]));

    expect(meleeStrike.system.damageValue).toBe(1); // untouched
    expect(rangedStrike.system.damageValue).toBe(2); // the one actually enhanced
  });

  test("cancelling the enhancement picker changes nothing", async () => {
    const strike = makeUniqueStrikeItem();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    await applyEnhanceStrike(makeActor([strike]));
    expect(strike.update).not.toHaveBeenCalled();
  });
});
