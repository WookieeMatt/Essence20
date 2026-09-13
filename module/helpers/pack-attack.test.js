import { jest } from '@jest/globals';
import { activatePackAttack, canUsePackAttack } from './pack-attack.mjs';

global.game = { combat: null };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ growlBank = undefined, disposition = 1 } = {}) {
  return {
    getFlag: jest.fn((scope, key) => (key == 'pendingGrowlShiftUp' ? growlBank : undefined)),
    setFlag: jest.fn(),
    getActiveTokens: jest.fn(() => [{ center: { x: 0, y: 0 }, document: { disposition } }]),
  };
}

function makeAllyToken(disposition = 1) {
  const actor = makeActor();
  return { actor, center: { x: 0, y: 0 }, document: { disposition } };
}

beforeEach(() => {
  canvas.tokens.placeables = [];
});

describe("canUsePackAttack", () => {
  test("true with a live Growl bank", () => {
    const actor = makeActor({ growlBank: { targetId: 'enemy1', combatId: null, round: null } });
    expect(canUsePackAttack(actor)).toBe(true);
  });

  test("false without one", () => {
    expect(canUsePackAttack(makeActor())).toBe(false);
  });
});

describe("activatePackAttack", () => {
  test("broadcasts the same target-scoped bonus to every nearby ally", async () => {
    const actor = makeActor({ growlBank: { targetId: 'enemy1', combatId: null, round: null } });
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [ally];

    const broadcast = await activatePackAttack(actor);

    expect(broadcast).toBe(true);
    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingGrowlShiftUp',
      expect.objectContaining({ targetId: 'enemy1' }));
  });

  test("returns false without a live Growl bank", async () => {
    const actor = makeActor();
    canvas.tokens.placeables = [makeAllyToken(1)];

    expect(await activatePackAttack(actor)).toBe(false);
  });

  test("returns false with no nearby allies", async () => {
    const actor = makeActor({ growlBank: { targetId: 'enemy1', combatId: null, round: null } });
    canvas.tokens.placeables = [];

    expect(await activatePackAttack(actor)).toBe(false);
  });
});
