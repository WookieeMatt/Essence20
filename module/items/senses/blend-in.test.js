import { jest } from '@jest/globals';
import { grantBlendInUpgrades } from './blend-in.mjs';

const SILENT_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.nftZIaQ3MVn2nviU";
const STEALTH_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.ThXrre0RHTcr1BEp";

function makeArmorItem({ equipped = true, existingItems = {} } = {}) {
  const armorItem = {
    type: 'armor',
    _id: 'armor1',
    system: { equipped, items: { ...existingItems } },
  };
  armorItem.update = jest.fn(async (data) => {
    for (const [path, value] of Object.entries(data)) {
      const match = path.match(/^system\.items\.(.+)$/);
      if (!match) {
        continue;
      }

      if (value instanceof foundry.data.operators.ForcedDeletion) {
        delete armorItem.system.items[match[1]];
      } else {
        armorItem.system.items[match[1]] = value;
      }
    }
  });
  return armorItem;
}

function makeActor(items = []) {
  items.find = Array.prototype.find.bind(items);
  return { items };
}

describe("grantBlendInUpgrades", () => {
  beforeEach(() => {
    global.Item = {
      create: jest.fn(async (doc) => ({ uuid: doc.uuid, type: doc.type, system: doc.system, setFlag: jest.fn() })),
    };
    global.fromUuid = jest.fn(async (uuid) => ({ uuid, type: 'upgrade', system: { type: 'armor', description: '' } }));
  });

  test("attaches both Silent and Stealth to the actor's equipped armor", async () => {
    const armorItem = makeArmorItem();
    const actor = makeActor([armorItem]);

    const result = await grantBlendInUpgrades(actor);

    expect(result).toBe(true);
    const attachedUuids = Object.values(armorItem.system.items).map(entry => entry.uuid);
    expect(attachedUuids).toEqual(expect.arrayContaining([SILENT_UPGRADE_ID, STEALTH_UPGRADE_ID]));
    expect(Object.keys(armorItem.system.items)).toHaveLength(2);
  });

  test("returns false with no equipped armor", async () => {
    const actor = makeActor([makeArmorItem({ equipped: false })]);

    const result = await grantBlendInUpgrades(actor);

    expect(result).toBe(false);
    expect(global.Item.create).not.toHaveBeenCalled();
  });

  test("doesn't double-attach an upgrade the armor already carries", async () => {
    const armorItem = makeArmorItem({ existingItems: { existing1: { uuid: SILENT_UPGRADE_ID } } });
    const actor = makeActor([armorItem]);

    await grantBlendInUpgrades(actor);

    const silentEntries = Object.values(armorItem.system.items).filter(entry => entry.uuid == SILENT_UPGRADE_ID);
    expect(silentEntries).toHaveLength(1);
    const stealthEntries = Object.values(armorItem.system.items).filter(entry => entry.uuid == STEALTH_UPGRADE_ID);
    expect(stealthEntries).toHaveLength(1);
  });

  test("picks the first equipped armor when the actor has more than one", async () => {
    const unequipped = makeArmorItem({ equipped: false });
    const equipped = makeArmorItem({ equipped: true });
    const actor = makeActor([unequipped, equipped]);

    await grantBlendInUpgrades(actor);

    expect(Object.keys(unequipped.system.items)).toHaveLength(0);
    expect(Object.keys(equipped.system.items)).toHaveLength(2);
  });
});
