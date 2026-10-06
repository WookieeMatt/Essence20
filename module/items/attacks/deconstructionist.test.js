import { jest } from '@jest/globals';
import { markDeconstructionist } from './deconstructionist.mjs';

global.game = { combat: null };

function makeTarget() {
  return { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

describe("markDeconstructionist", () => {
  test("banks a Snag on the targeted equipment", async () => {
    const target = makeTarget();
    await markDeconstructionist(target);
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingDeconstructionist', expect.objectContaining({ snag: true }),
    );
  });
});
