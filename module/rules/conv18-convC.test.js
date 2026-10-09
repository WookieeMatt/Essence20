import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 18, convC (docs/rules-batches/slConvC18.md): the last partial conversions - Perfect Disguise's sneak attacks,
 * Nu, Pogodi!'s Condition removal and seat swap, and Ninja Power's activation / jump / switch off - plus the book check
 * of Power Heal, Bullpup and the Hyperkinetic Support Harness. Each item is loaded from its pack source; these check the
 * rules validate and do what the removed code did (or what the book says, where the two differed).
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const grants = {
  chooseSelect: jest.fn(async () => null), chooseButtons: jest.fn(async () => null), rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []), pickOne: jest.fn(async () => null), grantCopy: jest.fn(async () => null), essenceRedirect: jest.fn(),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  canSpendForActor: () => true, spendForActor: jest.fn(), canWriteStoryPoints: () => true, requestStoryPointGrant: jest.fn(),
  requestStoryPointSpend: jest.fn(), poolFor: () => 'story', hasStoryPointsAvailable: () => true,
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { rollRules } = await import('./adapter.mjs');
const { checkSneakAttackEligibility, markSneakAttackUsed } = await import('../mechanics/combat/sneak-attack.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  perfectDisguise: 'gijcrbitems/_source/Perfect_Disguise_ELktMVNYsiBPTX2c.json',
  nuPogodi: 'iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json',
  ninjaPower: 'prcrbitems/_source/Ninja_Power_wN5rjEQIJH68rWCd.json',
  powerHeal: 'prcrbitems/_source/Power_Heal_eiTUR08GXw03M21m.json',
  bullpup: 'iafav2items/_source/Bullpup_IU2HkMiwC8hYKQdj.json',
  harness: 'fffav1items/_source/Hyperkinetic_Support_Harness_O4IT5jCPRBqGkXGr.json',
};

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
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, effects: [], ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(name, files = [], { system = {}, flags = {}, type = 'playerCharacter' } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, flags: { essence20: { ...flags } }, statuses: new Set(),
    system: { level: 12, health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 6 } }, skills: {}, isMorphed: false, ...system },
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
    async toggleStatusEffect(status, { active } = {}) {
      if (active === false) {
        this.statuses.delete(status);
      } else {
        this.statuses.add(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.test.Item.${doc._id}` } } }));
  }

  items.get = id => items.find(item => item.id == id);
  actor.items = items;
  const token = { actor, document: { disposition: 1 }, center: { x: 0, y: 0 }, id: `t${actor.id}` };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const itemNamed = (actor, name) => actor.items.find(item => item.name == name);
const ruleIndex = (item, label) => item.system.rules.findIndex(rule => String(rule.label ?? '').startsWith(label));
const available = (item, label) => useAvailable(item, item.system.rules[ruleIndex(item, label)], ruleIndex(item, label));
const useLabelled = label => (item, list) => list.find(({ rule }) => String(rule.label).startsWith(label)) ?? null;
const attackOf = () => ({ id: `e${nextId++}`, type: 'weaponEffect', flags: { essence20: { parentId: 'none' } }, system: { classification: { style: 'melee' } } });
const answerOf = (actor, other, label) => rollRules(actor, other, { item: attackOf(), isAttack: true }, ['RollModifier']).find(entry => String(entry.rule.label).startsWith(label))?.answer;
const combat = (round = 1) => ({ id: 'c1', started: true, round, turn: 0, turns: [], combatants: { contents: [] } });
const pay = jest.fn(async () => true);

const savedGame = global.game;

beforeEach(() => {
  pay.mockClear();
  Object.values(grants).forEach(fn => fn.mockClear());
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [], activeGM: null },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.game.user.targets.first = () => undefined;
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), statusEffects: [{ id: 'frightened', name: 'Frightened' }, { id: 'impaired', name: 'Impaired' }, { id: 'defeated', name: 'Defeated' }] } };
  global.foundry = {
    ...global.foundry,
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: clone },
  };
});

afterEach(() => {
  global.game = savedGame;
});

test('every convC rule validates', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

describe('Perfect Disguise', () => {
  test('once per mission (book; was once per encounter), free to drop', async () => {
    const spy = makeActor('Spy', FILES.perfectDisguise);
    const perk = itemNamed(spy, 'Perfect Disguise');
    expect(perk.system.rules[ruleIndex(perk, 'Take on a disguise')].limit).toEqual({ per: 'mission' });
    await runUse(perk, pay);
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(true);
    await runUse(perk, pay);
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(false);
    expect(available(perk, 'Take on a disguise')).toBe(false);
  });

  test('its attacks are sneak attacks while disguised (was sneak-attack.mjs reading the flag): reason, once a round, not vs immune', async () => {
    const spy = makeActor('Spy', FILES.perfectDisguise, { flags: { perfectDisguiseActive: true } });
    // No Silent weapon, no target, no Edge: the disguise alone makes it one.
    expect(checkSneakAttackEligibility(spy, attackOf(), false)).toEqual({ eligible: true, reason: 'E20.SneakAttackReasonDisguise' });

    spy.flags.essence20.perfectDisguiseActive = false;
    expect(checkSneakAttackEligibility(spy, attackOf(), false)).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNotSilent' });

    // A target that never takes sneak attack damage: the ordinary checks decide.
    spy.flags.essence20.perfectDisguiseActive = true;
    const immune = makeActor('Wary');
    immune.items.push(makeItem(immune, { name: 'Every Trick', type: 'perk', system: { rules: [{ type: 'SneakAttackImmunity' }] } }));
    rebuildIndex(immune);
    global.game.user.targets.first = () => immune.token;
    expect(checkSneakAttackEligibility(spy, attackOf(), false).eligible).toBe(false);

    // Already used this round.
    global.game.user.targets.first = () => undefined;
    global.game.combat = combat();
    await markSneakAttackUsed(spy);
    expect(checkSneakAttackEligibility(spy, attackOf(), false)).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNotSilent' });
  });

  test('after an attack the player is asked whether they were seen attacking; only a yes ends it (book)', async () => {
    const spy = makeActor('Spy', FILES.perfectDisguise, { flags: { perfectDisguiseActive: true } });
    const roll = { roll: { item: attackOf(), isAttack: true, targetCount: 1 }, outcome: 'success', facts: { results: [{ success: true }] } };
    await fireTriggers(spy, 'afterRoll', { ...roll, prompt: async () => false });
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(true);
    await fireTriggers(spy, 'afterRoll', { ...roll, prompt: async () => true });
    expect(spy.flags.essence20.perfectDisguiseActive).toBe(false);
  });
});

describe('Nu, Pogodi!', () => {
  test('removes one of your Conditions (never Defeated) as a Free action, once per mission (was nu-pogodi.mjs)', async () => {
    const guard = makeActor('Guard', FILES.nuPogodi);
    guard.statuses = new Set(['frightened', 'defeated']);
    const perk = itemNamed(guard, 'Nu, Pogodi!');
    expect(perk.system.rules[ruleIndex(perk, 'Remove a Condition')].limit).toEqual({ per: 'mission' });
    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options.map(option => option.value)).toEqual(['frightened']);
      return 'frightened';
    });
    await runUse(perk, pay, { pick: useLabelled('Remove a Condition') });
    expect([...guard.statuses]).toEqual(['defeated']);
    expect(pay).toHaveBeenCalledWith('free');
    expect(available(perk, 'Remove a Condition')).toBe(false);
  });

  test('a cancelled pick costs nothing and leaves the use', async () => {
    const guard = makeActor('Guard', FILES.nuPogodi);
    guard.statuses = new Set(['frightened']);
    const perk = itemNamed(guard, 'Nu, Pogodi!');
    await runUse(perk, pay, { pick: useLabelled('Remove a Condition') });
    expect(pay).not.toHaveBeenCalled();
    expect(guard.statuses.has('frightened')).toBe(true);
    expect(available(perk, 'Remove a Condition')).toBe(true);
  });

  test('swaps seats with another rider on a DIF 10 Driving test, as a Free action (was nu-pogodi-seat-swap.mjs)', async () => {
    const guard = makeActor('Guard', FILES.nuPogodi);
    const ivan = makeActor('Ivan');
    const perk = itemNamed(guard, 'Nu, Pogodi!');
    expect(available(perk, 'Swap seats')).toBe(false);

    const truck = makeActor('Truck', [], { type: 'vehicle' });
    truck.system.actors = {
      k1: { uuid: guard.uuid, name: 'Guard', vehicleRole: 'passenger' },
      k2: { uuid: ivan.uuid, name: 'Ivan', vehicleRole: 'driver' },
      k3: { uuid: 'Actor.gunner', name: 'Gunner', vehicleRole: 'gunner' },
    };
    global.game.actors = { contents: [guard, ivan, truck] };
    expect(available(perk, 'Swap seats')).toBe(true);

    grants.chooseSelect.mockImplementationOnce(async (title, prompt, options) => {
      expect(options).toEqual([{ value: 'k2', label: 'Ivan (driver)' }]);
      return 'k2';
    });
    grants.rollTest.mockResolvedValueOnce({ success: false });
    const failed = await runUse(perk, pay, { pick: useLabelled('Swap seats') });
    expect(grants.rollTest).toHaveBeenCalledWith(guard, 'driving', 10, expect.any(Object));
    expect(failed).toContain('E20.Q1SwapFailed');
    expect(truck.system.actors.k1.vehicleRole).toBe('passenger');

    grants.chooseSelect.mockResolvedValueOnce('k2');
    grants.rollTest.mockResolvedValueOnce({ success: true });
    await runUse(perk, pay, { pick: useLabelled('Swap seats') });
    expect([truck.system.actors.k1.vehicleRole, truck.system.actors.k2.vehicleRole]).toEqual(['driver', 'passenger']);
    expect(pay).toHaveBeenCalledWith('free');
  });
});

describe('Ninja Power', () => {
  test('activated with 1 Power as you Morph (book; was a toggle at any time), ended by un-Morphing', async () => {
    const ranger = makeActor('Ranger', FILES.ninjaPower, { system: { isMorphed: true } });
    await fireTriggers(ranger, 'morph', { prompt: async () => false });
    expect(ranger.flags.essence20.ninjaPowerActive).toBeUndefined();
    await fireTriggers(ranger, 'morph', { prompt: async () => true });
    expect(ranger.flags.essence20.ninjaPowerActive).toBe(true);
    expect(ranger.system.powers.personal.value).toBe(2);

    ranger.system.isMorphed = false;
    await fireTriggers(ranger, 'unmorph');
    expect(ranger.flags.essence20.ninjaPowerActive).toBe(false);

    // No Power left: not offered.
    ranger.system.powers.personal.value = 0;
    const prompt = jest.fn(async () => true);
    await fireTriggers(ranger, 'morph', { prompt });
    expect(prompt).not.toHaveBeenCalled();
  });

  test('the jump (Free, while Morphed with it on) gives attacks against you ↓1 for the rest of the round (was ninja-power-jump.mjs)', async () => {
    const ranger = makeActor('Ranger', FILES.ninjaPower, { system: { isMorphed: true }, flags: { ninjaPowerActive: true } });
    const foe = makeActor('Foe');
    const perk = itemNamed(ranger, 'Ninja Power');
    global.game.combat = combat(2);
    await runUse(perk, pay, { pick: useLabelled('Ninja jump') });
    expect(pay).toHaveBeenCalledWith('free');
    expect(answerOf(foe, ranger, 'Ninja Power jump')).toBe(true);
    global.game.combat.round = 3;
    expect(answerOf(foe, ranger, 'Ninja Power jump')).toBe(false);

    // Out of combat the jump changes nothing (the old flag only counted in a combat round).
    global.game.combat = null;
    await runUse(perk, pay, { pick: useLabelled('Ninja jump') });
    global.game.combat = combat(3);
    expect(answerOf(foe, ranger, 'Ninja Power jump')).toBe(false);
  });

  test('switched off for free; only the switch off is offered when not Morphed', async () => {
    const ranger = makeActor('Ranger', FILES.ninjaPower, { flags: { ninjaPowerActive: true } });
    const perk = itemNamed(ranger, 'Ninja Power');
    expect(available(perk, 'Ninja jump')).toBe(false);
    expect(available(perk, 'Switch Ninja Power off')).toBe(true);
    await runUse(perk, pay);
    expect(ranger.flags.essence20.ninjaPowerActive).toBe(false);
    expect(available(perk, 'Switch Ninja Power off')).toBe(false);
  });
});

describe('book checks (already rules)', () => {
  test('Power Heal: while Morphed, 1 Power removes one negative Condition from a creature within 5 ft', () => {
    const use = fromPack(FILES.powerHeal).system.rules.find(rule => rule.type == 'Use');
    expect(use.when).toEqual(expect.arrayContaining(['self:morphed']));
    const remove = use.steps[0].options[1].steps;
    expect(remove.map(step => step.do)).toEqual(['pickAlly', 'pick', 'spend', 'removeCondition', 'chat']);
    expect(remove[0].within).toBe(5);
    expect(remove[2].amount).toBe(1);
  });

  test('Bullpup: one size smaller, a Free reload once a scene', () => {
    const [size, reload] = fromPack(FILES.bullpup).system.rules;
    expect([size.op, size.value]).toEqual(['step', -1]);
    expect([reload.action, reload.to, reload.limit]).toEqual(['reload', 'free', { per: 'scene' }]);
  });

  test('Hyperkinetic Support Harness: two-handed weapons in one hand', () => {
    const [rule] = fromPack(FILES.harness).system.rules;
    expect([rule.path, rule.value]).toEqual(['system.derivedHands', 1]);
  });
});
