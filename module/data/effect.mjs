import { E20 } from "../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../generic-makers.mjs";

const fields = foundry.data.fields;

export class RerollEffectData extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      reroll: new fields.SchemaField({
        enabled: makeBool(false),
        maxUses: makeInt(1),
        mode: makeStrWithChoices(Object.keys(E20.rerollModes), 'all'),
        reset: makeStrWithChoices(Object.keys(E20.rerollResets), 'none'),
        target: makeStrWithChoices(Object.keys(E20.rerollTargets), 'allDice'),
        values: new fields.ArrayField(new fields.NumberField()),
      }),
    };
  }
}

export const config = {
  default: RerollEffectData,
};
