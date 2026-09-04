import { rerollSchema } from "./reroll-schema.mjs";

export class RerollEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...rerollSchema(),
    };
  }
}

// Keyed "base" (not "default") - this system declares no custom ActiveEffect subtypes in
// system.json's documentTypes, so every effect's own document.type is the built-in "base"
// Foundry falls back to for a document class with no declared subtypes. CONFIG.ActiveEffect
// .dataModels is looked up by that literal type string (TypeDataField#getModelForType does
// `dataModels[type]` with no "default" fallback of its own) - keying this "default" instead
// meant the lookup always missed, silently leaving every effect's system data as a plain
// object with no schema at all, which only broke once something read that schema back (e.g.
// ActiveEffectConfig's own edit sheet, built from system.schema.fields).
export const config = {
  base: RerollEffectData,
};
