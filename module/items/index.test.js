import { jest } from '@jest/globals';

// Every extension module loads and registers without throwing (items/index.mjs).
beforeAll(() => {
  global.Hooks = { on: jest.fn(), once: jest.fn(), callAll: jest.fn() };
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [] };
  global.CONFIG = { E20: {}, statusEffects: [] };
  global.foundry = { utils: { randomID: () => 'r' }, applications: { api: {} } };
});

test('the extension index imports cleanly', async () => {
  await expect(import('./index.mjs')).resolves.toBeDefined();
  const { registrySnapshot } = await import('../mechanics/item-hooks.mjs');
  expect(registrySnapshot().uses.length).toBeGreaterThan(0);
});
