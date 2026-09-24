import { jest } from '@jest/globals';
import {
  _flipDriverAndPassenger, DETACHED_THIS_SCENE_FLAG, onAttachedActorHealthUpdate, onAttachedActorStunUpdate,
  onSystemActorOpen, onSystemActorsDelete, prepareSystemActors,
} from "./vehicle-handler.mjs";

global.foundry.applications.api.DialogV2 = { wait: jest.fn() };

describe("_flipDriverAndPassenger", () => {
  test("swaps the previous occupant to passenger when the new occupant takes driver", () => {
    const actor = { update: jest.fn() };
    _flipDriverAndPassenger(actor, 'newKey', 'driver', 'oldKey');
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.oldKey.vehicleRole": 'passenger' });
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.newKey.vehicleRole": 'driver' });
  });

  test("swaps the previous occupant to driver when the new occupant takes passenger", () => {
    const actor = { update: jest.fn() };
    _flipDriverAndPassenger(actor, 'newKey', 'passenger', 'oldKey');
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.oldKey.vehicleRole": 'driver' });
    expect(actor.update).toHaveBeenCalledWith({ "system.actors.newKey.vehicleRole": 'passenger' });
  });
});

describe("prepareSystemActors", () => {
  afterEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("does nothing to the context when the vehicle has no embedded actors", () => {
    const actor = { system: { actors: {} } };
    const context = {};
    prepareSystemActors(actor, context);
    expect(context.actors).toBeUndefined();
  });

  test("resolves each embedded actor's uuid and attaches them to context.actors", () => {
    const driver = { name: "Driver" };
    const passenger = { name: "Passenger" };
    global.fromUuidSync
      .mockReturnValueOnce(driver)
      .mockReturnValueOnce(passenger);

    const actor = {
      system: {
        actors: {
          a: { uuid: "Actor.driverUuid", vehicleRole: 'driver' },
          b: { uuid: "Actor.passengerUuid", vehicleRole: 'passenger' },
        },
      },
    };
    const context = {};
    prepareSystemActors(actor, context);

    expect(context.actors).toEqual({ a: driver, b: passenger });
    expect(global.fromUuidSync).toHaveBeenCalledWith("Actor.driverUuid");
    expect(global.fromUuidSync).toHaveBeenCalledWith("Actor.passengerUuid");
  });
});

describe("onSystemActorsDelete - Detachable flagging (Across the Stars, p.104)", () => {
  function makeMegaform(removedActorEntry) {
    return {
      type: 'megaform',
      system: { isLocked: false, actors: { k: removedActorEntry } },
      update: jest.fn(),
    };
  }

  function makeActorSheet(actor) {
    return { document: actor };
  }

  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.fromUuidSync.mockReset();
    global.foundry.applications.api.DialogV2.wait.mockReset();
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('confirm');
    // onSystemActorsDelete's own final line (li.slideUp(...)) references an undefined `li` and
    // always throws - a confirmed pre-existing, unrelated bug (flagged separately), not something
    // these tests are checking. It happens after every state change this suite cares about, so
    // each test below just swallows it and asserts on what happened up to that point.
  });
  afterEach(() => {
    global.game = originalGame;
  });

  test("marks the Zord as detached when a Detachable Zord leaves a Megaform mid-combat", async () => {
    const removedActor = {
      type: 'zord',
      items: [{ type: 'megaformTrait', system: { type: 'detachable' } }],
      setFlag: jest.fn(),
    };
    global.fromUuidSync.mockReturnValue(removedActor);
    const actor = makeMegaform({ uuid: 'Actor.zord1' });
    global.game = { ...originalGame, combat: { id: 'combat1' } };

    await onSystemActorsDelete(
      { target: { dataset: { systemActorsUuid: 'Actor.zord1' } } }, makeActorSheet(actor),
    ).catch(() => {});

    expect(removedActor.setFlag).toHaveBeenCalledWith(
      'essence20', DETACHED_THIS_SCENE_FLAG, { epoch: 1, window: 'encounter', count: 1 },
    );
  });

  test("doesn't flag a Zord without the Detachable trait", async () => {
    const removedActor = {
      type: 'zord',
      items: [{ type: 'megaformTrait', system: { type: 'coreBody' } }],
      setFlag: jest.fn(),
    };
    global.fromUuidSync.mockReturnValue(removedActor);
    const actor = makeMegaform({ uuid: 'Actor.zord1' });
    global.game = { ...originalGame, combat: { id: 'combat1' } };

    await onSystemActorsDelete(
      { target: { dataset: { systemActorsUuid: 'Actor.zord1' } } }, makeActorSheet(actor),
    ).catch(() => {});

    expect(removedActor.setFlag).not.toHaveBeenCalled();
  });

  test("doesn't flag a non-Zord component (Combiner) even with the Detachable trait", async () => {
    const removedActor = {
      type: 'playerCharacter',
      items: [{ type: 'megaformTrait', system: { type: 'detachable' } }],
      setFlag: jest.fn(),
    };
    global.fromUuidSync.mockReturnValue(removedActor);
    const actor = makeMegaform({ uuid: 'Actor.pc1' });
    global.game = { ...originalGame, combat: { id: 'combat1' } };

    await onSystemActorsDelete(
      { target: { dataset: { systemActorsUuid: 'Actor.pc1' } } }, makeActorSheet(actor),
    ).catch(() => {});

    expect(removedActor.setFlag).not.toHaveBeenCalled();
  });

  test("doesn't flag when removed from a Vehicle (only a Megaform's own removal counts as a detach)", async () => {
    const removedActor = {
      type: 'zord',
      items: [{ type: 'megaformTrait', system: { type: 'detachable' } }],
      setFlag: jest.fn(),
    };
    global.fromUuidSync.mockReturnValue(removedActor);
    const actor = { type: 'vehicle', system: { isLocked: false, actors: { k: { uuid: 'Actor.zord1' } } }, update: jest.fn() };
    global.game = { ...originalGame, combat: { id: 'combat1' } };

    await onSystemActorsDelete(
      { target: { dataset: { systemActorsUuid: 'Actor.zord1' } } }, makeActorSheet(actor),
    ).catch(() => {});

    expect(removedActor.setFlag).not.toHaveBeenCalled();
  });

  // This test used to assert the opposite - that detaching outside combat set no flag at all,
  // because markUsedThisEncounter began `if (!game.combat) return`. That was the bug the Scene
  // Clock fixed (helpers/scene-clock.mjs): a Zord detached between encounters was silently allowed
  // to reattach, and more generally every once-per-scene ability was unlimited out of combat.
  test("flags the detachment even outside combat, so it still blocks a reattach", async () => {
    const removedActor = {
      type: 'zord',
      items: [{ type: 'megaformTrait', system: { type: 'detachable' } }],
      setFlag: jest.fn(),
    };
    global.fromUuidSync.mockReturnValue(removedActor);
    const actor = makeMegaform({ uuid: 'Actor.zord1' });
    global.game = { ...originalGame, combat: null }; // no active combat

    await onSystemActorsDelete(
      { target: { dataset: { systemActorsUuid: 'Actor.zord1' } } }, makeActorSheet(actor),
    ).catch(() => {});

    expect(removedActor.setFlag).toHaveBeenCalledWith(
      'essence20', DETACHED_THIS_SCENE_FLAG, { epoch: 1, window: 'encounter', count: 1 },
    );
  });
});

describe("onAttachedActorHealthUpdate", () => {
  function makeComponent({ value = 5, max = 10 } = {}) {
    const component = { system: { health: { value, max } } };
    component.update = jest.fn(async (data) => {
      if (data['system.health.value'] !== undefined) {
        component.system.health.value = data['system.health.value'];
      }
    });

    return component;
  }

  function makeEvent(uuid, value) {
    return { currentTarget: { dataset: { systemActorsUuid: uuid }, value } };
  }

  afterEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("writes the new value to the resolved component's own Health, not the sheet's own actor", async () => {
    const component = makeComponent();
    global.fromUuidSync.mockReturnValue(component);

    await onAttachedActorHealthUpdate(makeEvent('Actor.component1', '7'), { actor: { update: jest.fn() } });

    expect(component.update).toHaveBeenCalledWith({ 'system.health.value': 7 });
    expect(global.fromUuidSync).toHaveBeenCalledWith('Actor.component1');
  });

  test("clamps a negative entry to 0", async () => {
    const component = makeComponent();
    global.fromUuidSync.mockReturnValue(component);

    await onAttachedActorHealthUpdate(makeEvent('Actor.component1', '-3'));

    expect(component.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
  });

  test("clamps an entry above the component's own max", async () => {
    const component = makeComponent({ max: 10 });
    global.fromUuidSync.mockReturnValue(component);

    await onAttachedActorHealthUpdate(makeEvent('Actor.component1', '99'));

    expect(component.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("does nothing if the component can no longer be resolved", async () => {
    global.fromUuidSync.mockReturnValue(null);

    await expect(onAttachedActorHealthUpdate(makeEvent('Actor.gone', '5'))).resolves.toBeUndefined();
  });

  test("does nothing without a uuid on the input", async () => {
    await expect(onAttachedActorHealthUpdate(makeEvent(undefined, '5'))).resolves.toBeUndefined();
    expect(global.fromUuidSync).not.toHaveBeenCalled();
  });
});

describe("onAttachedActorStunUpdate", () => {
  function makeComponent({ value = 0 } = {}) {
    const component = { system: { stun: { value } } };
    component.update = jest.fn(async (data) => {
      if (data['system.stun.value'] !== undefined) {
        component.system.stun.value = data['system.stun.value'];
      }
    });

    return component;
  }

  function makeEvent(uuid, value) {
    return { currentTarget: { dataset: { systemActorsUuid: uuid }, value } };
  }

  afterEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("writes the new value to the resolved component's own Stun, not the sheet's own actor", async () => {
    const component = makeComponent();
    global.fromUuidSync.mockReturnValue(component);

    await onAttachedActorStunUpdate(makeEvent('Actor.component1', '2'), { actor: { update: jest.fn() } });

    expect(component.update).toHaveBeenCalledWith({ 'system.stun.value': 2 });
    expect(global.fromUuidSync).toHaveBeenCalledWith('Actor.component1');
  });

  test("clamps a negative entry to 0, with no upper bound (Stun has no max)", async () => {
    const component = makeComponent();
    global.fromUuidSync.mockReturnValue(component);

    await onAttachedActorStunUpdate(makeEvent('Actor.component1', '-3'));
    expect(component.update).toHaveBeenCalledWith({ 'system.stun.value': 0 });

    await onAttachedActorStunUpdate(makeEvent('Actor.component1', '99'));
    expect(component.update).toHaveBeenCalledWith({ 'system.stun.value': 99 });
  });

  test("does nothing if the component can no longer be resolved", async () => {
    global.fromUuidSync.mockReturnValue(null);

    await expect(onAttachedActorStunUpdate(makeEvent('Actor.gone', '5'))).resolves.toBeUndefined();
  });

  test("does nothing without a uuid on the input", async () => {
    await expect(onAttachedActorStunUpdate(makeEvent(undefined, '5'))).resolves.toBeUndefined();
    expect(global.fromUuidSync).not.toHaveBeenCalled();
  });
});

describe("onSystemActorOpen", () => {
  // Driven by the card's own info button now (system-actors.hbs, data-action="systemActorOpen"),
  // which hands the handler the clicked control directly - not the card-wide dblclick event this
  // used to take, so there's no longer any "did the click land on an input?" case to cover.
  function makeTarget(uuid) {
    return { dataset: { uuid } };
  }

  afterEach(() => {
    global.fromUuidSync.mockReset();
  });

  test("opens the resolved component's own sheet", () => {
    const render = jest.fn();
    global.fromUuidSync.mockReturnValue({ sheet: { render } });

    onSystemActorOpen(makeTarget('Actor.component1'));

    expect(global.fromUuidSync).toHaveBeenCalledWith('Actor.component1');
    expect(render).toHaveBeenCalledWith(true);
  });

  test("does nothing if the component can no longer be resolved", () => {
    global.fromUuidSync.mockReturnValue(null);
    expect(() => onSystemActorOpen(makeTarget('Actor.gone'))).not.toThrow();
  });

  test("does nothing without a uuid on the control", () => {
    onSystemActorOpen(makeTarget(undefined));
    expect(global.fromUuidSync).not.toHaveBeenCalled();
  });
});
