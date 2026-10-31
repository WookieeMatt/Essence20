import { canConvert, canHoldAltModes, vehicleAltModesOn } from './vehicle-alt-modes.mjs';

const altMode = { type: 'altMode' };
const actor = (type, items = [], system = {}) => ({ type, items, system });

afterEach(() => {
  delete globalThis.game;
});

test('the setting is read from the world, and off when there is no world to ask', () => {
  globalThis.game = undefined;
  expect(vehicleAltModesOn()).toBe(false);
  globalThis.game = { settings: { get: (scope, key) => scope == 'essence20' && key == 'vehicleAltModes' } };
  expect(vehicleAltModesOn()).toBe(true);
  const unregistered = () => {
    throw new Error('not registered');
  };

  globalThis.game = { settings: { get: unregistered } };
  expect(vehicleAltModesOn()).toBe(false);
});

test('a Transformer always holds Alt Modes; a Vehicle or Zord only with the setting on; nothing else ever', () => {
  expect(canHoldAltModes(actor('playerCharacter', [], { canTransform: true }), false)).toBe(true);
  expect(['vehicle', 'zord'].map(type => canHoldAltModes(actor(type), true))).toEqual([true, true]);
  expect(['vehicle', 'zord'].map(type => canHoldAltModes(actor(type), false))).toEqual([false, false]);
  expect(['megaform', 'npc', 'companion'].map(type => canHoldAltModes(actor(type), true))).toEqual([false, false, false]);
});

test('a Vehicle converts once it holds an Alt Mode, and can always change back', () => {
  expect(canConvert(actor('vehicle', [], {}), true)).toBe(false);
  expect(canConvert(actor('vehicle', [altMode], {}), true)).toBe(true);
  expect(canConvert(actor('zord', [altMode], {}), false)).toBe(false);
  expect(canConvert(actor('zord', [altMode], { isTransformed: true }), false)).toBe(true);
  expect(canConvert(actor('megaform', [altMode], {}), true)).toBe(false);
  expect(canConvert(actor('npc', [], { canTransform: true }), false)).toBe(true);
  expect(canConvert(null, true)).toBe(false);
});
