import { jest } from '@jest/globals';
import { isScrambleActive, toggleScramble } from './scramble.mjs';

function makeActor(flagStore = {}) {
  return {
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isScrambleActive", () => {
  test("false by default", () => {
    expect(isScrambleActive(makeActor())).toBe(false);
  });

  test("survives an actor with no getFlag at all", () => {
    expect(isScrambleActive({})).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isScrambleActive(makeActor({ scrambleActive: true }))).toBe(true);
  });
});

describe("toggleScramble", () => {
  test("turns it on, then off again", async () => {
    const actor = makeActor();

    expect(await toggleScramble(actor)).toBe(true);
    expect(isScrambleActive(actor)).toBe(true);

    expect(await toggleScramble(actor)).toBe(false);
    expect(isScrambleActive(actor)).toBe(false);
  });
});
