import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(name, essence) {
  return new fields.SchemaField({
    armor: makeInt(),
    base: makeInt(10),
    bonus: makeInt(),
    essence: new fields.StringField({initial: essence}),
    morphed: makeInt(),
    name: new fields.StringField({initial: name}),
  });
}

export const character = () => ({
  background: new fields.SchemaField({
    pronouns: new fields.StringField({initial: ''}),
    role: new fields.StringField({initial: ''}),
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
  influenceIds: new fields.ArrayField(new fields.StringField()), // Idt we need this
  level: makeInt(1),
  notes: new fields.HTMLField(),
});
