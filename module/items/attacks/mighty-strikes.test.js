import { jest } from '@jest/globals';
import { applyMightyStrikes } from './mighty-strikes.mjs';

// Only the eligibility gating is unit-tested here - the actual catch (getTokensInShape, a real
// CONFIG.Region.documentClass, real Token placeables) is live-canvas code with no meaningful Jest
// stand-in, same as aoe-targeting.mjs's own placeAoeTemplate (see that file's doc comment). Every
// case below returns [] before ever touching canvas, so none of them need canvas mocked at all.

const MIGHTY_STRIKES_ID = "Compendium.essence20.gi_joe_crb.Item.P4agerpRunniHv6G";

function makeActor({ hasPerk = true, hasToken = true } = {}) {
  const items = hasPerk
    ? [{ type: 'perk', flags: { core: { sourceId: MIGHTY_STRIKES_ID } } }]
    : [];
  return {
    items,
    getActiveTokens: jest.fn(() => hasToken ? [{ id: 'attackerToken' }] : []),
  };
}

function makeMightMeleeEffect(overrides = {}) {
  return {
    type: 'weaponEffect',
    system: { classification: { skill: 'might', style: 'melee' }, totalReach: 5, ...overrides },
  };
}

describe("applyMightyStrikes", () => {
  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    await expect(applyMightyStrikes(actor, makeMightMeleeEffect())).resolves.toEqual([]);
    expect(actor.getActiveTokens).not.toHaveBeenCalled();
  });

  test("does nothing for a non-Might attack, even with the Perk", async () => {
    const actor = makeActor();
    const item = { type: 'weaponEffect', system: { classification: { skill: 'targeting', style: 'melee' } } };
    await expect(applyMightyStrikes(actor, item)).resolves.toEqual([]);
    expect(actor.getActiveTokens).not.toHaveBeenCalled();
  });

  test("does nothing for a non-melee Might attack, even with the Perk", async () => {
    const actor = makeActor();
    const item = { type: 'weaponEffect', system: { classification: { skill: 'might', style: 'projectile' } } };
    await expect(applyMightyStrikes(actor, item)).resolves.toEqual([]);
    expect(actor.getActiveTokens).not.toHaveBeenCalled();
  });

  test("does nothing for a non-weaponEffect item", async () => {
    const actor = makeActor();
    const item = { type: 'weapon', system: { classification: { skill: 'might', style: 'melee' } } };
    await expect(applyMightyStrikes(actor, item)).resolves.toEqual([]);
    expect(actor.getActiveTokens).not.toHaveBeenCalled();
  });

  test("does nothing without an active token on the scene", async () => {
    const actor = makeActor({ hasToken: false });
    await expect(applyMightyStrikes(actor, makeMightMeleeEffect())).resolves.toEqual([]);
  });
});
