import { jest } from '@jest/globals';

// Commander (Enigma of Combination): the per-Essence Skill picks its Use button stores.
let commander;
let ext;
const wait = jest.fn();

beforeAll(async () => {
  global.game = { i18n: { localize: k => k, format: k => k } };
  global.CONFIG = { E20: {
    skills: {},
    skillsByEssence: { strength: ['athletics', 'brawn'], speed: ['driving', 'targeting'], smarts: ['alertness'], social: ['persuasion'] },
  } };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, applications: { api: { DialogV2: { wait } } } };
  ext = await import('../../mechanics/item-hooks.mjs');
  commander = await import('./commander-combiner-feature.mjs');
});

const feature = () => ({
  name: 'Commander', type: 'megaformTrait', system: { type: 'commander' }, flags: {}, parent: { name: 'Hot Spot' },
  setFlag: jest.fn(async function (scope, key, value) {
    this.flags[scope] = { ...this.flags[scope], [key]: value };
  }),
});

test('the Use button claims Commander features only', () => {
  const use = ext.registrySnapshot().uses.find(u => u.id == 'r2Commander');
  expect(use.matches(feature())).toBe(true);
  expect(use.matches({ type: 'megaformTrait', system: { type: 'coreAbility' } })).toBe(false);
});

test('cleanCommanderSkills keeps only Skills of their own Essence', () => {
  expect(commander.cleanCommanderSkills({ strength: 'brawn', speed: 'brawn', smarts: '', bogus: 'x' })).toEqual({ strength: 'brawn' });
});

test('the picks are stored on the feature', async () => {
  const item = feature();
  wait.mockResolvedValueOnce({ strength: 'brawn', speed: 'targeting', smarts: 'alertness', social: 'persuasion' });
  expect(await commander.pickCommanderSkills(item)).toBe('E20.R2CommanderPicked');
  expect(item.flags.essence20.commanderSkills).toEqual({ strength: 'brawn', speed: 'targeting', smarts: 'alertness', social: 'persuasion' });
});

test('cancelling stores nothing', async () => {
  const item = feature();
  wait.mockResolvedValueOnce('cancel');
  expect(await commander.pickCommanderSkills(item)).toBeNull();
  expect(item.setFlag).not.toHaveBeenCalled();
});
