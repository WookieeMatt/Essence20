import { jest } from '@jest/globals';
import { ownedItemFromUuid } from './item-lookups.mjs';

describe('ownedItemFromUuid', () => {
  const own = { id: 'eff1', name: 'Dancer Pistol' };
  const actor = { items: new Map([['eff1', own]]) };

  afterEach(() => {
    delete global.fromUuid;
  });

  test("a uuid naming another actor's copy (an unlinked token's base actor) answers the sheet actor's own item", async () => {
    global.fromUuid = jest.fn(async () => ({ id: 'eff1', name: 'base copy' }));
    expect(await ownedItemFromUuid(actor, 'Actor.base.Item.eff1')).toBe(own);
    expect(global.fromUuid).not.toHaveBeenCalled();
  });

  test('an id the actor lacks falls back to the uuid; none answers null', async () => {
    const elsewhere = { id: 'other' };
    global.fromUuid = jest.fn(async () => elsewhere);
    expect(await ownedItemFromUuid(actor, 'Actor.base.Item.other')).toBe(elsewhere);
    expect(await ownedItemFromUuid(null, 'Actor.base.Item.other')).toBe(elsewhere);
    expect(await ownedItemFromUuid(actor, '')).toBeNull();
    global.fromUuid = jest.fn(async () => null);
    expect(await ownedItemFromUuid(actor, 'Actor.base.Item.gone')).toBeNull();
  });
});
