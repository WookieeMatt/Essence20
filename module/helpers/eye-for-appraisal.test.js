import { jest } from '@jest/globals';
import { canUseEyeForAppraisal, markEyeForAppraisal } from './eye-for-appraisal.mjs';

global.ui = { notifications: { warn: jest.fn() } };
global.ChatMessage = { getSpeaker: jest.fn(() => ({})) };
const toMessage = jest.fn();
global.Roll = jest.fn(() => ({ evaluate: async function () {
  this.total = 3; return this; 
}, toMessage }));

function makeActor({ id = 'raider1' } = {}) {
  const flags = {};
  return {
    id,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

function makeTargetsSet(actor) {
  const targets = actor ? new Set([{ actor }]) : new Set();
  targets.first = () => (actor ? { actor } : undefined);
  return targets;
}

describe("markEyeForAppraisal", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("marks the currently-targeted token with a 2d2-use flag keyed to the marking actor", async () => {
    const actor = makeActor({ id: 'raider1' });
    const targetActor = { setFlag: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(targetActor) } };

    const result = await markEyeForAppraisal(actor);
    expect(result).toBe(true);
    expect(global.Roll).toHaveBeenCalledWith('2d2');
    expect(toMessage).toHaveBeenCalled();
    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'eyeForAppraisalMark', { attackerId: 'raider1', usesRemaining: 3 },
    );
  });

  test("warns and returns false when nothing is targeted", async () => {
    const actor = makeActor();
    global.game = { user: { targets: makeTargetsSet(null) }, i18n: { localize: (k) => k } };

    const result = await markEyeForAppraisal(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("is once per scene: a second use in the same scene does nothing", async () => {
    const actor = makeActor({ id: 'raider1' });
    const targetActor = { setFlag: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(targetActor) } };

    expect(canUseEyeForAppraisal(actor)).toBe(true);
    await markEyeForAppraisal(actor);
    expect(canUseEyeForAppraisal(actor)).toBe(false);

    targetActor.setFlag.mockClear();
    expect(await markEyeForAppraisal(actor)).toBe(false);
    expect(targetActor.setFlag).not.toHaveBeenCalled();
  });
});
