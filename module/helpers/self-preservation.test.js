import { jest } from '@jest/globals';
import { activateSelfPreservation, consumeSelfPreservationImmunity } from './self-preservation.mjs';
import { ENERGY_AFFINITY_ID } from './energy-affinity.mjs';

function setGame() {
  global.game = { combat: null, i18n: { localize: (k) => k, format: (k) => k } };
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
}

function makeActor({ choice = 'fire', energon = 2 } = {}) {
  const flags = {};
  const actor = {
    name: 'Test Actor',
    items: [{ type: 'perk', flags: { core: { sourceId: ENERGY_AFFINITY_ID } }, system: { choice } }],
    system: { energon: { normal: { value: energon } } },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key];
    }),
    update: jest.fn(async (data) => {
      actor.system.energon.normal.value = data['system.energon.normal.value'];
    }),
  };
  return actor;
}

describe("Self-Preservation (Decepticon Directive, Elementalist Focus, p.53)", () => {
  test("activateSelfPreservation spends 1 Energon and banks the pending Immunity", async () => {
    setGame();
    const actor = makeActor({ energon: 2 });

    await activateSelfPreservation(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingSelfPreservationImmunity', expect.any(Object));
  });

  test("refuses to activate with no Energon to spend", async () => {
    setGame();
    const actor = makeActor({ energon: 0 });

    await activateSelfPreservation(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("consumeSelfPreservationImmunity is true (and clears) for a hit of the chosen Element, false otherwise", async () => {
    setGame();
    const actor = makeActor({ choice: 'fire', energon: 1 });
    await activateSelfPreservation(actor);

    expect(await consumeSelfPreservationImmunity(actor, 'sonic')).toBe(false);
    expect(await consumeSelfPreservationImmunity(actor, 'fire')).toBe(true);
    // Consumed - a second hit isn't immune anymore.
    expect(await consumeSelfPreservationImmunity(actor, 'fire')).toBe(false);
  });

  test("consumeSelfPreservationImmunity is false with nothing banked", async () => {
    setGame();
    const actor = makeActor({ choice: 'fire' });
    expect(await consumeSelfPreservationImmunity(actor, 'fire')).toBe(false);
  });
});
