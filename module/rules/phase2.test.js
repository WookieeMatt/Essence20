import { jest } from '@jest/globals';
import { limitFlag, limitKey, recordUse, restClears, usesInWindow, usesLeft } from './limits.mjs';
import { canAfford, changeResource, recipients, runSteps, stepContext, stepErrors } from './steps.mjs';
import { bankRollBonus, bankedEntries, bankedSources, consumeBanked, isExpired } from './bank.mjs';
import { fireTriggers, rollOutcome, runUse, useAvailable, useRulesOf, wouldBeDefeated } from './triggers.mjs';
import { rebuildIndex } from './index.mjs';
import { ruleRollSources } from './adapter.mjs';
import { summarizeRule, validateRule } from './types.mjs';
import { registrySnapshot } from '../helpers/extensions.mjs';

let nextId = 1;

/** An actor double whose flags, updates and items behave enough like Foundry's for the steps. */
function makeActor(items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, uuid: `Actor.a${nextId}`, name: extra.name ?? 'Hero', type: 'playerCharacter', isOwner: true,
    statuses: new Set(extra.statuses ?? []),
    flags: { essence20: {} },
    system: { level: 4, health: { value: 10, max: 12 }, energon: { value: 3 }, ...(extra.system ?? {}) },
    getFlag(scope, key) {
      return foundry.utils.getProperty(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      foundry.utils.setProperty(this.flags[scope] ??= {}, key, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        const deletion = key.match(/^(.*)\.-=(.+)$/);
        if (deletion) {
          delete foundry.utils.getProperty(this, deletion[1])?.[deletion[2]];
        } else {
          foundry.utils.setProperty(this, key, value);
        }
      }
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      active ? this.statuses.add(status) : this.statuses.delete(status);
    }),
    createEmbeddedDocuments: jest.fn(async () => []),
  };
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

function makeItem(rules, extra = {}) {
  const item = {
    id: `i${nextId++}`, name: extra.name ?? 'Gadget', type: 'perk', flags: extra.flags ?? {}, system: { rules },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
  return item;
}

beforeEach(() => {
  global.game = {
    combat: null,
    user: { id: 'u1', targets: new Set() },
    i18n: { localize: key => key, format: (key, data) => `${key}${JSON.stringify(data)}` },
    settings: { get: () => 1 },
    actors: [],
  };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      hasProperty: (object, key) => key.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), object) !== undefined,
      randomID: () => `r${nextId++}`,
    },
  };
});

/* -------------------------------------------- */
/*  Limits                                       */
/* -------------------------------------------- */

describe('limits', () => {
  test('turn and round count only inside the same combat turn/round', async () => {
    const item = makeItem([]);
    const actor = makeActor([item]);
    const rule = { limit: { per: 'turn', max: 2 } };
    const combat = { started: true, id: 'c1', round: 1, turn: 0 };
    game.combat = combat;
    expect(usesLeft(actor, rule, item, 0)).toBe(2);
    await recordUse(actor, rule, item, 0, combat);
    await recordUse(actor, rule, item, 0, combat);
    expect(usesLeft(actor, rule, item, 0)).toBe(0);
    combat.turn = 1;
    expect(usesLeft(actor, rule, item, 0)).toBe(2);
    expect(usesInWindow(actor, limitKey(rule, item, 0), 'round', combat)).toBe(2);
    game.combat = null;
    expect(usesInWindow(actor, limitKey(rule, item, 0), 'round', null)).toBe(0);
  });

  test('rest limits count until a rest clears them; keys can be shared; no limit is unlimited', async () => {
    const item = makeItem([]);
    const actor = makeActor([item]);
    const rule = { limit: { per: 'rest', max: '1', key: 'shared' } };
    await recordUse(actor, rule, item, 0);
    expect(usesLeft(actor, rule, makeItem([]), 3)).toBe(0);
    expect(restClears(actor)).toEqual(['flags.essence20.ruleUses.-=shared']);
    expect(usesLeft(actor, {}, item, 0)).toBe(Infinity);
    await recordUse(actor, {}, item, 0);
    expect(limitFlag('a b')).toBe('ruleUses.a_b');
  });
});

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

describe('steps', () => {
  test('resources: pools on the item, paths on the actor', async () => {
    const item = makeItem([{ type: 'Pool', key: 'charge', max: 3 }], { flags: { essence20: { rules: { pools: { charge: { value: 2 } } } } } });
    const actor = makeActor([item]);
    const ctx = stepContext({ actor, item, targets: [] });
    expect(canAfford({ pool: 'charge' }, 2, ctx)).toBe(true);
    expect(canAfford({ pool: 'charge' }, 3, ctx)).toBe(false);
    expect(canAfford(null, 5, ctx)).toBe(true);
    expect(await changeResource({ pool: 'charge' }, -1, ctx)).toBe(true);
    expect(item.flags.essence20.rules.pools.charge.value).toBe(1);
    expect(await changeResource({ pool: 'charge' }, 9, ctx)).toBe(true);
    expect(item.flags.essence20.rules.pools.charge.value).toBe(3);
    expect(await changeResource({ path: 'system.energon.value' }, -5, ctx)).toBe(false);
    expect(await changeResource({ path: 'system.energon.value' }, -2, ctx)).toBe(true);
    expect(actor.system.energon.value).toBe(1);
  });

  test('chat, heal, conditions, toggles, branches and a stop', async () => {
    const item = makeItem([]);
    const ally = makeActor([], { name: 'Ally', system: { health: { value: 2, max: 5 } } });
    const actor = makeActor([item]);
    const ctx = stepContext({ actor, item, targets: [ally], ask: async () => 1 });
    const ok = await runSteps([
      { do: 'chat', text: '{name} helps {target}' },
      { do: 'heal', to: 'target', amount: 9 },
      { do: 'setToggle', key: 'stance' },
      { do: 'removeCondition', to: 'target', condition: 'prone' },
      { do: 'choose', options: [{ label: 'A', steps: [{ do: 'chat', text: 'picked A' }] }, { label: 'B', steps: [{ do: 'chat', text: 'picked B' }] }] },
      { do: 'chat', text: 'skipped', when: ['self:morphed'] },
      { do: 'nonsense' },
    ], ctx);
    expect(ok).toBe(true);
    expect(ctx.chat[0]).toBe('Hero helps Ally');
    expect(ally.system.health.value).toBe(5);
    const over = makeActor([], { system: { health: { value: 4, max: 0 } } });
    await runSteps([{ do: 'heal', amount: 2 }], stepContext({ actor: over, item, targets: [] }));
    expect(over.system.health.value).toBe(6);
    expect(item.flags.essence20.rules.toggles.stance).toBe(true);
    expect(ctx.chat).toContain('picked B');
    expect(ctx.chat).not.toContain('skipped');

    const broke = stepContext({ actor, item, targets: [] });
    expect(await runSteps([{ do: 'spend', resource: { path: 'system.energon.value' }, amount: 99, onFail: [{ do: 'chat', text: 'no' }] }, { do: 'chat', text: 'after' }], broke)).toBe(false);
    expect(broke.chat).toContain('no');
    expect(broke.chat).not.toContain('after');
  });

  test('damage steps change only the damage they were handed', async () => {
    const actor = makeActor([], { system: { health: { value: 3, max: 10 } } });
    const ctx = stepContext({ actor, item: makeItem([]), targets: [], damage: { amount: 8 } });
    await runSteps([{ do: 'leaveAt', value: 1 }], ctx);
    expect(ctx.damage.amount).toBe(2);
    await runSteps([{ do: 'negateDamage' }], ctx);
    expect(ctx.damage.amount).toBe(0);
    await runSteps([{ do: 'negateDamage' }], stepContext({ actor, item: makeItem([]), targets: [] }));
  });

  test('targets: the user\'s targets, or a stop with a warning', async () => {
    const foe = makeActor([], { name: 'Foe' });
    const actor = makeActor([]);
    global.ui = { notifications: { warn: jest.fn() } };
    const none = stepContext({ actor, item: makeItem([], { name: 'Zap' }) });
    expect(await runSteps([{ do: 'target' }], none)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
    game.user.targets = new Set([{ actor: foe }]);
    const some = stepContext({ actor, item: makeItem([]) });
    expect(await runSteps([{ do: 'target', max: 1 }], some)).toBe(true);
    expect(recipients({ to: 'target' }, some)).toEqual([foe]);
    expect(recipients({ to: 'targets' }, some)).toEqual([foe]);
    expect(recipients({}, some)).toEqual([actor]);
  });

  test('the validator names bad steps, nested ones too', () => {
    expect(stepErrors('x')).toEqual(['steps must be a list']);
    expect(stepErrors([null, { do: 'fly' }, { do: 'heal', to: 'everyone' }, { do: 'roll' }, { do: 'choose' },
      { do: 'roll', skill: 'might', onFail: [{ do: 'grant' }] }, { do: 'choose', options: [{ steps: [{ do: 'x' }] }] }])).toEqual([
      'steps[0] is not a step', 'steps[1]: unknown step "fly"', 'steps[2]: to must be self, target, targets, targetOrSelf, allies:<ft>, enemies:<ft>, allies+self:<ft> or all:<ft>', 'steps[3]: roll needs skill',
      'steps[4]: choose needs options', 'steps[5].onFail[0]: grant needs uuid', 'steps[6].options[0].steps[0]: unknown step "x"',
    ]);
    expect(stepErrors([{ do: 'heal', amount: '2 +' }, { do: 'setToggle', key: 'k', value: 'toggle' }])).toEqual(['steps[0].amount: Unexpected end']);
  });
});

/* -------------------------------------------- */
/*  Banked bonuses                               */
/* -------------------------------------------- */

describe('bank', () => {
  test('banked bonuses become roll sources, used up as they are taken', async () => {
    const actor = makeActor([]);
    const entry = await bankRollBonus(actor, { label: 'Pep talk', shiftUp: 1, when: ['skill:might'], uses: 2 });
    expect(bankedEntries(actor)).toHaveLength(1);
    expect(bankedSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    const { sources, consumes } = bankedSources(actor, null, { rolledSkill: 'might' });
    expect(sources[0]).toMatchObject({ label: 'Pep talk', shiftUp: 1 });
    expect(consumes[0]).toEqual({ ext: 'rulesBank', actorUuid: actor.uuid, entryId: entry.id });
    await consumeBanked(consumes[0], async () => actor);
    expect(bankedEntries(actor)[0].uses).toBe(1);
    await consumeBanked(consumes[0], async () => actor);
    expect(bankedEntries(actor)).toEqual([]);
    await consumeBanked({ actorUuid: 'gone' }, async () => null);
  });

  test('banked bonuses ride along in the rules engine\'s roll sources', async () => {
    const actor = makeActor([]);
    rebuildIndex(actor);
    await bankRollBonus(actor, { label: 'Ready', edge: true });
    const out = ruleRollSources(actor, null, { rolledSkill: 'brawn' });
    expect(out.sources[0]).toMatchObject({ label: 'Ready', edge: true });
    expect(out.consumes).toHaveLength(1);
    expect(registrySnapshot().consumers.rulesBank).toBeInstanceOf(Function);
  });

  test('turn and round windows expire', () => {
    const combat = { started: true, id: 'c', round: 2, turn: 1 };
    const turn = { until: 'endOfTurn', stamp: { combatId: 'c', round: 2, turn: 1 } };
    expect(isExpired(turn, combat)).toBe(false);
    expect(isExpired(turn, { ...combat, turn: 2 })).toBe(true);
    expect(isExpired({ until: 'endOfRound', stamp: { combatId: 'c', round: 2, turn: 0 } }, { ...combat, turn: 3 })).toBe(false);
    expect(isExpired({ until: 'endOfRound', stamp: { combatId: 'c', round: 1 } }, combat)).toBe(true);
    expect(isExpired({ until: null }, combat)).toBe(false);
    expect(isExpired({ until: 'endOfTurn', stamp: { combatId: 'c' } }, null)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Use and Trigger                              */
/* -------------------------------------------- */

describe('Use rules', () => {
  test('valid and readable', () => {
    const rule = { type: 'Use', label: 'Patch up', cost: { action: 'standard', resource: { pool: 'kits' }, amount: 1 }, limit: { per: 'scene', max: 2 }, steps: [{ do: 'heal', to: 'target', amount: 2 }] };
    expect(validateRule(rule)).toEqual([]);
    expect(summarizeRule(rule)).toBe('Use: Patch up (Standard action, 1 kits), 2/scene');
    expect(validateRule({ type: 'Use', cost: { action: 'fly', resource: {}, amount: '2 +' }, limit: { per: 'week' }, steps: [] })).toEqual([
      'cost.action must be standard, move, free or none', 'cost.resource needs pool, path, storyPoints or rolePoints', 'cost.amount: Unexpected end',
      'limit.per must be one of turn, round, scene, encounter, mission, session, rest',
    ]);
    expect(validateRule({ type: 'Use', cost: 'x', limit: null, steps: [] })).toEqual(['cost must be {action, resource, amount}', expect.stringMatching(/limit.per/)]);
  });

  test('pressing it pays, runs the steps, counts the limit and reports', async () => {
    const item = makeItem([
      { type: 'Use', label: 'Second wind', cost: { action: 'move', resource: { path: 'system.energon.value' }, amount: 1 }, limit: { per: 'rest', max: 1 }, steps: [{ do: 'heal', amount: 3 }] },
      { type: 'Use', label: 'Off', disabled: true, steps: [] },
    ], { name: 'Tough' });
    const actor = makeActor([item], { system: { health: { value: 4, max: 12 }, energon: { value: 1 } } });
    expect(useRulesOf(item)).toHaveLength(1);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    const pay = jest.fn(async () => true);
    const chat = await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('move');
    expect(actor.system.health.value).toBe(7);
    expect(actor.system.energon.value).toBe(0);
    expect(chat).toMatch(/^<strong>Tough: Second wind<\/strong><br>/);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    expect(await runUse(item, pay)).toBeNull();
    expect(registrySnapshot().uses.some(use => use.id == 'rules' && use.matches(item))).toBe(true);
  });

  test('a blocked action stops it; a condition gates it; several Uses ask which', async () => {
    const item = makeItem([
      { type: 'Use', label: 'A', cost: { action: 'standard' }, steps: [{ do: 'chat', text: 'A' }] },
      { type: 'Use', label: 'B', when: ['self:morphed'], steps: [{ do: 'chat', text: 'B' }] },
    ]);
    const actor = makeActor([item]);
    expect(await runUse(item, async () => false)).toBeNull();
    actor.system.isMorphed = true;
    const pick = jest.fn(async (it, available) => available[1]);
    expect(await runUse(item, async () => true, { pick })).toContain('B');
    expect(pick.mock.calls[0][1]).toHaveLength(2);
    expect(await runUse(item, async () => true, { pick: async () => null })).toBeNull();
    expect(await runUse(makeItem([]), async () => true)).toBeNull();
  });
});

describe('Trigger rules', () => {
  test('valid and readable', () => {
    expect(validateRule({ type: 'Trigger', event: 'turnStart', steps: [{ do: 'heal' }] })).toEqual([]);
    expect(validateRule({ type: 'Trigger', event: 'teatime', steps: [] })[0]).toMatch(/event must be one of/);
    expect(summarizeRule({ type: 'Trigger', event: 'afterRoll', outcome: 'crit', when: ['skill:might'], steps: [{ do: 'heal' }], limit: { per: 'round' } }))
      .toBe('When you roll (crit), on might tests: heal, 1/round');
    expect(summarizeRule({ type: 'Trigger', event: 'turnStart', steps: [] })).toBe('When your turn starts: ');
  });

  test('events run their own Triggers, with conditions, limits and prompts', async () => {
    const item = makeItem([
      { type: 'Trigger', event: 'turnStart', steps: [{ do: 'heal', amount: 1 }], limit: { per: 'rest', max: 1 } },
      { type: 'Trigger', event: 'turnStart', when: ['self:morphed'], steps: [{ do: 'heal', amount: 5 }] },
      { type: 'Trigger', event: 'turnEnd', prompt: true, steps: [{ do: 'heal', amount: 2 }] },
      { type: 'Trigger', event: 'afterRoll', outcome: 'crit', steps: [{ do: 'chat', text: 'Crit!' }] },
    ]);
    const actor = makeActor([item], { system: { health: { value: 1, max: 20 } } });
    rebuildIndex(actor);
    global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
    await fireTriggers(actor, 'turnStart');
    await fireTriggers(actor, 'turnStart');
    expect(actor.system.health.value).toBe(2);
    await fireTriggers(actor, 'turnEnd', { prompt: async () => false });
    expect(actor.system.health.value).toBe(2);
    await fireTriggers(actor, 'turnEnd', { prompt: async () => true });
    expect(actor.system.health.value).toBe(4);
    await fireTriggers(actor, 'afterRoll', { outcome: 'success' });
    expect(ChatMessage.create).toHaveBeenCalledTimes(2);
    await fireTriggers(actor, 'afterRoll', { outcome: 'crit' });
    expect(ChatMessage.create).toHaveBeenCalledTimes(3);
  });

  test('wouldBeDefeated can stop the blow that would Defeat', async () => {
    const item = makeItem([{ type: 'Trigger', event: 'wouldBeDefeated', limit: { per: 'rest' }, steps: [{ do: 'leaveAt', value: 1 }] }], { name: 'Do Not Go Quietly' });
    const actor = makeActor([item], { system: { health: { value: 3, max: 10 } } });
    rebuildIndex(actor);
    global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
    expect(await wouldBeDefeated(actor, 2, 'blunt')).toBe(2);
    expect(await wouldBeDefeated(actor, 5, 'stun')).toBe(5);
    expect(await wouldBeDefeated(actor, 5, 'blunt')).toBe(2);
    expect(await wouldBeDefeated(actor, 5, 'blunt')).toBe(5);
    expect(await wouldBeDefeated(makeActor([]), 50, 'blunt')).toBe(50);
  });

  test('roll outcomes', () => {
    expect(rollOutcome([{ success: true }], { isCrit: true })).toBe('crit');
    expect(rollOutcome([], { isFumble: true })).toBe('fumble');
    expect(rollOutcome([{ success: false }, { success: true }])).toBe('success');
    expect(rollOutcome([{ success: false }])).toBe('failure');
    expect(rollOutcome(null)).toBeNull();
  });

  test('the events are registered', () => {
    const registry = registrySnapshot();
    // wouldBeDefeated is called by combat.mjs inside its Defeat-save chain, not as a damage modifier.
    expect(registry.damageModifiers).not.toContain(wouldBeDefeated);
    for (const kind of ['turnStart', 'turnEnd', 'roundStart', 'rest', 'sceneAdvanced', 'missionAdvanced', 'afterDamage', 'postRoll']) {
      expect(registry[kind].length).toBeGreaterThan(0);
    }
  });
});

describe('Story Point costs', () => {
  test('checked with the actor\'s own pool first, then spent; gains go to that pool', async () => {
    const { setStoryPointHelpers } = await import('./steps.mjs');
    const calls = [];
    let canPay = false;
    setStoryPointHelpers({
      canSpendForActor: (actor, n) => {
        calls.push(['can', n]);
        return canPay;
      },
      spendForActor: async (actor, n) => calls.push(['spend', n]),
      requestStoryPointGrant: async (actor, n, { pool }) => calls.push(['grant', n, pool]),
      poolFor: () => 'story',
    });
    const actor = makeActor([]);
    const ctx = stepContext({ actor, item: makeItem([]), targets: [] });
    expect(canAfford({ storyPoints: true }, 1, ctx)).toBe(false);
    expect(await changeResource({ storyPoints: true }, -1, ctx)).toBe(false);
    canPay = true;
    expect(canAfford({ storyPoints: true }, 1, ctx)).toBe(true);
    expect(await changeResource({ storyPoints: true }, -1, ctx)).toBe(true);
    expect(await changeResource({ storyPoints: true }, 2, ctx)).toBe(true);
    expect(calls).toEqual([['can', 1], ['can', 1], ['can', 1], ['can', 1], ['spend', 1], ['grant', 2, 'story']]);
    setStoryPointHelpers(null);
    expect(await changeResource({ storyPoints: true }, -1, ctx)).toBe(true);
  });
});
