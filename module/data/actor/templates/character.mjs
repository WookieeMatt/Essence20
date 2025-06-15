import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices, makeStrArrayWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeTrainingSchema(itemTypes) {
  const itemSchema = {};
  for (const itemType of Object.keys(itemTypes)){
    itemSchema[itemType] = makeBool(false);
  }

  return new fields.SchemaField(itemSchema);
}

function makeDefensesFields(name, essence) {
  return new fields.SchemaField({
    armor: makeInt(0),
    base: makeInt(10),
    bonus: makeInt(0),
    essence: makeStr(essence),
    morphed: makeInt(0),
    name: makeStr(name),
    shield: makeInt(0),
    string: makeStr(''),
    total: makeInt(0),
  });
}

function makeSkillRankAllocation() {
  return new fields.SchemaField({
    value: makeInt(0),
    string: makeStr(''),
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
  canHaveZord: makeBool(false),
  canMorph: makeBool(false),
  canQualify: makeBool(false),
  canSpellcast: makeBool(false),
  canTransform: makeBool(false),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields('toughness', 'strength'),
    evasion: makeDefensesFields('evasion', 'speed'),
    willpower: makeDefensesFields('willpower', 'smarts'),
    cleverness: makeDefensesFields('cleverness', 'social'),
  }),
  environments: makeStrArrayWithChoices(E20.Environments, null),
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
  faction: makeStr(''),
  focusEssence: makeStr(''),
  image: new fields.SchemaField({
    botmode: makeStr(null),
    morphed: makeStr(null),
    unmorphed: makeStr(null),
  }),
  isMorphed: makeBool(false),
  isTransformed: makeBool(false),
  level: makeInt(1),
  notes: new fields.HTMLField(),
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
  poisonTraining:makeInt(0),
  previousRole: new fields.ArrayField(
    new fields.SchemaField({
      endingLevel: makeInt(0),
      uuid: makeStr(null),
      startingLevel: makeInt(0),
    })
  ),
  qualified: new fields.SchemaField({
    armors: makeTrainingSchema(E20.armorTypes),
    poisons: makeTrainingSchema(E20.poisonTraining),
    weapons: makeTrainingSchema(E20.weaponTypes),
  }),
  senses: new fields.SchemaField({
    hearing: new fields.ObjectField({}),
    sight: new fields.ObjectField({}),
    smell: new fields.ObjectField({}),
    taste: new fields.ObjectField({}),
    touch: new fields.ObjectField({}),
  }),
  skillRankAllocation: new fields.SchemaField({
    strength: makeSkillRankAllocation(),
    speed: makeSkillRankAllocation(),
    smarts: makeSkillRankAllocation(),
    social: makeSkillRankAllocation(),
  }),
  trained: new fields.SchemaField({
    armors: makeTrainingSchema(E20.armorTypes),
    poisons: makeTrainingSchema(E20.poisonTraining),
    toxins: makeTrainingSchema(E20.poisonTraining),
    upgrades: new fields.SchemaField({
      armors: makeTrainingSchema(E20.availabilities),
    }),
    weapons: makeTrainingSchema(E20.weaponTypes),
  }),
});

export function migrateCharacterData(source) {
  if (source.essences) {
    for (const [essence, value] of Object.entries(source.essences)) {
      if (typeof value == 'number') { // Standard Essence damage migration
        source.essences[essence] = { max: value, value: value };
      } else if (value?.max?.max) { // Possible edge case
        source.essences[essence].max = value.max.max;
        source.essences[essence].value = value.max.max;
      } else if (value?.required) { // Previous migration may have set it to a SchemaField()
        source.essences[essence].max = value.max || 0;
        source.essences[essence].value = value.max || 0;
      }
    }
  }
}
