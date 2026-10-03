import { jest } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { consumeLimited, ruleDialogSwitches, ruleRollSources, ruleSpecializes } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { consumeBanked } from './bank.mjs';

/**
 * Items converted from hand-written Use buttons to Use rules (docs/RULES_ENGINE_PLAN.md, batch 2).
 * Each is loaded from its pack source and pressed, and must do what the removed code's tests said.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function holder(file, { system = {} } = {}) {
  const doc = fromPack(file);
  const item = {
    id: `c${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: doc.system,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
  const actor = {
    id: `a${nextId++}`, uuid: `Actor.h${nextId}`, name: 'Hero', type: 'playerCharacter', isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    getFlag(scope, key) {
      return foundry.utils.getProperty(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      foundry.utils.setProperty(this.flags[scope] ??= {}, key, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
  actor.items = { contents: [item], get: id => (id == item.id ? item : undefined), [Symbol.iterator]: () => [item][Symbol.iterator]() };
  item.parent = actor;
  rebuildIndex(actor);
  return { actor, item };
}

beforeEach(() => {
  global.game = { combat: null, user: { id: 'u', targets: new Set() }, i18n: { localize: k => k, format: k => k }, settings: { get: () => 1 } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      randomID: () => `r${nextId++}`,
    },
  };
});

const pay = () => jest.fn(async () => true);

/** Press the button, then roll once: what the roll gets, and use it up. */
async function bankThenRoll(actor, item, roll) {
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  const out = ruleRollSources(actor, null, roll);
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  return { out, paid };
}

test('Capable of Anything: Edge on the next Skill Test, once per scene', async () => {
  const { actor, item } = holder('wtnvcgitems/_source/Capable_of_Anything_r9F7KVy6UqcB2x49.json');
  const { out, paid } = await bankThenRoll(actor, item, { rolledSkill: 'athletics' });
  expect(paid).not.toHaveBeenCalled();
  expect(out.sources[0]).toMatchObject({ label: 'Capable of Anything', edge: true });
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Calm Hearted: Edge waits for a Social test', async () => {
  const { actor, item } = holder('dsoeitems/_source/Calm_Hearted_uZX4nbGjbQ0b6u2i.json');
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', rolledEssence: 'strength' }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social' }).sources[0]).toMatchObject({ edge: true });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('The Nine Hand Seals: a Free action for Edge, once per encounter', async () => {
  const { actor, item } = holder('iafav2items/_source/The_Nine_Hand_Seals_2qjDEWrhBYFjkYDs.json');
  const { out, paid } = await bankThenRoll(actor, item, { item: { type: 'weaponEffect', system: {} } });
  expect(paid).toHaveBeenCalledWith('free');
  expect(out.sources[0]).toMatchObject({ edge: true });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Able To Adapt: a Free action for ↑1, once per turn', async () => {
  const { actor, item } = holder('fgtaaitems/_source/Able_To_Adapt_Ta7SsJbPcCreAHge.json');
  game.combat = { started: true, id: 'c', round: 1, turn: 0 };
  const { out, paid } = await bankThenRoll(actor, item, { rolledSkill: 'might' });
  expect(paid).toHaveBeenCalledWith('free');
  expect(out.sources[0]).toMatchObject({ shiftUp: 1 });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  game.combat.turn = 1;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Rightful Place: heal 1 Health, never past the maximum, once per encounter', async () => {
  const { actor, item } = holder('sotsitems/_source/Rightful_Place_XxIMOIXK6QOKlD8b.json', { system: { health: { value: 9, max: 10 } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.health.value).toBe(10);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Scientific Method: Science is Specialized; the Use banks ↑1 on the next roll, once per mission', async () => {
  const { actor, item } = holder('wtnvcgitems/_source/Scientific_Method_vnYDLY5Fe2pasHyF.json');
  expect(ruleSpecializes(actor, 'science')).toBe(true);
  expect(ruleSpecializes(actor, 'culture')).toBe(false);
  const { out, paid } = await bankThenRoll(actor, item, { rolledSkill: 'culture' });
  expect(paid).not.toHaveBeenCalled();
  expect(out.sources[0]).toMatchObject({ label: 'Scientific Method', shiftUp: 1 });
  expect(ruleRollSources(actor, null, { rolledSkill: 'culture' }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[1], 1)).toBe(false);
});

/* Batch 5: once-per-encounter Specialization, and Public Television's on-air toggle. */

test.each([
  ['wtnvcgitems/_source/Mind_Like_a_Steel_Trap_L7P4oDSzBYyQFZCF.json', 'culture', 'smarts', 'science', 'might'],
  ['wtnvcgitems/_source/The_Road_Calls_T2Rbuw9DHwL2gGmV.json', 'driving', 'speed', 'acrobatics', 'culture'],
])('%s: the first matching test each encounter is Specialized', async (file, skill, essence, again, other) => {
  const { actor } = holder(file);
  const essenceOf = { culture: 'smarts', science: 'smarts', might: 'strength', driving: 'speed', acrobatics: 'speed' };
  const roll = s => ({ rolledSkill: s, rolledEssence: essenceOf[s] });
  expect(ruleSpecializes(actor, other, null, { rolledEssence: essenceOf[other] })).toBe(false);
  expect(ruleSpecializes(actor, skill, null, { rolledEssence: essence })).toBe(true);
  const out = ruleRollSources(actor, null, roll(skill));
  expect(out.consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit' })]);
  for (const consume of out.consumes) {
    await consumeLimited(consume, async () => actor);
  }

  expect(ruleSpecializes(actor, again, null, { rolledEssence: essence })).toBe(false);
});

test('Public Television: once per mission, Smarts tests are Specialized for the rest of the encounter', async () => {
  const { actor, item } = holder('wtnvcgitems/_source/Public_Television_ymtH7qBwRKqohlyF.json');
  const smarts = { rolledEssence: 'smarts' };
  expect(ruleSpecializes(actor, 'culture', null, smarts)).toBe(false);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(ruleSpecializes(actor, 'culture', null, smarts)).toBe(true);
  expect(ruleSpecializes(actor, 'alertness', null, smarts)).toBe(true);
  expect(ruleSpecializes(actor, 'might', null, { rolledEssence: 'strength' })).toBe(false);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

/* My Little Pony, batch 6: the mlp1/mlp2 extension slices. */

test('Honorary Apple: a Free action for Edge on the next roll, once per mission', async () => {
  const { actor, item } = holder('iajitems/_source/Honorary_Apple_bYx0fmWfkOTjr97q.json');
  const { out, paid } = await bankThenRoll(actor, item, { rolledSkill: 'animalHandling' });
  expect(paid).toHaveBeenCalledWith('free');
  expect(out.sources[0]).toMatchObject({ label: 'Honorary Apple', edge: true });
  expect(ruleRollSources(actor, null, { rolledSkill: 'animalHandling' }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[1], 1)).toBe(false);
});

/* GI Joe and Transformers, batch 7. */

test('Collection of Secrets: a Story Point turns on an Edge switch for Smarts and Social tests until a new mission', async () => {
  const { actor, item } = holder('dditems/_source/Collection_of_Secrets_61XIiQPoIhycqgA2.json');
  item.update = async data => {
    for (const [key, value] of Object.entries(data)) {
      foundry.utils.setProperty(item, key, value);
    }
  };

  const use = item.system.rules.find(rule => rule.type == 'Use');
  expect(use.cost).toMatchObject({ resource: { storyPoints: true }, amount: 1 });
  expect(ruleDialogSwitches(actor, { rolledEssence: 'social' })).toEqual([]);
  await runSteps(use.steps, stepContext({ actor, item, rule: use }));
  expect(ruleDialogSwitches(actor, { rolledEssence: 'social' })).toHaveLength(1);
  expect(ruleDialogSwitches(actor, { rolledEssence: 'smarts' })).toHaveLength(1);
  expect(ruleDialogSwitches(actor, { rolledEssence: 'strength' })).toEqual([]);
  await fireTriggers(actor, 'missionStart');
  expect(ruleDialogSwitches(actor, { rolledEssence: 'social' })).toEqual([]);
});

/* Power Rangers: the pr1/pr2/pr3 extension slices. */

test('Privileged: the Use costs one Story Point and no action', async () => {
  const { item } = holder('bthitems/_source/Privileged_J8kK8oU2rF7eWTRc.json');
  const use = item.system.rules.find(rule => rule.type == 'Use');
  expect(use.cost).toMatchObject({ resource: { storyPoints: true }, amount: 1 });
  expect(use.cost.action).toBeUndefined();
  expect(useAvailable(item, use, item.system.rules.indexOf(use))).toBe(true);
});

test('Keen Eye: the Use rolls a DIF 12 Alertness test to recall a detail', async () => {
  const { item } = holder('prcrbitems/_source/Keen_Eye_Z4YwTrUSDQIrDkQT.json');
  const use = item.system.rules.find(rule => rule.type == 'Use');
  expect(use.cost).toBeUndefined();
  expect(use.steps[0]).toMatchObject({ do: 'roll', skill: 'alertness', dif: 12 });
  expect(use.steps[0].onSuccess).toHaveLength(1);
  expect(use.steps[0].onFail).toHaveLength(1);
});

test('Vast Wealth: the auto-pass Use works once per mission', async () => {
  const { item } = holder('prcrbitems/_source/Vast_Wealth_bZ4IqEVgHnTL0XV6.json');
  const index = item.system.rules.findIndex(rule => rule.type == 'Use');
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
});

test('Eltarian Camouflage: the Use switches the disguise; seeing through it takes ↓1', async () => {
  const { actor, item } = holder('ttsgitems/_source/Eltarian_Camouflage_zZHlNTmLLFKSS3Yo.json');
  const { actor: looker } = holder('prcrbitems/_source/Vast_Wealth_bZ4IqEVgHnTL0XV6.json');
  expect(ruleRollSources(looker, actor, { rolledSkill: 'alertness' }).sources).toEqual([]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(looker, actor, { rolledSkill: 'alertness' }).sources[0]).toMatchObject({ label: 'Eltarian Camouflage', shiftDown: 1 });
  expect(ruleRollSources(looker, actor, { rolledSkill: 'might' }).sources).toEqual([]);
  expect(ruleRollSources(looker, actor, { rolledSkill: 'alertness', isAttack: true }).sources).toEqual([]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(looker, actor, { rolledSkill: 'alertness' }).sources).toEqual([]);
});

/* Batch other1: Decepticon Directive's Distill His Essence. */

test('Distill His Essence: 2 Energon into 1 Dark Energon, once until the next Rest', async () => {
  const file = 'dditems/_source/Distill_His_Essence_QKJ19OgpdHNXUBQy.json';
  const { item: poor } = holder(file, { system: { energon: { normal: { value: 1 }, dark: { value: 0 } } } });
  expect(useAvailable(poor, poor.system.rules[0], 0)).toBe(false);
  const { actor, item } = holder(file, { system: { energon: { normal: { value: 4 }, dark: { value: 0 } } } });
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(actor.system.energon.normal.value).toBe(2);
  expect(actor.system.energon.dark.value).toBe(1);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  // The sheet's Rest clears rest-limited uses.
  delete actor.flags.essence20.ruleUses;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

/* other3 slice: What Cover?'s Cover-breaking hit. */

test('What Cover?: a ranged hit on a target in Cover destroys the Cover', async () => {
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  const { actor } = holder('eocitems/_source/What_Cover__A2gJlm0YEFlpVNLg.json');
  const foe = { name: 'Foe', isOwner: true, statuses: new Set(['cover']) };
  foe.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? foe.statuses.add(id) : foe.statuses.delete(id)));
  await fireTriggers(actor, 'hit', { roll: { isAttack: true, isMelee: true }, outcome: 'success', targets: [foe] });
  expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  await fireTriggers(actor, 'hit', { roll: { isAttack: true, isMelee: false }, outcome: 'success', targets: [foe] });
  expect(foe.toggleStatusEffect).toHaveBeenCalledWith('cover', { active: false });
  expect(foe.statuses.has('cover')).toBe(false);
  expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  expect(ChatMessage.create.mock.calls[0][0].content).toContain('Foe&#39;s Cover is destroyed.');
  await fireTriggers(actor, 'hit', { roll: { isAttack: true, isMelee: false }, outcome: 'success', targets: [foe] });
  expect(ChatMessage.create).toHaveBeenCalledTimes(1);
});

/* pass2-b: Transformers and Power Rangers Use buttons. */

test('Nose for Trouble: the Use spends a Story Point and takes no action', async () => {
  const { item } = holder('tfcrbitems/_source/Nose_for_Trouble_VUal4FUlNIrwo2MG.json');
  const use = item.system.rules.find(rule => rule.type == 'Use');
  expect(use.cost).toMatchObject({ resource: { storyPoints: true }, amount: 1 });
  expect(use.cost.action).toBeUndefined();
  const paid = pay();
  expect(await runUse(item, paid)).toContain('change the location');
  expect(paid).not.toHaveBeenCalled();
});

test('Dragon Dagger: a Standard action DIF 16 Performance test; a failure leaves it free to try again', async () => {
  const machineMerge = 'Compendium.essence20.pr_crb.Item.JYo3Kzg7eEHHhxbm';
  const { actor, item } = holder('pradvitems/_source/Dragon_Dagger_BJDwsJcx9DPZFJSe.json');
  const index = item.system.rules.findIndex(rule => rule.type == 'Use');
  let success = false;
  actor._dice = { rollSkill: jest.fn(async () => ({ success })) };
  actor.createEmbeddedDocuments = jest.fn(async () => []);
  const previous = global.fromUuid;
  global.fromUuid = jest.fn(async () => ({ name: 'Machine Merge', toObject: () => ({ name: 'Machine Merge', type: 'power', system: {} }) }));

  const paid = pay();
  expect(await runUse(item, paid)).toContain('find the Dragonzord&#39;s tune');
  expect(paid).toHaveBeenCalledWith('standard');
  expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'performance', dif: '16' }), actor);
  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  expect(useAvailable(item, item.system.rules[index], index)).toBe(true);

  success = true;
  expect(await runUse(item, pay())).toContain('Machine Merge');
  expect(global.fromUuid).toHaveBeenCalledWith(machineMerge);
  const [[, [data]]] = actor.createEmbeddedDocuments.mock.calls;
  expect(data).toMatchObject({ name: 'Machine Merge', flags: { essence20: { rulesExpiry: { until: 'scene' } } } });
  expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
  global.fromUuid = previous;
});

test('Dragon Dagger: no second Machine Merge for a Ranger who already has it', async () => {
  const machineMerge = 'Compendium.essence20.pr_crb.Item.JYo3Kzg7eEHHhxbm';
  const { actor, item } = holder('pradvitems/_source/Dragon_Dagger_BJDwsJcx9DPZFJSe.json');
  actor.items.contents.push({ id: 'mm', name: 'Machine Merge', type: 'power', flags: { core: { sourceId: machineMerge } }, system: {} });
  actor._dice = { rollSkill: jest.fn(async () => ({ success: true })) };
  actor.createEmbeddedDocuments = jest.fn(async () => []);
  expect(await runUse(item, pay())).toContain('Machine Merge');
  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
});

/* Pass 2, batch pass2-a: Fool Me Twice, Return In Kind and Nose For Trouble's escape (mlp2, gij2 slices). */

test('Fool Me Twice: a Deception test marks its targets for the scene; deceiving one again takes ↓1', async () => {
  const { actor } = holder('mlpcrbitems/_source/Fool_Me_Twice_0EK07G1dijXl89qT.json');
  const mark = {
    name: 'Mark', isOwner: true, flags: {},
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
  const other = { name: 'Other', flags: {} };
  expect(ruleRollSources(actor, mark, { rolledSkill: 'deception' }).sources).toEqual([]);
  game.user.targets = new Set([{ actor: mark }]);
  await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'persuasion' }, outcome: 'success' });
  expect(mark.flags.essence20?.ruleMarks?.foolMeTwice).toBeUndefined();
  await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'deception' }, outcome: 'failure' });
  expect(mark.flags.essence20.ruleMarks.foolMeTwice).toMatchObject({ until: 'scene' });
  expect(ruleRollSources(actor, mark, { rolledSkill: 'deception' }).sources[0]).toMatchObject({ shiftDown: 1, label: 'Deceiving them again this scene (Fool Me Twice: ↓1)' });
  expect(ruleRollSources(actor, mark, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(ruleRollSources(actor, other, { rolledSkill: 'deception' }).sources).toEqual([]);
  // No target, no mark - and no complaint.
  game.user.targets = new Set();
  await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'deception' }, outcome: 'success' });
});

test('Return In Kind: the Use readies a Free-action Lend Assistance back, once per encounter', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const { actor, item } = holder('mlpcrbitems/_source/Return_In_Kind_2EDR4Je2m2dsIPXV.json');
  const lend = () => costRulesFor(actor).filter(rule => rule.matches({ key: 'lendAssistance' }));
  expect(lend()).toEqual([]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  const [rule] = lend();
  expect(rule).toMatchObject({ label: 'Return In Kind', ask: 'E20.Mlp2AskReturnInKind', limit: { window: 'encounter', max: 1 } });
  expect(rule.to()).toBe('free');
  expect(costRulesFor(actor).filter(r => r.matches({ key: 'sprint' }))).toEqual([]);
});

test('Nose For Trouble: the escape Use costs one Story Point and no action', async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { item } = holder('gijcrbitems/_source/Nose_For_Trouble_MH630UTgsJtbf3Y5.json');
  const index = item.system.rules.findIndex(rule => rule.type == 'Use');
  const spent = [];
  let points = 0;
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
    points = 1;
    const paid = pay();
    expect(await runUse(item, paid)).toContain('find an escape route');
    expect(paid).not.toHaveBeenCalled();
    expect(spent).toEqual([1]);
  } finally {
    setStoryPointHelpers(null);
  }
});

/* Batch dice3: Animal Friend's Specialization, and the once-per-encounter Adaptable / Adventurer. */

test('Animal Friend: Animal Handling is always Specialized', () => {
  const { actor } = holder('mlpcrbitems/_source/Animal_Friend_Lj2zJKh31VNkuSGP.json');
  expect(ruleSpecializes(actor, 'animalHandling')).toBe(true);
  expect(ruleSpecializes(actor, 'persuasion')).toBe(false);
});

test('Adaptable: the first test of the chosen Essence each encounter is Specialized', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Adaptable_tenW0mLLZZTZTDX1.json');
  expect(ruleSpecializes(actor, 'might', null, { rolledEssence: 'strength' })).toBe(false);
  item.system = { ...item.system, choice: 'strength' };
  expect(ruleSpecializes(actor, 'brawn', null, { rolledEssence: 'social' })).toBe(false);
  expect(ruleSpecializes(actor, 'might', null, { rolledEssence: 'strength' })).toBe(true);
  const out = ruleRollSources(actor, null, { rolledSkill: 'might', rolledEssence: 'strength' });
  expect(out.consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit' })]);
  for (const consume of out.consumes) {
    await consumeLimited(consume, async () => actor);
  }

  expect(ruleSpecializes(actor, 'athletics', null, { rolledEssence: 'strength' })).toBe(false);
});

test('Adventurer: Edge on the first Smarts or Social test each encounter', async () => {
  const { actor } = holder('gijcrbitems/_source/Adventurer_T3XgGSGuZsFVifsS.json');
  expect(ruleRollSources(actor, null, { rolledSkill: 'might', rolledEssence: 'strength' }).sources).toEqual([]);
  const out = ruleRollSources(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social' });
  expect(out.sources).toEqual([expect.objectContaining({ edge: true, label: 'Adventurer' })]);
  for (const consume of out.consumes) {
    await consumeLimited(consume, async () => actor);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'science', rolledEssence: 'smarts' }).sources).toEqual([]);
});

/* Batch banked: Use buttons moved out of helpers/banked-buffs.mjs. */

/** A holder whose status Conditions really switch on and off. */
function withStatuses(file, statuses = [], options = {}) {
  const held = holder(file, options);
  held.actor.statuses = new Set(statuses);
  held.actor.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? held.actor.statuses.add(id) : held.actor.statuses.delete(id)));
  return held;
}

test.each([
  ['gijcrbitems/_source/Clued_In_QPKjeNGLdT1QqNOY.json', 'for a clue'],
  ['gijcrbitems/_source/Always_in_Contact_1m1pdHboGB7gem34.json', 'useful ally'],
])('%s: spends a Story Point, no action, only when one can be spent', async (file, text) => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { item } = holder(file);
  const spent = [];
  let points = 0;
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    points = 1;
    const paid = pay();
    expect(await runUse(item, paid)).toContain(text);
    expect(paid).not.toHaveBeenCalled();
    expect(spent).toEqual([1]);
  } finally {
    setStoryPointHelpers(null);
  }
});

test('To The Rescue: a Story Point for an extra Move action, once per round', async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { item } = holder('mlpcrbitems/_source/To_The_Rescue_r8DtD9tdoJy5E4od.json');
  const spent = [];
  let points = 0;
  game.combat = { started: true, id: 'c', round: 1, turn: 0 };
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    points = 1;
    expect(await runUse(item, pay())).toContain('extra Move action');
    expect(spent).toEqual([1]);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    game.combat.round = 2;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  } finally {
    setStoryPointHelpers(null);
  }
});

test('Lightning Fast: 1 Personal Power while Morphed', async () => {
  const file = 'prcrbitems/_source/Lightning_Fast_Aws6Y5RODeyDhOxD.json';
  const { item: unmorphed } = holder(file, { system: { isMorphed: false, powers: { personal: { value: 1 } } } });
  expect(useAvailable(unmorphed, unmorphed.system.rules[0], 0)).toBe(false);
  const { item: drained } = holder(file, { system: { isMorphed: true, powers: { personal: { value: 0 } } } });
  expect(useAvailable(drained, drained.system.rules[0], 0)).toBe(false);
  const { actor, item } = holder(file, { system: { isMorphed: true, powers: { personal: { value: 1 } } } });
  const paid = pay();
  expect(await runUse(item, paid)).toContain('within 60 feet');
  expect(paid).not.toHaveBeenCalled();
  expect(actor.system.powers.personal.value).toBe(0);
});

test('Ultimate Utility: spends an Energon Point, unavailable without one', async () => {
  const file = 'dditems/_source/Ultimate_Utility_LQkSWoIABnPUhecg.json';
  const { item: empty } = holder(file, { system: { energon: { normal: { value: 0 } } } });
  expect(useAvailable(empty, empty.system.rules[0], 0)).toBe(false);
  const { actor, item } = holder(file, { system: { energon: { normal: { value: 1 } } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.energon.normal.value).toBe(0);
});

test('Teleportation: once per encounter, no cost', async () => {
  const { item } = holder('tsitems/_source/Teleportation_tGbqMWSRLdV1l4oo.json');
  const paid = pay();
  expect(await runUse(item, paid)).toContain('30 feet');
  expect(paid).not.toHaveBeenCalled();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Vanish: turns Invisible, then back off, freely', async () => {
  const { actor, item } = withStatuses('tfcrbitems/_source/Vanish_RESovNstSU5Sq3GM.json');
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
  expect(actor.statuses.has('invisible')).toBe(true);
  expect(await runUse(item, pay())).toContain('no longer Invisible');
  expect(actor.toggleStatusEffect).toHaveBeenLastCalledWith('invisible', { active: false });
  expect(actor.statuses.has('invisible')).toBe(false);
});

test('Disappear: 1 Energon to turn Invisible, free to turn back', async () => {
  const file = 'tfcrbitems/_source/Disappear_aD6N6hTvFhsQFZnB.json';
  const { item: empty } = withStatuses(file, [], { system: { energon: { normal: { value: 0 } } } });
  expect(useAvailable(empty, empty.system.rules[0], 0)).toBe(false);
  expect(useAvailable(empty, empty.system.rules[1], 1)).toBe(false);
  const { actor, item } = withStatuses(file, [], { system: { energon: { normal: { value: 1 } } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.energon.normal.value).toBe(0);
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
  expect(useAvailable(item, item.system.rules[1], 1)).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.toggleStatusEffect).toHaveBeenLastCalledWith('invisible', { active: false });
  expect(actor.system.energon.normal.value).toBe(0);
});

test('Purple Ranger Prime: removes only the named Conditions it has', async () => {
  const file = 'jttitems/_source/Purple_Ranger_Prime_EfkIx0B3AN0HipH8.json';
  const { item: calm } = withStatuses(file, ['prone']);
  expect(useAvailable(calm, calm.system.rules[0], 0)).toBe(false);
  const { actor, item } = withStatuses(file, ['frightened', 'stunned', 'prone']);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('stunned', { active: false });
  expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('mesmerized', expect.anything());
  expect([...actor.statuses]).toEqual(['prone']);
});

test('Deep Breathing: heal 1, never past the maximum, once per encounter', async () => {
  const file = 'wtnvcgitems/_source/Deep_Breathing_SIR01xUOHbtLwNa2.json';
  const { actor, item } = holder(file, { system: { health: { value: 4, max: 10 } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.health.value).toBe(5);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  const { actor: full, item: fullItem } = holder(file, { system: { health: { value: 10, max: 10 } } });
  expect(await runUse(fullItem, pay())).toBeTruthy();
  expect(full.system.health.value).toBe(10);
});

test('Therapeutic Nanotechnology: heal 1 in Alt Mode, once per encounter', async () => {
  const file = 'tsitems/_source/Therapeutic_Nanotechnology_SwXglwZwj64m3zFF.json';
  const { item: botMode } = holder(file, { system: { isTransformed: false, health: { value: 4, max: 10 } } });
  expect(useAvailable(botMode, botMode.system.rules[0], 0)).toBe(false);
  const { actor, item } = holder(file, { system: { isTransformed: true, health: { value: 4, max: 10 } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.health.value).toBe(5);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test("Power Heal: 1 Personal Power heals you by the Perk's advance value (at least 1)", async () => {
  const file = 'atsitems/_source/Power_Heal_2mStsiWlvvv14YQz.json';
  const { item: drained } = holder(file, { system: { powers: { personal: { value: 0 } } } });
  expect(useAvailable(drained, drained.system.rules[0], 0)).toBe(false);
  const { actor, item } = holder(file, { system: { powers: { personal: { value: 1 } }, health: { value: 4, max: 10 } } });
  item.system = { ...item.system, advances: { ...item.system.advances, currentValue: 2 } };
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(actor.system.powers.personal.value).toBe(0);
  expect(actor.system.health.value).toBe(6);
  const { actor: unset, item: unsetItem } = holder(file, { system: { powers: { personal: { value: 1 } }, health: { value: 4, max: 10 } } });
  unsetItem.system = { ...unsetItem.system, advances: { ...unsetItem.system.advances, currentValue: null } };
  expect(await runUse(unsetItem, pay())).toBeTruthy();
  expect(unset.system.health.value).toBe(5);
  const { actor: full, item: fullItem } = holder(file, { system: { powers: { personal: { value: 1 } }, health: { value: 10, max: 10 } } });
  expect(await runUse(fullItem, pay())).toBeTruthy();
  expect(full.system.health.value).toBe(10);
});

/* actions slice (helpers/action-perks.mjs): Instant Kill Mode, Adrenaline Surge, Aggressive, Lookout and Zephyr Grace. */

const ACTION_BUDGET = { actions: { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 2 } } };

/** A started combat with this actor in it, the action economy tracking. */
function actionCombat(actor, { round = 1, turn = 0, started = true } = {}) {
  const flags = {};
  const combatant = {
    actor, tokenId: null, isOwner: true, uuid: 'Combat.c1.Combatant.x',
    getFlag: (scope, key) => flags[key],
    setFlag: async (scope, key, value) => {
      flags[key] = value;
    },
  };
  game.user.isGM = true;
  game.settings = { get: (scope, key) => (key == 'actionEconomyMode' ? 'track' : key == 'actionPerkPrompts' ? true : 1) };
  game.combat = {
    id: 'c1', started, round, turn, combatants: [combatant], turns: [combatant], combatant,
    getCombatantsByActor: a => (a === actor ? [combatant] : []),
  };
  return combatant;
}

const useIndex = item => item.system.rules.findIndex(rule => rule.type == 'Use');

test('Instant Kill Mode: once per encounter, attacks are Free actions for the rest of the turn', async () => {
  const { costRulesFor } = await import('./actions.mjs');
  const { consumeForItem, getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item } = holder('gijcrbitems/_source/Instant_Kill_Mode_JxTGMCJPHgWPQWbJ.json', { system: ACTION_BUDGET });
  actor.items.find = fn => actor.items.contents.find(fn);
  const index = useIndex(item);
  expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
  actionCombat(actor);
  const attacks = () => costRulesFor(actor).filter(rule => rule.matches({ kind: 'attack' }));
  expect(attacks()).toEqual([]);

  const paid = pay();
  expect(await runUse(item, paid)).toContain('Free actions for the rest of this turn');
  expect(paid).not.toHaveBeenCalled();
  expect(attacks()).toHaveLength(1);
  const result = await consumeForItem({ name: 'Shot', type: 'weaponEffect', actor, flags: { essence20: {} }, system: { actionType: 'standard', classification: { style: 'projectile' } } });
  expect(result.actionType).toBe('free');
  expect(getRemaining(actor).standard).toBe(1);

  game.combat.turn = 1;
  expect(attacks()).toEqual([]);
});

test('Adrenaline Surge gives a whole extra turn, once per encounter', async () => {
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item } = holder('gijcrbitems/_source/Adrenaline_Surge_TeCGfRZW9Ax9ajmB.json', { system: ACTION_BUDGET });
  actionCombat(actor);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(getRemaining(actor)).toEqual({ standard: 2, move: 2, free: 4 });
});

test('Aggressive: a Story Point buys an extra Move action, once per turn, only in combat', async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item } = holder('gijcrbitems/_source/Aggressive_HzbJFluxv3lbg9nx.json', { system: ACTION_BUDGET });
  const rule = item.system.rules[useIndex(item)];
  const spent = [];
  try {
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, rule, useIndex(item))).toBe(false);
    actionCombat(actor);
    expect(useAvailable(item, rule, useIndex(item))).toBe(true);
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(spent).toEqual([1]);
    expect(getRemaining(actor).move).toBe(2);
    expect(useAvailable(item, rule, useIndex(item))).toBe(false);
  } finally {
    setStoryPointHelpers(null);
  }
});

test('Lookout: a free Move action before the surprise round, round one only', async () => {
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item } = holder('gijcrbitems/_source/Lookout__Environmental__y7PlJwTFIWQBjJmP.json', { system: ACTION_BUDGET });
  const rule = item.system.rules[useIndex(item)];
  actionCombat(actor, { round: 2 });
  expect(useAvailable(item, rule, useIndex(item))).toBe(false);
  actionCombat(actor, { round: 0, started: false });
  expect(useAvailable(item, rule, useIndex(item))).toBe(true);
  actionCombat(actor, { round: 1 });
  expect(useAvailable(item, rule, useIndex(item))).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(getRemaining(actor).move).toBe(2);
});

test('Zephyr Grace adds two Free actions each turn while Morphed', async () => {
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor } = holder('ttsgitems/_source/Zephyr_Grace_grOi10SLawqjUB8g.json', { system: { ...ACTION_BUDGET, isMorphed: false } });
  actionCombat(actor);
  await fireTriggers(actor, 'turnStart');
  expect(getRemaining(actor).free).toBe(2);
  actor.system.isMorphed = true;
  await fireTriggers(actor, 'turnStart');
  expect(getRemaining(actor).free).toBe(4);
});

/* perkh slice: Team Player's Story Point for a Lend Assistance that lands. */

test.each([
  ['Transformers', 'tfcrbitems/_source/Team_Player_oWjvage64Y4KrWjw.json', false],
  ['Night Vale', 'wtnvcgitems/_source/Team_Player_57KqLyhUgAHpCskm.json', false],
  ['G.I. Joe', 'gijcrbitems/_source/Team_Player_itmsNR7wtqJQp0rr.json', true],
])('Team Player (%s): a landed assist adds a Story Point', async (line, file, combatOnly) => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const granted = [];
  try {
    setStoryPointHelpers({
      canSpendForActor: () => true, spendForActor: async () => {}, poolFor: () => 'story',
      requestStoryPointGrant: async (a, n) => granted.push(n),
    });
    const { actor } = holder(file);
    const ally = { id: 'ally', name: 'Ally' };
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'skill' }, targets: [ally] });
    expect(granted).toEqual(combatOnly ? [] : [1]);

    global.game.combat = { started: true, round: 1 };
    await fireTriggers(actor, 'lendAssistance', { roll: { assistKind: 'attack' }, targets: [ally] });
    expect(granted).toEqual(combatOnly ? [1] : [1, 1]);

    await fireTriggers(actor, 'assisted', { roll: { assistKind: 'skill' }, targets: [ally] });
    expect(granted).toHaveLength(combatOnly ? 1 : 2);
  } finally {
    setStoryPointHelpers(null);
  }
});

/* vehicles batch: Camo Netting and the Biotech Performance Enhancer's switches, Redundant Backups and Reactive Shocks. */

function vuHolder(file, system = {}) {
  const held = holder(file, { system });
  held.actor.type = 'vehicle';
  return held;
}

test('Camo Netting: the Use puts it up (Edge to hide, ↓2 on Speed tests) and packs it away', async () => {
  const { actor, item } = vuHolder('qgtgitems/_source/Camo_Netting_S3qPHlomgES5iUNi.json');
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources.map(s => [s.edge, s.shiftDown])).toEqual([[true, 0], [false, 2]]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'targeting' }).sources.map(s => s.shiftDown)).toEqual([2]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'infiltration' }).sources).toEqual([]);
});

test('Biotech Performance Enhancer: once per scene, +2 Evasion for the scene', async () => {
  const { ruleDerived } = await import('./adapter.mjs');
  const { actor, item } = vuHolder('jttitems/_source/Biotech_Performance_Enhancer_wDMGtOqx1jpltxG9.json', { defenses: { evasion: { total: 10 } } });
  ruleDerived(actor);
  expect(actor.system.defenses.evasion.total).toBe(10);
  expect(await runUse(item, pay())).toBeTruthy();
  actor.system.defenses.evasion.total = 10;
  ruleDerived(actor);
  expect(actor.system.defenses.evasion.total).toBe(12);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Redundant Backups: once per mission, a hit that would Defeat leaves the vehicle at 1 Health', async () => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const { actor } = vuHolder('qgtgitems/_source/Redundant_Backups_MR1ltodbf0bqAVkr.json', { health: { value: 5, max: 10 } });
  expect(await wouldBeDefeated(actor, 3, 'blunt')).toBe(3);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(4);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(7);
});

test('Reactive Shocks: a chat reminder whenever the vehicle takes damage', async () => {
  const { actor } = vuHolder('qgtgitems/_source/Reactive_Shocks_xG1l9dETqLG3gQsF.json');
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  await fireTriggers(actor, 'takesDamage', { damage: { amount: 2 } });
  await fireTriggers(actor, 'takesDamage', { damage: { amount: 1 } });
  expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  actor.type = 'playerCharacter';
  await fireTriggers(actor, 'takesDamage', { damage: { amount: 1 } });
  expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  delete global.ChatMessage;
});

/* Batch powers: Grid and Sorcerous Power Use buttons (helpers/power-use.mjs), and the Princess Perks'
   Spellcasting upshift (helpers/princess-perks.mjs). */

const personalPower = value => ({ powers: { personal: { value } } });

/** A targetable actor that records what was written to it. */
function powersTarget(name) {
  return {
    name, isOwner: true, flags: {}, system: { health: { value: 5 }, stun: { value: 0 } },
    toggleStatusEffect: jest.fn(),
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    }),
  };
}

test.each([
  'prcrbitems/_source/Mnemonic_Recall_jOYqRnHMYz6nETD0.json',
  'bthitems/_source/Longevity_2PWhz49B168yOdU6.json',
])('%s: the Use spends 1 Personal Power and nothing more', async file => {
  const { actor, item } = holder(file, { system: personalPower(2) });
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(actor.system.powers.personal.value).toBe(1);
  actor.system.powers.personal.value = 0;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Power Transfer: spends however much Personal Power the player picks', async () => {
  const { actor, item } = holder('prcrbitems/_source/Power_Transfer_QYluNF8M04MmP40d.json', { system: personalPower(3) });
  const prompt = jest.fn(async () => 2);
  global.foundry.applications = { api: { DialogV2: { prompt } } };
  try {
    expect(await runUse(item, pay())).toBeTruthy();
    expect(prompt).toHaveBeenCalled();
    expect(actor.system.powers.personal.value).toBe(1);
  } finally {
    delete global.foundry.applications;
  }
});

test('Willful Strength: bonus Health equal to the Survival rank (d6 gives 2, d2 gives 0), once per encounter', async () => {
  const file = 'jttitems/_source/Willful_Strength_8a7YRcCUxcx6KgQl.json';
  const { actor, item } = holder(file, { system: { ...personalPower(3), skills: { survival: { shift: 'd6' } }, health: { value: 5, max: 10, bonus: 0 } } });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.health.bonus).toBe(2);
  expect(actor.system.powers.personal.value).toBe(2);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);

  const low = holder(file, { system: { ...personalPower(3), skills: { survival: { shift: 'd2' } }, health: { value: 5, max: 10, bonus: 0 } } });
  expect(await runUse(low.item, pay())).toBeTruthy();
  expect(low.actor.system.health.bonus).toBe(0);
});

test('Grid Empowered: 1 Personal Power for 1 Electric damage to the target; nothing happens to anyone without one', async () => {
  const { actor, item } = holder('ttsgitems/_source/Grid_Empowered_17iN2ZzSaTvqX0PL.json', { system: personalPower(3) });
  const them = powersTarget('Them');
  game.user.targets = new Set();
  expect(await runUse(item, pay())).toBeTruthy();
  expect(them.update).not.toHaveBeenCalled();
  game.user.targets = new Set([{ actor: them }]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(them.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  expect(actor.system.powers.personal.value).toBe(1);
});

test('Rev Your Engines!: 1-3 Personal Power for that much ↑ on the next Driving test', async () => {
  const { actor, item } = holder('jttitems/_source/Rev_Your_Engines_Eu8CsCA470XBEer0.json', { system: personalPower(5) });
  global.foundry.applications = { api: { DialogV2: { prompt: jest.fn(async () => 2) } } };
  try {
    expect(await runUse(item, pay())).toBeTruthy();
  } finally {
    delete global.foundry.applications;
  }

  expect(actor.system.powers.personal.value).toBe(3);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  const out = ruleRollSources(actor, null, { rolledSkill: 'driving' });
  expect(out.sources[0]).toMatchObject({ label: 'Rev Your Engines!', shiftUp: 2 });
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources).toEqual([]);
});

test('Megazord Link: 1 Personal Power for ↑2 on the next Driving test', async () => {
  const { actor, item } = holder('jttitems/_source/Megazord_Link_c7e7enVe96wOikd9.json', { system: personalPower(1) });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.powers.personal.value).toBe(0);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'driving' }).sources[0]).toMatchObject({ shiftUp: 2 });
});

test('Shattered Memories: the timeline gives ↑1 on the next Smarts test; a character gives Edge on Social tests against them', async () => {
  const { actor, item } = holder('ttsgitems/_source/Shattered_Memories_faME3nQl9NjbafOG.json', { system: personalPower(3) });
  expect(await runUse(item, pay(), { ask: async () => 1 })).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social' }).sources).toEqual([]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'culture', rolledEssence: 'smarts' }).sources[0]).toMatchObject({ shiftUp: 1 });

  const them = powersTarget('Them');
  const other = powersTarget('Other');
  game.user.targets = new Set([{ actor: them }]);
  expect(await runUse(item, pay(), { ask: async () => 0 })).toBeTruthy();
  expect(actor.system.powers.personal.value).toBe(1);
  expect(ruleRollSources(actor, other, { rolledSkill: 'persuasion', rolledEssence: 'social' }).sources).toEqual([]);
  expect(ruleRollSources(actor, them, { rolledSkill: 'might', rolledEssence: 'strength' }).sources).toEqual([]);
  expect(ruleRollSources(actor, them, { rolledSkill: 'persuasion', rolledEssence: 'social' }).sources[0]).toMatchObject({ edge: true });
});

test('Illusory Disguise: a DIF 12 Culture test; once it succeeds, Edge on Infiltration and Deception', async () => {
  const { actor, item } = holder('fmmcitems/_source/Illusory_Disguise_7r9RSyoSvZxNx7El.json');
  let success = false;
  actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [{ results: [{ multiplier: 1 }] }] })) };
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'culture', dif: '12' }), actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);

  success = true;
  expect(await runUse(item, pay())).toBeTruthy();
  for (const skill of ['infiltration', 'deception']) {
    expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources[0]).toMatchObject({ edge: true });
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test.each([
  'Princess_of_Generosity_8s7nIIf0XIpcoqYd', 'Princess_of_Honesty_QIJJ9472y6cG82i0', 'Princess_of_Kindness_nspTaeINRMztxFr5',
  'Princess_of_Laughter_2LGYTCBeotSC1iln', 'Princess_of_Loyalty_DUBbmWhwiUKmrifW', 'Princess_of_Magic_rz7nBLl6QTQRt3eu',
])('%s: ↑1 Spellcasting only when Magical was already owned when it arrived', async file => {
  const { fireItemAdded } = await import('./triggers.mjs');
  const { ruleDerived } = await import('./adapter.mjs');
  const magical = () => ({ id: `m${nextId++}`, name: 'Magical', type: 'perk', flags: {}, _stats: { compendiumSource: 'Compendium.essence20.mlp_crb.Item.WhTlZdUORCDpZwO2' }, system: {} });
  const system = () => ({ skills: { spellcasting: { shiftUp: 0 } } });

  const fresh = holder(`mlpcrbitems/_source/${file}.json`, { system: system() });
  await fireItemAdded(fresh.actor, fresh.item);
  // The Role's own copy of Magical arrives after the Princess Perk - no upshift.
  fresh.actor.items.contents.push(magical());
  ruleDerived(fresh.actor);
  expect(fresh.actor.system.skills.spellcasting.shiftUp).toBe(0);

  const unicorn = holder(`mlpcrbitems/_source/${file}.json`, { system: system() });
  unicorn.actor.items.contents.push(magical());
  await fireItemAdded(unicorn.actor, unicorn.item);
  ruleDerived(unicorn.actor);
  expect(unicorn.actor.system.skills.spellcasting.shiftUp).toBe(1);
});

/* Grants batch (helpers/grants.mjs): once-ever pick-and-grant Uses. The toggle gate replaces the old
   flags.essence20.granted, which still hides the button on items granted before the move. */

const GRANT_ROWS = [
  { uuid: 'C.pistol', type: 'weapon', name: 'Pistol', system: { availability: 'standard', traits: [] } },
  { uuid: 'C.sniperR', type: 'weapon', name: 'Big Sniper', system: { availability: 'restricted', traits: ['sniper'] } },
  { uuid: 'C.sniperL', type: 'weapon', name: 'Sniper Rifle', system: { availability: 'limited', traits: ['sniper'] } },
  { uuid: 'C.weaponUpR', type: 'upgrade', name: 'Fancy Scope', system: { availability: 'restricted', type: 'weapon' } },
  { uuid: 'C.armorUpL', type: 'upgrade', name: 'Plating', system: { availability: 'limited', type: 'armor' } },
  { uuid: 'C.armorUpR', type: 'upgrade', name: 'Heavy Plating', system: { availability: 'restricted', type: 'armor' } },
  { uuid: 'C.weaponUpS', type: 'upgrade', name: 'Scope', system: { availability: 'standard', type: 'weapon' } },
];

/** Stand-ins for helpers/grants.mjs: the compendium is GRANT_ROWS; pickOne takes the first row, or cancels on pick number `cancelAt`. */
function grantFakes(cancelAt = -1) {
  const calls = [];
  const granted = [];
  let picks = 0;
  return {
    calls, granted,
    helpers: {
      findItems: async ({ type, availabilities, matches }) => {
        calls.push({ type, availabilities });
        return GRANT_ROWS.filter(row => row.type == type && (!availabilities || availabilities.includes(row.system.availability)) && (!matches || matches(row)));
      },
      pickOne: async (title, rows) => (picks++ == cancelAt ? null : rows[0]?.uuid ?? null),
      grantCopy: async (who, uuid, options) => {
        granted.push({ uuid, integrated: options.integrated });
        return { name: uuid };
      },
    },
  };
}

async function pressGrant(item, fakes, ask = null) {
  const rule = item.system.rules[useIndex(item)];
  const ctx = stepContext({ actor: item.parent, item, rule, targets: [], ask });
  ctx.grantHelpers = fakes.helpers;
  return runSteps(rule.steps, ctx);
}

const grantUseOpen = item => useAvailable(item, item.system.rules[useIndex(item)], useIndex(item));

test("Spotter's Scope: a Standard/Limited sniper weapon, then a Standard/Limited weapon upgrade, once", async () => {
  const { item } = holder('gijcrbitems/_source/Spotter_s_Scope_yxCVYAmJTk68pAQt.json');
  expect(grantUseOpen(item)).toBe(true);
  const fakes = grantFakes();
  await pressGrant(item, fakes);
  expect(fakes.calls).toEqual([{ type: 'weapon', availabilities: ['standard', 'limited'] }, { type: 'upgrade', availabilities: ['standard', 'limited'] }]);
  expect(fakes.granted.map(g => g.uuid)).toEqual(['C.sniperL', 'C.weaponUpS']);
  expect(grantUseOpen(item)).toBe(false);
});

test("Spotter's Scope: cancelling the weapon leaves the button; cancelling only the upgrade still uses it up", async () => {
  const first = holder('gijcrbitems/_source/Spotter_s_Scope_yxCVYAmJTk68pAQt.json');
  const none = grantFakes(0);
  await pressGrant(first.item, none);
  expect(none.granted).toEqual([]);
  expect(none.calls).toHaveLength(1);
  expect(grantUseOpen(first.item)).toBe(true);

  const second = holder('gijcrbitems/_source/Spotter_s_Scope_yxCVYAmJTk68pAQt.json');
  const weaponOnly = grantFakes(1);
  await pressGrant(second.item, weaponOnly);
  expect(weaponOnly.granted.map(g => g.uuid)).toEqual(['C.sniperL']);
  expect(grantUseOpen(second.item)).toBe(false);
});

test('Customized Armor: two Limited or one Restricted armor upgrade, once', async () => {
  const two = holder('gijcrbitems/_source/Customized_Armor_smvGDC2LdShGs0UK.json');
  const limited = grantFakes();
  await pressGrant(two.item, limited, async () => 0);
  expect(limited.calls).toEqual([{ type: 'upgrade', availabilities: ['limited'] }, { type: 'upgrade', availabilities: ['limited'] }]);
  expect(limited.granted.map(g => g.uuid)).toEqual(['C.armorUpL', 'C.armorUpL']);
  expect(grantUseOpen(two.item)).toBe(false);

  const one = holder('gijcrbitems/_source/Customized_Armor_smvGDC2LdShGs0UK.json');
  const restricted = grantFakes();
  await pressGrant(one.item, restricted, async () => 1);
  expect(restricted.granted.map(g => g.uuid)).toEqual(['C.armorUpR']);
  expect(grantUseOpen(one.item)).toBe(false);

  const cancelled = holder('gijcrbitems/_source/Customized_Armor_smvGDC2LdShGs0UK.json');
  const nothing = grantFakes();
  await pressGrant(cancelled.item, nothing, async () => null);
  expect(nothing.granted).toEqual([]);
  expect(grantUseOpen(cancelled.item)).toBe(true);
});

test('Y-Series Weaponization: any weapon, given as Integrated, once', async () => {
  const { item } = holder('ccitems/_source/Y_Series_Weaponization_W6ZrWSY6ux3ki9D1.json');
  const fakes = grantFakes();
  await pressGrant(item, fakes);
  expect(fakes.calls).toEqual([{ type: 'weapon', availabilities: null }]);
  expect(fakes.granted).toEqual([{ uuid: 'C.pistol', integrated: true }]);
  expect(grantUseOpen(item)).toBe(false);
});

test.each([
  'gijcrbitems/_source/Spotter_s_Scope_yxCVYAmJTk68pAQt.json',
  'gijcrbitems/_source/Customized_Armor_smvGDC2LdShGs0UK.json',
  'ccitems/_source/Y_Series_Weaponization_W6ZrWSY6ux3ki9D1.json',
])('%s: an item already granted under the old code keeps its button hidden', (file) => {
  const { item } = holder(file);
  item.flags = { essence20: { granted: true } };
  expect(grantUseOpen(item)).toBe(false);
});


/* unblocked batch: the Story Point grant Use buttons moved out of helpers/banked-buffs.mjs, now that a
   Story Point gainResource stops (keeping the Use) when no GM is connected. */

test.each([
  ['mlpcrbitems/_source/Curb_Your_Enthusiasm_nWb2wRNaQBrP5z0p.json', 1, 'encounter', undefined],
  ['mlpcrbitems/_source/Generosity_is_Magic_kcsCU7i1qaekbMrn.json', 1, 'encounter', 'elementIsMagic'],
  ['mlpcrbitems/_source/Honesty_Is_Magic_mwOU0SXnPC6mc2JZ.json', 1, 'encounter', 'elementIsMagic'],
  ['mlpcrbitems/_source/Kindness_is_Magic_89GCYHXO3chKVOAj.json', 1, 'encounter', 'elementIsMagic'],
  ['mlpcrbitems/_source/Laughter_Is_Magic_A5hgERkbkkVzoMwL.json', 1, 'encounter', 'elementIsMagic'],
  ['mlpcrbitems/_source/Loyalty_Is_Magic_V8SoDjHYVCUqfMhY.json', 1, 'encounter', 'elementIsMagic'],
  ['mlpcrbitems/_source/Magic_Is_Friendship_oZ8y7o3JjFM2Nevm.json', 1, 'encounter', 'elementIsMagic'],
  ['prcrbitems/_source/Educated_Jq0jnOgj6oPkMlse.json', 1, 'encounter', 'educated'],
  ['gijcrbitems/_source/Educated_cAcLWtKOUdF0pTJA.json', 1, 'encounter', 'educated'],
  ['tfcrbitems/_source/Educated_hXBK58yrv1s8IdA4.json', 1, 'encounter', 'educated'],
  ['mlpcrbitems/_source/Educated_bxJXeIC6xGtdQexn.json', 1, 'encounter', 'educated'],
  ['ghpfitems/_source/Legacy_j8OsGvCyIstjGyKZ.json', 1, 'encounter', undefined],
  ['fgtaaitems/_source/Investigator_eI07csKf4P0lC2DS.json', 1, 'encounter', undefined],
  ['ghpfitems/_source/Done_the_Impossible_wWwI0ngCDCGWN0uB.json', 1, 'encounter', undefined],
  ['fffav1items/_source/Folklorist_TU96vM4aq15QOfM4.json', 2, 'encounter', undefined],
  ['bthitems/_source/Chivalrous_E6bnHJFn2QHSru4p.json', 1, 'encounter', undefined],
  ['bthitems/_source/Puzzle_Solver_AS1G8dp4t09G1k6N.json', 1, 'encounter', undefined],
  ['prcrbitems/_source/Keep__Em_Laughing_xrwFNj0NDRcWXvXN.json', 1, null, undefined],
])('%s: adds %i to the pool (limit %s), and needs a GM to receive it', async (file, amount, per, key) => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const granted = [];
  let gm = false;
  global.ui = { notifications: { warn: jest.fn() } };
  try {
    setStoryPointHelpers({
      canSpendForActor: () => true, spendForActor: async () => {}, poolFor: () => 'story',
      requestStoryPointGrant: async (a, n) => granted.push(n), canWriteStoryPoints: () => gm,
    });
    const { item } = holder(file);
    const rule = item.system.rules.find(r => r.type == 'Use');
    const index = item.system.rules.indexOf(rule);
    expect(rule.limit?.per ?? null).toBe(per);
    expect(rule.limit?.key).toBe(key);
    expect(rule.cost).toBeUndefined();

    // No GM connected: a warning, nothing granted, and the Use is still there to press.
    const paid = pay();
    await runUse(item, paid);
    expect(granted).toEqual([]);
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(useAvailable(item, rule, index)).toBe(true);

    gm = true;
    expect(await runUse(item, paid)).toContain(amount == 2 ? '2 Story Points' : 'Point to the');
    expect(paid).not.toHaveBeenCalled();
    expect(granted).toEqual([amount]);
    expect(useAvailable(item, rule, index)).toBe(!per);
  } finally {
    setStoryPointHelpers(null);
  }
});

/* bonus slice (helpers/action-perks.mjs ACTION_PERK_USES): bonus attacks from a Use button. */

/** A melee or ranged weapon effect with no weapon behind it, rolled with this skill. */
const bonusShot = (actor, style, skill) => ({ name: 'Shot', type: 'weaponEffect', actor, flags: { essence20: {} }, system: { actionType: 'standard', classification: { style, skill } } });

function bonusHolder(file, system = {}) {
  const held = holder(file, { system: { ...ACTION_BUDGET, ...system } });
  held.actor.items.find = fn => held.actor.items.contents.find(fn);
  held.rule = held.item.system.rules[useIndex(held.item)];
  held.available = () => useAvailable(held.item, held.rule, useIndex(held.item));
  return held;
}

test.each([
  ['Ambush Predator', 'ccitems/_source/Ambush_Predator_DBNeGHS1WBi7CyuR.json', 'free', 'turn'],
  ['Mayhem Attack', 'tfcrbitems/_source/Mayhem_Attack_kFyggRo3fEFsHqcJ.json', 'free', 'turn'],
  ['Surface Invasion', 'tfcrbitems/_source/Surface_Invasion_foFGF3OSzj9NpQ3M.json', 'free', 'scene'],
])('%s: a Use in combat grants one bonus attack (%s), once per %s', async (name, file, cost, per) => {
  const { getLedger } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder(file);
  expect(available()).toBe(false);
  actionCombat(actor);
  expect(available()).toBe(true);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(getLedger(actor).bonusAttacks).toEqual([{ source: name, cost, filter: null, psychicOnMiss: 0 }]);
  expect(available()).toBe(false);
  game.combat.turn = 1;
  expect(available()).toBe(per == 'turn');
});

test('The Hits Keep Coming: a Free bonus attack that only a melee Might attack can use, once per turn', async () => {
  const { consumeForItem, getLedger, getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('gijcrbitems/_source/The_Hits_Keep_Coming_FGrl4swULa62vet8.json');
  actionCombat(actor);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(available()).toBe(false);
  expect(getLedger(actor).bonusAttacks).toHaveLength(1);

  const { attackMatchesFilter, describeAttack } = await import('../helpers/action-perks.mjs');
  const fits = (style, skill) => attackMatchesFilter(getLedger(actor).bonusAttacks[0].filter, describeAttack(actor, bonusShot(actor, style, skill)));
  expect(fits('melee', 'finesse')).toBe(false);
  expect(fits('projectile', 'might')).toBe(false);
  expect(fits('melee', 'might')).toBe(true);
  const result = await consumeForItem(bonusShot(actor, 'melee', 'might'));
  expect(result.bonusAttack).toBe(true);
  expect(getLedger(actor).bonusAttacks).toEqual([]);
  expect(getRemaining(actor).free).toBe(1);
});

test('Follow Through: Morphed only; a no-cost Might or Finesse bonus attack, once per turn', async () => {
  const { consumeForItem, getLedger } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('atsitems/_source/Follow_Through_QsFiUE0YYjwQHPgh.json', { isMorphed: false });
  actionCombat(actor);
  expect(available()).toBe(false);
  actor.system.isMorphed = true;
  expect(available()).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(available()).toBe(false);
  expect(getLedger(actor).bonusAttacks[0].cost).toBe('none');
  const { attackMatchesFilter, describeAttack } = await import('../helpers/action-perks.mjs');
  const fits = (style, skill) => attackMatchesFilter(getLedger(actor).bonusAttacks[0].filter, describeAttack(actor, bonusShot(actor, style, skill)));
  expect(fits('projectile', 'targeting')).toBe(false);
  expect(fits('melee', 'might')).toBe(true);
  expect(fits('projectile', 'finesse')).toBe(true);
  expect((await consumeForItem(bonusShot(actor, 'projectile', 'finesse'))).bonusAttack).toBe(true);
});

test('Shoot First: a Story Point for an attack at no action cost, once per encounter, even before the combat starts', async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { getLedger } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('ccitems/_source/Shoot_First_QN5iC2K5VaMItBVX.json');
  const spent = [];
  try {
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: async (a, n) => spent.push(n) });
    expect(available()).toBe(false);
    actionCombat(actor, { round: 0, started: false });
    expect(available()).toBe(true);
    expect(await runUse(item, pay())).toBeTruthy();
    expect(spent).toEqual([1]);
    expect(getLedger(actor).bonusAttacks).toEqual([{ source: 'Shoot First', cost: 'none', filter: null, psychicOnMiss: 0 }]);
    expect(available()).toBe(false);
  } finally {
    setStoryPointHelpers(null);
  }
});

test('Fight or Flight: another attack or another move as a Free action, once per turn', async () => {
  const { getLedger, getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('gijcrbitems/_source/Fight_or_Flight_UpZjnv99mGdT4lLL.json');
  actionCombat(actor);
  // Backing out of the choice uses nothing.
  expect(await runUse(item, pay(), { ask: async () => null })).toBeNull();
  expect(available()).toBe(true);

  expect(await runUse(item, pay(), { ask: async () => 0 })).toBeTruthy();
  expect(getLedger(actor).bonusAttacks).toEqual([{ source: 'Fight or Flight', cost: 'free', filter: null, psychicOnMiss: 0 }]);
  expect(available()).toBe(false);

  game.combat.turn = 1;
  expect(await runUse(item, pay(), { ask: async () => 1 })).toBeTruthy();
  expect(getRemaining(actor).move).toBe(2);
});

test('Triple Strike Attacks: 1 Personal Power for two attacks at no action cost, once per turn', async () => {
  const { getLedger } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('prcrbitems/_source/Triple_Strike_Attacks_hnbSzD1qg9P0RiAH.json', { powers: { personal: { value: 0 } } });
  actionCombat(actor);
  expect(available()).toBe(false);
  actor.system.powers.personal.value = 2;
  expect(available()).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.powers.personal.value).toBe(1);
  expect(getLedger(actor).bonusAttacks.map(b => b.cost)).toEqual(['none', 'none']);
  expect(available()).toBe(false);
});

/* round12: Triggers that read the hit or compare two stored values - Push Through Pain, Spark of the Ancients. */

const r12Hit = (amount, damageType = 'sharp') => ({ damage: { amount, damageType }, roll: { damageType, damageAmount: amount } });

test('Push Through Pain: 1 Personal Power back on taking 2+ damage at once, up to the maximum', async () => {
  const file = 'fmmcitems/_source/Push_Through_Pain_HhdIEMBVmXF8UsXu.json';
  const { actor } = holder(file, { system: { powers: { personal: { value: 1, max: 5 } } } });
  await fireTriggers(actor, 'takesDamage', r12Hit(2));
  expect(actor.system.powers.personal.value).toBe(2);
  await fireTriggers(actor, 'takesDamage', r12Hit(1));
  expect(actor.system.powers.personal.value).toBe(2);
  await fireTriggers(actor, 'takesDamage', r12Hit(3, 'stun'));
  expect(actor.system.powers.personal.value).toBe(3);

  const full = holder(file, { system: { powers: { personal: { value: 5, max: 5 } } } }).actor;
  await fireTriggers(full, 'takesDamage', r12Hit(2));
  expect(full.system.powers.personal.value).toBe(5);

  const none = holder(file).actor;
  await fireTriggers(none, 'takesDamage', r12Hit(2));
  expect(none.system.powers).toBeUndefined();
});

test('Spark of the Ancients: regains 1 Energon at the start of a scene while below the maximum', async () => {
  const file = 'eocitems/_source/Spark_Of_the_Ancients_zqPSjUwr1Y7OvGfD.json';
  const { actor } = holder(file, { system: { energon: { normal: { value: 2, max: 4 } } } });
  await fireTriggers(actor, 'sceneStart');
  expect(actor.system.energon.normal.value).toBe(3);
  actor.system.energon.normal.value = 4;
  await fireTriggers(actor, 'sceneStart');
  expect(actor.system.energon.normal.value).toBe(4);

  const none = holder(file).actor;
  await fireTriggers(none, 'sceneStart');
  expect(none.system.energon).toBeUndefined();
});

/* Defeat saves: Avoid The Inevitable, Do Not Go Quietly, Renegade Commander (wouldBeDefeated). */

test('Avoid The Inevitable: once per encounter, a hit that would Defeat leaves 1 Health', async () => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const { actor } = holder('fffav1items/_source/Avoid_The_Inevitable_RfYYmA2bDBVZsMl3.json');
  expect(await wouldBeDefeated(actor, 3, 'blunt')).toBe(3);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(4);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(7);
});

test('Do Not Go Quietly: drops to 1 Health and is Impaired, once per scene', async () => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const { actor } = holder('jttitems/_source/Do_Not_Go_Quietly_llL4HUNxVJDNIaej.json');
  actor.toggleStatusEffect = jest.fn(async () => true);
  expect(await wouldBeDefeated(actor, 9, 'sharp')).toBe(4);
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', expect.objectContaining({ active: true }));
  expect(await wouldBeDefeated(actor, 9, 'sharp')).toBe(9);
});

test('Renegade Commander: the Defeat save waits for 5th level', async () => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const low = holder('sssitems/_source/Renegade_Commander_JgJRqxXzTPBOlOBz.json', { system: { level: 4 } });
  expect(await wouldBeDefeated(low.actor, 7, 'blunt')).toBe(7);
  const high = holder('sssitems/_source/Renegade_Commander_JgJRqxXzTPBOlOBz.json', { system: { level: 5 } });
  expect(await wouldBeDefeated(high.actor, 7, 'blunt')).toBe(4);
  expect(await wouldBeDefeated(high.actor, 7, 'blunt')).toBe(7);
});

/* Morph Defeat saves: Rise Again, It's Morphin Time!, Let's Go Psycho! (wouldBeDefeated + setForm). */

test('Rise Again: while Morphed and not a crit, once per scene, a hit that would Defeat leaves 1 Health', async () => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const { actor } = holder('ttsgitems/_source/Rise_Again_9DCNlVGfsEgUX6SC.json', { system: { isMorphed: true } });
  expect(await wouldBeDefeated(actor, 7, 'blunt', { isCrit: true })).toBe(7);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(4);
  expect(await wouldBeDefeated(actor, 7, 'blunt')).toBe(7);
  const plain = holder('ttsgitems/_source/Rise_Again_9DCNlVGfsEgUX6SC.json');
  expect(await wouldBeDefeated(plain.actor, 7, 'blunt')).toBe(7);
});

test.each([
  ['prcrbitems/_source/It_s_Morphin_Time__UFMTHB90lA9ZEvso.json'],
  ['fmmcitems/_source/Let_s_Go_Psycho_qMvUP1yEtsSo6KDh.json'],
])('%s: a Morphed hero about to be Defeated demorphs at 1 Health, unconscious', async file => {
  const { wouldBeDefeated } = await import('./triggers.mjs');
  const { actor } = holder(file, { system: { isMorphed: true } });
  actor.toggleStatusEffect = jest.fn(async () => true);
  actor.update = jest.fn(async data => Object.entries(data).forEach(([key, value]) => foundry.utils.setProperty(actor, key, value)));
  expect(await wouldBeDefeated(actor, 9, 'sharp')).toBe(4);
  expect(actor.update).toHaveBeenCalledWith({ 'system.isMorphed': false });
  expect(actor.toggleStatusEffect).toHaveBeenCalledWith('unconscious', expect.objectContaining({ active: true }));
  expect(await wouldBeDefeated(actor, 9, 'sharp')).toBe(9);
});

/* Save cards: Power Quake and Sorcerous Tremors (save step, all:<ft>). */

test('the save step posts a save card with its DIF worked out', async () => {
  const { actor, item } = holder('prcrbitems/_source/Power_Quake_Jiap1rwBSt9AvCt7.json');
  const created = [];
  global.ChatMessage = { create: jest.fn(async data => created.push(data)), getSpeaker: () => ({}) };
  global.CONFIG.E20 = { ...(global.CONFIG.E20 ?? {}), skills: {} };
  foundry.utils.escapeHTML ??= text => String(text);
  const ctx = stepContext({ actor, item });
  ctx.vars.spent = 2;
  await runSteps([{ do: 'save', to: 'self', skills: ['athletics', 'acrobatics'], dif: '12 + 3 * @spent', status: 'prone' }], ctx);
  expect(created[0].flags.essence20.saveSpec).toEqual({ title: 'Power Quake', skills: ['athletics', 'acrobatics'], dif: 18, status: 'prone' });
});

test('Power Quake and Sorcerous Tremors: everyone within 15 ft saves against Prone', () => {
  const quake = fromPack('prcrbitems/_source/Power_Quake_Jiap1rwBSt9AvCt7.json').system.rules[0];
  expect(quake.when).toEqual(['self:morphed']);
  expect(quake.steps[1]).toMatchObject({ do: 'save', to: 'all:15', dif: '12 + 3 * @spent', status: 'prone' });
  const tremors = fromPack('fmmcitems/_source/Sorcerous_Tremors_zU6fU3xsjC6gU0MZ.json').system.rules[0];
  expect(tremors.steps[1].onSuccess[0]).toMatchObject({ do: 'save', to: 'all:15', dif: '12 + 3 * @var.strength' });
});

/* Spell cast effects: Healing Bandages (heal targetOrSelf), Bellowbreath, Big Honking Boom, Lullaby and
   Flower Power (save cards) - afterRoll Triggers on the spell's own item. */

function spellSaveCards() {
  const created = [];
  global.ChatMessage = { create: jest.fn(async data => created.push(data)), getSpeaker: () => ({}) };
  global.CONFIG.E20 = { ...(global.CONFIG.E20 ?? {}), skills: {} };
  global.ui = { notifications: { warn: jest.fn() } };
  foundry.utils.escapeHTML ??= text => String(text);
  return created;
}

const spellTarget = (name = 'Foe') => ({
  id: `t${nextId++}`, uuid: `Actor.t${nextId}`, name, isOwner: true, statuses: new Set(), system: { health: { value: 5, max: 10 } },
  async update(data) {
    for (const [key, value] of Object.entries(data)) {
      foundry.utils.setProperty(this, key, value);
    }
  },
});

test('Healing Bandages: a successful cast heals the targeted creature 2, or the caster with nothing targeted', async () => {
  spellSaveCards();
  const { actor, item } = holder('mlpcrbitems/_source/Healing_Bandages_CbEGORrDiBO00Qsb.json');
  const ally = spellTarget('Ally');
  game.user.targets = new Set([{ actor: ally }]);
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'success' });
  expect(ally.system.health.value).toBe(7);
  expect(actor.system.health.value).toBe(5);

  // Never past the maximum; a Critical Success counts as a success.
  ally.system.health.value = 9;
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'crit' });
  expect(ally.system.health.value).toBe(10);

  game.user.targets = new Set();
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'success' });
  expect(actor.system.health.value).toBe(7);

  // A failed cast, or a roll made with something else, heals nobody.
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'failure' });
  await fireTriggers(actor, 'afterRoll', { roll: { item: { id: 'other', type: 'spell', system: {} } }, outcome: 'success' });
  expect(actor.system.health.value).toBe(7);
});

test('Bellowbreath: a successful cast gives each target a DIF 15 Brawn save against Prone', async () => {
  const created = spellSaveCards();
  const { actor, item } = holder('kocitems/_source/Bellowbreath_o2kN3NZTFWHS494V.json');
  const foe = spellTarget();
  game.user.targets = new Set([{ actor: foe }]);
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'failure' });
  expect(created).toEqual([]);
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'success' });
  expect(created).toHaveLength(1);
  expect(created[0].flags.essence20.saveSpec).toEqual({ title: 'Bellowbreath', skills: ['brawn'], dif: 15, status: 'prone' });
  expect(created[0].content).toContain(foe.uuid);
});

test('Flower Power: everyone targeted gets the DIF 12 Acrobatics card, then the DIF 10 Brawn climb-out card', async () => {
  const created = spellSaveCards();
  const { actor, item } = holder('kocitems/_source/Flower_Power_ZLu5MLnY13um7PJM.json');
  game.user.targets = new Set([{ actor: spellTarget() }]);
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'success' });
  expect(created.map(message => message.flags.essence20.saveSpec)).toEqual([
    { title: 'Flower Power', skills: ['acrobatics'], dif: 12, status: 'restrained', damageAlways: { value: 1, type: 'sharp' } },
    { title: 'Climb out of Flower Power', skills: ['brawn'], dif: 10, status: 'restrained', removeOnSuccess: true, damageAlways: { value: 1, type: 'sharp' } },
  ]);
});

test('Big Honking Boom and Lullaby: on a successful cast everyone in range, either side, saves', () => {
  const boom = fromPack('kocitems/_source/Big_Honking_Boom_g4NcUIDX7GfC355u.json').system.rules[0];
  expect(boom).toMatchObject({ type: 'Trigger', event: 'afterRoll', outcome: 'success', when: ['item:own'] });
  expect(boom.steps).toEqual([{ do: 'save', to: 'all:5', skills: ['brawn'], dif: 12, status: 'prone', rounds: 1 }]);
  const lullaby = fromPack('kocitems/_source/Lullaby_8vqJPYvK1G2ejk3p.json').system.rules[0];
  expect(lullaby).toMatchObject({ type: 'Trigger', event: 'afterRoll', outcome: 'success', when: ['item:own'] });
  expect(lullaby.steps).toEqual([{ do: 'save', to: 'all:60', skills: ['alertness'], dif: 15, status: 'asleep', rounds: 4 }]);
});

test('Big Honking Boom: the card reaches whoever is within 5 ft', async () => {
  const created = spellSaveCards();
  const { actor, item } = holder('kocitems/_source/Big_Honking_Boom_g4NcUIDX7GfC355u.json');
  const near = spellTarget('Near');
  const own = { actor, document: { disposition: 1 }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [own];
  const far = spellTarget('Far');
  const nearToken = { actor: near, document: { disposition: 1 }, center: { x: 5, y: 0 } };
  const farToken = { actor: far, document: { disposition: -1 }, center: { x: 10, y: 0 } };
  near.getActiveTokens = () => [nearToken];
  far.getActiveTokens = () => [farToken];
  global.canvas = { tokens: { placeables: [own, nearToken, farToken] }, grid: { measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) } };
  await fireTriggers(actor, 'afterRoll', { roll: { item }, outcome: 'success' });
  delete global.canvas;
  expect(created[0]?.flags.essence20.saveSpec).toEqual({ title: 'Big Honking Boom', skills: ['brawn'], dif: 12, status: 'prone', rounds: 1 });
  expect(created[0].content).toContain(near.uuid);
  expect(created[0].content).not.toContain(far.uuid);
});

/* Round 14: per-target spell effects - hit Triggers on the spell's own item (Smoke Beam, The Stare, Rope
   Trick, Shower Power, Super Sticky Celebration String). A hit lands on that one target. */

function conditionTarget() {
  const target = spellTarget();
  const effects = [];
  target.effects = { find: fn => effects.find(fn) };
  target.toggleStatusEffect = jest.fn(async id => {
    effects.push({ statuses: new Set([id]), update: jest.fn() });
  });
  return { target, effects };
}

test.each([
  ['dsoeitems/_source/Smoke_Beam_b4UMfiQUFohGIrb4.json', ['blinded'], 3],
  ['kocitems/_source/The_Stare_SPk4Fxfc4pUV5pDO.json', ['frightened'], 3],
  ['kocitems/_source/Rope_Trick_tH1Z3Ou3IET70t4K.json', ['immobilized'], 0],
  ['kocitems/_source/Shower_Power_2I9z9FdCqMZFcR2O.json', ['prone'], 0],
  ['kocitems/_source/Super_Sticky_Celebration_String_CbI36ZY491Lf8wwV.json', ['grappled', 'immobilized', 'impaired'], 4],
])('%s: a hit puts its Conditions on that target, for the named rounds in combat', async (file, conditions, rounds) => {
  spellSaveCards();
  const { actor, item } = holder(file);
  const { target, effects } = conditionTarget();
  game.combat = { round: 2, turn: 1 };
  await fireTriggers(actor, 'hit', { roll: { item }, outcome: 'success', targets: [target] });
  expect(target.toggleStatusEffect.mock.calls).toEqual(conditions.map(id => [id, { active: true }]));
  for (const effect of effects) {
    if (rounds) {
      expect(effect.update).toHaveBeenCalledWith({ 'duration.rounds': rounds, 'duration.startRound': 2, 'duration.startTurn': 1 });
    } else {
      expect(effect.update).not.toHaveBeenCalled();
    }
  }
});

test('Smoke Beam: a Critical Success counts; a miss, or a hit with something else, applies nothing; no combat, no duration', async () => {
  spellSaveCards();
  const { actor, item } = holder('dsoeitems/_source/Smoke_Beam_b4UMfiQUFohGIrb4.json');
  const { target, effects } = conditionTarget();
  await fireTriggers(actor, 'miss', { roll: { item }, outcome: 'failure', targets: [target] });
  await fireTriggers(actor, 'hit', { roll: { item: { id: 'other', type: 'spell', system: {} } }, outcome: 'success', targets: [target] });
  expect(target.toggleStatusEffect).not.toHaveBeenCalled();
  await fireTriggers(actor, 'hit', { roll: { item }, outcome: 'crit', targets: [target] });
  expect(target.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  expect(effects[0].update).not.toHaveBeenCalled();
});

test('The Stare: the roll pipeline fires hit only for the targets the cast hit', async () => {
  spellSaveCards();
  const { runPostRoll } = await import('../helpers/extensions.mjs');
  const { actor, item } = holder('kocitems/_source/The_Stare_SPk4Fxfc4pUV5pDO.json');
  item.uuid = 'Item.stare';
  global.fromUuidSync = uuid => (uuid == item.uuid ? item : null);
  const hitOne = conditionTarget().target;
  const missed = conditionTarget().target;
  try {
    await runPostRoll(actor, [], {}, { rider: { itemUuid: item.uuid }, hits: [{ target: hitOne, hit: true }, { target: missed, hit: false }] });
  } finally {
    delete global.fromUuidSync;
  }

  expect(hitOne.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
  expect(missed.toggleStatusEffect).not.toHaveBeenCalled();
});

/* grants2 batch: Grid Power (Field Guide) and Altered Pet as once-ever pickGrant Uses; Perch as a companion-scoped
   turnStart Trigger on its owner's item. */

const GRANT2_ROWS = [
  { uuid: 'C.sorcery', type: 'power', name: 'Hex', system: { type: 'sorcerous' } },
  { uuid: 'C.grid', type: 'power', name: 'Grid Thing', system: { type: 'grid' } },
  { uuid: 'C.altLimited', type: 'alteration', name: 'Big Change', system: { availability: 'limited' } },
  { uuid: 'C.altStandard', type: 'alteration', name: 'Small Change', system: { availability: 'standard' } },
];

/** grantFakes, over GRANT2_ROWS. */
function grants2Fakes(cancelAt = -1) {
  const calls = [];
  const granted = [];
  let picks = 0;
  return {
    calls, granted,
    helpers: {
      findItems: async ({ type, availabilities, matches }) => {
        calls.push({ type, availabilities });
        return GRANT2_ROWS.filter(row => row.type == type && (!availabilities || availabilities.includes(row.system.availability)) && (!matches || matches(row)));
      },
      pickOne: async (title, rows) => (picks++ == cancelAt ? null : rows[0]?.uuid ?? null),
      grantCopy: async (who, uuid, options) => {
        granted.push({ who, uuid, integrated: options.integrated, grantedBy: options.grantedBy, flags: options.flags });
        return { name: uuid };
      },
    },
  };
}

test('Grid Power (Field Guide): a Grid Power, then +1 Personal Power regeneration, once', async () => {
  const { actor, item } = holder('fgtaaitems/_source/Grid_Power_atYoqZDXQz1PoDLP.json', { system: { powers: { personal: { regeneration: 2 } } } });
  expect(grantUseOpen(item)).toBe(true);
  const fakes = grants2Fakes();
  expect(await pressGrant(item, fakes)).toBe(true);
  expect(fakes.calls).toEqual([{ type: 'power', availabilities: null }]);
  expect(fakes.granted).toEqual([{ who: actor, uuid: 'C.grid', integrated: false, grantedBy: item, flags: {} }]);
  expect(actor.system.powers.personal.regeneration).toBe(3);
  expect(grantUseOpen(item)).toBe(false);
});

test('Grid Power (Field Guide): cancelling the pick gives nothing, leaves regeneration alone and keeps the button', async () => {
  const { actor, item } = holder('fgtaaitems/_source/Grid_Power_atYoqZDXQz1PoDLP.json', { system: { powers: { personal: { regeneration: 2 } } } });
  const fakes = grants2Fakes(0);
  expect(await pressGrant(item, fakes)).toBe(false);
  expect(fakes.granted).toEqual([]);
  expect(actor.system.powers.personal.regeneration).toBe(2);
  expect(grantUseOpen(item)).toBe(true);
});

test('Altered Pet: the pet picks a Standard Alteration, once; a cancelled pick keeps the button', async () => {
  const { actor, item } = holder('ccitems/_source/Altered_Pet_GHV4MdFKH3eTo7sd.json');
  const none = grants2Fakes(0);
  expect(await pressGrant(item, none)).toBe(false);
  expect(grantUseOpen(item)).toBe(true);
  const fakes = grants2Fakes();
  expect(await pressGrant(item, fakes)).toBe(true);
  expect(fakes.calls).toEqual([{ type: 'alteration', availabilities: ['standard'] }]);
  expect(fakes.granted).toEqual([{ who: actor, uuid: 'C.altStandard', integrated: false, grantedBy: item, flags: {} }]);
  expect(grantUseOpen(item)).toBe(false);
});

test.each([
  'fgtaaitems/_source/Grid_Power_atYoqZDXQz1PoDLP.json',
  'ccitems/_source/Altered_Pet_GHV4MdFKH3eTo7sd.json',
])('%s: an item already granted under the old code keeps its button hidden', (file) => {
  const { item } = holder(file);
  item.flags = { essence20: { granted: true } };
  expect(grantUseOpen(item)).toBe(false);
});

test('Perch: its holder\'s Small companion gets an extra Move action on its turn in round one only', async () => {
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { LINK_HOLDERS } = await import('./index.mjs');
  const { actor: owner } = holder('ccitems/_source/Perch_8Qr2SNMkMxXr4BEG.json');
  const companion = (size, type = 'companion') => {
    const pet = {
      id: `a${nextId++}`, name: 'Pet', type, statuses: new Set(), flags: { essence20: { companionOf: owner.uuid } },
      system: { size, ...ACTION_BUDGET },
      getFlag(scope, key) {
        return foundry.utils.getProperty(this.flags[scope] ?? {}, key);
      },
      async setFlag(scope, key, value) {
        foundry.utils.setProperty(this.flags[scope] ??= {}, key, value);
      },
    };
    pet.uuid = `Actor.${pet.id}`;
    pet.items = { contents: [], get: () => undefined, [Symbol.iterator]: () => [][Symbol.iterator]() };
    rebuildIndex(pet);
    return pet;
  };

  global.fromUuidSync = uuid => (uuid == owner.uuid ? owner : null);

  try {
    expect(LINK_HOLDERS.has(owner.id)).toBe(true);
    const small = companion('small');
    actionCombat(small, { round: 1 });
    await fireTriggers(owner, 'turnStart');
    expect(getRemaining(small).move).toBe(1);
    await fireTriggers(small, 'turnStart');
    expect(getRemaining(small).move).toBe(2);

    actionCombat(small, { round: 2 });
    await fireTriggers(small, 'turnStart');
    expect(getRemaining(small).move).toBe(1);

    for (const other of [companion('common'), companion('small', 'npc')]) {
      actionCombat(other, { round: 1 });
      await fireTriggers(other, 'turnStart');
      expect(getRemaining(other).move).toBe(1);
    }

    const stray = companion('small');
    stray.flags.essence20.companionOf = 'Actor.someoneElse';
    actionCombat(stray, { round: 1 });
    await fireTriggers(stray, 'turnStart');
    expect(getRemaining(stray).move).toBe(1);
  } finally {
    delete global.fromUuidSync;
    LINK_HOLDERS.delete(owner.id);
  }
});

/* perkadd slice: Battlizer Access - pick one of the book's Battlizers when the Perk is added (a ChoiceSet
   and an 'added' Trigger), unless the actor already has it. */

test.each([
  ['Across the Stars', 'atsitems/_source/Battlizer_Access__Specific_Battlizer__JGAOozVnu9Nou5Xj.json', 7, 'Compendium.essence20.across_the_stars.Item.qc82QDtZN3qVWqxV'],
  ['Beneath the Helmet', 'bthitems/_source/Battlizer_Access_oJAdvdKs1XLmsH0z.json', 3, 'Compendium.essence20.beneath_the_helmet.Item.sVYZLXhPZqdVhNax'],
])('Battlizer Access (%s): grants the picked Battlizer, unless the actor already has it', async (book, file, count, battlizer) => {
  const { choiceOptions, initialState } = await import('./lifecycle.mjs');
  const { fireItemAdded } = await import('./triggers.mjs');
  const saved = { fromUuid: global.fromUuid, ChatMessage: global.ChatMessage };
  global.fromUuid = jest.fn(async uuid => ({ name: 'Battlizer', toObject: () => ({ _id: 'x', name: 'Battlizer', type: 'armor', system: { uuid } }) }));
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  try {
    const { actor, item } = holder(file);
    const [choice] = item.system.rules.filter(rule => rule.type == 'ChoiceSet');
    expect(choiceOptions(choice)).toHaveLength(count);
    expect(choiceOptions(choice).map(option => option.value)).toContain(battlizer);

    actor.createEmbeddedDocuments = jest.fn(async () => []);
    await item.update(await initialState(item, actor, { ask: async () => battlizer }));
    await fireItemAdded(actor, item);
    expect(global.fromUuid).toHaveBeenCalledWith(battlizer);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
      type: 'armor', _stats: { compendiumSource: battlizer }, flags: { essence20: { grantedBy: item.id } },
    })]);

    // Already has that Battlizer: nothing more.
    actor.createEmbeddedDocuments.mockClear();
    actor.items.contents.push({ id: 'owned', type: 'armor', flags: {}, _stats: { compendiumSource: battlizer }, system: {} });
    await fireItemAdded(actor, item);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();

    // The dialog was closed: nothing granted.
    const closed = holder(file);
    closed.actor.createEmbeddedDocuments = jest.fn(async () => []);
    await closed.item.update(await initialState(closed.item, closed.actor, { ask: async () => null }));
    await fireItemAdded(closed.actor, closed.item);
    expect(closed.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  } finally {
    global.fromUuid = saved.fromUuid;
    global.ChatMessage = saved.ChatMessage;
  }
});

/* Banked batch 2: self-banked roll bonuses moved off helpers/banked-buffs.mjs onto Use rules with a bank
   step (Think On It, Auxiliary Brain, Street Smarts, Brutish, If I Recall Correctly, Trick Shot, Hidden
   Whispers, Mind of No Mind, Can't Afford to Miss, Grid Gifted). No action is charged, as before. */

test.each([
  ['Think On It', 'gijcrbitems/_source/Think_On_It_M7HNdhqViy0xbUkz.json', null],
  ['Street Smarts', 'mlpcrbitems/_source/Street_Smarts_M9G2fSExDSG7DKSW.json', 'encounter'],
  ['Brutish', 'fffav1items/_source/Brutish_29GLZcbjQhJHdsg0.json', 'encounter'],
])('%s: Edge on the next roll of any kind (an attack too), used up by it', async (label, file, limit) => {
  const { actor, item } = holder(file);
  const { out, paid } = await bankThenRoll(actor, item, { item: { type: 'weaponEffect', system: {} } });
  expect(paid).not.toHaveBeenCalled();
  expect(out.sources).toEqual([expect.objectContaining({ label, edge: true, shiftUp: 0 })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(limit === null);
});

test('Auxiliary Brain: Edge on the next roll, once per turn', async () => {
  const { actor, item } = holder('gijcrbitems/_source/Auxiliary_Brain_wddBU7QaDgEe9FhR.json');
  game.combat = { started: true, id: 'c', round: 1, turn: 0 };
  const { out } = await bankThenRoll(actor, item, { rolledSkill: 'technology' });
  expect(out.sources[0]).toMatchObject({ label: 'Auxiliary Brain', edge: true });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  game.combat.turn = 1;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test.each([
  ['If I Recall Correctly', 'kocitems/_source/If_I_Recall_Correctly_IHwRuoKUDhYAjTqa.json', 'spellcasting'],
  ['Trick Shot', 'kocitems/_source/Trick_Shot_sZDDuJOzRq9vg1sP.json', 'targeting'],
])('%s: Edge waits for a %s test, once per encounter', async (label, file, skill) => {
  const { actor, item } = holder(file);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  const out = ruleRollSources(actor, null, { rolledSkill: skill });
  expect(out.sources).toEqual([expect.objectContaining({ label, edge: true })]);
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Hidden Whispers: ↑3 on the next roll, once per encounter', async () => {
  const { actor, item } = holder('wtnvcgitems/_source/Hidden_Whispers_ihphiMNUuj710MzH.json');
  const { out } = await bankThenRoll(actor, item, { rolledSkill: 'persuasion' });
  expect(out.sources).toEqual([expect.objectContaining({ label: 'Hidden Whispers', shiftUp: 3, edge: false })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Mind of No Mind: ↑1 on an Alertness test only, once per encounter; still immune to Frightened', async () => {
  const { actor, item } = holder('iafav2items/_source/Mind_of_No_Mind_edU8dyL3poLU6IuM.json');
  expect(item.system.rules[0]).toMatchObject({ type: 'ConditionImmunity', conditions: ['frightened'] });
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  const out = ruleRollSources(actor, null, { rolledSkill: 'alertness' });
  expect(out.sources).toEqual([expect.objectContaining({ label: 'Mind of No Mind', shiftUp: 1 })]);
  expect(useAvailable(item, item.system.rules[1], 1)).toBe(false);
});

test("Can't Afford to Miss: each Story Point adds ↑1 to the next attack, which spends them all", async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { actor, item } = holder('ccitems/_source/Can_t_Afford_to_Miss_nb4xPr4kA5ra12PL.json');
  const spent = [];
  let points = 0;
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    points = 2;
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(spent).toEqual([1, 1]);
  } finally {
    setStoryPointHelpers(null);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  const out = ruleRollSources(actor, null, { item: { type: 'weaponEffect', system: {} } });
  expect(out.sources.reduce((sum, source) => sum + source.shiftUp, 0)).toBe(2);
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  expect(ruleRollSources(actor, null, { item: { type: 'weaponEffect', system: {} } }).sources).toEqual([]);
});

test('Grid Gifted: Edge or Specialized on the next Smarts or Social test, once per scene', async () => {
  const { actor, item } = holder('fgtaaitems/_source/Grid_Gifted_MS8KLmY19EyKR1Ww.json');
  expect(await runUse(item, pay(), { ask: async () => null })).toBeNull();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  expect(await runUse(item, pay(), { ask: async () => 1 })).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(ruleSpecializes(actor, 'athletics', null, { rolledEssence: 'strength' })).toBe(false);
  expect(ruleSpecializes(actor, 'persuasion', null, { rolledEssence: 'social' })).toBe(true);
  for (const consume of ruleRollSources(actor, null, { rolledSkill: 'persuasion', rolledEssence: 'social' }).consumes) {
    await consumeBanked(consume, async () => actor);
  }

  expect(ruleSpecializes(actor, 'persuasion', null, { rolledEssence: 'social' })).toBe(false);

  const fresh = holder('fgtaaitems/_source/Grid_Gifted_MS8KLmY19EyKR1Ww.json');
  expect(await runUse(fresh.item, pay(), { ask: async () => 0 })).toBeTruthy();
  expect(ruleRollSources(fresh.actor, null, { rolledSkill: 'athletics', rolledEssence: 'strength' }).sources).toEqual([]);
  expect(ruleRollSources(fresh.actor, null, { rolledSkill: 'science', rolledEssence: 'smarts' }).sources)
    .toEqual([expect.objectContaining({ label: 'Grid Gifted', edge: true })]);
  expect(ruleSpecializes(fresh.actor, 'science', null, { rolledEssence: 'smarts' })).toBe(false);
});

/* grants3 batch (helpers/grants.mjs): Cross-Training (GI Joe, TF), Split Focus, Branch Perk, Grid Spectrum Echo and
   Prismatic Boon as once-ever pickPerk Uses. The step runs the real grants.mjs#pickPerkFrom over a fake compendium
   index (game.packs); the select dialog answers with the first option it was offered. */

const g3Uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const g3Perk = (pack, name, level, subtype = 'role') => ({ type: 'perk', subtype, name, level, uuid: g3Uuid(pack, name.replace(/\W/g, '')) });
const g3Map = list => Object.fromEntries(list.map((entry, i) => [`k${i}`, entry]));
const G3_INFANTRY = g3Uuid('gi_joe_crb', 'infantry');
const G3_COMMANDO = g3Uuid('gi_joe_crb', 'commando');
const G3_OWN_FOCUS = g3Uuid('gi_joe_crb', 'ownFocus');
const G3_INDEX = [
  { uuid: G3_INFANTRY, type: 'role', name: 'Infantry', system: { items: g3Map([g3Perk('gi_joe_crb', 'Shared Name', 3), g3Perk('gi_joe_crb', 'Infantry Four', 4)]) } },
  { uuid: G3_COMMANDO, type: 'role', name: 'Commando', system: { items: g3Map([
    g3Perk('gi_joe_crb', 'Cmd One', 1), g3Perk('gi_joe_crb', 'Cmd Two', 2), { ...g3Perk('gi_joe_crb', 'Shared Name', 3), uuid: g3Uuid('gi_joe_crb', 'cmdShared') },
    g3Perk('gi_joe_crb', 'Cmd Five', 5), g3Perk('gi_joe_crb', 'Cmd Focus Thing', 2, 'focus'), { type: 'perk', subtype: 'role', name: 'No Level', uuid: g3Uuid('gi_joe_crb', 'noLevel') },
  ]) } },
  { uuid: g3Uuid('tf_crb', 'scout'), type: 'role', name: 'Scout', system: { items: g3Map([g3Perk('tf_crb', 'Scout Two', 2), g3Perk('tf_crb', 'Scout Nine', 9)]) } },
  { uuid: G3_OWN_FOCUS, type: 'focus', name: 'Own Focus', system: { items: g3Map([{ type: 'role', name: 'Infantry', uuid: G3_INFANTRY }, g3Perk('gi_joe_crb', 'Own F', 1, 'focus')]) } },
  { uuid: g3Uuid('gi_joe_crb', 'otherFocus'), type: 'focus', name: 'Other Focus', system: { items: g3Map([{ type: 'role', name: 'Infantry', uuid: G3_INFANTRY }, g3Perk('gi_joe_crb', 'Other F Low', 2, 'focus'), g3Perk('gi_joe_crb', 'Other F High', 9, 'focus')]) } },
  { uuid: g3Uuid('gi_joe_crb', 'foreignFocus'), type: 'focus', name: 'Foreign Focus', system: { items: g3Map([{ type: 'role', name: 'Commando', uuid: G3_COMMANDO }, g3Perk('gi_joe_crb', 'Foreign F', 1, 'focus')]) } },
  { uuid: g3Uuid('pr_crb', 'red'), type: 'role', name: 'Red Ranger', system: { items: g3Map([
    g3Perk('pr_crb', 'Red Two', 2), g3Perk('pr_crb', 'Extra Attack', 4), g3Perk('pr_crb', 'Zord Feature', 3), g3Perk('pr_crb', 'Red Seven', 7),
  ]) } },
  // isAdvanced: Prismatic Boon leaves Advanced Roles out (notAdvanced; the index now carries the field).
  { uuid: g3Uuid('across_the_stars', 'gold'), type: 'role', name: 'Gold Ranger', system: { isAdvanced: true, items: g3Map([g3Perk('across_the_stars', 'Gold Three', 3)]) } },
];

/**
 * A holder for one of these Perks, with its own Role (and Focus), a fake compendium and dialogs. `answer` picks
 * from the offered option values (null = cancel). Returns { actor, item, offered: [labels], press }.
 */
function g3Holder(file, pack, { level = 10, role = 'Infantry', answer = values => values[0] ?? null } = {}) {
  const { actor, item } = holder(file, { system: { level } });
  item.flags = { core: { sourceId: g3Uuid(pack, file.split('_').pop().replace('.json', '')) } };
  const ownRole = G3_INDEX.find(e => e.name == role);
  const list = [
    item,
    { id: 'role1', name: role, type: 'role', flags: { core: { sourceId: ownRole.uuid } }, system: { items: ownRole.system.items } },
    { id: 'focus1', name: 'Own Focus', type: 'focus', flags: { core: { sourceId: G3_OWN_FOCUS } }, system: { items: {} } },
  ];
  actor.items = Object.assign(list, { contents: list, get: id => list.find(i => i.id == id) });
  rebuildIndex(actor);
  const offered = [];
  const press = async () => {
    const saved = { packs: game.packs, Item: global.Item, fromUuid: global.fromUuid, ui: global.ui, applications: foundry.applications, escapeHTML: foundry.utils.escapeHTML };
    game.packs = [{ documentName: 'Item', metadata: { id: 'essence20.fake' }, getIndex: async () => new Map(G3_INDEX.map(e => [e.uuid, e])) }];
    global.fromUuid = async uuid => ({ uuid, name: `Perk ${uuid.split('.').pop()}`, type: 'perk' });
    global.Item = {
      create: async (perk, { parent }) => {
        const created = {
          id: `g${nextId++}`, name: perk.name, type: 'perk', flags: { core: { sourceId: perk.uuid } }, system: {},
          async setFlag(scope, key, value) {
            foundry.utils.setProperty(this.flags, `${scope}.${key}`, value);
          },
        };
        parent.items.push(created);
        return created;
      },
    };
    global.ui = { notifications: { warn: jest.fn() } };
    foundry.utils.escapeHTML = text => text;
    foundry.applications = { ...(foundry.applications ?? {}), api: { ...(foundry.applications?.api ?? {}), DialogV2: { wait: async ({ content }) => {
      const options = [...content.matchAll(/<option value="([^"]+)">([^<]*)</g)];
      offered.push(...options.map(m => m[2]));
      return answer(options.map(m => m[1]));
    } } } };
    try {
      const rule = item.system.rules[useIndex(item)];
      const ctx = stepContext({ actor, item, rule, targets: [] });
      const ok = await runSteps(rule.steps, ctx);
      return { ok, warned: global.ui.notifications.warn.mock.calls.length > 0 };
    } finally {
      Object.assign(global, { Item: saved.Item, fromUuid: saved.fromUuid, ui: saved.ui });
      game.packs = saved.packs;
      foundry.applications = saved.applications;
      foundry.utils.escapeHTML = saved.escapeHTML;
    }
  };

  return { actor, item, offered, press };
}

const g3Granted = (actor, item) => actor.items.filter(i => i.flags?.essence20?.grantedBy == item.id).map(i => i.name);

test('Cross-Training (GI Joe): another GI Joe Role\'s Perk, level 2 to half your level, not one of your own Role\'s names, once', async () => {
  const { actor, item, offered, press } = g3Holder('gijcrbitems/_source/Cross_Training_V4ufZix4uyHjYITJ.json', 'gi_joe_crb');
  expect(grantUseOpen(item)).toBe(true);
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Commando: Cmd Five (5)', 'Commando: Cmd Two (2)']);
  expect(g3Granted(actor, item)).toEqual(['Perk CmdFive']);
  expect(grantUseOpen(item)).toBe(false);

  const low = g3Holder('gijcrbitems/_source/Cross_Training_V4ufZix4uyHjYITJ.json', 'gi_joe_crb', { level: 9 });
  await low.press();
  expect(low.offered).toEqual(['Commando: Cmd Two (2)']);
});

test('Cross-Training (TF): only Transformers Roles', async () => {
  const { actor, item, offered, press } = g3Holder('tfcrbitems/_source/Cross_Training_Swuy85Kou1qbV4H8.json', 'tf_crb');
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Scout: Scout Two (2)']);
  expect(g3Granted(actor, item)).toEqual(['Perk ScoutTwo']);
  expect(grantUseOpen(item)).toBe(false);
});

test('Split Focus: another Focus of your own Role, any Perk subtype, up to half your level, once', async () => {
  const { actor, item, offered, press } = g3Holder('gijcrbitems/_source/Split_Focus_JE6gXmak0TZvk0U1.json', 'gi_joe_crb');
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Other Focus: Other F Low (2)']);
  expect(g3Granted(actor, item)).toEqual(['Perk OtherFLow']);
  expect(grantUseOpen(item)).toBe(false);
});

test('Branch Perk: needs a Branch; then a Role Perk of the Branch up to your level, once', async () => {
  const none = g3Holder('ccitems/_source/Branch_Perk_IZeAhxUAZkdehxAF.json', 'cobra_codex', { level: 3 });
  expect(await none.press()).toEqual({ ok: false, warned: true });
  expect(none.offered).toEqual([]);
  expect(grantUseOpen(none.item)).toBe(true);

  const { actor, item, offered, press } = g3Holder('ccitems/_source/Branch_Perk_IZeAhxUAZkdehxAF.json', 'cobra_codex', { level: 3 });
  actor.flags.essence20.exemplarBranch = G3_COMMANDO;
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Commando: Cmd One (1)', 'Commando: Cmd Two (2)', 'Commando: Shared Name (3)']);
  expect(g3Granted(actor, item)).toEqual(['Perk CmdOne']);
  expect(grantUseOpen(item)).toBe(false);
});

test('Grid Spectrum Echo: another Power Rangers Role\'s Perk up to your level, not Extra Attack / Zord..., once', async () => {
  const { actor, item, offered, press } = g3Holder('atsitems/_source/Grid_Spectrum_Echo_R3sNusi5EbBBB88u.json', 'across_the_stars', { role: 'Red Ranger' });
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Gold Ranger: Gold Three (3)']);
  expect(g3Granted(actor, item)).toEqual(['Perk GoldThree']);
  expect(grantUseOpen(item)).toBe(false);
});

test('Prismatic Boon: any standard (not Advanced) Power Rangers Role\'s Perk at least 3 levels below yours, own Role included, once', async () => {
  const { actor, item, offered, press } = g3Holder('atsitems/_source/Prismatic_Boon_z38SPXkEqeuxuypj.json', 'across_the_stars', { role: 'Red Ranger' });
  expect((await press()).ok).toBe(true);
  expect(offered).toEqual(['Red Ranger: Red Seven (7)', 'Red Ranger: Red Two (2)']);
  expect(g3Granted(actor, item)).toHaveLength(1);
  expect(grantUseOpen(item)).toBe(false);

  const low = g3Holder('atsitems/_source/Prismatic_Boon_z38SPXkEqeuxuypj.json', 'across_the_stars', { level: 9 });
  await low.press();
  expect(low.offered).toEqual(['Red Ranger: Red Two (2)']);
});

test.each([
  ['gijcrbitems/_source/Cross_Training_V4ufZix4uyHjYITJ.json', 'gi_joe_crb'],
  ['tfcrbitems/_source/Cross_Training_Swuy85Kou1qbV4H8.json', 'tf_crb'],
  ['gijcrbitems/_source/Split_Focus_JE6gXmak0TZvk0U1.json', 'gi_joe_crb'],
  ['ccitems/_source/Branch_Perk_IZeAhxUAZkdehxAF.json', 'cobra_codex'],
  ['atsitems/_source/Grid_Spectrum_Echo_R3sNusi5EbBBB88u.json', 'across_the_stars'],
  ['atsitems/_source/Prismatic_Boon_z38SPXkEqeuxuypj.json', 'across_the_stars'],
])('%s: cancelling grants nothing and keeps the button; one granted under the old code stays hidden', async (file, pack) => {
  const { actor, item, offered, press } = g3Holder(file, pack, { answer: () => null });
  actor.flags.essence20.exemplarBranch = G3_COMMANDO;
  expect((await press()).ok).toBe(false);
  expect(offered.length).toBeGreaterThan(0);
  expect(g3Granted(actor, item)).toEqual([]);
  expect(grantUseOpen(item)).toBe(true);
  item.flags.essence20 = { granted: true };
  expect(grantUseOpen(item)).toBe(false);
});

/* Banked batch 3: ally banks and heals (pickAlly), banked Defense bonuses, banks gated on their own unspent
   bonus (rule:banked) and Role Point costs, moved off helpers/banked-buffs.mjs onto Use rules (Battle
   Commander, Personal Sacrifice, Bird's Eye View, Generosity of Spirit, Helping Hand, Whatever Helps, MacGyver,
   Lightspeed Response, Intrafilum, Momentary Blur, Stronger Together, Bait and Switch, Vulnerability, Stargazer,
   Menacing Laugh, Duty of the Silver, Wild Tales). No action is charged, as before. */

const BANKED3_TIC = 'Compendium.essence20.cobra_codex.Item.SUc3emTvPnwB6W93';

/** Another actor on the scene, with no items - the ally a Use picks (by targeting it). */
function banked3Ally({ name = 'Ally', system = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id: `b3a${nextId++}`, uuid: `Actor.b3a${nextId}`, name, type, isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { health: { value: 5, max: 10 }, ...system },
    getFlag(scope, key) {
      return foundry.utils.getProperty(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      foundry.utils.setProperty(this.flags[scope] ??= {}, key, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
  actor.items = { contents: [], get: () => undefined, [Symbol.iterator]: () => [][Symbol.iterator]() };
  rebuildIndex(actor);
  return actor;
}

/** Give a holder a second (rule-less) item, e.g. This, I Command or Terror. */
function banked3Give(actor, uuid, type = 'perk') {
  actor.items.contents.push({ id: `b3i${nextId++}`, type, name: uuid.split('.').pop(), flags: { core: { sourceId: uuid } }, system: {} });
  rebuildIndex(actor);
}

async function banked3Spend(actor, roll) {
  const out = ruleRollSources(actor, null, roll);
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  return out;
}

test('Battle Commander: Edge on the targeted ally\'s next roll, only in round 1 of combat', async () => {
  const { item } = holder('gijcrbitems/_source/Battle_Commander_PIWYZyWFw9EYZeom.json');
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  game.combat = { started: true, id: 'c', round: 2, turn: 0 };
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  game.combat.round = 1;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  const ally = banked3Ally({ name: 'Duke' });
  game.user.targets = new Set([{ actor: ally }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(ruleRollSources(item.parent, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect((await banked3Spend(ally, { item: { type: 'weaponEffect', system: {} } })).sources)
    .toEqual([expect.objectContaining({ label: 'Battle Commander', edge: true })]);
  expect(ruleRollSources(ally, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

test('Personal Sacrifice: ↑1 on the targeted ally\'s next roll; nothing without an ally', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Personal_Sacrifice_PHzAgfYygOH67l1P.json');
  global.ui = { notifications: { warn: jest.fn() } };
  expect(await runUse(item, pay())).toBeNull();
  expect(global.ui.notifications.warn).toHaveBeenCalled();

  const ally = banked3Ally();
  game.user.targets = new Set([{ actor: ally }]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect((await banked3Spend(ally, { rolledSkill: 'persuasion' })).sources)
    .toEqual([expect.objectContaining({ label: 'Personal Sacrifice', shiftUp: 1 })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Personal Sacrifice: This, I Command can double the ↑1 for 1 Psychic to the ally', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Personal_Sacrifice_PHzAgfYygOH67l1P.json');
  banked3Give(actor, BANKED3_TIC);
  const ally = banked3Ally();
  ally.isOwner = false;
  game.user.targets = new Set([{ actor: ally }]);
  const card = await runUse(item, pay(), { ask: async () => 0 });
  expect(card).toContain('DamageForGm');
  expect(ruleRollSources(ally, null, { rolledSkill: 'persuasion' }).sources)
    .toEqual([expect.objectContaining({ label: 'Personal Sacrifice', shiftUp: 2 })]);

  const other = banked3Ally();
  game.user.targets = new Set([{ actor: other }]);
  expect(await runUse(item, pay(), { ask: async () => 1 })).not.toContain('Damage');
  expect(ruleRollSources(other, null, { rolledSkill: 'persuasion' }).sources)
    .toEqual([expect.objectContaining({ shiftUp: 1 })]);
});

test("Bird's Eye View: ↑2 on the targeted ally's next roll, in Alt Mode, once per encounter", async () => {
  const { actor, item } = holder('tsitems/_source/Bird_s_Eye_View_tXFkcJfvuZ1LEUAX.json');
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  actor.system.isTransformed = true;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  const ally = banked3Ally();
  game.user.targets = new Set([{ actor: ally }]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(ally, null, { rolledSkill: 'alertness' }).sources)
    .toEqual([expect.objectContaining({ label: "Bird's Eye View", shiftUp: 2 })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Generosity of Spirit: ↑1 to the ally and ↓1 on your own next roll; not again until yours is spent', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Generosity_of_Spirit_hufRaDWtFbAszTmq.json');
  const ally = banked3Ally();
  game.user.targets = new Set([{ actor: ally }]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(ally, null, { rolledSkill: 'athletics' }).sources)
    .toEqual([expect.objectContaining({ label: 'Generosity of Spirit', shiftUp: 1, shiftDown: 0 })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect((await banked3Spend(actor, { rolledSkill: 'athletics' })).sources)
    .toEqual([expect.objectContaining({ label: 'Generosity of Spirit', shiftUp: 0, shiftDown: 1 })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test.each([
  ['Helping Hand', 'prcrbitems/_source/Helping_Hand_U5xY4e0Wro9XyooS.json', 'system.powers.personal.value', 1, 1, { isMorphed: true }],
  ['Lightspeed Response', 'atsitems/_source/Lightspeed_Response__Form__E3WLZpN7iKL9uzeB.json', 'system.powers.personal.value', 2, 1, { isMorphed: true }],
  ['Whatever Helps', 'mlpcrbitems/_source/Whatever_Helps_NyZxFpc8Aop7PDDa.json', 'system.health.value', 1, 2, {}],
  ['Intrafilum', 'tfcrbitems/_source/Intrafilum_WafAMRknIe5AL40t.json', 'system.energon.normal.value', 1, 1, {}],
])('%s: pays its cost and heals the targeted ally, never past their maximum', async (name, file, costPath, cost, heal, allySystem) => {
  const { actor, item } = holder(file, { system: { powers: { personal: { value: 0 } }, energon: { normal: { value: 0 } } } });
  const index = item.system.rules.findIndex(rule => rule.type == 'Use');
  foundry.utils.setProperty(actor, costPath, cost - 1);
  expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
  foundry.utils.setProperty(actor, costPath, cost + 1);
  expect(useAvailable(item, item.system.rules[index], index)).toBe(true);

  const ally = banked3Ally({ system: { health: { value: 4, max: 10 }, ...allySystem } });
  game.user.targets = new Set([{ actor: ally }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(foundry.utils.getProperty(actor, costPath)).toBe(1);
  expect(ally.system.health.value).toBe(4 + heal);

  foundry.utils.setProperty(actor, costPath, cost);
  ally.system.health.value = 10;
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ally.system.health.value).toBe(10);
});

test('MacGyver: repairs the targeted friendly vehicle 1 Health, at no cost', async () => {
  const { item } = holder('gijcrbitems/_source/MacGyver_EIENttpS41hxvvzn.json');
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  const jeep = banked3Ally({ name: 'Jeep', type: 'vehicle', system: { health: { value: 4, max: 10 } } });
  game.user.targets = new Set([{ actor: jeep }]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(jeep.system.health.value).toBe(5);
  expect(item.system.rules[0].steps[0]).toMatchObject({ do: 'pickAlly', filter: ['target:type:vehicle'] });
});

test('Momentary Blur: 1 Power for +3 Evasion against the next attack; hidden until that is used', async () => {
  const { bankedDefense } = await import('./bank.mjs');
  const { actor, item } = holder('jttitems/_source/Momentary_Blur_MB1UsageEvasion1.json', { system: { powers: { personal: { value: 0 } } } });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  actor.system.powers.personal.value = 2;
  expect(await runUse(item, pay())).toBeTruthy();
  expect(actor.system.powers.personal.value).toBe(1);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect(await bankedDefense(actor, 'toughness')).toBe(0);
  expect(await bankedDefense(actor, 'evasion')).toBe(3);
  expect(await bankedDefense(actor, 'evasion')).toBe(0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Stronger Together: +1 to every Defense of the targeted ally and -1 to yours, each for one attack', async () => {
  const { bankedDefense } = await import('./bank.mjs');
  const { actor, item } = holder('tfcrbitems/_source/Stronger_Together_ZeOj3mmjnXJ7iXj1.json');
  const ally = banked3Ally();
  game.user.targets = new Set([{ actor: ally }]);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(await bankedDefense(ally, 'willpower')).toBe(1);
  expect(await bankedDefense(ally, 'toughness')).toBe(0);
  expect(await bankedDefense(actor, 'evasion')).toBe(-1);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Bait and Switch: a Story Point for Edge on the next Deception or Infiltration test; hidden while unspent', async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { actor, item } = holder('mlpcrbitems/_source/Bait_and_Switch_E6QEmhG9S1skhLLs.json');
  const spent = [];
  let points = 0;
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    points = 2;
    expect(await runUse(item, pay())).toBeTruthy();
    expect(spent).toEqual([1]);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  } finally {
    setStoryPointHelpers(null);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect((await banked3Spend(actor, { rolledSkill: 'infiltration' })).sources)
    .toEqual([expect.objectContaining({ label: 'Bait and Switch', edge: true })]);
  expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
});

test('Vulnerability: ↑1 on the next roll; hidden while unspent', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Vulnerability_LOLY9yLoljdn9319.json');
  expect(await runUse(item, pay())).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect((await banked3Spend(actor, { rolledSkill: 'might' })).sources)
    .toEqual([expect.objectContaining({ label: 'Vulnerability', shiftUp: 1 })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Stargazer: Edge on the next Smarts test, twice per scene, hidden while unspent', async () => {
  const { actor, item } = holder('fgtaaitems/_source/Stargazer_SnAIok2KD1f77DyV.json');
  expect(await runUse(item, pay())).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', rolledEssence: 'strength' }).sources).toEqual([]);
  await banked3Spend(actor, { rolledSkill: 'science', rolledEssence: 'smarts' });
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect((await banked3Spend(actor, { rolledSkill: 'science', rolledEssence: 'smarts' })).sources)
    .toEqual([expect.objectContaining({ label: 'Stargazer', edge: true })]);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test.each([
  ['Menacing Laugh', 'bthitems/_source/Menacing_Laugh_RzQ4LahiaHPl6ZzU.json', 'Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd', 0, 1],
  ['Duty of the Silver', 'atsitems/_source/Duty_of_the_Silver_KhV5GeGIMJNWlWhr.json', null, 2, 0],
])('%s: spends a Role Point (and Power), as the Use says', async (name, file, needs, power, after) => {
  const { actor, item } = holder(file, { system: { powers: { personal: { value: power } } } });
  const points = {
    system: { resource: { value: 0, max: 5 } },
    async update(data) {
      foundry.utils.setProperty(this, 'system.resource.value', data['system.resource.value']);
    },
  };
  actor._getBaseRolePoints = () => points;
  game.combat = { started: true, id: 'c', round: 1, turn: 0 };
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  points.system.resource.value = 2;
  if (needs) {
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    banked3Give(actor, needs);
  }

  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  expect(await runUse(item, pay())).toBeTruthy();
  expect(points.system.resource.value).toBe(1);
  expect(actor.system.powers.personal.value).toBe(after);
  if (needs) {
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    game.combat.turn = 1;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  }
});

test('Wild Tales: Edge on the next Smarts or Social test, picked when used, once per encounter', async () => {
  const { actor, item } = holder('mlpcrbitems/_source/Wild_Tales_FkBnUmwiOQgNnmLs.json');
  expect(await runUse(item, pay(), { ask: async () => null })).toBeNull();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  expect(await runUse(item, pay(), { ask: async () => 1 })).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(ruleRollSources(actor, null, { rolledSkill: 'science', rolledEssence: 'smarts' }).sources).toEqual([]);
  expect((await banked3Spend(actor, { rolledSkill: 'persuasion', rolledEssence: 'social' })).sources)
    .toEqual([expect.objectContaining({ label: 'Wild Tales', edge: true })]);
});

/* Batch tfzord (tf2 + zord2 slices): Electro-Disruptor, Dominant Thought, the Deflecting Weapons. */

function tfzordFoe(statuses = []) {
  const foe = {
    name: 'Foe', statuses: new Set(statuses), isOwner: true,
    system: { defenses: { willpower: { total: 14 }, cleverness: { total: 11 } } },
  };
  foe.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? foe.statuses.add(id) : foe.statuses.delete(id)));
  return foe;
}

test('Electro-Disruptor: outside combat, Technology against Willpower or Cleverness; a success Mesmerizes', async () => {
  const { actor, item } = holder('tfcrbitems/_source/Electro_Disruptor_Boj0xRCCDi1dpoQe.json');
  const foe = tfzordFoe();
  let success = true;
  actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [{ results: [{ multiplier: 1 }] }] })) };
  game.user.targets = new Set([{ actor: foe }]);
  const paid = pay();
  expect(await runUse(item, paid, { ask: async () => 1 })).toBeTruthy();
  expect(paid).toHaveBeenCalledWith('standard');
  expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology', dif: '11' }), actor);
  expect(foe.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: true });

  success = false;
  const resisted = tfzordFoe();
  game.user.targets = new Set([{ actor: resisted }]);
  expect(await runUse(item, pay(), { ask: async () => 0 })).toContain('shakes off');
  expect(actor._dice.rollSkill).toHaveBeenLastCalledWith(expect.objectContaining({ dif: '14' }), actor);
  expect(resisted.toggleStatusEffect).not.toHaveBeenCalled();

  game.combat = { started: true, id: 'c', round: 1, turn: 0 };
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Dominant Thought: no roll for a willing target; Persuasion against Willpower, with Edge on a sleeper', async () => {
  const { actor, item } = holder('eocitems/_source/Dominant_Thought_aHgTDkCIBHjBnt0L.json');
  actor._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ multiplier: 1 }] }] })) };
  game.user.targets = new Set([{ actor: tfzordFoe() }]);
  expect(await runUse(item, pay(), { ask: async () => 0 })).toContain('no roll needed');
  expect(actor._dice.rollSkill).not.toHaveBeenCalled();

  expect(await runUse(item, pay(), { ask: async () => 1 })).toContain('takes the thought');
  expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '14' }), actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);

  game.user.targets = new Set([{ actor: tfzordFoe(['asleep']) }]);
  expect(await runUse(item, pay(), { ask: async () => 1 })).toBeTruthy();
  // The Edge rides on the roll itself: nothing is left banked if it is cancelled.
  expect(actor._dice.rollSkill).toHaveBeenLastCalledWith(expect.objectContaining({ skill: 'persuasion', edge: true }), actor);
  expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
});

test.each([
  ['Combat Nunchaku', 'qgtgitems/_source/Combat_Nunchaku_qfelSaHiGknDHjXj.json', { evasion: 11, toughness: 10 }, { evasion: 10, toughness: 11 }],
  ['Excalibur', 'qgtgitems/_source/Excalibur_GNuActe2QRVyWH3o.json', { evasion: 10, toughness: 11 }, { evasion: 12, toughness: 10 }],
])('%s: weapon or shield, a Move action to switch; no attacks as a shield', async (name, file, weapon, shield) => {
  const { ruleDerived } = await import('./adapter.mjs');
  const { zord2WeaponUnusable } = await import('../helpers/extensions/zord2/unusable.mjs');
  const defenses = () => ({ toughness: { total: 10, string: '10' }, evasion: { total: 10, string: '10' } });
  const { actor, item } = holder(file, { system: { defenses: defenses() } });
  const totals = () => ({ evasion: actor.system.defenses.evasion.total, toughness: actor.system.defenses.toughness.total });
  ruleDerived(actor);
  expect(totals()).toEqual(weapon);
  expect(zord2WeaponUnusable(item)).toBeNull();

  const paid = pay();
  expect(await runUse(item, paid)).toContain('Now used as a shield');
  expect(paid).toHaveBeenCalledWith('move');
  actor.system.defenses = defenses();
  ruleDerived(actor);
  expect(totals()).toEqual(shield);
  expect(actor.system.defenses[shield.evasion > 10 ? 'evasion' : 'toughness'].string).toBe(`10 + ${Math.max(shield.evasion, shield.toughness) - 10} (${name})`);
  expect(zord2WeaponUnusable(item)).toBe('E20.Zord2WeaponInShieldMode');

  expect(await runUse(item, pay())).toContain('Now used as a weapon');
  actor.system.defenses = defenses();
  ruleDerived(actor);
  expect(totals()).toEqual(weapon);
  expect(zord2WeaponUnusable(item)).toBeNull();

  // An unequipped one gives nothing.
  item.system.equipped = false;
  actor.system.defenses = defenses();
  ruleDerived(actor);
  expect(totals()).toEqual({ evasion: 10, toughness: 10 });
});

/* Banked batch 4: Uses whose ally pick comes before the cost (Heart of the Team, You Got This!, Failure Isn't an
   Option), self-or-ally heals (Tourniquet Line Chef, Field Repair), a heal + a two-Defense bank (Remove & Rebuild),
   temporary Health and an "until your next turn" Defense bonus (Sword And Board), moved off
   helpers/banked-buffs.mjs onto Use rules. No action is charged, as before. Reuses the banked batch 3 helpers. */

/** A Role Points item (Quips & Speeches) the holder spends from. */
function banked4Points(actor, value) {
  const points = {
    system: { resource: { value, max: 5 } },
    async update(data) {
      foundry.utils.setProperty(this, 'system.resource.value', data['system.resource.value']);
    },
  };
  actor._getBaseRolePoints = () => points;
  return points;
}

/** Put the holder and some allies on a canvas (all one disposition, all in range), with a picker answer. */
function banked4Canvas(actor, allies, answer) {
  const items = a => {
    a.items.find ??= fn => a.items.contents.find(fn);
    a.items.filter ??= fn => a.items.contents.filter(fn);
  };

  [actor, ...allies].forEach(items);
  const own = { actor, document: { disposition: 1 }, center: {} };
  actor.getActiveTokens = () => [own];
  global.canvas = {
    tokens: { placeables: [own, ...allies.map(ally => ({ actor: ally, document: { disposition: 1 }, center: {} }))] },
    grid: { measurePath: () => ({ distance: 5 }) },
  };
  const wait = jest.fn(async options => answer(options));
  foundry.applications = { api: { DialogV2: { wait } } };
  return wait;
}

function banked4Clear() {
  global.canvas = undefined;
  delete foundry.applications;
}

test('Heart of the Team: 1 Quips & Speeches for its own ↑ on the targeted ally\'s next roll', async () => {
  const { actor, item } = holder('prcrbitems/_source/Heart_of_the_Team_7EyU0Hf6T3YVels4.json');
  const points = banked4Points(actor, 0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  points.system.resource.value = 2;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  item.system.advances = { ...item.system.advances, currentValue: 2 };
  const ally = banked3Ally({ name: 'Zack' });
  game.user.targets = new Set([{ actor: ally }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(points.system.resource.value).toBe(1);
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect((await banked3Spend(ally, { rolledSkill: 'athletics' })).sources)
    .toEqual([expect.objectContaining({ label: 'Heart of the Team', shiftUp: 2 })]);
  expect(ruleRollSources(ally, null, { rolledSkill: 'athletics' }).sources).toEqual([]);

  // No advance value yet: ↑1.
  item.system.advances = { ...item.system.advances, currentValue: null };
  expect(await runUse(item, pay())).toBeTruthy();
  expect(ruleRollSources(ally, null, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(points.system.resource.value).toBe(0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Heart of the Team: the ally is picked before the point is paid - no ally, no cost', async () => {
  const { actor, item } = holder('prcrbitems/_source/Heart_of_the_Team_7EyU0Hf6T3YVels4.json');
  const points = banked4Points(actor, 2);
  global.ui = { notifications: { warn: jest.fn() } };
  expect(await runUse(item, pay())).toBeNull();
  expect(global.ui.notifications.warn).toHaveBeenCalled();
  expect(points.system.resource.value).toBe(2);
});

test('Heart of the Team: This, I Command can double it for 1 Psychic to the ally', async () => {
  const { actor, item } = holder('prcrbitems/_source/Heart_of_the_Team_7EyU0Hf6T3YVels4.json');
  banked4Points(actor, 2);
  banked3Give(actor, BANKED3_TIC);
  item.system.advances = { ...item.system.advances, currentValue: 3 };
  const ally = banked3Ally();
  ally.isOwner = false;
  game.user.targets = new Set([{ actor: ally }]);
  expect(await runUse(item, pay(), { ask: async () => 0 })).toContain('DamageForGm');
  expect(ruleRollSources(ally, null, { rolledSkill: 'athletics' }).sources)
    .toEqual([expect.objectContaining({ label: 'Heart of the Team', shiftUp: 6 })]);
});

test('You Got This!: 1 Quips & Speeches for temporary Health (its own advance value) on the targeted ally', async () => {
  const { actor, item } = holder('prcrbitems/_source/You_Got_This__FDQFMkT2fUjxVxZY.json');
  const points = banked4Points(actor, 0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  points.system.resource.value = 2;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  item.system.advances = { ...item.system.advances, currentValue: 3 };
  const ally = banked3Ally({ system: { health: { value: 5, max: 10, bonus: 0 } } });
  game.user.targets = new Set([{ actor: ally }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(ally.system.health).toEqual({ value: 5, max: 10, bonus: 3 });
  expect(points.system.resource.value).toBe(1);
  expect(item.system.rules[0].steps[0]).toMatchObject({ do: 'pickAlly', within: 30 });

  // No ally: nothing paid.
  game.user.targets = new Set();
  global.ui = { notifications: { warn: jest.fn() } };
  expect(await runUse(item, pay())).toBeNull();
  expect(points.system.resource.value).toBe(1);
});

test("Failure Isn't an Option: a Story Point for 1 temporary Health on the targeted ally", async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { item } = holder('iafav2items/_source/Failure_Isn_t_an_Option_EtIdcWWazTDKo3fH.json');
  const spent = [];
  let points = 0;
  try {
    setStoryPointHelpers({ canSpendForActor: (a, n) => points >= n, spendForActor: async (a, n) => spent.push(n) });
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    points = 1;
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    const downed = banked3Ally({ system: { health: { value: 0, max: 10, bonus: 0 } } });
    game.user.targets = new Set([{ actor: downed }]);
    expect(await runUse(item, pay())).toBeTruthy();
    expect(spent).toEqual([1]);
    expect(downed.system.health).toEqual({ value: 0, max: 10, bonus: 1 });
  } finally {
    setStoryPointHelpers(null);
  }
});

test("Failure Isn't an Option: the picker offers only allies at 0 Health, and a cancelled pick costs nothing", async () => {
  const { setStoryPointHelpers } = await import('./steps.mjs');
  const { actor, item } = holder('iafav2items/_source/Failure_Isn_t_an_Option_EtIdcWWazTDKo3fH.json');
  const downed = banked3Ally({ name: 'Downed', system: { health: { value: 0, max: 10, bonus: 0 } } });
  const healthy = banked3Ally({ name: 'Healthy', system: { health: { value: 5, max: 10, bonus: 0 } } });
  const spent = [];
  const wait = banked4Canvas(actor, [downed, healthy], ({ content }) => {
    expect(content).toContain(downed.id);
    expect(content).not.toContain(healthy.id);
    return 'cancel';
  });
  try {
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: async (a, n) => spent.push(n) });
    expect(await runUse(item, pay())).toBeNull();
    expect(wait).toHaveBeenCalled();
    expect(spent).toEqual([]);
    expect(downed.system.health.bonus).toBe(0);
  } finally {
    setStoryPointHelpers(null);
    banked4Clear();
  }
});

test('Remove & Rebuild: revives the targeted 0-Health ally to 1 Health and banks +1 Toughness and Evasion for one attack', async () => {
  const { bankedDefense } = await import('./bank.mjs');
  const { item } = holder('tfcrbitems/_source/Remove___Rebuild_q63dZJjGuZHcE2gH.json');
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  const downed = banked3Ally({ system: { health: { value: 0, max: 10 } } });
  game.user.targets = new Set([{ actor: downed }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(downed.system.health.value).toBe(1);
  expect(await bankedDefense(downed, 'willpower')).toBe(0);
  expect(await bankedDefense(downed, 'evasion')).toBe(1);
  expect(await bankedDefense(downed, 'toughness')).toBe(0);
  expect(item.system.rules[0].steps[0]).toMatchObject({ do: 'pickAlly', filter: ['target:data:system.health.value<=0'] });
});

test.each([
  ['Field Repair', 'tfcrbitems/_source/Field_Repair_a8aIMf7h41eg8wCN.json', true],
  ['Tourniquet Line Chef', 'wtnvcgitems/_source/Tourniquet_Line_Chef_fxH2GPkDGvJEpI8s.json', false],
])('%s: heals the targeted ally 1, never past their maximum, at no cost', async (name, file, oncePerScene) => {
  const { item } = holder(file);
  const ally = banked3Ally({ system: { health: { value: 10, max: 10 } } });
  game.user.targets = new Set([{ actor: ally }]);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(ally.system.health.value).toBe(10);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(!oncePerScene);
});

test.each([
  ['Field Repair', 'tfcrbitems/_source/Field_Repair_a8aIMf7h41eg8wCN.json'],
  ['Tourniquet Line Chef', 'wtnvcgitems/_source/Tourniquet_Line_Chef_fxH2GPkDGvJEpI8s.json'],
])('%s: the picker offers yourself too', async (name, file) => {
  const { actor, item } = holder(file);
  const ally = banked3Ally({ name: 'Cecil' });
  const wait = banked4Canvas(actor, [ally], ({ content }) => {
    expect(content).toContain(actor.id);
    expect(content).toContain(ally.id);
    return actor.id;
  });
  try {
    expect(await runUse(item, pay())).toBeTruthy();
    expect(wait).toHaveBeenCalled();
    expect(actor.system.health.value).toBe(6);
    expect(ally.system.health.value).toBe(5);
  } finally {
    banked4Clear();
  }
});

test('Sword And Board: out of combat, the picked bonus is used up by the next attack', async () => {
  const { bankedDefense } = await import('./bank.mjs');
  const { actor, item } = holder('tfcrbitems/_source/Sword_And_Board_4ArjV6NInx6snUaZ.json');
  expect(await runUse(item, pay(), { ask: async () => null })).toBeNull();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  const paid = pay();
  expect(await runUse(item, paid, { ask: async () => 0 })).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(await bankedDefense(actor, 'evasion')).toBe(0);
  expect(await bankedDefense(actor, 'toughness')).toBe(3);
  expect(await bankedDefense(actor, 'toughness')).toBe(0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);

  // The split options bank each Defense's own part.
  expect(await runUse(item, pay(), { ask: async () => 2 })).toBeTruthy();
  expect(await bankedDefense(actor, 'toughness')).toBe(2);
  expect(await bankedDefense(actor, 'evasion')).toBe(1);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

test('Sword And Board: in combat, every attack gets it until your next turn starts; once per turn', async () => {
  const { bankedDefense } = await import('./bank.mjs');
  const { actor, item } = holder('tfcrbitems/_source/Sword_And_Board_4ArjV6NInx6snUaZ.json');
  const other = banked3Ally();
  game.combat = { started: true, id: 'c', round: 1, turn: 0, turns: [{ actor }, { actor: other }] };
  expect(await runUse(item, pay(), { ask: async () => 3 })).toBeTruthy();
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
  expect(await bankedDefense(actor, 'evasion')).toBe(2);
  expect(await bankedDefense(actor, 'evasion')).toBe(2);
  expect(await bankedDefense(actor, 'toughness')).toBe(1);

  game.combat.turn = 1;
  expect(await bankedDefense(actor, 'evasion')).toBe(2);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);

  game.combat.round = 2;
  game.combat.turn = 0;
  expect(await bankedDefense(actor, 'evasion')).toBe(0);
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
});

/* diceB: dice.mjs region B - Lock Down's hit and Impulsive's Initiative bank. */

test('Lock Down: an attack that hits leaves the target Immobilized; a miss or a spell does not', async () => {
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  const { actor } = holder('tfcrbitems/_source/Lock_Down_NELFIhFMZXPlXaWc.json');
  const foe = { name: 'Foe', isOwner: true, statuses: new Set() };
  foe.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? foe.statuses.add(id) : foe.statuses.delete(id)));
  await fireTriggers(actor, 'hit', { roll: { isAttack: false }, outcome: 'success', targets: [foe] });
  await fireTriggers(actor, 'miss', { roll: { isAttack: true, isMelee: true }, outcome: 'failure', targets: [foe] });
  expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  await fireTriggers(actor, 'hit', { roll: { isAttack: true, isMelee: true }, outcome: 'success', targets: [foe] });
  expect(foe.toggleStatusEffect).toHaveBeenCalledWith('immobilized', { active: true });
  expect(foe.statuses.has('immobilized')).toBe(true);
});

test("Impulsive: rolling Initiative banks one ↓1 for the next Skill Test", async () => {
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  const { actor } = holder('tfcrbitems/_source/Impulsive_V5GfafYii5GSMtzr.json');
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  await fireTriggers(actor, 'initiativeRolled');
  // A re-roll before the next test doesn't bank a second one.
  await fireTriggers(actor, 'initiativeRolled');
  const out = ruleRollSources(actor, null, { rolledSkill: 'athletics' });
  expect(out.sources).toHaveLength(1);
  expect(out.sources[0]).toMatchObject({ shiftDown: 1, label: 'Impulsive' });
  for (const consume of out.consumes) {
    await consumeBanked(consume, async () => actor);
  }

  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
});

/* tonight batch (helpers/grants.mjs): Skin Tempering x3 and Zeta Skin Transplant (flags alterationWorn), Integrated
   Basic/Advanced Weapon (integrated + flags droneWeapon) and Safety First (system availability) as once-ever pickGrant
   Uses with overrides; S.P.D. Asset as a once-ever choose Use; and the plain Alt Mode chassis' "get the attack back" Use
   (was helpers/extensions/tf2/modes.mjs's tf2AltModeAttacks button). */

const TONIGHT_ROWS = [
  { uuid: 'T.scopeS', type: 'upgrade', name: 'Scope', system: { availability: 'standard', type: 'weapon' } },
  { uuid: 'T.plateS', type: 'upgrade', name: 'Plate S', system: { availability: 'standard', type: 'armor' } },
  { uuid: 'T.plateL', type: 'upgrade', name: 'Plate L', system: { availability: 'limited', type: 'armor' } },
  { uuid: 'T.plateR', type: 'upgrade', name: 'Plate R', system: { availability: 'restricted', type: 'armor' } },
  { uuid: 'T.plateP', type: 'upgrade', name: 'Plate P', system: { availability: 'prototype', type: 'armor' } },
  { uuid: 'T.gunS', type: 'weapon', name: 'Gun S', system: { availability: 'standard' } },
  { uuid: 'T.gunL', type: 'weapon', name: 'Gun L', system: { availability: 'limited' } },
  { uuid: 'T.toolKit', type: 'gear', name: 'Tool Kit', system: { gearType: 'kits' } },
  { uuid: 'T.medBag', type: 'gear', name: 'Medical Bag', system: { gearType: 'equipment' } },
  { uuid: 'T.medKit', type: 'gear', name: 'Medicine Kit', system: { gearType: 'kits' } },
];

/** grantFakes over TONIGHT_ROWS, keeping every grantCopy option (flags, system...). */
function tonightFakes(cancelAt = -1) {
  const calls = [];
  const granted = [];
  let picks = 0;
  return {
    calls, granted,
    helpers: {
      findItems: async ({ type, availabilities, matches }) => {
        calls.push({ type, availabilities });
        return TONIGHT_ROWS.filter(row => row.type == type && (!availabilities || availabilities.includes(row.system.availability)) && (!matches || matches(row)));
      },
      pickOne: async (title, rows) => (picks++ == cancelAt ? null : rows[0]?.uuid ?? null),
      grantCopy: async (who, uuid, options) => {
        granted.push({ who, uuid, ...options });
        return { name: uuid };
      },
    },
  };
}

test.each([
  ['ccitems/_source/Standard_Skin_Tempering_0DQYk8jWOPkur9GQ.json', 'standard', 'T.plateS'],
  ['ccitems/_source/Limited_Skin_Tempering_XmFMrfsM3PH4GQBG.json', 'limited', 'T.plateL'],
  ['ccitems/_source/Restricted_Skin_Tempering_A7eEbdF3e9aaXj7S.json', 'restricted', 'T.plateR'],
  ['ccitems/_source/Zeta_Skin_Transplant_UTJumLUCsoKuUfVT.json', 'prototype', 'T.plateP'],
])('%s: a %s armor upgrade counted as worn (alterationWorn), once; a cancelled pick keeps the button', async (file, tier, uuid) => {
  const { actor, item } = holder(file);
  const none = tonightFakes(0);
  expect(await pressGrant(item, none)).toBe(false);
  expect(none.granted).toEqual([]);
  expect(grantUseOpen(item)).toBe(true);

  const fakes = tonightFakes();
  expect(await pressGrant(item, fakes)).toBe(true);
  expect(fakes.calls).toEqual([{ type: 'upgrade', availabilities: [tier] }]);
  expect(fakes.granted).toEqual([{ who: actor, uuid, grantedBy: item, integrated: false, flags: { alterationWorn: true }, system: {} }]);
  expect(grantUseOpen(item)).toBe(false);
});

test.each([
  ['gijcrbitems/_source/Integrated_Basic_Weapon_6x7H1Br7te7T3klR.json', 'standard', 'T.gunS'],
  ['gijcrbitems/_source/Integrated_Advanced_Weapon_QCuxONjk27SKggQw.json', 'limited', 'T.gunL'],
])('%s: the drone gains a %s weapon, Integrated and flagged droneWeapon, once', async (file, tier, uuid) => {
  const { actor, item } = holder(file);
  const fakes = tonightFakes();
  expect(await pressGrant(item, fakes)).toBe(true);
  expect(fakes.calls).toEqual([{ type: 'weapon', availabilities: [tier] }]);
  expect(fakes.granted).toEqual([{ who: actor, uuid, grantedBy: item, integrated: true, flags: { droneWeapon: true }, system: {} }]);
  expect(grantUseOpen(item)).toBe(false);
});

test('Safety First: a medicine kit, set to Limited, once', async () => {
  const { actor, item } = holder('gijcrbitems/_source/Safety_First_hLWet58M7NV6c0Sn.json');
  const fakes = tonightFakes();
  expect(await pressGrant(item, fakes)).toBe(true);
  expect(fakes.calls).toEqual([{ type: 'gear', availabilities: null }]);
  expect(fakes.granted).toEqual([{ who: actor, uuid: 'T.medKit', grantedBy: item, integrated: false, flags: {}, system: { availability: 'limited' } }]);
  expect(grantUseOpen(item)).toBe(false);
});

test('S.P.D. Asset: five Delta Blasters, the Patrol Cycle note, Xenotech, or nothing when closed - once', async () => {
  const blasters = 'Compendium.essence20.across_the_stars.Item.4oahai24Cxroir20';
  const previous = global.fromUuid;
  global.fromUuid = jest.fn(async () => ({ name: 'Delta Blaster', toObject: () => ({ _id: 'x', name: 'Delta Blaster', type: 'weapon', system: { items: {} } }) }));
  try {
    const closed = holder('atsitems/_source/S_P_D__Asset_CFK7VW0uFK2dtfCo.json');
    closed.actor.createEmbeddedDocuments = jest.fn(async () => []);
    expect(await runUse(closed.item, pay(), { ask: async () => null })).toBeNull();
    expect(closed.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(grantUseOpen(closed.item)).toBe(true);

    const { actor, item } = holder('atsitems/_source/S_P_D__Asset_CFK7VW0uFK2dtfCo.json');
    actor.createEmbeddedDocuments = jest.fn(async () => []);
    const paid = pay();
    expect(await runUse(item, paid, { ask: async () => 0 })).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(global.fromUuid).toHaveBeenCalledWith(blasters);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
      type: 'weapon', system: { items: {}, quantity: 5 }, _stats: { compendiumSource: blasters }, flags: { essence20: { grantedBy: item.id } },
    })]);
    expect(grantUseOpen(item)).toBe(false);

    const cycle = holder('atsitems/_source/S_P_D__Asset_CFK7VW0uFK2dtfCo.json');
    cycle.actor.createEmbeddedDocuments = jest.fn(async () => []);
    expect(await runUse(cycle.item, pay(), { ask: async () => 2 })).toContain('Delta Patrol Cycle');
    expect(cycle.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(grantUseOpen(cycle.item)).toBe(false);

    const xeno = holder('atsitems/_source/S_P_D__Asset_CFK7VW0uFK2dtfCo.json');
    const fakes = tonightFakes();
    expect(await pressGrant(xeno.item, fakes, async () => 4)).toBe(true);
    expect(fakes.calls).toEqual([{ type: 'weapon', availabilities: ['limited'] }]);
    expect(fakes.granted.map(g => g.uuid)).toEqual(['T.gunL']);
    expect(grantUseOpen(xeno.item)).toBe(false);
  } finally {
    global.fromUuid = previous;
  }
});

test.each([
  'ccitems/_source/Standard_Skin_Tempering_0DQYk8jWOPkur9GQ.json',
  'ccitems/_source/Limited_Skin_Tempering_XmFMrfsM3PH4GQBG.json',
  'ccitems/_source/Restricted_Skin_Tempering_A7eEbdF3e9aaXj7S.json',
  'ccitems/_source/Zeta_Skin_Transplant_UTJumLUCsoKuUfVT.json',
  'gijcrbitems/_source/Integrated_Basic_Weapon_6x7H1Br7te7T3klR.json',
  'gijcrbitems/_source/Integrated_Advanced_Weapon_QCuxONjk27SKggQw.json',
  'gijcrbitems/_source/Safety_First_hLWet58M7NV6c0Sn.json',
  'atsitems/_source/S_P_D__Asset_CFK7VW0uFK2dtfCo.json',
])('%s: an item already granted under the old code keeps its button hidden', (file) => {
  const { item } = holder(file);
  item.flags = { essence20: { granted: true } };
  expect(grantUseOpen(item)).toBe(false);
});

test.each([
  ['eocitems/_source/Pillar__Extended__j0CJWQ858tbQvVUs.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['eocitems/_source/Pillar__Long__SroTzxuu57HoaN9V.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['eocitems/_source/Speaker__Common__Aerial__ilL3CyLQDydjxBHf.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['eocitems/_source/Speaker__Common__Ground__GPW2T5OEC0KtlJpX.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['eocitems/_source/Speaker__Long__Aerial__wwFXrMqJd0YJHqkX.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['eocitems/_source/Speaker__Long__Ground__48zFIrJCoULshGtm.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Champion_IFssZkdjKb6vcYfk.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Cutter__Common__5sxhsXAHh97KTpwa.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Cutter__Long__FlN4FCnbTP7RRz8K.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Lookout_ZS3kX8oKogmsH6OK.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Outrider__Common__NaF9feAfujLYwDfO.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Outrider__Long__WYlv5KoOv8WTUtKN.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Rainmaker_OlLBvRl06PVw9OQx.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Support_hr00Kzgshnz67400.json', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m'],
  ['tfcrbitems/_source/Seeker_RXTZuPJnnAlkgHX2.json', 'Compendium.essence20.tf_crb.Item.3L0eAnm4GVoQi7Df'],
  ['dditems/_source/Salvaged_cGGEXSdCI170AaM4.json', 'Compendium.essence20.decepticon_directive.Item.leQVbl8vdpkwiCdw'],
  ['dditems/_source/Mini_Con__Mini_Vehicle__Aerial__oSn5EyMwso8Z1Ohh.json', 'Compendium.essence20.decepticon_directive.Item.WrSVycvwI2mlmp2y'],
  ['dditems/_source/Mini_Con__Mini_Vehicle__Ground__JVIOxmSpPwPQDY1z.json', 'Compendium.essence20.decepticon_directive.Item.WrSVycvwI2mlmp2y'],
  ['tsitems/_source/Behemoth__Huge__hF2rJtS3SzcjqnLr.json', 'Compendium.essence20.technorganic_secrets.Item.e2LbSl8llOCJ2I6o'],
  ['tsitems/_source/Behemoth__Large__qZQyZDntWJdNeDQy.json', 'Compendium.essence20.technorganic_secrets.Item.e2LbSl8llOCJ2I6o'],
])('%s: a Use gives the special attack back while the actor lacks it', async (file, uuid) => {
  const { actor, item } = holder(file);
  const index = useIndex(item);
  const previous = global.fromUuid;
  global.fromUuid = jest.fn(async () => ({ name: 'Ram', toObject: () => ({ _id: 'x', name: 'Ram', type: 'weapon', system: { items: {} } }) }));
  try {
    expect(item.system.rules[0]).toMatchObject({ type: 'Grant', uuid, skipIfOwned: true });
    expect(useAvailable(item, item.system.rules[index], index)).toBe(true);
    actor.createEmbeddedDocuments = jest.fn(async () => []);
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(global.fromUuid).toHaveBeenCalledWith(uuid);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
      type: 'weapon', _stats: { compendiumSource: uuid }, flags: { essence20: { grantedBy: item.id } },
    })]);
    actor.items.contents.push({ id: 'w', type: 'weapon', flags: {}, _stats: { compendiumSource: uuid }, system: {} });
    expect(useAvailable(item, item.system.rules[index], index)).toBe(false);
  } finally {
    global.fromUuid = previous;
  }
});

/* diceD batch: post-roll riders from dice.mjs#_rollSkillHelper moved onto hit / afterRoll Triggers - Tire Strike,
   Metallikato, Show of Force, Sideswipe (driven scope) and the Psycho Strike Snag Effect. */

function diceDFoe(name = 'Foe', type = 'playerCharacter') {
  const foe = { id: `f${nextId++}`, uuid: `Actor.f${nextId}`, name, type, isOwner: true, statuses: new Set(), flags: {}, system: {} };
  foe.toggleStatusEffect = jest.fn(async (id, { active }) => (active ? foe.statuses.add(id) : foe.statuses.delete(id)));
  foe.update = async data => {
    for (const [key, value] of Object.entries(data)) {
      foundry.utils.setProperty(foe, key, value);
    }
  };

  return foe;
}

const diceDAttack = (system = {}) => ({ id: `e${nextId++}`, type: 'weaponEffect', flags: {}, system });

test('Tire Strike: a Critical Success hit with it knocks the target Prone', async () => {
  const { actor, item } = holder('atsitems/_source/Tire_Strike_Effect_ujiunrLwEBepTcze.json');
  const foe = diceDFoe();
  const roll = { item, isAttack: true, isMelee: true };
  await fireTriggers(actor, 'hit', { roll, outcome: 'success', targets: [foe] });
  await fireTriggers(actor, 'miss', { roll, outcome: 'failure', targets: [foe] });
  await fireTriggers(actor, 'hit', { roll: { ...roll, item: diceDAttack() }, outcome: 'crit', targets: [foe] });
  expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  await fireTriggers(actor, 'hit', { roll, outcome: 'crit', targets: [foe] });
  expect(foe.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
});

test('Metallikato: a melee Critical Success hit in Bot Mode knocks the target Prone', async () => {
  const { actor } = holder('dditems/_source/Metallikato_ouLZnb7j0kAfCrLx.json', { system: { isTransformed: false } });
  const foe = diceDFoe();
  const melee = { item: diceDAttack({ classification: { style: 'melee' } }), isAttack: true, isMelee: true };
  await fireTriggers(actor, 'hit', { roll: melee, outcome: 'success', targets: [foe] });
  await fireTriggers(actor, 'hit', { roll: { ...melee, isMelee: false }, outcome: 'crit', targets: [foe] });
  actor.system.isTransformed = true;
  await fireTriggers(actor, 'hit', { roll: melee, outcome: 'crit', targets: [foe] });
  // The old check was isTransformed === false: an actor with no Alt Mode field at all never trips.
  delete actor.system.isTransformed;
  await fireTriggers(actor, 'hit', { roll: melee, outcome: 'crit', targets: [foe] });
  expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  actor.system.isTransformed = false;
  await fireTriggers(actor, 'hit', { roll: melee, outcome: 'crit', targets: [foe] });
  expect(foe.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
});

test('Show of Force: a Might attack Critical Success Frightens every enemy within 20 ft', async () => {
  const { actor } = holder('dditems/_source/Show_of_Force_8BXIvBamlet1BQ2l.json');
  const near = diceDFoe('Near');
  const far = diceDFoe('Far');
  const friend = diceDFoe('Friend');
  const place = (who, x, disposition) => {
    const token = { actor: who, center: { x, y: 0 }, document: { disposition } };
    who.getActiveTokens = () => [token];
    return token;
  };

  global.canvas = {
    tokens: { placeables: [place(actor, 0, 1), place(near, 15, -1), place(far, 40, -1), place(friend, 5, 1)] },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
  try {
    const might = { item: diceDAttack({ classification: { skill: 'might', style: 'melee' } }), isAttack: true, isMelee: true };
    const targeting = { item: diceDAttack({ classification: { skill: 'targeting', style: 'ranged' } }), isAttack: true, isMelee: false };
    await fireTriggers(actor, 'afterRoll', { roll: might, outcome: 'success' });
    await fireTriggers(actor, 'afterRoll', { roll: targeting, outcome: 'crit' });
    expect(near.toggleStatusEffect).not.toHaveBeenCalled();
    await fireTriggers(actor, 'afterRoll', { roll: might, outcome: 'crit' });
    expect(near.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
    expect(far.toggleStatusEffect).not.toHaveBeenCalled();
    expect(friend.toggleStatusEffect).not.toHaveBeenCalled();
  } finally {
    delete global.canvas;
  }
});

test("Sideswipe: the driver's vehicle knocks a character on foot Prone with a Ram or Flyby hit", async () => {
  const { actor: driver } = holder('iafav2items/_source/Sideswipe_1THAJ83WAviS14f0.json');
  const vehicle = {
    id: `v${nextId++}`, uuid: 'Actor.sideswipeTruck', name: 'Truck', type: 'vehicle', statuses: new Set(), flags: {},
    items: { contents: [] }, system: { actors: { a: { uuid: driver.uuid, vehicleRole: 'driver' } } },
  };
  const previous = global.fromUuidSync;
  global.fromUuidSync = uuid => (uuid == driver.uuid ? driver : null);
  try {
    const foe = diceDFoe();
    const car = diceDFoe('Car', 'vehicle');
    const ram = { item: diceDAttack({ isRam: true }), isAttack: true, isMelee: true };
    const flyby = { item: diceDAttack({ isFlyby: true }), isAttack: true, isMelee: true };
    const plain = { item: diceDAttack(), isAttack: true, isMelee: true };
    await fireTriggers(vehicle, 'hit', { roll: plain, outcome: 'success', targets: [foe] });
    await fireTriggers(vehicle, 'hit', { roll: ram, outcome: 'success', targets: [car] });
    // The driver's own attacks aren't the vehicle's.
    await fireTriggers(driver, 'hit', { roll: ram, outcome: 'success', targets: [foe] });
    expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
    expect(car.toggleStatusEffect).not.toHaveBeenCalled();
    await fireTriggers(vehicle, 'hit', { roll: ram, outcome: 'success', targets: [foe] });
    expect(foe.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    foe.toggleStatusEffect.mockClear();
    await fireTriggers(vehicle, 'hit', { roll: flyby, outcome: 'crit', targets: [foe] });
    expect(foe.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
    // A passenger's Sideswipe doesn't reach the vehicle.
    foe.toggleStatusEffect.mockClear();
    vehicle.system.actors.a.vehicleRole = 'passenger';
    await fireTriggers(vehicle, 'hit', { roll: ram, outcome: 'success', targets: [foe] });
    expect(foe.toggleStatusEffect).not.toHaveBeenCalled();
  } finally {
    global.fromUuidSync = previous;
  }
});

test('Psycho Strike Snag Effect: a hit with it banks a Snag on the target\'s next roll', async () => {
  const { bankedEntries } = await import('./bank.mjs');
  const { actor, item } = holder('fmmcitems/_source/Psycho_Strike_Snag_Effect_Sq4EwIr6RIYmZ5K6.json');
  const foe = diceDFoe();
  await fireTriggers(actor, 'hit', { roll: { item: diceDAttack(), isAttack: true, isMelee: true }, outcome: 'success', targets: [foe] });
  expect(bankedEntries(foe)).toEqual([]);
  await fireTriggers(actor, 'hit', { roll: { item, isAttack: true, isMelee: true }, outcome: 'success', targets: [foe] });
  expect(bankedEntries(foe)).toMatchObject([{ snag: true, edge: false, shiftUp: 0, shiftDown: 0, uses: 1, when: [] }]);
});

/* Transformers Alt Mode special attacks: grant + fitAttack (added Trigger, get-it-back Use). */

test('Alt Mode special attacks: the Charger grants Ram and Flyby fitted to 2; a Natural chassis asks Blunt or Sharp', async () => {
  const charger = fromPack('eocitems/_source/' + readdirSync(join(ROOT, 'packs', 'eocitems', '_source')).find(n => n.endsWith('_QNhq3rRVOu1EfeyD.json'))).system.rules;
  expect(charger.filter(r => r.type == 'Trigger').map(r => [r.event, r.steps[0].uuid, r.steps[1].damage])).toEqual([
    ['added', 'Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m', 2], ['added', 'Compendium.essence20.tf_crb.Item.3L0eAnm4GVoQi7Df', 2]]);
  expect(charger.filter(r => r.type == 'Use')).toHaveLength(2);
  const { specialAttackUpdates } = await import('../helpers/weapon-fit.mjs');
  const weapon = { system: { traits: ['blunt'], items: { a: { type: 'weaponEffect', damageType: 'blunt', damageValue: 1, classification: { skill: 'might' } } } } };
  const effects = [{ id: 'e1', system: { damageType: 'blunt', damageValue: 1, classification: { skill: 'might' } } }];
  expect(specialAttackUpdates(weapon, effects, { type: 'sharp' }).effectUpdates).toEqual([{ _id: 'e1', 'system.damageType': 'sharp' }]);
});

/* dmgC batch (rounds 14-15): "+N damage on your next attack" banks (the bank step's `damage`) - Environmental
   Assist and Power Strike as Use rules, Energy Rebuttal as a takesDamage Trigger. */

const dmgCAttack = (traits = null) => ({
  item: traits
    ? { type: 'weaponEffect', flags: { essence20: { parentId: 'pw' } }, system: {}, parent: { items: { get: () => ({ id: 'pw', type: 'weapon', flags: {}, system: { traits } }) } } }
    : { type: 'weaponEffect', flags: {}, system: {} },
});

test("Environmental Assist: 1 Power banks +1 damage on your own and each Morphed ally's next attack", async () => {
  const { actor, item } = holder('bthitems/_source/Environmental_Assist_5gPWxUEkFKDQf6lM.json', { system: personalPower(2) });
  const morphed = banked3Ally({ name: 'Billy', system: { isMorphed: true } });
  const unmorphed = banked3Ally({ name: 'Zack', system: { isMorphed: false } });
  banked4Canvas(actor, [morphed, unmorphed], () => null);
  try {
    expect(await runUse(item, pay())).toBeTruthy();
  } finally {
    banked4Clear();
  }

  expect(actor.system.powers.personal.value).toBe(1);
  for (const who of [actor, morphed]) {
    expect(ruleRollSources(who, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect((await banked3Spend(who, dmgCAttack())).sources).toEqual([expect.objectContaining({ label: 'Environmental Assist', damage: 1 })]);
    expect(ruleRollSources(who, null, dmgCAttack()).sources).toEqual([]);
  }

  expect(ruleRollSources(unmorphed, null, dmgCAttack()).sources).toEqual([]);

  // No Power, no button.
  actor.system.powers.personal.value = 0;
  expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
});

test('Energy Rebuttal: Energy damage taken while Defending banks +2 damage on the next attack, once per encounter', async () => {
  const { actor } = holder('ttsgitems/_source/Energy_Rebuttal_EnergyRebuttal10.json');
  await fireTriggers(actor, 'takesDamage', r12Hit(3, 'fire'));
  expect(ruleRollSources(actor, null, dmgCAttack()).sources).toEqual([]);

  actor.statuses.add('defending');
  await fireTriggers(actor, 'takesDamage', r12Hit(3, 'sharp'));
  expect(ruleRollSources(actor, null, dmgCAttack()).sources).toEqual([]);

  await fireTriggers(actor, 'takesDamage', r12Hit(3, 'fire'));
  expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
  expect((await banked3Spend(actor, dmgCAttack())).sources).toEqual([expect.objectContaining({ label: 'Energy Rebuttal', damage: 2 })]);
  expect(ruleRollSources(actor, null, dmgCAttack()).sources).toEqual([]);

  await fireTriggers(actor, 'takesDamage', r12Hit(3, 'laser'));
  expect(ruleRollSources(actor, null, dmgCAttack()).sources).toEqual([]);
});

test('Power Strike: 1-3 Personal Power for that much damage on the next Power Weapon attack', async () => {
  const { actor, item } = holder('prcrbitems/_source/Power_Strike_DT0TOaHfuJzkgUeO.json', { system: personalPower(5) });
  global.foundry.applications = { api: { DialogV2: { prompt: jest.fn(async () => 3) } } };
  try {
    expect(await runUse(item, pay())).toBeTruthy();
  } finally {
    delete global.foundry.applications;
  }

  expect(actor.system.powers.personal.value).toBe(2);
  expect(ruleRollSources(actor, null, dmgCAttack([])).sources).toEqual([]);
  expect((await banked3Spend(actor, dmgCAttack(['powerWeapon']))).sources).toEqual([expect.objectContaining({ label: 'Power Strike', damage: 3 })]);
  expect(ruleRollSources(actor, null, dmgCAttack(['powerWeapon'])).sources).toEqual([]);
});

/* misc7 batch: Ready for Action (a Use on combat:first in round 1) and Flux Additives (an afterRoll Trigger on an
   Energy Affinity attack, once per turn). */

test('Ready for Action: first in the Initiative order in round 1, a Free bonus attack, once per encounter', async () => {
  const { getLedger } = await import('../helpers/action-economy.mjs');
  const { actor, item, available } = bonusHolder('ghpfitems/_source/Ready_for_Action_NSweXvUIBdqLiOsz.json');
  expect(available()).toBe(false);
  actionCombat(actor, { round: 2 });
  expect(available()).toBe(false);
  const combatant = actionCombat(actor);
  game.combat.turns = [{ actor: { id: 'other', uuid: 'Actor.other' } }, combatant];
  expect(available()).toBe(false);
  game.combat.turns = [combatant];
  expect(available()).toBe(true);
  const paid = pay();
  expect(await runUse(item, paid)).toBeTruthy();
  expect(paid).not.toHaveBeenCalled();
  expect(getLedger(actor).bonusAttacks).toEqual([{ source: 'Ready for Action', cost: 'free', filter: null, psychicOnMiss: 0 }]);
  expect(available()).toBe(false);
});

test('Flux Additives: an attack dealing the Energy Affinity Element gives a Free action back, once per turn', async () => {
  const { registerCheck } = await import('./predicate.mjs');
  const { isEnergyAffinityElementAttack } = await import('../helpers/energy-affinity.mjs');
  registerCheck('energyAffinityAttack', (who, option, ctx) => isEnergyAffinityElementAttack(who, ctx?.item));
  const { getRemaining } = await import('../helpers/action-economy.mjs');
  const { actor } = holder('dditems/_source/Flux_Additives_8JrHJjPowijfAMCE.json', { system: { ...ACTION_BUDGET } });
  const affinity = { id: 'affinity', type: 'perk', name: 'Energy Affinity', flags: { core: { sourceId: 'Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA' } }, system: { choice: 'fire' }, parent: actor };
  const all = [...actor.items.contents, affinity];
  actor.items = { contents: all, get: id => all.find(i => i.id == id), find: fn => all.find(fn), [Symbol.iterator]: () => all[Symbol.iterator]() };
  rebuildIndex(actor);
  actionCombat(actor);
  const attack = damageType => ({ type: 'weaponEffect', flags: {}, system: { damageType, classification: { style: 'melee', skill: 'brawn' } } });
  const free = () => getRemaining(actor).free;
  const start = free();
  await fireTriggers(actor, 'afterRoll', { roll: { item: attack('cold'), isAttack: true }, outcome: 'success' });
  expect(free()).toBe(start);
  await fireTriggers(actor, 'afterRoll', { roll: { item: attack('fire'), isAttack: true }, outcome: 'failure' });
  expect(free()).toBe(start + 1);
  await fireTriggers(actor, 'afterRoll', { roll: { item: attack('fire'), isAttack: true }, outcome: 'success' });
  expect(free()).toBe(start + 1);
});
