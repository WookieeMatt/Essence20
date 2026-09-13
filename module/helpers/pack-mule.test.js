import { jest } from '@jest/globals';
import { markPackMuleDownshift, PACK_MULE_DOWNSHIFT_FLAG } from './pack-mule.mjs';

function makeActor() {
  return {
    setFlag: jest.fn(),
  };
}

describe("markPackMuleDownshift", () => {
  beforeEach(() => {
    global.game = { combat: { id: 'combat1', round: 3 } };
  });

  test("marks the target with the current combat id and round", async () => {
    const target = makeActor();

    await markPackMuleDownshift(target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', PACK_MULE_DOWNSHIFT_FLAG, {
      combatId: 'combat1', round: 3,
    });
  });

  test("no-ops outside of combat", async () => {
    game.combat = null;
    const target = makeActor();

    await markPackMuleDownshift(target);

    expect(target.setFlag).not.toHaveBeenCalled();
  });
});
