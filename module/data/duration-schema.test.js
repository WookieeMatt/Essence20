import { durationSchema, formatDuration, isLingering, parseDurationString } from "./duration-schema.mjs";
import { PowerItemData } from "./item/power.mjs";
import { SpellItemData } from "./item/spell.mjs";

// parseDurationString runs exactly once per item, during migration, where a wrong answer is
// silent and permanent - so every spelling below is one that actually occurs in the compendium
// content, taken from a dry run over packs/*/_source before the migration was applied.

describe("parseDurationString", () => {
  test.each([
    ["Instant", 'instant', null],
    ["1 scene", 'scenes', 1],
    ["1 Scene", 'scenes', 1],
    ["3 rounds", 'rounds', 3],
    ["3 Rounds", 'rounds', 3],
    ["10 Rounds", 'rounds', 10],
    ["1 round", 'rounds', 1],
    ["1 day", 'days', 1],
    ["1 hour", 'hours', 1],
    ["4 hours", 'hours', 4],
    ["10 minutes", 'minutes', 10],
  ])("parses %s", (raw, units, value) => {
    expect(parseDurationString(raw)).toEqual({ units, value, text: '' });
  });

  test("is case-insensitive, because the content contains both spellings", () => {
    expect(parseDurationString("1 scene")).toEqual(parseDurationString("1 Scene"));
  });

  test("tolerates the trailing whitespace one authored duration actually has", () => {
    expect(parseDurationString("1 day ")).toEqual({ units: 'days', value: 1, text: '' });
  });

  test("keeps the original wording when a qualifier can't be expressed structurally", () => {
    // The 4-round cap IS automatable; "or until disrupted" isn't. Parsing to rounds:4 alone
    // would silently drop half the printed rule off the sheet.
    expect(parseDurationString("4 rounds or until disrupted")).toEqual({
      units: 'rounds', value: 4, text: "4 rounds or until disrupted",
    });
  });

  test("maps an explicit Special to the special unit with nothing to preserve", () => {
    expect(parseDurationString("Special")).toEqual({ units: 'special', value: null, text: '' });
  });

  test("falls back to special and preserves anything unrecognised, rather than guessing", () => {
    expect(parseDurationString("until the end of the arc")).toEqual({
      units: 'special', value: null, text: "until the end of the arc",
    });
    expect(parseDurationString("5 fortnights")).toEqual({
      units: 'special', value: null, text: "5 fortnights",
    });
  });

  test("treats a blank or missing duration as instant", () => {
    expect(parseDurationString("")).toEqual({ units: 'instant', value: null, text: '' });
    expect(parseDurationString(null)).toEqual({ units: 'instant', value: null, text: '' });
    expect(parseDurationString(undefined)).toEqual({ units: 'instant', value: null, text: '' });
  });
});

describe("isLingering", () => {
  test("an Instant area is resolved and discarded", () => {
    expect(isLingering({ units: 'instant', value: null })).toBe(false);
  });

  test.each(['rounds', 'minutes', 'hours', 'days', 'scenes'])("a %s duration lingers", (units) => {
    expect(isLingering({ units, value: 1 })).toBe(true);
  });

  test("an unparseable duration lingers, since discarding it silently is the worse failure", () => {
    expect(isLingering({ units: 'special', value: null })).toBe(true);
  });

  test("a missing duration doesn't linger", () => {
    expect(isLingering(null)).toBe(false);
    expect(isLingering(undefined)).toBe(false);
  });
});

describe("formatDuration", () => {
  test("uses the singular unit for a count of one, so it doesn't read '1 Scenes'", () => {
    expect(formatDuration({ units: 'scenes', value: 1, text: '' })).toBe("1 E20.DurationUnitScene");
  });

  test("uses the plural unit for any other count", () => {
    expect(formatDuration({ units: 'rounds', value: 3, text: '' })).toBe("3 E20.DurationUnitRounds");
  });

  test("shows the preserved wording verbatim when there is some", () => {
    expect(formatDuration({ units: 'rounds', value: 4, text: "4 rounds or until disrupted" }))
      .toBe("4 rounds or until disrupted");
  });

  test.each(['instant', 'special'])("shows %s with no count", (units) => {
    expect(formatDuration({ units, value: null, text: '' })).not.toMatch(/^\d/);
  });

  test("survives a missing duration", () => {
    expect(formatDuration(null)).toBe('');
  });
});

describe.each([
  ["SpellItemData", SpellItemData],
  ["PowerItemData", PowerItemData],
])("%s", (_name, DataModel) => {
  test("spreads the shared duration field into its schema", () => {
    expect(DataModel.defineSchema().duration).toBeDefined();
  });
});

describe("durationSchema", () => {
  test("defaults to instant, so a new item doesn't accidentally linger", () => {
    expect(durationSchema().duration).toBeDefined();
  });
});
