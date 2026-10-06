import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, systems (docs/rules-batches/slSystems15.md): the Powers' own effects (powerUsed Triggers), the weapon upgrades
 * that change their weapon's own data (ItemModifier stage item), action costs and the rest of the survey's "piece"
 * items - moved from hand-written code onto item rules. Items are loaded from their pack sources and must do what the
 * old code (and its old tests) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
const onMorph = jest.fn(async () => {});
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/power-ranger-handler.mjs', () => ({ onMorph }));

await import('./plugins/index.mjs');
await import('./actions.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleMovementStages, ruleRollSources, ruleDamageType } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { firePowerUsed, ruleUseIsFree } = await import('./plugins/resources/power-used.mjs');
const { ruleNoArmor } = await import('./plugins/combat/no-armor-defense.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');
const { vetoesFor } = await import('./plugins/effects/veto.mjs');
const { getLedger } = await import('../mechanics/actions/action-economy.mjs');
const { spendDailyUse } = await import('../mechanics/resources/nanomite-uses.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  speedBoost: 'prcrbitems/_source/Speed_Boost_CDbaCheOK2rUsqli.json',
  powerShield: 'prcrbitems/_source/Power_Shield_F7QPCcXW9822L5Xs.json',
  fasterRegen: 'prcrbitems/_source/Faster_Regeneration_UsZ8twgjWJO5B3R4.json',
  boostInit: 'prcrbitems/_source/Boost_Initiative_IuQ0tsM2G99fQlSz.json',
  augmentPw: 'prcrbitems/_source/Augment_Power_Weapon_n7kXeiPmmdg55K1X.json',
  penetrating: 'prcrbitems/_source/Penetrating_Strikes_fgufss1xeV96LDcu.json',
  illuminate: 'prcrbitems/_source/Illuminate_c6Kh8WrtHYfsXZmK.json',
  powerBlast: 'prcrbitems/_source/Power_Blast_EeNQjO1VHh1SiNzy.json',
  relentless: 'prcrbitems/_source/Relentless_Blows_ypRIRuDdxgCJRSPh.json',
  voidWarrior: 'atsitems/_source/Void_Warrior_gyDCPmqswCQJYN6e.json',
  morphblast: 'jttitems/_source/Morphblast_jPTF96WV19T37AqG.json',
  futureVision: 'jttitems/_source/Future_Vision_z9ZMxCd5DZDHlDYL.json',
  rapidMorph: 'jttitems/_source/Rapid_Morph_NyO1qtj0dzZRPOSO.json',
  mobileMode: 'ttsgitems/_source/Mobile_Mode_TO3TazEeI35FUOOU.json',
  protection: 'qgtgitems/_source/Protection_IF9v9C3tCJSQYRjd.json',
  reactive: 'qgtgitems/_source/Reactive_toDyl8zb0XVvqPuj.json',
  augmented: 'qgtgitems/_source/Augmented_Combat_6Ku40JiKZCMbGMtM.json',
  jolt: 'osbitems/_source/Codename_Jolt__Augmented_Combat_Nanomite_Infusion_Q7p4Mn6NN4BL7ARl.json',
  swiftness: 'qgtgitems/_source/Swiftness_GBsBp9umblOcz7lu.json',
  repairMachine: 'qgtgitems/_source/Repair_Machine_HOM0e2W0aBYnZ8Z3.json',
  electric: 'qgtgitems/_source/Electric_Discharge_KeDQbX62owtITKDo.json',
  disintegrate: 'qgtgitems/_source/Disintegrate_mVwWAgFyNUDfoUJQ.json',
  regeneration: 'qgtgitems/_source/Regeneration_312ubjCA7mCBDoea.json',
  bolster: 'fmmcitems/_source/Bolster_Defense_HVOFIDBiXNckFaAP.json',
  luckyCharm: 'fmmcitems/_source/Lucky_Charm_Rv3Bhyeo4XBxHLpX.json',
  chronomantic: 'fmmcitems/_source/Chronomantic_Pulse_YjPFCWa3KxDIJXGW.json',
};
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = String(key).split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  // Foundry's "-=key" deletes it.
  if (last.startsWith('-=')) {
    delete parent[last.slice(2)];
  } else {
    parent[last] = value;
  }
}

let nextId = 1;
const worldActors = [];

function list(items) {
  items.get = id => items.find(item => item.id == id);
  Object.defineProperty(items, 'contents', { get: () => items, configurable: true });
  return items;
}

function makeActor(name, { type = 'playerCharacter', system = {}, token = null } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: {
      health: { value: 5, max: 10, bonus: 0, string: '' }, skills: {}, essences: { smarts: { value: 1 }, social: { value: 1 } },
      defenses: { toughness: { total: 10, string: '' }, evasion: { total: 10, string: '' }, willpower: { total: 10 }, cleverness: { total: 10 } },
      powers: { personal: { value: 3, max: 5 } },
      actions: { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 2 } },
      movement: { ground: { total: 30 }, aerial: { total: 0 }, climb: { total: 15 }, swim: { total: 15 }, burrow: { total: 0 } },
      ...system,
    },
    getActiveTokens: () => (token ? [token] : []),
    toggleStatusEffect: jest.fn(async () => true),
    rollSkill: jest.fn(),
    _dice: { rollSkill: jest.fn(async () => ({ success: true, outcomes: [{ roll: { total: 15 }, results: [{ success: true }] }] })) },
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
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = list([]);
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
    async updateEmbeddedDocuments(kind, updates) {
      for (const { _id, ...change } of updates) {
        const effect = this.effects.find(e => e.id == _id);
        Object.assign(effect ?? {}, change);
      }
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
    effects: (doc.effects ?? []).map((effect, i) => ({ id: `e${i}`, name: effect.name, disabled: !!effect.disabled, changes: clone(effect.changes ?? effect.system?.changes ?? []) })),
    flags: { ...(extra.flags ?? {}), core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } },
  });
}

const use = (actor, power, spent = 0) => firePowerUsed(actor, power, spent);
const askFirst = (index = 0) => {
  foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(String(index));
};

let combat;
beforeEach(() => {
  worldActors.length = 0;
  combat = null;
  onMorph.mockClear();
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
  global.canvas = { tokens: { setTargets: jest.fn(), placeables: [] } };
  global.CONFIG = { E20: { skillToEssence: { science: 'smarts', culture: 'smarts', technology: 'smarts' }, damageTypes: {}, actorSizes: {}, movementTypes: { aerial: 'A', burrow: 'B', climb: 'C', ground: 'G', swim: 'S' } } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuidSync = uuid => worldActors.find(actor => actor.uuid == uuid) ?? null;
  global.fromUuid = async uuid => global.fromUuidSync(uuid);
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: clone, randomID: () => `r${nextId++}`, escapeHTML: s => s },
    applications: { ...(global.foundry?.applications ?? {}), api: { ...(global.foundry?.applications?.api ?? {}), DialogV2: { wait: jest.fn(), confirm: jest.fn(), prompt: jest.fn() } } },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

// One started combat, a combatant per actor.
function startCombat(actors) {
  const flags = new Map();
  const combatants = actors.map(actor => ({
    actor, actorId: actor.id, tokenId: `t-${actor.id}`, isOwner: true, uuid: `Combat.c1.Combatant.${actor.id}`, initiative: null,
    getFlag: (scope, key) => flags.get(`${actor.id}.${key}`), setFlag: async (scope, key, value) => flags.set(`${actor.id}.${key}`, value),
    async update(data) {
      Object.assign(this, data);
    },
  }));
  combat = { id: 'c1', started: true, round: 1, turn: 0, combatants, turns: combatants, getCombatantsByActor: actor => combatants.filter(c => c.actor === actor) };
  return combatants;
}

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
/*  Powers (powerUsed Triggers)                  */
/* -------------------------------------------- */

describe('Powers: their own powerUsed rules', () => {
  test('a Trigger only answers its own Power (item:own)', async () => {
    const actor = makeActor('Ranger');
    const shield = addPack(actor, 'powerShield');
    const other = addPack(actor, 'speedBoost');
    await use(actor, other, 1);
    expect(shield.effects.every(effect => effect.disabled)).toBe(true);
  });

  test('Speed Boost switches its Ground Movement effect on and banks one Initiative Edge; a second use banks no second one', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'speedBoost');
    power.effects[0].disabled = true;
    await use(actor, power, 1);
    expect(power.effects[0].disabled).toBe(false);
    expect(actor.flags.essence20.ruleBank).toHaveLength(1);
    expect(actor.flags.essence20.ruleBank[0]).toEqual(expect.objectContaining({ edge: true }));
    await use(actor, power, 1);
    expect(actor.flags.essence20.ruleBank).toHaveLength(1);
    // The next Initiative roll gets it, an ordinary roll doesn't.
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: {} }).sources.some(s => s.edge)).toBe(false);
    expect(ruleRollSources(actor, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources.some(s => s.edge)).toBe(true);
  });

  test('Power Shield switches its effect on', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'powerShield');
    expect(power.effects[0].disabled).toBe(true);
    await use(actor, power, 1);
    expect(power.effects[0].disabled).toBe(false);
  });

  test('Faster Regeneration heals d2 up to the maximum, once per encounter', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const actor = makeActor('Ranger', { system: { health: { value: 5, max: 10 } } });
    const power = addPack(actor, 'fasterRegen');
    await use(actor, power, 1);
    expect(actor.system.health.value).toBe(7);
    await use(actor, power, 1);
    expect(actor.system.health.value).toBe(7);

    const full = makeActor('Full', { system: { health: { value: 9, max: 10 } } });
    await use(full, addPack(full, 'fasterRegen'), 1);
    expect(full.system.health.value).toBe(10);
  });

  test('Boost Initiative adds 2 per Power spent to a rolled Initiative, never without one', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'boostInit');
    const [combatant] = startCombat([actor]);
    await use(actor, power, 3);
    expect(combatant.initiative).toBeNull();
    combatant.initiative = 12.5;
    await use(actor, power, 0);
    expect(combatant.initiative).toBe(12.5);
    await use(actor, power, 3);
    expect(combatant.initiative).toBe(18.5);
  });

  test('Augment Power Weapon: ↑1 on Power Weapon attacks for 10 rounds; a second use while on does nothing', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'augmentPw');
    const weapon = addItem(actor, { name: 'Blaster', type: 'weapon', system: { traits: ['powerWeapon'], equipped: true } });
    const attack = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { skill: 'targeting' } } });
    const plain = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: true } });
    const plainShot = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: plain.id } }, system: { classification: { skill: 'targeting' } } });
    const upOn = item => ruleRollSources(actor, null, { item, rolledSkill: 'targeting', dataset: {} }).sources.reduce((n, s) => n + (Number(s.shiftUp) || 0), 0);
    expect(upOn(attack)).toBe(0);
    startCombat([actor]);
    await use(actor, power, 1);
    expect(power.flags.essence20.rules.toggleUntil.on.until).toBe('rounds:10');
    expect(upOn(attack)).toBe(1);
    expect(upOn(plainShot)).toBe(0);
    ChatMessage.create.mockClear();
    await use(actor, power, 1);
    expect(ChatMessage.create).not.toHaveBeenCalled();
    combat.round = 11;
    expect(upOn(attack)).toBe(0);
  });

  test('Penetrating Strikes: Martial Arts attacks ignore armor (the Defense recomputed) while on', async () => {
    const actor = makeActor('Ranger');
    const foe = makeActor('Putty');
    const power = addPack(actor, 'penetrating');
    const weapon = addItem(actor, { name: 'Fists', type: 'weapon', system: { traits: ['martialArts'], equipped: true } });
    const strike = addItem(actor, { name: 'Strike', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: {} });
    const sword = addItem(actor, { name: 'Sword', type: 'weapon', system: { traits: [], equipped: true } });
    const slash = addItem(actor, { name: 'Slash', type: 'weaponEffect', flags: { essence20: { parentId: sword.id } }, system: {} });
    expect(ruleNoArmor(actor, foe, 'toughness', { item: strike })).toBe(false);
    await use(actor, power, 1);
    expect(ruleNoArmor(actor, foe, 'toughness', { item: strike })).toBe(true);
    expect(ruleNoArmor(actor, foe, 'evasion', { item: strike })).toBe(true);
    expect(ruleNoArmor(actor, foe, 'toughness', { item: slash })).toBe(false);
  });

  test('Illuminate: Martial Arts attacks deal Energy damage while on', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'illuminate');
    const weapon = addItem(actor, { name: 'Fists', type: 'weapon', system: { traits: ['martialArts'], equipped: true } });
    const strike = addItem(actor, { name: 'Strike', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: {} });
    expect(ruleDamageType(actor, null, { item: strike })).toBeNull();
    await use(actor, power, 1);
    expect(ruleDamageType(actor, null, { item: strike })).toBe('energy');
  });

  test('Void Warrior: Void damage on any attack and no Personal Power regained, for the scene', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'voidWarrior');
    const attack = addItem(actor, { name: 'Punch', type: 'weaponEffect', system: {} });
    await use(actor, power, 1);
    expect(ruleDamageType(actor, null, { item: attack })).toBe('void');
    const veto = vetoesFor(actor, 'update').find(entry => entry.item === power);
    expect(veto.rule).toEqual(expect.objectContaining({ path: 'system.powers.personal.value', change: 'up', clamp: true }));
    expect(power.flags.essence20.rules.toggleUntil.on.until).toBe('scene');
  });

  test('Power Blast rolls Athletics against Evasion for 1 Energy damage per Power spent; nothing with none spent', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'powerBlast');
    await use(actor, power, 0);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    await use(actor, power, 3);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith({
      skill: 'athletics', essence: 'strength', defenseType: 'evasion', stepDamage: { value: 3, type: 'element' },
    }, actor);
  });

  test('Morphblast targets every enemy within 5 ft, then rolls Athletics against Evasion for 1 Energy damage', async () => {
    const actor = makeActor('Ranger', { token: { id: 'tr', document: { disposition: 1 }, center: { x: 0, y: 0 } } });
    const power = addPack(actor, 'morphblast');
    await use(actor, power, 1);
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith([]);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith({
      skill: 'athletics', essence: 'strength', shiftUp: 0, shiftDown: 0, defenseType: 'evasion', stepDamage: { value: 1, type: 'element' },
    }, actor);
  });

  test('Electric Discharge (↑1, Electric) and Disintegrate (a vehicle only, Acid)', async () => {
    const actor = makeActor('Joe');
    await use(actor, addPack(actor, 'electric'));
    expect(actor._dice.rollSkill).toHaveBeenLastCalledWith({
      skill: 'targeting', essence: 'speed', shiftUp: 1, shiftDown: 0, defenseType: 'evasion', stepDamage: { value: 1, type: 'electric' },
    }, actor);

    const other = makeActor('Joe 2');
    const power = addPack(other, 'disintegrate');
    await use(other, power);
    expect(other._dice.rollSkill).not.toHaveBeenCalled();
    target(makeActor('Cobra'));
    await use(other, power);
    expect(other._dice.rollSkill).not.toHaveBeenCalled();
    target(makeActor('HISS', { type: 'vehicle' }));
    await use(other, power);
    expect(other._dice.rollSkill).toHaveBeenCalledWith({
      skill: 'targeting', essence: 'speed', shiftUp: 0, shiftDown: 0, defenseType: 'toughness', stepDamage: { value: 1, type: 'acid' },
    }, other);
  });

  test('Future Vision turns its reroll on with one use per Power spent', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'futureVision');
    await use(actor, power, 0);
    expect(power.system.reroll.enabled).toBe(false);
    await use(actor, power, 3);
    expect(power.system.reroll).toEqual(expect.objectContaining({ enabled: true, maxUses: 3 }));
  });

  test('Lucky Charm rolls DIF 12 Performance and turns its reroll on only on a success', async () => {
    const actor = makeActor('Finster');
    const power = addPack(actor, 'luckyCharm');
    actor._dice.rollSkill.mockResolvedValueOnce({ success: false, outcomes: [] });
    await use(actor, power);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith({ skill: 'performance', essence: 'social', shiftUp: 0, shiftDown: 0, dif: '12' }, actor);
    expect(power.system.reroll.enabled).toBe(false);
    await use(actor, power);
    expect(power.system.reroll.enabled).toBe(true);
  });

  test('Rapid Morph Morphs through the sheet\'s Morph flow as a Free action; nothing while already Morphed', async () => {
    const actor = makeActor('Ranger', { system: { isMorphed: false } });
    const power = addPack(actor, 'rapidMorph');
    await use(actor, power, 1);
    expect(onMorph).toHaveBeenCalledWith(actor, { free: true });
    onMorph.mockClear();
    actor.system.isMorphed = true;
    await use(actor, power, 1);
    expect(onMorph).not.toHaveBeenCalled();
  });

  test('Mobile Mode: the picked Movement type is at least 30 ft while Morphed, for the scene', async () => {
    const actor = makeActor('Ranger', { system: { isMorphed: true } });
    const power = addPack(actor, 'mobileMode');
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('climb');
    await use(actor, power, 1);
    expect(power.flags.essence20.rules.choices.type).toBe('climb');
    const stage = ruleMovementStages(actor);
    expect(stage('final', 'climb', 15)).toBe(30);
    expect(stage('final', 'climb', 40)).toBe(40);
    expect(stage('final', 'aerial', 0)).toBeNull();
    actor.system.isMorphed = false;
    expect(ruleMovementStages(actor)('final', 'climb', 15)).toBeNull();
  });

  test('Protection / Reactive: the boost adds +1 to that Defense against attacks; switching it off spends no daily use', async () => {
    for (const [key, defense, other] of [['protection', 'toughness', 'evasion'], ['reactive', 'evasion', 'toughness']]) {
      const actor = makeActor('Joe');
      const power = addPack(actor, key);
      const attacker = makeActor('Cobra');
      expect(lateDefenseAdjust(attacker, actor, defense)).toBe(0);
      expect(ruleUseIsFree(actor, power)).toBe(false);
      await use(actor, power);
      expect([key, lateDefenseAdjust(attacker, actor, defense), lateDefenseAdjust(attacker, actor, other)]).toEqual([key, 1, 0]);
      expect(ruleUseIsFree(actor, power)).toBe(true);
      power.system.usesSpent = 2;
      expect(await spendDailyUse(actor, power)).toBe(true);
      expect(power.system.usesSpent).toBe(2);
      await use(actor, power);
      expect(lateDefenseAdjust(attacker, actor, defense)).toBe(0);
      expect(await spendDailyUse(actor, power)).toBe(false);
    }
  });

  test('Augmented Combat and Codename Jolt: each its own switch, ↑1 on every attack while either is on (not ↑2 with both)', async () => {
    const actor = makeActor('Joe');
    const augmented = addPack(actor, 'augmented');
    const jolt = addPack(actor, 'jolt');
    const attack = addItem(actor, { name: 'Shot', type: 'weaponEffect', system: {} });
    const up = () => ruleRollSources(actor, null, { item: attack, rolledSkill: 'targeting', dataset: {} }).sources.reduce((n, s) => n + (Number(s.shiftUp) || 0), 0);
    expect(up()).toBe(0);
    await use(actor, jolt);
    expect(up()).toBe(1);
    expect(augmented.flags.essence20?.rules?.toggles?.on).toBeUndefined();
    await use(actor, augmented);
    expect(up()).toBe(1);
    await use(actor, jolt);
    await use(actor, augmented);
    expect(up()).toBe(0);
  });

  test('Swiftness: +20 ft to the chosen Ground or Aerial; the same choice again switches it off, the other one moves it', async () => {
    const actor = makeActor('Joe');
    const power = addPack(actor, 'swiftness');
    const feet = (type, base) => ruleMovementStages(actor)('final', type, base) ?? base;
    askFirst(1);
    await use(actor, power);
    expect([feet('ground', 30), feet('aerial', 0)]).toEqual([30, 20]);
    askFirst(0);
    await use(actor, power);
    expect([feet('ground', 30), feet('aerial', 0)]).toEqual([50, 0]);
    askFirst(0);
    await use(actor, power);
    expect([feet('ground', 30), feet('aerial', 0)]).toEqual([30, 0]);
  });

  test('Repair Machine banks one Edge for the next Technology test', async () => {
    const actor = makeActor('Joe');
    const power = addPack(actor, 'repairMachine');
    await use(actor, power);
    await use(actor, power);
    expect(actor.flags.essence20.ruleBank).toHaveLength(1);
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics', dataset: {} }).sources.some(s => s.edge)).toBe(false);
    expect(ruleRollSources(actor, null, { rolledSkill: 'technology', dataset: {} }).sources.some(s => s.edge)).toBe(true);
  });

  test('Regeneration: heal 1 at once (up to the maximum), or a Science test with Edge (DIF 5 + 5 per Health) healing on a success', async () => {
    const actor = makeActor('Joe', { system: { health: { value: 9, max: 10 } } });
    const power = addPack(actor, 'regeneration');
    askFirst(0);
    await use(actor, power);
    expect(actor.system.health.value).toBe(10);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();

    const ally = makeActor('Duke', { system: { health: { value: 0, max: 10 } } });
    ally.statuses.add('defeated');
    target(ally);
    askFirst(1);
    foundry.applications.api.DialogV2.prompt.mockResolvedValueOnce(3);
    await use(actor, power);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'science', essence: 'smarts', dif: '20', edge: true }), actor);
    expect(ally.system.health.value).toBe(3);

    // Cancelling the mode or the amount does nothing.
    actor._dice.rollSkill.mockClear();
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(null);
    await use(actor, power);
    askFirst(1);
    foundry.applications.api.DialogV2.prompt.mockResolvedValueOnce(null);
    await use(actor, power);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test('Bolster Defense: DIF 12 Culture; on a success the target (or the caster) gets +2 to one Defense or +1 to all, the new bonus replacing the old', async () => {
    const caster = makeActor('Finster');
    const power = addPack(caster, 'bolster');
    const ally = makeActor('Goldar');
    const attacker = makeActor('Ranger');
    target(ally);
    askFirst(0);
    await use(caster, power);
    expect(caster._dice.rollSkill).toHaveBeenCalledWith({ skill: 'culture', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12' }, caster);
    expect([lateDefenseAdjust(attacker, ally, 'toughness'), lateDefenseAdjust(attacker, ally, 'evasion')]).toEqual([2, 0]);
    askFirst(4);
    await use(caster, power);
    expect([lateDefenseAdjust(attacker, ally, 'toughness'), lateDefenseAdjust(attacker, ally, 'willpower')]).toEqual([1, 1]);

    // Nothing targeted: the caster itself.
    target();
    askFirst(1);
    await use(caster, power);
    expect([lateDefenseAdjust(attacker, caster, 'evasion'), lateDefenseAdjust(attacker, caster, 'toughness')]).toEqual([2, 0]);

    // A failed roll gives nothing.
    const other = makeActor('Rita');
    target(other);
    caster._dice.rollSkill.mockResolvedValueOnce({ success: false, outcomes: [] });
    askFirst(0);
    await use(caster, power);
    expect(lateDefenseAdjust(attacker, other, 'toughness')).toBe(0);
  });

  test('Chronomantic Pulse: a willing creature (yourself, or a token on your side) moves at once; an unwilling one only on a DIF 12 Culture success', async () => {
    const caster = makeActor('Finster', { token: { document: { disposition: -1 } } });
    const friend = makeActor('Goldar', { token: { document: { disposition: -1 } } });
    const foe = makeActor('Ranger', { token: { document: { disposition: 1 } } });
    const power = addPack(caster, 'chronomantic');
    const [mine, theirs, enemy] = startCombat([caster, friend, foe]);
    const ask = value => foundry.applications.api.DialogV2.prompt.mockResolvedValueOnce(value);

    ask('');
    await use(caster, power);
    expect(mine.initiative).toBeNull();

    ask('3');
    await use(caster, power);
    expect(mine.initiative).toBe(3);
    target(friend);
    ask('12.5');
    await use(caster, power);
    expect(theirs.initiative).toBe(12.5);
    expect(caster._dice.rollSkill).not.toHaveBeenCalled();

    target(foe);
    ask('1');
    caster._dice.rollSkill.mockResolvedValueOnce({ success: false, outcomes: [] });
    await use(caster, power);
    expect(enemy.initiative).toBeNull();
    ask('1');
    await use(caster, power);
    expect(caster._dice.rollSkill).toHaveBeenLastCalledWith({ skill: 'culture', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12' }, caster);
    expect(enemy.initiative).toBe(1);
  });

  test('Relentless Blows: two unarmed bonus attacks at no cost, in a combat only', async () => {
    const actor = makeActor('Ranger');
    const power = addPack(actor, 'relentless');
    await use(actor, power, 1);
    startCombat([actor]);
    await use(actor, power, 1);
    expect(getLedger(actor).bonusAttacks).toEqual([
      { source: 'Relentless Blows', cost: 'none', filter: { unarmed: true }, psychicOnMiss: 0 },
      { source: 'Relentless Blows', cost: 'none', filter: { unarmed: true }, psychicOnMiss: 0 },
    ]);
  });
});

/* -------------------------------------------- */
/*  Upgrades that change their weapon            */
/* -------------------------------------------- */

describe('upgrades that change their weapon (ItemModifier stage item)', () => {
  const UP = {
    refined: 'gijcrbitems/_source/Refined_Grip_nXYQmK90hnReB1H0.json',
    reinforced: 'tfcrbitems/_source/Reinforced_Grip_fqdebwmS3b1Y0G48.json',
    automated: 'prcrbitems/_source/Automated_1VeCvn1hnWoaNN9E.json',
    balanced: 'gijcrbitems/_source/Balanced_Grip_7xyCdYAorscGuwBT.json',
    biomech: 'fffav1items/_source/Biomechanical_Weapon_7qniIaOGp8Mqwt6O.json',
    extended: 'gijcrbitems/_source/Extended_2nAPVgXfIfUEnn33.json',
    sprayer: 'ccitems/_source/Chemical_Sprayer_PeOeKaDjkhtUWk10.json',
    pwe: 'prcrbitems/_source/Power_Weapon_Element_Damage_Assignment_3J1qb2gaDMWxkBOF.json',
    microtech: 'gijcrbitems/_source/Microtech_Weapon_ihSql0Px1kNgTBfP.json',
    bullpup: 'iafav2items/_source/Bullpup_IU2HkMiwC8hYKQdj.json',
    pill: 'ccitems/_source/Pill_Form_lYMLqH3adOzo8Nmd.json',
    salve: 'ccitems/_source/Salve_Form_JJ1KynH9FfYeOG7N.json',
    mist: 'ccitems/_source/Mist_Form_UcdxOhIviGmJe3aJ.json',
    ram: 'qgtgitems/_source/Robust_Ram_c3vKS59Bynt41oTk.json',
    wings: 'qgtgitems/_source/Slashing_Wings_nAiUe1uZs6VzqtQY.json',
    harness: 'fffav1items/_source/Hyperkinetic_Support_Harness_O4IT5jCPRBqGkXGr.json',
  };
  let applyToEffect;
  let applyToWeapon;
  beforeAll(async () => {
    ({ applyToEffect, applyToWeapon } = await import('../items/attacks/weapon-upgrades.mjs'));
  });

  test('every upgrade\'s rules validate', () => {
    for (const file of Object.values(UP)) {
      for (const rule of fromPack(file).system.rules ?? []) {
        expect([file, rule.label, validateRule(rule)]).toEqual([file, rule.label, []]);
      }
    }
  });

  const fit = (actor, key, host = null, extra = {}) => {
    const doc = fromPack(UP[key]);
    return addItem(actor, {
      name: doc.name, type: doc.type, system: clone(doc.system), ...extra,
      flags: { ...(extra.flags ?? {}), core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags?.essence20 ?? {}), ...(host ? { parentId: host.id } : {}) } },
    });
  };

  const arm = (actor, effect = {}, weapon = {}) => {
    const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: true, classification: { size: 'long' }, ...weapon } });
    const base = { damageType: 'sharp', damageValue: 1, range: { value: 100, long: 400, reachMultiplier: null }, radius: 0, shiftDown: 0, secondaryDamage: { type: null, value: 0 }, classification: { skill: 'targeting', style: 'projectile' }, ...effect };
    const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: clone(base), _source: { system: clone(base) } });
    return { rifle, shot };
  };

  const prepare = shot => {
    shot.system = clone(shot._source.system);
    applyToEffect(shot.system, shot);
    return shot.system;
  };

  test('the grips, Automated and Biomechanical Weapon swap the attack\'s Skill; the strongest one wins', () => {
    const actor = makeActor('Joe');
    const { rifle, shot } = arm(actor);
    const other = arm(actor);
    fit(actor, 'balanced', rifle);
    expect(prepare(shot).classification.skill).toBe('athletics');
    expect(shot.system.upgradeTouched).toContain('classification.skill');
    expect(prepare(other.shot).classification.skill).toBe('targeting');
    fit(actor, 'refined', rifle);
    expect(prepare(shot).classification.skill).toBe('finesse');
    fit(actor, 'reinforced', rifle);
    expect(prepare(shot).classification.skill).toBe('might');
    fit(actor, 'automated', rifle);
    fit(actor, 'refined', other.rifle);
    expect([prepare(shot).classification.skill, prepare(other.shot).classification.skill]).toEqual(['technology', 'finesse']);
    // Biomechanical: its picked Skill beats them all, and ↓1 either way.
    const biomech = fit(actor, 'biomech', rifle);
    expect(prepare(shot)).toEqual(expect.objectContaining({ shiftDown: 1, classification: expect.objectContaining({ skill: 'technology' }) }));
    biomech.flags.essence20.rules = { choices: { skill: 'survival' } };
    expect(prepare(shot)).toEqual(expect.objectContaining({ shiftDown: 1, classification: expect.objectContaining({ skill: 'survival' }) }));
  });

  test('Biomechanical Weapon asks for its Skill when it\'s attached (an old pick is kept)', async () => {
    const actor = makeActor('Joe');
    const { rifle } = arm(actor);
    const upgrade = fit(actor, 'biomech', rifle);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('science');
    const { fireItemAdded } = await import('./triggers.mjs');
    await fireItemAdded(actor, upgrade);
    expect(upgrade.flags.essence20.rules.choices.skill).toBe('science');

    // One attached before (its pick in the old flag): the GM's start-up linking pass moves it into the rule's choice.
    const old = fit(actor, 'biomech', rifle, { flags: { essence20: { skillChoice: 'animalHandling' } } });
    const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
    for (const { _id, ...update } of legacyChoiceUpdates(actor)) {
      await actor.items.get(_id).update(update);
    }

    expect(old.flags.essence20.rules.choices.skill).toBe('animalHandling');
  });

  test('Extended adds 1 to a Reach attack\'s Reach multiplier, per copy, and leaves a ranged attack alone', () => {
    const actor = makeActor('Joe');
    const { rifle, shot } = arm(actor, { range: { value: null, long: null, reachMultiplier: null }, classification: { style: 'melee', skill: 'might' } });
    fit(actor, 'extended', rifle);
    expect(prepare(shot).range.reachMultiplier).toBe(2);
    fit(actor, 'extended', rifle);
    expect(prepare(shot).range.reachMultiplier).toBe(3);

    const doubled = arm(actor, { range: { value: 10, long: null, reachMultiplier: 2 } });
    fit(actor, 'extended', doubled.rifle);
    expect(prepare(doubled.shot).range.reachMultiplier).toBe(3);
    const ranged = arm(actor);
    fit(actor, 'extended', ranged.rifle);
    expect(prepare(ranged.shot).range.reachMultiplier).toBeNull();
  });

  test('Chemical Sprayer makes the attack a 15 ft cone before a blast change reads it', () => {
    const actor = makeActor('Joe');
    const { rifle, shot } = arm(actor, { damageType: 'poison' });
    fit(actor, 'sprayer', rifle);
    expect(prepare(shot)).toEqual(expect.objectContaining({ shape: 'cone', radius: 15 }));
    // Explosive Ammo's blast only goes on an attack with no blast of its own.
    rifle.flags.essence20 = { mutation: { blastSet: 10 } };
    expect(prepare(shot).radius).toBe(15);
  });

  test('Power Weapon Element Damage Assignment: the Ranger\'s colour picks the Energy damage\'s type; Pink doubles it', () => {
    const cases = [['Black Ranger', 'psychic', 2], ['Blue Ranger', 'cold', 2], ['Green Ranger', 'poison', 2], ['Pink Ranger', 'energy', 4], ['Red Ranger', 'fire', 2], ['Yellow Ranger', 'stun', 2], ['Gold Ranger', 'energy', 2]];
    for (const [role, type, value] of cases) {
      const actor = makeActor('Ranger');
      addItem(actor, { name: role, type: 'role', system: {} });
      const { rifle, shot } = arm(actor, { damageType: 'energy', damageValue: 2 });
      fit(actor, 'pwe', rifle);
      expect([role, prepare(shot).damageType, shot.system.damageValue]).toEqual([role, type, value]);
    }

    // Not Energy damage: nothing.
    const actor = makeActor('Ranger');
    addItem(actor, { name: 'Red Ranger', type: 'role', system: {} });
    const { rifle, shot } = arm(actor);
    fit(actor, 'pwe', rifle);
    expect(prepare(shot).damageType).toBe('sharp');
  });

  test('Robust Ram / Slashing Wings: +1 Sharp on a Sharp Ram / Flyby, else a Sharp rider (or +1 to one)', () => {
    for (const [key, flag] of [['ram', 'isRam'], ['wings', 'isFlyby']]) {
      const vehicle = makeActor('APC', { type: 'vehicle' });
      fit(vehicle, key);
      const attack = (system) => {
        const base = { damageValue: 2, secondaryDamage: { type: null, value: 0 }, ...system };
        return addItem(vehicle, { name: 'Ram', type: 'weaponEffect', system: clone(base), _source: { system: clone(base) } });
      };

      const sharp = attack({ [flag]: true, damageType: 'sharp' });
      const blunt = attack({ [flag]: true, damageType: 'blunt' });
      const rider = attack({ [flag]: true, damageType: 'blunt', secondaryDamage: { type: 'sharp', value: 1 } });
      const shot = attack({ damageType: 'blunt' });
      expect(prepare(sharp).damageValue).toBe(3);
      expect(prepare(blunt).secondaryDamage).toEqual({ type: 'sharp', value: 1 });
      expect(prepare(rider).secondaryDamage).toEqual({ type: 'sharp', value: 2 });
      expect(prepare(shot)).toEqual(expect.objectContaining({ damageValue: 2, secondaryDamage: { type: null, value: 0 } }));
    }
  });

  test('Microtech Weapon and Bullpup: one size smaller per copy, and the hands of the new size; the Harness wields two-handed in one', () => {
    CONFIG.E20.weaponSizeHands = { integrated: 0, sidearm: 1, medium: 2, long: 2, heavy: 2 };
    const actor = makeActor('Joe');
    const weapon = system => addItem(actor, { name: 'Gun', type: 'weapon', system: { traits: [], equipped: true, hands: null, effectiveSize: 'long', derivedHands: 2, ...system } });
    const rifle = weapon();
    fit(actor, 'microtech', rifle);
    fit(actor, 'microtech', rifle);
    applyToWeapon(rifle);
    expect([rifle.system.effectiveSize, rifle.system.derivedHands]).toEqual(['sidearm', 1]);
    expect(rifle.system.upgradeTouched).toContain('effectiveSize');

    const pinned = weapon({ hands: 2 });
    fit(actor, 'bullpup', pinned);
    applyToWeapon(pinned);
    expect([pinned.system.effectiveSize, pinned.system.derivedHands]).toEqual(['medium', 2]);

    const smallest = weapon({ effectiveSize: 'integrated', derivedHands: 0 });
    fit(actor, 'bullpup', smallest);
    applyToWeapon(smallest);
    expect(smallest.system.effectiveSize).toBe('integrated');

    // The Harness (an armor upgrade, while that armor is worn).
    const heavy = makeActor('Duke');
    const cannon = addItem(heavy, { name: 'Cannon', type: 'weapon', system: { traits: [], equipped: true, effectiveSize: 'heavy', derivedHands: 2 } });
    const vest = addItem(heavy, { name: 'Vest', type: 'armor', system: { equipped: true } });
    fit(heavy, 'harness', vest);
    applyToWeapon(cannon);
    expect(cannon.system.derivedHands).toBe(1);
  });

  test('Pill, Salve and Mist Form set how the poison is applied (Pill over Salve over Mist); not on a non-poison', () => {
    for (const [keys, form] of [[['pill'], 'ingested'], [['salve'], 'contact'], [['mist'], 'inhaled'], [['mist', 'pill', 'salve'], 'ingested'], [['mist', 'salve'], 'contact']]) {
      const actor = makeActor('Cobra');
      const vial = addItem(actor, { name: 'Vial', type: 'weapon', system: { traits: [], equipped: true, isPoison: true, poisonApplication: { contact: false, ingested: false, inhaled: false } } });
      for (const key of keys) {
        fit(actor, key, vial);
      }

      applyToWeapon(vial);
      expect([keys, vial.system.poisonApplication]).toEqual([keys, { contact: form == 'contact', ingested: form == 'ingested', inhaled: form == 'inhaled' }]);
      expect(vial.system.upgradeTouched).toEqual(expect.arrayContaining(['poisonApplication.contact', 'poisonApplication.ingested', 'poisonApplication.inhaled']));
    }

    const actor = makeActor('Cobra');
    const knife = addItem(actor, { name: 'Knife', type: 'weapon', system: { traits: [], equipped: true, isPoison: false } });
    fit(actor, 'pill', knife);
    applyToWeapon(knife);
    expect(knife.system.poisonApplication).toBeUndefined();
  });

  test('the actor\'s own derived pass leaves stage item rules alone', () => {
    const actor = makeActor('Joe');
    const { rifle, shot } = arm(actor);
    fit(actor, 'refined', rifle);
    prepare(shot);
    shot.system.classification.skill = 'targeting';
    ruleDerived(actor);
    expect(shot.system.classification.skill).toBe('targeting');
  });
});

/* -------------------------------------------- */
/*  Action costs                                 */
/* -------------------------------------------- */

describe('action costs: ActionCost action any / to downgrade / freeIsUnlimited / scope marked', () => {
  const MLP = 'mlpcrbitems/_source/';
  const TALENTS = {
    kindness: `${MLP}A_Talent_For_Kindness_SKviFM3gryyTrJV5.json`,
    generosity: `${MLP}A_Talent_For_Generosity_W4zuPnXnGsb0EE91.json`,
    honesty: `${MLP}A_Talent_For_Honesty_adqw9O68ByBpwNwQ.json`,
    laughter: `${MLP}A_Talent_For_Laughter_rcaZoNtniTFDklY3.json`,
    loyalty: `${MLP}A_Talent_for_Loyalty_KB7usfPNxRUGRk5S.json`,
    magic: `${MLP}A_Talent_for_Magic_0POa5TuUxinLfFBn.json`,
    talented: `${MLP}Talented_UGFiK8wMXQ8fhXbT.json`,
    harmony: `${MLP}Harmony_Unleashed_2Xfo11o9Qb2P7s3M.json`,
  };
  let getCostOptions;
  let spend;
  let runUse;
  beforeAll(async () => {
    ({ getCostOptions } = await import('../mechanics/actions/action-perks.mjs'));
    ({ spend } = await import('../mechanics/actions/action-economy.mjs'));
    ({ runUse } = await import('./triggers.mjs'));
  });

  const give = (actor, key) => {
    const doc = fromPack(TALENTS[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  test('every rule validates', () => {
    for (const file of Object.values(TALENTS)) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('A Talent: a related action costs one step less, asked; once per turn, a related Free action costs nothing every time', async () => {
    for (const key of ['kindness', 'generosity', 'honesty', 'laughter', 'loyalty', 'magic']) {
      const actor = makeActor('Pony');
      give(actor, key);
      startCombat([actor]);
      foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('offer0');
      expect((await spend(actor, 'standard', { context: { kind: 'item' } })).actionType).toBe('move');
      expect(getCostOptions(actor, 'standard', { kind: 'item' }, getLedger(actor)).offers).toHaveLength(0);
      expect(getCostOptions(actor, 'move', { key: 'useASkill' }, getLedger(actor)).offers).toHaveLength(0);
      const free = getCostOptions(actor, 'free', { kind: 'item' }, getLedger(actor)).offers;
      expect([key, free[0]?.actionType, free[0]?.question]).toEqual([key, 'none', expect.stringMatching(/^E20\.ActionPerkAsk/)]);
    }
  });

  test('Talented: once per scene; choosing the normal cost keeps it for later', async () => {
    const actor = makeActor('Pony');
    give(actor, 'talented');
    startCombat([actor]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('base');
    expect((await spend(actor, 'standard', { context: { key: 'useASkill' } })).actionType).toBe('standard');
    expect(getCostOptions(actor, 'standard', { key: 'useASkill' }, getLedger(actor)).offers).toHaveLength(1);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('offer0');
    expect((await spend(actor, 'move', { context: { key: 'useASkill' } })).actionType).toBe('free');
  });

  test('closing the cost question takes no action at all; with the questions switched off nothing is offered', async () => {
    const actor = makeActor('Pony');
    give(actor, 'kindness');
    startCombat([actor]);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(null);
    const result = await spend(actor, 'contingency', { context: { key: 'contingency' } });
    expect(result).toEqual(expect.objectContaining({ blocked: true, cancelled: true }));
    expect(getLedger(actor).log ?? []).toHaveLength(0);

    const quiet = game.settings.get;
    game.settings.get = (scope, key) => (key == 'actionPerkPrompts' ? false : quiet(scope, key));
    expect(getCostOptions(actor, 'standard', { kind: 'item' }, getLedger(actor)).offers).toHaveLength(0);
  });

  test('Harmony Unleashed: the targeted pony (or the caster) has its Cutie Mark actions cost Free actions for 3 rounds', async () => {
    const caster = makeActor('Twilight');
    const spell = give(caster, 'harmony');
    const pony = makeActor('Applejack');
    // No combat: no Use.
    expect(await runUse(spell, async () => true)).toBeNull();

    startCombat([caster, pony]);
    target(pony);
    await runUse(spell, async () => true);
    const offered = actor => getCostOptions(actor, 'standard', { kind: 'item' }, getLedger(actor)).offers.map(o => o.actionType);
    expect(offered(pony)).toEqual(['free']);
    expect(offered(caster)).toEqual([]);
    combat.round = 3;
    expect(offered(pony)).toEqual(['free']);
    combat.round = 4;
    expect(offered(pony)).toEqual([]);

    // Nothing targeted: the caster.
    combat.round = 1;
    target();
    await runUse(spell, async () => true);
    expect(offered(caster)).toEqual(['free']);
  });
});

describe('action costs: the personalShield / rouse / analyzeTarget / vehicleRepair kinds', () => {
  const FILES2 = {
    quickShield: 'gijcrbitems/_source/Quick_Shield_bCUlka9kCmkyKwAC.json',
    rousing: 'gijcrbitems/_source/Rousing_Presence_tF2Gl0OOl2ZgFkZV.json',
    quickStudy: 'tfcrbitems/_source/Quick_Study_l3PjztNqfgYgLtVg.json',
    swiftStudy: 'tfcrbitems/_source/Swift_Study_k9vTsANvhJ6jWAC8.json',
    quickFix: 'iafav2items/_source/Quick_Fix_QbFchvvKkIKRjIVl.json',
  };
  let spend;
  beforeAll(async () => {
    ({ spend } = await import('../mechanics/actions/action-economy.mjs'));
  });

  const give = (actor, key) => {
    const doc = fromPack(FILES2[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  test('each costs less for its own kind of action only', async () => {
    for (const [key, kind, to] of [['quickShield', 'personalShield', 'free'], ['rousing', 'rouse', 'move'], ['quickStudy', 'analyzeTarget', 'move'], ['swiftStudy', 'analyzeTarget', 'free'], ['quickFix', 'vehicleRepair', 'free']]) {
      const actor = makeActor('Joe');
      give(actor, key);
      startCombat([actor]);
      expect([key, (await spend(actor, 'standard', { context: { kind } })).actionType]).toEqual([key, to]);
      expect([key, (await spend(actor, 'standard', { context: { kind: 'item' } })).actionType]).toEqual([key, 'standard']);
    }
  });

  test('Quick Fix once per turn; Swift Study as often as wanted', async () => {
    const actor = makeActor('Joe');
    give(actor, 'quickFix');
    give(actor, 'swiftStudy');
    startCombat([actor]);
    const types = [];
    for (let i = 0; i < 2; i++) {
      types.push((await spend(actor, 'standard', { context: { kind: 'vehicleRepair' } })).actionType);
    }

    expect(types).toEqual(['free', 'standard']);
    expect((await spend(actor, 'standard', { context: { kind: 'analyzeTarget' } })).actionType).toBe('free');
    expect((await spend(actor, 'standard', { context: { kind: 'analyzeTarget' } })).actionType).toBe('free');
  });
});

describe('Powers: Power Heal and Repair Zord', () => {
  const HEALS = {
    powerHeal: 'prcrbitems/_source/Power_Heal_eiTUR08GXw03M21m.json',
    repairZord: 'prcrbitems/_source/Repair_Zord_9S0fkRqxjfiOJ8ip.json',
  };
  const give = (actor, key) => {
    const doc = fromPack(HEALS[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  test('rules validate', () => {
    for (const file of Object.values(HEALS)) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Power Heal: the targeted ally regains 1 Health per Power spent, up to the maximum; nothing with none spent', async () => {
    const actor = makeActor('Ranger');
    const power = give(actor, 'powerHeal');
    const ally = makeActor('Billy', { system: { health: { value: 2, max: 10 } } });
    target(ally);
    await use(actor, power, 0);
    expect(ally.system.health.value).toBe(2);
    await use(actor, power, 3);
    expect(ally.system.health.value).toBe(5);
    await use(actor, power, 9);
    expect(ally.system.health.value).toBe(10);
  });

  test('Repair Zord: the driven Zord heals d2 per 2 Power; on a combined Megazord one more Power, the d2s shared among its Zords', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const pilot = makeActor('Jason');
    const power = give(pilot, 'repairZord');
    const zord = makeActor('Tyrannosaurus', { type: 'zord', system: { health: { value: 2, max: 20 }, actors: { a: { uuid: pilot.uuid, vehicleRole: 'driver' } } } });
    await use(pilot, power, 1);
    expect(zord.system.health.value).toBe(2);
    await use(pilot, power, 4);
    expect(zord.system.health.value).toBe(6);

    // Not driving: nothing.
    const walker = makeActor('Kim');
    await use(walker, give(walker, 'repairZord'), 4);

    // Combined into a Megazord (not a Combiner form): (Power - 1) / 2 d2s, shared, at least 1 each.
    const other = makeActor('Mastodon', { type: 'zord', system: { health: { value: 1, max: 20 } } });
    makeActor('Megazord', { type: 'megaform', system: { subtype: 'megaformZord', actors: { z1: { uuid: zord.uuid }, z2: { uuid: other.uuid } } } });
    await use(pilot, power, 2);
    expect([zord.system.health.value, other.system.health.value]).toEqual([6, 1]);
    await use(pilot, power, 5);
    expect([zord.system.health.value, other.system.health.value]).toEqual([8, 3]);
  });
});

describe('crit upgrades: CriticalOption essence / defense', () => {
  let ruleCriticalOptions;
  beforeAll(async () => {
    ({ ruleCriticalOptions } = await import('./adapter.mjs'));
  });

  const CRITS = [
    ['gijcrbitems/_source/Bewildering_5T8ZrImJXHWqETnf.json', { essence: 'social' }],
    ['prcrbitems/_source/Bewildering_5T8ZrImJXHWqETnf.json', { essence: 'social' }],
    ['tfcrbitems/_source/Bewildering_5T8ZrImJXHWqETnf.json', { defense: 'cleverness' }],
    ['gijcrbitems/_source/Traumatic_zXPxC1yLlK2xgGEl.json', { essence: 'smarts' }],
    ['tfcrbitems/_source/Traumatic_zXPxC1yLlK2xgGEl.json', { defense: 'willpower' }],
    ['gijcrbitems/_source/Maiming_6bg86Fau84u1m9Vg.json', { essence: 'speed' }],
    ['tfcrbitems/_source/Maiming_6bg86Fau84u1m9Vg.json', { defense: 'evasion' }],
    ['gijcrbitems/_source/Surgical_rJqjZK5eL6TUZMmF.json', { essence: 'strength' }],
    ['tfcrbitems/_source/Surgical_rJqjZK5eL6TUZMmF.json', { defense: 'toughness' }],
  ];

  test('each printing offers 1 damage to its Essence (G.I. Joe, Power Rangers) or Defense (Transformers) on its own weapon\'s attacks', () => {
    for (const [file, damage] of CRITS) {
      const actor = makeActor('Joe');
      const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: true } });
      const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} });
      const other = addItem(actor, { name: 'Pistol', type: 'weapon', system: { traits: [], equipped: true } });
      const plain = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: other.id } }, system: {} });
      const doc = fromPack(file);
      for (const rule of doc.system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }

      addItem(actor, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { parentId: rifle.id } } });
      const { options } = ruleCriticalOptions(actor, null, shot);
      expect([file, options]).toEqual([file, [expect.objectContaining({ label: doc.name, damageValue: 1, damageType: 'special', ...damage })]]);
      expect(ruleCriticalOptions(actor, null, plain).options).toEqual([]);
    }
  });
});

describe('picks that leave out what is held: pickGrant notOwned / selectionLimit', () => {
  const GRANTS = {
    torozord: 'ttsgitems/_source/Torozord_Feature_xvd1sVIqu0sNEI1c.json',
    basal: 'qgtgitems/_source/Basal_Nano_Infusion_CUhsxOCugyHcEIRx.json',
    intricate: 'qgtgitems/_source/Intricate_Nano_Infusion_bbA0ayzoaeW6G6R5.json',
    profound: 'qgtgitems/_source/Profound_Nano_Infusion_su1NVWhDH3Zk7ma5.json',
  };
  const ENTRIES = [
    { uuid: 'C.rm', name: 'Repair Machine', type: 'power', system: { type: 'nanomite', availability: 'limited' } },
    { uuid: 'C.pr', name: 'Protection', type: 'power', system: { type: 'nanomite', availability: 'limited' } },
    { uuid: 'C.rp', name: 'Reprogrammable', type: 'power', system: { type: 'nanomite', availability: 'standard', selectionLimit: 10 } },
    { uuid: 'C.cw', name: 'Create Weapon', type: 'power', system: { type: 'nanomite', availability: 'standard' } },
    { uuid: 'C.sw', name: 'Swiftness', type: 'power', system: { type: 'nanomite', availability: 'restricted' } },
    { uuid: 'C.mb', name: 'Morph Boost', type: 'power', system: { type: 'grid', availability: 'limited' } },
    { uuid: 'C.mz', name: 'Martial Zord', type: 'feature', system: {} },
    { uuid: 'C.hg', name: 'High Gear', type: 'feature', system: {} },
  ];
  const run = async (actor, key) => {
    const doc = fromPack(GRANTS[key]);
    const item = addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: {} });
    const [rule] = doc.system.rules;
    const offered = [];
    const granted = [];
    const ctx = stepContext({ actor, item, rule });
    ctx.grantHelpers = {
      findItems: async ({ type, availabilities, matches }) => ENTRIES.filter(entry => entry.type == type
        && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry))),
      pickOne: async (title, rows) => {
        offered.push(...rows.map(row => row.name));
        return rows[0]?.uuid ?? null;
      },
      grantCopy: async (to, uuid) => {
        granted.push([to.name, uuid]);
        return { name: uuid };
      },
    };
    await runSteps(rule.steps, ctx);
    return { offered, granted, doc };
  };

  test('rules validate; the Nano Infusions no longer open the old choice', () => {
    for (const file of Object.values(GRANTS)) {
      const doc = fromPack(file);
      for (const rule of doc.system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }

      expect([file, doc.system.hasChoice ?? false, Object.keys(doc.system.items ?? {})]).toEqual([file, false, []]);
    }
  });

  test('a Nano Infusion offers the nanomite Powers of its Availability, less those held (unless they may be taken again)', async () => {
    const actor = makeActor('Joe');
    expect((await run(actor, 'intricate')).offered).toEqual(['Repair Machine', 'Protection']);
    expect((await run(actor, 'profound')).offered).toEqual(['Swiftness']);
    addItem(actor, { name: 'Create Weapon', type: 'power', system: {}, flags: { core: { sourceId: 'C.cw' } } });
    addItem(actor, { name: 'Reprogrammable', type: 'power', system: {}, _stats: { compendiumSource: 'C.rp' }, flags: {} });
    const basal = await run(actor, 'basal');
    expect(basal.offered).toEqual(['Reprogrammable']);
    expect(basal.granted).toEqual([['Joe', 'C.rp']]);
  });

  test('Torozord Feature: a Zord Feature the Ranger\'s Zord doesn\'t hold, given to that Zord; no Zord - nothing', async () => {
    const lonely = makeActor('Mike');
    expect((await run(lonely, 'torozord')).offered).toEqual([]);

    const zord = makeActor('Torozord', { type: 'zord' });
    addItem(zord, { name: 'Martial Zord', type: 'feature', system: {}, flags: { core: { sourceId: 'C.mz' } } });
    const ranger = makeActor('Magna Defender', { system: { actors: { a: { uuid: zord.uuid, type: 'zord' } } } });
    const { offered, granted } = await run(ranger, 'torozord');
    expect(offered).toEqual(['High Gear']);
    expect(granted).toEqual([['Torozord', 'C.hg']]);
  });
});

describe('Laughtracting / Distraughter: grantNextTurn block', () => {
  const LAUGH = {
    laughtracting: 'mlpcrbitems/_source/Laughtracting_lXIAufB3PnE5a6P8.json',
    distraughter: 'mlpcrbitems/_source/Distraughter_HjbUGlyY8T9T4ZpH.json',
  };
  const give = (actor, key) => {
    const doc = fromPack(LAUGH[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  test('rules validate', () => {
    for (const file of Object.values(LAUGH)) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('a Standard action Performance roll against the targets\' Willpower; each one beaten loses its Free actions next turn (and its Move with Distraughter)', async () => {
    const { runUse, fireTriggers } = await import('./triggers.mjs');
    const pony = makeActor('Pinkie');
    const perk = give(pony, 'laughtracting');
    const foe = makeActor('Discord');
    const other = makeActor('Tirek');
    startCombat([pony, foe, other]);
    const paid = [];
    const pay = async action => paid.push(action) > 0;

    // Nothing targeted: nothing rolled, nothing paid.
    await runUse(perk, pay);
    expect(pony._dice.rollSkill).not.toHaveBeenCalled();
    expect(paid).toEqual([]);

    target(foe);
    await runUse(perk, pay);
    expect(paid).toEqual(['standard']);
    expect(pony._dice.rollSkill).toHaveBeenCalledWith({
      skill: 'performance', essence: 'social', shiftUp: 0, shiftDown: 0, defenseType: 'willpower', isLaughtracting: true,
    }, pony);

    // The roll's hits (rules/triggers.mjs's post-roll hit Triggers).
    const hit = to => fireTriggers(pony, 'hit', { roll: { dataset: { isLaughtracting: true } }, outcome: 'success', targets: [to] });
    await hit(foe);
    expect(getLedger(foe).next.block).toEqual({ free: true });
    give(pony, 'distraughter');
    await hit(other);
    expect(getLedger(other).next.block).toEqual({ free: true, move: true });
    // Another roll's hit: nothing.
    const third = makeActor('Chrysalis');
    startCombat([pony, third]);
    await fireTriggers(pony, 'hit', { roll: { dataset: {} }, outcome: 'success', targets: [third] });
    expect(getLedger(third).next ?? null).toBeNull();
  });
});

describe('action costs that read the turn\'s ledger: self:actionLog, @ledger', () => {
  const LEDGER = {
    hereToHelp: 'iafav2items/_source/Here_To_Help_tnkEUHbDaXUaSPME.json',
    desperate: 'mlpcrbitems/_source/Desperate_Times_tfRFV2g3gkug0l2a.json',
    snapShots: 'gijcrbitems/_source/Snap_Shots_HP7gDs3IaxZ8ud2a.json',
    groundAndPound: 'ghpfitems/_source/Ground_and_Pound_2qdpoSqrOeBhWF1C.json',
  };
  let spend;
  let consumeForItem;
  beforeAll(async () => {
    const economy = await import('../mechanics/actions/action-economy.mjs');
    ({ spend, consumeForItem } = economy);
    const { lazy } = await import('./plugins/shared/lazy-helpers-and-targets.mjs');
    lazy.getLedger = economy.getLedger;
  });

  const give = (actor, key) => {
    const doc = fromPack(LEDGER[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  const attack = (actor, weaponSystem = null, system = {}) => {
    const weapon = weaponSystem ? addItem(actor, { name: 'Gun', type: 'weapon', system: { traits: [], equipped: true, ...weaponSystem } }) : null;
    const effect = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: weapon ? { parentId: weapon.id } : {} }, system: { actionType: 'standard', classification: { style: 'melee', skill: 'might' }, ...system } });
    effect.actor = actor;
    return effect;
  };

  test('rules validate', () => {
    for (const file of Object.values(LEDGER)) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Here To Help: this turn\'s first Lend Assistance is Free, the second a Move, then Standard', async () => {
    const actor = makeActor('Duke');
    give(actor, 'hereToHelp');
    startCombat([actor]);
    actor.system.actions = { enabled: true, standard: { max: 3 }, move: { max: 3 }, free: { max: 3 } };
    const types = [];
    for (let i = 0; i < 3; i++) {
      types.push((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType);
    }

    expect(types).toEqual(['free', 'move', 'standard']);
  });

  test('Desperate Times: a Move action for Lend Assistance only after a Standard one this turn', async () => {
    const actor = makeActor('Pony');
    give(actor, 'desperate');
    startCombat([actor]);
    expect((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType).toBe('standard');
    expect((await spend(actor, 'standard', { context: { key: 'lendAssistance' } })).actionType).toBe('move');
  });

  test('Snap Shots: after an attack with a pistol (or a thrown Finesse weapon), another such attack may cost two Free actions, once a turn', async () => {
    const actor = makeActor('Duke');
    give(actor, 'snapShots');
    actor.system.actions = { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 4 } };
    startCombat([actor]);
    const pistol = attack(actor, { classification: { size: 'sidearm' } }, { classification: { style: 'ranged', skill: 'targeting' } });
    const rifle = attack(actor, { classification: { size: 'long' } }, { classification: { style: 'ranged', skill: 'targeting' } });
    expect((await consumeForItem(pistol)).actionType).toBe('standard');
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('offer0');
    expect((await consumeForItem(pistol)).actionType).toBe('twoFree');
    // Once per turn; never for a rifle.
    expect((await consumeForItem(rifle)).actionType).toBe('standard');

    const knifer = makeActor('Storm Shadow');
    give(knifer, 'snapShots');
    knifer.system.actions = { enabled: true, standard: { max: 2 }, move: { max: 1 }, free: { max: 4 } };
    startCombat([knifer]);
    const knife = attack(knifer, { traits: ['thrown'], classification: { size: 'sidearm' } }, { classification: { style: 'ranged', skill: 'finesse' } });
    await consumeForItem(knife);
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce('offer0');
    expect((await consumeForItem(knife)).actionType).toBe('twoFree');
  });

  test('Ground and Pound: a Standard action with a target; you go Prone and this turn\'s Unarmed attacks are Free, each ↓1 per earlier one', async () => {
    const { runUse } = await import('./triggers.mjs');
    const actor = makeActor('Roadblock');
    const perk = give(actor, 'groundAndPound');
    actor.system.actions = { enabled: true, standard: { max: 1 }, move: { max: 1 }, free: { max: 4 } };
    startCombat([actor]);
    const paid = [];
    await runUse(perk, async action => paid.push(action) > 0);
    expect(paid).toEqual([]);
    const viper = makeActor('Viper');
    target(viper);
    await runUse(perk, async action => paid.push(action) > 0);
    expect(paid).toEqual(['standard']);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });

    const punch = attack(actor);
    // Book check (effects): the ↓ is on the attacks against the boxed-in target only.
    const down = (other = viper) => ruleRollSources(actor, other, { item: punch, rolledSkill: 'might', dataset: {} }).sources.reduce((n, s) => n + (Number(s.shiftDown) || 0), 0);
    expect((await consumeForItem(punch)).actionType).toBe('free');
    expect(down()).toBe(0);
    expect((await consumeForItem(punch)).actionType).toBe('free');
    expect(getLedger(actor).perkUses.groundAndPound).toBe(2);
    expect(down()).toBe(1);
    expect(down(makeActor('Bystander'))).toBe(0);
    // An armed attack isn't one of them; the next turn it's over.
    const armed = attack(actor, { traits: [] });
    expect((await consumeForItem(armed)).actionType).toBe('standard');
    combat.turn = 1;
    expect(ruleRollSources(actor, viper, { item: punch, rolledSkill: 'might', dataset: {} }).sources).toEqual([]);
  });
});

describe('Here, Let Me / No, I Insist (Assist nextTurnGrant), New Plan, Barrage Attack', () => {
  const MISC = {
    hereLetMe: 'mlpcrbitems/_source/Here__Let_Me_PldYR4nBQ9zwjBVJ.json',
    noIInsist: 'mlpcrbitems/_source/No__I_Insist_yWrCHyJFxQelBJQR.json',
    newPlan: 'tfcrbitems/_source/New_Plan_E7Vgx6US6PgS63pe.json',
    barrage: 'ttsgitems/_source/Barrage_Attack_oq4wQuilR0aHwxso.json',
  };
  const give = (actor, key) => {
    const doc = fromPack(MISC[key]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  beforeAll(async () => {
    const economy = await import('../mechanics/actions/action-economy.mjs');
    const { lazy } = await import('./plugins/shared/lazy-helpers-and-targets.mjs');
    lazy.getLedger = economy.getLedger;
  });

  test('rules validate', () => {
    for (const file of Object.values(MISC)) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('Here, Let Me / No, I Insist: Lend Assistance may give an extra Move / Standard action on the friend\'s next turn instead', async () => {
    const { ruleAssistGrantModes } = await import('./plugins/rolls/assist-next-turn.mjs');
    const actor = makeActor('Applejack');
    expect(ruleAssistGrantModes(actor)).toEqual([]);
    give(actor, 'hereLetMe');
    give(actor, 'noIInsist');
    expect(ruleAssistGrantModes(actor).map(mode => [mode.label, mode.grant])).toEqual([
      ['E20.LendAssistanceModeNextMove', { move: 1 }], ['E20.LendAssistanceModeNextStandard', { standard: 1 }],
    ]);
  });

  test('New Plan: only after a turn that ended on a Contingency, once a turn - another Move action or two Free actions now', async () => {
    const { runUse } = await import('./triggers.mjs');
    const { getRemaining } = await import('../mechanics/actions/action-economy.mjs');
    const actor = makeActor('Optimus');
    const perk = give(actor, 'newPlan');
    const [combatant] = startCombat([actor]);
    await runUse(perk, async () => true);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    await combatant.setFlag('essence20', 'actions', { ...getLedger(actor), lastTurnContingency: true });
    const before = getRemaining(actor).move;
    askFirst(0);
    await runUse(perk, async () => true);
    expect(getRemaining(actor).move).toBe(before + 1);
    await runUse(perk, async () => true);
    expect(getRemaining(actor).move).toBe(before + 1);
  });

  test('Barrage Attack: 1 Personal Power, once a turn, a free ranged attack per other ranged weapon', async () => {
    const { runUse } = await import('./triggers.mjs');
    const zord = makeActor('Zord', { type: 'zord', system: { powers: { personal: { value: 2, max: 5 } } } });
    const feature = give(zord, 'barrage');
    for (const name of ['Cannon', 'Missiles', 'Laser']) {
      const weapon = addItem(zord, { name, type: 'weapon', system: { traits: [], equipped: true } });
      addItem(zord, { name: `${name} shot`, type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { style: 'ranged' } } });
    }

    addItem(zord, { name: 'Stomp', type: 'weaponEffect', system: { classification: { style: 'melee' } } });
    startCombat([zord]);
    await runUse(feature, async () => true);
    expect(zord.system.powers.personal.value).toBe(1);
    expect(getLedger(zord).bonusAttacks).toHaveLength(2);
    expect(getLedger(zord).bonusAttacks[0]).toEqual(expect.objectContaining({ cost: 'none', filter: { ranged: true } }));
    await runUse(feature, async () => true);
    expect(zord.system.powers.personal.value).toBe(1);
  });
});

describe('Hydraulic Bounce: check:vehicleInRoughTerrain', () => {
  test('Edge on its crew\'s (and its own) Driving tests while the vehicle\'s token is in Rough Terrain', async () => {
    const { vehicleChecks } = await import('./plugins/tags/vehicle-checks.mjs');
    const doc = fromPack('qgtgitems/_source/Hydraulic_Bounce_0yRAH39SEINP3CGT.json');
    for (const rule of doc.system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }

    let rough = false;
    const token = { document: { id: 'tok' } };
    vehicleChecks.isInRoughTerrain = tokenDoc => tokenDoc === token.document && rough;
    const driver = makeActor('Clutch');
    const vehicle = makeActor('VAMP', { type: 'vehicle', token, system: { actors: { a: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    vehicleChecks.getCrewedVehicle = actor => (actor === driver ? { vehicle, role: 'driver' } : null);
    addItem(vehicle, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    rebuildIndex(driver);
    const edge = (actor, skill) => ruleRollSources(actor, null, { rolledSkill: skill, dataset: {} }).sources.some(source => source.edge && source.label == 'Hydraulic Bounce');
    expect(edge(driver, 'driving')).toBe(false);
    rough = true;
    expect([edge(driver, 'driving'), edge(driver, 'athletics'), edge(vehicle, 'driving')]).toEqual([true, false, true]);
    expect(edge(makeActor('Walker'), 'driving')).toBe(false);
  });
});

describe('Smart Scope / Thermal Scope: Cover giveBack, Smart Scope\'s ranges', () => {
  const SCOPES = [
    'gijcrbitems/_source/Smart_Scope_3IbTYGc8LOp1IAHc.json', 'prcrbitems/_source/Smart_Scope_3IbTYGc8LOp1IAHc.json',
    'tfcrbitems/_source/Smart_Scope_3IbTYGc8LOp1IAHc.json', 'gijcrbitems/_source/Thermal_Scope_j9UxxlSMLRUcwGVk.json',
    'tfcrbitems/_source/Thermal_Scope_j9UxxlSMLRUcwGVk.json',
  ];
  let applyToEffect;
  let ruleCover;
  beforeAll(async () => {
    ({ applyToEffect } = await import('../items/attacks/weapon-upgrades.mjs'));
    ({ ruleCover } = await import('./adapter.mjs'));
  });

  const scoped = (file, range = { value: 100, long: 400 }) => {
    const actor = makeActor('Joe');
    const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: true } });
    const base = { damageType: 'sharp', damageValue: 1, range, radius: 0, classification: { skill: 'targeting', style: 'ranged' } };
    const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: clone(base), _source: { system: clone(base) } });
    const other = addItem(actor, { name: 'Pistol', type: 'weapon', system: { traits: [], equipped: true } });
    const plain = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: other.id } }, system: clone(base), _source: { system: clone(base) } });
    const doc = fromPack(file);
    addItem(actor, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { parentId: rifle.id } } });
    return { actor, shot, plain };
  };

  test('rules validate', () => {
    for (const file of SCOPES) {
      for (const rule of fromPack(file).system.rules) {
        expect([file, validateRule(rule)]).toEqual([file, []]);
      }
    }
  });

  test('each scope hands the Cover penalty back on its own weapon\'s attacks only', () => {
    for (const file of SCOPES) {
      const { actor, shot, plain } = scoped(file);
      expect([file, ruleCover(actor, makeActor('Cobra'), { item: shot, isAttack: true }).giveBack]).toEqual([file, true]);
      expect(ruleCover(actor, makeActor('Cobra'), { item: plain, isAttack: true }).giveBack).toBeUndefined();
    }
  });

  test('Smart Scope: range x1.5 (rounded up) and long range x2, only on an attack that has a range', () => {
    for (const file of SCOPES.slice(0, 3)) {
      const { shot, plain } = scoped(file, { value: 25, long: 100 });
      applyToEffect(shot.system, shot);
      applyToEffect(plain.system, plain);
      expect([file, shot.system.range, plain.system.range]).toEqual([file, { value: 38, long: 200 }, { value: 25, long: 100 }]);
      expect(shot.system.upgradeTouched).toEqual(expect.arrayContaining(['range.value', 'range.long']));
    }

    const melee = scoped(SCOPES[0], { value: null, long: null });
    applyToEffect(melee.shot.system, melee.shot);
    expect(melee.shot.system.range).toEqual({ value: null, long: null });
    const noLong = scoped(SCOPES[0], { value: 30, long: null });
    applyToEffect(noLong.shot.system, noLong.shot);
    expect(noLong.shot.system.range).toEqual({ value: 45, long: null });
  });
});

describe('rules that count on a stowed weapon (always: true): Sling, Integrated Bipod', () => {
  test('Sling: drawing a (medium) weapon may cost a Free action - offered while the weapon it\'s on is stowed', async () => {
    const { getCostOptions } = await import('../mechanics/actions/action-perks.mjs');
    const doc = fromPack('gijcrbitems/_source/Sling_oIo9wLE4jZZYfqEv.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const actor = makeActor('Duke');
    const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { traits: [], equipped: false } });
    addItem(actor, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { parentId: rifle.id } } });
    startCombat([actor]);
    const { offers } = getCostOptions(actor, 'move', { key: 'drawWeapon' }, getLedger(actor));
    expect(offers.map(offer => [offer.actionType, offer.label, offer.question])).toEqual([['free', 'Sling', 'E20.ActionPerkAskMediumWeapon']]);
    expect(getCostOptions(actor, 'move', { key: 'sprint' }, getLedger(actor)).offers).toEqual([]);
  });

  test('Integrated Bipod: Brace lasts until moved, the bipod\'s weapon stowed or not; other upgrades on a stowed weapon stay off', async () => {
    const { ruleBraceUntilMoved } = await import('./plugins/combat/brace-until-moved.mjs');
    const doc = fromPack('qgtgitems/_source/Integrated_Bipod_dD0We78dzfsH98Bw.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const actor = makeActor('Roadblock');
    expect(ruleBraceUntilMoved(actor)).toBe(false);
    const gun = addItem(actor, { name: 'M2', type: 'weapon', system: { traits: [], equipped: false } });
    addItem(actor, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { parentId: gun.id } } });
    expect(ruleBraceUntilMoved(actor)).toBe(true);

    const grip = fromPack('gijcrbitems/_source/Refined_Grip_nXYQmK90hnReB1H0.json');
    const upgrade = addItem(actor, { name: grip.name, type: 'upgrade', system: clone(grip.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${grip._id}` }, essence20: { parentId: gun.id } } });
    expect((await import('./index.mjs')).rulesOfType(actor, 'ItemModifier').some(entry => entry.item === upgrade)).toBe(false);
  });
});

describe('Armor Shells: refreshMorphedToughness on added / removed', () => {
  const SHELLS = {
    heavy: 'prcrbitems/_source/Heavy_Armor_Shell_XVrOmc94bK9G9F5P.json',
    medium: 'prcrbitems/_source/Medium_Armor_Shell_d4AKhKlDbkQqGwOu.json',
    ultra: 'prcrbitems/_source/Ultra_Heavy_Armor_Shell_xBeEe7X1MBoo4cYW.json',
  };

  test('the Morphed Toughness bonus follows the Armor Training once the Shell arrives, and once it goes (re-prepared without it)', async () => {
    const { fireItemAdded } = await import('./triggers.mjs');
    CONFIG.E20.morphedToughness = { light: 1, medium: 2, heavy: 4, ultraHeavy: 6 };
    for (const [key, trained, after, morphed] of [['heavy', { medium: true, heavy: true }, { medium: true }, [4, 2]], ['ultra', { medium: true, heavy: true, ultraHeavy: true }, { medium: true, heavy: true }, [6, 4]], ['medium', { light: true, medium: true }, { light: true }, [2, 1]]]) {
      const doc = fromPack(SHELLS[key]);
      for (const rule of doc.system.rules) {
        expect(validateRule(rule)).toEqual([]);
      }

      const actor = makeActor('Ranger', { system: { trained: { armors: { ...trained } } } });
      // reset() re-prepares the actor - here, the training it has without the Shell.
      actor.reset = jest.fn(() => {
        if (!actor.items.includes(shell)) {
          actor.system.trained.armors = { ...after };
        }
      });
      const shell = addItem(actor, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
      await fireItemAdded(actor, shell);
      expect([key, actor.system.defenses.toughness.morphed, actor.system.canSetToughnessBonus]).toEqual([key, morphed[0], true]);
      actor.items.splice(actor.items.indexOf(shell), 1);
      rebuildIndex(actor);
      await fireItemAdded(actor, shell, { event: 'removed' });
      expect([key, actor.system.defenses.toughness.morphed]).toEqual([key, morphed[1]]);
    }
  });
});

describe('vehicle armors: DamageReduction on the applied card (damage:style / damage:elementOrEnergy)', () => {
  test('APS zeroes an Explosive hit once a mission; Slat and Reactive take 1 once an encounter; Reactive skips Element / Energy', async () => {
    const { damageReduction } = await import('./plugins/combat/damage-reduction.mjs');
    const { setLastApplyForTest } = await import('../mechanics/combat/reaction-engine.mjs');
    const ARMORS = ['qgtgitems/_source/Active_Protection_System_EGDb07CgIhbgdQHY.json', 'qgtgitems/_source/Slat_Armor_oNhv37mjkiWdKhu2.json', 'qgtgitems/_source/Reactive_Armor_LPjz7QL1SVYYFaT1.json'];
    const vehicle = makeActor('APC', { type: 'vehicle' });
    for (const file of ARMORS) {
      const doc = fromPack(file);
      expect(validateRule(doc.system.rules[0])).toEqual([]);
      addItem(vehicle, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    }

    const cards = new Map();
    const savedMessages = game.messages;
    game.messages = { get: id => cards.get(id) };
    const apply = (id, flags) => {
      cards.set(id, { flags: { essence20: flags } });
      setLastApplyForTest({ at: Date.now(), messageId: id, targetUuid: vehicle.uuid });
    };

    try {
      apply('m1', { attackStyle: 'explosive', attackTraits: [] });
      expect(await damageReduction(vehicle, 3, 'blunt')).toBe(0);
      apply('m2', { attackStyle: 'explosive', attackTraits: [] });
      expect(await damageReduction(vehicle, 3, 'blunt')).toBe(1);
      apply('m3', { attackStyle: 'projectile', attackTraits: [] });
      expect(await damageReduction(vehicle, 3, 'sharp')).toBe(3);

      const fresh = makeActor('Jeep', { type: 'vehicle' });
      const reactive = fromPack(ARMORS[2]);
      addItem(fresh, { name: reactive.name, type: 'upgrade', system: clone(reactive.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${reactive._id}` } } });
      cards.set('m4', { flags: { essence20: { attackStyle: 'projectile', attackTraits: ['laser'] } } });
      setLastApplyForTest({ at: Date.now(), messageId: 'm4', targetUuid: fresh.uuid });
      expect(await damageReduction(fresh, 3, 'sharp')).toBe(3);
      expect(await damageReduction(fresh, 3, 'fire')).toBe(3);
      cards.set('m5', { flags: { essence20: { attackStyle: 'melee', attackTraits: [] } } });
      setLastApplyForTest({ at: Date.now(), messageId: 'm5', targetUuid: fresh.uuid });
      expect(await damageReduction(fresh, 3, 'sharp')).toBe(2);
    } finally {
      game.messages = savedMessages;
      setLastApplyForTest(null);
    }
  });
});

describe('a vehicle\'s rules on its occupants: Kill Counter (DieSubstitution crew), Tinted Canopy (crewIncoming), Nameplate', () => {
  const VEHICLE_ITEMS = {
    killCounter: 'qgtgitems/_source/Kill_Counter_Uie11vx8RiWMoj4X.json',
    nameplate: 'qgtgitems/_source/Nameplate_8VWSF76KXdk2qGpb.json',
    canopy: 'qgtgitems/_source/Tinted_Canopy_pmYFN0fUHFIg8u48.json',
  };
  const crewed = (key, crew) => {
    const doc = fromPack(VEHICLE_ITEMS[key]);
    for (const rule of doc.system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }

    const vehicle = makeActor('VAMP', { type: 'vehicle', system: { actors: Object.fromEntries(crew.map((actor, i) => [`c${i}`, { uuid: actor.uuid, vehicleRole: i ? 'passenger' : 'driver' }])) } });
    const item = addItem(vehicle, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    crew.forEach(actor => rebuildIndex(actor));
    return { vehicle, item };
  };

  test('Kill Counter: a crew member\'s Intimidation uses their Driving die when that is better', async () => {
    const { ruleDieSubstitution } = await import('./adapter.mjs');
    CONFIG.E20.skillShiftList = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2'];
    const driver = makeActor('Clutch', { system: { skills: { intimidation: { shift: 'd4' }, driving: { shift: 'd8' } } } });
    const walker = makeActor('Duke', { system: { skills: { intimidation: { shift: 'd4' }, driving: { shift: 'd8' } } } });
    crewed('killCounter', [driver]);
    expect(ruleDieSubstitution(driver, null, { rolledSkill: 'intimidation' }, 'd4').shift).toBe('d8');
    expect(ruleDieSubstitution(driver, null, { rolledSkill: 'intimidation' }, 'd10').shift).toBe('d10');
    expect(ruleDieSubstitution(driver, null, { rolledSkill: 'persuasion' }, 'd4').shift).toBe('d4');
    expect(ruleDieSubstitution(walker, null, { rolledSkill: 'intimidation' }, 'd4').shift).toBe('d4');
  });

  test('Tinted Canopy: Laser attacks at someone aboard take a Snag; not other attacks, not the vehicle itself', async () => {
    const { crewIncomingSources } = await import('./plugins/combat/crew-incoming.mjs');
    const passenger = makeActor('Scarlett');
    const { vehicle } = crewed('canopy', [makeActor('Clutch'), passenger]);
    const shooter = makeActor('Cobra Trooper');
    const laser = { type: 'weaponEffect', system: { damageType: 'sharp', traits: ['laser'] } };
    const blaster = { type: 'weaponEffect', system: { damageType: 'laser', traits: [] } };
    const bullet = { type: 'weaponEffect', system: { damageType: 'sharp', traits: [] } };
    const snag = (target, item) => crewIncomingSources(shooter, target, { item }).sources.map(s => [s.label, s.snag]);
    expect(snag(passenger, laser)).toEqual([['Tinted Canopy', true]]);
    expect(snag(passenger, blaster)).toEqual([['Tinted Canopy', true]]);
    expect(snag(passenger, bullet)).toEqual([]);
    expect(snag(vehicle, laser)).toEqual([]);
    expect(snag(makeActor('Duke'), laser)).toEqual([]);
  });

  test('Nameplate: its Use readies +1 on the next test aboard (crew or the vehicle), used up by that roll; once a rest', async () => {
    const { runUse } = await import('./triggers.mjs');
    const { resetDailyVehicleUses } = await import('../mechanics/vehicles/vehicle-upgrades.mjs');
    const driver = makeActor('Clutch');
    const { vehicle, item } = crewed('nameplate', [driver]);
    global.fromUuid = async uuid => worldActors.find(actor => actor.uuid == uuid) ?? null;
    const up = actor => ruleRollSources(actor, null, { rolledSkill: 'driving', dataset: {} });
    expect(up(driver).sources).toEqual([]);
    await runUse(item, async () => true);
    expect(up(driver).sources.map(s => [s.label, s.shiftUp])).toEqual([['Nameplate', 1]]);
    expect(up(vehicle).sources.map(s => [s.label, s.shiftUp])).toEqual([['Nameplate', 1]]);
    const { runConsumer } = await import('../mechanics/item-hooks.mjs');
    for (const consume of up(driver).consumes) {
      await runConsumer(consume);
    }

    expect(up(driver).sources).toEqual([]);
    // Once a rest: pressing it again does nothing until a crew member's Rest.
    await runUse(item, async () => true);
    expect(up(driver).sources).toEqual([]);
    await resetDailyVehicleUses(vehicle);
    await runUse(item, async () => true);
    expect(up(driver).sources.map(s => s.label)).toEqual(['Nameplate']);
  });
});

describe('SummonOption: Manifested Zord, Q-Rex Portal, Assisted Summoning', () => {
  const OPTION_ITEMS = {
    manifested: 'ttsgitems/_source/Manifested_Zord_fNMbLGJk5RiSi49J.json',
    qRex: 'jttitems/_source/Q_Rex_Portal_QRexPortalJTTxxx.json',
    assisted: 'jttitems/_source/Assisted_Summoning_atPA5nGheYDzzmaZ.json',
  };
  const give = (actor, key) => {
    const doc = fromPack(OPTION_ITEMS[key]);
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    return addItem(actor, { name: doc.name, type: doc.type, system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
  };

  test('the Zord\'s and the summoner\'s options are offered; the picked one is paid and replaces the 3d2', async () => {
    const { ruleSummonOptions, pickSummonOption } = await import('./plugins/zords/summon-option.mjs');
    const ranger = makeActor('Quantum Ranger', { system: { powers: { personal: { value: 3, max: 5 } } } });
    const zord = makeActor('Q-Rex', { type: 'zord' });
    expect(await pickSummonOption(ranger, zord)).toBeNull();
    give(zord, 'manifested');
    give(ranger, 'qRex');
    give(zord, 'assisted');
    expect(ruleSummonOptions(ranger, zord).map(o => [o.power, o.action, o.rounds])).toEqual([[4, null, 1], [0, 'standard', 1], [1, null, 1]]);

    // Only what the summoner can afford (3 Power: not Manifested Zord's 4) is offered, beside rolling as usual.
    const { DialogV2 } = foundry.applications.api;
    DialogV2.wait.mockImplementation(async ({ content }) => {
      const values = [...content.matchAll(/value="([^"]+)"/g)].map(m => m[1]);
      expect(values.length).toBe(3);
      return values[2];
    });
    expect(await pickSummonOption(ranger, zord)).toBe(1);
    expect(ranger.system.powers.personal.value).toBe(2);

    DialogV2.wait.mockImplementation(async () => 'roll');
    expect(await pickSummonOption(ranger, zord)).toBeNull();
    expect(ranger.system.powers.personal.value).toBe(2);
  });
});

describe('ExplosionStep: Anti-Matter Reactor', () => {
  test('a Defeated vehicle\'s explosion is one die step bigger (two copies still one)', async () => {
    const { ruleExplosionSteps } = await import('./plugins/zords/explosion-step.mjs');
    const { explodeVehicle } = await import('../mechanics/vehicles/vehicle-defeat.mjs');
    const doc = fromPack('qgtgitems/_source/Anti_Matter_Reactor_kOsm7efSfPh531Hm.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const formulas = [];
    const savedRoll = global.Roll;
    global.Roll = class {
      constructor(formula) {
        formulas.push(formula);
      }
      async evaluate() {
        this.total = 4;
        return this;
      }
    };
    CONFIG.E20.actorSizes = { small: 'S', common: 'C', large: 'L', huge: 'H', extended1: 'E1', extended2: 'E2' };
    try {
      const vehicle = makeActor('HISS', { type: 'vehicle', system: { size: 'huge' } });
      await explodeVehicle(vehicle);
      const give = () => addItem(vehicle, { name: doc.name, type: 'upgrade', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
      give();
      expect(ruleExplosionSteps(vehicle)).toBe(1);
      await explodeVehicle(vehicle);
      give();
      await explodeVehicle(vehicle);
      expect(formulas).toEqual(['2d4', '2d6', '2d6']);
    } finally {
      global.Roll = savedRoll;
    }
  });
});

describe('ChoiceCount: Grid Tap', () => {
  test('a Grid Science / Grid Tech picker offers one more pick while the actor holds Grid Tap; nothing else changes', async () => {
    const { ruleChoiceCountBonus } = await import('./plugins/picks/choice-count.mjs');
    const { setPerkValues } = await import('../sheet-handlers/perk-handler.mjs');
    const GRID_TECH_I = 'Compendium.essence20.pr_crb.Item.R7HF3aSR3ZPURh1W';
    const doc = fromPack('bthitems/_source/Grid_Tap_JKwabam49PLMVN28.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const perkOf = uuid => ({
      uuid, flags: { core: { sourceId: uuid } }, _stats: { compendiumSource: uuid },
      system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false }, numChoices: 2 },
      clone: jest.fn(function (changes) {
        return { ...this, system: { ...this.system, numChoices: changes['system.numChoices'] } };
      }),
    });
    const ranger = makeActor('Billy');
    const plain = perkOf(GRID_TECH_I);
    await setPerkValues(ranger, plain);
    expect(plain.clone).not.toHaveBeenCalled();

    const tap = addItem(ranger, { name: doc.name, type: 'power', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.beneath_the_helmet.Item.${doc._id}` } } });
    tap._id = tap.id;
    expect(ruleChoiceCountBonus(ranger, GRID_TECH_I)).toBe(1);
    const tapped = perkOf(GRID_TECH_I);
    await setPerkValues(ranger, tapped);
    expect(tapped.clone).toHaveBeenCalledWith({ 'system.numChoices': 3 });
    const other = perkOf('Compendium.essence20.pr_crb.Item.someOtherPerk12345');
    await setPerkValues(ranger, other);
    expect(other.clone).not.toHaveBeenCalled();
  });
});

describe('Metamorphosis: deleteItem keepGrants + grantPerk runPicker', () => {
  test('Colony Changeling goes (what it granted stays), Metamorphosed Changeling arrives and its own picker runs - once', async () => {
    const { fireItemAdded } = await import('./triggers.mjs');
    const COLONY = 'Compendium.essence20.dark_skies_over_equestria.Item.FRUWPAePJzm7Mlf0';
    const METAMORPHOSED = 'Compendium.essence20.dark_skies_over_equestria.Item.aD130X44xDxZ6o2U';
    const doc = fromPack('dsoeitems/_source/Metamorphosis_bLtGPdoCPr9Ezgb8.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const pony = makeActor('Thorax');
    pony.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
      for (const id of ids) {
        pony.items.splice(pony.items.findIndex(item => item.id == id), 1);
      }

      rebuildIndex(pony);
    });
    const withId = item => Object.assign(item, { _id: item.id, _stats: item._stats ?? {}, unsetFlag: jest.fn(async (scope, key) => delete item.flags?.[scope]?.[key]), setFlag: jest.fn() });
    const colony = withId(addItem(pony, { name: 'Colony Changeling', type: 'perk', system: {}, flags: { core: { sourceId: COLONY } } }));
    const infatuated = withId(addItem(pony, { name: 'Infatuated', type: 'perk', system: {}, flags: { essence20: { grantedBy: colony.id } } }));
    const picker = { system: { hasChoice: false, isRoleVariant: false, advances: { canAdvance: false } } };
    global.fromUuid = async uuid => (uuid == METAMORPHOSED ? { uuid, name: 'Metamorphosed Changeling', type: 'perk', ...clone(picker) } : null);
    const savedItem = global.Item;
    global.Item = { create: jest.fn(async (data, { parent }) => withId(addItem(parent, { name: data.name, type: data.type, system: clone(data.system), _stats: { compendiumSource: data.uuid }, flags: {} }))) };
    try {
      const meta = withId(addItem(pony, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } }));
      await fireItemAdded(pony, meta);
      expect(pony.items.map(item => item.name)).toEqual(['Infatuated', 'Metamorphosis', 'Metamorphosed Changeling']);
      expect(infatuated.flags.essence20.grantedBy).toBeUndefined();
      expect(global.Item.create).toHaveBeenCalledTimes(1);
      await fireItemAdded(pony, meta);
      expect(global.Item.create).toHaveBeenCalledTimes(1);
    } finally {
      global.Item = savedItem;
    }
  });
});

describe('UniqueChoice: Expertise', () => {
  test('another copy\'s Skill is left out of the picker list; a Perk without the rule leaves everything in', async () => {
    const { getAlreadyChosenExpertiseSkills } = await import('../sheet-handlers/perk-handler.mjs');
    const doc = fromPack('gijcrbitems/_source/Expertise_F9kOLys1Iu4UOg22.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const UUID = `Compendium.essence20.gi_joe_crb.Item.${doc._id}`;
    const joe = makeActor('Duke');
    for (const choice of ['athletics', 'stealth']) {
      addItem(joe, { name: doc.name, type: 'perk', system: { ...clone(doc.system), choice }, flags: { core: { sourceId: UUID } }, _stats: {} });
    }

    expect(getAlreadyChosenExpertiseSkills(joe, { uuid: UUID, flags: {}, system: clone(doc.system) })).toEqual(['athletics', 'stealth']);
    expect(getAlreadyChosenExpertiseSkills(joe, { uuid: UUID, flags: {}, system: { ...clone(doc.system), rules: [] } })).toEqual([]);
  });
});

describe('AnyGeneralPerkChoice: Nobody Like Me', () => {
  test('its picker offers any General Perk; another Perk with a "perks" picker keeps its own list', async () => {
    const { grantsAnyGeneralPerk } = await import('../sheet-handlers/perk-handler.mjs');
    const doc = fromPack('prcrbitems/_source/Nobody_Like_Me_9nvRKN0A8N0EEXUl.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    expect(grantsAnyGeneralPerk({ uuid: `Compendium.essence20.pr_crb.Item.${doc._id}`, system: clone(doc.system) })).toBe(true);
    const talented = fromPack('mlpcrbitems/_source/Talented_UGFiK8wMXQ8fhXbT.json');
    expect(grantsAnyGeneralPerk({ system: clone(talented.system) })).toBe(false);
  });
});

describe('Accelerate Conversion: two Uses + a marked ActionCost; step reduceTimer', () => {
  const ACCEL = 'fgtaaitems/_source/Accelerate_Conversion_fmDJTf8pXl0Hjnyw.json';

  test('Convert as a Free action: 1 Energon (else Personal Power), once a scene, then the next Conversion is Free', async () => {
    const { runUse } = await import('./triggers.mjs');
    const { getCostOptions } = await import('../mechanics/actions/action-perks.mjs');
    const doc = fromPack(ACCEL);
    for (const rule of doc.system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }

    const bot = makeActor('Bumblebee', { system: { canTransform: true, energon: { normal: { value: 0 } }, powers: { personal: { value: 2, max: 5 } } } });
    const perk = addItem(bot, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    startCombat([bot]);
    const free = () => getCostOptions(bot, 'standard', { kind: 'conversion' }, getLedger(bot));
    expect(free().auto).toBeNull();
    const pick = async (item, available) => available.find(({ rule }) => rule.label.startsWith('Convert'));
    await runUse(perk, async () => true, { pick });
    expect(bot.system.powers.personal.value).toBe(1);
    expect(bot.flags.essence20.ruleMarks.accelerateConvert).toBeTruthy();
    expect([free().auto?.actionType, free().auto?.label]).toEqual(['free', 'Accelerate Conversion']);
    // Once a scene: no second paid Convert.
    expect(await runUse(perk, async () => true, { pick })).toBeNull();
    expect(bot.system.powers.personal.value).toBe(1);
  });

  test('2 rounds sooner: the picked Zord timer comes down, floored at this round; nothing running stops the Use', async () => {
    const { runUse } = await import('./triggers.mjs');
    const doc = fromPack(ACCEL);
    const zord = makeActor('Tyrannosaurus', { type: 'zord' });
    zord.flags.essence20.zordSummonReadyRound = 5;
    const ranger = makeActor('Jason', { system: { actors: { z: { uuid: zord.uuid } } } });
    const perk = addItem(ranger, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    const pick = async (item, available) => available.find(({ rule }) => rule.label.startsWith('A Zord'));
    startCombat([ranger]);
    combat.round = 4;
    await runUse(perk, async () => true, { pick });
    expect(zord.flags.essence20.zordSummonReadyRound).toBe(4);
    expect(await runUse(perk, async () => true, { pick })).toBeNull();

    const other = makeActor('Zack');
    const perk2 = addItem(other, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    expect(await runUse(perk2, async () => true, { pick })).toBeNull();
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.AccelerateNothing');
  });
});

describe('personalVehicle: Crashing From The Skies', () => {
  test('the Jet Pack gets 45 ft Aerial and its guns, once; no Jet Pack, nothing happens', async () => {
    const { runUse } = await import('./triggers.mjs');
    const doc = fromPack('ccitems/_source/Crashing_From_The_Skies_9CF0mXhOO0QNFc5n.json');
    expect(validateRule(doc.system.rules[0])).toEqual([]);
    const viper = makeActor('Sky Viper');
    const perk = addItem(viper, { name: doc.name, type: 'perk', system: clone(doc.system), flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` } } });
    expect(await runUse(perk, async () => true)).toContain('has no Jet Pack');

    const jetPack = makeActor('Jet Pack', { type: 'vehicle' });
    jetPack.flags.essence20 = { personalVehicle: 'jetPack', companionOf: viper.uuid };
    jetPack.system.movement.aerial = { base: 30 };
    const made = [];
    jetPack.createEmbeddedDocuments = jest.fn(async (type, datas) => datas.map(data => {
      made.push(data);
      return addItem(jetPack, { ...data, system: { items: {}, ...data.system } });
    }));
    await runUse(perk, async () => true);
    expect(jetPack.system.movement.aerial.base).toBe(45);
    expect(made.map(data => [data.type, data.name, data.system.damageValue ?? null])).toEqual([
      ['weapon', 'Quad Blast 25mm Axial Machine Guns', null], ['weaponEffect', 'Quad Blast 25mm Axial Machine Guns', 1]]);
    expect(perk.flags.essence20.granted).toBe(true);
    expect(await runUse(perk, async () => true)).toContain('already has it');
    expect(made.length).toBe(2);
  });
});
