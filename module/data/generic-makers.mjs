const fields = foundry.data.fields;

export function makeInt(init=0) {
  return new fields.NumberField({
    initial: init,
    integer: true,
  });
}
