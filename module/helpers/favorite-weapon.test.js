import { jest } from '@jest/globals';
import { FAVORITE_WEAPON_ID, getFavoriteWeaponItem, pickFavoriteWeapon } from './favorite-weapon.mjs';

global.game = { i18n: { localize: (key) => key } };
global.ui = { notifications: { warn: jest.fn() } };

function makeWeapon(id, { integrated = false } = {}) {
  return { id, type: 'weapon', name: `Weapon ${id}`, system: { classification: { size: integrated ? 'integrated' : 'common' } } };
}

function makeWeaponEffect(parentId, { numHands = 2, skill = 'targeting', shape = null } = {}) {
  return {
    type: 'weaponEffect',
    flags: { essence20: { parentId } },
    system: { numHands, classification: { skill }, shape },
  };
}

function makeActor({ perkChoice = null, hasPerk = true, weapons = [], weaponEffects = [] } = {}) {
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: FAVORITE_WEAPON_ID } }, system: { choice: perkChoice } }]
    : [];
  items.documentsByType = { weaponEffect: weaponEffects };
  items.get = jest.fn((id) => weapons.find(w => w.id == id) ?? null);
  items.find = Array.prototype.find.bind(items);

  return { items };
}

describe("pickFavoriteWeapon", () => {
  let originalFoundry;
  beforeEach(() => {
    originalFoundry = global.foundry;
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  test("prompts with only the eligible weapons and returns the chosen id", async () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1')] });
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('w1');

    expect(await pickFavoriteWeapon(actor)).toBe('w1');
  });

  test("warns and returns null with no eligible weapon", async () => {
    const actor = makeActor({ weapons: [], weaponEffects: [] });

    expect(await pickFavoriteWeapon(actor)).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("excludes an Integrated-sized weapon", async () => {
    const weapon = makeWeapon('w1', { integrated: true });
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1')] });

    expect(await pickFavoriteWeapon(actor)).toBeNull();
  });

  test("excludes a one-handed weaponEffect", async () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1', { numHands: 1 })] });

    expect(await pickFavoriteWeapon(actor)).toBeNull();
  });

  test("excludes a non-Targeting weaponEffect", async () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1', { skill: 'might' })] });

    expect(await pickFavoriteWeapon(actor)).toBeNull();
  });

  test("excludes a weaponEffect with an Area of Effect shape", async () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1', { shape: 'circle' })] });

    expect(await pickFavoriteWeapon(actor)).toBeNull();
  });

  test("returns null when cancelled", async () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ weapons: [weapon], weaponEffects: [makeWeaponEffect('w1')] });
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue(null);

    expect(await pickFavoriteWeapon(actor)).toBeNull();
  });
});

describe("getFavoriteWeaponItem", () => {
  test("resolves the stored choice to the actual owned Item", () => {
    const weapon = makeWeapon('w1');
    const actor = makeActor({ perkChoice: 'w1', weapons: [weapon] });

    expect(getFavoriteWeaponItem(actor)).toBe(weapon);
  });

  test("returns null when never configured", () => {
    const actor = makeActor({ perkChoice: null });

    expect(getFavoriteWeaponItem(actor)).toBeNull();
  });

  test("returns null without the Perk at all", () => {
    const actor = makeActor({ hasPerk: false });

    expect(getFavoriteWeaponItem(actor)).toBeNull();
  });

  test("returns null when the stored id no longer resolves to an owned Item", () => {
    const actor = makeActor({ perkChoice: 'gone', weapons: [] });

    expect(getFavoriteWeaponItem(actor)).toBeNull();
  });
});
