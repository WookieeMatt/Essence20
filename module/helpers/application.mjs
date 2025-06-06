/**
 * This function pulls the returned data from the form submission out and returns it.
 * @param {object} formData the data returned from the form
 * @returns the selected data from the form
 */
export function getFormData(formData){
  let returnData = null;
  for (const [, value] of Object.entries(formData)) {
    if(value) {
      returnData = value;
      break;
    }
  }

  return returnData;
}
