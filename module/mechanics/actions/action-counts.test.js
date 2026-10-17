import { getNumActions } from "./action-counts.mjs";

describe("getNumActions", () => {
  test("grants no actions at 0 speed", () => {
    const actor = { system: { essences: { speed: { max: 0 } } } };
    expect(getNumActions(actor)).toEqual({ free: 0, movement: 0, standard: 0 });
  });

  test("grants a movement action at 1 speed", () => {
    const actor = { system: { essences: { speed: { max: 1 } } } };
    expect(getNumActions(actor)).toEqual({ free: 0, movement: 1, standard: 0 });
  });

  test("grants movement and standard actions at 2 speed", () => {
    const actor = { system: { essences: { speed: { max: 2 } } } };
    expect(getNumActions(actor)).toEqual({ free: 0, movement: 1, standard: 1 });
  });

  test("grants free actions above 2 speed", () => {
    const actor = { system: { essences: { speed: { max: 5 } } } };
    expect(getNumActions(actor)).toEqual({ free: 3, movement: 1, standard: 1 });
  });

  test("without Quick Thinker, free actions still key off Speed even when Smarts differs", () => {
    const actor = {
      system: { essences: { speed: { max: 5 }, smarts: { max: 3 } } },
      items: [],
    };
    expect(getNumActions(actor)).toEqual({ free: 3, movement: 1, standard: 1 });
  });

  test("grants no actions for an actor with no Essence scores (e.g. Party)", () => {
    const actor = { system: {} };
    expect(getNumActions(actor)).toEqual({ free: 0, movement: 0, standard: 0 });
  });
});
