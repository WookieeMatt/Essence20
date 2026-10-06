import { jest } from '@jest/globals';
import { applyComicFlair } from './comic-flair.mjs';

global.canvas = { grid: { measurePath: jest.fn(() => ({ distance: 5 })) } };
global.game = { user: { targets: { first: jest.fn() } } };

function makeToken({ disposition = 1, statuses = [] } = {}) {
  return {
    document: { disposition },
    center: {},
    actor: { statuses: new Set(statuses), toggleStatusEffect: jest.fn() },
  };
}

function makeActor(actorToken) {
  return { getActiveTokens: jest.fn(() => [actorToken]) };
}

describe("applyComicFlair", () => {
  test("removes Frightened and Impaired from a non-enemy target within range, leaving other Conditions alone", async () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: 1, statuses: ['frightened', 'impaired', 'prone'] });
    game.user.targets.first.mockReturnValue(targetToken);

    const removed = await applyComicFlair(makeActor(actorToken));

    expect(removed.sort()).toEqual(['frightened', 'impaired']);
    expect(targetToken.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(targetToken.actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: false });
    expect(targetToken.actor.toggleStatusEffect).not.toHaveBeenCalledWith('prone', expect.anything());
  });

  test("removes only whichever of the two Conditions is actually present", async () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: 1, statuses: ['frightened'] });
    game.user.targets.first.mockReturnValue(targetToken);

    const removed = await applyComicFlair(makeActor(actorToken));

    expect(removed).toEqual(['frightened']);
  });

  test("returns null for an enemy target, even in range", async () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: -1, statuses: ['frightened'] });
    game.user.targets.first.mockReturnValue(targetToken);

    expect(await applyComicFlair(makeActor(actorToken))).toBeNull();
    expect(targetToken.actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("returns null when the target is out of the 10ft range", async () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: 1, statuses: ['frightened'] });
    game.user.targets.first.mockReturnValue(targetToken);
    canvas.grid.measurePath.mockReturnValueOnce({ distance: 15 });

    expect(await applyComicFlair(makeActor(actorToken))).toBeNull();
  });

  test("allows targeting yourself", async () => {
    const actorToken = makeToken({ disposition: 1, statuses: ['impaired'] });
    game.user.targets.first.mockReturnValue(actorToken);

    const removed = await applyComicFlair(makeActor(actorToken));

    expect(removed).toEqual(['impaired']);
  });

  test("returns null with no target selected", async () => {
    const actorToken = makeToken({ disposition: 1 });
    game.user.targets.first.mockReturnValue(undefined);

    expect(await applyComicFlair(makeActor(actorToken))).toBeNull();
  });
});
