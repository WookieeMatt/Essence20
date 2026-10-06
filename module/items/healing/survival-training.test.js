import { jest } from '@jest/globals';
import { grantSurvivalTrainingHealth } from './survival-training.mjs';

function makeActor(uuid, healthBonus = 0) {
  return {
    uuid,
    type: 'playerCharacter',
    system: { health: { bonus: healthBonus } },
    update: jest.fn(async function (data) {
      this.system.health.bonus = data['system.health.bonus'];
    }),
  };
}

beforeEach(() => {
  global.fromUuidSync = jest.fn();
});

describe("grantSurvivalTrainingHealth", () => {
  test("adds +1 Health to the caster when 'Yourself' is chosen", async () => {
    const caster = makeActor('Actor.caster1', 0);
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.caster1') } } },
    };

    await grantSurvivalTrainingHealth(caster);

    expect(caster.system.health.bonus).toBe(1);
  });

  test("adds +1 Health to the chosen teammate instead", async () => {
    const caster = makeActor('Actor.caster1', 0);
    const teammate = makeActor('Actor.teammate1', 2);
    global.game.actors = [caster, teammate];
    global.fromUuidSync.mockReturnValue(teammate);
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.teammate1') } } },
    };

    await grantSurvivalTrainingHealth(caster);

    expect(teammate.system.health.bonus).toBe(3);
    expect(caster.system.health.bonus).toBe(0); // unaffected
  });

  test("does nothing when the picker is cancelled", async () => {
    const caster = makeActor('Actor.caster1', 0);
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } },
    };

    await grantSurvivalTrainingHealth(caster);

    expect(caster.update).not.toHaveBeenCalled();
  });
});
