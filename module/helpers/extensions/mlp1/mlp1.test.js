import { mlp1RollSources, shapeOf } from './mlp1.mjs';

const actor = (items = [], extra = {}) => ({ uuid: 'Actor.a', name: 'A', system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items }, getActiveTokens: () => [] });

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], settings: { get: () => 1 } };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', alertness: 'smarts' }, skills: {} } };
});

test('a changed shape gives Face-Shift and Master Morph their Skills', () => {
  const holder = actor([], { flags: { mlpShape: { scene: 1, faceSkill: 'persuasion', morphSkill: 'alertness', spell: true } } });
  expect(shapeOf(holder)).toBeTruthy();
  expect(mlp1RollSources(holder, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ id: 'masterMorph', shiftUp: 2 });
});
