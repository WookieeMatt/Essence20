const fields = foundry.data.fields;

export function makeDefensesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: new fields.BooleanField({initial: usesDrivers}),
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

export const creature = () => ({
  canHover: new fields.BooleanField({initial: false}),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields(false, 10),
    evasion: makeDefensesFields(false, 10),
    willpower: makeDefensesFields(true, null),
    cleverness: makeDefensesFields(true, null),
  }),
});
