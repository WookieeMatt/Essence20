import { jest } from '@jest/globals';
import { markPsychoStrikeSnag, PSYCHO_STRIKE_SNAG_FLAG } from './psycho-strike.mjs';

global.game = { combat: null };

function makeActor(id = 'target1') {
  return { id, setFlag: jest.fn() };
}

describe("markPsychoStrikeSnag", () => {
  test("banks an unscoped Snag on the target", async () => {
    const target = makeActor();

    await markPsychoStrikeSnag(target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', PSYCHO_STRIKE_SNAG_FLAG,
      expect.objectContaining({ snag: true }));
  });
});
