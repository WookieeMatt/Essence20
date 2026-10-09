import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Book check, follow-ups (docs/rules-batches/book-followups.md): items the other book-check groups found outside their
 * own lists, the "until your / their next turn" duration sweep, and the three engine fixes (out-of-combat timed
 * Conditions, Alterations undone when a rule removes them, Better You Than Me's GM button). Items load from their pack
 * sources. (Old tests updated in place: Interdiction - conv14-dice; Not Dead Yet - conv14-items1; Growing Smolder -
 * conv14-dice; Extended Attack - book-durations / conv14-items1; Deconstructionist - book-effects; applyTimedCondition -
 * mechanics/combat/timed-status.test.js.)
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const dealt = [];
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type, isCrit, options) => dealt.push({ name: actor.name, amount, type, options })),
}));
// pick steps answer from `values` (a select's value).
let values = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  chooseSelect: jest.fn(async () => values.shift() ?? null),
  chooseButtons: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true })),
  findItems: jest.fn(async () => []),
  pickOne: jest.fn(async () => null),
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const undone = [];
jest.unstable_mockModule('./sheet-handlers/alteration-handler.mjs', () => ({
  onAlterationDelete: jest.fn(async (actor, alteration) => undone.push(alteration.name)),
  onAlterationDrop: jest.fn(),
}));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse, sweepExpired } = await import('./triggers.mjs');
const { ruleDerived, ruleDialogSwitches, ruleRollSources, ruleScaledDamage } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { bankedSources } = await import('./bank.mjs');
const { pressRuleButton } = await import('./buttons.mjs');
const { applyTimedCondition } = await import('../mechanics/combat/timed-status.mjs');
const { sweepTimedConditions, undoAlterations, usesItem, OOC_CONDITION_FLAG } = await import('./plugins/book/followups.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const P = {
  interdiction: 'fffav1items/_source/Interdiction_AyKHJdCpdtoZHlER.json',
  notDeadYet: 'iafav2items/_source/Not_Dead_Yet_mCsw25hT4y4q4ceG.json',
  smolder: 'fmmcitems/_source/Growing_Smolder_4XblFV97cS63ueDM.json',
  extended: 'tfcrbitems/_source/Extended_Attack_bpTOPVRx3hKkq4Yr.json',
  aero: 'gijcrbitems/_source/Aerodynamics_NoENOcMYq0YkkhAk.json',
  bladeAero: 'qgtgitems/_source/Thrown_Blade__Aerodynamics__WYVuwQwX2QCuWSD1.json',
  betterYou: 'fmmcitems/_source/Better_You_Than_Me_u0vF75YLcwdyY8pv.json',
  decon: 'qgtgitems/_source/Deconstructionist_2qb5dV11qvWsN4xJ.json',
  deadstick: 'qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json',
  brutal: 'dditems/_source/Brutal_Display_11Q2KXJ7qxlddusg.json',
  comms: 'dditems/_source/Comms_Assault_pKArYQ259zpdsR7o.json',
  dirty: 'dditems/_source/Dirty_Blows_MvPfmzW4mh7TsMJo.json',
  fearsome: 'dditems/_source/Fearsome_Voice_ZQl2qzyBNHUYYHS5.json',
  example: 'dditems/_source/Make_An_Example_mroTcYJKFpAAiqP5.json',
  painmonger: 'dditems/_source/Painmonger_6lQNn6RY1Kclydw8.json',
  bump: 'eocitems/_source/Bump___Run_4eA2ktw0cfdYV6Fs.json',
  manipulate: 'fgtaaitems/_source/Manipulate_5IfrvMnLOMqfNWko.json',
  cruel: 'fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json',
  iceAlternate: 'fmmcitems/_source/Ice_Flechettes_Alternate_Effect_5Y2brpJu5M8M0HV0.json',
  iceEffect: 'fmmcitems/_source/Ice_Flechettes_Effect_vMoq7coIwWqEaTFI.json',
  frost: 'fmmcitems/_source/Path_of_Frost_GQ5aQWbjmaO9y00w.json',
  fury: 'ttsgitems/_source/Elemental_Fury_larsGRE5U4ZOVxzw.json',
  teeth: 'wtnvcgitems/_source/Replacement_Teeth_wuHnZ1qtGrd8il8a.json',
  nanoMed: 'gijcrbitems/_source/Nano_Med_Mastery_7hMe2hYONR6wBMFv.json',
  ironBravado: 'jttitems/_source/Iron_Bravado_8bmqJ7hyOAcVNB1Y.json',
  safety: 'qgtgitems/_source/Your_Safety_s_On_CLwsh2pCwbrgYGru.json',
};

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (/\.-=/.test(key) || __isForcedDeletion(value)) {
      const [path, gone] = __isForcedDeletion(value) ? [key.slice(0, key.lastIndexOf('.')), key.slice(key.lastIndexOf('.') + 1)] : key.split('.-=');
      delete getPath(doc, path)?.[gone];
      continue;
    }

    setPath(doc, key, value);
  }

  rebuildIndex(doc.documentName == 'Actor' ? doc : doc.parent);
}

/** An item from a pack source file (its own rules), with its compendium id as its source. */
function packItem(key, extra = {}) {
  const doc = fromPack(P[key]);
  return {
    name: doc.name, type: doc.type, system: JSON.parse(JSON.stringify(doc.system)), ...extra,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  };
}

function makeActor(name, { items = [], x = 0, disposition = 1, system = {}, type = 'playerCharacter' } = {}) {
  const list = [];
  const effects = [];
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects,
    system: {
      level: 5, size: 'common', health: { value: 8, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 3 } }, skills: {},
      defenses: { toughness: { total: 12, value: 12 }, evasion: { total: 12, value: 12 }, willpower: { total: 12 }, cleverness: { total: 12 } },
      resistances: {}, immunities: {}, ...system,
    },
    async update(data) {
      await applyUpdate(this, data);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags, `${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    // A Condition is an effect on the actor, as in Foundry.
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      if (active) {
        this.statuses.add(status);
        const effect = { id: `e${nextId++}`, statuses: new Set([status]), flags: {}, async update(data) {
          await applyUpdate(this, data);
        } };
        effects.push(effect);
      } else {
        this.statuses.delete(status);
      }
    }),
    deleteEmbeddedDocuments: jest.fn(async function (kind, ids) {
      const from = kind == 'ActiveEffect' ? effects : list;
      for (const id of ids) {
        const at = from.findIndex(doc => doc.id == id);
        if (at >= 0) {
          const [doc] = from.splice(at, 1);
          doc.statuses?.forEach(status => this.statuses.delete(status));
        }
      }
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  actor.items = {
    contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn), some: fn => list.some(fn), filter: fn => list.filter(fn),
    [Symbol.iterator]: () => list[Symbol.iterator](),
  };
  actor.addItem = data => {
    const item = { effects: [], ...data, id: `i${nextId++}`, async update(changes) {
      await applyUpdate(this, changes);
    } };
    item.uuid = `${actor.uuid}.Item.${item.id}`;
    item.flags ??= {};
    item.flags.essence20 ??= {};
    item.parent = item.actor = actor;
    list.push(item);
    rebuildIndex(actor);
    return item;
  };

  items.forEach(data => actor.addItem(data));
  game.actors.contents.push(actor);
  canvas.tokens.placeables.push(token);
  return actor;
}

const itemNamed = (actor, name) => actor.items.contents.find(item => item.name == name);
function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
  game.user.targets.first = () => actors[0]?.token;
}

/** A weapon and one attack of it on the actor. */
function weaponWith(actor, name, attack = {}) {
  const weapon = actor.addItem({ name, type: 'weapon', system: { equipped: true, traits: [] } });
  const effect = actor.addItem({ name: `${name} attack`, type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } },
    system: { classification: { skill: 'might', style: 'melee' }, damageValue: 1, damageType: 'blunt', totalReach: 5, ...attack } });
  return { weapon, effect };
}

let picks = [];
const paid = [];
const pay = jest.fn(async action => paid.push(action) > 0);
const use = item => runUse(item, pay, { ask: async () => picks.shift() ?? 0 });
// A running combat whose turn order is `actors`, each combatant with an id (turnBoundTiming needs it).
const startCombat = (round = 1, turn = 0, actors = []) => {
  const turns = actors.map((actor, index) => ({ id: `cb${index}`, actor, actorId: actor.id }));
  game.combat = { id: 'c1', started: true, round, turn, turns, combatants: turns };
  game.combats = { get: id => (id == 'c1' ? game.combat : null) };
};

beforeEach(() => {
  dealt.length = 0;
  paid.length = 0;
  undone.length = 0;
  picks = [];
  values = [];
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { contents: [] },
    i18n: { localize: k => k, format: (k, d) => `${k}${d ? ` ${JSON.stringify(d)}` : ''}`, has: () => false },
    settings: { get: () => 1, set: async () => {} }, actors: { contents: [], get: id => game.actors.contents.find(a => a.id == id) },
    scenes: { active: null }, time: { worldTime: 0 },
  };
  game.user.targets.first = () => undefined;
  global.CONFIG = { E20: { damageTypes: { blunt: 'Blunt', void: 'Void' }, skillToEssence: { technology: 'smarts' }, skills: {}, actorSizes: { small: 's', common: 'c', large: 'l' } } };
  global.canvas = { scene: null, tokens: { placeables: [], controlled: [], setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.fromUuidSync = uuid => game.actors.contents.find(actor => actor.uuid == uuid)
    ?? game.actors.contents.flatMap(actor => actor.items.contents).find(item => item.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: getPath, setProperty: setPath, hasProperty: (o, k) => getPath(o, k) !== undefined, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
    applications: { api: { DialogV2: { wait: jest.fn(async () => null), prompt: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('every rule on the checked items validates', () => {
  for (const [key, file] of Object.entries(P)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([key, rule.label, validateRule(rule)]).toEqual([key, rule.label, []]);
    }
  }
});

test('Interdiction: offered against a lower Threat Level, asking that the target is not aware of you', () => {
  const recon = makeActor('Recon', { items: [packItem('interdiction')], system: { level: 20 } });
  const { effect: knife } = weaponWith(recon, 'Knife');
  const mook = makeActor('Mook', { type: 'npc', disposition: -1, system: { threatLevel: 4 } });
  target(mook);
  const [offered] = ruleDialogSwitches(recon, { item: knife });
  expect(offered.label).toMatch(/^Interdiction \(a target not aware of you\)/);
  expect(offered.entry.rule.when).toContain('ask:The target is not aware of you');
  expect(offered.value).toBe(false);
});

describe('Not Dead Yet: a Standard action; 2 temporary Health once per mission when a CSTO character can see and hear you', () => {
  test('no CSTO Personnel ally on the scene: 1 temporary Health, which goes with the scene', async () => {
    const soldier = makeActor('Soldier', { items: [packItem('notDeadYet')] });
    await use(itemNamed(soldier, 'Not Dead Yet'));
    expect(paid).toEqual(['standard']);
    expect(soldier.system.health).toMatchObject({ value: 9, bonus: 1 });
    expect(soldier.flags.essence20.resTempGrants).toEqual([expect.objectContaining({ kind: 'health', amount: 1 })]);
  });

  test('a CSTO Personnel ally anywhere on the scene: asked, and "yes" gives 2 (the mission window marked)', async () => {
    const soldier = makeActor('Soldier', { items: [packItem('notDeadYet')], x: 0 });
    makeActor('Comrade', { items: [{ name: 'CSTO Personnel', type: 'origin', system: {} }], x: 500 });
    picks = [0];
    await use(itemNamed(soldier, 'Not Dead Yet'));
    expect(soldier.system.health).toMatchObject({ value: 10, bonus: 2 });
    expect(evaluate(['self:windowUsed:notDeadYetEnhancedUsedThisMission:mission'], contextFor({ self: soldier }))).toBe(true);
  });
});

describe('Growing Smolder: a Free action; the bonus is on the following turn\'s attacks, cumulative', () => {
  const smolderer = () => {
    const monster = makeActor('Monster', { items: [packItem('smolder')] });
    const { effect } = weaponWith(monster, 'Talons');
    return { monster, effect, perk: itemNamed(monster, 'Growing Smolder') };
  };

  const shiftUp = (actor, item) => ruleRollSources(actor, null, { item, dataset: {} }).sources.filter(s => s.label?.startsWith('Growing Smolder')).reduce((n, s) => n + (Number(s.shiftUp) || 0), 0);

  test('nothing this turn, ↑1 and +1 damage on every attack of the next turn, gone after it', async () => {
    const { monster, effect, perk } = smolderer();
    startCombat(1, 0, [monster]);
    await use(perk);
    expect(paid).toEqual(['free']);
    expect(shiftUp(monster, effect)).toBe(0);
    game.combat.round = 2;
    expect([shiftUp(monster, effect), shiftUp(monster, effect)]).toEqual([1, 1]);
    // The +1 is Fire damage now (book-followups2.test.js): a hit rider option, not the attack's own damage bonus.
    expect(ruleScaledDamage(monster, null, { item: effect }).amount).toBe(0);
    game.combat.round = 3;
    expect(shiftUp(monster, effect)).toBe(0);
  });

  test('used again instead of attacking: ↑2 the turn after, up to ↑3', async () => {
    const { monster, effect, perk } = smolderer();
    startCombat(1, 0, [monster]);
    for (const round of [1, 2, 3, 4]) {
      game.combat.round = round;
      await use(perk);
    }

    game.combat.round = 5;
    expect(shiftUp(monster, effect)).toBe(3);
  });

  test('attacking on the turn it was used loses it', async () => {
    const { monster, effect, perk } = smolderer();
    startCombat(1, 0, [monster]);
    await use(perk);
    await fireTriggers(monster, 'afterRoll', { roll: { item: effect, isAttack: true }, outcome: 'success', facts: { results: [{ success: true }] } });
    game.combat.round = 2;
    expect(shiftUp(monster, effect)).toBe(0);
  });
});

test('Extended Attack: a Move action doubles the Reach of the ONE picked Melee weapon', async () => {
  const bot = makeActor('Bot', { items: [packItem('extended')] });
  const sword = weaponWith(bot, 'Sword');
  const axe = weaponWith(bot, 'Axe');
  values = [sword.weapon.id];
  await use(itemNamed(bot, 'Extended Attack'));
  expect(paid).toEqual(['move']);
  ruleDerived(bot);
  expect(sword.effect.system.totalReach).toBeGreaterThan(5);
  expect(axe.effect.system.totalReach).toBe(5);
});

test('Thrown Blade (Aerodynamics): its attached Aerodynamics upgrade doubles both ranges', () => {
  const joe = makeActor('Joe');
  const blade = fromPack(P.bladeAero);
  const weapon = joe.addItem({ name: blade.name, type: 'weapon', system: { equipped: true, traits: blade.system.traits } });
  const range = { value: 20, long: 30 };
  const effect = joe.addItem({ name: 'Thrown Blade Effect', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } },
    system: { classification: { skill: 'targeting', style: 'projectile' }, range: { ...range } }, _source: { system: { range: { ...range } } } });
  joe.addItem({ ...packItem('aero'), flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.NoENOcMYq0YkkhAk' }, essence20: { parentId: weapon.id } } });
  ruleDerived(joe);
  expect(effect.system.range).toEqual({ value: 40, long: 60 });
  expect(blade.system.automation.status).toBe('full');
});

describe('Better You Than Me: unreducible Void damage, also through the GM', () => {
  test('an ally you own takes it at once; one you don\'t gets a GM button that applies the same unreducible damage', async () => {
    const clone = makeActor('Clone', { items: [packItem('betterYou')] });
    const ally = makeActor('Ally');
    ally.isOwner = false;
    target(ally);
    await use(itemNamed(clone, 'Better You Than Me'));
    expect(dealt).toEqual([]);
    const card = ChatMessage.create.mock.calls.map(([data]) => data).find(data => data.flags?.essence20?.ruleButton);
    expect(card.flags.essence20.ruleButton).toEqual(expect.objectContaining({ who: 'gm', targets: [ally.uuid],
      steps: [{ do: 'unreducibleDamage', amount: 1, damageType: 'void', to: 'target' }] }));
    // The GM presses it (and owns the ally).
    ally.isOwner = true;
    const message = { id: 'm1', flags: card.flags, update: jest.fn(async () => {}) };
    expect(await pressRuleButton(message, game.user)).toBe(true);
    expect(dealt).toEqual([{ name: 'Ally', amount: 1, type: 'void', options: { unreducible: true } }]);
  });
});

describe('Deconstructionist: a vehicle\'s tests all take the Snag; a creature\'s only those using the equipment', () => {
  test('against an operator, the picked item: its rolls take the Snag, other tests don\'t', async () => {
    const tech = makeActor('Tech', { items: [packItem('decon')] });
    const trooper = makeActor('Trooper', { type: 'npc', disposition: -1 });
    const rifle = weaponWith(trooper, 'Rifle');
    rifle.weapon.system.traits = ['computerized'];
    const other = weaponWith(trooper, 'Knife');
    startCombat(1, 0, [tech, trooper]);
    values = [rifle.weapon.uuid];
    await fireTriggers(tech, 'hit', { roll: { rolledSkill: 'technology', switches: ['deconstructionist'] }, outcome: 'success', targets: [trooper], facts: { results: [{ success: true }] } });
    const snag = roll => bankedSources(trooper, null, roll).sources.some(source => source.snag);
    expect([snag({ item: rifle.effect }), snag({ item: rifle.weapon }), snag({ item: other.effect }), snag({ rolledSkill: 'athletics' })]).toEqual([true, true, false, false]);
  });

  test('against a vehicle: every test it makes', async () => {
    const tech = makeActor('Tech', { items: [packItem('decon')] });
    const truck = makeActor('Truck', { type: 'vehicle', disposition: -1, system: { traits: { computerized: true } } });
    startCombat(1, 0, [tech, truck]);
    await fireTriggers(tech, 'hit', { roll: { rolledSkill: 'technology', switches: ['deconstructionist'] }, outcome: 'success', targets: [truck], facts: { results: [{ success: true }] } });
    expect(bankedSources(truck, null, { rolledSkill: 'driving' }).sources.some(source => source.snag)).toBe(true);
  });

  test('tag item:usesItem: the item, an attack of it, or a test naming it', () => {
    const actor = makeActor('A');
    const { weapon, effect } = weaponWith(actor, 'Gun');
    expect([usesItem(weapon, weapon.uuid), usesItem(effect, weapon.uuid), usesItem(effect, weapon.id), usesItem(null, weapon.uuid, { markedItemUuid: weapon.uuid }), usesItem(effect, 'other')])
      .toEqual([true, true, true, true, false]);
  });
});

describe('the "until your / their next turn" sweep', () => {
  // Every applyCondition / mark on these items: [condition or key, until, untilOf].
  const timings = key => {
    const found = [];
    const walk = value => {
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else if (value && typeof value == 'object') {
        if (['applyCondition', 'mark'].includes(value.do) && (value.until || value.rounds)) {
          found.push([value.condition ?? value.key, value.until ?? `rounds:${value.rounds}`, value.untilOf ?? 'holder']);
        }

        Object.values(value).forEach(walk);
      }
    };

    walk(fromPack(P[key]).system.rules);
    return found;
  };

  test('each item counts the turn the book names', () => {
    const theirs = ['endOfNextTurn', 'recipient'];
    expect(timings('brutal').filter(([, until]) => until != 'turnOrScene')).toEqual([['frightened', ...theirs], ['frightened', 'rounds:10', 'holder']]);
    expect(timings('comms')).toEqual([['tf1CommsAssault', 'turnOrScene', 'holder'], ['stunned', ...theirs]]);
    for (const key of ['dirty', 'fearsome', 'example', 'painmonger', 'teeth', 'iceAlternate', 'iceEffect']) {
      expect([key, timings(key).filter(([, until]) => until != 'turnOrScene').map(([, ...rest]) => rest)]).toEqual([key, [theirs]]);
    }

    expect(timings('bump').filter(([what]) => ['stunned', 'impaired'].includes(what))).toEqual([['stunned', ...theirs], ['impaired', 'endOfNextTurn', 'holder']]);
    expect(timings('manipulate')).toEqual([['grappled', 'nextTurn', 'holder']]);
    expect(timings('cruel')).toEqual([['impaired', 'endOfNextTurn', 'holder'], ['impaired', 'endOfNextTurn', 'holder']]);
    expect(timings('frost').filter(([what]) => what == 'immobilized')).toEqual([['immobilized', 'endOfNextTurn', 'holder']]);
    expect(timings('fury').filter(([, until]) => until != 'rounds:0')).toEqual([['impaired', ...theirs], ['stunned', ...theirs], ['immobilized', ...theirs]]);
    expect(timings('nanoMed')).toEqual([['nanoMedMastery', 'endOfNextTurn', 'holder']]);
    expect(timings('ironBravado').filter(([, until]) => until != 'turnOrUntilCombat')).toEqual([['ironBravado', 'nextTurn', 'holder']]);
    expect(timings('safety')).toEqual([['yourSafetysOn', 'endOfNextTurn', 'holder']]);
    // Deadstick's book duration is "1 round" - kept.
    expect(timings('deadstick')).toEqual([['stunned', 'rounds:1', 'holder'], ['stunned', 'rounds:1', 'holder']]);
  });

  test('Dirty Blows in combat: Impaired ends as the target\'s next turn ends (v14 effect expiry)', async () => {
    const brute = makeActor('Brute', { items: [packItem('dirty')] });
    const foe = makeActor('Foe', { type: 'npc', disposition: -1 });
    startCombat(1, 0, [brute, foe]);
    await fireTriggers(brute, 'hit', { roll: { switches: ['dirtyBlows'] }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(foe.statuses.has('impaired')).toBe(true);
    expect(foe.effects[0].duration).toEqual(expect.objectContaining({ value: 0, expiry: 'turnEnd' }));
    expect(foe.effects[0].start).toEqual(expect.objectContaining({ combatant: 'cb1' }));
  });

  test('Dirty Blows out of combat: one round, 6 seconds of game time', async () => {
    const brute = makeActor('Brute', { items: [packItem('dirty')] });
    const foe = makeActor('Foe', { type: 'npc', disposition: -1 });
    await fireTriggers(brute, 'hit', { roll: { switches: ['dirtyBlows'] }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(foe.effects[0].flags.essence20[OOC_CONDITION_FLAG]).toEqual(expect.objectContaining({ until: 'rounds:1' }));
    game.time.worldTime = 6;
    await sweepTimedConditions([foe]);
    expect(foe.statuses.has('impaired')).toBe(false);
  });
});

describe('round-limited Conditions out of combat: a round is 6 seconds', () => {
  test('Frightened for 2 rounds is still on after 11 seconds and gone after 13', async () => {
    const actor = makeActor('Pony');
    await applyTimedCondition(actor, 'frightened', 2);
    expect(actor.effects[0].flags.essence20[OOC_CONDITION_FLAG]).toEqual({ until: 'rounds:2', stamp: expect.objectContaining({ oocRounds: 2, time: 0 }) });
    game.time.worldTime = 11;
    expect(await sweepTimedConditions([actor])).toBe(0);
    expect(actor.statuses.has('frightened')).toBe(true);
    game.time.worldTime = 13;
    expect(await sweepTimedConditions([actor])).toBe(1);
    expect(actor.statuses.has('frightened')).toBe(false);
  });

  test('the scene ending ends it too; a running combat still uses the round count', async () => {
    const actor = makeActor('Pony');
    let scene = 1;
    game.settings.get = () => scene;
    await applyTimedCondition(actor, 'frightened', 10);
    scene = 2;
    await sweepTimedConditions([actor]);
    expect(actor.statuses.has('frightened')).toBe(false);

    const fighter = makeActor('Fighter');
    startCombat(1, 0, [fighter]);
    await applyTimedCondition(fighter, 'frightened', 3);
    expect(fighter.effects[0].duration).toEqual({ rounds: 3, startRound: 1, startTurn: 0 });
    expect(fighter.effects[0].flags.essence20?.[OOC_CONDITION_FLAG]).toBeUndefined();
  });
});

describe('Beast Mode: an Alteration a rule removes takes back what it wrote onto the actor', () => {
  test('undoAlterations runs the Alteration delete handler for Alterations only', async () => {
    const actor = makeActor('Viper', { items: [{ name: 'Gills', type: 'alteration', system: { type: 'movement' } }, { name: 'Engrafted Mutation', type: 'perk', system: {} }] });
    const ids = actor.items.contents.map(item => item.id);
    expect(await undoAlterations(actor, ids)).toBe(1);
    expect(undone).toEqual(['Gills']);
  });

  test('the scene-long Alteration running out (sweepExpired) is undone before it is deleted', async () => {
    const actor = makeActor('Viper');
    const stamp = { until: 'scene', stamp: { epoch: 0 } };
    actor.addItem({ name: 'Beast Mutation', type: 'perk', system: {}, flags: { essence20: { beastMode: true, rulesExpiry: stamp } } });
    actor.addItem({ name: 'Claws', type: 'alteration', system: { type: 'essence' }, flags: { essence20: { geneticAlteration: true, rulesExpiry: stamp } } });
    const order = [];
    actor.deleteEmbeddedDocuments.mockImplementation(async () => order.push('delete'));
    const { onAlterationDelete } = await import('../sheet-handlers/alteration-handler.mjs');
    onAlterationDelete.mockImplementation(async (who, alteration) => order.push(`undo ${alteration.name}`));
    await sweepExpired(actor);
    expect(order).toEqual(['undo Claws', 'delete']);
  });
});
