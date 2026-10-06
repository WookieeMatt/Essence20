import { jest } from '@jest/globals';
import { checkPrimaryQuarry } from './primary-quarry.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
};

global.ui = {
  notifications: {
    warn: jest.fn(),
  },
};

describe("checkPrimaryQuarry", () => {
  test("true when the target's uuid matches the actor's Primary Quarry", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry(actor, target)).toBe(true);
  });

  test("false when the target's uuid doesn't match", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    const target = { uuid: 'Actor.someoneElse' };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when the actor has no Primary Quarry designated at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when there's no target", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkPrimaryQuarry(actor, null)).toBe(false);
  });

  test("false when both the designated flag and the target's uuid are undefined (loose-equality regression guard)", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    const target = { uuid: undefined };
    expect(checkPrimaryQuarry(actor, target)).toBe(false);
  });

  test("false when the actor has no getFlag method at all", () => {
    const target = { uuid: 'Actor.target1' };
    expect(checkPrimaryQuarry({}, target)).toBe(false);
  });
});
