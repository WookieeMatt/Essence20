import { E20 } from "../../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

import { makeDefensesFields, makeEssencesFields } from "./machine.mjs";

import { makeMovementFields, makeSkillFields } from "./common.mjs";

const fields = foundry.data.fields;

export const zordBase = () => ({
  armor: makeInt(1),
  conditioning: makeInt(3),
  defenses: new fields.SchemaField({
    // 10 is the universal Defense base every other actor type uses (character.mjs, machine.mjs) -
    // _prepareDefenses then adds the Essence and armor on top. These previously stored the
    // baseline Zord stat block's own PRINTED totals (PR CRB p.134: "TOUGHNESS 17 (1 Plating
    // Armor) | EVASION 14") as the base, which double-counted the Essence that those printed
    // numbers already include: a new Zord came out at Toughness 17+6=23 and Evasion 14+4=18.
    // Decomposed properly, RAW's own numbers fall straight out of the standard formula -
    // Toughness 10 + Strength 6 + 1 Plating Armor = 17, Evasion 10 + Speed 4 = 14.
    toughness: makeDefensesFields('toughness', 'strength', false, 10, 1),
    evasion: makeDefensesFields('evasion', 'speed', false, 10),
    willpower: makeDefensesFields('willpower', 'smarts', true, null),
    cleverness: makeDefensesFields('cleverness', 'social', true, null),
  }),
  essences: new fields.SchemaField({
    strength: makeEssencesFields(false, 6),
    speed: makeEssencesFields(false, 4),
    smarts: makeEssencesFields(true, null),
    social: makeEssencesFields(true, null),
  }),
  health: new fields.SchemaField({
    bonus: makeInt(0),
    max: makeInt(6),
    // _prepareHealth computes max as origin + Role Points + Conditioning + bonus for every actor
    // type, reading this flat field as the non-PC stand-in for a PC's Origin Item. Left at 0, a
    // Zord's max came out as just its Conditioning (3) while its value stayed at the schema's 6,
    // so a new Zord displayed "6 / 3". 3 here restores RAW's printed Health 6 (3 chassis + the
    // baseline Zord's own Conditioning +3) and keeps health.bonus live for the Feature items that
    // write to it (Heavy Chassis, Auxiliary Zord, Carrier, Titan Body).
    origin: makeInt(3),
    value: makeInt(6),
  }),
  movement: new fields.SchemaField({
    aerial: makeMovementFields(0),
    burrow: makeMovementFields(0),
    climb: makeMovementFields(0),
    ground: makeMovementFields(40),
    swim: makeMovementFields(0),
  }),
  size: makeStrWithChoices(Object.keys(E20.actorSizes), 'huge'),
  skills: new fields.SchemaField({
    acrobatics: makeSkillFields('speed', false),
    alertness: makeSkillFields('smarts', false),
    animalHandling: makeSkillFields('social', false),
    athletics: makeSkillFields('strength', false),
    brawn: makeSkillFields('strength', false),
    culture: makeSkillFields('smarts', false),
    deception: makeSkillFields('social', false),
    // Driving/Might/Targeting carry the baseline Zord stat block's own printed skill values (PR
    // CRB p.134: "Driving (Autopilot) +d2, Might +d6, Targeting +d6"), so they start already
    // chosen - a brand-new Zord should show the skills it actually ships with rather than an
    // empty "no skills chosen yet" list the GM has to re-pick by hand. Every other skill stays
    // unchosen at its d20 default.
    driving: makeSkillFields('speed', false, 'd2', true),
    finesse: makeSkillFields('speed', false),
    infiltration: makeSkillFields('speed', false),
    initiative: makeSkillFields('speed', true),
    intimidation: makeSkillFields('strength', false),
    might: makeSkillFields('strength', false, 'd6', true),
    performance: makeSkillFields('social', false),
    persuasion: makeSkillFields('social', false),
    science: makeSkillFields('smarts', false),
    spellcasting: makeSkillFields('any', false),
    streetwise: makeSkillFields('social', false),
    survival: makeSkillFields('smarts', false),
    targeting: makeSkillFields('speed', false, 'd6', true),
    technology: makeSkillFields('smarts', false),
  }),
});
