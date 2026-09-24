import { jest } from '@jest/globals';
import { isAttackPower, rollPowerAttack } from './power-attack.mjs';

// The placement half (placeAoeTemplate) is live-canvas code with no Jest stand-in - see
// aoe-targeting.mjs's own doc comment. What's tested here is the decision: which Powers are
// rolled as attacks at all, and that the roll is handed the attacker's own Skill values.

function makeActor(skills = { targeting: { shift: 'd8', shiftUp: 1, shiftDown: 0, isSpecialized: true } }) {
  return { name: 'Sorcerer', system: { skills } };
}

function makePower({ defenseType = 'toughness', attackSkill = 'targeting', shape = null } = {}) {
  return {
    type: 'power',
    name: 'Arcane Blast',
    system: { defenseType, attackSkill, shape, radius: 5 },
    _dice: { handleSkillItemRoll: jest.fn() },
  };
}

describe("isAttackPower", () => {
  test("a Power with a Defense and an attack Skill is an attack", () => {
    expect(isAttackPower(makePower())).toBe(true);
  });

  test("the Grid Power majority, which declare neither, are not", () => {
    expect(isAttackPower(makePower({ defenseType: null, attackSkill: null }))).toBe(false);
  });

  test("a Defense alone isn't enough - there'd be nothing to roll with", () => {
    expect(isAttackPower(makePower({ attackSkill: null }))).toBe(false);
  });

  test("an attack Skill alone isn't enough - there'd be nothing to roll against", () => {
    expect(isAttackPower(makePower({ defenseType: null }))).toBe(false);
  });

  test("ignores non-Powers and nothing at all", () => {
    expect(isAttackPower({ type: 'spell', system: { defenseType: 'toughness', attackSkill: 'targeting' } })).toBe(false);
    expect(isAttackPower(null)).toBe(false);
  });
});

describe("rollPowerAttack", () => {
  test("rolls with the attacker's own values for the Power's attack Skill", async () => {
    const actor = makeActor();
    const power = makePower();

    const handled = await rollPowerAttack(actor, power);

    expect(handled).toBe(true);
    expect(power._dice.handleSkillItemRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'targeting', shift: 'd8', shiftUp: 1, shiftDown: 0, isSpecialized: true,
      }),
      actor, power,
    );
  });

  test("leaves a non-attack Power alone, so it still reaches its own bespoke handler", async () => {
    const power = makePower({ defenseType: null, attackSkill: null });

    expect(await rollPowerAttack(makeActor(), power)).toBe(false);
    expect(power._dice.handleSkillItemRoll).not.toHaveBeenCalled();
  });

  test("doesn't roll when the actor has no such Skill, rather than throwing", async () => {
    const power = makePower({ attackSkill: 'sorcery' });

    expect(await rollPowerAttack(makeActor(), power)).toBe(false);
    expect(power._dice.handleSkillItemRoll).not.toHaveBeenCalled();
  });
});
