import { jest } from '@jest/globals';
import { applyGetToKnow, pickGetToKnowSkill } from './get-to-know.mjs';

describe("pickGetToKnowSkill", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("returns the chosen skill on confirm", async () => {
    waitMock.mockResolvedValue('culture');
    expect(await pickGetToKnowSkill()).toBe('culture');
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickGetToKnowSkill()).toBeNull();
  });
});

describe("applyGetToKnow", () => {
  test("banks the Edge scoped to the skill and target", async () => {
    const actor = { setFlag: jest.fn() };
    await applyGetToKnow(actor, 'culture', 'target1');

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGetToKnowEdge', { skill: 'culture', targetId: 'target1' },
    );
  });
});
