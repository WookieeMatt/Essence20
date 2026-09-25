import { jest } from '@jest/globals';
import { resizeTokens, changeTokenImage, checkIsLocked, getNumActions, applySystemColorCssVariables, relativeLuminance } from "./actor.mjs";

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
    // ...and the Essence chips' number boxes a light wash to carry that dark text.
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-inset', 'rgba(255, 255, 255, 0.55)');
  });

  // Magenta and purple read at under 2:1 with the old light grey.
  test("a dark color gets near-white text over the default dark halo", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: '#c00798' } });
    expect(element.style.setProperty).toHaveBeenCalledWith('--e20-system-color-contrast', '#f2f2f2');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-halo');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-inset');
  });

  test("an unparseable color keeps the stylesheet default", () => {
    const element = makeElement();
    applySystemColorCssVariables(element, { system: { color: 'rebeccapurple' } });
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-contrast');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-halo');
    expect(element.style.removeProperty).toHaveBeenCalledWith('--e20-system-color-inset');
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
