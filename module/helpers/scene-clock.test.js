import { jest } from '@jest/globals';
import {
  activateForWindow,
  advanceEncounter,
  advanceScene,
  advancesOnCombatEnd,
  getEncounterEpoch,
  getSceneEpoch,
  getSceneLabel,
  getUses,
  isActiveForWindow,
  markUsed,
  setSceneLabel,
} from './scene-clock.mjs';

/**
 * A world-settings store standing in for game.settings, so the counters can be driven and read
 * back the way the real ones are.
 */
function setGame({ isGM = true, initial = {}, throwOnGet = false } = {}) {
  const store = {
    sceneClockScene: 1,
    sceneClockEncounter: 1,
    sceneClockLabel: '',
    ...initial,
  };

  global.game = {
    user: { isGM },
    settings: {
      get: jest.fn((scope, key) => {
        if (throwOnGet) {
          throw new Error('not a registered game setting');
        }

        return store[key];
      }),
      set: jest.fn(async (scope, key, value) => {
        store[key] = value;
      }),
    },
  };

  return store;
}

function makeActor(flags = {}) {
  const store = { ...flags };
  return {
    getFlag: (scope, key) => store[key],
    setFlag: async (scope, key, value) => {
      store[key] = value;
    },
    store,
  };
}

beforeEach(() => {
  setGame();
});

describe("counters", () => {
  test("both start at 1", () => {
    expect(getSceneEpoch()).toBe(1);
    expect(getEncounterEpoch()).toBe(1);
  });

  test("an unregistered setting falls back rather than throwing", () => {
    setGame({ throwOnGet: true });
    expect(getSceneEpoch()).toBe(1);
    expect(getEncounterEpoch()).toBe(1);
    expect(getSceneLabel()).toBe('');
    expect(advancesOnCombatEnd()).toBe(true);
  });

  test("a new scene advances both counters", async () => {
    await advanceScene('Cobra Base');

    expect(getSceneEpoch()).toBe(2);
    expect(getEncounterEpoch()).toBe(2);
    expect(getSceneLabel()).toBe('Cobra Base');
  });

  // The reason the two counters exist separately: a combat ending refreshes once-per-encounter
  // abilities without touching once-per-scene ones.
  test("a new encounter advances only the encounter counter", async () => {
    await advanceEncounter();

    expect(getEncounterEpoch()).toBe(2);
    expect(getSceneEpoch()).toBe(1);
  });

  test("combat end does nothing when the world has that switched off", async () => {
    setGame({ initial: { sceneClockAdvanceOnCombatEnd: false } });

    await advanceEncounter();

    expect(getEncounterEpoch()).toBe(1);
  });

  test("a player cannot advance either counter", async () => {
    setGame({ isGM: false });

    await advanceScene('Nice Try');
    await advanceEncounter();

    expect(getSceneEpoch()).toBe(1);
    expect(getEncounterEpoch()).toBe(1);
  });

  test("relabelling does not advance anything", async () => {
    await setSceneLabel('Renamed');

    expect(getSceneLabel()).toBe('Renamed');
    expect(getSceneEpoch()).toBe(1);
  });
});

describe("getUses / markUsed", () => {
  test("an unused ability counts zero", () => {
    expect(getUses(makeActor(), 'dependable')).toBe(0);
  });

  test("marking increments within the same window", async () => {
    const actor = makeActor();
    await markUsed(actor, 'dependable');
    await markUsed(actor, 'dependable');

    expect(getUses(actor, 'dependable')).toBe(2);
  });

  test("records a multi-charge use in one call", async () => {
    const actor = makeActor();
    await markUsed(actor, 'oldReliable', { count: 3 });

    expect(getUses(actor, 'oldReliable')).toBe(3);
  });

  // This is the bug the whole module exists to fix: the helpers this replaced began
  // `if (!game.combat) return`, so nothing outside combat was ever recorded as used.
  test("works with no combat at all", async () => {
    const actor = makeActor();
    await markUsed(actor, 'dependable', { window: 'scene' });

    expect(getUses(actor, 'dependable', 'scene')).toBe(1);
  });

  test("an encounter-window use clears when the encounter advances", async () => {
    const actor = makeActor();
    await markUsed(actor, 'didntEvenFeelIt');

    await advanceEncounter();

    expect(getUses(actor, 'didntEvenFeelIt')).toBe(0);
  });

  test("a scene-window use survives an encounter advancing", async () => {
    const actor = makeActor();
    await markUsed(actor, 'dependable', { window: 'scene' });

    await advanceEncounter();

    expect(getUses(actor, 'dependable', 'scene')).toBe(1);
  });

  test("a scene-window use clears when the scene advances", async () => {
    const actor = makeActor();
    await markUsed(actor, 'dependable', { window: 'scene' });

    await advanceScene();

    expect(getUses(actor, 'dependable', 'scene')).toBe(0);
  });

  test("a flag written before the Scene Clock existed reads as unused", () => {
    const actor = makeActor({ legacy: { combatId: 'combat1', count: 1 } });
    expect(getUses(actor, 'legacy')).toBe(0);
  });

  test("stores which window it was marked for", async () => {
    const actor = makeActor();
    await markUsed(actor, 'dependable', { window: 'scene' });

    expect(actor.store.dependable).toEqual({ epoch: 1, window: 'scene', count: 1 });
  });
});

describe("isActiveForWindow / activateForWindow", () => {
  test("inactive until activated", () => {
    expect(isActiveForWindow(makeActor(), 'flutteryWingsActive')).toBe(false);
  });

  test("active immediately after activating", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'flutteryWingsActive');

    expect(isActiveForWindow(actor, 'flutteryWingsActive')).toBe(true);
  });

  test("a scene-window flag clears when the scene advances", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'lightningSpeedActive', 'scene');

    await advanceScene();

    expect(isActiveForWindow(actor, 'lightningSpeedActive', 'scene')).toBe(false);
  });

  test("an encounter-window flag clears when the encounter advances", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'someBuff', 'encounter');

    await advanceEncounter();

    expect(isActiveForWindow(actor, 'someBuff', 'encounter')).toBe(false);
  });

  test("a scene-window flag survives an encounter advancing", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'hotToTrotActive', 'scene');

    await advanceEncounter();

    expect(isActiveForWindow(actor, 'hotToTrotActive', 'scene')).toBe(true);
  });

  test("re-activating within the same window does not stack", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'foolscarrotActive', 'scene');
    await activateForWindow(actor, 'foolscarrotActive', 'scene');

    expect(actor.store.foolscarrotActive.count).toBe(1);
  });
});

describe("counter coercion", () => {
  // An epoch is compared for equality against what is stamped on an actor's flag, so a
  // non-numeric setting value would write garbage into every flag set while it persisted, and
  // those flags would never match anything again.
  test.each([['roll'], [null], [undefined], [NaN], [{}], [0], [-3]])(
    "a setting returning %p falls back to 1 rather than poisoning the flags",
    (value) => {
      global.game = {
        user: { isGM: true },
        settings: { get: jest.fn(() => value), set: jest.fn() },
      };

      expect(getSceneEpoch()).toBe(1);
      expect(getEncounterEpoch()).toBe(1);
    },
  );

  test("a numeric string still reads as its number", () => {
    global.game = {
      user: { isGM: true },
      settings: { get: jest.fn(() => '7'), set: jest.fn() },
    };

    expect(getSceneEpoch()).toBe(7);
  });
});
