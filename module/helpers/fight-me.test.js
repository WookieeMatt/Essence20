import { jest } from '@jest/globals';
import { checkFightMeDownshift, markFightMe } from './fight-me.mjs';

function makeTargetsSet(targetActor) {
  const token = { actor: targetActor };
  const set = new Set(targetActor ? [token] : []);
  set.first = () => (targetActor ? token : undefined);
  return set;
}

describe("markFightMe", () => {
  test("marks the currently-targeted token with the marking actor's id", async () => {
    const target = { setFlag: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(target) } };
    const actor = { id: 'ranger1' };

    const result = await markFightMe(actor);

    expect(result).toBe(true);
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'fightMeMarkedBy', 'ranger1');
  });

  test("returns false with no target selected", async () => {
    global.game = { user: { targets: makeTargetsSet(null) } };
    const actor = { id: 'ranger1' };

    expect(await markFightMe(actor)).toBe(false);
  });
});

describe("checkFightMeDownshift", () => {
  function makeActor(markedBy) {
    return { getFlag: jest.fn(() => markedBy) };
  }

  test("true when marked and attacking someone other than the marker", () => {
    const actor = makeActor('ranger1');
    expect(checkFightMeDownshift(actor, { id: 'someoneElse' })).toBe(true);
  });

  test("false when attacking the marker themselves", () => {
    const actor = makeActor('ranger1');
    expect(checkFightMeDownshift(actor, { id: 'ranger1' })).toBe(false);
  });

  test("false when not marked at all", () => {
    const actor = makeActor(undefined);
    expect(checkFightMeDownshift(actor, { id: 'anyone' })).toBe(false);
  });
});
