import { jest } from '@jest/globals';
import { activateTakedown, pickTakedownSkill } from './takedown.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

const SCIENCE_OF_SUBTLETY_ID = "Compendium.essence20.cobra_codex.Item.tqY4YomXkTuFXZLo";

describe("pickTakedownSkill", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen skill", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('finesse');
    expect(await pickTakedownSkill()).toBe('finesse');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickTakedownSkill()).toBeNull();
  });

  test("offers a Science button when the actor has Science of Subtlety", async () => {
    foundry.applications.api.DialogV2.wait.mockImplementation(({ buttons }) => buttons.map(b => b.action));
    const actor = { items: [{ type: 'perk', flags: { core: { sourceId: SCIENCE_OF_SUBTLETY_ID } } }] };

    const actions = await pickTakedownSkill(actor);

    expect(actions).toEqual(['might', 'finesse', 'science', 'cancel']);
  });

  test("doesn't offer a Science button without the Perk", async () => {
    foundry.applications.api.DialogV2.wait.mockImplementation(({ buttons }) => buttons.map(b => b.action));
    const actor = { items: [] };

    const actions = await pickTakedownSkill(actor);

    expect(actions).toEqual(['might', 'finesse', 'cancel']);
  });
});

describe("activateTakedown", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("rolls a Might Skill Test against Toughness when Might is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('might');
    const actor = { _dice: { rollSkill: jest.fn() } };

    const activated = await activateTakedown(actor);

    expect(activated).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'might', essence: 'strength', defenseType: 'toughness', isTakedown: true }),
      actor,
    );
  });

  test("rolls a Finesse Skill Test against Toughness when Finesse is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('finesse');
    const actor = { _dice: { rollSkill: jest.fn() } };

    await activateTakedown(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'finesse', essence: 'speed', defenseType: 'toughness', isTakedown: true }),
      actor,
    );
  });

  test("rolls a Science Skill Test against Toughness when Science is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    const actor = {
      _dice: { rollSkill: jest.fn() },
      items: [{ type: 'perk', flags: { core: { sourceId: SCIENCE_OF_SUBTLETY_ID } } }],
    };

    await activateTakedown(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', essence: 'smarts', defenseType: 'toughness', isTakedown: true }),
      actor,
    );
  });

  test("doesn't roll anything when the picker is cancelled, returning false", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = { _dice: { rollSkill: jest.fn() } };

    const activated = await activateTakedown(actor);

    expect(activated).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});
