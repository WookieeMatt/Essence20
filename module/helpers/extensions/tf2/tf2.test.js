import { jest } from '@jest/globals';
import {
  tf2RollSources,
} from './rolls.mjs';
import { specialAttackUpdates } from '../../weapon-fit.mjs';

const actor = (items = [], extra = {}) => ({
  uuid: extra.uuid ?? 'Actor.a', id: extra.id ?? 'a', name: extra.name ?? 'A', type: extra.type ?? 'character',
  system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, statuses: new Set(extra.statuses ?? []), items: { contents: items },
});

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], combat: null };
  global.CONFIG = {
    E20: {
      skillToEssence: { science: 'smarts', persuasion: 'social', might: 'strength', athletics: 'strength', alertness: 'smarts', driving: 'speed' },
      skills: {}, availabilityDifficulties: { standard: 0, limited: 10, restricted: 15 },
    },
  };
  global.ui = { notifications: { warn: jest.fn() } };
});

test('Broad Understanding, Applied Science, Determine Probability and Energon Bank are rules now', async () => {
  const { registrySnapshot } = await import('../../extensions.mjs');
  const ids = registrySnapshot().uses.map(entry => entry.id);
  for (const id of ['tf2AppliedScience', 'tf2DetermineProbability', 'tf2EnergonBank']) {
    expect(ids).not.toContain(id);
  }

  // A Science roll gets nothing from this slice any more.
  const holder = actor([], { system: { skills: { science: { specializations: { chem: { name: 'Chemistry' } } } } } });
  expect(tf2RollSources(holder, null, { rolledSkill: 'science', dataset: {} })).toEqual({ sources: [], consumes: [] });
});

test('Duke It Out is rules now: no Use here, and an old refusal mark gives no Edge', async () => {
  const { registrySnapshot } = await import('../../extensions.mjs');
  expect(registrySnapshot().uses.map(entry => entry.id)).not.toContain('tf2DukeItOut');
  const challenger = actor([], { uuid: 'Actor.d' });
  const refused = actor([], { uuid: 'Actor.x', flags: { riderMarks: [{ kind: 'tf2DukeRefused', by: 'Actor.d' }] } });
  expect(tf2RollSources(challenger, refused, { rolledSkill: 'might' }).sources).toEqual([]);
});

test('special-attack weapons are fitted to the chassis: damage, Blunt or Sharp, Finesse or Might', () => {
  const effect = (id, system) => ({ id, system });
  const weapon = {
    system: {
      traits: ['blunt', 'integrated'],
      items: {
        a: { type: 'weaponEffect', damageType: 'blunt', damageValue: 1, classification: { skill: 'might' } },
        b: { type: 'weaponEffect', damageType: 'maneuver', damageValue: null, classification: { skill: 'might' } },
      },
    },
  };
  const effects = [effect('e1', { damageType: 'blunt', damageValue: 1, classification: { skill: 'might' } }),
    effect('e2', { damageType: 'maneuver', damageValue: null, classification: { skill: 'might' } })];

  const sharp = specialAttackUpdates(weapon, effects, { type: 'sharp', skill: 'finesse', skills: ['finesse', 'might'] });
  expect(sharp.effectUpdates).toEqual([
    { _id: 'e1', 'system.damageType': 'sharp', 'system.classification.skill': 'finesse' },
    { _id: 'e2', 'system.classification.skill': 'finesse' },
  ]);
  expect(sharp.weaponUpdate).toEqual({
    'system.items.a.damageType': 'sharp', 'system.items.a.classification.skill': 'finesse', 'system.items.b.classification.skill': 'finesse',
    'system.traits': ['sharp', 'integrated'],
  });

  // The Charger's Ram: only the Blunt hit's damage changes; picking Blunt / Might changes nothing.
  expect(specialAttackUpdates(weapon, effects, { damage: 2 }).effectUpdates).toEqual([{ _id: 'e1', 'system.damageValue': 2 }]);
  expect(specialAttackUpdates(weapon, effects, { type: 'blunt', skill: 'might', skills: ['finesse', 'might'] }))
    .toEqual({ effectUpdates: [], weaponUpdate: {} });
});

// We Are One!'s team reroll is a picked-scope Reroll rule on the Perk (rules/conv12-slI12.test.js).

test('Deconstruct and Cage are rules now; the Repair button stays on a sabotaged item', async () => {
  const { USES } = await import('./uses.mjs');
  expect(USES.map(use => use.id)).toEqual(['tf2Repair']);
  expect(USES[0].matches({ flags: { essence20: { tf2Deconstructed: { dif: 10 } } } })).toBe(true);
});
