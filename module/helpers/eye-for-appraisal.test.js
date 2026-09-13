import { jest } from '@jest/globals';
import { markEyeForAppraisal } from './eye-for-appraisal.mjs';

global.ui = { notifications: { warn: jest.fn() } };

function makeActor({ id = 'raider1' } = {}) {
  return { id, setFlag: jest.fn() };
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

  test("marks the currently-targeted token with a 2-use flag keyed to the marking actor", async () => {
    const actor = makeActor({ id: 'raider1' });
    const targetActor = { setFlag: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(targetActor) } };

    const result = await markEyeForAppraisal(actor);

    expect(result).toBe(true);
    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'eyeForAppraisalMark', { attackerId: 'raider1', usesRemaining: 2 },
    );
  });

  test("warns and returns false when nothing is targeted", async () => {
    const actor = makeActor();
    global.game = { user: { targets: makeTargetsSet(null) }, i18n: { localize: (k) => k } };

    const result = await markEyeForAppraisal(actor);

    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});
