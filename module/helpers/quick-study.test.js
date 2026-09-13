import { jest } from '@jest/globals';
import { revealTargetDefenses } from './quick-study.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
  user: { targets: { first: jest.fn(() => undefined) } },
};

global.ui = { notifications: { warn: jest.fn() } };

describe("revealTargetDefenses", () => {
  beforeEach(() => {
    game.user.targets.first.mockReset();
    ui.notifications.warn.mockClear();
  });

  test("returns a formatted message with the target's own four Defenses", () => {
    const targetActor = {
      name: 'Cecil',
      system: {
        defenses: {
          toughness: { total: 12 },
          evasion: { total: 10 },
          willpower: { total: 14 },
          cleverness: { total: 8 },
        },
      },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });

    const content = revealTargetDefenses({});

    expect(content).toContain('"target":"Cecil"');
    expect(content).toContain('"toughness":12');
    expect(content).toContain('"evasion":10');
    expect(content).toContain('"willpower":14');
    expect(content).toContain('"cleverness":8');
  });

  test("warns and returns null with no target selected", () => {
    game.user.targets.first.mockReturnValue(undefined);

    const content = revealTargetDefenses({});

    expect(content).toBe(null);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.QuickStudyNoTarget');
  });
});
