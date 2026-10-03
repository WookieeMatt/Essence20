import { jest } from '@jest/globals';
import { isDogOrCoyote, staggeringSwayHit, WTNV, wtnvApplyDialog, wtnvRollSources, wtnvSpecializes, wtnvToggles } from './wtnv.mjs';

const perk = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Perk', flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({ uuid: extra.uuid ?? 'Actor.a', name: 'A', system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items } });

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [] };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', alertness: 'smarts', might: 'strength', animalHandling: 'social' }, skills: {} } };
});

test('Obsessive gives ↓1 to other Skills', () => {
  const holder = actor([perk(WTNV.obsessive, { flags: { obsession: 'science' } })]);
  expect(wtnvRollSources(holder, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ id: 'obsessive', shiftDown: 1 });
  expect(wtnvRollSources(holder, null, { rolledSkill: 'science' }).sources).toEqual([]);
});

test('Dog Person with a dog targeted', () => {
  const holder = actor([perk(WTNV.dogPerson)]);
  const dog = { name: 'Feral Dog', system: {} };
  expect(isDogOrCoyote(dog)).toBe(true);
  expect(wtnvRollSources(holder, dog, { rolledSkill: 'persuasion' }).sources[0].shiftUp).toBe(1);
  global.game.user.targets = { first: () => ({ actor: dog }) };
  expect(wtnvSpecializes(holder, 'animalHandling')).toBe(true);
});

test('dialog toggles and what they do', async () => {
  const holder = actor([perk(WTNV.dogPerson), perk(WTNV.thirdEye)]);
  const names = wtnvToggles(holder, { rolledSkill: 'persuasion' }).map(t => t.name);
  expect(names).toEqual(expect.arrayContaining(['dogPerson', 'thirdEye']));
  const options = { shiftUp: 0, shiftDown: 1, ext: { dogPerson: true, thirdEye: true } };
  await wtnvApplyDialog(holder, options, { rolledSkill: 'persuasion' });
  expect(options).toMatchObject({ shiftUp: 1, shiftDown: 0 });
});

test('More Than Worldly Edge is a consumed source', () => {
  const ally = actor([], { flags: { moreThanWorldlyEdge: { label: 'More Than Worldly' } } });
  const out = wtnvRollSources(ally, null, { rolledSkill: 'might' });
  expect(out.sources[0].edge).toBe(true);
  expect(out.consumes[0].ext).toBe('moreThanWorldly');
});

test('Staggering Sway adds 1 Stun for an ally', async () => {
  const holder = actor([perk(WTNV.staggeringSway)], { uuid: 'Actor.h' });
  global.game.actors = [holder];
  const attacker = actor([], { uuid: 'Actor.x' });
  const damageBonusNote = jest.fn();
  await staggeringSwayHit(attacker, {}, { damageValue: 1 }, { damageType: 'stun' }, { damageBonusNote });
  expect(damageBonusNote).toHaveBeenCalled();
});
