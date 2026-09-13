import { jest } from '@jest/globals';
import { isSpeedBoostActive, applySpeedBoost } from './speed-boost.mjs';

// item.effects is a real Foundry EmbeddedCollection (extends Map, but ports over Array-style
// iteration helpers like .find()/.every() - confirmed against real working code elsewhere in this
// project, e.g. helpers/actor.mjs's actor.effects.find()). This fake matches only the surface
// speed-boost.mjs actually touches: .size, .every(), and being directly for-of iterable.
function makeEffectsCollection(effects) {
  return {
    size: effects.length,
    every: fn => effects.every(fn),
    [Symbol.iterator]: () => effects[Symbol.iterator](),
  };
}

function makeEffect(disabled) {
  return { disabled, update: jest.fn(async function (data) {
    this.disabled = data.disabled; 
  }) };
}

describe('isSpeedBoostActive', () => {
  test('false when the item has no effects at all', () => {
    const item = { effects: makeEffectsCollection([]) };
    expect(isSpeedBoostActive(item)).toBe(false);
  });

  test('false when any effect is still disabled', () => {
    const item = { effects: makeEffectsCollection([makeEffect(false), makeEffect(true)]) };
    expect(isSpeedBoostActive(item)).toBe(false);
  });

  test('true when every effect is enabled', () => {
    const item = { effects: makeEffectsCollection([makeEffect(false), makeEffect(false)]) };
    expect(isSpeedBoostActive(item)).toBe(true);
  });
});

describe('applySpeedBoost', () => {
  test('enables every disabled effect and reports it changed something', async () => {
    const ground = makeEffect(true);
    const initiative = makeEffect(true);
    const item = { effects: makeEffectsCollection([ground, initiative]) };

    const changed = await applySpeedBoost(item);

    expect(changed).toBe(true);
    expect(ground.update).toHaveBeenCalledWith({ disabled: false });
    expect(initiative.update).toHaveBeenCalledWith({ disabled: false });
  });

  test('is a no-op and reports no change when already active', async () => {
    const ground = makeEffect(false);
    const initiative = makeEffect(false);
    const item = { effects: makeEffectsCollection([ground, initiative]) };

    const changed = await applySpeedBoost(item);

    expect(changed).toBe(false);
    expect(ground.update).not.toHaveBeenCalled();
    expect(initiative.update).not.toHaveBeenCalled();
  });
});
