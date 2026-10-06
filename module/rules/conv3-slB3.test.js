import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { applyRuleSwitches, ruleDialogSwitches, ruleRollSources } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable } from './triggers.mjs';
import { consumeBanked } from './bank.mjs';

/**
 * Slice round 3, part slB3 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code
 * to item rules with the 2026-10-05 engine pieces (item:granted / rule:granted, createItem children,
 * endOfNextTurn with untilOf: recipient). Each item is loaded from its pack source and must do what
 * the removed code (and its test) did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let epoch = 1;

const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

/** An actor holding these pack items (and any extra item objects). */
function holder(files = [], { system = {}, extra = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    toggleStatusEffect: jest.fn(async () => {}),
  };
  actor.uuid = `Actor.${actor.id}`;
  const items = files.map(file => {
    const doc = fromPack(file);
    return { id: `c${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: doc.system };
  });
  items.push(...extra);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** A weapon granted by `grantor` (its id), with one attack. */
function grantedWeapon(grantorId) {
  const weapon = { id: `w${nextId++}`, name: 'Blade', type: 'weapon', flags: { essence20: { grantedBy: grantorId } }, system: { equipped: true } };
  const attack = { id: `e${nextId++}`, name: 'Slash', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { style: 'melee' } } };
  return { weapon, attack };
}

/** Add items to a holder after the fact. */
function give(actor, ...items) {
  for (const item of items) {
    item.parent = actor;
    actor.items.contents.push(item);
  }

  rebuildIndex(actor);
}

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, user: { id: 'u', isGM: false, targets: new Set() }, i18n: { localize: k => k, format: k => k },
    settings: { get: () => epoch }, actors: { contents: [] },
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

/* -------------------------------------------- */
/*  Rotor Blades / Tow Cable & Hook: ↑1         */
/* -------------------------------------------- */

test('Rotor Blades: ↑1 on Finesse / Might attacks with its own blades, when Trained (or Qualified) with a Heavy Blade', () => {
  const actor = holder(['tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json'], { system: { trained: { weapons: { closeCombatHeavyBlade: true } } } });
  const gear = actor.items.contents[0];
  const { weapon, attack } = grantedWeapon(gear.id);
  const other = grantedWeapon('someoneElse');
  give(actor, weapon, attack, other.weapon, other.attack);
  const roll = (item, rolledSkill) => ruleRollSources(actor, null, { item, isAttack: item?.type == 'weaponEffect', rolledSkill }).sources;

  expect(roll(attack, 'finesse')).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  expect(roll(attack, 'might')).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  // Not another Skill, not another weapon, not a plain Skill Test.
  expect(roll(attack, 'brawn')).toEqual([]);
  expect(roll(other.attack, 'finesse')).toEqual([]);
  expect(roll(null, 'finesse')).toEqual([]);
  // Untrained: nothing; Qualified counts like Trained.
  actor.system.trained.weapons.closeCombatHeavyBlade = false;
  expect(roll(attack, 'finesse')).toEqual([]);
  actor.system.qualified = { weapons: { closeCombatHeavyBlade: true } };
  expect(roll(attack, 'finesse')).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  // An automatic source, never a dialog switch.
  expect(ruleDialogSwitches(actor, { item: attack, rolledSkill: 'finesse' })).toEqual([]);
});

test('Tow Cable & Hook: a ↑1 switch on Finesse / Might attacks with its own cable, unticked each roll', () => {
  const actor = holder(['tfcrbitems/_source/Tow_Cable___Hook_EVywnYUDjBfMcoWT.json'], { system: { isTransformed: false } });
  const gear = actor.items.contents[0];
  const { weapon, attack } = grantedWeapon(gear.id);
  const other = grantedWeapon('someoneElse');
  give(actor, weapon, attack, other.weapon, other.attack);
  const label = 'Trained with a Grappler (Tow Cable & Hook: ↑1)';
  const switches = ctx => ruleDialogSwitches(actor, ctx).filter(s => s.label == label);

  const [entry] = switches({ item: attack, rolledSkill: 'might' });
  expect(entry).toMatchObject({ value: false });
  expect(switches({ item: attack, rolledSkill: 'finesse' })).toHaveLength(1);
  expect(switches({ item: attack, rolledSkill: 'athletics' })).toEqual([]);
  expect(switches({ item: other.attack, rolledSkill: 'might' })).toEqual([]);
  expect(switches({ rolledSkill: 'might' })).toEqual([]);

  const options = { shiftUp: 0, shiftDown: 0, ext: { [entry.name]: true } };
  applyRuleSwitches(actor, options, { item: attack, rolledSkill: 'might' });
  expect(options.shiftUp).toBe(1);
  // Nothing automatic.
  expect(ruleRollSources(actor, null, { item: attack, isAttack: true, rolledSkill: 'might' }).sources).toEqual([]);
});

/* -------------------------------------------- */
/*  Fearsome Voice                               */
/* -------------------------------------------- */

describe('Fearsome Voice', () => {
  function voiceHolder() {
    const actor = holder(['dditems/_source/Fearsome_Voice_ZQl2qzyBNHUYYHS5.json']);
    actor.createEmbeddedDocuments = jest.fn(async (type, datas) => {
      const docs = datas.map(data => ({ ...data, id: `n${nextId++}`, isOwner: false }));
      give(actor, ...docs);
      return docs;
    });
    return { actor, perk: actor.items.contents[0] };
  }

  test('the Use makes the attack (a natural weapon with its Intimidation attack), then hides while it exists', async () => {
    const { actor, perk } = voiceHolder();
    const [use] = perk.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use');
    expect(useAvailable(perk, use.rule, use.index)).toBe(true);
    const paid = jest.fn(async () => true);
    expect(await runUse(perk, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();

    const weapon = actor.items.contents.find(item => item.type == 'weapon');
    const attack = actor.items.contents.find(item => item.type == 'weaponEffect');
    expect(weapon).toMatchObject({
      name: 'Fearsome Voice',
      system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } },
      flags: { essence20: { grantedBy: perk.id, natural: true } },
    });
    expect(attack).toMatchObject({
      name: 'Fearsome Voice',
      system: { classification: { skill: 'intimidation', style: 'energy' }, damageType: 'stun', damageValue: 1, defenseType: 'willpower', numTargets: 1, numHands: 0, range: { value: 20, long: 60 } },
      flags: { essence20: { parentId: weapon.id } },
    });
    // Hidden while anything the Perk granted is still there.
    expect(useAvailable(perk, use.rule, use.index)).toBe(false);
  });

  test('a Critical Success with its attack leaves the target Frightened for 1 round; an ordinary hit or another attack does not', async () => {
    const { actor, perk } = voiceHolder();
    const { weapon, attack } = grantedWeapon(perk.id);
    const other = grantedWeapon('someoneElse');
    give(actor, weapon, attack, other.weapon, other.attack);
    const target = holder([]);

    await fireTriggers(actor, 'hit', { roll: { item: attack, isAttack: true }, outcome: 'success', targets: [target] });
    await fireTriggers(actor, 'hit', { roll: { item: other.attack, isAttack: true }, outcome: 'crit', targets: [target] });
    expect(target.toggleStatusEffect).not.toHaveBeenCalled();

    // A crit, or a success by double the DIF (the old isCritResult), both count.
    await fireTriggers(actor, 'hit', { roll: { item: attack, isAttack: true }, outcome: 'crit', targets: [target] });
    await fireTriggers(actor, 'hit', { roll: { item: attack, isAttack: true }, outcome: 'double', targets: [target] });
    expect(target.toggleStatusEffect).toHaveBeenCalledTimes(2);
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
  });
});

/* -------------------------------------------- */
/*  Covering Fire                                */
/* -------------------------------------------- */

describe('Covering Fire', () => {
  const FILE = 'tfcrbitems/_source/Covering_Fire_cAm087BkiExKIJrY.json';
  const shot = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
  const snags = (actor, roll = shot) => ruleRollSources(actor, null, roll).sources.filter(source => source.snag);

  test('in combat: a miss marks the target; it takes a Snag on every attack during its own next turn', async () => {
    const gunner = holder([FILE]);
    const target = holder([]);
    const combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: gunner }, { actor: target }] };
    Object.defineProperty(combat, 'combatant', { get: () => combat.turns[combat.turn] });
    game.combat = combat;

    await fireTriggers(gunner, 'miss', { roll: shot, targets: [target] });
    // Not its turn yet: no Snag.
    expect(snags(target)).toEqual([]);

    combat.turn = 1;
    expect(snags(target)).toEqual([expect.objectContaining({ label: 'Covering Fire', snag: true })]);
    // Only attacks.
    expect(snags(target, { rolledSkill: 'alertness' })).toEqual([]);
    // Every attack in that turn.
    for (const consume of ruleRollSources(target, null, shot).consumes) {
      await consumeBanked(consume, async () => target);
    }

    expect(snags(target)).toHaveLength(1);
    // Gone once its turn is over.
    combat.round = 2;
    combat.turn = 0;
    expect(snags(target)).toEqual([]);
  });

  test('out of combat: one Snag on its next attack, this scene only', async () => {
    const gunner = holder([FILE]);
    const target = holder([]);
    await fireTriggers(gunner, 'miss', { roll: shot, targets: [target] });
    expect(snags(target)).toEqual([expect.objectContaining({ label: 'Covering Fire' })]);
    for (const consume of ruleRollSources(target, null, shot).consumes) {
      await consumeBanked(consume, async () => target);
    }

    expect(snags(target)).toEqual([]);
    await fireTriggers(gunner, 'miss', { roll: shot, targets: [target] });
    epoch = 2;
    expect(snags(target)).toEqual([]);
  });

  test('a hit, or a miss with something other than a weapon attack, marks nothing', async () => {
    const gunner = holder([FILE]);
    const target = holder([]);
    await fireTriggers(gunner, 'hit', { roll: shot, outcome: 'success', targets: [target] });
    await fireTriggers(gunner, 'miss', { roll: { rolledSkill: 'persuasion', isAttack: false }, targets: [target] });
    expect(target.flags.essence20.ruleBank).toBeUndefined();
  });
});
