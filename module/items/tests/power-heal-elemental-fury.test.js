import { jest } from '@jest/globals';

const worldList = [];
let nextRoll = 1;

function makeItem(data) {
  return {
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    name: data.name ?? 'Item',
    type: data.type ?? 'perk',
    system: data.system ?? {},
    flags: data.flags ?? {},
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
  };
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
    statuses: new Set(data.statuses ?? []),
    isOwner: true,
    items: { contents: items, get: id => items.find(i => i.id == id) },
    getActiveTokens: () => [],
    prototypeToken: { disposition: 1 },
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    update: jest.fn(async function (changes) {
      if ('system.powers.personal.value' in changes) {
        this.system.powers.personal.value = changes['system.powers.personal.value'];
      }
    }),
    createEmbeddedDocuments: jest.fn(async (type, docs) => docs.map(d => makeItem({ ...d, id: `new${items.length}` }))),
    deleteEmbeddedDocuments: jest.fn(async () => []),
    toggleStatusEffect: jest.fn(async () => {}),
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
let ext;
let common;
let crb;
let ttsg;

const sourcesFor = (actor, target, ctx) => ext.extRollSources(actor, target, ctx).sources;
const useFor = item => ext.findExtUse(item);

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', isGM: true, targets: new Set() },
    actors: { contents: worldList },
    users: { activeGM: null },
    settings: { get: () => 1 },
    combat: null,
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = {
    E20: { actorSizes: { small: 's', common: 'c', large: 'l', huge: 'h', gigantic: 'g', towering: 't' }, skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] },
    statusEffects: [{ id: 'prone', name: 'Prone' }],
  };
  global.foundry = { utils: { deepClone: v => JSON.parse(JSON.stringify(v ?? null)) }, applications: { api: {} } };
  global.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }

    async evaluate() {
      this.total = nextRoll;
      return this;
    }
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.Actor = class {};
  global.fromUuid = async uuid => worldList.find(a => a.uuid == uuid) ?? null;
  global.fromUuidSync = uuid => worldList.find(a => a.uuid == uuid) ?? null;

  ext = await import('../../mechanics/item-hooks.mjs');
  common = await import('../shared/pr-crb-ttsg-item-ids.mjs');
  crb = {
    ...(await import('../movement/ninja-power-jump.mjs')),
    ...(await import('../healing/power-heal-condition.mjs')),
    ...(await import('../gear/power-ranger-standard-issue.mjs')),
  };
  ttsg = await import('../zords/elemental-fury.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.combat = null;
  nextRoll = 1;
});

describe('registration', () => {
  test('Use buttons and hooks are registered', () => {
    const ids = ext.registrySnapshot().uses.map(u => u.id);
    expect(ids).toEqual(expect.arrayContaining(['pr3NinjaPower', 'pr3PowerHealCondition', 'pr3ElementalFury']));
    // Emissary's Gift is the Perk's own Use rule now (module/rules/conv10-slA10.test.js).
    expect(ids).not.toContain('pr3EmissarysGift');
    // Protector of Safehaven's gift, its mission-long marks and Roll Options switches are the Perk's own rules now.
    expect(ids).not.toContain('pr3Safehaven');
    // Morphin Navigator's Grid Power Bloom is the item's own Use rule now.
    expect(ids).not.toContain('pr3Navigator');
    // Zord Mount's rider pick and follow-up note are the Feature's own rules now.
    expect(ids).not.toContain('pr3ZordMount');
    // Unique Weapon's pick and the Ranged weapon's store / draw are their items' own Use rules now.
    expect(ids).not.toContain('pr3UniqueWeapon');
    expect(ids).not.toContain('pr3UniqueStore');
    expect(global.Hooks.on).toHaveBeenCalledWith('updateItem', expect.any(Function));
  });

  test('Use buttons match only their own items', () => {
    const perk = makeItem({ flags: src(common.IDS.ninjaPower) });
    expect(useFor(perk)?.id).toBe('pr3NinjaPower');
    expect(useFor(makeItem({ flags: src('Compendium.essence20.pr_crb.Item.other') }))).toBeNull();
    expect(useFor(makeItem({}))).toBeNull();
  });
});

describe('Ninja Power jump', () => {
  test('attacks against a jumper this round take the ↓1', () => {
    global.game.combat = { id: 'c', round: 2, turn: 1 };
    const target = makeActor({ flags: { essence20: { pr3NinjaJump: { combatId: 'c', round: 2, turn: 0 } } } });
    const attacker = makeActor();
    expect(sourcesFor(attacker, target, { isAttack: true }).find(s => s.id == 'ext-pr3NinjaJump')?.shiftDown).toBe(1);
    global.game.combat.round = 3;
    expect(sourcesFor(attacker, target, { isAttack: true }).find(s => s.id == 'ext-pr3NinjaJump')).toBeUndefined();
  });
});

describe('Power Heal', () => {
  test('lists only negative Conditions', () => {
    const actor = makeActor({ statuses: ['morphed', 'prone', 'stunned', 'cover'] });
    expect(crb.negativeStatuses(actor)).toEqual(['prone', 'stunned']);
  });

  test('its condition Use needs Morphed and Power', () => {
    const actor = makeActor({ system: { isMorphed: true, powers: { personal: { value: 1 } } }, items: [{ type: 'power', flags: src(common.IDS.powerHeal) }] });
    const item = actor.items.contents[0];
    expect(useFor(item).canUse(item)).toBe(true);
    actor.system.isMorphed = false;
    expect(useFor(item).canUse(item)).toBe(false);
  });
});

describe('Standard Issue', () => {
  test('notices the package landing on the Power Morpher', () => {
    const changes = { flags: { essence20: { equipmentPackage: { name: 'Power Ranger Standard Issue' } } } };
    expect(crb.isStandardIssueLanding({ name: 'Power Morpher' }, changes)).toBe(true);
    expect(crb.isStandardIssueLanding({ name: 'Blade Blaster' }, changes)).toBe(false);
    expect(crb.isStandardIssueLanding({ name: 'Power Morpher' }, {})).toBe(false);
  });
});

describe('Through the Shattered Grid', () => {
  test('Elemental Fury uses the strongest ranged attack', () => {
    const zord = makeActor({ items: [
      { type: 'weaponEffect', system: { damageValue: 3, classification: { style: 'energy' } } },
      { type: 'weaponEffect', system: { damageValue: 5, classification: { style: 'melee' } } },
      { type: 'weaponEffect', system: { damageValue: 4, classification: { style: 'ranged' } } },
    ] });
    expect(ttsg.strongestRanged(zord).system.damageValue).toBe(4);
    expect(ttsg.FURY.fire.bonus).toBe(2);
  });
});
