import { jest } from '@jest/globals';

// Round-10 plug-in points: register* in steps.mjs, predicate.mjs, formula.mjs and types.mjs (module/rules/ext/).

const { registerStep, registerRecipient, registerPickSource, runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');
const { registerTag, evaluateTag, contextFor, unknownTags } = await import('./predicate.mjs');
const { registerRef, resolveValue, formulaError } = await import('./formula.mjs');
const { registerEvent, registerRuleType, validateRule, TRIGGER_EVENTS } = await import('./types.mjs');

beforeEach(() => {
  global.game = { user: { targets: new Set() }, i18n: { localize: key => key } };
});

describe('plug-in points', () => {
  test('a registered step runs, validates and walks its branches', async () => {
    const seen = [];
    registerStep('zzPing', async (step, ctx) => {
      seen.push(step.text);
      return runSteps(step.then ?? [], ctx);
    }, { errors: (step, where) => (step.text ? [] : [`${where}: zzPing needs text`]), branches: ['then'] });
    const ctx = stepContext({ actor: { name: 'Hero' }, item: { name: 'Perk' }, targets: [] });
    await runSteps([{ do: 'zzPing', text: 'a', then: [{ do: 'zzPing', text: 'b' }] }], ctx);
    expect(seen).toEqual(['a', 'b']);
    expect(stepErrors([{ do: 'zzPing' }])).toEqual(['steps[0]: zzPing needs text']);
    expect(stepErrors([{ do: 'zzPing', text: 'a', then: [{ do: 'nope' }] }])).toHaveLength(1);
  });

  test('recipients and pick sources', () => {
    const other = { name: 'Rex' };
    registerRecipient(/^zzNamed:(\w+)$/, match => (match[1] == 'rex' ? [other] : []));
    registerRecipient('zzNobody', () => []);
    const ctx = stepContext({ actor: { name: 'Hero' }, item: {}, targets: [] });
    expect(recipients({ to: 'zzNamed:rex' }, ctx)).toEqual([other]);
    expect(recipients({ to: 'zzNobody' }, ctx)).toEqual([]);
    expect(stepErrors([{ do: 'heal', to: 'zzNamed:rex' }, { do: 'heal', to: 'zzNobody' }])).toEqual([]);
    registerPickSource('zzColours', () => [{ value: 'red', label: 'Red' }]);
    expect(stepErrors([{ do: 'pick', key: 'c', from: 'zzColours' }])).toEqual([]);
  });

  test('tags: a new family and a sub-tag of an existing one', () => {
    registerTag('zzFamily', rest => rest == 'yes', { family: 'situation', param: 'text' });
    registerTag('item:zzShiny', (rest, ctx) => !!ctx.item?.shiny);
    const ctx = contextFor({ item: { shiny: true } });
    expect(evaluateTag('zzFamily:yes', ctx)).toBe(true);
    expect(evaluateTag('zzFamily:no', ctx)).toBe(false);
    expect(evaluateTag('item:zzShiny', ctx)).toBe(true);
    expect(unknownTags(['zzFamily:yes', 'item:zzShiny'])).toEqual([]);
  });

  test('refs, events and rule types', () => {
    registerRef('zzSeven', key => (key == 'double' ? 14 : 7));
    expect(resolveValue('@zzSeven + @zzSeven.double', {})).toBe(21);
    expect(formulaError('@zzSeven.x')).toBeNull();
    registerEvent('zzBoom');
    expect(TRIGGER_EVENTS).toContain('zzBoom');
    expect(validateRule({ type: 'Trigger', event: 'zzBoom', steps: [] })).toEqual([]);
    registerRuleType('ZzThing', { params: { amount: { kind: 'formula', required: true } }, scopes: ['self'] });
    expect(validateRule({ type: 'ZzThing', amount: 2 })).toEqual([]);
    expect(validateRule({ type: 'ZzThing' })).toEqual(['amount is required']);
    expect(jest).toBeDefined();
  });
});
