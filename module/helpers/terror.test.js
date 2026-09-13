import { jest } from '@jest/globals';
import { getTerrorAvailable, grantTerrorIfEligible, spendTerror } from './terror.mjs';

const TERROR_ID = "Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd";
const APEX_DARK_RANGER_ID = "Compendium.essence20.beneath_the_helmet.Item.GJCOxtuot74Jnfs4";

function makeActor({ hasPerk = true, value = 1, max = 3, hasApex = false } = {}) {
  const rolePoints = { system: { resource: { value, max } }, update: jest.fn() };
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: TERROR_ID } } }] : [];
  if (hasApex) {
    items.push({ type: 'perk', flags: { core: { sourceId: APEX_DARK_RANGER_ID } } });
  }

  return {
    items,
    _getBaseRolePoints: jest.fn(() => rolePoints),
    __rolePoints: rolePoints,
  };
}

function makeTarget({ immune = false } = {}) {
  return { items: immune ? [] : [], statuses: new Set() };
}

describe("getTerrorAvailable", () => {
  test("reads the current Terror Capacity value", () => {
    expect(getTerrorAvailable(makeActor({ value: 2 }))).toBe(2);
  });

  test("returns 0 without the Perk", () => {
    expect(getTerrorAvailable(makeActor({ hasPerk: false }))).toBe(0);
  });
});

describe("grantTerrorIfEligible", () => {
  test("grants 1 Terror on an Edge'd hit, capped at max", async () => {
    const actor = makeActor({ value: 1, max: 3 });
    await grantTerrorIfEligible(actor, makeTarget(), true);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 2 });
  });

  test("caps at Terror Capacity's own max", async () => {
    const actor = makeActor({ value: 3, max: 3 });
    await grantTerrorIfEligible(actor, makeTarget(), true);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 3 });
  });

  test("does nothing without Edge", async () => {
    const actor = makeActor();
    await grantTerrorIfEligible(actor, makeTarget(), false);
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });

  test("Apex Dark Ranger (20th level) bypasses the Edge requirement entirely", async () => {
    const actor = makeActor({ value: 1, max: 3, hasApex: true });
    await grantTerrorIfEligible(actor, makeTarget(), false);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 2 });
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor({ hasPerk: false });
    await grantTerrorIfEligible(actor, makeTarget(), true);
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });

  test("does nothing with no target", async () => {
    const actor = makeActor();
    await grantTerrorIfEligible(actor, null, true);
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });
});

describe("spendTerror", () => {
  test("decrements the pool by the given amount", async () => {
    const actor = makeActor({ value: 3 });
    await spendTerror(actor, 2);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("floors at 0", async () => {
    const actor = makeActor({ value: 1 });
    await spendTerror(actor, 5);
    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
  });

  test("no-ops for a non-positive amount", async () => {
    const actor = makeActor({ value: 2 });
    await spendTerror(actor, 0);
    expect(actor.__rolePoints.update).not.toHaveBeenCalled();
  });
});
