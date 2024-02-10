import { E20 } from "../../helpers/config.mjs";
import { makeZeroedInt } from "../generic-makers.mjs";

export function makeEssenceShift() {
  return new fields.SchemaField({
    shiftUp: makeZeroedInt(),
    shiftDown: makeZeroedInt(),
  });
}

export function makeMovementFields() {
  return new fields.SchemaField({
    altMode: makeZeroedInt(),
    base: makeZeroedInt(),
    bonus: makeZeroedInt(),
    morphed: makeZeroedInt(),
    total: makeZeroedInt(),
  });
}

export function makeSkillFields() {
  return new fields.SchemaField({
    essences: new fields.SchemaField({
      smarts: new fields.BooleanField({initial: false}),
      social: new fields.BooleanField({initial: false}),
      speed: new fields.BooleanField({initial: false}),
      strength: new fields.BooleanField({initial: false}),
    }),
    edge: new fields.BooleanField({initial: false}),
    isSpecialized: new fields.BooleanField({initial: false}),
    modifier: makeZeroedInt(),
    shift: new fields.StringField({initial: 'd20'}),
    shiftDown: makeZeroedInt(),
    shiftUp: makeZeroedInt(),
    snag: new fields.BooleanField({initial: false}),
  });
}

class CommonActorData extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      altModeName: new fields.StringField({initial: ''}),
      altModeSize: new fields.StringField({
        initial: E20.actorSizes.common,
        choices: Object.values(E20.actorSizes),
      }),
      canMorph: new fields.BooleanField({initial: false}),
      canSpellcast: new fields.BooleanField({initial: false}),
      canTransform: new fields.BooleanField({initial: false}),
      color: new fields.StringField({initial: '#b5b1b1'}),
      conditioning: makeZeroedInt(),
      description: new fields.StringField({initial: ''}), // Idt we need this
      energon: new fields.SchemaField({
        dark: new fields.SchemaField({
          value: makeZeroedInt(),
        }),
        normal: new fields.SchemaField({
          max: makeZeroedInt(),
          value: makeZeroedInt(),
        }),
        primal: makeZeroedInt(),
        red: makeZeroedInt(),
        synthEn: makeZeroedInt(),
        essenceRanks: new fields.SchemaField({
          smarts: makeZeroedInt(),
          social: makeZeroedInt(),
          speed: makeZeroedInt(),
          strength: makeZeroedInt(),
        }),
        essenceShifts: new fields.SchemaField({
          any: makeEssenceShift(),
          smarts: makeEssenceShift(),
          social: makeEssenceShift(),
          speed: makeEssenceShift(),
          strength: makeEssenceShift(),
        }),
      }),
      focusEssence: new fields.StringField({initial: ''}),
      health: new fields.SchemaField({
        bonus: makeZeroedInt(),
        max: makeZeroedInt(),
        origin: makeZeroedInt(),
        value: makeZeroedInt(),
      }),
      initiative: new fields.SchemaField({
        edge: new fields.BooleanField({initial: false}),
        formula: new fields.StringField({initial: '2d20kl + 0'}),
        modifier: makeZeroedInt(),
        snag: new fields.BooleanField({initial: false}),
        shift: new fields.StringField({initial: 'd20'}),
        shiftDown: makeZeroedInt(),
        shiftUp: makeZeroedInt(),
      }),
      isLocked: new fields.BooleanField({initial: false}),
      isMorphed: new fields.BooleanField({initial: false}),
      isTransformed: new fields.BooleanField({initial: false}),
      movement: new fields.SchemaField({
        aerial: makeMovementFields(),
        climb: makeMovementFields(),
        ground: makeMovementFields(),
        swim: makeMovementFields(),
      }),
      powers: new fields.SchemaField({
        personal: new fields.SchemaField({
          max: makeZeroedInt(),
          value: makeZeroedInt(),
        }),
        sorcerous: new fields.SchemaField({
          levelTaken: makeZeroedInt(),
          max: makeZeroedInt(),
          value: makeZeroedInt(),
        }),
      }),
      size: new fields.StringField({
        initial: E20.actorSizes.common,
        choices: Object.values(E20.actorSizes),
      }),
      skills: new fields.SchemaField({
        acrobatics: makeSkillFields(),
        alertness: makeSkillFields(),
        animalHandling: makeSkillFields(),
        athletics: makeSkillFields(),
        brawn: makeSkillFields(),
        culture: makeSkillFields(),
        deception: makeSkillFields(),
        driving: makeSkillFields(),
        finesse: makeSkillFields(),
        infiltration: makeSkillFields(),
        intimidation: makeSkillFields(),
        might: makeSkillFields(),
        performance: makeSkillFields(),
        persuasion: makeSkillFields(),
        science: makeSkillFields(),
        spellcasting: makeSkillFields(),
        streetwise: makeSkillFields(),
        survival: makeSkillFields(),
        targeting: makeSkillFields(),
        technology: makeSkillFields(),
      }),
      stun: new fields.SchemaField({
        max: makeZeroedInt(),
        min: makeZeroedInt(),
        value: makeZeroedInt(),
      }),
    };
  }
}
