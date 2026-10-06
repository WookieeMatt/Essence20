import { jest } from '@jest/globals';
import { applyGotToGetTough } from './got-to-get-tough.mjs';

const GOT_TO_GET_TOUGH_ID = "Compendium.essence20.gi_joe_crb.Item.bIoMrn9aP9x6QYVL";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeToken({ actor, disposition = 1 } = {}) {
  return { actor, document: { disposition }, center: {} };
}

function makeAlly(health = { bonus: 0, value: 5 }) {
  return {
    system: { health: { ...health } },
    update: jest.fn(async (changes) => changes),
  };
}

function makeActor({ hasPerk = true } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: GOT_TO_GET_TOUGH_ID } } }] : [];
  const token = makeToken({ actor: null, disposition: 1 });
  return { items, getActiveTokens: jest.fn(() => [token]), _token: token };
}

describe("applyGotToGetTough", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReset();
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
  });

  test("grants +1 Health (both bonus and value) to nearby allies when the actor has the Perk", async () => {
    const actor = makeActor({ hasPerk: true });
    actor._token.actor = actor;
    const ally = makeAlly({ bonus: 0, value: 5 });
    const allyToken = makeToken({ actor: ally, disposition: 1 });
    canvas.tokens.placeables = [actor._token, allyToken];

    await applyGotToGetTough(actor);

    expect(ally.update).toHaveBeenCalledWith({
      "system.health.bonus": 1,
      "system.health.value": 6,
    });
  });

  test("grants Health even above the ally's normal max (no cap applied here)", async () => {
    const actor = makeActor({ hasPerk: true });
    actor._token.actor = actor;
    const ally = makeAlly({ bonus: 2, value: 10 });
    const allyToken = makeToken({ actor: ally, disposition: 1 });
    canvas.tokens.placeables = [actor._token, allyToken];

    await applyGotToGetTough(actor);

    expect(ally.update).toHaveBeenCalledWith({
      "system.health.bonus": 3,
      "system.health.value": 11,
    });
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    actor._token.actor = actor;
    const ally = makeAlly();
    const allyToken = makeToken({ actor: ally, disposition: 1 });
    canvas.tokens.placeables = [actor._token, allyToken];

    await applyGotToGetTough(actor);

    expect(ally.update).not.toHaveBeenCalled();
  });

  test("does nothing when there are no nearby allies", async () => {
    const actor = makeActor({ hasPerk: true });
    actor._token.actor = actor;
    canvas.tokens.placeables = [actor._token];

    await expect(applyGotToGetTough(actor)).resolves.toBeUndefined();
  });

  test("does nothing for a null/undefined actor", async () => {
    await expect(applyGotToGetTough(null)).resolves.toBeUndefined();
  });

  test("updates every nearby ally, not just the first", async () => {
    const actor = makeActor({ hasPerk: true });
    actor._token.actor = actor;
    const ally1 = makeAlly({ bonus: 0, value: 5 });
    const ally2 = makeAlly({ bonus: 0, value: 8 });
    canvas.tokens.placeables = [
      actor._token,
      makeToken({ actor: ally1, disposition: 1 }),
      makeToken({ actor: ally2, disposition: 1 }),
    ];

    await applyGotToGetTough(actor);

    expect(ally1.update).toHaveBeenCalledWith({ "system.health.bonus": 1, "system.health.value": 6 });
    expect(ally2.update).toHaveBeenCalledWith({ "system.health.bonus": 1, "system.health.value": 9 });
  });
});
