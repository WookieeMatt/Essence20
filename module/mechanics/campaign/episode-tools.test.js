import { episodeToolsOn } from './episode-tools.mjs';

afterEach(() => delete global.game);

test('the buttons show for a GM with the setting on, and nobody else', () => {
  const world = (isGM, on) => ({ user: { isGM }, settings: { get: () => on } });
  global.game = world(true, true);
  expect(episodeToolsOn()).toBe(true);
  global.game = world(true, false);
  expect(episodeToolsOn()).toBe(false);
  global.game = world(false, true);
  expect(episodeToolsOn()).toBe(false);
  const unregistered = () => {
    throw new Error('not registered');
  };

  global.game = { user: { isGM: true }, settings: { get: unregistered } };
  expect(episodeToolsOn()).toBe(false);
  delete global.game;
  expect(episodeToolsOn()).toBe(false);
});
