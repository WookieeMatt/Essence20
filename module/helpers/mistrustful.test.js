import { jest } from '@jest/globals';
import { markMistrustfulSnag, MISTRUSTFUL_SNAG_FLAG } from './mistrustful.mjs';

global.game = { combat: null };

function makeActor(id = 'actor1') {
  return { id, setFlag: jest.fn() };
}

describe("markMistrustfulSnag", () => {
  test("banks an unscoped Snag on the actor", async () => {
    const actor = makeActor();

    await markMistrustfulSnag(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', MISTRUSTFUL_SNAG_FLAG,
      expect.objectContaining({ snag: true }));
  });
});
