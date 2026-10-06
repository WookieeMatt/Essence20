import { jest } from "@jest/globals";
import {
  getGearNanomitePowerName, getGearNanomiteUsesLeft, hasGearNanomitePower, isGearNanomiteInert, setGearNanomitePower, useGearNanomitePower,
} from "./nanomite-gear.mjs";

const REPAIR_MACHINE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HOM0e2W0aBYnZ8Z3";

function makeGear({ powerUuid = REPAIR_MACHINE_ID, uses = 1, spent = 0 } = {}) {
  const gear = {
    name: 'Nano-Kit',
    system: { nanomite: { powerUuid, uses, spent } },
    update: jest.fn(async (data) => {
      for (const [key, value] of Object.entries(data)) {
        gear.system.nanomite[key.split('.').pop()] = value;
      }
    }),
  };
  return gear;
}

function makeActor() {
  return { name: 'Duke', getFlag: jest.fn(), setFlag: jest.fn(async () => {}) };
}

describe("uses and the inert state", () => {
  test("single-use gear is inert once used", () => {
    expect(hasGearNanomitePower(makeGear())).toBe(true);
    expect(getGearNanomiteUsesLeft(makeGear())).toBe(1);
    expect(isGearNanomiteInert(makeGear())).toBe(false);
    expect(isGearNanomiteInert(makeGear({ spent: 1 }))).toBe(true);
  });

  test("plain gear with no nanomite Power is never inert", () => {
    const plain = makeGear({ powerUuid: null });
    expect(hasGearNanomitePower(plain)).toBe(false);
    expect(isGearNanomiteInert(plain)).toBe(false);
  });
});

test("getGearNanomitePowerName reads the linked Power's name, or null", () => {
  fromUuidSync.mockReturnValue({ name: 'Repair Machine' });
  expect(getGearNanomitePowerName(makeGear())).toBe('Repair Machine');
  expect(getGearNanomitePowerName(makeGear({ powerUuid: null }))).toBeNull();
  fromUuidSync.mockReset();
});

describe("setGearNanomitePower", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
  });

  test("links a nanomite Power by its compendium source", async () => {
    const gear = makeGear({ powerUuid: null, spent: 1 });
    const power = { type: 'power', uuid: 'Actor.a.Item.p', _stats: { compendiumSource: REPAIR_MACHINE_ID }, system: { type: 'nanomite' } };
    expect(await setGearNanomitePower(gear, power)).toBe(true);
    expect(gear.update).toHaveBeenCalledWith({ 'system.nanomite.powerUuid': REPAIR_MACHINE_ID, 'system.nanomite.spent': 0 });
  });

  test("refuses a Grid Power, which spends Personal Power equipment doesn't have", async () => {
    const gear = makeGear({ powerUuid: null });
    expect(await setGearNanomitePower(gear, { type: 'power', uuid: 'x', system: { type: 'grid' } })).toBe(false);
    expect(gear.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("useGearNanomitePower", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
    ChatMessage.create.mockClear();
  });

  afterEach(() => {
    fromUuid.mockReset();
  });

  test("spends a use, says so, and runs the Power's effect by its source", async () => {
    // Repair Machine's effect banks an Edge on the holder (items/rolls/repair-machine.mjs).
    fromUuid.mockResolvedValue({ name: 'Repair Machine', type: 'power', flags: {}, system: {} });
    const actor = makeActor();
    const gear = makeGear({ uses: 2 });

    expect(await useGearNanomitePower(actor, gear)).toBe(true);
    expect(gear.system.nanomite.spent).toBe(1);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.NanomiteGearUsed' }));
    expect(actor.setFlag).toHaveBeenCalled();
  });

  test("the last use leaves the gear inert, and it can't be used again", async () => {
    fromUuid.mockResolvedValue({ name: 'Repair Machine', type: 'power', flags: {}, system: {} });
    const gear = makeGear();

    await useGearNanomitePower(makeActor(), gear);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'E20.NanomiteGearUsedInert' }));

    expect(await useGearNanomitePower(makeActor(), gear)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(gear.system.nanomite.spent).toBe(1);
  });

  test("warns when the linked Power no longer exists", async () => {
    fromUuid.mockResolvedValue(null);
    const gear = makeGear();
    expect(await useGearNanomitePower(makeActor(), gear)).toBe(false);
    expect(gear.update).not.toHaveBeenCalled();
  });
});
