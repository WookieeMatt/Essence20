import { MLP1, mlp1RollSources, mlp1SpellCost, shapeOf } from './mlp1.mjs';

const actor = (items = [], extra = {}) => ({ uuid: 'Actor.a', name: 'A', system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items }, getActiveTokens: () => [] });

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], settings: { get: () => 1 } };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', alertness: 'smarts' }, skills: {} } };
});

test('a changed shape gives Face-Shift and Master Morph their Skills', () => {
  const holder = actor([], { flags: { mlpShape: { scene: 1, faceSkill: 'persuasion', morphSkill: 'alertness', spell: true } } });
  expect(shapeOf(holder)).toBeTruthy();
  expect(mlp1RollSources(holder, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ id: 'masterMorph', shiftUp: 2 });
  expect(mlp1RollSources(holder, null, { rolledSkill: 'deception' }).sources[0]).toMatchObject({ id: 'basicShapeShifting', edge: true });
});

test('a Ponymorph shape labels its Edge Ponymorph, not Basic Shape-Shifting', () => {
  const holder = actor([], { flags: { mlpShape: { scene: 1, spell: MLP1.ponymorph } } });
  expect(mlp1RollSources(holder, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ id: 'basicShapeShifting', label: 'Ponymorph', edge: true });
  const basic = actor([], { flags: { mlpShape: { scene: 1, spell: MLP1.basicShapeShifting } } });
  expect(mlp1RollSources(basic, null, { rolledSkill: 'deception' }).sources[0].label).toBe('Basic Shape-Shifting');
});

test('Sharpcaster\'s second roll is free', async () => {
  expect(await mlp1SpellCost({ parent: actor() }, 3, { sharpcasterFree: true })).toBe(0);
  expect(await mlp1SpellCost({ parent: actor() }, 3, {})).toBe(3);
});
