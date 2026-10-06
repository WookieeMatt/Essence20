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

  const QUICK_THINKER_ID = "Compendium.essence20.mlp_crb.Item.i0PwoR0hDC0vyDD2";

  test("Quick Thinker: free actions come from Smarts instead of Speed", () => {
    const actor = {
      system: { essences: { speed: { max: 5 }, smarts: { max: 3 } } },
      items: [{ type: 'perk', flags: { core: { sourceId: QUICK_THINKER_ID } } }],
    };
    expect(getNumActions(actor)).toEqual({ free: 1, movement: 1, standard: 1 });
  });

  test("Quick Thinker: doesn't affect movement/standard actions, which still key off Speed", () => {
    const actor = {
      system: { essences: { speed: { max: 0 }, smarts: { max: 5 } } },
      items: [{ type: 'perk', flags: { core: { sourceId: QUICK_THINKER_ID } } }],
    };
    expect(getNumActions(actor)).toEqual({ free: 3, movement: 0, standard: 0 });
  });

  test("without Quick Thinker, free actions still key off Speed even when Smarts differs", () => {
    const actor = {
      system: { essences: { speed: { max: 5 }, smarts: { max: 3 } } },
      items: [],
    };
    expect(getNumActions(actor)).toEqual({ free: 3, movement: 1, standard: 1 });
  });

  const UNIVERSITY_DAYS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5T3DHQjLjyM9J5tS";

  test("University Days: same effect as Quick Thinker, verbatim identical text in a different book", () => {
    const actor = {
      system: { essences: { speed: { max: 5 }, smarts: { max: 3 } } },
      items: [{ type: 'perk', flags: { core: { sourceId: UNIVERSITY_DAYS_ID } } }],
    };
    expect(getNumActions(actor)).toEqual({ free: 1, movement: 1, standard: 1 });
  });

  test("grants no actions for an actor with no Essence scores (e.g. Party)", () => {
    const actor = { system: {} };
    expect(getNumActions(actor)).toEqual({ free: 0, movement: 0, standard: 0 });
  });

  const FOOT_SOLDIER_ID = "Compendium.essence20.tf_crb.Item.VXQ32nRPF4qEYTZR";

  test("Foot Soldier (tf_crb p.91): +2 free actions in Bot Mode, Speed itself unaffected", () => {
    const actor = {
      system: { essences: { speed: { max: 3 } }, isTransformed: false },
      items: [{ type: 'perk', flags: { core: { sourceId: FOOT_SOLDIER_ID } } }],
    };
    // Speed 3 alone -> free:1; treated as Speed 5 for the Free-action count only.
    expect(getNumActions(actor)).toEqual({ free: 3, movement: 1, standard: 1 });
  });

  test("Foot Soldier: no bonus while Transformed (Alt Mode)", () => {
    const actor = {
      system: { essences: { speed: { max: 3 } }, isTransformed: true },
      items: [{ type: 'perk', flags: { core: { sourceId: FOOT_SOLDIER_ID } } }],
    };
    expect(getNumActions(actor)).toEqual({ free: 1, movement: 1, standard: 1 });
  });
});
