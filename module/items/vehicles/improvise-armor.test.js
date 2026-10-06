import { jest } from '@jest/globals';
import { activateImproviseArmor, applyImproviseArmor } from './improvise-armor.mjs';

global.game = { user: { targets: { first: jest.fn() } } };

function makeVehicle({ uuid = 'Actor.vehicle1', bonus = 0 } = {}) {
  return { type: 'vehicle', uuid, system: { health: { bonus } }, update: jest.fn() };
}

function makeActor({ pilotedVehicle = null } = {}) {
  return { _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle), rollSkill: jest.fn() } };
}

describe("activateImproviseArmor", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
  });

  test("rolls Technology against the resolved vehicle", async () => {
    const pilotedVehicle = makeVehicle({ uuid: 'Actor.vehicle1' });
    const actor = makeActor({ pilotedVehicle });

    const result = await activateImproviseArmor(actor);

    expect(result).toBe(pilotedVehicle);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', dif: '1', isImproviseArmorAttempt: true, improviseArmorTargetUuid: 'Actor.vehicle1',
      }),
      actor,
    );
  });

  test("falls back to the currently-targeted vehicle when not piloting one", async () => {
    const targetedVehicle = makeVehicle({ uuid: 'Actor.vehicle2' });
    const actor = makeActor();
    game.user.targets.first.mockReturnValue({ actor: targetedVehicle });

    await activateImproviseArmor(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ improviseArmorTargetUuid: 'Actor.vehicle2' }),
      actor,
    );
  });

  test("returns null with no valid vehicle to target", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    expect(await activateImproviseArmor(actor)).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyImproviseArmor", () => {
  test("grants floor((total - 10) / 5) temp Health", async () => {
    const vehicle = makeVehicle({ bonus: 0 });

    const granted = await applyImproviseArmor(vehicle, 26); // (26-10)/5 = 3.2 -> 3

    expect(granted).toBe(3);
    expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
  });

  test("adds onto any existing temp Health bonus", async () => {
    const vehicle = makeVehicle({ bonus: 2 });

    await applyImproviseArmor(vehicle, 30); // (30-10)/5 = 4

    expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.bonus': 6 });
  });

  test("floors at 0 for a poor roll, granting nothing", async () => {
    const vehicle = makeVehicle();

    const granted = await applyImproviseArmor(vehicle, 8); // (8-10)/5 = -0.4 -> 0

    expect(granted).toBe(0);
    expect(vehicle.update).not.toHaveBeenCalled();
  });
});
