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
  notes: new fields.HTMLField(),
});

export function migrateCharacterData(source) {
  if (source.essences) {
    if (typeof source.essences.strength == 'number') {
      const strength = source.essences.strength;
      const speed = source.essences.speed;
      const smarts = source.essences.smarts;
      const social = source.essences.social;
      source.essences.strength = null;
      source.essences.speed = null;
      source.essences.smarts = null;
      source.essences.social = null;
      source.essences.strength = makeEssenceFields(),
      source.essences.speed = makeEssenceFields(),
      source.essences.smarts = makeEssenceFields(),
      source.essences.social = makeEssenceFields(),

      source.essences.strength.max = strength;
      source.essences.strength.value = strength;
      source.essences.speed.max = speed;
      source.essences.speed.value = speed;
      source.essences.smarts.max = smarts;
      source.essences.smarts.value = smarts;
      source.essences.social.max = social;
      source.essences.social.value = social;
    }

    for (const [essence, value] of Object.entries(source.essences)) {
      if (value?.max?.max) {
        source.essences[essence].max = value.max.max;
        source.essences[essence].value = value.max.max;
      }
    }
  }
}
