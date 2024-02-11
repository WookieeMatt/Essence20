const fields = foundry.data.fields;

export function makeBool(init) {
  return new fields.BooleanField({initial: init})
}

export function makeInt(init) {
  return new fields.NumberField({
    initial: init,
    integer: true,
  });
}

export function makeStr(init) {
  return new fields.StringField({initial: init});
}

export function makeStrWithChoices(init, choices) {
  return new fields.StringField({
    choices: Object.values(choices),
    initial: init,
  });
}
