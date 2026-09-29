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

  ext = await import('../../extensions.mjs');
  common = await import('./common.mjs');
  crb = await import('./pr-crb.mjs');
  ttsg = await import('./ttsg.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.combat = null;
  nextRoll = 1;
});

describe('registration', () => {
  test('Use buttons and hooks are registered', () => {
    const ids = ext.registrySnapshot().uses.map(u => u.id);
    expect(ids).toEqual(expect.arrayContaining(['pr3MegaformTrait', 'pr3NinjaPower', 'pr3PowerHealCondition', 'pr3Student',
      'pr3VastWealth', 'pr3UniqueWeapon', 'pr3UniqueStore', 'pr3ElementalFury', 'pr3Overload', 'pr3ZordMount', 'pr3Camouflage',
      'pr3EmissarysGift', 'pr3Navigator', 'pr3Safehaven']));
    expect(global.Hooks.on).toHaveBeenCalledWith('updateItem', expect.any(Function));
    expect(global.Hooks.on).toHaveBeenCalledWith('updateActor', expect.any(Function));
  });

  test('Use buttons match only their own items', () => {
    const perk = makeItem({ flags: src(common.IDS.megaformTrait) });
    expect(useFor(perk)?.id).toBe('pr3MegaformTrait');
    expect(useFor(makeItem({ flags: src('Compendium.essence20.pr_crb.Item.other') }))).toBeNull();
    expect(useFor(makeItem({}))).toBeNull();
  });
});

describe('Megaform Expeditor', () => {
  test('reduces the join time by 1d4 to a minimum of 1 when the owner has it', async () => {
    const zord = makeActor({ type: 'zord', uuid: 'Actor.zord' });
    const ranger = makeActor({ items: [{ flags: src(common.IDS.megaformExpeditor) }], system: { actors: { a: { uuid: 'Actor.zord', type: 'zord' } } } });
    worldList.push(ranger, zord);
    nextRoll = 2;
    expect(await crb.expediteJoinTime(zord, 5)).toBe(3);
    nextRoll = 4;
    expect(await crb.expediteJoinTime(zord, 3)).toBe(1);
  });

  test('leaves other Zords alone', async () => {
    const zord = makeActor({ type: 'zord', uuid: 'Actor.z2' });
    worldList.push(makeActor({ system: { actors: { a: { uuid: 'Actor.z2' } } } }), zord);
    expect(await crb.expediteJoinTime(zord, 5)).toBe(5);
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

describe('Peerless Pilot', () => {
  test('auto-passes only for the driver holding the Perk', () => {
    const pilot = makeActor({ items: [{ flags: src(common.IDS.peerlessPilot) }] });
    expect(crb.autoPassesDisembark(pilot, { vehicleRole: 'driver' })).toBe(true);
    expect(crb.autoPassesDisembark(pilot, { vehicleRole: 'passenger' })).toBe(false);
    expect(crb.autoPassesDisembark(makeActor(), { vehicleRole: 'driver' })).toBe(false);
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

describe('Survivor', () => {
  test('spots Smarts dropping to 0', () => {
    expect(crb.smartsDroppedToZero({ system: { essences: { smarts: { value: 0 } } } })).toBe(true);
    expect(crb.smartsDroppedToZero({ system: { essences: { smarts: { value: 2 } } } })).toBe(false);
    expect(crb.smartsDroppedToZero({})).toBe(false);
  });

  test('a 10+ keeps Smarts at 1', async () => {
    const actor = makeActor();
    nextRoll = 12;
    expect(await crb.survivorCheck(actor)).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.essences.smarts.value': 1 });
    nextRoll = 9;
    expect(await crb.survivorCheck(makeActor())).toBe(false);
  });
});

describe('Unique Weapon', () => {
  test('the four weapons are distinct compendium uuids', () => {
    expect(new Set(crb.UNIQUE_WEAPONS).size).toBe(4);
  });

  test('Small Melee halves the Zord summon time, minimum 1', () => {
    const pilot = makeActor({ items: [{ type: 'weapon', flags: src(common.IDS.uwSmall), system: { equipped: true } }] });
    expect(crb.halveSummonRounds(pilot, 5)).toBe(3);
    expect(crb.halveSummonRounds(pilot, 1)).toBe(1);
    expect(crb.halveSummonRounds(makeActor(), 5)).toBe(5);
  });

  test('Versatile gains ↑2 against targets 3+ sizes larger', () => {
    const actor = makeActor({ system: { size: 'common' }, items: [{ id: 'w', type: 'weapon', flags: src(common.IDS.uwVersatile) }, { id: 'e', type: 'weaponEffect', flags: { essence20: { parentId: 'w' } } }] });
    const effect = actor.items.get('e');
    const big = makeActor({ system: { size: 'gigantic' } });
    expect(sourcesFor(actor, big, { isAttack: true, item: effect }).find(s => s.id == 'ext-pr3UniqueVersatile')?.shiftUp).toBe(2);
    expect(sourcesFor(actor, makeActor({ system: { size: 'huge' } }), { isAttack: true, item: effect }).find(s => s.id == 'ext-pr3UniqueVersatile')).toBeUndefined();
  });

  test('Two-Handed slows every movement type by 10ft while equipped', () => {
    const actor = makeActor({ system: { movement: { ground: { total: 30 }, aerial: { total: 0 } } }, items: [{ type: 'weapon', flags: src(common.IDS.uwTwoHanded), system: { equipped: true } }] });
    ext.runDerived(actor);
    expect(actor.system.movement.ground.total).toBe(20);
    expect(actor.system.movement.aerial.total).toBe(0);
  });

  test('Ranged fumbles cost 1d4 Personal Power', async () => {
    const actor = makeActor({ system: { powers: { personal: { value: 3 } } } });
    nextRoll = 2;
    await ext.runPostRoll(actor, [], {}, { isFumble: true, hits: [], rider: { weaponSource: common.IDS.uwRanged } });
    expect(actor.system.powers.personal.value).toBe(1);
  });
});

describe('Dialog ticks', () => {
  test('Student, Vast Wealth and the Hang-Ups offer their ticks', () => {
    const actor = makeActor({ items: [
      { flags: src(common.IDS.student) }, { flags: src(common.IDS.vastWealth) },
      { type: 'hangUp', flags: src(common.IDS.hartunian) }, { type: 'hangUp', flags: src(common.IDS.returnedHangUp) },
    ] });
    const names = ext.extDialogToggles(actor, { rolledEssence: 'social', item: null }).map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['pr3Student', 'pr3Flaunt', 'pr3Hartunian', 'pr3Returned']));
  });

  test('ticks apply their shifts', async () => {
    const options = { ext: { pr3Hartunian: true, pr3Returned: true } };
    await ext.runApplyDialog(makeActor(), options, {});
    expect(options.shiftDown).toBe(1);
    expect(options.snag).toBe(true);
    const edge = { ext: { pr3Student: true } };
    await ext.runApplyDialog(makeActor(), edge, {});
    expect(edge.edge).toBe(true);
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

  test('Overload gives Edge on attacks this turn', () => {
    global.game.combat = { id: 'c', round: 1, turn: 0 };
    const zord = makeActor({ flags: { essence20: { pr3Overload: { combatId: 'c', round: 1, turn: 0 } } }, items: [{ type: 'feature', flags: src(common.IDS.overload) }] });
    expect(sourcesFor(zord, null, { isAttack: true }).find(s => s.id == 'ext-pr3Overload')?.edge).toBe(true);
    global.game.combat.turn = 1;
    expect(sourcesFor(zord, null, { isAttack: true }).find(s => s.id == 'ext-pr3Overload')).toBeUndefined();
  });

  test('Eltarian Camouflage imposes ↓1 on seeing through it', () => {
    const target = makeActor({ items: [{ type: 'gear', flags: { ...src(common.IDS.camouflage), essence20: { pr3Disguised: true } } }] });
    expect(sourcesFor(makeActor(), target, { rolledSkill: 'alertness' }).find(s => s.id == 'ext-pr3Camouflage')?.shiftDown).toBe(1);
    expect(sourcesFor(makeActor(), target, { rolledSkill: 'might', isAttack: true }).find(s => s.id == 'ext-pr3Camouflage')).toBeUndefined();
  });

  test('an active Rhino Sentry Shield is cover against ranged attacks', () => {
    const target = makeActor({ items: [{ type: 'shield', flags: src(common.IDS.rhinoShield), system: { equipped: true, active: true } }] });
    expect(sourcesFor(makeActor(), target, { isAttack: true, isMelee: false }).find(s => s.id == 'ext-pr3RhinoCover')?.shiftDown).toBe(2);
    expect(sourcesFor(makeActor(), target, { isAttack: true, isMelee: true }).find(s => s.id == 'ext-pr3RhinoCover')).toBeUndefined();
  });

  test("Emissary's Gift offers Role Perks at or below level, minus the excluded ones", () => {
    const roles = [{ name: 'Red Ranger', system: { items: {
      a: { type: 'perk', subtype: 'role', uuid: 'u1', name: 'Follow Me!', level: 2 },
      b: { type: 'perk', subtype: 'role', uuid: 'u2', name: 'Extra Attack', level: 5 },
      c: { type: 'perk', subtype: 'role', uuid: 'u3', name: 'Team Focus', level: 9 },
    } } }];
    expect(ttsg.emissaryOptions(roles, 6).map(o => o.value)).toEqual(['u1']);
  });

  test('Restraining Gear formulas', () => {
    expect(ttsg.opposedFormula('d6')).toBe('1d20 + 1d6');
    expect(ttsg.opposedFormula('2d8')).toBe('1d20 + 2d8');
    expect(ttsg.opposedFormula('d20')).toBe('1d20');
  });
});
