import { jest } from '@jest/globals';
import { _powerCountUpdate } from "./power-handler.mjs";

function makeActor(personalValue) {
  return {
    update: jest.fn(),
    system: { powers: { personal: { value: personalValue } } },
  };
}

describe("_powerCountUpdate", () => {
  beforeEach(() => {
    global.ui.notifications.error.mockClear();
  });

  test("errors and doesn't update when the cost exceeds the power's max", () => {
    const actor = makeActor(10);
    _powerCountUpdate(actor, 5, 'personal', 8);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("errors and doesn't update when the cost exceeds the actor's current value (non-threat)", () => {
    const actor = makeActor(3);
    _powerCountUpdate(actor, 10, 'personal', 5);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("deducts the cost from the power's value when affordable", () => {
    const actor = makeActor(10);
    _powerCountUpdate(actor, 20, 'personal', 4);
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 6 });
  });

  test("floors the deduction at 0", () => {
    const actor = makeActor(3);
    _powerCountUpdate(actor, 20, 'personal', 3);
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 0 });
  });

  test("threat power type skips the current-value check and is never deducted", () => {
    const actor = { update: jest.fn(), system: { powers: { threat: {} } } };
    _powerCountUpdate(actor, 20, 'threat', 15); // within max, so the threat-only value check is what's being exercised
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("threat power type still errors when the cost exceeds max", () => {
    const actor = { update: jest.fn(), system: { powers: { threat: {} } } };
    _powerCountUpdate(actor, 20, 'threat', 25);
    expect(global.ui.notifications.error).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
