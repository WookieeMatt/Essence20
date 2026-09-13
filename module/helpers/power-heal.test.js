import { jest } from '@jest/globals';
import { activatePowerHeal } from './power-heal.mjs';

global.game = { user: { targets: new Set() }, i18n: { localize: (k) => k, format: (k) => k } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(id, name, health = { value: 5, max: 10 }) {
  return {
    id,
    name,
    getActiveTokens: jest.fn(() => []),
    system: { health: { ...health } },
    update: jest.fn(async function (data) {
      this.system.health.value = data['system.health.value']; 
    }),
  };
}

describe("activatePowerHeal", () => {
  beforeEach(() => {
    global.game.user.targets = new Set();
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("does nothing when nothing was spent", async () => {
    const actor = makeActor('actor1', 'Ranger');

    const result = await activatePowerHeal(actor, 0, 'Power Heal');

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("heals whichever ally the player already targeted", async () => {
    const actor = makeActor('actor1', 'Ranger');
    const ally = makeActor('actor2', 'Ally', { value: 5, max: 10 });
    global.game.user.targets = new Set([{ actor: ally }]);

    const result = await activatePowerHeal(actor, 3, 'Power Heal');

    expect(result).toEqual({ targetActor: ally, healAmount: 3 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
  });

  test("heals the actor themselves when picked from the dialog (no ally targeted)", async () => {
    const actor = makeActor('actor1', 'Ranger', { value: 5, max: 10 });
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('actor1');

    const result = await activatePowerHeal(actor, 3, 'Power Heal');

    expect(result).toEqual({ targetActor: actor, healAmount: 3 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
  });

  test("caps the heal at the target's own max Health", async () => {
    const actor = makeActor('actor1', 'Ranger', { value: 9, max: 10 });
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('actor1');

    await activatePowerHeal(actor, 5, 'Power Heal');

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("returns null when the picker is cancelled", async () => {
    const actor = makeActor('actor1', 'Ranger');
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue(null);

    const result = await activatePowerHeal(actor, 3, 'Power Heal');

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
