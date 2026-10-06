import { jest } from '@jest/globals';

import {
  activateConsummatePerformer,
  claimConsummatePerformer,
  getConsummatePerformerDif,
  onActivateConsummatePerformer,
} from './consummate-performer.mjs';

function makeActor({ usage = null, cheerValue = 1, cheerMax = 3, hasCheerPoints = true } = {}) {
  const flagStore = { consummatePerformerUsage: usage };
  const rolePoints = hasCheerPoints
    ? { name: 'Cheer Points', system: { resource: { value: cheerValue, max: cheerMax } }, update: jest.fn(async (changes) => changes) }
    : null;

  return {
    name: 'Pinkie Pie',
    items: { documentsByType: { rolePoints: rolePoints ? [rolePoints] : [] } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    _dice: { rollSkill: jest.fn(async () => {}) },
    _rolePoints: rolePoints,
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("getConsummatePerformerDif", () => {
  test("is 5 with no usage recorded yet", () => {
    expect(getConsummatePerformerDif(makeActor())).toBe(5);
  });

  test("is 5 again on a new day, even with yesterday's usage still recorded", () => {
    const actor = makeActor({ usage: { bucket: '2000-01-01', count: 3 } });
    expect(getConsummatePerformerDif(actor)).toBe(5);
  });

  test("escalates by 5 per use already made today", () => {
    const actor = makeActor({ usage: { bucket: TODAY, count: 2 } });
    expect(getConsummatePerformerDif(actor)).toBe(15);
  });
});

describe("activateConsummatePerformer", () => {
  test("records today's use and rolls Performance at the current DIF", async () => {
    const actor = makeActor({ usage: { bucket: TODAY, count: 1 } });
    await activateConsummatePerformer(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'consummatePerformerUsage', { bucket: TODAY, count: 2 });
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      { skill: 'performance', shiftUp: 0, shiftDown: 0, dif: '10', consummatePerformer: true },
      actor,
    );
  });

  test("starts a fresh count on the first use of the day", async () => {
    const actor = makeActor();
    await activateConsummatePerformer(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'consummatePerformerUsage', { bucket: TODAY, count: 1 });
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ dif: '5' }),
      actor,
    );
  });
});

describe("claimConsummatePerformer", () => {
  test("adds 1 Cheer, capped at the pool's own max", async () => {
    const actor = makeActor({ cheerValue: 2, cheerMax: 3 });
    expect(await claimConsummatePerformer(actor)).toBe(true);
    expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 3 });
  });

  test("never exceeds the pool's max", async () => {
    const actor = makeActor({ cheerValue: 3, cheerMax: 3 });
    expect(await claimConsummatePerformer(actor)).toBe(true);
    expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 3 });
  });

  test("false when the actor has no Cheer Points pool", async () => {
    const actor = makeActor({ hasCheerPoints: false });
    expect(await claimConsummatePerformer(actor)).toBe(false);
  });
});

describe("onActivateConsummatePerformer", () => {
  test("does nothing when the item has no owning actor", async () => {
    global.fromUuid = jest.fn().mockResolvedValue({ parent: null });
    await onActivateConsummatePerformer({ target: { dataset: { uuid: 'Actor.x.Item.y' } } });
    // No throw, and nothing to assert beyond "didn't crash" - covered by the guard clause itself.
  });

  test("resolves the item's owning actor and activates the ability", async () => {
    const actor = makeActor();
    global.fromUuid = jest.fn().mockResolvedValue({ parent: actor });

    await onActivateConsummatePerformer({ target: { dataset: { uuid: 'Actor.x.Item.y' } } });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });
});
