import { betterThanTheBestMultiplier, ignoresMissEffects, takedownExpertChoice } from "./helpers/extensions/gij3/dice-hooks.mjs";
import { isFormActive } from "./helpers/extensions/zord1/form-state.mjs";
import { zord2IgnoresLimitedArticulation } from "./helpers/extensions/zord2/snag.mjs";
import { extDialogToggles, extSpecializes, runApplyDialog, runConsumer, runPreRoll } from "./helpers/extensions.mjs";
import { battlizerAttackUsedUp, markBattlizerAttack, racerRecklessShifts } from "./helpers/summons.mjs";
import { applySocialDialog, socialDialogFlags, socialSpecializes } from "./helpers/social-rolls.mjs";
import { betterAsOneDonor, payBetterAsOne } from "./helpers/better-as-one.mjs";
import { applyDialogKits, kitDialogFlags, kitSources, wildAnimalPersuasion } from "./helpers/kits.mjs";
import { pushActor } from "./helpers/forced-movement.mjs";
import { isInAppraisedArea } from "./helpers/eye-for-appraisal.mjs";
import {
  applyDialogRiders, applyRollRiders, askConsistent, disarm, imperfectionOf, buildRiderContext, fanaticCap, hasConditionFrom, isGremlinsMischiefActive, isVsPrimaryQuarry,
  noteRoller, RIDER, riderDefenseAdjust, riderDialogFlags, rollRiderSources, scarefyingSources, untilStartOfNextTurn,
} from "./helpers/target-riders.mjs";
import { canUseDrivingForIntimidation, crewSources, defenderSources, getCrewedVehicle, spendDefenderSources } from "./helpers/vehicle-upgrades.mjs";
import { isInRoughTerrain } from "./helpers/environment.mjs";
const ANTI_AIR_COMBAT_TRAINING = "Compendium.essence20.quartermasters_guide_to_gear.Item.dTlLdrlWAZeZHJ7B";
import { getSceneEpoch, getUses, markUsed } from "./helpers/scene-clock.mjs";
import {
  actorHas as actorHasTrait, computerizedArmorEvasion, firesAsReinforced, hasBoarder, ignoresDefend, isBallisticLongRange, isGrownThreat, lightArmorPenalty,
  noisyArmorPenalty, ramConeAltAttack, ramConeBotUnarmed, TRAIT_PERK,
} from "./helpers/weapon-traits.mjs";
import { canSurge, getCritEssenceOptions, hasChronoTrigger, hasUpgrade, UPGRADE } from "./helpers/weapon-upgrades.mjs";
import { getHudSkill } from "./helpers/weapon-perk-uses.mjs";
import { E20 } from "./helpers/config.mjs";
import { getEnvironment, getTerrain, hasEquippedEnviroSealedArmor, isEnviroSealedEdgeActive } from "./helpers/environment.mjs";
import { isImpairedByEnvironment } from "./helpers/environment-hazards.mjs";
import {
  areHardpointWeaponsInoperable, canTargetVesselSystem, getUnstablePenalty, imposeVesselConditionOnCrit,
  resolveVesselRepair, TARGET_VESSEL_SYSTEM_SHIFT_DOWN,
} from "./helpers/vessel-conditions.mjs";
import { isAiming, isBraced, ACT_WHILE_DEFEATED_FLAG, getLedger, setNextTurn, spend } from "./helpers/action-economy.mjs";
import { ACTION_PERK_IDS, findSourced, getLaughtractingBlock, isGroundAndPoundActive } from "./helpers/action-perks.mjs";
import { pickTerrifyingPresenceRider } from "./helpers/terrifying-presence.mjs";
import { DEFENDING_STATUS } from "./helpers/named-actions.mjs";
import {
  LEND_ASSISTANCE_EDGE_FLAG, LEND_ASSISTANCE_SHIFT_FLAG,
} from "./helpers/lend-assistance.mjs";
import { chooseDefenderDefense, DEFENSE_BOOST, hasSceneDefenseBoost } from "./helpers/defense-choice.mjs";
import { CIRCLE_SHIFT_FLAG } from "./helpers/friendship-circle.mjs";
import { checkAndActivateDefenderStep } from "./helpers/defender-step.mjs";
import {
  bankRetributionBonus, computeRetributionBonusType, RETRIBUTION_ID, RETRIBUTION_PENDING_FLAG,
} from "./helpers/retribution.mjs";
import {
  _isCritIsFumble, applyDamage, buildCheckChatData, computeMultiplier, ENERGY_DAMAGE_TYPES, getDefenseValue,
  getEffectiveLevel, getSecondaryDamage, getSkillRanks, getVehicleDriver, PENDING_SENSITIVE_SNAG_FLAG_KEY,
} from "./helpers/combat.mjs";
import {
  checkPredatorSneakAttackEligibility,
  checkSneakAttackEligibility,
  getPredatorSneakAttackDamage,
  getSneakAttackDamage,
  hasPredatorSneakAttack,
  isSneakAttackDamageItem,
  markDebilitated,
  markSneakAttackUsed,
  PREDATOR_SNEAK_ATTACK_ROUND_FLAG,
  SUDDEN_STRIKE_ENCOUNTER_FLAG,
  SUDDEN_STRIKE_ID,
} from "./helpers/sneak-attack.mjs";
import {
  checkForceReconSneakAttackEligibility, FORCE_RECON_SNEAK_ATTACK_ID, markForceReconSneakAttackUsed,
} from "./helpers/force-recon-sneak-attack.mjs";
import {
  actorHasHangUp, actorHasPerk, bankPendingBonus, clearPendingBonus,
  findHangUp, findPerk,
  getPendingBonus, getUsesThisScene, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisRound, markUsedThisScene, markUsedThisTurn,
  postPerkUseChatCard,
} from "./helpers/perks.mjs";
import {
  consumeBankedDefenseBonus, consumeHardTarget, consumeResilience,
  consumeRollWithThePunches, pickHobbleCondition, pickGuardianStrikesCondition,
  SMASHMOUTH_OFFENSE_FLAG, FORCE_FIELD_DEFENSE_FLAG, STALWART_DEFENSE_FLAG,
} from "./helpers/banked-buffs.mjs";
import { MASS_SHIFT_DEFENSE_FLAG, MASS_SHIFT_SKILL_FLAG } from "./helpers/mass-shift.mjs";
import {
  NANO_MED_MASTERY_EDGE_FLAG, RALLYING_CRY_EDGE_FLAG, SHINING_LEADER_EDGE_FLAG,
} from "./helpers/team-buffs.mjs";
import { consumeRiseAgainDefense } from "./helpers/rise-again.mjs";
import { bankedDefense } from "./rules/bank.mjs";
import { ruleId } from "./rules/index.mjs";
import { ruleAimBonus, ruleCover, ruleCritD2, ruleNoLongRangeSnag, ruleRollSources, ruleScaledDamage } from "./rules/adapter.mjs";
import { getStandByMeDefenseBonus } from "./helpers/stand-by-me.mjs";
import { checkMarkTarget } from "./helpers/mark-target.mjs";
import { checkPrimaryQuarry } from "./helpers/primary-quarry.mjs";
import { checkKnownAccomplice } from "./helpers/known-accomplices.mjs";
import { checkNemesis } from "./helpers/nemesis.mjs";
import { CRIPPLING_BLOW_ID, pickCripplingBlowCondition } from "./helpers/crippling-blow.mjs";
import { NEMESIS_DD_HANGUP_ID, NEMESIS_DD_PERK_ID, isDecepticonNemesis, isNemesisInScene } from "./helpers/nemesis-decepticon.mjs";
import { CBRN_DEFENDER_HANG_UP_ID, getCbrnDefenderShiftDown } from "./helpers/cbrn-defender.mjs";
import { checkTwoHeadsAssistance, consumeTwoHeadsAssistance } from "./helpers/two-heads-are-better-than-one.mjs";
import { deactivateInvisibilityOnAttack } from "./helpers/invisibility.mjs";
import { deactivatePhantomOnAttack } from "./helpers/phantom.mjs";
import { isConcentrateFireTarget } from "./helpers/concentrate-fire.mjs";
import { isProtectedTarget } from "./helpers/protected-target.mjs";
import { isBulwarkActive } from "./helpers/bulwark.mjs";
import { getAllNearbyTokens, getNearbyAllyTokens } from "./helpers/allies.mjs";
import { getNearbyEnemyTokens } from "./helpers/enemies.mjs";
import { getShieldUpgradeBonus, isPersonalShieldActive } from "./helpers/personal-shield.mjs";
import { SHIELD_MODULATION_ID, isProtectedByShieldModulation } from "./helpers/shield-modulation.mjs";
import { getRecklessAbandonStrengthShiftUp, isRecklessAbandonActive } from "./helpers/reckless-abandon.mjs";
import {
  canSpendForActor, canWriteStoryPoints, hasStoryPointsAvailable, poolFor, requestStoryPointGrant,
  requestStoryPointSpend, spendForActor,
} from "./helpers/story-points.mjs";
import { consumeCleverMind } from "./helpers/clever-mind.mjs";
import { applyHealSkillTestResult } from "./helpers/heal-skill-test.mjs";
import { applyStandTogetherHeal } from "./helpers/stand-together.mjs";
import { PAINMONGER_ID } from "./helpers/painmonger.mjs";
import { applySiphonEffect } from "./helpers/siphon.mjs";
import { applyFlashyBlinded, FLASHY_ID } from "./helpers/flashy.mjs";
import { hasPendingChargeItUp, consumeChargeItUp } from "./helpers/charge-it-up.mjs";
import { isSkiing } from "./helpers/skier.mjs";
import { isPointyActive } from "./helpers/pointy.mjs";
import { checkAndMarkSplinterDefense, getHardenedArmorBonus } from "./helpers/splinter-defense.mjs";
import { consumeGridSurgeToughness, GRID_SURGE_CONSTRUCT_FLAG } from "./helpers/grid-surge.mjs";
import { isPowerAdaptationActive } from "./helpers/power-adaptation.mjs";
import { isBioEnergyConversionActive } from "./helpers/bio-energy-conversion.mjs";
import { getFavoriteWeaponItem } from "./helpers/favorite-weapon.mjs";
import { activateWeldsRivetsAndIdeas } from "./helpers/welds-rivets-and-ideas.mjs";
import { isConsultMemoriesActive } from "./helpers/consult-memories.mjs";
import { isResourcefulEdgeActive } from "./helpers/resourceful.mjs";
import { deactivatePhantomSuite, getPhantomSuiteEvasionBonus, isPhantomSuiteActive } from "./helpers/phantom-suite.mjs";
import { getPoweredPlatingBonus } from "./helpers/powered-plating.mjs";
import { getRottenTomatoesBonus } from "./helpers/rotten-tomatoes.mjs";
import { getToughCrowdBonus } from "./helpers/tough-crowd.mjs";
import { getExpandedMysticismFortifyBonus } from "./helpers/expanded-mysticism.mjs";
import { getMagicallyFitInBonus, MYSTICAL_UNDERSTANDING_ID } from "./helpers/magically-fit-in.mjs";
import { getPersonalHeirloomBonus } from "./helpers/personal-heirloom.mjs";
import { getMeatShieldBonus } from "./helpers/meat-shield.mjs";
import { getGrowDefenseBonus } from "./helpers/monster-morph.mjs";
import { isPsychoAssaultActive, PSYCHO_ASSAULT_ID } from "./helpers/psycho-assault.mjs";
import { applyNemesisDrainEffect, getNemesisDrainPenalty } from "./helpers/nemesis-drain.mjs";
import { applyAvalancheStompEffect } from "./helpers/avalanche-stomp.mjs";
import { getMaximizeFlawsTargetUuid } from "./helpers/maximize-flaws.mjs";
import { isPowerBleedActive, drainPowerBleedTarget } from "./helpers/power-bleed.mjs";
import { consumeGrowingSmolderStacks } from "./helpers/growing-smolder.mjs";
import { addToxicTerrorStack, getToxicTerrorShiftDown, isToxicTerrorActive } from "./helpers/toxic-terror.mjs";

// The 6 Finster's Monster-Matic Cookbook Warlord capstones (20th level) - each already has its
// own flat "+N to all Defenses" compendium Active Effect; the pieces built here are their own
// remaining secondary riders (damage bonuses below; Flame/Frost/Stone's own incoming-damage
// reduction lives in combat.mjs#getWarlordDamageReduction instead).
// ACT_WHILE_DEFEATED_FLAG now lives in helpers/action-economy.mjs (isUnableToAct's own doc comment
// explains why) - re-exported here so existing importers of it from dice.mjs keep working.
export { ACT_WHILE_DEFEATED_FLAG };
const WARLORD_FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
const CRUEL_WARLORD_ID = `${WARLORD_FMMC}F3TRKmoaUOtHrlzq`;
// Bad Temper / Something To Prove (Decepticon Directive, Traitor Origin, suggested Hang-Ups,
// p.31-32) - see their own checks in _getAutomaticCombatModifiers, set in _rollSkillHelper's
// isFumble section next to Cruel Warlord's identical hook just above.
const BAD_TEMPER_HANGUP_ID = "Compendium.essence20.decepticon_directive.Item.pTaF0TVS3ZiWerzs";
const BAD_TEMPER_FLAG = 'badTemperActive';
const SOMETHING_TO_PROVE_HANGUP_ID = "Compendium.essence20.decepticon_directive.Item.LopI86yM8zyBHU7O";
const SOMETHING_TO_PROVE_FLAG = 'somethingToProveActive';

// No Fighting?! (Knights of Canterlot, Fighter Influence Hang-Up, p.16) - see
// helpers/no-fighting.mjs's own doc comment for the banking half (deleteCombat hook). Read/
// cleared here the same "flag threaded onto checkContext, cleared in _rollSkillHelper" shape
// Now I'm Angry's own one-shot bank uses, rather than Bad Temper/Something To Prove's own
// round-scoped self-expiry just above - this is a single-use consumption, not a window.
const NO_FIGHTING_HANGUP_ID = "Compendium.essence20.knights_of_canterlot.Item.ddSnDksWfxPkekda";

// Cost of Sorcery (Finster's Monster-Matic Cookbook, mandatory Hang-Up on the Sorcery Perk, p.271):
// "Whenever you Fumble a Skill Test involving a Sorcerous Power or an attack with the Sorcerous
// trait, you lose 1 Health. This Health loss cannot be prevented." The Item itself already exists
// in the compendium (packs/fmmcitems/_source/Cost_of_Sorcery_BRpf0FNey5oDEvq3.json) and is now
// auto-granted alongside the Sorcery Perk (see sheet-handlers/perk-handler.mjs's own
// SORCERY_PERK_ID hook) - this constant is only for the isFumble check below. "Cannot be
// prevented" is a direct actor.update() of system.health.value, the same "bypass applyDamage's
// own resistance/immunity/shield chain entirely" idiom banked-buffs.mjs's own healthCost self-pay
// (e.g. Push Through the Pain) already establishes, rather than routing through applyDamage with
// a damageType nothing resists anyway.
const COST_OF_SORCERY_ID = `${WARLORD_FMMC}BRpf0FNey5oDEvq3`;
const FLAME_WARLORD_ID = `${WARLORD_FMMC}TPrNnDxBKHIajafY`;
const THORN_WARLORD_ID = `${WARLORD_FMMC}GKNjCEwhgEbBiKQn`;

// Power Filter (A Jump Through Time, Zord Feature, p.86): "Your Zord can turn minuscule amounts
// of energic forces that strike it into usable Grid energy. Whenever your Zord either suffers
// Energy damage or successfully avoids Energy damage using its Toughness Defense, its current
// pilot regenerates 1 lost Personal Power." Both halves are a Toughness-compared Energy Attack
// against the Zord - the only difference is the roll's own success (suffers) vs. miss (avoids) -
// so both are checked in one pass over every Toughness/Energy attack's own per-target results, the
// same shape as The Tough Get Going's identical Toughness-miss reaction just above.
const POWER_FILTER_ID = "Compendium.essence20.jump_through_time.Item.4Kjn9FVissqtvwQy";

// Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level) - see its own
// comment above (rollSkill's own shiftUp computation).
const GROWING_SMOLDER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4XblFV97cS63ueDM";

// Jack Of All Trades (GI Joe CRB, Undercover Agent Focus, p.76) - see
// updatedShiftDataset.jackOfAllTradesAvailable's own comment above.
const JACK_OF_ALL_TRADES_ID = "Compendium.essence20.gi_joe_crb.Item.f8ik7h2S3OakNJRq";

// Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level) - see its own
// comment in _getAutomaticCombatModifiers below.
const MAXIMIZE_FLAWS_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.jGa15CyuKXhq3IV2";

// Let's Go Psycho! - the single shared Item every one of the 6 Psycho Paths grants - see Gang Up's own check in
// _getAutomaticCombatModifiers for why this is used as an "is on a Psycho Path" marker.
const LETS_GO_PSYCHO_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.qMvUP1yEtsSo6KDh";
// Gang Up (Finster's Monster-Matic Cookbook, Path of Cruelty, Gang Up Role Points, p.282) - see
// its own check in _getAutomaticCombatModifiers.
const GANG_UP_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.Y18J55UVsdm2aB7E";
const GOIN_HEELS_ID = "Compendium.essence20.jump_through_time.Item.8QaqczkkaPaUivEC";

import { isWisdomOfTheEldersActive } from "./helpers/wisdom-of-the-elders.mjs";
import { getProtectionBoostBonus } from "./helpers/protection.mjs";
import { getReactiveBoostBonus } from "./helpers/reactive.mjs";
import { isAugmentedCombatActive } from "./helpers/augmented-combat.mjs";
import { REPAIR_MACHINE_EDGE_FLAG } from "./helpers/repair-machine.mjs";
import { applyBolsterDefense, getBolsterDefenseBonus } from "./helpers/bolster-defense.mjs";
import { applyChronomanticPulse } from "./helpers/chronomantic-pulse.mjs";
import { getRoarDefenseBonus } from "./helpers/roar.mjs";
import { applyJuryRigBenefit, getJuryRigDefenseBonus, isJuryRigBenefitActive } from "./helpers/jury-rig.mjs";
import { applyImproviseArmor } from "./helpers/improvise-armor.mjs";
import { markUndoEngineMovementDisabled, triggerUndoEngineCheck } from "./helpers/undo-engine.mjs";
import { applySpotWeldHeal } from "./helpers/spot-weld.mjs";
import { applyMartialLeadershipEffect, PENDING_EDGE_FLAG as MARTIAL_LEADERSHIP_EDGE_FLAG, PENDING_SNAG_FLAG as MARTIAL_LEADERSHIP_SNAG_FLAG } from "./helpers/martial-leadership.mjs";
import { PENDING_PSYCHOLOGICAL_SWAY_FLAG } from "./helpers/psychological-sway.mjs";
import { applyVoiceOfPrimusEffect, bankVoiceOfPrimusAssistReady } from "./helpers/voice-of-primus.mjs";
import { bankRemoteOperationsReady } from "./helpers/remote-operations.mjs";
import { applyAvastInitiativePenalty } from "./helpers/avast.mjs";
import { applyWordsCanHurtEffect } from "./helpers/words-can-hurt.mjs";
import { applySideSplitterDamage } from "./helpers/side-splitter.mjs";
import { applyCalmingWordsEffect } from "./helpers/calming-words.mjs";
import { POWERFUL_SUGGESTION_FLAG } from "./helpers/powerful-suggestions.mjs";
import { DATA_BRIDGE_FLAG, getDataBridgedAllyCount, hasBorrowedDataBridgeSpecialization, isDataBridged } from "./helpers/data-bridge.mjs";
import { consumeTradeSchool } from "./helpers/trade-school.mjs";
import { buildTechSpecsResult, checkTechSpecsEdge, checkTechSpecsShiftUp, markTechSpecsTarget } from "./helpers/tech-specs.mjs";
import { buildBreakingPointResult, pickBreakingPointDetail } from "./helpers/breaking-point.mjs";
import { getGroundSuppressionReduction, markGroundSuppressed } from "./helpers/ground-suppression.mjs";
import { broadcastForwardObservation } from "./helpers/forward-observation.mjs";
import { broadcastHeartyMeal } from "./helpers/hearty-meal.mjs";
import { BRUTE_FORCE_WORKS_BEST_FLAG, markBruteForceWorksBest } from "./helpers/brute-force-works-best.mjs";
import { DECONSTRUCTIONIST_FLAG, DECONSTRUCTIONIST_ID, markDeconstructionist } from "./helpers/deconstructionist.mjs";
import { NO_FACTOR_ID, isNoFactorFooled, markNoFactorFooled, clearNoFactorDisguise } from "./helpers/no-factor.mjs";
import { TEAR_DOWN_ID, isTearDownPending, markTearDownPending, clearTearDownPending } from "./helpers/tear-down.mjs";
import { getLikeWaterDefenseBonus } from "./helpers/like-water.mjs";
import { getNotOnMyWatchDefenseBonus } from "./helpers/not-on-my-watch.mjs";
import { activateTheToughGetGoing } from "./helpers/the-tough-get-going.mjs";
import { applyLuckyCharm } from "./helpers/lucky-charm.mjs";
import { applyDsoeDisguise, isDsoeDisguiseActive } from "./helpers/dsoe-disguise.mjs";
import { applyGetToKnow, GET_TO_KNOW_EDGE_FLAG } from "./helpers/get-to-know.mjs";
import { markPackMuleDownshift, PACK_MULE_DOWNSHIFT_FLAG } from "./helpers/pack-mule.mjs";
import { applyHotToTrot } from "./helpers/hot-to-trot.mjs";
import { applyGlow, isGlowActive } from "./helpers/glow.mjs";
import { applyGreasedLightning, isGreasedLightningActive } from "./helpers/greased-lightning.mjs";
import { applySparkleBlast } from "./helpers/sparkle-blast.mjs";
import { applyMysterySense, isMysterySenseActive } from "./helpers/mystery-sense.mjs";
import { applyGlittermane, isGlittermaneActive } from "./helpers/glittermane.mjs";
import { applyOokieSpookies, isOokieSpookiesActive } from "./helpers/ookie-spookies.mjs";
import { applyTimedCondition } from "./helpers/timed-status.mjs";
import { applyTalkThemUp } from "./helpers/talk-them-up.mjs";
import { applyFoolscarrot, isFoolscarrotActive } from "./helpers/foolscarrot.mjs";
import { applyScarefyingAppearance, isScarefyingAppearanceActive } from "./helpers/scarefying-appearance.mjs";
import { applySizeChangePotion } from "./helpers/size-change-potions.mjs";
import { applyBlockMagic } from "./helpers/block-magic.mjs";
import { isExploitWeaknessMarked, markExploitWeakness } from "./helpers/exploit-weakness.mjs";
import { checkWhateverWeNeed } from "./helpers/whatever-we-need.mjs";
import { getVolleyShots, isVolleyActive } from "./helpers/volley.mjs";
import { applyEnchant, ENCHANT_SHIFT_UP_FLAG } from "./helpers/enchant.mjs";
import { applyBestowExpertise } from "./helpers/bestow-expertise.mjs";
import { applyPanaceaHeal } from "./helpers/panacea.mjs";
import { applyIveGotYouHeal, UP_AND_AT_EM_EDGE_FLAG } from "./helpers/i-ve-got-you.mjs";
import { applyMindOverMatterHeal } from "./helpers/mind-over-matter.mjs";
import { applyRegenerationHeal } from "./helpers/regeneration.mjs";
import { applyFlutteryWings } from "./helpers/fluttery-wings.mjs";
import { applySummonArmor, getSummonArmorDefenseBonus } from "./helpers/summon-armor.mjs";
import { applyDontNoticeMeField, isDontNoticeMeFieldActive } from "./helpers/dont-notice-me-field.mjs";
import { applyLightningSpeed } from "./helpers/lightning-speed.mjs";
import { PENDING_RUSH_THE_LINE_EDGE_FLAG } from "./helpers/rush-the-line.mjs";
import { isObserverDisguiseActive } from "./helpers/observer.mjs";
import { isPerfectDisguiseActive } from "./helpers/perfect-disguise.mjs";
import { checkCombatStance, COMBAT_STANCE_ID, getCombatStanceNumber } from "./helpers/combat-stance.mjs";
import { hasNearbyTacticalMeditation } from "./helpers/tactical-meditation.mjs";
import { AGELESS_KNOWLEDGE_FLAG } from "./helpers/ageless-knowledge.mjs";
import { THE_RETURNED_FLAG } from "./helpers/the-returned.mjs";
import { PARADOX_FLAG } from "./helpers/paradox.mjs";
import { getFastLearnerAllocation } from "./helpers/fast-learner.mjs";
import { getDefensiveFlexibilityDefenseBonus, hasDefensiveFlexibilityResistance } from "./helpers/defensive-flexibility.mjs";
import {
  getMysteriousAuraImposingPenalty, getMysteriousAuraProtectiveBonus, hasNearbyResplendentAura,
} from "./helpers/mysterious-aura.mjs";
import { EXTRA_ROUGH_TRAINING_FLAG } from "./helpers/extra-rough-training.mjs";
import { broadcastHupHupHupHupHupBonus } from "./helpers/hup-hup-hup-hup-hup.mjs";
import { SHOULDER_TO_SHOULDER_FLAG } from "./helpers/shoulder-to-shoulder.mjs";
import { hasNearbyExemplaryMatch, recordExemplaryRoll } from "./helpers/exemplary.mjs";
import {
  ENVIRONMENTAL_EXPERTISE_ID, getEnvironmentOfExpertiseSourceLabel, hasActiveEnvironmentalExpertise,
  PENDING_GUIDANCE_FLAG_KEY,
} from "./helpers/environmental-expertise.mjs";
import { applyWreckerOnAutoFail, applyWreckerRoughTerrain, hasTakePointCover } from "./helpers/rough-terrain.mjs";
import {
  applyExplosiveAftershockEffects, EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG, pickExplosiveAftershockEffects,
} from "./helpers/explosive-aftershock.mjs";
import { hasPhantomFocusOption } from "./helpers/phantom-focus.mjs";
import { THROUGH_THE_ARCHES_SNAG_FLAG } from "./helpers/through-the-arches.mjs";
import { grantTerrorIfEligible } from "./helpers/terror.mjs";
import { getChargedUpEssence, isMuscleModeActive, isPowerModeActive } from "./helpers/omega-enhancement.mjs";
import { getTimeTravelerActiveSkill } from "./helpers/time-traveler.mjs";
import { pickDirtyTrickCondition } from "./helpers/dirty-trick.mjs";
import { isLanceOfLightActive } from "./helpers/lance-of-light.mjs";
import {
  applyMenacingGlareEffect, MENACING_GLARE_EDGE_FLAG, MENACING_GLARE_SNAG_FLAG, pickMenacingGlareEffect,
} from "./helpers/menacing-glare.mjs";
import { applyInstillWeakness, getInstillWeaknessDamageType, INSTILL_WEAKNESS_ID } from "./helpers/instill-weakness.mjs";
import { PENDING_ONE_UPPING_FLAG_KEY } from "./helpers/one-upping.mjs";
import { isEvasiveManeuversActive } from "./helpers/evasive-maneuvers.mjs";
import { isScrambleActive } from "./helpers/scramble.mjs";
import { SPITE_EDGE_FLAG } from "./helpers/spite.mjs";
import { COVERING_FIRE_SNAG_FLAG } from "./helpers/covering-fire.mjs";
import { checkAndMarkUnluckyForYou, UNLUCKY_FOR_YOU_SNAG_FLAG } from "./helpers/unlucky-for-you.mjs";
import { checkFightMeDownshift } from "./helpers/fight-me.mjs";
import { applyBumperCropSnag } from "./helpers/bumper-crop.mjs";
import { isPseudoScienceActive } from "./helpers/pseudo-science.mjs";
import { isHonestAssessmentActive } from "./helpers/honest-assessment.mjs";
import { isAugmentPowerWeaponActive } from "./helpers/augment-power-weapon.mjs";
import { isPenetratingStrikesActive } from "./helpers/penetrating-strikes.mjs";
import { isIlluminateActive } from "./helpers/illuminate.mjs";
import { actorHasPower } from "./helpers/powers.mjs";
import { actorHasZordFeature, findZordFeature } from "./helpers/zord-features.mjs";
import { consumeRelicKeyEdge, isRelicKeyEdgeActive } from "./helpers/relic-key.mjs";
import { consumeSpeedBoostEdge, isSpeedBoostEdgeActive } from "./helpers/speed-boost.mjs";
import { isWarriorModeActive } from "./helpers/warrior-mode.mjs";
import {
  consumeZeoCrystalBoostZordAttackDamage, getZeoCrystalBoostOption, isZeoCrystalBoostMegaformTeamActive,
} from "./helpers/zeo-crystal-boost.mjs";
import { applyBrazenStrike } from "./helpers/brazen-strike.mjs";
import { applyStylishStrike } from "./helpers/stylish-strike.mjs";
import { isBlazingStrikesActive } from "./helpers/blazing-strikes.mjs";
import { isNinjaPowerActive } from "./helpers/ninja-power.mjs";
import { ENERGY_AFFINITY_ID, getEnergyAffinityAlteredStyle } from "./helpers/energy-affinity.mjs";
import { isVoidWarriorActive } from "./helpers/void-warrior.mjs";
import { checkEnemyNumberOne, markAttackedEnemyNumberOne } from "./helpers/enemy-number-one.mjs";
import { checkTeamFocus, markAttackedByAlly } from "./helpers/team-focus.mjs";
import { getQuietOneEdge, markQuietOneNoisyAction } from "./helpers/quiet-one.mjs";
import { getInfluentialShiftUp } from "./helpers/influential.mjs";
import { isMultipleTargetsWeapon } from "./helpers/multiple-targets.mjs";
import { isMetallikatoMultipleTargetsActive } from "./helpers/metallikato.mjs";
import { applyReroll, findRolePointsItem } from "./helpers/reroll.mjs";
import { HELP_YOURSELF_ID, summonHelpYourselfClone } from "./helpers/help-yourself.mjs";
import {
  getRallyingCryTargetLimit, isSurpriseRound, WTNV_RALLYING_CRY_ID,
} from "./helpers/surprise.mjs";
import { getWeaponImplantTier, implantWeapon } from "./helpers/weapon-implant.mjs";
import { applySkillEffectBonus, getToggleableSkillEffects } from "./helpers/skill-effects.mjs";
import { applyAngryHangUp } from "./helpers/angry.mjs";
import { recordDistractingOfferResult } from "./helpers/distracting-offer.mjs";
import { markIronBravadoAttack } from "./helpers/iron-bravado.mjs";
import {
  deactivateShynessOnAttack, DISGUST_TURN_FLAG, EMOTIONAL_MASTERY_ID, EMOTIONAL_MASTERY_SHAME_FLAG,
  hasContemptResistance, isEmotionalMasteryOptionActive,
} from "./helpers/emotional-mastery.mjs";
import {
  ANTAGONISTIC_SHIFT_DOWN_FLAG, ANTAGONISTIC_SNAG_FLAG, applyAntagonisticEffect, pickAntagonisticEffect,
} from "./helpers/antagonistic.mjs";
import { applyFaceMeEffect, FACE_ME_COMPELLER_FLAG } from "./helpers/face-me.mjs";
import { FLYING_NUISANCE_SNAG_FLAG, markFlyingNuisanceSnag } from "./helpers/flying-nuisance.mjs";
import { PSYCHO_STRIKE_SNAG_FLAG } from "./helpers/psycho-strike.mjs";
import { MISTRUSTFUL_HANGUP_ID, MISTRUSTFUL_SNAG_FLAG, markMistrustfulSnag } from "./helpers/mistrustful.mjs";
import { hasNumbnessResistance } from "./helpers/numbness.mjs";
import { hasRighteousHeartResistance, RIGHTEOUS_HEART_RESISTANCE_FLAG } from "./helpers/righteous-heart.mjs";
import { hasAquaElementalAdaptation } from "./helpers/aqua-elemental-adaptation.mjs";
import { isWithinGetAGripSizeGate, spendGetAGripFreeActions } from "./helpers/get-a-grip.mjs";
import { NO_FIGHTING_FLAG } from "./helpers/no-fighting.mjs";
import {
  STORM_OF_LEAD_ID, adjustFanningShotShift, clampFanningShots, getFanningMaxShots, getFanningShotShifts,
} from "./helpers/fanning.mjs";
import { HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN, isHighDensityWeapon } from "./helpers/high-density.mjs";
import { hasGeneticAlterations, isRetrogenWeapon } from "./helpers/retrogen.mjs";
import { creatureTagsOf, isRobotic } from "./helpers/creature-tags.mjs";

// Every Commando Perk automated below that isn't specific to Sneak Attack itself (those constants
// live in helpers/sneak-attack.mjs instead) - all under GI Joe CRB's own compendium pack.
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const GENERAL_HAWKS_PERSONNEL_FILES = "Compendium.essence20.general_hawk_s_personel_files.Item.";

// Skier (General Hawk's Personnel Files, General Perk, p.175) - see helpers/skier.mjs's own doc
// comment. "+1 Evasion... while skiing" - a live, non-consumed read in the per-target checkEntries
// construction below, the same shape Phantom Suite's own Evasion bonus already established (this
// system's `_prepareDefenses` is off-limits, the user's own pending Health/Defense-math migration).
const SKIER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}dvmY7UiuKejOPY4N`;

// Spoof (Quartermaster's Guide to Gear, Role Perk, p.19/21): "When you are in disguise and an
// enemy isn't aware of your true identity, you can use Deception or Infiltration instead of
// Initiative." The two "roll Deception / Infiltration instead" Initiative switches are the item's
// own rules (DialogSwitch useSkill); "in disguise and an enemy isn't aware of your true identity" is
// left to the player, who only ticks one when it holds. Kept here for "Friendly" Fire, whose
// Initiative stamp in prepareInitiativeRoll() reads whether one of those switches was ticked.
const SPOOF_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.LBuVQrU8sDOVCQAQ";

// Dependable (General Hawk's Personnel Files, Influence Perk, p.166): "Once per scene, before you
// roll a Skill Test, you can instead treat a d20 result as a 10 without rolling. You still roll
// your Skill Dice as normal. If you are rolling with an Edge or a Snag, you treat one d20 result
// as a 10 and roll the other." See _getd20Operand's own comment on flatD20Value/flatBothD20s for
// the mechanism this and the two Perks below share - the first flat d20-substitution primitive in
// this codebase (distinct from Silver Tongue's floorAt10, which still lets a naturally-higher roll
// count). Its own Hang-Up ("You can only use your Influence Perk if you have an Edge on the Skill
// Test") can't be checked before the dialog opens (Edge/Snag isn't resolved yet) - enforced at
// consumption time instead, where an ineligible check is a no-op, the same self-policing idiom
// this project already uses for checkboxes whose fictional trigger can't be verified in code.
const DEPENDABLE_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}TQaVcZQHYTmmTv6b`;

// Pressure Cooker (Hawk's Personnel Files, Role Perk, 5th level): "if you are below your maximum
// Health (not counting temporary Health), gain ↑1 on Skill Tests. If you only have 1 Health left,
// you can spend a Moxie Point as a Free action to give yourself an Edge on a Skill Test." The
// below-max-Health ↑1 is the item's own rule (system.rules); the Moxie-for-Edge half is a Roll
// Options Dialog checkbox, same "Moxie" named-RolePoints-resource shape as Old Reliable above.
const PRESSURE_COOKER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}MMToVGBAkB79DZEW`;
const DEPENDABLE_HANGUP_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}mwELSYc9AGgImy7N`;

// Old Reliable (General Hawk's Personnel Files, Old Hand Role Perk, 3rd level, p.165): the same
// flat d20-substitution as Dependable above, but Moxie-gated (no frequency cap of its own) instead
// of once/scene, plus its own escalation: "If you are rolling with an Edge or a Snag, you may
// spend an additional Moxie to treat both d20 results as a 10, or spend 1 to set one d20 result to
// 10 and roll the other." Moxie is Old Hand's own rolePoints item - NOT resolvable via the generic
// actor._getBaseRolePoints() (that helper explicitly EXCLUDES an additive Role's own points, and
// Old Hand's own Role item is `isAdditive: true`, confirmed directly against the compendium JSON -
// it augments a character's original base Role rather than replacing it) - so this looks Moxie up
// by name instead, via helpers/reroll.mjs's own findRolePointsItem (already exported for exactly
// this "a Perk needs a specific named RolePoints item, not necessarily the actor's base one" case).
const OLD_RELIABLE_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}0TYq9zWlE0xX6KvT`;

// Legendary Dependability (General Hawk's Personnel Files, Old Hand Role Perk, 13th level, p.165):
// "once per day, when using your Old Reliable Role Perk, you can spend a Moxie Point to treat the
// d20 result as a 15 instead of a 10. If you have the Dependable Influence, you can use its
// Influence Perk twice per day, and can use the Influence Perk twice to affect both d20s..."
// "Once per day"/"twice per day" are approximated as once/twice per SCENE (getUsesThisScene/
// markUsedThisScene, helpers/perks.mjs) - the same "day ≈ scene" simplification this project
// already uses for every other daily resource (e.g. At All Cost).
const LEGENDARY_DEPENDABILITY_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}Ouw89rVHYKgMnYMi`;

// Show Of Hands (Field Guide to Action & Adventure, Envoy Role Perk, 7th level, p.68): "when you
// aren't holding any weapons and you haven't made an unarmed attack in this scene, you gain an
// Edge on Deception, Intimidation, and Persuasion Skill Tests." "Not holding any weapons" checks
// the actor's own equipped weapon items directly; "haven't made an unarmed attack this scene" is
// tracked by a dedicated scene flag, marked the moment isUnarmedAttack is computed further down in
// this same method (see SHOW_OF_HANDS_UNARMED_FLAG's own mark site).
const SHOW_OF_HANDS_ID = "Compendium.essence20.field_guide_action_adventure.Item.tLAchrH1qQxk3CBJ";
const SHOW_OF_HANDS_UNARMED_FLAG = 'showOfHandsUnarmedAttackUsedThisScene';

// Time Traveler (A Jump Through Time, Influence Perk, p.24) - see its own Snag-immunity check near
// skillRollOptions.snag above and helpers/time-traveler.mjs's own doc comment.
// Time Traveler's own Hang-Up: "When you attempt a Skill Test using a Skill Rank, after any
// modifications, of d4 or lower, you suffer a Fumble on results of 1 and 2 on the d20." Widens the
// ordinary natural-1-only Fumble (_isCritIsFumble) with an extra natural-2 case - see its own check
// near the [isCrit, isFumble] destructure in _rollSkillHelper, gated on rollContext.finalShift (the
// same already-resolved skill-die-size variable rollSkill() built its formula from) rather than
// re-deriving the skill die's face count from the rolled dice pools themselves.
const TIME_TRAVELER_HANGUP_ID = "Compendium.essence20.jump_through_time.Item.4OGaAf7j1W8ZaGSs";

// Try, Try Again (A Jump Through Time, Driven Origin Benefit, p.26): "Anytime you fail a Skill
// Test, you gain ↑1 the next time you attempt a Skill Test with the same Skill in the same
// scene." Fully automatic, no button - banked (helpers/perks.mjs#bankPendingBonus) the moment a
// roll of this skill fails (see _rollSkillHelper's own post-roll processing), consumed on the
// next matching-skill roll the same "skill-scoped bank/consume" shape as Paradox's own check just
// above - "same scene" approximated as "next matching roll," this project's usual duration idiom.
const TRY_TRY_AGAIN_ID = "Compendium.essence20.jump_through_time.Item.bFJOnWaIKTDYjDDJ";
const TRY_TRY_AGAIN_FLAG = 'pendingTryTryAgain';

// Arashikage Graduate (Factions in Action Vol 2: Intercontinental Adventures, Influence Hang-Up,
// p.13): "Once per scene, when you fail a Skill Test, you suffer ↓1 on your next Skill Test as
// your equilibrium temporarily wavers." Same automatic bank/consume shape as Try, Try Again just
// above, negated (a self-imposed Snag-shift rather than a bonus) and NOT skill-scoped (RAW says
// "your next Skill Test," any skill) - gated with hasUsedThisScene/markUsedThisScene so it only
// banks once per scene rather than on every failure.
const ARASHIKAGE_GRADUATE_HANGUP_ID = "Compendium.essence20.intercontinental_adventures.Item.OhOdfAu7b0lLDO82";
const ARASHIKAGE_GRADUATE_FLAG = 'pendingArashikageGraduate';
const ARASHIKAGE_GRADUATE_SCENE_FLAG = 'arashikageGraduateUsedThisScene';

// Advantageous Fighter (A Jump Through Time, General Perk, p.54) - see its own clamp near
// _getFinalShift in rollSkill().
const ADVANTAGEOUS_FIGHTER_ID = "Compendium.essence20.jump_through_time.Item.efcjaYwJpsBUlVN3";

// Low Tech Priorities (A Jump Through Time, Low Tech Origin Benefit, p.28) - see its own downshift
// -immunity check near _hasExpertiseDownshiftImmunity's own call in rollSkill().
const LOW_TECH_PRIORITIES_ID = "Compendium.essence20.jump_through_time.Item.khD9UfuqUQ4rWSUP";
const LOW_TECH_PRIORITIES_FLAG = 'lowTechPrioritiesUsedThisTurn';

// Always Ready (Coast Guard Origin Perk, p.172): "Choose which function you fulfilled. Once per
// scene when in an aquatic environment, or once per mission in any other environment, you gain an
// Edge on one of the two Skills tied to that function." "Aquatic vs. other environment" has no
// hook to check (no environment-tagging anywhere in this codebase, the same gap already flagged
// for several other Perks) - approximated as a flat once/scene, the wider of the two stated
// windows. `system.choice` (set via the new alwaysReadyFunction choiceType - see
// perk-handler.mjs/E20.alwaysReadyOptions) names the chosen function; this maps it to its own
// pair of skills - kept here rather than in config.mjs since it's a roll-mechanics lookup, not a
// display-label table.
const ALWAYS_READY_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}g8IpStvApoftBiNq`;

// Disarming Shot - see updatedShiftDataset.disarmingShotAvailable's own comment above.
const DISARMING_SHOT_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}b4v1GUBwSqnCTozq`;
const ALWAYS_READY_FUNCTION_SKILLS = {
  admin: ['culture', 'persuasion'],
  biologist: ['animalHandling', 'science'],
  engineer: ['brawn', 'technology'],
  pilot: ['alertness', 'driving'],
  rescue: ['athletics', 'survival'],
  security: ['intimidation', 'targeting'],
};

// Bear Hug (Factions in Action Vol. 2, General Perk, p.94) - its +1 is the Perk's own scaled
// DamageModifier rule; the Grapple-to-Blunt damage type override is its own check below.
const BEAR_HUG_ID = "Compendium.essence20.intercontinental_adventures.Item.id5IVoPuSC03mKfZ";

// Evasive (Factions in Action Vol. 2, Red Ninja Faction Perk, p.10): "If you are aware of an
// Attack, you may always use Evasion for Defense." Same "substitute in whenever it's better" idiom
// as Psychological Warfare's own identical Willpower/Cleverness-scoped clause, just unscoped to
// ANY Defense - see its own check next to that one in rollSkill()'s checkEntries construction.
const EVASIVE_IAF2_ID = "Compendium.essence20.intercontinental_adventures.Item.pa4D7BibxH7jW0BA";

// Empty Hands (Factions in Action Vol. 2, General Perk, p.30) - see its own check next to Walking
// Weapon Rack's identical unarmed-Edge shape above.
const EMPTY_HANDS_ID = "Compendium.essence20.intercontinental_adventures.Item.t6ACZEOz99JWWHyg";

// Air/Land/Sea Vehicle Qualification (Factions in Action Vol. 2, Dreadnok General Perks, p.63):
// "If you have Ranks in Driving, you gain ↑1 on Driving Skill Tests when driving a [type]
// vehicle." The untrained-Snag-suppression half lives in roll-dialog.mjs (which defines its own
// copy of this same ID/movement-type map - each file in this project keeps its own compendium ID
// constants rather than sharing them across files). "Ranks in Driving" checked via
// getSkillRanks(actor, 'driving') > 0, the same derived-Ranks helper Bulked Up Frame/Tactical
// Gymnastics already established.
const AIR_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.GUcQm2RuUIEWzd4X";
const LAND_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.xLeoc9xLx06SpK7S";
const SEA_VEHICLE_QUALIFICATION_ID = "Compendium.essence20.intercontinental_adventures.Item.K0UKwjhJlYnGM7yt";

// Skyward (Quartermaster's Guide to Gear, Influence Perk, p.13): "You are Qualified with all air
// vehicles, rolling Driving Skill Tests to drive air vehicles without Snag, even if you have no
// Ranks in the Driving Skill." Textually the same "Qualified with [movement type]" grant as Air
// Vehicle Qualification above, just from a different source - added alongside it in the 'aerial'
// bucket below rather than duplicating the whole check. The "identify any air vehicle you see"
// clause is pure GM narration, not built. Its own Hang-Up ("suffer downshift 1 on Driving Skill
// Tests when driving land and sea vehicles") is a RollModifier on the Hang-Up item itself.
//
// RE-KEYED 2026-09-15: that downshift was keyed on SKYWARD_ID, i.e. the PERK, even though a real
// separate Hang-Up Item exists for it. Latent rather than player-visible, since this Influence
// grants exactly one Hang-Up and so always grants both together - but 35 Influences in this
// project DO offer a choice of 3+ Hang-Ups, so keying a Hang-Up's penalty to its Perk is a bad
// precedent to leave lying around (and it would misfire outright if a GM ever granted the Perk
// alone). Found by the same self-side-direction scan that caught Indoctrinated and Unscrupulous,
// extended from Edge/Snag to shiftUp/shiftDown. The Hang-Up's rule is keyed on that item for the same reason.
const SKYWARD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1IlTYXe8k5Aj63Mn";

// Broadcaster (Quartermaster's Guide to Gear, Influence Perk, p.8): "You gain Edge on Social Skill
// Tests involving people you're communicating with using technological devices and Technology
// (Communications) Skill Tests when you're not in combat." Only the Technology(Communications)
// half is built - the same "match by Specialization name" idiom Calm Beast/Tourniquet Line Chef
// already establish, gated on `!game.combat` for the "when you're not in combat" clause (no other
// Perk in this project has needed that specific gate on a flat skill-Edge grant before, but it's a
// plain read of the same `game.combat` global everything else here already uses). The Social half
// ("people you're communicating with using technological devices") stays unbuilt - unlike
// Communications' own fixed name, there's no way to detect "is this specific Social roll about a
// tech-mediated conversation" at roll time, and granting it as a blanket Social Edge would be a
// much bigger overreach than this project's usual narrative-qualifier simplifications (those never
// touch WHICH skill, just WHY it's being rolled). Its own Hang-Up ("Snag on Social Skill Tests
// involving people you haven't met before") needs a "have I met this NPC" tracking concept that
// doesn't exist anywhere - also unbuilt.
const BROADCASTER_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.IvmCWJUuntY3KALM";

const WEAK_POINT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.opTZmlt97a9TWHSk";

// Brute Force Works Best (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 17th level,
// p.24) - see helpers/brute-force-works-best.mjs's own doc comment.
const BRUTE_FORCE_WORKS_BEST_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.oZVphHSTTBENUaFk";

// Stick In The Spokes (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 20th level, p.24):
// "once per combat, when you successfully hit with a blade or bludgeon against a piece of
// equipment whose Threat Level is equal to or less than your level, you can choose to make it
// inoperable until repaired instead of dealing damage. On a Critical Success, you can destroy
// it." Same "checkbox forgoes this attack's own damage in exchange for a status applied post-hit"
// shape as Guardian Strikes above, gated once/combat instead of always-available, and scoped to
// blade/bludgeon-vs-vehicle-at-or-below-your-level rather than a two-handed-melee target size.
// "Inoperable until repaired" has no existing status to reuse (unlike "destroy it," which maps
// cleanly onto the same Defeated toggle Stun's own auto-Defeat check already establishes) - this
// system has no vehicle-repair mechanism to clear it against either, so it's a plain, unenforced
// marker flag (the same "visible marker, not hard enforcement" idiom Stun's own Move-action-denial
// status already uses) rather than a real Condition.
const STICK_IN_THE_SPOKES_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.qf1HjLgmRGil2N7i";
const STICK_IN_THE_SPOKES_ENCOUNTER_FLAG = 'stickInTheSpokesUsedThisEncounter';

// Undo Engine (Factions in Action Vol. 2, Engineer Troop Focus, 20th level, p.71): "if your
// Attack against a vehicle is a Critical Success, the target vehicle's driver must succeed on a
// DIF 20 Driving Skill Test, or the vehicle's Movement is reduced to 0 until the driver uses their
// Standard action to restart the engines." See helpers/undo-engine.mjs's own doc comment for the
// full mechanism - unconditional whenever the roller holds the Perk (no player choice, unlike
// Stick In The Spokes/Interdiction just above), and "Movement is reduced to 0" is left as a plain,
// unenforced marker flag, the same idiom Stick In The Spokes' own "inoperable" flag already
// established (no "restart the engines" action exists anywhere in this codebase to hook a clear
// onto either).
const UNDO_ENGINE_ID = "Compendium.essence20.intercontinental_adventures.Item.0nTFK9GOpkQcjcHB";
const STICK_IN_THE_SPOKES_INOPERABLE_FLAG = 'stickInTheSpokesInoperable';

// Interdiction (Ferocious Fighters, Force Recon Focus, 20th level, p.45): "once per combat scene,
// if you successfully hit a target whose Threat Level is less than your Level with an attack, you
// can choose to Defeat them instead of dealing damage." Same "checkbox forgoes this attack's own
// damage in exchange for a status applied post-hit, once per encounter" shape as Stick In The
// Spokes just above, but the Defeat applies on ANY success (not just a Critical Success) and the
// level comparison is strictly less-than (RAW says "less than," not "equal to or less than").
// "Only works against targets who are not aware of your presence" is the same unenforceable
// narrative qualifier this project already drops elsewhere (no "aware of you" tracking exists).
const INTERDICTION_ID = "Compendium.essence20.ferocious_fighters.Item.AyKHJdCpdtoZHlER";
const INTERDICTION_ENCOUNTER_FLAG = 'interdictionUsedThisEncounter';

// Nu, Pogodi! (Factions in Action Vol. 2, Oktober Guard Faction Perk, p.68): "Qualified with all
// Standard land and air vehicles" - the exact "Qualified... roll Driving without a Snag, ↑1 if you
// have Ranks" wording the movement-type allowlist below already handles generically, so this Perk's
// own ID just gets appended to the aerial/ground arrays alongside the existing entries. The "all
// Standard" qualifier (an availability tier, not a vehicle-movement-type) isn't separately enforced
// - same "grant the broader mechanism, drop an unenforceable narrowing qualifier" idiom this project
// already applies elsewhere (e.g. Bits To Spare/Truthseeker's own narrative qualifiers).
const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";

// Nothing Personal (Factions in Action Vol. 2, Criminal Organization Faction Perk, p.100):
// "Qualified with Land vehicles... roll Driving without a Snag, even with no Ranks." Same
// movement-type-allowlist reuse as Nu, Pogodi! above, ground only.
const NOTHING_PERSONAL_ID = "Compendium.essence20.intercontinental_adventures.Item.WsB4CydGzKF2g7Yi";

// The Promise of Riches (Factions in Action Vol. 2, Mercenary Faction Perk, p.103): "Qualified
// with Land, Sea, and Air vehicles... roll Driving without a Snag, even with no Ranks." Same
// movement-type-allowlist reuse, all three arrays at once.
const THE_PROMISE_OF_RICHES_ID = "Compendium.essence20.intercontinental_adventures.Item.wW4xugDI7Sea2Btg";

// Good To Go (Factions in Action Vol. 2, Freedom Fighters Faction Perk, p.104) - see its own
// checkbox above for the RAW text and why this needs a choice-scoped check rather than a static
// table append. system.choice is one of 'aerial'/'ground'/'swim' - the exact same keys
// system.movement already uses, so the check can compare them directly with no translation.
const GOOD_TO_GO_ID = "Compendium.essence20.intercontinental_adventures.Item.Yt3muowN1aALcqOj";

// For The Syndicate (Factions in Action Vol. 2, International Syndicate Faction Perk, p.102):
// "You are Qualified with either Land, Sea, or Air vehicles [choose one]." Byte-identical wording
// to Good To Go's own vehicle-qualification clause just above - same choiceType:'vehicleType'
// mechanism, so it's checked alongside Good To Go via CHOICE_SCOPED_VEHICLE_QUALIFICATION_IDS
// rather than a separate duplicated check. Its own "Qualified with 1 Limited weapon + 1 Limited
// battledress, or 1 Restricted weapon or battledress" clause hits the same per-specific-item-
// Qualified schema gap Good To Go/Trade Goods already established - Needs new infrastructure, not
// built. "Gain Mentor as a bonus General Perk" is built via perk-handler.mjs's own
// grantPerkOutright, see FOR_THE_SYNDICATE_ID's own comment there.
const FOR_THE_SYNDICATE_ID = "Compendium.essence20.intercontinental_adventures.Item.opygNwRWgeIyU1mE";
const CHOICE_SCOPED_VEHICLE_QUALIFICATION_IDS = [GOOD_TO_GO_ID, FOR_THE_SYNDICATE_ID];

// Oorah! (Sgt Slaughter Sourcebook, Slaughter's Marauders Faction Perk, p.15) - see its own fuller
// comment near the rest of this book's own constants for the full RAW text. Declared here (rather
// than alongside its siblings) so it can be appended to the table below - a plain unconditional
// "Qualified... roll Driving without a Snag, ↑1 if you have Ranks" grant for Land vehicles, the
// same trivial append as Nu Pogodi/Nothing Personal/The Promise of Riches just above.
const OORAH_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.7CuDik9Vtpou9iDJ";

const VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE = {
  aerial: [AIR_VEHICLE_QUALIFICATION_ID, SKYWARD_ID, NU_POGODI_ID, THE_PROMISE_OF_RICHES_ID],
  ground: [LAND_VEHICLE_QUALIFICATION_ID, NU_POGODI_ID, NOTHING_PERSONAL_ID, THE_PROMISE_OF_RICHES_ID, OORAH_ID],
  swim: [SEA_VEHICLE_QUALIFICATION_ID, THE_PROMISE_OF_RICHES_ID],
};

// Not On My Watch (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
// helpers/not-on-my-watch.mjs's own doc comment. Only the +1 Toughness/+1 Evasion "while a
// Defeated teammate is within your Reach" half is built - the reactive "Move towards a
// newly-Defeated ally" half needs the still-missing "react to an event" hook.
const NOT_ON_MY_WATCH_ID = "Compendium.essence20.intercontinental_adventures.Item.xH3iQ0NcXp1eFO35";

// Without a Word (Factions in Action Vol. 2, Red Ninja Origin Benefit, p.10): "In Combat, as long
// as at least one enemy is Frightened, Mesmerized, or Surprised, you gain +1 to all Defenses. This
// bonus applies to enemies not suffering any of the listed Conditions as long as one of their
// allies is affected." No printed range ("at least one enemy," full stop) - same unbounded-scan
// idiom Not On My Watch's own comment above establishes for an identically rangeless clause. The
// Qualifications half (Cover Grenades/melee weapon upgrades/Stealth upgrade/Limited Athletics
// (Climbing) Kits) is a plain Requisition-access grant this codebase has no per-item Qualification
// list to check against (see requisition.mjs's own "returns 'unknown' wherever the item simply
// does not carry the data to decide" doc comment) - not built, same gap every other Qualification
// grant in this codebase already has.
const WITHOUT_A_WORD_ID = "Compendium.essence20.intercontinental_adventures.Item.cZg52I6J5dLP6PjV";

// The Tough Get Going (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
// helpers/the-tough-get-going.mjs's own doc comment.
const THE_TOUGH_GET_GOING_ID = "Compendium.essence20.intercontinental_adventures.Item.OUtZ1DohGv4l9A5j";
const THE_TOUGH_GET_GOING_ROUND_FLAG = 'theToughGetGoingUsedThisRound';

// Ballistics Precision (Enigma of Combination, General Perk, p.40) - see its own check next to
// Sharpshooter's Grace's identical range-scoped shiftUp shape above.
const BALLISTICS_PRECISION_ID = "Compendium.essence20.enigma_of_combination.Item.KyqWYbVVxuECXXmv";

// Tactical Triangulation (Enigma of Combination, Hub Focus, Analyst, 6th level, p.29): "If you or
// an ally currently benefitting from your Data Bridge Role Perk makes a ranged attack, that
// attack gains ↑1 for each Data Bridged ally (including you!) currently able to see the target of
// the attack, to a maximum of ↑3." See helpers/data-bridge.mjs's own doc comment for how the
// Data-Bridged roster itself is populated (Data Bridge now broadcasts to every nearby ally, not
// just the caster). "Currently able to see the target" is dropped, the same unenforceable-
// narrowing simplification this project uses throughout.
const TACTICAL_TRIANGULATION_ID = "Compendium.essence20.enigma_of_combination.Item.weK6qeL2EmoNQk04";

// Roaming the Land (Ferocious Fighters, Mega Monsters Faction Perk, p.75) - see
// E20.roamingTheLandOptions' own doc comment for the RAW text and the choice mechanism.
const ROAMING_THE_LAND_ID = "Compendium.essence20.ferocious_fighters.Item.jdQFjlYUHaRze6as";

// Two-Handed Assault (Factions in Action Vol. 2, Silent Weapons Expert Focus, 3rd level, p.12) -
// see E20.twoHandedAssaultOptions' own doc comment and its own checkbox below, right alongside
// Akimbo's identical manual-toggle idiom.
const TWO_HANDED_ASSAULT_ID = "Compendium.essence20.intercontinental_adventures.Item.btGfoEaflxAZAw25";

// Empathy (MLP CRB, Spirit of Kindness, 1st level, p.82): a choiceType:'skills' pick - "your
// Empathy skill" in every other Kindness Perk's own RAW text (Counselor, Tender, The Bigger The
// Heart, Supportive Friend, Kind But Firm) means "whichever skill you chose here," not a literal
// new skill type (confirmed: no 'empathy' key exists in E20.skills).
const EMPATHY_MLP_ID = "Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ";

// Supportive Friend (MLP CRB, Spirit of Kindness, 7th/13th/18th level, p.85-86): 3 separate
// compendium items for the same escalating "when you succeed at an Empathy Skill Test, your
// nearby friends gain a bonus on a Skill Test" broadcast (+1, then +2, then Edge) - checked
// highest-tier-first in _rollSkillHelper's own post-roll processing so a character who somehow
// holds more than one tier doesn't stack them.
const SUPPORTIVE_FRIEND_ID = "Compendium.essence20.mlp_crb.Item.YSK9hm3OkG6jKlAJ";
const EXTRA_SUPPORTIVE_FRIEND_ID = "Compendium.essence20.mlp_crb.Item.nqunVQB7C5ldA7SK";
const SUPER_SUPPORTIVE_FRIEND_ID = "Compendium.essence20.mlp_crb.Item.T44FMLiQpwW9cV2u";

// Support Yourself (MLP CRB, Spirit of Kindness, 11th level, p.86): "when you use an ability that
// benefits one or more of your friends, you enjoy the same benefit as your friends." Scoped to
// Supportive Friend's own broadcast specifically (this Role's one ally-wide benefit built so far)
// - includes the granter in their own nearby-ally scan, the same includeSelf idiom
// Environmental Assist already established for team-buffs.mjs.
const SUPPORT_YOURSELF_ID = "Compendium.essence20.mlp_crb.Item.OZrtQuRwCCzeKfV9";

// Ice Machine (Oktober Guard General Perk, p.95): "You gain Resistance to Cold damage [a plain
// compendium Active Effect]. Additionally, if you deal Cold damage with an Attack against a
// Stunned target, the target gains the Immobilized Condition." "Stunned" here is the real,
// existing Stunned Condition (a toggleable status, distinct from the separate Stun damage type's
// own numeric accumulator - see this project's own Opportunist doc comment for that same
// distinction) - checked via target.statuses.has('stunned') in _rollSkillHelper's post-hit
// processing, alongside the attack's own damageType.
const ICE_MACHINE_ID = "Compendium.essence20.intercontinental_adventures.Item.m4iS0VQn9z8o6FWy";

// Dependable Tanker (Technician Focus, p.70): "You may spend a Story Point before a Driving or
// Technology Skill Test related to vehicles to gain Edge on the Skill Test." "Related to
// vehicles" is dropped as the same accepted looseness Bits To Spare/Truthseeker's own narrower
// qualifiers already use - available on any Driving/Technology roll.
const DEPENDABLE_TANKER_ID = "Compendium.essence20.intercontinental_adventures.Item.mHqern3w5iGWBi02";

// Hacking Algorithms (Commando Focus, p.70): "You can spend a Story Point before a Technology
// Skill Test related to computers to gain Edge on the Skill Test." Same shape as Dependable
// Tanker just above (a single-skill Story-Point-Edge checkbox), "related to computers" dropped
// the same accepted-looseness way.
const HACKING_ALGORITHMS_ID = "Compendium.essence20.intercontinental_adventures.Item.6IxjVPikwpSdrYpd";

// Hierarchy Rank (Mercenary/Crime-syndicate Faction Perk, p.100): "You gain ↑1 on the Skill Tests
// that target characters of a lower level or whose Threat Level is lower than your level.
// However, you suffer ↓1 on the Skill Tests that target characters of a higher level or whose
// Threat Level is higher than your level." A plain getEffectiveLevel(actor) vs
// getEffectiveLevel(target) comparison (the same PC-Level/NPC-Threat-Level equivalence Just the
// Facts already established) - see its own check next to the other target-based self-status
// checks, not gated on isAttack since RAW says "Skill Tests" broadly.
const HIERARCHY_RANK_ID = "Compendium.essence20.intercontinental_adventures.Item.J9XS0xqlSQwkEwll";
const GRID_SOLDIER_ID = "Compendium.essence20.jump_through_time.Item.y9F6PkCIw7g6tiqL";

// Coax Surrender (General Hawk's Personnel Files, General Perk, p.174): "As a Standard action, you
// roll a Persuasion Skill Test against the Willpower or Cleverness of a target. On a success, the
// target suffers 1 Stun." RAW pulled fresh from the actual PDF - the earlier categorization pass
// had wrongly filed this under "forced-enemy-targeting/behavior compulsion," but it's actually the
// exact same shape as Psychoanalyst (a Skill Test declared via checkbox, compared against the
// existing generic Defense dropdown, dealing a synthetic Stun amount on success through the
// existing damageValue/damageType -> Apply Damage pipeline) - a mis-categorization, not a real gap.
const COAX_SURRENDER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}zMtDS7NhRXcL6Epm`;

// Worst Nightmare (General Hawk's Personnel Files, General Perk, p.174): "You gain ↑1 on Attack
// Skill Tests targeting a Frightened creature or an Edge if the target is Frightened of you." The
// "of you" Edge is helpers/target-riders.mjs's (it reads who caused the Frightened); the two are
// alternatives, so the ↑1 below only applies when someone ELSE frightened the target. A
// reciprocal target-Condition check, the same isAttack-gated per-target shape Fight Me!/Combat
// Stance already establish just below.
const WORST_NIGHTMARE_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}eju1fItsi7O0utmh`;

// Bulked Up Frame (General Hawk's Personnel Files, General Perk, p.174): "When not wearing armor,
// you gain a deflective bonus to Toughness equal to the number of Ranks you have in Brawn." See
// helpers/combat.mjs#getSkillRanks's own doc comment for how "Ranks" is derived (not a tracked
// field anywhere, but fully computable). "Not wearing armor" reuses the same
// `items.documentsByType.armor.filter(a => a.system.equipped)` check actor.mjs's own
// _prepareDefenses/reckless-abandon.mjs's own armor-weight check already establish. A live,
// non-consumed read in the per-target checkEntries construction below (Toughness-only), the same
// shape Skier/Phantom Suite's own Defense bonuses already use since `_prepareDefenses` itself is
// off-limits (the user's own pending Health/Defense-math migration).
const BULKED_UP_FRAME_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}ITvnVU4crafDWfjF`;

// Tactical Gymnastics (General Hawk's Personnel Files, General Perk, p.177): "When not wearing
// armor, you gain a bonus to Evasion equal to the number of Ranks you have in Acrobatics.
// Additionally, you may use your Evasion defense against attacks with the Ballistic trait." Same
// Ranks-scaled live Defense read as Bulked Up Frame above (Evasion instead of Toughness); the
// Ballistic-trait clause reuses the exact "substitute Evasion in whenever it's better" idiom
// Psychological Warfare's own check already establishes, just gated on the incoming weapon's own
// Ballistic trait (the same _getParentWeapon lookup Empty the Mag's own check already uses)
// instead of a fixed Willpower/Cleverness pair.
const TACTICAL_GYMNASTICS_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}b5WD6Y13Fvhl6ZTe`;

// Split-Second Reaction (A Jump Through Time, General Perk, p.56): "+1 Evasion" (a plain
// compendium Active Effect, already built) "and you ignore the Ballistic trait on Attacks that
// target you." Read as the same "you may use your Evasion defense against attacks with the
// Ballistic trait" substitution Tactical Gymnastics' own identical clause just above already
// establishes (with no Acrobatics-Ranks bonus added on top, since Split-Second Reaction names
// none) - "ignore the trait" and "may use Evasion instead of the Toughness it would otherwise
// force" are the same practical effect, since Ballistic's only mechanical teeth in this codebase
// is forcing Toughness at range.
const SPLIT_SECOND_REACTION_ID = "Compendium.essence20.jump_through_time.Item.QhC7lX08bSPyfdkD";

// Roadside Assistant (General Hawk's Personnel Files, General Perk, p.174): "Vehicles you pilot or
// are a passenger in gain 1 Bonus Health when you roll an Initiative Skill Test to begin a
// conflict." Checked via _getPilotedVehicle(actor) with no role argument - matches EITHER crew
// role (driver or passenger), unlike every other piloting Perk in this project (Peerless Pilot,
// Dogfighter, Motor Lancer), which all require 'driver' specifically. "To begin a conflict" maps
// directly onto hasUsedThisEncounter's own combat-id-scoped gate (already resets on a genuinely
// new combat) - no approximation needed. Built in prepareInitiativeRoll() since Initiative never
// rolls through rollSkill() in practice (see that method's own top comment).
const ROADSIDE_ASSISTANT_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}AAacA8jm6dyG0WEH`;
const ROADSIDE_ASSISTANT_ENCOUNTER_FLAG = 'roadsideAssistantUsedThisEncounter';
const FIRST_STRIKE_ID = `${GI_JOE_CRB}qxqtfBobduwSkfRM`;
// Kill Shot (Sniper Focus, 20th level, p.75) - see _getd20Operand's own comment for its own
// 3d20kh half. The reroll-any-Targeting-skill-die half is pure compendium JSON (system.reroll,
// target:"skillDice", mode:"single", skills:["targeting"]) - the generic reroll engine already
// handles it, no code needed for that half.
const KILL_SHOT_ID = `${GI_JOE_CRB}K82Mlwef1QMEsRrP`;
const DEBILITATING_STRIKE_ID = `${GI_JOE_CRB}dYaTU9IYI3vB5eHs`;
const QUIET_AS_THE_GRAVE_ID = `${GI_JOE_CRB}UJTt3hP5OwQHBcpf`;
// Hard Hitter - see its own comment near appliesRolePointsDamage below.
const HARD_HITTER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.L8wFtP1y6PQYJJVL";
// Psychological Warfare (GI Joe CRB, Commando base, 13th level, p.73): "you may use your Evasion
// defense against attacks that target your Willpower and Cleverness." "May" is read as "whenever
// it's actually better for you" - substituting Evasion in only when it beats the Defense actually
// being targeted, computed right alongside the ordinary difficulty lookup below.
const PSYCHOLOGICAL_WARFARE_ID = `${GI_JOE_CRB}GvXCxr0Uj7jPhqJR`;

// Shatter Resolve (Decepticon Directive, Interrogator base, 6th level, p.41): "all Willpower and
// Cleverness Defenses take a -2 penalty against your Deception and Persuasion Skill Tests." A
// plain flat subtraction from difficulty, gated on the ATTACKER's own rolled skill and the
// resolved Defense - computed alongside Psychological Warfare/Ground Suppression just below it.
const SHATTER_RESOLVE_ID = "Compendium.essence20.decepticon_directive.Item.s3rsoMHOjWY9WfLF";

// Double Agent (Technorganic Secrets, General Perk, p.46): "When interacting with members of the
// faction, culture, community, or organization you have infiltrated, you gain upshift 1 to all
// Smarts- and Social-based Skill Tests. Additionally... these members take a -1 penalty to their
// Defenses against your Powers and attacks." "Members of the faction you've infiltrated" has no
// faction-membership concept anywhere in this codebase to check automatically, so - the same
// self-declared-narrative-act idiom Isolated/I Remember Reading About/Menacing Glare already
// establish - this is a single Roll Options Dialog checkbox (doubleAgentAvailable/
// applyDoubleAgent) the player checks when the fiction applies, granting whichever half is
// relevant to the roll: the Smarts/Social shiftUp on a Skill Test, or this -1 Defense penalty
// (read here, alongside Shatter Resolve/Ground Suppression's own difficulty adjustments) on an
// attack.
const DOUBLE_AGENT_ID = "Compendium.essence20.technorganic_secrets.Item.WjTeOJJJmntm6JgT";

// Scapegoat (Cobra Codex, Influence Perk, p.33): "Once per scene, when an effect targets your
// Cleverness, you can have it target your Willpower instead, or vice versa." RE-CATEGORIZED
// 2026-09-15 out of a ~34-item narrative bucket. Exactly the same "substitute in whenever it's
// better" idiom as Psychological Warfare just above - and over the same Willpower/Cleverness pair -
// except it swaps between those two rather than bringing Evasion in from outside.
//
// "Once per scene" is enforced through the Scene Clock (a 'scapegoatSwap' use in the 'scene'
// window, marked on the target only when the swap actually raises the Difficulty). The check entry
// carries scapegoatSwapped so its paired Hang-Up ("take 1 point of Essence damage to your Smarts"
// when the effect still succeeds) lands afterwards - see scapegoatHangUp in helpers/target-riders.mjs.
const SCAPEGOAT_ID = "Compendium.essence20.cobra_codex.Item.yMihdpSe5ntjRN3R";
const SILVER_TONGUE_ID = `${GI_JOE_CRB}69ijP0SuQ4demwd9`;
const SHOCK_AND_AWE_ID = `${GI_JOE_CRB}a5HptfB7nYFLVHkc`;
// Explosive Aftershock - see its own comment near isExplosiveAftershockAttack below.
const EXPLOSIVE_AFTERSHOCK_ID = `${GI_JOE_CRB}Kvq0MfPqSya2mf5b`;
// Assault Precision (p.100) is gated on "a shotgun or submachine gun weapon" - unlike every other
// weapon-gated Perk in this file, there's no weaponTrait (or any other structured field) on the
// weapon Item itself marking it as one of these; "shotgun"/"submachineGun" only exist as
// E20.weaponTypes entries used for a Role's own qualification lists, never written onto an
// individual weapon. The compendium only has one canonical "Shotgun" and one "Submachine Gun"
// weapon Item, so this checks those specific Items by sourceId instead - the same
// hardcoded-compendium-ID idiom already used throughout this file, just applied to a weapon
// rather than a Perk. A reskinned/homebrew copy of either weapon won't match, the same accepted
// limitation isSneakAttackDamageItem() already has for a renamed Sneak Attack Damage Item.
const SHOTGUN_ID = `${GI_JOE_CRB}2qW1YLopvjKyezNQ`;
const SUBMACHINE_GUN_ID = `${GI_JOE_CRB}oJInlAgdYZzjH7bk`;
// Tracker (Ranger's Environmental Exposure choice, p.91): "You get up 2 when using Survival to
// track a target in your environment of expertise." "To track a target" narrows to no distinct
// Survival sub-check this system tracks, so - same "no narrower sub-classification to check
// against" approximation Caretaker/Bits To Spare already accept - applied to any Survival Skill
// Test while Environmental Expertise is active, the same unconditional-while-gated shape
// Safecracker's own upshift 2 uses.
const TRACKER_ENVIRONMENTAL_ID = `${GI_JOE_CRB}mgvaFU9Kgr3awtfB`;
const QUIET_AS_THE_GRAVE_ROUND_FLAG = 'quietAsTheGraveLastRound';
const FIELD_ID = `${GI_JOE_CRB}qHLeKSMin2F19O3C`;
const EXPERT_IN_YOUR_FIELD_ID = `${GI_JOE_CRB}mnLXHQ2TwR3A42fS`;
const PENETRATING_ROUNDS_ID = `${GI_JOE_CRB}JLwbWSlHn5q3rqnH`;

// Trajectory (Artillery Focus, 1st level, p.80) - see its own range-widening comment below. "A
// targeting explosive launched weapon" is read as an explosive-style weaponEffect (the same
// item.system.classification.style == 'explosive' check Bigger Booms' own AoE-bonus-feet clause
// already establishes in helpers/aoe-targeting.mjs) whose own classification.skill is 'targeting'
// (as opposed to a hand-thrown grenade using Might/Finesse). The "choose which skill you use when
// throwing explosives" clause isn't built this pass - it needs a genuinely new "the chosen skill
// permanently redefines an entire weapon CATEGORY's own classification.skill" mechanism, distinct
// from Brain Power/Cunning Plan/How Strange!'s own per-roll shift-delta substitution shape (those
// only ever affect ONE already-fixed skill's own roll, never change which skill an attack itself
// is classified under).
const TRAJECTORY_ID = `${GI_JOE_CRB}B7pPkcsYGscY94W3`;
const IMMOVABLE_OBJECT_ID = `${GI_JOE_CRB}QSHsA1peMncG196r`;

// Protector's Shield (Bodyguard Focus, 10th level, p.110) - see
// _applyImmovableObjectImmunity's own widened doc comment below for the crit-immunity half.
const PROTECTORS_SHIELD_ID = `${GI_JOE_CRB}tGdWBibKFTYfXzVu`;
const IMPENETRABLE_SHIELD_ID = `${GI_JOE_CRB}eEUl7OA9yWAk0QD3`;
const PLATE_PIERCING_ID = `${GI_JOE_CRB}II5giKn7vCDeB2nk`;
// Shared by Infantry and Vanguard - a single compendium Perk both Roles grant, whose chosen
// Fighting Style lives on its own system.choice field (see documents/actor.mjs's own identical
// constant/comment for the Careful/Defense options this file doesn't need to touch).
const FIGHTING_STYLE_ID = `${GI_JOE_CRB}2LtDCHxgg9bMvWQK`;
const GALLANTRY_ID = `${GI_JOE_CRB}UIMocxFcGeJUm3D4`;
const ALPHA_STRIKE_ID = `${GI_JOE_CRB}9EWv3qQJgj7WFQ9A`;
const ALPHA_STRIKE_ROUND_FLAG = 'alphaStrikeLastRound';
const HEAVY_ORDNANCE_ID = `${GI_JOE_CRB}b2viBBrNk08Kc9ts`;
const EMPTY_THE_MAG_ID = `${GI_JOE_CRB}zbrr3W30rFTDTayX`;
const NOWHERE_IS_SAFE_ID = `${GI_JOE_CRB}oUAeJZ7K1P7Fu8Bc`;

// BRRRRRRRRRRRRRRT (GI Joe CRB, Heavy Ordnance Focus, 10th level, p.111): "Once per encounter when
// you make a Multiple Targets attack, your allies gain ↑1 shift for the next turn and may
// immediately take a Sprint action." Only the ally shiftUp broadcast half is built - "may
// immediately take a Sprint action" is action economy. Triggers on making a qualifying attack at
// all (no hit/success check in RAW, unlike You Can Do It, Too!'s own Critical-Success gate), so
// it's checked in _rollSkillHelper's post-hit processing anyway (the same place
// checkContext.isMultipleTargetsWeapon is already available) but unconditional on `results`.
// "For the next turn" approximated as "their own next roll," this project's usual duration idiom.
const BRRRRRRRRRRRRRRT_ID = `${GI_JOE_CRB}U3NTi35bk2qI8oB6`;
const BRRRRRRRRRRRRRRT_ENCOUNTER_FLAG = 'brrrrrrrrrrrrrrtUsedThisEncounter';

// MLP CRB p.123 / PR CRB p.95 "Expertise": "Ignore the first ↓1 dice downshift applied to your
// Skill Tests" - scoped to whichever one skill the player chose for this Perk instance (system
// .choice, set by sheet-handlers/perk-handler.mjs#onPerkDrop's 'skills' choiceType). Both game
// lines' printings are mechanically identical, so both compendium copies are checked.
const EXPERTISE_PERK_IDS = [
  "Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw",
  "Compendium.essence20.pr_crb.Item.uoCQgYOCeIQNzF0q",
];

// PR CRB "Driving Strike" (Finster's Monster-Matic Cookbook p.286): "By spending 1 Personal
// Power before making a melee attack, you can either ignore a target's bonuses from armor to
// Defense or reroll any skill dice used in the attack; you must choose before rolling..." - a
// pre-roll declared choice, not a reactive reroll-button grant (see helpers/roll-dialog.mjs's
// own "drivingStrikeAvailable" toggle), so unlike Weapon Mastery/Expertise/etc. this Perk has no
// system.reroll data of its own - just a flat "does the actor have it" check.
const DRIVING_STRIKE_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.bP55ciUhiMJzyTGC";

// Power Ranger CRB Role Perks automated below - Tier 1 of the PR Role automation pass (see
// project plan). All bare `perk` items with no compendium mechanical data of their own (unlike
// Power Strike, a `rolePoints` item already read generically by the damageBonus block below -
// see its own comment), so each needs the small bit of new code next to its own check.
const PR_CRB = "Compendium.essence20.pr_crb.Item.";

// Augment Power Weapon (PR CRB, Grid Power, p.99) - see helpers/augment-power-weapon.mjs's own
// doc comment. While active: upshift 1 on weaponEffect attacks made with the actor's own Power
// Weapon (parent weapon's own `powerWeapon` trait, same check Power Boost/Red Ranger Prime's
// identical clauses already use).

// Strike Bonus (Yellow Ranger, 2nd/5th/8th/11th level, p.56): "At the beginning of any round you
// may spend 1 Personal Power to apply a [scaling] shift to the first melee attack you make during
// your action." this.system.advances.currentValue is a pure display label everywhere else in
// this codebase (setPerkAdvancesName, perk-handler.mjs) - this is the one place its number
// actually does something.
const STRIKE_BONUS_ID = `${PR_CRB}eCTmc2BbsrCLrjkw`;
const STRIKE_BONUS_ROUND_FLAG = 'strikeBonusUsedThisRound';

// Cunning Plan (A Jump Through Time, Orange Ranger, 1st level, p.32): "spend a Personal Power to
// substitute your Cunning Skill value... for any Skill during a Skill Test." Cunning is the
// Orange Ranger's own tracked roleSkillDie (system.skills.roleSkillDie - the same generic
// per-Role special die every Role's own skillDie.isUsed config can populate, see
// sheet-handlers/role-handler.mjs). Unlike every other checkbox in this file, this doesn't add a
// shiftUp/shiftDown of a known size - it substitutes an entirely different die. Applied as a
// shiftUp/shiftDown DELTA between the two dice's shift-list positions (see its own consumption
// further down), since skillDataset.shift itself is already locked in and shown to the player by
// the time the Roll Options Dialog (and so this checkbox) exists.
const CUNNING_PLAN_ID = "Compendium.essence20.jump_through_time.Item.gGqatrdFbt4VWML7";

// Brazen Strike (A Jump Through Time, Grid Power, p.57) - see helpers/brazen-strike.mjs's own doc
// comment.
const BRAZEN_STRIKE_ID = "Compendium.essence20.jump_through_time.Item.zUmuHsSmS3u7bRro";

// Cryogenic Touch (A Jump Through Time, Grid Power, p.57): "You can choose for your Unarmed
// strikes to deal Cold damage instead of their normal damage type." Unlike Blazing Strikes/Void
// Warrior (both one-way flag toggles switched on via a Power click), this half of Cryogenic Touch
// is a free, no-cost, always-on characteristic once the Power is taken at all - so it's checked via
// a plain actorHasPower, not a flag. The separate "spend 1 Power on hit to inflict Impaired" half
// is built independently below (cryogenicTouchAvailable).
const CRYOGENIC_TOUCH_ID = "Compendium.essence20.jump_through_time.Item.dDHjUwjLlGJhiQvI";

// Stylish Strike (A Jump Through Time, Grid Power, p.58) - see helpers/stylish-strike.mjs's own
// doc comment.
const STYLISH_STRIKE_ID = "Compendium.essence20.jump_through_time.Item.9LYVJbnqO6BmxGXF";

// Quantum Defender (Sword)/(Blaster) - the Quantum Ranger's own two named starting weapons,
// checked by Quantum Cut/Solo Shot below (same weaponSourceId idiom as Long Range Rifle/Shotgun/
// Submachine Gun elsewhere in this file).
const QUANTUM_DEFENDER_SWORD_ID = "Compendium.essence20.jump_through_time.Item.HNgu1rhXK46RG0bW";
const QUANTUM_DEFENDER_BLASTER_ID = "Compendium.essence20.jump_through_time.Item.gOZtlnZubOZ01ZdF";
const QUANTUM_CUT_ID = "Compendium.essence20.jump_through_time.Item.9DhE4UzSl40c8lW4";
const SOLO_SHOT_ID = "Compendium.essence20.jump_through_time.Item.SS1IgnoreRange10";

// Eltarian Tech (Through the Shattered Grid, Guardian of Eltar, 1st level, p.72): "spend 1
// Eltarian Tech to gain Edge on a Technology Skill Test." Functionally identical in shape to
// Eureka! above ("spend an Idea Point to gain Edge on a Smarts Skill Test") - actor._getBaseRolePoints()
// already resolves generically to whichever rolePoints item is THIS actor's own base one (Idea
// Points for a Blue Ranger, Eltarian Tech for a Guardian of Eltar - see its own doc comment in
// documents/actor.mjs), so the same lookup works unchanged. Scoped to the Technology SKILL
// specifically (not the whole Smarts essence, unlike Eureka!'s own wider scope).
const ELTARIAN_TECH_ID = "Compendium.essence20.through_the_shattered_grid.Item.jaqxs1OPQuaI9KJZ";

// Mystical Understanding - Spellcialize (MLP CRB, Spirit of Magic, 1st level, p.95): "When you
// roll a Skill Test that you have at least one Rank in but you aren't Specialized, you can spend
// a Mystical Point as a Free action to roll as though you are Specialized."
//
// RE-CATEGORIZED - the ledger's blanket "Spellcasting mastery/rank tracking" tag fit 3 of this
// Perk's own 5 benefits (Refocus/Spellcosting need a real Spellcasting-Rank-vs-Total-Rank tracker
// that doesn't exist anywhere in this codebase; Essential Research needs a temporary Essence Score
// bump this codebase also has no mechanism for) but NOT Spellcialize, which needs neither - it's
// a plain "spend 1 point of the actor's own base rolePoints resource to roll this ONE Skill Test
// as Specialized" checkbox, the exact same shape as Eltarian Tech/Eureka! just above, just gated
// on "trained but not already Specialized" instead of a fixed skill/essence. "At least one Rank"
// reads as "not the default untrained d20 shift" (the same reading roll-dialog.mjs's own
// _isUntrainedSnag already uses for "Unskilled"); "you aren't Specialized" reads directly off
// actor.system.skills[skill].isSpecialized, the actor's own base flag (same field Force's own
// Initiative check and rawDataset.isSpecialized's own fallback both already read). Magically Fit
// In (grant Skill ranks for the scene) built as a same-day follow-on - see
// helpers/magically-fit-in.mjs's own doc comment; MYSTICAL_UNDERSTANDING_ID itself is exported
// from and owned by that file since it's the more involved of this Perk's 2 built benefits.

// Charge Into Battle (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72) - see its
// own comment near calculatedShiftUp above and multiple-targets.mjs's own widening.
const CHARGE_INTO_BATTLE_ID = "Compendium.essence20.through_the_shattered_grid.Item.34O7Y77lZpuhng3G";

// Ultimate Magna Defender (Through the Shattered Grid, Magna Defender, 20th level, p.25) - see its
// own damage-bonus comment below. Its "+2 all Defenses" and "Edge on Strength" bullets are already
// compendium Active Effects.
const ULTIMATE_MAGNA_DEFENDER_ID = "Compendium.essence20.through_the_shattered_grid.Item.ukfZOGZeuyJv6I5M";

// Eureka! (Blue Ranger, 1st level, p.38) - distinct from the unrelated GI Joe CRB "Eureka" already
// named EUREKA_ID above (a different compendium Item entirely, just a same-named Perk): "you may
// spend an Idea Point to gain Edge on [a Smarts Skill Test]." Idea Points is Blue Ranger's own
// `rolePoints` item (bonus.type: "none", a plain limited-use pool) - actor._getBaseRolePoints()
// already resolves to it for any actor with this Perk, same as the damageBonus block below does
// for Power Strike, so no separate Idea-Points-specific ID/lookup is needed.
const EUREKA_PR_ID = `${PR_CRB}DU5oZEhhd45VDmRg`;

// Devastating Strike (Yellow Ranger, 18th level, p.57): "You now inflict triple damage when you
// make a critical hit on a target instead of the normal double damage." This system already
// expresses "double damage" as a Degrees of Success multiplier of 2 (helpers/combat.mjs's
// computeMultiplier) - the separate isCrit/_isCritIsFumble natural-max-die mechanic instead drives
// criticalOptions (stacking an alternate attack effect, p.205), not a damage multiplier, so this
// hooks into the multiplier instead.
const DEVASTATING_STRIKE_ID = `${PR_CRB}qxO7qYqdB0QUwJxe`;

// Precision (Transformers CRB, Spec Ops, 20th level, p.61): "you succeed with a high degree of
// success on attacks if your result exceeds your target's Defense by 10 or more, instead of when
// your result doubles the target's Defense." A different multiplier-of-2 THRESHOLD, scoped to
// attacks specifically (checkContext.isAttack, the same flag chat.mjs's own Spite button already
// reads), not the doubling rule general Skill Tests against a plain DIF still use.
const PRECISION_ID = "Compendium.essence20.tf_crb.Item.r6nEmY5FD3I6WQoY";

// Transformers CRB Role Perks automated below - Tier 1 of the Transformers Role automation pass
// (see project plan). Same "bare compendium item, code supplies the mechanic" situation as PR.
const TF_CRB = "Compendium.essence20.tf_crb.Item.";

// Limited Articulation (TF CRB, several Alt Mode Chassis, e.g. Champion p.51): "You cannot use
// Skills that require articulation or precision, such as Athletics and Finesse" while converted
// into an Alt Mode with this trait. A hard block, not a downshift - RAW says "cannot use", not
// "suffer a penalty" - checked in rollSkill() below against whichever Alt Mode item is currently
// active (system.altModeId, set by sheet-handlers/transformer-handler.mjs#_transformAltMode) and
// its own system.limitedArticulation field (data/item/alt-mode.mjs). Some Origins also carry a
// Limited Articulation drawback of their own (Ch05 Roles' "Helping Hand" Advanced Perk ignores
// that one specifically) - out of scope here, since that Perk doesn't exist as a compendium item
// yet and no Origin-level field carries this flag.
const LIMITED_ARTICULATION_SKILLS = ['athletics', 'finesse'];

// Emergency Care Equipment / Vehicle Repair Equipment (TF CRB Hardpoint gear, p.134/135):
// "Bot Mode: Your Science (Medicine) [/ Technology (Repair)] Skill Tests cannot suffer from ↓."
// Full downshift immunity (not a capped ↓1 - RAW says "cannot suffer", the same absolute wording
// Limited Articulation's own "cannot use" gets above), scoped to the Medicine/Repair
// Specialization specifically (dataset.specializationKey, the same field the Specialization
// redesign already reads elsewhere in this file) rather than every Science/Technology roll.
// Keyed on the actor simply OWNING the gear (same "actor has this compendium Item" shape as
// actorHasPerk, helpers/perks.mjs, just scoped to type=='gear' since a Hardpoint mod isn't a
// Perk) - this system has no separate "is this Hardpoint currently installed" flag to check
// instead. The Alt Mode half ("your passengers gain an Edge...") applies to a PASSENGER's own
// roll, not this actor's - flagged, not built, since this system has no "passengers of this
// vehicle" lookup to hang it on.
const DOWNSHIFT_IMMUNITY_GEAR = [
  { id: `${TF_CRB}rUoirxlfrn2PBQwO`, skill: 'science', specialization: 'medicine' }, // Emergency Care Equipment
  { id: `${TF_CRB}xX8Ijto8a0I4jbjt`, skill: 'technology', specialization: 'repair' }, // Vehicle Repair Equipment
];

// Long Shot (Sharpshooter Focus, 1st level, p.70) - see its own check, next to the automatic
// long-range Snag it suppresses.

const LONG_RANGE_RIFLE_ID = `${TF_CRB}8Hi76APCo9QRnbLE`;

// Just the Facts (Analyst, 16th level, p.62) - see its own check, next to First Strike above (the
// non-combat-targeting infrastructure both of these share).
const JUST_THE_FACTS_ID = `${TF_CRB}v6A7mQwdKQR6J5fR`;

const DRILLING_SHOT_ID = `${TF_CRB}M0aeDLMOUTy7ju90`;
const STRONGER_TOGETHER_ID = `${TF_CRB}ZeOj3mmjnXJ7iXj1`;
// Impenetrable Armor - see its own comment below, in the checkEntries construction.
const IMPENETRABLE_ARMOR_ID = `${GI_JOE_CRB}vanN7kRYUhgHew7q`;
// Environmental Armor - see its own comment below, in the checkEntries construction.
const ENVIRONMENTAL_ARMOR_ID = `${GI_JOE_CRB}Vo5AfbJNfVGf24E0`;
const ANALYZE_TARGET_ID = `${TF_CRB}UjzBPz4iUBoi8Kyk`;
const INFORMED_ACCURACY_ID = `${TF_CRB}JtWhjDRI0HDewaKe`;
const PSYCHOANALYST_ID = `${TF_CRB}5X4NOluWwc7fv497`;
// Caution To The Wind (Outrider Focus, tf_crb, 17th level, p.86): "you can take a penalty up to
// -3 to all of your Defenses to gain an equal ↑ on a Skill Test." A numeric spend/trade on any
// Skill Test, the same shiftUp-for-a-cost idiom Size Matters' own spendSizeMatters checkbox
// already establishes (cautionToTheWindAvailable/spendCautionToTheWind below), except the "cost"
// here isn't a resource draw-down or a shiftDown on the SAME roll - it's a Defense penalty banked
// onto the actor's own next incoming attack, via the shared consumeBankedDefenseBonus primitive
// (helpers/banked-buffs.mjs) Stronger Together's own {all: -1} self-penalty half already
// established for exactly this "bank a negative defenseAmounts.all onto yourself" shape. The
// book gives no explicit duration (unlike Stronger Together's own "until the beginning of your
// next turn"), so this uses the project's already-established "very next matching roll" fallback
// (see helpers/grid-surge.mjs's own doc comment on that idiom) - consumed against the very next
// attack targeting this actor, whichever Defense it's rolled against.
const CAUTION_TO_THE_WIND_ID = `${TF_CRB}7jAU5Eg1uy9Hl1d4`;
export const CAUTION_TO_THE_WIND_FLAG = 'pendingCautionToTheWindDefense';

// Extension vetoes of the Fumble Story Point grant, fn(actor, skill) => Boolean (Agency -
// helpers/extensions/react).
export const FUMBLE_STORY_POINT_SUPPRESSORS = [];

const STUNNING_SURPRISE_ID = `${TF_CRB}6KrQp4s1o2ffGHhC`;
const WATCHFUL_EYES_ID = `${TF_CRB}RmHSzuVLnIoqeczy`;
// Knock Down, Drag Out (Prowler Focus, 20th level, p.86): "when you successfully use Stunning
// Surprise against a target at least 3 levels lower than you, your attack knocks the target
// Unconscious for 1 round." A rider on Stunning Surprise's own success block below - reuses the
// exact getEffectiveLevel(actor) - getEffectiveLevel(target) >= 3 comparison Grid Soldier's own
// comment already establishes for a "3 levels lower" gate, and helpers/timed-status.mjs's own
// applyTimedCondition for the explicit "1 round" duration (same idiom as Painmonger's Impaired).
const KNOCK_DOWN_DRAG_OUT_ID = `${TF_CRB}7VyNmcnl9DuuIKlp`;
const ANALYZE_TARGET_COUNTS_FLAG = 'analyzeTargetCounts';

// Outwit (GI Joe CRB, Battlefield Psychologist Focus, 3rd level, p.86) - see
// helpers/outwit.mjs's own doc comment. Needed here (not just in helpers/outwit.mjs/
// banked-buffs.mjs) so Inundation's own check below can mark a successfully-Outwitted target.
// Inundation (GI Joe CRB, Battlefield Psychologist Focus, 10th level, p.86) - see its own check
// near Informed Accuracy's identical-shaped counter above, and the marking step in
// _rollSkillHelper's own isOutwitAttempt post-hit block below.
const INUNDATION_ID = `${GI_JOE_CRB}Q09tkHIaVX65lokl`;
const OUTWITTED_TARGETS_FLAG = 'outwittedTargets';

// Decepticon Directive "Raider" Role Perks automated below - the "buildable now" slice of the
// categorization pass (see project plan's own PR/TF CRB-only-blind-spot writeup). Same "bare
// compendium item, code supplies the mechanic" situation as every other game line here.
const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";

// Don't Underestimate Me (PR CRB, Everyman Origin Benefit, p.30): "The first attack or contested
// Skill Test against you in any scene imposes Snag if you are aware of the aggressor." Reciprocal,
// gated by the TARGET's own once-per-scene flag (helpers/perks.mjs's scene-clock-backed
// getUsesThisScene/markUsedThisScene) - "aware of the aggressor" read as the mirror image of
// Stunning Surprise's own _isUnawareOfAttacker check. Not gated on isAttack (RAW covers any
// contested Skill Test too). This function is synchronous and can't mark the flag itself -
// reports back via dontUnderestimateMeTriggered, same "report, rollSkill() marks" shape as
// moveLikeASongTriggered.
const DONT_UNDERESTIMATE_ME_ID = "Compendium.essence20.beneath_the_helmet.Item.IIGUmCKw8O8QogvE";
const DONT_UNDERESTIMATE_ME_SCENE_FLAG = 'dontUnderestimateMeUsedThisScene';

// Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - helpers/extensions/fix3-tf/tf-fixes.mjs.

// Worth A Shot (Transformers CRB, Gunner base, 9th level, p.69): "once per scene other than
// combat, you can use a ballistic weapon as a Standard Kit of a Specialization of your choice,
// and may use Targeting instead of the normal skill a Skill Test calls for." Same shift-position-
// delta substitution shape as Cunning Plan (a Roll Options Dialog checkbox, since RAW's own "may"
// is a per-roll elective choice, not an auto-apply), folding in an isSpecialized grant from the
// same checkbox - "a Specialization of your choice" grants no numeric bonus beyond the Specialized
// die-pool mechanic itself, so which one is nominally picked makes no mechanical difference here.
// Gated on actually owning a ballistic weapon (the "Standard Kit" of one) and RAW's own explicit
// "other than combat" restriction (!game.combat). The "once per scene" cap can't actually be
// enforced OUTSIDE combat with this codebase's existing tools - hasUsedThisEncounter/
// markUsedThisEncounter are both unconditional no-ops without an active game.combat to scope the
// flag to (see perks.mjs's own doc comments) - the same already-accepted "no real cap outside
// combat" simplification this project already lives with for Adaptable/Student of Divine
// Manuals/Curb Your Enthusiasm, not a new gap. See Worth Another Shot just below for the one
// piece of this Perk that unlocks INSIDE combat, where that same tracking mechanism works fine.
const WORTH_A_SHOT_ID = "Compendium.essence20.tf_crb.Item.vy2UDq5CABjOouZm";
const WORTH_A_SHOT_COMBAT_FLAG = 'worthAShotCombatUsedThisEncounter';
// Outside combat: "once per scene" (Worth A Shot), "twice per scene" (Worth Another Shot) - Scene Clock.
const WORTH_A_SHOT_SCENE_FLAG = 'worthAShotUsesThisScene';

// Worth Another Shot (Transformers CRB, Gunner base, 14th level, p.69): "you can use Worth A Shot
// twice per scene, or once during combat." The "twice per scene" half shares the same
// unenforceable-outside-combat gap Worth A Shot's own comment above already documents (no way to
// tell 1 use from 2 without a real scene-boundary tool), so it stays undifferentiated from the
// base Perk's own already-unlimited outside-combat availability - not a new gap, just inherits the
// existing one. The "once during combat" half IS cleanly buildable: it's what actually lets
// worthAShotAvailable fire at all while game.combat is truthy (base Worth A Shot alone can't,
// matching RAW's own explicit "other than combat" scope), gated to once per encounter via the
// perfectly-suited hasUsedThisEncounter/markUsedThisEncounter pair.
const WORTH_ANOTHER_SHOT_ID = "Compendium.essence20.tf_crb.Item.x0Xnad3gsPQQmaaG";

// Straight Shooter (Transformers CRB, Gunner base, Gunslinger Focus, 3rd level, p.70): "as a Free
// action once per turn, you can gain ↑1 when using a ballistic weapon for an action that has a ↓
// on the roll." Read as "this specific roll already carries an automatic downshift" -
// combatModifiers.shiftDown (computed well before the dialog opens, see rollSkill()'s own
// combatModifiers const) is the exact signal RAW's own worked example (a Long Range Rifle's own
// Sharp alternate effect's ↓3) describes - an existing automatic penalty, not a manually-applied
// one. Gated on a ballistic weapon and once per turn via the standard hasUsedThisTurn idiom.
const STRAIGHT_SHOOTER_TF_ID = "Compendium.essence20.tf_crb.Item.I4Sy2sJIudLAeUlN";

// Pythonized (Factions in Action Vol 1: Ferocious Fighters, Restricted Battledress Upgrade, p.69):
// "You are invisible to radar location devices [dropped - no radar/detection concept exists
// anywhere in this codebase to hook a narrative-only sensor-evasion clause onto]. Additionally,
// you can give yourself Edge on Infiltration Skill Tests as a Free action." Same flat "gain Edge"
// checkbox shape as Machinist just above, scoped to Infiltration only (RAW states no cap and no
// cost) - a worn armor Upgrade Item, not a Perk, so actorHasPerk can't see it; checked the same
// "unattached armor-type Upgrade, by sourceId" way Static Slide Inhibitor/Life Supporting already
// do.
const PYTHONIZED_ID = "Compendium.essence20.ferocious_fighters.Item.CaYTsrxD2JEs2dQM";

/**
 * Whether the actor is wearing the Pythonized Battledress Upgrade - see PYTHONIZED_ID's own
 * comment above.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function hasPythonizedUpgrade(actor) {
  return !!actor.items?.some(item => item.type == 'upgrade' && item.system?.type == 'armor'
    && !item.getFlag?.('essence20', 'parentId')
    && (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == PYTHONIZED_ID);
}

// Combat Exoskeleton (Factions in Action Vol 2: Intercontinental Adventures, Battledress Upgrade,
// p.92): "You gain ↑1 to Melee Attacks and Brawn Skill Tests." A Battledress Upgrade: counts either
// on its own on the sheet (standing in for a whole worn suit, as Pythonized above) or attached to the
// armor the actor has equipped (Terrifying's shape below). Attached to unequipped armor it's off.
const COMBAT_EXOSKELETON_ID = "Compendium.essence20.intercontinental_adventures.Item.6c5vuHhqfbMJ0p1L";

/**
 * Whether the actor is wearing the Combat Exoskeleton Battledress Upgrade - see
 * COMBAT_EXOSKELETON_ID's own comment above.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function hasCombatExoskeleton(actor) {
  const equippedArmorIds = new Set((actor.items?.filter?.(i => i.type == 'armor' && i.system?.equipped) ?? []).map(i => i.id));
  return !!actor.items?.some(item => item.type == 'upgrade' && item.system?.type == 'armor'
    && (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == COMBAT_EXOSKELETON_ID
    && (!item.flags?.essence20?.parentId || equippedArmorIds.has(item.flags.essence20.parentId)));
}

// Terrifying (GI Joe CRB, Battledress Upgrade, p.156): "As a Free action, the wearer gives
// themself up 1 on Intimidation Skill Tests until the end of their turn." Unlike Combat
// Exoskeleton/Pythonized above (unattached armor-type Items standing in for a whole worn suit),
// this is an actual ATTACHED Upgrade on a piece of equipped armor - checked the "does the actor
// have this upgrade attached to their currently-equipped armor" way Mass-Reactive
// Rounds/Front-Weighted/Vicious Edges already check a weapon upgrade against its parent weapon,
// just against whichever armor Item is system.equipped instead. The "Free action"/"until the end
// of their turn" framing is dropped for the same reason Safecracker's own upshift is unconditional
// - RAW puts no cap on how often it can be used, so gating it behind a per-turn flag would only
// add bookkeeping without changing anything a player could actually do. Listed as a Roll Options
// Dialog source; skipped while its Use button's own banked ↑1 (pendingTerrifying, consumed in
// _getAutomaticCombatModifiers) is waiting, so the two never stack. The Transformers CRB reprints
// the same Upgrade (same _id, tf_crb pack), so both printings count.
const TERRIFYING_UPGRADE_IDS = [
  `${GI_JOE_CRB}tXHd0LBkVCB2QPPO`,
  "Compendium.essence20.tf_crb.Item.tXHd0LBkVCB2QPPO",
];

/**
 * Whether the actor's currently-equipped armor has the Terrifying Upgrade attached - see
 * TERRIFYING_UPGRADE_IDS's own comment above.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function hasTerrifyingUpgrade(actor) {
  const equippedArmor = actor.items?.find(actorItem => actorItem.type == 'armor' && actorItem.system.equipped);
  if (!equippedArmor) {
    return false;
  }

  return !!actor.items?.some(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == equippedArmor.id
    && TERRIFYING_UPGRADE_IDS.includes(item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource));
}

// Fast Draw (Decepticon Directive, Acquisitions Expert Focus, 3rd level, p.63): "you can access a
// one-handed weapon in one of your storage compartments and attack with it as a Standard action.
// This occurs so quickly that your target may not use their Evasion Defense against this attack."
// This project has no "weapon accessed from a storage compartment this turn" state to key off, so
// - same self-attested "player self-polices the fictional trigger" checkbox idiom Bootlicker just
// above uses - this is offered unconditionally on any weapon Attack. Unlike Fly In The Future
// (which forces Evasion when the resolved choice was Toughness), this forces the OPPOSITE
// direction: forces Toughness when the defender's resolved choice was Evasion, checked in the
// per-target defense-choice loop below (see skillRollOptions.applyFastDraw's own check there).
const FAST_DRAW_ID = "Compendium.essence20.decepticon_directive.Item.gKa6h1IXhYeWWm1e";

// Inventor (Transformers CRB, Influence Perk, p.36): "You gain an Edge on Skill Tests to use any
// technology of your own creation. Additionally, you can always ignore up to ↓1 on Skill Tests to
// use any technology you create." "Of your own creation" has no trackable game state (this
// codebase has no item-authorship/creator tracking anywhere), so - same self-attested "player
// self-polices the fictional trigger" checkbox idiom Bootlicker just above uses - offered
// unconditionally, granting both benefits together (they share the one precondition). The ↓1
// ignore reuses Eltarian Training's own Math.max(0, shiftDown - 1) idiom.
const INVENTOR_ID = "Compendium.essence20.tf_crb.Item.0A8SSXo0HkjyFcEA";

// Gutter Champion (Decepticon Directive, Influence Perk, p.26): "In any action where you are
// breaking local laws or ignoring government edicts, you gain ↑1 once each turn." Same
// self-attested checkbox idiom as Bootlicker, but with a real once-per-turn frequency cap RAW
// itself states (unlike Bootlicker's own unstated frequency).
const GUTTER_CHAMPION_ID = "Compendium.essence20.decepticon_directive.Item.pByfeAj3iyANNR68";
// Beloved (A Jump Through Time, Influence Perk, p.16, built 2026-09-12): "In any scene where you
// act on behalf of your beloved's desires, safety, or guidance, you may choose to gain ↑1 or
// remove Snag from one Skill Test per turn." (The book prints the arrow, ↑1 - an upshift, not a
// flat +1.) Same self-policed once-per-turn idiom as Gutter Champion just above, narrative
// qualifier dropped, but as a pick-one-of-two select (none / ↑1 / remove Snag) rather than a
// checkbox, since the two halves are mutually exclusive. The "remove Snag" half clears the final
// Snag after the dialog, the same "checkbox wins outright" shape Ambitious uses.
const BELOVED_ID = "Compendium.essence20.jump_through_time.Item.wXbkcyQTziLjCYEC";

// Thrillseeker (GI Joe CRB, Hang-Up, p.55): "Three times per mission, you feel the need to make
// things more difficult just to prove you can overcome. You suffer a Snag on a single Strength or
// Speed Skill Test as you make things more difficult." Unlike every other checkbox above (an
// upside the player opts into), this is a Hang-Up's own downside the player VOLUNTARILY imposes
// on themselves - same self-policed checkbox idiom, but checking it sets Snag rather than granting
// a shiftUp, and the frequency cap is a genuine COUNT (up to 3) rather than the usual once-per-
// turn/-scene boolean. This codebase has no automatic "mission" boundary at all (see
// helpers/reroll.mjs#getRerollResetBucket's own comment on the identical gap), so 'scene' - the
// widest window this project tracks automatically, wider than 'encounter' and not cleared when a
// fight ends - is the closest available approximation, via getUsesThisScene/markUsedThisScene (the
// counting scene-window sibling of hasUsedThisEncounter Green's own 3x/day counter already
// established, just exposed to the player as an opt-in choice here instead of a silent
// suppression). PREVIOUSLY used getUsesThisEncounter/markUsedThisEncounterCount, which reset this
// 3-per-MISSION cap every time a single encounter ended - wrong direction (too generous, not too
// strict), corrected here.
const THRILLSEEKER_HANGUP_ID = `${GI_JOE_CRB}7ISxvemsGVWGIzna`;
const THRILLSEEKER_SCENE_FLAG = 'thrillseekerUsedThisScene';

// Leech Siphons (Decepticon Directive, Weapon Upgrade, p.75; prerequisite: Close Combat Blade):
// "With a Critical Success hit, target loses 1 Energon Point (or 1 Strength Essence Damage if
// they have no Energon Points); wielder then gains 1 Energon Point." Same Upgrade-attachment
// check as Vicious Edges just above, but a Critical-Success-only post-hit resource transfer
// rather than a roll-time bonus, so it's threaded onto checkContext (isLeechSiphonsAttempt) for
// _rollSkillHelper's own post-hit processing below, the same "computed here, applied there" shape
// Undo Engine/Avalanche Stomp already establish. Only the Energon-drain half is built - "1
// Strength Essence Damage" when the target has no Energon is a permanent Essence-score-damage
// mechanic this codebase has no equivalent for anywhere (confirmed via grep - no essence-score
// drain/damage concept exists at all), so a target with 0 Energon simply doesn't lose anything,
// the wielder still gains their own point either way (RAW's "then gains" isn't conditioned on the
// drain succeeding).
const LEECH_SIPHONS_ID = "Compendium.essence20.decepticon_directive.Item.tn3WTWH4n1Gel5sO";

// Dirty Blows (Decepticon Directive, Brute Focus, 1st level, p.59): "With attacks within your
// natural (or weapon-augmented) reach, you gain the following alternate effect: 'Target is
// Impaired until end of their next turn.'" Free (RAW states no Shift cost, unlike Hobble/
// Crippling Blow's own declared-downshift checkboxes just above) - a plain checkbox declaring the
// chosen alternate effect for this melee attack, applied post-hit via the same
// applyTimedCondition(..., 1) "until end of their next turn" idiom Painmonger's own Impaired
// already uses. A single fixed Condition, so no picker dialog is needed the way Hobble/Crippling
// Blow's own multi-option choice requires one.
const DIRTY_BLOWS_ID = "Compendium.essence20.decepticon_directive.Item.MvPfmzW4mh7TsMJo";

// Bleed 'Em Dry (Decepticon Directive, Brute Focus, 17th level, p.59): "When you use Crippling
// Blow, you cause the target to lose 1d2 Energon Points instead of imposing a condition. If they
// can't lose Energon Points (or don't have enough to lose), they take 1d2 Strength Essence damage
// instead." A rider on Crippling Blow itself (CRIPPLING_BLOW_ID above) rather than its own
// checkbox - checked inside that same post-hit block in _rollSkillHelper, replacing the Condition
// picker with an Energon drain. Same "Only the Energon-drain half is built" limitation as Leech
// Siphons' own identical fallback just above (no Essence-score-damage mechanic exists anywhere in
// this codebase) - a target with 0 Energon Points simply loses nothing.
const BLEED_EM_DRY_ID = "Compendium.essence20.decepticon_directive.Item.oeGoFl2hwcPfMWCr";

// Ice Flechettes (Finster's Monster-Matic Cookbook, Path of Frost, 9th level, p.293) - the
// monster's own weapon Item copy (packs/fmmcitems, "Ice Flechettes" j2bXmjbKgvjzozke), rather than
// the identically-named Path of Frost Role Perk this same book also grants. The Cold damage and
// Multiple-Targets Alternate Effect are both plain compendium weaponEffect data needing no code;
// only the Critical Success rider - "the target loses all Defense bonuses provided by armor until
// the end of their next turn" - needs one, keyed on the weaponEffect Item's own identity (both its
// base and Alternate Effect variant) rather than a Perk, since this is a fixed monster attack, not
// something a PC chooses to activate. Applied via the new 'armorStripped' status (see
// helpers/config.mjs's own E20.statusEffects entry and getDefenseValue's own comment in
// helpers/combat.mjs for how it's enforced), stamped with the same applyTimedCondition(..., 1)
// "until end of their next turn" idiom used throughout this project.
const ICE_FLECHETTES_EFFECT_IDS = [
  "Compendium.essence20.finster_s_monster_matic_cookbook.Item.vMoq7coIwWqEaTFI",
  "Compendium.essence20.finster_s_monster_matic_cookbook.Item.5Y2brpJu5M8M0HV0",
];

// Avalanche Stomp (Finster's Monster-Matic Cookbook, Path of Stone, 9th level, p.296) - the
// monster's own weapon Item copy (packs/fmmcitems, "Avalanche Stomp" un2ZyMR9pDFv01iI), distinct
// from the identically-worded Path of Stone Role Perk helpers/avalanche-stomp.mjs already builds.
// This copy's Stun 2 is plain compendium weaponEffect damage data (damageType:'stun',
// damageValue:2) needing no code of its own - only the Critical Success rider ("the target is
// also knocked Prone") needs one, keyed on the weaponEffect Item's own identity the same
// ICE_FLECHETTES_EFFECT_IDS shape just above uses, rather than reusing
// helpers/avalanche-stomp.mjs#applyAvalancheStompEffect (that helper's own unconditional Stunned
// toggle is the Perk's own approximation of its separately-modeled "Stun 2" damage - redundant,
// and not what this plain weapon attack's Prone-only gap needs).
const AVALANCHE_STOMP_WEAPON_EFFECT_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.C3dsyh98mb4TDW9o";

// Grinder (Decepticon Directive, General Perk, p.67; prerequisite: Brawn d8): "While you are
// Grappling a target, as a Standard action, you can attempt a Brawn Skill Test against that
// target's Toughness. This attack has the Anti-Tank trait and deals 2 Blunt damage on a success.
// On a Critical Success, the target is also Impaired for the remainder of the scene." Same
// "declare intent via a checkbox" shape as Psychoanalyst/Coax Surrender above (a non-weaponEffect
// Skill Test still feeding the ordinary damageValue/damageType -> Apply Damage button pipeline) -
// "while Grappling" is self-policed the same unenforced-precondition way every other checkbox-
// gated Perk here already is. The Anti-Tank trait is dropped - this codebase's Anti-Tank handling
// reads a weapon Item's own traits array, and this is a bare Skill Test with no weapon Item to
// carry one. The Critical Success Impaired rider is threaded onto checkContext
// (isGrinderAttempt) for _rollSkillHelper's own post-hit processing, "for the remainder of the
// scene" landing on the same "no active expiry" idiom this project already accepts for other
// scene-long Conditions (e.g. Nemesis Drain's own identical duration just above).
const GRINDER_ID = "Compendium.essence20.decepticon_directive.Item.uUdwh8byuta9GehB";

// Exterminator (Decepticon Directive, General Perk, p.65): "When attacking a target of Common or
// Small size, you gain ↑1 and may reroll any Skill Die results of 1, as long as the target is
// smaller than you." The ↑1 half is a plain size-comparison shiftUp (same sizeOrder idiom Large
// And In Charge already establishes); the reroll half is threaded through as a new
// `smallerTarget` REROLL_CONDITIONS entry (see its own comment below) - the compendium item's own
// `system.reroll` config (mode:"ones", condition:"smallerTarget") does the rest generically.
const EXTERMINATOR_ID = "Compendium.essence20.decepticon_directive.Item.B5HgQeurLyvio1t7";

// Metallikato (Decepticon Directive, General Perk, p.66) - see helpers/metallikato.mjs's own doc
// comment for the full 4-benefit breakdown. This constant covers the armor-ignore checkbox and the
// Multiple Targets toggle's own paired ↓1 - the Multiple Targets trait grant itself lives in
// helpers/multiple-targets.mjs, the trip on a Critical Success is the item's own hit Trigger rule,
// and the reroll benefit is a bare compendium config needing no code at all.
const METALLIKATO_ID = "Compendium.essence20.decepticon_directive.Item.ouLZnb7j0kAfCrLx";

// When Push Comes To Shove (Enigma of Combination, Charger Origin Benefit, p.26): "When Pushing
// or Shoving, you are considered one Size Class larger." "Shoving" maps to the existing `grapple`
// damageType proxy already established (Wrestler/Kung Fu Grip/Experiment's own "shove" option) -
// widens the attacker-size input to the Size Class Combat Adjustment (_getSizeShift, the generic
// core rule right below) for a grapple attack specifically, capped at the top of E20.actorSizes'
// own ladder (nothing to bump into beyond the largest defined Size Class). "Pushing" (as opposed
// to Shoving specifically) has no separate mechanical trigger to check against - both read as the
// same grapple-damageType attack, the established proxy for either verb.
const WHEN_PUSH_COMES_TO_SHOVE_ID = "Compendium.essence20.enigma_of_combination.Item.SKmwkT3O5TIAVusJ";

// Programmable (Field Guide to Action and Adventure, Android Origin Benefit, p.60) - see
// updatedShiftDataset.programmableAvailable's own comment above.
const PROGRAMMABLE_ID = "Compendium.essence20.field_guide_action_adventure.Item.qPPgeJcB5BMd1jHB";

// Military Formality (Field Guide to Action & Adventure, Military Attache Focus, 6th level, p.68):
// "you can use Deception, Intimidation, or Persuasion in place of Performance. Additionally, you
// gain up to ↑3 on Deception, Intimidation, and Persuasion Skill Tests, depending on how much the
// target values formality." The "in place of Performance" half needs no code - the player can
// already just roll Deception/Intimidation/Persuasion instead of Performance whenever the fiction
// calls for it, the same "positive finding, nothing to build" category as Evasive/Megaform Trait's
// own doc comments. The "up to ↑3, GM's call" half is the same fixed-cap-3 self-attested Free
// numeric spend as Programmable just above - offered whenever one of the 3 named Skills is rolled.
const MILITARY_FORMALITY_ID = "Compendium.essence20.field_guide_action_adventure.Item.eZh6jtzHA9dhywF9";

// Evolved Instincts (A Jump Through Time, Zord Feature, p.83, prerequisite an animal/beast Zord):
// "The Zord gains +1 Evasion Defense [plain compendium Active Effect - defenses.evasion.bonus,
// needs no code] and upshift 1 on its or its driver's melee Attack rolls when fighting an enemy
// that is up to 2 size classes larger or smaller than it." Checked on whichever actor is actually
// rolling - the Zord itself, or its current driver making that same melee attack from the driver's
// seat (_getPilotedVehicle resolves "am I currently piloting a Zord" the same way Martial Zord/
// Zero-G's own driver-gated checks do) - "it" in the size comparison is always the ZORD's own size
// either way, not the driver's.
const EVOLVED_INSTINCTS_ID = "Compendium.essence20.jump_through_time.Item.fQM1keWndscbxBLJ";

// Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46) - see
// helpers/two-heads-are-better-than-one.mjs's own doc comment for the self-Lend-Assistance half
// (the ↑1 Alertness half is a plain compendium ActiveEffect, no code needed).

// Tooth And Claw - the Accurate ↑1 is a RollModifier on both printings; the damage-type half is the
// unarmed damage-type override chain below.
const TOOTH_AND_CLAW_ID = "Compendium.essence20.technorganic_secrets.Item.Z4lShGtDBa2zQ5ov";

// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38): "you gain ↑1
// on Acrobatics and Infiltration Skill Tests and are unimpeded by rough terrain. Additionally,
// choose one: Agile Reflexes (once/scene, when an attack targets your Toughness, you may use
// Evasion instead) / Innate Climber (+40ft Climb Movement while in your Alt Mode)." The flat
// shiftUp half is a plain compendium ActiveEffect; "unimpeded by rough terrain" is
// helpers/rough-terrain.mjs#ignoresRoughTerrain. Innate Climber's movement grant lives in
// documents/actor.mjs#_prepareMovement; Agile Reflexes' defenseType override is the live check
// below, in rollSkill()'s own per-target checkEntries construction (the one place defenseType is
// actually known - see this project's own tracked "defenseType known only after the dialog
// resolves" gap for why _getAutomaticCombatModifiers couldn't do this instead).
const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";
const AGILE_REFLEXES_FLAG = 'agileReflexesUsedThisEncounter';

// Ambitious (Transformers One Sourcebook, Influence Perk, p.12): "Once per scene, when attempting
// a Skill Test, you can ignore a penalty for that Test, including a Snag, Downshifts, and the
// effects of a Condition other than the Defeated Condition." A Roll Options Dialog checkbox
// (5-file pattern), once/scene, forcing the roll's own final Snag/shiftDown to nothing - the same
// "checkbox wins outright" shape Solo Shot/Observer already establish for their own Snag override,
// widened to also zero shiftDown since this Perk's own wording explicitly covers Downshifts too.
// "The effects of a Condition" isn't built - no generic "temporarily suspend a Condition's own
// mechanical effect for one roll" mechanism exists anywhere in this codebase.
// Your Safety's On (Quartermaster's Guide to Gear, General Perk, p.31) - see
// helpers/your-safetys-on.mjs's own doc comment. "On a success, the enemy's next attack suffers
// Snag" is the same unscoped bankPendingBonus shape Tender/Menacing Glare's own Snag halves
// already establish. "On a Critical Success, suffer Snag on all attacks until the end of your
// next turn" is a round-scoped window instead - same raw setFlag/read-directly shape Shining
// Leader/Rallying Cry already establish for their own 2-round windows, just Snag on the TARGET
// rather than Edge on allies.
const YOUR_SAFETYS_ON_SNAG_FLAG = 'pendingYourSafetysOnSnag';
const YOUR_SAFETYS_ON_ALL_ATTACKS_FLAG = 'yourSafetysOnAllAttacksSnag';

const AMBITIOUS_ID = "Compendium.essence20.transformers_one_sourcebook.Item.eLoPulLITRqroJu5";
const AMBITIOUS_ENCOUNTER_FLAG = 'ambitiousUsedThisEncounter';

// Isolated (Transformers One Sourcebook, Influence Perk, p.14): "Once per scene, when you make a
// Skill Test without the benefits of Lend Assistance, you can give yourself ↑1 on the Skill Test
// as a Free action." "Without the benefits of Lend Assistance" is unenforceable (this codebase
// only has a narrow Spot-triggered slice of Lend Assistance, not full tracking of every roll's own
// assistance state) - dropped, same idiom as every other narrative-qualifier flattening, leaving a
// once/scene self-declared shiftUp checkbox (the real, stated frequency cap this time, unlike
// Bootlicker/Hunter's Prowess's own unconditional grants).
const ISOLATED_ID = "Compendium.essence20.transformers_one_sourcebook.Item.DUTXCfxZP1kjh9m6";
const ISOLATED_ENCOUNTER_FLAG = 'isolatedUsedThisEncounter';

// "I remember reading about…." (PR CRB, Brainy Origin Benefit, p.23): "Once per scene, you can
// attempt a Skill Test in a Smarts-based skill as if you were Specialized in that skill." Same
// isSpecialized pre-fill idiom as Analytical/Warfighter/Genius, but a real once/scene checkbox
// (RAW's own stated frequency cap) rather than an unconditional grant, gated to Smarts-essence
// skills only.
const I_REMEMBER_READING_ABOUT_ID = "Compendium.essence20.pr_crb.Item.m3yGoT712SFkaV7W";
const I_REMEMBER_READING_ABOUT_ENCOUNTER_FLAG = 'iRememberReadingAboutUsedThisEncounter';

// We Improvise (Transformers One Sourcebook, Autonomous Bots Faction Perk, p.15): "The first time
// you roll an Initiative Skill Test in combat, add a Story Point to the team's pool." Built in
// prepareInitiativeRoll() (Initiative never rolls through rollSkill() in practice, same reasoning
// as Sirens Blaring/Prepare for War above), gated on a new once-per-encounter flag for "the first
// time" (unlike those two Perks' own unconditional every-roll grants). "At the end of combat, any
// unspent Story Points gained from this Perk are lost" isn't enforced - no per-point source
// tagging exists anywhere in this codebase to single out THESE particular points for a clawback.
const WE_IMPROVISE_ID = "Compendium.essence20.transformers_one_sourcebook.Item.qnRFb2A0sLpSg2sL";
const WE_IMPROVISE_ENCOUNTER_FLAG = 'weImproviseUsedThisEncounter';

// Sharpshooter's Grace (Transformers CRB, General Perk, p.111) - a DISTINCT compendium item from
// PR CRB's/GI Joe CRB's own identically-NAMED Perk (see SHARPSHOOTERS_GRACE_ID's own comment) -
// this book's own RAW is different, not just a third copy: the Snag-suppression half is identical
// (added alongside the other two wherever that's checked), but the +2 clause is the OPPOSITE
// direction - "↑2 on ranged attacks made at targets FARTHER than 30 feet away", not within 30 feet
// - confirmed by direct RAW extraction, not assumed from the shared name. Gets its own separate
// distance check rather than folding into the existing <=30ft block.

// Fuel Efficient (Transformers CRB, General Perk, p.109) rolls on every Energon spend, from the
// actor update hooks - helpers/extensions/resource/energon.mjs.

// Energon Efficiency (Decepticon Directive, Cybertronian Perk, p.62): "When you spend your last
// Energon Point, roll 1d6. On a 5 or higher, you regain 1 Energon Point." Same spend-site hook as
// Fuel Efficient just above, but keyed on d6>=5 and only when the pre-spend value is exactly 1 (RAW's
// own "your LAST Energon Point," not any spend).
const ENERGON_EFFICIENCY_ID = "Compendium.essence20.decepticon_directive.Item.ZtRBGtnV5HCA7zhl";

// Imaginative Engineering (Decepticon Directive, Scientist Role, p.48): "the first time each round
// that you spend an Energon Point to gain a shift on a Skill Test, you instead gain ↑2." Hooks the
// same generic Energon-for-a-shift spend site FUEL_EFFICIENT_ID's own comment above identifies
// (rollSkill()'s own spendEnergon branch), gated once per round with the standard
// hasUsedThisRound/markUsedThisRound ledger (helpers/perks.mjs) - same shape as Strike Bonus/Alpha
// Strike's own once-per-round upgrades elsewhere in this file.
const IMAGINATIVE_ENGINEERING_ID = "Compendium.essence20.decepticon_directive.Item.DWWXdrhaWMDnNhNQ";
const IMAGINATIVE_ENGINEERING_ROUND_FLAG = 'imaginativeEngineeringUsedThisRound';

// Two Steps to the Right (Enigma of Combination, Surveyor Focus, 10th level, p.36) - shares Lay
// of the Land's own benefits (both halves) with allies within 60ft. See its own checks below and
// next to the Cover shift-down above.
const TWO_STEPS_TO_THE_RIGHT_ID = "Compendium.essence20.enigma_of_combination.Item.a5xcpj3rHW5EW354";

// Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99) - see helpers/bulwark.mjs's own doc comment
// and _hasNearbyBulwarkCover's own comment below for the "provide cover to adjacent allies" half.
const BULWARK_ID = `${GI_JOE_CRB}7758n3XWOzhSjdOk`;

// Raze and Ruin (Raider, Siegemaster Focus, 20th level, p.64) - see its own
// _applyRazeAndRuinDamage doc comment.
const RAZE_AND_RUIN_ID = `${DECEPTICON_DIRECTIVE}eYvcwtOPZ1Pt8q9X`;

// Hobble (Raider, Acquisitions Expert Focus, 20th level, p.63) - see its own checks above (the
// Roll Options Dialog checkbox) and in _rollSkillHelper (the post-hit Condition picker).
const HOBBLE_ID = `${DECEPTICON_DIRECTIVE}TG0CSb60LTv7jNyv`;

// Guardian Strikes (A Jump Through Time, Grid Power, p.57): "Whenever attacking a target of Large
// size or smaller with a two-handed melee weapon, you may choose to inflict no damage when you
// hit. Instead, you may impose one of the following conditions: Impaired, Prone, or Restrained
// until the beginning of your next turn." The "Large size or smaller" qualifier is left to the
// player to self-police (the same idiom Aiming/Long Shot's own narrower narrative qualifiers
// already use) rather than adding a target-size gate to the checkbox availability - two-handed
// (item.system.numHands == 2, the same field Weapon Conversion's own build-time edit already
// established as real and usable) is the only mechanically-checkable half.
const GUARDIAN_STRIKES_ID = "Compendium.essence20.jump_through_time.Item.U2Xj1jrRS4AP3uGd";

// Penetrating Aim (Raider, Siegemaster Focus, 1st level, p.63) - see its own checks above (the
// Roll Options Dialog checkbox) and in the checkEntries per-target difficulty loop.
const PENETRATING_AIM_ID = `${DECEPTICON_DIRECTIVE}Ill7m9IwlyXY0FMe`;

// Nowhere to Run (Decepticon Directive, Gunner Replacement Perk, 9th level, p.45): "when you take
// a Free action to aim, you can forgo the ↑1 bonus to instead ignore the Snag penalty imposed
// from firing a weapon beyond its normal range. If you would already ignore this penalty..., you
// gain Edge on the attack." Same "narrative precondition dropped, granted whenever the Perk is
// held" simplification this codebase already applies to Long Shot/Sharpshooter's Grace's own
// identical long-range-Snag suppression just below (this doesn't actually forgo the separate Aim
// ↑1 bonus either, matching Penetrating Aim's own established precedent of not enforcing that same
// forgo clause) - added to that same suppression list, plus a check for the Edge upgrade when the
// Snag was already being ignored some other way.
const NOWHERE_TO_RUN_ID = `${DECEPTICON_DIRECTIVE}SyYuTRXeaZy4De3B`;

// Vantage Point (Raider, Siegemaster Focus, 6th level, p.64) - see its own elevation check above.
const VANTAGE_POINT_ID = `${DECEPTICON_DIRECTIVE}j8s0vIsIEUJzAAvy`;

// As Above (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 6th level, p.28): "you gain
// Edge on ranged attacks made from higher ground than your target." Same TokenDocument#elevation
// comparison Vantage Point already establishes, just with no 30ft-or-more floor (any elevation
// advantage qualifies) and a self-status Edge instead of a shiftUp. "This applies whether or not
// you're in a vehicle" needs no extra check - elevation is read straight off the token either way.
const AS_ABOVE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QAOI7O3yVmmMpFEu";

// So Below (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 6th level, p.28): "ranged
// attacks made from higher ground than you suffer ↓1. This applies whether or not you're in a
// vehicle." The reciprocal of As Above - checked against the TARGET (the So Below holder being
// attacked) rather than the attacker, same "checked on the attacker's side, gated on the target
// holding the Perk" shape Indomitable's own Intimidation-Snag reciprocal already establishes.
const SO_BELOW_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.MlEYEVW4YXT4P0sP";

// My Little Pony CRB Role Perks automated below - the "buildable now" slice of the Spirit of
// Generosity/Honesty/Kindness/Loyalty/Magic categorization pass (Spirit of Laughter was already
// fully built in an earlier pass). Same "bare compendium item, code supplies the mechanic"
// situation as every other game line here.
const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";
const ENERGY_BEAM_ID = `${MLP_CRB}tQHr5bWsrkrm1ZHZ`;
const LANCING_BEAM_ID = `${MLP_CRB}MaHixiXm7JuS1tCq`;
const EXPLOSIVE_BEAM_ID = `${MLP_CRB}VLdz7YvUq2AaUFNz`;
const BARRELING_BEAM_ID = `${MLP_CRB}FpQsQ0FCBFGHThQV`;
const BEAM_VOLLEY_ID = `${MLP_CRB}UhkhFqFDYjub1a8k`;
const MIND_BEAM_ID = `${MLP_CRB}gF8otV8Ag9axRp2Z`;

const PANACEA_ID = `${MLP_CRB}q2rDpOJq7d5xyMia`;
const FLUTTERY_WINGS_ID = `${MLP_CRB}HO82viVmbKgmCAts`;
const LIGHTNING_SPEED_ID = `${MLP_CRB}trENOkDUbjra0BEN`;
// Summon Armor / Summon Shield - see helpers/summon-armor.mjs's own doc comment.
const SUMMON_ARMOR_ID = `${MLP_CRB}VsUNcBtDmFmD1J6H`;
const SUMMON_SHIELD_ID = `${MLP_CRB}XLRCF0VI1D9VZhkv`;

// Misled (MLP CRB, Mentor Influence Hang-Up, p.53) - see its own consumption check above.
const MISLED_HANGUP_ID = `${MLP_CRB}PkbtskVfOkyz7Nty`;
const MISLED_SHIFT_DOWN_FLAG = 'pendingMisledShiftDown';
// Don't-Notice-Me-Field - see helpers/dont-notice-me-field.mjs's own doc comment.
const DONT_NOTICE_ME_FIELD_ID = `${MLP_CRB}JCt7GIYBonchb4TV`;

// Sadistic (Decepticon Directive, Hang-Up, p.31): "You suffer ↓1 on any attack that doesn't target
// the foe suffering from the most Conditions." "The foe" is read across every enemy actually in
// the scene (getNearbyEnemyTokens with an unbounded radius - RAW names no range, and this system
// has no other way to enumerate "every foe" than a token-disposition scan), compared by
// target.statuses.size the same way Cruel's own "one or more Conditions" check already reads a
// live Condition count. A tie for the most Conditions doesn't penalize either tied foe - RAW's own
// wording is "the foe", but attacking either one is still attacking A foe with the most Conditions.
const SADISTIC_HANGUP_ID = "Compendium.essence20.decepticon_directive.Item.a7ch8kMSbxLSxbAB";

// Extension Initiative rules, async fn(actor, skillRollOptions) - mutate the dialog's options
// (helpers/extensions/situational2/initiative.mjs).
export const INITIATIVE_EXTENSIONS = [];

const HONEST_ASSESSMENT_ID = `${MLP_CRB}eIDYxShici5rRpg3`;

// Agency (Across the Stars, Influence Perk, p.42, RE-CATEGORIZED 2026-09-15 out of a 17-item
// narrative bucket that was never individually RAW-verified): "You gain Edge on the Skill
// associated with your agency... your Wealth Tests may never use a die of a lesser value than the
// Skill Rank of your agency's Skill." Same choiceType:'skills' + system.choice shape as Eltarian
// Observer for the Edge half (built alongside that check below); the Wealth-floor half lives
// earlier in this function, alongside Jacket Wrestler's own shift-substitution. The Hang-Up
// ("when you Fumble in your agency's Skill, you don't generate a Story Point") has nothing to
// suppress - this codebase doesn't automate the base "Fumble grants a Story Point" core rule
// anywhere yet (the same already-flagged gap blocking Academic Studies' own Fumble-doubling half),
// so it stays unbuilt for the same reason, not a new one.
const AGENCY_ID = "Compendium.essence20.across_the_stars.Item.bGKG7artYs7uHHz4";

// Surgical Operators (Ferocious Fighters, Anti-Venom Task Force Faction Perk, p.72) - a Roll
// Options Dialog switch in helpers/extensions/fix3-gij/gij-fixes.mjs.

// Percussive Maintenance (Technorganic Secrets, General Perk, p.46): "Technology is a Strength
// Essence Skill for you in addition to a Smarts Essence Skill" (already a plain compendium Active
// Effect on this Item - system.skills.technology.essences.strength). "In addition, when you get a
// Critical Success on a Technology Skill Test to repair a device, you may roll with an Edge the
// next time you use that device." "That device" is approximated as "your own next Technology
// Skill Test" - this codebase has no per-item device-use tracking to scope a bank to one specific
// Item, the same closest-existing-mechanism idiom this project already accepts elsewhere (e.g.
// Adventurer/Scientific Method's own unscoped-by-target banks). Banked on a Critical Success
// (multiplier >= 2, this system's own Degrees-of-Success proxy) in the results.map() section below
// - see PENDING_PERCUSSIVE_MAINTENANCE_FLAG's own bank site - consumed here on the very next
// Technology roll, same scoped-consumption shape as Inner Magic/Terrifying above.
const PERCUSSIVE_MAINTENANCE_ID = "Compendium.essence20.technorganic_secrets.Item.qZ7QX3nEt6C1blcj";
const PENDING_PERCUSSIVE_MAINTENANCE_FLAG = 'pendingPercussiveMaintenance';

// Down the Barrel (Decepticon Directive, Triggerbot Focus, 3rd level, p.49): "you gain Edge on
// all Intimidation and Persuasion Skill Tests when you are wielding your favorite weapon." Reads
// the Favorite Weapon choice back via helpers/favorite-weapon.mjs's own getFavoriteWeaponItem() -
// "wielding" reads as that weapon's own system.equipped flag, the same equipped-weapon idiom
// Linked/Wait For An Opening already establish elsewhere in this file.
const DOWN_THE_BARREL_ID = "Compendium.essence20.decepticon_directive.Item.U5vb2NBZG6F6SgK1";

// Ricochet (Decepticon Directive, Triggerbot Focus, 17th level, p.49): "once per turn when making
// an attack using your favorite weapon, you can angle your shot so it comes at your target
// unexpectedly. By taking a ↓1 penalty to the attack, you can target an enemy that you are aware
// of but don't have line of sight on; if this attack hits, it deals 1 additional damage." This
// codebase has no line-of-sight concept to gate targeting on in the first place (every other
// unenforceable-qualifier Perk here - e.g. Something To Prove above - just grants the upside
// unconditionally), so the only real mechanical content is the player-declared trade: a Roll
// Options Dialog checkbox (updatedShiftDataset.ricochetAvailable/skillRollOptions.applyRicochet,
// the same "player's own honor-system confirmation" shape Precision Aim's own checkbox already
// establishes) that adds ↓1 to the attack and +1 damage on a hit, gated once per turn via the
// standard hasUsedThisTurn/markUsedThisTurn idiom.
const RICOCHET_ID = "Compendium.essence20.decepticon_directive.Item.4D98PWVya8KJ9Pna";
const RICOCHET_TURN_FLAG = 'ricochetUsedThisTurn';

// Size Matters (Decepticon Directive, Siege Focus, 3rd level, p.64): "when you make a ranged
// attack against an object that is larger than you, you can forgo any number of upshifts to deal
// additional damage. For each ↑1 you trade in, you deal 1 additional damage. This Perk also
// functions against larger creatures, but you must trade in ↑2 for 1 additional damage." A
// numeric Roll Options Dialog trade (spendSizeMatters/sizeMattersAvailable), the same "spend a
// number, mutate skillRollOptions before the roll" shape Demolition Driver's own shiftDown-for-
// damage trade already establishes, applied to shiftUp instead.
const SIZE_MATTERS_ID = "Compendium.essence20.decepticon_directive.Item.soK9eLazbNwtVbLu";

// Voidshield (Across the Stars, Zord Feature, p.104): "Attacks with the Void trait no longer ignore
// bonuses to your Zord's armor" - switches off voidIgnoresArmor for a target holding it (its Resistance
// to Void half is a plain compendium Active Effect). A `feature`-type Item, so the same plain sourceId
// lookup as hasHardTreadWheels() just below rather than actorHasPerk.
const VOIDSHIELD_ID = "Compendium.essence20.across_the_stars.Item.6VOeIAu2XaPGV78P";

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasVoidshield(actor) {
  return !!actor?.items?.some(i => (i.flags?.core?.sourceId ?? i._stats?.compendiumSource ?? i?.flags?.essence20?.rulesSource) == VOIDSHIELD_ID);
}

// Animal (GI Joe CRB, pet General Perk, p.165): as a wild/feral pet, Persuasion and Deception
// Skill Tests targeting the holder gain a Snag - same unconditional reciprocal-target-Snag shape
// as Skeptic's own Influence half just above, just covering both Social skills at once. My Little
// Pony and Welcome to Night Vale print the same Perk (their pets get their own copy), so every
// printing counts.
// Psycho Slinger (Finster's Monster-Matic Cookbook p.302): "1 Void damage per 2 hits", with
// Multiple Attacks (4). Each attack is its own roll, so the hits are tallied per target on the
// attacker (PER_TWO_HITS_FLAG) and only every second hit on the same target deals the damage - see
// Dice#_applyPerTwoHits. Matched by the effect's compendium source, or the d21PerTwoHits flag the
// compendium effect carries (so any other "per 2 hits" effect can opt in the same way).
const PER_TWO_HITS_EFFECT_IDS = ["Compendium.essence20.finster_s_monster_matic_cookbook.Item.4rdWupth6TFqQFeP"];
const PER_TWO_HITS_FLAG = 'perTwoHitsTally';
function isPerTwoHitsEffect(item) {
  return !!item?.flags?.essence20?.d21PerTwoHits
    || PER_TWO_HITS_EFFECT_IDS.includes(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource);
}

const ANIMAL_IDS = [
  "Compendium.essence20.gi_joe_crb.Item.YeGzq0XETdv7LeBn",
  "Compendium.essence20.mlp_crb.Item.oCYovZheSrNIvrti",
  "Compendium.essence20.wtnv_citizens_guide.Item.xNiPMhVMQQUzlRg8",
];

// Martial Artist (PR CRB, Hang-Up, p.70 / GI Joe CRB, Hang-Up, p.50) - a Roll Options Dialog
// switch on the roller's side (only goading rolls qualify): an incoming item rule on the Hang-Up.

// Trustworthy (Honesty, 2nd level, p.78) - the roller's own half (Deception always fails), next to
// Just the Facts' own Immune-half idiom it reuses. Its +4 Cleverness half is a Defense rule on the item.
const TRUSTWORTHY_ID = `${MLP_CRB}oPMDDfBeK9VibPvW`;

// Stay Humble (Honesty, 9th level, p.78): "when you fail a Persuasion Skill Test, you gain a
// Friendship Point." A reactive trigger (unlike Curb Your Enthusiasm's own "Use" button - see
// helpers/banked-buffs.mjs's own CURB_YOUR_ENTHUSIASM_ID comment) - flagged onto checkContext
// here (a fact about the roll about to happen) and granted per-result once the roll actually
// resolves, in _rollSkillHelper below, the same "flag now, act on it once resolved" shape
// isSpotAttempt uses. Any failed result on a Persuasion roll counts, even a multi-target one.
const STAY_HUMBLE_ID = `${MLP_CRB}awEvTH8rrDeqL2Oo`;

// Snarl (Ferocious Fighters, Tiger Force General Perk, p.37; prerequisite: Intimidation +d6):
// "You can target a creature's Willpower or Cleverness with an Intimidation Skill Test as a
// Standard action. On a success, they become Frightened of you for 1 turn." The Willpower-or-
// Cleverness choice needs no new code - the existing "Roll vs Target Defense" dropdown already
// lets any roll compare against either Defense freely, no restriction needed. Auto-detected via
// rolledSkill=='intimidation' + actorHasPerk (same idiom as Stay Humble just above), not a
// checkbox or "Use" button - RAW's own action-cost qualifier is the same unenforced
// simplification every other Standard-action-gated Perk in this project already accepts.
const SNARL_ID = "Compendium.essence20.ferocious_fighters.Item.786NTb2bQyHZ7qfg";

// Might Makes Right (Decepticon Directive, General Perk, p.68): "Persuasion is a Strength Essence
// skill for you in addition to a Social Essence skill" (a plain skills.persuasion.essences.strength
// compendium Active Effect, no code needed) "Additionally, when you get a Critical Success with a
// Persuasion Skill Test, you can impose the Frightened condition on the target or targets for 1
// minute." Unlike Snarl's own plain "on a success" - this needs the actual Critical Success
// (result.multiplier >= 2, the same Degrees-of-Success proxy Barreling Beam's identical clause
// already establishes), and applies per-target rather than to a single roll-wide target, since
// RAW explicitly allows "targets" (plural) on a broadcast Persuasion roll.
const MIGHT_MAKES_RIGHT_ID = "Compendium.essence20.decepticon_directive.Item.lIiVbzESbPpV7Egu";

// Dinobot (Technorganic Secrets, Influence Perk, p.28): "Choose a Brawn or Survival
// Specialization, whether or not you invested in that Specialization. You gain an Edge on Skill
// Tests when that Specialization comes into play." Same choiceType:'skills' + system.choice shape
// as Specialist/Rocket Scientist above - "whether or not you invested" means the Edge applies
// even without rolling as Specialized, so this checks the chosen skill directly rather than
// skillRollOptions.isSpecialized; "when that Specialization comes into play" (the specific
// flavor, e.g. "Survival (Desert)") is dropped the same unenforceable-narrative-qualifier way
// Specialist's own "must already be Specialized" precondition already is.
// Built as a Roll Options Dialog switch in helpers/extensions/fix3-tf/tf-fixes.mjs.

// Maximal (Technorganic Secrets, Influence Perk, p.26) - same shape as Dinobot just above,
// restricted to Persuasion/Science/Technology instead.
// Built as a Roll Options Dialog switch in helpers/extensions/fix3-tf/tf-fixes.mjs.

// Predacon (Technorganic Secrets, Influence Perk, p.27): same choice-Edge shape as Dinobot/Maximal
// above, restricted to Intimidation only - plus its own second clause: "If you Intimidate a foe
// in a conflict scene, they gain the Frightened Condition until the end of their next turn."
// "Conflict scene" maps onto game.combat existing, the same idiom this project already uses for
// "combat" elsewhere; applied in _rollSkillHelper's post-hit loop, same unconditional
// single-target Frightened shape as Snarl's own identical clause.
const PREDACON_ID = "Compendium.essence20.technorganic_secrets.Item.jRD6G5Z6eblTvxeO";

// Force (Heavy Hitter Influence, p.51): "If you make a successful unarmed attack using Might, you
// may do an additional point of Health damage. But using this ability is exhausting so you may
// only use it once per scene." Fleeting Energy (its own paired Hang-Up, p.51): "After you use the
// Heavy Hitter Influence's Force Perk, you suffer ↓1 on Strength based Skill Tests until the end
// of your next turn." Once/scene approximated via hasUsedThisEncounter (always available outside
// combat, the same accepted looseness Specialist's own doc comment already establishes) - "unarmed"
// detected via no parent weapon Item, the same proxy Phantom Ranger Prime/Power Adaptation's own
// unarmed clauses already use.
const FORCE_ID = `${MLP_CRB}p4qXDtj2RCJcibCh`;
// The penalty belongs to the Hang-Up, not to Force itself - a Force user without Fleeting Energy
// (or ignoring it via Matured) never banks it.
const FLEETING_ENERGY_HANGUP_ID = `${MLP_CRB}PblwqCeE7Zyb3jF4`;

// Shoots and Scores (Sporty Influence, p.60): "When you achieve Critical Success at an Athletics
// Skill Test, you gain a Friendship point." A reactive trigger flagged onto checkContext and
// applied once the roll actually resolves - same "flag now, act on it once resolved" shape
// Stay Humble's own STAY_HUMBLE_ID already establishes, just on a Critical Success (multiplier >=
// 2) instead of a failure.
const SHOOTS_AND_SCORES_ID = `${MLP_CRB}ciWHdEjMnqAxBkZi`;
// Vibrating Palm (Factions in Action Vol. 2, Arashikage General Perk, p.31, prerequisite Level
// 18): "Once per mission, if you Critically Succeed with an unarmed Attack, you gain a Story
// Point. At any time during the mission, you can spend a Story Point to inflict massive damage on
// your target, instantly depleting their remaining Health and rendering them Defeated even if
// they are a thousand miles away." RE-CATEGORIZED - previously tagged "no delayed/timed-trigger
// effect mechanism," guessed from the Perk's own flavor text ("bring death long after the actual
// Attack has occurred") rather than its real mechanical text, which has no delay at all: a plain
// Critical-Success Story Point grant (same shape as Shoots and Scores above, just gated on an
// unarmed Attack and once per mission instead of per scene) paired with an anytime "spend a Story
// Point to instantly Defeat your current target" Use button (helpers/vibrating-palm.mjs) - "even
// a thousand miles away" is the same unenforceable range-widening this project already
// approximates via whatever's currently targeted everywhere else. "Once per mission" has no
// matching primitive, approximated down to once per encounter, this project's usual idiom for a
// cap broader than what's trackable. RAW's own "work with your GM to determine whether it kills
// or merely affects their physiology" is a narrative distinction with no mechanical difference
// (Health 0 + Defeated either way) - left entirely to table talk, not something to encode.
const VIBRATING_PALM_ID = "Compendium.essence20.intercontinental_adventures.Item.L98MDWiqeH8fp2Fz";
const VIBRATING_PALM_GRANT_ENCOUNTER_FLAG = 'vibratingPalmGrantedThisEncounter';
// You Can Do It, Too! (A Jump Through Time, Inspiring Origin Benefit, p.27, built 2026-09-12):
// "Anytime you roll a Critical Success on a Skill Test, you give a +1 bonus to the first Skill
// Test each ally or teammate performs until the beginning of your next turn." Unlike Superb
// Soloist (a button-click broadcast), this fires passively off the HOLDER'S OWN roll outcome -
// same Critical Success detection (multiplier >= 2) as Shoots and Scores above, banking a
// fixedShiftUp onto every nearby ally (bankPendingBonus, same broadcast shape Superb Soloist's own
// "Use" button establishes) rather than being gated behind a button. "Until the beginning of your
// next turn" is approximated as "their own next roll," this project's usual duration idiom.
const YOU_CAN_DO_IT_TOO_ID = "Compendium.essence20.jump_through_time.Item.o7Yn4EXPvYywe5AZ";

// 'Til All Are One (Enigma of Combination, Origin Benefit, p.28): "Once per scene, when you roll a
// Critical Success on a Skill Test, the team gains a Story Point." Same "flag now, act on it once
// resolved" shape as Shoots and Scores above, just any Skill Test instead of one scoped skill, and
// once per scene instead of unlimited. "The team" is this project's own shared world Story Points
// pool (requestStoryPointGrant), the same resource MLP's own "Friendship Point" already relabels.
const TIL_ALL_ARE_ONE_ID = "Compendium.essence20.enigma_of_combination.Item.GHuWfqHhMaskG4hT";

// Outfoxed (Tricky Hang-Up, p.63): "When you fail an Infiltration Skill Test against another
// creature, that creature gains Edge on Skill Tests against you for the next round." A reactive
// trigger on a FAILED Infiltration roll - flagged onto checkContext and, on failure, banks an Edge
// for the opposing target scoped to this specific actor (the same "self-Edge scoped to one
// specific other actor" shape Menacing Glare's own Edge effect already established, just banked on
// the TARGET against the FAILING actor instead of the other way around).
const OUTFOXED_ID = `${MLP_CRB}30WB5sRAQ3zhLmsz`;
const OUTFOXED_EDGE_FLAG = 'pendingOutfoxedEdge';

// Bait and Switch (Tricky Influence, p.63): "You may spend a Friendship Point to get your allies to
// help you distract and confuse onlookers. If you do, you gain Edge on any Deception or
// Infiltration Skill Tests you make until your next turn." Dispatched as a "Use" button
// (helpers/banked-buffs.mjs) - spends 1 Story Point (MLP's own Friendship Point relabel) and banks
// an unscoped-by-target Edge, consumed on the actor's own next Deception or Infiltration roll.

const KNIGHTS_OF_CANTERLOT = "Compendium.essence20.knights_of_canterlot.Item.";

const DARK_SKIES_OVER_EQUESTRIA = "Compendium.essence20.dark_skies_over_equestria.Item.";
const DSOE_DISGUISE_ID = `${DARK_SKIES_OVER_EQUESTRIA}N8kMxo82Rot2xMMU`;

const KNIGHTS_OF_CANTERLOT_SPELLS = "Compendium.essence20.knights_of_canterlot.Item.";
const KOC_FIREBALL_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}zlERIywyKQNBQzs6`;
const KOC_PACK_MULE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}Ysyt5rIcVK42NHPp`;
const KOC_HOT_TO_TROT_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}V6hbpi3LsDjyJXyW`;
const KOC_GLOW_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}pGXJEVMqygJhFDgn`;
const KOC_GREASED_LIGHTNING_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}vXYDWGbhhIBOx1Ic`;
const KOC_SPARKLE_BLAST_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}fZV6bakLGTEcHVst`;

// Sgt Slaughter Sourcebook automation pass (2026-09-12) - each constant's own check below carries
// its own RAW quote and reasoning; grouped here just to keep the compendium IDs in one place, same
// idiom the Transformers Tier 2 batch already established above.
const SGT_SLAUGHTER_SOURCEBOOK = "Compendium.essence20.sgt_slaughter_sourcebook.Item.";

// On Your Feet (Drill Instructor Focus, Officer, 3rd level, p.10): "you and your allies gain Edge
// on Initiative Skill Tests." No RAW-stated range - treated as a passive, unconditional party-wide
// grant (the same "unscoped when RAW doesn't name a distance" idiom Stand Behind Me's own 60ft
// clause is the exception to, not the rule - most of this project's unscoped Perks default to no
// radius restriction at all, e.g. Prepare for War/Ready For Anything's own self-only shape widened
// here to nearby allies too). The holder's own Edge is the item's rule; an ally holding it is
// checked from the ROLLER's own Initiative prep, same as Iconoclast/Two Steps to the Right's own
// nearby-ally scans.
const ON_YOUR_FEET_ID = `${SGT_SLAUGHTER_SOURCEBOOK}4qibn7JQ1lHTe9gT`;

// Oorah! (Slaughter's Marauders Faction Perk, p.15): "Every member of Slaughter's Marauders gains
// the following benefits: • Qualified in all Standard weapons, and the silent battledress upgrade.
// • Qualified with Land vehicles and roll Driving Skill Tests to drive Land vehicles without a
// Snag even if you have no Ranks in the Driving skill. • +1 Toughness and +1 Willpower. • Edge on
// Infiltration Skill Tests, and deal +1 damage when you successfully Attack a Surprised target."
// The +1 Toughness/+1 Willpower clause was already a correct, enabled compendium Active Effect
// before this pass - confirmed by reading the JSON directly, nothing to fix there. The Land-
// vehicle-qualification clause is the exact "Qualified... roll Driving without a Snag, ↑1 if you
// have Ranks" wording VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE already handles generically -
// a trivial ID-table append (see that table's own comment). "Qualified in all Standard weapons +
// silent battledress" hits the same per-specific-item-Qualified schema gap Trade Goods/Good To Go
// already established - Needs new infrastructure, not built. OORAH_ID itself is declared earlier,
// alongside VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE, which it's appended to.

// Catch Off Guard (Marauder Focus, Vanguard, 1st level, p.15): "When you successfully Attack a
// surprised target, you deal Stun 1 in addition to the normal effects of the Attack. If the normal
// effect is Stun 1, you deal Stun 2." Checked post-hit against the target's own Surprised status -
// this codebase has no dedicated "Surprised" Condition (confirmed absent from E20.statusEffects,
// same gap this project has already flagged for Exploit Trust/Prepare for War's own "not
// Surprised" qualifiers) - approximated as the target not yet having acted this combat, the same
// "Surprised" proxy First Strike's own turn-order check already establishes for an identical gap.
const CATCH_OFF_GUARD_ID = `${SGT_SLAUGHTER_SOURCEBOOK}qplsg3JI3kmUCtU9`;

// Rumble in the Jungle (Sgt Slaughter Sourcebook, Marauder Focus, 17th level, RAW-verified
// 2026-09-15 via the book's own cached text - this row had sat flagged "not yet individually
// triaged"): "when you Attack a Surprised enemy with a weapon that does not have the Silent
// trait, roll your Intimidation Skill Die as well as the Skill Die you are Attacking with. This
// bonus Skill Die works like when you roll a Skill Test with Specialization. If you are
// Specialized in the skill you used for the Attack, you gain this bonus Skill Die in addition to
// your Specialization Dice."
//
// The first Perk in this project to add an EXTRA die into the roll's own kept-highest pool. Both
// halves of RAW's own wording fall out of _getFormula's existing two branches: an ordinary attack
// becomes a two-die {attackDie, intimidationDie}kh pool (it wasn't a pool at all before), and a
// Specialized attack appends the Intimidation die onto the staircase it already builds - exactly
// RAW's "in addition to your Specialization Dice". Reuses the same "target hasn't acted yet this
// combat" Surprised proxy Oorah!/Catch Off Guard already share, and the same parent-weapon trait
// lookup Silent Weapon Expertise's own check uses.
const RUMBLE_IN_THE_JUNGLE_ID = `${SGT_SLAUGHTER_SOURCEBOOK}mMT0yiFOtiiD32hI`;

// Burly (Marauder Focus, Vanguard, 6th level, p.15) / Rolling Thunder (10th level, p.15): "When
// not in a vehicle, and unarmored or in Light Armor, you gain ↑1 on Animal Handling, Intimidation,
// and Persuasion Skill Tests." Rolling Thunder: "you gain the benefits of Burly even when you're
// in a vehicle. Additionally, increase the bonus by ↑1 for each Size Class you or your vehicle are
// larger than the target." Checked together since Rolling Thunder is a strict widening of Burly's
// own gate, not a separate mechanic - Burly's own "not in a vehicle" restriction is bypassed
// entirely once Rolling Thunder is held (checked via actorHasPerk on either ID), and the
// Size-Class scaling only applies once actually in a vehicle - RAW's own "you or your vehicle"
// wording is read as the LARGER of the actor's own Size Class or (while piloting) their vehicle's,
// via the same E20.actorSizes ordered-ladder index compare _getSizeShift/Giant-Killer already use.
const BURLY_ID = `${SGT_SLAUGHTER_SOURCEBOOK}NLwbluyB9dtHMTlT`;
const ROLLING_THUNDER_ID = `${SGT_SLAUGHTER_SOURCEBOOK}O5vyi2mvtWAtkE92`;
const BURLY_SKILLS = ['animalHandling', 'intimidation', 'persuasion'];
const KOC_MYSTERY_SENSE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}UUGqwGOps0Z2exEH`;
const KOC_GLITTERMANE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}WACDOLg6uFWlr2lc`;
const KOC_OOKIE_SPOOKIES_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}JF7xsi8GtT4bCfWm`;
const KOC_FOOLSCARROT_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}doF1rRuMXaeAPDTl`;
const KOC_SCAREFYING_APPEARANCE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}110Rq0wQaqFuugUc`;
const KOC_BLOCK_MAGIC_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}J1jUwu4IIuPxQE10`;

// Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (Knights of Canterlot, Magic
// Baubles, p.52) - see helpers/size-change-potions.mjs's own doc comment. Same KOC compendium as
// the spells above, since a Magic Bauble is authored in the same pack as this game line's spells.
const KOC_MASSIVE_MUG_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}YMC3WoSkJ11jrwUn`;
const KOC_PETITE_PONYS_SHRINK_DRINK_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}BrMqHsZVG2OOo21W`;

// Pointy (General Perk, p.21): "Manifest sharp claws or teeth as a Free action, lasting until the
// end of the combat scene. The weapon grants ↑1 on attacks, and does Sharp damage." A toggle (see
// helpers/pointy.mjs's own doc comment, same on/off shape as Dig In) - only the ↑1 shiftUp half on
// an unarmed attack is built (same "no parent weapon" proxy as Iron Hooves/Phantom Ranger Prime);
// forcing the attack's own damageType to 'sharp' isn't - no existing Perk in this project
// overrides a weaponEffect's own fixed damageType field, and doing so here would be a new,
// separately-risky precedent rather than a small addition.

// Calm Hearted (General Perk, p.43): "Once per session, you may roll with Edge on any single
// Social test relating to keeping their emotions in check." "Relating to keeping emotions in
// check" is dropped (unenforceable narrative qualifier) - a "Use" button (helpers/banked-buffs.mjs)
// banks an Edge scoped to the Social Essence broadly (not one specific Skill, since RAW says "any
// single Social test"), once per scene via hasUsedThisEncounter.

// Different Perspective (Outsider Influence, p.19): "you gain ↑1 on Smarts- and Social Skill
// Tests if your Culture Skill is equal to or higher than the Skill you're rolling." "When
// interacting with those from a different culture" is dropped (unenforceable). Compares the two
// skills' own shift positions in E20.skillShiftList (best-to-worst order, so a LOWER index is a
// BETTER die) - "Culture equal to or higher" means Culture's own index is <= the rolled skill's.
const DIFFERENT_PERSPECTIVE_ID = `${DARK_SKIES_OVER_EQUESTRIA}Q4npyOz8iYHHy2LV`;

const WTNV_CITIZENS_GUIDE = "Compendium.essence20.wtnv_citizens_guide.Item.";

// It's Right There (Outsider Origin, p.30/32) - see its own Fumble-grant check above.
const ITS_RIGHT_THERE_ID = `${WTNV_CITIZENS_GUIDE}PHg5CJEy13v6G7a1`;

// University Days (General Perk, p.53): "you may determine your Free actions with your Smarts
// Essence instead of your Speed Essence." Verbatim identical shape to Quick Thinker (MLP CRB) -
// see helpers/actor.mjs#getNumActions, extended to also check this Perk.

// Static Electricity (General Perk, p.51, Weird +d6 prereq): "+2 Evasion and your Movement speed
// is 35 feet." The +2 Evasion half is a compendium Active Effect; the flat-35ft Movement half
// needs documents/actor.mjs#_prepareMovement (the one permitted movement-math touch-point).

// Tourniquet Line Chef (General Perk, p.51): "Edge on Science (Medicine) Skill Tests for healing
// injuries or examining dead bodies." The narrative qualifier is dropped (unconditional Edge on a
// Science roll with a "Medicine" Specialization, same "match by Specialization name" idiom as Calm
// Beast, since a Specialization has no stable id a compendium item could target). Its own immediate
// self-or-ally heal half is a Use rule on the item itself, no code needed here.
const TOURNIQUET_LINE_CHEF_ID = `${WTNV_CITIZENS_GUIDE}fxH2GPkDGvJEpI8s`;

// EMT Crash Course (GI Joe CRB, General Perk, p.132): "Edge on Science (Medicine) Skill Tests to
// learn clues from injuries or deceased persons" - textually the same clause as Tourniquet Line
// Chef's own above, so the check below is widened to an OR across both rather than duplicated
// (same "shared/reused dispatch across two same-named-but-distinct items" idiom this project
// already established for Educated). This Perk's own heal/Essence-restore halves are dispatched
// in helpers/banked-buffs.mjs/helpers/emt-crash-course.mjs, not here. Widened to an array
// (built 2026-09-12) since PR CRB (p.94) reprints this Perk verbatim under the same name.
const EMT_CRASH_COURSE_IDS = [`${GI_JOE_CRB}jDAu1zaZpv1IylJ8`, `${PR_CRB}cBezxXDBMpsRwYbP`];

// "A" for Effort! (Intern Origin, p.30) - see usesAForEffort's own comment above.
const A_FOR_EFFORT_ID = `${WTNV_CITIZENS_GUIDE}O8o96wtAeeMeCmUc`;

// Everything is Inspiration (Hobbyist Origin, p.32): "You add an additional Story Point to the
// player pool at the beginning of each game session and once per scene when you fail a Skill
// Test." The session-start half isn't automated - this codebase has no "a new game session has
// begun" hook to fire it from (a one-time, out-of-combat, GM-facing event, unlike every other
// once-per-scene/turn/round gate this project already tracks via Combat state). The reactive
// fail-grant half is built - see its own checkContext.isEverythingIsInspirationAttempt comment
// above and its consumption in _rollSkillHelper's post-roll processing below.
const EVERYTHING_IS_INSPIRATION_ID = `${WTNV_CITIZENS_GUIDE}c1gIi1A6MKHkOwdy`;

// Academic Studies (Student Origin, p.30) - see its own check above.
const ACADEMIC_STUDIES_ID = `${WTNV_CITIZENS_GUIDE}zKyFqePOc7wElWcL`;

// Kind, But Firm (MLP CRB, Spirit of Kindness, 17th level, p.86): "you can use your Empathy Skill
// for Intimidation Skill Tests, as long as no harm comes to the creature you're targeting." Same
// shift-position-delta substitution as How Strange!/Wire Work above, but the substituted skill is
// dynamic (whichever the actor chose via the Empathy Perk's own choiceType:'skills' pick, see
// EMPATHY_MLP_ID's own comment) rather than a fixed skill - "no harm comes to the target" is
// dropped as an unenforceable narrative qualifier, same idiom as Aiming/Precision Aim's own
// self-policed checkboxes.
const KIND_BUT_FIRM_ID = "Compendium.essence20.mlp_crb.Item.kh28DVKbBxMcnMmd";

const FEROCIOUS_FIGHTERS = "Compendium.essence20.ferocious_fighters.Item.";

// Saber-Toothed (Factions in Action Vol 1: Ferocious Fighters, General Perk, p.37): "Your Unarmed
// Combat attacks gain a 1 Sharp damage (↓1) Alternate Effect." Read as a checkbox choice at
// attack-declare time (the same "(↓X) Alternate Effect" notation this system's own weapon items
// already use for a downshift-priced damage-type swap) - suffer ↓1, deal Sharp instead of the
// Unarmed Combat attack's own default Blunt damage type. Gated on "no parent weapon" (the same
// proxy Phantom Ranger Prime/Power Adaptation's own unarmed-attack checks already establish, since
// this system has no dedicated "unarmed" trait/flag).
const SABER_TOOTHED_ID = `${FEROCIOUS_FIGHTERS}RVGlDHOKipqZ1e7i`;

// Get A Grip (Decepticon Directive, Shredder Focus, 3rd level, p.58): "when you successfully hit a
// target that is no more than one Size Class larger than you with an unarmed combat attack, you
// can spend two Free actions to inflict the Grappled condition on the same target." A declared
// Roll Options Dialog checkbox (getAGripAvailable, same "gate on isUnarmedAttack's own no-parent-
// weapon proxy" idiom Saber-Toothed/Cryogenic Touch above establish) carried onto checkContext the
// same way Bump & Run's own applyBumpAndRun checkbox is (see BUMP_AND_RUN_ID's own comment) - the
// Size Class gate and the actual Free-action spend both happen post-hit, in the same per-target
// results loop as Bump & Run's Stun application, since only then is there a real hit/target to
// check against. Uses action-economy.mjs#spend('free') twice (this project has no {free: 2}
// actionType of its own), refunding the first if the second can't be afforded, rather than adding
// a new "twoFree" cost key nothing else would ever use.
const GET_A_GRIP_ID = `${DECEPTICON_DIRECTIVE}CkeKNYNaotNlxWxd`;

// Tooth and Claw, Decepticon Directive printing (Monstrosity Origin Benefit, p.36) - same RAW text
// as the Technorganic Secrets printing above (TOOTH_AND_CLAW_ID), reprinted with a different
// compendium id; both are checked together everywhere TOOTH_AND_CLAW_ID appears below. Its own
// 'toothAndClaw' choiceType (helpers/perk-handler.mjs) now lets the damage-type half - "inflict
// Sharp or Blunt damage (based on the attack)" - join the unarmed damage-type override chain
// further down, something the Technorganic Secrets copy's own older comment above said wasn't
// possible; that's no longer true now that this chain exists, but only THIS printing carries the
// choiceType field so far (see codeneeds_packs.json for adding it to the older printing too).
const TOOTH_AND_CLAW_DD_ID = "Compendium.essence20.decepticon_directive.Item.bHQGteFX7pdnslOx";

// Takedown Expert - see its own Edge-grant comment above, and isTakedownAttempt's own comment for
// its post-hit half.
const TAKEDOWN_EXPERT_ID = `${GI_JOE_CRB}gO9IixdCX0fhReZk`;

// Deceptive Warfare (Focus: Battlefield Psychologist, 20th level, p.86): "when you use Outwit, in
// addition to stunning or scaring enemies, you can choose to use Deception or Intimidation to
// deal 1 Damage to your target." RAW names no damage type - 'psychic' is used as the closest fit
// for Social-skill-driven mental damage (a documented judgment call, same idiom Duty Of The
// Graphite's own "a representative Social skill" default already uses). See
// updatedShiftDataset.deceptiveWarfareAvailable's own comment below.
const DECEPTIVE_WARFARE_ID = `${GI_JOE_CRB}3XV6tQfl7WVvjEKe`;

// "Pseudo"-Science (Scientist Role, Night Vale Community College Focus, p.44) - see
// helpers/pseudo-science.mjs's own doc comment.
const PSEUDO_SCIENCE_ID = `${WTNV_CITIZENS_GUIDE}MTo42tKWWtZ15Ist`;

// If I Recall Correctly (Spell Scribe Influence, p.34): "Once per a scene, you can recall the
// complex reasons a spell works... you gain Edge on your next Spellcasting Skill Test." Dispatched
// as a "Use" button (helpers/banked-buffs.mjs BANKABLE_PERKS, target:self) - its default
// data={edge:true} is exactly what's needed, same as Bait and Switch above - consumed here scoped
// to Spellcasting specifically, the same inline "check rolledSkill" shape Inner Magic already uses.

// But I Should Know That (Spell Scribe Hang-Up, p.34): "When you fail a Spellcasting Skill Test,
// you get so frustrated that you suffer Snag on your next Skill Test." A reactive trigger - flagged
// onto checkContext and, on failure, banks an unscoped Snag - same shape as Stay Humble/Outfoxed.
const BUT_I_SHOULD_KNOW_THAT_ID = `${KNIGHTS_OF_CANTERLOT}zO84wFyLjE9y6FsH`;

// Instinctual Caster (Hedge Wizard Hang-Up, p.35): "If you fail to cast a spell successfully, you
// suffer an additional ↓1 to your Spellcasting Skill." Approximated as a banked ↓1 scoped to the
// actor's own next Spellcasting roll specifically (not folded into the real lingering casting-cost
// shiftDown documents/item.mjs's own spell-cast branch maintains, to avoid a real ordering hazard -
// that field is written by a fire-and-forget roll item.mjs doesn't await the result of, so a
// second writer racing it on the same field risks clobbering one write with a stale read) - same
// reactive shape as But I Should Know That, just scoped to Spellcasting and shiftDown instead of
// unscoped and Snag.
const INSTINCTUAL_CASTER_ID = `${KNIGHTS_OF_CANTERLOT}ixNXVuXWjNf8fZHY`;

// Trick Shot (Archer Influence, p.14 - stored as a General Perk in the compendium's own schema,
// a real mismatch between this item's system.type and its actual RAW placement, though that
// field is purely organizational and doesn't gate the mechanic itself): "Once per Scene, you
// rely on your training to gain Edge on a Targeting Skill Test when using a bow." No "bow"
// weapon trait exists in this system to check - the "with a bow" qualifier is dropped, same
// "narrow qualifier, apply unconditionally" idiom Bits To Spare/Truthseeker's own narrower RAW
// wording already accepts, leaving a plain once-per-scene Edge on Targeting.

const COBRA_CODEX = "Compendium.essence20.cobra_codex.Item.";

// Spoiled's own Hang-Up - see its own check next to Spot Weld's identical synthetic-dataset-flag
// shape above.
const SPOILED_HANGUP_ID = `${COBRA_CODEX}AiXWfp1Qg0TyHWqK`;

const SPOILED_USES_FLAG = 'spoiledRequisitionUsedThisScene';

// Dispersion - see its own check next to Lance of Light's identical Resistance shape above.
const DISPERSION_ID = `${COBRA_CODEX}WHJLWQRUiCqSqLrK`;

// Urban Jungle (Cobra Codex, Vanguard Citystriker Focus, 3rd level, p.68) - the skill-substitution
// clause only: "inside and outside of an urban environment, you can use Streetwise in place of
// Survival for Skill Tests" - RAW's own "inside AND outside" wording makes this one clause
// explicitly environment-independent, unlike this same Perk's other 3 "in urban environments"
// clauses, which read the scene's terrain (helpers/environment.mjs#getTerrain): Edge on non-attack
// Skill Tests and Specialized attacks in rollSkill() next to Environmental Expertise, and ignoring
// Rough Terrain in helpers/rough-terrain.mjs.
const URBAN_JUNGLE_ID = `${COBRA_CODEX}wIesQd7U5W2azAWY`;

// Angry Influence (Cobra Codex, p.26): "Once per day, you can gain Edge on a Strength-based Skill
// Test." Approximated as once per encounter, the same day-to-encounter idiom this project already
// uses everywhere else. Its own Hang-Up ("suffer Snag on a single Smarts- or Social-based skill
// you've invested at least 1 Skill Point in, for the rest of the scene - the GM chooses the
// skill") is approximated as a player-facing picker offered the moment the Perk is used (a
// GM-adjudicated pick offered to the player instead, the same idiom this project already applies
// wherever a GM-judged choice has no other hook) - see helpers/angry.mjs.
const ANGRY_ID = `${COBRA_CODEX}fHmLPZ3K8AGgzANp`;
const ANGRY_HANGUP_ID = `${COBRA_CODEX}wGMyGbySdNSgPs8B`;

// Iconoclast Origin's Disrupter benefit (Cobra Codex, p.45): "You gain Edge on Initiative tests
// for combats where at least one enemy has a Threat Level higher than your character level." A
// whole-combat scan (every combatant, not a nearby-radius one) - see hasIconoclastEdge() below,
// checked in prepareInitiativeRoll().
const ICONOCLAST_ID = `${COBRA_CODEX}BPFc4FQgy9mFgPqG`;

// Silver Medal Syndrome Origin's Consistent benefit (Cobra Codex, p.46): "When you roll a
// Critical Success on a Skill Test with a benefit for Critical Successes, you can choose to treat
// it as a regular success and gain [shiftUp] 1 on your next Skill Test." Asked as soon as the dice
// show a Critical Success (helpers/target-riders.mjs#askConsistent); saying yes drops the roll to a
// plain success before anything is built from it and banks the ↑1.
const SILVER_MEDAL_SYNDROME_ID = `${COBRA_CODEX}vaAhMXXlzNWHIikR`;

// Bully Origin's Menace benefit (Cobra Codex, p.41): "Once per scene as a Standard action, you can
// attempt a Skill Test of your Origin skill against the Willpower of a target who can see or hear
// you. On a success, you deal Stun 1." See helpers/menace.mjs. Named BULLY_MENACE_ID, not MENACE_ID
// - that name is already taken by an unrelated GI Joe CRB Door-Kicker Perk (also called "Menace")
// declared above.

// Corrupt Origin's Distracting Offer benefit (Cobra Codex, p.42): "As a Standard action, you can
// make a Skill Test of your Origin skill against a target's Cleverness. On a failure, you can't
// use this ability again this scene. On a success, your target suffers -1 on Skill Tests until
// the beginning of your next turn (doubled on a Critical Success), and you can use this ability
// again this scene, but only against the same target." See helpers/distracting-offer.mjs.

// Sabotage (Cobra Codex, Commando Saboteur Focus, 1st level, p.83): "Your Technology Skill Tests
// to disable machines gain shiftUp equal to your Sneak Attack damage." "To disable machines"
// dropped, same narrow-qualifier idiom as Bits To Spare/Truthseeker above - unconditional shiftUp
// on the actor's own Technology rolls. See helpers/sneak-attack.mjs#getSneakAttackDamage.
const SABOTAGE_ID = `${COBRA_CODEX}35KMOMI1iPdBPhHl`;

// Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69): "On a success, you gain shiftUp 1
// on your attacks against that target this turn." See helpers/growl.mjs.
const GROWL_ID = `${COBRA_CODEX}OSVtPXBdRmZ2C4PD`;
const GROWL_SHIFT_UP_FLAG = 'pendingGrowlShiftUp';

// Get The Horns (Cobra Codex, Vanguard Warthog Focus, 10th level, p.69): "when you use Growl
// against a target, then hit that target with a melee weapon, you gain the benefits of Growl
// against that target for an extra turn." Growl's own banked shiftUp (GROWL_SHIFT_UP_FLAG) is
// already cleared the moment the qualifying roll is made (see wasGrowlApplied's own comment
// above) - Get The Horns re-banks the SAME bonus once a melee hit against that target is
// confirmed, so the actor's own next attack against them also benefits. See its own check in
// _rollSkillHelper's post-hit processing below.
const GET_THE_HORNS_ID = `${COBRA_CODEX}gi8vv2ujGBQNLjIq`;

// Superb Soloist (Bard Influence, p.15): "Once per day, you can sing a song that grants your
// allies Edge on their next Skill Test in the current scene." A "Use" button (helpers/banked-
// buffs.mjs) broadcasting an unscoped Edge bank to every nearby ally - "once per day" approximated
// as "once per scene" via hasUsedThisEncounter, this project's usual daily-resource idiom. Not
// dispatched through team-buffs.mjs's own generic 'edge' effect - that one is hardcoded to the
// Morphed-only Power Ranger broadcast shape (SHINING_LEADER_EDGE_FLAG, filtered to
// system.isMorphed allies), which doesn't fit a non-Morphing MLP cast at all.

// Sucker Punch (Enigma of Combination, Pugilist Focus, Warrior, 10th level, p.38): "if you use
// any attack that is altered by your Puissance Focus Perk in the first round of a combat against
// a target that has yet to take an action, any success you achieve becomes a Critical Success.
// This Perk functions only once per scene." "Altered by Puissance" is read as the same "no parent
// weapon" attack Puissance itself checks - see checkContext's own isSuckerPunchEligible comment
// (rollSkill()) for the round/once-per-scene/no-parent-weapon half, and _rollSkillHelper's own
// results.map() for the per-target "hasn't acted yet" half (reusing the same combat-turns-index
// lookup First Strike's own check in _getAutomaticCombatModifiers already established) and the
// actual Critical-Success bump (Powerful Suggestions' own multiplier 1->2 mechanism).
const SUCKER_PUNCH_ID = "Compendium.essence20.enigma_of_combination.Item.QSH8oFXlVKxq2iKJ";
const SUCKER_PUNCH_ENCOUNTER_FLAG = 'suckerPunchUsedThisEncounter';

// Bump & Run (Enigma of Combination, Pugilist Focus, Warrior, 6th level, p.38): "if you moved at
// least 15ft before making an Attack Skill Test, you gain an upshift; if that Attack is also a
// Critical Success, the target is also Stunned until the end of their next turn." "Moved 15ft
// first" has no hook to verify (same self-policed-checkbox reasoning as Charge's own identical
// "moved 10ft" drop, now that Perk's own item rule) - a Roll Options Dialog checkbox. The Stun
// half is read back from the declared checkbox (not re-checked) in _rollSkillHelper's post-hit
// processing, applied only on a Critical Success (multiplier >= 2, this system's own Degrees-of-
// Success concept - see Devastating Strike's own comment above).
const BUMP_AND_RUN_ID = "Compendium.essence20.enigma_of_combination.Item.4eA2ktw0cfdYV6Fs";

// Smash! (Enigma of Combination, Pugilist Focus, Warrior, 20th level, p.38): "spend your Standard
// and Move action to make a single [Puissance-modified, i.e. weaponless] attack against a target
// within Reach that is at least one Size Class smaller than you. On success, deal 1 additional
// damage per Size Class you are larger than the target and knock the target Prone." The "spend
// your Standard and Move action" precondition has no action-economy budget to verify against (same
// self-policed drop as Bump & Run/Charge's own "moved X feet" clauses) - dropped, "may" read as
// "always does" per this project's own Psychological Warfare/Brutal Might precedent. Unlike those,
// no checkbox is offered: the two REMAINING preconditions (a weaponless attack - the same
// checkContext.isUnarmedAttack "no parent weapon" proxy Puissance itself uses - and the target
// being at least one Size Class smaller) are both fully concrete, so there's nothing left for the
// player to self-police. "Within Reach" isn't separately tracked - a weaponless attack (Unarmed/
// Claw/Bite/Bash/Ram/Fly-By) is inherently melee-range in this system. See _applySmashDamage.
const SMASH_ID = "Compendium.essence20.enigma_of_combination.Item.psPOXCaZFo7yiRzD";

// Super Specialized (General Perk, p.127): "Choose a Skill you have at least one Specialization
// in. You gain ↑1 with that Skill when your Specializations apply." Which Skill is chosen via the
// existing choiceType:'skills' + system.choice mechanism (same as Awesome/Cutie Mark Perk) -
// "when your Specializations apply" is read as skillRollOptions.isSpecialized (the actual
// Specialized die-pool being used on this roll), checked post-dialog alongside Watchful Eyes'
// own post-dialog-resolution reads.
const SUPER_SPECIALIZED_ID = `${MLP_CRB}TuSb6usDweSzf5S9`;

// Air Born (Pegasus Origin Perk, p.37): "Choose one of the following as your starting Movement:
// 15ft ground/45ft aerial, 30ft/30ft, or 45ft/15ft." Sets the actor's own BASE ground/aerial
// Movement outright (not an added bonus) - see AIR_BORN_MOVEMENT_OPTIONS' own doc comment in
// documents/actor.mjs#_prepareMovement, the one other permitted touch-point for movement math.

// Sensitive (Precise Hang-Up, p.60): "When you take Damage, you also suffer Snag on Skill Tests
// for the next round." A reactive damage-triggered Snag - built via a new hook in
// helpers/combat.mjs#applyDamage (the same reactive touch-point Hardened Armor's Resistance grant/
// Supreme Guardian's Tech regen already use), banking an unscoped Snag the same shape as Through
// the Arches/Debilitating Strike. "You can expend a Detail Oriented use to ignore this for one
// round" isn't built - Detail Oriented's own action-cost-override half needs this project's still-
// missing action-economy tracking (the same gap Talented/Quick Study/Swift Study are blocked on),
// so there's no working resource to expend against it.

// Wild Tales (Adventurer Influence, p.42): "Once per scene, when you tell a short story about
// your experiences, you gain Edge on a Smarts or Social Skill Test." A "Use" button prompting
// which of the two Essences to apply to (same single-select DialogV2 shape as
// pickAgelessKnowledgeSkill), banking an Essence-scoped Edge (a new BANKABLE_PERKS shape - every
// prior bank is scoped to a specific Skill or entirely unscoped, never "any Skill from one of two
// named Essences").

// General/Origin/Influence/Hang-Up Perk pass (2026-09-10) - a handful of "vehicle piloting"
// General Perks that turned out to be genuinely buildable once the pilot-lookup infra above
// (_getVehicleDriver, and its new reverse-direction sibling _getPilotedVehicle below) was
// confirmed already fully built - see White Ranger Prime's own doc comment above for the full
// discovery. Unlike Heavy Ordnance/White Ranger Prime (checked from the VEHICLE's own roll,
// resolving its driver), the Perks below are held by, and checked from, the PILOT's own roll -
// _getPilotedVehicle finds which vehicle (if any) they're currently seated in.
const DOGFIGHTER_ID = "Compendium.essence20.across_the_stars.Item.twl2N01FD8XKO0s1";

const PEERLESS_PILOT_GIJ_ID = `${GI_JOE_CRB}y39VC0CIsI8mdLKK`;
// Peerless Pilot (PR CRB, General Perk, p.97) - a distinct compendium item from GI Joe CRB's own
// Peerless Pilot above (same name, different RAW): "Edge on Initiative Skill Tests" and "Edge on
// Driving Skill Tests while piloting a vehicle you are skilled with at d6 or higher" (its own
// prerequisite is "Any Driving specialization of d6 or higher", so this checks the actor's own
// Driving specializations directly via _hasDrivingSpecializationAtOrAboveD6 below, rather than the
// GI Joe version's looser "has any Driving specialization at all" approximation - this book's own
// wording actually names a die size). The "automatically pass the emergency disembark Skill Test"
// clause stays unbuilt - no such Skill Test exists anywhere in this codebase to auto-pass.
const PEERLESS_PILOT_PR_ID = `${PR_CRB}dHDCKO4k7dlzyXbC`;
// Martial Zord (PR CRB, Zord Feature, p.137): "The Zord's melee attacks are more in tune with
// the driver, granting +1." A Zord Feature (a `feature` item on the ZORD itself, matched via
// helpers/zord-features.mjs - not a Perk on the pilot), so this checks the ROLLING actor (the
// Zord) for the Feature and _getVehicleDriver for "is it actually being piloted right now,"
// the mirror image of Motor Lancer (a Perk on the pilot boosting their own attack
// while riding ANY vehicle) - here it's the Zord's own attack, gated on having a driver at all.
const MARTIAL_ZORD_ID = `${PR_CRB}nQcU1SrVChPaXXpq`;
// Zero-G (PR CRB, Zord Feature, p.138): "this Zord's ranged attacks all gain +1." The Aerial
// Movement half (+60ft) is a static compendium Active Effect on the Feature item itself; this
// covers the live combat-roll half, checked the same "Feature on the rolling Zord" way as
// Martial Zord above.
const ZERO_G_ID = `${PR_CRB}8xV4xaz8Hnqk4TgQ`;
// Titan Body (PR CRB, Zord Feature, p.140): "The Zord's base melee attacks deal 3 damage." The
// Towering Size/+2 Health/Strength+1/Speed-2 halves are already a static compendium Active
// Effect on the item itself (predates this session). This is the one live half: a FLOOR (not a
// flat +3 add) on the Zord's own melee weaponEffect damage, applied below wherever the final
// damageValue is computed, before any other additive damage bonus (Auxiliary Zord, Thunder
// Upgrade, Warrior Mode, ...) stacks on top. Scoped to any melee weaponEffect this Zord makes,
// not narrowed to specifically its baseline "Zord Melee Attack" item - this codebase has no flag
// distinguishing an actor's "base"/innate attack from any other melee weapon someone added to
// it, the same "closest deterministic approximation" idiom every other RAW clause this codebase
// can't perfectly scope already accepts (e.g. Auxiliary Zord's own identically-scoped damage
// bonus just above). The incompatibility list ("can't benefit from Hardened Chassis, Light
// Chassis, Ninja Powered, Upgraded Zord") is a chargen-time build rule, left GM-enforced like
// every other build-time restriction this codebase already leaves unenforced (e.g. Detachable/
// Core Body).
const TITAN_BODY_ID = `${PR_CRB}a8qeX4JiDdAKfxyl`;
// Ninja Powered: Deep Wisdom (PR CRB, Zord Feature, p.138): "Edge on attacks versus targets
// with Resistance or Immunity to a type of damage." Checked target-side, alongside this
// system's own existing Resistance-Snag check (both read the target's static resistances/
// immunities fields for the attack's own damageType).
const NINJA_POWERED_DEEP_WISDOM_ID = `${PR_CRB}wvJFH2HbSWNab25M`;
// Ninja Powered: Balance of Justice (PR CRB, Zord Feature, p.138): "Grants Edge to allies who
// attack a target already attacked by this Zord in the same round." Modeled the same
// mark-the-target/hasUsedThisRound shape Move Like a Song and Alpha Strike already establish
// (see MOVE_LIKE_A_SONG_ROUND_FLAG's own precedent) - unconditional on the Zord's own attack
// actually hitting (RAW says "attacked," not "successfully attacked," the same "attempted, not
// landed" reading Quiet One's own "attacked with" clause already uses) and, like Move Like a
// Song's own identical "any attacker" shape, not narrowed to actual allies specifically (no
// ally/enemy distinction is checked at this point in the file for a target-side flag like this
// one - the same simplification already accepted elsewhere rather than a guess at RAW's exact
// intent for a Zord attacking itself, a case that doesn't arise in practice).
const NINJA_POWERED_BALANCE_OF_JUSTICE_ID = `${PR_CRB}wlXHbN4QHSBGbkTe`;
const BALANCE_OF_JUSTICE_ROUND_FLAG = 'balanceOfJusticeUsedThisRound';
// Ninja Powered: Stealthy Misdirection (PR CRB, Zord Feature, p.138): "Can take the Defend action
// as part of any Move action that is more than 20 feet." Not built - no Defend action exists
// anywhere in this codebase, the same gap Upgraded Zord: Shogun Upgrade's own "Defend as a Free
// action" clause (see SHOGUN_UPGRADE_ID's own comment above) already hits. Left undocumented in
// code beyond this comment (no _ID constant, since there's nothing here to check against yet)
// until a real Defend action mechanic exists to hook into.

// Upgraded Zord: Rescue Upgrade (PR CRB, Zord Feature, p.138): "+1 Strength, +1 Speed, +20 feet
// to all movement types, +1 Armor bonus to Toughness" - entirely static/flat, no live roll hook
// needed (fully covered by the item's own compendium Active Effect).

// Targeting System (GI Joe CRB, Vehicle Trait, p.173): "The driver can attack with this weapon
// as a Free action, using their own Driving skill or the vehicle's Targeting skill... for the
// Skill Test." Not built - this codebase has no Free-action-vs-Standard-action cost concept
// anywhere (every roll this file handles is already assumed to cost whatever action the sheet's
// own control implies, never computed or enforced here), so there's nothing for this trait to
// grant an exception to yet. The Skill-substitution half (Driving OR Targeting, better of the
// two) could be built alone, but doing so without the Free-action half would misrepresent RAW's
// actual grant - left undocumented in code beyond this comment until a real action-cost concept
// exists to hook into.

// Armored Cabin / Wearable (GI Joe CRB, Vehicle Traits, p.173): "Attacks can't target the
// vehicle's Crew" (Armored Cabin) / "Attacks can target the crew or the vehicle equally, rolling
// against the defenses of the target" (Wearable, the opposite allowance). Not built - neither
// trait has anything to gate: this codebase has no "attack an embarked crew member directly,
// instead of the vehicle itself" targeting choice anywhere for either trait to permit or forbid.
// Every existing Vehicle/Zord Willpower-Cleverness redirect (helpers/combat.mjs#getDefenseValue)
// and driverless-Vehicle-is-an-object rule already only ever resolve TO the vehicle or driver,
// never let an attacker choose a different embarked passenger as the target in the first place.

// Elusive (GI Joe CRB, Vehicle Trait, A.W.E. Striker p.180) / Hard Target (Skystriker p.185,
// Night Raven p.307) / Evasive Maneuvers (F.A.N.G. p.303, Reconnaissance Jet p.309, others): "As
// long as [vehicle] moves 30 ft in a round, it uses Evasion for defense" / "As long as [vehicle]
// is in flight, ranged attacks target its Evasion defense" / "the driver can halve the speed... to
// force attacks to target its Evasion defense until the beginning of its next turn." Confirmed
// ALREADY fully supported, no code needed: helpers/defense-choice.mjs#chooseDefenderDefense (used
// for every attack resolved in this file) already lets the DEFENDER freely choose Evasion or
// Toughness on any given attack, matching this system's own general RAW ("in most cases, the
// defender chooses the Defense based on how they react to the attack" - see that file's own doc
// comment). A vehicle with any of these three traits could already just always choose Evasion
// whenever it's the better defense, with or without moving/flying/spending an action first - their
// specific triggering conditions add nothing the generic system doesn't already grant. The same
// "positive finding, no code needed" category as Megaform Trait's second slot just below.

// Megaform Trait (PR CRB, Zord Feature, p.139, a Zeo Zord's own automatic Feature): "This Zord is
// designed to function better as a part of the whole. This feature allows you to choose a second
// Megaform Trait for your Zord to contribute to any Megaform they are a part of." Confirmed
// ALREADY fully supported, no code needed: _prepareMegaformZordData/_prepareMegaformCombinerData
// already iterate every megaformTrait item a participant holds (never limited to one), and the
// Zord Features "+" add control (zord-common.hbs) never enforced a one-trait cap to begin with -
// a GM can already add a second Megaform Trait item to any Zord today. This Feature's real
// function is a chargen-time PERMISSION ("you're now allowed a second one"), not a runtime
// restriction this system enforces anywhere - the same GM-adjudicated-build-rule category as
// Titan Body's own incompatibility list just above.

// Enhance (Attack) (PR CRB, Zord Feature, p.137): "Choose one of the Zord's methods of attack.
// Choose either to add Accurate (↑1) to the attack, add 1 damage, or apply one special effect
// from the list below." Needs no dice.mjs hook of its own - re-checked against the real
// weaponEffect schema (an earlier pass here called it blocked on the `feature` item type having no
// choice field, which mistook the shape of the problem: nothing needs to READ a stored choice,
// because every option is expressible on the chosen attack itself). 5 of the 8 options are plain
// field edits on the chosen weaponEffect, the same "GM applies the static effect" idiom Heavy
// Chassis/Increase (Essence) already use: +1 damage -> damageValue; doubled melee reach ->
// range.reachMultiplier (already derives totalReach); +30/60ft range -> range.value/range.long;
// Multi-Weapon (2) -> numTargets; change damage type -> damageType. Accurate (↑1) is now live
// generically for ANY weapon via the 'accurate' weapon trait (see _getAutomaticCombatModifiers's
// own check) - the GM just ticks that trait on the chosen weapon. The 2 genuinely-unbuilt options
// are "ignores Armor bonus to Toughness" (getDefenseValue's own ignoreArmor option exists, but no
// weapon-trait-driven path to it does - same infra gap E20.weaponTraits.antiTank/armorPiercing are
// already flagged for below) and "reduces target's Speed by 1d2" (needs an on-hit effect
// application). Which of the 8 a given Zord took is a character-sheet record, not runtime state.

// Zord Mega-Weapon System (PR CRB, Zord Feature, p.141): "It costs a total of 5 Personal Power
// expended from any combination of the Crew... and lasts for 1d2+1 attacks... base of 5 damage...
// can be used while part of a Megaform." Not built - two genuinely new shapes neither Relic Key
// nor Warrior Mode's own declare/consume idiom cover: spending a cost POOLED ACROSS MULTIPLE
// actors at once (every other Personal-Power spend in this codebase draws from exactly one
// actor), and a multi-use DURATION COUNTER (1d2+1 remaining attacks, decrementing per use) rather
// than a single-roll or on/off-toggle grant. Flagged rather than rushed in half-built.

// Carrier / Extra Attack / Blast Attack / Crew Compartment / Fast Modulation / Additional Attack
// Type (PR CRB, Zord Features, p.137-139): each needs its own new subsystem with no existing
// analog in this codebase - a pocket-dimension actor-container concept (Carrier), a multi-attack
// action-economy concept (Extra Attack), an AoE-shape auto-wire scoped to one specific grant
// (Blast Attack, distinct from the general helpers/aoe-targeting.mjs an attack with a real
// `shape` already uses), additional crew-slot capacity (Crew Compartment), a Combiner-join-timer
// concept (Fast Modulation), or is purely descriptive (Additional Attack Type just grants access
// to author a new basic attack, nothing to compute). None built - flagged here rather than each
// getting a half-built partial mechanic.
// Demolition Driver (Factions in Action Vol. 2, General Perk, p.64): "When making a Ram attack,
// you can suffer downshift 1, 2, or 3 on the Skill Test to deal an equal amount of additional
// damage on a successful hit." Ram-only (unlike Sideswipe, which also covers Flyby) - matched via
// weaponEffect.mjs's own isRam flag, see _isDemolitionDriverAttack.
// A genuinely new spend shape: every other numeric Roll Options Dialog spend in this codebase
// (Terror, Supreme Guardian Tech) draws down a separate banked resource; this one converts a
// self-imposed downshift on the SAME roll directly into damage, capped at a fixed 3 rather than
// a resource pool's own current value.
const DEMOLITION_DRIVER_ID = "Compendium.essence20.intercontinental_adventures.Item.pCRDLA7XZ3auR2ZO";
// Eltarian Training (Through the Shattered Grid, General Perk, p.73, Speed 4+): "+10 Ground
// Movement; ignore the first -1 penalty on Finesse Skill Tests." Not a piloting Perk at all
// despite being flagged as one by an earlier, mistaken categorization pass - a plain flat
// movement bonus plus an Expertise-style downshift clamp, both already-established patterns.
const ELTARIAN_TRAINING_ID = "Compendium.essence20.through_the_shattered_grid.Item.NXxiyoOB60ems444";

// General/Origin/Influence Perk pass, PR CRB batch 2 (2026-09-10) - a handful of items an earlier,
// text-free categorization pass flagged "buildable now, low confidence" turned out, once RAW text
// was actually pulled (p.93-99, General Perks; p.66-76, Influence Perks), to be genuinely clean
// builds reusing already-established patterns - see each one's own check for its citation.

// Heroic Intervention (PR CRB, General Perk, p.96, Level 8+): "As long as you are adjacent to an
// ally, you gain +1 on all Defenses." The compendium item's own "Adjacent Ally" effect already has
// the right numbers (+1 to all 4 Defenses) but the wrong SCOPE - it's an unconditional Active
// Effect, not gated on adjacency - so it correctly stays disabled (same "leave the over-broad
// effect off, build the real gate in code" idiom as Keen Eye/Peerless Pilot) while the real
// conditional bonus is applied live in the per-target checkEntries construction below, the same
// touch-point Stronger Together's identical "per-target Defense bonus" shape already uses (can't
// touch _prepareDefenses directly). "Adjacent" is read as within 5ft, the same threshold Whirlwind
// Strike's own RANGE_FEET constant already establishes. The Story Point grant clause is dispatched
// separately in banked-buffs.mjs (same shape as Educated's identical clause); the Power-spend 15ft
// move is a narrative positioning action, not a roll modifier, and isn't built.
const HEROIC_INTERVENTION_ID = `${PR_CRB}T95n2lwh3F5OHjnB`;

// General/Origin/Influence Perk pass, GI Joe CRB batch (2026-09-10) - a further handful of
// "buildable now, low confidence" items RAW text (p.44-134) confirmed are genuinely clean builds.
// Sharpshooter's Grace here is a DISTINCT compendium item from PR CRB's own printing, and the two
// do NOT share RAW text: both suppress the long-range Snag, but GI Joe's +2 is for targets FARTHER
// than 30 feet (p.133), matching the Transformers CRB printing rather than PR's "within 30 feet".

// Jacket Wrestler (Factions in Action Vol. 2, Arashikage General Perk, p.32): "You are a skilled
// grappler, focusing on leverage and speed over strength. • You use Finesse instead of Might to
// Push/Shove a creature. • When you Grapple a larger target, you do not suffer Downshifts based
// on the size of your target." Confirmed via a direct read of the GI Joe CRB's own Chapter 9:
// Combat text (p.200) that there IS a real, distinct core rule this suppresses: "there is a ↓1
// die shift for each Size class larger the target is (up to two)" on a Grapple attack - separate
// from, and additive with, the generic Size Class Combat Adjustment Matrix (_getSizeShift) that
// already applies symmetrically to every attack regardless of direction. This core downshift
// wasn't built anywhere in this codebase before (a genuine gap, not just a suppression target) -
// see its own check next to _getSizeShift's call site, built alongside Jacket Wrestler's own
// suppression of it. Push/Shove itself has its own separate, distinct RAW mechanic (Chapter 6,
// p.117: a flat DIF-12 Might (Grappling) Skill Test with its own shift modifiers, not a weaponEffect
// Attack at all) that this codebase has never modeled - the Finesse-substitution clause instead
// reuses the same loose damageType.grapple weaponEffect proxy Wrestler/Kung Fu Grip/Experiment's
// shove option/When Push Comes To Shove already establish, matching this project's own existing
// (if simplified) treatment of Push/Shove rather than opening a new mechanic from scratch.
const JACKET_WRESTLER_ID = "Compendium.essence20.intercontinental_adventures.Item.59masYwRaPC1AuhQ";

// Aerial Acrobat (Cobra Codex, Technician Rocketeer Focus, 3rd level, p.66): "At 3rd level, you
// can use Acrobatics or Driving for attacks, as long as you used your Jet Pack to move this
// turn." "Used your Jet Pack to move this turn" is dropped, the same narrow-qualifier idiom
// Human Bullet's own identical Jet Pack clause already established (helpers/human-bullet.mjs) -
// this codebase has no "moved via Jet Pack this turn" tracking at all. Unlike every "may use X"
// substitution offered as a Roll Options Dialog checkbox elsewhere in this project, this is built
// unconditionally (Jacket Wrestler's own shape above) rather than adding a new dialog checkbox:
// since a lower shift-list position is strictly better, auto-substituting whichever of the
// actor's own Acrobatics/Driving/current attack skill is best costs the player nothing they'd
// ever decline.
const AERIAL_ACROBAT_ID = `${COBRA_CODEX}sHtvGtD2PuXzpuxC`;
const CIRCUIT_BREAKER_ID = `${TF_CRB}9Tnrm8Nb1xDaNCao`;

// Cultural Connection (Ferocious Fighters, Diplomat Focus, 1st level, p.14): "You can use Culture
// instead of Deception or Persuasion Skill Tests as long as you have at least a d2 in the Skill
// you're replacing. At the 10th Role Level, when you use Culture in place of Deception or
// Persuasion, you roll your Skill Test with the benefits of being specialized." Unlike Jacket
// Wrestler/Aerial Acrobat above, this isn't attack-scoped, so it's checked directly against
// rolledSkill instead of gating on item?.type == 'weaponEffect'. "At least a d2 in the Skill
// you're replacing" is read as "the replaced Skill is actually trained" - d20 is this project's
// own untrained-Skill placeholder (see E20.skillShiftList), the one value strictly worse than d2.
const CULTURAL_CONNECTION_ID = `${FEROCIOUS_FIGHTERS}m90eNtuZvLWouyRc`;

// Brutal Verbalities (Sgt. Slaughter Sourcebook, Officer, 1st level, p.10-11): "Intimidation is a
// Social Skill as well as a Strength Skill for you" (a separate, already-existing essence-override
// Active Effect, not touched here). "You can use Intimidation in place of Deception and Persuasion
// for Officer Role Perks, such as Rouse" is narrowed to just Rouse (helpers/rouse.mjs) - the only
// Officer Role Perk in this codebase that actually fires a hardcoded Deception/Persuasion Skill
// Test (dataset.isRouseAttempt), so it's the only place with anything to substitute into. "You can
// spend a Story Point to use Intimidation on a creature normally immune to it" needs an
// immunity-check hook this codebase doesn't have for Skill Tests (only for damage types), so it's
// not built.
const BRUTAL_VERBALITIES_ID = `${SGT_SLAUGHTER_SOURCEBOOK}S9AyX2OtvvrE9oM0`;
// Robot (GI Joe CRB, pet/drone Perk): "You are susceptible to effects that affect machines, such as the
// Electromagnetic element" - a holder counts as a robot for Electromagnetic's ↑3.
const ROBOT_PERK_ID = `${GI_JOE_CRB}xV4nnjMxlb4dmyxo`;

// "Friendly" Fire (Quartermaster's Guide to Gear, Chameleonite Focus, 6th level, p.20): "if you use
// a Deception or Infiltration Skill Test for an Initiative Skill Test (see Spoof), you act normally
// in the surprise round. In addition, you gain Edge on your first attack in the combat scene." Both
// halves hang off the Spoof Initiative: prepareInitiativeRoll stamps the combat's id when Spoof was
// used, and only that combat's first attack gets the Edge. The "act normally" half needs nothing
// built - this codebase has no Surprised status or surprise-round action restriction to lift (see
// isSurpriseRound()'s own callers - none of them block acting).
const FRIENDLY_FIRE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.CwsHTrQION565onG";
const FRIENDLY_FIRE_ENCOUNTER_FLAG = 'friendlyFireUsedThisEncounter';
const FRIENDLY_FIRE_SPOOF_FLAG = 'friendlyFireSpoofCombat';

// Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76) - see helpers/perfect-disguise.mjs's
// own doc comment for the toggle itself. "All social interactions" is read as the same 4 Social
// Essence skills this book's own Presence Perk already enumerates.
const PERFECT_DISGUISE_ID = `${GI_JOE_CRB}ELktMVNYsiBPTX2c`;
const PERFECT_DISGUISE_SKILLS = ['deception', 'persuasion', 'intimidation', 'streetwise'];

// Basic Intelligence (GI Joe CRB, Focus: Expert, 10th level, p.104): "you roll untrained Skill
// Tests without a Snag." Identical mechanic to "A For Effort!"'s own floor-to-d2-without-Snag
// behavior (see its own comment above), just unconditional/unlimited instead of once-per-session -
// checked against dataset.shift directly for the same reason A For Effort! is (initialShift may
// already have been floored to d2 above for an unrelated reason by the time this runs).
const BASIC_INTELLIGENCE_ID = `${GI_JOE_CRB}ycwWXZhyxM15xgac`;

// Genius (GI Joe CRB, Technician, 15th level, p.104) - see its own check above.
const GENIUS_ID = `${GI_JOE_CRB}ENRpxMCws91Ny19y`;

// Menace (GI Joe CRB, Door-Kicker Focus, 1st level, p.98): "you do not suffer penalties for using
// a shotgun or submachine gun while in the reach of an enemy." Suppresses the ordinary "Ranged
// Attacks in Close Combat" Reach downshift, gated on the specific weapon sourceId - same idiom
// Assault Precision's identical shotgun/submachine gun check already establishes.
const MENACE_ID = `${GI_JOE_CRB}rzALUHpTq12OLZ6B`;

// CQB Training (Quartermaster's Guide to Gear, General Perk, p.28): "You no longer suffer
// penalties to ranged Attack Skill Tests while within an enemy's reach." Same "Ranged Attacks in
// Close Combat" Reach downshift Menace already suppresses just above, but general (any weapon),
// not scoped to a specific weapon sourceId - added as a third exclusion condition alongside
// isMenaceWeapon rather than a weapon-specific check.
const CQB_TRAINING_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HBwUVB3ur8WV9fsF";

// Across the Stars Role Perks automated below - the "buildable now" slice of the categorization
// pass (see project plan's own writeup). Same "bare compendium item, code supplies the mechanic"
// situation as every other game line here. Gold/Silver/Phantom Ranger Prime each already carry
// their shared "+2 all Defenses" bullet as a plain compendium Active Effect (same shape as the 7
// base CRB Primes above) - only their remaining bullets need code, checked individually below.
const ACROSS_THE_STARS = "Compendium.essence20.across_the_stars.Item.";

// Astro-Sense (Across the Stars, Grid Power, p.72) - see its own check below.
const ASTRO_SENSE_ID = `${ACROSS_THE_STARS}XfWmXOtcIM5snRKL`;

// Ranger Operator [Form] (A Jump Through Time, General Perk, p.55, RAW-verified 2026-09-15 via a
// fresh PDF pull - this row had sat flagged "not yet individually verified"): "You have ↑1 on all
// Driving and Survival Skill Tests" while in this Form. Form Perks apply while Morphed (you pick
// a Form when activating It's Morphin Time!), the same gate Gold Ranger Prime's own clause uses -
// and the same way this book's other Form Perks (Lightspeed Response, Supersonic, Turbocharged)
// already scope themselves via .morphed-suffixed fields. Skills have no .morphed variant of their
// own, so this half is code rather than a compendium Active Effect.
//
// Deliberately NOT built, both flagged rather than approximated:
// - "Instead of gaining a Toughness armor bonus based on your armor proficiency, you gain a +2
//   Armor bonus to Toughness and Evasion." The +2 alone would be a plain pair of .morphed Active
//   Effects, but RAW is a REPLACEMENT - honoring "instead of" means suppressing the ordinary
//   armor-proficiency Toughness bonus, which lives in _prepareDefenses, under this project's own
//   standing hold until the user's pending Defense-math migration lands. Granting only the +2
//   would over-grant (armor bonus AND +2), so neither half ships.
// - The four gear-replacement clauses (Morpher -> RPM Morpher, Blade Blaster -> Nitro Blaster,
//   Power Weapon -> Rail Saber, or Cloud Hatchet for an Advanced Spectrum Role) are the
//   already-tracked item-grant/equipment-swap gap.
const RANGER_OPERATOR_ID = "Compendium.essence20.jump_through_time.Item.nZYtfaowY0EH3Z0R";

// Savant Skill (A Jump Through Time, General Perk, p.56, RAW-verified 2026-09-15 via a fresh PDF
// pull - this row had sat flagged "not yet individually verified"): "You must choose a Skill from
// the following list... When using that Skill: you may roll your Skill Test as 1d20+1d4,
// regardless of Snag, Edge, or modified Skill Ranks."
//
// The first mechanic in this project that FORCES a fixed dice pool rather than adjusting one:
// the skill die becomes exactly d4 and the d20 operand becomes a plain 1d20, whatever the actor's
// own shift, Edge/Snag state or accumulated shifts would otherwise produce. Opt-in via the Roll
// Options Dialog ("may" in RAW, and it's usually a DOWNGRADE for a well-trained skill - its value
// is rescuing a heavily Snagged or downshifted roll), the same player-declares-it idiom as
// Aiming/Precision Aim. Applied BEFORE _handleAutoFail specifically: a roll shifted all the way
// down to autoFail/fumble is exactly the case this Perk exists to rescue, and that check returns
// early, so overriding afterwards would never fire for the rolls that need it most.
//
// RAW restricts the choice to 10 named Skills (Athletics, Acrobatics, Driving, Alertness, Culture,
// Science, Survival, Technology, Animal Handling, Performance); the generic 'skills' choiceType
// picker has no mechanism for a curated subset, so every skill is offered - the same accepted
// widening already documented for Eltarian Observer's own 3-skill restriction.
//
// The second clause ("if you spend a Story Point to re-roll a die using this Skill and your
// second result fails, you regain that Story Point") stays unbuilt: nothing in the reroll engine
// reports a reroll's own outcome back for a refund decision - a real, still-missing hook, not an
// approximation this pass could fudge.
const SAVANT_SKILL_ID = "Compendium.essence20.jump_through_time.Item.ZnuLgh6jdUHi9F75";
const SILVER_RANGER_PRIME_ID = `${ACROSS_THE_STARS}Bl9G8fgtd30wENkX`;

// The three Ranger Prime capstones whose RAW gives enemies a Snag when they attack ONE named
// Defense of the holder: Silver Ranger Prime (Willpower), Graphite Ranger Prime and Orange Ranger
// Prime (both Cleverness).
//
// ALL THREE WERE RECORDED AS BLOCKED ON A "defenseType-timing gap" - that
// _getAutomaticCombatModifiers, where every other reciprocal target-status Snag lives, runs BEFORE
// the Roll Options Dialog resolves which Defense is being attacked, so the Snag could not know
// whether it applied. That was true of that function, and false of the roll as a whole: the final
// Edge/Snag choice is NOT locked in by the dialog. Observer, Ambitious and Solo Shot all rewrite
// skillRollOptions.snag after it returns, and Station Management reads
// skillRollOptions.defenseType at that same point. Both facts were already in this file; nobody
// had put them together. So these are applied post-dialog, where the Defense is finally known -
// the mirror image of the existing checkbox writes, setting the Snag rather than clearing it.
//
// Only the ONE Defense each Perk names is affected; attacks against any other Defense are
// untouched. Uses the TARGET's own Perk, not the roller's - this is a defensive capstone.
const GRAPHITE_RANGER_PRIME_ID = "Compendium.essence20.beneath_the_helmet.Item.nVOpdhr6aFnuY0ks";
const ORANGE_RANGER_PRIME_ID = "Compendium.essence20.jump_through_time.Item.8s9HHpmk633e6PLM";
const PRIME_DEFENSE_SNAG_PERKS = [
  { id: SILVER_RANGER_PRIME_ID, defenseType: 'willpower' },
  { id: GRAPHITE_RANGER_PRIME_ID, defenseType: 'cleverness' },
  { id: ORANGE_RANGER_PRIME_ID, defenseType: 'cleverness' },
];

// Splinter Defense (Gold Ranger, 18th level, p.53) - see helpers/splinter-defense.mjs's own doc
// comment for the Hardened Armor bonus lookup and the once-per-attacker-per-combat gate; the
// actual post-hit application lives in _rollSkillHelper's own per-target processing below.
const SPLINTER_DEFENSE_ID = `${ACROSS_THE_STARS}YGY0lYvqbsiQcpHs`;
// Revengeful - see its own comment near the post-hit banking in _rollSkillHelper below, and its
// consumption in _getAutomaticCombatModifiers.
const REVENGEFUL_ID = "Compendium.essence20.decepticon_directive.Item.n1CZfponNlZ9I8uN";

// Now I'm Angry (Decepticon Directive, General Perk, p.57): "Whenever you suffer damage from a
// Critical Success, you gain +1 damage on your attacks until the end of your next turn." Banked
// the moment a Critical Success actually lands on the actor - see the isCrit branch alongside
// Revengeful's own identical "bank on the target the instant the attack resolves" loop in
// _rollSkillHelper below - and consumed on the actor's own next weaponEffect Attack, same
// bank-now/consume-on-next-attack shape as Energy Rebuttal (its item's
// takesDamage Trigger rule). "Until the end of your next turn" isn't separately tracked - like Energy Rebuttal,
// this project has no generic mechanism to expire a banked bonus mid-window rather than on first
// use, so it's approximated as "the next Attack consumes it" (the same closest-existing-mechanism
// idiom Energy Rebuttal's own comment already accepts). No generic "react to an incoming Critical
// Success as the target" hook existed anywhere in this codebase before this - every other isCrit
// check in this file is attacker-side only.
const NOW_IM_ANGRY_ID = "Compendium.essence20.decepticon_directive.Item.eqOgBhx720rSSUTh";
export const PENDING_NOW_IM_ANGRY_FLAG = 'pendingNowImAngry';

// Beneath the Helmet Role Perks automated below - the "buildable now" slice of that book's own
// categorization pass (see project plan's own writeup).
const BENEATH_THE_HELMET = "Compendium.essence20.beneath_the_helmet.Item.";

// Zord Sentience (Beneath the Helmet, Zord Feature, p.72, prerequisite Energem Infusion): "The
// Zord's Driving (Autopilot) Skill gains ↑1." The reciprocal "default Smarts and Social of 2
// while unpiloted" half is a Defense substitution living in helpers/combat.mjs#getDefenseValue
// instead (the same split Relic Key already uses between its own Defense/Skill halves). Unlike
// Relic Key (which has no Skill half at all), this bonus only ever matters unpiloted - a driven
// Zord rolls its DRIVER's Driving, not its own - so it's gated on !_getVehicleDriver the same way
// Martial Zord/Zero-G below are gated on driver PRESENCE (the opposite condition).
const ZORD_SENTIENCE_ID = `${BENEATH_THE_HELMET}idhVrfBIKELsl3OW`;

// Menacing Glare (Dark Ranger, 2nd level, p.39) - see helpers/menacing-glare.mjs's own doc
// comment.
const MENACING_GLARE_ID = `${BENEATH_THE_HELMET}eWlflRHYAVB9p5Z0`;

// Unlucky (For You) (Dark Ranger, 13th level, p.40) - see helpers/unlucky-for-you.mjs's own doc
// comment.
const UNLUCKY_FOR_YOU_ID = `${BENEATH_THE_HELMET}hSzY2uhu3L9nGP6o`;

// Calm Beast (Aqua Ranger, Grid Science I choice, p.41) - see its own check in rollSkill() above.
const CALM_BEAST_ID = `${BENEATH_THE_HELMET}Ib4BIJKAmuMoWKJP`;

// Chivalrous (Beneath the Helmet, General Perk, p.50) and Puzzle Solver (same page) - both
// RE-CATEGORIZED 2026-09-15 out of a 14-item "backstory/reputation Perks" narrative bundle that
// was never individually RAW-verified. Neither is flavor: Chivalrous grants "↑2 on Persuasion
// (Diplomacy) Skill Tests" and Puzzle Solver "↑1 on Alertness (Investigation) Skill Tests",
// both specialization-scoped shiftUps matched by the Specialization's own NAME - the exact idiom
// Calm Beast's own "Animal Handling (Calming)" check just below already establishes, and for the
// same reason (a Specialization has no stable id a compendium effect could target).
//
// Each Perk's own "add an additional Story Point to your team's pool each game session" clause is
// built separately, sharing Educated's own requestStoryPointGrant dispatch (see
// helpers/banked-buffs.mjs). Their remaining clauses need no code: Chivalrous's "once per day,
// act as though specialized in any Social Skill" is already covered by the pre-existing,
// always-available isSpecialized checkbox (the same verify-only finding Educated's own identical
// clause already documents), and Puzzle Solver's "spend a Story Point to see the connections
// between parts of a puzzle" is pure GM-narrated information with no numeric effect.
//
// RAW's own narrative qualifiers are dropped the way this project always drops them: Puzzle
// Solver's "that directly involve resolving the current adventure" has no hook to verify, the
// same reasoning as Bits To Spare/Truthseeker's own purpose-qualifiers.
const CHIVALROUS_ID = `${BENEATH_THE_HELMET}E6bnHJFn2QHSru4p`;
const PUZZLE_SOLVER_ID = `${BENEATH_THE_HELMET}AS1G8dp4t09G1k6N`;

// Augmented's own mandatory Hang-Up (Across the Stars, p.44): "The processes that augmented you
// had some unexpected side-effects that weakened you to certain substances, wavelengths, energy, or
// other stimuli. Choose one damage type... You halve your Defenses (rounding up) when targeted by
// attacks or other effects that inflict that type of damage on you." RE-CATEGORIZED 2026-09-15 out
// of a 13-item backstory bucket, and the first Hang-Up in this project to record a player choice at
// all - data/item/hangUp.mjs's schema had no hasChoice/choiceType/choice fields until this build,
// which is what actually blocked it (the halving itself was always trivial). The choice is prompted
// at grant time by helpers/hang-up-choice.mjs, and spans the FULL E20.damageTypes list rather than
// only the 7 Element sub-types, matching RAW's own pointer to the core rulebook's complete table.
// Consumption lives in rollSkill's per-target checkEntries construction - see its own comment there.
const AUGMENTED_HANGUP_ID = "Compendium.essence20.across_the_stars.Item.k76uXWWDpe0yKEcu";

/**
 * Whether the weapon has a Blinding alternate effect (damageType 'blindingBlast') among its effects.
 * @param {Actor} actor
 * @param {Item|null} weapon
 * @returns {Boolean}
 */
function hasBlindingAlternate(actor, weapon) {
  return !!weapon && !!actor?.items?.some?.(i => i.type == 'weaponEffect'
    && i.flags?.essence20?.parentId == weapon.id && i.system?.damageType == 'blindingBlast');
}

// The printed unarmed "weapons" - see _isUnarmedWeaponEffect.
const UNARMED_WEAPON_IDS = [
  "Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom",
];

// Violent (Cobra Codex, Influence Perk, p.38): "When you attack with a weapon with a non-damage
// primary effect that deals damage as one of its alternate effects, you gain ↑1 when you use one of
// its damage dealing effects... you treat its Blunt damage alternate effect as a straight roll with
// your Skill dice." RE-CATEGORIZED 2026-09-15 out of a ~34-item narrative bucket.
//
// Mechanically this is the general case of Beastly just below: RAW's own "treat it as a straight
// roll" is exactly "cancel the alternate effect's printed ↓1", so it's a +1 shiftUp against that
// same -1, not a bonus on top. Beastly is the single-weapon version (Unarmed Combat's Blunt effect
// only) and correctly stays as-is - a Violent holder wielding Unarmed Combat would get both, which
// is right: two different Influences each waiving the same penalty is not double-dipping, since the
// penalty being waived is only -1 and shiftUp/shiftDown net out at the end.
//
// "Non-damage primary effect" has no structural marker in this schema - there is no primary/alternate
// flag, only a flat sibling map (see _getAlternateEffects). Rather than guess, the shape was MEASURED
// across all 412 weapon Items in the compendium: exactly 18 qualify, and they are strikingly
// consistent - the shiftDown-0 effect is always stun/maneuver/intimidate and the shiftDown-1 ones
// deal real damage (Unarmed Combat, Brawling, Strike, Short/Thrown Bludgeoning, Combat Nunchaku,
// Power Tool, Cyber-Saw, the Delta Blaster family, and others across 8 books). So "primary" is read
// as the effects carrying no downshift, and "non-damage" as the types applyDamage never subtracts
// Health for - which is the same set RAW is pointing at with its own Stun example.
const VIOLENT_ID = "Compendium.essence20.cobra_codex.Item.Y5mmouv5YKWhQlIn";

// Damage types that don't actually cost the target Health - Stun accumulates in its own pool and
// the rest are Condition-applications. Used by Violent to decide what counts as a "non-damage"
// effect; kept as its own list rather than reusing ENERGY_DAMAGE_TYPES, which answers a different
// question entirely.
const NON_DAMAGE_EFFECT_TYPES = [
  'stun', 'maneuver', 'intimidate', 'grapple', 'frightened', 'impaired', 'knocProne', 'cover',
  'blindingBlast', 'deafened',
];

// Beastly (Factions in Action Vol. 1, Influence Perk, p.75) is handled entirely in
// documents/item.mjs (UNARMED_COMBAT_ALTERNATE_EFFECT_1_IDS), which zeroes the Blunt alternate
// effect's own shiftDown before it reaches the roller. A second cancelling ↑1 used to live here
// too and double-counted it (fix pass 3).

// Psych 101 (Enigma of Combination, Counselor Focus, 1st level, p.34) - see its own check in
// rollSkill() above.
const PSYCH_101_ID = "Compendium.essence20.enigma_of_combination.Item.pfkMVppvtLbdDTG7";

// Unseen Strike (Phantom Ranger, 9th level, p.61): "On your first Attack Skill Test each turn
// while your Phantom Suite is active, the target's Evasion Defense is halved (round up) against
// that Attack." The "first... each turn" gate is checked/marked the moment the roll is attempted
// (hasUsedThisTurn/markUsedThisTurn, same "the attempt itself consumes it, not the hit" idiom
// Augment Power's own onceTurnFlag already uses) - the actual halving is applied to each target's
// fully-computed difficulty (after every other addition/consumption already ran) in the
// checkEntries construction below, the same "halve the one combined number" precision Roll With
// the Punches' own doubling already uses.
const UNSEEN_STRIKE_ID = `${ACROSS_THE_STARS}EYdpn9PL4iNrQPkh`;
const UNSEEN_STRIKE_TURN_FLAG = 'unseenStrikeUsedThisTurn';

const PENETRATING_SHOT_ID = `${PR_CRB}6ay8OIRRwZTnQUV8`;
const NINJA_POWER_ID = `${PR_CRB}wN5rjEQIJH68rWCd`;
// Iron Bravado (Black Spectrum Modification, replaces Whatever We Need, p.45) - see
// helpers/iron-bravado.mjs's own doc comment. Only the self-immunity half is built here; the
// "spend 1 Power to mirror your own active Conditions onto nearby allies" half needs a novel
// mirror-my-own-active-Conditions-onto-allies mechanic with no precedent anywhere in this project.
const IRON_BRAVADO_ID = `${PR_CRB}8bmqJ7hyOAcVNB1Y`;

// Heavy Force (Yellow Spectrum Modification, replaces Nimble Fighter, p.45): "While Morphed, when
// pushing, shoving, or making your first melee Attack each turn, you may spend 1 Personal Power to
// gain a ↑2 bonus... you may not Move until the beginning of your next turn." Only the melee
// Attack half is built (no Push/Shove action exists) - same Roll Options Dialog checkbox shape as
// Strike Bonus, just a flat +2 instead of a scaling advances value, and per-turn instead of
// per-round. The "can't Move afterward" downside isn't enforced - action economy, the same
// accepted "grant the upside, skip the unenforceable restriction" idiom this project already uses
// broadly (e.g. Reckless Abandon's own unenforced restrictions).
const HEAVY_FORCE_ID = `${PR_CRB}E4hk9pHESLuYQuO7`;
const HEAVY_FORCE_TURN_FLAG = 'heavyForceUsedThisTurn';

// Pay It Forward (Red Spectrum Modification, replaces Let's Bring 'Em Together!, p.45): "While
// Morphed, allies within 10 feet of you gain +1 to all Defenses." Only this clause is built - the
// "Lend Assistance offers +2 instead of +1" clause needs the still-unbuilt general Lend Assistance
// action, and "+1 on Skill Tests that are part of a Group Test" has no Group Test concept anywhere
// in this codebase (checked directly, not assumed). See its own check in the per-target
// checkEntries construction (dice.mjs's own Stronger Together/Environmental Armor neighborhood).
const PAY_IT_FORWARD_ID = `${PR_CRB}M3pQgNMsU5hU5dMN`;

// Defensive Flexibility (Blue Spectrum Modification, replaces Grid Tech, p.45) - see
// helpers/defensive-flexibility.mjs's own doc comment for both halves' full build note.

// Team Focus (Red Ranger, 9th/18th level, p.53): "You add a [+1, then +2 at 18th] to any melee
// attack that targets a target that has already been attacked by your teammate since your last
// turn." "Since your last turn" is approximated at round granularity (this round, not a
// per-roller relative window) - see helpers/team-focus.mjs for the full reasoning, same
// unenforced-precision idiom as Alpha Strike/Debilitating Strike's own round-based flags.
const TEAM_FOCUS_ID = `${PR_CRB}tKonXkoNsZhajHp9`;

// Withering Fire (Factions in Action Vol. 2, Infantry Focus, p.68) - see its own check next to
// Combat Stance's identical target-resolved pre-fill shape.
const WITHERING_FIRE_ID = "Compendium.essence20.intercontinental_adventures.Item.7NYq9SpPjODuHF8R";

// Move Like a Song (Green Ranger, Survival Boon choice, p.44): "The first attack that targets you
// each round has a Snag. If that attack already has a Snag, it automatically misses instead." See
// its own check below, next to First Strike/Just the Facts (another target-side, round-flagged
// check in this same function).
const MOVE_LIKE_A_SONG_ID = `${PR_CRB}3ax1l5TpluxcSp4o`;
const MOVE_LIKE_A_SONG_ROUND_FLAG = 'moveLikeASongUsedThisRound';

// Athletics/Brawn shifts per gravity environment (Across the Stars p.24-25) - see the "Environment"
// block in _getAutomaticCombatModifiers. Negative is a penalty.
const GRAVITY_ATHLETICS_BRAWN_SHIFTS = { highGravity: -2, lowGravity: 1, zeroGravity: 2 };

/**
 * Pistol Whip (Transformers CRB p.66): a Ballistic weapon in an External Hardpoint "also counts as a
 * Close Combat Bludgeon. You do not add any benefits you normally gain from attacks with a Ballistic
 * weapon when you use it as a Close Combat Bludgeon." Its Bludgeon attacks are generated effects (the
 * Perk's AlternateEffect rules, keyed ...:pistolWhip...; o3GeneratedKey on older ones), so every Ballistic
 * check that goes through _getParentWeapon sees the weapon without its Ballistic trait.
 * @param {Item} weaponEffect
 * @returns {Boolean}
 */
export function isPistolWhipEffect(weaponEffect) {
  const flags = weaponEffect?.flags?.essence20;
  return String(flags?.generatedKey ?? flags?.o3GeneratedKey ?? '').includes(':pistolWhip');
}

/** The weapon as a Pistol Whip Bludgeon sees it: everything the same except no Ballistic trait. */
export function withoutBallistic(weapon) {
  if (!weapon) {
    return weapon;
  }

  const system = Object.create(weapon.system);
  const strip = traits => (traits ?? []).filter(trait => trait != 'ballistic');
  system.traits = strip(weapon.system?.traits);
  system.itemAndUpgradeTraits = strip(weapon.system?.itemAndUpgradeTraits);
  const view = Object.create(weapon);
  Object.defineProperty(view, 'system', { value: system });
  return view;
}

export class Dice {
  /**
   * Dice constructor.
   * @param {ChatMessage} chatMessage   The ChatMessage to use.
   * @param {RollDialog} rollDialog   The RollDialog to use.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(chatMessage, rollDialog, i18n=null) {
    this._chatMessage = chatMessage;
    this._rollDialog = rollDialog;
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
   * Prepares the given actor for rolling initiative.
   * @param {Actor} actor   The actor performing the roll.
   */
  async prepareInitiativeRoll(actor) {
    const initSkill = actor.system.initiative.skill;

    // Prepare for War, Sirens Blaring, Ready For Anything, Hail Megatron!'s first-round ↑1, Peerless
    // Pilot (GI Joe CRB), Daredevil, Area Awareness, Community Helper's National Guard option, Wisdom
    // of the Elders' Enhanced Reflexes, On Your Feet (the holder's own Edge) and the "roll <Skill>
    // instead" swaps (Ever Vigilant, Nose for Trouble, Danger Sense, Needle Drop, Rapid Deployment
    // Drills, Spoof, Your Reputation Precedes You, Cobra Battle Cry, Deceptive Warfare) are their
    // items' own rules, read below with the rest of the item rules.
    // Tactical Meditation - see hasNearbyTacticalMeditation's own doc comment. The Initiative half
    // of its aura (Alertness lives in rollSkill() instead, since Initiative never rolls through
    // that path in practice).
    const tacticalMeditationShiftUp = hasNearbyTacticalMeditation(actor) ? 2 : 0;
    // Light Chassis (PR CRB, Zord Feature, p.137): "While in a Combined Megaform, it grants ↑1 to
    // the Megaform's Initiative Skill Test." A Megaform rolls its own Initiative the same way any
    // other actor does (same reasoning as Enhanced Initiative's hasEnhancedInitiativeEdge below -
    // read directly off the flag Essence20Actor#_prepareMegaformZordData computes from its linked
    // Zords' own Light Chassis Feature), an upshift rather than Enhanced Initiative's Edge since
    // that's what this Feature's own RAW text grants.
    const lightChassisShiftUp = actor.type == 'megaform' && actor.system.hasLightChassisInitiativeUpshift ? 1 : 0;
    // Warrior Mode (PR CRB, Zord Feature, p.140): "Grants ↑2 to Initiative Skill Tests" while
    // active - see helpers/warrior-mode.mjs's own doc comment for the full Feature and why this
    // is checked on the Zord itself (unlike Light Chassis just above, Warrior Mode isn't a
    // Megaform-facing effect - it's the Zord's own transformed state).
    const warriorModeShiftUp = isWarriorModeActive(actor) ? 2 : 0;
    // Peerless Pilot (PR CRB) - Initiative-Edge half; see PEERLESS_PILOT_PR_ID's own comment above
    // for the RAW text and the Driving-specialization-shift check.
    const isPeerlessPilotPrDriving = actorHasPerk(actor, PEERLESS_PILOT_PR_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && this._hasDrivingSpecializationAtOrAboveD6(actor);
    const dataset = {
      shift: actor.system.skills[initSkill].shift,
      shiftUp: actor.system.skills[initSkill].shiftUp + actor.system.essenceShifts.speed.shiftUp
        + tacticalMeditationShiftUp + lightChassisShiftUp + warriorModeShiftUp,
      shiftDown: actor.system.skills[initSkill].shiftDown + actor.system.essenceShifts.speed.shiftDown,
      skill: initSkill,
      isSpecialized: actor.system.skills[initSkill].isSpecialized,
    };
    // We Improvise - see WE_IMPROVISE_ID's own comment above.
    if (game.combat && actorHasPerk(actor, WE_IMPROVISE_ID) && !hasUsedThisEncounter(actor, WE_IMPROVISE_ENCOUNTER_FLAG)
      && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
      await markUsedThisEncounter(actor, WE_IMPROVISE_ENCOUNTER_FLAG);
    }

    // Iconoclast Origin's Disrupter benefit - see ICONOCLAST_ID's own comment above. A
    // whole-combat scan (every combatant, not a nearby-radius one) - true as soon as any hostile
    // combatant's own Threat Level exceeds the actor's own character level.
    const actorTokenForIconoclast = actor.getActiveTokens?.()?.[0];
    const hasIconoclastEdge = actorHasPerk(actor, ICONOCLAST_ID) && game.combat
      && game.combat.combatants.some(c => c.actor && c.actor.id != actor.id
        && c.token?.disposition !== undefined && c.token.disposition !== actorTokenForIconoclast?.document?.disposition
        && getEffectiveLevel(c.actor) > getEffectiveLevel(actor));
    // On Your Feet - see ON_YOUR_FEET_ID's own comment above. The holder's own Edge is the item's
    // rule; this is an ally holding it - any ally on the canvas (no RAW-stated range), through
    // getNearbyAllyTokens' own Frenemy/Betrayal handling, which an aura rule doesn't have.
    const hasOnYourFeetEdge = getNearbyAllyTokens(actor, Infinity)
      .some(token => actorHasPerk(token.actor, ON_YOUR_FEET_ID));
    // Enhanced Initiative (Transformers Combiner Feature, Enigma of Combination, p.42): "Your
    // Combiner form gains Edge on Initiative Skill Tests." A Combiner rolls its own Initiative
    // (Combat#rollInitiative, same as any other actor), so this reads directly off the flag
    // _prepareMegaformCombinerData computes from its components' own megaformTrait items.
    const hasEnhancedInitiativeEdge = actor.type == 'megaform' && actor.system.hasEnhancedInitiative;
    // Relic Key - see helpers/relic-key.mjs's own doc comment. A declared, one-roll-only Edge
    // grant rather than an automatic check like every other Edge above - consumed (cleared) below
    // once it actually lands on this roll, so it doesn't linger onto the next one.
    const hasRelicKeyEdge = isRelicKeyEdgeActive(actor);
    // Speed Boost - see helpers/speed-boost.mjs. One banked Edge per 1 Power spent, consumed below
    // the same way as Relic Key's just above.
    const hasSpeedBoostEdge = isSpeedBoostEdgeActive(actor);
    // Resourceful (Transformers CRB, Scout, 12th level, p.85) - see its own doc comment
    // (helpers/resourceful.mjs). "Roll Initiative Skill Tests with an Edge", one of its 2 built
    // benefits.
    const hasResourcefulEdge = isResourcefulEdgeActive(actor);
    const skillDataset = {
      edge: actor.system.skills[initSkill].edge
        || isPeerlessPilotPrDriving || hasIconoclastEdge || hasOnYourFeetEdge
        || hasEnhancedInitiativeEdge || hasRelicKeyEdge || hasSpeedBoostEdge || hasResourcefulEdge,
      shift: actor.system.skills[initSkill].shift,
      snag: actor.system.skills[initSkill].snag,
    };
    if (hasRelicKeyEdge) {
      await consumeRelicKeyEdge(actor);
    }

    if (hasSpeedBoostEdge) {
      await consumeSpeedBoostEdge(actor);
    }

    // Item rules (rules/adapter.mjs): RollModifiers with `roll:initiative` add their shifts / Edge /
    // Snag, listed as sources the player can switch off; DialogSwitches are offered as checkboxes.
    const ruleRoll = { rolledSkill: initSkill, dataset: { ...dataset, isInitiative: true }, baseShift: actor.system.skills[initSkill].shift };
    const ruleSources = ruleRollSources(actor, null, ruleRoll);
    for (const source of ruleSources.sources) {
      dataset.shiftUp += Number(source.shiftUp) || 0;
      dataset.shiftDown += Number(source.shiftDown) || 0;
      skillDataset.edge ||= !!source.edge;
      skillDataset.snag ||= !!source.snag;
    }

    // A rule that makes this roll Specialized (RollModifier specialize: Springy).
    if (!dataset.isSpecialized && extSpecializes(actor, initSkill, null, ruleRoll.dataset)) {
      dataset.isSpecialized = true;
    }

    dataset.combatModifierSources = ruleSources.sources.map(source => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...source }));
    const ruleToggles = extDialogToggles(actor, ruleRoll);
    if (ruleToggles.length) {
      dataset.extToggles = ruleToggles;
    }

    const skillRollOptions = await this._rollDialog.getSkillRollOptions(dataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return false;
    }

    for (const source of dataset.combatModifierSources) {
      if (skillRollOptions.disabledModifierSourceIds?.includes(source.id)) {
        skillRollOptions.shiftUp -= source.shiftUp;
        skillRollOptions.shiftDown -= source.shiftDown;
      }
    }

    await runApplyDialog(actor, skillRollOptions, ruleRoll);
    for (const consume of ruleSources.consumes) {
      await runConsumer(consume);
    }

    for (const initiativeExtension of INITIATIVE_EXTENSIONS) {
      try {
        await initiativeExtension(actor, skillRollOptions);
      } catch (error) {
        console.error('Essence20 | initiative extension failed', error);
      }
    }

    // Roadside Assistant - see ROADSIDE_ASSISTANT_ID's own comment above. Not gated on the roll's
    // own outcome (RAW: "when you roll," not "on a success") - just on actually being seated in a
    // vehicle and not having already granted it this combat.
    if (actorHasPerk(actor, ROADSIDE_ASSISTANT_ID) && !hasUsedThisEncounter(actor, ROADSIDE_ASSISTANT_ENCOUNTER_FLAG)) {
      const pilotedVehicle = this._getPilotedVehicle(actor);
      if (pilotedVehicle) {
        await pilotedVehicle.update({ 'system.health.bonus': (pilotedVehicle.system.health.bonus ?? 0) + 1 });
        await markUsedThisEncounter(actor, ROADSIDE_ASSISTANT_ENCOUNTER_FLAG);
      }
    }

    // "Friendly" Fire - see FRIENDLY_FIRE_ID's own comment above. Remember the combat whose
    // Initiative went through Spoof: one of the Spoof item's own "roll <Skill> instead" switches ticked.
    const spoof = game.combat && actorHasPerk(actor, FRIENDLY_FIRE_ID) ? findPerk(actor, SPOOF_ID) : null;
    if (spoof?.system.rules?.some((rule, index) => rule?.useSkill && skillRollOptions.ext?.[ruleId(spoof, index)])) {
      await actor.setFlag('essence20', FRIENDLY_FIRE_SPOOF_FLAG, game.combat.id);
    }

    const finalShift = this._getFinalShift(
      skillRollOptions, actor.system.skills[initSkill].shift, E20.initiativeShiftList);
    await actor.update({
      "system.initiative.formula": this._getFormula(
        skillRollOptions.isSpecialized, skillRollOptions, finalShift, actor.system.skills[initSkill].modifier),
    });

    return true;
  }

  /**
   * Handle skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} rawDataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   */
  async rollSkill(rawDataset, actor, item=null) {
    const dataset = { // Converting strings to usable types
      ...rawDataset,
      shiftDown: parseInt(rawDataset.shiftDown),
      shiftUp: parseInt(rawDataset.shiftUp),
      isSpecialized: rawDataset.isSpecialized
        && rawDataset.isSpecialized != 'false'
        || !!item?.system?.isSpecialized,
      canCritD2: rawDataset.canCritD2 && rawDataset.canCritD2 != 'false',
    };
    // Extensions that change the roll itself - a Skill substitution, a forced Specialization
    // (helpers/extensions.mjs).
    await runPreRoll(actor, dataset, item);
    // An extension refused the roll (a jammed weapon, an untargetable crew...) and said why.
    if (dataset.cancelRoll) {
      return;
    }

    const rolledSkill = dataset.skill;
    let rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];

    // Terrifying Presence (GI Joe Core Rulebook, General Perk, p.134-135) - see
    // helpers/terrifying-presence.mjs's own doc comment. Resolved this early (before anything else
    // in this method) since it's a rider on ANY qualifying Intimidation Attack, not tied to a
    // specific Item the way most pre-roll pickers are - Growl/Frightening Display both reach this
    // method directly with no Item at all.
    const terrifyingPresenceRider = await pickTerrifyingPresenceRider(actor, rolledSkill, dataset.defenseType);

    // Unstable, third stack (Across the Stars p.26): "renders the hardpoint weapons inoperable, and
    // the vessel can no longer make attacks with its hardpoint weapons until repaired."
    if (item?.type == 'weaponEffect' && actor?.type == 'vehicle' && areHardpointWeaponsInoperable(actor)) {
      ui.notifications.warn(this._localize('E20.VesselConditionUnstableInoperable', { name: actor.name }));
      return;
    }

    // A "1/scene" Battlizer attack (helpers/summons.mjs) - Energy Sword Time Strike, Battle Fire Saber.
    // Counted once the roll goes ahead, below the dialog's cancellation check.
    const battlizerWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    if (battlizerAttackUsedUp(actor, battlizerWeapon)) {
      ui.notifications.warn(`${battlizerWeapon.name}: ${this._localize('E20.OncePerScene')}`);
      return;
    }

    // Limited Articulation - see LIMITED_ARTICULATION_SKILLS' own comment above.
    if (LIMITED_ARTICULATION_SKILLS.includes(rolledSkill) && actor.system.altModeId) {
      const activeAltMode = actor.items?.get(actor.system.altModeId);
      if (activeAltMode?.system.limitedArticulation && !zord2IgnoresLimitedArticulation(actor)) {
        ui.notifications.error(this._localize('E20.LimitedArticulationError', { skill: this._localize(E20.skills[rolledSkill]) }));
        return;
      }
    }

    // "When a creature is Defeated, it can no longer take actions normally, but a player may
    // spend a Story Point to momentarily act as though it has not been Defeated" (GI Joe CRB
    // p.209; PR p.173 and MLP p.187 say the same - Transformers p.161 charges an Energon Point
    // instead, which is its own resource and not offered here). Asked at the moment the actor
    // goes to act, and once per turn: the point buys the turn, not the roll. The action budget
    // (documents/actor.mjs) reads the same flag, so the bought turn has its actions back too.
    // Declining does not block the roll - this system has never refused a Defeated actor's
    // dice, and a table that plays that loosely should not be stopped by a dialog.
    if (actor?.statuses?.has('defeated') && !hasUsedThisTurn(actor, ACT_WHILE_DEFEATED_FLAG)
      && actor.type != 'vehicle' && actor.type != 'zord' && canSpendForActor(actor)) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: this._localize('E20.SptActWhileDefeatedTitle') },
        content: `<p>${this._localize('E20.SptActWhileDefeatedPrompt', { name: actor.name })}</p>`,
        rejectClose: false,
      });

      if (confirmed) {
        await spendForActor(actor, 1, { announce: false });
        await markUsedThisTurn(actor, ACT_WHILE_DEFEATED_FLAG);
        this._chatMessage.create({
          speaker: this._chatMessage.getSpeaker({ actor }),
          content: this._localize('E20.SptActWhileDefeated', { name: actor.name }),
        });
      }
    }

    // Exemplary - see helpers/exemplary.mjs's own doc comment. Recorded regardless of the roll's
    // own outcome, as early as rolledSkill itself is known.
    await recordExemplaryRoll(actor, rolledSkill);

    // Academic Studies (WTNV Citizen's Guide, Student Origin, p.30): "Choose a non-Smarts-based
    // Skill. That Skill is considered a Smarts-based Skill for you." Same choiceType:'skills'
    // mechanism as Awesome/Trade Experience - overrides whichever Essence this roll would
    // otherwise use (even one explicitly passed via dataset.essence) for the chosen skill only.
    // The "Fumble grants 2 Story Points instead of 1" half needs a base "Fumble grants 1 Story
    // Point" core rule this codebase doesn't automate anywhere yet - flagged, not built.
    if (findPerk(actor, ACADEMIC_STUDIES_ID)?.system.choice == rolledSkill) {
      rolledEssence = 'smarts';
    }

    const essenceShifts = actor.system.essenceShifts;
    // The specific Specialization being rolled, if any (essence-skills.hbs sets
    // data-specialization-key to its slug key - see helpers/utils.mjs#slugifySpecializationName).
    // Looked up directly off the actor rather than trusted from the dataset, so a Perk's Active
    // Effect targeting system.skills.<skill>.specializations.<key>.shiftUp/edge/etc (see
    // essence20-specialization-redesign) actually reaches the roll.
    const specialization = dataset.specializationKey
      ? actor.system.skills[rolledSkill]?.specializations?.[dataset.specializationKey]
      : null;
    const combatModifiers = this._getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill, dataset);
    if (combatModifiers.debilitatedConsumed) {
      await actor.unsetFlag('essence20', 'debilitated');
    }

    // High-Density - see helpers/high-density.mjs's own doc comment. The follow-up Attack's own
    // "(↓1)", folded into the automatic modifiers so it is listed (and toggleable) like any other.
    if (dataset.highDensityFollowUp && item?.type == 'weaponEffect') {
      combatModifiers.shiftDown += HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN;
      combatModifiers.sources.push({
        id: 'highDensityFollowUp', label: this._localize('E20.WeaponTraitHighDensity'),
        shiftUp: 0, shiftDown: HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN, edge: false, snag: false,
      });
    }

    // Kits - helpers/kits.mjs. What a kit used up still gives, and a carried Restricted kit's
    // Specialization or Edge. Competitive Strength's Brawn crits on the d2.
    // Bonded Proficiency - a linked partner's Specializations are shared (helpers/bonded.mjs).
    if (!dataset.isSpecialized && (socialSpecializes(actor, rolledSkill) || extSpecializes(actor, rolledSkill, item, { ...dataset, rolledEssence }))) {
      dataset.isSpecialized = true;
    }

    const kitBoosts = kitSources(actor, rolledSkill, specialization?.name ?? null, dataset.isSpecialized);
    for (const source of kitBoosts.sources) {
      combatModifiers.shiftUp += source.shiftUp;
      combatModifiers.edge ||= source.edge;
      combatModifiers.sources.push(source);
    }

    if (kitBoosts.specialize) {
      dataset.isSpecialized = true;
    }

    // Iron Bravado - see IRON_BRAVADO_ID's own comment above. Stamped on any Attack, hit or miss.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, IRON_BRAVADO_ID)) {
      await markIronBravadoAttack(actor);
    }

    // Think On It / Plan of Action (see helpers/banked-buffs.mjs) - same "reported, not cleared,
    // by the synchronous function above" shape as debilitatedConsumed.
    for (const flagKey of combatModifiers.pendingBonusesToClear) {
      await clearPendingBonus(actor, flagKey);
    }

    // Bonuses banked by item rules (rules/bank.mjs) are spent here too, at the same point and for
    // the same reason - a plain roll with no target or DIF never reaches applyRollRiders, which
    // skips them for that reason.
    for (const consume of combatModifiers.riderConsumes ?? []) {
      if (['rulesBank', 'rulesLimit'].includes(consume.ext)) {
        await runConsumer(consume);
      }
    }

    // Enemy Number One (Tank Focus, 3rd level) - the function above is synchronous and can't mark
    // the "attacked the Tank this turn" flag itself, same reasoning as debilitatedConsumed above.
    if (combatModifiers.enemyNumberOneTankId) {
      await markAttackedEnemyNumberOne(actor, combatModifiers.enemyNumberOneTankId);
    }

    // Spot - see isSpotAttempt's own comment below and spottedTarget's own comment in
    // _getAutomaticCombatModifiers. Clears the TARGET's own flag (not the roller's), since that's
    // whose one-shot mark was just consumed by this attack.
    if (combatModifiers.spottedTarget) {
      await combatModifiers.spottedTarget.unsetFlag('essence20', 'spotted');
    }

    // Two Heads Are Better Than One - see TWO_HEADS_ARE_BETTER_THAN_ONE_ID's own comment above.
    // Clears the ROLLER's own mark (unlike spottedTarget just above, which clears the target's).
    if (combatModifiers.twoHeadsAssistanceConsumed) {
      await consumeTwoHeadsAssistance(actor);
    }

    // Eye for Appraisal - see eyeForAppraisalTarget's own comment in
    // _getAutomaticCombatModifiers. Decrements the TARGET's own 2-use mark by one, clearing it
    // outright once both uses are spent.
    if (combatModifiers.eyeForAppraisalTarget) {
      const mark = combatModifiers.eyeForAppraisalTarget.getFlag('essence20', 'eyeForAppraisalMark');
      const usesRemaining = (mark?.usesRemaining ?? 1) - 1;
      if (usesRemaining > 0) {
        await combatModifiers.eyeForAppraisalTarget.setFlag('essence20', 'eyeForAppraisalMark', { ...mark, usesRemaining });
      } else {
        await combatModifiers.eyeForAppraisalTarget.unsetFlag('essence20', 'eyeForAppraisalMark');
      }
    }

    // Team Focus (Red Ranger, 9th/18th level) - marks the target as attacked, for a teammate's
    // later Team Focus check this round to read back - see helpers/team-focus.mjs's own doc
    // comment. Any weaponEffect attack marks it, regardless of the roller holding the Perk
    // themselves; the shiftUp itself is granted separately, in _getAutomaticCombatModifiers.
    if (item?.type == 'weaponEffect') {
      const teamFocusTarget = game.user.targets.first()?.actor;
      if (teamFocusTarget) {
        await markAttackedByAlly(actor, teamFocusTarget);
      }
    }

    // The Quiet One - see helpers/quiet-one.mjs's own doc comment. Marks any Driving roll, or any
    // weaponEffect attack with a weapon lacking the Silent trait (an unarmed attack, with no
    // weapon at all, also counts - the same "no parent weapon" proxy this project already uses
    // elsewhere never carries a Silent trait either), regardless of the roller holding The Quiet
    // One themselves - unconditional on the roll's own outcome, since RAW says "operated" or
    // "attacked with," not "successfully."
    if (rolledSkill == 'driving'
      || (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)?.system.traits?.includes('silent'))) {
      await markQuietOneNoisyAction(actor);
    }

    // Move Like a Song (Green Ranger, Survival Boon choice) - the function above is synchronous
    // and can't mark the "first attack this round" flag itself, same reasoning as
    // debilitatedConsumed/enemyNumberOneTankId above.
    if (combatModifiers.moveLikeASongTriggered) {
      const moveLikeASongTarget = game.user.targets.first()?.actor;
      if (moveLikeASongTarget) {
        await markUsedThisRound(moveLikeASongTarget, MOVE_LIKE_A_SONG_ROUND_FLAG);
      }
    }

    // Emotional Mastery: Disgust - same synchronous-function-can't-await shape as Move Like a
    // Song just above.
    if (combatModifiers.disgustTriggered) {
      const disgustTarget = game.user.targets.first()?.actor;
      if (disgustTarget) {
        await markUsedThisTurn(disgustTarget, DISGUST_TURN_FLAG);
      }
    }

    // Ninja Powered: Balance of Justice - see NINJA_POWERED_BALANCE_OF_JUSTICE_ID's own comment
    // above. Same synchronous-function-can't-await shape as Move Like a Song just above.
    if (combatModifiers.balanceOfJusticeTriggered) {
      const balanceOfJusticeTarget = game.user.targets.first()?.actor;
      if (balanceOfJusticeTarget) {
        await markUsedThisRound(balanceOfJusticeTarget, BALANCE_OF_JUSTICE_ROUND_FLAG);
      }
    }

    // Don't Underestimate Me - see DONT_UNDERESTIMATE_ME_ID's own comment above. Same
    // synchronous-function-can't-await shape as Move Like a Song/Balance of Justice just above.
    if (combatModifiers.dontUnderestimateMeTriggered) {
      const dontUnderestimateMeTarget = game.user.targets.first()?.actor;
      if (dontUnderestimateMeTarget) {
        await markUsedThisScene(dontUnderestimateMeTarget, DONT_UNDERESTIMATE_ME_SCENE_FLAG);
      }
    }

    // Range for Ranged Attacks (p.201): "Attacks with these weapons can't be made closer than
    // their minimum range" - the one real hard block anywhere in this file (everything else here
    // only ever suggests, via shift/Edge/Snag, never refuses). Checked here, before the Roll
    // Options Dialog even opens, rather than after the player fills it out only to be told it
    // never counted - the minimum-range violation is a fixed fact about the attack itself that no
    // dialog choice could ever change.
    if (combatModifiers.tooCloseForMinimumRange) {
      this._chatMessage.create({
        speaker: this._chatMessage.getSpeaker({ actor }),
        content: this._localize('E20.RollTooCloseMinimumRange'),
      });

      return;
    }

    // Morphed-only bonuses (essenceShifts[essence].morphed, e.g. the Supercharged Essence Perk,
    // PR CRB p.98) stack on top of the always-on shiftUp only while the actor is actually
    // Morphed. Non-character actor types (vehicle/zord/megaform) have no isMorphed field at all,
    // so this is always 0 for them rather than throwing.
    const morphedShiftUp = actor.system.isMorphed && rolledEssence
      ? essenceShifts[rolledEssence].morphed
      : 0;
    let calculatedShiftUp = 0;
    let calculatedShiftDown = 0;
    if (rolledEssence) {
      calculatedShiftUp = dataset.shiftUp + essenceShifts[rolledEssence].shiftUp + essenceShifts.any.shiftUp + morphedShiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts[rolledEssence].shiftDown + essenceShifts.any.shiftDown;
    } else {
      calculatedShiftUp = dataset.shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts.any.shiftDown;
    }

    calculatedShiftUp += combatModifiers.shiftUp + (specialization?.shiftUp || 0);
    calculatedShiftDown += combatModifiers.shiftDown + (specialization?.shiftDown || 0);

    // Sabotage - see SABOTAGE_ID's own comment above.
    if (rolledSkill == 'technology' && actorHasPerk(actor, SABOTAGE_ID)) {
      calculatedShiftUp += getSneakAttackDamage(actor);
    }

    // Every equipped armor this actor is wearing right now - shared by Enhance Skill/Xenotech/
    // Regal (armor traits) just below, the same "filter documentsByType.armor for equipped" idiom
    // _getPlatingArmorToughness/_getDeflectiveArmorToughness already use for combat modifiers.
    const equippedArmor = actor.items?.documentsByType?.armor?.filter(a => a.system.equipped) ?? [];

    // Enhance Skill (Across the Stars, Armor Traits, p.85): "Integrated technology or other
    // enhancements in this armor grant ↑1 to the Skill listed in the parentheses." Summed across
    // every equipped armor naming this Skill, the same stacking assumption Bulwark's own Health
    // bonus (documents/actor.mjs#_prepareHealth) already makes. The compendium armors carry their
    // Enhance Skill ↑1 as an Active Effect on the Skill itself instead (Titan War Rig names two Skills,
    // which the single enhanceSkillTarget field can't), so an armor whose own effects already shift
    // this Skill is skipped here - otherwise setting its target would double the ↑1.
    const shiftKey = `system.skills.${rolledSkill}.shiftUp`;
    calculatedShiftUp += equippedArmor
      .filter(a => a.system.traits?.includes('enhanceSkill') && a.system.enhanceSkillTarget == rolledSkill)
      .filter(a => !(a.effects ?? []).some(e => !e.disabled
        && (e.system?.changes ?? e.changes ?? []).some(c => c.key == shiftKey)))
      .length;

    // Xenotech (Across the Stars, Armor Traits, p.85): "This armor is designed around alien
    // cultures and species' unique and potentially awkward physical requirements... The wearer
    // suffers ↓1 to Athletics and Acrobatics Skill Tests." Distinct from the weapon trait of the
    // same name (a per-weapon Snag-until-Critical-Success gate - not yet built, see the weapon
    // trait audit's own notes) - armor and weapon Xenotech share a config key but not a rule.
    if (['athletics', 'acrobatics'].includes(rolledSkill)) {
      calculatedShiftDown += equippedArmor.filter(a => a.system.traits?.includes('xenotech')).length;
    }

    // Regal (Across the Stars, Armor Traits, p.82): "Regal armor grants ↑1 to Persuasion Skill
    // Tests used on allies and Intimidation Skill Tests against enemies." "Allies"/"enemies" read
    // as the established disposition-equality ally proxy (helpers/comic-flair.mjs's own doc
    // comment) against whichever token is currently targeted - with nothing targeted, neither
    // clause has anything to check against, so it grants nothing rather than guessing.
    if ((rolledSkill == 'persuasion' || rolledSkill == 'intimidation')
      && equippedArmor.some(a => a.system.traits?.includes('regal'))) {
      const actorToken = actor?.getActiveTokens?.()?.[0];
      const targetToken = game.user?.targets?.first?.();
      if (actorToken && targetToken) {
        const isNonEnemy = targetToken === actorToken
          || targetToken.document.disposition === actorToken.document.disposition;
        if ((rolledSkill == 'persuasion' && isNonEnemy) || (rolledSkill == 'intimidation' && !isNonEnemy)) {
          calculatedShiftUp += 1;
        }
      }
    }

    // Enviro-Sealed (Across the Stars, Armor Traits, p.85): "grants immunity to most
    // environmental conditions and grants Edge on all Skill Tests made to resist adverse
    // situations." "Which Skill Tests actually resist an adverse situation" isn't a concept this
    // codebase can identify in general (the same "no hook to check a fictional qualifier against"
    // gap Environmental Expertise's own doc comment already accepts), so the Edge comes from a Roll
    // Options Dialog checkbox (updatedShiftDataset.enviroSealedAdverseSituationAvailable below). It
    // starts ticked in the one adverse-situation case this CAN check for free - the wearer's own
    // physical environment (helpers/environment.mjs) being anything other than `normal` - and is
    // the player's call otherwise (resisting poison, fear, disease, and the like). The immunity half
    // ("most environmental conditions") isn't built - this system has no generic "environmental
    // condition" category to grant immunity from.
    const hasEnviroSealedEdge = isEnviroSealedEdgeActive(equippedArmor, getEnvironment(actor));

    // Nemesis (Decepticon Directive, Influence Perk, p.27) - see helpers/nemesis-decepticon.mjs's
    // own doc comment. "Non-combat" reuses Cobra Battle School Graduate's own item?.type !=
    // 'weaponEffect' proxy just above; "related to your nemesis" reads as the roll actually
    // targeting them, the same currently-targeted-token idiom Regal just above uses.
    if (item?.type != 'weaponEffect' && actorHasPerk(actor, NEMESIS_DD_PERK_ID)) {
      const nemesisTargetActor = game.user?.targets?.first?.()?.actor;
      if (isDecepticonNemesis(actor, nemesisTargetActor)) {
        calculatedShiftUp += 1;
      }
    }

    // Nemesis, Mandatory Hang-Up (Decepticon Directive, p.27) - see
    // helpers/nemesis-decepticon.mjs's own doc comment. "Involved in a scene with your nemesis" =
    // isNemesisInScene; the exemption is a Skill Test actually targeting them (or, for an attack,
    // resolved per-target instead - approximated here the same way as every other pre-roll
    // automatic modifier, checked against whichever token is currently targeted).
    if (actorHasHangUp(actor, NEMESIS_DD_HANGUP_ID) && isNemesisInScene(actor)) {
      const nemesisTargetActor = game.user?.targets?.first?.()?.actor;
      if (!isDecepticonNemesis(actor, nemesisTargetActor)) {
        calculatedShiftDown += 1;
      }
    }

    /* Lend Assistance, skill half (GI Joe CRB p.197): "if a character has at least as many
       levels in a given skill as their ally, they may Lend Assistance to that ally to give them
       an automatic up-1 shift to their use of that given skill." Banked on the ally by
       helpers/lend-assistance.mjs, which is also where the levels prerequisite is checked -
       by the time it reaches here the grant has already been earned. Same shape as Shoulder To
       Shoulder just below, and cleared the same way: consumed by the first matching roll. */
    const pendingLendAssistanceShift = getPendingBonus(actor, LEND_ASSISTANCE_SHIFT_FLAG);
    // The assister's Perks can add an Edge to the same grant (Bureaucrat, Greenshirt, Teacher,
    // Lesson Plan - see lend-assistance.mjs#getAssistEdge). skillDataset doesn't exist yet at
    // this point, so it is remembered here and applied once it does, further down.
    let lendAssistanceEdge = false;
    // Misled (MLP CRB, Mentor Influence Hang-Up, p.53) - see MISLED_HANGUP_ID's own comment
    // below. Only matters if the assister actually holds the Hang-Up, remembered here (the
    // assister's own uuid, banked alongside the shift by lend-assistance.mjs) so the post-roll
    // processing below can check it on a failure, without re-deriving who assisted.
    let lendAssistanceAssisterUuid = null;
    if (pendingLendAssistanceShift?.skill == rolledSkill && imperfectionOf(actor)?.n != 7) {
      // Defaulted so a flag banked before the Perk upgrades existed still applies its ↑1.
      calculatedShiftUp += pendingLendAssistanceShift.shiftUp ?? 1;
      lendAssistanceEdge = !!pendingLendAssistanceShift.edge;
      lendAssistanceAssisterUuid = pendingLendAssistanceShift.assisterUuid ?? null;
      // Those Who Know, Teach (MLP CRB, Mentor Influence, p.53) - see its own comment in
      // helpers/lend-assistance.mjs. A persistent grant keeps matching every roll of this same
      // skill for the rest of the encounter instead of being cleared after the first.
      if (!pendingLendAssistanceShift.persistent) {
        await clearPendingBonus(actor, LEND_ASSISTANCE_SHIFT_FLAG);
      }
    }

    // Friendship Circle (MLP CRB, every Spirit Role, 1st level) - see
    // helpers/friendship-circle.mjs. "↑1 on a Skill Test per Pony in the Friendship Circle", drawn
    // from the shared pool onto this pony and taken by whichever Skill Test they make next.
    // Added here so the Roll Options Dialog opens showing it, but only CLEARED once the roll is
    // committed (below, after the dialog) - a cancelled dialog must not burn what the pony drew.
    const pendingCircleShift = getPendingBonus(actor, CIRCLE_SHIFT_FLAG);
    if (pendingCircleShift?.shiftUp) {
      calculatedShiftUp += pendingCircleShift.shiftUp;
    }

    // Shoulder To Shoulder (Focus: Frontline Leader, 3rd level, p.87) - see
    // helpers/shoulder-to-shoulder.mjs's own doc comment.
    const pendingShoulderToShoulder = getPendingBonus(actor, SHOULDER_TO_SHOULDER_FLAG);
    if (pendingShoulderToShoulder?.skill == rolledSkill) {
      calculatedShiftUp += pendingShoulderToShoulder.shiftUp;
      await clearPendingBonus(actor, SHOULDER_TO_SHOULDER_FLAG);
    }

    // Calm Beast (Beneath the Helmet, Aqua Ranger, Grid Science I choice, p.41): "↑1 on Animal
    // Handling (Calming) Skill Tests." Unlike a Perk-driven flat system.skills.<skill>.shiftUp
    // Active Effect, a Specialization has no stable id a compendium item could target - each
    // actor creates their own Specializations with their own opaque, player-generated ids (see
    // data/actor/templates/common.mjs's own comment on specializations) - so this matches by the
    // Specialization's own NAME instead, the same "look up an actor-defined resource by exact
    // name" idiom helpers/reroll.mjs#findRolePointsItem already established for named RolePoints
    // items (e.g. "Cheer Points").
    if (rolledSkill == 'animalHandling' && specialization?.name?.toLowerCase() == 'calming'
      && actorHasPerk(actor, CALM_BEAST_ID)) {
      calculatedShiftUp += 1;
    }

    // Chivalrous - see CHIVALROUS_ID's own comment above. Same specialization-name match as Calm
    // Beast just above, scoped to Persuasion (Diplomacy).
    if (rolledSkill == 'persuasion' && specialization?.name?.toLowerCase() == 'diplomacy'
      && actorHasPerk(actor, CHIVALROUS_ID)) {
      calculatedShiftUp += 2;
    }

    // Puzzle Solver - see PUZZLE_SOLVER_ID's own comment above. RAW's "that directly involve
    // resolving the current adventure" is an unenforceable narrative qualifier, dropped.
    if (rolledSkill == 'alertness' && specialization?.name?.toLowerCase() == 'investigation'
      && actorHasPerk(actor, PUZZLE_SOLVER_ID)) {
      calculatedShiftUp += 1;
    }

    // Psych 101 (Enigma of Combination, Counselor Focus, 1st level, p.34): "If you have any
    // Specialization in the Science Skill, you gain upshift 2 on all Culture Skill Tests
    // concerning living beings." Unlike Calm Beast/Astro-Sense above (which match the
    // Specialization actually being ROLLED WITH), this is a static prerequisite check against the
    // actor's own Science skill's Specializations table - any Specialization at all qualifies, not
    // a specific named one, and it grants a bonus on a DIFFERENT skill (Culture) than the one the
    // Specialization lives on. "Concerning living beings" is dropped as an unenforceable narrative
    // qualifier, the same idiom already applied throughout this project.
    if (rolledSkill == 'culture' && actorHasPerk(actor, PSYCH_101_ID)
      && Object.keys(actor.system.skills.science?.specializations ?? {}).length) {
      calculatedShiftUp += 2;
    }

    // Charge Into Battle (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72): "↑1 on
    // Attack Skill Tests against multiple direct targets." Computed here (before the shift total
    // is finalized and handed to the dialog), a separate, earlier call to the same
    // isMultipleTargetsWeapon() check dice.mjs's own damage-bonus block calls again later for its
    // own checkContext bookkeeping - cheap and pure, no need to thread the result through. The
    // "grants Multiple Targets (2) to a wielded Melee Power Weapon lacking it" clause widens
    // isMultipleTargetsWeapon() itself (see its own doc comment in multiple-targets.mjs), so it's
    // already reflected here automatically, not a separate check.
    if (item?.type == 'weaponEffect' && isMultipleTargetsWeapon(actor, item)
      && actorHasPerk(actor, CHARGE_INTO_BATTLE_ID)) {
      calculatedShiftUp += 1;
    }

    // Expertise cancels one point of downshift out of the fully-stacked total ("the first"),
    // not any one particular source of it - see EXPERTISE_PERK_IDS's own doc comment.
    if (this._hasExpertiseDownshiftImmunity(actor, rolledSkill)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
    }

    // Low Tech Priorities (A Jump Through Time, Low Tech Origin Benefit, p.28) - see
    // LOW_TECH_PRIORITIES_ID's own comment above. Same "cancel one point of downshift" mechanic as
    // Expertise just above, but scoped to whichever 2 skills were chosen (checked across every
    // instance the actor holds, since numChoices:2 produces 2 separate items each with their own
    // system.choice - see getAlreadyChosenExpertiseSkills' own comment for why that shape was kept
    // rather than a single comma-joined value) and capped once per turn, unlike Expertise's own
    // unconditional-every-roll version.
    if (calculatedShiftDown > 0 && !hasUsedThisTurn(actor, LOW_TECH_PRIORITIES_FLAG)
      && actor.items.some(actorItem => actorItem.type == 'perk'
        && (actorItem.flags.core?.sourceId ?? actorItem._stats?.compendiumSource ?? actorItem?.flags?.essence20?.rulesSource) == LOW_TECH_PRIORITIES_ID
        && actorItem.system.choice == rolledSkill)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
      await markUsedThisTurn(actor, LOW_TECH_PRIORITIES_FLAG);
    }

    // Honest Assessment (MLP CRB, Spirit of Honesty, 14th level, p.79) - see
    // helpers/honest-assessment.mjs's own doc comment. While active: ↑2 on the actor's own chosen
    // Skill (system.choice, same choiceType:'skills' mechanism as Awesome), ↓2 on both Deception
    // and Persuasion (RAW's own fixed self-cost, not player-chosen).
    if (isHonestAssessmentActive(actor)) {
      if (findPerk(actor, HONEST_ASSESSMENT_ID)?.system.choice == rolledSkill) {
        calculatedShiftUp += 2;
      }

      if (rolledSkill == 'deception' || rolledSkill == 'persuasion') {
        calculatedShiftDown += 2;
      }
    }

    // Powerful Suggestions (Enigma of Combination, Counselor Focus, 17th level, p.34) - "fail"
    // half: see helpers/powerful-suggestions.mjs's own doc comment. Downshift-3 on the suggested
    // Skill for as long as the banked suggestion remains - it self-clears the moment the actor
    // achieves a genuine natural Critical Success with that Skill (see the isCrit check in
    // _rollSkillHelper below, "prove you wrong").
    const bankedPowerfulSuggestion = getPendingBonus(actor, POWERFUL_SUGGESTION_FLAG);
    if (bankedPowerfulSuggestion?.skill == rolledSkill && bankedPowerfulSuggestion.effect == 'fail') {
      calculatedShiftDown += 3;
    }

    // Augment Power Weapon - see AUGMENT_POWER_WEAPON_ID's own comment above.
    if (item?.type == 'weaponEffect' && isAugmentPowerWeaponActive(actor)) {
      const augmentPowerWeaponWeapon = this._getParentWeapon(actor, item);
      if (augmentPowerWeaponWeapon?.system.traits.includes('powerWeapon')) {
        calculatedShiftUp += 1;
      }
    }

    // Augmented Combat (Quartermaster's Guide to Gear, Grid Power, p.92) - see
    // helpers/augmented-combat.mjs's own doc comment. Unconditional ↑1 on any weaponEffect Attack
    // while the toggle is active.
    if (item?.type == 'weaponEffect' && isAugmentedCombatActive(actor)) {
      calculatedShiftUp += 1;
    }

    // Zeo Crystal Boost, Morpher option (Across the Stars, Grid Power, p.73) - "upshift 1 on
    // unarmed Attacks" - see helpers/zeo-crystal-boost.mjs's own doc comment. "No parent weapon"
    // is this project's own established unarmed proxy (Phantom Ranger Prime/Pointy/Iron Hooves).
    if (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item) && getZeoCrystalBoostOption(actor) == 'morpher') {
      calculatedShiftUp += 1;
    }

    // Eltarian Training (Through the Shattered Grid, p.73) - see ELTARIAN_TRAINING_ID's own
    // comment above. "Ignore the first -1 penalty on Finesse Skill Tests" - same
    // cancel-one-point-of-the-fully-stacked-total shape as Expertise just above, hard-scoped to
    // Finesse rather than a player-chosen skill.
    if (rolledSkill == 'finesse' && actorHasPerk(actor, ELTARIAN_TRAINING_ID)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
    }

    const updatedShiftDataset = {
      ...dataset,
      shiftUp: calculatedShiftUp,
      shiftDown: calculatedShiftDown,
    };
    const actorSkillData = actor.getRollData().skills[rolledSkill];
    let initialShift = essenceShifts[rolledEssence]?.untrainedBonus && dataset.shift == "d20"
      ? "d2"
      : dataset.shift || actorSkillData.shift;

    // Jacket Wrestler - see JACKET_WRESTLER_ID's own comment above. Unconditional (no "may" in
    // RAW, unlike every other shift-position-delta substitution in this project, which are all
    // player-declared via a checkbox) - substitutes the actor's own Finesse shift directly here
    // rather than through the Roll Options Dialog.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple' && rolledSkill == 'might'
      && actorHasPerk(actor, JACKET_WRESTLER_ID)) {
      const finesseShift = actor.getRollData().skills.finesse?.shift;
      if (finesseShift) {
        initialShift = finesseShift;
      }
    }

    // Aerial Acrobat - see AERIAL_ACROBAT_ID's own comment above. Same unconditional-substitution
    // shape as Jacket Wrestler just above, but over any Attack (not one fixed damageType) and
    // between two alternate skills instead of one - keeps whichever of the current attack skill,
    // Acrobatics, or Driving has the best (lowest-index) shift-list position.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, AERIAL_ACROBAT_ID)) {
      const rollData = actor.getRollData();
      let bestIndex = E20.skillShiftList.indexOf(initialShift);
      for (const altSkill of ['acrobatics', 'driving']) {
        const altShift = rollData.skills[altSkill]?.shift;
        const altIndex = E20.skillShiftList.indexOf(altShift);
        if (altShift && altIndex >= 0 && (bestIndex < 0 || altIndex < bestIndex)) {
          initialShift = altShift;
          bestIndex = altIndex;
        }
      }
    }

    // Kill Counter (Quartermaster's Guide p.56): "Crew can use Driving in place of Intimidation against
    // intelligent creatures who can see the vehicle" - the better of the two.
    if (rolledSkill == 'intimidation' && canUseDrivingForIntimidation(actor)) {
      const drivingShift = actor.getRollData().skills.driving?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const drivingIndex = E20.skillShiftList.indexOf(drivingShift);
      if (drivingShift && drivingIndex >= 0 && (currentIndex < 0 || drivingIndex < currentIndex)) {
        initialShift = drivingShift;
      }
    }

    // Circuit Breaker (Transformers CRB, Scientist, base grant, p.79): "You can use the Technology
    // Skill for attacks with Electric weapons." Same unconditional best-of substitution shape as
    // Jacket Wrestler above (a fixed damageType, one alternate skill), gated on the attack's own
    // Electric damage type or trait the same way _getAutomaticCombatModifiers' own Electric-weapon
    // check already reads it.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, CIRCUIT_BREAKER_ID)
      && (item.system.damageType == 'electric'
        || this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('electric'))) {
      const technologyShift = actor.getRollData().skills.technology?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const technologyIndex = E20.skillShiftList.indexOf(technologyShift);
      if (technologyShift && technologyIndex >= 0 && (currentIndex < 0 || technologyIndex < currentIndex)) {
        initialShift = technologyShift;
      }
    }

    // Cultural Connection - see CULTURAL_CONNECTION_ID's own comment above. Same unconditional
    // best-of substitution as Aerial Acrobat just above, gated on the replaced Skill actually
    // being trained (not d20), plus the 10th-Role-Level Specialized upgrade.
    if (['deception', 'persuasion'].includes(rolledSkill) && actorHasPerk(actor, CULTURAL_CONNECTION_ID)
      && initialShift != 'd20') {
      const cultureShift = actor.getRollData().skills.culture?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const cultureIndex = E20.skillShiftList.indexOf(cultureShift);
      if (cultureShift && cultureIndex >= 0 && cultureIndex < currentIndex) {
        initialShift = cultureShift;
        if (getEffectiveLevel(actor) >= 10) {
          updatedShiftDataset.isSpecialized = true;
        }
      }
    }

    // Brutal Verbalities - see BRUTAL_VERBALITIES_ID's own comment above. Same unconditional
    // best-of substitution shape as Aerial Acrobat/Cultural Connection above, scoped to Rouse's
    // own flat Persuasion check.
    if (dataset.isRouseAttempt && rolledSkill == 'persuasion' && actorHasPerk(actor, BRUTAL_VERBALITIES_ID)) {
      const intimidationShift = actor.getRollData().skills.intimidation?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const intimidationIndex = E20.skillShiftList.indexOf(intimidationShift);
      if (intimidationShift && intimidationIndex >= 0 && intimidationIndex < currentIndex) {
        initialShift = intimidationShift;
      }
    }

    // Agency - see AGENCY_ID's own comment above. Wealth-floor half: unlike Jacket Wrestler's own
    // unconditional substitution, this only raises the shift, never lowers it (a real "floor" -
    // "may never use a die of a LESSER value than"), so it compares both shifts' own position in
    // the shared skillShiftList (a lower index is a better die) and keeps whichever is best.
    const agencyChoice = findPerk(actor, AGENCY_ID)?.system.choice;
    if (rolledSkill == 'wealth' && agencyChoice) {
      const agencySkillShift = actor.getRollData().skills[agencyChoice]?.shift;
      const currentIndex = E20.skillShiftList.findIndex(s => s == initialShift);
      const agencyIndex = E20.skillShiftList.findIndex(s => s == agencySkillShift);
      if (agencyIndex != -1 && agencyIndex < currentIndex) {
        initialShift = agencySkillShift;
      }
    }

    // "A" for Effort! (Intern Origin, p.30): "Once per session, when you attempt an untrained
    // Skill Test, you still roll a d2 Skill Die and don't suffer a Snag." Auto-applied and
    // auto-consumed (no dialog, no "Use" button) the first time it actually matters in the scene -
    // same hasUsedThisEncounter/markUsedThisEncounter idiom as Adaptable above. Checked against
    // dataset.shift directly (the raw, pre-computation value) rather than initialShift, since
    // initialShift may already have been floored to d2 above for an unrelated reason.
    const usesAForEffort = dataset.shift == 'd20' && actorHasPerk(actor, A_FOR_EFFORT_ID)
      && !hasUsedThisEncounter(actor, 'aForEffortUsedThisEncounter');
    if (usesAForEffort) {
      initialShift = 'd2';
    }

    // Basic Intelligence - see BASIC_INTELLIGENCE_ID's own comment above. Same floor-to-d2 shape
    // as "A" for Effort! just above, but unconditional/unlimited (no once-per-session gate).
    const usesBasicIntelligence = dataset.shift == 'd20' && actorHasPerk(actor, BASIC_INTELLIGENCE_ID);
    if (usesBasicIntelligence) {
      initialShift = 'd2';
    }

    // Ageless Knowledge (Across the Stars, Phantom Ranger, 6th level, p.61) - see
    // helpers/ageless-knowledge.mjs's own doc comment. "Unskilled" is just this system's own
    // bottom-tier d2 skill die - floors it at d4 instead for the one banked, matching Skill Test.
    const pendingAgelessKnowledge = getPendingBonus(actor, AGELESS_KNOWLEDGE_FLAG);
    if (pendingAgelessKnowledge?.skill == rolledSkill && initialShift == 'd2') {
      initialShift = 'd4';
      await clearPendingBonus(actor, AGELESS_KNOWLEDGE_FLAG);
    }

    // Paradox (A Jump Through Time, Influence Perk, p.21) - see helpers/paradox.mjs's own doc
    // comment. A genuine +1 shiftUp on the chosen skill (not a floor, unlike Ageless Knowledge
    // above) - the "max of d12" cap needs no explicit clamp, _getFinalShift's own shift-list
    // lookup already tops out there for every shiftUp in this codebase.
    const pendingParadox = getPendingBonus(actor, PARADOX_FLAG);
    if (pendingParadox?.skill == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
      await clearPendingBonus(actor, PARADOX_FLAG);
    }


    // Try, Try Again - see TRY_TRY_AGAIN_ID's own comment above. Same skill-scoped bank/consume
    // shape as Paradox just above, but banked automatically on a failed roll rather than via a
    // "Use" button.
    const pendingTryTryAgain = getPendingBonus(actor, TRY_TRY_AGAIN_FLAG);
    if (pendingTryTryAgain?.skill == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
      await clearPendingBonus(actor, TRY_TRY_AGAIN_FLAG);
    }

    // Arashikage Graduate - see ARASHIKAGE_GRADUATE_HANGUP_ID's own comment above. Any skill (not
    // scoped like Try, Try Again's own bonus), consumed on the actor's very next Skill Test.
    const pendingArashikageGraduate = getPendingBonus(actor, ARASHIKAGE_GRADUATE_FLAG);
    if (pendingArashikageGraduate) {
      updatedShiftDataset.shiftDown += 1;
      await clearPendingBonus(actor, ARASHIKAGE_GRADUATE_FLAG);
    }

    // Fast Learner (GI Joe CRB, Technician/Tinkerer Focus, 1st level) - see
    // helpers/fast-learner.mjs's own doc comment. A standing reallocation (not consumed/cleared
    // after one roll, unlike every pending-bonus check above) - read fresh on every roll of either
    // named skill for as long as the player's current allocation names it.
    const fastLearnerAllocation = getFastLearnerAllocation(actor);
    if (fastLearnerAllocation?.decreaseSkill == rolledSkill) {
      updatedShiftDataset.shiftDown += 1;
    }

    if (fastLearnerAllocation?.increaseSkill == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Extra Rough Training - see helpers/extra-rough-training.mjs's own doc comment. Same
    // skill-scoped bank/consume shape as Ageless Knowledge just above - Edge folds into
    // skillDataset.edge below, the ↑1 (on a failed attempt) into updatedShiftDataset.shiftUp.
    const pendingExtraRoughTraining = getPendingBonus(actor, EXTRA_ROUGH_TRAINING_FLAG);
    const hasExtraRoughTrainingEdge = pendingExtraRoughTraining?.skill == rolledSkill && !!pendingExtraRoughTraining.edge;
    if (pendingExtraRoughTraining?.skill == rolledSkill) {
      if (pendingExtraRoughTraining.shiftUp) {
        updatedShiftDataset.shiftUp += pendingExtraRoughTraining.shiftUp;
      }

      await clearPendingBonus(actor, EXTRA_ROUGH_TRAINING_FLAG);
    }

    // Bio-Energy Conversion (Across the Stars, Zord Feature, p.72) - see its own doc comment.
    // "gain ↑2 on Attack Skill Tests" the round after it's used; self-expires the round after
    // that, no explicit clear needed here.
    if (item?.type == 'weaponEffect' && isBioEnergyConversionActive(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Favorite Weapon - see helpers/favorite-weapon.mjs's own doc comment. "When making attacks
    // with your favorite weapon, you always gain ↑1" - matched via the same parent-weapon lookup
    // Empty the Mag/Augment Power Weapon already use.
    const parentWeaponForFavorite = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const favoriteWeaponItem = getFavoriteWeaponItem(actor);
    if (parentWeaponForFavorite && favoriteWeaponItem && parentWeaponForFavorite.id === favoriteWeaponItem.id) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Relic Key - see helpers/relic-key.mjs's own doc comment. A declared, one-roll-only Edge
    // grant (unlike every other check just above, which are all live conditions rather than a
    // player's own prior declaration) - consumed (cleared) below once it actually lands on this
    // roll, the same "any ONE roll" scope as its own RAW text, applying here regardless of
    // rolledSkill since RAW doesn't restrict it to attacks specifically.
    const hasRelicKeyEdge = isRelicKeyEdgeActive(actor);
    if (hasRelicKeyEdge) {
      await consumeRelicKeyEdge(actor);
    }

    // Linked (GI Joe CRB, Vehicle Trait, p.173): "Linked weapons gain an Edge on attacks." A
    // weapon-level trait (same idiom as the existing 'ballistic' checks throughout this file,
    // e.g. Worth a Shot/Straight Shooter above), not scoped to Vehicles specifically - RAW's own
    // example Linked weapons (Rocket Launcher, Twin Cannons, ...) are all ordinary weapon items.
    const hasLinkedEdge = item?.type == 'weaponEffect'
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('linked');

    const skillDataset = {
      shift: initialShift,
      // dataset.edge: a plain caller-supplied Edge, for non-combat rollSkill() calls a helper
      // makes directly (e.g. helpers/requisition.mjs#rollRequisition consuming Benefits of
      // Command's own banked Edge) rather than something this method derives itself.
      edge: actorSkillData.edge || !!essenceShifts[rolledEssence]?.edge || combatModifiers.edge
        || !!specialization?.edge || hasExtraRoughTrainingEdge || hasRelicKeyEdge || hasLinkedEdge
        || !!dataset.isRegeneration || !!dataset.edge,
      snag: actorSkillData.snag || !!essenceShifts[rolledEssence]?.snag || combatModifiers.snag
        || !!specialization?.snag,
    };

    // "A" for Effort! - see usesAForEffort's own comment above. Cancels Snag from ANY source
    // (same "override the last write before the dialog" idiom Merit Badges already established)
    // and marks the scene used, now that the roll is confirmed to actually be untrained.
    if (usesAForEffort) {
      skillDataset.snag = false;
      await markUsedThisEncounter(actor, 'aForEffortUsedThisEncounter');
    }

    // Basic Intelligence - see usesBasicIntelligence's own comment above. Cancels Snag from ANY
    // source, same idiom as "A" for Effort! - no encounter flag to mark, this one has no cap.
    if (usesBasicIntelligence) {
      skillDataset.snag = false;
    }

    // Spot Weld (Decepticon Directive, General Perk, p.67) - see helpers/spot-weld.mjs's own doc
    // comment. Stamped via the synthetic dataset itself (not a Perk-lookup) since only
    // activateSpotWeld() knows whether the resolved target is the actor themselves.
    if (dataset.isSpotWeldSelfHeal) {
      skillDataset.snag = true;
    }

    // Spoiled's own Hang-Up (Cobra Codex, Influence, p.34): "You suffer Snag on one requisition
    // check during a mission's Equipment Requisition phase." Detected the same way Ground
    // Suppression/Voice of Night Vale are - a synthetic dataset flag, here already threaded
    // through by helpers/requisition.mjs#rollRequisition's own requisitionItemName field on every
    // Requisition Test - rather than a Perk-lookup keyed on rolledSkill, since a Requisition Test
    // can use any of several different Skills (requisitionSkill()) depending on the item.
    // "One... during a mission" is this project's usual once-per-mission-approximated-as-once-per-
    // scene idiom (getUsesThisScene/markUsedThisScene, same as Green's own GI Joe CRB printing).
    if (dataset.requisitionItemName && actorHasHangUp(actor, SPOILED_HANGUP_ID)
      && getUsesThisScene(actor, SPOILED_USES_FLAG) < 1) {
      skillDataset.snag = true;
      await markUsedThisScene(actor, SPOILED_USES_FLAG);
    }

    // Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): "If you suffer
    // a Snag on any Social-based Skill Test regarding understanding another species, you may
    // suffer ↓2 on the Skill Test instead." "Regarding understanding another species" has no hook
    // to verify - the player self-polices the fictional trigger, the same idiom Aiming/Precision
    // Aim's own checkboxes already use. Only offered once skillDataset.snag is already true (this
    // roll's own pre-dialog Snag state), while disguised, on a Social-essence Skill Test -
    // consumption (converting the Snag into an actual ↓2) lives post-dialog below.
    updatedShiftDataset.observerSnagSubstitutionAvailable = skillDataset.snag
      && rolledEssence == 'social' && isObserverDisguiseActive(actor);

    // Any currently-disabled effect (the actor's own, or a Perk's) that would touch this skill if
    // it were on - offered in the Roll Options Dialog as an opt-in-for-this-roll toggle instead of
    // needing to be manually (and persistently) re-enabled on the Effects tab first. See
    // helpers/skill-effects.mjs's own doc comment.
    updatedShiftDataset.availableSkillEffects = getToggleableSkillEffects(actor, rolledSkill, rolledEssence);

    // Every automatic combat modifier that actually fired this roll (see
    // _getAutomaticCombatModifiers's own addSource doc comment) - surfaced in the Roll Options
    // Dialog so the player can see where their shiftUp/shiftDown number came from, and toggle an
    // individual shiftUp/shiftDown-granting one off for just this roll (edge/snag entries are
    // informational only - see updatedShiftDataset's own consumption below).
    updatedShiftDataset.combatModifierSources = combatModifiers.sources;

    // Retrogen - see helpers/retrogen.mjs's own doc comment. The off-by-default toggle, offered
    // only when the automatic modifier above didn't already fire for this target.
    const attackTraitParentWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    updatedShiftDataset.retrogenAvailable = isRetrogenWeapon(attackTraitParentWeapon)
      && !combatModifiers.sources.some(source => source.id == 'retrogen');

    // Fanning - see helpers/fanning.mjs's own doc comment. 0 hides the dialog's shot-count input.
    // Never offered on a High-Density follow-up (that is a single extra Attack, not a new volley).
    updatedShiftDataset.fanningMaxShots = dataset.highDensityFollowUp ? 0 : getFanningMaxShots(actor, attackTraitParentWeapon);

    // Pre-select the Roll Options Dialog's Defense dropdown from the weaponEffect's configured
    // Defense (p.168-169). A plain skill roll defaults to 'none' unless the caller already set
    // dataset.defenseType (e.g. a @Check[defense=...] enricher link, see helpers/enrichers.mjs),
    // and the player can always still choose a Defense manually to roll a Skill Test against a
    // targeted actor.
    // Keyed on the item actually declaring a Defense rather than on its type, so an attack SPELL
    // (spell.mjs's own system.defenseType, null for the ordinary non-attack majority) pre-selects
    // the dropdown exactly the way a weaponEffect always has. A weaponEffect's own field is
    // non-null by schema default, so it still always wins, and every other item type has no such
    // field at all and falls straight through - this is a widening, not a behavior change.
    updatedShiftDataset.defenseType = item?.system?.defenseType ?? (dataset.defenseType || 'none');

    // Personal Heirloom - see helpers/personal-heirloom.mjs's own doc comment. Live, non-consumed
    // - matched by the weapon's own local item id, not a compendium sourceId.
    if (item?.type == 'weaponEffect') {
      updatedShiftDataset.shiftUp += getPersonalHeirloomBonus(actor, this._getParentWeapon(actor, item));
    }

    // Reckless Abandon (Renegade base, p.94): "Upshift 2 on all Strength Skill Tests" while
    // active and wearing light armor or no armor (Hardened extends this to Medium armor too) -
    // see helpers/reckless-abandon.mjs for why only this half of the Perk needed new code.
    // Unlike Silent Weapon Expertise above, this isn't gated on item?.type - it's any Strength
    // Skill Test, not just weapon attacks.
    // Racer Abandon (Cobra Codex p.61): "You gain ↑2 on Driving Skill Tests instead of Strength Skill
    // Tests" while driving; Rigged Rider keeps both (helpers/summons.mjs).
    const racer = racerRecklessShifts(actor);
    if (rolledEssence == 'strength' && racer.strength) {
      updatedShiftDataset.shiftUp += getRecklessAbandonStrengthShiftUp(actor);
    }

    if (rolledSkill == 'driving' && racer.driving && isRecklessAbandonActive(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Item rules' CritOnD2 (rules/adapter.mjs#ruleCritD2): Piercing Shot, Assault Precision, Coin Toss,
    // Ripple Effect, Forward Observation (TF), Let Cool Heads Prevail, Miracle Worker, Technical Mastery's
    // direct half, Perimeter Defender, Fancy Flier. Read here, against the fully-resolved
    // skillDataset.edge, so an Edge from training or an Essence shift counts too.
    if (ruleCritD2(actor, game.user?.targets?.first?.()?.actor ?? null, { item, rolledSkill, rolledEssence, edge: !!skillDataset.edge, dataset })) {
      updatedShiftDataset.canCritD2 = true;
    }

    // Show Of Hands - see SHOW_OF_HANDS_ID's own comment above.
    if (['deception', 'intimidation', 'persuasion'].includes(rolledSkill) && actorHasPerk(actor, SHOW_OF_HANDS_ID)
      && !actor.items?.some(i => i.type == 'weapon' && i.system.equipped)
      && getUsesThisScene(actor, SHOW_OF_HANDS_UNARMED_FLAG) < 1) {
      skillDataset.edge = true;
    }

    // Eureka's d2 crit on Field Skill Tests is its CritOnD2 rule (skill:choiceOf:<Field>). The Field
    // Skill Test itself is still worked out here for Expert in Your Field below.
    const fieldPerk = findPerk(actor, FIELD_ID);
    const isFieldSkillTest = !!fieldPerk?.system.choice && rolledSkill == fieldPerk.system.choice;

    // Expert in Your Field (Technician/Expert Focus, 20th level, p.104): "All Field Skill Tests
    // gain an Edge. If you would gain an Edge on the Skill Test from another source, you instead
    // gain [3 shifts]." Reads skillDataset.edge, which by this point already folds in skill
    // training, Essence shifts, and every automatic combat modifier above - "already have an Edge
    // from elsewhere" vs. "this Perk is the only source" - rather than just setting edge
    // unconditionally and silently losing the upgrade the book describes.
    // Eureka! (Blue Ranger, 1st level, p.38) - see EUREKA_PR_ID's own comment above. Applies to
    // any Smarts Skill Test, not just weaponEffect attacks, so it's checked here alongside the
    // other essence-scoped grants rather than in the weaponEffect-only block below.
    const ideaPoints = actor._getBaseRolePoints?.();
    updatedShiftDataset.ideaPointAvailable = rolledEssence == 'smarts'
      && actorHasPerk(actor, EUREKA_PR_ID)
      && !!ideaPoints?.system.resource.value;

    // "I remember reading about…." - see I_REMEMBER_READING_ABOUT_ID's own comment above.
    updatedShiftDataset.iRememberReadingAboutAvailable = rolledEssence == 'smarts'
      && actorHasPerk(actor, I_REMEMBER_READING_ABOUT_ID)
      && !hasUsedThisEncounter(actor, I_REMEMBER_READING_ABOUT_ENCOUNTER_FLAG);

    // Eltarian Tech - see ELTARIAN_TECH_ID's own comment above. Reuses the same
    // actor._getBaseRolePoints() lookup as Eureka! just above (never both at once - Idea Points
    // and Eltarian Tech belong to different Roles).
    updatedShiftDataset.eltarianTechAvailable = rolledSkill == 'technology'
      && actorHasPerk(actor, ELTARIAN_TECH_ID)
      && !!ideaPoints?.system.resource.value;

    // Mystical Understanding - Spellcialize - see MYSTICAL_UNDERSTANDING_ID's own comment above.
    // Same actor._getBaseRolePoints() reuse as Eureka!/Eltarian Tech above, gated on "trained but
    // not already Specialized" instead of a fixed skill/essence.
    updatedShiftDataset.spellcializeAvailable = actorHasPerk(actor, MYSTICAL_UNDERSTANDING_ID)
      && actorSkillData?.shift != 'd20'
      && !actor.system.skills[rolledSkill]?.isSpecialized
      && !!ideaPoints?.system.resource.value;

    // Dependable/Legendary Dependability - see DEPENDABLE_ID's/LEGENDARY_DEPENDABILITY_ID's own
    // comments above. Reports the actor's own uses remaining this scene (0 disables the checkbox
    // entirely) - Legendary Dependability widens the cap from 1 to 2, matching its own "twice per
    // day" text (approximated as twice per scene).
    const dependableUsesThisScene = getUsesThisScene(actor, 'dependableUsesThisScene');
    const dependableCap = actorHasPerk(actor, LEGENDARY_DEPENDABILITY_ID) ? 2 : 1;
    updatedShiftDataset.dependableAvailable = actorHasPerk(actor, DEPENDABLE_ID) && dependableUsesThisScene < dependableCap
      ? dependableCap - dependableUsesThisScene : 0;
    updatedShiftDataset.dependableBothAvailable = updatedShiftDataset.dependableAvailable >= 2;

    // Old Reliable/Legendary Dependability - see OLD_RELIABLE_ID's own comment above. Moxie-gated,
    // not scene-gated, so this only checks affordability (1 point) - the "both d20s"/"15 instead
    // of 10" escalations are gated separately at consumption time below, once Edge/Snag is known.
    const moxie = findRolePointsItem(actor, "Moxie");
    updatedShiftDataset.oldReliableAvailable = actorHasPerk(actor, OLD_RELIABLE_ID) && !!moxie
      && moxie.system.resource.value >= 1;
    updatedShiftDataset.oldReliableBothAvailable = updatedShiftDataset.oldReliableAvailable
      && moxie.system.resource.value >= 2;
    updatedShiftDataset.legendaryDependabilityAvailable = actorHasPerk(actor, LEGENDARY_DEPENDABILITY_ID)
      && !!moxie && moxie.system.resource.value >= 2
      && getUsesThisScene(actor, 'legendaryDependabilityUsesThisScene') < 1;

    // Enviro-Sealed - see hasEnviroSealedEdge's own comment above. Shown whenever the actor wears
    // this armor at all (not gated on environment - this is specifically the checkbox for adverse
    // situations OTHER than the physical environment, which is handled automatically instead).
    updatedShiftDataset.enviroSealedAdverseSituationAvailable = hasEquippedEnviroSealedArmor(equippedArmor);
    // In a hostile physical environment the same checkbox starts ticked, rather than the Edge being
    // forced on ahead of the dialog - so the dialog shows why there's an Edge, and the player or GM
    // can untick it for a roll that isn't resisting anything. Ticking moves the dialog's own
    // Snag/Normal/Edge radio with it (helpers/edge-toggle-link.mjs), which is what gets rolled.
    updatedShiftDataset.enviroSealedAdverseSituationChecked = hasEnviroSealedEdge;

    // Pressure Cooker - see PRESSURE_COOKER_ID's own comment above. "If you only have 1 Health
    // left" - a genuinely enforceable precondition (unlike most fictional qualifiers this project
    // drops), so the checkbox is only offered at exactly 1 Health.
    updatedShiftDataset.pressureCookerAvailable = actorHasPerk(actor, PRESSURE_COOKER_ID)
      && actor.system.health?.value == 1 && !!moxie && moxie.system.resource.value >= 1;

    // Always Ready - see ALWAYS_READY_ID's own comment above.
    const alwaysReadyFunction = findPerk(actor, ALWAYS_READY_ID)?.system.choice;
    const alwaysReadySkills = ALWAYS_READY_FUNCTION_SKILLS[alwaysReadyFunction] ?? [];
    updatedShiftDataset.alwaysReadyAvailable = alwaysReadySkills.includes(rolledSkill)
      && getUsesThisScene(actor, 'alwaysReadyUsesThisScene') < 1;

    if (isFieldSkillTest && actorHasPerk(actor, EXPERT_IN_YOUR_FIELD_ID)) {
      if (skillDataset.edge) {
        updatedShiftDataset.shiftUp += 3;
      } else {
        skillDataset.edge = true;
      }
    }

    // Emotional Mastery: Interest (A Jump Through Time, Purple Ranger, p.37) - "You gain Edge on
    // all Alertness and Culture Skill Tests" while active. See helpers/emotional-mastery.mjs's
    // own doc comment.
    if ((rolledSkill == 'alertness' || rolledSkill == 'culture') && isEmotionalMasteryOptionActive(actor, 'interest')) {
      skillDataset.edge = true;
    }

    // Emotional Mastery: Joy (A Jump Through Time, Purple Ranger, p.37) - "When within 5ft of an
    // ally, you gain ↑1 on the first Skill Test you take each turn" while active. Self-status,
    // hasUsedThisTurn-gated - marked immediately here (this section already runs inside an async
    // continuation, unlike the per-target block's own synchronous constraint Disgust/Move Like a
    // Song work around).
    if (game.combat && isEmotionalMasteryOptionActive(actor, 'joy') && !hasUsedThisTurn(actor, 'joyUsedThisTurn')
      && getNearbyAllyTokens(actor, 5).length > 0) {
      updatedShiftDataset.shiftUp += 1;
      await markUsedThisTurn(actor, 'joyUsedThisTurn');
    }

    // Angry - see ANGRY_ID's own comment above.
    updatedShiftDataset.angryAvailable = rolledEssence == 'strength' && actorHasPerk(actor, ANGRY_ID)
      && !hasUsedThisEncounter(actor, 'angryUsedThisEncounter');

    // Two Steps to the Right - see TWO_STEPS_TO_THE_RIGHT_ID's own comment above. Lay of the
    // Land's own Infiltration/Survival Edge is a plain compendium Active Effect (so a holder
    // already gets it for free); this only needs to broadcast it to a NEARBY ally who doesn't
    // hold Lay of the Land themselves.
    if ((rolledSkill == 'infiltration' || rolledSkill == 'survival')
      && getNearbyAllyTokens(actor, 60).some(token => actorHasPerk(token.actor, TWO_STEPS_TO_THE_RIGHT_ID))) {
      skillDataset.edge = true;
    }

    // Tourniquet Line Chef / EMT Crash Course - see their own comments above. Same "match by
    // Specialization name" idiom as Calm Beast; EMT Crash Course shares this check rather than
    // duplicating it, same as Educated's own widened dispatch.
    if (rolledSkill == 'science' && specialization?.name?.toLowerCase() == 'medicine'
      && (actorHasPerk(actor, TOURNIQUET_LINE_CHEF_ID) || EMT_CRASH_COURSE_IDS.some(id => actorHasPerk(actor, id)))) {
      skillDataset.edge = true;
    }

    // Astro-Sense - see ASTRO_SENSE_ID's own comment above. Same "match by Specialization name"
    // idiom as Calm Beast/Tourniquet Line Chef.
    if (((rolledSkill == 'survival' && specialization?.name?.toLowerCase() == 'space')
      || (rolledSkill == 'technology' && specialization?.name?.toLowerCase() == 'astro-nav'))
      && actorHasPower(actor, ASTRO_SENSE_ID)) {
      skillDataset.edge = true;
    }

    // Surgical Operators - its Edge only applies when treating a poison or toxin, so it is an
    // off-by-default Roll Options Dialog switch on Science tests (helpers/extensions/fix3-gij/gij-fixes.mjs).

    // Broadcaster's Technology(Communications) half - see BROADCASTER_ID's own comment above.
    if (rolledSkill == 'technology' && specialization?.name?.toLowerCase() == 'communications'
      && !game.combat && actorHasPerk(actor, BROADCASTER_ID)) {
      skillDataset.edge = true;
    }

    // Environmental Expertise (Ranger base, 1st/9th/18th level, p.90) - see
    // helpers/environmental-expertise.mjs's own doc comment. "Non-combat Skill Tests" is
    // approximated as "not an Attack" (item?.type != 'weaponEffect'), the same proxy Exploit
    // Trust's own "outside of Combat" check already establishes for a similar RAW distinction.
    // Also grants the same benefit to whoever a Guidance-holding ally last granted it to (see
    // helpers/environmental-expertise.mjs's own GUIDANCE_ID comment) - a bare marker flag banked
    // via BANKABLE_PERKS, consumed on the very next roll of any kind.
    const pendingGuidance = getPendingBonus(actor, PENDING_GUIDANCE_FLAG_KEY);
    // The Edge is also listed as a Roll Options Dialog source, labelled with the scene's terrain
    // when that (rather than the toggle) is what put the actor in their environment of expertise.
    const hasOwnEnvironmentalExpertise = hasActiveEnvironmentalExpertise(actor);
    if (hasOwnEnvironmentalExpertise || pendingGuidance) {
      if (item?.type == 'weaponEffect') {
        updatedShiftDataset.isSpecialized = true;
      } else {
        skillDataset.edge = true;
        combatModifiers.sources.push({
          id: 'environmentalExpertise',
          label: hasOwnEnvironmentalExpertise
            ? getEnvironmentOfExpertiseSourceLabel(actor, findPerk(actor, ENVIRONMENTAL_EXPERTISE_ID)?.name ?? 'Environmental Expertise')
            : 'Guidance',
          shiftUp: 0, shiftDown: 0, edge: true, snag: false,
        });
      }

      if (pendingGuidance) {
        await clearPendingBonus(actor, PENDING_GUIDANCE_FLAG_KEY);
      }
    }

    // Urban Jungle (see URBAN_JUNGLE_ID's own comment above): "when in urban environments... You
    // gain Edge on non-attack Skill Tests. All your attacks are considered Specialized." Only on a
    // scene (or Region) whose terrain is Urban - with no terrain set there's nothing to go on, so
    // it stays off as before. Same non-attack/attack split as Environmental Expertise just above.
    if (actorHasPerk(actor, URBAN_JUNGLE_ID) && getTerrain(actor) == 'urban') {
      if (item?.type == 'weaponEffect') {
        updatedShiftDataset.isSpecialized = true;
      } else {
        skillDataset.edge = true;
        combatModifiers.sources.push({
          id: 'urbanJungle',
          label: `${findPerk(actor, URBAN_JUNGLE_ID)?.name ?? 'Urban Jungle'} (${this._localize(E20.environments.urban)})`,
          shiftUp: 0, shiftDown: 0, edge: true, snag: false,
        });
      }
    }

    // Down the Barrel - see DOWN_THE_BARREL_ID's own comment above.
    if (['intimidation', 'persuasion'].includes(rolledSkill) && actorHasPerk(actor, DOWN_THE_BARREL_ID)
      && getFavoriteWeaponItem(actor)?.system.equipped) {
      skillDataset.edge = true;
    }

    // Genius (Technician, 15th level, p.104): "treat all Skill Tests related to your Role Skills
    // as Specialized." "Role Skills" is a real, per-actor list - the actor's own base Role Item's
    // own system.skills array (see actor.mjs#_getBaseRole's own doc comment) - not a fixed set.
    if (actorHasPerk(actor, GENIUS_ID) && actor._getBaseRole?.()?.system.skills?.includes(rolledSkill)) {
      updatedShiftDataset.isSpecialized = true;
    }

    // Consult Memories (Field Guide to Action & Adventure, Grid Psychic Focus, 10th level, p.68) -
    // see helpers/consult-memories.mjs's own doc comment. "↑2 and Specialization in the Skill of
    // your choice for one scene" - same live-read-for-the-rest-of-the-scene shape as Public
    // Television just above, scoped to the one skill chosen at activation instead of a whole
    // Essence.
    if (isConsultMemoriesActive(actor, rolledSkill)) {
      updatedShiftDataset.isSpecialized = true;
      updatedShiftDataset.shiftUp += 2;
    }

    // Percussive Maintenance - see PERCUSSIVE_MAINTENANCE_ID's own comment above. Scoped to
    // Technology, same shape as Inner Magic/Terrifying's own scoped shiftUp consumption.
    const pendingPercussiveMaintenance = getPendingBonus(actor, PENDING_PERCUSSIVE_MAINTENANCE_FLAG);
    if (pendingPercussiveMaintenance && rolledSkill == 'technology') {
      skillDataset.edge = true;
      await clearPendingBonus(actor, PENDING_PERCUSSIVE_MAINTENANCE_FLAG);
    }

    // Data Bridge (Enigma of Combination, Hub Focus, Analyst, 1st level, p.29) - see
    // helpers/data-bridge.mjs's own doc comment. Skill-scoped, consumed on the first matching
    // roll - same "bank now, consume on the next matching roll" idiom as Inner Magic's own scoped
    // shiftUp, but granting isSpecialized instead (that file's own doc comment explains why).
    if (hasBorrowedDataBridgeSpecialization(actor, rolledSkill)) {
      updatedShiftDataset.isSpecialized = true;
      await clearPendingBonus(actor, DATA_BRIDGE_FLAG);
    }

    // Trade School - see helpers/trade-school.mjs's own doc comment. Technical Mastery's own
    // "extends to allies benefiting from your Trade School" clause is folded in here (canCritD2),
    // checked against the ORIGINAL granter, not the actor rolling.
    if (rolledSkill == 'technology') {
      const tradeSchoolResult = await consumeTradeSchool(actor);
      if (tradeSchoolResult.isSpecialized) {
        updatedShiftDataset.isSpecialized = true;
      }

      if (tradeSchoolResult.canCritD2) {
        updatedShiftDataset.canCritD2 = true;
      }
    }

    // Technical Mastery's direct half, Perimeter Defender and Fancy Flier are item rules (CritOnD2 above).

    // Fleeting Energy (MLP Heavy Hitter Hang-Up, p.51) - see FORCE_ID's own comment above.
    // Consumed on the actor's own next Strength Skill Test, same "bank now, consume on the next
    // matching roll" idiom as Inner Magic's own scoped shiftUp.
    const pendingFleetingEnergy = getPendingBonus(actor, 'pendingFleetingEnergy');
    if (pendingFleetingEnergy && rolledEssence == 'strength') {
      updatedShiftDataset.shiftDown += pendingFleetingEnergy.shiftDown;
      clearPendingBonus(actor, 'pendingFleetingEnergy');
    }

    // Combat Exoskeleton - see COMBAT_EXOSKELETON_ID's own comment above. Unconditional (RAW has no
    // "as a Free action"/opt-in language, unlike Pythonized's own checkbox just below), so applied
    // directly rather than offered as a Roll Options toggle.
    if ((rolledSkill == 'brawn' || (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'))
      && hasCombatExoskeleton(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Terrifying - see TERRIFYING_UPGRADE_IDS's own comment above.
    if (rolledSkill == 'intimidation' && hasTerrifyingUpgrade(actor) && !getPendingBonus(actor, 'pendingTerrifying')) {
      updatedShiftDataset.shiftUp += 1;
      combatModifiers.sources.push({
        id: 'terrifying', label: 'Terrifying', shiftUp: 1, shiftDown: 0, edge: false, snag: false,
      });
    }

    // Peerless Pilot (PR CRB) - Driving Skill Test half; see PEERLESS_PILOT_PR_ID's own comment
    // above for the RAW text and the Driving-specialization-shift check shared with the
    // Initiative-Edge half in prepareInitiativeRoll.
    if (rolledSkill == 'driving' && actorHasPerk(actor, PEERLESS_PILOT_PR_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && this._hasDrivingSpecializationAtOrAboveD6(actor)) {
      skillDataset.edge = true;
    }

    // Zeo Crystal Boost (Across the Stars, Grid Power, p.73) - "Into your Zord: Gain upshift 1 to
    // Driving (Zord) Skill Tests until the end of the scene." See helpers/zeo-crystal-boost.mjs's
    // own doc comment for the picker's own 4 flattened options. "Driving (Zord)" is read as Driving
    // rolled while actually piloting a Zord specifically (not any vehicle), gated the same way
    // Peerless Pilot's own Driving half is just above.
    if (rolledSkill == 'driving' && this._getPilotedVehicle(actor, 'driver')?.type == 'zord'
      && getZeoCrystalBoostOption(actor) == 'zordDriving') {
      updatedShiftDataset.shiftUp += 1;
    }

    // Now You Don't (Transformers CRB, General Perk, p.110) - see its own check in
    // Object Alt Mode (Transformers CRB, General Perk, p.110): Edge on hiding/blending/eavesdropping
    // tests - a Roll Options Dialog switch in helpers/extensions/fix3-tf/tf-fixes.mjs.

    // Dinobot / Maximal / Predacon: Edge "when that Specialization comes into play" - a Roll Options
    // Dialog switch on the chosen Skill, on by default for a Specialization roll (helpers/extensions/fix3-tf/tf-fixes.mjs).

    // Omega Enhancement's own Power Mode - see helpers/omega-enhancement.mjs's own doc comment.
    // "Edge on Might Skill Tests" while active.
    if (rolledSkill == 'might' && isPowerModeActive(actor)) {
      skillDataset.edge = true;
    }

    // "Friendly" Fire - see FRIENDLY_FIRE_ID's own comment above.
    if (game.combat && item?.type == 'weaponEffect' && actorHasPerk(actor, FRIENDLY_FIRE_ID)
      && actor.getFlag?.('essence20', FRIENDLY_FIRE_SPOOF_FLAG) == game.combat.id
      && !hasUsedThisEncounter(actor, FRIENDLY_FIRE_ENCOUNTER_FLAG)) {
      skillDataset.edge = true;
      await markUsedThisEncounter(actor, FRIENDLY_FIRE_ENCOUNTER_FLAG);
    }

    // Takedown Expert (GI Joe CRB, Infiltrator Focus, 6th level, p.73): "Edge on Takedown
    // attempts." The bonus-Condition-on-a-non-outmatched-miss half is applied in
    // _rollSkillHelper's post-hit processing (see isTakedownAttempt's own comment there).
    if (dataset.isTakedown && actorHasPerk(actor, TAKEDOWN_EXPERT_ID)) {
      skillDataset.edge = true;
    }

    // Exemplary - see helpers/exemplary.mjs's own doc comment.
    if (hasNearbyExemplaryMatch(actor, rolledSkill)) {
      skillDataset.edge = true;
    }

    // Different Perspective - see DIFFERENT_PERSPECTIVE_ID's own comment above. Culture itself is
    // a Smarts skill, so a Culture roll naturally qualifies too (Culture's own shift always
    // equals itself) - no special-case exclusion, matching RAW's own unqualified "Smarts- and
    // Social Skill Tests" wording exactly.
    if ((rolledEssence == 'smarts' || rolledEssence == 'social')
      && actorHasPerk(actor, DIFFERENT_PERSPECTIVE_ID)) {
      // Read via getRollData(), same access path actorSkillData itself already uses for the
      // rolled skill - keeps both sides of the comparison on the same data source.
      const cultureIndex = E20.skillShiftList.indexOf(actor.getRollData().skills.culture.shift);
      const rolledIndex = E20.skillShiftList.indexOf(actorSkillData.shift);
      if (cultureIndex != -1 && rolledIndex != -1 && cultureIndex <= rolledIndex) {
        updatedShiftDataset.shiftUp += 1;
      }
    }

    // Ranger Operator [Form] - see RANGER_OPERATOR_ID's own comment above.
    if (['driving', 'survival'].includes(rolledSkill) && actor.system.isMorphed
      && actorHasPerk(actor, RANGER_OPERATOR_ID) && isFormActive(actor, RANGER_OPERATOR_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Analyze Target (Analyst, 1st level, p.59): "As a Standard action, make an Alertness Skill
    // Test against the Willpower or Cleverness of a Target you can see. On a success, you can
    // learn a valuable piece of information..." The information-learning half is pure narrative
    // (nothing for this system to compute), but the "number of times you used Analyze Target on
    // them" count Informed Accuracy/Target Breakdown key off is real and worth tracking. Rather
    // than build a whole separate mini-roll flow, this reuses the ordinary "Roll vs Target
    // Defense" Alertness Skill Test already generic to any roll - a checkbox declares "this roll
    // IS an Analyze Target attempt" (same "player declares intent, can't be inferred" shape as
    // Precision Aim's own checkbox), and a successful roll increments the counter in
    // _rollSkillHelper's own per-target results (see checkContext.isAnalyzeTarget below).
    updatedShiftDataset.analyzeTargetAvailable = rolledSkill == 'alertness' && actorHasPerk(actor, ANALYZE_TARGET_ID);

    // Surging (Cobra Codex, Weapon Upgrade, p.97): "As a Free Action before Attacking with this
    // weapon, you can double the element damage of its effect. However, if you attack and you roll a
    // 1 on your d20, you suffer the attack's effect." See helpers/weapon-upgrades.mjs.
    updatedShiftDataset.surgingAvailable = item?.type == 'weaponEffect'
      && canSurge(this._getParentWeapon(actor, item), item);

    // Psychoanalyst (Analyst, 14th level, p.62): "As a Standard action, roll a Science or
    // Technology Skill Test against the Willpower or Cleverness of a target... On a success, the
    // target suffers a Stun 2 effect." Same "declare intent via a checkbox" shape as Analyze
    // Target above - the actual Stun application reuses the existing damageValue/damageType ->
    // Apply Damage button pipeline (see checkContext's own synthetic-damage fallback below),
    // rather than a new success/effect code path.
    updatedShiftDataset.psychoanalystAvailable = (rolledSkill == 'science' || rolledSkill == 'technology')
      && actorHasPerk(actor, PSYCHOANALYST_ID);

    // Coax Surrender - see COAX_SURRENDER_ID's own comment above. Same "declare intent via a
    // checkbox" shape as Psychoanalyst just above.
    updatedShiftDataset.coaxSurrenderAvailable = rolledSkill == 'persuasion' && actorHasPerk(actor, COAX_SURRENDER_ID);

    // Grinder - see GRINDER_ID's own comment above. Same "declare intent via a checkbox" shape as
    // Psychoanalyst/Coax Surrender above, scoped to a Brawn roll.
    updatedShiftDataset.grinderAvailable = rolledSkill == 'brawn' && actorHasPerk(actor, GRINDER_ID);

    // Watchful Eyes (Strategist Focus, 6th level, p.68): "make a DIF 10 Alertness Skill Test... On
    // a success, one enemy within range of your weapons suffers a Snag on their first Skill Test
    // on their turn. For every 5 your result beats the DIF, you affect an additional enemy..."
    // Auto-detected from the roll's own shape (Alertness vs a flat DIF of exactly 10, while
    // holding the Perk) rather than a checkbox - specific enough not to false-positive on an
    // unrelated Alertness roll. "Within range of your weapons" and choosing which enemies is left
    // to the player via their own targeting (matches this system's existing "player picks who
    // counts" idiom for every other AoE-shaped Perk) - marks every currently-targeted enemy,
    // reusing the exact same "Snag on your next Skill Test or attack" flag Debilitating
    // Strike/Shock and Awe already grant (markDebilitated), rather than a new flag. The "+1 enemy
    // per 5 over DIF, doubled on a Critical Success" scaling isn't enforced - the player targets
    // as many as the fiction (and the GM) supports, same honor-system simplification as Precision
    // Aim's own checkbox.
    const isWatchfulEyesAttempt = rolledSkill == 'alertness' && dataset.dif == '10'
      && actorHasPerk(actor, WATCHFUL_EYES_ID);

    // Rallying Cry (WTNV) - see helpers/surprise.mjs's own doc comment. Auto-detected exactly the
    // way Watchful Eyes just above is (a flat DIF 10 roll of the named Skill while holding the
    // Perk), rather than triggered from a button: a flat-Difficulty roll is something the player
    // makes directly, and this needs no targeting step of its own beyond whoever they targeted.
    // Additionally gated on the surprise round, which is RAW's own "during your first round in
    // Combat" and is directly checkable.
    const isWtnvRallyingCryAttempt = rolledSkill == 'performance' && dataset.dif == '10'
      && isSurpriseRound() && actorHasPerk(actor, WTNV_RALLYING_CRY_ID);

    // Weapon Implant - see helpers/weapon-implant.mjs's own doc comment. Auto-detected like the
    // two above, but the flat Difficulty carries real meaning here rather than just identifying
    // the attempt: 14/18/20 are what the player is declaring they will implant, so the tier comes
    // back with the detection instead of being asked for again afterward.
    const weaponImplantTier = getWeaponImplantTier(actor, rolledSkill, dataset.dif);

    // Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272) - see
    // helpers/bolster-defense.mjs's own doc comment. Threaded straight through from the synthetic
    // dataset set at activation, read in post-roll success handling below.
    const isBolsterDefenseAttempt = !!dataset.isBolsterDefenseAttempt;
    const bolsterDefenseMode = dataset.bolsterDefenseMode ?? null;
    const bolsterDefenseType = dataset.bolsterDefenseType ?? null;
    const bolsterDefenseTargetUuid = dataset.bolsterDefenseTargetUuid ?? null;

    // Chronomantic Pulse (Finster's Monster-Magic Cookbook, Sorcerous Power, p.273) - see
    // helpers/chronomantic-pulse.mjs's own doc comment. Same "threaded through from the synthetic
    // dataset, read in post-roll success handling below" shape as Bolster Defense just above.
    const isChronomanticPulseAttempt = !!dataset.isChronomanticPulseAttempt;
    const chronomanticPulseInitiative = dataset.chronomanticPulseInitiative ?? null;
    const chronomanticPulseTargetUuid = dataset.chronomanticPulseTargetUuid ?? null;

    // Jury Rig (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73) - see
    // helpers/jury-rig.mjs's own doc comment. Same "threaded through from the synthetic dataset,
    // read in post-roll success handling below" shape as Bolster Defense just above.
    const isJuryRigAttempt = !!dataset.isJuryRigAttempt;
    const juryRigOption = dataset.juryRigOption ?? null;
    const juryRigTargetUuid = dataset.juryRigTargetUuid ?? null;
    const juryRigStandardAction = !!dataset.juryRigStandardAction;

    // Improvise Armor (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.73) - see
    // helpers/improvise-armor.mjs's own doc comment. Same "threaded through" shape as Jury Rig
    // just above.
    const isImproviseArmorAttempt = !!dataset.isImproviseArmorAttempt;
    const improviseArmorTargetUuid = dataset.improviseArmorTargetUuid ?? null;

    // Spot Weld (Decepticon Directive, General Perk, p.67) - see helpers/spot-weld.mjs's own doc
    // comment. Same "threaded through" shape as Jury Rig above - a flat-DIF roll, so the heal
    // target travels via its own UUID rather than the normal target-vs-Defense checkEntries.
    const isSpotWeldAttempt = !!dataset.isSpotWeldAttempt;
    const spotWeldTargetUuid = dataset.spotWeldTargetUuid ?? null;

    // Undo Engine's own DIF 20 Driving Test - see helpers/undo-engine.mjs's own doc comment. This
    // is the DRIVER's flat-DIF roll, triggered from the ATTACKER's own Critical Success (see
    // isUndoEngineAttempt just below in checkEntries) - a separate rollSkill() call entirely, so
    // it travels through its own synthetic dataset the same "threaded through" way as Jury Rig.
    const isUndoEngineCheckAttempt = !!dataset.isUndoEngineCheckAttempt;
    const undoEngineVehicleUuid = dataset.undoEngineVehicleUuid ?? null;
    const spotWeldHealAmount = dataset.spotWeldHealAmount ?? null;

    // Martial Leadership (Enigma of Combination, General Perk, p.41) - see
    // helpers/martial-leadership.mjs's own doc comment. Same "threaded through" shape as Jury Rig/
    // Improvise Armor just above.
    const isMartialLeadershipAttempt = !!dataset.isMartialLeadershipAttempt;
    const martialLeadershipTargetUuid = dataset.martialLeadershipTargetUuid ?? null;

    // Voice of Primus (Enigma of Combination, General Perk, p.41) - see
    // helpers/voice-of-primus.mjs's own doc comment. Same "threaded through" shape as Martial
    // Leadership just above.
    const isVoiceOfPrimusAttempt = !!dataset.isVoiceOfPrimusAttempt;
    const voiceOfPrimusTargetUuid = dataset.voiceOfPrimusTargetUuid ?? null;

    // Voice of Primus's own assist clause - see helpers/voice-of-primus.mjs's own doc comment.
    // Same "threaded through" shape, no target uuid needed (this roll has no target at all - a
    // flat DIF 12 Persuasion Test).
    const isVoiceOfPrimusAssistAttempt = !!dataset.isVoiceOfPrimusAssistAttempt;

    // Remote Operations (Factions in Action Vol 1: Ferocious Fighters, Force Recon, 10th Role
    // Level, p.45) - see helpers/remote-operations.mjs's own doc comment. Same "threaded through,
    // flat-DIF, no target" shape as Voice of Primus's own assist clause just above.
    const isRemoteOperationsAttempt = !!dataset.isRemoteOperationsAttempt;

    // Avast! (Quartermaster's Guide to Gear, Freebooter Focus, 10th level, p.27) - see
    // helpers/avast.mjs's own doc comment. Same "threaded through" shape as Voice of Primus above.
    const isAvastAttempt = !!dataset.isAvastAttempt;
    const avastTargetUuid = dataset.avastTargetUuid ?? null;

    // Words Can Hurt! (Enigma of Combination, Counselor Focus, 6th level, p.34) - see
    // helpers/words-can-hurt.mjs's own doc comment. Same "threaded through" shape as Voice of
    // Primus just above.
    const isWordsCanHurtAttempt = !!dataset.isWordsCanHurtAttempt;
    const wordsCanHurtTargetUuid = dataset.wordsCanHurtTargetUuid ?? null;

    // Side Splitter (MLP CRB, Spirit of Laughter Influence Perk, p.86) - see
    // helpers/side-splitter.mjs's own doc comment. Same "threaded through" shape as Words Can
    // Hurt! just above.
    const isSideSplitterAttempt = !!dataset.isSideSplitterAttempt;
    const sideSplitterTargetUuid = dataset.sideSplitterTargetUuid ?? null;

    // Calming Words (Enigma of Combination, Counselor Focus, 3rd level, p.34) - see
    // helpers/calming-words.mjs's own doc comment. Same "threaded through" shape as Voice of
    // Primus/Words Can Hurt! above, plus which of its 2 actions (soothe/cure) to apply on success.
    const isCalmingWordsAttempt = !!dataset.isCalmingWordsAttempt;
    const calmingWordsTargetUuid = dataset.calmingWordsTargetUuid ?? null;
    const calmingWordsAction = dataset.calmingWordsAction ?? null;

    // Lucky Charm (Finster's Monster-Matic Cookbook, Sorcerous Power, p.276) - see
    // helpers/lucky-charm.mjs's own doc comment. Threaded straight through from the synthetic
    // dataset set at activation, read in post-roll success handling below.
    const isLuckyCharmAttempt = !!dataset.isLuckyCharmAttempt;
    const luckyCharmItemUuid = dataset.luckyCharmItemUuid ?? null;

    // Humanitarian (PR CRB, General Perk, p.96) - see helpers/humanitarian.mjs's own doc comment.
    // Threaded straight through the same way as Lucky Charm just above.
    const isHumanitarianAttempt = !!dataset.isHumanitarianAttempt;

    // Welds, Rivets, and Ideas (Decepticon Directive, Salvaged Origin Benefit, p.38) - see
    // helpers/welds-rivets-and-ideas.mjs's own doc comment. Same threaded-through shape as
    // Humanitarian just above.
    const isWeldsRivetsAndIdeasAttempt = !!dataset.isWeldsRivetsAndIdeasAttempt;

    // Enchant (MLP CRB, Elementary Enchantment spell, p.136) - see helpers/enchant.mjs's own doc
    // comment. Threaded straight through from documents/item.mjs's own pre-roll picker.
    const isEnchantAttempt = !!dataset.isEnchantAttempt;
    const enchantSkill = dataset.enchantSkill ?? null;

    // Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137) - see
    // helpers/bestow-expertise.mjs's own doc comment. Threaded straight through from
    // documents/item.mjs's own pre-roll picker.
    const isBestowExpertiseAttempt = !!dataset.isBestowExpertiseAttempt;
    const bestowExpertiseSkill = dataset.bestowExpertiseSkill ?? null;
    const bestowExpertiseName = dataset.bestowExpertiseName ?? null;

    // Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see helpers/mind-beam.mjs's own doc
    // comment. Threaded straight through from documents/item.mjs's own pre-roll picker.
    const mindBeamEffect = dataset.mindBeamEffect ?? null;

    // Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21) - see
    // helpers/get-to-know.mjs's own doc comment. Threaded straight through from
    // documents/item.mjs's own pre-roll picker.
    const isGetToKnowAttempt = !!dataset.isGetToKnowAttempt;
    const getToKnowSkill = dataset.getToKnowSkill ?? null;

    // Influential (Technician/Expert Focus, 3rd level, p.104) - see helpers/influential.mjs's own
    // doc comment. Unlike Eureka/Expert in Your Field above, this reads a NEARBY ALLY's own Field
    // (system.choice), not the roller's - any Skill Test using that skill, not just Field Skill
    // Tests for the roller's own (possibly different, or absent) Field.
    updatedShiftDataset.shiftUp += getInfluentialShiftUp(actor, rolledSkill);

    // Strike Bonus (Yellow Ranger, 2nd/5th/8th/11th level, p.56) - see STRIKE_BONUS_ID's own
    // comment above. Only the first melee attack of the round, gated the same way Quiet as the
    // Grave/Predator Sneak Attack track their own once-per-round use.
    const strikeBonusPerk = findPerk(actor, STRIKE_BONUS_ID);
    const isMeleeWeaponEffect = item?.type == 'weaponEffect' && item.system.classification.style == 'melee';
    updatedShiftDataset.strikeBonusAvailable = isMeleeWeaponEffect
      && !!strikeBonusPerk
      && actor.system.powers?.personal?.value > 0
      && !hasUsedThisRound(actor, STRIKE_BONUS_ROUND_FLAG)
      ? strikeBonusPerk.system.advances.currentValue
      : 0;

    // Heavy Force - see HEAVY_FORCE_ID's own comment above.
    updatedShiftDataset.heavyForceAvailable = (isMeleeWeaponEffect || !!updatedShiftDataset.isShove)
      && actor.system.isMorphed
      && actorHasPerk(actor, HEAVY_FORCE_ID)
      && actor.system.powers?.personal?.value > 0
      && !hasUsedThisTurn(actor, HEAVY_FORCE_TURN_FLAG);

    // Charge It Up! - see helpers/charge-it-up.mjs's own doc comment. Unlike Quantum Cut just
    // below, the Power was already spent when the player clicked the Power's own activation icon
    // (helpers/power-use.mjs#onPowerUse), so this needs no roll-dialog checkbox - it's simply
    // consumed automatically the moment a qualifying Attack (melee, Power Weapon) actually rolls.
    // Captured in a local (not routed through skillRollOptions, which only echoes back an explicit
    // whitelist of fields - see roll-dialog.mjs#getSkillRollOptions) and read again in the
    // per-target checkEntries construction below to force the same ignoreArmor recompute Drilling
    // Shot/Armor Piercing already use.
    const appliesChargeItUp = item?.type == 'weaponEffect' && item.system.classification?.style == 'melee'
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('powerWeapon')
      && hasPendingChargeItUp(actor);
    if (appliesChargeItUp) {
      await consumeChargeItUp(actor);
    }

    // Quantum Cut / Solo Shot (A Jump Through Time, Quantum Ranger, Quantum Power options, p.46) -
    // both gated on attacking with one specific named half of the Quantum Defender weapon pair,
    // same weaponSourceId lookup idiom as Assault Precision/Piercing Shot above.
    const quantumDefenderWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const quantumDefenderWeaponSourceId = quantumDefenderWeapon?.flags?.core?.sourceId
      ?? quantumDefenderWeapon?._stats?.compendiumSource ?? quantumDefenderWeapon?.flags?.essence20?.rulesSource;

    // Quantum Cut: "spend a Personal Power to ignore all Defense bonuses from armor and force your
    // enemy to use their Toughness Defense against this Attack" - consumption lives in the
    // per-target checkEntries construction below (see its own comment there).
    updatedShiftDataset.quantumCutAvailable = actorHasPerk(actor, QUANTUM_CUT_ID)
      && quantumDefenderWeaponSourceId == QUANTUM_DEFENDER_SWORD_ID
      && actor.system.powers?.personal?.value > 0;

    // Solo Shot: "spend a Personal Power to consider the target in close Range and ignore all die
    // shift penalties for a single Attack" - consumed post-dialog by forcing
    // skillRollOptions.snag = false directly, the same "checkbox overrides the final Edge/Snag
    // choice" shape Eureka!'s own spendIdeaPoint already uses (see its own consumption below) -
    // sidesteps the documented _getAutomaticCombatModifiers-runs-before-the-dialog timing gap
    // (the same one blocking several Ranger Prime capstones' own reciprocal Snag bullets)
    // entirely, since this never needs to touch that function at all.
    updatedShiftDataset.soloShotAvailable = actorHasPerk(actor, SOLO_SHOT_ID)
      && item?.type == 'weaponEffect' && item.system.classification.style != 'melee'
      && quantumDefenderWeaponSourceId == QUANTUM_DEFENDER_BLASTER_ID
      && actor.system.powers?.personal?.value > 0;

    // Cunning Plan - see CUNNING_PLAN_ID's own comment above. Not weaponEffect-gated (RAW: "any
    // Skill during a Skill Test") - only needs the Perk, a Cunning die to actually substitute, and
    // 1 Power to spend.
    updatedShiftDataset.cunningPlanAvailable = actorHasPerk(actor, CUNNING_PLAN_ID)
      && !!actor.getRollData().skills.roleSkillDie
      && actor.system.powers?.personal?.value > 0;

    // Worth A Shot / Worth Another Shot - see WORTH_A_SHOT_ID's own comment above.
    updatedShiftDataset.worthAShotAvailable = actorHasPerk(actor, WORTH_A_SHOT_ID)
      && ((!game.combat && getUsesThisScene(actor, WORTH_A_SHOT_SCENE_FLAG) < (actorHasPerk(actor, WORTH_ANOTHER_SHOT_ID) ? 2 : 1))
        || (!!game.combat && actorHasPerk(actor, WORTH_ANOTHER_SHOT_ID) && !hasUsedThisEncounter(actor, WORTH_A_SHOT_COMBAT_FLAG)))
      && actor.items?.some(i => i.type == 'weapon' && i.system.traits?.includes('ballistic'));

    // Ricochet - see RICOCHET_ID's own comment above. Only while attacking with the actor's own
    // designated Favorite Weapon (helpers/favorite-weapon.mjs), same parent-weapon match Favorite
    // Weapon's own ↑1 grant above uses, and only once this actor's own turn.
    const ricochetParentWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const ricochetFavoriteWeapon = getFavoriteWeaponItem(actor);
    updatedShiftDataset.ricochetAvailable = !!ricochetParentWeapon && !!ricochetFavoriteWeapon
      && ricochetParentWeapon.id === ricochetFavoriteWeapon.id
      && actorHasPerk(actor, RICOCHET_ID) && !hasUsedThisTurn(actor, RICOCHET_TURN_FLAG);

    // Pythonized - see PYTHONIZED_ID's own comment above.
    updatedShiftDataset.pythonizedAvailable = rolledSkill == 'infiltration' && hasPythonizedUpgrade(actor);

    // Fast Draw - see FAST_DRAW_ID's own comment above.
    updatedShiftDataset.fastDrawAvailable = item?.type == 'weaponEffect' && actorHasPerk(actor, FAST_DRAW_ID);

    // Inventor - see INVENTOR_ID's own comment above.
    updatedShiftDataset.inventorAvailable = actorHasPerk(actor, INVENTOR_ID);

    // Ambitious - see AMBITIOUS_ID's own comment above.
    updatedShiftDataset.ambitiousAvailable = actorHasPerk(actor, AMBITIOUS_ID)
      && !hasUsedThisEncounter(actor, AMBITIOUS_ENCOUNTER_FLAG);

    // Isolated - see ISOLATED_ID's own comment above.
    updatedShiftDataset.isolatedAvailable = actorHasPerk(actor, ISOLATED_ID)
      && !hasUsedThisEncounter(actor, ISOLATED_ENCOUNTER_FLAG);

    // Double Agent - see DOUBLE_AGENT_ID's own comment above. Offered on a Smarts/Social Skill
    // Test (the shiftUp half) or on any attack (the Defense-penalty half, applied where
    // difficulty is computed further down).
    updatedShiftDataset.doubleAgentAvailable = actorHasPerk(actor, DOUBLE_AGENT_ID)
      && (rolledEssence == 'smarts' || rolledEssence == 'social' || item?.type == 'weaponEffect' || item?.type == 'power');

    // Gutter Champion - see GUTTER_CHAMPION_ID's own comment above.
    updatedShiftDataset.gutterChampionAvailable = actorHasPerk(actor, GUTTER_CHAMPION_ID)
      && !hasUsedThisTurn(actor, 'gutterChampionUsedThisTurn');

    // Beloved - see BELOVED_ID's own comment above.
    updatedShiftDataset.belovedAvailable = actorHasPerk(actor, BELOVED_ID)
      && !hasUsedThisTurn(actor, 'belovedUsedThisTurn');

    // Thrillseeker - see THRILLSEEKER_HANGUP_ID's own comment above.
    updatedShiftDataset.thrillseekerAvailable = (rolledEssence == 'strength' || rolledEssence == 'speed')
      && actorHasHangUp(actor, THRILLSEEKER_HANGUP_ID)
      && getUsesThisScene(actor, THRILLSEEKER_SCENE_FLAG) < 3;

    // Straight Shooter - see STRAIGHT_SHOOTER_TF_ID's own comment above.
    updatedShiftDataset.straightShooterAvailable = item?.type == 'weaponEffect'
      && combatModifiers.shiftDown > 0
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('ballistic')
      && actorHasPerk(actor, STRAIGHT_SHOOTER_TF_ID)
      && !hasUsedThisTurn(actor, 'straightShooterUsedThisTurn');

    // Kind, But Firm - see KIND_BUT_FIRM_ID's own comment above.
    updatedShiftDataset.kindButFirmAvailable = rolledSkill == 'intimidation'
      && !!findPerk(actor, EMPATHY_MLP_ID)?.system.choice && actorHasPerk(actor, KIND_BUT_FIRM_ID);

    // Restricted Wild Animal Survival Kit - see helpers/kits.mjs#wildAnimalPersuasion. A select of
    // the kit's two Skills, offered on Persuasion while every target reads as an animal (tagged
    // "animal"/"beast", or holding the Animal Perk) - or with no target at all, where the player
    // says who they're persuading. Same shift-position-delta substitution as Street Smarts.
    const wildAnimalKit = wildAnimalPersuasion(actor, rolledSkill);
    const userTargets = game.user?.targets;
    const persuasionTargets = wildAnimalKit && typeof userTargets?.[Symbol.iterator] == 'function'
      ? [...userTargets].map(token => token.actor).filter(Boolean) : [];
    const isAnimal = target => ['animal', 'beast'].some(tag => creatureTagsOf(target).has(tag))
      || ANIMAL_IDS.some(id => actorHasPerk(target, id));
    updatedShiftDataset.wildAnimalKit = wildAnimalKit && persuasionTargets.every(isAnimal)
      ? {
        name: wildAnimalKit.kit.name,
        skills: wildAnimalKit.skills.map(value => ({ value, label: this._localize(E20.skills?.[value] ?? value) })),
      }
      : null;

    // Intimidating (GI Joe CRB/TF CRB, Weapon Effects and Traits, p.148 etc): "Can be used to make
    // Intimidation Skill Tests against creatures at up to the weapon's range. The weapon's skill
    // can be used in place of the Intimidation skill for the purposes of this Skill Test." Same
    // shift-position-delta substitution mechanism as Street Smarts above, but the substitute skill
    // is dynamic (whichever skill the actor's own equipped Intimidating weapon actually uses),
    // hence its own helper rather than a fixed second skill name. The "at up to the weapon's
    // range" qualifier is dropped as unenforceable outside an actual targeted attack roll, the
    // same "closest existing mechanism" idiom this project accepts for similar range/timing
    // qualifiers on non-combat Skill Test substitutions elsewhere (e.g. Reverse Engineer's own
    // "outside a conflict").
    updatedShiftDataset.intimidatingWeaponSkill = rolledSkill == 'intimidation'
      ? this._getIntimidatingWeaponSkill(actor)
      : null;

    // Air/Land/Sea Vehicle Qualification - see VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE's own
    // comment above.
    if (rolledSkill == 'driving' && getSkillRanks(actor, 'driving') > 0) {
      const qualifiedVehicle = this._getPilotedVehicle(actor, 'driver');
      const isQualified = qualifiedVehicle && Object.entries(VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE)
        .some(([movementType, perkIds]) => qualifiedVehicle.system.movement[movementType].base > 0
          && perkIds.some(perkId => actorHasPerk(actor, perkId)));
      // Good To Go (Factions in Action Vol. 2, Freedom Fighters Faction Perk, p.104): "Qualified
      // with either Land, Sea, or Air vehicles [choose one]." Unlike Nu Pogodi/Nothing Personal/
      // The Promise of Riches above (each unconditionally added to one or more of the shared
      // table's own arrays), this Perk grants qualification for only WHICHEVER movement type the
      // player chose - checked directly against the Perk's own system.choice here rather than
      // widening the shared table's own entry shape (a static array of always-true Perk IDs) to
      // support a conditional entry, avoiding any regression risk to the 3 already-shipped
      // unconditional appends.
      const goodToGoPerk = qualifiedVehicle
        ? CHOICE_SCOPED_VEHICLE_QUALIFICATION_IDS.map(id => findPerk(actor, id)).find(Boolean)
        : null;
      const isGoodToGoQualified = !!goodToGoPerk
        && qualifiedVehicle.system.movement[goodToGoPerk.system.choice]?.base > 0;
      if (isQualified || isGoodToGoQualified) {
        updatedShiftDataset.shiftUp += 1;
      }
    }

    // Saber-Toothed - see SABER_TOOTHED_ID's own comment above. Gated the same way the pre-existing
    // cryogenicTouchAvailable pre-fill already is (isUnarmedAttack itself isn't computed until
    // later in this function, so this re-derives the same "no parent weapon" check independently).
    updatedShiftDataset.saberToothedAvailable = item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
      && actorHasPerk(actor, SABER_TOOTHED_ID);

    // Get A Grip - see GET_A_GRIP_ID's own comment above. Same unarmed-attack gating idiom as
    // Saber-Toothed just above; the Size Class check itself happens post-hit, not here, since it
    // needs to compare against the actual target once the attack has landed.
    updatedShiftDataset.getAGripAvailable = item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
      && actorHasPerk(actor, GET_A_GRIP_ID);

    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above. Only meaningful on an
    // actual Outwit attempt.
    updatedShiftDataset.deceptiveWarfareAvailable = !!dataset.isOutwit && actorHasPerk(actor, DECEPTIVE_WARFARE_ID);

    // "Pseudo"-Science (WTNV Citizen's Guide, Scientist Role, Night Vale Community College Focus,
    // p.44) - see helpers/pseudo-science.mjs's own doc comment. Same shift-position-delta
    // mechanism as How Strange! above, but unscoped to any Skill Test other than Science itself
    // (rather than one fixed skill), gated on the session-long toggle rather than just holding
    // the Perk.
    updatedShiftDataset.pseudoScienceAvailable = rolledSkill != 'science' && actorHasPerk(actor, PSEUDO_SCIENCE_ID)
      && isPseudoScienceActive(actor);

    // A ranged weaponEffect attack (Penetrating Shot and Hobble below). Precision Aim, Sneak Attack
    // (Knights of Canterlot) and All I Need is One Shot are DialogSwitch rules on their own items.
    const isRangedWeaponEffect = item?.type == 'weaponEffect' && item.system.classification.style != 'melee';

    // Penetrating Shot (Pink Ranger, 5th level, p.49): "spending an additional 1 Personal Power
    // when using the Volley feature, you can choose to make a single attack against a single
    // target that will apply to all of the shots from the Volley. This attack gains upshift-1 per
    // additional shot after the first made in the Volley." Available only while Volley is active
    // and wielding a ranged weapon (Volley itself is already ranged-only, but this checks the
    // actual weaponEffect being rolled) - the bonus is Volley Shots minus 1 (the "additional
    // shots" count), read live via helpers/volley.mjs#getVolleyShots.
    updatedShiftDataset.penetratingShotAvailable = isRangedWeaponEffect && isVolleyActive(actor)
      && actorHasPerk(actor, PENETRATING_SHOT_ID)
      ? Math.max(0, getVolleyShots(actor) - 1)
      : 0;

    // Hobble (Decepticon Directive Raider, Acquisitions Expert Focus, 20th level, p.63): "as a
    // downshift 2 on a ranged attack, on a hit you may inflict Immobilized, Prone, or Restrained
    // (your choice) on the target until the end of their next turn." Ranged only, same shape as
    // Precision Aim's own scope check just above - a plain boolean (no scaling value to offer).
    updatedShiftDataset.hobbleAvailable = isRangedWeaponEffect && actorHasPerk(actor, HOBBLE_ID);

    // Crippling Blow (Decepticon Directive Raider Focus, p.59) - see helpers/crippling-blow.mjs's
    // own doc comment. Same declared-downshift-checkbox shape as Hobble just above, but melee
    // (rather than ranged) and ↓1 (rather than ↓2).
    updatedShiftDataset.cripplingBlowAvailable = isMeleeWeaponEffect && actorHasPerk(actor, CRIPPLING_BLOW_ID);

    // Dirty Blows - see DIRTY_BLOWS_ID's own comment above. Same melee-only gate as Crippling Blow
    // just above, but no downshift to declare.
    updatedShiftDataset.dirtyBlowsAvailable = isMeleeWeaponEffect && actorHasPerk(actor, DIRTY_BLOWS_ID);

    // Disarming Shot (General Hawk's Personnel Files, General Perk, p.174): "target a 1-handed
    // weapon in a creature's hands with a ranged attack. You suffer ↓3 on the Targeting Skill
    // Test. On a success, you knock the weapon out of their hand... On a Critical Success, the
    // weapon also goes off." Same "checkbox declares the fictional trigger, player self-polices"
    // idiom as Charge/Aiming above - "a 1-handed weapon" isn't checked (no per-weapon handedness
    // field, the same gap Weapon Conversion's own design pass already confirmed). The success/
    // Crit consequences are pure narrative (no tracked "weapon knocked away" state, and simulating
    // an accidental discharge would need per-weapon damage data this codebase has no reason to
    // apply automatically) - the roll's own existing success/Critical Success chat display already
    // conveys which outcome happened, so nothing further is built beyond the downshift itself.
    updatedShiftDataset.disarmingShotAvailable = isRangedWeaponEffect && actorHasPerk(actor, DISARMING_SHOT_ID);

    // All Out Attack, Evasive Fighting, Pinpoint, Make an Opening - helpers/target-riders.mjs.
    Object.assign(updatedShiftDataset, riderDialogFlags(actor, item, dataset));

    // "Kit required" - helpers/kits.mjs.
    Object.assign(updatedShiftDataset, kitDialogFlags(actor));
    // Synaptic Linkage, About Twenty-Percent Cooler - helpers/social-rolls.mjs.
    Object.assign(updatedShiftDataset, socialDialogFlags(actor, rolledSkill));
    // Extension controls, drawn by the dialog's generic extToggles block (helpers/extensions.mjs).
    const extToggles = extDialogToggles(actor, { item, rolledSkill, rolledEssence, dataset });
    if (extToggles.length) {
      updatedShiftDataset.extToggles = extToggles;
    }

    // Attacking Space Vessel Systems (Across the Stars p.25): "the attacker can choose to take a ↓2
    // penalty to add the following possible Critical Effect... Impose Space Vessel Condition of
    // attacker's choice on Target until repaired." Offered only when the checkable requirements hold -
    // see helpers/vessel-conditions.mjs#canTargetVesselSystem. The Critical Effect is applied in
    // _rollSkillHelper's post-roll processing (checkContext.targetVesselSystemAttempt).
    updatedShiftDataset.targetVesselSystemAvailable = canTargetVesselSystem({
      item,
      attackerShift: actorSkillData?.shift,
      targets: item?.type == 'weaponEffect' && game.user?.targets?.size == 1
        ? [game.user.targets.first?.()?.actor].filter(Boolean) : [],
    });

    // Bring It All Down (Decepticon Directive, Demolitionist Focus, 20th level, p.57) - see
    // helpers/bring-it-all-down.mjs's own doc comment. The "Gain ↑2 on an Attack Skill Test"
    // option; the other three (radius doubling, +2 damage, Armor-Piercing) are applied at
    // aoe-targeting.mjs#placeAoeTemplate, damageBonusValue, and the Armor Piercing/ignoreArmor
    // recompute respectively. The choice was already resolved once, up front, via
    // pickBringItAllDownEffect (item.mjs), so this just reads it back off dataset the same way
    // mindBeamEffect/enchantSkill already do - no separate Perk/style gate needed here since
    // pickBringItAllDownEffect never returns a non-null choice unless both already held true.
    if (dataset.bringItAllDownEffect == 'shiftUp') {
      updatedShiftDataset.shiftUp += 2;
    }

    // Cryogenic Touch (A Jump Through Time, Grid Power, p.57) - the Impaired-on-hit half; the
    // damage-type-override half is unconditional, see CRYOGENIC_TOUCH_ID's own comment above.
    // "You may spend 1 Personal Power when you hit" - offered whenever affordable on an unarmed
    // attack.
    updatedShiftDataset.cryogenicTouchAvailable = item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
      && actorHasPower(actor, CRYOGENIC_TOUCH_ID) && actor.system.powers.personal.value > 0;

    // Guardian Strikes - see GUARDIAN_STRIKES_ID's own comment above.
    updatedShiftDataset.guardianStrikesAvailable = item?.type == 'weaponEffect'
      && item.system.classification?.style == 'melee' && item.system.numHands == 2
      && actorHasPower(actor, GUARDIAN_STRIKES_ID);

    // Stick In The Spokes - see STICK_IN_THE_SPOKES_ID's own comment above.
    {
      const stickInTheSpokesTarget = game.user.targets.first()?.actor;
      updatedShiftDataset.stickInTheSpokesAvailable = item?.type == 'weaponEffect'
        && ['blunt', 'sharp'].includes(item.system.damageType) && actorHasPerk(actor, STICK_IN_THE_SPOKES_ID)
        && !hasUsedThisEncounter(actor, STICK_IN_THE_SPOKES_ENCOUNTER_FLAG)
        && stickInTheSpokesTarget?.type == 'vehicle'
        && getEffectiveLevel(stickInTheSpokesTarget) <= getEffectiveLevel(actor);
    }

    // Interdiction - see INTERDICTION_ID's own comment above.
    {
      const interdictionTarget = game.user.targets.first()?.actor;
      updatedShiftDataset.interdictionAvailable = item?.type == 'weaponEffect'
        && actorHasPerk(actor, INTERDICTION_ID) && !hasUsedThisEncounter(actor, INTERDICTION_ENCOUNTER_FLAG)
        && !!interdictionTarget && getEffectiveLevel(interdictionTarget) < getEffectiveLevel(actor);
    }

    // Penetrating Aim (Decepticon Directive Raider, Siegemaster Focus, 1st level, p.63): "when
    // spending a Free action to Aim, you may forgo the normal upshift 1 to instead ignore 1 point
    // of the target's armor Defense bonus (up to 2 points via 2 separate Free actions)." Same
    // ranged-only scope check as Precision Aim/Hobble above. The "2 Free actions for 2 points"
    // escalation isn't tracked (this system has no action-economy budget to spend a second Free
    // action against, the same firm gap "Extra Attack" and friends already hit throughout this
    // project) - offered as a flat 1-point ignore. Not enforced as mutually exclusive with the
    // ordinary Aiming checkbox either (RAW's own "instead of" is left to the player to self-
    // police, the same "the player simply only checks what the fiction supports" idiom Aiming's
    // own doc comment above already uses) - checking both nets both benefits, an accepted
    // simplification rather than new UI to disable one checkbox based on another.
    updatedShiftDataset.penetratingAimAvailable = isRangedWeaponEffect && actorHasPerk(actor, PENETRATING_AIM_ID);

    // Savant Skill - see SAVANT_SKILL_ID's own comment above. Offered only on the actor's own
    // chosen Skill.
    updatedShiftDataset.savantSkillAvailable = findPerk(actor, SAVANT_SKILL_ID)?.system.choice == rolledSkill;

    // Metallikato - see METALLIKATO_ID's own comment above. Melee-only, gated on Bot Mode
    // (RAW: "When in Bot Mode"), same shape as Penetrating Aim's own ignore-armor checkbox just
    // above but capped at the actor's own Smarts Essence score rather than a flat 1 point.
    updatedShiftDataset.metallikatoIgnoreArmorAvailable = isMeleeWeaponEffect
      && actor.system.isTransformed === false && actorHasPerk(actor, METALLIKATO_ID);

    // Metallikato - Multiple (2) Targets (↓1)'s own paired downshift. The trait GRANT itself
    // lives in helpers/multiple-targets.mjs (isMultipleTargetsWeapon, checked well before this
    // point) - this just applies the ↓1 cost automatically whenever that toggle is actually
    // active on a melee roll, no separate checkbox (unlike the armor-ignore benefit, this one has
    // no "how much" choice to make, so nothing for a checkbox to add).
    if (isMeleeWeaponEffect && actor.system.isTransformed === false
      && actorHasPerk(actor, METALLIKATO_ID) && isMetallikatoMultipleTargetsActive(actor)) {
      updatedShiftDataset.shiftDown += 1;
    }

    // Demolition Driver - see DEMOLITION_DRIVER_ID's own comment above. Capped at a fixed 3
    // (RAW's own "downshift 1, 2, or 3"), not a banked resource's current value like Terror.
    updatedShiftDataset.demolitionDriverAvailable = this._isDemolitionDriverAttack(actor, item) ? 3 : 0;

    // Programmable (Field Guide to Action and Adventure, Android Origin Benefit, p.60): "You can
    // give yourself ↑1 on any Skill Test as a Free action. You can use up to three Free actions in
    // this way on a single Skill Test." Offered unconditionally (any Skill Test), a fixed cap of 3
    // - same "fixed cap, not a banked resource" shape Demolition Driver just above uses (this is a
    // Free action, not a limited resource spend). The "can't increase your Skill Rank above a d12
    // even with upshifts from other sources" cap is enforced separately, right after
    // _getFinalShift resolves the whole roll (see skillRollOptions.programmableCapD12 below).
    updatedShiftDataset.programmableAvailable = actorHasPerk(actor, PROGRAMMABLE_ID) ? 3 : 0;

    // Military Formality - see MILITARY_FORMALITY_ID's own comment above.
    updatedShiftDataset.militaryFormalityAvailable = ['deception', 'intimidation', 'persuasion'].includes(rolledSkill)
      && actorHasPerk(actor, MILITARY_FORMALITY_ID) ? 3 : 0;

    // Caution To The Wind - see CAUTION_TO_THE_WIND_ID's own comment above. Offered on any Skill
    // Test (not attack-only, unlike Terror/Demolition Driver above), capped at RAW's own flat 3.
    updatedShiftDataset.cautionToTheWindAvailable = actorHasPerk(actor, CAUTION_TO_THE_WIND_ID) ? 3 : 0;

    // Combat Stance (Through the Shattered Grid, Magna Defender, 1st level, p.23-24) - see
    // helpers/combat-stance.mjs's own doc comment. The damage-spend half only - the shiftUp half
    // lives in _getAutomaticCombatModifiers instead, the same "target-scoped bonus" shape Mark
    // Target already established. Resolved via game.user.targets.first() directly (the same
    // pre-dialog pattern Team Focus/Move Like a Song's own marking already uses), since this
    // needs to know the ACTUAL target, not just that the roll is an Attack.
    const combatStanceTarget = item?.type == 'weaponEffect' ? game.user.targets.first()?.actor : null;
    updatedShiftDataset.combatStanceAvailable = !!combatStanceTarget && checkCombatStance(actor, combatStanceTarget)
      && actor.system.powers?.personal?.value > 0
      ? getCombatStanceNumber(actor)
      : 0;

    // Retribution (Through the Shattered Grid, Magna Defender, 7th level, p.25) - see
    // helpers/retribution.mjs's own doc comment. Melee-only ("make a single melee Attack"),
    // gated on a bonus banked by a Defender Step activation against whichever enemy is currently
    // targeted - same "resolved via game.user.targets.first() directly" pre-dialog shape Combat
    // Stance's own check just above already uses, and the same reason (need the ACTUAL target,
    // not just that this is an Attack). Stores the banked bonusType directly rather than a plain
    // boolean, since the checkbox's own consumption below needs to know which of the two grants
    // (damage vs Edge) to apply.
    {
      const retributionPending = getPendingBonus(actor, RETRIBUTION_PENDING_FLAG);
      const retributionTarget = game.user.targets.first()?.actor;
      updatedShiftDataset.retributionAvailable = isMeleeWeaponEffect && !!retributionPending
        && !!retributionTarget && retributionPending.targetUuid == retributionTarget.uuid
        && actor.system.powers?.personal?.value > 0
        ? retributionPending.bonusType
        : null;
    }

    // Withering Fire (Factions in Action Vol. 2, Infantry Focus, p.68): "If you Attack a target
    // that an ally Attacked since your last turn, you can spend a Story Point to give the target
    // the Frightened Condition if your Attack hits." Reuses Team Focus's own "attacked by an ally
    // this round" marking (helpers/team-focus.mjs) directly - checkTeamFocus() already checks
    // actorHasPerk(actor, WITHERING_FIRE_ID) internally, and RAW here names no melee restriction
    // (unlike Team Focus's own shiftUp, which is melee-only), so it's checked unqualified.
    const witheringFireTarget = item?.type == 'weaponEffect' ? game.user.targets.first()?.actor : null;
    updatedShiftDataset.witheringFireAvailable = !!witheringFireTarget
      && checkTeamFocus(actor, witheringFireTarget, WITHERING_FIRE_ID)
      && canWriteStoryPoints() && hasStoryPointsAvailable(1);

    // Size Matters - see SIZE_MATTERS_ID's own comment above. Only against a resolved target
    // that's actually a larger Size Class - "object" is approximated as a Vehicle-type target
    // (the same target.type == 'vehicle' proxy Viral News Bloggers already uses elsewhere in this
    // file), everything else reads as a "creature." The UI cap is a generous flat number (RAW
    // allows "any number") - the real limit is skillRollOptions.shiftUp itself, enforced where the
    // trade is actually consumed below.
    const sizeMattersTarget = item?.type == 'weaponEffect' && item.system.classification?.style != 'melee'
      ? game.user.targets.first()?.actor : null;
    const sizeMattersSizeOrder = Object.keys(E20.actorSizes);
    updatedShiftDataset.sizeMattersAvailable = !!sizeMattersTarget && actorHasPerk(actor, SIZE_MATTERS_ID)
      && sizeMattersSizeOrder.indexOf(sizeMattersTarget.system.size) > sizeMattersSizeOrder.indexOf(actor.system.size)
      ? 10 : 0;

    // Menacing Glare (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see
    // helpers/menacing-glare.mjs's own doc comment. A plain Intimidation Skill Test (the player
    // picks Willpower manually from the existing Defense dropdown, same as any other Skill Test
    // vs. Defense) - only the 1-Power cost is a checkbox here, gated on being able to afford it.
    updatedShiftDataset.menacingGlareAvailable = rolledSkill == 'intimidation'
      && actorHasPerk(actor, MENACING_GLARE_ID) && actor.system.powers.personal.value >= 1;

    // Instill Weakness (Decepticon Directive, Raider, 10th level, p.41) - see
    // helpers/instill-weakness.mjs's own doc comment. Same "plain Skill Test vs. a manually-picked
    // Defense" shape as Menacing Glare just above - the player picks Evasion from the existing
    // Defense dropdown.
    updatedShiftDataset.instillWeaknessAvailable = rolledSkill == 'technology'
      && actorHasPerk(actor, INSTILL_WEAKNESS_ID) && (actor.system.energon?.normal?.value ?? 0) >= 1;

    // Deconstructionist (Quartermaster's Guide to Gear, Neutralizer Focus, 1st level, p.26) - see
    // helpers/deconstructionist.mjs's own doc comment. Same "plain Skill Test" shape as Instill
    // Weakness/Menacing Glare just above.
    updatedShiftDataset.deconstructionistAvailable = rolledSkill == 'technology' && actorHasPerk(actor, DECONSTRUCTIONIST_ID);

    // No Factor (Quartermaster's Guide to Gear, Neutralizer Focus, 20th level, p.20) - see
    // helpers/no-factor.mjs's own doc comment. Same "declare intent via a checkbox" shape as
    // Deconstructionist just above, scoped to Deception.
    updatedShiftDataset.noFactorAvailable = rolledSkill == 'deception' && actorHasPerk(actor, NO_FACTOR_ID);

    // Dependable Tanker - see DEPENDABLE_TANKER_ID's own comment above.
    updatedShiftDataset.dependableTankerAvailable = ['driving', 'technology'].includes(rolledSkill)
      && actorHasPerk(actor, DEPENDABLE_TANKER_ID) && canWriteStoryPoints() && hasStoryPointsAvailable(1);

    // Hacking Algorithms - see HACKING_ALGORITHMS_ID's own comment above.
    updatedShiftDataset.hackingAlgorithmsAvailable = rolledSkill == 'technology'
      && actorHasPerk(actor, HACKING_ALGORITHMS_ID) && canWriteStoryPoints() && hasStoryPointsAvailable(1);

    // Bump & Run - see BUMP_AND_RUN_ID's own comment above. Any Attack Skill Test, not scoped to a
    // specific skill (unlike Charge's own Might-only wording).
    updatedShiftDataset.bumpAndRunAvailable = item?.type == 'weaponEffect' && actorHasPerk(actor, BUMP_AND_RUN_ID);

    // Electric (Damage Types): "Electric weapons gain an upshift on attacks." A core rule of the
    // damage type itself, unconditional and not gated behind any Perk - every Electric-damage
    // weaponEffect gets this, the same "checks item.system.damageType directly" shape as Barrel
    // Through just above.
    //
    // Tasing / Voltage Tank (PR CRB Weapon Upgrades, p.117-118): "The weapon gains the Electric
    // trait" - the upgrade never touches the weaponEffect's own damageType field, only the parent
    // Weapon item's system.traits (merged into itemAndUpgradeTraits by documents/item.mjs's own
    // _prepareTraits). Checking the parent weapon's traits alongside the weaponEffect's own
    // damageType is what actually makes those two upgrades (and any future "gains the Electric
    // trait" grant) do something, rather than remaining a purely cosmetic label.
    if (item?.type == 'weaponEffect' && (item.system.damageType == 'electric'
      || this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('electric'))) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Empty Hands (Factions in Action Vol. 2, General Perk, p.30): "If you are wielding no
    // weapons in Combat, your unarmed Attacks gain an Edge." Same "no parent weapon" proxy for
    // unarmed as the other unarmed Perks: _isUnarmedWeaponEffect, so the printed Unarmed Combat
    // weapon's own effects count too. "Wielding no weapons" = no equipped weapon item other than
    // those printed unarmed "weapons". Only preselects the Edge, so the player can still untick it.
    if (actorHasPerk(actor, EMPTY_HANDS_ID) && this._isUnarmedWeaponEffect(actor, item)
      && !actor.items?.some?.(i => i.type == 'weapon' && i.system?.equipped
        && !UNARMED_WEAPON_IDS.includes(i.flags?.core?.sourceId ?? i._stats?.compendiumSource ?? i?.flags?.essence20?.rulesSource))) {
      skillDataset.edge = true;
    }

    // Violent - see VIOLENT_ID's own comment above. Cancels the printed ↓1 on a damage-dealing
    // alternate effect whose weapon's own primary effect deals no Health damage.
    if (item?.type == 'weaponEffect' && item.system?.shiftDown > 0 && item.system?.damageValue
      && !NON_DAMAGE_EFFECT_TYPES.includes(item.system.damageType)
      && actorHasPerk(actor, VIOLENT_ID)) {
      const violentWeapon = this._getParentWeapon(actor, item);
      const violentEffects = Object.values(violentWeapon?.system?.items ?? {})
        .filter(effect => effect.type == 'weaponEffect');
      const violentPrimaries = violentEffects.filter(effect => !effect.shiftDown);
      if (violentPrimaries.length && violentPrimaries.every(
        effect => !effect.damageValue || NON_DAMAGE_EFFECT_TYPES.includes(effect.damageType),
      )) {
        updatedShiftDataset.shiftUp += 1;
      }
    }

    // Lend Assistance's Edge - see lendAssistanceEdge where the shift half is consumed above.
    if (lendAssistanceEdge) {
      skillDataset.edge = true;
    }

    // The Returned (Through the Shattered Grid, Influence Perk, p.112) - see
    // helpers/the-returned.mjs's own doc comment. A genuine Edge on the banked Skill, consumed the
    // same "bank now, consume on the next matching roll" shape as Ageless Knowledge/Paradox
    // (elsewhere in this function) - just banked/read here instead, since skillDataset itself
    // isn't constructed yet at that earlier point in the function.
    const pendingTheReturned = getPendingBonus(actor, THE_RETURNED_FLAG);
    if (pendingTheReturned?.skill == rolledSkill) {
      skillDataset.edge = true;
      await clearPendingBonus(actor, THE_RETURNED_FLAG);
    }

    // Mystical Understanding - Magically Fit In - see helpers/magically-fit-in.mjs's own doc
    // comment. Live, non-consumed, variable-amount read (unlike Awesome's own fixed +1 above).
    updatedShiftDataset.shiftUp += getMagicallyFitInBonus(actor, rolledSkill);

    // Burly / Rolling Thunder - see BURLY_ID/ROLLING_THUNDER_ID's own comment above.
    if (BURLY_SKILLS.includes(rolledSkill) && (actorHasPerk(actor, BURLY_ID) || actorHasPerk(actor, ROLLING_THUNDER_ID))) {
      const equippedArmor = actor.items.find(actorItem => actorItem.type == 'armor' && actorItem.system.equipped);
      const isUnarmoredOrLight = !equippedArmor || equippedArmor.system.classification == 'light';
      const pilotedVehicle = this._getPilotedVehicle(actor);
      const hasRollingThunder = actorHasPerk(actor, ROLLING_THUNDER_ID);
      if (isUnarmoredOrLight && (!pilotedVehicle || hasRollingThunder)) {
        let burlyBonus = 1;
        const rollingThunderTarget = pilotedVehicle && hasRollingThunder ? game.user.targets.first()?.actor : null;
        if (rollingThunderTarget) {
          const sizeOrder = Object.keys(E20.actorSizes);
          const ownIndex = Math.max(
            sizeOrder.indexOf(actor.system.size), sizeOrder.indexOf(pilotedVehicle.system.size),
          );
          const targetIndex = sizeOrder.indexOf(rollingThunderTarget.system.size);
          if (ownIndex != -1 && targetIndex != -1 && ownIndex > targetIndex) {
            burlyBonus += ownIndex - targetIndex;
          }
        }

        updatedShiftDataset.shiftUp += burlyBonus;
      }
    }

    // Peerless Pilot (GI Joe CRB, p.132) - Driving Skill Test half (the Initiative Edge is the item's
    // own rule). "Specialized in" the vehicle is approximated as "has any Driving Specialization at
    // all" - specializations have no stable id to match a particular vehicle's type against.
    if (rolledSkill == 'driving' && actorHasPerk(actor, PEERLESS_PILOT_GIJ_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && Object.keys(actor.system.skills.driving?.specializations ?? {}).length > 0) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Tracker - see TRACKER_ENVIRONMENTAL_ID's own comment above.
    if (rolledSkill == 'survival' && actorHasPerk(actor, TRACKER_ENVIRONMENTAL_ID) && hasActiveEnvironmentalExpertise(actor)) {
      updatedShiftDataset.shiftUp += 2;
      // Listed (and untickable, e.g. when not actually tracking) in the Roll Options Dialog.
      combatModifiers.sources.push({
        id: 'trackerEnvironmental',
        label: getEnvironmentOfExpertiseSourceLabel(actor, findPerk(actor, TRACKER_ENVIRONMENTAL_ID)?.name ?? 'Tracker'),
        shiftUp: 2, shiftDown: 0, edge: false, snag: false,
      });
    }

    // Martial Zord / Zero-G - see their own ID comments above. Both are Zord Features (checked
    // on the actor actually making the roll - the Zord itself, not its pilot), gated on the
    // Zord currently having a driver seated (_getVehicleDriver, the same pilot-lookup Heavy
    // Ordnance/Sideswipe/Demolition Driver already use).
    if (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'
      && actor?.type == 'zord' && actorHasZordFeature(actor, MARTIAL_ZORD_ID) && this._getVehicleDriver(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    if (item?.type == 'weaponEffect' && item.system.classification.style != 'melee'
      && actor?.type == 'zord' && actorHasZordFeature(actor, ZERO_G_ID) && this._getVehicleDriver(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Zord Sentience - see ZORD_SENTIENCE_ID's own comment above. Only its own Driving
    // (Autopilot) Skill Tests, and only while nobody is actually driving it.
    if (rolledSkill == 'driving' && actor?.type == 'zord' && actorHasZordFeature(actor, ZORD_SENTIENCE_ID)
      && !this._getVehicleDriver(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Power Adaptation - Crushing Strength (Across the Stars, Silver Ranger, 9th/18th level,
    // p.57) - see helpers/power-adaptation.mjs's own doc comment. "↑2 to all Athletics and Brawn
    // Skill Tests" while active.
    if ((rolledSkill == 'athletics' || rolledSkill == 'brawn') && isPowerAdaptationActive(actor, 'crushingStrength')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level) - see
    // helpers/psycho-assault.mjs's own doc comment. ↑1 on any Attack for the rest of the turn it
    // was activated on; the damage half is folded into damageBonusValue below.
    if (item?.type == 'weaponEffect' && isPsychoAssaultActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level, p.288) - see
    // helpers/growing-smolder.mjs's own doc comment. Read and immediately cleared here (not
    // gated on a hit) - RAW grants this "to your attacks," consumed by the act of attacking, not
    // by landing. The matching damage half is folded into damageBonusValue below.
    const growingSmolderStacks = item?.type == 'weaponEffect' ? await consumeGrowingSmolderStacks(actor) : 0;
    updatedShiftDataset.shiftUp += growingSmolderStacks;

    // Pack Mule (Knights of Canterlot, Beam spell, p.44) - see helpers/pack-mule.mjs's own doc
    // comment. "Downshift 2 to all Strength and Speed Skill Tests" for the spell's 3-round
    // duration, banked on the TARGET when it hits (below) and read here on their own later rolls.
    const packMuleFlag = actor.getFlag?.('essence20', PACK_MULE_DOWNSHIFT_FLAG);
    if ((rolledEssence == 'strength' || rolledEssence == 'speed') && game.combat && packMuleFlag
      && packMuleFlag.combatId == game.combat.id && game.combat.round <= packMuleFlag.round + 2) {
      updatedShiftDataset.shiftDown += 2;
    }

    // Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level) - see
    // helpers/toxic-terror.mjs's own doc comment. Same Strength/Speed-scoped downshift shape as
    // Pack Mule just above, but a stacking amount (no round-scoped expiry) instead of a flat 2.
    if (rolledEssence == 'strength' || rolledEssence == 'speed') {
      updatedShiftDataset.shiftDown += getToxicTerrorShiftDown(actor);
    }

    // Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // helpers/greased-lightning.mjs's own doc comment. "Upshift 1 to Speed-related Skill Tests"
    // while active.
    if (rolledEssence == 'speed' && isGreasedLightningActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Mystery Sense (Knights of Canterlot, Superior Enchantment spell, p.47) - see
    // helpers/mystery-sense.mjs's own doc comment. "+3 to Alertness, Infiltration, and Streetwise"
    // while active.
    if ((rolledSkill == 'alertness' || rolledSkill == 'infiltration' || rolledSkill == 'streetwise')
      && isMysterySenseActive(actor)) {
      updatedShiftDataset.shiftUp += 3;
    }

    // Foolscarrot (Knights of Canterlot, Elementary Enchantment spell, p.42) - see
    // helpers/foolscarrot.mjs's own doc comment. "Downshift 3 to all Skill Tests" while active -
    // unconditional, not scoped to any particular skill/essence.
    if (isFoolscarrotActive(actor)) {
      updatedShiftDataset.shiftDown += 3;
    }

    // Scarefying Appearance (Knights of Canterlot, Virtuoso Enchantment spell, p.51) - see
    // helpers/scarefying-appearance.mjs's own doc comment. "+2 to the use of the Intimidation
    // Skill" while active.
    if (rolledSkill == 'intimidation' && isScarefyingAppearanceActive(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Wisdom of the Elders - Enhanced Reflexes (Through the Shattered Grid, Guardian of Eltar,
    // 9th/18th level, p.72): "↑2 to all Acrobatics and Initiative Skill Tests" while active - the
    // Acrobatics half (the Initiative ↑2 is the Wisdom of the Eldars item's own rule, read by
    // prepareInitiativeRoll()).
    if (rolledSkill == 'acrobatics' && isWisdomOfTheEldersActive(actor, 'enhancedReflexes')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Ninja Power (PR CRB, General Perk, p.97) - see helpers/ninja-power.mjs's own doc comment.
    // "Edge on all Speed-based skills" while Morphed with Ninja Power active.
    if (rolledEssence == 'speed' && actor.system.isMorphed && isNinjaPowerActive(actor)
      && actorHasPerk(actor, NINJA_POWER_ID)) {
      skillDataset.edge = true;
    }

    // Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): "↑2 to
    // Deception Skill Tests" while the disguise is active - same shape as Enhanced Reflexes just
    // above.
    if (rolledSkill == 'deception' && isObserverDisguiseActive(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76) - see PERFECT_DISGUISE_ID's own
    // comment above. "Edge on all social interactions" while the disguise is active.
    if (PERFECT_DISGUISE_SKILLS.includes(rolledSkill) && actorHasPerk(actor, PERFECT_DISGUISE_ID)
      && isPerfectDisguiseActive(actor)) {
      skillDataset.edge = true;
    }

    // Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50) - see
    // helpers/ookie-spookies.mjs's own doc comment. "Edge on any Skill Tests to sneak about" while
    // active - read as Infiltration, this system's own "sneak about" skill.
    if (rolledSkill == 'infiltration' && isOokieSpookiesActive(actor)) {
      skillDataset.edge = true;
    }

    // Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21) - see
    // helpers/dsoe-disguise.mjs's own doc comment. Same "Edge on Infiltration/Deception while
    // active" shape as Illusory Disguise/Observer just above.
    if ((rolledSkill == 'infiltration' || rolledSkill == 'deception') && isDsoeDisguiseActive(actor)) {
      skillDataset.edge = true;
    }

    // Tactical Meditation (Through the Shattered Grid, Guardian of Eltar, Chief Guardian choice,
    // p.73): "allies within 10 feet gain ↑2 to Alertness and Initiative Skill Tests" - the
    // Alertness half; see prepareInitiativeRoll's own comment for the Initiative half.
    if (rolledSkill == 'alertness' && hasNearbyTacticalMeditation(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Power Adaptation - Striking Hands (Across the Stars, Silver Ranger, 9th/18th level, p.57) -
    // see helpers/power-adaptation.mjs's own doc comment. "↑1 to your unarmed Attacks" while
    // active - "unarmed" detected the same way Phantom Ranger Prime's identical clause already
    // does (no parent weapon Item backs the attack).
    if (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
      && isPowerAdaptationActive(actor, 'strikingHands')) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Pointy (Dark Skies Over Equestria, General Perk, p.21) - see POINTY_ID's own comment above.
    // Same "no parent weapon" unarmed proxy, gated on the toggle instead of a bare actorHasPerk.
    if (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item) && isPointyActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
    // helpers/phantom-suite.mjs's own doc comment. "↑1 and Edge to all Infiltration (Stealth)
    // Skill Tests" while active - the Evasion Defense bonus half lives in the per-target
    // checkEntries construction below instead (a target-side effect, not a self-status one).
    if (rolledSkill == 'infiltration' && isPhantomSuiteActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
      skillDataset.edge = true;
    }

    updatedShiftDataset.rolePoints = null;
    updatedShiftDataset.damageRolePoints = null;

    let rolePoints = null;
    let damageRolePoints = null;
    if (item?.type == 'weaponEffect') {
      const baseRolePoints = actor._getBaseRolePoints?.();
      const isRolePointsActive = baseRolePoints
        && (baseRolePoints.system.isActive || !baseRolePoints.system.isActivatable);

      if (isRolePointsActive && baseRolePoints.system.bonus.type == 'attackUpshift') {
        rolePoints = baseRolePoints;
        updatedShiftDataset.rolePoints = rolePoints;
      } else if (isRolePointsActive && baseRolePoints.system.bonus.type == 'damageBonus') {
        damageRolePoints = {
          name: baseRolePoints.name,
          value: baseRolePoints.system.bonus.value,
          sourceId: baseRolePoints.flags?.core?.sourceId ?? baseRolePoints._stats?.compendiumSource ?? baseRolePoints?.flags?.essence20?.rulesSource,
        };

        // Sneak Attack Damage (GI Joe CRB p.72) is the one damageBonus grant whose fictional
        // trigger conditions are actually known and automatable - see helpers/sneak-attack.mjs.
        // Any other damageBonus Role Points Item (e.g. Power Rangers' Power Strike, My Little
        // Pony's Hard Hitter) still gets the checkbox below, just always starting unchecked like
        // rolePoints/attackUpshift already does above.
        damageRolePoints.isSneakAttack = isSneakAttackDamageItem(baseRolePoints);
        if (damageRolePoints.isSneakAttack) {
          const { eligible, reason, viaSuddenStrike } = checkSneakAttackEligibility(actor, item, skillDataset.edge);
          damageRolePoints.autoEligible = eligible;
          damageRolePoints.autoReason = reason;
          // Only true when Sudden Strike is the ONLY reason this attack qualifies - what decides
          // whether applying the damage below spends its Story Point and once-per-combat use.
          damageRolePoints.viaSuddenStrike = !!viaSuddenStrike;

          // Quiet as the Grave (Infiltrator Focus, 20th level): "once per turn, you may double
          // your sneak attack damage bonus against a target." Its own once-per-round use,
          // independent of Sneak Attack's own once-per-round gate above. Offered as a second Roll
          // Options Dialog checkbox unconditional on auto-detected eligibility - same reasoning
          // as the "apply this bonus?" checkbox itself just above, which is always offered too
          // (only its default checked state depends on eligibility).
          damageRolePoints.canDouble = actorHasPerk(actor, QUIET_AS_THE_GRAVE_ID)
            && !hasUsedThisRound(actor, QUIET_AS_THE_GRAVE_ROUND_FLAG);
        }

        updatedShiftDataset.damageRolePoints = damageRolePoints;
      }
    }

    // Ranger/Predator's own Sneak Attack (GI Joe CRB p.93) - a completely separate grant from the
    // damageBonus Role Points block above (a Ranger's own Role Points resource is Adaptation
    // Points, unrelated to damage), so it only claims this same damageRolePoints dialog slot when
    // nothing above already has (in practice these never coincide on one actor, since Commando and
    // Ranger are different Roles, but the guard keeps a Commando's own damageBonus Role Points
    // taking precedence if it somehow did).
    if (!damageRolePoints && item?.type == 'weaponEffect' && hasPredatorSneakAttack(actor)) {
      damageRolePoints = {
        name: this._localize('E20.PredatorSneakAttack'),
        value: getPredatorSneakAttackDamage(actor.system.level),
        isPredatorSneakAttack: true,
      };

      const { eligible, reason } = checkPredatorSneakAttackEligibility(actor, item);
      damageRolePoints.autoEligible = eligible;
      damageRolePoints.autoReason = reason;
      updatedShiftDataset.damageRolePoints = damageRolePoints;
    }

    // Force Recon's own Sneak Attack (Ferocious Fighters, Focus, 6th level, p.47) - see
    // helpers/force-recon-sneak-attack.mjs's own doc comment. Same "claim the shared damageRolePoints
    // dialog slot" shape as Predator's own version just above, guarded the same way.
    if (!damageRolePoints && item?.type == 'weaponEffect' && actorHasPerk(actor, FORCE_RECON_SNEAK_ATTACK_ID)) {
      damageRolePoints = {
        name: this._localize('E20.PredatorSneakAttack'),
        value: getPredatorSneakAttackDamage(actor.system.level),
        isForceReconSneakAttack: true,
      };

      const { eligible, reason } = checkForceReconSneakAttackEligibility(actor);
      damageRolePoints.autoEligible = eligible;
      damageRolePoints.autoReason = reason;
      updatedShiftDataset.damageRolePoints = damageRolePoints;
    }

    // Aiming (p.192) is a Ranged weapon-specific Free action granting a 1 shift on a single
    // ranged attack test, plus an additional 1 shift with an attached Laser Sight (p.148/125).
    // Presented as a toggle in the Roll Options Dialog rather than tracked as standing state -
    // the dialog is a fresh form on every roll, so there's nothing to "consume" or clear on
    // Movement; the player simply only checks it when they actually aimed and haven't moved.
    const isRangedAttack = item?.type == 'weaponEffect' && item.system.classification.style != 'melee';

    // Item rules' AimBonus (rules/adapter.mjs#ruleAimBonus): Distance Vision's first Aim each turn, Dig
    // In's while dug in and Calculated Attack's primed Long Range Rifle shot give ↑2 instead of ↑1. Their
    // limits are spent (and Calculated Attack's priming cleared) only if the shot is aimed.
    const aimRules = isRangedAttack ? ruleAimBonus(actor, game.user?.targets?.first?.()?.actor ?? null, { item, rolledSkill }) : { atLeast: 0, extra: 0, spend: async () => {} };
    updatedShiftDataset.aimBonus = isRangedAttack
      ? Math.max(1, aimRules.atLeast) + aimRules.extra + this._getLaserSightBonus(actor, item)
      : null;
    // The Aim action taken this turn (helpers/action-economy.mjs#isAiming) starts the switch on.
    updatedShiftDataset.aimedByAction = isRangedAttack && isAiming(actor);

    // Unshakeable Aim is the Perk's own DialogSwitch rule (replacesAim, costs 1 Personal Power).

    // Jack Of All Trades (GI Joe CRB, Undercover Agent Focus, p.76): "You may roll a d4 on Skill
    // Tests if you have at least a d2 in that Skill. You cannot crit on this d4." A real tradeoff
    // (trading crit potential for a better die), so offered as its own opt-in checkbox rather than
    // auto-applied - only meaningful, and so only offered, when the Skill's own current shift is
    // exactly d2 (any higher and rolling "a d4" would be a downgrade nobody would take).
    updatedShiftDataset.jackOfAllTradesAvailable = skillDataset.shift == 'd2' && actorHasPerk(actor, JACK_OF_ALL_TRADES_ID);

    // In My Sights' Edge instead of the Aim bonus is the Perk's own DialogSwitch rule (replacesAim).

    // Energon Points (p.104-105): a Cybertronian may spend one to gain a 1 shift on any Skill
    // Test. Like Aiming, presented as a Roll Options Dialog toggle rather than standing state;
    // unlike Aiming, spending one actually consumes a real, persisted resource, so the point is
    // only deducted once the roll is confirmed (not if the dialog is cancelled).
    // Boolean(...) rather than plain && - actor.system.canTransform is undefined for actor
    // types that don't define it at all (e.g. some test/mock actors), and `undefined && x`
    // evaluates to undefined rather than false, leaking a non-boolean into the dataset.
    updatedShiftDataset.energonAvailable = Boolean(actor.system.canTransform && actor.system.energon.normal.value > 0)
      || !!betterAsOneDonor(actor);

    // "Roll a Skill Test as if Specialized" for a Story Point (GI Joe CRB p.127; every line has
    // it). Same Roll Options Dialog shape as Energon just above - a toggle the player checks,
    // paid only once the roll is confirmed - and only offered when the roll is not already
    // Specialized, since there would be nothing to buy. Draws on whichever pool is this
    // actor's own (helpers/story-points.mjs#poolFor).
    updatedShiftDataset.storyPointSpecializedAvailable = !updatedShiftDataset.isSpecialized && canSpendForActor(actor);

    // Akimbo (Fighting Style option, p.79/108): "If you have a pistol or a submachine gun in
    // each hand, you receive an upshift on your off-hand attack." No dual-wielding/hand-tracking
    // concept exists anywhere in this system (weapon Items carry no structured type/category
    // field either - see Coin Toss's own NO-GO note), so - same reasoning as Aiming above - this
    // is a Roll Options Dialog toggle the player only checks when they're actually attacking
    // with their off-hand while dual-wielding a qualifying pair, not anything auto-detected.
    updatedShiftDataset.akimboAvailable = isRangedAttack && this._hasFightingStyle(actor, 'akimbo');

    // Two-Handed Assault - see TWO_HANDED_ASSAULT_ID's own comment above. Available when the
    // actual weapon being rolled carries the Martial Arts + Silent traits AND matches whichever
    // handedness the actor's own choice named (a light one-handed weapon for dualWieldLight, a
    // two-handed weapon for twoHanded) - "dual-wielding a SECOND light weapon" itself can't be
    // verified (no hand-tracking exists), same limitation Akimbo's own identical checkbox has.
    {
      const isTwoHandedAssaultEligibleItem = item?.type == 'weaponEffect' && item.system.classification.style == 'melee';
      const twoHandedAssaultPerk = isTwoHandedAssaultEligibleItem ? findPerk(actor, TWO_HANDED_ASSAULT_ID) : null;
      const twoHandedAssaultWeapon = isTwoHandedAssaultEligibleItem ? this._getParentWeapon(actor, item) : null;
      const hasQualifyingTraits = !!twoHandedAssaultWeapon?.system.traits?.includes('silent')
        && !!twoHandedAssaultWeapon?.system.traits?.includes('martialArts');
      const matchesChoice = twoHandedAssaultPerk?.system.choice == 'dualWieldLight'
        ? twoHandedAssaultWeapon?.system.classification?.size == 'light'
        : twoHandedAssaultPerk?.system.choice == 'twoHanded' && item?.system.numHands == 2;
      updatedShiftDataset.twoHandedAssaultAvailable = !!twoHandedAssaultPerk && hasQualifyingTraits && matchesChoice;
    }

    // Alpha Strike - see _isAlphaStrikeAttack's own doc comment above for why this is only gated
    // on the attack type, not the Perk's own (unenforced) range condition.
    updatedShiftDataset.alphaStrikeAvailable = this._isAlphaStrikeAttack(actor, item);

    // Empty the Mag - see _isEmptyTheMagAttack's own doc comment above.
    updatedShiftDataset.emptyTheMagAvailable = this._isEmptyTheMagAttack(actor, item);

    // Driving Strike: "before making a melee attack" - only offered on a melee weaponEffect roll,
    // and only if the actor can actually afford its 1 Personal Power cost.
    const isMeleeAttack = item?.type == 'weaponEffect' && item.system.classification.style == 'melee';
    updatedShiftDataset.drivingStrikeAvailable = isMeleeAttack
      && this._actorHasPerk(actor, DRIVING_STRIKE_PERK_ID)
      && actor.system.powers?.personal?.value > 0;

    // Integrated Hardpoint movement penalty (TF CRB p.114): attacking with a weapon in an
    // Integrated Hardpoint takes shiftDown 1 for moving up to your Movement this turn, and
    // shiftDown 2 for moving beyond it; a Reinforced Hardpoint negates the first. Surfaced as a
    // Roll Options Dialog choice - the player states how they moved - rather than read from live
    // token movement, mirroring how Aiming and Energon are handled above. Null unless this is a
    // weaponEffect whose parent weapon actually sits in an Integrated Hardpoint.
    updatedShiftDataset.hardpointMovement = null;
    if (item?.type == 'weaponEffect') {
      const parentWeapon = actor.items?.get?.(item.flags?.essence20?.parentId);
      if (parentWeapon?.system.hardpoint?.type == 'integrated') {
        updatedShiftDataset.hardpointMovement = { reinforced: firesAsReinforced(actor, parentWeapon) };
      }
    }

    // Prototype / Theoretical Kit - see helpers/kits.mjs#kitSources. A Snag that would cancel the
    // kit's Edge is ignored, so the dialog opens on Edge rather than Normal. Checked again right
    // before the shifts resolve, for Snags added after the dialog.
    if (kitBoosts.ignoreSnagOnEdge && skillDataset.edge) {
      skillDataset.snag = false;
    }

    const skillRollOptions = await this._rollDialog.getSkillRollOptions(updatedShiftDataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      // Reported rather than returning a bare undefined, so an item roll that spent an action
      // before opening this dialog can tell "the player backed out" apart from "the roll finished
      // and returned nothing", and refund accordingly (documents/item.mjs#_rollWithRefund). Every
      // other early return in this method is a real outcome, not a cancellation, and stays bare.
      return { cancelled: true };
    }

    await markBattlizerAttack(actor, battlizerWeapon);

    // Surging - a Free action, then the element damage doubles for this attack.
    if (skillRollOptions.applySurging) {
      const paid = await spend(actor, 'free', { source: this._getParentWeapon(actor, item)?.name ?? item?.name });
      if (paid.blocked) {
        return { cancelled: true };
      }
    }

    // Analyze Target is "a Standard action" (TF CRB, Analyst, p.59) - Quick Study makes it a Move
    // action and Swift Study a Free one (helpers/action-perks.mjs). The checkbox is the only place
    // the roll says it's an Analyze Target attempt, so this is where it's charged.
    if (skillRollOptions.applyAnalyzeTarget) {
      const paid = await spend(actor, 'standard', {
        source: this._localize('E20.ActionAnalyzeTarget'), context: { kind: 'analyzeTarget' },
      });
      if (paid.blocked) {
        return { cancelled: true };
      }
    }

    for (const skillEffect of updatedShiftDataset.availableSkillEffects) {
      if (skillRollOptions.selectedSkillEffectIds?.includes(skillEffect.id)) {
        applySkillEffectBonus(actor, skillEffect.changes, skillRollOptions, skillDataset.shift);
      }
    }

    // Automatic combat modifier sources (see _getAutomaticCombatModifiers's own addSource doc
    // comment) - each shiftUp/shiftDown-granting one was pre-filled into skillRollOptions.shiftUp/
    // shiftDown as part of the dialog's own starting total (matching this function's own
    // long-standing default-everything-applies behavior); a source the player unchecked in the
    // dialog has its own shiftUp/shiftDown subtracted back out here. Edge/snag-granting sources
    // aren't touched here at all - they're informational-only (the existing Snag/Normal/Edge radio
    // is already the one interactive control for edge/snag, see roll-dialog.hbs's own comment).
    for (const source of updatedShiftDataset.combatModifierSources) {
      if (skillRollOptions.disabledModifierSourceIds?.includes(source.id)) {
        skillRollOptions.shiftUp -= source.shiftUp;
        skillRollOptions.shiftDown -= source.shiftDown;

        // Spiked / Energized Plating: "must suffer -1 [-2] on the attack or take 1 damage" - the
        // penalty turned down, so the damage is taken.
        if (source.declinedDamage) {
          await applyDamage(actor, source.declinedDamage.value, source.declinedDamage.type);
          this._chatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: this._localize('E20.VehicleDeclinedPenalty', { name: actor.name, source: source.label, damage: source.declinedDamage.value }),
          });
        }
      }
    }

    // What the player said about their movement, converted into the shiftDown it costs. Sits
    // with the other shift adjustments rather than at the detection site above, because it can
    // only be known once the dialog has come back.
    if (skillRollOptions.hardpointMovePenalty) {
      skillRollOptions.shiftDown += skillRollOptions.hardpointMovePenalty;
    }

    // Retrogen - see updatedShiftDataset.retrogenAvailable's own comment above.
    if (skillRollOptions.applyRetrogen && updatedShiftDataset.retrogenAvailable) {
      skillRollOptions.shiftUp += 1;
    }

    // Fanning - see helpers/fanning.mjs's own doc comment. The first shot's own shifts go straight
    // into the roll's totals here; every later shot is re-resolved from these in the repeat loop.
    const fanningShots = clampFanningShots(skillRollOptions.fanningShots, updatedShiftDataset.fanningMaxShots);
    const fanningHasStormOfLead = fanningShots > 0 && actorHasPerk(actor, STORM_OF_LEAD_ID);
    const firstFanningShot = fanningShots > 0 ? getFanningShotShifts(1, fanningHasStormOfLead) : null;
    if (firstFanningShot) {
      skillRollOptions.shiftUp += firstFanningShot.shiftUp;
      skillRollOptions.shiftDown += firstFanningShot.shiftDown;
    }

    // All Out Attack / Evasive Fighting / Make an Opening downshifts - helpers/target-riders.mjs.
    await applyDialogRiders(actor, skillRollOptions);
    await applyDialogKits(actor, skillRollOptions, { skill: rolledSkill, spec: specialization?.name ?? null, consumes: kitBoosts.consumes });
    await applySocialDialog(actor, skillRollOptions);
    // baseShift: a ticked "roll <Skill> instead" switch (DialogSwitch useSkill) is the shift-position
    // difference from the die settled on before the dialog (initialShift), not the Skill's plain shift.
    await runApplyDialog(actor, skillRollOptions, { item, rolledSkill, rolledEssence, dataset, baseShift: initialShift });

    if (skillRollOptions.isAiming) {
      skillRollOptions.shiftUp += updatedShiftDataset.aimBonus;
      await aimRules.spend();
    }

    // Pythonized - see updatedShiftDataset.pythonizedAvailable's own comment above.
    if (skillRollOptions.applyPythonized) {
      skillRollOptions.edge = true;
    }

    // Inventor - see INVENTOR_ID's own comment above.
    if (skillRollOptions.applyInventor) {
      skillRollOptions.edge = true;
      skillRollOptions.shiftDown = Math.max(0, skillRollOptions.shiftDown - 1);
    }

    // Gutter Champion - see updatedShiftDataset.gutterChampionAvailable's own comment above.
    if (skillRollOptions.applyGutterChampion) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'gutterChampionUsedThisTurn');
    }

    // Beloved - see updatedShiftDataset.belovedAvailable's own comment above. The ↑1 half; the
    // "remove Snag" half (belovedRemoveSnag) is resolved further down, next to Ambitious, so it
    // also clears Snags added after the dialog.
    if (skillRollOptions.applyBeloved) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'belovedUsedThisTurn');
    }

    // Thrillseeker - see updatedShiftDataset.thrillseekerAvailable's own comment above. The
    // player is voluntarily imposing a Snag on themselves, so this doesn't clear edge - the same
    // "edge == snag cancels out" rule other Snag grants already rely on applies here too.
    if (skillRollOptions.applyThrillseeker) {
      skillRollOptions.snag = true;
      await markUsedThisScene(actor, THRILLSEEKER_SCENE_FLAG);
    }

    // Straight Shooter - see updatedShiftDataset.straightShooterAvailable's own comment above.
    if (skillRollOptions.applyStraightShooter) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'straightShooterUsedThisTurn');
    }

    // Jack Of All Trades - see updatedShiftDataset.jackOfAllTradesAvailable's own comment above.
    // d2 -> d4 is exactly one step up E20.skillShiftList, so a plain +1 shiftUp gets the right
    // die; the "cannot crit on this d4" half is threaded through as suppressCrit below, read in
    // _rollSkillHelper's own isCrit computation (the same "mutate isCrit/isFumble after the fact"
    // idiom Time Traveler's own Hang-Up already establishes for widening Fumble).
    if (skillRollOptions.applyJackOfAllTrades) {
      skillRollOptions.shiftUp += 1;
      skillRollOptions.suppressCrit = true;
    }

    // As if Specialized for a Story Point - see updatedShiftDataset.storyPointSpecializedAvailable
    // above. Forces the dialog's own Specialized toggle on, the same "checkbox forces an
    // already-resolved field" shape Worth A Shot uses below, and spends once the roll is
    // committed to.
    if (skillRollOptions.spendStoryPointSpecialized) {
      skillRollOptions.isSpecialized = true;
      await spendForActor(actor, 1, { announce: false });
      this._chatMessage.create({
        speaker: this._chatMessage.getSpeaker({ actor }),
        content: this._localize('E20.SptSpecializedSpent', { name: actor.name }),
      });
    }

    // The Friendship Circle upshift drawn above is spent by this roll, now that it is happening.
    if (pendingCircleShift?.shiftUp) {
      await clearPendingBonus(actor, CIRCLE_SHIFT_FLAG);
    }

    if (skillRollOptions.spendEnergon) {
      skillRollOptions.shiftUp += 1;

      // Imaginative Engineering - see IMAGINATIVE_ENGINEERING_ID's own comment above.
      if (actorHasPerk(actor, IMAGINATIVE_ENGINEERING_ID) && !hasUsedThisRound(actor, IMAGINATIVE_ENGINEERING_ROUND_FLAG)) {
        skillRollOptions.shiftUp += 1;
        await markUsedThisRound(actor, IMAGINATIVE_ENGINEERING_ROUND_FLAG);
      }

      let newEnergonValue = actor.system.energon.normal.value - 1;

      // Energon Efficiency - see ENERGON_EFFICIENCY_ID's own comment above.
      if (actorHasPerk(actor, ENERGON_EFFICIENCY_ID) && actor.system.energon.normal.value == 1) {
        const energonEfficiencyRoll = await new Roll('1d6').evaluate();
        if (energonEfficiencyRoll.total >= 5) {
          newEnergonValue += 1;
        }
      }

      // Better As One (Enigma of Combination p.34): "you may spend 1 Energon Point from your personal
      // Energon pool to give a combined form you are a component of the normal ↑1 bonus to a Skill Test
      // (instead of spending from the combined form's Energon pool, if any)."
      const donor = !(actor.system.energon?.normal?.value > 0) ? betterAsOneDonor(actor) : null;
      if (donor) {
        await payBetterAsOne(donor);
      } else {
        await actor.update({ 'system.energon.normal.value': newEnergonValue });
      }
    }

    if (skillRollOptions.akimbo) {
      skillRollOptions.shiftUp += 1;
    }

    if (skillRollOptions.twoHandedAssault) {
      skillRollOptions.shiftUp += 1;
    }

    // Strike Bonus - see its own comment above. applyStrikeBonus is only ever offered (per
    // updatedShiftDataset.strikeBonusAvailable) when the actor can actually afford it, so no
    // further guard is needed here before spending.
    if (skillRollOptions.applyStrikeBonus) {
      skillRollOptions.shiftUp += updatedShiftDataset.strikeBonusAvailable;
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
      await markUsedThisRound(actor, STRIKE_BONUS_ROUND_FLAG);
    }

    // Heavy Force - see HEAVY_FORCE_ID's own comment above. Same "only ever offered when
    // affordable" idiom as Strike Bonus just above, a fixed +2 instead of a scaling value.
    if (skillRollOptions.applyHeavyForce) {
      skillRollOptions.shiftUp += 2;
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
      await markUsedThisTurn(actor, HEAVY_FORCE_TURN_FLAG);
    }

    // Cunning Plan - see CUNNING_PLAN_ID's own comment above and updatedShiftDataset.cunningPlanAvailable's
    // own affordability check (only ever offered when a Cunning die actually exists, so no further
    // guard is needed here before spending). Converts the shift-list position DIFFERENCE between
    // the Cunning die and the skill actually being rolled (initialShift, from before this dialog
    // ever opened) into a shiftUp/shiftDown delta - the same generic mechanism every other
    // shift-adjusting checkbox in this file already feeds into _getFinalShift below.
    if (skillRollOptions.applyCunningPlan) {
      const cunningPlanShift = actor.getRollData().skills.roleSkillDie.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const cunningIndex = E20.skillShiftList.indexOf(cunningPlanShift);
      if (currentIndex >= 0 && cunningIndex >= 0) {
        const delta = currentIndex - cunningIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Worth A Shot - see updatedShiftDataset.worthAShotAvailable's own comment above. Same
    // shift-position-delta mechanism as Cunning Plan, substituting the actor's own Targeting skill
    // die, plus the isSpecialized half folded into the same checkbox (overriding whatever the
    // dialog's own separate Specialized toggle already resolved to, the same "checkbox forces an
    // already-resolved field" shape Solo Shot/Eureka! already establish for edge/snag). Free (no
    // cost). Only actually marks the once-per-encounter flag while in Combat - see
    // WORTH_A_SHOT_ID's own comment for why outside combat has nothing to mark.
    if (skillRollOptions.applyWorthAShot) {
      skillRollOptions.isSpecialized = true;
      const targetingShift = actor.getRollData().skills.targeting?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const targetingIndex = E20.skillShiftList.indexOf(targetingShift);
      if (currentIndex >= 0 && targetingIndex >= 0) {
        const delta = currentIndex - targetingIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      if (game.combat) {
        await markUsedThisEncounter(actor, WORTH_A_SHOT_COMBAT_FLAG);
      } else {
        await markUsedThisScene(actor, WORTH_A_SHOT_SCENE_FLAG);
      }
    }

    // Ricochet - see updatedShiftDataset.ricochetAvailable's own comment above. The ↓1 penalty is
    // mandatory to gain the (unenforced) no-line-of-sight targeting and the +1 damage on a hit -
    // the damage half is folded into ricochetDamageBonus at rollSkill()'s own damageBonusValue
    // accumulator below, reading this same checkbox again.
    if (skillRollOptions.applyRicochet) {
      skillRollOptions.shiftDown += 1;
      await markUsedThisTurn(actor, RICOCHET_TURN_FLAG);
    }

    // Kind, But Firm - see KIND_BUT_FIRM_ID's own comment above. Same shift-position-delta
    // mechanism as How Strange! just above, but the substituted skill is dynamic (whichever the
    // actor chose via Empathy) rather than a fixed skill, and also free.
    if (skillRollOptions.applyKindButFirm) {
      const empathyChoice = findPerk(actor, EMPATHY_MLP_ID)?.system.choice;
      const empathyShift = empathyChoice ? actor.getRollData().skills[empathyChoice]?.shift : null;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const empathyIndex = E20.skillShiftList.indexOf(empathyShift);
      if (currentIndex >= 0 && empathyIndex >= 0) {
        const delta = currentIndex - empathyIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Restricted Wild Animal Survival Kit - see updatedShiftDataset.wildAnimalKit's own comment
    // above. Same shift-position-delta mechanism as Street Smarts just above, substituting
    // whichever of the kit's two Skills the player picked.
    const wildAnimalSkill = updatedShiftDataset.wildAnimalKit?.skills.some(s => s.value == skillRollOptions.wildAnimalKitSkill)
      ? skillRollOptions.wildAnimalKitSkill : null;
    if (wildAnimalSkill) {
      const substituteShift = actor.getRollData().skills[wildAnimalSkill]?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const substituteIndex = E20.skillShiftList.indexOf(substituteShift);
      if (currentIndex >= 0 && substituteIndex >= 0) {
        const delta = currentIndex - substituteIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Intimidating - see updatedShiftDataset.intimidatingWeaponSkill's own comment above. Same
    // shift-position-delta mechanism as Street Smarts just above, but substituting whichever
    // skill that computed field actually named rather than a fixed one.
    if (skillRollOptions.applyIntimidatingWeapon) {
      const intimidatingSkill = this._getIntimidatingWeaponSkill(actor);
      const intimidatingShift = intimidatingSkill ? actor.getRollData().skills[intimidatingSkill]?.shift : null;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const intimidatingIndex = E20.skillShiftList.indexOf(intimidatingShift);
      if (currentIndex >= 0 && intimidatingIndex >= 0) {
        const delta = currentIndex - intimidatingIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Saber-Toothed - see SABER_TOOTHED_ID's own comment above. The ↓1 cost half (the damage-type
    // override itself lives further down, alongside the other unarmed damage-type overrides,
    // since isUnarmedAttack isn't computed yet at this point in the function).
    if (skillRollOptions.applySaberToothed) {
      skillRollOptions.shiftDown += 1;
    }

    // "Pseudo"-Science - see updatedShiftDataset.pseudoScienceAvailable's own comment above. Same
    // shift-position-delta mechanism, substituting the actor's own Science skill die.
    if (skillRollOptions.applyPseudoScience) {
      const pseudoScienceShift = actor.getRollData().skills.science?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const pseudoScienceIndex = E20.skillShiftList.indexOf(pseudoScienceShift);
      if (currentIndex >= 0 && pseudoScienceIndex >= 0) {
        const delta = currentIndex - pseudoScienceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Quantum Cut - see updatedShiftDataset.quantumCutAvailable's own comment above. The actual
    // ignore-armor/force-Toughness effect is applied later, per-target, in the checkEntries
    // construction below (once the target Defense values are actually being computed) - this just
    // charges the cost now, the same "spend at declaration time" idiom every other Power-costing
    // checkbox in this function already uses.
    if (skillRollOptions.applyQuantumCut) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Solo Shot - see updatedShiftDataset.soloShotAvailable's own comment above. Forces the final
    // Edge/Snag choice directly (the dialog's own pre-selection may already have suggested Snag
    // for a long-range attack; this overrides whatever the player actually confirmed), the same
    // "checkbox wins outright" shape Eureka!'s own spendIdeaPoint uses.
    if (skillRollOptions.applySoloShot) {
      skillRollOptions.snag = false;
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Observer - see updatedShiftDataset.observerSnagSubstitutionAvailable's own comment above.
    // No cost to spend - just converts the Snag this roll already had into a flat ↓2 instead, the
    // same "checkbox forces the final Edge/Snag choice" shape Solo Shot just above uses.
    if (skillRollOptions.applyObserverSnagSubstitution) {
      skillRollOptions.snag = false;
      skillRollOptions.shiftDown += 2;
    }

    // Ranger Prime reciprocal Defense Snags - see PRIME_DEFENSE_SNAG_PERKS' own comment above.
    // Placed here, after the dialog, purely because this is the first point at which BOTH the
    // chosen Defense and the Snag flag are available. Checked before the checkbox overrides below
    // so that a player who spends Ambitious/Observer on the roll still gets to cancel this Snag,
    // exactly as they would any other.
    const primeSnagTarget = game.user?.targets?.first()?.actor;
    if (primeSnagTarget && skillRollOptions.defenseType) {
      for (const prime of PRIME_DEFENSE_SNAG_PERKS) {
        if (skillRollOptions.defenseType == prime.defenseType && actorHasPerk(primeSnagTarget, prime.id)) {
          skillRollOptions.snag = true;
          break;
        }
      }
    }

    // Ambitious - see AMBITIOUS_ID's own comment above. Zeroes the final Snag/shiftDown outright,
    // the same "checkbox wins" shape as Solo Shot/Observer just above.
    if (skillRollOptions.applyAmbitious) {
      skillRollOptions.snag = false;
      skillRollOptions.shiftDown = 0;
      await markUsedThisEncounter(actor, AMBITIOUS_ENCOUNTER_FLAG);
    }

    // Beloved, "remove Snag" half - see BELOVED_ID's own comment above. Only the Snag, not any
    // downshifts; mutually exclusive with applyBeloved (one select in the dialog).
    if (skillRollOptions.belovedRemoveSnag && !skillRollOptions.applyBeloved) {
      skillRollOptions.snag = false;
      await markUsedThisTurn(actor, 'belovedUsedThisTurn');
    }

    // Emergency Care Equipment / Vehicle Repair Equipment - see DOWNSHIFT_IMMUNITY_GEAR's own
    // comment above. Unlike Ambitious just above, this is unconditional (RAW gives no cost or
    // once-per idiom to gate it behind) and Bot-Mode-only, so it's not a checkbox at all.
    if (!actor.system.altModeId) {
      for (const gear of DOWNSHIFT_IMMUNITY_GEAR) {
        if (rolledSkill == gear.skill && dataset.specializationKey == gear.specialization
          && actor.items?.some(i => i.type == 'gear'
            && (i.flags?.core?.sourceId == gear.id || i._stats?.compendiumSource == gear.id || i?.flags?.essence20?.rulesSource == gear.id))) {
          skillRollOptions.shiftDown = 0;
        }
      }
    }

    // Isolated - see ISOLATED_ID's own comment above.
    if (skillRollOptions.applyIsolated) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisEncounter(actor, ISOLATED_ENCOUNTER_FLAG);
    }

    // Double Agent - see DOUBLE_AGENT_ID's own comment above. The Skill Test half; the Defense
    // penalty half is applied directly against difficulty where the target is resolved.
    if (skillRollOptions.applyDoubleAgent && (rolledEssence == 'smarts' || rolledEssence == 'social')) {
      skillRollOptions.shiftUp += 1;
    }

    // "I remember reading about…." - see I_REMEMBER_READING_ABOUT_ID's own comment above.
    if (skillRollOptions.applyIRememberReadingAbout) {
      skillRollOptions.isSpecialized = true;
      await markUsedThisEncounter(actor, I_REMEMBER_READING_ABOUT_ENCOUNTER_FLAG);
    }

    // Disarming Shot - see updatedShiftDataset.disarmingShotAvailable's own comment above.
    if (skillRollOptions.applyDisarmingShot) {
      skillRollOptions.shiftDown += 3;
    }

    // Attacking Space Vessel Systems - see updatedShiftDataset.targetVesselSystemAvailable above.
    const isTargetVesselSystemAttempt = !!skillRollOptions.applyTargetVesselSystem
      && !!updatedShiftDataset.targetVesselSystemAvailable;
    if (isTargetVesselSystemAttempt) {
      skillRollOptions.shiftDown += TARGET_VESSEL_SYSTEM_SHIFT_DOWN;
    }

    // Bump & Run - see BUMP_AND_RUN_ID's own comment above. The Stun-on-Critical-Success half is
    // read back from this same declared checkbox in checkContext.bumpAndRunAttempt below.
    if (skillRollOptions.applyBumpAndRun) {
      skillRollOptions.shiftUp += 1;
    }

    // Demolition Driver - see DEMOLITION_DRIVER_ID's own comment above. Unlike Terror/Supreme
    // Guardian Tech (drawing down a separate banked resource), the "spend" here IS the downshift
    // itself - applied directly to skillRollOptions.shiftDown (same "mutate the dialog's own
    // returned options before _getFinalShift reads them" idiom Bump & Run's applyBumpAndRun check already
    // uses), so it actually makes the roll harder, not just a resource cost. The matching damage
    // bonus is folded into damageBonusValue below.
    const spentDemolitionDriver = Math.min(
      skillRollOptions.spendDemolitionDriver || 0, updatedShiftDataset.demolitionDriverAvailable || 0);
    if (spentDemolitionDriver > 0) {
      skillRollOptions.shiftDown += spentDemolitionDriver;
    }

    // Programmable - see PROGRAMMABLE_ID's own comment above. A Free action, not a resource spend
    // - just the shiftUp itself, plus a flag so the d12 cap below knows to apply.
    const spentProgrammable = Math.min(
      skillRollOptions.spendProgrammable || 0, updatedShiftDataset.programmableAvailable || 0);
    if (spentProgrammable > 0) {
      skillRollOptions.shiftUp += spentProgrammable;
      skillRollOptions.programmableCapD12 = true;
    }

    // Military Formality - see MILITARY_FORMALITY_ID's own comment above. Same fixed-cap Free
    // numeric spend shape as Programmable just above, minus its d12 cap flag (RAW states no such
    // ceiling for this Perk).
    const spentMilitaryFormality = Math.min(
      skillRollOptions.spendMilitaryFormality || 0, updatedShiftDataset.militaryFormalityAvailable || 0);
    if (spentMilitaryFormality > 0) {
      skillRollOptions.shiftUp += spentMilitaryFormality;
    }

    // Size Matters - see SIZE_MATTERS_ID's own comment above. The trade-in itself reduces the
    // roll's own final shiftUp (capped there, not at updatedShiftDataset.sizeMattersAvailable's own
    // generous UI number, so a stale dialog value can never trade away more than this roll
    // actually has); the resulting damage bonus (rate depends on the target re-resolved fresh,
    // same "read again at consumption" idiom Ricochet's own damage half uses) is folded into
    // damageBonusValue below.
    const spentSizeMatters = updatedShiftDataset.sizeMattersAvailable
      ? Math.min(skillRollOptions.spendSizeMatters || 0, skillRollOptions.shiftUp || 0)
      : 0;
    if (spentSizeMatters > 0) {
      skillRollOptions.shiftUp -= spentSizeMatters;
    }

    // Caution To The Wind - see CAUTION_TO_THE_WIND_ID's own comment above. Spent now (capped at
    // what's actually available, same overspend guard as every other numeric spend here); grants
    // the shiftUp directly (unlike Size Matters, this ISN'T a trade against the roll's own
    // shiftUp) and banks the matching Defense penalty onto the actor's own next incoming attack.
    const spentCautionToTheWind = Math.min(
      skillRollOptions.spendCautionToTheWind || 0, updatedShiftDataset.cautionToTheWindAvailable || 0,
    );
    if (spentCautionToTheWind > 0) {
      skillRollOptions.shiftUp += spentCautionToTheWind;
      await bankPendingBonus(actor, CAUTION_TO_THE_WIND_FLAG, { defenseAmounts: { all: -spentCautionToTheWind } });
    }

    // Menacing Glare - see MENACING_GLARE_ID's own comment above. isMenacingGlareAttempt is
    // threaded onto checkContext below for _rollSkillHelper's own post-success prompt; only
    // meaningful once updatedShiftDataset.menacingGlareAvailable already confirmed affordability.
    const isMenacingGlareAttempt = !!skillRollOptions.applyMenacingGlare;
    if (isMenacingGlareAttempt) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Instill Weakness - see INSTILL_WEAKNESS_ID's own comment above. Unlike Menacing Glare just
    // above, RAW only spends the Energon Point "on a success" - so nothing is spent here, only
    // threaded onto checkContext for _rollSkillHelper's own post-success prompt (helpers/
    // instill-weakness.mjs#applyInstillWeakness does the actual spend once success is known).
    const isInstillWeaknessAttempt = !!skillRollOptions.applyInstillWeakness;

    // Deconstructionist - see DECONSTRUCTIONIST_ID's own comment above. Same "no cost to spend at
    // attempt time" shape as Instill Weakness just above.
    const isDeconstructionistAttempt = !!skillRollOptions.applyDeconstructionist;

    // No Factor - see NO_FACTOR_ID's own comment above. Same "no cost to spend at attempt time"
    // shape as Deconstructionist just above.
    const isNoFactorAttempt = !!skillRollOptions.applyNoFactor;

    // Combat Stance - see helpers/combat-stance.mjs's own doc comment. Spent now (only ever
    // offered when updatedShiftDataset.combatStanceAvailable already confirmed affordability); the
    // matching damage bonus is folded into damageBonusValue below.
    const combatStanceDamageBonus = skillRollOptions.applyCombatStance ? updatedShiftDataset.combatStanceAvailable : 0;
    if (combatStanceDamageBonus) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Retribution - see helpers/retribution.mjs's own doc comment. Spent and cleared now (only
    // ever offered when updatedShiftDataset.retributionAvailable already confirmed both
    // affordability and that the currently-targeted actor is the one who actually triggered it).
    // _getAutomaticCombatModifiers (where Outfoxed/Spite's own identical target-scoped Edge grants
    // live) runs once, BEFORE this dialog even resolves - skillRollOptions doesn't exist yet at
    // that point, so an Edge that depends on a checkbox has to be set here instead, the same
    // "skillRollOptions.edge = true" shape Eureka!/Eltarian Tech just above already use for their
    // own costed Edge grants. The damage half instead folds into damageBonusValue below, matching
    // Combat Stance's own identical shape just above.
    const isRetributionDamageAttempt = skillRollOptions.applyRetribution && updatedShiftDataset.retributionAvailable == 'damage';
    if (skillRollOptions.applyRetribution && updatedShiftDataset.retributionAvailable) {
      if (updatedShiftDataset.retributionAvailable == 'edge') {
        skillRollOptions.edge = true;
      }

      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
      await clearPendingBonus(actor, RETRIBUTION_PENDING_FLAG);
    }

    // Withering Fire - see WITHERING_FIRE_ID's own comment above. isWitheringFireAttempt is
    // threaded onto checkContext below for _rollSkillHelper's own post-hit Frightened application;
    // only meaningful once updatedShiftDataset.witheringFireAvailable already confirmed both the
    // target-marking and Story Point affordability.
    const isWitheringFireAttempt = !!skillRollOptions.applyWitheringFire;
    if (isWitheringFireAttempt) {
      requestStoryPointSpend(actor, 1);
    }

    // Hobble (Decepticon Directive Raider, Acquisitions Expert Focus, 20th level, p.63) - see
    // HOBBLE_ID's own comment above. The downshift 2 is the cost of declaring the attempt; the
    // Condition-on-hit half is handled later, once the roll actually resolves (see checkContext's
    // own hobbleAttempt field just below, and its consumption in _rollSkillHelper).
    if (skillRollOptions.applyHobble) {
      skillRollOptions.shiftDown += 2;
    }

    // Crippling Blow - see CRIPPLING_BLOW_ID's own comment above. The downshift 1 is the cost of
    // declaring the attempt; the Condition-on-hit half is handled later, once the roll actually
    // resolves (see checkContext's own cripplingBlowAttempt field just below, and its consumption
    // in _rollSkillHelper).
    if (skillRollOptions.applyCripplingBlow) {
      skillRollOptions.shiftDown += 1;
    }

    // Cryogenic Touch - see updatedShiftDataset.cryogenicTouchAvailable's own comment above. Spent
    // here (before the roll); the Impaired application itself happens post-hit in
    // _rollSkillHelper via checkContext.cryogenicTouchAttempt.
    if (skillRollOptions.applyCryogenicTouch) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Guardian Strikes - see GUARDIAN_STRIKES_ID's own comment above. No cost to declare; forgoes
    // this attack's own damage (folded into damageValue below) in exchange for a Condition applied
    // post-hit (see checkContext.guardianStrikesAttempt).
    const guardianStrikesForgoDamage = !!skillRollOptions.applyGuardianStrikes;

    // Stick In The Spokes - see STICK_IN_THE_SPOKES_ID's own comment above. Same "no cost to
    // declare, forgoes this attack's own damage in exchange for a status applied post-hit" shape
    // as Guardian Strikes just above.
    const stickInTheSpokesForgoDamage = !!skillRollOptions.applyStickInTheSpokes;
    if (stickInTheSpokesForgoDamage) {
      await markUsedThisEncounter(actor, STICK_IN_THE_SPOKES_ENCOUNTER_FLAG);
    }

    // Interdiction - see INTERDICTION_ID's own comment above. Same "no cost to declare, forgoes
    // this attack's own damage in exchange for a status applied post-hit" shape as Stick In The
    // Spokes just above.
    const interdictionForgoDamage = !!skillRollOptions.applyInterdiction;
    if (interdictionForgoDamage) {
      await markUsedThisEncounter(actor, INTERDICTION_ENCOUNTER_FLAG);
    }

    // Eureka! - see EUREKA_PR_ID's own comment above. Same "only ever offered when affordable"
    // reasoning as Strike Bonus - ideaPointAvailable already checked resource.value > 0. snag is
    // explicitly cleared, not just edge set - _getd20Operand() treats edge == snag as cancelling
    // out to a plain roll, and an untrained (still-d20) Smarts Skill Test already defaults to
    // Snag (see _isUntrainedSnag) - exactly the case Eureka! exists to help with, so leaving that
    // default Snag in place would silently turn this into a no-op instead of an Edge.
    if (skillRollOptions.spendIdeaPoint) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      const ideaPoints = actor._getBaseRolePoints();
      await ideaPoints.update({ 'system.resource.value': ideaPoints.system.resource.value - 1 });
    }

    // Eltarian Tech - see ELTARIAN_TECH_ID's own comment above. Same edge-grant/snag-clear/spend
    // shape as spendIdeaPoint just above.
    if (skillRollOptions.spendEltarianTech) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      const eltarianTech = actor._getBaseRolePoints();
      await eltarianTech.update({ 'system.resource.value': eltarianTech.system.resource.value - 1 });
    }

    // Enviro-Sealed's checkbox needs nothing here: the dialog moves its Snag/Normal/Edge radio with
    // the checkbox (helpers/edge-toggle-link.mjs), so skillRollOptions.edge/snag already carry it.

    // Mystical Understanding - Spellcialize - see MYSTICAL_UNDERSTANDING_ID's own comment above.
    // Grants isSpecialized directly (not an Edge/Snag change) and spends the actor's own base
    // rolePoints resource, same shape as spendIdeaPoint/spendEltarianTech above.
    if (skillRollOptions.applySpellcialize) {
      skillRollOptions.isSpecialized = true;
      const mysticalPoints = actor._getBaseRolePoints();
      await mysticalPoints.update({ 'system.resource.value': mysticalPoints.system.resource.value - 1 });
    }

    // Time Traveler's own Influence Perk - see TIME_TRAVELER_PERK_ID's own comment above. Overrides the
    // final Snag choice, scoped to whichever skill the player activated via the toggle
    // (helpers/time-traveler.mjs).
    if (rolledSkill && rolledSkill == getTimeTravelerActiveSkill(actor)) {
      skillRollOptions.snag = false;
    }

    // Always Ready - see ALWAYS_READY_ID's own comment above. Same edge-grant/snag-clear shape as
    // spendIdeaPoint/spendEltarianTech above, but free (no resource cost), gated once/scene.
    if (skillRollOptions.applyAlwaysReady) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      await markUsedThisScene(actor, 'alwaysReadyUsesThisScene');
    }

    // Angry - see ANGRY_ID's own comment above. Free (no resource cost), gated once/encounter;
    // its own Hang-Up (if the actor holds it) is triggered the moment the Perk is used.
    if (skillRollOptions.applyAngry) {
      skillRollOptions.edge = true;
      await markUsedThisEncounter(actor, 'angryUsedThisEncounter');
      await applyAngryHangUp(actor, ANGRY_HANGUP_ID);
    }

    // Dependable Tanker - see DEPENDABLE_TANKER_ID's own comment above. Same edge-grant/snag-clear
    // shape as spendIdeaPoint/spendEltarianTech above, but spending a Story Point (via the same
    // GM-relay mechanism Withering Fire's own spend just above already uses) instead of a
    // rolePoints resource.
    if (skillRollOptions.applyDependableTanker) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      requestStoryPointSpend(actor, 1);
    }

    // Hacking Algorithms - see HACKING_ALGORITHMS_ID's own comment above. Same edge-grant/
    // snag-clear/Story-Point-spend shape as Dependable Tanker just above.
    if (skillRollOptions.applyHackingAlgorithms) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      requestStoryPointSpend(actor, 1);
    }

    // Alpha Strike - grants Edge on this qualifying roll directly, and marks the round so the
    // reciprocal "attacks against you also have an Edge" half (see _getAutomaticCombatModifiers)
    // applies to incoming attacks for the rest of the round.
    if (skillRollOptions.alphaStrike) {
      skillRollOptions.edge = true;
      await markUsedThisRound(actor, ALPHA_STRIKE_ROUND_FLAG);
    }

    // Paid once regardless of "times to roll" (matching Energon's own precedent above) - the
    // player declared this before rolling at all, so it applies to every repeated roll that
    // follows from this one dialog confirmation.
    const drivingStrikeReroll = skillRollOptions.drivingStrike == 'reroll';
    const drivingStrikeIgnoreArmor = skillRollOptions.drivingStrike == 'ignoreArmor';
    if (drivingStrikeReroll || drivingStrikeIgnoreArmor) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    let label = '';
    let roleSkillDieName = '';

    switch(item?.type) {
    case 'weaponEffect':
      {
        const roleList = actor.items?.documentsByType?.role;
        const baseRole = roleList?.find(role => !role.system.isAdditive);
        roleSkillDieName = baseRole ? baseRole.system.skillDie.name : null;
      }

      label = this._getWeaponRollLabel(dataset, skillRollOptions, item, roleSkillDieName);
      break;
    case 'spell':
      label = this._getSpellRollLabel(skillRollOptions, item);
      break;
    case 'magicBauble':
      label = this._getMagicBaubleRollLabel(skillRollOptions, item);
      break;
    default:
      label = this._getSkillRollLabel(dataset, skillRollOptions);
    }

    // Advantageous Fighter (A Jump Through Time, General Perk, p.54): "When making a melee Attack
    // with Edge, you may not suffer more than a total of ↓2 in penalties." Clamped here, right
    // before the shifts are actually applied, since `skillRollOptions.edge` (the player's own
    // final dialog choice) isn't resolved until after _getAutomaticCombatModifiers' own pre-dialog
    // computation - the same timing this project already documents for several Ranger Prime
    // reciprocal-Snag bullets that need a post-dialog value and correctly can't check it earlier.
    if (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'
      && skillRollOptions.edge && actorHasPerk(actor, ADVANTAGEOUS_FIGHTER_ID)) {
      skillRollOptions.shiftDown = Math.min(skillRollOptions.shiftDown, 2);
    }

    // Prototype / Theoretical Kit - see helpers/kits.mjs#kitSources. Same "right before the shifts
    // are applied" placement as Advantageous Fighter just above: a Snag that would cancel the kit's
    // Edge is ignored (only while the Edge is still chosen), and a Theoretical Kit caps the
    // downshifts at one step.
    if (kitBoosts.ignoreSnagOnEdge && skillRollOptions.edge) {
      skillRollOptions.snag = false;
    }

    if (kitBoosts.maxShiftDown != null) {
      skillRollOptions.shiftDown = Math.min(skillRollOptions.shiftDown, kitBoosts.maxShiftDown);
    }

    let finalShift = this._getFinalShift(skillRollOptions, initialShift, E20.skillShiftList, rolePoints);

    // Programmable - see PROGRAMMABLE_ID's own comment above. "You can't increase your Skill Rank
    // above a d12, even with upshifts from other sources" - a real ceiling this codebase's
    // shiftUp resolution doesn't already provide (E20.skillShiftList has real tiers above d12 -
    // 2d8, 3d6, autoSuccess, criticalSuccess - reachable by stacking enough Edge/shiftUp), so
    // clamped explicitly here, only when this roll actually spent a Programmable upshift.
    if (skillRollOptions.programmableCapD12) {
      const d12Index = E20.skillShiftList.indexOf('d12');
      const finalShiftIndex = E20.skillShiftList.indexOf(finalShift);
      if (finalShiftIndex != -1 && finalShiftIndex < d12Index) {
        finalShift = 'd12';
      }
    }

    // Savant Skill - see SAVANT_SKILL_ID's own comment above for why this sits ahead of the
    // auto-fail check rather than after it.
    if (skillRollOptions.applySavantSkill) {
      finalShift = 'd4';
      skillRollOptions.edge = false;
      skillRollOptions.snag = false;
    }

    if (this._handleAutoFail(finalShift, label, actor)) {
      // Wrecker - an automatic failure is still a miss against every target.
      await applyWreckerOnAutoFail(actor, item, game.user?.targets);
      return;
    }

    // Auto success rules let the player choose to roll, which uses the best dice pool
    if (E20.autoSuccessShifts.includes(finalShift)) {
      finalShift = E20.skillRollableShifts[E20.skillRollableShifts.length - 1];
    }

    const canCritD2 = dataset.canCritD2 || skillRollOptions.canCritD2;
    const isSpecialized = dataset.isSpecialized || skillRollOptions.isSpecialized;

    // Omega Enhancement's own Charged-Up Mode - see helpers/omega-enhancement.mjs's own doc
    // comment. "+1 to all Skill Tests for one Essence score" - a flat modifier (RAW's own literal
    // "gain 1"), not a shiftUp/Edge, scoped to the whole chosen Essence rather than one skill.
    const chargedUpEssence = getChargedUpEssence(actor);
    const chargedUpModifier = (chargedUpEssence && rolledEssence == chargedUpEssence) ? 1 : 0;
    // Omega Enhancement's own Muscle Mode - "Gain 3 on Brawn Skill Tests..." - same flat-modifier
    // shape as Charged-Up just above, scoped to Brawn specifically.
    const muscleModeModifier = (rolledSkill == 'brawn' && isMuscleModeActive(actor)) ? 3 : 0;
    // actorSkillData.modifier/skillEffectModifierBonus are sometimes stored as strings (e.g.
    // "0") - Number()'d explicitly here so they don't string-concatenate into an unparseable
    // value like "00-1" instead of a number.
    const modifier = Number(actorSkillData.modifier || 0) + Number(skillRollOptions.skillEffectModifierBonus || 0)
      + chargedUpModifier + muscleModeModifier;

    // Super Specialized - see SUPER_SPECIALIZED_ID's own comment above. Only known once
    // isSpecialized itself is resolved (the player's own dialog choice, not something pre-filled
    // before it opens), so this bumps the already-finalized shift up one more step rather than
    // folding into shiftUp like every other essence/skill-scoped grant above.
    if (isSpecialized && findPerk(actor, SUPER_SPECIALIZED_ID)?.system.choice == rolledSkill) {
      // skillShiftList is ordered best-to-worst, so a shift UP moves to a LOWER index (matching
      // _getFinalShift's own optionsShiftTotal subtraction above), not a higher one.
      const shiftIndex = E20.skillShiftList.indexOf(finalShift);
      if (shiftIndex > 0) {
        finalShift = E20.skillShiftList[shiftIndex - 1];
      }
    }

    // Silver Tongue (Spy Focus, 6th level): "whenever you roll a Social Essence Skill Test, you
    // treat a d20 roll of 9 or less as a 10" - floors the d20 term(s) at 10 via Foundry's own
    // `min` dice modifier, applied before Edge/Snag's keep-highest/keep-lowest selection so that
    // selection sees the already-floored values.
    const floorD20At10 = rolledEssence == 'social' && actorHasPerk(actor, SILVER_TONGUE_ID);

    // Kill Shot (Sniper Focus, 20th level, p.75) - see _getd20Operand's own comment for the
    // 3d20kh mechanics. "A ranged attack with a sniper weapon" - the same weaponEffect/style/
    // parent-weapon-trait check Piercing Shot's identical sniper-trait clause already establishes,
    // gated on the actor's own already-resolved Edge (skillRollOptions.edge, not just the
    // automatic combatModifiers.edge) so it also picks up Edge from skill training/Essence shifts.
    const rollsThreeD20 = (item?.type == 'weaponEffect' && item.system.classification.style != 'melee'
      && skillRollOptions.edge && actorHasPerk(actor, KILL_SHOT_ID)
      && this._getParentWeapon(actor, item)?.system.traits.includes('sniper'))
      // Precision is Perfection (Intercontinental Adventures, Martial Artist, 17th level, p.13):
      // "when making a melee Attack with a Silent Martial Arts weapon when you have an Edge, you may
      // roll a third d20 and choose the highest among them."
      || (item?.type == 'weaponEffect' && item.system.classification.style == 'melee' && skillRollOptions.edge
        && actorHasPerk(actor, RIDER.precisionIsPerfection)
        && ['silent', 'martialArts'].every(trait => this._getParentWeapon(actor, item)?.system.traits?.includes(trait)));

    // Dependable/Old Reliable/Legendary Dependability - see DEPENDABLE_ID's/OLD_RELIABLE_ID's own
    // comments above. Edge/Snag is finally resolved by this point (skillRollOptions.edge/snag,
    // set by the dialog), so this is where the "set BOTH d20s"/Hang-Up eligibility/"15 instead of
    // 10" checks actually run - an inapplicable checkbox (no Edge/Snag after all, or the Hang-Up's
    // Edge requirement unmet) is simply ignored rather than charged, the same self-policing idiom
    // this project already uses for checkboxes whose fictional trigger can't be verified in code.
    // Dependable and Old Reliable are mutually exclusive on a single roll (the same d20 term can't
    // be flattened twice) - Dependable is checked first since it costs nothing but a scene-use.
    let flatD20Value = 0;
    let flatBothD20s = false;
    if (skillRollOptions.applyDependable && updatedShiftDataset.dependableAvailable
      && (!actorHasHangUp(actor, DEPENDABLE_HANGUP_ID) || skillRollOptions.edge)) {
      const wantsBoth = skillRollOptions.applyDependableBoth && skillRollOptions.edge != skillRollOptions.snag
        && updatedShiftDataset.dependableAvailable >= 2;
      flatD20Value = 10;
      flatBothD20s = wantsBoth;
      await markUsedThisScene(actor, 'dependableUsesThisScene', wantsBoth ? 2 : 1);
    } else if (skillRollOptions.applyOldReliable && updatedShiftDataset.oldReliableAvailable) {
      const moxie = findRolePointsItem(actor, "Moxie");
      const wantsBoth = skillRollOptions.applyOldReliableBoth && skillRollOptions.edge != skillRollOptions.snag;
      const wantsUpgrade = skillRollOptions.applyLegendaryDependability && updatedShiftDataset.legendaryDependabilityAvailable;
      const cost = 1 + (wantsBoth ? 1 : 0) + (wantsUpgrade ? 1 : 0);
      if (moxie.system.resource.value >= cost) {
        flatD20Value = wantsUpgrade ? 15 : 10;
        flatBothD20s = wantsBoth;
        await moxie.update({ 'system.resource.value': moxie.system.resource.value - cost });
        if (wantsUpgrade) {
          await markUsedThisScene(actor, 'legendaryDependabilityUsesThisScene');
        }
      }
    }

    // Pressure Cooker - see PRESSURE_COOKER_ID's own comment above. Forces the dialog's own
    // Edge/Snag radio the same "checkbox forces an already-resolved field" shape As If Specialized
    // above uses, then spends the Moxie Point.
    if (skillRollOptions.applyPressureCooker && updatedShiftDataset.pressureCookerAvailable) {
      skillRollOptions.edge = true;
      skillRollOptions.snag = false;
      const pressureCookerMoxie = findRolePointsItem(actor, "Moxie");
      await pressureCookerMoxie.update({ 'system.resource.value': pressureCookerMoxie.system.resource.value - 1 });
    }

    // Rumble in the Jungle - see RUMBLE_IN_THE_JUNGLE_ID's own comment above. Eligibility (a
    // Surprised target, a non-Silent weapon) is decided in _getAutomaticCombatModifiers; the die
    // itself is the actor's own current Intimidation shift, resolved here. An untrained
    // Intimidation (d20) contributes nothing - a d20 isn't a Skill Die.
    const rumbleIntimidationShift = actor.getRollData().skills.intimidation?.shift;
    const rumbleBonusDie = (combatModifiers.rumbleInTheJungleEligible
      && rumbleIntimidationShift && rumbleIntimidationShift != 'd20'
      ? rumbleIntimidationShift
      : null)
      // Or a bonus Skill Die an extension added from the dialog (Wild Idea -
      // helpers/extensions/qualify2/old-hand.mjs).
      ?? skillRollOptions.extBonusPoolDie ?? null;

    // An Edge decided by a Perk that only resolves after the dialog has to land before the dice are
    // picked. Hard Hitter (Finster's Monster-Matic Cookbook, Path of Venom, p.299): the damage Role
    // Points box is ticked on this attack. It used to set the Edge after _getFormula, so it never
    // reached the roll. (Exploit Trust's Edge is a RollModifier rule on its own item.)
    const hardHitterEdge = !!(damageRolePoints && skillRollOptions.applyRolePointsDamage && damageRolePoints.sourceId == HARD_HITTER_ID);
    if (hardHitterEdge) {
      skillRollOptions.edge = true;
    }

    let formula = this._getFormula(
      isSpecialized, skillRollOptions, finalShift, Number(modifier), floorD20At10, rollsThreeD20, flatD20Value, flatBothD20s,
      rumbleBonusDie,
    );

    // Inspiration (White Ranger) - see _getAutomaticCombatModifiers's own comment. Appended
    // straight onto the formula string (a whole extra rolled die), not folded into shiftUp/edge
    // like every other combatModifiers field, since it isn't a skill-die-selection change.
    if (combatModifiers.bonusDie) {
      formula += ` + ${combatModifiers.bonusDie}`;
    }

    // Fanning - see helpers/fanning.mjs's own doc comment. One entry per shot of the volley: shot 1
    // is the formula just built; each later shot re-resolves the shift with its own larger ↓ (and
    // without Storm of Lead's first-shot ↑1), then gets the same post-shift adjustments shot 1 got.
    // An autoFail shot can't be rolled at all, which ends the volley there.
    const fanningVolley = [];
    if (fanningShots > 1) {
      fanningVolley.push({ formula, shift: finalShift, autoFail: false });
      const isSuperSpecialized = isSpecialized && findPerk(actor, SUPER_SPECIALIZED_ID)?.system.choice == rolledSkill;
      for (let shotNumber = 2; shotNumber <= fanningShots; shotNumber++) {
        const shot = getFanningShotShifts(shotNumber, fanningHasStormOfLead);
        const shotShift = this._getFinalShift({
          ...skillRollOptions,
          shiftUp: skillRollOptions.shiftUp - firstFanningShot.shiftUp + shot.shiftUp,
          shiftDown: skillRollOptions.shiftDown - firstFanningShot.shiftDown + shot.shiftDown,
        }, initialShift, E20.skillShiftList, rolePoints);
        const adjusted = adjustFanningShotShift(shotShift, {
          programmableCapD12: !!skillRollOptions.programmableCapD12,
          savant: !!skillRollOptions.applySavantSkill,
          superSpecialized: isSuperSpecialized,
        });
        fanningVolley.push({
          shift: adjusted.shift,
          autoFail: adjusted.autoFail,
          formula: adjusted.autoFail ? null : this._getFormula(
            isSpecialized, skillRollOptions, adjusted.shift, Number(modifier), floorD20At10, rollsThreeD20, flatD20Value,
            flatBothD20s, rumbleBonusDie,
          ) + (combatModifiers.bonusDie ? ` + ${combatModifiers.bonusDie}` : ''),
        });
      }
    }

    // If a Defense was chosen (either from the weaponEffect's own configured Defense, or picked
    // manually in the dialog) and there's at least one targeted token, the roll is compared
    // against each target's Defense (p.168-169). Alternatively, a @Check[dif=...] enricher link
    // (helpers/enrichers.mjs) sets a flat Difficulty with no target at all - dataset.dif is only
    // ever present on the roller's own dataset when that roller is the GM, per that enricher's
    // GM-only-visibility design. Either way this produces one or more "entries" to compare the
    // roll total against; with neither, this falls back to a plain roll message below.
    // Penetrating Rounds (Door-Kicker Focus, 20th level, p.100): "your attacks with shotguns and
    // submachine guns... ignore... deflective bonuses to defense from armor" - the second of its
    // two clauses (the first, ignoring cover, is the item's own Cover rule). Only ever subtracted against
    // a Toughness comparison - "deflective" is specifically an armor trait, and armor only ever
    // contributes to Toughness, never Evasion.
    const isPenetratingRoundsAttack = this._isPenetratingRoundsAttack(actor, item);

    // Trigger Happy (Fighting Style option, p.79/108) - see _isTriggerHappyAttack's own doc
    // comment. Threaded onto each entry as a second, independent Willpower difficulty compared
    // against the exact same roll total as the Toughness/Evasion difficulty below - not a
    // sequential/dependent check, per the Perk's own "in addition to" phrasing.
    const isTriggerHappyAttack = this._isTriggerHappyAttack(actor, item);

    // Explosive Aftershock (Focus: Artillery, 15th level, p.81): "after comparing your attack
    // test to the Defense (usually Evasion) of your targets, compare your test total to their
    // Toughness Defense for the shockwave of force following the explosion." Same "independent
    // second Defense compare against the same roll total" shape Trigger Happy's own Willpower
    // compare just above already establishes - threaded onto each entry as toughnessDifficulty
    // below. See helpers/explosive-aftershock.mjs's own doc comment for the 2-of-N effect picker
    // and per-target application, which lives in _rollSkillHelper once it's known who actually
    // failed their Toughness compare.
    const isExplosiveAftershockAttack = item?.type == 'weaponEffect'
      && item.system.classification?.style == 'explosive' && actorHasPerk(actor, EXPLOSIVE_AFTERSHOCK_ID);

    // Brute Force Works Best - see helpers/brute-force-works-best.mjs's own doc comment. "A piece
    // of equipment"/"blade or bludgeon" - same proxies as Ripple Effect/Weak Point above; actually
    // marking the target happens once it's known the attack landed, in _rollSkillHelper below.
    const isBruteForceWorksBestAttack = item?.type == 'weaponEffect'
      && ['blunt', 'sharp'].includes(item.system.damageType) && actorHasPerk(actor, BRUTE_FORCE_WORKS_BEST_ID);

    // Unseen Strike - see UNSEEN_STRIKE_ID's own comment above. Marked used the moment a
    // qualifying attack is actually rolled, regardless of whether it hits.
    const isUnseenStrikeAttempt = item?.type == 'weaponEffect' && isPhantomSuiteActive(actor)
      && actorHasPerk(actor, UNSEEN_STRIKE_ID) && !hasUsedThisTurn(actor, UNSEEN_STRIKE_TURN_FLAG);
    if (isUnseenStrikeAttempt) {
      await markUsedThisTurn(actor, UNSEEN_STRIKE_TURN_FLAG);
    }

    const targets = Array.from(game.user.targets);
    let checkEntries = null;
    if (skillRollOptions.defenseType && skillRollOptions.defenseType != 'none' && targets.length) {
      checkEntries = await Promise.all(targets.map(async token => {
        // Which Defense this specific target actually uses against this specific attack (Welcome
        // to Night Vale Host Guide's shared Combat Actions chapter, p.33-34, matching every core
        // rulebook's own identical text): "in most cases, the defender chooses the Defense based
        // on how they react to the attack." See helpers/defense-choice.mjs's own doc comment for
        // the full RAW quote and why this used to be backwards (the ATTACKER's own Roll Options
        // Dialog dropdown could freely override the weapon's suggested Defense, when only the
        // defender's own player - or the GM standing in for an unowned NPC - actually has that
        // say). skillRollOptions.defenseType (the weapon's own configured Defense) is passed
        // through only as the suggested default; every other use of "the Defense this attack
        // targets" below this point reads resolvedDefenseType instead, since each target in a
        // multi-target attack can genuinely choose a different one.
        const defenseChoice = await chooseDefenderDefense(token.actor, {
          attackerName: actor.name,
          suggestedDefenseType: skillRollOptions.defenseType,
        });
        const { storyPointBoost } = defenseChoice;
        let resolvedDefenseType = defenseChoice.defenseType;

        // Ballistic at long range, and the Grapple trait ("always target Evasion") - weapon-traits.mjs.
        // Before Fly In The Future and Scramble below, which a Perk-dictated Defense beats.
        const traitWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
        if (isBallisticLongRange(actor, item, traitWeapon, token)) {
          resolvedDefenseType = 'toughness';
        }

        if (traitWeapon?.system?.traits?.includes('grapple')) {
          resolvedDefenseType = 'evasion';
        }

        // Fly In The Future - see helpers/evasive-maneuvers.mjs's own doc comment. RAW forces
        // Evasion "instead of Toughness" specifically, so it overrides the defender's own choice
        // only when that choice was Toughness - any other Defense they pick stands.
        // Anti-Air Combat Training (Quartermaster's Guide p.28): "When targeting an air vehicle that has
        // Evasive Maneuvers, you can ignore this power."
        if (resolvedDefenseType == 'toughness' && isEvasiveManeuversActive(token.actor) && !actorHasTrait(actor, ANTI_AIR_COMBAT_TRAINING)) {
          resolvedDefenseType = 'evasion';
        }

        // Scramble - see helpers/scramble.mjs's own doc comment. Unconditional, unlike Fly In The
        // Future above - "even if the attack normally dictates the Defense it targets" overrides
        // ANY resolved choice, not just a Toughness default.
        if (isScrambleActive(token.actor)) {
          resolvedDefenseType = 'evasion';
        }

        // Fast Draw - see FAST_DRAW_ID's own comment above. The opposite direction from Fly In The
        // Future: forces Toughness when the defender's resolved choice was Evasion, self-declared
        // via skillRollOptions.applyFastDraw (the ATTACKER's own Roll Options Dialog checkbox, not
        // a defender-side status like Scramble/Fly In The Future above).
        if (resolvedDefenseType == 'evasion' && skillRollOptions.applyFastDraw) {
          resolvedDefenseType = 'toughness';
        }

        // Superstructure (Across the Stars p.87): "All Attacks target its Toughness Defense, regardless of
        // source."
        if (token.actor?.system?.traits?.superstructure) {
          resolvedDefenseType = 'toughness';
        }

        // Armor Piercing (the weapon trait): "Attacks ignore deflective bonuses to Toughness" - the same
        // reduction Penetrating Rounds already makes. Ram Cone grants it to Alt Mode rams.
        // Weak Point (see WEAK_POINT_ID's own comment) gives every melee attack both Armor Piercing and
        // Anti-Tank.
        const weakPointMelee = item?.type == 'weaponEffect' && item.system?.classification?.style == 'melee'
          && actorHasPerk(actor, WEAK_POINT_ID);
        const traitArmorPiercing = !!traitWeapon?.system?.traits?.includes('armorPiercing') || ramConeAltAttack(actor, item)
          || weakPointMelee;
        const deflectiveReduction = (isPenetratingRoundsAttack || traitArmorPiercing) && resolvedDefenseType == 'toughness'
          ? this._getDeflectiveArmorToughness(token.actor)
          : 0;
        // Void (Across the Stars p.79): "always ignores any armor bonuses to Toughness".
        const voidIgnoresArmor = resolvedDefenseType == 'toughness'
          && (item?.system?.damageType == 'void' || !!traitWeapon?.system?.traits?.includes('void'))
          && !hasVoidshield(token.actor);
        // Computerized battledress: "Electromagnetic weapons ignore this battledress' bonus to Evasion."
        const computerizedArmorReduction = resolvedDefenseType == 'evasion'
          && (item?.system?.damageType == 'emp' || !!traitWeapon?.system?.traits?.includes('electromagnetic'))
          ? computerizedArmorEvasion(token.actor) : 0;

        // Anti-Tank (Weapon Effects and Traits, p.106) - a CORE WEAPON TRAIT, not a Perk: "attacks
        // ignore plating bonuses to Toughness." The exact sibling of Armor Piercing ("ignore
        // DEFLECTIVE bonuses"), which has been implemented for some time - this one never was,
        // despite 39 weapons in the packs carrying it.
        //
        // Found 2026-09-15 by auditing every weapon trait the schema allows against whether any
        // code reads it: 34 of 66 are never referenced at all. Most of those are genuinely blocked
        // (Reload is action economy, Mounted has no printed effect to model), but Anti-Tank had a
        // working sibling sitting next to it, which is what made it worth doing now.
        //
        // Read off the PARENT WEAPON rather than the weaponEffect: this is a weapon trait, and
        // Armor Piercing is only different because it has its own dedicated schema field.
        const antiTankReduction = resolvedDefenseType == 'toughness'
          && (this._getParentWeapon(actor, item)?.system?.traits?.includes('antiTank') || ramConeAltAttack(actor, item)
            || weakPointMelee)
          ? this._getPlatingArmorToughness(token.actor)
          : 0;

        // Titan-Class (The Enigma of Combination, Weapon Traits, p.49): "This weapon ignores all
        // bonuses to Toughness Defense from armor upgrades when used to attack anything of a
        // smaller Size Class than the wielder." A third sibling of Anti-Tank/Armor Piercing just
        // above - "armor upgrades" specifically (not an armor's own base bonusToughness) is a
        // narrower carve-out than either, so it reads _getArmorUpgradeToughness rather than one
        // trait-filtered helper. Only this Toughness-ignore half is modelled: the Energon Point
        // the wielder must spend "before any attacks are made" is a mandatory COST to attack at
        // all, not an optional bonus, and every existing Energon-gated effect in this codebase is
        // the latter (an opt-in Roll Options Dialog checkbox) - there's no established pattern
        // here for blocking an attack outright over an unspent resource, so it isn't enforced.
        const sizeOrder = Object.keys(E20.actorSizes);
        const attackerSizeIndex = sizeOrder.indexOf(actor.system.size);
        const targetSizeIndex = sizeOrder.indexOf(token.actor.system.size);
        const titanClassReduction = resolvedDefenseType == 'toughness'
          && attackerSizeIndex != -1 && targetSizeIndex != -1 && targetSizeIndex < attackerSizeIndex
          && this._getParentWeapon(actor, item)?.system?.traits?.includes('titanClass')
          ? this._getArmorUpgradeToughness(token.actor)
          : 0;

        // Defend (Across the Stars, Weapon Traits, p.79): "Such weapons are highly effective at
        // blocking melee strikes, and wielders add the listed bonus to the user's Evasion and
        // Toughness Defenses against melee attacks." A bonus to the DEFENDER's own Defenses while
        // they wield the weapon, not the attacker's - the sign is the opposite of every reduction
        // above, so it's added to difficulty rather than subtracted from it. defendMagnitude and
        // its optional defendRangedMagnitude sibling (weapon.mjs) hold the "(listed bonus)" - most
        // Defend weapons only print (1), but at least one (Zeo Power Disc/Shield) prints a split
        // "(2; 1 vs. Ranged Attacks)" value.
        const isMeleeAttack = item?.type == 'weaponEffect' && item.system.classification.style == 'melee';
        const defendBonus = ['evasion', 'toughness'].includes(resolvedDefenseType)
          ? this._getDefendBonus(token.actor, isMeleeAttack)
          : 0;

        // Penetrating Aim (Raider, Siegemaster Focus, 1st level, p.63) - see PENETRATING_AIM_ID's
        // own comment above. Only meaningful against Toughness - RAW's own "armor Defense bonus"
        // is this system's Toughness-specific armor component (the same Defense Driving Strike's
        // deflective-armor reduction just above is scoped to, for the identical reason).
        const penetratingAimIgnorePoints = skillRollOptions.applyPenetratingAim
          && resolvedDefenseType == 'toughness' && actorHasPerk(actor, PENETRATING_AIM_ID)
          ? 1 : 0;

        // Metallikato - see METALLIKATO_ID's own comment above. "Up to your Smarts Essence in
        // armor bonuses" - the cap is the actor's own Smarts Essence SCORE (system.essences.smarts),
        // not a shift or a flat point count, same Toughness-only scoping Penetrating Aim's
        // identical "armor Defense bonus" wording already established just above.
        const metallikatoIgnorePoints = skillRollOptions.applyMetallikatoIgnoreArmor
          && resolvedDefenseType == 'toughness' && actorHasPerk(actor, METALLIKATO_ID)
          ? (actor.system.essences?.smarts?.value ?? 0) : 0;

        // Screwball (Cobra Codex, Weapon Upgrade, p.97) / Arched (Cobra Codex, Weapon Upgrade,
        // p.96) - both grant the Bypassing trait: "Attacks ignore shield bonuses to Defenses."
        // Same "read off the parent weapon's own traits array" idiom as Accurate/Inaccurate.
        const hasBypassingWeapon = item?.type == 'weaponEffect'
          && !!this._getParentWeapon(actor, item)?.system.traits?.includes('bypassing');

        // Careful (Fighting Style option, GI Joe CRB p.79): "When taking cover, you gain a +2
        // bonus to your Toughness and Evasion." Checked against the TARGET's own 'cover' status -
        // the same status the defender-side Snag just above already reads - added directly onto
        // their Defense value.
        const carefulFightingStyleBonus = (resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion')
          && token.actor.statuses?.has('cover') && this._hasFightingStyle(token.actor, 'careful')
          ? 2 : 0;

        // Defense (Fighting Style option, GI Joe CRB p.79): "While you are wearing armor, you gain
        // a +1 bonus to your Toughness and Evasion." Same "unattached armor-type Item, equipped"
        // check Static Slide Inhibitor/Life Supporting already use for "is this actor wearing
        // armor at all."
        const isWearingArmor = !!token.actor.items?.find(actorItem => actorItem.type == 'armor' && actorItem.system.equipped);
        const defenseFightingStyleBonus = (resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion')
          && isWearingArmor && this._hasFightingStyle(token.actor, 'defense')
          ? 1 : 0;

        let difficulty = getDefenseValue(token.actor, resolvedDefenseType, {
          ignoreArmor: drivingStrikeIgnoreArmor || voidIgnoresArmor,
          ignoreArmorPoints: penetratingAimIgnorePoints + metallikatoIgnorePoints,
          ignoreShield: hasBypassingWeapon,
        })
          + getShieldUpgradeBonus(token.actor, resolvedDefenseType)
          - deflectiveReduction
          - computerizedArmorReduction
          - antiTankReduction
          - titanClassReduction
          + defendBonus
          + carefulFightingStyleBonus
          + defenseFightingStyleBonus;

        // "Add +5 to a Defense before dice are rolled" (GI Joe CRB p.127) - the defender's own
        // Story Point, spent in the Defense prompt just above; or, in My Little Pony, bought
        // earlier this scene and still standing (helpers/defense-choice.mjs#hasSceneDefenseBoost).
        // One bonus either way: a boost bought this attack is also the one the scene flag holds.
        if (storyPointBoost || hasSceneDefenseBoost(token.actor, resolvedDefenseType)) {
          difficulty += DEFENSE_BOOST;
        }

        // Ground Suppression - see helpers/ground-suppression.mjs's own doc comment. The first
        // target-difficulty modifier in this project to SUBTRACT rather than add - benefits ANY
        // attacker comparing against the marked target's Toughness/Evasion, not just the caster.
        if (['toughness', 'evasion'].includes(resolvedDefenseType)) {
          difficulty -= getGroundSuppressionReduction(token.actor);
        }

        // Shatter Resolve - see SHATTER_RESOLVE_ID's own comment above. Scoped to the ATTACKER's
        // own Perk (unlike Ground Suppression just above, which benefits anyone), same "gated on
        // the attacker" shape as Penetrating Aim/Metallikato earlier in this construction.
        if (
          ['willpower', 'cleverness'].includes(resolvedDefenseType)
          && ['deception', 'persuasion'].includes(rolledSkill)
          && actorHasPerk(actor, SHATTER_RESOLVE_ID)
        ) {
          difficulty -= 2;
        }

        // Double Agent - see DOUBLE_AGENT_ID's own comment above. Self-declared, same checkbox
        // offered for both halves - only the attack half touches difficulty; the Skill Test half
        // is applied directly to skillRollOptions.shiftUp further down.
        if (skillRollOptions.applyDoubleAgent) {
          difficulty -= 1;
        }

        // Psychological Warfare - see PSYCHOLOGICAL_WARFARE_ID's own comment above.
        if (
          ['willpower', 'cleverness'].includes(resolvedDefenseType)
          && actorHasPerk(token.actor, PSYCHOLOGICAL_WARFARE_ID)
        ) {
          const evasionDifficulty = getDefenseValue(token.actor, 'evasion', {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, 'evasion');
          difficulty = Math.max(difficulty, evasionDifficulty);
        }

        // Scapegoat - see SCAPEGOAT_ID's own comment above. Swaps between Willpower and Cleverness
        // rather than substituting Evasion in from outside, but otherwise the same shape as
        // Psychological Warfare just above.
        let scapegoatSwapped = false;
        if (
          ['willpower', 'cleverness'].includes(resolvedDefenseType)
          && actorHasPerk(token.actor, SCAPEGOAT_ID)
          && getUses(token.actor, 'scapegoatSwap', 'scene') < 1
        ) {
          const swappedDefense = resolvedDefenseType == 'willpower' ? 'cleverness' : 'willpower';
          const swappedDifficulty = getDefenseValue(token.actor, swappedDefense, {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, swappedDefense);
          if (swappedDifficulty > difficulty) {
            difficulty = swappedDifficulty;
            scapegoatSwapped = true;
            if (typeof token.actor.setFlag == 'function') {
              await markUsed(token.actor, 'scapegoatSwap', { window: 'scene' });
            }
          }
        }

        // Evasive (Red Ninja Faction Perk, p.10) - see its own EVASIVE_IAF2_ID comment above. Same
        // "substitute Evasion whenever it's better" idiom as Psychological Warfare, but against ANY
        // Attack's own Defense (RAW's own "always," not scoped to Willpower/Cleverness only).
        if (actorHasPerk(token.actor, EVASIVE_IAF2_ID)) {
          const evasiveEvasionDifficulty = getDefenseValue(token.actor, 'evasion', {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, 'evasion');
          difficulty = Math.max(difficulty, evasiveEvasionDifficulty);
        }

        // Bulked Up Frame / Tactical Gymnastics' own Ranks-scaled Defense bonus - see their own
        // BULKED_UP_FRAME_ID/TACTICAL_GYMNASTICS_ID comments above. Computed once up front so
        // Tactical Gymnastics' own Ballistic-trait Evasion substitution just below (which may
        // swap Evasion in even when it wasn't the originally-requested Defense) still reflects it.
        const targetHasArmorEquipped = (token.actor.items?.documentsByType?.armor ?? []).some(a => a.system.equipped);
        const tacticalGymnasticsBonus = !targetHasArmorEquipped && actorHasPerk(token.actor, TACTICAL_GYMNASTICS_ID)
          ? getSkillRanks(token.actor, 'acrobatics') : 0;

        if (resolvedDefenseType == 'toughness' && !targetHasArmorEquipped
          && actorHasPerk(token.actor, BULKED_UP_FRAME_ID)) {
          difficulty += getSkillRanks(token.actor, 'brawn');
        }

        if (resolvedDefenseType == 'evasion') {
          difficulty += tacticalGymnasticsBonus;
        }

        // Tactical Gymnastics - see TACTICAL_GYMNASTICS_ID's own comment above. Same "substitute
        // Evasion in whenever it's better" idiom as Psychological Warfare just above.
        if (
          this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('ballistic')
          && actorHasPerk(token.actor, TACTICAL_GYMNASTICS_ID)
        ) {
          const evasionDifficulty = getDefenseValue(token.actor, 'evasion', {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, 'evasion') + tacticalGymnasticsBonus;
          difficulty = Math.max(difficulty, evasionDifficulty);
        }

        // Split-Second Reaction - see SPLIT_SECOND_REACTION_ID's own comment above. Same
        // "substitute Evasion in whenever it's better" idiom as Tactical Gymnastics just above,
        // with no Ranks-scaled bonus added on top.
        if (
          this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('ballistic')
          && actorHasPerk(token.actor, SPLIT_SECOND_REACTION_ID)
        ) {
          const splitSecondReactionEvasionDifficulty = getDefenseValue(token.actor, 'evasion', {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, 'evasion');
          difficulty = Math.max(difficulty, splitSecondReactionEvasionDifficulty);
        }

        // Just the Facts (Analyst, 16th level, p.62) - the Immune half (see
        // _getAutomaticCombatModifiers's own doc comment for why it's split from its Resistant/
        // Snag half): a guaranteed failure, modeled as an unreachable difficulty rather than a
        // new success/failure code path, since computeMultiplier(total, difficulty) already
        // treats any finite roll against Infinity as multiplier 0 - the same "one combined
        // number" precision Roll With the Punches just below already relies on.
        if (rolledSkill == 'deception' && actorHasPerk(token.actor, JUST_THE_FACTS_ID)
          && getEffectiveLevel(actor) <= getEffectiveLevel(token.actor)) {
          difficulty = Infinity;
        }

        // Move Like a Song (Green Ranger, Survival Boon choice, p.44) - the "automatically
        // misses" half; the Snag half is computed in _getAutomaticCombatModifiers like any other
        // d20 modifier. combatModifiers.forcedMiss is already resolved for the roll's one primary
        // target (game.user.targets.first(), same as First Strike/Just the Facts above), so this
        // applies to whichever single target this loop is currently building - correct for Move
        // Like a Song's own single-target "attack that targets you" wording.
        if (combatModifiers.forcedMiss) {
          difficulty = Infinity;
        }

        // Drilling Shot (Sharpshooter Focus, 20th level, p.71): "attacks with your Long Range
        // Rifle ignore all bonuses to Defenses other than the basic calculation." Recomputes the
        // whole difficulty from scratch as just the target's own base Defense (still per-actor-
        // type-correct via getDefenseValue's own .total/.value branching, with ignoreArmor:true to
        // also strip a PC/Companion's own armor component) - skipping the Shield Upgrade add and
        // deflective-armor subtraction entirely, same "one combined number" precision this method
        // already treats every other Defense modifier at.
        const drillingShotWeapon = this._getParentWeapon(actor, item);
        const drillingShotWeaponSourceId = drillingShotWeapon?.flags?.core?.sourceId
          ?? drillingShotWeapon?._stats?.compendiumSource ?? drillingShotWeapon?.flags?.essence20?.rulesSource;
        if (drillingShotWeaponSourceId == LONG_RANGE_RIFLE_ID && actorHasPerk(actor, DRILLING_SHOT_ID)) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Quantum Cut (A Jump Through Time, Quantum Ranger, Quantum Power option, p.46) - see
        // updatedShiftDataset.quantumCutAvailable's own comment above. Forces Toughness
        // specifically (RAW: "force your enemy to use their Toughness Defense against this
        // Attack"), regardless of whatever Defense the dialog's own dropdown was actually set to -
        // the same full-override shape Drilling Shot's identical ignoreArmor recompute just above
        // already uses.
        if (skillRollOptions.applyQuantumCut) {
          difficulty = getDefenseValue(token.actor, 'toughness', { ignoreArmor: true });
        }

        // Armor Piercing (Weapon Effects and Traits, p.106) - "Attacks with this weapon ignore
        // deflective bonuses to Toughness from armor." A live property of the weaponEffect
        // ITSELF (item.system.hasArmorPiercing - see that field's own doc comment in
        // data/item/weapon-effect.mjs), unconditional on any Perk, same ignoreArmor recompute
        // shape as Drilling Shot/Quantum Cut just above but scoped to whatever Defense this
        // attack is actually being compared against (RAW doesn't force Toughness specifically the
        // way Quantum Cut does - it just ignores the armor component if the attack happens to be
        // Toughness-compared).
        //
        // Bring It All Down's own "the device gains the Armor-Piercing trait" option (see
        // BRING_IT_ALL_DOWN_ID's own comment above) grants the exact same effect for this one
        // attack, so it ORs straight into the same recompute rather than needing a second branch.
        if (
          resolvedDefenseType == 'toughness' && item?.type == 'weaponEffect'
          && (item.system.hasArmorPiercing || dataset.bringItAllDownEffect == 'armorPiercing')
        ) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Charge It Up! - see appliesChargeItUp's own comment above. Only the armor half of RAW's
        // "ignore all benefits from armor and any Resistances, immunities, or other damage
        // mitigation effects" is enforceable here - this codebase has no live Resistance-halving
        // hook for applyDamage to bypass (see helpers/charge-it-up.mjs's own doc comment).
        if (appliesChargeItUp) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Omega Enhancement's own Electro Mode - see helpers/omega-enhancement.mjs's own doc
        // comment. "A Targeting Attack that ignores armor" - keeps whatever Defense the dialog's
        // dropdown was set to (Evasion, per activateOmegaEnhancement's own synthetic dataset),
        // unlike Quantum Cut/Drilling Shot above which also force a specific Defense.
        if (dataset.omegaEnhancementMode == 'electro') {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Over the Candlestick - Agile Reflexes (Technorganic Secrets, Climber/Nimble Origin
        // Benefit, p.38) - see OVER_THE_CANDLESTICK_ID's own comment above. "Once per Scene, when
        // an attack targets your Toughness, you may use Evasion instead." No live reaction prompt
        // exists for the TARGET at this point in the flow (the same reaction/interrupt gap this
        // project already tracks broadly), so "you may" is approximated as "you always do, since
        // it can only help" - the same "automatically exercised" idiom Supreme Guardian's own
        // "you may roll" clause already uses - swapping in the target's own Evasion Defense
        // whenever it's actually being compared against Toughness, once per scene.
        if (resolvedDefenseType == 'toughness'
          && findPerk(token.actor, OVER_THE_CANDLESTICK_ID)?.system.choice == 'agileReflexes'
          && !hasUsedThisEncounter(token.actor, AGILE_REFLEXES_FLAG)) {
          difficulty = getDefenseValue(token.actor, 'evasion', { ignoreArmor: drivingStrikeIgnoreArmor })
            + getShieldUpgradeBonus(token.actor, 'evasion');
          await markUsedThisEncounter(token.actor, AGILE_REFLEXES_FLAG);
        }

        // Penetrating Strikes (PR CRB, Grid Power, p.100) - see helpers/penetrating-strikes.mjs's
        // own doc comment. While active: Martial Arts attacks ignore armor bonuses to Toughness -
        // same ignoreArmor recompute shape as Drilling Shot/Quantum Cut just above, gated on the
        // parent weapon's own `martialArts` trait (the same check Black Ranger Prime's identical
        // clause already uses) rather than a specific named weapon.
        const penetratingStrikesWeapon = this._getParentWeapon(actor, item);
        if (isPenetratingStrikesActive(actor) && penetratingStrikesWeapon?.system.traits.includes('martialArts')) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Exploit Weakness (PR CRB, Yellow Ranger, 7th level, p.57) - see
        // helpers/exploit-weakness.mjs's own doc comment. "You and your teammates may ignore one
        // of the target's defense bonuses" while marked - team-wide (any roller, not just whoever
        // marked it), same ignoreArmor recompute shape as Drilling Shot/Quantum Cut/Penetrating
        // Strikes above.
        if (isExploitWeaknessMarked(token.actor)) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true });
        }

        // Stronger Together (Strategist Focus, 20th level, p.68): "you gain +1 to your Defenses
        // for every ally within 60ft." The target's own passive bonus, added the same way Shield
        // Upgrade's own per-target Defense bonus already is. The Free-action "reduce this bonus by
        // 1 to grant an ally +1 to all of their Defenses" half is a Use rule on the Perk: both its
        // banked +1 (the ally's) and -1 (the granter's) are rules/bank.mjs#bankedDefense entries.
        if (actorHasPerk(token.actor, STRONGER_TOGETHER_ID)) {
          difficulty += getNearbyAllyTokens(token.actor, 60).length;
        }

        // Emotional Mastery: Fear/Sadness (A Jump Through Time, Purple Ranger, p.37) - see
        // helpers/emotional-mastery.mjs's own doc comment. "Fear: your Willpower and Cleverness
        // Defenses increase by 3" / "Sadness: your Morphin shell Armor bonus increases by 2
        // Toughness and 2 Evasion" - both the target's own passive bonus while active, same
        // "add to the fully-computed difficulty" shape Stronger Together just above uses (can't
        // touch _prepareDefenses directly, the user's own pending migration).
        if ((resolvedDefenseType == 'willpower' || resolvedDefenseType == 'cleverness')
          && isEmotionalMasteryOptionActive(token.actor, 'fear')) {
          difficulty += 3;
        }

        if ((resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion')
          && isEmotionalMasteryOptionActive(token.actor, 'sadness')) {
          difficulty += 2;
        }

        // Pay It Forward - see PAY_IT_FORWARD_ID's own comment above. Checked from the TARGET's
        // own side (is there a nearby Morphed Pay It Forward holder near them) since the bonus
        // travels with the holder rather than being a fixed per-holder count.
        if (getNearbyAllyTokens(token.actor, 10).some(
          t => t.actor && actorHasPerk(t.actor, PAY_IT_FORWARD_ID) && t.actor.system?.isMorphed,
        )) {
          difficulty += 1;
        }

        // Defensive Flexibility - see helpers/defensive-flexibility.mjs's own doc comment. Same
        // "add to the fully-computed difficulty" shape as Stronger Together/Pay It Forward above.
        difficulty += getDefensiveFlexibilityDefenseBonus(token.actor, resolvedDefenseType);

        // Mysterious Aura - see helpers/mysterious-aura.mjs's own doc comment. Imposing (a
        // reciprocal enemy-side penalty) and Protective (an ally-side bonus, self included), same
        // "add to the fully-computed difficulty" shape as the checks just above.
        difficulty += getMysteriousAuraImposingPenalty(token.actor, resolvedDefenseType);
        difficulty += getMysteriousAuraProtectiveBonus(token.actor, resolvedDefenseType);

        // Impenetrable Armor (Focus: Mechanized Infantry, 10th level, p.79): "increase the
        // Defenses of all vehicles you pilot by +2." The target's own passive bonus, same
        // "add to the fully-computed difficulty" shape Stronger Together's identical per-ally
        // bonus just above already uses (can't touch _prepareDefenses directly - the user's own
        // pending Health/Defense-math migration). "While piloting a vehicle, you may redirect
        // attacks targeting you to your vehicle" isn't built - this system has no established way
        // to retarget an already-resolved roll from one actor to another mid-flight.
        if (token.actor.type == 'vehicle') {
          const driver = this._getVehicleDriver(token.actor);
          if (driver && actorHasPerk(driver, IMPENETRABLE_ARMOR_ID)) {
            difficulty += 2;
          }
        }

        // Environmental Armor (Focus: Predator, 10th level, p.94): "in your environment of
        // expertise, you gain a +1 bonus to all of your Defenses." The target's own passive
        // bonus, same "add to the fully-computed difficulty" shape Stronger Together/Impenetrable
        // Armor just above already use, now that hasActiveEnvironmentalExpertise(actor) exists as
        // real infrastructure (see helpers/environmental-expertise.mjs's own doc comment) instead
        // of the disabled compendium Active Effect this Perk previously shipped with - a static AE
        // can't be conditioned on the scene's terrain / the toggle, so it stays disabled and this
        // live check (terrain-driven when the GM has set one) is the real mechanism. "Whenever you spend an Adaptation Point to gain an environmental benefit
        // outside of your environment of expertise, you gain this bonus until the beginning of
        // your next turn" isn't built - a narrower edge-case clause layered on top of Guidance's
        // own Adaptation Point spend, not the base case this pass covers.
        if (actorHasPerk(token.actor, ENVIRONMENTAL_ARMOR_ID) && hasActiveEnvironmentalExpertise(token.actor)) {
          difficulty += 1;
        }

        // Without a Word - see WITHOUT_A_WORD_ID's own comment above. "In Combat" maps onto
        // game.combat existing, the same idiom this project already uses for "combat" elsewhere.
        if (!!game.combat && actorHasPerk(token.actor, WITHOUT_A_WORD_ID)
          && getNearbyEnemyTokens(token.actor, Infinity).some(enemyToken =>
            ['frightened', 'mesmerized', 'surprised'].some(status => enemyToken.actor?.statuses?.has(status)))) {
          difficulty += 1;
        }

        // Heroic Intervention - see HEROIC_INTERVENTION_ID's own doc comment above.
        if (actorHasPerk(token.actor, HEROIC_INTERVENTION_ID) && getNearbyAllyTokens(token.actor, 5).length > 0) {
          difficulty += 1;
        }

        // Trustworthy (Honesty, 2nd level, p.78) - the roller's own half: their Deception always fails,
        // the same difficulty-vs-Infinity idiom Just the Facts uses. The target's +4 Cleverness against
        // Deception is a Defense rule on the item (rules/adapter.mjs#ruleDefenseAdjust, below).
        if (rolledSkill == 'deception' && actorHasPerk(actor, TRUSTWORTHY_ID)) {
          difficulty = Infinity;
        }

        // Roll With the Punches (Renegade/Tank Focus, 6th level, p.97) - "double your Toughness,
        // Willpower, or Evasion against one attack or effect." Read (and, if it matches, consumed)
        // here rather than in _getAutomaticCombatModifiers's self-status section, since this is
        // the TARGET's own banked effect applying to someone ELSE's roll, not the roller's own
        // next one - see banked-buffs.mjs#consumeRollWithThePunches's own doc comment. Doubles the
        // whole combined difficulty (base Defense + Shield Upgrade - deflective reduction) rather
        // than just the base Defense score, the same "one combined number" precision this method
        // already treats every other Defense modifier at.
        if (await consumeRollWithThePunches(token.actor, resolvedDefenseType)) {
          difficulty *= 2;
        }

        // Hard Target (Pink Ranger, 2nd level, p.50) - see consumeHardTarget's own doc comment.
        difficulty += await consumeHardTarget(token.actor, resolvedDefenseType);

        // Resilience (Across the Stars, Gold Ranger, 11th level, p.53) - see consumeResilience's
        // own doc comment.
        difficulty += await consumeResilience(token.actor, resolvedDefenseType);

        // Clever Mind (MLP CRB, Laugh Tactic, p.86) - see helpers/clever-mind.mjs's own doc
        // comment. A delta rather than a flat bonus - swaps this attack's Defense comparison over
        // to the target's own Cleverness.
        difficulty += await consumeCleverMind(token.actor, resolvedDefenseType);

        // Rise Again (Through the Shattered Grid, General Perk, p.115) - see
        // helpers/rise-again.mjs's own doc comment.
        difficulty += await consumeRiseAgainDefense(token.actor, resolvedDefenseType);

        // Force Field/Stalwart Defense (Transformers CRB) - self-banked Defense bonuses - see
        // helpers/banked-buffs.mjs#consumeBankedDefenseBonus's own doc comment for the shared
        // primitive both go through. (Sword And Board / Remove & Rebuild are rules/bank.mjs#bankedDefense
        // entries now, added below.)
        difficulty += await consumeBankedDefenseBonus(token.actor, FORCE_FIELD_DEFENSE_FLAG, resolvedDefenseType);
        difficulty += await consumeBankedDefenseBonus(token.actor, STALWART_DEFENSE_FLAG, resolvedDefenseType);
        difficulty += await consumeBankedDefenseBonus(token.actor, MASS_SHIFT_DEFENSE_FLAG, resolvedDefenseType);

        // Caution To The Wind (Transformers CRB, Outrider Focus, p.86) - see
        // CAUTION_TO_THE_WIND_ID's own doc comment above. {all: -N}, so this naturally lowers
        // difficulty (the same negative-amount shape Stronger Together's own self-penalty uses).
        difficulty += await consumeBankedDefenseBonus(token.actor, CAUTION_TO_THE_WIND_FLAG, resolvedDefenseType);

        // Stand By Me (MLP CRB, Loyalty, 2nd level, p.90) - see helpers/stand-by-me.mjs's own doc
        // comment. Applies to ALL Defenses (not resolvedDefenseType-gated like every entry above),
        // a live, non-consumed read for as long as an ally with the Perk stays adjacent.
        difficulty += getStandByMeDefenseBonus(token.actor);

        // Grid Surge - Toughness Boost (Silver Ranger, 2nd level, p.57) - see
        // consumeGridSurgeToughness's own doc comment.
        difficulty += await consumeGridSurgeToughness(token.actor, resolvedDefenseType);

        // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
        // helpers/phantom-suite.mjs's own doc comment for why this is a live, non-consumed read
        // (unlike every other banked bonus in this loop) - it applies to every Evasion-compared
        // attack for as long as the toggle stays on, not just the next one.
        if (isPhantomSuiteActive(token.actor)
          && (resolvedDefenseType == 'evasion'
            || (resolvedDefenseType == 'toughness' && hasPhantomFocusOption(token.actor, 'phaseDefense')))) {
          // Phase Defense (Phantom Focus choice, p.62): "you also apply [Phantom Suite's] Evasion
          // Defense bonus to your Toughness Defense" while Phantom Suite is active - the same
          // live, non-consumed bonus as Phantom Suite's own Evasion half above, just also
          // compared against Toughness for a holder of this specific Phantom Focus choice.
          difficulty += getPhantomSuiteEvasionBonus(token.actor);
        }

        // Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32) -
        // see helpers/powered-plating.mjs's own doc comment. Same live, non-consumed shape as
        // Phantom Suite's own Evasion bonus above, just Toughness-only and cleared elsewhere
        // (onMorph) instead of by a hit.
        if (resolvedDefenseType == 'toughness') {
          difficulty += getPoweredPlatingBonus(token.actor);
        }

        // Summon Armor / Summon Shield (MLP CRB spells) - see helpers/summon-armor.mjs's own doc
        // comment. Applies to both Toughness and Evasion, live and non-consumed (no natural
        // end-trigger to clear it on, unlike Phantom Suite's own Evasion bonus above).
        difficulty += getSummonArmorDefenseBonus(token.actor, resolvedDefenseType);

        // Rotten Tomatoes (MLP CRB, Laugh Tactic, p.86) - see helpers/rotten-tomatoes.mjs's own
        // doc comment. Toughness/Evasion only, live and non-consumed for the rest of the scene
        // (bankPendingBonus's own combatId stamp is what clears it, same "encounter approximates
        // scene" idiom as every other "for the rest of the scene" grant here).
        if (resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion') {
          difficulty += getRottenTomatoesBonus(token.actor);
        }

        // Tough Crowd (MLP CRB, Laugh Tactic, p.86) - see helpers/tough-crowd.mjs's own doc
        // comment. The same shape as Rotten Tomatoes just above, on Willpower/Cleverness instead.
        if (resolvedDefenseType == 'willpower' || resolvedDefenseType == 'cleverness') {
          difficulty += getToughCrowdBonus(token.actor);
        }

        // Expanded Mysticism - Fortify (MLP CRB, Spirit of Magic, 9th level, p.95) - see
        // helpers/expanded-mysticism.mjs's own doc comment. Live, non-consumed, Toughness-or-
        // Evasion (whichever was chosen), same shape as Powered Plating's Toughness bonus above.
        if (resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion') {
          difficulty += getExpandedMysticismFortifyBonus(token.actor, resolvedDefenseType);
        }

        // Grow! (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 10th level) - see
        // helpers/monster-morph.mjs's own doc comment. +2 to BOTH Toughness and Evasion while
        // active, the same live, non-consumed shape as Powered Plating's own Toughness bonus above.
        if (resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion') {
          difficulty += getGrowDefenseBonus(token.actor);

          // Nemesis Drain - see helpers/nemesis-drain.mjs's own doc comment. -1 to BOTH Toughness
          // and Evasion (approximating "any Defenses that gained a bonus from It's Morphin Time!
          // armor") for a previously-hit target, same live, non-consumed shape as Grow's own bonus
          // just above (negative instead of positive).
          // Only a Defense the Morphin armor actually raised (its per-Defense Morphed bonus).
          if ((token.actor.system?.defenses?.[resolvedDefenseType]?.morphed ?? 1) > 0) {
            difficulty += getNemesisDrainPenalty(token.actor);
          }

          // Meat Shield - see helpers/meat-shield.mjs's own doc comment. +to BOTH Toughness and
          // Evasion (whichever of the temp/permanent halves is larger), same live, non-consumed
          // shape as Grow's own bonus above.
          difficulty += getMeatShieldBonus(token.actor);
        }

        // Skier - see SKIER_ID's own comment above. Same "flag alone isn't enough" defense-in-depth
        // check documents/actor.mjs's own Ground Movement half already uses.
        if (resolvedDefenseType == 'evasion' && actorHasPerk(token.actor, SKIER_ID) && isSkiing(token.actor)) {
          difficulty += 1;
        }

        // Lightshield Armor (Through the Shattered Grid, Guardian of Eltar, Wisdom of the Elders
        // option, p.72): "+2 to Toughness" while active - same live, non-consumed shape as
        // Powered Plating's own Toughness bonus just above (can't touch _prepareDefenses).
        if (resolvedDefenseType == 'toughness' && isWisdomOfTheEldersActive(token.actor, 'lightshieldArmor')) {
          difficulty += 2;
        }

        // Protection (Quartermaster's Guide to Gear, Grid Power, p.94) - see
        // helpers/protection.mjs's own doc comment. Same live, non-consumed shape as Lightshield
        // Armor/Powered Plating just above - the base +1 is a permanent compendium Active Effect,
        // this is only the optional scene-boost's own extra +1.
        if (resolvedDefenseType == 'toughness') {
          difficulty += getProtectionBoostBonus(token.actor);
        }

        // Reactive (Quartermaster's Guide to Gear, Grid Power, p.94) - see
        // helpers/reactive.mjs's own doc comment. Same live, non-consumed shape as Protection just
        // above, just Evasion instead of Toughness.
        if (resolvedDefenseType == 'evasion') {
          difficulty += getReactiveBoostBonus(token.actor);
        }

        // Zeo Crystal Boost, Morpher option (Across the Stars, Grid Power, p.73) - see
        // helpers/zeo-crystal-boost.mjs's own doc comment. "+1 to all Defenses" - unlike Powered
        // Plating/Lightshield Armor above (Toughness-only), this applies regardless of
        // resolvedDefenseType, same live non-consumed shape otherwise.
        // Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272) - see
        // helpers/bolster-defense.mjs's own doc comment. Same live, non-consumed shape as
        // Zeo Crystal Boost's own "all Defenses" option just below/above, but can also be scoped
        // to one specific Defense instead.
        difficulty += getBolsterDefenseBonus(token.actor, resolvedDefenseType);

        // Roar! (Ferocious Fighters, Tiger Force Faction Perk) - see helpers/roar.mjs's own doc
        // comment. Same live, non-consumed single-Defense shape as Lightshield Armor/Bolster
        // Defense above, self-only.
        difficulty += getRoarDefenseBonus(token.actor, resolvedDefenseType);

        // Jury Rig - Align Suspension / Harden Armor (Factions in Action Vol. 2, Engineer Troop
        // Focus, 17th level, p.73) - see helpers/jury-rig.mjs's own doc comment. Same live,
        // non-consumed Defense-bonus shape as Bolster Defense just above.
        difficulty += getJuryRigDefenseBonus(token.actor, resolvedDefenseType);

        // Like Water (Factions in Action Vol. 2, General Perk, p.30) - see helpers/like-water.mjs's
        // own doc comment. Same live, non-consumed Defense-bonus shape as Bolster Defense/Jury Rig
        // just above, activated once per Combat instead of via a triggered roll.
        difficulty += getLikeWaterDefenseBonus(token.actor, resolvedDefenseType);

        // Not On My Watch (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
        // helpers/not-on-my-watch.mjs's own doc comment. A passive, always-live check (no
        // activation at all) rather than a banked/toggled state like Like Water just above.
        if (actorHasPerk(token.actor, NOT_ON_MY_WATCH_ID)) {
          difficulty += getNotOnMyWatchDefenseBonus(token.actor, resolvedDefenseType);
        }

        // Defender Step (Through the Shattered Grid, Magna Defender, 2nd level, p.24) - see
        // helpers/defender-step.mjs's own doc comment. A THIRD PARTY's own triggered choice
        // (unlike every bonus above, which is either passive or the target's own activation), so
        // it prompts rather than just reading a live flag/toggle. reactorUuid/defenderStepBonus
        // are threaded onto this target's own returned entry below so _rollSkillHelper's own
        // results loop (which is the first point where this attack's hit/miss is actually known)
        // can bank Retribution's own follow-up once the outcome is known - see
        // helpers/retribution.mjs's own doc comment.
        const { bonus: defenderStepBonus, reactorUuid: defenderStepReactorUuid } = await checkAndActivateDefenderStep(token.actor, actor);
        difficulty += defenderStepBonus;

        if (getZeoCrystalBoostOption(token.actor) == 'morpher') {
          difficulty += 1;
        }

        // On My Mark!, Suppressing Fire, Make an Opening, Pinpoint, Energic Shields, Bot-Hunter -
        // helpers/target-riders.mjs#riderDefenseAdjust.
        // Item rules' banked Defense bonuses (rules/bank.mjs#bankedDefense) - used up by this attack.
        difficulty += await bankedDefense(token.actor, resolvedDefenseType, actor);

        difficulty += riderDefenseAdjust(actor, token.actor, resolvedDefenseType, {
          item, isAttack: item?.type == 'weaponEffect', pinpoint: Number(skillRollOptions.pinpointCount) || 0, difficulty,
          ext: skillRollOptions.ext ?? {},
          // Item rules' Defense rules (rules/adapter.mjs#ruleDefenseAdjust) can ask about the rolled Skill.
          rolledSkill, rolledEssence,
        });

        // Unseen Strike - see UNSEEN_STRIKE_ID's own comment above. Applied last, against the
        // fully-computed difficulty (including the target's own Phantom Suite bonus just above,
        // Shield Upgrade, banked bonuses, etc.) - "the target's Evasion Defense is halved" reads
        // most naturally as the one final number this attack is actually compared against.
        if (isUnseenStrikeAttempt && resolvedDefenseType == 'evasion') {
          difficulty = Math.ceil(difficulty / 2);
        }

        // Augmented's own mandatory Hang-Up - see AUGMENTED_HANGUP_ID's own comment above. Halved
        // the same way and in the same place as Unseen Strike just above (rounding up, against the
        // final computed number), but keyed on the TARGET's own recorded damage-type weakness
        // rather than the attacker's Perk, and applying to whichever Defense this attack uses
        // rather than Evasion specifically - RAW says "your Defenses", plural and unqualified.
        // Every held instance is checked, since Augmented is explicitly repeatable with a
        // different damage type each time (the same all-instances scan hasPhantomFocusOption uses).
        if (item?.system?.damageType && token.actor.items?.some(
          heldItem => heldItem.type == 'hangUp'
            && heldItem.system?.choice == item.system.damageType
            && (heldItem.flags?.core?.sourceId == AUGMENTED_HANGUP_ID
              || heldItem._stats?.compendiumSource == AUGMENTED_HANGUP_ID
              || heldItem.flags?.essence20?.rulesSource == AUGMENTED_HANGUP_ID),
        )) {
          difficulty = Math.ceil(difficulty / 2);
        }

        return {
          name: token.actor.name,
          targetUuid: token.actor.uuid,
          difficulty,
          defenseType: resolvedDefenseType,
          defenderStepBonus,
          defenderStepReactorUuid,
          willpowerDifficulty: isTriggerHappyAttack ? getDefenseValue(token.actor, 'willpower') : null,
          toughnessDifficulty: isExplosiveAftershockAttack ? getDefenseValue(token.actor, 'toughness') : null,
          // Unconscious (GI Joe CRB, Conditions, p.226): "...a successful attack becomes a
          // critical hit." Asleep implies Unconscious (see impliedUnconscious's own comment in
          // _getAutomaticCombatModifiers above) so it's included here too. Read per-target here
          // (rather than in _getAutomaticCombatModifiers, which only computes a single roll-wide
          // shift) since results.map below already resolves per-target Degrees of Success.
          targetUnconscious: token.actor.statuses?.has('unconscious') || token.actor.statuses?.has('asleep') || false,
          // No Factor - see helpers/no-factor.mjs's own doc comment. Read per-target here, same
          // shape as targetUnconscious just above, for the multiplier 1->2 bump below.
          targetNoFactorFooled: isNoFactorFooled(actor, token.actor),
          // Scapegoat's Hang-Up - helpers/target-riders.mjs#applyRollRiders.
          ...(scapegoatSwapped ? { scapegoatSwapped } : {}),
        };
      }));
    } else if (dataset.dif) {
      checkEntries = [{ name: actor.name, targetUuid: null, difficulty: parseInt(dataset.dif) }];
    }

    // Bear Hug (Factions in Action Vol. 2, General Perk, p.94): "When you Grapple a creature, they
    // suffer 1 Blunt damage." Grapple attacks are a real, existing damageType
    // (E20.damageTypes.grapple, always damageValue 0 - see e.g. Grappling Hook Effect) rather than
    // dealing normal damage, so this both adds +1 to damageBonusValue AND overrides the attack's
    // own damageType to Blunt for this hit specifically (see overriddenDamageType below) - a flat
    // damageBonusValue alone would have landed as 0+1 "grapple" damage, not the Blunt type RAW
    // actually names (which matters for anything Resistant to Blunt specifically).
    // (The +1 itself is the Perk's own scaled DamageModifier rule; this is only the type override.)
    const isBearHugGrapple = item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
      && actorHasPerk(actor, BEAR_HUG_ID);

    // Ram (TF CRB, p.49): "For every full Size Class above Large (Huge, Gigantic, Towering, etc,
    // but not Long, Extended, etc), your Ram attack deals 1 additional Blunt Damage." Matched via
    // weapon-effect.mjs's own isRam flag, same as the GI Joe/PR Ram checks elsewhere in this file
    // - the generic Ram weaponEffect item itself only carries the flat base 1 Blunt, since the
    // size scaling has to be read live off the attacking Vehicle's own current Size. RAW's own
    // parenthetical ("but not Long, Extended, etc") is exactly the half-step pattern
    // E20.actorSizes already encodes - every full Size Class sits two list entries above the
    // last one, with a half-step Class in between (Large, Long, Huge, Extended, Gigantic, ...) -
    // so the bonus is simply how many full 2-entry steps past Large the Vehicle's size index is.
    const sizeOrder = Object.keys(E20.actorSizes);
    const ramSizeDamageBonus = item?.type == 'weaponEffect' && item.system.isRam && actor?.type == 'vehicle'
      ? Math.max(0, Math.floor((sizeOrder.indexOf(actor.system.size) - sizeOrder.indexOf('large')) / 2))
      : 0;

    // Jury Rig - Jacket Ammunition (Factions in Action Vol. 2, Engineer Troop Focus, 17th level,
    // p.73) - see helpers/jury-rig.mjs's own doc comment. "+1 damage on one of the vehicle's
    // Attacks" is simplified to any of the vehicle's Attacks while the benefit is active (see the
    // helper's own comment for why) - checked against `actor` (the vehicle rolling the attack),
    // not the Engineer who granted it.
    const jacketAmmunitionDamageBonus = item?.type == 'weaponEffect'
      && isJuryRigBenefitActive(actor, 'jacketAmmunition')
      ? 1 : 0;

    // Roaming the Land (Ferocious Fighters, Mega Monsters Faction Perk, p.75) - see
    // E20.roamingTheLandOptions' own doc comment. The "smaller creatures" damage half is the Perk's
    // own scaled DamageModifier rule; the "larger creatures" Stun half is applied post-hit (see
    // checkContext.roamingTheLandStun below), since Stun isn't a plain damageValue add.
    const roamingTheLandPerk = findPerk(actor, ROAMING_THE_LAND_ID);

    // Force (MLP Heavy Hitter Influence, p.51) - see FORCE_ID's own comment above. Once/scene,
    // gated via hasUsedThisEncounter (always available outside combat - accepted looseness). Also
    // banks Fleeting Energy's own ↓1-Strength penalty right when Force is actually used, consumed
    // in the self-status section above.
    const forceEligible = checkEntries && item?.type == 'weaponEffect' && rolledSkill == 'might'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, FORCE_ID)
      && !hasUsedThisEncounter(actor, 'forceUsedThisEncounter');
    const forceDamageBonus = forceEligible ? 1 : 0;
    if (forceEligible) {
      await markUsedThisEncounter(actor, 'forceUsedThisEncounter');
      if (actorHasHangUp(actor, FLEETING_ENERGY_HANGUP_ID)) {
        await bankPendingBonus(actor, 'pendingFleetingEnergy', { shiftDown: 1 });
      }
    }

    // Zeo Crystal Boost, Zord option's "single successful Zord Attack" damage half - see
    // helpers/zeo-crystal-boost.mjs's own doc comment. The Zord rolls its own weaponEffect attacks as
    // its own actor, but the Grid Power lives on its PILOT (the crew member seated as driver, via
    // _getVehicleDriver). consumeZeoCrystalBoostZordAttackDamage() itself
    // marks the single use spent the moment it's granted here (an attempt, not a hit, matching this
    // project's own "the attempt consumes the resource" idiom) - only called when there's a real
    // pilot to check, so a bare non-Zord roll never touches (and never burns) the flag.
    const zordAttackPilot = checkEntries && item?.type == 'weaponEffect' && actor?.type == 'zord'
      ? this._getVehicleDriver(actor)
      : null;
    const zeoCrystalBoostZordAttackDamageBonus = zordAttackPilot
      && consumeZeoCrystalBoostZordAttackDamage(zordAttackPilot) ? 2 : 0;

    // Every Perk/Role Points item actually contributing to damageBonusValue below, so the check
    // card can tell the player what's granting the bonus damage they're about to apply - same
    // reasoning as the reroll button's own source label (chat.mjs#addRerollButtons). A Set, not
    // an array, since Warfighter and a damageBonus Role Points item are independent grants that
    // could otherwise land the same name twice (in practice they never share one, but nothing
    // stops it structurally).
    const damageBonusSources = new Set();

    // Acid / Fire (Damage Types): "deal an extra point of damage when they hit a target that
    // defended with Toughness/Evasion" respectively - a core rule of each damage type itself, not
    // gated behind any Perk. Checked against skillRollOptions.defenseType (the Defense actually
    // being rolled against - the weaponEffect's own configured default, or a manual override from
    // the Roll Options Dialog), not item.system.defenseType, since RAW cares about which Defense
    // the target actually defended with on THIS attack.
    //
    // Elemental Adaptation (Beneath the Helmet, Aqua Ranger, p.42) - see
    // helpers/aqua-elemental-adaptation.mjs's own doc comment for why Acid/Fire are the only two
    // core damage-type rules this Perk has anything concrete to suppress. Resolved fresh via
    // game.user.targets.first() (the same "no single higher-scoped target variable, just resolve
    // it where needed" idiom this function already uses throughout) rather than threading a new
    // parameter through.
    const elementalAdaptationTarget = checkEntries && item?.type == 'weaponEffect'
      ? game.user.targets.first()?.actor : null;

    // Corrosive Tip / Blazing / Ignition Tank (PR CRB Weapon Upgrades, p.116/118): "The weapon
    // gains the Acid/Fire trait." Like Tasing/Voltage Tank's identical Electric grant just above
    // (see that comment on _getUpdatedShiftDataset), this only ever lands on the parent Weapon
    // item's own system.traits, never on the weaponEffect's damageType - so Acid/Fire's own core
    // damage-type bonus below needs to check the parent weapon's merged traits too, not only
    // item.system.damageType, or these upgrades stay purely cosmetic.
    const parentWeaponElementTraits = item?.type == 'weaponEffect'
      ? this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits
      : null;

    const acidDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && (item.system.damageType == 'acid' || parentWeaponElementTraits?.includes('acid'))
      && skillRollOptions.defenseType == 'toughness'
      && !hasAquaElementalAdaptation(elementalAdaptationTarget, 'acid')
      ? 1 : 0;
    if (acidDamageBonus) {
      damageBonusSources.add(this._localize(E20.damageTypes.acid));
    }

    const fireDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && (item.system.damageType == 'fire' || parentWeaponElementTraits?.includes('fire'))
      && skillRollOptions.defenseType == 'evasion'
      && !hasAquaElementalAdaptation(elementalAdaptationTarget, 'fire')
      ? 1 : 0;
    if (fireDamageBonus) {
      damageBonusSources.add(this._localize(E20.damageTypes.fire));
    }

    // Now I'm Angry - see NOW_IM_ANGRY_ID's own comment above. Banked when a Critical Success lands
    // on the actor, used up by its next Attack.
    const pendingNowImAngry = getPendingBonus(actor, PENDING_NOW_IM_ANGRY_FLAG);
    const nowImAngryDamageBonus = checkEntries && item?.type == 'weaponEffect' && pendingNowImAngry
      ? pendingNowImAngry.amount : 0;
    if (nowImAngryDamageBonus) {
      damageBonusSources.add(findPerk(actor, NOW_IM_ANGRY_ID)?.name ?? "Now I'm Angry");
      await clearPendingBonus(actor, PENDING_NOW_IM_ANGRY_FLAG);
    }

    // Demolition Driver - the Perk is held by the vehicle's DRIVER, not the vehicle itself (the
    // roller here) - same "re-resolve via _getVehicleDriver" shape _isDemolitionDriverAttack
    // already used to grant this in the first place.
    if (spentDemolitionDriver) {
      const demolitionDriverPilot = this._getVehicleDriver(actor);
      damageBonusSources.add(findPerk(demolitionDriverPilot, DEMOLITION_DRIVER_ID)?.name ?? 'Demolition Driver');
    }

    if (combatStanceDamageBonus) {
      damageBonusSources.add(findPerk(actor, COMBAT_STANCE_ID)?.name ?? 'Combat Stance');
    }

    if (isRetributionDamageAttempt) {
      damageBonusSources.add(findPerk(actor, RETRIBUTION_ID)?.name ?? 'Retribution');
    }

    // Ultimate Magna Defender (Through the Shattered Grid, Magna Defender, 20th level, p.25) - the
    // Perk holder's own melee Attacks (Mega Defender form included, it stays on the Ranger's own
    // actor) get their +1 from the Perk's own scaled DamageModifier rule. The Defender Torozord is
    // its own Megaform actor, flagged with the Magna Defender who formed it (zord2DefenderTorozord,
    // helpers/extensions/zord2/zord-features2.mjs) - no rule scope reaches it, so its melee attacks
    // check that Ranger here. Its own "+2 all Defenses" and "Edge on Strength" bullets are already
    // compendium Active Effects.
    const defenderTorozordFormer = actor.type == 'megaform' && typeof fromUuidSync == 'function'
      && actor.flags?.essence20?.zord2DefenderTorozord
      ? fromUuidSync(actor.flags.essence20.zord2DefenderTorozord) : null;
    const ultimateMagnaDefenderHolder = actorHasPerk(defenderTorozordFormer, ULTIMATE_MAGNA_DEFENDER_ID) ? defenderTorozordFormer : null;
    const ultimateMagnaDefenderDamageBonus = checkEntries && isMeleeWeaponEffect
      && ultimateMagnaDefenderHolder ? 1 : 0;
    if (ultimateMagnaDefenderDamageBonus) {
      damageBonusSources.add(findPerk(ultimateMagnaDefenderHolder, ULTIMATE_MAGNA_DEFENDER_ID)?.name ?? 'Ultimate Magna Defender');
    }

    // Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level) - see
    // helpers/psycho-assault.mjs's own doc comment. The shiftUp half lives in rollSkill's own
    // shift computation above; this is the matching +1 damage.
    const psychoAssaultDamageBonus = checkEntries && isPsychoAssaultActive(actor) ? 1 : 0;
    if (psychoAssaultDamageBonus) {
      damageBonusSources.add(findPerk(actor, PSYCHO_ASSAULT_ID)?.name ?? 'Psycho Assault');
    }

    // Growing Smolder - see updatedShiftDataset's own comment above (already read and cleared
    // there; growingSmolderStacks is reused here as-is, not re-consumed).
    if (checkEntries && growingSmolderStacks) {
      damageBonusSources.add(findPerk(actor, GROWING_SMOLDER_ID)?.name ?? 'Growing Smolder');
    }

    // Oorah! - see OORAH_ID's own comment in _getAutomaticCombatModifiers above. Same
    // "computed there, folded in here" shape as Zordbane just above.
    const oorahDamageBonus = combatModifiers.oorahDamageBonus;
    if (oorahDamageBonus) {
      damageBonusSources.add(findPerk(actor, OORAH_ID)?.name ?? 'Oorah!');
    }

    // Goin' Heels - see GOIN_HEELS_ID's own comment in _getAutomaticCombatModifiers above. Same
    // "computed there, folded in here" shape as Oorah! just above.
    const goinHeelsDamageBonus = combatModifiers.goinHeelsDamageBonus;
    if (goinHeelsDamageBonus) {
      damageBonusSources.add(findPerk(actor, GOIN_HEELS_ID)?.name ?? "Goin' Heels");
    }

    // Tear Down - see helpers/tear-down.mjs's own doc comment. Read against whichever token is
    // currently targeted, the same "trust the currently-selected target" idiom Nemesis/Regal
    // already use elsewhere - drops the "Psychic" type distinction the same way Position of
    // Power's own identical flat-bonus-damage just above already does. Cleared here (whether or
    // not it actually applied to THIS weaponEffect - the Free-action check is spent per attack
    // attempt either way, same as Growl's own per-attempt consumption).
    const tearDownTarget = item?.type == 'weaponEffect' ? game.user?.targets?.first?.()?.actor : null;
    const tearDownDamageBonus = isTearDownPending(actor, tearDownTarget) ? 1 : 0;
    if (tearDownDamageBonus) {
      damageBonusSources.add(findPerk(actor, TEAR_DOWN_ID)?.name ?? 'Tear Down');
      await clearTearDownPending(actor);
    }

    // Emotional Mastery: Anger (A Jump Through Time, Purple Ranger, p.37) - "You gain a +1 bonus
    // to Unarmed and One-Handed weapon Attacks" while active. Unarmed detected the same "no
    // parent weapon" way as Iron Hooves/Phantom Ranger Prime; One-Handed read directly off the
    // weaponEffect's own numHands field (the same field Weapon Conversion's own one-time edit
    // targets).
    const angerDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && (!this._getParentWeapon(actor, item) || item.system.numHands == 1)
      && isEmotionalMasteryOptionActive(actor, 'anger')
      ? 1 : 0;
    if (angerDamageBonus) {
      damageBonusSources.add(findPerk(actor, EMOTIONAL_MASTERY_ID)?.name ?? 'Anger (Emotional Mastery)');
    }

    // Zeo Crystal Boost, team-wide Megaform clause (Across the Stars, Grid Power, p.73) - see
    // helpers/zeo-crystal-boost.mjs's own doc comment. "+1 damage to all Megaform Zord Attacks" -
    // checked against the rolling MEGAFORM actor itself (a Megazord rolls its own weaponEffect
    // attacks as its own actor, the same as a Zord does), not scoped to melee/ranged like the
    // per-Zord Features just above/below.
    const zeoCrystalBoostMegaformDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && actor?.type == 'megaform' && isZeoCrystalBoostMegaformTeamActive(actor)
      ? 1 : 0;
    if (zeoCrystalBoostMegaformDamageBonus) {
      damageBonusSources.add('Zeo Crystal Boost');
    }

    // Titan Body - see TITAN_BODY_ID's own comment above. A floor, not an additive bonus - folded
    // directly into the base damageValue computation below (not damageBonusValue, which every
    // other check here adds ON TOP of the item's own damageValue), so it can't be mistaken for a
    // stacking source in the roll's own damage breakdown.
    const hasTitanBodyDamageFloor = checkEntries && item?.type == 'weaponEffect'
      && item.system.classification.style == 'melee' && actor?.type == 'zord'
      && actorHasZordFeature(actor, TITAN_BODY_ID);

    // Bio-Energy Conversion - see its own doc comment (helpers/bio-energy-conversion.mjs).
    // "inflict 2 extra damage on all attacks (both melee and ranged)" the round after it's used -
    // unlike Thunder Upgrade above, not scoped to Zord actors specifically (RAW doesn't say this
    // Feature is Zord-exclusive the way Thunder Upgrade's own Zord-only clause is worded).
    const bioEnergyConversionDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && isBioEnergyConversionActive(actor)
      ? 2 : 0;
    if (bioEnergyConversionDamageBonus) {
      damageBonusSources.add('Bio-Energy Conversion');
    }

    // Ricochet - see RICOCHET_ID's own comment above. The ↓1 penalty itself was already folded into
    // skillRollOptions.shiftDown above; this is just the "+1 additional damage" half of the same
    // checkbox, read again here the same way Precision Aim's own checkbox is.
    const ricochetDamageBonus = skillRollOptions.applyRicochet ? 1 : 0;
    if (ricochetDamageBonus) {
      damageBonusSources.add(findPerk(actor, RICOCHET_ID)?.name ?? 'Ricochet');
    }

    // Size Matters - see SIZE_MATTERS_ID's own comment above. The trade-in itself already happened
    // above; this is just the resulting damage, at 1-for-1 against a Vehicle-type ("object") target
    // or 2-for-1 against anything else ("creature").
    const sizeMattersTargetForDamage = item?.type == 'weaponEffect' ? game.user.targets.first()?.actor : null;
    const sizeMattersDamageBonus = spentSizeMatters > 0
      ? Math.floor(spentSizeMatters / (sizeMattersTargetForDamage?.type == 'vehicle' ? 1 : 2))
      : 0;
    if (sizeMattersDamageBonus) {
      damageBonusSources.add(findPerk(actor, SIZE_MATTERS_ID)?.name ?? 'Size Matters');
    }

    // Penetrating Shot - see PENETRATING_SHOT_ID's own comment above. Same checkbox-confirmation
    // shape as Precision Aim just above, reading the live Volley-Shots-minus-1 bonus pre-filled
    // in updatedShiftDataset.penetratingShotAvailable.
    const penetratingShotDamageBonus = skillRollOptions.applyPenetratingShot ? updatedShiftDataset.penetratingShotAvailable : 0;
    if (penetratingShotDamageBonus) {
      damageBonusSources.add(findPerk(actor, PENETRATING_SHOT_ID)?.name ?? 'Penetrating Shot');
    }

    const appliesRolePointsDamage = !!(checkEntries && damageRolePoints && skillRollOptions.applyRolePointsDamage);
    if (appliesRolePointsDamage) {
      damageBonusSources.add(damageRolePoints.name);
    }

    // Hard Hitter (Finster's Monster-Matic Cookbook, Path of Venom, 1st level, p.299): "...that
    // attack gains Edge and potential additional damage of its respective type if successful."
    // The damage half is already covered generically by the damageBonus rolePoints checkbox just
    // above (the same mechanism Power Strike's own identical shape already relies on) - only the
    // Edge half needs its own targeted grant here, matched by this specific rolePoints item's own
    // compendium id (not by name - a same-named bare "perk" flavor duplicate and other Paths' own
    // resource items share this pack).
    // (Granted before the formula is built - see hardHitterEdge above it.)

    // Bring It All Down - the "+2 damage" option. See BRING_IT_ALL_DOWN_ID's own comment above
    // (dice.mjs's shiftUp application) for why no separate Perk/style gate is needed here.
    const bringItAllDownDamageBonus = dataset.bringItAllDownEffect == 'damage' ? 2 : 0;


    // damageBonus Role Points (e.g. Sneak Attack Damage) - a flat add-on to the weaponEffect's own
    // damageValue, folded in only once there's an actual attack (a real checkEntries) to apply it
    // to, so checking the box on a roll that never ends up targeting anyone doesn't needlessly
    // burn Sneak Attack's once-per-round use for no effect.
    // Item rules' scaled DamageModifiers (rules/adapter.mjs#ruleScaledDamage).
    // Only on a roll made against someone (checkEntries), like the hand-written bonuses.
    const scaledRules = checkEntries ? ruleScaledDamage(actor, game.user?.targets?.first?.()?.actor ?? null, {
      item, rolledSkill, rolledEssence, edge: !!skillRollOptions.edge, snag: !!skillRollOptions.snag, dataset,
      // The Defense the dialog settled on (`defense:` tags).
      defenseType: skillRollOptions.defenseType ?? item?.system?.defenseType,
    }) : { amount: 0, sources: [] };
    // ...and ticked DialogSwitches with a damage amount (adapter#applyRuleSwitches).
    for (const source of [...scaledRules.sources, ...(skillRollOptions.ruleDamageSources ?? [])]) {
      damageBonusSources.add(source);
    }

    // ...and roll sources carrying damage (a banked "+N damage on your next attack"), unless the
    // player switched that source off in the dialog.
    let sourceDamage = 0;
    for (const source of updatedShiftDataset.combatModifierSources ?? []) {
      if (source.damage && !skillRollOptions.disabledModifierSourceIds?.includes(source.id)) {
        sourceDamage += Number(source.damage) || 0;
        damageBonusSources.add(source.label);
      }
    }

    let damageBonusValue = scaledRules.amount + (Number(skillRollOptions.ruleDamage) || 0) + sourceDamage + jacketAmmunitionDamageBonus
      + bringItAllDownDamageBonus
      + ricochetDamageBonus + sizeMattersDamageBonus + penetratingShotDamageBonus
      + acidDamageBonus + fireDamageBonus
      + nowImAngryDamageBonus
      + zeoCrystalBoostZordAttackDamageBonus + spentDemolitionDriver
      + forceDamageBonus + zeoCrystalBoostMegaformDamageBonus
      + bioEnergyConversionDamageBonus
      + combatStanceDamageBonus + ultimateMagnaDefenderDamageBonus + psychoAssaultDamageBonus + oorahDamageBonus + goinHeelsDamageBonus + growingSmolderStacks
      + tearDownDamageBonus
      + angerDamageBonus
      + ramSizeDamageBonus
      + (isRetributionDamageAttempt ? 1 : 0)
      + (appliesRolePointsDamage ? damageRolePoints.value : 0);
    if (ramSizeDamageBonus) {
      damageBonusSources.add('Ram (Size Class)');
    }

    if (forceDamageBonus) {
      damageBonusSources.add(findPerk(actor, FORCE_ID)?.name ?? 'Force');
    }

    if (zeoCrystalBoostZordAttackDamageBonus) {
      damageBonusSources.add('Zeo Crystal Boost');
    }

    let debilitatingStrike = false;
    // damageRolePoints?. below - damageBonusValue can now be truthy from Warfighter's flat bonus
    // alone, with no damageRolePoints claim active at all (unlike before Warfighter existed, when
    // a truthy damageBonusValue always implied a truthy damageRolePoints).
    if (damageBonusValue && damageRolePoints?.isSneakAttack) {
      await markSneakAttackUsed(actor);

      // Sudden Strike - see helpers/sneak-attack.mjs's own SUDDEN_STRIKE_ID comment. Spends the
      // Story Point and marks the once-per-combat use HERE, at the point Sneak Attack Damage is
      // actually applied - checkSneakAttackEligibility() only decided the checkbox could be
      // offered, it didn't spend anything. Only when Sudden Strike was actually needed to qualify
      // (viaSuddenStrike, set with the eligibility check above) - an attack that met Sneak
      // Attack's ordinary conditions anyway costs nothing.
      if (damageRolePoints.viaSuddenStrike
        && actorHasPerk(actor, SUDDEN_STRIKE_ID) && !hasUsedThisEncounter(actor, SUDDEN_STRIKE_ENCOUNTER_FLAG)
        && canWriteStoryPoints() && hasStoryPointsAvailable(1)) {
        requestStoryPointSpend(actor, 1);
        await markUsedThisEncounter(actor, SUDDEN_STRIKE_ENCOUNTER_FLAG);
      }

      // Quiet as the Grave - doubles the bonus once/round, independent of Sneak Attack's own
      // once/round gate above.
      if (skillRollOptions.applyDamageDouble && damageRolePoints.canDouble) {
        damageBonusValue *= 2;
        await markUsedThisRound(actor, QUIET_AS_THE_GRAVE_ROUND_FLAG);
        damageBonusSources.add(findPerk(actor, QUIET_AS_THE_GRAVE_ID)?.name ?? 'Quiet as the Grave');
      }

      // Debilitating Strike (16th level) - flagged here, applied per-target once the roll
      // actually resolves and hits (see _rollSkillHelper below).
      debilitatingStrike = actorHasPerk(actor, DEBILITATING_STRIKE_ID);
    } else if (damageBonusValue && damageRolePoints?.isPredatorSneakAttack) {
      await markUsedThisRound(actor, PREDATOR_SNEAK_ATTACK_ROUND_FLAG);
    } else if (damageBonusValue && damageRolePoints?.isForceReconSneakAttack) {
      await markForceReconSneakAttackUsed(actor);
    }

    // Shared by Shock and Awe below and Plate Piercing (_applyPlatePiercingVehicleDamage) -
    // both only care whether this is an explosive-style weaponEffect at all, not any Perk of
    // their own yet.
    const isExplosiveAttack = item?.type == 'weaponEffect' && item.system.classification?.style == 'explosive';

    // Brazen Strike (A Jump Through Time, Grid Power, p.57) - see helpers/brazen-strike.mjs's own
    // doc comment. "Unarmed" via this project's established "no parent weapon" proxy - threaded
    // through checkContext since _rollSkillHelper (where the post-hit application actually lives)
    // has no access to `item` itself.
    const isUnarmedAttack = this._isUnarmedWeaponEffect(actor, item);

    // Cost of Sorcery - see COST_OF_SORCERY_ID's own comment above. "A Skill Test involving a
    // Sorcerous Power or Sorcerous-trait attack" - a Power whose own system.type is 'sorcerous'
    // (the same field _prepareSorcerousPower/power-handler.mjs already key their own Sorcerous
    // logic off), or a weaponEffect whose parent weapon carries the 'sorcerous' trait (the same
    // traits.includes() idiom every other weapon-trait check in this file already uses). Threaded
    // through checkContext for the same "_rollSkillHelper has no access to `item`" reason as
    // isUnarmedAttack just above.
    const isSorcerousAttempt = (item?.type == 'power' && item.system.type == 'sorcerous')
      || !!this._getParentWeapon(actor, item)?.system.traits?.includes('sorcerous');

    // No Fighting?! - see NO_FIGHTING_HANGUP_ID's own comment above. Recomputes the same
    // condition _getAutomaticCombatModifiers already read (to decide whether to actually Snag),
    // purely so _rollSkillHelper (which has no access to `item`/rolledEssence itself) knows
    // whether to clear the one-shot flag once this roll actually happens.
    const noFightingSnagApplied = rolledEssence == 'social' && actorHasHangUp(actor, NO_FIGHTING_HANGUP_ID)
      && !!actor.getFlag?.('essence20', NO_FIGHTING_FLAG);

    // Show Of Hands - see SHOW_OF_HANDS_ID's own comment above. Marks the scene-scoped "made an
    // unarmed attack" flag its own Edge grant checks, the moment an unarmed attack actually rolls -
    // this project's usual "mark it where the qualifying event actually happens" idiom. Scoped to
    // holders of the Perk only, so every other actor's unarmed attack skips a needless setFlag.
    if (isUnarmedAttack && actorHasPerk(actor, SHOW_OF_HANDS_ID)) {
      await markUsedThisScene(actor, SHOW_OF_HANDS_UNARMED_FLAG);
    }

    // Damage-type override toggles (Across the Stars' Blazing Strikes/Void Warrior, A Jump Through
    // Time's Cryogenic Touch) - the first Perk/Power-driven overrides of a weaponEffect's own fixed
    // damageType field anywhere in this project (see POINTY_ID's own doc comment on why Pointy
    // itself never attempted this). Void Warrior applies to any Attack, armed or not; Blazing
    // Strikes/Cryogenic Touch are unarmed-only. Checked in this priority order only because an
    // actor realistically never holds more than one at a time - not a meaningful ranking.
    let overriddenDamageType = null;
    if (item?.type == 'weaponEffect' && isVoidWarriorActive(actor)) {
      overriddenDamageType = 'void';
    } else if (isUnarmedAttack && isBlazingStrikesActive(actor)) {
      overriddenDamageType = 'fire';
    } else if (isUnarmedAttack && isGremlinsMischiefActive(actor)) {
      // Gremlins' Mischief - helpers/target-riders.mjs.
      overriddenDamageType = 'emp';
    } else if (isUnarmedAttack && actorHasPower(actor, CRYOGENIC_TOUCH_ID)) {
      overriddenDamageType = 'cold';
    } else if (isUnarmedAttack && isPointyActive(actor)) {
      // Pointy (Dark Skies over Equestria, General Perk, p.21): "The weapon grants you ↑1 on attacks,
      // and does Sharp damage."
      overriddenDamageType = 'sharp';
    } else if (isUnarmedAttack && rolledSkill == 'finesse' && actor.system.isMorphed
      && isNinjaPowerActive(actor) && actorHasPerk(actor, NINJA_POWER_ID)) {
      // Ninja Power (PR CRB, General Perk, p.97) - see helpers/ninja-power.mjs's own doc comment.
      // "You may choose an elemental type of damage your Finesse-based Unarmed Combat attacks
      // inflict" - the chosen element lives on the Perk item's own system.choice (the
      // elementDamageType choiceType, same as Adapted Wavelength's identical shape), scoped to
      // Finesse specifically (unlike Blazing Strikes/Cryogenic Touch above, which apply to any
      // unarmed skill) and to being Morphed with Ninja Power active.
      overriddenDamageType = findPerk(actor, NINJA_POWER_ID)?.system.choice || null;
    } else if (isUnarmedAttack && skillRollOptions.applySaberToothed && actorHasPerk(actor, SABER_TOOTHED_ID)) {
      // Saber-Toothed - see SABER_TOOTHED_ID's own comment above. Unlike every other unarmed
      // damage-type override above (all free toggles), this one costs ↓1 - see its own
      // skillRollOptions.applySaberToothed check earlier in this function, before finalShift was
      // computed. Re-checks actorHasPerk directly here (not just the checkbox flag) matching every
      // sibling check in this chain's own defensive shape.
      overriddenDamageType = 'sharp';
    } else if (isUnarmedAttack && actor.system.isTransformed
      && (actorHasPerk(actor, TOOTH_AND_CLAW_ID) || actorHasPerk(actor, TOOTH_AND_CLAW_DD_ID))) {
      // Tooth And Claw - see TOOTH_AND_CLAW_DD_ID's own comment above. Alt Mode only. Both
      // printings carry a choiceType to pick Sharp vs. Blunt; an unmade choice defaults to Sharp.
      overriddenDamageType = (findPerk(actor, TOOTH_AND_CLAW_DD_ID) ?? findPerk(actor, TOOTH_AND_CLAW_ID))?.system?.choice || 'sharp';
    } else if (isBearHugGrapple) {
      // Bear Hug - see BEAR_HUG_ID's own comment above.
      overriddenDamageType = 'blunt';
    } else if (item?.type == 'weaponEffect' && actorHasPerk(actor, ENERGY_AFFINITY_ID)
      && getEnergyAffinityAlteredStyle(actor) == item.system.classification?.style) {
      // Energy Affinity - see ENERGY_AFFINITY_ID's own comment (helpers/energy-affinity.mjs) for
      // the activation/scene-duration mechanism. Scoped to whichever style (melee/ranged) was
      // activated, same as every check in this chain reading a live per-attack condition.
      overriddenDamageType = findPerk(actor, ENERGY_AFFINITY_ID)?.system.choice || null;
    } else if (item?.type == 'weaponEffect' && isIlluminateActive(actor)
      && this._getParentWeapon(actor, item)?.system.traits?.includes('martialArts')) {
      // Illuminate (PR CRB, Grid Power, p.100) - see helpers/illuminate.mjs's own doc comment.
      // "Your Martial Arts attacks inflict energy damage" while active - gated on the parent
      // weapon's own `martialArts` trait, the same check Penetrating Strikes' identical Martial
      // Arts gate already uses just above (broader than the "no parent weapon" Unarmed-only proxy
      // several other entries in this chain use).
      overriddenDamageType = 'energy';
    }

    // Shock and Awe (Artillery Focus, 10th level): "targets of your explosive suffer a Snag on
    // their next attack or Skill Test" - reuses the exact same pending-Snag flag/consumption
    // mechanism as Debilitating Strike below (markDebilitated() / _getAutomaticCombatModifiers's
    // existing 'debilitated' flag check), since both grant an identical unconditional Snag on the
    // target's very next roll. Independent of damageBonusValue/Sneak Attack entirely - any hit
    // with an explosive-style weapon qualifies, not just a Sneak-Attack-boosted one.
    const shockAndAwe = isExplosiveAttack && actorHasPerk(actor, SHOCK_AND_AWE_ID);

    // Nowhere Is Safe (Vanguard base, 17th level) reads this once the roll resolves
    // (_applyNowhereIsSafe below) - a fact about the WEAPON (does it carry the real
    // 'multipleTargets' trait at all), not gated on how many targets this particular roll
    // happens to have, same as Trigger Happy/Gallantry's own use of this check above.
    const isMultipleTargetsWeaponAttack = isMultipleTargetsWeapon(actor, item);

    // Psychoanalyst - a non-weaponEffect Skill Test that still needs to feed the ordinary
    // damageValue/damageType -> Apply Damage button pipeline below, the same "synthetic attack"
    // shape dataset.dif already uses to give a flat-Difficulty check its own checkEntries.
    const psychoanalystDamage = skillRollOptions.applyPsychoanalyst ? { value: 2, type: 'stun' } : null;

    // Coax Surrender - see COAX_SURRENDER_ID's own comment above. Same synthetic-damage shape as
    // Psychoanalyst just above, its own printed 1 Stun instead of 2.
    const coaxSurrenderDamage = skillRollOptions.applyCoaxSurrender ? { value: 1, type: 'stun' } : null;

    // Grinder - see GRINDER_ID's own comment above. Same synthetic-damage shape as
    // Psychoanalyst/Coax Surrender just above.
    const grinderDamage = skillRollOptions.applyGrinder ? { value: 2, type: 'blunt' } : null;

    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above. Same synthetic-damage
    // shape as Psychoanalyst just above.
    const deceptiveWarfareDamage = skillRollOptions.applyDeceptiveWarfare ? { value: 1, type: 'psychic' } : null;

    // Terrifying Presence - the "Inflict 1 additional damage" option (see TERRIFYING_PRESENCE_ID's
    // own comment above; terrifyingPresenceRider was already resolved, and gated, at the top of
    // this method). Same synthetic-damage shape as Deceptive Warfare just above - Growl/Frightening
    // Display (this Perk's own two usual triggers) roll with no weaponEffect Item at all, so this
    // has to land in the same null-coalescing chain damageValue/damageType read below rather than
    // damageBonusValue, which only ever applies on top of a real weaponEffect's own damage.
    // The Transformers printing's third option is 1 Stun damage ('stunDamage'), not the Stunned
    // Condition - see helpers/terrifying-presence.mjs.
    const terrifyingPresenceDamage = terrifyingPresenceRider == 'damage' ? { value: 1, type: 'psychic' }
      : (terrifyingPresenceRider == 'stunDamage' ? { value: 1, type: 'stun' } : null);

    // Explosive Morph (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45) - see
    // helpers/explosive-morph.mjs's own doc comment. Same synthetic-damage shape as Psychoanalyst
    // just above, sourced from the synthetic dataset.isExplosiveMorph flag (set at activation,
    // before the dialog) rather than a dialog checkbox.
    const explosiveMorphDamage = dataset.isExplosiveMorph ? { value: 1, type: 'element' } : null;

    // Omega Enhancement's own 3 Attack modes (Blast/Electro/Light Beam) - see
    // helpers/omega-enhancement.mjs's own doc comment. Same synthetic-damage shape as Explosive
    // Morph just above, sourced from dataset.omegaEnhancementMode (set at activation). RAW's own
    // "Energy damage" (Blast/Light Beam) maps to the generic 'element' type (no more specific
    // sub-type printed, same as most other "Energy damage" clauses this project has already
    // reclassified); Electro's own "Electricity damage" maps to the specific 'electric' key.
    const omegaEnhancementDamage = dataset.omegaEnhancementMode == 'blast' || dataset.omegaEnhancementMode == 'lightBeam'
      ? { value: 1, type: 'element' }
      : dataset.omegaEnhancementMode == 'electro' ? { value: 1, type: 'electric' } : null;

    // Menace (Cobra Codex, Bully Origin benefit, p.41) - see helpers/menace.mjs's own doc comment.
    // Same synthetic-damage shape as Explosive Morph just above, sourced from dataset.isMenace.
    const menaceDamage = dataset.isMenace ? { value: 1, type: 'stun' } : null;

    // Human Bullet (Cobra Codex, Technician Rocketeer Focus, 17th level, p.66) - see
    // helpers/human-bullet.mjs's own doc comment. Same multi-target synthetic-damage shape as
    // Explosive Morph, but the amount varies by the radius/damage tradeoff chosen at activation
    // (dataset.humanBulletDamage), not a fixed value.
    const humanBulletDamage = dataset.isHumanBullet ? { value: dataset.humanBulletDamage, type: 'fire' } : null;

    // Electric Discharge (Quartermaster's Guide to Gear, Grid Power, p.93) - see
    // helpers/electric-discharge.mjs's own doc comment. Same synthetic-damage shape as Explosive
    // Morph just above. Its own "↑1 as an Electric weapon" is applied directly on the dataset's
    // own shiftUp at activation, not via the generic Electric-damage-type core rule (which is
    // gated to real weaponEffect items and doesn't reach this item-less synthetic roll).
    const electricDischargeDamage = dataset.isElectricDischarge ? { value: 1, type: 'electric' } : null;

    // Disintegrate (Quartermaster's Guide to Gear, Grid Power, p.94) - see
    // helpers/disintegrate.mjs's own doc comment. Same synthetic-damage shape as the others above -
    // only the initial hit, not the recurring every-round half.
    const disintegrateDamage = dataset.isDisintegrate ? { value: 1, type: 'acid' } : null;

    // Energy Beam / Lancing Beam (MLP CRB, Elementary Beam spells, p.136): "Make a Spellcasting
    // Attack Test against a target within range. On a success, you deal 1 Energy damage." Unlike
    // every synthetic-damage source above, a spell IS a real Item (item.type == 'spell', not
    // null) - so this is identified by the cast spell's own sourceId, the same
    // flags.core.sourceId-vs-_stats.compendiumSource dual check weaponSourceId lookups already use
    // elsewhere, rather than a dataset flag set at a fake activation. The existing per-target
    // Defense-comparison pipeline (checkEntries/skillRollOptions.defenseType) already works for
    // any item type, not just weaponEffect (see the Non-Combat Targeting Infrastructure work) - so
    // this needs nothing but a damageValue/damageType to feed it, same shape as every Grid Power
    // above.
    // Widened to include magicBauble (Massive Mug of Mammoth Measurements/Petite Pony's Shrink
    // Drink, Knights of Canterlot p.52) - a Magic Bauble is rolled through this exact same
    // Spellcasting Skill Test path (documents/item.mjs's magicBauble branch), it just isn't a
    // spell Item type, so it needs to be recognized here too for its own post-roll effect to
    // apply at all. The variable name stays 'spellSourceId' (not renamed to something more
    // generic) to keep this a minimal, easy-to-follow diff against every existing check below.
    const spellSourceId = (item?.type == 'spell' || item?.type == 'magicBauble')
      ? (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) : null;

    // A spell's OWN authored damage (spell.mjs's system.damageValue/damageType). Every entry
    // below this one is keyed to a specific compendium id, which meant a homebrew attack spell -
    // or any of the many printed ones nobody has hardcoded yet - could never deal damage at all.
    // This reads the schema instead, so it works for any spell whatsoever, and is checked FIRST
    // in the ?? chains below so an authored value beats the legacy per-id table. No compendium
    // spell carries an authored damageValue today (the field defaults to 0, which is falsy here),
    // so nothing existing changes until those entries are migrated onto the schema one by one.
    // Authored damage on a spell OR a Power - both carry the same attack fields (see
    // data/attack-schema.mjs). The Power half is what the Sorcerous attack Powers use: Arcane
    // Blast, Fireball, Volcanic Eruption, Icy Breath and Aura of Decay each print an attack Skill,
    // a damage value and a damage type, and before this they had nowhere to put any of it.
    const authoredSpellDamage = (item?.type == 'spell' || item?.type == 'power') && item.system.damageValue
      ? { value: item.system.damageValue, type: item.system.damageType }
      : null;
    const beamSpellDamage = (spellSourceId == ENERGY_BEAM_ID || spellSourceId == LANCING_BEAM_ID
      || spellSourceId == EXPLOSIVE_BEAM_ID) ? { value: 1, type: 'element' } : null;

    // Beam Volley (MLP CRB, Virtuoso Beam spell, p.138) - see helpers/beam-volley.mjs's own doc
    // comment. Same synthetic-damage shape as the other Beam spells above, but its own printed
    // 2 damage instead of 1.
    const beamVolleyDamage = spellSourceId == BEAM_VOLLEY_ID ? { value: 2, type: 'element' } : null;

    // Fireball (Knights of Canterlot, Superior Beam spell, p.46) - "Make a Spellcasting Attack
    // Test against a target within range. On a success... deal 2 Fire damage." Same synthetic-
    // damage shape as the other Beam spells, but its own printed damage type (Fire, not
    // Energy/Element).
    const kocFireballDamage = spellSourceId == KOC_FIREBALL_ID ? { value: 2, type: 'fire' } : null;

    // Power Blast (PR CRB, Grid Power, p.100) - see helpers/power-blast.mjs's own doc comment.
    // Same synthetic-damage shape as Psychoanalyst/Explosive Morph above, scaled by however much
    // Power was actually spent (threaded through dataset.powerBlastAmount at activation).
    const powerBlastDamage = dataset.isPowerBlast ? { value: dataset.powerBlastAmount, type: 'element' } : null;

    // Morphblast (A Jump Through Time, Grid Power, p.58) - see helpers/morphblast.mjs's own doc
    // comment. Same synthetic-damage shape as Explosive Morph, just a fixed 1 Energy damage.
    const morphblastDamage = dataset.isMorphblast ? { value: 1, type: 'element' } : null;

    const checkContext = checkEntries
      ? {
        entries: checkEntries,
        // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
        // helpers/phantom-suite.mjs's own doc comment for why _rollSkillHelper's post-hit
        // processing needs to know which Defense this attack was actually compared against
        // (rather than re-deriving it from the item), the same "a fact about the roll, threaded
        // through checkContext" shape effectName/alternateEffects below already use. Reads the
        // first target's own resolvedDefenseType (see helpers/defense-choice.mjs) - the actual
        // Defense that target's own owner/GM chose, not just the weapon's suggested default;
        // this is a single roll-level fact, so a multi-target attack whose targets happened to
        // choose different Defenses is represented by whichever target is first, the same
        // "one combined fact per roll" simplification every other entry in this object accepts.
        defenseType: checkEntries[0]?.defenseType ?? skillRollOptions.defenseType,
        // Terror (Beneath the Helmet, Dark Ranger, 1st level, p.39) - see helpers/terror.mjs's
        // own doc comment for the accrual half this threads into, in _rollSkillHelper below.
        wasEdge: skillRollOptions.edge,
        // Get The Horns (Cobra Codex, Vanguard Warthog Focus, 10th level, p.69) - see
        // GET_THE_HORNS_ID's own comment above. Same "a fact about the roll, threaded through
        // checkContext" shape as wasEdge just above - _rollSkillHelper's post-hit processing
        // needs to know Growl's own bonus actually applied to THIS roll, since the flag itself
        // is already cleared (pendingBonusesToClear, above) by the time that post-hit code runs.
        wasGrowlApplied: combatModifiers.sources.some(source => source.id == 'growl'),
        // Brazen Strike (A Jump Through Time, Grid Power, p.57) - see isUnarmedAttack's own
        // comment above.
        isUnarmedAttack,
        damageValue: item?.type == 'weaponEffect'
          ? (guardianStrikesForgoDamage || stickInTheSpokesForgoDamage || interdictionForgoDamage
            ? 0
            : (hasTitanBodyDamageFloor ? Math.max(item.system.damageValue, 3) : item.system.damageValue)
              // Surging doubles the element damage (see surgingAvailable above).
              * (skillRollOptions.applySurging ? 2 : 1)
              + damageBonusValue)
          : (authoredSpellDamage?.value ?? psychoanalystDamage?.value ?? coaxSurrenderDamage?.value ?? grinderDamage?.value ?? deceptiveWarfareDamage?.value ?? terrifyingPresenceDamage?.value ?? explosiveMorphDamage?.value ?? omegaEnhancementDamage?.value ?? menaceDamage?.value ?? humanBulletDamage?.value ?? electricDischargeDamage?.value ?? disintegrateDamage?.value ?? beamSpellDamage?.value ?? beamVolleyDamage?.value ?? kocFireballDamage?.value ?? powerBlastDamage?.value ?? morphblastDamage?.value ?? null),
        // Read by _rollSkillHelper to build each result's own damageBonusLabel - kept as the raw
        // bonus amount and its source names rather than a pre-built label here, since the actual
        // per-target amount still needs scaling by that target's own Degrees of Success
        // multiplier (see _rollSkillHelper's damageValue: ... * multiplier just below it).
        damageBonusValue: item?.type == 'weaponEffect' ? damageBonusValue : 0,
        damageBonusSources: [...damageBonusSources],
        damageType: item?.type == 'weaponEffect'
          ? (overriddenDamageType ?? item.system.damageType)
          : (authoredSpellDamage?.type ?? psychoanalystDamage?.type ?? coaxSurrenderDamage?.type ?? grinderDamage?.type ?? deceptiveWarfareDamage?.type ?? terrifyingPresenceDamage?.type ?? explosiveMorphDamage?.type ?? omegaEnhancementDamage?.type ?? menaceDamage?.type ?? humanBulletDamage?.type ?? electricDischargeDamage?.type ?? disintegrateDamage?.type ?? beamSpellDamage?.type ?? beamVolleyDamage?.type ?? kocFireballDamage?.type ?? powerBlastDamage?.type ?? morphblastDamage?.type ?? null),
        // The weaponEffect's own second damage component (weapon-effect.mjs's secondaryDamage),
        // dropped along with the main damage whenever a Perk forgoes it.
        secondaryDamage: getSecondaryDamage(item,
          guardianStrikesForgoDamage || stickInTheSpokesForgoDamage || interdictionForgoDamage),
        // Plate Piercing (Artillery Focus, 10th level) - read by _applyPlatePiercingVehicleDamage
        // once the roll resolves, the same "a fact about the attack, threaded through
        // checkContext rather than re-derived from item" shape as effectName/alternateEffects
        // below (checkContext, not a raw item reference, is what actually crosses into
        // _rollSkillHelper - see that function's own doc comment).
        isExplosiveAttack,
        isMultipleTargetsWeapon: isMultipleTargetsWeaponAttack,
        debilitatingStrike,
        shockAndAwe,
        isWatchfulEyesAttempt,
        isWtnvRallyingCryAttempt,
        weaponImplantTier,
        isBolsterDefenseAttempt,
        bolsterDefenseMode,
        bolsterDefenseType,
        bolsterDefenseTargetUuid,
        isChronomanticPulseAttempt,
        chronomanticPulseInitiative,
        chronomanticPulseTargetUuid,
        isJuryRigAttempt,
        juryRigOption,
        juryRigTargetUuid,
        juryRigStandardAction,
        isImproviseArmorAttempt,
        improviseArmorTargetUuid,
        isSpotWeldAttempt,
        spotWeldTargetUuid,
        spotWeldHealAmount,
        isUndoEngineCheckAttempt,
        undoEngineVehicleUuid,
        isMartialLeadershipAttempt,
        martialLeadershipTargetUuid,
        isVoiceOfPrimusAttempt,
        voiceOfPrimusTargetUuid,
        isVoiceOfPrimusAssistAttempt,
        isRemoteOperationsAttempt,
        // Misled (MLP CRB, Mentor Influence Hang-Up, p.53) - see MISLED_HANGUP_ID's own comment
        // below. The assister's own uuid, threaded through from where the Lend Assistance shift
        // itself was consumed above, so the post-roll processing can check it on a failure.
        lendAssistanceAssisterUuid,
        isAvastAttempt,
        avastTargetUuid,
        isWordsCanHurtAttempt,
        wordsCanHurtTargetUuid,
        isSideSplitterAttempt,
        sideSplitterTargetUuid,
        isCalmingWordsAttempt,
        calmingWordsTargetUuid,
        calmingWordsAction,
        isLuckyCharmAttempt,
        luckyCharmItemUuid,
        isHumanitarianAttempt,
        isWeldsRivetsAndIdeasAttempt,
        isEnchantAttempt,
        enchantSkill,
        isBestowExpertiseAttempt,
        bestowExpertiseSkill,
        bestowExpertiseName,
        mindBeamEffect,
        isGetToKnowAttempt,
        getToKnowSkill,
        spellSourceId,
        triggerHappy: isTriggerHappyAttack,
        isExplosiveAftershockAttack,
        // Empty the Mag - applied a second time, per hit target, once the roll resolves (see
        // _applyEmptyTheMag below) - so only the player's own dialog checkbox matters here, not
        // a re-check of eligibility (already confirmed by emptyTheMagAvailable pre-filling it).
        emptyTheMag: !!skillRollOptions.emptyTheMag,
        // Psycho Slinger - see PER_TWO_HITS_EFFECT_IDS' own comment above.
        perTwoHitsEffectId: item?.type == 'weaponEffect' && isPerTwoHitsEffect(item) ? item.id : null,
        // "Critical Effect: Triples base damage instead of double" (Energy Sword Time Strike,
        // helpers/summons.mjs) - see _applyCritMultiplier below.
        critMultiplier: item?.type == 'weaponEffect' ? (item.flags?.essence20?.critMultiplier ?? null) : null,
        // Hobble (Decepticon Directive Raider, Acquisitions Expert Focus, 20th level, p.63) - see
        // HOBBLE_ID's own comment above. The downshift itself already happened via
        // skillRollOptions.applyHobble above; this just carries the declared attempt through to
        // _rollSkillHelper's post-hit Condition-picker.
        hobbleAttempt: !!skillRollOptions.applyHobble,
        // Attacking Space Vessel Systems - carried through to the Critical Effect picker.
        targetVesselSystemAttempt: isTargetVesselSystemAttempt,
        // Repairing a Space Vessel Condition (helpers/vessel-conditions.mjs#openVesselRepairDialog).
        repairVesselUuid: dataset.repairVesselUuid ?? null,
        repairVesselCondition: dataset.repairVesselCondition ?? null,
        // Crippling Blow - see CRIPPLING_BLOW_ID's own comment above. Same "already downshifted,
        // just carry the declared attempt through" shape as Hobble just above.
        cripplingBlowAttempt: !!skillRollOptions.applyCripplingBlow,
        // Dirty Blows - see DIRTY_BLOWS_ID's own comment above. No shift to declare, just carries
        // the checkbox through to _rollSkillHelper's post-hit Impaired application.
        dirtyBlowsAttempt: !!skillRollOptions.applyDirtyBlows,
        // Grinder - see GRINDER_ID's own comment above. Carries the declared attempt through to
        // _rollSkillHelper's post-hit Critical Success Impaired check.
        isGrinderAttempt: !!skillRollOptions.applyGrinder,
        // Bump & Run - see BUMP_AND_RUN_ID's own comment above. The upshift itself already
        // happened via skillRollOptions.applyBumpAndRun above; this just carries the declared
        // attempt through to _rollSkillHelper's post-hit Stun-on-Critical-Success check.
        bumpAndRunAttempt: !!skillRollOptions.applyBumpAndRun,
        // Get A Grip - see GET_A_GRIP_ID's own comment above. Carries the declared attempt through
        // to _rollSkillHelper's own post-hit Size Class check and Free-action spend.
        getAGripAttempt: !!skillRollOptions.applyGetAGrip,
        // Cost of Sorcery - see COST_OF_SORCERY_ID's own comment above. Read back on a Fumble,
        // right alongside Cruel Warlord/Bad Temper/Something To Prove's own isFumble checks.
        isSorcerousAttempt,
        noFightingSnagApplied,
        // Cryogenic Touch (A Jump Through Time, Grid Power, p.57) - see checkContext's own
        // cryogenicTouchAttempt consumption in _rollSkillHelper below.
        cryogenicTouchAttempt: !!skillRollOptions.applyCryogenicTouch,
        // Guardian Strikes (A Jump Through Time, Grid Power, p.57) - see checkContext's own
        // guardianStrikesAttempt consumption in _rollSkillHelper below.
        guardianStrikesAttempt: guardianStrikesForgoDamage,
        stickInTheSpokesAttempt: stickInTheSpokesForgoDamage,
        interdictionAttempt: interdictionForgoDamage,
        // Sudden Death (Blitzer Focus, 20th level, p.98) - "when you successfully hit with a
        // Might melee attack against a target whose Threat Level is equal to or less than your
        // level, you can choose to defeat them instead of dealing damage." Only the weapon-type
        // half of that check (a fact about the attack, not about any specific target) belongs
        // here - the Perk check, once-per-combat gate, and per-target Threat Level compare all
        // happen at apply-damage time instead (chat.mjs#onApplyDamage), once the actual target
        // is known, same division of labor as every other chat.mjs-side Perk check.
        isMightMelee: item?.type == 'weaponEffect'
          && item.system.classification.skill == 'might' && item.system.classification.style == 'melee',
        // Analyze Target (Analyst, 1st level, p.59) - see ANALYZE_TARGET_ID's own comment above.
        // Not gated on weaponEffect - Analyze Target is a plain Alertness Skill Test.
        isAnalyzeTarget: !!skillRollOptions.applyAnalyzeTarget,
        // Stunning Surprise (Prowler Focus, 1st level, p.86): "When you attack a creature who is
        // unaware of your exact location, your attack deals Stun 1 in addition to its normal
        // effect." This only flags that the Perk is in play; the "unaware of your exact location"
        // half is checked per hit target in _rollSkillHelper below, against the two statuses this
        // system tracks for it (the target Surprised, or the attacker Invisible) - see
        // _isUnawareOfAttacker.
        stunningSurpriseStun: item?.type == 'weaponEffect' && actorHasPerk(actor, STUNNING_SURPRISE_ID),
        // Roaming the Land - see ROAMING_THE_LAND_ID's own comment above. "Larger Creatures" Stun
        // half only (the "smaller creatures" damage half is folded into damageBonusValue above) -
        // the actual Size comparison against the specific hit target happens per-result below,
        // since a multi-target roll could hit differently-sized creatures.
        roamingTheLandStun: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee'
          && roamingTheLandPerk?.system.choice == 'largerStun',
        // Spot (Weapon Effects and Traits): "Lend Assistance to allies at range" - a weaponEffect
        // with this as its own damageType is fired instead of a weapon's normal attack (the same
        // Alternate Effect mechanism Cold/Laser/Sonic's own "gain an alternate effect" clauses
        // already rely on, see _getAlternateEffects's own doc comment) to mark a target rather
        // than damage them. Unconditional whenever this specific effect is rolled - no Perk gates
        // it, the same "the effect's own existence is the grant" shape Barrel Through/Electric's
        // core-rule checks above use. The actual "next attack against them gains an Edge" grant is
        // read back in _getAutomaticCombatModifiers, see its own comment there for why this is a
        // narrower, weapon-triggered slice of the Combat Actions chapter's own broader Lend
        // Assistance Standard action (p.197) rather than that whole action - this system has no
        // generic "Combat Actions" menu (Defend/Hide/Search the Area/Sprint/etc. aren't modeled
        // either), so only the concretely-needed piece is built here.
        isSpotAttempt: item?.type == 'weaponEffect' && item.system.damageType == 'spot',
        // Undo Engine - see UNDO_ENGINE_ID's own comment above. Unconditional whenever the roller
        // holds the Perk and rolls a weaponEffect Attack - no player choice involved, RAW triggers
        // automatically off a Critical Success. Read back in _rollSkillHelper's post-hit
        // processing below, which checks the target actually IS a vehicle before doing anything.
        isUndoEngineAttempt: item?.type == 'weaponEffect' && actorHasPerk(actor, UNDO_ENGINE_ID),
        // Leech Siphons - see LEECH_SIPHONS_ID's own comment above.
        isLeechSiphonsAttempt: item?.type == 'weaponEffect' && !!this._getParentWeapon(actor, item)
          && actor.items.some(actorItem => actorItem.type == 'upgrade'
            && actorItem.flags?.essence20?.parentId == this._getParentWeapon(actor, item).id
            && (actorItem.flags?.core?.sourceId ?? actorItem._stats?.compendiumSource ?? actorItem?.flags?.essence20?.rulesSource) == LEECH_SIPHONS_ID),
        // Ice Flechettes - see ICE_FLECHETTES_EFFECT_IDS's own comment above. Identity-keyed on
        // the weaponEffect item itself, unlike Leech Siphons above - this is a fixed monster
        // attack, not an attached Upgrade or held Perk.
        // Matched on the effect's compendium source too - an owned copy has its own uuid.
        isIceFlechettesAttempt: item?.type == 'weaponEffect'
          && [item.uuid, item.flags?.core?.sourceId, item._stats?.compendiumSource].some(id => ICE_FLECHETTES_EFFECT_IDS.includes(id)),
        // Avalanche Stomp (weapon copy) - see AVALANCHE_STOMP_WEAPON_EFFECT_ID's own comment
        // above. Same identity-keyed shape as Ice Flechettes just above.
        isAvalancheStompWeaponAttempt: item?.type == 'weaponEffect'
          && [item.uuid, item.flags?.core?.sourceId, item._stats?.compendiumSource, item.flags?.essence20?.rulesSource].includes(AVALANCHE_STOMP_WEAPON_EFFECT_ID),
        // Catch Off Guard - see CATCH_OFF_GUARD_ID's own comment above. Computed in
        // _getAutomaticCombatModifiers (needs the resolved target + isAttack together), read back
        // here the same way spottedTarget/eyeForAppraisalTarget already are.
        isCatchOffGuardAttempt: combatModifiers.isCatchOffGuardAttempt,
        // Extra Rough Training - see helpers/extra-rough-training.mjs's own doc comment. Same
        // synthetic-dataset-flag shape as Duty Of The Graphite/Absolute Menace, read in
        // _rollSkillHelper's post-hit processing to bank Edge (success) or shiftUp 1 (failure).
        isExtraRoughTrainingAttempt: !!dataset.isExtraRoughTrainingAttempt,
        extraRoughTrainingSkill: dataset.extraRoughTrainingSkill ?? null,
        // Hup! Hup! Hup! Hup! Hup! - see helpers/hup-hup-hup-hup-hup.mjs's own doc comment. Same
        // synthetic-dataset-flag shape as Extra Rough Training just above.
        isHupHupHupHupHupAttempt: !!dataset.isHupHupHupHupHupAttempt,
        // Menacing Glare - see MENACING_GLARE_ID's own comment above.
        isMenacingGlareAttempt,
        // Instill Weakness - see INSTILL_WEAKNESS_ID's own comment above.
        isInstillWeaknessAttempt,
        // Deconstructionist - see DECONSTRUCTIONIST_ID's own comment above.
        isDeconstructionistAttempt,
        // No Factor - see NO_FACTOR_ID's own comment above.
        isNoFactorAttempt,
        // Withering Fire - see WITHERING_FIRE_ID's own comment above.
        isWitheringFireAttempt,
        // Unlucky (For You) (Dark Ranger, 13th level, p.40) - see
        // helpers/unlucky-for-you.mjs's own doc comment. A plain "was this attack" flag, read in
        // _rollSkillHelper's post-hit processing below.
        isAttack: item?.type == 'weaponEffect',
        // Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58) - see
        // helpers/frenzied-attack.mjs's own doc comment and chat.mjs#addFrenziedAttackButton. The
        // button has to roll this SAME weaponEffect Item again, so its identity is stamped here
        // the same way isAttack itself is, rather than trying to re-derive it later from the
        // message content.
        itemUuid: item?.uuid ?? null,
        // Absolute Menace (Dark Ranger, 18th level, p.40) - see helpers/absolute-menace.mjs's own
        // doc comment. Stamped via a synthetic dataset.isAbsoluteMenace field (the same
        // minimal-dataset shape helpers/consummate-performer.mjs's own activateConsummatePerformer
        // already uses to flag its own roll), read in _rollSkillHelper's post-hit processing below
        // to apply Frightened to every successfully-hit enemy.
        isAbsoluteMenaceAttempt: !!dataset.isAbsoluteMenace,
        // Avalanche Stomp (Finster's Monster-Matic Cookbook, Path of Stone, 9th level, p.296) -
        // see helpers/avalanche-stomp.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Absolute Menace above, read in _rollSkillHelper's post-hit processing to Stun (and, on a
        // Critical Success, also Prone) every successfully-hit creature.
        isAvalancheStompAttempt: !!dataset.isAvalancheStomp,
        // Voice of Night Vale (WTNV Citizens' Guide, General Perk, p.47) - see
        // helpers/surprise.mjs's own doc comment. Same synthetic-dataset-flag shape as Absolute
        // Menace above, read in _rollSkillHelper below to Surprise every successfully-hit enemy.
        isVoiceOfNightValeAttempt: !!dataset.isVoiceOfNightVale,
        // Nemesis Drain (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 7th level) - see
        // helpers/nemesis-drain.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Absolute Menace above, read in _rollSkillHelper's post-hit processing.
        isNemesisDrainAttempt: !!dataset.isNemesisDrain,
        // Frightening Display (Enigma of Combination, Cannoneer Focus, Gunner, 10th level, p.32) -
        // see helpers/frightening-display.mjs's own doc comment. Same synthetic-dataset-flag shape
        // as Absolute Menace above, read in _rollSkillHelper's post-hit processing to Frighten
        // every successfully-hit enemy. The two-handed-ballistic-weapon precondition is dropped,
        // same "trust the player to use it at the right narrative moment" idiom this project
        // already applies to several similarly-gated Perks.
        isFrighteningDisplayAttempt: !!dataset.isFrighteningDisplay,
        // Terrifying Presence - see TERRIFYING_PRESENCE_ID's own comment above. Read back in the
        // post-hit results loop below to apply the chosen Frightened/Stunned rider (the "+1
        // damage" option was already folded into damageBonusValue above).
        terrifyingPresenceRider,
        // Elemental Storm (Aqua Ranger, 10th level, p.42) - see helpers/elemental-storm.mjs's own
        // doc comment. Same synthetic-dataset-flag shape as Absolute Menace above, but also carries
        // WHICH of the 3 named Conditions to apply (chosen up front by the player, before the roll
        // - unlike Menacing Glare's own per-target post-hit picker), read in _rollSkillHelper's
        // post-hit processing below.
        isElementalStormAttempt: !!dataset.isElementalStorm,
        elementalStormCondition: dataset.elementalStormCondition,
        // Outwit (Focus: Battlefield Psychologist, 3rd level, p.86) - see helpers/outwit.mjs's
        // own doc comment. Same synthetic-dataset-flag/single-target shape as Duty Of The
        // Graphite above, but also carries WHICH Condition to apply (chosen up front, same shape
        // as Elemental Storm above), read in _rollSkillHelper's post-hit processing below.
        isOutwitAttempt: !!dataset.isOutwit,
        outwitCondition: dataset.outwitCondition,
        // Fearsome Presence (Renegade base, 14th level, p.97) - see
        // helpers/fearsome-presence.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Absolute Menace above, read in _rollSkillHelper's post-hit processing to apply
        // Frightened to every successfully-hit target (however many the player chose to target).
        isFearsomePresenceAttempt: !!dataset.isFearsomePresence,
        // Duty Of The Graphite (Graphite Ranger, 7th level, p.47) - see
        // helpers/duty-of-the-graphite.mjs's own doc comment. Same synthetic-dataset-flag shape
        // as Absolute Menace above, read in _rollSkillHelper's post-hit processing to apply
        // Blinded on a successful arrival check.
        isDutyOfTheGraphiteAttempt: !!dataset.isDutyOfTheGraphite,
        // I've Got You (GI Joe CRB, Focus: Medic, 7th level, p.82) - see
        // helpers/i-ve-got-you.mjs's own doc comment. Same synthetic-dataset-flag shape as Duty Of
        // The Graphite above, plus the player-chosen Health amount threaded alongside it.
        isIveGotYouAttempt: !!dataset.isIveGotYou,
        iveGotYouAmount: dataset.iveGotYouAmount,
        // Mind Over Matter (GI Joe CRB, Focus: Battlefield Psychologist, 6th level, p.86) - see
        // helpers/mind-over-matter.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // I've Got You just above.
        isMindOverMatterAttempt: !!dataset.isMindOverMatter,
        mindOverMatterAmount: dataset.mindOverMatterAmount,
        // Regeneration (Quartermaster's Guide to Gear, Grid Power, p.94) - see
        // helpers/regeneration.mjs's own doc comment. Same synthetic-dataset-flag shape as I've
        // Got You/Mind Over Matter above.
        isRegenerationAttempt: !!dataset.isRegeneration,
        regenerationAmount: dataset.regenerationAmount,
        // Patch Up (Transformers CRB, Focus: Medic, 1st level, p.82) - see
        // helpers/patch-up.mjs's own doc comment. Same synthetic-dataset-flag/player-chosen-
        // amount shape as Regeneration above, via the shared helpers/heal-skill-test.mjs
        // primitive.
        isPatchUpAttempt: !!dataset.isPatchUp,
        patchUpAmount: dataset.patchUpAmount,
        // Preventative Measures (Transformers CRB, Focus: Medic, 6th level, p.82) - see
        // helpers/preventative-measures.mjs's own doc comment. Same shape as Patch Up above, plus
        // the pre-picked target (converted to Temp Health rather than real Health) and a fixed
        // target rather than "whichever token is currently targeted."
        isPreventativeMeasuresAttempt: !!dataset.isPreventativeMeasures,
        preventativeMeasuresAmount: dataset.preventativeMeasuresAmount,
        preventativeMeasuresTargetUuid: dataset.preventativeMeasuresTargetUuid ?? null,
        // Tough It Out (Transformers CRB, Focus: Warrior, 5th level, p.91) - see
        // helpers/tough-it-out.mjs's own doc comment. Same shape as Patch Up above, but always
        // self-targeted.
        isToughItOutAttempt: !!dataset.isToughItOut,
        toughItOutAmount: dataset.toughItOutAmount,
        // Stand Together (Transformers CRB, Field Commander, 18th level, p.65) - see
        // helpers/stand-together.mjs's own doc comment. A flat DIF 15 with no player-chosen
        // amount - the post-roll handler reads this roll's own degree-of-success multiplier
        // directly off results[0], not off a dataset field.
        isStandTogetherAttempt: !!dataset.isStandTogether,
        // Dirty Trick (GI Joe CRB, Ranger Environmental Exposure choice, p.91) - see
        // helpers/dirty-trick.mjs's own doc comment. Same synthetic-dataset-flag shape as Duty Of
        // The Graphite just above.
        isDirtyTrickAttempt: !!dataset.isDirtyTrick,
        // Talk Them Down (GI Joe CRB, Spy Focus, 17th level, p.76) - see TALK_THEM_DOWN_ID's own
        // comment in banked-buffs.mjs. Same synthetic-dataset-flag shape as Duty Of The Graphite
        // just above, read in _rollSkillHelper's post-hit processing to apply Frightened + the
        // narrative surrender/drop-weapons text on a successful hit.
        isTalkThemDownAttempt: !!dataset.isTalkThemDown,
        // Omega Enhancement's own Light Beam Mode - see helpers/omega-enhancement.mjs's own doc
        // comment. Same synthetic-dataset-flag shape as Duty Of The Graphite just above, read in
        // _rollSkillHelper's post-hit processing to apply Blinded on a successful hit.
        isOmegaLightBeamAttempt: dataset.omegaEnhancementMode == 'lightBeam',
        // Distracting Offer (Cobra Codex, Corrupt Origin benefit, p.42) - see
        // helpers/distracting-offer.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Absolute Menace above, read in _rollSkillHelper's post-hit processing to record the
        // attempt's outcome (scene-gate + the target's own banked shiftDown penalty).
        isDistractingOfferAttempt: !!dataset.isDistractingOffer,
        // Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69) - see
        // helpers/growl.mjs's own doc comment. Read in _rollSkillHelper's post-hit processing to
        // bank the actor's own target-scoped shiftUp on a successful Intimidation Skill Test.
        isGrowlAttempt: !!dataset.isGrowl,
        // Tear Down (Cobra Codex, Taskmaster Focus, 3rd level, p.59) - see
        // helpers/tear-down.mjs's own doc comment. Same shape as Growl just above, read in
        // _rollSkillHelper's post-hit processing to bank the pending damage bonus on a
        // successful Intimidation Skill Test.
        isTearDownAttempt: !!dataset.isTearDown,
        // Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63) - see
        // helpers/antagonistic.mjs's own doc comment. Read in _rollSkillHelper's post-hit
        // processing to open the 2-way effect picker on a success.
        isAntagonisticAttempt: !!dataset.isAntagonistic,
        isFlyingNuisanceAttempt: !!dataset.isFlyingNuisance,
        // Face Me! (Enigma of Combination, Pillar Origin Benefit, p.27) - see
        // helpers/face-me.mjs's own doc comment. Read in _rollSkillHelper's post-hit processing to
        // bank the compulsion on the successfully-intimidated target.
        isFaceMeAttempt: !!dataset.isFaceMe,
        // Forward Observation (General Hawk's Personnel Files, General Perk, p.175) - see
        // helpers/forward-observation.mjs's own doc comment. Same synthetic-dataset-flag,
        // flat-DIF (dataset.dif) shape as Breaking Point above, but with no target at all - a
        // plain solo prep-roll check, read in _rollSkillHelper's post-hit processing to broadcast
        // a banked shiftUp to the actor and every nearby ally.
        isForwardObservationAttempt: !!dataset.isForwardObservation,
        // Hearty Meal (General Hawk's Personnel Files, General Perk, p.174) - see
        // helpers/hearty-meal.mjs's own doc comment. Same synthetic-dataset-flag, flat-DIF,
        // no-target shape as Forward Observation above.
        isHeartyMealAttempt: !!dataset.isHeartyMeal,
        // Tech Specs (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level,
        // p.22) - see helpers/tech-specs.mjs's own doc comment. Same synthetic-dataset-flag,
        // single-target shape as Duty Of The Graphite above, read in _rollSkillHelper's post-hit
        // processing to reveal the target's info and mark them for the ally-broadcast shiftUp.
        isTechSpecsAttempt: !!dataset.isTechSpecs,
        // Breaking Point (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 1st level,
        // p.23) - see helpers/breaking-point.mjs's own doc comment. Same synthetic-dataset-flag
        // shape as Tech Specs above, but this roll uses dice.mjs's own flat-DIF checkEntries
        // fallback (dataset.dif) rather than a defenseType, so the target has to be threaded
        // through separately here rather than read back off result.targetUuid.
        isBreakingPointAttempt: !!dataset.isBreakingPoint,
        breakingPointTargetUuid: dataset.breakingPointTargetUuid ?? null,
        // Deadstick (Quartermaster's Guide to Gear, Neutralizer Focus, Technician, 10th level,
        // p.26) - see helpers/deadstick.mjs's own doc comment. Same synthetic-dataset-flag,
        // single-target shape as Duty Of The Graphite above, read in _rollSkillHelper's post-hit
        // processing to apply Stunned on a successful hit.
        isDeadstickAttempt: !!dataset.isDeadstick,
        // Siphon (Transformers CRB, Focus: Technologist, 17th level, p.83) - see
        // helpers/siphon.mjs's own doc comment. Same synthetic-dataset-flag, single-target shape
        // as Deadstick above, read in _rollSkillHelper's post-hit processing to deal 1 Damage and
        // grant the actor 1 Energon Point on a successful hit.
        isSiphonAttempt: !!dataset.isSiphon,
        // Flashy (Transformers CRB, Scientist Role, 14th level, p.80) - see helpers/flashy.mjs's
        // own doc comment. Same synthetic-dataset-flag, single-target shape as Siphon just above,
        // read in _rollSkillHelper's post-hit processing to apply Blinded on a successful hit.
        isFlashyAttempt: !!dataset.isFlashy,
        // Ground Suppression (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level,
        // p.28) - see helpers/ground-suppression.mjs's own doc comment. Same synthetic-dataset-
        // flag, multi-target shape as Absolute Menace/Elemental Storm above.
        isGroundSuppressionAttempt: !!dataset.isGroundSuppression,
        isBruteForceWorksBestAttempt: isBruteForceWorksBestAttack,
        // Your Safety's On (Quartermaster's Guide to Gear, General Perk, p.31) - see
        // helpers/your-safetys-on.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Duty Of The Graphite above, read in _rollSkillHelper's post-hit processing to bank a
        // Snag (Success) or a round-scoped all-attacks Snag (Critical Success).
        isYourSafetysOnAttempt: !!dataset.isYourSafetysOn,
        // Tender (MLP CRB, Spirit of Kindness, 6th level, p.85) - see helpers/tender.mjs's own
        // doc comment.
        isTenderAttempt: !!dataset.isTender,
        // Takedown (Commando base, 5th level, p.72) - see helpers/takedown.mjs's own doc comment.
        // Same synthetic-dataset-flag/single-target shape as Duty Of The Graphite above, read in
        // _rollSkillHelper's post-hit processing to apply the Restrained/Unconscious/Grapple/
        // no-effect outcome matrix.
        isTakedownAttempt: !!dataset.isTakedown,
        // A Logical Explanation (WTNV Citizen's Guide, Scientist Role, University Of What It Is
        // Focus, p.46) - see helpers/a-logical-explanation.mjs's own doc comment. Same synthetic-
        // dataset-flag/single-target shape as Duty Of The Graphite above, read in
        // _rollSkillHelper's post-hit processing to apply Stunned on a successful Science-vs-
        // Willpower Skill Test.
        isALogicalExplanationAttempt: !!dataset.isALogicalExplanation,
        // Soothe (General Hawk's Personnel Files, General Perk, p.175) - see
        // helpers/soothe.mjs's own doc comment. Same synthetic-dataset-flag/single-target shape as
        // A Logical Explanation above, read in _rollSkillHelper's post-hit processing to apply
        // Mesmerized on a successful Animal Handling-vs-Willpower Skill Test.
        isSootheAttempt: !!dataset.isSoothe,
        // Manipulate (Field Guide to Action & Adventure, Envoy Role Perk, 1st level, p.65) - see
        // helpers/manipulate.mjs's own doc comment. Same synthetic-dataset-flag/single-target shape
        // as Soothe just above, read in _rollSkillHelper's post-hit processing to apply Grappled
        // (via applyTimedCondition, ~1 round) on a successful Persuasion-vs-Willpower Skill Test.
        isManipulateAttempt: !!dataset.isManipulateAttempt,
        // Talk Them Up (Field Guide to Action & Adventure, Envoy Role Perk, 16th level, p.68) - see
        // helpers/talk-them-up.mjs's own doc comment. Flat-DIF, threaded targetUuid (same shape as
        // Breaking Point above), read in _rollSkillHelper's post-hit processing to prompt which
        // Condition to remove from the target.
        isTalkThemUpAttempt: !!dataset.isTalkThemUp,
        talkThemUpTargetUuid: dataset.talkThemUpTargetUuid ?? null,
        // Talk Them Down (Field Guide to Action & Adventure, Envoy Role Perk, 18th level, p.68) -
        // see helpers/talk-them-down.mjs's own doc comment. Same synthetic-dataset-flag/single-
        // target shape as Soothe/Manipulate above, read in _rollSkillHelper's post-hit processing
        // to apply Defeated on a successful Persuasion-vs-Willpower Skill Test. Named distinctly
        // from GI Joe CRB's own identically-named but unrelated Talk Them Down (Spy Focus, p.76,
        // isTalkThemDownAttempt/dataset.isTalkThemDown just above) - same book-collision idiom as
        // TALK_THEM_DOWN_FGTAA_ID in banked-buffs.mjs.
        isTalkThemDownFgtaaAttempt: !!dataset.isTalkThemDownFgtaa,
        // Bumper Crop (WTNV Citizen's Guide, Farmer Role, Tiller Focus, p.37) - see
        // helpers/bumper-crop.mjs's own doc comment. Read in _rollSkillHelper's post-hit
        // processing to compute the margin of success and apply Snag to that many nearby enemies.
        isBumperCropAttempt: !!dataset.isBumperCrop,
        // Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - see
        // helpers/supreme-guardian.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Duty Of The Graphite above, read in _rollSkillHelper's post-hit processing to apply
        // Blinded to every successfully-hit Threat.
        isSupremeGuardianBlindAttempt: !!dataset.isSupremeGuardianBlind,
        // Exploit Weakness (PR CRB, Yellow Ranger, 7th/15th level, p.57) - see
        // helpers/exploit-weakness.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Absolute Menace above, read in _rollSkillHelper's post-hit processing to mark the
        // ORIGINAL melee attack's target (carried separately in exploitWeaknessTargetUuid, since
        // this roll's own checkEntries has no target at all - a flat DIF-14 Alertness Test).
        isExploitWeaknessAttempt: !!dataset.isExploitWeakness,
        exploitWeaknessTargetUuid: dataset.exploitWeaknessTargetUuid ?? null,
        // Rouse (GI Joe CRB, Officer base, 1st level, p.85) - see helpers/rouse.mjs's own doc
        // comment. Same synthetic-dataset-flag shape as Exploit Weakness above.
        isRouseAttempt: !!dataset.isRouseAttempt,
        // The weapon's traits, for the on-hit trait riders (_applyTraitRiders).
        weaponTraits: item?.type == 'weaponEffect' ? [...(this._getParentWeapon(actor, item)?.system?.traits ?? [])] : [],
        // Whether the weapon carries its own Blinding alternate effect (damageType 'blindingBlast') -
        // Strobe grants Blinding "as an alternate effect", so the trait then blinds only through it.
        weaponHasBlindingEffect: item?.type == 'weaponEffect' && hasBlindingAlternate(actor, this._getParentWeapon(actor, item)),
        attackStyle: item?.type == 'weaponEffect' ? item.system.classification?.style ?? null : null,
        // Bewildering and friends - see the criticalOptions block in _rollSkillHelper.
        critEssenceOptions: item?.type == 'weaponEffect' ? getCritEssenceOptions(this._getParentWeapon(actor, item)) : [],
        // What helpers/target-riders.mjs#applyRollRiders needs once the dice land.
        riderContext: buildRiderContext(actor, item, dataset, skillRollOptions, combatModifiers.riderConsumes),
        // The Defense the attack itself names - Unstoppable Force.
        suggestedDefenseType: item?.system?.defenseType ?? null,
        // Surging (Cobra Codex p.97) - the doubled element damage's self-hit on a natural 1.
        surging: !!skillRollOptions.applySurging,
        // Laughtracting (MLP CRB, Spirit of Laughter, p.86) - see helpers/action-perks.mjs.
        isLaughtractingAttempt: !!dataset.isLaughtracting,
        // Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86) - see
        // helpers/rousing-comeback.mjs's own doc comment. Same synthetic-dataset-flag shape as
        // Rouse just above.
        isRousingComebackAttempt: !!dataset.isRousingComebackAttempt,
        // Iron Hide (GI Joe CRB, Vanguard base, 1st level, p.107) - see helpers/iron-hide.mjs's
        // own doc comment. Same synthetic-dataset-flag shape as Rousing Comeback just above, plus
        // the damage amount to restore on a success (read back in _rollSkillHelper's own post-hit
        // processing, not here - this function only threads the flags through).
        isIronHideAttempt: !!dataset.isIronHideAttempt,
        ironHideDamage: dataset.ironHideDamage ?? 0,
        // Stay Humble (MLP Honesty, 9th level, p.78) - see STAY_HUMBLE_ID's own comment above.
        isStayHumbleAttempt: rolledSkill == 'persuasion' && actorHasPerk(actor, STAY_HUMBLE_ID),
        // Snarl - see SNARL_ID's own comment above.
        isSnarlAttempt: rolledSkill == 'intimidation' && actorHasPerk(actor, SNARL_ID),
        // Might Makes Right - see MIGHT_MAKES_RIGHT_ID's own comment above.
        isMightMakesRightAttempt: rolledSkill == 'persuasion' && actorHasPerk(actor, MIGHT_MAKES_RIGHT_ID),
        // Predacon - see PREDACON_ID's own comment above. "Conflict scene" maps onto game.combat.
        isPredaconAttempt: rolledSkill == 'intimidation' && !!game.combat && actorHasPerk(actor, PREDACON_ID),
        // Supportive Friend / Extra Supportive Friend / Super Supportive Friend (MLP CRB, Spirit
        // of Kindness, 7th/13th/18th level, p.85-86) - see SUPPORTIVE_FRIEND_ID's own comment
        // above. Checked highest-tier-first; only meaningful when the roll actually used the
        // actor's own chosen Empathy skill.
        supportiveFriendTier: (() => {
          const empathyPerk = findPerk(actor, EMPATHY_MLP_ID);
          if (!empathyPerk?.system.choice || rolledSkill != empathyPerk.system.choice) {
            return null;
          }

          if (actorHasPerk(actor, SUPER_SUPPORTIVE_FRIEND_ID)) return 'super';
          if (actorHasPerk(actor, EXTRA_SUPPORTIVE_FRIEND_ID)) return 'extra';
          if (actorHasPerk(actor, SUPPORTIVE_FRIEND_ID)) return 'base';
          return null;
        })(),
        // Everything is Inspiration (Hobbyist Origin, p.32) - see EVERYTHING_IS_INSPIRATION_ID's
        // own comment above. Unlike Stay Humble (Persuasion-only, unlimited), this applies to ANY
        // Skill Test but is capped at once per scene - checked here (before the roll even happens)
        // so a scene that's already used this up skips the check entirely; the actual mark-used
        // happens alongside the grant itself in _rollSkillHelper's post-roll processing below.
        isEverythingIsInspirationAttempt: actorHasPerk(actor, EVERYTHING_IS_INSPIRATION_ID)
          && !hasUsedThisEncounter(actor, 'everythingIsInspirationUsedThisEncounter'),
        // Outfoxed (MLP Tricky Hang-Up, p.63) - see OUTFOXED_ID's own comment above. Any failed
        // result on this Infiltration roll counts, per-target, applied in _rollSkillHelper's
        // post-roll processing below.
        isOutfoxedAttempt: rolledSkill == 'infiltration' && actorHasPerk(actor, OUTFOXED_ID),
        // Shoots and Scores (MLP Sporty Influence, p.60) - see SHOOTS_AND_SCORES_ID's own comment
        // above. Checked against the roll's own multiplier (Critical Success), applied in
        // _rollSkillHelper's post-roll processing below.
        isShootsAndScoresAttempt: rolledSkill == 'athletics' && actorHasPerk(actor, SHOOTS_AND_SCORES_ID),
        // Vibrating Palm - see VIBRATING_PALM_ID's own comment above. Checked against the roll's
        // own multiplier (Critical Success), applied in _rollSkillHelper's post-roll processing
        // below.
        isVibratingPalmAttempt: item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
          && actorHasPerk(actor, VIBRATING_PALM_ID) && !hasUsedThisEncounter(actor, VIBRATING_PALM_GRANT_ENCOUNTER_FLAG),
        // 'Til All Are One (Enigma of Combination, Origin Benefit, p.28) - see
        // TIL_ALL_ARE_ONE_ID's own comment above. Any Skill Test (not scoped to one skill, unlike
        // Shoots and Scores just above), once per scene.
        isTilAllAreOneAttempt: actorHasPerk(actor, TIL_ALL_ARE_ONE_ID)
          && !hasUsedThisEncounter(actor, 'tilAllAreOneUsedThisEncounter'),
        // But I Should Know That (Knights of Canterlot, Spell Scribe Hang-Up, p.34) - see
        // BUT_I_SHOULD_KNOW_THAT_ID's own comment above.
        isButIShouldKnowThatAttempt: rolledSkill == 'spellcasting' && actorHasPerk(actor, BUT_I_SHOULD_KNOW_THAT_ID),
        // Instinctual Caster (Knights of Canterlot, Hedge Wizard Hang-Up, p.35) - see
        // INSTINCTUAL_CASTER_ID's own comment above. Gated on item?.type == 'spell' (not just
        // rolledSkill == 'spellcasting') since RAW specifically says "fail to cast A SPELL" - a
        // plain Spellcasting Skill Test with no spell Item attached (if that's even possible in
        // this system) wouldn't count.
        isInstinctualCasterAttempt: item?.type == 'spell' && actorHasPerk(actor, INSTINCTUAL_CASTER_ID),
        // Devastating Strike (Yellow Ranger, 18th level, p.57) - see DEVASTATING_STRIKE_ID's own
        // comment above. Any melee attack skill, unlike isMightMelee above (Sudden Death is
        // Might-specific; Devastating Strike isn't).
        isMelee: item?.type == 'weaponEffect' && item.system.classification.style == 'melee',
        // Jack Of All Trades - see updatedShiftDataset.jackOfAllTradesAvailable's own comment
        // above. Read in _rollSkillHelper's own isCrit computation.
        suppressCrit: !!skillRollOptions.suppressCrit,
        // Sucker Punch - see SUCKER_PUNCH_ID's own comment above. The round/once-per-scene/no-
        // parent-weapon preconditions don't vary by target, so they're all resolved here, once
        // per roll; the "target hasn't acted yet" half is necessarily per-entry and lives in
        // _rollSkillHelper's own results.map() instead.
        isSuckerPunchEligible: item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
          && actorHasPerk(actor, SUCKER_PUNCH_ID) && game.combat?.round == 1
          && !hasUsedThisEncounter(actor, SUCKER_PUNCH_ENCOUNTER_FLAG),
        // Critical Success (p.205): "the attacker chooses to stack on an additional attack
        // effect... it may instead have the option of applying an alternate effect from the
        // attack's listed options" (Table 8-3.1's "Alternate Effects" column). A weapon's
        // Alternate Effects are separate weaponEffect Items sharing this one's parentId flag
        // (see attachment-handler.mjs#createItemCopies, which tags every weaponEffect copied
        // from the same weapon with that weapon's _id).
        effectName: item?.type == 'weaponEffect' ? item.name : null,
        alternateEffects: item?.type == 'weaponEffect' ? this._getAlternateEffects(actor, item) : [],
        // Temperamental (Quartermaster's Guide to Gear p.35; weapon AND weapon-upgrade trait) -
        // see its own check in _rollSkillHelper below for the RAW quote. Resolved here (where
        // `item` is in scope) rather than there, and carried as the weapon's own name (or null)
        // so _rollSkillHelper doesn't need its own parentWeapon/actor.items lookup.
        temperamentalWeaponName: (() => {
          if (item?.type != 'weaponEffect') {
            return null;
          }

          const temperamentalWeapon = this._getParentWeapon(actor, item);
          if (!temperamentalWeapon) {
            return null;
          }

          const hasTemperamentalUpgrade = actor.items.some(actorItem =>
            actorItem.type == 'upgrade' && actorItem.flags?.essence20?.parentId == temperamentalWeapon.id
            && actorItem.system?.traits?.includes('temperamental'));
          return (temperamentalWeapon.system.traits?.includes('temperamental') || hasTemperamentalUpgrade)
            ? temperamentalWeapon.name
            : null;
        })(),
        // Xenotech (weapon trait) - see its own Snag check in _getAutomaticCombatModifiers above.
        // The actual Item (not just its name) is carried through so _rollSkillHelper's own isCrit
        // handling can setFlag directly on it, the first Critical Success achieved with it.
        xenotechWeaponToMark: item?.type == 'weaponEffect'
          && this._getParentWeapon(actor, item)?.system.traits?.includes('xenotech')
          ? this._getParentWeapon(actor, item)
          : null,
        // Xenotech Components - see its own check just below (_rollSkillHelper's post-roll
        // processing) for the RAW quote. Same "carry the Item itself" shape as
        // xenotechWeaponToMark just above.
        componentsWeaponToMark: item?.type == 'weaponEffect'
          && this._getParentWeapon(actor, item)?.system.traits?.includes('components')
          ? this._getParentWeapon(actor, item)
          : null,
      }
      : null;

    // Multiple Targets (X, range/area) (p.198) - see isMultipleTargetsWeapon's own doc comment
    // for the Blast/AoE distinction. Only kicks in with 2+ actual targets - a single target (or
    // none) has nothing to roll "independently" against, so it rolls exactly like any other
    // attack below.
    const isMultipleTargetsAttack = checkEntries?.length > 1 && isMultipleTargetsWeaponAttack;

    // Repeat the roll as many times as specified in the skill roll options dialog
    // Every _rollSkillHelper outcome from this call: one per repeat, and one per target on a
    // multiple-targets attack. Collected rather than returning just the last, because a caller
    // asking "did this succeed" for a multi-roll attack needs to see all of them.
    const rollOutcomes = [];

    // Fanning - a volley replaces the repeat count with one roll per shot, each with its own
    // formula and shift (see fanningVolley's own comment above).
    const rollCount = fanningVolley.length || skillRollOptions.timesToRoll;
    for (let i = 0; i < rollCount; i++) {
      const fanningShot = fanningVolley[i] ?? null;
      if (fanningShot?.autoFail) {
        this._handleAutoFail(fanningShot.shift, label, actor);
        await applyWreckerOnAutoFail(actor, item, game.user?.targets);
        break;
      }

      const shotFormula = fanningShot?.formula ?? formula;
      const shotFinalShift = fanningShot?.shift ?? finalShift;
      let repeatText = '';
      if (fanningShot) {
        repeatText = this._i18n.format("E20.RollFanningShotText", {
          index: i + 1,
          total: rollCount,
        }) + '<br>';
      } else if (skillRollOptions.timesToRoll > 1) {
        repeatText = this._i18n.format("E20.RollRepeatText", {
          index: i + 1,
          total: skillRollOptions.timesToRoll,
        }) + '<br>';
      }

      // Stashed onto the posted message's flags (see _rollSkillHelper below) so chat.mjs can
      // later match this roll against a reroll grant's own scope/condition (skill/essence) and
      // recognize a Consummate Performer attempt once its outcome is known.
      const rollContext = {
        skill: rolledSkill,
        essence: rolledEssence,
        // Time Traveler's own Hang-Up - see TIME_TRAVELER_HANGUP_ID's own comment above. The
        // already-resolved skill die size for this roll, needed by _rollSkillHelper's own Fumble
        // widening check. A Fanning volley's later shots each carry their own.
        finalShift: shotFinalShift,
        snag: skillRollOptions.snag,
        isPowerWeaponAttack: item?.type == 'weaponEffect'
          && !!this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('powerWeapon'),
        // Focused Strike (A Jump Through Time, Quantum Ranger, 9th level, p.46) - see
        // helpers/reroll.mjs's own REROLL_CONDITIONS.unarmedAttack doc comment. Same "no parent
        // weapon" proxy for unarmed as Empty Hands/Randori Master's identical checks above.
        isUnarmedAttack: this._isUnarmedWeaponEffect(actor, item),
        // Metallikato (Decepticon Directive p.66) - helpers/reroll.mjs's REROLL_CONDITIONS.botModeMelee.
        isMeleeAttack: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee',
        // Homing Shots (Decepticon Directive, Cannonade Focus, 10th level, p.46) - see
        // helpers/reroll.mjs's own REROLL_CONDITIONS.consumableOrWreckerRangedAttack doc comment.
        isConsumableOrWreckerRangedAttack: !!(item?.type == 'weaponEffect'
          && item.system.classification?.style != 'melee'
          && (this._getParentWeapon(actor, item)?.system.traits?.includes('consumable')
            || this._getParentWeapon(actor, item)?.system.traits?.includes('wrecker'))),
        // MLP CRB "Consummate Performer" (Laugh Tactic, p.86) stamps this via a synthetic
        // {skill: 'performance', dif: <escalating DIF>, consummatePerformer: true} dataset (see
        // helpers/consummate-performer.mjs#activateConsummatePerformer, same minimal-dataset
        // shape as the @Check[...] enricher's own onCheckLinkClick) so chat.mjs's
        // addConsummatePerformerButton can recognize this specific roll and offer to regain 1
        // Cheer once rollFailed (set below in _rollSkillHelper) comes back false.
        consummatePerformer: !!dataset.consummatePerformer,
        // Exterminator - see EXTERMINATOR_ID's own comment above. Already computed by
        // _getAutomaticCombatModifiers (where the target/actor Size comparison actually lives),
        // just threaded through here so helpers/reroll.mjs's own REROLL_CONDITIONS.smallerTarget
        // can read it back off the posted message's flags, the same "computed once, read from
        // context" shape notSnagged/isPowerWeaponAttack/rollFailed already establish.
        smallerTarget: !!combatModifiers.exterminatorEligible,
        // All Too Predictable - helpers/reroll.mjs's REROLL_CONDITIONS.vsPrimaryQuarry.
        ...(isVsPrimaryQuarry(actor, game.user.targets.first()?.actor) ? { vsPrimaryQuarry: true } : {}),
        // Spite (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see helpers/spite.mjs's own
        // doc comment and chat.mjs#addSpiteButton for why this needs to be recognized from the
        // posted message itself (a reactive, post-miss trigger, not a pre-roll checkbox). Only
        // meaningful for a single-target Attack - the same "first entry" simplification other
        // single-target-assuming mechanics in this project already use.
        isAttack: item?.type == 'weaponEffect',
        // Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58) - see
        // helpers/frenzied-attack.mjs's own doc comment and chat.mjs#addFrenziedAttackButton. The
        // button has to roll this SAME weaponEffect Item again, so its identity is stamped here
        // the same way isAttack itself is, rather than trying to re-derive it later from the
        // message content.
        itemUuid: item?.uuid ?? null,
        // Exploit Weakness (PR CRB, Yellow Ranger, 7th/15th level, p.57) - see
        // helpers/exploit-weakness.mjs's own doc comment and chat.mjs#addExploitWeaknessButton.
        // Same reactive-chat-button recognition shape as Spite above, but gated on a melee Attack
        // regardless of hit/miss rather than a miss specifically.
        isMelee: item?.type == 'weaponEffect' && item.system.classification.style == 'melee',
        // Flashy - see helpers/flashy.mjs's own doc comment and chat.mjs#addFlashyButton. Same
        // reactive-chat-button recognition shape as Exploit Weakness's isMelee just above, gated
        // on an Electric-damage weaponEffect attack specifically rather than any melee attack.
        isFlashyAttack: item?.type == 'weaponEffect' && item.system.damageType == 'electric'
          && actorHasPerk(actor, FLASHY_ID),
        targetUuid: checkContext?.entries?.[0]?.targetUuid ?? null,
        // Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99) - see
        // helpers/combat.mjs#toughEnoughDamage's own doc comment. Needed alongside
        // isAttack above so chat.mjs's Apply Damage handler can recognize "a non-attack effect
        // against Toughness" from the posted message alone.
        defenseType: checkContext?.defenseType ?? null,
        // High-Density - see helpers/high-density.mjs's own doc comment and
        // chat.mjs#addHighDensityButton, which reads these back off the posted message. Only
        // stamped when true, so every other roll's flags stay exactly as they were.
        ...(item?.type == 'weaponEffect' && isHighDensityWeapon(this._getParentWeapon(actor, item))
          ? { isHighDensityAttack: true } : {}),
        ...(dataset.highDensityFollowUp ? { highDensityFollowUp: true } : {}),
      };

      if (isMultipleTargetsAttack) {
        // One independent roll per target, each its own checkContext carrying just that one
        // target's own entry - _rollSkillHelper's own `new Roll(formula, ...)` gives each call
        // a fresh, independent dice pool, the same mechanism the timesToRoll loop above already
        // relies on for repeats, so no other change is needed to get independent totals.
        for (const entry of checkEntries) {
          const targetText = this._i18n.format("E20.RollMultipleTargetsText", { name: entry.name }) + '<br>';
          // Awaited now, where it used to be fired and forgotten. That also settles the order
          // these cards post in, which was previously whatever order they happened to resolve in.
          rollOutcomes.push(await this._rollSkillHelper(
            shotFormula, actor, repeatText + targetText + label, canCritD2, { ...checkContext, entries: [entry] },
            rollContext, drivingStrikeReroll,
          ));
        }
      } else {
        rollOutcomes.push(
          await this._rollSkillHelper(
            shotFormula, actor, repeatText + label, canCritD2, checkContext, rollContext, drivingStrikeReroll,
          ),
        );
      }

      // Fanning: "A Fanning Attack ends early if the attacker Fumbles one of their Attack Skill
      // Tests."
      if (fanningShot && rollOutcomes.some(outcome => outcome?.isFumble)) {
        break;
      }
    }

    // `success` is the headline a caller usually wants: did ANY roll from this call land? For a
    // single roll against a flat Difficulty - a Requisition Test, a Skill Test from an enricher -
    // that is simply "did it pass". `outcomes` is there for anything needing per-roll detail.
    const outcomes = rollOutcomes.filter(Boolean);
    return {
      success: outcomes.some(outcome => outcome.results.some(result => result.success)),
      outcomes,
      // Fanning - documents/item.mjs#roll flags the weapon for a reload after any Fanning Attack
      // ("After a Fanning Attack, the weapon gains the Reload trait").
      fanned: fanningShots > 0,
      // Empty the Mag was used - it only fires on a hit (see _applyEmptyTheMag), and afterwards the
      // weapon must be reloaded (documents/item.mjs#roll).
      emptiedMag: !!skillRollOptions.emptyTheMag && outcomes.some(outcome => outcome.results.some(result => result.success)),
    };
  }

  /**
   * Checks whether the actor has a Perk granted from the given compendium source - the flat
   * "do they have it at all" version of _hasExpertiseDownshiftImmunity's own scoped check, for
   * Perks (e.g. Driving Strike) with no further per-instance choice to match against. Checks
   * both flags.core.sourceId (a copy granted through a Role's own items map - e.g. Driving
   * Strike via "Path of Flame," how a character normally gets it) and _stats.compendiumSource
   * (a manually-dropped or choice-picked one) - see perk-handler.mjs's own SORCERY_PERK_ID/
   * ZORD_PERK_ID checks for the established idiom; this originally only checked the latter.
   * @param {Actor} actor
   * @param {String} perkId   A compendium UUID, e.g. "Compendium.essence20.<pack>.Item.<id>".
   * @returns {Boolean}
   * @private
   */
  _actorHasPerk(actor, perkId) {
    return actor.items.some(actorItem =>
      actorItem.type == 'perk'
      && (actorItem.flags.core?.sourceId == perkId || actorItem._stats?.compendiumSource == perkId || actorItem?.flags?.essence20?.rulesSource == perkId));
  }

  /**
   * Computes the automatic dice-shift/Edge/Snag modifiers that come from Size Class
   * differences (Table 10-2: Size Class Combat Adjustment Matrix) and active Conditions,
   * rather than anything the actor chose. Impaired and Momentarily Acting Smaller (p.157 - a
   * Snag on all physical, i.e. Strength/Speed, actions while squeezed into a smaller space)
   * apply to any Skill Test, and a Prone attacker's own melee penalty is a Condition effect that
   * comes from the roller's own statuses.
   *
   * The resolved target itself (`game.user.targets.first()`) is read for ANY roll, not just
   * weaponEffect attacks - a plain Skill Test rolled "vs. Target Defense" (rollSkill()'s own
   * checkEntries/checkContext building already supports this for any roll type) can have a real
   * target too. Most of what a target's own Conditions/Perks affect - Size shift, Cover, Range,
   * Resistance to the attack's own damage type, and every Perk whose RAW text specifically says
   * "attacks" (Paranoia, Duck & Cover, Gallantry, Impenetrable Shield, Shield Modulation, Enemy
   * Number One, Heavy Ordnance, Seconds Between Click & Boom, enemyDownshift Role Points) - only
   * makes sense for a real weapon attack and stays gated behind isAttack below. First Strike and
   * Just The Facts are the two exceptions: their own RAW explicitly covers plain Skill Tests (an
   * opponent who hasn't acted yet; a Deception Skill Test specifically), neither touches any
   * weapon/damage fields, so both run unconditionally once a target is resolved. Just The Facts'
   * Immune half (as opposed to its Resistant/Snag half handled here) needs to guarantee a failure
   * rather than just modify the die, so that half is applied separately, per-target, in
   * rollSkill()'s own checkEntries construction instead.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   * @param {String} rolledEssence   The Essence tied to the skill being rolled, if any.
   * @param {String} rolledSkill   The Skill being rolled, if any (e.g. 'deception').
   * @returns {Object}   { shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId,
   *   tooCloseForMinimumRange, pendingBonusesToClear, bonusDie, spottedTarget, eyeForAppraisalTarget,
   *   sources: Array<{id, label, shiftUp, shiftDown, edge, snag}> - one entry per individual
   *     modifier that actually fired this roll, parallel to (never a replacement for) the summed
   *     shiftUp/shiftDown/edge/snag fields above - see addSource's own doc comment inside this
   *     function }
   * @private
   */
  _getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill, rollDataset = {}) {
    let shiftUp = 0;
    let shiftDown = 0;
    let edge = false;
    let snag = false;
    let debilitatedConsumed = false;
    let tooCloseForMinimumRange = false;
    let forcedMiss = false;
    let moveLikeASongTriggered = false;
    let balanceOfJusticeTriggered = false;
    let dontUnderestimateMeTriggered = false;
    let disgustTriggered = false;
    let oorahDamageBonus = 0;
    let goinHeelsDamageBonus = 0;
    let isCatchOffGuardAttempt = false;
    let rumbleInTheJungleEligible = false;
    let exterminatorEligible = false;
    let twoHeadsAssistanceConsumed = false;
    const pendingBonusesToClear = [];

    // Every automatic shiftUp/shiftDown/edge/snag contributor below is ALSO recorded here as its
    // own labeled entry, alongside (never instead of) the shiftUp/shiftDown/edge/snag totals this
    // function has always computed - addSource() never changes what those totals end up being,
    // it just parallels each mutation with a record of where it came from. Surfaced in the Roll
    // Options Dialog (see helpers/roll-dialog.mjs's own combatModifierSources handling) so a
    // player can see WHY their shift-up number is what it is (e.g. "Informed Accuracy") instead of
    // it silently folding into one opaque total, and - for shiftUp/shiftDown entries specifically -
    // individually toggle one off for just this roll (dice.mjs#rollSkill subtracts a disabled
    // source's own shiftUp/shiftDown back out after the dialog resolves). Edge/snag entries are
    // informational only (annotating the existing Snag/Normal/Edge radio's own labels) rather than
    // independently toggleable - that radio is already the one interactive control for edge/snag,
    // so a second, overlapping toggle would just be redundant.
    const sources = [];
    const addSource = (id, label, mods) => {
      sources.push({
        id,
        label,
        shiftUp: mods.shiftUp || 0,
        shiftDown: mods.shiftDown || 0,
        edge: !!mods.edge,
        snag: !!mods.snag,
        // A banked "+N damage" (rules/bank.mjs) - added to the damage bonus in rollSkill.
        ...(mods.damage ? { damage: mods.damage } : {}),
      });
    };

    const selfStatuses = actor.statuses;

    // What the vehicle the roller is crewing (or is) adds - Racing Stripes, LIDAR, Onboard GPS, NOD
    // Viewscreens, Stealthy... (helpers/vehicle-upgrades.mjs). A Nameplate bonus is spent here.
    const crewedVehicleToken = (getCrewedVehicle(actor)?.vehicle ?? (actor.type == 'vehicle' ? actor : null))?.getActiveTokens?.()?.[0];
    for (const source of crewSources(actor, rolledSkill, item, { inRoughTerrain: !!crewedVehicleToken && isInRoughTerrain(crewedVehicleToken.document) })) {
      shiftUp += source.shiftUp;
      shiftDown += source.shiftDown;
      edge ||= source.edge;
      snag ||= source.snag;
      addSource(`vehicle-${source.id}`, source.label, source);
      if (source.consume) {
        const vehicle = getCrewedVehicle(actor)?.vehicle ?? actor;
        vehicle.unsetFlag?.('essence20', source.consume);
      }
    }

    // Ramshackle (Intercontinental Adventures p.62): "If the driver is not Qualified to drive
    // Ramshackle vehicles, they suffer a Snag on Driving Skill Tests unless they succeed at a DIF 5
    // Streetwise Skill Test first." Qualification isn't tracked, so it's offered - set the radio back
    // to Normal when qualified or after the Streetwise test.
    if (rolledSkill == 'driving' && getCrewedVehicle(actor)?.vehicle?.system?.traits?.ramshackle) {
      snag = true;
      addSource('ramshackle', this._localize('E20.VehicleTraitRamshackle'), { snag: true });
    }

    // Boarder (weapon-traits.mjs) - boarding a vehicle.
    if ((rolledSkill == 'athletics' || rolledSkill == 'acrobatics') && hasBoarder(actor)) {
      edge = true;
      addSource('boarder', this._localize('E20.UpgradeBoarder'), { edge: true });
    }

    // Battledress without the Silent trait, and My Little Pony's Light Armor (weapon-traits.mjs).
    if (rolledSkill == 'infiltration') {
      const noisy = noisyArmorPenalty(actor);
      if (noisy) {
        shiftDown += noisy;
        addSource('noisyArmor', this._localize('E20.ArmorNotSilent'), { shiftDown: noisy });
      }
    }

    const lightArmor = lightArmorPenalty(actor, rolledSkill);
    if (lightArmor) {
      shiftDown += lightArmor;
      addSource('mlpLightArmor', this._localize('E20.ArmorLightPenalty'), { shiftDown: lightArmor });
    }

    // Ram Cone - the Bot Mode unarmed Blunt attack loses its ↓1.
    if (ramConeBotUnarmed(actor, item, item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null)) {
      shiftUp += 1;
      addSource('ramCone', this._localize('E20.GearRamCone'), { shiftUp: 1 });
    }

    // HUD (Cobra Codex, armor upgrade, p.101): ↑1 to the chosen skill until the end of the turn it was
    // switched on (helpers/weapon-perk-uses.mjs).
    if (rolledSkill && getHudSkill(actor) == rolledSkill) {
      shiftUp += 1;
      addSource('hud', this._localize('E20.UpgradeHud'), { shiftUp: 1 });
    }

    // Chrono-Trigger (A Jump Through Time p.69): "Multiple Attacks (3, ↓2)" - three attacks per
    // Attack action (helpers/action-perks.mjs), each at ↓2. Its own source, so a single ordinary shot
    // can switch it off in the Roll Options Dialog.
    if (item?.type == 'weaponEffect' && hasChronoTrigger(this._getParentWeapon(actor, item))) {
      shiftDown += 2;
      addSource('chronoTrigger', this._localize('E20.UpgradeChronoTrigger'), { shiftDown: 2 });
    }

    // Ground and Pound (Hawk's Personnel Files, p.174): "each Attack Skill Test suffers a Downshift for
    // each attack that came before it in this turn." The ledger counts the Free-action attacks it
    // paid for, this one included.
    if (item?.type == 'weaponEffect' && isGroundAndPoundActive(actor) && !this._getParentWeapon(actor, item)) {
      const earlier = Math.max(0, (getLedger(actor).perkUses?.groundAndPound ?? 0) - 1);
      if (earlier) {
        shiftDown += earlier;
        addSource('groundAndPound', findSourced(actor, ACTION_PERK_IDS.groundAndPound)?.name ?? 'Ground and Pound', { shiftDown: earlier });
      }
    }

    // Bracing (GI Joe CRB p.194): "Bracing grants a ↑1 shift when attacking multiple targets with a
    // ranged weapon." Braced by the Brace action, a bipod, or being Prone.
    if (item?.type == 'weaponEffect' && item.system.classification?.style != 'melee'
      && isMultipleTargetsWeapon(actor, item) && isBraced(actor)) {
      shiftUp += 1;
      addSource('braced', this._localize('E20.ActionBrace'), { shiftUp: 1 });
    }

    if (selfStatuses.has('impaired')) {
      shiftDown += 1;
      addSource('impaired', this._localize('E20.StatusImpaired'), { shiftDown: 1 });
    }

    // Frightened (Conditions, e.g. GI Joe CRB p.226): "suffer a ↓2 die shift penalty when in sight
    // of their fear." Whether the fear is in sight can't be checked, so this applies to every roll
    // as its own shiftDown source, which the player unticks in the Roll Options Dialog when the
    // source of their fear isn't in view.
    if (selfStatuses.has('frightened')) {
      shiftDown += 2;
      addSource('selfFrightened', this._localize('E20.StatusFrightened'), { shiftDown: 2 });
    }

    if (selfStatuses.has('actingSmaller') && ['strength', 'speed'].includes(rolledEssence)) {
      snag = true;
      addSource('actingSmaller', this._localize('E20.StatusActingSmaller'), { snag: true });
    }

    // Xenotech (Across the Stars, Weapon Traits, p.79; the ARMOR trait of the same name is a
    // separate rule, already built via dice.mjs's own rollSkill calculatedShiftDown check): "Until
    // a character achieves a Critical Success with this weapon, they suffer a Snag on attacks with
    // it." A per-weapon-per-wielder flag on the WEAPON Item itself, same idiom as
    // helpers/reload.mjs's own needsReload flag - set once isCrit is known, in _rollSkillHelper's
    // own post-roll processing (see its own comment there), and read back here, before the roll.
    const xenotechWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    if (xenotechWeapon?.system.traits?.includes('xenotech') && !xenotechWeapon.getFlag?.('essence20', 'xenotechCritted')) {
      snag = true;
      addSource('xenotech', this._localize('E20.WeaponTraitXenotech'), { snag: true });
    }

    // Xenotech Components - see its own check in _rollSkillHelper's post-roll processing for the
    // RAW quote. ↓1 until the weapon's own componentsSucceeded flag is set, then ↑1 forever after.
    const componentsWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    if (componentsWeapon?.system.traits?.includes('components')) {
      if (componentsWeapon.getFlag?.('essence20', 'componentsSucceeded')) {
        shiftUp += 1;
        addSource('components', this._localize('E20.WeaponTraitComponents'), { shiftUp: 1 });
      } else {
        shiftDown += 1;
        addSource('components', this._localize('E20.WeaponTraitComponents'), { shiftDown: 1 });
      }
    }

    // Environment (physical, not the terrain-of-expertise E20.environments enum - see
    // helpers/environment.mjs's own doc comment) - Across the Stars' "Exploring Infinite
    // Environments" (p.24-25) and the GI Joe CRB's own Underwater Combat rules (p.212).
    const environment = getEnvironment(actor);
    const environmentWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const isRangedWeaponEffect = item?.type == 'weaponEffect' && item.system.classification?.style != 'melee';

    // Inertial (Across the Stars, Weapon Traits, p.79): "a self-propelled, guided, or other
    // projectile weapon that overcomes a lack of gravity or atmosphere. These weapons do not
    // suffer any low gravity, zero gravity, or vacuum-based penalties for their Attacks." Checked
    // first so the three penalty blocks just below can simply skip themselves for an Inertial
    // weapon, rather than duplicating this same guard three times.
    const isInertialWeapon = !!environmentWeapon?.system.traits?.includes('inertial');

    if (isRangedWeaponEffect && !isInertialWeapon) {
      // Low Gravity (ATS p.24): "Ranged attacks with the Ballistic trait suffer a Snag."
      if (environment == 'lowGravity' && environmentWeapon?.system.traits?.includes('ballistic')) {
        snag = true;
        addSource('lowGravity', this._localize('E20.SceneEnvironmentLowGravity'), { snag: true });
      }

      // Zero-G (ATS p.25): "Ranged attacks that do not regularly inflict Energy or Laser damage
      // suffer a Snag." This project's damageType schema has no 'energy' value of its own (only
      // the separate 'energy' WEAPON TRAIT and the 'laser' damageType), so "regularly inflict
      // Energy... damage" reads as the weapon carrying the Energy trait.
      if (environment == 'zeroGravity'
        && !environmentWeapon?.system.traits?.includes('energy') && item.system.damageType != 'laser') {
        snag = true;
        addSource('zeroGravity', this._localize('E20.SceneEnvironmentZeroGravity'), { snag: true });
      }

      // Vacuum or Void (ATS p.24-25): "all ranged attacks double their Range values but suffer a
      // Snag on their Skill Test." Only the Snag half is built - this project has no per-roll
      // Range-value display to double.
      if (environment == 'vacuum') {
        snag = true;
        addSource('vacuum', this._localize('E20.SceneEnvironmentVacuum'), { snag: true });
      }
    }

    if (environment == 'underwater' && item?.type == 'weaponEffect') {
      // Underwater Combat (GI Joe CRB p.212): "someone without an Aquatic Movement type suffers a
      // Snag [on a melee Attack]... unless the weapon is specifically crafted for underwater use,
      // such as weapons with the Amphibious or Aquatic qualities" and "[a ranged Attack] has a
      // Snag unless the weapon has either the Amphibious or Aquatic qualities." The "beyond the
      // weapon's normal reach suffers a ↓3" ranged clause isn't built - this system has no
      // per-roll target-distance check to compare against the weapon's own Range.
      const isAmphibiousOrAquaticWeapon = !!environmentWeapon?.system.traits?.includes('amphibious')
        || !!environmentWeapon?.system.traits?.includes('aquatic');
      if (!isAmphibiousOrAquaticWeapon) {
        if (!isRangedWeaponEffect && !(actor.system.movement?.swim?.total > 0)) {
          snag = true;
          addSource('underwaterMelee', this._localize('E20.SceneEnvironmentUnderwater'), { snag: true });
        } else if (isRangedWeaponEffect) {
          snag = true;
          addSource('underwaterRanged', this._localize('E20.SceneEnvironmentUnderwater'), { snag: true });
        }
      }

      // "Fire Element attacks against creatures and objects that are fully immersed in water
      // suffer an automatic ↓2 dice shift." Approximated as "the attacker is underwater," this
      // project having no separate wet/immersed flag on a target.
      if (item.system.damageType == 'fire') {
        shiftDown += 2;
        addSource('underwaterFire', this._localize('E20.SceneEnvironmentUnderwater'), { shiftDown: 2 });
      }
    }

    // Aquatic (GI Joe CRB, Weapon Traits, p.147): "Can be used underwater without penalty, and on
    // land with ↓3." Amphibious ("used on land and underwater without penalty") overrides this
    // when a weapon somehow carries both.
    if (environment != 'underwater' && item?.type == 'weaponEffect'
      && environmentWeapon?.system.traits?.includes('aquatic')
      && !environmentWeapon?.system.traits?.includes('amphibious')) {
      shiftDown += 3;
      addSource('aquaticOnLand', this._localize('E20.WeaponTraitAquatic'), { shiftDown: 3 });
    }

    // Gravity (ATS p.24-25): High Gravity "Athletics and Brawn Skill Tests suffer ↓2", Low Gravity
    // "...gain ↑1", Zero-G "...gain ↑2". High Gravity's halved and Vacuum's doubled Range values
    // aren't built - no roll here carries a Range value to change.
    const gravityShift = GRAVITY_ATHLETICS_BRAWN_SHIFTS[environment];
    if (gravityShift && ['athletics', 'brawn'].includes(rolledSkill)) {
      const label = this._localize(E20.sceneEnvironments[environment]);
      if (gravityShift > 0) {
        shiftUp += gravityShift;
        addSource('gravitySkill', label, { shiftUp: gravityShift });
      } else {
        shiftDown -= gravityShift;
        addSource('gravitySkill', label, { shiftDown: -gravityShift });
      }
    }

    // Extreme Temperature / Thick or Thin Atmosphere (ATS p.23-24): "they suffer the Impaired
    // Condition" while unprotected - see helpers/environment-hazards.mjs. Impaired's own ↓1, as its
    // own labelled source so a player who spent the Free action to steady their breathing can untick
    // it; skipped when the Impaired status is already counted above.
    if (!selfStatuses.has('impaired') && isImpairedByEnvironment(actor, environment)) {
      shiftDown += 1;
      addSource('environmentImpaired', `${this._localize(E20.sceneEnvironments[environment])} (${this._localize('E20.StatusImpaired')})`,
        { shiftDown: 1 });
    }

    // Unstable (Across the Stars, Space Vessel Condition, p.26): "Vehicles with this Condition
    // suffer ↓1 on all hardpoint weapons... a second time, the penalty increases to ↓2." A Vehicle's
    // weapons are its hardpoint weapons, rolled as the Vehicle itself. The third stack's refusal is
    // in rollSkill.
    const unstablePenalty = item?.type == 'weaponEffect' && actor.type == 'vehicle' ? getUnstablePenalty(actor) : 0;
    if (unstablePenalty) {
      shiftDown += unstablePenalty;
      addSource('vesselUnstable', this._localize('E20.StatusUnstable'), { shiftDown: unstablePenalty });
    }

    // Bad Temper (Decepticon Directive, Traitor Origin, suggested Hang-Up, p.31): "The turn after
    // you Fumble for any reason...you suffer ↓1 on all Skill Tests until the end of your next
    // turn." Set on Fumble (see BAD_TEMPER_HANGUP_ID's own check in _rollSkillHelper, next to
    // Cruel Warlord's identical isFumble hook) as a round-scoped flag - same {combatId, round}
    // shape every other round-scoped flag in this codebase already uses - checked here on every
    // roll while it's active. "The turn after" (not the fumbling turn itself) is approximated as
    // "the following round," the same round-granularity idiom Team Focus's own "since your last
    // turn" already accepts. Its own "cannot take Free actions" clause isn't enforced - the
    // standing action-economy gap this codebase already accepts broadly (e.g. Reckless Abandon's
    // own unenforced restrictions).
    const badTemperFlag = actorHasHangUp(actor, BAD_TEMPER_HANGUP_ID) && actor.getFlag?.('essence20', BAD_TEMPER_FLAG);
    if (badTemperFlag && game.combat && badTemperFlag.combatId == game.combat.id && badTemperFlag.round == game.combat.round) {
      shiftDown += 1;
      addSource('badTemper', findHangUp(actor, BAD_TEMPER_HANGUP_ID)?.name ?? 'Bad Temper', { shiftDown: 1 });
    }

    // Something To Prove (Decepticon Directive, Traitor Origin, suggested Hang-Up, p.32): "you
    // suffer ↓1 on Skill Tests on any turn after Fumbling in their commander's line of sight."
    // Same Fumble-triggered, round-scoped flag shape as Bad Temper just above - "in their
    // commander's line of sight" has no observer/LOS concept anywhere in this codebase to check,
    // so it's flattened to apply unconditionally, the same "grant the upside, skip the
    // unenforceable qualifier" idiom used throughout this project.
    // No Fighting?!'s Snag is an item rule on the Hang-Up now; _rollSkillHelper still clears the flag.

    const somethingToProveFlag = actorHasHangUp(actor, SOMETHING_TO_PROVE_HANGUP_ID)
      && actor.getFlag?.('essence20', SOMETHING_TO_PROVE_FLAG);
    if (somethingToProveFlag && game.combat && somethingToProveFlag.combatId == game.combat.id
      && somethingToProveFlag.round == game.combat.round) {
      shiftDown += 1;
      addSource('somethingToProve', findHangUp(actor, SOMETHING_TO_PROVE_HANGUP_ID)?.name ?? 'Something To Prove', { shiftDown: 1 });
    }

    // Don't-Notice-Me-Field (MLP CRB, Superior Enchantment spell, p.137) - self half: see
    // helpers/dont-notice-me-field.mjs's own doc comment. "Edge on Infiltration Skill Tests
    // related to not being seen" while the field is active - unconditional on a target being set
    // (unlike the reciprocal Alertness Snag half below, which needs a target to check).
    if (rolledSkill == 'infiltration' && isDontNoticeMeFieldActive(actor)) {
      edge = true;
      addSource('dontNoticeMeFieldSelf', "Don't-Notice-Me-Field", { edge: true });
    }

    // Debilitating Strike (16th level): "after hitting a target with your sneak attack, they
    // suffer a Snag on their first Skill Test or attack on their next turn" - applies to ANY
    // roll, not just weaponEffect attacks (unlike most of this function's other checks below,
    // gated behind isAttack), so it's checked here rather than in the target block. The flag
    // itself is set by helpers/sneak-attack.mjs#markDebilitated once a Sneak-Attack-boosted hit
    // actually lands (dice.mjs#_rollSkillHelper); this function is synchronous and can't clear it
    // itself, so it just reports that it was consumed and rollSkill() clears it afterward.
    if (actor.getFlag?.('essence20', 'debilitated')) {
      snag = true;
      debilitatedConsumed = true;
      // A mark from Shock and Awe (or another Perk sharing this flag) carries its own name.
      const debilitatedFlag = actor.getFlag('essence20', 'debilitated');
      addSource('debilitatingStrike', typeof debilitatedFlag == 'string' && debilitatedFlag ? debilitatedFlag
        : (findPerk(actor, DEBILITATING_STRIKE_ID)?.name ?? 'Debilitating Strike'), { snag: true });
    }

    // Plan of Action (Officer base, 1st level, p.85) and the other ally banks: banked via the sheet's own new "Use" control
    // (helpers/banked-buffs.mjs) and consumed here, on whichever actor is rolling - applies to
    // ANY roll, same reasoning as Debilitating Strike/Who Dares Wins above. Plan of Action banks
    // its bonus directly on the ALLY the Officer chose, not the Officer themselves, so this is
    // still just an ordinary self-flag check either way - no cross-actor lookup needed here. This
    // function is synchronous and can't clear the flag itself, so - same shape as
    // debilitatedConsumed above - it just reports which keys to clear and rollSkill() does it.
    // Superb Soloist (Knights of Canterlot, Bard Influence, p.15) - see SUPERB_SOLOIST_ID's own
    // comment above. Same unscoped-Edge shape as Think On It just above.
    if (getPendingBonus(actor, 'pendingSuperbSoloist')) {
      edge = true;
      pendingBonusesToClear.push('pendingSuperbSoloist');
      addSource('superbSoloist', 'Superb Soloist', { edge: true });
    }

    // You Can Do It, Too! - see YOU_CAN_DO_IT_TOO_ID's own comment above. Same bank-now/consume-
    // on-next-roll shape as Superb Soloist just above, a flat shiftUp instead of Edge.
    const pendingYouCanDoItToo = getPendingBonus(actor, 'pendingYouCanDoItToo');
    if (pendingYouCanDoItToo) {
      shiftUp += pendingYouCanDoItToo.shiftUp;
      pendingBonusesToClear.push('pendingYouCanDoItToo');
      addSource('youCanDoItToo', 'You Can Do It, Too!', { shiftUp: pendingYouCanDoItToo.shiftUp });
    }

    // BRRRRRRRRRRRRRRT - see BRRRRRRRRRRRRRRT_ID's own comment above. Same unscoped self-shiftUp
    // consumption shape as You Can Do It, Too! just above.
    const pendingBrrrrrrrrrrrrrrt = getPendingBonus(actor, 'pendingBrrrrrrrrrrrrrrt');
    if (pendingBrrrrrrrrrrrrrrt) {
      shiftUp += pendingBrrrrrrrrrrrrrrt.shiftUp;
      pendingBonusesToClear.push('pendingBrrrrrrrrrrrrrrt');
      addSource('brrrrrrrrrrrrrrt', 'Brrrrrrrrrrrrrrt', { shiftUp: pendingBrrrrrrrrrrrrrrt.shiftUp });
    }

    // Rush the Line - see helpers/rush-the-line.mjs's own doc comment. Scoped to a melee
    // weaponEffect Attack specifically (RAW's own "melee Attack at the end of your Move"), unlike
    // Think On It/Superb Soloist's own unscoped-to-any-roll Edge.
    if (getPendingBonus(actor, PENDING_RUSH_THE_LINE_EDGE_FLAG)
      && item?.type == 'weaponEffect' && item.system.classification?.style == 'melee') {
      edge = true;
      pendingBonusesToClear.push(PENDING_RUSH_THE_LINE_EDGE_FLAG);
      addSource('rushTheLine', 'Rush the Line', { edge: true });
    }


    // Time To Think (MLP Magic, 3rd level, p.94) - banked once, when combat begins (see
    // helpers/time-to-think.mjs's own doc comment), consumed here on the actor's own next roll of
    // any kind, same shape as Think On It above.
    const pendingTimeToThink = getPendingBonus(actor, 'pendingTimeToThink');
    if (pendingTimeToThink) {
      edge = true;
      pendingBonusesToClear.push('pendingTimeToThink');
      addSource('timeToThink', 'Time To Think', { edge: true });
    }

    // One-Upping (Across the Stars, Competitive Origin Benefit, p.38) - see
    // helpers/one-upping.mjs's own doc comment. Scoped to the exact skill the ally failed, so the
    // banked upshift can't leak onto an unrelated roll - the same inline rolledSkill check Bait
    // and Switch/Inner Magic already use, but carrying the skill on the flag itself (the ally's
    // failure decides it) rather than hardcoding one here.
    // Guarded on the pending object's own existence FIRST: with no bank, `pendingOneUpping?.skill`
    // is undefined, and a roll that carries no rolledSkill would make `undefined == undefined`
    // true - the same false-positive that has bitten Eye for Appraisal and Menacing Glare here
    // before, caught again by the suite the moment this check was added.
    const pendingOneUpping = getPendingBonus(actor, PENDING_ONE_UPPING_FLAG_KEY);
    if (pendingOneUpping && pendingOneUpping.skill == rolledSkill) {
      shiftUp += pendingOneUpping.shiftUp ?? 1;
      pendingBonusesToClear.push(PENDING_ONE_UPPING_FLAG_KEY);
      addSource('oneUpping', 'One-Upping', { shiftUp: pendingOneUpping.shiftUp ?? 1 });
    }

    // But I Should Know That (Knights of Canterlot, Spell Scribe Hang-Up, p.34) - see
    // BUT_I_SHOULD_KNOW_THAT_ID's own comment above. Unscoped Snag, same shape as Through the
    // Arches/Debilitating Strike.
    if (getPendingBonus(actor, 'pendingButIShouldKnowThat')) {
      snag = true;
      pendingBonusesToClear.push('pendingButIShouldKnowThat');
      addSource('butIShouldKnowThat', 'But I Should Know That', { snag: true });
    }

    // Instinctual Caster (Knights of Canterlot, Hedge Wizard Hang-Up, p.35) - see
    // INSTINCTUAL_CASTER_ID's own comment above. Scoped to Spellcasting, same inline shape as
    // Bait and Switch/If I Recall Correctly above, just a shiftDown instead of an Edge.
    const pendingInstinctualCaster = getPendingBonus(actor, 'pendingInstinctualCaster');
    if (pendingInstinctualCaster && rolledSkill == 'spellcasting') {
      shiftDown += pendingInstinctualCaster.shiftDown;
      pendingBonusesToClear.push('pendingInstinctualCaster');
      addSource('instinctualCaster', 'Instinctual Caster', { shiftDown: pendingInstinctualCaster.shiftDown });
    }

    // Emotional Mastery: Shame - see EMOTIONAL_MASTERY_SHAME_FLAG's own comment above. Same
    // banked-shiftUp consumption shape as Plan of Action just below.
    const pendingEmotionalMasteryShame = getPendingBonus(actor, EMOTIONAL_MASTERY_SHAME_FLAG);
    if (pendingEmotionalMasteryShame) {
      shiftUp += pendingEmotionalMasteryShame.shiftUp;
      pendingBonusesToClear.push(EMOTIONAL_MASTERY_SHAME_FLAG);
      addSource('emotionalMasteryShame', 'Shame (Emotional Mastery)', { shiftUp: pendingEmotionalMasteryShame.shiftUp });
    }

    const pendingPlanOfAction = getPendingBonus(actor, 'pendingPlanOfAction');
    if (pendingPlanOfAction) {
      shiftUp += pendingPlanOfAction.shiftUp;
      pendingBonusesToClear.push('pendingPlanOfAction');
      addSource('planOfAction', 'Plan of Action', { shiftUp: pendingPlanOfAction.shiftUp });
    }

    // Inspiring Words (GI Joe CRB, Vanguard base, 2nd level, p.109) - the "upshift 2 on their
    // next Skill Test" option; see helpers/inspiring-words.mjs's own doc comment. Same
    // bank-on-an-ally/consume-on-their-next-roll shape as Plan of Action just above.
    const pendingInspiringWords = getPendingBonus(actor, 'pendingInspiringWords');
    if (pendingInspiringWords) {
      shiftUp += pendingInspiringWords.shiftUp;
      pendingBonusesToClear.push('pendingInspiringWords');
      addSource('inspiringWords', 'Inspiring Words', { shiftUp: pendingInspiringWords.shiftUp });
    }

    // Forward Observation - see helpers/forward-observation.mjs's own doc comment. Same
    // banked-shiftUp-on-self-or-an-ally shape as Plan of Action above.
    const pendingForwardObservation = getPendingBonus(actor, 'pendingForwardObservation');
    if (pendingForwardObservation) {
      shiftUp += pendingForwardObservation.shiftUp;
      pendingBonusesToClear.push('pendingForwardObservation');
      addSource('forwardObservation', 'Forward Observation', { shiftUp: pendingForwardObservation.shiftUp });
    }

    // Augment Power (Transformers CRB Scientist, 7th level, p.80) - same banked-on-an-ally shape
    // as Plan of Action above, just its own flagKey (see AUGMENT_POWER_ID's own comment in
    // helpers/banked-buffs.mjs for the once-per-turn gate paid at bank time).
    const pendingAugmentPower = getPendingBonus(actor, 'pendingAugmentPower');
    if (pendingAugmentPower) {
      shiftUp += pendingAugmentPower.shiftUp;
      pendingBonusesToClear.push('pendingAugmentPower');
      addSource('augmentPower', 'Augment Power', { shiftUp: pendingAugmentPower.shiftUp });
    }

    // Supportive Friend / Extra / Super (MLP CRB, Spirit of Kindness) - see
    // SUPPORTIVE_FRIEND_ID's own comment above. Banked directly on each nearby ally by the
    // broadcast in _rollSkillHelper's own post-roll processing (not a "Use" button - triggered
    // reactively by the granter's own successful roll), consumed here the same generic way as any
    // other banked shiftUp/edge grant.
    const pendingSupportiveFriend = getPendingBonus(actor, 'pendingSupportiveFriend');
    if (pendingSupportiveFriend) {
      if (pendingSupportiveFriend.edge) {
        edge = true;
      } else if (pendingSupportiveFriend.shiftUp) {
        shiftUp += pendingSupportiveFriend.shiftUp;
      }

      pendingBonusesToClear.push('pendingSupportiveFriend');
      addSource('supportiveFriend', 'Supportive Friend', pendingSupportiveFriend);
    }

    // Inner Magic (MLP Magic, 2nd level, p.94): "as a Standard action, you can reduce your
    // Willpower Defense by 1 until the end of the scene to upshift 1 your Spellcasting for your
    // next action. You may do this multiple times in a scene..." Same self-banked shiftUp shape
    // as the banks above, but gated to Spellcasting specifically (RAW's own "for your next
    // action" clearly means the next Spellcasting roll, not any Skill Test) - see
    // helpers/banked-buffs.mjs's own INNER_MAGIC_ID comment for the unautomated Willpower-Defense
    // cost half. Repeated uses before this is spent simply re-bank the same flat +1 (this system
    // has no mechanism to stack multiple pending banks of the same kind onto one future roll), so
    // "multiple times" only matters here for re-upping the bank across separate future actions,
    // not compounding a single one.
    const pendingInnerMagic = getPendingBonus(actor, 'pendingInnerMagic');
    if (pendingInnerMagic && rolledSkill == 'spellcasting') {
      shiftUp += pendingInnerMagic.shiftUp;
      pendingBonusesToClear.push('pendingInnerMagic');
      addSource('innerMagic', 'Inner Magic', { shiftUp: pendingInnerMagic.shiftUp });
    }

    // Impulsive - see IMPULSIVE_HANGUP_ID's own comment in prepareInitiativeRoll() above. Unscoped
    // (any Skill Test, RAW's own "first Skill Test after you roll Initiative"), unlike Inner
    // Magic/Terrifying's skill-specific consumption just above/below.
    const pendingImpulsive = getPendingBonus(actor, 'pendingImpulsive');
    if (pendingImpulsive) {
      shiftDown += pendingImpulsive.shiftDown;
      pendingBonusesToClear.push('pendingImpulsive');
      addSource('impulsive', 'Impulsive', { shiftDown: pendingImpulsive.shiftDown });
    }

    // Mass Shift - see helpers/mass-shift.mjs's own doc comment. Same scoped-consumption shape as
    // Inner Magic/Terrifying above, gated to whichever Skill was picked at bank time.
    const pendingMassShiftSkill = getPendingBonus(actor, MASS_SHIFT_SKILL_FLAG);
    if (pendingMassShiftSkill && rolledSkill == pendingMassShiftSkill.skill) {
      shiftUp += pendingMassShiftSkill.shiftUp;
      pendingBonusesToClear.push(MASS_SHIFT_SKILL_FLAG);
      addSource('massShift', 'Mass Shift', { shiftUp: pendingMassShiftSkill.shiftUp });
    }

    // Terrifying (GI Joe CRB, Armor Upgrade, p.156) - see helpers/banked-buffs.mjs's own
    // TERRIFYING_ID comment. Same scoped-consumption shape as Inner Magic just above, gated to
    // Intimidation instead of Spellcasting.
    const pendingTerrifying = getPendingBonus(actor, 'pendingTerrifying');
    if (pendingTerrifying && rolledSkill == 'intimidation') {
      shiftUp += pendingTerrifying.shiftUp;
      pendingBonusesToClear.push('pendingTerrifying');
      addSource('terrifying', 'Terrifying', { shiftUp: pendingTerrifying.shiftUp });
    }

    // Grid Surge - Temporary Construct (Silver Ranger, 2nd level, p.57): "grants Edge to [a chosen]
    // Skill for 1 hour." See helpers/grid-surge.mjs's own doc comment for why this is scoped to
    // one skill (picked at bank time) rather than any Skill Test like Think On It/Time To Think
    // above, and for the "approximated as the next matching roll" duration idiom.
    const pendingGridSurgeConstruct = getPendingBonus(actor, GRID_SURGE_CONSTRUCT_FLAG);
    if (pendingGridSurgeConstruct && rolledSkill == pendingGridSurgeConstruct.skill) {
      edge = true;
      pendingBonusesToClear.push(GRID_SURGE_CONSTRUCT_FLAG);
      addSource('gridSurgeConstruct', 'Grid Surge', { edge: true });
    }

    // Enchant (MLP CRB, Elementary Enchantment spell, p.136) - see helpers/enchant.mjs's own doc
    // comment. Same skill-scoped self-banked shiftUp shape as Grid Surge's own Temporary
    // Construct just above, but a shiftUp instead of an Edge.
    const pendingEnchant = getPendingBonus(actor, ENCHANT_SHIFT_UP_FLAG);
    if (pendingEnchant && rolledSkill == pendingEnchant.skill) {
      shiftUp += 1;
      pendingBonusesToClear.push(ENCHANT_SHIFT_UP_FLAG);
      addSource('enchant', 'Enchant', { shiftUp: 1 });
    }

    // Silver Medal Syndrome - see SILVER_MEDAL_SYNDROME_ID's own comment above. Banked by
    // rollSkill() the moment the actor's own roll crits, consumed on their own next Skill Test of
    // any kind, same unscoped shape as Think On It/Time To Think above.
    const pendingSilverMedalSyndrome = getPendingBonus(actor, 'pendingSilverMedalSyndrome');
    if (pendingSilverMedalSyndrome) {
      shiftUp += 1;
      pendingBonusesToClear.push('pendingSilverMedalSyndrome');
      addSource('silverMedalSyndrome', 'Silver Medal Syndrome', { shiftUp: 1 });
    }

    // Angry Hang-Up - see ANGRY_ID's own comment above / helpers/angry.mjs. Skill-scoped, same
    // shape as Grid Surge's own Temporary Construct/Enchant above, but a numeric shiftDown instead
    // of an Edge.
    const pendingAngrySnag = getPendingBonus(actor, 'pendingAngrySnag');
    if (pendingAngrySnag && rolledSkill == pendingAngrySnag.skill) {
      snag = true;
      pendingBonusesToClear.push('pendingAngrySnag');
      addSource('angryHangUp', 'Angry', { snag: true });
    }

    // Laypony Terms Hang-Up (MLP CRB, Futurist Influence, p.50) - see
    // helpers/skill-substitution-perks.mjs's own doc comment. Banked when the actor invoked
    // Reverse Engineer to substitute Technology for a Social Essence Skill, consumed on their own
    // next Technology roll - same shiftDown-via-Snag shape as Angry's own Hang-Up just above.
    const pendingLayponyTermsSnag = getPendingBonus(actor, 'pendingLayponyTermsSnag');
    if (pendingLayponyTermsSnag && rolledSkill == 'technology') {
      snag = true;
      pendingBonusesToClear.push('pendingLayponyTermsSnag');
      addSource('layponyTerms', 'Laypony Terms', { snag: true });
    }

    // Distracting Offer - see DISTRACTING_OFFER_ID's own comment above / helpers/distracting-offer.mjs.
    // Unscoped shiftDown (any Skill Test), banked on the TARGET by recordDistractingOfferResult,
    // consumed here on their own next roll - "until the beginning of your next turn" approximated
    // as "the next matching roll," this project's usual duration idiom.
    const pendingDistractingOffer = getPendingBonus(actor, 'pendingDistractingOfferShiftDown');
    if (pendingDistractingOffer) {
      shiftDown += pendingDistractingOffer.amount;
      pendingBonusesToClear.push('pendingDistractingOfferShiftDown');
      addSource('distractingOffer', 'Distracting Offer', { shiftDown: pendingDistractingOffer.amount });
    }

    // Antagonistic - see ANTAGONISTIC_SHIFT_DOWN_FLAG's own comment above / helpers/antagonistic.mjs.
    // Unscoped shiftDown (any Skill Test), banked on the debuffed target, consumed on their own
    // next roll.
    const pendingAntagonisticShiftDown = getPendingBonus(actor, ANTAGONISTIC_SHIFT_DOWN_FLAG);
    if (pendingAntagonisticShiftDown) {
      shiftDown += pendingAntagonisticShiftDown.shiftDown;
      pendingBonusesToClear.push(ANTAGONISTIC_SHIFT_DOWN_FLAG);
      addSource('antagonisticShiftDown', 'Antagonistic', { shiftDown: pendingAntagonisticShiftDown.shiftDown });
    }

    // Flying Nuisance - see FLYING_NUISANCE_SNAG_FLAG's own comment above / helpers/flying-nuisance.mjs.
    // Same unscoped, consumed-on-next-roll shape as Antagonistic's own shiftDown just above, but
    // Snag instead.
    const pendingFlyingNuisanceSnag = getPendingBonus(actor, FLYING_NUISANCE_SNAG_FLAG);
    if (pendingFlyingNuisanceSnag) {
      snag = true;
      pendingBonusesToClear.push(FLYING_NUISANCE_SNAG_FLAG);
      addSource('flyingNuisance', 'Flying Nuisance', { snag: true });
    }

    // Mistrustful - see MISTRUSTFUL_SNAG_FLAG's own comment above / helpers/mistrustful.mjs. Same
    // unscoped, consumed-on-next-roll shape as Flying Nuisance just above.
    const pendingMistrustfulSnag = getPendingBonus(actor, MISTRUSTFUL_SNAG_FLAG);
    if (pendingMistrustfulSnag) {
      snag = true;
      pendingBonusesToClear.push(MISTRUSTFUL_SNAG_FLAG);
      addSource('mistrustfulSnag', 'Mistrustful', { snag: true });
    }

    // Psycho Strike Snag Effect - see PSYCHO_STRIKE_SNAG_FLAG's own comment above / helpers/
    // psycho-strike.mjs. Same unscoped, consumed-on-next-roll shape as Flying Nuisance just above.
    const pendingPsychoStrikeSnag = getPendingBonus(actor, PSYCHO_STRIKE_SNAG_FLAG);
    if (pendingPsychoStrikeSnag) {
      snag = true;
      pendingBonusesToClear.push(PSYCHO_STRIKE_SNAG_FLAG);
      addSource('psychoStrikeSnag', 'Psycho Strike', { snag: true });
    }

    // Misled - see MISLED_HANGUP_ID's own comment above. Same unscoped-shiftDown,
    // consumed-on-next-roll shape as Antagonistic/Distracting Offer just above.
    const pendingMisledShiftDown = getPendingBonus(actor, MISLED_SHIFT_DOWN_FLAG);
    if (pendingMisledShiftDown) {
      shiftDown += pendingMisledShiftDown.shiftDown;
      pendingBonusesToClear.push(MISLED_SHIFT_DOWN_FLAG);
      addSource('misledShiftDown', 'Misled', { shiftDown: pendingMisledShiftDown.shiftDown });
    }

    // Repair Machine (Quartermaster's Guide to Gear, Grid Power, p.94) - see
    // helpers/repair-machine.mjs's own doc comment. Same self-banked, skill-scoped Edge shape as
    // Grid Surge's own Temporary Construct just above, but fixed to Technology.
    const pendingRepairMachineEdge = getPendingBonus(actor, REPAIR_MACHINE_EDGE_FLAG);
    if (pendingRepairMachineEdge && rolledSkill == 'technology') {
      edge = true;
      pendingBonusesToClear.push(REPAIR_MACHINE_EDGE_FLAG);
      addSource('repairMachineEdge', 'Repair Machine', { edge: true });
    }

    // Through the Arches (Phantom Ranger, 18th level, p.63) - see
    // helpers/through-the-arches.mjs's own doc comment. Applies to ANY Skill Test, same
    // unscoped-Snag shape as Debilitating Strike's own flag-consumption above.
    if (getPendingBonus(actor, THROUGH_THE_ARCHES_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(THROUGH_THE_ARCHES_SNAG_FLAG);
      addSource('throughTheArches', 'Through the Arches', { snag: true });
    }

    // Brute Force Works Best - see helpers/brute-force-works-best.mjs's own doc comment. Applies
    // to ANY Skill Test the marked equipment itself makes (or that's made using it), same
    // unscoped-Snag shape as Through the Arches just above, plus a downshift.
    const pendingBruteForceWorksBest = getPendingBonus(actor, BRUTE_FORCE_WORKS_BEST_FLAG);
    if (pendingBruteForceWorksBest) {
      snag = true;
      shiftDown += pendingBruteForceWorksBest.shiftDown;
      pendingBonusesToClear.push(BRUTE_FORCE_WORKS_BEST_FLAG);
      addSource('bruteForceWorksBest', 'Brute Force Works Best', { snag: true, shiftDown: pendingBruteForceWorksBest.shiftDown });
    }

    // Deconstructionist - see helpers/deconstructionist.mjs's own doc comment. Same unscoped-Snag
    // shape as Brute Force Works Best just above, minus its extra downshift.
    if (getPendingBonus(actor, DECONSTRUCTIONIST_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(DECONSTRUCTIONIST_FLAG);
      addSource('deconstructionist', 'Deconstructionist', { snag: true });
    }

    // Martial Leadership (Enigma of Combination, General Perk, p.41) - see
    // helpers/martial-leadership.mjs's own doc comment. Applies to ANY Skill Test, same
    // unscoped shape as Through the Arches just above - either the negative or the Edge half, never
    // both at once (the picker only ever banks one). The negative half is "impose ↓1 on the
    // target's next Skill Test" - a downshift, not a Snag, despite the banked flag's own name.
    if (getPendingBonus(actor, MARTIAL_LEADERSHIP_SNAG_FLAG)) {
      shiftDown += 1;
      pendingBonusesToClear.push(MARTIAL_LEADERSHIP_SNAG_FLAG);
      addSource('martialLeadership', 'Martial Leadership', { shiftDown: 1 });
    }

    if (getPendingBonus(actor, MARTIAL_LEADERSHIP_EDGE_FLAG)) {
      edge = true;
      pendingBonusesToClear.push(MARTIAL_LEADERSHIP_EDGE_FLAG);
      addSource('martialLeadership', 'Martial Leadership', { edge: true });
    }

    // Psychological Sway - see helpers/psychological-sway.mjs's own doc comment. Same
    // banked-on-the-target, unscoped-to-any-roll-type shape as Martial Leadership's Snag above.
    const pendingPsychologicalSway = getPendingBonus(actor, PENDING_PSYCHOLOGICAL_SWAY_FLAG);
    if (pendingPsychologicalSway) {
      shiftDown += 1;
      pendingBonusesToClear.push(PENDING_PSYCHOLOGICAL_SWAY_FLAG);
      addSource('psychologicalSway', 'Psychological Sway', { shiftDown: 1 });
    }

    // Up And At 'Em (GI Joe CRB, Focus: Medic, 10th level, p.82) - see
    // helpers/i-ve-got-you.mjs's own doc comment. Same unscoped-Edge shape as Martial Leadership
    // just above, banked on the just-revived target rather than the granter.
    if (getPendingBonus(actor, UP_AND_AT_EM_EDGE_FLAG)) {
      edge = true;
      pendingBonusesToClear.push(UP_AND_AT_EM_EDGE_FLAG);
      addSource('upAndAtEm', "Up And At 'Em", { edge: true });
    }

    // Dig Deep (WTNV Citizen's Guide, General Perk, p.47) - see its own comment in
    // helpers/combat.mjs (the damage-reduction half) and helpers/banked-buffs.mjs (the dispatch).
    // Same unscoped-Snag shape as Through the Arches just above.
    if (getPendingBonus(actor, 'pendingDigDeepSnag')) {
      snag = true;
      pendingBonusesToClear.push('pendingDigDeepSnag');
      addSource('digDeep', 'Dig Deep', { snag: true });
    }

    // Bumper Crop (WTNV Citizen's Guide, Farmer Role, Tiller Focus, p.37) - see
    // helpers/bumper-crop.mjs's own doc comment. Same unscoped-Snag shape as Through the Arches -
    // banked on the affected enemy, consumed on THEIR own next Skill Test, "the first... on their
    // turn" approximated as the usual "next matching roll" idiom.
    if (getPendingBonus(actor, 'pendingBumperCropSnag')) {
      snag = true;
      pendingBonusesToClear.push('pendingBumperCropSnag');
      addSource('bumperCrop', 'Bumper Crop', { snag: true });
    }

    // Sensitive (MLP Precise Hang-Up, p.60) - see helpers/combat.mjs's own doc comment. Same
    // unscoped-Snag shape as Through the Arches just above.
    if (getPendingBonus(actor, PENDING_SENSITIVE_SNAG_FLAG_KEY)) {
      snag = true;
      pendingBonusesToClear.push(PENDING_SENSITIVE_SNAG_FLAG_KEY);
      addSource('sensitive', 'Sensitive', { snag: true });
    }

    // Menacing Glare's own Snag effect (Dark Ranger, 2nd level, p.39) - see
    // helpers/menacing-glare.mjs's own doc comment. Same unscoped shape as Through the Arches
    // just above.
    if (getPendingBonus(actor, MENACING_GLARE_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(MENACING_GLARE_SNAG_FLAG);
      addSource('menacingGlareSnag', 'Menacing Glare', { snag: true });
    }

    // Your Safety's On's own Success half - see YOUR_SAFETYS_ON_SNAG_FLAG's own comment above.
    // Same unscoped shape as Menacing Glare/Tender's own Snag halves just above.
    if (getPendingBonus(actor, YOUR_SAFETYS_ON_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(YOUR_SAFETYS_ON_SNAG_FLAG);
      addSource('yourSafetysOnSnag', "Your Safety's On", { snag: true });
    }

    // Tender's own downshift (MLP CRB, Spirit of Kindness, 6th level, p.85) - see
    // helpers/tender.mjs's own doc comment. Same unscoped shape as Menacing Glare just above.
    const pendingTender = getPendingBonus(actor, 'pendingTenderSnag');
    if (pendingTender) {
      // A bank from before the fix ({snag: true}) reads as the same downshift.
      const tenderShiftDown = pendingTender.shiftDown ?? 1;
      shiftDown += tenderShiftDown;
      pendingBonusesToClear.push('pendingTenderSnag');
      addSource('tenderSnag', 'Tender', { shiftDown: tenderShiftDown });
    }


    // Unlucky (For You)'s own Snag half (Dark Ranger, 13th level, p.40) - see
    // helpers/unlucky-for-you.mjs's own doc comment. Same unscoped shape as Menacing Glare/Through
    // the Arches just above.
    if (getPendingBonus(actor, UNLUCKY_FOR_YOU_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(UNLUCKY_FOR_YOU_SNAG_FLAG);
      addSource('unluckyForYou', 'Unlucky (For You)', { snag: true });
    }

    // Explosive Aftershock - see helpers/explosive-aftershock.mjs's own doc comment. "They suffer
    // -1 on all actions until the end of their next turn" - a plain unscoped shiftDown, same
    // banked-and-consumed-once shape as Generosity of Spirit's own penalty just above.
    const pendingExplosiveAftershockPenalty = getPendingBonus(actor, EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG);
    if (pendingExplosiveAftershockPenalty) {
      shiftDown += pendingExplosiveAftershockPenalty.shiftDown;
      pendingBonusesToClear.push(EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG);
      addSource('explosiveAftershockPenalty', 'Explosive Aftershock', { shiftDown: pendingExplosiveAftershockPenalty.shiftDown });
    }

    // Inspiration (White Ranger, 5th/10th/15th level, p.65): "an ally may add [a scaling die] to
    // the result of any d20 roll on their next turn." Same banked-buffs.mjs shape as Think On
    // It/Plan of Action above (banked on the chosen ally, read back here), but the bonus is an
    // extra rolled die added straight to the Roll formula rather than a shiftUp/edge - see
    // rollSkill()'s own use of this returned bonusDie, right after _getFormula().
    let bonusDie = null;
    const pendingInspiration = getPendingBonus(actor, 'pendingInspiration');
    if (pendingInspiration) {
      bonusDie = pendingInspiration.bonusDie;
      pendingBonusesToClear.push('pendingInspiration');
    }

    // More Heads are Better than One (Dragon Origin, p.30): "Once per session, you can choose up
    // to two of your heads to roll a d2 Skill Die during a Skill Test and add it to your initial
    // roll." "Up to two" is granted as the max (2d2) - no stated reason to use fewer. Same
    // bank-now/consume-on-next-roll bonusDie shape as Inspiration above, self-targeted rather than
    // an ally - stacked onto (rather than overwriting) an already-pending Inspiration bonusDie on
    // the rare chance both are pending on the same roll at once.
    const pendingMoreHeads = getPendingBonus(actor, 'pendingMoreHeads');
    if (pendingMoreHeads) {
      bonusDie = bonusDie ? `${bonusDie} + ${pendingMoreHeads.bonusDie}` : pendingMoreHeads.bonusDie;
      pendingBonusesToClear.push('pendingMoreHeads');
    }

    const isAttack = item?.type == 'weaponEffect';
    const isMelee = isAttack && item.system.classification.style == 'melee';

    /* Aim (GI Joe CRB p.193): "A Ranged weapon-specific Free action is Aiming, which grants a
       up-1 shift on a single ranged attack test as long as you don't use Movement between your
       Aim and your attack."

       Ranged-only, hence isAttack && !isMelee - melee is one of the four weapon styles and the
       other three (energy, explosive, projectile) are all ranged, so the existing isMelee is
       exactly the right inverse.

       The other two conditions are enforced where the information is, not here: the aim is
       spent by the shot (documents/item.mjs#roll clears it once a weapon effect resolves) and
       cancelled by moving (documents/token.mjs). So by the time this reads the flag, an aim
       that is still set is one that has survived both.

       Not added to pendingBonusesToClear - that list is for flags on the ACTOR, and this one
       lives on the combatant ledger with its own clearing path.

       The bonus itself is NOT added here: the Roll Options Dialog's own "Aiming" switch is the one
       place it lands (rollSkill's aimBonus - which also carries Distance Vision, Dig In, Calculated
       Attack and Laser Sight), and taking the Aim action just turns that switch on
       (aimedByAction). Adding it here as well counted the same Aim twice. */

    // Shining Leader (White Ranger, 8th level, p.65) - "For the rest of that round and the
    // following round, all of your allies gain Edge on their attack Skill Tests." A 2-round
    // window rather than a one-shot bank, so this reads the flag directly (not via
    // getPendingBonus, which is designed to be cleared after a single consumption) and never adds
    // it to pendingBonusesToClear - see helpers/team-buffs.mjs's own doc comment on
    // SHINING_LEADER_EDGE_FLAG.
    const shiningLeaderFlag = actor.getFlag?.('essence20', SHINING_LEADER_EDGE_FLAG);
    if (isAttack && game.combat && shiningLeaderFlag && shiningLeaderFlag.combatId == game.combat.id
      && (game.combat.round == shiningLeaderFlag.round || game.combat.round == shiningLeaderFlag.round + 1)) {
      edge = true;
      addSource('shiningLeader', 'Shining Leader', { edge: true });
    }

    // Rallying Cry - see RALLYING_CRY_EDGE_FLAG's own doc comment in helpers/team-buffs.mjs. Same
    // 2-round window shape as Shining Leader just above, distinct flag key.
    const rallyingCryFlag = actor.getFlag?.('essence20', RALLYING_CRY_EDGE_FLAG);
    if (isAttack && game.combat && rallyingCryFlag && rallyingCryFlag.combatId == game.combat.id
      && (game.combat.round == rallyingCryFlag.round || game.combat.round == rallyingCryFlag.round + 1)) {
      edge = true;
      addSource('rallyingCry', 'Rallying Cry', { edge: true });
    }

    // Nano-Med Mastery (GI Joe CRB, Medic Focus, 18th level, p.82) - see NANO_MED_MASTERY_EDGE_FLAG's
    // own doc comment in helpers/team-buffs.mjs. "Edge on Attack rolls and Skill Tests" - unlike
    // Shining Leader/Rallying Cry above (Attacks only), this applies to ANY roll, so it isn't
    // gated on isAttack. Same 2-round window approximation for "until the end of your next turn."
    const nanoMedMasteryFlag = actor.getFlag?.('essence20', NANO_MED_MASTERY_EDGE_FLAG);
    if (game.combat && nanoMedMasteryFlag && nanoMedMasteryFlag.combatId == game.combat.id
      && (game.combat.round == nanoMedMasteryFlag.round || game.combat.round == nanoMedMasteryFlag.round + 1)) {
      edge = true;
      addSource('nanoMedMastery', 'Nano-Med Mastery', { edge: true });
    }

    if (isAttack && selfStatuses.has('blinded')) {
      snag = true;
      addSource('selfBlinded', this._localize('E20.StatusBlinded'), { snag: true });
    }

    // Invisible (GI Joe CRB, Conditions, p.226) - a CORE RULE, not a Perk: "all attack tests made
    // by an Invisible character gain Edge and all attack tests against them suffer Snag."
    //
    // The second half has been implemented for some time (see targetStatuses.has('invisible')
    // further below); this first half never was, so the Condition was only doing half its job.
    // Found 2026-09-15 by reading the Conditions appendix straight through and checking each
    // printed effect against the code, rather than by following up any one Perk - THREE separate
    // places apply this status (Emotional Mastery, helpers/invisibility.mjs, and a banked-buffs
    // dispatch) and none of their holders were getting the attacker-side benefit RAW promises.
    //
    // Attack-gated exactly as RAW words it ("attack tests"), so being unseen grants no Edge on an
    // ordinary Skill Test - and sat here beside the self-Blinded Snag rather than with the other
    // self-status checks further up, because those run before isAttack is declared.
    if (isAttack && selfStatuses.has('invisible')) {
      edge = true;
      addSource('selfInvisible', this._localize('E20.StatusInvisible'), { edge: true });
    }

    // The Quiet One - see helpers/quiet-one.mjs's own doc comment. A persistent, turn-scoped
    // self-Edge (checked live, same shape as Shining Leader/CBRN Defender's own flag-checked-
    // directly idioms just below), not a one-shot consumed bank.
    if (rolledSkill == 'infiltration' && getQuietOneEdge(actor)) {
      edge = true;
      addSource('quietOne', 'The Quiet One', { edge: true });
    }

    // CBRN Defender's own Hang-Up - see helpers/cbrn-defender.mjs's own doc comment. A persistent
    // scene-scoped debuff (checked directly, same shape as Shining Leader/Rallying Cry above), not
    // a one-shot consumed bank - it applies to every attack for the rest of the scene, not just
    // the next one.
    const cbrnDefenderShiftDown = isAttack ? getCbrnDefenderShiftDown(actor) : 0;
    if (cbrnDefenderShiftDown) {
      shiftDown += cbrnDefenderShiftDown;
      addSource('cbrnDefender', findHangUp(actor, CBRN_DEFENDER_HANG_UP_ID)?.name ?? 'CBRN Defender', { shiftDown: cbrnDefenderShiftDown });
    }

    // Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - see
    // helpers/covering-fire.mjs's own doc comment. Unlike every other unscoped Snag bank in this
    // function, this only applies on the banked actor's own next ATTACK specifically ("if THEY
    // attack"), not any Skill Test.
    if (isAttack && getPendingBonus(actor, COVERING_FIRE_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(COVERING_FIRE_SNAG_FLAG);
      addSource('coveringFireSnag', 'Covering Fire', { snag: true });
    }

    if (isMelee && selfStatuses.has('prone')) {
      shiftDown += 1;
      addSource('selfProne', this._localize('E20.StatusProne'), { shiftDown: 1 });
    }

    // Accurate / Inaccurate (standard weapon traits shared across every game line - e.g. PR CRB's
    // Enhance (Attack) Zord Feature grants "Accurate (↑1)", Decepticon Directive's Weapon
    // Conversion grants "Inaccurate (↓1)"): a flat ↑1/↓1 on the attack. Both existed in
    // E20.weaponTraits as selectable labels with nothing reading them anywhere - the same dead-enum
    // gap 'linked' had. Read off the PARENT weapon's own traits array (same idiom as the 'linked'/
    // 'ballistic' checks elsewhere in this file), NOT the weaponEffect's own system.shiftDown field,
    // which stays reserved for an effect's own printed shift (an Alternate Effect's -1, Weapon
    // Conversion's one-time mutation). That separation is what keeps this from double-counting:
    // every compendium weapon carrying either trait has its effects at shiftDown 0 today (the only
    // non-zero values sit on Alternate Effects of ACCURATE weapons, i.e. the unrelated alt-effect
    // penalty). A weapon carrying both traits (Horseman's Lance does) nets to zero via
    // _getFinalShift's own shiftUp - shiftDown, with each still listed as its own toggleable source.
    const attackWeapon = isAttack ? this._getParentWeapon(actor, item) : null;
    const attackWeaponTraits = attackWeapon?.system.traits;
    if (attackWeaponTraits?.includes('accurate')) {
      // Magnitude defaults to 1 - see weapon.mjs's own accurateMagnitude/inaccurateMagnitude doc
      // comment for the printed exceptions (Cannonade/Catapult, Transdagger Star Formation) this
      // exists for.
      const accurateMagnitude = attackWeapon.system.accurateMagnitude || 1;
      shiftUp += accurateMagnitude;
      addSource('accurateWeapon', this._localize('E20.WeaponTraitAccurate'), { shiftUp: accurateMagnitude });
    }

    if (attackWeaponTraits?.includes('inaccurate')) {
      const inaccurateMagnitude = attackWeapon.system.inaccurateMagnitude || 1;
      shiftDown += inaccurateMagnitude;
      addSource('inaccurateWeapon', this._localize('E20.WeaponTraitInaccurate'), { shiftDown: inaccurateMagnitude });
    }

    // Resolved for ANY roll, not just weaponEffect attacks - see this function's own doc comment
    // above for why (a plain Skill Test can have a real target too, and First Strike just below
    // needs it regardless of isAttack).
    const targetToken = game.user.targets.first();
    const target = targetToken?.actor;
    let enemyNumberOneTankId = null;
    let spottedTarget = null;
    let eyeForAppraisalTarget = null;
    // The per-target riders, Fanatic and the result - run at the end, or straight away for a plain
    // Skill Test against someone (see the `if (!isAttack)` below).
    const finish = () => {
      // Per-target modifiers, stances, marks and nearby devices - helpers/target-riders.mjs.
      const riders = rollRiderSources(actor, target, {
        item, rolledSkill, rolledEssence, isAttack, isMelee, isShove: !!rollDataset?.isShove, pendingShiftDown: shiftDown - shiftUp,
        concentratedFire: !!rollDataset?.concentratedFire, dataset: rollDataset,
      });
      for (const source of [...riders.sources, ...scarefyingSources(actor, rolledSkill)]) {
        shiftUp += source.shiftUp;
        shiftDown += source.shiftDown;
        edge ||= source.edge;
        snag ||= source.snag;
        addSource(source.id, source.label, source);
      }

      // Move Like a Song (Green Ranger, Survival Boon choice, p.44): the first attack that targets the
      // holder each round has a Snag - or, if it already has one, misses outright. Checked here, after
      // the rider and item-rule sources above, so it sees every Snag this roll has.
      if (target && game.combat && actorHasPerk(target, MOVE_LIKE_A_SONG_ID)
        && !hasUsedThisRound(target, MOVE_LIKE_A_SONG_ROUND_FLAG)) {
        if (snag) {
          forcedMiss = true;
        } else {
          snag = true;
          addSource('moveLikeASong', findPerk(target, MOVE_LIKE_A_SONG_ID)?.name ?? 'Move Like a Song', { snag: true });
        }

        moveLikeASongTriggered = true;
      }

      // Fanatic - checked last, against everything above.
      const fanatic = fanaticCap(actor, shiftUp, shiftDown);
      if (fanatic) {
        shiftUp += fanatic.shiftUp;
        addSource(fanatic.id, fanatic.label, fanatic);
      }

      return {
        ...(riders.consumes.length ? { riderConsumes: riders.consumes } : {}),
        shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId, tooCloseForMinimumRange,
        pendingBonusesToClear, bonusDie, forcedMiss, moveLikeASongTriggered, spottedTarget, eyeForAppraisalTarget,
        sources, oorahDamageBonus, goinHeelsDamageBonus, isCatchOffGuardAttempt, rumbleInTheJungleEligible,
        exterminatorEligible, twoHeadsAssistanceConsumed, balanceOfJusticeTriggered,
        disgustTriggered, dontUnderestimateMeTriggered,
      };
    };

    if (target) {
      /* The Defend action (GI Joe CRB p.196): "all attacks against you from adversaries and
         effects you can see suffer a Snag on their Attack Skill Test."

         Read off the target rather than banked on the attacker, because the defender does not
         know who will attack them - that is the whole shape of the action. The Condition is
         applied by helpers/named-actions.mjs and cleared at the start of the defender's next
         turn by documents/combat.mjs#_onStartTurn.

         Gated on isAttack: RAW says "attacks against you", not any Skill Test, so a Persuasion
         test aimed at someone who is Defending is unaffected.

         The "you can see" qualifier is deliberately NOT enforced - this system has no model of
         which adversaries an actor is aware of, and deriving one from token vision would be
         wrong about darkness, cover and every Perk that grants awareness. The Snag annotates
         the Roll Options Dialog with its own name, so a GM ruling the defender never saw this
         one coming just puts the radio back to Normal. */
      // Vehicle Upgrades and traits against the attacker - Spiked, Shielded, a Tinted Canopy over an
      // occupant (helpers/vehicle-upgrades.mjs). Ablative Armor, JAFF and Tricked-Out Hydraulics are
      // incoming item rules now.
      if (isAttack) {
        const attackerToken = actor.getActiveTokens?.()?.[0];
        const adjacent = !!attackerToken && !!targetToken && !!canvas?.grid
          && canvas.grid.measurePath([attackerToken.center, targetToken.center]).distance <= 5;
        const defenderMods = defenderSources(actor, item, target, {
          weaponTraits: this._getParentWeapon(actor, item)?.system?.traits ?? [],
          melee: item.system.classification?.style == 'melee',
          adjacent,
        });
        for (const source of defenderMods) {
          shiftDown += source.shiftDown ?? 0;
          snag ||= !!source.snag;
          sources.push({ id: `vehicle-${source.id}`, label: source.label, shiftUp: 0, shiftDown: source.shiftDown ?? 0, edge: false, snag: !!source.snag, declinedDamage: source.declinedDamage ?? null });
        }

        spendDefenderSources(target, defenderMods);
      }

      if (isAttack && target.statuses?.has(DEFENDING_STATUS) && !ignoresDefend(this._getParentWeapon(actor, item))) {
        snag = true;
        addSource('defending', this._localize('E20.StatusDefending'), { snag: true });
      }

      // Energy (PR CRB): "Energy weapons gain ↑1 on attacks against all Threats in their grown form."
      if (item?.type == 'weaponEffect' && this._getParentWeapon(actor, item)?.system?.traits?.includes('energy')
        && isGrownThreat(target)) {
        shiftUp += 1;
        addSource('energyVsGrown', this._localize('E20.WeaponTraitEnergy'), { shiftUp: 1 });
      }

      // Retrogen - see helpers/retrogen.mjs's own doc comment. Automatic only when the target
      // plainly has Genetic Alterations; otherwise rollSkill offers retrogenAvailable's toggle.
      if (isAttack && isRetrogenWeapon(this._getParentWeapon(actor, item)) && hasGeneticAlterations(target)) {
        shiftUp += 1;
        addSource('retrogen', this._localize('E20.WeaponTraitRetrogen'), { shiftUp: 1 });
      }

      // First Strike (7th level): "you gain an Edge on Attacks... against opponents who haven't
      // acted yet in combat." RAW also covers plain Skill Tests against such an opponent, and
      // this check touches no weapon/damage fields, so - unlike everything else in this block -
      // it isn't gated behind isAttack.
      if (game.combat && actorHasPerk(actor, FIRST_STRIKE_ID)) {
        const targetCombatant = game.combat.combatants.find(c => c.actor?.uuid == target.uuid);
        const targetHasNotActedYet = targetCombatant
          && game.combat.turns.indexOf(targetCombatant) > game.combat.turn;
        if (targetHasNotActedYet) {
          edge = true;
          addSource('firstStrike', findPerk(actor, FIRST_STRIKE_ID)?.name ?? 'First Strike', { edge: true });
        }
      }

      /* Lend Assistance, attack half (GI Joe CRB p.197): "Until the beginning of your next
         turn, the first attack against the specific target gains an Edge."

         Banked on the ALLY (this roller) scoped to the target the assister named, the same
         shape as Menacing Glare's own Edge just below. "The first attack" is what the clear
         implements: it is consumed here whether it hits or misses, which is what "first"
         means.

         Gated on isAttack - the grant is about "hitting an enemy target in combat", and the
         action's other half already covers helping with a plain Skill Test.

         The "until the beginning of your next turn" clause is not separately enforced, matching
         every other banked bonus here (see perks.mjs#bankPendingBonus). */
      const pendingLendAssistanceEdge = isAttack
        ? getPendingBonus(actor, LEND_ASSISTANCE_EDGE_FLAG) : null;
      if (pendingLendAssistanceEdge && pendingLendAssistanceEdge.targetId == target.id) {
        edge = true;
        pendingBonusesToClear.push(LEND_ASSISTANCE_EDGE_FLAG);
        addSource('lendAssistance', this._localize('E20.ActionLendAssistance'), { edge: true });
      }

      // Menacing Glare's own Edge effect (Dark Ranger, 2nd level, p.39) - "you have Edge on the
      // next Skill Test you make against the target." Scoped to this specific target (by id) -
      // the first "self-Edge that only applies against one specific other actor" flag in this
      // codebase, unlike every other self-banked Edge (Think On It, etc.) which applies to any
      // roll. Not gated on isAttack - RAW says "Skill Test," not "Attack."
      const pendingMenacingGlareEdge = getPendingBonus(actor, MENACING_GLARE_EDGE_FLAG);
      if (pendingMenacingGlareEdge && pendingMenacingGlareEdge.targetId == target.id) {
        edge = true;
        pendingBonusesToClear.push(MENACING_GLARE_EDGE_FLAG);
        addSource('menacingGlareEdge', 'Menacing Glare', { edge: true });
      }

      // Growl - see GROWL_ID's own comment above / helpers/growl.mjs. Same "self-bonus scoped to
      // one specific other actor" shape as Menacing Glare's own Edge just above, but a shiftUp and
      // gated on isAttack ("your attacks against that target," not any Skill Test).
      const pendingGrowlShiftUp = isAttack ? getPendingBonus(actor, GROWL_SHIFT_UP_FLAG) : null;
      if (pendingGrowlShiftUp && pendingGrowlShiftUp.targetId == target.id) {
        shiftUp += 1;
        pendingBonusesToClear.push(GROWL_SHIFT_UP_FLAG);
        addSource('growl', findPerk(actor, GROWL_ID)?.name ?? 'Growl', { shiftUp: 1 });
      }

      // Antagonistic - see ANTAGONISTIC_SNAG_FLAG's own comment above / helpers/antagonistic.mjs.
      // Banked on the debuffed creature (the current ROLLER here), scoped to a specific
      // beneficiary - the mirror image of Growl's own "self-bonus scoped to one specific other
      // actor" shape, just Snag instead of shiftUp and suffered by the banked-on actor instead of
      // granted to them. Gated on isAttack ("Snag on attacks that target you").
      const pendingAntagonisticSnag = isAttack ? getPendingBonus(actor, ANTAGONISTIC_SNAG_FLAG) : null;
      if (pendingAntagonisticSnag && pendingAntagonisticSnag.beneficiaryId == target.id) {
        snag = true;
        pendingBonusesToClear.push(ANTAGONISTIC_SNAG_FLAG);
        addSource('antagonisticSnag', 'Antagonistic', { snag: true });
      }

      // Face Me! - see FACE_ME_COMPELLER_FLAG's own comment above / helpers/face-me.mjs. The
      // mirror image of Antagonistic's Snag just above - downshift 2 on an Attack against anyone
      // OTHER than the compelling holder, instead of a Snag against one specific person. Unlike
      // Growl/Antagonistic's own flags (only cleared on a MATCHING roll), this clears on ANY
      // qualifying Attack regardless of who it targets - the compelled creature's "attack them or
      // don't" choice is resolved the moment they attack ANYONE, not just a specific target.
      const pendingFaceMeCompeller = isAttack ? getPendingBonus(actor, FACE_ME_COMPELLER_FLAG) : null;
      if (pendingFaceMeCompeller) {
        pendingBonusesToClear.push(FACE_ME_COMPELLER_FLAG);
        if (pendingFaceMeCompeller.holderId != target.id) {
          shiftDown += 2;
          addSource('faceMe', 'Face Me!', { shiftDown: 2 });
        }
      }

      // Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21) - see
      // helpers/get-to-know.mjs's own doc comment. Same "self-Edge scoped to one specific other
      // actor" shape as Menacing Glare/Shattered Memories above, but ALSO scoped to the chosen
      // Skill (RAW's own "a Skill Test related to them," not any Skill Test against them).
      const pendingGetToKnowEdge = getPendingBonus(actor, GET_TO_KNOW_EDGE_FLAG);
      if (pendingGetToKnowEdge && pendingGetToKnowEdge.targetId == target.id
        && pendingGetToKnowEdge.skill == rolledSkill) {
        edge = true;
        pendingBonusesToClear.push(GET_TO_KNOW_EDGE_FLAG);
        addSource('getToKnowEdge', 'Get To Know', { edge: true });
      }

      // Spite (Dark Ranger, 2nd level, p.39) - see helpers/spite.mjs's own doc comment. Scoped to
      // this specific target (by uuid, matching how the chat button banked it) AND gated on
      // isAttack, unlike Menacing Glare's own unscoped-to-any-Skill-Test Edge above.
      const pendingSpiteEdge = getPendingBonus(actor, SPITE_EDGE_FLAG);
      if (isAttack && pendingSpiteEdge && pendingSpiteEdge.targetUuid == target.uuid) {
        edge = true;
        pendingBonusesToClear.push(SPITE_EDGE_FLAG);
        addSource('spite', 'Spite', { edge: true });
      }

      // Outfoxed (Tricky Hang-Up, p.63) - see OUTFOXED_ID's own comment above. Banked on the
      // creature who benefits (the one Infiltration was rolled against) scoped to the specific
      // actor who failed - same "self-Edge scoped to one specific other actor" shape Menacing
      // Glare's own Edge effect already established, just banked on the opposite side.
      const pendingOutfoxedEdge = getPendingBonus(actor, OUTFOXED_EDGE_FLAG);
      if (pendingOutfoxedEdge && pendingOutfoxedEdge.targetId == target.id) {
        edge = true;
        pendingBonusesToClear.push(OUTFOXED_EDGE_FLAG);
        addSource('outfoxed', 'Outfoxed', { edge: true });
      }

      // Glow (Knights of Canterlot, Elementary Aid spell, p.42) - see helpers/glow.mjs's own doc
      // comment. "Anyone trying to spot you gains Edge" - reciprocal, the TARGET is glowing and
      // the ROLLER benefits, same shape as Skepticism/See Something Say Nothing below but helping
      // the roller instead of hurting them. "Spot" is read as an Alertness Skill Test, not gated
      // on isAttack.
      if (rolledSkill == 'alertness' && isGlowActive(target)) {
        edge = true;
        addSource('glow', 'Glow', { edge: true });
      }

      // Don't-Notice-Me-Field - reciprocal half: see helpers/dont-notice-me-field.mjs's own doc
      // comment. "Creatures looking for them suffer Snag on Awareness Skill Tests to notice
      // them" - "Awareness" read as this system's own Alertness Skill, same mirror-image
      // reciprocal shape as Skepticism/See Something Say Nothing below.
      if (rolledSkill == 'alertness' && isDontNoticeMeFieldActive(target)) {
        snag = true;
        addSource('dontNoticeMeFieldReciprocal', "Don't-Notice-Me-Field", { snag: true });
      }

      // Whatever We Need (PR CRB, Black Ranger, 2nd level, p.33) - see
      // helpers/whatever-we-need.mjs's own doc comment. Same "self-Edge scoped to one specific
      // other actor" shape as Menacing Glare's own Edge effect above, but ALSO scoped to 3 named
      // skills and never cleared (banked via a plain designation, not a one-shot consumption).
      if (checkWhateverWeNeed(actor, target, rolledSkill)) {
        edge = true;
        addSource('whateverWeNeed', 'Whatever We Need', { edge: true });
      }

      // Glittermane (Knights of Canterlot, Superior Utility spell, p.46) - see
      // helpers/glittermane.mjs's own doc comment. "All attempts to target you with spells,
      // ranged attacks or melee weapons suffer ↓1" - reciprocal like Glow above, but gated on
      // isAttack (RAW names Attacks specifically, not any Skill Test).
      if (isAttack && isGlittermaneActive(target)) {
        shiftDown += 1;
        addSource('glittermane', 'Glittermane', { shiftDown: 1 });
      }

      // Just the Facts (Analyst, 16th level, p.62): "Immune to Deception Skill Tests from
      // creatures your level or lower and Resistant to Deception Skill Tests from creatures
      // higher level than you." "You" here is the Perk holder being deceived, i.e. this
      // function's target, not the roller - same reciprocal shape as Alpha Strike's own check
      // below, just not gated behind isAttack since Deception is never a weaponEffect. Only the
      // Resistant (Snag) case is handled here; the Immune case (a guaranteed failure, not just a
      // worse die) is applied per-target against rollSkill()'s own checkEntries difficulty
      // instead - see this function's own doc comment above.
      if (rolledSkill == 'deception' && actorHasPerk(target, JUST_THE_FACTS_ID)
        && getEffectiveLevel(actor) > getEffectiveLevel(target)) {
        snag = true;
        addSource('justTheFacts', findPerk(target, JUST_THE_FACTS_ID)?.name ?? 'Just the Facts', { snag: true });
      }

      // Emotional Mastery: Disgust (A Jump Through Time, Purple Ranger, p.37) - "The first Skill
      // Test to target you each turn suffers ↓1." RAW says "Skill Test," not "Attack," so - like
      // First Strike/Just the Facts just above - this isn't gated behind isAttack. Same
      // hasUsedThisTurn-gated, reported-back-for-rollSkill()-to-mark shape as Move Like a Song's
      // own identical "first attack each round" clause further down (that one IS Attack-gated,
      // per its own RAW wording).
      if (game.combat && isEmotionalMasteryOptionActive(target, 'disgust') && !hasUsedThisTurn(target, DISGUST_TURN_FLAG)) {
        shiftDown += 1;
        addSource('disgust', 'Disgust (Emotional Mastery)', { shiftDown: 1 });
        disgustTriggered = true;
      }

      // Martial Artist (Hang-Up, "goad you into action") is a Roll Options Dialog switch, not
      // automatic - an incoming item rule on the Hang-Up.

      // Shadow ("those who attempt to detect you") is a Roll Options Dialog switch, not automatic -
      // helpers/extensions/fix3-dice/shadow.mjs.

      // Your Safety's On's own Critical Success half - see YOUR_SAFETYS_ON_ALL_ATTACKS_FLAG's own
      // comment above. Reciprocal (checked against the TARGET's own flag), gated on isAttack -
      // "all attacks" reads as Attack Skill Tests specifically, unlike the Success half's own
      // unscoped "next Skill Test."
      if (isAttack && game.combat) {
        const yourSafetysOnFlag = target.getFlag?.('essence20', YOUR_SAFETYS_ON_ALL_ATTACKS_FLAG);
        if (yourSafetysOnFlag && yourSafetysOnFlag.combatId == game.combat.id
          && (game.combat.round == yourSafetysOnFlag.round || game.combat.round == yourSafetysOnFlag.round + 1)) {
          snag = true;
          addSource('yourSafetysOnAllAttacks', "Your Safety's On", { snag: true });
        }
      }

      // Hierarchy Rank - see HIERARCHY_RANK_ID's own comment above. Not gated on isAttack - RAW
      // says "Skill Tests," not "Attacks."
      if (actorHasPerk(actor, HIERARCHY_RANK_ID)) {
        const actorLevel = getEffectiveLevel(actor);
        const targetLevel = getEffectiveLevel(target);
        if (actorLevel > targetLevel) {
          shiftUp += 1;
          addSource('hierarchyRank', findPerk(actor, HIERARCHY_RANK_ID)?.name ?? 'Hierarchy Rank', { shiftUp: 1 });
        } else if (actorLevel < targetLevel) {
          shiftDown += 1;
          addSource('hierarchyRank', findPerk(actor, HIERARCHY_RANK_ID)?.name ?? 'Hierarchy Rank', { shiftDown: 1 });
        }
      }

      // Grid Soldier (A Jump Through Time, General Perk, p.54, built 2026-09-12) - the Threat
      // Level comparison half only; the "spend Power to remove Impaired" half is dispatched in
      // banked-buffs.mjs instead. Same getEffectiveLevel PC-Level/NPC-Threat-Level equivalence as
      // Hierarchy Rank just above, not gated on isAttack (RAW says "Skill Tests").
      if (actorHasPerk(actor, GRID_SOLDIER_ID) && getEffectiveLevel(actor) - getEffectiveLevel(target) >= 3) {
        shiftUp += 1;
        addSource('gridSoldier', findPerk(actor, GRID_SOLDIER_ID)?.name ?? 'Grid Soldier', { shiftUp: 1 });
      }

      // Big And Scary, Bend A Knee Or Stand Tall, Big Preds Are My Specialty and The Bigger The
      // Heart (size-difference upshifts against the target) are item rules on each Perk.

      // Dogfighter (Across the Stars, General Perk, p.68): "While the primary pilot of any
      // vehicle of Extended II size or smaller that uses an Aerial Movement type: Edge on
      // Driving and Targeting Skill Tests against other vehicles using the Aerial Movement
      // type." Only this Edge half is built - the Perk's other clause ("your vehicle gains +2
      // Evasion Defense") would need a touch-point in getDefenseValue() keyed on who's piloting
      // the DEFENDING vehicle, not built this pass. Checked via _getPilotedVehicle (the reverse
      // of _getVehicleDriver - see its own doc comment), since Dogfighter is held by, and rolled
      // from, the PILOT, not the vehicle. Not gated behind isAttack - RAW says "Skill Tests."
      // Vehicle/Zord actors' own system.movement.<type>.total is never (re)computed
      // (_prepareMovement() is gated to playerCharacter actors only - see actor.mjs's own
      // comment on this), so .base is checked directly instead, same fallback
      // _prepareMegaformCombinerData() already uses for a non-playerCharacter component.
      if ((rolledSkill == 'driving' || rolledSkill == 'targeting') && target?.type == 'vehicle'
        && target.system.movement.aerial.base > 0 && actorHasPerk(actor, DOGFIGHTER_ID)) {
        const pilotedVehicle = this._getPilotedVehicle(actor, 'driver');
        const sizeOrder = Object.keys(E20.actorSizes);
        const pilotedVehicleIndex = pilotedVehicle ? sizeOrder.indexOf(pilotedVehicle.system.size) : -1;
        const pilotedVehicleQualifies = pilotedVehicle && pilotedVehicleIndex != -1
          && pilotedVehicleIndex <= sizeOrder.indexOf('extended2')
          && pilotedVehicle.system.movement.aerial.base > 0;
        if (pilotedVehicleQualifies) {
          edge = true;
          addSource('dogfighter', findPerk(actor, DOGFIGHTER_ID)?.name ?? 'Dogfighter', { edge: true });
        }
      }

      // Mark Target (Scout, 2nd level, p.84): "designate a creature... you gain +1 on Skill Tests
      // related to that creature until the end of the scene." Marked via helpers/mark-target.mjs
      // (a plain actor flag, no dialog needed - RAW's own "designate" is a Free declaration, not a
      // roll). Applies to ANY roll against the marked creature, not just attacks - unlike Informed
      // Accuracy below, which RAW explicitly scopes to attacks - so this isn't gated on isAttack.
      // "Until the end of the scene" has no scene boundary to hook (same unenforced-duration gap
      // as everywhere else) - it lasts until the actor marks a new target instead.
      if (checkMarkTarget(actor, target)) {
        shiftUp += 1;
        addSource('markTarget', 'Mark Target', { shiftUp: 1 });
      }

      // Primary Quarry (Decepticon Directive, Tracker Focus, 1st level, p.55) - see
      // helpers/primary-quarry.mjs's own doc comment. Same "any roll against the designated
      // creature" approximation as Mark Target just above, and explicitly RAW-stacks with it (a
      // separate flag/addSource entry, both can fire on the same roll).
      if (checkPrimaryQuarry(actor, target)) {
        shiftUp += 1;
        addSource('primaryQuarry', 'Primary Quarry', { shiftUp: 1 });
      }

      // Known Accomplices (Decepticon Directive, Tracker Focus, 6th level, p.55/56) - see
      // helpers/known-accomplices.mjs's own doc comment. Same "any roll against the designated
      // creature" approximation as Primary Quarry just above; unlike that Perk, the Energon spend
      // already happened at designation time (helpers/known-accomplices.mjs#designateKnownAccomplice),
      // not here.
      if (checkKnownAccomplice(actor, target)) {
        shiftUp += 1;
        addSource('knownAccomplices', 'Known Accomplices', { shiftUp: 1 });
      }

      // Nemesis (Specific Threat) (Across the Stars, General Perk, p.70) - "When facing your
      // Nemesis, you gain ↑2 to all Skill Tests." Same "any roll against the marked creature, not
      // just Attacks" shape as Mark Target just above (declared via helpers/nemesis.mjs, a plain
      // actor flag - no roll to designate one). The reroll half isn't built - see that file's own
      // doc comment.
      if (checkNemesis(actor, target)) {
        shiftUp += 2;
        addSource('nemesis', 'Nemesis (Specific Threat)', { shiftUp: 2 });
      }

      // Concentrate Fire (Vanguard base, 15th level, p.109): "you and each ally who attacks that
      // target gain an upshift 2 to their attack roll." Unlike Mark Target just above, the mark
      // lives on the TARGET (see helpers/concentrate-fire.mjs's own doc comment) so ANY attacker
      // benefits, not just whoever designated it - gated on isAttack, matching RAW's own "attack
      // roll" wording.
      if (isAttack && isConcentrateFireTarget(target)) {
        shiftUp += 2;
        addSource('concentrateFire', 'Concentrate Fire', { shiftUp: 2 });
      }

      // Revengeful - see REVENGEFUL_ID's own comment in _rollSkillHelper's post-hit processing
      // above. A live, non-consumed flag (not added to pendingBonusesToClear) since it applies to
      // every qualifying attack in the window, not just the first.
      if (isAttack) {
        const pendingRevengeful = actor.getFlag?.('essence20', 'pendingRevengeful');
        if (pendingRevengeful && pendingRevengeful.attackerUuid == target.uuid) {
          shiftUp += 1;
          addSource('revengeful', 'Revengeful', { shiftUp: 1 });
        }
      }

      // Inundation (GI Joe CRB, Battlefield Psychologist Focus, 10th level, p.86): "Whenever you
      // use Outwit on an enemy previously affected by your Outwit Skill Test, you gain an Edge on
      // any new Outwit Skill Test during this combat." Not gated on isAttack - Outwit's own roll
      // is a plain (non-weaponEffect) Skill Test, so this has to sit BEFORE the `if (!isAttack)`
      // early return just below (the same placement Observer/Zeal's own non-attack-compatible
      // checks already use), not after it like Informed Accuracy's attack-only counter. "In this
      // combat" is approximated as "ever" (no combat-scoped reset), the same simplification
      // Informed Accuracy's own identical counter already accepts.
      if ((rolledSkill == 'deception' || rolledSkill == 'intimidation') && actorHasPerk(actor, INUNDATION_ID)
        && actor.getFlag?.('essence20', OUTWITTED_TARGETS_FLAG)?.[target.uuid.replace(/\./g, '-')]) {
        edge = true;
        addSource('inundation', findPerk(actor, INUNDATION_ID)?.name ?? 'Inundation', { edge: true });
      }

      // Don't Underestimate Me - see DONT_UNDERESTIMATE_ME_ID's own comment above. Checked here,
      // before the `if (!isAttack)` early return just below, since RAW covers a plain contested
      // Skill Test too, not just an Attack. This function is synchronous and can't mark the
      // once-per-scene flag itself - reports back via dontUnderestimateMeTriggered, rollSkill()
      // marks it afterward.
      if (actorHasPerk(target, DONT_UNDERESTIMATE_ME_ID) && !this._isUnawareOfAttacker(target, actor)
        && !getUsesThisScene(target, DONT_UNDERESTIMATE_ME_SCENE_FLAG)) {
        snag = true;
        addSource(
          'dontUnderestimateMe', findPerk(target, DONT_UNDERESTIMATE_ME_ID)?.name ?? "Don't Underestimate Me", { snag: true },
        );
        dontUnderestimateMeTriggered = true;
      }

      // A plain Skill Test against someone skips the attack-only checks below, but not the per-target
      // riders and Fanatic at the end (item rules, incoming rules and banked bonuses ride on those).
      if (!isAttack) {
        return finish();
      }

      // Fight Me! (Beneath the Helmet, Graphite Ranger, 2nd level, p.46) - see
      // helpers/fight-me.mjs's own doc comment. Checks the ROLLER's own mark (they may be the
      // Threat someone else marked), downshifting an Attack against anyone but their marker.
      if (checkFightMeDownshift(actor, target)) {
        shiftDown += 1;
        addSource('fightMe', 'Fight Me!', { shiftDown: 1 });
      }

      // Mysterious Aura - Resplendent (A Jump Through Time, White Spectrum Modification,
      // replaces Follow Me!, p.45) - see helpers/mysterious-aura.mjs's own doc comment. Same
      // ranged-only reciprocal downshift shape as Distraction just above.
      if (!isMelee && hasNearbyResplendentAura(target)) {
        shiftDown += 1;
        addSource('mysteriousAuraResplendent', 'Mysterious Aura (Resplendent)', { shiftDown: 1 });
      }

      // Combat Stance (Through the Shattered Grid, Magna Defender, 1st level, p.23-24) - see
      // helpers/combat-stance.mjs's own doc comment. "Attack Skill Tests against your chosen foe"
      // - target-scoped, isAttack-gated (unlike Mark Target's own any-Skill-Test scope). The
      // damage-spend half lives in rollSkill's own Roll Options Dialog checkbox instead.
      if (checkCombatStance(actor, target)) {
        const combatStanceShiftUp = getCombatStanceNumber(actor);
        shiftUp += combatStanceShiftUp;
        addSource('combatStance', findPerk(actor, COMBAT_STANCE_ID)?.name ?? 'Combat Stance', { shiftUp: combatStanceShiftUp });
      }

      // Worst Nightmare - see WORST_NIGHTMARE_ID's own comment above. "↑1 ... or an Edge": when
      // the holder caused the Frightened, helpers/target-riders.mjs gives the Edge INSTEAD, so the
      // ↑1 is skipped here rather than stacking both.
      if (target.statuses?.has('frightened') && actorHasPerk(actor, WORST_NIGHTMARE_ID)
        && !hasConditionFrom(target, 'frightened', actor)) {
        shiftUp += 1;
        addSource('worstNightmare', findPerk(actor, WORST_NIGHTMARE_ID)?.name ?? 'Worst Nightmare', { shiftUp: 1 });
      }

      // When Push Comes To Shove - see WHEN_PUSH_COMES_TO_SHOVE_ID's own comment above.
      let attackerSizeForSizeShift = actor.system.size;
      if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
        && actorHasPerk(actor, WHEN_PUSH_COMES_TO_SHOVE_ID)) {
        const sizeLadder = Object.keys(E20.actorSizes);
        const currentIndex = sizeLadder.indexOf(actor.system.size);
        if (currentIndex != -1 && currentIndex < sizeLadder.length - 1) {
          attackerSizeForSizeShift = sizeLadder[currentIndex + 1];
        }
      }

      const sizeShift = this._getSizeShift(attackerSizeForSizeShift, target.system.size);
      shiftUp += sizeShift;
      if (sizeShift) {
        addSource('size', this._localize('E20.CombatModifierSize'), { shiftUp: sizeShift });
      }

      // Grappling's own Size downshift (GI Joe CRB, Chapter 9: Combat, p.200) - see
      // JACKET_WRESTLER_ID's own comment above for the full discussion. Additive with the generic
      // sizeShift above (a different table entirely), capped at 2 per RAW's own "up to two."
      // Jacket Wrestler suppresses it outright.
      if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
        && !actorHasPerk(actor, JACKET_WRESTLER_ID)) {
        const grappleSizeOrder = Object.keys(E20.actorSizes);
        const grappleAttackerIndex = grappleSizeOrder.indexOf(actor.system.size);
        const grappleTargetIndex = grappleSizeOrder.indexOf(target.system.size);
        const grappleSizeDownshift = grappleAttackerIndex != -1 && grappleTargetIndex != -1
          ? Math.min(Math.max(grappleTargetIndex - grappleAttackerIndex, 0), 2)
          : 0;
        if (grappleSizeDownshift) {
          shiftDown += grappleSizeDownshift;
          addSource(
            'grappleSize', this._localize('E20.CombatModifierGrappleSize'), { shiftDown: grappleSizeDownshift },
          );
        }
      }

      // Team Focus (Red Ranger, 9th/18th level, p.53) - see helpers/team-focus.mjs's own doc
      // comment for the round-granularity approximation of "since your last turn."
      if (isMelee && checkTeamFocus(actor, target, TEAM_FOCUS_ID)) {
        const teamFocusShiftUp = findPerk(actor, TEAM_FOCUS_ID).system.advances.currentValue;
        shiftUp += teamFocusShiftUp;
        addSource('teamFocus', findPerk(actor, TEAM_FOCUS_ID)?.name ?? 'Team Focus', { shiftUp: teamFocusShiftUp });
      }

      // Gang Up (Finster's Monster-Matic Cookbook, Path of Cruelty, Gang Up Role Points, p.282):
      // "gaining the [scaling] bonus... to an attack against a target currently within 5 feet of
      // another being on a Psycho Path." Read directly off the actor's own base Role Points
      // (actor._getBaseRolePoints(), the same lookup rollSkill's own checkbox path already uses
      // for every other rolePoints/attackUpshift grant) rather than that manual checkbox - unlike
      // every OTHER rolePoints attackUpshift, RAW's own trigger here is purely positional, not a
      // player choice, so it's applied as a genuine automatic modifier instead. "On a Psycho
      // Path" is approximated as holding Let's Go Psycho! - this codebase's own single shared
      // compendium Item reused by every one of the 6 Psycho Paths (the same "one shared marker
      // Item stands in for a whole family of sub-Roles" idiom Zordbane's identical "all 6 Psycho
      // Paths" grant already established) - checked on every OTHER token within 5ft of the
      // TARGET (not the attacker) via getAllNearbyTokens, since RAW's proximity is about the
      // target's surroundings, not the attacker's own.
      const gangUpRolePoints = actor._getBaseRolePoints?.();
      const gangUpSourceId = gangUpRolePoints?.flags?.core?.sourceId ?? gangUpRolePoints?._stats?.compendiumSource ?? gangUpRolePoints?.flags?.essence20?.rulesSource;
      if (item?.type == 'weaponEffect' && gangUpSourceId == GANG_UP_ID
        && getAllNearbyTokens(target, 5).some(token => actorHasPerk(token.actor, LETS_GO_PSYCHO_ID))) {
        const gangUpShiftUp = gangUpRolePoints.system.bonus.value;
        shiftUp += gangUpShiftUp;
        addSource('gangUp', gangUpRolePoints.name ?? 'Gang Up', { shiftUp: gangUpShiftUp });
      }

      // Tech Specs - see helpers/tech-specs.mjs's own doc comment. Any Attack (not melee-only),
      // shared with the marking actor's own allies via disposition, the marking actor included.
      if (checkTechSpecsShiftUp(actor, target)) {
        shiftUp += 1;
        addSource('techSpecs', 'Tech Specs', { shiftUp: 1 });

        // Technical Mastery's own Edge widening - see TECHNICAL_MASTERY_ID's own comment above.
        if (checkTechSpecsEdge(actor, target)) {
          edge = true;
          addSource('technicalMastery', 'Technical Mastery', { edge: true });
        }
      }

      // Informed Accuracy (Analyst, 1st level, p.59): "When you attack a creature that you've
      // used Analyze Target on in this combat, you gain an upshift on the attack equal to the
      // number of times you used Analyze Target on them." "In this combat" is approximated as
      // "ever" (the counter has no combat-scoped reset - same unenforced-scope simplification as
      // Mark Target's own "until the end of the scene" above), cleared only when the player
      // chooses to (there's no natural reset point to hook automatically).
      if (isAttack && actorHasPerk(actor, INFORMED_ACCURACY_ID)) {
        const counts = actor.getFlag?.('essence20', ANALYZE_TARGET_COUNTS_FLAG);
        const count = counts?.[target.uuid.replace(/\./g, '-')] ?? 0;
        shiftUp += count;
        if (count) {
          addSource('informedAccuracy', findPerk(actor, INFORMED_ACCURACY_ID)?.name ?? 'Informed Accuracy', { shiftUp: count });
        }
      }


      const targetStatuses = target.statuses;
      // Asleep/Defeated are defined (GI Joe CRB, Conditions, p.225) purely in terms of other
      // Conditions rather than carrying their own rules text - "Sleeping characters are Prone and
      // Unconscious" / "Defeated characters are Prone" - so every check below that keys off Prone
      // or Unconscious also has to fire for a target that's merely Asleep/Defeated, or those two
      // Conditions would silently do only half their job (same class of gap Invisible's own
      // missing attacker-side Edge was, found and fixed 2026-09-15 - see the selfInvisible comment
      // above). Computed once here rather than inlined at each check site below.
      const impliedUnconscious = targetStatuses.has('unconscious') || targetStatuses.has('asleep');
      const impliedProne = targetStatuses.has('prone') || targetStatuses.has('asleep') || targetStatuses.has('defeated');
      // Alpha Strike (Door-Kicker Focus, 3rd level, p.98) - the reciprocal half: "all attacks
      // against you also have an Edge until the beginning of your next turn," approximated at
      // round granularity (see ALPHA_STRIKE_ROUND_FLAG's own doc comment on _isAlphaStrikeAttack
      // above) via the same hasUsedThisRound-shaped flag Quiet as the Grave/Predator Sneak Attack
      // already use for round tracking, just read here instead of gating a new use. Each of these
      // 8 conditions is its own labeled source (rather than one combined "Target Condition"
      // bundle) so a player sees exactly which Condition is granting the Edge.
      const targetGrantsEdge = targetStatuses.has('blinded')
        || targetStatuses.has('grappled')
        || targetStatuses.has('restrained')
        || targetStatuses.has('stunned')
        || impliedUnconscious
        || targetStatuses.has('actingSmaller')
        || (isMelee && impliedProne)
        || hasUsedThisRound(target, ALPHA_STRIKE_ROUND_FLAG);

      if (targetGrantsEdge) {
        edge = true;
      }

      // Two Heads Are Better Than One - see TWO_HEADS_ARE_BETTER_THAN_ONE_ID's own comment above.
      // "The first attack against the specific target gains an Edge" - one-shot, so this function
      // (synchronous, can't clear the actor's own flag itself) reports the consumption back via
      // twoHeadsAssistanceConsumed, the same "report, rollSkill() clears" shape spottedTarget/
      // eyeForAppraisalTarget already establish, just a plain boolean since the actor to clear is
      // always the roller themselves, not a separately-resolved target.
      if (checkTwoHeadsAssistance(actor, target)) {
        edge = true;
        twoHeadsAssistanceConsumed = true;
        addSource('twoHeadsAreBetterThanOne', 'Two Heads Are Better Than One', { edge: true });
      }

      // Exterminator - see EXTERMINATOR_ID's own comment above. "Common or Small size" AND
      // "smaller than you" are two separate conditions RAW states together - both checked, not
      // just the size-order comparison alone (a Common-sized actor attacking a Small target is
      // eligible; a Small actor attacking a same-Small target is not, despite matching the size
      // category, since they aren't actually smaller). The ↑1 is an item rule on the Perk; this only
      // marks the roll for the Reroll condition (rollContext.smallerTarget).
      if (actorHasPerk(actor, EXTERMINATOR_ID)
        && (target.system.size == 'common' || target.system.size == 'small')) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (actorIndex != -1 && targetIndex != -1 && targetIndex < actorIndex) {
          exterminatorEligible = true;
        }
      }

      // Evolved Instincts - see EVOLVED_INSTINCTS_ID's own comment above.
      const evolvedInstinctsZord = actorHasZordFeature(actor, EVOLVED_INSTINCTS_ID)
        ? actor
        : (actorHasZordFeature(this._getPilotedVehicle(actor, 'driver'), EVOLVED_INSTINCTS_ID)
          ? this._getPilotedVehicle(actor, 'driver') : null);
      if (evolvedInstinctsZord && item?.type == 'weaponEffect' && item.system.classification?.style == 'melee') {
        const sizeOrder = Object.keys(E20.actorSizes);
        const zordIndex = sizeOrder.indexOf(evolvedInstinctsZord.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (zordIndex != -1 && targetIndex != -1 && Math.abs(zordIndex - targetIndex) <= 2) {
          shiftUp += 1;
          addSource('evolvedInstincts', findZordFeature(evolvedInstinctsZord, EVOLVED_INSTINCTS_ID)?.name ?? 'Evolved Instincts', { shiftUp: 1 });
        }
      }

      if (targetStatuses.has('blinded')) {
        addSource('targetBlinded', this._localize('E20.StatusBlinded'), { edge: true });
      }

      if (targetStatuses.has('grappled')) {
        addSource('targetGrappled', this._localize('E20.StatusGrappled'), { edge: true });
      }

      if (targetStatuses.has('restrained')) {
        addSource('targetRestrained', this._localize('E20.StatusRestrained'), { edge: true });
      }

      if (targetStatuses.has('stunned')) {
        addSource('targetStunned', this._localize('E20.StatusStunned'), { edge: true });
      }

      if (impliedUnconscious) {
        addSource('targetUnconscious', this._localize('E20.StatusUnconscious'), { edge: true });
      }

      if (targetStatuses.has('actingSmaller')) {
        addSource('targetActingSmaller', this._localize('E20.StatusActingSmaller'), { edge: true });
      }

      if (isMelee && impliedProne) {
        addSource('targetProne', this._localize('E20.StatusProne'), { edge: true });
      }

      if (hasUsedThisRound(target, ALPHA_STRIKE_ROUND_FLAG)) {
        addSource('alphaStrike', findPerk(target, ALPHA_STRIKE_ID)?.name ?? 'Alpha Strike', { edge: true });
      }

      // Spot - see isSpotAttempt's own comment in rollSkill() above for the wider context. RAW:
      // "the first attack against the specific target gains an Edge" - approximated as the very
      // next attack against them from ANYONE (not tracked against the spotting character's own
      // next turn specifically), consumed once. This function is synchronous and can't clear the
      // target's flag itself - reports the target actor back (same "report, rollSkill() clears"
      // shape as debilitatedConsumed/enemyNumberOneTankId above), just keyed on a different actor
      // (the target, not the roller) since that's whose flag needs clearing here.
      if (target.getFlag?.('essence20', 'spotted')) {
        edge = true;
        spottedTarget = target;
        addSource('spot', this._localize(E20.damageTypes.spot), { edge: true });
      }

      // Instill Weakness - see INSTILL_WEAKNESS_ID's own comment above. "All attacks or actions
      // against the target that deal that type of damage gain Edge" - unlike Spot just above, this
      // isn't single-use (see helpers/instill-weakness.mjs's own scene-boundary comment), so it's
      // just a plain re-checkable getter, not a report-and-clear flag.
      if (item?.type == 'weaponEffect' && item.system.damageType
        && getInstillWeaknessDamageType(target) == item.system.damageType) {
        edge = true;
        addSource('instillWeakness', findPerk(actor, INSTILL_WEAKNESS_ID)?.name ?? 'Instill Weakness', { edge: true });
      }

      // Eye for Appraisal (Decepticon Directive Raider, 1st level, p.61) - the marked-target half
      // (see EYE_FOR_APPRAISAL_ID's own comment in helpers/banked-buffs.mjs). "Your next 2 ranged
      // attacks" - self only (unlike Spot's "anyone"), and consumed one use per matching attack
      // rather than cleared outright on the first, so this checks the marking actor's own id and
      // reports the target back for rollSkill() to decrement/clear afterward (same "report, caller
      // clears" shape as spottedTarget above).
      if (!isMelee) {
        const eyeForAppraisalMark = target.getFlag?.('essence20', 'eyeForAppraisalMark');
        if (eyeForAppraisalMark && eyeForAppraisalMark.attackerId == actor.id && eyeForAppraisalMark.usesRemaining > 0) {
          shiftUp += 1;
          eyeForAppraisalTarget = target;
          addSource('eyeForAppraisal', 'Eye for Appraisal', { shiftUp: 1 });
        }
      }

      if (targetStatuses.has('immobilized')) {
        shiftUp += 1;
        addSource('targetImmobilized', this._localize('E20.StatusImmobilized'), { shiftUp: 1 });
      }

      if (targetStatuses.has('invisible')) {
        snag = true;
        addSource('targetInvisible', this._localize('E20.StatusInvisible'), { snag: true });
      }

      // Sadistic - see SADISTIC_HANGUP_ID's own comment above.
      if (isAttack && actorHasHangUp(actor, SADISTIC_HANGUP_ID)) {
        const enemies = getNearbyEnemyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
        const mostConditions = Math.max(0, ...enemies.map(enemy => enemy.statuses?.size ?? 0));
        if (targetStatuses.size < mostConditions) {
          shiftDown += 1;
          addSource('sadistic', findHangUp(actor, SADISTIC_HANGUP_ID)?.name ?? 'Sadistic', { shiftDown: 1 });
        }
      }

      if (!isMelee && impliedProne) {
        snag = true;
        addSource('targetProneRanged', this._localize('E20.StatusProne'), { snag: true });
      }

      // Cover (p.202): "Cover imposes a -2 dice shift on ranged attacks against the character
      // taking cover." Ranged only - melee attacks reach past cover entirely. Total Cover is
      // described as normally un-targetable outright ("can't be targeted directly, although some
      // special attacks may mitigate or eliminate this protection") - not enforced as a hard
      // block here (nothing else in this method blocks a roll, and the book itself treats it as
      // overridable), so it just gets the same -2 automatically instead of a bigger number of its
      // own; "only the highest level of cover applies" per the book anyway, so the two never
      // stack.
      //
      // Penetrating Rounds, Kentucky Windage, Contingency Shot, What Cover?, Lay of the Land,
      // Nowhere's Safe x2, Maximize Cover, Hard Target (TF), Dig In (Cannoneer) and Now You Don't are
      // item Cover rules (coverRules below).
      // Bulwark (Tank Focus, 17th level, p.99): "provide cover to allies adjacent to you" - a
      // live reciprocal check (the target counts as having Cover whenever a planted Bulwark
      // holder is within 5ft), rather than toggling a real 'cover' status on every nearby ally as
      // the Bulwark holder moves (no movement-completion hook exists to keep that in sync). Same
      // "scan canvas.tokens.placeables for a qualifying nearby granter" shape
      // hasNearbyDefendersOathProtection/_hasNearbyProtectorsShieldImmunity already establish.
      const hasBulwarkCover = !isMelee && targetToken && this._hasNearbyBulwarkCover(targetToken);
      // Take Point - see helpers/rough-terrain.mjs#hasTakePointCover. Same "counts as Cover".
      const hasTakePointCoverGrant = hasTakePointCover(target, targetToken);
      // Indirect - see _isIndirectAttack's own doc comment. Unlike the Perk-based bypasses (Cover
      // rules), this one does NOT beat total cover: RAW exempts a target with total cover
      // overhead, and totalCover is exactly that case.
      const indirectIgnoresCover = this._isIndirectAttack(actor, item)
        && !targetStatuses.has('totalCover');
      // Item rules' Cover (rules/adapter.mjs#ruleCover): ignore / reduce on the attacker's side,
      // counts-as-Cover / base / add on the target's.
      const coverRules = ruleCover(isMelee ? null : actor, isMelee ? null : target, { item, rolledSkill, rolledEssence, isAttack, isMelee, dataset: rollDataset });
      if (!isMelee && (targetStatuses.has('cover') || targetStatuses.has('totalCover') || hasBulwarkCover || hasTakePointCoverGrant || coverRules.grant)
        && !indirectIgnoresCover && !coverRules.ignore) {
        // Two Steps to the Right (Enigma of Combination, Surveyor Focus, 10th level, p.36) shares
        // Lay of the Land's -1 (that item's own Cover rule) with allies within 60ft - "open
        // communication" dropped as unenforceable. Only the biggest reduction counts (they don't
        // stack), never below ↓0; the rules' `add` (Dig In while dug in) comes on top.
        const twoStepsReduction = getNearbyAllyTokens(actor, 60)
          .some(token => actorHasPerk(token.actor, TWO_STEPS_TO_THE_RIGHT_ID)) ? 1 : 0;
        const coverShiftDown = Math.max(0, Math.max(2, coverRules.base) - Math.max(twoStepsReduction, coverRules.reduce))
          + coverRules.add;

        shiftDown += coverShiftDown;
        addSource('cover', this._localize('E20.StatusCover'), { shiftDown: coverShiftDown });

        // Thermal Scope / Smart Scope (p.131/153): the weapon "ignores concealment and other
        // penalties for firing through smoke or darkness". Smoke and a wall are both Cover here, so
        // the scope hands the penalty back as its own source - untick it when the Cover is solid.
        const scopedWeapon = this._getParentWeapon(actor, item);
        if (coverShiftDown && (hasUpgrade(scopedWeapon, UPGRADE.thermalScope) || hasUpgrade(scopedWeapon, UPGRADE.smartScope))) {
          shiftUp += coverShiftDown;
          addSource('scopeThroughSmoke', this._localize('E20.UpgradeScopeSmoke'), { shiftUp: coverShiftDown });
        }
      }

      // Dig In, Mega Training Regimen, Steady Footing and Unmovable (Grapple, Shove and Trip attempts
      // against the holder) are incoming item rules on each Perk.

      // Trip (GI Joe CRB, Weapon Effects and Traits, p.148; the WTNV Citizen's Guide, p.59,
      // spells out the actual comparison, sharing this same paragraph with the unbuilt Shove
      // trait there): "Compare the higher of the attacker's Brawn or Finesse to the higher of the
      // target's Brawn or Finesse. If the attacker's Skill is lower, they suffer ↓ equal to the
      // difference in Ranks." A Trip effect is represented by damageType 'knocProne' (see
      // NON_DAMAGE_EFFECT_TYPES's own comment above for how that value was identified from real
      // compendium data), not the generic 'maneuver' value the checks just above key on. Ranks are
      // compared as E20.skillShiftList positions, the same shift-position-delta idiom every other
      // skill-substitution/comparison check in this function already uses.
      if (item.system.damageType == 'knocProne') {
        // E20.skillShiftList is ordered best-to-worst, so a HIGHER index is a WORSE (lower) Rank -
        // "the attacker's Skill is lower" is attackerIndex > targetIndex, same direction every
        // other shift-position-delta check in this function already reads that list in.
        const attackerRoll = actor.getRollData();
        const targetRoll = target.getRollData();
        const attackerIndex = Math.min(
          E20.skillShiftList.indexOf(attackerRoll.skills?.brawn?.shift),
          E20.skillShiftList.indexOf(attackerRoll.skills?.finesse?.shift),
        );
        const targetIndex = Math.min(
          E20.skillShiftList.indexOf(targetRoll.skills?.brawn?.shift),
          E20.skillShiftList.indexOf(targetRoll.skills?.finesse?.shift),
        );
        if (attackerIndex >= 0 && targetIndex >= 0 && attackerIndex > targetIndex) {
          const tripShiftDown = attackerIndex - targetIndex;
          shiftDown += tripShiftDown;
          addSource('trip', this._localize('E20.CombatModifierTrip'), { shiftDown: tripShiftDown });
        }
      }

      // Range for Ranged Attacks (p.201): ranged weaponEffects list two range values - "Range
      // 20ft/80ft" - the first (system.range.value) is the effective normal Range (no penalty
      // within it); the second (system.range.long) is the maximum Range, and the zone between
      // the two suffers a Snag. Some ranged weapons (e.g. a Rocket Launcher) also carry a minimum
      // Range (system.range.min); the book says attacks "can't be made" closer than that - unlike
      // everything else in this method, that's a real hard block, not a shift/Edge/Snag
      // suggestion, so it's reported back as tooCloseForMinimumRange for rollSkill() to refuse
      // the roll outright (before the Roll Options Dialog even opens - see there for why).
      //
      // Ranged Attacks in Close Combat (p.201): "If using a ranged attack within the reach of an
      // enemy, the attack suffers an automatic downshift" - the TARGET's own natural Reach
      // (E20.actorReach, their Size Class's own unarmed melee range), not the attacker's; a
      // Ranged attack made from within arm's reach of its target is what's being penalized here,
      // regardless of how far the attacker itself could otherwise reach.
      const attackerToken = actor.getActiveTokens?.()?.[0];
      if (!isMelee && attackerToken) {
        const distance = this._getDistanceFeet(attackerToken, targetToken);
        // Trajectory (Artillery Focus, 1st level, p.80): "When using a targeting explosive
        // launched weapon, your range is increased by 30 feet." Widens the weapon's own printed
        // range values before any of the distance comparisons below run - same "adjust the raw
        // range numbers up front" shape as every other range-modifying check in this block.
        const trajectoryBonusFeet = item.system.classification?.style == 'explosive'
          && item.system.classification?.skill == 'targeting' && actorHasPerk(actor, TRAJECTORY_ID)
          ? 30 : 0;
        const normalRange = item.system.range?.value ? item.system.range.value + trajectoryBonusFeet : item.system.range?.value;
        const longRange = item.system.range?.long ? item.system.range.long + trajectoryBonusFeet : item.system.range?.long;
        const minRange = item.system.range?.min;
        // Long Shot (Transformers CRB, Sharpshooter Focus, 1st level, p.70): "You do not suffer a
        // Snag when attacking from long range with a ranged weapon" - suppresses exactly the
        // automatic long-range Snag just above, rather than being its own separate grant.
        // Sharpshooter's Grace (PR CRB p.98 AND GI Joe CRB p.133, two distinct compendium items
        // sharing identical RAW text - "no longer suffer a Snag... outside a weapon's normal
        // reach") carries the identical clause - same suppression, any of the three Perks grants it.
        // Jury Rig - Clean Barrels (Factions in Action Vol. 2, Engineer Troop Focus, 17th level,
        // p.73) - see helpers/jury-rig.mjs's own doc comment. "The vehicle's Attacks do not suffer
        // a Snag against targets past normal range" - same suppression shape as Long Shot/
        // Sharpshooter's Grace just above, checked against the VEHICLE actually rolling the attack.
        // Long Shot, Sharpshooter's Grace (all three printings) and Ballistic Advantage (with a sniper
        // weapon) are item rules: immune: ["longRangeSnag"].
        const alreadyIgnoresLongRangeSnag = ruleNoLongRangeSnag(actor, targetToken?.actor ?? null, { item })
          || isJuryRigBenefitActive(actor, 'cleanBarrels') || this._hasFightingStyle(actor, 'longShot');
        if (normalRange && distance > normalRange && (!longRange || distance <= longRange)
          && !alreadyIgnoresLongRangeSnag && !actorHasPerk(actor, NOWHERE_TO_RUN_ID)) {
          snag = true;
          addSource('longRange', this._localize('E20.CombatModifierLongRange'), { snag: true });
        } else if (normalRange && distance > normalRange && (!longRange || distance <= longRange)
          && alreadyIgnoresLongRangeSnag && actorHasPerk(actor, NOWHERE_TO_RUN_ID)) {
          // Nowhere to Run - see NOWHERE_TO_RUN_ID's own comment above. "If you would already
          // ignore this penalty..., you gain Edge on the attack."
          edge = true;
          addSource('nowhereToRun', findPerk(actor, NOWHERE_TO_RUN_ID)?.name ?? 'Nowhere to Run', { edge: true });
        }

        // Sharpshooter's Grace's ↑2 - within 30 feet (PR CRB), or farther (Transformers / GI Joe CRB) - is
        // each printing's own RollModifier rule (target:within:30).


        if (minRange && distance < minRange) {
          tooCloseForMinimumRange = true;
        }

        // Ballistics Precision (Enigma of Combination, General Perk, p.40): "Your attacks using a
        // weapon with the Ballistic trait gain ↑1 at normal range." Checked against the resolved
        // parent weapon's own trait array, the same idiom Silent Weapon Expertise already uses.
        if (normalRange && distance <= normalRange && actorHasPerk(actor, BALLISTICS_PRECISION_ID)) {
          const ballisticsPrecisionWeapon = this._getParentWeapon(actor, item);
          if (ballisticsPrecisionWeapon?.system.traits.includes('ballistic')) {
            shiftUp += 1;
            addSource('ballisticsPrecision', findPerk(actor, BALLISTICS_PRECISION_ID)?.name ?? 'Ballistics Precision', { shiftUp: 1 });
          }
        }

        // Tactical Triangulation (Enigma of Combination, Hub Focus, Analyst, 6th level, p.29) -
        // see TACTICAL_TRIANGULATION_ID's own comment above. Gated on the ROLLER currently being
        // Data Bridged (any skill - see isDataBridged's own doc comment) AND someone nearby
        // holding Tactical Triangulation itself (the Hub character granting the roster the shiftUp
        // reads from) - approximates "your own Data Bridge" without tracking which specific Hub
        // character granted a given roll's own Data Bridge instance.
        if (isDataBridged(actor) && (actorHasPerk(actor, TACTICAL_TRIANGULATION_ID)
          || getNearbyAllyTokens(actor, Infinity).some(token => actorHasPerk(token.actor, TACTICAL_TRIANGULATION_ID)))) {
          const tacticalTriangulationShiftUp = Math.min(3, getDataBridgedAllyCount(actor));
          if (tacticalTriangulationShiftUp > 0) {
            shiftUp += tacticalTriangulationShiftUp;
            addSource('tacticalTriangulation', 'Tactical Triangulation', { shiftUp: tacticalTriangulationShiftUp });
          }
        }

        const enemyReach = E20.actorReach[target.system.size];
        const menaceWeapon = this._getParentWeapon(actor, item);
        const menaceWeaponSourceId = menaceWeapon?.flags?.core?.sourceId ?? menaceWeapon?._stats?.compendiumSource ?? menaceWeapon?.flags?.essence20?.rulesSource;
        const isMenaceWeapon = actorHasPerk(actor, MENACE_ID)
          && (menaceWeaponSourceId == SHOTGUN_ID || menaceWeaponSourceId == SUBMACHINE_GUN_ID);
        // Injection (Ferocious Fighters: Factions in Action Vol. 1, New Weapon Traits, p.93): "do
        // not suffer ↓1 when used within an enemy's reach." Checked against the same parentWeapon
        // lookup menaceWeapon already resolves just above.
        const isInjectionWeapon = !!menaceWeapon?.system.traits?.includes('injection');
        if (enemyReach && distance <= enemyReach && !isMenaceWeapon && !isInjectionWeapon
          && !actorHasPerk(actor, CQB_TRAINING_ID) && !this._hasFightingStyle(actor, 'closeQuartersBattle')) {
          shiftDown += 1;
          addSource('reach', this._localize('E20.CombatModifierReach'), { shiftDown: 1 });
        }

        // Vantage Point (Decepticon Directive Raider, Siegemaster Focus, 6th level, p.64): "Edge
        // on ranged attacks from 30ft or more of elevation above the target." Only this half is
        // built - the Perk's other clause ("or from within an Eye For Appraisal-marked area") is
        // blocked on that Perk's own unbuilt area-tracking (see EYE_FOR_APPRAISAL_ID's own
        // comment, still flagged Not automatable). Foundry's own TokenDocument#elevation (a plain
        // scene-unit number, feet in this system same as everything else here) is read directly -
        // nothing in this codebase has ever needed elevation before this Perk.
        if (actorHasPerk(actor, VANTAGE_POINT_ID)) {
          const attackerElevation = attackerToken.document?.elevation ?? 0;
          const targetElevation = targetToken.document?.elevation ?? 0;
          // "...or from within an area defined by the Eye For Appraisal Role Perk" - the spot picked
          // when the target was appraised (helpers/eye-for-appraisal.mjs).
          if (attackerElevation - targetElevation >= 30 || isInAppraisedArea(actor, target, attackerToken)) {
            edge = true;
            addSource('vantagePoint', findPerk(actor, VANTAGE_POINT_ID)?.name ?? 'Vantage Point', { edge: true });
          }
        }

        // As Above / So Below - see their own comments above. Same elevation comparison as
        // Vantage Point just above, with no 30ft floor - checked independently since either,
        // both, or neither Perk may apply to a given roll (attacker's own As Above, target's own
        // So Below).
        const asAboveElevationDiff = (attackerToken.document?.elevation ?? 0) - (targetToken.document?.elevation ?? 0);
        if (asAboveElevationDiff > 0 && actorHasPerk(actor, AS_ABOVE_ID)) {
          edge = true;
          addSource('asAbove', findPerk(actor, AS_ABOVE_ID)?.name ?? 'As Above', { edge: true });
        }

        if (asAboveElevationDiff > 0 && actorHasPerk(target, SO_BELOW_ID)) {
          shiftDown += 1;
          addSource('soBelow', findPerk(target, SO_BELOW_ID)?.name ?? 'So Below', { shiftDown: 1 });
        }
      }

      // Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level, p.297) - see
      // helpers/maximize-flaws.mjs's own doc comment. Resolved before the Resistance Snag check
      // just below, since it either suppresses that Snag or, if there was nothing to suppress,
      // grants Edge instead.
      const maximizeFlawsTargetUuid = getMaximizeFlawsTargetUuid(actor);
      const ignoringResistanceViaMaximizeFlaws = !!maximizeFlawsTargetUuid && target.uuid == maximizeFlawsTargetUuid;

      // Lance of Light (A Jump Through Time, General Perk, p.55) - see its own comment above.
      // "Resistance to Energy damage" while active - checked alongside the target's own static
      // system.resistances field just below rather than writing to it directly, since this one
      // needs to turn back off the moment the toggle does (Hardened Armor/Tough Enough's own
      // permanent resistance grants are a one-way ratchet by design, this isn't).
      const hasLanceOfLightResistance = ENERGY_DAMAGE_TYPES.has(item.system.damageType)
        && isLanceOfLightActive(target);

      // Resistance to this attack's damage type always imposes a Snag on the roll to apply it
      // (p.170) - unlike Immunity, it does not reduce the damage itself once the attack lands.
      // Defensive Flexibility - see helpers/defensive-flexibility.mjs's own doc comment. Same
      // "live check parallel to the static field" shape as Lance of Light just above.
      const hasDefensiveFlexibilityResistanceToThis = hasDefensiveFlexibilityResistance(target, item.system.damageType);

      // Emotional Mastery: Contempt (A Jump Through Time, Purple Ranger, p.37) - "You gain
      // Resistance to any one type of damage" while active. Same live-check-parallel-to-the-
      // static-field shape as Lance of Light/Defensive Flexibility just above.
      const hasContemptResistanceToThis = hasContemptResistance(target, item.system.damageType);

      // Numbness (Finster's Monster-Matic Cookbook, Path of Stone, 1st level, p.294) - see
      // helpers/numbness.mjs's own doc comment. A level-scaling list rather than a toggle, but the
      // same "live check parallel to the static field" shape as Lance of Light/Contempt above.
      const hasNumbnessResistanceToThis = hasNumbnessResistance(target, item.system.damageType);

      // Righteous Heart (PR CRB, General Perk, p.98) - see helpers/righteous-heart.mjs's own doc
      // comment. A one-shot banked choice rather than a toggle, so it's cleared here the moment
      // it's actually read for a real attack - fire-and-forget (this method isn't async), the
      // same "write not awaited" idiom this file already accepts elsewhere.
      const hasRighteousHeartResistanceToThis = hasRighteousHeartResistance(target, item.system.damageType);
      if (hasRighteousHeartResistanceToThis) {
        clearPendingBonus(target, RIGHTEOUS_HEART_RESISTANCE_FLAG);
      }

      // Dispersion (Cobra Codex, Limited shield, p.98): "Energy Resistance" as its own Active
      // Effect (RAW's own table entry - the shield's own activeEffect.type is "other," which
      // sheet-handlers/listener-item-handler.mjs's own generic shieldUpdate() switch has no case
      // for, so toggling it active flips system.active but grants nothing). Same live-check-
      // parallel-to-the-static-field shape as Lance of Light/Contempt above - only while the
      // shield is both equipped and actually toggled active (its passive Evasion +1 half is
      // already generic and unaffected by this).
      const hasDispersionResistanceToThis = ENERGY_DAMAGE_TYPES.has(item.system.damageType)
        && !!target.items?.some(targetItem => targetItem.type == 'shield' && targetItem.system.equipped
          && targetItem.system.active
          && (targetItem.flags?.core?.sourceId ?? targetItem._stats?.compendiumSource ?? targetItem?.flags?.essence20?.rulesSource) == DISPERSION_ID);

      if (target.system.resistances?.[item.system.damageType] || hasLanceOfLightResistance
        || hasDefensiveFlexibilityResistanceToThis || hasContemptResistanceToThis || hasNumbnessResistanceToThis
        || hasRighteousHeartResistanceToThis || hasDispersionResistanceToThis) {
        if (!ignoringResistanceViaMaximizeFlaws) {
          snag = true;
          addSource('resistance', this._localize('E20.CombatModifierResistance'), { snag: true });
        }
      } else if (ignoringResistanceViaMaximizeFlaws) {
        edge = true;
        addSource('maximizeFlaws', findPerk(actor, MAXIMIZE_FLAWS_ID)?.name ?? 'Maximize Flaws', { edge: true });
      }

      // Ninja Powered: Deep Wisdom - see its own ID comment above. Checked on the ATTACKING
      // Zord (actor), reading the TARGET's own resistances/immunities for this attack's
      // damageType - the reverse direction of the Resistance-Snag check above (that one grants
      // the target's own Snag; this grants the attacker an Edge for exploiting it).
      if (actor?.type == 'zord' && actorHasZordFeature(actor, NINJA_POWERED_DEEP_WISDOM_ID)
        && (target.system.resistances?.[item.system.damageType] || target.system.immunities?.[item.system.damageType])) {
        edge = true;
        addSource(
          'ninjaPoweredDeepWisdom',
          findZordFeature(actor, NINJA_POWERED_DEEP_WISDOM_ID)?.name ?? 'Deep Wisdom',
          { edge: true },
        );
      }

      // Electromagnetic vs. Computerized (GI Joe CRB, Damage Types, p.207 + Computerized Vehicle
      // Trait, p.173): "Electromagnetic weapons... gain ↑3 against computers, Computerized
      // vehicles, and robots, but take ↓3 against all other targets." The Transformers printing adds
      // Cybertronians. A target counts when it has the Computerized Vehicle Trait, holds the Robot
      // Perk (drones and robotic pets), or reads as robotic through its creature tags (a Cybertronian,
      // a Zord, a drone companion, or an NPC tagged "robot"/"android"/...). "Ignore Computerized
      // bonuses to Evasion" is the Defense-lookup side (computerizedArmorEvasion, above).
      // An upgrade (Galvanized, Disruptor, Electromagnetic Pulse Generator) makes the weapon
      // Electromagnetic through its trait, with its own damage type left alone.
      if (item.system.damageType == 'emp'
        || this._getParentWeapon(actor, item)?.system.traits?.includes('electromagnetic')) {
        if (target.system.traits?.computerized || actorHasPerk(target, ROBOT_PERK_ID) || isRobotic(target)) {
          shiftUp += 3;
          addSource('electromagneticVsComputerized', this._localize('E20.DamageEmp'), { shiftUp: 3 });
        } else {
          shiftDown += 3;
          addSource('electromagneticVsComputerized', this._localize('E20.DamageEmp'), { shiftDown: 3 });
        }
      }

      // Fragile (GI Joe CRB, Vehicle Trait, p.301): "Vehicles ramming Fragile vehicles gain ↑1 on
      // their attack." Matched via weapon-effect.mjs's own isRam flag - the same "this weaponEffect
      // is the vehicle's own inherent Ram attack" signal _isSideswipeAttack/_isDemolitionDriverAttack
      // already use, since Blunt+Drive-By alone doesn't uniquely identify a Ram. "Too delicate to
      // make ram attacks" (a restriction on the Fragile vehicle's own actions, not the attacker) is
      // left GM-enforced, matching this codebase's usual treatment of build/action restrictions. The
      // "immediately explodes when defeated" half lives in helpers/vehicle-defeat.mjs instead.
      if (item.system.isRam && target.system.traits?.fragile) {
        shiftUp += 1;
        addSource('rammingFragileVehicle', this._localize('E20.VehicleTraitFragile'), { shiftUp: 1 });
      }

      // Gallantry (Infantry base, 2nd level, p.79): "any effect that would cause the Frightened
      // Condition that targets you suffers a Snag." Trigger Happy's own Willpower compare (see
      // _isTriggerHappyAttack) is a genuine attack, unlike Snarl/Predacon/Might Makes Right's own
      // plain-Skill-Test half of this same Perk (incoming item rules on the Perk) - this Snags the WHOLE
      // attack roll rather than just that one comparison, since there's no way to Snag one clause
      // independently of another sharing the same roll total; matches the same "Snag the roll,
      // not the compare" idiom Duck & Cover/Paranoia/Resistance above all already use for target-
      // side effects. The halved-duration clause has no hook (nothing in this system tracks a
      // Condition's remaining duration to halve).
      if (actorHasPerk(target, GALLANTRY_ID) && this._isTriggerHappyAttack(actor, item)) {
        snag = true;
        addSource('gallantry', findPerk(target, GALLANTRY_ID)?.name ?? 'Gallantry', { snag: true });
      }

      // Impenetrable Shield (Vanguard base, 18th level, p.109): "resistance to all [damage]
      // other [than EMP]" while the shield is active - Resistance (p.170) is already established
      // in this file as "a Snag on the attack roll," same as Duck & Cover's own resistance clause
      // above, so this just extends that same idiom to every damage type except EMP. (The EMP
      // immunity half lives in helpers/combat.mjs#applyDamage instead, since immunity zeroes
      // damage after a hit rather than affecting the attack roll itself.)
      if (
        item.system.damageType != 'emp' && isPersonalShieldActive(target)
        && actorHasPerk(target, IMPENETRABLE_SHIELD_ID)
      ) {
        snag = true;
        addSource('impenetrableShield', findPerk(target, IMPENETRABLE_SHIELD_ID)?.name ?? 'Impenetrable Shield', { snag: true });
      }

      // Shield Modulation (Vanguard base, 13th level, p.109) - same Resistance-is-a-Snag idiom
      // as Impenetrable Shield right above, keyed on the damage type chosen when the shield was
      // last activated (helpers/shield-modulation.mjs) instead of unconditional. RAW covers "you
      // and any allies protected by your shield" - isProtectedByShieldModulation() also extends
      // this to allies within 10 feet once the holder has Shield Upgrade, same as
      // personal-shield.mjs#getShieldUpgradeBonus already does for the shield's defense bonus.
      if (isProtectedByShieldModulation(target, item.system.damageType)) {
        snag = true;
        addSource('shieldModulation', findPerk(target, SHIELD_MODULATION_ID)?.name ?? 'Shield Modulation', { snag: true });
      }

      // Enemy Number One (Tank Focus, 3rd level) - unlike Paranoia above, the Perk lives on a
      // nearby enemy Tank, not necessarily this roll's own target; see
      // helpers/enemy-number-one.mjs for the full trigger/exemption logic.
      const enemyNumberOne = checkEnemyNumberOne(actor, target);
      if (enemyNumberOne.snag) {
        snag = true;
        addSource('enemyNumberOne', 'Enemy Number One', { snag: true });
      }

      enemyNumberOneTankId = enemyNumberOne.attackedTankId;

      // Heavy Ordnance (Infantry/Mechanized Infantry Focus, 15th level, p.82): "attacks made with
      // the weapons of a vehicle you are piloting gain an Edge when attacking other vehicles or
      // enemies your size or greater." Unlike every other check in this file, the Perk lives on a
      // PC, but the roll being made is the VEHICLE's own (see _isHeavyOrdnanceAttack's own doc
      // comment) - actor here is the vehicle, not the pilot.
      if (this._isHeavyOrdnanceAttack(actor, target)) {
        edge = true;
        addSource('heavyOrdnance', findPerk(this._getVehicleDriver(actor), HEAVY_ORDNANCE_ID)?.name ?? 'Heavy Ordnance', { edge: true });
      }

      // Oorah!/Catch Off Guard - see OORAH_ID/CATCH_OFF_GUARD_ID's own comments above. Both key
      // off the same "Surprised" proxy (the target hasn't acted yet this combat, the same First
      // Strike-established check above, re-derived here since First Strike's own version isn't
      // gated on isAttack and this needs to be). Oorah!'s +1 damage is reported back via
      // oorahDamageBonus, "computed here, folded into damageBonusValue there"; Catch Off Guard's
      // Stun bonus needs the attack to
      // actually land, so it's only flagged here (isCatchOffGuardAttempt) and applied in
      // _rollSkillHelper's own post-hit processing.
      const targetCombatantForSurprise = game.combat?.combatants?.find(c => c.actor?.uuid == target?.uuid);
      const isSurprisedTarget = !!targetCombatantForSurprise
        && game.combat.turns.indexOf(targetCombatantForSurprise) > game.combat.turn;
      if (isSurprisedTarget && actorHasPerk(actor, OORAH_ID)) {
        oorahDamageBonus = 1;
      }

      isCatchOffGuardAttempt = isSurprisedTarget && actorHasPerk(actor, CATCH_OFF_GUARD_ID);

      // Rumble in the Jungle - see RUMBLE_IN_THE_JUNGLE_ID's own comment above. Shares the same
      // Surprised proxy as the two just above, plus RAW's own "with a weapon that does not have
      // the Silent trait" gate. Reported back as an eligibility flag; rollSkill() resolves the
      // actual Intimidation die and folds it into the formula, the same "computed here, applied
      // there" shape Oorah!'s own damage bonus uses.
      rumbleInTheJungleEligible = isSurprisedTarget && actorHasPerk(actor, RUMBLE_IN_THE_JUNGLE_ID)
        && !this._getParentWeapon(actor, item)?.system.traits?.includes('silent');

      // Goin' Heels (A Jump Through Time, General Perk, p.54) - the "against enemies lower in the
      // Initiative order" shiftUp half (built 2026-09-12), scoped to a one-handed Targeting
      // Sidearm attack (the parent weapon's own classification fields). The "+1 base damage while
      // highest in Initiative" half is now also built just below - reported back via
      // goinHeelsDamageBonus, the same "computed here, folded into damageBonusValue there" shape
      // Oorah!'s own damage bonus uses, since this function is synchronous and rollSkill() owns
      // the actual damage formula.
      const goinHeelsWeapon = this._getParentWeapon(actor, item);
      if (actorHasPerk(actor, GOIN_HEELS_ID) && game.combat
        && goinHeelsWeapon?.system.classification?.skill == 'targeting'
        && goinHeelsWeapon?.system.classification?.size == 'sidearm' && goinHeelsWeapon?.system.numHands == 1) {
        const actorCombatantForGoinHeels = game.combat.combatants.find(c => c.actor?.uuid == actor.uuid);
        const targetCombatantForGoinHeels = game.combat.combatants.find(c => c.actor?.uuid == target?.uuid);
        if (actorCombatantForGoinHeels?.initiative != null && targetCombatantForGoinHeels?.initiative != null
          && actorCombatantForGoinHeels.initiative > targetCombatantForGoinHeels.initiative) {
          shiftUp += 1;
          addSource('goinHeels', findPerk(actor, GOIN_HEELS_ID)?.name ?? "Goin' Heels", { shiftUp: 1 });
        }

        // "If you have the highest Initiative order in the scene" - every OTHER combatant with a
        // rolled Initiative must be lower than the actor's own (an actor tied for highest, or the
        // only combatant with Initiative rolled so far, still counts - RAW gives no tie-breaker).
        const combatantsWithInitiative = game.combat.combatants.filter(c => c.initiative != null);
        if (actorCombatantForGoinHeels?.initiative != null && combatantsWithInitiative.every(c =>
          c === actorCombatantForGoinHeels || c.initiative <= actorCombatantForGoinHeels.initiative)) {
          goinHeelsDamageBonus = 1;
        }
      }

      // Seconds Between Click & Boom's Snag on attacks against the holder's Evasion is an incoming
      // item rule on the Perk.

      // enemyDownshift Role Points (e.g. "Interfering Static"/Static Modifier, Power Rangers'
      // Finster's Monster-Matic Cookbook p.289: "imposes... a penalty to Power Weapons or Zord
      // attacks against you") - unlike attackUpshift/damageBonus above, this is the TARGET's own
      // Role Points passively downshifting the ATTACKER's roll, not the roller's own. Gated the
      // same way defenseBonus/healthBonus already gate a passive Role Points bonus (isActive, or
      // always-on when not isActivatable) - none of Table 5-4's increaseLevels ever coincide with
      // Interfering Static requiring a manual toggle, so this needs no Roll Options Dialog
      // checkbox of its own; like every other target-status modifier in this method, it just
      // becomes part of the dialog's already-editable shiftDown number, not a hard block.
      const targetRolePoints = target._getBaseRolePoints?.();
      const isTargetRolePointsActive = targetRolePoints
        && (targetRolePoints.system.isActive || !targetRolePoints.system.isActivatable);
      if (isTargetRolePointsActive && targetRolePoints.system.bonus.type == 'enemyDownshift') {
        const weapon = this._getParentWeapon(actor, item);
        const isPowerWeaponAttack = !!weapon?.system.traits.includes('powerWeapon');
        const isZordAttack = actor.type == 'zord';
        if (isPowerWeaponAttack || isZordAttack) {
          shiftDown += targetRolePoints.system.bonus.value;
          addSource('enemyDownshift', targetRolePoints.name, { shiftDown: targetRolePoints.system.bonus.value });
        }
      }

      // Ninja Powered: Balance of Justice - see its own ID comment above. The GRANT half (any
      // attacker gets an Edge against a target already marked this round); the mark itself is
      // set below, once this roll's own actor/item qualify.
      if (hasUsedThisRound(target, BALANCE_OF_JUSTICE_ROUND_FLAG)) {
        edge = true;
        addSource('balanceOfJustice', 'Balance of Justice', { edge: true });
      }

      // Ninja Powered: Balance of Justice - the MARK half. Reports back via
      // balanceOfJusticeTriggered (this function is synchronous and can't await
      // markUsedThisRound itself, same "report, rollSkill() marks" shape as moveLikeASongTriggered
      // just above) whenever the rolling Zord holds this Feature and is making a weaponEffect
      // attack against this target - unconditional on hitting, see this constant's own comment.
      if (item?.type == 'weaponEffect' && actor?.type == 'zord'
        && actorHasZordFeature(actor, NINJA_POWERED_BALANCE_OF_JUSTICE_ID)) {
        balanceOfJusticeTriggered = true;
      }
    }

    return finish();
  }

  /**
   * Checks whether the actor has taken Expertise (or its PR-line printing, Aptitude Augmenter's
   * sibling text - see EXPERTISE_PERK_IDS) scoped to the given skill, granting downshift
   * immunity on Skill Tests with it. Matches on the granted Perk's own compendium source
   * (module/sheet-handlers/perk-handler.mjs's own established idiom for "which compendium Perk
   * is this actor-embedded item an instance of") and its chosen skill (system.choice, stamped by
   * that same file's onPerkDrop when the 'skills' choiceType selection was made).
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} skill   The skill being rolled.
   * @returns {Boolean}
   * @private
   */
  _hasExpertiseDownshiftImmunity(actor, skill) {
    if (!skill) {
      return false;
    }

    return actor.items.some(actorItem =>
      actorItem.type == 'perk'
      && EXPERTISE_PERK_IDS.includes(actorItem._stats?.compendiumSource ?? actorItem.flags?.essence20?.rulesSource)
      && actorItem.system.choice == skill);
  }

  /**
   * Computes the dice shift bonus from Table 10-2: Size Class Combat Adjustment Matrix.
   * The table's values reduce to a simple rule: the shift equals half the distance
   * (rounded down) between the two Size Classes on the actorSizes ladder, applied as a
   * shift up regardless of which side is larger.
   * @param {String} attackerSize   The attacking actor's system.size.
   * @param {String} targetSize   The targeted actor's system.size.
   * @returns {Number}   The dice shift bonus, 0 if either size is unrecognized.
   * @private
   */
  _getSizeShift(attackerSize, targetSize) {
    const sizeOrder = Object.keys(E20.actorSizes);
    const attackerIndex = sizeOrder.indexOf(attackerSize);
    const targetIndex = sizeOrder.indexOf(targetSize);

    if (attackerIndex == -1 || targetIndex == -1) {
      return 0;
    }

    return Math.floor(Math.abs(attackerIndex - targetIndex) / 2);
  }

  /**
   * Finds the actor currently driving the given vehicle, via its own system.actors crew map
   * (the same collection/shape prepareSystemActors() and vehicle-handler.mjs's own crew-swap
   * logic already read - {vehicleRole, uuid, ...} entries, resolved with the same fromUuidSync
   * idiom vehicle-handler.mjs uses for exactly this crew list).
   * @param {Actor} vehicleActor
   * @returns {Actor|null}   The driver, or null if the vehicle has no assigned driver.
   * @private
   */
  _getVehicleDriver(vehicleActor) {
    return getVehicleDriver(vehicleActor);
  }

  /**
   * Finds the vehicle or Zord actor, if any, that the given actor is currently seated in via
   * ANOTHER actor's own system.actors crew map - the reverse direction of _getVehicleDriver
   * above (that one starts from the vehicle and finds its driver; this one starts from a
   * potential pilot/passenger and finds their vehicle). Backs Perks held by the PILOT that only
   * apply while they're actually seated (Peerless Pilot, Dogfighter, Motor Lancer) - unlike Heavy
   * Ordnance/White Ranger Prime, which are checked from the vehicle/Zord's own roll (a vehicle
   * actor already in hand to read system.actors off of), these are checked from the pilot's own
   * roll, so every vehicle/zord actor in the world has to be searched instead.
   * @param {Actor} actor   The potential pilot/passenger.
   * @param {String|null} [role]   'driver' to require the actor be the vehicle's own driver, or
   *   omitted/null to match any crew role (driver or passenger).
   * @returns {Actor|null}   The vehicle/Zord actor, or null if not currently seated in one.
   * @private
   */
  _getPilotedVehicle(actor, role = null) {
    if (!actor?.uuid) {
      return null;
    }

    for (const candidate of game.actors ?? []) {
      if (!['vehicle', 'zord'].includes(candidate.type)) {
        continue;
      }

      for (const crewMember of Object.values(candidate.system?.actors ?? {})) {
        if (crewMember.uuid == actor.uuid && (!role || crewMember.vehicleRole == role)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Peerless Pilot (PR CRB)'s own prerequisite/gating check - whether the actor has taken at
   * least one Driving specialization whose own shift is d6 or better (lower index in
   * E20.skillShiftList; the list runs best-to-worst, so "d6 or higher" means index <= d6's index).
   * @param {Actor} actor
   * @returns {Boolean}
   * @private
   */
  _hasDrivingSpecializationAtOrAboveD6(actor) {
    const d6Index = E20.skillShiftList.indexOf('d6');
    return Object.values(actor.system.skills.driving?.specializations ?? {})
      .some((spec) => E20.skillShiftList.indexOf(spec.shift) <= d6Index);
  }

  /**
   * Heavy Ordnance (Infantry/Mechanized Infantry Focus, 15th level, p.82) - see its own doc
   * comment in _getAutomaticCombatModifiers. Vehicles roll their own weapon attacks as their own
   * actor (see templates/actor/parts/main/vehicle.hbs's weapon container), so this Perk - held by
   * the PILOT, not the vehicle - has to be checked by finding the vehicle's current driver rather
   * than reading the roller's own items directly, unlike every other Perk check in this file.
   * "Your size" is read as the pilot's own Size Class, matching the Perk's literal wording, even
   * though a vehicle is usually far larger than its driver.
   * @param {Actor} actor   The actor performing the roll (the vehicle, not the pilot).
   * @param {Actor} target   The roll's resolved target.
   * @returns {Boolean}
   * @private
   */
  _isHeavyOrdnanceAttack(actor, target) {
    if (actor?.type != 'vehicle' || !target) {
      return false;
    }

    const driver = this._getVehicleDriver(actor);
    if (!driver || !actorHasPerk(driver, HEAVY_ORDNANCE_ID)) {
      return false;
    }

    if (target.type == 'vehicle') {
      return true;
    }

    const sizeOrder = Object.keys(E20.actorSizes);
    const driverIndex = sizeOrder.indexOf(driver.system.size);
    const targetIndex = sizeOrder.indexOf(target.system.size);
    return driverIndex != -1 && targetIndex != -1 && targetIndex >= driverIndex;
  }

  /**
   * Stunning Surprise's own "a creature who is unaware of your exact location" gate. This system
   * has no Hidden status, so the two tracked states that imply it stand in: the target is
   * Surprised, or the attacker is Invisible.
   * @param {Actor} target   The creature that was hit.
   * @param {Actor} attacker   The actor making the attack.
   * @returns {Boolean}
   * @private
   */
  _isUnawareOfAttacker(target, attacker) {
    return !!(target?.statuses?.has?.('surprised') || attacker?.statuses?.has?.('invisible'));
  }

  /**
   * Demolition Driver (Factions in Action Vol. 2, p.64) - see its own DEMOLITION_DRIVER_ID
   * comment above. Ram-only, otherwise the same "vehicle roller, checked via its driver, matched
   * via weaponEffect.mjs's own isRam flag" shape as _isSideswipeAttack.
   * @param {Actor} actor   The actor performing the roll (the vehicle, not the driver).
   * @param {Item} item   The weaponEffect being rolled.
   * @returns {Boolean}
   * @private
   */
  _isDemolitionDriverAttack(actor, item) {
    if (actor?.type != 'vehicle' || item?.type != 'weaponEffect' || !item.system.isRam) {
      return false;
    }

    const driver = this._getVehicleDriver(actor);
    return !!driver && actorHasPerk(driver, DEMOLITION_DRIVER_ID);
  }

  /**
   * Finds the weapon a weaponEffect belongs to, via the parentId flag attachment-handler.mjs
   * tags every weaponEffect with when it's copied onto an actor.
   * @param {Actor} actor   The Item's owner.
   * @param {Item} weaponEffect   The weaponEffect Item.
   * @returns {Item|null}   The parent weapon, null if the weaponEffect has no parent (or none set).
   * @private
   */
  _getParentWeapon(actor, weaponEffect) {
    const parentId = weaponEffect?.flags?.essence20?.parentId;
    const weapon = parentId ? actor.items.get(parentId) : null;
    return isPistolWhipEffect(weaponEffect) ? withoutBallistic(weapon) : weapon;
  }

  /**
   * Whether a weaponEffect is an unarmed attack: this project's "no parent weapon" proxy, widened
   * to the printed unarmed "weapons" (UNARMED_WEAPON_IDS - G.I. JOE/Transformers Unarmed Combat,
   * Night Vale's Unarmed Strike), whose effects do carry a parent.
   * @param {Actor} actor
   * @param {Item} item
   * @returns {Boolean}
   * @private
   */
  _isUnarmedWeaponEffect(actor, item) {
    if (item?.type != 'weaponEffect') {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    return !weapon || UNARMED_WEAPON_IDS.includes(weapon.flags?.core?.sourceId ?? weapon._stats?.compendiumSource ?? weapon?.flags?.essence20?.rulesSource);
  }

  /**
   * Intimidating (GI Joe CRB/TF CRB, Weapon Effects and Traits, p.148 etc) - see
   * updatedShiftDataset.intimidatingWeaponSkill's own comment (rollSkill above) for the RAW quote.
   * The actor's own equipped weapon carrying the trait (itemAndUpgradeTraits, so an attached
   * Upgrade granting Intimidating counts too), and that weapon's own first weaponEffect's
   * classification.skill - the reverse of _getParentWeapon's own lookup (weapon -> effect instead
   * of effect -> weapon), since dice.mjs has no other existing "find a weapon's own weaponEffect"
   * helper to reuse. The first equipped Intimidating weapon found wins if more than one qualifies.
   * @param {Actor} actor
   * @returns {String|null}
   * @private
   */
  _getIntimidatingWeaponSkill(actor) {
    const weapon = actor.items?.find?.(actorItem => actorItem.type == 'weapon' && actorItem.system?.equipped
      && actorItem.system?.itemAndUpgradeTraits?.includes('intimidating'));
    if (!weapon) {
      return null;
    }

    const weaponEffect = actor.items?.find?.(actorItem => actorItem.type == 'weaponEffect'
      && actorItem.flags?.essence20?.parentId == weapon.id);
    return weaponEffect?.system?.classification?.skill ?? null;
  }

  /**
   * Penetrating Rounds (Door-Kicker Focus, 20th level, p.100): "your shotgun and submachine
   * tactics are adapted to taking out hard targets" - both of its clauses (ignoring cover,
   * ignoring deflective armor bonuses, both below) share this same gate, so it's factored out
   * once rather than duplicating the Perk/weapon check twice.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  /**
   * Indirect (Weapon Effects and Traits, p.147) - a CORE WEAPON TRAIT, not a Perk: "does not need
   * line of sight to Acquire a target and ignores cover as long as the target does not have total
   * cover directly above them."
   *
   * Built 2026-09-15, second find from the weapon-trait audit (34 of 66 traits are read by no
   * code at all). Seven weapons in the packs carry it - mortars and the like - and it did nothing.
   *
   * Only the cover half is modelled. "Does not need line of sight" has nothing to attach to: this
   * system never requires line of sight to target in the first place, so that clause is already
   * true by omission rather than unimplemented. RAW's own exception maps cleanly onto the two
   * distinct statuses this system already has - ordinary Cover is ignored, totalCover is not -
   * which is a closer fit than usual for a geometric qualifier ("directly above"), since total
   * cover is precisely the case RAW carves out.
   * @param {Actor} actor
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  _isIndirectAttack(actor, item) {
    return item?.type == 'weaponEffect'
      && !!this._getParentWeapon(actor, item)?.system?.traits?.includes('indirect');
  }

  _isPenetratingRoundsAttack(actor, item) {
    if (item?.type != 'weaponEffect' || !actorHasPerk(actor, PENETRATING_ROUNDS_ID)) {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource ?? weapon?.flags?.essence20?.rulesSource;
    return weaponSourceId == SHOTGUN_ID || weaponSourceId == SUBMACHINE_GUN_ID;
  }

  /**
   * Whether the actor has chosen the given option from the shared Fighting Style Perk
   * (Infantry/Vanguard, p.79/108) - the option lives on system.choice, same shape as
   * Field/other hasChoice Perks (see FIGHTING_STYLE_ID's own doc comment).
   * @param {Actor} actor
   * @param {String} style   One of E20.fightingStyle's keys, e.g. 'akimbo', 'triggerHappy'.
   * @returns {Boolean}
   * @private
   */
  _hasFightingStyle(actor, style) {
    return findPerk(actor, FIGHTING_STYLE_ID)?.system.choice == style;
  }

  /**
   * Trigger Happy (Fighting Style option, p.79/108): "When you use a Multiple Targets attack,
   * compare your Targeting Skill Test total to your target's Willpower in addition to their
   * Toughness or Evasion. If your roll succeeds against their Willpower, they are frightened of
   * you until the end of their next turn." Gated on the weapon's own real 'multipleTargets'
   * trait (helpers/multiple-targets.mjs#isMultipleTargetsWeapon - see its own doc comment for
   * the Blast/AoE distinction and why X itself is never mechanically capped), plus the Fighting
   * Style choice.
   * @param {Actor} actor
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  _isTriggerHappyAttack(actor, item) {
    return this._hasFightingStyle(actor, 'triggerHappy') && isMultipleTargetsWeapon(actor, item);
  }

  /**
   * Alpha Strike (Door-Kicker Focus, 3rd level, p.98): "you can Alpha Strike if you are attacking
   * an enemy within your reach or within 20 feet. When you use Alpha Strike, you gain an Edge on
   * Might attacks and on Targeting attacks with submachine guns and shotguns until the beginning
   * of your next turn, but all attacks against you also have an Edge until the beginning of your
   * next turn." The "within your reach or within 20 feet" activation trigger is a fictional
   * condition this system has no distance check gating a checkbox's own availability for anywhere
   * - same "the player simply only checks it when the fiction supports it" reasoning Aiming's own
   * "haven't moved" clause already relies on - so this only gates on the roll actually being one
   * of the two attack types the Perk grants an Edge to, same shape as Assault Precision's own
   * shotgun/submachine-gun check just above. "Until the beginning of your next turn" is
   * approximated at round granularity (see ALPHA_STRIKE_ROUND_FLAG's use in
   * _getAutomaticCombatModifiers below), the same unenforced-duration precedent every other
   * "until X" clause in this codebase already accepts.
   * @param {Actor} actor
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  _isAlphaStrikeAttack(actor, item) {
    if (item?.type != 'weaponEffect' || !actorHasPerk(actor, ALPHA_STRIKE_ID)) {
      return false;
    }

    if (item.system.classification.skill == 'might') {
      return true;
    }

    if (item.system.classification.skill != 'targeting') {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource ?? weapon?.flags?.essence20?.rulesSource;
    return weaponSourceId == SHOTGUN_ID || weaponSourceId == SUBMACHINE_GUN_ID;
  }

  /**
   * Empty the Mag (Vanguard base, 7th level, p.109): "when you hit a target with a ranged
   * ballistic weapon attack, you may empty the magazine into them in a flurry of autofire and
   * apply damage a second time. After using this ability, you must reload your weapon before you
   * can use it again." The "must reload" limiter has no hook - this system doesn't track
   * ammunition/reload state at all (Rapid Reload/Deep Magazines are both NO-GO for the same
   * reason) - so, like Aiming's own "haven't moved" clause, it's left to the player to only check
   * the box when the fiction supports it.
   * @param {Actor} actor
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  _isEmptyTheMagAttack(actor, item) {
    if (item?.type != 'weaponEffect' || item.system.classification.style == 'melee') {
      return false;
    }

    if (!actorHasPerk(actor, EMPTY_THE_MAG_ID)) {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    return !!weapon?.system.itemAndUpgradeTraits?.includes('ballistic');
  }

  /**
   * Sums the Toughness bonus contributed by a target's own equipped armor that carries the
   * 'deflective' trait specifically - not every armor's own bonusToughness, just the portion
   * Penetrating Rounds (above) says to ignore. system.totalBonusToughness (documents/item.mjs)
   * already folds in that armor's own upgrades, not just its base bonusToughness.
   * @param {Actor} target
   * @returns {Number}
   * @private
   */
  _getDeflectiveArmorToughness(target) {
    const equippedDeflectiveArmor = (target.items?.documentsByType?.armor ?? [])
      .filter(a => a.system.equipped && a.system.traits?.includes('deflective'));
    return equippedDeflectiveArmor.reduce((total, a) => total + (a.system.totalBonusToughness ?? 0), 0);
  }

  /**
   * The Toughness a target owes to PLATING-trait armor specifically - the exact sibling of
   * _getDeflectiveArmorToughness just above, for Anti-Tank's own clause.
   * @param {Actor} target
   * @returns {Number}
   */
  _getPlatingArmorToughness(target) {
    const equippedPlatingArmor = (target.items?.documentsByType?.armor ?? [])
      .filter(a => a.system.equipped && a.system.traits?.includes('plating'));
    return equippedPlatingArmor.reduce((total, a) => total + (a.system.totalBonusToughness ?? 0), 0);
  }

  /**
   * The Toughness a target owes to UPGRADES on their equipped armor specifically - not the armor's
   * own base bonusToughness, just the delta upgrades add on top (documents/item.mjs's
   * _prepareArmorBonuses). Every equipped armor counts, regardless of trait - Titan-Class's own
   * clause above isn't scoped to any one armor trait the way Anti-Tank/Armor Piercing are.
   * @param {Actor} target
   * @returns {Number}
   */
  _getArmorUpgradeToughness(target) {
    const equippedArmor = (target.items?.documentsByType?.armor ?? []).filter(a => a.system.equipped);
    return equippedArmor.reduce((total, a) =>
      total + Math.max(0, (a.system.totalBonusToughness ?? 0) - (a.system.bonusToughness ?? 0)), 0);
  }

  /**
   * Sums the Evasion/Toughness bonus a target owes to their own equipped, Defend-trait weapon(s)
   * (Across the Stars, Weapon Traits, p.79) - see the live check in _getAutomaticCombatModifiers's
   * per-target block for the full RAW quote. Read off the weapon itself, not any weaponEffect,
   * since Defend is a whole-weapon trait exactly like Anti-Tank/Titan-Class above.
   * @param {Actor} target
   * @param {Boolean} isMeleeAttack   Whether the incoming attack being defended against is melee.
   * @returns {Number}
   */
  _getDefendBonus(target, isMeleeAttack) {
    const equippedDefendWeapons = (target.items?.documentsByType?.weapon ?? [])
      .filter(w => w.system.equipped && w.system.traits?.includes('defend'));
    return equippedDefendWeapons.reduce((total, w) => {
      if (isMeleeAttack) {
        return total + (w.system.defendMagnitude ?? 1);
      }

      // The base rule only ever grants a bonus against melee attacks - defendRangedMagnitude only
      // exists for the rare weapon (e.g. Zeo Power Disc/Shield) that prints a second, smaller value
      // against ranged attacks too; null means this weapon grants nothing against ranged attacks.
      return total + (w.system.defendRangedMagnitude ?? 0);
    }, 0);
  }

  /**
   * Immovable Object (Juggernaut Focus, 20th level, p.112): "you are immune to critical hits."
   * (The Perk's other clause - choosing not to move under forced movement - has no hook; this
   * system doesn't model forced movement as a distinct effect at all.) Unlike criticalOptions
   * itself (built once per roll, off the roll's own dice - a fact about the ATTACK, not any one
   * target), this is a per-TARGET exclusion, so each result's own targetUuid is resolved and
   * checked individually - a target can be immune independent of whether anyone else being
   * compared against the same roll is. Mutates results in place; doesn't touch
   * damageValue/multiplier - Degrees of Success (p.169) and the Critical Success feature (p.205)
   * are two independent systems in this codebase, and only the latter is what "critical hits"
   * means here.
   *
   * Protector's Shield (Bodyguard Focus, 10th level, p.110): "When your protected target is within
   * your shield, they are immune to critical hits." Same per-target crit-immunity shape as
   * Immovable Object above, just checked via a nearby Bodyguard relationship instead of the
   * target's own Perk - scans for a Bodyguard within 10ft (the same radius Shield Upgrade's own
   * shield-extension already establishes) who holds Protector's Shield, has their Personal Shield
   * active, and has designated this target as their own Protected Target
   * (helpers/protected-target.mjs).
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @private
   */
  async _applyImmovableObjectImmunity(results) {
    for (const result of results) {
      if (result.criticalOptions.length && result.targetUuid) {
        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && (actorHasPerk(targetActor, IMMOVABLE_OBJECT_ID)
          || this._hasNearbyProtectorsShieldImmunity(targetActor))) {
          result.criticalOptions = [];
        }
      }
    }
  }

  /**
   * Protector's Shield - see _applyImmovableObjectImmunity's own widened doc comment above.
   * @param {Actor} targetActor
   * @returns {Boolean}
   * @private
   */
  /**
   * Bulwark - see BULWARK_ID's own comment above. Unlike _hasNearbyProtectorsShieldImmunity below,
   * this is called with the already-resolved targetToken directly (this function only ever
   * considers one target - game.user.targets.first(), already in hand) rather than re-deriving it
   * from an actor.
   * @param {Token} targetToken
   * @returns {Boolean}
   * @private
   */
  _hasNearbyBulwarkCover(targetToken) {
    if (!canvas?.tokens) {
      return false;
    }

    for (const token of canvas.tokens.placeables) {
      if (token === targetToken || !token.actor) {
        continue;
      }

      if (!actorHasPerk(token.actor, BULWARK_ID) || !isBulwarkActive(token.actor)) {
        continue;
      }

      if (canvas.grid.measurePath([token.center, targetToken.center]).distance <= 5) {
        return true;
      }
    }

    return false;
  }

  _hasNearbyProtectorsShieldImmunity(targetActor) {
    const targetToken = targetActor.getActiveTokens?.()?.[0];
    if (!targetToken || !canvas?.tokens) {
      return false;
    }

    for (const token of canvas.tokens.placeables) {
      if (token === targetToken || !token.actor) {
        continue;
      }

      if (!actorHasPerk(token.actor, PROTECTORS_SHIELD_ID) || !isPersonalShieldActive(token.actor)
        || !isProtectedTarget(token.actor, targetActor)) {
        continue;
      }

      if (canvas.grid.measurePath([token.center, targetToken.center]).distance <= 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Plate Piercing (Artillery Focus, 10th level, p.81): "your explosive attacks now deal double
   * damage to vehicles." (The Perk's other clause - granting the Armor Piercing Quality - isn't
   * automated: that trait has no mechanical definition anywhere in this system's own rules text
   * or code, only a config.mjs label, so there's nothing concrete to build without inventing a
   * house rule. Not the same as Anti-Tank, a distinct weapon-upgrade trait with its own separate,
   * equally undefined, entry.) Same per-target post-processing shape as Immovable Object above -
   * "double damage to vehicles" only means something once a specific target's own actor.type is
   * known, so it can't be folded into the shared checkContext.damageValue every target's row
   * multiplies from.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext   Its own isExplosiveAttack field, set by rollSkill() - see that
   *   field's own doc comment for why this reads checkContext rather than taking a raw Item.
   * @private
   */
  async _applyPlatePiercingVehicleDamage(actor, results, checkContext) {
    if (!checkContext.isExplosiveAttack || !actorHasPerk(actor, PLATE_PIERCING_ID)) {
      return;
    }

    for (const result of results) {
      if (result.damageValue && result.targetUuid) {
        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor?.type == 'vehicle') {
          result.damageValue *= 2;
        }
      }
    }
  }

  /**
   * Raze and Ruin (Decepticon Directive Raider, Siegemaster Focus, 20th level, p.64): "your ranged
   * Attacks deal triple damage against Huge (or larger) objects, and double damage against Huge
   * (or larger) Immobilized creatures." Only the base Size-conditional multiplier is built here -
   * RAW says both bullets stack with Size Matters' own damage-conversion clause (Siegemaster,
   * 3rd level), which needs new infrastructure this project doesn't have yet (see the project
   * plan's own Decepticon Directive categorization writeup) - so a Size Matters-equipped attacker
   * won't see the full RAW total from this alone. Same per-target post-processing shape as Plate
   * Piercing above - "object" is approximated as `targetActor.type == 'vehicle'`, the same proxy
   * Plate Piercing's own "vehicles" clause already uses, since this system has no separate
   * "object" actor type.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext   Its own isMelee field, set by rollSkill() - "ranged" is simply
   *   "not melee" here, matching every other melee/ranged distinction in this codebase.
   * @private
   */
  async _applyRazeAndRuinDamage(actor, results, checkContext) {
    if (checkContext.isMelee || !actorHasPerk(actor, RAZE_AND_RUIN_ID)) {
      return;
    }

    const sizeOrder = Object.keys(E20.actorSizes);
    const hugeIndex = sizeOrder.indexOf('huge');

    for (const result of results) {
      if (!result.damageValue || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      const targetSizeIndex = sizeOrder.indexOf(targetActor?.system.size);
      if (targetSizeIndex == -1 || targetSizeIndex < hugeIndex) {
        continue;
      }

      if (targetActor.type == 'vehicle') {
        result.damageValue *= 3;
      } else if (targetActor.statuses?.has('immobilized')) {
        result.damageValue *= 2;
      }
    }
  }

  /**
   * Smash! (Enigma of Combination, Pugilist Focus, Warrior, 20th level, p.38) - see SMASH_ID's own
   * comment above. Adds 1 damage per Size Class the actor is larger than the target, and knocks a
   * successfully-hit, sufficiently-smaller target Prone. Same size-index-compare idiom Brutal
   * Might's own Edge check already established, same per-target post-processing shape as Raze and
   * Ruin above.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext   Its own isUnarmedAttack field, set by rollSkill() above.
   * @private
   */
  /**
   * Trip (GI Joe CRB, Weapon Effects and Traits, p.148): "Knocks a target over, giving them the
   * Prone Condition." The Brawn/Finesse-Rank comparison that can shift the attack itself down is
   * handled pre-roll, in _getAutomaticCombatModifiers (see its own comment there) - this is just
   * the "successfully hit" half, applying Prone the same way Smash!'s identical
   * toggleStatusEffect('prone', ...) call does just below.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows.
   * @param {Object} checkContext   Its own damageType field, set by rollSkill() above.
   * @private
   */
  async _applyTraitRiders(actor, results, checkContext) {
    const hits = [];
    for (const result of results ?? []) {
      if (result.success && result.targetUuid) {
        const target = await fromUuid(result.targetUuid);
        if (target) {
          hits.push(target);
        }
      }
    }

    if (!hits.length) {
      return;
    }

    const traits = checkContext.weaponTraits ?? [];
    // Grapple (Quartermaster's Guide p.33): "On a successful attack, the target gains the Grappled
    // condition." A Grapple effect does the same.
    if (traits.includes('grapple') || checkContext.damageType == 'grapple') {
      for (const target of hits) {
        await target.toggleStatusEffect('grappled', { active: true });
      }
    }

    // Blinding (Quartermaster's Guide p.33): "A target hit with this effect is blind until the end
    // of their next turn." Strobe (p.34) gives a weapon "Blinding trait as an alternate effect" -
    // so when the weapon has that alternate (a 'blindingBlast' effect, handled by
    // _applyBlindingBlast), its other effects don't blind. Only a weapon without one falls back to
    // blinding on every hit.
    if (traits.includes('blinding') && checkContext.damageType != 'blindingBlast' && !checkContext.weaponHasBlindingEffect) {
      for (const target of hits) {
        await applyTimedCondition(target, 'blinded', 1);
      }
    }

    // Maneuver (GI Joe CRB p.148): "This weapon can be used equally well to grapple, shove, or trip a
    // target." Asked once the attack has hit.
    if (checkContext.damageType == 'maneuver') {
      // Snatch (Ferocious Fighters, General Perk, p.37): "When using an attack's Maneuver effect, add
      // disarm to your list of Maneuver options... If you succeed at disarming a weapon, it lands in
      // a random space within your target's reach."
      const canDisarm = actorHasPerk(actor, RIDER.snatch);
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: this._localize('E20.DamageManeuver') },
        classes: ["window-app", "e20-window"],
        content: `<p>${this._localize('E20.ManeuverPrompt', { names: hits.map(t => t.name).join(', ') })}</p>`,
        buttons: [
          { action: 'grapple', label: this._localize('E20.ManeuverGrapple') },
          { action: 'shove', label: this._localize('E20.ManeuverShove') },
          { action: 'trip', label: this._localize('E20.ManeuverTrip') },
          ...(canDisarm ? [{ action: 'disarm', label: this._localize('E20.ManeuverDisarm') }] : []),
        ],
        rejectClose: false,
      });
      if (choice == 'grapple' || choice == 'trip') {
        for (const target of hits) {
          await target.toggleStatusEffect(choice == 'grapple' ? 'grappled' : 'prone', { active: true });
        }
      }

      // A shove moves the target "directly away from you a distance equal to your natural Reach"
      // (GI Joe CRB p.118) - helpers/forced-movement.mjs.
      if (choice == 'shove') {
        for (const target of hits) {
          await pushActor(target, actor, 5);
        }
      }

      if (choice == 'disarm') {
        for (const target of hits) {
          await disarm(actor, target, { maxHands: 2, source: findPerk(actor, RIDER.snatch)?.name ?? 'Snatch' });
        }
      }

      if (choice) {
        this._chatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: this._localize(`E20.ManeuverDone.${choice}`, { name: actor.name, names: hits.map(t => t.name).join(', ') }),
        });
      }
    }
  }

  async _applyTripKnockdown(results, checkContext) {
    if (checkContext.damageType != 'knocProne') {
      return;
    }

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (targetActor) {
        await targetActor.toggleStatusEffect('prone', { active: true });
      }
    }
  }

  /**
   * Blinding (Quartermaster's Guide to Gear p.33): "A target hit with this effect is blind until
   * the end of their next turn." Represented by damageType 'blindingBlast' - the same "measured
   * from real compendium data" idiom NON_DAMAGE_EFFECT_TYPES's own comment above uses for Trip's
   * 'knocProne' - applying the existing 'blinded' status via helpers/timed-status.mjs's own
   * applyTimedCondition(..., 1), the same "until the end of their next turn" 1-round idiom
   * Painmonger's own Impaired application already establishes.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows.
   * @param {Object} checkContext   Its own damageType field, set by rollSkill() above.
   * @private
   */
  async _applyBlindingBlast(results, checkContext) {
    if (checkContext.damageType != 'blindingBlast') {
      return;
    }

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (targetActor) {
        await applyTimedCondition(targetActor, 'blinded', 1);
      }
    }
  }

  /**
   * Deafened (the Crowd Dispersal Energy Cannon's "Deafened 1" alternate effect, Intercontinental
   * Adventures p.92): damageType 'deafened' leaves a hit target Deafened until the end of their next
   * turn - the same applyTimedCondition(..., 1) shape as _applyBlindingBlast just above.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows.
   * @param {Object} checkContext   Its own damageType field, set by rollSkill() above.
   * @private
   */
  async _applyDeafeningEffect(results, checkContext) {
    if (checkContext.damageType != 'deafened') {
      return;
    }

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (targetActor) {
        await applyTimedCondition(targetActor, 'deafened', 1);
      }
    }
  }

  /**
   * Mode Lock (Enigma of Combination, Weapon Traits/Conditions, p.49): "some sinister weapons...
   * impose a new Condition meant to especially hamper Combiners... A character suffering from Mode
   * Lock can't convert from their current Mode." Represented by damageType 'modelock' (same
   * "measured from real compendium data" idiom as Trip/Blinding above), applying the already-
   * registered 'modeLock' status (helpers/config.mjs's own E20.statusEffects entry, previously
   * unused anywhere). The actual conversion BLOCK lives at the point of conversion itself - see
   * sheet-handlers/transformer-handler.mjs#onTransform's own check - not here. The "Energon flush"
   * removal (1 Energon Point + a DIF 12 Technology Skill Test, as a Standard action) isn't built:
   * it needs a real roll+resource-spend integration this pass didn't reach, so the status is
   * granted but only ever GM-cleared by hand, same as every other un-timed Condition this
   * codebase applies.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows.
   * @param {Object} checkContext   Its own damageType field, set by rollSkill() above.
   * @private
   */
  async _applyModeLock(results, checkContext) {
    if (checkContext.damageType != 'modelock') {
      return;
    }

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (targetActor) {
        await targetActor.toggleStatusEffect('modeLock', { active: true });
      }
    }
  }

  async _applySmashDamage(actor, results, checkContext) {
    if (!checkContext.isUnarmedAttack || !actorHasPerk(actor, SMASH_ID)) {
      return;
    }

    const sizeOrder = Object.keys(E20.actorSizes);
    const actorSizeIndex = sizeOrder.indexOf(actor.system.size);

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      const targetSizeIndex = sizeOrder.indexOf(targetActor?.system.size);
      if (actorSizeIndex == -1 || targetSizeIndex == -1 || targetSizeIndex >= actorSizeIndex) {
        continue;
      }

      const sizeDifference = actorSizeIndex - targetSizeIndex;
      if (result.damageValue) {
        result.damageValue += sizeDifference;
      }

      await targetActor.toggleStatusEffect('prone', { active: true });
    }
  }

  /**
   * Empty the Mag (Vanguard base, 7th level, p.109) - see _isEmptyTheMagAttack's own doc comment.
   * "Apply damage a second time" against every target this roll actually hit, same per-result
   * doubling shape as _applyPlatePiercingVehicleDamage above, just unconditional on the target
   * (not gated on being a vehicle) and gated on the dialog checkbox instead of always-on.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext
   * @private
   */
  _applyEmptyTheMag(results, checkContext) {
    if (!checkContext.emptyTheMag) {
      return;
    }

    for (const result of results) {
      if (result.damageValue) {
        result.damageValue *= 2;
      }
    }
  }

  /**
   * "Critical Effect: Triples base damage instead of double" (Quantum Mega Battle Armor's Energy
   * Sword Time Strike, A Jump Through Time p.69 - helpers/summons.mjs). A Critical Success
   * (multiplier 2, this system's Degrees of Success) scales the damage by checkContext.critMultiplier
   * instead. Runs first, before the flat post-multiplier adds (Flame Warlord etc.).
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext
   * @private
   */
  _applyCritMultiplier(results, checkContext) {
    const critMultiplier = checkContext.critMultiplier;
    if (!critMultiplier || !checkContext.damageValue) {
      return;
    }

    for (const result of results) {
      if (result.damageValue && result.multiplier >= 2 && result.multiplier < critMultiplier) {
        result.damageValue = checkContext.damageValue * critMultiplier;
      }
    }
  }

  /**
   * Psycho Slinger - see PER_TWO_HITS_EFFECT_IDS' own comment above. Counts this attacker's hits
   * with the effect on each target over the current turn (the Scene Clock's scene outside combat),
   * across however many of its Multiple Attacks are rolled. Only every second hit on the same
   * target keeps its damage; the others show a note instead of an Apply Damage button.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext
   * @private
   */
  async _applyPerTwoHits(actor, results, checkContext) {
    const effectId = checkContext.perTwoHitsEffectId;
    if (!effectId) {
      return;
    }

    const combat = game.combat;
    const stamp = combat ? `${combat.id}:${combat.round}:${combat.turn}` : `scene:${getSceneEpoch()}`;
    const stored = actor.getFlag?.('essence20', PER_TWO_HITS_FLAG);
    const counts = stored?.stamp == stamp ? { ...stored.counts } : {};
    let changed = false;
    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      // Foundry flag keys can't contain dots.
      const key = `${effectId}-${result.targetUuid.replace(/\./g, '-')}`;
      const hits = (counts[key] ?? 0) + 1;
      counts[key] = hits;
      changed = true;
      if (hits % 2) {
        result.damageValue = null;
        result.damageBonusLabel = null;
        result.secondaryDamage = null;
        result.criticalOptions = [];
      }

      result.riderNote = [result.riderNote, this._localize('E20.PerTwoHitsNote', { hits })].filter(Boolean).join(' ');
    }

    if (changed) {
      await actor.setFlag('essence20', PER_TWO_HITS_FLAG, { stamp, counts });
    }
  }

  /**
   * Flame Warlord (Finster's Monster-Matic Cookbook, 20th level, p.288): "You deal 1 additional
   * Fire damage with any attack that is a Critical Success." A flat post-multiplier add (same
   * "+N damage" idiom Puissance/Zordbane/etc. already use, not a literal Fire-type override) - has
   * to run after `results` is built (multiplier isn't known any earlier), unlike this file's other
   * Warlord damage bonuses (which are pre-roll facts folded into damageBonusValue instead).
   * @param {Actor} actor
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @private
   */
  _applyFlameWarlordCritDamage(actor, results) {
    if (!actorHasPerk(actor, FLAME_WARLORD_ID)) {
      return;
    }

    for (const result of results) {
      if (result.multiplier >= 2 && result.damageValue) {
        result.damageValue += 1;
      }
    }
  }

  /**
   * Nowhere Is Safe (Vanguard base, 17th level, p.111): "your Multiple Targets attacks reduce
   * cover one step: Total cover to cover, and cover to none. If you reduce cover to none or
   * attack an enemy with no cover, your attacks deal +1 damage." Same per-target post-processing
   * shape as _applyPlatePiercingVehicleDamage above, gated on a hit (a miss reduces nothing and
   * earns no bonus) and on checkContext.isMultipleTargetsWeapon instead of isExplosiveAttack.
   * Uses Actor#toggleStatusEffect, the same core API Frightened's own application already uses
   * (see markDebilitated's sibling in sneak-attack.mjs) rather than a raw ActiveEffect write.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {Object} checkContext
   * @private
   */
  async _applyNowhereIsSafe(actor, results, checkContext) {
    if (!checkContext.isMultipleTargetsWeapon || !actorHasPerk(actor, NOWHERE_IS_SAFE_ID)) {
      return;
    }

    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (!targetActor) {
        continue;
      }

      // Total Cover -> Cover doesn't reach "none" yet, so no damage bonus there - only when the
      // reduction lands on no cover at all (Cover -> none), or the target had no cover to begin
      // with, does the +1 apply.
      let coverReducedToNone = false;
      if (targetActor.statuses.has('totalCover')) {
        await targetActor.toggleStatusEffect('totalCover', { active: false });
        await targetActor.toggleStatusEffect('cover', { active: true });
      } else if (targetActor.statuses.has('cover')) {
        await targetActor.toggleStatusEffect('cover', { active: false });
        coverReducedToNone = true;
      } else {
        coverReducedToNone = true;
      }

      if (coverReducedToNone && result.damageValue) {
        result.damageValue += 1;
      }
    }
  }

  /**
   * Measures the distance in scene units (feet, for every book this system covers) between the
   * centers of two placed Tokens - the same canvas.grid.measurePath idiom already used by
   * helpers/personal-shield.mjs, helpers/sneak-attack.mjs, and helpers/enemy-number-one.mjs, each
   * of which has to keep its own private copy since none of them import from dice.mjs.
   * @param {Token} tokenA
   * @param {Token} tokenB
   * @returns {Number}
   * @private
   */
  _getDistanceFeet(tokenA, tokenB) {
    return canvas.grid.measurePath([tokenA.center, tokenB.center]).distance;
  }

  /**
   * Computes the additional Aiming shift granted by a Laser Sight (or similar) attachment on
   * the weapon a ranged weaponEffect belongs to.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The weaponEffect being rolled.
   * @returns {Number}   The extra shift, 0 if the weaponEffect has no parent weapon or upgrades.
   * @private
   */
  _getLaserSightBonus(actor, item) {
    const weapon = this._getParentWeapon(actor, item);

    return weapon?.system.totalAimShiftBonus || 0;
  }

  /**
   * Finds the other damage-dealing weaponEffect Items attached to the same weapon as the given
   * weaponEffect (Table 8-3.1's "Alternate Effects") - available to stack onto a Critical
   * Success (p.205). Effects with no damageValue (e.g. Trip, Maneuver) are excluded since they
   * have nothing numeric to apply automatically.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The weaponEffect being rolled.
   * @returns {Array<Item>}   The sibling weaponEffect Items, empty if item has no parent weapon.
   * @private
   */
  _getAlternateEffects(actor, item) {
    const parentId = item?.flags.essence20?.parentId;
    if (!parentId) {
      return [];
    }

    return actor.items.filter(sibling =>
      sibling.type == 'weaponEffect'
      && sibling.id != item.id
      && sibling.flags.essence20?.parentId == parentId
      && sibling.system.damageValue,
    );
  }

  /**
   * Executes the skill roll.
   * @param {String} formula   The formula to be rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} flavor   The html to use for the roll message.
   * @param {Boolean} canCritD2   Whether a shift-2 result counts as a Critical Success.
   * @param {Object} checkContext   Optional { defenseType, targets, damageValue, damageType }
   *   built in rollSkill() - when present, the roll is compared against each target's Defense
   *   (p.168-169) instead of posting a plain dice-roll message.
   * @param {Object} [rollContext]   {skill, essence, snag, isPowerWeaponAttack} describing what
   *   was rolled - see combat.mjs#buildCheckChatData's own doc comment. On the checkContext
   *   (attack/vs-Difficulty) path, a rollFailed flag is added once the outcome is known.
   * @param {Boolean} [drivingStrikeReroll]   PR "Driving Strike" - the player pre-declared a
   *   reroll of all skill dice before this roll happened, so it's applied unconditionally right
   *   after evaluation rather than left for a reactive chat-message button. Only meaningful on
   *   the checkContext (attack) path - Driving Strike only triggers "before making a melee
   *   attack", which always has a checkContext.
   * @private
   */
  async _rollSkillHelper(formula, actor, flavor, canCritD2, checkContext=null, rollContext={}, drivingStrikeReroll=false) {
    const roll = new Roll(formula, actor.getRollData());
    const speaker = this._chatMessage.getSpeaker({ actor });

    if (!checkContext) {
      // Through the same check-card.hbs box every vs-Difficulty check/attack uses, not a bare
      // roll.toMessage() - a flat Skill Test (or an attack rolled with no target selected, which
      // also has no checkContext - see rollSkill's own checkContext = checkEntries ? {...} :
      // null) used to post Foundry's own plain default roll card, which looked like an unrelated,
      // plainer message next to every other roll's bordered/chamfered card. results is always
      // empty here (nothing to compare against a Difficulty), which is exactly what makes
      // check-card.hbs render as this same flavor+roll box with no results list.
      await roll.evaluate();
      const chatData = await buildCheckChatData(roll, {
        flavor,
        results: [],
        speaker,
        canCritD2,
        rollContext,
      });
      this._chatMessage.create(chatData);

      // No checkContext means there was nothing to compare against a Difficulty, so there is no
      // success to report - the roll itself is still handed back for a caller that wants it.
      return { results: [], rollFailed: false, isFumble: false, roll };
    }

    await roll.evaluate();

    // No Fighting?! - see NO_FIGHTING_HANGUP_ID's own comment above. Cleared here, unconditionally
    // (success, failure, Fumble, or Critical Success all count as "the first Social Skill Test") -
    // this is the one Social roll the Snag applies to, not a round-scoped window.
    if (checkContext.noFightingSnagApplied) {
      await actor.unsetFlag('essence20', NO_FIGHTING_FLAG);
    }

    if (drivingStrikeReroll) {
      await applyReroll(roll, { mode: 'all', target: 'skillDice', values: [] });
    }

    // PR CRB "Power Infusion": a banked charge (see helpers/power-infusion.mjs) auto-applies to
    // every attack the actor makes while banked - it's only cleared below, once this attack
    // actually succeeds, so a miss (even after the reroll) leaves it banked for next time.
    // effectName is only set for a weaponEffect roll (see checkContext's own construction above)
    // - Power Infusion only triggers on an attack, never a flat vs-Difficulty Skill Test.
    const bankedReroll = checkContext.effectName ? actor.getFlag('essence20', 'bankedReroll') : null;
    if (bankedReroll) {
      await applyReroll(roll, { mode: 'all', target: 'skillDice', values: bankedReroll.values });
    }

    let [isCrit, isFumble] = _isCritIsFumble(roll.dice, canCritD2);

    // Conditions applied from here on came from this roller - helpers/target-riders.mjs#noteRoller.
    noteRoller(actor);

    // Jack Of All Trades (GI Joe CRB, Undercover Agent Focus, p.76) - see
    // updatedShiftDataset.jackOfAllTradesAvailable's own comment above. "You cannot crit on this
    // d4" overrides an otherwise-genuine Critical Success, the same "mutate isCrit after the fact"
    // idiom Time Traveler's own Hang-Up just below already uses for the opposite (widening Fumble).
    if (checkContext.suppressCrit) {
      isCrit = false;
    }

    // Consistent - see SILVER_MEDAL_SYNDROME_ID's own comment above. Asked before anything is
    // built from the Critical Success, so giving it up really does take it away.
    let consistentDowngrade = false;
    if (actorHasPerk(actor, SILVER_MEDAL_SYNDROME_ID)
      && (isCrit || (checkContext.entries ?? []).some(entry => entry.difficulty && computeMultiplier(roll.total, entry.difficulty) >= 2))
      && await askConsistent(actor)) {
      consistentDowngrade = true;
      isCrit = false;
    }

    // Xenotech (weapon trait) - see its own Snag check in _getAutomaticCombatModifiers's own
    // comment above. Stamped the moment a genuine Critical Success lands with the flagged weapon,
    // clearing that Snag for good on every future attack with it.
    if (isCrit && checkContext.xenotechWeaponToMark) {
      await checkContext.xenotechWeaponToMark.setFlag('essence20', 'xenotechCritted', true);
    }

    // Time Traveler's own Hang-Up - see TIME_TRAVELER_HANGUP_ID's own comment above. Widens the
    // ordinary natural-1-only Fumble with an extra natural-2 case, gated on the actor's own
    // already-resolved skill die size for this roll (d4 or lower).
    if (!isFumble && ['d2', 'd4'].includes(rollContext.finalShift) && actorHasHangUp(actor, TIME_TRAVELER_HANGUP_ID)) {
      const d20Pool = roll.dice.find(pool => pool.faces === 20);
      if (d20Pool?.values.some(value => value === 1 || value === 2)) {
        isFumble = true;
      }
    }

    // Surging - "if you attack and you roll a 1 on your d20, you suffer the attack's effect."
    if (checkContext.surging && roll.dice.find(pool => pool.faces === 20)?.values.includes(1) && checkContext.damageValue) {
      await applyDamage(actor, checkContext.damageValue, checkContext.damageType);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: this._localize('E20.SurgingBackfire', { name: actor.name, damage: checkContext.damageValue }),
      });
    }

    // Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284): "Whenever you Fumble a
    // Skill Test... you regain 2 Personal Power." (The "...or suffer Psychic damage" half lives in
    // combat.mjs#applyDamage's own grantCruelWarlordPsychicRegen instead.)
    if (isFumble && actorHasPerk(actor, CRUEL_WARLORD_ID) && actor.system.powers?.personal) {
      await actor.update({
        'system.powers.personal.value': Math.min(actor.system.powers.personal.max, actor.system.powers.personal.value + 2),
      });
    }

    // Bad Temper / Something To Prove - see their own checks in _getAutomaticCombatModifiers for
    // the RAW text and the round-scoped flag shape. Stamped here, on the Fumble itself, for
    // whichever of the two Hang-Ups the actor holds (mutually exclusive in practice - a character
    // only ever gets one suggested Hang-Up per additional Influence taken - but checked
    // independently in case a homebrew build takes both).
    if (isFumble && game.combat) {
      if (actorHasHangUp(actor, BAD_TEMPER_HANGUP_ID)) {
        await actor.setFlag('essence20', BAD_TEMPER_FLAG, { combatId: game.combat.id, round: game.combat.round + 1 });
      }

      if (actorHasHangUp(actor, SOMETHING_TO_PROVE_HANGUP_ID)) {
        await actor.setFlag('essence20', SOMETHING_TO_PROVE_FLAG, { combatId: game.combat.id, round: game.combat.round + 1 });
      }
    }

    // Cost of Sorcery - see COST_OF_SORCERY_ID's own comment above. Not gated on game.combat -
    // RAW's own Fumble clause isn't Combat-only, unlike Bad Temper/Something To Prove just above.
    if (isFumble && checkContext.isSorcerousAttempt && actorHasHangUp(actor, COST_OF_SORCERY_ID)) {
      await actor.update({ 'system.health.value': Math.max(0, actor.system.health.value - 1) });
    }

    // Temperamental (Quartermaster's Guide to Gear p.35; a weapon AND weapon-upgrade trait):
    // "If you Fumble an Attack..., you become the target of the weapon's effect, or a secondary
    // effect if you are immune to the weapon's effect (or another effect the GM feels
    // appropriate)." Read as re-applying the weapon's own (unscaled, this attack's own
    // checkContext.damageValue/damageType) effect straight to the attacker - RAW gives no
    // indication of a second roll, just that the attacker becomes the target of what would
    // otherwise have hit. The "or a secondary/GM-appropriate effect if immune" fallback isn't
    // built (no "pick the next applicable effect" concept exists to fall back to automatically);
    // applyDamage's own Immunity handling already zeroes an immune attacker's own self-hit, which
    // is the closest this codebase gets. See checkContext.temperamentalWeaponName's own comment
    // (rollSkill above) for why the weapon/upgrade-trait lookup itself happens there, not here.
    // Field Test Expert (Cobra Codex p.80): once per combat, that Temperamental Fumble is only a failure.
    const fieldTested = isFumble && checkContext.temperamentalWeaponName && actorHasTrait(actor, TRAIT_PERK.fieldTestExpert)
      && getUses(actor, 'fieldTestExpert', 'encounter') < 1;
    if (fieldTested) {
      await markUsed(actor, 'fieldTestExpert', { window: 'encounter' });
      this._chatMessage.create({ speaker, content: this._localize('E20.FieldTestExpertSaved', { name: actor.name }) });
    }

    if (isFumble && checkContext.temperamentalWeaponName && !fieldTested) {
      await applyDamage(actor, checkContext.damageValue || 0, checkContext.damageType);
      this._chatMessage.create({
        speaker,
        content: this._localize('E20.TemperamentalSelfHit', {
          name: actor.name, weapon: checkContext.temperamentalWeaponName,
        }),
      });
    }

    // Powerful Suggestions (Enigma of Combination, Counselor Focus, 17th level, p.34) - see
    // helpers/powerful-suggestions.mjs's own doc comment. "Critical Success" for a plain Skill
    // Test (as opposed to isCrit above, a weapon-attack-specific "natural max die" concept from
    // Combat p.205 that only ever drives criticalOptions' attack-effect-stacking, gated on
    // checkContext.damageValue existing at all) is this system's own Degrees-of-Success concept -
    // beating the Difficulty by double (multiplier >= 2), the exact same number Devastating
    // Strike's own "double becomes triple" clause already keys off just below. Resolved per-entry
    // in the results.map() below, not here, since multiplier is computed per-target there.
    const powerfulSuggestion = rollContext.skill ? getPendingBonus(actor, POWERFUL_SUGGESTION_FLAG) : null;

    // Critical Success (p.205): the attacker may stack one additional attack effect onto the
    // hit - either the same effect again, or (Table 8-3.1) one of the weapon's Alternate
    // Effects, applied at its own listed value (no further Degrees of Success multiplier - see
    // the Snow Storm example, p.187-188, which adds the alternate's flat value once).
    const criticalOptions = [];
    if (isCrit && checkContext.damageValue) {
      criticalOptions.push({
        key: 'double',
        label: this._localize('E20.CheckCriticalRepeatEffect', { name: checkContext.effectName }),
        damageValue: checkContext.damageValue,
        damageType: checkContext.damageType,
        damageTypeLabel: this._localize(E20.damageTypes[checkContext.damageType]),
      });

      for (const altEffect of checkContext.alternateEffects) {
        criticalOptions.push({
          key: altEffect.id,
          label: altEffect.name,
          damageValue: altEffect.system.damageValue,
          damageType: altEffect.system.damageType,
          damageTypeLabel: this._localize(E20.damageTypes[altEffect.system.damageType]),
        });
      }

      // Bewildering / Traumatic / Maiming / Surgical: "On a Critical Success, the weapon deals 1
      // damage to the target's <Essence>" - offered alongside the usual choices, since "if this
      // weapon has both ... the attacker chooses" (helpers/weapon-upgrades.mjs).
      for (const option of checkContext.critEssenceOptions ?? []) {
        criticalOptions.push({
          key: `essence-${option.essence ?? option.defense}`,
          label: option.source,
          damageValue: 1,
          damageType: 'special',
          essence: option.essence ?? null,
          // The Transformers versions damage a Defense instead (helpers/essence-damage.mjs).
          defense: option.defense ?? null,
          damageTypeLabel: option.defense
            ? this._localize(E20.defenses?.[option.defense] ?? option.defense)
            : this._localize(E20.essences?.[option.essence] ?? option.essence),
        });
      }
    }

    let powerfulSuggestionConsumed = false;
    let suckerPunchConsumed = false;
    let silverMedalSyndromeTriggered = false;
    // No Factor - see helpers/no-factor.mjs's own doc comment. Set once ANY attack against a
    // fooled enemy actually lands, since "afterward, all enemies see through your disguise"
    // clears every fooled enemy, not just the one attacked.
    let noFactorDisguiseBroken = false;
    // Retribution (Through the Shattered Grid, Magna Defender, 7th level, p.25) - see
    // helpers/retribution.mjs's own doc comment. This is the first point this attack's own
    // hit/miss is actually known, so it's where a Defender Step reaction against this entry (see
    // dice.mjs's own per-target difficulty loop) gets resolved into an actual banked bonus.
    // Array#map can't itself await retribution.mjs's own actor lookup/setFlag calls, so eligible
    // entries are collected here and actually banked in a separate loop once results.map returns.
    const retributionsToBank = [];
    const results = checkContext.entries.map(entry => {
      let multiplier = computeMultiplier(roll.total, entry.difficulty);

      // Precision - see PRECISION_ID's own comment above. Replaces the doubling threshold outright
      // rather than bumping on top of it - RAW's "instead of" is a substitution, not an additional
      // way to reach the same tier.
      if (checkContext.isAttack && entry.difficulty && actorHasPerk(actor, PRECISION_ID)) {
        multiplier = roll.total - entry.difficulty >= 10 ? 2 : (roll.total >= entry.difficulty ? 1 : 0);
      }

      // Devastating Strike (Yellow Ranger, 18th level, p.57) - "triple damage... instead of the
      // normal double damage" on a critical hit, i.e. this system's own multiplier-of-2 case (see
      // checkContext.isMelee/DEVASTATING_STRIKE_ID's own comments above) bumped to 3 on melee
      // attacks only.
      if (multiplier == 2 && checkContext.isMelee && actorHasPerk(actor, DEVASTATING_STRIKE_ID)) {
        multiplier = 3;
      }

      // Powerful Suggestions - see its own comment above. "Excel": a marginal Success
      // (multiplier 1) becomes a Critical Success (multiplier 2) outright. "Fail": achieving a
      // genuine Critical Success (multiplier already >= 2) on the suggested Skill "proves the
      // suggestion wrong" and clears it, on top of the downshift-3 rollSkill's own shift
      // computation already applied for as long as it remained banked.
      if (powerfulSuggestion && powerfulSuggestion.skill == rollContext.skill) {
        if (powerfulSuggestion.effect == 'excel' && multiplier == 1) {
          multiplier = 2;
          powerfulSuggestionConsumed = true;
        } else if (powerfulSuggestion.effect == 'fail' && multiplier >= 2) {
          powerfulSuggestionConsumed = true;
        }
      }

      // Sucker Punch - see SUCKER_PUNCH_ID's own comment above and checkContext.isSuckerPunchEligible's
      // own comment (rollSkill()) for the round/once-per-scene/no-parent-weapon half. This is the
      // per-target "hasn't acted yet" half, using the same combat-turns-index lookup First
      // Strike's own check in _getAutomaticCombatModifiers already established.
      if (checkContext.isSuckerPunchEligible && multiplier == 1 && entry.targetUuid && game.combat) {
        const targetCombatant = game.combat.combatants.find(c => c.actor?.uuid == entry.targetUuid);
        const targetHasNotActedYet = targetCombatant
          && game.combat.turns.indexOf(targetCombatant) > game.combat.turn;
        if (targetHasNotActedYet) {
          multiplier = 2;
          suckerPunchConsumed = true;
        }
      }

      // Silver Medal Syndrome (Cobra Codex, Origin benefit, p.46) - see SILVER_MEDAL_SYNDROME_ID's
      // own comment above. Only the consolation "gain shiftUp 1 on your next Skill Test" half is
      // built - reversing an already-resolved Critical Success isn't supported by this engine, so
      // it's granted automatically whenever the actor's own roll crits (multiplier >= 2, this
      // system's own Degrees-of-Success definition of "Critical Success" - see Powerful
      // Suggestions' own comment above for why that's the right check here, not isCrit).
      if (consistentDowngrade) {
        silverMedalSyndromeTriggered = true;
      }

      // Unconscious - see entry.targetUnconscious's own comment above. "A successful attack
      // becomes a critical hit" - a plain success (multiplier 1) is bumped to this system's own
      // Critical Success threshold (multiplier 2), same as Powerful Suggestions' "Excel" case
      // just above; a roll that already crit outright is left alone.
      if (multiplier == 1 && entry.targetUnconscious) {
        multiplier = 2;
      }

      // No Factor - see helpers/no-factor.mjs's own doc comment. Same multiplier 1->2 bump as
      // Unconscious just above, only against an enemy this Perk has already fooled - marks the
      // disguise broken so it can be cleared for every fooled enemy once this map returns.
      if (multiplier == 1 && entry.targetNoFactorFooled) {
        multiplier = 2;
        noFactorDisguiseBroken = true;
      }

      // Better than the Best - helpers/extensions/gij3/dice-hooks.mjs. Before Consistent, so a
      // Critical Success the player gave up stays given up.
      multiplier = betterThanTheBestMultiplier(actor, roll, multiplier);

      // Consistent - "treat it as a regular success".
      if (consistentDowngrade) {
        multiplier = Math.min(multiplier, 1);
      }

      const success = multiplier > 0;

      // Retribution - see this function's own comment above for why the actual banking is
      // deferred until after this map returns.
      const retributionBonusType = computeRetributionBonusType(entry, roll.total);
      if (retributionBonusType) {
        retributionsToBank.push({ reactorUuid: entry.defenderStepReactorUuid, bonusType: retributionBonusType });
      }

      // Only a resolved target actor (not a flat @Check[dif=...] entry) can take Health damage.
      const canApplyDamage = success && entry.targetUuid && checkContext.damageValue;
      // Trigger Happy - an independent compare against the same roll total, not gated on
      // `success` above (RAW: "...in addition to their Toughness or Evasion").
      // Seconds Between Click & Boom - a miss against the holder's Evasion has no effect at all
      // (helpers/extensions/gij3/dice-hooks.mjs).
      const missHasNoEffect = !success && !!entry.targetUuid && ignoresMissEffects(entry.targetUuid, entry.defenseType);
      const frightened = checkContext.triggerHappy && entry.targetUuid && entry.willpowerDifficulty != null
        && !missHasNoEffect && computeMultiplier(roll.total, entry.willpowerDifficulty) > 0;
      // Explosive Aftershock - see isExplosiveAftershockAttack's own comment in rollSkill() above.
      // Same independent-compare shape as Trigger Happy's frightened just above.
      const explosiveAftershock = checkContext.isExplosiveAftershockAttack && entry.targetUuid
        && !missHasNoEffect && entry.toughnessDifficulty != null && computeMultiplier(roll.total, entry.toughnessDifficulty) > 0;

      return {
        name: entry.name,
        targetUuid: entry.targetUuid,
        difficulty: entry.difficulty,
        showDifficulty: true,
        success,
        multiplier,
        damageValue: canApplyDamage ? checkContext.damageValue * multiplier : null,
        // Scaled by this target's own multiplier, same as damageValue above, so "+2" here always
        // means "2 of the number on the button", not the flat pre-Degrees-of-Success amount.
        damageBonusLabel: canApplyDamage && checkContext.damageBonusValue
          ? this._localize('E20.CheckDamageBonusFrom', {
            value: checkContext.damageBonusValue * multiplier,
            sources: checkContext.damageBonusSources.join(', '),
          })
          : null,
        damageType: checkContext.damageType,
        damageTypeLabel: checkContext.damageType ? this._localize(E20.damageTypes[checkContext.damageType]) : null,
        // Same Degrees of Success scaling as damageValue above. `base` is the unscaled amount, for
        // the Critical Success "repeat the effect" option (flat, like the rest of criticalOptions).
        secondaryDamage: canApplyDamage && checkContext.secondaryDamage
          ? {
            type: checkContext.secondaryDamage.type,
            value: checkContext.secondaryDamage.value * multiplier,
            base: checkContext.secondaryDamage.value,
          }
          : null,
        criticalOptions: canApplyDamage ? criticalOptions : [],
        isMightMelee: canApplyDamage ? checkContext.isMightMelee : false,
        frightened,
        explosiveAftershock,
        // Painmonger (Decepticon Directive, Inquisitor Focus, 3rd level, p.43) - see
        // helpers/painmonger.mjs's own doc comment. "Any of your attacks or game effects that
        // inflict Stun also impose the Impaired Condition" - approximated as this attack's own
        // PRIMARY damage type being Stun (not every possible secondary/synthetic Stun source),
        // same scoped-approximation idiom this project already accepts elsewhere.
        painmongerImpaired: canApplyDamage && checkContext.damageType == 'stun' && actorHasPerk(actor, PAINMONGER_ID),
      };
    });

    for (const result of results) {
      if (result.painmongerImpaired && result.targetUuid) {
        const painmongerTarget = await fromUuid(result.targetUuid);
        if (painmongerTarget) {
          await applyTimedCondition(painmongerTarget, 'impaired', 1);
        }
      }
    }

    for (const { reactorUuid, bonusType } of retributionsToBank) {
      await bankRetributionBonus(reactorUuid, actor.uuid, bonusType);
    }

    if (powerfulSuggestionConsumed) {
      await clearPendingBonus(actor, POWERFUL_SUGGESTION_FLAG);
    }

    if (suckerPunchConsumed) {
      await markUsedThisEncounter(actor, SUCKER_PUNCH_ENCOUNTER_FLAG);
    }

    if (silverMedalSyndromeTriggered) {
      await bankPendingBonus(actor, 'pendingSilverMedalSyndrome', { shiftUp: 1 });
    }

    if (noFactorDisguiseBroken) {
      await clearNoFactorDisguise(actor);
    }

    this._applyCritMultiplier(results, checkContext);
    await this._applyImmovableObjectImmunity(results);
    await this._applyPlatePiercingVehicleDamage(actor, results, checkContext);
    await this._applyRazeAndRuinDamage(actor, results, checkContext);
    await this._applySmashDamage(actor, results, checkContext);
    await this._applyTripKnockdown(results, checkContext);
    await this._applyTraitRiders(actor, results, checkContext);
    // Wrecker - see helpers/rough-terrain.mjs#applyWreckerRoughTerrain.
    await applyWreckerRoughTerrain(actor, results, checkContext);
    await this._applyBlindingBlast(results, checkContext);
    await this._applyDeafeningEffect(results, checkContext);
    await this._applyModeLock(results, checkContext);
    this._applyFlameWarlordCritDamage(actor, results);
    this._applyEmptyTheMag(results, checkContext);
    await this._applyPerTwoHits(actor, results, checkContext);
    await this._applyNowhereIsSafe(actor, results, checkContext);

    // Analyze Target - a successful roll increments this actor's own per-target counter, read
    // back by Informed Accuracy (_getAutomaticCombatModifiers) and Target Breakdown (not yet
    // built). Keyed by target UUID rather than a per-target Item/flag, since the count belongs to
    // the ANALYST, not the target.
    if (checkContext.isAnalyzeTarget) {
      for (const result of results) {
        if (result.success && result.targetUuid) {
          const counts = actor.getFlag('essence20', ANALYZE_TARGET_COUNTS_FLAG) ?? {};
          const key = result.targetUuid.replace(/\./g, '-'); // Foundry flag keys can't contain dots.
          await actor.setFlag('essence20', ANALYZE_TARGET_COUNTS_FLAG, { ...counts, [key]: (counts[key] ?? 0) + 1 });
        }
      }
    }

    // Watchful Eyes (Strategist Focus, 6th level, p.68) - a successful attempt marks each targeted
    // enemy with its own labelled Snag for their first Skill Test on their next turn (helpers/extensions/fix3-tf/tf-fixes.mjs).

    // Weapon Implant - see helpers/weapon-implant.mjs's own doc comment. On a successful implant
    // roll, pick a weapon of the declared tier and graft it onto the patient.
    if (checkContext.weaponImplantTier && results[0]?.success) {
      await implantWeapon(actor, checkContext.weaponImplantTier);
    }

    // Rallying Cry (WTNV) - see isWtnvRallyingCryAttempt's own comment above. Same targeted-enemy
    // sweep as Watchful Eyes just above, but capped: RAW Surprises ONE enemy, or up to three on a
    // Critical Success. "Up to three" is a player choice of how many, which the player already
    // made by targeting - so the cap is applied to their own targets rather than prompting, the
    // same honor-system simplification Watchful Eyes' own uncapped sweep uses.
    if (checkContext.isWtnvRallyingCryAttempt && results[0]?.success) {
      const crierToken = actor.getActiveTokens?.()?.[0];
      let remaining = getRallyingCryTargetLimit(isCrit);
      for (const targetToken of game.user.targets) {
        if (remaining <= 0) {
          break;
        }

        if (targetToken.actor && targetToken.document.disposition != crierToken?.document.disposition) {
          await targetToken.actor.toggleStatusEffect('surprised', { active: true });
          remaining -= 1;
        }
      }
    }

    // Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272) - see
    // helpers/bolster-defense.mjs's own doc comment. On a successful DIF 12 Culture (Arcane) roll,
    // bank the chosen Defense bonus on whichever target was resolved at activation time.
    if (checkContext.isBolsterDefenseAttempt && results[0]?.success && checkContext.bolsterDefenseTargetUuid) {
      const bolsterDefenseTarget = await fromUuid(checkContext.bolsterDefenseTargetUuid);
      if (bolsterDefenseTarget) {
        await applyBolsterDefense(bolsterDefenseTarget, checkContext.bolsterDefenseMode, checkContext.bolsterDefenseType);
      }
    }

    // Chronomantic Pulse (Finster's Monster-Magic Cookbook, Sorcerous Power, p.273) - see
    // helpers/chronomantic-pulse.mjs's own doc comment. On a successful DIF 12 Culture (Arcane)
    // roll, write the chosen Initiative value onto whichever target was resolved at activation
    // time (this branch is only ever reached for an UNwilling target - a willing one applies
    // immediately at activation, skipping the roll entirely).
    if (checkContext.isChronomanticPulseAttempt && results[0]?.success && checkContext.chronomanticPulseTargetUuid) {
      const chronomanticPulseTarget = await fromUuid(checkContext.chronomanticPulseTargetUuid);
      if (chronomanticPulseTarget) {
        await applyChronomanticPulse(chronomanticPulseTarget, checkContext.chronomanticPulseInitiative);
      }
    }

    // Jury Rig (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73) - see
    // helpers/jury-rig.mjs's own doc comment. On a successful roll, bank the chosen benefit on
    // whichever vehicle was resolved at activation time.
    if (checkContext.isJuryRigAttempt && results[0]?.success && checkContext.juryRigTargetUuid) {
      const juryRigTarget = await fromUuid(checkContext.juryRigTargetUuid);
      if (juryRigTarget) {
        await applyJuryRigBenefit(juryRigTarget, checkContext.juryRigOption, checkContext.juryRigStandardAction);
      }
    }

    // Spot Weld (Decepticon Directive, General Perk, p.67) - see helpers/spot-weld.mjs's own doc
    // comment. On a successful DIF 12/17 Technology (Repair) roll, heal the target resolved at
    // activation time (self or an ally within reach) by the rolled amount.
    if (checkContext.isSpotWeldAttempt && results[0]?.success && checkContext.spotWeldTargetUuid) {
      const spotWeldTarget = await fromUuid(checkContext.spotWeldTargetUuid);
      if (spotWeldTarget) {
        await applySpotWeldHeal(spotWeldTarget, checkContext.spotWeldHealAmount);
      }
    }

    // Undo Engine - see helpers/undo-engine.mjs's own doc comment. This is the DRIVER's own DIF 20
    // Driving Test, triggered by the attacker's Critical Success (see the isUndoEngineAttempt
    // block below) - a FAILURE here (not a success, unlike every other flat-DIF roll above) marks
    // the vehicle's own Movement disabled.
    if (checkContext.isUndoEngineCheckAttempt && !results[0]?.success && checkContext.undoEngineVehicleUuid) {
      const undoEngineVehicle = await fromUuid(checkContext.undoEngineVehicleUuid);
      if (undoEngineVehicle) {
        await markUndoEngineMovementDisabled(undoEngineVehicle);
      }
    }

    // Improvise Armor (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.73) - see
    // helpers/improvise-armor.mjs's own doc comment. Scales off the raw roll.total itself, not
    // results[0]?.success - RAW never compares this roll against anything, it just reads the
    // number.
    if (checkContext.isImproviseArmorAttempt && checkContext.improviseArmorTargetUuid) {
      const improviseArmorTarget = await fromUuid(checkContext.improviseArmorTargetUuid);
      if (improviseArmorTarget) {
        await applyImproviseArmor(improviseArmorTarget, roll.total);
      }
    }

    // Martial Leadership (Enigma of Combination, General Perk, p.41) - see
    // helpers/martial-leadership.mjs's own doc comment. On a successful roll, prompt for and bank
    // the chosen effect on the target resolved at activation time.
    if (checkContext.isMartialLeadershipAttempt && results[0]?.success && checkContext.martialLeadershipTargetUuid) {
      const martialLeadershipTarget = await fromUuid(checkContext.martialLeadershipTargetUuid);
      if (martialLeadershipTarget) {
        await applyMartialLeadershipEffect(martialLeadershipTarget);
      }
    }

    // Voice of Primus (Enigma of Combination, General Perk, p.41) - see
    // helpers/voice-of-primus.mjs's own doc comment. On a successful roll, prompt for and apply
    // the chosen effect to the target resolved at activation time.
    if (checkContext.isVoiceOfPrimusAttempt && results[0]?.success && checkContext.voiceOfPrimusTargetUuid) {
      const voiceOfPrimusTarget = await fromUuid(checkContext.voiceOfPrimusTargetUuid);
      if (voiceOfPrimusTarget) {
        await applyVoiceOfPrimusEffect(voiceOfPrimusTarget);
      }
    }

    // Voice of Primus's own assist clause ("attempt a DIF 12 Persuasion Skill Test to Lend
    // Assistance") - see helpers/voice-of-primus.mjs's own doc comment. Banks the success rather
    // than acting on it directly; lend-assistance.mjs's own canAssistWithSkill/bankSkillAssist
    // pick it up from there the next time the actor actually takes the Lend Assistance action.
    if (checkContext.isVoiceOfPrimusAssistAttempt && results[0]?.success) {
      await bankVoiceOfPrimusAssistReady(actor);
    }

    // Remote Operations - see helpers/remote-operations.mjs's own doc comment. Same "bank the
    // success, don't act on it immediately" shape as Voice of Primus's own assist clause above.
    if (checkContext.isRemoteOperationsAttempt && results[0]?.success) {
      await bankRemoteOperationsReady(actor);
    }

    // Misled (MLP CRB, Mentor Influence Hang-Up, p.53): "When you Lend Assistance to a creature
    // and they fail at the Skill Test, they suffer ↓1 on their next Skill Test." Checked here
    // (rather than at consumption time above) because only NOW is the outcome known - actor is
    // the one who was assisted and just rolled; the assister is resolved from the uuid threaded
    // through checkContext.lendAssistanceAssisterUuid (only set when a Lend Assistance shift
    // actually applied to this roll). Banked the same unscoped-shiftDown, consumed-on-next-roll
    // shape as Antagonistic (ANTAGONISTIC_SHIFT_DOWN_FLAG) uses.
    if (checkContext.lendAssistanceAssisterUuid && results[0]?.success === false) {
      const misledAssister = await fromUuid(checkContext.lendAssistanceAssisterUuid);
      if (misledAssister && actorHasHangUp(misledAssister, MISLED_HANGUP_ID)) {
        await bankPendingBonus(actor, MISLED_SHIFT_DOWN_FLAG, { shiftDown: 1 });
      }
    }

    // Avast! (Quartermaster's Guide to Gear, Freebooter Focus, 10th level, p.27) - see
    // helpers/avast.mjs's own doc comment. On a successful roll, reroll the target's Initiative
    // and keep whichever result is lower.
    if (checkContext.isAvastAttempt && results[0]?.success && checkContext.avastTargetUuid) {
      const avastTarget = await fromUuid(checkContext.avastTargetUuid);
      if (avastTarget) {
        await applyAvastInitiativePenalty(avastTarget);
      }
    }

    // Words Can Hurt! (Enigma of Combination, Counselor Focus, 6th level, p.34) - see
    // helpers/words-can-hurt.mjs's own doc comment. Same shape as Voice of Primus just above.
    if (checkContext.isWordsCanHurtAttempt && results[0]?.success && checkContext.wordsCanHurtTargetUuid) {
      const wordsCanHurtTarget = await fromUuid(checkContext.wordsCanHurtTargetUuid);
      if (wordsCanHurtTarget) {
        await applyWordsCanHurtEffect(wordsCanHurtTarget);
      }
    }

    // Side Splitter (MLP CRB, Spirit of Laughter Influence Perk, p.86) - see
    // helpers/side-splitter.mjs's own doc comment. Same shape as Words Can Hurt! just above.
    if (checkContext.isSideSplitterAttempt && results[0]?.success && checkContext.sideSplitterTargetUuid) {
      const sideSplitterTarget = await fromUuid(checkContext.sideSplitterTargetUuid);
      if (sideSplitterTarget) {
        await applySideSplitterDamage(sideSplitterTarget);
      }
    }

    // Calming Words (Enigma of Combination, Counselor Focus, 3rd level, p.34) - see
    // helpers/calming-words.mjs's own doc comment. Same shape as Voice of Primus/Words Can Hurt!
    // above, applying whichever of its 2 actions (soothe/cure) was chosen up front.
    if (checkContext.isCalmingWordsAttempt && results[0]?.success && checkContext.calmingWordsTargetUuid) {
      const calmingWordsTarget = await fromUuid(checkContext.calmingWordsTargetUuid);
      if (calmingWordsTarget) {
        await applyCalmingWordsEffect(calmingWordsTarget, checkContext.calmingWordsAction);
      }
    }

    // Lucky Charm (Finster's Monster-Matic Cookbook, Sorcerous Power, p.276) - see
    // helpers/lucky-charm.mjs's own doc comment. On a successful DIF 12 Performance (Rituals)
    // roll, enable the item's own reroll config.
    if (checkContext.isLuckyCharmAttempt && results[0]?.success && checkContext.luckyCharmItemUuid) {
      const luckyCharmItem = await fromUuid(checkContext.luckyCharmItemUuid);
      if (luckyCharmItem) {
        await applyLuckyCharm(luckyCharmItem);
      }
    }

    // Panacea (MLP CRB, Virtuoso Aid spell, p.140) - see helpers/panacea.mjs's own doc comment.
    // Same "currently targeted token, or the caster themselves" resolution as Regeneration/
    // Bestow Expertise below - heals to full and clears Defeated; the Condition-sweep
    // half stays blocked (no generic "clear every status" mechanism exists yet).
    if (checkContext.spellSourceId == PANACEA_ID && results[0]?.success) {
      const panaceaTarget = game.user.targets.first()?.actor ?? actor;
      await applyPanaceaHeal(panaceaTarget);
    }

    // I've Got You (GI Joe CRB, Focus: Medic, 7th level, p.82) - see helpers/i-ve-got-you.mjs's
    // own doc comment. The currently-targeted ally, resolved independently of how the flat `dif`
    // difficulty was determined, same idiom Duty Of The Graphite/Absolute Menace already use.
    if (checkContext.isIveGotYouAttempt && results[0]?.success) {
      const iveGotYouTarget = game.user.targets.first()?.actor;
      if (iveGotYouTarget) {
        await applyIveGotYouHeal(iveGotYouTarget, checkContext.iveGotYouAmount, actor);
      }
    }

    // Mind Over Matter (GI Joe CRB, Focus: Battlefield Psychologist, 6th level, p.86) - see
    // helpers/mind-over-matter.mjs's own doc comment. Same shape as I've Got You just above, minus
    // its +1 bonus.
    if (checkContext.isMindOverMatterAttempt && results[0]?.success) {
      const mindOverMatterTarget = game.user.targets.first()?.actor;
      if (mindOverMatterTarget) {
        await applyMindOverMatterHeal(mindOverMatterTarget, checkContext.mindOverMatterAmount);
      }
    }

    // Regeneration (Quartermaster's Guide to Gear, Grid Power, p.94) - see
    // helpers/regeneration.mjs's own doc comment. Same "currently targeted ally, or the caster
    // themselves" resolution as Panacea above, covering both "in tandem with a Science Skill
    // Test" and "aid another character" in one flow.
    if (checkContext.isRegenerationAttempt && results[0]?.success) {
      const regenerationTarget = game.user.targets.first()?.actor ?? actor;
      await applyRegenerationHeal(regenerationTarget, checkContext.regenerationAmount);
    }

    // Patch Up (Transformers CRB, Focus: Medic, 1st level, p.82) - see helpers/patch-up.mjs's own
    // doc comment. Same "currently targeted ally, or the caster themselves" resolution as
    // Regeneration just above.
    if (checkContext.isPatchUpAttempt && results[0]?.success) {
      const patchUpTarget = game.user.targets.first()?.actor ?? actor;
      await applyHealSkillTestResult(patchUpTarget, checkContext.patchUpAmount);
    }

    // Preventative Measures (Transformers CRB, Focus: Medic, 6th level, p.82) - see
    // helpers/preventative-measures.mjs's own doc comment. The target was fixed at Use-time
    // (preventativeMeasuresTargetUuid), not read off the current targeting - converted to Temp
    // Health rather than real Health.
    if (checkContext.isPreventativeMeasuresAttempt && results[0]?.success && checkContext.preventativeMeasuresTargetUuid) {
      const preventativeMeasuresTarget = await fromUuid(checkContext.preventativeMeasuresTargetUuid);
      if (preventativeMeasuresTarget) {
        await applyHealSkillTestResult(preventativeMeasuresTarget, checkContext.preventativeMeasuresAmount, { isTempHealth: true });
      }
    }

    // Tough It Out (Transformers CRB, Focus: Warrior, 5th level, p.91) - see
    // helpers/tough-it-out.mjs's own doc comment. Always self-targeted.
    if (checkContext.isToughItOutAttempt && results[0]?.success) {
      await applyHealSkillTestResult(actor, checkContext.toughItOutAmount);
    }

    // Stand Together (Transformers CRB, Field Commander, 18th level, p.65) - see
    // helpers/stand-together.mjs's own doc comment. Heals every nearby ally, scaled by this roll's
    // own degree-of-success multiplier.
    if (checkContext.isStandTogetherAttempt && results[0]?.success) {
      await applyStandTogetherHeal(actor, results[0].multiplier);
    }

    // Humanitarian - see helpers/humanitarian.mjs's own doc comment. Same "heal whichever token
    // is currently targeted, or self with nothing targeted" shape as Patch Up above.
    if (checkContext.isHumanitarianAttempt && results[0]?.success) {
      const healTarget = game.user.targets.first()?.actor ?? actor;
      await healTarget.update({
        'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + 1),
      });
    }

    // Welds, Rivets, and Ideas - see helpers/welds-rivets-and-ideas.mjs's own doc comment. Prompts
    // for which item to emulate and grants it.
    if (checkContext.isWeldsRivetsAndIdeasAttempt && results[0]?.success) {
      await activateWeldsRivetsAndIdeas(actor);
    }

    // Enchant (MLP CRB, Elementary Enchantment spell, p.136) - see helpers/enchant.mjs's own doc
    // comment. On a successful cast, banks the chosen skill's own shiftUp on whichever token is
    // currently targeted, or the caster themselves with nothing targeted.
    if (checkContext.isEnchantAttempt && results[0]?.success) {
      const enchantTarget = game.user.targets.first()?.actor ?? actor;
      await applyEnchant(enchantTarget, checkContext.enchantSkill);
    }

    // Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137) - see
    // helpers/bestow-expertise.mjs's own doc comment. On a successful cast, grants the
    // Specialization on whichever token is currently targeted, or the caster themselves.
    if (checkContext.isBestowExpertiseAttempt && results[0]?.success) {
      const bestowExpertiseTarget = game.user.targets.first()?.actor ?? actor;
      await applyBestowExpertise(bestowExpertiseTarget, checkContext.bestowExpertiseSkill, checkContext.bestowExpertiseName);
    }

    // Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21) - see
    // helpers/get-to-know.mjs's own doc comment. On a successful cast, banks the Edge on the
    // CASTER themselves, scoped to both the chosen skill and the researched target.
    if (checkContext.isGetToKnowAttempt && results[0]?.success) {
      const getToKnowTarget = game.user.targets.first()?.actor;
      if (getToKnowTarget) {
        await applyGetToKnow(actor, checkContext.getToKnowSkill, getToKnowTarget.id);
      }
    }

    // Help Yourself (MLP CRB, Elementary Utility spell, p.136) - see helpers/help-yourself.mjs's
    // own doc comment. On a successful cast the clone appears; a failed cast summons nothing. No
    // target is read here - the clone appears "anywhere within the range of the spell" and helps
    // whoever the caster indicates later, one ally per round, so there is nobody to pick yet.
    if (checkContext.spellSourceId == HELP_YOURSELF_ID && results[0]?.success) {
      await summonHelpYourselfClone(actor);
    }

    // Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21) - see
    // helpers/dsoe-disguise.mjs's own doc comment. On a successful cast, activates the disguise on
    // whichever token is currently targeted, or the caster themselves.
    if (checkContext.spellSourceId == DSOE_DISGUISE_ID && results[0]?.success) {
      const disguiseTarget = game.user.targets.first()?.actor ?? actor;
      await applyDsoeDisguise(disguiseTarget);
    }

    // Pack Mule (Knights of Canterlot, Beam spell, p.44) - see helpers/pack-mule.mjs's own doc
    // comment. On a successful hit, banks the 3-round downshift window on the target.
    if (checkContext.spellSourceId == KOC_PACK_MULE_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const packMuleTarget = await fromUuid(result.targetUuid);
        if (packMuleTarget) {
          await markPackMuleDownshift(packMuleTarget);
        }
      }
    }

    // Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // helpers/hot-to-trot.mjs's own doc comment. Not an Attack (10ft range, no Defense compared
    // against) - cast against the spell's own flat casting DIF like Panacea above. On a
    // successful cast, applies the movement flag to whichever token is currently targeted, or the
    // caster themselves with nothing targeted.
    if (checkContext.spellSourceId == KOC_HOT_TO_TROT_ID && results[0]?.success) {
      const hotToTrotTarget = game.user.targets.first()?.actor ?? actor;
      await applyHotToTrot(hotToTrotTarget);
    }

    // Glow (Knights of Canterlot, Elementary Aid spell, p.42) - see helpers/glow.mjs's own doc
    // comment. Self-only (unlike Hot To Trot above) - a successful cast lights up the caster
    // themselves, not whoever's targeted.
    if (checkContext.spellSourceId == KOC_GLOW_ID && results[0]?.success) {
      await applyGlow(actor);
    }

    // Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // helpers/greased-lightning.mjs's own doc comment. On a successful cast, applies the flag to
    // whichever token is currently targeted, or the caster themselves with nothing targeted -
    // same shape as Hot To Trot above.
    if (checkContext.spellSourceId == KOC_GREASED_LIGHTNING_ID && results[0]?.success) {
      const greasedLightningTarget = game.user.targets.first()?.actor ?? actor;
      await applyGreasedLightning(greasedLightningTarget);
    }

    // Sparkle Blast (Knights of Canterlot, Superior Beam spell, p.48) - see
    // helpers/sparkle-blast.mjs's own doc comment. On a successful cast, Blinds every nearby
    // enemy - no per-target Attack roll, unlike every other AoE this project has built.
    if (checkContext.spellSourceId == KOC_SPARKLE_BLAST_ID && results[0]?.success) {
      await applySparkleBlast(actor);
    }

    // Mystery Sense (Knights of Canterlot, Superior Enchantment spell, p.47) - see
    // helpers/mystery-sense.mjs's own doc comment. Self-only, same shape as Glow above.
    if (checkContext.spellSourceId == KOC_MYSTERY_SENSE_ID && results[0]?.success) {
      await applyMysterySense(actor);
    }

    // Glittermane (Knights of Canterlot, Superior Utility spell, p.46) - see
    // helpers/glittermane.mjs's own doc comment. Self-only, same shape as Glow above.
    if (checkContext.spellSourceId == KOC_GLITTERMANE_ID && results[0]?.success) {
      await applyGlittermane(actor);
    }

    // Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50) - see
    // helpers/ookie-spookies.mjs's own doc comment. Self-only, same shape as Glow above.
    if (checkContext.spellSourceId == KOC_OOKIE_SPOOKIES_ID && results[0]?.success) {
      await applyOokieSpookies(actor);
    }

    // Foolscarrot (Knights of Canterlot, Elementary Enchantment spell, p.42) - see
    // helpers/foolscarrot.mjs's own doc comment. On a successful cast, applies the flag to
    // whichever token is currently targeted, or the caster themselves with nothing targeted -
    // same shape as Hot To Trot/Greased Lightning above.
    if (checkContext.spellSourceId == KOC_FOOLSCARROT_ID && results[0]?.success) {
      const foolscarrotTarget = game.user.targets.first()?.actor ?? actor;
      await applyFoolscarrot(foolscarrotTarget);
    }

    // Scarefying Appearance (Knights of Canterlot, Virtuoso Enchantment spell, p.51) - see
    // helpers/scarefying-appearance.mjs's own doc comment. Self-only, same shape as Glow above.
    if (checkContext.spellSourceId == KOC_SCAREFYING_APPEARANCE_ID && results[0]?.success) {
      await applyScarefyingAppearance(actor);
    }

    // Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (Knights of Canterlot,
    // Magic Baubles, p.52) - see helpers/size-change-potions.mjs's own doc comment. Self-only
    // (the roller IS the drinker), same shape as Scarefying Appearance just above. Petite Pony's
    // own "Tiny" is approximated onto 'small', this codebase's own smallest E20.actorSizes rung.
    if (checkContext.spellSourceId == KOC_MASSIVE_MUG_ID && results[0]?.success) {
      await applySizeChangePotion(actor, 'huge');
    }

    if (checkContext.spellSourceId == KOC_PETITE_PONYS_SHRINK_DRINK_ID && results[0]?.success) {
      await applySizeChangePotion(actor, 'small');
    }

    // Block Magic (Knights of Canterlot, Virtuoso Enchantment spell, p.49) - see
    // helpers/block-magic.mjs's own doc comment. A real Spellcasting Attack Test against the
    // target's Willpower - on a hit, applies the flag to the target (not the caster), once per
    // successfully-hit target.
    if (checkContext.spellSourceId == KOC_BLOCK_MAGIC_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const blockMagicTarget = await fromUuid(result.targetUuid);
        if (blockMagicTarget) {
          await applyBlockMagic(blockMagicTarget);
        }
      }
    }

    // Exploit Weakness (PR CRB, Yellow Ranger, 7th/15th level, p.57) - see
    // helpers/exploit-weakness.mjs's own doc comment. This roll's own checkEntries has no
    // target (a flat DIF-14 Alertness Test) - the ORIGINAL melee attack's target is carried
    // separately via checkContext.exploitWeaknessTargetUuid.
    if (checkContext.isExploitWeaknessAttempt && results[0]?.success && checkContext.exploitWeaknessTargetUuid) {
      const exploitWeaknessTarget = await fromUuid(checkContext.exploitWeaknessTargetUuid);
      if (exploitWeaknessTarget) {
        await markExploitWeakness(exploitWeaknessTarget);
      }
    }

    // Fluttery Wings (MLP CRB, Elementary Aid spell, p.136) - see
    // helpers/fluttery-wings.mjs's own doc comment. On a successful cast, grants the +15ft Aerial
    // Movement flag to whichever token is currently targeted, or the caster themselves.
    if (checkContext.spellSourceId == FLUTTERY_WINGS_ID && results[0]?.success) {
      const flutteryWingsTarget = game.user.targets.first()?.actor ?? actor;
      await applyFlutteryWings(flutteryWingsTarget);
    }

    // Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139) - see
    // helpers/lightning-speed.mjs's own doc comment. On a successful cast, grants the Movement-
    // doubling flag to whichever token is currently targeted, or the caster themselves.
    if (checkContext.spellSourceId == LIGHTNING_SPEED_ID && results[0]?.success) {
      const lightningSpeedTarget = game.user.targets.first()?.actor ?? actor;
      await applyLightningSpeed(lightningSpeedTarget);
    }

    // Summon Armor / Summon Shield (MLP CRB spells) - see helpers/summon-armor.mjs's own doc
    // comment. Same "grant a flag to whichever token is currently targeted, or the caster
    // themselves" shape as Fluttery Wings/Lightning Speed just above.
    if ((checkContext.spellSourceId == SUMMON_ARMOR_ID || checkContext.spellSourceId == SUMMON_SHIELD_ID) && results[0]?.success) {
      const summonArmorTarget = game.user.targets.first()?.actor ?? actor;
      await applySummonArmor(summonArmorTarget, { rounds: checkContext.spellSourceId == SUMMON_SHIELD_ID ? 2 : null });
    }

    // Don't-Notice-Me-Field (MLP CRB, Superior Enchantment spell, p.137) - see
    // helpers/dont-notice-me-field.mjs's own doc comment. Same "grant a flag to whichever token is
    // currently targeted, or the caster themselves" shape as Summon Armor/Shield just above.
    if (checkContext.spellSourceId == DONT_NOTICE_ME_FIELD_ID && results[0]?.success) {
      const dontNoticeMeFieldTarget = game.user.targets.first()?.actor ?? actor;
      await applyDontNoticeMeField(dontNoticeMeFieldTarget);
    }

    // Stunning Surprise (Prowler Focus, 1st level, p.86) / Catch Off Guard - both apply an extra
    // effect alongside a normal successful hit, independent of whether the attack's own damageValue
    // is set (an unarmed/no-damage weaponEffect can still carry one of these Perks). Lock Down is
    // its item's own hit Trigger rule.
    if (checkContext.stunningSurpriseStun || checkContext.isCatchOffGuardAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        if (checkContext.stunningSurpriseStun && this._isUnawareOfAttacker(targetActor, actor)) {
          await applyDamage(targetActor, 1, 'stun');

          if (actorHasPerk(actor, KNOCK_DOWN_DRAG_OUT_ID)
              && getEffectiveLevel(actor) - getEffectiveLevel(targetActor) >= 3) {
            await applyTimedCondition(targetActor, 'unconscious', 1);
          }
        }

        // Catch Off Guard - see CATCH_OFF_GUARD_ID's own comment above. Always +1 Stun - RAW's own
        // "if the normal effect is Stun 1, you deal Stun 2" is just this same addition's own
        // arithmetic outcome (Stun already stacks - helpers/combat.mjs#applyDamage), not a
        // separate special case to branch on.
        if (checkContext.isCatchOffGuardAttempt) {
          await applyDamage(targetActor, 1, 'stun');
        }
      }
    }

    // Roaming the Land - see ROAMING_THE_LAND_ID's own comment above. "Larger Creatures" Stun
    // half, applied per-target once the hit actually lands (a multi-target roll could hit
    // differently-sized creatures, unlike the pre-roll "smaller creatures" damage half above).
    if (checkContext.roamingTheLandStun) {
      const sizeOrder = Object.keys(E20.actorSizes);
      const actorSizeIndex = sizeOrder.indexOf(actor.system.size);
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const targetSizeIndex = sizeOrder.indexOf(targetActor.system.size);
        if (actorSizeIndex != -1 && targetSizeIndex != -1 && targetSizeIndex > actorSizeIndex) {
          await applyDamage(targetActor, 1, 'stun');
        }
      }
    }

    // Barreling Beam (MLP CRB, Elementary Beam spell, p.136) - Prone-on-Critical-Success half
    // only: "If you aren't pushing them into danger, then your target is knocked Prone on a
    // Critical Success." Only this half is built - the "move your target up to 15ft away"
    // knockback half needs the already-confirmed forced-movement/knockback gap this project
    // doesn't have anywhere. Critical Success reads as multiplier >= 2, the same idiom Shoots and
    // Scores/Stylish Strike already established.
    if (checkContext.spellSourceId == BARRELING_BEAM_ID) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const barrelingBeamTarget = await fromUuid(result.targetUuid);
        if (barrelingBeamTarget) {
          await barrelingBeamTarget.toggleStatusEffect('prone', { active: true });
        }
      }
    }

    // Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see helpers/mind-beam.mjs's own doc
    // comment. On a successful Attack, applies whichever of Frightened/Impaired/Stunned was
    // picked before the roll.
    if (checkContext.spellSourceId == MIND_BEAM_ID && checkContext.mindBeamEffect) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const mindBeamTarget = await fromUuid(result.targetUuid);
        if (mindBeamTarget) {
          await mindBeamTarget.toggleStatusEffect(checkContext.mindBeamEffect, { active: true });
        }
      }
    }

    // Spot - see isSpotAttempt's own comment above. Marks the target on a successful hit; read
    // back (and consumed) in _getAutomaticCombatModifiers, the same "read on the ATTACKER's next
    // roll, not the marker's own" shape as Roll With the Punches/Hard Target's target-side banks.
    if (checkContext.isSpotAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.setFlag('essence20', 'spotted', true);
        }
      }
    }

    // Hobble (Decepticon Directive Raider, Acquisitions Expert Focus, 20th level, p.63) - see
    // HOBBLE_ID's own comment above. One picker prompt per successfully-hit target (matches RAW's
    // "your choice" - asked fresh each time rather than remembered from a prior use). "Until the
    // end of the target's next turn" has no active expiry (same unenforced-duration idiom used
    // throughout this codebase) - a GM clears it manually, same as every other Condition this
    // project applies without its own duration tracker.
    if (checkContext.hobbleAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const condition = await pickHobbleCondition();
        if (condition) {
          await targetActor.toggleStatusEffect(condition, { active: true });
        }
      }
    }

    // Crippling Blow - see helpers/crippling-blow.mjs's own doc comment. Same one-picker-per-
    // successful-hit shape as Hobble just above, with its own 3-option set (Blinded/Deafened/
    // Prone) and a real melee weapon Attack rather than Hobble's ranged-only gate.
    if (checkContext.cripplingBlowAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        // Bleed 'Em Dry - see BLEED_EM_DRY_ID's own comment above. Replaces the Condition picker
        // with an Energon Point drain once the actor holds this Perk.
        if (actorHasPerk(actor, BLEED_EM_DRY_ID)) {
          const currentEnergon = targetActor.system.energon?.normal?.value ?? 0;
          if (currentEnergon > 0) {
            const bleedEmDryRoll = new Roll('1d2');
            await bleedEmDryRoll.evaluate();
            await targetActor.update({
              'system.energon.normal.value': Math.max(0, currentEnergon - bleedEmDryRoll.total),
            });
          }

          continue;
        }

        const condition = await pickCripplingBlowCondition();
        if (condition) {
          await targetActor.toggleStatusEffect(condition, { active: true });
        }
      }
    }

    // Dirty Blows - see DIRTY_BLOWS_ID's own comment above. A single fixed Condition, so no
    // picker is needed the way Hobble/Crippling Blow's own multi-option choice requires one.
    if (checkContext.dirtyBlowsAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await applyTimedCondition(targetActor, 'impaired', 1);
        }
      }
    }

    // Attacking Space Vessel Systems (Across the Stars p.25) - see
    // updatedShiftDataset.targetVesselSystemAvailable's own comment. The Critical Effect lands on a
    // Critical Success, the same multiplier >= 2 threshold as Grinder just below.
    if (checkContext.targetVesselSystemAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await imposeVesselConditionOnCrit(actor, targetActor);
        }
      }
    }

    // Repairing a Space Vessel Condition (Across the Stars p.26) - see
    // helpers/vessel-conditions.mjs#resolveVesselRepair. A flat-DIF roll, so its one entry decides.
    if (checkContext.repairVesselUuid) {
      await resolveVesselRepair(actor, checkContext, {
        success: !!results[0]?.success, multiplier: results[0]?.multiplier ?? 0, isCrit, isFumble,
      });
    }

    // Grinder - see GRINDER_ID's own comment above. Critical-Success-only, same
    // result.multiplier >= 2 threshold as every other Degrees-of-Success rider in this file.
    // "For the remainder of the scene" gets no active expiry - the same unenforced-duration idiom
    // Nemesis Drain's own identical "until the end of the scene" already uses.
    if (checkContext.isGrinderAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('impaired', { active: true });
        }
      }
    }

    // Dirty Trick (GI Joe CRB, Ranger Environmental Exposure choice, p.91) - see
    // helpers/dirty-trick.mjs's own doc comment. Same one-picker-per-successful-hit shape as
    // Hobble just above, with its own 3-option set (Blind/Stun/Prone).
    if (checkContext.isDirtyTrickAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const condition = await pickDirtyTrickCondition();
        if (condition) {
          await targetActor.toggleStatusEffect(condition, { active: true });
        }
      }
    }

    // Bump & Run - see BUMP_AND_RUN_ID's own comment above. "Until the end of the target's next
    // turn" has no active expiry (same unenforced-duration idiom as Hobble/Lock Down/etc.) - a GM
    // clears it manually.
    if (checkContext.bumpAndRunAttempt) {
      for (const result of results) {
        if (result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('stunned', { active: true });
        }
      }
    }

    // Get A Grip - see GET_A_GRIP_ID's own comment above. Size Class gate and the actual
    // Free-action spend both happen here, post-hit, against the real target - only the FIRST
    // legal hit target is Grappled (the two Free actions are a single spend for the whole attack,
    // not per-target), matching RAW's own singular "the same target".
    if (checkContext.getAGripAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const getAGripTarget = await fromUuid(result.targetUuid);
        if (!getAGripTarget || !isWithinGetAGripSizeGate(actor, getAGripTarget)) {
          continue;
        }

        if (await spendGetAGripFreeActions(actor, game.i18n.localize('E20.PerkGetAGrip'))) {
          await getAGripTarget.toggleStatusEffect('grappled', { active: true });
        }

        break;
      }
    }

    // Cryogenic Touch (A Jump Through Time, Grid Power, p.57) - see
    // updatedShiftDataset.cryogenicTouchAvailable's own comment above. Fixed Impaired application,
    // no picker needed (unlike Hobble's own 3-way choice).
    if (checkContext.cryogenicTouchAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('impaired', { active: true });
        }
      }
    }

    // Guardian Strikes (A Jump Through Time, Grid Power, p.57) - see GUARDIAN_STRIKES_ID's own
    // comment above. One picker prompt per successfully-hit target, same "ask fresh each time"
    // shape as Hobble/Menacing Glare.
    if (checkContext.guardianStrikesAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const condition = await pickGuardianStrikesCondition();
        if (condition) {
          await targetActor.toggleStatusEffect(condition, { active: true });
        }
      }
    }

    // Stick In The Spokes - see STICK_IN_THE_SPOKES_ID's own comment above. Critical Success
    // destroys the target (the same Defeated toggle Stun's own auto-Defeat check already uses);
    // a regular success marks it inoperable instead - a plain, unenforced flag, since this system
    // has no vehicle-repair mechanism to eventually clear it against.
    if (checkContext.stickInTheSpokesAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        if (result.multiplier >= 2) {
          await targetActor.toggleStatusEffect('defeated', { active: true });
        } else {
          await targetActor.setFlag('essence20', STICK_IN_THE_SPOKES_INOPERABLE_FLAG, true);
        }
      }
    }

    // Leech Siphons - see LEECH_SIPHONS_ID's own comment above. Critical-Success-only, mirroring
    // Stick In The Spokes/Undo Engine's own result.multiplier >= 2 threshold.
    if (checkContext.isLeechSiphonsAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && (targetActor.system.energon?.normal?.value ?? 0) > 0) {
          await targetActor.update({ 'system.energon.normal.value': targetActor.system.energon.normal.value - 1 });
        }

        await actor.update({ 'system.energon.normal.value': (actor.system.energon?.normal?.value ?? 0) + 1 });
      }
    }

    // Ice Flechettes - see ICE_FLECHETTES_EFFECT_IDS's own comment above. Critical-Success-only,
    // same result.multiplier >= 2 threshold as Leech Siphons just above.
    if (checkContext.isIceFlechettesAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await applyTimedCondition(targetActor, 'armorStripped', 1);
        }
      }
    }

    // Avalanche Stomp (weapon copy) - see AVALANCHE_STOMP_WEAPON_EFFECT_ID's own comment above.
    // Critical-Success-only Prone rider; the Stun damage itself is plain weaponEffect data needing
    // no code.
    if (checkContext.isAvalancheStompWeaponAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('prone', { active: true });
        }
      }
    }

    // Interdiction - see INTERDICTION_ID's own comment above. Any success (not just a Critical
    // Success, unlike Stick In The Spokes just above) Defeats the target instead of dealing
    // damage - the same Defeated toggle Stun's own auto-Defeat check already establishes.
    if (checkContext.interdictionAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        await targetActor.toggleStatusEffect('defeated', { active: true });
      }
    }

    // Undo Engine - see UNDO_ENGINE_ID's own comment above and helpers/undo-engine.mjs's own doc
    // comment. Only a Critical Success (multiplier >= 2, the same threshold Stick In The Spokes'
    // own Critical clause above uses) against a vehicle target triggers this - a regular success
    // does nothing extra. Fires the target vehicle's own driver's flat-DIF Driving Test; the
    // actual marking happens in that SEPARATE roll's own post-hit processing above, on failure.
    if (checkContext.isUndoEngineAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor?.type != 'vehicle') {
          continue;
        }

        const driver = this._getVehicleDriver(targetActor);
        if (driver) {
          await triggerUndoEngineCheck(driver, targetActor);
        }
      }
    }

    // Menacing Glare (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see
    // helpers/menacing-glare.mjs's own doc comment. One picker prompt per successfully-hit
    // target, same "ask fresh each time" shape as Hobble above.
    if (checkContext.isMenacingGlareAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const effect = await pickMenacingGlareEffect();
        if (effect) {
          await applyMenacingGlareEffect(actor, targetActor, effect);
        }
      }
    }

    // Instill Weakness (Decepticon Directive, Raider, 10th level, p.41) - see
    // helpers/instill-weakness.mjs's own doc comment. Same "ask fresh each time" shape as Menacing
    // Glare just above.
    if (checkContext.isInstillWeaknessAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        await applyInstillWeakness(actor, targetActor);
      }
    }

    // Deconstructionist - see helpers/deconstructionist.mjs's own doc comment. Same "ask fresh
    // each time" shape as Menacing Glare/Instill Weakness just above.
    if (checkContext.isDeconstructionistAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        await markDeconstructionist(targetActor);
      }
    }

    // No Factor - see helpers/no-factor.mjs's own doc comment. Same "ask fresh each time" per-
    // target success loop as Deconstructionist just above - marks every enemy successfully
    // Deceived as fooled (this Deception roll may hit several at once via Multiple Targets).
    if (checkContext.isNoFactorAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await markNoFactorFooled(actor, targetActor);
        }
      }
    }

    // Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63) - see
    // helpers/antagonistic.mjs's own doc comment. Same "ask fresh each time" shape as Menacing
    // Glare just above, single-target (only 1 entry expected).
    if (checkContext.isAntagonisticAttempt) {
      const entry = results[0];
      if (entry?.success && entry.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          const effect = await pickAntagonisticEffect();
          if (effect) {
            await applyAntagonisticEffect(actor, targetActor, effect);
          }
        }
      }
    }

    // Flying Nuisance (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.66) - see
    // helpers/flying-nuisance.mjs's own doc comment. No player choice needed (unlike Antagonistic
    // above) - a success banks the unscoped Snag outright, single-target (only 1 entry expected).
    if (checkContext.isFlyingNuisanceAttempt) {
      const entry = results[0];
      if (entry?.success && entry.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await markFlyingNuisanceSnag(targetActor);
        }
      }
    }

    // Face Me! (Enigma of Combination, Pillar Origin Benefit, p.27) - see
    // helpers/face-me.mjs's own doc comment. No player choice needed - a success banks the
    // compulsion outright, single-target (only 1 entry expected).
    if (checkContext.isFaceMeAttempt) {
      const entry = results[0];
      if (entry?.success && entry.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await applyFaceMeEffect(actor, targetActor);
        }
      }
    }

    // Absolute Menace (Beneath the Helmet, Dark Ranger, 18th level, p.40) - see
    // helpers/absolute-menace.mjs's own doc comment. No player choice needed (unlike Menacing
    // Glare above) - every successfully-hit enemy is simply Frightened, matching Trigger Happy's
    // own toggleStatusEffect call.
    if (checkContext.isAbsoluteMenaceAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Avalanche Stomp - see helpers/avalanche-stomp.mjs's own doc comment. Every successfully-hit
    // creature is Stunned; a Critical Success (result.multiplier >= 2, this system's own Degrees-
    // of-Success threshold for a plain Skill Test - see Powerful Suggestions' own comment above
    // for why that's the right check here, not isCrit) also knocks them Prone.
    if (checkContext.isAvalancheStompAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await applyAvalancheStompEffect(targetActor, result.multiplier >= 2);
        }
      }
    }

    // Voice of Night Vale - see helpers/surprise.mjs's own doc comment. Identical to Absolute
    // Menace just above, applying the Surprised Condition rather than Frightened.
    if (checkContext.isVoiceOfNightValeAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('surprised', { active: true });
        }
      }
    }

    // Nemesis Drain - see helpers/nemesis-drain.mjs's own doc comment. Every successfully-hit
    // enemy loses 1 Personal Power and is marked with the Defense penalty.
    if (checkContext.isNemesisDrainAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await applyNemesisDrainEffect(targetActor);
        }
      }
    }

    // Frightening Display (Enigma of Combination, Cannoneer Focus, 10th level, p.32) - see
    // helpers/frightening-display.mjs's own doc comment. Same shape as Absolute Menace above -
    // every successfully-hit enemy is simply Frightened. "For 1d4 rounds" is approximated as the
    // same "grant, GM manages the edges" duration idiom Absolute Menace's own "until the end of
    // your next turn" already uses.
    if (checkContext.isFrighteningDisplayAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Terrifying Presence (GI Joe Core Rulebook, General Perk, p.134-135) - see
    // helpers/terrifying-presence.mjs's own doc comment. Only the Frightened/Stunned riders land
    // here (post-hit) - the damage rider was already folded into damageBonusValue pre-roll. "For
    // one round" is approximated the same "grant, GM manages the edges" way Absolute Menace's own
    // "until the end of your next turn" already is.
    if ((checkContext.terrifyingPresenceRider == 'frightened' || checkContext.terrifyingPresenceRider == 'stun') && results[0]?.success && results[0]?.targetUuid) {
      const targetActor = await fromUuid(results[0].targetUuid);
      if (targetActor) {
        await targetActor.toggleStatusEffect(
          checkContext.terrifyingPresenceRider == 'stun' ? 'stunned' : 'frightened', { active: true },
        );
      }
    }

    // Fearsome Presence (Renegade base, 14th level, p.97) - see
    // helpers/fearsome-presence.mjs's own doc comment. Same unconditional multi-target Frightened
    // shape as Absolute Menace above.
    if (checkContext.isFearsomePresenceAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Elemental Storm (Beneath the Helmet, Aqua Ranger, 10th level, p.42) - see
    // helpers/elemental-storm.mjs's own doc comment. Unlike Menacing Glare's own per-target choice,
    // every successfully-hit enemy is afflicted with the ONE Condition already chosen up front
    // (checkContext.elementalStormCondition), the same unconditional toggleStatusEffect shape as
    // Absolute Menace/Duty Of The Graphite above.
    if (checkContext.isElementalStormAttempt && checkContext.elementalStormCondition) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect(checkContext.elementalStormCondition, { active: true });
        }
      }
    }

    // Ground Suppression - see helpers/ground-suppression.mjs's own doc comment. Same multi-
    // target success loop as Elemental Storm just above, but banking a Defense-reduction mark
    // instead of toggling a status.
    if (checkContext.isGroundSuppressionAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await markGroundSuppressed(targetActor);
        }
      }
    }

    // Duty Of The Graphite (Beneath the Helmet, Graphite Ranger, 7th level, p.47) - see
    // helpers/duty-of-the-graphite.mjs's own doc comment. "That enemy gains the Blinded
    // Condition" on a successful arrival check, same unconditional toggleStatusEffect shape as
    // Absolute Menace/Trigger Happy above.
    if (checkContext.isDutyOfTheGraphiteAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('blinded', { active: true });
        }
      }
    }

    // Talk Them Down (GI Joe CRB, Spy Focus, 17th level, p.76) - see TALK_THEM_DOWN_ID's own
    // comment in banked-buffs.mjs. "The target drops their weapons, surrenders, and gains the
    // Frightened Condition" on a success - the drop-weapons/surrender half is narrative, only
    // Frightened is a real coded status to toggle. The "threat level no higher than yours" cap
    // isn't separately enforced here - the player self-polices which target this ability is even
    // legal against, the same "player self-polices the fictional precondition" idiom already
    // covering the "if you have Edge on an attack" gate this whole ability replaces.
    if (checkContext.isTalkThemDownAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Omega Enhancement's own Light Beam Mode - see helpers/omega-enhancement.mjs's own doc
    // comment. "The enemy suffers 1 Energy damage and is Blinded until the end of their next
    // turn" - same unconditional toggleStatusEffect shape as Duty Of The Graphite just above
    // ("until the end of their next turn" approximated as a plain grant, the same accepted
    // duration-simplification this project already uses broadly).
    if (checkContext.isOmegaLightBeamAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('blinded', { active: true });
        }
      }
    }

    // Distracting Offer (Cobra Codex, Corrupt Origin benefit, p.42) - see
    // helpers/distracting-offer.mjs's own doc comment. Records the scene-gate outcome either way
    // (success or failure), and on a success banks the target's own shiftDown penalty, doubled on
    // a Critical Success (multiplier >= 2, this system's own Degrees-of-Success definition - same
    // check Silver Medal Syndrome's own comment above explains).
    if (checkContext.isDistractingOfferAttempt) {
      const entry = results[0];
      if (entry?.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await recordDistractingOfferResult(actor, targetActor, entry.success, entry.multiplier >= 2);
        }
      }
    }

    // Growl - see GROWL_ID's own comment above / helpers/growl.mjs. Banks the actor's OWN
    // target-scoped shiftUp (not the target's), matching Menacing Glare's own Edge shape.
    if (checkContext.isGrowlAttempt) {
      const entry = results[0];
      if (entry?.success && entry.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await bankPendingBonus(actor, GROWL_SHIFT_UP_FLAG, { targetId: targetActor.id });
        }
      }
    }

    // Tear Down - see helpers/tear-down.mjs's own doc comment. Same "bank on the actor, scoped
    // to that one target" shape as Growl just above, but a flat damage bonus consumed by the
    // very next attack against them instead of a shiftUp.
    if (checkContext.isTearDownAttempt) {
      const entry = results[0];
      if (entry?.success && entry.targetUuid) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await markTearDownPending(actor, targetActor);
        }
      }
    }

    // Get The Horns - see GET_THE_HORNS_ID's own comment above.
    if (checkContext.wasGrowlApplied && checkContext.isMelee && actorHasPerk(actor, GET_THE_HORNS_ID)) {
      const entry = results.find(result => result.success && result.targetUuid);
      if (entry) {
        const targetActor = await fromUuid(entry.targetUuid);
        if (targetActor) {
          await bankPendingBonus(actor, GROWL_SHIFT_UP_FLAG, { targetId: targetActor.id });
        }
      }
    }

    // Forward Observation - see helpers/forward-observation.mjs's own doc comment. No target at
    // all (a flat DIF 15, the roll's only entry, same shape Watchful Eyes' own dataset.dif check
    // above already uses) - on success, broadcasts a banked shiftUp to the actor and every nearby
    // ally.
    if (checkContext.isForwardObservationAttempt && results[0]?.success) {
      await broadcastForwardObservation(actor);
    }

    // Hearty Meal - see helpers/hearty-meal.mjs's own doc comment. Same flat-DIF, no-target,
    // success-broadcast shape as Forward Observation above.
    if (checkContext.isHeartyMealAttempt && results[0]?.success) {
      await broadcastHeartyMeal(actor);
    }

    // Deadstick - see helpers/deadstick.mjs's own doc comment. "For 1 round" is approximated as
    // "granted, manually cleared" - the same grant-only idiom every other Perk-applied Condition
    // in this project already uses.
    if (checkContext.isDeadstickAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('stunned', { active: true });
        }
      }
    }

    // Siphon - see helpers/siphon.mjs's own doc comment.
    if (checkContext.isSiphonAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const siphonTarget = await fromUuid(result.targetUuid);
        if (siphonTarget) {
          await applySiphonEffect(siphonTarget, actor);
        }
      }
    }

    // Flashy - see helpers/flashy.mjs's own doc comment.
    if (checkContext.isFlashyAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const flashyTarget = await fromUuid(result.targetUuid);
        if (flashyTarget) {
          await applyFlashyBlinded(flashyTarget, actor);
        }
      }
    }

    // Tech Specs - see helpers/tech-specs.mjs's own doc comment. On a success: reveal the
    // target's info, then mark them for the round-scoped ally-broadcast shiftUp.
    if (checkContext.isTechSpecsAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          postPerkUseChatCard(actor, buildTechSpecsResult(targetActor));
          await markTechSpecsTarget(actor, targetActor);
        }
      }
    }

    // Breaking Point - see helpers/breaking-point.mjs's own doc comment. A flat-DIF roll, so the
    // single synthetic entry has no targetUuid of its own - reads the target back from
    // checkContext.breakingPointTargetUuid (threaded through at activation) instead.
    if (checkContext.isBreakingPointAttempt && results[0]?.success && checkContext.breakingPointTargetUuid) {
      const targetActor = await fromUuid(checkContext.breakingPointTargetUuid);
      if (targetActor) {
        const detail = await pickBreakingPointDetail();
        if (detail) {
          postPerkUseChatCard(actor, buildBreakingPointResult(targetActor, detail));
        }
      }
    }

    // Tender (MLP CRB, Spirit of Kindness, 6th level, p.85) - see helpers/tender.mjs's own doc
    // comment. Banks an unscoped ↓1 on a successfully-hit target, same idiom as Menacing
    // Glare's own Snag half.
    if (checkContext.isTenderAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await bankPendingBonus(targetActor, 'pendingTenderSnag', { shiftDown: 1 });
        }
      }
    }

    // Your Safety's On - see YOUR_SAFETYS_ON_SNAG_FLAG's own comment above.
    if (checkContext.isYourSafetysOnAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        if (result.multiplier >= 2 && game.combat) {
          await targetActor.setFlag('essence20', YOUR_SAFETYS_ON_ALL_ATTACKS_FLAG, {
            combatId: game.combat.id, round: game.combat.round,
          });
        } else {
          await bankPendingBonus(targetActor, YOUR_SAFETYS_ON_SNAG_FLAG, { snag: true });
        }
      }
    }

    // Withering Fire (Factions in Action Vol. 2, Infantry Focus, p.68) - see WITHERING_FIRE_ID's
    // own comment above. "Give the target the Frightened Condition if your Attack hits" - same
    // unconditional toggleStatusEffect shape as Duty Of The Graphite/Absolute Menace above.
    if (checkContext.isWitheringFireAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Takedown - see helpers/takedown.mjs's own doc comment. The outcome matrix: hit + target not
    // above the attacker's own level -> Restrained + Unconscious; miss + target above the
    // attacker's level -> no effect at all; every other combination (hit + outmatched, or miss +
    // not outmatched) -> Grapple instead.
    if (checkContext.isTakedownAttempt) {
      for (const result of results) {
        if (!result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        const targetOutmatchesAttacker = getEffectiveLevel(targetActor) > getEffectiveLevel(actor);
        if (result.success && !targetOutmatchesAttacker) {
          await targetActor.toggleStatusEffect('restrained', { active: true });
          await targetActor.toggleStatusEffect('unconscious', { active: true });
        } else if (!result.success && targetOutmatchesAttacker) {
          continue;
        } else if (!result.success && !targetOutmatchesAttacker) {
          await targetActor.toggleStatusEffect('grappled', { active: true });

          // Takedown Expert (Infiltrator Focus, 6th level, p.73): "If you fail against a target
          // of a threat level no higher than your level, in addition to being grappled, you may
          // choose if your target is additionally disarmed, immobilized, or silenced." Only
          // Immobilized has a real status in this system (no 'disarmed'/'silenced' status exists
          // anywhere) - so rather than offer a 3-way picker where 2 of its 3 buttons would
          // silently do nothing, this applies the one mechanical option unconditionally; a player
          // narrating Disarmed/Silenced instead is free to do so by hand, the same "the fictional
          // framing is the player's own choice" idiom this project already applies to narrower
          // unenforceable qualifiers elsewhere.
          // The choice itself - helpers/extensions/gij3/dice-hooks.mjs#takedownExpertChoice.
          if (actorHasPerk(actor, TAKEDOWN_EXPERT_ID)) {
            await takedownExpertChoice(actor, targetActor);
          }
        } else {
          await targetActor.toggleStatusEffect('grappled', { active: true });
        }
      }
    }

    // Outwit (Focus: Battlefield Psychologist, 3rd level, p.86) - see helpers/outwit.mjs's own
    // doc comment. Applies whichever Condition was chosen up front (Stunned or Frightened) to a
    // successfully-hit target - same unconditional toggleStatusEffect shape as Duty Of The
    // Graphite/Absolute Menace above.
    if (checkContext.isOutwitAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect(checkContext.outwitCondition, { active: true });
        }

        // Inundation - see INUNDATION_ID's own comment above. Marks this target as successfully
        // Outwitted BY THIS ACTOR (banked on the actor, not the target, since Inundation's own
        // Edge check reads it off the roller), for that check to read back on a later attempt.
        if (actorHasPerk(actor, INUNDATION_ID)) {
          const outwitted = actor.getFlag?.('essence20', OUTWITTED_TARGETS_FLAG) ?? {};
          await actor.setFlag('essence20', OUTWITTED_TARGETS_FLAG, {
            ...outwitted, [result.targetUuid.replace(/\./g, '-')]: true,
          });
        }
      }
    }

    // A Logical Explanation (WTNV Citizen's Guide, Scientist Role, University Of What It Is
    // Focus, p.46) - see helpers/a-logical-explanation.mjs's own doc comment. "They become
    // Stunned and can no longer attack you or your allies until the end of their next turn" - the
    // Stunned Condition itself, same unconditional toggleStatusEffect shape as Duty Of The
    // Graphite above. The Critical Success clause ("they leave and are no longer an active
    // threat") is left to GM narration - Stunned already accomplishes the mechanical "can't
    // attack" half, and this system has no distinct "removed from the fight" status to apply.
    if (checkContext.isALogicalExplanationAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('stunned', { active: true });
        }
      }
    }

    // Soothe - see checkContext.isSootheAttempt's own comment above. Same shape as A Logical
    // Explanation just above, its own printed Condition (Mesmerized) instead of Stunned.
    if (checkContext.isSootheAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('mesmerized', { active: true });
        }
      }
    }

    // Manipulate - see checkContext.isManipulateAttempt's own comment above. Same shape as Soothe
    // just above, its own printed Condition (Grappled, capped to ~1 round via applyTimedCondition)
    // instead of Mesmerized.
    if (checkContext.isManipulateAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await applyTimedCondition(targetActor, 'grappled', 1);
        }
      }
    }

    // Talk Them Up - see helpers/talk-them-up.mjs's own doc comment. A flat-DIF roll, so the
    // single synthetic entry has no targetUuid of its own - reads the target back from
    // checkContext.talkThemUpTargetUuid (threaded through at activation), same shape as Breaking
    // Point above.
    if (checkContext.isTalkThemUpAttempt && results[0]?.success && checkContext.talkThemUpTargetUuid) {
      const targetActor = await fromUuid(checkContext.talkThemUpTargetUuid);
      if (targetActor) {
        await applyTalkThemUp(targetActor);
      }
    }

    // Talk Them Down (Field Guide to Action & Adventure) - see helpers/talk-them-down.mjs's own
    // doc comment. Same shape as Soothe/Manipulate above; the eligibility preconditions (half
    // Health, lower Threat Level) were already checked before this roll was ever triggered
    // (activateTalkThemDown). Distinct compendium Item/flag from GI Joe CRB's own Talk Them Down
    // just above (isTalkThemDownAttempt) - same book-collision naming as TALK_THEM_DOWN_FGTAA_ID.
    if (checkContext.isTalkThemDownFgtaaAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('defeated', { active: true });
        }
      }
    }

    // Bumper Crop - see checkContext.isBumperCropAttempt's own comment above. A flat-DIF roll (no
    // target), so this reads results[0] directly instead of looping per-target-uuid like every
    // other post-hit handler in this section.
    if (checkContext.isBumperCropAttempt && results[0]?.success) {
      const margin = roll.total - results[0].difficulty;
      await applyBumperCropSnag(actor, margin);
    }

    // Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - see
    // helpers/supreme-guardian.mjs's own doc comment. Multi-target, like Absolute Menace/
    // Elemental Storm above (every currently-targeted enemy that was hit gets Blinded), not
    // single-target like Duty Of The Graphite just above.
    if (checkContext.isSupremeGuardianBlindAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await targetActor.toggleStatusEffect('blinded', { active: true });
        }
      }
    }

    // Rouse (GI Joe CRB, Officer base, 1st level, p.85) - see helpers/rouse.mjs's own doc
    // comment. A success (not failure, unlike Stay Humble/Everything is Inspiration just below)
    // on this flat DIF 15 Persuasion Skill Test grants the Story Point.
    if (checkContext.isRouseAttempt && results.some(result => result.success) && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
    }

    // Laughtracting - see helpers/action-perks.mjs's own entry. Each creature it beat loses its Free
    // actions (and, with Distraughter, its Move action) on its next turn.
    if (checkContext.isLaughtractingAttempt) {
      const block = getLaughtractingBlock(actor);
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await setNextTurn(targetActor, { block }, findSourced(actor, ACTION_PERK_IDS.laughtracting)?.name ?? 'Laughtracting');
        }
      }
    }

    // Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86) - see
    // helpers/rousing-comeback.mjs's own doc comment. Same success-grants-a-Story-Point shape as
    // Rouse just above.
    if (checkContext.isRousingComebackAttempt && results.some(result => result.success) && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
    }

    // Iron Hide (GI Joe CRB, Vanguard base, 1st level, p.107) - see helpers/iron-hide.mjs's own
    // doc comment. A success restores the Health that was already applied (capped at max) - the
    // Story Point was already spent and the damage already landed before this roll was triggered,
    // since the attempt's own outcome couldn't be known synchronously at that point.
    if (checkContext.isIronHideAttempt && results.some(result => result.success) && checkContext.ironHideDamage > 0) {
      const restoredValue = Math.min(actor.system.health.max, actor.system.health.value + checkContext.ironHideDamage);
      await actor.update({ 'system.health.value': restoredValue });
    }

    // Stay Humble (MLP Honesty, 9th level, p.78) - see STAY_HUMBLE_ID's own comment above. Any
    // failed result on this Persuasion roll counts (a multi-target Persuasion roll with at least
    // one failure still "fails" for this purpose) - grants only if a GM is actually connected to
    // perform the world-setting write, same upfront-affordability idiom hasRerollCost's own
    // worldStoryPoints check already uses, just for a grant instead of a spend.
    if (checkContext.isStayHumbleAttempt && results.some(result => !result.success) && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
    }

    // Extra Rough Training - see helpers/extra-rough-training.mjs's own doc comment. A success
    // banks Edge for the ally's own next roll of the trained skill; a failure banks ↑1 instead -
    // both scoped to that one skill (the same shape Ageless Knowledge's own pendingAgelessKnowledge
    // already establishes), read back in this same function's own initial shift/edge computation.
    if (checkContext.isExtraRoughTrainingAttempt && checkContext.extraRoughTrainingSkill) {
      const data = results[0]?.success ? { edge: true } : { shiftUp: 1 };
      await bankPendingBonus(actor, EXTRA_ROUGH_TRAINING_FLAG, { skill: checkContext.extraRoughTrainingSkill, ...data });
    }

    // Hup! Hup! Hup! Hup! Hup! - see helpers/hup-hup-hup-hup-hup.mjs's own doc comment. The DIF 0
    // roll always succeeds - only the raw total matters, read directly off the Roll object rather
    // than any per-target result.
    if (checkContext.isHupHupHupHupHupAttempt) {
      await broadcastHupHupHupHupHupBonus(actor, roll.total);
    }

    // Snarl - see SNARL_ID's own comment above. Same unconditional single-target Frightened shape
    // as Absolute Menace/Frightening Display above, just against whichever one target was
    // actually rolled against.
    if (checkContext.isSnarlAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const snarlTarget = await fromUuid(result.targetUuid);
        if (snarlTarget) {
          // "Frightened of you for 1 turn" - a 1-round duration, not open-ended.
          await applyTimedCondition(snarlTarget, 'frightened', 1);
        }
      }
    }

    // Might Makes Right - see MIGHT_MAKES_RIGHT_ID's own comment above. Gated on an actual
    // Critical Success (result.multiplier >= 2), unlike Snarl/Predacon's own plain "on a success"
    // just above, and applied per-target since RAW allows "targets" plural. The "1 minute"
    // duration isn't separately tracked, same unenforced-timing simplification every other
    // duration-qualified Condition grant in this project already accepts.
    if (checkContext.isMightMakesRightAttempt) {
      for (const result of results) {
        if (!result.success || result.multiplier < 2 || !result.targetUuid) {
          continue;
        }

        const mightMakesRightTarget = await fromUuid(result.targetUuid);
        if (mightMakesRightTarget) {
          await mightMakesRightTarget.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Predacon - see PREDACON_ID's own comment above. Same unconditional single-target Frightened
    // shape as Snarl just above.
    if (checkContext.isPredaconAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const predaconTarget = await fromUuid(result.targetUuid);
        if (predaconTarget) {
          await predaconTarget.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Everything is Inspiration (Hobbyist Origin, p.32) - see EVERYTHING_IS_INSPIRATION_ID's own
    // comment above. Any failed result on ANY Skill Test counts, same shape as Stay Humble, plus
    // the once-per-scene mark (isEverythingIsInspirationAttempt already confirmed it hasn't been
    // used yet this scene, before the roll happened).
    if (checkContext.isEverythingIsInspirationAttempt && results.some(result => !result.success) && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
      await markUsedThisEncounter(actor, 'everythingIsInspirationUsedThisEncounter');
    }

    // Supportive Friend / Extra / Super (MLP CRB, Spirit of Kindness, 7th/13th/18th level,
    // p.85-86) - see SUPPORTIVE_FRIEND_ID's own comment above. On a successful Empathy(-chosen)
    // Skill Test, broadcasts the tier's own bonus to every nearby ally (60ft, same radius
    // Environmental Assist/Team Focus already use) - support Yourself (11th level) additionally
    // includes the granter themselves, the same includeSelf idiom team-buffs.mjs establishes.
    if (checkContext.supportiveFriendTier && results.some(result => result.success)) {
      const bonus = checkContext.supportiveFriendTier == 'super' ? { edge: true }
        : { shiftUp: checkContext.supportiveFriendTier == 'extra' ? 2 : 1 };
      const allies = getNearbyAllyTokens(actor, 60).map(token => token.actor);
      if (actorHasPerk(actor, SUPPORT_YOURSELF_ID)) {
        allies.push(actor);
      }

      for (const allyActor of allies) {
        await bankPendingBonus(allyActor, 'pendingSupportiveFriend', bonus, { granter: actor });
      }
    }

    // Shoots and Scores (MLP Sporty Influence, p.60) - see SHOOTS_AND_SCORES_ID's own comment
    // above. Any Critical Success (multiplier >= 2) on this Athletics roll counts.
    if (checkContext.isShootsAndScoresAttempt && results.some(result => result.multiplier >= 2)
      && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
    }

    // Percussive Maintenance - see PERCUSSIVE_MAINTENANCE_ID's own comment above. Banked here, on
    // a Critical Success on a Technology roll, consumed in rollSkill()'s own scoped-consumption
    // section (rolledSkill == 'technology').
    if (rollContext.skill == 'technology' && actorHasPerk(actor, PERCUSSIVE_MAINTENANCE_ID)
      && results.some(result => result.multiplier >= 2)) {
      await bankPendingBonus(actor, PENDING_PERCUSSIVE_MAINTENANCE_FLAG, { edge: true });
    }

    // Vibrating Palm - see VIBRATING_PALM_ID's own comment above. Any Critical Success on this
    // unarmed Attack counts, once per mission (approximated as once per encounter).
    if (checkContext.isVibratingPalmAttempt && results.some(result => result.multiplier >= 2)) {
      if (canWriteStoryPoints()) {
        requestStoryPointGrant(actor);
      }

      await markUsedThisEncounter(actor, VIBRATING_PALM_GRANT_ENCOUNTER_FLAG);
    }

    // You Can Do It, Too! - see YOU_CAN_DO_IT_TOO_ID's own comment above. Unscoped to any Skill
    // Test, unlike Shoots and Scores' own Athletics-only gate just above.
    if (actorHasPerk(actor, YOU_CAN_DO_IT_TOO_ID) && results.some(result => result.multiplier >= 2)) {
      for (const token of getNearbyAllyTokens(actor, Infinity)) {
        if (token.actor) {
          await bankPendingBonus(token.actor, 'pendingYouCanDoItToo', { shiftUp: 1, ...untilStartOfNextTurn(actor) });
        }
      }
    }

    // BRRRRRRRRRRRRRRT - see BRRRRRRRRRRRRRRT_ID's own comment above. Unlike You Can Do It, Too!
    // just above, this fires on making a qualifying attack at all, not on any particular outcome.
    if (checkContext.isMultipleTargetsWeapon && actorHasPerk(actor, BRRRRRRRRRRRRRRT_ID)
      && !hasUsedThisEncounter(actor, BRRRRRRRRRRRRRRT_ENCOUNTER_FLAG)) {
      for (const token of getNearbyAllyTokens(actor, Infinity)) {
        if (token.actor) {
          await bankPendingBonus(token.actor, 'pendingBrrrrrrrrrrrrrrt', { shiftUp: 1 });
        }
      }

      await markUsedThisEncounter(actor, BRRRRRRRRRRRRRRT_ENCOUNTER_FLAG);
    }

    // 'Til All Are One (Enigma of Combination, Origin Benefit, p.28) - see
    // isTilAllAreOneAttempt's own comment above. Same Critical-Success shape as Shoots and Scores
    // just above, plus the once-per-scene mark (checked before the roll happened).
    if (checkContext.isTilAllAreOneAttempt && results.some(result => result.multiplier >= 2)
      && canWriteStoryPoints()) {
      requestStoryPointGrant(actor);
      await markUsedThisEncounter(actor, 'tilAllAreOneUsedThisEncounter');
    }

    // But I Should Know That (Knights of Canterlot, Spell Scribe Hang-Up, p.34) - see
    // BUT_I_SHOULD_KNOW_THAT_ID's own comment above. Any failed result on this Spellcasting roll
    // counts, same shape as Stay Humble.
    if (checkContext.isButIShouldKnowThatAttempt && results.some(result => !result.success)) {
      await bankPendingBonus(actor, 'pendingButIShouldKnowThat', { snag: true });
    }

    // Instinctual Caster (Knights of Canterlot, Hedge Wizard Hang-Up, p.35) - see
    // INSTINCTUAL_CASTER_ID's own comment above.
    if (checkContext.isInstinctualCasterAttempt && results.some(result => !result.success)) {
      await bankPendingBonus(actor, 'pendingInstinctualCaster', { shiftDown: 1 });
    }

    // Outfoxed (MLP Tricky Hang-Up, p.63) - see OUTFOXED_ID's own comment above. Each failed
    // result's own target gets the Edge (a multi-target roll can fail against some and succeed
    // against others).
    if (checkContext.isOutfoxedAttempt) {
      for (const result of results) {
        if (!result.success && result.targetUuid) {
          const targetActor = await fromUuid(result.targetUuid);
          if (targetActor) {
            await bankPendingBonus(targetActor, OUTFOXED_EDGE_FLAG, { targetId: actor.id });
          }
        }
      }
    }

    // Debilitating Strike (16th level): "after hitting a target with your sneak attack, they
    // suffer a Snag on their first Skill Test or attack on their next turn" - flagged by
    // rollSkill() onto checkContext once it's confirmed this roll actually applied Sneak Attack
    // Damage; applied here per-target once it's known which of them actually got hit. Shock and
    // Awe (see rollSkill()) grants the identical effect from an unrelated trigger, so it shares
    // this same per-target application and the same underlying flag.
    if (checkContext.debilitatingStrike || checkContext.shockAndAwe) {
      for (const result of results) {
        if (result.success && result.targetUuid) {
          const targetActor = await fromUuid(result.targetUuid);
          if (targetActor) {
            // Shock and Awe's own mark carries its name, so the target's dialog labels it right.
            await markDebilitated(targetActor, checkContext.debilitatingStrike ? null
              : (findPerk(actor, SHOCK_AND_AWE_ID)?.name ?? 'Shock and Awe'));
          }
        }
      }
    }

    // Brute Force Works Best - see helpers/brute-force-works-best.mjs's own doc comment. Only
    // marks an actual vehicle target - "a piece of equipment" - same proxy as everywhere else in
    // this Focus tree.
    if (checkContext.isBruteForceWorksBestAttempt) {
      for (const result of results) {
        if (result.success && result.targetUuid) {
          const targetActor = await fromUuid(result.targetUuid);
          if (targetActor?.type == 'vehicle') {
            await markBruteForceWorksBest(targetActor);
          }
        }
      }
    }

    // Explosive Aftershock - see isExplosiveAftershockAttack's own comment in rollSkill() above,
    // and helpers/explosive-aftershock.mjs's own doc comment. The "choose two" picker fires once
    // per roll (not once per target - RAW's single choice applies to every target that failed
    // their own Toughness compare), then the same two effects are applied to each of them.
    if (results.some(result => result.explosiveAftershock)) {
      const effects = await pickExplosiveAftershockEffects();
      if (effects) {
        for (const result of results) {
          if (result.explosiveAftershock && result.targetUuid) {
            const targetActor = await fromUuid(result.targetUuid);
            if (targetActor) {
              await applyExplosiveAftershockEffects(targetActor, effects, actor);
            }
          }
        }
      }
    }

    // Splinter Defense (Across the Stars, Gold Ranger, 18th level, p.53) - see
    // helpers/splinter-defense.mjs's own doc comment. Reciprocal: docks the ATTACKER's own
    // Initiative when THEY land a melee hit against the holder, not the other way around.
    if (checkContext.isMelee) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor || !actorHasPerk(targetActor, SPLINTER_DEFENSE_ID) || !game.combat) {
          continue;
        }

        const bonus = getHardenedArmorBonus(targetActor);
        if (!bonus || !(await checkAndMarkSplinterDefense(targetActor, actor.id))) {
          continue;
        }

        const attackerCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
        if (attackerCombatant) {
          await attackerCombatant.update({ initiative: attackerCombatant.initiative - bonus });
        }
      }
    }

    // The Tough Get Going (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
    // helpers/the-tough-get-going.mjs's own doc comment. Reciprocal: reacts on the TARGET when an
    // Attack against their own Toughness misses, once per round.
    if (checkContext.defenseType == 'toughness') {
      for (const result of results) {
        if (result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor || !actorHasPerk(targetActor, THE_TOUGH_GET_GOING_ID)
          || hasUsedThisRound(targetActor, THE_TOUGH_GET_GOING_ROUND_FLAG)) {
          continue;
        }

        await activateTheToughGetGoing(targetActor);
        await markUsedThisRound(targetActor, THE_TOUGH_GET_GOING_ROUND_FLAG);
      }
    }

    // Power Filter - see POWER_FILTER_ID's own comment above.
    if (checkContext.defenseType == 'toughness' && checkContext.damageType == 'energy') {
      for (const result of results) {
        if (!result.targetUuid) {
          continue;
        }

        const zordActor = await fromUuid(result.targetUuid);
        if (!zordActor || !actorHasZordFeature(zordActor, POWER_FILTER_ID)) {
          continue;
        }

        const pilot = getVehicleDriver(zordActor);
        if (pilot?.system.powers?.personal) {
          await pilot.update({
            'system.powers.personal.value': Math.min(
              pilot.system.powers.personal.max, pilot.system.powers.personal.value + 1,
            ),
          });
        }
      }
    }

    // Revengeful (Decepticon Directive, General Perk, p.68): "Whenever you suffer damage from an
    // attack, any attacks you make until the end of your next turn that target the source of
    // that damage gain an upshift 1." Banked as a target-scoped shiftUp on the actor who took
    // damage, keyed by the ATTACKER's own uuid - the same "self-bonus scoped to one specific
    // other actor" shape Menacing Glare/Spite's own Edge effects already establish, but a live,
    // non-consumed flag (RAW's own "any attackS" is plural, lasting across multiple attacks until
    // the end of your next turn, not a one-shot use) rather than cleared on first read - the same
    // persistent-window shape Shining Leader's own 2-round Edge flag already uses. "If one of
    // these attacks Defeats that target, your team gains a Story Point" isn't built - Defeat is
    // only detected in the separate Apply Damage flow (helpers/combat.mjs#applyDamage), decoupled
    // from this roll entirely, and cross-referencing the two reliably would need its own design
    // pass.
    for (const result of results) {
      if (!result.success || !result.damageValue || !result.targetUuid) {
        continue;
      }

      const revengefulTarget = await fromUuid(result.targetUuid);
      if (revengefulTarget && actorHasPerk(revengefulTarget, REVENGEFUL_ID)) {
        await revengefulTarget.setFlag('essence20', 'pendingRevengeful', { attackerUuid: actor.uuid });
      }

      // Now I'm Angry - see NOW_IM_ANGRY_ID's own comment above. Scoped to isCrit specifically,
      // unlike Revengeful's own any-damage trigger just above.
      if (isCrit && revengefulTarget && actorHasPerk(revengefulTarget, NOW_IM_ANGRY_ID)) {
        await bankPendingBonus(revengefulTarget, PENDING_NOW_IM_ANGRY_FLAG, { amount: 1 });
      }
    }

    // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
    // helpers/phantom-suite.mjs's own doc comment. "You remain semi-invisible until you take
    // damage from an Attack against your Evasion Defense" - switches itself back off (no Power
    // refund) the first time such a hit actually lands, rather than leaving it to the player to
    // notice and toggle off themselves like every other Power Adaptation/Power Boost toggle.
    if (checkContext.defenseType == 'evasion') {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && isPhantomSuiteActive(targetActor)) {
          await deactivatePhantomSuite(targetActor);
        }
      }
    }

    // Terror (Beneath the Helmet, Dark Ranger, 1st level, p.39) - see helpers/terror.mjs's own
    // doc comment. The "deal damage" half of its accrual trigger - any successful attack that
    // actually deals real damage, rolled with Edge. The "inflict a Condition" half is checked
    // independently at whichever Perk actually applies that Condition (e.g. Menacing Glare).
    if (checkContext.damageValue > 0) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        await grantTerrorIfEligible(actor, targetActor, checkContext.wasEdge);
      }
    }

    // Power Bleed - see helpers/power-bleed.mjs's own doc comment. Passive, no checkContext flag
    // needed (checked directly against the actor's own turn-scoped bank) - applies to any
    // successful Attack made this turn, not just the one that activated it.
    if (checkContext.effectName && isPowerBleedActive(actor)) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await drainPowerBleedTarget(targetActor);
        }
      }
    }

    // Toxic Terror - see helpers/toxic-terror.mjs's own doc comment. Passive, no checkContext flag
    // needed - stacks a further downshift point onto every successfully-hit target of an unarmed
    // attack while active.
    if (checkContext.isUnarmedAttack && isToxicTerrorActive(actor)) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await addToxicTerrorStack(targetActor);
        }
      }
    }

    // Thorn Warlord (Finster's Monster-Matic Cookbook, 20th level, p.297): "When you successfully
    // attack a target suffering from the Frightened or Impaired condition, you regain 2 Personal
    // Power." Passive, no checkContext flag needed - checked directly per successfully-hit target.
    if (actorHasPerk(actor, THORN_WARLORD_ID)) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if ((targetActor?.statuses?.has('frightened') || targetActor?.statuses?.has('impaired'))
          && actor.system.powers?.personal) {
          await actor.update({
            'system.powers.personal.value': Math.min(actor.system.powers.personal.max, actor.system.powers.personal.value + 2),
          });
        }
      }
    }

    // Ice Machine - see ICE_MACHINE_ID's own comment above. Passive, no checkbox - any successful
    // Cold-damage Attack against an already-Stunned target.
    if (checkContext.damageType == 'cold' && actorHasPerk(actor, ICE_MACHINE_ID)) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor?.statuses?.has('stunned')) {
          await targetActor.toggleStatusEffect('immobilized', { active: true });
        }
      }
    }

    // Brazen Strike (A Jump Through Time, Grid Power, p.57) - see helpers/brazen-strike.mjs's own
    // doc comment. Passive - no click, checked on any successful, damage-dealing unarmed Attack.
    if (checkContext.damageValue > 0 && checkContext.isUnarmedAttack && actorHasPower(actor, BRAZEN_STRIKE_ID)) {
      const anyHit = results.some(result => result.success);
      if (anyHit) {
        await applyBrazenStrike(actor);
      }
    }

    // Stylish Strike (A Jump Through Time, Grid Power, p.58) - see helpers/stylish-strike.mjs's
    // own doc comment. Passive - no click, checked on a Critical Success (multiplier >= 2, same
    // reading Shoots and Scores already established) with any melee Attack.
    if (checkContext.isMelee && actorHasPower(actor, STYLISH_STRIKE_ID)) {
      const anyCrit = results.some(result => result.multiplier >= 2);
      if (anyCrit) {
        await applyStylishStrike(actor);
      }
    }

    // Invisibility (Technorganic Secrets, Mutant Beast Influence Perk, p.47) - see
    // helpers/invisibility.mjs's own doc comment. "Until you take the Attack... action" - cleared
    // on the attempt itself (any Attack roll, unconditional on hit/miss), not gated on
    // actorHasPerk since deactivateInvisibilityOnAttack already checks whether it's even active
    // before doing anything.
    if (checkContext.isAttack) {
      await deactivateInvisibilityOnAttack(actor);

      // Phantom (GI Joe CRB, Infiltrator Focus, 17th level, p.74) - see helpers/phantom.mjs's own
      // doc comment. "A non-Takedown attack" - gated on checkContext.isTakedownAttempt, this
      // codebase's own existing Takedown-attempt flag, so an actual Takedown attempt leaves it up.
      if (!checkContext.isTakedownAttempt) {
        await deactivatePhantomOnAttack(actor);
      }

      // Emotional Mastery: Shyness - "...until you make an Attack..." Same unconditional-on-the-
      // attempt shape as Invisibility just above.
      await deactivateShynessOnAttack(actor);
    }

    // Unlucky (For You) (Beneath the Helmet, Dark Ranger, 13th level, p.40) - see
    // helpers/unlucky-for-you.mjs's own doc comment. Any successful attack (not gated on Edge,
    // unlike Terror above), once per target per combat.
    if (checkContext.isAttack) {
      for (const result of results) {
        if (!result.success || !result.targetUuid || !actorHasPerk(actor, UNLUCKY_FOR_YOU_ID)) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor || !(await checkAndMarkUnluckyForYou(actor, targetActor.id))) {
          continue;
        }

        await bankPendingBonus(targetActor, UNLUCKY_FOR_YOU_SNAG_FLAG, { snag: true });
      }
    }

    // Emotional Mastery: Shame (A Jump Through Time, Purple Ranger, p.37) - "You gain ↑1 on your
    // next Skill Test after being targeted by an enemy's Success. This is doubled to ↑2 for a
    // Critical Success!" Same "bank on the target after being successfully targeted" shape as
    // Unlucky (For You) just above, but unscoped to Attacks (any Skill Test can target someone,
    // per the file's own non-combat-targeting restructure) and checked against the TARGET's own
    // active option rather than the roller's Perk.
    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const shameTargetActor = await fromUuid(result.targetUuid);
      if (!shameTargetActor || !isEmotionalMasteryOptionActive(shameTargetActor, 'shame')) {
        continue;
      }

      const shiftUp = result.multiplier >= 2 ? 2 : 1;
      await bankPendingBonus(shameTargetActor, EMOTIONAL_MASTERY_SHAME_FLAG, { shiftUp });
    }

    // Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68): a miss marks the target until
    // the end of its next turn - helpers/extensions/fix3-tf/tf-fixes.mjs.

    // Try, Try Again - see TRY_TRY_AGAIN_ID's own comment above. Banks itself on ANY failed Skill
    // Test of a given skill (the same "none of the compared entries succeeded" whole-roll failure
    // reading Cheer/Stay Humble's own rollFailed checks already use), scoped to that same skill.
    if (rollContext.skill && results.every(entry => !entry.success) && actorHasPerk(actor, TRY_TRY_AGAIN_ID)) {
      await bankPendingBonus(actor, TRY_TRY_AGAIN_FLAG, { skill: rollContext.skill });
    }

    // Mistrustful - see MISTRUSTFUL_HANGUP_ID's own comment above / helpers/mistrustful.mjs.
    // Same "none of the compared entries succeeded" whole-roll failure reading as Try, Try Again
    // just above, scoped to a failed Alertness Test specifically.
    if (rollContext.skill == 'alertness' && results.every(entry => !entry.success) && actorHasHangUp(actor, MISTRUSTFUL_HANGUP_ID)) {
      await markMistrustfulSnag(actor);
    }

    // Smashmouth Offense (Cobra Codex, Vanguard Be Ruthless replacement Perk, p.68) - see
    // banked-buffs.mjs's own SMASHMOUTH_OFFENSE_ID comment. Applies +1 damage to the first
    // successfully-hit, damage-dealing result (a plain attack normally has exactly one target
    // entry) and clears the bank - the "didn't Defeat" precondition is checked at Use-time by the
    // player themselves (self-policed, same as the bank itself), not re-verified here.
    const pendingSmashmouthOffense = checkContext.effectName && getPendingBonus(actor, SMASHMOUTH_OFFENSE_FLAG);
    if (pendingSmashmouthOffense) {
      const hitResult = results.find(entry => entry.success && entry.damageValue > 0);
      if (hitResult) {
        hitResult.damageValue += 1;
        await clearPendingBonus(actor, SMASHMOUTH_OFFENSE_FLAG);
      }
    }

    // Arashikage Graduate - see ARASHIKAGE_GRADUATE_HANGUP_ID's own comment above. Same "any
    // failed Skill Test" reading as Try, Try Again just above, but once per scene only.
    if (rollContext.skill && results.every(entry => !entry.success)
      && actorHasHangUp(actor, ARASHIKAGE_GRADUATE_HANGUP_ID)
      && getUsesThisScene(actor, ARASHIKAGE_GRADUATE_SCENE_FLAG) < 1) {
      await bankPendingBonus(actor, ARASHIKAGE_GRADUATE_FLAG);
      await markUsedThisScene(actor, ARASHIKAGE_GRADUATE_SCENE_FLAG);
    }

    // Trigger Happy - result.frightened is its own independent compare (see the results map
    // above), not gated on result.success, so this loop checks it separately.
    if (checkContext.triggerHappy) {
      for (const result of results) {
        if (result.frightened && result.targetUuid) {
          const targetActor = await fromUuid(result.targetUuid);
          if (targetActor) {
            await targetActor.toggleStatusEffect('frightened', { active: true });
          }
        }
      }
    }

    if (bankedReroll && results.some(entry => entry.success)) {
      await actor.unsetFlag('essence20', 'bankedReroll');
    }

    // MLP CRB "Cheer": "...reroll a FAILED Performance Skill Test." Only meaningful once there's
    // an actual Difficulty to have failed against (checkContext always has at least one entry
    // here) - "failed" means none of the compared entries succeeded, matching how a multi-target
    // attack's own Critical Success handling already treats "success" per-entry rather than as
    // one single true/false for the whole roll.
    // Suffer! (Finster's Monster-Matic Cookbook, Path of Thorns, 15th level) - see
    // helpers/suffer.mjs's own doc comment and chat.mjs#addSufferButton. Reactive, so this has to
    // be recognized from the posted message itself, same as rollFailed/Spite above - "successfully
    // inflicting damage" means at least one hit entry actually carries a nonzero damageValue, not
    // just a bare success (a pure-status Alternate Effect with damageValue 0 shouldn't qualify).
    // Per-target riders, spells, saves and Use-button rolls - helpers/target-riders.mjs.
    await applyRollRiders(actor, results, checkContext, { isCrit, isFumble });

    const dealtDamage = results.some(entry => entry.success && entry.damageValue > 0);

    // Xenotech Components (Across the Stars, Tools of the Trade, p.79): "Each Xenotech Component
    // is tied to a specific Skill, imposing ↓1 on Skill Tests using it. This penalty lasts until
    // the character succeeds in its use, after which the Xenotech Component conveys ↑1 instead."
    // "Succeeds" is a plain success (any hit), not a Critical Success like the separate Xenotech
    // WEAPON trait above - same per-item flag idiom, but graduating from a penalty to a bonus
    // rather than just clearing, so componentsSucceeded is read on both sides of the shift in
    // _getAutomaticCombatModifiers's own check.
    if (checkContext.componentsWeaponToMark && results.length && results.some(entry => entry.success)
      && !checkContext.componentsWeaponToMark.getFlag?.('essence20', 'componentsSucceeded')) {
      await checkContext.componentsWeaponToMark.setFlag('essence20', 'componentsSucceeded', true);
    }

    // Clip Check (Quartermaster's Guide to Gear, General Perk, p.28): "You can reroll a Fumble on
    // an Attack Skill Test." - reads the real natural-min-die Fumble (_isCritIsFumble, computed
    // above) rather than the unrelated shift-based "fumble" auto-fail tier - stashed the same way
    // rollFailed/dealtDamage are, for the new REROLL_CONDITIONS.fumble check to read.
    const fullRollContext = {
      ...rollContext,
      rollFailed: results.every(entry => !entry.success),
      dealtDamage,
      isFumble,
      // What each target was compared against, for chat.mjs#addDefenseBoostButton - "+1 to a
      // Defense after dice are rolled" only ever matters on a hit by exactly nothing, and that
      // is a fact about each target's own difficulty, which the card otherwise only prints.
      // What kind of attack this was, for chat.mjs#onApplyDamage - the vehicle damage cuts that only
      // count against Explosive or non-Element weapons (helpers/vehicle-upgrades.mjs).
      attackStyle: checkContext.attackStyle ?? null,
      attackTraits: checkContext.weaponTraits ?? [],
      checkResults: results.map(entry => ({
        targetUuid: entry.targetUuid, difficulty: entry.difficulty, success: entry.success,
        // Read by chat.mjs#onApplyDamage - check-card.hbs has no slot for a second damage type, so
        // the base Apply Damage button finds its own target's rider here instead.
        secondaryDamage: entry.secondaryDamage ?? null,
      })),
    };

    const chatData = await buildCheckChatData(roll, { flavor, results, speaker, canCritD2, rollContext: fullRollContext });
    this._chatMessage.create(chatData);

    // "Fumble - If the result of the d20 part of the roll is a natural '1' AND the Skill Test
    // fails... the team should learn from these mistakes and also gain a Story Point" (GI Joe
    // CRB p.126; PR p.91, TF p.104, MLP p.118 agree). The gain side of the rule the spends above
    // all draw on. The TEAM gains: a player-side actor's fumble feeds the shared pool, and an
    // NPC's feeds nothing. Only a roll that was actually compared against something can have
    // failed - a bare roll with no Difficulty is not a Fumble, whatever the d20 shows.
    // Gated on canWriteStoryPoints(): with nobody able to write the pool - no owner here, no GM
    // connected - a relayed grant would go nowhere, and a point that was never recorded is
    // worse than one the GM adds by hand later.
    if (isFumble && results.length && fullRollContext.rollFailed && poolFor(actor) === 'story' && canWriteStoryPoints()
      && !FUMBLE_STORY_POINT_SUPPRESSORS.some(fn => {
        try {
          return !!fn(actor, rollContext.skill);
        } catch (error) {
          return false;
        }
      })) {
      // It's Right There (WTNV Citizens' Guide, Outsider Origin Perk, p.30/32): "When you Fumble
      // during a Skill Test, you add 2 Story Points to the player pool instead of 1." A holder's
      // own bump to the base grant just above, rather than a second grant call.
      // Academic Studies (WTNV, Student Origin, p.30): "When you Fumble with that Skill, you add 2 Story
      // Points to the player pool instead of 1."
      const academic = findPerk(actor, ACADEMIC_STUDIES_ID)?.system?.choice;
      const doubled = actorHasPerk(actor, ITS_RIGHT_THERE_ID) || (!!academic && academic == checkContext?.riderContext?.skill);
      await requestStoryPointGrant(actor, doubled ? 2 : 1);
    }

    // The GM-side twin: "The GM's Story Point pool grows... If an NPC Critically Succeeds on a
    // Skill Test" (GI Joe CRB p.128; PR p.92, TF p.107 agree; MLP has no GM pool at all, which
    // requestStoryPointGrant's own hasGmPool check covers). A Critical Success is the skill die
    // showing its max (isCrit, combat.mjs#_isCritIsFumble) on a Test that actually succeeded
    // against something - a max die on a miss is not a Critical Success, and a bare roll with
    // no Difficulty succeeded at nothing. Only the actors whose pool is the GM's feed it.
    if (isCrit && results.some(entry => entry.success) && poolFor(actor) === 'gm' && canWriteStoryPoints()) {
      await requestStoryPointGrant(actor, 1, { pool: 'gm' });
    }

    // What the card just said, handed back so a caller can act on it. Same values the card is
    // built from rather than a second computation, so the two can never disagree.
    return {
      results,
      rollFailed: fullRollContext.rollFailed,
      dealtDamage,
      isFumble,
      roll,
    };
  }

  /**
   * Create skill roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getSkillRollLabel(dataset, skillRollOptions) {
    // A Requisition Test (helpers/requisition.mjs) is a plain Skill Test vs a flat DIF, but
    // gets its own flavor so the chat card reads as "requisitioning X" rather than a bare
    // "Rolling for Targeting".
    if (dataset.requisitionItemName) {
      return `<b>${this._localize('E20.RequisitionRollFlavor')}</b> - ${dataset.requisitionItemName}`
        + this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag);
    }

    let rolledSkillStr;
    if (dataset.skill == 'roleSkillDie') {
      rolledSkillStr = dataset.roleSkillName;
    } else if (dataset.skill == 'wealth') {
      rolledSkillStr = this._localize('E20.Wealth');
    } else if (dataset.isSpecialized) {
      rolledSkillStr = dataset.specializationName || E20.skills[dataset.skill];
    } else {
      rolledSkillStr = E20.skills[dataset.skill];
    }

    const rollingForStr = this._localize('E20.RollRollingFor');
    return `${rollingForStr} ${rolledSkillStr}` + this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag);
  }

  /**
   * Handles rolling items that require skill rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Item} item   The weapon being used.
   * @param {Actor} actor   The actor performing the roll.
   */
  async handleSkillItemRoll(dataset, actor, item) {
    // Awaited and returned, rather than fired and forgotten, so documents/item.mjs#roll can see a
    // cancelled roll dialog and hand back the action it spent up front - see its own
    // _rollWithRefund.
    return this.rollSkill(dataset, actor, item);
  }

  /**
   * Create weapon roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Item} weaponEffect   The weapon effect being used.
   * @param {String} roleSkillDieName The name of the Role skill die
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getWeaponRollLabel(dataset, skillRollOptions, weaponEffect, roleSkillDieName=null) {
    const rolledSkill = dataset.skill;
    const rolledSkillStr = this._localize(E20.skills[rolledSkill]) || roleSkillDieName;
    const attackRollStr = this._localize('E20.RollTypeAttack');
    const effectStr = this._localize('E20.WeaponEffect');
    const damageType = this._localize(E20.damageTypes[weaponEffect.system.damageType]);
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = "";

    let label = `<b>${attackRollStr}</b> - ${weaponEffect.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    // A weaponEffect's second damage (weapon-effect.mjs secondaryDamage), e.g. "1 Blunt + 1 Acid".
    const secondary = weaponEffect.system.secondaryDamage;
    const secondaryStr = secondary?.value > 0
      ? ` + ${secondary.value} ${this._localize(E20.damageTypes[secondary.type] ?? '')}`
      : '';
    label += `<b>${effectStr}</b> - ${weaponEffect.system.damageValue || noneStr} ${damageType}${secondaryStr}<br>`;
    label += `<b>${descStr}</b>:${weaponEffect.system.description || noneStr}<br>`;

    return label;
  }

  /**
   * Create spell roll label.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Item} spell   The spell being used.
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getSpellRollLabel(skillRollOptions, spell) {
    const rolledSkillStr = this._localize('E20.SkillSpellcasting');
    const spellRollStr = this._localize('E20.RollTypeSpell');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${spellRollStr}</b> - ${spell.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${descStr}</b> - ${spell.system.description || noneStr}<br>`;

    return label;
  }

  _getMagicBaubleRollLabel(skillRollOptions, magicBauble) {
    const rolledSkillStr = this._localize('E20.SkillSpellcasting');
    const magicBaubleRollStr = this._localize('E20.RollTypeMagicBauble');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${magicBaubleRollStr}</b> - ${magicBauble.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${descStr}</b> - ${magicBauble.system.description || noneStr}<br>`;

    return label;
  }

  /**
   * Create final shift from actor skill shift + skill roll options.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {String} initialShift   The initial shift of the skill being rolled.
   * @param {Object} shiftList   The list of available shifts to use for this roll.
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFinalShift(skillRollOptions, initialShift, shiftList=E20.skillShiftList, rolePoints=null) {
    // Apply the skill roll options dialog shifts to the roller's normal shift
    let optionsShiftTotal = skillRollOptions.shiftUp - skillRollOptions.shiftDown;
    optionsShiftTotal += rolePoints && skillRollOptions.applyRolePointsUpshift ? rolePoints.system.bonus.value : 0;

    const initialShiftIndex = shiftList.findIndex(s => s == initialShift);
    const finalShiftIndex = Math.max(
      0,
      Math.min(shiftList.length - 1, initialShiftIndex - optionsShiftTotal),
    );

    return shiftList[finalShiftIndex];
  }

  /**
   * Handle rolls that automatically fail.
   * @param {String} skillShift   The shift of the skill being rolled.
   * @param {String} label   The label generated so far for the roll, which will be appended to.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Boolean}   True if autofail occurs and false otherwise.
   * @private
   */
  _handleAutoFail(skillShift, label, actor) {
    let autoFailed = false;

    if (E20.autoFailShifts.includes(skillShift)) {
      const chatData = {
        speaker: this._chatMessage.getSpeaker({ actor }),
      };

      switch (skillShift) {
      case 'autoFail':
        label += ` ${this._localize('E20.RollAutoFail')}`;
        break;
      case 'fumble':
        label += ` ${this._localize('E20.RollAutoFailFumble')}`;
        break;
      }

      chatData.content = label;
      this._chatMessage.create(chatData);
      autoFailed = true;
    }

    return autoFailed;
  }

  /**
   * Returns the d20 portion of skill roll formula.
   * @param {Boolean} edge   If the roll is using an Edge.
   * @param {Boolean} snag   If the roll is using a Snag.
   * @param {Boolean} floorAt10   Silver Tongue (Spy Focus, 6th level) - "treat a d20 roll of 9 or
   *   less as a 10." Applies Foundry's own `min` dice modifier to each d20 die before Edge/Snag's
   *   keep-highest/keep-lowest selection runs, so that selection sees the already-floored values.
   * @param {Boolean} rollsThreeD20   Kill Shot (Sniper Focus, 20th level, p.75): "when making a
   *   ranged attack with a sniper weapon when you have an Edge, you may roll a third d20 and
   *   choose the highest among them." Only meaningful together with edge=true - a plain Snag or a
   *   cancelled Edge/Snag pair isn't "having an Edge" and stays the ordinary 2d20/d20 term.
   * @param {Number} flatD20Value   General Hawk's Personnel Files "Dependable"/"Old Reliable"/
   *   "Legendary Dependability": "...treat a d20 result as a 10 [or 15]... without rolling." A
   *   genuine flat SUBSTITUTION rather than a floor (unlike floorAt10 above, which still lets a
   *   naturally-higher roll count) - 0 (the default) means no substitution, matching every other
   *   grant. With an active Edge/Snag, only ONE of the pair becomes flat by default (a real rolled
   *   d20 stays live for the other side, so a genuinely better roll can still win the kh/kl
   *   comparison) - see flatBothD20s below for the "set BOTH d20s" escalation.
   * @param {Boolean} flatBothD20s   Old Reliable's own "...you may spend an additional Moxie to
   *   treat both d20 results as a 10" - replaces the whole Edge/Snag pair with the flat value
   *   outright (no dice rolled at all), rather than leaving one side live. Meaningless without
   *   flatD20Value also set, and meaningless without an active Edge/Snag (there's only one d20
   *   term either way, already covered by the `edge == snag` branch below).
   * @returns {String}   The d20 portion of skill roll formula.
   * @private
   */
  _getd20Operand(edge, snag, floorAt10=false, rollsThreeD20=false, flatD20Value=0, flatBothD20s=false) {
    const minModifier = floorAt10 ? 'min10' : '';

    if (flatD20Value > 0) {
      // Edge and Snag cancel eachother out - only one (flat) d20 term either way.
      if (edge == snag || flatBothD20s) {
        return `${flatD20Value}`;
      }

      return edge ? `{${flatD20Value},d20${minModifier}}kh` : `{${flatD20Value},d20${minModifier}}kl`;
    }

    // Edge and Snag cancel eachother out
    if (edge == snag) {
      return `d20${minModifier}`;
    } else if (edge && rollsThreeD20) {
      return `3d20${minModifier}kh`;
    } else {
      return edge ? `2d20${minModifier}kh` : `2d20${minModifier}kl`;
    }
  }

  /**
   * Creates the Edge/Snag text of the skill roll label.
   * @param {Boolean} edge   If the roll is using an Edge.
   * @param {Boolean} snag   If the roll is using a Snag.
   * @returns {String}   The ' with an Edge/Snag' text of the roll label.
   * @private
   */
  _getEdgeSnagText(edge, snag) {
    let result = '';

    // Edge and Snag cancel eachother out
    if (edge != snag) {
      const withAnEdge = this._localize('E20.RollWithAnEdge');
      const withASnag = this._localize('E20.RollWithASnag');
      result = edge ? ` ${withAnEdge}` : ` ${withASnag}`;
    }

    return result;
  }

  /**
   * Converts given operands into a formula.
   * @param {Array<String>} edge   The operands to be used in the formula.
   * @returns {String}   The resultant formula.
   * @private
   */
  _arrayToFormula(operands) {
    let result = '';
    const len = operands.length;

    for (let i = 0; i < len; i += 1) {
      const operand = operands[i];
      result += i == len - 1 ? operand : `${operand},`;
    }

    return result;
  }

  /**
   * Create formula for skill roll.
   * @param {Boolean} dataset   Whether the roll is specialized.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {String} finalShift   The shift to be used for the skill roll.
   * @param {Number} modifier   The modifier to be used for the skill roll.
   * @param {Boolean} floorD20At10   See _getd20Operand() - Silver Tongue.
   * @param {Boolean} rollsThreeD20   See _getd20Operand() - Kill Shot.
   * @param {Number} flatD20Value   See _getd20Operand() - Dependable/Old Reliable/Legendary Dependability.
   * @param {Boolean} flatBothD20s   See _getd20Operand() - Old Reliable.
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFormula(isSpecialized, skillRollOptions, finalShift, modifier, floorD20At10=false, rollsThreeD20=false, flatD20Value=0, flatBothD20s=false, bonusPoolDie=null) {
    const edge = skillRollOptions.edge;
    const snag = skillRollOptions.snag;
    const shiftOperands = [];
    let formula = this._getd20Operand(edge, snag, floorD20At10, rollsThreeD20, flatD20Value, flatBothD20s);

    // We already have the d20 operand, now apply bonus dice if needed
    if (finalShift != 'd20') {
      if (isSpecialized) {
        // For specializations, keep adding dice until you reach your shift level
        for (const shift of E20.skillRollableShifts) {
          shiftOperands.push(shift);
          if (shift == finalShift) {
            break;
          }
        }

        // Rumble in the Jungle - see RUMBLE_IN_THE_JUNGLE_ID's own comment above. RAW: "you gain
        // this bonus Skill Die in addition to your Specialization Dice", so it joins the
        // staircase rather than replacing it.
        if (bonusPoolDie) {
          shiftOperands.push(bonusPoolDie);
        }

        formula += ` + {${this._arrayToFormula(shiftOperands)}}kh`;
      } else if (bonusPoolDie) {
        // Rumble in the Jungle on an unspecialized attack - RAW's "this bonus Skill Die works like
        // when you roll a Skill Test with Specialization" makes an ordinary single-die roll into a
        // two-die kept-highest pool.
        formula += ` + {${this._arrayToFormula([finalShift, bonusPoolDie])}}kh`;
      } else {
        // For non-specialized, just add the single bonus die
        formula += ` + ${finalShift}`;
      }
    } else if (bonusPoolDie) {
      // An untrained attack skill contributes no die of its own, so the bonus die stands alone.
      formula += ` + ${bonusPoolDie}`;
    }

    return `${formula} + ${modifier}`;
  }
}
