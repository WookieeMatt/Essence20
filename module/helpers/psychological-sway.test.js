import { jest } from '@jest/globals';
import { activatePsychologicalSway, PENDING_PSYCHOLOGICAL_SWAY_FLAG } from './psychological-sway.mjs';

function setGame() {
  global.game = { user: { targets: { first: jest.fn() } }, combat: null, i18n: { localize: (k) => k, format: (k, v) => `${k} ${JSON.stringify(v)}` } };
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
}

function makeTargetActor() {
  const flags = {};
  return {
    name: 'Foe',
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("Psychological Sway (Enigma of Combination, Counselor Focus, 10th level, p.37)", () => {
  test("banks a ↓1 on the currently-targeted actor's next Skill Test", async () => {
    setGame();
    const targetActor = makeTargetActor();
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const actor = { name: 'Counselor' };

    const result = await activatePsychologicalSway(actor);

    expect(result).toBe(true);
    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_PSYCHOLOGICAL_SWAY_FLAG, expect.objectContaining({ shiftDown: 1 }),
    );
  });

  test("warns and does nothing without a target", async () => {
    setGame();
    game.user.targets.first.mockReturnValue(undefined);
    const actor = { name: 'Counselor' };

    const result = await activatePsychologicalSway(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});
