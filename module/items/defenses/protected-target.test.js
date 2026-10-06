import { jest } from '@jest/globals';
import {
  getProtectedTargetUuid, isProtectedTarget,
} from './protected-target.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  combat: null,
};

global.ui = {
  notifications: {
    warn: jest.fn(),
  },
};

global.fromUuid = jest.fn();

function makeActor({ flags = {} } = {}) {
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    system: { health: { bonus: 0 } },
    update: jest.fn(async function (data) {
      this.system.health.bonus = data['system.health.bonus']; 
    }),
  };
}

beforeEach(() => {
  game.user.targets.first.mockReset();
  ui.notifications.warn.mockClear();
  global.fromUuid.mockReset();
  game.combat = { id: 'combat1' };
});

afterEach(() => {
  game.combat = null;
});

describe("getProtectedTargetUuid / isProtectedTarget", () => {
  test("reflects the stored flag", () => {
    const actor = makeActor({ flags: { protectedTargetUuid: 'Actor.target1' } });
    expect(getProtectedTargetUuid(actor)).toBe('Actor.target1');
    expect(isProtectedTarget(actor, { uuid: 'Actor.target1' })).toBe(true);
    expect(isProtectedTarget(actor, { uuid: 'Actor.other' })).toBe(false);
  });

  test("false with no protected target set", () => {
    const actor = makeActor();
    expect(isProtectedTarget(actor, { uuid: 'Actor.target1' })).toBe(false);
  });
});
