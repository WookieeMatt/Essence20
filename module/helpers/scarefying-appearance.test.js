import { jest } from '@jest/globals';
import {
  applyScarefyingAppearance, expireScarefyingAppearances, isScarefyingAppearanceActive,
  isScarefyingAppearanceExpired, removeScarefyingAppearance,
} from './scarefying-appearance.mjs';

// A 10-round duration stamped in the current (default 1) encounter, out of Combat.
const RUNNING = { epoch: 1, window: 'encounter', count: 1 };

function makeActor({ size = 'common', originalSize = null, until = RUNNING } = {}) {
  const flagStore = { scarefyingAppearanceOriginalSize: originalSize };
  if (originalSize && until) {
    flagStore.scarefyingAppearanceUntil = until;
  }

  return {
    system: { size },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
    update: jest.fn(),
  };
}

describe("isScarefyingAppearanceActive", () => {
  test("false by default, true once the original size is saved", () => {
    expect(isScarefyingAppearanceActive(makeActor())).toBe(false);
    expect(isScarefyingAppearanceActive(makeActor({ originalSize: 'common' }))).toBe(true);
  });

  test("false once its duration has run out", () => {
    expect(isScarefyingAppearanceActive(makeActor({ originalSize: 'common', until: { ...RUNNING, epoch: 0 } }))).toBe(false);
  });

  test("a cast from before the spell had a duration still reads as active until it is swept", () => {
    const actor = makeActor({ originalSize: 'common', until: null });
    expect(isScarefyingAppearanceActive(actor)).toBe(true);
    expect(isScarefyingAppearanceExpired(actor)).toBe(true);
  });
});

describe("applyScarefyingAppearance", () => {
  test("saves the original size and steps up one size category", async () => {
    const actor = makeActor({ size: 'common' });

    await applyScarefyingAppearance(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'scarefyingAppearanceOriginalSize', 'common');
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'large' });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'scarefyingAppearanceUntil', RUNNING);
  });

  test("recasting after the duration ran out reverts the old size change first", async () => {
    const actor = makeActor({ size: 'large', originalSize: 'common', until: { ...RUNNING, epoch: 0 } });
    actor.update.mockImplementation(async (data) => {
      actor.system.size = data['system.size'];
    });

    await applyScarefyingAppearance(actor);

    expect(actor.update).toHaveBeenNthCalledWith(1, { 'system.size': 'common' });
    expect(actor.update).toHaveBeenNthCalledWith(2, { 'system.size': 'large' });
  });

  test("doesn't step up past the top of the ladder", async () => {
    const actor = makeActor({ size: 'titanic' });

    await applyScarefyingAppearance(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'titanic' });
  });

  test("no-ops if already active", async () => {
    const actor = makeActor({ size: 'large', originalSize: 'common' });

    await applyScarefyingAppearance(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("removeScarefyingAppearance", () => {
  test("restores the original size and clears the flag", async () => {
    const actor = makeActor({ size: 'large', originalSize: 'common' });

    await removeScarefyingAppearance(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'common' });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'scarefyingAppearanceOriginalSize');
  });

  test("doesn't restore anything while inactive", async () => {
    const actor = makeActor();

    await removeScarefyingAppearance(actor);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("expireScarefyingAppearances", () => {
  afterEach(() => {
    delete global.game;
  });

  test("the active GM reverts expired casts and leaves running ones alone", async () => {
    global.game = { users: { activeGM: { isSelf: true } } };
    const expired = makeActor({ size: 'large', originalSize: 'common', until: { ...RUNNING, epoch: 0 } });
    const running = makeActor({ size: 'large', originalSize: 'common' });

    await expireScarefyingAppearances([expired, running]);

    expect(expired.update).toHaveBeenCalledWith({ 'system.size': 'common' });
    expect(running.update).not.toHaveBeenCalled();
  });

  test("a cast counting rounds in a Combat that just ended is reverted", async () => {
    global.game = { users: { activeGM: { isSelf: true } }, combats: { get: () => ({ id: 'c1', round: 2, turn: 0 }) } };
    const until = { ...RUNNING, combatId: 'c1', untilRound: 11, untilTurn: 0 };
    const actor = makeActor({ size: 'large', originalSize: 'common', until });

    await expireScarefyingAppearances([actor], 'c1');

    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'common' });
  });

  test("does nothing on a non-GM client", async () => {
    global.game = { users: { activeGM: { isSelf: false } } };
    const actor = makeActor({ size: 'large', originalSize: 'common', until: { ...RUNNING, epoch: 0 } });

    await expireScarefyingAppearances([actor]);

    expect(actor.update).not.toHaveBeenCalled();
  });
});
