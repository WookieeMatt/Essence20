import { jest } from '@jest/globals';
import { grantSilentRunningUpgrades } from './silent-running.mjs';

const SILENCER_ID = "Compendium.essence20.gi_joe_crb.Item.rSP76BWjYaifJLIZ";
const SUPPRESSOR_ID = "Compendium.essence20.ferocious_fighters.Item.sHBEBigG2y63MSWL";

function makeWeaponItem({ equipped = true, existingItems = {} } = {}) {
  const weaponItem = {
    type: 'weapon',
    _id: 'weapon1',
    system: { equipped, items: { ...existingItems } },
  };
  weaponItem.update = jest.fn(async (data) => {
    for (const [path, value] of Object.entries(data)) {
      const match = path.match(/^system\.items\.(.+)$/);
      if (!match) {
        continue;
      }

      if (value instanceof foundry.data.operators.ForcedDeletion) {
        delete weaponItem.system.items[match[1]];
      } else {
        weaponItem.system.items[match[1]] = value;
      }
    }
  });
  return weaponItem;
}

function makeActor(items = []) {
  items.find = Array.prototype.find.bind(items);
  return { items };
}

describe("grantSilentRunningUpgrades", () => {
  beforeEach(() => {
    global.Item = {
      create: jest.fn(async (doc) => ({ uuid: doc.uuid, type: doc.type, system: doc.system, setFlag: jest.fn() })),
    };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid, type: 'upgrade', system: { type: 'weapon', description: '' } }));
  });

  test("attaches both Silencer and Suppressor to the actor's equipped weapon", async () => {
    const weaponItem = makeWeaponItem();
    const actor = makeActor([weaponItem]);

    const result = await grantSilentRunningUpgrades(actor);

    expect(result).toBe(true);
    const attachedUuids = Object.values(weaponItem.system.items).map(entry => entry.uuid);
    expect(attachedUuids).toEqual(expect.arrayContaining([SILENCER_ID, SUPPRESSOR_ID]));
    expect(Object.keys(weaponItem.system.items)).toHaveLength(2);
  });

  test("returns false with no equipped weapon", async () => {
    const actor = makeActor([makeWeaponItem({ equipped: false })]);

    const result = await grantSilentRunningUpgrades(actor);

    expect(result).toBe(false);
    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("doesn't double-attach an upgrade the weapon already carries", async () => {
    const weaponItem = makeWeaponItem({ existingItems: { existing1: { uuid: SILENCER_ID } } });
    const actor = makeActor([weaponItem]);

    await grantSilentRunningUpgrades(actor);

    const silencerEntries = Object.values(weaponItem.system.items).filter(entry => entry.uuid == SILENCER_ID);
    expect(silencerEntries).toHaveLength(1);
    const suppressorEntries = Object.values(weaponItem.system.items).filter(entry => entry.uuid == SUPPRESSOR_ID);
    expect(suppressorEntries).toHaveLength(1);
  });

  test("picks the first equipped weapon when the actor has more than one", async () => {
    const unequipped = makeWeaponItem({ equipped: false });
    const equipped = makeWeaponItem({ equipped: true });
    const actor = makeActor([unequipped, equipped]);

    await grantSilentRunningUpgrades(actor);

    expect(Object.keys(unequipped.system.items)).toHaveLength(0);
    expect(Object.keys(equipped.system.items)).toHaveLength(2);
  });
});
