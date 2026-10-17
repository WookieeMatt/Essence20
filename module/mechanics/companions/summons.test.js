import { jest } from '@jest/globals';
import { BATTLIZERS, battlizerAttackUsedUp, markBattlizerAttack, summonBattlizer } from './summons.mjs';

const QUANTUM_MEGA = 'Compendium.essence20.jump_through_time.Item.WiaxmqhCQSYpJIeK';

function flagged(obj) {
  obj.flags ??= {};
  obj.flags.essence20 ??= {};
  obj.getFlag = (scope, key) => obj.flags?.[scope]?.[key];
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    obj.flags[scope][key] = value;
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  obj.update = jest.fn(async () => {});
  return obj;
}

function makeActor() {
  const list = [];
  const actor = flagged({
    id: 'a1', uuid: 'Actor.a1', name: 'Ranger', type: 'playerCharacter',
    system: { isMorphed: true, powers: { personal: { value: 6 } } },
    items: Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) }),
    effects: [],
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map((d, i) => {
      const item = flagged({ ...d, id: d._id ?? `new${i}`, flags: d.flags ?? {}, system: d.system ?? {} });
      list.push(item);
      return item;
    })),
  });
  return actor;
}

beforeEach(() => {
  let n = 0;
  global.game = {
    i18n: { localize: key => key, format: key => key },
    settings: { get: () => 1 },
    user: { isGM: true },
  };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: {
      randomID: () => `rid${n++}`,
      mergeObject: function merge(a, b) {
        const out = { ...a };
        for (const [key, value] of Object.entries(b)) {
          out[key] = value && typeof value == 'object' && !Array.isArray(value) ? merge(a[key] ?? {}, value) : value;
        }

        return out;
      },
    },
  };
});

describe('Quantum Mega Battle Armor (A Jump Through Time p.69)', () => {
  test('the Energy Sword Time Strike is once per scene and triples its Critical Success damage', () => {
    const strike = BATTLIZERS[QUANTUM_MEGA].attacks.find(a => a.name == 'Energy Sword Time Strike');
    expect(strike).toMatchObject({ damage: 5, usesPerScene: 1, critMultiplier: 3 });
  });

  test('summoning stamps the limit on the weapon and the multiplier on its effect', async () => {
    const actor = makeActor();
    const armor = flagged({ id: 'armor1', name: 'Quantum Mega Battle Armor', type: 'armor', flags: { core: { sourceId: QUANTUM_MEGA } } });
    await summonBattlizer(actor, armor, async () => true);

    const weapon = actor.items.find(i => i.type == 'weapon' && i.name == 'Energy Sword Time Strike');
    const effect = actor.items.find(i => i.type == 'weaponEffect' && i.name == 'Energy Sword Time Strike');
    expect(weapon.system.usesPerScene).toBe(1);
    expect(effect.flags.essence20).toMatchObject({ critMultiplier: 3, battlizerOf: 'armor1', parentId: weapon.id });
    const blades = actor.items.find(i => i.type == 'weapon' && i.name == 'Wing Blades');
    expect(blades.system.usesPerScene).toBeUndefined();
  });
});

describe('battlizerAttackUsedUp / markBattlizerAttack', () => {
  const weapon = (extra = {}) => ({ id: 'w1', name: 'Energy Sword Time Strike', system: { usesPerScene: 1 }, flags: { essence20: { battlizerOf: 'armor1' } }, ...extra });

  test('a 1/scene Battlizer attack is used up after one roll this scene', async () => {
    const actor = makeActor();
    expect(battlizerAttackUsedUp(actor, weapon())).toBe(false);
    await markBattlizerAttack(actor, weapon());
    expect(battlizerAttackUsedUp(actor, weapon())).toBe(true);

    // A new scene.
    game.settings.get = () => 2;
    expect(battlizerAttackUsedUp(actor, weapon())).toBe(false);
  });

  test('ignores weapons that are not Battlizer attacks or have no limit', async () => {
    const actor = makeActor();
    const plain = weapon({ flags: { essence20: {} } });
    await markBattlizerAttack(actor, plain);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(battlizerAttackUsedUp(actor, plain)).toBe(false);
    expect(battlizerAttackUsedUp(actor, weapon({ system: {} }))).toBe(false);
    expect(battlizerAttackUsedUp(actor, null)).toBe(false);
  });
});
