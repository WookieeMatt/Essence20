import { jest } from '@jest/globals';
import { revealStudiousMeasuresQuarry } from './studious-measures.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: (k) => k, format: (k, data) => `${k} ${JSON.stringify(data)}` } };
global.ui = { notifications: { warn: jest.fn() } };

function makeTargetActor({ maxHealth = 10, hangUps = [], resistances = {}, immunities = {} } = {}) {
  return {
    name: 'Target',
    system: { health: { max: maxHealth }, resistances, immunities },
    items: hangUps.map(name => ({ type: 'hangUp', name })),
  };
}

describe("revealStudiousMeasuresQuarry", () => {
  test("returns null and warns when nothing is targeted", () => {
    global.game.user.targets.first.mockReturnValue(undefined);

    expect(revealStudiousMeasuresQuarry({})).toBeNull();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("reveals max Health, Hang-Ups, and Resistances/Immunities", () => {
    const targetActor = makeTargetActor({
      maxHealth: 20,
      hangUps: ['Stubborn'],
      resistances: { fire: true },
      immunities: { emp: true },
    });
    global.game.user.targets.first.mockReturnValue({ actor: targetActor });

    const content = revealStudiousMeasuresQuarry({});

    expect(content).toContain('"maxHealth":20');
    expect(content).toContain('"hangUps":"Stubborn"');
    expect(content).toContain('E20.StudiousMeasuresResistantTo');
    expect(content).toContain('E20.StudiousMeasuresImmuneTo');
  });

  test("falls back gracefully with no Hang-Ups or Resistances", () => {
    const targetActor = makeTargetActor();
    global.game.user.targets.first.mockReturnValue({ actor: targetActor });

    const content = revealStudiousMeasuresQuarry({});

    expect(content).toContain('"hangUps":"E20.StudiousMeasuresNoHangUps"');
    expect(content).toContain('"resistances":"E20.StudiousMeasuresNoResistances"');
  });
});
