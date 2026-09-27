/**
 * Links a Roll Options Dialog switch that grants an Edge to the dialog's own Snag/Normal/Edge radio,
 * so the radio always shows what will actually be rolled. Ticking the switch moves the radio one step
 * toward Edge (Snag becomes Normal - an Edge and a Snag cancel - and Normal becomes Edge); unticking
 * puts back what the radio showed before, unless the player changed the radio by hand in between, in
 * which case their choice stands. The radio is then the only place the Edge lives: dice.mjs reads
 * snagEdge back and adds nothing more for the switch.
 *
 * Used by the Enviro-Sealed "Resisting an adverse situation" switch (roll-options-dialog.mjs), which
 * dice.mjs renders ticked in a hostile environment.
 */

/**
 * @param {String} value   'snag', 'normal' or 'edge'.
 * @returns {String}       One step toward Edge.
 */
export function stepTowardEdge(value) {
  return value == 'snag' ? 'normal' : 'edge';
}

/**
 * @param {HTMLFormElement} form
 * @param {String} checkboxName   The switch's form name.
 */
export function linkEdgeToggle(form, checkboxName) {
  const checkbox = form?.querySelector?.(`input[name="${checkboxName}"]`);
  const radios = [...(form?.querySelectorAll?.('input[name="snagEdge"]') ?? [])];
  if (!checkbox || !radios.length) {
    return;
  }

  const getRadio = () => radios.find(radio => radio.checked)?.value ?? 'normal';
  const setRadio = (value) => {
    for (const radio of radios) {
      radio.checked = radio.value == value;
    }
  };

  // What the radio showed before the switch moved it, and what the switch moved it to.
  let before = null;
  let applied = null;
  const apply = () => {
    before = getRadio();
    applied = stepTowardEdge(before);
    setRadio(applied);
  };

  if (checkbox.checked) {
    apply();
  }

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      apply();
    } else if (before != null && getRadio() == applied) {
      setRadio(before);
    }
  });
}
