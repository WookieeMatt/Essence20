import { jest } from '@jest/globals';
import { isPerfectDisguiseActive, togglePerfectDisguise } from './perfect-disguise.mjs';

function makeActor({ active = false } = {}) {
  return {
    getFlag: jest.fn(() => active),
    setFlag: jest.fn(),
  };
}

describe("isPerfectDisguiseActive", () => {
  test("reflects the stored flag", () => {
    expect(isPerfectDisguiseActive(makeActor({ active: true }))).toBe(true);
    expect(isPerfectDisguiseActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("togglePerfectDisguise", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("switching ON marks the encounter used", async () => {
    const actor = makeActor({ active: false });
    const result = await togglePerfectDisguise(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'perfectDisguiseUsedThisEncounter', {
      epoch: 1,
      window: 'encounter',
      count: 1,
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'perfectDisguiseActive', true);
  });

  test("returns null and doesn't activate once already used this encounter", async () => {
    const actor = makeActor({ active: false });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'perfectDisguiseUsedThisEncounter' ? { epoch: 1, window: 'encounter', count: 1 } : false
    ));

    const result = await togglePerfectDisguise(actor);

    expect(result).toBeNull();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("switching back OFF is free and doesn't consume another use", async () => {
    const actor = makeActor({ active: true });
    const result = await togglePerfectDisguise(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'perfectDisguiseActive', false);
    expect(actor.setFlag).not.toHaveBeenCalledWith(
      'essence20', 'perfectDisguiseUsedThisEncounter', expect.anything(),
    );
  });

  test("switching ON outside combat always succeeds (hasUsedThisEncounter no-ops outside combat)", async () => {
    game.combat = null;
    const actor = makeActor({ active: false });
    const result = await togglePerfectDisguise(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'perfectDisguiseActive', true);
  });
});
