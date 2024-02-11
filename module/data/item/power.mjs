import { item } from './item';
import { itemDescription } from './item-description';
import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

class PowerItemData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...item(),
      ...itemDescription(),
      actionType: makeStrWithChoices('free', E20.actionTypes),
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
      type: makeStrWithChoices('grid', E20.powerTypes),
      usesInterval: makeStrWithChoices('perScene', E20.usesInterval),
      usesPer: makeInt(null),
    };
  }
}
