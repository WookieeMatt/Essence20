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

export function makeEssenceFields() {
  return new fields.SchemaField({
    max: makeInt(3),
    value: makeInt(3),
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
    strength: makeEssenceFields(),
    speed: makeEssenceFields(),
    smarts: makeEssenceFields(),
    social: makeEssenceFields(),
  }),
  level: makeInt(1),
});

export function migrateCharacterData(source) {
  if (source.essences) {
    for (const [essence, value] of Object.entries(source.essences)) {
      if (typeof value == 'number') { // Standard Essence damage migration
        source.essences[essence] = { max: value, value: value };
      } else if (value?.max?.max) { // Possible edge case
        source.essences[essence].max = value.max.max;
        source.essences[essence].value = value.max.max;
      } else if (value.required) { // Previous migration may have set it to a SchemaField()
        source.essences[essence].max = value.max || 0;
        source.essences[essence].value = value.max || 0;
      }
    }
  }
}
