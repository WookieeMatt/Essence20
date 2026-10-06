import { jest } from '@jest/globals';
import { activatePhantom, deactivatePhantomOnAttack, deactivatePhantomOnDamage, isPhantomActive } from './phantom.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { phantomActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    toggleStatusEffect: jest.fn(),
  };
}

describe("isPhantomActive", () => {
  test("reflects the actor's own flag", () => {
    expect(isPhantomActive(makeActor({ active: true }))).toBe(true);
    expect(isPhantomActive(makeActor({ active: false }))).toBe(false);
  });
});

describe("activatePhantom", () => {
  test("sets the flag and applies the invisible status", async () => {
    const actor = makeActor();

    await activatePhantom(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomActive', true);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
  });
});

describe("deactivatePhantomOnAttack", () => {
  test("clears an active Phantom", async () => {
    const actor = makeActor({ active: true });

    await deactivatePhantomOnAttack(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomActive', false);
  });

  test("does nothing while already inactive", async () => {
    const actor = makeActor({ active: false });

    await deactivatePhantomOnAttack(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("deactivatePhantomOnDamage", () => {
  test("clears an active Phantom", async () => {
    const actor = makeActor({ active: true });

    await deactivatePhantomOnDamage(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomActive', false);
  });

  test("does nothing while already inactive", async () => {
    const actor = makeActor({ active: false });

    await deactivatePhantomOnDamage(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
