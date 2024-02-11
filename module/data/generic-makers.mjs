const fields = foundry.data.fields;

export function makeInt(init) {
  return new fields.NumberField({
    initial: init,
    integer: true,
  });
}
