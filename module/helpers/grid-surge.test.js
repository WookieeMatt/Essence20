import { jest } from '@jest/globals';
import { applyGridSurgeOption, consumeGridSurgeToughness } from './grid-surge.mjs';

global.game = { combat: null };

function makeActor({ isMorphed = true } = {}) {
  const flagStore = {};
  return {
    system: { isMorphed },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

describe("applyGridSurgeOption", () => {
  test("banks the chosen skill for Temporary Construct", async () => {
    const actor = makeActor();
    await applyGridSurgeOption(actor, { option: 'construct', skill: 'alertness' });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGridSurgeConstruct', expect.objectContaining({ skill: 'alertness' }),
    );
  });

  test("banks a first Toughness Boost stack of 1", async () => {
    const actor = makeActor();
    await applyGridSurgeOption(actor, { option: 'toughness' });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGridSurgeToughness', expect.objectContaining({ bonus: 1 }),
    );
  });

  test("stacks Toughness Boost onto an existing pending bonus", async () => {
    const actor = makeActor();
    await applyGridSurgeOption(actor, { option: 'toughness' });
    await applyGridSurgeOption(actor, { option: 'toughness' });
    expect(actor.setFlag).toHaveBeenLastCalledWith(
      'essence20', 'pendingGridSurgeToughness', expect.objectContaining({ bonus: 2 }),
    );
  });

  test("caps Toughness Boost stacking at 3", async () => {
    const actor = makeActor();
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await applyGridSurgeOption(actor, { option: 'toughness' });
    }
    expect(actor.setFlag).toHaveBeenLastCalledWith(
      'essence20', 'pendingGridSurgeToughness', expect.objectContaining({ bonus: 3 }),
    );
  });

  test("banks nothing for 'reshape' (cosmetic only)", async () => {
    const actor = makeActor();
    await applyGridSurgeOption(actor, { option: 'reshape' });
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("consumeGridSurgeToughness", () => {
  test("returns and consumes the banked bonus against Toughness while Morphed", async () => {
    const actor = makeActor({ isMorphed: true });
    await applyGridSurgeOption(actor, { option: 'toughness' });
    await applyGridSurgeOption(actor, { option: 'toughness' });

    const result = await consumeGridSurgeToughness(actor, 'toughness');

    expect(result).toBe(2);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingGridSurgeToughness');
  });

  test("returns 0 with nothing banked", async () => {
    const actor = makeActor();
    expect(await consumeGridSurgeToughness(actor, 'toughness')).toBe(0);
  });

  test("doesn't apply against a different Defense", async () => {
    const actor = makeActor();
    await applyGridSurgeOption(actor, { option: 'toughness' });

    expect(await consumeGridSurgeToughness(actor, 'evasion')).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("doesn't apply while not Morphed, even with a bank pending", async () => {
    const actor = makeActor({ isMorphed: false });
    await applyGridSurgeOption(actor, { option: 'toughness' });

    expect(await consumeGridSurgeToughness(actor, 'toughness')).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
