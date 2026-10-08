import { jest } from '@jest/globals';
import { activateMonsterGrow, isMonsterGrown, toggleMonsterGrow } from './monster-grow.mjs';

global.game = { user: { targets: { first: () => undefined } } };

function makeActor({ size = 'common', grown = false } = {}) {
  const flagStore = { monsterGrowOriginalSize: grown ? 'common' : undefined };
  return {
    system: { size },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
    update: jest.fn(),
  };
}

describe("isMonsterGrown", () => {
  test("false by default", () => {
    expect(isMonsterGrown(makeActor())).toBe(false);
  });
});

describe("toggleMonsterGrow", () => {
  test("saves the original size and sets it to Gigantic", async () => {
    const actor = makeActor({ size: 'common' });
    const result = await toggleMonsterGrow(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterGrowOriginalSize', 'common');
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'gigantic' });
  });

  test("restores the original size when already Grown", async () => {
    const actor = makeActor({ size: 'gigantic', grown: true });
    const result = await toggleMonsterGrow(actor);

    expect(result).toBe(false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'common' });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'monsterGrowOriginalSize');
  });
});

describe("activateMonsterGrow", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("toggles Grow on the currently-targeted actor", async () => {
    const targetActor = makeActor({ size: 'common' });
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateMonsterGrow({});

    expect(result).toBe(true);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.size': 'gigantic' });
  });

  test("returns null without a target", async () => {
    const result = await activateMonsterGrow({});
    expect(result).toBeNull();
  });
});
