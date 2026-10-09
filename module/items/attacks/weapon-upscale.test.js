import { jest } from '@jest/globals';
import {
  handsForSize, upscaledEffectUpdate, upscaledWeaponUpdate, upscaleSizeFor, upscaleWeapon, weaponSizeGap,
} from './weapon-upscale.mjs';
import { sizeClassIndex, sizeClassOf } from '../../mechanics/combat/size-classes.mjs';
import { isTitanClassAttack, paidThisRound, payTitanClass } from './titan-class.mjs';
import { checkPrerequisites } from '../../rules/prerequisites.mjs';

/** Enigma of Combination p.47-49: Table 3-1, hands by size, Titan-Class's Energon; a Combiner's Qualified member. */

beforeAll(() => {
  global.foundry.utils.deepClone ??= value => JSON.parse(JSON.stringify(value));
});

test('size classes count classes, not list positions (Long / Extended are footprints)', () => {
  expect(['long', 'extended', 'extended2', 'extended3'].map(sizeClassOf)).toEqual(['large', 'huge', 'gigantic', 'towering']);
  expect(sizeClassIndex('gigantic') - sizeClassIndex('common')).toBe(3);
  expect(sizeClassIndex('nonsense')).toBe(-1);
});

test('only Gigantic and up upscale; Extended II / III use their class row', () => {
  expect(['huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'].map(upscaleSizeFor))
    .toEqual([null, null, 'gigantic', 'gigantic', 'towering', 'towering', 'titanic']);
});

describe('Table 3-1', () => {
  const blaster = { name: 'Blaster', system: { availability: 'standard', traits: ['ballistic'], prerequisites: { when: ['self:skill:targeting>=d2'] } } };

  test('Gigantic: one level harder, that Size or Brawn d6, +30% range, +1 damage, +50% area', () => {
    const update = upscaledWeaponUpdate(blaster, 'gigantic');
    expect(update['system.availability']).toBe('limited');
    expect(update['system.prerequisites']).toEqual({ when: [{ any: ['self:size>=gigantic', 'self:skill:brawn>=d6'] }] });
    expect(update['flags.essence20.upscaled']).toMatchObject({ size: 'gigantic', prerequisites: { when: ['self:skill:targeting>=d2'] } });
    const effect = { system: { damageValue: 2, classification: { style: 'ranged' }, range: { value: 30, long: 100 }, radius: 10 } };
    expect(upscaledEffectUpdate(effect, 'gigantic')).toEqual({
      'system.damageValue': 3, 'system.range.value': 40, 'system.range.long': 130, 'system.radius': 15,
    });
  });

  test('Towering: two levels (Prototype at most), Trip, +60% range, +2 damage, a 5ft Blast where there was none', () => {
    const update = upscaledWeaponUpdate({ ...blaster, system: { ...blaster.system, availability: 'restricted' } }, 'towering');
    expect(update['system.availability']).toBe('prototype');
    expect(update['system.traits']).toEqual(['ballistic', 'trip']);
    const effect = { system: { damageValue: 1, classification: { style: 'ranged' }, range: { value: 25 } } };
    expect(upscaledEffectUpdate(effect, 'towering')).toMatchObject({ 'system.damageValue': 3, 'system.range.value': 40, 'system.shape': 'circle', 'system.radius': 5 });
  });

  test('Titanic: up to Unique, no range change, +4 damage, Titan-Class and Wrecker; melee keeps its reach', () => {
    const update = upscaledWeaponUpdate(blaster, 'titanic');
    expect(update['system.availability']).toBe('restricted');
    expect(update['system.traits']).toEqual(['ballistic', 'titanClass', 'wrecker', 'trip']);
    const sword = { system: { damageValue: 1, classification: { style: 'melee' }, range: {}, radius: 0 } };
    expect(upscaledEffectUpdate(sword, 'titanic')).toEqual({ 'system.damageValue': 5, 'system.shape': 'circle', 'system.radius': 15 });
  });

  test('upscaling updates the weapon and its own attacks, once', async () => {
    const effect = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { damageValue: 2, classification: { style: 'melee' } } };
    const weapon = { id: 'w1', name: 'Sword', type: 'weapon', flags: {}, system: { availability: 'standard', traits: [] }, update: jest.fn() };
    const actor = { system: { size: 'gigantic' }, items: [weapon, effect], updateEmbeddedDocuments: jest.fn() };
    expect(await upscaleWeapon(actor, weapon)).toBe(true);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ _id: 'e1', 'system.damageValue': 3 }]);
    weapon.flags = { essence20: { upscaled: { size: 'gigantic' } } };
    expect(await upscaleWeapon(actor, weapon)).toBe(false);
  });
});

describe('hands by size (EoC p.48)', () => {
  const normal = { flags: {} };
  const titanic = { flags: { essence20: { upscaled: { size: 'titanic' } } } };
  const towering = { flags: { essence20: { upscaled: { size: 'towering' } } } };

  test('three or more classes smaller: 1 hand; three larger: 2; four or more larger: not normally', () => {
    expect(handsForSize(normal, { system: { size: 'gigantic' } })).toEqual({ hands: 1 });
    expect(handsForSize(normal, { system: { size: 'huge' } })).toBeNull();
    expect(weaponSizeGap(towering, { system: { size: 'common' } })).toBe(4);
    expect(handsForSize({ flags: { essence20: { upscaled: { size: 'gigantic' } } } }, { system: { size: 'common' } })).toEqual({ hands: 2 });
    expect(handsForSize(titanic, { system: { size: 'common' } })).toEqual({ tooLarge: true });
  });
});

describe('Titan-Class: 1 Energon Point a round', () => {
  const weapon = { id: 'w', system: { traits: ['titanClass'] } };
  const effect = { type: 'weaponEffect', flags: { essence20: { parentId: 'w' } } };

  function wielder(energon) {
    const actor = {
      name: 'Bruticus', flags: { essence20: {} }, system: { energon: { normal: { value: energon } } },
      items: { get: id => (id == 'w' ? weapon : null) },
      update: jest.fn(async update => {
        actor.system.energon.normal.value = update['system.energon.normal.value'];
        if (update['flags.essence20.titanClassPaid']) {
          actor.flags.essence20.titanClassPaid = update['flags.essence20.titanClassPaid'];
        }
      }),
    };
    return actor;
  }

  test('pays once a round, refuses with none', async () => {
    global.game.combat = { id: 'c', started: true, round: 2 };
    const actor = wielder(1);
    expect(isTitanClassAttack(actor, effect)).toBe(true);
    expect(await payTitanClass(actor)).toBe(true);
    expect(actor.system.energon.normal.value).toBe(0);
    expect(paidThisRound(actor)).toBe(true);
    expect(await payTitanClass(actor)).toBe(true);
    global.game.combat.round = 3;
    expect(await payTitanClass(actor)).toBe(false);
    global.game.combat = null;
  });
});

describe("a Combiner's weapon needs one Qualified member (EoC p.44)", () => {
  const member = brawn => ({ type: 'playerCharacter', system: { health: { value: 5, max: 5 }, skills: { brawn: { shift: brawn } } } });

  test('met when any active member meets the normal-size prerequisites', () => {
    const weak = member('d2');
    const strong = member('d8');
    global.fromUuidSync = jest.fn(uuid => ({ a: weak, b: strong })[uuid]);
    const form = { type: 'megaform', system: { subtype: ['megaformCombiner'], actors: { x: { uuid: 'a' }, y: { uuid: 'b' } } } };
    const weapon = { type: 'weapon', name: 'Hammer', system: { prerequisites: { when: ['self:skill:brawn>=d6'] } }, flags: {} };
    expect(checkPrerequisites(form, weapon).met).toBe(true);
    global.fromUuidSync = jest.fn(uuid => ({ a: weak, b: weak })[uuid]);
    expect(checkPrerequisites(form, weapon).met).toBe(false);
  });
});
