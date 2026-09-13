import { jest } from '@jest/globals';
import {
  activateHupHupHupHupHup, broadcastHupHupHupHupHupBonus, getHupHupHupHupHupBonus,
} from './hup-hup-hup-hup-hup.mjs';

global.game = { combat: null };
global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };

function makeAllyToken(disposition = 1) {
  const flagStore = {};
  const actor = {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => { flagStore[key] = value; }),
    _flags: flagStore,
  };
  return { actor, document: { disposition }, center: { x: 0, y: 0 } };
}

function makeOfficer(selfToken) {
  return { getActiveTokens: jest.fn(() => [selfToken]), _dice: { rollSkill: jest.fn() } };
}

describe("activateHupHupHupHupHup", () => {
  test("rolls a flat DIF 0 Intimidation Skill Test, flagged for post-hit processing", async () => {
    const officer = { _dice: { rollSkill: jest.fn() } };

    await activateHupHupHupHupHup(officer);

    expect(officer._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', dif: '0', isHupHupHupHupHupAttempt: true }),
      officer,
    );
  });
});

describe("broadcastHupHupHupHupHupBonus / getHupHupHupHupHupBonus", () => {
  afterEach(() => {
    canvas.tokens.placeables = [];
    game.combat = null;
  });

  test("banks the rounded-down total on every nearby ally, but not the Officer themselves", async () => {
    const selfToken = makeAllyToken(1);
    const officer = makeOfficer(selfToken);
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [selfToken, ally];
    game.combat = { round: 2 };

    await broadcastHupHupHupHupHupBonus(officer, 24); // rounds down to 20

    expect(ally.actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingHupHupHupHupHupBonus', { bonus: 20, expiresRound: 3 });
    expect(getHupHupHupHupHupBonus(ally.actor)).toBe(20);
  });

  test("does nothing when the rounded-down total is 0", async () => {
    const selfToken = makeAllyToken(1);
    const officer = makeOfficer(selfToken);
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [selfToken, ally];

    await broadcastHupHupHupHupHupBonus(officer, 4); // rounds down to 0

    expect(ally.actor.setFlag).not.toHaveBeenCalled();
  });

  test("expires once the round has advanced past expiresRound", async () => {
    const selfToken = makeAllyToken(1);
    const officer = makeOfficer(selfToken);
    const ally = makeAllyToken(1);
    canvas.tokens.placeables = [selfToken, ally];
    game.combat = { round: 1 };

    await broadcastHupHupHupHupHupBonus(officer, 20);
    expect(getHupHupHupHupHupBonus(ally.actor)).toBe(20);

    game.combat = { round: 3 };
    expect(getHupHupHupHupHupBonus(ally.actor)).toBe(0);
  });

  test("getHupHupHupHupHupBonus is 0 with no banked flag", () => {
    expect(getHupHupHupHupHupBonus(makeAllyToken().actor)).toBe(0);
  });
});
