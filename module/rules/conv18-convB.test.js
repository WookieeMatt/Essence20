import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 18, convB (docs/rules-batches/slConvB18.md): the items whose last hand-written code went - Body of Energy,
 * Renegade Commander, Zeo Crystal Boost, We Improvise, Megafauna (arriving in form) and the Sorcery builder's Use. Each
 * item is loaded from its pack source; these check the rules validate and do what the removed code did (and what the
 * book says where they differ - see the write-up).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const allies = { list: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  getNearbyAllyTokens: jest.fn(() => allies.list.map(actor => actor.token)),
  pickAllyTargets: jest.fn(async (actor, candidates) => candidates.slice(0, 1)),
  getAllNearbyTokens: jest.fn(() => []),
}));
const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), grantBonusAttack: jest.fn(), getLedger: () => null, isTracking: () => false }));
const storyPoints = {
  canSpendForActor: jest.fn(() => true), spendForActor: jest.fn(async () => {}), canWriteStoryPoints: () => true, requestStoryPointGrant: jest.fn(),
  poolFor: () => 'story', hasStoryPointsAvailable: () => true, getStoryPoints: () => 3, setStoryPoints: jest.fn(async () => true),
};
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => storyPoints);
const builder = { buildSorcerousPower: jest.fn(async () => 'built') };
jest.unstable_mockModule('./items/magic/temper-tempest-sorcery-builder.mjs', () => builder);

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse, sweepExpired } = await import('./triggers.mjs');
const { rollRules, ruleDerived, ruleScaledDamage } = await import('./adapter.mjs');
const { healthOverflow } = await import('./plugins/combat/health-overflow.mjs');
const { powerGateOpen } = await import('./plugins/resources/power-gate.mjs');
const { applySummonArrival } = await import('./plugins/zords/summon-arrival.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  bodyOfEnergy: 'atsitems/_source/Body_of_Energy_L2X2rIz2frulSajQ.json',
  renegadeCommander: 'sssitems/_source/Renegade_Commander_JgJRqxXzTPBOlOBz.json',
  zeoCrystalBoost: 'atsitems/_source/Zeo_Crystal_Boost_NiEaLWcx8N48fvvN.json',
  weImprovise: 'tf1sitems/_source/We_Improvise_qnRFb2A0sLpSg2sL.json',
  megafauna: 'atsitems/_source/Megafauna_c6plguiUVmJzGNsw.json',
  sorcery: 'fmmcitems/_source/Sorcery_xUBOE1s5pgVyUrwj.json',
};

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));
let nextId = 1;

function makeItem(actor, data) {
  const item = { id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, effects: [], ...data };
  item.update = async changes => Object.entries(changes).forEach(([key, value]) => setPath(item, key, value));
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

const PACKS = { atsitems: 'across_the_stars', sssitems: 'sgt_slaughter_sourcebook', tf1sitems: 'transformers_one', fmmcitems: 'finster_s_monster_matic_cookbook' };

function makeActor(name, files = [], { system = {}, flags = {}, type = 'playerCharacter', disposition = 1, items: extra = [] } = {}) {
  const items = [];
  const effects = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: {
      level: 12, size: 'common', health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      essences: {}, isMorphed: false,
      defenses: { toughness: { total: 10 }, evasion: { total: 15 }, willpower: { total: 11 }, cleverness: { total: 12 } }, ...system,
    },
    update: jest.fn(async function (data) {
      Object.entries(data).forEach(([key, value]) => setPath(actor, key, value));
    }),
    async setFlag(scope, key, value) {
      setPath(actor.flags[scope] ??= {}, key, value);
    },
    getFlag(scope, key) {
      return getPath(actor.flags[scope], key);
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => (type == 'ActiveEffect' ? { ...clone(data), id: `e${nextId++}` } : makeItem(actor, clone(data))));
      (type == 'ActiveEffect' ? effects : items).push(...made);
      rebuildIndex(actor);
      return made;
    },
    async deleteEmbeddedDocuments(type, ids) {
      const from = type == 'ActiveEffect' ? effects : items;
      ids.forEach(id => from.splice(from.findIndex(entry => entry.id == id), 1));
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, img: doc.img, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.${PACKS[file.split('/')[0]]}.Item.${doc._id}` } } }));
  }

  extra.forEach(data => items.push(makeItem(actor, data)));
  actor.items = Object.assign(items, { contents: items, get: id => items.find(item => item.id == id) });
  actor.effects = Object.assign(effects, { contents: effects });
  const token = { actor, document: { disposition, uuid: `Scene.s.Token.t${actor.id}` }, center: { x: 0, y: 0 }, id: `t${actor.id}`, name };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const answerOf = (actor, other, roll, label) => rollRules(actor, other, roll, ['RollModifier']).find(entry => String(entry.rule.label).startsWith(label))?.answer;

function scene(...actors) {
  global.fromUuidSync = uuid => actors.find(actor => actor.uuid == uuid) ?? null;
  global.game.actors = Object.assign([...actors], { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors });
}

const pay = jest.fn(async () => true);

beforeEach(() => {
  pay.mockClear();
  spend.mockClear();
  storyPoints.requestStoryPointGrant.mockClear();
  allies.list = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true } }, actors: Object.assign([], { contents: [] }),
    settings: { get: () => 1 }, i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data ?? {})}`, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { E20: { skills: {}, skillToEssence: {} } };
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: { setProperty: setPath, getProperty: getPath, hasProperty: (o, k) => getPath(o, k) !== undefined, randomID: () => `r${nextId++}`, deepClone: clone },
  };
});

test('every convB rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect([file, rule.type, validateRule(rule)]).toEqual([file, rule.type, []]);
    }
  }
});

describe('Body of Energy', () => {
  const morphed = extra => ({ system: { isMorphed: true, health: { value: 3, max: 10 }, powers: { personal: { value: 4, max: 6 } }, ...extra } });

  test('while Morphed, damage that would empty Health comes out of Personal Power first (Health kept at 1); Stun and unmorphed: plain', async () => {
    const ranger = makeActor('Ranger', FILES.bodyOfEnergy, morphed());
    expect(await healthOverflow(ranger, 2, 'blunt')).toBe(2);
    expect(await healthOverflow(ranger, 5, 'blunt')).toBe(2);
    expect(ranger.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 }, { essence20Loss: true });
    ranger.system.powers.personal.value = 1;
    expect(await healthOverflow(ranger, 5, 'blunt')).toBe(3);
    expect(ranger.system.powers.personal.value).toBe(0);
    ranger.system.powers.personal.value = 4;
    expect(await healthOverflow(ranger, 5, 'stun')).toBe(5);
    ranger.system.isMorphed = false;
    expect(await healthOverflow(ranger, 5, 'blunt')).toBe(5);
  });

  test('leaving Morph (not Defeated): each becomes half the pool, within its maximum, written as no spend', async () => {
    const ranger = makeActor('Ranger', FILES.bodyOfEnergy, morphed({ isMorphed: false, health: { value: 3, max: 10 }, powers: { personal: { value: 6, max: 4 } } }));
    await fireTriggers(ranger, 'unmorph');
    expect(ranger.update).toHaveBeenCalledWith({ 'system.health.value': 4, 'system.powers.personal.value': 4 }, { essence20Loss: true, essence20Refund: true });
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('E20.ResBodyOfEnergyUnmorph');
    ranger.update.mockClear();
    ranger.system.health.value = 0;
    await fireTriggers(ranger, 'unmorph');
    expect(ranger.update).not.toHaveBeenCalled();
  });
});

describe('Renegade Commander', () => {
  function commander(level = 5) {
    const points = { name: 'Reckless Abandon', type: 'rolePoints', system: { resource: { value: 2 }, bonus: { value: 3, level20Value: 6 } } };
    return makeActor('Sarge', FILES.renegadeCommander, { system: { level }, items: [points] });
  }

  test("a Standard action and a use: the ally in Light or no armor gets ↑2 Strength and the Bonus Health for the scene", async () => {
    const sarge = commander();
    const ally = makeActor('Grunt');
    allies.list = [ally];
    scene(sarge, ally);
    const card = await runUse(itemNamed(sarge, 'Renegade Commander'), pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(itemNamed(sarge, 'Reckless Abandon').system.resource.value).toBe(1);
    const [effect] = ally.effects;
    expect(effect.name).toBe('E20.RenegadeCommanderEffect');
    expect(effect.changes).toEqual([{ key: 'system.essenceShifts.strength.shiftUp', mode: 2, value: '2' }, { key: 'system.health.bonus', mode: 2, value: '3' }]);
    expect(effect.flags.essence20.rulesExpiry.until).toBe('scene');
    expect(card).toContain('E20.RulesExtConvB18.RenegadeCommanderGiven');
    // The scene moves on: the sweep takes the effect away.
    effect.flags.essence20.rulesExpiry.stamp.epoch = -1;
    await sweepExpired(ally);
    expect(ally.effects).toHaveLength(0);
  });

  test('not on an ally in Medium armor or heavier; not on yourself before 9th level, yourself from 9th', async () => {
    const sarge = commander();
    const tank = makeActor('Tank', [], { items: [{ name: 'Plate', type: 'armor', system: { equipped: true, classification: 'medium' } }] });
    allies.list = [tank];
    scene(sarge, tank);
    await runUse(itemNamed(sarge, 'Renegade Commander'), pay);
    expect(tank.effects).toHaveLength(0);
    expect(sarge.effects).toHaveLength(0);
    expect(itemNamed(sarge, 'Reckless Abandon').system.resource.value).toBe(2);
    const veteran = commander(9);
    allies.list = [];
    scene(veteran);
    await runUse(itemNamed(veteran, 'Renegade Commander'), pay);
    expect(veteran.effects).toHaveLength(1);
  });
});

describe('Zeo Crystal Boost', () => {
  const pick = label => async (step, options) => options.findIndex(option => option.label == label);
  const boostOf = actor => itemNamed(actor, 'Zeo Crystal Boost');

  test('once per scene: the pick sets the option (the Zord +2 fresh); the activation is gated afterwards; the scene end clears it', async () => {
    const ranger = makeActor('Tommy', FILES.zeoCrystalBoost);
    expect(powerGateOpen(boostOf(ranger))).toBe(true);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: boostOf(ranger) }, ask: pick('E20.ZeoCrystalBoostMorpher') });
    expect(ranger.flags.essence20.zeoCrystalBoostOption).toBe('morpher');
    expect(ranger.flags.essence20.zeoCrystalBoostZordAttackConsumed).toBe(false);
    expect(powerGateOpen(boostOf(ranger))).toBe(false);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: boostOf(ranger) }, ask: pick('E20.ZeoCrystalBoostWeapon') });
    expect(ranger.flags.essence20.zeoCrystalBoostOption).toBe('morpher');
    await fireTriggers(ranger, 'sceneStart');
    expect(ranger.flags.essence20.zeoCrystalBoostOption).toBe(false);
  });

  test('a cancelled pick uses nothing', async () => {
    const ranger = makeActor('Tommy', FILES.zeoCrystalBoost);
    await fireTriggers(ranger, 'powerUsed', { roll: { item: boostOf(ranger) }, ask: async () => null });
    expect(ranger.flags.essence20.zeoCrystalBoostOption).toBeUndefined();
    expect(powerGateOpen(boostOf(ranger))).toBe(true);
  });

  test('Morpher: ↑1 on unarmed attacks (not a weapon\'s), +1 to every Defense', () => {
    const ranger = makeActor('Tommy', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'morpher' } });
    const punch = { type: 'weaponEffect', flags: {}, system: { classification: { style: 'melee' } } };
    const sword = { type: 'weaponEffect', flags: { essence20: { parentId: 'w' } }, system: { classification: { style: 'melee' } } };
    expect(answerOf(ranger, null, { item: punch }, 'Zeo Crystal Boost (Morpher')).toBe(true);
    expect(answerOf(ranger, null, { item: sword }, 'Zeo Crystal Boost (Morpher')).toBe(false);
    ruleDerived(ranger);
    expect(ranger.system.defenses.toughness.total).toBe(11);
    expect(ranger.system.defenses.cleverness.total).toBe(13);
    const other = makeActor('Billy', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'weapon' } });
    ruleDerived(other);
    expect(other.system.defenses.toughness.total).toBe(10);
    expect(answerOf(other, null, { item: punch }, 'Zeo Crystal Boost (Morpher')).toBe(false);
  });

  test('Zord: ↑1 on Driving while driving a Zord (not a plain vehicle, not another Skill)', () => {
    const ranger = makeActor('Tommy', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'zordDriving' } });
    const zord = makeActor('Zord', [], { type: 'zord', system: { actors: { d: { uuid: ranger.uuid, vehicleRole: 'driver' } } } });
    scene(ranger, zord);
    expect(answerOf(ranger, null, { rolledSkill: 'driving' }, 'Zeo Crystal Boost (Zord')).toBe(true);
    expect(answerOf(ranger, null, { rolledSkill: 'targeting' }, 'Zeo Crystal Boost (Zord')).toBe(false);
    zord.type = 'vehicle';
    expect(answerOf(ranger, null, { rolledSkill: 'driving' }, 'Zeo Crystal Boost (Zord')).toBe(false);
  });

  test("Zord: +2 damage on the Zord's attacks until one hits; then it's used", async () => {
    const ranger = makeActor('Tommy', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'zordAttackDamage', zeoCrystalBoostZordAttackConsumed: false } });
    const zord = makeActor('Zord', [], { type: 'zord', system: { actors: { d: { uuid: ranger.uuid, vehicleRole: 'driver' } } } });
    const target = makeActor('Putty', [], { disposition: -1 });
    scene(ranger, zord, target);
    rebuildIndex(ranger);
    const blast = { type: 'weaponEffect', flags: {}, system: { damageType: 'energy', classification: { style: 'energy' } }, parent: zord };
    expect(ruleScaledDamage(zord, target, { item: blast }).amount).toBe(2);
    expect(ruleScaledDamage(ranger, target, { item: blast }).amount).toBe(0);
    await fireTriggers(zord, 'hit', { roll: { item: blast, isAttack: true }, outcome: 'success', targets: [target], once: new Set() });
    expect(ranger.flags.essence20.zeoCrystalBoostZordAttackConsumed).toBe(true);
    expect(ruleScaledDamage(zord, target, { item: blast }).amount).toBe(0);
  });

  test("team Megazord: +1 on its attacks only while every Zord's pilot chose it - once, however many hold it", () => {
    const red = makeActor('Red', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'megaformTeam' } });
    const blue = makeActor('Blue', FILES.zeoCrystalBoost, { flags: { zeoCrystalBoostOption: 'megaformTeam' } });
    const z1 = makeActor('Z1', [], { type: 'zord', system: { actors: { d: { uuid: red.uuid, vehicleRole: 'driver' } } } });
    const z2 = makeActor('Z2', [], { type: 'zord', system: { actors: { d: { uuid: blue.uuid, vehicleRole: 'driver' } } } });
    const form = makeActor('Megazord', [], { type: 'megaform', system: { subtype: ['megaformZord'], actors: { a: { uuid: z1.uuid }, b: { uuid: z2.uuid } } } });
    const target = makeActor('Monster', [], { disposition: -1 });
    scene(red, blue, z1, z2, form, target);
    rebuildIndex(red);
    rebuildIndex(blue);
    const fist = { type: 'weaponEffect', flags: {}, system: { damageType: 'blunt', classification: { style: 'melee' } }, parent: form };
    expect(ruleScaledDamage(form, target, { item: fist }).amount).toBe(1);
    blue.flags.essence20.zeoCrystalBoostOption = 'morpher';
    expect(ruleScaledDamage(form, target, { item: fist }).amount).toBe(0);
  });
});

describe('We Improvise', () => {
  test('the first Initiative in a combat adds a Story Point that expires with the combat', async () => {
    const bot = makeActor('Bot', FILES.weImprovise);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [] };
    await fireTriggers(bot, 'initiativeRolling');
    expect(storyPoints.requestStoryPointGrant).toHaveBeenCalledWith(bot, 1, { pool: 'story' });
    expect(bot.flags.essence20.expiringStoryPointsGrant).toEqual(expect.objectContaining({ combatId: 'c1', count: 1, message: 'E20.ResWeImproviseLost' }));
    expect(bot.flags.essence20.weImproviseUsedThisEncounter).toEqual(expect.objectContaining({ window: 'encounter', count: 1 }));
  });
});

describe('Megafauna', () => {
  test('the summoned Zord arrives in Megafauna Form', () => {
    const zord = makeActor('Zord', FILES.megafauna, { type: 'zord', flags: { zord1Megafauna: false } });
    const write = { flags: { essence20: { zordSummonReadyRound: 3 } } };
    applySummonArrival(zord, write);
    expect(write.flags.essence20.zord1Megafauna).toBe(true);
    const plain = { flags: { essence20: {} } };
    applySummonArrival(zord, plain);
    expect(plain.flags.essence20.zord1Megafauna).toBeUndefined();
  });
});

describe('Sorcery', () => {
  test('the Use opens the builder and posts its line', async () => {
    const sorcerer = makeActor('Finster', FILES.sorcery);
    const card = await runUse(itemNamed(sorcerer, 'Sorcery'), pay);
    expect(builder.buildSorcerousPower).toHaveBeenCalledWith(sorcerer);
    expect(card).toContain('built');
  });
});
