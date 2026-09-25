import {
  checkStartingEssences, currentBase, DEFAULT_BASE, essencesOverspentBy, MAX_ESSENCE, MAX_ESSENCE_NIGHT_VALE,
  maxEssenceFor, recommendedSpread, startingEssencesUpdate,
} from "./starting-essences.mjs";

/** A character whose Essences already carry an Origin (+1 Smarts) and Role (+3) on top of `base`. */
function makeActor({ base, assigned = false } = {}) {
  const spread = base ?? { ...DEFAULT_BASE };
  const bonus = { strength: 1, speed: 1, smarts: 2, social: 0 };
  const essences = {};
  for (const [essence, value] of Object.entries(spread)) {
    essences[essence] = { max: value + bonus[essence], value: value + bonus[essence] };
  }

  return { system: { essences, essenceBase: base, essencesAssigned: assigned } };
}

describe("maxEssenceFor", () => {
  test("15 for most lines, 8 for Welcome to Night Vale", () => {
    expect(maxEssenceFor('transformers')).toBe(MAX_ESSENCE);
    expect(maxEssenceFor('giJoe')).toBe(15);
    expect(maxEssenceFor('welcomeToNightVale')).toBe(MAX_ESSENCE_NIGHT_VALE);
  });

  // A world playing every line has no Game Line to go by, so the character's Role decides.
  test("an all-lines world falls back to the character's Role", () => {
    expect(maxEssenceFor('', 'welcomeToNightVale')).toBe(8);
    expect(maxEssenceFor('', 'powerRangers')).toBe(15);
    expect(maxEssenceFor('', null)).toBe(15);
  });

  test("the world's Game Line wins over the Role", () => {
    expect(maxEssenceFor('transformers', 'welcomeToNightVale')).toBe(15);
  });
});

describe("checkStartingEssences", () => {
  test("12 points, each between 1 and the cap, is valid", () => {
    expect(checkStartingEssences({ strength: 4, speed: 3, smarts: 3, social: 2 }, 15))
      .toEqual({ spent: 12, remaining: 0, tooLow: [], tooHigh: [], isValid: true });
  });

  test("points still to spend, or too many spent, is not", () => {
    expect(checkStartingEssences({ strength: 3, speed: 3, smarts: 3, social: 1 }, 15)).toMatchObject({ remaining: 2, isValid: false });
    expect(checkStartingEssences({ strength: 5, speed: 3, smarts: 3, social: 3 }, 15)).toMatchObject({ remaining: -2, isValid: false });
  });

  test("an Essence below 1 or above the cap is not", () => {
    expect(checkStartingEssences({ strength: 12, speed: 0, smarts: 0, social: 0 }, 15))
      .toMatchObject({ tooLow: ['speed', 'smarts', 'social'], isValid: false });
    expect(checkStartingEssences({ strength: 9, speed: 1, smarts: 1, social: 1 }, 8))
      .toMatchObject({ tooHigh: ['strength'], isValid: false });
  });
});

describe("recommendedSpread", () => {
  test("puts the 4 and the 2 where asked, 3 elsewhere", () => {
    expect(recommendedSpread('speed', 'smarts')).toEqual({ strength: 3, speed: 4, smarts: 2, social: 3 });
  });

  test("the same Essence for both leaves an even spread", () => {
    expect(recommendedSpread('speed', 'speed')).toEqual({ strength: 3, speed: 3, smarts: 3, social: 3 });
  });
});

describe("currentBase", () => {
  test("reads the saved spread", () => {
    const base = { strength: 4, speed: 3, smarts: 3, social: 2 };
    expect(currentBase(makeActor({ base }))).toEqual(base);
  });

  // A character from before Starting Essences existed was given 3 in each.
  test("falls back to 3 each when nothing was saved", () => {
    expect(currentBase({ system: { essences: {} } })).toEqual(DEFAULT_BASE);
  });
});

describe("startingEssencesUpdate", () => {
  test("moves each Essence by the difference, keeping the Origin and Role bonuses", () => {
    const actor = makeActor();
    const update = startingEssencesUpdate(actor, { strength: 4, speed: 3, smarts: 3, social: 2 });
    expect(update).toEqual({
      'system.essencesAssigned': true,
      'system.essenceBase.strength': 4,
      'system.essenceBase.speed': 3,
      'system.essenceBase.smarts': 3,
      'system.essenceBase.social': 2,
      'system.essences.strength.max': 5,
      'system.essences.strength.value': 5,
      'system.essences.social.max': 2,
      'system.essences.social.value': 2,
    });
  });

  // A re-spread starts from what was saved last time, not from the old default.
  test("a re-spread applies only what changed since the last one", () => {
    const actor = makeActor({ base: { strength: 4, speed: 3, smarts: 3, social: 2 }, assigned: true });
    const update = startingEssencesUpdate(actor, { strength: 2, speed: 3, smarts: 3, social: 4 });
    expect(update['system.essences.strength.max']).toBe(3);
    expect(update['system.essences.social.max']).toBe(4);
    expect(update).not.toHaveProperty('system.essences.speed.max');
  });
});

describe("essencesOverspentBy", () => {
  test("names an Essence lowered below what its skills already cost", () => {
    const actor = makeActor();
    const spend = { strength: { value: 4 }, speed: { value: 0 }, smarts: { value: 0 }, social: { value: 0 } };
    // Strength is 3 + 1 = 4 now; taking the base to 1 leaves 2 to pay for 4 skill ranks.
    expect(essencesOverspentBy(actor, { strength: 1, speed: 5, smarts: 3, social: 3 }, spend)).toEqual(['strength']);
    expect(essencesOverspentBy(actor, { strength: 3, speed: 3, smarts: 3, social: 3 }, spend)).toEqual([]);
  });
});
