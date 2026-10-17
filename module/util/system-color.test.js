import { jest } from '@jest/globals';
import { applySystemColorCssVariables, relativeLuminance } from "./system-color.mjs";

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
