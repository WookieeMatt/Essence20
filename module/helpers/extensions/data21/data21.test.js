import { jest } from '@jest/globals';

global.Hooks = { on: jest.fn() };

const { D21 } = await import('./common.mjs');
const { psychoRiderOf, halveMovementDerived, HALVE_KIND } = await import('./weapons.mjs');
const { isNonMystical } = await import('./threats.mjs');

const sourced = (uuid, extra = {}) => ({ id: extra.id ?? uuid.slice(-5), name: extra.name ?? 'Item', type: extra.type ?? 'perk', system: extra.system ?? {}, flags: { core: { sourceId: uuid }, essence20: extra.flags ?? {} } });
const actor = (items = [], extra = {}) => ({
  uuid: extra.uuid ?? 'Actor.a', name: extra.name ?? 'A', type: extra.type ?? 'playerCharacter',
  system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: items, get: id => items.find(i => i.id == id) },
  update: jest.fn(), statuses: new Set(),
});

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { id: 'u1', targets: new Set() }, actors: [], combat: null, settings: { get: () => 0 } };
  global.CONFIG = {
    E20: {
      skillShiftList: ['d12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'],
      skillToEssence: { finesse: 'speed', might: 'strength' },
      actorReach: { small: 2, common: 5, large: 5 },
    },
  };
});

test('Psycho alternate riders read their flags', () => {
  expect(psychoRiderOf({ flags: { essence20: { d21Shove: 10 } } })).toEqual({ kind: 'shove', feet: 10 });
  expect(psychoRiderOf({ flags: { essence20: { d21HalveMovement: true } } }).kind).toBe('halve');
  expect(psychoRiderOf({ flags: { essence20: { d21Disarm: true } } }).kind).toBe('disarm');
  expect(psychoRiderOf({ flags: {} })).toBeNull();
});

test('halved Movement rounds up while the mark lasts', () => {
  const target = actor([], { flags: { riderMarks: [{ kind: HALVE_KIND, by: 'x' }] }, system: { movement: { ground: { total: 25 }, aerial: { total: 0 } } } });
  halveMovementDerived(target);
  expect(target.system.movement.ground.total).toBe(13);
});

test('who is Non-Mystical (Larger Than Life is a rule now)', () => {
  const mystic = actor([sourced(D21.mystic, { name: 'Mystic' })]);
  const mundane = actor([], { system: { defenses: { toughness: { armor: 3 } } } });
  expect(isNonMystical(mundane)).toBe(true);
  expect(isNonMystical(mystic)).toBe(false);
  expect(isNonMystical(actor([], { flags: { d21Mystical: true } }))).toBe(false);
});

test('Psycho Sword alternate halves the target', async () => {
  const { psychoAlternatePostRoll } = await import('./weapons.mjs');
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = async () => ({ name: 'Psycho Sword Alternate Effect', flags: { essence20: { d21HalveMovement: true } } });
  const target = actor([], { uuid: 'Actor.t' });
  target.setFlag = jest.fn();
  await psychoAlternatePostRoll(actor(), [], {}, { hits: [{ target, hit: true }], rider: { itemUuid: 'Item.x' } });
  expect(target.setFlag).toHaveBeenCalledWith('essence20', 'riderMarks', [expect.objectContaining({ kind: HALVE_KIND })]);
});
