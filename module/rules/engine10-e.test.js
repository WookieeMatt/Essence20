import { jest } from '@jest/globals';

/**
 * Round 10, group E (docs/rules-batches/slE10.md): the plug-ins in rules/ext/e/ - picking compendium entries and other
 * actors' items, multi-picks, loops, per-recipient runs, Active Effect switches, recorded scenes, the rule types read
 * by hand-written registries (hazard protection, rough-terrain imposers, Multiple Targets, Kit prerequisites), the
 * alliesAnywhere scope, the equipmentBroke event, the early / derived stages and the legacy mark pass - and the small
 * engine edits that go with them.
 */

const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => {
    offered.push(rows.map(row => row.name));
    const name = picks.shift();
    return rows.find(row => row.name == name)?.uuid ?? null;
  }),
  chooseSelect: jest.fn(async (title, prompt, options) => {
    offered.push(options.map(option => option.label));
    const label = picks.shift();
    return options.find(option => option.label == label || option.value == label)?.value ?? null;
  }),
  grantCopy: jest.fn(async (actor, uuid, { grantedBy } = {}) => {
    const entry = CATALOG.find(e => e.uuid == uuid);
    return addItem(actor, { name: entry.name, type: entry.type, flags: { core: { sourceId: uuid }, essence20: { grantedBy: grantedBy?.id } }, system: {} });
  }),
  rollTest: jest.fn(async () => ({ success: true, crit: false })),
  markIntegrated: jest.fn(),
  chooseButtons: jest.fn(),
  pickPerkFrom: jest.fn(),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/resources/requisition.mjs', () => ({ requisitionSkill: item => (item.type == 'armor' ? 'athletics' : 'targeting') }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  createItemCopies: jest.fn(async () => {}),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
}));

let picks = [];
let offered = [];
let nextId = 1;

const attack = style => ({ type: 'weaponEffect', classification: { style } });
const entry = (name, type, availability = 'standard', system = {}) => ({
  uuid: `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type, system: { availability, traits: [], items: {}, ...system },
});
const CATALOG = [
  entry('Katana', 'weapon', 'limited', { traits: ['martialArts'], items: { a: attack('melee') } }),
  entry('Club', 'weapon', 'limited', { items: { a: attack('melee') } }),
  entry('Shuriken', 'weapon', 'limited', { traits: ['martialArts'], items: { a: attack('thrown') } }),
  entry('Pistol', 'weapon', 'limited', { items: { a: attack('projectile') } }),
  entry('Vest', 'armor', 'restricted'),
  entry('Beast Origin', 'origin', 'standard', { items: { m: { type: 'altMode', name: 'Rhino', uuid: 'Compendium.essence20.cat.Item.Rhino' } } }),
  entry('Rhino', 'altMode'),
  entry('Grudge', 'hangUp'),
  entry('Silencer', 'upgrade', 'standard', { type: 'weapon' }),
];

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete parent[last.replace(/^-=/, '')];
  } else {
    parent[last] = value;
  }
}

function makeItem(data) {
  const item = { id: `i${nextId++}`, effects: [], flags: { essence20: {} }, system: {}, ...data };
  item.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(item, key, value);
    }
  });
  item.setFlag = jest.fn(async (scope, key, value) => setPath(item, `flags.${scope}.${key}`, value));
  item.updateEmbeddedDocuments = jest.fn(async (type, updates) => {
    for (const { _id, ...rest } of updates) {
      Object.assign(item.effects.find(effect => effect.id == _id), rest);
    }
  });
  item.uuid = `Item.${item.id}`;
  return item;
}

function addItem(actor, data) {
  const item = makeItem(data);
  item.parent = actor;
  actor.items.contents.push(item);
  return item;
}

function makeActor(extra = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, system: { level: 10, skills: {}, ...(extra.system ?? {}) }, statuses: new Set(extra.statuses ?? []),
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => extra.token ? [extra.token] : [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(actor, key, value);
    }
  });
  actor.createEmbeddedDocuments = jest.fn(async (type, datas) => datas.map(data => addItem(actor, data)));
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    for (const id of ids) {
      list.splice(list.findIndex(i => i.id == id), 1);
    }
  });
  for (const data of extra.items ?? []) {
    addItem(actor, data);
  }

  return actor;
}

const steps = await import('./steps.mjs');
const { runSteps, stepContext, stepErrors, recipients } = steps;
const predicate = await import('./predicate.mjs');
const { evaluate, contextFor, setWorldLookups } = predicate;
const { resolveValue } = await import('./formula.mjs');
const { validateRule, RULE_TYPES } = await import('./types.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { legacyPaths } = await import('./legacy-choices.mjs');
const { linkedEntries } = await import('./links.mjs');
await import('./plugins/index.mjs');
const eTypes = {
  ...(await import('./plugins/combat/hazard-terrain-targets.mjs')), ...(await import('./plugins/resources/kit-prerequisite.mjs')),
  ...(await import('./plugins/combat/equipment-broke.mjs')),
};
const eDerived = await import('./plugins/effects/derived-stages.mjs');
const eLegacy = await import('./plugins/marks/legacy-marks.mjs');
const { skillsFor, recordedEntries } = await import('./plugins/tags/actor-state-tags.mjs');
const { ruleDerived, ruleSurpriseModes } = await import('./adapter.mjs');

const run = (list, ctx) => runSteps(list, ctx);
const ctxFor = (actor, item, extra = {}) => ({ ...stepContext({ actor, item, targets: extra.targets ?? [] }), grantHelpers: grants, ...extra });

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
});

beforeEach(() => {
  picks = [];
  offered = [];
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.actors = [];
  global.game.actors.party = null;
  global.canvas = undefined;
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid);
    return found ? { ...found, toObject: () => JSON.parse(JSON.stringify({ name: found.name, type: found.type, system: found.system })) } : null;
  });
  global.fromUuidSync = jest.fn(uuid => global.game.actors.find?.(a => a.uuid == uuid) ?? null);
  global.CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15, prototype: 20 };
});

describe('pickEntry', () => {
  test('a compendium entry kept in the run: its DIF, one step harder, Skill and traits; nothing granted', async () => {
    const actor = makeActor();
    const item = addItem(actor, { name: 'Perk', type: 'perk' });
    const ctx = ctxFor(actor, item);
    picks = ['Vest'];
    expect(await run([{ do: 'pickEntry', from: { type: 'armor' } }], ctx)).toBe(true);
    expect(ctx.vars).toMatchObject({ picked: CATALOG[4].uuid, pickedName: 'Vest', pickedDif: 15, pickedDifHarder: 20, pickedSkill: 'athletics' });
    expect(actor.items.contents).toHaveLength(1);
    // A cancelled pick stops the run.
    picks = [];
    expect(await run([{ do: 'pickEntry', from: { type: 'armor' } }, { do: 'chat', text: 'after' }], ctx)).toBe(false);
  });

  test('tags read the run (var:includes on an earlier pick\'s traits); record keeps it; children offers its Alt Modes', async () => {
    const actor = makeActor();
    const item = addItem(actor, { name: 'Perk', type: 'perk' });
    const ctx = ctxFor(actor, item);
    picks = ['Club', 'Shuriken'];
    await run([
      { do: 'pickEntry', var: 'melee', record: true, key: 'chosen', max: 1, from: { type: 'weapon', tags: ['item:hasAttack:item:data:system.classification.style=melee'] } },
      { do: 'pickEntry', var: 'ranged', record: true, key: 'chosen', max: 2, from: { type: 'weapon', tags: ['item:hasAttack:item:data:system.classification.style!=melee', { any: ['var:includes:meleeTraits:martialArts', 'item:trait:martialArts'] }] } },
    ], ctx);
    expect(offered).toEqual([['Katana', 'Club'], ['Shuriken']]);
    expect(item.flags.essence20.rules.choices.chosen.map(e => e.name)).toEqual(['Club', 'Shuriken']);

    // children: the picked Origin's Alt Mode, taken unasked when it's the only one.
    picks = ['Beast Origin'];
    await run([{ do: 'pickEntry', from: { type: 'origin' } }, { do: 'pickEntry', var: 'mode', auto: true, children: { of: 'picked', type: 'altMode' } }], ctx);
    expect(ctx.vars.mode).toBe('Compendium.essence20.cat.Item.Rhino');
    expect(stepErrors([{ do: 'pickEntry' }])).toHaveLength(1);
    expect(stepErrors([{ do: 'pickEntry', from: { type: 'weapon', tags: ['nope:x'] } }])).toHaveLength(1);
  });

  test('a recording step\'s legacy path is moved by the linking pass (legacyPaths)', () => {
    const item = { system: { rules: [{ type: 'Use', steps: [{ do: 'pickEntry', record: true, key: 'chosen', legacy: 'flags.essence20.q1Chosen', from: { type: 'weapon' } }, { do: 'restoreSize', record: 'size', legacy: 'flags.x' }] }] } };
    expect(legacyPaths(item)).toEqual({ chosen: 'flags.essence20.q1Chosen' });
  });
});

describe('pickActorItem + item:recorded / self:crewsRecorded', () => {
  test('an ally\'s weapon or crewed vehicle, recorded for the mission', async () => {
    const ally = makeActor({ name: 'Ally' });
    const gun = addItem(ally, { name: 'Rifle', type: 'weapon', flags: { core: { sourceId: 'Compendium.x.Item.rifle' } } });
    const tank = { uuid: 'Actor.tank', type: 'vehicle', name: 'Tank', system: { actors: { a: { uuid: ally.uuid } } } };
    const actor = makeActor();
    global.game.actors = [ally, actor, tank];
    const item = addItem(actor, { name: 'Training Evolution', type: 'perk', flags: { essence20: { rules: { choices: { ally: ally.uuid } } } } });
    const askPick = async (step, options) => {
      offered.push(options.map(o => o.label));
      return options[0].value;
    };

    const ctx = ctxFor(actor, item, { askPick });
    await run([{ do: 'pickActorItem', actor: 'picked:ally', itemType: 'weapon', vehicles: true, key: 'evolution', record: true, max: 1, until: 'mission' }], ctx);
    expect(offered).toEqual([['Rifle', 'Tank']]);
    expect(recordedEntries(item, 'evolution')).toEqual([expect.objectContaining({ kind: 'weapon', uuid: 'Compendium.x.Item.rifle', name: 'Rifle', ally: 'Ally', until: 'mission' })]);
    const mine = { name: 'Rifle', flags: { core: { sourceId: 'Compendium.x.Item.rifle' } } };
    expect(evaluate(['item:recorded:evolution'], contextFor({ self: actor, ruleItem: item, item: mine }))).toBe(true);
    expect(evaluate(['item:recorded:evolution'], contextFor({ self: actor, ruleItem: item, item: { name: 'Bow' } }))).toBe(false);
    expect(gun).toBeDefined();

    // A vehicle, and an old single record from another mission (moved in by legacy) that no longer counts.
    item.flags.essence20.rules.choices.evolution = { kind: 'vehicle', uuid: 'Actor.tank', name: 'Tank' };
    tank.system.actors.b = { uuid: actor.uuid };
    expect(evaluate(['self:crewsRecorded:evolution'], contextFor({ self: actor, ruleItem: item }))).toBe(true);
    item.flags.essence20.rules.choices.evolution = { kind: 'weapon', uuid: 'Compendium.x.Item.rifle', name: 'Rifle', mission: -5 };
    expect(evaluate(['item:recorded:evolution'], contextFor({ self: actor, ruleItem: item, item: mine }))).toBe(false);
  });
});

describe('pickMany, repeat, forEach, focus', () => {
  test('pickMany keeps up to count of a pick source; none is fine; closing stops', async () => {
    const actor = makeActor();
    const item = addItem(actor, { name: 'Perk', type: 'perk' });
    const ctx = ctxFor(actor, item, { askMany: async (step, options) => options.map(o => o.value) });
    await run([{ do: 'pickMany', key: 'team', from: 'list', options: ['a', 'b', 'c'], count: '1 + 1' }], ctx);
    expect(item.flags.essence20.rules.choices.team).toEqual(['a', 'b']);
    ctx.askMany = async () => null;
    expect(await run([{ do: 'pickMany', key: 'team', from: 'list', options: ['a'] }], ctx)).toBe(false);
    expect(stepErrors([{ do: 'pickMany', key: 'x' }])).toHaveLength(1);
  });

  test('repeat runs until a step stops and counts; forEach runs per recipient; focus sets the targets', async () => {
    const actor = makeActor();
    const item = addItem(actor, { name: 'Perk', type: 'perk' });
    const ctx = ctxFor(actor, item);
    let n = 0;
    ctx.ask = async () => (n++ < 2 ? 0 : null);
    await run([{ do: 'repeat', steps: [{ do: 'choose', options: [{ label: 'go', steps: [] }] }] }], ctx);
    expect(ctx.vars.repeats).toBe(2);
    const a = makeActor({ name: 'A' });
    const b = makeActor({ name: 'B' });
    ctx.targets = [a, b];
    await run([{ do: 'forEach', to: 'targets', steps: [{ do: 'chat', text: 'hi {target}' }, { do: 'require', check: ['target:name~a'] }, { do: 'chat', text: 'A only' }] }], ctx);
    expect(ctx.chat.filter(line => line.startsWith('hi')).length).toBe(2);
    expect(ctx.chat.filter(line => line == 'A only')).toHaveLength(1);
    expect(ctx.targets).toEqual([a, b]);
    global.game.combat = { started: true, combatant: { actor: b } };
    ctx.targets = [];
    await run([{ do: 'focus', to: 'targetOrCombatant' }], ctx);
    expect(ctx.targets).toEqual([b]);
    expect(stepErrors([{ do: 'repeat' }, { do: 'forEach' }, { do: 'focus' }])).toHaveLength(3);
  });

  test('allParties: the actor and everyone on any Party roster with it', () => {
    const actor = makeActor();
    const mate = makeActor({ name: 'Mate' });
    global.game.actors = [actor, mate, { type: 'party', system: { actors: { a: { uuid: actor.uuid }, b: { uuid: mate.uuid } } } }];
    expect(recipients({ to: 'allParties' }, ctxFor(actor, null))).toEqual([actor, mate]);
  });
});

describe('item and actor writes', () => {
  test('setEffects switches the rule item\'s own effects by change key, name, or anything else', async () => {
    const actor = makeActor({ system: { level: 9 } });
    const item = addItem(actor, { name: 'Thick Skin', type: 'perk', flags: { essence20: { rules: { choices: { thick7: 'evasion' } } } } });
    item.effects = [
      { id: 'h7', name: '7th Level Health Bonus', changes: [{ key: 'system.health.bonus' }], disabled: true },
      { id: 'h15', name: '15th Level Health Bonus', changes: [{ key: 'system.health.bonus' }], disabled: false },
      { id: 'ev', name: 'Evasion', changes: [{ key: 'system.defenses.evasion.bonus' }], disabled: true },
      { id: 'to', name: 'Toughness', changes: [{ key: 'system.defenses.toughness.bonus' }], disabled: false },
    ];
    await run([{ do: 'setEffects', effects: [
      { changeKey: 'defenses.evasion.bonus', on: ['rule:data:flags.essence20.rules.choices.thick7=evasion'] },
      { changeKey: 'defenses.toughness.bonus', on: ['rule:data:flags.essence20.rules.choices.thick7=toughness'] },
      { name: '15th', on: ['self:level>=15'] },
      { on: ['self:level>=7'] },
    ] }], ctxFor(actor, item));
    expect(item.effects.map(e => [e.id, e.disabled])).toEqual([['h7', false], ['h15', true], ['ev', false], ['to', true]]);
    expect(stepErrors([{ do: 'setEffects' }, { do: 'setEffects', effects: [{ on: 'x' }] }])).toHaveLength(2);
  });

  test('unbank, appendToName, recordScene + onRecordedScene', async () => {
    const scene = { id: 'sc', name: 'Canyon' };
    const actor = makeActor({ flags: { ruleBank: [{ source: 'mine', uses: 1 }, { source: 'other', uses: 1 }] }, token: { parent: scene } });
    const item = addItem(actor, { name: 'Metier', type: 'perk' });
    item.id = 'mine';
    await run([{ do: 'unbank' }, { do: 'appendToName', text: 'Silent' }, { do: 'recordScene', path: 'flags.essence20.survey' }], ctxFor(actor, item));
    expect(actor.flags.essence20.ruleBank).toEqual([{ source: 'other', uses: 1 }]);
    expect(item.name).toBe('Metier (Silent)');
    expect(actor.flags.essence20.survey).toMatchObject({ sceneId: 'sc' });
    expect(evaluate(['self:onRecordedScene:flags.essence20.survey'], contextFor({ self: actor }))).toBe(true);
    const ally = makeActor({ token: { parent: { id: 'elsewhere' } } });
    expect(evaluate(['self:onRecordedScene:flags.essence20.survey'], contextFor({ self: ally }))).toBe(false);
    expect(evaluate(['holder:onRecordedScene:flags.essence20.survey'], contextFor({ self: ally, holder: actor }))).toBe(true);
    // No scene: stops, saying so.
    const lost = makeActor();
    const ctx = ctxFor(lost, addItem(lost, { name: 'x', type: 'perk' }));
    expect(await run([{ do: 'recordScene', path: 'flags.essence20.survey' }], ctx)).toBe(false);
    expect(stepErrors([{ do: 'recordScene', path: 'system.x' }])).toHaveLength(1);
  });

  test('grantTopRolePerks: the base Role\'s highest Role Perks not already owned', async () => {
    const actor = makeActor();
    addItem(actor, { name: 'Old Hand', type: 'role', flags: { core: { sourceId: 'Compendium.x.Item.oldHand' } }, system: { items: { z: { type: 'perk', subtype: 'role', level: 16, name: 'Peak', uuid: 'U.z' } } } });
    addItem(actor, { name: 'Officer', type: 'role', system: { items: {
      a: { type: 'perk', subtype: 'role', level: 18, name: 'Momentum', uuid: CATALOG[7].uuid },
      b: { type: 'perk', subtype: 'role', level: 18, name: 'Plan of Action 5', uuid: 'U.p' },
      c: { type: 'perk', subtype: 'role', level: 10, name: 'Other', uuid: 'U.o' },
    } } });
    const item = addItem(actor, { name: 'Peak Performance', type: 'perk' });
    grants.grantCopy.mockClear();
    await run([{ do: 'grantTopRolePerks', notRole: 'Compendium.x.Item.oldHand', notRoleName: 'Old Hand', excludeName: '^Plan of Action' }], ctxFor(actor, item));
    expect(grants.grantCopy).toHaveBeenCalledTimes(1);
    expect(grants.grantCopy.mock.calls[0][1]).toBe(CATALOG[7].uuid);
    const bare = makeActor();
    expect(await run([{ do: 'grantTopRolePerks' }], ctxFor(bare, addItem(bare, { name: 'x', type: 'perk' })))).toBe(false);
    expect(stepErrors([{ do: 'grantTopRolePerks', excludeName: '(' }])).toHaveLength(1);
  });

  test('fitUpgrade attaches a compendium upgrade to the picked item; giveCopy makes a copy on someone else', async () => {
    const actor = makeActor();
    const pistol = addItem(actor, { name: 'Pistol', type: 'weapon' });
    const item = addItem(actor, { name: 'Nothing Personal', type: 'perk', flags: { essence20: { rules: { choices: { pistol: pistol.id } } } } });
    await run([{ do: 'fitUpgrade', uuid: CATALOG[8].uuid, onto: 'choice:pistol', flags: { q1FreeSilencer: true } }], ctxFor(actor, item));
    const silencer = actor.items.contents.find(i => i.name == 'Silencer');
    expect(silencer.flags.essence20).toMatchObject({ parentId: pistol.id, q1FreeSilencer: true, collectionId: 'k1' });
    expect(silencer.flags.essence20.grantedBy).toBeUndefined();
    expect(stepErrors([{ do: 'fitUpgrade', uuid: 'x', onto: 'pistol' }])).toHaveLength(1);

    const foe = makeActor({ name: 'Foe' });
    const ctx = ctxFor(actor, item, { targets: [foe] });
    ctx.vars.picked = CATALOG[7].uuid;
    await run([{ do: 'giveCopy', to: 'target', uuid: '{var.picked}' }], ctx);
    expect(foe.items.contents[0]).toMatchObject({ name: 'Grudge', flags: { essence20: { grantedBy: item.id } } });
  });
});

describe('tags, refs and pick sources', () => {
  test('self:inTeamOf:holder[:others] and self:hasTeammates read the primary Party (else player-owned PCs)', () => {
    const holder = makeActor({ name: 'Holder' });
    const mate = makeActor({ name: 'Mate' });
    const stranger = makeActor({ name: 'Stranger' });
    global.game.actors = [holder, mate, stranger];
    global.game.actors.party = { members: [holder, mate] };
    const item = addItem(holder, { name: 'Early Adopter', type: 'perk' });
    const ask = (self, tag) => evaluate([tag], contextFor({ self, ruleItem: item }));
    expect(ask(mate, 'self:inTeamOf:holder:others')).toBe(true);
    expect(ask(holder, 'self:inTeamOf:holder:others')).toBe(false);
    expect(ask(holder, 'self:inTeamOf:holder')).toBe(true);
    expect(ask(stranger, 'self:inTeamOf:holder')).toBe(false);
    expect(ask(holder, 'self:hasTeammates')).toBe(true);
    global.game.actors.party = { members: [] };
    mate.hasPlayerOwner = true;
    expect(ask(mate, 'self:inTeamOf:holder')).toBe(true);
    expect(ask(holder, 'self:hasTeammates')).toBe(true);
    mate.hasPlayerOwner = false;
    expect(ask(holder, 'self:hasTeammates')).toBe(false);
  });

  test('damage, turn, roll and effect tags', () => {
    const hurt = makeActor({ system: { health: { max: 5, value: 4 }, essences: { smarts: { max: 3, value: 3 } } } });
    expect(evaluate(['target:healthDamaged', 'not:target:essenceDamaged'], contextFor({ self: hurt, other: hurt }))).toBe(true);
    hurt.system.essences.smarts.value = 1;
    expect(evaluate(['self:essenceDamaged'], contextFor({ self: hurt }))).toBe(true);
    expect(evaluate(['target:ownTurn'], contextFor({ self: hurt, other: hurt, combat: { started: true, combatant: { actor: hurt } } }))).toBe(true);
    expect(evaluate(['target:ownTurn'], contextFor({ self: hurt, other: hurt, combat: { started: false, combatant: { actor: hurt } } }))).toBe(false);
    expect(evaluate(['roll:damaging'], contextFor({ results: [{ damageValue: 2 }] }))).toBe(true);
    expect(evaluate(['roll:damaging'], contextFor({ results: [{ damageValue: 0 }] }))).toBe(false);
    expect(evaluate(['roll:damaging'], contextFor({}))).toBeNull();
    const origin = makeItem({ type: 'origin', flags: { core: { sourceId: 'C.Item.assassin' } } });
    origin.effects = [{ disabled: false, changes: [{ key: 'system.poisonTraining' }] }];
    const assassin = makeActor();
    assassin.items.contents.push(origin);
    expect(evaluate(['self:itemEffect:C.Item.assassin:system.poisonTraining'], contextFor({ self: assassin }))).toBe(true);
    origin.effects[0].disabled = true;
    expect(evaluate(['self:itemEffect:C.Item.assassin:system.poisonTraining'], contextFor({ self: assassin }))).toBe(false);
    expect(evaluate(['var:includes:t:martialArts'], contextFor({ vars: { t: 'ballistic,martialArts' } }))).toBe(true);
    expect(evaluate(['var:includes:t:silent'], contextFor({ vars: { t: ['ballistic'] } }))).toBe(false);
  });

  test('@alliesWearing counts allies wearing that upgrade', () => {
    const wearer = makeActor();
    const ally = makeActor({ items: [{ type: 'upgrade', name: 'Uniform', flags: { core: { sourceId: 'Compendium.essence20.cobra_codex.Item.VkSI68BkpXLOC5ys' } } }] });
    const bare = makeActor();
    setWorldLookups({ alliesWithin: () => [ally, bare] });
    expect(resolveValue('1 + @alliesWearing.VkSI68BkpXLOC5ys.100000', { actor: wearer })).toBe(2);
    setWorldLookups({ alliesWithin: null });
  });

  test('skills / defense / partyMates / ownedItems pick sources', () => {
    global.CONFIG.E20.skillToEssence = { athletics: 'strength', brawn: 'strength', might: 'strength', science: 'smarts', spellcasting: 'social', conditioning: 'strength' };
    const actor = makeActor({ system: { skills: {
      athletics: { shift: 'd4' }, brawn: { shift: 'd20' }, might: { shift: 'd12' }, science: { shift: 'd20' }, spellcasting: { shift: 'd20' }, conditioning: { shift: 'd6' },
    } } });
    const item = addItem(actor, { name: 'Dabbler', type: 'perk', flags: { essence20: { rules: { choices: { lower: 'athletics' } } } } });
    const lower = { minShift: 'd2', exclude: ['conditioning'], partner: { sameEssence: true, also: ['spellcasting'], exclude: ['conditioning'], maxShift: 'd10' } };
    expect(skillsFor(lower, actor, item).sort()).toEqual(['athletics', 'might']);
    const raise = { sameEssenceAs: 'lower', also: ['spellcasting'], exclude: ['conditioning'], notChoice: 'lower', maxShift: 'd10' };
    expect(skillsFor(raise, actor, item).sort()).toEqual(['brawn', 'spellcasting']);
    item.flags.essence20.rules.choices.skillA = 'science';
    expect(skillsFor({ differentEssenceFrom: 'skillA' }, actor, item)).not.toContain('science');
    expect(stepErrors([{ do: 'pick', key: 'x', from: 'skills' }, { do: 'pick', key: 'x', from: 'defense' }, { do: 'pick', key: 'x', from: 'partyMates' }, { do: 'pick', key: 'x', from: 'ownedItems' }])).toEqual([]);
    const ctx = ctxFor(actor, item);
    item.flags.essence20.rules.choices.thick7 = 'evasion';
    expect(steps.pickOptions({ from: 'defense', notChoices: ['thick7'] }, ctx).map(o => o.value)).toEqual(['toughness', 'willpower', 'cleverness']);
    const target = makeActor();
    ctx.targets = [target];
    expect(steps.pickOptions({ from: 'partyMates', orTargets: true }, ctx).map(o => o.value)).toEqual([target.uuid]);
    addItem(actor, { name: 'Rifle', type: 'weapon' });
    const pistol = addItem(actor, { name: 'Heavy Pistol', type: 'weapon' });
    expect(steps.pickOptions({ from: 'ownedItems', itemType: 'weapon', prefer: ['item:name~pistol'] }, ctx).map(o => o.value)).toEqual([pistol.id]);
    expect(steps.pickOptions({ from: 'ownedItems', itemType: 'weapon', prefer: ['item:name~bow'] }, ctx)).toHaveLength(2);
  });
});

describe('rule types read by registries', () => {
  test('HazardProtection: categories, a picked environment, its when', () => {
    const actor = makeActor();
    addItem(actor, { name: 'Weather Gear', type: 'upgrade', flags: { essence20: { rules: { choices: { environment: 'extremeCold' } } } }, system: { rules: [
      { type: 'HazardProtection', categories: ['temperature'], environments: ['{choice.environment}'] },
    ] } });
    rebuildIndex(actor);
    expect(eTypes.ruleHazardProtection(actor, 'extremeCold', { category: 'temperature' })).toBe('Weather Gear');
    expect(eTypes.ruleHazardProtection(actor, 'extremeHeat', { category: 'temperature' })).toBeNull();
    expect(eTypes.ruleHazardProtection(actor, 'extremeCold', { category: 'breathing' })).toBeNull();
    expect(validateRule({ type: 'HazardProtection', categories: ['temperature'] })).toEqual([]);
  });

  test('RoughTerrainImposer: a holder\'s rule asked about the one moving', () => {
    const holder = makeActor();
    addItem(holder, { name: 'Misguide', type: 'perk', system: { rules: [{ type: 'RoughTerrainImposer', when: ['target:marked:misguided'] }] } });
    rebuildIndex(holder);
    const mover = makeActor({ flags: { ruleMarks: { misguided: { by: holder.uuid } } } });
    global.game.actors = [holder, mover];
    expect(eTypes.ruleImposesRoughTerrain({ actor: mover })).toBe(true);
    expect(eTypes.ruleImposesRoughTerrain({ actor: makeActor() })).toBe(false);
  });

  test('MultipleTargets: the actor\'s own rule, and its driver\'s for the vehicle (scope driven)', () => {
    const driver = makeActor();
    addItem(driver, { name: 'Plow', type: 'perk', system: { rules: [
      { type: 'MultipleTargets', when: ['attack:ram'] }, { type: 'MultipleTargets', scope: 'driven', when: ['self:type:vehicle', 'attack:ram'] },
    ] } });
    rebuildIndex(driver);
    const ram = { type: 'weaponEffect', system: { isRam: true }, flags: {} };
    expect(eTypes.ruleMultipleTargets(driver, ram)).toBe(true);
    expect(eTypes.ruleMultipleTargets(driver, { type: 'weaponEffect', system: {}, flags: {} })).toBe(false);
    const vehicle = makeActor({ type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    global.game.actors = [driver, vehicle];
    global.fromUuidSync = jest.fn(uuid => [driver, vehicle].find(a => a.uuid == uuid) ?? null);
    rebuildIndex(vehicle);
    expect(eTypes.ruleMultipleTargets(vehicle, ram)).toBe(true);
  });

  test('KitPrerequisite: lower (never past d2) and waive (tiers, Essence kits left alone)', () => {
    global.CONFIG.E20.skillShiftList = ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
    const lowerer = makeActor();
    addItem(lowerer, { name: 'Good To Go', type: 'perk', system: { rules: [{ type: 'KitPrerequisite', mode: 'lower' }] } });
    rebuildIndex(lowerer);
    const out = { need: 'd6' };
    eTypes.ruleKitPrerequisite(lowerer, {}, out);
    expect(out.need).toBe('d4');
    const floor = { need: 'd2' };
    eTypes.ruleKitPrerequisite(lowerer, {}, floor);
    expect(floor.need).toBe('d2');
    const waiver = makeActor();
    addItem(waiver, { name: 'TTF', type: 'perk', system: { rules: [{ type: 'KitPrerequisite', mode: 'waive', tiers: ['standard', 'limited'], skipEssenceKits: true }] } });
    rebuildIndex(waiver);
    const limited = { need: 'd6' };
    eTypes.ruleKitPrerequisite(waiver, { tier: 'limited' }, limited);
    expect(limited.need).toBe('d20');
    for (const info of [{ tier: 'restricted' }, { tier: 'limited', essence: 'smarts' }]) {
      const kept = { need: 'd8' };
      eTypes.ruleKitPrerequisite(waiver, info, kept);
      expect(kept.need).toBe('d8');
    }

    expect(validateRule({ type: 'KitPrerequisite' })).toEqual(['mode is required']);
  });

  test('alliesAnywhere scope reaches allies of the holder (not the holder, not enemies)', () => {
    const leader = makeActor();
    addItem(leader, { name: 'Leader', type: 'perk', system: { rules: [{ type: 'RollModifier', scope: 'alliesAnywhere', upshift: 1 }] } });
    rebuildIndex(leader);
    const ally = makeActor();
    const npc = makeActor({ type: 'npc' });
    global.game.actors = [leader, ally, npc];
    global.game.actors.get = id => [leader, ally, npc].find(a => a.id == id);
    expect(linkedEntries(ally, 'RollModifier').map(e => e.holder)).toEqual([leader]);
    expect(linkedEntries(npc, 'RollModifier')).toEqual([]);
    expect(linkedEntries(leader, 'RollModifier')).toEqual([]);
    expect(RULE_TYPES.RollModifier.scopes).toContain('alliesAnywhere');
  });

  test('equipmentBroke runs the world\'s Triggers for it', async () => {
    const junk = makeActor();
    addItem(junk, { name: 'Junker', type: 'hangUp', system: { rules: [{ type: 'Trigger', event: 'equipmentBroke', steps: [{ do: 'updateActor', set: { 'flags.essence20.saw': true } }] }] } });
    rebuildIndex(junk);
    global.game.actors = [junk, makeActor()];
    await eTypes.equipmentBroke();
    expect(junk.flags.essence20.saw).toBe(true);
  });
});

describe('stages and the legacy mark pass', () => {
  test('DerivedStat stage early: applied by earlyDerivedStats, skipped by the ordinary pass', () => {
    const actor = makeActor({ system: { poisonTraining: 2 } });
    addItem(actor, { name: 'Metier', type: 'perk', system: { rules: [{ type: 'DerivedStat', stage: 'early', path: 'system.poisonTraining', op: 'add', value: -1, when: ['self:data:system.poisonTraining>0'] }] } });
    rebuildIndex(actor);
    eDerived.earlyDerivedStats(actor);
    expect(actor.system.poisonTraining).toBe(1);
    ruleDerived(actor);
    expect(actor.system.poisonTraining).toBe(1);
    expect(validateRule({ type: 'DerivedStat', stage: 'early', path: 'system.x', value: 1 })).toEqual([]);
  });

  test('Movement stage derived, and the combat refresh', () => {
    const actor = makeActor({ system: { movement: { ground: { total: 30 } } } });
    addItem(actor, { name: 'Yo Joe!', type: 'perk', system: { rules: [{ type: 'Movement', movement: 'ground', op: 'add', value: 10, stage: 'derived', when: ['combat:roundIs:1'] }] } });
    rebuildIndex(actor);
    eDerived.derivedMovement(actor);
    expect(actor.system.movement.ground.total).toBe(30);
    global.game.combat = { round: 1, started: true };
    eDerived.derivedMovement(actor);
    expect(actor.system.movement.ground.total).toBe(40);
    expect(eDerived.readsCombat(actor)).toBe(true);
    actor.reset = jest.fn();
    eDerived.refreshCombatMovement({ combatants: [{ actor }, { actor: makeActor() }] });
    expect(actor.reset).toHaveBeenCalled();
  });

  test('legacy mark pass: old creature lists become per-setter marks, once', () => {
    const holder = makeActor({ flags: { d22Met: { c1: 3, c2: 1 }, d22Deceived: ['c1'] } });
    const item = addItem(holder, { name: 'Natural Style', type: 'perk', system: { rules: [
      { type: 'Trigger', event: 'hit', steps: [
        { do: 'mark', to: 'target', key: 'met', perSetter: true, legacy: 'flags.essence20.d22Met' },
        { do: 'mark', to: 'target', key: 'metHere', perSetter: true, until: 'scene', legacy: 'flags.essence20.d22Met', legacyScene: true },
      ] },
      { type: 'Trigger', event: 'miss', steps: [{ do: 'mark', to: 'target', key: 'met', perSetter: true, legacy: 'flags.essence20.d22Met' }] },
    ] } });
    const c1 = makeActor();
    c1.id = 'c1';
    const c2 = makeActor();
    c2.id = 'c2';
    global.game.actors = [holder, c1, c2];
    global.game.actors.get = id => [holder, c1, c2].find(a => a.id == id);
    global.game.settings = { get: () => 3 };
    const moves = eLegacy.legacyMarkMoves(holder);
    const keysOn = actor => moves.filter(m => m.doc === actor).flatMap(m => Object.keys(m.update));
    expect(keysOn(c1).sort()).toEqual([`flags.essence20.ruleMarks.met--${holder.id}`, `flags.essence20.ruleMarks.metHere--${holder.id}`].sort());
    expect(keysOn(c2)).toEqual([`flags.essence20.ruleMarks.met--${holder.id}`]);
    expect(moves.at(-1)).toEqual({ doc: holder, update: { [`flags.essence20.legacyMarks.${item.id}-met`]: true, [`flags.essence20.legacyMarks.${item.id}-metHere`]: true } });
    holder.flags.essence20.legacyMarks = { [`${item.id}-met`]: true, [`${item.id}-metHere`]: true };
    expect(eLegacy.legacyMarkMoves(holder)).toEqual([]);
    expect(eLegacy.legacyKeys(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('engine edits', () => {
  test('a roll step\'s Skill fills {var}; a ladder path fills {choice}; choose prompts fill {target}', async () => {
    const actor = makeActor({ system: { skills: { might: { shift: 'd4' }, brawn: { shift: 'd6' } } } });
    const item = addItem(actor, { name: 'Dabbler', type: 'perk', flags: { essence20: { rules: { choices: { lower: 'might' } } } } });
    const ctx = ctxFor(actor, item);
    grants.rollTest.mockClear();
    ctx.vars.pickedSkill = 'brawn';
    await run([{ do: 'roll', skill: '{var.pickedSkill}', dif: 5 }, { do: 'updateActor', ladder: { 'system.skills.{choice.lower}.shift': -1, 'system.skills.{choice.raise}.shift': 1 } }], ctx);
    expect(grants.rollTest.mock.calls[0][1]).toBe('brawn');
    expect(actor.system.skills.might.shift).toBe('d2');
    expect(actor.system.skills.brawn.shift).toBe('d6');
  });

  test('pickGrant appendTraits; SurpriseExemption sees holder:; Trigger when sees the roll\'s results', async () => {
    const actor = makeActor();
    const item = addItem(actor, { name: 'Field Trials', type: 'perk' });
    grants.grantCopy.mockImplementationOnce(async who => addItem(who, { name: 'Scope', type: 'upgrade', system: { traits: ['x'] } }));
    picks = ['Silencer'];
    await run([{ do: 'pickGrant', from: { type: 'upgrade' }, appendTraits: ['temperamental'] }], ctxFor(actor, item));
    expect(actor.items.contents.find(i => i.name == 'Scope').system.traits).toEqual(['x', 'temperamental']);

    const scene = { id: 'sc' };
    const holder = makeActor({ flags: { survey: { sceneId: 'sc' } }, token: { parent: scene } });
    addItem(holder, { name: 'Cartography', type: 'perk', system: { rules: [{ type: 'SurpriseExemption', mode: 'move', when: ['holder:onRecordedScene:flags.essence20.survey'] }] } });
    expect(ruleSurpriseModes(holder).has('move')).toBe(true);

    const { fireTriggers } = await import('./triggers.mjs');
    const victim = makeActor();
    addItem(victim, { name: 'Revengeful', type: 'perk', system: { rules: [{ type: 'Trigger', event: 'targeted', outcome: 'success', when: ['roll:damaging'], steps: [{ do: 'updateActor', set: { 'flags.essence20.hit': true } }] }] } });
    rebuildIndex(victim);
    await fireTriggers(victim, 'targeted', { outcome: 'success', facts: { results: [{ success: true, damageValue: 0 }] }, targets: [actor] });
    expect(victim.flags.essence20.hit).toBeUndefined();
    await fireTriggers(victim, 'targeted', { outcome: 'success', facts: { results: [{ success: true, damageValue: 3 }] }, targets: [actor] });
    expect(victim.flags.essence20.hit).toBe(true);
  });
});
