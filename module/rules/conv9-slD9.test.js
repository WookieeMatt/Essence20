import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD9: round-9 re-check of the react / resource / other1 / other3 slices. Not On My Watch (Intercontinental
 * Adventures) moves its Move offer onto a watch droppedToZero Trigger; Void Touched's Essence trade is an added /
 * Use / removed set of rules; Fuel Efficient's d4s are quiet; EM Protective Lining sums only computerized armor
 * (@sum.equippedTrait). Each item is loaded from its pack source and must do what the removed code did.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const grantActionsThisTurn = jest.fn(async () => {});
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ grantActionsThisTurn }));

const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, fireItemAdded } = await import('./triggers.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { ruleDefenseAdjust } = await import('./adapter.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { pressRuleButton } = await import('./buttons.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  notOnMyWatch: 'iafav2items/_source/Not_On_My_Watch_xH3iQ0NcXp1eFO35.json',
  voidTouched: 'ttsgitems/_source/Void_Touched_NHH2nlllyFMBOB38.json',
  fuelEfficient: 'tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json',
  emLining: 'eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json',
};

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((node, key) => (node[key] ??= {}), object)[last] = value;
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor holding the pack items `files` and any extra item data, with a token at x (feet) and disposition. */
function makeActor(name, files = [], { system = {}, extra = [], type = 'playerCharacter', x = 0, disposition = 1 } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } }, traits: {}, movement: { ground: { total: 30 } },
      essences: { strength: { value: 4, max: 4 }, speed: { value: 4, max: 4 }, smarts: { value: 4, max: 4 }, social: { value: 4, max: 4 } },
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
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system) }));
  }

  for (const data of extra) {
    items.push(makeItem(actor, data));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

let docs = new Map();

function scene(...actors) {
  docs = new Map(actors.map(actor => [actor.uuid, actor]));
  for (const actor of actors) {
    for (const item of actor.items.contents) {
      item.uuid = `${actor.uuid}.Item.${item.id}`;
      docs.set(item.uuid, item);
    }
  }

  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, contents: actors, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token), controlled: [] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
}

const createCalls = () => global.ChatMessage.create.mock.calls.map(call => call[0]);
const allChat = () => createCalls().map(data => data?.content ?? '').join(' ');
const buttonCards = () => createCalls().filter(data => data?.flags?.essence20?.ruleButton);
const asMessage = data => ({ flags: data.flags, isOwner: true, update: jest.fn(async () => {}) });
const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

/** Math.random answers giving these d4 faces, in order. */
function d4s(...faces) {
  const values = faces.map(face => (face - 0.5) / 4);
  return jest.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0);
}

/** DialogV2.wait answers for chooseSelect, in order. */
function dialogAnswers(...answers) {
  const wait = jest.fn(async () => answers.shift() ?? null);
  global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait } } };
  return wait;
}

const savedGame = global.game;
const savedConfig = global.CONFIG;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  grantActionsThisTurn.mockClear();
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
  global.game = savedGame;
  global.CONFIG = savedConfig;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every slD9 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Not On My Watch (Intercontinental Adventures): an ally at 0 Health offers the holder a Move', () => {
  /** A Health write from 5 to 0 through the real actor-update hooks. */
  async function drop(actor, path = 'system.health.value') {
    const changes = {};
    setPath(changes, path, 0);
    const options = {};
    hooks.preUpdateActor.forEach(fn => fn(actor, changes, options, 'u'));
    setPath(actor, path, 0);
    hooks.updateActor.forEach(fn => fn(actor, changes, options, 'u'));
    await flush();
  }

  test('an ally dropping to 0 Health posts a whispered button; pressing it gives a Move in combat and the line', async () => {
    const watcher = makeActor('Duke', FILES.notOnMyWatch);
    const ally = makeActor('Scarlett', [], { x: 200, system: { health: { value: 5, max: 10 } } });
    scene(watcher, ally);
    global.game.users = { contents: [{ id: 'p', isGM: false }, { id: 'gm', isGM: true }] };
    watcher.testUserPermission = user => user.id == 'p';
    await drop(ally);
    const cards = buttonCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].whisper).toEqual(['p', 'gm']);
    const data = cards[0].flags.essence20.ruleButton;
    expect(data.actorUuid).toBe(watcher.uuid);
    expect(data.who).toBe('owner');
    expect(data.once).toBe(true);

    global.game.combat = { id: 'c', started: false };
    const message = asMessage(cards[0]);
    expect(await pressRuleButton(message)).toBe(true);
    expect(grantActionsThisTurn).toHaveBeenCalledWith(watcher, { free: 0, move: 1, standard: 0 }, 'Not On My Watch', { granter: watcher });
    expect(allChat()).toContain('Duke rushes up to 30 ft toward their fallen teammate.');
    expect(message.update).toHaveBeenCalledWith({ 'flags.essence20.ruleButton.used': true });
    // Used: a second press does nothing.
    message.flags.essence20.ruleButton.used = true;
    expect(await pressRuleButton(message)).toBe(false);
  });

  test('out of combat the press only posts the line', async () => {
    const watcher = makeActor('Duke', FILES.notOnMyWatch);
    const ally = makeActor('Scarlett', [], { x: 5, system: { health: { value: 5, max: 10 } } });
    scene(watcher, ally);
    await drop(ally);
    await pressRuleButton(asMessage(buttonCards()[0]));
    expect(grantActionsThisTurn).not.toHaveBeenCalled();
    expect(allChat()).toContain('rushes up to 30 ft');
  });

  test('nothing for the holder\'s own drop, an enemy, a vehicle, Power at 0, or a value already at 0', async () => {
    const watcher = makeActor('Duke', FILES.notOnMyWatch, { system: { health: { value: 5, max: 10 } } });
    const enemy = makeActor('Cobra', [], { x: 5, disposition: -1, system: { health: { value: 5, max: 10 } } });
    const jeep = makeActor('Jeep', [], { x: 5, type: 'vehicle', system: { health: { value: 5, max: 10 } } });
    const ally = makeActor('Scarlett', [], { x: 5, system: { health: { value: 0, max: 10 }, powers: { personal: { value: 2, max: 3 } } } });
    scene(watcher, enemy, jeep, ally);
    await drop(watcher);
    await drop(enemy);
    await drop(jeep);
    await drop(ally, 'system.powers.personal.value');
    await drop(ally);
    expect(buttonCards()).toEqual([]);
  });
});

describe('Void Touched: lower Strength or Social by 1, raise Smarts or Speed by 1 more', () => {
  const setup = (flags = {}) => {
    const hero = makeActor('Ranger', FILES.voidTouched, { system: { essences: { strength: { max: 3 }, social: { max: 2 }, smarts: { max: 2 }, speed: { max: 2 } } } });
    const origin = hero.items.contents[0];
    Object.assign(origin.flags, flags);
    rebuildIndex(hero);
    return { hero, origin };
  };

  const maxes = hero => Object.fromEntries(Object.entries(hero.system.essences).map(([key, value]) => [key, value.max]));
  const useRule = origin => origin.system.rules.find(rule => rule.type == 'Use');

  test('added to an actor: asks both, trades the points and is marked done', async () => {
    const { hero, origin } = setup();
    const wait = dialogAnswers('strength', 'speed');
    await fireItemAdded(hero, origin);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(maxes(hero)).toEqual({ strength: 2, social: 2, smarts: 2, speed: 3 });
    expect(origin.flags.essence20.rules.choices).toEqual({ down: 'strength', up: 'speed' });
    expect(origin.flags.essence20.o3VoidTouched).toBeTruthy();
    // The Use is gone once applied, and adding again does nothing.
    expect(evaluate(useRule(origin).when, contextFor({ self: hero, ruleItem: origin }))).toBe(false);
    dialogAnswers('social', 'smarts');
    await fireItemAdded(hero, origin);
    expect(maxes(hero)).toEqual({ strength: 2, social: 2, smarts: 2, speed: 3 });
  });

  test('backing out of either question changes nothing, and the Use is still there', async () => {
    const { hero, origin } = setup();
    dialogAnswers('social', null);
    await fireItemAdded(hero, origin);
    expect(maxes(hero)).toEqual({ strength: 3, social: 2, smarts: 2, speed: 2 });
    expect(origin.flags.essence20.o3VoidTouched).toBeUndefined();
    expect(evaluate(useRule(origin).when, contextFor({ self: hero, ruleItem: origin }))).toBe(true);

    const ctx = stepContext({ actor: hero, item: origin, targets: [] });
    ctx.askPick = async (step, options) => options.at(-1).value;
    await runSteps(useRule(origin).steps, ctx);
    expect(maxes(hero)).toEqual({ strength: 3, social: 1, smarts: 2, speed: 3 });
    expect(ctx.chat.join(' ')).toContain('Ranger: social -1, speed +1 (Void Touched).');
  });

  test('deleting the Origin undoes the trade; an unapplied one undoes nothing', async () => {
    const { hero, origin } = setup();
    dialogAnswers('social', 'smarts');
    await fireItemAdded(hero, origin);
    expect(maxes(hero)).toEqual({ strength: 3, social: 1, smarts: 3, speed: 2 });
    await fireItemAdded(hero, origin, { event: 'removed' });
    expect(maxes(hero)).toEqual({ strength: 3, social: 2, smarts: 2, speed: 2 });

    const fresh = setup();
    await fireItemAdded(fresh.hero, fresh.origin, { event: 'removed' });
    expect(maxes(fresh.hero)).toEqual({ strength: 3, social: 2, smarts: 2, speed: 2 });
  });

  test('a trade made before the update (o3VoidTouched) is kept, carried over and undone once', async () => {
    const { hero, origin } = setup({ essence20: { o3VoidTouched: { down: 'strength', up: 'smarts' } } });
    expect(evaluate(useRule(origin).when, contextFor({ self: hero, ruleItem: origin }))).toBe(false);
    const updates = legacyChoiceUpdates(hero);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({
      _id: origin.id, 'flags.essence20.rules.choices.down': 'strength', 'flags.essence20.rules.choices.up': 'smarts',
    })]));
    // Undone from the old flag alone, and (after the GM's linking pass) from both without counting twice.
    await fireItemAdded(hero, origin, { event: 'removed' });
    expect(maxes(hero)).toEqual({ strength: 4, social: 2, smarts: 1, speed: 2 });
    const linked = setup({ essence20: { o3VoidTouched: { down: 'strength', up: 'smarts' }, rules: { choices: { down: 'strength', up: 'smarts' } } } });
    await fireItemAdded(linked.hero, linked.origin, { event: 'removed' });
    expect(maxes(linked.hero)).toEqual({ strength: 4, social: 2, smarts: 1, speed: 2 });
  });
});

describe('Fuel Efficient: the d4s are rolled quietly', () => {
  const spend = (actor, spent) => fireTriggers(actor, 'resourceSpent', { vars: { spent, resource: 'energon' } });

  test('a 4 gives the point back with one line and no dice line', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient);
    d4s(4, 2);
    await spend(bot, 2);
    expect(bot.system.energon.normal.value).toBe(2);
    expect(allChat()).toContain('Bot regains 1 Energon Point(s).');
    expect(allChat()).not.toContain('DiceRolled');
  });

  test('no 4: no card at all, as the old silent roll', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient);
    d4s(1, 2, 3);
    await spend(bot, 3);
    expect(bot.system.energon.normal.value).toBe(1);
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe('EM Protective Lining: only computerized armor gives its Evasion back', () => {
  function setup(extraArmor) {
    const attacker = makeActor('Shooter', [], { extra: [
      { id: 'gun', name: 'Gun', type: 'weapon', system: { equipped: true, traits: ['electromagnetic'] } },
      { id: 'shot', name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: 'gun' } }, system: { damageType: 'blunt', classification: { skill: 'targeting', style: 'ranged' } } },
    ] });
    const doc = fromPack(FILES.emLining);
    const defender = makeActor('Bot', [], { system: { traits: { computerized: true } }, extra: [
      { id: 'suit', name: 'Battledress', type: 'armor', system: { equipped: true, traits: ['computerized'], totalBonusEvasion: 2 } },
      { name: doc.name, type: doc.type, system: clone(doc.system), flags: { essence20: { parentId: 'suit' } } },
      extraArmor,
    ] });
    return { attacker, defender, effect: attacker.items.get('shot') };
  }

  const evasion = ({ attacker, defender, effect }) => ruleDefenseAdjust(attacker, defender, 'evasion', { item: effect, difficulty: 10 });

  test('a computerized and a plain armor both worn: the computerized one\'s Evasion only', () => {
    expect(evasion(setup({ name: 'Coat', type: 'armor', system: { equipped: true, traits: [], totalBonusEvasion: 3 } }))).toBe(2);
  });

  test('two computerized armors sum; an unequipped one doesn\'t count', () => {
    expect(evasion(setup({ name: 'Plate', type: 'armor', system: { equipped: true, traits: ['computerized'], totalBonusEvasion: 1 } }))).toBe(3);
    expect(evasion(setup({ name: 'Plate', type: 'armor', system: { equipped: false, traits: ['computerized'], totalBonusEvasion: 1 } }))).toBe(2);
  });
});
