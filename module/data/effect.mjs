import { rerollSchema } from "./reroll-schema.mjs";

export class RerollEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...rerollSchema(),
    };
  }
}

export const config = {
  default: RerollEffectData,
};
