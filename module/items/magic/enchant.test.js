import { jest } from '@jest/globals';
import { applyEnchant, pickEnchantSkill } from './enchant.mjs';

global.game = { combat: null };

describe("pickEnchantSkill", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game.i18n = { localize: jest.fn((key) => key) };
  });

  test("returns the chosen skill on confirm", async () => {
    waitMock.mockResolvedValue('culture');
    expect(await pickEnchantSkill()).toBe('culture');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickEnchantSkill()).toBeNull();
  });
});

describe("applyEnchant", () => {
  test("banks the shiftUp scoped to the chosen skill", async () => {
    const actor = { setFlag: jest.fn() };
    await applyEnchant(actor, 'culture');

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingEnchantShiftUp', expect.objectContaining({ skill: 'culture' }),
    );
  });
});
