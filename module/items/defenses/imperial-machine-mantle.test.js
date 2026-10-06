import { jest } from '@jest/globals';
import {
  breakMachineMantleIfPresent, findIntactMachineMantle, getMachineMantleBonus, IMPERIAL_MACHINE_MANTLE_ID,
} from './imperial-machine-mantle.mjs';

function mantleItem({ broken = false, sourceId = IMPERIAL_MACHINE_MANTLE_ID } = {}) {
  const flagStore = { imperialMachineMantleBroken: broken };
  return {
    type: 'upgrade',
    flags: { core: { sourceId } },
    getFlag: (scope, key) => flagStore[key],
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

function makeActor(items = []) {
  return { items };
}

describe("findIntactMachineMantle", () => {
  test("finds the actor's own copy by flags.core.sourceId", () => {
    const mantle = mantleItem();
    const actor = makeActor([mantle]);
    expect(findIntactMachineMantle(actor)).toBe(mantle);
  });

  test("finds the actor's own copy by _stats.compendiumSource", () => {
    const mantle = { ...mantleItem(), flags: {}, _stats: { compendiumSource: IMPERIAL_MACHINE_MANTLE_ID } };
    const actor = makeActor([mantle]);
    expect(findIntactMachineMantle(actor)).toBe(mantle);
  });

  test("ignores an already-broken Mantle", () => {
    const actor = makeActor([mantleItem({ broken: true })]);
    expect(findIntactMachineMantle(actor)).toBeUndefined();
  });

  test("ignores an unrelated upgrade Item", () => {
    const actor = makeActor([{ type: 'upgrade', flags: { core: { sourceId: 'Compendium.essence20.other.Item.xyz' } }, getFlag: () => undefined }]);
    expect(findIntactMachineMantle(actor)).toBeUndefined();
  });

  test("returns undefined when the actor has no items", () => {
    expect(findIntactMachineMantle(makeActor())).toBeUndefined();
  });
});

describe("getMachineMantleBonus", () => {
  test("0 when the actor has no intact Mantle", () => {
    expect(getMachineMantleBonus(makeActor(), 4)).toBe(0);
  });

  test("ceil(50%) of the current armor bonus when the Mantle is intact", () => {
    const actor = makeActor([mantleItem()]);
    expect(getMachineMantleBonus(actor, 4)).toBe(2);
    expect(getMachineMantleBonus(actor, 3)).toBe(2); // rounds up
    expect(getMachineMantleBonus(actor, 0)).toBe(0);
  });
});

describe("breakMachineMantleIfPresent", () => {
  test("flags the actor's intact Mantle as broken", async () => {
    const mantle = mantleItem();
    const actor = makeActor([mantle]);
    await breakMachineMantleIfPresent(actor);
    expect(mantle.setFlag).toHaveBeenCalledWith('essence20', 'imperialMachineMantleBroken', true);
    expect(findIntactMachineMantle(actor)).toBeUndefined();
  });

  test("does nothing when the actor has no Mantle", async () => {
    const actor = makeActor([]);
    await expect(breakMachineMantleIfPresent(actor)).resolves.toBeUndefined();
  });

  test("does nothing to an already-broken Mantle", async () => {
    const mantle = mantleItem({ broken: true });
    const actor = makeActor([mantle]);
    await breakMachineMantleIfPresent(actor);
    expect(mantle.setFlag).not.toHaveBeenCalled();
  });
});
