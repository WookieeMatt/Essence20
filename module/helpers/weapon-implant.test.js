import { jest } from '@jest/globals';
import { getWeaponImplantTier, WEAPON_IMPLANT_ID } from './weapon-implant.mjs';

const MAJOR_AUGMENTS_ID = "Compendium.essence20.decepticon_directive.Item.0XjyYHChhc0VStRn";
const EXTENSIVE_ENHANCEMENTS_ID = "Compendium.essence20.decepticon_directive.Item.UavRPwxwYnLr4BHA";

function makeActor(...perkIds) {
  return { items: perkIds.map(id => ({ type: 'perk', flags: { core: { sourceId: id } } })) };
}

describe("getWeaponImplantTier", () => {
  test("a DIF 14 Technology roll implants a Standard weapon", () => {
    expect(getWeaponImplantTier(makeActor(WEAPON_IMPLANT_ID), 'technology', '14')).toBe('standard');
  });

  // The Difficulty IS the declaration of tier - each upgrade raises the ceiling by offering a
  // harder test, not by adding a separate ability.
  test("DIF 18 reaches Limited, but only with Major Augments", () => {
    expect(getWeaponImplantTier(makeActor(WEAPON_IMPLANT_ID), 'technology', '18')).toBe(null);
    expect(getWeaponImplantTier(
      makeActor(WEAPON_IMPLANT_ID, MAJOR_AUGMENTS_ID), 'technology', '18',
    )).toBe('limited');
  });

  test("DIF 20 reaches Restricted, but only with Extensive Enhancements", () => {
    expect(getWeaponImplantTier(
      makeActor(WEAPON_IMPLANT_ID, MAJOR_AUGMENTS_ID), 'technology', '20',
    )).toBe(null);
    expect(getWeaponImplantTier(
      makeActor(WEAPON_IMPLANT_ID, EXTENSIVE_ENHANCEMENTS_ID), 'technology', '20',
    )).toBe('restricted');
  });

  test("an unrecognised Difficulty is not an implant attempt", () => {
    expect(getWeaponImplantTier(makeActor(WEAPON_IMPLANT_ID), 'technology', '12')).toBe(null);
    expect(getWeaponImplantTier(makeActor(WEAPON_IMPLANT_ID), 'technology', undefined)).toBe(null);
  });

  test("a non-Technology roll is not an implant attempt", () => {
    expect(getWeaponImplantTier(makeActor(WEAPON_IMPLANT_ID), 'alertness', '14')).toBe(null);
  });

  test("an actor without the Perk never implants anything", () => {
    expect(getWeaponImplantTier(makeActor(), 'technology', '14')).toBe(null);
    expect(getWeaponImplantTier(makeActor(MAJOR_AUGMENTS_ID), 'technology', '18')).toBe(null);
  });
});

describe("findImplantableWeapons", () => {
  afterEach(() => {
    global.game = undefined;
  });

  test("asks for the right availability and excludes Consumable weapons", async () => {
    const entries = [
      { uuid: 'u1', name: 'Blade', type: 'weapon', img: 'i', system: { availability: 'standard', traits: [] } },
      { uuid: 'u2', name: 'Grenade', type: 'weapon', img: 'i', system: { availability: 'standard', traits: ['consumable'] } },
      { uuid: 'u3', name: 'Rifle', type: 'weapon', img: 'i', system: { availability: 'limited', traits: [] } },
    ];
    const pack = {
      documentName: 'Item',
      metadata: { id: 'essence20.dd' },
      getIndex: jest.fn(async () => ({ values: () => entries })),
    };
    const packs = [pack];
    packs.filter = Array.prototype.filter.bind(packs);
    global.game = { packs, settings: { get: () => ({}) }, i18n: { localize: k => k } };

    const { findImplantableWeapons } = await import('./weapon-implant.mjs');
    const rows = await findImplantableWeapons('standard');

    expect(rows.map(r => r.name)).toEqual(['Blade']);
  });
});
