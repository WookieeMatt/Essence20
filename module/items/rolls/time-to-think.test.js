import { jest } from '@jest/globals';
import { applyTimeToThinkEdge } from './time-to-think.mjs';

const TIME_TO_THINK_ID = "Compendium.essence20.mlp_crb.Item.aoqbVibH10pj8rn7";

function makeActor({ hasPerk = false } = {}) {
  return {
    items: hasPerk
      ? [{ type: 'perk', flags: { core: { sourceId: TIME_TO_THINK_ID } }, _stats: {} }]
      : [],
    setFlag: jest.fn(),
  };
}

function makeCombatant({ initiative, actor }) {
  return { initiative, actor };
}

describe("applyTimeToThinkEdge", () => {
  test("banks Edge for the sole combatant with the lowest Initiative, who holds the Perk", async () => {
    const last = makeActor({ hasPerk: true });
    const first = makeActor({ hasPerk: true });
    const combat = {
      combatants: [makeCombatant({ initiative: 20, actor: first }), makeCombatant({ initiative: 2, actor: last })],
    };

    await applyTimeToThinkEdge(combat);

    expect(last.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTimeToThink', expect.objectContaining({ edge: true }),
    );
    expect(first.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing for a last-place combatant who doesn't hold the Perk", async () => {
    const last = makeActor({ hasPerk: false });
    const combat = {
      combatants: [makeCombatant({ initiative: 20, actor: makeActor() }), makeCombatant({ initiative: 2, actor: last })],
    };

    await applyTimeToThinkEdge(combat);

    expect(last.setFlag).not.toHaveBeenCalled();
  });

  test("grants Edge to every combatant tied for last", async () => {
    const lastA = makeActor({ hasPerk: true });
    const lastB = makeActor({ hasPerk: true });
    const combat = {
      combatants: [
        makeCombatant({ initiative: 20, actor: makeActor() }),
        makeCombatant({ initiative: 2, actor: lastA }),
        makeCombatant({ initiative: 2, actor: lastB }),
      ],
    };

    await applyTimeToThinkEdge(combat);

    expect(lastA.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTimeToThink', expect.objectContaining({ edge: true }),
    );
    expect(lastB.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTimeToThink', expect.objectContaining({ edge: true }),
    );
  });

  test("does nothing with no combat or no combatants", async () => {
    await applyTimeToThinkEdge(null);
    await applyTimeToThinkEdge({ combatants: [] });
    // No error thrown is the assertion here.
  });

  test("ignores combatants without an Initiative or without an actor", async () => {
    const last = makeActor({ hasPerk: true });
    const combat = {
      combatants: [
        makeCombatant({ initiative: null, actor: makeActor({ hasPerk: true }) }),
        makeCombatant({ initiative: 2, actor: null }),
        makeCombatant({ initiative: 5, actor: last }),
      ],
    };

    await applyTimeToThinkEdge(combat);

    expect(last.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTimeToThink', expect.objectContaining({ edge: true }),
    );
  });
});
