import { jest } from '@jest/globals';
import { activateLuckyCharm, applyLuckyCharm } from './lucky-charm.mjs';

describe("activateLuckyCharm", () => {
  test("rolls Performance (Rituals) vs DIF 12 with the item's own uuid threaded through", async () => {
    const actor = { _dice: { rollSkill: jest.fn() } };
    const item = { uuid: 'Item.lucky1' };

    await activateLuckyCharm(actor, item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'performance', essence: 'social', dif: '12', isLuckyCharmAttempt: true, luckyCharmItemUuid: 'Item.lucky1',
      }),
      actor,
    );
  });
});

describe("applyLuckyCharm", () => {
  test("enables the item's own reroll config", async () => {
    const item = { update: jest.fn() };
    await applyLuckyCharm(item);

    expect(item.update).toHaveBeenCalledWith({ 'system.reroll.enabled': true });
  });
});
