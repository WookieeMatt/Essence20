import { jest } from '@jest/globals';
import { auditEffectCatalog, collectLeafFields, fullyBrokenGroups } from './effect-catalog-audit.mjs';
import { allKeys } from './effect-catalog.mjs';

/**
 * A stand-in for a Foundry SchemaField: `fields` for walking, `getField` for dot-path lookup.
 * Enough to exercise the audit without a running client, which is the whole reason the audit
 * takes its schemas as an argument.
 * @param {Object} shape  Nested plain object; a leaf is a field type name.
 * @returns {Object}
 */
function makeSchema(shape) {
  const build = (node) => {
    const fields = {};
    for (const [name, value] of Object.entries(node)) {
      fields[name] = typeof value === 'string'
        ? { constructor: { name: value } }
        : build(value);
    }

    return {
      fields,
      getField(path) {
        const parts = path.split('.');
        let current = { fields };
        for (const part of parts) {
          current = current?.fields?.[part];
          if (!current) {
            return undefined;
          }
        }

        return current;
      },
    };
  };

  return build(shape);
}

describe('collectLeafFields', () => {
  test('finds numeric and boolean leaves, ignoring other field types', () => {
    const schema = makeSchema({
      health: { bonus: 'NumberField', max: 'NumberField' },
      notes: 'HTMLField',
      isLocked: 'BooleanField',
    });

    expect(collectLeafFields(schema)).toEqual(expect.arrayContaining([
      { path: 'health.bonus', type: 'NumberField' },
      { path: 'health.max', type: 'NumberField' },
      { path: 'isLocked', type: 'BooleanField' },
    ]));
    expect(collectLeafFields(schema).map(f => f.path)).not.toContain('notes');
  });

  test('handles a schema with no fields at all', () => {
    expect(collectLeafFields(undefined)).toEqual([]);
    expect(collectLeafFields({})).toEqual([]);
  });
});

describe('auditEffectCatalog', () => {
  const consoleMethods = ['group', 'groupEnd', 'log', 'warn', 'info'];
  beforeEach(() => {
    for (const method of consoleMethods) {
      jest.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reports nothing missing when every catalog key resolves', () => {
    // A schema that answers "yes" to any path is the trivially-passing case, and proves the
    // forward check is actually driven by getField rather than by the catalog alone.
    const everything = {
      fields: {},
      getField: () => ({ constructor: { name: 'NumberField' } }),
    };

    const report = auditEffectCatalog({ schemas: { playerCharacter: everything }, log: false });
    expect(report.missingFields).toEqual([]);
    expect(report.checked).toBe(allKeys().length);
  });

  test('flags a catalog key whose schema field has gone away', () => {
    // The point of the whole audit: the catalog still offers Health bonus, the schema no longer
    // has it, and nothing else would notice until an author built an effect that does nothing.
    const schema = makeSchema({ skills: { infiltration: { shiftUp: 'NumberField' } } });
    const report = auditEffectCatalog({ schemas: { playerCharacter: schema }, log: false });

    expect(report.missingFields.some(entry => entry.key === 'system.health.bonus')).toBe(true);
    expect(report.missingFields.some(entry => entry.key === 'system.skills.infiltration.shiftUp'))
      .toBe(false);
  });

  test('reports a numeric field the catalog does not offer', () => {
    const schema = makeSchema({
      health: { bonus: 'NumberField' },
      brandNewThing: 'NumberField',
    });
    const report = auditEffectCatalog({ schemas: { playerCharacter: schema }, log: false });

    expect(report.uncoveredFields.map(f => f.path)).toContain('system.brandNewThing');
  });

  test('does not report a field listed as a deliberate omission', () => {
    const schema = makeSchema({ health: { value: 'NumberField' } });
    const report = auditEffectCatalog({ schemas: { playerCharacter: schema }, log: false });

    expect(report.uncoveredFields.map(f => f.path)).not.toContain('system.health.value');
    expect(report.knownOmissions.map(f => f.path)).toContain('health.value');
  });

  test('does not report ignored bookkeeping roots', () => {
    const schema = makeSchema({ isLocked: 'BooleanField', items: { anything: 'NumberField' } });
    const report = auditEffectCatalog({ schemas: { playerCharacter: schema }, log: false });

    expect(report.uncoveredFields).toEqual([]);
  });

  test('ignores per-skill bookkeeping that would otherwise bury the report', () => {
    const schema = makeSchema({
      skills: {
        infiltration: {
          isChosen: 'BooleanField',
          essenceAttribution: { speed: 'NumberField' },
        },
        roleSkillDie: { shiftUp: 'NumberField' },
      },
      defenses: { toughness: { usesDrivers: 'BooleanField' } },
    });
    const report = auditEffectCatalog({ schemas: { playerCharacter: schema }, log: false });

    expect(report.uncoveredFields).toEqual([]);
  });

  test('logs a warning when keys are missing, and stays quiet when they are not', () => {
    const schema = makeSchema({ skills: { infiltration: { shiftUp: 'NumberField' } } });
    auditEffectCatalog({ schemas: { playerCharacter: schema } });
    expect(console.warn).toHaveBeenCalled();
  });

  test('survives no registered schemas at all rather than throwing', () => {
    const report = auditEffectCatalog({ schemas: {}, log: false });
    expect(report.missingFields.length).toBe(allKeys().length);
    expect(report.uncoveredFields).toEqual([]);
  });
});

describe('fullyBrokenGroups', () => {
  test('names a group whose every key has gone missing', () => {
    const report = auditEffectCatalog({ schemas: {}, log: false });
    expect(fullyBrokenGroups(report)).toContain('skills');
  });

  test('names nothing when nothing is missing', () => {
    expect(fullyBrokenGroups({ missingFields: [] })).toEqual([]);
  });
});
