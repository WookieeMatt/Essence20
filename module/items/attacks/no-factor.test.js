import { jest } from '@jest/globals';
import { isNoFactorFooled, markNoFactorFooled, clearNoFactorDisguise } from './no-factor.mjs';

describe("markNoFactorFooled / isNoFactorFooled", () => {
  test("adds the target's uuid to the actor's fooled list", async () => {
    const flagStore = {};
    const actor = {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
    const target = { uuid: 'Actor.target1' };

    await markNoFactorFooled(actor, target);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'noFactorFooledUuids', ['Actor.target1']);
    expect(isNoFactorFooled(actor, target)).toBe(true);
  });

  test("accumulates multiple fooled enemies rather than overwriting", async () => {
    const flagStore = {};
    const actor = {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };

    await markNoFactorFooled(actor, { uuid: 'Actor.t1' });
    await markNoFactorFooled(actor, { uuid: 'Actor.t2' });

    expect(flagStore.noFactorFooledUuids).toEqual(['Actor.t1', 'Actor.t2']);
  });

  test("doesn't add a duplicate uuid twice", async () => {
    const flagStore = { noFactorFooledUuids: ['Actor.t1'] };
    const actor = {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };

    await markNoFactorFooled(actor, { uuid: 'Actor.t1' });

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("is a no-op for a target with no uuid", async () => {
    const actor = { getFlag: jest.fn(), setFlag: jest.fn() };
    await markNoFactorFooled(actor, {});
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("isNoFactorFooled is false when the target's uuid isn't in the list", () => {
    const actor = { getFlag: jest.fn(() => ['Actor.other']) };
    expect(isNoFactorFooled(actor, { uuid: 'Actor.target1' })).toBe(false);
  });

  test("isNoFactorFooled is false with no flag set at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(isNoFactorFooled(actor, { uuid: 'Actor.target1' })).toBe(false);
  });

  test("isNoFactorFooled is false for a null target", () => {
    const actor = { getFlag: jest.fn(() => ['Actor.target1']) };
    expect(isNoFactorFooled(actor, null)).toBe(false);
  });
});

describe("clearNoFactorDisguise", () => {
  test("unsets the actor's fooled-enemies flag", async () => {
    const actor = { unsetFlag: jest.fn() };
    await clearNoFactorDisguise(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'noFactorFooledUuids');
  });
});
