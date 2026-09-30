import { jest } from '@jest/globals';
import { activatePackAttack, canUsePackAttack, packAttackGrant } from './pack-attack.mjs';

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
  test("grants every nearby ally a target-scoped record for the rest of the scene out of Combat", async () => {
    const actor = makeActor({ growlBank: { targetId: 'enemy1', combatId: null, round: null } });
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [ally];

    const broadcast = await activatePackAttack(actor);

    expect(broadcast).toBe(true);
    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', 'packAttackGrowl',
      { targetId: 'enemy1', label: 'Pack Attack', sceneEpoch: 1 });
    expect(ally.actor.setFlag).not.toHaveBeenCalledWith('essence20', 'pendingGrowlShiftUp', expect.anything());
  });

  test("in Combat, runs until the turn before the user's own next turn", async () => {
    const actor = makeActor({ growlBank: { targetId: 'enemy1' } });
    actor.id = 'me';
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [ally];
    game.combat = { id: 'c1', round: 2, turn: 1, turns: [{ actor: { id: 'x' } }, { actor: { id: 'me' } }, { actor: { id: 'y' } }] };

    await activatePackAttack(actor);
    game.combat = null;

    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', 'packAttackGrowl',
      expect.objectContaining({ combatId: 'c1', untilRound: 3, untilTurn: 0 }));
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

describe("packAttackGrant", () => {
  const ally = record => ({ getFlag: jest.fn((scope, key) => (key == 'packAttackGrowl' ? record : undefined)) });
  const enemy = { id: 'enemy1' };

  test("applies to every attack on that target while it runs, not only the first", () => {
    const holder = ally({ targetId: 'enemy1', label: 'Pack Attack', sceneEpoch: 1 });
    expect(packAttackGrant(holder, enemy)).toEqual(expect.objectContaining({ label: 'Pack Attack' }));
    expect(packAttackGrant(holder, enemy)).not.toBeNull();
  });

  test("not against a different target, or after the scene changed", () => {
    expect(packAttackGrant(ally({ targetId: 'enemy1', sceneEpoch: 1 }), { id: 'other' })).toBeNull();
    expect(packAttackGrant(ally({ targetId: 'enemy1', sceneEpoch: 0 }), enemy)).toBeNull();
  });

  test("in Combat, ends when the user's next turn begins", () => {
    const holder = ally({ targetId: 'enemy1', sceneEpoch: 1, combatId: 'c1', untilRound: 3, untilTurn: 0 });
    game.combat = { id: 'c1', round: 3, turn: 0 };
    expect(packAttackGrant(holder, enemy)).not.toBeNull();
    game.combat = { id: 'c1', round: 3, turn: 1 };
    expect(packAttackGrant(holder, enemy)).toBeNull();
    game.combat = { id: 'c2', round: 1, turn: 0 };
    expect(packAttackGrant(holder, enemy)).toBeNull();
    game.combat = null;
  });
});
