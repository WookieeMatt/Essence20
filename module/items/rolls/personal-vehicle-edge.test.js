import { jest } from '@jest/globals';
import { personalVehicleSources } from './personal-vehicle-edge.mjs';
import { SUMMON } from '../../mechanics/companions/summons.mjs';

function perk(uuid, extra = {}) {
  return { name: extra.name ?? 'Perk', type: 'perk', flags: { core: { sourceId: uuid } }, system: extra.system ?? {} };
}

function makeActor({ id = 'a1', items = [], flags = {}, statuses = [], system = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id, uuid: `Actor.${id}`, type, items, system, flags: { essence20: { ...flags } },
    statuses: new Set(statuses),
    getActiveTokens: () => [],
    setFlag: jest.fn(async (scope, key, value) => {
      actor.flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(async () => {}),
  };
  return actor;
}

beforeEach(() => {
  global.game = { actors: [], user: { targets: new Set() }, combat: null, i18n: { has: () => false } };
});

describe("personal vehicles", () => {
  function crewed(key, owner, skill) {
    const vehicle = { type: 'vehicle', name: 'Ride', flags: { essence20: { personalVehicle: key, companionOf: owner.uuid } }, system: { actors: { a: { uuid: owner.uuid, vehicleRole: 'driver' } } } };
    game.actors = [vehicle];
    return personalVehicleSources(owner, null, { rolledSkill: skill });
  }

  test("Galaxy Glider gives Edge on Acrobatics while crewing it, labelled with the Perk", () => {
    const owner = makeActor({ items: [perk(SUMMON.galaxyGlider, { name: 'Galaxy Glider' })] });
    expect(crewed('galaxyGlider', owner, 'acrobatics').sources).toEqual([{ id: 'fix3PersonalVehicle', label: 'Galaxy Glider', edge: true }]);
    expect(crewed('galaxyGlider', owner, 'driving').sources).toEqual([]);
  });

  test("Jet Jammer gives Edge on Driving", () => {
    const owner = makeActor({ items: [perk(SUMMON.jetJammer, { name: 'Jet Jammer' })] });
    expect(crewed('jetJammer', owner, 'driving').sources[0]).toMatchObject({ label: 'Jet Jammer', edge: true });
  });

  test("nothing when not crewing a vehicle", () => {
    game.actors = [];
    expect(personalVehicleSources(makeActor(), null, { rolledSkill: 'driving' }).sources).toEqual([]);
  });
});
