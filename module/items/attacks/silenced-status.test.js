const { addSilencedStatus } = await import('./silenced-status.mjs');

beforeEach(() => {
  global.CONFIG = { statusEffects: [], E20: {} };
});

test('silenced status added once (Pillage and Dreadnok Recruit are item rules - rules/conv9-slC9.test.js)', () => {
  addSilencedStatus();
  addSilencedStatus();
  expect(CONFIG.statusEffects.filter(s => s.id == 'silenced')).toHaveLength(1);
});
