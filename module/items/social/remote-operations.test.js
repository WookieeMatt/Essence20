import { jest } from '@jest/globals';
import { activateRemoteOperations, bankRemoteOperationsReady, hasRemoteOperationsReady } from './remote-operations.mjs';

global.game = { combat: null };

function makeActor(id = 'actor1') {
  return { id, setFlag: jest.fn(), getFlag: jest.fn(), _dice: { rollSkill: jest.fn() } };
}

describe("activateRemoteOperations", () => {
  test("rolls a flat DIF 10 Alertness Skill Test", async () => {
    const actor = makeActor();

    await activateRemoteOperations(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'alertness', dif: '10', isRemoteOperationsAttempt: true }),
      actor,
    );
  });
});

describe("bankRemoteOperationsReady / hasRemoteOperationsReady", () => {
  test("banks and reads back readiness", async () => {
    const actor = makeActor();

    await bankRemoteOperationsReady(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'remoteOperationsReady', expect.any(Object));

    actor.getFlag.mockReturnValue({ combatId: null, round: null });
    expect(hasRemoteOperationsReady(actor)).toBe(true);
  });

  test("false when nothing is banked", () => {
    const actor = makeActor();
    actor.getFlag.mockReturnValue(undefined);
    expect(hasRemoteOperationsReady(actor)).toBe(false);
  });
});
