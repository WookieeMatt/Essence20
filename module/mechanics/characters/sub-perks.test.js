import { nestSubPerks, withSubPerksUnderParents } from './sub-perks.mjs';

const perk = (id, { parentId = null, level = null, type = 'perk' } = {}) => ({
  id, type, name: id, flags: parentId ? { essence20: { parentId } } : {}, system: { grantedLevel: level },
});

function collection(list) {
  return Object.assign([...list], { get: id => list.find(item => item.id == id) });
}

describe('sub-Perks on the actor sheet', () => {
  test("a Perk picked from another Perk's list takes its level and is marked as its child", () => {
    const gridTech = perk('gridTech', { parentId: 'role', level: 2 });
    const receivers = perk('receivers', { parentId: 'gridTech' });
    const transmitters = perk('transmitters', { parentId: 'gridTech' });
    const role = perk('role', { type: 'role' });
    nestSubPerks(collection([role, gridTech, receivers, transmitters]));
    expect([receivers.system.grantedLevel, transmitters.system.grantedLevel]).toEqual([2, 2]);
    expect(receivers.system.subPerkOf).toBe('gridTech');
    // A Perk granted by a Role (not a Perk) is not a sub-Perk.
    expect(gridTech.system.subPerkOf).toBeUndefined();
  });

  test('its own level is kept; a chain follows up to the first level', () => {
    const top = perk('top', { level: 4 });
    const middle = perk('middle', { parentId: 'top' });
    const bottom = perk('bottom', { parentId: 'middle' });
    const ownLevel = perk('own', { parentId: 'top', level: 7 });
    nestSubPerks(collection([top, middle, bottom, ownLevel]));
    expect([middle.system.grantedLevel, bottom.system.grantedLevel, ownLevel.system.grantedLevel]).toEqual([4, 4, 7]);
  });

  test('sub-Perks list right after their parent, in order; ones whose parent is elsewhere stay put', () => {
    const a = perk('a');
    const parent = perk('parent');
    const b = perk('b');
    const child1 = { ...perk('child1'), system: { subPerkOf: 'parent' } };
    const child2 = { ...perk('child2'), system: { subPerkOf: 'parent' } };
    const stray = { ...perk('stray'), system: { subPerkOf: 'elsewhere' } };
    const ordered = withSubPerksUnderParents([child1, a, parent, stray, b, child2]);
    expect(ordered.map(item => item.id)).toEqual(['a', 'parent', 'child1', 'child2', 'stray', 'b']);
  });
});
