import {
  getDefensiveFlexibilityDefenseBonus, hasDefensiveFlexibilityOption, hasDefensiveFlexibilityResistance,
} from './defensive-flexibility.mjs';

const DEFENSIVE_FLEXIBILITY_ID = "Compendium.essence20.pr_crb.Item.7kHQ53hZFgwhSFVi";

function makeActor(choices, { isMorphed = true } = {}) {
  return {
    items: choices.map(choice => ({
      flags: { core: { sourceId: DEFENSIVE_FLEXIBILITY_ID } },
      system: { choice },
    })),
    system: { isMorphed },
  };
}

describe("hasDefensiveFlexibilityOption", () => {
  test("true when any held instance matches the option", () => {
    const actor = makeActor(['defenseToughness', 'resistanceFire']);
    expect(hasDefensiveFlexibilityOption(actor, 'defenseToughness')).toBe(true);
    expect(hasDefensiveFlexibilityOption(actor, 'resistanceFire')).toBe(true);
  });

  test("false for an unpicked option or with no instances", () => {
    const actor = makeActor(['defenseToughness']);
    expect(hasDefensiveFlexibilityOption(actor, 'resistanceFire')).toBe(false);
    expect(hasDefensiveFlexibilityOption(makeActor([]), 'defenseToughness')).toBe(false);
  });

  test("false for a null/undefined actor", () => {
    expect(hasDefensiveFlexibilityOption(null, 'defenseToughness')).toBe(false);
  });
});

describe("getDefensiveFlexibilityDefenseBonus", () => {
  test("+2 for the chosen Defense while Morphed", () => {
    const actor = makeActor(['defenseWillpower']);
    expect(getDefensiveFlexibilityDefenseBonus(actor, 'willpower')).toBe(2);
  });

  test("0 for a different Defense", () => {
    const actor = makeActor(['defenseWillpower']);
    expect(getDefensiveFlexibilityDefenseBonus(actor, 'toughness')).toBe(0);
  });

  test("0 while not Morphed", () => {
    const actor = makeActor(['defenseWillpower'], { isMorphed: false });
    expect(getDefensiveFlexibilityDefenseBonus(actor, 'willpower')).toBe(0);
  });

  test("0 with no defenseType given", () => {
    const actor = makeActor(['defenseWillpower']);
    expect(getDefensiveFlexibilityDefenseBonus(actor, null)).toBe(0);
  });
});

describe("hasDefensiveFlexibilityResistance", () => {
  test("true for the chosen Element sub-type", () => {
    const actor = makeActor(['resistanceCold']);
    expect(hasDefensiveFlexibilityResistance(actor, 'cold')).toBe(true);
  });

  test("false for a different damage type or none picked", () => {
    const actor = makeActor(['resistanceCold']);
    expect(hasDefensiveFlexibilityResistance(actor, 'fire')).toBe(false);
    expect(hasDefensiveFlexibilityResistance(makeActor([]), 'cold')).toBe(false);
  });

  test("false with no damageType given", () => {
    const actor = makeActor(['resistanceCold']);
    expect(hasDefensiveFlexibilityResistance(actor, null)).toBe(false);
  });

  test("both a Defense choice and a Resistance choice can coexist across 2 instances", () => {
    const actor = makeActor(['defenseToughness', 'resistanceElectric']);
    expect(getDefensiveFlexibilityDefenseBonus(actor, 'toughness')).toBe(2);
    expect(hasDefensiveFlexibilityResistance(actor, 'electric')).toBe(true);
  });
});
