import { jest } from '@jest/globals';
import { applyBlockMagic, isBlockMagicActive, removeBlockMagic } from './block-magic.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { blockMagicActive: active };
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

describe("isBlockMagicActive / applyBlockMagic / removeBlockMagic", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isBlockMagicActive(actor)).toBe(false);

    await applyBlockMagic(actor);
    expect(isBlockMagicActive(actor)).toBe(true);

    await removeBlockMagic(actor);
    expect(isBlockMagicActive(actor)).toBe(false);
  });
});
