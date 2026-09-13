import { jest } from '@jest/globals';
import { applyShatteredMemoriesOption, pickShatteredMemoriesOption } from './shattered-memories.mjs';

global.game = { combat: null, user: { targets: { first: () => undefined } } };

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("applyShatteredMemoriesOption", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("banks the Smarts shiftUp for 'recallTimeline'", async () => {
    const actor = makeActor();
    const result = await applyShatteredMemoriesOption(actor, 'recallTimeline');

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingShatteredMemoriesSmarts', expect.objectContaining({}),
    );
  });

  test("banks a target-scoped Edge for 'recallCharacter'", async () => {
    const actor = makeActor();
    global.game.user.targets = { first: () => ({ actor: { id: 'target1' } }) };

    const result = await applyShatteredMemoriesOption(actor, 'recallCharacter');

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingShatteredMemoriesEdge', expect.objectContaining({ targetId: 'target1' }),
    );
  });

  test("returns false for 'recallCharacter' with nothing targeted", async () => {
    const actor = makeActor();

    const result = await applyShatteredMemoriesOption(actor, 'recallCharacter');

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("pickShatteredMemoriesOption", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game.i18n = { localize: jest.fn((key) => key) };
  });

  test("returns the chosen option on confirm", async () => {
    waitMock.mockResolvedValue('recallCharacter');
    expect(await pickShatteredMemoriesOption()).toBe('recallCharacter');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickShatteredMemoriesOption()).toBeNull();
  });
});
