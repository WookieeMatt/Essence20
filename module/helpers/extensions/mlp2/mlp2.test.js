import { CONNING_TOGGLE, MLP2, mlp2Toggles, somethingIsOffDefense } from './mlp2.mjs';

const perk = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Perk', type: extra.type ?? 'perk', flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({ uuid: 'Actor.a', name: 'A', system: {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items } });

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [] };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', deception: 'social', alertness: 'smarts', acrobatics: 'speed' }, skills: {} } };
});

test('Something Is Off stacks to 4 on Cleverness, only when the roller says it is a con', () => {
  const holder = actor([1, 2, 3, 4, 5].map(i => perk(MLP2.somethingIsOff, { id: `s${i}` })));
  const conning = { ext: { [CONNING_TOGGLE]: true } };
  expect(somethingIsOffDefense(null, holder, 'cleverness', conning)).toBe(4);
  expect(somethingIsOffDefense(null, holder, 'toughness', conning)).toBe(0);
  // A simple lie (switch left off), or a caller that passes no dialog choices.
  expect(somethingIsOffDefense(null, holder, 'cleverness', { ext: {} })).toBe(0);
  expect(somethingIsOffDefense(null, holder, 'cleverness')).toBe(0);
});

test('the conning switch is offered on Social tests against a target with Something Is Off', () => {
  const mark = actor([perk(MLP2.somethingIsOff, { name: 'Something Is Off' })]);
  const roller = actor();
  expect(mlp2Toggles(roller, { rolledSkill: 'persuasion' }).map(t => t.name)).not.toContain(CONNING_TOGGLE);
  game.user.targets = new Set([{ actor: mark }]);
  expect(mlp2Toggles(roller, { rolledSkill: 'deception' }).map(t => t.name)).toContain(CONNING_TOGGLE);
  expect(mlp2Toggles(roller, { rolledSkill: 'acrobatics' }).map(t => t.name)).not.toContain(CONNING_TOGGLE);
  game.user.targets = new Set([{ actor: actor() }]);
  expect(mlp2Toggles(roller, { rolledSkill: 'persuasion' }).map(t => t.name)).not.toContain(CONNING_TOGGLE);
});
