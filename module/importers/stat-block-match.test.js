import {
  MATCHABLE_SECTIONS,
  buildMatchIndex,
  countEffectBearingMatches,
  countMatches,
  findMatches,
  indexKey,
  normalizeItemName,
  selectMatch,
} from "./stat-block-match.mjs";

/** A stand-in for what loadCompendiumEntries reads out of the real pack indexes. */
const ENTRIES = [
  { name: 'Powerful Leap', type: 'perk', uuid: 'Compendium.essence20.pr_crb.Item.aaa', packId: 'essence20.pr_crb', packLabel: 'Power Ranger CRB', folder: 'Power Rangers' },
  { name: 'Powerful Leap', type: 'perk', uuid: 'Compendium.essence20.gi_joe_crb.Item.bbb', packId: 'essence20.gi_joe_crb', packLabel: 'GI Joe CRB', folder: 'GI Joe' },
  { name: 'Super Strike', type: 'perk', uuid: 'Compendium.essence20.pr_crb.Item.ccc', packId: 'essence20.pr_crb', packLabel: 'Power Ranger CRB', folder: 'Power Rangers' },
  { name: 'Lightning Vision', type: 'power', uuid: 'Compendium.essence20.pr_crb.Item.ddd', packId: 'essence20.pr_crb', packLabel: 'Power Ranger CRB', folder: 'Power Rangers' },
  { name: 'Weak Point', type: 'hangUp', uuid: 'Compendium.essence20.pr_crb.Item.eee', packId: 'essence20.pr_crb', packLabel: 'Power Ranger CRB', folder: 'Power Rangers' },
  // Same name, different type - must not cross-match.
  { name: 'Super Strike', type: 'power', uuid: 'Compendium.essence20.pr_crb.Item.fff', packId: 'essence20.pr_crb', packLabel: 'Power Ranger CRB', folder: 'Power Rangers' },
];

const index = buildMatchIndex(ENTRIES);

describe("normalizeItemName", () => {
  test("ignores case, spacing and punctuation", () => {
    expect(normalizeItemName('Powerful Leap')).toBe('powerfulleap');
    expect(normalizeItemName('powerful-leap!')).toBe('powerfulleap');
    expect(normalizeItemName("Hang-Ups")).toBe('hangups');
  });

  test("survives null and undefined", () => {
    expect(normalizeItemName(null)).toBe('');
    expect(normalizeItemName(undefined)).toBe('');
  });
});

describe("buildMatchIndex", () => {
  test("groups entries sharing a name and type", () => {
    expect(index.get(indexKey('perk', 'Powerful Leap'))).toHaveLength(2);
  });

  test("keeps the same name under different types apart", () => {
    expect(index.get(indexKey('perk', 'Super Strike'))).toHaveLength(1);
    expect(index.get(indexKey('power', 'Super Strike'))).toHaveLength(1);
  });

  test("skips malformed entries rather than indexing them", () => {
    const sparse = buildMatchIndex([{ name: 'No Type' }, { type: 'perk' }, null]);
    expect(sparse.size).toBe(0);
  });
});

describe("selectMatch", () => {
  test("returns null when nothing shares the name", () => {
    expect(selectMatch(undefined)).toBeNull();
    expect(selectMatch([])).toBeNull();
  });

  test("takes the only candidate and does not call it ambiguous", () => {
    const match = selectMatch(index.get(indexKey('perk', 'Super Strike')));
    expect(match).toMatchObject({ packLabel: 'Power Ranger CRB', ambiguous: false, candidateCount: 1 });
  });

  test("uses the preferred game line to break a tie", () => {
    const match = selectMatch(index.get(indexKey('perk', 'Powerful Leap')), 'GI Joe');
    expect(match).toMatchObject({ packLabel: 'GI Joe CRB', ambiguous: false });
  });

  test("still picks deterministically without a preference, but flags it ambiguous", () => {
    const match = selectMatch(index.get(indexKey('perk', 'Powerful Leap')));
    expect(match).toMatchObject({ packLabel: 'GI Joe CRB', ambiguous: true, candidateCount: 2 });
  });

  test("falls back to all candidates when the preferred line has none", () => {
    const match = selectMatch(index.get(indexKey('perk', 'Super Strike')), 'Transformers');
    expect(match).toMatchObject({ packLabel: 'Power Ranger CRB', ambiguous: false });
  });
});

describe("findMatches", () => {
  const ir = {
    perks: [{ name: 'Super Strike' }, { name: 'Invented Perk' }],
    powers: [{ name: 'Lightning Vision' }],
    hangUps: [{ name: 'Weak Point' }],
  };

  test("resolves each matchable section", () => {
    const matches = findMatches(ir, index, 'Power Rangers');
    expect(matches.perks[0].match.uuid).toBe('Compendium.essence20.pr_crb.Item.ccc');
    expect(matches.powers[0].match.uuid).toBe('Compendium.essence20.pr_crb.Item.ddd');
    expect(matches.hangUps[0].match.uuid).toBe('Compendium.essence20.pr_crb.Item.eee');
  });

  test("reports an unmatched name as a null match rather than dropping it", () => {
    const matches = findMatches(ir, index);
    expect(matches.perks[1]).toEqual({ name: 'Invented Perk', match: null });
  });

  test("keeps results positionally aligned with the IR's own arrays", () => {
    const matches = findMatches(ir, index);
    expect(matches.perks.map(entry => entry.name)).toEqual(['Super Strike', 'Invented Perk']);
  });

  test("handles an IR with no matchable sections at all", () => {
    const matches = findMatches({}, index);
    expect(matches).toEqual({ perks: [], powers: [], hangUps: [] });
  });

  test("covers exactly the sections MATCHABLE_SECTIONS declares", () => {
    expect(Object.keys(findMatches({}, index))).toEqual(Object.keys(MATCHABLE_SECTIONS));
  });
});

describe("countMatches", () => {
  test("counts matched against total across every section", () => {
    const matches = findMatches({
      perks: [{ name: 'Super Strike' }, { name: 'Invented Perk' }],
      powers: [{ name: 'Lightning Vision' }],
    }, index);
    expect(countMatches(matches)).toEqual({ matched: 2, total: 3 });
  });

  test("returns zeroes for no matches at all", () => {
    expect(countMatches(null)).toEqual({ matched: 0, total: 0 });
  });
});

describe("countEffectBearingMatches", () => {
  /*
   * This drives the importer's double-counting caution. A printed stat block's numbers already
   * include that Threat's own Perks, so a matched Perk whose Active Effect ADDs to the same field
   * makes the actor stronger than the page says - observed live, where a matched "Never Back Down"
   * (system.health.bonus add 2) turned a printed Health of 4 into a derived 6.
   */
  test("counts only matched entries whose compendium item carries effects", () => {
    expect(countEffectBearingMatches({
      perks: [
        { name: 'With', match: { hasEffects: true } },
        { name: 'Without', match: { hasEffects: false } },
        { name: 'Unmatched', match: null },
      ],
      powers: [{ name: 'Also With', match: { hasEffects: true } }],
    })).toBe(2);
  });

  test("returns zero when nothing matched", () => {
    expect(countEffectBearingMatches(null)).toBe(0);
    expect(countEffectBearingMatches({ perks: [{ name: 'x', match: null }] })).toBe(0);
  });
});
