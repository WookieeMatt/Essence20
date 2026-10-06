import { isHonestAssessmentActive } from './honest-assessment.mjs';

const makeActor = active => ({ getFlag: (scope, key) => (scope == 'essence20' && key == 'honestAssessmentActive' ? active : undefined) });

describe("isHonestAssessmentActive", () => {
  test("reads the actor flag the item's Use rule writes", () => {
    expect(isHonestAssessmentActive(makeActor(true))).toBe(true);
    expect(isHonestAssessmentActive(makeActor(false))).toBe(false);
    expect(isHonestAssessmentActive(makeActor(undefined))).toBe(false);
    expect(isHonestAssessmentActive(null)).toBe(false);
  });
});
