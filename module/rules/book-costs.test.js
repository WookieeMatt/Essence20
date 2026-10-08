import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, part "costs" (docs/rules-batches/book-costs.md): the action costs the rulebooks give these Uses, and the
 * "only while Morphed" gates. A Morphed gate runs before anything is paid, and so do the picks / checks that can stop a
 * Use (a refused Use spends no action).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const nearby = { tokens: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-enemies.mjs', () => ({ getNearbyEnemyTokens: jest.fn(() => nearby.tokens) }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runUse, useAvailable } = await import('./triggers.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  castling: 'gijcrbitems/_source/Castling_eB7jbgbevLVPxW4e.json',
  knightsJump: 'gijcrbitems/_source/Knight_s_Jump_CG0aeZtKsPVmvUF5.json',
  naturalMovement: 'gijcrbitems/_source/Natural_Movement_TLI74oM0tbDtQ298.json',
  fastLearner: 'gijcrbitems/_source/Fast_Learner_u3KK0V30GXDdRPAY.json',
  honorificToken: 'jttitems/_source/Honorific_Token_z9NkwgoIx2JRrPBA.json',
  squadGuardian: 'ghpfitems/_source/Squad_Guardian_Li2y6KqFu2OGRkrX.json',
  deadstick: 'qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json',
  takedown: 'gijcrbitems/_source/Takedown_Yev7VrgEKtsTGdrx.json',
  standFirm: 'tfcrbitems/_source/Stand_Firm_rAxKrR4ObFGeH5yP.json',
  mysteriousAura: 'jttitems/_source/Mysterious_Aura_hSu10Kgj9g1LSmyv.json',
  adaptation: 'gijcrbitems/_source/Adaptation_PmY8jGTiemnSdsHi.json',
  growl: 'ccitems/_source/Growl_OSVtPXBdRmZ2C4PD.json',
  toughItOut: 'tfcrbitems/_source/Tough_It_Out_B6b8dRybHodMv8aC.json',
  nanoMedMastery: 'gijcrbitems/_source/Nano_Med_Mastery_7hMe2hYONR6wBMFv.json',
  resilience: 'prcrbitems/_source/Resilience_TomU7e31oHoRsIrT.json',
  standBehindMe: 'atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json',
  oneForAll: 'prcrbitems/_source/One_For_All_8duLY5PjlpmbNkwK.json',
  shiningLeader: 'prcrbitems/_source/Shining_Leader_woCTg4Lpk3KpsgtF.json',
  chargeItUp: 'jttitems/_source/Charge_It_Up__eDLYdEHBTU2S2qp0.json',
  psychoAssault: 'fmmcitems/_source/Psycho_Assault_yZ3rXt8z1jlCHlu7.json',
};

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete node[last.slice(2)];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    delete: jest.fn(async () => {}),
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(name, files = [], { system = {}, x = 0, disposition = 1 } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      defenses: { toughness: { total: 10 }, evasion: { total: 10 }, willpower: { total: 11 }, cleverness: { total: 14 } }, ...system,
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      setPath(this.flags[scope] ??= {}, `-=${key}`);
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.test.Item.${doc._id}` } } }));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 }, id: `t${actor.id}` };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

function scene(...actors) {
  const docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, scene: { id: 'sc', tokens: [] } };
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const pay = jest.fn(async () => true);
const askFor = text => async (step, options) => options.findIndex(option => String(option.label).startsWith(text));
const savedGame = global.game;

beforeEach(() => {
  pay.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: () => null };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  global.canvas = undefined;
  global.game = savedGame;
});

const usesOf = file => (fromPack(file).system.rules ?? []).filter(rule => rule.type == 'Use');

test('every rule on these items validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

test('each Use charges the action the book gives it', () => {
  const BOOK = {
    castling: 'standard', knightsJump: 'move', naturalMovement: 'standard', fastLearner: 'standard', honorificToken: 'move',
    squadGuardian: 'standard', deadstick: 'standard', takedown: 'standard', standFirm: 'move', mysteriousAura: 'move',
    adaptation: 'free', growl: 'free', toughItOut: 'standard', nanoMedMastery: 'standard', oneForAll: 'standard',
    shiningLeader: 'standard', chargeItUp: 'standard', psychoAssault: 'free',
  };
  for (const [key, action] of Object.entries(BOOK)) {
    expect([key, usesOf(FILES[key])[0].cost?.action]).toEqual([key, action]);
  }

  // Switching off costs nothing; Resilience and Stand Behind Me! name no action.
  expect(usesOf(FILES.naturalMovement)[1].cost).toBeUndefined();
  expect(usesOf(FILES.adaptation)[1].cost).toBeUndefined();
  expect(usesOf(FILES.resilience)[0].cost.action).toBeUndefined();
  expect(usesOf(FILES.standBehindMe)[0].cost.action).toBeUndefined();
});

describe('only while Morphed: refused before anything is paid', () => {
  const CASES = [
    ['resilience', 'Resilience', null, null],
    ['standBehindMe', 'Stand Behind Me!', null, null],
    ['mysteriousAura', 'Mysterious Aura', 'move', 'Imposing'],
    ['oneForAll', 'One For All', 'standard', null],
    ['shiningLeader', 'Shining Leader', 'standard', null],
    ['chargeItUp', 'Charge It Up!', 'standard', null],
  ];

  test.each(CASES)('%s', async (key, name, action, option) => {
    const ranger = makeActor('Ranger', FILES[key], { system: { skills: { athletics: { shift: 'd6' } } } });
    scene(ranger);
    const item = itemNamed(ranger, name);
    const before = ranger.system.powers.personal.value;
    const options = option ? { ask: askFor(option) } : {};
    expect(await runUse(item, pay, options)).toContain('requires being Morphed');
    expect(ranger.system.powers.personal.value).toBe(before);
    expect(pay).not.toHaveBeenCalled();

    ranger.system.isMorphed = true;
    // Stand Behind Me! also needs a running combat (user ruling 2026-10-07: the taunt ends at your next turn).
    const combat = global.game.combat;
    if (key == 'standBehindMe') {
      global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [{ actor: ranger }], combatants: { contents: [] } };
    }

    expect(await runUse(item, pay, options)).not.toContain('requires being Morphed');
    global.game.combat = combat;
    expect(ranger.system.powers.personal.value).toBeLessThan(before);
    if (action) {
      expect(pay).toHaveBeenCalledWith(action);
    } else {
      expect(pay).not.toHaveBeenCalled();
    }
  });

  test('One For All and Shining Leader reach every teammate, Morphed or not', () => {
    for (const key of ['oneForAll', 'shiningLeader']) {
      const step = usesOf(FILES[key])[0].steps.find(s => s.to == 'allies:100000');
      expect(step.filter).toBeUndefined();
    }
  });

  test('Psycho Assault stays Morphed-only and out of Monster Form, as the book says', () => {
    const ranger = makeActor('Ranger', FILES.psychoAssault);
    scene(ranger);
    const item = itemNamed(ranger, 'Psycho Assault');
    const rule = item.system.rules.find(r => r.type == 'Use');
    expect(rule.when).toEqual(['self:morphed', 'not:check:monsterForm']);
    expect(useAvailable(item, rule, item.system.rules.indexOf(rule))).toBe(false);
    expect(fromPack(FILES.psychoAssault).system.automation.notes).not.toContain('Left to the table');
  });
});

describe('a Use that stops early spends no action', () => {
  test('Knight\'s Jump without two targets', async () => {
    const hero = makeActor('Hero', FILES.knightsJump);
    scene(hero);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: { contents: [] } };
    await runUse(itemNamed(hero, 'Knight\'s Jump'), pay);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.KnightsJumpNeedsTwoTargets');
    expect(pay).not.toHaveBeenCalled();
  });

  test('Growl outside combat', async () => {
    const hero = makeActor('Hero', FILES.growl);
    const foe = makeActor('Foe', [], { x: 5, disposition: -1 });
    scene(hero, foe);
    global.game.user.targets = new Set([foe.token]);
    expect(await runUse(itemNamed(hero, 'Growl'), pay)).toContain('Growl needs a combat.');
    expect(pay).not.toHaveBeenCalled();
  });

  test('the steps that can stop or ask run before the cost', () => {
    const lead = (key, index = 0) => usesOf(FILES[key])[index].steps.filter(step => step.beforeCost).map(step => step.do);
    expect(lead('knightsJump')).toEqual(['target', 'collect', 'countTargets', 'warn', 'collect', 'countTargets', 'warn']);
    expect(lead('naturalMovement')).toEqual(['warn', 'pick']);
    expect(lead('fastLearner')).toEqual(['pick', 'pick']);
    // (Deadstick's robot / 100 ft gate and Growl's reach gate - book check, effects.)
    expect(lead('deadstick')).toEqual(['target', 'require']);
    expect(lead('growl')).toEqual(['target', 'require', 'require', 'require']);
    expect(lead('toughItOut')).toEqual(['askNumber']);
  });
});
