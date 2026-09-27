import { jest } from '@jest/globals';
import { activateChronomanticPulse, applyChronomanticPulse } from './chronomantic-pulse.mjs';

global.game = { user: { targets: { first: () => undefined } }, i18n: { localize: jest.fn((key) => key) }, combat: null };

function makeActor({ id = 'self1', uuid = 'Actor.self1', disposition = 1 } = {}) {
  return {
    id,
    uuid,
    _dice: { rollSkill: jest.fn() },
    getActiveTokens: jest.fn(() => [{ document: { disposition } }]),
  };
}

describe("activateChronomanticPulse", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("returns false and does nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    const result = await activateChronomanticPulse(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("applies the new Initiative immediately against a willing (ally) target - no roll", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('5') } } } };
    const actor = makeActor({ disposition: 1 });
    const targetActor = makeActor({ id: 'ally1', uuid: 'Actor.ally1', disposition: 1 });
    global.game.user.targets = { first: () => ({ actor: targetActor }) };
    global.game.combat = { combatants: [{ actor: targetActor, update: jest.fn() }] };

    const result = await activateChronomanticPulse(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(global.game.combat.combatants[0].update).toHaveBeenCalledWith({ initiative: 5 });
  });

  test("defaults the target to self, which is always willing", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('3') } } } };
    const actor = makeActor();
    global.game.combat = { combatants: [{ actor, update: jest.fn() }] };

    await activateChronomanticPulse(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(global.game.combat.combatants[0].update).toHaveBeenCalledWith({ initiative: 3 });
  });

  test("rolls Culture (Arcane) vs DIF 12 against an unwilling (non-ally) target", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('7') } } } };
    const actor = makeActor({ disposition: 1 });
    const targetActor = makeActor({ id: 'enemy1', uuid: 'Actor.enemy1', disposition: -1 });
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateChronomanticPulse(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'culture', dif: '12', isChronomanticPulseAttempt: true,
        chronomanticPulseInitiative: 7, chronomanticPulseTargetUuid: 'Actor.enemy1',
      }),
      actor,
    );
  });

  test("returns null-blocked (false) for a non-numeric entry", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('not-a-number') } } } };
    const actor = makeActor();

    const result = await activateChronomanticPulse(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyChronomanticPulse", () => {
  afterEach(() => {
    global.game.combat = null;
  });

  test("writes the Initiative value onto the target's current Combatant", async () => {
    const targetActor = { id: 'target1' };
    const combatantUpdate = jest.fn();
    global.game.combat = { combatants: [{ actor: targetActor, update: combatantUpdate }] };

    await applyChronomanticPulse(targetActor, 12.5);

    expect(combatantUpdate).toHaveBeenCalledWith({ initiative: 12.5 });
  });

  test("no-ops cleanly when the target has no active Combatant", async () => {
    global.game.combat = { combatants: [] };
    await expect(applyChronomanticPulse({ id: 'nobody' }, 10)).resolves.toBeUndefined();
  });

  test("no-ops cleanly with no active combat at all", async () => {
    global.game.combat = null;
    await expect(applyChronomanticPulse({ id: 'nobody' }, 10)).resolves.toBeUndefined();
  });
});
