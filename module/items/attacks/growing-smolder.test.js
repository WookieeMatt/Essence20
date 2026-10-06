import { jest } from '@jest/globals';
import { activateGrowingSmolder, consumeGrowingSmolderStacks, getGrowingSmolderStacks } from './growing-smolder.mjs';

function makeActor({ stacks = null } = {}) {
  const flagStore = {};
  if (stacks !== null) {
    flagStore.growingSmolderBank = { stacks, combatId: 'combat1' };
  }

  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1' };
});
afterEach(() => {
  game.combat = null;
});

describe("getGrowingSmolderStacks", () => {
  test("0 with nothing banked", () => {
    expect(getGrowingSmolderStacks(makeActor())).toBe(0);
  });

  test("returns the banked stack count", () => {
    expect(getGrowingSmolderStacks(makeActor({ stacks: 2 }))).toBe(2);
  });
});

describe("activateGrowingSmolder", () => {
  test("banks 1 stack on first activation", async () => {
    const actor = makeActor();
    const result = await activateGrowingSmolder(actor);

    expect(result).toBe(1);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'growingSmolderBank', expect.objectContaining({ stacks: 1 }));
  });

  test("increments an existing stack", async () => {
    const actor = makeActor({ stacks: 1 });
    const result = await activateGrowingSmolder(actor);

    expect(result).toBe(2);
  });

  test("caps at 3 stacks", async () => {
    const actor = makeActor({ stacks: 3 });
    const result = await activateGrowingSmolder(actor);

    expect(result).toBe(3);
  });
});

describe("consumeGrowingSmolderStacks", () => {
  test("returns and clears the banked stacks", async () => {
    const actor = makeActor({ stacks: 2 });
    const result = await consumeGrowingSmolderStacks(actor);

    expect(result).toBe(2);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'growingSmolderBank');
  });

  test("0 and no-op when nothing was banked", async () => {
    const actor = makeActor();
    const result = await consumeGrowingSmolderStacks(actor);

    expect(result).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
