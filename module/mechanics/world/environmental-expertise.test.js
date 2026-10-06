import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getEnvironmentOfExpertiseSourceLabel, getExpertiseEnvironments,
  hasActiveEnvironmentalExpertise, isEnvironmentalExpertiseActive, isInEnvironmentOfExpertise,
  isKnownOutsideEnvironmentOfExpertise, meetsEnvironmentOfExpertise,
} from './environmental-expertise.mjs';

// The Perk and Read The Land carry the EnvironmentalExpertise rule (rules/plugins/effects/environmental-expertise-rule.mjs).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rulesOf = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8')).system.rules;
const ENVIRONMENTAL_EXPERTISE_ID = 'environmentalExpertise';
const READ_THE_LAND_ID = 'readTheLand';
const RULES = {
  [ENVIRONMENTAL_EXPERTISE_ID]: rulesOf('gijcrbitems/_source/Environmental_Expertise_EbbSUA2vSHyv3MjQ.json'),
  [READ_THE_LAND_ID]: rulesOf('iafav2items/_source/Read_the_Land_j8wVLLK4XvVEuP6F.json'),
};

/**
 * @param {Object} [options]
 * @param {String} [options.terrain]   The scene terrain flag the actor's token stands on; omitted
 *   = no token and no scene, i.e. no terrain set anywhere.
 * @param {Array<String>} [options.environments]   The actor's chosen environments of expertise.
 */
function makeActor({
  hasPerk = true, active = false, perkId = ENVIRONMENTAL_EXPERTISE_ID, terrain, environments = ['arctic'],
} = {}) {
  const items = hasPerk ? [{ id: perkId, type: 'perk', name: 'Environmental Expertise', flags: {}, system: { rules: RULES[perkId] } }] : [];
  const flagStore = { environmentalExpertiseActive: active };
  const scene = { getFlag: (scope, key) => (key == 'terrain' ? terrain : undefined) };
  const token = { regions: [], parent: scene };
  return {
    documentName: 'Actor',
    getActiveTokens: () => (terrain === undefined ? [] : [token]),
    system: { environments },
    items,
    flags: { essence20: flagStore },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isEnvironmentalExpertiseActive", () => {
  test("false by default", () => {
    expect(isEnvironmentalExpertiseActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isEnvironmentalExpertiseActive(makeActor({ active: true }))).toBe(true);
  });
});

// (The Perk's own toggle is a pair of Use rules on it - rules/conv15-items2.test.js.)

describe("hasActiveEnvironmentalExpertise", () => {
  test("true with the Perk and the toggle active", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: true }))).toBe(true);
  });

  test("false with the Perk but the toggle inactive", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: false }))).toBe(false);
  });

  test("false without the Perk, even if the (unrelated) flag happens to be true", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: false, active: true }))).toBe(false);
  });

  test("true with Read The Land (instead of the base Perk) and the toggle active - same shared flag", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: true, perkId: READ_THE_LAND_ID }))).toBe(true);
  });

  test("false with Read The Land but the toggle inactive", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: false, perkId: READ_THE_LAND_ID }))).toBe(false);
  });
});

describe("with a scene terrain set", () => {
  test("getExpertiseEnvironments reads system.environments, empty when absent", () => {
    expect(getExpertiseEnvironments(makeActor({ environments: ['sea', 'urban'] }))).toEqual(['sea', 'urban']);
    expect(getExpertiseEnvironments({})).toEqual([]);
  });

  test("isInEnvironmentOfExpertise: true/false from the terrain, null when none is set", () => {
    expect(isInEnvironmentOfExpertise(makeActor({ terrain: 'arctic' }))).toBe(true);
    expect(isInEnvironmentOfExpertise(makeActor({ terrain: 'desert' }))).toBe(false);
    expect(isInEnvironmentOfExpertise(makeActor())).toBeNull();
    expect(isInEnvironmentOfExpertise(makeActor(), 'arctic')).toBe(true);
  });

  test("in an environment of expertise the benefits apply automatically, no toggle needed", () => {
    const actor = makeActor({ terrain: 'arctic', active: false });
    expect(hasActiveEnvironmentalExpertise(actor)).toBe(true);
    expect(meetsEnvironmentOfExpertise(actor)).toBe(true);
    expect(isKnownOutsideEnvironmentOfExpertise(actor)).toBe(false);
  });

  test("outside every environment of expertise the benefits are off...", () => {
    const actor = makeActor({ terrain: 'desert', active: false });
    expect(hasActiveEnvironmentalExpertise(actor)).toBe(false);
    expect(meetsEnvironmentOfExpertise(actor)).toBe(false);
    expect(isKnownOutsideEnvironmentOfExpertise(actor)).toBe(true);
  });

  test("...unless the Adaptation / Read The Land flag is on", () => {
    const actor = makeActor({ terrain: 'desert', active: true });
    expect(hasActiveEnvironmentalExpertise(actor)).toBe(true);
    expect(isKnownOutsideEnvironmentOfExpertise(actor)).toBe(false);
  });

  test("still needs the Perk (or Read The Land) for hasActiveEnvironmentalExpertise", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: false, terrain: 'arctic' }))).toBe(false);
    expect(meetsEnvironmentOfExpertise(makeActor({ hasPerk: false, terrain: 'arctic' }))).toBe(true);
  });

  test("with no terrain anywhere nothing is 'known outside' - Perks keep their old behavior", () => {
    expect(isKnownOutsideEnvironmentOfExpertise(makeActor({ active: false }))).toBe(false);
    expect(meetsEnvironmentOfExpertise(makeActor({ active: false }))).toBe(false);
    expect(meetsEnvironmentOfExpertise(makeActor({ active: true }))).toBe(true);
  });
});

describe("getEnvironmentOfExpertiseSourceLabel", () => {
  test("adds the terrain when it's what put the actor in their environment of expertise", () => {
    expect(getEnvironmentOfExpertiseSourceLabel(makeActor({ terrain: 'arctic' }), 'Recon')).toBe('Recon (E20.EnvironmentArctic)');
  });

  test("just the Perk name when the toggle / an Adaptation flag is the reason, or no terrain is set", () => {
    expect(getEnvironmentOfExpertiseSourceLabel(makeActor({ terrain: 'desert', active: true }), 'Recon')).toBe('Recon');
    expect(getEnvironmentOfExpertiseSourceLabel(makeActor({ active: true }), 'Recon')).toBe('Recon');
  });
});
