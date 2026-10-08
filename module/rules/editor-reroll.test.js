import { RULE_FORMS } from './editor-spec.mjs';
import { fieldsHtml, readInput, ruleFormHtml, tidy } from './editor-render.mjs';
import { RULE_TYPES, validateRule } from './types.mjs';

beforeAll(() => {
  global.CONFIG = {
    E20: {
      skills: { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight' },
      essences: { any: 'x', social: 'E20.EssenceSocial', strength: 'E20.EssenceStrength' },
      rerollModes: { all: 'E20.RerollModeAll', ones: 'E20.RerollModeOnes' },
      rerollTargets: { allDice: 'E20.RerollTargetAllDice', skillDice: 'E20.RerollTargetSkillDice' },
      rerollResets: { none: 'E20.RerollResetNone', scene: 'E20.RerollResetScene' },
      rerollConditions: { none: 'E20.RerollConditionNone', morphed: 'E20.RerollConditionMorphed', fumble: 'E20.RerollConditionFumble' },
    },
    statusEffects: [],
  };
  global.game = { i18n: { localize: key => key } };
});

/** A Reroll rule using every setting the type takes. */
const FULL = {
  type: 'Reroll', mode: 'ones', target: 'skillDice', values: ['1', '2'], upTo: '@level', condition: 'morphed', reset: 'scene', maxUses: 2,
  skills: ['might'], essence: 'strength', scopeToOriginSkill: true, minDieFaces: 4, recursive: false, keepBetter: true, bonus: 2, shiftUp: 1,
  grantsCanCritD2: true, cost: { worldStoryPoints: 1, rolePointsName: 'Cheer', resourcePath: 'system.energon.value', amount: 1 },
};

/** Every input's [name, kind, value] as the editor would read it back from the rendered form. */
function inputs(html) {
  const out = [];
  for (const match of html.matchAll(/<input type="(\w+)" name="([^"]+)" data-kind="(\w+)"( value="([^"]*)")?([^>]*)>/g)) {
    const [, type, name, kind, , value, rest] = match;
    out.push([name, kind, type == 'checkbox' ? / checked/.test(rest) : value.replace(/&#39;/g, "'")]);
  }

  for (const match of html.matchAll(/<select name="([^"]+)" data-kind="(\w+)">(.*?)<\/select>/gs)) {
    const selected = /<option value="([^"]*)" selected>/.exec(match[3]);
    out.push([match[1], match[2], selected ? selected[1] : '']);
  }

  return out;
}

describe('the Reroll form', () => {
  test('offers every setting the Reroll rule takes', () => {
    const paths = new Set(RULE_FORMS.Reroll.map(field => field.path.split('.')[0]));
    for (const param of Object.keys(RULE_TYPES.Reroll.params)) {
      expect([param, paths.has(param)]).toEqual([param, true]);
    }

    for (const cost of ['cost.resourcePath', 'cost.amount', 'cost.worldStoryPoints', 'cost.rolePointsName']) {
      expect(RULE_FORMS.Reroll.map(field => field.path)).toContain(cost);
    }
  });

  test('renders every field, with its value', () => {
    const html = ruleFormHtml(FULL);
    for (const field of RULE_FORMS.Reroll) {
      expect(html).toContain(`data-field="${field.path}"`);
    }

    expect(html).toContain('<option value="morphed" selected>E20.RerollConditionMorphed</option>');
    expect(html).toContain('<option value="strength" selected>E20.EssenceStrength</option>');
    expect(html).toMatch(/name="recursive" data-kind="stacks"><option value=""><\/option><option value="true">[^<]*<\/option><option value="false" selected>/);
    expect(html).toContain('name="cost.worldStoryPoints" data-kind="number" value="1"');
    expect(html).toContain('name="cost.rolePointsName" data-kind="text" value="Cheer"');
    expect(html).toContain('name="grantsCanCritD2" data-kind="checkbox" checked');
    expect(html).toContain('name="values" data-kind="strings" value="1, 2"');
    expect(html).toContain('name="minDieFaces" data-kind="number" value="4"');
  });

  test('a render then read back keeps every value', () => {
    const html = fieldsHtml(RULE_FORMS.Reroll, FULL, '', FULL);
    const rule = { type: 'Reroll' };
    for (const [name, kind, value] of inputs(html)) {
      readInput(rule, name, kind, value);
    }

    expect(tidy(rule)).toEqual(FULL);
    expect(validateRule(tidy(rule))).toEqual([]);
  });

  test('recursive can be turned off, on, or left to the default', () => {
    const rule = { type: 'Reroll' };
    readInput(rule, 'recursive', 'stacks', 'false');
    expect(rule.recursive).toBe(false);
    readInput(rule, 'recursive', 'stacks', 'true');
    expect(rule.recursive).toBe(true);
    readInput(rule, 'recursive', 'stacks', '');
    expect('recursive' in rule).toBe(false);
  });

  test('an empty Reroll rule still renders, with no condition picked', () => {
    const html = ruleFormHtml({ type: 'Reroll' });
    expect(html).toContain('data-field="condition"');
    expect(html).toContain('<option value="none">E20.RerollConditionNone</option>');
  });
});

describe('the Movement form', () => {
  test('offers the bonus stage', () => {
    const stage = RULE_FORMS.Movement.find(field => field.path == 'stage');
    expect(stage.options.map(([value]) => value)).toContain('bonus');
    expect(stage.options.map(([value]) => value).every(value => RULE_TYPES.Movement.params.stage.options.includes(value))).toBe(true);
    const html = fieldsHtml(RULE_FORMS.Movement, { stage: 'bonus' }, '', { type: 'Movement' });
    expect(html).toContain('<option value="bonus" selected>');
  });
});
