import { jest } from '@jest/globals';
import { isHonestAssessmentActive, toggleHonestAssessment } from './honest-assessment.mjs';

function makeActor(active = false) {
  const flagStore = { honestAssessmentActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isHonestAssessmentActive", () => {
  test("false by default", () => {
    expect(isHonestAssessmentActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isHonestAssessmentActive(makeActor(true))).toBe(true);
  });
});

describe("toggleHonestAssessment", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleHonestAssessment(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'honestAssessmentActive', true);
    expect(isHonestAssessmentActive(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleHonestAssessment(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'honestAssessmentActive', false);
    expect(isHonestAssessmentActive(actor)).toBe(false);
  });
});
