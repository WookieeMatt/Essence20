import { getNumbnessDamageTypes, hasNumbnessResistance, NUMBNESS_ID, STONE_WARLORD_ID } from './numbness.mjs';

function makeActor(level, { hasNumbness = true, stoneWarlordChoice = null } = {}) {
  const items = [];
  if (hasNumbness) {
    items.push({ type: 'perk', flags: { core: { sourceId: NUMBNESS_ID } }, system: {} });
  }

  if (stoneWarlordChoice) {
    items.push({
      type: 'perk',
      flags: { core: { sourceId: STONE_WARLORD_ID } },
      system: { choice: stoneWarlordChoice },
    });
  }

  return { system: { level }, items };
}

describe('getNumbnessDamageTypes', () => {
  test('returns an empty list without the Numbness Perk', () => {
    expect(getNumbnessDamageTypes(makeActor(20, { hasNumbness: false }))).toEqual([]);
  });

  test('only Stun at 1st level', () => {
    expect(getNumbnessDamageTypes(makeActor(1))).toEqual(['stun']);
  });

  test('adds Psychic at 6th level', () => {
    expect(getNumbnessDamageTypes(makeActor(6))).toEqual(['stun', 'psychic']);
  });

  test('adds Blunt at 12th level', () => {
    expect(getNumbnessDamageTypes(makeActor(12))).toEqual(['stun', 'psychic', 'blunt']);
  });

  test('adds Energy at 18th level', () => {
    expect(getNumbnessDamageTypes(makeActor(18))).toEqual(['stun', 'psychic', 'blunt', 'energy']);
  });

  test("adds Stone Warlord's own chosen extra type at 20th level", () => {
    expect(getNumbnessDamageTypes(makeActor(20, { stoneWarlordChoice: 'sharp' }))).toEqual(
      ['stun', 'psychic', 'blunt', 'energy', 'sharp'],
    );
  });

  test('does not add a Stone Warlord type with no choice made yet', () => {
    expect(getNumbnessDamageTypes(makeActor(20))).toEqual(['stun', 'psychic', 'blunt', 'energy']);
  });
});

describe('hasNumbnessResistance', () => {
  test('matches a directly-listed type', () => {
    expect(hasNumbnessResistance(makeActor(6), 'psychic')).toBe(true);
  });

  test('does not match a type not yet unlocked', () => {
    expect(hasNumbnessResistance(makeActor(6), 'blunt')).toBe(false);
  });

  test("Energy at 18th matches any concrete Element sub-type", () => {
    expect(hasNumbnessResistance(makeActor(18), 'fire')).toBe(true);
    expect(hasNumbnessResistance(makeActor(18), 'electric')).toBe(true);
  });

  test('Energy does not match before 18th level', () => {
    expect(hasNumbnessResistance(makeActor(12), 'fire')).toBe(false);
  });

  test('returns false with no damage type given', () => {
    expect(hasNumbnessResistance(makeActor(20), null)).toBe(false);
  });

  test('returns false without the Perk at all', () => {
    expect(hasNumbnessResistance(makeActor(20, { hasNumbness: false }), 'stun')).toBe(false);
  });
});
