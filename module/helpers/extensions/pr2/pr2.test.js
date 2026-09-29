import { jest } from '@jest/globals';

const worldList = [];
function makeItem(data) {
  return {
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    uuid: data.uuid ?? `Item.${Math.random().toString(36).slice(2, 10)}`,
    name: data.name ?? 'Item',
    type: data.type ?? 'perk',
    img: 'x.svg',
    system: data.system ?? {},
    flags: data.flags ?? {},
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    update: jest.fn(async () => {}),
  };
}

function makeActor(data = {}) {
  const items = (data.items ?? []).map(makeItem);
  const actor = {
    uuid: data.uuid ?? `Actor.${Math.random().toString(36).slice(2, 10)}`,
    id: data.id ?? Math.random().toString(36).slice(2, 10),
    name: data.name ?? 'Actor',
    type: data.type ?? 'playerCharacter',
    documentName: 'Actor',
    system: data.system ?? {},
    flags: data.flags ?? {},
    statuses: new Set(data.statuses ?? []),
    isOwner: true,
    items: { contents: items, get: id => items.find(i => i.id == id) },
    effects: { contents: [] },
    getActiveTokens: () => [],
    setFlag: jest.fn(async function (scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }),
    unsetFlag: jest.fn(async function (scope, key) {
      delete this.flags[scope]?.[key];
    }),
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    },
    update: jest.fn(async () => {}),
    createEmbeddedDocuments: jest.fn(async (type, docs) => docs.map((d, i) => ({ ...d, id: `new${i}` }))),
    deleteEmbeddedDocuments: jest.fn(async () => {}),
  };
  items.forEach(item => {
    item.parent = actor;
  });
  return actor;
}

const src = uuid => ({ core: { sourceId: uuid } });

let ext;
let common;
let team;
let zords;
let finster;
let perks;

beforeAll(async () => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = {
    i18n: { localize: k => k, format: k => k },
    user: { id: 'u1', isGM: true },
    users: { activeGM: null },
    actors: { contents: worldList, [Symbol.iterator]: () => worldList[Symbol.iterator]() },
    combat: null,
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.CONFIG = {
    E20: {
      skills: {}, skillToEssence: { science: 'smarts', technology: 'smarts', might: 'strength' },
      skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
    },
  };
  global.CONST = { ACTIVE_EFFECT_MODES: { ADD: 2 } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = null;

  ext = await import('../../extensions.mjs');
  common = await import('./common.mjs');
  team = await import('./team.mjs');
  zords = await import('./zords.mjs');
  finster = await import('./finster.mjs');
  perks = await import('./perks.mjs');
});

beforeEach(() => {
  worldList.length = 0;
  global.game.combat = null;
});

describe('registration', () => {
  test('uses register', () => {
    const uses = ext.registrySnapshot().uses.map(u => u.id);
    expect(uses).toEqual(expect.arrayContaining(['pr2Instructor', 'pr2DinoDrive', 'pr2KeenEye', 'pr2Privileged']));
  });
});

describe('Bend Physics', () => {
  test('doubles Movement for a Morphed teammate of the holder', () => {
    const holder = makeActor({ items: [{ flags: src(common.PR2.bendPhysics) }] });
    const mate = makeActor({ system: { isMorphed: true, movement: { ground: { total: 30 }, aerial: { total: 0 } } } });
    worldList.push(holder, mate);
    team.bendPhysicsDerived(mate);
    expect(mate.system.movement.ground.total).toBe(60);
  });

  test('nothing unmorphed or without the Perk on the team', () => {
    const mate = makeActor({ system: { isMorphed: false, movement: { ground: { total: 30 } } } });
    worldList.push(makeActor({ items: [{ flags: src(common.PR2.bendPhysics) }] }), mate);
    team.bendPhysicsDerived(mate);
    expect(mate.system.movement.ground.total).toBe(30);
    const alone = makeActor({ system: { isMorphed: true, movement: { ground: { total: 30 } } } });
    worldList.length = 0;
    worldList.push(alone);
    team.bendPhysicsDerived(alone);
    expect(alone.system.movement.ground.total).toBe(30);
  });

  test('+2 Evasion against ranged attacks only', () => {
    const holder = makeActor({ system: { isMorphed: true }, items: [{ flags: src(common.PR2.bendPhysics) }] });
    worldList.push(holder);
    const ranged = { type: 'weaponEffect', system: { classification: { style: 'projectile' } } };
    const melee = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };
    expect(team.bendPhysicsDefense(null, holder, 'evasion', { item: ranged })).toBe(2);
    expect(team.bendPhysicsDefense(null, holder, 'evasion', { item: melee })).toBe(0);
    expect(team.bendPhysicsDefense(null, holder, 'toughness', { item: ranged })).toBe(0);
  });
});

describe('Primal Rage / Instructor / Graphite Prime', () => {
  test('Primal Rage ↑1 on unarmed attacks for the team', () => {
    const holder = makeActor({ items: [{ flags: src(common.PR2.primalRage) }] });
    const mate = makeActor({ items: [{ id: 'w', type: 'weapon', name: 'Power Sword' }] });
    worldList.push(holder, mate);
    const unarmed = { type: 'weaponEffect', name: 'Punch', flags: {} };
    const armed = { type: 'weaponEffect', name: 'Slash', flags: { essence20: { parentId: 'w' } } };
    expect(team.primalRageSources(mate, null, { isAttack: true, item: unarmed }).sources[0].shiftUp).toBe(1);
    expect(team.primalRageSources(mate, null, { isAttack: true, item: armed })).toBeNull();
  });

  test('Instructor ↑1 on the taught Skill and no untrained Snag for students', () => {
    const student = makeActor({ uuid: 'Actor.student' });
    const teacher = makeActor({ items: [{ flags: { ...src(common.PR2.instructor), essence20: { pr2Instructor: { skill: 'science', students: ['Actor.student'] } } } }] });
    worldList.push(teacher, student);
    expect(team.instructorSources(teacher, null, { rolledSkill: 'science' }).sources[0].shiftUp).toBe(1);
    expect(team.instructorSources(teacher, null, { rolledSkill: 'technology' })).toBeNull();
    expect(team.pr2NoUntrainedSnag(student, 'science')).toBe(true);
    expect(team.pr2NoUntrainedSnag(student, 'technology')).toBe(false);
  });

  test('Aim Apparatus steps a shift up one rank, capped at d12', () => {
    expect(team.stepShift('d20', 1)).toBe('d2');
    expect(team.stepShift('d12', 1)).toBe('d12');
    expect(team.stepShift('d2', -1)).toBe('d20');
  });

  test('Graphite Ranger Prime Snags attacks on it in round 1', () => {
    const target = makeActor({ system: { isMorphed: true }, items: [{ flags: src(common.PR2.graphitePrime) }] });
    global.game.combat = { started: true, round: 1 };
    expect(team.graphitePrimeSources(makeActor(), target, { isAttack: true }).sources[0].snag).toBe(true);
    global.game.combat = { started: true, round: 2 };
    expect(team.graphitePrimeSources(makeActor(), target, { isAttack: true })).toBeNull();
  });
});

describe('Zord Features', () => {
  test('gem colour updates', () => {
    const effect = { system: { damageValue: 2, damageType: 'element', range: { value: 50, long: 120 } } };
    expect(zords.gemUpdate(effect, 'red', { flag: 'dinoGem' })).toEqual({ 'system.damageType': 'fire', 'flags.essence20.pr2GemBoost.dinoGem': 'red' });
    expect(zords.gemUpdate(effect, 'blue')).toEqual({ 'system.range.value': 100, 'system.range.long': 170 });
    expect(zords.gemUpdate(effect, 'green', { extraDamage: 1 })).toEqual({ 'system.damageValue': 4 });
    expect(zords.gemUpdate(effect, null, { extraDamage: 1 })).toEqual({ 'system.damageValue': 3 });
  });

  test('Dino Gem ↑1 on the flagged attack', () => {
    const zord = makeActor({ type: 'zord', items: [{ type: 'feature', flags: src(common.PR2.dinoGemIntegration) }] });
    const item = { type: 'weaponEffect', flags: { essence20: { pr2GemBoost: { dinoGem: 'red' } } } };
    expect(zords.dinoGemSources(zord, null, { isAttack: true, item }).sources[0].shiftUp).toBe(1);
    expect(zords.dinoGemSources(zord, null, { isAttack: true, item: { type: 'weaponEffect', flags: {} } })).toBeNull();
  });

  test('Dedicated Carrier removes Combiner', async () => {
    const zord = makeActor({ type: 'zord', items: [{ id: 'c', type: 'feature', flags: src(common.PR2.combiner) }, { type: 'feature', flags: src(common.PR2.carrier) }, { type: 'feature', flags: src(common.PR2.dedicatedCarrier) }] });
    await zords.applyDedicatedCarrier(zord.items.contents[2]);
    expect(zord.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['c']);
  });

  test('Dino Drive speed penalty keeps Speed at 1', () => {
    expect(zords.speedPenalty(6)).toBe(3);
    expect(zords.speedPenalty(2)).toBe(1);
    expect(zords.speedPenalty(1)).toBe(0);
  });

  test('Reflective Armor ignores non-Energy damage and inactive Zords', async () => {
    const zord = makeActor({ type: 'zord' });
    expect(await zords.reflectiveArmor(zord, 3, 'fire')).toBe(3);
    expect(await zords.reflectiveArmor(zord, 3, 'blunt')).toBe(3);
  });
});

describe("Finster's", () => {
  test('Flames of Hate ignores the armor share of the Defense', () => {
    const attacker = makeActor();
    const item = { type: 'weaponEffect', flags: src(common.PR2.flamesOfHateEffects[0]) };
    const defender = makeActor({ system: { isMorphed: true, defenses: { cleverness: { armor: 0, morphed: 2 } } } });
    expect(finster.flamesOfHateDefense(attacker, defender, 'cleverness', { item })).toBe(-2);
    defender.statuses.add('armorStripped');
    expect(finster.flamesOfHateDefense(attacker, defender, 'cleverness', { item })).toBe(0);
    expect(finster.flamesOfHateDefense(attacker, makeActor({ system: { defenses: { cleverness: { armor: 1 } } } }), 'cleverness', { item: { type: 'weaponEffect', flags: {} } })).toBe(0);
  });

  test('Aura of Decay costs 1 Health when used', async () => {
    const actor = makeActor({ system: { health: { value: 4 } } });
    const power = { type: 'power', name: 'Aura of Decay', flags: src(common.PR2.auraOfDecay) };
    await finster.auraOfDecayCost(actor, { rollType: 'power' }, power);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 3 });
    actor.update.mockClear();
    await finster.auraOfDecayCost(actor, { rollType: 'skill' }, power);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('Incineration Blast is recognised by effect or weapon', () => {
    const actor = makeActor({ items: [{ id: 'w', type: 'weapon', flags: src(common.PR2.incinerationBlastWeapon) }] });
    expect(finster.isIncinerationBlast(actor, { type: 'weaponEffect', flags: { essence20: { parentId: 'w' } } })).toBe(true);
    expect(finster.isIncinerationBlast(actor, { type: 'weaponEffect', flags: src(common.PR2.incinerationBlastEffect) })).toBe(true);
    expect(finster.isIncinerationBlast(actor, { type: 'weaponEffect', flags: {} })).toBe(false);
  });

  test('Nemesis Drain clears at the new scene', async () => {
    const hit = makeActor({ flags: { essence20: { nemesisDrainPenaltyActive: true } } });
    worldList.push(hit);
    await finster.clearNemesisDrain();
    expect(hit.flags.essence20.nemesisDrainPenaltyActive).toBeUndefined();
  });
});

describe('Perks', () => {
  test('Keen Eye Edge on Alertness (Perception) only', () => {
    const actor = makeActor({
      items: [{ flags: src(common.PR2.keenEye) }],
      system: { skills: { alertness: { specializations: { a: { name: 'Perception' }, b: { name: 'Investigation' } } } } },
    });
    const options = {};
    perks.keenEyeApply(actor, options, { rolledSkill: 'alertness', dataset: { specializationKey: 'a' } });
    expect(options.edge).toBe(true);
    const other = {};
    perks.keenEyeApply(actor, other, { rolledSkill: 'alertness', dataset: { specializationKey: 'b' } });
    expect(other.edge).toBeUndefined();
  });

  test('Grid Relic weapon rolls the Role skill die for Energy damage', () => {
    const { weapon, effect } = perks.relicData('might', { id: 'p' });
    expect(weapon.system.traits).toContain('powerWeapon');
    expect(effect.system.classification.skill).toBe('roleSkillDie');
    expect(effect.system.damageType).toBe('element');
  });
});
