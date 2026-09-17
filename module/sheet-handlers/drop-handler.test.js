import { jest } from '@jest/globals';
import { onDropActor, verifyDropSelection } from "./drop-handler.mjs";
import { DETACHED_THIS_SCENE_FLAG } from "./vehicle-handler.mjs";

function makeVehicle(actors, numDrivers, numPassengers) {
  return {
    system: {
      actors,
      crew: { numDrivers, numPassengers },
    },
  };
}

describe("verifyDropSelection", () => {
  test("allows a driver drop when there's an open driver seat", () => {
    const vehicle = makeVehicle({}, 1, 2);
    expect(verifyDropSelection(vehicle, 'driver')).toBe(true);
  });

  test("blocks a driver drop when all driver seats are filled", () => {
    const vehicle = makeVehicle({ a: { vehicleRole: 'driver' } }, 1, 2);
    expect(verifyDropSelection(vehicle, 'driver')).toBe(false);
  });

  test("allows a passenger drop when there's an open passenger seat", () => {
    const vehicle = makeVehicle({ a: { vehicleRole: 'passenger' } }, 1, 2);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(true);
  });

  test("blocks a passenger drop when all passenger seats are filled", () => {
    const vehicle = makeVehicle({
      a: { vehicleRole: 'passenger' },
      b: { vehicleRole: 'passenger' },
    }, 1, 2);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(false);
  });

  test("only counts existing occupants with a matching role", () => {
    const vehicle = makeVehicle({
      a: { vehicleRole: 'driver' },
      b: { vehicleRole: 'passenger' },
    }, 1, 2);
    // The one driver seat is filled, but there's still an open passenger seat
    expect(verifyDropSelection(vehicle, 'driver')).toBe(false);
    expect(verifyDropSelection(vehicle, 'passenger')).toBe(true);
  });
});

describe("onDropActor - Detachable reattach block (Across the Stars, p.104)", () => {
  function makeMegaformSheet() {
    const actor = { type: 'megaform', isOwner: true, system: { actors: {} }, update: jest.fn() };
    return { actor };
  }

  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.fromUuid = jest.fn();
    global.ui.notifications.error.mockClear();
  });
  afterEach(() => {
    global.game = originalGame;
  });

  test("blocks re-adding a Zord that detached from a Megaform this same encounter", async () => {
    const droppedActor = {
      type: 'zord',
      name: 'Test Zord',
      getFlag: (scope, key) => (key == DETACHED_THIS_SCENE_FLAG ? { combatId: 'combat1' } : undefined),
    };
    global.fromUuid.mockResolvedValue(droppedActor);
    global.game = { ...originalGame, combat: { id: 'combat1' } };
    const actorSheet = makeMegaformSheet();

    await onDropActor({ uuid: 'Actor.zord1' }, actorSheet);

    // jest.setup.js's game.i18n.format stub just echoes the key back, ignoring the data arg.
    expect(global.ui.notifications.error).toHaveBeenCalledWith('E20.DetachableCannotReattach');
    expect(actorSheet.actor.update).not.toHaveBeenCalled();
  });

  test("allows a Zord that detached in an earlier encounter to reattach", async () => {
    const droppedActor = {
      type: 'zord',
      uuid: 'Actor.zord1',
      name: 'Test Zord',
      img: 'icon.svg',
      getFlag: (scope, key) => (key == DETACHED_THIS_SCENE_FLAG ? { combatId: 'oldCombat' } : undefined),
    };
    global.fromUuid.mockResolvedValue(droppedActor);
    global.game = { ...originalGame, combat: { id: 'newCombat' } };
    const actorSheet = makeMegaformSheet();

    await onDropActor({ uuid: 'Actor.zord1' }, actorSheet);

    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actorSheet.actor.update).toHaveBeenCalled();
  });

  test("allows a Zord that was never flagged to attach normally", async () => {
    const droppedActor = {
      type: 'zord', uuid: 'Actor.zord1', name: 'Test Zord', img: 'icon.svg', getFlag: () => undefined,
    };
    global.fromUuid.mockResolvedValue(droppedActor);
    global.game = { ...originalGame, combat: null };
    const actorSheet = makeMegaformSheet();

    await onDropActor({ uuid: 'Actor.zord1' }, actorSheet);

    expect(global.ui.notifications.error).not.toHaveBeenCalled();
    expect(actorSheet.actor.update).toHaveBeenCalled();
  });

  test("joining the Megaform also clears an active Warrior Mode (PR CRB, Zord Feature, p.140)", async () => {
    const flagStore = { warriorModeActive: true };
    const droppedActor = {
      type: 'zord',
      uuid: 'Actor.zord1',
      name: 'Test Zord',
      img: 'icon.svg',
      getFlag: jest.fn((scope, key) => flagStore[key]),
      unsetFlag: jest.fn((scope, key) => {
        delete flagStore[key];
      }),
    };
    global.fromUuid.mockResolvedValue(droppedActor);
    global.game = { ...originalGame, combat: null };
    const actorSheet = makeMegaformSheet();

    await onDropActor({ uuid: 'Actor.zord1' }, actorSheet);

    expect(droppedActor.unsetFlag).toHaveBeenCalledWith('essence20', 'warriorModeActive');
  });
});
