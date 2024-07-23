import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

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
  altModeId: makeStr(''),
  altModeName: makeStr(''),
  altModesize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
  background: new fields.SchemaField({
    pronouns: makeStr(''),
    role: makeStr(''),
  }),
  canMorph: makeBool(false),
  canSpellcast: makeBool(false),
  canTransform: makeBool(false),
  conditioning: makeInt(0),
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
  essenceRanks: new fields.SchemaField({
    smarts: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    social: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    speed: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    strength: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
  }),
  focusEssence: makeStr(''),
  isMorphed: makeBool(false),
  isTransformed: makeBool(false),
  level: makeInt(1),
  originEssencesIncrease: makeStr(),
  originSkillsIncrease: makeStr(),
  powers: new fields.SchemaField({
    personal: new fields.SchemaField({
      regeneration: makeInt(0),
      max: makeInt(0),
      value: makeInt(0),
    }),
    sorcerous: new fields.SchemaField({
      levelTaken: makeInt(0),
      max: makeInt(0),
      value: makeInt(0),
    }),
  }),
  notes: new fields.HTMLField(),
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
