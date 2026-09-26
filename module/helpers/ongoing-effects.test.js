import { jest } from '@jest/globals';
import {
  addOngoingEffect, applyOngoingEffectsAtTurnEnd, getOngoingEffects, treatOngoingEffect,
} from './ongoing-effects.mjs';

function makeActor({ health = 10, immune = false } = {}) {
  const flags = {};
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    statuses: { has: jest.fn(() => false) },
    system: { health: { value: health }, immunities: immune ? { poison: true } : {} },
    update: jest.fn(async (data) => {
      if (data['system.health.value'] !== undefined) {
        actorHealthUpdate(data);
      }
    }),
  };
}

// applyDamage (helpers/combat.mjs) is run for REAL rather than module-mocked - see sheet-handlers/
// attachment-handler.test.js's own note on why unstable_mockModule isn't used in this project.
// Its own Health-loss path just needs actor.system.health/immunities/statuses and actor.update,
// all of which makeActor above already provides.
let lastHealthUpdate = null;
function actorHealthUpdate(data) {
  lastHealthUpdate = data;
}

describe("Ongoing/Poison/Toxin (Cobra Codex, New Weapon Effects and Traits, p.93-94)", () => {
  beforeEach(() => {
    lastHealthUpdate = null;
  });

  test("getOngoingEffects is empty for a fresh actor", () => {
    expect(getOngoingEffects(makeActor())).toEqual([]);
  });

  test("addOngoingEffect stacks a new pending effect", async () => {
    const actor = makeActor();
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 3, sourceName: 'Deadly Touch' });

    expect(getOngoingEffects(actor)).toEqual([
      { damageValue: 1, damageType: 'poison', roundsRemaining: 3, sourceName: 'Deadly Touch' },
    ]);
  });

  test("addOngoingEffect no-ops without a target or a round count", async () => {
    const actor = makeActor();
    await addOngoingEffect(null, { damageValue: 1, damageType: 'poison', roundsRemaining: 3, sourceName: 'x' });
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 0, sourceName: 'x' });

    expect(getOngoingEffects(actor)).toEqual([]);
  });

  test("addOngoingEffect stacks a second effect from a different source rather than overwriting", async () => {
    const actor = makeActor();
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 2, sourceName: 'Deadly Touch' });
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'toxin', roundsRemaining: 3, sourceName: 'Compound Z' });

    expect(getOngoingEffects(actor)).toHaveLength(2);
  });

  test("applyOngoingEffectsAtTurnEnd applies damage and decrements, keeping an effect that isn't done", async () => {
    const actor = makeActor({ health: 10 });
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 2, sourceName: 'Deadly Touch' });

    await applyOngoingEffectsAtTurnEnd(actor);

    expect(lastHealthUpdate).toEqual({ 'system.health.value': 9 });
    expect(getOngoingEffects(actor)).toEqual([
      { damageValue: 1, damageType: 'poison', roundsRemaining: 1, sourceName: 'Deadly Touch' },
    ]);
  });

  test("applyOngoingEffectsAtTurnEnd drops an effect once its rounds run out", async () => {
    const actor = makeActor({ health: 10 });
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 1, sourceName: 'Deadly Touch' });

    await applyOngoingEffectsAtTurnEnd(actor);

    expect(getOngoingEffects(actor)).toEqual([]);
  });

  test("applyOngoingEffectsAtTurnEnd skips applying damage for a Condition-only (damageValue 0) effect but still ticks it down", async () => {
    const actor = makeActor({ health: 10 });
    await addOngoingEffect(actor, { damageValue: 0, damageType: 'special', roundsRemaining: 2, sourceName: 'Compound Z' });

    await applyOngoingEffectsAtTurnEnd(actor);

    expect(lastHealthUpdate).toBeNull();
    expect(getOngoingEffects(actor)[0].roundsRemaining).toBe(1);
  });

  test("applyOngoingEffectsAtTurnEnd is a no-op with nothing pending", async () => {
    const actor = makeActor();
    await applyOngoingEffectsAtTurnEnd(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("treatOngoingEffect clears one pending effect by index", async () => {
    const actor = makeActor();
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 2, sourceName: 'A' });
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'toxin', roundsRemaining: 3, sourceName: 'B' });

    await treatOngoingEffect(actor, 0);

    expect(getOngoingEffects(actor)).toEqual([
      { damageValue: 1, damageType: 'toxin', roundsRemaining: 3, sourceName: 'B' },
    ]);
  });

  test("treatOngoingEffect ignores an out-of-range index", async () => {
    const actor = makeActor();
    await addOngoingEffect(actor, { damageValue: 1, damageType: 'poison', roundsRemaining: 2, sourceName: 'A' });

    await treatOngoingEffect(actor, 5);

    expect(getOngoingEffects(actor)).toHaveLength(1);
  });
});
