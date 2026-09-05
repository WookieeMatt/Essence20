import {
  computeEssenceSpend, getEssenceOverspend, getNewEssenceOverspend, getSkillAttributionStatus, getSkillEssences,
} from "./skill-picker.mjs";

/**
 * Builds a minimal actor-shaped fixture with every skill CONFIG.E20.skillToEssence knows about
 * defaulted to an untrained d20 shift and its normal single home Essence (no spend), so tests
 * only need to override what they care about.
 */
function makeActor({ skillOverrides = {}, conditioning = 0, essences } = {}) {
  const skills = {};
  for (const [skill, homeEssence] of Object.entries(CONFIG.E20.skillToEssence)) {
    const skillEssences = { strength: false, speed: false, smarts: false, social: false };
    if (homeEssence === 'any') {
      skillEssences.strength = skillEssences.speed = skillEssences.smarts = skillEssences.social = true;
    } else {
      skillEssences[homeEssence] = true;
    }

    skills[skill] = {
      shift: 'd20',
      essences: skillEssences,
      essenceAttribution: { strength: 0, speed: 0, smarts: 0, social: 0 },
    };
  }

  for (const [skill, overrides] of Object.entries(skillOverrides)) {
    skills[skill] = { ...skills[skill], ...overrides };
  }

  return {
    system: { skills, conditioning, essences },
  };
}

describe("getSkillEssences", () => {
  test("returns the one true essence for a normal skill", () => {
    expect(getSkillEssences({ essences: { strength: true, speed: false, smarts: false, social: false } }))
      .toEqual(['strength']);
  });

  test("returns every true essence for a multi-essence skill", () => {
    expect(getSkillEssences({ essences: { strength: true, speed: false, smarts: false, social: true } }))
      .toEqual(['strength', 'social']);
  });

  test("returns an empty array when essences is missing", () => {
    expect(getSkillEssences({})).toEqual([]);
  });
});

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

  test("a bought specialization adds 1 to its skill's essence", () => {
    const actor = makeActor({
      skillOverrides: { acrobatics: { specializations: { abc12: { name: 'Sprinting', granted: false } } } },
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.speed.value).toBe(1);
    expect(spend.speed.string).toContain('Sprinting');
  });

  test("a granted specialization (from a Perk or other Item) is free - doesn't add to spend", () => {
    const actor = makeActor({
      skillOverrides: { acrobatics: { specializations: { abc12: { name: 'Sprinting', granted: true } } } },
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.speed.value).toBe(0);
    expect(spend.speed.string).not.toContain('Sprinting');
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

  test("a normal skill given a second Essence (e.g. GI Joe CRB's Terrifying Presence) splits its attribution too", () => {
    const actor = makeActor({
      skillOverrides: {
        intimidation: {
          shift: 'd8', // 4 upshifts
          essences: { strength: true, social: true, speed: false, smarts: false },
          essenceAttribution: { strength: 3, social: 1, speed: 0, smarts: 0 },
        },
      },
    });
    const spend = computeEssenceSpend(actor);

    expect(spend.strength.value).toBe(3);
    expect(spend.strength.string).toContain('Intimidation');
    expect(spend.social.value).toBe(1);
    expect(spend.social.string).toContain('Intimidation');
  });

  test("a still-single-essence skill ignores essenceAttribution entirely, even if some is set", () => {
    const actor = makeActor({
      skillOverrides: {
        athletics: { shift: 'd8', essenceAttribution: { strength: 0, speed: 4, smarts: 0, social: 0 } },
      },
    });
    const spend = computeEssenceSpend(actor);

    // Not multi-essence (only strength: true) - the whole upshift counts toward strength as
    // usual, ignoring the stray speed attribution.
    expect(spend.strength.value).toBe(4);
    expect(spend.speed.value).toBe(0);
  });

  test("doesn't throw when the actor's schema is missing a skill CONFIG.E20.skillToEssence knows about", () => {
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
    });
    actor.system.skills.athletics.specializations = { abc12: { name: 'Weightlifting', granted: false } }; // +1 strength
    const spend = computeEssenceSpend(actor);

    expect(spend.strength.value).toBe(8);
  });
});

describe("getEssenceOverspend", () => {
  test("returns an empty object when every essence is within its own max", () => {
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: { strength: { max: 4 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getEssenceOverspend(actor)).toEqual({});
  });

  test("flags an essence spent past its own max", () => {
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: { strength: { max: 3 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getEssenceOverspend(actor)).toEqual({ strength: { spent: 4, max: 3 } });
  });

  test("spending exactly the max is not overspend", () => {
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: { strength: { max: 4 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getEssenceOverspend(actor)).toEqual({});
  });

  test("flags more than one essence at once", () => {
    const actor = makeActor({
      skillOverrides: {
        athletics: { shift: 'd8' }, // +4 strength
        acrobatics: { shift: 'd10' }, // +5 speed
      },
      essences: { strength: { max: 3 }, speed: { max: 2 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getEssenceOverspend(actor)).toEqual({
      strength: { spent: 4, max: 3 },
      speed: { spent: 5, max: 2 },
    });
  });

  test("never flags anything when the actor has no system.essences at all", () => {
    // Not every actor type has this field (see character.mjs) - only PCs, which is also the only
    // actor type the Skill Picker ever calls this for.
    const actor = makeActor({ skillOverrides: { athletics: { shift: 'd8' } } });

    expect(getEssenceOverspend(actor)).toEqual({});
  });
});

describe("getNewEssenceOverspend", () => {
  test("blocks an increase that pushes an essence's spend past its own max", () => {
    const actor = makeActor({ essences: { strength: { max: 3 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } } });
    const previewActor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: { strength: { max: 3 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getNewEssenceOverspend(actor, previewActor)).toEqual({ strength: { spent: 4, max: 3 } });
  });

  test("allows an increase that stays within the max", () => {
    const actor = makeActor({ essences: { strength: { max: 5 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } } });
    const previewActor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: { strength: { max: 5 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } },
    });

    expect(getNewEssenceOverspend(actor, previewActor)).toEqual({});
  });

  // Regression case: a PC whose data predates this feature (or whose essences.max was later
  // lowered) can already be sitting over budget on some Essence. That must never lock them out of
  // saving unrelated changes - only actively spending MORE on that same already-over Essence
  // should be rejected.
  test("does not block a submission that leaves an already-over-budget essence unchanged", () => {
    const overBudgetEssences = { strength: { max: 1 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } };
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength, already over the max of 1
      essences: overBudgetEssences,
    });
    // Same actor state, plus an unrelated Speed change that stays within Speed's own max.
    // (CONFIG.E20.skillShiftList order: d20=0 upshifts, d2=1, d4=2, d6=3, d8=4, d10=5, d12=6.)
    const previewActor = makeActor({
      skillOverrides: {
        athletics: { shift: 'd8' },
        acrobatics: { shift: 'd4' }, // +2 speed, under speed's max of 3
      },
      essences: overBudgetEssences,
    });

    expect(getNewEssenceOverspend(actor, previewActor)).toEqual({});
  });

  test("does not block reducing spend on an already-over-budget essence, even if still over afterward", () => {
    const overBudgetEssences = { strength: { max: 1 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } };
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength
      essences: overBudgetEssences,
    });
    const previewActor = makeActor({
      skillOverrides: { athletics: { shift: 'd6' } }, // +3 strength - reduced, but still over max of 1
      essences: overBudgetEssences,
    });

    expect(getNewEssenceOverspend(actor, previewActor)).toEqual({});
  });

  test("blocks further-increasing spend on an essence that's already over its max", () => {
    const overBudgetEssences = { strength: { max: 1 }, speed: { max: 3 }, smarts: { max: 3 }, social: { max: 3 } };
    const actor = makeActor({
      skillOverrides: { athletics: { shift: 'd6' } }, // +3 strength
      essences: overBudgetEssences,
    });
    const previewActor = makeActor({
      skillOverrides: { athletics: { shift: 'd8' } }, // +4 strength - increased further past max of 1
      essences: overBudgetEssences,
    });

    expect(getNewEssenceOverspend(actor, previewActor)).toEqual({ strength: { spent: 4, max: 1 } });
  });
});

describe("getSkillAttributionStatus", () => {
  test("a skill with no upshift and no attribution is balanced", () => {
    const status = getSkillAttributionStatus({ shift: 'd20', essenceAttribution: { strength: 0, speed: 0, smarts: 0, social: 0 } });
    expect(status).toEqual({ upshifts: 0, attributed: 0, isBalanced: true });
  });

  test("attribution matching the upshift count is balanced", () => {
    // d20 is index 10 in CONFIG.E20.skillShiftList, d10 is index 5 - 5 steps up
    const status = getSkillAttributionStatus({ shift: 'd10', essenceAttribution: { strength: 2, speed: 3, smarts: 0, social: 0 } });
    expect(status.upshifts).toBe(5);
    expect(status.attributed).toBe(5);
    expect(status.isBalanced).toBe(true);
  });

  test("under-attributed spend is flagged unbalanced", () => {
    const status = getSkillAttributionStatus({ shift: 'd10', essenceAttribution: { strength: 1, speed: 0, smarts: 0, social: 0 } });
    expect(status.upshifts).toBe(5);
    expect(status.attributed).toBe(1);
    expect(status.isBalanced).toBe(false);
  });

  test("over-attributed spend is flagged unbalanced too", () => {
    const status = getSkillAttributionStatus({ shift: 'd12', essenceAttribution: { strength: 5, speed: 0, smarts: 0, social: 0 } });
    expect(status.isBalanced).toBe(false);
  });

  test("missing essenceAttribution is treated as all zeros", () => {
    const status = getSkillAttributionStatus({ shift: 'd20' });
    expect(status).toEqual({ upshifts: 0, attributed: 0, isBalanced: true });
  });
});
