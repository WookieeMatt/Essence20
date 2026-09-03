import { jest } from '@jest/globals';
import { getDefenseValue, computeMultiplier, applyDamage, _isCritIsFumble } from './combat.mjs';

describe("getDefenseValue", () => {
  test("prefers .total (Player Character/Companion, computed by _prepareDefenses)", () => {
    const actor = { system: { defenses: { toughness: { total: 15, value: 99 } } } };
    expect(getDefenseValue(actor, 'toughness')).toBe(15);
  });

  test("falls back to .value (NPC/Vehicle/Zord/Megaform, stored directly)", () => {
    const actor = { system: { defenses: { toughness: { value: 12 } } } };
    expect(getDefenseValue(actor, 'toughness')).toBe(12);
  });

  test("returns 0 when the actor has no defenses data at all", () => {
    const actor = { system: {} };
    expect(getDefenseValue(actor, 'toughness')).toBe(0);
  });

  test("ignoreArmor subtracts the armor component out of .total (PR 'Driving Strike')", () => {
    const actor = { system: { isMorphed: false, defenses: { toughness: { total: 15, armor: 4 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(11);
    expect(getDefenseValue(actor, 'toughness')).toBe(15); // unaffected without the option
  });

  test("ignoreArmor subtracts the morphed component instead, while Morphed", () => {
    const actor = { system: { isMorphed: true, defenses: { toughness: { total: 17, armor: 4, morphed: 6 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(11);
  });

  test("ignoreArmor has no effect on an NPC/Vehicle/Zord's flat .value (no armor breakdown to subtract)", () => {
    const actor = { system: { defenses: { toughness: { value: 12 } } } };
    expect(getDefenseValue(actor, 'toughness', { ignoreArmor: true })).toBe(12);
  });
});

describe("computeMultiplier", () => {
  test("returns 0 on a miss (total below difficulty)", () => {
    expect(computeMultiplier(10, 15)).toBe(0);
  });

  test("returns 0 when difficulty is falsy (no target Difficulty set)", () => {
    expect(computeMultiplier(10, 0)).toBe(0);
  });

  test("returns 1 on a plain hit (below double the Difficulty)", () => {
    expect(computeMultiplier(15, 15)).toBe(1);
    expect(computeMultiplier(29, 15)).toBe(1);
  });

  test("returns 2 at exactly double the Difficulty (Degrees of Success, p.169)", () => {
    expect(computeMultiplier(30, 15)).toBe(2);
  });

  test("returns 3 at triple the Difficulty", () => {
    expect(computeMultiplier(45, 15)).toBe(3);
  });
});

describe("applyDamage", () => {
  test("subtracts from Health for a normal damage type, floored at 0", () => {
    const actor = { system: { health: { value: 5 }, immunities: {} }, update: jest.fn() };
    return applyDamage(actor, 8, 'fire').then((applied) => {
      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
      expect(applied).toBe(5); // only 5 of the 8 damage could actually be applied
    });
  });

  test("adds to the separate Stun accumulator instead of reducing Health", async () => {
    const actor = { system: { health: { value: 10 }, stun: { value: 2 }, immunities: {} }, update: jest.fn() };
    const applied = await applyDamage(actor, 3, 'stun');
    expect(actor.update).toHaveBeenCalledWith({ 'system.stun.value': 5 });
    expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.health.value': expect.anything() }));
    expect(applied).toBe(3);
  });

  test("Immunity to the damage type zeroes out the damage entirely", async () => {
    const actor = { system: { health: { value: 10 }, immunities: { fire: true } }, update: jest.fn() };
    const applied = await applyDamage(actor, 8, 'fire');
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(applied).toBe(0);
  });
});

describe("_isCritIsFumble", () => {
  test("a natural 1 on the d20 is always a Fumble", () => {
    const [isCrit, isFumble] = _isCritIsFumble([{ faces: 20, values: [1] }], false);
    expect(isFumble).toBe(true);
    expect(isCrit).toBe(false);
  });

  test("max face on a non-d20 bonus die is a Critical Success", () => {
    const [isCrit] = _isCritIsFumble([{ faces: 20, values: [10] }, { faces: 6, values: [6] }], false);
    expect(isCrit).toBe(true);
  });

  test("a d2 showing its max face only crits when canCritD2 is true", () => {
    const dice = [{ faces: 20, values: [10] }, { faces: 2, values: [2] }];
    expect(_isCritIsFumble(dice, false)[0]).toBe(false);
    expect(_isCritIsFumble(dice, true)[0]).toBe(true);
  });

  test("a plain non-crit, non-fumble roll returns [false, false]", () => {
    const [isCrit, isFumble] = _isCritIsFumble([{ faces: 20, values: [10] }, { faces: 6, values: [3] }], false);
    expect(isCrit).toBe(false);
    expect(isFumble).toBe(false);
  });
});
