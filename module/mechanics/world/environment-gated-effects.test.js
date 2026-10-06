import { readFileSync } from 'fs';
import { isSuppressedOutOfEnvironment } from './environment-gated-effects.mjs';

// The Perk's own EnvironmentalExpertise rule (rules/plugins/effects/environmental-expertise-rule.mjs).
const EE_RULES = JSON.parse(readFileSync('packs/gijcrbitems/_source/Environmental_Expertise_EbbSUA2vSHyv3MjQ.json', 'utf8')).system.rules;

function makeActor({ hasPerk = true, active = true } = {}) {
  const items = hasPerk
    ? [{ id: 'ee', type: 'perk', flags: {}, system: { rules: EE_RULES } }] : [];
  return {
    documentName: 'Actor',
    items,
    flags: { essence20: { environmentalExpertiseActive: active } },
    getFlag: (scope, key) => (scope == 'essence20' && key == 'environmentalExpertiseActive' ? active : undefined),
  };
}

describe('isSuppressedOutOfEnvironment', () => {
  test('suppresses a whileInEnvironmentOfExpertise effect when the toggle is off', () => {
    const effect = { parent: makeActor({ active: false }) };

    expect(isSuppressedOutOfEnvironment({ whileInEnvironmentOfExpertise: true, parent: effect })).toBe(true);
  });

  test('suppresses when the actor never took Environmental Expertise at all', () => {
    const effect = { parent: makeActor({ hasPerk: false, active: true }) };

    expect(isSuppressedOutOfEnvironment({ whileInEnvironmentOfExpertise: true, parent: effect })).toBe(true);
  });

  test('lets it apply while in-environment (undefined, so duration expiry still decides)', () => {
    const effect = { parent: makeActor({ hasPerk: true, active: true }) };

    expect(
      isSuppressedOutOfEnvironment({ whileInEnvironmentOfExpertise: true, parent: effect }),
    ).toBeUndefined();
  });

  test('suppresses on an effect with no owning actor', () => {
    const item = { documentName: 'Item', actor: null, parent: null };

    expect(
      isSuppressedOutOfEnvironment({ whileInEnvironmentOfExpertise: true, parent: { parent: item } }),
    ).toBe(true);
  });

  test('has nothing to say about an ordinary effect', () => {
    const effect = { parent: makeActor({ hasPerk: false, active: false }) };
    expect(isSuppressedOutOfEnvironment({ whileInEnvironmentOfExpertise: false, parent: effect })).toBeUndefined();
    expect(isSuppressedOutOfEnvironment(null)).toBeUndefined();
  });
});
