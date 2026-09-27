import { jest } from '@jest/globals';
import { activateRightfulPlace, canUseRightfulPlace } from './rightful-place.mjs';

function makeActor(flagStore = {}, { health = 5, healthMax = 10 } = {}) {
  return {
    system: { health: { value: health, max: healthMax } },
    update: jest.fn(async (data) => Object.assign({}, data)),
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("canUseRightfulPlace", () => {
  test("true before it's used, false once already used this scene", () => {
    const actor = makeActor();
    expect(canUseRightfulPlace(actor)).toBe(true);

    actor.getFlag = jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 }));
    expect(canUseRightfulPlace(actor)).toBe(false);
  });
});

describe("activateRightfulPlace", () => {
  test("heals 1 Health and marks the scene used", async () => {
    const actor = makeActor({}, { health: 5, healthMax: 10 });

    await activateRightfulPlace(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'rightfulPlaceUsedThisEncounter', expect.objectContaining({ count: 1 }),
    );
  });

  test("caps the heal at max Health", async () => {
    const actor = makeActor({}, { health: 10, healthMax: 10 });

    await activateRightfulPlace(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});
