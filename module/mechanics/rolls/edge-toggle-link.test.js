/**
 * The switch and the Snag/Normal/Edge radio live in a real form, so this suite needs a DOM.
 *
 * @jest-environment jsdom
 */
import { linkEdgeToggle, stepTowardEdge } from "./edge-toggle-link.mjs";

function makeForm({ radio = 'normal', checked = false } = {}) {
  document.body.innerHTML = `
    <form>
      ${['snag', 'normal', 'edge'].map(value =>
    `<input type="radio" name="snagEdge" value="${value}" ${value == radio ? 'checked' : ''}>`).join('')}
      <input type="checkbox" name="applyEnviroSealedAdverseSituation" ${checked ? 'checked' : ''}>
    </form>`;
  return document.querySelector('form');
}

const radioOf = (form) => form.querySelector('input[name="snagEdge"]:checked').value;

function toggle(form, checked) {
  const checkbox = form.querySelector('[name="applyEnviroSealedAdverseSituation"]');
  checkbox.checked = checked;
  checkbox.dispatchEvent(new Event('change'));
}

describe("stepTowardEdge", () => {
  test("an Edge cancels a Snag, and otherwise gives an Edge", () => {
    expect(stepTowardEdge('snag')).toBe('normal');
    expect(stepTowardEdge('normal')).toBe('edge');
    expect(stepTowardEdge('edge')).toBe('edge');
  });
});

describe("linkEdgeToggle", () => {
  test("a switch that starts ticked moves the radio as the dialog opens", () => {
    const form = makeForm({ radio: 'normal', checked: true });
    linkEdgeToggle(form, 'applyEnviroSealedAdverseSituation');
    expect(radioOf(form)).toBe('edge');

    const untrained = makeForm({ radio: 'snag', checked: true });
    linkEdgeToggle(untrained, 'applyEnviroSealedAdverseSituation');
    expect(radioOf(untrained)).toBe('normal');
  });

  test("ticking moves the radio toward Edge, unticking puts it back", () => {
    const form = makeForm({ radio: 'snag' });
    linkEdgeToggle(form, 'applyEnviroSealedAdverseSituation');
    expect(radioOf(form)).toBe('snag');

    toggle(form, true);
    expect(radioOf(form)).toBe('normal');
    toggle(form, false);
    expect(radioOf(form)).toBe('snag');
  });

  test("an Edge the radio already had is kept when the switch is unticked", () => {
    const form = makeForm({ radio: 'edge', checked: true });
    linkEdgeToggle(form, 'applyEnviroSealedAdverseSituation');
    toggle(form, false);
    expect(radioOf(form)).toBe('edge');
  });

  test("a radio the player changed by hand is left alone on untick", () => {
    const form = makeForm({ radio: 'normal', checked: true });
    linkEdgeToggle(form, 'applyEnviroSealedAdverseSituation');
    form.querySelector('input[value="snag"]').checked = true;
    toggle(form, false);
    expect(radioOf(form)).toBe('snag');
  });

  test("does nothing on a dialog without the switch", () => {
    document.body.innerHTML = '<form><input type="radio" name="snagEdge" value="normal" checked></form>';
    const form = document.querySelector('form');
    expect(() => linkEdgeToggle(form, 'applyEnviroSealedAdverseSituation')).not.toThrow();
    expect(radioOf(form)).toBe('normal');
  });
});
