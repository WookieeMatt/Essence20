import { jest } from '@jest/globals';
import {
  activateDataBridge, getAvailableDataBridgeSpecializations, getDataBridgeableAllies, getDataBridgedAllyCount,
  hasBorrowedDataBridgeSpecialization, isDataBridged, pickDataBridgeSpecialization,
} from './data-bridge.mjs';

const THINK_TANK_ID = "Compendium.essence20.enigma_of_combination.Item.TklqajBQCS7jiwpC";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};
global.game = { i18n: { localize: jest.fn((key) => key) }, combat: null };

function makeActorToken(disposition = 1) {
  return { document: { disposition }, center: {} };
}

function makeAllyToken({ disposition = 1, name = 'Ally', skills = {} } = {}) {
  const flagStore = {};
  return {
    document: { disposition },
    center: {},
    actor: {
      name, system: { skills },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    },
  };
}

function makeActor({ perkIds = [] } = {}) {
  const flagStore = {};
  const actorToken = makeActorToken();
  return {
    items: perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } })),
    getActiveTokens: jest.fn(() => [actorToken]),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("getAvailableDataBridgeSpecializations", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("lists every ally's own Skill Specializations", () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      name: 'Perceptor',
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];

    expect(getAvailableDataBridgeSpecializations(actor)).toEqual([
      { allyName: 'Perceptor', skill: 'culture', name: 'Arcane Lore' },
    ]);
  });

  test("ignores an enemy's own Specializations", () => {
    const actor = makeActor();
    const enemy = makeAllyToken({
      disposition: -1,
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), enemy];

    expect(getAvailableDataBridgeSpecializations(actor)).toEqual([]);
  });

  test("empty with no allies or no Specializations", () => {
    const actor = makeActor();
    canvas.tokens.placeables = [...actor.getActiveTokens(), makeAllyToken({ skills: {} })];

    expect(getAvailableDataBridgeSpecializations(actor)).toEqual([]);
  });
});

describe("pickDataBridgeSpecialization", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("returns null with nothing available, without opening a dialog", async () => {
    const waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    const actor = makeActor();
    canvas.tokens.placeables = [...actor.getActiveTokens()];

    expect(await pickDataBridgeSpecialization(actor)).toBeNull();
    expect(waitMock).not.toHaveBeenCalled();
  });

  test("returns the chosen skill/name on confirm", async () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      name: 'Perceptor',
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    expect(await pickDataBridgeSpecialization(actor)).toEqual({ skill: 'culture', name: 'Arcane Lore' });
  });

  test("returns null when cancelled", async () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await pickDataBridgeSpecialization(actor)).toBeNull();
  });
});

describe("activateDataBridge / hasBorrowedDataBridgeSpecialization", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("banks the chosen Specialization's skill", async () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    const result = await activateDataBridge(actor);

    expect(result).toEqual({ skill: 'culture', name: 'Arcane Lore' });
    expect(hasBorrowedDataBridgeSpecialization(actor, 'culture')).toBe(true);
    expect(hasBorrowedDataBridgeSpecialization(actor, 'technology')).toBe(false);
  });

  test("returns null with nothing to borrow", async () => {
    const actor = makeActor();
    canvas.tokens.placeables = [...actor.getActiveTokens()];

    expect(await activateDataBridge(actor)).toBeNull();
  });

  test("also banks it on every nearby ally", async () => {
    const actor = makeActor();
    const ally1 = makeAllyToken({
      name: 'Ally1', skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    const ally2 = makeAllyToken({ name: 'Ally2' });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally1, ally2];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    await activateDataBridge(actor);

    expect(isDataBridged(actor)).toBe(true);
    expect(isDataBridged(ally1.actor)).toBe(true);
    expect(isDataBridged(ally2.actor)).toBe(true);
  });
});

describe("isDataBridged", () => {
  test("false with nothing banked", () => {
    expect(isDataBridged(makeActor())).toBe(false);
  });
});

describe("getDataBridgedAllyCount", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("counts the caster and every Data-Bridged nearby ally", async () => {
    const actor = makeActor();
    const bridgedAlly = makeAllyToken({ name: 'Bridged' });
    const unbridgedAlly = makeAllyToken({ name: 'Unbridged' });
    canvas.tokens.placeables = [...actor.getActiveTokens(), bridgedAlly, unbridgedAlly];
    await actor.setFlag('essence20', 'pendingDataBridgeSpecialization', { skill: 'culture', name: 'Arcane Lore' });
    await bridgedAlly.actor.setFlag('essence20', 'pendingDataBridgeSpecialization', { skill: 'culture', name: 'Arcane Lore' });

    expect(getDataBridgedAllyCount(actor)).toBe(2);
  });

  test("0 with nobody Data Bridged", () => {
    const actor = makeActor();
    canvas.tokens.placeables = [...actor.getActiveTokens(), makeAllyToken({ name: 'Ally' })];

    expect(getDataBridgedAllyCount(actor)).toBe(0);
  });
});

describe("getDataBridgeableAllies", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("groups every ally's own specialized skills together", () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      name: 'Perceptor',
      skills: {
        culture: { specializations: { arcane: { name: 'Arcane Lore' } } },
        science: { specializations: { chem: { name: 'Chemistry' } } },
      },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];

    expect(getDataBridgeableAllies(actor)).toEqual([
      { allyName: 'Perceptor', skills: ['culture', 'science'] },
    ]);
  });
});

describe("Think Tank (Enigma of Combination, Hub Focus, Analyst, 20th level, p.29)", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("pickDataBridgeSpecialization offers a per-ally choice, borrowing every one of their Specializations", async () => {
    const actor = makeActor({ perkIds: [THINK_TANK_ID] });
    const ally = makeAllyToken({
      name: 'Perceptor',
      skills: {
        culture: { specializations: { arcane: { name: 'Arcane Lore' } } },
        science: { specializations: { chem: { name: 'Chemistry' } } },
      },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    const choice = await pickDataBridgeSpecialization(actor);

    expect(choice).toEqual({ skills: ['culture', 'science'] });
  });

  test("activateDataBridge banks the full skill list on the caster and every nearby ally", async () => {
    const actor = makeActor({ perkIds: [THINK_TANK_ID] });
    const source = makeAllyToken({
      name: 'Perceptor',
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } }, science: { specializations: { chem: { name: 'Chemistry' } } } },
    });
    const recipient = makeAllyToken({ name: 'Bumblebee' });
    canvas.tokens.placeables = [...actor.getActiveTokens(), source, recipient];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    await activateDataBridge(actor);

    expect(hasBorrowedDataBridgeSpecialization(actor, 'culture')).toBe(true);
    expect(hasBorrowedDataBridgeSpecialization(actor, 'science')).toBe(true);
    expect(hasBorrowedDataBridgeSpecialization(recipient.actor, 'culture')).toBe(true);
    expect(hasBorrowedDataBridgeSpecialization(recipient.actor, 'science')).toBe(true);
  });

  test("without Think Tank, the normal single-Specialization picker is used instead", async () => {
    const actor = makeActor();
    const ally = makeAllyToken({
      name: 'Perceptor',
      skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } },
    });
    canvas.tokens.placeables = [...actor.getActiveTokens(), ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('0') } } } };

    const choice = await pickDataBridgeSpecialization(actor);

    expect(choice).toEqual({ skill: 'culture', name: 'Arcane Lore' });
  });
});
