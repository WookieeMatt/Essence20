import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD3: the react slice's card reactions moved onto Reaction rules (rules/reactions.mjs), Energon
 * Manipulator onto a defeatedEnemy Trigger and a Use (dice in formulas), and Body of Energy's chat line
 * printing {var.moved}. Each item is loaded from its pack source and must do what the removed code did.
 */

// Body of Energy's pack rules use a plug-in rule type (HealthOverflow - round 18, convB).
await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { reactionOffers, pressReaction } = await import('./reactions.mjs');
const { cardInfo } = await import('../mechanics/combat/reaction-engine.mjs');
const { validateRule } = await import('./types.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { usesLeft } = await import('./limits.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { setStoryPointHelpers } = await import('./steps.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  cruelty: 'ccitems/_source/Legendary_Cruelty_Lcs6Pz0I0I7QJday.json',
  sidestep: 'prcrbitems/_source/Sidestep_YhdTm7qhaPCoiDab.json',
  soldierOn: 'tfcrbitems/_source/Soldier_On_0fal8jy083wWSy7W.json',
  notOnMyWatch: 'tfcrbitems/_source/Not_On_My_Watch_cvgYI2FTjeIrUcLK.json',
  notPerfect: 'sssitems/_source/Not_Perfect__But_Better_VtsUIbJm3HfFn12M.json',
  thatsRight: 'sssitems/_source/That_s_Right__Perfect_dAoJG7ZwVEhOQZY0.json',
  energonManipulator: 'dditems/_source/Energon_Manipulator_cOVq7EH6HPrXmhBC.json',
  bodyOfEnergy: 'atsitems/_source/Body_of_Energy_L2X2rIz2frulSajQ.json',
};

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;

/** An actor with a token on the canvas (x feet along, disposition), holding the pack item `file` (if any). */
function makeActor(name, file = null, { x = 0, disposition = 1, system = {}, type = 'playerCharacter' } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 5, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
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
      return key.split('.').reduce((at, k) => at?.[k], this.flags[scope]);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const items = [];
  if (file) {
    const doc = fromPack(file);
    items.push({
      id: `i${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: doc.system, parent: actor,
      async update(data) {
        for (const [key, value] of Object.entries(data)) {
          setPath(this, key, value);
        }
      },
    });
  }

  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemOf = actor => actor.items.contents[0];

/** A posted check card from `attacker`: rows [[target or null, DIF]], the total, and card flags. */
function cardFor(attacker, rows, total, { id = `m${nextId++}`, flags = {}, damage = 3, crit = false, d20 = total, formula = '1d20' } = {}) {
  const store = {};
  const content = rows.filter(([target]) => target).map(([target]) => `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="${damage}" data-damage-type="blunt">`
    + (crit ? `<button data-action="apply-damage" data-key="${target.uuid}:crit:double" data-target-uuid="${target.uuid}" data-damage="${damage}">` : '')).join('');
  const message = {
    id, speaker: { actor: attacker.id }, content,
    flags: { essence20: { checkResults: rows.map(([target, difficulty]) => ({ targetUuid: target?.uuid ?? null, difficulty, success: total >= difficulty })), isAttack: true, ...flags } },
    rolls: [{ total, formula, dice: [{ faces: 20, results: [{ result: d20, active: true }] }] }],
    getFlag: (scope, key) => store[key],
    async setFlag(scope, key, value) {
      store[key] = value;
    },
  };
  global.game.messages = { get: messageId => (messageId == id ? message : null) };
  return { message, info: cardInfo(message) };
}

let docs = new Map();

function world(...actors) {
  docs = new Map(actors.map(actor => [actor.uuid, actor]));
  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
}

/** A hand-built offer for rules whose offer needs the card facts reactions.mjs hands the Reaction's `when`. */
function offerFor(actor, info, row, other) {
  return { actor, item: itemOf(actor), rule: itemOf(actor).system.rules[0], index: 0, row, other, key: `${info.message.id}|${row?.targetUuid ?? '*'}|x` };
}

const lastChat = () => global.ChatMessage.create.mock.calls.at(-1)?.[0] ?? {};
const allChat = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.content ?? '').join(' ');

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;

beforeEach(() => {
  global.game = {
    ...savedGame, combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { ...global.ChatMessage, create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
  global.game = savedGame;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every slD3 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Legendary Cruelty (Reaction)', () => {
  test('offered to its holder on a miss against them, not on a hit or to anyone else', () => {
    const attacker = makeActor('Goon', null, { disposition: -1 });
    const baroness = makeActor('Baroness', FILES.cruelty, { x: 5 });
    const other = makeActor('Other', FILES.cruelty, { x: 10 });
    world(attacker, baroness, other);
    expect(reactionOffers(cardFor(attacker, [[baroness, 15]], 12).info).map(o => o.actor)).toEqual([baroness]);
    expect(reactionOffers(cardFor(attacker, [[baroness, 5]], 12).info)).toEqual([]);
    // Only weapon attacks.
    expect(reactionOffers(cardFor(attacker, [[baroness, 15]], 12, { flags: { isAttack: false } }).info)).toEqual([]);
  });

  test('rolls Intimidation against the attacker\'s better of Willpower and Cleverness; a success posts the GM\'s 1 Psychic button; once a turn', async () => {
    const attacker = makeActor('Goon', null, { disposition: -1 });
    const baroness = makeActor('Baroness', FILES.cruelty, { x: 5 });
    world(attacker, baroness);
    baroness._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ success: true, multiplier: 1 }] }] })) };
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
    const { info } = cardFor(attacker, [[baroness, 15]], 12);
    const [offer] = reactionOffers(info);
    expect(await pressReaction(info, offer)).toBe(true);
    expect(baroness._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', dif: '14' }), baroness);
    const button = global.ChatMessage.create.mock.calls.map(call => call[0]?.flags?.essence20?.ruleButton).find(Boolean);
    expect(button).toMatchObject({ who: 'gm', targets: [attacker.uuid], steps: [{ do: 'damage', to: 'target', amount: 1, damageType: 'psychic' }] });
    // Spent for this turn; the next turn it is back.
    expect(reactionOffers(cardFor(attacker, [[baroness, 15]], 12).info)).toEqual([]);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 1 };
    expect(reactionOffers(cardFor(attacker, [[baroness, 15]], 12).info)).toHaveLength(1);
  });

  test('a failed roll deals nothing', async () => {
    const attacker = makeActor('Goon', null, { disposition: -1 });
    const baroness = makeActor('Baroness', FILES.cruelty, { x: 5 });
    world(attacker, baroness);
    baroness._dice = { rollSkill: jest.fn(async () => ({ success: false })) };
    const { info } = cardFor(attacker, [[baroness, 15]], 12);
    await pressReaction(info, reactionOffers(info)[0]);
    expect(global.ChatMessage.create.mock.calls.some(call => call[0]?.flags?.essence20?.ruleButton)).toBe(false);
  });
});

describe('Sidestep (Reaction)', () => {
  const area = { type: 'weaponEffect', system: { radius: 10, defenseType: 'evasion' } };

  function setup({ acrobatics = 'd6', power = 3, item = area, defenseType = 'evasion' } = {}) {
    const attacker = makeActor('Goon', null, { disposition: -1 });
    const ranger = makeActor('Green', FILES.sidestep, { x: 5, system: { skills: { acrobatics: { shift: acrobatics } }, powers: { personal: { value: power, max: 3 } } } });
    world(attacker, ranger);
    docs.set('Item.blast', { ...item, uuid: 'Item.blast' });
    const card = cardFor(attacker, [[ranger, 12]], 15, { flags: { itemUuid: 'Item.blast', defenseType } });
    return { attacker, ranger, ...card };
  }

  test('offered on an area hit against Evasion, with an Acrobatics die and a point of Power', () => {
    expect(reactionOffers(setup().info)).toHaveLength(1);
    expect(reactionOffers(setup({ acrobatics: 'd20' }).info)).toEqual([]);
    expect(reactionOffers(setup({ power: 0 }).info)).toEqual([]);
    expect(reactionOffers(setup({ item: { type: 'weaponEffect', system: { defenseType: 'evasion' } } }).info)).toEqual([]);
    expect(reactionOffers(setup({ item: { ...area, system: { ...area.system, defenseType: 'toughness' } }, defenseType: 'toughness' }).info)).toEqual([]);
  });

  test('pays 1 Power and lowers the total by the Acrobatics die - below the DIF, the hit is gone', async () => {
    const { ranger, message, info } = setup();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(ranger.system.powers.personal.value).toBe(2);
    // 15 - 6 = 9, under DIF 12.
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([ranger.uuid]);
    expect(lastChat().content).toContain('CardNowMisses');
  });

  test('a small roll leaves the hit standing', async () => {
    const { ranger, message, info } = setup({ acrobatics: 'd2' });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await pressReaction(info, reactionOffers(info)[0]);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(lastChat().content).toContain('CardStillHits');
  });
});

describe('Soldier On (Reaction)', () => {
  test('asks for a crit on that row (the card fact reactions.mjs hands its when)', () => {
    const rule = fromPack(FILES.soldierOn).system.rules[0];
    expect(rule).toMatchObject({ who: 'target', outcome: 'hit', attackOnly: true, limit: { per: 'encounter', max: 1 } });
    expect(evaluate(rule.when, contextFor({ damageAmount: 3, damageCrit: true }))).toBe(true);
    expect(evaluate(rule.when, contextFor({ damageAmount: 3, damageCrit: false }))).toBe(false);
  });

  test('Brawn against 10 + the damage; a success ignores the attack; once per encounter', async () => {
    const attacker = makeActor('Con', null, { disposition: -1 });
    const bot = makeActor('Bot', FILES.soldierOn, { x: 5 });
    world(attacker, bot);
    bot._dice = { rollSkill: jest.fn(async () => ({ success: true })) };
    const { message, info } = cardFor(attacker, [[bot, 10]], 18, { crit: true, damage: 4 });
    expect(info.rows[0].isCrit).toBe(true);
    expect(await pressReaction(info, offerFor(bot, info, info.rows[0], attacker))).toBe(true);
    expect(bot._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'brawn', dif: '14' }), bot);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([bot.uuid]);
    expect(usesLeft(bot, itemOf(bot).system.rules[0], itemOf(bot), 0)).toBe(0);
  });
});

describe('Not On My Watch (TF, Reaction)', () => {
  test('for an enemy of the roller, on a success without an Edge (the card fact reactions.mjs hands its when)', () => {
    const rule = fromPack(FILES.notOnMyWatch).system.rules[0];
    expect(rule).toMatchObject({ who: 'enemyOfAttacker', per: 'card', outcome: 'hit', limit: { per: 'encounter', max: 1 } });
    expect(evaluate(rule.when, contextFor({ edge: false }))).toBe(true);
    expect(evaluate(rule.when, contextFor({ edge: true }))).toBe(false);
  });

  test('the chosen social Skill against the matching Defense; a success adds a late Snag that can turn hits into misses', async () => {
    const enemy = makeActor('Decepticon', null, { disposition: -1 });
    const victim = makeActor('Autobot', null, { x: 5 });
    const watcher = makeActor('Optimus', FILES.notOnMyWatch, { x: 10 });
    world(enemy, victim, watcher);
    watcher._dice = { rollSkill: jest.fn(async () => ({ success: true })) };
    // Picks the second option (Intimidation).
    global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait: jest.fn(async () => '1') } } };
    const OldRoll = global.Roll;
    global.Roll = class {
      evaluate() {
        return { total: 4 };
      }
    };
    const { message, info } = cardFor(enemy, [[victim, 12]], 15);
    expect(await pressReaction(info, offerFor(watcher, info, null, enemy))).toBe(true);
    global.Roll = OldRoll;
    // Willpower 11 for Intimidation.
    expect(watcher._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', dif: '11' }), watcher);
    // Kept d20 15 against the new 4: total 4, under DIF 12.
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([victim.uuid]);
    expect(usesLeft(watcher, itemOf(watcher).system.rules[0], itemOf(watcher), 0)).toBe(0);
  });

  test('backing out of the Skill choice spends nothing', async () => {
    const enemy = makeActor('Decepticon', null, { disposition: -1 });
    const victim = makeActor('Autobot', null, { x: 5 });
    const watcher = makeActor('Optimus', FILES.notOnMyWatch, { x: 10 });
    world(enemy, victim, watcher);
    watcher._dice = { rollSkill: jest.fn() };
    global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait: jest.fn(async () => null) } } };
    const { info } = cardFor(enemy, [[victim, 12]], 15);
    await pressReaction(info, offerFor(watcher, info, null, enemy));
    expect(watcher._dice.rollSkill).not.toHaveBeenCalled();
    expect(usesLeft(watcher, itemOf(watcher).system.rules[0], itemOf(watcher), 0)).toBe(1);
  });
});

describe('Not Perfect, But Better / That\'s Right, Perfect (Reactions)', () => {
  function party(file) {
    const roller = makeActor('Roller');
    const sarge = makeActor('Sarge', file, { x: 50 });
    const foe = makeActor('Foe', null, { x: 5, disposition: -1 });
    const enemySarge = makeActor('Enemy Sarge', file, { x: 30, disposition: -1 });
    world(roller, sarge, foe, enemySarge);
    docs.set('Item.gun', { uuid: 'Item.gun', system: { damageValue: 3, damageType: 'blunt' } });
    return { roller, sarge, foe };
  }

  afterEach(() => setStoryPointHelpers(null));

  test('Not Perfect: an ally of the roller, any range, when the roll failed - not on a success', () => {
    const { roller, sarge, foe } = party(FILES.notPerfect);
    expect(reactionOffers(cardFor(roller, [[foe, 15]], 12).info).map(o => o.actor)).toEqual([sarge]);
    expect(reactionOffers(cardFor(roller, [[null, 15]], 12).info).map(o => o.actor)).toEqual([sarge]);
    expect(reactionOffers(cardFor(roller, [[foe, 10]], 12).info)).toEqual([]);
  });

  test('Not Perfect: spends a Story Point and turns the miss into a hit (its damage as the GM\'s Apply button), once a scene', async () => {
    const { roller, sarge, foe } = party(FILES.notPerfect);
    const spend = jest.fn();
    setStoryPointHelpers({ canSpendForActor: () => true, spendForActor: spend });
    const { info } = cardFor(roller, [[foe, 15]], 12, { flags: { itemUuid: 'Item.gun' } });
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(spend).toHaveBeenCalledWith(sarge, 1);
    expect(allChat()).toContain('data-amount="3"');
    expect(reactionOffers(cardFor(roller, [[foe, 15]], 12).info)).toEqual([]);
  });

  test('Not Perfect: not offered when the Story Point can\'t be spent', () => {
    const { roller, foe } = party(FILES.notPerfect);
    setStoryPointHelpers({ canSpendForActor: () => false, spendForActor: jest.fn() });
    expect(reactionOffers(cardFor(roller, [[foe, 15]], 12).info)).toEqual([]);
  });

  test('That\'s Right: offered on a success too; a crit adds the effect again (hit: base, miss: twice)', async () => {
    const { roller, sarge, foe } = party(FILES.thatsRight);
    expect(reactionOffers(cardFor(roller, [[foe, 10]], 12).info).map(o => o.actor)).toEqual([sarge]);
    const { info } = cardFor(roller, [[foe, 10]], 12, { flags: { itemUuid: 'Item.gun' } });
    await pressReaction(info, reactionOffers(info)[0]);
    expect(allChat()).toContain('data-amount="3"');
    global.ChatMessage.create.mockClear();
    const miss = cardFor(roller, [[foe, 15]], 12, { flags: { itemUuid: 'Item.gun' } });
    const fresh = makeActor('Sarge 2', FILES.thatsRight, { x: 60 });
    world(roller, fresh, foe);
    docs.set('Item.gun', { uuid: 'Item.gun', system: { damageValue: 3, damageType: 'blunt' } });
    await pressReaction(miss.info, reactionOffers(miss.info)[0]);
    expect(allChat()).toContain('data-amount="6"');
  });
});

describe('Energon Manipulator', () => {
  test('Defeating a Cybertronian or robot heals 1d2; a human, nothing', async () => {
    const holder = makeActor('Shockwave', FILES.energonManipulator, { system: { health: { value: 3, max: 10 } } });
    world(holder);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await fireTriggers(holder, 'defeatedEnemy', { targets: [{ name: 'Human', system: {}, items: [] }] });
    expect(holder.system.health.value).toBe(3);
    await fireTriggers(holder, 'defeatedEnemy', { targets: [{ name: 'Bumblebee', system: { canTransform: true }, items: [] }] });
    expect(holder.system.health.value).toBe(5);
    expect(allChat()).toContain('DiceRolled');
  });

  test('the Use heals 1d2, capped at the maximum', async () => {
    const holder = makeActor('Shockwave', FILES.energonManipulator, { system: { health: { value: 9, max: 10 } } });
    world(holder);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const line = await runUse(itemOf(holder), jest.fn(async () => true), { pick: async (item, available) => available.find(({ rule }) => rule.type == 'Use') });
    expect(holder.system.health.value).toBe(10);
    expect(line).toContain('Healed');
  });
});

test('Body of Energy: the chat line says how much moved', async () => {
  const ranger = makeActor('Ranger', FILES.bodyOfEnergy, { system: { isMorphed: true, health: { value: 2, max: 10 }, powers: { personal: { value: 1, max: 3 } } } });
  world(ranger);
  const line = await runUse(itemOf(ranger), jest.fn(async () => true));
  expect(ranger.system.health.value).toBe(1);
  expect(ranger.system.powers.personal.value).toBe(2);
  expect(line).toContain('turns 1 Health into Personal Power');
});
