import { jest } from '@jest/globals';

// Minimal Foundry stand-ins, installed before the modules load.
const worldList = [];
function makeItem(data) {
  const item = {
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    name: data.name ?? 'Item',
    type: data.type ?? 'perk',
    system: data.system ?? {},
    flags: data.flags ?? {},
    effects: [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    update: jest.fn(async () => {}),
  };
  return item;
}

function makeActor(data = {}) {
  const items = (data.items ?? []).map(makeItem);
  const actor = {
    uuid: data.uuid ?? `Actor.${Math.random().toString(36).slice(2, 10)}`,
    id: data.id ?? 'a',
    name: data.name ?? 'Actor',
    type: data.type ?? 'playerCharacter',
    system: data.system ?? {},
    flags: data.flags ?? {},
    statuses: new Set(),
    isOwner: true,
    items: { contents: items, get: id => items.find(i => i.id == id) },
    prototypeToken: { disposition: data.disposition ?? 1 },
    getActiveTokens: () => [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope]?.[key];
    }),
    update: jest.fn(async () => {}),
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
  };
  items.forEach(item => {
    item.parent = actor;
  });
  return actor;
}

const src = uuid => ({ core: { sourceId: uuid } });

let forms;
let formState;
let slots;
let common;
let ext;

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', targets: new Set() },
    actors: { contents: worldList, get: id => worldList.find(a => a.id == id), [Symbol.iterator]: () => worldList[Symbol.iterator]() },
    settings: { get: () => ({}) },
    combat: null,
    scenes: {},
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { E20: { damageTypes: {}, skills: {}, skillToEssence: { animalHandling: 'social' } }, statusEffects: [{ id: 'frightened' }, { id: 'prone' }] };
  global.foundry = { utils: { randomID: () => 'r', setProperty: (obj, path, value) => {
    const keys = path.split('.');
    let cur = obj;
    keys.slice(0, -1).forEach(k => {
      cur[k] ??= {};
      cur = cur[k];
    });
    cur[keys.at(-1)] = value;
  } }, applications: { api: {} } };
  global.fromUuidSync = uuid => worldList.find(a => a.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = null;

  ext = await import('../../extensions.mjs');
  common = await import('./common.mjs');
  formState = await import('./form-state.mjs');
  forms = await import('./forms.mjs');
  slots = await import('./zord-slots.mjs');
  await import('./zord1.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.user.targets = new Set();
});

describe('registration', () => {
  test('uses and hooks register', () => {
    const uses = ext.registrySnapshot().uses.map(u => u.id);
    expect(uses).toEqual(expect.arrayContaining(['zord1DinoThunder']));
    // Every Form's start / end is its own Use rules (Solar Power: module/rules/conv12-slH12.test.js).
    expect(uses).not.toContain('zord1Form');
    // Rex Feature, Additional Zord, Ship Integration and Multi-Megaform are rule Uses (module/rules/conv10-slA10.test.js).
    expect(uses).not.toContain('zord1Multi');
    expect(uses).not.toContain('zord1RexFeature');
    expect(uses).not.toContain('zord1Limbs');
    expect(global.Hooks.on).toHaveBeenCalledWith('updateActor', expect.any(Function));
  });
});

describe('common', () => {
  test('stamps expire by round/turn and scene', () => {
    expect(common.isStampLive({ sceneEpoch: 3 }, 3)).toBe(true);
    expect(common.isStampLive({ sceneEpoch: 3 }, 4)).toBe(false);
    global.game.combat = { id: 'c', round: 2, turn: 1, turns: [{ actor: { id: 'x' } }, { actor: { id: 'a' } }] };
    const stamp = common.untilNextTurnStamp({ id: 'a' });
    expect(stamp).toMatchObject({ combatId: 'c', untilRound: 3, untilTurn: 0 });
    expect(common.isStampLive(stamp)).toBe(true);
    global.game.combat.round = 3;
    global.game.combat.turn = 1;
    expect(common.isStampLive(stamp)).toBe(false);
    global.game.combat = null;
  });
});

describe('Forms', () => {
  test('a Form only counts while Morphed and chosen', () => {
    const ninja = 'Compendium.essence20.beneath_the_helmet.Item.Txv1ODlLKY91hPrA';
    const actor = makeActor({ system: { isMorphed: true }, flags: { essence20: { zord1Form: { uuid: ninja } } } });
    expect(formState.isFormActive(actor, ninja)).toBe(true);
    expect(formState.isFormActive(actor, 'Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1')).toBe(false);
    actor.system.isMorphed = false;
    expect(formState.isFormActive(actor, ninja)).toBe(false);
  });

  // Every Form's spec, Uses and roll rows are its item's rules (module/rules/conv10-slA10.test.js; Solar Power's spec and
  // Uses and Ninja Storm's mind-control Snag: module/rules/conv12-slH12.test.js).
  test('no Form spec without a Form rule', () => {
    const core = makeActor({ items: [{ type: 'role', system: { isAdvanced: false } }] });
    expect(forms.formSpec(core, 'Compendium.essence20.across_the_stars.Item.4ksM4tGqdjuyPSj1')).toBe(null);
    expect(forms.heldForms(core)).toEqual([]);
  });

  test('Dino Thunder: Tricera Skin and Shield Projection', () => {
    const actor = makeActor({
      system: { defenses: { toughness: { total: 12 } } },
      flags: { essence20: { zord1Dino: { triceraSkin: { sceneEpoch: null }, shieldProjection: {} } } },
    });
    forms.formDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(17);
    expect(forms.dinoDefenseAdjust(null, actor, 'evasion')).toBe(5);
    expect(forms.dinoDefenseAdjust(null, actor, 'willpower')).toBe(0);
  });

  test('Dino Thunder: Intangibility stops damage', () => {
    const actor = makeActor({ flags: { essence20: { zord1Dino: { intangibility: {} } } } });
    expect(forms.dinoDamageModifier(actor, 4)).toBe(0);
    expect(forms.dinoDamageModifier(makeActor(), 4)).toBe(4);
  });
});

describe('Zord slots', () => {
  test('Megafauna: essences and Animal Handling driving', () => {
    const zord = makeActor({
      type: 'zord', uuid: 'Actor.z',
      items: [{ type: 'feature', name: 'Megafauna', flags: src(slots.ZS.megafauna) }],
      flags: { essence20: { zord1Megafauna: true } },
      system: { essences: { smarts: { value: null }, social: { value: null } }, defenses: { evasion: { total: 10 } }, actors: { d: { vehicleRole: 'driver', uuid: 'Actor.pilot' } } },
    });
    const pilot = makeActor({ uuid: 'Actor.pilot' });
    worldList.push(zord, pilot);
    slots.zordDerived(zord);
    expect(zord.system.essences.smarts.value).toBe(3);
    expect(zord.system.defenses.evasion.total).toBe(10);
    const dataset = { skill: 'driving' };
    slots.megafaunaPreRoll(pilot, dataset);
    expect(dataset.skill).toBe('animalHandling');
  });
});
