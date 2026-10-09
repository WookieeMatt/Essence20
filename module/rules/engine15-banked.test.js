import { jest } from '@jest/globals';

/**
 * Round 15, part "banked" (docs/rules-batches/slBanked15.md): the engine pieces, one at a time, on plain fake actors. The
 * converted items themselves are in conv15-banked.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rollVsMany = jest.fn(async (actor, skill, others) => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 })));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const allies = { tokens: [] };
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({ getNearbyAllyTokens: jest.fn(() => allies.tokens) }));
const activateLendAssistance = jest.fn(async () => ({ cancelled: false, message: 'Lent a hand.' }));
jest.unstable_mockModule('./mechanics/actions/lend-assistance.mjs', () => ({ activateLendAssistance }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { resolveValue } = await import('./formula.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { bankedDefense, bankedDefenseMultiplier, bankedEntries } = await import('./bank.mjs');
const { ruleDieSubstitution, ruleMovementStages } = await import('./adapter.mjs');
const { conditionOptions } = await import('./plugins/picks/condition-pick.mjs');
const { targetFacts, effectiveLevel } = await import('./plugins/shared/target-facts-step.mjs');
const { pilotedVehicleOrTarget } = await import('./plugins/zords/piloted-vehicle-or-target.mjs');
const { ruleSnagImmune } = await import('./plugins/rolls/snag-immunity.mjs');
const { skillDieRef } = await import('./plugins/rolls/skill-die-ref.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete node[last.replace(/^-=/, '')];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor,
    ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(name, { items = [], system = {}, type = 'playerCharacter', disposition = 1 } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 6, health: { value: 7, max: 10 }, skills: {}, defenses: { toughness: { total: 12 }, evasion: { total: 10 }, willpower: { total: 10 }, cleverness: { total: 14 } }, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async toggleStatusEffect(status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = items.map(data => makeItem(actor, data));
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  const token = { actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

function addItem(actor, data) {
  const item = makeItem(actor, data);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const savedGame = global.game;
beforeEach(() => {
  rollVsMany.mockClear();
  allies.tokens = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, randomID: () => `r${nextId++}` } };
});

afterEach(() => {
  global.game = savedGame;
});

const run = (steps, actor, { targets = [], item = null, ...more } = {}) => {
  const ctx = stepContext({ actor, item: item ?? makeItem(actor, { name: 'Test', type: 'perk' }), rule: {}, targets });
  Object.assign(ctx, more);
  return runSteps(steps, ctx).then(result => ({ result, ctx }));
};

describe('rollVsEach extras', () => {
  test('damage and dataset ride on the roll; onDouble replaces onHit on a x2 success', async () => {
    const actor = makeActor('A', { system: { skills: { athletics: {} } } });
    const one = makeActor('One');
    const two = makeActor('Two');
    rollVsMany.mockImplementationOnce(async (a, s, others) => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: other === two ? 2 : 1 })));
    await run([{
      do: 'rollVsEach', skill: 'athletics', defense: 'evasion', damage: { value: 2, type: 'fire' }, dataset: { isTest: true },
      onHit: [{ do: 'setVar', key: 'hit', value: 1 }, { do: 'applyCondition', condition: 'prone', to: 'target' }],
      onDouble: [{ do: 'applyCondition', condition: 'stunned', to: 'target' }],
    }], actor, { targets: [one, two] });
    expect(rollVsMany).toHaveBeenCalledWith(actor, 'athletics', [one, two], 'evasion', null, { isTest: true, stepDamage: { value: 2, type: 'fire' } });
    expect(one.statuses.has('prone')).toBe(true);
    expect(two.statuses.has('stunned')).toBe(true);
    expect(two.statuses.has('prone')).toBe(false);
  });

  test('without damage / dataset the call is the old four-argument one', async () => {
    const actor = makeActor('A', { system: { skills: { athletics: {} } } });
    const other = makeActor('B');
    await run([{ do: 'rollVsEach', skill: 'athletics' }], actor, { targets: [other] });
    expect(rollVsMany).toHaveBeenCalledWith(actor, 'athletics', [other], 'toughness');
  });

  test('skill actor:<path> and choiceOf:<uuid>; a missing Skill stops the run unrolled', async () => {
    const empathy = 'Compendium.essence20.test.Item.empathy';
    const actor = makeActor('A', { system: { originSkillsIncrease: 'brawn' }, items: [{ name: 'Empathy', type: 'perk', flags: { core: { sourceId: empathy } }, system: { choice: 'survival' } }] });
    const other = makeActor('B');
    await run([{ do: 'rollVsEach', skill: 'actor:system.originSkillsIncrease' }], actor, { targets: [other] });
    expect(rollVsMany).toHaveBeenLastCalledWith(actor, 'brawn', [other], 'toughness');
    await run([{ do: 'rollVsEach', skill: `choiceOf:${empathy}` }], actor, { targets: [other] });
    expect(rollVsMany).toHaveBeenLastCalledWith(actor, 'survival', [other], 'toughness');
    rollVsMany.mockClear();
    const { result } = await run([{ do: 'rollVsEach', skill: 'actor:system.nothingHere' }], actor, { targets: [other] });
    expect(result).toBe(false);
    expect(rollVsMany).not.toHaveBeenCalled();
  });

  test('the validator walks onDouble and checks damage / dataset', () => {
    const use = steps => ({ type: 'Use', label: 'x', steps });
    expect(validateRule(use([{ do: 'rollVsEach', skill: 'athletics', damage: { value: 1, type: 'fire' }, dataset: { a: 1 }, onDouble: [{ do: 'nope' }] }])).join(' ')).toMatch(/unknown step "nope"/);
    expect(validateRule(use([{ do: 'rollVsEach', skill: 'athletics', damage: { value: 1, type: 'fire' }, dataset: { a: 1 }, onDouble: [] }]))).toEqual([]);
  });
});

describe('the self:choiceOf tag', () => {
  test('true only for a copy of that item with a pick made', () => {
    const uuid = 'Compendium.essence20.test.Item.field';
    const actor = makeActor('A', { items: [{ name: 'Field', type: 'perk', flags: { core: { sourceId: uuid } }, system: {} }] });
    const ask = () => evaluate([`self:choiceOf:${uuid}`], contextFor({ self: actor }));
    expect(ask()).toBe(false);
    actor.items.contents[0].system.choice = 'science';
    expect(ask()).toBe(true);
  });
});

describe('@skillDie', () => {
  test("rolls the Skill's own die with scope.random and notes the roll; untrained-less or unknown is 0", () => {
    const actor = makeActor('A', { system: { skills: { athletics: { shift: 'd6' }, might: { shift: '2d8' } } } });
    const dice = [];
    expect(skillDieRef('athletics', { actor, random: () => 0.5, dice })).toBe(4);
    expect(dice).toEqual([{ formula: '1d6', results: [4], total: 4 }]);
    expect(skillDieRef('might', { actor, random: () => 0.99, dice: [] })).toBe(16);
    expect(skillDieRef('stealth', { actor })).toBe(0);
    expect(resolveValue('@skillDie.athletics + 1', { actor, random: () => 0 }, 0)).toBe(2);
  });
});

describe('pick from: conditions', () => {
  test("the actor's listed Conditions in CONFIG order, minus exclude; all: every status; of: target", () => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), statusEffects: [{ id: 'stunned', name: 'Stunned' }, { id: 'prone', name: 'Prone' }, { id: 'dazed', name: 'Dazed' }] } };
    const actor = makeActor('A');
    ['prone', 'stunned', 'custom'].forEach(status => actor.statuses.add(status));
    const other = makeActor('B');
    other.statuses.add('dazed');
    const ctx = { actor, targets: [other] };
    expect(conditionOptions({}, ctx)).toEqual([{ value: 'stunned', label: 'Stunned' }, { value: 'prone', label: 'Prone' }]);
    expect(conditionOptions({ exclude: ['prone'] }, ctx).map(o => o.value)).toEqual(['stunned']);
    expect(conditionOptions({ all: true }, ctx).map(o => o.label)).toEqual(['Prone', 'Stunned', 'custom']);
    expect(conditionOptions({ of: 'target' }, ctx).map(o => o.value)).toEqual(['dazed']);
  });

  test('removeCondition fills {choice.x} / {var.x}', async () => {
    const actor = makeActor('A');
    actor.statuses.add('prone');
    await run([{ do: 'setVar', key: 'which', value: 'prone' }, { do: 'removeCondition', condition: '{var.which}', to: 'self' }], actor);
    expect(actor.statuses.has('prone')).toBe(false);
  });
});

describe('targetFacts and @effectiveLevel', () => {
  test('the facts go in the run vars; no target stops the run', async () => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), damageTypes: { fire: 'Fire', blunt: 'Blunt' }, defenses: {} } };
    const actor = makeActor('A');
    const foe = makeActor('Foe', { system: { resistances: { fire: true }, immunities: { blunt: true } }, items: [{ name: 'Vain', type: 'hangUp' }, { name: 'Tough', type: 'perk' }] });
    const { result, ctx } = await run([{ do: 'targetFacts' }], actor, { targets: [foe] });
    expect(result).toBe(true);
    expect(ctx.vars).toEqual(expect.objectContaining({ name: 'Foe', health: 7, healthMax: 10, hangUps: 'Vain', perks: 'Tough', lowestDefense: 'evasion' }));
    expect(ctx.vars.powers).toBe('None');
    expect(targetFacts(foe).resistances).toBe('Fire, Blunt');
    expect(targetFacts(foe).defenses).toBe('toughness 12, evasion 10, willpower 10, cleverness 14');
    expect((await run([{ do: 'targetFacts' }], actor)).result).toBe(false);
  });

  test("an NPC's Threat Level, else the level", () => {
    expect(effectiveLevel(makeActor('N', { type: 'npc', system: { threatLevel: 9, level: 2 } }))).toBe(9);
    const pc = makeActor('P', { system: { level: 4 } });
    expect(effectiveLevel(pc)).toBe(4);
    expect(resolveValue('@effectiveLevel.target', { actor: pc, other: makeActor('N', { type: 'npc', system: { threatLevel: 3 } }) }, 0)).toBe(3);
  });
});

describe('recipient pilotedVehicleOrTarget', () => {
  test('no crewed vehicle: the first target when it is a vehicle', () => {
    const actor = makeActor('A');
    const car = makeActor('Car', { type: 'vehicle' });
    expect(pilotedVehicleOrTarget(actor, [car])).toEqual([car]);
    expect(pilotedVehicleOrTarget(actor, [makeActor('B')])).toEqual([]);
    expect(pilotedVehicleOrTarget(actor, [])).toEqual([]);
  });
});

describe('durations and @combat', () => {
  test('thisRound runs out when the round changes; out of combat it waits for one', () => {
    global.game.combat = { id: 'c', round: 2, turn: 1 };
    const entry = { until: 'thisRound', stamp: stampFor('thisRound') };
    expect(isExpired(entry)).toBe(false);
    global.game.combat.round = 3;
    expect(isExpired(entry)).toBe(true);
    global.game.combat = null;
    expect(isExpired({ until: 'thisRound', stamp: stampFor('thisRound') })).toBe(false);
  });

  test('throughNextRound lasts the round after; never runs out out of combat', () => {
    global.game.combat = { id: 'c', round: 2 };
    const entry = { until: 'throughNextRound', stamp: stampFor('throughNextRound') };
    global.game.combat.round = 3;
    expect(isExpired(entry)).toBe(false);
    global.game.combat.round = 4;
    expect(isExpired(entry)).toBe(true);
    global.game.combat = null;
    expect(isExpired(entry)).toBe(false);
  });

  test('mapScene lasts while the viewed scene is the same', () => {
    global.game.scenes = { current: { id: 's1' } };
    const entry = { until: 'mapScene', stamp: stampFor('mapScene') };
    expect(isExpired(entry)).toBe(false);
    global.game.scenes.current = { id: 's2' };
    expect(isExpired(entry)).toBe(true);
  });

  test('@combat.round / @combat.turn', () => {
    expect(resolveValue('@combat.round', {}, -1)).toBe(0);
    global.game.combat = { round: 3, turn: 2 };
    expect(resolveValue('@combat.round * 10 + @combat.turn', {}, 0)).toBe(32);
  });
});

describe('banks: defenseMultiply, splitBank, bankedFrom, scaleBank', () => {
  test('a bank step with defenseMultiply doubles that Defense against the next attack, then goes', async () => {
    const actor = makeActor('A');
    await run([{ do: 'bank', to: 'self', defense: 'toughness', defenseMultiply: 2, until: 'combat' }], actor);
    expect(await bankedDefense(actor, 'toughness')).toBe(0);
    expect(bankedEntries(actor)).toHaveLength(1);
    expect(await bankedDefenseMultiplier(actor, 'evasion')).toBe(1);
    expect(await bankedDefenseMultiplier(actor, 'toughness')).toBe(2);
    expect(bankedEntries(actor)).toEqual([]);
  });

  test("splitBank moves part of the item's bank on the first ally to another", async () => {
    const leader = makeActor('Leader');
    const first = makeActor('First');
    const second = makeActor('Second');
    allies.tokens = [first.token, second.token];
    const item = { id: 'plan', name: 'Plan', uuid: `${leader.uuid}.Item.plan` };
    await run([{ do: 'bank', to: 'target', upshift: 3, until: 'combat' }], leader, { targets: [first], item });
    const askPick = jest.fn(async (step, options) => options.at(-1).value);
    const { ctx } = await run([{ do: 'splitBank' }], leader, { targets: [first], item, askPick });
    expect(askPick.mock.calls[0][1].map(o => o.value)).toEqual([second.uuid]);
    expect(askPick.mock.calls[1][1].map(o => o.value)).toEqual(['1', '2']);
    expect(bankedEntries(first)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
    expect(bankedEntries(second)).toEqual([expect.objectContaining({ shiftUp: 2, source: 'plan', until: 'combat' })]);
    expect(ctx.chat).toEqual(['SplitBankDone']);
    // Nothing of ↑2 left to split.
    expect((await run([{ do: 'splitBank' }], leader, { targets: [first], item, askPick })).result).toBe(false);
  });

  test('bankedFrom sees a live bank from that book item; scaleBank multiplies it', async () => {
    const uuid = 'Compendium.essence20.test.Item.stalwart';
    const actor = makeActor('A', { items: [{ name: 'Stalwart', type: 'perk', flags: { core: { sourceId: uuid } } }] });
    const [stalwart] = actor.items.contents;
    expect(evaluate([`self:bankedFrom:${uuid}`], contextFor({ self: actor }))).toBe(false);
    await run([{ do: 'bank', to: 'self', defense: 'toughness', defenseBonus: 2, until: 'combat' }], actor, { item: stalwart });
    expect(evaluate([`self:bankedFrom:${uuid}`], contextFor({ self: actor }))).toBe(true);
    await run([{ do: 'scaleBank', from: uuid, multiply: 2 }], actor);
    expect(await bankedDefense(actor, 'toughness')).toBe(4);
    expect((await run([{ do: 'scaleBank', from: uuid, multiply: 2 }], actor)).result).toBe(false);
    expect(validateRule({ type: 'Use', label: 'x', steps: [{ do: 'scaleBank' }] }).join(' ')).toMatch(/needs from.*needs multiply/);
  });
});

describe('lendAssistance and keepTargets', () => {
  test('lendAssistance reports the assist, a cancelled one stops the run', async () => {
    const actor = makeActor('A');
    const { result, ctx } = await run([{ do: 'lendAssistance' }], actor);
    expect(result).toBe(true);
    expect(ctx.chat).toEqual(['Lent a hand.']);
    activateLendAssistance.mockResolvedValueOnce({ cancelled: true });
    expect((await run([{ do: 'lendAssistance' }], actor)).result).toBe(false);
  });

  test('keepTargets cuts the targets to the first N; under 1 stops the run', async () => {
    const actor = makeActor('A');
    const others = [1, 2, 3].map(i => makeActor(`T${i}`));
    const { ctx } = await run([{ do: 'setVar', key: 'n', value: 2 }, { do: 'keepTargets', max: '@var.n' }], actor, { targets: others });
    expect(ctx.targets).toEqual(others.slice(0, 2));
    expect((await run([{ do: 'keepTargets', max: '0' }], actor, { targets: others })).result).toBe(false);
  });
});

describe('SnagImmunity', () => {
  test("the roll can't suffer a Snag while its when holds", () => {
    const actor = makeActor('A', { items: [{ name: 'X', type: 'perk', system: { rules: [{ type: 'SnagImmunity', when: ['skill:technology'] }] } }] });
    expect(ruleSnagImmune(actor, { rolledSkill: 'technology' })).toBe(true);
    expect(ruleSnagImmune(actor, { rolledSkill: 'culture' })).toBe(false);
    expect(validateRule({ type: 'SnagImmunity', when: ['skill:technology'] })).toEqual([]);
  });
});

describe('DieSubstitution from / consumeMark', () => {
  test('only from the listed dice; the roll uses up the mark', async () => {
    global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] } };
    const rule = { type: 'DieSubstitution', mode: 'floor', die: 'd4', from: ['d2'], consumeMark: 'boost', when: ['self:marked:boost'] };
    expect(validateRule(rule)).toEqual([]);
    const actor = makeActor('A', { items: [{ name: 'X', type: 'perk', system: { rules: [rule] } }] });
    actor.flags.essence20.ruleMarks = { boost: { until: null } };
    expect(ruleDieSubstitution(actor, null, {}, 'd20').shift).toBe('d20');
    const result = ruleDieSubstitution(actor, null, {}, 'd2');
    expect(result.shift).toBe('d4');
    await result.spend();
    expect(actor.flags.essence20.ruleMarks.boost).toBeUndefined();
  });
});

describe('combat stamps, turn order', () => {
  function combatOf(...actors) {
    const turns = actors.map((actor, i) => ({ actor, initiative: i == 2 ? null : 20 - i * 5 }));
    global.game.combat = { id: 'c', round: 2, turn: 1, turns, combatants: { contents: turns } };
  }

  test('stamped:<flag>[:round|:turn] reads a {combatId, round, turn} stamp', () => {
    const actor = makeActor('A');
    combatOf(actor);
    const ask = tag => evaluate([tag], contextFor({ self: actor }));
    expect(ask('self:stamped:noisy')).toBe(false);
    actor.flags.essence20.noisy = { combatId: 'c', round: 2, turn: 0 };
    expect(ask('self:stamped:noisy')).toBe(true);
    expect(ask('self:stamped:noisy:turn')).toBe(false);
    actor.flags.essence20.noisy.turn = 1;
    expect(ask('self:stamped:noisy:turn')).toBe(true);
    actor.flags.essence20.noisy.round = 1;
    expect(ask('self:stamped:noisy')).toBe(false);
  });

  test('turnNeighbour and @turnOrder: the combatant above / below with a rolled Initiative', () => {
    const [a, b, c] = ['A', 'B', 'C'].map(name => makeActor(name));
    combatOf(a, b, c);
    const ask = (other, tag) => evaluate([tag], contextFor({ self: a, other }));
    expect(ask(a, 'target:turnNeighbour:up')).toBe(false);
    expect(ask(b, 'target:turnNeighbour:up')).toBe(true);
    // C has no Initiative yet.
    expect(ask(b, 'target:turnNeighbour:down')).toBe(false);
    expect(resolveValue('@turnOrder.up', { actor: a, recipient: b }, 0)).toBe(20);
    expect(resolveValue('@turnOrder.down', { actor: b, other: a }, 0)).toBe(15);
  });
});

describe('owned items: holdsItem, flagItem', () => {
  test('holdsItem asks every & joined item tag of one item', () => {
    const actor = makeActor('A', { items: [{ name: 'Rifle', type: 'weaponEffect', system: { numHands: 2, classification: { style: 'melee' } } }] });
    const ask = tag => evaluate([tag], contextFor({ self: actor }));
    expect(ask('self:holdsItem:item:type:weaponEffect&item:data:system.numHands=2')).toBe(true);
    expect(ask('self:holdsItem:item:type:weaponEffect&not:item:data:system.classification.style=melee')).toBe(false);
  });

  test('flagItem flags the pick and takes the flag off the others first', async () => {
    const actor = makeActor('A', { items: [{ name: 'One', type: 'hangUp' }, { name: 'Two', type: 'hangUp' }] });
    const [one, two] = actor.items.contents;
    const pickAndFlag = id => run([
      { do: 'setVar', key: 'x', value: 0 },
      { do: 'pick', key: 'h', from: 'ownedItem', itemType: 'hangUp' },
      { do: 'flagItem', item: 'choice:h', flag: 'ignored', exclusive: ['item:type:hangUp'] },
    ], actor, { askPick: async () => id });
    await pickAndFlag(one.id);
    expect(one.flags.essence20.ignored).toBe(true);
    await pickAndFlag(two.id);
    expect(one.flags.essence20.ignored).toBeUndefined();
    expect(two.flags.essence20.ignored).toBe(true);
    expect(validateRule({ type: 'Use', label: 'x', steps: [{ do: 'flagItem' }] }).join(' ')).toMatch(/needs a flag.*needs an item/);
  });
});

describe('mark keep', () => {
  test("a setter's mark stays on the newest N creatures, even within one millisecond", async () => {
    const actor = makeActor('A');
    const others = [1, 2, 3].map(i => makeActor(`T${i}`));
    global.game.actors = { contents: [actor, ...others], [Symbol.iterator]: () => [actor, ...others][Symbol.iterator]() };
    global.canvas = { tokens: { placeables: [actor, ...others].map(a => a.token) }, scene: { tokens: [] } };
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    for (const other of others) {
      await run([{ do: 'mark', key: 'm', perSetter: true, to: 'target', keep: '2' }], actor, { targets: [other] });
    }

    jest.restoreAllMocks();
    global.canvas = undefined;
    expect(others.map(other => !!other.flags.essence20.ruleMarks?.[`m--${actor.id}`])).toEqual([false, true, true]);
  });
});

describe('updateItem multiply / parent / appendTraits', () => {
  test('numbers scaled and floored, empty ones left; the weapon of a weaponEffect gains traits once', async () => {
    const actor = makeActor('A');
    const weapon = addItem(actor, { name: 'Gun', type: 'weapon', system: { traits: ['loud'] } });
    const effect = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { range: { value: 25, long: '' } } });
    const steps = [
      { do: 'pick', key: 'w', from: 'ownedItem', itemType: 'weaponEffect', auto: true },
      { do: 'updateItem', item: 'choice:w', multiply: { 'system.range.value': 0.5, 'system.range.long': 0.5 } },
      { do: 'updateItem', item: 'choice:w', parent: true, appendTraits: ['inaccurate'] },
    ];
    await run(steps, actor);
    expect(effect.system.range).toEqual({ value: 12, long: '' });
    await run(steps.slice(0, 1).concat(steps.slice(2)), actor);
    expect(weapon.system.traits).toEqual(['loud', 'inaccurate']);
  });
});

describe('roll dataset, cost.kind, Movement recipient', () => {
  test('a roll step carries its dataset', async () => {
    const actor = makeActor('A', { system: { skills: { persuasion: {} } } });
    actor._dice = { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ roll: { total: 12 }, results: [{ success: true, total: 12 }] }] })) };
    await run([{ do: 'roll', skill: 'persuasion', dif: 10, dataset: { isRouseAttempt: true } }], actor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', isRouseAttempt: true }), actor);
  });

  test('cost.kind is a name and needs cost.action', () => {
    expect(validateRule({ type: 'Use', label: 'x', cost: { action: 'standard', kind: 'rouse' }, steps: [] })).toEqual([]);
    expect(validateRule({ type: 'Use', label: 'x', cost: { kind: 'rouse' }, steps: [] }).join(' ')).toMatch(/cost.kind/);
  });

  test('a marked Movement rule reads @recipient (the marked creature)', () => {
    const giver = makeActor('Giver', { items: [{ name: 'X', type: 'perk', system: { rules: [{ type: 'Movement', scope: 'marked', mark: 'm', movement: 'ground', op: 'add', value: '@recipient.flags.essence20.ruleMarks.m.count', stage: 'final' }] } }] });
    const mate = makeActor('Mate');
    mate.flags.essence20.ruleMarks = { m: { count: 10, by: giver.uuid, until: null } };
    global.game.actors = { contents: [giver, mate], get: id => [giver, mate].find(a => a.id == id), [Symbol.iterator]: () => [giver, mate][Symbol.iterator]() };
    global.fromUuidSync = uuid => [giver, mate].find(a => a.uuid == uuid) ?? null;
    expect(ruleMovementStages(mate)('final', 'ground', 30)).toBe(40);
  });
});

describe('step stamp', () => {
  test("writes the running combat's {combatId, round, turn} on each recipient; the stamped tag reads it", async () => {
    const actor = makeActor('A');
    global.game.combat = { id: 'c', round: 4, turn: 2, turns: [], combatants: { contents: [] } };
    await run([{ do: 'stamp', flag: 'didIt' }], actor);
    expect(actor.flags.essence20.didIt).toEqual({ combatId: 'c', round: 4, turn: 2 });
    expect(evaluate(['self:stamped:didIt:turn'], contextFor({ self: actor }))).toBe(true);
    expect(validateRule({ type: 'Use', label: 'x', steps: [{ do: 'stamp' }] }).join(' ')).toMatch(/stamp needs a flag name/);
  });
});
