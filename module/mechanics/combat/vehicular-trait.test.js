import { jest } from '@jest/globals';
import { checkVehicularEligibility, isVehicleActor } from './vehicular-trait.mjs';

function setGame({ mode = 'track', isGM = false } = {}) {
  global.game = {
    user: { isGM },
    i18n: { format: jest.fn((key, data) => `${key}:${JSON.stringify(data)}`) },
    settings: { get: jest.fn((scope, key) => (key == 'actionEconomyMode' ? mode : undefined)) },
  };
  global.ui = { notifications: { warn: jest.fn() } };
}

describe("Vehicular (GI Joe CRB, Weapon Effects and Traits, p.148)", () => {
  test("isVehicleActor is true only for a vehicle-type actor", () => {
    expect(isVehicleActor({ type: 'vehicle' })).toBe(true);
    expect(isVehicleActor({ type: 'playerCharacter' })).toBe(false);
    expect(isVehicleActor(null)).toBe(false);
  });

  test("always allowed for a vehicle, in any mode", () => {
    setGame({ mode: 'strict' });
    expect(checkVehicularEligibility({ type: 'vehicle' }, 'Turret')).toBe(true);
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("silently allowed for a non-vehicle in 'track'/'off' mode", () => {
    setGame({ mode: 'track' });
    expect(checkVehicularEligibility({ type: 'playerCharacter' }, 'Turret')).toBe(true);
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("warns but still allows a non-vehicle in 'warn' mode", () => {
    setGame({ mode: 'warn' });
    expect(checkVehicularEligibility({ type: 'playerCharacter' }, 'Turret')).toBe(true);
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("blocks a non-vehicle in 'strict' mode", () => {
    setGame({ mode: 'strict' });
    expect(checkVehicularEligibility({ type: 'playerCharacter' }, 'Turret')).toBe(false);
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("a GM always bypasses 'strict' mode", () => {
    setGame({ mode: 'strict', isGM: true });
    expect(checkVehicularEligibility({ type: 'playerCharacter' }, 'Turret')).toBe(true);
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });
});
