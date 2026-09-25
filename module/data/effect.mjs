import { isSuppressedWhileUnmorphed } from "../helpers/morph-gated-effects.mjs";
import { isSuppressedOutOfEnvironment } from "../helpers/environment-gated-effects.mjs";
import { makeBool } from "./generic-makers.mjs";
import { rerollSchema } from "./reroll-schema.mjs";

export class RerollEffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...rerollSchema(),
      // Applies only while the actor is Morphed - see helpers/morph-gated-effects.mjs.
      whileMorphed: makeBool(false),
      // Applies only while the actor has toggled themselves as in their own environment of
      // expertise - see helpers/environment-gated-effects.mjs.
      whileInEnvironmentOfExpertise: makeBool(false),
    };
  }

  // Read by ActiveEffect#isSuppressed (Foundry v14) - see helpers/morph-gated-effects.mjs and
  // helpers/environment-gated-effects.mjs. Either gate can suppress independently; neither
  // overrides the other when both are unset (both return undefined, falling through to Foundry's
  // own default duration-expiry check).
  get isSuppressed() {
    return isSuppressedWhileUnmorphed(this) || isSuppressedOutOfEnvironment(this);
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
