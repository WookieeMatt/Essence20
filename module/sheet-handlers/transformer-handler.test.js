import { jest } from '@jest/globals';
import { onAltModeDelete, onTransform } from './transformer-handler.mjs';

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

describe("onAltModeDelete - deleting the Alt Mode you are in reverts to Bot Mode", () => {
  /** A transformed actor on its sheet, holding the given Alt Modes (by id), currently in the one with id activeId. */
  function transformedSheet(ids, activeId) {
    const actor = makeActor({ altModes: ids.map(id => ({ _id: id, id })) });
    Object.assign(actor.system, { isTransformed: true, altModeId: activeId, size: "common", image: { botmode: "" } });
    actor.items.contents = [];
    actor.items[Symbol.iterator] = () => [][Symbol.iterator]();
    actor.getActiveTokens = () => [];
    return { actor };
  }

  beforeEach(() => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), tokenSizes: { common: { width: 1, height: 1 } } } };
  });

  test("the active one, with another still held: back to Bot Mode on the ACTOR (it was handed the sheet)", async () => {
    const sheet = transformedSheet(["a", "b"], "a");
    await onAltModeDelete(sheet, { _id: "a" });
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({ "system.isTransformed": false, "system.altModeId": "" }));
  });

  test("an inactive one leaves the actor as it is", async () => {
    const sheet = transformedSheet(["a", "b"], "a");
    await onAltModeDelete(sheet, { _id: "b" });
    expect(sheet.actor.update).not.toHaveBeenCalled();
  });

  test("the last one: back to Bot Mode", async () => {
    const sheet = transformedSheet(["a"], "a");
    await onAltModeDelete(sheet, { _id: "a" });
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({ "system.isTransformed": false }));
  });
});
