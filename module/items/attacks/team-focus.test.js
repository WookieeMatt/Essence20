import { jest } from '@jest/globals';
import { checkTeamFocus, markAttackedByAlly } from './team-focus.mjs';

const TEAM_FOCUS_ID = "Compendium.essence20.pr_crb.Item.tKonXkoNsZhajHp9";

function makeActor({ id, perkIds = [], disposition = 1 } = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  return {
    id,
    items,
    getActiveTokens: jest.fn(() => [{ document: { disposition } }]),
    setFlag: jest.fn(),
    getFlag: jest.fn(),
  };
}

describe("markAttackedByAlly / checkTeamFocus", () => {
  beforeEach(() => {
    global.game = { combat: { id: 'combat1', round: 2 } };
  });

  test("marks the target with the attacker's disposition and id", async () => {
    const attacker = makeActor({ id: 'attacker1', disposition: 1 });
    const target = makeActor({ id: 'target1' });

    await markAttackedByAlly(attacker, target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'attackedByAllyThisRound', {
      combatId: 'combat1', round: 2, disposition: 1, attackerId: 'attacker1',
    });
  });

  test("no-ops outside of combat", async () => {
    game.combat = null;
    const attacker = makeActor({ id: 'attacker1' });
    const target = makeActor({ id: 'target1' });

    await markAttackedByAlly(attacker, target);

    expect(target.setFlag).not.toHaveBeenCalled();
  });

  test("no-ops without a target", async () => {
    const attacker = makeActor({ id: 'attacker1' });
    await markAttackedByAlly(attacker, null);
    // Should not throw.
  });

  test("grants Team Focus when a same-disposition ally attacked the target this round", () => {
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, attackerId: 'ally1' }));
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(true);
  });

  test("doesn't apply without the Perk", () => {
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, attackerId: 'ally1' }));
    const actor = makeActor({ id: 'roller1', disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });

  test("doesn't apply when the target hasn't been attacked this round", () => {
    const target = makeActor({ id: 'target1' });
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });

  test("doesn't apply when the flag is from a stale round", () => {
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 1, disposition: 1, attackerId: 'ally1' }));
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });

  test("doesn't apply when the flagged attacker was the roller themselves", () => {
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, attackerId: 'roller1' }));
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });

  test("doesn't apply when the flagged attacker was an enemy (opposite disposition)", () => {
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: -1, attackerId: 'enemy1' }));
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });

  test("doesn't apply outside of combat", () => {
    game.combat = null;
    const target = makeActor({ id: 'target1' });
    target.getFlag = jest.fn(() => ({ combatId: 'combat1', round: 2, disposition: 1, attackerId: 'ally1' }));
    const actor = makeActor({ id: 'roller1', perkIds: [TEAM_FOCUS_ID], disposition: 1 });

    expect(checkTeamFocus(actor, target, TEAM_FOCUS_ID)).toBe(false);
  });
});
