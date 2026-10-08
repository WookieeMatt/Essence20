import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, follow-ups round 2 (docs/rules-batches/book-followups2.md): Growing Smolder's Fire damage, Beast Morpher's
 * "until the end of your turn" (applyCondition until: endOfTurn), Electronic Countermeasures counted on the crew
 * member (untilOf: user), Deconstructionist's Computerized requirement, Snarl's "for 1 turn". (dice.mjs's Blinding /
 * Deafened riders: dice.test.js. Old tests updated in place: book-followups, book-effects, conv14-items1.)
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const dealt = [];
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type, isCrit, options) => dealt.push({ name: actor.name, amount, type, options })),
}));
// pick steps answer from `values` (a select's value).
let values = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  chooseSelect: jest.fn(async () => values.shift() ?? null),
  chooseButtons: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const undone = [];
jest.unstable_mockModule('./sheet-handlers/alteration-handler.mjs', () => ({
  onAlterationDelete: jest.fn(async (actor, alteration) => undone.push(alteration.name)),
  onAlterationDrop: jest.fn(),
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { ruleRollSources, ruleScaledDamage } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { toggleOf } = await import('./predicate.mjs');
const { bankedSources } = await import('./bank.mjs');
const { turnBoundTiming } = await import('../mechanics/combat/timed-status.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { pickOptions } = await import('./steps.mjs');
const { usingCrewMember } = await import('./plugins/book/followups2.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  smolder: 'fmmcitems/_source/Growing_Smolder_4XblFV97cS63ueDM.json',
  beast: 'bthitems/_source/Beast_Morpher__Form__8FGJyvGaCOd8hrSA.json',
  ecm: 'qgtgitems/_source/Electronic_Countermeasures_oTPW1JHgRPwmZtr8.json',
  decon: 'qgtgitems/_source/Deconstructionist_2qb5dV11qvWsN4xJ.json',
  snarl: 'fffav1items/_source/Snarl_786NTb2bQyHZ7qfg.json',
};

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (/\.-=/.test(key)) {
      const [path, gone] = key.split('.-=');
      delete getPath(doc, path)?.[gone];
      continue;
    }

    setPath(doc, key, value);
  }

  rebuildIndex(doc.documentName == 'Actor' ? doc : doc.parent);
}

/** An item from a pack source file (its own rules), with its compendium id as its source. */
function packItem(key, extra = {}) {
  const doc = fromPack(P[key]);
  return {
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)), ...extra,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  };
}

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, type = 'playerCharacter' } = {}) {
  const list = [];
  const effects = [];
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects,
    system: {
      level: 5, size: 'common', health: { value: 8, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
      defenses: { toughness: { total: 12, value: 12 }, evasion: { total: 12, value: 12 }, willpower: { total: 12 }, cleverness: { total: 12 } },
      resistances: {}, immunities: {}, ...system,
    },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    // A Condition is an effect on the actor, as in Foundry.
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
        const effect = { id: `e${nextId++}`, statuses: new Set([status]), flags: {}, async update(data) {
          await applyUpdate(this, data);
        } };
        effects.push(effect);
      } else {
        this.statuses.delete(status);
      }
    }),
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      const from = kind == 'ActiveEffect' ? effects : list;
      for (const id of ids) {
        const at = from.findIndex(doc => doc.id == id);
        if (at >= 0) {
          const [doc] = from.splice(at, 1);
          doc.statuses?.forEach(status => this.statuses.delete(status));
        }
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  actor.items = {
    contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), some: fn => list.some(fn), filter: fn => list.filter(fn),
    [Symbol.iterator]: () => list[Symbol.iterator](),
  };
  actor.addItem = data => {
    const item = { effects: [], ...data, id: `i${nextId++}`, async update(changes) {
      await applyUpdate(this, changes);
    } };
    item.uuid = `${actor.uuid}.Item.${item.id}`;
    item.flags ??= {};
    item.flags.essence20 ??= {};
    item.parent = item.actor = actor;
    list.push(item);
    rebuildIndex(actor);
    return item;
  };

  items.forEach(data => actor.addItem(data));
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
/** A weapon and one attack of it on the actor. */
function weaponWith(actor, name, attack = {}) {
  const weapon = actor.addItem({ name, type: 'weapon', system: { equipped: true, traits: [] } });
  const effect = actor.addItem({ name: `${name} attack`, type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } },
    system: { classification: { skill: 'might', style: 'melee' }, damageValue: 1, damageType: 'blunt', totalReach: 5, ...attack } });
  return { weapon, effect };
}

let picks = [];
const paid = [];
const pay = jest.fn(async action => paid.push(action) > 0);
const use = item => runUse(item, pay, { ask: async () => picks.shift() ?? 0 });
// A running combat whose turn order is `actors`, each combatant with an id (turnBoundTiming needs it).
const startCombat = (round = 1, turn = 0, actors = []) => {
  const turns = actors.map((actor, index) => ({ id: `cb${index}`, actor, actorId: actor.id }));
  game.combat = { id: 'c1', started: true, round, turn, turns, combatants: turns };
  game.combats = { get: id => (id == 'c1' ? game.combat : null) };
};

beforeEach(() => {
  dealt.length = 0;
  paid.length = 0;
  undone.length = 0;
  picks = [];
  values = [];
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: (k, d) => `${k}${d ? ` ${JSON.stringify(d)}` : ''}`, has: () => false },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], get: id => game.actors.contents.find(a => a.id == id) },
    scenes: { active: null }, time: { worldTime: 0 },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = { E20: { damageTypes: { blunt: 'Blunt', void: 'Void' }, skillToEssence: { technology: 'smarts' }, skills: {}, actorSizes: { small: 's', common: 'c', large: 'l' } } };
  global.canvas = { scene: null, tokens: { placeables: [], controlled: [], setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    utils: { getProperty: getPath, setProperty: setPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), prompt: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('every rule on the checked items validates', () => {
  for (const [key, file] of Object.entries(P)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([key, rule.label, validateRule(rule)]).toEqual([key, rule.label, []]);
    }
  }
});

describe('Growing Smolder: the extra damage is Fire (Finster\'s p.288)', () => {
  const smolderer = () => {
    const monster = makeActor('Monster', { items: [packItem('smolder')] });
    const { effect } = weaponWith(monster, 'Talons');
    return { monster, effect, perk: itemNamed(monster, 'Growing Smolder') };
  };

  // The hit's chat-card result after the hit riders ran.
  const hitWith = (monster, effect) => {
    const foe = makeActor('Foe', { type: 'npc', disposition: -1 });
    const result = { damageValue: 1, damageType: 'sharp' };
    hitRiderOnAttack(monster, foe, result, { itemUuid: effect.uuid, skill: 'might', style: 'melee' }, { damageBonusNote: () => {} });
    return result;
  };

  test('on the next turn each hit offers a separate Fire Apply button, not untyped bonus damage', async () => {
    const { monster, effect, perk } = smolderer();
    startCombat(1, 0, [monster]);
    await use(perk);
    expect(paid).toEqual(['free']);
    // This turn (still waiting): nothing.
    expect(hitWith(monster, effect).riderOptions ?? []).toEqual([]);
    game.combat.round = 2;
    const result = hitWith(monster, effect);
    expect(result.riderOptions).toEqual([expect.objectContaining({ damageValue: 1, damageType: 'fire', label: 'Growing Smolder' })]);
    // The weapon's own hit keeps its type and value.
    expect([result.damageValue, result.damageType]).toEqual([1, 'sharp']);
    expect(ruleScaledDamage(monster, null, { item: effect }).amount).toBe(0);
    game.combat.round = 3;
    expect(hitWith(monster, effect).riderOptions ?? []).toEqual([]);
  });

  test('cumulative: used on two turns in a row, 2 Fire (and ↑2) the turn after; never more than 3', async () => {
    const { monster, effect, perk } = smolderer();
    startCombat(1, 0, [monster]);
    await use(perk);
    game.combat.round = 2;
    await use(perk);
    game.combat.round = 3;
    expect(hitWith(monster, effect).riderOptions[0]).toMatchObject({ damageValue: 2, damageType: 'fire' });
    const shift = ruleRollSources(monster, null, { item: effect, dataset: {} }).sources.filter(s => s.label?.startsWith('Growing Smolder'));
    expect(shift.reduce((n, s) => n + (Number(s.shiftUp) || 0), 0)).toBe(2);
    for (const round of [3, 4, 5]) {
      game.combat.round = round;
      await use(perk);
    }

    game.combat.round = 6;
    expect(hitWith(monster, effect).riderOptions[0]).toMatchObject({ damageValue: 3, damageType: 'fire' });
  });
});

describe('applyCondition until: endOfTurn - "until the end of your turn" (Beast Morpher\'s dog, BTH p.54)', () => {
  test('the dog Hang-Up Stuns until the end of the turn', () => {
    const steps = fromPack(P.beast).system.rules.find(rule => rule.label == 'A dog appears (Hang-Up)').steps;
    expect(steps.find(step => step.do == 'applyCondition')).toEqual({ do: 'applyCondition', condition: 'stunned', until: 'endOfTurn', when: ['var:dog<10'] });
  });

  test('timing: its own turn now - this turn\'s end; not acted yet - its coming turn; already acted - next round\'s', () => {
    const [a, b, c] = [makeActor('A'), makeActor('B'), makeActor('C')];
    startCombat(1, 1, [a, b, c]);
    expect(turnBoundTiming('endOfTurn', b)).toEqual({ value: 0, expiry: 'turnEnd', combatantId: 'cb1' });
    expect(turnBoundTiming('endOfTurn', c)).toEqual({ value: 0, expiry: 'turnEnd', combatantId: 'cb2' });
    expect(turnBoundTiming('endOfTurn', a)).toEqual({ value: 1, expiry: 'turnEnd', combatantId: 'cb0' });
    // endOfNextTurn on the acting creature is still next round's (unchanged).
    expect(turnBoundTiming('endOfNextTurn', b)).toEqual({ value: 1, expiry: 'turnEnd', combatantId: 'cb1' });
  });

  test('the step stamps the v14 effect expiry on the holder\'s current turn', async () => {
    const ranger = makeActor('Ranger', { items: [{ name: 'Dog test', type: 'perk', system: { rules: [{ type: 'Use', steps: [{ do: 'applyCondition', condition: 'stunned', until: 'endOfTurn' }] }] } }] });
    startCombat(2, 0, [ranger, makeActor('Other')]);
    await use(itemNamed(ranger, 'Dog test'));
    expect(ranger.statuses.has('stunned')).toBe(true);
    expect(ranger.effects[0].duration).toEqual(expect.objectContaining({ value: 0, expiry: 'turnEnd' }));
    expect(ranger.effects[0].start).toEqual(expect.objectContaining({ combatant: 'cb0' }));
  });
});

describe('Electronic Countermeasures: until the start of the using crew member\'s next turn (QGtG p.59)', () => {
  const crewed = () => {
    const driver = makeActor('Driver');
    const gunner = makeActor('Gunner');
    const tank = makeActor('Tank', { type: 'vehicle', items: [packItem('ecm')], system: { actors: { d: { uuid: driver.uuid }, g: { uuid: gunner.uuid } } } });
    return { driver, gunner, tank, ecm: itemNamed(tank, 'Electronic Countermeasures') };
  };

  test('usingCrewMember: the seated crew member acting now, else this user\'s character aboard, else one this player owns', () => {
    const { driver, gunner, tank } = crewed();
    const enemy = makeActor('Enemy');
    startCombat(1, 1, [driver, gunner, enemy]);
    expect(usingCrewMember(tank)).toBe(gunner);
    game.combat.turn = 2;
    expect(usingCrewMember(tank, { user: { isGM: true, character: driver } })).toBe(driver);
    expect(usingCrewMember(tank, { user: { isGM: false, character: null } })).toBe(driver);
    expect(usingCrewMember(tank, { user: { isGM: true, character: null } })).toBeNull();
    expect(usingCrewMember(enemy)).toBeNull();
  });

  test('used for the driver while another creature acts: ends as the DRIVER\'s next turn starts, not a round later', async () => {
    const { driver, tank, ecm } = crewed();
    const enemy = makeActor('Enemy');
    // Turn order: driver, enemy; the enemy is acting (the driver's Move action came from a Contingency).
    startCombat(1, 1, [driver, enemy]);
    game.user.isGM = false;
    game.user.character = driver;
    await use(ecm);
    expect(paid).toEqual(['move']);
    expect(toggleOf(ecm, 'ecm')).toBe(true);
    expect(ecm.flags.essence20.rules.toggleUntil.ecm).toEqual(expect.objectContaining({ until: 'nextTurn' }));
    expect(ecm.flags.essence20.rules.toggleUntil.ecm.stamp.holderTurn).toBe(0);
    game.combat.round = 2;
    game.combat.turn = 0;
    expect(toggleOf(ecm, 'ecm')).toBe(false);
    expect(tank).toBeTruthy();
  });

  test('used on the driver\'s own turn: on through the round, off as that turn comes round again', async () => {
    const { driver, gunner, ecm } = crewed();
    startCombat(1, 0, [driver, gunner]);
    await use(ecm);
    game.combat.turn = 1;
    expect(toggleOf(ecm, 'ecm')).toBe(true);
    game.combat.round = 2;
    game.combat.turn = 0;
    expect(toggleOf(ecm, 'ecm')).toBe(false);
  });
});

describe('Deconstructionist: only Computerized equipment (QGtG p.28)', () => {
  const hitOn = (tech, foe) => fireTriggers(tech, 'hit', { roll: { rolledSkill: 'technology', switches: ['deconstructionist'] }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
  const snagged = (actor, roll) => bankedSources(actor, null, roll).sources.some(source => source.snag);

  test('a vehicle without the Computerized trait is unaffected (a chat line says so); a Computerized one takes the Snag', async () => {
    const tech = makeActor('Tech', { items: [packItem('decon')] });
    const jeep = makeActor('Jeep', { type: 'vehicle', disposition: -1, system: { traits: { computerized: false } } });
    const tank = makeActor('Tank', { type: 'vehicle', disposition: -1, system: { traits: { computerized: true } } });
    startCombat(1, 0, [tech, jeep, tank]);
    await hitOn(tech, jeep);
    expect(snagged(jeep, { rolledSkill: 'driving' })).toBe(false);
    expect(JSON.stringify(ChatMessage.create.mock.calls)).toMatch(/Jeep isn.{1,6}t Computerized/);
    await hitOn(tech, tank);
    expect(snagged(tank, { rolledSkill: 'driving' })).toBe(true);
  });

  test('a Zord carries no traits: still affected (book silent)', async () => {
    const tech = makeActor('Tech', { items: [packItem('decon')] });
    const zord = makeActor('Zord', { type: 'zord', disposition: -1 });
    startCombat(1, 0, [tech, zord]);
    await hitOn(tech, zord);
    expect(snagged(zord, { rolledSkill: 'athletics' })).toBe(true);
  });

  test('against a creature: only its Computerized items (own trait or an upgrade\'s) are offered; none - nothing to pick', async () => {
    const tech = makeActor('Tech', { items: [packItem('decon')] });
    const trooper = makeActor('Trooper', { type: 'npc', disposition: -1 });
    const rifle = weaponWith(trooper, 'Rifle');
    rifle.weapon.system.traits = ['computerized'];
    const scope = weaponWith(trooper, 'Scoped Gun');
    scope.weapon.system.itemAndUpgradeTraits = ['computerized'];
    weaponWith(trooper, 'Knife');
    trooper.addItem({ name: 'Rope', type: 'gear', system: {} });
    const step = fromPack(P.decon).system.rules.find(rule => rule.type == 'Trigger').steps.find(s => s.do == 'pick');
    const ctx = { actor: tech, item: itemNamed(tech, 'Deconstructionist'), targets: [trooper], vars: {}, chat: [] };
    expect(pickOptions(step, ctx).map(option => option.label)).toEqual(['Rifle', 'Scoped Gun']);

    const grunt = makeActor('Grunt', { type: 'npc', disposition: -1 });
    weaponWith(grunt, 'Club');
    startCombat(1, 0, [tech, grunt]);
    await hitOn(tech, grunt);
    expect(snagged(grunt, { rolledSkill: 'might' })).toBe(false);
  });
});

test('Snarl: "Frightened of you for 1 turn" - until the end of the target\'s next turn (FiA V1 p.37)', async () => {
  const tiger = makeActor('Tiger', { items: [packItem('snarl')] });
  const foe = makeActor('Foe', { type: 'npc', disposition: -1 });
  startCombat(1, 0, [tiger, foe]);
  await fireTriggers(tiger, 'hit', { roll: { rolledSkill: 'intimidation' }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
  expect(foe.statuses.has('frightened')).toBe(true);
  expect(foe.effects[0].duration).toEqual(expect.objectContaining({ value: 0, expiry: 'turnEnd' }));
  expect(foe.effects[0].start).toEqual(expect.objectContaining({ combatant: 'cb1' }));
});
