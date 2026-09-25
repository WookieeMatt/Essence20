import { jest } from '@jest/globals';
import { activateFlyingNuisance, markFlyingNuisanceSnag, pickFlyingNuisanceSkill } from './flying-nuisance.mjs';

global.game = { i18n: { localize: (k) => k }, user: { targets: { first: jest.fn() } } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(id = 'actor1') {
  return { id, setFlag: jest.fn(), _dice: { rollSkill: jest.fn() } };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  game.user.targets.first.mockReset();
  foundry.applications.api.DialogV2.wait.mockReset();
});

describe("pickFlyingNuisanceSkill", () => {
  test("returns the chosen skill", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('driving');
    expect(await pickFlyingNuisanceSkill()).toBe('driving');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickFlyingNuisanceSkill()).toBeNull();
  });
});

describe("markFlyingNuisanceSnag", () => {
  test("banks an unscoped Snag on the target", async () => {
    const target = makeActor('target1');

    await markFlyingNuisanceSnag(target);

    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingFlyingNuisanceSnag',
      expect.objectContaining({ snag: true }));
  });
});

describe("activateFlyingNuisance", () => {
  test("warns and does not roll with no target", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();

    await activateFlyingNuisance(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does not roll when the skill picker is cancelled", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('target1') });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateFlyingNuisance(actor);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls the chosen Skill against Evasion", async () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('target1') });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('acrobatics');
    const actor = makeActor();

    await activateFlyingNuisance(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'acrobatics', essence: 'speed', defenseType: 'evasion', isFlyingNuisance: true,
      }),
      actor,
    );
  });
});
