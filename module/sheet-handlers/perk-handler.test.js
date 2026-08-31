import { jest } from '@jest/globals';
import { onPerkDrop, setPerkAdvancesName } from "./perk-handler.mjs";

function makePerk(type, currentValue) {
  return {
    update: jest.fn(),
    system: { advances: { type, currentValue } },
  };
}

describe("setPerkAdvancesName", () => {
  test.each([
    ['area', 10, "10' x 10'"],
    ['damage', 3, "+3 Damage"],
    ['die', 6, "1d6"],
    ['number', 4, 4],
    ['rerolls', 2, "Reroll 2s"],
    ['upshift', 1, "↑1"],
  ])("formats the '%s' advance type", (type, currentValue, expectedFragment) => {
    const perk = makePerk(type, currentValue);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: `Test Perk (${expectedFragment})` });
  });

  test("falls back to a null fragment for an unrecognized advance type", () => {
    const perk = makePerk('unknownType', 5);
    setPerkAdvancesName(perk, "Test Perk");
    expect(perk.update).toHaveBeenCalledWith({ name: "Test Perk (null)" });
  });
});

describe("onPerkDrop", () => {
  function makeActor(skillShiftUp = 0) {
    return {
      items: [], // empty - skips the "already taken" scan, out of scope for this branch's tests
      system: { skills: { athletics: { shiftUp: skillShiftUp } } },
      update: jest.fn(),
    };
  }

  function makePerkItem({ value = 2, name = 'Expertise' } = {}) {
    return {
      name,
      uuid: "Compendium.essence20.gi_joe_crb.Item.F9kOLys1Iu4UOg22",
      system: { hasChoice: true, value, isRoleVariant: false, advances: { canAdvance: false } },
      update: jest.fn(),
    };
  }

  // e.g. Expertise (GI Joe CRB p.72): "Choose two skills. You're an expert in each, gaining
  // [2 upshifts] when using them." Regression coverage for a live bug report - this branch used
  // to write perk.system.value into the skill's flat .modifier instead of its .shiftUp.
  describe("'skills' choiceType (e.g. Expertise)", () => {
    test("adds the Perk's value as a shiftUp on the chosen skill, not a flat modifier", async () => {
      const actor = makeActor(0);
      const perk = makePerkItem({ value: 2 });

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.athletics.shiftUp': 2 });
    });

    test("adds onto an existing shiftUp rather than overwriting it", async () => {
      const actor = makeActor(1);
      const perk = makePerkItem({ value: 2 });

      await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.athletics.shiftUp': 3 });
    });

    test("renames the granted Perk to include the chosen skill", async () => {
      const actor = makeActor(0);
      const perk = makePerkItem({ name: 'Expertise' });

      const newPerk = await onPerkDrop(actor, perk, null, 'athletics', 'skills', null);

      expect(newPerk.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Expertise (E20.SkillAthletics)', 'system.choice': 'athletics' }),
      );
    });
  });

  // Field (GI Joe CRB p.104, Technician/Expert Focus): "choose a Culture, Science, or Technology
  // Specialization... This is your Field." Unlike 'skills' above, this grants no numeric bonus of
  // its own (the Essence Increase that comes with it is handled generically elsewhere) - it only
  // needs to record which skill was chosen, the same "rename + system.choice, no numeric branch"
  // shape 'fightingStyle' already uses. Eureka/Expert in Your Field (dice.mjs) read this choice
  // back at roll time.
  describe("'field' choiceType (e.g. Field)", () => {
    function makeFieldPerkItem() {
      return {
        name: 'Field',
        uuid: "Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C",
        system: { hasChoice: true, isRoleVariant: false, advances: { canAdvance: false } },
        update: jest.fn(),
      };
    }

    test("records the chosen skill as system.choice and renames the Perk, with no numeric grant", async () => {
      const actor = makeActor(0);
      const perk = makeFieldPerkItem();

      const newPerk = await onPerkDrop(actor, perk, null, 'science', 'field', null);

      expect(newPerk.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Field (E20.SkillScience)', 'system.choice': 'science' }),
      );
      expect(actor.update).not.toHaveBeenCalled();
    });
  });
});
