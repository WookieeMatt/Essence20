import { item } from './item';
import { E20 } from "../../../helpers/config.mjs";
import { parentItem } from './parentItem';
import { makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class UpgradeItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      ...parentItem(),
      classFeatureId: new fields.StringField({initial: null}),
      alternateEffects: new fields.StringField({initial: ''}),
      availability: makeStrWithChoices('standard', E20.availabilities),
      classification: makeStrWithChoices('integrated', E20.weaponSizes),
      equipped: new fields.BooleanField({initial: true}),
      requirements: new fields.SchemaField({
        custom: new fields.StringField({initial: null}),
        skill: makeStrWithChoices(null, E20.skills),
        shift: makeStrWithChoices(null, E20.skillRollableShifts),
      }),
      traits: new fields.ArrayField(new fields.StringField()),
      upgradeTraits: new fields.ArrayField(new fields.StringField()),
      usesPerScene: new fields.NumberField({
        initial: null,
        integer: true,
      }),
    };
  }
}
