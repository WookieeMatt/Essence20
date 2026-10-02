import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { applyRuleSwitches, ruleDialogSwitches, ruleRollSources } from './adapter.mjs';

/**
 * Items converted from hand-written code to item rules (docs/RULES_ENGINE_PLAN.md §10). Each test
 * loads the item straight from its pack source, so it checks the shipped data, and asserts what the
 * removed code's own test asserted.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

/** An actor holding these pack items. */
function holder(files, { system = {}, statuses = [] } = {}) {
  const items = files.map(file => {
    const doc = fromPack(file);
    return { id: `c${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: doc.system };
  });
  const actor = { id: `a${nextId++}`, type: 'playerCharacter', statuses: new Set(statuses), system: { level: 1, ...system } };
  actor.items = { contents: items, get: id => items.find(item => item.id == id) };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

const switchNames = (actor, ctx) => ruleDialogSwitches(actor, ctx).map(s => s.label);

function tick(actor, ctx, options = {}) {
  const ext = Object.fromEntries(ruleDialogSwitches(actor, ctx).map(s => [s.name, true]));
  const result = { shiftUp: 0, shiftDown: 0, ...options, ext };
  applyRuleSwitches(actor, result, ctx);
  return result;
}

beforeAll(() => {
  global.game = { ...(global.game ?? {}), combat: null, user: { targets: new Set() } };
});

test('Broadcaster Hang-Up: a Snag switch on Social tests', () => {
  const actor = holder(['qgtgitems/_source/Broadcaster_5Fe0ACJMotbya813.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ snag: true });
});

test('Traitor: a ↓1 switch on Social tests', () => {
  const actor = holder(['dditems/_source/Traitor_SBRYtQKEy0EKsYBi.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'alertness', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ shiftDown: 1 });
});

test('Universal Translator: a ↑3 switch on any test', () => {
  const actor = holder(['fgtaaitems/_source/Universal_Translator_pq2UFVm5BNszAk0f.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ shiftUp: 3 });
});

test('Stellar Experience: an Edge switch on Smarts tests that are not attacks', () => {
  const actor = holder(['ccitems/_source/Stellar_Experience_6JxxtROhqL4RS3dF.json']);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toHaveLength(1);
  expect(switchNames(actor, { rolledEssence: 'smarts', item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(switchNames(actor, { rolledEssence: 'social' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'smarts' })).toMatchObject({ edge: true });
});

test('Eager to Explode: a ↓1 switch on anything but a spell', () => {
  const actor = holder(['kocitems/_source/Eager_to_Explode_ieng7vOsUiz5fVBP.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'spellcasting' })).toEqual([]);
  expect(switchNames(actor, { item: { type: 'spell', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftDown: 1 });
});

test('Whimsical: an automatic ↓1 on Infiltration', () => {
  const actor = holder(['tfcrbitems/_source/Whimsical_XLDVNcC9B4hnSppZ.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ shiftDown: 1, label: 'Whimsical (not just for fun)' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
});

test.each([
  'fgtaaitems/_source/Lifelike_cqAShkpH0EIYZSDS.json',
  'tsitems/_source/Lifelike_XnXghb8MMa8Vm4e1.json',
])('Lifelike (%s): Deception in Bot Mode has its Edge switch on', file => {
  const actor = holder([file], { system: { isTransformed: false } });
  const [entry] = ruleDialogSwitches(actor, { rolledSkill: 'deception' });
  expect(entry).toMatchObject({ value: true });
  expect(tick(actor, { rolledSkill: 'deception' })).toMatchObject({ edge: true });
  expect(ruleDialogSwitches(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  actor.system.isTransformed = true;
  expect(ruleDialogSwitches(actor, { rolledSkill: 'deception' })).toEqual([]);
});

test.each([
  'tsitems/_source/Insectoid_Components_K1unZpd5j419Qwka.json',
  'dditems/_source/Insectoid_Components_dvTnIzPUg5kUVkBq.json',
])('Insectoid Components (%s): ↑2 Brawn in Alt Mode only', file => {
  const actor = holder([file], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'brawn' }).sources[0].shiftUp).toBe(2);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
});

test('Pet Venom Adaptation: Edge on Brawn while Poisoned', () => {
  const actor = holder(['wtnvcgitems/_source/Pet_Venom_Adaptation_JYOzJJ1OUnb9xHVo.json'], { statuses: ['poisoned'] });
  expect(ruleRollSources(actor, null, { rolledSkill: 'brawn' }).sources[0]).toMatchObject({ edge: true, label: 'Pet Venom Adaptation' });
  actor.statuses.clear();
  expect(ruleRollSources(actor, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
});
