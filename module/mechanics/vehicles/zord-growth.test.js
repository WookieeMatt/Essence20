import { jest } from '@jest/globals';
import { grownLevels, growthItemData, linkedZords, missingGrowthLevels } from './zord-growth.mjs';
import { recalledThisScene, returnFromRepairs } from './zord-recall.mjs';
import { clashingMegaformTrait } from '../../sheet-handlers/drop-handler.mjs';

/** Zord growth (PR CRB p.134, A Jump Through Time p.83), Recall for Repairs (p.136), Detachable vs Core Body (ATS p.104). */

const zord = (items = []) => ({ uuid: 'Actor.z', name: 'Tyranno', type: 'zord', items: { contents: items }, system: { movement: { ground: { total: 40 } } } });

describe('Zord growth', () => {
  test('the Ranger\'s 5th / 10th / 15th / 20th levels, less those already chosen', () => {
    const grown = zord([{ flags: { essence20: { zordGrowth: { level: 5 } } } }]);
    expect([...grownLevels(grown)]).toEqual([5]);
    expect(missingGrowthLevels({ system: { level: 12 } }, grown)).toEqual([10]);
    expect(missingGrowthLevels({ system: { level: 4 } }, zord())).toEqual([]);
  });

  test("a Ranger's linked Zords are the zord entries on its sheet", () => {
    const z = zord();
    global.fromUuidSync = jest.fn(uuid => (uuid == 'Actor.z' ? z : null));
    expect(linkedZords({ system: { actors: { a: { type: 'zord', uuid: 'Actor.z' }, b: { type: 'npc', uuid: 'Actor.n' } } } })).toEqual([z]);
  });

  test('each choice is a feature item that carries what it does', () => {
    expect(growthItemData(zord(), 5, 'health').effects[0].changes).toEqual([{ key: 'system.health.bonus', mode: 2, value: '1', priority: null }]);
    expect(growthItemData(zord(), 5, 'plating').effects[0].changes[0].key).toBe('system.defenses.toughness.armor');
    expect(growthItemData(zord(), 10, 'movement', { movement: 'ground' }).effects[0].changes[0]).toMatchObject({ key: 'system.movement.ground.bonus', value: '10' });
    expect(growthItemData(zord(), 15, 'driving').system.rules[0]).toMatchObject({ type: 'RollModifier', scope: 'pilot', upshift: 1, when: ['skill:driving'] });
    expect(growthItemData(zord(), 15, 'damage', { effectId: 'e1' }).system.rules[0]).toMatchObject({ type: 'DamageModifier', amount: 1, when: ['item:id:e1'] });
    expect(growthItemData(zord(), 20, 'accurate', { weaponId: 'w1' }).system.rules[0]).toMatchObject({ type: 'WeaponTrait', traits: ['accurate'], items: ['item:id:w1'] });
    const exchange = growthItemData(zord(), 20, 'exchange', { featureId: 'f', featureName: 'Fly-By' });
    expect(exchange.flags.essence20.zordGrowth).toMatchObject({ level: 20, option: 'exchange', featureId: 'f' });
  });

  test('a choice that needs a pick makes nothing without one', () => {
    expect(growthItemData(zord(), 5, 'movement', {})).toBeNull();
    expect(growthItemData(zord(), 5, 'damage', {})).toBeNull();
    expect(growthItemData(zord(), 5, 'nonsense')).toBeNull();
  });
});

describe('Recall for Repairs', () => {
  test('recalled this scene: not yet; an earlier scene: back at full Health with no Conditions', async () => {
    const recalled = epoch => ({
      name: 'Tyranno', statuses: new Set(['prone', 'defeated']), flags: { essence20: { zordRecalled: { epoch } } },
      system: { health: { value: 0, max: 6 } },
      toggleStatusEffect: jest.fn(), update: jest.fn(),
    });
    expect(recalledThisScene(recalled(3), 3)).toBe(true);
    expect(recalledThisScene(recalled(2), 3)).toBe(false);
    expect(recalledThisScene({ flags: {} }, 3)).toBe(false);

    const back = recalled(-99);
    expect(await returnFromRepairs(back)).toBe(true);
    expect(back.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: false });
    expect(back.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': 6, 'system.stun.value': 0 }));
    expect(await returnFromRepairs({ flags: {} })).toBe(false);
  });
});

test('Detachable and Core Body never share a Zord', () => {
  const holder = type => ({ items: [{ type: 'megaformTrait', system: { type } }] });
  expect(clashingMegaformTrait(holder('coreBody'), { system: { type: 'detachable' } })).toBe(true);
  expect(clashingMegaformTrait(holder('detachable'), { system: { type: 'coreBody' } })).toBe(true);
  expect(clashingMegaformTrait(holder('move'), { system: { type: 'detachable' } })).toBe(false);
});
