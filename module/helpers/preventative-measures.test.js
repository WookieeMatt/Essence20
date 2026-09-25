import { jest } from '@jest/globals';
import { activatePreventativeMeasures } from './preventative-measures.mjs';

global.game = { user: { targets: new Set() }, i18n: { localize: (k) => k, format: (k) => k } };
global.ui = { notifications: { warn: jest.fn() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(id, name, { health = 5, max = 10, bonus = 0 } = {}) {
  return {
    id,
    name,
    getActiveTokens: jest.fn(() => []),
    getFlag: jest.fn(() => undefined),
    setFlag: jest.fn(),
    system: { health: { value: health, max, bonus } },
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  global.game.user.targets = new Set();
  global.foundry.applications.api.DialogV2.wait.mockReset();
  global.ui.notifications.warn.mockReset();
});

describe("activatePreventativeMeasures", () => {
  test("warns and does not roll with no eligible target", async () => {
    const actor = makeActor('actor1', 'Medic');

    await activatePreventativeMeasures(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns when the only targeted ally already has Damage", async () => {
    const actor = makeActor('actor1', 'Medic');
    const hurtAlly = makeActor('actor2', 'Hurt Ally', { health: 3, max: 10 });
    global.game.user.targets = new Set([{ actor: hurtAlly }]);

    await activatePreventativeMeasures(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("rolls the chosen Skill at RAW's own DIF for a healthy, untreated ally", async () => {
    const actor = makeActor('actor1', 'Medic');
    const healthyAlly = makeActor('actor2', 'Healthy Ally', { health: 10, max: 10, bonus: 0 });
    global.game.user.targets = new Set([{ actor: healthyAlly }]);
    global.foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('technology')
      .mockResolvedValueOnce(2);

    await activatePreventativeMeasures(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'preventativeMeasuresTargetsToday',
      expect.objectContaining({ targetIds: ['actor2'] }));
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', essence: 'smarts', dif: '15', isPreventativeMeasures: true,
        preventativeMeasuresAmount: 2,
      }),
      actor,
    );
  });
});
