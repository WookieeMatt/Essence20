import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, part "durations" (docs/rules-batches/book-durations.md): how long these items' effects last, per their
 * rulebooks - "until the start / end of your (their) next turn", "for N rounds", "for the rest of this turn", "for one
 * scene" - and the core rule that a round is 6 seconds (rounds:N out of combat).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runUse, useAvailable, fireTriggers } = await import('./triggers.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { applyTimedCondition, turnBoundTiming } = await import('../mechanics/combat/timed-status.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  loyalMinions: 'dditems/_source/Loyal_Minions_MIghwIOKR1AqeQiY.json',
  remoteOperations: 'fffav1items/_source/Remote_Operations_HTQEaadz9eZ5ZkC1.json',
  rallyingCry: 'gijcrbitems/_source/Rallying_Cry_cBbQVq9ZqcVUpAQs.json',
  bioEnergy: 'bthitems/_source/Bio_Energy_Conversion_W1fwCDu7FOmg0yaQ.json',
  boxShot: 'qgtgitems/_source/Box_Shot_N8E3QTLUKX6DOoEc.json',
  phantom: 'gijcrbitems/_source/Phantom_Z92UggPHdmt47A7Q.json',
  resilience: 'prcrbitems/_source/Resilience_TomU7e31oHoRsIrT.json',
  riseAgain: 'ttsgitems/_source/Rise_Again_9DCNlVGfsEgUX6SC.json',
  flyInTheFuture: 'gijcrbitems/_source/Fly_In_The_Future_rFeczlniKUs8Rk3q.json',
  consultMemories: 'fgtaaitems/_source/Consult_Memories_YzvU6WpADTfuGVLj.json',
  deadstick: 'qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json',
  absoluteMenace: 'bthitems/_source/Absolute_Menace_YsoS30FKigTm19CH.json',
  logicalExplanation: 'wtnvcgitems/_source/A_Logical_Explanation_CiDQxCxgnnosvBDo.json',
  elementalStorm: 'bthitems/_source/Elemental_Storm_6IoMpj8pWmP8IpH4.json',
  soothe: 'ghpfitems/_source/Soothe_vzTeGdjO3v2oeR19.json',
  voiceOfPrimus: 'eocitems/_source/Voice_of_Primus_m8oHzT4BUB79NiVw.json',
  extendedAttack: 'tfcrbitems/_source/Extended_Attack_bpTOPVRx3hKkq4Yr.json',
  hardCorps: 'sssitems/_source/Hard_Corps_IR8Rl7IXn0zKBBXV.json',
  technicalMastery: 'qgtgitems/_source/Technical_Mastery_QKlXoVgNMq7Kv58L.json',
  naturalMovement: 'gijcrbitems/_source/Natural_Movement_TLI74oM0tbDtQ298.json',
  standFirm: 'tfcrbitems/_source/Stand_Firm_rAxKrR4ObFGeH5yP.json',
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
const rulesOf = key => fromPack(FILES[key]).system.rules;
/** Every step in a rule list, nested ones (choose options, onHit / onSuccess) included. */
function allSteps(rules) {
  const out = [];
  const walk = value => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value == 'object') {
      if (value.do) {
        out.push(value);
      }

      Object.values(value).forEach(walk);
    }
  };

  walk(rules);
  return out;
}

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

function makeEffect(statusId) {
  return {
    statuses: new Set([statusId]), data: {},
    async update(changes) {
      Object.assign(this.data, changes);
    },
  };
}

function makeActor(name, files = [], { system = {} } = {}) {
  const items = [];
  const effects = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 20, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      defenses: { toughness: { total: 10 }, evasion: { total: 10 }, willpower: { total: 11 }, cleverness: { total: 14 } }, ...system,
    },
    effects: { find: fn => effects.find(fn), contents: effects },
    async toggleStatusEffect(id, { active }) {
      if (active) {
        this.statuses.add(id);
        if (!effects.some(effect => effect.statuses.has(id))) {
          effects.push(makeEffect(id));
        }
      } else {
        this.statuses.delete(id);
        effects.splice(0, effects.length, ...effects.filter(effect => !effect.statuses.has(id)));
      }

      return true;
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
  const token = { actor, document: { disposition: 1 }, center: { x: 0, y: 0 }, id: `t${actor.id}` };
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

/** A started combat with these actors in this turn order. */
function combatOf(actors, round = 1, turn = 0) {
  return { id: 'c1', started: true, round, turn, turns: actors.map((actor, index) => ({ id: `cb${index}`, actor })) };
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
const pay = jest.fn(async () => true);
const savedGame = global.game;
let epoch = 1;

beforeEach(() => {
  pay.mockClear();
  epoch = 1;
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => epoch, set: async () => {} }, time: { worldTime: 0 },
    i18n: { localize: key => key, format: key => key, has: () => false },
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

test('every rule on these items validates', () => {
  for (const [key, file] of Object.entries(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect([key, validateRule(rule)]).toEqual([key, []]);
    }
  }
});

/* -------------------------------------------- */
/*  rounds:N out of combat (Core Rulebook, Time) */
/* -------------------------------------------- */

describe('rounds:N out of combat: 6 seconds a round, or the scene', () => {
  test('it runs out after N x 6 seconds of game time', () => {
    const entry = { until: 'rounds:10', stamp: stampFor('rounds:10', null) };
    expect(entry.stamp).toEqual({ oocRounds: 10, time: 0, sceneEpoch: 1 });
    game.time.worldTime = 59;
    expect(isExpired(entry, null)).toBe(false);
    game.time.worldTime = 60;
    expect(isExpired(entry, null)).toBe(true);
  });

  test('it also ends with the scene', () => {
    const entry = { until: 'rounds:10', stamp: stampFor('rounds:10', null) };
    epoch = 2;
    expect(isExpired(entry, null)).toBe(true);
  });

  test('a combat starting meanwhile gets the rounds still left', () => {
    game.time.worldTime = 100;
    const entry = { until: 'rounds:3', stamp: stampFor('rounds:3', null) };
    game.time.worldTime = 106;
    // One round used up out of combat: rounds 1 and 2 of the combat remain.
    expect(isExpired(entry, { id: 'c', started: true, round: 2, turn: 0 })).toBe(false);
    expect(isExpired(entry, { id: 'c', started: true, round: 3, turn: 0 })).toBe(true);
  });

  test('in a running combat rounds:N still counts the turn order', () => {
    const combat = { id: 'c', started: true, round: 2, turn: 1 };
    const entry = { until: 'rounds:1', stamp: stampFor('rounds:1', combat) };
    expect(isExpired(entry, { ...combat, round: 3, turn: 0 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 3, turn: 1 })).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Conditions that end with someone's next turn */
/* -------------------------------------------- */

describe('applyCondition until: nextTurn / endOfNextTurn', () => {
  test('turnBoundTiming: this round\'s turn when it has not acted yet, else the next round\'s', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const combat = combatOf([a, b], 1, 0);
    expect(turnBoundTiming('endOfNextTurn', b, combat)).toEqual({ value: 0, expiry: 'turnEnd', combatantId: 'cb1' });
    expect(turnBoundTiming('endOfNextTurn', a, combat)).toEqual({ value: 1, expiry: 'turnEnd', combatantId: 'cb0' });
    expect(turnBoundTiming('nextTurn', a, combat)).toEqual({ value: 1, expiry: 'turnStart', combatantId: 'cb0' });
    expect(turnBoundTiming('nextTurn', { id: 'stranger' }, combat)).toBeNull();
    expect(turnBoundTiming('nextTurn', a, { ...combat, started: false })).toBeNull();
    expect(turnBoundTiming('rounds:2', a, combat)).toBeNull();
  });

  test('applyTimedCondition writes v14\'s own expiry onto the effect', async () => {
    const target = makeActor('Target');
    game.combat = { ...combatOf([target], 2, 0), id: 'c9' };
    await applyTimedCondition(target, 'stunned', 0, { value: 1, expiry: 'turnEnd', combatantId: 'cb0' });
    expect(target.statuses.has('stunned')).toBe(true);
    expect(target.effects.contents[0].data).toEqual({
      'duration.value': 1, 'duration.units': 'rounds', 'duration.expiry': 'turnEnd',
      'start.combat': 'c9', 'start.combatant': 'cb0', 'start.round': 2, 'start.turn': 0,
    });
  });

  test('the step counts the recipient\'s turns with untilOf: recipient, the holder\'s by default', async () => {
    const holder = makeActor('Scientist');
    const target = makeActor('Enemy');
    game.combat = combatOf([holder, target], 1, 0);
    const ctx = stepContext({ actor: holder, item: { id: 'x', name: 'Test' }, targets: [target] });
    await runSteps([{ do: 'applyCondition', condition: 'stunned', to: 'target', until: 'endOfNextTurn', untilOf: 'recipient' }], ctx);
    expect(target.effects.contents[0].data).toMatchObject({ 'duration.value': 0, 'duration.expiry': 'turnEnd', 'start.combatant': 'cb1' });
    await runSteps([{ do: 'applyCondition', condition: 'frightened', to: 'target', until: 'endOfNextTurn' }], ctx);
    expect(target.effects.contents[1].data).toMatchObject({ 'duration.value': 1, 'duration.expiry': 'turnEnd', 'start.combatant': 'cb0' });
    await runSteps([{ do: 'applyCondition', condition: 'mesmerized', to: 'target', until: 'nextTurn' }], ctx);
    expect(target.effects.contents[2].data).toMatchObject({ 'duration.value': 1, 'duration.expiry': 'turnStart', 'start.combatant': 'cb0' });
  });

  // Out of combat (book check follow-ups): 1 round = 6 seconds of game time, a rounds:1 stamp.
  test('outside the turn order it lasts 1 round; out of combat 1 round of game time', async () => {
    const holder = makeActor('Handler');
    const target = makeActor('Dog');
    const ctx = stepContext({ actor: holder, item: { id: 'x', name: 'Test' }, targets: [target] });
    await runSteps([{ do: 'applyCondition', condition: 'mesmerized', to: 'target', until: 'nextTurn' }], ctx);
    expect(target.statuses.has('mesmerized')).toBe(true);
    expect(target.effects.contents[0].data).toEqual({ 'flags.essence20.oocConditionExpiry': expect.objectContaining({ until: 'rounds:1' }) });
    game.combat = combatOf([target], 3, 0);
    await runSteps([{ do: 'applyCondition', condition: 'stunned', to: 'target', until: 'nextTurn' }], ctx);
    expect(target.effects.contents[1].data).toEqual({ 'duration.rounds': 1, 'duration.startRound': 3, 'duration.startTurn': 0 });
  });

  test('applyCondition until takes only the next-turn durations', () => {
    expect(stepErrors([{ do: 'applyCondition', condition: 'stunned', until: 'endOfNextTurn', untilOf: 'recipient' }])).toEqual([]);
    expect(stepErrors([{ do: 'applyCondition', condition: 'stunned', until: 'scene' }])).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  The items                                    */
/* -------------------------------------------- */

describe('Conditions with the book\'s duration', () => {
  const conditionSteps = key => allSteps(rulesOf(key)).filter(step => step.do == 'applyCondition');

  test('Deadstick: Stunned for 1 round', () => {
    expect(conditionSteps('deadstick').map(step => step.rounds)).toEqual([1, 1]);
  });

  test('Absolute Menace: Frightened until the end of your next turn', () => {
    expect(conditionSteps('absoluteMenace')).toEqual([expect.objectContaining({ condition: 'frightened', until: 'endOfNextTurn' })]);
    expect(conditionSteps('absoluteMenace')[0].untilOf).toBeUndefined();
  });

  test('A Logical Explanation: Stunned until the end of THEIR next turn', () => {
    expect(conditionSteps('logicalExplanation')).toEqual([expect.objectContaining({ condition: 'stunned', until: 'endOfNextTurn', untilOf: 'recipient' })]);
  });

  test('Elemental Storm: the Condition until the end of their next turn; once per scene', () => {
    expect(conditionSteps('elementalStorm').map(step => [step.condition, step.until, step.untilOf]))
      .toEqual([['blinded', 'endOfNextTurn', 'recipient'], ['deafened', 'endOfNextTurn', 'recipient'], ['prone', 'endOfNextTurn', 'recipient']]);
    expect(rulesOf('elementalStorm')[0].limit).toEqual({ per: 'scene' });
  });

  test('Soothe: Mesmerized until the start of your next turn', () => {
    expect(conditionSteps('soothe')).toEqual([expect.objectContaining({ condition: 'mesmerized', until: 'nextTurn' })]);
  });

  test('Voice of Primus: Frightened for 2d2 rounds', () => {
    expect(conditionSteps('voiceOfPrimus').map(step => step.rounds)).toEqual(['2d2', '2d2']);
  });
});

describe('effects that end with your next turn', () => {
  test('Loyal Minions: the orders last until the start of your next turn', () => {
    const toggle = allSteps(rulesOf('loyalMinions')).find(step => step.do == 'setToggle');
    expect(toggle).toMatchObject({ key: 'orders', value: true, until: 'nextTurnOrScene' });
  });

  test('Remote Operations: a Standard action, for the rest of this turn', () => {
    const use = rulesOf('remoteOperations')[0];
    expect(use.cost).toEqual({ action: 'standard' });
    expect(allSteps(use).find(step => step.do == 'mark')).toMatchObject({ key: 'remoteOperations', until: 'turnOrScene' });
  });

  test('Rallying Cry (GI Joe): a Free action; Edge until the end of your next turn, or until you are Defeated', () => {
    const [use, edge] = rulesOf('rallyingCry');
    expect(use.cost).toEqual({ action: 'free' });
    expect(use.steps[0]).toMatchObject({ do: 'mark', key: 'rallyingCry', until: 'endOfNextTurn' });
    expect(edge.when).toEqual(['attack', 'not:holder:status:defeated']);
  });

  test('Bio-Energy Conversion: a Standard action; ↑2 / +2 damage only on your next turn', () => {
    const [use, up, damage] = rulesOf('bioEnergy');
    expect(use.cost).toEqual({ action: 'standard' });
    expect(use.steps.map(step => [step.key, step.until])).toEqual([['bioEnergyWait', 'nextTurnOrScene'], ['bioEnergyNext', 'endOfNextTurnOrScene']]);
    for (const rule of [up, damage]) {
      expect(rule.when).toEqual(['attack', 'self:marked:bioEnergyNext', 'not:self:marked:bioEnergyWait']);
    }

    // In combat: off for the rest of this turn and the others' turns, on through the end of your next one.
    const a = { id: 'a' };
    const combat = combatOf([a, { id: 'b' }], 1, 0);
    const wait = { until: 'nextTurnOrScene', stamp: stampFor('nextTurnOrScene', combat, a) };
    const next = { until: 'endOfNextTurnOrScene', stamp: stampFor('endOfNextTurnOrScene', combat, a) };
    const live = at => isExpired(wait, at) && !isExpired(next, at);
    expect(live({ ...combat, turn: 1 })).toBe(false);
    expect(live({ ...combat, round: 2, turn: 0 })).toBe(true);
    expect(live({ ...combat, round: 2, turn: 1 })).toBe(false);
  });

  test('Resilience: the Athletics die on every attack until the start of your next turn', () => {
    const bank = allSteps(rulesOf('resilience')).find(step => step.do == 'bank');
    expect(bank).toMatchObject({ persist: true, until: 'nextTurnOrScene' });
  });

  test('Rise Again: a Free action once per scene, +5 to a Defense until the start of your next turn', () => {
    const use = rulesOf('riseAgain').find(rule => rule.type == 'Use');
    expect(use.cost).toEqual({ action: 'free' });
    expect(use.limit).toEqual({ per: 'scene' });
    const banks = allSteps(use).filter(step => step.do == 'bank');
    expect(banks).toHaveLength(4);
    expect(banks.every(step => step.persist === true && step.until == 'nextTurnOrScene' && step.defenseBonus == 5)).toBe(true);
  });

  test('Fly In The Future: evasive flying until your next turn, with a button to end it early', () => {
    const uses = rulesOf('flyInTheFuture').filter(rule => rule.type == 'Use');
    expect(uses[0].steps[0]).toMatchObject({ do: 'setToggle', key: 'evasive', value: true, until: 'nextTurnOrScene' });
    expect(uses[1].steps[0]).toMatchObject({ do: 'setToggle', key: 'evasive', value: false });
  });

  test('Extended Attack: a Move action, until your next turn starts', () => {
    const use = rulesOf('extendedAttack')[0];
    expect(use.cost).toEqual({ action: 'move' });
    expect(use.when).toEqual(['not:self:toggle:on']);
    // Book check follow-ups: the weapon is picked first (one Melee weapon).
    expect(use.steps[1]).toMatchObject({ do: 'setToggle', key: 'on', value: true, until: 'nextTurnOrScene' });
  });

  test('Natural Movement: the Movement lasts until the end of your next turn', () => {
    const toggle = allSteps(rulesOf('naturalMovement')).find(step => step.do == 'setToggle' && step.value === true);
    expect(toggle.until).toBe('endOfNextTurnOrScene');
  });

  test('Stand Firm: doubles the Stalwart Defense banks in place, keeping their until-your-next-turn', () => {
    expect(allSteps(rulesOf('standFirm')).find(step => step.do == 'scaleBank')).toMatchObject({ multiply: 2 });
  });

  test('Phantom: a Free action; Invisible until the start of your next turn', async () => {
    const infiltrator = makeActor('Infiltrator', FILES.phantom);
    scene(infiltrator);
    const perk = itemNamed(infiltrator, 'Phantom');
    expect(perk.system.rules[0].cost).toEqual({ action: 'free' });
    await runUse(perk, pay);
    expect(infiltrator.statuses.has('invisible')).toBe(true);
    expect(perk.flags.essence20.rules.toggles.on).toBe(true);
    await fireTriggers(infiltrator, 'turnStart');
    expect(infiltrator.statuses.has('invisible')).toBe(false);
    expect(perk.flags.essence20.rules.toggles.on).toBe(false);
  });

  test('Box Shot: once per combat, used up by the one attack', async () => {
    const soldier = makeActor('Soldier', FILES.boxShot);
    scene(soldier);
    const perk = itemNamed(soldier, 'Box Shot');
    await runUse(perk, pay, { which: 'Switch Box Shot on' });
    expect(perk.flags.essence20.rules.toggles.on).toBe(true);
    await fireTriggers(soldier, 'afterRoll', { roll: { isAttack: true }, outcome: 'success', facts: { results: [] } });
    expect(perk.flags.essence20.rules.toggles.on).toBe(false);
  });
});

describe('scene-long effects', () => {
  test('Consult Memories: one scene (and once a scene)', () => {
    const use = rulesOf('consultMemories')[0];
    expect(use.limit).toEqual({ per: 'scene' });
    expect(allSteps(use).find(step => step.do == 'mark')).toMatchObject({ key: 'consultMemories', until: 'scene' });
  });

  test('Technical Mastery: the Trade School ally may crit on the d2 for the whole coached scene', () => {
    expect(rulesOf('technicalMastery')).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CritOnD2', scope: 'marked', mark: 'tradeSchool', when: ['skill:technology'] }),
    ]));
  });

  test('Hard Corps: the ignored damage is also settled when the scene ends', async () => {
    const marine = makeActor('Marine', FILES.hardCorps, { system: { health: { value: 2, max: 4 } } });
    scene(marine);
    const ctx = stepContext({ actor: marine, item: itemNamed(marine, 'Hard Corps'), targets: [] });
    await runSteps([{ do: 'mark', key: 'hardCorps', to: 'self', count: 3, text: 'old' }], ctx);
    await fireTriggers(marine, 'sceneStart');
    expect(marine.statuses.has('defeated')).toBe(true);
    expect(marine.flags.essence20.ruleMarks.hardCorps ?? null).toBeNull();
    // Health above the debt: no Defeat, the debt is cleared.
    const tough = makeActor('Tough', FILES.hardCorps, { system: { health: { value: 4, max: 4 } } });
    scene(tough);
    await runSteps([{ do: 'mark', key: 'hardCorps', to: 'self', count: 3, text: 'old' }], stepContext({ actor: tough, item: itemNamed(tough, 'Hard Corps'), targets: [] }));
    await fireTriggers(tough, 'sceneStart');
    expect(tough.statuses.has('defeated')).toBe(false);
    expect(tough.flags.essence20.ruleMarks.hardCorps ?? null).toBeNull();
  });
});

test('the Uses still offer themselves', () => {
  const minion = makeActor('Leader', FILES.loyalMinions);
  const perk = itemNamed(minion, 'Loyal Minions');
  expect(useAvailable(perk, perk.system.rules[0], 0)).toBe(true);
});
