import { jest } from '@jest/globals';
import { onTransform } from './transformer-handler.mjs';

function makeActor({ modeLocked = false, altModes = [] } = {}) {
  return {
    name: 'Bumblebee',
    statuses: new Set(modeLocked ? ['modeLock'] : []),
    items: { documentsByType: { altMode: altModes } },
    system: { isTransformed: false },
    prototypeToken: { texture: { src: 'icons/bumblebee.webp' } },
    update: jest.fn(),
  };
}

beforeEach(() => {
  global.ui = { notifications: { warn: jest.fn() } };
  global.game = { i18n: { format: jest.fn((key, data) => `${key}:${JSON.stringify(data)}`), localize: jest.fn(key => key) } };
});

describe("Mode Lock (Enigma of Combination, Weapon Traits/Conditions, p.49) - see dice.mjs#_applyModeLock's own doc comment", () => {
  test("blocks the transform entirely while Mode Locked", async () => {
    const actor = makeActor({ modeLocked: true });

    await onTransform(actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("proceeds normally (existing behavior) without Mode Lock", async () => {
    const actor = makeActor({ modeLocked: false, altModes: [] });

    await onTransform(actor);

    // No Alt Modes at all - falls through to the existing "AltModeNone" warning rather than the
    // Mode Lock one, proving the guard didn't swallow the normal, unrelated code path.
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.AltModeNone');
  });
});
