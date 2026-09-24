import { jest } from '@jest/globals';
import { grantGridElementalAdaptationResistance } from './grid-elemental-adaptation.mjs';

const GRID_ELEMENTAL_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.5HNnSeIg4JKXiv2F";

function makeActor({ hasPower = true, resistances = {}, power = 1, used = false } = {}) {
  const items = hasPower ? [{ type: 'power', flags: { core: { sourceId: GRID_ELEMENTAL_ADAPTATION_ID } } }] : [];
  const flagStore = used ? { gridElementalAdaptationUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } : {};

  return {
    system: { resistances, powers: { personal: { value: power } } },
    items,
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
    update: jest.fn(),
  };
}

describe("grantGridElementalAdaptationResistance", () => {
  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.game = { combat: { id: 'combat1' } };
  });
  afterEach(() => {
    global.game = originalGame;
  });

  test("grants Resistance and spends 1 Power on an Energy hit", async () => {
    const actor = makeActor({ power: 2 });

    await grantGridElementalAdaptationResistance(actor, 'cold', 3);

    expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.cold': true, 'system.powers.personal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'gridElementalAdaptationUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
  });

  test("no-ops without the Power, on non-Energy damage, already Resistant, unaffordable, already used, or no damage", async () => {
    await grantGridElementalAdaptationResistance(makeActor({ hasPower: false }), 'fire', 3);
    await grantGridElementalAdaptationResistance(makeActor(), 'sharp', 3);
    await grantGridElementalAdaptationResistance(makeActor({ resistances: { fire: true } }), 'fire', 3);
    await grantGridElementalAdaptationResistance(makeActor({ power: 0 }), 'fire', 3);
    const usedActor = makeActor({ used: true });
    await grantGridElementalAdaptationResistance(usedActor, 'fire', 3);
    await grantGridElementalAdaptationResistance(makeActor(), 'fire', 0);

    expect(usedActor.update).not.toHaveBeenCalled();
  });
});
