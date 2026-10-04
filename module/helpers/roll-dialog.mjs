import { pr2NoUntrainedSnag } from "./extensions/pr2/team.mjs";
import { zord2NoUntrainedSnag } from "./extensions/zord2/snag.mjs";
import { skillKitNoUntrainedSnag } from "./kits.mjs";
import { ruleNoUntrainedSnag } from "../rules/adapter.mjs";
import { E20 } from "./config.mjs";
import {
  actorHasPerk, getUsesThisEncounter, getUsesThisScene, markUsedThisEncounterCount, markUsedThisScene,
} from "./perks.mjs";
import RollOptionsDialog from "../apps/roll-options-dialog.mjs";

// Leadfoot (Quartermaster's Guide to Gear, Influence Perk, p.10): "you gain Edge on Driving Skill
// Tests when you use a vehicle's full Movement [dropped, unenforceable - already a plain
// compendium Active Effect for the unconditional Driving Edge half], and you do not suffer Snag
// on Alertness Skill Tests as a driver." The Hang-Up's own inverse Snag ("when not driving a
// vehicle") lives in dice.mjs instead (a genuine Snag grant, not an untrained-roll suppression).
const LEADFOOT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.zdXJzzqekwPAnCtT";

// Green (Transformers CRB, General Perk, p.109 / GI Joe CRB, General Perk, p.131 - same name,
// same "Level 4 or lower" prerequisite, near-identical text, reprinted in both books, but NOT
// verbatim - the two printings disagree on the actual cap window). Transformers CRB: "Three times
// per day, you do not suffer a Snag when you make an unskilled roll" - "per day" approximated as
// "per encounter, unconstrained outside combat," the same already-accepted "no real cap outside
// combat" simplification this project applies elsewhere (see Worth A Shot's own doc comment in
// dice.mjs). GI Joe CRB: "Three times per mission... you do not suffer a Snag" - a strictly wider
// window than a single encounter, so it shares helpers/perks.mjs's own "scene" counter instead
// (the widest window this Scene Clock tracks, the closest available match to "per mission" - see
// getUsesThisScene's own doc comment), corrected from an earlier version of this file that wrongly
// folded both printings into one shared per-encounter counter.
const GREEN_TF_ID = "Compendium.essence20.tf_crb.Item.7t0TYx5BMrEHg1BE";
const GREEN_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.oelHthPlqIq4eDpp";
const GREEN_USES_FLAG = 'greenUsesThisEncounter';
const GREEN_GIJ_USES_FLAG = 'greenUsesThisScene';

/**
 * Splits every automatic combat modifier that fired this roll (see
 * dice.mjs#_getAutomaticCombatModifiers's own addSource doc comment) into the shiftUp/shiftDown-
 * granting ones - each gets its own individually-toggleable switch in the dialog (see
 * roll-dialog.hbs) - and the edge/snag-granting ones, which are informational only: their names
 * just annotate the existing Snag/Normal/Edge radio's own labels rather than getting a second,
 * redundant toggle of their own (that radio is already the one interactive control for edge/snag).
 * A small standalone function (rather than inlined into getSkillRollOptions) specifically so it
 * can be unit tested directly - getSkillRollOptions itself opens a real ApplicationV2 dialog and
 * has no test coverage of its own for that reason, the same split this project already draws for
 * sheet-handler UI wiring generally.
 * @param {Array<{id, label, shiftUp, shiftDown, edge, snag}>} [combatModifierSources]
 * @returns {{shiftModifierSources: Array, edgeSourcesText: String, snagSourcesText: String}}
 */
export function buildCombatModifierSourceFields(combatModifierSources) {
  const sources = combatModifierSources || [];
  return {
    shiftModifierSources: sources.filter(source => source.shiftUp || source.shiftDown),
    edgeSourcesText: sources.filter(source => source.edge).map(source => source.label).join(', '),
    snagSourcesText: sources.filter(source => source.snag).map(source => source.label).join(', '),
  };
}

export class RollDialog {
  /**
   * RollDialog constructor.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(i18n=null) {
    this._i18n = i18n;
  }

  /**
   * Localizes the given text.
   * @param {String} text   The text to localize.
   * @param {Object} fmtVars   Optional formatting variables.
   * @returns {String}   The localized text.
   * @private
   */
  _localize(text, fmtVars=null) {
    if (fmtVars) {
      return this._i18n ? this._i18n.format(text, fmtVars) : game.i18n.format(text, fmtVars);
    } else {
      return this._i18n ? this._i18n.localize(text) : game.i18n.localize(text);
    }
  }

  /**
   * Whether an untrained (still-d20-shift) Skill Test rolls with an automatic Snag - the base
   * rule, unless something lifts it: an item rule with immune: ["untrainedSnag"] (Presence, I'll
   * Make It Work, the Vehicle Qualifications...), a kit, or one of the checks below. `skill` is
   * optional so every existing 2-arg call site/test keeps working unchanged - the Skill-scoped
   * checks simply never fire without it.
   * @param {Object} skillDataset   { shift, edge, snag } for the skill being rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} [skill]   dataset.skill - which Skill is being rolled.
   * @returns {Boolean}
   * @private
   */
  async _isUntrainedSnag(skillDataset, actor, skill=null) {
    const isUntrainedShift = E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(skillDataset.shift);
    if (!isUntrainedShift) {
      return false;
    }

    // Shinobi of the 63rd Hexagram / Steady Hands - helpers/extensions/zord2/snag.mjs.
    if (zord2NoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Instructor's taught Skill - helpers/extensions/pr2/team.mjs.
    if (pr2NoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Basic / Advanced Skill Kit (Quartermaster's Guide p.41) - helpers/kits.mjs.
    if (skillKitNoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Item rules with immune: ["untrainedSnag"] (rules/adapter.mjs).
    if (ruleNoUntrainedSnag(actor, skill)) {
      return false;
    }

    // Zord, Phantom Ship and Quantasaurus Rex (driving a Zord) are item rules now - see just above.

    // Leadfoot (Quartermaster's Guide to Gear, Influence Perk, p.10) - see LEADFOOT_ID's own
    // comment above. "As a driver" reuses the same _getPilotedVehicle('driver') check Wheel
    // Struggle's own inverse case already establishes, scoped to Alertness only.
    if (skill == 'alertness' && actorHasPerk(actor, LEADFOOT_ID) && actor._dice?._getPilotedVehicle(actor, 'driver')) {
      return false;
    }

    // Green (Transformers CRB) - see GREEN_TF_ID's own comment above.
    if (actorHasPerk(actor, GREEN_TF_ID)) {
      if (!game.combat) {
        return false;
      }

      // Green's three-uses-per-encounter counter used to be hand-rolled here against
      // game.combat.id, a duplicate of helpers/perks.mjs's own getUsesThisEncounter that carried
      // the same out-of-combat bug: with no combat, the stored stamp never matched, so the count
      // reset on every roll and the cap never applied. It now shares the Scene Clock with every
      // other once-per-encounter ability.
      if (getUsesThisEncounter(actor, GREEN_USES_FLAG) < 3) {
        await markUsedThisEncounterCount(actor, GREEN_USES_FLAG);
        return false;
      }
    }

    // Green (GI Joe CRB) - see GREEN_GIJ_ID's own comment above. "Per mission" - a strictly wider
    // window than the Transformers printing's own per-encounter cap just above, so this uses the
    // scene counter instead, and (unlike the encounter-scoped check above) isn't gated on an
    // active combat - a mission-scoped ability is just as usable outside combat as during it.
    if (actorHasPerk(actor, GREEN_GIJ_ID) && getUsesThisScene(actor, GREEN_GIJ_USES_FLAG) < 3) {
      await markUsedThisScene(actor, GREEN_GIJ_USES_FLAG);
      return false;
    }

    return true;
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Promise<Object>}   The processed roll options, or { cancelled: true }.
   */
  async getSkillRollOptions(dataset, skillDataset, actor) {
    const snag = skillDataset.snag || await this._isUntrainedSnag(skillDataset, actor, dataset.skill);
    const edge = skillDataset.edge;
    const { shiftModifierSources, edgeSourcesText, snagSourcesText } =
      buildCombatModifierSourceFields(dataset.combatModifierSources);
    const context = {
      canCritD2: dataset.canCritD2,
      shiftUp: dataset.shiftUp || 0,
      shiftDown: dataset.shiftDown || 0,
      isSpecialized: dataset.isSpecialized,
      snag: snag && !edge,
      edge: edge && !snag,
      normal: edge == snag,
      shiftModifierSources,
      edgeSourcesText,
      snagSourcesText,
      rolePoints: dataset.rolePoints,
      damageRolePoints: dataset.damageRolePoints,
      aimBonus: dataset.aimBonus,
      aimedByAction: dataset.aimedByAction,
      energonAvailable: dataset.energonAvailable,
      storyPointSpecializedAvailable: dataset.storyPointSpecializedAvailable,
      penetratingShotAvailable: dataset.penetratingShotAvailable,
      hobbleAvailable: dataset.hobbleAvailable,
      cripplingBlowAvailable: dataset.cripplingBlowAvailable,
      guardianStrikesAvailable: dataset.guardianStrikesAvailable,
      stickInTheSpokesAvailable: dataset.stickInTheSpokesAvailable,
      interdictionAvailable: dataset.interdictionAvailable,
      penetratingAimAvailable: dataset.penetratingAimAvailable,
      savantSkillAvailable: dataset.savantSkillAvailable,
      metallikatoIgnoreArmorAvailable: dataset.metallikatoIgnoreArmorAvailable,
      analyzeTargetAvailable: dataset.analyzeTargetAvailable,
      surgingAvailable: dataset.surgingAvailable,
      psychoanalystAvailable: dataset.psychoanalystAvailable,
      coaxSurrenderAvailable: dataset.coaxSurrenderAvailable,
      bumpAndRunAvailable: dataset.bumpAndRunAvailable,
      jackOfAllTradesAvailable: dataset.jackOfAllTradesAvailable,
      demolitionDriverAvailable: dataset.demolitionDriverAvailable,
      programmableAvailable: dataset.programmableAvailable,
      sizeMattersAvailable: dataset.sizeMattersAvailable,
      menacingGlareAvailable: dataset.menacingGlareAvailable,
      instillWeaknessAvailable: dataset.instillWeaknessAvailable,
      deconstructionistAvailable: dataset.deconstructionistAvailable,
      cunningPlanAvailable: dataset.cunningPlanAvailable,
      worthAShotAvailable: dataset.worthAShotAvailable,
      pressureCookerAvailable: dataset.pressureCookerAvailable,
      enviroSealedAdverseSituationAvailable: dataset.enviroSealedAdverseSituationAvailable,
      enviroSealedAdverseSituationChecked: dataset.enviroSealedAdverseSituationChecked,
      pythonizedAvailable: dataset.pythonizedAvailable,
      doubleAgentAvailable: dataset.doubleAgentAvailable,
      dirtyBlowsAvailable: dataset.dirtyBlowsAvailable,
      grinderAvailable: dataset.grinderAvailable,
      getAGripAvailable: dataset.getAGripAvailable,
      noFactorAvailable: dataset.noFactorAvailable,
      cautionToTheWindAvailable: dataset.cautionToTheWindAvailable,
      ricochetAvailable: dataset.ricochetAvailable,
      fastDrawAvailable: dataset.fastDrawAvailable,
      inventorAvailable: dataset.inventorAvailable,
      ambitiousAvailable: dataset.ambitiousAvailable,
      belovedAvailable: dataset.belovedAvailable,
      straightShooterAvailable: dataset.straightShooterAvailable,
      kindButFirmAvailable: dataset.kindButFirmAvailable,
      saberToothedAvailable: dataset.saberToothedAvailable,
      deceptiveWarfareAvailable: dataset.deceptiveWarfareAvailable,
      pseudoScienceAvailable: dataset.pseudoScienceAvailable,
      quantumCutAvailable: dataset.quantumCutAvailable,
      soloShotAvailable: dataset.soloShotAvailable,
      spellcializeAvailable: dataset.spellcializeAvailable,
      observerSnagSubstitutionAvailable: dataset.observerSnagSubstitutionAvailable,
      combatStanceAvailable: dataset.combatStanceAvailable,
      retributionAvailable: dataset.retributionAvailable,
      witheringFireAvailable: dataset.witheringFireAvailable,
      akimboAvailable: dataset.akimboAvailable,
      alphaStrikeAvailable: dataset.alphaStrikeAvailable,
      emptyTheMagAvailable: dataset.emptyTheMagAvailable,
      drivingStrikeAvailable: dataset.drivingStrikeAvailable,
      dependableAvailable: dataset.dependableAvailable,
      dependableBothAvailable: dataset.dependableBothAvailable,
      oldReliableAvailable: dataset.oldReliableAvailable,
      oldReliableBothAvailable: dataset.oldReliableBothAvailable,
      legendaryDependabilityAvailable: dataset.legendaryDependabilityAvailable,
      disarmingShotAvailable: dataset.disarmingShotAvailable,
      targetVesselSystemAvailable: dataset.targetVesselSystemAvailable,
      wildAnimalKit: dataset.wildAnimalKit,
      // Intimidating (GI Joe CRB/TF CRB p.148 etc) - see dice.mjs's own
      // updatedShiftDataset.intimidatingAvailable comment. Localized here (rather than in the
      // template, which has no `config` in its own context) since the substitute skill is
      // dynamic - unlike every fixed-skill substitution above, this one names whichever skill the
      // player's own equipped Intimidating weapon happens to use.
      intimidatingWeaponSkillLabel: dataset.intimidatingWeaponSkill
        ? game.i18n.localize(E20.skills[dataset.intimidatingWeaponSkill])
        : null,
      angryAvailable: dataset.angryAvailable,
      // Retrogen / Fanning weapon traits - see dice.mjs's own updatedShiftDataset.retrogenAvailable
      // and fanningMaxShots comments.
      retrogenAvailable: dataset.retrogenAvailable,
      fanningMaxShots: dataset.fanningMaxShots || 0,
      // All Out Attack / Evasive Fighting / Pinpoint / Make an Opening - helpers/target-riders.mjs.
      allOutAttackMax: dataset.allOutAttackMax || 0,
      evasiveFightingMax: dataset.evasiveFightingMax || 0,
      pinpointMax: dataset.pinpointMax || 0,
      makeAnOpeningAvailable: !!dataset.makeAnOpeningAvailable,
      steadyHandAvailable: !!dataset.steadyHandAvailable,
      // Kits - helpers/kits.mjs.
      kitRequiredAvailable: !!dataset.kitRequiredAvailable,
      // Synaptic Linkage / About Twenty-Percent Cooler - helpers/social-rolls.mjs.
      synapticEdgeAvailable: !!dataset.synapticEdgeAvailable,
      // Extension controls - helpers/extensions.mjs.
      extToggles: dataset.extToggles || [],
      twentyPercentCoolerAvailable: !!dataset.twentyPercentCoolerAvailable,
      hardpointMovement: dataset.hardpointMovement,
      defenseType: dataset.defenseType || 'none',
      defenseTypes: { none: 'E20.None', ...E20.defenses },
      availableSkillEffects: dataset.availableSkillEffects || [],
    };
    /* E20.originSkills is conditioning plus E20.skills, and two rollable things are deliberately
       absent from both: Wealth, which is a real `system.skills.wealth` field but which the sheets
       present separately as the Wealth Die (see helpers/effect-catalog.mjs's own note), and a
       Role's own skill die, which is named by the Role rather than by any enum. Both used to make
       this title read "<actor> <shift> undefined Skill Roll". */
    const skillLabel = E20.originSkills[dataset.skill]
      // preLocalize has already turned the tables above into real strings, so this has to be a
      // localized string too rather than the key.
      ?? (dataset.skill == 'wealth' ? this._localize('E20.Wealth') : null)
      ?? dataset.roleSkillName
      ?? '';

    const title = this._localize('E20.RollDialogTitle', {
      actor: actor.name, skill: skillLabel, shift: E20.skillShifts[skillDataset.shift],
    });

    return new Promise(resolve => {
      new RollOptionsDialog(context, title, resolve).render(true);
    });
  }
}
