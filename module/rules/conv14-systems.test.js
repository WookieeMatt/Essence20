import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, systems (docs/rules-batches/slSystems14.md): weapon upgrades, action Perks, summons / team items, vehicle
 * upgrades and the perk-handler Perks moved from hand-written code onto item rules. Items are loaded from their pack
 * sources and must do what the old code (and its old tests) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ setEntryAndAddItem: jest.fn(async () => 'key1') }));

await import('./plugins/index.mjs');
await import('./actions.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleMovementStages, ruleAttackCounts, rollRules, ruleWeaponTraits } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { runUse, fireTriggers, fireItemAdded } = await import('./triggers.mjs');
const { incomingEntries } = await import('./plugins/dialog/dialog-select.mjs');
const { runApplyDialog } = await import('../mechanics/item-hooks.mjs');
const { getAttacksPerAction, attackMatchesFilter, describeAttack, getCostOptions } = await import('../mechanics/actions/action-perks.mjs');
const { consumeForItem, getLedger, getRemaining, spend } = await import('../mechanics/actions/action-economy.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');

// The GM's start-up linking pass: old picks (flags) moved into the rules' choices.
async function linkLegacy(actor) {
  for (const { _id, ...update } of legacyChoiceUpdates(actor)) {
    await actor.items.get(_id).update(update);
  }

  rebuildIndex(actor);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  scope: 'gijcrbitems/_source/Scope_cBiD2lBLRwnxu8Rx.json',
  scopePr: 'prcrbitems/_source/Scope_cBiD2lBLRwnxu8Rx.json',
  scopeTf: 'tfcrbitems/_source/Scope_cBiD2lBLRwnxu8Rx.json',
  aero: 'gijcrbitems/_source/Aerodynamics_NoENOcMYq0YkkhAk.json',
  aeroPr: 'prcrbitems/_source/Aerodynamic_NoENOcMYq0YkkhAk.json',
  aeroTf: 'tfcrbitems/_source/Aerodynamics_NoENOcMYq0YkkhAk.json',
  eruptive: 'gijcrbitems/_source/Eruptive_0Q21VhUK1PNu1pTM.json',
  eruptivePr: 'prcrbitems/_source/Eruptive_0Q21VhUK1PNu1pTM.json',
  eruptiveTf: 'tfcrbitems/_source/Eruptive_0Q21VhUK1PNu1pTM.json',
  deadly: 'gijcrbitems/_source/Deadly_hd1O6anmtNcyjpw9.json',
  deadlyTf: 'tfcrbitems/_source/Deadly_hd1O6anmtNcyjpw9.json',
  lingering: 'gijcrbitems/_source/Lingering_LyOKEFZd8vriKLOs.json',
  lingeringTf: 'tfcrbitems/_source/Lingering_LyOKEFZd8vriKLOs.json',
  swift: 'gijcrbitems/_source/Swift_4yY2nOHsZuV0jT7M.json',
  swiftPr: 'prcrbitems/_source/Swift_4yY2nOHsZuV0jT7M.json',
  swiftTf: 'tfcrbitems/_source/Swift_4yY2nOHsZuV0jT7M.json',
  vial: 'ccitems/_source/Tossable_Vial_swnhABvNaKuNY5FI.json',
  chrono: 'jttitems/_source/Chrono_Trigger_eFsOmJPMyuUHhcQD.json',
  mobility: 'gijcrbitems/_source/Mobility_yFwBVeGDHIf3EmGp.json',
  mobilize: 'gijcrbitems/_source/Mobilize_tLsCk8n8tqhQ6XQf.json',
  motivate: 'gijcrbitems/_source/Motivate_BB9Z5wEmjIvclAVx.json',
  momentum: 'gijcrbitems/_source/Momentum_Czabb7MnyglRRo2P.json',
  shoot: 'ccitems/_source/Shoot__You_Fools__OjNB0uwTOwEQjo85.json',
  balance: 'mlpcrbitems/_source/Balance_Your_Enthusiasm_0oLVEe94tZ0drQTo.json',
  barrage: 'tfcrbitems/_source/Bullet_Barrage_lET3yffxwg5YWXBJ.json',
  spirit: 'ttsgitems/_source/Spirit_s_Host_HQaLM23Y7hnKbLFQ.json',
  hardTarget: 'ccitems/_source/Hard_Target_ZV00Jdj5O9u3OC7F.json',
  organic: 'bthitems/_source/Organic_Zord_UCy4agcbYPMWqG5N.json',
  afterburners: 'qgtgitems/_source/Afterburners_ICqafFtaZbexsl5e.json',
  nitro: 'qgtgitems/_source/Nitrogen_Enhanced_Rocket_Fuel_3ZJ8Pqbfhc0JqBPt.json',
  evasive: 'qgtgitems/_source/Evasive_Handling_MRoi8QxW568uiCir.json',
  ecm: 'qgtgitems/_source/Electronic_Countermeasures_oTPW1JHgRPwmZtr8.json',
  smoke: 'qgtgitems/_source/Smokescreen_94NUwERfVYs0Tgmh.json',
  flight: 'qgtgitems/_source/Flight_Conversion_psJCjvdROy5gEVGS.json',
  radar: 'qgtgitems/_source/Radar_Jammer_yVw1WzUd0rGgLab7.json',
  enhancedRadar: 'qgtgitems/_source/Enhanced_Radar_Jamming_2TuY6npYY0UzYdOm.json',
  resistant: 'qgtgitems/_source/Energy_Resistant_iBB7lV76sz9UpDLx.json',
  plating: 'qgtgitems/_source/Energized_Plating_ACEcaBK7pFHqq4RU.json',
  spiked: 'qgtgitems/_source/Spiked_KVwQulJAxVwEcpBw.json',
  doubleBarrel: 'qgtgitems/_source/Double_Barrel_6xtWfYIm3TE4ArtK.json',
  targeting: 'qgtgitems/_source/Targeting_System_TMNBoHPbIxrqzBfG.json',
  matrix: 'atsitems/_source/Shield_Matrix_e200PVV1q6a0Us9n.json',
  combiner: 'eocitems/_source/Combiner_Specialization_mWyO6mHSMG4TVw3J.json',
  blendIn: 'fffav1items/_source/Blend_In_mnze6jJ6eSYbS8Pr.json',
  silent: 'fffav1items/_source/Silent_Running_58OZMB7WbAgqgpkX.json',
};
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = String(key).split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

let nextId = 1;
const worldActors = [];

function list(items) {
  items.get = id => items.find(item => item.id == id);
  Object.defineProperty(items, 'contents', { get: () => items, configurable: true });
  return items;
}

function makeActor(name, { type = 'playerCharacter', system = {}, items = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: {
      health: { value: 5, max: 10, bonus: 0, string: '' }, skills: {}, essences: { smarts: { value: 1 }, social: { value: 1 } },
      defenses: { toughness: { total: 10, string: '' }, evasion: { total: 10, string: '' } },
      actions: { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 2 } },
      ...system,
    },
    getActiveTokens: () => [],
    toggleStatusEffect: jest.fn(async () => true),
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async unsetFlag(scope, key) {
      delete this.flags?.[scope]?.[key];
    },
    createEmbeddedDocuments: jest.fn(async (kind, data) => data.map(entry => addItem(actor, { ...entry, id: `i${nextId++}` }))),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = list([]);
  for (const data of items) {
    addItem(actor, data);
  }

  worldActors.push(actor);
  return actor;
}

function addItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: {}, effects: [], ...data, system: data.system ?? {}, parent: actor,
    async update(changes) {
      for (const [k, value] of Object.entries(changes)) {
        setPath(this, k, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  actor.items.push(item);
  rebuildIndex(actor);
  return item;
}

function addPack(actor, key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return addItem(actor, {
    name: doc.name, type: doc.type, ...extra, system: { ...clone(doc.system), ...(extra.system ?? {}) },
    flags: { ...(extra.flags ?? {}), core: { sourceId: extra.source ?? `Compendium.essence20.x.Item.${doc._id}` } },
  });
}

// A weapon with one attack, as items prepare it (derived = source until rules change it).
function weaponWith(actor, effectSystem = {}, weaponSystem = {}) {
  const weapon = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: true, ...weaponSystem } });
  const base = { damageType: 'sharp', damageValue: 1, range: { value: 100, long: 400 }, radius: 0, numTargets: 1, classification: { skill: 'targeting', style: 'projectile' }, ...effectSystem };
  const effect = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: clone(base), _source: { system: clone(base) } });
  return { weapon, effect };
}

const onWeapon = (actor, weapon, key) => addPack(actor, key, { flags: { essence20: { parentId: weapon.id } } });
const prepare = actor => {
  rebuildIndex(actor);
  ruleDerived(actor);
};

let combat;
beforeEach(() => {
  worldActors.length = 0;
  combat = null;
  global.game = {
    get combat() {
      return combat;
    },
    combats: { get: id => (combat?.id == id ? combat : null) },
    user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set(), character: null },
    users: { activeGM: null, contents: [] },
    settings: { get: (scope, key) => ({ actionEconomyMode: 'track', actionPerkPrompts: true }[key] ?? 1), set: async () => {} },
    actors: { contents: worldActors, get: id => worldActors.find(actor => actor.id == id), [Symbol.iterator]: () => worldActors[Symbol.iterator]() },
    scenes: { active: null },
    i18n: { localize: k => k, format: k => k, has: () => false },
    messages: { get: () => null },
    socket: { emit: jest.fn() },
    packs: [],
  };
  global.canvas = undefined;
  global.CONFIG = { E20: { skillToEssence: {}, damageTypes: {}, actorSizes: {} } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => worldActors.find(actor => actor.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: clone, randomID: () => `r${nextId++}`, escapeHTML: s => s },
    applications: { api: { DialogV2: { wait: jest.fn(), confirm: jest.fn() } } },
  };
});

// One started combat, a combatant per actor.
function startCombat(actors) {
  const flags = new Map();
  const combatants = actors.map(actor => ({
    actor, actorId: actor.id, tokenId: `t-${actor.id}`, isOwner: true, uuid: `Combat.c1.Combatant.${actor.id}`,
    getFlag: (scope, key) => flags.get(`${actor.id}.${key}`), setFlag: async (scope, key, value) => flags.set(`${actor.id}.${key}`, value),
  }));
  combat = { id: 'c1', started: true, round: 1, turn: 0, combatants, turns: combatants, getCombatantsByActor: actor => combatants.filter(c => c.actor === actor) };
  return combatants;
}

const payWith = actor => async action => !(await spend(actor, action, { source: 'test' })).blocked;
const target = (...actors) => {
  game.user.targets = new Set(actors.map(actor => ({ actor })));
};

test('every changed item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    const rules = fromPack(file).system.rules ?? [];
    expect([file, rules.length > 0]).toEqual([file, true]);
    for (const rule of rules) {
      expect([file, rule.label, validateRule(rule)]).toEqual([file, rule.label, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Weapon upgrades                              */
/* -------------------------------------------- */

describe('weapon upgrades (ItemModifier rules on the upgrade)', () => {
  test('Scope (every printing) and Aerodynamics double both ranges; two copies double twice; only their own weapon', () => {
    // Book check 2026-10-06 (docs/rules-batches/book-limits.md): Aerodynamic needs a grenade or thrown weapon.
    for (const key of ['scope', 'scopePr', 'scopeTf', 'aero', 'aeroPr', 'aeroTf']) {
      const actor = makeActor('Joe');
      const { weapon, effect } = weaponWith(actor, {}, { traits: ['thrown'] });
      const other = weaponWith(actor, {}, { traits: ['thrown'] });
      onWeapon(actor, weapon, key);
      prepare(actor);
      expect([key, effect.system.range]).toEqual([key, { value: 200, long: 800 }]);
      expect(effect.system.upgradeTouched).toEqual(expect.arrayContaining(['range.value', 'range.long']));
      expect(other.effect.system.range).toEqual({ value: 100, long: 400 });
    }

    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor, { range: { value: 20, long: 50 } }, { traits: ['thrown'] });
    onWeapon(actor, weapon, 'scope');
    onWeapon(actor, weapon, 'aero');
    prepare(actor);
    expect(effect.system.range).toEqual({ value: 80, long: 200 });
  });

  test('no range, no long range: nothing doubles (a missing long range stays missing)', () => {
    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor, { range: { value: 30, long: null } });
    const melee = weaponWith(actor, { range: { value: null, long: null } });
    onWeapon(actor, weapon, 'scope');
    onWeapon(actor, melee.weapon, 'scope');
    prepare(actor);
    expect(effect.system.range).toEqual({ value: 60, long: null });
    expect(melee.effect.system.range).toEqual({ value: null, long: null });
  });

  test('Tossable Vial gives a Reach weapon 20/50 ft - and a Scope on it does not double that (the old order)', () => {
    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor, { range: { value: null, long: null } });
    onWeapon(actor, weapon, 'vial');
    onWeapon(actor, weapon, 'scope');
    prepare(actor);
    expect(effect.system.range).toEqual({ value: 20, long: 50 });

    const ranged = makeActor('Joe');
    const shot = weaponWith(ranged);
    onWeapon(ranged, shot.weapon, 'vial');
    prepare(ranged);
    expect(shot.effect.system.range).toEqual({ value: 100, long: 400 });
  });

  test('Eruptive doubles a blast (all printings, twice for two), worked out before a Perk\'s temporary blast change', () => {
    for (const key of ['eruptive', 'eruptivePr', 'eruptiveTf']) {
      const actor = makeActor('Joe');
      const { weapon, effect } = weaponWith(actor, { radius: 10 });
      onWeapon(actor, weapon, key);
      prepare(actor);
      expect(effect.system.radius).toBe(20);
    }

    const twice = makeActor('Joe');
    const two = weaponWith(twice, { radius: 10 });
    onWeapon(twice, two.weapon, 'eruptive');
    onWeapon(twice, two.weapon, 'eruptive');
    prepare(twice);
    expect(two.effect.system.radius).toBe(40);

    // Explosive Ammo (+5) then Firestorm (x3) and Airburst (+10) - the upgrade code left 10 -> 20 -> 25 -> 75 -> 85.
    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor, { radius: 10 });
    weapon.flags = { essence20: { mutation: { blastAdd: 5, tripleNext: true, airburstNext: true } } };
    effect.system.radius = (10 + 5) * 3 + 10;
    onWeapon(actor, weapon, 'eruptive');
    prepare(actor);
    expect(effect.system.radius).toBe((2 * 10 + 5) * 3 + 10);

    // A radius the attack didn't have before the code gave it one (Explosive Ammo's 10ft blast) isn't doubled.
    const none = makeActor('Joe');
    const plain = weaponWith(none, { radius: 0 });
    plain.effect.system.radius = 10;
    onWeapon(none, plain.weapon, 'eruptive');
    prepare(none);
    expect(plain.effect.system.radius).toBe(10);
  });

  test('Swift adds Multiple Targets (2), or +1 to an existing Multiple Targets, per copy', () => {
    for (const [key, from, to, copies] of [['swift', 1, 2, 1], ['swiftPr', 3, 4, 1], ['swiftTf', null, 3, 2]]) {
      const actor = makeActor('Joe');
      const { weapon, effect } = weaponWith(actor, { numTargets: from });
      for (let i = 0; i < copies; i++) {
        onWeapon(actor, weapon, key);
      }

      prepare(actor);
      expect([key, effect.system.numTargets]).toEqual([key, to]);
    }
  });

  test('Deadly: the GI Joe printing on Sharp only; the Transformers one on any damaging effect (not Stun)', () => {
    const run = (key, damageType) => {
      const actor = makeActor('Joe');
      const { weapon, effect } = weaponWith(actor, { damageType, damageValue: 2 });
      onWeapon(actor, weapon, key);
      prepare(actor);
      return effect.system.damageValue;
    };

    expect(run('deadly', 'sharp')).toBe(3);
    expect(run('deadly', 'blunt')).toBe(2);
    expect(run('deadlyTf', 'blunt')).toBe(3);
    expect(run('deadlyTf', 'stun')).toBe(2);
    expect(run('deadlyTf', 'cover')).toBe(2);
  });

  test('Lingering: Stun and Cover last a turn longer, damage is left alone', () => {
    for (const key of ['lingering', 'lingeringTf']) {
      for (const [damageType, value] of [['stun', 2], ['cover', 2], ['sharp', 1]]) {
        const actor = makeActor('Joe');
        const { weapon, effect } = weaponWith(actor, { damageType, damageValue: 1 });
        onWeapon(actor, weapon, key);
        prepare(actor);
        expect([key, damageType, effect.system.damageValue]).toEqual([key, damageType, value]);
      }
    }
  });

  test('an upgrade on a stowed weapon changes nothing (its rules are off)', () => {
    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor, {}, { equipped: false });
    onWeapon(actor, weapon, 'scope');
    prepare(actor);
    expect(effect.system.range.value).toBe(100);
  });

  test('Chrono-Trigger: three attacks per Attack action with that weapon, each at ↓2; other weapons unchanged', () => {
    const actor = makeActor('Joe');
    const { weapon, effect } = weaponWith(actor);
    const other = weaponWith(actor);
    addPack(actor, 'chrono', { flags: { essence20: { parentId: weapon.id } }, source: 'Compendium.essence20.jump_through_time.Item.eFsOmJPMyuUHhcQD' });
    rebuildIndex(actor);

    const granted = getAttacksPerAction(actor, effect);
    expect(granted.count).toBe(3);
    expect(getAttacksPerAction(actor, other.effect).count).toBe(1);
    // The chained attacks must be made with a Chrono-Trigger weapon too.
    expect(attackMatchesFilter(granted.filter, describeAttack(actor, effect))).toBe(true);
    expect(attackMatchesFilter(granted.filter, describeAttack(actor, other.effect))).toBe(false);

    const sources = rollRules(actor, null, { item: effect }).filter(entry => entry.rule.type == 'RollModifier' && entry.answer === true);
    expect(sources.map(entry => entry.rule.downshift)).toEqual([2]);
    expect(rollRules(actor, null, { item: other.effect }).filter(entry => entry.rule.type == 'RollModifier' && entry.answer === true)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Action Perks                                 */
/* -------------------------------------------- */

const attack = (actor, weapon = null) => ({ name: 'Shot', type: 'weaponEffect', actor, parent: actor, flags: { essence20: { parentId: weapon?.id ?? null } }, system: { actionType: 'standard', classification: { style: 'projectile', skill: 'targeting' } } });

describe('action Perks', () => {
  test('Mobility makes one Sprint (or Hide) per turn a Free action, then it costs its Standard again', async () => {
    const actor = makeActor('Duke');
    addPack(actor, 'mobility');
    startCombat([actor]);

    const first = await spend(actor, 'standard', { source: 'Sprint', context: { key: 'sprint' } });
    expect(first.actionType).toBe('free');
    expect(getLedger(actor).log[0].source).toBe('Sprint (Mobility)');
    expect(getRemaining(actor).standard).toBe(1);

    // The one per turn is shared: Hide now costs its Standard too.
    const hide = await spend(actor, 'standard', { source: 'Hide', context: { key: 'hide' } });
    expect(hide.actionType).toBe('standard');
    expect(getRemaining(actor).standard).toBe(0);
  });

  test('Balance Your Enthusiasm: Curb Your Enthusiasm as a Move action, nothing else', () => {
    const actor = makeActor('Rainbow');
    addPack(actor, 'balance');
    startCombat([actor]);
    expect(getCostOptions(actor, 'standard', { kind: 'item', item: { name: 'Curb Your Enthusiasm' } }, getLedger(actor)).auto.actionType).toBe('move');
    expect(getCostOptions(actor, 'standard', { kind: 'item', item: { name: 'Pep Talk' } }, getLedger(actor)).auto).toBeNull();
  });

  test('Bullet Barrage: one attack per equipped ballistic weapon, with ballistic weapons only', () => {
    const actor = makeActor('Ironhide');
    addPack(actor, 'barrage');
    const guns = ['a', 'b', 'c'].map(name => addItem(actor, { name, type: 'weapon', system: { traits: ['ballistic'], equipped: true } }));
    addItem(actor, { name: 'stowed', type: 'weapon', system: { traits: ['ballistic'], equipped: false } });
    const blade = addItem(actor, { name: 'blade', type: 'weapon', system: { traits: [], equipped: true } });
    rebuildIndex(actor);
    expect(getAttacksPerAction(actor, attack(actor, guns[0])).count).toBe(3);
    expect(getAttacksPerAction(actor, attack(actor, blade)).count).toBe(1);
    expect(ruleAttackCounts(actor, attack(actor, guns[0]))[0].count).toBe(3);
  });

  test('Motivate spends a Standard action and gives the targeted ally one now', async () => {
    const officer = makeActor('Hawk');
    const perk = addPack(officer, 'motivate');
    const ally = makeActor('Duke');
    startCombat([officer, ally]);
    target(ally);

    const message = await runUse(perk, payWith(officer));
    expect(message).toContain('Duke');
    expect(getRemaining(officer).standard).toBe(0);
    expect(getRemaining(ally).standard).toBe(2);
  });

  test('Mobilize spends a Move action, not a Standard, and gives the ally a Move now', async () => {
    const officer = makeActor('Hawk');
    const perk = addPack(officer, 'mobilize');
    const ally = makeActor('Duke');
    startCombat([officer, ally]);
    target(ally);

    await runUse(perk, payWith(officer));
    expect(getRemaining(officer)).toMatchObject({ standard: 1, move: 0 });
    expect(getRemaining(ally).move).toBe(2);
  });

  test('Momentum gives the ally its whole turn again', async () => {
    const officer = makeActor('Hawk');
    const perk = addPack(officer, 'momentum');
    const ally = makeActor('Duke', { system: { actions: { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 3 } } } });
    startCombat([officer, ally]);
    target(ally);

    await runUse(perk, payWith(officer));
    expect(getRemaining(officer).standard).toBe(0);
    expect(getRemaining(ally)).toEqual({ standard: 2, move: 2, free: 6 });
  });

  test('an ally Perk needs an ally in the combat targeted - nothing is spent otherwise; no button outside a combat', async () => {
    const officer = makeActor('Hawk');
    const perk = addPack(officer, 'mobilize');
    const stranger = makeActor('Nobody');
    startCombat([officer]);

    expect(await runUse(perk, payWith(officer))).toContain('<strong>');
    target(officer);
    await runUse(perk, payWith(officer));
    target(stranger);
    await runUse(perk, payWith(officer));
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtSystems.NeedsAlly');
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtSystems.AllyNotInCombat');
    expect(getRemaining(officer).move).toBe(1);

    combat = null;
    expect(await runUse(perk, payWith(officer))).toBeNull();
  });

  test('Shoot, You Fools! gives every ally an attack that costs them nothing and stings on a miss', async () => {
    const baroness = makeActor('Baroness');
    const perk = addPack(baroness, 'shoot');
    const viper = makeActor('Viper');
    startCombat([baroness, viper]);

    await runUse(perk, payWith(baroness));
    expect(getRemaining(baroness).standard).toBe(0);
    const result = await consumeForItem(attack(viper));
    expect(result.bonusAttack).toBe(true);
    expect(result.psychicOnMiss).toBe(1);
    expect(getRemaining(viper).standard).toBe(1);
  });

  test('Shoot, You Fools! with nobody on its side in the combat warns and spends nothing', async () => {
    const baroness = makeActor('Baroness');
    const perk = addPack(baroness, 'shoot');
    startCombat([baroness]);

    expect(await runUse(perk, payWith(baroness))).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.RulesExtSystems.NoAllies');
    expect(getRemaining(baroness).standard).toBe(1);
  });
});

/* -------------------------------------------- */
/*  Summons and team items                       */
/* -------------------------------------------- */

describe("Spirit's Host, Hard Target, Organic Zord", () => {
  test("Spirit's Host's Use sets Smarts 3 / Social 1 once (the old granted flag counts)", async () => {
    const zord = makeActor('Zord', { type: 'zord' });
    const feature = addPack(zord, 'spirit');
    await runUse(feature, async () => true);
    expect(zord.system.essences.smarts.value).toBe(3);
    expect(zord.system.essences.social.value).toBe(1);
    expect(feature.flags.essence20.granted).toBe(true);

    zord.system.essences.smarts.value = 2;
    await runUse(feature, async () => true);
    expect(zord.system.essences.smarts.value).toBe(2);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.GrantAlready');
  });

  test("Spirit's Host: at its pilot's turn start a failed DIF 10 Persuasion lets the spirit take over (a d4 table)", async () => {
    const zord = makeActor('Zord', { type: 'zord' });
    addPack(zord, 'spirit');
    const pilot = makeActor('Jason', { system: { actors: { z: { uuid: zord.uuid, type: 'zord' } } } });
    const rollSkill = jest.fn(async () => ({ success: false, outcomes: [] }));
    pilot._dice = { rollSkill };
    rebuildIndex(zord);
    rebuildIndex(pilot);
    jest.spyOn(Math, 'random').mockReturnValue(0.6);

    await fireTriggers(pilot, 'turnStart');
    expect(rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'persuasion', dif: '10' }), pilot);
    expect(ChatMessage.create.mock.calls.at(-1)[0].content).toContain('E20.SpiritsHostAction.3');

    ChatMessage.create.mockClear();
    rollSkill.mockResolvedValue({ success: true, outcomes: [] });
    await fireTriggers(pilot, 'turnStart');
    expect(ChatMessage.create.mock.calls.map(call => call[0].content).join()).not.toContain('SpiritsHostAction');

    // The Zord's own turn does nothing.
    rollSkill.mockClear();
    await fireTriggers(zord, 'turnStart');
    expect(rollSkill).not.toHaveBeenCalled();
    Math.random.mockRestore();
  });

  test('Hard Target: +2 Health and +2 Toughness while crewing a Jet Pack, not another vehicle', () => {
    const rider = makeActor('Wild Weasel');
    addPack(rider, 'hardTarget');
    const jetPack = makeActor('Jet Pack', { type: 'vehicle', system: { actors: { r: { uuid: rider.uuid, vehicleRole: 'driver' } } } });
    jetPack.flags.essence20.personalVehicle = 'jetPack';
    prepare(rider);
    expect(rider.system.health.max).toBe(12);
    expect(rider.system.defenses.toughness.total).toBe(12);

    jetPack.flags.essence20.personalVehicle = 'ridingRig';
    rider.system.health.max = 10;
    rider.system.defenses.toughness.total = 10;
    prepare(rider);
    expect(rider.system.health.max).toBe(10);
    expect(rider.system.defenses.toughness.total).toBe(10);
  });

  test('Organic Zord: pick one of the Zords this user owns, then a Feature granted onto it', async () => {
    const ranger = makeActor('Ranger');
    const perk = addPack(ranger, 'organic');
    const mine = makeActor('Mine', { type: 'zord' });
    const theirs = makeActor('Theirs', { type: 'zord' });
    theirs.isOwner = false;
    makeActor('Not a Zord', { type: 'npc' });

    const ctx = stepContext({ actor: ranger, item: perk, rule: perk.system.rules[0] });
    const offered = [];
    ctx.askPick = async (step, options) => {
      offered.push(...options.map(option => option.label));
      return mine.uuid;
    };

    const grantCopy = jest.fn(async () => ({ name: 'Upgraded Zord' }));
    ctx.grantHelpers = { findItems: jest.fn(async () => [{ uuid: 'Compendium.f', name: 'Upgraded Zord' }]), pickOne: async () => 'Compendium.f', grantCopy };
    expect(await runSteps(perk.system.rules[0].steps, ctx)).toBe(true);
    expect(offered).toEqual(['Mine']);
    expect(ctx.grantHelpers.findItems).toHaveBeenCalledWith(expect.objectContaining({ type: 'feature' }));
    expect(grantCopy).toHaveBeenCalledWith(mine, 'Compendium.f', expect.objectContaining({ grantedBy: perk }));
  });
});

/* -------------------------------------------- */
/*  Vehicle upgrades                             */
/* -------------------------------------------- */

const vehicle = (items = []) => {
  const actor = makeActor('VAMP', { type: 'vehicle', system: {
    movement: { ground: { total: 60, base: 60 }, aerial: { total: 0, base: 0 }, swim: { total: 0, base: 0 } },
    traits: { vtol: false, shielded: false }, resistances: { fire: false, cold: false }, shieldedRating: 0,
  } });
  for (const key of items) {
    addPack(actor, key, { system: { type: 'vehicle' } });
  }

  rebuildIndex(actor);
  return actor;
};

const moved = (actor, stage, type) => ruleMovementStages(actor)(stage, type, actor.system.movement[type].total);
const chooseFirst = async () => 0;

describe('vehicle upgrades', () => {
  test('Nitrogen-Enhanced Rocket Fuel doubles Ground, Aerial and Aquatic (after gravity, before the other upgrades)', () => {
    const actor = vehicle(['nitro']);
    actor.system.movement.swim.total = 30;
    expect(moved(actor, 'afterGravity', 'ground')).toBe(120);
    expect(moved(actor, 'afterGravity', 'swim')).toBe(60);
    expect(moved(actor, 'final', 'ground')).toBeNull();
  });

  test('Afterburners: once per encounter, the picked Movement doubles for the turn; nothing out of combat', async () => {
    const actor = vehicle(['afterburners']);
    const item = actor.items.find(i => i.name == 'Afterburners');
    startCombat([actor]);

    expect(await runUse(item, async () => true, { ask: chooseFirst })).toContain('Ground');
    rebuildIndex(actor);
    expect(moved(actor, 'afterGravity', 'ground')).toBe(120);
    expect(await runUse(item, async () => true, { ask: chooseFirst })).toBeNull();

    combat.turn = 1;
    expect(moved(actor, 'afterGravity', 'ground')).toBeNull();

    // Out of combat the Use runs (and counts) but nothing doubles.
    const outside = vehicle(['afterburners']);
    combat = null;
    await runUse(outside.items.find(i => i.name == 'Afterburners'), async () => true, { ask: chooseFirst });
    expect(moved(outside, 'afterGravity', 'ground')).toBeNull();
  });

  test('Electronic Countermeasures: a Move action, once per encounter, +5 Toughness / Evasion until that turn comes round', async () => {
    const actor = vehicle(['ecm']);
    const item = actor.items.find(i => i.name == 'Electronic Countermeasures');
    startCombat([actor]);
    const pay = jest.fn(async () => true);

    await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('move');
    prepare(actor);
    expect(actor.system.defenses.toughness.total).toBe(15);
    expect(actor.system.defenses.evasion.total).toBe(15);
    expect(await runUse(item, pay)).toBeNull();

    combat.round = 2;
    combat.turn = 0;
    actor.system.defenses.toughness.total = 10;
    prepare(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
  });

  test('Evasive Handling: a Free action switches it on and off - Movement halved (round down), the evasive flag set', async () => {
    const actor = vehicle(['evasive']);
    actor.system.movement.ground.total = 45;
    const item = actor.items.find(i => i.name == 'Evasive Handling');
    const pay = jest.fn(async () => true);

    await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('free');
    expect(actor.flags.essence20.evasiveManeuversActive).toBe(true);
    expect(moved(actor, 'afterDerived', 'ground')).toBe(22);
    await runUse(item, pay);
    expect(actor.flags.essence20.evasiveManeuversActive).toBe(false);
    expect(moved(actor, 'afterDerived', 'ground')).toBeNull();
  });

  test('Flight Conversion (fixed duration): once per scene, Aerial = the better of Ground / Aquatic and VTOL, for 3 rounds', async () => {
    const actor = vehicle(['flight']);
    const item = actor.items.find(i => i.name == 'Flight Conversion');
    startCombat([actor]);
    await runUse(item, async () => true);
    prepare(actor);
    expect(moved(actor, 'derived', 'aerial')).toBe(60);
    expect(actor.system.traits.vtol).toBe(true);
    expect(await runUse(item, async () => true)).toBeNull();

    combat.round = 3;
    expect(moved(actor, 'derived', 'aerial')).toBe(60);
    combat.round = 4;
    expect(moved(actor, 'derived', 'aerial')).toBeNull();
  });

  test('Smokescreen: a Standard action, once per encounter, Cover 1 for everyone within 30ft of the vehicle, itself included', async () => {
    const actor = vehicle(['smoke']);
    const item = actor.items.find(i => i.name == 'Smokescreen');
    const near = makeActor('Near');
    const far = makeActor('Far');
    const own = { actor, center: { x: 0 } };
    actor.getActiveTokens = () => [own];
    const nearToken = { actor: near, center: { x: 25 } };
    const farToken = { actor: far, center: { x: 40 } };
    near.getActiveTokens = () => [nearToken];
    far.getActiveTokens = () => [farToken];
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: [own, nearToken, farToken] } };
    const pay = jest.fn(async () => true);

    await runUse(item, pay);
    expect(pay).toHaveBeenCalledWith('standard');
    expect([near, far, actor].map(who => who.toggleStatusEffect.mock.calls)).toEqual([[['cover', { active: true }]], [], [['cover', { active: true }]]]);
    expect(await runUse(item, pay)).toBeNull();
  });

  test('Radar Jammer / Enhanced Radar Jamming: switched on, Technology tests in range (and the vehicle\'s own) get a Snag', async () => {
    for (const [key, name, far] of [['radar', 'Radar Jammer', 60], ['enhancedRadar', 'Enhanced Radar Jamming', 6000]]) {
      worldActors.length = 0;
      const actor = vehicle([key]);
      const item = actor.items.find(i => i.name == name);
      const roller = makeActor('Hacker');
      const own = { actor, center: { x: 0 }, document: { disposition: 1 } };
      const theirs = { actor: roller, center: { x: 40 }, document: { disposition: -1 } };
      actor.getActiveTokens = () => [own];
      roller.getActiveTokens = () => [theirs];
      global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }), size: 100, distance: 5 }, tokens: { placeables: [own, theirs] }, dimensions: { size: 100, distance: 5 } };
      const snags = who => rollRules(who, null, { rolledSkill: 'technology' }).filter(entry => entry.rule.snag && entry.answer === true).length;

      expect(snags(roller)).toBe(0);
      await runUse(item, async () => true);
      rebuildIndex(actor);
      expect([key, snags(roller)]).toEqual([key, 1]);
      expect(snags(actor)).toBe(1);
      expect(rollRules(roller, null, { rolledSkill: 'alertness' }).filter(entry => entry.rule.snag && entry.answer === true)).toEqual([]);
      theirs.center.x = far;
      expect([key, snags(roller)]).toEqual([key, 0]);
      await runUse(item, async () => true);
      theirs.center.x = 40;
      expect(snags(roller)).toBe(0);
    }
  });

  test('Energy Resistant: the Element picked when it is added (an old elementChoice carries over) is resisted', async () => {
    const actor = vehicle([]);
    const item = addPack(actor, 'resistant', { flags: { essence20: { elementChoice: 'fire' } }, system: { type: 'vehicle' } });
    await linkLegacy(actor);
    expect(item.flags.essence20.rules.choices.element).toBe('fire');
    // A new copy asks; the pick is kept.
    const fresh = vehicle([]);
    const added = addPack(fresh, 'resistant', { system: { type: 'vehicle' } });
    const wait = foundry.applications.api.DialogV2.wait;
    wait.mockResolvedValueOnce('cold');
    await fireItemAdded(fresh, added);
    expect(added.flags.essence20.rules.choices.element).toBe('cold');
    prepare(actor);
    expect(actor.system.resistances.fire).toBe(true);
    expect(actor.system.resistances.cold).toBe(false);
  });

  test('Double-Barrel / Targeting System: the picked weapon (an old weaponId carries over) gains Linked / Targeting System', async () => {
    const actor = vehicle([]);
    const gun = addItem(actor, { name: 'Cannon', type: 'weapon', system: { traits: [] } });
    const other = addItem(actor, { name: 'MG', type: 'weapon', system: { traits: [] } });
    const barrel = addPack(actor, 'doubleBarrel', { flags: { essence20: { weaponId: gun.id } }, system: { type: 'vehicle' } });
    const targeting = addPack(actor, 'targeting', { system: { type: 'vehicle' } });
    await linkLegacy(actor);
    expect(barrel.flags.essence20.rules.choices.weapon).toBe(gun.id);
    const ctx = stepContext({ actor, item: targeting, rule: targeting.system.rules[0] });
    ctx.askPick = async (step, options) => options.find(option => option.label == 'MG').value;
    await runSteps(targeting.system.rules[0].steps, ctx);
    rebuildIndex(actor);
    expect(ruleWeaponTraits(actor, gun, [])).toEqual(['linked']);
    expect(ruleWeaponTraits(actor, other, [])).toEqual(['targetingSystem']);
  });

  test('Spiked: a Might or Finesse melee attack takes ↓1, or the attacker takes 1 Sharp instead', async () => {
    const actor = vehicle(['spiked']);
    const attacker = makeActor('Brawler');
    attacker.isOwner = true;
    target(actor);
    const blow = { type: 'weaponEffect', name: 'Punch', system: { classification: { style: 'melee', skill: 'might' } } };
    expect(incomingEntries(attacker, { item: blow })).toHaveLength(1);
    expect(incomingEntries(attacker, { item: { ...blow, system: { classification: { style: 'melee', skill: 'targeting' } } } })).toHaveLength(0);
    expect(incomingEntries(attacker, { item: { ...blow, system: { classification: { style: 'projectile', skill: 'might' } } } })).toHaveLength(0);

    const [entry] = incomingEntries(attacker, { item: blow });
    const kept = { shiftUp: 0, shiftDown: 0, ext: {} };
    await runApplyDialog(attacker, kept, { item: blow });
    expect(kept.shiftDown).toBe(1);

    const declined = { shiftUp: 0, shiftDown: 0, ext: { [entry.name]: '1' } };
    attacker.system.health.value = 5;
    await runApplyDialog(attacker, declined, { item: blow });
    expect(declined.shiftDown).toBe(0);
    expect(attacker.system.health.value).toBe(4);
  });

  test('Energized Plating: an adjacent attacker takes ↓2, or 1 damage of the picked Element (Electric unpicked)', async () => {
    const actor = vehicle([]);
    const plating = addPack(actor, 'plating', { system: { type: 'vehicle' } });
    const attacker = makeActor('Brawler');
    const own = { actor, center: { x: 0 }, document: { disposition: 1 } };
    const theirs = { actor: attacker, center: { x: 5 }, document: { disposition: -1 } };
    actor.getActiveTokens = () => [own];
    attacker.getActiveTokens = () => [theirs];
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }), size: 100, distance: 5 }, tokens: { placeables: [own, theirs] }, dimensions: { size: 100, distance: 5 } };
    target(actor);
    const shot = { type: 'weaponEffect', name: 'Shot', system: { classification: { style: 'projectile', skill: 'targeting' } } };

    const [entry] = incomingEntries(attacker, { item: shot });
    expect(entry.rule.label).toBe('Energized Plating');
    const kept = { shiftUp: 0, shiftDown: 0, ext: {} };
    await runApplyDialog(attacker, kept, { item: shot });
    expect(kept.shiftDown).toBe(2);

    const { applyDamage } = await import('../mechanics/combat/combat.mjs');
    expect(typeof applyDamage).toBe('function');
    plating.flags.essence20 = { rules: { choices: { element: 'fire' } } };
    rebuildIndex(actor);
    const declined = { shiftUp: 0, shiftDown: 0, ext: { [entry.name]: '1' } };
    await runApplyDialog(attacker, declined, { item: shot });
    expect(declined.shiftDown).toBe(0);
    expect(ChatMessage.create.mock.calls.map(call => call[0].content).join()).toContain('fire');

    theirs.center.x = 30;
    expect(incomingEntries(attacker, { item: shot })).toHaveLength(0);
  });

  // Book check 2026-10-06 (docs/rules-batches/book-limits.md): +2 per copy, up to 6 (Features have no advances).
  test('Shield Matrix: Shielded 2 per copy (up to 6), unless the vehicle has a rating or the trait of its own', () => {
    const zord = makeActor('Zord', { type: 'zord' });
    addPack(zord, 'matrix');
    prepare(zord);
    expect(zord.system.shieldedRating).toBe(2);
    addPack(zord, 'matrix');
    zord.system.shieldedRating = undefined;
    prepare(zord);
    expect(zord.system.shieldedRating).toBe(4);

    const own = vehicle([]);
    own.system.shieldedRating = 1;
    addPack(own, 'matrix');
    prepare(own);
    expect(own.system.shieldedRating).toBe(1);
    const shielded = vehicle([]);
    shielded.system.traits.shielded = true;
    addPack(shielded, 'matrix');
    prepare(shielded);
    expect(shielded.system.shieldedRating).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Perk-handler Perks                           */
/* -------------------------------------------- */

describe('Combiner Specialization, Blend In, Silent Running', () => {
  test('Combiner Specialization: pick Gestalt or Matched Combiner - or +1 Health when one is already held; no old picker', async () => {
    const doc = fromPack(FILES.combiner);
    expect(doc.system.hasChoice).toBe(false);
    expect(doc.system.items).toEqual({});

    const source = { name: 'Matched Combiner', toObject: () => ({ name: 'Matched Combiner', type: 'perk', system: {} }) };
    global.fromUuid = jest.fn(async () => source);
    const fresh = makeActor('Ace');
    const perk = addPack(fresh, 'combiner');
    await fireItemAdded(fresh, perk, { ask: async (step, options) => options.findIndex(option => option.label == 'Matched Combiner') });
    expect(global.fromUuid).toHaveBeenCalledWith('Compendium.essence20.enigma_of_combination.Item.ZIJnA0z3Mrp8pfbd');
    expect(fresh.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({ name: 'Matched Combiner' })]);
    expect(fresh.system.health.bonus).toBe(0);

    const held = makeActor('Ace', { items: [{ name: 'Gestalt Combiner', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.enigma_of_combination.Item.a4BfJxhUC7hAhgdZ' } } }] });
    const ask = jest.fn();
    await fireItemAdded(held, addPack(held, 'combiner'), { ask });
    expect(ask).not.toHaveBeenCalled();
    expect(held.system.health.bonus).toBe(1);
  });

  test('Blend In fits Silent and Stealth to the equipped armor (not what it already carries); Silent Running a Silencer and Suppressor to the weapon', async () => {
    const { setEntryAndAddItem } = await import('../sheet-handlers/attachment-handler.mjs');
    global.fromUuid = jest.fn(async uuid => ({ toObject: () => ({ name: uuid.split('.').pop(), type: 'upgrade', system: {} }) }));
    for (const [key, type, uuids] of [
      ['blendIn', 'armor', ['Compendium.essence20.gi_joe_crb.Item.nftZIaQ3MVn2nviU', 'Compendium.essence20.gi_joe_crb.Item.ThXrre0RHTcr1BEp']],
      ['silent', 'weapon', ['Compendium.essence20.gi_joe_crb.Item.rSP76BWjYaifJLIZ', 'Compendium.essence20.ferocious_fighters.Item.sHBEBigG2y63MSWL']],
    ]) {
      const actor = makeActor('Recon');
      addItem(actor, { name: 'Stowed', type, system: { equipped: false } });
      const worn = addItem(actor, { name: 'Battledress', type, system: { equipped: true } });
      // Already carries the first upgrade (attached before).
      addItem(actor, { name: 'Already', type: 'upgrade', flags: { core: { sourceId: uuids[0] }, essence20: { parentId: worn.id } } });
      setEntryAndAddItem.mockClear();
      await fireItemAdded(actor, addPack(actor, key));
      const created = actor.createEmbeddedDocuments.mock.calls.map(call => call[1][0]);
      expect([key, created.map(data => data.flags.core.sourceId)]).toEqual([key, [uuids[1]]]);
      expect(created[0].flags.essence20.parentId).toBe(worn.id);
      expect(setEntryAndAddItem).toHaveBeenCalledTimes(1);
    }

    // No equipped armor - nothing fitted.
    const bare = makeActor('Bare');
    await fireItemAdded(bare, addPack(bare, 'blendIn'));
    expect(bare.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
