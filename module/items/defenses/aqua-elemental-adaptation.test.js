import { jest } from '@jest/globals';
import { hasAquaElementalAdaptation } from './aqua-elemental-adaptation.mjs';

function makeActor(uuid, existingAdaptations = null) {
  const flags = { aquaElementalAdaptations: existingAdaptations };
  return {
    uuid,
    type: 'playerCharacter',
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("hasAquaElementalAdaptation", () => {
  test("true when the damage type is in the actor's own list", () => {
    const actor = makeActor('Actor.a1', ['fire', 'cold']);
    expect(hasAquaElementalAdaptation(actor, 'fire')).toBe(true);
  });

  test("false when it isn't", () => {
    const actor = makeActor('Actor.a1', ['cold']);
    expect(hasAquaElementalAdaptation(actor, 'fire')).toBe(false);
  });

  test("false with no adaptations at all", () => {
    const actor = makeActor('Actor.a1');
    expect(hasAquaElementalAdaptation(actor, 'fire')).toBe(false);
  });

  test("false with no actor", () => {
    expect(hasAquaElementalAdaptation(null, 'fire')).toBe(false);
  });
});
