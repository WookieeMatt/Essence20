export function getFormData(formData){
  for (const [, value] of Object.entries(formData)) {
    if(value) {
      returnData = value;
      break;
    }
  }
  return returnData;
}
