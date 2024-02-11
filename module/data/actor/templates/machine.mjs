import { makeBool } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: makeBool(usesDrivers),
    value: new fields.NumberField({
      initial: init,
      integer: true,
    }),
  });
}

export const creature = () => ({
  canHover: makeBool(false),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields(false, 10),
    evasion: makeDefensesFields(false, 10),
    willpower: makeDefensesFields(true, null),
    cleverness: makeDefensesFields(true, null),
  }),
});
