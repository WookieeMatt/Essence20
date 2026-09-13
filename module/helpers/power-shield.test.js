import { jest } from '@jest/globals';
import { isPowerShieldActive, applyPowerShield } from './power-shield.mjs';

// See speed-boost.test.js's own comment on why this fake shape is enough for item.effects.
function makeEffectsCollection(effects) {
  return {
    size: effects.length,
    every: fn => effects.every(fn),
    [Symbol.iterator]: () => effects[Symbol.iterator](),
  };
}

function makeEffect(disabled) {
  return { disabled, update: jest.fn(async function (data) { this.disabled = data.disabled; }) };
}

describe('isPowerShieldActive', () => {
  test('false when the item has no effects at all', () => {
    const item = { effects: makeEffectsCollection([]) };
    expect(isPowerShieldActive(item)).toBe(false);
  });

  test('false when the effect is still disabled', () => {
    const item = { effects: makeEffectsCollection([makeEffect(true)]) };
    expect(isPowerShieldActive(item)).toBe(false);
  });

  test('true once the effect is enabled', () => {
    const item = { effects: makeEffectsCollection([makeEffect(false)]) };
    expect(isPowerShieldActive(item)).toBe(true);
  });
});

describe('applyPowerShield', () => {
  test('enables the disabled effect and reports it changed something', async () => {
    const shield = makeEffect(true);
    const item = { effects: makeEffectsCollection([shield]) };

    const changed = await applyPowerShield(item);

    expect(changed).toBe(true);
    expect(shield.update).toHaveBeenCalledWith({ disabled: false });
  });

  test('is a no-op and reports no change when already active', async () => {
    const shield = makeEffect(false);
    const item = { effects: makeEffectsCollection([shield]) };

    const changed = await applyPowerShield(item);

    expect(changed).toBe(false);
    expect(shield.update).not.toHaveBeenCalled();
  });
});
