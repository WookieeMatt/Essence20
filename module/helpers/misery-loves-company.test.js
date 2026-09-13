import { jest } from '@jest/globals';
import {
  applyMiseryLovesCompany, getAffectedDataBridgeAllies, getDataBridgedAllyTokens, pickMiseryLovesCompanyTransfer,
} from './misery-loves-company.mjs';

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};
global.game = { i18n: { localize: jest.fn((key) => key) } };

function makeActorToken(disposition = 1) {
  return { document: { disposition }, center: {} };
}

function makeAllyToken({ name = 'Ally', disposition = 1, statuses = [], dataBridgeFlag } = {}) {
  return {
    document: { disposition },
    center: {},
    actor: {
      name,
      statuses: new Set(statuses),
      getFlag: jest.fn((scope, key) => (key == 'pendingDataBridgeSpecialization' ? dataBridgeFlag : undefined)),
      toggleStatusEffect: jest.fn(),
    },
  };
}

function makeActor({ statuses = [], dataBridgeFlag } = {}) {
  const actorToken = makeActorToken();
  const actor = {
    name: 'Self',
    statuses: new Set(statuses),
    getActiveTokens: jest.fn(() => [actorToken]),
    getFlag: jest.fn((scope, key) => (key == 'pendingDataBridgeSpecialization' ? dataBridgeFlag : undefined)),
    toggleStatusEffect: jest.fn(),
  };
  actorToken.actor = actor;
  return actor;
}

describe("getAffectedDataBridgeAllies", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("includes the actor's own token when they're affected", () => {
    const actor = makeActor({ statuses: ['frightened'] });
    canvas.tokens.placeables = [actor.getActiveTokens()[0]];

    const pairs = getAffectedDataBridgeAllies(actor);
    expect(pairs).toEqual([{ token: actor.getActiveTokens()[0], condition: 'frightened' }]);
  });

  test("includes an ally's own affliction", () => {
    const actor = makeActor();
    const ally = makeAllyToken({ statuses: ['stunned'] });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];

    const pairs = getAffectedDataBridgeAllies(actor);
    expect(pairs).toContainEqual({ token: ally, condition: 'stunned' });
  });

  test("ignores an enemy's own affliction", () => {
    const actor = makeActor();
    const enemy = makeAllyToken({ disposition: -1, statuses: ['stunned'] });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], enemy];

    expect(getAffectedDataBridgeAllies(actor)).toEqual([]);
  });

  test("ignores a Condition outside the transmissible list", () => {
    const actor = makeActor({ statuses: ['prone'] });
    canvas.tokens.placeables = [actor.getActiveTokens()[0]];

    expect(getAffectedDataBridgeAllies(actor)).toEqual([]);
  });
});

describe("getDataBridgedAllyTokens", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("includes the actor's own token when Data Bridged", () => {
    const actor = makeActor({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0]];

    expect(getDataBridgedAllyTokens(actor)).toEqual([actor.getActiveTokens()[0]]);
  });

  test("excludes a non-Bridged ally", () => {
    const actor = makeActor({ dataBridgeFlag: { skill: 'culture' } });
    const ally = makeAllyToken({});
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];

    expect(getDataBridgedAllyTokens(actor)).toEqual([actor.getActiveTokens()[0]]);
  });
});

describe("pickMiseryLovesCompanyTransfer", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("returns null with no afflicted ally, even with a Bridged recipient available", async () => {
    const actor = makeActor({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0]];

    expect(await pickMiseryLovesCompanyTransfer(actor)).toBeNull();
  });

  test("returns null with no Bridged recipient, even with an afflicted ally available", async () => {
    const actor = makeActor({ statuses: ['frightened'] });
    canvas.tokens.placeables = [actor.getActiveTokens()[0]];

    expect(await pickMiseryLovesCompanyTransfer(actor)).toBeNull();
  });

  test("resolves the chosen source/destination pair on confirm", async () => {
    const actor = makeActor({ statuses: ['frightened'] });
    const ally = makeAllyToken({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ affected: '0', bridged: '0' }) } } },
    };

    const result = await pickMiseryLovesCompanyTransfer(actor);

    expect(result).toEqual({ source: actor, destination: ally.actor, condition: 'frightened' });
  });

  test("returns null when cancelled", async () => {
    const actor = makeActor({ statuses: ['frightened'] });
    const ally = makeAllyToken({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await pickMiseryLovesCompanyTransfer(actor)).toBeNull();
  });
});

describe("applyMiseryLovesCompany", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("cures the source and afflicts the destination with the same Condition", async () => {
    const actor = makeActor({ statuses: ['frightened'] });
    const ally = makeAllyToken({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ affected: '0', bridged: '0' }) } } },
    };

    const result = await applyMiseryLovesCompany(actor);

    expect(result).toBe('frightened');
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(ally.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
  });

  test("returns null when cancelled", async () => {
    const actor = makeActor({ statuses: ['frightened'] });
    const ally = makeAllyToken({ dataBridgeFlag: { skill: 'culture' } });
    canvas.tokens.placeables = [actor.getActiveTokens()[0], ally];
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    expect(await applyMiseryLovesCompany(actor)).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
