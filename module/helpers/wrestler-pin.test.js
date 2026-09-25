import { jest } from '@jest/globals';
import { canUseWrestlerPin, activateWrestlerPin } from './wrestler-pin.mjs';

global.ui = { notifications: { warn: jest.fn() } };

function makeTargetsSet(actor) {
  const targets = actor ? new Set([{ actor }]) : new Set();
  targets.first = () => (actor ? { actor } : undefined);
  return targets;
}

describe("canUseWrestlerPin", () => {
  test("true when the currently-targeted token is Grappled", () => {
    global.game = { user: { targets: makeTargetsSet({ statuses: new Set(['grappled']) }) } };
    expect(canUseWrestlerPin()).toBe(true);
  });

  test("false when the target isn't Grappled, or nothing is targeted", () => {
    global.game = { user: { targets: makeTargetsSet({ statuses: new Set(['prone']) }) } };
    expect(canUseWrestlerPin()).toBe(false);

    global.game = { user: { targets: makeTargetsSet(null) } };
    expect(canUseWrestlerPin()).toBe(false);
  });
});

describe("activateWrestlerPin", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("Prones a Grappled target", async () => {
    const targetActor = { statuses: new Set(['grappled']), toggleStatusEffect: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(targetActor) } };

    const result = await activateWrestlerPin();

    expect(result).toBe(targetActor);
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
  });

  test("warns and returns null without a Grappled target", async () => {
    global.game = { user: { targets: makeTargetsSet(null) }, i18n: { localize: (k) => k } };

    const result = await activateWrestlerPin();

    expect(result).toBe(null);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("warns and returns null when the target isn't Grappled", async () => {
    const targetActor = { statuses: new Set(), toggleStatusEffect: jest.fn() };
    global.game = { user: { targets: makeTargetsSet(targetActor) }, i18n: { localize: (k) => k } };

    const result = await activateWrestlerPin();

    expect(result).toBe(null);
    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
