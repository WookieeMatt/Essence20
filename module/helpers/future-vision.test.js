import { jest } from '@jest/globals';
import { activateFutureVision } from './future-vision.mjs';

function makeItem() {
  return { update: jest.fn() };
}

describe("activateFutureVision", () => {
  test("enables the reroll grant and writes the spent amount as maxUses", async () => {
    const item = makeItem();

    await activateFutureVision(item, 3);

    expect(item.update).toHaveBeenCalledWith({ 'system.reroll.enabled': true, 'system.reroll.maxUses': 3 });
  });

  test("does nothing when nothing was spent", async () => {
    const item = makeItem();

    await activateFutureVision(item, 0);

    expect(item.update).not.toHaveBeenCalled();
  });
});
