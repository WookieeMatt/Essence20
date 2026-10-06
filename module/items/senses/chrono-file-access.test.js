import { jest } from '@jest/globals';
import { revealTargetChronoFile } from './chrono-file-access.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: (k) => k, format: (k, data) => `${k} ${JSON.stringify(data)}` } };
global.ui = { notifications: { warn: jest.fn() } };

function makeTargetActor({ defenses = { toughness: 10, evasion: 12, willpower: 8, cleverness: 14 }, weaponEffects = [], hangUps = [] } = {}) {
  return {
    name: 'Target',
    system: { defenses: Object.fromEntries(Object.entries(defenses).map(([k, v]) => [k, { total: v }])), immunities: {}, size: 'common' },
    items: [
      ...weaponEffects.map(w => ({ type: 'weaponEffect', name: w.name, system: { damageValue: w.damageValue } })),
      ...hangUps.map(name => ({ type: 'hangUp', name })),
    ],
  };
}

describe("revealTargetChronoFile", () => {
  test("returns null and warns when nothing is targeted", () => {
    global.game.user.targets.first.mockReturnValue(undefined);

    expect(revealTargetChronoFile({})).toBeNull();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("identifies the highest Defense, the most damaging Attack, and lists Hang-Ups", () => {
    const targetActor = makeTargetActor({
      defenses: { toughness: 10, evasion: 12, willpower: 8, cleverness: 14 },
      weaponEffects: [{ name: 'Weak Punch', damageValue: 1 }, { name: 'Big Blast', damageValue: 5 }],
      hangUps: ['Stubborn'],
    });
    global.game.user.targets.first.mockReturnValue({ actor: targetActor });

    const content = revealTargetChronoFile({});

    expect(content).toContain('"highestDefenseName":"Cleverness"');
    expect(content).toContain('"highestDefenseValue":14');
    expect(content).toContain('"attackName":"Big Blast"');
    expect(content).toContain('"attackDamage":5');
    expect(content).toContain('"hangUps":"Stubborn"');
  });

  test("falls back gracefully with no Attacks or Hang-Ups", () => {
    const targetActor = makeTargetActor();
    global.game.user.targets.first.mockReturnValue({ actor: targetActor });

    const content = revealTargetChronoFile({});

    expect(content).toContain('"attackName":"E20.ChronoFileAccessNoAttacks"');
    expect(content).toContain('"hangUps":"E20.ChronoFileAccessNoHangUps"');
  });
});
