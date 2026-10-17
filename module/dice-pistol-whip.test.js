import { isPistolWhipEffect, withoutBallistic } from './dice.mjs';

describe('Pistol Whip (Transformers CRB p.66)', () => {
  test('recognises its generated Bludgeon effects', () => {
    expect(isPistolWhipEffect({ flags: { essence20: { o3GeneratedKey: 'w1:pistolWhipBlunt' } } })).toBe(true);
    expect(isPistolWhipEffect({ flags: { essence20: { o3GeneratedKey: 'w1:sfStun' } } })).toBe(false);
    expect(isPistolWhipEffect({ flags: {} })).toBe(false);
  });

  test('the weapon it sees has no Ballistic trait, and is otherwise the same weapon', () => {
    const weapon = { id: 'w1', name: 'Blaster', system: { traits: ['ballistic', 'reload'], itemAndUpgradeTraits: ['ballistic'], hardpoint: { type: 'external' } } };
    const view = withoutBallistic(weapon);
    expect(view.system.traits).toEqual(['reload']);
    expect(view.system.itemAndUpgradeTraits).toEqual([]);
    expect(view.system.hardpoint.type).toBe('external');
    expect(view.id).toBe('w1');
    expect(weapon.system.traits).toEqual(['ballistic', 'reload']);
    expect(withoutBallistic(null)).toBeNull();
  });
});
