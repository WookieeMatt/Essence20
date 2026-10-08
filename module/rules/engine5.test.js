import { jest } from '@jest/globals';

// Round-5 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-05 (round 5)").

// Capture the Hooks the rules modules register, to drive equip / resource / Essence events.
const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), callAll: () => {} };

const { contextFor, evaluateTag } = await import('./predicate.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { resolveValue } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors, itemsFor, recipients: recipientsOf } = await import('./steps.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleRollSources } = await import('./adapter.mjs');
const { runUse } = await import('./triggers.mjs');
const { validateRule } = await import('./types.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 2, health: { value: 5, max: 10 }, powers: { personal: { value: 3, max: 4 } }, skills: {}, essences: { strength: { value: 2, max: 3 } } },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return key.split('.').reduce((at, k) => at?.[k], this.flags[scope]);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => actor.items.contents.find(i => i.id == id), find: fn => actor.items.contents.find(fn),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

function weaponPair(id, { equipped = true, skill = 'targeting', traits = [] } = {}) {
  const weapon = { id: `w${id}`, name: `Weapon ${id}`, type: 'weapon', system: { equipped, traits }, flags: {} };
  const attack = { id: `e${id}`, name: `Attack ${id}`, type: 'weaponEffect', system: { classification: { skill } }, flags: { essence20: { parentId: `w${id}` } } };
  return [weapon, attack];
}

beforeEach(() => {
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath,
    getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), hasProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) !== undefined } };
});

describe('tags', () => {
  test('target:ally / target:enemy by disposition, else PC vs not', () => {
    const hero = makeActor('Hero');
    const pal = makeActor('Pal');
    const goon = makeActor('Goon', [], { type: 'npc' });
    expect(evaluateTag('target:ally', contextFor({ self: hero, other: pal }))).toBe(true);
    expect(evaluateTag('target:enemy', contextFor({ self: hero, other: goon }))).toBe(true);
    const token = disposition => ({ document: { disposition } });
    hero.getActiveTokens = () => [token(1)];
    goon.getActiveTokens = () => [token(1)];
    expect(evaluateTag('target:ally', contextFor({ self: hero, other: goon }))).toBe(true);
  });

  test('var:<key> with comparisons reads the run (step conditions too)', async () => {
    const ctx = contextFor({ vars: { margin: -6, picked: 'red' } });
    expect(evaluateTag('var:margin<=-5', ctx)).toBe(true);
    expect(evaluateTag('var:margin>0', ctx)).toBe(false);
    expect(evaluateTag('var:picked=red', ctx)).toBe(true);
    expect(evaluateTag('var:picked!=red', ctx)).toBe(false);
    expect(evaluateTag('var:none', ctx)).toBe(false);
    const run = stepContext({ actor: makeActor('Hero'), item: { name: 'X' }, targets: [] });
    run.vars.rolled = 4;
    await runSteps([{ do: 'chat', text: 'high', when: ['var:rolled>=4'] }, { do: 'chat', text: 'low', when: ['var:rolled<4'] }], run);
    expect(run.chat).toEqual(['high']);
  });

  test('@host.<path> reads the item an upgrade is attached to', () => {
    const rifle = { id: 'w1', type: 'weapon', system: { range: { max: 30 } } };
    const scope = { id: 'u1', type: 'upgrade', flags: { essence20: { parentId: 'w1' } } };
    makeActor('Hero', [rifle, scope]);
    expect(resolveValue('@host.system.range.max', { item: scope })).toBe(30);
  });
});

describe('durations in an unstarted combat', () => {
  test('endOfNextTurn stamped before the combat starts counts from round 1', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const combat = { id: 'c1', started: false, round: 0, turn: null, turns: [{ actor: a }, { actor: b }] };
    const entry = { until: 'endOfNextTurn', stamp: stampFor('endOfNextTurn', combat, b) };
    expect(entry.stamp).toMatchObject({ unstarted: true, actorId: 'b' });
    expect(isExpired(entry, combat)).toBe(false);
    const started = { ...combat, started: true, round: 1, turn: 0 };
    expect(isExpired(entry, started)).toBe(false);
    expect(isExpired(entry, { ...started, turn: 1 })).toBe(false);
    expect(isExpired(entry, { ...started, round: 2, turn: 0 })).toBe(true);
    expect(isExpired(entry, null)).toBe(true);
  });
});

describe('steps', () => {
  test('item: wielded[:tag] and roll skill: wielded', async () => {
    const [rifle, shot] = weaponPair(1, { skill: 'targeting' });
    const [sword, slash] = weaponPair(2, { skill: 'finesse', equipped: false });
    const hero = makeActor('Hero', [rifle, shot, sword, slash]);
    const ctx = stepContext({ actor: hero, item: { name: 'Desperate Parry' }, targets: [] });
    expect(itemsFor({ item: 'wielded', all: true }, hero, ctx)).toEqual([rifle]);
    expect(itemsFor({ item: 'wielded:item:data:system.classification.skill=finesse' }, hero, ctx)).toEqual([]);
    hero._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ success: true, multiplier: 1 }] }] })) };
    global.CONFIG = { E20: { skillToEssence: { targeting: 'speed' } } };
    await runSteps([{ do: 'roll', skill: 'wielded', open: true }], ctx);
    expect(hero._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'targeting', essence: 'speed', rollType: 'skill' });
    const bare = stepContext({ actor: makeActor('Bare'), item: { name: 'Shoot Out' }, targets: [] });
    expect(await runSteps([{ do: 'roll', skill: 'wielded', dif: 10 }], bare)).toBe(false);
    delete global.CONFIG;
  });

  test('gainResource overMax, updateActor (set / add / clamp / booleans), damage type and chat from the run', async () => {
    const hero = makeActor('Hero');
    const ctx = stepContext({ actor: hero, item: { name: 'Repair', flags: { essence20: { rules: { choices: { type: 'fire' } } } } }, targets: [] });
    await runSteps([{ do: 'gainResource', resource: { path: 'system.powers.personal.value' }, amount: 5, overMax: true }], ctx);
    expect(hero.system.powers.personal.value).toBe(8);
    await runSteps([{ do: 'updateActor', set: { 'system.flag': true, 'system.note': '{choice.type}' }, add: { 'system.health.value': -9 }, min: 0 }], ctx);
    expect(hero.system).toMatchObject({ flag: true, note: 'fire', health: { value: 0 } });
    ctx.vars.n = 3;
    await runSteps([{ do: 'chat', text: '{var.n} / {@level * 2}' }], ctx);
    expect(ctx.chat.at(-1)).toBe('3 / 4');
  });

  test('require stops the run; with beforeCost it runs before a Use pays', async () => {
    const rule = { type: 'Use', cost: { resource: { path: 'system.powers.personal.value' }, amount: 1 },
      steps: [{ do: 'require', beforeCost: true, check: ['self:data:system.health.value>3'], message: 'Too hurt' }, { do: 'chat', text: 'go' }] };
    const item = { id: 'p1', name: 'Gate', type: 'perk', flags: {}, system: { rules: [rule] } };
    const hero = makeActor('Hero', [item]);
    hero.system.health.value = 2;
    rebuildIndex(hero);
    expect(await runUse(item, async () => true, { pick: async (i, list) => list[0] })).toContain('Too hurt');
    expect(hero.system.powers.personal.value).toBe(3);
    hero.system.health.value = 5;
    expect(await runUse(item, async () => true, { pick: async (i, list) => list[0] })).toContain('go');
    expect(hero.system.powers.personal.value).toBe(2);
    expect(stepErrors([{ do: 'require' }])).toHaveLength(1);
  });

  test('table: the row the roll lands in posts its text and runs its steps', async () => {
    const ctx = stepContext({ actor: makeActor('Pinkie'), item: { name: 'Pinkie Sense' }, targets: [] });
    ctx.random = () => 0.6;
    await runSteps([{ do: 'table', formula: '1d8', rows: [{ min: 1, max: 4, text: 'twitchy tail' }, { min: 5, max: 8, text: 'itchy back', steps: [{ do: 'chat', text: 'row {var.rolled}' }] }] }], ctx);
    expect(ctx.chat.slice(-2)).toEqual(['itchy back', 'row 5']);
    expect(stepErrors([{ do: 'table', rows: [] }])).toHaveLength(1);
  });

  test('pick from ownedItem with a filter and auto; bank replace keeps one bonus per item', async () => {
    const [rifle] = weaponPair(1, { traits: ['ballistic'] });
    const knife = { id: 'k', name: 'Knife', type: 'weapon', system: { traits: [] }, flags: {} };
    const hero = makeActor('Hero', [rifle, knife]);
    const item = { id: 'p', name: 'Same Principle', flags: {}, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } };
    const ctx = stepContext({ actor: hero, item, targets: [] });
    ctx.askPick = jest.fn();
    await runSteps([{ do: 'pick', key: 'gun', from: 'ownedItem', itemType: 'weapon', filter: ['item:trait:ballistic'], auto: true }], ctx);
    expect(ctx.askPick).not.toHaveBeenCalled();
    expect(item.flags.essence20.rules.choices.gun).toBe(rifle.id);
    await runSteps([{ do: 'bank', upshift: 1, replace: true }], ctx);
    await runSteps([{ do: 'bank', upshift: 2, replace: true }], ctx);
    expect(hero.flags.essence20.ruleBank.map(entry => entry.shiftUp)).toEqual([2]);
  });

  test('button cards carry the run\'s numbers to the pressed steps', async () => {
    const ctx = stepContext({ actor: makeActor('Hero'), item: { name: 'Deflector', uuid: 'Item.d' }, targets: [] });
    ctx.vars.damage = 4;
    await runSteps([{ do: 'button', steps: [{ do: 'chat', text: '{var.damage}' }] }], ctx);
    expect(ChatMessage.create.mock.calls[0][0].flags.essence20.ruleButton.vars).toEqual({ damage: 4 });
  });
});

describe('rules', () => {
  test('DerivedStat: a {choice} path, and true / false values', () => {
    const mentor = { id: 'm', name: 'Mentor', type: 'perk', flags: { essence20: { rules: { choices: { skill: 'athletics' } } } }, system: { rules: [
      { type: 'DerivedStat', path: 'system.skills.{choice.skill}.edge', value: true },
      { type: 'DerivedStat', path: 'system.skills.{choice.missing}.edge', value: true },
    ] } };
    const hero = makeActor('Hero', [mentor]);
    ruleDerived(hero);
    expect(hero.system.skills.athletics.edge).toBe(true);
    expect(Object.keys(hero.system.skills)).toEqual(['athletics']);
    expect(validateRule({ type: 'DerivedStat', path: 'system.x', value: false })).toEqual([]);
    expect(validateRule({ type: 'DerivedStat', path: 'system.x', value: '1 +' }).length).toBeGreaterThan(0);
  });

  test('consumeMark: the roll that uses the modifier uses up the mark', () => {
    const rule = { type: 'RollModifier', upshift: 1, when: ['self:marked:lift'], consumeMark: 'lift' };
    const item = { id: 'b', name: 'Broad Understanding', type: 'perk', flags: {}, system: { rules: [rule] } };
    const hero = makeActor('Hero', [item]);
    hero.flags.essence20.ruleMarks = { lift: { by: null, until: null, stamp: null } };
    rebuildIndex(hero);
    const { consumes } = ruleRollSources(hero, null, {});
    expect(consumes).toContainEqual({ ext: 'rulesMark', actorUuid: hero.uuid, key: 'lift' });
  });
});

describe('Trigger events from document hooks', () => {
  test('equipped, resourceSpent and essenceChanged fire with their numbers', async () => {
    const seen = [];
    const rules = ['equipped', 'unequipped', 'resourceSpent', 'essenceChanged'].map(event => ({ type: 'Trigger', event, steps: [{ do: 'chat', text: `${event} {var.spent}{var.essence}{var.change}` }] }));
    const item = { id: 'p', name: 'Watcher', type: 'perk', flags: {}, system: { rules, equipped: true } };
    const hero = makeActor('Hero', [item]);
    rebuildIndex(hero);
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    const options = {};
    hooks.preUpdateActor.forEach(fn => fn(hero, {}, options));
    hero.system.powers.personal.value = 1;
    hero.system.essences.strength.value = 3;
    await Promise.all(hooks.updateActor.map(fn => fn(hero, { system: { powers: { personal: { value: 1 } }, essences: { strength: { value: 3 } } } }, options, 'u')));
    await Promise.all(hooks.updateItem.map(fn => fn(item, { system: { equipped: false } }, {}, 'u')));
    await new Promise(resolve => setTimeout(resolve, 0));
    const text = seen.join(' | ');
    expect(text).toContain('resourceSpent 2');
    expect(text).toContain('essenceChanged strength1');
    expect(text).toContain('unequipped');
  });
});

describe('position tags and Party recipients', () => {
  test('terrain:set, environment:outside, the position checks', async () => {
    const { setWorldLookups, registerCheck } = await import('./predicate.mjs');
    setWorldLookups({ terrain: () => null, environment: () => 'vacuum', environmentOutside: () => 'normal' });
    const ctx = contextFor({ self: makeActor('Hero') });
    expect(evaluateTag('terrain:set', ctx)).toBe(false);
    expect(evaluateTag('terrain:urban', ctx)).toBeNull();
    expect(evaluateTag('environment:vacuum', ctx)).toBe(true);
    expect(evaluateTag('environment:outside:vacuum', ctx)).toBe(false);
    registerCheck('inWater', () => true);
    expect(evaluateTag('self:check:inWater', ctx)).toBe(true);
    setWorldLookups({});
  });

  test('to: party / party+others / team', () => {
    const a = makeActor('A');
    const b = makeActor('B');
    const npc = makeActor('N', [], { type: 'npc' });
    const party = { type: 'party', members: [a, b] };
    global.game.actors = { contents: [a, b, npc, party], party };
    const ctx = stepContext({ actor: a, item: { name: 'Instructor' }, targets: [] });
    expect(recipientsOf({ to: 'party' }, ctx)).toEqual([a, b]);
    expect(recipientsOf({ to: 'party+others' }, ctx)).toEqual([b]);
    expect(recipientsOf({ to: 'team' }, ctx)).toEqual([a, b]);
    expect(stepErrors([{ do: 'heal', to: 'team+others' }])).toEqual([]);
  });
});
