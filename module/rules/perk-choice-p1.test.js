/**
 * Perk choice P1 (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.2): the engine additions - ChoiceSet's shared sources and new
 * params (only / essence / notHeld / held / excludeCopies / count / rename / required / primary), @choiceCount, list picks
 * read by tags / DerivedStat / chosenOf, DerivedStat append, DamageType `to: "{choice.x}"`, the per-actor ask queue,
 * re-picking from the Rules tab, the pickSubPerk step, the static checks and the editor forms.
 */
import { jest } from '@jest/globals';
import './plugins/index.mjs';
import { askRule, choiceLabel, choiceOptions, copiesHold, initialState, renameUpdate, setUpItem } from './lifecycle.mjs';
import { asksPending, queueAsk } from './ask-queue.mjs';
import { changeChoice, rulesContext } from './sheet.mjs';
import { pickOptions, runSteps, stepContext, stepErrors, STEP_TYPES } from './steps.mjs';
import { summarizeRule, validateRule } from './types.mjs';
import { evaluate, contextFor } from './predicate.mjs';
import { rebuildIndex } from './index.mjs';
import { ruleDamageType, ruleDerived } from './adapter.mjs';
import { chosenList, chosenOf, hasChosen } from './choice-read.mjs';
import { perkChoiceProblems } from './choice-checks.mjs';
import { resolveValue } from './formula.mjs';
import { RULE_FORMS, STEP_FORMS } from './editor-spec.mjs';
import { fieldsHtml, readInput } from './editor-render.mjs';
import { repickSubPerks, setSubPerkHelpers, subPerkOptions } from './plugins/picks/pick-sub-perk.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = 'Compendium.essence20.test.Item.perk0000000000001';

let nextId = 1;

function makeItem(rules, extra = {}) {
  const item = {
    id: `i${nextId++}`, name: extra.name ?? 'Test Perk', type: extra.type ?? 'perk', flags: extra.flags ?? {},
    _stats: { compendiumSource: extra.source ?? SOURCE }, system: { rules, ...(extra.system ?? {}) }, isOwner: true,
  };
  item.update = jest.fn(async update => {
    for (const [path, value] of Object.entries(update)) {
      global.foundry.utils.setProperty(item, path, value);
    }
  });
  item.delete = jest.fn(async () => {
    const list = item.parent?.items?.contents;
    if (list?.includes(item)) {
      list.splice(list.indexOf(item), 1);
    }
  });
  return item;
}

function makeActor(items = [], system = {}) {
  const actor = {
    id: `a${nextId++}`, uuid: `Actor.a${nextId}`, documentName: 'Actor', type: 'playerCharacter', name: 'Tester', statuses: new Set(),
    system: {
      level: 5, skills: { athletics: { shift: 'd4' }, might: { shift: 'd6' }, culture: { shift: 'd8' } }, essences: {},
      senses: { hearing: { acute: true }, sight: { acute: false }, smell: { acute: false } },
      environments: ['arctic'],
      movement: { ground: { base: 30 }, aerial: { base: 0 }, swim: { base: 10 } },
      ...system,
    },
    isOwner: true,
  };
  actor.items = { contents: items, get: id => items.find(item => item.id == id) };
  for (const item of items) {
    item.parent = actor;
  }

  actor.createEmbeddedDocuments = jest.fn(async () => []);
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    for (const id of ids) {
      const index = items.findIndex(item => item.id == id);
      if (index >= 0) {
        items.splice(index, 1);
      }
    }
  });
  return actor;
}

const add = (actor, item) => {
  actor.items.contents.push(item);
  item.parent = actor;
  return item;
};

beforeAll(() => {
  global.CONFIG = {
    E20: {
      skills: { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight', culture: 'E20.SkillCulture', science: 'E20.SkillScience' },
      skillToEssence: { athletics: 'strength', might: 'strength', culture: 'smarts', science: 'smarts' },
      essences: { any: 'E20.EssenceAny', strength: 'E20.EssenceStrength', smarts: 'E20.EssenceSmarts' },
      defenses: { toughness: 'E20.DefenseToughness' },
      senses: { hearing: 'E20.SenseHearing', sight: 'E20.SenseSight', smell: 'E20.SenseSmell' },
      environments: { arctic: 'E20.EnvironmentArctic', desert: 'E20.EnvironmentDesert', jungle: 'E20.EnvironmentJungle' },
      movementTypes: { aerial: 'E20.MovementTypeAerial', ground: 'E20.MovementTypeGround', swim: 'E20.MovementTypeSwim' },
      damageTypes: { blunt: 'E20.DamageBlunt', fire: 'E20.DamageFire' },
      elementDamageTypes: { cold: 'E20.DamageCold', fire: 'E20.DamageFire' },
      fightingStyle: { triggerHappy: 'E20.FightingStyleTriggerHappy', brawler: 'E20.FightingStyleBrawler' },
      fieldSkills: ['culture', 'science'],
    },
  };
  global.game = { user: { id: 'u1', isGM: true, targets: new Set() }, users: {}, combat: null, i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` } };
  global.ui = { notifications: { warn: jest.fn(), error: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      deepClone: value => JSON.parse(JSON.stringify(value)),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
    },
  };
});

afterEach(() => setSubPerkHelpers(null));

/** An ask that answers from a list, recording each call's offered values. */
function answers(...values) {
  const offered = [];
  const ask = jest.fn(async (rule, item, { options } = {}) => {
    offered.push(options.map(option => option.value));
    return values.shift() ?? null;
  });
  return { ask, offered };
}

/* -------------------------------------------- */
/*  Sources and filters                          */
/* -------------------------------------------- */

describe('ChoiceSet sources: the pick step\'s lists', () => {
  test('config tables (table or path), a list table with labels, sense / environment / movement / element / damageType', () => {
    expect(choiceOptions({ from: 'config', table: 'fightingStyle' }).map(o => o.value)).toEqual(['triggerHappy', 'brawler']);
    expect(choiceOptions({ from: 'config', path: 'fightingStyle' })).toEqual(choiceOptions({ from: 'config', table: 'fightingStyle' }));
    expect(choiceOptions({ from: 'config', table: 'fieldSkills', labels: 'skills' })).toEqual([{ value: 'culture', label: 'E20.SkillCulture' }, { value: 'science', label: 'E20.SkillScience' }]);
    expect(choiceOptions({ from: 'config', table: 'nope' })).toEqual([]);
    expect(choiceOptions({ from: 'sense' }).map(o => o.value)).toEqual(['hearing', 'sight', 'smell']);
    expect(choiceOptions({ from: 'environment' }).map(o => o.value)).toEqual(['arctic', 'desert', 'jungle']);
    expect(choiceOptions({ from: 'movement' }).map(o => o.value)).toEqual(['aerial', 'ground', 'swim']);
    expect(choiceOptions({ from: 'element' }).map(o => o.value)).toEqual(['cold', 'fire']);
    expect(choiceOptions({ from: 'damageType' }).map(o => o.value)).toEqual(['blunt', 'fire']);
  });

  test('a ChoiceSet and a pick step with the same settings offer the same list', () => {
    const actor = makeActor();
    for (const spec of [{ from: 'config', table: 'fightingStyle' }, { from: 'sense', notHeld: true }, { from: 'movement', held: true }, { from: 'element', only: ['fire'] }]) {
      expect(choiceOptions(spec, { actor })).toEqual(pickOptions(spec, { actor, targets: [], vars: {} }));
    }
  });

  test('only narrows any source; essence narrows Skills; the Skill list is the config table', () => {
    expect(choiceOptions({ from: 'skill', only: ['culture', 'science'] }).map(o => o.value)).toEqual(['culture', 'science']);
    expect(choiceOptions({ from: 'skill', essence: 'smarts' }).map(o => o.value)).toEqual(['culture', 'science']);
    expect(choiceOptions({ from: 'list', options: ['a', 'b', 'c'], only: ['b'] })).toEqual([{ value: 'b', label: 'b' }]);
    expect(choiceOptions({ from: 'damageType', only: ['fire'] }).map(o => o.value)).toEqual(['fire']);
    expect(pickOptions({ from: 'damageType', only: ['blunt'] }, { actor: null, targets: [] }).map(o => o.value)).toEqual(['blunt']);
  });

  test('notHeld leaves out what the actor has, held offers only that; a label lookup sees every option', () => {
    const actor = makeActor();
    expect(choiceOptions({ from: 'sense', notHeld: true }, { actor }).map(o => o.value)).toEqual(['sight', 'smell']);
    expect(choiceOptions({ from: 'environment', notHeld: true }, { actor }).map(o => o.value)).toEqual(['desert', 'jungle']);
    expect(choiceOptions({ from: 'movement', held: true }, { actor }).map(o => o.value)).toEqual(['ground', 'swim']);
    expect(choiceOptions({ from: 'movement', notHeld: true }, { actor }).map(o => o.value)).toEqual(['aerial']);
    expect(choiceOptions({ from: 'sense', notHeld: true }, { actor, allOptions: true })).toHaveLength(3);
    expect(choiceLabel({ from: 'sense', notHeld: true }, 'hearing', { actor })).toBe('E20.SenseHearing');
    // No actor (a compendium item's Rules tab): the whole list.
    expect(choiceOptions({ from: 'sense', notHeld: true })).toHaveLength(3);
  });

  test('labels: a list pick joins its labels; nothing picked is empty', () => {
    expect(choiceLabel({ from: 'skill' }, ['might', 'culture'])).toBe('E20.SkillMight, E20.SkillCulture');
    expect(choiceLabel({ from: 'skill' }, 'mystery')).toBe('mystery');
    expect(choiceLabel({ from: 'skill' }, undefined)).toBe('');
    expect(choiceLabel({ from: 'skill' }, [])).toBe('');
  });
});

describe('ChoiceSet params: the catalogue', () => {
  test('the new params are settings, with their own checks', () => {
    const ok = { type: 'ChoiceSet', key: 'skill', from: 'skill', essence: 'smarts', only: ['culture'], count: '2 + @choiceCount', excludeCopies: true, rename: true, required: true, primary: true, legacy: 'system.choice' };
    expect(validateRule(ok)).toEqual([]);
    expect(validateRule({ type: 'ChoiceSet', key: 'style', from: 'config', table: 'fightingStyle', exceptAt: 'system.x', labels: 'skills' })).toEqual([]);
    expect(validateRule({ type: 'ChoiceSet', key: 'sense', from: 'sense', notHeld: true })).toEqual([]);
    expect(validateRule({ type: 'ChoiceSet', key: 'sense', from: 'element' })).toEqual([]);
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'config' })).toContain('a config choice needs table (a CONFIG.E20 key)');
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'skill', notHeld: true })).toContain('notHeld / held need from: sense, environment or movement');
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'sense', notHeld: true, held: true })).toContain('notHeld and held can\'t both be set');
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'essence', essence: 'smarts' })).toContain('essence needs from: skill');
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'skill', count: '2 +' }).join()).toMatch(/count:/);
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'skill', primary: 'yes' })).toContain('primary must be true or false');
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'target' })).toContainEqual(expect.stringMatching(/^from must be one of/));
    // A plug-in source is a ChoiceSet source too.
    expect(validateRule({ type: 'ChoiceSet', key: 'x', from: 'conditions' })).toEqual([]);
  });

  test('primary: true picks the key Phase 0\'s reader uses', () => {
    const item = makeItem([{ type: 'ChoiceSet', key: 'a', from: 'skill' }, { type: 'ChoiceSet', key: 'b', from: 'skill', primary: true }],
      { flags: { essence20: { rules: { choices: { a: 'might', b: 'culture' } } } } });
    expect(chosenOf(item)).toBe('culture');
  });
});

/* -------------------------------------------- */
/*  Asking                                       */
/* -------------------------------------------- */

describe('count: one item holding a list', () => {
  test('asks count times, each leaving out the earlier picks; stored as a list every reader sees', async () => {
    const item = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: 2 }]);
    const actor = makeActor([item]);
    const { ask, offered } = answers('might', 'culture');
    const update = await initialState(item, actor, { ask });
    expect(update).toEqual({ 'flags.essence20.rules.choices.skill': ['might', 'culture'] });
    expect(offered[1]).not.toContain('might');
    await item.update(update);
    expect(chosenOf(item)).toEqual(['might', 'culture']);
    expect(chosenList(item)).toEqual(['might', 'culture']);
    expect(hasChosen(item, 'culture')).toBe(true);
    expect(hasChosen(item, 'athletics')).toBe(false);
  });

  test('no Skill twice: a repeated answer is refused and asked again', async () => {
    const item = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: 2 }]);
    const actor = makeActor([item]);
    const { ask } = answers('might', 'might', 'athletics');
    expect(await askRule(item.system.rules[0], item, actor, { ask })).toEqual(['might', 'athletics']);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test('a scalar count is still a list; running out keeps what was picked; a cancel keeps nothing', async () => {
    const one = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: 1 }]);
    makeActor([one]);
    expect(await askRule(one.system.rules[0], one, one.parent, { ask: answers('might').ask })).toEqual(['might']);

    const few = makeItem([{ type: 'ChoiceSet', key: 'opt', from: 'list', options: ['a', 'b'], count: 3 }]);
    makeActor([few]);
    expect(await askRule(few.system.rules[0], few, few.parent, { ask: answers('a', 'b').ask })).toEqual(['a', 'b']);

    const cancelled = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: 2 }]);
    makeActor([cancelled]);
    expect(await askRule(cancelled.system.rules[0], cancelled, cancelled.parent, { ask: answers('might', null).ask })).toBeNull();
  });

  test('@choiceCount: the ChoiceCount adds naming the item\'s book source (Grid Tap)', async () => {
    const tap = makeItem([{ type: 'ChoiceCount', items: [SOURCE], add: 1 }], { source: 'Compendium.essence20.test.Item.gridTap000000001' });
    const item = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: '1 + @choiceCount' }]);
    const actor = makeActor([tap, item]);
    rebuildIndex(actor);
    expect(resolveValue('@choiceCount', { actor, item })).toBe(1);
    expect(resolveValue('@choiceCount', { actor: null, item })).toBe(0);
    const { ask } = answers('might', 'culture');
    expect(await askRule(item.system.rules[0], item, actor, { ask })).toEqual(['might', 'culture']);
  });
});

describe('excludeCopies', () => {
  test('leaves out what other copies hold (a rules pick or an old system.choice), and re-checks on confirm', async () => {
    const rule = { type: 'ChoiceSet', key: 'skill', from: 'skill', excludeCopies: true, legacy: 'system.choice' };
    const first = makeItem([rule], { flags: { essence20: { rules: { choices: { skill: 'might' } } } } });
    const old = makeItem([rule], { system: { choice: 'athletics' } });
    const other = makeItem([rule], { source: 'Compendium.essence20.test.Item.someoneElse00001', flags: { essence20: { rules: { choices: { skill: 'culture' } } } } });
    const item = makeItem([rule]);
    const actor = makeActor([first, old, other, item]);
    expect(copiesHold(rule, item, actor).sort()).toEqual(['athletics', 'might']);

    // The other copy takes "science" while this dialog is open: the answer is refused and asked again.
    const offered = [];
    const ask = jest.fn(async (r, i, { options }) => {
      offered.push(options.map(option => option.value));
      if (offered.length == 1) {
        first.flags.essence20.rules.choices.skill = ['might', 'science'];
        return 'science';
      }

      return 'culture';
    });
    expect(await askRule(rule, item, actor, { ask })).toBe('culture');
    expect(offered[0]).toEqual(['culture', 'science']);
    expect(offered[1]).toEqual(['culture']);
  });
});

describe('rename and required', () => {
  test('rename: "Name (Pick)"; a re-pick replaces the suffix; an old copy\'s suffix comes off first', async () => {
    const rule = { type: 'ChoiceSet', key: 'style', from: 'config', table: 'fightingStyle', rename: true };
    const item = makeItem([rule], { name: 'Fighting Style' });
    const actor = makeActor([item]);
    const update = await initialState(item, actor, { ask: answers('brawler').ask });
    expect(update).toEqual({ 'flags.essence20.rules.choices.style': 'brawler', name: 'Fighting Style (E20.FightingStyleBrawler)', 'flags.essence20.rules.baseName': 'Fighting Style' });
    await item.update(update);

    await changeChoice(item, 0, { ask: answers('triggerHappy').ask });
    expect(item.name).toBe('Fighting Style (E20.FightingStyleTriggerHappy)');
    expect(item.flags.essence20.rules.choices.style).toBe('triggerHappy');

    const legacy = makeItem([{ ...rule, legacy: 'system.choice' }], { name: 'Fighting Style (E20.FightingStyleBrawler)', system: { choice: 'brawler' } });
    makeActor([legacy]);
    expect(renameUpdate(legacy, { style: 'triggerHappy' }).name).toBe('Fighting Style (E20.FightingStyleTriggerHappy)');
    expect(renameUpdate(makeItem([{ type: 'ChoiceSet', key: 'x', from: 'skill' }]))).toBeNull();
  });

  test('required: a cancelled ask fails a drop; a granted copy is asked again until picked (user ruling 2026-10-07)', async () => {
    const rule = { type: 'ChoiceSet', key: 'skill', from: 'skill', required: true };
    const dropped = makeItem([rule, { type: 'Toggle', key: 'on' }]);
    const actor = makeActor([dropped]);
    const cancelled = [];
    expect(await initialState(dropped, actor, { ask: answers(null).ask, cancelled })).toEqual({});
    expect(cancelled).toEqual(['skill']);
    expect(await setUpItem(dropped, actor, { ask: answers(null).ask })).toBe(false);
    expect(dropped.delete).toHaveBeenCalled();

    // Granted (by a Role or another item): no cancelling - asked again until something is picked.
    const granted = add(actor, makeItem([rule], { flags: { essence20: { grantedBy: 'x' } } }));
    const twice = answers(null, null, 'speed');
    expect(await setUpItem(granted, actor, { ask: twice.ask })).toBe(true);
    expect(twice.ask).toHaveBeenCalledTimes(3);
    expect(granted.flags.essence20.rules.choices.skill).toBe('speed');
    expect(granted.delete).not.toHaveBeenCalled();

    // A Role grant (parentId) too; with nothing ever picked it stops after maxReasks, kept unpicked, never deleted.
    const stubborn = add(actor, makeItem([rule], { flags: { essence20: { parentId: 'role' } } }));
    const never = answers();
    expect(await setUpItem(stubborn, actor, { ask: never.ask, maxReasks: 2 })).toBe(true);
    expect(never.ask).toHaveBeenCalledTimes(3);
    expect(stubborn.delete).not.toHaveBeenCalled();

    const picked = add(actor, makeItem([rule]));
    expect(await setUpItem(picked, actor, { ask: answers('might').ask })).toBe(true);
    expect(picked.flags.essence20.rules.choices.skill).toBe('might');
  });
});

describe('one dialog at a time', () => {
  test('two items added together: the second ask opens after the first is stored, and sees it', async () => {
    const rule = { type: 'ChoiceSet', key: 'skill', from: 'skill', excludeCopies: true };
    const one = makeItem([rule]);
    const two = makeItem([rule]);
    const actor = makeActor([one, two]);
    let release;
    const open = [];
    const ask = jest.fn((r, item, { options }) => {
      open.push({ item: item.id, options: options.map(option => option.value) });
      return item === one ? new Promise(resolve => {
        release = () => resolve('might');
      }) : Promise.resolve(options[0].value);
    });
    const first = setUpItem(one, actor, { ask });
    const second = setUpItem(two, actor, { ask });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(open).toHaveLength(1);
    expect(asksPending(actor)).toBe(true);
    release();
    await Promise.all([first, second]);
    expect(open).toHaveLength(2);
    expect(open[1].options).not.toContain('might');
    expect(two.flags.essence20.rules.choices.skill).not.toBe('might');
    expect(asksPending(actor)).toBe(false);
  });

  test('a failing ask doesn\'t block the queue; each actor has its own', async () => {
    const actor = { uuid: 'Actor.q1' };
    await expect(queueAsk(actor, async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await queueAsk(actor, async () => 'next')).toBe('next');
    const order = [];
    await Promise.all([queueAsk({ uuid: 'Actor.q2' }, async () => order.push('a')), queueAsk({ uuid: 'Actor.q3' }, async () => order.push('b'))]);
    expect(order.sort()).toEqual(['a', 'b']);
  });
});

describe('re-picking from the Rules tab', () => {
  test('a list pick asks its whole list again; the tab shows every label', async () => {
    const item = makeItem([{ type: 'ChoiceSet', key: 'skill', from: 'skill', count: 2 }], { flags: { essence20: { rules: { choices: { skill: ['might', 'culture'] } } } } });
    makeActor([item]);
    expect(rulesContext(item).rules[0].choice).toEqual({ value: ['might', 'culture'], label: 'E20.SkillMight, E20.SkillCulture' });
    await changeChoice(item, 0, { ask: answers('athletics', 'science').ask });
    expect(item.flags.essence20.rules.choices.skill).toEqual(['athletics', 'science']);
    // Cancelled: the old pick stays.
    await changeChoice(item, 0, { ask: answers(null).ask });
    expect(item.flags.essence20.rules.choices.skill).toEqual(['athletics', 'science']);
  });
});

/* -------------------------------------------- */
/*  Reading a list pick                          */
/* -------------------------------------------- */

describe('rules read every entry of a list pick', () => {
  test('a tag with {choice.x} is true when any entry makes it true; not: negates the whole', () => {
    const item = makeItem([], { flags: { essence20: { rules: { choices: { skill: ['might', 'culture'], one: 'might' } } } } });
    const actor = makeActor([item]);
    const ctx = skill => contextFor({ self: actor, ruleItem: item, rolledSkill: skill });
    expect(evaluate(['skill:{choice.skill}'], ctx('culture'))).toBe(true);
    expect(evaluate(['skill:{choice.skill}'], ctx('athletics'))).toBe(false);
    expect(evaluate(['not:skill:{choice.skill}'], ctx('might'))).toBe(false);
    expect(evaluate(['not:skill:{choice.skill}'], ctx('athletics'))).toBe(true);
    expect(evaluate(['skill:{choice.one}'], ctx('might'))).toBe(true);
    expect(evaluate(['skill:{choice.missing}'], ctx('might'))).toBe(false);
    expect(evaluate(['rule:choiceHas:skill:culture'], ctx('x'))).toBe(true);
  });

  test('DerivedStat: a list pick in the path applies once per entry; a single pick as before', () => {
    const list = makeItem([{ type: 'DerivedStat', path: 'system.skills.{choice.skill}.shiftUp', value: 2 }], { flags: { essence20: { rules: { choices: { skill: ['might', 'culture'] } } } } });
    const one = makeItem([{ type: 'DerivedStat', path: 'system.skills.{choice.skill}.shiftUp', value: 1 }], { flags: { essence20: { rules: { choices: { skill: 'athletics' } } } } });
    const none = makeItem([{ type: 'DerivedStat', path: 'system.skills.{choice.skill}.shiftUp', value: 5 }]);
    const actor = makeActor([list, one, none]);
    ruleDerived(actor);
    expect(actor.system.skills.might.shiftUp).toBe(2);
    expect(actor.system.skills.culture.shiftUp).toBe(2);
    expect(actor.system.skills.athletics.shiftUp).toBe(1);
  });

  test('DamageType to: "{choice.element}" fills the pick; no pick, no change', () => {
    const item = makeItem([{ type: 'DamageType', to: '{choice.element}' }], { flags: { essence20: { rules: { choices: { element: 'fire' } } } } });
    const actor = makeActor([item]);
    rebuildIndex(actor);
    expect(ruleDamageType(actor, null, {})).toBe('fire');
    const unpicked = makeActor([makeItem([{ type: 'DamageType', to: '{choice.element}' }])]);
    rebuildIndex(unpicked);
    expect(ruleDamageType(unpicked, null, {})).toBeNull();
  });
});

describe('DerivedStat append', () => {
  test('adds the picked entries to a list, each once; a list pick adds every entry', () => {
    const one = makeItem([{ type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' }], { flags: { essence20: { rules: { choices: { environment: 'desert' } } } } });
    const list = makeItem([{ type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' }], { flags: { essence20: { rules: { choices: { environment: ['desert', 'jungle'] } } } } });
    const fixed = makeItem([{ type: 'DerivedStat', path: 'system.environments', op: 'append', value: ['arctic', 'urban'] }]);
    const unpicked = makeItem([{ type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' }]);
    const actor = makeActor([one, list, fixed, unpicked]);
    const before = actor.system.environments;
    ruleDerived(actor);
    expect(actor.system.environments).toEqual(['arctic', 'desert', 'jungle', 'urban']);
    expect(before).toEqual(['arctic']);
  });

  test('validated and summarized', () => {
    expect(validateRule({ type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' })).toEqual([]);
    expect(validateRule({ type: 'DerivedStat', path: 'system.environments', op: 'append', value: 2 })).toContain('append needs value: text or a list of texts');
    expect(validateRule({ type: 'DerivedStat', path: 'system.environments', op: 'append', value: 'x', stage: 'early' })).toContain('append can\'t be stage early');
    expect(summarizeRule({ type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' })).toMatch(/gains the picked environment/);
  });
});

/* -------------------------------------------- */
/*  pickSubPerk                                  */
/* -------------------------------------------- */

describe('pickSubPerk', () => {
  const A = 'Compendium.essence20.test.Item.subA000000000001';
  const B = 'Compendium.essence20.test.Item.subB000000000001';
  const C = 'Compendium.essence20.test.Item.subC000000000001';

  function gridScience(count = 2) {
    const rule = { type: 'Trigger', event: 'added', removeOnStop: true, steps: [{ do: 'pickSubPerk', key: 'perks', count }] };
    return makeItem([rule], { name: 'Grid Science', system: { items: { k1: { uuid: B, name: 'Beta' }, k2: { uuid: A, name: 'Alpha' }, k3: { uuid: C, name: 'Gamma' } } } });
  }

  function helpers() {
    const create = jest.fn(async (who, parent, uuid) => {
      add(who, makeItem([], { name: uuid.slice(-16), source: uuid, flags: { essence20: { parentId: parent.id } } }));
      return 'key';
    });
    setSubPerkHelpers({ create, gameLine: () => 'Power Rangers', general: async () => ({}) });
    return create;
  }

  test('offers the item\'s own list by name, not what the actor owns; makes each pick under the item and keeps the uuids', async () => {
    const item = gridScience(2);
    const actor = makeActor([item, makeItem([], { source: C })]);
    const create = helpers(actor);
    const ctx = stepContext({ actor, item, rule: item.system.rules[0], targets: [] });
    const offered = [];
    ctx.askPick = async (step, options) => {
      offered.push(options.map(option => option.label));
      return options[0].value;
    };

    expect(await runSteps(item.system.rules[0].steps, ctx)).toBe(true);
    expect(offered).toEqual([['Alpha', 'Beta'], ['Beta']]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(actor, item, A);
    expect(item.flags.essence20.rules.choices.perks).toEqual([A, B]);
    expect(ctx.vars.picked).toEqual([A, B]);
    expect(rulesContext(item).rules[0].choice.label).toBe(`${A.slice(-16)}, ${B.slice(-16)}`);
  });

  test('count reads @choiceCount; a cancel makes nothing and stops the run; nothing left stops it too', async () => {
    const item = gridScience('1 + @choiceCount');
    const tap = makeItem([{ type: 'ChoiceCount', items: [SOURCE], add: 1 }], { source: 'Compendium.essence20.test.Item.gridTap000000001' });
    const actor = makeActor([item, tap]);
    rebuildIndex(actor);
    const create = helpers(actor);
    const ctx = stepContext({ actor, item, rule: item.system.rules[0], targets: [] });
    const asked = [];
    ctx.askPick = async (step, options) => {
      asked.push(step.n);
      return step.n == 2 ? null : options[0].value;
    };

    expect(await runSteps(item.system.rules[0].steps, ctx)).toBe(false);
    expect(asked).toEqual([1, 2]);
    expect(create).not.toHaveBeenCalled();

    const owned = gridScience(1);
    const full = makeActor([owned, makeItem([], { source: A }), makeItem([], { source: B }), makeItem([], { source: C })]);
    helpers(full);
    expect(await runSteps(owned.system.rules[0].steps, stepContext({ actor: full, item: owned, targets: [] }))).toBe(false);
    expect(await runSteps([{ do: 'pickSubPerk', optional: true }], stepContext({ actor: full, item: owned, targets: [] }))).toBe(true);
  });

  test('anyGeneral: every General Perk, grouped by game line with the item\'s own line first', async () => {
    const item = makeItem([], { name: 'Nobody Like Me' });
    const actor = makeActor([item]);
    setSubPerkHelpers({
      gameLine: () => 'Power Rangers',
      general: async () => ({
        [A]: { uuid: A, label: 'Zed', group: 'GI Joe', detail: 'GI Joe CRB' },
        [B]: { uuid: B, label: 'Yo', group: 'Power Rangers', detail: 'PR CRB' },
        [C]: { uuid: C, label: 'Ax', group: 'Power Rangers', detail: 'PR CRB' },
      }),
      create: jest.fn(async () => 'key'),
    });
    const options = await subPerkOptions({ anyGeneral: true }, { actor, item });
    expect(options.map(option => option.value)).toEqual([C, B, A]);
    expect(options[0]).toEqual({ value: C, label: 'Ax (PR CRB)', group: 'Power Rangers' });
  });

  test('change: asks again (the current picks offered too), then swaps the children; a cancel keeps them', async () => {
    const item = gridScience(1);
    const actor = makeActor([item]);
    const create = helpers(actor);
    setSubPerkHelpers({ create, gameLine: () => null, general: async () => ({}), ask: async (step, options) => options.find(option => option.value == A)?.value });
    await runSteps(item.system.rules[0].steps, stepContext({ actor, item, targets: [] }));
    expect(item.flags.essence20.rules.choices.perks).toEqual([A]);
    expect(actor.items.contents.filter(other => other.flags?.essence20?.parentId == item.id)).toHaveLength(1);

    const offered = [];
    setSubPerkHelpers({ create, gameLine: () => null, general: async () => ({}), ask: async (step, options) => {
      offered.push(options.map(option => option.value));
      return C;
    } });
    await changeChoice(item, 0);
    expect(offered[0]).toContain(A);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(item.flags.essence20.rules.choices.perks).toEqual([C]);
    expect(actor.items.contents.filter(other => other.flags?.essence20?.parentId == item.id).map(other => other._stats.compendiumSource)).toEqual([C]);

    setSubPerkHelpers({ create, gameLine: () => null, general: async () => ({}), ask: async () => null });
    expect(await repickSubPerks(item, item.system.rules[0].steps[0])).toBe(false);
    expect(item.flags.essence20.rules.choices.perks).toEqual([C]);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(await repickSubPerks(makeItem([]), {})).toBe(false);
  });

  test('validated; a plug-in step with an editor form', () => {
    expect(STEP_TYPES).toContain('pickSubPerk');
    expect(stepErrors([{ do: 'pickSubPerk', count: '2 + @choiceCount' }])).toEqual([]);
    expect(stepErrors([{ do: 'pickSubPerk', count: '2 +' }]).join()).toMatch(/count/);
    expect(stepErrors([{ do: 'pickSubPerk', key: 'a b' }])).toContain('steps[0]: key must be a plain name');
    expect(STEP_FORMS.pickSubPerk.map(field => field.path)).toEqual(['key', 'count', 'notOwned', 'anyGeneral', 'prompt', 'optional', 'required']);
  });
});

describe('perk-handler#createSubPerk (shared with the old \'perks\' branch)', () => {
  test('an entry key or a uuid; an any-General uuid writes an entry first; an old-picker child goes through setPerkValues', async () => {
    const { createSubPerk } = await import('../sheet-handlers/perk-handler.mjs');
    const actor = makeActor();
    const parent = { _id: 'p1', type: 'perk', system: { items: { k1: { uuid: 'Compendium.x.y.Item.child00000000001' } } }, update: jest.fn() };
    const child = { uuid: 'Compendium.x.y.Item.child00000000001', system: { hasChoice: false } };
    const created = { setFlag: jest.fn(), update: jest.fn() };
    global.fromUuid = jest.fn(async () => child);
    global.Item = { create: jest.fn(async () => created) };
    expect(await createSubPerk(actor, parent, 'Compendium.x.y.Item.child00000000001')).toBe('k1');
    expect(global.Item.create).toHaveBeenCalledWith(child, { parent: actor });
    expect(created.setFlag).toHaveBeenCalledWith('essence20', 'collectionId', 'k1');
    expect(created.setFlag).toHaveBeenCalledWith('essence20', 'parentId', 'p1');
    expect(await createSubPerk(actor, parent, 'k1')).toBe('k1');
    global.fromUuid = jest.fn(async () => null);
    expect(await createSubPerk(actor, parent, 'Compendium.x.y.Item.gone000000000001')).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Static checks and the editor                 */
/* -------------------------------------------- */

describe('check-rules: perkChoiceProblems', () => {
  test('double ask, old-pick reads once converted, a carried-over pick needs a fixed list', () => {
    const choice = { type: 'ChoiceSet', key: 'style', from: 'config', table: 'fightingStyle', legacy: 'system.choice' };
    expect(perkChoiceProblems({ system: { hasChoice: true, rules: [choice] } })).toContain('has both the old picker (hasChoice) and a rules pick - it would ask twice');
    expect(perkChoiceProblems({ system: { hasChoice: true, rules: [{ type: 'Trigger', event: 'added', steps: [{ do: 'pickSubPerk' }] }] } })).toHaveLength(1);
    expect(perkChoiceProblems({ system: { hasChoice: true, rules: [] } })).toEqual([]);
    expect(perkChoiceProblems({ system: { hasChoice: false, rules: [choice] } })).toEqual([]);
    expect(perkChoiceProblems({ system: { rules: [choice, { type: 'RollModifier', when: ['rule:data:system.choice=brawler'] }] } })[0]).toMatch(/still reads the old pick/);
    expect(perkChoiceProblems({ system: { rules: [choice, { type: 'RollModifier', when: ['skill:{item.choice}'] }] } })[0]).toMatch(/still reads the old pick/);
    // Not converted yet: the old reads are fine.
    expect(perkChoiceProblems({ system: { rules: [{ type: 'RollModifier', when: ['rule:data:system.choice=brawler'] }] } })).toEqual([]);
    expect(perkChoiceProblems({ system: { rules: [{ ...choice, from: 'text' }] } })[0]).toMatch(/no fixed list/);
  });
});

describe('editor: the new ChoiceSet params and DerivedStat append', () => {
  test('every new ChoiceSet param has a field, shown where it applies', () => {
    const paths = RULE_FORMS.ChoiceSet.map(field => field.path);
    for (const param of ['table', 'labels', 'exceptAt', 'only', 'essence', 'notHeld', 'held', 'excludeCopies', 'count', 'rename', 'required', 'primary']) {
      expect(paths).toContain(param);
    }

    const config = fieldsHtml(RULE_FORMS.ChoiceSet, { type: 'ChoiceSet', key: 'style', from: 'config', table: 'fightingStyle' }, '', { type: 'ChoiceSet' });
    expect(config).toContain('data-field="table"');
    expect(config).not.toContain('data-field="notHeld"');
    const sense = fieldsHtml(RULE_FORMS.ChoiceSet, { type: 'ChoiceSet', key: 's', from: 'sense', notHeld: true }, '', { type: 'ChoiceSet' });
    expect(sense).toContain('data-field="notHeld"');
    expect(sense).not.toContain('data-field="table"');
    const append = fieldsHtml(RULE_FORMS.DerivedStat, { type: 'DerivedStat', path: 'system.environments', op: 'append', value: '{choice.environment}' }, '', { type: 'DerivedStat' });
    expect(append).toContain('<option value="append" selected>');
    expect(append).toContain('value="{choice.environment}"');
  });

  test('round trip: what the form writes back is a valid rule', () => {
    const rule = { type: 'ChoiceSet', key: 'skill', from: 'skill' };
    readInput(rule, 'count', 'formula', '2 + @choiceCount');
    readInput(rule, 'only', 'strings', 'culture, science');
    readInput(rule, 'essence', 'select', 'smarts');
    readInput(rule, 'excludeCopies', 'checkbox', true);
    readInput(rule, 'rename', 'checkbox', true);
    readInput(rule, 'required', 'checkbox', true);
    readInput(rule, 'primary', 'checkbox', true);
    expect(rule).toEqual({ type: 'ChoiceSet', key: 'skill', from: 'skill', count: '2 + @choiceCount', only: ['culture', 'science'], essence: 'smarts', excludeCopies: true, rename: true, required: true, primary: true });
    expect(validateRule(rule)).toEqual([]);
    readInput(rule, 'count', 'formula', '2');
    expect(rule.count).toBe(2);
    readInput(rule, 'rename', 'checkbox', false);
    readInput(rule, 'count', 'formula', '');
    expect(rule.rename).toBeUndefined();
    expect(rule.count).toBeUndefined();

    const stat = { type: 'DerivedStat', path: 'system.environments', op: 'append' };
    readInput(stat, 'value', 'text', '{choice.environment}');
    expect(validateRule(stat)).toEqual([]);

    const step = { do: 'pickSubPerk' };
    readInput(step, 'count', 'formula', '2 + @choiceCount');
    readInput(step, 'notOwned', 'stacks', 'false');
    readInput(step, 'anyGeneral', 'checkbox', true);
    expect(step).toEqual({ do: 'pickSubPerk', count: '2 + @choiceCount', notOwned: false, anyGeneral: true });
    expect(stepErrors([step])).toEqual([]);
  });

  test('every new label has English text', () => {
    const en = JSON.parse(readFileSync(join(ROOT, 'lang', 'en.json'), 'utf8')).E20.Rules;
    const get = key => key.split('.').reduce((o, k) => o?.[k], en.Field);
    for (const field of [...RULE_FORMS.ChoiceSet, ...RULE_FORMS.DerivedStat, ...STEP_FORMS.pickSubPerk]) {
      expect([field.label, typeof get(field.label)]).toEqual([field.label, 'string']);
      if (field.hint) {
        expect([field.hint, typeof get(field.hint)]).toEqual([field.hint, 'string']);
      }
    }

    for (const [, label] of RULE_FORMS.ChoiceSet.find(field => field.path == 'from').options) {
      expect([label, typeof get(label)]).toEqual([label, 'string']);
    }

    for (const key of ['ChoicePromptOf', 'ChoiceTaken', 'SubPerkPrompt', 'SubPerkPromptOf']) {
      expect(typeof en[key]).toBe('string');
    }

    expect(typeof en.Field.Step.pickSubPerk).toBe('string');
  });
});
