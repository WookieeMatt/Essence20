import { makeInt, makeStr } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(name, essence) {
  return new fields.SchemaField({
    armor: makeInt(0),
    base: makeInt(10),
    bonus: makeInt(0),
    essence: makeStr(essence),
    morphed: makeInt(0),
    name: makeStr(name),
    string: makeStr(''),
    total: makeInt(0),
  });
}

export const character = () => ({
  background: new fields.SchemaField({
    pronouns: makeStr(''),
    role: makeStr(''),
  }),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields('toughness', 'strength'),
    evasion: makeDefensesFields('evasion', 'speed'),
    willpower: makeDefensesFields('willpower', 'smarts'),
    cleverness: makeDefensesFields('cleverness', 'social'),
  }),
  essences: new fields.SchemaField({
    strength: makeInt(3),
    speed: makeInt(3),
    smarts: makeInt(3),
    social: makeInt(3),
  }),
  level: makeInt(1),
  notes: new fields.HTMLField(),
});
