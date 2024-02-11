import { item } from './item';
import { itemDescription } from './item-description';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class PowerItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      actionType: new fields.StringField({
        choices: Object.values(E20.actionTypes),
        initial: 'free',
      }),
      canActivate: new fields.BooleanField({initial: false}),
      classFeatureId: new fields.StringField({initial: null}),
      hasVariableCost: new fields.BooleanField({initial: false}),
      maxPowerCost: new fields.NumberField({
        initial: null,
        integer: true,
      }),
      powerCost: new fields.NumberField({
        initial: null,
        integer: true,
      }),
      selectionLimit: makeInt(1),
      type: new fields.StringField({
        choices: Object.values(E20.powerTypes),
        initial: 'grid',
      }),
      usesInterval: new fields.StringField({
        choices: Object.values(E20.usesInterval),
        initial: 'perScene',
      }),
      usesPer: new fields.NumberField({
        initial: null,
        integer: true,
      }),
    };
  }
}
