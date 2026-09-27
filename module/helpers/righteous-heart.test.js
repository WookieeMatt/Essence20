import { jest } from '@jest/globals';
import {
  activateRighteousHeart, canUseRighteousHeart, hasRighteousHeartResistance, RIGHTEOUS_HEART_RESISTANCE_FLAG,
} from './righteous-heart.mjs';

global.game = { i18n: { localize: (k) => k, format: (k) => k } };

function makeActor({ isMorphed = true, flags = {} } = {}) {
  const store = { ...flags };
  return {
    system: { isMorphed },
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete store[key];
    }),
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2 = { wait: jest.fn() };
});

describe('canUseRighteousHeart', () => {
  test('usable while Morphed', () => {
    expect(canUseRighteousHeart(makeActor({ isMorphed: true }))).toBe(true);
  });

  test('not usable unmorphed', () => {
    expect(canUseRighteousHeart(makeActor({ isMorphed: false }))).toBe(false);
  });
});

describe('activateRighteousHeart', () => {
  test('banks the chosen damage type', async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fire');
    const actor = makeActor();

    await activateRighteousHeart(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', RIGHTEOUS_HEART_RESISTANCE_FLAG, expect.objectContaining({ damageType: 'fire' }),
    );
  });

  test('banks nothing on cancel', async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateRighteousHeart(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe('hasRighteousHeartResistance', () => {
  test('matches a banked damage type', () => {
    const actor = makeActor({ flags: { [RIGHTEOUS_HEART_RESISTANCE_FLAG]: { damageType: 'sharp' } } });
    expect(hasRighteousHeartResistance(actor, 'sharp')).toBe(true);
  });

  test('does not match a different damage type', () => {
    const actor = makeActor({ flags: { [RIGHTEOUS_HEART_RESISTANCE_FLAG]: { damageType: 'sharp' } } });
    expect(hasRighteousHeartResistance(actor, 'blunt')).toBe(false);
  });

  test('does not match with nothing banked', () => {
    const actor = makeActor();
    expect(hasRighteousHeartResistance(actor, 'sharp')).toBe(false);
  });
});
