import { isSuppressedOutOfEnvironment } from './environment-gated-effects.mjs';

const ENVIRONMENTAL_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ";

function makeActor({ hasPerk = true, active = true } = {}) {
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: ENVIRONMENTAL_EXPERTISE_ID } } }] : [];
  return {
    documentName: 'Actor',
    items,
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
