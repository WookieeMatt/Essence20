import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDefenseAdjust, ruleRequisitionAccess, ruleRollSources } from './adapter.mjs';
import { registerCheck, setWorldLookups } from './predicate.mjs';
import { fireTriggers, runUse, useAvailable, useRulesOf } from './triggers.mjs';
import { TF1, favoriteWeaponOf } from '../items/shared/condition-damage-buttons.mjs';

/**
 * Slice round 7, part slB7 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-7 engine pieces (roll:targets, host: at roll time, self:actionUsed,
 * item:word, item:hasAttack) and the earlier ones (mark counters with exclusive, outgoing Defense,
 * step `when`, table / require gates before the cost). Each item is loaded from its pack source and
 * must do what the removed code (and its tests) did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let epoch = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);

const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

const deletePath = (object, key) => {
  const keys = key.split('.');
  const last = keys.pop().replace(/^-=/, '');
  delete keys.reduce((o, k) => o?.[k], object)?.[last];
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.split('.').pop().startsWith('-=')) {
      deletePath(doc, key);
    } else {
      setPath(doc, key, value);
    }
  }
}

/** An item object (a pack item's data, or a plain one). */
function makeItem(data) {
  return {
    flags: {}, system: {}, ...data,
    async update(changes) {
      await applyUpdate(this, changes);
    },
  };
}

/** An actor holding these pack items (and these plain items). */
function holder(files = [], { system = {}, disposition = 1, name = 'Hero', type = 'playerCharacter', items: extra = [], flags = {} } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    toggleStatusEffect: jest.fn(async () => {}),
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async setFlag(scope, key, value) {
      (this.flags[scope] ??= {})[key] = value;
    },
    async unsetFlag(scope, key) {
      delete this.flags[scope]?.[key];
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = [
    ...files.map((file, i) => {
      const doc = fromPack(file);
      return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system, flags: foundry.utils.deepClone(flags[i] ?? {}) });
    }),
    ...extra.map(data => makeItem(data)),
  ];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  game.actors.contents.push(actor);
  return actor;
}

/** Target these actors' tokens. */
function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
}

/** A started combat with these actors in this turn order. */
function combat(actors, { id = 'c1', round = 1, turn = 0, started = true } = {}) {
  const turns = actors.map(actor => ({ actor, actorId: actor.id }));
  game.combat = { id, started, round, turn, turns, combatants: { contents: turns }, combatant: turns[turn] ?? null };
  return game.combat;
}

function advance(round, turn) {
  game.combat.round = round;
  game.combat.turn = turn;
  game.combat.combatant = game.combat.turns[turn] ?? null;
}

const pay = () => jest.fn(async () => true);
const available = item => useRulesOf(item).some(({ rule, index }) => useAvailable(item, rule, index));
const sourcesOf = (actor, other, ctx = {}) => ruleRollSources(actor, other, { rolledSkill: 'athletics', ...ctx }).sources;

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: false, targets: new Set() }, users: { activeGM: null },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => epoch }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: { might: 'strength', targeting: 'speed', athletics: 'strength', intimidation: 'social' } } };
  global.canvas = undefined;
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = undefined;
  global.fromUuidSync = undefined;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: getPath,
      setProperty: setPath,
      hasProperty: (object, key) => getPath(object, key) !== undefined,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      escapeHTML: text => String(text),
      randomID: () => `r${nextId++}`,
    },
    applications: {
      ...(global.foundry?.applications ?? {}),
      api: {
        ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {},
        DialogV2: { wait: jest.fn(async () => null) },
      },
    },
  };
  setWorldLookups({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* -------------------------------------------- */
/*  Fearsome Additions                           */
/* -------------------------------------------- */

describe('Fearsome Additions', () => {
  const FILE = 'dditems/_source/Fearsome_Additions_jh4FiaiLPb40jqkv.json';
  const attack = (name, system = {}) => ({ id: `e${nextId++}`, type: 'weaponEffect', name, system, flags: {} });

  test('Alt Mode: ↑1 on Ram, Flyby and Slam attacks (whole words); Bot Mode: ↑1 on Intimidation only', () => {
    const bot = holder([FILE], { system: { isTransformed: false } });
    const alt = holder([FILE], { system: { isTransformed: true } });
    const ram = attack('Charge', { isRam: true });
    expect(sourcesOf(bot, null, { item: ram, rolledSkill: 'might' })).toEqual([]);
    expect(sourcesOf(alt, null, { item: ram, rolledSkill: 'might' })).toEqual([expect.objectContaining({ label: 'Fearsome Additions', shiftUp: 1 })]);
    for (const hit of [attack('Dive', { isFlyby: true }), attack('Slam'), attack('Heavy Ram'), attack('Flyby Strike')]) {
      expect(sourcesOf(alt, null, { item: hit, rolledSkill: 'might' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    }

    expect(sourcesOf(alt, null, { item: attack('Slammer'), rolledSkill: 'might' })).toEqual([]);
    expect(sourcesOf(alt, null, { item: attack('Blaster'), rolledSkill: 'targeting' })).toEqual([]);
    // Not a weapon effect: nothing.
    expect(sourcesOf(alt, null, { item: { type: 'spell', name: 'Ram', system: {}, flags: {} } })).toEqual([]);
    // The Bot Mode half is unchanged.
    expect(sourcesOf(bot, null, { rolledSkill: 'intimidation' })).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(sourcesOf(alt, null, { rolledSkill: 'intimidation' })).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Steady Firepower                             */
/* -------------------------------------------- */

describe('Steady Firepower', () => {
  const FILE = 'dditems/_source/Steady_Firepower_svqVyP2tyYzSUtn6.json';

  beforeEach(() => {
    // essence20.mjs registers the real one; the same body here.
    registerCheck('favoriteWeaponRolled', (actor, option, ctx) => {
      const weapon = favoriteWeaponOf(actor);
      return !!weapon && !!ctx?.item && (ctx.item.id == weapon.id || ctx.item.flags?.essence20?.parentId == weapon.id);
    });
  });

  function setup() {
    const items = [
      { id: 'w1', name: 'Favorite Rifle', type: 'weapon', system: {} },
      { id: 'e1', name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'w1' } } },
      { id: 'w2', name: 'Pistol', type: 'weapon', system: {} },
      { id: 'e2', name: 'Pistol Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'w2' } } },
      { id: 'e3', name: 'Punch', type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: {} },
      { id: 'fw', name: 'Favorite Weapon', type: 'perk', system: { choice: 'w1' }, flags: { core: { sourceId: TF1.favoriteWeapon } } },
    ];
    const quake = holder([FILE], { items });
    const foe = holder([], { name: 'Foe', disposition: -1 });
    const other = holder([], { name: 'Other', disposition: -1 });
    const effect = id => quake.items.get(id);
    const attack = async (id, targets) => {
      target(...targets);
      await fireTriggers(quake, 'afterRoll', {
        roll: { item: effect(id), isAttack: true, isMelee: id == 'e3', targetCount: targets.length },
        outcome: 'success', facts: { results: [{ success: true }] }, vars: { targets: targets.length },
      });
    };

    const defense = (defender, id = 'e1') => ruleDefenseAdjust(quake, defender, 'evasion', { item: effect(id) });
    return { quake, foe, other, attack, defense };
  }

  test('each further favorite-weapon attack on the same target lowers its Defense by one more', async () => {
    const { quake, foe, other, attack, defense } = setup();
    expect(defense(foe)).toBe(0);
    await attack('e1', [foe]);
    expect(defense(foe)).toBe(-1);
    await attack('e1', [foe]);
    expect(defense(foe)).toBe(-2);
    // Any Defense.
    expect(ruleDefenseAdjust(quake, foe, 'willpower', { item: quake.items.get('e1') })).toBe(-2);
    // Another target, another weapon's attack against it, or another attacker: nothing.
    expect(defense(other)).toBe(0);
    expect(defense(foe, 'e2')).toBe(0);
    expect(ruleDefenseAdjust(holder([]), foe, 'evasion', { item: quake.items.get('e1') })).toBe(0);
  });

  test('another weapon, or 0 / 2+ targets, starts the count over; an unarmed attack leaves it', async () => {
    const { foe, other, attack, defense } = setup();
    await attack('e1', [foe]);
    await attack('e1', [foe]);
    await attack('e3', [foe]);
    expect(defense(foe)).toBe(-2);
    await attack('e2', [foe]);
    expect(defense(foe)).toBe(0);
    expect(foe.flags.essence20.ruleMarks?.steadyFire).toBeUndefined();

    await attack('e1', [foe]);
    await attack('e1', [foe, other]);
    expect(defense(foe)).toBe(0);
    await attack('e1', [foe]);
    await attack('e1', []);
    expect(defense(foe)).toBe(0);
  });

  test('switching targets moves the count; it lasts the scene', async () => {
    const { foe, other, attack, defense } = setup();
    await attack('e1', [foe]);
    await attack('e1', [foe]);
    await attack('e1', [other]);
    expect(defense(foe)).toBe(0);
    expect(defense(other)).toBe(-1);
    epoch = 2;
    expect(defense(other)).toBe(0);
    await attack('e1', [other]);
    expect(defense(other)).toBe(-1);
  });
});

/* -------------------------------------------- */
/*  Gunport                                      */
/* -------------------------------------------- */

describe('Gunport', () => {
  const FILE = 'iafav2items/_source/Gunport_yY8abFMBS4JF9VYA.json';

  function setup({ host = { id: 's', name: 'Riot Shield', type: 'shield', system: { equipped: true, active: false } }, ports = 1, size = 'sidearm' } = {}) {
    const items = [
      host,
      { id: 'p', name: 'Pistol', type: 'weapon', system: { classification: { size } } },
      { id: 'ps', name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'p' } } },
      { id: 'pw', name: 'Pistol Whip', type: 'weaponEffect', system: { classification: { style: 'melee' } }, flags: { essence20: { parentId: 'p' } } },
    ];
    const files = Array.from({ length: ports }, () => FILE);
    const flags = files.map(() => ({ essence20: { parentId: host.id } }));
    const actor = holder(files, { items, flags });
    return { actor, shield: actor.items.get(host.id), shot: actor.items.get('ps'), whip: actor.items.get('pw') };
  }

  test('↓1 on sidearm ranged attacks only while the equipped shield it is fitted to is active', () => {
    const { actor, shield, shot, whip } = setup();
    expect(sourcesOf(actor, null, { item: shot })).toEqual([]);
    shield.system.active = true;
    expect(sourcesOf(actor, null, { item: shot })).toEqual([expect.objectContaining({ label: 'Gunport', shiftDown: 1 })]);
    expect(sourcesOf(actor, null, { item: whip })).toEqual([]);
    expect(sourcesOf(actor, null, { rolledSkill: 'athletics' })).toEqual([]);
    shield.system.equipped = false;
    rebuildIndex(actor);
    expect(sourcesOf(actor, null, { item: shot })).toEqual([]);
  });

  test('not a sidearm: nothing; two Gunports still one ↓1', () => {
    const rifle = setup({ size: 'long' });
    rifle.shield.system.active = true;
    expect(sourcesOf(rifle.actor, null, { item: rifle.shot })).toEqual([]);
    const two = setup({ ports: 2 });
    two.shield.system.active = true;
    expect(sourcesOf(two.actor, null, { item: two.shot })).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  });

  test('battledress with the Shield trait counts while equipped (no active switch needed); without it, not', () => {
    const traited = setup({ host: { id: 'b', name: 'Battledress', type: 'armor', system: { equipped: true, traits: ['shield'] } } });
    expect(sourcesOf(traited.actor, null, { item: traited.shot })).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    const plain = setup({ host: { id: 'b', name: 'Battledress', type: 'armor', system: { equipped: true, traits: [] } } });
    expect(sourcesOf(plain.actor, null, { item: plain.shot })).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Duke It Out                                  */
/* -------------------------------------------- */

describe('Duke It Out', () => {
  const FILE = 'tfcrbitems/_source/Duke_It_Out_jkuNDvRt4D9jyDsn.json';
  const answer = value => foundry.applications.api.DialogV2.wait.mockImplementation(async () => value);

  test('refused: Edge on the challenger\'s Skill Tests targeting them; once per combat; paid as a Free action', async () => {
    const warrior = holder([FILE]);
    const [perk] = warrior.items.contents;
    const foe = holder([], { name: 'Foe', disposition: -1, system: { level: 3 } });
    const bystander = holder([], { name: 'Pal' });
    target(foe);
    answer('refuse');
    const paid = pay();
    expect(await runUse(perk, paid)).toContain('Foe refused');
    expect(paid).toHaveBeenCalledWith('free');
    expect(sourcesOf(warrior, foe)).toEqual([expect.objectContaining({ label: 'Duke It Out', edge: true })]);
    expect(sourcesOf(warrior, bystander)).toEqual([]);
    expect(sourcesOf(bystander, foe)).toEqual([]);
    expect(available(perk)).toBe(false);
    // Out of combat it lasts the scene.
    epoch = 2;
    expect(sourcesOf(warrior, foe)).toEqual([]);
  });

  test('in combat the Edge lasts until the challenger\'s next turn starts', async () => {
    const warrior = holder([FILE]);
    const foe = holder([], { name: 'Foe', disposition: -1, system: { level: 4 } });
    combat([warrior, foe]);
    target(foe);
    answer('refuse');
    setWorldLookups({ actionLedger: () => ({ standard: 0, move: 0, free: 0 }) });
    await runUse(warrior.items.contents[0], pay());
    advance(1, 1);
    expect(sourcesOf(warrior, foe)).toEqual([expect.objectContaining({ edge: true })]);
    advance(2, 0);
    expect(sourcesOf(warrior, foe)).toEqual([]);
  });

  test('accepted: no Edge; the use is spent', async () => {
    const warrior = holder([FILE]);
    const foe = holder([], { name: 'Foe', disposition: -1, system: { level: 5 } });
    target(foe);
    answer('accept');
    expect(await runUse(warrior.items.contents[0], pay())).toContain('Foe accepted the duel.');
    expect(sourcesOf(warrior, foe)).toEqual([]);
    expect(available(warrior.items.contents[0])).toBe(false);
  });

  test('a lower level (the target\'s Level, or a vehicle\'s Threat Level) is refused before anything is paid', async () => {
    const warrior = holder([FILE]);
    const [perk] = warrior.items.contents;
    answer('refuse');
    const check = async (other, refused) => {
      target(other);
      const paid = pay();
      const line = await runUse(perk, paid);
      expect(paid).toHaveBeenCalledTimes(refused ? 0 : 1);
      if (refused) {
        expect(line).toContain('Target a creature of your level or higher.');
      }

      perk.flags = {};
      warrior.flags.essence20 = {};
    };

    await check(holder([], { name: 'Rookie', system: { level: 2 } }), true);
    // An NPC's Level is read, as before (not its Threat Level).
    await check(holder([], { name: 'Goon', type: 'npc', system: { level: 1, threatLevel: 6 } }), true);
    await check(holder([], { name: 'Boss', type: 'npc', system: { level: 3, threatLevel: 1 } }), false);
    await check(holder([], { name: 'Tank', type: 'vehicle', system: { level: undefined, threatLevel: 2 } }), true);
    await check(holder([], { name: 'Jet', type: 'vehicle', system: { level: undefined, threatLevel: 4 } }), false);
    // No level at all: allowed.
    await check(holder([], { name: 'Zord', type: 'zord', system: { level: undefined } }), false);
  });

  test('in combat, not once the Standard action is spent; no target or a cancelled answer costs nothing', async () => {
    const warrior = holder([FILE]);
    const [perk] = warrior.items.contents;
    const foe = holder([], { name: 'Foe', disposition: -1, system: { level: 3 } });
    combat([warrior, foe]);
    target(foe);
    answer('refuse');
    setWorldLookups({ actionLedger: () => ({ standard: 1, move: 0, free: 0 }) });
    const spent = pay();
    expect(await runUse(perk, spent)).toContain('Your Standard action is already spent this turn.');
    expect(spent).not.toHaveBeenCalled();

    setWorldLookups({ actionLedger: () => ({ standard: 0, move: 1, free: 0 }) });
    answer(null);
    const cancelled = pay();
    await runUse(perk, cancelled);
    expect(cancelled).not.toHaveBeenCalled();
    expect(available(perk)).toBe(true);

    target();
    const none = pay();
    await runUse(perk, none);
    expect(none).not.toHaveBeenCalled();
    expect(available(perk)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Unassuming                                   */
/* -------------------------------------------- */

describe('Unassuming', () => {
  const FILE = 'tfcrbitems/_source/Unassuming_uTYoRiuxClI5V9aV.json';
  const weapon = (availability, ...hands) => ({
    type: 'weapon', name: 'W', uuid: 'Item.w', id: 'w', flags: {},
    system: { availability, items: Object.fromEntries(hands.map((numHands, i) => [`a${i}`, numHands === undefined ? { type: 'weaponEffect' } : { type: 'weaponEffect', numHands }])) },
  });

  test('Qualified with Limited weapons whose every attack is one-handed', () => {
    const infiltrator = holder([FILE]);
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', '1'))).toBe('qualified');
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', 1, '1'))).toBe('qualified');
    // A stored attack with no hands listed counts as one-handed.
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', undefined))).toBe('qualified');
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', '2'))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', '1', '2'))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, weapon('limited', 0))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, weapon('limited'))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, weapon('standard', '1'))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, weapon('restricted', '1'))).toBeNull();
    expect(ruleRequisitionAccess(infiltrator, { ...weapon('limited', '1'), type: 'armor' })).toBeNull();
    expect(ruleRequisitionAccess(holder([]), weapon('limited', '1'))).toBeNull();
  });

  test('an owned weapon reads its owned attacks', () => {
    const infiltrator = holder([FILE], { items: [
      { id: 'k', name: 'Knife', type: 'weapon', system: { availability: 'limited', items: { x: { type: 'weaponEffect', numHands: 2 } } } },
      { id: 'ks', name: 'Stab', type: 'weaponEffect', system: { numHands: 1 }, flags: { essence20: { parentId: 'k' } } },
    ] });
    expect(ruleRequisitionAccess(infiltrator, infiltrator.items.get('k'))).toBe('qualified');
  });
});
