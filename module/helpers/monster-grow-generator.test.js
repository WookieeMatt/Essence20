import { parseStatBlock } from "./stat-block-parser.mjs";
import {
  computeGrownStatBlock,
  defaultEssenceAllocation,
  defaultSkillAllocation,
  multipliersForIncrease,
  roundToFive,
  scaleTextRanges,
  shiftUp,
} from "./monster-grow-generator.mjs";

/*
 * The benchmark is the published Polluticorn pair (PR CRB p.216 -> p.217, TL 7 -> 10). Its shape
 * is reproduced here rather than its prose: the numbers are the mechanical facts under test, and
 * the flavour text is not needed to test arithmetic.
 *
 * Per the plan's §6.3 these tests assert the BOOK'S OWN RULE. Where the published Grown block
 * deviates from it - ranges doubled rather than x1.5, Movement unchanged, extra Conditioning -
 * that is asserted separately through the override options, which is what those options exist for.
 */
const NORMAL = `Polluticorn (Normal)
THREAT LEVEL: 7
SIZE: LARGE | HEALTH: 7
GROUND MOVEMENT: 30ft | AERIAL
MOVEMENT: 60ft
STRENGTH: 6 | SPEED: 6
SMARTS: 3 | SOCIAL: 5
TOUGHNESS: 16 | EVASION: 16
WILLPOWER: 13 | CLEVERNESS: 15
SKILLS
Alertness (Insight) +d4*
Deception +d6
Infiltration +d4
Initiative +d4
Intimidation +d4
Melee (Unarmed Combat) +d6*
Targeting +d4
Streetwise +d4
PERKS
Powerful Leap: Its long jump and high jump is up to 40ft.
ATTACKS
Unarmed Combat (Might): +d6*, Reach (1 Blunt damage)
Blasting Horn (Targeting): +d4, Range 30ft/60ft (1 Energy damage)
POWERS
Lightning Vision (2/scene, Standard): Lightning leaps from its eyes in a 20ft line.
HANG-UPS
Weak Point: Its strength resides within its horn.`;

const ir = parseStatBlock(NORMAL);
const skillShift = (result, key) => result.ir.skills.find(s => s.key === key)?.shift;

describe("shiftUp", () => {
  test("moves a die up the shift ladder", () => {
    expect(shiftUp('d4')).toBe('d6');
    expect(shiftUp('d6', 2)).toBe('d10');
  });

  test("treats an unset shift as d20", () => {
    expect(shiftUp(null)).toBe('d2');
  });

  test("clamps at the top of the ladder instead of running off it", () => {
    expect(shiftUp('3d6', 10)).toBe('criticalSuccess');
  });

  test("leaves a shift it doesn't recognise alone", () => {
    expect(shiftUp('d7')).toBe('d7');
  });
});

describe("roundToFive", () => {
  test("rounds to the nearest 5-foot increment as RAW requires", () => {
    expect(roundToFive(45)).toBe(45);
    expect(roundToFive(47)).toBe(45);
    expect(roundToFive(48)).toBe(50);
  });
});

describe("multipliersForIncrease", () => {
  test("uses x1.5 range and x2 damage for a +2 or +3 Threat Level increase", () => {
    expect(multipliersForIncrease(2)).toEqual({ range: 1.5, damage: 2 });
    expect(multipliersForIncrease(3)).toEqual({ range: 1.5, damage: 2 });
  });

  test("uses x2 range and x3 damage for a +4 increase", () => {
    expect(multipliersForIncrease(4)).toEqual({ range: 2, damage: 3 });
  });
});

describe("defaultEssenceAllocation", () => {
  test("puts the points into the Essences behind the Threat's own attacks", () => {
    // Polluticorn attacks with Might (Strength) and Targeting (Speed) - exactly the two Essences
    // its published Grown form gains.
    expect(defaultEssenceAllocation(ir, 6)).toEqual({ strength: 3, speed: 3, smarts: 0, social: 0 });
  });

  test("falls back to Strength when there are no attacks to read", () => {
    expect(defaultEssenceAllocation({ attacks: [] }, 4)).toEqual({ strength: 4, speed: 0, smarts: 0, social: 0 });
  });

  test("allocates nothing for a zero-point increase", () => {
    expect(defaultEssenceAllocation(ir, 0)).toEqual({ strength: 0, speed: 0, smarts: 0, social: 0 });
  });
});

describe("defaultSkillAllocation", () => {
  test("shifts the attack skills plus Initiative, and nothing else", () => {
    // The published Grown Polluticorn shifts Might, Targeting and Initiative while leaving its
    // other Speed and Smarts skills alone.
    const allocation = defaultSkillAllocation(ir, { strength: 3, speed: 3, smarts: 0, social: 0 });
    expect(allocation).toEqual({ might: 1, targeting: 1, initiative: 1 });
    expect(allocation.infiltration).toBeUndefined();
  });

  test("leaves a skill alone when its Essence did not grow", () => {
    const allocation = defaultSkillAllocation(ir, { strength: 6, speed: 0, smarts: 0, social: 0 });
    expect(allocation).toEqual({ might: 1 });
  });
});

describe("scaleTextRanges", () => {
  test("scales every distance in a Power's text", () => {
    expect(scaleTextRanges('a 20ft line and a 15 ft cone', 2)).toBe('a 40ft line and a 30 ft cone');
  });

  test("leaves numbers that are not distances alone", () => {
    expect(scaleTextRanges('a DIF 12 Brawn test, 20ft radius', 2)).toBe('a DIF 12 Brawn test, 40ft radius');
  });

  test("is a no-op at a multiplier of 1", () => {
    expect(scaleTextRanges('20ft', 1)).toBe('20ft');
  });
});

describe("computeGrownStatBlock - the book's own rule", () => {
  const result = computeGrownStatBlock(ir, { tlIncrease: 3, newSize: 'gigantic' });

  test("raises Threat Level by the chosen increase", () => {
    expect(result.ir.threatLevel).toBe(10);
  });

  test("names the new form", () => {
    expect(result.ir.name).toBe('Polluticorn (Normal) (Grown)');
  });

  test("moves to the chosen Size class", () => {
    expect(result.ir.size).toBe('gigantic');
  });

  test("gains Health equal to the Threat Level increase", () => {
    expect(result.ir.health).toBe(10);
  });

  test("gains Essence points equal to twice the Threat Level increase", () => {
    const gained = Object.values(result.essenceIncreases).reduce((a, b) => a + b, 0);
    expect(gained).toBe(6);
    expect(result.ir.essences).toEqual({ strength: 9, speed: 9, smarts: 3, social: 5 });
  });

  test("carries each Essence gain onto its own Defense, preserving any residual", () => {
    // Published: 16/16/13/15 -> 20/18/13/15. The split differs (this gives 3/3 where the book
    // gave 4/2), but the rule - Defense follows its Essence - holds exactly.
    expect(result.ir.defenses).toEqual({ toughness: 19, evasion: 19, willpower: 13, cleverness: 15 });
  });

  test("grows every Movement type by the gain in natural Reach", () => {
    // Large reach 5 -> Gigantic reach 15, so +10ft on both types.
    expect(result.ir.movement.ground).toBe(40);
    expect(result.ir.movement.aerial).toBe(70);
  });

  test("shifts the attack skills and Initiative up one step", () => {
    expect(skillShift(result, 'might')).toBe('d8');
    expect(skillShift(result, 'targeting')).toBe('d6');
    expect(skillShift(result, 'initiative')).toBe('d6');
  });

  test("leaves untouched skills at their printed shift", () => {
    expect(skillShift(result, 'deception')).toBe('d6');
    expect(skillShift(result, 'infiltration')).toBe('d4');
  });

  test("doubles attack damage at a +3 increase", () => {
    expect(result.ir.attacks.map(a => a.damageValue)).toEqual([2, 2]);
  });

  test("scales attack ranges by RAW's x1.5, rounded to the nearest 5 feet", () => {
    const horn = result.ir.attacks.find(a => a.name === 'Blasting Horn');
    expect(horn.range).toMatchObject({ value: 45, long: 90 });
  });

  test("scales the distances inside a Power's text", () => {
    expect(result.ir.powers[0].text).toContain('30ft line');
  });

  test("flags a Perk that names a distance rather than silently scaling it", () => {
    expect(result.review).toContainEqual(expect.objectContaining({ section: 'perks', name: 'Powerful Leap' }));
  });

  test("leaves the original IR untouched", () => {
    expect(ir.threatLevel).toBe(7);
    expect(ir.essences.strength).toBe(6);
    expect(ir.attacks[0].damageValue).toBe(1);
  });
});

describe("computeGrownStatBlock - reproducing the published block's own choices", () => {
  /*
   * §6.3 of the plan: the published Grown Polluticorn deviates from the book's own algorithm in
   * three places. Every one is reachable through the options, which is the point of them.
   */
  const result = computeGrownStatBlock(ir, {
    tlIncrease: 3,
    newSize: 'gigantic',
    rangeMultiplier: 2,                                  // printed 60/120, not RAW's 45/90
    growMovement: false,                                 // printed 30/60, unchanged
    conditioningIncrease: 3,                             // printed "Conditioning +3"
    essenceAllocation: { strength: 4, speed: 2, smarts: 0, social: 0 },
  });

  test("matches the printed Essences exactly", () => {
    expect(result.ir.essences).toEqual({ strength: 10, speed: 8, smarts: 3, social: 5 });
  });

  test("matches the printed Defenses exactly", () => {
    expect(result.ir.defenses).toEqual({ toughness: 20, evasion: 18, willpower: 13, cleverness: 15 });
  });

  test("matches the printed Health, Conditioning included", () => {
    // Printed 13 = 7 + 3 (Threat Level) + 3 (the Conditioning the book also granted).
    expect(result.ir.health).toBe(13);
    expect(result.ir.conditioning).toBe(3);
  });

  test("matches the printed doubled ranges", () => {
    const horn = result.ir.attacks.find(a => a.name === 'Blasting Horn');
    expect(horn.range).toMatchObject({ value: 60, long: 120 });
  });

  test("matches the printed unchanged Movement", () => {
    expect(result.ir.movement).toMatchObject({ ground: 30, aerial: 60 });
    expect(result.review).toContainEqual(expect.objectContaining({ section: 'movement' }));
  });

  test("matches the printed doubled Power area", () => {
    expect(result.ir.powers[0].text).toContain('40ft line');
  });

  test("matches the printed skill shifts", () => {
    expect(skillShift(result, 'might')).toBe('d8');
    expect(skillShift(result, 'targeting')).toBe('d6');
    expect(skillShift(result, 'initiative')).toBe('d6');
  });
});

describe("computeGrownStatBlock - options and edge cases", () => {
  test("uses x2 range and x3 damage at a +4 increase", () => {
    const result = computeGrownStatBlock(ir, { tlIncrease: 4, newSize: 'towering' });
    expect(result.ir.attacks.map(a => a.damageValue)).toEqual([3, 3]);
    expect(result.ir.attacks.find(a => a.name === 'Blasting Horn').range.value).toBe(60);
  });

  test("honours an explicit skill allocation", () => {
    const result = computeGrownStatBlock(ir, { skillAllocation: { deception: 2 } });
    expect(skillShift(result, 'deception')).toBe('d10');
    expect(skillShift(result, 'might')).toBe('d6');
  });

  test("does not scale a zero-damage attack into existence", () => {
    const zero = { ...ir, attacks: [{ name: 'Feint', damageValue: 0, range: {}, alternateEffects: [] }] };
    expect(computeGrownStatBlock(zero).ir.attacks[0].damageValue).toBe(0);
  });

  test("scales an Alternate Effect alongside its parent attack", () => {
    const withAlt = {
      ...ir,
      attacks: [{
        name: 'Gore', damageValue: 2, range: {}, alternateEffects: [{ name: 'Rend', damageValue: 1, range: {} }],
      }],
    };
    expect(computeGrownStatBlock(withAlt).ir.attacks[0].alternateEffects[0].damageValue).toBe(2);
  });

  test("notes when Movement could not grow because Reach did not change", () => {
    const result = computeGrownStatBlock(ir, { newSize: 'long' });
    expect(result.ir.movement.ground).toBe(30);
    expect(result.review).toContainEqual(expect.objectContaining({ section: 'movement' }));
  });

  test("survives a sparse IR with no attacks, skills or sections", () => {
    const sparse = {
      name: 'Blob', threatLevel: 2, size: 'common', health: 3, conditioning: 0,
      essences: { strength: 1, speed: 1, smarts: 1, social: 1 },
      defenses: { toughness: 11, evasion: 11, willpower: 11, cleverness: 11 },
      movement: { ground: 30, aerial: null, swim: null, climb: null },
      skills: [], perks: [], powers: [], hangUps: [], attacks: [], languages: [], equipment: [],
    };
    const result = computeGrownStatBlock(sparse, { tlIncrease: 2 });
    expect(result.ir.threatLevel).toBe(4);
    expect(result.ir.essences.strength).toBe(5);
    expect(result.ir.movement.aerial).toBeNull();
  });
});
