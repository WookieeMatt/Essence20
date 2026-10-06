import { jest } from '@jest/globals';
import { activateSpite, hasSpite } from './spite.mjs';

const SPITE_ID = "Compendium.essence20.beneath_the_helmet.Item.Gadtv1eSeFgNotSw";

global.game = { combat: null };

function makeActor({ hasPerk = true, power = 1 } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SPITE_ID } } }] : [],
    system: { powers: { personal: { value: power } } },
    update: jest.fn(),
    setFlag: jest.fn(),
  };
}

describe("hasSpite", () => {
  test("true with the Perk", () => {
    expect(hasSpite(makeActor({ hasPerk: true }))).toBe(true);
  });

  test("false without the Perk", () => {
    expect(hasSpite(makeActor({ hasPerk: false }))).toBe(false);
  });
});

describe("activateSpite", () => {
  test("spends 1 Personal Power and banks a target-scoped Edge", async () => {
    const actor = makeActor({ power: 2 });
    await activateSpite(actor, 'Actor.target1');

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingSpiteEdge', expect.objectContaining({ targetUuid: 'Actor.target1' }),
    );
  });
});
