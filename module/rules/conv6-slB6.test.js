import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDefenseAdjust, ruleMovementStages, ruleRollSources } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable, useRulesOf } from './triggers.mjs';

/**
 * Slice round 6, part slB6 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-6 engine pieces (afterRoll @var.dif, combatAllies, Movement afterDerived,
 * target:self) and the earlier ones (mark counters, table / require gates, Defense `any` per attack).
 * Each item is loaded from its pack source and must do what the removed code (and its tests) did.
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
    if (key.split('.').pop().startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
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

/** An actor holding these pack items. */
function holder(files = [], { system = {}, disposition = 1, name = 'Hero', type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    toggleStatusEffect: jest.fn(async () => {}),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = files.map(file => {
    const doc = fromPack(file);
    return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system });
  });
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** Put these actors' tokens on the canvas, `feet` apart. */
function onCanvas(feet, ...actors) {
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), setTargets: jest.fn() }, grid: { measurePath: () => ({ distance: feet }) } };
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
const bankedOn = actor => (actor.flags.essence20.ruleBank ?? []);
const sourcesOf = (actor, ctx = {}) => ruleRollSources(actor, null, { rolledSkill: 'athletics', ...ctx }).sources;

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: false, targets: new Set() }, users: { activeGM: null },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => epoch }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: { alertness: 'smarts', culture: 'social', athletics: 'strength' } } };
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
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* -------------------------------------------- */
/*  Watchful Eyes                                */
/* -------------------------------------------- */

describe('Watchful Eyes', () => {
  const FILE = 'tfcrbitems/_source/Watchful_Eyes_RmHSzuVLnIoqeczy.json';
  const alertness = (actor, { dif = 10, skill = 'alertness', outcome = 'success' } = {}) => fireTriggers(actor, 'afterRoll', {
    roll: { rolledSkill: skill }, outcome, facts: { results: [{ success: outcome == 'success', difficulty: dif, total: 12 }] }, vars: { total: 12, dif },
  });

  test('a successful Alertness test against DIF 10 Snags each targeted enemy\'s next Skill Test, labelled Watchful Eyes', async () => {
    const leader = holder([FILE], { disposition: 1 });
    const foe = holder([], { name: 'Foe', disposition: -1 });
    const pal = holder([], { name: 'Pal', disposition: 1 });
    target(foe, pal);
    await alertness(leader);
    expect(bankedOn(pal)).toEqual([]);
    expect(sourcesOf(foe)).toEqual([expect.objectContaining({ label: 'Watchful Eyes', snag: true })]);
    // Out of combat it lasts the scene, spent by the next Skill Test.
    expect(bankedOn(foe)[0]).toMatchObject({ until: 'scene', uses: 1 });
    epoch = 2;
    expect(sourcesOf(foe)).toEqual([]);
  });

  test('a failure, another DIF or another Skill marks nobody', async () => {
    const leader = holder([FILE], { disposition: 1 });
    const foe = holder([], { name: 'Foe', disposition: -1 });
    target(foe);
    await alertness(leader, { outcome: 'failure' });
    await alertness(leader, { dif: 15 });
    await alertness(leader, { skill: 'athletics' });
    expect(bankedOn(foe)).toEqual([]);
  });

  test('in combat: only on the enemy\'s own turn, until the end of its next turn; never Initiative', async () => {
    const leader = holder([FILE], { disposition: 1 });
    const foe = holder([], { name: 'Foe', disposition: -1 });
    combat([leader, foe]);
    target(foe);
    await alertness(leader);
    expect(bankedOn(foe)[0]).toMatchObject({ until: 'endOfNextTurn' });
    // The leader's turn: waits.
    expect(sourcesOf(foe)).toEqual([]);
    advance(1, 1);
    expect(sourcesOf(foe)).toEqual([expect.objectContaining({ snag: true })]);
    expect(sourcesOf(foe, { rolledSkill: 'initiative' })).toEqual([]);
    // Past the end of the foe's next turn.
    advance(2, 0);
    expect(sourcesOf(foe)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Martyr                                       */
/* -------------------------------------------- */

describe('Martyr', () => {
  const FILE = 'tfcrbitems/_source/Martyr_3CyKdsMYYq0lGj06.json';

  test('Defeated in combat: allied combatants gain Edge on every roll for the rest of the combat', async () => {
    const martyr = holder([FILE], { disposition: 1 });
    const ally = holder([], { name: 'Ally', disposition: 1 });
    const enemy = holder([], { name: 'Enemy', disposition: -1 });
    combat([martyr, ally, enemy]);
    await fireTriggers(martyr, 'defeated');
    expect(sourcesOf(ally)).toEqual([expect.objectContaining({ label: 'Martyr', edge: true })]);
    expect(sourcesOf(enemy)).toEqual([]);
    expect(bankedOn(martyr)).toEqual([]);
    // Not used up by rolls; not on Initiative.
    expect(bankedOn(ally)[0].uses).toBeGreaterThanOrEqual(1000);
    expect(sourcesOf(ally, { rolledSkill: 'initiative' })).toEqual([]);
    // Another combat: gone.
    game.combat.id = 'c2';
    expect(sourcesOf(ally)).toEqual([]);
  });

  test('Defeated out of combat: nothing', async () => {
    const martyr = holder([FILE]);
    await fireTriggers(martyr, 'defeated');
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  My Allies Are My Shield (+ Rotor Blades)     */
/* -------------------------------------------- */

describe('My Allies Are My Shield', () => {
  const FILE = 'dditems/_source/My_Allies_Are_My_Shield_pralmStmjjgVLatX.json';
  const ROTOR = 'tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json';

  test('+1 to every Defense per ally within 30 ft when attacked', () => {
    const shield = holder([FILE], { disposition: 1 });
    const allies = [holder([], { disposition: 1 }), holder([], { disposition: 1 })];
    const foe = holder([], { disposition: -1 });
    onCanvas(25, shield, ...allies, foe);
    for (const defense of ['toughness', 'evasion', 'willpower', 'cleverness']) {
      expect(ruleDefenseAdjust(foe, shield, defense, {})).toBe(2);
    }

    onCanvas(35, shield, ...allies, foe);
    expect(ruleDefenseAdjust(foe, shield, 'evasion', {})).toBe(0);
  });

  test('the Free trade: 1 of the bonus for +10 ft on every speed above 0 until the holder\'s next turn', async () => {
    const shield = holder([FILE], { disposition: 1, system: { movement: { ground: { total: 30 }, aerial: { total: 0 } } } });
    const [perk] = shield.items.contents;
    const ally = holder([], { disposition: 1 });
    const foe = holder([], { disposition: -1 });
    onCanvas(25, shield, ally, foe);
    // Combat only.
    expect(available(perk)).toBe(false);
    combat([shield, foe]);
    expect(available(perk)).toBe(true);

    const paid = pay();
    expect(await runUse(perk, paid)).toContain('(1 traded)');
    expect(paid).toHaveBeenCalledWith('free');
    expect(ruleDefenseAdjust(foe, shield, 'evasion', {})).toBe(0);
    const stages = ruleMovementStages(shield);
    expect(stages('afterDerived', 'ground', 30)).toBe(40);
    expect(stages('afterDerived', 'aerial', 0)).toBe(0);
    expect(stages('afterDerived', 'burrow', 10)).toBeNull();
    expect(stages('final', 'ground', 30)).toBeNull();

    // No bonus left: nothing paid, nothing traded.
    const refused = pay();
    expect(await runUse(perk, refused)).toContain('No Defense bonus left to trade.');
    expect(refused).not.toHaveBeenCalled();
    expect(shield.flags.essence20.ruleMarks.shieldTrade.count).toBe(1);

    // The holder's next turn: the trade ends (and the mark is cleared so derived data is redone).
    advance(1, 1);
    expect(ruleMovementStages(shield)('afterDerived', 'ground', 30)).toBe(40);
    advance(2, 0);
    expect(ruleMovementStages(shield)('afterDerived', 'ground', 30)).toBeNull();
    expect(ruleDefenseAdjust(foe, shield, 'evasion', {})).toBe(1);
    await fireTriggers(shield, 'turnStart');
    expect(shield.flags.essence20.ruleMarks?.shieldTrade).toBeUndefined();
  });

  test('two trades stack; Rotor Blades\' Alt Mode Aerial is half the traded-up Ground, the trade not added to it', async () => {
    const shield = holder([FILE, ROTOR], { disposition: 1, system: { canTransform: true, isTransformed: true, movement: { ground: { total: 50 }, aerial: { total: 0 } } } });
    const [perk] = shield.items.contents;
    onCanvas(25, shield, holder([], { disposition: 1 }), holder([], { disposition: 1 }));
    combat([shield]);
    await runUse(perk, pay());
    await runUse(perk, pay());
    const stages = ruleMovementStages(shield);
    expect(stages('afterDerived', 'aerial', 0)).toBe(35);
    expect(stages('afterDerived', 'ground', 50)).toBe(70);
  });
});

describe('Rotor Blades (afterDerived)', () => {
  const FILE = 'tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json';

  test('Alt Mode Aerial of half the Ground, after every derived adjustment, never lowering it', () => {
    const actor = holder([FILE], { system: { canTransform: true, isTransformed: false, movement: { ground: { total: 50 }, aerial: { total: 0 } } } });
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 0)).toBeNull();
    actor.system.isTransformed = true;
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 0)).toBe(25);
    expect(ruleMovementStages(actor)('afterDerived', 'aerial', 40)).toBe(40);
    expect(ruleMovementStages(actor)('afterGravity', 'aerial', 0)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Targeting yourself                           */
/* -------------------------------------------- */

describe('targeting yourself', () => {
  test('Energon Bank refuses its own holder, spending nothing', async () => {
    const actor = holder(['tfcrbitems/_source/Energon_Bank_W87huLqKeOCJJ66L.json'], { system: { energon: { normal: { value: 2 } } } });
    target(actor);
    expect(await runUse(actor.items.contents[0], pay())).toContain('Target someone else.');
    expect(actor.system.energon.normal.value).toBe(2);
  });

  test('Grant His Hunger refuses its own holder before the action is paid', async () => {
    const actor = holder(['dditems/_source/Grant_His_Hunger_TuXN8c83c1CDiMUD.json'], { system: { canTransform: true, energon: { normal: { value: 3 } } } });
    actor._dice = { rollSkill: jest.fn() };
    target(actor);
    const paid = pay();
    expect(await runUse(actor.items.contents[0], paid)).toContain('Target someone else.');
    expect(paid).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test('Partnered with yourself targeted opens the ally list instead', async () => {
    const actor = holder(['dditems/_source/Partnered_6I4IIvDP3SOCJ5cR.json'], { disposition: 1 });
    const [perk] = actor.items.contents;
    const ally = holder([], { name: 'Ally', disposition: 1 });
    onCanvas(50, actor, ally);
    target(actor);
    foundry.applications.api.DialogV2.wait.mockImplementation(async () => ally.uuid);
    await runUse(perk, pay());
    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(perk.flags.essence20.rules.choices.partner).toBe(ally.uuid);
  });
});
