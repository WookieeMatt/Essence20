import { jest } from '@jest/globals';

/**
 * Round 10, group D - the engine pieces in module/rules/ext/d/*.mjs, each on its own (the items that use them are
 * rules/conv10-slD10.test.js).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const economySpend = jest.fn(async () => ({}));
jest.unstable_mockModule('./helpers/action-economy.mjs', () => ({ spend: economySpend, isTracking: () => true, grantActionsThisTurn: jest.fn(async () => {}) }));
const grantTemp = jest.fn(async () => {});
jest.unstable_mockModule('./helpers/extensions/resource/temp-resources.mjs', () => ({ grantTemp }));

await import('./ext/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule, TRIGGER_EVENTS } = await import('./types.mjs');
const { runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');
const { contextFor, evaluate, unknownTags } = await import('./predicate.mjs');
const { resolveValue } = await import('./formula.mjs');
const cards = await import('./ext/d/cards.mjs');
const story = await import('./ext/d/story.mjs');
const spellcost = await import('./ext/d/spellcost.mjs');
const initiative = await import('./ext/d/initiative.mjs');
const contest = await import('./ext/d/contest.mjs');
const canvasExt = await import('./ext/d/canvas.mjs');
const misc = await import('./ext/d/misc.mjs');
const items = await import('./ext/d/items.mjs');
const blast = await import('./ext/d/blast.mjs');

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
let nextId = 1;

function doc(data) {
  return {
    flags: { essence20: {} }, ...data,
    getFlag(scope, key) {
      return getPath(this.flags?.[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async unsetFlag(scope, key) {
      setPath(this.flags[scope] ??= {}, `-=${key}`, null);
    },
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor with items (each {name, type, system, rules?}) and a token at x feet. */
function makeActor(name, itemData = [], { system = {}, type = 'playerCharacter', x = 0, disposition = 1 } = {}) {
  const actor = doc({ id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), system: { level: 5, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 5 } }, skills: {}, defenses: {}, ...system } });
  actor.uuid = `Actor.${actor.id}`;
  const list = itemData.map(data => doc({ id: `i${nextId++}`, parent: actor, isOwner: true, ...data, system: { ...(data.system ?? {}), ...(data.rules ? { rules: data.rules } : {}) } }));
  list.forEach(item => {
    item.uuid = `${actor.uuid}.Item.${item.id}`;
  });
  actor.items = {
    contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), filter: fn => list.filter(fn), some: fn => list.some(fn),
    [Symbol.iterator]: () => list[Symbol.iterator](),
  };
  const token = { id: `t${actor.id}`, actor, center: { x, y: 0 }, document: { disposition } };
  actor.token = token;
  actor.getActiveTokens = () => [token];
  rebuildIndex(actor);
  return actor;
}

function world(...actors) {
  const docs = new Map();
  for (const actor of actors) {
    docs.set(actor.uuid, actor);
    for (const item of actor.items.contents) {
      docs.set(item.uuid, item);
    }
  }

  global.fromUuidSync = uuid => docs.get(uuid) ?? null;
  global.fromUuid = async uuid => docs.get(uuid) ?? null;
  global.game.actors = { contents: actors, get: id => actors.find(actor => actor.id == id), [Symbol.iterator]: () => actors[Symbol.iterator]() };
  global.canvas = { scene: { id: 'sc', tokens: [] }, grid: { size: 100, measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) }) }, tokens: { placeables: actors.map(actor => actor.token), controlled: [], setTargets: jest.fn() } };
  return docs;
}

const run = async (steps, actor, extra = {}) => {
  const ctx = stepContext({ actor, item: extra.item ?? actor.items.contents[0] ?? { name: 'Thing' }, targets: extra.targets ?? [] });
  Object.assign(ctx, extra.ctx ?? {});
  Object.assign(ctx.vars, extra.vars ?? {});
  const finished = await runSteps(steps, ctx);
  return { ctx, finished };
};

beforeEach(() => {
  economySpend.mockClear();
  grantTemp.mockClear();
  global.game = {
    user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null }, combat: null, combats: { get: () => null },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}), getSpeakerActor: speaker => global.game.actors?.get?.(speaker?.actor) ?? null };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}`, deepClone: v => JSON.parse(JSON.stringify(v)) } };
  global.ui = { notifications: { warn: jest.fn() } };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.canvas = undefined;
});

/* -------------------------------------------- */

describe('CardOffer', () => {
  test('validation, who it reaches and who may press', () => {
    expect(validateRule({ type: 'CardOffer', reroll: { target: 'd20' } })).toEqual([]);
    expect(validateRule({ type: 'CardOffer' })).toContain('a CardOffer needs reroll, addDie or steps');
    expect(validateRule({ type: 'CardOffer', reroll: { target: 'x' }, limit: { per: 'never' } }).length).toBe(2);
    expect(validateRule({ type: 'CardOffer', whose: 'nobody', addDie: { faces: 2 } })).toHaveLength(1);
    const me = makeActor('Me');
    const pc = makeActor('Pc');
    const npc = makeActor('Npc', [], { type: 'npc' });
    global.game.actors = { party: { members: [pc] } };
    expect(cards.reaches('self', me, me)).toBe(true);
    expect(cards.reaches('self', me, pc)).toBe(false);
    expect(cards.reaches('party', me, pc)).toBe(true);
    expect(cards.reaches('party', me, npc)).toBe(false);
    expect(cards.reaches('side', me, pc)).toBe(true);
    expect(cards.reaches('side', me, me)).toBe(false);
    expect(cards.reaches('side', me, npc)).toBe(false);
    expect(cards.reaches('any', me, npc)).toBe(true);
    expect(cards.mayPress({ pressedBy: 'gm' }, me, pc, {}, { isGM: false })).toBe(false);
    expect(cards.mayPress({ pressedBy: 'holderOwner' }, { isOwner: true }, pc, {}, { isGM: false })).toBe(true);
    expect(cards.mayPress({}, me, { isOwner: false }, { isAuthor: true }, { isGM: false })).toBe(true);
  });

  test('card: tags read the posted card', () => {
    const holder = makeActor('Holder', [], { x: 0 });
    const boss = makeActor('Boss');
    world(holder, boss);
    holder.flags.essence20.nemesisUuid = boss.uuid;
    const message = { rolls: [{ dice: [{ faces: 20, total: 1 }] }], flags: { essence20: { rollFailed: true, skill: 'might', checkResults: [{ targetUuid: boss.uuid, difficulty: 12 }], ruleCardMarks: { done: true } } } };
    const ask = tags => evaluate(tags, contextFor({ self: holder, holder, card: message }));
    expect(ask(['card:failed', 'card:d20:1', 'card:hasD20', 'card:checks', 'card:skill', 'card:marked:done', 'card:involves:flags.essence20.nemesisUuid'])).toBe(true);
    expect(ask(['card:fumble'])).toBe(false);
    expect(ask(['card:rerolled'])).toBe(false);
    expect(ask(['card:d20:20'])).toBe(false);
    expect(evaluate(['card:failed'], contextFor({ self: holder }))).toBeNull();
    expect(unknownTags(['card:failed', 'card:involves:x'])).toEqual([]);
  });

  test('pools, rescoring and the reroll helpers', async () => {
    const holder = makeActor('Holder');
    expect(cards.poolLeft({}, holder)).toBe(Infinity);
    expect(cards.poolLeft({ pool: { mark: 'p' } }, holder)).toBe(0);
    holder.flags.essence20.ruleMarks = { p: { count: 2 } };
    expect(cards.poolLeft({ pool: { mark: 'p' } }, holder)).toBe(2);
    expect(cards.rescore(10, 4, [{ difficulty: 12 }], (t, d) => (t >= d ? 1 : 0))).toEqual([{ difficulty: 12, total: 14, before: 0, after: 1 }]);
    expect(cards.outcomesFor(13, [{ difficulty: 12 }, { difficulty: 14 }]).map(row => row.success)).toEqual([true, false]);
    expect(cards.stillFails(11, [{ difficulty: 12 }])).toBe(true);
    expect(cards.stillFails(12, [{ difficulty: 12 }])).toBe(false);
    expect(TRIGGER_EVENTS).toEqual(expect.arrayContaining(['rerolled', 'personalPointUnspent', 'storyPointNarrative', 'initiativeRolling']));
  });

  test('a card offers its buttons; markCard only works inside an offer', async () => {
    const holder = makeActor('Holder', [{ name: 'Lucky', type: 'perk', rules: [{ type: 'CardOffer', label: 'Again ({count})', pool: { mark: 'p' }, steps: [{ do: 'markCard', key: 'seen' }] }] }]);
    world(holder);
    holder.flags.essence20.ruleMarks = { p: { count: 1 } };
    const message = { rolls: [{ dice: [] }], speaker: { actor: holder.id }, flags: { essence20: {} }, update: jest.fn(async function (changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    }) };
    const appended = [];
    const element = { querySelector: () => ({ appendChild: node => appended.push(node) }), querySelectorAll: () => appended };
    global.document = { createElement: () => ({ dataset: {} }) };
    cards.decorateOffers(message, element);
    cards.decorateOffers(message, element);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ textContent: 'Again (1)', dataset: { e20Ext: 'ruleCardOffer' } });
    expect(await cards.pressOffer(message, appended[0].dataset)).toBe(true);
    expect(message.flags.essence20.ruleCardMarks.seen).toBe(true);
    expect(holder.flags.essence20.ruleMarks.p.count).toBe(0);
    expect(cards.offersFor(message)).toEqual([]);
    expect((await run([{ do: 'markCard', key: 'x' }], holder)).finished).toBe(false);
    expect(stepErrors([{ do: 'markCard' }])).toHaveLength(1);
    delete global.document;
  });

  test('the rerolled event ignores rolls that are not rerolls', async () => {
    const actor = makeActor('Hero', [{ name: 'Watch', type: 'perk', rules: [{ type: 'Trigger', event: 'rerolled', steps: [{ do: 'chat', text: 'heard {var.source}' }] }] }]);
    world(actor);
    await cards.onRerollMessage({ id: 'm', author: { id: 'u' }, speaker: { actor: actor.id }, rolls: [{ total: 3 }], flags: { essence20: {} } }, []);
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
    await cards.onRerollMessage({ id: 'm', author: { id: 'u' }, speaker: { actor: actor.id }, rolls: [{ total: 3 }], flags: { essence20: { rerollConfig: { source: 'offer' } } } }, []);
    expect(global.ChatMessage.create.mock.calls[0][0].content).toContain('heard offer');
  });
});

describe('personal Story Points', () => {
  test('givePersonalPoints: counts, a shared point, max, own turn', async () => {
    const giver = makeActor('Giver');
    const a = makeActor('A');
    const b = makeActor('B');
    const c = makeActor('C');
    world(giver, a, b, c);
    await run([{ do: 'givePersonalPoints', to: 'targets', shared: true, max: 2 }], giver, { targets: [a, b, c] });
    expect(story.pointsOf(a)[0].shareId).toBe(story.pointsOf(b)[0].shareId);
    expect(story.personalStoryPoints(c)).toBe(0);
    await run([{ do: 'givePersonalPoints', to: 'targets', count: 2, ownTurn: true }], giver, { targets: [c] });
    expect(story.pointsOf(c).map(p => p.turnEndsLeft)).toEqual([2, 2]);
    expect(stepErrors([{ do: 'givePersonalPoints', max: 0 }])).toHaveLength(1);
    expect((await run([{ do: 'givePersonalPoints', to: 'targets' }], giver)).finished).toBe(false);
  });

  test('target:sameType and storyPointNarrative', async () => {
    const pc = makeActor('Pc');
    const other = makeActor('Other');
    const npc = makeActor('Npc', [], { type: 'npc' });
    expect(evaluate(['target:sameType'], contextFor({ self: pc, other }))).toBe(true);
    expect(evaluate(['target:sameType'], contextFor({ self: pc, other: npc }))).toBe(false);
    const listener = makeActor('L', [{ name: 'Ear', type: 'perk', rules: [{ type: 'Trigger', event: 'storyPointNarrative', when: ['var:kind=equipment'], steps: [{ do: 'chat', text: 'tool' }] }] }]);
    await story.onNarrativeSpend(listener, 'equipment');
    await story.onNarrativeSpend(listener, 'other');
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
  });
});

describe('SpellCost', () => {
  test('validation and the order of operations', () => {
    expect(validateRule({ type: 'SpellCost', op: 'add', value: 1 })).toEqual([]);
    expect(validateRule({ type: 'SpellCost', op: 'add' })).toContain('value is required');
    expect(validateRule({ type: 'SpellCost', op: 'spend' })).toContain('spend needs a resource');
    const row = (op, value, name, max) => ({ rule: { op, value }, item: { parent: null }, name, max });
    const rows = [row('multiply', 2, 'm'), row('spend', null, 's', 3), row('add', 1, 'a'), row('set', 1, 'x')];
    expect(spellcost.applySpellCost(5, rows, { m: true, s: 2, a: true, x: true }).cost).toBe(2);
    expect(spellcost.applySpellCost(5, rows, { m: true }).cost).toBe(10);
    expect(spellcost.applySpellCost(1, rows, { s: 9 }).cost).toBe(0);
  });
});

describe('Initiative pieces', () => {
  function combatOf(pairs) {
    const combatants = pairs.map(([actor, value], i) => ({ id: `c${i}`, actor, actorId: actor.id, initiative: value, async update(changes) {
      Object.assign(this, changes);
    } }));
    global.game.combat = { id: 'cb', started: true, round: 1, combatant: combatants[0], combatants: { contents: combatants }, rollInitiative: jest.fn(async () => {}) };
    return combatants;
  }

  test('InitiativeReroll, @initiative, self:/target:initiative, markers and protectedTarget', () => {
    expect(initiative.withInitiativeRerolls('d20 + d8', 3)).toBe('d20 + d8r<=3');
    expect(validateRule({ type: 'InitiativeReroll' })).toEqual(['atMost is required']);
    const a = makeActor('A');
    const b = makeActor('B');
    world(a, b);
    combatOf([[a, 12], [b, null]]);
    expect(resolveValue('@initiative', { actor: a })).toBe(12);
    expect(resolveValue('@initiative.target', { actor: b, other: a })).toBe(12);
    expect(evaluate(['self:initiative'], contextFor({ self: a }))).toBe(true);
    expect(evaluate(['target:initiative'], contextFor({ self: a, other: b }))).toBe(false);
    a.flags.essence20.ruleMarks = { 'follow--x': { by: b.uuid }, other: { by: b.uuid } };
    expect(initiative.markersOf(a, 'follow')).toEqual([b]);
    a.flags.essence20.protectedTargetUuid = b.uuid;
    expect(recipients({ to: 'protectedTarget' }, stepContext({ actor: a, targets: [] }))).toEqual([b]);
  });

  test('rollInitiative, swapInitiative and distribute', async () => {
    const a = makeActor('A');
    const b = makeActor('B');
    world(a, b);
    const [ca, cb] = combatOf([[a, 5], [b, 9]]);
    await run([{ do: 'rollInitiative' }], a);
    expect(global.game.combat.rollInitiative).toHaveBeenCalledWith(['c0']);
    expect((await run([{ do: 'swapInitiative', requireLower: true }], a, { targets: [b] })).finished).toBe(false);
    await run([{ do: 'swapInitiative' }], a, { targets: [b] });
    expect([ca.initiative, cb.initiative]).toEqual([9, 5]);
    const shares = jest.fn(async () => ({ [a.uuid]: 1, [b.uuid]: 2 }));
    await run([{ do: 'distribute', to: 'combatAllies+self', total: 3, steps: [{ do: 'writeInitiative', to: 'target', value: '@initiative.target + @var.share' }] }], a, { ctx: { askShares: shares } });
    expect([ca.initiative, cb.initiative]).toEqual([10, 7]);
    shares.mockResolvedValueOnce({ [a.uuid]: 4 });
    expect((await run([{ do: 'distribute', to: 'self', total: 3, steps: [] }], a, { ctx: { askShares: shares } })).finished).toBe(false);
    expect(stepErrors([{ do: 'distribute', steps: [{ do: 'nope' }] }])).toHaveLength(2);
  });

  test('initiativeRolling fires the actor\'s Triggers', async () => {
    const a = makeActor('A', [{ name: 'Quick', type: 'perk', rules: [{ type: 'Trigger', event: 'initiativeRolling', steps: [{ do: 'chat', text: 'go' }] }] }]);
    await initiative.initiativeRolling(a);
    expect(global.ChatMessage.create.mock.calls[0][0].content).toContain('go');
  });
});

describe('contested rolls', () => {
  test('plain contests, the best die, a card for the other side\'s owner', async () => {
    expect(contest.plainFormula('d6')).toBe('1d20 + 1d6');
    expect(contest.plainFormula('d20')).toBe('1d20');
    global.CONFIG = { ...global.CONFIG, E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] } };
    const a = makeActor('A', [], { system: { skills: { might: { shift: 'd8' }, brawn: { shift: 'd4' } } } });
    expect(contest.bestShift(a, ['brawn', 'might'])).toBe('d8');
    const b = makeActor('B');
    const totals = [14, 9];
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = totals.shift();
        return this;
      }
    };
    const { ctx } = await run([{ do: 'contest', plain: true, skills: ['might'], against: { skills: ['brawn'] }, to: 'target', onWin: [{ do: 'chat', text: 'won' }], onLose: [{ do: 'chat', text: 'lost' }] }], a, { targets: [b] });
    expect(ctx.chat.join(' ')).toContain('won');
    expect([ctx.vars.mine, ctx.vars.theirs]).toEqual([14, 9]);
    expect(stepErrors([{ do: 'contest' }])).toHaveLength(2);
    expect((await run([{ do: 'contest', skill: 'x', against: { skill: 'y' } }], a)).finished).toBe(false);
  });
});

describe('canvas points and zones', () => {
  test('pickPoint, around:<ft>, placeZone and its roll source', async () => {
    const a = makeActor('A', [{ name: 'Fog', type: 'gear' }], { x: 0 });
    const b = makeActor('B', [], { x: 40 });
    const c = makeActor('C', [], { x: 300 });
    world(a, b, c);
    const { ctx } = await run([{ do: 'pickPoint' }], a, { ctx: { pickPoint: async () => ({ x: 30, y: 0 }) } });
    expect(recipients({ to: 'around:15' }, ctx)).toEqual([b]);
    await runSteps([{ do: 'placeZone', key: 'fog', modifier: { when: ['skill:alertness'], snag: true } }], ctx);
    expect(canvasExt.zonesOf(a)).toHaveLength(1);
    expect(canvasExt.zoneSources(b, null, { rolledSkill: 'alertness' }).sources).toEqual([expect.objectContaining({ id: 'ruleZone-fog', snag: true })]);
    expect(canvasExt.zoneSources(c, null, { rolledSkill: 'alertness' }).sources).toEqual([]);
    expect((await run([{ do: 'pickPoint' }], a, { ctx: { pickPoint: async () => null } })).finished).toBe(false);
    const { ctx: here } = await run([{ do: 'pickPoint', at: 'targetOrSelf' }], a, { targets: [c] });
    expect([here.vars.pointX, here.vars.pointY]).toEqual([300, 0]);
    expect(stepErrors([{ do: 'pickPoint', at: 'x' }, { do: 'placeZone' }])).toHaveLength(2);
  });
});

describe('small steps, recipients, tags and refs', () => {
  test('targets, counts and marks', async () => {
    const a = makeActor('A');
    const b = makeActor('B', [], { x: 10 });
    world(a, b);
    b.flags.essence20.ruleMarks = { tag: { by: a.uuid }, 'tag--x': { by: 'y' }, keep: {} };
    const { ctx } = await run([{ do: 'countTargets', var: 'n' }, { do: 'targetSelf' }, { do: 'countRecipients', to: 'all:20', var: 'm' }, { do: 'rememberTarget', var: 'me' }, { do: 'clearMarks', key: 'tag', to: 'all:20' }], a, { targets: [b, a] });
    expect([ctx.vars.n, ctx.vars.m, ctx.vars.me]).toEqual([2, 1, a.uuid]);
    expect(Object.keys(b.flags.essence20.ruleMarks)).toEqual(['keep']);
    await run([{ do: 'targetRecipients', to: 'all:20' }, { do: 'chat', text: '{target}' }], a);
    expect((await run([{ do: 'rememberTarget' }], a)).finished).toBe(false);
  });

  test('askText, spendActions, queueTurnStart', async () => {
    const a = makeActor('A');
    const b = makeActor('B');
    world(a, b);
    const { ctx } = await run([{ do: 'askText', var: 'word', firstWord: true }], a, { ctx: { askText: async () => '  Halt right there ' } });
    expect(ctx.vars.word).toBe('Halt');
    expect((await run([{ do: 'askText' }], a, { ctx: { askText: async () => '' } })).finished).toBe(false);
    await run([{ do: 'spendActions', action: 'free', count: 2 }], a);
    expect(economySpend).not.toHaveBeenCalled();
    global.game.combat = { id: 'cb' };
    await run([{ do: 'spendActions', action: 'free', count: 2 }], a);
    expect(economySpend).toHaveBeenCalledTimes(2);
    economySpend.mockResolvedValueOnce({ blocked: true });
    expect((await run([{ do: 'spendActions', count: 2 }], a)).finished).toBe(false);
    await run([{ do: 'queueTurnStart', to: 'target', spendAction: 'move', whisper: '{name} says {var.word}' }], a, { targets: [b], vars: { word: 'go' } });
    economySpend.mockClear();
    await misc.runTurnQueue(b, { id: 'cb' });
    expect(economySpend).toHaveBeenCalledWith(b, 'move', expect.anything());
    expect(global.ChatMessage.create.mock.calls.at(-1)[0].content).toContain('A says go');
    await run([{ do: 'queueTurnStart', to: 'target', spendAction: 'move' }], a, { targets: [b] });
    economySpend.mockClear();
    await misc.runTurnQueue(b, { id: 'other' });
    expect(economySpend).not.toHaveBeenCalled();
    expect(stepErrors([{ do: 'queueTurnStart', spendAction: 'x' }, { do: 'spendActions', action: 'x' }, { do: 'askText', var: 'a b' }])).toHaveLength(3);
  });

  test('captureRoll / retryRoll and recastFree', async () => {
    const a = makeActor('A');
    const spell = { type: 'spell', roll: jest.fn(async () => {}) };
    world(a);
    a._dice = { rollSkill: jest.fn(async () => ({})) };
    expect((await run([{ do: 'captureRoll' }], a)).finished).toBe(false);
    misc.LAST_ROLL.set(a.uuid, { dataset: { skill: 'x', shiftDown: 2 }, itemUuid: null });
    await run([{ do: 'captureRoll', var: 'r' }, { do: 'retryRoll', var: 'r', downEach: 2 }], a);
    expect(a._dice.rollSkill.mock.calls[0][0]).toMatchObject({ shiftDown: 4, e20RetryChain: 1 });
    expect(misc.retryDataset({ dataset: { e20RetryBase: 1, e20RetryChain: 3 } })).toMatchObject({ shiftDown: 4 });
    expect(misc.plainDataset({ a: 1, b: {}, c: 'x' })).toEqual({ a: 1, c: 'x' });
    global.fromUuid = async () => spell;
    await run([{ do: 'recastFree', item: '{var.it}' }], a, { vars: { it: 'Item.s' } });
    expect(spell.roll).toHaveBeenCalledWith({ rollType: 'spell', freeCast: true });
  });

  test('bankDie and rule:bankedDie', async () => {
    const a = makeActor('A', [{ name: 'Kit', type: 'gear' }]);
    world(a);
    const kit = a.items.contents[0];
    await run([{ do: 'bankDie', die: '1d6', appliesWhen: ['skill:athletics'] }], a, { item: kit });
    expect(evaluate(['rule:bankedDie'], contextFor({ self: a, ruleItem: kit }))).toBe(true);
    await misc.bonusDicePreRoll(a, { skill: 'athletics' });
    expect(a.flags.essence20.pendingMoreHeads.bonusDie).toBe('1d6');
    expect(evaluate(['rule:bankedDie'], contextFor({ self: a, ruleItem: kit }))).toBe(true);
    expect(stepErrors([{ do: 'bankDie', die: 'lots' }])).toHaveLength(1);
  });

  test('tempResource, teamCombatants, combat:roundIs, target:uuid, @targetKeyed, sideActors, allOf, attackHands', async () => {
    const a = makeActor('A');
    const b = makeActor('B', [], { system: { energon: { normal: { value: 1 } } } });
    const foe = makeActor('Foe', [], { type: 'npc', disposition: -1 });
    world(a, b, foe);
    global.game.actors.contents.push({ type: 'party', system: { actors: { a: { uuid: a.uuid }, b: { uuid: b.uuid } } }, members: [a, b] });
    global.game.combat = { id: 'cb', started: true, round: 2, combatants: { contents: [{ actor: a }, { actor: b }, { actor: foe }] } };
    expect(misc.teamCombatants(a)).toEqual([a, b]);
    expect(resolveValue('@teamCombatants', { actor: a })).toBe(2);
    await run([{ do: 'tempResource', kind: 'energon', amount: 2, to: 'teamCombatants' }], a);
    expect(grantTemp.mock.calls.map(call => call[0])).toEqual([b]);
    expect(evaluate(['combat:roundIs:2'], contextFor({ self: a }))).toBe(true);
    expect(evaluate([`target:uuid:${b.uuid}`], contextFor({ self: a, other: b }))).toBe(true);
    a.flags.essence20.counts = { [foe.uuid.replace(/\./g, '-')]: 3 };
    expect(resolveValue('@targetKeyed.flags.essence20.counts', { actor: a, other: foe })).toBe(3);
    const { ctx } = await run([{ do: 'pick', key: 'ally', from: 'sideActors', notSelf: true }], a, { item: doc({ name: 'P', id: 'p' }), ctx: { askPick: async (step, options) => options[0]?.value } });
    expect(ctx.vars.picked).toBe(b.uuid);
    expect(evaluate(['allOf:self:type:playerCharacter&target:type:npc'], contextFor({ self: a, other: foe }))).toBe(true);
    expect(evaluate(['allOf:self:type:playerCharacter&target:type:zord'], contextFor({ self: a, other: foe }))).toBe(false);
    const weapon = doc({ id: 'w', type: 'weapon', system: { derivedHands: 2 } });
    a.items.contents.push(weapon);
    const effect = { type: 'weaponEffect', parent: a, flags: { essence20: { parentId: 'w' } }, system: {} };
    expect(evaluate(['attackHands:2'], contextFor({ self: a, item: effect }))).toBe(true);
    expect(evaluate(['attackHands:3'], contextFor({ self: a, item: effect }))).toBe(false);
  });

  test('checkAllies, lendAssistEdge, claimCard, driverOrSelf, spendFor', async () => {
    const a = makeActor('A', [], { x: 0 });
    const b = makeActor('B', [], { x: 20 });
    const foe = makeActor('Foe', [], { type: 'npc', x: 10, disposition: -1 });
    world(a, b, foe);
    const asked = jest.fn(async (step, candidates) => candidates);
    const { ctx } = await run([{ do: 'checkAllies', within: 50 }, { do: 'lendAssistEdge', to: 'targets', against: '{var.foe}' }], a, { vars: { foe: foe.uuid }, ctx: { askAllies: asked } });
    expect(asked.mock.calls[0][1]).toEqual([b]);
    expect(b.flags.essence20.pendingLendAssistanceEdge).toMatchObject({ targetId: foe.id, edge: true });
    expect(ctx.chat.join()).toContain('AssistLent');
    const message = { flags: { essence20: { ruleButton: {} } }, update: jest.fn(async function (changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    }) };
    expect((await run([{ do: 'claimCard' }], b, { ctx: { buttonMessage: message } })).finished).toBe(true);
    expect((await run([{ do: 'claimCard' }], b, { ctx: { buttonMessage: message } })).finished).toBe(false);
    const zord = makeActor('Zord', [], { type: 'zord', system: { actors: { d: { uuid: b.uuid, vehicleRole: 'driver' } }, powers: { personal: { value: 1 } } } });
    world(a, b, zord);
    expect(recipients({ to: 'driverOrSelf' }, stepContext({ actor: zord, targets: [] }))).toEqual([b]);
    await run([{ do: 'spendFor', resource: { path: 'system.powers.personal.value' }, amount: 2, to: 'driverOrSelf' }], zord);
    expect(b.system.powers.personal.value).toBe(1);
    expect((await run([{ do: 'spendFor', resource: { path: 'system.powers.personal.value' }, amount: 2, to: 'driverOrSelf' }], zord)).finished).toBe(false);
    expect(stepErrors([{ do: 'spendFor' }, { do: 'lendAssistEdge' }])).toHaveLength(2);
  });

  test('HardpointUse and StanceSwitch', async () => {
    expect(validateRule({ type: 'HardpointUse', items: 'x', slots: 1 })).toEqual(['items must be a list of item tags']);
    const bot = makeActor('Bot', [
      { name: 'Mount', type: 'perk', rules: [{ type: 'HardpointUse', items: ['item:name~Cannon'], slots: 1 }] },
      { name: 'Big Cannon', type: 'weapon', system: { equipped: true, hands: 3, hardpoint: { type: 'integrated' } } },
    ], { system: { hardpoints: { integrated: { used: 3, max: 1, over: true } } } });
    misc.hardpointUseDerived(bot);
    expect(bot.system.hardpoints.integrated).toEqual({ used: 1, max: 1, over: false });
    expect(validateRule({ type: 'StanceSwitch', stance: 'x' })).toHaveLength(1);
    const fighter = makeActor('F', [{ name: 'Stance', type: 'perk', rules: [{ type: 'StanceSwitch', stance: 'evasiveFighting', max: 3, when: ['attack'] }] }]);
    expect(misc.stanceToggles(fighter, { item: { type: 'weaponEffect' } })).toEqual([expect.objectContaining({ type: 'number', max: 3 })]);
    expect(misc.stanceToggles(fighter, { item: { type: 'spell' } })).toEqual([]);
  });
});

describe('item marks', () => {
  test('markItem / unmarkItem, item:marked, the roll block and the armor Defense', async () => {
    const owner = makeActor('Owner', [
      { name: 'Vest', type: 'armor', system: { equipped: true, totalBonusToughness: 2, totalBonusEvasion: 0 } },
      { name: 'Gun', type: 'weapon' },
    ], { system: { defenses: { toughness: { total: 12, string: '12' } } } });
    const shot = doc({ id: 's', type: 'weaponEffect', parent: owner, flags: { essence20: { parentId: owner.items.contents[1].id } } });
    owner.items.contents.push(shot);
    const hacker = makeActor('Hacker', [{ name: 'Jammer', type: 'perk' }]);
    world(owner, hacker);
    const [vest, gun] = owner.items.contents;
    const { ctx } = await run([{ do: 'markItem', item: `source:${vest.uuid}`, key: 'off', effects: { noArmorDefense: true } }], hacker, { targets: [owner] });
    expect(ctx.vars.itemName).toBe('Vest');
    items.markedArmorDerived(owner);
    expect(owner.system.defenses.toughness).toEqual({ total: 10, string: '12 - 2 (Vest)' });
    await run([{ do: 'markItem', item: '{var.g}', key: 'jam', effects: { blockRolls: true } }], hacker, { targets: [owner], vars: { g: gun.uuid } });
    expect(evaluate(['item:marked:jam'], contextFor({ item: shot }))).toBe(true);
    const dataset = {};
    items.blockMarkedRoll(owner, dataset, shot);
    expect(dataset.cancelRoll).toBe(true);
    await run([{ do: 'unmarkItem', item: '{var.g}', key: 'jam' }], hacker, { targets: [owner], vars: { g: gun.uuid } });
    expect(evaluate(['item:marked:jam'], contextFor({ item: shot }))).toBe(false);
    expect((await run([{ do: 'markItem', item: 'name~Nothing', key: 'k' }], hacker, { targets: [owner] })).finished).toBe(false);
    expect(stepErrors([{ do: 'markItem' }, { do: 'unmarkItem', item: 'x' }, { do: 'rollPlain' }])).toHaveLength(3);
  });

  test('operator, rollPlain, spendActionFor, @availabilityDif, target:withinOrUnknown', async () => {
    const pilot = makeActor('Pilot', [], { system: { skills: { technology: { shift: 'autoSuccess' } } } });
    const truck = makeActor('Truck', [{ name: 'Radio', type: 'gear', system: { availability: 'limited' } }], { type: 'vehicle', x: 50, system: { actors: { p: { uuid: pilot.uuid, vehicleRole: 'driver' } } } });
    const me = makeActor('Me', [{ name: 'Picker', type: 'perk' }]);
    world(pilot, truck, me);
    expect(items.operatorOf(truck)).toBe(pilot);
    expect(items.operatorOf(makeActor('Empty', [], { type: 'zord' }))).toBeNull();
    expect(items.skillDieFormula('d4')).toBe('1d20 + 1d4');
    expect(items.skillDieFormula('autoFail')).toBe('0');
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = Number(this.formula) || 7;
        return this;
      }
    };
    const { ctx } = await run([{ do: 'rollPlain', skill: 'technology', to: 'operator', var: 'dif' }], me, { targets: [truck] });
    expect(ctx.vars.dif).toBe(99);
    global.game.combat = { id: 'c' };
    await run([{ do: 'spendActionFor', action: 'move', to: 'target' }], me, { targets: [truck] });
    expect(economySpend).toHaveBeenCalledWith(truck, 'move', expect.anything());
    const picker = me.items.contents[0];
    picker.flags.essence20.rules = { choices: { it: truck.items.contents[0].uuid } };
    global.CONFIG = { ...global.CONFIG, E20: { ...(global.CONFIG?.E20 ?? {}), availabilityDifficulties: { limited: 18 } } };
    expect(resolveValue('@availabilityDif.it', { actor: me, item: picker })).toBe(18);
    expect(evaluate(['target:withinOrUnknown:60'], contextFor({ self: me, other: truck }))).toBe(true);
    expect(evaluate(['target:withinOrUnknown:40'], contextFor({ self: me, other: truck }))).toBe(false);
    truck.getActiveTokens = () => [];
    expect(evaluate(['target:withinOrUnknown:40'], contextFor({ self: me, other: truck }))).toBe(true);
  });
});

describe('lent Alterations', () => {
  test('step validation', () => {
    expect(stepErrors([{ do: 'pickAlteration', from: 'x' }, { do: 'lendAlteration', part: 'x', expire: 'y' }])).toHaveLength(3);
    expect(stepErrors([{ do: 'pickAlteration', from: 'compendium', tier: '{var.t}', var: 'alt' }, { do: 'lendAlteration', from: 'alt', expire: 'minute' }])).toEqual([]);
  });

  test('a lend of an own Alteration\'s benefit and cost', async () => {
    const alt = await import('../helpers/extensions/other1/alterations.mjs');
    const lender = makeActor('Lender', [{ name: 'Gills', type: 'alteration', system: { type: 'movement', bonusMovementType: 'swim', bonusMovement: 10, costMovementType: 'ground', costMovement: 5 } }]);
    const friend = makeActor('Friend');
    world(lender, friend);
    const gills = lender.items.contents[0];
    await run([{ do: 'lendAlteration', from: 'alt', to: 'target', part: 'both', expire: 'scene' }], lender, { targets: [friend], vars: { alt: JSON.stringify({ own: gills.id, name: 'Gills' }) } });
    expect(alt.activeLends(friend)).toEqual([expect.objectContaining({ movement: { swim: 10, ground: -5 }, expire: expect.objectContaining({ kind: 'scene' }) })]);
    expect((await run([{ do: 'lendAlteration', from: 'nothing' }], lender)).finished).toBe(false);
  });
});

describe('scheduled cards, rigs and blasts', () => {
  test('scheduleCard: now out of combat, after turn ends or at a round in combat', async () => {
    const a = makeActor('A', [{ name: 'Timer', type: 'perk' }]);
    world(a);
    const timer = a.items.contents[0];
    const { ctx } = await run([{ do: 'scheduleCard', turnEnds: 2, steps: [{ do: 'chat', text: 'now' }] }], a);
    expect(ctx.chat).toEqual(['now']);
    global.game.combat = { id: 'cb', round: 1 };
    await run([{ do: 'scheduleCard', turnEnds: 2, steps: [{ do: 'chat', text: 'turns {var.x}' }] }, { do: 'scheduleCard', rounds: 2, steps: [{ do: 'chat', text: 'rounds' }] }], a, { item: timer, vars: { x: 'y' } });
    global.ChatMessage.create.mockClear();
    await blast.scheduledTurnEnd(a, global.game.combat);
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
    await blast.scheduledTurnEnd(a, global.game.combat);
    expect(global.ChatMessage.create.mock.calls[0][0].content).toContain('turns y');
    global.game.combat.round = 3;
    await blast.scheduledRoundStart(global.game.combat, [a]);
    expect(global.ChatMessage.create.mock.calls[1][0].content).toContain('rounds');
    expect(a.flags.essence20.ruleScheduled).toEqual([]);
  });

  test('rigs, damage cards, blasts and explosions', async () => {
    const a = makeActor('A', [{ name: 'Rig', type: 'perk' }], { x: 0, system: { skills: {} } });
    const b = makeActor('B', [], { x: 10, system: { skills: { acrobatics: { shift: 'd4', modifier: 1 } } } });
    world(a, b);
    const { ctx } = await run([{ do: 'rig', var: 'r' }, { do: 'requireRig', var: 'r' }, { do: 'endRig', var: 'r' }], a);
    expect((await runSteps([{ do: 'requireRig', var: 'r', message: 'gone' }], ctx))).toBe(false);
    await run([{ do: 'damageCard', actor: '{var.who}', amount: 2, damageType: 'cold', title: 'Ouch' }], a, { vars: { who: b.uuid } });
    expect(global.ChatMessage.create.mock.calls.at(-1)[0].content).toContain('data-damage="2" data-damage-type="cold"');
    a._dice = { rollSkill: jest.fn(async () => ({ outcomes: [{ results: [{ targetUuid: b.uuid, success: true, multiplier: 3 }] }] })) };
    await run([{ do: 'blast', radius: 20, skill: 'athletics', defense: '2', damage: 1, damageType: 'fire', title: 'Boom' }], a, { vars: { pointX: 0, pointY: 0 } });
    expect(a._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'athletics', defenseType: 'evasion' });
    expect(global.ChatMessage.create.mock.calls.at(-1)[0].content).toContain('data-damage="3"');
    global.ChatMessage.create.mockClear();
    await run([{ do: 'blast', radius: 5, defense: 'toughness', title: 'Pop' }], a, { vars: { pointX: 500, pointY: 0 } });
    expect(global.ChatMessage.create.mock.calls[0][0].content).toContain('BlastEmpty');
    const totals = [8, 15];
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = totals.shift();
        return this;
      }
    };
    await run([{ do: 'explosion', radius: 20, formula: '2d4', saveDif: 14, damageType: 'fire', title: '{damage} fire' }], a, { vars: { pointX: 0, pointY: 0 } });
    const content = global.ChatMessage.create.mock.calls.at(-1)[0].content;
    expect(content).toContain('8 fire');
    expect(content).toContain(`data-target-uuid="${b.uuid}" data-damage="4"`);
    expect(stepErrors([{ do: 'blast' }, { do: 'explosion', radius: 1 }])).toHaveLength(2);
  });
});
