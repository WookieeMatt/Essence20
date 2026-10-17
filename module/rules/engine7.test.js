import { jest } from '@jest/globals';

// Round-7 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-06 (round 7)").

const { contextFor, evaluateTag, setWorldLookups } = await import('./predicate.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { resolveValue, formulaError } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 2, skills: {} },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.items.contents = this.items.contents.filter(item => !ids.includes(item.id));
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

beforeEach(() => {
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] },
    users: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

describe('tags', () => {
  test('onCanvas, itemCount, actionUsed, wearingItem, hasItem:name~', () => {
    const vest = { id: 'v', name: 'Battledress', type: 'armor', system: { equipped: true, traits: ['silent'] }, flags: {} };
    const gun = { id: 'g', name: 'Pistol', type: 'weapon', system: { equipped: true }, flags: {} };
    const gun2 = { id: 'g2', name: 'Rifle', type: 'weapon', system: { equipped: false }, flags: {} };
    const hangUp = { id: 'h', name: 'Weak Hang-Up', type: 'hangUp', system: {}, flags: {} };
    const hero = makeActor('Hero', [vest, gun, gun2, hangUp]);
    const ctx = contextFor({ self: hero, other: hero });
    expect(evaluateTag('self:onCanvas', ctx)).toBe(false);
    global.canvas = { tokens: { placeables: [{ actor: hero }] } };
    expect(evaluateTag('self:onCanvas', ctx)).toBe(true);
    delete global.canvas;
    expect(evaluateTag('self:itemCount:weapon>=2', ctx)).toBe(true);
    expect(evaluateTag('self:itemCount:weapon:equipped>=2', ctx)).toBe(false);
    expect(evaluateTag('self:actionUsed:standard', ctx)).toBeNull();
    setWorldLookups({ actionLedger: () => ({ standard: 1, move: 0 }) });
    expect(evaluateTag('self:actionUsed:standard', ctx)).toBe(true);
    expect(evaluateTag('self:actionUsed:move', ctx)).toBe(false);
    setWorldLookups({});
    expect(evaluateTag('self:wearingItem:item:type:armor&item:trait:silent', ctx)).toBe(true);
    expect(evaluateTag('self:wearingItem:item:trait:loud', ctx)).toBe(false);
    expect(evaluateTag('target:hasItem:name~hang-up', ctx)).toBe(true);
  });

  test('item:word, item:hasAttack (owned or stored), roll:targets, host: at roll time, combat:enemy:<tags>', () => {
    const claw = { id: 'w', name: 'Claw', type: 'weapon', system: { items: { a: { type: 'weaponEffect', name: 'Swipe', classification: { style: 'melee' }, numHands: 2 } } }, flags: {} };
    const clawed = { id: 'w2', name: 'Clawed Gauntlet', type: 'weapon', system: {}, flags: {} };
    const port = { id: 'u', name: 'Gunport', type: 'upgrade', system: {}, flags: { essence20: { parentId: 'w' } } };
    const hero = makeActor('Hero', [claw, clawed, port]);
    expect(evaluateTag('item:word:claw', contextFor({ item: claw }))).toBe(true);
    expect(evaluateTag('item:word:claw', contextFor({ item: clawed }))).toBe(false);
    expect(evaluateTag('item:hasAttack:item:data:system.classification.style=melee&item:data:system.numHands=2', contextFor({ item: claw }))).toBe(true);
    expect(evaluateTag('item:hasAttack:item:data:system.classification.style=ranged', contextFor({ item: claw }))).toBe(false);
    expect(evaluateTag('roll:targets>=2', contextFor({ targetCount: 3 }))).toBe(true);
    expect(evaluateTag('roll:targets=1', contextFor({}))).toBeNull();
    expect(evaluateTag('host:name~claw', contextFor({ self: hero, ruleItem: port }))).toBe(true);
    const librarian = makeActor('The Librarian', [], { type: 'npc' });
    const combat = { started: true, combatants: { contents: [{ actor: hero }, { actor: librarian }] } };
    expect(evaluateTag('combat:enemy:target:name~librarian', contextFor({ self: hero, combat }))).toBe(true);
    expect(evaluateTag('combat:ally:target:name~librarian', contextFor({ self: hero, combat }))).toBe(false);
  });
});

describe('durations', () => {
  test('endOfNextTurnOrScene also ends with the scene; turnOrUntilCombat holds until a combat starts', () => {
    const a = { id: 'a' };
    const combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: a }, { actor: { id: 'b' } }] };
    const entry = { until: 'endOfNextTurnOrScene', stamp: stampFor('endOfNextTurnOrScene', combat, a) };
    expect(isExpired(entry, { ...combat, round: 2, turn: 0 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 2, turn: 1 })).toBe(true);
    game.settings.get = () => 2;
    expect(isExpired(entry, { ...combat, round: 1, turn: 1 })).toBe(true);
    game.settings.get = () => 1;
    const brace = { until: 'turnOrUntilCombat', stamp: stampFor('turnOrUntilCombat', null) };
    expect(isExpired(brace, null)).toBe(false);
    expect(isExpired(brace, { started: false })).toBe(false);
    expect(isExpired(brace, combat)).toBe(true);
    const inCombat = { until: 'turnOrUntilCombat', stamp: stampFor('turnOrUntilCombat', combat) };
    expect(isExpired(inCombat, combat)).toBe(false);
    expect(isExpired(inCombat, { ...combat, turn: 1 })).toBe(true);
  });
});

describe('formulas', () => {
  test('dice(count, faces) and @count.items / @count.equipped', () => {
    expect(resolveValue('dice(@var.spent, 4)', { vars: { spent: 3 }, random: () => 0.99 })).toBe(12);
    expect(resolveValue('dice(0, 4)', {})).toBe(0);
    expect(formulaError('dice(2, 6) + 1')).toBeNull();
    const hero = makeActor('Hero', [{ id: 'x', type: 'weapon', system: { equipped: true } }, { id: 'y', type: 'weapon', system: {} }]);
    expect(resolveValue('@count.items.weapon', { actor: hero })).toBe(2);
    expect(resolveValue('@count.equipped.weapon', { actor: hero })).toBe(1);
  });
});

describe('steps', () => {
  test('choose: options with their own when; auto runs a lone one', async () => {
    const ctx = stepContext({ actor: makeActor('Hero'), item: { name: 'Zap Apple Jam' }, targets: [] });
    ctx.vars.cups = 0;
    ctx.ask = jest.fn();
    await runSteps([{ do: 'choose', auto: true, options: [
      { label: 'Drink', when: ['var:cups>0'], steps: [{ do: 'chat', text: 'drink' }] },
      { label: 'Eat', steps: [{ do: 'chat', text: 'eat' }] },
    ] }], ctx);
    expect(ctx.ask).not.toHaveBeenCalled();
    expect(ctx.chat).toEqual(['eat']);
    expect(stepErrors([{ do: 'choose', options: [{ label: 'x', when: 'var:a', steps: [] }] }])).toHaveLength(1);
  });

  test('pick from skill with an Essence filter and Specialized-only fallback; pick from team', async () => {
    global.CONFIG = { E20: { skills: {}, skillToEssence: { athletics: 'strength', might: 'strength', science: 'smarts' } } };
    const hero = makeActor('Hero', [], { system: { skills: { athletics: { specializations: { a: {} } }, might: {}, science: {} } } });
    const item = { name: 'Instructor', flags: {}, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } };
    const ctx = stepContext({ actor: hero, item, targets: [] });
    let offered = null;
    ctx.askPick = async (step, options) => {
      offered = options.map(o => o.value);
      return options[0].value;
    };

    await runSteps([{ do: 'pick', key: 's', from: 'skill', essence: 'strength', specializedOnly: true }], ctx);
    expect(offered).toEqual(['athletics']);
    const pal = makeActor('Pal');
    game.actors = { contents: [hero, pal, makeActor('Goon', [], { type: 'npc' })] };
    await runSteps([{ do: 'pick', key: 'student', from: 'team', notSelf: true }], ctx);
    expect(offered).toEqual([pal.uuid]);
    delete global.CONFIG;
  });

  test('pickGrant replace drops the earlier grant only once a new pick is made; difDefenseSelf', async () => {
    const old = { id: 'old', name: 'Old Spell', type: 'spell', flags: { essence20: { grantedBy: 'perk' } } };
    const hero = makeActor('Hero', [old]);
    const helpers = {
      findItems: jest.fn(async () => [{ uuid: 'C.new' }]),
      pickOne: jest.fn(async () => null),
      grantCopy: jest.fn(async () => ({ name: 'New Spell' })),
    };
    const ctx = stepContext({ actor: hero, item: { id: 'perk', name: 'Extensive Research' }, targets: [] });
    ctx.grantHelpers = helpers;
    expect(await runSteps([{ do: 'pickGrant', replace: true, from: { type: 'spell', fields: ['system.tier'] } }], ctx)).toBe(false);
    expect(hero.items.contents).toEqual([old]);
    expect(helpers.findItems.mock.calls[0][0].fields).toEqual(['system.tier']);
    helpers.pickOne = jest.fn(async () => 'C.new');
    await runSteps([{ do: 'pickGrant', replace: true, from: { type: 'spell' } }], ctx);
    expect(hero.items.contents).toEqual([]);
    expect(helpers.grantCopy).toHaveBeenCalled();
  });

  test('to: partyActor; button whisper owners and usedWhenDone', async () => {
    const a = makeActor('A');
    const party = { type: 'party', name: 'Squad', members: [a] };
    game.actors = { contents: [a, party], party };
    expect(recipients({ to: 'partyActor' }, stepContext({ actor: a, item: {}, targets: [] }))).toEqual([party]);
    game.users = { contents: [{ id: 'gm', isGM: true }, { id: 'p', isGM: false }] };
    a.testUserPermission = user => user.id == 'p';
    const ctx = stepContext({ actor: a, item: { name: 'Cruel Conflagration', uuid: 'Item.c' }, targets: [] });
    await runSteps([{ do: 'button', whisper: 'owners', usedWhenDone: true, steps: [{ do: 'chat', text: 'x' }] }], ctx);
    const data = ChatMessage.create.mock.calls[0][0];
    expect(data.whisper).toEqual(['gm', 'p']);
    expect(data.flags.essence20.ruleButton.usedWhenDone).toBe(true);
  });
});
