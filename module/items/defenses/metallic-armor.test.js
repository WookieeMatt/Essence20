import { jest } from '@jest/globals';
import { activateMetallicArmor, isMetallicArmorActive, payMetallicArmorMaintenance } from './metallic-armor.mjs';

function makeActor({ active = false, healthBonus = 0, power = 1 } = {}) {
  const flagStore = { metallicArmorActive: active };
  return {
    system: { health: { bonus: healthBonus }, powers: { personal: { value: power } } },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
  };
}

describe("isMetallicArmorActive", () => {
  test("false by default", () => {
    expect(isMetallicArmorActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isMetallicArmorActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("activateMetallicArmor", () => {
  test("sets the flag and grants +3 temporary Health", async () => {
    const actor = makeActor({ active: false, healthBonus: 0 });
    const result = await activateMetallicArmor(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallicArmorActive', true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
  });

  test("stacks on top of any existing Health bonus", async () => {
    const actor = makeActor({ active: false, healthBonus: 2 });
    await activateMetallicArmor(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 5 });
  });

  test("does nothing if already active", async () => {
    const actor = makeActor({ active: true });
    const result = await activateMetallicArmor(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("payMetallicArmorMaintenance", () => {
  test("does nothing when not active", async () => {
    const actor = makeActor({ active: false });
    await payMetallicArmorMaintenance(actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("pays 1 Personal Power when affordable", async () => {
    const actor = makeActor({ active: true, power: 2 });
    await payMetallicArmorMaintenance(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("deactivates and removes the temporary Health when unaffordable", async () => {
    const actor = makeActor({ active: true, power: 0, healthBonus: 3 });
    await payMetallicArmorMaintenance(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallicArmorActive', false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 0 });
  });

  test("never drops the Health bonus below 0 when deactivating", async () => {
    const actor = makeActor({ active: true, power: 0, healthBonus: 1 });
    await payMetallicArmorMaintenance(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 0 });
  });
});
