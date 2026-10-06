import { jest } from '@jest/globals';
import { applyBravado } from './bravado.mjs';

const BRAVADO_ID = "Compendium.essence20.gi_joe_crb.Item.dB5C6frDKWJKXVay";
const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";

function makeCombatant({ hasPerk = true, resourceValue = 0, hasRolePoints = true } = {}) {
  const rolePoints = hasRolePoints
    ? { flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { resource: { value: resourceValue } }, update: jest.fn() }
    : null;
  const actor = {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: BRAVADO_ID } } }] : [],
    _getBaseRolePoints: jest.fn(() => rolePoints),
  };
  return { actor, __rolePoints: rolePoints };
}

describe("applyBravado", () => {
  test("regains 1 use of Reckless Abandon when a combatant begins combat with none left", async () => {
    const combatant = makeCombatant({ resourceValue: 0 });
    await applyBravado({ combatants: [combatant] });
    expect(combatant.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("doesn't apply when uses remain", async () => {
    const combatant = makeCombatant({ resourceValue: 2 });
    await applyBravado({ combatants: [combatant] });
    expect(combatant.__rolePoints.update).not.toHaveBeenCalled();
  });

  test("doesn't apply without the Perk", async () => {
    const combatant = makeCombatant({ hasPerk: false, resourceValue: 0 });
    await applyBravado({ combatants: [combatant] });
    expect(combatant.__rolePoints.update).not.toHaveBeenCalled();
  });

  test("doesn't crash without a Reckless Abandon rolePoints item", async () => {
    const combatant = makeCombatant({ hasRolePoints: false });
    await expect(applyBravado({ combatants: [combatant] })).resolves.not.toThrow();
  });

  test("handles multiple combatants independently", async () => {
    const combatant1 = makeCombatant({ resourceValue: 0 });
    const combatant2 = makeCombatant({ resourceValue: 3 });
    await applyBravado({ combatants: [combatant1, combatant2] });
    expect(combatant1.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(combatant2.__rolePoints.update).not.toHaveBeenCalled();
  });

  test("no-ops with no combat", async () => {
    await expect(applyBravado(null)).resolves.not.toThrow();
  });
});
