import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { applyRuleImmunity, applyRuleSwitches, consumeLimited, requisitionTier, ruleCover, ruleDamageDealt, ruleDamageTaken, ruleDefenseAdjust, ruleDerived, ruleDialogSwitches, ruleDieSubstitution, ruleMovement, ruleNoLongRangeSnag, ruleNoUntrainedSnag, ruleQualifiedUpgrade, ruleRequisitionAccess, ruleRollSources, ruleScaledDamage, ruleSpecializes } from './adapter.mjs';

/**
 * Items converted from hand-written code to item rules (docs/RULES_ENGINE_PLAN.md §10). Each test
 * loads the item straight from its pack source, so it checks the shipped data, and asserts what the
 * removed code's own test asserted.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const readdirOf = dir => readdirSync(join(ROOT, 'packs', dir, '_source'));

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

/* Night Vale, batch 3: roll switches from the wtnv extension slice. */

test.each([
  ['wtnvcgitems/_source/Community_Martial_Arts_uY9wPJH31z5kAtdB.json'],
  ['wtnvcgitems/_source/Vehicle_Whisperer_dLCMo7SrmVIP69Mj.json'],
])('%s: a ↑1 switch on Social and Smarts tests', file => {
  const actor = holder([file]);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ shiftUp: 1 });
});

test('Acute Senses: Edge on Alertness or Weird, ↑1 on anything else', () => {
  const actor = holder(['wtnvcgitems/_source/Acute_Senses_ygxNBnUhFIfqg349.json']);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ edge: true, shiftUp: 0 });
  expect(tick(actor, { rolledSkill: 'weird' })).toMatchObject({ edge: true, shiftUp: 0 });
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftUp: 1 });
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
});

test('Nobility: a ↑1 switch on Social tests only', () => {
  const actor = holder(['fgtaaitems/_source/Nobility_5ZUcDuVx1pJ1R1RG.json']);
  expect(switchNames(actor, { rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ shiftUp: 1 });
});

test('Gridlock Authority: an Edge switch on Social or Intimidation tests', () => {
  const actor = holder(['fgtaaitems/_source/Gridlock_Authority_EiS24nGsgSsroa16.json']);
  expect(switchNames(actor, { rolledSkill: 'intimidation', rolledEssence: 'strength' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ edge: true });
});

/* Night Vale, batch 4: rider sources. */

test('Chunky: Edge on a Shove', () => {
  const actor = holder(['wtnvcgitems/_source/Chunky_2NDSnADDffC4SyyZ.json']);
  expect(ruleRollSources(actor, null, { isShove: true }).sources[0]).toMatchObject({ label: 'Chunky', edge: true });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('In the Rain: ↑1 back on a downshifted Shove or trip', () => {
  const actor = holder(['wtnvcgitems/_source/In_the_Rain_grV4J3aS09yzGqW7.json']);
  expect(ruleRollSources(actor, null, { isShove: true, pendingShiftDown: 1 }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { isShove: true, pendingShiftDown: 0 }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: { system: { damageType: 'knocProne' } }, pendingShiftDown: 2 }).sources).toHaveLength(1);
  expect(ruleRollSources(actor, null, { damageType: 'maneuver', item: { system: {} }, pendingShiftDown: 1 }).sources).toHaveLength(1);
  expect(ruleRollSources(actor, null, { item: { system: { damageType: 'blunt' } }, pendingShiftDown: 1 }).sources).toEqual([]);
});

/* Batch 5: Animal, every printing - an incoming Snag. */

test.each([
  'wtnvcgitems/_source/Animal_xNiPMhVMQQUzlRg8.json',
  'gijcrbitems/_source/Animal_YeGzq0XETdv7LeBn.json',
  'mlpcrbitems/_source/Animal_oCYovZheSrNIvrti.json',
])('Animal (%s): Persuasion and Deception against the holder take a Snag', file => {
  const pet = holder([file]);
  const roller = holder([]);
  expect(ruleRollSources(roller, pet, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ snag: true, label: 'Animal' });
  expect(ruleRollSources(roller, pet, { rolledSkill: 'deception' }).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(roller, pet, { rolledSkill: 'science' }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

/* My Little Pony, batch 6: the mlp1/mlp2 extension slices. */



test('Honorary Apple: an Edge switch on Social tests', () => {
  const actor = holder(['iajitems/_source/Honorary_Apple_bYx0fmWfkOTjr97q.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ edge: true });
});



test('Hand Axe: a ↑1 switch on any test', () => {
  const actor = holder(['kocitems/_source/Hand_Axe_7crNgIuylYGHUES8.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual(["Chopping (Hand Axe: ↑1)"]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftUp: 1 });
});

test('Handsaw: an Edge switch on any test', () => {
  const actor = holder(['kocitems/_source/Handsaw_f9Xl8sawCJ7EBwGw.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual(["Clean, straight cuts (Handsaw: Edge)"]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ edge: true });
});

test('Net: a ↑1 switch on any test', () => {
  const actor = holder(['kocitems/_source/Net_5ZsWimVR7fWu2EMW.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual(["Catching something (Net: ↑1)"]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftUp: 1 });
});

test('Snare Trap: a ↑1 switch on any test', () => {
  const actor = holder(['kocitems/_source/Snare_Trap_pCncxHtzpST2EN9Z.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual(["Capturing with a set trap (Snare Trap: ↑1)"]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftUp: 1 });
});

test('Hard Habit to Break: a ↓1 switch on anything but Deception', () => {
  const actor = holder(['kocitems/_source/Hard_Habit_to_Break_q9ObJy6Ipqn7lPHM.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftDown: 1 });
});

test('Hidden in Plain Sight: a Snag switch on any test', () => {
  const actor = holder(['kocitems/_source/Hidden_in_Plain_Sight_Sm5LWv4KkiQJNYyI.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual(["Trying to get noticed (Hidden in Plain Sight: Snag)"]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ snag: true });
});

test('Mired in Academia: a Snag switch on any test', () => {
  const actor = holder(['kocitems/_source/Mired_in_Academia_EC7Xzefmh7AEHBrr.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual(["Teaching magic (Mired in Academia: Snag)"]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ snag: true });
});

test('Acute Sense (MLP): Edge on Alertness, a ↑1 switch on anything else', () => {
  const actor = holder(['mlpcrbitems/_source/Acute_Sense_xhNYPiLSmYWov9CG.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ label: 'Acute Sense', edge: true });
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftUp: 1 });
});

test("Bad with People: a ↓1 switch on Social tests", () => {
  const actor = holder(['mlpcrbitems/_source/Bad_with_People_9fjtPWl2KE5ZGwq0.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'alertness', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ shiftDown: 1 });
});

test('Jarring: a Snag switch on Deception and Persuasion', () => {
  const actor = holder(['mlpcrbitems/_source/Jarring_pa5CU1JLclMKC2vS.json']);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'intimidation' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'deception' })).toMatchObject({ snag: true });
});

test('Wanderlust: a Snag switch out of combat only', () => {
  const actor = holder(['mlpcrbitems/_source/Wanderlust_PhRg4OscG7MyqJ6X.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ snag: true });
  game.combat = { started: true };
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  game.combat = null;
});

test('Competitor: a ↑1 switch on any test', () => {
  const actor = holder(['sotsitems/_source/Competitor_22T1Mw1SYLUIK1mw.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftUp: 1 });
});

/* GI Joe and Transformers, batch 7: gij1/gij3/tf1/tf3 switches. */

test('Second Skin: an Edge switch on tests that are not attacks', () => {
  const actor = holder(['gijcrbitems/_source/Second_Skin_Txn7a7v4gQOCYPhC.json']);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'deception' })).toMatchObject({ edge: true });
});

test('Brutish: a Snag switch on Social tests', () => {
  const actor = holder(['fffav1items/_source/Brutish_2STwn9zH3aInPsS9.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ snag: true });
});

test('Once a Marauder: a ↓1 switch on Social tests', () => {
  const actor = holder(['sssitems/_source/Once_a_Marauder_Prmh2Lie5CEOp71i.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ shiftDown: 1 });
});

test('Broadcaster: an Edge switch on Social tests', () => {
  const actor = holder(['qgtgitems/_source/Broadcaster_IvmCWJUuntY3KALM.json']);
  expect(switchNames(actor, { rolledSkill: 'deception', rolledEssence: 'social' })).toHaveLength(1);
  // A real roll always carries its dataset (the Communications RollModifier reads the Specialization from it).
  expect(switchNames(actor, { rolledSkill: 'technology', rolledEssence: 'smarts', dataset: {} })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ edge: true });
});

test('Petrolhead: a Specialized switch on Technology tests', () => {
  const actor = holder(['qgtgitems/_source/Petrolhead_JlJrEfRcrupprYMC.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'driving' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ isSpecialized: true });
});

test('Bootlicker: a ↑1 switch on tests that are not attacks', () => {
  const actor = holder(['ccitems/_source/Bootlicker_drtmA1p3q4y7LMTk.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftUp: 1 });
});

test('Storage Compartments: whoever targets the holder gets a Snag switch', () => {
  const holderActor = holder(['dditems/_source/Storage_Compartments_NnHqdvBfYNq7J0l2.json']);
  const searcher = holder([]);
  game.user.targets = new Set([{ actor: holderActor }]);
  expect(switchNames(searcher, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(tick(searcher, { rolledSkill: 'alertness' })).toMatchObject({ snag: true });
  expect(ruleRollSources(searcher, holderActor, { rolledSkill: 'alertness' }).sources).toEqual([]);
  game.user.targets = new Set();
  expect(switchNames(searcher, { rolledSkill: 'alertness' })).toEqual([]);
});

test('Hindsight: an Edge switch on Alertness', () => {
  const actor = holder(['tfcrbitems/_source/Hindsight_QIBNwPLGYoXhjwcQ.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ edge: true });
});

test('Mimicry Vocoder: an Edge switch on Deception', () => {
  const actor = holder(['tfcrbitems/_source/Mimicry_Vocoder_Sa7fFCDKf6hMwmBx.json']);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'deception' })).toMatchObject({ edge: true });
});

test('Nose for Trouble: an Edge switch for traps on any test', () => {
  const actor = holder(['tfcrbitems/_source/Nose_for_Trouble_VUal4FUlNIrwo2MG.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  // Plus the Streetwise search switch on Alertness (pass2-b).
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(2);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ edge: true });
});

test('Subordinate: a ↓1 switch on any test', () => {
  const actor = holder(['tfcrbitems/_source/Subordinate_M5gCV4i6hoOSowIb.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ shiftDown: 1 });
});

test('Tow Cable & Hook: an Edge switch on Brawn in Alt Mode', () => {
  const actor = holder(['tfcrbitems/_source/Tow_Cable___Hook_EVywnYUDjBfMcoWT.json'], { system: { isTransformed: true } });
  expect(switchNames(actor, { rolledSkill: 'brawn' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'might' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'brawn' })).toMatchObject({ edge: true });
  actor.system.isTransformed = false;
  expect(switchNames(actor, { rolledSkill: 'brawn' })).toEqual([]);
});

test('Water Cannon: an Edge switch on any test in Alt Mode', () => {
  const actor = holder(['tfcrbitems/_source/Water_Cannon_FUOOqATSqU6habEt.json'], { system: { isTransformed: true } });
  expect(switchNames(actor, { rolledSkill: 'targeting' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'targeting' })).toMatchObject({ edge: true });
  actor.system.isTransformed = false;
  expect(switchNames(actor, { rolledSkill: 'targeting' })).toEqual([]);
});

test('Chemist Hang-Up: ↓1 on Persuasion, listed so it can be unticked', () => {
  const actor = holder(['ccitems/_source/Chemist_cHNytkkeP7iizzgK.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ shiftDown: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources).toEqual([]);
});

/* Transformers, batch 8: the tf2 extension slice. */

test('Acute Sense (TF): Edge on Alertness, a ↑1 switch on anything else unless the G.I. JOE printing is held', () => {
  const actor = holder(['tfcrbitems/_source/Acute_Sense_rl8hs6ezb6VSDahM.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ label: 'Acute Sense', edge: true });
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftUp: 1 });
  actor.items.contents.push({ id: 'gij', name: 'Acute Sense', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.WvjGJ5AcC0z07d0J' } }, system: {}, parent: actor });
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
});

test('Caterpillar Tread: two ↑1 on a Bot Mode shove, an Edge switch on Driving in Alt Mode', () => {
  const actor = holder(['tfcrbitems/_source/Caterpillar_Tread_pi0wUVrd4tb1emod.json'], { system: { canTransform: true, isTransformed: false } });
  const out = ruleRollSources(actor, null, { isShove: true });
  expect(out.sources.reduce((n, s) => n + s.shiftUp, 0)).toBe(2);
  expect(switchNames(actor, { rolledSkill: 'driving' })).toEqual([]);
  actor.system.isTransformed = true;
  expect(ruleRollSources(actor, null, { isShove: true }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'driving' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'driving' })).toMatchObject({ edge: true });
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
});

test('Supporting Cast: a ↓1 switch on tests that are not attacks', () => {
  const actor = holder(['eocitems/_source/Supporting_Cast_GjHqKI3n7lLp3lVn.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftDown: 1 });
});

test('Distressed: a ↓1 switch on Alertness', () => {
  const actor = holder(['tfcrbitems/_source/Distressed_sYz93Ud4qoob9PsA.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ shiftDown: 1 });
});

test('Earthspoiled: a ↓1 switch on any test', () => {
  const actor = holder(['tfcrbitems/_source/Earthspoiled_L2oBtS3KAwncY2xY.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ shiftDown: 1 });
});

test('For The Allspark!: ↑1 on Infiltration in Alt Mode, and a switch for another ↑1', () => {
  const actor = holder(['tfcrbitems/_source/For_The_Allspark__UMlH70vmM3kJzWvS.json'], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ label: 'For The Allspark!', shiftUp: 1 });
  expect(switchNames(actor, { rolledSkill: 'infiltration' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'infiltration' })).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'infiltration' })).toEqual([]);
});

/* GI Joe, batch 9: gij2 and situational1. */

test('Acute Sense (GI JOE): a ↑1 switch on anything but Alertness', () => {
  const actor = holder(['gijcrbitems/_source/Acute_Sense_WvjGJ5AcC0z07d0J.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'might' })).toEqual(['Your chosen sense applies (Acute Sense: ↑1)']);
  expect(tick(actor, { rolledSkill: 'might' })).toMatchObject({ shiftUp: 1 });
});

test('Enhanced Sensors: Edge on Alertness and a ↑1 switch, unless the drone has Acute Sense', () => {
  const drone = holder(['gijcrbitems/_source/Enhanced_Sensors_TIgFDX4ksgRqR3g9.json']);
  expect(ruleRollSources(drone, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ edge: true, label: 'Enhanced Sensors' });
  expect(switchNames(drone, { rolledSkill: 'alertness' })).toEqual([]);
  expect(switchNames(drone, { rolledSkill: 'might' })).toHaveLength(1);
  expect(tick(drone, { rolledSkill: 'might' })).toMatchObject({ shiftUp: 1 });
  const both = holder(['gijcrbitems/_source/Enhanced_Sensors_TIgFDX4ksgRqR3g9.json', 'gijcrbitems/_source/Acute_Sense_WvjGJ5AcC0z07d0J.json']);
  both.items.contents[1].flags = { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.WvjGJ5AcC0z07d0J' } };
  expect(ruleRollSources(both, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ label: 'Acute Sense', edge: true })]);
  expect(switchNames(both, { rolledSkill: 'might' })).toEqual(['Your chosen sense applies (Acute Sense: ↑1)']);
});

test('Nose For Trouble (GI JOE): an Edge switch for traps on any test', () => {
  const actor = holder(['gijcrbitems/_source/Nose_For_Trouble_MH630UTgsJtbf3Y5.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ edge: true });
});

test('Swerve!: an Edge switch on Driving', () => {
  const actor = holder(['gijcrbitems/_source/Swerve__vUMLQZvhOovTQYrH.json']);
  expect(switchNames(actor, { rolledSkill: 'driving' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'driving' })).toMatchObject({ edge: true });
});

test('Diver: ↑1 on Alertness underwater', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['ghpfitems/_source/Diver_erZl8Udy03P7vHTe.json']);
  try {
    setWorldLookups({ environment: () => 'underwater' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ shiftUp: 1, label: 'Diver' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    setWorldLookups({ environment: () => 'normal' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  } finally {
    setWorldLookups({ environment: undefined });
  }
});

test('Earth Defense Command Benefits: ↑2 on attacks in zero gravity', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['fgtaaitems/_source/Earth_Defense_Command_Benefits_uQQbRbwADVtVwsym.json']);
  const attack = { item: { type: 'weaponEffect', system: {}, flags: {} } };
  try {
    setWorldLookups({ environment: () => 'zeroGravity' });
    expect(ruleRollSources(actor, null, attack).sources[0]).toMatchObject({ shiftUp: 2 });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    setWorldLookups({ environment: () => 'lowGravity' });
    expect(ruleRollSources(actor, null, attack).sources).toEqual([]);
  } finally {
    setWorldLookups({ environment: undefined });
  }
});

test('Every Trick in the Book: an Invisible attacker takes a Snag', () => {
  const defender = holder(['gijcrbitems/_source/Every_Trick_in_the_Book_HKv38GCtVdSV2qMH.json']);
  const attack = { item: { type: 'weaponEffect', system: {}, flags: {} } };
  expect(ruleRollSources(holder([], { statuses: ['invisible'] }), defender, attack).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(holder([]), defender, attack).sources).toEqual([]);
  expect(ruleRollSources(holder([], { statuses: ['invisible'] }), defender, { rolledSkill: 'deception' }).sources).toEqual([]);
  expect(ruleRollSources(holder([], { statuses: ['invisible'] }), holder([]), attack).sources).toEqual([]);
});

test('Thermal Scope: Edge against an Invisible target, with its own weapon only', () => {
  const actor = holder(['gijcrbitems/_source/Thermal_Scope_j9UxxlSMLRUcwGVk.json']);
  const [scope] = actor.items.contents;
  actor.items.contents.push({ id: 'w1', name: 'Rifle', type: 'weapon', flags: {}, system: {}, parent: actor });
  scope.flags = { essence20: { parentId: 'w1' } };
  rebuildIndex(actor);
  const scoped = { item: { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'w1' } } } };
  const other = { item: { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'w2' } } } };
  const hidden = holder([], { statuses: ['invisible'] });
  expect(ruleRollSources(actor, hidden, scoped).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(actor, hidden, other).sources).toEqual([]);
  expect(ruleRollSources(actor, holder([]), scoped).sources).toEqual([]);
  expect(ruleRollSources(actor, null, scoped).sources).toEqual([]);
});

/* Power Rangers: the pr1/pr2/pr3 extension slices. */

test("Can't Catch Me!: -1 Evasion when the holder can't be aware of the attack", () => {
  const defender = holder(['atsitems/_source/Can_t_Catch_Me_vic68loeBd3vXbmB.json']);
  const attacker = holder([]);
  expect(ruleDefenseAdjust(attacker, defender, 'evasion', {})).toBe(0);
  attacker.statuses.add('invisible');
  expect(ruleDefenseAdjust(attacker, defender, 'evasion', {})).toBe(-1);
  attacker.statuses.clear();
  defender.statuses.add('asleep');
  expect(ruleDefenseAdjust(attacker, defender, 'toughness', {})).toBe(0);
  expect(ruleDefenseAdjust(attacker, defender, 'evasion', {})).toBe(-1);
});

test('Clawed Armor: Edge on Alertness; forcing the wearer to move takes a Snag', () => {
  const wearer = holder(['atsitems/_source/Clawed_Armor_5Z9vkcfZYwmtA6R4.json']);
  wearer.items.contents[0].system.equipped = true;
  rebuildIndex(wearer);
  expect(ruleRollSources(wearer, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ label: 'Clawed Armor', edge: true });
  const attacker = holder([]);
  const grab = { type: 'weaponEffect', system: { damageType: 'grapple' }, flags: {} };
  expect(ruleRollSources(attacker, wearer, { rolledSkill: 'athletics', item: grab }).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(attacker, wearer, { isShove: true }).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(attacker, wearer, { rolledSkill: 'athletics', item: { type: 'weaponEffect', system: { damageType: 'blunt' }, flags: {} } }).sources).toEqual([]);
  wearer.items.contents[0].system.equipped = false;
  rebuildIndex(wearer);
  expect(ruleRollSources(wearer, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
});

test('Lightspeed Rescue Injector: ↑1 on Science while equipped', () => {
  const actor = holder(['atsitems/_source/Lightspeed_Rescue_Injector_Bcimc6wYaSlisR1d.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources[0]).toMatchObject({ label: 'Lightspeed Rescue Injector (Science (Medicine))', shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'technology' }).sources).toEqual([]);
  actor.items.contents[0].system.equipped = false;
  rebuildIndex(actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources).toEqual([]);
});

test('Phantom Ranger Prime: an Edge switch on non-Power rolls while Morphed', () => {
  const actor = holder(['atsitems/_source/Phantom_Ranger_Prime_PHgWjT0syOOBOOK5.json'], { system: { isMorphed: true } });
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual(['Using a Grid Power (Phantom Ranger Prime: Edge)']);
  expect(switchNames(actor, { item: { type: 'power', system: { type: 'grid' } } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'athletics' })).toMatchObject({ edge: true });
  actor.system.isMorphed = false;
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
});

test('Power Wing: +2 Personal Power maximum while equipped', () => {
  const actor = holder(['atsitems/_source/Power_Wing_aCPFmjY80u9671Hl.json'], { system: { powers: { personal: { max: 4 } } } });
  ruleDerived(actor);
  expect(actor.system.powers.personal.max).toBe(4);
  actor.items.contents[0].system.equipped = true;
  ruleDerived(actor);
  expect(actor.system.powers.personal.max).toBe(6);
});

test("S.W.A.T. Upgrade: the Zord's pilot gets an Edge switch, on by default, on Intimidation and Persuasion", () => {
  const zord = holder(['atsitems/_source/S_W_A_T__Upgrade_Ce5f5pQTNTSY6xgF.json']);
  const pilot = holder([]);
  const rider = holder([]);
  Object.assign(zord, { type: 'zord', uuid: 'Actor.swatZord' });
  pilot.uuid = 'Actor.swatPilot';
  rider.uuid = 'Actor.swatRider';
  zord.system.actors = { a: { uuid: pilot.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid, vehicleRole: 'passenger' } };
  game.actors = { contents: [pilot, rider, zord] };
  const [entry] = ruleDialogSwitches(pilot, { rolledSkill: 'intimidation' });
  expect(entry).toMatchObject({ value: true });
  expect(tick(pilot, { rolledSkill: 'persuasion' })).toMatchObject({ edge: true });
  expect(switchNames(pilot, { rolledSkill: 'deception' })).toEqual([]);
  expect(switchNames(rider, { rolledSkill: 'intimidation' })).toEqual([]);
  game.actors = undefined;
});

test('Warzord: +1 damage on Might and Finesse attacks', () => {
  const zord = holder(['atsitems/_source/Warzord_jX5IHpydHimdjbGb.json']);
  const notes = [];
  const tools = { damageBonusNote: (result, amount, label) => notes.push([amount, label]) };
  ruleDamageDealt(zord, null, { damageValue: 3 }, { skill: 'might' }, tools);
  ruleDamageDealt(zord, null, { damageValue: 3 }, { skill: 'finesse' }, tools);
  ruleDamageDealt(zord, null, { damageValue: 3 }, { skill: 'targeting' }, tools);
  expect(notes).toEqual([[1, 'Warzord'], [1, 'Warzord']]);
});

test('Xeno-Location Study: an Edge switch on Animal Handling, Deception, Persuasion and Survival', () => {
  const actor = holder(['atsitems/_source/Xeno_Location_Study_lT1xJuxw29luNgUj.json']);
  for (const skill of ['animalHandling', 'deception', 'persuasion', 'survival']) {
    expect(switchNames(actor, { rolledSkill: skill })).toHaveLength(1);
  }

  expect(switchNames(actor, { rolledSkill: 'culture' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'survival' })).toMatchObject({ edge: true });
});

test('Cloud Hatchet: Aerial Movement at least 30ft while equipped', () => {
  const actor = holder(['jttitems/_source/Cloud_Hatchet_RNP5lNTQLostQKSB.json'], { system: { movement: { aerial: { total: 0 } } } });
  ruleDerived(actor);
  expect(actor.system.movement.aerial.total).toBe(30);
  actor.system.movement.aerial.total = 40;
  ruleDerived(actor);
  expect(actor.system.movement.aerial.total).toBe(40);
  actor.items.contents[0].system.equipped = false;
  actor.system.movement.aerial.total = 0;
  ruleDerived(actor);
  expect(actor.system.movement.aerial.total).toBe(0);
});

test('Mobile Headquarters: ↑1 on Culture, Science and Technology for whoever is seated in the Zord', () => {
  const zord = holder(['jttitems/_source/Mobile_Headquarters_soCSwGBp0AZbEeZC.json']);
  const ranger = holder([]);
  Object.assign(zord, { type: 'zord', uuid: 'Actor.mhqZord' });
  ranger.uuid = 'Actor.mhqRanger';
  zord.system.actors = { x: { uuid: ranger.uuid, vehicleRole: 'passenger' } };
  game.actors = { contents: [ranger, zord] };
  expect(ruleRollSources(ranger, null, { rolledSkill: 'science' }).sources[0]).toMatchObject({ label: 'Mobile Headquarters', shiftUp: 1 });
  expect(ruleRollSources(ranger, null, { rolledSkill: 'might' }).sources).toEqual([]);
  expect(ruleRollSources(holder([]), null, { rolledSkill: 'science' }).sources).toEqual([]);
  game.actors = undefined;
});

test('Time Displaced: a ↓2 switch on any test', () => {
  const actor = holder(['jttitems/_source/Time_Displaced_N4OwC0gTkUtRwBKr.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual(['Unfamiliar with this era (Time Displaced: ↓2)']);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ shiftDown: 2 });
});

test('Graphite Ranger Prime: attacks on the Morphed holder in round 1 take a Snag', () => {
  const target = holder(['bthitems/_source/Graphite_Ranger_Prime_nVOpdhr6aFnuY0ks.json'], { system: { isMorphed: true } });
  const attacker = holder([]);
  const attack = { item: { type: 'weaponEffect', system: {}, flags: {} } };
  game.combat = { started: true, round: 1 };
  expect(ruleRollSources(attacker, target, attack).sources[0]).toMatchObject({ label: 'Graphite Ranger Prime', snag: true });
  expect(ruleRollSources(attacker, target, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  game.combat = { started: true, round: 2 };
  expect(ruleRollSources(attacker, target, attack).sources).toEqual([]);
  game.combat = null;
});

test('Vast Wealth: an Edge switch on Social tests', () => {
  const actor = holder(['prcrbitems/_source/Vast_Wealth_bZ4IqEVgHnTL0XV6.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual(['Flaunting your wealth (Vast Wealth: Edge)']);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ edge: true });
});

test('Morphin Navigator: an Edge switch on tests that are not attacks', () => {
  const actor = holder(['ttsgitems/_source/Morphin_Navigator_nDx2XD6gD9lM37Bl.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual(['Navigating the Grid (Morphin Navigator: Edge)']);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ edge: true });
});

/* other2 slice: Decepticon Directive gear. */

test('Pit Plate: ↑1 on Intimidation tests while worn', () => {
  const actor = holder(['dditems/_source/Pit_Plate_AgWI1lccUBTgj3gT.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([expect.objectContaining({ label: 'Pit Plate', shiftUp: 1 })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  // Attached to armor, it counts only while that armor is equipped.
  const armor = { id: 'arm', name: 'Armor', type: 'armor', flags: {}, system: { equipped: false }, parent: actor };
  actor.items.contents.push(armor);
  actor.items.contents[0].flags = { essence20: { parentId: 'arm' } };
  rebuildIndex(actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  armor.system.equipped = true;
  rebuildIndex(actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toHaveLength(1);
});

/* Zord slices (zord1/zord2): mode-gated Defenses and a granted Feature. */

test('Titan Frame and Plated Carapace follow the mode', () => {
  const files = ['dditems/_source/Titan_Frame_ncKndgd7OjDoIwHx.json', 'dditems/_source/Plated_Carapace_txkHR1vr7NRWoIhW.json'];
  const defenses = () => ({ toughness: { total: 20, string: '20' }, evasion: { total: 12, string: '12' } });
  const bot = holder(files, { system: { canTransform: true, isTransformed: false, defenses: defenses() } });
  ruleDerived(bot);
  expect(bot.system.defenses.toughness.total).toBe(20);
  expect(bot.system.defenses.evasion.total).toBe(10);
  expect(bot.system.defenses.evasion.string).toBe('12 - 2 (Titan Frame)');
  const alt = holder(files, { system: { canTransform: true, isTransformed: true, defenses: defenses() } });
  ruleDerived(alt);
  expect(alt.system.defenses.toughness.total).toBe(18);
  expect(alt.system.defenses.evasion.total).toBe(12);
});

test('Dozer Blade: +2 Toughness in Bot Mode only', () => {
  const defenses = () => ({ toughness: { total: 10, string: '10' }, evasion: { total: 10, string: '10' } });
  const bot = holder(['tfcrbitems/_source/Dozer_Blade_P3t8JOiCH5bR0N5r.json'], { system: { canTransform: true, isTransformed: false, defenses: defenses() } });
  ruleDerived(bot);
  expect(bot.system.defenses.toughness).toEqual({ total: 12, string: '10 + 2 (Dozer Blade)' });
  const alt = holder(['tfcrbitems/_source/Dozer_Blade_P3t8JOiCH5bR0N5r.json'], { system: { canTransform: true, isTransformed: true, defenses: defenses() } });
  ruleDerived(alt);
  expect(alt.system.defenses.toughness.total).toBe(10);
  const human = holder(['tfcrbitems/_source/Dozer_Blade_P3t8JOiCH5bR0N5r.json'], { system: { canTransform: false, defenses: defenses() } });
  ruleDerived(human);
  expect(human.system.defenses.toughness.total).toBe(10);
});

test('Adaptable Future Tech: grants the Combiner Feature unless the Zord already has it', async () => {
  const { grantData } = await import('./lifecycle.mjs');
  const saved = global.foundry.utils;
  global.foundry.utils = {
    ...saved,
    setProperty: (object, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
    },
  };
  try {
    const combiner = 'Compendium.essence20.pr_crb.Item.ZZMBVjmosr0VViMU';
    const zord = holder(['ttsgitems/_source/Adaptable_Future_Tech_35qov21Mglyqxql1.json']);
    zord.type = 'zord';
    const [aft] = zord.items.contents;
    const load = async uuid => (uuid == combiner ? { toObject: () => ({ _id: 'x', name: 'Combiner', type: 'feature', system: {} }) } : null);
    const [data] = await grantData(aft, zord, { load });
    expect(data).toMatchObject({ name: 'Combiner', _stats: { compendiumSource: combiner }, flags: { essence20: { grantedBy: aft.id } } });
    zord.items.contents.push({ id: 'owned', type: 'feature', flags: {}, _stats: { compendiumSource: combiner }, system: {} });
    expect(await grantData(aft, zord, { load })).toEqual([]);
  } finally {
    global.foundry.utils = saved;
  }
});

/* other3 slice: Dazed, Naive, Gluten-Tolerant, Dr. K's Modified Morpher. */

test('Dazed: Evasion is 9 + Speed, on top of other bonuses', () => {
  const actor = holder(['wtnvcgitems/_source/Dazed_byRfPI0ud1wj43Qv.json'], { system: {
    essences: { speed: { max: 3 }, smarts: { max: 2 } },
    defenses: { evasion: { base: 10, essence: 'speed', total: 15, string: 'x' }, willpower: { base: 10, essence: 'smarts', total: 12, string: 'y' } },
  } });
  ruleDerived(actor);
  expect(actor.system.defenses.evasion.total).toBe(14);
  expect(actor.system.defenses.evasion.string).toContain('- 1 (Dazed)');
  expect(actor.system.defenses.willpower.total).toBe(12);
});

test('Naive: Willpower is 9 + Smarts', () => {
  const actor = holder(['wtnvcgitems/_source/Naive_gT3jMGYcF8Gbi0O5.json'], { system: {
    essences: { smarts: { max: 2 } },
    defenses: { willpower: { base: 10, essence: 'smarts', total: 12, string: '' } },
  } });
  ruleDerived(actor);
  expect(actor.system.defenses.willpower.total).toBe(11);
  expect(actor.system.defenses.willpower.string).toContain('- 1 (Naive)');
});

test('Gluten-Tolerant: a ↓1 switch on any test', () => {
  const actor = holder(['wtnvcgitems/_source/Gluten_Tolerant_dzYRdi2cSlZSHozs.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toHaveLength(1);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftDown: 1 });
});

test("Dr. K's Modified Morpher: attacks, powers and spells against the holder get a ↓2 switch", () => {
  const holderActor = holder(['ttsgitems/_source/Dr__K_s_Modified_Morpher_cjLsZGJhMeGoy1uO.json']);
  const attacker = holder([]);
  const attack = { item: { type: 'weaponEffect', system: {} } };
  game.user.targets = new Set([{ actor: holderActor }]);
  expect(switchNames(attacker, attack)).toHaveLength(1);
  expect(switchNames(attacker, { item: { type: 'power', system: {} } })).toHaveLength(1);
  expect(switchNames(attacker, { item: { type: 'spell', system: {} } })).toHaveLength(1);
  expect(switchNames(attacker, { rolledSkill: 'persuasion' })).toEqual([]);
  expect(tick(attacker, attack)).toMatchObject({ shiftDown: 2 });
  expect(ruleRollSources(attacker, holderActor, attack).sources).toEqual([]);
  game.user.targets = new Set();
  expect(switchNames(attacker, attack)).toEqual([]);
});

/* react / resource / fix3 slices: Surgical Operators, Mega Training Regimen, One With Your Weapon,
   Martial Artist (both printings) and Object Alt Mode. */

test('Surgical Operators: an Edge switch, off by default, on Science tests only', () => {
  const actor = holder(['fffav1items/_source/Surgical_Operators_JtRCN6ppDatZVmav.json']);
  const [entry] = ruleDialogSwitches(actor, { rolledSkill: 'science' });
  expect(entry).toMatchObject({ value: false, label: 'Treating a poison or toxin (Surgical Operators: Edge)' });
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual([]);
  expect(switchNames(holder([]), { rolledSkill: 'science' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ edge: true });
});

test('Mega Training Regimen: Grapple and Trip attacks and a plain Shove against the holder take a Snag', () => {
  const defender = holder(['fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json']);
  const attacker = holder([]);
  const effect = damageType => ({ type: 'weaponEffect', system: { damageType }, flags: {} });
  for (const ctx of [{ isAttack: true, item: effect('grapple') }, { isAttack: true, item: effect('knocProne') }, { isShove: true }]) {
    const { sources } = ruleRollSources(attacker, defender, ctx);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ label: 'Mega Training Regimen', snag: true });
  }

  // The Maneuver alternate effect: its own rule (batch diceC), still one Snag.
  expect(ruleRollSources(attacker, defender, { isAttack: true, item: effect('maneuver') }).sources).toHaveLength(1);
  expect(ruleRollSources(attacker, defender, { isShove: true, item: effect('maneuver') }).sources).toHaveLength(1);
  expect(ruleRollSources(attacker, defender, { isAttack: true, item: effect('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(attacker, holder([]), { isAttack: true, item: effect('grapple') }).sources).toEqual([]);
  expect(ruleRollSources(attacker, null, { isAttack: true, item: effect('grapple') }).sources).toEqual([]);
});

test('One With Your Weapon: Draw Weapon can cost a Free action, asked first', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const [rule, more] = costRulesFor(holder(['iafav2items/_source/One_With_Your_Weapon_RH3AFV38EBAfTvW1.json']));
  expect(more).toBeUndefined();
  expect(rule.matches({ key: 'drawWeapon' })).toBe(true);
  expect(rule.matches({ key: 'hide' })).toBe(false);
  expect(rule.to('move')).toBe('free');
  expect(rule.ask).toBe('E20.ActionPerkAskOneWithYourWeapon');
  expect(costRulesFor(holder([]))).toEqual([]);
});

test.each([
  'prcrbitems/_source/Martial_Artist_hXKy7kWGic6wSge9.json',
  'gijcrbitems/_source/Martial_Artist_rIIL4yvym7KUCUyH.json',
])('Martial Artist (%s): a Social roll at the holder gets an Edge switch, off by default', file => {
  const target = holder([file]);
  const roller = holder([]);
  game.user.targets = new Set([{ actor: target }]);
  const [entry] = ruleDialogSwitches(roller, { rolledSkill: 'persuasion', rolledEssence: 'social' });
  expect(entry).toMatchObject({ value: false, label: 'Goading them into action (Martial Artist: Edge)' });
  expect(switchNames(roller, { rolledSkill: 'athletics', rolledEssence: 'strength' })).toEqual([]);
  expect(tick(roller, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toMatchObject({ edge: true });
  expect(ruleRollSources(roller, target, { rolledEssence: 'social' }).sources).toEqual([]);
  game.user.targets = new Set([{ actor: holder([]) }]);
  expect(switchNames(roller, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
  game.user.targets = new Set();
  expect(switchNames(roller, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
});

test('Object Alt Mode: in Alt Mode, an Edge switch on Infiltration (on) and Alertness (off), never on attacks', () => {
  const actor = holder(['tfcrbitems/_source/Object_Alt_Mode_z3qE2fLKzJtsyZ6C.json'], { system: { isTransformed: true } });
  expect(ruleDialogSwitches(actor, { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ value: true })]);
  expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness' })).toEqual([expect.objectContaining({ value: false })]);
  expect(switchNames(actor, { rolledSkill: 'alertness', item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'infiltration' })).toMatchObject({ edge: true });
  actor.system.isTransformed = false;
  expect(switchNames(actor, { rolledSkill: 'infiltration' })).toEqual([]);
});

/* Situational, batch sit2: the situational2 extension slice (Stumble Through the City, Bookworm, Tracking Outfit, Stubbornly Loyal). */

test('Stumble Through the City: Snag on Persuasion and Deception in town, a switch where the terrain is unknown', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['kocitems/_source/Stumble_Through_the_City_sTmqok0MEmOQeboN.json']);
  try {
    setWorldLookups({ terrain: () => 'urban' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ snag: true, label: 'In a town, city or village (Stumble Through the City: Snag)' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    setWorldLookups({ terrain: () => 'woodlands' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    setWorldLookups({ terrain: () => null });
    expect(switchNames(actor, { rolledSkill: 'deception' })).toHaveLength(1);
    expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
    expect(tick(actor, { rolledSkill: 'deception' })).toMatchObject({ snag: true });
  } finally {
    setWorldLookups({ terrain: undefined });
  }
});

test('Bookworm: ↓1 facing a Librarian or in a library scene, a switch otherwise', () => {
  const actor = holder(['wtnvcgitems/_source/Bookworm_p2Qk0B5PWp10ZaqN.json']);
  const librarian = Object.assign(holder([]), { name: 'The Librarian' });
  const tagged = Object.assign(holder([], { system: { creatureTags: 'librarian' } }), { name: 'Shape' });
  const carlos = Object.assign(holder([]), { name: 'Carlos' });
  expect(ruleRollSources(actor, librarian, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ shiftDown: 1, label: 'In a library or facing a Librarian (Bookworm: ↓1)' });
  expect(ruleRollSources(actor, tagged, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ shiftDown: 1 });
  expect(ruleRollSources(actor, carlos, { rolledSkill: 'alertness' }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ shiftDown: 1 });
  game.scenes = { active: { name: 'Night Vale Public Library' } };
  expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources[0]).toMatchObject({ shiftDown: 1 });
  expect(switchNames(actor, { rolledSkill: 'culture' })).toEqual([]);
  game.scenes = undefined;
});

test('Tracking Outfit: ↑1 Targeting/Survival in the wild, ↓1 Alertness/Culture in town, only while worn', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['wtnvcgitems/_source/Tracking_Outfit_NHhNnkBBM29NpGpL.json']);
  const [outfit] = actor.items.contents;
  try {
    setWorldLookups({ terrain: () => 'desert' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'survival' }).sources[0]).toMatchObject({ shiftUp: 1 });
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources).toEqual([]);
    setWorldLookups({ terrain: () => 'urban' });
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources[0]).toMatchObject({ shiftDown: 1 });
    expect(ruleRollSources(actor, null, { rolledSkill: 'survival' }).sources).toEqual([]);
    outfit.system.equipped = false;
    rebuildIndex(actor);
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources).toEqual([]);
    outfit.system.equipped = true;
    rebuildIndex(actor);
    setWorldLookups({ terrain: () => null });
    expect(switchNames(actor, { rolledSkill: 'targeting' })).toEqual(['In the wild (Tracking Outfit: ↑1)']);
    expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual(['In an urban area (Tracking Outfit: ↓1)']);
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    expect(tick(actor, { rolledSkill: 'targeting' })).toMatchObject({ shiftUp: 1 });
  } finally {
    setWorldLookups({ terrain: undefined });
  }
});

test('Stubbornly Loyal: whoever targets the holder gets a Snag switch, not on Deception or attacks', () => {
  const loyal = holder(['mlpcrbitems/_source/Stubbornly_Loyal_zqsFMIRKaA0Ev62Y.json']);
  const caster = holder([]);
  game.user.targets = new Set([{ actor: loyal }]);
  expect(switchNames(caster, { rolledSkill: 'spellcasting' })).toEqual(['Turning them against a BFF (Stubbornly Loyal: Snag)']);
  expect(switchNames(caster, { rolledSkill: 'deception' })).toEqual([]);
  expect(switchNames(caster, { item: { type: 'weaponEffect', system: {}, flags: {} } })).toEqual([]);
  expect(tick(caster, { rolledSkill: 'spellcasting' })).toMatchObject({ snag: true });
  expect(ruleRollSources(caster, loyal, { rolledSkill: 'spellcasting' }).sources).toEqual([]);
  game.user.targets = new Set();
  expect(switchNames(caster, { rolledSkill: 'spellcasting' })).toEqual([]);
});

/* Pass 2 (pass2-c): Dark Energon, Monster Form, Lance of Light and active-Form tags - Champion His Way,
   Lance of Light, See Through Him, Path of Stone, and the Lightspeed/Solar/Ninja Storm/Ranger Operator Forms. */

const formFlags = uuid => ({ essence20: { zord1Form: { uuid } } });
const pass2Defenses = () => ({
  toughness: { total: 12, string: '12' }, evasion: { total: 11, string: '11' }, willpower: { total: 10, string: '10' }, cleverness: { total: 10, string: '10' },
});

test('Champion His Way: +2 to every Defense while holding Dark Energon', () => {
  const file = 'dditems/_source/Champion_His_Way_j9FW3wF6mKnVFj0s.json';
  const actor = holder([file], { system: { energon: { dark: { value: 1 } }, defenses: pass2Defenses() } });
  ruleDerived(actor);
  expect(actor.system.defenses.toughness.total).toBe(14);
  expect(actor.system.defenses.evasion.total).toBe(13);
  expect(actor.system.defenses.cleverness.string).toBe('10 + 2 (Champion His Way)');
  const sober = holder([file], { system: { energon: { dark: { value: 0 } }, defenses: pass2Defenses() } });
  ruleDerived(sober);
  expect(sober.system.defenses.toughness.total).toBe(12);
});

test('See Through Him: Edge on Alertness while holding Dark Energon', () => {
  const file = 'dditems/_source/See_Through_Him_WspexDF4xge4b3To.json';
  const actor = holder([file], { system: { energon: { dark: { value: 1 } } } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ label: 'See Through Him', edge: true })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  const sober = holder([file], { system: { energon: { dark: { value: 0 } } } });
  expect(ruleRollSources(sober, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
});

test('Lance of Light: Dark Dimension creatures (tag or name) take ↓2 on rolls against the holder while it is summoned', () => {
  const lance = holder(['jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json']);
  const darkonda = holder([]);
  darkonda.name = 'Darkonda';
  const tagged = holder([], { system: { creatureTags: 'Dark Dimension' } });
  const putty = holder([]);
  putty.name = 'Putty';
  expect(ruleRollSources(darkonda, lance, { rolledSkill: 'might' }).sources).toEqual([]);
  lance.flags = { essence20: { lanceOfLightActive: true } };
  for (const roller of [darkonda, tagged]) {
    expect(ruleRollSources(roller, lance, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ label: 'Lance of Light', shiftDown: 2 })]);
  }

  expect(ruleRollSources(putty, lance, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('Path of Stone: attacks on the holder in Monster Form take a Snag, except Psychic, Sonic and Void', () => {
  const stone = holder(['fmmcitems/_source/Path_of_Stone_TEjkVjIEFEbRI736.json']);
  const attacker = holder([]);
  const attack = type => ruleRollSources(attacker, stone, { isAttack: true, item: { type: 'weaponEffect', system: { damageType: type }, flags: {} } }).sources;
  expect(attack('blunt')).toEqual([]);
  stone.flags = { essence20: { monsterFormActive: true } };
  expect(attack('blunt')).toEqual([expect.objectContaining({ label: 'Stone Monster Form (Resistance)', snag: true })]);
  for (const type of ['psychic', 'sonic', 'void', undefined]) {
    expect(attack(type)).toEqual([]);
  }

  expect(ruleRollSources(attacker, stone, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Lightspeed Response: in the Form, a healing Edge switch - on for Science and Technology, never on attacks', () => {
  const actor = holder(['atsitems/_source/Lightspeed_Response__Form__E3WLZpN7iKL9uzeB.json'], { system: { isMorphed: true } });
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
  actor.flags = formFlags('Compendium.essence20.across_the_stars.Item.E3WLZpN7iKL9uzeB');
  const label = 'First aid, repair or other healing effort (Lightspeed Response: Edge)';
  expect(ruleDialogSwitches(actor, { rolledSkill: 'science' })).toEqual([expect.objectContaining({ label, value: true })]);
  expect(ruleDialogSwitches(actor, { rolledSkill: 'technology' })).toEqual([expect.objectContaining({ label, value: true })]);
  expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ label, value: false })]);
  expect(switchNames(actor, { rolledSkill: 'science', item: { type: 'weaponEffect', system: {}, flags: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ edge: true });
  actor.system.isMorphed = false;
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
});

test('Solar Power: in the Form, Cold and Energy attacks on the holder take a Snag, plus an Alertness Edge switch', () => {
  const solar = holder(['atsitems/_source/Solar_Power__Form__4ksM4tGqdjuyPSj1.json'], { system: { isMorphed: true } });
  const attacker = holder([]);
  const attack = type => ruleRollSources(attacker, solar, { item: { type: 'weaponEffect', system: { damageType: type }, flags: {} } }).sources;
  expect(attack('fire')).toEqual([]);
  solar.flags = formFlags('Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1');
  for (const type of ['fire', 'cold', 'element', 'sonic', 'laser']) {
    expect(attack(type)).toEqual([expect.objectContaining({ snag: true })]);
  }

  expect(attack('blunt')).toEqual([]);
  expect(ruleRollSources(attacker, solar, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(switchNames(solar, { rolledSkill: 'alertness' })).toEqual(['Seeing through illusions or noticing the Void (Solar Power: Edge)']);
  expect(switchNames(solar, { rolledSkill: 'athletics' })).toEqual([]);
  expect(tick(solar, { rolledSkill: 'alertness' })).toMatchObject({ edge: true });
  solar.system.isMorphed = false;
  expect(attack('fire')).toEqual([]);
});

test('Ninja Storm Wind Ranger: ↑1 on Infiltration while the Form is active', () => {
  const ninja = holder(['bthitems/_source/Ninja_Storm_Wind_Ranger__Form__Txv1ODlLKY91hPrA.json'], { system: { isMorphed: true } });
  expect(ruleRollSources(ninja, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  ninja.flags = formFlags('Compendium.essence20.beneath_the_helmet.Item.Txv1ODlLKY91hPrA');
  expect(ruleRollSources(ninja, null, { rolledSkill: 'infiltration' }).sources)
    .toEqual([expect.objectContaining({ label: 'Ninja Storm Wind Ranger (Form)', shiftUp: 1 })]);
  expect(ruleRollSources(ninja, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Ranger Operator: +2 Evasion (and Toughness, with no Morphed armor bonus) while the Form is active', () => {
  const file = 'jttitems/_source/Ranger_Operator_nZYtfaowY0EH3Z0R.json';
  const operator = holder([file], { system: { isMorphed: true, defenses: pass2Defenses() } });
  operator.flags = formFlags('Compendium.essence20.jump_through_time.Item.nZYtfaowY0EH3Z0R');
  ruleDerived(operator);
  expect(operator.system.defenses.evasion.total).toBe(13);
  expect(operator.system.defenses.toughness.total).toBe(14);
  const other = holder([file], { system: { isMorphed: true, defenses: pass2Defenses() } });
  other.flags = formFlags('Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1');
  ruleDerived(other);
  expect(other.system.defenses.evasion.total).toBe(11);
});

/* pass2-b: Transformers and Power Rangers leftovers from the tf2/tf3/pr1/pr3 slices. */

test('Siren: ↑2 Intimidation in Bot Mode, for a Cybertronian only', () => {
  const actor = holder(['tfcrbitems/_source/Siren_W0C7U2GimuTwHom5.json'], { system: { canTransform: true, isTransformed: false } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources[0]).toMatchObject({ shiftUp: 2, label: 'Siren' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  actor.system.isTransformed = true;
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  actor.system.isTransformed = false;
  actor.system.canTransform = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
});

test('Nose for Trouble: the search switch rolls Streetwise in place of Alertness', () => {
  const label = 'Searching for clues or traps (Nose for Trouble: roll Streetwise)';
  const actor = holder(['tfcrbitems/_source/Nose_for_Trouble_VUal4FUlNIrwo2MG.json'], {
    system: { skills: { alertness: { shift: 'd4' }, streetwise: { shift: 'd8' } } },
  });
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toContain(label);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).not.toContain(label);
  const switches = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });

  const only = name => {
    const result = { shiftUp: 0, shiftDown: 0, ext: { [switches.find(s => s.label == name).name]: true } };
    applyRuleSwitches(actor, result, { rolledSkill: 'alertness' });
    return result;
  };

  expect(only(label)).toMatchObject({ shiftUp: 2, shiftDown: 0 });
  actor.system.skills = { alertness: { shift: 'd8' }, streetwise: { shift: 'd2' } };
  expect(only(label)).toMatchObject({ shiftUp: 0, shiftDown: 3 });
});

test('Bullbar: Edge on a Ram in Alt Mode, shove immunity in Bot Mode', () => {
  const actor = holder(['tfcrbitems/_source/Bullbar_4Wfhy9VD0mMGgJbx.json'], { system: { canTransform: true, isTransformed: true } });
  const ram = { type: 'weaponEffect', system: { isRam: true } };
  expect(ruleRollSources(actor, null, { item: ram }).sources[0]).toMatchObject({ edge: true, label: 'Bullbar' });
  expect(ruleRollSources(actor, null, { item: { type: 'weaponEffect', system: {} } }).sources).toEqual([]);
  ruleDerived(actor);
  expect(actor.system.tf2ShoveImmune).toBeUndefined();
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { item: ram }).sources).toEqual([]);
  ruleDerived(actor);
  expect(actor.system.tf2ShoveImmune).toBe(1);
});

test('Roller Drum: +1 damage on a Ram against a Prone target in Alt Mode', () => {
  const ram = { type: 'weaponEffect', system: { isRam: true } };
  const previous = global.fromUuidSync;
  global.fromUuidSync = uuid => (uuid == 'Item.ram' ? ram : null);
  const actor = holder(['eocitems/_source/Roller_Drum_Hjo7mZ7eLs8EwKeu.json'], { system: { isTransformed: true } });
  const prone = { statuses: new Set(['prone']) };
  const notes = [];
  const tools = { damageBonusNote: (result, amount, label) => notes.push([amount, label]) };
  ruleDamageDealt(actor, prone, { damageValue: 2 }, { itemUuid: 'Item.ram', style: 'melee' }, tools);
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 2 }, { itemUuid: 'Item.ram', style: 'melee' }, tools);
  ruleDamageDealt(actor, prone, { damageValue: 2 }, { itemUuid: 'Item.other', style: 'melee' }, tools);
  actor.system.isTransformed = false;
  ruleDamageDealt(actor, prone, { damageValue: 2 }, { itemUuid: 'Item.ram', style: 'melee' }, tools);
  expect(notes).toEqual([[1, 'Roller Drum']]);
  global.fromUuidSync = previous;
});

test("Phantom Ranger Prime: Edge on a Grid Power's own roll while Morphed", () => {
  const actor = holder(['atsitems/_source/Phantom_Ranger_Prime_PHgWjT0syOOBOOK5.json'], { system: { isMorphed: true } });
  const grid = { type: 'power', system: { type: 'grid' } };
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: grid }).sources[0]).toMatchObject({ edge: true, label: 'Phantom Ranger Prime' });
  expect(switchNames(actor, { rolledSkill: 'might', item: grid })).toEqual([]);
  expect(ruleRollSources(actor, null, { item: { type: 'power', system: { type: 'sorcerous' } } }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'might' })).toHaveLength(1);
  actor.system.isMorphed = false;
  expect(ruleRollSources(actor, null, { item: grid }).sources).toEqual([]);
});

test('Personal Heirloom: the equipment switch only while no weapon is designated', () => {
  const actor = holder(['jttitems/_source/Personal_Heirloom_LQGOwXCGvKlL4pzl.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'technology' })).toMatchObject({ shiftUp: 1 });
  actor.flags = { essence20: { personalHeirloomItemId: 'w1' } };
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual([]);
});

test('Student: an Edge switch on non-attack tests, named for the subject', () => {
  const actor = holder(['prcrbitems/_source/Student_yfd8H0rGLNc91z6Y.json']);
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual(['About … (Student: Edge)']);
  actor.items.contents[0].flags = { essence20: { rules: { choices: { subject: 'Botany' } } } };
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual(['About Botany (Student: Edge)']);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ edge: true });
});

test('Not From Around Here (Hartunian): a ↓1 switch on non-attack tests, gone while Matured ignores it', () => {
  const actor = holder(['ttsgitems/_source/Not_From_Around_Here__Hartunian__3bgUuCYYabsjAIpU.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftDown: 1 });
  actor.items.contents[0].flags = { essence20: { maturedIgnored: true } };
  rebuildIndex(actor);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
});

test('The Returned: a Snag switch on Social and Smarts tests, gone while Matured ignores it', () => {
  const actor = holder(['ttsgitems/_source/The_Returned_47v7KeNqF1eg5aNx.json']);
  expect(switchNames(actor, { rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledEssence: 'smarts' })).toHaveLength(1);
  expect(switchNames(actor, { rolledEssence: 'strength' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ snag: true });
  actor.items.contents[0].flags = { essence20: { maturedIgnored: true } };
  rebuildIndex(actor);
  expect(switchNames(actor, { rolledEssence: 'social' })).toEqual([]);
});

/* Pass 2, batch pass2-a: My Little Pony, Night Vale and GI Joe items the first round skipped (mlp1, mlp2, gij1, gij2, gij3 slices; dice.mjs Expertise list). */

const pass2aChoose = (actor, choices) => {
  actor.items.contents[0].flags = { essence20: { rules: { choices } } };
};

test('Mastery Power: ↑1 on spells of the chosen tier and circle', () => {
  const actor = holder(['kocitems/_source/Mastery_Power_DyIbIDlzOJX5GiO2.json']);
  const cast = (circle, tier) => ({ item: { type: 'spell', system: { circle, tier } }, rolledSkill: 'spellcasting' });
  expect(ruleRollSources(actor, null, cast('beam', 'elementary')).sources).toEqual([]);
  pass2aChoose(actor, { circle: 'beam', tier: 'elementary' });
  expect(ruleRollSources(actor, null, cast('beam', 'elementary')).sources[0]).toMatchObject({ shiftUp: 1, label: 'Mastery Power (elementary beam spells: ↑1)' });
  expect(ruleRollSources(actor, null, cast('aid', 'elementary')).sources).toEqual([]);
  expect(ruleRollSources(actor, null, cast('beam', 'superior')).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'spellcasting' }).sources).toEqual([]);
});

test('Spell Focus: Edge when casting the focused spell only', () => {
  const actor = holder(['kocitems/_source/Spell_Focus_xNXlgRyE6Jpc4lnm.json']);
  const cast = (name, type = 'spell') => ({ item: { type, name, system: {} } });
  expect(ruleRollSources(actor, null, cast('Sonic Rainboom')).sources).toEqual([]);
  pass2aChoose(actor, { spell: 'Sonic Rainboom' });
  expect(ruleRollSources(actor, null, cast('Sonic Rainboom')).sources[0]).toMatchObject({ edge: true, label: 'Spell Focus (Sonic Rainboom: Edge)' });
  expect(ruleRollSources(actor, null, cast('Teleport')).sources).toEqual([]);
  expect(ruleRollSources(actor, null, cast('Sonic Rainboom', 'weaponEffect')).sources).toEqual([]);
});

test('Traveler: a ↑1 switch on Social tests once the place is named', () => {
  const actor = holder(['sotsitems/_source/Traveler_goE0NFHWUPhxjaq1.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
  pass2aChoose(actor, { place: 'Yakyakistan' });
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual(['Dealing with natives of Yakyakistan (Traveler: ↑1)']);
  expect(switchNames(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' }, { edge: true })).toMatchObject({ shiftUp: 1, shiftDown: 0, edge: true });
});

test('Means To An End: a ↑1 switch on the four chosen Means skills only', () => {
  const actor = holder(['iafav2items/_source/Means_To_An_End_llLxndbUKCtKIUMW.json']);
  pass2aChoose(actor, { strength: 'might', speed: 'finesse', smarts: 'technology', social: 'deception' });
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual(["Works toward the Syndicate's endgame (Means To An End: ↑1)"]);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'might' }, { shiftUp: 1 })).toMatchObject({ shiftUp: 2 });
});

test('Cover Job: ↑1 on its Skill, and a Specialized switch while not a combatant', () => {
  const actor = holder(['ccitems/_source/Cover_Job_3SiGvDR98s0FQtdf.json']);
  pass2aChoose(actor, { skill: 'persuasion', profession: 'Lawyer' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ shiftUp: 1, label: 'Cover Job (Lawyer: ↑1)' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual(['Relates to your profession, Lawyer (Cover Job: Specialized)']);
  expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ isSpecialized: true, shiftUp: 0 });
  actor.inCombat = true;
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
});

test('Double Life: an Edge + Specialized switch on its Skill', () => {
  const actor = holder(['ccitems/_source/Double_Life_Bl14FV81J88Um0Ls.json']);
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
  pass2aChoose(actor, { skill: 'science', spec: 'Chemistry' });
  expect(switchNames(actor, { rolledSkill: 'science' })).toEqual(['Had time to reach out, Chemistry (Double Life: Edge, Specialized)']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ shiftUp: 0, edge: true, isSpecialized: true });
});

test('Trade Experience: ignores the first ↓1 on its chosen Skill', () => {
  const actor = holder(['wtnvcgitems/_source/Trade_Experience_7PcR6dSWFjFcD7Uv.json']);
  actor.items.contents[0].system = { ...actor.items.contents[0].system, choice: 'science' };
  const roll = (rolledSkill, shiftDown) => {
    const options = { shiftDown };
    applyRuleImmunity(actor, options, { rolledSkill });
    return options.shiftDown;
  };

  expect(roll('science', 2)).toBe(1);
  expect(roll('science', 0)).toBe(0);
  expect(roll('technology', 2)).toBe(2);
});

test("Duck & Cover: whoever rolls against the holder gets a Snag switch for a trap's attack, never for an explosive", () => {
  const duck = holder(['gijcrbitems/_source/Duck___Cover_2R3saLtDCI1q2QBz.json']);
  const roller = holder([]);
  const weapon = style => ({ type: 'weaponEffect', system: { classification: { style } } });
  try {
    expect(switchNames(roller, { rolledSkill: 'targeting', item: weapon('projectile') })).toEqual([]);
    game.user.targets = new Set([{ actor: duck }]);
    expect(switchNames(roller, { rolledSkill: 'targeting', item: weapon('projectile') })).toEqual(["A trap's attack on a Duck & Cover holder (Snag)"]);
    expect(switchNames(roller, { rolledSkill: 'alertness' })).toHaveLength(1);
    expect(switchNames(roller, { rolledSkill: 'targeting', item: weapon('explosive') })).toEqual([]);
    expect(tick(roller, { rolledSkill: 'alertness' })).toMatchObject({ snag: true });
    expect(ruleRollSources(roller, duck, { rolledSkill: 'alertness' }).sources).toEqual([]);
  } finally {
    game.user.targets = new Set();
  }
});

/* Batch dice1: dice.mjs ids declared on lines 1-1278 - weapon-trait and unarmed upshifts, Specialization
   pre-fills, Snag immunity, incoming Snags and Zordbane's upshift. */

/** A weaponEffect whose parent weapon carries these traits. */
function dice1Effect(traits, style = 'melee') {
  const weapon = { id: 'w1', type: 'weapon', system: { traits } };
  return {
    type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { classification: { style } },
    parent: { items: { get: id => (id == 'w1' ? weapon : null) } },
  };
}

const dice1Unarmed = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } };

test('Explosives Expert: ↑1 on an explosive-style attack', () => {
  const actor = holder(['dditems/_source/Explosives_Expert_1bpnjPqatLJWMezp.json']);
  const effect = style => ({ type: 'weaponEffect', system: { classification: { skill: 'targeting', style } } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'targeting', item: effect('explosive') }).sources[0]).toMatchObject({ shiftUp: 1, label: 'Explosives Expert' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'targeting', item: effect('ranged') }).sources).toEqual([]);
  expect(ruleRollSources(holder([]), null, { rolledSkill: 'targeting', item: effect('explosive') }).sources).toEqual([]);
});

test('Fire Master: ↑1 on an attack dealing Fire damage', () => {
  const actor = holder(['iafav2items/_source/Fire_Master_jkqhVz3ahtRGqqya.json']);
  const effect = damageType => ({ type: 'weaponEffect', system: { classification: { skill: 'might', style: 'melee' }, damageType } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: effect('fire') }).sources[0]).toMatchObject({ shiftUp: 1, label: 'Fire Master' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: effect('blunt') }).sources).toEqual([]);
});

test('Randori Masters: ↑2 on an unarmed attack, nothing with a weapon', () => {
  const actor = holder(['iafav2items/_source/Randori_Masters_6sgDFv3TZjDf07ti.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: dice1Unarmed }).sources[0]).toMatchObject({ shiftUp: 2 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: dice1Effect(['martialArts']) }).sources).toEqual([]);
  expect(ruleRollSources(holder([]), null, { rolledSkill: 'might', item: dice1Unarmed }).sources).toEqual([]);
});

test('Martial Weapon Master: ↑1 with a Martial Arts weapon, ↓1 with any other, nothing unarmed', () => {
  const actor = holder(['iafav2items/_source/Martial_Weapon_Master_HZiYXNZOeFExJa4K.json']);
  const shifts = item => ruleRollSources(actor, null, { rolledSkill: 'might', item }).sources.map(s => [s.shiftUp, s.shiftDown]);
  expect(shifts(dice1Effect(['martialArts']))).toEqual([[1, 0]]);
  expect(shifts(dice1Effect(['ballistic']))).toEqual([[0, 1]]);
  expect(shifts(dice1Unarmed)).toEqual([]);
});

test('Walking Weapon Rack: Edge on a melee attack with a Silent Martial Arts weapon', () => {
  const actor = holder(['iafav2items/_source/Walking_Weapon_Rack_30iXcdh2zEhC9wVP.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'finesse', item: dice1Effect(['silent', 'martialArts']) }).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(actor, null, { rolledSkill: 'finesse', item: dice1Effect(['silent', 'martialArts'], 'ranged') }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'finesse', item: dice1Effect(['martialArts']) }).sources).toEqual([]);
});

test('Silent Weapon Expertise: ↑1 on an attack with a Silent weapon', () => {
  const actor = holder(['gijcrbitems/_source/Silent_Weapon_Expertise_JKn8mFG98ZzmiFSd.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', item: dice1Effect(['silent']) }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', item: dice1Effect(['ballistic']) }).sources).toEqual([]);
});

test('Silent Weapon Specialist: Specialized with a Silent weapon against a Surprised target', () => {
  const actor = holder(['iafav2items/_source/Silent_Weapon_Specialist_8spajNTT0nJVCvK5.json']);
  try {
    game.user.targets = new Set([{ actor: { statuses: new Set(['surprised']) } }]);
    expect(ruleSpecializes(actor, 'might', dice1Effect(['silent']))).toBe(true);
    expect(ruleSpecializes(actor, 'might', dice1Effect([]))).toBe(false);
    game.user.targets = new Set([{ actor: { statuses: new Set() } }]);
    expect(ruleSpecializes(actor, 'might', dice1Effect(['silent']))).toBe(false);
  } finally {
    game.user.targets = new Set();
  }
});

test('Warfighter: Specialized on a Targeting weapon attack', () => {
  const actor = holder(['gijcrbitems/_source/Warfighter_P0ZTAlcenVw2p4P1.json']);
  const effect = skill => ({ type: 'weaponEffect', system: { classification: { skill } } });
  expect(ruleSpecializes(actor, 'targeting', effect('targeting'))).toBe(true);
  expect(ruleSpecializes(actor, 'finesse', effect('finesse'))).toBe(false);
  expect(ruleSpecializes(actor, 'targeting', null)).toBe(false);
});

test('Negotiate: Specialized on Deception, Intimidation and Persuasion', () => {
  const actor = holder(['fgtaaitems/_source/Negotiate_Cfdtj0YtJoBGa1Yf.json']);
  for (const skill of ['deception', 'intimidation', 'persuasion']) {
    expect(ruleSpecializes(actor, skill)).toBe(true);
  }

  expect(ruleSpecializes(actor, 'athletics')).toBe(false);
  expect(ruleSpecializes(holder([]), 'persuasion')).toBe(false);
});

test('Quiet / First Contact: the final Snag is cleared on their Skills only', () => {
  const quiet = holder(['ghpfitems/_source/Quiet_oyybOYHfDdGS6dKr.json']);
  const firstContact = holder(['fgtaaitems/_source/First_Contact_4fo2uh4sAp1AeRgF.json']);
  const snagAfter = (actor, rolledSkill) => {
    const options = { snag: true };
    applyRuleImmunity(actor, options, { rolledSkill });
    return options.snag;
  };

  expect(snagAfter(quiet, 'infiltration')).toBe(false);
  expect(snagAfter(quiet, 'athletics')).toBe(true);
  for (const skill of ['deception', 'intimidation', 'persuasion']) {
    expect(snagAfter(firstContact, skill)).toBe(false);
  }

  expect(snagAfter(firstContact, 'athletics')).toBe(true);
  expect(snagAfter(holder([]), 'infiltration')).toBe(true);
});

test('Paranoia: attacks against the holder suffer a Snag', () => {
  const paranoid = holder(['gijcrbitems/_source/Paranoia_HG32BCzrF6Hsz7yR.json']);
  const roller = holder([]);
  const attack = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
  expect(ruleRollSources(roller, paranoid, { rolledSkill: 'might', item: attack }).sources[0]).toMatchObject({ snag: true, label: 'Paranoia' });
  expect(ruleRollSources(roller, paranoid, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { rolledSkill: 'might', item: attack }).sources).toEqual([]);
});

test('Duck & Cover: an explosive-style or area-trait attack against the holder suffers a Snag', () => {
  const duck = holder(['gijcrbitems/_source/Duck___Cover_2R3saLtDCI1q2QBz.json']);
  const roller = holder([]);
  const explosive = { type: 'weaponEffect', system: { classification: { style: 'explosive' } } };
  expect(ruleRollSources(roller, duck, { rolledSkill: 'targeting', item: explosive }).sources[0]).toMatchObject({ snag: true, label: 'Duck & Cover' });
  expect(ruleRollSources(roller, duck, { rolledSkill: 'targeting', item: dice1Effect(['area'], 'ranged') }).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(roller, duck, { rolledSkill: 'might', item: dice1Effect([]) }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { rolledSkill: 'targeting', item: explosive }).sources).toEqual([]);
});

test('Zordbane: ↑1 on an attack against a Zord', () => {
  const actor = holder(['fmmcitems/_source/Zordbane_SejEXXGz3edJ734e.json']);
  const zord = holder([]);
  zord.type = 'zord';
  const attack = { rolledSkill: 'might', item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } };
  expect(ruleRollSources(actor, zord, attack).sources[0]).toMatchObject({ shiftUp: 1, label: 'Zordbane' });
  expect(ruleRollSources(actor, holder([]), attack).sources).toEqual([]);
  expect(ruleRollSources(actor, zord, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

/* dice4: items from dice.mjs's own id table (its last stretch) moved to rules. */

/** A weapon on `actor` and one of its effects, for weapon: tags. */
function dice4Armed(actor, weaponSystem, effectSystem = {}) {
  const weapon = { id: `w${nextId++}`, type: 'weapon', flags: {}, system: weaponSystem };
  actor.items.contents.push(weapon);
  return { type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: weapon.id } }, system: { classification: { style: 'ranged' }, ...effectSystem } };
}

const dice4Ignored = (actor, ctx, options) => {
  applyRuleImmunity(actor, options, ctx);
  return options;
};

test('Cat Training: ignores the first ↓1 on Speed tests', () => {
  const actor = holder(['wtnvcgitems/_source/Cat_Training_T0pVW1q1T3n234rl.json']);
  expect(dice4Ignored(actor, { rolledSkill: 'finesse', rolledEssence: 'speed' }, { shiftDown: 2 }).shiftDown).toBe(1);
  expect(dice4Ignored(actor, { rolledSkill: 'finesse', rolledEssence: 'speed' }, { shiftDown: 0 }).shiftDown).toBe(0);
  expect(dice4Ignored(actor, { rolledSkill: 'might', rolledEssence: 'strength' }, { shiftDown: 2 }).shiftDown).toBe(2);
});

test('Writing Utensil: ignores the first ↓1 on Science and Technology tests', () => {
  const actor = holder(['wtnvcgitems/_source/Writing_Utensil_6iCU6NcJxHd9pM48.json']);
  expect(dice4Ignored(actor, { rolledSkill: 'science' }, { shiftDown: 2 }).shiftDown).toBe(1);
  expect(dice4Ignored(actor, { rolledSkill: 'technology' }, { shiftDown: 2 }).shiftDown).toBe(1);
  expect(dice4Ignored(actor, { rolledSkill: 'might' }, { shiftDown: 2 }).shiftDown).toBe(2);
});

test('Daredevil (Across the Stars): no Snag at exactly 1 Health', () => {
  const actor = holder(['atsitems/_source/Daredevil_jHyKgHS0yDNBEKjw.json'], { system: { health: { max: 10, value: 1 } } });
  expect(dice4Ignored(actor, { rolledSkill: 'culture' }, { snag: true }).snag).toBe(false);
  for (const value of [2, 0]) {
    actor.system.health.value = value;
    expect(dice4Ignored(actor, { rolledSkill: 'culture' }, { snag: true }).snag).toBe(true);
  }
});

test('Arctic Survival Training: no Snag on Survival', () => {
  const actor = holder(['ccitems/_source/Arctic_Survival_Training_1sbeyxcjtgGlBwHu.json']);
  expect(dice4Ignored(actor, { rolledSkill: 'survival' }, { snag: true }).snag).toBe(false);
  expect(dice4Ignored(actor, { rolledSkill: 'culture' }, { snag: true }).snag).toBe(true);
});

test('Pyromania: ↑ with a Fire weapon, ↓ with anything else, growing at 10th and 20th level', () => {
  const actor = holder(['ccitems/_source/Pyromania_gvpgK9oegrloYHcO.json'], { system: { level: 3 } });
  const fire = dice4Armed(actor, { traits: ['fire'] });
  const other = dice4Armed(actor, { traits: ['ballistic'] });
  const sources = item => ruleRollSources(actor, null, { rolledSkill: 'targeting', item }).sources;
  expect(sources(fire)).toEqual([expect.objectContaining({ label: 'Pyromania', shiftUp: 1, shiftDown: 0 })]);
  expect(sources(other)).toEqual([expect.objectContaining({ label: 'Pyromania', shiftUp: 0, shiftDown: 1 })]);
  expect(sources({ type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } })[0].shiftDown).toBe(1);
  actor.system.level = 10;
  expect(sources(fire)[0].shiftUp).toBe(2);
  expect(sources(other)[0].shiftDown).toBe(2);
  actor.system.level = 20;
  expect(sources(fire)[0].shiftUp).toBe(3);
  expect(sources(other)[0].shiftDown).toBe(3);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test("Super-Zeo Upgrade: ↑1 on the Zord's ranged attacks", () => {
  const zord = holder(['prcrbitems/_source/Upgraded_Zord__Super_Zeo_Upgrade__sAlfUDoEI9wPjqG2.json']);
  zord.type = 'zord';
  const attack = style => ({ type: 'weaponEffect', flags: {}, system: { classification: { style } } });
  expect(ruleRollSources(zord, null, { rolledSkill: 'targeting', item: attack('energy') }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(zord, null, { rolledSkill: 'might', item: attack('melee') }).sources).toEqual([]);
});

test('Shining Light: ranged attacks at the Zord have a Snag', () => {
  const zord = holder(['prcrbitems/_source/Ninja_Powered__Shining_Light__YZivdMV6wIhdrcKt.json']);
  zord.type = 'zord';
  const attacker = holder([]);
  const attack = style => ({ type: 'weaponEffect', flags: {}, system: { classification: { style } } });
  expect(ruleRollSources(attacker, zord, { rolledSkill: 'targeting', item: attack('projectile') }).sources[0]).toMatchObject({ snag: true, label: 'Shining Light' });
  expect(ruleRollSources(attacker, zord, { rolledSkill: 'might', item: attack('melee') }).sources).toEqual([]);
  expect(ruleRollSources(attacker, holder([]), { rolledSkill: 'targeting', item: attack('projectile') }).sources).toEqual([]);
});

test('Kung Fu Grip: Edge on a Grapple attack', () => {
  const actor = holder(['gijcrbitems/_source/Kung_Fu_Grip_H23M2NZ4YNRS5xJR.json']);
  const attack = damageType => ({ type: 'weaponEffect', flags: {}, system: { classification: { skill: 'might', style: 'melee' }, damageType } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: attack('grapple') }).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', item: attack('blunt') }).sources).toEqual([]);
});

test('Technostalgic: ↓1 attacking with a Prototype or Theoretical weapon', () => {
  const actor = holder(['qgtgitems/_source/Technostalgic_Gin9Zn2ASQXSO62K.json']);
  const sources = totalAvailability => ruleRollSources(actor, null, { rolledSkill: 'athletics', item: dice4Armed(actor, { totalAvailability }) }).sources;
  expect(sources('prototype')[0]).toMatchObject({ shiftDown: 1 });
  expect(sources('theoretical')[0]).toMatchObject({ shiftDown: 1 });
  expect(sources('standard')).toEqual([]);
});

test('Machine Link: ↓1 attacking with a Computerized weapon, and the same for anyone within 5 ft', () => {
  const actor = holder(['qgtgitems/_source/Machine_Link_9zI6CRYRHf31r3yU.json']);
  const sources = traits => ruleRollSources(actor, null, { rolledSkill: 'athletics', item: dice4Armed(actor, { traits }) }).sources;
  expect(sources(['computerized'])).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(sources([])).toEqual([]);
  expect(fromPack('qgtgitems/_source/Machine_Link_9zI6CRYRHf31r3yU.json').system.rules[1]).toMatchObject({ scope: 'aura', radius: 5, affects: 'all', stack: 'machineLink' });
});

test('Viral News Bloggers: Edge attacking a vehicle', () => {
  const actor = holder(['wtnvcgitems/_source/Viral_News_Bloggers_ORyWD8AKRIqo0jdS.json']);
  const attack = { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'targeting' } } };
  expect(ruleRollSources(actor, { type: 'vehicle' }, { rolledSkill: 'targeting', item: attack }).sources[0]).toMatchObject({ edge: true, label: 'Viral News Bloggers' });
  expect(ruleRollSources(actor, { type: 'playerCharacter' }, { rolledSkill: 'targeting', item: attack }).sources).toEqual([]);
  expect(ruleRollSources(actor, { type: 'vehicle' }, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test('Wow the Audience: three ↑1 switches on Performance, one per audience tier', () => {
  const actor = holder(['mlpcrbitems/_source/Wow_the_Audience_M7fLb600qXWY0dPm.json']);
  expect(switchNames(actor, { rolledSkill: 'performance' })).toHaveLength(3);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'performance' })).toMatchObject({ shiftUp: 3 });
});

/* dice.mjs, batch dice2: automatic roll modifiers moved out of rollSkill() and _getAutomaticCombatModifiers(). */

const dice2Weapon = (system = {}, flags = {}) => ({ type: 'weaponEffect', flags, system: { classification: { style: 'melee' }, ...system } });

test('Superior Athlete: an automatic ↑2 on Athletics', () => {
  const actor = holder(['gijcrbitems/_source/Superior_Athlete_C9HN9cz5Yxxb3jBj.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources[0]).toMatchObject({ shiftUp: 2, label: 'Superior Athlete' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'targeting' }).sources).toEqual([]);
});

test('Safecracker: an automatic ↑2 on Infiltration', () => {
  const actor = holder(['gijcrbitems/_source/Safecracker_bmvvsEyoylGTA9Ui.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ shiftUp: 2, label: 'Safecracker' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'targeting' }).sources).toEqual([]);
});

test('The Fiercest Among You: a Snag on Infiltration', () => {
  const actor = holder(['tfcrbitems/_source/The_Fiercest_Among_You_LZirSocExL40Ljya.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ snag: true, label: 'The Fiercest Among You' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test('Recruiter: Edge on Deception and Persuasion', () => {
  const actor = holder(['dditems/_source/Recruiter_vx3ZMblF2uv5qHJT.json']);
  for (const rolledSkill of ['deception', 'persuasion']) {
    expect(ruleRollSources(actor, null, { rolledSkill }).sources[0]).toMatchObject({ edge: true });
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Analytical: Science and Technology tests count as Specialized', () => {
  const actor = holder(['dditems/_source/Analytical_dOQdlIDhD9b84Fd2.json']);
  expect(ruleSpecializes(actor, 'science', null, {})).toBe(true);
  expect(ruleSpecializes(actor, 'technology', null, {})).toBe(true);
  expect(ruleSpecializes(actor, 'athletics', null, {})).toBe(false);
});

test.each([
  ['Zeal', 'ttsgitems/_source/Zeal_s68pRzqIk5ApctTd.json'],
  ['"Oh, What Now?"', 'prcrbitems/_source/_Oh__What_Now___FauecjTdfhdnz7n9.json'],
])('%s: Psychic attacks against the holder get a Snag', (label, file) => {
  const target = holder([file]);
  const roller = holder([]);
  expect(ruleRollSources(roller, target, { item: dice2Weapon({ damageType: 'psychic' }) }).sources[0]).toMatchObject({ snag: true, label });
  expect(ruleRollSources(roller, target, { item: dice2Weapon({ damageType: 'blunt' }) }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { item: dice2Weapon({ damageType: 'psychic' }) }).sources).toEqual([]);
});

test('Arrogant Outrage: attacks against the holder\'s Willpower or Cleverness get a Snag', () => {
  const target = holder(['dditems/_source/Arrogant_Outrage_DBAddEts3iTLrF3V.json']);
  const roller = holder([]);
  for (const defenseType of ['willpower', 'cleverness']) {
    expect(ruleRollSources(roller, target, { item: dice2Weapon({ defenseType }) }).sources[0]).toMatchObject({ snag: true, label: 'Arrogant Outrage' });
  }

  expect(ruleRollSources(roller, target, { item: dice2Weapon({ defenseType: 'toughness' }) }).sources).toEqual([]);
});

test('No Mercy!: Edge attacking a Frightened, Impaired or Stunned target', () => {
  const actor = holder(['dditems/_source/No_Mercy__GenOc3hpdcMT3pnD.json']);
  for (const status of ['frightened', 'impaired', 'stunned']) {
    expect(ruleRollSources(actor, holder([], { statuses: [status] }), { item: dice2Weapon() }).sources[0]).toMatchObject({ edge: true, label: 'No Mercy!' });
  }

  expect(ruleRollSources(actor, holder([], { statuses: ['deafened'] }), { item: dice2Weapon() }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: dice2Weapon() }).sources).toEqual([]);
});

test('Get Low: ↑1 Infiltration in Alt Mode, and ranged attacks against the holder in Alt Mode get ↓2', () => {
  const actor = holder(['tsitems/_source/Get_Low_rEoZEFQR2puQxpIW.json'], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'acrobatics' }).sources).toEqual([]);
  const roller = holder([]);
  expect(ruleRollSources(roller, actor, { item: dice2Weapon({ classification: { style: 'ranged' } }) }).sources[0]).toMatchObject({ shiftDown: 2, label: 'Get Low' });
  expect(ruleRollSources(roller, actor, { item: dice2Weapon() }).sources).toEqual([]);
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  expect(ruleRollSources(roller, actor, { item: dice2Weapon({ classification: { style: 'ranged' } }) }).sources).toEqual([]);
});

test('Prehensile Feet: ↑1 Acrobatics in Alt Mode', () => {
  const actor = holder(['tsitems/_source/Prehensile_Feet_OdHMLgny9aqCevAc.json'], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'acrobatics' }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'acrobatics' }).sources).toEqual([]);
});

test('Sprinter (Transformers One): ↑1 Acrobatics and Athletics in Bot Mode', () => {
  const actor = holder(['tf1sitems/_source/Sprinter_gbDY8UiTgSNZHPAo.json'], { system: { isTransformed: false } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'acrobatics' }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources).toEqual([]);
  actor.system.isTransformed = true;
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Hail Megatron!: ↑1 Infiltration in Alt Mode', () => {
  const actor = holder(['dditems/_source/Hail_Megatron__3IHBbGOucL4eAFAA.json'], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources[0]).toMatchObject({ shiftUp: 1 });
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
});

test('Daredevil: ↑2 Driving in Alt Mode', () => {
  const actor = holder(['tfcrbitems/_source/Daredevil_8GgFGdlmri0GyKNI.json'], { system: { isTransformed: true } });
  expect(ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources[0]).toMatchObject({ shiftUp: 2 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  actor.system.isTransformed = false;
  expect(ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources).toEqual([]);
});

test('Wait For An Opening: Edge on attacks made on someone else\'s turn', () => {
  const actor = holder(['tfcrbitems/_source/Wait_For_An_Opening_rNfhpfJU5rb2m1M3.json']);
  const turn = id => ({ started: true, combatant: { actor: { id } } });
  expect(ruleRollSources(actor, null, { item: dice2Weapon(), combat: turn('someoneElse') }).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(actor, null, { item: dice2Weapon(), combat: turn(actor.id) }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: dice2Weapon(), combat: null }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness', combat: turn('someoneElse') }).sources).toEqual([]);
});

test('Contingency Shot: Edge on a ranged attack against Toughness made on someone else\'s turn', () => {
  const actor = holder(['prcrbitems/_source/Contingency_Shot_DAqOZsEq03rJWWQo.json']);
  const turn = id => ({ started: true, combatant: { actor: { id } } });
  const ranged = defenseType => dice2Weapon({ classification: { style: 'ranged' }, defenseType });
  expect(ruleRollSources(actor, null, { item: ranged('toughness'), combat: turn('someoneElse') }).sources[0]).toMatchObject({ edge: true, label: 'Contingency Shot' });
  expect(ruleRollSources(actor, null, { item: ranged('evasion'), combat: turn('someoneElse') }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: ranged('toughness'), combat: turn(actor.id) }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: ranged('toughness'), combat: null }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ defenseType: 'toughness' }), combat: turn('someoneElse') }).sources).toEqual([]);
});

test('Barrel Through: ↑1 on Maneuver attacks', () => {
  const actor = holder(['tfcrbitems/_source/Barrel_Through_uyhMkYlTF9tfoVGC.json']);
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ damageType: 'maneuver' }) }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ damageType: 'blunt' }) }).sources).toEqual([]);
});

const dice2BeastOfBurden = { id: 'bob', name: 'Beast of Burden', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.8m5s0JxTNSMU9zcj' } }, system: {} };

test('Wrestler: ↑2 on Maneuver attacks, only alongside Beast of Burden', () => {
  const actor = holder(['sssitems/_source/Wrestler_ro5hMv4XMhOmANao.json']);
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ damageType: 'maneuver' }) }).sources).toEqual([]);
  actor.items.contents.push({ ...dice2BeastOfBurden, parent: actor });
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ damageType: 'maneuver' }) }).sources[0]).toMatchObject({ shiftUp: 2 });
  expect(ruleRollSources(actor, null, { item: dice2Weapon({ damageType: 'blunt' }) }).sources).toEqual([]);
});

test('Overwhelming: ↑2 with a Signature Weapon, only alongside Beast of Burden', () => {
  const actor = holder(['ccitems/_source/Overwhelming_ki6d30m9O5ij5ggm.json']);
  actor.items.contents.push(
    { id: 'sig', name: 'Close Combat Heavy Blade', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.PFuzUrcYw14JRLf9' } }, system: {}, parent: actor },
    { id: 'other', name: 'Other Weapon', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.other' } }, system: {}, parent: actor },
  );
  const attack = parentId => ({ ...dice2Weapon({}, { essence20: { parentId } }), parent: actor });
  expect(ruleRollSources(actor, null, { item: attack('sig') }).sources).toEqual([]);
  actor.items.contents.push({ ...dice2BeastOfBurden, parent: actor });
  expect(ruleRollSources(actor, null, { item: attack('sig') }).sources[0]).toMatchObject({ shiftUp: 2 });
  expect(ruleRollSources(actor, null, { item: attack('other') }).sources).toEqual([]);
});

test('Acute (Sense) (PR CRB): Edge on Alertness, listed once however many senses are taken', () => {
  const actor = holder(['prcrbitems/_source/Acute__Sense__qKoTBo1FKzCq1qTt.json', 'prcrbitems/_source/Acute__Sense__qKoTBo1FKzCq1qTt.json']);
  for (const item of actor.items.contents) {
    item.flags = { core: { sourceId: 'Compendium.essence20.pr_crb.Item.qKoTBo1FKzCq1qTt' } };
  }

  rebuildIndex(actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Acute (Sense)' })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test('Acute Sense (GI JOE): Edge on Alertness too', () => {
  const actor = holder(['gijcrbitems/_source/Acute_Sense_WvjGJ5AcC0z07d0J.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ edge: true, label: 'Acute Sense' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('Experiment: the "technology" option gives Edge on Technology', () => {
  const actor = holder(['tfcrbitems/_source/Experiment_EcSOADOOb3PZMolz.json']);
  const perk = actor.items.contents[0];
  perk.system = { ...perk.system, choice: 'technology' };
  expect(ruleRollSources(actor, null, { rolledSkill: 'technology' }).sources[0]).toMatchObject({ edge: true, label: 'Experiment' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
  perk.system = { ...perk.system, choice: 'shove' };
  expect(ruleRollSources(actor, null, { rolledSkill: 'technology' }).sources).toEqual([]);
});

/* dice.mjs, batch dice2b: reciprocal rules on targeted Skill Tests (rule sources now reach non-attack rolls). */

test.each([
  ['Indomitable', 'tfcrbitems/_source/Indomitable_CXnb6i4d7XhkhFNr.json', 'intimidation', 'persuasion', { snag: true }],
  ['Keep Your Cool', 'jttitems/_source/Keep_Your_Cool_566NsnD5dccg9uVo.json', 'intimidation', 'persuasion', { snag: true }],
  ['The Glory of Cobra-La', 'fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json', 'intimidation', 'persuasion', { snag: true }],
  ['Easy In, Easy Out', 'dditems/_source/Easy_In__Easy_Out_N36G5U8c8HSX3e9c.json', 'alertness', 'infiltration', { snag: true }],
  ['Escapist', 'fgtaaitems/_source/Escapist_6QqvqJJRBHUbkTeS.json', 'deception', 'persuasion', { edge: true }],
  ['Escapist', 'fgtaaitems/_source/Escapist_CFZxr28F7FRZwluj.json', 'persuasion', 'deception', { snag: true }],
  ["I Don't Get It", 'dditems/_source/I_Don_t_Get_It_jivhlSMGRJBGhXM2.json', 'persuasion', 'alertness', { edge: true }],
  ["I Don't Get It", 'dditems/_source/I_Don_t_Get_It_jivhlSMGRJBGhXM2.json', 'deception', 'intimidation', { edge: true }],
])('%s: Skill Tests targeting the holder', (label, file, skill, other, mods) => {
  const target = holder([file]);
  const roller = holder([]);
  expect(ruleRollSources(roller, target, { rolledSkill: skill }).sources).toEqual([expect.objectContaining({ label, ...mods })]);
  expect(ruleRollSources(roller, target, { rolledSkill: other }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { rolledSkill: skill }).sources).toEqual([]);
});

test('Word of Unicron: ↓2 on Persuasion/Deception against the holder, unless the roller follows Unicron too', () => {
  const target = holder(['dditems/_source/Word_of_Unicron_liMchvrumE1wB8Rc.json']);
  const roller = holder([]);
  for (const rolledSkill of ['persuasion', 'deception']) {
    expect(ruleRollSources(roller, target, { rolledSkill }).sources[0]).toMatchObject({ shiftDown: 2, label: 'Word of Unicron' });
  }

  expect(ruleRollSources(roller, target, { rolledSkill: 'alertness' }).sources).toEqual([]);
  roller.items.contents.push({ id: 'wou', name: 'Word of Unicron', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.liMchvrumE1wB8Rc' } }, system: {}, parent: roller });
  expect(ruleRollSources(roller, target, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

/* dice4b: the dice4 items that waited on targeted non-attack rolls reaching rule sources. */

const dice4bSources = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources;

/** Runs `fn` with a started combat. */
function dice4bInCombat(fn) {
  const before = game.combat;
  game.combat = { started: true, round: 1 };
  try {
    fn();
  } finally {
    game.combat = before;
  }
}

test('Barista Experience: ↑2 on Smarts and Social tests', () => {
  const actor = holder(['wtnvcgitems/_source/Barista_Experience_jKWyWKHb8iDwQvB4.json']);
  expect(dice4bSources(actor, { rolledSkill: 'culture', rolledEssence: 'smarts' })[0]).toMatchObject({ shiftUp: 2 });
  expect(dice4bSources(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' }, holder([]))[0]).toMatchObject({ shiftUp: 2 });
  expect(dice4bSources(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
});

test('Desperate: Edge on every test at exactly 1 Health', () => {
  const actor = holder(['ccitems/_source/Desperate_RfjdqScdCbMgGESR.json'], { system: { health: { max: 10, value: 1 } } });
  expect(dice4bSources(actor, { rolledSkill: 'culture' })[0]).toMatchObject({ edge: true });
  for (const value of [2, 0]) {
    actor.system.health.value = value;
    expect(dice4bSources(actor, { rolledSkill: 'culture' })).toEqual([]);
  }
});

test("Violent (Hang-Up): ↓1 in combat on anything that doesn't deal damage", () => {
  const actor = holder(['ccitems/_source/Violent_medt2A5ndPfu8SIy.json']);
  const attack = damageValue => ({ type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' }, damageValue } });
  expect(dice4bSources(actor, { rolledSkill: 'culture' })).toEqual([]);
  dice4bInCombat(() => {
    expect(dice4bSources(actor, { rolledSkill: 'culture' })[0]).toMatchObject({ shiftDown: 1 });
    expect(dice4bSources(actor, { rolledSkill: 'might', item: attack(0) })[0]).toMatchObject({ shiftDown: 1 });
    expect(dice4bSources(actor, { rolledSkill: 'might', item: attack(2) })).toEqual([]);
  });
});

test.each([
  ['ccitems/_source/Indoctrinated_BctKHzpCC1XXoJPg.json', ['intimidation', 'persuasion'], 'deception', { snag: true }],
  ['ccitems/_source/Indoctrinated_ggsVevfXdHhZwlAm.json', ['deception'], 'persuasion', { edge: true }],
  ['ccitems/_source/Villainous_IKtCNZtKHqs7DIQh.json', ['intimidation'], 'persuasion', { shiftUp: 1 }],
  ['wtnvcgitems/_source/Jittery_1JiWfGVVLpYsNuTM.json', ['infiltration'], 'alertness', { edge: true }],
  ['ccitems/_source/Faceless_63f4lC7RmuQbQll8.json', ['alertness'], 'infiltration', { snag: true }],
  ['ccitems/_source/Unscrupulous_QJ1Uw4VZxy3zrxa1.json', ['deception', 'intimidation', 'persuasion'], 'culture', { snag: true }],
])('%s: whoever rolls the listed Skills against the holder is changed', (file, skills, other, change) => {
  const target = holder([file]);
  const roller = holder([]);
  for (const rolledSkill of skills) {
    expect(dice4bSources(roller, { rolledSkill }, target)[0]).toMatchObject(change);
    expect(dice4bSources(target, { rolledSkill })).toEqual([]);
  }

  expect(dice4bSources(roller, { rolledSkill: other }, target)).toEqual([]);
});

test('Cobra Battle School Graduate: ↑1 on non-attack Smarts tests in combat', () => {
  const actor = holder(['ccitems/_source/Cobra_Battle_School_Graduate_sjTaAtlasorkFzPU.json']);
  expect(dice4bSources(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  dice4bInCombat(() => {
    expect(dice4bSources(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })[0]).toMatchObject({ shiftUp: 1 });
    expect(dice4bSources(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
    expect(dice4bSources(actor, { rolledSkill: 'targeting', rolledEssence: 'smarts', item: { type: 'weaponEffect', flags: {}, system: { classification: {} } } })).toEqual([]);
  });
});

test('ID the Outdoors: Edge on Science, Persuasion and Deception', () => {
  const actor = holder(['kocitems/_source/ID_the_Outdoors_O7JuVYJXdMX1V1LI.json']);
  for (const rolledSkill of ['science', 'persuasion', 'deception']) {
    expect(dice4bSources(actor, { rolledSkill })[0]).toMatchObject({ edge: true });
  }

  expect(dice4bSources(actor, { rolledSkill: 'might' })).toEqual([]);
});

test('Cutie Mark Perk: ↑1 on the chosen Skill', () => {
  const actor = holder(['mlpcrbitems/_source/Cutie_Mark_Perk_j4U7F2wEqNJzJnI7.json']);
  actor.items.contents[0].system.choice = 'alertness';
  expect(dice4bSources(actor, { rolledSkill: 'alertness' })[0]).toMatchObject({ shiftUp: 1 });
  expect(dice4bSources(actor, { rolledSkill: 'might' })).toEqual([]);
});

test('Community Helper: Edge on the chosen Skill, not on a Brawn attack', () => {
  const actor = holder(['prcrbitems/_source/Community_Helper_6CnhyT0WBSFHwVGq.json']);
  actor.items.contents[0].system.choice = 'brawn';
  expect(dice4bSources(actor, { rolledSkill: 'brawn' })[0]).toMatchObject({ edge: true });
  expect(dice4bSources(actor, { rolledSkill: 'brawn', item: { type: 'weaponEffect', flags: {}, system: { classification: {} } } })).toEqual([]);
  actor.items.contents[0].system.choice = 'alertness';
  expect(dice4bSources(actor, { rolledSkill: 'alertness' })[0]).toMatchObject({ edge: true });
  expect(dice4bSources(actor, { rolledSkill: 'science' })).toEqual([]);
});

test('Sea Legs: Edge on Athletics', () => {
  const actor = holder(['gijcrbitems/_source/Sea_Legs_9Pp44hFLlC4EvMg8.json']);
  expect(dice4bSources(actor, { rolledSkill: 'athletics' })[0]).toMatchObject({ edge: true });
  expect(dice4bSources(actor, { rolledSkill: 'might' })).toEqual([]);
});

test('Specialist: Edge on the chosen Skill outside combat', () => {
  const actor = holder(['gijcrbitems/_source/Specialist_yOpGmmCvVaIYZf29.json']);
  actor.items.contents[0].system.choice = 'persuasion';
  expect(dice4bSources(actor, { rolledSkill: 'persuasion' })[0]).toMatchObject({ edge: true });
  expect(dice4bSources(actor, { rolledSkill: 'athletics' })).toEqual([]);
  dice4bInCombat(() => expect(dice4bSources(actor, { rolledSkill: 'persuasion' })).toEqual([]));
});

test('Rocket Scientist: Edge on the chosen Science or Technology outside combat', () => {
  const actor = holder(['qgtgitems/_source/Rocket_Scientist_sxqOocGC7KwHc3kb.json']);
  actor.items.contents[0].system.choice = 'science';
  expect(dice4bSources(actor, { rolledSkill: 'science' })[0]).toMatchObject({ edge: true });
  dice4bInCombat(() => expect(dice4bSources(actor, { rolledSkill: 'science' })).toEqual([]));
  actor.items.contents[0].system.choice = 'alertness';
  expect(dice4bSources(actor, { rolledSkill: 'alertness' })).toEqual([]);
});

test('Rocket Scientist (Hang-Up): a Snag on Science or Technology in combat, used up once per encounter', () => {
  const actor = holder(['qgtgitems/_source/Rocket_Scientist_ZDdczxlbVPY9leZz.json']);
  expect(dice4bSources(actor, { rolledSkill: 'science' })).toEqual([]);
  dice4bInCombat(() => {
    const { sources, consumes } = ruleRollSources(actor, null, { rolledSkill: 'technology' });
    expect(sources[0]).toMatchObject({ snag: true });
    expect(consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit' })]);
    expect(dice4bSources(actor, { rolledSkill: 'alertness' })).toEqual([]);
  });
});

test('Leadfoot: a Snag on Alertness while not driving', () => {
  const actor = holder(['qgtgitems/_source/Leadfoot_gFYCwicMMwjKQ9fx.json']);
  expect(dice4bSources(actor, { rolledSkill: 'alertness' })[0]).toMatchObject({ snag: true });
  expect(dice4bSources(actor, { rolledSkill: 'driving' })).toEqual([]);
});

test.each([
  ['atsitems/_source/Augment__Skill__nVFdInysWe2qMqye.json'],
  ['bthitems/_source/I_ve_Done_My_Research_JE59xgHb7NxEV9AZ.json'],
])('%s: ↑1 on each copy\'s chosen Skill, never more than ↑1', file => {
  const actor = holder([file, file, file]);
  ['science', 'technology', 'science'].forEach((choice, i) => {
    actor.items.contents[i].system.choice = choice;
  });
  expect(dice4bSources(actor, { rolledSkill: 'science' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice4bSources(actor, { rolledSkill: 'technology' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice4bSources(actor, { rolledSkill: 'alertness' })).toEqual([]);
});

test('Rescue Response: ↑1 on Science and Technology while Morphed', () => {
  const actor = holder(['atsitems/_source/Rescue_Response_ItgDxIGNlVYzjiEe.json'], { system: { isMorphed: true } });
  expect(dice4bSources(actor, { rolledSkill: 'science' })[0]).toMatchObject({ shiftUp: 1 });
  expect(dice4bSources(actor, { rolledSkill: 'technology' })[0]).toMatchObject({ shiftUp: 1 });
  expect(dice4bSources(actor, { rolledSkill: 'culture' })).toEqual([]);
  actor.system.isMorphed = false;
  expect(dice4bSources(actor, { rolledSkill: 'science' })).toEqual([]);
});

test('Gold Ranger Prime: Edge on Strength tests while Morphed', () => {
  const actor = holder(['atsitems/_source/Gold_Ranger_Prime_jVRapLGSt8yVHL9n.json'], { system: { isMorphed: true } });
  expect(dice4bSources(actor, { rolledSkill: 'might', rolledEssence: 'strength' })[0]).toMatchObject({ edge: true });
  expect(dice4bSources(actor, { rolledSkill: 'culture', rolledEssence: 'smarts' })).toEqual([]);
  actor.system.isMorphed = false;
  expect(dice4bSources(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
});

test.each([
  ['bthitems/_source/Crowdpleaser_NAHl1KsVXc12h3i3.json'],
  ['mlpcrbitems/_source/Out_of_Touch_GjOvI88JglH8yukq.json'],
])('%s: a Snag on the first non-Performance test of the mission', file => {
  const actor = holder([file]);
  const { sources, consumes } = ruleRollSources(actor, null, { rolledSkill: 'alertness' });
  expect(sources[0]).toMatchObject({ snag: true });
  expect(consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit' })]);
  expect(dice4bSources(actor, { rolledSkill: 'performance' })).toEqual([]);
  expect(fromPack(file).system.rules[0].limit).toEqual({ per: 'mission', key: 'crowdpleaserHangUp' });
});

test('Fearsome Reputation: ↑2 on Intimidation while Morphed', () => {
  const actor = holder(['prcrbitems/_source/Fearsome_Reputation_ofiEt8uFPgovBvLQ.json'], { system: { isMorphed: true } });
  expect(dice4bSources(actor, { rolledSkill: 'intimidation' })[0]).toMatchObject({ shiftUp: 2 });
  expect(dice4bSources(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  actor.system.isMorphed = false;
  expect(dice4bSources(actor, { rolledSkill: 'intimidation' })).toEqual([]);
});

/* Batch dice3: dice.mjs perks declared on lines 2469-3491 - automatic shifts, Edges, Snags and immunities. */

const dice3Sources = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources;
const dice3Attack = (system = {}, flags = {}) => ({ item: { type: 'weaponEffect', flags, system: { classification: { style: 'melee' }, ...system } } });
const dice3Choose = (actor, choice) => {
  actor.items.contents[0].system = { ...actor.items.contents[0].system, choice };
  return actor;
};

test('Powerful Grip: ↑1 on a Grapple attack, and ↑1 on Brawn in Bot Mode only', () => {
  const file = 'tf1sitems/_source/Powerful_Grip_nJ4hF4Oa2m8SvMJX.json';
  const bot = holder([file], { system: { isTransformed: false } });
  const alt = holder([file], { system: { isTransformed: true } });
  expect(dice3Sources(alt, { rolledSkill: 'athletics', ...dice3Attack({ damageType: 'grapple' }) })).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Powerful Grip' })]);
  expect(dice3Sources(alt, { rolledSkill: 'athletics', ...dice3Attack({ damageType: 'blunt' }) })).toEqual([]);
  expect(dice3Sources(bot, { rolledSkill: 'brawn' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(alt, { rolledSkill: 'brawn' })).toEqual([]);
  expect(dice3Sources(holder([]), { rolledSkill: 'brawn' })).toEqual([]);
});

test('Dutiful: Persuasion against the holder takes a Snag; its own Social tests get ↑1 outside combat', () => {
  const dutiful = holder(['tf1sitems/_source/Dutiful_330YD4FFwbHyJOE8.json']);
  const roller = holder([]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, dutiful)).toEqual([expect.objectContaining({ snag: true, label: 'Dutiful' })]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, dutiful)).toEqual([]);
  expect(dice3Sources(dutiful, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(dutiful, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  game.combat = { started: true };
  try {
    expect(dice3Sources(dutiful, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
  } finally {
    game.combat = null;
  }
});

test('Durabyllium Super-Alloy: Blunt, Cold and Fire attacks against the holder take ↓1', () => {
  const alloy = holder(['tfcrbitems/_source/Durabyllium_Super_Alloy_Q9DWZNwPe66ewBuG.json']);
  const roller = holder([]);
  for (const damageType of ['blunt', 'cold', 'fire']) {
    expect(dice3Sources(roller, dice3Attack({ damageType }), alloy)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  }

  expect(dice3Sources(roller, dice3Attack({ damageType: 'sharp' }), alloy)).toEqual([]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, alloy)).toEqual([]);
  expect(dice3Sources(roller, dice3Attack({ damageType: 'fire' }), holder([]))).toEqual([]);
});

test.each([
  ['dditems/_source/Fear_My_Name_FgKFLD6anmWXFwPU.json', ['intimidation', 'persuasion'], 'wealth'],
  ['jttitems/_source/Inheritance_hWJG8i1UQvneAtIG.json', ['wealth'], 'culture'],
  ['mlpcrbitems/_source/Bits_To_Spare_lGYdVH8RWletaWyB.json', ['wealth'], 'alertness'],
  ['jttitems/_source/Profiteer_KPAgV7R7zsP6ts5Q.json', ['wealth'], 'alertness'],
  ['mlpcrbitems/_source/Truthseeker_NtbQt7wwCYdrUxhL.json', ['alertness'], 'wealth'],
  ['atsitems/_source/Xeno_Location_Study_lT1xJuxw29luNgUj.json', ['culture'], 'wealth'],
  ['dsoeitems/_source/Camouflage_Hide_PuMnUtkl1eZ0HmY7.json', ['infiltration'], 'alertness'],
  ['wtnvcgitems/_source/See_Something__Say_Nothing_v3EUjzeDcIA9B4FL.json', ['streetwise'], 'persuasion'],
])('%s: an automatic Edge on its own Skills only', (file, skills, other) => {
  const actor = holder([file]);
  for (const rolledSkill of skills) {
    expect(dice3Sources(actor, { rolledSkill })).toEqual([expect.objectContaining({ edge: true, label: actor.items.contents[0].name })]);
  }

  expect(dice3Sources(actor, { rolledSkill: other })).toEqual([]);
  expect(dice3Sources(holder([]), { rolledSkill: skills[0] })).toEqual([]);
});

test('Search and Seizure: Edge on Alertness and Infiltration outside combat only', () => {
  const actor = holder(['fffav1items/_source/Search_and_Seizure_qZiv0m6kc4G9HYEn.json']);
  expect(dice3Sources(actor, { rolledSkill: 'alertness' })).toEqual([expect.objectContaining({ edge: true })]);
  expect(dice3Sources(actor, { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ edge: true })]);
  expect(dice3Sources(actor, { rolledSkill: 'culture' })).toEqual([]);
  game.combat = { started: true };
  try {
    expect(dice3Sources(actor, { rolledSkill: 'alertness' })).toEqual([]);
  } finally {
    game.combat = null;
  }
});

test('Keen Eye: ↑1 on Smarts and Social tests', () => {
  const actor = holder(['wtnvcgitems/_source/Keen_Eye_CoKVBoZljMYhQbCW.json']);
  expect(dice3Sources(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(actor, { rolledSkill: 'athletics', rolledEssence: 'strength' })).toEqual([]);
});

test.each([
  ['mlpcrbitems/_source/Awesome_3NN8lJZNwu9w6LBR.json', { shiftUp: 1 }],
  ['mlpcrbitems/_source/Totally_Awesome_p5OzN7RY2DUPxVKv.json', { shiftUp: 1 }],
  ['sotsitems/_source/Noble_Heritage_77GZdVfPFDG6P1e6.json', { shiftUp: 1 }],
  ['ttsgitems/_source/Eltarian_Observer_gciLJWb6a60uMXNT.json', { edge: true }],
])('%s: on the chosen Skill only', (file, change) => {
  const actor = holder([file]);
  expect(dice3Sources(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  dice3Choose(actor, 'persuasion');
  expect(dice3Sources(actor, { rolledSkill: 'persuasion' })).toEqual([expect.objectContaining(change)]);
  expect(dice3Sources(actor, { rolledSkill: 'deception' })).toEqual([]);
});

test('Awesome and Totally Awesome on the same Skill stack to ↑2', () => {
  const actor = holder(['mlpcrbitems/_source/Awesome_3NN8lJZNwu9w6LBR.json', 'mlpcrbitems/_source/Totally_Awesome_p5OzN7RY2DUPxVKv.json']);
  for (const item of actor.items.contents) {
    item.system = { ...item.system, choice: 'persuasion' };
  }

  const sources = dice3Sources(actor, { rolledSkill: 'persuasion' });
  expect(sources.reduce((sum, source) => sum + source.shiftUp, 0)).toBe(2);
});

test('Prankster: Edge on Social tests against a Surprised target', () => {
  const prankster = holder(['mlpcrbitems/_source/Prankster_smilN3d0rTCK7XHt.json']);
  const surprised = holder([], { statuses: ['surprised'] });
  expect(dice3Sources(prankster, { rolledSkill: 'persuasion', rolledEssence: 'social' }, surprised)).toEqual([expect.objectContaining({ edge: true })]);
  expect(dice3Sources(prankster, { rolledSkill: 'persuasion', rolledEssence: 'social' }, holder([]))).toEqual([]);
  expect(dice3Sources(prankster, { rolledSkill: 'science', rolledEssence: 'smarts' }, surprised)).toEqual([]);
  expect(dice3Sources(prankster, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
});

test('Ambush Prone: attacks against the holder get Edge while it is Surprised', () => {
  const file = 'mlpcrbitems/_source/Ambush_Prone_k4gjxfSo6BkE6wd0.json';
  const roller = holder([]);
  expect(dice3Sources(roller, dice3Attack(), holder([file], { statuses: ['surprised'] }))).toEqual([expect.objectContaining({ edge: true, label: 'Ambush Prone' })]);
  expect(dice3Sources(roller, dice3Attack(), holder([file]))).toEqual([]);
  expect(dice3Sources(roller, dice3Attack(), holder([], { statuses: ['surprised'] }))).toEqual([]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion', rolledEssence: 'social' }, holder([file], { statuses: ['surprised'] }))).toEqual([]);
});

test('Reckless Driving: ↑1 on Ram attacks', () => {
  const actor = holder(['dditems/_source/Reckless_Driving_PPP3Zm8cYiduQEC1.json']);
  expect(dice3Sources(actor, dice3Attack({ isRam: true }))).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(actor, dice3Attack())).toEqual([]);
});

test('Skeptic: Deception against the Influence holder takes a Snag; Persuasion against the Hang-Up holder gets Edge', () => {
  const influence = holder(['fgtaaitems/_source/Skeptic_vb1L2oi4xiWkD5ZF.json']);
  const hangUp = holder(['fgtaaitems/_source/Skeptic_gUrBCm0G8ntInUar.json']);
  const roller = holder([]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, influence)).toEqual([expect.objectContaining({ snag: true })]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, influence)).toEqual([]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, hangUp)).toEqual([expect.objectContaining({ edge: true })]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, hangUp)).toEqual([]);
});

test('Biogenetic: Edge in Alt Mode, ↑1 in Bot Mode, on Infiltration and Persuasion', () => {
  const file = 'tsitems/_source/Biogenetic_OA6xYj6axivOD38i.json';
  expect(dice3Sources(holder([file], { system: { isTransformed: true } }), { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ edge: true, shiftUp: 0 })]);
  expect(dice3Sources(holder([file], { system: { isTransformed: false } }), { rolledSkill: 'persuasion' })).toEqual([expect.objectContaining({ edge: false, shiftUp: 1 })]);
  expect(dice3Sources(holder([file]), { rolledSkill: 'persuasion' })).toEqual([]);
  expect(dice3Sources(holder([file], { system: { isTransformed: true } }), { rolledSkill: 'culture' })).toEqual([]);
});

test('Sky Warrior: ↑1 on every attack, listed so it can be unticked', () => {
  const actor = holder(['sotsitems/_source/Sky_Warrior_rHFtc9mok8t9ZubI.json']);
  expect(dice3Sources(actor, dice3Attack())).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Sky Warrior' })]);
  expect(dice3Sources(actor, { rolledSkill: 'athletics' })).toEqual([]);
});

test('Merit Badges: never a Snag on the chosen Skill', () => {
  const actor = dice3Choose(holder(['wtnvcgitems/_source/Merit_Badges_nTwviKh1ND0jGVvr.json']), 'science');
  const roll = rolledSkill => {
    const options = { snag: true };
    applyRuleImmunity(actor, options, { rolledSkill });
    return options.snag;
  };

  expect(roll('science')).toBe(false);
  expect(roll('technology')).toBe(true);
});

test('Community Martial Arts: ↑1 on unarmed melee attacks only', () => {
  const actor = holder(['wtnvcgitems/_source/Community_Martial_Arts_uY9wPJH31z5kAtdB.json']);
  expect(dice3Sources(actor, dice3Attack())).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(actor, dice3Attack({ classification: { style: 'projectile' } }))).toEqual([]);
  expect(dice3Sources(actor, dice3Attack({}, { essence20: { parentId: 'w1' } }))).toEqual([]);
});

test('Skepticism / See Something, Say Nothing: Weird (and Persuasion/Deception) against the holder take ↓1', () => {
  const skeptic = holder(['wtnvcgitems/_source/Skepticism_46O2TMRbIOL6OJq9.json']);
  const quiet = holder(['wtnvcgitems/_source/See_Something__Say_Nothing_v3EUjzeDcIA9B4FL.json']);
  const roller = holder([]);
  expect(dice3Sources(roller, { rolledSkill: 'weird' }, skeptic)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, skeptic)).toEqual([]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, quiet)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, quiet)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(dice3Sources(roller, { rolledSkill: 'weird' }, quiet)).toEqual([]);
});

test('Kill Your Double: Edge attacking a target trained in Weird', () => {
  const actor = holder(['wtnvcgitems/_source/Kill_Your_Double_dbknbG5RGOz0VTzO.json']);
  const weird = shift => holder([], { system: { skills: { weird: { shift } } } });
  expect(dice3Sources(actor, dice3Attack(), weird('d6'))).toEqual([expect.objectContaining({ edge: true })]);
  expect(dice3Sources(actor, dice3Attack(), weird('d20'))).toEqual([]);
  expect(dice3Sources(actor, dice3Attack(), holder([]))).toEqual([]);
  expect(dice3Sources(actor, { rolledSkill: 'persuasion' }, weird('d6'))).toEqual([]);
});

test('Mercantile Store: ignores the first ↓1 on Wealth tests', () => {
  const actor = holder(['wtnvcgitems/_source/Mercantile_Store_aP7MMWqiINdM5vlg.json']);
  const roll = (rolledSkill, shiftDown) => {
    const options = { shiftDown };
    applyRuleImmunity(actor, options, { rolledSkill });
    return options.shiftDown;
  };

  expect(roll('wealth', 2)).toBe(1);
  expect(roll('wealth', 0)).toBe(0);
  expect(roll('culture', 2)).toBe(2);
});

test('Stubbornly Loyal / Area Awareness: Deception (and Infiltration) against the holder take a Snag', () => {
  const loyal = holder(['mlpcrbitems/_source/Stubbornly_Loyal_zqsFMIRKaA0Ev62Y.json']);
  const aware = holder(['dditems/_source/Area_Awareness_cf2zIWdlulvGmRU5.json']);
  const roller = holder([]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, loyal)).toEqual([expect.objectContaining({ snag: true, label: 'Stubbornly Loyal' })]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, loyal)).toEqual([]);
  expect(dice3Sources(roller, { rolledSkill: 'deception' }, aware)).toEqual([expect.objectContaining({ snag: true })]);
  expect(dice3Sources(roller, { rolledSkill: 'infiltration' }, aware)).toEqual([expect.objectContaining({ snag: true })]);
  expect(dice3Sources(roller, { rolledSkill: 'persuasion' }, aware)).toEqual([]);
});

test('Hard Tread Wheels: ↑1 on Ram attacks in Alt Mode, ↑1 on Athletics in Bot Mode', () => {
  const file = 'eocitems/_source/Hard_Tread_Wheels_ia0rEwWo5WP1zH58.json';
  const alt = holder([file], { system: { isTransformed: true } });
  const bot = holder([file], { system: { isTransformed: false } });
  expect(dice3Sources(alt, dice3Attack({ isRam: true }))).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(bot, dice3Attack({ isRam: true }))).toEqual([]);
  expect(dice3Sources(bot, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(dice3Sources(alt, { rolledSkill: 'athletics' })).toEqual([]);
});

/* actor: derived-data Perks from documents/actor.mjs (Personal Power Supply, Fireproof, Mind Palace, Overprotective Upgrade). */

test('Personal Power Supply: a pool of 1 + 1 per 5 levels and +2 regeneration, added on top', () => {
  const file = 'fgtaaitems/_source/Personal_Power_Supply_Uy3t5KLbeGHv08ho.json';
  const pool = (max = 0, regeneration = 0) => ({ powers: { personal: { max, regeneration, value: 0 } } });
  const first = holder([file], { system: { level: 1, ...pool() } });
  ruleDerived(first);
  expect(first.system.powers.personal).toMatchObject({ max: 1, regeneration: 2 });
  const sixth = holder([file], { system: { level: 6, ...pool() } });
  ruleDerived(sixth);
  expect(sixth.system.powers.personal.max).toBe(2);
  const boosted = holder([file], { system: { level: 1, ...pool(3, 1) } });
  ruleDerived(boosted);
  expect(boosted.system.powers.personal).toMatchObject({ max: 4, regeneration: 3 });
  const without = holder([], { system: { level: 1, ...pool() } });
  ruleDerived(without);
  expect(without.system.powers.personal).toMatchObject({ max: 0, regeneration: 0 });
});

test('Fireproof: Fire Resistance, and Fire Immunity from 10th level, for Player Characters', () => {
  const file = 'ccitems/_source/Fireproof_gaOLMFlImcLRmQV0.json';
  const make = (level, extra = {}) => holder([file], { system: { level, resistances: {}, immunities: {}, ...extra } });
  const third = make(3);
  ruleDerived(third);
  expect(third.system.resistances.fire).toBeTruthy();
  expect(third.system.immunities.fire).toBeUndefined();
  const tenth = make(10);
  ruleDerived(tenth);
  expect(tenth.system.resistances.fire).toBeTruthy();
  expect(tenth.system.immunities.fire).toBeTruthy();
  const npc = make(10);
  npc.type = 'npc';
  ruleDerived(npc);
  expect(npc.system.resistances.fire).toBeUndefined();
  const without = holder([], { system: { level: 10, resistances: {}, immunities: {} } });
  ruleDerived(without);
  expect(without.system.resistances.fire).toBeUndefined();
  const already = make(3, { immunities: { fire: true } });
  ruleDerived(already);
  expect(already.system.immunities.fire).toBeTruthy();
});

test('Mind Palace: +1/+2/+3 Willpower at 5th/11th/17th level', () => {
  const file = 'mlpcrbitems/_source/Mind_Palace_UVFsgco1AMzgZ595.json';
  const willpower = level => {
    const actor = holder([file], { system: { level, defenses: pass2Defenses() } });
    ruleDerived(actor);
    return actor.system.defenses.willpower.total;
  };

  expect(willpower(4)).toBe(10);
  expect(willpower(5)).toBe(11);
  expect(willpower(10)).toBe(11);
  expect(willpower(11)).toBe(12);
  expect(willpower(16)).toBe(12);
  expect(willpower(17)).toBe(13);
  expect(willpower(20)).toBe(13);
  const without = holder([], { system: { level: 20, defenses: pass2Defenses() } });
  ruleDerived(without);
  expect(without.system.defenses.willpower.total).toBe(10);
});

test("Overprotective Upgrade: the Zord's driver gets +2 Willpower and Cleverness", () => {
  const zord = holder(['jttitems/_source/Upgraded_Zord__Overprotective_Upgrade__oQL3yYlWvKQNZlJC.json']);
  const driver = holder([], { system: { defenses: pass2Defenses() } });
  const rider = holder([], { system: { defenses: pass2Defenses() } });
  const pet = holder([], { system: { defenses: pass2Defenses() } });
  Object.assign(zord, { type: 'zord', uuid: 'Actor.overZord' });
  driver.uuid = 'Actor.overDriver';
  rider.uuid = 'Actor.overRider';
  Object.assign(pet, { type: 'companion', uuid: 'Actor.overPet' });
  zord.system.actors = { a: { uuid: driver.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid, vehicleRole: 'passenger' } };
  game.actors = { contents: [driver, rider, pet, zord] };
  ruleDerived(driver);
  ruleDerived(rider);
  expect(driver.system.defenses).toMatchObject({ willpower: { total: 12 }, cleverness: { total: 12 }, toughness: { total: 12 }, evasion: { total: 11 } });
  expect(rider.system.defenses).toMatchObject({ willpower: { total: 10 }, cleverness: { total: 10 } });
  zord.system.actors = { a: { uuid: pet.uuid, vehicleRole: 'driver' } };
  ruleDerived(pet);
  expect(pet.system.defenses.willpower.total).toBe(10);
  game.actors = undefined;
});
// dialogs batch: plain Roll Options Dialog checkboxes moved to DialogSwitch rules

test('Machinist: an Edge switch on any roll', () => {
  const actor = holder(['tfcrbitems/_source/Machinist_14SqA7pgjDcFyQVd.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual(['Repairing or upgrading Cybertronian tech (Machinist: Edge)']);
  expect(tick(actor, {})).toMatchObject({ edge: true });
});

test('Bootlicker (Decepticon Directive): a ↑1 switch on any roll', () => {
  const actor = holder(['dditems/_source/Bootlicker_e0nwsw9VKBlZHZJ0.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(switchNames(actor, { item: { type: 'weaponEffect', system: {} } })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ shiftUp: 1 });
});

test('Good Society: a ↑1 switch on any roll', () => {
  const actor = holder(['sotsitems/_source/Good_Society_qWaxxg2HDskKvD2k.json']);
  expect(switchNames(actor, { rolledSkill: 'culture' })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ shiftUp: 1 });
});

test('Tongues: an Edge switch on any roll', () => {
  const actor = holder(['tfcrbitems/_source/Tongues_B2VtEwa627p0TGo3.json']);
  expect(switchNames(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ edge: true });
});

test("Hunter's Prowess: a ↑1 switch on any roll", () => {
  const actor = holder(['tsitems/_source/Hunter_s_Prowess_hUB8IRdRucRToty2.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ shiftUp: 1 });
});

test('Cube Player: a ↑1 switch on any roll, off unless ticked', () => {
  const actor = holder(['tfcrbitems/_source/Cube_Player_gfd6fjOPXEbggsAx.json']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(ruleDialogSwitches(actor, {})[0].value).toBe(false);
  expect(tick(actor, {})).toMatchObject({ shiftUp: 1 });
});

test('Wealth: an Edge switch on Social tests only', () => {
  const actor = holder(['mlpcrbitems/_source/Wealth_pIr3i3UOGxYTGAMh.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'athletics', rolledEssence: 'strength' })).toEqual([]);
  expect(tick(actor, { rolledEssence: 'social' })).toMatchObject({ edge: true });
});

test('Beast of Burden: a ↑2 switch on Might rolls only', () => {
  const actor = holder(['gijcrbitems/_source/Beast_of_Burden_8m5s0JxTNSMU9zcj.json']);
  expect(switchNames(actor, { rolledSkill: 'might' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'might' })).toMatchObject({ shiftUp: 2 });
});

test('Charge: a ↑1 switch on Might weapon attacks only', () => {
  const actor = holder(['tfcrbitems/_source/Charge_l5TPdusi8cQJESfp.json']);
  const might = { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'might', style: 'melee' } } };
  const targeting = { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'targeting', style: 'ranged' } } };
  expect(switchNames(actor, { rolledSkill: 'might', item: might })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: targeting })).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'might' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'might', item: might })).toMatchObject({ shiftUp: 1 });
});


/* Wheel Struggle (a Hang-Up the old Perk-only lookup never found) */

test('Wheel Struggle: Snag while riding in a vehicle someone else drives', () => {
  const actor = holder(['mlpcrbitems/_source/Wheel_Struggle_veMhcO6X5AHQym5H.json']);
  actor.uuid = 'Actor.wheelRider';
  const cart = (role) => ({ type: 'vehicle', system: { actors: { a: { uuid: 'Actor.wheelRider', vehicleRole: role } } } });
  global.game.actors = { contents: [cart('passenger')] };
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources[0]).toMatchObject({ snag: true });
  global.game.actors = { contents: [cart('driver')] };
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  global.game.actors = { contents: [] };
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  delete global.game.actors;
});
// dialogs2 batch: All-Around Vision (a nanomite power, so the old perk-only checkbox never showed)
test('All-Around Vision: a ↑2 switch on Alertness tests', () => {
  const actor = holder(['qgtgitems/_source/All_Around_Vision_uj9MrbSdm0CABElw.json']);
  expect(switchNames(actor, { rolledSkill: 'alertness' })).toEqual(['Someone is trying to surprise you (All-Around Vision: ↑2)']);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'alertness' })).toMatchObject({ shiftUp: 2 });
});

/* Riders batch: per-target roll modifiers and Defense riders (helpers/target-riders.mjs), damage reductions (helpers/combat.mjs). */

/** A non-player creature with these creature tags. */
function creature(tags, type = 'npc') {
  const actor = holder([]);
  actor.type = type;
  actor.system.creatureTags = tags;
  return actor;
}

const anAttack = (system = {}) => ({ item: { type: 'weaponEffect', system, flags: {} }, isAttack: true });

test('Grid Champion: ↑1 on attacks against Putties and Tengas', () => {
  const actor = holder(['prcrbitems/_source/Grid_Champion_92oS4wTZvjDCpnkg.json']);
  expect(ruleRollSources(actor, creature('putty'), anAttack()).sources[0]).toMatchObject({ shiftUp: 1, label: 'Grid Champion' });
  expect(ruleRollSources(actor, Object.assign(creature(''), { name: 'Tenga Warrior' }), anAttack()).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(ruleRollSources(actor, creature('robot'), anAttack()).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('putty'), { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, anAttack()).sources).toEqual([]);
});

test('Bot-Hunter: ↑1 against mechanical Threats, +1 Defense against robotic ones', () => {
  const actor = holder(['jttitems/_source/Bot_Hunter_aG0STSzCZ2fBP1td.json']);
  expect(ruleRollSources(actor, creature('vehicle'), { rolledSkill: 'technology' }).sources[0]).toMatchObject({ shiftUp: 1, label: 'Bot-Hunter' });
  expect(ruleRollSources(actor, creature('robot', 'playerCharacter'), { rolledSkill: 'technology' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('alien'), { rolledSkill: 'technology' }).sources).toEqual([]);
  expect(ruleDefenseAdjust(creature('robot'), actor, 'toughness', {})).toBe(1);
  expect(ruleDefenseAdjust(creature('android'), actor, 'willpower', {})).toBe(1);
  expect(ruleDefenseAdjust(creature('computerized'), actor, 'toughness', {})).toBe(0);
  expect(ruleDefenseAdjust(creature('robot', 'playerCharacter'), actor, 'toughness', {})).toBe(0);
});

test('Frag It: area attacks against the holder take a Snag', () => {
  const target = holder(['qgtgitems/_source/Frag_It_epppqB70RpfXJ1jN.json']);
  const roller = holder([]);
  expect(ruleRollSources(roller, target, anAttack({ radius: 10 })).sources[0]).toMatchObject({ snag: true, label: 'Frag It' });
  expect(ruleRollSources(roller, target, anAttack({ shape: 'cone' })).sources[0]).toMatchObject({ snag: true });
  expect(ruleRollSources(roller, target, anAttack()).sources).toEqual([]);
});

test('Tough Enough: a non-attack effect against the holder\'s Toughness takes a Snag', () => {
  const target = holder(['gijcrbitems/_source/Tough_Enough_RoIa80w6EAZR0uFP.json']);
  const roller = holder([]);
  const effect = defenseType => ({ item: { type: 'spell', system: { defenseType }, flags: {} }, isAttack: false });
  expect(ruleRollSources(roller, target, effect('toughness')).sources[0]).toMatchObject({ snag: true, label: 'Tough Enough' });
  expect(ruleRollSources(roller, target, effect('evasion')).sources).toEqual([]);
  expect(ruleRollSources(roller, target, { ...anAttack({ defenseType: 'toughness' }) }).sources).toEqual([]);
});

test('Earth Defenders: Edge on Smarts and Social tests against non-humans', () => {
  const actor = holder(['fgtaaitems/_source/Earth_Defenders_pfP58nZasclFYAVk.json']);
  expect(ruleRollSources(actor, creature('alien'), { rolledEssence: 'social' }).sources[0]).toMatchObject({ edge: true, label: 'Earth Defenders' });
  expect(ruleRollSources(actor, creature('robot'), { rolledEssence: 'smarts' }).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(actor, creature(''), { rolledEssence: 'social' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('alien, human'), { rolledEssence: 'social' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('alien'), { rolledEssence: 'strength' }).sources).toEqual([]);
});

test('Air Supply: attacks with an inhaled poison against the wearer take a Snag', () => {
  const target = holder(['ccitems/_source/Air_Supply_cMrM3qohf3piKARy.json']);
  const roller = holder([]);
  const poison = (application) => {
    const weapon = { id: 'gas', type: 'weapon', system: { isPoison: true, poisonApplication: { [application]: true } } };
    roller.items.contents.splice(0, roller.items.contents.length, weapon);
    return { item: { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'gas' } }, parent: roller }, isAttack: true };
  };

  expect(ruleRollSources(roller, target, poison('inhaled')).sources[0]).toMatchObject({ snag: true, label: 'Air Supply' });
  expect(ruleRollSources(roller, target, poison('contact')).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), poison('inhaled')).sources).toEqual([]);
});

test('Machinist Revolutionary: Edge to find, ↑1 on Smarts and Social against the Machine Empire', () => {
  const actor = holder(['atsitems/_source/Machinist_Revolutionary_lTSqgs1rT4TF3ZWS.json']);
  const empire = creature('machine empire');
  expect(ruleRollSources(actor, empire, { rolledSkill: 'streetwise' }).sources).toEqual([expect.objectContaining({ edge: true }), expect.objectContaining({ shiftUp: 1 })]);
  expect(ruleRollSources(actor, empire, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Machinist Revolutionary' })]);
  expect(ruleRollSources(actor, empire, { rolledSkill: 'science', rolledEssence: 'smarts' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(ruleRollSources(actor, empire, { rolledSkill: 'athletics', rolledEssence: 'strength' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('robot'), { rolledSkill: 'alertness' }).sources).toEqual([]);
});

test('Monster Hunter: Edge on Survival against a non-humanoid that isn\'t a machine', () => {
  const actor = holder(['atsitems/_source/Monster_Hunter_L0ACKSFo5szl9qTL.json']);
  expect(ruleRollSources(actor, creature('monster'), { rolledSkill: 'survival' }).sources[0]).toMatchObject({ edge: true, label: 'Monster Hunter' });
  expect(ruleRollSources(actor, creature('monster, robot'), { rolledSkill: 'survival' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('alien'), { rolledSkill: 'survival' }).sources).toEqual([]);
  expect(ruleRollSources(actor, creature('monster'), { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Knock, Knock!: Sharp damage taken is 1 less, never below 0', () => {
  const actor = holder(['tsitems/_source/Knock__Knock__KihkWHZ1lwLfcwk0.json']);
  expect(ruleDamageTaken(actor, 3, 'sharp')).toBe(2);
  expect(ruleDamageTaken(actor, 1, 'sharp')).toBe(0);
  expect(ruleDamageTaken(actor, 3, 'blunt')).toBe(3);
  expect(ruleDamageTaken(holder([]), 3, 'sharp')).toBe(3);
});

test('Stone Warlord: all damage taken is 1 less in Monster Form', () => {
  const actor = holder(['fmmcitems/_source/Stone_Warlord_QlFNI9fQZXqO5N2J.json']);
  actor.flags = { essence20: { monsterFormActive: true } };
  expect(ruleDamageTaken(actor, 3, 'poison')).toBe(2);
  expect(ruleDamageTaken(actor, 0, 'poison')).toBe(0);
  actor.flags.essence20.monsterFormActive = false;
  expect(ruleDamageTaken(actor, 3, 'poison')).toBe(3);
});

test('Frost Warlord: Energy damage taken is 2 less in Monster Form', () => {
  const actor = holder(['fmmcitems/_source/Frost_Warlord_iFHlsLgUvmlT8cMK.json']);
  actor.flags = { essence20: { monsterFormActive: true } };
  expect(ruleDamageTaken(actor, 3, 'cold')).toBe(1);
  expect(ruleDamageTaken(actor, 3, 'element')).toBe(1);
  expect(ruleDamageTaken(actor, 3, 'blunt')).toBe(3);
  actor.flags.essence20.monsterFormActive = false;
  expect(ruleDamageTaken(actor, 3, 'cold')).toBe(3);
});

/* actions slice (helpers/action-perks.mjs COST_RULES): cheaper actions moved to ActionCost rules. */

async function actionCosts(files, ctx, options) {
  const { costRulesFor } = await import('./actions.mjs');
  return costRulesFor(holder(files, options)).filter(rule => rule.matches(ctx));
}

test('Superior Athlete: one Sprint per turn is a Free action', async () => {
  const [rule, more] = await actionCosts(['gijcrbitems/_source/Superior_Athlete_C9HN9cz5Yxxb3jBj.json'], { key: 'sprint' });
  expect(more).toBeUndefined();
  expect(rule).toMatchObject({ label: 'Superior Athlete', limit: { window: 'turn', max: 1 } });
  expect(rule.ask).toBeUndefined();
  expect(rule.to()).toBe('free');
  expect(await actionCosts(['gijcrbitems/_source/Superior_Athlete_C9HN9cz5Yxxb3jBj.json'], { key: 'hide' })).toEqual([]);
});

test('Follow The Leader, Canny Combatant, Good Example, Favorite Person: asked or automatic discounts', async () => {
  const [follow] = await actionCosts(['gijcrbitems/_source/Follow_The_Leader_Ksv6Zqg1Km3Gx4iu.json'], { key: 'sprint' });
  expect(follow).toMatchObject({ ask: 'E20.ActionPerkAskTeammateAhead' });
  expect(follow.limit).toBeUndefined();
  expect(follow.to()).toBe('free');

  const [canny] = await actionCosts(['kocitems/_source/Canny_Combatant_Yk2CE81sRx24gtXl.json'], { key: 'defend' });
  expect(canny).toMatchObject({ ask: 'E20.ActionPerkAskTwoFree' });
  expect(canny.to()).toBe('twoFree');

  const [example] = await actionCosts(['mlpcrbitems/_source/Good_Example_TQE5h6CYfvO6zOvH.json'], { key: 'lendAssistance' });
  expect(example).toMatchObject({ ask: 'E20.ActionPerkAskPersuasion' });
  expect(example.to()).toBe('free');

  const [person] = await actionCosts(['wtnvcgitems/_source/Favorite_Person_6pLg6eMITF2y6k9s.json'], { key: 'lendAssistance' });
  expect(person.ask).toBeUndefined();
  expect(person.to()).toBe('free');
});

test('Contingency discounts: Vigilance, Not Getting Away That Easy, Overwatch, Make An Opening, Opportunist', async () => {
  const ctx = { key: 'contingency' };
  for (const file of ['gijcrbitems/_source/Vigilance_H7qXtrSfxDx2z9Wk.json', 'gijcrbitems/_source/Not_Getting_Away_That_Easy_bWJGPyaTU2OPw34y.json']) {
    const [rule] = await actionCosts([file], ctx);
    expect(rule).toMatchObject({ ask: 'E20.ActionPerkAskContingencyAttack' });
    expect(rule.to()).toBe('free');
  }

  const [overwatch] = await actionCosts(['gijcrbitems/_source/Overwatch_YXn7VKSgEXGigNtV.json'], ctx);
  expect(overwatch).toMatchObject({ limit: { window: 'turn', max: 1 } });
  expect(overwatch.ask).toBeUndefined();
  expect(overwatch.to()).toBe('none');

  const [opening] = await actionCosts(['tfcrbitems/_source/Make_An_Opening_aSJP1DXIH2ZaQbQa.json'], ctx);
  expect(opening).toMatchObject({ ask: 'E20.ActionPerkAskContingencyAttack', limit: { window: 'turn', max: 1 } });
  expect(opening.to()).toBe('free');

  const [opportunist] = await actionCosts(['eocitems/_source/Opportunist_eKrqFE4vv1PInOZz.json'], ctx);
  expect(opportunist).toMatchObject({ ask: 'E20.ActionPerkAskInitiative', limit: { window: 'encounter', max: 1 } });
  expect(opportunist.to()).toBe('none');
  expect(await actionCosts(['eocitems/_source/Opportunist_eKrqFE4vv1PInOZz.json'], { key: 'defend' })).toEqual([]);
});

test("Strategize / Leader in Crisis: Free Contingencies up to Smarts / Social each turn", async () => {
  const essences = { essences: { smarts: { value: 3 }, social: { value: 2 } } };
  const [strategize] = await actionCosts(['tfcrbitems/_source/Strategize_Gvh0iaxbcohFtYGe.json'], { key: 'contingency' }, { system: essences });
  expect(strategize).toMatchObject({ limit: { window: 'turn', max: 3 } });
  expect(strategize.to()).toBe('free');
  const [crisis] = await actionCosts(['wtnvcgitems/_source/Leader_in_Crisis_ly70FgOnHG7IrM1A.json'], { key: 'contingency' }, { system: essences });
  expect(crisis).toMatchObject({ limit: { window: 'turn', max: 2 } });
});

test('Tight Bond commands the pet as a Free action once per turn, plus one per 3 levels past 3rd', async () => {
  const file = 'gijcrbitems/_source/TIght_Bond_92993RGDPLq08u1D.json';
  const [atNine] = await actionCosts([file], { key: 'commandPet' }, { system: { level: 9 } });
  expect(atNine).toMatchObject({ limit: { window: 'turn', max: 3 } });
  expect(atNine.to()).toBe('free');
  const [atThree] = await actionCosts([file], { key: 'commandPet' }, { system: { level: 3 } });
  expect(atThree.limit.max).toBe(1);
});

test('New Herd, Favorite Command, Biscuit Factory: pet commands and pet attacks as Move actions', async () => {
  const [herd] = await actionCosts(['wtnvcgitems/_source/New_Herd_zwm8CrmmYvMj3bMc.json'], { key: 'commandPet' });
  expect(herd.ask).toBeUndefined();
  expect(herd.to()).toBe('move');
  const [favorite] = await actionCosts(['wtnvcgitems/_source/Favorite_Command_GeHPKfuWe24HpYcQ.json'], { key: 'commandPet' });
  expect(favorite).toMatchObject({ ask: 'E20.ActionPerkAskFavoriteCommand' });
  expect(favorite.to()).toBe('move');
  const [biscuit] = await actionCosts(['wtnvcgitems/_source/Biscuit_Factory_0f9ZSctK20tO99Wt.json'], { kind: 'attack' });
  expect(biscuit.to()).toBe('move');
  expect(await actionCosts(['wtnvcgitems/_source/Biscuit_Factory_0f9ZSctK20tO99Wt.json'], { kind: 'item' })).toEqual([]);
});

test('Quick Draw, Heavy Holster, Hold The Line, Sustained Fire, Forward Grip: Free draws, shields and braces', async () => {
  const [draw] = await actionCosts(['tfcrbitems/_source/Quick_Draw_p8DTLro2sc2kPYQl.json'], { key: 'drawWeapon' });
  expect(draw.ask).toBeUndefined();
  expect(draw.to()).toBe('free');
  const [holster] = await actionCosts(['ccitems/_source/Heavy_Holster_F3L7eF2c07G2B12o.json'], { key: 'drawWeapon' });
  expect(holster).toMatchObject({ ask: 'E20.ActionPerkAskMediumWeapon' });
  expect(holster.to()).toBe('free');
  const [shield] = await actionCosts(['ccitems/_source/Hold_The_Line_uU6Q6JPWc3GMRffE.json'], { kind: 'shieldToggle' });
  expect(shield.to()).toBe('free');
  for (const file of ['ccitems/_source/Sustained_Fire_PE6UeC7BcKIg5peF.json', 'qgtgitems/_source/Forward_Grip_0cgWEY00pB4zLD5z.json']) {
    const [brace] = await actionCosts([file], { key: 'brace' });
    expect(brace.to()).toBe('free');
  }
});

test('Quick Change: any copy offers one asked Free conversion, never one per copy', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const ids = ['pgWBzR5IRAhucHzo', 'vNbbACKhZhbz9T54', 'Sng7P5DkHMPlxBtq', 'vWK0nmeks2SLUEze'];
  const files = ['Quick_Change_pgWBzR5IRAhucHzo', 'Quick_Change_vNbbACKhZhbz9T54', 'Quick_Change_II_Sng7P5DkHMPlxBtq', 'Quick_Change_III_vWK0nmeks2SLUEze']
    .map(name => `tfcrbitems/_source/${name}.json`);
  const sourcedHolder = list => {
    const actor = holder(list.map(i => files[i]));
    actor.items.contents.forEach((item, n) => {
      item.flags = { core: { sourceId: `Compendium.essence20.tf_crb.Item.${ids[list[n]]}` } };
    });
    return actor;
  };

  for (const i of [0, 1, 2, 3]) {
    const offers = costRulesFor(sourcedHolder([i])).filter(rule => rule.matches({ kind: 'conversion' }));
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ ask: 'E20.ActionPerkAskQuickChange' });
    expect(offers[0].to()).toBe('free');
  }

  expect(costRulesFor(sourcedHolder([0, 1, 2, 3])).filter(rule => rule.matches({ kind: 'conversion' }))).toHaveLength(1);
  expect(costRulesFor(sourcedHolder([2, 3])).filter(rule => rule.matches({ kind: 'conversion' }))).toHaveLength(1);
});

test("This Is For Me and Dead Man's Switch: attacks made cheaper, asked, only with the right attack", async () => {
  const unarmed = { type: 'weaponEffect', flags: { essence20: { parentId: null } }, system: {} };
  const armed = { type: 'weaponEffect', flags: { essence20: { parentId: 'gun' } }, system: {} };
  const [mine] = await actionCosts(['sssitems/_source/This_Is_For_Me_rbgupnDh25Pij5Gp.json'], { kind: 'attack', item: unarmed });
  expect(mine).toMatchObject({ ask: 'E20.ActionPerkAskThisIsForMe' });
  expect(mine.to()).toBe('move');
  expect(await actionCosts(['sssitems/_source/This_Is_For_Me_rbgupnDh25Pij5Gp.json'], { kind: 'attack', item: armed })).toEqual([]);

  const bomb = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'explosive' } } };
  const shot = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } };
  const [detonate] = await actionCosts(['gijcrbitems/_source/Dead_Man_s_Switch_Qwg8WPHHJ1Cl8M8m.json'], { kind: 'attack', item: bomb });
  expect(detonate).toMatchObject({ ask: 'E20.ActionPerkAskDetonate' });
  expect(detonate.to()).toBe('free');
  expect(await actionCosts(['gijcrbitems/_source/Dead_Man_s_Switch_Qwg8WPHHJ1Cl8M8m.json'], { kind: 'attack', item: shot })).toEqual([]);
});

test('Stealthy Misdirection and Shogun Upgrade: cheaper Defends for a Zord', async () => {
  const [ninja] = await actionCosts(['prcrbitems/_source/Ninja_Powered__Stealthy_Misdirection__fcFhvADLYv9xE0jU.json'], { key: 'defend' });
  expect(ninja).toMatchObject({ ask: 'E20.ActionPerkAskLongMove' });
  expect(ninja.to()).toBe('none');
  const [shogun] = await actionCosts(['prcrbitems/_source/Upgraded_Zord__Shogun_Upgrade__1Bp1o4k9VhkKPXnd.json'], { key: 'defend' });
  expect(shogun.ask).toBeUndefined();
  expect(shogun.to()).toBe('free');
});

test('A Genius For A Patient and Docking Tool discount Use a Skill', async () => {
  const [doctor] = await actionCosts(['ccitems/_source/A_Genius_For_A_Patient_SvdRlZhhycMM2RJY.json'], { key: 'useASkill' });
  expect(doctor).toMatchObject({ ask: 'E20.ActionPerkAskSelfHeal', limit: { window: 'turn', max: 1 } });
  expect(doctor.to()).toBe('free');
  const [drone] = await actionCosts(['gijcrbitems/_source/Docking_Tool_8S7Q4MKBuYbTOLH1.json'], { key: 'useASkill' });
  expect(drone).toMatchObject({ ask: 'E20.ActionPerkAskDocked' });
  expect(drone.to()).toBe('move');
});

/* perkh slice: fixed Perk grants, Zord access, the TF CRB Influence Perks' chosen Specialization, Technological Assistance. */

test.each([
  ['Combat Lifesaver', 'fffav1items/_source/Combat_Lifesaver_e48e4SaTGt7rOOUj.json', 'Compendium.essence20.gi_joe_crb.Item.jDAu1zaZpv1IylJ8', 'perk'],
  ['Life Finds A Way', 'fffav1items/_source/Life_Finds_A_Way_j6KOCP9HsyzO3UHa.json', 'Compendium.essence20.gi_joe_crb.Item.GQwhr14X9yXkAuWH', 'perk'],
  ['Change Its Stripes', 'fffav1items/_source/Change_Its_Stripes_8tz9aZSqmUntS20H.json', 'Compendium.essence20.ferocious_fighters.Item.mnze6jJ6eSYbS8Pr', 'perk'],
  ['For The Syndicate', 'iafav2items/_source/For_The_Syndicate_opygNwRWgeIyU1mE.json', 'Compendium.essence20.gi_joe_crb.Item.jUZrNJbPzSd1zVLa', 'perk'],
  ['Young But Experienced', 'ghpfitems/_source/Young_But_Experienced_o5O65BE6dtdlxsfM.json', 'Compendium.essence20.gi_joe_crb.Item.3ahVUG1yKCGNyscK', 'perk'],
  ['Into the Void', 'iafav2items/_source/Into_the_Void_OuLsQGETgtRNJ0RQ.json', 'Compendium.essence20.gi_joe_crb.Item.QJkcVXT7K4yNWFoT', 'perk'],
  ['Synchronization', 'qgtgitems/_source/Synchronization_Ee3GRqk0H7ph0vEs.json', 'Compendium.essence20.quartermasters_guide_to_gear.Item.pU3dKGNWYAhgRY6B', 'perk'],
  ['Nanoflage', 'qgtgitems/_source/Nanoflage_22p3l2vFsFZqfOET.json', 'Compendium.essence20.quartermasters_guide_to_gear.Item.WI0QTzlWkEusSQqY', 'power'],
  ['Pet Companion', 'ccitems/_source/Pet_Companion_05bNThwoKYW67fZB.json', 'Compendium.essence20.gi_joe_crb.Item.6oF71x58kaB302bH', 'perk'],
  ['Colony Changeling', 'dsoeitems/_source/Colony_Changeling_FRUWPAePJzm7Mlf0.json', 'Compendium.essence20.dark_skies_over_equestria.Item.2Kw4msw0l4j6fTOm', 'influence'],
])('%s: grants its fixed item, unless the actor already has one', async (name, file, uuid, type) => {
  const { grantData } = await import('./lifecycle.mjs');
  const saved = global.foundry.utils;
  global.foundry.utils = {
    ...saved,
    setProperty: (object, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
    },
  };
  try {
    const actor = holder([file]);
    const [granter] = actor.items.contents;
    const load = async id => (id == uuid ? { toObject: () => ({ _id: 'x', name: 'Granted', type, system: {} }) } : null);
    const granted = await grantData(granter, actor, { load });
    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatchObject({ type, _stats: { compendiumSource: uuid }, flags: { essence20: { grantedBy: granter.id } } });
    expect(granted[0]._id).toBeUndefined();
    actor.items.contents.push({ id: 'owned', type, flags: { core: { sourceId: uuid } }, system: {} });
    expect(await grantData(granter, actor, { load })).toEqual([]);
  } finally {
    global.foundry.utils = saved;
  }
});

test.each([
  ['Zord', 'prcrbitems/_source/Zord_rCpCrfzMYPupoYNI.json'],
  ['Quantasaurus Rex', 'jttitems/_source/Quantasaurus_Rex_sn5jhTf8sJqRFhKS.json'],
  ['Phantom Ship', 'atsitems/_source/Phantom_Ship_OfsTu9GpONWPV88t.json'],
  ['Torozord', 'ttsgitems/_source/Torozord_gx0xOFKcKOPyaUto.json'],
])('%s: the character can have a Zord while holding it', (name, file) => {
  const actor = holder([file], { system: { canHaveZord: false } });
  ruleDerived(actor);
  expect(actor.system.canHaveZord).toBeTruthy();

  const without = holder([], { system: { canHaveZord: false } });
  ruleDerived(without);
  expect(without.system.canHaveZord).toBe(false);
});

test.each([
  ['Gladiator', 'tfcrbitems/_source/Gladiator_tDge4xSE9urfxwHP.json', 'intimidation'],
  ['Hunter', 'tfcrbitems/_source/Hunter_5Z0xtNOeSCD2YoRc.json', 'survival'],
  ['Racer', 'tfcrbitems/_source/Racer_KjcoQiDoT7WEVsZX.json', 'driving'],
  ['Scavenger', 'tfcrbitems/_source/Scavenger_95RyaWIi0HQOlyJN.json', 'streetwise'],
])('%s: an Edge switch on its Skill, named for the chosen Specialization', (name, file, skill) => {
  const actor = holder([file]);
  actor.items.contents[0].flags = { essence20: { rules: { choices: { spec: 'Motorcycles' } } } };
  expect(switchNames(actor, { rolledSkill: skill })).toEqual([`Using Motorcycles (${name}: Edge)`]);
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(tick(actor, { rolledSkill: skill })).toMatchObject({ edge: true });
});

test('Former Senator: the Edge switch follows the chosen Skill (Deception or Persuasion)', () => {
  const actor = holder(['tfcrbitems/_source/Former_Senator_gcqyJw1sXxi2wy8e.json']);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  actor.items.contents[0].flags = { essence20: { rules: { choices: { skill: 'persuasion', spec: 'Diplomacy' } } } };
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual(['Using Diplomacy (Former Senator: Edge)']);
  expect(switchNames(actor, { rolledSkill: 'deception' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ edge: true });
});

test('TF CRB Influence Perks: an old "skill::name" pick moves into the rule choices', async () => {
  const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
  const TF = 'Compendium.essence20.tf_crb.Item.';
  const senator = { id: 's', flags: { core: { sourceId: `${TF}gcqyJw1sXxi2wy8e` } }, system: { choice: 'persuasion::Diplomacy' } };
  const racer = { id: 'r', flags: { core: { sourceId: `${TF}KjcoQiDoT7WEVsZX` } }, system: { choice: 'driving::Motorcycles' } };
  const unpicked = { id: 'u', flags: { core: { sourceId: `${TF}5Z0xtNOeSCD2YoRc` } }, system: { choice: '' } };
  expect(legacyChoiceUpdates({ items: [senator, racer, unpicked] })).toEqual([
    { _id: 's', 'flags.essence20.rules.choices.skill': 'persuasion', 'flags.essence20.rules.choices.spec': 'Diplomacy' },
    { _id: 'r', 'flags.essence20.rules.choices.spec': 'Motorcycles' },
  ]);
});

test('Technological Assistance: Lend Assistance can cost a Free action, asked first', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const [rule, more] = costRulesFor(holder(['qgtgitems/_source/Technological_Assistance_7b01zSdekhUugIod.json']));
  expect(more).toBeUndefined();
  expect(rule).toMatchObject({ label: 'Technological Assistance', ask: 'E20.ActionPerkAskTechnologicalAssistance' });
  expect(rule.matches({ key: 'lendAssistance' })).toBe(true);
  expect(rule.matches({ key: 'hide' })).toBe(false);
  expect(rule.to('standard')).toBe('free');
  expect(costRulesFor(holder([]))).toEqual([]);
});

/* vehicles batch: Vehicle Upgrades (helpers/vehicle-upgrades.mjs) moved to item rules. */

const vuFile = name => `qgtgitems/_source/${name}.json`;
let vuNext = 1;

function vuVehicle(names, system = {}) {
  const vehicle = holder(names.map(vuFile), { system });
  Object.assign(vehicle, { type: 'vehicle', uuid: `Actor.vuVehicle${vuNext++}` });
  return vehicle;
}

function vuCrew(vehicle, roles, system = {}) {
  const crew = roles.map(role => Object.assign(holder([], { system }), { uuid: `Actor.vuCrew${vuNext++}`, role }));
  vehicle.system.actors = Object.fromEntries(crew.map((actor, i) => [`c${i}`, { uuid: actor.uuid, vehicleRole: actor.role }]));
  game.actors = { contents: [...crew, vehicle] };
  return crew;
}

const vuLabels = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources.map(s => s.label).sort();

test('Vehicle Upgrades: granted traits, and Lead Lining takes Computerized away last', () => {
  const traits = { ai: false, computerized: false, autopilot: false, autopilotAdvanced: false, sensors: false, vtol: false, rapidDeploymentRamps: false, rollCage: false, treads: false, amphibious: false };
  const vehicle = vuVehicle(['Lead_Lining_2twrOiG1nytIYdoj', 'Artificial_Intelligence_0E1i8G35dacjogud', 'Autopilot_iOmrgWu6h9qvP89n', 'Advanced_Autopilot_cpoT15OyAncmJzEz',
    'Sensor_Suite_YJfkZpXX5dtsEFKE', 'Thrust_Vectoring_KbBCyzCUqPeZUkJJ', 'Rapid_Deployment_Ramps_LJFMCkvGlT8q5KtQ', 'Roll_Cage_XfqPvQDlP1eD3Cmh', 'Treads_dXx85BLf1RKjn8xg', 'Shallow_Draft_Ftm5iA7PG6J3M4aN'], { traits: { ...traits } });
  ruleDerived(vehicle);
  expect(vehicle.system.traits).toMatchObject({ ai: 1, computerized: 0, autopilot: 1, autopilotAdvanced: 1, sensors: 1, vtol: 1, rapidDeploymentRamps: 1, rollCage: 1, treads: 1, amphibious: 1 });
  const computer = vuVehicle(['Integrated_Computer_7XGaJUtxW3NCe8c7'], { traits: { ...traits } });
  ruleDerived(computer);
  expect(computer.system.traits.computerized).toBe(1);
  const pc = holder([vuFile('Autopilot_iOmrgWu6h9qvP89n')]);
  ruleDerived(pc);
  expect(pc.system.traits).toBeUndefined();
});

test('Vehicle Upgrades: Armor Plating and Enhanced Shocks; a sealed cabin; Optimized Seating doubles passengers', () => {
  const vehicle = vuVehicle(['Armor_Plating_zgetOeeka0vBkImO', 'Enhanced_Shocks_Qw2aKbgTU8Xh3ahV', 'Pressurized_Cabin_Wlcf4Dm1VXchUvk3', 'Optimized_Seating_5LrQ4TGjgWKsomL7'],
    { defenses: { toughness: { total: 10 }, evasion: { total: 10 } }, crew: { numPassengers: 2 } });
  ruleDerived(vehicle);
  expect(vehicle.system.defenses).toMatchObject({ toughness: { total: 11 }, evasion: { total: 11 } });
  expect(vehicle.system.pressurized).toBe(1);
  expect(vehicle.system.crew.numPassengers).toBe(4);
  const sub = vuVehicle(['Submarine_Mode_ErSK3LwBT1Wg8rKF']);
  ruleDerived(sub);
  expect(sub.system.pressurized).toBe(1);
});

test("Early-Warning Alarm and Focus Module: +1 Willpower and Cleverness for the vehicle's driver only", () => {
  const vehicle = vuVehicle(['Early_Warning_Alarm_ct0eW3BmVFX9iYTx', 'Focus_Module_6tjR3T26seuNkDLi']);
  const defenses = () => ({ willpower: { total: 10 }, cleverness: { total: 10 } });
  const [driver, rider] = vuCrew(vehicle, ['driver', 'passenger']);
  driver.system.defenses = defenses();
  rider.system.defenses = defenses();
  ruleDerived(driver);
  ruleDerived(rider);
  expect(driver.system.defenses).toMatchObject({ willpower: { total: 11 }, cleverness: { total: 11 } });
  expect(rider.system.defenses).toMatchObject({ willpower: { total: 10 }, cleverness: { total: 10 } });
  game.actors = undefined;
});

test('Vehicle Upgrades: the crew (and the vehicle itself) get Racing Stripes, NOD Viewscreens, GPS, supplies, parts, LIDAR and the Cowcatcher', () => {
  const vehicle = vuVehicle(['Racing_Stripes_fFWlwBeGb6aYYtGP', 'NOD_Viewscreens_PrQVSgFWjjtZgCH1', 'Onboard_GPS_2JsjyEOtWTNHpxDl', 'Emergency_Supplies_7Tn4DVpFisYkXERO',
    'Interchangeable_Parts_1j1vpae13QKgPZGp', 'LIDAR_Targeting_Unit_oejdA1Iw5UJB5tVT', 'Cowcatcher_QrrpYF2M89jDng82']);
  const [driver, gunner] = vuCrew(vehicle, ['driver', 'gunner']);
  expect(vuLabels(driver, { rolledSkill: 'initiative' })).toEqual(['NOD Viewscreens', 'Racing Stripes']);
  expect(ruleRollSources(driver, null, { rolledSkill: 'initiative' }).sources.reduce((n, s) => n + s.shiftUp - s.shiftDown, 0)).toBe(0);
  expect(vuLabels(gunner, { rolledSkill: 'initiative' })).toEqual(['NOD Viewscreens']);
  expect(vuLabels(vehicle, { rolledSkill: 'initiative' })).toEqual(['NOD Viewscreens', 'Racing Stripes']);
  expect(ruleRollSources(gunner, null, { rolledSkill: 'survival' }).sources[0]).toMatchObject({ label: 'Onboard GPS', edge: true });
  expect(ruleRollSources(gunner, null, { rolledSkill: 'medicine' }).sources[0]).toMatchObject({ label: 'Emergency Supplies', edge: true });
  expect(ruleRollSources(gunner, null, { rolledSkill: 'technology' }).sources[0]).toMatchObject({ label: 'Interchangeable Parts', shiftUp: 2 });
  const mounted = { type: 'weaponEffect', system: {}, parent: vehicle };
  const ram = { type: 'weaponEffect', system: { isRam: true }, parent: vehicle };
  expect(ruleRollSources(gunner, null, { rolledSkill: 'targeting', item: mounted }).sources).toEqual([expect.objectContaining({ label: 'LIDAR Targeting Unit', shiftUp: 1 })]);
  expect(vuLabels(gunner, { rolledSkill: 'targeting', item: { type: 'weaponEffect', system: {}, parent: gunner } })).toEqual([]);
  expect(vuLabels(vehicle, { rolledSkill: 'driving', item: ram })).toEqual(['Cowcatcher', 'LIDAR Targeting Unit']);
  expect(vuLabels(holder([]), { rolledSkill: 'initiative' })).toEqual([]);
  game.actors = undefined;
});

test('Stealthy and the Magnetohydrodynamic Drive: ↑ and a stationary ↑ on Infiltration, the Drive replacing Stealthy; Titanium Chassis and Second Gear on the vehicle itself', () => {
  const sneaky = vuVehicle(['Stealthy_fsQc0eTmSHzHBFdG']);
  const [crew] = vuCrew(sneaky, ['passenger']);
  expect(ruleRollSources(crew, null, { rolledSkill: 'infiltration' }).sources.map(s => [s.label, s.shiftUp])).toEqual([['Stealthy', 1], ['Stealthy (stationary)', 1]]);
  const quiet = vuVehicle(['Stealthy_fsQc0eTmSHzHBFdG', 'Magnetohydrodynamic_Drive_6Drlcw6qu216sTuN']);
  expect(ruleRollSources(quiet, null, { rolledSkill: 'infiltration' }).sources.map(s => [s.label, s.shiftUp])).toEqual([['Magnetohydrodynamic Drive', 2], ['Magnetohydrodynamic Drive (stationary)', 2]]);
  const truck = vuVehicle(['Titanium_Chassis_VwPJAu8rlGMw9lBM', 'Second_Gear_iMAUhU8J2rQtLmgC']);
  const [driver] = vuCrew(truck, ['driver']);
  expect(ruleRollSources(truck, null, { rolledSkill: 'might' }).sources.map(s => [s.label, s.shiftUp, s.edge])).toEqual([['Titanium Chassis', 2, false], ['Second Gear', 0, true]]);
  expect(ruleRollSources(truck, null, { rolledSkill: 'brawn' }).sources.map(s => s.label)).toEqual(['Second Gear']);
  expect(ruleRollSources(driver, null, { rolledSkill: 'might' }).sources).toEqual([]);
  game.actors = undefined;
});

test('Ablative Armor: ↓1 for an attacker dealing Blunt or Sharp damage to the vehicle', () => {
  const vehicle = vuVehicle(['Ablative_Armor_udbXWIic0wOLDXZk']);
  const attacker = holder([]);
  const shot = damageType => ({ rolledSkill: 'targeting', item: { type: 'weaponEffect', system: { damageType } } });
  expect(ruleRollSources(attacker, vehicle, shot('sharp')).sources[0]).toMatchObject({ label: 'Ablative Armor', shiftDown: 1 });
  expect(ruleRollSources(attacker, vehicle, shot('blunt')).sources[0]).toMatchObject({ shiftDown: 1 });
  expect(ruleRollSources(attacker, vehicle, shot('fire')).sources).toEqual([]);
  expect(ruleRollSources(attacker, vehicle, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test('All-Terrain Steel-Reinforced Wheels: the vehicle ignores Rough Terrain', () => {
  expect(ruleMovement(vuVehicle(['All_Terrain_Steel_Reinforced_Wheels_fX7YCfnYcXSpWGhG'])).ignoreRoughTerrain).toBe(true);
  expect(ruleMovement(vuVehicle([])).ignoreRoughTerrain).toBe(false);
});

/* Batch powers: Monster Form's Toughness and Skill upshifts on the six Psycho Path Role items
   (helpers/monster-morph.mjs). */

test.each([
  ['Path_Of_Cruelty_vWie8Dy4u54sf1hy', 2, ['alertness', 'intimidation', 'might'], 'deception'],
  ['Path_of_Flame_4PbR4S3s83Coa0kL', 2, ['alertness', 'athletics', 'brawn'], 'might'],
  ['Path_of_Frost_GQ5aQWbjmaO9y00w', 2, ['brawn', 'might', 'initiative'], 'alertness'],
  ['Path_of_Stone_TEjkVjIEFEbRI736', 4, ['intimidation', 'might', 'survival'], 'alertness'],
  ['Path_of_Thorns_0ICOTyVDXK1i6l1S', 1, ['alertness', 'intimidation', 'survival'], 'might'],
  ['Path_of_Venom_rWoVOcNc3lXKDbhg', 2, ['intimidation', 'survival'], 'might'],
])('%s: in Monster Form, +%i Toughness and ↑1 on its own Skills', (file, toughness, skills, other) => {
  const actor = holder([`fmmcitems/_source/${file}.json`], { system: { defenses: { toughness: { total: 10 } } } });
  ruleDerived(actor);
  expect(actor.system.defenses.toughness.total).toBe(10);
  for (const skill of skills) {
    expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources).toEqual([]);
  }

  actor.flags = { essence20: { monsterFormActive: true } };
  ruleDerived(actor);
  expect(actor.system.defenses.toughness.total).toBe(10 + toughness);
  for (const skill of skills) {
    expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: other }).sources).toEqual([]);
});

// Batch wupg (helpers/weapon-upgrades.mjs): Fluid Motion's no-penalty Maneuver.
test('Fluid Motion: Maneuver on a Silent Martial Arts weapon loses its penalty', () => {
  const actor = holder(['iafav2items/_source/Fluid_Motion_TESyOcJFtd9Qn9Tk.json']);
  const weapon = (id, traits) => ({ id, type: 'weapon', name: id, flags: {}, system: { traits } });
  const effect = (id, parentId, damageType) => ({ id, type: 'weaponEffect', name: id, flags: { essence20: parentId ? { parentId } : {} }, system: { damageType, shiftDown: 1 } });
  const maneuver = effect('e1', 'wSma', 'maneuver');
  const strike = effect('e2', 'wSma', 'blunt');
  const plainManeuver = effect('e3', 'wPlain', 'maneuver');
  const unarmed = effect('e4', null, 'maneuver');
  const added = [weapon('wSma', ['silent', 'martialArts']), weapon('wPlain', ['martialArts']), maneuver, strike, plainManeuver, unarmed];
  for (const item of added) {
    item.parent = actor;
    actor.items.contents.push(item);
  }

  ruleDerived(actor);
  expect(maneuver.system.shiftDown).toBe(0);
  expect(maneuver.system.upgradeTouched).toEqual(['shiftDown']);
  expect(strike.system.shiftDown).toBe(1);
  expect(plainManeuver.system.shiftDown).toBe(1);
  expect(unarmed.system.shiftDown).toBe(1);
});


/* unblocked batch: JAFF / Tricked-Out Hydraulics (incoming rules now honour their limit) and the
   untrained-Snag immunities moved out of helpers/roll-dialog.mjs. */

function vuLimited(name) {
  const vehicle = vuVehicle([name]);
  vehicle.flags = { essence20: {} };
  vehicle.getFlag = (scope, key) => key.split('.').reduce((o, k) => o?.[k], vehicle.flags[scope]);
  vehicle.setFlag = async (scope, key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => (o[k] ??= {}), vehicle.flags[scope] ??= {})[last] = value;
  };

  return vehicle;
}

function vuShot(traits, name = 'Shot') {
  const attacker = holder([]);
  const weapon = { id: `w${vuNext++}`, type: 'weapon', name: 'Gun', flags: {}, system: { traits } };
  attacker.items.contents.push(weapon);
  const effect = { id: `e${vuNext++}`, type: 'weaponEffect', name, flags: { essence20: { parentId: weapon.id } }, system: { damageType: 'sharp' }, parent: attacker };
  return { attacker, roll: { rolledSkill: 'targeting', item: effect } };
}

test.each([
  ['JAFF_uGSFdauOqFAjyanF', 'computerized', 'ballistic'],
  ['Tricked_Out_Hydraulics_BwgnU1Nb1NXFNlsx', 'ballistic', 'computerized'],
])('%s: once per combat, an incoming attack with a %s weapon takes a Snag', async (name, trait, other) => {
  const vehicle = vuLimited(name);
  const shot = vuShot([trait]);
  const first = ruleRollSources(shot.attacker, vehicle, shot.roll);
  expect(first.sources).toEqual([expect.objectContaining({ snag: true })]);
  expect(first.consumes).toHaveLength(1);

  const miss = vuShot([other]);
  expect(ruleRollSources(miss.attacker, vehicle, miss.roll).sources).toEqual([]);
  expect(ruleRollSources(shot.attacker, vehicle, { rolledSkill: 'persuasion' }).sources).toEqual([]);

  await consumeLimited(first.consumes[0], async () => vehicle);
  expect(ruleRollSources(shot.attacker, vehicle, shot.roll).sources).toEqual([]);
});

test('Tricked-Out Hydraulics: a Pistol Whip Bludgeon is not a Ballistic attack', () => {
  const vehicle = vuLimited('Tricked_Out_Hydraulics_BwgnU1Nb1NXFNlsx');
  const whip = vuShot(['ballistic'], 'Pistol Whip - Blunt (Gun)');
  expect(ruleRollSources(whip.attacker, vehicle, whip.roll).sources).toEqual([]);
});

test.each([
  'gijcrbitems/_source/Presence_EdP0LqcYh2tkMygI.json',
  'jttitems/_source/I_ll_Make_It_Work_nxgmUTaPwFcg94ia.json',
])('%s: no untrained Snag on any Skill', file => {
  const actor = holder([file]);
  expect(ruleNoUntrainedSnag(actor, 'athletics')).toBe(true);
  expect(ruleNoUntrainedSnag(actor, null)).toBe(true);
  expect(ruleNoUntrainedSnag(holder([]), 'athletics')).toBe(false);
});

/** Someone holding this item, crewing a vehicle that moves this way (or nothing, for null). */
function untrainedDriver(file, movement, { role = 'driver', choice } = {}) {
  const actor = holder([`${file}.json`]);
  actor.uuid = `Actor.untrained${vuNext++}`;
  if (choice !== undefined) {
    actor.items.contents[0].system.choice = choice;
  }

  const ride = movement && {
    type: 'vehicle', uuid: `Actor.ride${vuNext++}`,
    system: {
      actors: { a: { uuid: actor.uuid, vehicleRole: role } },
      movement: { aerial: { base: 0 }, ground: { base: 0 }, swim: { base: 0 }, [movement]: { base: 30 } },
    },
  };
  game.actors = { contents: ride ? [actor, ride] : [actor] };
  return actor;
}

test.each([
  ['iafav2items/_source/Air_Vehicle_Qualification_GUcQm2RuUIEWzd4X', ['aerial'], ['ground', 'swim']],
  ['iafav2items/_source/Land_Vehicle_Qualification_xLeoc9xLx06SpK7S', ['ground'], ['aerial', 'swim']],
  ['iafav2items/_source/Sea_Vehicle_Qualification_K0UKwjhJlYnGM7yt', ['swim'], ['aerial', 'ground']],
  ['qgtgitems/_source/Skyward_1IlTYXe8k5Aj63Mn', ['aerial'], ['ground', 'swim']],
  ['iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn', ['aerial', 'ground'], ['swim']],
  ['iafav2items/_source/Nothing_Personal_WsB4CydGzKF2g7Yi', ['ground'], ['aerial', 'swim']],
  ['iafav2items/_source/The_Promise_of_Riches_wW4xugDI7Sea2Btg', ['aerial', 'ground', 'swim'], []],
  ['ccitems/_source/Take_the_Wheel_EQK0bAGpmYkGPcRi', ['ground'], ['aerial', 'swim']],
])('%s: no untrained Snag driving a %j vehicle', (file, yes, no) => {
  try {
    for (const movement of yes) {
      expect(ruleNoUntrainedSnag(untrainedDriver(file, movement), 'driving')).toBe(true);
      expect(ruleNoUntrainedSnag(untrainedDriver(file, movement), 'targeting')).toBe(false);
      expect(ruleNoUntrainedSnag(untrainedDriver(file, movement, { role: 'passenger' }), 'driving')).toBe(false);
    }

    for (const movement of no) {
      expect(ruleNoUntrainedSnag(untrainedDriver(file, movement), 'driving')).toBe(false);
    }

    expect(ruleNoUntrainedSnag(untrainedDriver(file, null), 'driving')).toBe(false);
  } finally {
    game.actors = undefined;
  }
});

test.each([
  'iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj',
  'iafav2items/_source/For_The_Syndicate_opygNwRWgeIyU1mE',
])('%s: no untrained Snag driving the chosen kind of vehicle', file => {
  try {
    expect(ruleNoUntrainedSnag(untrainedDriver(file, 'ground', { choice: 'ground' }), 'driving')).toBe(true);
    expect(ruleNoUntrainedSnag(untrainedDriver(file, 'swim', { choice: 'swim' }), 'driving')).toBe(true);
    expect(ruleNoUntrainedSnag(untrainedDriver(file, 'aerial', { choice: 'ground' }), 'driving')).toBe(false);
    expect(ruleNoUntrainedSnag(untrainedDriver(file, 'ground', { choice: null }), 'driving')).toBe(false);
    expect(ruleNoUntrainedSnag(untrainedDriver(file, null, { choice: 'ground' }), 'driving')).toBe(false);
  } finally {
    game.actors = undefined;
  }
});

/* Torozord (no Snag on Driving while driving a Zord) */

test('Torozord: immune to Snags on Driving while driving a Zord', () => {
  const actor = holder(['ttsgitems/_source/Torozord_gx0xOFKcKOPyaUto.json']);
  actor.uuid = 'Actor.toro';
  global.game.actors = { contents: [{ type: 'zord', system: { actors: { a: { uuid: 'Actor.toro', vehicleRole: 'driver' } } } }] };
  const options = { snag: true };
  applyRuleImmunity(actor, options, { rolledSkill: 'driving' });
  expect(options.snag).toBe(false);
  global.game.actors = { contents: [{ type: 'vehicle', system: { actors: { a: { uuid: 'Actor.toro', vehicleRole: 'driver' } } } }] };
  const car = { snag: true };
  applyRuleImmunity(actor, car, { rolledSkill: 'driving' });
  expect(car.snag).toBe(true);
  delete global.game.actors;
});

/* Critical Effects (CriticalOption rules) */

test('Critical Effects: weapon options only with that weapon; Perk options by target; Ravaging Critical steps damage up', async () => {
  const { ruleCriticalOptions } = await import('./adapter.mjs');
  const claws = holder(['atsitems/_source/Arm_Claws_L974PVqFZO7yuueB.json']);
  const clawItem = claws.items.contents[0];
  const clawAttack = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: clawItem.id } }, system: { classification: { style: 'melee', skill: 'might' } } };
  expect(ruleCriticalOptions(claws, null, clawAttack).options).toMatchObject([{ damageValue: 2, damageType: 'stun' }]);
  const otherAttack = { id: 'e2', type: 'weaponEffect', flags: { essence20: { parentId: 'elsewhere' } }, system: {} };
  expect(ruleCriticalOptions(claws, null, otherAttack).options).toEqual([]);

  const hunter = holder(['atsitems/_source/Monster_Hunter_L0ACKSFo5szl9qTL.json']);
  const beast = { system: { creatureTags: ['monster'] }, items: [] };
  const person = { system: { creatureTags: [] }, items: [] };
  expect(ruleCriticalOptions(hunter, beast, otherAttack).options).toMatchObject([{ rider: 'nextAttackSnag', damageType: 'special' }]);
  expect(ruleCriticalOptions(hunter, person, otherAttack).options).toEqual([]);

  const blitzer = holder(['gijcrbitems/_source/Ravaging_Critical_avSz5022d78N6bcV.json']);
  const mightMelee = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee', skill: 'might' } } };
  expect(ruleCriticalOptions(blitzer, null, mightMelee)).toMatchObject({ options: [], improve: 1 });
  const ranged = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'ranged', skill: 'targeting' } } };
  expect(ruleCriticalOptions(blitzer, null, ranged).improve).toBe(0);
});

test('Blazing Strikes: its Critical Effect on unarmed strikes while switched on', async () => {
  const { ruleCriticalOptions } = await import('./adapter.mjs');
  const actor = holder(['atsitems/_source/Blazing_Strikes_hr0SY24JAM7I91qA.json']);
  actor.flags = { essence20: { blazingStrikesActive: true } };
  const unarmed = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } };
  expect(ruleCriticalOptions(actor, null, unarmed).options).toMatchObject([{ rider: 'blazingStrikes', damageValue: 2 }]);
  actor.flags = {};
  expect(ruleCriticalOptions(actor, null, unarmed).options).toEqual([]);
});

/* round12: items earlier passes skipped for an engine gap since closed - Armor Expert (self:wearing),
   Poison Resistance (weapon:data), Pressure Cooker / Who Dares Wins / Student of Divine Manuals (targeted
   Skill Tests reach rule sources), Projectile Dancer (incoming limits), Static Slide Inhibitor (rule:data),
   How I Got These Dents (@actor formulas). */

function r12Flags(actor) {
  actor.uuid = `Actor.${actor.id}`;
  actor.flags = { essence20: {} };
  actor.getFlag = (scope, key) => key.split('.').reduce((o, k) => o?.[k], actor.flags[scope]);
  actor.setFlag = async (scope, key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => (o[k] ??= {}), actor.flags[scope] ??= {})[last] = value;
  };

  return actor;
}

const r12Sources = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources;

test('Armor Expert: +2 Toughness while wearing any equipped armor', () => {
  const file = 'gijcrbitems/_source/Armor_Expert_0a01vmWtbbYYcNvA.json';
  const defenses = (armor = []) => {
    const actor = holder([file], { system: { defenses: pass2Defenses() } });
    actor.items.contents.push(...armor.map((system, i) => ({ id: `r12arm${i}`, type: 'armor', flags: {}, system })));
    ruleDerived(actor);
    return actor.system.defenses;
  };

  expect(defenses([{ equipped: true, classification: 'light' }]).toughness.total).toBe(14);
  expect(defenses([{ equipped: true, classification: 'light' }]).evasion.total).toBe(11);
  expect(defenses([{ equipped: true, classification: 'ultraHeavy' }]).toughness.total).toBe(14);
  expect(defenses([{ equipped: false, classification: 'light' }]).toughness.total).toBe(12);
  expect(defenses().toughness.total).toBe(12);
});

test('Poison Resistance: attacks against the wearer with a poison weapon or poison damage take a Snag', () => {
  const wearer = holder(['ccitems/_source/Poison_Resistance_TLTJHkOpPC07D2dB.json']);
  const attacker = holder([]);
  const weapon = { id: 'r12gun', type: 'weapon', flags: {}, system: { isPoison: true } };
  attacker.items.contents.push(weapon);
  const effect = (damageType, parentId = null) => ({
    id: 'r12fx', type: 'weaponEffect', parent: attacker, flags: parentId ? { essence20: { parentId } } : {}, system: { damageType },
  });
  expect(r12Sources(attacker, { item: effect('sharp', 'r12gun'), isAttack: true }, wearer)).toEqual([expect.objectContaining({ label: 'Poison Resistance', snag: true })]);
  expect(r12Sources(attacker, { item: effect('poison'), isAttack: true }, wearer)).toEqual([expect.objectContaining({ snag: true })]);
  expect(r12Sources(attacker, { rolledSkill: 'athletics', isAttack: false }, wearer)).toEqual([]);
  weapon.system.isPoison = false;
  expect(r12Sources(attacker, { item: effect('sharp', 'r12gun'), isAttack: true }, wearer)).toEqual([]);

  // On unequipped armor it isn't worn.
  wearer.items.contents.push({ id: 'r12suit', type: 'armor', flags: {}, system: { equipped: false } });
  wearer.items.contents[0].flags = { essence20: { parentId: 'r12suit' } };
  rebuildIndex(wearer);
  expect(r12Sources(attacker, { item: effect('poison'), isAttack: true }, wearer)).toEqual([]);
});

test('Pressure Cooker: ↑1 on any test while below maximum Health', () => {
  const file = 'ghpfitems/_source/Pressure_Cooker_MMToVGBAkB79DZEW.json';
  const hurt = holder([file], { system: { health: { value: 5, max: 10 } } });
  expect(r12Sources(hurt, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ label: 'Pressure Cooker', shiftUp: 1 })]);
  expect(r12Sources(hurt, { rolledSkill: 'persuasion' }, holder([]))).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(r12Sources(holder([file], { system: { health: { value: 10, max: 10 } } }), { rolledSkill: 'athletics' })).toEqual([]);
  expect(r12Sources(holder([], { system: { health: { value: 5, max: 10 } } }), { rolledSkill: 'athletics' })).toEqual([]);
});

test('Who Dares, Wins: Edge on any roll in round 1 of combat', () => {
  const actor = holder(['gijcrbitems/_source/Who_Dares_Wins_zfyTLiJDNKPHETlv.json']);
  try {
    global.game.combat = { round: 1 };
    expect(r12Sources(actor, {})).toEqual([expect.objectContaining({ label: 'Who Dares, Wins', edge: true })]);
    expect(r12Sources(actor, { item: dice1Unarmed, isAttack: true })).toEqual([expect.objectContaining({ edge: true })]);
    global.game.combat = { round: 2 };
    expect(r12Sources(actor, {})).toEqual([]);
    global.game.combat = null;
    expect(r12Sources(actor, {})).toEqual([]);
  } finally {
    global.game.combat = null;
  }
});

test('Student of Divine Manuals: Specialized on any Skill Test, once per encounter', async () => {
  const actor = r12Flags(holder(['iafav2items/_source/Student_of_Divine_Manuals_98E2wzIX6LQRu7gD.json']));
  expect(ruleSpecializes(actor, 'might', null, {})).toBe(true);
  const first = ruleRollSources(actor, null, { rolledSkill: 'might' });
  expect(first.consumes).toHaveLength(1);
  await consumeLimited(first.consumes[0], async () => actor);
  expect(ruleSpecializes(actor, 'culture', null, {})).toBe(false);
  expect(ruleSpecializes(holder([]), 'might', null, {})).toBe(false);
});

test('Projectile Dancer: the first projectile attack against the holder each encounter takes a Snag', async () => {
  const dancer = r12Flags(holder(['iafav2items/_source/Projectile_Dancer_gsSxDXrq0xdmkeJp.json']));
  const attacker = holder([]);
  const shot = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } }, isAttack: true };
  const first = ruleRollSources(attacker, dancer, shot);
  expect(first.sources).toEqual([expect.objectContaining({ label: 'Projectile Dancer', snag: true })]);
  expect(r12Sources(attacker, { item: dice1Unarmed, isAttack: true }, dancer)).toEqual([]);
  expect(r12Sources(attacker, shot, holder([]))).toEqual([]);
  await consumeLimited(first.consumes[0], async () => dancer);
  expect(r12Sources(attacker, shot, dancer)).toEqual([]);
});

test('Static Slide Inhibitor: ↓1 on Energy attacks against the wearer while it is a loose armor upgrade', () => {
  const wearer = holder(['eocitems/_source/Static_Slide_Inhibitor_ngRiC3rt8GDo4rT3.json']);
  const attacker = holder([]);
  const attack = damageType => ({ item: { type: 'weaponEffect', flags: {}, system: { damageType, classification: { style: 'projectile' } } }, isAttack: true });
  expect(r12Sources(attacker, attack('electric'), wearer)).toEqual([expect.objectContaining({ label: 'Static Slide Inhibitor', shiftDown: 1 })]);
  expect(r12Sources(attacker, attack('laser'), wearer)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(r12Sources(attacker, attack('blunt'), wearer)).toEqual([]);
  expect(r12Sources(attacker, attack('electric'), holder([]))).toEqual([]);
  wearer.items.contents[0].flags = { essence20: { parentId: 'weapon1' } };
  rebuildIndex(wearer);
  expect(r12Sources(attacker, attack('electric'), wearer)).toEqual([]);
});

test('How I Got These Dents: ↑ on Intimidation equal to the damage taken', () => {
  const file = 'tfcrbitems/_source/How_I_Got_These_Dents_FfKkjODcY5N1Rk7G.json';
  const hurt = holder([file], { system: { health: { value: 4, max: 10 } } });
  expect(r12Sources(hurt, { rolledSkill: 'intimidation' })).toEqual([expect.objectContaining({ label: 'How I Got These Dents', shiftUp: 6 })]);
  expect(r12Sources(hurt, { rolledSkill: 'athletics' })).toEqual([]);
  expect(r12Sources(holder([file], { system: { health: { value: 10, max: 10 } } }), { rolledSkill: 'intimidation' })).toEqual([]);
  expect(r12Sources(holder([], { system: { health: { value: 4, max: 10 } } }), { rolledSkill: 'intimidation' })).toEqual([]);
});

/* qualify1 / qualify2 slices: Requisition Qualifications read from the item's own data, and the Danger
   Sense / Nothing Personal Edge switches. */

const qWeapon = (availability, traits = []) => ({ type: 'weapon', name: 'Gun', flags: {}, system: { availability, traits } });
const qArmor = (availability, traits = []) => ({ type: 'armor', name: 'Vest', flags: {}, system: { availability, traits } });

test('If It Shoots...: Trained in every weapon except Unique ones', () => {
  const actor = holder(['gijcrbitems/_source/If_It_Shoots_NUiyY9qOCPmuyjQN.json']);
  expect(ruleRequisitionAccess(actor, qWeapon('restricted'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('standard'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('unique'))).toBeNull();
  expect(ruleRequisitionAccess(actor, qArmor('standard'))).toBeNull();
  expect(ruleRequisitionAccess(holder([]), qWeapon('restricted'))).toBeNull();
});

test('Surgical Operators: Qualified in weapons with the Injection trait', () => {
  const actor = holder(['fffav1items/_source/Surgical_Operators_JtRCN6ppDatZVmav.json']);
  expect(ruleRequisitionAccess(actor, qWeapon('limited', ['injection']))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, qWeapon('limited'))).toBeNull();
  expect(ruleRequisitionAccess(actor, qArmor('limited', ['injection']))).toBeNull();
});

test('Mega Training Regimen: Computerized armor Qualified, other armor Trained', () => {
  const actor = holder(['fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json']);
  expect(ruleRequisitionAccess(actor, qArmor('limited', ['computerized']))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, qArmor('limited'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('limited', ['computerized']))).toBeNull();
});

test('Oorah!: Qualified in Standard (and Automatic) weapons only, by their base Availability', () => {
  const actor = holder(['sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json']);
  expect(ruleRequisitionAccess(actor, qWeapon('standard'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, qWeapon('automatic'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, qWeapon('limited'))).toBeNull();
  // An upgrade that raised the combined Availability doesn't matter: the old code read system.availability.
  expect(ruleRequisitionAccess(actor, { ...qWeapon('standard'), system: { availability: 'standard', totalAvailability: 'limited', traits: [] } })).toBe('qualified');
  expect(ruleRequisitionAccess(actor, qArmor('standard'))).toBeNull();
});

test('The Promise of Riches: Trained with Limited (or lower) weapons and battledress', () => {
  const actor = holder(['iafav2items/_source/The_Promise_of_Riches_wW4xugDI7Sea2Btg.json']);
  expect(ruleRequisitionAccess(actor, qArmor('limited'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('limited'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('standard'))).toBe('trained');
  expect(ruleRequisitionAccess(actor, qWeapon('restricted'))).toBeNull();
  expect(ruleRequisitionAccess(actor, { type: 'upgrade', name: 'Scope', flags: {}, system: { availability: 'limited' } })).toBeNull();
});

test('Danger Sense: an Edge switch, off by default, on any roll', () => {
  const actor = holder(['atsitems/_source/Danger_Sense_lwzD2ZvCLLf8PGRF.json']);
  const [entry] = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });
  expect(entry).toMatchObject({ value: false, label: 'Avoiding a trap or ambush (Danger Sense: Edge)' });
  expect(switchNames(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(tick(actor, {})).toMatchObject({ edge: true });
  expect(switchNames(holder([]), {})).toEqual([]);
});

test('Nothing Personal: an Edge switch, off by default, on any roll', () => {
  const actor = holder(['iafav2items/_source/Nothing_Personal_WsB4CydGzKF2g7Yi.json']);
  const [entry] = ruleDialogSwitches(actor, { rolledSkill: 'persuasion' });
  expect(entry).toMatchObject({ value: false, label: 'Winning over a new Contact (Nothing Personal: Edge)' });
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toHaveLength(1);
  expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ edge: true });
});

/* grants2 batch (helpers/social-rolls.mjs, helpers/action-perks.mjs): MLP Bowl-Over and Agreeable as roll rules,
   Prowl (Mini-Con Perk) as an ActionCost. */

test('Bowl-Over (MLP Animal Perk): Edge on a shove, and on nothing else', () => {
  const pet = holder(['mlpcrbitems/_source/Bowl_Over_BysTCPE8xJCT2nsM.json']);
  expect(ruleRollSources(pet, null, { isShove: true }).sources[0]).toMatchObject({ label: 'Bowl-Over', edge: true, shiftUp: 0 });
  expect(ruleRollSources(pet, null, { dataset: { isShove: true } }).sources[0]).toMatchObject({ edge: true });
  expect(ruleRollSources(pet, null, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('Agreeable (MLP Animal Perk): ↑1 on Animal Handling rolled against the pet, by anyone', () => {
  const pet = holder(['mlpcrbitems/_source/Agreeable_YMG6nH32Y8yaYqZ9.json']);
  const roller = holder([]);
  expect(ruleRollSources(roller, pet, { rolledSkill: 'animalHandling' }).sources[0]).toMatchObject({ label: 'Agreeable', shiftUp: 1, edge: false });
  expect(ruleRollSources(roller, pet, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(ruleRollSources(roller, null, { rolledSkill: 'animalHandling' }).sources).toEqual([]);
  expect(ruleRollSources(pet, null, { rolledSkill: 'animalHandling' }).sources).toEqual([]);
});

test('Prowl (Mini-Con Perk): Hide is a Free action for a companion holding it, no limit, no question', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const miniCon = holder(['dditems/_source/Prowl_asauzG2f81zWbOxu.json']);
  miniCon.type = 'companion';
  const [rule, more] = costRulesFor(miniCon).filter(r => r.matches({ key: 'hide' }));
  expect(more).toBeUndefined();
  expect(rule).toMatchObject({ label: 'Prowl' });
  expect(rule.limit).toBeUndefined();
  expect(rule.ask).toBeUndefined();
  expect(rule.to()).toBe('free');
  expect(costRulesFor(miniCon).filter(r => r.matches({ key: 'sprint' }))).toEqual([]);
  miniCon.type = 'playerCharacter';
  expect(costRulesFor(miniCon).filter(r => r.matches({ key: 'hide' }))).toEqual([]);
});

/* perkadd slice: what perk-handler.mjs did when these Perks were added, now rules on the Perks. */

test('Natural Science: Qualified and Trained with Element weapons while held', () => {
  const file = 'ccitems/_source/Natural_Science_AXmmcHK2tSzRZLqB.json';
  const system = () => ({ qualified: { weapons: { element: false, heavy: false } }, trained: { weapons: { element: false, heavy: false } } });
  const actor = holder([file], { system: system() });
  ruleDerived(actor);
  expect(actor.system.qualified.weapons.element).toBeTruthy();
  expect(actor.system.trained.weapons.element).toBeTruthy();
  expect(actor.system.trained.weapons.heavy).toBe(false);

  const without = holder([], { system: system() });
  ruleDerived(without);
  expect(without.system.qualified.weapons.element).toBe(false);
  expect(without.system.trained.weapons.element).toBe(false);
});

test('Speak Your Truth: Persuasion also draws from the chosen Essence - Strength, Speed or Smarts', async () => {
  const { choiceOptions } = await import('./lifecycle.mjs');
  const file = 'mlpcrbitems/_source/Speak_Your_Truth_ki9HVmle77qJ5Yo8.json';
  const system = () => ({ skills: { persuasion: { essences: { social: true, strength: false, speed: false, smarts: false } } } });
  const [choice] = fromPack(file).system.rules.filter(rule => rule.type == 'ChoiceSet');
  expect(choiceOptions(choice).map(option => option.value)).toEqual(['strength', 'speed', 'smarts']);

  for (const essence of ['strength', 'speed', 'smarts']) {
    const actor = holder([file], { system: system() });
    actor.items.contents[0].flags = { essence20: { rules: { choices: { essence } } } };
    ruleDerived(actor);
    const { essences } = actor.system.skills.persuasion;
    expect(Object.keys(essences).filter(key => essences[key])).toEqual(['social', essence]);
  }

  // Nothing picked (the dialog was closed): Persuasion is unchanged.
  const unpicked = holder([file], { system: system() });
  ruleDerived(unpicked);
  expect(unpicked.system.skills.persuasion.essences).toEqual({ social: true, strength: false, speed: false, smarts: false });
});

test('Sorcery: grants Cost of Sorcery, unless the actor already has one', async () => {
  const { grantData } = await import('./lifecycle.mjs');
  const saved = global.foundry.utils;
  global.foundry.utils = {
    ...saved,
    setProperty: (object, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
    },
  };
  try {
    const cost = 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.BRpf0FNey5oDEvq3';
    const actor = holder(['fmmcitems/_source/Sorcery_xUBOE1s5pgVyUrwj.json']);
    const [sorcery] = actor.items.contents;
    const load = async id => (id == cost ? { toObject: () => ({ _id: 'x', name: 'Cost of Sorcery', type: 'hangUp', system: {} }) } : null);
    const granted = await grantData(sorcery, actor, { load });
    expect(granted).toEqual([expect.objectContaining({ type: 'hangUp', _stats: { compendiumSource: cost }, flags: { essence20: { grantedBy: sorcery.id } } })]);
    actor.items.contents.push({ id: 'owned', type: 'hangUp', flags: { core: { sourceId: cost } }, system: {} });
    expect(await grantData(sorcery, actor, { load })).toEqual([]);
  } finally {
    global.foundry.utils = saved;
  }
});

/* qualify1 / qualify2 round 2: upgrade Qualifications (Qualification `upgrades`), and "Qualified in all
   Standard weapons" read from the effective Availability tier (item:availability<=standard). */

const q2Weapon = (availability, total = availability, items = {}) => ({ type: 'weapon', name: 'Gun', flags: {}, system: { availability, totalAvailability: total, traits: [], items } });
const q2Entry = (id, name, availability = 'limited') => ({ type: 'upgrade', name, uuid: `Compendium.essence20.gi_joe_crb.Item.${id}`, availability });
// holder()'s items aren't a Collection; the qualify1 hook body filters them like one.
const q2Filterable = actor => Object.assign(actor, { items: Object.assign(actor.items, { filter: fn => actor.items.contents.filter(fn) }) });
const q2Upgrade = (name, type = 'weapon', source = null) => ({ type: 'upgrade', name, flags: source ? { core: { sourceId: source } } : {}, system: { type, availability: 'limited' } });

test('Standard Weapon Training: Qualified in Standard (and Automatic) weapons, by the combined Availability', () => {
  const actor = holder(['fgtaaitems/_source/Standard_Weapon_Training_eDycLymLyvCZIrei.json']);
  expect(ruleRequisitionAccess(actor, q2Weapon('standard'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, q2Weapon('automatic'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, q2Weapon('limited'))).toBeNull();
  // An upgrade that raised the combined Availability counts, unless it is one the actor is Qualified in.
  expect(ruleRequisitionAccess(actor, q2Weapon('standard', 'limited'))).toBeNull();
  expect(ruleRequisitionAccess(actor, { type: 'armor', name: 'Vest', flags: {}, system: { availability: 'standard' } })).toBeNull();
});

test('Standard Weapon Training + Minimalists: a Qualified upgrade leaves the stacking, so the weapon is Standard again', async () => {
  const { onRequisitionAvailability } = await import('../helpers/extensions/qualify1/qualification.mjs');
  const matrix = CONFIG.E20.upgradeAvailabilityMatrix;
  const call = globalThis.Hooks.call;
  CONFIG.E20.upgradeAvailabilityMatrix = { standard: { standard: 'standard', limited: 'limited' }, limited: { standard: 'limited', limited: 'limited' } };
  globalThis.Hooks.call = (hook, ...args) => {
    if (hook == 'essence20.requisitionAvailability') {
      onRequisitionAvailability(...args);
    }

    return true;
  };

  try {
    const gun = q2Weapon('standard', 'limited', { u: q2Entry('ihSql0Px1kNgTBfP', 'Microtech Weapon') });
    const alone = q2Filterable(holder(['fgtaaitems/_source/Standard_Weapon_Training_eDycLymLyvCZIrei.json']));
    expect(requisitionTier(alone, gun)).toBe('limited');
    expect(ruleRequisitionAccess(alone, gun)).toBeNull();
    const both = q2Filterable(holder(['fgtaaitems/_source/Standard_Weapon_Training_eDycLymLyvCZIrei.json', 'ccitems/_source/Minimalists_38e9TBYm8XB4pGoj.json']));
    expect(requisitionTier(both, gun)).toBe('standard');
    expect(ruleRequisitionAccess(both, gun)).toBe('qualified');
  } finally {
    globalThis.Hooks.call = call;
    CONFIG.E20.upgradeAvailabilityMatrix = matrix;
  }
});

test('Minimalists: Qualified in the Microtech upgrades, by compendium id or name', () => {
  const actor = holder(['ccitems/_source/Minimalists_38e9TBYm8XB4pGoj.json']);
  expect(ruleQualifiedUpgrade(actor, q2Entry('ihSql0Px1kNgTBfP', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, { ...q2Entry('ERqpa98s445vypnL', 'Anything'), uuid: 'Compendium.essence20.cobra_codex.Item.ERqpa98s445vypnL' })).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('zzzzzzzzzzzzzzzz', 'Microtech Armor'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Microtech Battledress', 'armor'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('zXPxC1yLlK2xgGEl', 'Traumatic'))).toBe(false);
  expect(ruleQualifiedUpgrade(holder([]), q2Entry('ihSql0Px1kNgTBfP', 'Microtech Weapon'))).toBe(false);
  // Upgrades only: no item access of its own.
  expect(ruleRequisitionAccess(actor, q2Weapon('standard'))).toBeNull();
});

test('Mega Training Regimen: Qualified in the Organic Armor upgrade', () => {
  const actor = holder(['fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json']);
  expect(ruleQualifiedUpgrade(actor, q2Entry('W6fiSzyPOE2VGj8k', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Organic Armor', 'armor'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('7qniIaOGp8Mqwt6O', 'Biomechanical Weapon'))).toBe(false);
});

test('Roaming the Land: Qualified in the Traumatic upgrade', () => {
  const actor = holder(['fffav1items/_source/Roaming_the_Land_jdQFjlYUHaRze6as.json']);
  expect(ruleQualifiedUpgrade(actor, q2Entry('zXPxC1yLlK2xgGEl', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('traumatic'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('ihSql0Px1kNgTBfP', 'Microtech Weapon'))).toBe(false);
});

test('Surgical Operators: Qualified in Anti-V.E.N.O.M. (id or name) and the Rebreather (name only, exact)', () => {
  const actor = holder(['fffav1items/_source/Surgical_Operators_JtRCN6ppDatZVmav.json']);
  expect(ruleQualifiedUpgrade(actor, q2Entry('3X0MqAV7JsYEiv5A', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Anti-V.E.N.O.M.'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('zzzzzzzzzzzzzzzz', 'Rebreather'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Rebreather Mk II', 'armor'))).toBe(false);
});

test('The Glory of Cobra-La: Standard weapons, and the Organic Armor / Biomechanical Weapon upgrades', () => {
  const actor = holder(['fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json']);
  expect(ruleRequisitionAccess(actor, q2Weapon('standard'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, q2Weapon('limited'))).toBeNull();
  expect(ruleQualifiedUpgrade(actor, q2Entry('W6fiSzyPOE2VGj8k', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('7qniIaOGp8Mqwt6O', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Biomechanical Weapon'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('CaYTsrxD2JEs2dQM', 'Pythonized'))).toBe(false);
});

test('Ultra-Secret Strike Force: Standard weapons, and the Pythonized upgrade', () => {
  const actor = holder(['fffav1items/_source/Ultra_Secret_Strike_Force_4Gd5yet4c24yjWtY.json']);
  expect(ruleRequisitionAccess(actor, q2Weapon('automatic'))).toBe('qualified');
  expect(ruleRequisitionAccess(actor, q2Weapon('restricted'))).toBeNull();
  expect(ruleQualifiedUpgrade(actor, q2Entry('CaYTsrxD2JEs2dQM', 'Anything'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Pythonized', 'armor'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Entry('W6fiSzyPOE2VGj8k', 'Organic Armor'))).toBe(false);
});

test('Oorah!: Qualified in the G.I. Joe CRB Silent battledress upgrade, or an armor upgrade Item named Silent', () => {
  const actor = holder(['sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json']);
  const silent = 'Compendium.essence20.gi_joe_crb.Item.nftZIaQ3MVn2nviU';
  expect(ruleQualifiedUpgrade(actor, { uuid: silent })).toBe(true);
  expect(ruleQualifiedUpgrade(actor, { uuid: 'Compendium.essence20.other.Item.nftZIaQ3MVn2nviU' })).toBe(false);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Silent', 'armor'))).toBe(true);
  expect(ruleQualifiedUpgrade(actor, q2Upgrade('Silent', 'weapon'))).toBe(false);
  // An attached entry carries no upgrade type, so only the uuid counts (as before).
  expect(ruleQualifiedUpgrade(actor, { uuid: 'Actor.a.Item.b', name: 'Silent', type: 'upgrade' })).toBe(false);
  expect(ruleQualifiedUpgrade(holder([]), { uuid: silent })).toBe(false);
});

/* Batch tfzord (tf2 + zord2 slices): Roller Drum's Bot Mode Stun, the loose Obscuring Matrix. */

test('Roller Drum: Unarmed Combat deals +1 Stun in Bot Mode', () => {
  const fist = { type: 'weaponEffect', system: { damageType: 'stun' }, flags: {} };
  const punch = { type: 'weaponEffect', system: { damageType: 'stun' }, flags: { essence20: { parentId: 'w' } } };
  const previous = global.fromUuidSync;
  global.fromUuidSync = uuid => ({ 'Item.fist': fist, 'Item.punch': punch })[uuid] ?? null;
  const actor = holder(['eocitems/_source/Roller_Drum_Hjo7mZ7eLs8EwKeu.json'], { system: { isTransformed: false } });
  const weapon = { id: 'w', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy' } }, system: {} };
  punch.parent = { items: { get: id => (id == 'w' ? weapon : undefined) } };
  const notes = [];
  const tools = { damageBonusNote: (result, amount, label) => notes.push([amount, label]) };
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 1, damageType: 'stun' }, { itemUuid: 'Item.fist', style: 'melee' }, tools);
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 1, damageType: 'stun' }, { itemUuid: 'Item.punch', style: 'melee' }, tools);
  expect(notes).toEqual([[1, 'Roller Drum'], [1, 'Roller Drum']]);
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 1, damageType: 'blunt' }, { itemUuid: 'Item.fist', style: 'melee' }, tools);
  weapon.flags.core.sourceId = 'Compendium.essence20.tf_crb.Item.other';
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 1, damageType: 'stun' }, { itemUuid: 'Item.punch', style: 'melee' }, tools);
  actor.system.isTransformed = true;
  ruleDamageDealt(actor, { statuses: new Set() }, { damageValue: 1, damageType: 'stun' }, { itemUuid: 'Item.fist', style: 'melee' }, tools);
  expect(notes).toHaveLength(2);
  global.fromUuidSync = previous;
});

test('Obscuring Matrix: a loose (chassis) copy is negated while Grappled, Immobilized, Prone or Restrained', () => {
  const defenses = () => ({ evasion: { total: 14, string: '14' } });
  const basic = 'eocitems/_source/Obscuring_Matrix__Basic__L8ZXz1h0DlCy85UC.json';
  const prone = holder([basic], { statuses: ['prone'], system: { canTransform: true, isTransformed: false, defenses: defenses() } });
  ruleDerived(prone);
  expect(prone.system.defenses.evasion).toEqual({ total: 12, string: '14 - 2 (Obscuring Matrix (Basic))' });
  const advanced = holder(['eocitems/_source/Obscuring_Matrix__Advanced__HH4q8lx09mV2hhcv.json'], { statuses: ['restrained'], system: { canTransform: true, defenses: defenses() } });
  ruleDerived(advanced);
  expect(advanced.system.defenses.evasion.total).toBe(10);
  const standing = holder([basic], { system: { canTransform: true, defenses: defenses() } });
  ruleDerived(standing);
  expect(standing.system.defenses.evasion.total).toBe(14);
  // documents/item.mjs negates a copy fitted to armor; a non-Cybertronian never got the loose bonus.
  const fitted = holder([basic], { statuses: ['prone'], system: { canTransform: true, defenses: defenses() } });
  fitted.items.contents[0].flags = { essence20: { parentId: 'armor' } };
  ruleDerived(fitted);
  expect(fitted.system.defenses.evasion.total).toBe(14);
  const human = holder([basic], { statuses: ['prone'], system: { canTransform: false, defenses: defenses() } });
  ruleDerived(human);
  expect(human.system.defenses.evasion.total).toBe(14);
});

/* Bestial Articulation: the Monstrosity Alt Modes' ↓1 switch, only while converted into that Alt Mode (rule:altMode). */

test('Bestial Articulation: a ↓1 switch only while converted into this Monstrosity Alt Mode', async () => {
  const { evaluateTag, contextFor } = await import('./predicate.mjs');
  const rule = fromPack('tsitems/_source/Monstrosity__Huge__Aquatic__Rk3mT9vQx2LpW7nZ.json').system.rules.find(r => r.type == 'DialogSwitch');
  expect(rule).toMatchObject({ type: 'DialogSwitch', downshift: 1, when: ['rule:altMode'] });
  const mode = { id: 'mon' };
  const beast = { system: { isTransformed: true, altModeId: 'mon' } };
  expect(evaluateTag('rule:altMode', contextFor({ self: beast, ruleItem: mode }))).toBe(true);
  expect(evaluateTag('rule:altMode', contextFor({ self: { system: { isTransformed: false, altModeId: 'mon' } }, ruleItem: mode }))).toBe(false);
  expect(evaluateTag('rule:altMode', contextFor({ self: { system: { isTransformed: true, altModeId: 'car' } }, ruleItem: mode }))).toBe(false);
});

/* Better Aim (AimBonus): Distance Vision, Dig In - and roll:aimed. */

test('Distance Vision: the first aimed shot each turn gives ↑2; spent only when fired aimed', async () => {
  const { ruleAimBonus } = await import('./adapter.mjs');
  const actor = holder(['wtnvcgitems/_source/' + readdirOf('wtnvcgitems').find(n => n.endsWith('_cdFa6pHVLWLsWMpL.json'))]);
  actor.flags = { essence20: {} };
  actor.getFlag = (scope, key) => key.split('.').reduce((at, part) => at?.[part], actor.flags[scope]);
  actor.setFlag = async (scope, key, value) => {
    const parts = key.split('.');
    const at = parts.slice(0, -1).reduce((o, part) => (o[part] ??= {}), actor.flags[scope] ??= {});
    at[parts.at(-1)] = value;
  };

  game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  const first = ruleAimBonus(actor, null, { item: ranged });
  expect(first.atLeast).toBe(2);
  expect(ruleAimBonus(actor, null, { item: ranged }).atLeast).toBe(2);
  await first.spend();
  expect(ruleAimBonus(actor, null, { item: ranged }).atLeast).toBe(0);
  game.combat = { id: 'c1', started: true, round: 1, turn: 1 };
  expect(ruleAimBonus(actor, null, { item: ranged }).atLeast).toBe(2);
  delete game.combat;
});

test('Dig In: Aiming gives ↑2 only while dug in', async () => {
  const { ruleAimBonus } = await import('./adapter.mjs');
  const files = ['eocitems'].map(dir => `${dir}/_source/` + readdirOf(dir).find(n => n.endsWith('_RQjNiRZxDFwTPHN8.json')));
  const actor = holder(files);
  actor.flags = { essence20: {} };
  actor.getFlag = (scope, key) => key.split('.').reduce((at, part) => at?.[part], actor.flags[scope]);
  actor.setFlag = async (scope, key, value) => {
    const parts = key.split('.');
    const at = parts.slice(0, -1).reduce((o, part) => (o[part] ??= {}), actor.flags[scope] ??= {});
    at[parts.at(-1)] = value;
  };

  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  expect(ruleAimBonus(actor, null, { item: ranged }).atLeast).toBe(0);
  actor.flags.essence20.cannoneerDugIn = true;
  expect(ruleAimBonus(actor, null, { item: ranged }).atLeast).toBe(2);
});

test('roll:aimed: a ranged attack the Aim action was taken for, or what the roll says', async () => {
  const { contextFor, evaluateTag, setWorldLookups } = await import('./predicate.mjs');
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
  const me = { id: 'me' };
  setWorldLookups({ isAiming: actor => actor === me });
  expect(evaluateTag('roll:aimed', contextFor({ self: me, item: ranged }))).toBe(true);
  expect(evaluateTag('roll:aimed', contextFor({ self: me, item: melee }))).toBe(false);
  expect(evaluateTag('roll:aimed', contextFor({ self: { id: 'other' }, item: ranged }))).toBe(false);
  expect(evaluateTag('roll:aimed', contextFor({ self: me, item: ranged, aimed: false }))).toBe(false);
  setWorldLookups({ isAiming: undefined });
});

test('Calculated Attack: once primed, Aiming with the Long Range Rifle gives ↑2, and firing aimed clears it', async () => {
  const { ruleAimBonus } = await import('./adapter.mjs');
  const actor = holder(['tfcrbitems/_source/Calculated_Attack_hYWoZnrFKaVTZFuG.json']);
  const perk = actor.items.contents[0];
  perk.update = async data => Object.entries(data).forEach(([key, value]) => {
    const parts = key.split('.');
    parts.slice(0, -1).reduce((o, part) => (o[part] ??= {}), perk)[parts.at(-1)] = value;
  });
  const rifle = { id: 'w1', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.8Hi76APCo9QRnbLE' } } };
  const pistol = { id: 'w2', type: 'weapon', flags: {} };
  actor.items.contents.push(rifle, pistol);
  const shot = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, parent: actor, system: { classification: { style: 'projectile' } } };
  const other = { type: 'weaponEffect', flags: { essence20: { parentId: 'w2' } }, parent: actor, system: { classification: { style: 'projectile' } } };
  expect(ruleAimBonus(actor, null, { item: shot }).atLeast).toBe(0);
  perk.flags.essence20 = { rules: { toggles: { primed: true } } };
  expect(ruleAimBonus(actor, null, { item: other }).atLeast).toBe(0);
  const primed = ruleAimBonus(actor, null, { item: shot });
  expect(primed.atLeast).toBe(2);
  await primed.spend();
  expect(ruleAimBonus(actor, null, { item: shot }).atLeast).toBe(0);
  expect(perk.system.rules[0].steps[1].options.map(o => o.steps[0].difDefense)).toEqual(['evasion', 'cleverness']);
});

test('In My Sights: on an aimed shot, an Edge instead of the Aim bonus', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['gijcrbitems/_source/In_My_Sights_MD54SjlTYiCTvmBB.json']);
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  setWorldLookups({ isAiming: () => false });
  expect(switchNames(actor, { item: ranged })).toEqual([]);
  setWorldLookups({ isAiming: () => true });
  expect(switchNames(actor, { item: ranged })).toHaveLength(1);
  const options = tick(actor, { item: ranged }, { isAiming: true });
  expect(options.edge).toBe(true);
  expect(options.isAiming).toBe(false);
  setWorldLookups({ isAiming: undefined });
});

test('Unshakeable Aim: a paid ↑2 switch on ranged attacks, instead of the Aim bonus; not offered without Power', async () => {
  const actor = holder(['fmmcitems/_source/' + readdirOf('fmmcitems').find(n => n.endsWith('_RJ6xBZuDXSELI0rJ.json'))], { system: { powers: { personal: { value: 1, max: 3 } } } });
  actor.update = async data => Object.entries(data).forEach(([key, value]) => {
    const parts = key.split('.');
    parts.slice(0, -1).reduce((o, part) => (o[part] ??= {}), actor)[parts.at(-1)] = value;
  });
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
  expect(switchNames(actor, { item: melee })).toEqual([]);
  expect(switchNames(actor, { item: ranged })).toHaveLength(1);
  const name = ruleDialogSwitches(actor, { item: ranged })[0].name;
  const options = { shiftUp: 0, shiftDown: 0, isAiming: true, ext: { [name]: true } };
  await applyRuleSwitches(actor, options, { item: ranged });
  expect([options.shiftUp, options.isAiming, actor.system.powers.personal.value]).toEqual([2, false, 0]);
  expect(switchNames(actor, { item: ranged })).toEqual([]);
});

test("Long Shot and Sharpshooter's Grace: no long-range Snag on ranged attacks; Grace's ↑2 by distance, per printing", async () => {
  const { ruleNoLongRangeSnag } = await import('./adapter.mjs');
  const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
  const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
  const at = (actor, target, feet) => {
    const own = { center: { x: 0, y: 0 } };
    const theirs = { center: { x: feet, y: 0 } };
    actor.getActiveTokens = () => [own];
    target.getActiveTokens = () => [theirs];
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  };

  const target = { id: 't' };
  const longShot = holder(['tfcrbitems/_source/' + readdirOf('tfcrbitems').find(n => n.endsWith('_Q3KK4HYhwjk52kle.json'))]);
  expect(ruleNoLongRangeSnag(longShot, target, { item: ranged })).toBe(true);
  expect(ruleNoLongRangeSnag(longShot, target, { item: melee })).toBe(false);
  const upshift = (actor, feet) => {
    at(actor, target, feet);
    global.game.user = { targets: new Set([{ actor: target }]) };
    return ruleRollSources(actor, target, { item: ranged }).sources.reduce((sum, source) => sum + (source.shiftUp || 0), 0);
  };

  const pr = holder(['prcrbitems/_source/' + readdirOf('prcrbitems').find(n => n.endsWith('_wgkspIBc4HcOfKDu.json'))]);
  const tf = holder(['tfcrbitems/_source/' + readdirOf('tfcrbitems').find(n => n.endsWith('_cVyIxoXOZhwrBBBD.json'))]);
  const gij = holder(['gijcrbitems/_source/' + readdirOf('gijcrbitems').find(n => n.endsWith('_3yBdQyZ0MulUqcsT.json'))]);
  expect(ruleNoLongRangeSnag(pr, target, { item: ranged })).toBe(true);
  expect([upshift(pr, 20), upshift(pr, 50)]).toEqual([2, 0]);
  expect([upshift(tf, 20), upshift(tf, 50)]).toEqual([0, 2]);
  expect([upshift(gij, 20), upshift(gij, 50)]).toEqual([0, 2]);
  delete global.canvas;
  global.game.user = { targets: new Set() };
});

test("Piercing Shot: crit on the d2 with an Edge - GI Joe on a sniper weapon, Transformers Specialized with the Long Range Rifle", async () => {
  const { ruleCritD2 } = await import('./adapter.mjs');
  const gij = holder(['gijcrbitems/_source/' + readdirOf('gijcrbitems').find(n => n.endsWith('_W4PmkxBW7m3j88oF.json'))]);
  const sniper = { id: 'w1', type: 'weapon', flags: {}, system: { traits: ['sniper'] } };
  const pistol = { id: 'w2', type: 'weapon', flags: {}, system: { traits: [] } };
  gij.items.contents.push(sniper, pistol);
  const shot = weapon => ({ type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, parent: gij, system: { classification: { style: 'projectile' } } });
  expect(ruleCritD2(gij, null, { item: shot(sniper), edge: true })).toBe(true);
  expect(ruleCritD2(gij, null, { item: shot(sniper), edge: false })).toBe(false);
  expect(ruleCritD2(gij, null, { item: shot(pistol), edge: true })).toBe(false);
  const tf = holder(['tfcrbitems/_source/' + readdirOf('tfcrbitems').find(n => n.endsWith('_DEP9LhBOMtC0cSVO.json'))]);
  const rifle = { id: 'r1', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.8Hi76APCo9QRnbLE' } }, system: { traits: [] } };
  tf.items.contents.push(rifle);
  const rifleShot = { type: 'weaponEffect', flags: { essence20: { parentId: 'r1' } }, parent: tf, system: { classification: { style: 'projectile' } } };
  expect(ruleCritD2(tf, null, { item: rifleShot, edge: true, dataset: { isSpecialized: true } })).toBe(true);
  expect(ruleCritD2(tf, null, { item: rifleShot, edge: true, dataset: { isSpecialized: false } })).toBe(false);
  expect(ruleCritD2(tf, null, { item: rifleShot, edge: false, dataset: { isSpecialized: true } })).toBe(false);
});

/* The d2-crit Perks (CritOnD2). */

describe("crit on the d2", () => {
  // The pack file holding this item (only the packs with a _source folder).
  const file = id => {
    for (const dir of readdirSync(join(ROOT, 'packs'))) {
      let names = [];
      try {
        names = readdirOf(dir);
      } catch {
        continue;
      }

      const name = names.find(n => n.endsWith(`_${id}.json`));
      if (name) {
        return `${dir}/_source/${name}`;
      }
    }

    return null;
  };

  // An actor holding the item (plus any extra items, e.g. a weapon), asked about this roll.
  const crit = async (id, roll, target = null, extra = []) => {
    const { ruleCritD2 } = await import('./adapter.mjs');
    const actor = holder([file(id)]);
    for (const x of extra) {
      x.parent = actor;
      actor.items.contents.push(x);
    }

    if (roll.item) {
      roll.item.parent = actor;
    }

    return ruleCritD2(actor, target, roll);
  };

  const attack = (extra = {}) => ({ type: 'weaponEffect', flags: {}, system: { classification: { skill: 'targeting', style: 'projectile' }, damageType: 'sharp', ...extra } });

  test("Assault Precision: shotguns and submachine guns", async () => {
    const gun = id => ({ id: 'w' + id, type: 'weapon', flags: { core: { sourceId: `Compendium.essence20.gi_joe_crb.Item.${id}` } }, system: { traits: [] } });
    const shot = id => ({ ...attack(), flags: { essence20: { parentId: 'w' + id } } });
    expect(await crit('KZAmBNsIW03H6xQh', { item: shot('2qW1YLopvjKyezNQ') }, null, [gun('2qW1YLopvjKyezNQ')])).toBe(true);
    expect(await crit('KZAmBNsIW03H6xQh', { item: shot('oJInlAgdYZzjH7bk') }, null, [gun('oJInlAgdYZzjH7bk')])).toBe(true);
    expect(await crit('KZAmBNsIW03H6xQh', { item: shot('xxxxxxxxxxxxxxxx') }, null, [gun('xxxxxxxxxxxxxxxx')])).toBe(false);
  });

  test("Coin Toss: Might attacks only", async () => {
    expect(await crit('NQULhy8KargPMUTX', { item: attack({ classification: { skill: 'might', style: 'melee' } }) })).toBe(true);
    expect(await crit('NQULhy8KargPMUTX', { item: attack() })).toBe(false);
  });

  test("Ripple Effect: a blade or bludgeon against a vehicle", async () => {
    const vehicle = { type: 'vehicle', statuses: new Set() };
    expect(await crit('GY9fkASnSzkQIYKC', { item: attack({ damageType: 'blunt' }) }, vehicle)).toBe(true);
    expect(await crit('GY9fkASnSzkQIYKC', { item: attack({ damageType: 'energy' }) }, vehicle)).toBe(false);
    expect(await crit('GY9fkASnSzkQIYKC', { item: attack({ damageType: 'blunt' }) }, { type: 'npc', statuses: new Set() })).toBe(false);
  });

  test("Forward Observation (TF): Alertness against a Surprised target", async () => {
    expect(await crit('c3yk9hNPVKwogzQn', { rolledSkill: 'alertness' }, { statuses: new Set(['surprised']) })).toBe(true);
    expect(await crit('c3yk9hNPVKwogzQn', { rolledSkill: 'alertness' }, { statuses: new Set() })).toBe(false);
    expect(await crit('c3yk9hNPVKwogzQn', { rolledSkill: 'athletics' }, { statuses: new Set(['surprised']) })).toBe(false);
  });

  test("Let Cool Heads Prevail: Specialized Social tests out of combat", async () => {
    const roll = (specialized, essence = 'social') => ({ rolledSkill: 'persuasion', rolledEssence: essence, dataset: { isSpecialized: specialized } });
    expect(await crit('roPkOVTlYMpd675h', roll(true))).toBe(true);
    expect(await crit('roPkOVTlYMpd675h', roll(false))).toBe(false);
    expect(await crit('roPkOVTlYMpd675h', roll(true, 'smarts'))).toBe(false);
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    expect(await crit('roPkOVTlYMpd675h', roll(true))).toBe(false);
    game.combat = null;
  });

  test("Miracle Worker, Technical Mastery, Fancy Flier, Perimeter Defender: their Skills", async () => {
    expect(await crit('B4fDw9HuMS7qAjs7', { rolledSkill: 'science' })).toBe(true);
    expect(await crit('B4fDw9HuMS7qAjs7', { rolledSkill: 'medicine' })).toBe(false);
    expect(await crit('QKlXoVgNMq7Kv58L', { rolledSkill: 'technology' })).toBe(true);
    expect(await crit('QKlXoVgNMq7Kv58L', { rolledSkill: 'science' })).toBe(false);
    expect(await crit('xeEHwZBS3atzUCb4', { rolledSkill: 'driving' })).toBe(true);
    expect(await crit('xeEHwZBS3atzUCb4', { rolledSkill: 'athletics' })).toBe(false);
    expect(await crit('MXW4BmGWCfuV1Lu9', { rolledSkill: 'alertness' })).toBe(true);
    const defender = holder([file('q0kAj4RnX64JZvAG')]);
    expect(ruleSpecializes(defender, 'alertness')).toBe(true);
    expect(ruleSpecializes(defender, 'athletics')).toBe(false);
  });
});

test("Eureka: crit on the d2 on the Skill chosen as the Field; Competitive Strength: on Brawn", async () => {
  const { ruleCritD2 } = await import('./adapter.mjs');
  const actor = holder(['gijcrbitems/_source/Eureka_I8gudNc8gLD63ziL.json']);
  expect(ruleCritD2(actor, null, { rolledSkill: 'technology' })).toBe(false);
  actor.items.contents.push({ id: 'field', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C' } }, system: { choice: 'technology' } });
  expect(ruleCritD2(actor, null, { rolledSkill: 'technology' })).toBe(true);
  expect(ruleCritD2(actor, null, { rolledSkill: 'science' })).toBe(false);
  const strong = holder(['jttitems/_source/Competitive_Strength_J0ljd1QnU9AgoWj6.json']);
  expect(ruleCritD2(strong, null, { rolledSkill: 'brawn' })).toBe(true);
  expect(ruleCritD2(strong, null, { rolledSkill: 'athletics' })).toBe(false);
});

/* diceB: dice.mjs region B (rollSkill after the Roll Options Dialog). */

test('Investigator: no Snag on Alertness, whatever set it', () => {
  const actor = holder(['fgtaaitems/_source/Investigator_eI07csKf4P0lC2DS.json']);
  const snagAfter = (who, rolledSkill) => {
    const options = { snag: true, shiftDown: 0 };
    applyRuleImmunity(who, options, { rolledSkill });
    return options.snag;
  };

  expect(snagAfter(actor, 'alertness')).toBe(false);
  expect(snagAfter(actor, 'athletics')).toBe(true);
  expect(snagAfter(holder([]), 'alertness')).toBe(true);
  // An immunity only - nothing is listed in the dialog.
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
});

test('Quiet (Hang-Up): a Snag on Intimidation', () => {
  const actor = holder(['ghpfitems/_source/Quiet_6RR2OYWSWrhZv02r.json']);
  expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources[0]).toMatchObject({ snag: true, label: 'Quiet (Snag on Intimidation)' });
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  expect(ruleRollSources(holder([]), null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
});

test('Trustworthy: +4 Cleverness against Deception only, per attack', () => {
  const defender = holder(['mlpcrbitems/_source/Trustworthy_oPMDDfBeK9VibPvW.json'], { system: { defenses: { cleverness: { total: 10 } } } });
  const attacker = holder([]);
  expect(ruleDefenseAdjust(attacker, defender, 'cleverness', { rolledSkill: 'deception' })).toBe(4);
  expect(ruleDefenseAdjust(attacker, defender, 'willpower', { rolledSkill: 'deception' })).toBe(0);
  expect(ruleDefenseAdjust(attacker, defender, 'cleverness', { rolledSkill: 'persuasion' })).toBe(0);
  expect(ruleDefenseAdjust(attacker, holder([]), 'cleverness', { rolledSkill: 'deception' })).toBe(0);
  // Not on the sheet: it reads the roll.
  ruleDerived(defender);
  expect(defender.system.defenses.cleverness.total).toBe(10);
});
/* misc5 batch: The Heavy (Toughness half) as a Defense rule; Energon Battery, Cybertroid Catalyst and Organic
   Energon as DerivedStat rules on the Energon pool _prepareEnergon() leaves at the lowest Essence. */

describe('misc5', () => {
  const armor = (classification, equipped = true) => ({ id: `ar${nextId++}`, type: 'armor', flags: {}, system: { equipped, classification } });
  const defenses = () => ({ toughness: { total: 15, string: '' }, evasion: { total: 12, string: '' } });

  test('The Heavy: +2 Toughness only while heavy or super heavy armor is equipped', () => {
    for (const [classification, equipped, toughness] of [['heavy', true, 17], ['ultraHeavy', true, 17], ['light', true, 15], ['medium', true, 15], ['heavy', false, 15]]) {
      const actor = holder(['gijcrbitems/_source/The_Heavy_rlD6YJSr2fgROKHo.json'], { system: { defenses: defenses() } });
      actor.items.contents.push(armor(classification, equipped));
      ruleDerived(actor);
      expect(actor.system.defenses.toughness.total).toBe(toughness);
      expect(actor.system.defenses.evasion.total).toBe(12);
    }

    const bare = holder(['gijcrbitems/_source/The_Heavy_rlD6YJSr2fgROKHo.json'], { system: { defenses: defenses() } });
    ruleDerived(bare);
    expect(bare.system.defenses.toughness.total).toBe(15);
  });

  // _prepareEnergon() has already set the pool to the lowest Essence (2) by the time rules run.
  const energon = (overrides = {}) => ({
    canTransform: true,
    essences: { strength: { value: 3 }, speed: { value: 5 }, smarts: { value: 2 }, social: { value: 4 } },
    energon: { normal: { max: 2 } },
    ...overrides,
  });
  const BATTERY = 'tfcrbitems/_source/Energon_Battery_mRwjbhGpqWu7hqDM.json';
  const CATALYST = 'dditems/_source/Cybertroid_Catalyst_WfrRHdgPpZiOLT8V.json';
  const ORGANIC = 'fgtaaitems/_source/Organic_Energon_ic1SwixGi3tstr5y.json';

  test('Energon Battery: the pool is the highest Essence instead of the lowest', () => {
    const actor = holder([BATTERY], { system: energon() });
    ruleDerived(actor);
    expect(actor.system.energon.normal.max).toBe(5);
    // Whatever was added after the lowest-Essence default (Mini-Con Master's Power Conduit) stays on top.
    const boosted = holder([BATTERY], { system: energon({ energon: { normal: { max: 3 } } }) });
    ruleDerived(boosted);
    expect(boosted.system.energon.normal.max).toBe(6);
    const vehicle = holder([BATTERY], { system: energon({ canTransform: false, energon: { normal: { max: 99 } } }) });
    ruleDerived(vehicle);
    expect(vehicle.system.energon.normal.max).toBe(99);
  });

  test('Cybertroid Catalyst: the second lowest Essence; Energon Battery wins when both are held', () => {
    const actor = holder([CATALYST], { system: energon() });
    ruleDerived(actor);
    expect(actor.system.energon.normal.max).toBe(3); // sorted [2, 3, 4, 5]
    const both = holder([BATTERY, CATALYST], { system: energon() });
    both.items.contents[0].flags = { core: { sourceId: 'Compendium.essence20.tf_crb.Item.mRwjbhGpqWu7hqDM' } };
    ruleDerived(both);
    expect(both.system.energon.normal.max).toBe(5);
  });

  test('Organic Energon: half the lowest Essence for a character who cannot transform', () => {
    const actor = holder([ORGANIC], { system: energon({ canTransform: false, energon: { normal: { max: 99 } } }) });
    ruleDerived(actor);
    expect(actor.system.energon.normal.max).toBe(1); // floor(2 / 2)
    const robot = holder([ORGANIC], { system: energon() });
    ruleDerived(robot);
    expect(robot.system.energon.normal.max).toBe(2); // a transforming actor keeps the lowest, unhalved
  });

  test('Science Kit and Travel Reporter Kit: a Grant rule hands over what comes inside', async () => {
    const { grantData } = await import('./lifecycle.mjs');
    const utils = (global.foundry ??= {}).utils ??= {};
    utils.setProperty ??= (object, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
    };

    for (const [file, uuid, name] of [
      ['wtnvcgitems/_source/Science_Kit_alcXH1wbroHciYlS.json', 'Compendium.essence20.wtnv_citizens_guide.Item.gDIWKiVdCNn5ViV0', 'Lab Coat'],
      ['wtnvcgitems/_source/Travel_Reporter_Kit_gG1nTctk40oLyJJH.json', 'Compendium.essence20.wtnv_citizens_guide.Item.ab9XMJpujnX7aRSS', 'Recording Microphone'],
    ]) {
      const doc = fromPack(file);
      const kit = { id: 'kit1', name: doc.name, type: doc.type, flags: {}, system: doc.system };
      const load = async wanted => (wanted == uuid ? { toObject: () => ({ _id: 'x', name, type: 'gear', system: {} }) } : null);
      const created = await grantData(kit, { items: { contents: [kit] } }, { load });
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({ name, _stats: { compendiumSource: uuid }, flags: { essence20: { grantedBy: 'kit1' } } });
      expect(created[0]._id).toBeUndefined();
    }
  });
});

/* Batch diceC: dice.mjs _getAutomaticCombatModifiers (region C) - incoming Maneuver/Alertness/Technology
   Snags and downshifts, Gallantry's Skill Test half, aerial-target Edges, Cruel / Rip and Tear's Edges,
   Ballistic Advantage's long-range immunity and the team-wide Focuser upshifts. */

const diceCWeapon = (actor, weapon, extra = {}) => {
  const effect = { type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { style: 'projectile' }, ...extra }, parent: actor };
  actor.items.contents.push(weapon);
  return effect;
};

const diceCAttack = (damageType, style = 'melee') => ({ type: 'weaponEffect', flags: {}, system: { classification: { style }, damageType } });

/** A defender holding these pack items, with these actor flags (flags.essence20). */
function diceCDefender(files, flags = {}, extra = {}) {
  const actor = holder(files, extra);
  actor.flags = { essence20: flags };
  return actor;
}

test.each([
  ['Dig In', 'dditems/_source/Dig_In_9tIkV50YiO3xqxvi.json', 'digInActive', { snag: true }],
  ['Unmovable', 'fmmcitems/_source/Unmovable_1aVrzJLiNkghFT4p.json', 'unmovableActive', { shiftDown: 3 }],
])('%s: a Maneuver attack against the holder in the stance', (name, file, flag, shifts) => {
  const roller = holder([]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: true }), { item: diceCAttack('maneuver') }).sources)
    .toEqual([expect.objectContaining({ ...shifts, label: name })]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: false }), { item: diceCAttack('maneuver') }).sources).toEqual([]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: true }), { item: diceCAttack('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(roller, diceCDefender([], { [flag]: true }), { item: diceCAttack('maneuver') }).sources).toEqual([]);
});

test('Mega Training Regimen: a Snag on a Maneuver attack against the holder, unconditionally', () => {
  const roller = holder([]);
  const target = holder(['fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json']);
  expect(ruleRollSources(roller, target, { item: diceCAttack('maneuver') }).sources).toEqual([expect.objectContaining({ snag: true, label: 'Mega Training Regimen' })]);
  expect(ruleRollSources(roller, target, { item: diceCAttack('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { item: diceCAttack('maneuver') }).sources).toEqual([]);
});

test('Steady Footing: ↓1 on a Maneuver or Grapple attack against the holder', () => {
  const roller = holder([]);
  const target = holder(['iafav2items/_source/Steady_Footing_U4bVJU5BpT3BTfSx.json']);
  expect(ruleRollSources(roller, target, { item: diceCAttack('maneuver') }).sources).toEqual([expect.objectContaining({ shiftDown: 1, label: 'Steady Footing' })]);
  expect(ruleRollSources(roller, target, { item: diceCAttack('grapple') }).sources).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(ruleRollSources(roller, target, { item: diceCAttack('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(roller, holder([]), { item: diceCAttack('maneuver') }).sources).toEqual([]);
});

test('Distraction: ↓1 on a ranged attack against the holder while active', () => {
  const roller = holder([]);
  const file = 'fmmcitems/_source/Distraction_mJu5IxoVrPjp8dVU.json';
  expect(ruleRollSources(roller, diceCDefender([file], { distractionActive: true }), { item: diceCAttack('blunt', 'projectile') }).sources)
    .toEqual([expect.objectContaining({ shiftDown: 1, label: 'Distraction' })]);
  expect(ruleRollSources(roller, diceCDefender([file], { distractionActive: true }), { item: diceCAttack('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(roller, diceCDefender([file], { distractionActive: false }), { item: diceCAttack('blunt', 'projectile') }).sources).toEqual([]);
});

test.each([
  ['Silent Strider', 'gijcrbitems/_source/Silent_Strider_C3KxTD37krYavSgw.json', 'infiltratingActive', 'alertness', 'deception'],
  ['Observer', 'ttsgitems/_source/Observer_PTkqeQ8D4x9cstlZ.json', 'observerDisguiseActive', 'technology', 'alertness'],
])('%s: a Snag on the one Skill Test against the holder while its stance is on', (name, file, flag, skill, other) => {
  const roller = holder([]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: true }), { rolledSkill: skill }).sources)
    .toEqual([expect.objectContaining({ snag: true, label: name })]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: true }), { rolledSkill: other }).sources).toEqual([]);
  expect(ruleRollSources(roller, diceCDefender([file], { [flag]: false }), { rolledSkill: skill }).sources).toEqual([]);
  expect(ruleRollSources(roller, diceCDefender([], { [flag]: true }), { rolledSkill: skill }).sources).toEqual([]);
});

test('High Gear: a Snag on ranged attacks at the Zord while active', () => {
  const roller = holder([]);
  const zord = diceCDefender(['jttitems/_source/High_Gear_KlcZsUUo2jvZhqM3.json'], { highGearActive: true });
  zord.type = 'zord';
  expect(ruleRollSources(roller, zord, { item: diceCAttack('blunt', 'projectile') }).sources).toEqual([expect.objectContaining({ snag: true, label: 'High Gear' })]);
  expect(ruleRollSources(roller, zord, { item: diceCAttack('blunt') }).sources).toEqual([]);
  zord.flags.essence20.highGearActive = false;
  expect(ruleRollSources(roller, zord, { item: diceCAttack('blunt', 'projectile') }).sources).toEqual([]);
});

test('No Fighting?!: a Snag on a Social roll while banked', () => {
  const file = 'kocitems/_source/No_Fighting___ddSnDksWfxPkekda.json';
  expect(ruleRollSources(diceCDefender([file], { noFightingSnagPending: true }), null, { rolledEssence: 'social' }).sources)
    .toEqual([expect.objectContaining({ snag: true, label: 'No Fighting?!' })]);
  expect(ruleRollSources(diceCDefender([file], { noFightingSnagPending: true }), null, { rolledEssence: 'strength' }).sources).toEqual([]);
  expect(ruleRollSources(diceCDefender([file], {}), null, { rolledEssence: 'social' }).sources).toEqual([]);
});

test('Gallantry: Snarl / Predacon (in combat) Intimidation and Might Makes Right Persuasion against the holder take one Snag', () => {
  const target = holder(['gijcrbitems/_source/Gallantry_UIMocxFcGeJUm3D4.json']);
  const rollerWith = (...uuids) => {
    const actor = holder([]);
    actor.items.contents.push(...uuids.map(uuid => ({ id: `g${nextId++}`, type: 'perk', flags: { core: { sourceId: uuid } }, system: {} })));
    return actor;
  };

  const SNARL = 'Compendium.essence20.ferocious_fighters.Item.786NTb2bQyHZ7qfg';
  const PREDACON = 'Compendium.essence20.technorganic_secrets.Item.jRD6G5Z6eblTvxeO';
  const MMR = 'Compendium.essence20.decepticon_directive.Item.lIiVbzESbPpV7Egu';
  const sources = (roller, rolledSkill) => ruleRollSources(roller, target, { rolledSkill }).sources;
  expect(sources(rollerWith(SNARL), 'intimidation')).toEqual([expect.objectContaining({ snag: true, label: 'Gallantry' })]);
  expect(sources(rollerWith(SNARL), 'persuasion')).toEqual([]);
  expect(sources(rollerWith(MMR), 'persuasion')).toEqual([expect.objectContaining({ snag: true })]);
  expect(sources(rollerWith(PREDACON), 'intimidation')).toEqual([]);
  global.game.combat = { started: true };
  expect(sources(rollerWith(PREDACON), 'intimidation')).toHaveLength(1);
  expect(sources(rollerWith(SNARL, PREDACON), 'intimidation')).toHaveLength(1);
  global.game.combat = null;
  expect(sources(rollerWith(), 'intimidation')).toEqual([]);
});

test('Advanced Anti-Air Training: Edge on Targeting against an aerial vehicle', () => {
  const actor = holder(['qgtgitems/_source/Advanced_Anti_Air_Training_YDv7PPjj6qgqKI9e.json']);
  const vehicle = aerial => ({ type: 'vehicle', system: { movement: { aerial: { base: aerial } } } });
  expect(ruleRollSources(actor, vehicle(20), { rolledSkill: 'targeting' }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Advanced Anti-Air Training' })]);
  expect(ruleRollSources(actor, vehicle(0), { rolledSkill: 'targeting' }).sources).toEqual([]);
  expect(ruleRollSources(actor, { type: 'playerCharacter', system: {} }, { rolledSkill: 'targeting' }).sources).toEqual([]);
  expect(ruleRollSources(actor, vehicle(20), { rolledSkill: 'driving' }).sources).toEqual([]);
  expect(ruleRollSources(holder([]), vehicle(20), { rolledSkill: 'targeting' }).sources).toEqual([]);
});

test('Rifle Tally: Edge attacking a non-aerial target while riding an aerial vehicle', () => {
  const actor = holder(['qgtgitems/_source/Rifle_Tally_dXCi2IGJnV47wzqe.json']);
  actor.uuid = 'Actor.gunner1';
  const ride = aerial => {
    global.game.actors = [{ type: 'vehicle', system: { actors: { c: { uuid: actor.uuid, vehicleRole: 'gunner' } }, movement: { aerial: { base: aerial } } } }];
  };

  const ground = { type: 'npc', system: { movement: { aerial: { base: 0 } } } };
  const flier = { type: 'npc', system: { movement: { aerial: { base: 30 } } } };
  const attack = diceCAttack('blunt');
  ride(30);
  expect(ruleRollSources(actor, ground, { item: attack }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Rifle Tally' })]);
  expect(ruleRollSources(actor, flier, { item: attack }).sources).toEqual([]);
  expect(ruleRollSources(actor, ground, { rolledSkill: 'driving' }).sources).toEqual([]);
  ride(0);
  expect(ruleRollSources(actor, ground, { item: attack }).sources).toEqual([]);
  global.game.actors = [];
  expect(ruleRollSources(actor, ground, { item: attack }).sources).toEqual([]);
  delete global.game.actors;
});

test('Cruel: Edge attacking a target with any Condition', () => {
  const actor = holder(['dditems/_source/Cruel_mAhqrcJNmNAJHjA8.json']);
  const attack = diceCAttack('blunt');
  expect(ruleRollSources(actor, holder([], { statuses: ['frightened'] }), { item: attack }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Cruel' })]);
  expect(ruleRollSources(actor, holder([]), { item: attack }).sources).toEqual([]);
  expect(ruleRollSources(actor, holder([], { statuses: ['frightened'] }), { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test('Rip And Tear: Edge on an unarmed melee attack against a Grappled target', () => {
  const actor = holder(['dditems/_source/Rip_And_Tear_KUDYPOsQ3atdRZPs.json']);
  const grappled = holder([], { statuses: ['grappled'] });
  expect(ruleRollSources(actor, grappled, { item: diceCAttack('blunt') }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Rip And Tear' })]);
  expect(ruleRollSources(actor, holder([]), { item: diceCAttack('blunt') }).sources).toEqual([]);
  expect(ruleRollSources(actor, grappled, { item: diceCAttack('blunt', 'projectile') }).sources).toEqual([]);
  const armed = diceCWeapon(actor, { id: 'w-rip', type: 'weapon', system: { traits: [] } }, { classification: { style: 'melee' } });
  expect(ruleRollSources(actor, grappled, { item: armed }).sources).toEqual([]);
});

test('Ballistic Advantage: no long-range Snag with a sniper weapon', () => {
  const actor = holder(['gijcrbitems/_source/Ballistic_Advantage_civSjmz83aDYPwvo.json']);
  const sniper = diceCWeapon(actor, { id: 'w-sniper', type: 'weapon', system: { traits: ['sniper'] } });
  const rifle = diceCWeapon(actor, { id: 'w-rifle', type: 'weapon', system: { traits: ['ballistic'] } });
  expect(ruleNoLongRangeSnag(actor, null, { item: sniper })).toBe(true);
  expect(ruleNoLongRangeSnag(actor, null, { item: rifle })).toBe(false);
  expect(ruleNoLongRangeSnag(holder([]), null, { item: sniper })).toBe(false);
  expect(ruleRollSources(actor, null, { item: sniper }).sources).toEqual([]);
});

describe('Blaster Focusers / Power Focusers / Zeo Tech Augment: ↑1 for the holder and every ally', () => {
  const FILES = {
    blaster: 'prcrbitems/_source/Blaster_Focusers_WzigK03hIcczvFLK.json',
    power: 'prcrbitems/_source/Power_Focusers_uDOOefcrciVe7398.json',
    zeo: 'prcrbitems/_source/Zeo_Tech_Augment_3CoVG3knuxMGVZRh.json',
  };
  const placeOn = (actor, x, disposition = 1) => {
    const token = { actor, center: { x, y: 0 }, document: { disposition } };
    actor.getActiveTokens = () => [token];
    return token;
  };

  afterEach(() => {
    delete global.canvas;
  });

  const attackWith = (actor, name, traits) => diceCWeapon(actor, { id: `w${nextId++}`, type: 'weapon', name, system: { traits } }, { classification: { style: 'melee' } });

  test('the holder: Blade Blaster, Power Weapon, either', () => {
    const blaster = holder([FILES.blaster]);
    const power = holder([FILES.power]);
    const zeo = holder([FILES.zeo]);
    const up = (actor, name, traits) => ruleRollSources(actor, null, { item: attackWith(actor, name, traits) }).sources.map(s => [s.label, s.shiftUp]);
    expect(up(blaster, 'Blade Blaster', [])).toEqual([['Blaster Focusers', 1]]);
    expect(up(blaster, 'Zeo Power Sword', ['powerWeapon'])).toEqual([]);
    expect(up(power, 'Zeo Power Sword', ['powerWeapon'])).toEqual([['Power Focusers', 1]]);
    expect(up(power, 'Blade Blaster', [])).toEqual([]);
    expect(up(zeo, 'Blade Blaster', [])).toEqual([['Zeo Tech Augment', 1]]);
    expect(up(zeo, 'Zeo Power Sword', ['powerWeapon'])).toEqual([['Zeo Tech Augment', 1]]);
    expect(up(zeo, 'Sword', [])).toEqual([]);
    expect(ruleRollSources(blaster, null, { rolledSkill: 'targeting' }).sources).toEqual([]);
  });

  test('an ally anywhere on the canvas; never more than one ↑1', () => {
    const roller = holder([FILES.blaster]);
    const ally = holder([FILES.zeo]);
    const enemy = holder([FILES.power]);
    global.canvas = {
      grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
      tokens: { placeables: [placeOn(roller, 0), placeOn(ally, 500), placeOn(enemy, 10, -1)] },
    };
    const up = (name, traits) => ruleRollSources(roller, null, { item: attackWith(roller, name, traits) }).sources.reduce((sum, s) => sum + s.shiftUp, 0);
    expect(up('Blade Blaster', [])).toBe(1);
    expect(up('Zeo Power Sword', ['powerWeapon'])).toBe(1);
    expect(up('Sword', [])).toBe(0);
    const loner = holder([]);
    global.canvas.tokens.placeables = [placeOn(loner, 0), placeOn(enemy, 10, -1)];
    expect(ruleRollSources(loner, null, { item: attackWith(loner, 'Zeo Power Sword', ['powerWeapon']) }).sources).toEqual([]);
  });
});

/* diceA batch: rollSkill's pre-dialog automatic modifiers (dice.mjs region A) moved onto their items as
   RollModifiers - Vok Golden Disk, Oorah!, Seafarer, Spiritual Link, Ninpõ JOEs, Caretaker, Once A Ranger,
   Wrestler, Bowl-Over, Handy Bot, Reinforced Basics, Petrolhead, Camper, Aerial Interface, Skyward's Hang-Up,
   Peaceable (+ Hang-Up), Ship's Crew, Agency, Spared No Expense, City Slicker, Motor Lancer, Shogun Upgrade,
   Stand Together, Tooth and Claw (both printings). */

const diceASources = (actor, ctx, target = null) => ruleRollSources(actor, target, ctx).sources;
const diceAAttack = (system = {}, flags = {}) => ({ item: { type: 'weaponEffect', flags, system: { classification: { style: 'melee' }, ...system } } });

/** An attack with a weapon (the effect's parent) carrying these numbers. */
function diceAArmed(actor, weaponSystem) {
  const weapon = { id: `w${nextId++}`, type: 'weapon', name: 'Gun', flags: {}, system: weaponSystem, parent: actor };
  actor.items.contents.push(weapon);
  return { item: { type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: weapon.id } }, system: { classification: { style: 'melee' } } } };
}

/** Someone holding these items, seated in a vehicle (or none) - game.actors holds both. */
function diceACrew(files, { type = 'vehicle', role = 'driver', movement = null, system = {} } = {}) {
  const actor = holder(files, { system });
  actor.uuid = `Actor.${actor.id}`;
  const ride = type && {
    type, uuid: `Actor.ride${nextId++}`,
    system: {
      actors: { a: { uuid: actor.uuid, vehicleRole: role } },
      movement: { aerial: { base: 0 }, ground: { base: 0 }, swim: { base: 0 }, ...(movement ? { [movement]: { base: 30 } } : {}) },
    },
  };
  game.actors = { contents: ride ? [actor, ride] : [actor] };
  return actor;
}

test.each([
  ['tsitems/_source/Vok_Golden_Disk_6AULE5uInvbfPlU9.json', 'culture', 'alertness'],
  ['sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json', 'infiltration', 'deception'],
  ['prcrbitems/_source/Caretaker_4q2SPRzdbGosL62k.json', 'science', 'athletics'],
])('%s: Edge on %s only', (file, skill, other) => {
  const actor = holder([file]);
  expect(diceASources(actor, { rolledSkill: skill })).toEqual([expect.objectContaining({ edge: true, shiftUp: 0, shiftDown: 0 })]);
  expect(diceASources(actor, { rolledSkill: other })).toEqual([]);
  expect(diceASources(holder([]), { rolledSkill: skill })).toEqual([]);
});

test('Ninpõ JOEs: Edge on Culture, once per scene', async () => {
  const actor = r12Flags(holder(['iafav2items/_source/Ninp__JOEs_8oZYgik001Dxxxa6.json']));
  const first = ruleRollSources(actor, null, { rolledSkill: 'culture' });
  expect(first.sources).toEqual([expect.objectContaining({ edge: true, label: 'Ninpõ JOEs' })]);
  expect(first.consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit' })]);
  expect(diceASources(actor, { rolledSkill: 'might' })).toEqual([]);
  await consumeLimited(first.consumes[0], async () => actor);
  expect(diceASources(actor, { rolledSkill: 'culture' })).toEqual([]);
});

test.each([
  'prcrbitems/_source/Wrestler_7QMuaLPZJWNPJHTz.json',
  'mlpcrbitems/_source/Bowl_Over_BysTCPE8xJCT2nsM.json',
])('%s: Edge on a Grapple attack, not on another attack', file => {
  const actor = holder([file]);
  expect(diceASources(actor, diceAAttack({ damageType: 'grapple', damageValue: 1 }))).toEqual([expect.objectContaining({ edge: true })]);
  expect(diceASources(actor, diceAAttack({ damageType: 'blunt', damageValue: 1 }))).toEqual([]);
  expect(diceASources(actor, { rolledSkill: 'might' })).toEqual([]);
  expect(diceASources(holder([]), diceAAttack({ damageType: 'grapple', damageValue: 1 }))).toEqual([]);
});

test('Handy Bot: ↑1 attacking with a Tool-trait weapon', () => {
  const file = 'tf1sitems/_source/Handy_Bot_TTeqM5BORGFuHcj9.json';
  const actor = holder([file]);
  expect(diceASources(actor, diceAArmed(actor, { traits: ['tool'] }))).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Handy Bot' })]);
  expect(diceASources(actor, diceAArmed(actor, { traits: ['ballistic'] }))).toEqual([]);
  const none = holder([]);
  expect(diceASources(none, diceAArmed(none, { traits: ['tool'] }))).toEqual([]);
});

test('Reinforced Basics: ↑1 attacking with a weapon of Standard availability after upgrades', () => {
  const actor = holder(['qgtgitems/_source/Reinforced_Basics_4HD4ibkT5hTdwlAW.json']);
  expect(diceASources(actor, diceAArmed(actor, { totalAvailability: 'standard' }))).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(diceASources(actor, diceAArmed(actor, { availability: 'standard', totalAvailability: 'limited' }))).toEqual([]);
  expect(diceASources(actor, diceAAttack())).toEqual([]);
});

test('Camper: Edge on Survival at half Health or more', () => {
  const file = 'kocitems/_source/Camper_dMEFcqcain5oS2mJ.json';
  expect(diceASources(holder([file], { system: { health: { max: 10, value: 5 } } }), { rolledSkill: 'survival' })).toEqual([expect.objectContaining({ edge: true, label: 'Camper' })]);
  expect(diceASources(holder([file], { system: { health: { max: 10, value: 4 } } }), { rolledSkill: 'survival' })).toEqual([]);
  expect(diceASources(holder([file], { system: { health: { max: 10, value: 10 } } }), { rolledSkill: 'alertness' })).toEqual([]);
});

test('Driving rules: Once A Ranger (Zord), Aerial Interface (air), Seafarer (sea), Skyward Hang-Up (land or sea)', () => {
  const once = 'ttsgitems/_source/Once_A_Ranger_lhmvqRKAnfBs69H9.json';
  const aerial = 'qgtgitems/_source/Aerial_Interface_Etogut0TJjvuKC9J.json';
  const sea = 'qgtgitems/_source/Seafarer_vZjp9ncpzhgLIzSm.json';
  const sky = 'qgtgitems/_source/Skyward_U8uQSqS78rqyUOu2.json';
  const driving = { rolledSkill: 'driving' };
  try {
    expect(diceASources(diceACrew([once], { type: 'zord' }), driving)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(diceASources(diceACrew([once], { type: 'vehicle' }), driving)).toEqual([]);
    expect(diceASources(diceACrew([once], { type: 'zord', role: 'passenger' }), driving)).toEqual([]);

    expect(diceASources(diceACrew([aerial], { movement: 'aerial' }), driving)).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(diceASources(diceACrew([aerial], { movement: 'ground' }), driving)).toEqual([]);
    expect(diceASources(diceACrew([aerial], { movement: 'aerial' }), { rolledSkill: 'targeting' })).toEqual([]);

    expect(diceASources(diceACrew([sea], { movement: 'swim' }), driving)).toEqual([expect.objectContaining({ edge: true })]);
    expect(diceASources(diceACrew([sea], { movement: 'ground' }), driving)).toEqual([]);
    expect(diceASources(diceACrew([sea], { type: null }), driving)).toEqual([]);

    expect(diceASources(diceACrew([sky], { movement: 'ground' }), driving)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(diceASources(diceACrew([sky], { movement: 'swim' }), driving)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(diceASources(diceACrew([sky], { movement: 'aerial' }), driving)).toEqual([]);
    expect(diceASources(diceACrew(['qgtgitems/_source/Skyward_1IlTYXe8k5Aj63Mn.json'], { movement: 'ground' }), driving)
      .filter(source => source.shiftDown)).toEqual([]);
  } finally {
    game.actors = undefined;
  }
});

test('Petrolhead: Specialized Driving a vehicle of the chosen type', () => {
  const file = 'qgtgitems/_source/Petrolhead_JlJrEfRcrupprYMC.json';
  const driver = (movement, choice) => {
    const actor = diceACrew([file], { movement });
    actor.items.contents[0].system.choice = choice;
    return actor;
  };

  try {
    expect(ruleSpecializes(driver('swim', 'swim'), 'driving', null, {})).toBe(true);
    expect(ruleSpecializes(driver('ground', 'swim'), 'driving', null, {})).toBe(false);
    expect(ruleSpecializes(driver('swim', null), 'driving', null, {})).toBe(false);
    expect(ruleSpecializes(driver('swim', 'swim'), 'athletics', null, {})).toBe(false);
    expect(switchNames(driver('swim', 'swim'), { rolledSkill: 'technology' })).toHaveLength(1);
  } finally {
    game.actors = undefined;
  }
});

test("Ship's Crew: Edge on Driving or Technology aboard any vehicle; Motor Lancer: ↑1 on melee attacks there", () => {
  const crew = "atsitems/_source/Ship_s_Crew_HPEU2YVjQM6pEZ3i.json";
  const lancer = 'iafav2items/_source/Motor_Lancer_YaFY9NhcpZPXdvv0.json';
  try {
    for (const skill of ['driving', 'technology']) {
      expect(diceASources(diceACrew([crew], { role: 'passenger' }), { rolledSkill: skill })).toEqual([expect.objectContaining({ edge: true })]);
    }

    expect(diceASources(diceACrew([crew], { role: 'passenger' }), { rolledSkill: 'athletics' })).toEqual([]);
    expect(diceASources(diceACrew([crew], { type: null }), { rolledSkill: 'driving' })).toEqual([]);

    expect(diceASources(diceACrew([lancer], { role: 'passenger' }), diceAAttack())).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(diceASources(diceACrew([lancer], { role: 'passenger' }), diceAAttack({ classification: { style: 'ranged' } }))).toEqual([]);
    expect(diceASources(diceACrew([lancer], { type: null }), diceAAttack())).toEqual([]);
  } finally {
    game.actors = undefined;
  }
});

test('Spiritual Link: ↑1 on the first Skill Test each turn while driving the Zord', async () => {
  const pilot = holder([]);
  pilot.uuid = `Actor.${pilot.id}`;
  const zord = r12Flags(holder(['jttitems/_source/Spiritual_Link_D1tffyQwTAR9N1QG.json']));
  zord.type = 'zord';
  zord.system.actors = { a: { uuid: pilot.uuid, vehicleRole: 'driver' } };
  game.actors = { contents: [pilot, zord] };
  try {
    expect(diceASources(pilot, { rolledSkill: 'might' })).toEqual([]);
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    const first = ruleRollSources(pilot, null, { rolledSkill: 'might' });
    expect(first.sources).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Spiritual Link' })]);
    await consumeLimited(first.consumes[0], async () => zord);
    expect(diceASources(pilot, { rolledSkill: 'might' })).toEqual([]);
    game.combat = { id: 'c', started: true, round: 1, turn: 1 };
    expect(diceASources(pilot, { rolledSkill: 'might' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    zord.system.actors.a.vehicleRole = 'passenger';
    expect(diceASources(pilot, { rolledSkill: 'might' })).toEqual([]);
  } finally {
    game.actors = undefined;
    game.combat = null;
  }
});

test('Peaceable: ↑1 on Stun attacks, ↓1 on other damaging attacks, ↓2 with its Hang-Up', () => {
  const perk = 'ghpfitems/_source/Peaceable_BHum6Sd6Zz7cra5b.json';
  const hangUp = 'ghpfitems/_source/Peaceable_zm9x8A7AW8o7grQX.json';
  const total = (actor, ctx) => diceASources(actor, ctx).reduce((sum, s) => ({ up: sum.up + s.shiftUp, down: sum.down + s.shiftDown }), { up: 0, down: 0 });
  const withPerkSource = actor => {
    actor.items.contents[0].flags = { core: { sourceId: 'Compendium.essence20.general_hawk_s_personel_files.Item.BHum6Sd6Zz7cra5b' } };
    return actor;
  };

  const pacifist = holder([perk]);
  expect(total(pacifist, diceAAttack({ damageType: 'stun', damageValue: 1 }))).toEqual({ up: 1, down: 0 });
  expect(total(pacifist, diceAAttack({ damageType: 'blunt', damageValue: 1 }))).toEqual({ up: 0, down: 1 });
  expect(total(pacifist, diceAAttack({ damageType: null }))).toEqual({ up: 0, down: 0 });
  expect(total(pacifist, { rolledSkill: 'might' })).toEqual({ up: 0, down: 0 });

  const both = withPerkSource(holder([perk, hangUp]));
  expect(total(both, diceAAttack({ damageType: 'blunt', damageValue: 1 }))).toEqual({ up: 0, down: 2 });
  expect(total(both, diceAAttack({ damageType: 'stun', damageValue: 1 }))).toEqual({ up: 1, down: 0 });
  expect(total(holder([hangUp]), diceAAttack({ damageType: 'blunt', damageValue: 1 }))).toEqual({ up: 0, down: 0 });
});

test('Chosen-Skill rules: Agency (Edge), Spared No Expense (↑1), Stand Together (↑1 out of combat); City Slicker ↑1 Alertness', () => {
  const chose = (file, choice) => {
    const actor = holder([file]);
    actor.items.contents[0].system.choice = choice;
    return actor;
  };

  const agency = 'atsitems/_source/Agency_bGKG7artYs7uHHz4.json';
  expect(diceASources(chose(agency, 'technology'), { rolledSkill: 'technology' })).toEqual([expect.objectContaining({ edge: true })]);
  expect(diceASources(chose(agency, 'technology'), { rolledSkill: 'alertness' })).toEqual([]);
  expect(diceASources(chose(agency, null), { rolledSkill: 'technology' })).toEqual([]);

  const spared = 'fffav1items/_source/Spared_No_Expense_3ZrBd6FhV6Fep1zq.json';
  expect(diceASources(chose(spared, 'infiltration'), { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(diceASources(chose(spared, 'wealth'), { rolledSkill: 'infiltration' })).toEqual([]);

  const together = 'tf1sitems/_source/Stand_Together_kW4yyD9rwhc0JfYp.json';
  try {
    expect(diceASources(chose(together, 'streetwise'), { rolledSkill: 'streetwise' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(diceASources(chose(together, 'streetwise'), { rolledSkill: 'athletics' })).toEqual([]);
    expect(diceASources(chose(together, null), { rolledSkill: 'streetwise' })).toEqual([]);
    game.combat = { id: 'combat1', started: true };
    expect(diceASources(chose(together, 'streetwise'), { rolledSkill: 'streetwise' })).toEqual([]);
  } finally {
    game.combat = null;
  }

  const slicker = holder(['iafav2items/_source/City_Slicker_xU1p1S5JuVu6XiAI.json']);
  expect(diceASources(slicker, { rolledSkill: 'alertness' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(diceASources(slicker, { rolledSkill: 'wealth' })).toEqual([]);
});

test("Shogun Upgrade: ↑1 on the Zord's own melee attacks", () => {
  const zord = holder(['prcrbitems/_source/Upgraded_Zord__Shogun_Upgrade__1Bp1o4k9VhkKPXnd.json']);
  zord.type = 'zord';
  expect(diceASources(zord, diceAAttack())).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Shogun Upgrade' })]);
  expect(diceASources(zord, diceAAttack({ classification: { style: 'ranged' } }))).toEqual([]);
  zord.type = 'playerCharacter';
  expect(diceASources(zord, diceAAttack())).toEqual([]);
});

test('Tooth and Claw (both printings): ↑1 on unarmed attacks in Alt Mode, once even holding both', () => {
  const ts = 'tsitems/_source/Tooth_and_Claw_Z4lShGtDBa2zQ5ov.json';
  const dd = 'dditems/_source/Tooth_and_Claw_bHQGteFX7pdnslOx.json';
  for (const files of [[ts], [dd], [ts, dd]]) {
    const actor = holder(files, { system: { isTransformed: true } });
    expect(diceASources(actor, diceAAttack())).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(diceASources(actor, diceAAttack({}, { essence20: { parentId: 'gun' } }))).toEqual([]);
    expect(diceASources(actor, { rolledSkill: 'athletics' })).toEqual([]);
    actor.system.isTransformed = false;
    expect(diceASources(actor, diceAAttack())).toEqual([]);
  }
});

/* tonight batch (2026-10-02): Beatdown, Jackhammer and Shadow Morph [Form] give their weapon by a Grant rule (it now
   arrives with its own attacks, lifecycle#attachGrantedChildren), and so do the Alt Modes whose printed special
   attack needs no change (helpers/extensions/tf2/modes.mjs keeps the Charger, the Monolith and the chassis that ask). */

const TONIGHT_WEAPONS = {
  ram: 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m',
  flyby: 'Compendium.essence20.tf_crb.Item.3L0eAnm4GVoQi7Df',
  spikedRam: 'Compendium.essence20.decepticon_directive.Item.leQVbl8vdpkwiCdw',
  miniVehicleRam: 'Compendium.essence20.decepticon_directive.Item.WrSVycvwI2mlmp2y',
  smash: 'Compendium.essence20.technorganic_secrets.Item.e2LbSl8llOCJ2I6o',
};

test.each([
  ['Beatdown', 'ccitems/_source/Beatdown_38zFS75lhzBWiurT.json', 'Compendium.essence20.gi_joe_crb.Item.xthnRWfhbfXvpmZN'],
  ['Jackhammer', 'ccitems/_source/Jackhammer_sBoZ2KrzmKlWIlYu.json', 'Compendium.essence20.gi_joe_crb.Item.Jnjio1DtAx0QgE85'],
  ['Shadow Morph [Form]', 'atsitems/_source/Shadow_Morph__Form__UNgNYpUADVTaNrWt.json', 'Compendium.essence20.across_the_stars.Item.PQ2msfDzjTGz8aXN'],
  ["Pillar (Extended)", 'eocitems/_source/Pillar__Extended__j0CJWQ858tbQvVUs.json', TONIGHT_WEAPONS.ram],
  ["Pillar (Long)", 'eocitems/_source/Pillar__Long__SroTzxuu57HoaN9V.json', TONIGHT_WEAPONS.ram],
  ["Speaker (Common, Aerial)", 'eocitems/_source/Speaker__Common__Aerial__ilL3CyLQDydjxBHf.json', TONIGHT_WEAPONS.ram],
  ["Speaker (Common, Ground)", 'eocitems/_source/Speaker__Common__Ground__GPW2T5OEC0KtlJpX.json', TONIGHT_WEAPONS.ram],
  ["Speaker (Long, Aerial)", 'eocitems/_source/Speaker__Long__Aerial__wwFXrMqJd0YJHqkX.json', TONIGHT_WEAPONS.ram],
  ["Speaker (Long, Ground)", 'eocitems/_source/Speaker__Long__Ground__48zFIrJCoULshGtm.json', TONIGHT_WEAPONS.ram],
  ["Champion", 'tfcrbitems/_source/Champion_IFssZkdjKb6vcYfk.json', TONIGHT_WEAPONS.ram],
  ["Cutter (Common)", 'tfcrbitems/_source/Cutter__Common__5sxhsXAHh97KTpwa.json', TONIGHT_WEAPONS.ram],
  ["Cutter (Long)", 'tfcrbitems/_source/Cutter__Long__FlN4FCnbTP7RRz8K.json', TONIGHT_WEAPONS.ram],
  ["Lookout", 'tfcrbitems/_source/Lookout_ZS3kX8oKogmsH6OK.json', TONIGHT_WEAPONS.ram],
  ["Outrider (Common)", 'tfcrbitems/_source/Outrider__Common__NaF9feAfujLYwDfO.json', TONIGHT_WEAPONS.ram],
  ["Outrider (Long)", 'tfcrbitems/_source/Outrider__Long__WYlv5KoOv8WTUtKN.json', TONIGHT_WEAPONS.ram],
  ["Rainmaker", 'tfcrbitems/_source/Rainmaker_OlLBvRl06PVw9OQx.json', TONIGHT_WEAPONS.ram],
  ["Support", 'tfcrbitems/_source/Support_hr00Kzgshnz67400.json', TONIGHT_WEAPONS.ram],
  ["Seeker", 'tfcrbitems/_source/Seeker_RXTZuPJnnAlkgHX2.json', TONIGHT_WEAPONS.flyby],
  ["Salvaged", 'dditems/_source/Salvaged_cGGEXSdCI170AaM4.json', TONIGHT_WEAPONS.spikedRam],
  ["Mini-Con (Mini-Vehicle, Aerial)", 'dditems/_source/Mini_Con__Mini_Vehicle__Aerial__oSn5EyMwso8Z1Ohh.json', TONIGHT_WEAPONS.miniVehicleRam],
  ["Mini-Con (Mini-Vehicle, Ground)", 'dditems/_source/Mini_Con__Mini_Vehicle__Ground__JVIOxmSpPwPQDY1z.json', TONIGHT_WEAPONS.miniVehicleRam],
  ["Behemoth (Huge)", 'tsitems/_source/Behemoth__Huge__hF2rJtS3SzcjqnLr.json', TONIGHT_WEAPONS.smash],
  ["Behemoth (Large)", 'tsitems/_source/Behemoth__Large__qZQyZDntWJdNeDQy.json', TONIGHT_WEAPONS.smash],
])('%s: grants its weapon, unless the actor already has one', async (name, file, uuid) => {
  const { grantData } = await import('./lifecycle.mjs');
  const saved = global.foundry.utils;
  global.foundry.utils = {
    ...saved,
    setProperty: (object, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
    },
  };
  try {
    const actor = holder([file]);
    const [granter] = actor.items.contents;
    const load = async id => (id == uuid ? { toObject: () => ({ _id: 'x', name: 'Weapon', type: 'weapon', system: { items: {} } }) } : null);
    const granted = await grantData(granter, actor, { load });
    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatchObject({ type: 'weapon', _stats: { compendiumSource: uuid }, flags: { essence20: { grantedBy: granter.id } } });
    expect(granted[0]._id).toBeUndefined();
    // Already holds one (Signature Weapon, another Alt Mode with the same attack...): nothing more.
    actor.items.contents.push({ id: 'owned', type: 'weapon', flags: { core: { sourceId: uuid } }, system: {} });
    expect(await grantData(granter, actor, { load })).toEqual([]);
  } finally {
    global.foundry.utils = saved;
  }
});

/* diceD batch: Scramble Wave's Critical Effect (dice.mjs#_rollSkillHelper's criticalOptions) as a CriticalOption rule. */

test('Scramble Wave: every attack gains a Stunned Critical Effect option', async () => {
  const { ruleCriticalOptions } = await import('./adapter.mjs');
  const actor = holder(['dditems/_source/Scramble_Wave_2ehuQcJ1nwOvxSKl.json']);
  const ranged = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'ranged', skill: 'targeting' } } };
  const melee = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee', skill: 'might' } } };
  for (const attack of [ranged, melee]) {
    expect(ruleCriticalOptions(actor, null, attack).options).toMatchObject([{ label: 'Scramble Wave', status: 'stunned', damageValue: 1, damageType: 'special' }]);
  }

  expect(ruleCriticalOptions(holder([]), null, ranged).options).toEqual([]);
});


/* dmgB batch (round 14): "+N damage" terms of dice.mjs's damageBonusValue as scaled DamageModifier rules
   (rules/adapter.mjs#ruleScaledDamage), and Targeting Suite's ↓1-for-+1-damage checkbox as a DialogSwitch. */

const dmgBAttack = ({ style = 'melee', skill = 'might', damageType = 'blunt', weapon = null } = {}) => ({
  type: 'weaponEffect', name: 'Attack',
  flags: weapon ? { essence20: { parentId: weapon.id } } : {},
  system: { classification: { style, skill }, damageType },
  parent: weapon ? { items: { get: id => (id == weapon.id ? weapon : null) } } : null,
});
const dmgBWeapon = sourceId => ({ id: 'w1', type: 'weapon', name: 'Weapon', flags: { core: { sourceId } }, system: { traits: [] } });
const dmgBTarget = ({ type = 'npc', statuses = [], size = 'common' } = {}) => ({ type, statuses: new Set(statuses), system: { size }, flags: {} });
const dmgB = (actor, item, target = null) => ruleScaledDamage(actor, target, { item, rolledSkill: item?.system?.classification?.skill });

test('Iron Hands: +1 on a Might unarmed attack', () => {
  const actor = holder(['prcrbitems/_source/Iron_Hands_uKGtcgg5cgVibGQ7.json']);
  expect(dmgB(actor, dmgBAttack({ skill: 'might' }))).toMatchObject({ amount: 1, sources: ['Iron Hands'] });
  expect(dmgB(actor, dmgBAttack({ skill: 'athletics' })).amount).toBe(0);
  expect(dmgB(actor, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.pr_crb.Item.someSword') })).amount).toBe(0);
  expect(dmgB(holder([]), dmgBAttack()).amount).toBe(0);
});

test("Iron Hooves / Strex Strikes: +1 on any unarmed attack, the printed Unarmed Strike weapons included", () => {
  for (const [file, label] of [['mlpcrbitems/_source/Iron_Hooves_weDVcCpSyZCH5V4M.json', 'Iron Hooves'], ['wtnvcgitems/_source/Strex_Strikes_4aYIkhmBO77Irq5l.json', 'Strex Strikes']]) {
    const actor = holder([file]);
    expect(dmgB(actor, dmgBAttack({ skill: 'finesse' }))).toMatchObject({ amount: 1, sources: [label] });
    expect(dmgB(actor, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom') })).amount).toBe(1);
    expect(dmgB(actor, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy') })).amount).toBe(1);
    expect(dmgB(actor, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.wtnv_citizens_guide.Item.someKnife') })).amount).toBe(0);
    expect(dmgB(actor, { type: 'spell', system: {} }).amount).toBe(0);
  }
});

test('Puissance / Frost Warlord / Venom Warlord: +1 on an attack with no weapon behind it', () => {
  for (const [file, label] of [
    ['eocitems/_source/Puissance_N8nkrj2hSrLv9NFP.json', 'Puissance'],
    ['fmmcitems/_source/Frost_Warlord_iFHlsLgUvmlT8cMK.json', 'Frost Warlord'],
    ['fmmcitems/_source/Venom_Warlord_9tU5tDmpOhChLfdv.json', 'Venom Warlord'],
  ]) {
    const actor = holder([file]);
    expect(dmgB(actor, dmgBAttack({ skill: 'finesse', style: 'ranged' }))).toMatchObject({ amount: 1, sources: [label] });
    expect(dmgB(actor, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom') })).amount).toBe(0);
  }

  expect(dmgB(holder([]), dmgBAttack()).amount).toBe(0);
});

test('Cruel Warlord: +1 on attacks in Monster Form; Grow!: +1 on anything while grown in Monster Form', () => {
  const cruel = holder(['fmmcitems/_source/Cruel_Warlord_F3TRKmoaUOtHrlzq.json']);
  expect(dmgB(cruel, dmgBAttack()).amount).toBe(0);
  cruel.flags = { essence20: { monsterFormActive: true } };
  expect(dmgB(cruel, dmgBAttack())).toMatchObject({ amount: 1, sources: ['Cruel Warlord'] });

  const grow = holder(['fmmcitems/_source/Grow__ZqE7kDEMylFQK6Oa.json']);
  grow.flags = { essence20: { monsterFormActive: true } };
  expect(dmgB(grow, dmgBAttack()).amount).toBe(0);
  grow.flags.essence20.monsterGrowSelfActive = true;
  expect(dmgB(grow, dmgBAttack({ style: 'ranged' }))).toMatchObject({ amount: 1, sources: ['Grow!'] });
  grow.flags.essence20.monsterFormActive = false;
  expect(dmgB(grow, dmgBAttack()).amount).toBe(0);
});

test('Weak Point: +1 with a Blunt or Sharp attack, any target; Staggering: +1 dealing Stun', () => {
  const weak = holder(['qgtgitems/_source/Weak_Point_opTZmlt97a9TWHSk.json']);
  expect(dmgB(weak, dmgBAttack({ damageType: 'blunt' }), dmgBTarget({ type: 'vehicle' }))).toMatchObject({ amount: 1, sources: ['Weak Point'] });
  expect(dmgB(weak, dmgBAttack({ damageType: 'sharp' }), dmgBTarget())).toMatchObject({ amount: 1, sources: ['Weak Point'] });
  expect(dmgB(weak, dmgBAttack({ damageType: 'ballistic' })).amount).toBe(0);

  const staggering = holder(['fgtaaitems/_source/Staggering_alMONv2bzphF1OQV.json']);
  expect(dmgB(staggering, dmgBAttack({ damageType: 'stun' }))).toMatchObject({ amount: 1, sources: ['Staggering'] });
  expect(dmgB(staggering, dmgBAttack({ damageType: 'sharp' })).amount).toBe(0);
});

test('Viral News Bloggers: +1 against a vehicle; Zordbane: +1 against a Zord', () => {
  const viral = holder(['wtnvcgitems/_source/Viral_News_Bloggers_ORyWD8AKRIqo0jdS.json']);
  expect(dmgB(viral, dmgBAttack({ style: 'ranged' }), dmgBTarget({ type: 'vehicle' }))).toMatchObject({ amount: 1, sources: ['Viral News Bloggers'] });
  expect(dmgB(viral, dmgBAttack(), dmgBTarget({ type: 'playerCharacter' })).amount).toBe(0);
  expect(dmgB(viral, dmgBAttack()).amount).toBe(0);

  const zordbane = holder(['fmmcitems/_source/Zordbane_SejEXXGz3edJ734e.json']);
  expect(dmgB(zordbane, dmgBAttack(), dmgBTarget({ type: 'zord' }))).toMatchObject({ amount: 1, sources: ['Zordbane'] });
  expect(dmgB(zordbane, dmgBAttack(), dmgBTarget({ type: 'npc' })).amount).toBe(0);
});

test("Zord Features: Auxiliary Zord (+1 melee), Thunder Upgrade (+1 any attack), Warrior Mode (+1 melee while active)", () => {
  const aux = holder(['prcrbitems/_source/Auxiliary_Zord_QO0kY1y359tSnPTS.json']);
  aux.type = 'zord';
  expect(dmgB(aux, dmgBAttack())).toMatchObject({ amount: 1, sources: ['Auxiliary Zord'] });
  expect(dmgB(aux, dmgBAttack({ style: 'energy' })).amount).toBe(0);
  aux.type = 'playerCharacter';
  expect(dmgB(aux, dmgBAttack()).amount).toBe(0);

  const thunder = holder(['prcrbitems/_source/Upgraded_Zord__Thunder_Upgrade__TrahRuyqZz8UAQ6K.json']);
  thunder.type = 'zord';
  expect(dmgB(thunder, dmgBAttack())).toMatchObject({ amount: 1, sources: ['Thunder Upgrade'] });
  expect(dmgB(thunder, dmgBAttack({ style: 'energy' })).amount).toBe(1);

  const warrior = holder(['prcrbitems/_source/Warrior_Mode_RsrUlBazkPwpRfxi.json']);
  warrior.type = 'zord';
  expect(dmgB(warrior, dmgBAttack()).amount).toBe(0);
  warrior.flags = { essence20: { warriorModeActive: true } };
  expect(dmgB(warrior, dmgBAttack())).toMatchObject({ amount: 1, sources: ['Warrior Mode'] });
  expect(dmgB(warrior, dmgBAttack({ style: 'energy' })).amount).toBe(0);
});

test("Ultimate Magna Defender: +1 on the holder's own melee attacks", () => {
  const actor = holder(['ttsgitems/_source/Ultimate_Magna_Defender_ukfZOGZeuyJv6I5M.json']);
  expect(dmgB(actor, dmgBAttack({ skill: 'athletics' }))).toMatchObject({ amount: 1, sources: ['Ultimate Magna Defender'] });
  expect(dmgB(actor, dmgBAttack({ style: 'ranged', skill: 'targeting' })).amount).toBe(0);
});

test('Breaker-Bar (both profiles): +1 against a Combiner form; Negavator Beam: +1 per full Size Class from Huge up', () => {
  for (const file of ['eocitems/_source/Breaker_Bar_qIgfv11HMWSlnos8.json', 'eocitems/_source/Breaker_Bar_Alternate_Effect_lmDkIe8a49fF7bHS.json']) {
    const actor = holder([file]);
    const own = actor.items.contents[0];
    expect(dmgB(actor, own, dmgBTarget({ type: 'megaform' }))).toMatchObject({ amount: 1, sources: ['Breaker-Bar'] });
    expect(dmgB(actor, own, dmgBTarget({ type: 'npc' })).amount).toBe(0);
    expect(dmgB(actor, dmgBAttack(), dmgBTarget({ type: 'megaform' })).amount).toBe(0);
  }

  const beam = holder(['eocitems/_source/Negavator_Beam_Effect_rzyh86u2NyFINhkk.json']);
  const own = beam.items.contents[0];
  for (const [size, bonus] of [['common', 0], ['large', 0], ['long', 0], ['huge', 1], ['extended', 1], ['gigantic', 2], ['extended2', 2], ['towering', 3], ['extended3', 3], ['titanic', 4]]) {
    expect(dmgB(beam, own, dmgBTarget({ size })).amount).toBe(bonus);
  }

  expect(new Set(dmgB(beam, own, dmgBTarget({ size: 'titanic' })).sources)).toEqual(new Set(['Negavator Beam']));
  expect(dmgB(beam, own).amount).toBe(0);
  expect(dmgB(beam, dmgBAttack(), dmgBTarget({ size: 'titanic' })).amount).toBe(0);
});

test('Cruel (+1 vs Immobilized/Restrained), Position of Power (+1 melee vs any Condition), Rip and Tear (+1 unarmed melee vs Grappled)', () => {
  const cruel = holder(['dditems/_source/Cruel_mAhqrcJNmNAJHjA8.json']);
  expect(dmgB(cruel, dmgBAttack({ style: 'ranged' }), dmgBTarget({ statuses: ['immobilized'] }))).toMatchObject({ amount: 1, sources: ['Cruel'] });
  expect(dmgB(cruel, dmgBAttack(), dmgBTarget({ statuses: ['restrained'] })).amount).toBe(1);
  expect(dmgB(cruel, dmgBAttack(), dmgBTarget({ statuses: ['blinded'] })).amount).toBe(0);

  const power = holder(['dditems/_source/Position_Of_Power_3YMSgAd60S87vCCb.json']);
  expect(dmgB(power, dmgBAttack(), dmgBTarget({ statuses: ['frightened'] }))).toMatchObject({ amount: 1, sources: ['Position of Power'] });
  expect(dmgB(power, dmgBAttack(), dmgBTarget()).amount).toBe(0);
  expect(dmgB(power, dmgBAttack({ style: 'ranged' }), dmgBTarget({ statuses: ['frightened'] })).amount).toBe(0);

  const rip = holder(['dditems/_source/Rip_And_Tear_KUDYPOsQ3atdRZPs.json']);
  expect(dmgB(rip, dmgBAttack(), dmgBTarget({ statuses: ['grappled'] }))).toMatchObject({ amount: 1, sources: ['Rip and Tear'] });
  expect(dmgB(rip, dmgBAttack(), dmgBTarget()).amount).toBe(0);
  expect(dmgB(rip, dmgBAttack({ style: 'ranged' }), dmgBTarget({ statuses: ['grappled'] })).amount).toBe(0);
  expect(dmgB(rip, dmgBAttack({ weapon: dmgBWeapon('Compendium.essence20.x.Item.blade') }), dmgBTarget({ statuses: ['grappled'] })).amount).toBe(0);
});

test('Vicious Edges: +1 on a melee attack with the weapon it is attached to, against a target with any Condition', () => {
  const actor = holder(['dditems/_source/Vicious_Edges_vrV3LXAqkl6upsRv.json']);
  const upgrade = actor.items.contents[0];
  const weapon = { id: 'w1', type: 'weapon', name: 'Blade', flags: {}, system: { equipped: true, traits: [] }, parent: actor };
  actor.items.contents.push(weapon);
  upgrade.flags = { essence20: { parentId: 'w1' } };
  rebuildIndex(actor);
  const attack = style => ({ type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { classification: { style } }, parent: actor });

  expect(dmgB(actor, attack('melee'), dmgBTarget({ statuses: ['frightened'] }))).toMatchObject({ amount: 1, sources: ['Vicious Edges'] });
  expect(dmgB(actor, attack('melee'), dmgBTarget()).amount).toBe(0);
  expect(dmgB(actor, attack('ranged'), dmgBTarget({ statuses: ['frightened'] })).amount).toBe(0);
  expect(dmgB(actor, dmgBAttack(), dmgBTarget({ statuses: ['frightened'] })).amount).toBe(0);
});

test("Targeting Suite: a ↓1 / +1 damage switch on the Zord's ranged attacks", () => {
  const actor = holder(['atsitems/_source/Targeting_Suite_8L29IiLC62qrH0tr.json']);
  actor.type = 'zord';
  const ranged = { item: dmgBAttack({ style: 'ranged', skill: 'targeting', damageType: 'energy' }) };
  expect(switchNames(actor, ranged)).toEqual(['↓1 for +1 damage (Targeting Suite)']);
  expect(switchNames(actor, { item: dmgBAttack() })).toEqual([]);
  expect(tick(actor, ranged)).toMatchObject({ shiftDown: 1, ruleDamage: 1, ruleDamageSources: ['↓1 for +1 damage (Targeting Suite)'] });
  expect(dmgBNoSwitches(actor, ranged)).toMatchObject({ shiftDown: 0 });

  actor.type = 'playerCharacter';
  expect(switchNames(actor, ranged)).toEqual([]);
});

function dmgBNoSwitches(actor, ctx) {
  const result = { shiftUp: 0, shiftDown: 0, ext: {} };
  applyRuleSwitches(actor, result, ctx);
  return result;
}

/* dmgA (round 14): "+N damage" terms of dice.mjs's damageBonusValue sum, now scaled DamageModifier rules
   (rules/adapter.mjs#ruleScaledDamage) and damage DialogSwitches (options.ruleDamage). */

/** A weapon effect on this actor, optionally with a parent weapon carrying traits / a compendium source. */
function dmgAEffect(actor, { skill = 'athletics', style = 'melee', damageType = 'blunt', weapon = null, isRam = false } = {}) {
  const effect = { id: `e${nextId++}`, name: 'Effect', type: 'weaponEffect', flags: {}, parent: actor, system: { classification: { skill, style }, damageType, damageValue: 1, isRam } };
  if (weapon) {
    const parent = { id: `w${nextId++}`, name: 'Weapon', type: 'weapon', flags: weapon.flags ?? {}, parent: actor, system: { traits: weapon.traits ?? [] } };
    actor.items.contents.push(parent);
    effect.flags = { essence20: { parentId: parent.id } };
  }

  return effect;
}

const dmgAScaled = (actor, item, target = null) => ruleScaledDamage(actor, target, { item, rolledSkill: item?.system?.classification?.skill });

test('Warfighter: +2 damage on Targeting weapon attacks', () => {
  const actor = holder(['gijcrbitems/_source/Warfighter_P0ZTAlcenVw2p4P1.json']);
  expect(dmgAScaled(actor, dmgAEffect(actor, { skill: 'targeting', style: 'projectile' }))).toMatchObject({ amount: 2, sources: ['Warfighter'] });
  expect(dmgAScaled(actor, dmgAEffect(actor, { skill: 'finesse' })).amount).toBe(0);
  expect(dmgAScaled(actor, null).amount).toBe(0);
  const none = holder([]);
  expect(dmgAScaled(none, dmgAEffect(none, { skill: 'targeting' })).amount).toBe(0);
});

test('Bear Hug: +1 damage on a Grapple attack only', () => {
  const actor = holder(['iafav2items/_source/Bear_Hug_id5IVoPuSC03mKfZ.json']);
  expect(dmgAScaled(actor, dmgAEffect(actor, { damageType: 'grapple' }))).toMatchObject({ amount: 1, sources: ['Bear Hug'] });
  expect(dmgAScaled(actor, dmgAEffect(actor, { damageType: 'blunt' })).amount).toBe(0);
});

test('Black / Red Ranger Prime: +1 damage with a Martial Arts / Power Weapon while Morphed', () => {
  for (const [file, trait] of [['prcrbitems/_source/Black_Ranger_Prime_nDJbufpNURXmVRJn.json', 'martialArts'], ['prcrbitems/_source/Red_Ranger_Prime_npFtRjCiJwrkmjyG.json', 'powerWeapon']]) {
    const actor = holder([file], { system: { isMorphed: true } });
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: [trait] } })).amount).toBe(1);
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['ballistic'] } })).amount).toBe(0);
    expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
    actor.system.isMorphed = false;
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: [trait] } })).amount).toBe(0);
  }
});

test('Pink / Yellow Ranger Prime: +1 damage on Targeting / Finesse attacks while Morphed', () => {
  for (const [file, skill] of [['prcrbitems/_source/Pink_Ranger_Prime_DHYxJEp1X1BDlm6K.json', 'targeting'], ['prcrbitems/_source/Yellow_Ranger_Prime_4M5y5ZcO5DNlnqwK.json', 'finesse']]) {
    const actor = holder([file], { system: { isMorphed: true } });
    expect(dmgAScaled(actor, dmgAEffect(actor, { skill })).amount).toBe(1);
    expect(dmgAScaled(actor, dmgAEffect(actor, { skill: 'might' })).amount).toBe(0);
    actor.system.isMorphed = false;
    expect(dmgAScaled(actor, dmgAEffect(actor, { skill })).amount).toBe(0);
  }
});

test('Silver Ranger Prime: +1 damage in the first round of combat', () => {
  const actor = holder(['atsitems/_source/Silver_Ranger_Prime_Bl9G8fgtd30wENkX.json']);
  try {
    game.combat = { round: 1, started: true };
    expect(dmgAScaled(actor, dmgAEffect(actor))).toMatchObject({ amount: 1, sources: ['Silver Ranger Prime'] });
    game.combat = { round: 2, started: true };
    expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
    game.combat = null;
    expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
  } finally {
    game.combat = null;
  }
});

test('Phantom Ranger Prime / Growth Boost: +1 damage on unarmed attacks', () => {
  for (const file of ['atsitems/_source/Phantom_Ranger_Prime_PHgWjT0syOOBOOK5.json', 'jttitems/_source/Growth_Boost_BVrwQKqvOdyNW0KR.json']) {
    const actor = holder([file]);
    expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(1);
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: {} })).amount).toBe(0);
  }
});

test('Vicious or Venom: +1 damage on natural weapon attacks once the choice is made', () => {
  const actor = holder(['tsitems/_source/Vicious_or_Venom_zey1cJ2IuWlTsjN2.json']);
  expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
  actor.items.contents[0].system.choice = 'poison';
  expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(1);
  const natural = { flags: { core: { sourceId: 'Compendium.essence20.technorganic_secrets.Item.uAW0sOmaPXl8DaX8' } } };
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: natural })).amount).toBe(1);
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: {} })).amount).toBe(0);
});

test('Ninja Power: +1 damage on unarmed attacks while Morphed and active', () => {
  const actor = holder(['prcrbitems/_source/Ninja_Power_wN5rjEQIJH68rWCd.json'], { system: { isMorphed: true } });
  actor.flags = { essence20: { ninjaPowerActive: true } };
  expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(1);
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: {} })).amount).toBe(0);
  actor.system.isMorphed = false;
  expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
  actor.system.isMorphed = true;
  actor.flags.essence20.ninjaPowerActive = false;
  expect(dmgAScaled(actor, dmgAEffect(actor)).amount).toBe(0);
});

test('Power Boost / Brute Force: the advance value as damage with a Power Weapon while active (at least 1)', () => {
  for (const file of ['atsitems/_source/Power_Boost_m3Kh8PqGf3O1oMmc.json', 'bthitems/_source/Brute_Force_3XP5RgmeyQwE5HH9.json']) {
    const actor = holder([file]);
    actor.flags = { essence20: { powerBoostActive: true } };
    const perk = actor.items.contents[0];
    perk.system.advances = { ...perk.system.advances, currentValue: 3 };
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['powerWeapon'] } }))).toMatchObject({ amount: 3, sources: [perk.name] });
    perk.system.advances.currentValue = 0;
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['powerWeapon'] } })).amount).toBe(1);
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: [] } })).amount).toBe(0);
    actor.flags.essence20.powerBoostActive = false;
    expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['powerWeapon'] } })).amount).toBe(0);
  }
});

test('Zeo Crystal Boost: +1 damage with a Power Weapon while the Power Weapon option is chosen', () => {
  const actor = holder(['atsitems/_source/Zeo_Crystal_Boost_NiEaLWcx8N48fvvN.json']);
  actor.flags = { essence20: { zeoCrystalBoostOption: 'weapon' } };
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['powerWeapon'] } }))).toMatchObject({ amount: 1, sources: ['Zeo Crystal Boost'] });
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: [] } })).amount).toBe(0);
  actor.flags.essence20.zeoCrystalBoostOption = 'morpher';
  expect(dmgAScaled(actor, dmgAEffect(actor, { weapon: { traits: ['powerWeapon'] } })).amount).toBe(0);
});

test('Exploit Trust: Edge and +1 damage outside combat or against a Surprised target', () => {
  const actor = holder(['tfcrbitems/_source/Exploit_Trust_TpanlsVW9nobDZyy.json']);
  const surprised = { statuses: new Set(['surprised']) };
  const alert = { statuses: new Set() };
  try {
    game.combat = null;
    const item = dmgAEffect(actor);
    expect(ruleRollSources(actor, alert, { item }).sources[0]).toMatchObject({ edge: true });
    expect(ruleScaledDamage(actor, alert, { item })).toMatchObject({ amount: 1, sources: ['Exploit Trust'] });
    game.combat = { round: 1, started: true };
    expect(ruleRollSources(actor, alert, { item }).sources).toEqual([]);
    expect(ruleScaledDamage(actor, alert, { item }).amount).toBe(0);
    expect(ruleScaledDamage(actor, null, { item }).amount).toBe(0);
    expect(ruleRollSources(actor, surprised, { item }).sources[0]).toMatchObject({ edge: true });
    expect(ruleScaledDamage(actor, surprised, { item }).amount).toBe(1);
    expect(ruleRollSources(actor, surprised, { rolledSkill: 'athletics' }).sources).toEqual([]);
  } finally {
    game.combat = null;
  }
});

test('Precision Aim: a damage switch on ranged attacks for the advance value', () => {
  const actor = holder(['prcrbitems/_source/Precision_Aim_tljdouRqNGgQQDz6.json']);
  const ranged = { item: dmgAEffect(actor, { skill: 'targeting', style: 'projectile' }) };
  const perk = actor.items.contents[0];
  expect(switchNames(actor, ranged)).toEqual([]);
  perk.system.advances = { ...perk.system.advances, currentValue: 2 };
  expect(switchNames(actor, ranged)).toHaveLength(1);
  expect(switchNames(actor, { item: dmgAEffect(actor) })).toEqual([]);
  const ticked = tick(actor, ranged);
  expect(ticked).toMatchObject({ ruleDamage: 2, ruleDamageSources: switchNames(actor, ranged) });
  expect(ticked.shiftUp).toBe(0);
});

test('Sneak Attack (Knights of Canterlot) / Target Vulnerability: +2 / +1 damage switches on any attack', () => {
  for (const [file, damage] of [['kocitems/_source/Sneak_Attack_DYPFsyQpIYGkJpgE.json', 2], ['tfcrbitems/_source/Target_Vulnerability_SaHjAp42EhhOQr2g.json', 1]]) {
    const actor = holder([file]);
    const attack = { item: dmgAEffect(actor) };
    expect(switchNames(actor, attack)).toHaveLength(1);
    expect(switchNames(actor, { rolledSkill: 'might' })).toEqual([]);
    expect(tick(actor, attack)).toMatchObject({ ruleDamage: damage });
    expect(tick(actor, { rolledSkill: 'might' }).ruleDamage).toBeUndefined();
  }
});

test('All I Need Is One Shot: ↑2 and +2 damage switch on ranged attacks', () => {
  const actor = holder(['eocitems/_source/All_I_Need_Is_One_Shot_Y1sMUqI3JOYb0QiD.json']);
  const ranged = { item: dmgAEffect(actor, { skill: 'targeting', style: 'projectile' }) };
  expect(switchNames(actor, ranged)).toHaveLength(1);
  expect(switchNames(actor, { item: dmgAEffect(actor) })).toEqual([]);
  expect(tick(actor, ranged)).toMatchObject({ shiftUp: 2, ruleDamage: 2 });
});

test('Barrel Through: a +1 damage switch on Ram attacks', () => {
  const actor = holder(['tfcrbitems/_source/Barrel_Through_uyhMkYlTF9tfoVGC.json']);
  const ram = { item: dmgAEffect(actor, { isRam: true }) };
  expect(switchNames(actor, ram)).toEqual(['Moved 20 ft before this Ram (Barrel Through: +1 damage)']);
  expect(switchNames(actor, { item: dmgAEffect(actor) })).toEqual([]);
  expect(tick(actor, ram)).toMatchObject({ ruleDamage: 1, ruleDamageSources: ['Moved 20 ft before this Ram (Barrel Through: +1 damage)'] });
});

/* init batch: dice.mjs#prepareInitiativeRoll's Perk checks as item rules - roll:initiative RollModifiers and
   useSkill DialogSwitches ("roll <Skill> instead of Initiative"). */

const INIT_ROLL = { rolledSkill: 'initiative', dataset: { isInitiative: true }, baseShift: 'd20' };
const initSources = (actor, roll = INIT_ROLL) => ruleRollSources(actor, null, roll).sources;
const initSwaps = (actor, roll = INIT_ROLL) => ruleDialogSwitches(actor, roll).filter(s => s.entry.rule.useSkill);

test.each([
  ['tfcrbitems/_source/Prepare_For_War_sM2Uk6ZzOS3CPzoW.json', 0],
  ['tfcrbitems/_source/Sirens_Blaring_WZA3q9BRESFVx6SS.json', 1],
  ['gijcrbitems/_source/Ready_For_Anything_BEAZ1oLp9XeibJoh.json', 0],
  ['sssitems/_source/On_Your_Feet_4qibn7JQ1lHTe9gT.json', 0],
])('%s: Edge (and ↑%i) on every Initiative roll, whatever Skill it uses', (file, shiftUp) => {
  const actor = holder([file]);
  expect(initSources(actor)).toEqual([expect.objectContaining({ edge: true, shiftUp })]);
  expect(initSources(actor, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([expect.objectContaining({ edge: true, shiftUp })]);
  expect(initSources(actor, { rolledSkill: 'athletics' })).toEqual([]);
});

test('Prepare For War + Sirens Blaring: Edge, and only the one ↑1', () => {
  const actor = holder(['tfcrbitems/_source/Prepare_For_War_sM2Uk6ZzOS3CPzoW.json', 'tfcrbitems/_source/Sirens_Blaring_WZA3q9BRESFVx6SS.json']);
  const sources = initSources(actor);
  expect(sources.every(source => source.edge)).toBe(true);
  expect(sources.reduce((n, source) => n + source.shiftUp, 0)).toBe(1);
});

test('Hail Megatron!: ↑1 on Initiative in the first round of combat only', () => {
  const actor = holder(['dditems/_source/Hail_Megatron__3IHBbGOucL4eAFAA.json'], { system: { isTransformed: false } });
  const saved = game.combat;
  try {
    game.combat = { round: 1 };
    expect(initSources(actor)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(initSources(actor, { rolledSkill: 'athletics' })).toEqual([]);
    game.combat = { round: 2 };
    expect(initSources(actor)).toEqual([]);
    game.combat = null;
    expect(initSources(actor)).toEqual([]);
  } finally {
    game.combat = saved;
  }
});

test('Peerless Pilot (GI Joe CRB): Initiative Edge while driving with a Driving Specialization', () => {
  const actor = holder(['gijcrbitems/_source/Peerless_Pilot_y39VC0CIsI8mdLKK.json'],
    { system: { skills: { driving: { specializations: { s1: { name: 'Motorcycles' } } } } } });
  actor.uuid = 'Actor.peerlessPilot';
  const car = role => ({ type: 'vehicle', system: { actors: { a: { uuid: 'Actor.peerlessPilot', vehicleRole: role } } } });
  try {
    global.game.actors = { contents: [car('driver')] };
    expect(initSources(actor)).toEqual([expect.objectContaining({ edge: true })]);
    // Only a passenger, or not in a vehicle at all.
    global.game.actors = { contents: [car('passenger')] };
    expect(initSources(actor)).toEqual([]);
    global.game.actors = { contents: [] };
    expect(initSources(actor)).toEqual([]);
    // No Driving Specialization.
    global.game.actors = { contents: [car('driver')] };
    actor.system.skills.driving.specializations = {};
    expect(initSources(actor)).toEqual([]);
  } finally {
    delete global.game.actors;
  }
});

test('Daredevil: Initiative Edge in Alt Mode only', () => {
  const actor = holder(['tfcrbitems/_source/Daredevil_8GgFGdlmri0GyKNI.json'], { system: { isTransformed: true } });
  expect(initSources(actor)).toEqual([expect.objectContaining({ edge: true, shiftUp: 0 })]);
  actor.system.isTransformed = false;
  expect(initSources(actor)).toEqual([]);
});

test('Area Awareness: Initiative Edge while Surprised', () => {
  const actor = holder(['dditems/_source/Area_Awareness_cf2zIWdlulvGmRU5.json'], { statuses: ['surprised'] });
  expect(initSources(actor)).toEqual([expect.objectContaining({ edge: true })]);
  actor.statuses.clear();
  expect(initSources(actor)).toEqual([]);
});

test('Community Helper (National Guard): one Initiative Edge, whatever Skill Initiative uses', () => {
  const actor = holder(['prcrbitems/_source/Community_Helper_6CnhyT0WBSFHwVGq.json']);
  actor.items.contents[0].system.choice = 'initiative';
  expect(initSources(actor)).toEqual([expect.objectContaining({ edge: true })]);
  expect(initSources(actor, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([expect.objectContaining({ edge: true })]);
  actor.items.contents[0].system.choice = 'brawn';
  expect(initSources(actor)).toEqual([]);
  expect(initSources(actor, { rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([]);
});

test('Wisdom of the Eldars: Initiative ↑2 while Enhanced Reflexes is on, once for two copies', () => {
  const file = 'ttsgitems/_source/Wisdom_of_the_Eldars_SB6FAYA0qIqV9F3G.json';
  const actor = holder([file, file]);
  for (const item of actor.items.contents) {
    item.flags = { core: { sourceId: 'Compendium.essence20.through_the_shattered_grid.Item.SB6FAYA0qIqV9F3G' } };
  }

  rebuildIndex(actor);
  actor.flags = { essence20: { wisdomOfTheEldersActive: { enhancedReflexes: true } } };
  expect(initSources(actor)).toEqual([expect.objectContaining({ shiftUp: 2 })]);
  expect(initSources(actor, { rolledSkill: 'acrobatics' })).toEqual([]);
  actor.flags.essence20.wisdomOfTheEldersActive = { enhancedReflexes: false, lightshieldArmor: true };
  expect(initSources(actor)).toEqual([]);
});

const INIT_SWAP_SKILLS = ['alertness', 'streetwise', 'performance', 'infiltration', 'deception', 'intimidation'];

test.each([
  ['ghpfitems/_source/Ever_Vigilant_mvRJqqrgfu5AXOZt.json', ['alertness'], 0],
  ['tfcrbitems/_source/Nose_for_Trouble_VUal4FUlNIrwo2MG.json', ['streetwise'], 0],
  ['gijcrbitems/_source/Nose_For_Trouble_MH630UTgsJtbf3Y5.json', ['streetwise'], 0],
  ['gijcrbitems/_source/Danger_Sense_2hwFRZ67xIGt1XTm.json', ['alertness'], 2],
  ['ghpfitems/_source/Needle_Drop_eKkAuWHCtHPocK8f.json', ['performance'], 0],
  ['fffav1items/_source/Rapid_Deployment_Drills_pQvXMpk7uAvfuGMl.json', ['alertness', 'infiltration'], 0],
  ['qgtgitems/_source/Spoof_LBuVQrU8sDOVCQAQ.json', ['deception', 'infiltration'], 0],
  ['iafav2items/_source/Your_Reputation_Precedes_You_a1DfsvPTypMxIgxA.json', ['intimidation'], 0],
  ['ccitems/_source/Cobra_Battle_Cry_cqOozFDOGiQoV0L7.json', ['deception', 'intimidation'], 0],
  ['tf1sitems/_source/Deceptive_Warfare_OJcHMBA3QYgPp5w0.json', ['deception', 'infiltration'], 0],
])('%s: Initiative switches to roll %j instead (+↑%i)', async (file, skills, extra) => {
  for (const skill of skills) {
    const skillData = Object.fromEntries(['initiative', ...INIT_SWAP_SKILLS].map(key => [key, { shift: key == skill ? 'd10' : 'd20' }]));
    const actor = holder([file], { system: { skills: skillData } });
    const swaps = initSwaps(actor);
    expect(swaps.map(s => s.entry.rule.useSkill)).toEqual(skills);
    // Off until ticked, like the old checkboxes.
    expect(swaps.every(s => s.value === false)).toBe(true);
    const options = { shiftUp: 0, shiftDown: 0, ext: { [swaps[skills.indexOf(skill)].name]: true } };
    await applyRuleSwitches(actor, options, INIT_ROLL);
    // Initiative's d20 to that Skill's d10 is 5 steps up the shift list (plus Danger Sense's own ↑2).
    expect(options.shiftUp).toBe(5 + extra);
    expect(options.shiftDown).toBe(0);
    // Never offered on an ordinary Skill Test.
    expect(initSwaps(actor, { rolledSkill: 'athletics' })).toEqual([]);
  }

  // Not offered for a Skill the actor doesn't have.
  expect(initSwaps(holder([file], { system: { skills: { initiative: { shift: 'd20' } } } }))).toEqual([]);
});

/* cover: the Perks in dice.mjs#_getAutomaticCombatModifiers's Cover block moved to Cover rules. */

const coverFile = (dir, id) => `${dir}/_source/` + readdirOf(dir).find(n => n.endsWith(`_${id}.json`));

/** A ranged weapon effect on `actor`, belonging to `weapon` (added to the actor) when given. */
function coverShot(actor, weapon = null) {
  if (weapon) {
    actor.items.contents.push(weapon);
  }

  return { type: 'weaponEffect', parent: actor, flags: weapon ? { essence20: { parentId: weapon.id } } : {}, system: { classification: { style: 'projectile' } } };
}

const coverWeapon = (flags, system = {}) => ({ id: `cw${nextId++}`, type: 'weapon', flags, system });

test('Penetrating Rounds: ignores Cover with the Shotgun or Submachine Gun only', () => {
  const actor = holder([coverFile('gijcrbitems', 'JLwbWSlHn5q3rqnH')]);
  const target = holder([], { statuses: ['cover'] });
  const gij = id => coverWeapon({ core: { sourceId: `Compendium.essence20.gi_joe_crb.Item.${id}` } });
  expect(ruleCover(actor, target, { item: coverShot(actor, gij('2qW1YLopvjKyezNQ')) }).ignore).toBe(true);
  expect(ruleCover(actor, target, { item: coverShot(actor, gij('oJInlAgdYZzjH7bk')) }).ignore).toBe(true);
  // An unrelated weapon, or the Transformers printing of the Shotgun (the old check matched the GI Joe one only).
  expect(ruleCover(actor, target, { item: coverShot(actor, coverWeapon({ core: { sourceId: 'other' } })) }).ignore).toBe(false);
  expect(ruleCover(actor, target, { item: coverShot(actor, coverWeapon({ core: { sourceId: 'Compendium.essence20.tf_crb.Item.2qW1YLopvjKyezNQ' } })) }).ignore).toBe(false);
  // Without the Perk, even with a shotgun.
  const plain = holder([]);
  expect(ruleCover(plain, target, { item: coverShot(plain, gij('2qW1YLopvjKyezNQ')) }).ignore).toBe(false);
});

test('Kentucky Windage: ignores Cover with a sniper weapon only', () => {
  const actor = holder([coverFile('gijcrbitems', '0MKcgJ4mUHDotl2k')]);
  const target = holder([], { statuses: ['cover'] });
  expect(ruleCover(actor, target, { item: coverShot(actor, coverWeapon({}, { traits: ['sniper'] })) }).ignore).toBe(true);
  expect(ruleCover(actor, target, { item: coverShot(actor, coverWeapon({}, { traits: [] })) }).ignore).toBe(false);
  const plain = holder([]);
  expect(ruleCover(plain, target, { item: coverShot(plain, coverWeapon({}, { traits: ['sniper'] })) }).ignore).toBe(false);
});

test.each([
  ['dditems', 'lBSdHGBOOVvEYW1t'],
  ['tfcrbitems', 'rdhSMPSXlcxQUVYj'],
])('Maximize Cover / Hard Target (TF) %s %s: Cover is ↓3 against the holder, not on its own attacks', (dir, id) => {
  const perk = holder([coverFile(dir, id)], { statuses: ['cover'] });
  const plain = holder([], { statuses: ['cover'] });
  expect(ruleCover(plain, perk, { item: coverShot(plain) }).base).toBe(3);
  expect(ruleCover(perk, plain, { item: coverShot(perk) }).base).toBe(0);
});

test.each([
  ['eocitems', 'A2gJlm0YEFlpVNLg', 1],
  ['eocitems', 'CTt9gmibpffGC0N4', 1],
  ['tfcrbitems', 'A6QkTlG2DQYYwNOb', 1],
  ['tfcrbitems', 'ku86uidqAswijlAd', 2],
])('What Cover? / Lay of the Land / Nowhere\'s Safe x2 %s %s: Cover ↓%i less on the holder\'s attacks, not against it', (dir, id, less) => {
  const perk = holder([coverFile(dir, id)], { statuses: ['cover'] });
  const plain = holder([], { statuses: ['cover'] });
  expect(ruleCover(perk, plain, { item: coverShot(perk) }).reduce).toBe(less);
  expect(ruleCover(plain, perk, { item: coverShot(plain) }).reduce).toBe(0);
});

test('Absolutely Nowhere\'s Safe takes precedence over Nowhere\'s Safe (no double reduction)', () => {
  const both = holder([coverFile('tfcrbitems', 'A6QkTlG2DQYYwNOb'), coverFile('tfcrbitems', 'ku86uidqAswijlAd')]);
  expect(ruleCover(both, holder([], { statuses: ['cover'] }), { item: coverShot(both) }).reduce).toBe(2);
});

test('Dig In (Cannoneer): Cover ↓1 more against the holder only while dug in', async () => {
  const { registerCheck } = await import('./predicate.mjs');
  const { isCannoneerDugIn } = await import('../helpers/cannoneer-dig-in.mjs');
  registerCheck('cannoneerDugIn', actor => isCannoneerDugIn(actor));
  const target = holder([coverFile('eocitems', 'RQjNiRZxDFwTPHN8')], { statuses: ['cover'] });
  target.flags = { essence20: { cannoneerDugIn: false } };
  target.getFlag = (scope, key) => target.flags[scope]?.[key];
  const plain = holder([]);
  expect(ruleCover(plain, target, { item: coverShot(plain) }).add).toBe(0);
  target.flags.essence20.cannoneerDugIn = true;
  expect(ruleCover(plain, target, { item: coverShot(plain) }).add).toBe(1);
  // On the attacker it adds nothing.
  expect(ruleCover(target, holder([], { statuses: ['cover'] }), { item: coverShot(target) }).add).toBe(0);
});

test('Now You Don\'t: counts as in Cover while in Alt Mode, without the status', () => {
  const file = coverFile('tfcrbitems', 'iW9TjN9X6SsYm2Ql');
  const plain = holder([]);
  expect(ruleCover(plain, holder([file], { system: { isTransformed: true } }), { item: coverShot(plain) }).grant).toBe(true);
  expect(ruleCover(plain, holder([file], { system: { isTransformed: false } }), { item: coverShot(plain) }).grant).toBe(false);
  expect(ruleCover(plain, holder([], { system: { isTransformed: true } }), { item: coverShot(plain) }).grant).toBe(false);
});

/* subst batch: rollSkill's optional "use Skill X instead" checkboxes as DialogSwitch {useSkill} rules (the shift
   difference to that Skill's die, against the die rolled before the dialog - ctx.baseShift); On My Own / Deafening
   Silence (ally:within counts allies the way getNearbyAllyTokens does); flat relative-size Perks as RollModifiers with
   target:sizeDiff - Large And In Charge, Front-Weighted, Brutal Might (Edge half), Giant-Killer x2, Spared No Expense. */

const substSkills = shifts => ({ skills: Object.fromEntries(Object.entries(shifts).map(([key, shift]) => [key, { shift }])) });

test.each([
  ['How Strange!', 'wtnvcgitems/_source/How_Strange__zsuQoBsso5SddTAs.json', 'weird', 'athletics', 'science'],
  ['Wire Work', 'gijcrbitems/_source/Wire_Work_TGqWGjDUy24SPSGZ.json', 'athletics', 'acrobatics', 'acrobatics'],
  ['Ambush Predator', 'fffav1items/_source/Ambush_Predator_ht6w4P3AsRze8S68.json', 'infiltration', 'alertness', 'survival'],
  ['City Slicker', 'iafav2items/_source/City_Slicker_xU1p1S5JuVu6XiAI.json', 'infiltration', 'deception', 'streetwise'],
  ['Street Smarts', 'ccitems/_source/Street_Smarts_np3oMccakpivWuSQ.json', 'persuasion', 'deception', 'streetwise'],
  ['Primal Fear', 'ccitems/_source/Primal_Fear_xoD8fbVVqymTidNJ.json', 'intimidation', 'persuasion', 'survival'],
  ['Natural Science', 'ccitems/_source/Natural_Science_AXmmcHK2tSzRZLqB.json', 'science', 'technology', 'survival'],
  ['Natural Science', 'ccitems/_source/Natural_Science_AXmmcHK2tSzRZLqB.json', 'survival', 'technology', 'science'],
  ['Science Fixes All', 'ccitems/_source/Science_Fixes_All_cxTzdLpTblPMMEQk.json', 'technology', 'science', 'science'],
  ['Urban Jungle', 'ccitems/_source/Urban_Jungle_wIesQd7U5W2azAWY.json', 'survival', 'alertness', 'streetwise'],
  ['Fear Is Universal', 'ccitems/_source/Fear_Is_Universal_oGVp2hIxNBT8g1QW.json', 'animalHandling', 'athletics', 'intimidation'],
  ['Fear Is Universal', 'ccitems/_source/Fear_Is_Universal_oGVp2hIxNBT8g1QW.json', 'deception', 'athletics', 'intimidation'],
  ['Fear Is Universal', 'ccitems/_source/Fear_Is_Universal_oGVp2hIxNBT8g1QW.json', 'persuasion', 'athletics', 'intimidation'],
])('%s (%s): rolling %s, not %s, offers the switch; ticked, the shift difference to %s', (name, file, rolled, other, to) => {
  const actor = holder([file], { system: substSkills({ [rolled]: 'd6', [other]: 'd6', [to]: 'd10' }) });
  const offered = ruleDialogSwitches(actor, { rolledSkill: rolled }).filter(s => s.entry.rule.useSkill);
  expect(offered.map(s => s.entry.rule.useSkill)).toEqual([to]);
  expect(offered[0].value).toBe(false);
  expect(ruleDialogSwitches(actor, { rolledSkill: other }).filter(s => s.entry.rule.useSkill)).toEqual([]);
  // d6 -> d10 is two steps better; against the die rolled before the dialog (here a d4), three.
  expect(tick(actor, { rolledSkill: rolled })).toMatchObject({ shiftUp: 2, shiftDown: 0 });
  expect(tick(actor, { rolledSkill: rolled, baseShift: 'd4' })).toMatchObject({ shiftUp: 3, shiftDown: 0 });
});

test('Natural Science: substituting a worse die is a downshift', () => {
  const actor = holder(['ccitems/_source/Natural_Science_AXmmcHK2tSzRZLqB.json'], { system: substSkills({ science: 'd6', survival: 'd10' }) });
  expect(tick(actor, { rolledSkill: 'survival' })).toMatchObject({ shiftUp: 0, shiftDown: 2 });
});

test.each([
  ['Hesher', 'iafav2items/_source/Hesher_4PCn3kSSYmPtQOUM.json', 'performance'],
  ['Brain Power', 'gijcrbitems/_source/Brain_Power_3KaGPbEZp3ZDQrIF.json', 'technology'],
])('%s (%s): the switch is offered on the chosen Skill only, rolling %s instead', (name, file, to) => {
  const actor = holder([file], { system: substSkills({ intimidation: 'd6', persuasion: 'd6', [to]: 'd10' }) });
  expect(switchNames(actor, { rolledSkill: 'intimidation' })).toEqual([]);
  actor.items.contents[0].system.choice = 'intimidation';
  expect(switchNames(actor, { rolledSkill: 'intimidation' })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'intimidation' })).toMatchObject({ shiftUp: 2 });
});

/** An attack made with a weapon (the effect's parent) carrying these numbers. */
function substArmed(actor, weapon, effectSystem = {}) {
  const id = `w${nextId++}`;
  actor.items.contents.push({ id, type: 'weapon', name: 'Weapon', flags: {}, parent: actor, ...weapon });
  return { type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: id } }, system: { classification: { style: 'ranged' }, ...effectSystem } };
}

test('Brute Force: roll Brawn instead on a Targeting attack with a heavy weapon only', () => {
  const actor = holder(['iafav2items/_source/Brute_Force_T75CELkuLUUgmxXZ.json'], { system: substSkills({ targeting: 'd6', brawn: 'd10' }) });
  const heavy = substArmed(actor, { system: { classification: { size: 'heavy' } } });
  const light = substArmed(actor, { system: { classification: { size: 'light' } } });
  expect(switchNames(actor, { rolledSkill: 'targeting', item: heavy })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: light })).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'targeting' })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'targeting', item: heavy })).toMatchObject({ shiftUp: 2 });
});

test('Mightier Than the Sword: roll Streetwise instead attacking with the WTNV Dagger only', () => {
  const actor = holder(['wtnvcgitems/_source/Mightier_Than_the_Sword_KPjNit8G842eVCMd.json'], { system: substSkills({ finesse: 'd6', streetwise: 'd10' }) });
  const dagger = substArmed(actor, { flags: { core: { sourceId: 'Compendium.essence20.wtnv_citizens_guide.Item.ZLvRtMySr9GPe4oD' } } });
  const other = substArmed(actor, { flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.other' } } });
  expect(switchNames(actor, { rolledSkill: 'finesse', item: dagger })).toHaveLength(1);
  expect(switchNames(actor, { rolledSkill: 'finesse', item: other })).toEqual([]);
  expect(tick(actor, { rolledSkill: 'finesse', item: dagger })).toMatchObject({ shiftUp: 2 });
});

test('Explosive Engineer: Science or Technology instead on an explosive attack only', () => {
  const actor = holder(['ghpfitems/_source/Explosive_Engineer_1MCKcleeXZZf5PQF.json'], { system: substSkills({ targeting: 'd6', science: 'd10', technology: 'd8' }) });
  const explosive = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'explosive', skill: 'targeting' } } };
  const ranged = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'ranged', skill: 'targeting' } } };
  const [science, technology] = ruleDialogSwitches(actor, { rolledSkill: 'targeting', item: explosive });
  expect([science.entry.rule.useSkill, technology.entry.rule.useSkill]).toEqual(['science', 'technology']);
  expect(switchNames(actor, { rolledSkill: 'targeting', item: ranged })).toEqual([]);
  expect(switchNames(actor, { rolledSkill: 'targeting' })).toEqual([]);
  const options = { shiftUp: 0, shiftDown: 0, ext: { [technology.name]: true } };
  applyRuleSwitches(actor, options, { rolledSkill: 'targeting', item: explosive });
  expect(options.shiftUp).toBe(1);
});

test('Roaring Engine: roll Driving instead on Intimidation while driving', () => {
  const actor = holder(['iafav2items/_source/Roaring_Engine_zzEmLhFcExVXhT5g.json'], { system: substSkills({ intimidation: 'd6', driving: 'd10' }) });
  actor.uuid = `Actor.${actor.id}`;
  const seat = role => ({ type: 'vehicle', uuid: `Actor.ride${nextId++}`, system: { actors: { a: { uuid: actor.uuid, vehicleRole: role } } } });
  const before = game.actors;
  try {
    game.actors = { contents: [actor, seat('driver')] };
    expect(switchNames(actor, { rolledSkill: 'intimidation' })).toHaveLength(1);
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    expect(tick(actor, { rolledSkill: 'intimidation' })).toMatchObject({ shiftUp: 2 });
    game.actors = { contents: [actor, seat('gunner')] };
    expect(switchNames(actor, { rolledSkill: 'intimidation' })).toEqual([]);
    game.actors = { contents: [actor] };
    expect(switchNames(actor, { rolledSkill: 'intimidation' })).toEqual([]);
  } finally {
    game.actors = before;
  }
});

describe('subst: ally range (On My Own, Deafening Silence)', () => {
  const place = (actor, x, disposition = 1) => {
    const token = { actor, center: { x, y: 0 }, document: { disposition } };
    actor.getActiveTokens = () => [token];
    return token;
  };

  afterEach(() => {
    delete global.canvas;
  });

  function onCanvas(actor, allyAt) {
    const tokens = [place(actor, 0)];
    if (allyAt !== null) {
      tokens.push(place(holder([]), allyAt));
    }

    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: tokens } };
  }

  test('On My Own: ↑1 with no ally within 10 ft', () => {
    const actor = holder(['fmmcitems/_source/On_My_Own_WlpzIGEGQEL7B78w.json']);
    onCanvas(actor, null);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    onCanvas(actor, 50);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    onCanvas(actor, 5);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
  });

  test('Deafening Silence: ↓1 on Smarts and Social with no ally within 50 ft', () => {
    const actor = holder(['dsoeitems/_source/Deafening_Silence_u0MiPZ6CXb1plk6L.json']);
    onCanvas(actor, null);
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness', rolledEssence: 'smarts' }).sources).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social' }).sources).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might', rolledEssence: 'strength' }).sources).toEqual([]);
    onCanvas(actor, 40);
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness', rolledEssence: 'smarts' }).sources).toEqual([]);
  });
});

describe('subst: relative size', () => {
  const sized = size => ({ type: 'npc', statuses: new Set(), flags: {}, system: { size } });
  const attack = (skill = 'might') => ({ item: { type: 'weaponEffect', flags: {}, system: { classification: { skill, style: 'melee' } } } });
  const sources = (actor, target, ctx) => ruleRollSources(actor, target, ctx).sources;

  test('Large And In Charge: ↑1 on the chosen Skill against a smaller target, not scaled', () => {
    const actor = holder(['tfcrbitems/_source/Large_And_In_Charge_Rj9N6i7Jmkl54ujX.json'], { system: { size: 'common' } });
    expect(sources(actor, sized('small'), { rolledSkill: 'persuasion' })).toEqual([]);
    actor.items.contents[0].system.choice = 'persuasion';
    expect(sources(actor, sized('small'), { rolledSkill: 'persuasion' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(sources(actor, sized('common'), { rolledSkill: 'persuasion' })).toEqual([]);
    expect(sources(actor, sized('small'), { rolledSkill: 'deception' })).toEqual([]);
    expect(sources(actor, null, { rolledSkill: 'persuasion' })).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    const long = holder(['tfcrbitems/_source/Large_And_In_Charge_Rj9N6i7Jmkl54ujX.json'], { system: { size: 'long' } });
    long.items.contents[0].system.choice = 'persuasion';
    expect(sources(long, sized('small'), { rolledSkill: 'persuasion' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  });

  test('Front-Weighted: ↑1 attacking a smaller target with its own weapon', () => {
    const actor = holder(['eocitems/_source/Front_Weighted_eqNlaOfQ39WMGP18.json'], { system: { size: 'common' } });
    const [upgrade] = actor.items.contents;
    actor.items.contents.push({ id: 'w1', name: 'Club', type: 'weapon', flags: {}, system: {}, parent: actor });
    upgrade.flags = { essence20: { parentId: 'w1' } };
    rebuildIndex(actor);
    const own = { item: { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'w1' } } } };
    const other = { item: { type: 'weaponEffect', system: {}, flags: { essence20: { parentId: 'w2' } } } };
    expect(sources(actor, sized('small'), own)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(sources(actor, sized('common'), own)).toEqual([]);
    expect(sources(actor, sized('small'), other)).toEqual([]);
  });

  test('Brutal Might: Edge on a Might-classified attack against a smaller target', () => {
    const actor = holder(['eocitems/_source/Brutal_Might_l0STCEYBuPMYfzSt.json'], { system: { size: 'long' } });
    expect(sources(actor, sized('common'), { ...attack('might'), rolledSkill: 'brawn' })).toEqual([expect.objectContaining({ edge: true })]);
    expect(sources(actor, sized('common'), { ...attack('brawn'), rolledSkill: 'brawn' })).toEqual([]);
    expect(sources(actor, sized('long'), { ...attack('might'), rolledSkill: 'brawn' })).toEqual([]);
  });

  test.each([
    'prcrbitems/_source/Giant_Killer_ej3F6z4xU3qfzrKO.json',
    'tsitems/_source/Giant_Killer_6dgaHPsHzVhdZkZ9.json',
  ])('Giant-Killer (%s): ↑1 at 2+ sizes larger, Edge at 6+, attacks only', file => {
    const actor = holder([file], { system: { size: 'common' } });
    expect(sources(actor, sized('long'), attack())).toEqual([expect.objectContaining({ shiftUp: 1, edge: false })]);
    expect(sources(actor, sized('large'), attack())).toEqual([]);
    expect(sources(actor, sized('long'), { rolledSkill: 'persuasion' })).toEqual([]);
    const small = holder([file], { system: { size: 'small' } });
    expect(sources(small, sized('titanic'), attack())).toEqual([
      expect.objectContaining({ shiftUp: 1 }), expect.objectContaining({ edge: true }),
    ]);
  });

  test('Giant-Killer: both printings still give a single ↑1', () => {
    const actor = holder(['prcrbitems/_source/Giant_Killer_ej3F6z4xU3qfzrKO.json', 'tsitems/_source/Giant_Killer_6dgaHPsHzVhdZkZ9.json'], { system: { size: 'small' } });
    const all = sources(actor, sized('titanic'), attack());
    expect(all.reduce((sum, s) => sum + s.shiftUp, 0)).toBe(1);
    expect(all.filter(s => s.edge)).toHaveLength(1);
  });

  test('Spared No Expense: Edge on an attack against a larger target', () => {
    const actor = holder(['fffav1items/_source/Spared_No_Expense_3ZrBd6FhV6Fep1zq.json'], { system: { size: 'common' } });
    expect(sources(actor, sized('large'), attack()).filter(s => s.edge)).toHaveLength(1);
    expect(sources(actor, sized('common'), attack()).filter(s => s.edge)).toEqual([]);
    expect(sources(actor, sized('large'), { rolledSkill: 'alertness' }).filter(s => s.edge)).toEqual([]);
  });
});

/* move batch: the id-keyed Movement Perks of documents/actor.mjs#_prepareMovement as Movement rules (stages
   base / total / adjust / final) with check: tags - run through the real _prepareMovement. */

describe('move batch: Movement rules through _prepareMovement', () => {
  const MOVE = {
    fast: 'gijcrbitems/_source/Fast_5IWpV61QlVwBkpTI.json',
    airBorn: 'mlpcrbitems/_source/Air_Born_ekWiJObUf2BAhevg.json',
    staticElectricity: 'wtnvcgitems/_source/Static_Electricity_mF6zMzGIfxQgJF9B.json',
    gravityOptional: 'wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json',
    prowl: 'gijcrbitems/_source/Prowl_ZCOzxoy7d3P5izBB.json',
    wireWork: 'gijcrbitems/_source/Wire_Work_TGqWGjDUy24SPSGZ.json',
    amphibiousAssault: 'qgtgitems/_source/Amphibious_Assault_X2atZm3eoIBJcwF6.json',
    iCanDigIt: 'tsitems/_source/I_Can_Dig_It_0BrnoOPvwSSQ5oVe.json',
    warriorRush: 'tfcrbitems/_source/Warrior_Rush_jTNi4jENlLEq8ruS.json',
    rushTheLine: 'iafav2items/_source/Rush_the_Line_va1HF5CudO4WsguB.json',
    frictionless: 'tsitems/_source/Frictionless_Movement_9fOrSAd3brtSBk9C.json',
    expandedMysticism: 'mlpcrbitems/_source/Expanded_Mysticism_xL0lmmS7P046RNqO.json',
    thunderousAdvance: 'gijcrbitems/_source/Thunderous_Advance_B0yM8ewEoYJb1GBg.json',
    bulwark: 'gijcrbitems/_source/Bulwark_7758n3XWOzhSjdOk.json',
    overTheCandlestick: 'tsitems/_source/Over_the_Candlestick_zKngKkwDyNv2nnH5.json',
    sprinter: 'tsitems/_source/Sprinter_L5P54Ismw81Lhrbe.json',
    tf1sSprinter: 'tf1sitems/_source/Sprinter_gbDY8UiTgSNZHPAo.json',
    skier: 'ghpfitems/_source/Skier_dvmY7UiuKejOPY4N.json',
    fieldAid: 'gijcrbitems/_source/Field_Aid_5JUC0fO9hUIJFP6u.json',
    eltarianTraining: 'ttsgitems/_source/Eltarian_Training_NXxiyoOB60ems444.json',
    quantumMaster: 'jttitems/_source/Quantum_Master_YlHp7yzbOsytNUjD.json',
    scubaGear: 'gijcrbitems/_source/Scuba_Gear_cZpeYK7VoLJKGKL6.json',
  };

  test('Wildfire: +10 to every Movement the actor already has, only while wielding a Fire weapon', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    registerCheck('equippedFireWeapon', actor => !!actor.items.find(item => item.type == 'weapon' && item.system.equipped && item.system.traits?.includes('fire')));
    const wildfire = 'ccitems/_source/Wildfire_ifF6KRO65Yguf7K1.json';
    const torch = equipped => ({ type: 'weapon', name: 'Torch', system: { equipped, traits: ['fire'] } });
    const lit = await moveActor([wildfire, torch(true)]);
    expect(lit.ground.total).toBe(45);
    // Half of the boosted ground (45 -> 20) + Wildfire's own +10; no Aerial to add to.
    expect(lit.swim.total).toBe(30);
    expect(lit.aerial.total).toBe(0);
    expect((await moveActor([wildfire, torch(false)])).ground.total).toBe(35);
    expect((await moveActor([torch(true)])).ground.total).toBe(35);
  });

  function moveSystem({ movement = {}, ...rest } = {}) {
    return {
      isMorphed: false,
      isTransformed: false,
      level: 1,
      movement: {
        aerial: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ground: { base: 30, bonus: 5, morphed: 10, altMode: 60 },
        burrow: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        climb: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        swim: { base: 0, bonus: 0, morphed: 0, altMode: 0 },
        ...movement,
      },
      ...rest,
    };
  }

  /** A real Essence20Actor holding these pack items (or [file, system overrides] / plain extra items), prepared. */
  async function moveActor(entries, { type = 'playerCharacter', system = {}, flags = {}, before } = {}) {
    const { Essence20Actor } = await import('../documents/actor.mjs');
    const actor = new Essence20Actor();
    actor.id = `a${nextId++}`;
    actor.type = type;
    actor.system = moveSystem(system);
    actor.flags = { essence20: { ...flags } };
    actor.statuses = new Set();
    actor.getFlag = (scope, key) => actor.flags?.[scope]?.[key];
    const items = entries.map(entry => {
      if (entry && typeof entry == 'object' && !Array.isArray(entry)) {
        return { id: `c${nextId++}`, flags: {}, system: {}, ...entry };
      }

      const [file, override = {}] = Array.isArray(entry) ? entry : [entry];
      const doc = fromPack(file);
      return { id: `c${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: { ...doc.system, ...override } };
    });
    actor.items = { contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn) };
    for (const item of items) {
      item.parent = actor;
    }

    before?.(actor);
    actor._prepareMovement();
    return actor.system.movement;
  }

  beforeAll(async () => {
    // _applyGravityMovement reads `canvas?.scene` - declared, but empty, off the canvas.
    if (!('canvas' in global)) {
      global.canvas = undefined;
    }

    const { registerCheck } = await import('./predicate.mjs');
    const { isBulwarkActive } = await import('../helpers/bulwark.mjs');
    const { isRushTheLineActive } = await import('../helpers/rush-the-line.mjs');
    const { isSprinterBoostActive } = await import('../helpers/sprinter-boost.mjs');
    const { isSkiing } = await import('../helpers/skier.mjs');
    const { hasNearbyDefeatedAlly } = await import('../helpers/field-aid.mjs');
    const { isFrictionlessMovementActive } = await import('../helpers/frictionless-movement.mjs');
    const { isGravityOptionalActive } = await import('../helpers/gravity-optional.mjs');
    const { hasActiveEnvironmentalExpertise } = await import('../helpers/environmental-expertise.mjs');
    registerCheck('bulwark', isBulwarkActive);
    registerCheck('rushTheLine', isRushTheLineActive);
    registerCheck('sprinterBoost', isSprinterBoostActive);
    registerCheck('skiing', isSkiing);
    registerCheck('nearbyDefeatedAlly', hasNearbyDefeatedAlly);
    registerCheck('frictionlessMovement', isFrictionlessMovementActive);
    registerCheck('gravityOptional', isGravityOptionalActive);
    registerCheck('environmentalExpertise', hasActiveEnvironmentalExpertise);
  });

  afterEach(() => {
    game.combat = null;
  });

  test('every move-batch rule validates', async () => {
    const { validateRule } = await import('./types.mjs');
    for (const file of Object.values(MOVE)) {
      for (const rule of fromPack(file).system.rules.filter(r => r.type == 'Movement')) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Fast: its +10 never creates an Aerial/Aquatic/Climb Movement the actor lacks (total stage)', async () => {
    const ground = await moveActor([MOVE.fast], { system: { movement: { ground: { base: 30, bonus: 15, morphed: 10, altMode: 60 } } } });
    expect(ground.ground.total).toBe(45);
    expect((await moveActor([MOVE.fast], { system: { movement: { aerial: { base: 0, bonus: 10, morphed: 0, altMode: 0 } } } })).aerial.total).toBe(0);
    const swim = await moveActor([MOVE.fast], { system: { movement: { swim: { base: 0, bonus: 10, morphed: 0, altMode: 0 } } } });
    expect(swim.swim.total).toBe(Math.floor(swim.ground.total / 5 * .5) * 5);
    expect((await moveActor([MOVE.fast], { system: { movement: { aerial: { base: 20, bonus: 10, morphed: 0, altMode: 0 } } } })).aerial.total).toBe(30);
    expect((await moveActor([], { system: { movement: { aerial: { base: 0, bonus: 10, morphed: 0, altMode: 0 } } } })).aerial.total).toBe(10);
    // In Alt Mode the innate value is altMode, not base.
    expect((await moveActor([MOVE.fast], { system: { isTransformed: true, movement: { aerial: { base: 20, bonus: 10, morphed: 0, altMode: 0 } } } })).aerial.total).toBe(0);
  });

  test('Air Born / Static Electricity: base Movement set by the pick (base stage)', async () => {
    let movement = await moveActor([[MOVE.airBorn, { choice: 'aerialHeavy' }]]);
    expect([movement.ground.total, movement.aerial.total]).toEqual([50, 15]);
    movement = await moveActor([[MOVE.airBorn, { choice: 'balanced' }]]);
    expect([movement.ground.total, movement.aerial.total]).toEqual([35, 30]);
    movement = await moveActor([[MOVE.airBorn, { choice: 'groundHeavy' }]]);
    expect([movement.ground.total, movement.aerial.total]).toEqual([20, 45]);
    expect((await moveActor([MOVE.airBorn])).ground.total).toBe(35);
    expect((await moveActor([MOVE.staticElectricity])).ground.total).toBe(40);
    expect((await moveActor([])).ground.total).toBe(35);
  });

  test('Gravity Optional: aerial base 5 ft + 5 per 5 levels while floating', async () => {
    expect((await moveActor([MOVE.gravityOptional], { system: { level: 12 }, flags: { gravityOptionalActive: true } })).aerial.total).toBe(15);
    expect((await moveActor([MOVE.gravityOptional], { system: { level: 1 }, flags: { gravityOptionalActive: true } })).aerial.total).toBe(5);
    expect((await moveActor([MOVE.gravityOptional], { system: { level: 12 }, flags: { gravityOptionalActive: false } })).aerial.total).toBe(0);
    expect((await moveActor([], { system: { level: 12 }, flags: { gravityOptionalActive: true } })).aerial.total).toBe(0);
  });

  test('Prowl: ground doubled with Environmental Expertise active (adjust stage)', async () => {
    const expertise = { type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ' } } };
    expect((await moveActor([MOVE.prowl, expertise], { flags: { environmentalExpertiseActive: true } })).ground.total).toBe(70);
    expect((await moveActor([expertise], { flags: { environmentalExpertiseActive: true } })).ground.total).toBe(35);
    expect((await moveActor([MOVE.prowl, expertise], { flags: { environmentalExpertiseActive: false } })).ground.total).toBe(35);
    expect((await moveActor([MOVE.prowl], { flags: { environmentalExpertiseActive: true } })).ground.total).toBe(35);
  });

  test('Wire Work / Amphibious Assault / I Can Dig It: Climb, Aquatic and Underground set (adjust stage)', async () => {
    let movement = await moveActor([MOVE.wireWork]);
    expect(movement.climb.total).toBe(movement.ground.total);
    expect((await moveActor([])).climb.total).toBe(15);
    movement = await moveActor([MOVE.amphibiousAssault]);
    expect(movement.swim.total).toBe(movement.ground.total);
    expect((await moveActor([MOVE.amphibiousAssault], { system: { movement: { swim: { base: 50, bonus: 0, morphed: 0, altMode: 0 } } } })).swim.total).toBe(65);
    expect((await moveActor([MOVE.iCanDigIt], { system: { isTransformed: true } })).burrow.total).toBe(25);
    expect((await moveActor([MOVE.iCanDigIt], { system: { isTransformed: true, movement: { burrow: { base: 20, bonus: 0, morphed: 0, altMode: 0 } } } })).burrow.total).toBe(35);
    expect((await moveActor([MOVE.iCanDigIt])).burrow.total).toBe(0);
    expect((await moveActor([], { system: { isTransformed: true } })).burrow.total).toBe(0);
  });

  test('Warrior Rush: every Movement doubled in combat round 1 only', async () => {
    game.combat = { round: 1, started: true };
    expect((await moveActor([MOVE.warriorRush])).ground.total).toBe(70);
    expect((await moveActor([])).ground.total).toBe(35);
    game.combat = { round: 2, started: true };
    expect((await moveActor([MOVE.warriorRush])).ground.total).toBe(35);
    game.combat = null;
    expect((await moveActor([MOVE.warriorRush])).ground.total).toBe(35);
  });

  test('Rush the Line / Frictionless Movement / Expanded Mysticism: doublings while active', async () => {
    let movement = await moveActor([MOVE.rushTheLine], { flags: { rushTheLineActive: true } });
    expect([movement.ground.total, movement.aerial.total]).toEqual([70, 0]);
    expect((await moveActor([MOVE.rushTheLine], { flags: { rushTheLineActive: false } })).ground.total).toBe(35);
    expect((await moveActor([], { flags: { rushTheLineActive: true } })).ground.total).toBe(35);

    const aerial = { aerial: { base: 20, bonus: 0, morphed: 0, altMode: 0 } };
    movement = await moveActor([MOVE.frictionless], { system: { movement: aerial }, flags: { frictionlessMovementActive: true } });
    expect([movement.ground.total, movement.aerial.total]).toEqual([70, 40]);
    movement = await moveActor([MOVE.frictionless], { system: { movement: aerial }, flags: { frictionlessMovementActive: false } });
    expect([movement.ground.total, movement.aerial.total]).toEqual([35, 20]);

    movement = await moveActor([MOVE.expandedMysticism], { system: { movement: aerial }, flags: { expandedMysticismQuickenType: 'ground' } });
    expect([movement.ground.total, movement.aerial.total]).toEqual([70, 20]);
    movement = await moveActor([MOVE.expandedMysticism], { system: { movement: aerial }, flags: { expandedMysticismQuickenType: 'aerial' } });
    expect([movement.ground.total, movement.aerial.total]).toEqual([35, 40]);
    expect((await moveActor([], { flags: { expandedMysticismQuickenType: 'ground' } })).ground.total).toBe(35);
  });

  test('Thunderous Advance: the driven vehicle +15 ft in combat, +20% out of it', async () => {
    const { LINK_HOLDERS } = await import('./index.mjs');
    const driver = holder([MOVE.thunderousAdvance]);
    driver.uuid = 'Actor.moveDriver';
    const crew = { actors: { a: { uuid: driver.uuid, vehicleRole: 'driver' } } };
    const previous = global.fromUuidSync;
    global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
    try {
      expect(LINK_HOLDERS.has(driver.id)).toBe(true);
      game.combat = { round: 1, started: true };
      expect((await moveActor([], { type: 'vehicle', system: crew })).ground.total).toBe(50);
      game.combat = { round: 0, started: false };
      expect((await moveActor([], { type: 'vehicle', system: crew })).ground.total).toBe(50);
      game.combat = null;
      expect((await moveActor([], { type: 'vehicle', system: crew })).ground.total).toBe(42);
      // Not for a passenger, and never for the driver's own Movement.
      expect((await moveActor([], { type: 'vehicle', system: { actors: { a: { uuid: driver.uuid, vehicleRole: 'passenger' } } } })).ground.total).toBe(35);
      expect((await moveActor([MOVE.thunderousAdvance])).ground.total).toBe(35);
    } finally {
      global.fromUuidSync = previous;
      LINK_HOLDERS.delete(driver.id);
    }
  });

  test('Bulwark: every Movement 0 while planted', async () => {
    const movement = await moveActor([MOVE.bulwark], { flags: { bulwarkActive: true } });
    expect([movement.ground.total, movement.climb.total, movement.swim.total]).toEqual([0, 0, 0]);
    expect((await moveActor([MOVE.bulwark], { flags: { bulwarkActive: false } })).ground.total).toBe(35);
    expect((await moveActor([], { flags: { bulwarkActive: true } })).ground.total).toBe(35);
  });

  test('Over the Candlestick: Innate Climber sets Alt Mode Climb to 40 (final stage)', async () => {
    expect((await moveActor([[MOVE.overTheCandlestick, { choice: 'innateClimber' }]], { system: { isTransformed: true } })).climb.total).toBe(40);
    expect((await moveActor([[MOVE.overTheCandlestick, { choice: 'innateClimber' }]])).climb.total).toBe(15);
    expect((await moveActor([[MOVE.overTheCandlestick, { choice: 'agileReflexes' }]], { system: { isTransformed: true } })).climb.total).toBe(30);
    expect((await moveActor([], { system: { isTransformed: true } })).climb.total).toBe(30);
  });

  test('Sprinter (TS): Alt Mode +20 ground, and the sprint doubles all of it (final stage)', async () => {
    expect((await moveActor([MOVE.sprinter], { system: { isTransformed: true } })).ground.total).toBe(85);
    expect((await moveActor([MOVE.sprinter])).ground.total).toBe(35);
    expect((await moveActor([], { system: { isTransformed: true } })).ground.total).toBe(65);
    expect((await moveActor([MOVE.sprinter], { flags: { sprinterBoostActive: true } })).ground.total).toBe(70);
    expect((await moveActor([], { flags: { sprinterBoostActive: true } })).ground.total).toBe(35);
    // The old (65 + 20) * 2.
    expect((await moveActor([MOVE.sprinter], { system: { isTransformed: true }, flags: { sprinterBoostActive: true } })).ground.total).toBe(170);
    // Frictionless Movement (adjust) still doubles before the +20, as the old order did: 65 * 2 + 20.
    expect((await moveActor([MOVE.sprinter, MOVE.frictionless], { system: { isTransformed: true }, flags: { frictionlessMovementActive: true } })).ground.total).toBe(150);
  });

  test('Sprinter (TF One) / Skier / Field Aid / Eltarian Training: flat ground additions', async () => {
    expect((await moveActor([MOVE.tf1sSprinter])).ground.total).toBe(40);
    expect((await moveActor([MOVE.tf1sSprinter], { system: { isTransformed: true } })).ground.total).toBe(65);
    expect((await moveActor([MOVE.skier], { flags: { isSkiingActive: true } })).ground.total).toBe(45);
    expect((await moveActor([MOVE.skier], { flags: { isSkiingActive: false } })).ground.total).toBe(35);
    expect((await moveActor([MOVE.eltarianTraining])).ground.total).toBe(45);
    expect((await moveActor([MOVE.eltarianTraining], { system: { movement: { aerial: { base: 40, bonus: 0, morphed: 0, altMode: 0 } } } })).aerial.total).toBe(40);

    const actorToken = { document: { disposition: 1 }, center: {} };
    const defeated = { actor: { statuses: new Set(['defeated']) }, document: { disposition: 1 }, center: {} };
    const previousCanvas = global.canvas;
    const withToken = actor => {
      actor.getActiveTokens = () => [actorToken];
    };

    try {
      global.canvas = { tokens: { placeables: [actorToken, defeated] }, grid: { measurePath: () => ({ distance: 0 }) } };
      expect((await moveActor([MOVE.fieldAid], { before: withToken })).ground.total).toBe(45);
      expect((await moveActor([], { before: withToken })).ground.total).toBe(35);
      global.canvas = { tokens: { placeables: [actorToken] }, grid: { measurePath: () => ({ distance: 0 }) } };
      expect((await moveActor([MOVE.fieldAid], { before: withToken })).ground.total).toBe(35);
    } finally {
      global.canvas = previousCanvas;
    }
  });

  test('Quantum Master: every Movement doubled while Morphed, after Eltarian Training (final stage)', async () => {
    expect((await moveActor([MOVE.quantumMaster], { system: { isMorphed: true } })).ground.total).toBe(90);
    expect((await moveActor([MOVE.quantumMaster])).ground.total).toBe(35);
    expect((await moveActor([], { system: { isMorphed: true } })).ground.total).toBe(45);
    // The old order: (45 + 10) * 2.
    expect((await moveActor([MOVE.quantumMaster, MOVE.eltarianTraining], { system: { isMorphed: true } })).ground.total).toBe(110);
  });

  test('Scuba Gear: Aquatic Movement at least Ground base + bonus while equipped', async () => {
    expect((await moveActor([MOVE.scubaGear])).swim.total).toBe(35);
    expect((await moveActor([[MOVE.scubaGear, { equipped: false }]])).swim.total).toBe(15);
    expect((await moveActor([])).swim.total).toBe(15);
    expect((await moveActor([MOVE.scubaGear], { system: { movement: { swim: { base: 50, bonus: 0, morphed: 0, altMode: 0 } } } })).swim.total).toBe(50);
  });
});

// Batch misc6 (helpers/combat.mjs, documents/item.mjs): Adapted Wavelength's damage reduction, Dogfighter's
// vehicle Evasion, and the item-number Perks (Adaptable, Beastly x2, Wrestler, One With Your Weapon,
// Efficient / Master Spellcaster) moved onto DamageModifier / Defense / ItemModifier rules.
test('Adapted Wavelength: the chosen Element damage taken is 1 less, never below 0; one copy per Element', () => {
  const file = 'jttitems/_source/Adapted_Wavelength_nmMTFyzNTa9MDbP2.json';
  const actor = holder([file, file]);
  actor.items.contents[0].system.choice = 'fire';
  actor.items.contents[1].system.choice = 'cold';
  expect(ruleDamageTaken(actor, 3, 'fire')).toBe(2);
  expect(ruleDamageTaken(actor, 1, 'fire')).toBe(0);
  expect(ruleDamageTaken(actor, 3, 'cold')).toBe(2);
  expect(ruleDamageTaken(actor, 3, 'laser')).toBe(3);
  expect(ruleDamageTaken(actor, 3, 'sharp')).toBe(3);
  const unchosen = holder([file]);
  expect(ruleDamageTaken(unchosen, 3, 'fire')).toBe(3);
  expect(ruleDamageTaken(holder([]), 3, 'fire')).toBe(3);
});

test("Dogfighter: the driver's small aerial vehicle gets +2 Evasion", () => {
  const driver = holder(['atsitems/_source/Dogfighter_twl2N01FD8XKO0s1.json']);
  driver.uuid = 'Actor.dogfightPilot';
  const vehicleOf = ({ size = 'extended2', aerial = 30, type = 'vehicle', role = 'driver' } = {}) => {
    const vehicle = holder([], { system: { size, movement: { aerial: { base: aerial } }, defenses: pass2Defenses() } });
    Object.assign(vehicle, { type, uuid: `Actor.dogfight${nextId++}` });
    vehicle.system.actors = { a: { uuid: driver.uuid, vehicleRole: role } };
    return vehicle;
  };

  const previous = global.fromUuidSync;
  global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
  const evasion = options => {
    const vehicle = vehicleOf(options);
    game.actors = { contents: [driver, vehicle] };
    ruleDerived(vehicle);
    return vehicle.system.defenses;
  };

  expect(evasion()).toMatchObject({ evasion: { total: 13 }, toughness: { total: 12 } });
  expect(evasion({ size: 'extended3' }).evasion.total).toBe(11);
  expect(evasion({ aerial: 0 }).evasion.total).toBe(11);
  expect(evasion({ type: 'zord' }).evasion.total).toBe(11);
  expect(evasion({ role: 'passenger' }).evasion.total).toBe(11);
  global.fromUuidSync = previous;
  game.actors = undefined;
});

test('Adaptable: Adaptation Points max is doubled, no other Role Points', () => {
  const actor = holder(['gijcrbitems/_source/Adaptable_98q6O79HKMPEh4aZ.json']);
  const points = (id, sourceId) => ({ id, type: 'rolePoints', name: id, flags: { core: { sourceId } }, system: { resource: { max: 3 } } });
  const adaptation = points('rp1', 'Compendium.essence20.gi_joe_crb.Item.tqiseYDXnEngUlvd');
  const other = points('rp2', 'Compendium.essence20.gi_joe_crb.Item.otherRolePoints');
  for (const item of [adaptation, other]) {
    item.parent = actor;
    actor.items.contents.push(item);
  }

  ruleDerived(actor);
  expect(adaptation.system.resource.max).toBe(6);
  expect(other.system.resource.max).toBe(3);
});

test('Beastly: the Unarmed Blunt alternate loses its ↓1 (both printings); the Hang-Up adds ↓1 to the Unarmed Stun effect', () => {
  const effect = (id, sourceId, shiftDown) => ({ id, type: 'weaponEffect', name: id, flags: { core: { sourceId } }, system: { damageType: 'blunt', shiftDown } });
  const add = (actor, items) => {
    for (const item of items) {
      item.parent = actor;
      actor.items.contents.push(item);
    }
  };

  const perk = holder(['fffav1items/_source/Beastly_3Y0ETFpJUwdUqgUQ.json']);
  const gij = effect('b1', 'Compendium.essence20.gi_joe_crb.Item.gA0rOFD3lmwzkZq4', 1);
  const tf = effect('b2', 'Compendium.essence20.tf_crb.Item.gA0rOFD3lmwzkZq4', 1);
  const unrelated = effect('b3', 'Compendium.essence20.gi_joe_crb.Item.somethingElse00', 1);
  const stun = effect('b4', 'Compendium.essence20.gi_joe_crb.Item.eDjovjfygGq8dlQy', 0);
  add(perk, [gij, tf, unrelated, stun]);
  ruleDerived(perk);
  expect([gij.system.shiftDown, tf.system.shiftDown, unrelated.system.shiftDown, stun.system.shiftDown]).toEqual([0, 0, 1, 0]);

  const hangUp = holder(['fffav1items/_source/Beastly_9o0Qbe6lgqNPnm2R.json']);
  const hangUpStun = effect('h1', 'Compendium.essence20.gi_joe_crb.Item.eDjovjfygGq8dlQy', 0);
  const hangUpAlt = effect('h2', 'Compendium.essence20.gi_joe_crb.Item.gA0rOFD3lmwzkZq4', 1);
  add(hangUp, [hangUpStun, hangUpAlt]);
  ruleDerived(hangUp);
  expect(hangUpStun.system.shiftDown).toBe(1);
  expect(hangUpAlt.system.shiftDown).toBe(1);
});

test('Wrestler (Slammer): a melee Maneuver loses its ↓; a ranged Maneuver or another melee effect keeps it', () => {
  const actor = holder(['sssitems/_source/Wrestler_ro5hMv4XMhOmANao.json']);
  const effect = (id, damageType, style) => ({ id, type: 'weaponEffect', name: id, flags: {}, system: { damageType, shiftDown: 1, classification: { style } } });
  const melee = effect('w1', 'maneuver', 'melee');
  const ranged = effect('w2', 'maneuver', 'ranged');
  const strike = effect('w3', 'blunt', 'melee');
  for (const item of [melee, ranged, strike]) {
    item.parent = actor;
    actor.items.contents.push(item);
  }

  ruleDerived(actor);
  expect([melee.system.shiftDown, ranged.system.shiftDown, strike.system.shiftDown]).toEqual([0, 1, 1]);
});

test('One With Your Weapon: any effect of a Silent Martial Arts weapon loses its ↓', () => {
  const actor = holder(['iafav2items/_source/One_With_Your_Weapon_RH3AFV38EBAfTvW1.json']);
  const weapon = (id, traits) => ({ id, type: 'weapon', name: id, flags: {}, system: { traits } });
  const effect = (id, parentId) => ({ id, type: 'weaponEffect', name: id, flags: { essence20: parentId ? { parentId } : {} }, system: { damageType: 'blunt', shiftDown: 1 } });
  const silent = effect('o1', 'oSma');
  const halfway = effect('o2', 'oMa');
  const loose = effect('o3', null);
  for (const item of [weapon('oSma', ['martialArts', 'silent']), weapon('oMa', ['martialArts']), silent, halfway, loose]) {
    item.parent = actor;
    actor.items.contents.push(item);
  }

  ruleDerived(actor);
  expect([silent.system.shiftDown, halfway.system.shiftDown, loose.system.shiftDown]).toEqual([0, 1, 1]);
});

test("Efficient / Master Spellcaster: an Elementary / Superior spell's cost is 1 less, never below 1", () => {
  const spell = (id, tier, cost) => ({ id, type: 'spell', name: id, flags: {}, system: { tier, cost } });
  const cast = (file, spells) => {
    const actor = holder([file]);
    for (const item of spells) {
      item.parent = actor;
      actor.items.contents.push(item);
    }

    ruleDerived(actor);
    return spells.map(item => item.system.cost);
  };

  const efficient = 'kocitems/_source/Efficient_Spellcaster_eQDQwKQfRQU8obWF.json';
  expect(cast(efficient, [spell('s1', 'elementary', 2), spell('s2', 'elementary', 1), spell('s3', 'elementary', 0), spell('s4', 'superior', 2)]))
    .toEqual([1, 1, 1, 2]);
  const master = 'kocitems/_source/Master_Spellcaster_tEOoAvzj42d20QHu.json';
  expect(cast(master, [spell('m1', 'superior', 3), spell('m2', 'superior', 1), spell('m3', 'elementary', 2)])).toEqual([2, 1, 2]);
});

/* dmgC batch (rounds 14-15): the rest of dice.mjs's damageBonusValue sum as item rules - scaled DamageModifiers
   (White Ranger Prime through the driven scope, Throw Your Weight Around / Roaming the Land by size, Mass
   Reactive Rounds on its upgrade, Station Management / Razor Tongue x2 / The Weather by Defense, Raw Ferocity on
   a Snag) and numeric-spend DialogSwitches (Terror, Supreme Guardian, Solus Charge). */

const dmgCAttack = ({ style = 'melee', skill = 'might', damageType = 'blunt', parentId = null, parent = null } = {}) => ({
  type: 'weaponEffect', name: 'Attack', flags: parentId ? { essence20: { parentId } } : {},
  system: { classification: { style, skill }, damageType }, parent,
});
const dmgC = (actor, item, target = null, extra = {}) => ruleScaledDamage(actor, target, { item, rolledSkill: item?.system?.classification?.skill, ...extra });
const dmgCSized = size => ({ type: 'npc', statuses: new Set(), system: { size }, flags: {} });

test('Throw Your Weight Around: +1 on a melee attack against a smaller target', () => {
  const actor = holder(['iafav2items/_source/Throw_Your_Weight_Around_sXiptCDHSjN0V9W8.json'], { system: { size: 'large' } });
  expect(dmgC(actor, dmgCAttack(), dmgCSized('common'))).toMatchObject({ amount: 1, sources: ['Throw Your Weight Around'] });
  expect(dmgC(actor, dmgCAttack(), dmgCSized('large')).amount).toBe(0);
  expect(dmgC(actor, dmgCAttack({ style: 'ranged', skill: 'targeting' }), dmgCSized('common')).amount).toBe(0);
  expect(dmgC(actor, dmgCAttack()).amount).toBe(0);
  expect(dmgC(holder([], { system: { size: 'large' } }), dmgCAttack(), dmgCSized('common')).amount).toBe(0);
});

test('Roaming the Land: +1 on a melee attack against a smaller target, with the smaller-creatures option', () => {
  const actor = holder(['fffav1items/_source/Roaming_the_Land_jdQFjlYUHaRze6as.json'], { system: { size: 'large' } });
  const perk = actor.items.contents[0];
  perk.system.choice = 'smallerDamage';
  expect(dmgC(actor, dmgCAttack(), dmgCSized('common'))).toMatchObject({ amount: 1, sources: ['Roaming the Land'] });
  expect(dmgC(actor, dmgCAttack(), dmgCSized('large')).amount).toBe(0);
  perk.system.choice = 'largerStun';
  expect(dmgC(actor, dmgCAttack(), dmgCSized('common')).amount).toBe(0);
  perk.system.choice = null;
  expect(dmgC(actor, dmgCAttack(), dmgCSized('common')).amount).toBe(0);
});

test("White Ranger Prime: +1 on the Zord's own attacks while its driver holds the Perk and is Morphed", () => {
  const pilot = holder(['prcrbitems/_source/White_Ranger_Prime_RDdg5LWyjHOyqsCp.json'], { system: { isMorphed: true } });
  pilot.uuid = 'Actor.dmgCWhitePilot';
  const zord = holder([]);
  Object.assign(zord, { type: 'zord', uuid: 'Actor.dmgCWhiteZord' });
  zord.system.actors = { a: { uuid: pilot.uuid, vehicleRole: 'driver' } };
  const previous = global.fromUuidSync;
  global.fromUuidSync = uuid => (uuid == pilot.uuid ? pilot : null);
  game.actors = { contents: [pilot, zord] };
  try {
    expect(dmgC(zord, dmgCAttack())).toMatchObject({ amount: 1, sources: ['White Ranger Prime'] });
    pilot.system.isMorphed = false;
    expect(dmgC(zord, dmgCAttack()).amount).toBe(0);
    pilot.system.isMorphed = true;
    zord.system.actors.a.vehicleRole = 'passenger';
    expect(dmgC(zord, dmgCAttack()).amount).toBe(0);
    zord.system.actors.a.vehicleRole = 'driver';
    // The Prime holder's own attacks don't get it.
    expect(dmgC(pilot, dmgCAttack()).amount).toBe(0);
  } finally {
    global.fromUuidSync = previous;
    game.actors = undefined;
  }
});

test('Mass Reactive Rounds: +1 on a Sharp attack against Toughness with the weapon it is attached to', () => {
  const actor = holder(['eocitems/_source/Mass_Reactive_Rounds_oX9pJQXZjnwvX7GX.json']);
  const upgrade = actor.items.contents[0];
  actor.items.contents.push({ id: 'w1', type: 'weapon', name: 'Rifle', flags: {}, system: { traits: [] }, parent: actor });
  upgrade.flags = { essence20: { parentId: 'w1' } };
  rebuildIndex(actor);
  const shot = (damageType = 'sharp', parentId = 'w1') => dmgCAttack({ style: 'ranged', skill: 'targeting', damageType, parentId, parent: actor });
  expect(dmgC(actor, shot(), null, { defenseType: 'toughness' })).toMatchObject({ amount: 1, sources: ['Mass Reactive Rounds'] });
  expect(dmgC(actor, shot(), null, { defenseType: 'evasion' }).amount).toBe(0);
  expect(dmgC(actor, shot('blunt'), null, { defenseType: 'toughness' }).amount).toBe(0);
  expect(dmgC(actor, shot('sharp', 'w2'), null, { defenseType: 'toughness' }).amount).toBe(0);
});

test('Station Management, Razor Tongue (TF, GI Joe): +1 against Cleverness; The Weather: +1 against Willpower', () => {
  for (const file of [
    'wtnvcgitems/_source/Station_Management_b3LfFejkc8dJspCc.json',
    'tfcrbitems/_source/Razor_Tongue_jwREkh7fN4FLjDmz.json',
    'gijcrbitems/_source/Razor_Tongue_HdIE0t088L6PTfXn.json',
  ]) {
    const actor = holder([file]);
    const name = actor.items.contents[0].name;
    expect(dmgC(actor, dmgCAttack({ skill: 'finesse' }), null, { defenseType: 'cleverness' })).toMatchObject({ amount: 1, sources: [name] });
    expect(dmgC(actor, dmgCAttack({ skill: 'finesse' }), null, { defenseType: 'toughness' }).amount).toBe(0);
  }

  const weather = holder(['wtnvcgitems/_source/The_Weather_RdxkmVbHZXN5zGa9.json']);
  expect(dmgC(weather, dmgCAttack(), null, { defenseType: 'willpower' })).toMatchObject({ amount: 1, sources: ['The Weather'] });
  expect(dmgC(weather, dmgCAttack(), null, { defenseType: 'cleverness' }).amount).toBe(0);
  expect(dmgC(weather, { type: 'spell', system: {} }, null, { defenseType: 'willpower' }).amount).toBe(0);
});

test('Ninja Powered (Raw Ferocity): +2 on a Zord melee attack rolled with a Snag', () => {
  const zord = holder(['prcrbitems/_source/Ninja_Powered__Raw_Ferocity__ljHdKAY31JGiknxb.json']);
  zord.type = 'zord';
  expect(dmgC(zord, dmgCAttack(), null, { snag: true })).toMatchObject({ amount: 2, sources: ['Ninja Powered (Raw Ferocity)'] });
  expect(dmgC(zord, dmgCAttack(), null, { snag: false }).amount).toBe(0);
  expect(dmgC(zord, dmgCAttack({ style: 'energy' }), null, { snag: true }).amount).toBe(0);
  zord.type = 'playerCharacter';
  expect(dmgC(zord, dmgCAttack(), null, { snag: true }).amount).toBe(0);
});

/** The actor's base Role Points (Terror, Eltarian Tech), as actor._getBaseRolePoints() hands them over. */
function dmgCPoints(actor, value, max = 3) {
  const points = {
    type: 'rolePoints', name: 'Points', flags: {}, system: { resource: { value, max } },
    async update(data) {
      this.system.resource.value = data['system.resource.value'];
    },
  };
  actor._getBaseRolePoints = () => points;
  return points;
}

/** Type an amount into the rule's number box and make the roll. */
async function dmgCSpend(actor, ctx, amount) {
  const [box] = ruleDialogSwitches(actor, ctx);
  const options = { shiftUp: 0, shiftDown: 0, ext: box ? { [box.name]: amount } : {} };
  await applyRuleSwitches(actor, options, ctx);
  return options;
}

test('Terror: spend any amount of accrued Terror for that much damage on an attack', async () => {
  const actor = holder(['bthitems/_source/Terror_yBBB0Mi6fr84YcSd.json']);
  const points = dmgCPoints(actor, 2);
  const attack = { item: dmgCAttack() };
  expect(ruleDialogSwitches(actor, attack)).toEqual([expect.objectContaining({ type: 'number', value: 0, max: 2 })]);
  expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);

  expect(await dmgCSpend(actor, attack, 0)).not.toHaveProperty('ruleDamage');
  expect(points.system.resource.value).toBe(2);

  // More than is there spends only what is there.
  expect(await dmgCSpend(actor, attack, 99)).toMatchObject({ ruleDamage: 2, ruleDamageSources: ['Spend Terror for +1 damage each (Terror)'] });
  expect(points.system.resource.value).toBe(0);
  expect(ruleDialogSwitches(actor, attack)).toEqual([]);
});

test('Supreme Guardian: spend Eltarian Tech for that much damage on a melee Power Weapon attack', async () => {
  const actor = holder(['ttsgitems/_source/Supreme_Guardian_wrBndkBQoKkn3dLy.json']);
  const points = dmgCPoints(actor, 3);
  const weapon = traits => ({ id: 'pw', type: 'weapon', name: 'Power Sword', flags: {}, system: { traits } });
  const swing = (traits = ['powerWeapon'], style = 'melee') => ({
    item: dmgCAttack({ style, damageType: 'element', parentId: 'pw', parent: { items: { get: () => weapon(traits) } } }),
  });
  expect(ruleDialogSwitches(actor, swing())).toEqual([expect.objectContaining({ type: 'number', max: 3 })]);
  expect(ruleDialogSwitches(actor, swing([]))).toEqual([]);
  expect(ruleDialogSwitches(actor, swing(['powerWeapon'], 'ranged'))).toEqual([]);
  expect(await dmgCSpend(actor, swing(), 2)).toMatchObject({ ruleDamage: 2 });
  expect(points.system.resource.value).toBe(1);
});

test('Solus Charge: spend up to 2 Energon for that much damage with the weapon it is attached to', async () => {
  const actor = holder(['eocitems/_source/Solus_Charge_EYs9qvg6oQkIbPTH.json'], { system: { energon: { normal: { value: 1 } } } });
  const upgrade = actor.items.contents[0];
  actor.items.contents.push({ id: 'w1', type: 'weapon', name: 'Blaster', flags: {}, system: { traits: [] }, parent: actor });
  upgrade.flags = { essence20: { parentId: 'w1' } };
  rebuildIndex(actor);
  actor.update = async data => {
    actor.system.energon.normal.value = data['system.energon.normal.value'];
  };

  const shot = (parentId = 'w1') => ({ item: dmgCAttack({ style: 'ranged', skill: 'targeting', damageType: 'laser', parentId, parent: actor }) });

  expect(ruleDialogSwitches(actor, shot())).toEqual([expect.objectContaining({ type: 'number', max: 1 })]);
  actor.system.energon.normal.value = 5;
  expect(ruleDialogSwitches(actor, shot())).toEqual([expect.objectContaining({ type: 'number', max: 2 })]);
  expect(ruleDialogSwitches(actor, shot('w2'))).toEqual([]);
  expect(await dmgCSpend(actor, shot(), 2)).toMatchObject({ ruleDamage: 2, ruleDamageSources: ['Spend Energon for +1 Fire damage each (Solus Charge)'] });
  expect(actor.system.energon.normal.value).toBe(3);
});

/* misc7 batch: once-per-encounter "use Skill X instead" switches (Technically Correct, Whip Into Shape, Seeing the
   Matrix - a ticked DialogSwitch with a limit uses it up); Springy (Initiative reads RollModifier specialize); Recon
   and the Energy Affinity Perks on check: tags (environmentalExpertise / energyAffinityAttack); Hail Megatron!'s
   Intimidation half (target:canTransform + target:sizeDiff). */

const misc7Skills = shifts => ({ skills: Object.fromEntries(Object.entries(shifts).map(([key, shift]) => [key, { shift }])) });

/** An actor holding these pack items, with flags it can write (rule limits) and items.find (findPerk). */
function misc7Holder(files, options = {}, extraItems = []) {
  const actor = holder(files, options);
  actor.uuid = `Actor.${actor.id}`;
  actor.flags = { essence20: {} };
  actor.getFlag = (scope, key) => key.split('.').reduce((o, k) => o?.[k], actor.flags[scope]);
  actor.setFlag = async (scope, key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => (o[k] ??= {}), actor.flags[scope] ??= {})[last] = value;
  };

  actor.items.contents.push(...extraItems.map(item => ({ id: `c${nextId++}`, flags: {}, system: {}, parent: actor, ...item })));
  actor.items.find = fn => actor.items.contents.find(fn);
  return actor;
}

test.each([
  ['Technically Correct', 'qgtgitems/_source/Technically_Correct_HU9eLTJr0aFxiqnd.json', 'technology', 'athletics', 'strength'],
  ['Seeing the Matrix', 'gijcrbitems/_source/Seeing_the_Matrix_M8D4FRcfaGm5i2jH.json', 'technology', 'persuasion', 'social'],
  ['Whip Into Shape', 'sssitems/_source/Whip_Into_Shape_0Vca0OGRVIchK3KU.json', 'intimidation', 'athletics', 'strength'],
])('%s (%s): a switch rolls %s instead (the shift difference), starts unticked, and is used up for the encounter', async (name, file, to, rolled, essence) => {
  const actor = misc7Holder([file], { system: misc7Skills({ [rolled]: 'd6', [to]: 'd10' }) });
  const ctx = { rolledSkill: rolled, rolledEssence: essence, baseShift: 'd6' };
  const offered = ruleDialogSwitches(actor, ctx);
  expect(offered.map(s => s.entry.rule.useSkill)).toEqual([to]);
  expect(offered[0].value).toBe(false);
  // Not on a roll of that Skill itself.
  expect(ruleDialogSwitches(actor, { ...ctx, rolledSkill: to })).toEqual([]);
  const options = { shiftUp: 0, shiftDown: 0, ext: { [offered[0].name]: true } };
  await applyRuleSwitches(actor, options, ctx);
  expect(options).toMatchObject({ shiftUp: 2, shiftDown: 0 });
  // Once per encounter: gone once ticked.
  expect(ruleDialogSwitches(actor, ctx)).toEqual([]);
});

test('Whip Into Shape: only on Strength or Speed Skill Tests', () => {
  const actor = misc7Holder(['sssitems/_source/Whip_Into_Shape_0Vca0OGRVIchK3KU.json'], { system: misc7Skills({ athletics: 'd6', intimidation: 'd10' }) });
  expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics', rolledEssence: 'speed' })).toHaveLength(1);
  expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness', rolledEssence: 'smarts' })).toEqual([]);
});

test('Technically Correct / Seeing the Matrix: not offered on Initiative', () => {
  for (const file of ['qgtgitems/_source/Technically_Correct_HU9eLTJr0aFxiqnd.json', 'gijcrbitems/_source/Seeing_the_Matrix_M8D4FRcfaGm5i2jH.json']) {
    const actor = misc7Holder([file], { system: misc7Skills({ initiative: 'd6', technology: 'd10' }) });
    expect(ruleDialogSwitches(actor, { rolledSkill: 'initiative', dataset: { isInitiative: true } })).toEqual([]);
  }
});

test('Springy: every Initiative roll is Specialized', () => {
  const actor = holder(['mlpcrbitems/_source/Springy_Sb0zs5C7ZReiZfpO.json']);
  expect(ruleSpecializes(actor, 'initiative', null, { isInitiative: true })).toBe(true);
  expect(ruleSpecializes(actor, 'athletics', null, {})).toBe(false);
});

test('Recon: Edge on Alertness, Survival and Initiative in the environment of expertise', async () => {
  const { registerCheck } = await import('./predicate.mjs');
  const { hasActiveEnvironmentalExpertise } = await import('../helpers/environmental-expertise.mjs');
  registerCheck('environmentalExpertise', hasActiveEnvironmentalExpertise);
  if (!('canvas' in global)) {
    global.canvas = undefined;
  }

  const expertise = { type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ' } } };
  const actor = misc7Holder(['gijcrbitems/_source/Recon_EDBn8zHJXkRFu2TT.json'], {}, [expertise]);
  const edges = ctx => ruleRollSources(actor, null, ctx).sources.filter(source => source.edge).length;
  actor.flags.essence20.environmentalExpertiseActive = true;
  expect(edges({ rolledSkill: 'alertness' })).toBe(1);
  expect(edges({ rolledSkill: 'survival' })).toBe(1);
  expect(edges({ rolledSkill: 'initiative', dataset: { isInitiative: true } })).toBe(1);
  expect(edges({ rolledSkill: 'science' })).toBe(0);
  actor.flags.essence20.environmentalExpertiseActive = false;
  expect(edges({ rolledSkill: 'alertness' })).toBe(0);
  expect(edges({ rolledSkill: 'initiative', dataset: { isInitiative: true } })).toBe(0);
});

const MISC7_ENERGY_AFFINITY = 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA';
const misc7Attack = damageType => ({ type: 'weaponEffect', flags: {}, system: { classification: { skill: 'brawn', style: 'melee' }, damageType, damageValue: 1 } });

async function misc7Affinity(file, element = 'fire') {
  const { registerCheck } = await import('./predicate.mjs');
  const { isEnergyAffinityElementAttack } = await import('../helpers/energy-affinity.mjs');
  registerCheck('energyAffinityAttack', (actor, option, ctx) => isEnergyAffinityElementAttack(actor, ctx?.item));
  return misc7Holder([file], {}, [{ type: 'perk', name: 'Energy Affinity', flags: { core: { sourceId: MISC7_ENERGY_AFFINITY } }, system: { choice: element } }]);
}

test('Energy Connection (Deepen Connection): d2 crit on an Energy Affinity attack with Edge', async () => {
  const { ruleCritD2 } = await import('./adapter.mjs');
  const actor = await misc7Affinity('dditems/_source/Energy_Connection_HWhrHZU8oGrKhb4o.json');
  const connection = actor.items.contents[0];
  connection.system.choice = 'deepenConnection';
  expect(ruleCritD2(actor, null, { item: misc7Attack('fire'), edge: true })).toBe(true);
  expect(ruleCritD2(actor, null, { item: misc7Attack('fire'), edge: false })).toBe(false);
  expect(ruleCritD2(actor, null, { item: misc7Attack('cold'), edge: true })).toBe(false);
  connection.system.choice = 'additionalEnergyTypes';
  expect(ruleCritD2(actor, null, { item: misc7Attack('fire'), edge: true })).toBe(false);
});

test('Energy Mastery: Edge and +1 damage on an Energy Affinity attack', async () => {
  const actor = await misc7Affinity('dditems/_source/Energy_Mastery_bjR8V1BEc3CfrrDu.json');
  expect(ruleRollSources(actor, null, { item: misc7Attack('fire'), isAttack: true }).sources).toEqual([expect.objectContaining({ edge: true })]);
  expect(ruleRollSources(actor, null, { item: misc7Attack('cold'), isAttack: true }).sources).toEqual([]);
  expect(ruleScaledDamage(actor, null, { item: misc7Attack('fire') })).toMatchObject({ amount: 1, sources: ['Energy Mastery'] });
  expect(ruleScaledDamage(actor, null, { item: misc7Attack('cold') }).amount).toBe(0);
});

test("Hail Megatron!: ↑1 Intimidation in Bot Mode against a smaller Cybertronian", () => {
  const actor = holder(['dditems/_source/Hail_Megatron__3IHBbGOucL4eAFAA.json'], { system: { isTransformed: false, size: 'large' } });
  const target = (size, canTransform = true) => ({ type: 'npc', statuses: new Set(), flags: {}, system: { size, canTransform } });
  const up = (other, rolledSkill = 'intimidation') => ruleRollSources(actor, other, { rolledSkill }).sources.reduce((n, source) => n + source.shiftUp, 0);
  expect(up(target('common'))).toBe(1);
  expect(up(target('large'))).toBe(0);
  expect(up(target('common', false))).toBe(0);
  expect(up(null)).toBe(0);
  expect(up(target('common'), 'persuasion')).toBe(0);
  actor.system.isTransformed = true;
  expect(up(target('common'))).toBe(0);
});

// regA (dice.mjs rollSkill, before the Roll Options Dialog): Perk / Hang-Up / Power checks moved onto
// RollModifier and DialogSwitch rules on their own items.

const regASources = (actor, ctx, target = null) => ruleRollSources(actor, target, { dataset: {}, ...ctx }).sources;
const regAUp = (actor, ctx) => regASources(actor, ctx).reduce((n, source) => n + source.shiftUp, 0);
const regAEdge = (actor, ctx) => regASources(actor, ctx).some(source => source.edge);
const regAInitiative = skill => ({ rolledSkill: skill, dataset: { isInitiative: true } });

/** ruleDialogSwitches / applyRuleSwitches with every offered switch set to `value` (true, or a number). */
async function regATick(actor, ctx, options = {}, value = true) {
  const full = { dataset: {}, ...ctx };
  const ext = Object.fromEntries(ruleDialogSwitches(actor, full).map(s => [s.name, value]));
  const result = { shiftUp: 0, shiftDown: 0, ...options, ext };
  await applyRuleSwitches(actor, result, full);
  return result;
}

const regASwitches = (actor, ctx) => ruleDialogSwitches(actor, { dataset: {}, ...ctx });

/** A writable Role Points item for actor._getBaseRolePoints() (Idea Points, Eltarian Tech...). */
function regARolePoints(actor, value) {
  const points = { type: 'rolePoints', name: 'Points', flags: {}, system: { resource: { value } } };
  points.update = async data => {
    points.system.resource.value = data['system.resource.value'];
  };

  actor._getBaseRolePoints = () => points;
  return points;
}

/** Writable actor numbers (system.powers.personal.value) for a cost paid by path. */
function regAWritable(actor) {
  actor.update = async data => Object.entries(data).forEach(([key, value]) => {
    const parts = key.split('.');
    parts.slice(0, -1).reduce((o, part) => (o[part] ??= {}), actor)[parts.at(-1)] = value;
  });

  return actor;
}

test.each([
  ['Calm Beast', 'bthitems/_source/Calm_Beast_Ib4BIJKAmuMoWKJP.json', 'animalHandling', 'Calming', 1],
  ['Chivalrous', 'bthitems/_source/Chivalrous_E6bnHJFn2QHSru4p.json', 'persuasion', 'Diplomacy', 2],
  ['Puzzle Solver', 'bthitems/_source/Puzzle_Solver_AS1G8dp4t09G1k6N.json', 'alertness', 'Investigation', 1],
])('%s: its ↑ on rolls made with the named Specialization only', (name, file, skill, spec, up) => {
  const actor = misc7Holder([file], { system: { skills: { [skill]: { shift: 'd8', specializations: { s1: { name: spec } } } } } });
  expect(regASources(actor, { rolledSkill: skill, dataset: { specializationName: spec } })).toEqual([expect.objectContaining({ shiftUp: up, label: expect.stringContaining(name) })]);
  // The sheet's specializationKey alone finds the name on the actor.
  expect(regAUp(actor, { rolledSkill: skill, dataset: { specializationKey: 's1' } })).toBe(up);
  expect(regASources(actor, { rolledSkill: skill, dataset: { specializationName: 'Other' } })).toEqual([]);
  expect(regASources(actor, { rolledSkill: skill })).toEqual([]);
  expect(regASources(actor, { rolledSkill: 'athletics', dataset: { specializationName: spec } })).toEqual([]);
  expect(regASources(holder([]), { rolledSkill: skill, dataset: { specializationName: spec } })).toEqual([]);
});

test('Psych 101: ↑2 on Culture while holding any Science Specialization', () => {
  const file = 'eocitems/_source/Psych_101_pfkMVppvtLbdDTG7.json';
  const actor = misc7Holder([file], { system: { skills: { culture: { shift: 'd8' }, science: { shift: 'd8', specializations: { chem: { name: 'Chemistry' } } } } } });
  expect(regAUp(actor, { rolledSkill: 'culture' })).toBe(2);
  expect(regAUp(actor, { rolledSkill: 'athletics' })).toBe(0);
  expect(regAUp(actor, regAInitiative('culture'))).toBe(0);
  const none = misc7Holder([file], { system: { skills: { culture: { shift: 'd8' }, science: { shift: 'd8', specializations: {} } } } });
  expect(regAUp(none, { rolledSkill: 'culture' })).toBe(0);
});

test.each([
  'wtnvcgitems/_source/Tourniquet_Line_Chef_fxH2GPkDGvJEpI8s.json',
  'gijcrbitems/_source/EMT_Crash_Course_jDAu1zaZpv1IylJ8.json',
  'prcrbitems/_source/EMT_Crash_Course_cBezxXDBMpsRwYbP.json',
])('%s: Edge on Science rolled with the Medicine Specialization', file => {
  const actor = misc7Holder([file]);
  expect(regAEdge(actor, { rolledSkill: 'science', dataset: { specializationName: 'Medicine' } })).toBe(true);
  expect(regAEdge(actor, { rolledSkill: 'science', dataset: { specializationName: 'Chemistry' } })).toBe(false);
  expect(regAEdge(actor, { rolledSkill: 'science' })).toBe(false);
  expect(regAEdge(actor, { rolledSkill: 'alertness', dataset: { specializationName: 'Medicine' } })).toBe(false);
});

test('Astro-Sense: Edge on Survival (Space) and Technology (Astro-Nav)', () => {
  const actor = misc7Holder(['atsitems/_source/Astro_Sense_XfWmXOtcIM5snRKL.json']);
  expect(regAEdge(actor, { rolledSkill: 'survival', dataset: { specializationName: 'Space' } })).toBe(true);
  expect(regAEdge(actor, { rolledSkill: 'technology', dataset: { specializationName: 'Astro-Nav' } })).toBe(true);
  expect(regAEdge(actor, { rolledSkill: 'survival', dataset: { specializationName: 'Astro-Nav' } })).toBe(false);
  expect(regAEdge(actor, { rolledSkill: 'technology', dataset: { specializationName: 'Hacking' } })).toBe(false);
});

test('Broadcaster: Edge on Technology (Communications) outside combat only', () => {
  const actor = misc7Holder(['qgtgitems/_source/Broadcaster_IvmCWJUuntY3KALM.json']);
  const ctx = { rolledSkill: 'technology', dataset: { specializationName: 'Communications' } };
  expect(regAEdge(actor, ctx)).toBe(true);
  expect(regAEdge(actor, { ...ctx, dataset: { specializationName: 'Repair' } })).toBe(false);
  game.combat = { started: true };
  expect(regAEdge(actor, ctx)).toBe(false);
  game.combat = null;
});

test('Takedown Expert: Edge on a Takedown attempt only', () => {
  const actor = misc7Holder(['gijcrbitems/_source/Takedown_Expert_gO9IixdCX0fhReZk.json']);
  expect(regAEdge(actor, { rolledSkill: 'might', dataset: { isTakedown: true } })).toBe(true);
  expect(regAEdge(actor, { rolledSkill: 'might' })).toBe(false);
});

test('Spoiled: a Snag on one Requisition test a scene', async () => {
  const actor = misc7Holder(['ccitems/_source/Spoiled_AiXWfp1Qg0TyHWqK.json']);
  const ctx = { rolledSkill: 'wealth', dataset: { requisitionItemName: 'Rifle' } };
  const first = ruleRollSources(actor, null, ctx);
  expect(first.sources).toEqual([expect.objectContaining({ snag: true })]);
  expect(regASources(actor, { rolledSkill: 'wealth' })).toEqual([]);
  for (const consume of first.consumes) {
    await consumeLimited(consume, () => actor);
  }

  expect(regASources(actor, ctx)).toEqual([]);
});

test('Honest Assessment: ↑2 on the chosen Skill while active (its ↓2 on Deception/Persuasion stays code)', () => {
  const actor = misc7Holder(['mlpcrbitems/_source/Honest_Assessment_eIDYxShici5rRpg3.json']);
  actor.items.contents[0].system.choice = 'wealth';
  actor.flags.essence20.honestAssessmentActive = true;
  expect(regAUp(actor, { rolledSkill: 'wealth' })).toBe(2);
  expect(regAUp(actor, { rolledSkill: 'deception' })).toBe(0);
  expect(regAUp(actor, regAInitiative('wealth'))).toBe(0);
  actor.flags.essence20.honestAssessmentActive = false;
  expect(regAUp(actor, { rolledSkill: 'wealth' })).toBe(0);
});

test('Metallikato: ↓1 on Bot Mode melee attacks while Multiple Targets is on', () => {
  const actor = misc7Holder(['dditems/_source/Metallikato_ouLZnb7j0kAfCrLx.json'], { system: { isTransformed: false } });
  actor.flags.essence20.metallikatoMultipleTargetsActive = true;
  const melee = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } }, rolledSkill: 'might' };
  const ranged = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } }, rolledSkill: 'targeting' };
  expect(regASources(actor, melee)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  expect(regASources(actor, ranged)).toEqual([]);
  actor.system.isTransformed = true;
  expect(regASources(actor, melee)).toEqual([]);
  actor.system.isTransformed = false;
  actor.flags.essence20.metallikatoMultipleTargetsActive = false;
  expect(regASources(actor, melee)).toEqual([]);
});

test('Ninja Power: Edge on Speed tests while Morphed with it active', () => {
  const actor = misc7Holder(['prcrbitems/_source/Ninja_Power_wN5rjEQIJH68rWCd.json'], { system: { isMorphed: true } });
  actor.flags.essence20.ninjaPowerActive = true;
  expect(regAEdge(actor, { rolledSkill: 'acrobatics', rolledEssence: 'speed' })).toBe(true);
  expect(regAEdge(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toBe(false);
  actor.system.isMorphed = false;
  expect(regAEdge(actor, { rolledSkill: 'acrobatics', rolledEssence: 'speed' })).toBe(false);
  actor.system.isMorphed = true;
  actor.flags.essence20.ninjaPowerActive = false;
  expect(regAEdge(actor, { rolledSkill: 'acrobatics', rolledEssence: 'speed' })).toBe(false);
});

test('Perfect Disguise: Edge on Deception, Persuasion, Intimidation and Streetwise while disguised', () => {
  const actor = misc7Holder(['gijcrbitems/_source/Perfect_Disguise_ELktMVNYsiBPTX2c.json']);
  actor.flags.essence20.perfectDisguiseActive = true;
  for (const skill of ['deception', 'persuasion', 'intimidation', 'streetwise']) {
    expect(regAEdge(actor, { rolledSkill: skill })).toBe(true);
  }

  expect(regAEdge(actor, { rolledSkill: 'athletics' })).toBe(false);
  actor.flags.essence20.perfectDisguiseActive = false;
  expect(regAEdge(actor, { rolledSkill: 'deception' })).toBe(false);
});

test('Tracker (Environmental): ↑2 on Survival in the environment of expertise', async () => {
  const { registerCheck } = await import('./predicate.mjs');
  const { hasActiveEnvironmentalExpertise } = await import('../helpers/environmental-expertise.mjs');
  registerCheck('environmentalExpertise', hasActiveEnvironmentalExpertise);
  if (!('canvas' in global)) {
    global.canvas = undefined;
  }

  const expertise = { type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ' } } };
  const actor = misc7Holder(['gijcrbitems/_source/Tracker__Environmental__mgvaFU9Kgr3awtfB.json'], {}, [expertise]);
  actor.flags.essence20.environmentalExpertiseActive = true;
  expect(regASources(actor, { rolledSkill: 'survival' })).toEqual([expect.objectContaining({ shiftUp: 2, label: 'Tracker (Environmental)' })]);
  expect(regAUp(actor, { rolledSkill: 'alertness' })).toBe(0);
  actor.flags.essence20.environmentalExpertiseActive = false;
  expect(regAUp(actor, { rolledSkill: 'survival' })).toBe(0);
});

test('Peerless Pilot (GI Joe): ↑2 on Driving while driving with a Driving Specialization', () => {
  const file = 'gijcrbitems/_source/Peerless_Pilot_y39VC0CIsI8mdLKK.json';
  const specialized = { skills: { driving: { shift: 'd8', specializations: { car: { name: 'Cars' } } } } };
  expect(regAUp(diceACrew([file], { system: specialized }), { rolledSkill: 'driving' })).toBe(2);
  expect(regAUp(diceACrew([file], { system: specialized }), { rolledSkill: 'athletics' })).toBe(0);
  expect(regAUp(diceACrew([file], { system: specialized, role: 'passenger' }), { rolledSkill: 'driving' })).toBe(0);
  expect(regAUp(diceACrew([file], { system: specialized, type: null }), { rolledSkill: 'driving' })).toBe(0);
  expect(regAUp(diceACrew([file], { system: { skills: { driving: { shift: 'd8', specializations: {} } } } }), { rolledSkill: 'driving' })).toBe(0);
  delete game.actors;
});

test.each([
  ['Eureka!', 'prcrbitems/_source/Eureka__DU5oZEhhd45VDmRg.json', { rolledSkill: 'science', rolledEssence: 'smarts' }, { rolledSkill: 'persuasion', rolledEssence: 'social' }],
  ['Eltarian Tech', 'ttsgitems/_source/Eltarian_Tech_jaqxs1OPQuaI9KJZ.json', { rolledSkill: 'technology', rolledEssence: 'smarts' }, { rolledSkill: 'science', rolledEssence: 'smarts' }],
])('%s: a switch spending a Role Point for an Edge that clears a Snag', async (name, file, ctx, other) => {
  const actor = misc7Holder([file]);
  const points = regARolePoints(actor, 1);
  expect(regASwitches(actor, ctx)).toHaveLength(1);
  expect(regASwitches(actor, other)).toEqual([]);
  const options = await regATick(actor, ctx, { snag: true });
  expect([options.edge, options.snag, points.system.resource.value]).toEqual([true, false, 0]);
  expect(regASwitches(actor, ctx)).toEqual([]);
});

test('Eltarian Tech: not offered on Initiative', () => {
  const actor = misc7Holder(['ttsgitems/_source/Eltarian_Tech_jaqxs1OPQuaI9KJZ.json']);
  regARolePoints(actor, 1);
  expect(regASwitches(actor, regAInitiative('technology'))).toEqual([]);
});

test('Always Ready: an Edge switch on the chosen function\'s two Skills, once per scene', async () => {
  const actor = misc7Holder(['ghpfitems/_source/Always_Ready_g8IpStvApoftBiNq.json']);
  actor.items.contents[0].system.choice = 'engineer';
  expect(regASwitches(actor, { rolledSkill: 'brawn' })).toHaveLength(1);
  expect(regASwitches(actor, { rolledSkill: 'technology' })).toHaveLength(1);
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(regASwitches(actor, regAInitiative('brawn'))).toEqual([]);
  const options = await regATick(actor, { rolledSkill: 'brawn' }, { snag: true });
  expect([options.edge, options.snag]).toEqual([true, false]);
  expect(regASwitches(actor, { rolledSkill: 'technology' })).toEqual([]);
  expect(regASwitches(holder(['ghpfitems/_source/Always_Ready_g8IpStvApoftBiNq.json']), { rolledSkill: 'brawn' })).toEqual([]);
});

test.each([
  ['Dependable Tanker', 'iafav2items/_source/Dependable_Tanker_mHqern3w5iGWBi02.json', ['driving', 'technology']],
  ['Hacking Algorithms', 'iafav2items/_source/Hacking_Algorithms_6IxjVPikwpSdrYpd.json', ['technology']],
])('%s: a Story Point switch for an Edge that clears a Snag', async (name, file, skills) => {
  const actor = misc7Holder([file]);
  for (const skill of skills) {
    expect(regASwitches(actor, { rolledSkill: skill })).toEqual([expect.objectContaining({ entry: expect.objectContaining({ rule: expect.objectContaining({ cost: { resource: { storyPoints: true }, amount: 1 } }) }) })]);
  }

  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(regASwitches(actor, regAInitiative(skills[0]))).toEqual([]);
  const options = await regATick(actor, { rolledSkill: skills[0] }, { snag: true });
  expect([options.edge, options.snag]).toEqual([true, false]);
});

test('Strike Bonus: a melee switch spending 1 Personal Power for ↑(its advance), once per round', async () => {
  const actor = regAWritable(misc7Holder(['prcrbitems/_source/Strike_Bonus_eCTmc2BbsrCLrjkw.json'], { system: { powers: { personal: { value: 1 } } } }));
  actor.items.contents[0].system.advances = { currentValue: 2 };
  const melee = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } } };
  const ranged = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } } };
  expect(regASwitches(actor, ranged)).toEqual([]);
  expect(regASwitches(actor, melee)).toHaveLength(1);
  game.combat = { started: true, id: 'c1', round: 1, turn: 0 };
  const options = await regATick(actor, melee);
  expect([options.shiftUp, actor.system.powers.personal.value]).toEqual([2, 0]);
  actor.system.powers.personal.value = 1;
  expect(regASwitches(actor, melee)).toEqual([]);
  game.combat = { started: true, id: 'c1', round: 2, turn: 0 };
  expect(regASwitches(actor, melee)).toHaveLength(1);
  actor.system.powers.personal.value = 0;
  expect(regASwitches(actor, melee)).toEqual([]);
  actor.system.powers.personal.value = 1;
  actor.items.contents[0].system.advances.currentValue = 0;
  expect(regASwitches(actor, melee)).toEqual([]);
  game.combat = null;
});

test('Heavy Force: while Morphed, a melee or shove switch spending 1 Personal Power for ↑2, once per turn', async () => {
  const actor = regAWritable(misc7Holder(['prcrbitems/_source/Heavy_Force_E4hk9pHESLuYQuO7.json'], { system: { isMorphed: true, powers: { personal: { value: 2 } } } }));
  const melee = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } } };
  const ranged = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } } };
  expect(regASwitches(actor, ranged)).toEqual([]);
  expect(regASwitches(actor, { rolledSkill: 'athletics', dataset: { isShove: true } })).toHaveLength(1);
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  game.combat = { started: true, id: 'c1', round: 1, turn: 0 };
  const options = await regATick(actor, melee);
  expect([options.shiftUp, actor.system.powers.personal.value]).toEqual([2, 1]);
  expect(regASwitches(actor, melee)).toEqual([]);
  game.combat = { started: true, id: 'c1', round: 1, turn: 1 };
  expect(regASwitches(actor, melee)).toHaveLength(1);
  actor.system.isMorphed = false;
  expect(regASwitches(actor, melee)).toEqual([]);
  actor.system.isMorphed = true;
  actor.system.powers.personal.value = 0;
  expect(regASwitches(actor, melee)).toEqual([]);
  game.combat = null;
});

test('Isolated: a ↑1 switch on any roll, once per encounter', async () => {
  const actor = misc7Holder(['tf1sitems/_source/Isolated_DUTXCfxZP1kjh9m6.json']);
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  expect(regASwitches(actor, regAInitiative('initiative'))).toEqual([]);
  const options = await regATick(actor, { rolledSkill: 'athletics' });
  expect(options.shiftUp).toBe(1);
  expect(regASwitches(actor, { rolledSkill: 'culture' })).toEqual([]);
});

test('Gutter Champion: a ↑1 switch on any roll, once per turn', async () => {
  const actor = misc7Holder(['dditems/_source/Gutter_Champion_pByfeAj3iyANNR68.json']);
  game.combat = { started: true, id: 'c1', round: 1, turn: 0 };
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  const options = await regATick(actor, { rolledSkill: 'athletics' });
  expect(options.shiftUp).toBe(1);
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  game.combat = { started: true, id: 'c1', round: 1, turn: 1 };
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toHaveLength(1);
  game.combat = null;
});

test('Thrillseeker: a self-imposed Snag switch on Strength / Speed tests, three times a scene', async () => {
  const actor = misc7Holder(['gijcrbitems/_source/Thrillseeker_7ISxvemsGVWGIzna.json']);
  const ctx = { rolledSkill: 'athletics', rolledEssence: 'strength' };
  expect(regASwitches(actor, { rolledSkill: 'acrobatics', rolledEssence: 'speed' })).toHaveLength(1);
  expect(regASwitches(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).toEqual([]);
  for (let use = 0; use < 3; use++) {
    expect((await regATick(actor, ctx)).snag).toBe(true);
  }

  expect(regASwitches(actor, ctx)).toEqual([]);
});

test('"I remember reading about…": a Specialized switch on Smarts tests, once per encounter', async () => {
  const actor = misc7Holder(['prcrbitems/_source/_I_remember_reading_about______m3yGoT712SFkaV7W.json']);
  const ctx = { rolledSkill: 'science', rolledEssence: 'smarts' };
  expect(regASwitches(actor, { rolledSkill: 'athletics', rolledEssence: 'strength' })).toEqual([]);
  expect(regASwitches(actor, ctx)).toHaveLength(1);
  expect((await regATick(actor, ctx)).isSpecialized).toBe(true);
  expect(regASwitches(actor, ctx)).toEqual([]);
});

test('Military Formality: a 0-3 number box on Deception, Intimidation and Persuasion, ↑1 each', async () => {
  const actor = misc7Holder(['fgtaaitems/_source/Military_Formality_eZh6jtzHA9dhywF9.json']);
  expect(regASwitches(actor, { rolledSkill: 'persuasion' })).toEqual([expect.objectContaining({ type: 'number', max: 3 })]);
  expect(regASwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  expect(regASwitches(actor, regAInitiative('intimidation'))).toEqual([]);
  expect((await regATick(actor, { rolledSkill: 'deception' }, {}, 2)).shiftUp).toBe(2);
  expect((await regATick(actor, { rolledSkill: 'intimidation' }, {}, 5)).shiftUp).toBe(3);
  expect((await regATick(actor, { rolledSkill: 'intimidation' }, {}, 0)).shiftUp).toBe(0);
});

test('Two-Handed Assault: a ↑1 switch with a Silent Martial Arts weapon matching the chosen handedness', async () => {
  const file = 'iafav2items/_source/Two_Handed_Assault_btGfoEaflxAZAw25.json';
  const attack = (actor, size, numHands, traits = ['silent', 'martialArts']) => {
    const ctx = diceAArmed(actor, { traits, classification: { size } });
    ctx.item.system.numHands = numHands;
    return ctx;
  };

  const light = misc7Holder([file]);
  light.items.contents[0].system.choice = 'dualWieldLight';
  expect(regASwitches(light, attack(light, 'light', 1))).toHaveLength(1);
  expect((await regATick(light, attack(light, 'light', 1))).shiftUp).toBe(1);
  expect(regASwitches(light, attack(light, 'heavy', 2))).toEqual([]);
  expect(regASwitches(light, attack(light, 'light', 1, ['silent']))).toEqual([]);
  const two = misc7Holder([file]);
  two.items.contents[0].system.choice = 'twoHanded';
  expect(regASwitches(two, attack(two, 'heavy', 2))).toHaveLength(1);
  expect(regASwitches(two, attack(two, 'light', 1))).toEqual([]);
  expect(regASwitches(two, { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' }, numHands: 2 } } })).toEqual([]);
});

// regB (dice.mjs rollSkill, per-target Defense): the target's own +N Defense Perks moved onto Defense rules,
// read per attack by rules/adapter.mjs#ruleDefenseAdjust (a `defense:` tag keeps them off the sheet).
describe('regB: per-attack Defense rules', () => {
  const ATTACKER = { type: 'npc', statuses: new Set(), flags: {}, system: {} };
  const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
  const sheet = () => ({ defenses: Object.fromEntries(DEFENSES.map(key => [key, { total: 10 }])) });
  const adjust = (actor, defense = 'toughness') => ruleDefenseAdjust(ATTACKER, actor, defense, { item: null });

  // A token for each actor at x feet, allies counted the system's way (helpers/allies.mjs#getNearbyAllyTokens).
  async function onCanvas(actor, allyFeet) {
    const { getNearbyAllyTokens } = await import('../helpers/allies.mjs');
    const { setWorldLookups } = await import('./predicate.mjs');
    const place = (who, x) => {
      const token = { actor: who, center: { x, y: 0 }, document: { disposition: 1 } };
      who.getActiveTokens = () => [token];
      who.items.find ??= fn => who.items.contents.find(fn);
      return token;
    };

    const tokens = [place(actor, 0), ...allyFeet.map(x => place(holder([]), x))];
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: tokens } };
    setWorldLookups({ alliesWithin: (who, feet) => getNearbyAllyTokens(who, feet).map(token => token.actor) });
  }

  afterEach(async () => {
    const { setWorldLookups } = await import('./predicate.mjs');
    setWorldLookups({ alliesWithin: null });
    delete global.canvas;
  });

  test('Skier: +1 Evasion against an attack while skiing, not on the sheet', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { isSkiing } = await import('../helpers/skier.mjs');
    registerCheck('skiing', isSkiing);
    const actor = misc7Holder(['ghpfitems/_source/Skier_dvmY7UiuKejOPY4N.json'], { system: sheet() });
    actor.flags.essence20.isSkiingActive = true;
    expect(adjust(actor, 'evasion')).toBe(1);
    expect(adjust(actor, 'toughness')).toBe(0);
    ruleDerived(actor);
    expect(actor.system.defenses.evasion.total).toBe(10);
    actor.flags.essence20.isSkiingActive = false;
    expect(adjust(actor, 'evasion')).toBe(0);
  });

  test('Stronger Together: +1 to the attacked Defense per ally within 60 ft', async () => {
    const actor = holder(['tfcrbitems/_source/Stronger_Together_ZeOj3mmjnXJ7iXj1.json'], { system: sheet() });
    await onCanvas(actor, [5]);
    expect(adjust(actor)).toBe(1);
    expect(adjust(actor, 'willpower')).toBe(1);
    await onCanvas(actor, [5, 60, 61]);
    expect(adjust(actor)).toBe(2);
    await onCanvas(actor, []);
    expect(adjust(actor)).toBe(0);
    const without = holder([], { system: sheet() });
    await onCanvas(without, [5]);
    expect(adjust(without)).toBe(0);
  });

  test('Heroic Intervention: +1 to every Defense with an ally within 5 ft', async () => {
    const actor = holder(['prcrbitems/_source/Heroic_Intervention_T95n2lwh3F5OHjnB.json'], { system: sheet() });
    await onCanvas(actor, [5]);
    expect(DEFENSES.map(defense => adjust(actor, defense))).toEqual([1, 1, 1, 1]);
    await onCanvas(actor, [5, 5]);
    expect(adjust(actor)).toBe(1);
    await onCanvas(actor, [10]);
    expect(adjust(actor)).toBe(0);
    await onCanvas(actor, []);
    expect(adjust(actor)).toBe(0);
  });

  test('Environmental Armor: +1 to every Defense in the environment of expertise', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { hasActiveEnvironmentalExpertise } = await import('../helpers/environmental-expertise.mjs');
    registerCheck('environmentalExpertise', hasActiveEnvironmentalExpertise);
    global.canvas = undefined;
    const expertise = { type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ' } } };
    const actor = misc7Holder(['gijcrbitems/_source/Environmental_Armor_Vo5AfbJNfVGf24E0.json'], { system: sheet() }, [expertise]);
    actor.flags.essence20.environmentalExpertiseActive = true;
    expect(DEFENSES.map(defense => adjust(actor, defense))).toEqual([1, 1, 1, 1]);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
    actor.flags.essence20.environmentalExpertiseActive = false;
    expect(adjust(actor)).toBe(0);
    const noExpertise = misc7Holder(['gijcrbitems/_source/Environmental_Armor_Vo5AfbJNfVGf24E0.json'], { system: sheet() });
    noExpertise.flags.essence20.environmentalExpertiseActive = true;
    expect(adjust(noExpertise)).toBe(0);
  });

  test('Impenetrable Armor: +2 to every Defense of the vehicle its holder is driving', async () => {
    const { LINK_HOLDERS } = await import('./index.mjs');
    const driver = holder(['gijcrbitems/_source/Impenetrable_Armor_vanN7kRYUhgHew7q.json'], { system: sheet() });
    driver.uuid = `Actor.${driver.id}`;
    const vehicle = (type = 'vehicle', vehicleRole = 'driver') => ({
      id: `v${nextId++}`, uuid: `Actor.v${nextId}`, type, statuses: new Set(), flags: {},
      items: { contents: [] }, system: { ...sheet(), actors: { a: { uuid: driver.uuid, vehicleRole } } },
    });
    const previous = global.fromUuidSync;
    global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
    try {
      expect(DEFENSES.map(defense => adjust(vehicle(), defense))).toEqual([2, 2, 2, 2]);
      expect(adjust(vehicle('vehicle', 'passenger'))).toBe(0);
      expect(adjust(vehicle('zord'))).toBe(0);
      expect(adjust(driver)).toBe(0);
      const noPerk = holder([]);
      global.fromUuidSync = uuid => (uuid == driver.uuid ? noPerk : null);
      expect(adjust(vehicle())).toBe(0);
    } finally {
      global.fromUuidSync = previous;
      LINK_HOLDERS.delete(driver.id);
    }
  });
});

// regC batch (dice.mjs, _getAutomaticCombatModifiers to the end): size-difference upshifts against the target
// (@size / @target.size with target:sizeDiff), Seconds Between Click & Boom's incoming Snag, and Exterminator's ↑1.

const regCTarget = size => ({ type: 'npc', flags: {}, statuses: new Set(), system: { size } });
const regCUp = (actor, target, ctx) => ruleRollSources(actor, target, ctx).sources.reduce((n, source) => n + source.shiftUp, 0);

test('Big And Scary: ↑ on Intimidation for each Size Class larger than the target, counting one size larger', () => {
  const actor = holder(['iafav2items/_source/Big_And_Scary_FZww5MX65plu6kZ8.json'], { system: { size: 'common' } });
  expect(regCUp(actor, regCTarget('common'), { rolledSkill: 'intimidation' })).toBe(1);
  expect(ruleRollSources(actor, regCTarget('common'), { rolledSkill: 'intimidation' }).sources[0].label).toBe('Big And Scary');
  expect(regCUp(actor, regCTarget('large'), { rolledSkill: 'intimidation' })).toBe(0);
  expect(regCUp(actor, regCTarget('common'), { rolledSkill: 'persuasion' })).toBe(0);
  expect(regCUp(actor, null, { rolledSkill: 'intimidation' })).toBe(0);
  actor.system.size = 'long';
  expect(regCUp(actor, regCTarget('small'), { rolledSkill: 'intimidation' })).toBe(4);
  expect(switchNames(actor, { rolledSkill: 'intimidation' })).toEqual([]);
});

test('Bend A Knee Or Stand Tall: ↑ equal to the size difference either way on Intimidation and Persuasion', () => {
  const actor = holder(['tfcrbitems/_source/Bend_A_Knee_Or_Stand_Tall_JjCRN28P9CDBibVg.json'], { system: { size: 'common' } });
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'intimidation' })).toBe(2);
  expect(regCUp(actor, regCTarget('common'), { rolledSkill: 'intimidation' })).toBe(0);
  expect(ruleRollSources(actor, regCTarget('common'), { rolledSkill: 'intimidation' }).sources).toEqual([]);
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'deception' })).toBe(0);
  expect(regCUp(actor, null, { rolledSkill: 'persuasion' })).toBe(0);
  actor.system.size = 'long';
  expect(regCUp(actor, regCTarget('small'), { rolledSkill: 'persuasion' })).toBe(3);
});

test('Big Preds Are My Specialty: ↑ on Infiltration for each Size Class the target is larger', () => {
  const actor = holder(['tsitems/_source/Big_Preds_Are_My_Specialty_igkuus7jkoqYV5Fr.json'], { system: { size: 'common' } });
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'infiltration' })).toBe(2);
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'athletics' })).toBe(0);
  expect(regCUp(actor, regCTarget('common'), { rolledSkill: 'infiltration' })).toBe(0);
  expect(regCUp(actor, regCTarget('small'), { rolledSkill: 'infiltration' })).toBe(0);
  expect(regCUp(actor, null, { rolledSkill: 'infiltration' })).toBe(0);
});

test('The Bigger The Heart: ↑ on the chosen Empathy Skill for each Size Class the target is larger', () => {
  const empathy = choice => ({ type: 'perk', name: 'Empathy', flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ' } }, system: { choice } });
  const actor = misc7Holder(['mlpcrbitems/_source/The_Bigger_The_Heart_fiyZcC8KRK5TebTk.json'], { system: { size: 'common' } }, [empathy('survival')]);
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'survival' })).toBe(2);
  expect(regCUp(actor, regCTarget('common'), { rolledSkill: 'survival' })).toBe(0);
  expect(regCUp(actor, regCTarget('long'), { rolledSkill: 'persuasion' })).toBe(0);
  expect(switchNames(actor, { rolledSkill: 'survival' })).toEqual([]);
  const noChoice = misc7Holder(['mlpcrbitems/_source/The_Bigger_The_Heart_fiyZcC8KRK5TebTk.json'], { system: { size: 'common' } }, [empathy('')]);
  expect(regCUp(noChoice, regCTarget('long'), { rolledSkill: 'survival' })).toBe(0);
});

test("Seconds Between Click & Boom: attacks against the holder's Evasion take a Snag", () => {
  const defender = holder(['gijcrbitems/_source/Seconds_Between_Click___Boom_ofiG5IwlURUwORYV.json']);
  const attacker = holder([]);
  const attack = defenseType => ({ type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' }, defenseType } });
  expect(ruleRollSources(attacker, defender, { item: attack('evasion') }).sources).toEqual([
    expect.objectContaining({ snag: true, label: 'Seconds Between Click & Boom' }),
  ]);
  expect(ruleRollSources(attacker, defender, { item: attack('toughness') }).sources).toEqual([]);
  expect(ruleRollSources(attacker, defender, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  // The holder's own attacks are untouched.
  expect(ruleRollSources(defender, attacker, { item: attack('evasion') }).sources).toEqual([]);
});

test('Exterminator: ↑1 on attacks against a smaller Common or Small target', () => {
  const actor = holder(['dditems/_source/Exterminator_B5HgQeurLyvio1t7.json'], { system: { size: 'common' } });
  const attack = { item: { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } } };
  expect(regCUp(actor, regCTarget('small'), attack)).toBe(1);
  expect(regCUp(actor, regCTarget('small'), { rolledSkill: 'persuasion' })).toBe(0);
  expect(regCUp(actor, regCTarget('common'), attack)).toBe(0);
  expect(regCUp(actor, null, attack)).toBe(0);
  actor.system.size = 'huge';
  expect(regCUp(actor, regCTarget('common'), attack)).toBe(1);
  expect(regCUp(actor, regCTarget('large'), attack)).toBe(0);
  actor.system.size = 'small';
  expect(regCUp(actor, regCTarget('small'), attack)).toBe(0);
});

test("Contingency Shot: a ranged attack on someone else's turn ignores Cover", () => {
  const actor = holder(['prcrbitems/_source/Contingency_Shot_DAqOZsEq03rJWWQo.json']);
  const turn = id => ({ started: true, combatant: { actor: { id } } });
  const ranged = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' }, defenseType: 'toughness' } };
  const melee = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' }, defenseType: 'toughness' } };
  expect(ruleCover(actor, regCTarget('common'), { item: ranged, combat: turn('someoneElse') }).ignore).toBe(true);
  // Outside a Contingency (no combat, or on the holder's own turn) Cover still applies.
  expect(ruleCover(actor, regCTarget('common'), { item: ranged, combat: null }).ignore).toBe(false);
  expect(ruleCover(actor, regCTarget('common'), { item: ranged, combat: turn(actor.id) }).ignore).toBe(false);
  expect(ruleCover(actor, regCTarget('common'), { item: melee, combat: turn('someoneElse') }).ignore).toBe(false);
  // Without the Perk, nothing.
  expect(ruleCover(holder([]), regCTarget('common'), { item: ranged, combat: turn('someoneElse') }).ignore).toBe(false);
});

// regA2 (dice.mjs rollSkill, before the Roll Options Dialog, second pass with the 2026-10-03 engine pieces):
// best-of die substitutions (DieSubstitution), check: RollModifiers, Two Steps to the Right's ally aura and
// Cryogenic Touch's declared Impaired-on-hit switch.

describe('regA2', () => {
  /** The die a roll starts from once the item rules' DieSubstitutions ran (dice.mjs initialShift). */
  const die = (actor, ctx, start) => ruleDieSubstitution(actor, null, { dataset: {}, ...ctx }, start);
  const attack = (system = {}, flags = {}) => ({ type: 'weaponEffect', flags, system: { classification: { skill: 'targeting', style: 'projectile' }, damageType: 'ballistic', ...system } });

  test('Aerial Acrobat: attacks use the best of the rolled, Acrobatics and Driving dice', () => {
    const file = 'ccitems/_source/Aerial_Acrobat_sHtvGtD2PuXzpuxC.json';
    const skills = (acrobatics, driving) => ({ system: { skills: { targeting: { shift: 'd10' }, acrobatics: { shift: acrobatics }, driving: { shift: driving } } } });
    expect(die(holder([file], skills('d12', 'd6')), { item: attack() }, 'd10')).toMatchObject({ shift: 'd12', specialize: false, clearSnag: false });
    expect(die(holder([file], skills('d6', 'd12')), { item: attack() }, 'd10').shift).toBe('d12');
    // Without the Perk, on a non-attack roll, or when the attack Skill is already the best.
    expect(die(holder([], skills('d12', 'd6')), { item: attack() }, 'd10').shift).toBe('d10');
    expect(die(holder([file], skills('d12', 'd6')), { rolledSkill: 'targeting' }, 'd10').shift).toBe('d10');
    expect(die(holder([file], skills('d2', 'd4')), { item: attack() }, 'd10').shift).toBe('d10');
  });

  test('Circuit Breaker: Electric attacks (damage type or weapon trait) use the Technology die when it is better', () => {
    const file = 'tfcrbitems/_source/Circuit_Breaker_9Tnrm8Nb1xDaNCao.json';
    const make = (technology = 'd12', files = [file]) => misc7Holder(files, { system: { skills: { targeting: { shift: 'd10' }, technology: { shift: technology } } } },
      [{ id: 'w1', type: 'weapon', name: 'Shock Rifle', system: { traits: ['electric'] } }, { id: 'w2', type: 'weapon', name: 'Rifle', system: { traits: [] } }]);
    const actor = make();
    expect(die(actor, { item: attack({ damageType: 'electric' }) }, 'd10').shift).toBe('d12');
    expect(die(actor, { item: { ...attack(), parent: actor, flags: { essence20: { parentId: 'w1' } } } }, 'd10').shift).toBe('d12');
    // Without the Perk, on a non-Electric weapon, or when Technology isn't better.
    expect(die(make('d12', []), { item: attack({ damageType: 'electric' }) }, 'd10').shift).toBe('d10');
    expect(die(actor, { item: attack() }, 'd10').shift).toBe('d10');
    expect(die(actor, { item: { ...attack(), parent: actor, flags: { essence20: { parentId: 'w2' } } } }, 'd10').shift).toBe('d10');
    expect(die(make('d20'), { item: attack({ damageType: 'electric' }) }, 'd10').shift).toBe('d10');
  });

  test('Cultural Connection: a trained Deception / Persuasion roll uses a better Culture die, Specialized from level 10', () => {
    const file = 'fffav1items/_source/Cultural_Connection_m90eNtuZvLWouyRc.json';
    const make = ({ culture = 'd10', deception = 'd6', level = 1, files = [file] } = {}) => holder(files, { system: { level, skills: { deception: { shift: deception }, culture: { shift: culture } } } });
    const deception = (dataset = {}) => ({ rolledSkill: 'deception', dataset: { shift: null, ...dataset } });
    expect(die(make(), deception(), 'd6')).toMatchObject({ shift: 'd10', specialize: false });
    expect(die(make({ level: 10 }), deception(), 'd6')).toMatchObject({ shift: 'd10', specialize: true });
    expect(die(make({ level: 10 }), { ...deception({ shift: 'd6' }), rolledSkill: 'persuasion' }, 'd6')).toMatchObject({ shift: 'd10', specialize: true });
    // Without the Perk, on an untrained Skill (the sheet's d20, or the actor's own when the roll has none), when
    // Culture isn't better, or on an unrelated Skill. Specialized only when the Culture die is used.
    expect(die(make({ files: [] }), deception(), 'd6').shift).toBe('d6');
    expect(die(make({ culture: 'd2', deception: 'd20' }), deception(), 'd20').shift).toBe('d20');
    expect(die(make({ deception: 'd8' }), deception({ shift: 'd20' }), 'd20').shift).toBe('d20');
    expect(die(make({ deception: 'd20' }), deception({ shift: 'd6' }), 'd6').shift).toBe('d10');
    expect(die(make({ culture: 'd6', deception: 'd8', level: 10 }), deception(), 'd8')).toMatchObject({ shift: 'd8', specialize: false });
    expect(die(make(), { ...deception(), rolledSkill: 'alertness' }, 'd6').shift).toBe('d6');
  });

  test('Brutal Verbalities: a Rouse attempt uses a better Intimidation die', () => {
    const file = 'sssitems/_source/Brutal_Verbalities_S9AyX2OtvvrE9oM0.json';
    const make = (intimidation = 'd10', persuasion = 'd6', files = [file]) => holder(files, { system: { skills: { persuasion: { shift: persuasion }, intimidation: { shift: intimidation } } } });
    const rouse = isRouseAttempt => ({ rolledSkill: 'persuasion', dataset: { isRouseAttempt } });
    expect(die(make(), rouse(true), 'd6').shift).toBe('d10');
    // Without the Perk, off a Rouse attempt, or when Intimidation isn't better.
    expect(die(make('d10', 'd6', []), rouse(true), 'd6').shift).toBe('d6');
    expect(die(make(), rouse(false), 'd6').shift).toBe('d6');
    expect(die(make('d6', 'd10'), rouse(true), 'd10').shift).toBe('d10');
  });

  test("Agency: Wealth rolls never use a die worse than the chosen Skill's", () => {
    const file = 'atsitems/_source/Agency_bGKG7artYs7uHHz4.json';
    const make = (wealth = 'd20', files = [file]) => {
      const actor = holder(files, { system: { skills: { wealth: { shift: wealth }, technology: { shift: 'd6' }, alertness: { shift: 'd20' } } } });
      for (const item of actor.items.contents) {
        item.system.choice = 'technology';
      }

      return actor;
    };

    expect(die(make(), { rolledSkill: 'wealth' }, 'd20').shift).toBe('d6');
    // An already-better Wealth die stays; nothing without the Perk or on another Skill; nothing with no choice made.
    expect(die(make('d8'), { rolledSkill: 'wealth' }, 'd8').shift).toBe('d8');
    expect(die(make('d20', []), { rolledSkill: 'wealth' }, 'd20').shift).toBe('d20');
    expect(die(make(), { rolledSkill: 'alertness' }, 'd20').shift).toBe('d20');
    const unchosen = make();
    unchosen.items.contents[0].system.choice = '';
    expect(die(unchosen, { rolledSkill: 'wealth' }, 'd20').shift).toBe('d20');
  });

  test('Charge Into Battle: ↑1 on an attack with a Multiple Targets weapon', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { isMultipleTargetsWeapon } = await import('../helpers/multiple-targets.mjs');
    registerCheck('multipleTargetsWeapon', (actor, option, ctx) => (ctx?.item ? isMultipleTargetsWeapon(actor, ctx.item) : null));
    const make = (traits, files = ['ttsgitems/_source/Charge_Into_Battle_34O7Y77lZpuhng3G.json']) => misc7Holder(files, {},
      [{ id: 'weapon1', type: 'weapon', name: 'Sword', system: { traits: [], itemAndUpgradeTraits: traits } }]);
    const swing = { type: 'weaponEffect', flags: { essence20: { parentId: 'weapon1' } }, system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt' } };
    expect(regASources(make(['multipleTargets']), { item: swing })).toEqual([expect.objectContaining({ shiftUp: 1, label: expect.stringContaining('Charge Into Battle') })]);
    expect(regAUp(make(['multipleTargets'], []), { item: swing })).toBe(0);
    expect(regAUp(make([]), { item: swing })).toBe(0);
    expect(regAUp(make(['multipleTargets']), { rolledSkill: 'might' })).toBe(0);
  });

  test('Down the Barrel: Edge on Intimidation / Persuasion while the Favorite Weapon is equipped', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { favoriteWeaponOf } = await import('../helpers/extensions/tf1/common.mjs');
    registerCheck('favoriteWeaponEquipped', actor => !!favoriteWeaponOf(actor)?.system?.equipped);
    const make = ({ equipped = true, barrel = true } = {}) => {
      const files = ['dditems/_source/Favorite_Weapon_emaXxo2XzoHMoNCe.json', ...(barrel ? ['dditems/_source/Down_the_Barrel_U5vb2NBZG6F6SgK1.json'] : [])];
      const actor = misc7Holder(files, {}, [{ id: 'w1', type: 'weapon', name: 'Blaster', system: { equipped } }]);
      actor.items.contents[0].flags = { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.emaXxo2XzoHMoNCe' } };
      actor.items.contents[0].system.choice = 'w1';
      return actor;
    };

    expect(regAEdge(make(), { rolledSkill: 'intimidation' })).toBe(true);
    expect(regAEdge(make(), { rolledSkill: 'persuasion' })).toBe(true);
    // An unrelated Skill, the weapon unequipped, without the Perk - or its Skill as the Initiative Skill.
    expect(regAEdge(make(), { rolledSkill: 'science' })).toBe(false);
    expect(regAEdge(make({ equipped: false }), { rolledSkill: 'intimidation' })).toBe(false);
    expect(regAEdge(make({ barrel: false }), { rolledSkill: 'intimidation' })).toBe(false);
    expect(regAEdge(make(), regAInitiative('intimidation'))).toBe(false);
  });

  describe('Zord Features: Martial Zord, Zero-G and Zord Sentience read whether the Zord has a driver', () => {
    const FILES = {
      martial: 'prcrbitems/_source/Martial_Zord_nQcU1SrVChPaXXpq.json',
      zeroG: 'prcrbitems/_source/Zero_G_8xV4xaz8Hnqk4TgQ.json',
      sentience: 'bthitems/_source/Zord_Sentience_idhVrfBIKELsl3OW.json',
    };
    const pilot = { uuid: 'Actor.pilot1', type: 'playerCharacter', items: [], system: {} };
    const zord = (file, { driver = true, type = 'zord' } = {}) => {
      const actor = holder(file ? [file] : [], { system: { actors: driver ? { crew1: { vehicleRole: 'driver', uuid: pilot.uuid } } : {} } });
      actor.type = type;
      return actor;
    };

    const swing = style => ({ item: { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'might', style }, damageType: 'blunt' } } });

    beforeAll(async () => {
      const { registerCheck } = await import('./predicate.mjs');
      const { getVehicleDriver } = await import('../helpers/combat.mjs');
      registerCheck('zordHasDriver', actor => !!getVehicleDriver(actor));
      global.fromUuidSync = uuid => (uuid == pilot.uuid ? pilot : null);
    });

    afterAll(() => {
      delete global.fromUuidSync;
    });

    test("Martial Zord: ↑1 on the Zord's own melee attack while it has a driver", () => {
      expect(regAUp(zord(FILES.martial), swing('melee'))).toBe(1);
      expect(regAUp(zord(null), swing('melee'))).toBe(0);
      expect(regAUp(zord(FILES.martial, { driver: false }), swing('melee'))).toBe(0);
      expect(regAUp(zord(FILES.martial), swing('energy'))).toBe(0);
      expect(regAUp(zord(FILES.martial, { type: 'vehicle' }), swing('melee'))).toBe(0);
    });

    test("Zero-G: ↑1 on the Zord's own ranged attack while it has a driver", () => {
      expect(regAUp(zord(FILES.zeroG), swing('energy'))).toBe(1);
      expect(regAUp(zord(FILES.zeroG), swing('melee'))).toBe(0);
      expect(regAUp(zord(FILES.zeroG, { driver: false }), swing('energy'))).toBe(0);
    });

    test("Zord Sentience: ↑1 on the Zord's own Driving while unpiloted", () => {
      expect(regAUp(zord(FILES.sentience, { driver: false }), { rolledSkill: 'driving' })).toBe(1);
      expect(regAUp(zord(null, { driver: false }), { rolledSkill: 'driving' })).toBe(0);
      expect(regAUp(zord(FILES.sentience), { rolledSkill: 'driving' })).toBe(0);
      expect(regAUp(zord(FILES.sentience, { driver: false }), { rolledSkill: 'might' })).toBe(0);
      expect(regAUp(zord(FILES.sentience, { driver: false }), regAInitiative('driving'))).toBe(0);
    });
  });

  test('Two Steps to the Right: Edge on Infiltration / Survival for an ally within 60 ft of a holder, once however many', async () => {
    const { useAllyLookup } = await import('./links.mjs');
    const { setWorldLookups } = await import('./predicate.mjs');
    const file = 'eocitems/_source/Two_Steps_to_the_Right_a5xcpj3rHW5EW354.json';
    const roller = holder([]);
    const surveyor = holder([file]);
    const other = holder([file]);
    const place = actor => {
      const token = { actor, center: { x: 0, y: 0 }, document: { disposition: 1 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    global.canvas = { tokens: { placeables: [place(roller), place(surveyor), place(other)] } };
    let near = [surveyor, other];
    const asked = [];
    setWorldLookups({ alliesWithin: (actor, feet) => (asked.push(feet), near) });
    useAllyLookup(true);
    try {
      expect(regASources(roller, { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ edge: true, label: expect.stringContaining('Two Steps to the Right') })]);
      expect(regAEdge(roller, { rolledSkill: 'survival' })).toBe(true);
      expect(asked).toContain(60);
      // An unrelated Skill, the Initiative roll, no ally holding it in reach - and never the holder's own roll.
      expect(regAEdge(roller, { rolledSkill: 'wealth' })).toBe(false);
      expect(regAEdge(roller, regAInitiative('survival'))).toBe(false);
      near = [];
      expect(regAEdge(roller, { rolledSkill: 'infiltration' })).toBe(false);
      near = [roller];
      expect(regASources(surveyor, { rolledSkill: 'infiltration' }).filter(source => source.label.includes('Two Steps'))).toEqual([]);
    } finally {
      useAllyLookup(false);
      setWorldLookups({ alliesWithin: null });
      delete global.canvas;
    }
  });

  test('Cryogenic Touch: an unarmed-attack switch costing 1 Personal Power, then Impaired on each target hit', async () => {
    const { fireTriggers } = await import('./triggers.mjs');
    const actor = regAWritable(misc7Holder(['jttitems/_source/Cryogenic_Touch_dDHjUwjLlGJhiQvI.json'], { system: { powers: { personal: { value: 1 } } } }));
    const unarmed = { item: { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt' } } };
    const armed = { item: { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt' } } };
    expect(regASwitches(actor, unarmed)).toEqual([expect.objectContaining({ type: 'checkbox', value: false })]);
    expect(regASwitches(actor, armed)).toEqual([]);
    expect(regASwitches(actor, { rolledSkill: 'brawn' })).toEqual([]);
    const options = await regATick(actor, unarmed);
    expect(options.ruleKeys).toEqual(['cryogenicTouch']);
    expect(actor.system.powers.personal.value).toBe(0);
    // Not offered once the Power can't be paid.
    expect(regASwitches(actor, unarmed)).toEqual([]);

    global.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
    const toggled = [];
    const foe = { name: 'Foe', isOwner: true, statuses: new Set(), toggleStatusEffect: async (...args) => toggled.push(args) };
    await fireTriggers(actor, 'hit', { roll: { ...unarmed, isAttack: true, isMelee: true, switches: [] }, outcome: 'success', targets: [foe] });
    expect(toggled).toEqual([]);
    await fireTriggers(actor, 'miss', { roll: { ...unarmed, isAttack: true, isMelee: true, switches: ['cryogenicTouch'] }, outcome: 'failure', targets: [foe] });
    expect(toggled).toEqual([]);
    await fireTriggers(actor, 'hit', { roll: { ...unarmed, isAttack: true, isMelee: true, switches: ['cryogenicTouch'] }, outcome: 'success', targets: [foe] });
    expect(toggled).toEqual([['impaired', { active: true }]]);
  });

  test('"A" for Effort!: an untrained roll starts at a d2 with no Snag, once per session', async () => {
    const file = 'wtnvcgitems/_source/_A__for_Effort__O8o96wtAeeMeCmUc.json';
    const actor = misc7Holder([file], { system: { skills: { science: { shift: 'd20' } } } });
    const untrained = { rolledSkill: 'science', dataset: { shift: 'd20' } };
    const first = die(actor, untrained, 'd20');
    expect(first).toMatchObject({ shift: 'd2', clearSnag: true });
    // A d2 already (an Essence's untrained bonus) still counts as untrained.
    expect(die(actor, untrained, 'd2')).toMatchObject({ shift: 'd2', clearSnag: true });
    await first.spend();
    expect(die(actor, untrained, 'd20')).toMatchObject({ shift: 'd20', clearSnag: false });
    // A trained roll, or no Perk: nothing.
    const fresh = misc7Holder([file]);
    expect(die(fresh, { rolledSkill: 'science', dataset: { shift: 'd8' } }, 'd8')).toMatchObject({ shift: 'd8', clearSnag: false });
    expect(die(misc7Holder([]), untrained, 'd20')).toMatchObject({ shift: 'd20', clearSnag: false });
    // A new session frees it again.
    const settings = game.settings;
    game.settings = { get: () => 2 };
    try {
      expect(die(actor, untrained, 'd20')).toMatchObject({ shift: 'd2', clearSnag: true });
    } finally {
      game.settings = settings;
    }
  });
});

// regB2 (dice.mjs rollSkill after the dialog, second pass): the dice pieces (RollDice), the attacker-side and
// aura Defense rules, a damage-type override (DamageType) and Force's limited, banking scaled damage.
describe('regB2: RollDice, Defense modes, DamageType and Force', () => {
  const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
  const sheet = () => ({ defenses: Object.fromEntries(DEFENSES.map(key => [key, { total: 10 }])) });
  const plain = () => ({ id: `p${nextId++}`, type: 'npc', statuses: new Set(), flags: {}, items: { contents: [] }, system: sheet() });

  // A weapon effect on a weapon with these traits, held by the actor (weapon: tags read it).
  function weaponEffect(actor, traits, style) {
    const weapon = { id: `w${nextId++}`, type: 'weapon', flags: {}, parent: actor, system: { traits } };
    actor.items.contents.push(weapon);
    return { type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: weapon.id } }, system: { classification: { style } } };
  }

  test('Silver Tongue: d20s count as at least 10 on Social Skill Tests only', async () => {
    const { ruleRollDice } = await import('./adapter.mjs');
    const actor = holder(['gijcrbitems/_source/Silver_Tongue_69ijP0SuQ4demwd9.json']);
    expect(ruleRollDice(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social', dataset: {} }).d20Floor).toBe(10);
    expect(ruleRollDice(actor, null, { rolledSkill: 'athletics', rolledEssence: 'strength', dataset: {} }).d20Floor).toBe(0);
    expect(ruleRollDice(holder([]), null, { rolledEssence: 'social', dataset: {} }).d20Floor).toBe(0);
  });

  test('Kill Shot: a third d20 on a ranged sniper-weapon attack with an Edge', async () => {
    const { ruleRollDice } = await import('./adapter.mjs');
    const actor = holder(['gijcrbitems/_source/Kill_Shot_K82Mlwef1QMEsRrP.json']);
    const sniper = weaponEffect(actor, ['sniper'], 'projectile');
    expect(ruleRollDice(actor, null, { item: sniper, edge: true, dataset: {} }).thirdD20).toBe(true);
    // Not without the Edge, with a non-sniper weapon, on a melee attack, or without the Perk.
    expect(ruleRollDice(actor, null, { item: sniper, edge: false, dataset: {} }).thirdD20).toBe(false);
    expect(ruleRollDice(actor, null, { item: weaponEffect(actor, ['ballistic'], 'projectile'), edge: true, dataset: {} }).thirdD20).toBe(false);
    expect(ruleRollDice(actor, null, { item: weaponEffect(actor, ['sniper'], 'melee'), edge: true, dataset: {} }).thirdD20).toBe(false);
    const without = holder([]);
    expect(ruleRollDice(without, null, { item: weaponEffect(without, ['sniper'], 'projectile'), edge: true, dataset: {} }).thirdD20).toBe(false);
  });

  test('Precision is Perfection: a third d20 on a Silent Martial Arts melee attack with an Edge', async () => {
    const { ruleRollDice } = await import('./adapter.mjs');
    const actor = holder(['iafav2items/_source/Precision_is_Perfection_2BYtrKD35dJ6jlV5.json']);
    const strike = weaponEffect(actor, ['silent', 'martialArts'], 'melee');
    expect(ruleRollDice(actor, null, { item: strike, edge: true, dataset: {} }).thirdD20).toBe(true);
    expect(ruleRollDice(actor, null, { item: strike, edge: false, dataset: {} }).thirdD20).toBe(false);
    expect(ruleRollDice(actor, null, { item: weaponEffect(actor, ['martialArts'], 'melee'), edge: true, dataset: {} }).thirdD20).toBe(false);
    expect(ruleRollDice(actor, null, { item: weaponEffect(actor, ['silent', 'martialArts'], 'projectile'), edge: true, dataset: {} }).thirdD20).toBe(false);
  });

  test('Super Specialized: one step up when Specialized on the chosen Skill', async () => {
    const { ruleRollDice } = await import('./adapter.mjs');
    const actor = holder(['mlpcrbitems/_source/Super_Specialized_TuSb6usDweSzf5S9.json']);
    actor.items.contents[0].system.choice = 'alertness';
    expect(ruleRollDice(actor, null, { rolledSkill: 'alertness', dataset: { isSpecialized: true } }).stepUp).toBe(1);
    // Not unless the roll is Specialized, and not on another Skill.
    expect(ruleRollDice(actor, null, { rolledSkill: 'alertness', dataset: { isSpecialized: false } }).stepUp).toBe(0);
    expect(ruleRollDice(actor, null, { rolledSkill: 'might', dataset: { isSpecialized: true } }).stepUp).toBe(0);
    actor.items.contents[0].system.choice = '';
    expect(ruleRollDice(actor, null, { rolledSkill: 'alertness', dataset: { isSpecialized: true } }).stepUp).toBe(0);
  });

  test('Bear Hug: a Grapple attack deals Blunt damage', async () => {
    const { ruleDamageType } = await import('./adapter.mjs');
    const actor = holder(['iafav2items/_source/Bear_Hug_id5IVoPuSC03mKfZ.json']);
    const grapple = { type: 'weaponEffect', flags: {}, system: { classification: {}, damageType: 'grapple' } };
    const blunt = { type: 'weaponEffect', flags: {}, system: { classification: {}, damageType: 'blunt' } };
    expect(ruleDamageType(actor, null, { item: grapple })).toBe('blunt');
    expect(ruleDamageType(actor, null, { item: blunt })).toBeNull();
    expect(ruleDamageType(holder([]), null, { item: grapple })).toBeNull();
  });

  test('Energy Affinity: the chosen Element on attacks of the activated style; Bear Hug still comes first', async () => {
    const { ruleDamageType } = await import('./adapter.mjs');
    const { registerCheck } = await import('./predicate.mjs');
    const { isEnergyAffinityElementAttack } = await import('../helpers/energy-affinity.mjs');
    const { getSceneEpoch } = await import('../helpers/scene-clock.mjs');
    registerCheck('energyAffinityAttack', (actor, option, ctx) => isEnergyAffinityElementAttack(actor, ctx?.item));
    const actor = misc7Holder(['iafav2items/_source/Bear_Hug_id5IVoPuSC03mKfZ.json', 'dditems/_source/Energy_Affinity_DgFY0ZmAtClAobiA.json']);
    const affinity = actor.items.contents[1];
    affinity.flags = { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA' } };
    affinity.system.choice = 'fire';
    const effect = (style, damageType = 'blunt') => ({ type: 'weaponEffect', flags: {}, system: { classification: { style }, damageType } });
    expect(ruleDamageType(actor, null, { item: effect('melee') })).toBeNull();
    actor.flags.essence20.energyAffinityAltered = { epoch: getSceneEpoch(), style: 'melee' };
    expect(ruleDamageType(actor, null, { item: effect('melee') })).toBe('fire');
    expect(ruleDamageType(actor, null, { item: effect('projectile') })).toBeNull();
    expect(ruleDamageType(actor, null, { item: effect('melee', 'grapple') })).toBe('blunt');
  });

  test.each([
    ['Decepticon Directive', 'dditems/_source/Tooth_and_Claw_bHQGteFX7pdnslOx.json'],
    ['Technorganic Secrets', 'tsitems/_source/Tooth_and_Claw_Z4lShGtDBa2zQ5ov.json'],
  ])('Tooth and Claw (%s): an unarmed Alt Mode attack deals the chosen Sharp / Blunt (Sharp if unchosen), ahead of Bear Hug', async (name, file) => {
    const { ruleDamageType } = await import('./adapter.mjs');
    const actor = holder(['iafav2items/_source/Bear_Hug_id5IVoPuSC03mKfZ.json', file], { system: { isTransformed: true } });
    const claw = actor.items.contents[1];
    claw.system.choice = 'blunt';
    const punch = (damageType = 'stun') => ({ type: 'weaponEffect', parent: actor, flags: {}, system: { classification: { style: 'melee' }, damageType } });
    expect(ruleDamageType(actor, null, { item: punch() })).toBe('blunt');
    claw.system.choice = null;
    expect(ruleDamageType(actor, null, { item: punch() })).toBe('sharp');
    expect(ruleDamageType(actor, null, { item: punch('grapple') })).toBe('sharp');
    // The printed Unarmed Combat weapons count as unarmed; any other weapon doesn't.
    const printed = { id: 'fists', type: 'weapon', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy' } }, parent: actor, system: { traits: [] } };
    const sword = { id: 'sword', type: 'weapon', flags: {}, parent: actor, system: { traits: [] } };
    actor.items.contents.push(printed, sword);
    expect(ruleDamageType(actor, null, { item: { ...punch(), flags: { essence20: { parentId: 'fists' } } } })).toBe('sharp');
    expect(ruleDamageType(actor, null, { item: { ...punch(), flags: { essence20: { parentId: 'sword' } } } })).toBeNull();
    actor.system.isTransformed = false;
    expect(ruleDamageType(actor, null, { item: punch() })).toBeNull();
  });

  test('Shatter Resolve: the target\'s Willpower / Cleverness -2 against the holder\'s Deception / Persuasion', () => {
    const attacker = holder(['dditems/_source/Shatter_Resolve_s3rsoMHOjWY9WfLF.json'], { system: sheet() });
    const target = plain();
    const adjust = (who, defense, rolledSkill, on = target) => ruleDefenseAdjust(who, on, defense, { item: null, rolledSkill, difficulty: 10 });
    expect(adjust(attacker, 'willpower', 'deception')).toBe(-2);
    expect(adjust(attacker, 'cleverness', 'persuasion')).toBe(-2);
    expect(adjust(attacker, 'toughness', 'deception')).toBe(0);
    expect(adjust(attacker, 'willpower', 'intimidation')).toBe(0);
    expect(adjust(holder([]), 'willpower', 'deception')).toBe(0);
    // The holder's own Defenses are untouched, on the sheet and when attacked.
    expect(adjust(holder([]), 'willpower', 'deception', attacker)).toBe(0);
    ruleDerived(attacker);
    expect(attacker.system.defenses.willpower.total).toBe(10);
  });

  test('Trustworthy: the holder\'s own Deception can\'t succeed; a Trustworthy target still gets +4 Cleverness', () => {
    const liar = holder(['mlpcrbitems/_source/Trustworthy_oPMDDfBeK9VibPvW.json'], { system: sheet() });
    const adjust = (who, on, defense, rolledSkill) => ruleDefenseAdjust(who, on, defense, { item: null, rolledSkill, difficulty: 10 });
    for (const defense of DEFENSES) {
      expect(adjust(liar, plain(), defense, 'deception')).toBe(Infinity);
    }

    expect(adjust(liar, plain(), 'cleverness', 'persuasion')).toBe(0);
    expect(adjust(holder([]), plain(), 'cleverness', 'deception')).toBe(0);
    const honest = holder(['mlpcrbitems/_source/Trustworthy_oPMDDfBeK9VibPvW.json'], { system: sheet() });
    expect(adjust(holder([]), honest, 'cleverness', 'deception')).toBe(4);
    expect(adjust(liar, honest, 'cleverness', 'deception')).toBe(Infinity);
  });

  describe('on the canvas', () => {
    afterEach(async () => {
      const { setWorldLookups } = await import('./predicate.mjs');
      const { useAllyLookup } = await import('./links.mjs');
      const { LINK_HOLDERS } = await import('./index.mjs');
      setWorldLookups({ alliesWithin: null });
      useAllyLookup(false);
      LINK_HOLDERS.clear();
      delete global.canvas;
    });

    // Tokens at x feet, all on one side; allies counted the system's way (helpers/allies.mjs#getNearbyAllyTokens).
    async function place(entries) {
      const { getNearbyAllyTokens } = await import('../helpers/allies.mjs');
      const { setWorldLookups } = await import('./predicate.mjs');
      const { useAllyLookup } = await import('./links.mjs');
      const tokens = entries.map(([who, x]) => {
        const token = { actor: who, center: { x, y: 0 }, document: { disposition: 1 } };
        who.getActiveTokens = () => [token];
        who.items.find ??= fn => who.items.contents.find(fn);
        return token;
      });
      global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: tokens } };
      setWorldLookups({ alliesWithin: (who, feet) => getNearbyAllyTokens(who, feet).map(token => token.actor) });
      useAllyLookup(true);
    }

    const PAY_IT_FORWARD = 'prcrbitems/_source/Pay_It_Forward_M3pQgNMsU5hU5dMN.json';
    const adjust = (target, defense = 'toughness') => ruleDefenseAdjust(plain(), target, defense, { item: null, difficulty: 10 });

    test('Pay It Forward: +1 to every Defense with a Morphed holder within 10 ft, once however many', async () => {
      const target = holder([], { system: sheet() });
      const giver = holder([PAY_IT_FORWARD], { system: { isMorphed: true } });
      await place([[target, 0], [giver, 10]]);
      expect(DEFENSES.map(defense => adjust(target, defense))).toEqual([1, 1, 1, 1]);
      ruleDerived(target);
      expect(target.system.defenses.toughness.total).toBe(10);
      const second = holder([PAY_IT_FORWARD], { system: { isMorphed: true } });
      await place([[target, 0], [giver, 10], [second, 5]]);
      expect(adjust(target)).toBe(1);
      // Not out of range, not while the holder isn't Morphed, and never for the holder itself.
      await place([[target, 0], [giver, 15]]);
      expect(adjust(target)).toBe(0);
      giver.system.isMorphed = false;
      await place([[target, 0], [giver, 5]]);
      expect(adjust(target)).toBe(0);
      giver.system.isMorphed = true;
      giver.system.defenses = sheet().defenses;
      expect(adjust(giver)).toBe(0);
    });

    test('Not On My Watch: +1 Toughness and Evasion with a Defeated ally within 5 ft', async () => {
      const { registerCheck } = await import('./predicate.mjs');
      const { hasDefeatedAllyInReach } = await import('../helpers/not-on-my-watch.mjs');
      registerCheck('defeatedAllyInReach', hasDefeatedAllyInReach);
      const actor = holder(['iafav2items/_source/Not_On_My_Watch_xH3iQ0NcXp1eFO35.json'], { system: sheet() });
      const ally = holder([], { statuses: ['defeated'] });
      await place([[actor, 0], [ally, 5]]);
      expect(DEFENSES.map(defense => adjust(actor, defense))).toEqual([1, 1, 0, 0]);
      ruleDerived(actor);
      expect(actor.system.defenses.toughness.total).toBe(10);
      await place([[actor, 0], [ally, 10]]);
      expect(adjust(actor)).toBe(0);
      ally.statuses = new Set();
      await place([[actor, 0], [ally, 5]]);
      expect(adjust(actor)).toBe(0);
    });
  });

  describe('Force / Fleeting Energy', () => {
    const FORCE = 'mlpcrbitems/_source/Force_p4qXDtj2RCJcibCh.json';
    const FLEETING_ENERGY = { type: 'hangUp', name: 'Fleeting Energy', flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.PblwqCeE7Zyb3jF4' } } };
    const punch = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } };

    function forceHolder(extra = []) {
      const actor = misc7Holder([FORCE], {}, extra);
      actor.update = async data => {
        for (const [key, value] of Object.entries(data)) {
          const keys = key.split('.');
          const last = keys.pop();
          keys.reduce((o, k) => (o[k] ??= {}), actor)[last] = value;
        }
      };

      return actor;
    }

    test('+1 damage on an unarmed Might attack, once per encounter, banking Fleeting Energy\'s ↓1 on Strength tests', async () => {
      const { bankedSources } = await import('./bank.mjs');
      const actor = forceHolder([FLEETING_ENERGY]);
      const first = ruleScaledDamage(actor, null, { item: punch, rolledSkill: 'might' });
      expect(first).toMatchObject({ amount: 1, sources: ['Force'] });
      await first.spend();
      expect(ruleScaledDamage(actor, null, { item: punch, rolledSkill: 'might' }).amount).toBe(0);
      expect(bankedSources(actor, null, { rolledEssence: 'strength', rolledSkill: 'athletics' }).sources).toEqual([
        expect.objectContaining({ label: 'Fleeting Energy', shiftDown: 1 }),
      ]);
      expect(bankedSources(actor, null, { rolledEssence: 'smarts', rolledSkill: 'alertness' }).sources).toEqual([]);
    });

    test('nothing banked without the Hang-Up; nothing at all on an armed or non-Might attack', async () => {
      const actor = forceHolder();
      const first = ruleScaledDamage(actor, null, { item: punch, rolledSkill: 'might' });
      expect(first.amount).toBe(1);
      await first.spend();
      expect(actor.flags.essence20.ruleBank).toBeUndefined();
      const fresh = forceHolder();
      const armed = { ...punch, flags: { essence20: { parentId: 'w1' } } };
      expect(ruleScaledDamage(fresh, null, { item: armed, rolledSkill: 'might' }).amount).toBe(0);
      expect(ruleScaledDamage(fresh, null, { item: punch, rolledSkill: 'finesse' }).amount).toBe(0);
    });
  });
});

// regC2 batch (dice.mjs, _getAutomaticCombatModifiers to the end, second pass): fumbled / x2 / allFailed Triggers,
// turn order (target:notActed, combat:aheadOfTarget / highestInitiative) and level (levelDiff) tags, Impenetrable
// Shield's check, the Bulwark / Two Steps to the Right Cover auras and Oorah! / Goin' Heels' scaled damage.

describe('regC2', () => {
  const setPath = (object, key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
  };

  /** A holder whose flags and data can be written (Trigger steps, banks, limits). */
  function writable(files, options = {}, extraItems = []) {
    const actor = misc7Holder(files, options, extraItems);
    actor.name = 'Hero';
    actor.isOwner = true;
    actor.unsetFlag = async (scope, key) => {
      delete actor.flags[scope]?.[key];
    };

    actor.update = async data => {
      for (const [key, value] of Object.entries(data)) {
        setPath(actor, key, value);
      }
    };

    return actor;
  }

  /** The dice landed: the system's post-roll hook (rules/triggers.mjs's afterRoll / hit Triggers). */
  async function rolled(actor, results, extra = {}) {
    await import('./triggers.mjs');
    const { runPostRoll } = await import('../helpers/extensions.mjs');
    await runPostRoll(actor, results, {}, { rider: {}, hits: [], ...extra });
  }

  const npc = (system = {}) => ({ type: 'npc', name: 'Foe', flags: {}, statuses: new Set(), items: { contents: [] }, system: { size: 'common', ...system } });
  const weaponEffect = (system = {}, flags = {}) => ({ type: 'weaponEffect', flags, system: { classification: { skill: 'targeting', style: 'projectile' }, damageType: 'ballistic', ...system } });
  const sources = (actor, target, ctx) => ruleRollSources(actor, target, ctx).sources;
  let savedGame;

  beforeEach(() => {
    savedGame = global.game;
    global.game = { ...savedGame, combat: null, user: { targets: new Set() }, settings: { get: () => 1 } };
  });

  afterEach(() => {
    global.game = savedGame;
  });

  test('Cruel Warlord: a Fumble regains 2 Personal Power, never past the maximum', async () => {
    const file = 'fmmcitems/_source/Cruel_Warlord_F3TRKmoaUOtHrlzq.json';
    const actor = writable([file], { system: { powers: { personal: { value: 3, max: 10 } } } });
    await rolled(actor, [{ success: false, multiplier: 0 }], { isFumble: true });
    expect(actor.system.powers.personal.value).toBe(5);
    // A crit that also Fumbled still counts; the cap holds.
    actor.system.powers.personal.value = 9;
    await rolled(actor, [{ success: true, multiplier: 1 }], { isFumble: true, isCrit: true });
    expect(actor.system.powers.personal.value).toBe(10);
    // No Fumble, or no Perk: nothing.
    actor.system.powers.personal.value = 3;
    await rolled(actor, [{ success: false, multiplier: 0 }]);
    expect(actor.system.powers.personal.value).toBe(3);
    const noPerk = writable([], { system: { powers: { personal: { value: 3, max: 10 } } } });
    await rolled(noPerk, [{ success: false, multiplier: 0 }], { isFumble: true });
    expect(noPerk.system.powers.personal.value).toBe(3);
  });

  test('Cost of Sorcery: a Fumble with a Sorcerous Power or Sorcerous weapon loses 1 Health, never below 0', async () => {
    const file = 'fmmcitems/_source/Cost_of_Sorcery_BRpf0FNey5oDEvq3.json';
    const actor = writable([file], { system: { health: { value: 4, max: 10 } } }, [
      { id: 'w1', type: 'weapon', name: 'Staff', system: { traits: ['sorcerous'] } },
      { id: 'w2', type: 'weapon', name: 'Rifle', system: { traits: [] } },
      { id: 'p1', type: 'power', name: 'Arcane Bolt', system: { type: 'sorcerous' } },
      { id: 'p2', type: 'power', name: 'Shield', system: { type: 'personal' } },
    ]);
    const roll = async (item, extra = { isFumble: true }) => {
      globalThis.fromUuidSync = () => item;
      await rolled(actor, [{ success: false, multiplier: 0 }], { rider: { itemUuid: 'x' }, ...extra });
    };

    try {
      await roll(actor.items.get('p1'));
      expect(actor.system.health.value).toBe(3);
      await roll({ ...weaponEffect(), parent: actor, flags: { essence20: { parentId: 'w1' } } });
      expect(actor.system.health.value).toBe(2);
      // Not a Fumble, a non-Sorcerous Power or weapon: nothing.
      await roll(actor.items.get('p1'), {});
      await roll(actor.items.get('p2'));
      await roll({ ...weaponEffect(), parent: actor, flags: { essence20: { parentId: 'w2' } } });
      expect(actor.system.health.value).toBe(2);
      actor.system.health.value = 0;
      await roll(actor.items.get('p1'));
      expect(actor.system.health.value).toBe(0);
    } finally {
      delete globalThis.fromUuidSync;
    }
  });

  test('Barreling Beam: a hit by double the DIF knocks the target Prone', async () => {
    const actor = writable(['mlpcrbitems/_source/Barreling_Beam_FpQsQ0FCBFGHThQV.json']);
    const spell = actor.items.contents[0];
    const toggled = [];
    const target = { name: 'Foe', isOwner: true, statuses: new Set(), toggleStatusEffect: async (...args) => toggled.push(args) };
    const hit = async (result, item = spell) => {
      globalThis.fromUuidSync = () => item;
      await rolled(actor, [result], { rider: { itemUuid: 'x' }, hits: [{ target, hit: result.success, result }] });
    };

    try {
      await hit({ success: true, multiplier: 1 });
      await hit({ success: false, multiplier: 0 });
      // Another item's x2 hit doesn't count.
      await hit({ success: true, multiplier: 2 }, { id: 'other', type: 'spell', flags: {}, system: {} });
      expect(toggled).toEqual([]);
      await hit({ success: true, multiplier: 2 });
      expect(toggled).toEqual([['prone', { active: true }]]);
    } finally {
      delete globalThis.fromUuidSync;
    }
  });

  test('Mistrustful: a failed Alertness test banks a Snag on the next Skill Test (not Initiative)', async () => {
    const actor = writable(['ccitems/_source/Mistrustful_sQ00MnGryA2GNzHF.json']);
    await rolled(actor, [{ success: false, multiplier: 0 }], { rider: { skill: 'athletics' } });
    await rolled(actor, [{ success: true, multiplier: 1 }], { rider: { skill: 'alertness' } });
    expect(sources(actor, null, { rolledSkill: 'science' })).toEqual([]);
    await rolled(actor, [{ success: false, multiplier: 0 }], { rider: { skill: 'alertness' } });
    expect(sources(actor, null, { rolledSkill: 'science', dataset: { isInitiative: true } })).toEqual([]);
    const out = ruleRollSources(actor, null, { rolledSkill: 'science', dataset: {} });
    expect(out.sources).toEqual([expect.objectContaining({ snag: true, label: 'Mistrustful' })]);
    const { consumeBanked } = await import('./bank.mjs');
    for (const consume of out.consumes) {
      await consumeBanked(consume, async () => actor);
    }

    expect(sources(actor, null, { rolledSkill: 'science', dataset: {} })).toEqual([]);
  });

  test('Percussive Maintenance: a Technology test by double the DIF banks an Edge on the next Technology test', async () => {
    const actor = writable(['tsitems/_source/Percussive_Maintenance_qZ7QX3nEt6C1blcj.json']);
    await rolled(actor, [{ success: true, multiplier: 1 }], { rider: { skill: 'technology' } });
    await rolled(actor, [{ success: true, multiplier: 2 }], { rider: { skill: 'science' } });
    expect(sources(actor, null, { rolledSkill: 'technology', dataset: {} })).toEqual([]);
    await rolled(actor, [{ success: true, multiplier: 2 }], { rider: { skill: 'technology' } });
    expect(sources(actor, null, { rolledSkill: 'science', dataset: {} })).toEqual([]);
    const out = ruleRollSources(actor, null, { rolledSkill: 'technology', dataset: {} });
    expect(out.sources).toEqual([expect.objectContaining({ edge: true, label: 'Percussive Maintenance' })]);
    const { consumeBanked } = await import('./bank.mjs');
    for (const consume of out.consumes) {
      await consumeBanked(consume, async () => actor);
    }

    expect(sources(actor, null, { rolledSkill: 'technology', dataset: {} })).toEqual([]);
    // Without the Perk, nothing is banked.
    const noPerk = writable([]);
    await rolled(noPerk, [{ success: true, multiplier: 2 }], { rider: { skill: 'technology' } });
    expect(sources(noPerk, null, { rolledSkill: 'technology', dataset: {} })).toEqual([]);
  });

  test('Brrrrrrrrrrrrrrt: a Multiple Targets attack banks ↑1 on every ally, hit or miss, once per encounter', async () => {
    const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
    const { isMultipleTargetsWeapon } = await import('../helpers/multiple-targets.mjs');
    registerCheck('multipleTargetsWeapon', (actor, option, ctx) => (ctx?.item ? isMultipleTargetsWeapon(actor, ctx.item) : null));
    const actor = writable(['gijcrbitems/_source/Brrrrrrrrrrrrrrt_U3NTi35bk2qI8oB6.json'], {}, [
      { id: 'w1', type: 'weapon', name: 'Minigun', system: { traits: ['multipleTargets'], itemAndUpgradeTraits: ['multipleTargets'] } },
      { id: 'w2', type: 'weapon', name: 'Rifle', system: { traits: [], itemAndUpgradeTraits: [] } },
    ]);
    const ally = writable([]);
    const asked = [];
    setWorldLookups({ alliesWithin: (who, feet) => (asked.push(feet), who === actor ? [ally] : []) });
    const attack = async parentId => {
      globalThis.fromUuidSync = () => ({ ...weaponEffect(), parent: actor, flags: { essence20: { parentId } } });
      await rolled(actor, [{ success: false, multiplier: 0 }], { rider: { itemUuid: 'x' } });
    };

    try {
      await attack('w2');
      expect(sources(ally, null, { rolledSkill: 'athletics', dataset: {} })).toEqual([]);
      await attack('w1');
      expect(asked.every(feet => feet >= 100000)).toBe(true);
      const out = ruleRollSources(ally, null, { rolledSkill: 'athletics', dataset: {} });
      expect(out.sources).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Brrrrrrrrrrrrrrt' })]);
      expect(sources(ally, null, { rolledSkill: 'athletics', dataset: { isInitiative: true } })).toEqual([]);
      const { consumeBanked } = await import('./bank.mjs');
      for (const consume of out.consumes) {
        await consumeBanked(consume, async () => ally);
      }

      // Used for the encounter: a second qualifying attack banks nothing more.
      await attack('w1');
      expect(sources(ally, null, { rolledSkill: 'athletics', dataset: {} })).toEqual([]);
    } finally {
      delete globalThis.fromUuidSync;
      setWorldLookups({ alliesWithin: null });
    }
  });

  test('First Strike: Edge on any roll against an opponent whose turn comes later this round', () => {
    const actor = holder(['gijcrbitems/_source/First_Strike_qxqtfBobduwSkfRM.json']);
    const foe = npc();
    const edge = (ctx = {}) => sources(actor, foe, ctx).some(source => source.edge);
    const mine = { actor };
    const theirs = { actor: foe };
    game.combat = { turn: 0, turns: [mine, theirs], combatants: [mine, theirs] };
    expect(edge({ item: weaponEffect() })).toBe(true);
    expect(edge({ rolledSkill: 'persuasion' })).toBe(true);
    expect(sources(actor, foe, {})[0].label).toContain('First Strike');
    // Their turn now (or already past), no combat, no target, no Perk.
    game.combat.turn = 1;
    expect(edge()).toBe(false);
    game.combat = { turn: 1, turns: [theirs, mine], combatants: [theirs, mine] };
    expect(edge()).toBe(false);
    game.combat = null;
    expect(edge()).toBe(false);
    game.combat = { turn: 0, turns: [mine, theirs], combatants: [mine, theirs] };
    expect(sources(actor, null, {})).toEqual([]);
    expect(sources(holder([]), foe, {})).toEqual([]);
    expect(switchNames(actor, {})).toEqual([]);
  });

  test('Hierarchy Rank: ↑1 against a lower level (or Threat Level), ↓1 against a higher one', () => {
    const actor = holder(['iafav2items/_source/Hierarchy_Rank_J9XS0xqlSQwkEwll.json'], { system: { level: 5 } });
    const shifts = target => sources(actor, target, { rolledSkill: 'persuasion' }).map(source => [source.shiftUp, source.shiftDown]);
    expect(shifts(npc({ threatLevel: 3 }))).toEqual([[1, 0]]);
    expect(shifts(npc({ level: 8 }))).toEqual([[0, 1]]);
    expect(shifts(npc({ level: 5 }))).toEqual([]);
    expect(shifts(null)).toEqual([]);
    expect(sources(holder([], { system: { level: 5 } }), npc({ level: 1 }), {})).toEqual([]);
    expect(switchNames(actor, {})).toEqual([]);
  });

  test('Grid Soldier: ↑1 against a target at least 3 levels (or Threat Levels) lower', () => {
    const actor = holder(['jttitems/_source/Grid_Soldier_y9F6PkCIw7g6tiqL.json'], { system: { level: 8 } });
    expect(regCUp(actor, npc({ threatLevel: 5 }), { rolledSkill: 'athletics' })).toBe(1);
    expect(regCUp(actor, npc({ level: 2 }), { item: weaponEffect() })).toBe(1);
    expect(regCUp(actor, npc({ level: 6 }), { rolledSkill: 'athletics' })).toBe(0);
    expect(regCUp(actor, null, { rolledSkill: 'athletics' })).toBe(0);
    expect(regCUp(holder([], { system: { level: 8 } }), npc({ level: 1 }), {})).toBe(0);
  });

  test('Just The Facts: Deception from a higher level takes a Snag; from the same level or lower it cannot succeed', () => {
    const defender = holder(['tfcrbitems/_source/Just_The_Facts_v6A7mQwdKQR6J5fR.json'], { system: { level: 5 } });
    const deceiver = level => holder([], { system: { level } });
    const snag = (attacker, skill = 'deception') => sources(attacker, defender, { rolledSkill: skill }).some(source => source.snag);
    expect(snag(deceiver(7))).toBe(true);
    expect(sources(deceiver(7), defender, { rolledSkill: 'deception' })[0].label).toContain('Just The Facts');
    expect(snag(deceiver(5))).toBe(false);
    expect(snag(deceiver(7), 'persuasion')).toBe(false);
    // The Immune half: an unbeatable difficulty, per target, against your level or lower.
    const adjust = (attacker, skill = 'deception') => ruleDefenseAdjust(attacker, defender, 'cleverness', { rolledSkill: skill, difficulty: 12 });
    expect(adjust(deceiver(5))).toBe(Infinity);
    expect(adjust(deceiver(2))).toBe(Infinity);
    expect(adjust(deceiver(7))).toBe(0);
    expect(adjust(deceiver(2), 'persuasion')).toBe(0);
    // Without the Perk, nothing.
    expect(ruleDefenseAdjust(deceiver(2), holder([], { system: { level: 5 } }), 'cleverness', { rolledSkill: 'deception', difficulty: 12 })).toBe(0);
  });

  test('Impenetrable Shield: attacks other than EMP against the holder take a Snag while the Personal Shield is up', async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { isPersonalShieldActive } = await import('../helpers/personal-shield.mjs');
    registerCheck('personalShield', actor => isPersonalShieldActive(actor));
    const defender = holder(['gijcrbitems/_source/Impenetrable_Shield_eEUl7OA9yWAk0QD3.json']);
    let active = true;
    defender._getBaseRolePoints = () => ({ flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge' } }, system: { isActive: active } });
    const attacker = holder([]);
    const snag = ctx => sources(attacker, defender, ctx).some(source => source.snag);
    expect(snag({ item: weaponEffect({ damageType: 'fire' }) })).toBe(true);
    expect(snag({ item: weaponEffect({ damageType: 'emp' }) })).toBe(false);
    expect(snag({ rolledSkill: 'persuasion' })).toBe(false);
    active = false;
    expect(snag({ item: weaponEffect({ damageType: 'fire' }) })).toBe(false);
    // The holder's own attacks are untouched.
    active = true;
    expect(sources(defender, attacker, { item: weaponEffect({ damageType: 'fire' }) })).toEqual([]);
  });

  describe("Goin' Heels / Oorah!", () => {
    const GOIN_HEELS = 'jttitems/_source/Goin__Heels_8QaqczkkaPaUivEC.json';
    const OORAH = 'sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json';
    const sidearm = (numHands = 1) => ({ id: 'w1', type: 'weapon', name: 'Pistol', system: { classification: { skill: 'targeting', size: 'sidearm' }, numHands } });

    test("Goin' Heels: a one-handed Targeting Sidearm attack gets ↑1 against a lower Initiative, +1 damage while highest", () => {
      const make = (weapon = sidearm()) => misc7Holder([GOIN_HEELS], {}, [weapon]);
      const actor = make();
      const foe = npc();
      const other = { actor: npc(), initiative: null };
      const shot = { ...weaponEffect(), parent: actor, flags: { essence20: { parentId: 'w1' } } };
      game.combat = { combatants: [{ actor, initiative: 15 }, { actor: foe, initiative: 5 }, other] };
      expect(regCUp(actor, foe, { item: shot })).toBe(1);
      expect(ruleScaledDamage(actor, foe, { item: shot })).toMatchObject({ amount: 1, sources: ["Goin' Heels"] });
      // Ties for highest still count for the damage; the ↑1 needs a strictly higher Initiative.
      game.combat.combatants[1].initiative = 15;
      expect(regCUp(actor, foe, { item: shot })).toBe(0);
      expect(ruleScaledDamage(actor, foe, { item: shot }).amount).toBe(1);
      // Someone else higher: no damage; ahead of this target still gives the ↑1.
      game.combat.combatants[1].initiative = 5;
      other.initiative = 20;
      expect(regCUp(actor, foe, { item: shot })).toBe(1);
      expect(ruleScaledDamage(actor, foe, { item: shot }).amount).toBe(0);
      other.initiative = null;
      // No target, no combat, the wrong weapon, a two-handed one, or unarmed: nothing.
      expect(ruleScaledDamage(actor, null, { item: shot }).amount).toBe(0);
      expect(regCUp(actor, null, { item: shot })).toBe(0);
      const twoHanded = make(sidearm(2));
      const twoHandedShot = { ...shot, parent: twoHanded };
      expect(regCUp(twoHanded, foe, { item: twoHandedShot })).toBe(0);
      expect(ruleScaledDamage(twoHanded, foe, { item: twoHandedShot }).amount).toBe(0);
      expect(regCUp(actor, foe, { item: weaponEffect() })).toBe(0);
      game.combat = null;
      expect(regCUp(actor, foe, { item: shot })).toBe(0);
      expect(ruleScaledDamage(actor, foe, { item: shot }).amount).toBe(0);
    });

    test('Oorah!: +1 damage on an attack against a target that has not acted yet this round', () => {
      const actor = holder([OORAH]);
      const foe = npc();
      const mine = { actor };
      const theirs = { actor: foe };
      game.combat = { turn: 0, turns: [mine, theirs], combatants: [mine, theirs] };
      expect(ruleScaledDamage(actor, foe, { item: weaponEffect() })).toMatchObject({ amount: 1, sources: ['Oorah!'] });
      expect(ruleScaledDamage(actor, foe, { rolledSkill: 'persuasion' }).amount).toBe(0);
      game.combat.turn = 1;
      expect(ruleScaledDamage(actor, foe, { item: weaponEffect() }).amount).toBe(0);
      game.combat = null;
      expect(ruleScaledDamage(actor, foe, { item: weaponEffect() }).amount).toBe(0);
      expect(ruleScaledDamage(holder([]), foe, { item: weaponEffect() }).amount).toBe(0);
    });
  });

  describe('Cover auras', () => {
    const place = (actor, x, disposition = 1) => {
      const token = { actor, center: { x, y: 0 }, document: { disposition } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    const onCanvas = placed => {
      global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: placed.map(([actor, x, d]) => place(actor, x, d)) } };
    };

    afterEach(async () => {
      const { useAllyLookup } = await import('./links.mjs');
      const { setWorldLookups } = await import('./predicate.mjs');
      useAllyLookup(false);
      setWorldLookups({ alliesWithin: null });
      delete global.canvas;
    });

    test('Bulwark: a target within 5 ft of a planted holder (either side) counts as in Cover against ranged attacks', () => {
      const file = 'gijcrbitems/_source/Bulwark_7758n3XWOzhSjdOk.json';
      const attacker = holder([]);
      const target = holder([]);
      const tank = misc7Holder([file]);
      tank.flags.essence20.bulwarkActive = true;
      const ranged = { item: weaponEffect() };
      onCanvas([[attacker, 50], [target, 0], [tank, 5, -1]]);
      expect(ruleCover(attacker, target, ranged).grant).toBe(true);
      // Beyond 5 ft, not planted, or the holder itself.
      onCanvas([[attacker, 50], [target, 0], [tank, 10]]);
      expect(ruleCover(attacker, target, ranged).grant).toBe(false);
      onCanvas([[attacker, 50], [target, 0], [tank, 5]]);
      tank.flags.essence20.bulwarkActive = false;
      expect(ruleCover(attacker, target, ranged).grant).toBe(false);
      tank.flags.essence20.bulwarkActive = true;
      expect(ruleCover(attacker, tank, ranged).grant).toBe(false);
      // Melee attacks never ask (dice.mjs passes no actors for them).
      expect(ruleCover(null, null, { item: weaponEffect({ classification: { style: 'melee' } }) }).grant).toBe(false);
    });

    test('Two Steps to the Right: an ally within 60 ft of a holder reduces Cover by 1, not stacking', async () => {
      const { useAllyLookup } = await import('./links.mjs');
      const { setWorldLookups } = await import('./predicate.mjs');
      const file = 'eocitems/_source/Two_Steps_to_the_Right_a5xcpj3rHW5EW354.json';
      const attacker = holder([]);
      const target = holder([]);
      const surveyor = holder([file]);
      const second = holder([file]);
      onCanvas([[attacker, 0], [target, 100, -1], [surveyor, 20], [second, 30]]);
      let near = [surveyor, second];
      const asked = [];
      setWorldLookups({ alliesWithin: (actor, feet) => (asked.push(feet), actor === attacker ? near : []) });
      useAllyLookup(true);
      expect(ruleCover(attacker, target, { item: weaponEffect() }).reduce).toBe(1);
      expect(asked).toContain(60);
      // No holder in reach, or the holder's own attack.
      near = [];
      expect(ruleCover(attacker, target, { item: weaponEffect() }).reduce).toBe(0);
      expect(ruleCover(surveyor, target, { item: weaponEffect() }).reduce).toBe(0);
    });
  });
});

// slA zord

describe('slA zord: Forms, Zord Features and Alt Modes from the zord1/zord2 slices', () => {
  const OPERATOR = 'Compendium.essence20.jump_through_time.Item.nZYtfaowY0EH3Z0R';
  const BEAST = 'Compendium.essence20.beneath_the_helmet.Item.8FGJyvGaCOd8hrSA';
  const TIME_FORCE = 'Compendium.essence20.jump_through_time.Item.DHTCWLVAKNmtm2iu';
  const SUPERSONIC = 'Compendium.essence20.across_the_stars.Item.Ylo4AY4LCHTXjuuE';

  test('Ranger Operator: +2 Toughness in place of the Morphed armor bonus, ↑1 on Driving and Survival', () => {
    const file = 'jttitems/_source/Ranger_Operator_nZYtfaowY0EH3Z0R.json';
    const defenses = () => ({ ...pass2Defenses(), toughness: { total: 16, morphed: 3, string: '16' } });
    const operator = holder([file], { system: { isMorphed: true, defenses: defenses() } });
    operator.flags = formFlags(OPERATOR);
    ruleDerived(operator);
    expect(operator.system.defenses.toughness.total).toBe(15);
    expect(operator.system.defenses.evasion.total).toBe(13);
    for (const skill of ['driving', 'survival']) {
      expect(ruleRollSources(operator, null, { rolledSkill: skill }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    }

    expect(ruleRollSources(operator, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    // Un-Morphed, or another Form active: nothing.
    const unmorphed = holder([file], { system: { isMorphed: false, defenses: defenses() } });
    unmorphed.flags = formFlags(OPERATOR);
    ruleDerived(unmorphed);
    expect(unmorphed.system.defenses.toughness.total).toBe(16);
    expect(ruleRollSources(unmorphed, null, { rolledSkill: 'driving' }).sources).toEqual([]);
    const other = holder([file], { system: { isMorphed: true, defenses: defenses() } });
    other.flags = formFlags(SUPERSONIC);
    expect(ruleRollSources(other, null, { rolledSkill: 'driving' }).sources).toEqual([]);
  });

  test('Beast Morpher: Gorilla ↑2 Brawn and +2 Health, Jackrabbit jump switch', () => {
    const file = 'bthitems/_source/Beast_Morpher__Form__8FGJyvGaCOd8hrSA.json';
    const morpher = beast => {
      const actor = holder([file], { system: { isMorphed: true, health: { max: 5 }, defenses: pass2Defenses() } });
      actor.flags = formFlags(BEAST);
      actor.items.contents[0].flags = { essence20: { zord1Beast: beast } };
      rebuildIndex(actor);
      return actor;
    };

    const cheetah = morpher('cheetah');
    cheetah.system.movement = { ground: { total: 30 } };
    ruleDerived(cheetah);
    expect(cheetah.system.movement.ground.total).toBe(50);
    expect(cheetah.system.health.max).toBe(5);

    const gorilla = morpher('gorilla');
    gorilla.system.movement = { ground: { total: 30 } };
    ruleDerived(gorilla);
    expect(gorilla.system.movement.ground.total).toBe(30);
    expect(gorilla.system.health.max).toBe(7);
    expect(ruleRollSources(gorilla, null, { rolledSkill: 'brawn' }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(ruleRollSources(gorilla, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(switchNames(gorilla, { rolledSkill: 'athletics' })).toEqual([]);

    const rabbit = morpher('jackrabbit');
    ruleDerived(rabbit);
    expect(rabbit.system.health.max).toBe(5);
    expect(ruleRollSources(rabbit, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
    const [jump] = ruleDialogSwitches(rabbit, { rolledSkill: 'athletics' });
    expect(jump).toMatchObject({ label: 'Jumping (Jackrabbit: Edge, Specialized)', value: false });
    expect(tick(rabbit, { rolledSkill: 'athletics' })).toMatchObject({ edge: true, isSpecialized: true });
    expect(switchNames(rabbit, { rolledSkill: 'acrobatics' })).toEqual([]);

    // Not the active Form: nothing.
    gorilla.flags = formFlags(OPERATOR);
    expect(ruleRollSources(gorilla, null, { rolledSkill: 'brawn' }).sources).toEqual([]);
  });

  test('Ninja Storm Wind Ranger: Ground Movement doubled while the Form is active', () => {
    const ninja = holder(['bthitems/_source/Ninja_Storm_Wind_Ranger__Form__Txv1ODlLKY91hPrA.json'], { system: { isMorphed: true, movement: { ground: { total: 30 } } } });
    ruleDerived(ninja);
    expect(ninja.system.movement.ground.total).toBe(30);
    ninja.flags = formFlags('Compendium.essence20.beneath_the_helmet.Item.Txv1ODlLKY91hPrA');
    ruleDerived(ninja);
    expect(ninja.system.movement.ground.total).toBe(60);
  });

  test('Time Force: an Edge switch, ticked when the Specialization is about time travel', () => {
    const actor = holder(['jttitems/_source/Time_Force_DHTCWLVAKNmtm2iu.json'], {
      system: { isMorphed: true, skills: { science: { specializations: { s1: { name: 'Chronometry' }, s2: { name: 'Robotics' } } } } },
    });
    actor.flags = formFlags(TIME_FORCE);
    const switches = ctx => ruleDialogSwitches(actor, ctx).map(({ label, value }) => ({ label, value }));
    const label = 'Time-travel Specialization (Time Force: Edge)';
    expect(switches({ rolledSkill: 'science', dataset: { specializationKey: 's1' } })).toEqual([{ label, value: true }]);
    expect(switches({ rolledSkill: 'science', dataset: { specializationKey: 's2' } })).toEqual([{ label, value: false }]);
    expect(switches({ rolledSkill: 'science', dataset: {} })).toEqual([{ label, value: false }]);
    expect(tick(actor, { rolledSkill: 'science', dataset: {} })).toMatchObject({ edge: true });
    expect(switches({ rolledSkill: 'targeting', dataset: {}, item: { type: 'weaponEffect', system: {} } })).toEqual([]);
    actor.system.isMorphed = false;
    expect(switches({ rolledSkill: 'science', dataset: {} })).toEqual([]);
  });

  test('Supersonic: an Edge against the Xenotech weapon Snag, unless the weapon was critted', () => {
    const actor = holder(['atsitems/_source/Supersonic__Form__Ylo4AY4LCHTXjuuE.json'], { system: { isMorphed: true } });
    actor.flags = formFlags(SUPERSONIC);
    const weapon = { id: 'w1', type: 'weapon', name: 'Xeno Rifle', flags: {}, system: { traits: ['xenotech'] }, parent: actor };
    const effect = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { classification: { style: 'projectile' } }, parent: actor };
    actor.items.contents.push(weapon, effect);
    const roll = { item: effect, isAttack: true, isMelee: false };
    expect(ruleRollSources(actor, null, roll).sources).toEqual([expect.objectContaining({ edge: true, label: 'No Xenotech weapon penalty (Supersonic: Edge)' })]);
    weapon.flags = { essence20: { xenotechCritted: true } };
    expect(ruleRollSources(actor, null, roll).sources).toEqual([]);
    weapon.flags = {};
    weapon.system.traits = [];
    expect(ruleRollSources(actor, null, roll).sources).toEqual([]);
  });

  test('Megafauna: melee ↑1 and +3 Evasion while the Zord is in its Megafauna Form', () => {
    const zord = holder(['atsitems/_source/Megafauna_c6plguiUVmJzGNsw.json'], { system: { defenses: pass2Defenses() } });
    zord.type = 'zord';
    zord.flags = { essence20: { zord1Megafauna: true } };
    ruleDerived(zord);
    expect(zord.system.defenses.evasion.total).toBe(14);
    expect(ruleRollSources(zord, null, { isAttack: true, isMelee: true }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(ruleRollSources(zord, null, { isAttack: true, isMelee: false }).sources).toEqual([]);
    zord.flags.essence20.zord1Megafauna = false;
    zord.system.defenses = pass2Defenses();
    ruleDerived(zord);
    expect(zord.system.defenses.evasion.total).toBe(11);
    expect(ruleRollSources(zord, null, { isAttack: true, isMelee: true }).sources).toEqual([]);
    // Only on a Zord.
    zord.type = 'playerCharacter';
    zord.flags.essence20.zord1Megafauna = true;
    expect(ruleRollSources(zord, null, { isAttack: true, isMelee: true }).sources).toEqual([]);
  });

  test('Hybridization (Fast Shift): Mass Shift costs a Free action', async () => {
    const { costRulesFor } = await import('./actions.mjs');
    const actor = holder(['tfcrbitems/_source/Hybridization_R5SobOsimfa7mvdy.json']);
    const massShift = { type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.0JiAkBjJzsuezfaI' } } };
    const offers = ctx => costRulesFor(actor).filter(rule => rule.matches(ctx));
    expect(offers({ kind: 'item', item: massShift })).toEqual([]);
    actor.items.contents[0].flags = { essence20: { zord2Hybrid: 'fastShift' } };
    rebuildIndex(actor);
    const [rule] = offers({ kind: 'item', item: massShift });
    expect(rule.to('move')).toBe('free');
    expect(offers({ kind: 'item', item: { type: 'perk', flags: {} } })).toEqual([]);
  });

  test.each([
    ['tsitems/_source/Primate__Common__Kj8DtQoNrUf2dmI5.json'],
    ['tsitems/_source/Primate__Large__yeeGDdU2LDKyNhBd.json'],
  ])('%s: Climb at least 30 ft in that Alt Mode', file => {
    const actor = holder([file], { system: { isTransformed: true, movement: { climb: { total: 25 }, ground: { total: 50 } } } });
    actor.system.altModeId = actor.items.contents[0].id;
    ruleDerived(actor);
    expect(actor.system.movement.climb.total).toBe(30);
    actor.system.movement.climb.total = 40;
    ruleDerived(actor);
    expect(actor.system.movement.climb.total).toBe(40);
    actor.system.isTransformed = false;
    actor.system.movement.climb.total = 25;
    ruleDerived(actor);
    expect(actor.system.movement.climb.total).toBe(25);
  });

  test.each([
    ['tsitems/_source/Carapaced__Common__aTevGfLML1dlbErs.json'],
    ['tsitems/_source/Carapaced__Large__2mSP6mVx0axvOlXf.json'],
  ])('%s: Underground 25 ft in that Alt Mode when picked', file => {
    const actor = holder([file], { system: { isTransformed: true, movement: { burrow: { total: 0 }, ground: { total: 40 } } } });
    const altMode = actor.items.contents[0];
    actor.system.altModeId = altMode.id;
    ruleDerived(actor);
    expect(actor.system.movement.burrow.total).toBe(0);
    altMode.flags = { essence20: { zord2CarapacedChoice: 'burrow' } };
    rebuildIndex(actor);
    ruleDerived(actor);
    expect(actor.system.movement).toMatchObject({ burrow: { total: 25 }, ground: { total: 40 } });
  });
});

// slA pr1

describe('slA pr1', () => {
  const dinoFile = 'bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json';
  const lightspeedFile = 'atsitems/_source/Lightspeed_Boost_sap5gMPDrWvjLCCu.json';

  /** A Zord holding the feature with this pick (its flag), and a driver and a passenger seated in it. */
  function seatedZord(file, flags) {
    const zord = holder([file]);
    Object.assign(zord, { type: 'zord', uuid: `Actor.slA${zord.id}` });
    zord.items.contents[0].flags = { essence20: flags };
    const pilot = holder([]);
    const rider = holder([]);
    pilot.uuid = `Actor.slA${pilot.id}`;
    rider.uuid = `Actor.slA${rider.id}`;
    zord.system.actors = { a: { uuid: pilot.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid, vehicleRole: 'passenger' } };
    rebuildIndex(zord);
    game.actors = { contents: [pilot, rider, zord] };
    return { zord, pilot, rider };
  }

  afterEach(() => {
    game.actors = undefined;
    delete global.ChatMessage;
  });

  test('Chronicler: a switch on non-attack rolls; a failed roll with it ticked leaves the holder Impaired', async () => {
    const { fireTriggers } = await import('./triggers.mjs');
    const actor = holder(['jttitems/_source/Chronicler_Psds3JLg4UmugRkT.json']);
    const toggled = [];
    actor.toggleStatusEffect = async (...args) => toggled.push(args);
    actor.isOwner = true;
    global.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
    expect(ruleDialogSwitches(actor, { rolledSkill: 'culture' })).toEqual([expect.objectContaining({ value: false })]);
    expect(switchNames(actor, { item: { type: 'weaponEffect', system: {}, flags: {} } })).toEqual([]);
    const options = tick(actor, { rolledSkill: 'culture' });
    expect(options.ruleKeys).toEqual(['chronicler']);
    expect([options.shiftUp, options.shiftDown, !!options.edge, !!options.snag]).toEqual([0, 0, false, false]);

    const failed = { results: [{ success: false }, { success: false }] };
    await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'culture', switches: [] }, outcome: 'failure', facts: failed });
    expect(toggled).toEqual([]);
    await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'culture', switches: ['chronicler'] }, outcome: 'success', facts: { results: [{ success: false }, { success: true }] } });
    expect(toggled).toEqual([]);
    await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'culture', switches: ['chronicler'] }, outcome: 'failure', facts: failed });
    expect(toggled).toEqual([['impaired', { active: true }]]);
  });

  test('Advanced Dino Gem Integration: Sense and Stealth ↑2 for the Zord and its driver', () => {
    const { zord, pilot, rider } = seatedZord(dinoFile, { pr1DinoGem: 'sense' });
    expect(ruleRollSources(pilot, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ label: 'Advanced Dino Gem Integration', shiftUp: 2 })]);
    expect(ruleRollSources(zord, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(ruleRollSources(rider, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
    zord.items.contents[0].flags.essence20.pr1DinoGem = 'stealth';
    expect(ruleRollSources(pilot, null, { rolledSkill: 'infiltration' }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(ruleRollSources(zord, null, { rolledSkill: 'infiltration' }).sources).toEqual([expect.objectContaining({ shiftUp: 2 })]);
    expect(ruleRollSources(pilot, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    // Not chosen yet: nothing.
    delete zord.items.contents[0].flags.essence20.pr1DinoGem;
    expect(ruleRollSources(zord, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  });

  test('Advanced Dino Gem Integration: two copies with the same pick still give one ↑2', () => {
    const zord = holder([dinoFile, dinoFile]);
    zord.type = 'zord';
    for (const feature of zord.items.contents) {
      feature.flags = { essence20: { pr1DinoGem: 'sense' } };
    }

    expect(ruleRollSources(zord, null, { rolledSkill: 'alertness' }).sources).toHaveLength(1);
  });

  test('Advanced Dino Gem Integration: Dino Shield puts a Snag on ranged attacks at the Zord', () => {
    const zord = holder([dinoFile]);
    zord.type = 'zord';
    zord.items.contents[0].flags = { essence20: { pr1DinoGem: 'shield' } };
    const attacker = holder([]);
    const attack = style => ({ item: { type: 'weaponEffect', flags: {}, system: { classification: { style } } }, isAttack: true, isMelee: style == 'melee' });
    expect(ruleRollSources(attacker, zord, attack('energy')).sources).toEqual([expect.objectContaining({ label: 'Advanced Dino Gem Integration', snag: true })]);
    expect(ruleRollSources(attacker, zord, attack('melee')).sources).toEqual([]);
    expect(ruleRollSources(attacker, zord, { rolledSkill: 'athletics' }).sources).toEqual([]);
    zord.items.contents[0].flags.essence20.pr1DinoGem = 'sense';
    expect(ruleRollSources(attacker, zord, attack('energy')).sources).toEqual([]);
  });

  test('Lightspeed Boost (Medical): ↑2 on Science and Technology for the Zord and everyone seated in it', () => {
    const { zord, pilot, rider } = seatedZord(lightspeedFile, { pr1LightspeedBoost: { option: 'medical' } });
    for (const who of [zord, pilot, rider]) {
      expect(ruleRollSources(who, null, { rolledSkill: 'science' }).sources).toEqual([expect.objectContaining({ label: 'Medical (Lightspeed Boost: ↑2)', shiftUp: 2 })]);
      expect(ruleRollSources(who, null, { rolledSkill: 'technology' }).sources).toHaveLength(1);
      expect(ruleRollSources(who, null, { rolledSkill: 'culture' }).sources).toEqual([]);
    }

    expect(ruleRollSources(holder([]), null, { rolledSkill: 'science' }).sources).toEqual([]);
    zord.items.contents[0].flags.essence20.pr1LightspeedBoost = { option: 'aeronautic' };
    expect(ruleRollSources(pilot, null, { rolledSkill: 'science' }).sources).toEqual([]);
    expect(ruleRollSources(zord, null, { rolledSkill: 'science' }).sources).toEqual([]);
  });
});

// slA pr2/pr3
describe('slA pr2/pr3', () => {
  test('Keen Eye: Edge on Alertness rolled with a Perception Specialization only', () => {
    const specializations = { a: { name: 'Perception' }, b: { name: 'Investigation' } };
    const actor = holder(['prcrbitems/_source/Keen_Eye_Z4YwTrUSDQIrDkQT.json'], { system: { skills: { alertness: { specializations } } } });
    const edges = (rolledSkill, dataset) => ruleRollSources(actor, null, { rolledSkill, dataset }).sources.filter(s => s.edge);
    expect(edges('alertness', { specializationKey: 'a' })).toHaveLength(1);
    expect(edges('alertness', { specializationKey: 'b' })).toEqual([]);
    expect(edges('alertness', {})).toEqual([]);
    expect(edges('science', { specializationKey: 'a' })).toEqual([]);
  });

  test('Unique Weapon (Versatile Melee): ↑2 against targets at least 3 sizes larger, counted once', () => {
    const actor = holder([
      'prcrbitems/_source/Unique_Weapon_Versatile_Melee_Might_Effect_Pr3UniqEffVersMt.json',
      'prcrbitems/_source/Unique_Weapon_Versatile_Melee_Finesse_Effect_Pr3UniqEffVersFn.json',
    ], { system: { size: 'common' } });
    const weapon = { id: 'w', name: 'Unique Weapon (Versatile Melee)', type: 'weapon', parent: actor, flags: { core: { sourceId: 'Compendium.essence20.pr_crb.Item.Pr3UniqWpnVersat' } }, system: {} };
    const [might, finesse] = actor.items.contents;
    actor.items.contents.push(weapon);
    for (const effect of [might, finesse]) {
      effect.flags = { essence20: { parentId: 'w' } };
    }

    rebuildIndex(actor);
    const up = (item, size) => ruleRollSources(actor, size ? { system: { size } } : null, { item, isAttack: true, isMelee: true }).sources.reduce((sum, s) => sum + s.shiftUp, 0);
    expect(up(might, 'huge')).toBe(2);
    expect(up(finesse, 'gigantic')).toBe(2);
    expect(up(might, 'long')).toBe(0);
    expect(up(might, null)).toBe(0);
    // Another weapon's attack.
    const other = { id: 'x', type: 'weaponEffect', parent: actor, flags: { essence20: { parentId: 'o' } }, system: {} };
    actor.items.contents.push({ id: 'o', type: 'weapon', parent: actor, flags: {}, system: {} }, other);
    expect(up(other, 'gigantic')).toBe(0);
  });

  test('Jungle Fury Rhino Sentry Shield: ranged attacks against an active one take ↓2 unless the wielder is in Cover', () => {
    const target = holder(['ttsgitems/_source/Jungle_Fury_Rhino_Sentry_Shield_WXcEsB0FYQGJZrsD.json']);
    const shield = target.items.contents[0];
    const attacker = holder([]);
    const down = (isMelee = false) => ruleRollSources(attacker, target, { isAttack: true, isMelee, item: { type: 'weaponEffect', system: {} } }).sources.reduce((sum, s) => sum + s.shiftDown, 0);
    expect(down()).toBe(0);
    shield.system.equipped = true;
    rebuildIndex(target);
    expect(down()).toBe(0);
    shield.system.active = true;
    expect(down()).toBe(2);
    expect(down(true)).toBe(0);
    expect(ruleRollSources(attacker, null, { isAttack: true, isMelee: false }).sources).toEqual([]);
    target.statuses.add('cover');
    expect(down()).toBe(0);
    target.statuses.delete('cover');
    target.statuses.add('totalCover');
    expect(down()).toBe(0);
  });
});

// slB tf1
describe('slB tf1', () => {
  test('Fearsome Additions: ↑1 on Intimidation in Bot Mode only', () => {
    const actor = holder(['dditems/_source/Fearsome_Additions_jh4FiaiLPb40jqkv.json'], { system: { isTransformed: false } });
    expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Fearsome Additions' })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    actor.system.isTransformed = true;
    expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  });

  test('Experiment (Shove): ↑1 on a Shove, not on other rolls or with another option', () => {
    const actor = holder(['tfcrbitems/_source/Experiment_EcSOADOOb3PZMolz.json']);
    const perk = actor.items.contents[0];
    perk.system = { ...perk.system, choice: 'shove' };
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', isShove: true }).sources).toEqual([expect.objectContaining({ shiftUp: 1, label: 'Experiment' })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', isAttack: true, item: { type: 'weaponEffect', system: { damageType: 'grapple' } } }).sources).toEqual([]);
    perk.system = { ...perk.system, choice: 'technology' };
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', isShove: true }).sources).toEqual([]);
  });

  test.each([
    ['Dinobot', 'tsitems/_source/Dinobot_tx4mlGvMhiWXA4mp.json', 'brawn', 'survival'],
    ['Maximal', 'tsitems/_source/Maximal_z3Ig9tbOEq4erPU5.json', 'science', 'technology'],
    ['Predacon', 'tsitems/_source/Predacon_jRD6G5Z6eblTvxeO.json', 'intimidation', 'persuasion'],
  ])('%s: an Edge switch on the chosen Skill, on by default for a Specialization roll', (name, file, skill, other) => {
    const actor = holder([file]);
    const perk = actor.items.contents[0];
    expect(ruleDialogSwitches(actor, { rolledSkill: skill, dataset: {} })).toEqual([]);
    perk.system = { ...perk.system, choice: skill };
    const [spec, ...more] = ruleDialogSwitches(actor, { rolledSkill: skill, dataset: { specializationKey: 'k' } });
    expect(more).toEqual([]);
    expect(spec).toMatchObject({ value: true, label: `${name}: Edge (chosen Specialization)` });
    const [plain, ...extra] = ruleDialogSwitches(actor, { rolledSkill: skill, dataset: {} });
    expect(extra).toEqual([]);
    expect(plain.value).toBe(false);
    expect(ruleDialogSwitches(actor, { rolledSkill: other, dataset: {} })).toEqual([]);
    expect(tick(actor, { rolledSkill: skill, dataset: {} })).toMatchObject({ edge: true });
    // Edge and a Snag cancel when the roll is made (the old switch cleared the Snag instead).
    expect(tick(actor, { rolledSkill: skill, dataset: {} }, { snag: true })).toMatchObject({ edge: true, snag: true });
  });

  test('Predacon: a Skill outside its list never gets the switch', () => {
    const actor = holder(['tsitems/_source/Predacon_jRD6G5Z6eblTvxeO.json']);
    actor.items.contents[0].system = { ...actor.items.contents[0].system, choice: 'persuasion' };
    expect(ruleDialogSwitches(actor, { rolledSkill: 'persuasion', dataset: {} })).toEqual([]);
  });

  test('Partnered: Lend Assistance as a Free action, asked, once a partner is chosen', async () => {
    const { costRulesFor } = await import('./actions.mjs');
    const actor = holder(['dditems/_source/Partnered_6I4IIvDP3SOCJ5cR.json']);
    const [rule] = costRulesFor(actor);
    expect(rule).toMatchObject({ label: 'Partnered', ask: 'E20.Tf1AskPartnered' });
    expect(rule.to()).toBe('free');
    expect(rule.matches({ key: 'lendAssistance' })).toBe(false);
    actor.items.contents[0].flags = { essence20: { partner: { uuid: 'Actor.p', name: 'P' } } };
    expect(rule.matches({ key: 'lendAssistance' })).toBe(true);
    expect(rule.matches({ key: 'sprint' })).toBe(false);
  });
});

// slB tf3
describe('slB tf3', () => {
  test('Helical Spring: a chat reminder when converting either way', async () => {
    const { jest } = await import('@jest/globals');
    const { fireTriggers } = await import('./triggers.mjs');
    const saved = global.ChatMessage;
    global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
    try {
      const actor = holder(['tfcrbitems/_source/Helical_Spring_OmGdMZlotKHVFzhR.json']);
      actor.name = 'Blades';
      await fireTriggers(actor, 'untransform');
      expect(ChatMessage.create).toHaveBeenCalledTimes(1);
      expect(ChatMessage.create.mock.calls[0][0].content).toContain('Blades can move 10ft as part of converting to Bot Mode.');
      await fireTriggers(actor, 'transform');
      expect(ChatMessage.create).toHaveBeenCalledTimes(2);
      expect(ChatMessage.create.mock.calls[1][0].content).toContain('Blades can Ram without moving 10ft first.');
      await fireTriggers(holder([]), 'transform');
      expect(ChatMessage.create).toHaveBeenCalledTimes(2);
    } finally {
      global.ChatMessage = saved;
    }
  });

  test('Training Through Familiarity: Trained in Limited weapons only', () => {
    const weapon = availability => ({ type: 'weapon', name: 'Gun', flags: {}, system: { availability } });
    const actor = holder(['tfcrbitems/_source/Training_Through_Familiarity_9XITV6O09Up8QiwL.json']);
    expect(ruleRequisitionAccess(actor, weapon('limited'))).toBe('trained');
    expect(ruleRequisitionAccess(actor, weapon('standard'))).toBeNull();
    expect(ruleRequisitionAccess(actor, weapon('restricted'))).toBeNull();
    expect(ruleRequisitionAccess(actor, { type: 'armor', name: 'Vest', flags: {}, system: { availability: 'limited' } })).toBeNull();
    expect(ruleRequisitionAccess(holder([]), weapon('limited'))).toBeNull();
  });
});

// slB other2
describe('slB other2', () => {
  test('Peaceable: ↑1 on rolls to heal injuries', () => {
    const actor = holder(['ghpfitems/_source/Peaceable_BHum6Sd6Zz7cra5b.json']);
    const healing = dataset => ruleRollSources(actor, null, { rolledSkill: 'science', dataset }).sources;
    for (const flag of ['isIveGotYou', 'isMindOverMatter', 'isRegeneration', 'isPatchUp', 'isPreventativeMeasures', 'isToughItOut', 'o2Heal']) {
      expect(healing({ [flag]: true })).toEqual([expect.objectContaining({ label: 'Peaceable (healing)', shiftUp: 1, shiftDown: 0 })]);
    }

    expect(healing({ isPatchUp: 'true' })).toHaveLength(1);
    expect(healing({ isIveGotYou: 'false' })).toEqual([]);
    expect(healing({ isIveGotYou: false })).toEqual([]);
    expect(healing({ isShove: true })).toEqual([]);
    expect(healing({})).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'science', dataset: {} })).toEqual([]);
    // Initiative never counts.
    expect(healing({ isInitiative: true })).toEqual([]);
  });
});

// slC gij1
describe('slC gij1', () => {
  const FACEPLATE = 'ccitems/_source/Adjustable_Faceplate_kEJP9jn7Q0LLufmG.json';
  const defenses = () => ({ toughness: { total: 12, string: '12' }, evasion: { total: 10, string: '10' } });

  test('Adjustable Faceplate: +1 Toughness closed, +1 Evasion open, on a worn suit, not Morphed, player characters only', () => {
    const build = ({ setting, equipped = true, type = 'playerCharacter', morphed = false, attached = true } = {}) => {
      const actor = holder([FACEPLATE], { system: { isMorphed: morphed, defenses: defenses() } });
      actor.type = type;
      const plate = actor.items.contents[0];
      plate.flags = { essence20: { ...(attached ? { parentId: 'arm' } : {}), ...(setting ? { gij1Faceplate: setting } : {}) } };
      actor.items.contents.push({ id: 'arm', name: 'Armor', type: 'armor', flags: {}, system: { equipped }, parent: actor });
      ruleDerived(actor);
      return actor.system.defenses;
    };

    // Closed is the default.
    expect(build()).toEqual({ toughness: { total: 13, string: '12 + 1 (Adjustable Faceplate)' }, evasion: { total: 10, string: '10' } });
    expect(build({ setting: 'closed' }).toughness.total).toBe(13);
    expect(build({ setting: 'open' })).toEqual({ toughness: { total: 12, string: '12' }, evasion: { total: 11, string: '10 + 1 (Adjustable Faceplate)' } });
    // A loose upgrade counts; one on an unequipped suit doesn't.
    expect(build({ attached: false }).toughness.total).toBe(13);
    expect(build({ equipped: false })).toEqual(defenses());
    expect(build({ morphed: true })).toEqual(defenses());
    expect(build({ type: 'npc' })).toEqual(defenses());
  });

  test('Adjustable Faceplate: two copies still give one +1, set by the first worn one', () => {
    const actor = holder([FACEPLATE, FACEPLATE], { system: { defenses: defenses() } });
    const [first, second] = actor.items.contents;
    const source = { _stats: { compendiumSource: 'Compendium.essence20.cobra_codex.Item.kEJP9jn7Q0LLufmG' } };
    Object.assign(first, source, { flags: { essence20: { gij1Faceplate: 'open' } } });
    Object.assign(second, source, { flags: { essence20: { gij1Faceplate: 'closed' } } });
    ruleDerived(actor);
    expect(actor.system.defenses).toMatchObject({ toughness: { total: 12 }, evasion: { total: 11 } });

    // The first copy sits on an unequipped suit: the second one's setting counts.
    const again = holder([FACEPLATE, FACEPLATE], { system: { defenses: defenses() } });
    const [off, on] = again.items.contents;
    Object.assign(off, source, { flags: { essence20: { gij1Faceplate: 'open', parentId: 'arm' } } });
    Object.assign(on, source, { flags: { essence20: { gij1Faceplate: 'closed' } } });
    again.items.contents.push({ id: 'arm', name: 'Armor', type: 'armor', flags: {}, system: { equipped: false }, parent: again });
    ruleDerived(again);
    expect(again.system.defenses).toMatchObject({ toughness: { total: 13 }, evasion: { total: 10 } });
  });
});

// slC gij2

describe('slC gij2', () => {
  test('Robot: a drone refuses Frightened and Mesmerized until it has Empathetic', async () => {
    const { ruleConditionImmune } = await import('./adapter.mjs');
    const drone = holder(['gijcrbitems/_source/Robot_xV4nnjMxlb4dmyxo.json']);
    expect(ruleConditionImmune(drone, 'frightened')).toBe(true);
    expect(ruleConditionImmune(drone, 'mesmerized')).toBe(true);
    expect(ruleConditionImmune(drone, 'prone')).toBe(false);
    drone.items.contents.push({
      id: 'emp', name: 'Empathetic', type: 'upgrade', parent: drone, system: {},
      flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.SQgxzDgyhIjuOMaa' } },
    });
    rebuildIndex(drone);
    expect(ruleConditionImmune(drone, 'frightened')).toBe(false);
    expect(ruleConditionImmune(drone, 'mesmerized')).toBe(false);
  });
});

// slC sit1
describe('slC sit1', () => {
  test('Spacewalker: Edge on Athletics/Acrobatics in low or zero gravity, ↑1 on other tests in zero gravity, not while crewing a vehicle', async () => {
    const { setWorldLookups } = await import('./predicate.mjs');
    const actor = holder(['atsitems/_source/Spacewalker_OasmncqkxGO3QCXv.json']);
    actor.uuid = 'Actor.spacewalker';
    const sources = ctx => ruleRollSources(actor, null, ctx).sources;
    const savedActors = global.game.actors;
    try {
      setWorldLookups({ environment: () => 'zeroGravity' });
      expect(sources({ rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ edge: true, shiftUp: 0, label: 'Spacewalker (Athletics, Acrobatics in low or zero gravity)' })]);
      expect(sources({ rolledSkill: 'acrobatics' })).toEqual([expect.objectContaining({ edge: true, shiftUp: 0 })]);
      expect(sources({ rolledSkill: 'science' })).toEqual([expect.objectContaining({ edge: false, shiftUp: 1, label: 'Spacewalker (zero gravity)' })]);
      expect(sources({ item: { type: 'weaponEffect', system: {}, flags: {} }, rolledSkill: 'targeting' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
      expect(sources({})).toEqual([expect.objectContaining({ shiftUp: 1 })]);
      // Initiative never counts.
      expect(sources({ rolledSkill: 'alertness', dataset: { isInitiative: true } })).toEqual([]);
      setWorldLookups({ environment: () => 'lowGravity' });
      expect(sources({ rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ edge: true })]);
      expect(sources({ rolledSkill: 'science' })).toEqual([]);
      setWorldLookups({ environment: () => 'normal' });
      expect(sources({ rolledSkill: 'athletics' })).toEqual([]);
      expect(sources({ rolledSkill: 'science' })).toEqual([]);
      expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
      // "As an individual": not while crewing a vehicle.
      setWorldLookups({ environment: () => 'zeroGravity' });
      global.game.actors = [{ type: 'vehicle', system: { actors: { x: { uuid: 'Actor.spacewalker', vehicleRole: 'passenger' } } } }];
      expect(sources({ rolledSkill: 'athletics' })).toEqual([]);
      expect(sources({ rolledSkill: 'science' })).toEqual([]);
    } finally {
      global.game.actors = savedActors;
      setWorldLookups({ environment: undefined });
    }
  });

  test('Out of the Jungle: Edge on non-attack tests, Specialized attacks, ignores Rough Terrain', () => {
    const actor = holder(['sssitems/_source/Out_of_the_Jungle_5jc5fjieruLuWQm1.json']);
    const attack = { type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: {} };
    expect(ruleRollSources(actor, null, { rolledSkill: 'survival' }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Out of the Jungle (non-attack tests)' })]);
    expect(ruleRollSources(actor, null, {}).sources).toEqual([expect.objectContaining({ edge: true })]);
    expect(ruleRollSources(actor, null, { item: attack, rolledSkill: 'targeting' }).sources).toEqual([]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness', dataset: { isInitiative: true } }).sources).toEqual([]);
    expect(ruleSpecializes(actor, 'targeting', attack)).toBe(true);
    expect(ruleSpecializes(actor, 'survival', null)).toBe(false);
    expect(ruleMovement(actor).ignoreRoughTerrain).toBe(true);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'survival' })).toEqual([]);
    expect(ruleMovement(holder([])).ignoreRoughTerrain).toBe(false);
  });

  test.each([
    'gijcrbitems/_source/Danger_Sense_2hwFRZ67xIGt1XTm.json',
    'gijcrbitems/_source/Every_Trick_in_the_Book_HKv38GCtVdSV2qMH.json',
  ])('%s: the holder can\'t be Surprised', async file => {
    const { ruleConditionImmune } = await import('./adapter.mjs');
    const actor = holder([file]);
    expect(ruleConditionImmune(actor, 'surprised')).toBe(true);
    expect(ruleConditionImmune(actor, 'prone')).toBe(false);
    expect(ruleConditionImmune(holder([]), 'surprised')).toBe(false);
  });
});

// slC sit2
describe('slC sit2', () => {
  test('Feet Wet: ignores Rough Terrain on sea terrain only', async () => {
    const { setWorldLookups } = await import('./predicate.mjs');
    const actor = holder(['qgtgitems/_source/Feet_Wet_7u3xCPPjxJlI7c61.json']);
    try {
      setWorldLookups({ terrain: () => 'sea' });
      expect(ruleMovement(actor).ignoreRoughTerrain).toBe(true);
      setWorldLookups({ terrain: () => 'arctic' });
      expect(ruleMovement(actor).ignoreRoughTerrain).toBe(false);
      setWorldLookups({ terrain: () => 'wetlands' });
      expect(ruleMovement(actor).ignoreRoughTerrain).toBe(false);
      setWorldLookups({ terrain: () => null });
      expect(ruleMovement(actor).ignoreRoughTerrain).toBe(false);
      expect(ruleMovement(holder([])).ignoreRoughTerrain).toBe(false);
    } finally {
      setWorldLookups({ terrain: undefined });
    }
  });
});

// slD react
describe('slD react', () => {
  test('Inspirational Leader: Lend Assistance at any Skill rank only while no combat exists', async () => {
    const { ruleAssist } = await import('./adapter.mjs');
    const leader = holder(['atsitems/_source/Inspirational_Leader_JH6xyTYUHCxAKkTP.json']);
    const ally = holder([]);
    const saved = global.game.combat;
    try {
      global.game.combat = null;
      expect(ruleAssist(leader, ally, 'might').anyRank).toBe(true);
      expect(ruleAssist(ally, leader, 'might').anyRank).toBe(false);
      global.game.combat = { round: 0, started: false };
      expect(ruleAssist(leader, ally, 'might').anyRank).toBe(false);
      global.game.combat = { round: 2, started: true };
      expect(ruleAssist(leader, ally, 'might').anyRank).toBe(false);
      global.game.combat = null;
      expect(ruleAssist(holder([]), ally, 'might').anyRank).toBe(false);
    } finally {
      global.game.combat = saved;
    }
  });
});

// slD resource
describe('slD resource', () => {
  test('History Buff: a ↑2 switch on Culture tests, ticked with a History Specialization', () => {
    const actor = holder(['jttitems/_source/History_Buff_b3O5i3HMtaIHl6PD.json'], {
      system: { skills: { culture: { specializations: { s1: { name: 'History' }, s2: { name: 'Art' } } } } },
    });
    const switches = ctx => ruleDialogSwitches(actor, ctx).map(({ label, value }) => ({ label, value }));
    const label = 'History test (History Buff: ↑2)';
    expect(switches({ rolledSkill: 'culture', dataset: { specializationKey: 's1' } })).toEqual([{ label, value: true }]);
    expect(switches({ rolledSkill: 'culture', dataset: { specializationName: 'Ancient history' } })).toEqual([{ label, value: true }]);
    expect(switches({ rolledSkill: 'culture', dataset: { specializationKey: 's2' } })).toEqual([{ label, value: false }]);
    expect(switches({ rolledSkill: 'culture', dataset: {} })).toEqual([{ label, value: false }]);
    expect(switches({ rolledSkill: 'science', dataset: { specializationKey: 's1' } })).toEqual([]);
    expect(tick(actor, { rolledSkill: 'culture', dataset: {} })).toMatchObject({ shiftUp: 2 });
    expect(tick(actor, { rolledSkill: 'culture', dataset: { specializationKey: 's1' } })).toMatchObject({ shiftUp: 2 });
    // Never remembered: left unticked, it starts at its default again on the next roll.
    const result = { shiftUp: 0, shiftDown: 0, ext: {} };
    applyRuleSwitches(actor, result, { rolledSkill: 'culture', dataset: { specializationKey: 's1' } });
    expect(result.shiftUp).toBe(0);
    expect(switches({ rolledSkill: 'culture', dataset: { specializationKey: 's1' } })).toEqual([{ label, value: true }]);
  });
});

// slE q1
describe('slE q1', () => {
  const gun = (availability, total = availability) => ({ type: 'weapon', name: 'Gun', flags: {}, system: { availability, totalAvailability: total, traits: [], items: {} } });
  const entry = (id, name) => ({ type: 'upgrade', name, uuid: `Compendium.essence20.gi_joe_crb.Item.${id}`, availability: 'limited' });

  test('Nu, Pogodi!: Qualified in Standard weapons (by the combined tier) and the Acclimating upgrade (id or name)', () => {
    const actor = holder(['iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json']);
    expect(ruleRequisitionAccess(actor, gun('standard'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun('automatic'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, gun('limited'))).toBeNull();
    expect(ruleRequisitionAccess(actor, gun('standard', 'limited'))).toBeNull();
    expect(ruleRequisitionAccess(actor, { type: 'armor', name: 'Vest', flags: {}, system: { availability: 'standard' } })).toBeNull();
    expect(ruleRequisitionAccess(holder([]), gun('standard'))).toBeNull();
    expect(ruleQualifiedUpgrade(actor, entry('HSmtPttbJvaNy5Tf', 'Anything'))).toBe(true);
    expect(ruleQualifiedUpgrade(actor, entry('zzzzzzzzzzzzzzzz', 'Acclimating'))).toBe(true);
    expect(ruleQualifiedUpgrade(actor, { type: 'upgrade', name: 'acclimating', flags: {}, system: { availability: 'limited' } })).toBe(true);
    expect(ruleQualifiedUpgrade(actor, entry('zzzzzzzzzzzzzzzz', 'Acclimating Mk II'))).toBe(false);
    expect(ruleQualifiedUpgrade(holder([]), entry('HSmtPttbJvaNy5Tf', 'Acclimating'))).toBe(false);
  });

  test('Mega Training Regimen: ↑1 on attacks with vehicle weapon systems and Integrated hardpoint weapons', () => {
    const actor = holder(['fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json']);
    const integrated = { id: 'w1', type: 'weapon', name: 'Cannon', flags: {}, system: { hardpoint: { type: 'integrated' } } };
    const external = { id: 'w2', type: 'weapon', name: 'Rifle', flags: {}, system: { hardpoint: { type: 'external' } } };
    actor.items.contents.push(integrated, external);
    const effectOf = (weapon, parent = actor) => ({ type: 'weaponEffect', system: {}, parent, flags: weapon ? { essence20: { parentId: weapon.id } } : {} });
    const sources = ctx => ruleRollSources(actor, null, ctx).sources.map(({ label, shiftUp }) => ({ label, shiftUp }));
    const mega = [{ label: 'Mega Training Regimen', shiftUp: 1 }];
    expect(sources({ isAttack: true, item: effectOf(null, { type: 'vehicle', items: { get: () => null } }) })).toEqual(mega);
    expect(sources({ isAttack: true, item: effectOf(null, { type: 'zord', items: { get: () => null } }) })).toEqual(mega);
    expect(sources({ isAttack: true, item: effectOf(integrated) })).toEqual(mega);
    expect(sources({ isAttack: true, item: effectOf(external) })).toEqual([]);
    expect(sources({ isAttack: true, item: effectOf(null) })).toEqual([]);
    expect(sources({ isAttack: false, item: effectOf(integrated) })).toEqual([]);
    expect(sources({ isAttack: true, item: { type: 'spell', system: {}, parent: { type: 'vehicle' }, flags: {} } })).toEqual([]);
    // A renamed copy is labelled with its own name, as before.
    actor.items.contents[0].name = 'Mega Training';
    expect(sources({ isAttack: true, item: effectOf(integrated) })).toEqual([{ label: 'Mega Training', shiftUp: 1 }]);
  });
});

// slE dmlp
describe('slE dmlp', () => {
  const SOCIAL = ['animalHandling', 'deception', 'performance', 'persuasion', 'streetwise'];

  test('Key to Whinnypeg: ↑2 or ↑1 switches on Social Skill tests while carried; only the bigger counts', () => {
    const actor = holder(['iajitems/_source/Key_to_Whinnypeg_6HJlO4qnOTRqrOmF.json']);
    for (const rolledSkill of SOCIAL) {
      expect(switchNames(actor, { rolledSkill })).toEqual([
        'Dealing with Whinnypeg VIPs (Key to Whinnypeg: ↑2)', 'Dealing with other VIPs (Key to Whinnypeg: ↑1)',
      ]);
    }

    // The Skill's own Essence decides, as before - not an Essence the roll was switched to.
    expect(switchNames(actor, { rolledSkill: 'alertness', rolledEssence: 'social' })).toEqual([]);
    expect(switchNames(actor, { rolledSkill: 'spellcasting' })).toEqual([]);
    expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ shiftUp: 2 });
    const [local, other] = ruleDialogSwitches(actor, { rolledSkill: 'persuasion' });
    expect(local.value).toBe(false);
    const result = { shiftUp: 0, shiftDown: 0, ext: { [other.name]: true } };
    applyRuleSwitches(actor, result, { rolledSkill: 'persuasion' });
    expect(result.shiftUp).toBe(1);

    // None left, or put away: no switches.
    actor.items.contents[0].system.quantity = 0;
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    actor.items.contents[0].system.quantity = 1;
    actor.items.contents[0].system.equipped = false;
    rebuildIndex(actor);
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
  });

  test("Mrs. Doubleshoe's Prize Honey: a ↑2 switch on any test while uses are left", () => {
    const actor = holder(['dsoeitems/_source/Mrs__Doubleshoe_s_Prize_Honey_tbBjkVhSSc3Zj9zp.json']);
    const honey = actor.items.contents[0];
    expect(switchNames(actor, { rolledSkill: 'science' })).toEqual(['Cooking with Prize Honey (Prize Honey: ↑2)']);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'science' })[0].value).toBe(false);
    expect(tick(actor, { rolledSkill: 'science' })).toMatchObject({ shiftUp: 2 });
    honey.flags = { essence20: { usesLeft: 1 } };
    expect(switchNames(actor, { rolledSkill: 'science' })).toHaveLength(1);
    honey.flags.essence20.usesLeft = 0;
    expect(switchNames(actor, { rolledSkill: 'science' })).toEqual([]);
  });

  test('Wheel Excited: an Edge switch on any test once a vehicle type is picked', () => {
    const actor = holder(['mlpcrbitems/_source/Wheel_Excited_nJP3Jv15O5MFTNcA.json']);
    const perk = actor.items.contents[0];
    expect(switchNames(actor, { rolledSkill: 'driving' })).toEqual([]);
    for (const [type, label] of [['land', 'Land'], ['sea', 'Sea'], ['air', 'Air']]) {
      perk.flags = { essence20: { vehicleType: type } };
      expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual([`${label} vehicle test (Wheel Excited: Edge)`]);
    }

    expect(ruleDialogSwitches(actor, { rolledSkill: 'driving' })[0].value).toBe(false);
    expect(tick(actor, { rolledSkill: 'driving' })).toMatchObject({ edge: true });
  });
});

/* Fixes 2026-10-04: City Slicker's Streetwise switch (exact terrain gate, pre-ticked when urban - the slice toggle is
   gone) and Bookworm's rule skipping Initiative (situational2/initiative.mjs handles it there). */

test('City Slicker: Streetwise switch on Infiltration in an urban or untagged scene, pre-ticked only when urban', async () => {
  const { setWorldLookups } = await import('./predicate.mjs');
  const actor = holder(['iafav2items/_source/City_Slicker_xU1p1S5JuVu6XiAI.json'], { system: { skills: { infiltration: { shift: 'd20' }, streetwise: { shift: 'd6' } } } });
  const offered = () => ruleDialogSwitches(actor, { rolledSkill: 'infiltration', dataset: {} }).filter(s => /City Slicker/.test(s.label));
  try {
    setWorldLookups({ terrain: () => 'urban' });
    expect(offered().map(s => s.value)).toEqual([true]);
    setWorldLookups({ terrain: () => null });
    expect(offered().map(s => s.value)).toEqual([false]);
    setWorldLookups({ terrain: () => 'forest' });
    expect(offered()).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics', dataset: {} }).filter(s => /City Slicker/.test(s.label))).toEqual([]);
  } finally {
    setWorldLookups({ terrain: undefined });
  }
});

test('Bookworm: ↓1 in a library scene, but not on Initiative (its slice adds that one)', () => {
  const actor = holder(['wtnvcgitems/_source/Bookworm_p2Qk0B5PWp10ZaqN.json']);
  global.game.scenes = { active: { name: 'Night Vale Public Library' } };
  try {
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture', dataset: {} }).sources.map(s => s.shiftDown)).toEqual([1]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'initiative', dataset: { isInitiative: true } })).toEqual([]);
  } finally {
    delete global.game.scenes;
  }
});

/* Finesse or Might (data21/weapons.mjs, 2026-10-04): 66 weapon effects carry SkillSubstitution rules with scope item -
   read off the rolled effect itself, so whoever rolls it (its owner, or a crew member firing a vehicle's weapon) swaps. */

test('Finesse or Might: the rolled effect switches to the better of Finesse and Might, for whoever rolls it', async () => {
  const { applySkillSubstitution } = await import('./adapter.mjs');
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'], skillToEssence: { finesse: 'speed', might: 'strength' } } };
  const effectOf = file => ({ id: `e${nextId++}`, type: 'weaponEffect', name: fromPack(file).name, flags: {}, system: fromPack(file).system });
  const files = [
    'gijcrbitems/_source/Close_Combat_Blade_Effect_hb5fKPK5GNTSlKvY.json',
    'iafav2items/_source/Hobnailed_Boot_Effect_ReeqwVjlTrE1VeJv.json',
  ];
  // A roller who doesn't own the weapon (a vehicle's gunner): no items of their own.
  const gunner = holder([], { system: { skills: { finesse: { shift: 'd4' }, might: { shift: 'd8' } } } });
  for (const file of files) {
    const effect = effectOf(file);
    const dataset = { skill: 'finesse', essence: 'speed', shift: 'd4' };
    expect(applySkillSubstitution(gunner, dataset, effect)).toBe('might');
    expect(dataset).toMatchObject({ skill: 'might', essence: 'strength', shift: 'd8' });
    // Already the better one: no change.
    const might = { skill: 'might', essence: 'strength', shift: 'd8' };
    expect(applySkillSubstitution(gunner, might, effect)).toBeNull();
  }

  // An ordinary weapon effect never swaps.
  const plain = { type: 'weaponEffect', flags: {}, system: { rules: [] } };
  expect(applySkillSubstitution(gunner, { skill: 'finesse', shift: 'd4' }, plain)).toBeNull();
});

// slA2 zord

describe('slA2 zord', () => {
  const HYBRIDIZATION = 'Compendium.essence20.tf_crb.Item.R5SobOsimfa7mvdy';

  test('Mercurial Nature: grants a Hybridization when added, even beside one bought separately', async () => {
    const { grantData } = await import('./lifecycle.mjs');
    const { hybridsOf } = await import('../helpers/extensions/zord2/snag.mjs');
    const saved = global.foundry.utils;
    global.foundry.utils = {
      ...saved,
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
    };
    try {
      const actor = holder(['tfcrbitems/_source/Mercurial_Nature_G5LYO99aCFly6oq0.json']);
      const [perk] = actor.items.contents;
      const load = async id => (id == HYBRIDIZATION ? { toObject: () => ({ _id: 'x', name: 'Hybridization', type: 'perk', system: {} }) } : null);
      const [granted, ...rest] = await grantData(perk, actor, { load });
      expect(rest).toEqual([]);
      expect(granted).toMatchObject({ type: 'perk', _stats: { compendiumSource: HYBRIDIZATION }, flags: { essence20: { grantedBy: perk.id } } });
      expect(granted._id).toBeUndefined();

      // The old hook granted one whatever other Hybridizations the actor held (no skipIfOwned).
      actor.items.contents.push({ id: 'bought', type: 'perk', flags: { core: { sourceId: HYBRIDIZATION }, essence20: { zord2Hybrid: 'fastShift' } }, system: {} });
      expect(await grantData(perk, actor, { load })).toHaveLength(1);

      // The granted copy (marked with _stats.compendiumSource) is still a Hybridization to the slice.
      actor.items.contents.push({ id: 'granted', type: 'perk', _stats: { compendiumSource: HYBRIDIZATION }, flags: { essence20: { grantedBy: perk.id, zord2Hybrid: 'extraShift' } }, system: {} });
      expect(hybridsOf(actor)).toEqual(['fastShift', 'extraShift']);
    } finally {
      global.foundry.utils = saved;
    }
  });
});

// slB2 tf1
describe('slB2 tf1', () => {
  const EXPERIMENT = 'tfcrbitems/_source/Experiment_EcSOADOOb3PZMolz.json';
  const ESCAPE = 'Experiment: ↑1 (breaking free of the grapple)';
  let savedSettings;

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { grappleEscapeSkills } = await import('../helpers/extensions/rules/grappled.mjs');
    registerCheck('grappleEscape', (actor, option, ctx) => (ctx?.rolledSkill ? grappleEscapeSkills(actor).includes(ctx.rolledSkill) : null));
    savedSettings = global.game.settings;
  });

  afterEach(() => {
    global.game.settings = savedSettings;
  });

  function experiment(choice, statuses = ['grappled']) {
    const actor = holder([EXPERIMENT], { statuses });
    const perk = actor.items.contents[0];
    perk.system = { ...perk.system, choice };
    return actor;
  }

  test('Experiment (Shove): a ↑1 switch for breaking a grapple, on by default, never remembered', () => {
    const actor = experiment('shove');
    actor.flags = { essence20: { ruleSwitches: { [`rule-${actor.items.contents[0].id}-3`]: false } } };
    const switches = ruleDialogSwitches(actor, { rolledSkill: 'athletics', dataset: {} });
    expect(switches).toEqual([expect.objectContaining({ label: ESCAPE, value: true })]);
    expect(tick(actor, { rolledSkill: 'athletics', dataset: {} }, { shiftUp: 1 })).toMatchObject({ shiftUp: 2 });
  });

  test('Experiment escape switch: only while Grappled, with the Shove option, on a non-attack escape Skill roll', () => {
    expect(switchNames(experiment('shove', []), { rolledSkill: 'athletics' })).toEqual([]);
    expect(switchNames(experiment('technology'), { rolledSkill: 'athletics' })).toEqual([]);
    expect(switchNames(experiment('hardpoint'), { rolledSkill: 'athletics' })).toEqual([]);
    const actor = experiment('shove');
    expect(switchNames(actor, { rolledSkill: 'athletics', isAttack: true, item: { type: 'weaponEffect', system: {} } })).toEqual([]);
    expect(switchNames(actor, {})).toEqual([]);
    expect(switchNames(actor, { rolledSkill: 'technology' })).toEqual([]);
    // No game line: any Skill some book escapes with.
    expect(switchNames(actor, { rolledSkill: 'might' })).toEqual([ESCAPE]);
    expect(switchNames(actor, { rolledSkill: 'acrobatics' })).toEqual([ESCAPE]);
  });

  test("Experiment escape switch follows the world's game line", () => {
    global.game.settings = { get: (scope, key) => (key == 'gameLine' ? 'transformers' : undefined) };
    const actor = experiment('shove');
    expect(switchNames(actor, { rolledSkill: 'acrobatics' })).toEqual([ESCAPE]);
    expect(switchNames(actor, { rolledSkill: 'might' })).toEqual([]);
  });
});

// slB2 tf3
describe('slB2 tf3', () => {
  const GEAR = {
    'Rotor Blades': 'tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json',
    'Tow Cable & Hook': 'tfcrbitems/_source/Tow_Cable___Hook_EVywnYUDjBfMcoWT.json',
    'Water Cannon': 'tfcrbitems/_source/Water_Cannon_FUOOqATSqU6habEt.json',
  };

  /** A Transformer holding the gear, the weapon its Use made, and an unrelated weapon. */
  async function geared(file, { equipped = true, gearEquipped } = {}) {
    const { jest } = await import('@jest/globals');
    const actor = holder([file]);
    const [gear] = actor.items.contents;
    if (gearEquipped !== undefined) {
      gear.system = { ...gear.system, equipped: gearEquipped };
    }

    const doc = (id, flags) => {
      const item = { id, name: id, type: 'weapon', flags: { essence20: flags }, system: { equipped } };
      item.update = jest.fn(async changes => {
        item.system.equipped = changes['system.equipped'];
      });
      item.parent = actor;
      return item;
    };

    const weapon = doc('made', { grantedBy: gear.id });
    const other = doc('other', {});
    actor.items.contents.push(weapon, other);
    rebuildIndex(actor);
    return { actor, weapon, other };
  }

  test('Alt Mode Gear: the made weapon is stowed in Alt Mode and in hand in Bot Mode', async () => {
    const { jest } = await import('@jest/globals');
    const { fireTriggers } = await import('./triggers.mjs');
    const saved = global.ChatMessage;
    global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
    try {
      for (const file of Object.values(GEAR)) {
        const { actor, weapon, other } = await geared(file);
        await fireTriggers(actor, 'transform');
        expect(weapon.update).toHaveBeenCalledWith({ 'system.equipped': false });
        expect(weapon.system.equipped).toBe(false);
        await fireTriggers(actor, 'untransform');
        expect(weapon.update).toHaveBeenLastCalledWith({ 'system.equipped': true });
        expect(weapon.system.equipped).toBe(true);
        expect(other.update).not.toHaveBeenCalled();
      }

      // Nothing to post.
      expect(ChatMessage.create).not.toHaveBeenCalled();
    } finally {
      global.ChatMessage = saved;
    }
  });

  test('Alt Mode Gear: no made weapon, or the gear itself unequipped, changes nothing', async () => {
    const { fireTriggers } = await import('./triggers.mjs');
    const bare = holder([GEAR['Rotor Blades']]);
    await expect(fireTriggers(bare, 'transform')).resolves.toBeNull();

    const { actor, weapon } = await geared(GEAR['Water Cannon'], { gearEquipped: false });
    await fireTriggers(actor, 'transform');
    expect(weapon.update).not.toHaveBeenCalled();
  });
});

// slC2 gij2
describe('slC2 gij2', () => {
  const MACHINESMITH = 'gijcrbitems/_source/Machinesmith_101HiYiWfoxoO1hL.json';

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { hasComputerizedGear } = await import('../helpers/extensions/other1/cobra-gear.mjs');
    registerCheck('computerizedGear', actor => hasComputerizedGear(actor));
  });

  /** A weapon effect (and its weapon) on the roller. */
  function attack(actor, { damageType = 'blunt', traits = [] } = {}) {
    const weapon = { id: `w${nextId++}`, name: 'Gun', type: 'weapon', flags: {}, system: { traits }, parent: actor };
    const effect = { id: `e${nextId++}`, name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { damageType }, parent: actor };
    actor.items.contents.push(weapon, effect);
    return effect;
  }

  const living = (extra = {}) => ({ id: `t${nextId++}`, type: 'npc', system: {}, items: { contents: [], get: () => null }, ...extra });

  test('Machinesmith: ↑6 on an Electromagnetic attack against a living, non-computerized target', () => {
    const smith = holder([MACHINESMITH]);
    const emp = attack(smith, { damageType: 'emp' });
    const trait = attack(smith, { traits: ['electromagnetic'] });
    const plain = attack(smith);
    expect(ruleRollSources(smith, living(), { item: emp }).sources).toEqual([expect.objectContaining({ label: 'Machinesmith', shiftUp: 6 })]);
    expect(ruleRollSources(smith, living(), { item: trait }).sources[0].shiftUp).toBe(6);
    expect(ruleRollSources(smith, living(), { item: plain }).sources).toEqual([]);
    // No target, or not a weapon effect.
    expect(ruleRollSources(smith, null, { item: emp }).sources).toEqual([]);
    expect(ruleRollSources(smith, living(), { item: { type: 'weapon', system: { damageType: 'emp' }, flags: {} } }).sources).toEqual([]);
  });

  test('Machinesmith: nothing against a Computerized target or one in computerized gear', () => {
    const smith = holder([MACHINESMITH]);
    const emp = attack(smith, { damageType: 'emp' });
    expect(ruleRollSources(smith, living({ system: { traits: { computerized: true } } }), { item: emp }).sources).toEqual([]);
    const gear = { id: 'g1', type: 'armor', flags: {}, system: { traits: ['computerized'], equipped: true } };
    const geared = () => living({ items: { contents: [gear], get: () => gear } });
    expect(ruleRollSources(smith, geared(), { item: emp }).sources).toEqual([]);
    gear.system.equipped = false;
    expect(ruleRollSources(smith, geared(), { item: emp }).sources[0].shiftUp).toBe(6);
  });
});

// slC2 gij3
describe('slC2 gij3', () => {
  const STALK = 'gijcrbitems/_source/Stalk_BOuJREcROMkMjbM1.json';

  /** A Stalk holder on a scene with this terrain (undefined: untagged); environment of expertise woodlands. */
  function stalker(terrain, { adaptationFlag = false } = {}) {
    const actor = holder([STALK], { system: { environments: ['woodlands'] } });
    const scene = { getFlag: (scope, key) => (key == 'terrain' ? terrain : undefined) };
    actor.documentName = 'Actor';
    actor.getActiveTokens = () => [{ regions: [], parent: scene }];
    actor.getFlag = (scope, key) => (key == 'environmentalExpertiseActive' ? adaptationFlag : undefined);
    return searchable(actor);
  }

  /** condition-immunity.mjs's hand-written table still asks actor.items.find. */
  function searchable(actor) {
    actor.items.find = fn => actor.items.contents.find(fn);
    return actor;
  }

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { isKnownOutsideEnvironmentOfExpertise } = await import('../helpers/environmental-expertise.mjs');
    registerCheck('outsideEnvironmentOfExpertise', actor => isKnownOutsideEnvironmentOfExpertise(actor));
  });

  const edge = actor => ruleRollSources(actor, null, { rolledSkill: 'infiltration', dataset: {} }).sources.filter(source => source.edge);

  test('Stalk: Edge on Infiltration unless known to be outside the environment of expertise', () => {
    expect(edge(stalker(undefined))).toHaveLength(1);
    expect(edge(stalker('woodlands'))[0]).toMatchObject({ edge: true, label: expect.stringContaining('Stalk') });
    expect(edge(stalker('urban'))).toEqual([]);
    expect(edge(stalker('urban', { adaptationFlag: true }))).toHaveLength(1);
    // Other Skills, and Initiative (the old roll source never reached Initiative).
    expect(ruleRollSources(stalker(undefined), null, { rolledSkill: 'athletics', dataset: {} }).sources).toEqual([]);
    expect(ruleRollSources(stalker(undefined), null, { rolledSkill: 'infiltration', dataset: { isInitiative: true } }).sources).toEqual([]);
    // A ctx without a dataset still gets it.
    expect(ruleRollSources(stalker(undefined), null, { rolledSkill: 'infiltration' }).sources).toHaveLength(1);
  });

  test('Stalk: immune to Surprised unless known to be outside the environment of expertise', async () => {
    const { isImmuneToCondition } = await import('../helpers/condition-immunity.mjs');
    expect(isImmuneToCondition(stalker(undefined), 'surprised')).toBe(true);
    expect(isImmuneToCondition(stalker('woodlands'), 'surprised')).toBe(true);
    expect(isImmuneToCondition(stalker('urban'), 'surprised')).toBe(false);
    expect(isImmuneToCondition(stalker('urban', { adaptationFlag: true }), 'surprised')).toBe(true);
    expect(isImmuneToCondition(stalker(undefined), 'frightened')).toBe(false);
    expect(isImmuneToCondition(searchable(holder([])), 'surprised')).toBe(false);
  });
});

// slD2 other1
describe('slD2 other1', () => {
  const DIELECTRIC = 'ccitems/_source/Dielectric_A36q5SNroIR8xoyd.json';
  const INSULATOR = 'ccitems/_source/Insulator_AMIKCJX1DDz1sLVb.json';

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { hasComputerizedGear } = await import('../helpers/extensions/other1/cobra-gear.mjs');
    registerCheck('computerizedGear', actor => hasComputerizedGear(actor));
  });

  /** A defender wearing these upgrades on armor (computerized: the armor's trait; trait: the actor's). */
  function wearer(files, { computerized = true, trait = false, equipped = true } = {}) {
    const actor = holder(files, { system: trait ? { traits: { computerized: true } } : {} });
    const armor = { id: `arm${nextId++}`, name: 'Armor', type: 'armor', flags: {}, system: { equipped, traits: computerized ? ['computerized'] : [] }, parent: actor };
    for (const upgrade of actor.items.contents) {
      upgrade.flags = { essence20: { parentId: armor.id } };
    }

    actor.items.contents.push(armor);
    rebuildIndex(actor);
    return actor;
  }

  /** An attacker's weapon effect (and its weapon); owner: whose items they are (default the attacker). */
  function attacker({ damageType = 'blunt', traits = [], owner = null } = {}) {
    const actor = { id: `r${nextId++}`, type: 'playerCharacter', system: {}, items: { contents: [], get: id => actor.items.contents.find(i => i.id == id) } };
    const parent = owner ?? actor;
    const weapon = { id: `w${nextId++}`, name: 'Gun', type: 'weapon', flags: {}, system: { traits }, parent };
    const effect = { id: `e${nextId++}`, name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { damageType }, parent };
    parent.items.contents.push(weapon, effect);
    return { actor, effect };
  }

  const down = (roller, target, item) => ruleRollSources(roller, target, { item }).sources.reduce((sum, source) => sum + source.shiftDown, 0);

  test('Dielectric / Insulator: an Electromagnetic attack gets ↓2 / ↓1 against computerized gear', () => {
    const emp = attacker({ damageType: 'emp' });
    expect(down(emp.actor, wearer([DIELECTRIC]), emp.effect)).toBe(2);
    expect(down(emp.actor, wearer([INSULATOR]), emp.effect)).toBe(1);
    // Both worn: only Dielectric's cut counts.
    expect(down(emp.actor, wearer([DIELECTRIC, INSULATOR]), emp.effect)).toBe(2);
    expect(down(emp.actor, wearer([INSULATOR, DIELECTRIC]), emp.effect)).toBe(2);
    // The Computerized trait instead of gear (the old "coating" branch).
    expect(down(emp.actor, wearer([DIELECTRIC], { computerized: false, trait: true }), emp.effect)).toBe(2);
    // An Electromagnetic-trait weapon counts too.
    const trait = attacker({ traits: ['electromagnetic'] });
    expect(down(trait.actor, wearer([INSULATOR]), trait.effect)).toBe(1);
  });

  test('Dielectric / Insulator: nothing on other attacks, without computerized gear, or while the armor is off', () => {
    const plain = attacker();
    expect(down(plain.actor, wearer([DIELECTRIC]), plain.effect)).toBe(0);
    const emp = attacker({ damageType: 'emp' });
    expect(down(emp.actor, wearer([DIELECTRIC], { computerized: false }), emp.effect)).toBe(0);
    expect(down(emp.actor, wearer([DIELECTRIC], { equipped: false }), emp.effect)).toBe(0);
    expect(down(emp.actor, wearer([DIELECTRIC]), { type: 'weapon', flags: {}, system: { damageType: 'emp' } })).toBe(0);
  });

  test("Dielectric / Insulator: a vehicle's Electromagnetic-trait weapon fired by its crew isn't looked up (as before)", () => {
    const vehicle = { id: `v${nextId++}`, type: 'vehicle', system: {}, items: { contents: [], get: id => vehicle.items.contents.find(i => i.id == id) } };
    const crewTrait = attacker({ traits: ['electromagnetic'], owner: vehicle });
    expect(down(crewTrait.actor, wearer([DIELECTRIC]), crewTrait.effect)).toBe(0);
    // An emp effect still counts; so does the vehicle firing its own weapon.
    const crewEmp = attacker({ damageType: 'emp', owner: vehicle });
    expect(down(crewEmp.actor, wearer([DIELECTRIC]), crewEmp.effect)).toBe(2);
    expect(down(vehicle, wearer([DIELECTRIC]), crewTrait.effect)).toBe(2);
  });
});

// slE2 data
describe('slE2 data', () => {
  const MYSTIC = 'fmmcitems/_source/Mystic_SBlOGEnend5WYwgd.json';
  const weaponEffect = { type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} };
  const defender = ({ armor = 3, morphed = 5, isMorphed = false, statuses = [], items = [], flags = {} } = {}) => {
    const actor = { id: `d${nextId++}`, type: 'npc', flags: { essence20: flags }, statuses: new Set(statuses), system: { isMorphed, defenses: { toughness: { armor, morphed, total: 10 } } } };
    actor.items = { contents: items, get: id => items.find(item => item.id == id) };
    rebuildIndex(actor);
    return actor;
  };

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { isNonMystical } = await import('../helpers/extensions/data21/threats.mjs');
    registerCheck('nonMystical', actor => isNonMystical(actor));
  });

  test('Mystic: ↑1 on attacks against a Non-Mystical target', () => {
    const mystic = holder([MYSTIC]);
    const up = (target, ctx = { item: weaponEffect, isAttack: true }) => ruleRollSources(mystic, target, ctx).sources.reduce((sum, s) => sum + (s.shiftUp ?? 0), 0);
    expect(up(defender())).toBe(1);
    expect(ruleRollSources(mystic, defender(), { item: weaponEffect, isAttack: true }).sources[0].label).toBe('Mystic');
    // A Mystical target (the GM's flag, or holding Mystic / a sorcerous Power or trait) gets none.
    expect(up(defender({ flags: { d21Mystical: true } }))).toBe(0);
    expect(up(defender({ items: [{ id: 'p1', type: 'power', system: { type: 'sorcerous' }, flags: {} }] }))).toBe(0);
    expect(up(defender({ items: [{ id: 'w1', type: 'weapon', system: { traits: ['sorcerous'] }, flags: {} }] }))).toBe(0);
    // Not an attack, or no target: none.
    expect(up(defender(), { rolledSkill: 'persuasion', isAttack: false })).toBe(0);
    expect(up(null)).toBe(0);
  });

  test('Mystic: Toughness without its armor part, every target', () => {
    const mystic = holder([MYSTIC]);
    expect(ruleDefenseAdjust(mystic, defender({ armor: 3 }), 'toughness', { difficulty: 10 })).toBe(-3);
    expect(ruleDefenseAdjust(mystic, defender({ armor: 3, flags: { d21Mystical: true } }), 'toughness', { difficulty: 10 })).toBe(-3);
    // Morphed: the morphed bonus instead.
    expect(ruleDefenseAdjust(mystic, defender({ armor: 3, morphed: 5, isMorphed: true }), 'toughness', { difficulty: 10 })).toBe(-5);
    // Armor already stripped, another Defense, or the holder being attacked: nothing.
    expect(ruleDefenseAdjust(mystic, defender({ statuses: ['armorStripped'] }), 'toughness', { difficulty: 10 })).toBe(0);
    expect(ruleDefenseAdjust(mystic, defender(), 'evasion', { difficulty: 10 })).toBe(0);
    expect(ruleDefenseAdjust(defender(), mystic, 'toughness', { difficulty: 10 })).toBe(0);
    expect(ruleDefenseAdjust(holder([]), defender(), 'toughness', { difficulty: 10 })).toBe(0);
  });
});

// slE2 dmlp

describe('slE2 dmlp', () => {
  const PONY = 'Compendium.essence20.mlp_crb.Item.3Tm9SWc060Z62e4Q';
  const BASIC = 'Compendium.essence20.dark_skies_over_equestria.Item.u2fdkjPJZmeLgalz';
  let savedSettings;

  beforeAll(async () => {
    const { registerCheck } = await import('./predicate.mjs');
    const { shapeOf } = await import('../helpers/extensions/mlp1/mlp1.mjs');
    const { isDsoeDisguiseActive } = await import('../helpers/dsoe-disguise.mjs');
    registerCheck('shapeShifted', actor => !!shapeOf(actor));
    registerCheck('disguised', actor => isDsoeDisguiseActive(actor));
    savedSettings = global.game.settings;
    global.game.settings = { get: () => 1 };
  });

  afterAll(() => {
    global.game.settings = savedSettings;
  });

  const withFlags = (actor, flags) => {
    actor.flags = { essence20: flags };
    actor.getFlag = (scope, key) => actor.flags?.[scope]?.[key];
    return actor;
  };

  test('Identity Crisis: an Edge switch while shape-shifted this scene or disguised', () => {
    const actor = withFlags(holder(['dsoeitems/_source/Identity_Crisis_R6XROOkbI2dKmn5R.json']), {});
    const label = "They believe you're someone else (Identity Crisis: Edge)";
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);

    withFlags(actor, { mlpShape: { scene: 1 } });
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([label]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'persuasion' })[0].value).toBe(false);
    expect(tick(actor, { rolledSkill: 'persuasion' })).toMatchObject({ edge: true });

    // A shape from an earlier scene doesn't count; a Disguise this scene does.
    withFlags(actor, { mlpShape: { scene: 0 } });
    expect(switchNames(actor, { rolledSkill: 'persuasion' })).toEqual([]);
    withFlags(actor, { dsoeDisguiseActive: { epoch: 1, window: 'scene', count: 1 } });
    expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([label]);
    withFlags(actor, { dsoeDisguiseActive: { epoch: 0, window: 'scene', count: 1 } });
    expect(switchNames(actor, { rolledSkill: 'athletics' })).toEqual([]);
  });

  test("Basic Shape-Shifting / Ponymorph: Edge on Deception and Infiltration while the spell's shape lasts, labelled by the spell", () => {
    const files = ['dsoeitems/_source/Basic_Shape_Shifting_u2fdkjPJZmeLgalz.json', 'mlpcrbitems/_source/Ponymorph_3Tm9SWc060Z62e4Q.json'];
    const actor = withFlags(holder(files), {});
    const sources = (rolledSkill, dataset = {}) => ruleRollSources(actor, null, { rolledSkill, dataset }).sources.filter(s => s.edge).map(s => s.label);
    expect(sources('deception')).toEqual([]);

    // A shape with no spell (Shape-Shift's own Use) gives nothing here.
    withFlags(actor, { mlpShape: { scene: 1, faceSkill: 'persuasion' } });
    expect(sources('deception')).toEqual([]);

    withFlags(actor, { mlpShape: { scene: 1, spell: BASIC } });
    expect(sources('deception')).toEqual(['Keeping up the changed shape (Basic Shape-Shifting: Edge)']);
    expect(sources('infiltration')).toEqual(['Keeping up the changed shape (Basic Shape-Shifting: Edge)']);
    expect(sources('persuasion')).toEqual([]);
    expect(sources('infiltration', { isInitiative: true })).toEqual([]);

    // Shapes saved before Ponymorph was told apart (spell: true) count as Basic Shape-Shifting.
    withFlags(actor, { mlpShape: { scene: 1, spell: true } });
    expect(sources('deception')).toEqual(['Keeping up the changed shape (Basic Shape-Shifting: Edge)']);

    withFlags(actor, { mlpShape: { scene: 1, spell: PONY } });
    expect(sources('infiltration')).toEqual(['Keeping up the changed shape (Ponymorph: Edge)']);

    // Last scene's shape is over.
    withFlags(actor, { mlpShape: { scene: 0, spell: PONY } });
    expect(sources('infiltration')).toEqual([]);
  });
});
