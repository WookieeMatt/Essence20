import { jest } from '@jest/globals';
import { activateMobileMode, getMobileModeType, pickMobileModeType } from './mobile-mode.mjs';

function makeActor({ movementType = null } = {}) {
  const flagStore = { mobileModeType: movementType };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("getMobileModeType", () => {
  test("null by default", () => {
    expect(getMobileModeType(makeActor())).toBeNull();
  });

  test("returns the set movement type", () => {
    expect(getMobileModeType(makeActor({ movementType: 'aerial' }))).toBe('aerial');
  });
});

describe("activateMobileMode", () => {
  test("sets the mobileModeType flag to the given movement type", async () => {
    const actor = makeActor();
    await activateMobileMode(actor, 'swim');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'mobileModeType', 'swim');
  });
});

describe("pickMobileModeType", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = {
      i18n: { localize: jest.fn((key) => key) },
    };
  });

  test("returns the chosen movement type on confirm", async () => {
    waitMock.mockResolvedValue('climb');

    const result = await pickMobileModeType();

    expect(result).toBe('climb');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');

    const result = await pickMobileModeType();

    expect(result).toBeNull();
  });

  test("returns null when the dialog resolves with nothing", async () => {
    waitMock.mockResolvedValue(null);

    const result = await pickMobileModeType();

    expect(result).toBeNull();
  });
});
