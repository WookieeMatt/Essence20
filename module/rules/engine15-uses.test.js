import { jest } from '@jest/globals';

/**
 * Round 15, part "uses" (docs/rules-batches/slUses15.md): the engine pieces, one at a time, on plain fake actors. The
 * converted items themselves are in conv15-uses.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext, pickOptions, itemsFor } = await import('./steps.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { ruleConditionRounds } = await import('./plugins/combat/condition-duration.mjs');
const { ruleBeforeArea, ruleAreaExclusions } = await import('./plugins/combat/before-area.mjs');
const { ruleSwapShrug } = await import('./plugins/combat/swap-shrug.mjs');
const { armorUpgradeBonuses, armorUpgradeAdjust } = await import('./plugins/combat/armor-upgrades.mjs');

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
    id: `i${nextId++}`, flags: { essence20: {} }, system: {}, parent: actor,
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

function makeActor(name, { items = [], system = {}, type = 'playerCharacter', statuses = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, flags: { essence20: {} }, statuses: new Set(statuses),
    system: { level: 6, skills: {}, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => makeItem(this, JSON.parse(JSON.stringify(data))));
      this.items.contents.push(...made);
      rebuildIndex(this);
      return made;
    },
    async deleteEmbeddedDocuments(type, ids) {
      this.items.contents.splice(0, this.items.contents.length, ...this.items.contents.filter(item => !ids.includes(item.id)));
      rebuildIndex(this);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = items.map(data => makeItem(actor, data));
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

const savedGame = global.game;
beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = { tokens: { placeables: [], setTargets: jest.fn() } };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}` } };
});

afterEach(() => {
  global.game = savedGame;
});

const run = (steps, actor, { targets = [], item = null, ...more } = {}) => {
  const ctx = stepContext({ actor, item: item ?? makeItem(actor, { name: 'Test', type: 'perk' }), rule: {}, targets });
  Object.assign(ctx, more);
  return runSteps(steps, ctx).then(result => ({ result, ctx }));
};

const tag = (tags, ctx) => evaluate(tags, contextFor(ctx));

describe('rule types validate', () => {
  test.each([
    [{ type: 'BeforeArea', options: ['bigger', 'shape'] }, []],
    [{ type: 'BeforeArea', exclude: 'skillDie' }, []],
    [{ type: 'ConditionDuration', condition: 'impaired', rounds: '1d2' }, []],
    [{ type: 'SwapShrug', from: 'evasion', to: 'toughness' }, []],
    [{ type: 'ManeuverOption', option: 'dismantle' }, []],
    [{ type: 'ArmorUpgradePenalty', mark: 'x', amount: 2 }, []],
  ])('%j is valid', (rule, errors) => {
    expect(validateRule(rule)).toEqual(errors);
  });

  test('and their mistakes are named', () => {
    expect(validateRule({ type: 'BeforeArea', options: ['huge'] }).join(' ')).toMatch(/unknown option "huge"/);
    expect(validateRule({ type: 'BeforeArea' }).join(' ')).toMatch(/needs options or exclude/);
    expect(validateRule({ type: 'ManeuverOption', option: 'trip' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'SwapShrug', from: 'evasion' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'ConditionDuration', condition: 'impaired' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'Use', steps: [{ do: 'addToSceneList' }] }).join(' ')).toMatch(/flag must be text/);
    expect(validateRule({ type: 'Use', steps: [{ do: 'createCompanion', system: [] }] }).join(' ')).toMatch(/system must be an object/);
    expect(validateRule({ type: 'Use', steps: [{ do: 'moveTo', to: 3 }] }).join(' ')).toMatch(/to must be text/);
  });
});

describe('item selectors and text refs (steps.mjs registries)', () => {
  test('where:<tags> picks the actor\'s items meeting the tags; host the item the rule item is fitted to', async () => {
    const actor = makeActor('A', { items: [
      { name: 'Flamer', type: 'weapon', system: { traits: ['fire'] } },
      { name: 'Rifle', type: 'weapon', system: { traits: [] } },
      { name: 'Coat', type: 'armor', system: { traits: ['fire'] } },
    ] });
    const [flamer, , coat] = actor.items.contents;
    const ctx = stepContext({ actor, item: null, rule: {}, targets: [] });
    expect(itemsFor({ item: 'where:item:type:weapon&item:trait:fire', all: true }, actor, ctx)).toEqual([flamer]);
    expect(itemsFor({ item: 'where:item:trait:fire', all: true }, actor, ctx)).toEqual([flamer, coat]);
    const scope = makeItem(actor, { name: 'Scope', type: 'upgrade', flags: { essence20: { parentId: flamer.id } } });
    actor.items.contents.push(scope);
    expect(itemsFor({ item: 'host' }, actor, stepContext({ actor, item: scope, rule: {}, targets: [] }))).toEqual([flamer]);
    await run([{ do: 'updateItem', item: 'where:item:type:weapon', all: true, set: { 'flags.essence20.marked': true } }], actor);
    expect(actor.items.contents.filter(item => item.flags.essence20.marked).map(item => item.name)).toEqual(['Flamer', 'Rifle']);
  });

  test('{sourced.<id>.<path>|default} reads the actor\'s copy of a book item, else the default', async () => {
    const actor = makeActor('A', { items: [{ name: 'Energy Affinity', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.x.Item.DgFY0ZmAtClAobiA' }, essence20: {} }, system: { choice: 'cold' } }] });
    const { ctx } = await run([{ do: 'chat', text: 'It is {sourced.DgFY0ZmAtClAobiA.system.choice|fire}.' }], actor);
    expect(ctx.chat).toContain('It is cold.');
    const other = makeActor('B');
    const { ctx: none } = await run([{ do: 'chat', text: 'It is {sourced.DgFY0ZmAtClAobiA.system.choice|fire}.' }], other);
    expect(none.chat).toContain('It is fire.');
  });
});

describe('grant / pickGrant options', () => {
  test('grant unlinked leaves the copy untied to the granting item; removeTraits drops traits', async () => {
    const actor = makeActor('A');
    global.fromUuid = jest.fn(async () => ({ toObject: () => ({ name: 'Blade', type: 'weapon', system: { traits: ['silent', 'sharp'] } }) }));
    const item = makeItem(actor, { name: 'Perk', type: 'perk' });
    await run([{ do: 'grant', uuid: 'Compendium.essence20.x.Item.BladeAAAAAAAAAAA', unlinked: true, removeTraits: ['silent'] }], actor, { item });
    const [blade] = actor.items.contents;
    expect(blade.flags.essence20.grantedBy).toBeUndefined();
    expect(blade.system.traits).toEqual(['sharp']);
    await run([{ do: 'grant', uuid: 'Compendium.essence20.x.Item.BladeAAAAAAAAAAA' }], actor, { item });
    expect(actor.items.contents[1].flags.essence20.grantedBy).toBe(item.id);
  });

  test('pickGrant optional: a cancelled pick lets the run go on', async () => {
    const actor = makeActor('A');
    const grantHelpers = { findItems: jest.fn(async () => [{ uuid: 'u1', name: 'One' }]), pickOne: jest.fn(async () => null), grantCopy: jest.fn() };
    const { result } = await run([{ do: 'pickGrant', from: { type: 'gear' } }, { do: 'setVar', key: 'after', value: 1 }], actor, { grantHelpers });
    expect(result).toBe(false);
    const { result: goes, ctx } = await run([{ do: 'pickGrant', optional: true, from: { type: 'gear' } }, { do: 'setVar', key: 'after', value: 1 }], actor, { grantHelpers });
    expect(goes).not.toBe(false);
    expect(ctx.vars.after).toBe(1);
    expect(grantHelpers.grantCopy).not.toHaveBeenCalled();
  });
});

describe('tags', () => {
  test('self:/target:status:any[:except=a|b]', () => {
    const actor = makeActor('A', { statuses: ['morphed'] });
    const other = makeActor('B', { statuses: ['prone'] });
    expect(tag(['self:status:any'], { self: actor })).toBe(true);
    expect(tag(['self:status:any:except=morphed|cover'], { self: actor })).toBe(false);
    expect(tag(['target:status:any:except=morphed'], { self: actor, other })).toBe(true);
    expect(tag(['target:status:any'], { self: actor, other: null })).toBe(false);
    expect(tag(['target:status:prone'], { self: actor, other })).toBe(true);
  });

  test('item:primaryAttack - the first attack of its weapon', () => {
    const actor = makeActor('A', { items: [{ name: 'Rifle', type: 'weapon' }] });
    const rifle = actor.items.contents[0];
    const first = makeItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } } });
    const second = makeItem(actor, { name: 'Burst', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } } });
    actor.items.contents.push(first, second);
    expect(tag(['item:primaryAttack'], { self: actor, item: first })).toBe(true);
    expect(tag(['item:primaryAttack'], { self: actor, item: second })).toBe(false);
    expect(tag(['item:primaryAttack'], { self: actor, item: makeItem(actor, { type: 'weaponEffect' }) })).toBe(false);
  });

  test('roll:entry:<key> - unknown outside a targeted Trigger', () => {
    const actor = makeActor('A');
    expect(tag(['roll:entry:scapegoatSwapped'], { self: actor, entry: { scapegoatSwapped: true } })).toBe(true);
    expect(tag(['roll:entry:scapegoatSwapped'], { self: actor, entry: {} })).toBe(false);
    expect(tag(['roll:entry:scapegoatSwapped'], { self: actor })).toBeNull();
  });

  test('self:sourced:<id>:<path>=<value> / != - a missing copy or value makes = false and != true', () => {
    const actor = makeActor('A', { items: [{ name: 'Primary Tech', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.5eOqntPaqp1g4M7k' }, essence20: { techChoice: 'armor' } } }] });
    expect(tag(['self:sourced:5eOqntPaqp1g4M7k:flags.essence20.techChoice=armor'], { self: actor })).toBe(true);
    expect(tag(['self:sourced:5eOqntPaqp1g4M7k:flags.essence20.techChoice!=armor'], { self: actor })).toBe(false);
    expect(tag(['self:sourced:5eOqntPaqp1g4M7k:flags.essence20.techChoice!=drone'], { self: actor })).toBe(true);
    const fresh = makeActor('B');
    expect(tag(['self:sourced:5eOqntPaqp1g4M7k:flags.essence20.techChoice=armor'], { self: fresh })).toBe(false);
    expect(tag(['self:sourced:5eOqntPaqp1g4M7k:flags.essence20.techChoice!=armor'], { self: fresh })).toBe(true);
  });

  test('self:/target:hasArmorUpgrade:<defense> - an upgrade on worn armor (or a loose one on a transformer)', () => {
    const actor = makeActor('A', { items: [{ name: 'Plate', type: 'armor', system: { equipped: true } }] });
    const armor = actor.items.contents[0];
    actor.items.contents.push(makeItem(actor, { type: 'upgrade', flags: { essence20: { parentId: armor.id } }, system: { type: 'armor', armorBonus: { defense: 'toughness', value: 2 } } }));
    expect(armorUpgradeBonuses(actor, 'toughness')).toEqual([2]);
    expect(tag(['self:hasArmorUpgrade:toughness'], { self: actor })).toBe(true);
    expect(tag(['target:hasArmorUpgrade:evasion'], { self: actor, other: actor })).toBe(false);
    armor.system.equipped = false;
    expect(armorUpgradeBonuses(actor, 'toughness')).toEqual([]);
    const bot = makeActor('Bot', { system: { canTransform: true } });
    bot.items.contents.push(makeItem(bot, { type: 'upgrade', system: { type: 'armor', armorBonus: { defense: 'evasion', value: 1 } } }));
    expect(armorUpgradeBonuses(bot, 'evasion')).toEqual([1]);
    expect(armorUpgradeAdjust(null, bot, 'resolve', {})).toBe(0);
  });
});

describe('picks and lists', () => {
  test('canvasItems: other tokens\' items meeting the tags, one per book source; self: true includes the actor', () => {
    const actor = makeActor('A', { items: [{ name: 'Mine', type: 'perk', system: { type: 'general' }, flags: { core: { sourceId: 'S.mine' }, essence20: {} } }] });
    const ally = makeActor('B', { items: [
      { name: 'Dash', type: 'perk', system: { type: 'general' }, flags: { core: { sourceId: 'S.dash' }, essence20: {} } },
      { name: 'Unsourced', type: 'perk', system: { type: 'general' } },
    ] });
    const twin = makeActor('C', { items: [{ name: 'Dash', type: 'perk', system: { type: 'general' }, flags: { core: { sourceId: 'S.dash' }, essence20: {} } }] });
    global.canvas.tokens.placeables = [{ actor }, { actor: ally }, { actor: twin }, { actor: null }];
    const ctx = stepContext({ actor, item: null, rule: {}, targets: [] });
    expect(pickOptions({ from: 'canvasItems', filter: ['item:type:perk'] }, ctx)).toEqual([{ value: 'S.dash', label: 'B: Dash' }]);
    expect(pickOptions({ from: 'canvasItems', self: true, filter: ['item:type:perk'] }, ctx).map(o => o.value)).toEqual(['S.mine', 'S.dash']);
    expect(pickOptions({ from: 'canvasItems', anyOf: [['item:type:power']] }, ctx)).toEqual([]);
  });

  test('addToSceneList keeps each entry once, labelled as offered; sceneList reads this scene\'s', async () => {
    const actor = makeActor('A');
    const item = makeItem(actor, { name: 'Copier', type: 'perk' });
    await run([{ do: 'setVar', key: 'picked', value: 'S.dash' }, { do: 'addToSceneList', flag: 'copied' }], actor, { item, vars: { optionLabels: { 'S.dash': 'B: Dash' } } });
    await run([{ do: 'addToSceneList', flag: 'copied', entry: 'S.dash' }], actor, { item });
    expect(actor.flags.essence20.copied).toEqual({ scene: 1, list: [{ value: 'S.dash', label: 'B: Dash' }] });
    const ctx = stepContext({ actor, item, rule: {}, targets: [] });
    expect(pickOptions({ from: 'sceneList', flag: 'copied' }, ctx)).toEqual([{ value: 'S.dash', label: 'B: Dash' }]);
    actor.flags.essence20.copied.scene = 0;
    expect(pickOptions({ from: 'sceneList', flag: 'copied' }, ctx)).toEqual([]);
  });

  test('createCompanion: nothing made stops the run; recipient created is empty without one', async () => {
    const actor = makeActor('A');
    const { result } = await run([{ do: 'createCompanion', name: '{name} Jr.' }, { do: 'setVar', key: 'after', value: 1 }], actor);
    expect(result).toBe(false);
  });
});

describe('rolled durations, areas and shrugs', () => {
  test('ConditionDuration: dice rolled, numbers and formulas read, and at least 1', async () => {
    global.Roll = class {
      async evaluate() {
        this.total = 0;
        return this;
      }
    };
    const actor = makeActor('A');
    const item = rounds => makeItem(actor, { system: { rules: [{ type: 'ConditionDuration', condition: 'stunned', rounds }] } });
    expect(await ruleConditionRounds(item('1d2'), 'stunned', 1)).toBe(1);
    expect(await ruleConditionRounds(item('@level'), 'stunned', 1)).toBe(6);
    expect(await ruleConditionRounds(null, 'stunned', 2)).toBe(2);
  });

  test('BeforeArea: no area and no multiple targets - nothing to ask; a formula exclude', async () => {
    const actor = makeActor('A', { items: [{ name: 'Perk', type: 'perk', system: { rules: [{ type: 'BeforeArea', options: ['single'] }, { type: 'BeforeArea', exclude: '1' }] } }] });
    const lone = makeItem(actor, { type: 'weaponEffect', system: { numTargets: 1 } });
    expect(await ruleBeforeArea(actor, lone)).toBeNull();
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, { form: { elements: { t2: { checked: true } } } })) } } };
    const tokens = [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }];
    expect(await ruleAreaExclusions(actor, lone, tokens)).toEqual([tokens[0]]);
    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['t1']);
  });

  test('SwapShrug reads the attacker as target:', () => {
    const actor = makeActor('A', { items: [{ name: 'Perk', type: 'perk', system: { rules: [{ type: 'SwapShrug', from: 'evasion', to: 'toughness', when: ['target:status:prone'] }] } }] });
    const perk = actor.items.contents[0];
    expect(ruleSwapShrug(actor, 'toughness', 'evasion', makeActor('B', { statuses: ['prone'] }))).toBe(perk);
    expect(ruleSwapShrug(actor, 'toughness', 'evasion', makeActor('C'))).toBeNull();
  });
});
