import { makeBool, makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: makeBool(usesDrivers),
    value: makeInt(init),
  });
}

function makeEssencesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: makeBool(usesDrivers),
    value: makeInt(init),
  });
}

export const machine = () => ({
  canHover: makeBool(false),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields(false, 10),
    evasion: makeDefensesFields(false, 10),
    willpower: makeDefensesFields(true, null),
    cleverness: makeDefensesFields(true, null),
  }),
  essences: new fields.SchemaField({
    strength: makeEssencesFields(false, 3),
    speed: makeEssencesFields(false, 3),
    smarts: makeEssencesFields(true, null),
    social: makeEssencesFields(true, null),
  }),
});
