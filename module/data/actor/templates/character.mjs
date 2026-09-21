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

/**
 * Returns a plain field-definition object (not wrapped in a SchemaField) for one Defense entry,
 * so callers outside this file can extend it with their own additional fields before wrapping it
 * themselves - see templates/machine.mjs's own makeMachineDefensesFields, which adds a
 * `usesDrivers` field on top of this same shape for Vehicle/Zord Willpower/Cleverness.
 */
export function makeDefensesFields(name, essence) {
  return {
    armor: makeInt(0),
    base: makeInt(10),
    bonus: makeInt(0),
    essence: makeStr(essence),
    morphed: makeInt(0),
    name: makeStr(name),
    shield: makeInt(0),
    string: makeStr(''),
    total: makeInt(0),
  };
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
  biography: new fields.SchemaField({
    age: makeInt(0),
    bio: new fields.HTMLField(),
    description: new fields.HTMLField(),
    eyeColor: makeStr(''),
    gender: makeStr(''),
    hairColor: makeStr(''),
    height: makeStr(''),
    languages: new fields.HTMLField(),
    pronoun: makeStr(''),
    skinColor: makeStr(''),
    weight: makeStr(''),
  }),
  canHaveZord: makeBool(false),
  canMorph: makeBool(false),
  canQualify: makeBool(false),
  canShowWealthDie: makeBool(false),
  canSpellcast: makeBool(false),
  canTransform: makeBool(false),
  canUseWeird: makeBool(false),
  defenses: new fields.SchemaField({
    toughness: new fields.SchemaField(makeDefensesFields('toughness', 'strength')),
    evasion: new fields.SchemaField(makeDefensesFields('evasion', 'speed')),
    willpower: new fields.SchemaField(makeDefensesFields('willpower', 'smarts')),
    cleverness: new fields.SchemaField(makeDefensesFields('cleverness', 'social')),
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
  // Transformer Hardpoints (TF CRB p.114). Only meaningful on canTransform actors. `base` is
  // the "start play with 2 + 2" default; `bonus` is where Role/Perk/Origin grants add slots.
  // `max` / `used` / `over` are derived each prep by Essence20Actor._prepareLoadout() (kept as
  // schema fields so they survive Actor#toObject(false) into the sheet context).
  hardpoints: new fields.SchemaField({
    external: new fields.SchemaField({
      base: makeInt(2),
      bonus: makeInt(0),
      max: makeInt(0),
      used: makeInt(0),
      over: makeBool(false),
    }),
    integrated: new fields.SchemaField({
      base: makeInt(2),
      bonus: makeInt(0),
      max: makeInt(0),
      used: makeInt(0),
      over: makeBool(false),
    }),
  }),
  image: new fields.SchemaField({
    botmode: makeStr(null),
    morphed: makeStr(null),
    unmorphed: makeStr(null),
  }),
  isMorphed: makeBool(false),
  isTransformed: makeBool(false),
  level: makeInt(1),
  // Load Out limit (GI Joe CRB p.138 / TF CRB p.116 / PR CRB p.103): "six hands of weapons".
  // handsMax defaults to CONFIG.E20.LOADOUT_BASE_HANDS and can be raised for Perks like Pack
  // Mule. `handsUsed` / `handsOver` are derived each prep by Essence20Actor._prepareLoadout()
  // (kept as schema fields so they survive Actor#toObject(false) into the sheet context).
  loadout: new fields.SchemaField({
    handsMax: makeInt(6),
    handsUsed: makeInt(0),
    handsOver: makeBool(false),
  }),
  oldHandTransitionLevel: makeInt(null),
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
  poisonTraining:makeInt(0),
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
  // Legacy flat Hardpoint counts (PlayerCharacterActorData.externalHardpoints /
  // internalHarpoints) -> the structured system.hardpoints schema. Note the original
  // "internalHarpoints" typo and that "internal" is now "integrated" (matching TF CRB p.114).
  if (source.externalHardpoints != null || source.internalHarpoints != null) {
    source.hardpoints ??= {};
    if (source.externalHardpoints != null) {
      source.hardpoints.external = { ...(source.hardpoints.external ?? {}), base: source.externalHardpoints };
    }

    if (source.internalHarpoints != null) {
      source.hardpoints.integrated = { ...(source.hardpoints.integrated ?? {}), base: source.internalHarpoints };
    }
  }

  if (source.essences) {
    for (const [essence, value] of Object.entries(source.essences)) {
      if (typeof value == 'number') { // Standard Essence damage migration
        source.essences[essence] = { max: value, value: value };
      } else if (value?.max?.max) { // Possible edge case
        const migratedMax = value.max.max;
        source.essences[essence].max = migratedMax;
        source.essences[essence].value = migratedMax;
      } else if (value?.required) { // Previous migration may have set it to a SchemaField()
        source.essences[essence].max = value.max || 0;
        source.essences[essence].value = value.max || 0;
      }
    }
  }
}
