import { jest } from '@jest/globals';
import { _onTransformerArmorUpgradeDrop, _onUpgradeDrop, onDropActor, onDropItem, verifyDropSelection } from "./drop-handler.mjs";
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

describe("_onUpgradeDrop", () => {
  test("a vehicle-type Upgrade (e.g. Heavy Water Coolant) attaches directly to a Vehicle actor", async () => {
    const upgrade = { system: { type: 'vehicle' } };
    const actor = { type: 'vehicle', system: {} };
    const dropFunc = jest.fn(async () => [{}]);

    const result = await _onUpgradeDrop(upgrade, actor, dropFunc);

    expect(dropFunc).toHaveBeenCalled();
    expect(result).toEqual([{}]);
  });

  test("still errors for a vehicle-type Upgrade dropped on a non-vehicle actor", async () => {
    const upgrade = { system: { type: 'vehicle' } };
    const actor = { type: 'playerCharacter', system: {} };
    const dropFunc = jest.fn();

    const result = await _onUpgradeDrop(upgrade, actor, dropFunc);

    expect(dropFunc).not.toHaveBeenCalled();
    expect(global.ui.notifications.error).toHaveBeenCalledWith('E20.UpgradeDropError');
    expect(result).toBe(false);
  });
});

describe("an armor Upgrade dropped on an actor that can transform", () => {
  let originalFoundry;
  const wait = jest.fn();
  beforeEach(() => {
    originalFoundry = global.foundry;
    global.foundry = { ...originalFoundry, applications: { api: { DialogV2: { wait } } } };
    wait.mockReset();
  });
  afterEach(() => {
    global.foundry = originalFoundry;
  });

  const upgrade = { name: 'Reinforced Plating', system: { type: 'armor' } };
  function makeBot(armors) {
    return { name: 'Bumblebee', system: { canTransform: true }, items: { documentsByType: { armor: armors } } };
  }

  test("with no Armor, it installs in the body without asking", async () => {
    const dropFunc = jest.fn(async () => [{}]);
    await _onUpgradeDrop(upgrade, makeBot([]), dropFunc);
    expect(wait).not.toHaveBeenCalled();
    expect(dropFunc).toHaveBeenCalled();
  });

  test("Power Armor isn't offered as somewhere to put it", async () => {
    const dropFunc = jest.fn(async () => [{}]);
    await _onTransformerArmorUpgradeDrop(upgrade, makeBot([{ id: 'p', name: 'Ranger Suit', system: { isPowerArmor: true } }]), dropFunc);
    expect(wait).not.toHaveBeenCalled();
    expect(dropFunc).toHaveBeenCalled();
  });

  test("with Armor, it asks - offering the body and each Armor, worn ones marked", async () => {
    wait.mockResolvedValue('body');
    const dropFunc = jest.fn(async () => [{}]);
    const bot = makeBot([
      { id: 'a1', name: 'Vest', system: { equipped: true } },
      { id: 'a2', name: 'Shield Plate', system: { equipped: false } },
    ]);

    await _onTransformerArmorUpgradeDrop(upgrade, bot, dropFunc);

    const actions = wait.mock.calls[0][0].buttons.map(b => [b.action, b.label]);
    expect(actions).toEqual([
      ['body', 'E20.ArmorUpgradeInstallBody'],
      ['a1', 'E20.ArmorUpgradeInstallOnArmorEquipped'],
      ['a2', 'E20.ArmorUpgradeInstallOnArmor'],
    ]);
    expect(dropFunc).toHaveBeenCalled();
  });

  test("picking an Armor attaches the Upgrade to it", async () => {
    wait.mockResolvedValue('a1');
    const created = { name: 'Reinforced Plating', type: 'upgrade', uuid: 'Actor.x.Item.u', system: { type: 'armor' }, setFlag: jest.fn() };
    const dropFunc = jest.fn(async () => [created]);
    const armor = { _id: 'a1', id: 'a1', name: 'Vest', type: 'armor', system: { equipped: true, items: {} }, update: jest.fn() };

    await _onTransformerArmorUpgradeDrop(upgrade, makeBot([armor]), dropFunc);

    expect(created.setFlag).toHaveBeenCalledWith('essence20', 'parentId', 'a1');
  });

  test("closing the prompt drops nothing", async () => {
    wait.mockResolvedValue(null);
    const dropFunc = jest.fn();
    const result = await _onTransformerArmorUpgradeDrop(upgrade, makeBot([{ id: 'a1', name: 'Vest', system: {} }]), dropFunc);
    expect(result).toBe(false);
    expect(dropFunc).not.toHaveBeenCalled();
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
      getFlag: (scope, key) => (key == DETACHED_THIS_SCENE_FLAG ? { epoch: 1, window: 'encounter', count: 1 } : undefined),
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
      getFlag: (scope, key) => (key == DETACHED_THIS_SCENE_FLAG ? { epoch: 0, window: 'encounter', count: 1 } : undefined),
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

describe("an Alt Mode dropped straight onto a character", () => {
  test("makes it able to transform (play-through 2026-10-07)", async () => {
    const altMode = { type: 'altMode', name: 'Monstrosity', uuid: 'Compendium.x.Item.a' };
    global.fromUuid = jest.fn(async () => altMode);
    global.game = { ...(global.game ?? {}), user: { isGM: false }, settings: { get: () => 'off' }, i18n: { format: k => k, localize: k => k } };
    global.ui = { ...(global.ui ?? {}), notifications: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
    const actor = { uuid: 'Actor.h', type: 'playerCharacter', system: { canTransform: false }, update: jest.fn(async () => true), getFlag: () => false, isOwner: true, flags: {} };
    const dropFunc = jest.fn(async () => [{}]);
    await onDropItem({ uuid: altMode.uuid }, actor, dropFunc);
    expect(dropFunc).toHaveBeenCalled();
    expect(actor.update).toHaveBeenCalledWith({ 'system.canTransform': true });
  });
});
