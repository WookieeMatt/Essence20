import { jest } from "@jest/globals";
import {
  formatDailyUses, getDailyUsesLeft, getDailyUsesMax, MIMIC_ID, NANOFLAGE_ID, resetDailyPowerUses, spendDailyUse,
  tracksDailyUses,
} from "./nanomite-uses.mjs";

function makePower({ usesPer = 2, usesInterval = 'perDay', usesSpent = 0, type = 'nanomite', sourceId = null, name = 'Repair Machine' } = {}) {
  const power = {
    id: name,
    name,
    type: 'power',
    flags: { core: { sourceId } },
    system: { type, usesPer, usesInterval, usesSpent },
    update: jest.fn(async (data) => {
      power.system.usesSpent = data['system.usesSpent'];
    }),
  };
  return power;
}

function makeActor(items = [], flags = {}) {
  const actor = {
    name: 'Duke',
    items,
    getFlag: (scope, key) => flags[key],
    updateEmbeddedDocuments: jest.fn(async () => []),
  };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

describe("tracksDailyUses / getDailyUsesMax / getDailyUsesLeft", () => {
  test("only a per-day power with uses is tracked", () => {
    expect(tracksDailyUses(makePower())).toBe(true);
    expect(tracksDailyUses(makePower({ usesPer: null }))).toBe(false);
    expect(tracksDailyUses(makePower({ usesInterval: 'perScene' }))).toBe(false);
  });

  test("two uses a day, counting down as they're spent", () => {
    const power = makePower({ usesSpent: 1 });
    const actor = makeActor([power]);
    expect(getDailyUsesMax(actor, power)).toBe(2);
    expect(getDailyUsesLeft(actor, power)).toBe(1);
  });
});

describe("spendDailyUse", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
  });

  test("spends a use and lets the power activate", async () => {
    const power = makePower();
    const actor = makeActor([power]);
    expect(await spendDailyUse(actor, power)).toBe(true);
    expect(power.system.usesSpent).toBe(1);
  });

  test("refuses with a warning once the day's uses are gone", async () => {
    const power = makePower({ usesSpent: 2 });
    const actor = makeActor([power]);
    expect(await spendDailyUse(actor, power)).toBe(false);
    expect(power.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("an untracked power is always free", async () => {
    const power = makePower({ usesPer: null });
    expect(await spendDailyUse(makeActor([power]), power)).toBe(true);
    expect(power.update).not.toHaveBeenCalled();
  });
});

describe("resetDailyPowerUses", () => {
  test("a Rest gives back every spent use", async () => {
    const spent = makePower({ usesSpent: 2, name: 'Mimic' });
    const fresh = makePower({ usesSpent: 0, name: 'Swiftness' });
    const actor = makeActor([spent, fresh, { type: 'weapon', system: {} }]);
    expect(await resetDailyPowerUses(actor)).toBe(1);
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{ _id: 'Mimic', 'system.usesSpent': 0 }]);
  });

  test("nothing to do, nothing written", async () => {
    const actor = makeActor([makePower()]);
    expect(await resetDailyPowerUses(actor)).toBe(0);
    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

describe("formatDailyUses", () => {
  test("labels a tracked power, and is blank otherwise", () => {
    const power = makePower({ usesSpent: 1 });
    makeActor([power]);
    expect(formatDailyUses(power)).toBe('E20.PowerUsesToday');
    expect(formatDailyUses(makePower({ usesPer: null }))).toBe('');
  });
});

describe("Nanoflage's Mimic", () => {
  test("one use a scene on the Scene Clock instead of two a day", async () => {
    const mimic = makePower({ sourceId: MIMIC_ID, name: 'Mimic' });
    const nanoflage = { id: 'n', type: 'perk', flags: { core: { sourceId: NANOFLAGE_ID } }, system: {} };
    const flags = {};
    const actor = makeActor([mimic, nanoflage], flags);
    actor.setFlag = jest.fn(async (scope, key, value) => {
      flags[key] = value;
    });
    expect(getDailyUsesMax(actor, mimic)).toBe(1);
    expect(await spendDailyUse(actor, mimic)).toBe(true);
    expect(mimic.update).not.toHaveBeenCalled();
    expect(getDailyUsesLeft(actor, mimic)).toBe(0);
    expect(await spendDailyUse(actor, mimic)).toBe(false);
  });

  test("without Nanoflage, Mimic keeps its two a day", () => {
    const mimic = makePower({ sourceId: MIMIC_ID, name: 'Mimic' });
    expect(getDailyUsesMax(makeActor([mimic]), mimic)).toBe(2);
  });
});
