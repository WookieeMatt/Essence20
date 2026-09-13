import { jest } from '@jest/globals';
import {
  applyScarefyingAppearance, isScarefyingAppearanceActive, removeScarefyingAppearance,
} from './scarefying-appearance.mjs';

function makeActor({ size = 'common', originalSize = null } = {}) {
  const flagStore = { scarefyingAppearanceOriginalSize: originalSize };
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
});

describe("applyScarefyingAppearance", () => {
  test("saves the original size and steps up one size category", async () => {
    const actor = makeActor({ size: 'common' });

    await applyScarefyingAppearance(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'scarefyingAppearanceOriginalSize', 'common');
    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'large' });
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
