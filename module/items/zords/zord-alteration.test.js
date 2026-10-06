import { jest } from '@jest/globals';
import { applyZordAlteration, pickZordAlterationOption, pickZordAlterationResistanceType } from './zord-alteration.mjs';

function makeZord(overrides = {}) {
  return {
    update: jest.fn(async function (data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.replace(/^system\./, '').split('.');
        let target = this.system;
        for (let i = 0; i < keys.length - 1; i++) {
          target = target[keys[i]];
        }

        target[keys[keys.length - 1]] = value;
      }
    }),
    system: {
      essences: { strength: { value: 6 }, speed: { value: 4 } },
      health: { max: 6, value: 6 },
      movement: { aerial: { base: 0 }, climb: { base: 0 }, ground: { base: 40 }, swim: { base: 0 } },
      resistances: {},
      size: 'huge',
      ...overrides,
    },
  };
}

function makePilot(zord) {
  global.fromUuidSync = jest.fn(() => zord);
  return { system: { actors: zord ? { a: { uuid: 'Actor.zord1', type: 'zord' } } : {} } };
}

beforeEach(() => {
  global.ui.notifications.warn.mockClear();
});

describe("pickZordAlterationOption", () => {
  test("returns the chosen option", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('sizeIncrease') } } } };
    expect(await pickZordAlterationOption()).toBe('sizeIncrease');
  });

  test("returns null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    expect(await pickZordAlterationOption()).toBeNull();
  });
});

describe("pickZordAlterationResistanceType", () => {
  test("returns the chosen damage type", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('fire') } } } };
    expect(await pickZordAlterationResistanceType()).toBe('fire');
  });

  test("returns null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    expect(await pickZordAlterationResistanceType()).toBeNull();
  });
});

describe("applyZordAlteration", () => {
  test("warns and does nothing without an owned Zord", async () => {
    const pilot = makePilot(null);
    await applyZordAlteration(pilot);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.ZordAlterationNoZord');
  });

  test("does nothing when the option picker is cancelled", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    await applyZordAlteration(pilot);

    expect(zord.update).not.toHaveBeenCalled();
  });

  test("essenceStrength adds 2 to Strength Essence", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('essenceStrength') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.essences.strength.value).toBe(8);
    expect(zord.system.essences.speed.value).toBe(4);
  });

  test("essenceSpeed adds 2 to Speed Essence", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('essenceSpeed') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.essences.speed.value).toBe(6);
    expect(zord.system.essences.strength.value).toBe(6);
  });

  test("essenceBoth adds 1 to both Essences", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('essenceBoth') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.essences.strength.value).toBe(7);
    expect(zord.system.essences.speed.value).toBe(5);
  });

  test("sizeIncrease bumps Size Class by one and grants +1 Health", async () => {
    const zord = makeZord({ size: 'huge' });
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('sizeIncrease') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.size).toBe('extended');
    expect(zord.system.health.max).toBe(7);
    expect(zord.system.health.value).toBe(7);
  });

  test("sizeDecrease drops Size Class by one and adds 10ft to every Movement type", async () => {
    const zord = makeZord({ size: 'extended' });
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('sizeDecrease') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.size).toBe('huge');
    expect(zord.system.movement.aerial.base).toBe(10);
    expect(zord.system.movement.climb.base).toBe(10);
    expect(zord.system.movement.ground.base).toBe(50);
    expect(zord.system.movement.swim.base).toBe(10);
  });

  test("sizeDecrease is floored at Huge", async () => {
    const zord = makeZord({ size: 'huge' });
    const pilot = makePilot(zord);
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('sizeDecrease') } } } };

    await applyZordAlteration(pilot);

    expect(zord.system.size).toBe('huge');
  });

  test("resistance grants Resistance to the chosen Element damage type", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValueOnce('resistance').mockResolvedValueOnce('cold') } } },
    };

    await applyZordAlteration(pilot);

    expect(zord.system.resistances.cold).toBe(true);
  });

  test("resistance applies nothing when the damage-type picker is cancelled", async () => {
    const zord = makeZord();
    const pilot = makePilot(zord);
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValueOnce('resistance').mockResolvedValueOnce('cancel') } } },
    };

    await applyZordAlteration(pilot);

    expect(zord.update).not.toHaveBeenCalled();
  });
});
