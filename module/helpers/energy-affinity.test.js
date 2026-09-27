import { jest } from '@jest/globals';
import { activateEnergyAffinity, ENERGY_AFFINITY_ID, getEnergyAffinityAlteredStyle, onEnergyAffinityUse } from './energy-affinity.mjs';

function setGame({ sceneEpoch = 1 } = {}) {
  global.game = {
    settings: { get: jest.fn(() => sceneEpoch) },
    i18n: { localize: (k) => k, format: (k) => k },
  };
  global.ui = { notifications: { warn: jest.fn() } };
}

function makeActor({ choice = 'fire', energon = 2 } = {}) {
  const flags = {};
  return {
    name: 'Test Actor',
    items: [{ type: 'perk', flags: { core: { sourceId: ENERGY_AFFINITY_ID } }, system: { choice } }],
    system: { energon: { normal: { value: energon } } },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    update: jest.fn(async (data) => {
      Object.assign(actorRef.system.energon.normal, { value: data['system.energon.normal.value'] });
    }),
  };
}

// A forward reference used only inside makeActor's own update mock above.
let actorRef;

beforeEach(() => {
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
});

describe("Energy Affinity (Decepticon Directive, Elementalist Focus, p.53-54) - activation", () => {
  test("activateEnergyAffinity bans a style for the current scene and spends 1 Energon", async () => {
    setGame();
    const actor = makeActor({ energon: 2 });
    actorRef = actor;

    await activateEnergyAffinity(actor, 'melee');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'energyAffinityAltered', { epoch: 1, style: 'melee' });
    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
  });

  test("refuses to activate with no Energon to spend", async () => {
    setGame();
    const actor = makeActor({ energon: 0 });
    actorRef = actor;

    await activateEnergyAffinity(actor, 'melee');

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("getEnergyAffinityAlteredStyle reads back the active style for the current scene only", async () => {
    setGame({ sceneEpoch: 1 });
    const actor = makeActor();
    actorRef = actor;
    await activateEnergyAffinity(actor, 'ranged');

    expect(getEnergyAffinityAlteredStyle(actor)).toBe('ranged');

    // A new scene has begun - the flag is stale.
    setGame({ sceneEpoch: 2 });
    expect(getEnergyAffinityAlteredStyle(actor)).toBeNull();
  });

  test("getEnergyAffinityAlteredStyle returns null when never activated", () => {
    setGame();
    expect(getEnergyAffinityAlteredStyle(makeActor())).toBeNull();
  });

  test("onEnergyAffinityUse prompts for a style and activates it, or does nothing if cancelled", async () => {
    setGame();
    const actor = makeActor();
    actorRef = actor;
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

    foundry.applications.api.DialogV2.wait.mockResolvedValue('ranged');
    await onEnergyAffinityUse(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'energyAffinityAltered', { epoch: 1, style: 'ranged' });

    actor.setFlag.mockClear();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    await onEnergyAffinityUse(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
