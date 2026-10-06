import { jest } from '@jest/globals';

/**
 * Round 12, group H engine pieces (module/rules/ext/h/): the rule:copy / rule:otherCopy and calc tags, the @copiesWith and
 * @most refs, the addEffect / removeEffects / keepValue / restoreValue steps, and the IgnoreDrawback, InitiativeEdge,
 * GrantDouble and DamageReduction rule types with the massShiftUsed event.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./helpers/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const applyDamage = jest.fn();
jest.unstable_mockModule('./helpers/combat.mjs', () => ({ applyDamage, getVehicleDriver: jest.fn() }));

await import('./ext/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { validateRule, TRIGGER_EVENTS } = await import('./types.mjs');
const { contextFor, evaluate, unknownTags } = await import('./predicate.mjs');
const { resolveValue } = await import('./formula.mjs');
const { calcTag } = await import('./ext/h/copies.mjs');
const { fill } = await import('./ext/h/effects.mjs');
const { ruleIgnoresDrawback } = await import('./ext/h/drawback.mjs');
const { damageReduction, grantDoubleRule, initiativeEdge, initiativeEdgeFor, massShiftUsed, offerGrantDouble } = await import('./ext/h/types.mjs');
const common = await import('./ext/h/common.mjs');

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function item(actor, data = {}) {
  const made = {
    id: `i${nextId++}`, name: 'Thing', type: 'perk', img: 'thing.svg', flags: {}, system: {}, effects: [], ...data, parent: actor,
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    async createEmbeddedDocuments(kind, datas) {
      datas.forEach(entry => this.effects.push({ id: `e${nextId++}`, ...entry }));
      return datas;
    },
  };
  actor.items.contents.push(made);
  rebuildIndex(actor);
  return made;
}

function actor(type = 'playerCharacter', system = {}, extra = {}) {
  const contents = [];
  const made = {
    id: `a${nextId++}`, name: extra.name ?? 'Actor', type, flags: { essence20: {} }, effects: [], system,
    prototypeToken: { disposition: extra.disposition ?? 1 }, getActiveTokens: () => [],
    items: { contents, get: id => contents.find(entry => entry.id == id), [Symbol.iterator]: () => contents[Symbol.iterator]() },
    async update(changes) {
      Object.entries(changes).forEach(([key, value]) => setPath(this, key, value));
    },
    async createEmbeddedDocuments(kind, datas) {
      datas.forEach(entry => this.effects.push({ id: `e${nextId++}`, ...entry }));
      return datas;
    },
    async deleteEmbeddedDocuments(kind, ids) {
      this.effects = this.effects.filter(effect => !ids.includes(effect.id));
    },
  };
  made.uuid = `Actor.${made.id}`;
  return made;
}

const SOURCE = 'Compendium.essence20.x.Item.book';
const run = async (who, ruleItem, steps, vars = {}) => {
  const ctx = stepContext({ actor: who, item: ruleItem, rule: {}, targets: [] });
  Object.assign(ctx.vars, vars);
  const finished = await runSteps(steps, ctx);
  return { ctx, finished };
};

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], [Symbol.iterator]: () => [][Symbol.iterator]() },
    i18n: { localize: k => `L:${k}`, format: (k, data) => `F:${k}:${JSON.stringify(data)}`, has: k => k.startsWith('E20.Known') },
  };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) },
    applications: { api: { DialogV2: { confirm: jest.fn(async () => true) } } },
  };
  applyDamage.mockClear();
});

describe('copies and calc', () => {
  test('rule:copy / rule:otherCopy read the item\'s copies (by book source); @copiesWith counts them', () => {
    const holder = actor();
    const first = item(holder, { _stats: { compendiumSource: SOURCE }, flags: { essence20: { pick: 'a' } } });
    const second = item(holder, { flags: { core: { sourceId: SOURCE }, essence20: { pick: 'b' } } });
    item(holder, { flags: { essence20: { pick: 'c' } } });
    const ask = (tags, ruleItem) => evaluate(tags, contextFor({ self: holder, ruleItem }));
    expect(ask(['rule:copy:data:flags.essence20.pick=a'], first)).toBe(true);
    expect(ask(['rule:otherCopy:data:flags.essence20.pick=a'], first)).toBe(false);
    expect(ask(['rule:otherCopy:data:flags.essence20.pick=a'], second)).toBe(true);
    expect(ask(['rule:copy:data:flags.essence20.pick=c'], second)).toBe(false);
    expect(ask(['rule:copy:data:flags.essence20.pick'], second)).toBe(true);
    expect(ask(['rule:copy:data:flags.essence20.pick!=a'], first)).toBe(true);
    expect(ask(['rule:copy:nonsense'], first)).toBe(null);
    expect(evaluate(['rule:copy:data:x'], contextFor({ self: holder }))).toBe(false);
    expect(resolveValue('@copiesWith.flags.essence20.pick.b + 10', { actor: holder, item: first })).toBe(11);
    expect(resolveValue('@copiesWith.pick', { actor: holder, item: first })).toBe(0);
    expect(unknownTags(['rule:copy:data:a=b', 'rule:otherCopy:data:a', 'calc:1 > 0'])).toEqual([]);
  });

  test('@most.items.<type>.<path> is the biggest number on those items', () => {
    const holder = actor();
    item(holder, { type: 'altMode', system: { speed: 40 } });
    item(holder, { type: 'altMode', system: { speed: 60 } });
    item(holder, { type: 'perk', system: { speed: 90 } });
    expect(resolveValue('@most.items.altMode.system.speed', { actor: holder })).toBe(60);
    expect(resolveValue('@most.items.weapon.system.speed', { actor: holder })).toBe(0);
    expect(resolveValue('@most.other.altMode.x', { actor: holder })).toBe(0);
  });

  test('calc:<formula><op><n> compares a formula with a number', () => {
    const holder = actor('playerCharacter', { level: 7 });
    holder.flags.essence20.used = 3;
    const ctx = contextFor({ self: holder });
    expect(evaluate(['calc:@level - @actor.flags.essence20.used > 3'], ctx)).toBe(true);
    expect(evaluate(['calc:@level - @actor.flags.essence20.used >= 5'], ctx)).toBe(false);
    expect(evaluate(['calc:min(@level, 5) = 5'], ctx)).toBe(true);
    expect(evaluate(['calc:@level != 7'], ctx)).toBe(false);
    expect(evaluate(['calc:@level < 8'], ctx)).toBe(true);
    expect(evaluate(['calc:@level <= 6'], ctx)).toBe(false);
    expect(calcTag('no comparison', ctx)).toBe(null);
    expect(calcTag('nope( > 1', ctx)).toBe(null);
  });
});

describe('effects and kept values', () => {
  test('addEffect on the rule\'s item (transfers) - {movement} for each base speed, formulas, a localised name', async () => {
    const holder = actor('zord', { movement: { ground: { base: 30 }, aerial: { base: 0 }, swim: { base: 10 } } });
    const own = item(holder, { name: 'Shift' });
    const { finished } = await run(holder, own, [{ do: 'addEffect', img: 'x.svg', changes: [{ key: 'system.movement.{movement}.bonus', value: 10 }, { key: 'system.a', value: '@var.n * 2', mode: 5 }] }], { n: 2 });
    expect(finished).toBe(true);
    expect(own.effects).toEqual([expect.objectContaining({
      name: 'Shift', img: 'x.svg', transfer: true, disabled: false,
      changes: [{ key: 'system.movement.ground.bonus', mode: 2, value: '10' }, { key: 'system.movement.swim.bonus', mode: 2, value: '10' }, { key: 'system.a', mode: 5, value: '4' }],
    })]);

    await run(holder, own, [{ do: 'addEffect', on: 'actor', name: 'E20.KnownName', changes: [{ key: 'system.{var.k}.value', value: -1 }], flags: { tagged: true } }], { k: 'speed' });
    expect(holder.effects).toEqual([expect.objectContaining({ name: 'L:E20.KnownName', img: 'thing.svg', flags: { essence20: { tagged: true } }, changes: [{ key: 'system.speed.value', mode: 2, value: '-1' }] })]);
    expect(holder.effects[0].transfer).toBeUndefined();
    expect((await run(holder, null, [{ do: 'addEffect', changes: [{ key: 'system.a', value: 1 }] }])).finished).toBe(false);
  });

  test('removeEffects takes off the recipients\' effects carrying the flag', async () => {
    const holder = actor();
    holder.effects = [{ id: 'a', flags: { essence20: { gone: true } } }, { id: 'b', flags: { essence20: {} } }, { id: 'c' }];
    await run(holder, item(holder), [{ do: 'removeEffects', flag: 'gone' }]);
    expect(holder.effects.map(effect => effect.id)).toEqual(['b', 'c']);
  });

  test('keepValue copies a value onto the rule\'s item; restoreValue puts it back (not without one, nor without the parent)', async () => {
    const holder = actor('zord', { skills: { might: { shift: 'd6' } } });
    const own = item(holder, { flags: { essence20: { rules: { choices: { skill: 'might' } } } } });
    await run(holder, own, [{ do: 'keepValue', path: 'system.skills.{choice.skill}.shift', at: 'flags.essence20.kept.previous' }]);
    expect(own.flags.essence20.kept.previous).toBe('d6');
    own.flags.essence20.kept.skill = 'might';
    holder.system.skills.might.shift = 'd10';
    await run(holder, own, [{ do: 'restoreValue', path: 'system.skills.{item.flags.essence20.kept.skill}.shift', from: 'flags.essence20.kept.previous' }]);
    expect(holder.system.skills.might.shift).toBe('d6');

    own.flags.essence20.kept.skill = 'brawn';
    await run(holder, own, [{ do: 'restoreValue', path: 'system.skills.{item.flags.essence20.kept.skill}.shift', from: 'flags.essence20.kept.previous' }]);
    expect(holder.system.skills.brawn).toBeUndefined();
    await run(holder, own, [{ do: 'restoreValue', path: 'system.skills.might.shift', from: 'flags.essence20.none' }]);
    expect(holder.system.skills.might.shift).toBe('d6');
    expect((await run(holder, own, [{ do: 'keepValue', path: 'system.skills.{choice.missing}.shift', at: 'flags.essence20.x' }])).finished).toBe(false);
    expect(fill('{var.a}-{choice.skill}-{item.name}', { vars: { a: 1 }, item: own })).toBe('1-might-Thing');
  });

  test('the step validators', () => {
    expect(stepErrors([{ do: 'addEffect', changes: [] }])).toEqual([expect.stringContaining('addEffect needs changes')]);
    expect(stepErrors([{ do: 'addEffect', changes: [{ key: 'a', value: 'nope(' }], on: 'elsewhere' }])).toHaveLength(2);
    expect(stepErrors([{ do: 'removeEffects' }])).toEqual([expect.stringContaining('removeEffects needs a flag')]);
    expect(stepErrors([{ do: 'keepValue', path: 'system.x', at: 'system.y' }])).toEqual([expect.stringContaining('keepValue needs')]);
    expect(stepErrors([{ do: 'restoreValue', path: 'system.x' }])).toEqual([expect.stringContaining('restoreValue needs')]);
    expect(stepErrors([{ do: 'keepValue', path: 'system.x', at: 'flags.essence20.y' }, { do: 'restoreValue', path: 'system.x', from: 'flags.y' }])).toEqual([]);
  });
});

describe('rule types', () => {
  test('IgnoreDrawback: only the drawbacks it names, while its when holds', () => {
    expect(validateRule({ type: 'IgnoreDrawback', drawbacks: ['limitedArticulation'] })).toEqual([]);
    expect(validateRule({ type: 'IgnoreDrawback', drawbacks: ['other'] })).toEqual([expect.stringContaining('drawbacks must list')]);
    const holder = actor();
    item(holder, { system: { rules: [{ type: 'IgnoreDrawback', drawbacks: ['limitedArticulation'], when: ['self:type:playerCharacter'] }] } });
    expect(ruleIgnoresDrawback(holder, 'limitedArticulation')).toBe(true);
    expect(ruleIgnoresDrawback(holder, 'other')).toBe(false);
    expect(ruleIgnoresDrawback(null, 'limitedArticulation')).toBe(false);
  });

  test('InitiativeEdge: the holder\'s own (scope self), or same-side actors on the scene (scope sceneAllies)', async () => {
    expect(validateRule({ type: 'InitiativeEdge', scope: 'sceneAllies' })).toEqual([]);
    expect(validateRule({ type: 'InitiativeEdge', scope: 'party' })).toEqual([expect.stringContaining('scope "party"')]);
    const self = actor();
    item(self, { system: { rules: [{ type: 'InitiativeEdge' }] } });
    expect(initiativeEdgeFor(self, [])).toBe(true);
    const leader = actor();
    item(leader, { system: { rules: [{ type: 'InitiativeEdge', scope: 'sceneAllies', when: ['holder:type:playerCharacter', 'self:type:npc'] }] } });
    const ally = actor('npc');
    const foe = actor('npc', {}, { disposition: -1 });
    expect(initiativeEdgeFor(ally, [leader, ally])).toBe(true);
    expect(initiativeEdgeFor(foe, [leader, foe])).toBe(false);
    expect(initiativeEdgeFor(leader, [leader])).toBe(false);
    expect(initiativeEdgeFor(null)).toBe(false);
    global.canvas = { tokens: { placeables: [{ actor: leader }, { actor: ally }] } };
    const options = { edge: false };
    await initiativeEdge(ally, options);
    expect(options.edge).toBe(true);
    const none = { edge: false };
    await initiativeEdge(foe, none);
    expect(none.edge).toBe(false);
  });

  test('GrantDouble: asked of the granter for that kind of grant; yes deals its damage', async () => {
    expect(validateRule({ type: 'GrantDouble', grants: ['upshift'], damage: { amount: 1, type: 'psychic' } })).toEqual([]);
    expect(validateRule({ type: 'GrantDouble', grants: ['edge'] })).toEqual([expect.stringContaining('grants must list')]);
    expect(validateRule({ type: 'GrantDouble', grants: ['actions'], damage: { amount: 1 } })).toEqual(['damage needs {amount, type}']);
    const granter = actor('playerCharacter', {}, { name: 'Officer' });
    const own = item(granter, { name: 'Command', system: { rules: [{ type: 'GrantDouble', grants: ['actions'] }, { type: 'GrantDouble', grants: ['upshift'], prompt: 'E20.KnownPrompt', damage: { amount: 2, type: 'psychic' }, when: ['target:type:npc'] }] } });
    const pc = actor('playerCharacter', {}, { name: 'Ally' });
    const npc = actor('npc', {}, { name: 'Minion' });
    expect(grantDoubleRule(granter, pc, 'upshift')).toBe(null);
    expect(grantDoubleRule(granter, npc, 'upshift')?.item).toBe(own);
    expect(grantDoubleRule(granter, granter, 'actions')).toBe(null);

    const confirm = foundry.applications.api.DialogV2.confirm;
    expect(await offerGrantDouble(granter, npc, 'upshift', '↑1')).toBe(true);
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ window: { title: 'Command' }, content: '<p>F:E20.KnownPrompt:{"granter":"Officer","ally":"Minion","what":"↑1"}</p>' }));
    expect(applyDamage).toHaveBeenCalledWith(npc, 2, 'psychic');
    applyDamage.mockClear();
    expect(await offerGrantDouble(granter, pc, 'actions', '1 Move')).toBe(true);
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('DoublePrompt') }));
    expect(applyDamage).not.toHaveBeenCalled();
    confirm.mockResolvedValueOnce(false);
    expect(await offerGrantDouble(granter, pc, 'actions', '1 Move')).toBe(false);
    expect(await offerGrantDouble(granter, pc, 'upshift', '↑1')).toBe(false);
  });

  test('DamageReduction: the listed types, its limit, its message; never below 0', async () => {
    expect(validateRule({ type: 'DamageReduction', amount: '1d2', limit: { per: 'round' } })).toEqual([]);
    expect(validateRule({ type: 'DamageReduction', amount: 1, limit: { per: 'rest' } })).toEqual([expect.stringContaining('limit.per')]);
    const holder = actor('zord', {}, { name: 'Zord' });
    holder.setFlag = async function (scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    };

    holder.getFlag = function (scope, key) {
      return getPath(this.flags?.[scope], key);
    };

    item(holder, { name: 'Armor', system: { rules: [
      { type: 'DamageReduction', amount: 2, damageTypes: ['fire'], limit: { per: 'round' }, message: 'E20.KnownLine' },
      { type: 'DamageReduction', amount: 1, when: ['self:type:npc'] },
    ] } });
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    expect(await damageReduction(holder, 3, 'cold')).toBe(3);
    expect(await damageReduction(holder, 1, 'fire')).toBe(0);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: '<p>F:E20.KnownLine:{&quot;name&quot;:&quot;Zord&quot;,&quot;n&quot;:2}</p>' }));
    expect(await damageReduction(holder, 3, 'fire')).toBe(3);
    expect(await damageReduction(holder, 0, 'fire')).toBe(0);
    const npc = actor('npc', {}, { name: 'Grunt' });
    item(npc, { name: 'Hide', system: { rules: [{ type: 'DamageReduction', amount: 1 }] } });
    expect(await damageReduction(npc, 3, 'blunt')).toBe(2);
    expect(ChatMessage.create).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('Reduced') }));
  });

  test('massShiftUsed is a Trigger event; firing it runs the actor\'s Triggers', async () => {
    expect(TRIGGER_EVENTS).toContain('massShiftUsed');
    const holder = actor();
    holder.flags.essence20.count = 0;
    item(holder, { system: { rules: [{ type: 'Trigger', event: 'massShiftUsed', steps: [{ do: 'updateActor', add: { 'flags.essence20.count': 1 } }] }] } });
    await massShiftUsed(holder);
    expect(holder.flags.essence20.count).toBe(1);
  });

  test('common helpers', () => {
    expect(common.T('X')).toBe('L:E20.RulesExtH.X');
    expect(common.localize('plain')).toBe('plain');
    expect(common.listOf(new Set([1, 2]))).toEqual([1, 2]);
    expect(common.listOf(null)).toEqual([]);
    expect(common.dataTest({ a: { b: 3 } }, 'data:a.b>2')).toBe(true);
    expect(common.dataTest({ a: { b: 3 } }, 'data:a.b<=2')).toBe(false);
    expect(common.dataTest({ a: 'x' }, 'other')).toBe(undefined);
    expect(common.compare(1, '>', NaN)).toBe(false);
    expect(common.copiesOf(null, null)).toEqual([]);
  });
});
