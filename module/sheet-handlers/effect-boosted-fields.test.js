import { keepEffectBoostsOutOfSource, storedNumber } from './effect-boosted-fields.mjs';

/** A Power Battery holder: base Maximum Personal Power 3, shown 5. */
function batteryActor() {
  return {
    _source: { system: { powers: { personal: { max: 3, value: 2 } } } },
    system: { powers: { personal: { max: 5, value: 2 } } },
    overrides: { system: { powers: { personal: { max: 5 } } } },
  };
}

describe('keepEffectBoostsOutOfSource (Power Battery grew the pool on every save)', () => {
  test('saving the sheet unchanged leaves the base alone', () => {
    const data = { system: { powers: { personal: { max: 5, value: 1 } } } };
    keepEffectBoostsOutOfSource(data, batteryActor());
    expect(data).toEqual({ system: { powers: { personal: { value: 1 } } } });
  });

  test('a form value comes in as a string', () => {
    const data = { system: { powers: { personal: { max: '5' } } } };
    keepEffectBoostsOutOfSource(data, batteryActor());
    expect(data.system.powers.personal).toEqual({});
  });

  test('typing a new total moves the base by the same amount', () => {
    const data = { system: { powers: { personal: { max: 6 } } } };
    keepEffectBoostsOutOfSource(data, batteryActor());
    expect(data.system.powers.personal.max).toBe(4);
  });

  test('fields no effect touches, and actors with no effects, pass through', () => {
    const data = { system: { powers: { personal: { value: 4 } } }, name: 'Red' };
    keepEffectBoostsOutOfSource(data, batteryActor());
    expect(data).toEqual({ system: { powers: { personal: { value: 4 } } }, name: 'Red' });
    const plain = { system: { powers: { personal: { max: 3 } } } };
    keepEffectBoostsOutOfSource(plain, { _source: {}, system: {} });
    expect(plain.system.powers.personal.max).toBe(3);
  });

  test('a changed non-number is saved as typed', () => {
    const actor = { _source: { system: { size: 'common' } }, system: { size: 'large' }, overrides: { system: { size: 'large' } } };
    const data = { system: { size: 'huge' } };
    keepEffectBoostsOutOfSource(data, actor);
    expect(data.system.size).toBe('huge');
  });
});

describe('keepEffectBoostsOutOfSource - DerivedStat rules (Grid Connection grew the pool on every save)', () => {
  /** Grid Connection's +1: stored 3, shown 4, no Active Effect override. */
  const ruleActor = () => ({
    _source: { system: { powers: { personal: { max: 3 } } } },
    system: { powers: { personal: { max: 4 } } },
    overrides: {},
    _ruleBoostPaths: new Set(['system.powers.personal.max']),
  });

  test('saving unchanged leaves the stored maximum alone', () => {
    const data = { system: { powers: { personal: { max: '4' } } } };
    keepEffectBoostsOutOfSource(data, ruleActor());
    expect(data.system.powers.personal).toEqual({});
  });

  test('typing a new total moves the stored maximum by the same amount', () => {
    const data = { system: { powers: { personal: { max: 6 } } } };
    keepEffectBoostsOutOfSource(data, ruleActor());
    expect(data.system.powers.personal.max).toBe(5);
  });
});

describe('storedNumber', () => {
  test('reads the stored value, falling back to the shown one', () => {
    expect(storedNumber({ _source: { system: { a: 3 } }, system: { a: 5 } }, 'system.a')).toBe(3);
    expect(storedNumber({ system: { a: 5 } }, 'system.a')).toBe(5);
    expect(storedNumber({ system: {} }, 'system.a')).toBe(0);
  });
});
