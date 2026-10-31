import { jest } from '@jest/globals';
import { MODULE_SETTINGS_OFFERED, offerKey, offerModuleSettings, pendingModuleSettings } from './module-settings.mjs';

const mod = (id, settings, { active = true, version = '1.0.0' } = {}) => ({ id, title: id.toUpperCase(), version, active, flags: { essence20: { settings } } });

test('active modules with exportable settings not yet offered at this version', () => {
  const modules = [
    mod('mask', { episodeTools: true, sheetTheme: 'pony' }),
    mod('off', { episodeTools: true }, { active: false }),
    mod('done', { episodeTools: true }),
    mod('only-other', { sheetTheme: 'pony' }),
    { id: 'plain', active: true },
  ];
  const pending = pendingModuleSettings(modules, ['done@1.0.0']);
  expect(pending.map(entry => entry.module.id)).toEqual(['mask']);
  expect(pending[0].settings).toEqual({ episodeTools: true });
  // A new version is offered again.
  expect(pendingModuleSettings([mod('done', { episodeTools: true }, { version: '1.1.0' })], ['done@1.0.0'])).toHaveLength(1);
  expect(offerKey({ id: 'a' })).toBe('a@');
  expect(pendingModuleSettings(undefined)).toEqual([]);
});

describe('offering them to the GM', () => {
  let stored;
  let confirm;
  beforeEach(() => {
    stored = { [MODULE_SETTINGS_OFFERED]: [], episodeTools: false, gameLine: '' };
    confirm = jest.fn(async () => true);
    const registered = new Map([
      ['essence20.episodeTools', { name: 'E20.SettingsEpisodeTools' }],
      ['essence20.gameLine', { name: 'E20.SettingsGameLine', choices: { mask: 'M.A.S.K. (GI Joe rules)' } }],
    ]);
    globalThis.game = {
      users: { activeGM: { isSelf: true } },
      modules: [mod('mask', { episodeTools: true, gameLine: 'mask', prerequisiteMode: 'strict' }), mod('ghost', { prerequisiteMode: 'warn' })],
      settings: {
        settings: registered,
        get: (scope, key) => stored[key],
        set: jest.fn(async (scope, key, value) => {
          stored[key] = value;
        }),
      },
      i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data)}` },
    };
    globalThis.foundry = { applications: { api: { DialogV2: { confirm } } }, utils: { escapeHTML: text => String(text).replace(/</g, '&lt;') } };
    globalThis.ui = { notifications: { info: jest.fn() } };
  });

  afterEach(() => {
    delete globalThis.game;
    delete globalThis.foundry;
    delete globalThis.ui;
  });

  test('Yes applies the known ones and remembers the offer; an unknown setting is left alone', async () => {
    await offerModuleSettings();
    expect(confirm).toHaveBeenCalledTimes(1);
    const content = confirm.mock.calls[0][0].content;
    expect(content).toContain('E20.SettingsEpisodeTools:</strong> Yes');
    expect(content).toContain('M.A.S.K. (GI Joe rules)');
    expect(stored).toMatchObject({ episodeTools: true, gameLine: 'mask' });
    expect(stored).not.toHaveProperty('prerequisiteMode');
    // ghost's only setting isn't registered here: remembered without asking.
    expect(stored[MODULE_SETTINGS_OFFERED]).toEqual(['mask@1.0.0', 'ghost@1.0.0']);

    confirm.mockClear();
    await offerModuleSettings();
    expect(confirm).not.toHaveBeenCalled();
  });

  test('No changes nothing but is remembered too', async () => {
    confirm.mockResolvedValue(false);
    await offerModuleSettings();
    expect(stored).toMatchObject({ episodeTools: false, gameLine: '' });
    expect(stored[MODULE_SETTINGS_OFFERED]).toContain('mask@1.0.0');
  });

  test('only the active GM is asked', async () => {
    game.users.activeGM.isSelf = false;
    await offerModuleSettings();
    expect(confirm).not.toHaveBeenCalled();
  });
});
