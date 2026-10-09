import { jest } from '@jest/globals';
import { bonusOf } from '../mechanics/vehicles/megaform-bonus-health.mjs';

/**
 * Round 10, group A engine pieces (module/rules/ext/a/): the megaform / ownZord / zordOwner scopes, the Megaform,
 * Zord-ownership, companion, size, Form and movement tags, the recipients and pick sources, the megaformSync /
 * shiftSize / restoreSize / askChoiceText / spendFrom / formStart / formEnd / rollAs / transformInto / noteEntries
 * steps, the @sourced ref, the Size / ArmorAccommodation / SizeMatrixCancel / MegaformHealth / MegaformMirror /
 * SummonLimit / JoinTime / SummonTime / AutoDisembark / KnownOptions / Form rule types, the beforeRoll /
 * groupTestResult / megaformCombined events, the derivedHook Movement stage, the rule holder in roll contexts, and the
 * pickPerkFrom pack filter.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const formCalls = [];
jest.unstable_mockModule('./items/forms/ranger-form-perks.mjs', () => ({
  activateForm: jest.fn(async (actor, uuid) => {
    formCalls.push(['start', actor.name, uuid]);
    return uuid != 'Compendium.x.Item.refused';
  }),
  endForm: jest.fn(async actor => formCalls.push(['end', actor.name])),
}));
const tally = jest.fn();
jest.unstable_mockModule('./mechanics/rolls/group-tests.mjs', () => ({ tally }));
const visiblePacks = [];
jest.unstable_mockModule('./util/compendium-browser.mjs', () => ({ getVisibleItemPacks: () => visiblePacks }));

let nextId = 1;
let sceneEpoch = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const deletion = (__isForcedDeletion(value) ? key.match(/^(.*)\.([^.]+)$/) : key.match(/^(.*)\.-=(.+)$/));
  if (deletion) {
    delete getPath(object, deletion[1])?.[deletion[2]];
    return;
  }

  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

const actors = [];
const placeables = [];
const items = new Map();
global.game = {
  combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
  settings: { get: (scope, key) => (String(key).toLowerCase().includes('scene') ? sceneEpoch : 1), set: async () => {} },
  actors: { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() },
  i18n: { localize: k => k, format: k => k, has: () => false },
};
global.canvas = { tokens: { placeables }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? items.get(uuid) ?? null;
global.fromUuid = async uuid => global.fromUuidSync(uuid);
global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.CONFIG = { E20: { skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'], skillToEssence: { driving: 'speed', athletics: 'strength' } } };
global.foundry = {
  data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)), escapeHTML: text => String(text) },
  applications: { api: { DialogV2: { wait: jest.fn(async () => null), prompt: jest.fn(async () => null) } } },
};

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { linkedEntries } = await import('./links.mjs');
const { runSteps, stepContext, stepErrors, recipients, pickOptions } = await import('./steps.mjs');
const { validateRule } = await import('./types.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { resolveValue } = await import('./formula.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleRollSources } = await import('./adapter.mjs');
const { runPreRoll } = await import('../mechanics/item-hooks.mjs');
const { pickPerkFrom } = await import('../mechanics/resources/grants.mjs');
const megaformExt = await import('./plugins/zords/megaform.mjs');
const sizeExt = await import('./plugins/effects/size.mjs');
const zordsExt = await import('./plugins/zords/zords.mjs');
const hooksExt = {
  ...(await import('./plugins/zords/zord-timing-hooks.mjs')), ...(await import('./plugins/picks/known-options.mjs')),
  ...(await import('./plugins/rolls/before-roll-and-group-test-events.mjs')), ...(await import('./plugins/effects/derived-hook-movement.mjs')),
};
const formsExt = await import('./plugins/zords/form-perks.mjs');
const linksExt = await import('./plugins/zords/zord-link-scopes.mjs');

function asItem(data, actor) {
  const item = {
    id: data.id ?? `i${nextId++}`, flags: {}, system: {}, effects: [], isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    toObject() {
      return JSON.parse(JSON.stringify({ _id: this.id, name: this.name, type: this.type, system: this.system, flags: this.flags }));
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  items.set(item.uuid, item);
  return item;
}

function makeActor(type, name, system = {}, { x = null, flags = {} } = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: { ...flags } }, effects: [],
    system: { health: { value: 5, max: 10 }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    createEmbeddedDocuments: jest.fn(async function (kind, datas) {
      return datas.map(data => {
        const made = asItem({ ...JSON.parse(JSON.stringify(data)), id: data._id ?? undefined }, this);
        list.push(made);
        rebuildIndex(this);
        return made;
      });
    }),
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      for (const id of ids) {
        const at = list.findIndex(item => item.id == id);
        if (at >= 0) {
          list.splice(at, 1);
        }
      }

      rebuildIndex(this);
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  if (x !== null) {
    const token = { actor, center: { x, y: 0 } };
    actor.getActiveTokens = () => [token];
    placeables.push(token);
  } else {
    actor.getActiveTokens = () => [];
  }

  actors.push(actor);
  rebuildIndex(actor);
  return actor;
}

function addItem(actor, data, rules = null) {
  const item = asItem(rules ? { ...data, system: { ...(data.system ?? {}), rules } } : data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

const tag =(tags, facts) => evaluate(tags, contextFor(facts));
const roster = list => Object.fromEntries(list.map((actor, i) => [`p${i}`, { uuid: actor.uuid }]));
const megaform = (members, combiner = false) => makeActor('megaform', 'Megazord', { subtype: [combiner ? 'megaformCombiner' : 'megaformZord'], actors: roster(members) });
const ranger = (name, zords = [], system = {}) => makeActor('playerCharacter', name, { actors: Object.fromEntries(zords.map((zord, i) => [`z${i}`, { type: 'zord', uuid: zord.uuid }])), ...system });
const crew = (vehicle, rows) => Object.assign(vehicle.system, { actors: Object.fromEntries(rows.map(([actor, role], i) => [`c${i}`, { uuid: actor.uuid, vehicleRole: role }])) });

beforeEach(() => {
  actors.length = 0;
  placeables.length = 0;
  items.clear();
  sceneEpoch = 1;
  formCalls.length = 0;
  game.combat = null;
  game.user.isGM = true;
  global.ui.notifications.warn.mockClear();
  global.foundry.applications.api.DialogV2.wait.mockReset();
  global.foundry.applications.api.DialogV2.prompt.mockReset();
  tally.mockReset();
  visiblePacks.length = 0;
});

/* -------------------------------------------- */
/*  Scopes                                       */
/* -------------------------------------------- */

describe('linked scopes', () => {
  test('megaform: a participant\'s rule reaches each Megaform it is in; stacks: false counts one book item once', () => {
    const a = makeActor('zord', 'A');
    const b = makeActor('zord', 'B');
    const rule = { type: 'RollModifier', scope: 'megaform', upshift: 1, stacks: false };
    addItem(a, { name: 'Trait', type: 'megaformTrait', _stats: { compendiumSource: 'Compendium.x.Item.t' } }, [rule]);
    addItem(b, { name: 'Trait', type: 'megaformTrait', _stats: { compendiumSource: 'Compendium.x.Item.t' } }, [rule]);
    const mega = megaform([a, b]);
    expect(linkedEntries(mega, 'RollModifier').map(entry => entry.holder.name)).toEqual(['A']);
    // stacks left on: one per holder.
    a.items.contents[0].system.rules = [{ ...rule, stacks: true }];
    b.items.contents[0].system.rules = [{ ...rule, stacks: true }];
    rebuildIndex(a);
    rebuildIndex(b);
    expect(linkedEntries(mega, 'RollModifier').map(entry => entry.holder.name)).toEqual(['A', 'B']);
    // Not on the participant itself, nor on anything that isn't a Megaform.
    expect(linkedEntries(a, 'RollModifier')).toEqual([]);
    expect(validateRule({ ...rule, scope: 'megaform' })).toEqual([]);
  });

  test('ownZord: a character\'s rule reaches the Zords listed on their sheet; zordOwner: a Zord\'s rule reaches its owners', () => {
    const zord = makeActor('zord', 'Zord');
    const other = makeActor('zord', 'Other');
    const pilot = ranger('Pilot', [zord]);
    addItem(pilot, { name: 'Perk', type: 'perk' }, [{ type: 'DerivedStat', scope: 'ownZord', path: 'system.health.max', op: 'add', value: 1 }]);
    expect(linkedEntries(zord, 'DerivedStat').map(entry => entry.holder.name)).toEqual(['Pilot']);
    expect(linkedEntries(other, 'DerivedStat')).toEqual([]);
    addItem(zord, { name: 'Feature', type: 'feature' }, [{ type: 'DerivedStat', scope: 'zordOwner', path: 'system.health.max', op: 'add', value: 1 }]);
    expect(linkedEntries(pilot, 'DerivedStat').map(entry => entry.holder.name)).toEqual(['Zord']);
  });

  test('the roll context carries the linked rule\'s holder (megaform:holderAttack)', () => {
    const gun = makeActor('zord', 'Gun');
    addItem(gun, { name: 'Cannon', type: 'weapon' });
    addItem(gun, { name: 'Accurate', type: 'megaformTrait' }, [{ type: 'RollModifier', scope: 'megaform', upshift: 1, when: ['megaform:holderAttack'] }]);
    const saber = makeActor('zord', 'Saber');
    addItem(saber, { name: 'Saber', type: 'weapon' });
    const mega = megaform([gun, saber]);
    addItem(mega, { id: 'cw', name: 'Cannon', type: 'weapon' });
    addItem(mega, { id: 'sw', name: 'Saber', type: 'weapon' });
    const cannon = addItem(mega, { name: 'Cannon', type: 'weaponEffect', flags: { essence20: { parentId: 'cw' } } });
    const slash = addItem(mega, { name: 'Saber', type: 'weaponEffect', flags: { essence20: { parentId: 'sw' } } });
    expect(ruleRollSources(mega, null, { item: cannon, isAttack: true }).sources).toHaveLength(1);
    expect(ruleRollSources(mega, null, { item: slash, isAttack: true }).sources).toHaveLength(0);
  });
});

/* -------------------------------------------- */
/*  Tags                                         */
/* -------------------------------------------- */

describe('tags', () => {
  test('megaform:in / is (of a kind), participantAttack, generated, item:attachedAttack, target:combinerForm, megaformTrait', () => {
    const zord = makeActor('zord', 'Zord');
    addItem(zord, { name: 'Blade', type: 'weapon' });
    addItem(zord, { name: 'Defender', type: 'megaformTrait', system: { type: 'defender' } });
    const bot = makeActor('playerCharacter', 'Bot');
    const mega = megaform([zord]);
    const form = megaform([bot], true);
    expect(tag(['megaform:in'], { self: zord })).toBe(true);
    expect(tag(['megaform:in:zord'], { self: zord })).toBe(true);
    expect(tag(['megaform:in:combiner'], { self: zord })).toBe(false);
    expect(tag(['megaform:in:combiner'], { self: bot })).toBe(true);
    expect(tag(['megaform:is:combiner'], { self: form })).toBe(true);
    expect(tag(['megaform:is:zord'], { self: form })).toBe(false);
    addItem(mega, { id: 'bw', name: 'Blade', type: 'weapon' });
    const blade = addItem(mega, { name: 'Blade', type: 'weaponEffect', flags: { essence20: { parentId: 'bw' } } });
    const built = addItem(mega, { name: 'Stomp', type: 'weaponEffect', flags: { essence20: { zord2Gen: 'x' } } });
    expect(tag(['megaform:participantAttack'], { self: mega, item: blade })).toBe(true);
    expect(tag(['megaform:participantAttack'], { self: mega, item: built })).toBe(false);
    expect(tag(['megaform:generated'], { self: mega, item: built })).toBe(true);
    expect(tag(['item:attachedAttack'], { self: mega, item: blade })).toBe(true);
    expect(tag(['item:attachedAttack'], { self: mega, item: built })).toBe(false);
    expect(tag(['target:combinerForm'], { self: zord, other: form })).toBe(true);
    expect(tag(['target:combinerForm'], { self: zord, other: mega })).toBe(false);
    expect(tag(['self:megaformTrait:defender'], { self: zord })).toBe(true);
    expect(tag(['target:megaformTrait:coreBody'], { self: bot, other: zord })).toBe(false);
  });

  test('Zord ownership: vehicle:ownZord, self:ownedByHolder, self:ownsZordOnCanvas, self:advancedRole', () => {
    const zord = makeActor('zord', 'Zord');
    const linked = makeActor('zord', 'Linked', {}, { x: 0 });
    const pilot = ranger('Pilot', [zord]);
    linked.flags.essence20.companionOf = pilot.uuid;
    crew(zord, [[pilot, 'driver']]);
    expect(tag(['vehicle:ownZord'], { self: pilot })).toBe(true);
    const stranger = makeActor('playerCharacter', 'Stranger');
    crew(linked, [[stranger, 'driver']]);
    expect(tag(['vehicle:ownZord'], { self: stranger })).toBe(false);
    const perk = addItem(pilot, { name: 'Perk', type: 'perk' });
    expect(tag(['self:ownedByHolder'], { self: zord, ruleItem: perk })).toBe(true);
    expect(tag(['self:ownedByHolder'], { self: linked, holder: pilot })).toBe(true);
    expect(tag(['self:ownedByHolder'], { self: linked, holder: stranger })).toBe(false);
    expect(tag(['self:ownsZordOnCanvas'], { self: pilot })).toBe(false);
    pilot.system.actors.z1 = { type: 'zord', uuid: linked.uuid };
    expect(tag(['self:ownsZordOnCanvas'], { self: pilot })).toBe(true);
    addItem(pilot, { name: 'Role', type: 'role', system: { isAdvanced: true } });
    expect(tag(['self:advancedRole'], { self: pilot })).toBe(true);
    expect(tag(['self:advancedRole'], { self: stranger })).toBe(false);
  });

  test('commanded this round, and companion:uncommanded[:type]', () => {
    const owner = makeActor('playerCharacter', 'Owner');
    const drone = makeActor('companion', 'Drone', { type: 'drone' }, { flags: { companionOf: owner.uuid } });
    game.combat = { id: 'c', round: 2 };
    expect(tag(['companion:uncommanded'], { self: owner })).toBe(true);
    expect(tag(['companion:uncommanded:drone'], { self: owner })).toBe(true);
    expect(tag(['companion:uncommanded:pet'], { self: owner })).toBe(false);
    drone.flags.essence20.petCommand = { combatId: 'c', round: 2 };
    expect(tag(['companion:uncommanded:drone'], { self: owner })).toBe(false);
    expect(tag(['self:commanded'], { self: drone })).toBe(true);
    expect(tag(['target:commanded'], { self: owner, other: drone })).toBe(true);
    expect(tag(['holder:commanded'], { self: owner, holder: drone })).toBe(true);
    game.combat = { id: 'c', round: 3 };
    expect(tag(['self:commanded'], { self: drone })).toBe(false);
  });

  test('item:heldBy:picked, target:userOwns, self:hasDriver, self:drivenByHolder, marks set by the holder / me', () => {
    const zord = makeActor('zord', 'Zord');
    addItem(zord, { name: 'Held', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.held' } });
    const pilot = ranger('Pilot', [zord]);
    const perk = addItem(pilot, { name: 'Perk', type: 'perk', flags: { essence20: { rules: { choices: { zord: zord.uuid } } } } });
    expect(tag(['item:heldBy:picked:zord'], { self: pilot, ruleItem: perk, item: { uuid: 'Compendium.x.Item.held' } })).toBe(true);
    expect(tag(['item:heldBy:picked:zord'], { self: pilot, ruleItem: perk, item: { uuid: 'Compendium.x.Item.new' } })).toBe(false);
    const enemy = makeActor('npc', 'Enemy');
    enemy.isOwner = false;
    expect(tag(['target:userOwns'], { self: pilot, other: enemy })).toBe(true);
    game.user.isGM = false;
    expect(tag(['target:userOwns'], { self: pilot, other: enemy })).toBe(false);
    expect(tag(['self:hasDriver'], { self: zord })).toBe(false);
    crew(zord, [[pilot, 'driver']]);
    expect(tag(['self:hasDriver'], { self: zord })).toBe(true);
    expect(tag(['self:drivenByHolder'], { self: zord, ruleItem: perk })).toBe(true);
    expect(tag(['self:drivenByHolder'], { self: zord, holder: enemy })).toBe(false);
    zord.flags.essence20.ruleMarks = { overdrive: { by: pilot.uuid } };
    expect(zordsExt.markedBy(zord, 'overdrive', pilot)).toBeTruthy();
    expect(tag(['self:markedByHolder:overdrive'], { self: zord, holder: pilot })).toBe(true);
    expect(tag(['self:markedByHolder:overdrive'], { self: zord, holder: enemy })).toBe(false);
    expect(tag(['vehicle:markedByMe:overdrive'], { self: pilot })).toBe(true);
  });

  test('self:specializedAtLeast:<skill>:<die>, movement:<type> / movement:has', () => {
    const pilot = makeActor('playerCharacter', 'Pilot', { skills: { driving: { specializations: { s: { shift: 'd6' } } } }, movement: { ground: { total: 30 }, aerial: { total: 0 } } });
    expect(tag(['self:specializedAtLeast:driving:d6'], { self: pilot })).toBe(true);
    expect(tag(['self:specializedAtLeast:driving:d4'], { self: pilot })).toBe(true);
    expect(tag(['self:specializedAtLeast:driving:d8'], { self: pilot })).toBe(false);
    expect(tag(['movement:ground'], { self: pilot, movementType: 'ground' })).toBe(true);
    expect(tag(['movement:aerial'], { self: pilot, movementType: 'ground' })).toBe(false);
    expect(tag(['movement:has'], { self: pilot, movementType: 'aerial' })).toBe(false);
    expect(tag(['movement:has'], { self: pilot, movementType: 'ground' })).toBe(true);
  });

  test('form:active / form:any, target:notBeyond, team:holds, scene:tokenWithin, self:clockActive', () => {
    const ranger1 = makeActor('playerCharacter', 'Red', { level: 3 }, { x: 0 });
    const perk = addItem(ranger1, { name: 'Form', type: 'perk', _stats: { compendiumSource: 'Compendium.x.Item.form' } });
    expect(tag(['form:any'], { self: ranger1 })).toBe(false);
    ranger1.flags.essence20.zord1Form = { uuid: 'Compendium.x.Item.form' };
    expect(tag(['form:active'], { self: ranger1, ruleItem: perk })).toBe(true);
    expect(tag(['form:any'], { self: ranger1 })).toBe(true);
    const near = makeActor('npc', 'Near', {}, { x: 20 });
    const far = makeActor('npc', 'Far', {}, { x: 60 });
    const off = makeActor('npc', 'Off');
    expect(tag(['target:notBeyond:30'], { self: ranger1, other: near })).toBe(true);
    expect(tag(['target:notBeyond:30'], { self: ranger1, other: far })).toBe(false);
    expect(tag(['target:notBeyond:30'], { self: ranger1, other: off })).toBe(true);
    const blue = makeActor('playerCharacter', 'Blue');
    addItem(blue, { name: 'Bend', type: 'perk', _stats: { compendiumSource: 'Compendium.x.Item.bend' } });
    expect(tag(['team:holds:Compendium.x.Item.bend'], { self: ranger1 })).toBe(true);
    expect(tag(['team:holds:Compendium.x.Item.bend'], { self: blue })).toBe(false);
    near.type = 'zord';
    expect(tag(['scene:tokenWithin:25:target:type:zord'], { self: ranger1 })).toBe(true);
    expect(tag(['scene:tokenWithin:10:target:type:zord'], { self: ranger1 })).toBe(false);
    expect(tag(['self:clockActive:massShift'], { self: ranger1 })).toBe(false);
    ranger1.flags.essence20.massShift = { epoch: 1, window: 'scene', count: 1 };
    expect(tag(['self:clockActive:massShift'], { self: ranger1 })).toBe(true);
    sceneEpoch = 2;
    expect(tag(['self:clockActive:massShift'], { self: ranger1 })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Recipients, pick sources, refs               */
/* -------------------------------------------- */

describe('recipients, pick sources and refs', () => {
  test('megaform, participants, ownZords, holder, driver, drivenVehicle, combinerTop', () => {
    const zord = makeActor('zord', 'Zord');
    const pilot = ranger('Pilot', [zord]);
    crew(zord, [[pilot, 'driver']]);
    const mega = megaform([zord]);
    const perk = addItem(pilot, { name: 'Perk', type: 'perk' });
    const names = (to, ctx) => recipients({ to }, { targets: [], ...ctx }).map(actor => actor.name);
    expect(names('megaform', { actor: zord })).toEqual(['Megazord']);
    expect(names('participants', { actor: mega })).toEqual(['Zord']);
    expect(names('ownZords', { actor: pilot })).toEqual(['Zord']);
    expect(names('holder', { actor: zord, item: perk })).toEqual(['Pilot']);
    expect(names('driver', { actor: zord })).toEqual(['Pilot']);
    expect(names('drivenVehicle', { actor: pilot })).toEqual(['Zord']);
    const a = makeActor('playerCharacter', 'A', { health: { value: 6 } });
    const b = makeActor('playerCharacter', 'B', { health: { value: 6 } });
    const c = makeActor('playerCharacter', 'C', { health: { value: 3 } });
    const form = megaform([a, b, c], true);
    expect(names('combinerTop', { actor: pilot, targets: [form] })).toEqual(['A', 'B']);
    expect(names('combinerTop', { actor: pilot, targets: [mega] })).toEqual([]);
  });

  test('pick from ownedZords, crew (filter asked as the target), remaining, noted', () => {
    const zord = makeActor('zord', 'Zord');
    const pilot = ranger('Pilot', [zord]);
    const gunner = makeActor('npc', 'Gunner');
    crew(zord, [[pilot, 'driver'], [gunner, 'gunner']]);
    expect(pickOptions({ from: 'ownedZords' }, { actor: pilot })).toEqual([{ value: zord.uuid, label: 'Zord' }]);
    expect(pickOptions({ from: 'crew' }, { actor: zord }).map(option => option.label)).toEqual(['Pilot', 'Gunner']);
    expect(pickOptions({ from: 'crew', filter: ['target:type:npc'] }, { actor: zord }).map(option => option.label)).toEqual(['Gunner']);
    const item = addItem(pilot, { name: 'Mesh', type: 'feature', flags: { essence20: { rules: { choices: { one: 'a' } } } } });
    expect(pickOptions({ from: 'remaining', options: ['a', ['b', 'Bee'], 'c'], exclude: ['one'] }, { actor: pilot, item })).toEqual([
      { value: 'b', label: 'Bee' }, { value: 'c', label: 'c' },
    ]);
    const trait = addItem(zord, { name: 'Trait T', type: 'megaformTrait' });
    item.flags.essence20.rules.choices.noted = [trait.uuid, 'Compendium.x.Item.gone'];
    expect(pickOptions({ from: 'noted', list: 'noted' }, { actor: pilot, item })).toEqual([
      { value: trait.uuid, label: 'Trait T' }, { value: 'Compendium.x.Item.gone', label: 'Compendium.x.Item.gone' },
    ]);
    item.flags.essence20.oldList = ['Compendium.x.Item.old'];
    expect(pickOptions({ from: 'noted', list: 'none', listLegacy: 'flags.essence20.oldList' }, { actor: pilot, item }).map(o => o.value)).toEqual(['Compendium.x.Item.old']);
  });

  test('@sourced.<id>.<path> reads a number off the actor\'s copy of that compendium item', () => {
    const pilot = makeActor('playerCharacter', 'Pilot');
    addItem(pilot, { name: 'Suite', type: 'perk', system: { advances: { currentValue: 3 } }, _stats: { compendiumSource: 'Compendium.essence20.x.Item.abcdefghijklmnop' } });
    expect(resolveValue('@sourced.abcdefghijklmnop.system.advances.currentValue + 1', { actor: pilot }, 0)).toBe(4);
    expect(resolveValue('@sourced.zzzzzzzzzzzzzzzz.system.advances.currentValue', { actor: pilot }, 0)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

describe('steps', () => {
  const run = async (actor, item, steps, extra = {}) => {
    const ctx = { ...stepContext({ actor, item, rule: { steps }, targets: extra.targets ?? [] }), ...extra };
    const finished = await runSteps(steps, ctx);
    return { finished, ctx };
  };

  test('shiftSize records the size before (once) and moves along the ladder; restoreSize puts it back (legacy too)', async () => {
    const zord = makeActor('zord', 'Zord', { size: 'huge' });
    const item = addItem(zord, { name: 'Enlarged', type: 'feature' });
    await run(zord, item, [{ do: 'shiftSize', steps: 1, ladder: 'class', record: 'before' }]);
    expect(zord.system.size).toBe('gigantic');
    await run(zord, item, [{ do: 'shiftSize', steps: 1, ladder: 'class', record: 'before' }]);
    expect(zord.system.size).toBe('towering');
    expect(item.flags.essence20.rules.choices.before).toBe('huge');
    await run(zord, item, [{ do: 'restoreSize', record: 'before' }]);
    expect(zord.system.size).toBe('huge');
    expect(item.flags.essence20.rules.choices.before).toBeUndefined();
    item.flags.essence20.oldSize = 'large';
    await run(zord, item, [{ do: 'restoreSize', record: 'before', legacy: 'flags.essence20.oldSize' }]);
    expect(zord.system.size).toBe('large');
    expect(stepErrors([{ do: 'shiftSize', steps: 1, ladder: 'x' }])).toHaveLength(1);
    expect(stepErrors([{ do: 'restoreSize' }])).toHaveLength(1);
  });

  test('askChoiceText keeps the typed text; empty or cancelled stops the run', async () => {
    const actor = makeActor('playerCharacter', 'Shifter');
    const item = addItem(actor, { name: 'Shape', type: 'perk' });
    const { finished, ctx } = await run(actor, item, [{ do: 'askChoiceText', key: 'shape' }, { do: 'chat', text: '{choice.shape}' }], { askText: async () => ' Wolf ' });
    expect(finished).toBe(true);
    expect(ctx.vars.shape).toBe('Wolf');
    expect(item.flags.essence20.rules.choices.shape).toBe('Wolf');
    foundry.applications.api.DialogV2.prompt.mockResolvedValue('');
    expect((await run(actor, item, [{ do: 'askChoiceText', key: 'shape' }])).finished).toBe(false);
    expect(stepErrors([{ do: 'askChoiceText' }])).toHaveLength(1);
  });

  test('spendFrom: each recipient pays from its own resource; stops when one can\'t', async () => {
    const zord = makeActor('zord', 'Zord');
    const pilot = makeActor('playerCharacter', 'Pilot', { powers: { personal: { value: 1, max: 3 } } });
    crew(zord, [[pilot, 'driver']]);
    const item = addItem(zord, { name: 'Feature', type: 'feature' });
    const spend = [{ do: 'spendFrom', to: 'driver', resource: { path: 'system.powers.personal.value' }, amount: 1 }, { do: 'chat', text: 'paid by {var.paidBy}' }];
    const first = await run(zord, item, spend);
    expect(first.finished).toBe(true);
    expect(pilot.system.powers.personal.value).toBe(0);
    expect(first.ctx.chat).toContain('paid by Pilot');
    const second = await run(zord, item, spend);
    expect(second.finished).toBe(false);
    expect(second.ctx.chat[0]).toContain('NotEnough');
    expect(stepErrors([{ do: 'spendFrom', to: 'driver' }])).toHaveLength(1);
  });

  test('megaformSync mirrors a participant\'s matching items onto its Megaforms', async () => {
    const zord = makeActor('zord', 'Zord');
    const master = addItem(zord, { name: 'Power Master', type: 'perk' }, [{ type: 'MegaformMirror', items: ['item:type:power'] }]);
    addItem(zord, { name: 'Blast', type: 'power' });
    addItem(zord, { name: 'Sword', type: 'weapon' });
    const mega = megaform([zord]);
    const { ctx } = await run(zord, master, [{ do: 'megaformSync' }]);
    expect(ctx.vars).toMatchObject({ megaforms: 'Megazord', megaformCount: 1 });
    // The power through the Mirror rule; the Zord's weapon because a Megazord may use any participant's attack (PR CRB p.140).
    expect(mega.items.contents.map(item => item.name)).toEqual(['Blast', 'Sword']);
    expect(mega.items.contents[0].flags.essence20.zord1MirrorOf).toBe(`${zord.uuid}|${zord.items.contents[1].id}`);
    // The participant's item goes: the mirror goes with it.
    zord.items.contents.splice(1, 1);
    await megaformExt.syncMirrors(mega);
    expect(mega.items.contents.map(item => item.name)).toEqual(['Sword']);
    expect(validateRule({ type: 'MegaformMirror', items: [] })).not.toEqual([]);
  });

  test('formStart / formEnd call the Form code; rollAs rolls for each recipient with its branch; transformInto', async () => {
    const actor = makeActor('playerCharacter', 'Red');
    const perk = addItem(actor, { name: 'Turbo', type: 'perk', _stats: { compendiumSource: 'Compendium.x.Item.turbo' } });
    expect((await run(actor, perk, [{ do: 'formStart' }])).finished).toBe(true);
    const refused = addItem(actor, { name: 'No', type: 'perk', _stats: { compendiumSource: 'Compendium.x.Item.refused' } });
    expect((await run(actor, refused, [{ do: 'formStart' }])).finished).toBe(false);
    await run(actor, perk, [{ do: 'formEnd' }]);
    expect(formCalls).toEqual([['start', 'Red', 'Compendium.x.Item.turbo'], ['start', 'Red', 'Compendium.x.Item.refused'], ['end', 'Red']]);
    const foe = makeActor('npc', 'Foe');
    foe._dice = { rollSkill: jest.fn(async options => ({ success: Number(options.dif) <= 10, outcomes: [] })) };
    const rolled = await run(actor, perk, [{ do: 'rollAs', skill: 'athletics', dif: 10, snag: true, onSuccess: [{ do: 'chat', text: '{target} made it' }], onFail: [{ do: 'chat', text: 'no' }] }], { targets: [foe] });
    expect(foe._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'athletics', dif: '10', snag: true }), foe);
    expect(rolled.ctx.chat).toEqual(['Foe made it']);
    expect(stepErrors([{ do: 'rollAs' }])).toHaveLength(1);
    const bot = makeActor('playerCharacter', 'Bot');
    bot.transform = jest.fn(async () => {});
    const mode = addItem(bot, { name: 'Truck', type: 'altMode' });
    const roll = addItem(bot, { name: 'Roll Out', type: 'perk', flags: { essence20: { rules: { choices: { mode: mode.id } } } } });
    const { ctx } = await run(bot, roll, [{ do: 'transformInto', item: 'choice:mode' }]);
    expect(bot.transform).toHaveBeenCalledWith(mode.uuid);
    expect(ctx.vars.mode).toBe('Truck');
    expect(stepErrors([{ do: 'transformInto' }])).toHaveLength(1);
  });

  test('noteEntries: up to count different entries, not those another copy noted; the first stop keeps the old list', async () => {
    const zord = makeActor('zord', 'Zord');
    const other = addItem(zord, { name: 'Multi', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.multi' }, flags: { essence20: { rules: { choices: { traits: ['Compendium.x.Item.a'] } } } } });
    const item = addItem(zord, { name: 'Multi', type: 'feature', _stats: { compendiumSource: 'Compendium.x.Item.multi' } });
    const rows = ['a', 'b', 'c'].map(k => ({ uuid: `Compendium.x.Item.${k}`, name: k }));
    const offered = [];
    const grantHelpers = {
      findItems: jest.fn(async () => rows),
      pickOne: jest.fn(async (title, list) => {
        offered.push([title, list.map(row => row.name)]);
        return list[0]?.uuid ?? null;
      }),
    };
    const step = { do: 'noteEntries', key: 'traits', count: 3, from: { type: 'megaformTrait' }, title: 'Trait {n}' };
    const { finished, ctx } = await run(zord, item, [step], { grantHelpers });
    expect(finished).toBe(true);
    expect(grantHelpers.findItems).toHaveBeenCalledWith({ type: 'megaformTrait' });
    expect(offered).toEqual([['Trait 1', ['b', 'c']], ['Trait 2', ['c']], ['Trait 3', []]]);
    expect(item.flags.essence20.rules.choices.traits).toEqual(['Compendium.x.Item.b', 'Compendium.x.Item.c']);
    expect(ctx.vars.noted).toBe(2);
    expect(megaformExt.notedOnOtherCopies(item, 'traits')).toEqual(['Compendium.x.Item.a']);
    expect(megaformExt.notedOn(other, 'traits')).toEqual(['Compendium.x.Item.a']);
    grantHelpers.pickOne.mockResolvedValue(null);
    expect((await run(zord, item, [step], { grantHelpers })).finished).toBe(false);
    expect(item.flags.essence20.rules.choices.traits).toHaveLength(2);
    expect(stepErrors([{ do: 'noteEntries', key: 'k' }])).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  Rule types                                   */
/* -------------------------------------------- */

describe('rule types', () => {
  test('Size: steps on a ladder (clamped, never back across a limit), then set, then atLeast / atMost', () => {
    expect(sizeExt.stepSize('huge', 1)).toBe('extended');
    expect(sizeExt.stepSize('huge', 1, { ladder: 'class' })).toBe('gigantic');
    expect(sizeExt.stepSize('extended', 1, { ladder: 'class' })).toBe('gigantic');
    expect(sizeExt.stepSize('small', -1, { ladder: 'class' })).toBe('small');
    expect(sizeExt.stepSize('huge', 3, { max: 'gigantic' })).toBe('gigantic');
    expect(sizeExt.stepSize('titanic', 1, { max: 'gigantic' })).toBe('titanic');
    expect(sizeExt.stepSize('titanic', -1, { min: 'towering' })).toBe('extended3');
    const zord = makeActor('zord', 'Zord', { size: 'large' });
    addItem(zord, { name: 'Up', type: 'feature' }, [{ type: 'Size', steps: 2, ladder: 'class' }]);
    sizeExt.sizeDerived(zord);
    expect(zord.system.size).toBe('gigantic');
    zord.system.size = 'large';
    addItem(zord, { name: 'Cap', type: 'feature' }, [{ type: 'Size', atMost: 'huge' }]);
    sizeExt.sizeDerived(zord);
    expect(zord.system.size).toBe('huge');
    zord.system.size = 'large';
    addItem(zord, { name: 'Set', type: 'feature' }, [{ type: 'Size', set: 'small', atLeast: 'common' }]);
    sizeExt.sizeDerived(zord);
    expect(zord.system.size).toBe('common');
    expect(validateRule({ type: 'Size' })).not.toEqual([]);
    expect(validateRule({ type: 'Size', set: 'enormous' })).not.toEqual([]);
  });

  test('ArmorAccommodation refuses armor without the upgrade the level needs (Restricted covers Limited)', () => {
    const actor = makeActor('playerCharacter', 'Big');
    addItem(actor, { name: 'Enlarged', type: 'perk' }, [{ type: 'ArmorAccommodation', level: 'limited' }]);
    const armor = addItem(actor, { name: 'Battledress', type: 'armor' });
    expect(sizeExt.checkAccommodation(armor, { system: { equipped: true } })).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining('NeedsAccommodation'));
    expect(sizeExt.checkAccommodation(armor, { system: { equipped: false } })).toBe(true);
    addItem(actor, { name: 'Alteration Accommodation (Restricted)', type: 'upgrade', flags: { essence20: { parentId: armor.id } } });
    expect(sizeExt.checkAccommodation(armor, { system: { equipped: true } })).toBe(true);
    actor.items.contents[0].system.rules = [{ type: 'ArmorAccommodation', level: 'restricted' }];
    rebuildIndex(actor);
    actor.items.contents.pop();
    addItem(actor, { name: 'Alteration Accommodation (Limited)', type: 'upgrade', flags: { essence20: { parentId: armor.id } } });
    expect(sizeExt.checkAccommodation(armor, { system: { equipped: true } })).toBe(false);
    expect(hooks.preUpdateItem.length).toBeGreaterThan(0);
  });

  test('SizeMatrixCancel: a smaller attacker loses the matrix upshift against the driver\'s vehicle', () => {
    const truck = makeActor('vehicle', 'Truck', { size: 'gigantic' });
    const driver = makeActor('playerCharacter', 'Driver');
    addItem(driver, { name: 'Rigger', type: 'perk' }, [{ type: 'SizeMatrixCancel', when: ['defense:toughness'] }]);
    crew(truck, [[driver, 'driver']]);
    const small = makeActor('npc', 'Small', { size: 'common' });
    expect(sizeExt.sizeShift(small, truck)).toBe(2);
    expect(sizeExt.sizeMatrixCancel(small, truck, 'toughness')).toEqual({ label: 'Rigger', shift: 2 });
    expect(sizeExt.sizeMatrixCancel(small, truck, 'evasion')).toBeNull();
    const huge = makeActor('npc', 'Titan', { size: 'titanic' });
    expect(sizeExt.sizeMatrixCancel(huge, truck, 'toughness')).toBeNull();
  });

  test('MegaformHealth: the holder\'s row and the combined Health of each Megaform it is in', () => {
    const bot = makeActor('playerCharacter', 'Drummer');
    addItem(bot, { name: 'Drum', type: 'feature' }, [{ type: 'MegaformHealth', scope: 'megaform', amount: 2 }]);
    const form = megaform([bot], true);
    // Megaform-only extra Health for the holder (mechanics/vehicles/megaform-bonus-health.mjs builds the rows from it).
    megaformExt.megaformHealthDerived(form);
    expect(bonusOf(form, bot)).toBe(2);
    megaformExt.megaformHealthDerived(bot);
    expect(bot.system.health.max).toBe(10);
  });

  test('SummonLimit: one of the owner\'s Zords per scene', async () => {
    const one = makeActor('zord', 'One');
    const two = makeActor('zord', 'Two');
    const owner = ranger('Owner', [one, two]);
    addItem(owner, { name: 'Limit', type: 'feature' }, [{ type: 'SummonLimit' }]);
    const summon = { flags: { essence20: { zordSummonReadyRound: 2 } } };
    expect(zordsExt.checkSummonLimit(one, summon, 1)).toBe(true);
    await flush();
    expect(owner.flags.essence20.zord1ActiveZord).toEqual({ epoch: 1, uuid: one.uuid });
    expect(zordsExt.checkSummonLimit(two, summon, 1)).toBe(false);
    expect(zordsExt.checkSummonLimit(one, summon, 1)).toBe(true);
    expect(zordsExt.checkSummonLimit(two, summon, 2)).toBe(true);
    expect(zordsExt.checkSummonLimit(two, { name: 'x' }, 2)).toBe(true);
    expect(zordsExt.zordOwners(two).map(actor => actor.name)).toEqual(['Owner']);
  });

  test('JoinTime (ownZord), SummonTime (halve / subtract, summoner then Zord), AutoDisembark (driver / pilots)', () => {
    const zord = makeActor('zord', 'Zord');
    const pilot = ranger('Pilot', [zord]);
    expect(hooksExt.ruleJoinTime(zord, 5)).toBe(5);
    addItem(pilot, { name: 'Expeditor', type: 'perk' }, [{ type: 'JoinTime', scope: 'ownZord', amount: '1d4' }]);
    expect(hooksExt.ruleJoinTime(zord, 5, () => 0.99)).toBe(1);
    expect(hooksExt.ruleJoinTime(zord, 5, () => 0)).toBe(4);
    addItem(pilot, { name: 'Small', type: 'perk' }, [{ type: 'SummonTime', mode: 'halve' }]);
    addItem(zord, { name: 'Gem', type: 'feature' }, [{ type: 'SummonTime', mode: 'subtract', amount: 2 }]);
    expect(hooksExt.ruleSummonRounds(pilot, zord, 5)).toBe(1);
    expect(hooksExt.ruleSummonRounds(pilot, zord, 9)).toBe(3);
    expect(hooksExt.ruleSummonRounds(null, zord, 9)).toBe(7);
    expect(validateRule({ type: 'SummonTime', mode: 'subtract' })).not.toEqual([]);
    const truck = makeActor('vehicle', 'Truck');
    const gunner = makeActor('playerCharacter', 'Gunner');
    addItem(gunner, { name: 'Peerless', type: 'perk' }, [{ type: 'AutoDisembark', who: 'pilots' }]);
    const driver = makeActor('playerCharacter', 'Driver');
    addItem(driver, { name: 'Peerless', type: 'perk' }, [{ type: 'AutoDisembark' }]);
    crew(truck, [[gunner, 'gunner']]);
    expect(hooksExt.ruleAutoDisembark(gunner, { vehicleRole: 'gunner' }, truck)).toBe(true);
    expect(hooksExt.ruleAutoDisembark(driver, { vehicleRole: 'gunner' }, truck)).toBe(false);
    crew(truck, [[gunner, 'gunner'], [driver, 'driver']]);
    expect(hooksExt.ruleAutoDisembark(gunner, { vehicleRole: 'gunner' }, truck)).toBe(false);
    expect(hooksExt.ruleAutoDisembark(driver, { vehicleRole: 'driver' }, truck)).toBe(true);
  });

  test('KnownOptions: the noted options, topped up by asking (legacy list first); no rule, no limit', async () => {
    const actor = makeActor('playerCharacter', 'Pony', {}, { flags: { oldKnown: ['anger'] } });
    expect(await hooksExt.ensureKnownOptions(actor, 'mastery')).toBeNull();
    const item = addItem(actor, { name: 'Range', type: 'perk' }, [{ type: 'KnownOptions', key: 'mastery', count: 2, options: ['anger', 'joy', 'fear'], labels: 'E20.{Option}', prompt: 'Option {n} of {count}', legacy: 'oldKnown' }]);
    const choose = jest.fn(async (title, prompt, options) => {
      expect(prompt).toBe('Option 2 of 2');
      expect(options).toEqual([{ value: 'joy', label: 'E20.Joy' }, { value: 'fear', label: 'E20.Fear' }]);
      return 'fear';
    });
    expect(await hooksExt.ensureKnownOptions(actor, 'mastery', { choose })).toEqual(['anger', 'fear']);
    expect(item.flags.essence20.rules.choices['known-mastery']).toEqual(['anger', 'fear']);
    choose.mockClear();
    expect(await hooksExt.ensureKnownOptions(actor, 'mastery', { choose })).toEqual(['anger', 'fear']);
    expect(choose).not.toHaveBeenCalled();
  });

  test('Form: the spec forms.mjs reads (cost, swaps by their when, grants, element) and the held Forms', () => {
    const actor = makeActor('playerCharacter', 'Red');
    addItem(actor, { name: 'Role', type: 'role', system: { isAdvanced: false } });
    addItem(actor, { name: 'Operator', type: 'perk', _stats: { compendiumSource: 'Compendium.x.Item.op' } }, [{
      type: 'Form', cost: 1, grants: ['Compendium.x.Item.g'], element: true,
      swaps: [{ replaces: 'blaster', uuids: ['Compendium.x.Item.core'], when: ['not:self:advancedRole'] }, { replaces: 'both', pick: ['Compendium.x.Item.adv'], when: ['self:advancedRole'] }],
    }]);
    expect(formsExt.ruleFormUuids(actor)).toEqual(['Compendium.x.Item.op']);
    expect(formsExt.ruleFormSpec(actor, 'Compendium.x.Item.op')).toEqual({
      key: 'Compendium.x.Item.op', cost: 1, swaps: [{ replaces: 'blaster', uuids: ['Compendium.x.Item.core'] }], grants: ['Compendium.x.Item.g'], element: true,
    });
    actor.items.contents[0].system.isAdvanced = true;
    expect(formsExt.ruleFormSpec(actor, 'Compendium.x.Item.op').swaps).toEqual([{ replaces: 'both', pick: ['Compendium.x.Item.adv'] }]);
    expect(formsExt.ruleFormSpec(actor, 'Compendium.x.Item.none')).toBeNull();
    expect(validateRule({ type: 'Form', swaps: [{ replaces: 'feet', uuids: [] }] })).not.toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Events and the Movement stage                */
/* -------------------------------------------- */

describe('events and the derivedHook Movement stage', () => {
  test('beforeRoll fires before a roll, with the rolled item and the dataset', async () => {
    const actor = makeActor('npc', 'Finster', { health: { value: 3, max: 5 } });
    const power = addItem(actor, { name: 'Aura', type: 'power' }, [{ type: 'Trigger', event: 'beforeRoll', when: ['item:own', 'roll:dataset:rollType=power'], steps: [{ do: 'loseHealth', amount: 1 }] }]);
    await runPreRoll(actor, { rollType: 'power' }, power);
    expect(actor.system.health.value).toBe(2);
    await runPreRoll(actor, { rollType: 'skill' }, power);
    await runPreRoll(actor, { rollType: 'power' }, addItem(actor, { name: 'Other', type: 'power' }));
    expect(actor.system.health.value).toBe(2);
  });

  test('groupTestResult fires on each participant once the card has every result', async () => {
    const a = makeActor('playerCharacter', 'A');
    const b = makeActor('playerCharacter', 'B');
    for (const actor of [a, b]) {
      addItem(actor, { name: 'Strength', type: 'perk' }, [{ type: 'Trigger', event: 'groupTestResult', when: ['var:success>0'], steps: [{ do: 'mark', key: 'won' }] }]);
    }

    const message = { flags: { essence20: { groupTest: { participants: [a.uuid, b.uuid] } } } };
    tally.mockReturnValue({ done: false });
    await hooksExt.onGroupTestCard(message);
    expect(a.flags.essence20.ruleMarks).toBeUndefined();
    tally.mockReturnValue({ done: true, success: true, successes: 2, rows: [{}, {}] });
    await hooksExt.onGroupTestCard(message);
    expect(Object.keys(a.flags.essence20.ruleMarks)).toEqual(['won']);
    expect(Object.keys(b.flags.essence20.ruleMarks)).toEqual(['won']);
  });

  test('megaformCombined fires on the Megaform when its roster changes; participants\' rules reach it', async () => {
    const zord = makeActor('zord', 'War');
    addItem(zord, { name: 'Warzord', type: 'feature' }, [{ type: 'Trigger', scope: 'megaform', event: 'megaformCombined', steps: [{ do: 'chat', text: '{var.zords} of {var.participants}' }] }]);
    const bot = makeActor('playerCharacter', 'Bot');
    const mega = megaform([zord, bot]);
    ChatMessage.create.mockClear();
    await megaformExt.onRosterChanged(mega);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('1 of 2') }));
  });

  test('derivedHook: Movement rules of that stage run where the slice calls them', () => {
    const actor = makeActor('playerCharacter', 'Red', { movement: { ground: { total: 30 }, aerial: { total: 0 } } });
    addItem(actor, { name: 'Bend', type: 'perk' }, [{ type: 'Movement', movement: 'all', stage: 'derivedHook', op: 'multiply', value: 2, when: ['movement:has'] }]);
    expect(validateRule(actor.items.contents[0].system.rules[0])).toEqual([]);
    hooksExt.applyDerivedHookMovement(actor);
    expect(actor.system.movement).toEqual({ ground: { total: 60 }, aerial: { total: 0 } });
  });
});

/* -------------------------------------------- */
/*  pickPerkFrom pack filter                     */
/* -------------------------------------------- */

test('pickPerk / pickPerkFrom: `pack` keeps to one compendium\'s Roles', async () => {
  const perk = (level, pack) => ({ type: 'perk', subtype: 'role', level, name: `Perk ${level}`, uuid: `Compendium.essence20.${pack}.Item.p${level}` });
  const index = (pack, name) => ({ getIndex: async () => new Map([[name, { type: 'role', name, uuid: `Compendium.essence20.${pack}.Item.${name}`, system: { items: { a: perk(1, pack) } } }]]) });
  visiblePacks.push(index('pr_crb', 'Red'), index('other_pack', 'Blue'));
  const actor = makeActor('playerCharacter', 'Envoy');
  const grantor = addItem(actor, { name: 'Gift', type: 'perk' });
  let content = '';
  foundry.applications.api.DialogV2.wait.mockImplementation(async options => {
    content = options.content;
    return null;
  });
  await pickPerkFrom(actor, grantor, { from: 'role', pack: 'pr_crb' });
  expect(content).toContain('Red: Perk 1');
  expect(content).not.toContain('Blue');
  await pickPerkFrom(actor, grantor, { from: 'role' });
  expect(content).toContain('Blue: Perk 1');
});

test('the plug-in rule types validate and register their scopes', () => {
  for (const rule of [
    { type: 'MegaformHealth', scope: 'megaform', amount: 1 }, { type: 'JoinTime', scope: 'ownZord', amount: 1 },
    { type: 'ArmorAccommodation', level: 'restricted' }, { type: 'SizeMatrixCancel' }, { type: 'SummonLimit' },
    { type: 'AutoDisembark', who: 'driver' }, { type: 'Trigger', scope: 'megaform', event: 'megaformCombined', steps: [] },
    { type: 'Trigger', event: 'beforeRoll', steps: [] }, { type: 'Trigger', event: 'groupTestResult', steps: [] },
    { type: 'DerivedStat', scope: 'zordOwner', path: 'system.health.max', op: 'add', value: 1 },
  ]) {
    expect([rule.type, validateRule(rule)]).toEqual([rule.type, []]);
  }

  expect(validateRule({ type: 'ArmorAccommodation', level: 'loose' })).not.toEqual([]);
  expect(linksExt.topComponents(null)).toEqual([]);
  expect(typeof fireTriggers).toBe('function');
  expect(typeof runUse).toBe('function');
});
