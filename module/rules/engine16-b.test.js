import { jest } from '@jest/globals';

/**
 * Round 16, part b (docs/rules-batches/slLeftB16.md): the engine pieces this part added, on their own. The items that use
 * them are in rules/conv16-b.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const rollVsMany = jest.fn(async (actor, skill, others) => others.map(other => ({ targetUuid: other.uuid, success: true, multiplier: 1 })));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({ rollVsMany }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const rollTest = jest.fn(async () => ({ success: true, total: 12 }));
const chooseSelect = jest.fn(async () => null);
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ rollTest, chooseSelect, chooseButtons: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ getDefenseValue: (actor, key) => Number(actor.system?.defenses?.[key]?.total) || 0 }));

await import('./plugins/index.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { evaluate, contextFor } = await import('./predicate.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { consumeOneMark } = await import('./plugins/marks/counted-marks.mjs');
const { isDueNextRound } = await import('./plugins/combat/next-round-schedule.mjs');
const { bestSkill } = await import('./plugins/rolls/contest.mjs');
const { validateRule } = await import('./types.mjs');

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

let nextId = 1;
function actor(name, extra = {}) {
  const made = {
    id: `a${nextId++}`, name, type: 'playerCharacter', flags: { essence20: {} }, statuses: new Set(), items: { contents: [] },
    system: { defenses: { toughness: { total: 10 }, evasion: { total: 14 }, willpower: { total: 14 }, cleverness: { total: 9 } } },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    ...extra,
  };
  made.uuid = `Actor.${made.id}`;
  return made;
}

const ctxOf = (self, extra = {}) => contextFor({ self, ...extra });

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() }, i18n: { localize: key => `L:${key}`, format: key => `L:${key}`, has: () => true } };
  global.foundry = { utils: { getProperty: (o, p) => p.split('.').reduce((at, k) => at?.[k], o), setProperty: setPath } };
  global.fromUuid = async () => null;
});

describe('durations combatRound and combatThroughNextRound', () => {
  test('tied to the combat and round they started in; never live when set out of combat', () => {
    const combat = { id: 'c1', round: 2, turn: 0, started: true };
    for (const [until, lastRound] of [['combatRound', 2], ['combatThroughNextRound', 3]]) {
      const entry = { until, stamp: stampFor(until, combat) };
      game.combat = combat;
      expect(isExpired(entry)).toBe(false);
      game.combat = { ...combat, round: lastRound };
      expect(isExpired(entry)).toBe(false);
      game.combat = { ...combat, round: lastRound + 1 };
      expect(isExpired(entry)).toBe(true);
      game.combat = { ...combat, id: 'c2' };
      expect(isExpired(entry)).toBe(true);
      game.combat = null;
      expect(isExpired(entry)).toBe(true);
      expect(isExpired({ until, stamp: stampFor(until, null) })).toBe(true);
    }
  });
});

describe('tags', () => {
  test('skill:in, bankKey, target:exists, item:mentions', () => {
    const a = actor('A');
    expect(evaluate(['skill:in:culture|science'], ctxOf(a, { rolledSkill: 'science' }))).toBe(true);
    expect(evaluate(['skill:in:culture|science'], ctxOf(a, { rolledSkill: 'might' }))).toBe(false);
    expect(evaluate(['skill:in:culture'], ctxOf(a))).toBeNull();
    a.flags.essence20.ruleBank = [{ id: 'x', key: 'dataBridge', uses: 1, when: [] }];
    const b = actor('B');
    expect(evaluate(['self:bankKey:dataBridge'], ctxOf(a))).toBe(true);
    expect(evaluate(['target:bankKey:dataBridge'], ctxOf(b, { other: a }))).toBe(true);
    expect(evaluate(['self:bankKey:dataBridge'], ctxOf(b))).toBe(false);
    expect(evaluate(['target:exists'], ctxOf(a))).toBe(false);
    expect(evaluate(['target:exists'], ctxOf(a, { other: b }))).toBe(true);
    expect(evaluate(['item:mentions:mega weapon|combiner'], ctxOf(a, { item: { name: 'Zord Mega-Weapon System', system: {} } }))).toBe(true);
    expect(evaluate(['item:mentions:mega weapon|combiner'], ctxOf(a, { item: { name: 'Heavy Chassis', system: { prerequisite: 'Combiner' } } }))).toBe(true);
    expect(evaluate(['item:mentions:mega weapon|combiner'], ctxOf(a, { item: { name: 'Heavy Chassis', system: {} } }))).toBe(false);
  });

  test('target:amongUserTargets reads the first N of this user\'s targets', () => {
    const a = actor('A');
    const [one, two] = [actor('One'), actor('Two')];
    game.user.targets = new Set([{ actor: one }, { actor: two }]);
    expect(evaluate(['target:amongUserTargets:1'], ctxOf(a, { other: one }))).toBe(true);
    expect(evaluate(['target:amongUserTargets:1'], ctxOf(a, { other: two }))).toBe(false);
    expect(evaluate(['target:amongUserTargets:2'], ctxOf(a, { other: two }))).toBe(true);
    expect(evaluate(['target:amongUserTargets:0'], ctxOf(a, { other: one }))).toBe(false);
  });
});

describe('steps', () => {
  test('defenseFacts: the highest Defense (ties to the first), the values, the Hang-Ups or "none known"; no target stops', async () => {
    const a = actor('A');
    const b = actor('B');
    b.items.contents = [{ type: 'hangUp', name: 'Proud' }];
    const ctx = stepContext({ actor: a, item: null, targets: [b] });
    expect(await runSteps([{ do: 'defenseFacts' }], ctx)).toBe(true);
    expect(ctx.vars).toEqual(expect.objectContaining({ highestDefense: 'evasion', defenseValues: 'Toughness 10, Evasion 14, Willpower 14, Cleverness 9', hangUpNames: 'Proud' }));
    const self = stepContext({ actor: b, item: null, targets: [] });
    await runSteps([{ do: 'defenseFacts', of: 'self' }], self);
    a.items.contents = [];
    const none = stepContext({ actor: b, item: null, targets: [a] });
    await runSteps([{ do: 'defenseFacts' }], none);
    expect(none.vars.hangUpNames).toBe('L:E20.ChronoFileAccessNoHangUps');
    expect(await runSteps([{ do: 'defenseFacts' }], stepContext({ actor: a, item: null, targets: [] }))).toBe(false);
  });

  test('rollVsEach fills {var.x} in its Defense; roll takes a downshift formula', async () => {
    const a = actor('A');
    const b = actor('B');
    const ctx = stepContext({ actor: a, item: null, targets: [b] });
    ctx.vars.which = 'cleverness';
    await runSteps([{ do: 'rollVsEach', skill: 'persuasion', defense: '{var.which}' }, { do: 'roll', skill: 'persuasion', dif: 10, downshift: '1 + 1' }], ctx);
    expect(rollVsMany).toHaveBeenCalledWith(a, 'persuasion', [b], 'cleverness');
    expect(rollTest).toHaveBeenCalledWith(a, 'persuasion', 10, expect.objectContaining({ shiftDown: 2 }));
  });

  test('pick optional goes on when nothing is picked; choose localizes E20 option labels and prompt', async () => {
    const a = actor('A');
    const item = { id: 'i1', name: 'Item', flags: {}, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } };
    const ctx = stepContext({ actor: a, item, targets: [] });
    expect(await runSteps([{ do: 'pick', key: 'k', from: 'list', options: ['x', 'y'], optional: true }, { do: 'setVar', key: 'after', value: 1 }], ctx)).toBe(true);
    expect(ctx.vars.after).toBe(1);
    expect(item.flags.essence20?.rules?.choices?.k).toBeUndefined();
    expect(await runSteps([{ do: 'pick', key: 'k', from: 'list', options: [] }], ctx)).toBe(false);

    const shown = {};
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async ({ content, buttons }) => {
      Object.assign(shown, { content, labels: buttons.map(button => button.label) });
      return '1';
    }) } } };
    await runSteps([{ do: 'choose', prompt: 'E20.ImperfectionPrompt', options: [{ label: 'E20.ImperfectionRoll', steps: [] }, { label: 'Plain', steps: [{ do: 'setVar', key: 'chose', value: 2 }] }] }], ctx);
    expect(shown.labels).toEqual(['L:E20.ImperfectionRoll', 'Plain']);
    expect(shown.content).toContain('L:E20.ImperfectionPrompt');
    expect(ctx.vars.chose).toBe(2);
  });
});

describe('marks, schedules, contests', () => {
  test('consumeOneMark takes one off every setter\'s copy, removing those that run out', async () => {
    const a = actor('A');
    a.flags.essence20.ruleMarks = { appraisal: { by: 'x', count: 2 }, 'appraisal--b': { by: 'y', count: 1 }, other: { by: 'x' } };
    global.fromUuid = async uuid => (uuid == a.uuid ? a : null);
    await consumeOneMark({ actorUuid: a.uuid, key: 'appraisal' });
    expect(a.flags.essence20.ruleMarks).toEqual({ appraisal: { by: 'x', count: 1 }, other: { by: 'x' } });
  });

  test('isDueNextRound: a round later at or past the turn, or any turn the round after; that combat only', () => {
    const entry = { combatId: 'c1', round: 2, turn: 3 };
    const at = (round, turn, id = 'c1') => isDueNextRound(entry, { id, round, turn });
    expect([at(2, 4), at(3, 2), at(3, 3), at(4, 0), at(9, 9, 'c2')]).toEqual([false, false, true, true, false]);
    expect(isDueNextRound({ combatId: null, round: 0, turn: 0 }, { id: 'c1', round: 5, turn: 0 })).toBe(false);
  });

  test('bestSkill: the best die among the listed Skills, a tie to the first listed', () => {
    global.CONFIG = { E20: { skillShiftList: ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'] } };
    const fighter = actor('F', { system: { skills: { might: { shift: 'd6' }, finesse: { shift: 'd8' } } } });
    expect(bestSkill(fighter, ['might', 'finesse'])).toBe('finesse');
    fighter.system.skills.finesse.shift = 'd6';
    expect(bestSkill(fighter, ['might', 'finesse'])).toBe('might');
  });
});

describe('rule types validate', () => {
  test('MarkedRowOutcome, KitOption, KitSkill, HitRider incoming, Defense holderBest, RollModifier bondPartnerIncoming / consumeCount', () => {
    expect(validateRule({ type: 'MarkedRowOutcome', scope: 'marked', mark: 'm', promote: true, consume: 'promoted' })).toEqual([]);
    expect(validateRule({ type: 'MarkedRowOutcome', promote: true })).not.toEqual([]);
    expect(validateRule({ type: 'KitOption', label: 'Heal 2', cost: 'standard', steps: [] })).toEqual([]);
    expect(validateRule({ type: 'KitSkill', skill: 'science' })).toEqual([]);
    expect(validateRule({ type: 'HitRider', scope: 'incoming', note: -1 })).toEqual([]);
    expect(validateRule({ type: 'Defense', scope: 'bondPartner', mode: 'holderBest', defense: 'toughness' })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', scope: 'bondPartnerIncoming', downshift: 2 })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', upshift: 1, consumeMark: 'k', consumeFrom: 'target', consumeCount: true })).toEqual([]);
  });
});
