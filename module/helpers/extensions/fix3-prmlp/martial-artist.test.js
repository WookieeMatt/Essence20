import { MARTIAL_ARTIST_HANGUP_IDS, martialArtistApplyDialog, martialArtistToggles, targetMartialArtist } from './martial-artist.mjs';

const hangUp = (uuid, useStats = false) => ({
  type: 'hangUp', name: 'Martial Artist',
  flags: useStats ? {} : { core: { sourceId: uuid } },
  _stats: useStats ? { compendiumSource: uuid } : {},
});
const makeActor = (items = []) => ({ id: Math.random().toString(), items: { contents: items } });

function target(actor) {
  global.game.user.targets = { first: () => (actor ? { actor } : undefined) };
}

beforeEach(() => {
  global.game = { user: {}, i18n: { has: () => false } };
  global.CONFIG = { E20: { skillToEssence: { persuasion: 'social', athletics: 'strength' } } };
});

test('matches both printings, by sourceId or compendiumSource', () => {
  for (const id of MARTIAL_ARTIST_HANGUP_IDS) {
    expect(targetMartialArtist(makeActor([hangUp(id)]))).toBeTruthy();
    expect(targetMartialArtist(makeActor([hangUp(id, true)]))).toBeTruthy();
  }

  expect(targetMartialArtist(makeActor([]))).toBeNull();
});

test('offers an off-by-default switch on a Social roll at a targeted Martial Artist', () => {
  target(makeActor([hangUp(MARTIAL_ARTIST_HANGUP_IDS[0])]));
  const toggles = martialArtistToggles(makeActor(), { rolledSkill: 'persuasion', rolledEssence: 'social' });
  expect(toggles).toHaveLength(1);
  expect(toggles[0]).toMatchObject({ name: 'martialArtistGoad', type: 'checkbox', value: false });
});

test('no switch for non-Social rolls or without a Martial Artist target', () => {
  target(makeActor([hangUp(MARTIAL_ARTIST_HANGUP_IDS[1])]));
  expect(martialArtistToggles(makeActor(), { rolledSkill: 'athletics', rolledEssence: 'strength' })).toEqual([]);
  target(makeActor([]));
  expect(martialArtistToggles(makeActor(), { rolledSkill: 'persuasion', rolledEssence: 'social' })).toEqual([]);
  target(null);
  expect(martialArtistToggles(makeActor(), { rolledSkill: 'persuasion' })).toEqual([]);
});

test('ticking it gives Edge, or cancels a Snag', () => {
  const plain = { edge: false, snag: false, ext: { martialArtistGoad: true } };
  martialArtistApplyDialog(null, plain);
  expect(plain).toMatchObject({ edge: true, snag: false });

  const snagged = { edge: false, snag: true, ext: { martialArtistGoad: true } };
  martialArtistApplyDialog(null, snagged);
  expect(snagged).toMatchObject({ edge: false, snag: false });

  const off = { edge: false, snag: false, ext: {} };
  martialArtistApplyDialog(null, off);
  expect(off.edge).toBe(false);
});
