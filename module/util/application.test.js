import { FormValidationError, getFormData } from './application.mjs';

describe('FormValidationError', () => {
  test('reads as its message alone (Foundry shows a form handler error as String(error))', () => {
    const error = new FormValidationError('Give each Essence a different progression.');
    expect(String(error)).toBe('Give each Essence a different progression.');
    expect(String(new Error('x'))).toBe('Error: x');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getFormData', () => {
  test('the first truthy value in the form', () => {
    expect(getFormData({ driver: '', role: 'passenger' })).toBe('passenger');
    expect(getFormData({})).toBeNull();
  });
});
