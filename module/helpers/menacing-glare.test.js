import { jest } from '@jest/globals';
import { applyMenacingGlareEffect } from './menacing-glare.mjs';

global.game = { combat: null };

function makeActor() {
  return { id: 'actor1', getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

function makeTarget() {
  return { id: 'target1', getFlag: jest.fn(() => undefined), setFlag: jest.fn(), toggleStatusEffect: jest.fn() };
}

describe("applyMenacingGlareEffect", () => {
  test("'snag' banks a Snag on the target", async () => {
    const actor = makeActor();
    const target = makeTarget();
    await applyMenacingGlareEffect(actor, target, 'snag');
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingMenacingGlareSnag', expect.objectContaining({ snag: true }),
    );
  });

  test("'edge' banks a target-scoped Edge on the actor", async () => {
    const actor = makeActor();
    const target = makeTarget();
    await applyMenacingGlareEffect(actor, target, 'edge');
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingMenacingGlareEdge', expect.objectContaining({ targetId: 'target1' }),
    );
  });

  test("'frightened' toggles the Condition on the target", async () => {
    const actor = makeActor();
    const target = makeTarget();
    await applyMenacingGlareEffect(actor, target, 'frightened');
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
  });
});
