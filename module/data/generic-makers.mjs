const fields = foundry.data.fields;

export function makeBool(initial) {
  return new fields.BooleanField({initial});
}

export function makeInt(initial) {
  return new fields.NumberField({
    initial,
    integer: true,
    nullable: initial == null,
  });
}

export function makeStr(initial) {
  return new fields.StringField({initial});
}

export function makeStrArray() {
  return new fields.ArrayField(new fields.StringField());
}

export function makeStrWithChoices(initial, choices) {
  return new fields.StringField({
    choices,
    initial,
  });
}
