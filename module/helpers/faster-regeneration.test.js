import { jest } from '@jest/globals';
import { activateFasterRegeneration } from './faster-regeneration.mjs';

global.game = { combat: { id: 'combat1' }, i18n: { localize: (k) => k, format: (k) => k } };

class FakeRoll {
  constructor() {
    this.total = 2;
  }

  async evaluate() {
    return this;
  }
}
global.Roll = FakeRoll;

function makeActor({ used = false, health = { value: 5, max: 10 } } = {}) {
  const flagStore = used ? { fasterRegenerationUsedThisEncounter: { combatId: 'combat1' } } : {};
  return {
    system: { health: { ...health } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
    getRollData: jest.fn(() => ({})),
    update: jest.fn(async function (data) {
      this.system.health.value = data['system.health.value']; 
    }),
  };
}

describe("activateFasterRegeneration", () => {
  test("rolls 1d2, heals the actor, and marks the flag", async () => {
    const actor = makeActor({ health: { value: 5, max: 10 } });

    const healAmount = await activateFasterRegeneration(actor);

    expect(healAmount).toBe(2);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 7 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'fasterRegenerationUsedThisEncounter', { combatId: 'combat1' });
  });

  test("caps the heal at max Health", async () => {
    const actor = makeActor({ health: { value: 9, max: 10 } });

    await activateFasterRegeneration(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("returns null and does nothing once already used this encounter", async () => {
    const actor = makeActor({ used: true });

    const healAmount = await activateFasterRegeneration(actor);

    expect(healAmount).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
