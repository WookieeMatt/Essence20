import { jest } from '@jest/globals';
import { isItsTimeActive, toggleItsTime } from './its-time.mjs';

function makeActor(isMorphed = false) {
  const actor = {
    system: { isMorphed },
    update: jest.fn(async (data) => {
      if ("system.isMorphed" in data) {
        actor.system.isMorphed = data["system.isMorphed"];
      }
    }),
  };
  return actor;
}

describe("isItsTimeActive", () => {
  test("false by default", () => {
    expect(isItsTimeActive(makeActor())).toBe(false);
  });

  test("true once isMorphed is set", () => {
    expect(isItsTimeActive(makeActor(true))).toBe(true);
  });
});

describe("toggleItsTime", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleItsTime(actor);
    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ "system.isMorphed": true }, { essence20: { silentState: true } });
    expect(isItsTimeActive(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleItsTime(actor);
    expect(result).toBe(false);
    expect(actor.update).toHaveBeenCalledWith({ "system.isMorphed": false }, { essence20: { silentState: true } });
    expect(isItsTimeActive(actor)).toBe(false);
  });
});
