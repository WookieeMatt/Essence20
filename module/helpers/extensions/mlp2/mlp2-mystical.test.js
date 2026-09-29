import { jest } from '@jest/globals';
import { MLP2 } from './mlp2.mjs';
import { findExtUse } from '../../extensions.mjs';

// Mystical Understanding's Use button: Refocus / Essential Research / Magically Fit In.
function makeHolder(points = 3) {
  const pool = {
    system: { resource: { value: points } },
    update: jest.fn(async (data) => {
      pool.system.resource.value = data['system.resource.value'];
    }),
  };
  const actor = {
    name: 'Twilight',
    system: {},
    flags: { essence20: {} },
    setFlag: jest.fn(),
    _getBaseRolePoints: () => pool,
  };
  const item = { name: 'Mystical Understanding', parent: actor, flags: { core: { sourceId: MLP2.mysticalUnderstanding } } };
  return { actor, item, pool };
}

let waitMock;
beforeEach(() => {
  waitMock = jest.fn();
  global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  global.game = { i18n: { localize: k => k, format: k => k } };
  global.ui = { notifications: { warn: jest.fn() } };
});

test("offers Magically Fit In alongside Refocus and Essential Research", async () => {
  const { item } = makeHolder();
  waitMock.mockResolvedValueOnce(null);

  await findExtUse(item).run(item, null, async () => true);

  expect(waitMock.mock.calls[0][0].buttons.map(button => button.action)).toEqual(['refocus', 'research', 'fitIn']);
});

test("Magically Fit In spends the chosen Mystical Points and banks the ranks", async () => {
  const { actor, item, pool } = makeHolder(3);
  waitMock.mockResolvedValueOnce('fitIn').mockResolvedValueOnce({ skill: 'athletics', amount: 2 });

  const line = await findExtUse(item).run(item, null, async () => true);

  expect(pool.system.resource.value).toBe(1);
  expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'magicallyFitInBonus', expect.objectContaining({ skill: 'athletics', amount: 2 }));
  expect(line).toBe('E20.PerkUsedNotification');
});

test("Magically Fit In posts nothing when its picker is cancelled", async () => {
  const { actor, item } = makeHolder(3);
  waitMock.mockResolvedValueOnce('fitIn').mockResolvedValueOnce('cancel');

  expect(await findExtUse(item).run(item, null, async () => true)).toBeNull();
  expect(actor.setFlag).not.toHaveBeenCalled();
});

test("Magically Fit In warns with no Mystical Points left", async () => {
  const { item } = makeHolder(0);
  waitMock.mockResolvedValueOnce('fitIn');

  expect(await findExtUse(item).run(item, null, async () => true)).toBeNull();
  expect(ui.notifications.warn).toHaveBeenCalled();
});
