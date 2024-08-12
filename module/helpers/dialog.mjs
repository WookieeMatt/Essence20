/**
 * Returns values of inputs upon dialog submission. Used for passing data between sequential dialogs.
 * @param {HTML} html   The html of the dialog upon submission
 * @returns {Object>}  The dialog inputs and their submitted values
 */
export function rememberOptions(html) {
  const options = {};
  html.find("input").each((i, el) => {
    options[el.id] = el.checked;
  });

  return options;
}

/**
 * Returns values of inputs upon dialog submission.
 * @param {HTML} html   The html of the dialog upon submission
 * @returns {Object}  The dialog inputs and their submitted values
 */
export function rememberSelect(html) {

  const options = {};
  html.find("select").each((i, el) => {
    options[el.id] = el.value;
  });

  return options;
}

/**
 * Returns values of inputs upon dialog submission. Used for passing data between sequential dialogs.
 * (This one does values instead of checked)
 * @param {HTML} html   The html of the dialog upon submission
 * @returns {Object}  The dialog inputs and their entered values
 */
export function rememberValues(html) {
  const options = {};
  html.find("input").each((i, el) => {
    options[el.id] = {
      max: el.max,
      value: el.value,
    };
  });

  return options;
}
