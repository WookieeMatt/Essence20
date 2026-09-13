import { jest } from '@jest/globals';
import { activateElectromagneticDisruptionPulse, canUseElectromagneticDisruptionPulse } from './electromagnetic-disruption.mjs';

global.game = { i18n: { localize: (key) => key, format: (key) => key }, combat: null };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ id = 'actor1', usedFlag = undefined } = {}) {
  return {
    id,
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
    getFlag: jest.fn((scope, key) => (key == 'electromagneticDisruptionPulseUsedThisEncounter' ? usedFlag : undefined)),
    setFlag: jest.fn(),
    system: { health: { value: 5 }, stun: { value: 0 }, immunities: {} },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

function addEnemy(id) {
  const actor = makeActor({ id });
  canvas.tokens.placeables.push({ actor, document: { disposition: -1 }, center: { x: 0, y: 0 } });
  return actor;
}

describe("canUseElectromagneticDisruptionPulse", () => {
  test("true with no prior use", () => {
    expect(canUseElectromagneticDisruptionPulse(makeActor())).toBe(true);
  });

  test("false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    expect(canUseElectromagneticDisruptionPulse(makeActor({ usedFlag: { combatId: 'combat1' } }))).toBe(false);
    game.combat = null;
  });
});

describe("activateElectromagneticDisruptionPulse", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("deals 1 Electromagnetic damage and 1 Stun to every nearby enemy, marks the scene used", async () => {
    const actor = makeActor();
    canvas.tokens.placeables.push({ actor, document: { disposition: 1 }, center: { x: 0, y: 0 } });
    const enemy1 = addEnemy('enemy1');
    const enemy2 = addEnemy('enemy2');

    const result = await activateElectromagneticDisruptionPulse(actor);

    expect(result).toBe(true);
    expect(enemy1.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(enemy1.update).toHaveBeenCalledWith({ 'system.stun.value': 1 });
    expect(enemy2.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'electromagneticDisruptionPulseUsedThisEncounter', { combatId: 'combat1' });
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor({ usedFlag: { combatId: 'combat1' } });
    canvas.tokens.placeables.push({ actor, document: { disposition: 1 }, center: { x: 0, y: 0 } });
    const enemy1 = addEnemy('enemy1');

    const result = await activateElectromagneticDisruptionPulse(actor);

    expect(result).toBe(false);
    expect(enemy1.update).not.toHaveBeenCalled();
  });
});
