import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDerived } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable, useRulesOf } from './triggers.mjs';
import { runSteps, stepContext } from './steps.mjs';
import { initialState } from './lifecycle.mjs';
import { legacyChoiceUpdates } from './legacy-choices.mjs';
import { runPostRoll } from '../mechanics/item-hooks.mjs';

/**
 * Round 4 of the slC slices (gij1, gij2, gij3, fix3-gij, situational1, situational2): Expert Knowledge,
 * Energy Resistant, Ghost and Arashikage Shozoku, moved from hand-written code to item rules. Each item
 * is loaded from its pack source and must do what the removed code did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

function updater(doc) {
  return async data => {
    for (const [key, value] of Object.entries(data)) {
      const match = (__isForcedDeletion(value) ? /^(.*)\.([^.]+)$/.exec(key) : /^(.*)\.-=([^.]+)$/.exec(key));
      if (match) {
        const parent = match[1].split('.').reduce((at, part) => at?.[part], doc);
        delete parent?.[match[2]];
      } else {
        setPath(doc, key, value);
      }
    }
  };
}

/** An item from a pack source (or plain data), ready to sit on an actor. */
function packItem(file, extra = {}) {
  const doc = file ? fromPack(file) : {};
  const item = {
    id: extra.id ?? `i${nextId++}`, name: extra.name ?? doc.name, type: extra.type ?? doc.type,
    flags: { essence20: { ...(extra.flags ?? {}) } },
    system: { ...(doc.system ?? {}), ...(extra.system ?? {}) },
  };
  item.uuid = `Item.${item.id}`;
  item.update = updater(item);
  return item;
}

function makeActor(items, { system = {}, flags = {} } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', isOwner: true, statuses: new Set(),
    flags: { essence20: { ...flags } },
    system: { level: 3, health: { value: 5, max: 10 }, ...system },
    async toggleStatusEffect(status, { active } = {}) {
      if (active) {
        this.statuses.add(status);
      } else {
        this.statuses.delete(status);
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = updater(actor);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  items.forEach(item => (item.parent = actor));
  rebuildIndex(actor);
  return actor;
}

const pay = () => jest.fn(async () => true);
const posted = () => global.ChatMessage.create.mock.calls.map(([data]) => data.content).join('\n');

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: [], actors: { contents: [] },
    i18n: { localize: k => k, format: k => k }, settings: { get: () => 1 },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o), randomID: () => `r${nextId++}` },
  };
});

/* -------------------------------------------- */
/*  Expert Knowledge (gij2)                      */
/* -------------------------------------------- */

describe('Expert Knowledge', () => {
  const FILE = 'gijcrbitems/_source/Expert_Knowledge_9H78lRwXzJW6tj9e.json';

  function scholar(skill = 'science') {
    const perk = packItem(FILE, { flags: skill ? { rules: { choices: { skill } } } : {} });
    return { actor: makeActor([perk]), perk };
  }

  /** The roll's results reaching the post-roll hooks, as target-riders.mjs hands them over. */
  async function rolled(actor, skill, results, { isCrit = false, isFumble = false } = {}) {
    global.ChatMessage.create.mockClear();
    await runPostRoll(actor, results, { riderContext: { skill } }, { isCrit, isFumble, hits: [], rider: { skill } });
    return posted();
  }

  test('a success in the area of study notes one extra benefit; another Skill or a failure, nothing', async () => {
    const { actor } = scholar();
    expect(await rolled(actor, 'science', [{ success: true, multiplier: 1 }])).toContain('1 additional benefit,');
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(await rolled(actor, 'technology', [{ success: true, multiplier: 1 }])).toBe('');
    expect(await rolled(actor, 'science', [{ success: false, multiplier: 0 }])).toBe('');
  });

  test('a Critical Success or double the DIF notes two', async () => {
    const { actor } = scholar();
    expect(await rolled(actor, 'science', [{ success: true, multiplier: 1 }], { isCrit: true })).toContain('2 additional benefits');
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(await rolled(actor, 'science', [{ success: true, multiplier: 2 }])).toContain('2 additional benefits');
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(await rolled(actor, 'science', [{ success: false, multiplier: 0 }, { success: true, multiplier: 3 }])).toContain('2 additional benefits');
    expect(await rolled(actor, 'science', [{ success: true, multiplier: 2 }], { isFumble: true })).toContain('2 additional benefits');
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test('no area chosen yet: nothing', async () => {
    const { actor } = scholar(null);
    expect(await rolled(actor, 'science', [{ success: true, multiplier: 1 }])).toBe('');
  });

  test('the area is asked when the Perk is added, the Use asks again, and an old pick is kept', async () => {
    const { actor, perk } = scholar(null);
    const choice = perk.system.rules.find(rule => rule.type == 'ChoiceSet');
    expect(choice.options.map(option => option.value)).toEqual(['alertness', 'culture', 'science', 'survival', 'technology']);
    expect(await initialState(perk, actor, { ask: async () => 'culture' })).toEqual({ 'flags.essence20.rules.choices.skill': 'culture' });

    const use = perk.system.rules.find(rule => rule.type == 'Use');
    const ctx = stepContext({ actor, item: perk, rule: use, targets: [] });
    ctx.askPick = async (step, options) => {
      expect(options.map(option => option.value)).toEqual(['alertness', 'culture', 'science', 'survival', 'technology']);
      return 'survival';
    };

    expect(await runSteps(use.steps, ctx)).toBe(true);
    expect(perk.flags.essence20.rules.choices.skill).toBe('survival');

    const old = scholar(null);
    old.perk.flags.essence20.gij2ExpertSkill = 'technology';
    expect(legacyChoiceUpdates(old.actor)).toEqual([{ _id: old.perk.id, 'flags.essence20.rules.choices.skill': 'technology' }]);
  });
});

/* -------------------------------------------- */
/*  Energy Resistant (gij2)                      */
/* -------------------------------------------- */

describe('Energy Resistant', () => {
  const FILE = 'gijcrbitems/_source/Energy_Resistant_lKnjgN4TdHHNktpF.json';

  function wearer({ element = 'fire', equipped = true, loose = false } = {}) {
    const armor = packItem(null, { name: 'Battledress', type: 'armor', system: { equipped } });
    const upgrade = packItem(FILE, { flags: { ...(loose ? {} : { parentId: armor.id }), ...(element ? { rules: { choices: { element } } } : {}) } });
    const actor = makeActor([armor, upgrade], { system: { resistances: { acid: false, cold: false, fire: false, emp: false } } });
    return { actor, armor, upgrade };
  }

  test('Resistant to the chosen Element while the armor is worn', () => {
    const { actor } = wearer();
    ruleDerived(actor);
    expect(actor.system.resistances.fire).toBeTruthy();
    expect(actor.system.resistances.acid).toBeFalsy();
    expect(actor.system.resistances.cold).toBeFalsy();

    const off = wearer({ equipped: false });
    ruleDerived(off.actor);
    expect(off.actor.system.resistances.fire).toBeFalsy();
  });

  test('a loose upgrade counts too; with no Element chosen, nothing', () => {
    const loose = wearer({ element: 'emp', loose: true });
    ruleDerived(loose.actor);
    expect(loose.actor.system.resistances.emp).toBeTruthy();

    const none = wearer({ element: null });
    ruleDerived(none.actor);
    expect(Object.values(none.actor.system.resistances).some(Boolean)).toBe(false);
  });

  test('the Element is asked when added, the Use asks again, and an old pick is kept', async () => {
    const { actor, upgrade } = wearer({ element: null });
    const choice = upgrade.system.rules.find(rule => rule.type == 'ChoiceSet');
    expect(choice.options.map(option => option.value)).toEqual(['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);
    expect(await initialState(upgrade, actor, { ask: async () => 'laser' })).toEqual({ 'flags.essence20.rules.choices.element': 'laser' });

    const use = upgrade.system.rules.find(rule => rule.type == 'Use');
    const ctx = stepContext({ actor, item: upgrade, rule: use, targets: [] });
    ctx.askPick = async () => 'cold';
    expect(await runSteps(use.steps, ctx)).toBe(true);
    ruleDerived(actor);
    expect(actor.system.resistances.cold).toBeTruthy();

    const old = wearer({ element: null });
    old.upgrade.flags.essence20.gij2Element = 'sonic';
    expect(legacyChoiceUpdates(old.actor)).toEqual([{ _id: old.upgrade.id, 'flags.essence20.rules.choices.element': 'sonic' }]);
  });
});

/* -------------------------------------------- */
/*  Ghost and Arashikage Shozoku (situational1)  */
/* -------------------------------------------- */

describe('Ghost and Arashikage Shozoku', () => {
  const GHOST = 'gijcrbitems/_source/Ghost_MKK6kj54yVmCliPd.json';
  const SHOZOKU = 'iafav2items/_source/Arashikage_Shozoku_TBpflYvZ0lWQ65Cp.json';

  function commando({ ghost = true, shozoku = true, equipped = true, loose = false, flags = {} } = {}) {
    const items = [];
    const perk = ghost ? packItem(GHOST) : null;
    const armor = packItem(null, { name: 'Battledress', type: 'armor', system: { equipped } });
    const upgrade = shozoku ? packItem(SHOZOKU, { flags: loose ? {} : { parentId: armor.id } }) : null;
    items.push(...[perk, armor, upgrade].filter(Boolean));
    const actor = makeActor(items, { flags });
    let success = true;
    actor._dice = { rollSkill: jest.fn(async () => ({ success, outcomes: [{ results: [{ multiplier: success ? 1 : 0 }] }] })) };
    return { actor, perk, upgrade, fail: () => (success = false) };
  }

  test('Ghost: the Use starts hiding (Invisible) and stops it', async () => {
    const { actor, perk } = commando({ shozoku: false });
    expect(await runUse(perk, pay())).toContain('is hiding');
    expect(actor.statuses.has('invisible')).toBe(true);
    expect(await runUse(perk, pay())).toContain('no longer hiding');
    expect(actor.statuses.has('invisible')).toBe(false);
  });

  test('Ghost: an actor hiding under the old flag keeps hiding', () => {
    const { actor, perk } = commando({ shozoku: false, flags: { s1GhostHiding: true } });
    expect(legacyChoiceUpdates(actor)).toEqual([{ _id: perk.id, 'flags.essence20.rules.toggles.hiding': true }]);
  });

  test('Shozoku: a Free action and DIF 20 Infiltration; on a success Invisible until the start of the next turn', async () => {
    const { actor, upgrade } = commando({ ghost: false });
    const paid = pay();
    expect(await runUse(upgrade, paid)).toContain('vanishes');
    expect(paid).toHaveBeenCalledWith('free');
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'infiltration', dif: '20' }), actor);
    expect(actor.statuses.has('invisible')).toBe(true);
    await fireTriggers(actor, 'turnStart');
    expect(actor.statuses.has('invisible')).toBe(false);
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(0);
  });

  test('Shozoku: taking damage ends it; a failure sets nothing', async () => {
    const { actor, upgrade, fail } = commando({ ghost: false });
    await runUse(upgrade, pay());
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 2, damageType: 'blunt' } });
    expect(actor.statuses.has('invisible')).toBe(false);

    fail();
    expect(await runUse(upgrade, pay())).toContain('fails to vanish');
    expect(actor.statuses.has('invisible')).toBe(false);
    actor.statuses.add('invisible');
    await fireTriggers(actor, 'turnStart');
    expect(actor.statuses.has('invisible')).toBe(true);
  });

  test('Shozoku ending leaves a hiding Ghost Invisible', async () => {
    const { actor, perk, upgrade } = commando();
    await runUse(perk, pay());
    await runUse(upgrade, pay());
    await fireTriggers(actor, 'takesDamage', { damage: { amount: 1, damageType: 'blunt' } });
    expect(actor.statuses.has('invisible')).toBe(true);
    await runUse(perk, pay());
    expect(actor.statuses.has('invisible')).toBe(false);
  });

  test('Shozoku: only on worn armor', () => {
    const loose = commando({ ghost: false, loose: true });
    const rule = loose.upgrade.system.rules.find(r => r.type == 'Use');
    expect(useAvailable(loose.upgrade, rule, loose.upgrade.system.rules.indexOf(rule))).toBe(false);
    expect(useRulesOf(commando({ ghost: false, equipped: false }).upgrade)).toEqual([]);
    const worn = commando({ ghost: false });
    expect(useAvailable(worn.upgrade, rule, worn.upgrade.system.rules.indexOf(rule))).toBe(true);
  });
});
