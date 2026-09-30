import { jest } from '@jest/globals';
import { addToxicTerrorStack, getToxicTerrorShiftDown, isToxicTerrorActive, toggleToxicTerror } from './toxic-terror.mjs';

// No settings registered, so the scene clock reads its default epoch of 1.
global.game = {};

const LIVE = { epoch: 1, window: 'scene', count: 1 };

function makeActor({ active = undefined, power = 1 } = {}) {
  const flagStore = { toxicTerrorActive: active };
  return {
    system: { powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isToxicTerrorActive", () => {
  test("false by default", () => {
    expect(isToxicTerrorActive(makeActor())).toBe(false);
  });

  test("true while switched on this scene", () => {
    expect(isToxicTerrorActive(makeActor({ active: LIVE }))).toBe(true);
  });

  test("false once the GM starts a new scene, and for an old bare `true`", () => {
    expect(isToxicTerrorActive(makeActor({ active: { ...LIVE, epoch: 0 } }))).toBe(false);
    expect(isToxicTerrorActive(makeActor({ active: true }))).toBe(false);
  });
});

describe("toggleToxicTerror", () => {
  test("activates for the rest of the scene and spends 1 Personal Power", async () => {
    const actor = makeActor({ power: 1 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', LIVE);
  });

  test("returns null and spends nothing when unaffordable", async () => {
    const actor = makeActor({ power: 0 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makeActor({ active: LIVE, power: 0 });
    const result = await toggleToxicTerror(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', false);
  });
});

describe("addToxicTerrorStack / getToxicTerrorShiftDown", () => {
  function makeTargetActor({ stacks = undefined } = {}) {
    const flagStore = { toxicTerrorStacks: stacks };
    return {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  test("0 with no stacks", () => {
    expect(getToxicTerrorShiftDown(makeTargetActor())).toBe(0);
  });

  test("adding a stack increments this scene's count", async () => {
    const target = makeTargetActor({ stacks: LIVE });
    await addToxicTerrorStack(target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorStacks', { epoch: 1, window: 'scene', count: 2 });
    expect(getToxicTerrorShiftDown(target)).toBe(2);
  });

  test("stacks from an earlier scene, or an old bare number, no longer count", async () => {
    expect(getToxicTerrorShiftDown(makeTargetActor({ stacks: { epoch: 0, window: 'scene', count: 3 } }))).toBe(0);
    expect(getToxicTerrorShiftDown(makeTargetActor({ stacks: 3 }))).toBe(0);

    const target = makeTargetActor({ stacks: { epoch: 0, window: 'scene', count: 3 } });
    await addToxicTerrorStack(target);
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorStacks', { epoch: 1, window: 'scene', count: 1 });
  });
});
