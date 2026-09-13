import { jest } from '@jest/globals';
import { convertWeapon, hasConvertibleWeapon } from './weapon-conversion.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
};

global.ui = {
  notifications: { warn: jest.fn() },
};

function makeWeaponEffect({
  id = 'effect1', numHands = 2, style = 'projectile', shiftDown = 0, rangeValue = 60, rangeLong = 120,
  parentId = 'weapon1',
} = {}) {
  return {
    id,
    type: 'weaponEffect',
    name: 'Test Blaster Effect',
    flags: { essence20: { parentId } },
    system: {
      numHands, classification: { style }, shiftDown,
      range: { value: rangeValue, long: rangeLong },
    },
    update: jest.fn(),
  };
}

function makeWeaponItem({ id = 'weapon1', traits = [] } = {}) {
  return { id, name: 'Test Blaster', system: { traits }, update: jest.fn() };
}

function makeActor(items, weaponItem) {
  const allItems = weaponItem ? [...items, weaponItem] : items;
  const arr = [...allItems];
  arr.get = jest.fn(id => allItems.find(item => item.id == id));
  arr.filter = Array.prototype.filter.bind(arr);
  return { items: arr };
}

describe("hasConvertibleWeapon", () => {
  test("true when a two-handed ranged weaponEffect exists", () => {
    const effect = makeWeaponEffect();
    expect(hasConvertibleWeapon(makeActor([effect]))).toBe(true);
  });

  test("false for a one-handed weapon", () => {
    const effect = makeWeaponEffect({ numHands: 1 });
    expect(hasConvertibleWeapon(makeActor([effect]))).toBe(false);
  });

  test("false for a two-handed melee weapon", () => {
    const effect = makeWeaponEffect({ style: 'melee' });
    expect(hasConvertibleWeapon(makeActor([effect]))).toBe(false);
  });

  test("false with no weaponEffect items at all", () => {
    expect(hasConvertibleWeapon(makeActor([]))).toBe(false);
  });
});

describe("convertWeapon", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("converts the actor's only eligible weapon: numHands, shiftDown, and range halved", async () => {
    const effect = makeWeaponEffect({ shiftDown: 0, rangeValue: 60, rangeLong: 120 });
    const weapon = makeWeaponItem();
    const actor = makeActor([effect], weapon);

    const result = await convertWeapon(actor);

    expect(result).toBe(true);
    expect(effect.update).toHaveBeenCalledWith({
      'system.numHands': 1,
      'system.shiftDown': 1,
      'system.range.value': 30,
      'system.range.long': 60,
    });
  });

  test("adds the inaccurate trait to the parent weapon item", async () => {
    const effect = makeWeaponEffect();
    const weapon = makeWeaponItem({ traits: ['ballistic'] });
    const actor = makeActor([effect], weapon);

    await convertWeapon(actor);

    expect(weapon.update).toHaveBeenCalledWith({ 'system.traits': ['ballistic', 'inaccurate'] });
  });

  test("doesn't duplicate the inaccurate trait if the weapon already has it", async () => {
    const effect = makeWeaponEffect();
    const weapon = makeWeaponItem({ traits: ['inaccurate'] });
    const actor = makeActor([effect], weapon);

    await convertWeapon(actor);

    expect(weapon.update).not.toHaveBeenCalled();
  });

  test("preserves any pre-existing shiftDown, adding 1 on top", async () => {
    const effect = makeWeaponEffect({ shiftDown: 1 });
    const weapon = makeWeaponItem();
    const actor = makeActor([effect], weapon);

    await convertWeapon(actor);

    expect(effect.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.shiftDown': 2 }));
  });

  test("floors an odd range value when halving", async () => {
    const effect = makeWeaponEffect({ rangeValue: 45, rangeLong: 101 });
    const weapon = makeWeaponItem();
    const actor = makeActor([effect], weapon);

    await convertWeapon(actor);

    expect(effect.update).toHaveBeenCalledWith(expect.objectContaining({
      'system.range.value': 22, 'system.range.long': 50,
    }));
  });

  test("warns and does nothing with no eligible weapon", async () => {
    const actor = makeActor([]);
    const result = await convertWeapon(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("prompts when multiple eligible weapons exist, converts the chosen one", async () => {
    const effect1 = makeWeaponEffect({ id: 'effect1', parentId: 'weapon1' });
    const effect2 = makeWeaponEffect({ id: 'effect2', parentId: 'weapon2' });
    const weapon1 = makeWeaponItem({ id: 'weapon1' });
    const weapon2 = makeWeaponItem({ id: 'weapon2' });
    const actor = makeActor([effect1, effect2, weapon1, weapon2]);

    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, { form: { elements: { weapon: { value: 'effect2' } } } })),
          },
        },
      },
    };

    const result = await convertWeapon(actor);

    expect(result).toBe(true);
    expect(effect2.update).toHaveBeenCalled();
    expect(effect1.update).not.toHaveBeenCalled();
  });

  test("cancelling the picker converts nothing", async () => {
    const effect1 = makeWeaponEffect({ id: 'effect1', parentId: 'weapon1' });
    const effect2 = makeWeaponEffect({ id: 'effect2', parentId: 'weapon2' });
    const weapon1 = makeWeaponItem({ id: 'weapon1' });
    const weapon2 = makeWeaponItem({ id: 'weapon2' });
    const actor = makeActor([effect1, effect2, weapon1, weapon2]);

    global.foundry = {
      applications: {
        api: {
          DialogV2: { wait: jest.fn(async () => 'cancel') },
        },
      },
    };

    const result = await convertWeapon(actor);

    expect(result).toBe(false);
    expect(effect1.update).not.toHaveBeenCalled();
    expect(effect2.update).not.toHaveBeenCalled();
  });
});
