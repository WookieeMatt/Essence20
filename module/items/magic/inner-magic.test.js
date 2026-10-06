import { jest } from '@jest/globals';
import { getInnerMagicWillpowerReduction, stackInnerMagicWillpowerReduction } from './inner-magic.mjs';

function setGame(sceneEpoch = 1) {
  global.game = { settings: { get: jest.fn(() => sceneEpoch) } };
}

function makeActor() {
  const flags = {};
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("Inner Magic (MLP CRB, Magic Role Perk, 2nd level, p.94) - Willpower reduction", () => {
  test("stacks by 1 each activation within the same scene", async () => {
    setGame(1);
    const actor = makeActor();

    await stackInnerMagicWillpowerReduction(actor);
    expect(getInnerMagicWillpowerReduction(actor)).toBe(1);

    await stackInnerMagicWillpowerReduction(actor);
    await stackInnerMagicWillpowerReduction(actor);
    expect(getInnerMagicWillpowerReduction(actor)).toBe(3);
  });

  test("resets once a new scene begins", async () => {
    setGame(1);
    const actor = makeActor();
    await stackInnerMagicWillpowerReduction(actor);
    await stackInnerMagicWillpowerReduction(actor);
    expect(getInnerMagicWillpowerReduction(actor)).toBe(2);

    setGame(2);
    expect(getInnerMagicWillpowerReduction(actor)).toBe(0);

    await stackInnerMagicWillpowerReduction(actor);
    expect(getInnerMagicWillpowerReduction(actor)).toBe(1);
  });

  test("0 with nothing banked", () => {
    setGame(1);
    expect(getInnerMagicWillpowerReduction(makeActor())).toBe(0);
  });
});
