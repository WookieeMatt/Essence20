import { jest } from '@jest/globals';
import { applyGrowthBoostHealth } from './growth-boost.mjs';

const GROWTH_BOOST_ID = "Compendium.essence20.jump_through_time.Item.BVrwQKqvOdyNW0KR";

function makeActor({ hasPerk = true, healthBonus = 0 } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: GROWTH_BOOST_ID } } }] : [],
    system: { health: { bonus: healthBonus } },
    update: jest.fn(),
  };
}

describe("applyGrowthBoostHealth", () => {
  test("adds +2 Health bonus when about to Morph, with the Perk", async () => {
    const actor = makeActor({ healthBonus: 1 });
    await applyGrowthBoostHealth(actor, true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
  });

  test("removes it when about to un-Morph, with the Perk", async () => {
    const actor = makeActor({ healthBonus: 3 });
    await applyGrowthBoostHealth(actor, false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    await applyGrowthBoostHealth(actor, true);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
