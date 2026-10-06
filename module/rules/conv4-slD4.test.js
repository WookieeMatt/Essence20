import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD4: Point-Defense Reflexes (+ Advanced Anti-Air Training's no-penalty half) and Defender (PR) moved
 * off the react slice onto Reaction rules (wielding tags, the roll step's snag); Their Loss, My Gain onto
 * watch afterRoll Triggers with an outcome list; Musical Interlude onto a turnStart Trigger with a mark
 * lasting the combat and a button; Overcharge Engines onto Use rules (an open roll), a mark counter,
 * Movement rules, a MovementAction and a turnEnd Trigger. Each item is loaded from its pack source and
 * must do what the removed code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { reactionOffers, pressReaction } = await import('./reactions.mjs');
const { cardInfo } = await import('../helpers/extensions/react/core.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { ruleMovement, ruleMovementStages } = await import('./adapter.mjs');
const { resolveValue } = await import('./formula.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  pointDefense: 'qgtgitems/_source/Point_Defense_Reflexes_QmOeCUODYACCKiWG.json',
  defender: 'prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json',
  theirLoss: 'fmmcitems/_source/Their_Loss__My_Gain_mgTerJX1jxtVMQMJ.json',
  lossAndGain: 'fmmcitems/_source/Loss_And_Gain_kyqh747vyQnwSWu2.json',
  musicalInterlude: 'kocitems/_source/Musical_Interlude_0PVrQ1RsRNP023MO.json',
  overcharge: 'tfcrbitems/_source/Overcharge_Engines_BPHwAfGvLPZuJ1m1.json',
};

const UUID = {
  antiAir: 'Compendium.essence20.quartermasters_guide_to_gear.Item.YDv7PPjj6qgqKI9e',
  multiplication: 'Compendium.essence20.tf_crb.Item.K3FNcAMjjek1UaJk',
  theirLoss: 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.mgTerJX1jxtVMQMJ',
  lossAndGain: 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.kyqh747vyQnwSWu2',
};

/** foundry.utils.setProperty, for plain objects; a "-=key" part deletes that key. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const at = keys.reduce((node, key) => (node[key] ??= {}), object);
  if (last.startsWith('-=')) {
    delete at[last.slice(2)];
  } else {
    at[last] = value;
  }
}

let nextId = 1;

function makeItem(actor, data) {
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/**
 * An actor with a token on the canvas (x feet along, disposition), holding the pack items `files`
 * ({file, source?}) and any extra item data.
 */
function makeActor(name, files = [], { x = 0, disposition = 1, system = {}, extra = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 5, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
      essences: { strength: { value: 2, max: 2 }, speed: { value: 2, max: 2 }, smarts: { value: 2, max: 2 }, social: { value: 2, max: 2 } },
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
  for (const entry of [files].flat()) {
    const { file, source = null } = typeof entry == 'string' ? { file: entry } : entry;
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: doc.system, flags: source ? { core: { sourceId: source } } : {} }));
  }

  for (const data of extra) {
    items.push(makeItem(actor, data));
  }

  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemOf = actor => actor.items.contents[0];

/** An equipped weapon with one attack (weaponEffect) using `skill`, as items for makeActor's extra. */
function wielded(skill, { equipped = true, traits = [], style = 'melee' } = {}) {
  const id = `w${nextId++}`;
  return [
    { id, name: 'Weapon', type: 'weapon', system: { equipped, traits } },
    { name: 'Attack', type: 'weaponEffect', flags: { essence20: { parentId: id } }, system: { classification: { skill, style } } },
  ];
}

/** A posted check card from `attacker`: rows [[target or null, DIF]], the total, and card flags. */
function cardFor(attacker, rows, total, { id = `m${nextId++}`, flags = {}, damage = 3 } = {}) {
  const store = {};
  const content = rows.filter(([target]) => target).map(([target]) => `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="${damage}" data-damage-type="blunt">`).join('');
  const message = {
    id, speaker: { actor: attacker.id }, content,
    flags: { essence20: { checkResults: rows.map(([target, difficulty]) => ({ targetUuid: target?.uuid ?? null, difficulty, success: total >= difficulty })), isAttack: true, ...flags } },
    rolls: [{ total, formula: '1d20', dice: [{ faces: 20, results: [{ result: total, active: true }] }] }],
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
  for (const actor of actors) {
    for (const item of actor.items.contents) {
      item.uuid = `${actor.uuid}.Item.${item.id}`;
      docs.set(item.uuid, item);
    }
  }

  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null, [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
}

function setCombat(combat) {
  global.game.combat = combat;
  global.game.combats = { get: id => (combat?.id == id ? combat : null) };
}

const allChat = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.content ?? '').join(' ');
const ruleButtons = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.flags?.essence20?.ruleButton).filter(Boolean);

function dialogAnswers(...answers) {
  const wait = jest.fn(async () => answers.shift() ?? null);
  global.foundry.applications = { ...global.foundry.applications, api: { ...global.foundry.applications?.api, DialogV2: { wait } } };
  return wait;
}

const savedGame = global.game;
const savedFromUuid = global.fromUuid;
const savedFromUuidSync = global.fromUuidSync;
const savedConfig = global.CONFIG;

beforeEach(() => {
  global.game = {
    ...savedGame, combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.CONFIG = { ...savedConfig, E20: { ...(savedConfig?.E20 ?? {}), skillToEssence: { ...(savedConfig?.E20?.skillToEssence ?? {}), targeting: 'speed', technology: 'smarts' } } };
  global.ChatMessage = { ...global.ChatMessage, create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
  global.game = savedGame;
  global.CONFIG = savedConfig;
  global.fromUuid = savedFromUuid;
  global.fromUuidSync = savedFromUuidSync;
});

test('every slD4 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Point-Defense Reflexes (Contingency + Reaction)', () => {
  function setup({ attackerItem = { style: 'explosive' }, holderExtra = [], holderX = 30, holderDisposition = 1, weaponSkill = 'targeting' } = {}) {
    const weaponId = `w${nextId++}`;
    const attacker = makeActor('Cobra', [], {
      disposition: -1,
      extra: [
        { id: weaponId, name: 'Launcher', type: 'weapon', system: { equipped: true, traits: attackerItem.traits ?? [] } },
        { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weaponId } }, system: { classification: { skill: 'targeting', style: attackerItem.style ?? 'projectile' } } },
      ],
    });
    const victim = makeActor('Duke', [], { x: 10 });
    const holder = makeActor('Flint', FILES.pointDefense, { x: holderX, disposition: holderDisposition, extra: [...wielded(weaponSkill, { style: 'projectile' }), ...holderExtra] });
    world(attacker, victim, holder);
    const shot = attacker.items.contents[1];
    return { attacker, victim, holder, shot, card: () => cardFor(attacker, [[victim, 12]], 15, { flags: { itemUuid: shot.uuid } }) };
  }

  const toggled = holder => !!itemOf(holder).flags?.essence20?.rules?.toggles?.armed;

  test('the Use sets the Contingency (a Free action, once per turn); the start of the holder\'s turn clears it', async () => {
    const { holder } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    const pay = jest.fn(async () => true);
    const line = await runUse(itemOf(holder), pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(line).toContain('sets a Contingency');
    expect(toggled(holder)).toBe(true);
    // Once per turn.
    expect(useAvailable(itemOf(holder), itemOf(holder).system.rules[0], 0)).toBe(false);
    await fireTriggers(holder, 'turnStart');
    expect(toggled(holder)).toBe(false);
  });

  test('offered against an explosive or thrown attack to an armed holder wielding a Targeting weapon - either side, never the attacker', async () => {
    const { holder, card } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    expect(reactionOffers(card().info)).toEqual([]);
    await runUse(itemOf(holder), jest.fn(async () => true));
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    // Out of combat there is no turn to set it in: always ready.
    setCombat(null);
    itemOf(holder).flags.essence20.rules.toggles.armed = false;
    expect(reactionOffers(card().info).map(offer => offer.actor)).toEqual([holder]);
    // An ally of the attacker too (the second rule), one button.
    const ally = setup({ holderDisposition: -1 });
    expect(reactionOffers(ally.card().info).map(offer => offer.actor)).toEqual([ally.holder]);
  });

  test('a thrown weapon counts; a plain shot, or no Targeting weapon in hand, does not', () => {
    expect(reactionOffers(setup({ attackerItem: { style: 'projectile', traits: ['thrown'] } }).card().info)).toHaveLength(1);
    expect(reactionOffers(setup({ attackerItem: { style: 'projectile' } }).card().info)).toEqual([]);
    expect(reactionOffers(setup({ weaponSkill: 'might' }).card().info)).toEqual([]);
  });

  test('asks whether it is in range (closer: Snag), clears the Contingency, rolls Targeting against the total; a success negates every hit', async () => {
    const { holder, victim, card } = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    await runUse(itemOf(holder), jest.fn(async () => true));
    holder._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ success: true, multiplier: 1 }] }] })) };
    const wait = dialogAnswers('1');
    const { message, info } = card();
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    expect(wait).toHaveBeenCalled();
    expect(holder._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'targeting', dif: '15', snag: true }), holder);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([victim.uuid]);
    expect(toggled(holder)).toBe(false);
    expect(allChat()).toContain('shoots the incoming weapon down');
  });

  test('in range: no Snag; backing out of the question changes nothing', async () => {
    const { holder, card } = setup();
    holder._dice = { rollSkill: jest.fn(async () => ({ success: false })) };
    dialogAnswers('0');
    const first = card();
    await pressReaction(first.info, reactionOffers(first.info)[0]);
    expect(holder._dice.rollSkill.mock.calls[0][0].snag).toBeUndefined();
    expect(first.message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    dialogAnswers(null);
    const second = card();
    expect(await pressReaction(second.info, reactionOffers(second.info)[0])).toBe(false);
    expect(holder._dice.rollSkill).toHaveBeenCalledTimes(1);
  });

  test('Advanced Anti-Air Training: no question and no Snag', async () => {
    const { holder, card } = setup({ holderExtra: [{ name: 'Advanced Anti-Air Training', type: 'perk', flags: { core: { sourceId: UUID.antiAir } } }] });
    holder._dice = { rollSkill: jest.fn(async () => ({ success: true })) };
    const wait = dialogAnswers();
    const { info } = card();
    await pressReaction(info, reactionOffers(info)[0]);
    expect(wait).not.toHaveBeenCalled();
    expect(holder._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'targeting', dif: '15' });
    expect(holder._dice.rollSkill.mock.calls[0][0].snag).toBeUndefined();
  });
});

describe('Defender (PR, Reaction)', () => {
  function setup({ holderX = 5, finesse = { shift: 'd6', specializations: { s: { name: 'Swords' } } }, weapon = wielded('finesse'), total = 15, melee = true } = {}) {
    const attacker = makeActor('Putty', [], { disposition: -1, x: 5 });
    const ally = makeActor('Red', [], { x: 0 });
    const holder = makeActor('Pink', FILES.defender, { x: holderX, system: { skills: { finesse } }, extra: weapon });
    world(attacker, ally, holder);
    return { attacker, ally, holder, ...cardFor(attacker, [[ally, 12]], total, { flags: { isMelee: melee } }) };
  }

  test('offered to an adjacent ally of the one hit in melee, wielding a Finesse weapon, Specialized in Finesse', () => {
    const { holder, info } = setup();
    expect(reactionOffers(info).map(offer => offer.actor)).toEqual([holder]);
    expect(reactionOffers(setup({ holderX: 20 }).info)).toEqual([]);
    expect(reactionOffers(setup({ finesse: { shift: 'd6' } }).info)).toEqual([]);
    expect(reactionOffers(setup({ finesse: { shift: 'd6', isSpecialized: true } }).info)).toHaveLength(1);
    expect(reactionOffers(setup({ weapon: wielded('might') }).info)).toEqual([]);
    expect(reactionOffers(setup({ weapon: wielded('finesse', { equipped: false }) }).info)).toEqual([]);
    expect(reactionOffers(setup({ total: 10 }).info)).toEqual([]);
    expect(reactionOffers(setup({ melee: false }).info)).toEqual([]);
    // No Skill Die to roll.
    expect(reactionOffers(setup({ finesse: { shift: 'd20', isSpecialized: true } }).info)).toEqual([]);
  });

  test('rolls the Finesse die and lowers the total - below the DIF, the hit is gone', async () => {
    const { ally, message, info } = setup();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(await pressReaction(info, reactionOffers(info)[0])).toBe(true);
    // 15 - 6 = 9, under DIF 12.
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([ally.uuid]);
  });

  test('a small roll leaves the hit standing', async () => {
    const { message, info } = setup({ finesse: { shift: 'd2', isSpecialized: true } });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await pressReaction(info, reactionOffers(info)[0]);
    expect(message.getFlag('essence20', 'reactNegated')).toBeUndefined();
    expect(allChat()).toContain('CardStillHits');
  });
});

describe('Their Loss, My Gain (watch afterRoll)', () => {
  const fumble = { outcome: 'fumble', facts: { results: [{ success: false }], isFumble: true } };

  function setup({ level = 6, x = 30, lossAndGain = null } = {}) {
    const roller = makeActor('Roller', [], { disposition: -1 });
    const files = [{ file: FILES.theirLoss, source: UUID.theirLoss }];
    const holder = makeActor('Thorn', files, { x, system: { level, health: { value: 1, max: 9 } } });
    if (lossAndGain !== null) {
      const doc = fromPack(FILES.lossAndGain);
      holder.items.contents.push(makeItem(holder, { name: doc.name, type: doc.type, flags: { core: { sourceId: UUID.lossAndGain } }, system: { ...doc.system, bonus: { ...doc.system.bonus, value: lossAndGain } } }));
      rebuildIndex(holder);
    }

    world(roller, holder);
    return { roller, holder };
  }

  test('someone within 60 ft Fumbling (and failing) heals the Loss and Gain number for the level', async () => {
    const { roller, holder } = setup();
    await fireTriggers(roller, 'afterRoll', fumble);
    // 6th level: 2.
    expect(holder.system.health.value).toBe(3);
    expect(allChat()).toContain('Thorn feeds on Roller');
  });

  test('not out of range, not on a plain failure, not on a Fumble that still succeeded, not on the holder\'s own roll', async () => {
    const far = setup({ x: 100 });
    await fireTriggers(far.roller, 'afterRoll', fumble);
    expect(far.holder.system.health.value).toBe(1);
    const near = setup();
    await fireTriggers(near.roller, 'afterRoll', { outcome: 'failure', facts: { results: [{ success: false }], isFumble: false } });
    await fireTriggers(near.roller, 'afterRoll', { outcome: 'fumble', facts: { results: [{ success: true }], isFumble: true } });
    await fireTriggers(near.holder, 'afterRoll', fumble);
    expect(near.holder.system.health.value).toBe(1);
  });

  test('the level number: 1, then +1 at 6th, 11th and 16th', () => {
    const amount = fromPack(FILES.theirLoss).system.rules[0].steps[1].amount;
    expect([1, 5, 6, 11, 16, 20].map(level => resolveValue(amount, { actor: { system: { level } } }))).toEqual([1, 1, 2, 3, 4, 4]);
  });

  test('with Loss And Gain held, its own value heals instead - once, not twice', async () => {
    const { roller, holder } = setup({ level: 2, lossAndGain: 4 });
    await fireTriggers(roller, 'afterRoll', fumble);
    expect(holder.system.health.value).toBe(5);
    // A Loss And Gain at 0 falls back to the level number.
    const zero = setup({ level: 11, lossAndGain: 0 });
    await fireTriggers(zero.roller, 'afterRoll', fumble);
    expect(zero.holder.system.health.value).toBe(4);
  });
});

describe('Musical Interlude (Hang-Up)', () => {
  test('the first turn of each combat posts a "suffer 1 Stress" button; later turns of that combat don\'t', async () => {
    const pony = makeActor('Pony', FILES.musicalInterlude);
    world(pony);
    const combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    setCombat(combat);
    await fireTriggers(pony, 'turnStart');
    expect(ruleButtons()).toHaveLength(1);
    expect(ruleButtons()[0]).toMatchObject({ who: 'owner', once: false });
    await fireTriggers(pony, 'turnStart');
    expect(ruleButtons()).toHaveLength(1);
    // A new combat asks again.
    setCombat({ id: 'c2', started: true, round: 1, turn: 0, turns: [] });
    await fireTriggers(pony, 'turnStart');
    expect(ruleButtons()).toHaveLength(2);
    // No combat, no question.
    setCombat(null);
    pony.flags.essence20.ruleMarks = {};
    await fireTriggers(pony, 'turnStart');
    expect(ruleButtons()).toHaveLength(2);
  });

  test('the button takes 1 Health, or 1 from the Essence picked', async () => {
    const pony = makeActor('Pony', FILES.musicalInterlude);
    world(pony);
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    await fireTriggers(pony, 'turnStart');
    const { steps } = ruleButtons()[0];
    const health = stepContext({ actor: pony, item: itemOf(pony), targets: [], ask: async () => 0 });
    await runSteps(steps, health);
    expect(pony.system.health.value).toBe(9);
    const essence = stepContext({ actor: pony, item: itemOf(pony), targets: [], ask: async () => 1 });
    essence.askPick = jest.fn(async () => 'social');
    await runSteps(steps, essence);
    expect(pony.system.essences.social.value).toBe(1);
    expect(pony.system.health.value).toBe(9);
  }, 20000);
});

describe('Overcharge Engines', () => {
  function setup(extra = []) {
    const bot = makeActor('Wheeljack', FILES.overcharge, {
      extra,
      system: { movement: { aerial: { total: 0 }, ground: { total: 30 }, climb: { total: 15 }, swim: { total: 15 }, burrow: { total: 0 } } },
    });
    world(bot);
    // An open roll's total (a targeted roll's results carry it too).
    bot._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ results: [{ success: true, total: 17 }], roll: { total: 17 } }] })) };
    return bot;
  }

  const available = bot => itemOf(bot).system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use')
    .some(({ rule, index }) => useAvailable(itemOf(bot), rule, index));
  const use = bot => runUse(itemOf(bot), jest.fn(async () => true));

  test('a Free action in combat only: Technology, rounded up to 5 ft, added to every Movement the actor has until the turn ends', async () => {
    const bot = setup();
    expect(available(bot)).toBe(false);
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    expect(available(bot)).toBe(true);
    const line = await use(bot);
    expect(bot._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology' }), bot);
    expect(line).toContain('increase by 20 ft');
    expect(resolveValue('@mark.overcharge', { actor: bot })).toBe(20);
    const stage = ruleMovementStages(bot);
    expect(stage('final', 'ground', 30)).toBe(50);
    expect(stage('final', 'climb', 15)).toBe(35);
    expect(stage('final', 'aerial', 0)).toBeNull();
    expect(stage('final', 'burrow', 0)).toBeNull();
    expect(ruleMovement(bot).ignoreRoughTerrain).toBe(true);
    // Once per turn.
    expect(available(bot)).toBe(false);
    // The turn ends: gone.
    await fireTriggers(bot, 'turnEnd');
    expect(bot.flags.essence20.ruleMarks?.overcharge).toBeUndefined();
    expect(ruleMovement(bot).ignoreRoughTerrain).toBe(false);
    expect(ruleMovementStages(bot)('final', 'ground', 30)).toBeNull();
  });

  test('Multiplication: twice a turn, each use adding its own feet', async () => {
    const bot = setup([{ name: 'Multiplication', type: 'perk', flags: { core: { sourceId: UUID.multiplication } } }]);
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    await use(bot);
    expect(available(bot)).toBe(true);
    await use(bot);
    expect(resolveValue('@mark.overcharge', { actor: bot })).toBe(40);
    expect(available(bot)).toBe(false);
    // The next turn it's back, and the old feet have run out.
    setCombat({ id: 'c1', started: true, round: 1, turn: 1, turns: [] });
    expect(available(bot)).toBe(true);
    expect(resolveValue('@mark.overcharge', { actor: bot })).toBe(0);
  });

  test('a cancelled roll spends no use', async () => {
    const bot = setup();
    setCombat({ id: 'c1', started: true, round: 1, turn: 0, turns: [] });
    bot._dice.rollSkill.mockResolvedValueOnce(null);
    await use(bot);
    expect(available(bot)).toBe(true);
    expect(resolveValue('@mark.overcharge', { actor: bot })).toBe(0);
  });
});
