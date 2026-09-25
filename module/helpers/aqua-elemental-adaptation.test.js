import { jest } from '@jest/globals';
import {
  grantAquaElementalAdaptation, hasAquaElementalAdaptation, pickAquaElementalAdaptationDamageType,
} from './aqua-elemental-adaptation.mjs';

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

beforeEach(() => {
  global.fromUuidSync = jest.fn();
});

describe("pickAquaElementalAdaptationDamageType", () => {
  test("returns the chosen damage type", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cold') } } } };
    expect(await pickAquaElementalAdaptationDamageType()).toBe('cold');
  });

  test("returns null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    expect(await pickAquaElementalAdaptationDamageType()).toBeNull();
  });
});

describe("grantAquaElementalAdaptation", () => {
  test("stores the chosen element on the caster when 'Yourself' is chosen", async () => {
    const caster = makeActor('Actor.caster1');
    global.game.actors = [caster];
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn()
              .mockResolvedValueOnce('fire')
              .mockResolvedValueOnce('Actor.caster1'),
          },
        },
      },
    };

    await grantAquaElementalAdaptation(caster);

    expect(caster.setFlag).toHaveBeenCalledWith('essence20', 'aquaElementalAdaptations', ['fire']);
  });

  test("stores the chosen element on a chosen teammate instead, appending to any existing ones", async () => {
    const caster = makeActor('Actor.caster1');
    const teammate = makeActor('Actor.teammate1', ['cold']);
    global.game.actors = [caster, teammate];
    global.fromUuidSync.mockReturnValue(teammate);
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn()
              .mockResolvedValueOnce('fire')
              .mockResolvedValueOnce('Actor.teammate1'),
          },
        },
      },
    };

    await grantAquaElementalAdaptation(caster);

    expect(teammate.setFlag).toHaveBeenCalledWith('essence20', 'aquaElementalAdaptations', ['cold', 'fire']);
    expect(caster.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing when the element picker is cancelled", async () => {
    const caster = makeActor('Actor.caster1');
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } },
    };

    await grantAquaElementalAdaptation(caster);

    expect(caster.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing when the target picker is cancelled", async () => {
    const caster = makeActor('Actor.caster1');
    global.game.actors = [caster];
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn()
              .mockResolvedValueOnce('fire')
              .mockResolvedValueOnce('cancel'),
          },
        },
      },
    };

    await grantAquaElementalAdaptation(caster);

    expect(caster.setFlag).not.toHaveBeenCalled();
  });
});

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
