import { jest } from '@jest/globals';
import { applyFunExhaustionBlock, FUN_EXHAUSTION_ID, hasFunExhaustionHangUp, isBlockedByFunExhaustion } from './fun-exhaustion.mjs';

function setGame(sceneEpoch = 1) {
  global.game = { settings: { get: jest.fn(() => sceneEpoch) } };
}

function makeActor({ hasHangUp = false } = {}) {
  const flags = {};
  return {
    items: hasHangUp ? [{ type: 'hangUp', flags: { core: { sourceId: FUN_EXHAUSTION_ID } } }] : [],
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("Fun Exhaustion (MLP CRB, suggested Hang-Up, p.56)", () => {
  test("hasFunExhaustionHangUp reflects whether the actor holds it", () => {
    expect(hasFunExhaustionHangUp(makeActor({ hasHangUp: true }))).toBe(true);
    expect(hasFunExhaustionHangUp(makeActor())).toBe(false);
  });

  test("isBlockedByFunExhaustion is false until applied", () => {
    setGame(1);
    expect(isBlockedByFunExhaustion(makeActor())).toBe(false);
  });

  test("applyFunExhaustionBlock blocks for the rest of the current scene", async () => {
    setGame(1);
    const actor = makeActor();
    await applyFunExhaustionBlock(actor);
    expect(isBlockedByFunExhaustion(actor)).toBe(true);
  });

  test("the block clears once a new scene begins", async () => {
    setGame(1);
    const actor = makeActor();
    await applyFunExhaustionBlock(actor);
    expect(isBlockedByFunExhaustion(actor)).toBe(true);

    setGame(2);
    expect(isBlockedByFunExhaustion(actor)).toBe(false);
  });
});
