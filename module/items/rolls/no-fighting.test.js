import { jest } from '@jest/globals';
import { applyNoFightingSnag, NO_FIGHTING_FLAG } from './no-fighting.mjs';

const NO_FIGHTING_HANGUP_ID = "Compendium.essence20.knights_of_canterlot.Item.ddSnDksWfxPkekda";

function makeActor({ hasHangUp = true } = {}) {
  const items = hasHangUp ? [{ type: 'hangUp', flags: { core: { sourceId: NO_FIGHTING_HANGUP_ID } } }] : [];
  return {
    items,
    getFlag: jest.fn(),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
  };
}

describe("applyNoFightingSnag", () => {
  test("banks the flag on every combatant holding the Hang-Up", async () => {
    const actor = makeActor();
    const combat = { combatants: [{ actor }] };

    await applyNoFightingSnag(combat);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', NO_FIGHTING_FLAG, true);
  });

  test("skips a combatant without the Hang-Up", async () => {
    const actor = makeActor({ hasHangUp: false });
    const combat = { combatants: [{ actor }] };

    await applyNoFightingSnag(combat);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("skips a combatant with no actor", async () => {
    const combat = { combatants: [{ actor: null }] };
    await expect(applyNoFightingSnag(combat)).resolves.not.toThrow();
  });
});
