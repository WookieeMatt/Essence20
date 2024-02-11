export function makeDefensesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: new fields.BooleanField({initial: usesDrivers}),
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

class MachineActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      canHover: new fields.BooleanField({initial: false}),
      defenses: new fields.SchemaField({
        toughness: makeDefensesFields(false, 10),
        evasion: makeDefensesFields(false, 10),
        willpower: makeDefensesFields(true, null),
        cleverness: makeDefensesFields(true, null),
      }),
    };
  }
}
