import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { applyRuleSwitches, ruleDialogSwitches, ruleRollSources } from './adapter.mjs';
import { fireItemAdded, fireTriggers, runUse, useAvailable } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { legacyChoiceUpdates } from './legacy-choices.mjs';
import { validateRule } from './types.mjs';
// Round-10 plug-ins: rule types some of these items now also carry (Advanced Dino Gem's SummonTime).
import './ext/index.mjs';

/**
 * Batch slA3 (docs/rules-batches/slA3.md): slice items of zord1 / zord2 / pr1 / pr2 / pr3 converted
 * with the 2026-10-05 engine pieces - Profiteer (rounds:N), Overload (dice in a step), Grid Relic
 * Weapon (createItem children), Unique Weapon (Ranged)'s natural 1, and Advanced Dino Gem
 * Integration's pick (a `legacy` pick). Each asserts what the removed slice code's tests asserted.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor(type = 'playerCharacter', system = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  return actor;
}

function addItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  return addItem(actor, { name: doc.name, type: doc.type, system: { ...doc.system, ...(extra.system ?? {}) }, flags: extra.flags ?? {} });
}

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: false, targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: setPath,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      randomID: () => `r${nextId++}`,
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

const combatAt = (round, turn) => ({ id: 'cb', started: true, round, turn, turns: [] });

/* -------------------------------------------- */
/*  Profiteer (pr1/jtt.mjs)                      */
/* -------------------------------------------- */

describe('Profiteer: a "questioned" switch starts ten rounds of ↓1 on Social tests', () => {
  const FILE = 'jttitems/_source/Profiteer_FDf9ZhuajJb3U5un.json';

  test('the rules are valid', () => {
    for (const rule of fromPack(FILE).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  });

  test('ticked on a Social test: ↓1 now, then ↓1 automatically on Social tests until ten rounds pass', async () => {
    const actor = makeActor();
    addPackItem(actor, FILE);
    global.game.combat = combatAt(1, 0);
    const social = { rolledSkill: 'persuasion', rolledEssence: 'social' };
    // Offered on Social tests only, and never pre-ticked.
    const switches = ruleDialogSwitches(actor, social);
    expect(switches).toHaveLength(1);
    expect(switches[0].value).toBe(false);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'culture', rolledEssence: 'smarts' })).toEqual([]);
    expect(ruleRollSources(actor, null, social).sources).toEqual([]);

    const options = { shiftUp: 0, shiftDown: 0, ext: { [switches[0].name]: true } };
    await applyRuleSwitches(actor, options, social);
    expect(options.shiftDown).toBe(1);

    // Live: the ↓1 is automatic on Social tests (the old profiteerSources), and the switch is gone.
    global.game.combat.round = 3;
    expect(ruleRollSources(actor, null, social).sources).toEqual([expect.objectContaining({ label: 'Profiteer', shiftDown: 1 })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'culture', rolledEssence: 'smarts' }).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, social)).toEqual([]);

    // Ten rounds on, it's over (the old profiteerLive: round 11 for a record from round 1).
    global.game.combat.round = 11;
    expect(ruleRollSources(actor, null, social).sources).toEqual([]);
    expect(ruleDialogSwitches(actor, social)).toHaveLength(1);
  });

  test('out of combat it lasts the scene', async () => {
    const actor = makeActor();
    addPackItem(actor, FILE);
    const social = { rolledSkill: 'persuasion', rolledEssence: 'social' };
    const [toggle] = ruleDialogSwitches(actor, social);
    await applyRuleSwitches(actor, { shiftUp: 0, shiftDown: 0, ext: { [toggle.name]: true } }, social);
    expect(ruleRollSources(actor, null, social).sources[0]).toMatchObject({ shiftDown: 1 });
    global.game.settings.get = () => 2;
    expect(ruleRollSources(actor, null, social).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Overload (pr3/ttsg.mjs)                      */
/* -------------------------------------------- */

describe('Overload: a Free action in combat, 1d2 Health, Edge on attacks this turn', () => {
  const FILE = 'ttsgitems/_source/Overload_GNT0qv91JUTXfS0n.json';
  const attack = { item: { type: 'weaponEffect', system: {} }, isAttack: true };

  test('the rules are valid', () => {
    for (const rule of fromPack(FILE).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  });

  test('pressed: pays a Free action, loses 1d2 Health, Edge on its attacks until the turn ends', async () => {
    const zord = makeActor('zord');
    const item = addPackItem(zord, FILE);
    // Only in combat.
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);
    global.game.combat = combatAt(1, 0);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
    expect(ruleRollSources(zord, null, attack).sources).toEqual([]);

    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const pay = jest.fn(async () => true);
    expect(await runUse(item, pay)).toBeTruthy();
    expect(pay).toHaveBeenCalledWith('free');
    expect(zord.system.health.value).toBe(3);

    expect(ruleRollSources(zord, null, attack).sources).toEqual([expect.objectContaining({ label: 'Overload', edge: true })]);
    expect(ruleRollSources(zord, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    // Once a turn.
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(false);

    global.game.combat.turn = 1;
    expect(ruleRollSources(zord, null, attack).sources).toEqual([]);
    expect(useAvailable(item, item.system.rules[0], 0)).toBe(true);
  });

  test('a refused action costs nothing', async () => {
    const zord = makeActor('zord');
    const item = addPackItem(zord, FILE);
    global.game.combat = combatAt(1, 0);
    expect(await runUse(item, jest.fn(async () => false))).toBeNull();
    expect(zord.system.health.value).toBe(5);
    expect(ruleRollSources(zord, null, attack).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Grid Relic Weapon (pr2/perks.mjs)            */
/* -------------------------------------------- */

describe('Grid Relic Weapon: added to a PC, it asks Might or Finesse and makes the weapon', () => {
  const FILE = 'prcrbitems/_source/Grid_Relic_Weapon_82Ld65NsKwfMZaSC.json';

  function withCreate(actor) {
    const made = [];
    actor.createEmbeddedDocuments = jest.fn(async (type, datas) => {
      const docs = datas.map(data => ({ ...data, id: `n${nextId++}`, isOwner: false }));
      made.push(...docs);
      return docs;
    });
    return made;
  }

  test('the rule is valid', () => {
    expect(validateRule(fromPack(FILE).system.rules[0])).toEqual([]);
  });

  test('the weapon rolls the Role skill die for Energy damage (the old relicData)', async () => {
    const actor = makeActor();
    const made = withCreate(actor);
    const perk = addPackItem(actor, FILE);
    const ask = jest.fn(async () => 1);
    await fireItemAdded(actor, perk, { ask });
    expect(ask).toHaveBeenCalledTimes(1);
    const [weapon, effect] = made;
    expect(weapon).toMatchObject({ name: 'Grid Relic', type: 'weapon', flags: { essence20: { pr2GridRelic: true, grantedBy: perk.id } } });
    expect(weapon.system.traits).toContain('powerWeapon');
    expect(weapon.system.equipped).toBe(true);
    expect(effect.type).toBe('weaponEffect');
    expect(effect.system.classification).toEqual({ skill: 'roleSkillDie', style: 'melee' });
    expect(effect.system).toMatchObject({ damageType: 'element', damageValue: 2, defenseType: 'toughness' });
    expect(effect.flags.essence20).toMatchObject({ parentId: weapon.id, pr2GridRelic: 'finesse', grantedBy: perk.id });
  });

  test('not for a non-PC, not when a Grid Relic is already held, nothing when the question is cancelled', async () => {
    const npc = makeActor('npc');
    const npcMade = withCreate(npc);
    await fireItemAdded(npc, addPackItem(npc, FILE), { ask: async () => 0 });
    expect(npcMade).toEqual([]);

    const holder = makeActor();
    const made = withCreate(holder);
    addItem(holder, { name: 'Grid Relic', type: 'weapon' });
    await fireItemAdded(holder, addPackItem(holder, FILE), { ask: async () => 0 });
    expect(made).toEqual([]);

    const cancel = makeActor();
    const cancelled = withCreate(cancel);
    await fireItemAdded(cancel, addPackItem(cancel, FILE), { ask: async () => null });
    expect(cancelled).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Unique Weapon (Ranged) (pr3/pr-crb.mjs)      */
/* -------------------------------------------- */

describe('Unique Weapon (Ranged): a natural 1 to hit costs 1d4 Personal Power', () => {
  const FILE = 'prcrbitems/_source/Unique_Weapon_Ranged__Pr3UniqWpnRanged.json';

  function wielder(power) {
    const actor = makeActor('playerCharacter', { powers: { personal: { value: power, max: 6 } } });
    const weapon = addPackItem(actor, FILE, { system: { equipped: true } });
    const effect = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } } });
    return { actor, weapon, effect };
  }

  test('the rule is valid', () => {
    expect(validateRule(fromPack(FILE).system.rules[0])).toEqual([]);
  });

  test('the old test: 3 Power, a 2 on the d4, 1 left', async () => {
    const { actor, effect } = wielder(3);
    jest.spyOn(Math, 'random').mockReturnValue(0.3);
    await fireTriggers(actor, 'afterRoll', { roll: { item: effect, isAttack: true }, outcome: 'fumble', facts: { isFumble: true } });
    expect(actor.system.powers.personal.value).toBe(1);
  });

  test('never below 0, only on a Fumble, only with this weapon', async () => {
    const { actor, effect } = wielder(2);
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await fireTriggers(actor, 'afterRoll', { roll: { item: effect, isAttack: true }, outcome: 'failure', facts: { isFumble: false } });
    expect(actor.system.powers.personal.value).toBe(2);
    const other = addItem(actor, { name: 'Other Shot', type: 'weaponEffect', flags: { essence20: { parentId: 'elsewhere' } } });
    await fireTriggers(actor, 'afterRoll', { roll: { item: other, isAttack: true }, outcome: 'fumble', facts: { isFumble: true } });
    expect(actor.system.powers.personal.value).toBe(2);
    await fireTriggers(actor, 'afterRoll', { roll: { item: effect, isAttack: true }, outcome: 'fumble', facts: { isFumble: true } });
    expect(actor.system.powers.personal.value).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Advanced Dino Gem Integration (pr1/misc.mjs) */
/* -------------------------------------------- */

describe('Advanced Dino Gem Integration: the pick is a rule; old picks keep working', () => {
  const FILE = 'bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json';
  const alertness = { rolledSkill: 'alertness', rolledEssence: 'smarts' };

  test('the rules are valid', () => {
    for (const rule of fromPack(FILE).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  });

  test('the Use button is there only until a power is picked (either way)', () => {
    const zord = makeActor('zord');
    const fresh = addPackItem(zord, FILE);
    const old = addPackItem(zord, FILE, { flags: { essence20: { pr1DinoGem: 'sense' } } });
    const picked = addPackItem(zord, FILE, { flags: { essence20: { rules: { choices: { gem: 'shield' } } } } });
    const use = item => useAvailable(item, item.system.rules[5], 5);
    expect([use(fresh), use(old), use(picked)]).toEqual([true, false, false]);
  });

  test('picking stores the power; the Sense ↑2 reads the new pick and the old flag alike', async () => {
    const zord = makeActor('zord');
    const item = addPackItem(zord, FILE);
    expect(ruleRollSources(zord, null, alertness).sources).toEqual([]);
    const ctx = stepContext({ actor: zord, item, targets: [] });
    ctx.askPick = jest.fn(async (step, options) => {
      expect(options.map(o => o.value)).toEqual(['shield', 'sense', 'primordial', 'stealth', 'resonance']);
      return 'sense';
    });
    expect(await runSteps(item.system.rules[5].steps, ctx)).toBe(true);
    expect(item.flags.essence20.rules.choices.gem).toBe('sense');
    expect(ruleRollSources(zord, null, alertness).sources[0]).toMatchObject({ shiftUp: 2 });

    const legacy = makeActor('zord');
    addPackItem(legacy, FILE, { flags: { essence20: { pr1DinoGem: 'sense' } } });
    expect(ruleRollSources(legacy, null, alertness).sources[0]).toMatchObject({ shiftUp: 2 });
  });

  test('asked when it lands on a Zord, never again once picked; the linking pass moves the old flag', async () => {
    const zord = makeActor('zord');
    const old = addPackItem(zord, FILE, { flags: { essence20: { pr1DinoGem: 'stealth' } } });
    const ctx = stepContext({ actor: zord, item: old, targets: [] });
    ctx.askPick = jest.fn();
    await runSteps(old.system.rules[6].steps, ctx);
    expect(ctx.askPick).not.toHaveBeenCalled();
    expect(ctx.vars.picked).toBe('stealth');
    expect(legacyChoiceUpdates(zord)).toEqual([{ _id: old.id, 'flags.essence20.rules.choices.gem': 'stealth' }]);

    // The added Trigger only runs on a Zord.
    const pc = makeActor();
    const onPc = addPackItem(pc, FILE);
    const spy = jest.spyOn(onPc, 'update');
    await fireItemAdded(pc, onPc);
    expect(spy).not.toHaveBeenCalled();
  });
});
