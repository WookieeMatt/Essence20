import { checkIsLocked } from "./sheet-lock.mjs";

describe("checkIsLocked", () => {
  test("returns false and does not notify when the actor isn't locked", () => {
    const actor = { system: { isLocked: false } };
    expect(checkIsLocked(actor)).toBe(false);
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
  });

  test("returns true and notifies when the actor is locked", () => {
    const actor = { system: { isLocked: true } };
    expect(checkIsLocked(actor)).toBe(true);
    expect(global.ui.notifications.error).toHaveBeenCalledWith('E20.ActorLockError');
  });
});
