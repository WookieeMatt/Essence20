import { durationToSeconds, isAoeExpired } from './aoe-expiry.mjs';

// expireAoeRegions/expireAoeRegionsForScene/reconcileAoeRegions walk real scenes and delete real
// embedded documents, so they're verified live like the rest of this codebase's canvas layer. The
// decision they're built on - "has this area run out?" - is pure, and is what's tested here.

function makeAoe({ units, value = null, placedAtRound = null, placedAtWorldTime = null } = {}) {
  return { duration: { units, value, text: '' }, placedAtRound, placedAtWorldTime };
}

describe("durationToSeconds", () => {
  test.each([
    ['minutes', 10, 600],
    ['hours', 1, 3600],
    ['hours', 4, 14400],
    ['days', 1, 86400],
  ])("converts %s x%s with a default calendar", (units, value, expected) => {
    expect(durationToSeconds({ units, value })).toBe(expected);
  });

  test("uses the world's own calendar, so a custom day isn't assumed to be 24 hours", () => {
    const days = { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 10 };
    expect(durationToSeconds({ units: 'days', value: 1 }, days)).toBe(36000);
  });

  test.each(['rounds', 'scenes', 'instant', 'special'])("isn't measured in seconds for %s", (units) => {
    expect(durationToSeconds({ units, value: 3 })).toBeNull();
  });

  test("has no length without a value", () => {
    expect(durationToSeconds({ units: 'hours', value: null })).toBeNull();
  });
});

describe("isAoeExpired - rounds", () => {
  // "3 rounds" placed during round 3 covers rounds 3, 4 and 5 - counted inclusively from the
  // round it was placed in, so it dies at the end of round 5, not round 6.
  const aoe = makeAoe({ units: 'rounds', value: 3, placedAtRound: 3 });

  test.each([3, 4])("survives the end of round %s", (round) => {
    expect(isAoeExpired(aoe, { round })).toBe(false);
  });

  test("expires at the end of the third round it covered", () => {
    expect(isAoeExpired(aoe, { round: 5 })).toBe(true);
  });

  test("is still expired later, so a missed round can't strand it forever", () => {
    expect(isAoeExpired(aoe, { round: 9 })).toBe(true);
  });

  test("a one-round area expires at the end of the round it was placed in", () => {
    const oneRound = makeAoe({ units: 'rounds', value: 1, placedAtRound: 2 });
    expect(isAoeExpired(oneRound, { round: 2 })).toBe(true);
  });

  test("placed outside combat, it waits for the encounter to end rather than vanishing", () => {
    const noCombat = makeAoe({ units: 'rounds', value: 3, placedAtRound: null });
    expect(isAoeExpired(noCombat, { round: 7 })).toBe(false);
    expect(isAoeExpired(noCombat, { round: 7, sceneEnded: true })).toBe(true);
  });
});

describe("isAoeExpired - world time", () => {
  const aoe = makeAoe({ units: 'minutes', value: 10, placedAtWorldTime: 1000 });

  test("survives until its own span has passed", () => {
    expect(isAoeExpired(aoe, { worldTime: 1599 })).toBe(false);
  });

  test("expires exactly when its span is reached", () => {
    expect(isAoeExpired(aoe, { worldTime: 1600 })).toBe(true);
  });

  test("expires after its span too, so a skipped update can't strand it", () => {
    expect(isAoeExpired(aoe, { worldTime: 99999 })).toBe(true);
  });

  test("time running backwards doesn't expire it", () => {
    expect(isAoeExpired(aoe, { worldTime: 500 })).toBe(false);
  });

  test("with no recorded placement time, it waits for the encounter to end", () => {
    const noStamp = makeAoe({ units: 'hours', value: 1 });
    expect(isAoeExpired(noStamp, { worldTime: 99999 })).toBe(false);
    expect(isAoeExpired(noStamp, { worldTime: 99999, sceneEnded: true })).toBe(true);
  });
});

describe("isAoeExpired - the unmeasured cases", () => {
  test("a scene-long area ends with the encounter and not before", () => {
    const aoe = makeAoe({ units: 'scenes', value: 1 });
    expect(isAoeExpired(aoe, { round: 99, worldTime: 99999 })).toBe(false);
    expect(isAoeExpired(aoe, { sceneEnded: true })).toBe(true);
  });

  test("an unparseable duration never expires on its own", () => {
    // Guessing a length for a duration nobody could parse would be worse than leaving it for the
    // GM to remove - see the schema's own note on falling back to special.
    const aoe = makeAoe({ units: 'special' });
    expect(isAoeExpired(aoe, { round: 99, worldTime: 99999, sceneEnded: true })).toBe(false);
  });

  test("an Instant area on the scene is stale by definition", () => {
    // It should never have been persisted at all, so if one is there, it's left over.
    expect(isAoeExpired(makeAoe({ units: 'instant' }), {})).toBe(true);
  });

  test("a region with no duration payload is left alone", () => {
    expect(isAoeExpired(null, { sceneEnded: true })).toBe(false);
    expect(isAoeExpired({}, { sceneEnded: true })).toBe(false);
  });
});
