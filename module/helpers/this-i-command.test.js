import { jest } from '@jest/globals';

const applyDamage = jest.fn(async () => 1);
jest.unstable_mockModule('./helpers/combat.mjs', () => ({ applyDamage }));
const { bankPendingBonus, offerThisICommand, THIS_I_COMMAND_ID } = await import('./perks.mjs');

// This, I Command (Cobra Codex p.57): 1 Psychic to an ally doubles an upshift or extra actions granted to them.
const officer = (hasPerk = true) => ({
  uuid: 'Actor.officer', name: 'Baroness',
  items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: THIS_I_COMMAND_ID } } }] : [],
});
const ally = () => ({ uuid: 'Actor.ally', name: 'Viper', setFlag: jest.fn() });
let confirm;

beforeEach(() => {
  applyDamage.mockClear();
  confirm = jest.fn(async () => true);
  global.foundry.applications = { api: { DialogV2: { confirm } } };
  global.game.combat = null;
});

test('a yes deals the ally 1 Psychic and doubles a banked upshift', async () => {
  const target = ally();
  await bankPendingBonus(target, 'pendingX', { shiftUp: 2 }, { granter: officer() });
  expect(applyDamage).toHaveBeenCalledWith(target, 1, 'psychic');
  expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingX', expect.objectContaining({ shiftUp: 4 }));
});

test('a no keeps it as granted, with no damage', async () => {
  confirm.mockResolvedValue(false);
  const target = ally();
  await bankPendingBonus(target, 'pendingX', { shiftUp: 1 }, { granter: officer() });
  expect(applyDamage).not.toHaveBeenCalled();
  expect(target.setFlag).toHaveBeenCalledWith('essence20', 'pendingX', expect.objectContaining({ shiftUp: 1 }));
});

test('never asked without the Perk, for yourself, or for something that is not an upshift', async () => {
  expect(await offerThisICommand(officer(false), ally(), 'x')).toBe(false);
  const self = officer();
  expect(await offerThisICommand(self, self, 'x')).toBe(false);
  const target = ally();
  await bankPendingBonus(target, 'pendingX', { edge: true }, { granter: officer() });
  expect(confirm).not.toHaveBeenCalled();
});
