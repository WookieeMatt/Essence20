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

  ext = await import('../../mechanics/item-hooks.mjs');
  common = await import('../shared/turn-stamps.mjs');
  formState = await import('../forms/ranger-form-state.mjs');
  forms = await import('../forms/ranger-form-perks.mjs');
  slots = await import('../zords/megafauna.mjs');
  await import('../index.mjs');
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

  // Bug fix 2026-10-06: the Grid Powers' Uses paid and set a flag nothing read - they now run the Form's own activation.
  test('Dino Thunder Boost / Extra activate the real Form powers (zord1Dino state), paying once from the Boost pool', async () => {
    const grid = await import('../forms/dino-thunder-grid-powers.mjs');
    const actor = makeActor({
      system: { powers: { personal: { value: 2 } }, defenses: { toughness: { total: 12 } } },
      items: [
        { id: 'f', name: 'Dino Thunder', flags: { core: { sourceId: grid.DINO.form }, essence20: { zord1DinoPower: 'triceraSkin' } } },
        { id: 'x', name: 'Extra', flags: { core: { sourceId: grid.DINO.extra }, essence20: { zord1DinoPower: 'intangibility' } } },
        { id: 'b', name: 'Boost', flags: { core: { sourceId: grid.DINO.boost }, essence20: {} } },
      ],
    });
    actor.setFlag = jest.fn(async function (scope, key, value) {
      global.foundry.utils.setProperty(this.flags, `${scope}.${key}`, value);
    });
    actor.update = jest.fn(async function (changes) {
      this.system.powers.personal.value = changes['system.powers.personal.value'];
    });
    const uses = ext.registrySnapshot().uses;
    const boostUse = uses.find(use => use.id == 'd1DinoThunderBoost');
    const extraUse = uses.find(use => use.id == 'd1DinoThunderExtra');
    const [form, extra, boost] = actor.items.contents;
    expect(boostUse.matches(boost)).toBe(true);
    expect(extraUse.matches(extra)).toBe(true);

    const pay = jest.fn(async () => true);
    expect(await boostUse.run(boost, null, pay)).toContain('D1DinoActivated');
    expect(Object.keys(actor.flags.essence20.zord1Dino)).toEqual(['triceraSkin', 'intangibility']);
    expect(grid.boostPool(actor)).toBe(2);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(actor.flags.essence20.d1DinoThunderActive).toBeUndefined();
    forms.formDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(17);
    expect(forms.dinoDamageModifier(actor, 4)).toBe(0);
    expect(global.Hooks.callAll).not.toHaveBeenCalledWith('essence20.dinoThunderActivated', expect.anything(), expect.anything(), expect.anything());

    // With the pool empty the one Personal Power pays for both.
    actor.flags.essence20.zord1Dino = {};
    boost.flags.essence20.d1BoostPool = 0;
    await extraUse.run(extra, null, pay);
    expect(Object.keys(actor.flags.essence20.zord1Dino)).toEqual(['triceraSkin', 'intangibility']);
    expect(actor.system.powers.personal.value).toBe(1);
    expect(form.flags.essence20.zord1DinoPower).toBe('triceraSkin');
  });
});

describe('Zord slots', () => {
  // Megafauna's toggle, its Smarts / Social 3 and the pilot's Animal Handling are the Feature's own rules
  // (module/rules/conv17-split2.test.js); arriving in form on summon stays here.
  test('Megafauna: a summoned Zord arrives in Megafauna Form', () => {
    const zord = makeActor({ type: 'zord', uuid: 'Actor.z', items: [{ type: 'feature', name: 'Megafauna', flags: src(slots.ZS.megafauna) }] });
    const changes = { flags: { essence20: { zordSummonReadyRound: 3 } } };
    slots.megafaunaOnSummon(zord, changes);
    expect(changes.flags.essence20.zord1Megafauna).toBe(true);
    const plain = { flags: { essence20: {} } };
    slots.megafaunaOnSummon(zord, plain);
    expect(plain.flags.essence20.zord1Megafauna).toBeUndefined();
  });
});
