import { jest } from '@jest/globals';
import { favoriteWeaponOf, isDefeated, TF1 } from "../shared/condition-damage-buttons.mjs";
import { sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";
import {
  COMBAT_USES, respectTurnEnd, respectTurnStart, tf1CombatPostRoll,
} from '../attacks/show-respect.mjs';
import { GLITCH_USE } from '../social/they-called-it-a-glitch.mjs';
import { MIMICRY_USE, mimicrySizeOk, sizeClass } from '../forms/alt-mode-mimicry.mjs';
import { DRONE_USE } from '../forms/drone-copied-origin.mjs';
import { SOLID_ENERGON_USE } from '../resources/solid-state-energon.mjs';
import { registrySnapshot } from '../../mechanics/item-hooks.mjs';

const SUPPORT_USES = [GLITCH_USE, MIMICRY_USE, DRONE_USE, SOLID_ENERGON_USE];

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

  // Flexible Switch's Free conversion is an ActionCost rule on the Perk now.
  expect(registry.costRules.some(rule => rule.id == 'tf1FlexibleSwitch')).toBe(false);
  expect(typeof registry.chatButtons.tf1Damage).toBe('function');
});

test('Use buttons match their own items only', () => {
  const byId = Object.fromEntries([...COMBAT_USES, ...SUPPORT_USES].map(u => [u.id, u]));
  // Fearsome Voice's, Make An Example's, Brutal Display's, Comms Assault's and Flexible Switch's Uses are rules on
  // the Perks now.
  for (const id of ['tf1FearsomeVoice', 'tf1MakeAnExample', 'tf1BrutalDisplay', 'tf1CommsAssault', 'tf1FlexibleSwitch', 'tf1TargetRich', 'tf1ToxEn']) {
    expect(byId[id]).toBeUndefined();
  }

  // So are Comms Probe's, False Data's, Mine!'s, Picking Up the Trail's, Feedback Field's and Partnered's.
  for (const id of ['tf1CommsProbe', 'tf1FalseData', 'tf1Mine', 'tf1Trail', 'tf1FeedbackField', 'tf1Partnered']) {
    expect(byId[id]).toBeUndefined();
  }

  expect(byId.tf1Drone.matches(owned(TF1.drone, { type: 'origin' }))).toBe(true);
});

test('Fearsome Additions and Steady Firepower are rules now (no roll source, no Defense adjust, no flag)', async () => {
  const registry = registrySnapshot();
  expect(registry.rollSources.some(fn => fn.name == 'tf1CombatSources')).toBe(false);
  expect(registry.defenseAdjust.some(fn => fn.name == 'tf1DefenseAdjust')).toBe(false);
  const weapon = { id: 'w1', type: 'weapon' };
  const favorite = owned(TF1.favoriteWeapon, { system: { choice: 'w1' } });
  const holder = makeActor([owned('Compendium.essence20.decepticon_directive.Item.svqVyP2tyYzSUtn6'), favorite, weapon]);
  await tf1CombatPostRoll(holder, [], {}, { hits: [{ target: { uuid: 'Actor.f' }, hit: true }], rider: { weaponId: 'w1' } });
  expect(holder.setFlag).not.toHaveBeenCalled();
  expect(favoriteWeaponOf(holder)).toBe(weapon);
});

// Focused Blast is a DialogSelect + HitRider rule pair now (rules/conv10-slB10.test.js).

test('My Allies Are My Shield is rules on the Perk now (no Use here)', () => {
  expect(COMBAT_USES.map(use => use.id)).not.toContain('tf1ShieldTrade');
});

// Comms Assault's armor-ignoring is an ignoreArmor Defense rule now (rules/conv10-slB10.test.js).

test('Show Respect: pending becomes active for one turn', async () => {
  const holder = makeActor([owned(TF1.showRespect, { type: 'hangUp' })], { flags: { tf1Respect: { pending: ['Actor.f'] } } });
  await respectTurnStart(holder);
  expect(holder.flags.essence20.tf1Respect.active).toEqual(['Actor.f']);
  await respectTurnEnd(holder);
  expect(holder.flags.essence20.tf1Respect.active).toEqual([]);
});

test('Alt Mode Mimicry size limit', () => {
  expect(sizeClass('long')).toBe(sizeClass('large'));
  expect(mimicrySizeOk('common', 'large')).toBe(true);
  expect(mimicrySizeOk('common', 'huge')).toBe(false);
  expect(mimicrySizeOk('large', 'extended')).toBe(true);
  expect(mimicrySizeOk('huge', 'small')).toBe(true);
});

test('small helpers', () => {
  expect(sourceOf({ _stats: { compendiumSource: 'x' } })).toBe('x');
  expect(isDefeated({ statuses: new Set(['defeated']) })).toBe(true);
  expect(isDefeated({ statuses: new Set(), system: { health: { value: 3, max: 5 } } })).toBe(false);
});
