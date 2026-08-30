import { computeEssenceSpend, getAnySkillAttributionStatus } from "./skill-picker.mjs";

/**
 * Builds a minimal actor-shaped fixture with every skill CONFIG.E20.skillsByEssence knows about
 * defaulted to an untrained d20 shift (no spend), so tests only need to override what they care
 * about.
 */
function makeActor({ skillOverrides = {}, conditioning = 0, items = [] } = {}) {
  const skills = {};
  for (const skillList of Object.values(CONFIG.E20.skillsByEssence)) {
    for (const skill of skillList) {
      skills[skill] = { shift: 'd20', essenceAttribution: { strength: 0, speed: 0, smarts: 0, social: 0 } };
    }
  }

  for (const [skill, overrides] of Object.entries(skillOverrides)) {
    skills[skill] = { ...skills[skill], ...overrides };
  }

  return {
    system: { skills, conditioning },
    items,
  };
}

describe("computeEssenceSpend", () => {
  test("an untouched actor spends nothing in any essence", () => {
    const spend = computeEssenceSpend(makeActor());
    for (const essence of Object.keys(CONFIG.E20.originEssences)) {
      expect(spend[essence].value).toBe(0);
    }
  });

  test("upshifting a normal skill adds to its own essence only", () => {
    const actor = makeActor({ skillOverrides: { athletics: { shift: 'd8' } } });
    const spend = computeEssenceSpend(actor);

    // d20 is index 10 in CONFIG.E20.skillShiftList, d8 is index 6 - 4 steps up
    expect(spend.strength.value).toBe(4);
    expect(spend.speed.value).toBe(0);
    expect(spend.smarts.value).toBe(0);
    expect(spend.social.value).toBe(0);
  });

  test("a specialization item adds 1 to its skill's essence", () => {
    const actor = makeActor({
      items: [{ type: 'specialization', name: 'Sprinting', system: { skill: 'acrobatics' } }],
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.speed.value).toBe(1);
    expect(spend.speed.string).toContain('Sprinting');
  });

  test("an any-essence skill's attribution splits across multiple real essences", () => {
    const actor = makeActor({
      skillOverrides: {
        weird: { shift: 'd10', essenceAttribution: { strength: 2, speed: 2, smarts: 0, social: 0 } },
      },
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.strength.value).toBe(2);
    expect(spend.speed.value).toBe(2);
    expect(spend.smarts.value).toBe(0);
    expect(spend.social.value).toBe(0);
  });

  test("doesn't throw when the actor's schema is missing a skill CONFIG.E20.skillsByEssence knows about", () => {
    // Zord/Megaform's schema (module/data/actor/templates/zord-base.mjs) has no `weird` entry.
    const actor = makeActor({ skillOverrides: { athletics: { shift: 'd8' } } });
    delete actor.system.skills.weird;

    const spend = computeEssenceSpend(actor);
    expect(spend.strength.value).toBe(4);
  });

  test("conditioning is added directly into strength, not run through upshift math", () => {
    const actor = makeActor({ conditioning: 4 });
    const spend = computeEssenceSpend(actor);

    expect(spend.strength.value).toBe(4);
    expect(spend.strength.string).toContain('4');
  });

  test("upshifts, specializations, any-skill attribution, and conditioning all accumulate together", () => {
    const actor = makeActor({
      skillOverrides: {
        athletics: { shift: 'd8' }, // +4 strength
        weird: { shift: 'd10', essenceAttribution: { strength: 1, speed: 0, smarts: 0, social: 0 } }, // +1 strength
      },
      conditioning: 2, // +2 strength
      items: [{ type: 'specialization', name: 'Weightlifting', system: { skill: 'athletics' } }], // +1 strength
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.strength.value).toBe(8);
  });
});

describe("getAnySkillAttributionStatus", () => {
  test("a skill with no upshift and no attribution is balanced", () => {
    const status = getAnySkillAttributionStatus({ shift: 'd20', essenceAttribution: { strength: 0, speed: 0, smarts: 0, social: 0 } });
    expect(status).toEqual({ upshifts: 0, attributed: 0, isBalanced: true });
  });

  test("attribution matching the upshift count is balanced", () => {
    // d20 is index 10 in CONFIG.E20.skillShiftList, d10 is index 5 - 5 steps up
    const status = getAnySkillAttributionStatus({ shift: 'd10', essenceAttribution: { strength: 2, speed: 3, smarts: 0, social: 0 } });
    expect(status.upshifts).toBe(5);
    expect(status.attributed).toBe(5);
    expect(status.isBalanced).toBe(true);
  });

  test("under-attributed spend is flagged unbalanced", () => {
    const status = getAnySkillAttributionStatus({ shift: 'd10', essenceAttribution: { strength: 1, speed: 0, smarts: 0, social: 0 } });
    expect(status.upshifts).toBe(5);
    expect(status.attributed).toBe(1);
    expect(status.isBalanced).toBe(false);
  });

  test("over-attributed spend is flagged unbalanced too", () => {
    const status = getAnySkillAttributionStatus({ shift: 'd12', essenceAttribution: { strength: 5, speed: 0, smarts: 0, social: 0 } });
    expect(status.isBalanced).toBe(false);
  });

  test("missing essenceAttribution is treated as all zeros", () => {
    const status = getAnySkillAttributionStatus({ shift: 'd20' });
    expect(status).toEqual({ upshifts: 0, attributed: 0, isBalanced: true });
  });
});
