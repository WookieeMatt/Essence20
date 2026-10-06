import { jest } from '@jest/globals';
import { healUnbeatableAtTurnStart } from './unbeatable.mjs';

const UNBEATABLE_ID = "Compendium.essence20.gi_joe_crb.Item.cyiPxpwROFcBZZkm";

function makeActor({ hasPerk = true, value = 3, max = 10, defeated = false } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: UNBEATABLE_ID } } }] : [],
    statuses: new Set(defeated ? ['defeated'] : []),
    system: { health: { value, max } },
    update: jest.fn(),
  };
}

describe("healUnbeatableAtTurnStart", () => {
  test("heals 1 Health when at half Health or fewer", async () => {
    const actor = makeActor({ value: 5, max: 10 });
    await healUnbeatableAtTurnStart(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("heals exactly at the half-Health threshold", async () => {
    const actor = makeActor({ value: 4, max: 8 });
    await healUnbeatableAtTurnStart(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("doesn't heal above half Health", async () => {
    const actor = makeActor({ value: 6, max: 10 });
    await healUnbeatableAtTurnStart(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("doesn't apply without the Perk", async () => {
    const actor = makeActor({ hasPerk: false, value: 5, max: 10 });
    await healUnbeatableAtTurnStart(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("doesn't apply while Defeated", async () => {
    const actor = makeActor({ value: 0, max: 10, defeated: true });
    await healUnbeatableAtTurnStart(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
