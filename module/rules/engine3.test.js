import { jest } from '@jest/globals';
import { isExpired, isValidUntil, stampFor } from './expiry.mjs';
import { runSteps, stepContext, stepErrors } from './steps.mjs';

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let epoch;

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] }, settings: { get: () => epoch },
    i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

function combatAt(round, turn) {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  return { id: 'cb', started: true, round, turn, turns: [{ actor: a }, { actor: b }, { actor: c }], a, b, c };
}

describe('durations: endOfNextTurn, rounds:N, turnOrScene / roundOrScene', () => {
  test('known durations', () => {
    expect(['endOfNextTurn', 'turnOrScene', 'roundOrScene', 'rounds:1', 'rounds:12', 'scene'].every(isValidUntil)).toBe(true);
    expect(['rounds:0', 'rounds:x', 'nextWeek', ''].some(isValidUntil)).toBe(false);
  });

  test('endOfNextTurn lasts through the actor\'s next turn, not just the current one', () => {
    const combat = combatAt(1, 1);
    // b is acting now (turn 1): its next turn is round 2, turn 1.
    const entry = { until: 'endOfNextTurn', stamp: stampFor('endOfNextTurn', combat, combat.b) };
    expect(isExpired(entry, { ...combat, round: 2, turn: 0 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 2, turn: 1 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 2, turn: 2 })).toBe(true);
    // c hasn't acted yet this round: its next turn is this round's turn 2.
    const forC = { until: 'endOfNextTurn', stamp: stampFor('endOfNextTurn', combat, combat.c) };
    expect(isExpired(forC, { ...combat, turn: 2 })).toBe(false);
    expect(isExpired(forC, { ...combat, round: 2, turn: 0 })).toBe(true);
    // Not in the turn order: through the end of the next round.
    const outsider = { until: 'endOfNextTurn', stamp: stampFor('endOfNextTurn', combat, { id: 'z' }) };
    expect(isExpired(outsider, { ...combat, round: 2, turn: 2 })).toBe(false);
    expect(isExpired(outsider, { ...combat, round: 3, turn: 0 })).toBe(true);
    // Out of combat: no stamp, lasts until something else ends it.
    expect(stampFor('endOfNextTurn', null, combat.b)).toBeNull();
  });

  test('rounds:N ends at the same point in the order N rounds on; out of combat 6 seconds a round, or the scene', () => {
    const combat = combatAt(2, 1);
    const entry = { until: 'rounds:2', stamp: stampFor('rounds:2', combat) };
    expect(isExpired(entry, { ...combat, round: 4, turn: 0 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 4, turn: 1 })).toBe(true);
    expect(isExpired(entry, { ...combat, id: 'other' })).toBe(true);
    // Out of combat (book check 2026-10-06): a round is 6 seconds of game time; the scene ending also ends it.
    const outOfCombat = { until: 'rounds:2', stamp: stampFor('rounds:2', null) };
    expect(outOfCombat.stamp).toEqual({ oocRounds: 2, time: 0, sceneEpoch: 1 });
    expect(isExpired(outOfCombat, null)).toBe(false);
    epoch = 2;
    expect(isExpired(outOfCombat, null)).toBe(true);
  });

  test('turnOrScene / roundOrScene: the turn / round in combat, else the scene', () => {
    const combat = combatAt(1, 0);
    const turn = { until: 'turnOrScene', stamp: stampFor('turnOrScene', combat) };
    expect(isExpired(turn, combat)).toBe(false);
    expect(isExpired(turn, { ...combat, turn: 1 })).toBe(true);
    const round = { until: 'roundOrScene', stamp: stampFor('roundOrScene', combat) };
    expect(isExpired(round, { ...combat, turn: 2 })).toBe(false);
    expect(isExpired(round, { ...combat, round: 2 })).toBe(true);
    const scene = { until: 'turnOrScene', stamp: stampFor('turnOrScene', null) };
    expect(isExpired(scene, combat)).toBe(false);
    epoch = 5;
    expect(isExpired(scene, combat)).toBe(true);
  });

  test('a mark with untilOf: recipient counts the marked creature\'s turns', async () => {
    const combat = combatAt(1, 0);
    global.game.combat = combat;
    const holder = combat.a;
    Object.assign(holder, { uuid: 'Actor.a', flags: {}, isOwner: true });
    const target = Object.assign(combat.c, { uuid: 'Actor.c', flags: {}, isOwner: true, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } });
    const ctx = stepContext({ actor: holder, item: { id: 'i', name: 'Covering Fire' }, targets: [target] });
    await runSteps([{ do: 'mark', to: 'target', key: 'covered', until: 'endOfNextTurn', untilOf: 'recipient' }], ctx);
    const mark = target.flags.essence20.ruleMarks.covered;
    expect(mark.stamp.holderTurn).toBe(2);
    // c's next turn is this round's turn 2; the mark is gone once round 2 starts.
    expect(isExpired(mark, { ...combat, turn: 2 })).toBe(false);
    expect(isExpired(mark, { ...combat, round: 2, turn: 0 })).toBe(true);
    expect(stepErrors([{ do: 'mark', key: 'x', until: 'rounds:3', untilOf: 'recipient' }])).toEqual([]);
    expect(stepErrors([{ do: 'mark', key: 'x', until: 'nextWeek', untilOf: 'them' }])).toHaveLength(2);
  });
});

/* -------------------------------------------- */
/*  Watch Triggers: events on other actors       */
/* -------------------------------------------- */

let nextId = 1;

function makeActor(name, rules = [], { x = 0, disposition = 1 } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { health: { value: 10, max: 10 } },
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
  const items = rules.length ? [{ id: `i${nextId++}`, name: `${name}'s Perk`, type: 'perk', flags: {}, system: { rules }, parent: actor }] : [];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  return actor;
}

describe('watch Triggers', () => {
  let rebuildIndex;
  let fireTriggers;
  let summarizeRule;
  let validateRule;
  beforeAll(async () => {
    ({ rebuildIndex } = await import('./index.mjs'));
    ({ fireTriggers } = await import('./triggers.mjs'));
    ({ summarizeRule, validateRule } = await import('./types.mjs'));
  });
  afterEach(() => {
    delete global.canvas;
  });

  function scene(...actors) {
    for (const actor of actors) {
      rebuildIndex(actor);
    }

    global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  }

  test('an ally\'s hit runs the watcher\'s steps as the watcher, aimed at the ally', async () => {
    const rule = { type: 'Trigger', event: 'hit', outcome: 'success', watch: 'ally', within: 30, steps: [{ do: 'mark', to: 'target', key: 'cheered' }] };
    const watcher = makeActor('Leader', [rule]);
    const ally = makeActor('Ally', [], { x: 20 });
    const farAlly = makeActor('Far Ally', [], { x: 100 });
    const enemy = makeActor('Enemy', [], { x: 10, disposition: -1 });
    scene(watcher, ally, farAlly, enemy);
    await fireTriggers(ally, 'hit', { outcome: 'success', targets: [enemy] });
    expect(ally.flags.essence20.ruleMarks.cheered.by).toBe(watcher.uuid);
    // Out of range, the wrong side, a miss, or the watcher's own hit: nothing.
    await fireTriggers(farAlly, 'hit', { outcome: 'success', targets: [enemy] });
    await fireTriggers(enemy, 'hit', { outcome: 'success', targets: [ally] });
    await fireTriggers(watcher, 'hit', { outcome: 'success', targets: [enemy] });
    expect(farAlly.flags.essence20.ruleMarks).toBeUndefined();
    expect(enemy.flags.essence20.ruleMarks).toBeUndefined();
    expect(watcher.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(ally, 'hit', { outcome: 'failure', targets: [enemy] });
    expect(validateRule(rule)).toEqual([]);
    expect(summarizeRule(rule)).toContain('an ally within 30 ft');
  });

  test('watchTarget theirTarget aims at the one they rolled against; an enemy\'s Fumble anywhere', async () => {
    const rule = { type: 'Trigger', event: 'afterRoll', outcome: 'fumbled', watch: 'enemy', watchTarget: 'theirTarget', steps: [{ do: 'mark', to: 'target', key: 'saved' }] };
    const watcher = makeActor('Guardian', [rule]);
    const ally = makeActor('Ally', [], { x: 5 });
    const enemy = makeActor('Enemy', [], { x: 500, disposition: -1 });
    scene(watcher, ally, enemy);
    await fireTriggers(enemy, 'afterRoll', { outcome: 'failure', facts: { isFumble: false }, targets: [ally] });
    expect(ally.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(enemy, 'afterRoll', { outcome: 'fumble', facts: { isFumble: true }, targets: [ally] });
    expect(ally.flags.essence20.ruleMarks.saved).toBeTruthy();
    expect(enemy.flags.essence20.ruleMarks).toBeUndefined();
  });

  test('an ally being Defeated, gated by a when on the one it happened to; own Triggers don\'t see a watch rule', async () => {
    const rule = { type: 'Trigger', event: 'defeated', watch: 'ally', when: ['target:type:playerCharacter'], steps: [{ do: 'mark', to: 'self', key: 'avenging' }] };
    const watcher = makeActor('Avenger', [rule]);
    const ally = makeActor('Ally', [], { x: 5 });
    scene(watcher, ally);
    await fireTriggers(watcher, 'defeated');
    expect(watcher.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(ally, 'defeated');
    expect(watcher.flags.essence20.ruleMarks.avenging).toBeTruthy();
    expect(validateRule({ ...rule, watch: 'friends' })).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  Reaction rules: card buttons                 */
/* -------------------------------------------- */

describe('Reaction rules', () => {
  let rebuildIndex;
  let reactionOffers;
  let pressReaction;
  let cardInfo;
  let validateRule;
  beforeAll(async () => {
    ({ rebuildIndex } = await import('./index.mjs'));
    ({ reactionOffers, pressReaction } = await import('./reactions.mjs'));
    ({ cardInfo } = await import('../mechanics/combat/reaction-engine.mjs'));
    ({ validateRule } = await import('./types.mjs'));
  });

  function cardFor(attacker, rows, total) {
    const flags = {};
    const message = {
      id: 'm1', speaker: { actor: attacker.id },
      flags: { essence20: { checkResults: rows.map(([target, difficulty]) => ({ targetUuid: target.uuid, difficulty, success: total >= difficulty })), isAttack: true } },
      rolls: [{ total, formula: '1d20', dice: [{ faces: 20, results: [{ result: total, active: true }] }] }],
      content: rows.map(([target]) => `<button data-action="apply-damage" data-key="${target.uuid}:base" data-target-uuid="${target.uuid}" data-damage="3" data-damage-type="blunt">`).join(''),
      getFlag: (scope, key) => flags[key],
      async setFlag(scope, key, value) {
        flags[key] = value;
      },
    };
    global.game.messages = { get: id => (id == 'm1' ? message : null) };
    return { message, info: cardInfo(message) };
  }

  function world(...actors) {
    for (const actor of actors) {
      rebuildIndex(actor);
    }

    const byUuid = new Map(actors.map(actor => [actor.uuid, actor]));
    global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
    global.fromUuid = async uuid => byUuid.get(uuid) ?? null;
    global.game.actors = { get: id => actors.find(actor => actor.id == id) ?? null };
    global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  }

  afterEach(() => {
    delete global.canvas;
    delete global.fromUuidSync;
    delete global.fromUuid;
  });

  test('the defender lowers the total: a hit that drops below its DIF is cancelled, limited once a scene', async () => {
    const rule = { type: 'Reaction', label: 'Duck', who: 'target', outcome: 'hit', attackOnly: true, limit: { per: 'scene', max: 1 }, steps: [{ do: 'lowerTotal', amount: 3 }] };
    expect(validateRule(rule)).toEqual([]);
    const attacker = makeActor('Goon', [], { disposition: -1 });
    const defender = makeActor('Hero', [rule], { x: 5 });
    const bystander = makeActor('Other Hero', [rule], { x: 10 });
    world(attacker, defender, bystander);
    const { message, info } = cardFor(attacker, [[defender, 14]], 15);
    const offers = reactionOffers(info);
    // Only the one it targeted, on its own row.
    expect(offers.map(o => o.actor.name)).toEqual(['Hero']);
    expect(offers[0].other).toBe(attacker);
    expect(await pressReaction(info, offers[0])).toBe(true);
    expect(message.getFlag('essence20', 'reactNegated')).toEqual([defender.uuid]);
    expect(global.ChatMessage.create.mock.calls.at(-1)[0].content).toContain('CardNowMisses');
    // Claimed, and the scene limit is spent.
    expect(reactionOffers(cardFor(attacker, [[defender, 14]], 15).info)).toEqual([]);
  });

  test('an ally of the target within range; margin and outcome filters; convertRows for the attacker side', async () => {
    const guard = { type: 'Reaction', who: 'allyOfTarget', within: 10, outcome: 'hit', steps: [{ do: 'negateHit' }] };
    const pusher = { type: 'Reaction', who: 'attacker', outcome: 'miss', minMargin: -2, steps: [{ do: 'convertRows' }] };
    const attacker = makeActor('Goon', [pusher], { disposition: -1 });
    const target = makeActor('Hero', [], { x: 5 });
    const near = makeActor('Guard', [guard], { x: 12 });
    const far = makeActor('Far Guard', [guard], { x: 40 });
    world(attacker, target, near, far);
    const hit = cardFor(attacker, [[target, 14]], 15);
    expect(reactionOffers(hit.info).map(o => o.actor.name)).toEqual(['Guard']);
    // A near miss offers the attacker's own button; a miss by 3 doesn't.
    const nearMiss = cardFor(attacker, [[target, 16]], 15);
    expect(reactionOffers(nearMiss.info).map(o => o.actor.name)).toEqual(['Goon']);
    expect(reactionOffers(cardFor(attacker, [[target, 18]], 15).info)).toEqual([]);
  });

  test('card steps are refused outside a Reaction', () => {
    expect(validateRule({ type: 'Use', steps: [{ do: 'negateHit' }] })[0]).toContain('only work in a Reaction');
    expect(validateRule({ type: 'Reaction', who: 'bystander', steps: [{ do: 'lowerTotal' }] }).length).toBeGreaterThanOrEqual(2);
  });
});

/* -------------------------------------------- */
/*  Dice in formulas                             */
/* -------------------------------------------- */

describe('dice in formulas', () => {
  let resolveValue;
  let formulaError;
  beforeAll(async () => {
    ({ resolveValue, formulaError } = await import('./formula.mjs'));
  });

  test('NdM rolls, d6 means 1d6, and the rolls are noted', () => {
    const dice = [];
    // random() 0.99 -> the top face every time.
    expect(resolveValue('2d4 + 1', { dice, random: () => 0.99 })).toBe(9);
    expect(dice).toEqual([{ formula: '2d4', results: [4, 4], total: 8 }]);
    expect(resolveValue('d6', { random: () => 0 })).toBe(1);
    expect(resolveValue('max(1d2, @level)', { actor: { system: { level: 3 } }, random: () => 0.5 })).toBe(3);
    expect(formulaError('1d2 + 1')).toBeNull();
    expect(formulaError('1d0')).not.toBeNull();
    // A reference that contains a d is still a reference.
    expect(resolveValue('@var.dmg', { vars: { dmg: 4 } })).toBe(4);
  });

  test('a step amount with dice tells the roll in its chat and keeps @var.rolled; @target reads the first target', async () => {
    const actor = { name: 'Hero', flags: {}, system: { health: { value: 1, max: 10 } }, isOwner: true, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } };
    const ctx = stepContext({ actor, item: { name: 'Energon Manipulator' }, targets: [{ name: 'Foe', system: { level: 4 } }] });
    ctx.random = () => 0.99;
    await runSteps([{ do: 'heal', amount: '1d2 + @target.level' }], ctx);
    expect(actor.system.health.value).toBe(7);
    expect(ctx.vars.rolled).toBe(2);
    expect(ctx.chat.join(' ')).toContain('DiceRolled');
  });
});

/* -------------------------------------------- */
/*  Old picks into rules.choices                 */
/* -------------------------------------------- */

describe('legacy picks', () => {
  let legacyChoiceUpdates;
  let legacyValue;
  beforeAll(async () => {
    ({ legacyChoiceUpdates, legacyValue } = await import('./legacy-choices.mjs'));
  });

  test('a pick step / ChoiceSet with `legacy` moves the old flag into its choice, never over a newer pick', () => {
    const actor = { flags: { essence20: { gem: 'ally-uuid' } } };
    const item = {
      id: 'i1', parent: actor,
      flags: { essence20: { pr1DinoGem: 'red' } },
      system: { rules: [
        { type: 'Use', steps: [{ do: 'choose', options: [{ label: 'x', steps: [{ do: 'pick', key: 'gem', from: 'list', legacy: 'flags.essence20.pr1DinoGem' }] }] }] },
        { type: 'ChoiceSet', key: 'partner', from: 'text', legacy: 'actor.flags.essence20.gem' },
      ] },
    };
    const kept = { ...item, id: 'i2', flags: { essence20: { pr1DinoGem: 'blue', rules: { choices: { gem: 'green' } } } } };
    actor.items = [item, kept];
    expect(legacyValue('flags.essence20.pr1DinoGem', item)).toBe('red');
    expect(legacyValue('flags.essence20.nothing', item)).toBeNull();
    expect(legacyChoiceUpdates(actor)).toEqual([
      { _id: 'i1', 'flags.essence20.rules.choices.gem': 'red', 'flags.essence20.rules.choices.partner': 'ally-uuid' },
      { _id: 'i2', 'flags.essence20.rules.choices.partner': 'ally-uuid' },
    ]);
  });

  test('pick with ifUnset reads the old flag before asking', async () => {
    const item = { name: 'Dino Gem', flags: { essence20: { pr1DinoGem: 'red' } } };
    const ctx = stepContext({ actor: { name: 'Ranger' }, item, targets: [] });
    ctx.askPick = jest.fn();
    await runSteps([{ do: 'pick', key: 'gem', from: 'list', options: ['red', 'blue'], ifUnset: true, legacy: 'flags.essence20.pr1DinoGem' }], ctx);
    expect(ctx.askPick).not.toHaveBeenCalled();
    expect(ctx.vars.picked).toBe('red');
  });
});

/* -------------------------------------------- */
/*  Granted items: tags and linked children      */
/* -------------------------------------------- */

describe('granted items', () => {
  let evaluateTag;
  let contextFor;
  beforeAll(async () => {
    ({ evaluateTag, contextFor } = await import('./predicate.mjs'));
  });

  test('rule:granted / rule:granted:<item tag> and item:granted (also through the weapon)', () => {
    const perk = { id: 'perk1' };
    const blades = { id: 'w1', type: 'weapon', name: 'Rotor Blades', flags: { essence20: { grantedBy: 'perk1' } } };
    const slash = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } } };
    const other = { id: 'w2', type: 'weapon', name: 'Rifle', flags: {} };
    const actor = { items: { contents: [blades, slash, other], get: id => [blades, slash, other].find(i => i.id == id) } };
    for (const item of [blades, slash, other]) {
      item.parent = actor;
    }

    const ctx = item => contextFor({ self: actor, ruleItem: perk, item });
    expect(evaluateTag('rule:granted', ctx(null))).toBe(true);
    expect(evaluateTag('rule:granted:type:weapon', ctx(null))).toBe(true);
    expect(evaluateTag('rule:granted:type:armor', ctx(null))).toBe(false);
    expect(evaluateTag('item:granted', ctx(slash))).toBe(true);
    expect(evaluateTag('item:granted', ctx(other))).toBe(false);
    expect(evaluateTag('rule:granted', contextFor({ self: { items: { contents: [other] } }, ruleItem: perk }))).toBe(false);
  });

  test('createItem children: made with the host as parent and the grant / expiry flags', async () => {
    const made = [];
    const actor = {
      name: 'Hero', isOwner: true,
      async createEmbeddedDocuments(type, datas) {
        const docs = datas.map((data, i) => ({ ...data, id: `n${made.length + i}`, isOwner: false }));
        made.push(...docs);
        return docs;
      },
    };
    global.game.user.isGM = false;
    const ctx = stepContext({ actor, item: { id: 'perk1', name: 'Pet', flags: { essence20: { rules: { choices: { pet: 'Wolf' } } } } }, targets: [] });
    await runSteps([{
      do: 'createItem', until: 'scene',
      data: { name: '{choice.pet} Bite', type: 'weapon' },
      children: [{ name: 'Bite', type: 'weaponEffect', system: { damageValue: 1 } }],
    }], ctx);
    expect(made.map(d => d.name)).toEqual(['Wolf Bite', 'Bite']);
    expect(made[1].flags.essence20).toMatchObject({ parentId: 'n0', grantedBy: 'perk1', rulesExpiry: { until: 'scene' } });
    expect(stepErrors([{ do: 'createItem', data: { name: 'x', type: 'weapon' }, children: [{ name: 'y' }] }])).toHaveLength(1);
  });
});

test('chat text reads {var.<key>} and {choice.<key>}, and keeps the text when a choice is missing', async () => {
  const ctx = stepContext({ actor: { name: 'Hero' }, item: { name: 'Perk', flags: { essence20: { rules: { choices: { foe: 'Cobra' } } } } }, targets: [] });
  ctx.vars.total = 17;
  await runSteps([{ do: 'chat', text: '{name} vs {choice.foe}: {var.total}' }, { do: 'chat', text: 'Unpicked {choice.none}' }], ctx);
  expect(ctx.chat).toEqual(['Hero vs Cobra: 17', 'Unpicked {choice.none}']);
});
