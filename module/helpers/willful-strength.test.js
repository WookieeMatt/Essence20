import { jest } from '@jest/globals';
import { activateWillfulStrength } from './willful-strength.mjs';

global.game = { combat: { id: 'combat1' } };

function makeActor({ shift = 'd8', used = false, healthBonus = 0 } = {}) {
  const flagStore = used ? { willfulStrengthUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } : {};
  return {
    system: { skills: { survival: { shift } }, health: { bonus: healthBonus } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
    update: jest.fn(async function (data) {
      this.system.health.bonus = data['system.health.bonus']; 
    }),
  };
}

describe("activateWillfulStrength", () => {
  test("grants bonus Health equal to the Survival shift's own rank index (d8 = 3)", async () => {
    const actor = makeActor({ shift: 'd8' });

    const bonus = await activateWillfulStrength(actor);

    expect(bonus).toBe(3);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
  });

  test("grants 0 for an Unskilled (d2) Survival, and doesn't call update", async () => {
    const actor = makeActor({ shift: 'd2' });

    const bonus = await activateWillfulStrength(actor);

    expect(bonus).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("stacks onto any pre-existing health bonus", async () => {
    const actor = makeActor({ shift: 'd4', healthBonus: 2 });

    await activateWillfulStrength(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 }); // 2 + 1 (d4's index)
  });

  test("returns null and does nothing once already used this scene", async () => {
    const actor = makeActor({ used: true });

    const bonus = await activateWillfulStrength(actor);

    expect(bonus).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
