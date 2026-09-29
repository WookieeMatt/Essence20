import { MLP1, mlp1ApplyDialog, mlp1RollSources, mlp1SpellCost, mlp1Toggles, shapeOf } from './mlp1.mjs';

const perk = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: 'Perk', type: extra.type ?? 'perk', system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
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

test('Mastery Power boosts its circle and tier', () => {
  const holder = actor([perk(MLP1.masteryPower, { flags: { mastery: { circle: 'beam', tier: 'elementary' } } })]);
  const spell = { type: 'spell', system: { circle: 'beam', tier: 'elementary' } };
  expect(mlp1RollSources(holder, null, { item: spell, rolledSkill: 'spellcasting' }).sources[0].shiftUp).toBe(1);
});

test('tools and Hang-Ups are dialog switches', async () => {
  const holder = actor([perk(MLP1.handAxe, { type: 'gear' }), perk(MLP1.hardHabit, { type: 'hangUp' })]);
  const names = mlp1Toggles(holder, { rolledSkill: 'persuasion' }).map(t => t.name);
  expect(names).toEqual(expect.arrayContaining(['handAxe', 'hardHabit']));
  const options = { shiftUp: 0, shiftDown: 0, ext: { handAxe: true, hardHabit: true } };
  await mlp1ApplyDialog(holder, options);
  expect(options).toMatchObject({ shiftUp: 1, shiftDown: 1 });
});

test('Sharpcaster\'s second roll is free', async () => {
  expect(await mlp1SpellCost({ parent: actor() }, 3, { sharpcasterFree: true })).toBe(0);
  expect(await mlp1SpellCost({ parent: actor() }, 3, {})).toBe(3);
});
