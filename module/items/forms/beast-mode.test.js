import { jest } from '@jest/globals';
import { isBeastModeActive, toggleBeastMode } from './beast-mode.mjs';

global.fromUuid = jest.fn();

function makeActor({ resourceValue = 1, grantedId = undefined, grantedItem = undefined } = {}) {
  const flags = { beastModeGrantedItemId: grantedId };
  const items = {
    get: jest.fn((id) => (id === grantedId ? grantedItem : undefined)),
  };
  const rolePoints = { system: { resource: { value: resourceValue } }, update: jest.fn() };

  return {
    items,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key]; 
    }),
    createEmbeddedDocuments: jest.fn(async () => [{ id: 'newItem1' }]),
    _getBaseRolePoints: jest.fn(() => rolePoints),
    __rolePoints: rolePoints,
  };
}

beforeEach(() => {
  fromUuid.mockReset();
  fromUuid.mockResolvedValue({ toObject: () => ({ name: 'Engrafted Mutation' }) });
});

describe("isBeastModeActive", () => {
  test("false with no granted item flag", () => {
    expect(isBeastModeActive(makeActor())).toBe(false);
  });

  test("true when the granted item still exists on the actor", () => {
    const grantedItem = { id: 'item1' };
    const actor = makeActor({ grantedId: 'item1', grantedItem });
    expect(isBeastModeActive(actor)).toBe(true);
  });

  test("false when the flagged item no longer exists (deleted some other way)", () => {
    const actor = makeActor({ grantedId: 'item1', grantedItem: undefined });
    expect(isBeastModeActive(actor)).toBe(false);
  });
});

describe("toggleBeastMode", () => {
  test("switching ON spends 1 Adaptation Point and grants a copy of Engrafted Mutation", async () => {
    const actor = makeActor({ resourceValue: 2 });

    const nowActive = await toggleBeastMode(actor);

    expect(nowActive).toBe(true);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ name: 'Engrafted Mutation' }]);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'beastModeGrantedItemId', 'newItem1');
  });

  test("returns null and spends nothing without an Adaptation Point available", async () => {
    const actor = makeActor({ resourceValue: 0 });

    const nowActive = await toggleBeastMode(actor);

    expect(nowActive).toBeNull();
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("switching OFF deletes the granted item and clears the flag, no refund", async () => {
    const grantedItem = { id: 'item1', delete: jest.fn() };
    const actor = makeActor({ resourceValue: 5, grantedId: 'item1', grantedItem });

    const nowActive = await toggleBeastMode(actor);

    expect(nowActive).toBe(false);
    expect(grantedItem.delete).toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'beastModeGrantedItemId');
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });
});
