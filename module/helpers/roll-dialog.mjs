import { E20 } from "./config.mjs";
import {
  actorHasPerk, findPerk, getUsesThisEncounter, getUsesThisScene, markUsedThisEncounterCount, markUsedThisScene,
} from "./perks.mjs";
import RollOptionsDialog from "../apps/roll-options-dialog.mjs";

// Presence (GI Joe CRB p.76, Commando's Spy Focus, 1st level): "You do not suffer a Snag for
// rolling Skill Tests on Skills you have not spent Skill points on" - negates the base rule
// below (an untrained, still-d20-shift skill always rolling with a Snag).
const PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.EdP0LqcYh2tkMygI";

// I'll Make It Work (A Jump Through Time, Orange Ranger, 7th level, p.34): "no longer suffers
// Snag for being Unskilled in any Skill Test" - textually identical grant to Presence above, just
// from a different Role - a small array rather than a second hardcoded ID, so a future third
// same-effect Perk doesn't need its own bespoke check either.
const I_LL_MAKE_IT_WORK_ID = "Compendium.essence20.jump_through_time.Item.nxgmUTaPwFcg94ia";
const UNTRAINED_SNAG_IMMUNITY_PERKS = [PRESENCE_ID, I_LL_MAKE_IT_WORK_ID];

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

// Air/Land/Sea Vehicle Qualification (Factions in Action Vol. 2, Dreadnok General Perks, p.63):
// "You roll Driving Skill Tests to drive [type] vehicles without a Snag, even if you have no
// Ranks in the Driving Skill." Narrower than Presence/I'll Make It Work above (scoped to Driving,
// and only while actually piloting a vehicle of the matching movement type - E20.movementTypes'
// own aerial/ground/swim keys, "Sea" mapping to swim the same way Watertight Seals' own "Aquatic
// Movement" clause already does), so it's checked separately below rather than folded into that
// flat array. The "+1 shiftUp once you HAVE Ranks in Driving" half lives in dice.mjs instead (a
// normal shiftUp grant, unrelated to this untrained-Snag rule).
const AIR_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.GUcQm2RuUIEWzd4X";
const LAND_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.xLeoc9xLx06SpK7S";
const SEA_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.K0UKwjhJlYnGM7yt";

// Skyward (Quartermaster's Guide to Gear, Influence Perk, p.13) - see its own comment in dice.mjs
// next to this same constant's own copy there.
const SKYWARD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1IlTYXe8k5Aj63Mn";
// Nu, Pogodi! / Nothing Personal / The Promise of Riches - see dice.mjs's own comments on each of
// these constants for the RAW text; same movement-type-allowlist reuse, mirrored here since this
// table is duplicated across both files (see this table's own sibling comment above).
const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";
const NOTHING_PERSONAL_ID = "Compendium.essence20.intercontinental_adventures.Item.WsB4CydGzKF2g7Yi";
const THE_PROMISE_OF_RICHES_ID = "Compendium.essence20.intercontinental_adventures.Item.wW4xugDI7Sea2Btg";

// Good To Go (Factions in Action Vol. 2, Freedom Fighters Faction Perk, p.104) - see dice.mjs's
// own comment on this constant for the RAW text and the choice-scoped check shape, mirrored here.
const GOOD_TO_GO_ID = "Compendium.essence20.intercontinental_adventures.Item.Yt3muowN1aALcqOj";

// For The Syndicate (Factions in Action Vol. 2, International Syndicate Faction Perk, p.102) - see
// dice.mjs's own comment on this constant for the RAW text (byte-identical vehicle-qualification
// wording to Good To Go).
const FOR_THE_SYNDICATE_ID = "Compendium.essence20.intercontinental_adventures.Item.opygNwRWgeIyU1mE";
const CHOICE_SCOPED_VEHICLE_QUALIFICATION_IDS = [GOOD_TO_GO_ID, FOR_THE_SYNDICATE_ID];

const VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE = {
  aerial: [AIR_VEHICLE_QUALIFICATION_ID, SKYWARD_ID, NU_POGODI_ID, THE_PROMISE_OF_RICHES_ID],
  ground: [LAND_VEHICLE_QUALIFICATION_ID, NU_POGODI_ID, NOTHING_PERSONAL_ID, THE_PROMISE_OF_RICHES_ID],
  swim: [SEA_VEHICLE_QUALIFICATION_ID, THE_PROMISE_OF_RICHES_ID],
};

// Zord (PR CRB, Role Perk, p.35, granted at 3rd level): "When piloting your personal Zord, you
// cannot suffer Snags when using the Driving skill." Textually the same "roll Driving without a
// Snag even if untrained" grant as Air/Land/Sea Vehicle Qualification just above (same chapter,
// same wording family), so it's folded into this same untrained-Snag check rather than a second
// mechanism - gated on actually piloting a Zord (any Zord, since RAW's "personal Zord" is this
// system's normal one-Ranger-one-Zord relationship and there's no separate "is this MY Zord"
// ownership check anywhere else in this codebase to reuse) as this actor's own driver.
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";

// Quantasaurus Rex (A Jump Through Time, Quantum Ranger Role Perk, 4th level, p.46): "When
// actively piloting Quantasaurus Rex, you cannot suffer Snags on Animal Handling or Driving Skill
// Tests." Textually the Quantum Ranger's own equivalent of Zord's Driving-only grant just above -
// wider (also covers Animal Handling), so checked as its own clause rather than folded into
// ZORD_PERK_ID's.
const QUANTASAURUS_REX_ID = "Compendium.essence20.jump_through_time.Item.sn5jhTf8sJqRFhKS";

// Phantom Ship (Across the Stars, Phantom Ranger Role Perk, 1st level, p.62): "When piloting the
// Phantom Ship, you cannot suffer Snags when using the Driving Skill." Same canHaveZord grant as
// ZORD_PERK_ID (setPerkValues), and Driving-only like it - the Phantom Ship "still follows all the
// same rules... surrounding Zords," so it's read via the same pilotedVehicle?.type == 'zord' check
// just below rather than a separate branch.
const PHANTOM_SHIP_ID = "Compendium.essence20.across_the_stars.Item.OfsTu9GpONWPV88t";

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
   * rule, unless the roller has Presence (GI Joe CRB p.76), I'll Make It Work (A Jump Through
   * Time, Orange Ranger p.34) - see UNTRAINED_SNAG_IMMUNITY_PERKS above - or is rolling Driving
   * while piloting a vehicle of a type they hold the matching Air/Land/Sea Vehicle Qualification
   * for (see VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE above). `skill` is optional so every
   * existing 2-arg call site/test keeps working unchanged - the vehicle-Qualification check simply
   * never fires without it.
   * @param {Object} skillDataset   { shift, edge, snag } for the skill being rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} [skill]   dataset.skill - which Skill is being rolled.
   * @returns {Boolean}
   * @private
   */
  async _isUntrainedSnag(skillDataset, actor, skill=null) {
    const isUntrainedShift = E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(skillDataset.shift);
    if (!isUntrainedShift || UNTRAINED_SNAG_IMMUNITY_PERKS.some(perkId => actorHasPerk(actor, perkId))) {
      return false;
    }

    if (skill == 'driving') {
      const pilotedVehicle = actor._dice?._getPilotedVehicle(actor, 'driver');
      const hasMatchingQualification = pilotedVehicle && Object.entries(VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE)
        .some(([movementType, perkIds]) => pilotedVehicle.system.movement[movementType].base > 0
          && perkIds.some(perkId => actorHasPerk(actor, perkId)));
      // Good To Go / For The Syndicate - see their own comments above.
      const goodToGoPerk = pilotedVehicle
        ? CHOICE_SCOPED_VEHICLE_QUALIFICATION_IDS.map(id => findPerk(actor, id)).find(Boolean)
        : null;
      const hasGoodToGoQualification = !!goodToGoPerk
        && pilotedVehicle.system.movement[goodToGoPerk.system.choice]?.base > 0;
      if (hasMatchingQualification || hasGoodToGoQualification) {
        return false;
      }

      // Zord / Quantasaurus Rex / Phantom Ship - see their own comments above. Same "any Zord"
      // reading all three share (no per-Zord "is this specifically MY named Zord" marker exists
      // in this codebase).
      if (pilotedVehicle?.type == 'zord'
        && (actorHasPerk(actor, ZORD_PERK_ID) || actorHasPerk(actor, QUANTASAURUS_REX_ID)
          || actorHasPerk(actor, PHANTOM_SHIP_ID))) {
        return false;
      }
    }

    // Quantasaurus Rex - see QUANTASAURUS_REX_ID's own comment above. Its own Animal Handling half
    // (Driving is covered by the shared branch just above).
    if (skill == 'animalHandling' && actorHasPerk(actor, QUANTASAURUS_REX_ID)
      && actor._dice?._getPilotedVehicle(actor, 'driver')?.type == 'zord') {
      return false;
    }

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
      energonAvailable: dataset.energonAvailable,
      storyPointSpecializedAvailable: dataset.storyPointSpecializedAvailable,
      strikeBonusAvailable: dataset.strikeBonusAvailable,
      heavyForceAvailable: dataset.heavyForceAvailable,
      ideaPointAvailable: dataset.ideaPointAvailable,
      precisionAimAvailable: dataset.precisionAimAvailable,
      kocSneakAttackAvailable: dataset.kocSneakAttackAvailable,
      wowTheAudienceAvailable: dataset.wowTheAudienceAvailable,
      allINeedIsOneShotAvailable: dataset.allINeedIsOneShotAvailable,
      penetratingShotAvailable: dataset.penetratingShotAvailable,
      hobbleAvailable: dataset.hobbleAvailable,
      cripplingBlowAvailable: dataset.cripplingBlowAvailable,
      cryogenicTouchAvailable: dataset.cryogenicTouchAvailable,
      guardianStrikesAvailable: dataset.guardianStrikesAvailable,
      stickInTheSpokesAvailable: dataset.stickInTheSpokesAvailable,
      interdictionAvailable: dataset.interdictionAvailable,
      penetratingAimAvailable: dataset.penetratingAimAvailable,
      savantSkillAvailable: dataset.savantSkillAvailable,
      metallikatoIgnoreArmorAvailable: dataset.metallikatoIgnoreArmorAvailable,
      analyzeTargetAvailable: dataset.analyzeTargetAvailable,
      psychoanalystAvailable: dataset.psychoanalystAvailable,
      coaxSurrenderAvailable: dataset.coaxSurrenderAvailable,
      chargeAvailable: dataset.chargeAvailable,
      bumpAndRunAvailable: dataset.bumpAndRunAvailable,
      unshakeableAimAvailable: dataset.unshakeableAimAvailable,
      jackOfAllTradesAvailable: dataset.jackOfAllTradesAvailable,
      targetVulnerabilityAvailable: dataset.targetVulnerabilityAvailable,
      terrorAvailable: dataset.terrorAvailable,
      demolitionDriverAvailable: dataset.demolitionDriverAvailable,
      programmableAvailable: dataset.programmableAvailable,
      militaryFormalityAvailable: dataset.militaryFormalityAvailable,
      solusChargeAvailable: dataset.solusChargeAvailable,
      sizeMattersAvailable: dataset.sizeMattersAvailable,
      menacingGlareAvailable: dataset.menacingGlareAvailable,
      instillWeaknessAvailable: dataset.instillWeaknessAvailable,
      deconstructionistAvailable: dataset.deconstructionistAvailable,
      cunningPlanAvailable: dataset.cunningPlanAvailable,
      worthAShotAvailable: dataset.worthAShotAvailable,
      allAroundVisionAvailable: dataset.allAroundVisionAvailable,
      pressureCookerAvailable: dataset.pressureCookerAvailable,
      ricochetAvailable: dataset.ricochetAvailable,
      machinistAvailable: dataset.machinistAvailable,
      bootlickerAvailable: dataset.bootlickerAvailable,
      fastDrawAvailable: dataset.fastDrawAvailable,
      inventorAvailable: dataset.inventorAvailable,
      goodSocietyAvailable: dataset.goodSocietyAvailable,
      huntersProwessAvailable: dataset.huntersProwessAvailable,
      ambitiousAvailable: dataset.ambitiousAvailable,
      isolatedAvailable: dataset.isolatedAvailable,
      iRememberReadingAboutAvailable: dataset.iRememberReadingAboutAvailable,
      gutterChampionAvailable: dataset.gutterChampionAvailable,
      belovedAvailable: dataset.belovedAvailable,
      thrillseekerAvailable: dataset.thrillseekerAvailable,
      straightShooterAvailable: dataset.straightShooterAvailable,
      howStrangeAvailable: dataset.howStrangeAvailable,
      kindButFirmAvailable: dataset.kindButFirmAvailable,
      wireWorkAvailable: dataset.wireWorkAvailable,
      ambushPredatorAvailable: dataset.ambushPredatorAvailable,
      citySlickerAvailable: dataset.citySlickerAvailable,
      hesherAvailable: dataset.hesherAvailable,
      bruteForceIaf2Available: dataset.bruteForceIaf2Available,
      roaringEngineAvailable: dataset.roaringEngineAvailable,
      whipIntoShapeAvailable: dataset.whipIntoShapeAvailable,
      technicallyCorrectAvailable: dataset.technicallyCorrectAvailable,
      saberToothedAvailable: dataset.saberToothedAvailable,
      deceptiveWarfareAvailable: dataset.deceptiveWarfareAvailable,
      brainPowerAvailable: dataset.brainPowerAvailable,
      seeingTheMatrixAvailable: dataset.seeingTheMatrixAvailable,
      mightierThanTheSwordAvailable: dataset.mightierThanTheSwordAvailable,
      pseudoScienceAvailable: dataset.pseudoScienceAvailable,
      quantumCutAvailable: dataset.quantumCutAvailable,
      soloShotAvailable: dataset.soloShotAvailable,
      eltarianTechAvailable: dataset.eltarianTechAvailable,
      spellcializeAvailable: dataset.spellcializeAvailable,
      observerSnagSubstitutionAvailable: dataset.observerSnagSubstitutionAvailable,
      supremeGuardianTechAvailable: dataset.supremeGuardianTechAvailable,
      combatStanceAvailable: dataset.combatStanceAvailable,
      retributionAvailable: dataset.retributionAvailable,
      witheringFireAvailable: dataset.witheringFireAvailable,
      dependableTankerAvailable: dataset.dependableTankerAvailable,
      hackingAlgorithmsAvailable: dataset.hackingAlgorithmsAvailable,
      akimboAvailable: dataset.akimboAvailable,
      twoHandedAssaultAvailable: dataset.twoHandedAssaultAvailable,
      alphaStrikeAvailable: dataset.alphaStrikeAvailable,
      emptyTheMagAvailable: dataset.emptyTheMagAvailable,
      drivingStrikeAvailable: dataset.drivingStrikeAvailable,
      everVigilantAvailable: dataset.everVigilantAvailable,
      noseForTroubleAvailable: dataset.noseForTroubleAvailable,
      dangerSenseAvailable: dataset.dangerSenseAvailable,
      tf1sDeceptiveWarfareAvailable: dataset.tf1sDeceptiveWarfareAvailable,
      needleDropAvailable: dataset.needleDropAvailable,
      rapidDeploymentDrillsAlertnessAvailable: dataset.rapidDeploymentDrillsAlertnessAvailable,
      rapidDeploymentDrillsInfiltrationAvailable: dataset.rapidDeploymentDrillsInfiltrationAvailable,
      spoofDeceptionAvailable: dataset.spoofDeceptionAvailable,
      spoofInfiltrationAvailable: dataset.spoofInfiltrationAvailable,
      yourReputationPrecedesYouAvailable: dataset.yourReputationPrecedesYouAvailable,
      dependableAvailable: dataset.dependableAvailable,
      dependableBothAvailable: dataset.dependableBothAvailable,
      oldReliableAvailable: dataset.oldReliableAvailable,
      oldReliableBothAvailable: dataset.oldReliableBothAvailable,
      legendaryDependabilityAvailable: dataset.legendaryDependabilityAvailable,
      explosiveEngineerScienceAvailable: dataset.explosiveEngineerScienceAvailable,
      explosiveEngineerTechnologyAvailable: dataset.explosiveEngineerTechnologyAvailable,
      alwaysReadyAvailable: dataset.alwaysReadyAvailable,
      disarmingShotAvailable: dataset.disarmingShotAvailable,
      streetSmartsAvailable: dataset.streetSmartsAvailable,
      primalFearAvailable: dataset.primalFearAvailable,
      naturalScienceToSurvivalAvailable: dataset.naturalScienceToSurvivalAvailable,
      naturalScienceToScienceAvailable: dataset.naturalScienceToScienceAvailable,
      scienceFixesAllAvailable: dataset.scienceFixesAllAvailable,
      urbanJungleAvailable: dataset.urbanJungleAvailable,
      fearIsUniversalAvailable: dataset.fearIsUniversalAvailable,
      cobraBattleCryDeceptionAvailable: dataset.cobraBattleCryDeceptionAvailable,
      cobraBattleCryIntimidationAvailable: dataset.cobraBattleCryIntimidationAvailable,
      angryAvailable: dataset.angryAvailable,
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
