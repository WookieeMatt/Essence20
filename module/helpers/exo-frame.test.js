import { jest } from '@jest/globals';
import {
  EXO_FRAME_TESTED_FLAG,
  getEquippedExoFrame,
  getExoFrameDifficulty,
  getFeetMovedThisTurn,
  needsExoFramePrompt,
  onExoFrameActionSpent,
  onExoFrameTokenMoved,
  promptExoFrameTest,
  registerExoFrameHooks,
  rollExoFrameTest,
  wasExoFrameTestedThisTurn,
} from './exo-frame.mjs';

function makeArmor({ equipped = true, traits = ['exoFrame'] } = {}) {
  return { type: 'armor', system: { equipped, traits, upgradeTraits: [] } };
}

function makeActor({ armor = [makeArmor()], feet = 20, rollResult = { success: true } } = {}) {
  const flags = {};
  const history = feet ? [{ x: 0 }, { x: 1 }] : [];
  return {
    name: 'Tommy',
    items: { documentsByType: { armor } },
    token: {
      id: 'token1',
      movementHistory: history,
      measureMovementPath: jest.fn(() => ({ distance: feet })),
    },
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
    toggleStatusEffect: jest.fn(),
    _dice: { rollSkill: jest.fn(async () => rollResult) },
  };
}

function setGame({ tracking = true, combatant = { tokenId: 'token1' }, confirm = true, ledger = null } = {}) {
  global.game = {
    user: { id: 'user1' },
    i18n: { localize: jest.fn(key => key), format: jest.fn(key => key) },
    settings: { get: jest.fn((scope, key) => (key == 'actionEconomyMode' ? (tracking ? 'track' : 'off') : undefined)) },
    combat: combatant
      ? {
        id: 'combat1', round: 2, turn: 1, combatant,
        getCombatantsByActor: jest.fn(() => [{ tokenId: 'token1', getFlag: () => ledger }]),
      }
      : null,
  };
  global.ui = { notifications: { info: jest.fn(), warn: jest.fn() } };
  global.foundry = { applications: { api: { DialogV2: { confirm: jest.fn(async () => confirm) } } } };
}

beforeEach(() => setGame());

describe('getExoFrameDifficulty', () => {
  test('feet moved / 5, rounded up; 0 when nothing moved', () => {
    expect(getExoFrameDifficulty(0)).toBe(0);
    expect(getExoFrameDifficulty(5)).toBe(1);
    expect(getExoFrameDifficulty(22)).toBe(5);
    expect(getExoFrameDifficulty(30)).toBe(6);
  });
});

describe('getEquippedExoFrame', () => {
  test('finds equipped Exo-Frame armor only', () => {
    const armor = makeArmor();
    expect(getEquippedExoFrame(makeActor({ armor: [makeArmor({ traits: ['modular'] }), armor] }))).toBe(armor);
    expect(getEquippedExoFrame(makeActor({ armor: [makeArmor({ equipped: false })] }))).toBeNull();
    expect(getEquippedExoFrame(null)).toBeNull();
  });

  test('reads a plain items array too', () => {
    const armor = makeArmor();
    const items = [armor, { type: 'weapon', system: {} }];
    expect(getEquippedExoFrame({ items })).toBe(armor);
  });
});

describe('getFeetMovedThisTurn', () => {
  test('measures the token movement history', () => {
    expect(getFeetMovedThisTurn(makeActor({ feet: 25 }))).toBe(25);
  });

  test('0 without history, or when measuring throws', () => {
    expect(getFeetMovedThisTurn(makeActor({ feet: 0 }))).toBe(0);
    const actor = makeActor();
    actor.token.measureMovementPath = () => {
      throw new Error('no canvas');
    };

    expect(getFeetMovedThisTurn(actor)).toBe(0);
  });
});

describe('rollExoFrameTest', () => {
  test('rolls Driving at the computed DIF and stamps the turn', async () => {
    const actor = makeActor({ feet: 22 });
    const result = await rollExoFrameTest(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'driving', essence: 'speed', dif: '5' }), actor);
    expect(result).toEqual({ difficulty: 5, success: true });
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(wasExoFrameTestedThisTurn(actor)).toBe(true);
  });

  test('failure knocks the wearer Prone', async () => {
    const actor = makeActor({ rollResult: { success: false } });
    await rollExoFrameTest(actor);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
  });

  test('no movement, or a cancelled dialog, rolls/changes nothing', async () => {
    const still = makeActor({ feet: 0 });
    expect(await rollExoFrameTest(still)).toBeNull();
    expect(still._dice.rollSkill).not.toHaveBeenCalled();

    const cancelled = makeActor({ rollResult: { cancelled: true } });
    expect(await rollExoFrameTest(cancelled)).toBeNull();
    expect(cancelled.setFlag).not.toHaveBeenCalled();
  });
});

describe('needsExoFramePrompt / wasExoFrameTestedThisTurn', () => {
  test('only while tracking, on the wearer\'s own turn, with an exo-frame, once per turn', async () => {
    const actor = makeActor();
    expect(needsExoFramePrompt(actor)).toBe(true);

    await actor.setFlag('essence20', EXO_FRAME_TESTED_FLAG, { combatId: 'combat1', round: 2, turn: 1 });
    expect(needsExoFramePrompt(actor)).toBe(false);

    await actor.setFlag('essence20', EXO_FRAME_TESTED_FLAG, { combatId: 'combat1', round: 1, turn: 1 });
    expect(needsExoFramePrompt(actor)).toBe(true);

    setGame({ tracking: false });
    expect(needsExoFramePrompt(actor)).toBe(false);

    setGame({ combatant: { tokenId: 'other' } });
    expect(needsExoFramePrompt(actor)).toBe(false);

    setGame();
    expect(needsExoFramePrompt(makeActor({ armor: [] }))).toBe(false);
  });
});

describe('promptExoFrameTest', () => {
  test('confirming rolls the test', async () => {
    const actor = makeActor();
    await promptExoFrameTest(actor);
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test('declining stamps the turn without rolling', async () => {
    setGame({ confirm: false });
    const actor = makeActor();
    await promptExoFrameTest(actor);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(wasExoFrameTestedThisTurn(actor)).toBe(true);
  });

  test('nothing to ask when the wearer has not moved', async () => {
    const actor = makeActor({ feet: 0 });
    await promptExoFrameTest(actor);
    expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
  });
});

describe('onExoFrameActionSpent', () => {
  test('prompts on a Standard spend after moving', async () => {
    const actor = makeActor();
    await onExoFrameActionSpent(actor, 'standard', { standard: 1 });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test('ignores non-Standard spends and unmoved wearers', async () => {
    const actor = makeActor();
    await onExoFrameActionSpent(actor, 'move', { move: 1 });
    await onExoFrameActionSpent(makeActor({ feet: 0 }), 'standard', { standard: 1 });
    expect(foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
  });
});

describe('onExoFrameTokenMoved', () => {
  test('prompts when moving after a Standard action was spent this turn', async () => {
    setGame({ ledger: { standard: 1 } });
    const actor = makeActor();
    await onExoFrameTokenMoved({ actor }, {}, {}, { id: 'user1' });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test('ignores other users\' moves and moves before any Standard action', async () => {
    setGame({ ledger: { standard: 1 } });
    const actor = makeActor();
    await onExoFrameTokenMoved({ actor }, {}, {}, { id: 'someone-else' });

    setGame({ ledger: null });
    await onExoFrameTokenMoved({ actor }, {}, {}, { id: 'user1' });
    await onExoFrameTokenMoved({}, {}, {}, { id: 'user1' });
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe('registerExoFrameHooks', () => {
  test('registers both triggers', () => {
    const on = jest.fn();
    global.Hooks = { on };
    try {
      registerExoFrameHooks();
    } finally {
      delete global.Hooks;
    }

    expect(on).toHaveBeenCalledWith('essence20.actionSpent', onExoFrameActionSpent);
    expect(on).toHaveBeenCalledWith('moveToken', onExoFrameTokenMoved);
  });
});
