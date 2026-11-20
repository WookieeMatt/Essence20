import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Riding in a Transformer's Alt Mode (TF CRB p.47, p.163-165) - alt-mode-crew.mjs and its rules plug-in. */

const spend = jest.fn(async () => ({ blocked: false }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ spend, setNextTurn: jest.fn(), grantBonusAttack: jest.fn(), getLedger: () => null, isTracking: () => true }));
const applyDamage = jest.fn(async () => true);
const ranks = new Map();
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ applyDamage, getSkillRanks: (actor, skill) => ranks.get(`${actor.name}:${skill}`) ?? 0 }));
const assistSkill = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/actions/lend-assistance.mjs', () => ({ assistSkill, ASSIST_RANK_BYPASSES: [] }));
const leap = jest.fn(async () => ({ success: true }));
jest.unstable_mockModule('./mechanics/vehicles/vehicle-defeat.mjs', () => ({ rollBetterOfAthleticsOrAcrobatics: leap }));
const createViaGm = jest.fn(async () => true);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ createViaGm, needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/vehicles/zord-recall.mjs', () => ({
  disembarkPositions: (token, count) => Array.from({ length: count }, (_, i) => ({ x: token.x + 200 + i * 100, y: token.y })),
}));
let feetMoved = 0;
jest.unstable_mockModule('./items/vehicles/armored-cabin.mjs', () => ({ feetMovedThisTurn: () => feetMoved, vehicleOf: () => null }));

const { rebuildIndex } = await import('../../rules/index.mjs');
await import('../../rules/plugins/index.mjs');
const { ruleRollSources } = await import('../../rules/adapter.mjs');
const { validateRule } = await import('../../rules/types.mjs');
const { extRollSources, runPreRoll } = await import('../item-hooks.mjs');
const crew = await import('./alt-mode-crew.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  extraCrew: 'tfcrbitems/_source/Extra_Crew_Capacity_PCwgQWKmTOl8va3I.json',
  cage: 'tfcrbitems/_source/Cage_w1E74WXrvwQJlS1Q.json',
  care: 'tfcrbitems/_source/Emergency_Care_Equipment_rUoirxlfrn2PBQwO.json',
  repair: 'tfcrbitems/_source/Vehicle_Repair_Equipment_xX8Ijto8a0I4jbjt.json',
};

let nextId = 1;
const byUuid = new Map();
const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, k) => (node[k] ??= {}), object);
  if (last.startsWith('-=') || value instanceof foundry.data.operators.ForcedDeletion) {
    delete at[last.replace(/^-=/, '')];
  } else {
    at[last] = value;
  }
}

function makeItem(data = {}) {
  const item = { id: `i${nextId++}`, name: 'Thing', type: 'gear', isOwner: true, system: {}, ...data, flags: { essence20: {}, ...(data.flags ?? {}) } };
  item.uuid = `Item.${item.id}`;
  return item;
}

const packItem = file => {
  const doc = fromPack(file);
  return makeItem({ name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)), flags: { core: { sourceId: `Compendium.x.Item.${doc._id}` } } });
};

function makeActor(items = [], { name = 'Hero', system = {}, owner = true } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: owner, statuses: new Set(),
    flags: { essence20: {} }, img: 'hero.png',
    system: { size: 'common', skills: { driving: {}, athletics: {} }, defenses: { cleverness: { total: 14 }, toughness: { total: 16 } }, ...system },
    getActiveTokens: () => [],
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async toggleStatusEffect(status) {
      this.statuses.add(status);
    },
    testUserPermission: () => owner,
    _dice: { rollSkill: jest.fn(async () => ({ success: true })) },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => items.find(i => i.id == id), find: fn => items.find(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  byUuid.set(actor.uuid, actor);
  game.actors.contents.push(actor);
  return actor;
}

/** A Transformer in an Alt Mode with this Crew and Firepoints (null mode: Bot Mode). */
function transformer(crewRating = 4, firepoints = 1, extra = [], { name = 'Ironhide', transformed = true } = {}) {
  const mode = makeItem({ type: 'altMode', name: 'Van', system: { altModeCrew: crewRating, altModeFirepoints: firepoints } });
  const actor = makeActor([mode, ...extra], { name, system: { canTransform: true, isTransformed: transformed, altModeId: transformed ? mode.id : '' } });
  return actor;
}

beforeEach(() => {
  byUuid.clear();
  ranks.clear();
  [spend, applyDamage, assistSkill, leap, createViaGm].forEach(fn => fn.mockClear());
  feetMoved = 0;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true } },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k, has: () => false },
    settings: { get: () => 1 },
  };
  global.canvas = { tokens: { placeables: [] }, scene: null };
  global.CONFIG = { E20: { skillToEssence: { driving: 'speed', infiltration: 'smarts', brawn: 'strength', athletics: 'strength' } } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
  global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `k${nextId++}` },
    data: { operators: { ForcedDeletion: class ForcedDeletion {} } },
  };
});

const warned = () => ui.notifications.warn.mock.calls.map(([text]) => text.split(' ')[0]);

describe('Crew rating (TF CRB p.47, Extra Crew Capacity p.134)', () => {
  test("the Alt Mode's own; none in Bot Mode; Extra Crew Capacity +4 in Alt Mode, 1 in Bot Mode", () => {
    expect(crew.crewCapacity(transformer(3))).toBe(3);
    expect(crew.crewCapacity(transformer(3, 1, [], { transformed: false }))).toBe(0);
    expect(crew.crewCapacity(transformer(3, 1, [packItem(FILES.extraCrew)]))).toBe(7);
    expect(crew.crewCapacity(transformer(3, 1, [packItem(FILES.extraCrew)], { transformed: false }))).toBe(1);
    expect(crew.crewCapacity(makeActor())).toBe(0);
    expect(crew.firepointCapacity(transformer(3, 2))).toBe(2);
  });

  test('the new rule types validate', () => {
    for (const rule of fromPack(FILES.extraCrew).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }

    expect(validateRule({ type: 'CrewCapacity' })).toContain('changes nothing (add or set)');
  });
});

describe('Boarding', () => {
  test('a Common character climbs in, gets a Firepoint while one is free, and is announced in chat', async () => {
    const van = transformer(2, 1);
    const spike = makeActor([], { name: 'Spike' });
    const carly = makeActor([], { name: 'Carly' });
    expect(await crew.board(van, spike)).toBe(true);
    expect(await crew.board(van, carly)).toBe(true);
    expect(crew.crewEntries(van).map(e => [e.name, e.role, e.firepoint])).toEqual([['Spike', 'passenger', true], ['Carly', 'passenger', false]]);
    expect(crew.carrierOf(spike).carrier).toBe(van);
    expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  });

  test('refused: full, too big, in an Alt Mode, already aboard, a second Driver, Bot Mode, out of Reach', async () => {
    const van = transformer(1, 0);
    const spike = makeActor([], { name: 'Spike' });
    expect(crew.boardRefusal(van, makeActor([], { system: { size: 'large' } }))).toBe('TooBig');
    const bee = makeActor([], { name: 'Bee', system: { canTransform: true, isTransformed: true } });
    expect(crew.boardRefusal(van, bee)).toBe('NoAltModes');
    await crew.board(van, spike, { role: 'driver' });
    expect(crew.boardRefusal(van, spike)).toBe('AlreadyAboard');
    expect(crew.boardRefusal(transformer(4), spike)).toBe('AboardOther');
    expect(crew.boardRefusal(van, makeActor())).toBe('Full');
    expect(crew.boardRefusal(transformer(4, 0, [], { name: 'T2' }), makeActor(), 'driver')).toBe(null);
    const two = transformer(4);
    await crew.board(two, makeActor(), { role: 'driver' });
    expect(crew.boardRefusal(two, makeActor(), 'driver')).toBe('DriverTaken');
    const bot = transformer(4, 0, [], { transformed: false });
    expect(crew.boardRefusal(bot, makeActor())).toBe('BotMode');
    expect(crew.boardRefusal(bot, makeActor(), 'driver')).toBe('DriverAltOnly');
    expect(crew.boardRefusal(makeActor(), makeActor())).toBe('NotTransformer');

    const scene = { grid: { size: 100 } };
    canvas.scene = scene;
    const far = transformer(4);
    far.getActiveTokens = () => [{ parent: scene, x: 0, y: 0, width: 2, height: 1 }];
    const walker = makeActor([], { name: 'Walker' });
    walker.getActiveTokens = () => [{ parent: scene, x: 300, y: 0, width: 1, height: 1 }];
    expect(await crew.board(far, walker)).toBe(false);
    expect(warned()).toContain('NotInReach');
    // Beside it - at the size it has now become, not the one a token animation still shows.
    walker.getActiveTokens = () => [{ parent: scene, x: 200, y: 100, width: 1, height: 1, _source: { x: 200, y: 100, width: 1, height: 1 } }];
    expect(await crew.board(far, walker)).toBe(true);
  });

  test('climbing into one that moved this turn is the p.165 test (DIF 5 + feet / 5) - a failure keeps them out', async () => {
    game.combat = { started: true };
    feetMoved = 60;
    const van = transformer(4);
    const spike = makeActor([], { name: 'Spike' });
    spike._dice.rollSkill.mockResolvedValueOnce({ success: false });
    expect(await crew.board(van, spike)).toBe(false);
    expect(spike._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ dif: '17' }), spike);
    expect(await crew.board(van, spike)).toBe(true);
  });

  test("a fight elsewhere doesn't count: only one the Transformer is in asks for the moving test", async () => {
    feetMoved = 60;
    const van = transformer(4);
    const spike = makeActor([], { name: 'Spike' });
    game.combat = { started: true, combatants: [{ actor: makeActor([], { name: 'Elsewhere' }) }] };
    expect(await crew.board(van, spike)).toBe(true);
    expect(spike._dice.rollSkill).not.toHaveBeenCalled();
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).not.toContain('BoardMovement');
    await crew.disembark(van, spike);
    game.combat.combatants.push({ actor: van }, { actor: spike });
    expect(await crew.board(van, spike)).toBe(true);
    expect(spike._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ dif: '17' }), spike);
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('BoardMovement');
  });

  test("a player boarding someone else's Transformer goes through the GM", async () => {
    game.user.isGM = false;
    const van = makeActor([makeItem({ type: 'altMode', system: { altModeCrew: 2 } })], { name: 'Ironhide', owner: false, system: { canTransform: true, isTransformed: true } });
    van.system.altModeId = van.items.contents[0].id;
    const spike = makeActor([], { name: 'Spike' });
    await crew.board(van, spike);
    expect(createViaGm).toHaveBeenCalledWith('altModeCrew', expect.objectContaining({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: expect.objectContaining({ role: 'passenger' }) }));
  });
});

describe('The GM relay', () => {
  test("the Transformer's owner may do anything; a passenger's may board or leave, but a prisoner only by escaping", async () => {
    const van = transformer(4, 0, [packItem(FILES.cage)]);
    const spike = makeActor([], { name: 'Spike' });
    const player = { isGM: false };
    van.testUserPermission = () => false;
    expect(crew.relayedSeatAllowed({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: { uuid: spike.uuid, role: 'passenger' } }, player)).toBe(true);
    expect(crew.relayedSeatAllowed({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: { uuid: spike.uuid, role: 'prisoner' } }, player)).toBe(false);
    await crew.board(van, spike, { role: 'prisoner' });
    expect(crew.relayedSeatAllowed({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: null }, player)).toBe(false);
    expect(crew.relayedSeatAllowed({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: null, escaped: true }, player)).toBe(true);
    spike.testUserPermission = () => false;
    expect(crew.relayedSeatAllowed({ actorUuid: van.uuid, passengerUuid: spike.uuid, entry: null, escaped: true }, player)).toBe(false);

    const key = crew.crewEntries(van)[0].key;
    await crew.applyRelayedSeat({ actorUuid: van.uuid, key, entry: null });
    expect(crew.crewEntries(van)).toEqual([]);
  });
});

describe('Getting out', () => {
  test('a passenger gets out; a prisoner needs the captor (or an escape); the Cage marks go with them', async () => {
    const van = transformer(4, 0, [packItem(FILES.cage)]);
    const spike = makeActor([], { name: 'Spike' });
    await crew.board(van, spike);
    expect(await crew.disembark(van, spike)).toBe(true);
    expect(crew.carrierOf(spike)).toBeNull();

    const carly = makeActor([], { name: 'Carly' });
    await crew.board(van, carly, { role: 'prisoner' });
    expect(carly.flags.essence20.ruleMarks.caged).toMatchObject({ by: van.uuid });
    game.user.isGM = false;
    van.isOwner = false;
    expect(await crew.disembark(van, carly)).toBe(false);
    expect(warned()).toContain('MustEscape');
    expect(await crew.disembark(van, carly, { escaped: true })).toBe(true);
    expect(carly.flags.essence20.ruleMarks.caged).toBeUndefined();
  });

  test('escape: Infiltration against Cleverness, or Brawn against Toughness - success gets them out', async () => {
    const van = transformer(4, 0, [packItem(FILES.cage)]);
    const carly = makeActor([], { name: 'Carly' });
    await crew.board(van, carly, { role: 'prisoner' });
    carly._dice.rollSkill.mockResolvedValueOnce({ success: false });
    expect(await crew.escape(carly, 'brawn')).toBe(false);
    expect(carly._dice.rollSkill).toHaveBeenLastCalledWith(expect.objectContaining({ skill: 'brawn', dif: String(van.system.defenses.toughness.total) }), carly);
    expect(await crew.escape(carly, 'infiltration')).toBe(true);
    expect(carly._dice.rollSkill).toHaveBeenLastCalledWith(expect.objectContaining({ skill: 'infiltration', dif: '14' }), carly);
    expect(crew.carrierOf(carly)).toBeNull();
    expect(await crew.escape(carly, 'brawn')).toBe(false);
  });

  test('a Mode change: Bot Mode puts everyone out but its own Crew room and the Cage\'s one prisoner; Drivers always go', async () => {
    const van = transformer(4, 1, [packItem(FILES.extraCrew), packItem(FILES.cage)]);
    const [driver, one, two, prisoner, other] = ['Driver', 'One', 'Two', 'Prisoner', 'Other'].map(name => makeActor([], { name }));
    await crew.board(van, driver, { role: 'driver' });
    await crew.board(van, one);
    await crew.board(van, two);
    await crew.board(van, prisoner, { role: 'prisoner' });
    await crew.board(van, other, { role: 'prisoner' });
    van.system.isTransformed = false;
    van.system.altModeId = '';
    expect(crew.unloadPlan(van).map(row => row.actor.name)).toEqual(['Driver', 'Two', 'Other']);
    const out = await crew.unloadForMode(van);
    expect(out.map(actor => actor.name)).toEqual(['Driver', 'Two', 'Other']);
    expect(crew.crewEntries(van).map(e => e.name)).toEqual(['One', 'Prisoner']);
  });

  test('a crash: impact damage, a DIF 13 leap to get clear (Prone, 1d2 Blunt), half the impact for those still inside', async () => {
    global.Roll = class {
      async evaluate() {
        this.total = 2;
        return this;
      }
    };
    const van = transformer(4);
    const [jumper, stuck] = ['Jumper', 'Stuck'].map(name => makeActor([], { name }));
    await crew.board(van, jumper);
    await crew.board(van, stuck);
    leap.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    expect(await crew.crash(van, { feet: 45 })).toBe(true);
    expect(leap).toHaveBeenCalledWith(jumper, 13);
    expect(applyDamage).toHaveBeenCalledWith(van, 4, 'blunt');
    expect(applyDamage).toHaveBeenCalledWith(jumper, 2, 'blunt');
    expect(applyDamage).toHaveBeenCalledWith(stuck, 2, 'blunt');
    expect(jumper.statuses.has('prone')).toBe(true);
    expect(crew.crewEntries(van).map(e => e.name)).toEqual(['Stuck']);
    expect(await crew.crash(transformer(4, 0, [], { transformed: false }))).toBe(false);
  });
});

describe('Seats', () => {
  test('roles change under the same checks; a Firepoint only while one is free', async () => {
    const van = transformer(3, 1);
    const [a, b] = ['A', 'B'].map(name => makeActor([], { name }));
    await crew.board(van, a, { role: 'driver' });
    await crew.board(van, b);
    const [seatA, seatB] = crew.crewEntries(van);
    expect(await crew.setSeat(van, seatB.key, { role: 'driver' })).toBe(false);
    expect(await crew.setSeat(van, seatB.key, { role: 'prisoner' })).toBe(false);
    expect(await crew.setSeat(van, seatA.key, { role: 'passenger' })).toBe(true);
    expect(await crew.setSeat(van, seatB.key, { role: 'driver' })).toBe(true);
    expect(await crew.setSeat(van, seatB.key, { firepoint: true })).toBe(false);
    expect(await crew.setSeat(van, seatA.key, { firepoint: false })).toBe(true);
    expect(await crew.setSeat(van, seatB.key, { firepoint: true })).toBe(true);
    expect(crew.crewEntries(van).map(e => [e.name, e.role, e.firepoint])).toEqual([['A', 'passenger', false], ['B', 'driver', true]]);
  });
});

describe('Rolling from inside', () => {
  const effect = (owner, weapon) => {
    const item = makeItem({ type: 'weaponEffect', flags: { essence20: { parentId: weapon?.id } } });
    item.parent = owner;
    return item;
  };

  test("its Integrated Hardpoint weapons are offered to the crew (not prisoners); an External one isn't", async () => {
    const integrated = makeItem({ type: 'weapon', system: { hardpoint: { type: 'integrated' }, equipped: true } });
    const external = makeItem({ type: 'weapon', system: { hardpoint: { type: 'external' }, equipped: true } });
    const van = transformer(4, 0, [integrated, external, packItem(FILES.cage)]);
    await crew.board(van, makeActor([], { name: 'Gunner' }));
    await crew.board(van, makeActor([], { name: 'Captive' }), { role: 'prisoner' });
    expect(crew.isIntegratedAttack(van, effect(van, integrated))).toBe(true);
    expect(crew.isIntegratedAttack(van, effect(van, external))).toBe(false);
    expect(crew.crewRollerChoices(van).map(choice => choice.label)).toEqual(['Gunner']);
  });

  test('own weapons need a Firepoint and take a Snag; a prisoner fires nothing', async () => {
    const van = transformer(4, 1, [packItem(FILES.cage)]);
    const [gunner, rider, captive] = ['Gunner', 'Rider', 'Captive'].map(name => makeActor([], { name }));
    await crew.board(van, gunner);
    await crew.board(van, rider);
    await crew.board(van, captive, { role: 'prisoner' });
    const own = actor => effect(actor, makeItem({ type: 'weapon' }));

    const ok = {};
    await runPreRoll(gunner, ok, own(gunner));
    expect(ok.cancelRoll).toBeUndefined();
    const refused = {};
    await runPreRoll(rider, refused, own(rider));
    expect(refused.cancelRoll).toBe(true);
    const caged = {};
    await runPreRoll(captive, caged, own(captive));
    expect(caged.cancelRoll).toBe(true);

    const sources = extRollSources(gunner, null, { isAttack: true, item: own(gunner) }).sources;
    expect(sources).toEqual([expect.objectContaining({ id: 'ext-altModeFirepoint', snag: true })]);
    // The Transformer's own weapon, fired by a gunner: no Snag.
    const integrated = makeItem({ type: 'weapon', system: { hardpoint: { type: 'integrated' } } });
    expect(extRollSources(gunner, null, { isAttack: true, item: effect(van, integrated) }).sources).toEqual([]);
  });
});

describe('The Driver', () => {
  test('Lends Assistance on Driving with any rank (a Standard action in a fight); nobody else, and not untrained', async () => {
    const van = transformer(4);
    const [driver, rider] = ['Driver', 'Rider'].map(name => makeActor([], { name }));
    await crew.board(van, driver, { role: 'driver' });
    await crew.board(van, rider);
    expect(await crew.assistDriving(rider)).toBe(false);
    expect(await crew.assistDriving(driver)).toBe(false);
    expect(warned()).toContain('DriverUntrained');
    ranks.set('Driver:driving', 1);
    game.combat = { started: true };
    expect(await crew.assistDriving(driver)).toBe(true);
    expect(spend).toHaveBeenCalledWith(driver, 'standard', expect.anything());
    expect(assistSkill).toHaveBeenCalledWith(driver, van, 'driving');
    expect(crew.driverAssistBypass(driver, van, 'driving')).toBe(true);
    expect(crew.driverAssistBypass(driver, van, 'athletics')).toBe(false);
    expect(crew.driverAssistBypass(rider, van, 'driving')).toBe(false);
  });
});

describe('The passengers scope (Emergency Care / Vehicle Repair Equipment)', () => {
  test('passengers have an Edge treating each other while it is in Alt Mode', async () => {
    const van = transformer(4, 0, [packItem(FILES.care), packItem(FILES.repair)]);
    const [medic, patient, outsider] = ['Medic', 'Patient', 'Outsider'].map(name => makeActor([], { name }));
    await crew.board(van, medic);
    await crew.board(van, patient);
    const medicine = { rolledSkill: 'science', dataset: { specializationKey: 'medicine' } };
    const labels = (actor, target, ctx) => ruleRollSources(actor, target, ctx).sources.filter(s => s.edge).map(s => s.label);
    expect(labels(medic, patient, medicine)).toEqual(['Emergency Care Equipment (Edge treating a fellow passenger)']);
    expect(labels(medic, null, medicine)).toHaveLength(1);
    expect(labels(medic, outsider, medicine)).toEqual([]);
    expect(labels(outsider, patient, medicine)).toEqual([]);
    // Wounded Cybertronian passengers only, for Vehicle Repair Equipment.
    const repair = { rolledSkill: 'technology', dataset: { specializationKey: 'repair' } };
    expect(labels(medic, patient, repair)).toEqual([]);
    van.system.isTransformed = false;
    expect(labels(medic, patient, medicine)).toEqual([]);
  });

  test('tags', async () => {
    const van = transformer(4);
    const rider = makeActor([], { name: 'Rider' });
    await crew.board(van, rider);
    const { evaluate, contextFor } = await import('../../rules/predicate.mjs');
    expect(evaluate(['self:inAltModeCrew'], contextFor({ self: rider }))).toBe(true);
    expect(evaluate(['self:aboardHolder'], contextFor({ self: rider, holder: van }))).toBe(true);
    expect(evaluate(['target:aboardHolder'], contextFor({ self: van, holder: van, other: rider }))).toBe(true);
    expect(evaluate(['target:aboardHolderOrNone'], contextFor({ self: van, holder: van }))).toBe(true);
    expect(evaluate(['self:inAltModeCrew'], contextFor({ self: van }))).toBe(false);
  });
});

describe('Tokens (the active GM)', () => {
  function sceneWith(tokens) {
    const scene = {
      grid: { size: 100 }, tokens,
      updateEmbeddedDocuments: jest.fn(async (type, updates) => {
        for (const update of updates) {
          const token = tokens.find(t => t.id == update._id);
          for (const [key, value] of Object.entries(update)) {
            if (key != '_id') {
              setPath(token, key, value);
            }
          }
        }
      }),
    };
    tokens.forEach(token => (token.parent = scene));
    return scene;
  }

  const tokenFor = (actor, x, y, size = 1) => {
    const token = { id: `t${nextId++}`, x, y, width: size, height: size, hidden: false, flags: {}, actor, _source: {} };
    actor.getActiveTokens = () => [token];
    return token;
  };

  test('aboard: hidden and centred on the Transformer, carried along when it moves; out: shown beside it', async () => {
    const van = transformer(4);
    const rider = makeActor([], { name: 'Rider' });
    const vanToken = tokenFor(van, 0, 0, 3);
    const riderToken = tokenFor(rider, 500, 500);
    const scene = sceneWith([vanToken, riderToken]);
    await crew.board(van, rider);
    await crew.syncCrewTokens(van, scene);
    expect(riderToken).toMatchObject({ hidden: true, x: 100, y: 100, flags: { essence20: { ridingIn: van.uuid } } });
    expect(scene.updateEmbeddedDocuments).toHaveBeenLastCalledWith('Token', expect.anything(), expect.objectContaining({ movement: { [riderToken.id]: expect.anything() } }));

    vanToken.x = 1000;
    await crew.followCarrier(vanToken);
    expect([riderToken.x, riderToken.y]).toEqual([1100, 100]);

    await crew.disembark(van, rider);
    await crew.syncCrewTokens(van, scene);
    expect(riderToken).toMatchObject({ hidden: false, x: 1200, y: 0 });
    expect(riderToken.flags.essence20.ridingIn).toBeUndefined();
  });

  test('nothing happens away from the active GM', async () => {
    game.users.activeGM.isSelf = false;
    const van = transformer(4);
    const scene = sceneWith([tokenFor(van, 0, 0)]);
    await crew.syncCrewTokens(van, scene);
    expect(scene.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test('tokensAdjacent: edge to edge or diagonal, from the stored size', () => {
    expect(crew.tokensAdjacent({ x: 0, y: 0, width: 2, height: 1 }, { x: 200, y: 0, width: 1, height: 1 })).toBe(true);
    expect(crew.tokensAdjacent({ x: 0, y: 0, width: 2, height: 1 }, { x: 200, y: 100, width: 1, height: 1 })).toBe(true);
    expect(crew.tokensAdjacent({ x: 0, y: 0, width: 2, height: 1 }, { x: 300, y: 0, width: 1, height: 1 })).toBe(false);
    expect(crew.tokensAdjacent({ x: 0, y: 0, width: 1, height: 1, _source: { x: 0, y: 0, width: 3, height: 1 } }, { x: 300, y: 0, width: 1, height: 1 })).toBe(true);
  });

  test('ridePosition centres the smaller token', () => {
    expect(crew.ridePosition({ x: 0, y: 0, width: 2, height: 1 }, { width: 1, height: 1 })).toEqual({ x: 50, y: 0 });
  });

  test("ridePosition goes by where a moving token is going, not its animated spot", () => {
    expect(crew.ridePosition({ x: 0, y: 0, width: 2, height: 1, _source: { x: 300, y: 100 } }, { width: 1, height: 1 })).toEqual({ x: 350, y: 100 });
  });
});

describe('Sheets', () => {
  test("the Crew panel's numbers and rows, and the rider's header line", async () => {
    const van = transformer(4, 2, [packItem(FILES.cage)]);
    const driver = makeActor([], { name: 'Driver' });
    await crew.board(van, driver, { role: 'driver' });
    const panel = crew.crewSheetContext(van);
    expect(panel).toMatchObject({ transformed: true, capacity: 4, firepoints: 2, firepointsUsed: 1, prisoners: 0, prisonerLimit: 4, canImprison: true });
    expect(panel.members[0].roles.map(role => role.value)).toEqual(['driver', 'passenger', 'prisoner']);
    expect(crew.crewSheetContext(makeActor())).toBeNull();
    expect(crew.aboardSheetContext(driver)).toMatchObject({ carrierName: 'Ironhide', isDriver: true, isPrisoner: false, firepoint: true });
    expect(crew.aboardSheetContext(makeActor())).toBeNull();
  });

  test('Board targets puts every targeted creature aboard', async () => {
    const van = transformer(4);
    const [a, b] = ['A', 'B'].map(name => makeActor([], { name }));
    expect(await crew.boardTargets(van)).toBe(0);
    game.user.targets = new Set([{ actor: a }, { actor: b }, { actor: van }]);
    expect(await crew.boardTargets(van)).toBe(2);
  });
});
