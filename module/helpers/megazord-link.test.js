import { jest } from '@jest/globals';
import { activateMegazordLink, PENDING_MEGAZORD_LINK_FLAG_KEY } from './megazord-link.mjs';

global.game = { combat: null };

function makeActor() {
  return { setFlag: jest.fn() };
}

describe("activateMegazordLink", () => {
  test("banks a fixed +2 shiftUp", async () => {
    const actor = makeActor();

    await activateMegazordLink(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', PENDING_MEGAZORD_LINK_FLAG_KEY, expect.objectContaining({ shiftUp: 2 }));
  });
});
