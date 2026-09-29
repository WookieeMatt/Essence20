import { MLP2, mlp2ApplyDialog, mlp2RollSources, mlp2Toggles, somethingIsOffDefense } from './mlp2.mjs';

const perk = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Perk', type: extra.type ?? 'perk', flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({ uuid: 'Actor.a', name: 'A', system: {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items } });

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [] };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', deception: 'social', alertness: 'smarts', acrobatics: 'speed' }, skills: {} } };
});

test('Spell Focus gives Edge on the focused spell only', () => {
  const holder = actor([perk(MLP2.spellFocus, { flags: { spellFocus: ['s1'] } })]);
  expect(mlp2RollSources(holder, null, { item: { id: 's1', type: 'spell' } }).sources[0].edge).toBe(true);
  expect(mlp2RollSources(holder, null, { item: { id: 's2', type: 'spell' } }).sources).toEqual([]);
});

test('Fool Me Twice ↓1 against a creature already deceived', () => {
  const holder = actor([perk(MLP2.foolMeTwice)], { flags: { deceived: ['Actor.t'], deceivedScene: 1 } });
  expect(mlp2RollSources(holder, { uuid: 'Actor.t' }, { rolledSkill: 'deception' }).sources[0].shiftDown).toBe(1);
  expect(mlp2RollSources(holder, { uuid: 'Actor.u' }, { rolledSkill: 'deception' }).sources).toEqual([]);
});

test('Social toggles and what they do', async () => {
  const holder = actor([perk(MLP2.badWithPeople), perk(MLP2.jarring), perk(MLP2.traveler, { flags: { place: 'Yakyakistan' } }), perk(MLP2.acuteSense)]);
  const names = mlp2Toggles(holder, { rolledSkill: 'persuasion' }).map(t => t.name);
  expect(names).toEqual(expect.arrayContaining(['badWithPeople', 'jarring', 'traveler', 'acuteSense']));
  const options = { shiftUp: 0, shiftDown: 0, edge: true, ext: { badWithPeople: true, jarring: true, traveler: true } };
  await mlp2ApplyDialog(holder, options);
  expect(options).toMatchObject({ shiftUp: 1, shiftDown: 1, edge: false });
});

test('Acute Sense is not offered on Alertness', () => {
  const holder = actor([perk(MLP2.acuteSense)]);
  expect(mlp2Toggles(holder, { rolledSkill: 'alertness' }).map(t => t.name)).not.toContain('acuteSense');
});

test('Something Is Off stacks to 4 on Cleverness', () => {
  const holder = actor([1, 2, 3, 4, 5].map(i => perk(MLP2.somethingIsOff, { id: `s${i}` })));
  expect(somethingIsOffDefense(null, holder, 'cleverness')).toBe(4);
  expect(somethingIsOffDefense(null, holder, 'toughness')).toBe(0);
});
