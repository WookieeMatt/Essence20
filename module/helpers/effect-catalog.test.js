import { jest } from '@jest/globals';
import {
  allKeys,
  appendChanges,
  buildChange,
  buildChanges,
  changesPath,
  describeChange,
  isKnownKey,
  parseKey,
  readChanges,
  suggestKey,
  summarize,
  summarizeEffect,
  writeChanges,
} from './effect-catalog.mjs';

describe('effect catalog - key index', () => {
  test('covers the five key shapes that dominate the compendium packs', () => {
    const keys = allKeys();
    expect(keys).toContain('system.skills.infiltration.shiftUp');
    expect(keys).toContain('system.skills.infiltration.shiftDown');
    expect(keys).toContain('system.skills.alertness.edge');
    expect(keys).toContain('system.health.bonus');
    expect(keys).toContain('system.defenses.toughness.bonus');
  });

  test('resolves a key back to its group, target and property', () => {
    const entry = parseKey('system.skills.infiltration.shiftUp');
    expect(entry).toMatchObject({
      groupId: 'skills',
      propertyId: 'shift',
      target: 'infiltration',
      variant: 'plus',
    });
  });

  test('resolves the down half of a signed pair to the same property', () => {
    expect(parseKey('system.skills.infiltration.shiftDown')).toMatchObject({
      propertyId: 'shift',
      variant: 'minus',
    });
  });

  test('resolves an Essence-wide shift separately from a per-skill one', () => {
    expect(parseKey('system.essenceShifts.social.snag')).toMatchObject({
      groupId: 'essenceShifts',
      propertyId: 'edgeSnag',
      target: 'social',
      variant: 'minus',
    });
  });

  test('resolves the two-target extra-Essence grant', () => {
    expect(parseKey('system.skills.intimidation.essences.social')).toMatchObject({
      groupId: 'skills',
      propertyId: 'extraEssence',
      target: 'intimidation',
      target2: 'social',
    });
  });

  test('returns null for an unknown key rather than throwing', () => {
    expect(parseKey('system.skills.infiltration.nonsense')).toBeNull();
    expect(parseKey('')).toBeNull();
    expect(parseKey(undefined)).toBeNull();
    expect(parseKey(42)).toBeNull();
  });

  test('accepts legitimately dynamic keys that cannot be enumerated', () => {
    expect(isKnownKey('system.skills.science.specializations.medicine.shiftUp')).toBe(true);
    expect(isKnownKey('system.trained.upgrades.armors.standard')).toBe(true);
    expect(isKnownKey('system.skills.science.somethingElse.medicine')).toBe(false);
  });

  test('never offers a computed field through a non-readOnly property', () => {
    expect(parseKey('system.defenses.toughness.total').property.readOnly).toBe(true);
    expect(parseKey('system.defenses.toughness.bonus').property.readOnly).toBeUndefined();
  });
});

describe('effect catalog - building changes', () => {
  test('a positive shift writes shiftUp', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: 1,
    })).toEqual({
      key: 'system.skills.infiltration.shiftUp', type: 'add', value: 1, phase: 'initial',
    });
  });

  test('more than one upshift is just a larger value', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: 3,
    })).toMatchObject({ key: 'system.skills.infiltration.shiftUp', value: 3 });
  });

  test('a negative shift writes shiftDown as a positive value', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: -2,
    })).toEqual({
      key: 'system.skills.infiltration.shiftDown', type: 'add', value: 2, phase: 'initial',
    });
  });

  test('a zero shift builds nothing', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: 0,
    })).toBeNull();
  });

  test('Edge and Snag write their own booleans with an override', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'edgeSnag', target: 'alertness', value: 'plus',
    })).toEqual({
      key: 'system.skills.alertness.edge', type: 'override', value: true, phase: 'initial',
    });
    expect(buildChange({
      groupId: 'skills', propertyId: 'edgeSnag', target: 'alertness', value: 'minus',
    })).toMatchObject({ key: 'system.skills.alertness.snag', value: true });
  });

  test('writes a real boolean, not the string "true" the v13 packs carry', () => {
    const change = buildChange({
      groupId: 'damage', propertyId: 'immunity', target: 'poison', value: true,
    });
    expect(change.value).toBe(true);
    expect(change.value).not.toBe('true');
  });

  test('builds a targetless property', () => {
    expect(buildChange({ groupId: 'health', propertyId: 'bonus', value: 5 })).toMatchObject({
      key: 'system.health.bonus', type: 'add', value: 5,
    });
  });

  test('builds the two-target extra-Essence grant', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'extraEssence', target: 'intimidation', target2: 'social',
      value: true,
    })).toMatchObject({ key: 'system.skills.intimidation.essences.social', value: true });
  });

  test('builds an Energon maximum, the one Energon pool that has a ceiling', () => {
    expect(buildChange({ groupId: 'energon', propertyId: 'max', value: 2 })).toMatchObject({
      key: 'system.energon.normal.max', type: 'add', value: 2,
    });
  });

  // Derived data ASSIGNS these, so an initial-phase change is computed and then thrown away -
  // found by probing them live (helpers/effect-catalog-audit.mjs#probeClobberedKeys). Each one is
  // either marked readOnly (there is a supported input field instead) or moved to the final phase
  // (there is not).
  test('does not offer Health maximum - health.bonus is the supported input', () => {
    expect(parseKey('system.health.max').property.readOnly).toBe(true);
    expect(parseKey('system.health.bonus').property.readOnly).toBeUndefined();
  });

  test('applies the Sorcerous Power maximum in the final phase', () => {
    // _prepareSorcerousPower assigns it from the actor's level, with no bonus field to feed.
    expect(buildChange({ groupId: 'powers', propertyId: 'sorcerousMax', value: 2 }))
      .toMatchObject({ key: 'system.powers.sorcerous.max', phase: 'final' });
  });

  test('leaves Personal Power maximum in the initial phase, which its prep adds on top of', () => {
    expect(buildChange({ groupId: 'powers', propertyId: 'personalMax', value: 2 }))
      .toMatchObject({ key: 'system.powers.personal.max', phase: 'initial' });
  });

  test('applies the Energon maximum in the final phase, or it would be overwritten', () => {
    // _prepareEnergon assigns this field outright during derived data, so an initial-phase
    // change is computed and then thrown away. Core runs the final phase afterwards.
    expect(buildChange({ groupId: 'energon', propertyId: 'max', value: 2 }).phase)
      .toBe('final');
  });

  test('every other property still applies in the initial phase', () => {
    expect(buildChange({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: 1,
    }).phase).toBe('initial');
    expect(buildChange({ groupId: 'health', propertyId: 'bonus', value: 1 }).phase)
      .toBe('initial');
  });
  test('an unknown group or property builds nothing', () => {
    expect(buildChange({ groupId: 'nope', propertyId: 'shift', value: 1 })).toBeNull();
    expect(buildChange({ groupId: 'skills', propertyId: 'nope', value: 1 })).toBeNull();
  });
});

describe('effect catalog - round tripping', () => {
  test('a built change describes back to the selection that made it', () => {
    const selection = {
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: -2,
    };
    const described = describeChange(buildChange(selection));
    expect(described).toMatchObject({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: -2,
    });
  });

  test('an Edge change describes back as the Edge side of its control', () => {
    expect(describeChange({ key: 'system.skills.alertness.snag', value: true }))
      .toMatchObject({ value: 'minus' });
  });

  test('every catalog key round-trips through describeChange', () => {
    for (const key of allKeys()) {
      expect(describeChange({ key, value: 1 })).not.toBeNull();
    }
  });
});

describe('effect catalog - plain English', () => {
  test('describes an upshift in book vocabulary', () => {
    // Outside a running Foundry there is no localized sentence to interpolate into, so summarize
    // falls back to joining the pieces. The pieces are what matter here, not the prose.
    const summary = summarize({ key: 'system.skills.infiltration.shiftUp', value: 1 });
    expect(summary).toContain('E20.SkillInfiltration');
    expect(summary).toContain('E20.EffectDirectionUp');
    expect(summary).toContain('1');
  });

  test('describes a downshift as down, not as a negative', () => {
    expect(summarize({ key: 'system.skills.infiltration.shiftDown', value: 2 }))
      .toContain('E20.EffectDirectionDown');
  });

  test('describes a defense bonus', () => {
    const summary = summarize({ key: 'system.defenses.toughness.bonus', value: 2 });
    expect(summary).toContain('E20.DefenseToughness');
    expect(summary).toContain('2');
  });

  test('returns null for a key it cannot describe, rather than inventing a sentence', () => {
    expect(summarize({ key: 'system.skills.infiltration.nonsense', value: 1 })).toBeNull();
    expect(summarize({ key: 'systen.skills.might.shiftUp', value: 1 })).toBeNull();
  });

  test('summarizes a whole effect, skipping rows it cannot describe', () => {
    const effect = {
      system: {
        changes: [
          { key: 'system.skills.infiltration.shiftUp', value: 1 },
          { key: 'systen.skills.might.shiftUp', value: 1 },
          { key: 'system.health.bonus', value: 3 },
        ],
      },
    };
    expect(summarizeEffect(effect)).toHaveLength(2);
  });
});

describe('effect catalog - typo suggestions', () => {
  // Every one of these is a real key that shipped in this system's own packs and silently never
  // applied - see docs/ACTIVE_EFFECTS_UI_PLAN.md §1.
  test.each([
    ['systen.skills.might.shiftUp', 'system.skills.might.shiftUp'],
    ['system.skills.intimidation.essence.social', 'system.skills.intimidation.essences.social'],
    ['system.skills.infilitration.shiftUp', 'system.skills.infiltration.shiftUp'],
    ['system.skills.alertness.shfitUp', 'system.skills.alertness.shiftUp'],
  ])('suggests the right key for %s', (typo, expected) => {
    expect(suggestKey(typo)).toBe(expected);
  });

  test('suggests nothing for something that is not a near miss', () => {
    expect(suggestKey('flags.essence20.somethingEntirelyDifferent')).toBeNull();
    expect(suggestKey('')).toBeNull();
  });
});

describe('effect catalog - reading and writing changes', () => {
  test('reads the v14 shape', () => {
    const effect = { system: { changes: [{ key: 'system.health.bonus', value: 1 }] } };
    expect(readChanges(effect)).toHaveLength(1);
  });

  test('reads the v13 shape the packs are still stored in', () => {
    const packEffect = { changes: [{ key: 'system.health.bonus', mode: 2, value: '1' }] };
    expect(readChanges(packEffect)).toHaveLength(1);
  });

  test('reads nothing safely', () => {
    expect(readChanges(null)).toEqual([]);
    expect(readChanges({})).toEqual([]);
    expect(readChanges({ system: {} })).toEqual([]);
  });

  test('writes to the v14 system.changes path', () => {
    // Unconditional now that system.json declares minimum 14 - there is no older generation to
    // write the flat path for. Reading still accepts both shapes, for the v13-shaped packs.
    const update = jest.fn();
    writeChanges({ update }, [{ key: 'system.health.bonus' }]);
    expect(changesPath()).toBe('system.changes');
    expect(update).toHaveBeenCalledWith({ 'system.changes': [{ key: 'system.health.bonus' }] });
  });

  test('appending keeps what the effect already had', () => {
    const update = jest.fn();
    const effect = {
      update,
      system: { changes: [{ key: 'system.health.bonus', value: 1 }] },
    };
    appendChanges(effect, [{ key: 'system.defenses.toughness.bonus', value: 2 }]);
    expect(update).toHaveBeenCalledWith({
      'system.changes': [
        { key: 'system.health.bonus', value: 1 },
        { key: 'system.defenses.toughness.bonus', value: 2 },
      ],
    });
  });
});

describe("effect catalog - Specializations", () => {
  // Specialization keys are the one shape the key index cannot enumerate: they are slugs of
  // names that only exist once an actor has them, so parseKey resolves them by pattern.
  test("resolves a specialization key by pattern", () => {
    expect(parseKey('system.skills.science.specializations.medicine.shiftUp')).toMatchObject({
      groupId: 'specializations',
      propertyId: 'shift',
      target: 'science',
      target2: 'medicine',
      variant: 'plus',
    });
  });

  test("resolves the snag half of a specialization edge/snag pair", () => {
    expect(parseKey('system.skills.science.specializations.medicine.snag')).toMatchObject({
      propertyId: 'edgeSnag', variant: 'minus', target2: 'medicine',
    });
  });

  test("rejects a specialization key whose skill is not real", () => {
    expect(parseKey('system.skills.nonsense.specializations.medicine.edge')).toBeNull();
  });

  test("accepts hyphenated and numbered slugs", () => {
    expect(parseKey('system.skills.science.specializations.medicine2.edge')).not.toBeNull();
    expect(parseKey('system.skills.science.specializations.deep-sea.edge')).not.toBeNull();
  });

  test("builds a specialization shift", () => {
    expect(buildChange({
      groupId: 'specializations', propertyId: 'shift', target: 'science',
      target2: 'medicine', value: 2,
    })).toMatchObject({ key: 'system.skills.science.specializations.medicine.shiftUp', value: 2 });
  });

  test("granting a specialization writes both its name and its granted flag", () => {
    const changes = buildChanges({
      groupId: 'specializations', propertyId: 'grant', target: 'science',
      target2: 'medicine', value: 'Medicine',
    });
    expect(changes).toEqual([
      {
        key: 'system.skills.science.specializations.medicine.name',
        type: 'override', value: 'Medicine', phase: 'initial',
      },
      {
        key: 'system.skills.science.specializations.medicine.granted',
        type: 'override', value: true, phase: 'initial',
      },
    ]);
  });

  test("a grant with no name builds nothing", () => {
    expect(buildChanges({
      groupId: 'specializations', propertyId: 'grant', target: 'science',
      target2: 'medicine', value: '   ',
    })).toEqual([]);
  });

  test("an ordinary property still builds exactly one change", () => {
    expect(buildChanges({
      groupId: 'skills', propertyId: 'shift', target: 'infiltration', value: 1,
    })).toHaveLength(1);
  });

  test("summarizes a specialization by turning its slug back into words", () => {
    const summary = summarize({
      key: 'system.skills.science.specializations.medicine.shiftUp', value: 1,
    });
    expect(summary).toContain('Medicine');
    expect(summary).toContain('E20.SkillScience');
  });

  test("humanizes a multi-word slug rather than printing camelCase at the reader", () => {
    const summary = summarize({
      key: 'system.skills.science.specializations.deepSeaBiology.shiftUp', value: 1,
    });
    expect(summary).toContain('Deep Sea Biology');
    expect(summary).not.toContain('deepSeaBiology');
  });

  test("summarizes a grant with the Specialization name, not a coerced number", () => {
    const [grant] = buildChanges({
      groupId: 'specializations', propertyId: 'grant', target: 'science',
      target2: 'deepSeaBiology', value: 'Deep Sea Biology',
    });
    const summary = summarize(grant);
    expect(summary).toContain('Deep Sea Biology');
    expect(summary).not.toContain(' 0');
  });

  test("specialization keys stay out of the enumerable key list", () => {
    expect(allKeys().some(key => key.includes('specializations'))).toBe(false);
  });

  test("the trained group now enumerates toxins and armor upgrades", () => {
    expect(isKnownKey('system.trained.toxins.standard')).toBe(true);
    expect(isKnownKey('system.trained.upgrades.armors.standard')).toBe(true);
  });
});

describe("effect catalog - keys added with their schema fields", () => {
  test("the per-turn action bonuses are known keys", () => {
    expect(isKnownKey('system.actions.standard.bonus')).toBe(true);
    expect(isKnownKey('system.actions.move.bonus')).toBe(true);
    expect(isKnownKey('system.actions.free.bonus')).toBe(true);
  });

  test("loadout hands is a known key", () => {
    expect(isKnownKey('system.loadout.handsMax')).toBe(true);
  });

  // Granting a Specialization writes .name AND .granted; the catalog has to recognise the
  // companion key it writes itself, or every granted Specialization fails validation.
  test("a Specialization grant's companion .granted key is recognised", () => {
    expect(isKnownKey('system.skills.deception.specializations.bluffing.granted')).toBe(true);
  });
});
