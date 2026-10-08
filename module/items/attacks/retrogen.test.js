import {
  ENGRAFTED_MUTATION_ID, GENETIC_ALTERATION_SOURCE_IDS, HYPERGENETIC_MANIPULATION_ID, hasGeneticAlterations, isRetrogenWeapon,
} from "./retrogen.mjs";

describe("Retrogen (Cobra Codex, New Weapon Effects and Traits, p.92)", () => {
  test("isRetrogenWeapon reads the (upgrade-merged) trait list", () => {
    expect(isRetrogenWeapon({ system: { traits: ['ballistic', 'retrogen'] } })).toBe(true);
    expect(isRetrogenWeapon({ system: { traits: ['ballistic'] } })).toBe(false);
    expect(isRetrogenWeapon(null)).toBe(false);
  });

  describe("hasGeneticAlterations", () => {
    test("true for every Perk that only grants (or requires) Genetic Alterations", () => {
      for (const sourceId of GENETIC_ALTERATION_SOURCE_IDS) {
        expect(hasGeneticAlterations({ items: [{ type: 'perk', flags: { core: { sourceId } } }] })).toBe(true);
      }
    });

    test("matches a compendiumSource copy as well as a sourceId one", () => {
      expect(hasGeneticAlterations({ items: [{ type: 'perk', _stats: { compendiumSource: HYPERGENETIC_MANIPULATION_ID } }] }))
        .toBe(true);
    });

    test("true for any item the GM flagged as a Genetic Alteration", () => {
      expect(hasGeneticAlterations({ items: [{ type: 'alteration', flags: { essence20: { geneticAlteration: true } } }] }))
        .toBe(true);
    });

    test("false for an unmarked Alteration, other Perks, or no actor", () => {
      expect(hasGeneticAlterations({ items: [{ type: 'alteration', flags: {} }] })).toBe(false);
      expect(hasGeneticAlterations({ items: [{ type: 'perk', flags: { core: { sourceId: `${ENGRAFTED_MUTATION_ID}x` } } }] }))
        .toBe(false);
      expect(hasGeneticAlterations({ items: [] })).toBe(false);
      expect(hasGeneticAlterations(null)).toBe(false);
    });
  });
});
