import { jest } from '@jest/globals';
import { resizeTokens, changeTokenImage, checkIsLocked, getNumActions, applySystemColorCssVariables } from "./actor.mjs";

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
});

describe("applySystemColorCssVariables", () => {
  function makeElement() {
    return { style: { setProperty: jest.fn() } };
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
});
