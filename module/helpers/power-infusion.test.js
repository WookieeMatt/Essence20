import { jest } from '@jest/globals';

import {
  activatePowerInfusion,
  actorHasPowerInfusion,
  filterMorphedAlliesInRange,
  getMorphedAlliesWithinRange,
} from './power-infusion.mjs';

const POWER_INFUSION_PERK_ID = "Compendium.essence20.pr_crb.Item.cuBM706WJjAmhoZO";

function makePowerInfusionPerk(currentValue = 1) {
  return {
    type: 'perk',
    _stats: { compendiumSource: POWER_INFUSION_PERK_ID },
    system: { advances: { type: 'rerolls', currentValue } },
  };
}

function makeActor({ hasPerk = true, isMorphed = true, personalPower = 1, name = 'Blue Ranger' } = {}) {
  const flagStore = {};
  return {
    name,
    type: 'playerCharacter',
    items: hasPerk ? [makePowerInfusionPerk()] : [],
    system: { isMorphed, powers: { personal: { value: personalPower } } },
    update: jest.fn(async () => {}),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    getActiveTokens: jest.fn(() => []),
    _flagStore: flagStore,
  };
}

describe("actorHasPowerInfusion", () => {
  test("true when the actor has a granted Power Infusion Perk", () => {
    expect(actorHasPowerInfusion(makeActor({ hasPerk: true }))).toBe(true);
  });

  test("false otherwise", () => {
    expect(actorHasPowerInfusion(makeActor({ hasPerk: false }))).toBe(false);
  });
});

describe("filterMorphedAlliesInRange", () => {
  const activator = { name: 'Activator', type: 'playerCharacter', system: { isMorphed: true } };

  test("excludes the activator themselves", () => {
    const candidates = [{ actor: activator, distance: 0 }];
    expect(filterMorphedAlliesInRange(candidates, activator)).toEqual([]);
  });

  test("excludes actors beyond 60 feet", () => {
    const farAlly = { name: 'Far', type: 'playerCharacter', system: { isMorphed: true } };
    const candidates = [{ actor: farAlly, distance: 61 }];
    expect(filterMorphedAlliesInRange(candidates, activator)).toEqual([]);
  });

  test("excludes non-Morphed actors", () => {
    const unmorphed = { name: 'Unmorphed', type: 'playerCharacter', system: { isMorphed: false } };
    const candidates = [{ actor: unmorphed, distance: 10 }];
    expect(filterMorphedAlliesInRange(candidates, activator)).toEqual([]);
  });

  test("excludes non-player-character actors (e.g. NPCs)", () => {
    const npc = { name: 'Monster', type: 'npc', system: { isMorphed: true } };
    const candidates = [{ actor: npc, distance: 10 }];
    expect(filterMorphedAlliesInRange(candidates, activator)).toEqual([]);
  });

  test("includes a Morphed Power Ranger teammate within range", () => {
    const ally = { name: 'Red Ranger', type: 'playerCharacter', system: { isMorphed: true } };
    const candidates = [{ actor: ally, distance: 60 }]; // exactly at the boundary
    expect(filterMorphedAlliesInRange(candidates, activator)).toEqual([ally]);
  });
});

describe("getMorphedAlliesWithinRange", () => {
  test("returns no allies when the activator has no token on the current scene", () => {
    const actor = makeActor();
    expect(getMorphedAlliesWithinRange(actor)).toEqual([]);
  });

  test("measures real token distance and filters via filterMorphedAlliesInRange", () => {
    const activatorActor = { name: 'Activator', type: 'playerCharacter', system: { isMorphed: true } };
    const activatorToken = { getCenterPoint: () => ({ x: 0, y: 0 }) };
    activatorActor.getActiveTokens = jest.fn(() => [activatorToken]);

    const nearAllyActor = { name: 'Near Ally', type: 'playerCharacter', system: { isMorphed: true } };
    const nearTokenDoc = { actor: nearAllyActor, getCenterPoint: () => ({ x: 1, y: 0 }) };
    const farAllyActor = { name: 'Far Ally', type: 'playerCharacter', system: { isMorphed: true } };
    const farTokenDoc = { actor: farAllyActor, getCenterPoint: () => ({ x: 100, y: 0 }) };

    global.canvas = {
      scene: { tokens: [nearTokenDoc, farTokenDoc] },
      grid: {
        measurePath: jest.fn(([a, b]) => ({ distance: Math.abs(a.x - b.x) })),
      },
    };

    try {
      const allies = getMorphedAlliesWithinRange(activatorActor);
      expect(allies).toEqual([nearAllyActor]);
    } finally {
      delete global.canvas;
    }
  });
});

describe("activatePowerInfusion", () => {
  test("fails without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    expect(await activatePowerInfusion(actor)).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("fails when not Morphed", async () => {
    const actor = makeActor({ isMorphed: false });
    expect(await activatePowerInfusion(actor)).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("fails without enough Personal Power", async () => {
    const actor = makeActor({ personalPower: 0 });
    expect(await activatePowerInfusion(actor)).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("succeeds solo: banks a reroll charge on the activator and spends 1 Personal Power", async () => {
    const actor = makeActor({ personalPower: 2 });

    expect(await activatePowerInfusion(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bankedReroll', { values: [1], source: 'Power Infusion' });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
  });

  test("can't be activated twice in the same scene", async () => {
    const actor = makeActor({ personalPower: 2 });

    expect(await activatePowerInfusion(actor)).toBe(true);
    expect(await activatePowerInfusion(actor)).toBe(false);
    expect(actor.update).toHaveBeenCalledTimes(1); // Personal Power only spent once
  });

  test("18th level (advances.currentValue 2) banks both 1s and 2s", async () => {
    const actor = makeActor();
    actor.items = [makePowerInfusionPerk(2)];

    await activatePowerInfusion(actor);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bankedReroll', { values: [1, 2], source: 'Power Infusion' });
  });

  test("also banks a charge on every Morphed ally within range", async () => {
    const actor = makeActor({ personalPower: 1 });
    const allyActor = makeActor({ personalPower: 1, name: 'Red Ranger' });
    actor.getActiveTokens = jest.fn(() => [{ getCenterPoint: () => ({ x: 0, y: 0 }) }]);

    global.canvas = {
      scene: { tokens: [{ actor: allyActor, getCenterPoint: () => ({ x: 1, y: 0 }) }] },
      grid: { measurePath: jest.fn(() => ({ distance: 10 })) },
    };

    try {
      await activatePowerInfusion(actor);
      expect(allyActor.setFlag).toHaveBeenCalledWith('essence20', 'bankedReroll', { values: [1], source: 'Power Infusion' });
      // The activator alone pays the Personal Power cost - RAW says "you spend 1 Personal Power",
      // not each ally.
      expect(allyActor.update).not.toHaveBeenCalled();
    } finally {
      delete global.canvas;
    }
  });
});
