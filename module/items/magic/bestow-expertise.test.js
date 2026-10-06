import { jest } from '@jest/globals';
import { applyBestowExpertise, pickBestowExpertise } from './bestow-expertise.mjs';

describe("pickBestowExpertise", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
    global.game = { i18n: { localize: jest.fn((key) => key) } };
  });

  test("returns the chosen skill and name on confirm", async () => {
    waitMock.mockResolvedValue({ skill: 'culture', name: 'Ancient Lore' });
    expect(await pickBestowExpertise()).toEqual({ skill: 'culture', name: 'Ancient Lore' });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickBestowExpertise()).toBeNull();
  });

  test("returns null when no name was typed", async () => {
    waitMock.mockResolvedValue({ skill: 'culture', name: '   ' });
    expect(await pickBestowExpertise()).toBeNull();
  });
});

describe("applyBestowExpertise", () => {
  test("grants a title-cased, marked-granted Specialization on the target's chosen Skill", async () => {
    const actor = {
      system: { skills: { culture: { shift: 'd6', specializations: {} } } },
      update: jest.fn(),
    };

    await applyBestowExpertise(actor, 'culture', 'ancient lore');

    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        'system.skills.culture.specializations.ancientLore': expect.objectContaining({
          name: 'Ancient Lore', shift: 'd6', granted: true, isSpecialized: true,
        }),
      }),
    );
  });
});
