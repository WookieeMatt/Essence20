import { jest } from '@jest/globals';
import { grantWindWhispersEvasion } from './wind-whispers.mjs';

function makeActor(uuid, evasionBonus = 0) {
  return {
    uuid,
    type: 'playerCharacter',
    system: { defenses: { evasion: { bonus: evasionBonus } } },
    update: jest.fn(async function (data) {
      this.system.defenses.evasion.bonus = data['system.defenses.evasion.bonus'];
    }),
  };
}

beforeEach(() => {
  global.fromUuidSync = jest.fn();
});

describe("grantWindWhispersEvasion", () => {
  test("adds +2 Evasion to the caster when 'Yourself' is chosen", async () => {
    const caster = makeActor('Actor.caster1', 10);
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.caster1') } } },
    };

    await grantWindWhispersEvasion(caster);

    expect(caster.system.defenses.evasion.bonus).toBe(12);
  });

  test("adds +2 Evasion to the chosen teammate instead", async () => {
    const caster = makeActor('Actor.caster1', 10);
    const teammate = makeActor('Actor.teammate1', 8);
    global.game.actors = [caster, teammate];
    global.fromUuidSync.mockReturnValue(teammate);
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('Actor.teammate1') } } },
    };

    await grantWindWhispersEvasion(caster);

    expect(teammate.system.defenses.evasion.bonus).toBe(10);
    expect(caster.system.defenses.evasion.bonus).toBe(10); // unaffected
  });

  test("does nothing when the picker is cancelled", async () => {
    const caster = makeActor('Actor.caster1', 10);
    global.game.actors = [caster];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } },
    };

    await grantWindWhispersEvasion(caster);

    expect(caster.update).not.toHaveBeenCalled();
  });
});
