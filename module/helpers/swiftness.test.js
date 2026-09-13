import { jest } from '@jest/globals';
import { getSwiftnessBonusFeet, getSwiftnessMovementType, pickSwiftnessMovementType, toggleSwiftness } from './swiftness.mjs';

function makeActor({ movementType = null } = {}) {
  const flagStore = { swiftnessMovementType: movementType };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("getSwiftnessMovementType", () => {
  test("null by default", () => {
    expect(getSwiftnessMovementType(makeActor())).toBeNull();
  });
});

describe("toggleSwiftness", () => {
  test("activates the chosen movement type", async () => {
    const actor = makeActor();
    expect(await toggleSwiftness(actor, 'aerial')).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'swiftnessMovementType', 'aerial');
  });

  test("deactivates when re-toggling the same active type", async () => {
    const actor = makeActor({ movementType: 'ground' });
    expect(await toggleSwiftness(actor, 'ground')).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'swiftnessMovementType', null);
  });

  test("switches to the other type when a different one is chosen while active", async () => {
    const actor = makeActor({ movementType: 'ground' });
    expect(await toggleSwiftness(actor, 'aerial')).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'swiftnessMovementType', 'aerial');
  });
});

describe("getSwiftnessBonusFeet", () => {
  test("+20 for the active type", () => {
    const actor = makeActor({ movementType: 'ground' });
    expect(getSwiftnessBonusFeet(actor, 'ground')).toBe(20);
  });

  test("0 for a non-active type", () => {
    const actor = makeActor({ movementType: 'ground' });
    expect(getSwiftnessBonusFeet(actor, 'aerial')).toBe(0);
  });

  test("0 with nothing active", () => {
    expect(getSwiftnessBonusFeet(makeActor(), 'ground')).toBe(0);
  });
});

describe("pickSwiftnessMovementType", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("returns the chosen type on confirm", async () => {
    waitMock.mockResolvedValue('aerial');
    expect(await pickSwiftnessMovementType()).toBe('aerial');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickSwiftnessMovementType()).toBeNull();
  });
});
