import { jest } from '@jest/globals';
import { applyThroughTheArchesSnag } from './through-the-arches.mjs';

const THROUGH_THE_ARCHES_ID = "Compendium.essence20.across_the_stars.Item.f372LpDqqiO2XoEi";

global.game = { combat: null, user: { targets: new Set() } };

function makeCompanion({ id, hasPerk = false } = {}) {
  return {
    id,
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: THROUGH_THE_ARCHES_ID } } }] : [],
    getFlag: jest.fn(() => undefined),
    setFlag: jest.fn(),
  };
}

function makeTargetsSet(actors) {
  return new Set(actors.map(actor => ({ actor })));
}

describe("applyThroughTheArchesSnag", () => {
  const actor = { id: 'ranger1' };

  afterEach(() => {
    game.user.targets = new Set();
  });

  test("banks a Snag on every targeted companion without the Perk", async () => {
    const companion1 = makeCompanion({ id: 'c1' });
    const companion2 = makeCompanion({ id: 'c2' });
    game.user.targets = makeTargetsSet([companion1, companion2]);

    const marked = await applyThroughTheArchesSnag(actor);

    expect(marked).toBe(2);
    expect(companion1.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThroughTheArchesSnag', expect.objectContaining({ snag: true }),
    );
    expect(companion2.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThroughTheArchesSnag', expect.objectContaining({ snag: true }),
    );
  });

  test("skips a companion who already holds the Perk", async () => {
    const withPerk = makeCompanion({ id: 'c1', hasPerk: true });
    game.user.targets = makeTargetsSet([withPerk]);

    const marked = await applyThroughTheArchesSnag(actor);

    expect(marked).toBe(0);
    expect(withPerk.setFlag).not.toHaveBeenCalled();
  });

  test("excludes the granter themselves, even if self-targeted", async () => {
    game.user.targets = makeTargetsSet([actor]);

    const marked = await applyThroughTheArchesSnag(actor);

    expect(marked).toBe(0);
  });

  test("returns 0 with no targets at all", async () => {
    expect(await applyThroughTheArchesSnag(actor)).toBe(0);
  });
});
