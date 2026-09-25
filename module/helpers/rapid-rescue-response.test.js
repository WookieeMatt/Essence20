import { jest } from '@jest/globals';
import { healRapidRescueResponseAtRoundEnd, RAPID_RESCUE_RESPONSE_ID } from './rapid-rescue-response.mjs';

let nextRollTotal = 2;
class FakeRoll {
  async evaluate() {
    this.total = nextRollTotal;
    return this;
  }
}
global.Roll = FakeRoll;

function makeCrewMember(uuid, { value = 3, max = 5 } = {}) {
  return {
    uuid,
    system: { health: { value, max } },
    update: jest.fn(async function (data) {
      this.system.health.value = data['system.health.value'];
    }),
  };
}

function makeZord({ hasFeature = true, crew = [] } = {}) {
  const items = hasFeature
    ? [{ type: 'feature', flags: { core: { sourceId: RAPID_RESCUE_RESPONSE_ID } } }]
    : [];
  const actors = {};
  crew.forEach((member, i) => {
    actors[`c${i}`] = { uuid: member.uuid };
  });

  return {
    type: 'zord',
    items,
    system: { actors },
  };
}

function makeCombat(combatants) {
  return { combatants };
}

beforeEach(() => {
  nextRollTotal = 2;
  global.fromUuidSync = jest.fn();
});

describe("healRapidRescueResponseAtRoundEnd", () => {
  test("heals a damaged crew member on a roll of 2", async () => {
    const crewMember = makeCrewMember('Actor.crew1', { value: 3, max: 5 });
    const zord = makeZord({ crew: [crewMember] });
    global.fromUuidSync.mockImplementation((uuid) => (uuid == crewMember.uuid ? crewMember : null));

    await healRapidRescueResponseAtRoundEnd(makeCombat([{ actor: zord }]));

    expect(crewMember.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("doesn't heal on a roll of 1", async () => {
    nextRollTotal = 1;
    const crewMember = makeCrewMember('Actor.crew1', { value: 3, max: 5 });
    const zord = makeZord({ crew: [crewMember] });
    global.fromUuidSync.mockImplementation((uuid) => (uuid == crewMember.uuid ? crewMember : null));

    await healRapidRescueResponseAtRoundEnd(makeCombat([{ actor: zord }]));

    expect(crewMember.update).not.toHaveBeenCalled();
  });

  test("doesn't heal a crew member already at full Health", async () => {
    const crewMember = makeCrewMember('Actor.crew1', { value: 5, max: 5 });
    const zord = makeZord({ crew: [crewMember] });
    global.fromUuidSync.mockImplementation((uuid) => (uuid == crewMember.uuid ? crewMember : null));

    await healRapidRescueResponseAtRoundEnd(makeCombat([{ actor: zord }]));

    expect(crewMember.update).not.toHaveBeenCalled();
  });

  test("does nothing for a Zord without the Feature", async () => {
    const crewMember = makeCrewMember('Actor.crew1', { value: 3, max: 5 });
    const zord = makeZord({ hasFeature: false, crew: [crewMember] });
    global.fromUuidSync.mockImplementation((uuid) => (uuid == crewMember.uuid ? crewMember : null));

    await healRapidRescueResponseAtRoundEnd(makeCombat([{ actor: zord }]));

    expect(crewMember.update).not.toHaveBeenCalled();
  });

  test("does nothing for a non-Zord combatant", async () => {
    const combatant = { actor: { type: 'playerCharacter', items: [] } };

    await expect(healRapidRescueResponseAtRoundEnd(makeCombat([combatant]))).resolves.toBeUndefined();
  });

  test("does nothing with no combat running", async () => {
    await expect(healRapidRescueResponseAtRoundEnd(null)).resolves.toBeUndefined();
  });
});
