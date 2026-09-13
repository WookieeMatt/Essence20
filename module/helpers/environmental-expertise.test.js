import { jest } from '@jest/globals';
import {
  ENVIRONMENTAL_EXPERTISE_ID, hasActiveEnvironmentalExpertise, isEnvironmentalExpertiseActive,
  READ_THE_LAND_ID, toggleEnvironmentalExpertise,
} from './environmental-expertise.mjs';

function makeActor({ hasPerk = true, active = false, perkId = ENVIRONMENTAL_EXPERTISE_ID } = {}) {
  const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: perkId } } }] : [];
  const flagStore = { environmentalExpertiseActive: active };
  return {
    items,
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isEnvironmentalExpertiseActive", () => {
  test("false by default", () => {
    expect(isEnvironmentalExpertiseActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isEnvironmentalExpertiseActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleEnvironmentalExpertise", () => {
  test("activates from inactive, and returns true", async () => {
    const actor = makeActor({ active: false });
    const result = await toggleEnvironmentalExpertise(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', true);
  });

  test("deactivates from active, and returns false", async () => {
    const actor = makeActor({ active: true });
    const result = await toggleEnvironmentalExpertise(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', false);
  });
});

describe("hasActiveEnvironmentalExpertise", () => {
  test("true with the Perk and the toggle active", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: true }))).toBe(true);
  });

  test("false with the Perk but the toggle inactive", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: false }))).toBe(false);
  });

  test("false without the Perk, even if the (unrelated) flag happens to be true", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: false, active: true }))).toBe(false);
  });

  test("true with Read The Land (instead of the base Perk) and the toggle active - same shared flag", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: true, perkId: READ_THE_LAND_ID }))).toBe(true);
  });

  test("false with Read The Land but the toggle inactive", () => {
    expect(hasActiveEnvironmentalExpertise(makeActor({ hasPerk: true, active: false, perkId: READ_THE_LAND_ID }))).toBe(false);
  });
});
