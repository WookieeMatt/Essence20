export function makeEssencesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: new fields.BooleanField({initial: usesDrivers}),
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

class ZordBaseActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      armor: makeInt(10),
      essences: new fields.SchemaField({
        strength: makeEssencesFields(false, 3),
        speed: makeEssencesFields(false, 3),
        smarts: makeEssencesFields(true, null),
        social: makeEssencesFields(true, null),
      }),
    };
  }
}
