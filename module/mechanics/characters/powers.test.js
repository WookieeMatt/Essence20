import { findPower, actorHasPower } from './powers.mjs';

const POWER_ID = "Compendium.essence20.across_the_stars.Item.XfWmXOtcIM5snRKL";

describe("findPower / actorHasPower", () => {
  test("finds a power-type item by flags.core.sourceId", () => {
    const item = { type: 'power', flags: { core: { sourceId: POWER_ID } } };
    const actor = { items: [item] };
    expect(findPower(actor, POWER_ID)).toBe(item);
    expect(actorHasPower(actor, POWER_ID)).toBe(true);
  });

  test("finds a power-type item via the _stats.compendiumSource fallback", () => {
    const item = { type: 'power', flags: {}, _stats: { compendiumSource: POWER_ID } };
    const actor = { items: [item] };
    expect(findPower(actor, POWER_ID)).toBe(item);
    expect(actorHasPower(actor, POWER_ID)).toBe(true);
  });

  test("ignores a perk-type item with the same sourceId", () => {
    const item = { type: 'perk', flags: { core: { sourceId: POWER_ID } } };
    const actor = { items: [item] };
    expect(findPower(actor, POWER_ID)).toBeUndefined();
    expect(actorHasPower(actor, POWER_ID)).toBe(false);
  });

  test("returns false/undefined without a matching item, or without an actor at all", () => {
    expect(actorHasPower({ items: [] }, POWER_ID)).toBe(false);
    expect(actorHasPower(null, POWER_ID)).toBe(false);
  });
});
