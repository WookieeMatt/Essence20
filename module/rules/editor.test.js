import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMON_FIELDS, RULE_FORMS, STEP_FORMS, formFor, stepChoices } from './editor-spec.mjs';
import { applyEdit, composeTag, fieldLabel, fieldsHtml, optionList, prerequisitesFormHtml, previewLine, readInput, ruleFormHtml, tagDatalists, tidy } from './editor-render.mjs';
import { RULE_TYPES } from './types.mjs';
import { STEP_TYPES } from './steps.mjs';
import { SKELETONS } from './sheet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

beforeAll(() => {
  global.CONFIG = {
    E20: {
      skills: { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight' },
      essences: { any: 'x', social: 'E20.EssenceSocial' },
      defenses: { toughness: 'E20.DefenseToughness' },
      damageTypes: { blunt: 'E20.DamageBlunt' },
      rerollModes: { all: 'E20.RerollModeAll' },
    },
    statusEffects: [{ id: 'prone', name: 'Prone' }],
  };
  global.game = { i18n: { localize: key => key } };
});

describe('the form covers the catalogue', () => {
  test('every rule type has a form, and every form field is a real setting', () => {
    for (const [type, definition] of Object.entries(RULE_TYPES)) {
      expect(RULE_FORMS[type]).toBeDefined();
      const settings = new Set([...Object.keys(definition.params), 'cost', 'limit']);
      for (const field of RULE_FORMS[type]) {
        expect(settings.has(field.path.split('.')[0])).toBe(true);
      }
    }

    expect(formFor('Nope')).toEqual([]);
    expect(formFor('Toggle').slice(-COMMON_FIELDS.length)).toEqual(COMMON_FIELDS);
  });

  test('every step has a form; damage steps only where damage is in play', () => {
    expect(Object.keys(STEP_FORMS).sort()).toEqual([...STEP_TYPES].sort());
    expect(stepChoices({ type: 'Use' })).not.toContain('negateDamage');
    expect(stepChoices({ type: 'Trigger', event: 'wouldBeDefeated' })).toContain('leaveAt');
  });

  test('every label has English text', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'lang', 'en.json'), 'utf8')).E20.Rules.Field;
    const get = key => key.split('.').reduce((o, k) => o?.[k], en);
    const labels = [...COMMON_FIELDS, ...Object.values(RULE_FORMS).flat(), ...Object.values(STEP_FORMS).flat()].map(field => field.label);
    for (const label of labels) {
      expect([label, typeof get(label)]).toEqual([label, 'string']);
    }
  });
});

describe('rendering', () => {
  test('a Use rule renders its cost, limit, steps and conditions', () => {
    const rule = { type: 'Use', label: 'Zap', when: ['skill:might', 'not:self:morphed', { any: ['combat', 'ownTurn'] }], cost: { action: 'free', resource: { pool: 'charge' }, amount: 1 },
      limit: { per: 'scene', max: 1 }, steps: [{ do: 'roll', skill: 'might', dif: 12, onSuccess: [{ do: 'heal', to: 'target', amount: 1 }] },
        { do: 'choose', options: [{ label: 'A', steps: [] }] }] };
    const html = ruleFormHtml(rule, { helpers: [] });
    expect(html).toContain('name="cost.action"');
    expect(html).toContain('<option value="free" selected>');
    expect(html).toContain('name="cost.resource" data-kind="resourceKey" value="charge"');
    expect(html).toContain('name="steps.0.onSuccess.0.amount"');
    expect(html).toContain('name="steps.1.options.0.label"');
    expect(html).toContain('data-edit="addStep" data-path="steps.0.onFail"');
    expect(html).toContain('name="when.1" data-kind="tagNot" checked');
    expect(html).toContain('value="combat | ownTurn"');
    expect(html).toContain('<datalist id="e20-tag-args-self">');
    expect(html).toContain('data-field="limit.max"');
  });

  test('fields hide when they don\'t apply, and custom values survive', () => {
    expect(fieldsHtml(RULE_FORMS.Use, { type: 'Use', steps: [] }, '', { type: 'Use' })).not.toContain('data-field="limit.max"');
    const html = fieldsHtml(RULE_FORMS.DerivedStat, { path: 'system.custom.thing' }, '', { type: 'DerivedStat' });
    expect(html).toContain('<option value="system.custom.thing" selected>');
    expect(fieldsHtml(RULE_FORMS.Code, { helper: 'x' }, '', { type: 'Code' }, { helpers: ['x'] })).toContain('<option value="x" selected>x</option>');
    expect(fieldsHtml([{ path: 'a', kind: 'mystery', label: 'A' }], {}, '', {})).toContain('data-field="a"');
  });

  test('options and labels', () => {
    expect(optionList('skills')).toEqual([['athletics', 'E20.SkillAthletics'], ['might', 'E20.SkillMight']]);
    expect(optionList('essences')).toEqual([['social', 'E20.EssenceSocial']]);
    expect(optionList('statuses')).toEqual([['prone', 'Prone']]);
    expect(optionList('scopes', { rule: { type: 'RollModifier' } }).map(o => o[0])).toEqual(['self', 'incoming', 'host', 'crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura']);
    expect(optionList('nothing')).toEqual([]);
    expect(fieldLabel('OnSuccess')).toBe('On Success');
    expect(tagDatalists()).toContain('status:prone');
  });
});

describe('reading it back', () => {
  test('each kind writes the right type, and clearing removes the setting', () => {
    const rule = { type: 'Use', steps: [] };
    readInput(rule, 'label', 'text', 'Zap');
    readInput(rule, 'cost.amount', 'formula', '2');
    readInput(rule, 'limit.max', 'formula', '@level');
    readInput(rule, 'priority', 'number', '3');
    readInput(rule, 'disabled', 'checkbox', true);
    readInput(rule, 'stacks', 'stacks', 'false');
    readInput(rule, 'skills', 'skills', 'might, athletics,');
    expect(rule).toMatchObject({ label: 'Zap', cost: { amount: 2 }, limit: { max: '@level' }, priority: 3, disabled: true, stacks: false, skills: ['might', 'athletics'] });
    readInput(rule, 'disabled', 'checkbox', false);
    readInput(rule, 'label', 'text', '');
    readInput(rule, 'stacks', 'stacks', '');
    readInput(rule, 'skills', 'skills', '');
    readInput(rule, 'priority', 'number', '');
    expect(rule.disabled).toBeUndefined();
    expect(rule.label).toBeUndefined();
    expect('stacks' in rule).toBe(false);
  });

  test('resources, tags and step kinds', () => {
    const rule = { type: 'Use', steps: [{ do: 'heal', to: 'target', amount: 2 }] };
    readInput(rule, 'cost.resource', 'resourceKind', 'pool');
    readInput(rule, 'cost.resource', 'resourceKey', 'charge');
    expect(rule.cost.resource).toEqual({ pool: 'charge' });
    readInput(rule, 'cost.resource', 'resourceKind', 'storyPoints');
    expect(rule.cost.resource).toEqual({ storyPoints: true });
    readInput(rule, 'cost.resource', 'resourceKind', 'path');
    readInput(rule, 'cost.resource', 'resourceKey', 'system.energon.value');
    expect(rule.cost.resource).toEqual({ path: 'system.energon.value' });
    readInput(rule, 'cost.resource', 'resourceKind', '');
    expect(rule.cost.resource).toBeUndefined();

    readInput(rule, 'when.0', 'tagFamily', 'self', { not: true, family: 'self', arg: 'morphed' });
    expect(rule.when).toEqual(['not:self:morphed']);
    expect(composeTag(false, 'combat', '')).toBe('combat');
    expect(composeTag(false, 'any', 'skill:might | combat')).toEqual({ any: ['skill:might', 'combat'] });

    readInput(rule, 'steps.0.do', 'stepType', 'damage');
    expect(rule.steps[0]).toEqual({ do: 'damage', to: 'target', amount: 2 });
    readInput(rule, 'steps.0.do', 'stepType', 'chat');
    expect(rule.steps[0]).toEqual({ do: 'chat' });
  });

  test('structural edits: add, remove, move', () => {
    const rule = { type: 'Use', steps: [] };
    applyEdit(rule, 'addStep', 'steps');
    applyEdit(rule, 'addStep', 'steps');
    rule.steps[1].text = 'second';
    applyEdit(rule, 'up', 'steps', 1);
    expect(rule.steps[0].text).toBe('second');
    applyEdit(rule, 'down', 'steps', 0);
    expect(rule.steps[1].text).toBe('second');
    applyEdit(rule, 'up', 'steps', 0);
    applyEdit(rule, 'down', 'steps', 1);
    applyEdit(rule, 'remove', 'steps', 0);
    expect(rule.steps).toHaveLength(1);
    applyEdit(rule, 'addTag', 'when');
    expect(rule.when).toEqual(['skill:athletics']);
    applyEdit(rule, 'remove', 'when', 0);
    expect(rule.when).toEqual([]);
    applyEdit(rule, 'addChoice', 'steps.0.options');
    expect(rule.steps[0].options).toEqual([{ label: '', steps: [] }]);
    applyEdit(rule, 'remove', 'steps.0.options', 0);
    expect(rule.steps[0].options).toBeUndefined();
    applyEdit(rule, 'addStep', 'steps.0.onFail');
    expect(rule.steps[0].onFail).toHaveLength(1);
  });

  test('tidy drops empties; the preview is the rule\'s summary', () => {
    expect(tidy({ a: undefined, b: {}, c: { d: {} }, e: [undefined, { f: 1 }], g: 0 })).toEqual({ e: [{ f: 1 }], g: 0 });
    expect(previewLine({ type: 'RollModifier', upshift: 1, when: ['skill:might'], cost: {} })).toBe('↑1 on might tests');
  });

  test('every Add starting rule renders', () => {
    for (const skeleton of Object.values(SKELETONS)) {
      expect(ruleFormHtml(skeleton)).toContain('data-kind="ruleType"');
    }
  });
});

describe('the level requirement row', () => {
  test('self:level>=N shows as a level row and writes back as self:level', () => {
    expect(composeTag(false, 'level', '5')).toBe('self:level>=5');
    expect(composeTag(false, 'level', '<=4')).toBe('self:level<=4');
    expect(composeTag(true, 'level', '')).toBe('not:self:level>=1');
    const html = fieldsHtml([{ path: 'when', kind: 'tags', label: 'PrereqWhen' }], { when: ['self:level>=12', 'self:level<=4'] }, '', {});
    expect(html).toMatch(/<option value="level" selected>/);
    expect(html).toContain('value="12"');
    expect(html).toContain('value="&lt;=4"');
    expect(tagDatalists()).toContain('id="e20-tag-args-level"');
  });

  test('the prerequisites form has an Add level button that adds self:level>=1', () => {
    expect(prerequisitesFormHtml({ when: [] })).toContain('data-edit="addLevelTag"');
    const rule = { when: [] };
    applyEdit(rule, 'addLevelTag', 'when');
    expect(rule.when).toEqual(['self:level>=1']);
    readInput(rule, 'when.0', 'tagArg', '7', { not: false, family: 'level', arg: '7' });
    expect(rule.when).toEqual(['self:level>=7']);
  });
});
