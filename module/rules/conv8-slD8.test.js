import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slD8: round-8 re-check of the react / resource / other1 / other3 slices. Fuel Efficient (atLeast() on a
 * resourceSpent Trigger, Rest writes skipped), Same Principle (a pick with its old flag carried over, and a
 * WeaponTrait rule seeing the picked weapon's id), EM Protective Lining (an incoming ↓6 and a per-attack Defense
 * summing equipped armor Evasion) and Zap Apple Jam's shelf life (a missionStart Trigger) moved off the slices;
 * Inner Conservation now runs first and hands the halved spend on to Dino Charged. Each item is loaded from its
 * pack source and must do what the removed code did.
 */

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { rollRules, ruleDefenseAdjust, ruleWeaponTraits, isRollTimeDefense } = await import('./adapter.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  fuelEfficient: 'tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json',
  samePrinciple: 'tfcrbitems/_source/Same_Principle_GTUn1LOxb3D4FgHF.json',
  emLining: 'eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json',
  zapAppleJam: 'iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json',
  innerConservation: 'ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json',
  dinoCharged: 'bthitems/_source/Dino_Charged_n9ME10p6mfOJnUdE.json',
};

/** foundry.utils.setProperty, for plain objects. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((node, key) => (node[key] ??= {}), object)[last] = value;
}

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);
const clone = value => JSON.parse(JSON.stringify(value));

let nextId = 1;

function makeItem(actor, data) {
  return {
    id: `i${nextId++}`, flags: {}, system: {}, parent: actor, isOwner: true, ...data,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
  };
}

/** An actor holding the pack items `files` (in that order) and any extra item data. */
function makeActor(name, files = [], { system = {}, extra = [] } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: {
      level: 12, health: { value: 10, max: 10 }, powers: { personal: { value: 3, max: 6 } }, skills: {},
      energon: { normal: { value: 1, max: 4 } }, traits: {},
      essences: { strength: { value: 4, max: 4 }, speed: { value: 4, max: 4 }, smarts: { value: 4, max: 4 }, social: { value: 4, max: 4 } },
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
      return getPath(this.flags[scope], key);
    },
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      for (const id of ids) {
        const at = items.findIndex(item => item.id == id);
        if (at >= 0) {
          items.splice(at, 1);
        }
      }

      rebuildIndex(this);
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  for (const file of [files].flat()) {
    const doc = fromPack(file);
    items.push(makeItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system) }));
  }

  for (const data of extra) {
    items.push(makeItem(actor, data));
  }

  actor.items = {
    contents: items, get: id => items.find(item => item.id == id), find: fn => items.find(fn), filter: fn => items.filter(fn), some: fn => items.some(fn),
    [Symbol.iterator]: () => items[Symbol.iterator](),
  };
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

const allChat = () => global.ChatMessage.create.mock.calls.map(call => call[0]?.content ?? '').join(' ');
const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

/** Math.random answers giving these d4 faces, in order. */
function d4s(...faces) {
  const values = faces.map(face => (face - 0.5) / 4);
  return jest.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0);
}

const savedGame = global.game;
const savedConfig = global.CONFIG;

beforeEach(() => {
  global.game = {
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] },
    actors: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key, has: () => false },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...global.foundry,
    utils: {
      ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath,
      hasProperty: (o, k) => getPath(o, k) !== undefined, escapeHTML: text => String(text), deepClone: clone,
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  global.game = savedGame;
  global.CONFIG = savedConfig;
});

test('every slD8 rule validates', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

describe('Fuel Efficient: a d4 per Energon Point spent, each 4 comes back', () => {
  const spend = (actor, spent, resource = 'energon') => fireTriggers(actor, 'resourceSpent', { vars: { spent, resource } });

  test('the 4s are counted and given back, past the maximum if need be, with a line', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient);
    d4s(4, 1, 4);
    await spend(bot, 3);
    expect(bot.system.energon.normal.value).toBe(3);
    expect(allChat()).toContain('regains 2 Energon');
    // slD9: the d4s are quiet now (the old hook rolled them silently).
    expect(allChat()).not.toContain('DiceRolled');

    // The old refund wasn't capped at the maximum (a spend from above it gives back above it).
    bot.system.energon.normal.value = 4;
    d4s(4);
    await spend(bot, 1);
    expect(bot.system.energon.normal.value).toBe(5);
  });

  test('no 4: nothing comes back', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient);
    d4s(1, 2, 3);
    await spend(bot, 3);
    expect(bot.system.energon.normal.value).toBe(1);
    expect(allChat()).not.toContain('regains');
  });

  test('only Energon spends count', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient);
    const random = d4s(4, 4);
    await spend(bot, 2, 'power');
    await spend(bot, 2, 'darkEnergon');
    expect(random).not.toHaveBeenCalled();
    expect(bot.system.energon.normal.value).toBe(1);
  });

  test('a real Energon write rolls; a Rest, a refund or a loss does not', async () => {
    const bot = makeActor('Bot', FILES.fuelEfficient, { system: { energon: { normal: { value: 3, max: 4 } } } });
    const write = async (value, options = {}) => {
      const changes = { system: { energon: { normal: { value } } } };
      hooks.preUpdateActor.forEach(fn => fn(bot, changes, options, 'u'));
      bot.system.energon.normal.value = value;
      hooks.updateActor.forEach(fn => fn(bot, changes, options, 'u'));
      await flush();
    };

    const random = d4s(4, 4, 4, 4, 4, 4);
    await write(2, { essence20Rest: true });
    await write(1, { essence20Refund: true });
    await write(0, { essence20Loss: true });
    expect(random).not.toHaveBeenCalled();
    expect(bot.system.energon.normal.value).toBe(0);
    bot.system.energon.normal.value = 2;
    await write(1);
    expect(random).toHaveBeenCalledTimes(1);
    expect(bot.system.energon.normal.value).toBe(2);
  });
});

describe('Same Principle: the picked weapon counts as Ballistic', () => {
  function setup(flags = {}) {
    const bot = makeActor('Gunner', FILES.samePrinciple, { extra: [
      { id: 'rifle', name: 'Rifle', type: 'weapon', system: { traits: ['ballistic'] } },
      { id: 'blaster', name: 'Blaster', type: 'weapon', system: { traits: ['energy'] } },
      { id: 'sword', name: 'Sword', type: 'weapon', system: { traits: [] } },
    ] });
    const perk = bot.items.contents[0];
    Object.assign(perk.flags, flags);
    return { bot, perk };
  }

  test('the Use offers weapons that aren\'t Ballistic and remembers the pick', async () => {
    const { bot, perk } = setup();
    const ctx = stepContext({ actor: bot, item: perk, targets: [] });
    let offered = null;
    ctx.askPick = async (step, options) => {
      offered = options.map(option => option.label);
      return 'blaster';
    };

    await runSteps(perk.system.rules[0].steps, ctx);
    expect(offered).toEqual(['Blaster', 'Sword']);
    expect(perk.flags.essence20.rules.choices.weapon).toBe('blaster');
    expect(allChat()).toBe('');
  });

  test('the picked weapon gains Ballistic, the others don\'t; nothing before a pick', () => {
    const { bot, perk } = setup();
    const blaster = bot.items.get('blaster');
    const sword = bot.items.get('sword');
    expect(ruleWeaponTraits(bot, blaster, blaster.system.traits)).toEqual([]);
    perk.flags.essence20 = { rules: { choices: { weapon: 'blaster' } } };
    rebuildIndex(bot);
    expect(ruleWeaponTraits(bot, blaster, blaster.system.traits)).toEqual(['ballistic']);
    expect(ruleWeaponTraits(bot, sword, sword.system.traits)).toEqual([]);
  });

  test('a weapon picked before the update carries over (o3SameWeapon)', () => {
    const { bot, perk } = setup({ essence20: { o3SameWeapon: 'sword' } });
    const updates = legacyChoiceUpdates(bot);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ _id: perk.id, 'flags.essence20.rules.choices.weapon': 'sword' })]));
  });
});

describe('EM Protective Lining', () => {
  function attackerWith({ damageType = 'blunt', traits = ['electromagnetic'] } = {}) {
    const attacker = makeActor('Shooter', [], { extra: [
      { id: 'gun', name: 'Gun', type: 'weapon', system: { equipped: true, traits } },
      { id: 'shot', name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: 'gun' } }, system: { damageType, classification: { skill: 'targeting', style: 'ranged' } } },
    ] });
    return { attacker, effect: attacker.items.get('shot') };
  }

  function defenderWith({ equipped = true, attached = true, canTransform = false, computerized = true, extraArmor = null } = {}) {
    const doc = fromPack(FILES.emLining);
    const extra = [
      { id: 'suit', name: 'Battledress', type: 'armor', system: { equipped, traits: ['computerized'], totalBonusEvasion: 2 } },
      { name: doc.name, type: doc.type, system: clone(doc.system), flags: attached ? { essence20: { parentId: 'suit' } } : {} },
      ...(extraArmor ? [extraArmor] : []),
    ];
    return makeActor('Bot', [], { system: { canTransform, traits: { computerized } }, extra });
  }

  const linedShift = (attacker, defender, item) => rollRules(attacker, defender, { item })
    .filter(entry => entry.item.name == 'EM Protective Lining' && entry.answer === true).map(entry => entry.rule.downshift);
  const evasion = (attacker, defender, item, defense = 'evasion') => ruleDefenseAdjust(attacker, defender, defense, { item, difficulty: 10 });

  test('an Electromagnetic attack on a Computerized wearer takes ↓6, and gets the armor\'s Evasion back', () => {
    const { attacker, effect } = attackerWith();
    const defender = defenderWith();
    expect(linedShift(attacker, defender, effect)).toEqual([6]);
    expect(evasion(attacker, defender, effect)).toBe(2);
    expect(evasion(attacker, defender, effect, 'toughness')).toBe(0);
  });

  test('an EMP effect counts as Electromagnetic too; any other attack is untouched', () => {
    const emp = attackerWith({ damageType: 'emp', traits: [] });
    const defender = defenderWith();
    expect(linedShift(emp.attacker, defender, emp.effect)).toEqual([6]);
    expect(evasion(emp.attacker, defender, emp.effect)).toBe(2);
    const plain = attackerWith({ traits: ['ballistic'] });
    expect(linedShift(plain.attacker, defender, plain.effect)).toEqual([]);
    expect(evasion(plain.attacker, defender, plain.effect)).toBe(0);
  });

  test('the ↓6 only against a Computerized wearer; the Evasion either way', () => {
    const { attacker, effect } = attackerWith();
    const defender = defenderWith({ computerized: false });
    expect(linedShift(attacker, defender, effect)).toEqual([]);
    expect(evasion(attacker, defender, effect)).toBe(2);
  });

  test('only while its armor is worn, or unattached on a Transformer', () => {
    const { attacker, effect } = attackerWith();
    const off = defenderWith({ equipped: false });
    expect(linedShift(attacker, off, effect)).toEqual([]);
    expect(evasion(attacker, off, effect)).toBe(0);
    const loose = defenderWith({ attached: false });
    expect(linedShift(attacker, loose, effect)).toEqual([]);
    const altMode = defenderWith({ attached: false, canTransform: true });
    expect(linedShift(attacker, altMode, effect)).toEqual([6]);
    expect(evasion(attacker, altMode, effect)).toBe(2);
  });

  test('every equipped computerized armor counts; the Defense is decided per attack', () => {
    const { attacker, effect } = attackerWith();
    const two = defenderWith({ extraArmor: { name: 'Plate', type: 'armor', system: { equipped: true, traits: ['computerized'], totalBonusEvasion: 1 } } });
    expect(evasion(attacker, two, effect)).toBe(3);
    const rule = fromPack(FILES.emLining).system.rules.find(r => r.type == 'Defense');
    expect(isRollTimeDefense(rule)).toBe(true);
  });
});

describe('Zap Apple Jam: shelf life', () => {
  test('stale at the first mission advance, gone at the second', async () => {
    const pony = makeActor('Applejack', FILES.zapAppleJam);
    const jar = pony.items.contents[0];
    await fireTriggers(pony, 'missionStart');
    expect(jar.flags.essence20.zapStale).toBe(true);
    expect(pony.items.contents).toContain(jar);
    expect(allChat()).toBe('');
    await fireTriggers(pony, 'missionStart');
    expect(pony.items.contents).not.toContain(jar);
    expect(allChat()).toContain('Zap Apple jam is gone');
  });

  test('a jar made stale before the update goes at the next advance; every jar keeps its own clock', async () => {
    const pony = makeActor('Applejack', [FILES.zapAppleJam, FILES.zapAppleJam]);
    const [old, fresh] = pony.items.contents;
    old.flags = { essence20: { zapStale: true } };
    await fireTriggers(pony, 'missionStart');
    expect(pony.items.contents).toEqual([fresh]);
    expect(fresh.flags.essence20.zapStale).toBe(true);
  });
});

describe('Inner Conservation hands the halved spend on to Dino Charged', () => {
  const spend = (actor, spent, prompt) => fireTriggers(actor, 'resourceSpent', { vars: { spent, resource: 'power' }, prompt, ask: async () => 1 });

  test('paying half: Dino Charged takes the halved amount in Essence', async () => {
    // Dino Charged first on the sheet: Inner Conservation's priority still runs it first.
    const ranger = makeActor('Ranger', [FILES.dinoCharged, FILES.innerConservation], { system: { isMorphed: true, powers: { personal: { value: 0, max: 6 } } } });
    await spend(ranger, 4, async () => true);
    expect(ranger.system.powers.personal.value).toBe(2);
    expect(ranger.system.essences.strength.value).toBe(2);
    // 3 spent, 1 back: 2 Essence.
    const odd = makeActor('Odd', [FILES.dinoCharged, FILES.innerConservation], { system: { isMorphed: true, powers: { personal: { value: 0, max: 6 } } } });
    await spend(odd, 3, async () => true);
    expect(odd.system.powers.personal.value).toBe(1);
    expect(odd.system.essences.strength.value).toBe(2);
  });

  test('declined: the whole spend is charged', async () => {
    const ranger = makeActor('Ranger', [FILES.dinoCharged, FILES.innerConservation], { system: { isMorphed: true, powers: { personal: { value: 0, max: 6 } } } });
    await spend(ranger, 3, async () => false);
    expect(ranger.system.powers.personal.value).toBe(0);
    expect(ranger.system.essences.strength.value).toBe(1);
  });
});
