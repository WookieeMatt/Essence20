import { jest } from '@jest/globals';
import { findEligibleProtector } from './interpose-attack.mjs';

const IMPENETRABLE_ARMOR_ID = "Compendium.essence20.gi_joe_crb.Item.vanN7kRYUhgHew7q";
const INTERPOSE_ID = "Compendium.essence20.gi_joe_crb.Item.srCQjZFTPhm2bK3D";

function makeActor({ id, perkIds = [] } = {}) {
  return {
    id, name: id, uuid: `Actor.${id}`,
    items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })),
    system: {},
    getActiveTokens: jest.fn(() => []),
  };
}

// Interpose, Body Shield, Heroic Sacrifice, Golden Guardian and Stand By Me are their items' own applyingDamage rules
// (rules/plugins/combat/applying-damage.mjs - rules/conv15-items1.test.js).
describe("findEligibleProtector (Impenetrable Armor)", () => {
  test("redirects to the pilot's own vehicle", () => {
    const vehicle = { id: 'vehicle1', type: 'vehicle' };
    const target = makeActor({ id: 'driver1', perkIds: [IMPENETRABLE_ARMOR_ID] });
    target._dice = { _getPilotedVehicle: (actor, role) => (role == 'driver' ? vehicle : null) };
    expect(findEligibleProtector(target)).toEqual({ protector: vehicle, perkId: IMPENETRABLE_ARMOR_ID });
  });

  test("not without a piloted vehicle, without the Perk, or for another protector Perk", () => {
    const vehicle = { id: 'vehicle1', type: 'vehicle' };
    const unmounted = makeActor({ id: 'driver1', perkIds: [IMPENETRABLE_ARMOR_ID] });
    unmounted._dice = { _getPilotedVehicle: () => null };
    expect(findEligibleProtector(unmounted)).toBeNull();

    const without = makeActor({ id: 'driver2', perkIds: [INTERPOSE_ID] });
    without._dice = { _getPilotedVehicle: () => vehicle };
    expect(findEligibleProtector(without)).toBeNull();
  });
});
