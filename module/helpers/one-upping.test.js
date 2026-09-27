import { jest } from '@jest/globals';
import { activateOneUpping, findOneUppingClaimant, ONE_UPPING_ID, PENDING_ONE_UPPING_FLAG_KEY } from "./one-upping.mjs";

function makeActor({ id = 'ally1', hasPerk = true } = {}) {
  return {
    id,
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: ONE_UPPING_ID } } }] : [],
    setFlag: jest.fn(),
  };
}

describe("findOneUppingClaimant", () => {
  afterEach(() => {
    global.game = undefined;
  });

  test("returns the viewing user's own character when it holds the Perk", () => {
    const claimant = makeActor({ id: 'competitive1' });
    global.game = { user: { character: claimant } };

    expect(findOneUppingClaimant(makeActor({ id: 'roller1', hasPerk: false }))).toBe(claimant);
  });

  test("returns null when the failing roll is the claimant's own — RAW says 'one of your ALLIES'", () => {
    const claimant = makeActor({ id: 'competitive1' });
    global.game = { user: { character: claimant } };

    expect(findOneUppingClaimant(claimant)).toBe(null);
  });

  test("returns null when the viewing user's character lacks the Perk", () => {
    global.game = { user: { character: makeActor({ id: 'competitive1', hasPerk: false }) } };

    expect(findOneUppingClaimant(makeActor({ id: 'roller1' }))).toBe(null);
  });

  test("returns null for a user with no assigned character at all", () => {
    global.game = { user: {} };

    expect(findOneUppingClaimant(makeActor({ id: 'roller1' }))).toBe(null);
  });
});

describe("activateOneUpping", () => {
  beforeEach(() => {
    // bankPendingBonus stamps the current combat onto every banked flag.
    global.game = { combat: null };
  });

  afterEach(() => {
    global.game = undefined;
  });

  test("banks an upshift 1 scoped to the skill the ally failed", async () => {
    const actor = makeActor();

    await activateOneUpping(actor, 'athletics');

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_ONE_UPPING_FLAG_KEY, expect.objectContaining({ shiftUp: 1, skill: 'athletics' }),
    );
  });
});
