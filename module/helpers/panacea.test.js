import { jest } from '@jest/globals';
import { applyPanaceaHeal } from './panacea.mjs';

describe("applyPanaceaHeal", () => {
  test("heals the target to full Health and clears Defeated", async () => {
    const targetActor = {
      system: { health: { value: 3, max: 10 } },
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };

    await applyPanaceaHeal(targetActor);

    expect(targetActor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });
});
