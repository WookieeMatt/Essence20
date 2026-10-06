import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE6: items of the qualify / MLP slices converted with the round-6 engine pieces (status:<id>:timed,
 * compound wielding (&), upgrade-aware item:trait, item:hasUpgrade, rule:hostEquipped, nextTurnOrScene,
 * i18n table rows). Each is loaded from its pack source and must do what the removed slice code did.
 */

const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleRequisitionAccess, ruleRollSources } = await import('./adapter.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { costRulesFor } = await import('./actions.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor({ name = 'Hero', type = 'playerCharacter', system = {}, items = [], statuses = [], effects = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(statuses), flags: { essence20: {} },
    system: { level: 5, health: { value: 3, max: 10 }, skills: {}, ...system },
    effects: { contents: effects },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    getActiveTokens: () => [],
    getFlag: (scope, key) => `${scope}.${key}`.split('.').reduce((at, part) => at?.[part], actor.flags),
    setFlag: async (scope, key, value) => setPath(actor.flags, `${scope}.${key}`, value),
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = [...items];
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of list) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** An owned copy of a pack item (its book source set, as a dropped copy has). */
function packItem(file, extra = {}) {
  const doc = fromPack(file);
  return {
    id: extra.id ?? `i${nextId++}`, name: doc.name, type: doc.type,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, ...(extra.flags ?? {}) },
    system: { ...doc.system, ...(extra.system ?? {}) },
  };
}

const plain = (type, extra = {}) => ({ id: extra.id ?? `i${nextId++}`, name: extra.name ?? type, type, flags: extra.flags ?? {}, system: extra.system ?? {} });

let posted;
beforeEach(() => {
  posted = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    i18n: {
      localize: k => (k.startsWith('E20.Mlp1Pinkie.') ? `row ${k.split('.').pop()}` : k), format: k => k,
      has: k => k.startsWith('E20.Mlp1Pinkie.'),
    },
  };
  global.ChatMessage = { create: jest.fn(async data => posted.push(data.content)), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) },
  };
});

/* -------------------------------------------- */
/*  Opportunist (qualify2)                       */
/* -------------------------------------------- */

const OPPORTUNIST = 'tfcrbitems/_source/Opportunist_8JpfjvHVDHWKjMc9.json';

describe('Opportunist', () => {
  const attacker = () => makeActor({ items: [packItem(OPPORTUNIST), plain('weaponEffect')] });
  const hit = (actor, target, roll = {}) => fireTriggers(actor, 'hit', {
    roll: { item: actor.items.contents[1], isAttack: true, ...roll }, outcome: 'success', targets: [target],
  });

  test('a hit on a target with Stun damage adds 1 Stun', async () => {
    const actor = attacker();
    const target = makeActor({ name: 'Foe', type: 'npc', system: { stun: { value: 2 } } });
    await hit(actor, target);
    expect(target.update).toHaveBeenCalledWith({ 'system.stun.value': 3 });
    expect(posted.join(' ')).toContain('Foe');
  });

  test('a timed Stunned Condition lasts a round longer (and the Stun damage is left alone)', async () => {
    const actor = attacker();
    const timed = { statuses: new Set(['stunned']), duration: { rounds: 1 }, update: jest.fn() };
    const target = makeActor({ name: 'Foe', type: 'npc', statuses: ['stunned'], effects: [timed], system: { stun: { value: 1 } } });
    await hit(actor, target);
    expect(timed.update).toHaveBeenCalledWith({ 'duration.rounds': 2 });
    expect(target.update).not.toHaveBeenCalled();
  });

  test('not Stunned, not an attack, or no Perk: nothing', async () => {
    const actor = attacker();
    const fresh = makeActor({ name: 'Foe', type: 'npc', system: { stun: { value: 0 } } });
    await hit(actor, fresh);
    expect(fresh.update).not.toHaveBeenCalled();

    const stunned = makeActor({ name: 'Foe', type: 'npc', system: { stun: { value: 2 } } });
    await fireTriggers(actor, 'hit', { roll: { item: null, isAttack: false }, outcome: 'success', targets: [stunned] });
    expect(stunned.update).not.toHaveBeenCalled();

    const bare = makeActor({ items: [plain('weaponEffect')] });
    await hit(bare, stunned);
    expect(stunned.update).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });

  test('an untimed Stunned Condition alone is noted, nothing changes', async () => {
    const actor = attacker();
    const open = { statuses: new Set(['stunned']), duration: {}, update: jest.fn() };
    const target = makeActor({ name: 'Foe', type: 'npc', statuses: ['stunned'], effects: [open], system: { stun: { value: 0 } } });
    await hit(actor, target);
    expect(open.update).not.toHaveBeenCalled();
    expect(target.update).not.toHaveBeenCalled();
    expect(posted).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  Whisper Warrior (qualify2)                   */
/* -------------------------------------------- */

const WHISPER = 'iafav2items/_source/Whisper_Warrior_T4p7oPq8Kk0SHVb3.json';

describe('Whisper Warrior', () => {
  test('Qualified with weapons having both Martial Arts and Silent (upgrade traits count)', () => {
    const actor = makeActor({ items: [packItem(WHISPER)] });
    expect(ruleRequisitionAccess(actor, plain('weapon', { system: { availability: 'restricted', traits: ['martialArts', 'silent'] } }))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, plain('weapon', { system: { traits: ['silent'] } }))).toBeNull();
    expect(ruleRequisitionAccess(actor, plain('weapon', { system: { traits: ['martialArts'], itemAndUpgradeTraits: ['martialArts', 'silent'] } }))).toBe('qualified');
    expect(ruleRequisitionAccess(makeActor(), plain('weapon', { system: { traits: ['martialArts', 'silent'] } }))).toBeNull();
  });

  test('Defend is a Free action only while wielding a Silent Martial Arts weapon', () => {
    const defend = actor => costRulesFor(actor).filter(rule => rule.matches({ key: 'defend' }));
    const armed = () => {
      const weapon = plain('weapon', { id: 'w1', system: { equipped: true, traits: ['martialArts', 'silent'] } });
      return [weapon, plain('weaponEffect', { flags: { essence20: { parentId: 'w1' } } })];
    };

    const [ready] = defend(makeActor({ items: [packItem(WHISPER), ...armed()] }));
    expect(ready.to()).toBe('free');
    expect(costRulesFor(makeActor({ items: [packItem(WHISPER), ...armed()] })).some(rule => rule.matches({ key: 'sprint' }))).toBe(false);
    expect(defend(makeActor({ items: [packItem(WHISPER)] }))).toEqual([]);
    const [weapon, effect] = armed();
    weapon.system.equipped = false;
    expect(defend(makeActor({ items: [packItem(WHISPER), weapon, effect] }))).toEqual([]);
    const [silentOnly, its] = armed();
    silentOnly.system.traits = ['silent'];
    expect(defend(makeActor({ items: [packItem(WHISPER), silentOnly, its] }))).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  The Glory of Cobra-La's weapon Snag (qualify1) */
/* -------------------------------------------- */

const COBRA_LA = 'fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json';
const BIOMECH_UPGRADE = 'Compendium.essence20.ferocious_fighters.Item.7qniIaOGp8Mqwt6O';

describe('The Glory of Cobra-La weapon Snag', () => {
  const snagged = (weapon, extra = []) => {
    const effect = plain('weaponEffect', { flags: { essence20: weapon ? { parentId: weapon.id } : {} } });
    const actor = makeActor({ items: [packItem(COBRA_LA), ...(weapon ? [weapon] : []), effect, ...extra] });
    return ruleRollSources(actor, null, { item: effect, isAttack: true, rolledSkill: 'targeting' }).sources.some(source => source.snag);
  };

  test('Snag with a weapon that isn\'t Biomechanical', () => {
    expect(snagged(plain('weapon', { id: 'w1', name: 'Rifle' }))).toBe(true);
  });

  test('no Snag: Biomechanical trait, a Bio-Mech / Cobra-La name, the Biomechanical Weapon upgrade, unarmed', () => {
    expect(snagged(plain('weapon', { id: 'w1', name: 'Rifle', system: { traits: ['biomechanical'] } }))).toBe(false);
    expect(snagged(plain('weapon', { id: 'w1', name: 'Bio-Mech Lash' }))).toBe(false);
    expect(snagged(plain('weapon', { id: 'w1', name: 'Biomech Spitter' }))).toBe(false);
    expect(snagged(plain('weapon', { id: 'w1', name: 'Cobra-La Spore Gun' }))).toBe(false);
    const upgrade = plain('upgrade', { flags: { core: { sourceId: BIOMECH_UPGRADE }, essence20: { parentId: 'w1' } } });
    expect(snagged(plain('weapon', { id: 'w1', name: 'Rifle' }), [upgrade])).toBe(false);
    expect(snagged(null)).toBe(false);
  });

  test('a Skill Test that isn\'t an attack gets no weapon Snag', () => {
    const actor = makeActor({ items: [packItem(COBRA_LA)] });
    expect(ruleRollSources(actor, null, { rolledSkill: 'alertness' }).sources.some(source => source.snag)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Dome Generator (qualify1)                    */
/* -------------------------------------------- */

const DOME = 'gijcrbitems/_source/Dome_Generator_rrJ1kpQfk0627aJq.json';

describe('Dome Generator', () => {
  function wearer({ equipped = true, copies = 1, morphed = false } = {}) {
    const armor = plain('armor', { id: 'arm', name: 'Vest', system: { equipped, totalBonusToughness: 2, totalBonusEvasion: 0 } });
    const domes = Array.from({ length: copies }, () => packItem(DOME, { flags: { essence20: { parentId: 'arm' } } }));
    const actor = makeActor({ items: [armor, ...domes], system: { isMorphed: morphed } });
    return { actor, domes };
  }

  const defenses = actor => {
    actor.system.defenses = { toughness: { total: 14, string: '' }, evasion: { total: 12, string: '' } };
    ruleDerived(actor);
    return [actor.system.defenses.toughness.total, actor.system.defenses.evasion.total];
  };

  test('a Free action doubles the armor bonus (once per copy per scene)', async () => {
    const { actor, domes } = wearer();
    expect(defenses(actor)).toEqual([14, 12]);
    const pay = jest.fn(async () => true);
    expect(await runUse(domes[0], pay)).toContain('Dome Generator');
    expect(pay).toHaveBeenCalledWith('free');
    rebuildIndex(actor);
    expect(defenses(actor)).toEqual([16, 12]);
    expect(await runUse(domes[0], pay)).toBeNull();
  });

  test('two copies: two uses a scene, the bonus still doubled once', async () => {
    const { actor, domes } = wearer({ copies: 2 });
    const pay = async () => true;
    expect(await runUse(domes[0], pay)).not.toBeNull();
    expect(await runUse(domes[1], pay)).not.toBeNull();
    expect(await runUse(domes[0], pay)).toBeNull();
    rebuildIndex(actor);
    expect(defenses(actor)).toEqual([16, 12]);
  });

  test('not with the battledress unequipped, and not while Morphed', async () => {
    const { domes } = wearer({ equipped: false });
    expect(await runUse(domes[0], async () => true)).toBeNull();
    const { actor, domes: [dome] } = wearer({ morphed: true });
    await runUse(dome, async () => true);
    rebuildIndex(actor);
    expect(defenses(actor)).toEqual([14, 12]);
  });

  test('in combat it ends when the holder\'s next turn starts', async () => {
    const { actor, domes } = wearer();
    const other = { actor: { id: 'zz' } };
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor }, other] };
    await runUse(domes[0], async () => true);
    rebuildIndex(actor);
    expect(defenses(actor)).toEqual([16, 12]);
    game.combat = { ...game.combat, turn: 1 };
    expect(defenses(actor)).toEqual([16, 12]);
    game.combat = { ...game.combat, round: 2, turn: 0 };
    expect(defenses(actor)).toEqual([14, 12]);
  });
});

/* -------------------------------------------- */
/*  Pinkie Sense (mlp1)                          */
/* -------------------------------------------- */

const PINKIE = 'kocitems/_source/Pinkie_Sense_hER4hs3jrIHM8gF3.json';

describe('Pinkie Sense', () => {
  test('a successful cast rolls the d8 table and posts the row', async () => {
    const spell = packItem(PINKIE);
    const actor = makeActor({ items: [spell] });
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success' });
    random.mockRestore();
    expect(posted.join(' ')).toContain('row 5');
  });

  test('a failed cast, or another spell: no table', async () => {
    const spell = packItem(PINKIE);
    const actor = makeActor({ items: [spell, plain('spell')] });
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'failure' });
    await fireTriggers(actor, 'afterRoll', { roll: { item: actor.items.contents[1] }, outcome: 'success' });
    expect(posted).toEqual([]);
  });
});
