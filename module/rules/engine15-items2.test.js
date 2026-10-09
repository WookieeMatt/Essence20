import { jest } from '@jest/globals';

/**
 * Round 15, part "items2" (docs/rules-batches/slItems215.md): the engine pieces, one at a time, on plain fake actors.
 * The converted items themselves are in conv15-items2.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));
let picks = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  chooseSelect: jest.fn(async (title, prompt, options) => {
    const answer = picks.shift();
    return options.find(option => option.value == answer || option.label == answer)?.value ?? null;
  }),
  chooseButtons: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true, multiplier: 1 })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
  essenceRedirect: (actor, role, essence) => essence,
}));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(async () => {}), setEntryAndAddItem: jest.fn(async () => {}) }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { isExpired, stampFor, isValidUntil } = await import('./expiry.mjs');
const { initiativeAfterCurrent } = await import('./plugins/rolls/initiative.mjs');
const { immunityHelpers } = await import('./plugins/tags/condition-immune-tag.mjs');
const { refundableUses, labelOf } = await import('./plugins/resources/refund-use.mjs');
const { windowFlag, upgradeCost } = await import('./plugins/resources/vehicle-budget-pieces.mjs');
const { ruleDriverlessEssence } = await import('./plugins/zords/driverless-essence.mjs');
const { ruleEvasiveManeuvers } = await import('./plugins/combat/evasive-maneuvers-rule.mjs');
const { whollyInZone } = await import('./plugins/combat/zone-footprint-tags.mjs');
const { usedSinceTypeChange } = await import('./plugins/combat/since-type-change.mjs');
const { convertedChange } = await import('./plugins/zords/converted-event-and-seen.mjs');
const { ruleMovement } = await import('./adapter.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete node[last.replace(/^-=/, '')];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: { essence20: {} }, system: {}, effects: [], parent: actor,
    ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

const ACTORS = [];
function makeActor(name, { items = [], system = {}, type = 'playerCharacter', flags = {}, token = null } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, flags: { essence20: { ...flags } }, statuses: new Set(), effects: [],
    system: { level: 6, skills: {}, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async createEmbeddedDocuments(type, datas) {
      if (type == 'ActiveEffect') {
        const made = datas.map(data => ({ id: `e${nextId++}`, ...data }));
        this.effects.push(...made);
        return made;
      }

      const made = datas.map(data => makeItem(this, JSON.parse(JSON.stringify(data))));
      this.items.contents.push(...made);
      rebuildIndex(this);
      return made;
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (type == 'ActiveEffect') {
        this.effects = this.effects.filter(effect => !ids.includes(effect.id));
        return;
      }

      this.items.contents.splice(0, this.items.contents.length, ...this.items.contents.filter(item => !ids.includes(item.id)));
      rebuildIndex(this);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = items.map(data => makeItem(actor, data));
  actor.items = { contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), [Symbol.iterator]: () => list[Symbol.iterator]() };
  actor.getActiveTokens = () => (token ? [token] : []);
  if (token) {
    token.actor = actor;
    actor.token = token;
  }

  rebuildIndex(actor);
  ACTORS.push(actor);
  return actor;
}

const savedGame = global.game;
beforeEach(() => {
  ACTORS.length = 0;
  picks = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    actors: { get contents() {
      return ACTORS;
    } },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.canvas = { scene: { id: 's1' }, grid: { size: 100, distance: 5, measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) / 20 }) }, tokens: { placeables: [], setTargets: jest.fn() } };
  global.fromUuidSync = uuid => ACTORS.find(actor => actor.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    ...global.foundry,
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`, deepClone: value => JSON.parse(JSON.stringify(value)) },
    applications: { api: { DialogV2: { prompt: jest.fn(async () => null), wait: jest.fn(async () => null) } } },
  };
});

afterEach(() => {
  global.game = savedGame;
});

const run = (steps, actor, { targets = [], item = null, vars = {}, ...more } = {}) => {
  const ctx = stepContext({ actor, item: item ?? makeItem(actor, { name: 'Test', type: 'perk' }), rule: {}, targets });
  Object.assign(ctx.vars, vars);
  Object.assign(ctx, more);
  return runSteps(steps, ctx).then(result => ({ result, ctx }));
};

const tag = (tags, ctx) => evaluate(tags, contextFor(ctx));

describe('rule types validate', () => {
  test.each([
    [{ type: 'DriverlessEssence', essence: 3 }],
    [{ type: 'EvasiveManeuvers', scope: 'vehicle', when: ['self:toggle:evasive'] }],
    [{ type: 'MovementAction', countSinceTypeChange: true }],
    [{ type: 'Use', steps: [{ do: 'spendPooled', to: 'crew', path: 'system.powers.personal.value', amount: 5 }] }],
    [{ type: 'Use', steps: [{ do: 'recordSeen', flag: 'seen', entry: '{var.x}' }, { do: 'refundUse' }, { do: 'undoEffect', flag: 'x', linkedItem: 'itemId' }] }],
    [{ type: 'Use', steps: [{ do: 'pickChassis', mode: 'mimicry', flag: 'copied' }, { do: 'bestItem', by: 'system.damageValue' }, { do: 'windowCount', flag: 'a-{choice.b}', window: 'mission' }] }],
    [{ type: 'Use', steps: [{ do: 'groupTest', skill: 'targeting', dif: 10, cost: 'standard' }, { do: 'groupTally' }] }],
    [{ type: 'Use', steps: [{ do: 'spendAction', action: 'fullAction' }, { do: 'markWindow', flag: 'pool-{var.x}', window: 'mission', count: 2 }] }],
  ])('%j is valid', rule => {
    expect(validateRule(rule)).toEqual([]);
  });

  test('and their mistakes are named', () => {
    expect(validateRule({ type: 'DriverlessEssence' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'Use', steps: [{ do: 'spendPooled', path: 'flags.x' }] }).join(' ')).toMatch(/system/);
    expect(validateRule({ type: 'Use', steps: [{ do: 'recordSeen', flag: 'a b', entry: 'x' }] }).join(' ')).toMatch(/flag name/);
    expect(validateRule({ type: 'Use', steps: [{ do: 'pickChassis', mode: 'drone' }] }).join(' ')).toMatch(/origin or mimicry/);
    expect(validateRule({ type: 'Use', steps: [{ do: 'groupTest', skill: 'x', cost: 'fullAction' }] }).join(' ')).toMatch(/cost/);
  });
});

describe('durations and turn order', () => {
  test('registerUntil: calendarDay stamps today\'s date and ends when the date changes', () => {
    expect(isValidUntil('calendarDay')).toBe(true);
    const stamp = stampFor('calendarDay');
    expect(isExpired({ until: 'calendarDay', stamp })).toBe(false);
    expect(isExpired({ until: 'calendarDay', stamp: { ...stamp, day: '2000-01-01' } })).toBe(true);
  });

  test('@initiative.afterCurrent: halfway to the next combatant, 1 below when last, none before Initiative is rolled', () => {
    expect(initiativeAfterCurrent({ turn: 0, turns: [{ initiative: 20 }, { initiative: 10 }] })).toBe(15);
    expect(initiativeAfterCurrent({ turn: 1, turns: [{ initiative: 20 }, { initiative: 10 }] })).toBe(9);
    expect(initiativeAfterCurrent({ turn: 0, turns: [{ initiative: null }] })).toBeNull();
  });
});

describe('tags', () => {
  test('self:pointWithin:<ft> - the kept point against the actor\'s token', () => {
    const actor = makeActor('A', { token: { center: { x: 0, y: 0 } } });
    expect(tag(['self:pointWithin:200'], { self: actor, vars: { pointX: 2000, pointY: 0 } })).toBe(true);
    expect(tag(['self:pointWithin:200'], { self: actor, vars: { pointX: 5000, pointY: 0 } })).toBe(false);
    expect(tag(['self:pointWithin:200'], { self: actor, vars: {} })).toBe(false);
  });

  test('target:keyedOnMe:<path><op><n> - the other party\'s record about this actor', () => {
    const me = makeActor('Me');
    const them = makeActor('Them', { flags: { counts: { [me.uuid.replace(/\./g, '-')]: 2 } } });
    expect(tag(['target:keyedOnMe:flags.essence20.counts>=2'], { self: me, other: them })).toBe(true);
    expect(tag(['target:keyedOnMe:flags.essence20.counts>2'], { self: me, other: them })).toBe(false);
    expect(tag(['target:keyedOnMe:flags.essence20.counts'], { self: them, other: me })).toBe(false);
  });

  test('target:immune:<condition> asks condition-immunity.mjs (set at setup)', () => {
    const foe = makeActor('Foe');
    immunityHelpers.isImmune = (actor, condition) => actor === foe && condition == 'frightened';
    expect(tag(['target:immune:frightened'], { other: foe })).toBe(true);
    expect(tag(['target:immune:stunned'], { other: foe })).toBe(false);
    immunityHelpers.isImmune = null;
    expect(tag(['target:immune:frightened'], { other: foe })).toBe(false);
  });

  test('zone:self:<key> - wholly inside the holder\'s zone, a roll-time tag', () => {
    const zone = { key: 'z', x: 500, y: 500, half: 2.5, sceneId: 's1' };
    expect(whollyInZone({ x: 300, y: 300, width: 100, height: 100 }, zone)).toBe(true);
    expect(whollyInZone({ x: 700, y: 300, width: 100, height: 100 }, zone)).toBe(false);
    expect(whollyInZone({ x: 300, y: 300, width: 100, height: 100 }, { ...zone, sceneId: 'other' })).toBe(false);
    const holder = makeActor('H', { flags: { ruleZones: [{ ...zone, until: 'scene', stamp: { epoch: 1 } }] }, token: { document: { x: 300, y: 300, width: 1, height: 1 } } });
    expect(tag(['zone:self:z'], { self: holder })).toBe(true);
    expect(validateRule({ type: 'Defense', defense: 'evasion', amount: 2, when: ['zone:self:z'] })).toEqual([]);
  });

  test('self:hasEffectFlag:<flag>, item:upgradeCostAtMost:<formula>, roll:crit, self:ownerSpectrum:<colour>', () => {
    const marked = makeActor('M');
    marked.effects = [{ id: 'e', flags: { essence20: { glitch: { itemId: 'x' } } } }];
    expect(tag(['self:hasEffectFlag:glitch'], { self: marked })).toBe(true);
    expect(tag(['self:hasEffectFlag:other'], { self: marked })).toBe(false);
    expect(tag(['item:upgradeCostAtMost:@var.left'], { self: marked, item: { system: { availability: 'limited' } }, vars: { left: 2 } })).toBe(true);
    expect(tag(['item:upgradeCostAtMost:@var.left'], { self: marked, item: { system: { availability: 'restricted' } }, vars: { left: 2 } })).toBe(false);
    expect(upgradeCost('theoretical')).toBe(10);
    expect(tag(['roll:crit'], { isCrit: true })).toBe(true);
    expect(tag(['roll:crit'], { isCrit: false })).toBe(false);
    const zord = makeActor('Zord', { type: 'zord' });
    makeActor('Billy', { items: [{ name: 'Blue Ranger', type: 'role' }], system: { actors: { z: { uuid: zord.uuid } } } });
    expect(tag(['self:ownerSpectrum:blue'], { self: zord })).toBe(true);
    expect(tag(['self:ownerSpectrum:none'], { self: makeActor('Loner', { type: 'zord' }) })).toBe(true);
  });
});

describe('steps', () => {
  test('listNames: the recipients\' names (or "nobody") and their count', async () => {
    const actor = makeActor('A');
    const b = makeActor('B');
    const { ctx } = await run([{ do: 'listNames', to: 'targets', var: 'who' }], actor, { targets: [actor, b] });
    expect([ctx.vars.who, ctx.vars.whoCount]).toEqual(['A, B', 2]);
    const { ctx: none } = await run([{ do: 'listNames', to: 'targets' }], actor);
    expect([none.vars.names, none.vars.namesCount]).toEqual(['E20.RulesExtItems2.Nobody', 0]);
  });

  test('recordSeen: per creature, what it has seen; New / Switched before adding', async () => {
    const actor = makeActor('A');
    const foe = makeActor('Foe');
    const step = { do: 'recordSeen', flag: 'seen', entry: '{var.mode}' };
    let { ctx } = await run([step], actor, { targets: [foe], vars: { mode: 'car' } });
    expect([ctx.vars.seenCount, ctx.vars.seenNew, ctx.vars.seenSwitched]).toEqual([0, 1, 0]);
    ({ ctx } = await run([step], actor, { targets: [foe], vars: { mode: 'jet' } }));
    expect([ctx.vars.seenCount, ctx.vars.seenNew, ctx.vars.seenSwitched]).toEqual([1, 1, 1]);
    ({ ctx } = await run([step], actor, { targets: [foe], vars: { mode: 'jet' } }));
    expect([ctx.vars.seenNew, ctx.vars.seenSwitched]).toEqual([0, 0]);
    expect(actor.flags.essence20.seen[foe.uuid.replace(/\./g, '-')]).toEqual(['car', 'jet']);
  });

  test('refundUse: a counted record goes down by one, a rule limit / turn stamp goes; labels', async () => {
    const actor = makeActor('A');
    const ally = makeActor('B', { items: [{ name: 'Perk', type: 'perk', system: { rules: [{ type: 'Use', label: 'Go', steps: [] }] } }] });
    const perk = ally.items.contents[0];
    await ally.update({ 'flags.essence20.usedThing': { epoch: 1, window: 'scene', count: 2 }, [`flags.essence20.ruleUses.${perk.id}-0`]: { count: 1 } });
    expect(refundableUses(ally).map(row => row.label)).toEqual(['Used Thing', 'Perk: Go']);
    expect(labelOf('luckUsedThisScene')).toBe('Luck Used This Scene');
    picks = ['usedThing'];
    await run([{ do: 'refundUse', to: 'target' }], actor, { targets: [ally] });
    expect(ally.flags.essence20.usedThing.count).toBe(1);
    picks = [`ruleUses.${perk.id}-0`];
    const { ctx } = await run([{ do: 'refundUse', to: 'target' }], actor, { targets: [ally] });
    expect(ally.flags.essence20.ruleUses[`${perk.id}-0`]).toBeUndefined();
    expect(ctx.vars.refunded).toBe('Perk: Go');
    const { result } = await run([{ do: 'refundUse', to: 'target', message: 'nothing' }], actor, { targets: [makeActor('C')] });
    expect(result).toBe(false);
  });

  test('spendPooled: the recipients\' numbers added up, drawn in turn; short - nothing spent', async () => {
    const a = makeActor('A', { system: { powers: { personal: { value: 2 } } } });
    const b = makeActor('B', { system: { powers: { personal: { value: 4 } } } });
    const vehicle = makeActor('V', { type: 'zord', system: { actors: { x: { uuid: a.uuid }, y: { uuid: b.uuid } } } });
    const { ctx } = await run([{ do: 'spendPooled', to: 'crew', path: 'system.powers.personal.value', amount: 5 }], vehicle);
    expect([a.system.powers.personal.value, b.system.powers.personal.value, ctx.vars.contributors]).toEqual([0, 1, 'A (2), B (3)']);
    const { result } = await run([{ do: 'spendPooled', to: 'crew', path: 'system.powers.personal.value', amount: 5, message: 'short' }], vehicle);
    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('short');
  });

  test('windowCount and markWindow {count, a filled flag}', async () => {
    const actor = makeActor('A');
    const item = makeItem(actor, { name: 'Perk', type: 'perk', flags: { essence20: { rules: { choices: { car: 'Actor.v1' } } } } });
    expect(windowFlag('pool-{choice.car}', { item, vars: {} })).toBe('pool-Actor-v1');
    await run([{ do: 'markWindow', flag: 'pool-{choice.car}', window: 'mission', count: 2 }], actor, { item });
    const { ctx } = await run([{ do: 'windowCount', flag: 'pool-{choice.car}', window: 'mission', var: 'used' }], actor, { item });
    expect(ctx.vars.used).toBe(2);
  });

  test('askNumber {value}: the dialog starts on that number', async () => {
    const actor = makeActor('A');
    const item = makeItem(actor, { name: 'Crystal', type: 'gear', flags: { essence20: { kept: 4 } } });
    foundry.applications.api.DialogV2.prompt.mockImplementationOnce(async ({ content }) => Number(/value="(\d+)"/.exec(content)[1]));
    const { ctx } = await run([{ do: 'askNumber', var: 'n', min: 1, max: 9, value: '@item.flags.essence20.kept' }], actor, { item });
    expect(ctx.vars.n).toBe(4);
  });

  test('grant {flags} fills its text; @var.grantedId; addEffect {flags} fills its text; undoEffect takes the effect and its item', async () => {
    const actor = makeActor('A');
    const ally = makeActor('B');
    global.fromUuid = async uuid => (uuid == 'Compendium.x.Item.p' ? { name: 'Perk', type: 'perk', system: {}, toObject: () => ({ name: 'Perk', type: 'perk', system: {}, flags: {} }) } : global.fromUuidSync(uuid));
    const item = makeItem(actor, { name: 'Surgery', type: 'perk' });
    const { ctx } = await run([
      { do: 'grant', to: 'target', uuid: 'Compendium.x.Item.p', unlinked: true, flags: { by: '{ruleItem.name}' } },
      { do: 'addEffect', on: 'actor', to: 'target', changes: [{ key: 'system.health.bonus', value: -2 }], flags: { op: { itemId: '{var.grantedId}' } } },
    ], actor, { targets: [ally], item });
    const perk = ally.items.contents[0];
    expect(perk.flags.essence20.by).toBe('Surgery');
    expect(ctx.vars.grantedId).toBe(perk.id);
    expect(ally.effects[0].flags.essence20.op).toEqual({ itemId: perk.id });
    await run([{ do: 'undoEffect', to: 'target', flag: 'op', linkedItem: 'itemId' }], actor, { targets: [ally] });
    expect(ally.effects).toEqual([]);
    expect(ally.items.contents).toEqual([]);
  });

  test('recipients aroundSelf:<formula>, crew and varActor:<var>', async () => {
    const a = makeActor('A', { token: { center: { x: 0, y: 0 } } });
    const near = makeActor('Near', { token: { center: { x: 200, y: 0 } } });
    makeActor('Far', { token: { center: { x: 2000, y: 0 } } });
    canvas.tokens.placeables = ACTORS.map(actor => actor.token).filter(Boolean);
    let { ctx } = await run([{ do: 'listNames', to: 'aroundSelf:5 * @var.r', var: 'who' }], a, { vars: { r: 4 } });
    expect(ctx.vars.who).toBe('A, Near');
    const zord = makeActor('Z', { type: 'zord', system: { actors: { x: { uuid: near.uuid } } } });
    ({ ctx } = await run([{ do: 'listNames', to: 'crew', var: 'who' }], zord));
    expect(ctx.vars.who).toBe('Near');
    ({ ctx } = await run([{ do: 'listNames', to: 'varActor:foe', var: 'who' }], a, { vars: { foe: near.uuid } }));
    expect(ctx.vars.who).toBe('Near');
  });

  test('setEffects {items}: the actor\'s other items\' Active Effects switched', async () => {
    const actor = makeActor('A', { items: [{ name: 'F1', type: 'feature', effects: [{ id: 'x', name: 'E', disabled: true, changes: [{ key: 'k' }] }] }, { name: 'P', type: 'perk', effects: [{ id: 'y', name: 'E', disabled: true }] }] });
    const [f1, p] = actor.items.contents;
    for (const item of [f1, p]) {
      item.updateEmbeddedDocuments = jest.fn(async (kind, updates) => updates.forEach(update => Object.assign(item.effects.find(e => e.id == update._id), update)));
    }

    await run([{ do: 'setEffects', items: 'type:feature', effects: [{ on: true }] }], actor);
    expect([f1.effects[0].disabled, p.effects[0].disabled]).toEqual([false, true]);
  });

  test('damage {asCastHit}: the cast HitRider rules\' part (none here - the damage as it is), @var.damage', async () => {
    const actor = makeActor('A');
    const foe = makeActor('Foe');
    foe.isOwner = false;
    const { ctx } = await run([{ do: 'damage', to: 'target', amount: 3, damageType: 'fire', asCastHit: true }], actor, { targets: [foe] });
    expect(ctx.vars.damage).toBe(3);
  });
});

describe('rule readers', () => {
  test('DriverlessEssence: the highest; none - null', () => {
    const zord = makeActor('Z', { type: 'zord', items: [{ name: 'Key', type: 'feature', system: { rules: [{ type: 'DriverlessEssence', essence: 3 }, { type: 'DriverlessEssence', essence: 2 }] } }] });
    expect(ruleDriverlessEssence(zord)).toBe(3);
    expect(ruleDriverlessEssence(makeActor('Plain'))).toBeNull();
  });

  test('EvasiveManeuvers: an Aerial vehicle\'s own rule, or the evasiveManeuversActive flag', () => {
    const jet = makeActor('Jet', { type: 'vehicle', system: { movement: { aerial: { base: 60 } } }, items: [{ name: 'Evasive', type: 'upgrade', system: { rules: [{ type: 'EvasiveManeuvers' }] } }] });
    expect(ruleEvasiveManeuvers(jet)).toBe(true);
    expect(ruleEvasiveManeuvers(makeActor('Truck', { type: 'vehicle', system: { movement: { aerial: { base: 0 } } }, items: [{ name: 'Evasive', type: 'upgrade', system: { rules: [{ type: 'EvasiveManeuvers' }] } }] }))).toBe(false);
    expect(ruleEvasiveManeuvers(makeActor('Flagged', { type: 'vehicle', flags: { evasiveManeuversActive: true } }))).toBe(true);
  });

  test('MovementAction countSinceTypeChange; the cost walked since the last change of movement action', () => {
    const triple = makeActor('T', { items: [{ name: 'TD', type: 'perk', system: { rules: [{ type: 'MovementAction', countSinceTypeChange: true }] } }] });
    expect(ruleMovement(triple).countSinceTypeChange).toBe(true);
    expect(ruleMovement(makeActor('P')).countSinceTypeChange).toBeUndefined();
    expect(usedSinceTypeChange({ passed: { waypoints: [{ action: 'walk', cost: 10 }, { action: 'fly', cost: 5 }, { cost: 5 }] } })).toBe(10);
    expect(usedSinceTypeChange({})).toBeNull();
  });

  test('event converted: Converting or switching Alt Mode while converted', () => {
    const bot = makeActor('Bot', { system: { isTransformed: true, altModeId: 'jet' } });
    expect(convertedChange(bot, { system: { altModeId: 'jet' } })).toBe('jet');
    expect(convertedChange(bot, { system: { health: {} } })).toBeNull();
    bot.system.isTransformed = false;
    expect(convertedChange(bot, { system: { isTransformed: false } })).toBeNull();
  });
});
