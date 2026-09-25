import { jest } from '@jest/globals';
import { resizeTokens, changeTokenImage, checkIsLocked, getNumActions, applySystemColorCssVariables, relativeLuminance, syncAutoImmobilizedStatus } from "./actor.mjs";

describe("syncAutoImmobilizedStatus", () => {
  function makeActor({ restrained, immobilizedEffect } = {}) {
    const effects = immobilizedEffect ? [immobilizedEffect] : [];
    return {
      statuses: new Set(restrained ? ['restrained'] : []),
      effects,
      createEmbeddedDocuments: jest.fn(),
    };
  }

  test("does nothing when not Restrained and no auto-Immobilized effect exists", async () => {
    const actor = makeActor({});
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("adds an auto-flagged Immobilized effect when Restrained and none exists yet", async () => {
    const actor = makeActor({ restrained: true });
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [expect.objectContaining({
      updateSource: expect.any(Function),
    })]);
  });

  test("doesn't add a second effect when one already exists", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => true, delete: jest.fn() };
    const actor = makeActor({ restrained: true, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("removes the auto-applied Immobilized effect once no longer Restrained", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => true, delete: jest.fn() };
    const actor = makeActor({ restrained: false, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(existing.delete).toHaveBeenCalled();
  });

  test("leaves a manually-applied Immobilized effect alone when Restrained ends", async () => {
    const existing = { statuses: new Set(['immobilized']), getFlag: () => false, delete: jest.fn() };
    const actor = makeActor({ restrained: false, immobilizedEffect: existing });
    await syncAutoImmobilizedStatus(actor);
    expect(existing.delete).not.toHaveBeenCalled();
  });

  test("no-ops for a null actor", async () => {
    await expect(syncAutoImmobilizedStatus(null)).resolves.toBeUndefined();
  });
});

describe("resizeTokens", () => {
  test("updates every active token's document with the new dimensions", () => {
    const tokenA = { document: { update: jest.fn() } };
    const tokenB = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [tokenA, tokenB]) };

    resizeTokens(actor, 2, 3);

    expect(tokenA.document.update).toHaveBeenCalledWith({ height: 3, width: 2 });
    expect(tokenB.document.update).toHaveBeenCalledWith({ height: 3, width: 2 });
  });
});

describe("changeTokenImage", () => {
  test("updates every active token's texture", () => {
    const token = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [token]) };

    changeTokenImage(actor, "path/to/image.webp");

    expect(token.document.update).toHaveBeenCalledWith({ "texture.src": "path/to/image.webp" });
  });

  // An unset Morphed / Alt Mode image used to blank the token and throw from the token animation.
  test("leaves the tokens alone when there is no image to switch to", () => {
    const token = { document: { update: jest.fn() } };
    const actor = { getActiveTokens: jest.fn(() => [token]) };

    changeTokenImage(actor, null);
    changeTokenImage(actor, "");

    expect(token.document.update).not.toHaveBeenCalled();
  });
});

describe("checkIsLocked", () => {
  test("returns false and does not notify when the actor isn't locked", () => {
    const actor = { system: { isLocked: false } };
    expect(checkIsLocked(actor)).toBe(false);
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
  });

  test("returns true and notifies when the actor is locked", () => {
    const actor = { system: { isLocked: true } };
    expect(checkIsLocked(actor)).toBe(true);
    expect(global.ui.notifications.error).toHaveBeenCalledWith('E20.ActorLockError');
  });
});

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

describe("applySystemColorCssVariables", () => {
  function makeElement() {
    return { style: { setProperty: jest.fn(), removeProperty: jest.fn() } };
  }

  test("does nothing without an element or a system color", () => {
    const setProperty = jest.fn();
    applySystemColorCssVariables(null, { system: { color: '#ff0000' } });
    applySystemColorCssVariables({ style: { setProperty } }, { system: {} });
    expect(setProperty).not.toHaveBeenCalled();
  });

  test("sets the raw color and its rgba(...,0.5) variant for a 6-digit hex color", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: '#ff0000' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color', '#ff0000');
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-50', 'rgba(255, 0, 0, 0.5)');
  });

  test("expands a 3-digit hex color before converting to rgba", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: '#0f0' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-50', 'rgba(0, 255, 0, 0.5)');
  });

  test("falls back to a black rgba overlay for a non-hex color", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: 'rebeccapurple' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-50', 'rgba(0, 0, 0, 0.5)');
  });

  // The unselected tabs are filled with this colour; light grey text vanished on a light one.
  test("a light color gets dark text and no halo for the unselected tabs", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: '#d4d44a' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-contrast', '#1a1a1a');
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-halo', 'transparent');
  });

  // Magenta and purple read at under 2:1 with the old light grey.
  test("a dark color gets near-white text over the default dark halo", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: '#c00798' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-contrast', '#f2f2f2');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-halo');
  });

  test("an unparseable color keeps the stylesheet default", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: 'rebeccapurple' } });
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-contrast');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-halo');
  });
});

describe("relativeLuminance", () => {
  test("black is 0 and white is 1", () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });

  test("green weighs far more than blue, as the eye does", () => {
    expect(relativeLuminance('#00ff00')).toBeGreaterThan(relativeLuminance('#0000ff'));
  });

  test("anything that is not a hex color is null", () => {
    expect(relativeLuminance('rebeccapurple')).toBeNull();
    expect(relativeLuminance(null)).toBeNull();
  });
});
