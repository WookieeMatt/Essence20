import { MLP2 } from './mlp2.mjs';

// Something Is Off and Waterrunning are item rules now (rules/conv10-slC10.test.js).
test('the slice no longer keys on Something Is Off or Waterrunning', () => {
  expect(MLP2.somethingIsOff).toBeUndefined();
  expect(MLP2.waterrunning).toBeUndefined();
});
