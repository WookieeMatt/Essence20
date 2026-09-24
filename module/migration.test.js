import { jest } from '@jest/globals';
import { migrateItemData, resetMigrationCaches } from './migration.mjs';

/**
 * A pack index entry lookup, the shape compendiumActionType reads.
 */
function setPacks(entriesByPack = {}) {
  resetMigrationCaches();
  global.game = {
    ...(global.game ?? {}),
    packs: {
      get: jest.fn((name) => {
        const key = name.replace('essence20.', '');
        if (!(key in entriesByPack)) {
          return null;
        }

        return {
          getIndex: jest.fn(async () => ({
            get: (id) => entriesByPack[key][id] ?? null,
          })),
        };
      }),
    },
  };
}

/**
 * An embedded item, as migrateItemData receives it - source data, not a document.
 */
function makeItem({ type = 'perk', actionType = 'none', source = null } = {}) {
  const item = { type, name: 'Takedown', system: { actionType } };
  if (source) {
    item._stats = { compendiumSource: source };
  }

  return item;
}

const TAKEDOWN = 'Compendium.essence20.gi_joe_crb.Item.Yev7VrgEKtsTGdrx';

/* Embedded items are snapshots: whatever the compendium said the day they were dropped onto a
   character is what they still say. When a pass gives ~280 Perks an action cost, every character
   built before it keeps a copy that costs nothing. */
describe('action-cost drift from the compendium', () => {
  test('adopts a cost the compendium has since been given', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBe('standard');
  });

  /* Only ever none -> something. A value already set is either one this migration applied or one a
     GM chose deliberately, and there is no way to tell those apart - so it is left alone. */
  test('never overwrites a cost the item already carries', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN, actionType: 'free' }));

    expect(update['system.actionType']).toBeUndefined();
  });

  test('is a no-op when the compendium also says none', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'none' } } } });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  // Value-matched, so running it twice changes nothing the second time.
  test('is a no-op on a second run', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'standard' } } } });
    const item = makeItem({ source: TAKEDOWN });

    const first = await migrateItemData(item);
    item.system.actionType = first['system.actionType'];
    const second = await migrateItemData(item);

    expect(second['system.actionType']).toBeUndefined();
  });

  test('leaves a hand-made item with no compendium original alone', async () => {
    setPacks({ gi_joe_crb: {} });

    const update = await migrateItemData(makeItem());

    expect(update['system.actionType']).toBeUndefined();
  });

  // A game line this world does not have installed must not throw.
  test('survives a pack that is not present', async () => {
    setPacks({});

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  test('survives an entry since deleted from its pack', async () => {
    setPacks({ gi_joe_crb: {} });

    const update = await migrateItemData(makeItem({ source: TAKEDOWN }));

    expect(update['system.actionType']).toBeUndefined();
  });

  /* The weaponEffect rule is the fallback for an effect with no compendium original - a GM's own,
     born None under the old schema default. Where the compendium HAS an answer, that wins. */
  test('a hand-made weapon effect still falls back to Standard', async () => {
    setPacks({});

    const update = await migrateItemData(makeItem({ type: 'weaponEffect' }));

    expect(update['system.actionType']).toBe('standard');
  });

  test('a compendium weapon effect takes the cost its pack gives it', async () => {
    setPacks({ gi_joe_crb: { Yev7VrgEKtsTGdrx: { system: { actionType: 'free' } } } });

    const update = await migrateItemData(makeItem({ type: 'weaponEffect', source: TAKEDOWN }));

    expect(update['system.actionType']).toBe('free');
  });
});
