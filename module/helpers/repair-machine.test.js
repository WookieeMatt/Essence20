import { jest } from '@jest/globals';
import { activateRepairMachine } from './repair-machine.mjs';

global.game = { combat: null };

describe("activateRepairMachine", () => {
  test("banks a pending Repair Machine Edge flag", async () => {
    const actor = { setFlag: jest.fn() };
    await activateRepairMachine(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingRepairMachineEdge', expect.objectContaining({}),
    );
  });
});
