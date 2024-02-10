export function makeZeroedInt() {
  return new fields.NumberField({
    initial: 0,
    integer: true,
  });
}
