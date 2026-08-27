import { createEntry } from "./attachment-handler.mjs";

function droppedItem(type, system = {}) {
  return {
    uuid: `Item.${type}Uuid`,
    img: `icons/${type}.svg`,
    name: `Test ${type}`,
    type,
    system: { description: "desc", ...system },
  };
}

function targetItem(type) {
  return { type };
}

describe("createEntry", () => {
  test("returns null when the target/dropped type combination isn't attachable", () => {
    expect(createEntry(droppedItem('gear'), targetItem('armor'))).toBeNull();
  });

  test("always includes the base uuid/img/name/type/description fields", () => {
    const entry = createEntry(
      droppedItem('perk'),
      targetItem('faction'),
    );
    expect(entry).toMatchObject({
      uuid: "Item.perkUuid",
      img: "icons/perk.svg",
      name: "Test perk",
      type: 'perk',
      description: "desc",
    });
  });

  test("armor + upgrade(armor) carries over the upgrade's armor-specific fields", () => {
    const dropped = droppedItem('upgrade', {
      type: 'armor', armorBonus: { defense: 'toughness', value: 1 }, availability: 'common',
      benefit: 'b', prerequisite: 'p', source: 's', traits: ['t'],
    });
    const entry = createEntry(dropped, targetItem('armor'));
    expect(entry.subtype).toBe('armor');
    expect(entry.armorBonus).toEqual({ defense: 'toughness', value: 1 });
  });

  test("armor + upgrade(weapon) doesn't match and falls through to null", () => {
    const dropped = droppedItem('upgrade', { type: 'weapon' });
    expect(createEntry(dropped, targetItem('armor'))).toBeNull();
  });

  test("equipmentPackage accepts armor/gear/shield/weapon and carries their items", () => {
    const dropped = droppedItem('weapon', { items: { a: {} } });
    const entry = createEntry(dropped, targetItem('equipmentPackage'));
    expect(entry.items).toEqual({ a: {} });
  });

  test("focus + perk sets subtype and level 1", () => {
    const dropped = droppedItem('perk', { type: 'combat' });
    const entry = createEntry(dropped, targetItem('focus'));
    expect(entry.subtype).toBe('combat');
    expect(entry.level).toBe(1);
  });

  test("focus + role returns just the base entry", () => {
    const entry = createEntry(droppedItem('role'), targetItem('focus'));
    expect(entry).not.toHaveProperty('subtype');
  });

  test("influence accepts perk and hangUp", () => {
    expect(createEntry(droppedItem('perk'), targetItem('influence'))).not.toBeNull();
    expect(createEntry(droppedItem('hangUp'), targetItem('influence'))).not.toBeNull();
    expect(createEntry(droppedItem('gear'), targetItem('influence'))).toBeNull();
  });

  test("origin accepts altMode and perk", () => {
    expect(createEntry(droppedItem('altMode'), targetItem('origin'))).not.toBeNull();
    expect(createEntry(droppedItem('perk'), targetItem('origin'))).not.toBeNull();
    expect(createEntry(droppedItem('gear'), targetItem('origin'))).toBeNull();
  });

  test("perk + perk clears role to null (top-level perk, not a role-granted one)", () => {
    const entry = createEntry(droppedItem('perk'), targetItem('perk'));
    expect(entry.role).toBeNull();
  });

  test("role + perk sets subtype and level 1", () => {
    const dropped = droppedItem('perk', { type: 'combat' });
    const entry = createEntry(dropped, targetItem('role'));
    expect(entry.subtype).toBe('combat');
    expect(entry.level).toBe(1);
  });

  test("role + rolePoints carries over resource/bonus fields", () => {
    const dropped = droppedItem('rolePoints', {
      bonus: { type: 'healthBonus' }, isActivatable: true, isActive: false,
      powerCost: 2, resource: { max: 5 },
    });
    const entry = createEntry(dropped, targetItem('role'));
    expect(entry.bonus).toEqual({ type: 'healthBonus' });
    expect(entry.resource).toEqual({ max: 5 });
  });

  test("role + faction returns just the base entry", () => {
    const entry = createEntry(droppedItem('faction'), targetItem('role'));
    expect(entry).not.toHaveProperty('subtype');
  });

  test("shield + weaponEffect carries over combat stats", () => {
    const dropped = droppedItem('weaponEffect', {
      classification: { skill: 'athletics' }, damageValue: 3, damageType: 'blunt',
      numHands: 1, numTargets: 1, radius: 0, range: {}, shiftDown: 0, traits: [], totalReach: 5,
    });
    const entry = createEntry(dropped, targetItem('shield'));
    expect(entry.damageValue).toBe(3);
    expect(entry.totalReach).toBe(5);
  });

  test("weapon + upgrade(weapon) carries the upgrade's weapon-specific fields", () => {
    const dropped = droppedItem('upgrade', { type: 'weapon', traits: ['reload'] });
    const entry = createEntry(dropped, targetItem('weapon'));
    expect(entry.subtype).toBe('weapon');
    expect(entry.traits).toEqual(['reload']);
  });

  test("weapon + weaponEffect carries over combat stats", () => {
    const dropped = droppedItem('weaponEffect', {
      classification: { skill: 'athletics' }, damageValue: 2, damageType: 'blunt',
      numHands: 1, numTargets: 1, radius: 0, range: {}, shiftDown: 0, traits: [], totalReach: 0,
    });
    const entry = createEntry(dropped, targetItem('weapon'));
    expect(entry.damageValue).toBe(2);
  });
});
