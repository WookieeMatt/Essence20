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
  return new fields.StringField({
    initial,
    nullable: initial == null,
  });
}

export function makeStrArray() {
  return new fields.ArrayField(new fields.StringField());
}

export function makeStrWithChoices(choices, initial) {
  return new fields.StringField({
    choices,
    initial,
    nullable: initial == null,
  });
}

export function makeStrArrayWithChoices(choices, initial=[]) {
  return new fields.ArrayField(
    makeStrWithChoices(choices, initial),
  );
}
