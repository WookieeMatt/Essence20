import { jest } from '@jest/globals';
import { TF1, favoriteWeaponOf, isDefeated, sourceOf } from './common.mjs';
import {
  COMBAT_USES, armorOf, commsArmorAdjust, respectTurnEnd, respectTurnStart, shieldTraded, tf1CombatApplyDialog, tf1CombatHitRider,
  tf1CombatPostRoll, tf1CombatSources, tf1CombatToggles, tf1DefenseAdjust, tf1Derived,
} from './combat.mjs';
import {
  FLEXIBLE_SWITCH_RULE, SUPPORT_USES, mimicrySizeOk, sizeClass, tf1SupportPostRoll,
  tf1SupportSources,
} from './support.mjs';
import { registrySnapshot } from '../../extensions.mjs';

const owned = (uuid, extra = {}) => ({
  id: extra.id ?? uuid.slice(-6), name: extra.name ?? 'Thing', type: extra.type ?? 'perk', system: extra.system ?? {},
  flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} },
});

function makeActor(items = [], extra = {}) {
  const flags = { essence20: { ...(extra.flags ?? {}) } };
  const actor = {
    id: extra.id ?? 'a1', uuid: extra.uuid ?? 'Actor.a1', name: 'A', system: extra.system ?? {}, flags, statuses: new Set(extra.statuses ?? []),
    items: { contents: items, get: id => items.find(i => i.id == id) },
    setFlag: jest.fn(async (scope, key, value) => {
      flags.essence20[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags.essence20[key];
    }),
    toggleStatusEffect: jest.fn(),
    getActiveTokens: () => [],
  };
  return actor;
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, combat: null, settings: { get: () => 1 } };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', deception: 'social', alertness: 'smarts', intimidation: 'strength', technology: 'smarts' }, damageTypes: {} } };
  global.canvas = undefined;
  global.ui = { notifications: { warn: jest.fn() } };
});

test('every Use and rule is registered', () => {
  const registry = registrySnapshot();
  const ids = registry.uses.map(u => u.id);
  for (const use of [...COMBAT_USES, ...SUPPORT_USES]) {
    expect(ids).toContain(use.id);
  }

  expect(registry.costRules).toEqual(expect.arrayContaining([FLEXIBLE_SWITCH_RULE]));
  expect(typeof registry.chatButtons.tf1Damage).toBe('function');
});

test('Use buttons match their own items only', () => {
  const byId = Object.fromEntries([...COMBAT_USES, ...SUPPORT_USES].map(u => [u.id, u]));
  expect(byId.tf1FearsomeVoice.matches(owned(TF1.fearsomeVoice))).toBe(true);
  expect(byId.tf1FearsomeVoice.matches(owned(TF1.brutalDisplay))).toBe(false);
  expect(byId.tf1Drone.matches(owned(TF1.drone, { type: 'origin' }))).toBe(true);
  expect(byId.tf1ToxEn.matches(owned(TF1.toxEn, { type: 'gear' }))).toBe(true);
});

test('Fearsome Additions: Ram in Alt Mode (the Bot Mode Intimidation ↑1 is a rule)', () => {
  const gear = owned(TF1.fearsomeAdditions, { type: 'gear', name: 'Fearsome Additions' });
  const bot = makeActor([gear], { system: { isTransformed: false } });
  const alt = makeActor([gear], { system: { isTransformed: true } });
  const ram = { type: 'weaponEffect', name: 'Ram', system: { isRam: true } };
  expect(tf1CombatSources(bot, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  expect(tf1CombatSources(bot, null, { item: ram, rolledSkill: 'might' }).sources).toEqual([]);
  expect(tf1CombatSources(alt, null, { item: ram, rolledSkill: 'might' }).sources[0].shiftUp).toBe(1);
  expect(tf1CombatSources(alt, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
});

test('Focused Blast: offered on area weapons, ↑1 or +1 damage', async () => {
  const holder = makeActor([owned(TF1.focusedBlast)]);
  const blast = { type: 'weaponEffect', system: { radius: 10 } };
  expect(tf1CombatToggles(holder, { item: blast })[0].name).toBe('tf1FocusedBlast');
  expect(tf1CombatToggles(holder, { item: { type: 'weaponEffect', system: {} } })).toEqual([]);
  const up = { shiftUp: 0, ext: { tf1FocusedBlast: 'up' } };
  await tf1CombatApplyDialog(holder, up);
  expect(up.shiftUp).toBe(1);
  await tf1CombatApplyDialog(holder, { ext: { tf1FocusedBlast: 'damage' } });
  const note = jest.fn();
  await tf1CombatHitRider(holder, {}, { damageValue: 2 }, {}, { damageBonusNote: note });
  expect(note).toHaveBeenCalledWith(expect.anything(), 1, expect.anything());
});

test('Steady Firepower lowers the same target\'s Defense by the count', async () => {
  const weapon = { id: 'w1', type: 'weapon' };
  const effect = { id: 'e1', type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } } };
  const favorite = owned(TF1.favoriteWeapon, { system: { choice: 'w1' } });
  const holder = makeActor([owned(TF1.steadyFirepower), favorite, weapon, effect]);
  const foe = { uuid: 'Actor.f' };
  await tf1CombatPostRoll(holder, [], {}, { hits: [{ target: foe, hit: true }], rider: { weaponId: 'w1' } });
  await tf1CombatPostRoll(holder, [], {}, { hits: [{ target: foe, hit: true }], rider: { weaponId: 'w1' } });
  expect(tf1DefenseAdjust(holder, foe, 'evasion', { item: effect })).toBe(-2);
  expect(tf1DefenseAdjust(holder, { uuid: 'Actor.other' }, 'evasion', { item: effect })).toBe(0);
  await tf1CombatPostRoll(holder, [], {}, { hits: [{ target: foe, hit: true }], rider: { weaponId: 'w9' } });
  expect(holder.flags.essence20.tf1SteadyFire).toBeUndefined();
  expect(favoriteWeaponOf(holder)).toBe(weapon);
});

test('My Allies Are My Shield trade: movement up, counted only this combat', () => {
  game.combat = { id: 'c1' };
  const holder = makeActor([owned(TF1.myAlliesAreMyShield)], { flags: { tf1ShieldTrade: { combatId: 'c1', n: 2 } }, system: { movement: { ground: { total: 30 }, aerial: { total: 0 } } } });
  expect(shieldTraded(holder)).toBe(2);
  tf1Derived(holder);
  expect(holder.system.movement.ground.total).toBe(50);
  expect(holder.system.movement.aerial.total).toBe(0);
  game.combat = { id: 'c2' };
  expect(shieldTraded(holder)).toBe(0);
});

test('Comms Assault strips armor only for its own roll', () => {
  const foe = makeActor([{ id: 'x', type: 'armor', system: { equipped: true, totalBonusToughness: 2 } }], { system: { defenses: { toughness: { armor: 1 } } } });
  expect(armorOf(foe)).toBe(3);
  expect(commsArmorAdjust({ id: 'nobody' }, foe, 'toughness')).toBe(0);
});

test('Show Respect: pending becomes active for one turn', async () => {
  const holder = makeActor([owned(TF1.showRespect, { type: 'hangUp' })], { flags: { tf1Respect: { pending: ['Actor.f'] } } });
  await respectTurnStart(holder);
  expect(holder.flags.essence20.tf1Respect.active).toEqual(['Actor.f']);
  await respectTurnEnd(holder);
  expect(holder.flags.essence20.tf1Respect.active).toEqual([]);
});

test('Loaded Questions: cumulative ↑1 per earlier test on the same target this scene', async () => {
  const holder = makeActor([owned(TF1.loadedQuestions)]);
  const foe = { uuid: 'Actor.f' };
  expect(tf1SupportSources(holder, foe, { rolledSkill: 'deception' }).sources).toEqual([]);
  await tf1SupportPostRoll(holder, [], {}, { hits: [{ target: foe }], rider: { skill: 'deception' } });
  await tf1SupportPostRoll(holder, [], {}, { hits: [{ target: foe }], rider: { skill: 'persuasion' } });
  expect(tf1SupportSources(holder, foe, { rolledSkill: 'persuasion' }).sources[0].shiftUp).toBe(2);
  expect(tf1SupportSources(holder, foe, { rolledSkill: 'alertness' }).sources).toEqual([]);
});

test('Alt Mode Mimicry size limit', () => {
  expect(sizeClass('long')).toBe(sizeClass('large'));
  expect(mimicrySizeOk('common', 'large')).toBe(true);
  expect(mimicrySizeOk('common', 'huge')).toBe(false);
  expect(mimicrySizeOk('large', 'extended')).toBe(true);
  expect(mimicrySizeOk('huge', 'small')).toBe(true);
});

test('Flexible Switch cost rule', () => {
  const perk = owned(TF1.flexibleSwitch, { flags: { switchModes: ['m1', 'm2'] } });
  const modes = [{ id: 'm1', type: 'altMode' }, { id: 'm2', type: 'altMode' }, { id: 'm3', type: 'altMode' }];
  const holder = makeActor([perk, ...modes], { system: { isTransformed: true, altModeId: 'm1' } });
  expect(FLEXIBLE_SWITCH_RULE.has(holder)).toBe(true);
  holder.system.altModeId = 'm3';
  expect(FLEXIBLE_SWITCH_RULE.has(holder)).toBe(false);
  expect(FLEXIBLE_SWITCH_RULE.matches({ kind: 'conversion' })).toBe(true);
});

test('small helpers', () => {
  expect(sourceOf({ _stats: { compendiumSource: 'x' } })).toBe('x');
  expect(isDefeated({ statuses: new Set(['defeated']) })).toBe(true);
  expect(isDefeated({ statuses: new Set(), system: { health: { value: 3, max: 5 } } })).toBe(false);
});
