import { jest } from '@jest/globals';
import { activateRepairZord } from './repair-zord.mjs';

class FakeRoll {
  constructor(formula) {
    this.formula = formula;
    this.total = 3;
  }

  async evaluate() {
    return this;
  }
}
global.Roll = FakeRoll;

function makeZord(health = { value: 5, max: 10 }) {
  return {
    system: { health: { ...health } },
    update: jest.fn(async function (data) {
      this.system.health.value = data['system.health.value']; 
    }),
  };
}

function makeActor(zord) {
  return {
    getRollData: jest.fn(() => ({})),
    _dice: { _getPilotedVehicle: jest.fn(() => zord) },
  };
}

describe("activateRepairZord", () => {
  test("rolls floor(amountSpent/2)d2 and heals the piloted Zord", async () => {
    const zord = makeZord({ value: 5, max: 10 });
    const actor = makeActor(zord);

    const healAmount = await activateRepairZord(actor, 4);

    expect(healAmount).toBe(3);
    expect(zord.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
    expect(actor._dice._getPilotedVehicle).toHaveBeenCalledWith(actor, 'driver');
  });

  test("caps the heal at the Zord's own max Health", async () => {
    const zord = makeZord({ value: 9, max: 10 });
    const actor = makeActor(zord);

    await activateRepairZord(actor, 2);

    expect(zord.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("does nothing when not currently piloting a Zord", async () => {
    const actor = makeActor(null);

    const healAmount = await activateRepairZord(actor, 4);

    expect(healAmount).toBe(0);
  });

  test("does nothing when less than 2 Power was spent (rounds down to 0 dice)", async () => {
    const zord = makeZord();
    const actor = makeActor(zord);

    const healAmount = await activateRepairZord(actor, 1);

    expect(healAmount).toBe(0);
    expect(zord.update).not.toHaveBeenCalled();
  });
});
