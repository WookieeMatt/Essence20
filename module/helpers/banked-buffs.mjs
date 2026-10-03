import { pickAllyTargets } from "./allies.mjs";
import { canUseActionPerk, isActionPerkUse, useActionPerk } from "./action-perks.mjs";
import { spend } from "./action-economy.mjs";
import {
  actorHasPerk, bankPendingBonus, clearPendingBonus, getPendingBonus, getUsesThisEncounter, getUsesThisScene,
  hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn, markUsedThisEncounter, markUsedThisEncounterCount,
  markUsedThisRound, markUsedThisScene, markUsedThisTurn, postPerkUseChatCard,
} from "./perks.mjs";
import { getUses, markUsed } from "./scene-clock.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { getNearbyEnemyTokens } from "./enemies.mjs";
import { findRolePointsItem } from "./reroll.mjs";
import { E20 } from "./config.mjs";
import { canUseTeamBuffPerk, isTeamBuffPerk, onTeamBuffPerkUse } from "./team-buffs.mjs";
import { activateMarkEverybot, canUseMarkEverybot, markTarget } from "./mark-target.mjs";
import { designatePrimaryQuarry } from "./primary-quarry.mjs";
import { designateKnownAccomplice } from "./known-accomplices.mjs";
import {
  activateLendAssistance, I_GOT_YOU_ID as I_GOT_YOU_ASSIST_ID, LEND_ASSISTANCE_PERK_IDS, lendAssistanceSkill,
  pickIGotYouAction,
} from "./lend-assistance.mjs";
import {
  HELP_YOURSELF_ID, HELP_YOURSELF_RADIUS_FEET, HELP_YOURSELF_ROUND_FLAG, isHelpYourselfCloneActive,
} from "./help-yourself.mjs";
import {
  activateQuickAndQuiet, activateVoiceOfNightVale, isSurpriseRound, QUICK_AND_QUIET_ID,
  VOICE_OF_NIGHT_VALE_ID,
} from "./surprise.mjs";
import { declareNemesis, NEMESIS_ID } from "./nemesis.mjs";
import { declareDecepticonNemesis, NEMESIS_DD_PERK_ID } from "./nemesis-decepticon.mjs";
import { activateExtraRoughTraining } from "./extra-rough-training.mjs";
import { activateHupHupHupHupHup } from "./hup-hup-hup-hup-hup.mjs";
import { activateTimelyTeammate, canUseTimelyTeammate } from "./timely-teammate.mjs";
import { activateRoar, canUseRoar } from "./roar.mjs";
import { canDesignateProtectedTarget, designateProtectedTarget } from "./protected-target.mjs";
import { hasStoryPointsAvailable, canWriteStoryPoints, requestStoryPointGrant, requestStoryPointSpend } from "./story-points.mjs";
import { toggleDigIn } from "./dig-in.mjs";
import { toggleUnmovable, isUnmovableActive } from "./unmovable.mjs";
import { FLY_IN_THE_FUTURE_ID, getPilotedAerialVehicle, toggleEvasiveManeuvers } from "./evasive-maneuvers.mjs";
import { SCRAMBLE_ID, toggleScramble } from "./scramble.mjs";
import { EXTENDED_ATTACK_ID, toggleExtendedAttack } from "./extended-attack.mjs";
import { MODE_ATTACHMENT_ID, pickModeAttachmentChoice } from "./mode-attachment.mjs";
import { FAVORITE_WEAPON_ID, pickFavoriteWeapon } from "./favorite-weapon.mjs";
import { activateMassShift, canUseMassShift, MASS_SHIFT_ID } from "./mass-shift.mjs";
import { activateRiseAgainDefense, canUseRiseAgainDefense, RISE_AGAIN_ID } from "./rise-again.mjs";
import { isMeatShieldActive, toggleMeatShield } from "./meat-shield.mjs";
import { canUseBoxShot, toggleBoxShot } from "./box-shot.mjs";
import { toggleCannoneerDigIn } from "./cannoneer-dig-in.mjs";
import { toggleSkiing } from "./skier.mjs";
import { toggleItsTime } from "./its-time.mjs";
import { toggleBulwark } from "./bulwark.mjs";
import { toggleHonestAssessment } from "./honest-assessment.mjs";
import { togglePointy } from "./pointy.mjs";
import { isPowerBoostActive, togglePowerBoost } from "./power-boost.mjs";
import { activateWhirlwindStrike } from "./whirlwind-strike.mjs";
import { markWhateverWeNeed } from "./whatever-we-need.mjs";
import { isVolleyActive, toggleVolley } from "./volley.mjs";
import {
  activateEmotionalMastery, activateTeamSpirit, EMOTIONAL_MASTERY_ID, TEAM_SPIRIT_ID,
} from "./emotional-mastery.mjs";
import { activateGroupStrike } from "./group-strike.mjs";
import { isNinjaPowerActive, toggleNinjaPower } from "./ninja-power.mjs";
import { applyGridSurgeOption, pickGridSurgeOption } from "./grid-surge.mjs";
import { isPowerAdaptationActive, POWER_ADAPTATION_OPTIONS, togglePowerAdaptation } from "./power-adaptation.mjs";
import { isPhantomSuiteActive, togglePhantomSuite } from "./phantom-suite.mjs";
import { AGELESS_KNOWLEDGE_FLAG, pickAgelessKnowledgeSkill } from "./ageless-knowledge.mjs";
import { PARADOX_FLAG, pickParadoxSkill } from "./paradox.mjs";
import { applyThroughTheArchesSnag } from "./through-the-arches.mjs";
import { activateAbsoluteMenace } from "./absolute-menace.mjs";
import { activateAvalancheStomp } from "./avalanche-stomp.mjs";
import { activateFrighteningDisplay } from "./frightening-display.mjs";
import { getTimeTravelerActiveSkill, toggleTimeTravelerSnagImmunity } from "./time-traveler.mjs";
import { isLanceOfLightActive, toggleLanceOfLight } from "./lance-of-light.mjs";
import { markFightMe } from "./fight-me.mjs";
import { getEffectiveLevel, PENDING_DIG_DEEP_FLAG_KEY } from "./combat.mjs";
import { swapInitiativeWithTarget } from "./timeline-anomaly.mjs";
import { revealTargetDefenses } from "./quick-study.mjs";
import { pickFastLearnerAllocation } from "./fast-learner.mjs";
import { activateCastling } from "./castling.mjs";
import { syncDangerSenseInitiative } from "./danger-sense.mjs";
import { activateMysteriousAura } from "./mysterious-aura.mjs";
import {
  activateElectromagneticDisruptionPulse, canUseElectromagneticDisruptionPulse,
} from "./electromagnetic-disruption.mjs";
import { activateALogicalExplanation } from "./a-logical-explanation.mjs";
import { activateBumperCrop } from "./bumper-crop.mjs";
import { isGravityOptionalActive, toggleGravityOptional } from "./gravity-optional.mjs";
import { activatePseudoScience, isPseudoScienceActive } from "./pseudo-science.mjs";
import { activateDutyOfTheGraphite } from "./duty-of-the-graphite.mjs";
import { activateTriggerReaction } from "./trigger-reaction.mjs";
import { activateNotDeadYet, canUseNotDeadYet, NOT_DEAD_YET_ID } from "./not-dead-yet.mjs";
import { activateVibratingPalm, canUseVibratingPalm, VIBRATING_PALM_ID } from "./vibrating-palm.mjs";
import { activateCache, canUseCache, CACHE_I_ID } from "./cache.mjs";
import { activateIveGotYou, IVE_GOT_YOU_ID } from "./i-ve-got-you.mjs";
import {
  activateExpandedMysticism, canUseExpandedMysticism, EXPANDED_MYSTICISM_ID,
} from "./expanded-mysticism.mjs";
import { activateMagicallyFitIn, canUseMagicallyFitIn, MYSTICAL_UNDERSTANDING_ID } from "./magically-fit-in.mjs";
import { activateDesignateHeirloom, canDesignateHeirloom, PERSONAL_HEIRLOOM_ID } from "./personal-heirloom.mjs";
import { activateFaceMe, FACE_ME_ID } from "./face-me.mjs";
import { activateDigDeepPrCrb, canUseDigDeepPrCrb, DIG_DEEP_PR_CRB_ID } from "./dig-deep-pr-crb.mjs";
import { activateRighteousHeart, canUseRighteousHeart, RIGHTEOUS_HEART_ID } from "./righteous-heart.mjs";
import {
  activateBioEnergyConversion, BIO_ENERGY_CONVERSION_ID, canUseBioEnergyConversion,
} from "./bio-energy-conversion.mjs";
import { activateAugmentPower, AUGMENT_POWER_ID, canUseAugmentPower } from "./augment-power.mjs";
import { activateConsultMemories, canUseConsultMemories, CONSULT_MEMORIES_ID } from "./consult-memories.mjs";
import { activateResourceful, canUseResourceful, RESOURCEFUL_ID } from "./resourceful.mjs";
import { activateWorkTheNumbers, canUseWorkTheNumbers } from "./work-the-numbers.mjs";
import {
  activateSkillSubstitutionPerk, canUseSkillSubstitutionPerk, isSkillSubstitutionPerk,
} from "./skill-substitution-perks.mjs";
import { activateTheReturned, canUseTheReturned, THE_RETURNED_ID } from "./the-returned.mjs";
import { activateMindOverMatter, MIND_OVER_MATTER_ID } from "./mind-over-matter.mjs";
import { activateForwardObservation } from "./forward-observation.mjs";
import { activateHeartyMeal } from "./hearty-meal.mjs";
import { activateYourSafetysOn } from "./your-safetys-on.mjs";
import {
  applyUninterruptedBreakBenefit, canUseUninterruptedBreak, pickUninterruptedBreakBenefit,
} from "./uninterrupted-break.mjs";
import { activateTender, getEmpathyChoice } from "./tender.mjs";
import { activateTakedown } from "./takedown.mjs";
import { activateSelfRevive, canUseSelfRevive } from "./self-revive.mjs";
import { activateIStillFunction, canUseIStillFunction } from "./i-still-function.mjs";
import { activateSpotWeld, canUseSpotWeld } from "./spot-weld.mjs";
import { toggleMetallikatoMultipleTargets } from "./metallikato.mjs";
import { activateTwoHeadsAreBetterThanOne, canUseTwoHeadsAreBetterThanOne } from "./two-heads-are-better-than-one.mjs";
import { canUseInvisibility, toggleInvisibility } from "./invisibility.mjs";
import { activatePhantom } from "./phantom.mjs";
import { activateFrictionlessMovement, canUseFrictionlessMovement } from "./frictionless-movement.mjs";
import { activateSprinterBoost, canUseSprinterBoost } from "./sprinter-boost.mjs";
import { activateOutwit } from "./outwit.mjs";
import { activateShoulderToShoulder } from "./shoulder-to-shoulder.mjs";
import { activateFearsomePresence } from "./fearsome-presence.mjs";
import { isRecklessAbandonActive } from "./reckless-abandon.mjs";
import { canDeclareRelicKeyEdge, declareRelicKeyEdge, RELIC_KEY_ID } from "./relic-key.mjs";
import { toggleNaturalMovement } from "./natural-movement.mjs";
import {
  ADAPTATION_ID, ENVIRONMENTAL_EXPERTISE_ID, GUIDANCE_ID, isEnvironmentalExpertiseActive, PENDING_GUIDANCE_FLAG_KEY,
  READ_THE_LAND_ID, toggleEnvironmentalExpertise,
} from "./environmental-expertise.mjs";
import { activateRushTheLine } from "./rush-the-line.mjs";
import { activateRouse } from "./rouse.mjs";
import { activateRousingComeback } from "./rousing-comeback.mjs";
import { activateKnightsJump } from "./knights-jump.mjs";
import { activateDirtyTrick } from "./dirty-trick.mjs";
import { canUseEyeForAppraisal, markEyeForAppraisal } from "./eye-for-appraisal.mjs";
import { canUseWrestlerPin, activateWrestlerPin } from "./wrestler-pin.mjs";
import { activateElementalStorm } from "./elemental-storm.mjs";
import { applyComicFlair } from "./comic-flair.mjs";
import { getGridSoldierImpairedTarget } from "./grid-soldier.mjs";
import { activateEngineOverride } from "./engine-override.mjs";
import { activateJuryRig } from "./jury-rig.mjs";
import { activateOmegaEnhancement } from "./omega-enhancement.mjs";
import { activateImproviseArmor, IMPROVISE_ARMOR_ENCOUNTER_FLAG } from "./improvise-armor.mjs";
import { activateMartialLeadership } from "./martial-leadership.mjs";
import { activateVoiceOfPrimus } from "./voice-of-primus.mjs";
import { activateRemoteOperations, REMOTE_OPERATIONS_ID } from "./remote-operations.mjs";
import { activateAvast, AVAST_ENCOUNTER_FLAG, AVAST_ID } from "./avast.mjs";
import { toggleInfiltrating } from "./infiltrating.mjs";
import { activateWordsCanHurt } from "./words-can-hurt.mjs";
import { activateSideSplitter, SIDE_SPLITTER_ID } from "./side-splitter.mjs";
import { INNER_MAGIC_ID as INNER_MAGIC_WILLPOWER_ID, stackInnerMagicWillpowerReduction } from "./inner-magic.mjs";
import { applyFunExhaustionBlock, hasFunExhaustionHangUp } from "./fun-exhaustion.mjs";
import { activateCalmingWords } from "./calming-words.mjs";
import { activatePowerfulSuggestions } from "./powerful-suggestions.mjs";
import { activateDataBridge, getAvailableDataBridgeSpecializations } from "./data-bridge.mjs";
import { applyMiseryLovesCompany, getAffectedDataBridgeAllies, getDataBridgedAllyTokens } from "./misery-loves-company.mjs";
import { applyLikeWater, getAvailableLikeWaterOptions } from "./like-water.mjs";
import { activatePoweredPlating } from "./powered-plating.mjs";
import { activateExplosiveMorph } from "./explosive-morph.mjs";
import { applyEltarianMettle } from "./eltarian-mettle.mjs";
import { applyBalanceAndHarmony, canUseBalanceAndHarmony } from "./balance-and-harmony.mjs";
import { activateQuietOne, canUseQuietOne } from "./quiet-one.mjs";
import { applyNuPogodiCondition, canUseNuPogodiCondition } from "./nu-pogodi.mjs";
import { activateEmtCrashCourseEssenceRestore } from "./emt-crash-course.mjs";
import { activateSoothe } from "./soothe.mjs";
import { activateManipulate } from "./manipulate.mjs";
import { activateTalkThemUp } from "./talk-them-up.mjs";
import { activateTalkThemDown } from "./talk-them-down.mjs";
import {
  activateWisdomOfTheEldersTeleportation, canAffordWisdomOfTheElders, isWisdomOfTheEldersActive,
  toggleWisdomOfTheElders, WISDOM_OF_THE_ELDERS_OPTIONS,
} from "./wisdom-of-the-elders.mjs";
import { isObserverDisguiseActive, toggleObserverDisguise } from "./observer.mjs";
import { isPerfectDisguiseActive, togglePerfectDisguise } from "./perfect-disguise.mjs";
import { activateSupremeGuardianBlind } from "./supreme-guardian.mjs";
import { canDeclareCombatStance, declareCombatStance } from "./combat-stance.mjs";
import { activateAtAllCost, canActivateAtAllCost, deactivateAtAllCost, isAtAllCostActive } from "./at-all-cost.mjs";
import { convertWeapon, hasConvertibleWeapon } from "./weapon-conversion.mjs";
import { markConcentrateFireTarget } from "./concentrate-fire.mjs";
import {
  canUseInspiringWords, markInspiringWordsUsed, pickInspiringWordsCondition, pickInspiringWordsEffect,
} from "./inspiring-words.mjs";
import {
  GROW_ID, isMonsterFormActive, MONSTER_MORPH_ID, toggleGrow, toggleMonsterMorph,
} from "./monster-morph.mjs";
import { activatePsychoAssault, PSYCHO_ASSAULT_ID } from "./psycho-assault.mjs";
import { activateNemesisDrain } from "./nemesis-drain.mjs";
import { activateRightBehindYou } from "./right-behind-you.mjs";
import { activateBetterYouThanMe } from "./better-you-than-me.mjs";
import { isDistractionActive, toggleDistraction } from "./distraction.mjs";
import { activatePowerBleed } from "./power-bleed.mjs";
import { activateMaximizeFlaws } from "./maximize-flaws.mjs";
import { activateGrowingSmolder } from "./growing-smolder.mjs";
import { isToxicTerrorActive, toggleToxicTerror } from "./toxic-terror.mjs";
import { activateTradeSchool, canUseTradeSchool } from "./trade-school.mjs";
import { activateTechSpecs } from "./tech-specs.mjs";
import { activateBreakingPoint } from "./breaking-point.mjs";
import { activateDeadstick } from "./deadstick.mjs";
import { activateGroundSuppression } from "./ground-suppression.mjs";
import { activateMenace, canUseMenace } from "./menace.mjs";
import { activateDistractingOffer, canUseDistractingOffer } from "./distracting-offer.mjs";
import { applyMatured } from "./matured.mjs";
import { activateGrowl, canUseGrowl } from "./growl.mjs";
import { activateTearDown, TEAR_DOWN_ID } from "./tear-down.mjs";
import { isBeastModeActive, toggleBeastMode } from "./beast-mode.mjs";
import { activateHarass, canUseHarass } from "./harass.mjs";
import { activateAntagonistic } from "./antagonistic.mjs";
import { activateFlyingNuisance } from "./flying-nuisance.mjs";
import { toggleVersatileProtection } from "./versatile-protection.mjs";
import { activatePackAttack, canUsePackAttack } from "./pack-attack.mjs";
import { getAnimalGaitType, toggleAnimalGait } from "./animal-gait.mjs";
import { activateHumanBullet } from "./human-bullet.mjs";
import { activateStayInFormation } from "./stay-in-formation.mjs";
import { activateHumanitarianRoll } from "./humanitarian.mjs";
import { activateEntropicSponge } from "./entropic-sponge.mjs";
import { activateIKnowAGuyRoll, I_KNOW_A_GUY_ENCOUNTER_FLAG } from "./i-know-a-guy.mjs";
import { activateEnergonParasite, canUseEnergonParasite, ENERGON_PARASITE_ID } from "./energon-parasite.mjs";
import { activatePatchUp, canUsePatchUp, PATCH_UP_ID } from "./patch-up.mjs";
import { activatePreventativeMeasures, PREVENTATIVE_MEASURES_ID } from "./preventative-measures.mjs";
import { activateToughItOut, canUseToughItOut, TOUGH_IT_OUT_ID } from "./tough-it-out.mjs";
import { activateStandTogether, canUseStandTogether, STAND_TOGETHER_ID } from "./stand-together.mjs";
import {
  activateCostGatedSubstitutionPerk, canUseCostGatedSubstitutionPerk, isCostGatedSubstitutionPerk,
} from "./skill-substitution-perks.mjs";
import { activateCleverMind, canUseCleverMind, CLEVER_MIND_ID } from "./clever-mind.mjs";
import { activateRottenTomatoes, canUseRottenTomatoes, ROTTEN_TOMATOES_ID } from "./rotten-tomatoes.mjs";
import { activateToughCrowd, canUseToughCrowd, TOUGH_CROWD_ID } from "./tough-crowd.mjs";
import { activateSiphon, SIPHON_ID } from "./siphon.mjs";
import { ENERGY_AFFINITY_ID, onEnergyAffinityUse } from "./energy-affinity.mjs";
import { activateSelfPreservation, SELF_PRESERVATION_ID } from "./self-preservation.mjs";
import { revealStudiousMeasuresQuarry } from "./studious-measures.mjs";
import { activatePsychologicalSway, PSYCHOLOGICAL_SWAY_ID } from "./psychological-sway.mjs";
import { activateOnTarget, canUseOnTarget, ON_TARGET_ID } from "./on-target.mjs";
import { rollWeldsRivetsAndIdeas, WELDS_RIVETS_AND_IDEAS_ID } from "./welds-rivets-and-ideas.mjs";

// Mark Target (Scout, 2nd level, p.84) - see helpers/mark-target.mjs's own doc comment. Its "Use"
// button always shows (no affordability/once-per-X gate - RAW's only limit is "one creature at a
// time," enforced by simply overwriting the flag on each use) and marks whichever token is
// currently targeted, so it's dispatched directly here rather than through either table below.
const MARK_TARGET_ID = "Compendium.essence20.tf_crb.Item.T2mm6VmvcUxagsjc";
// Primary Quarry - see helpers/primary-quarry.mjs's own doc comment.
const PRIMARY_QUARRY_ID = "Compendium.essence20.decepticon_directive.Item.myYcCOZdN1ViBeQH";
const KNOWN_ACCOMPLICES_ID = "Compendium.essence20.decepticon_directive.Item.LxpkFOriqLvRT7sn";

const STUDIOUS_MEASURES_ID = "Compendium.essence20.decepticon_directive.Item.ADj30QljJZ7iNt52";

// Mark Everybot (Transformers CRB, Scout, 18th level, p.85) - see helpers/mark-target.mjs's own
// doc comment. A genuine once-per-scene gate (unlike Mark Target's own always-available button
// above), so dispatched separately.
const MARK_EVERYBOT_ID = "Compendium.essence20.tf_crb.Item.KxmnKUYmQ56D02Jg";

// Extra Rough Training (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 3rd level,
// p.10) - see helpers/extra-rough-training.mjs's own doc comment. No cost beyond a valid targeted
// ally who hasn't used their own attempt yet this mission, and being outside of combat (RAW's own
// "outside of combat" - the same idiom Exploit Trust's identical !game.combat gate already uses).
const EXTRA_ROUGH_TRAINING_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.pqrUN5jaAbWJmgLf";

// Hup! Hup! Hup! Hup! Hup! (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 6th level,
// p.10) - see helpers/hup-hup-hup-hup-hup.mjs's own doc comment. No cost or gate beyond the
// Standard action itself - always available, same "no cost, no gate" dispatch shape as Dig
// In/Meat Shield.
const HUP_HUP_HUP_HUP_HUP_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.xsIHUoZaFoadsmma";

// Timely Teammate (Ferocious Fighters, Tiger Force General Perk, p.39) - see
// helpers/timely-teammate.mjs's own doc comment. Dispatched directly here (neither bankable nor
// an ally-heal, and the actual effect is a Combatant#initiative swap, not a flag), same shape as
// Mark Target/Fight Me! just above.
const TIMELY_TEAMMATE_ID = "Compendium.essence20.ferocious_fighters.Item.yrhhCOXpS8Mx1R0C";

// Roar! (Ferocious Fighters, Tiger Force Faction Perk) - see helpers/roar.mjs's own doc comment.
// Dispatched directly here (a self-only banked Defense choice, no roll to trigger), same shape as
// Timely Teammate just above.
const ROAR_ID = "Compendium.essence20.ferocious_fighters.Item.AaI58jYka8MfhIbc";

// Nemesis Drain (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 7th level) - see
// helpers/nemesis-drain.mjs's own doc comment. Same once-per-scene AoE dispatch shape as
// Elemental Storm.
const NEMESIS_DRAIN_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.WQYSawSpefEKLaG0";
const NEMESIS_DRAIN_ENCOUNTER_FLAG = 'nemesisDrainUsedThisEncounter';

// Right Behind You (Finster's Monster-Matic Cookbook, Path of Flame, 5th level) - see
// helpers/right-behind-you.mjs's own doc comment.
const RIGHT_BEHIND_YOU_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.7jwgzzygZymRkndW";

// Better You Than Me (Finster's Monster-Matic Cookbook, Path of Frost, 2nd level) - see
// helpers/better-you-than-me.mjs's own doc comment.
const BETTER_YOU_THAN_ME_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.u0vF75YLcwdyY8pv";

// Distraction (Finster's Monster-Matic Cookbook, Path of Venom, 5th level) - see
// helpers/distraction.mjs's own doc comment.
const DISTRACTION_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.mJu5IxoVrPjp8dVU";

// Power Bleed (Finster's Monster-Matic Cookbook, Path of Frost, 5th level) - see
// helpers/power-bleed.mjs's own doc comment.
const POWER_BLEED_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.2nI6ckZdiIKwtRqr";

// Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level) - see
// helpers/maximize-flaws.mjs's own doc comment.
const MAXIMIZE_FLAWS_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.jGa15CyuKXhq3IV2";

// Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level) - see
// helpers/growing-smolder.mjs's own doc comment.
const GROWING_SMOLDER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4XblFV97cS63ueDM";

// Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level) - see
// helpers/toxic-terror.mjs's own doc comment.
const TOXIC_TERROR_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.kh7Wk5zalucm9I7p";

// Venom Warlord (Finster's Monster-Matic Cookbook, 20th level, p.300): "Spend 1 Personal Power to
// remove any Condition on you (except Defeated)." Textually identical to Eltarian Mettle (Through
// the Shattered Grid) - same cost, same "any currently-active Condition" scope - so this reuses
// that same dynamic-option-picker function directly rather than duplicating it. (Venom Warlord's
// own passive Reach-damage bonus, built separately, lives in dice.mjs and doesn't go through this
// dispatch at all - a single compendium item can carry both a passive check and a "Use" button.)
const VENOM_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.9tU5tDmpOhChLfdv";

// Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level) - see
// helpers/psycho-assault.mjs's own doc comment. A one-shot activation (not a two-way toggle - it
// naturally expires at the end of the turn, nothing to manually switch back off), so dispatched
// directly here like Mark Target above.

// Protected Target (GI Joe CRB, Bodyguard Focus, 1st level, p.110) - see
// helpers/protected-target.mjs's own doc comment.
const PROTECTED_TARGET_ID = "Compendium.essence20.gi_joe_crb.Item.llnU5dWqYlfgLA5V";

// Rouse (GI Joe CRB, Officer base, 1st level, p.85) - see helpers/rouse.mjs's own doc comment.
// Usable any time in an active combat (RAW's own "as a Standard action during combat"), no
// once-per-X cap - the DIF 15 Persuasion Test itself is the only real gate.
const ROUSE_ID = "Compendium.essence20.gi_joe_crb.Item.AVhNGB1h4e4eeNPD";

// Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86) - see
// helpers/rousing-comeback.mjs's own doc comment. Same shape as Rouse just above.
const ROUSING_COMEBACK_ID = "Compendium.essence20.gi_joe_crb.Item.I8yAnOEoaut76wlf";

// Knight's Jump (GI Joe CRB, Grandmaster Focus, 1st level, p.87) - see
// helpers/knights-jump.mjs's own doc comment. "Once per turn" via the standard
// hasUsedThisTurn/markUsedThisTurn idiom.
const KNIGHTS_JUMP_ID = "Compendium.essence20.gi_joe_crb.Item.CG0aeZtKsPVmvUF5";
const KNIGHTS_JUMP_TURN_FLAG = 'knightsJumpUsedThisTurn';

// Dirty Trick (GI Joe CRB, Ranger Environmental Exposure choice, p.91) - see
// helpers/dirty-trick.mjs's own doc comment. No cost or cap in RAW beyond "as an Attack" - a
// plain, unconditionally-usable dispatch, same as Outwit above.
const DIRTY_TRICK_ID = "Compendium.essence20.gi_joe_crb.Item.e5nMmMPpV3WU9P92";

// Honorific Token (A Jump Through Time, Medieval Equipment, p.67): "If someone is granted an
// honorific token... they may spend a Move action once per day to regain a Story Point after
// spending it." A `gear` item, not a Perk - joins canUsePerk's own existing 'gear' allowlist
// (Energon Cube/Energon Snack's own precedent) rather than a parallel registry. "Once per day" is
// approximated as "once per encounter," the same idiom as Curb Your Enthusiasm above; granted via
// the same requestStoryPointGrant relay - RAW's own "regain... after spending it" reads as an
// ordinary grant, not a refund tied to any specific spend this codebase could cross-reference.
const HONORIFIC_TOKEN_ID = "Compendium.essence20.jump_through_time.Item.z9NkwgoIx2JRrPBA";
const HONORIFIC_TOKEN_ENCOUNTER_FLAG = 'honorificTokenUsedThisEncounter';

// Party Power (MLP CRB, Party Maestro Influence, p.56): "You can use this ability three times a
// day, and when you do, not only does the party begin, but the group gains a Friendship Point."
// Same Friendship-Point-is-the-world-Story-Points-pool reasoning as Curb Your Enthusiasm/the
// Element Is Magic Perks above, just counted (getUsesThisScene/markUsedThisScene, "per day"
// approximated as "per scene") instead of a plain once/encounter boolean. The "party begins"
// half and its own Fun Exhaustion Hang-Up interaction are narrative, not built.
const PARTY_POWER_ID = "Compendium.essence20.mlp_crb.Item.GKez5xeu5ZllzGOI";
const PARTY_POWER_SCENE_FLAG = 'partyPowerUsedThisScene';
const PARTY_POWER_MAX_USES = 3;

// Concentrate Fire (GI Joe CRB, Vanguard base, 15th level, p.109) - see
// helpers/concentrate-fire.mjs's own doc comment. Once per encounter, spends 1 Story Point (same
// canWriteStoryPoints()/hasStoryPointsAvailable() gate Bait and Switch already establishes), then marks
// whichever token is currently targeted.
const CONCENTRATE_FIRE_ID = "Compendium.essence20.gi_joe_crb.Item.LccKe9ZdDPvS5YbD";
const CONCENTRATE_FIRE_ENCOUNTER_FLAG = 'concentrateFireUsedThisEncounter';

// Stay In Formation (Quartermaster's Guide to Gear, General Perk, p.31) - see
// helpers/stay-in-formation.mjs's own doc comment. Once per encounter, sets every nearby ally's
// own Initiative to the holder's own result minus a real 1d4 roll (floored at 1).
const STAY_IN_FORMATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.pU3dKGNWYAhgRY6B";
const STAY_IN_FORMATION_ENCOUNTER_FLAG = 'stayInFormationUsedThisEncounter';

// Humanitarian (PR CRB, General Perk, p.96) - see helpers/humanitarian.mjs's own doc comment.
// Always available, same "no cost or gate at all" shape Lucky Charm/Illusory Disguise's own
// power-use.mjs dispatch already uses (the DIF 12 roll itself is the only cost).
const HUMANITARIAN_ID = "Compendium.essence20.pr_crb.Item.hxWJxlMLbkBbx73w";
const ENTROPIC_SPONGE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.dpxjT9eTAKcZuRXs";

// "I Know A Guy" (PR CRB, Kind Origin benefit, p.26) - see helpers/i-know-a-guy.mjs's own doc
// comment. Once per encounter (approximating "once per day"), same idiom as Curb Your Enthusiasm.
const I_KNOW_A_GUY_ID = "Compendium.essence20.pr_crb.Item.anfEVX8bI2eQh40E";

// Time Traveler (A Jump Through Time, Influence Perk, p.24) - see helpers/time-traveler.mjs's own
// doc comment. An on/off toggle: free to turn OFF, gated on canWriteStoryPoints()/hasStoryPointsAvailable()
// (same shape Concentrate Fire above already establishes) only when turning ON, since the 1 Story
// Point cost is paid at that moment via the skill picker inside the toggle itself.
const TIME_TRAVELER_PERK_ID = "Compendium.essence20.jump_through_time.Item.bXkXXr0VMXpoAiv0";

// Phantom (GI Joe CRB, Infiltrator Focus, 17th level, p.74): "In dim light or darkness, spend a
// Free action to become invisible to natural eyesight until the beginning of your next turn. This
// effect ends if you make a non-Takedown attack, take damage, or are exposed to bright light."
// A plain self toggleStatusEffect grant (same "Free action, no cost, no cap" shape Real Angels'
// own Cover grant establishes just above) - see helpers/phantom.mjs's own doc comment for the
// "ends if..." clauses, two of which ARE now actively enforced there. "Exposed to bright light"
// stays unenforced (no lighting concept anywhere in this codebase).
const PHANTOM_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.Z92UggPHdmt47A7Q";

// Surface Read (GI Joe CRB, Spy Focus, 10th level, p.76): "When meeting someone new, spend a Story
// Point to roll your Alertness skill die and ask the GM that number of yes-or-no questions." Spend
// + roll the actor's own current Alertness die directly (same new Roll(shift, ...) construction
// Hard Target's own rollsSkillDie already establishes) and report the total via chat - no state to
// bank, since the "questions" happen immediately at the table, not on a future roll.
const SURFACE_READ_ID = "Compendium.essence20.gi_joe_crb.Item.5YfAL40M8FlZvBVb";

// Suggestion (GI Joe CRB, Spy Focus, 20th level, p.76): "Once per scene, while you are disguised,
// issue a short command to an enemy and make an Intimidation or Persuasion roll against their
// Willpower Defense. If successful, they attempt to follow it (if it doesn't cause direct harm)."
// Gated on Perfect Disguise's own isPerfectDisguiseActive toggle (already built) rather than a new
// disguise-state concept. RAW offers a choice of 2 skills for one roll; Persuasion is used as the
// representative pick, the same judgment call Duty Of The Graphite's own "a Social Skill Test"
// already makes. Success is pure narrative (no forced status to apply) - just the gated roll.
const SUGGESTION_ID = "Compendium.essence20.gi_joe_crb.Item.q2YLQLdssomYU4Za";
const SUGGESTION_ENCOUNTER_FLAG = 'suggestionUsedThisEncounter';

// Talk Them Down (GI Joe CRB, Spy Focus, 17th level, p.76): "If you have an Edge on an attack, you
// may instead roll Intimidation or Persuasion against the Willpower of a target whose threat level
// is no higher than yours. Snag if enemy forces outnumber you, Edge if you outnumber them. On a
// success, the target drops their weapons, surrenders, and gains the Frightened Condition."
// Rather than intercept an in-progress Attack roll mid-flow (no precedent anywhere in this project
// for swapping a roll's own skill/Defense after it's already begun), this is dispatched as its own
// "Use" button - the player self-polices "I currently have Edge on an attack against this target"
// the same way this project already trusts a player's own fictional-precondition calls elsewhere.
// The outnumber Edge/Snag and the threat-level cap ARE mechanically checked; Persuasion is again
// the representative pick between the RAW-offered choice of two skills.
const TALK_THEM_DOWN_ID = "Compendium.essence20.gi_joe_crb.Item.Y8PlCnqD5txZKJWh";

// Inspiring Words (GI Joe CRB, Vanguard base, 2nd level, p.109) - see
// helpers/inspiring-words.mjs's own doc comment. Picks an ally (reusing pickAllyTargets below),
// then one of 3 effects; canUsePerk delegates to canUseInspiringWords's own
// twice-per-combat/once-per-turn gate.
const INSPIRING_WORDS_ID = "Compendium.essence20.gi_joe_crb.Item.0cGhuapOhkdwYC9G";

// Trade School (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22) -
// see helpers/trade-school.mjs's own doc comment.
const TRADE_SCHOOL_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.yR5QrBHWNUnbuiG7";

// Tech Specs (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22) - see
// helpers/tech-specs.mjs's own doc comment.
const TECH_SPECS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Ii4gXQePcG8xg0hB";

// Breaking Point (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 1st level, p.23) - see
// helpers/breaking-point.mjs's own doc comment.
const BREAKING_POINT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.KYgAj14jx4BkjCfl";

// Deadstick (Quartermaster's Guide to Gear, Neutralizer Focus, Technician, 10th level, p.26) -
// see helpers/deadstick.mjs's own doc comment.
const DEADSTICK_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.SDwpvAzQX0pYSHyc";

// Ground Suppression (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level, p.28) -
// see helpers/ground-suppression.mjs's own doc comment.
const GROUND_SUPPRESSION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.nCjrhYaUuN4omhDm";

// Superb Soloist (Knights of Canterlot, Bard Influence, p.15) - see SUPERB_SOLOIST_ID's own
// comment in dice.mjs. Dispatched directly here (not through team-buffs.mjs's own Morphed-only
// generic dispatcher) - broadcasts an unscoped Edge bank to every nearby ally, once per scene.
const SUPERB_SOLOIST_ID = "Compendium.essence20.knights_of_canterlot.Item.S3t5zNlhPp7evXbh";
const SUPERB_SOLOIST_ENCOUNTER_FLAG = 'superbSoloistUsedThisEncounter';

// Dig In (Decepticon Directive Raider, Siegemaster Focus, 10th level, p.64) - see
// helpers/dig-in.mjs's own doc comment. A toggle (not a bank-once, ally-heal, or self-grant), so
// it gets its own dedicated dispatch here too, always available (RAW has no cost/gate beyond
// spending the Move action itself).
const DIG_IN_ID = "Compendium.essence20.decepticon_directive.Item.9tIkV50YiO3xqxvi";
// Unmovable (Finster's Monster-Matic Cookbook, Path of Stone, 15th level, p.297) - see
// helpers/unmovable.mjs's own doc comment. Same on/off toggle "Use" button as Dig In above, but
// costs 1 Personal Power to turn on (Power Boost's own togglePowerBoost shape).
const UNMOVABLE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.1aVrzJLiNkghFT4p";

// Meat Shield (Sgt Slaughter Sourcebook, Alternate Vanguard Role Perk, p.14) - see
// helpers/meat-shield.mjs's own doc comment. Same "Free action, no cost, no gate" dispatch shape
// as Dig In just above - the actual Toughness/Evasion bonus lives entirely in that helper/dice.mjs,
// this is just the on/off switch.
const MEAT_SHIELD_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.hYwFDsC7azfYB5fO";

// Menace (Cobra Codex, Bully Origin benefit, p.41) - see helpers/menace.mjs's own doc comment. A
// once-per-scene "Use" button dispatch, since activateMenace triggers the roll itself.
const MENACE_ID = "Compendium.essence20.cobra_codex.Item.t0QDESiNz7GEDYHL";

// Distracting Offer (Cobra Codex, Corrupt Origin benefit, p.42) - see
// helpers/distracting-offer.mjs's own doc comment. A stateful "Use" button dispatch (the scene
// gate depends on the actor's own past attempts, not a simple counter), and the target
// eligibility is re-checked at click time too (activateDistractingOffer warns if it's stale).
const DISTRACTING_OFFER_ID = "Compendium.essence20.cobra_codex.Item.fUSF6fxRyTniN2wT";

// Matured (Cobra Codex, General Perk, p.176) - see helpers/matured.mjs's own doc comment. A
// one-time-per-pick "Use" button dispatch (re-pickable at any time) rather than a repeatable
// combat ability, same idiom Duty of the Silver's own armor-training grant already established
// for a build-time choice with no other natural home.
const MATURED_ID = "Compendium.essence20.cobra_codex.Item.bf4nxa6WKKhuQcEH";

// Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69) - see helpers/growl.mjs's own doc
// comment. A "Use" button dispatch since activateGrowl triggers the roll itself; the once-per-
// target-per-turn gate is re-checked at click time too (activateGrowl warns if it's stale).
const GROWL_ID = "Compendium.essence20.cobra_codex.Item.OSVtPXBdRmZ2C4PD";

// Beast Mode (Cobra Codex, Ranger Guerilla Focus, 1st level, p.61) - see
// helpers/beast-mode.mjs's own doc comment. A toggle (spend Adaptation Points only to switch ON,
// free to switch back OFF), same shape as Dig In/Power Boost.
const BEAST_MODE_ID = "Compendium.essence20.cobra_codex.Item.o4lqILvsxyU3LhBS";

// Harass (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.63) - see helpers/harass.mjs's
// own doc comment.
const HARASS_ID = "Compendium.essence20.cobra_codex.Item.91TqKfAnyL1VijZH";

// Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63) - see
// helpers/antagonistic.mjs's own doc comment. A "Use" button dispatch since activateAntagonistic
// triggers the roll itself.
const ANTAGONISTIC_ID = "Compendium.essence20.cobra_codex.Item.04lrt1b9aCN4ts2N";

// Flying Nuisance (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.66) - see
// helpers/flying-nuisance.mjs's own doc comment. Same "Use" button dispatch shape as Antagonistic
// just above.
const FLYING_NUISANCE_ID = "Compendium.essence20.cobra_codex.Item.6PsZqPUijt60ISlq";

// Versatile Protection (Cobra Codex, Vanguard Citystriker Focus, 17th level, p.68) - see
// helpers/versatile-protection.mjs's own doc comment. A toggle, always usable (no resource cost).
const VERSATILE_PROTECTION_ID = "Compendium.essence20.cobra_codex.Item.FZQlUV1KkyQxUi7s";

// Pack Attack (Cobra Codex, Vanguard Warthog Focus, 17th level, p.69) - see
// helpers/pack-attack.mjs's own doc comment. A "Use" button, available only while the actor's
// own Growl bank from a just-succeeded use is still live.
const PACK_ATTACK_ID = "Compendium.essence20.cobra_codex.Item.spxYtWFQPj7bBt0g";

// Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61) - see
// helpers/animal-gait.mjs's own doc comment. A toggle, always usable (no resource cost).
const ANIMAL_GAIT_ID = "Compendium.essence20.cobra_codex.Item.gWjcSPeqNe1h8rwZ";

// Human Bullet (Cobra Codex, Technician Rocketeer Focus, 17th level, p.66) - see
// helpers/human-bullet.mjs's own doc comment. A "Use" button dispatch since activateHumanBullet
// triggers the roll itself.
const HUMAN_BULLET_ID = "Compendium.essence20.cobra_codex.Item.KGdGal1EWQ3m4HTw";

// Box Shot (Quartermaster's Guide to Gear, General Perk, p.28) - see helpers/box-shot.mjs's own
// doc comment.
const BOX_SHOT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.N8E3QTLUKX6DOoEc";

// Dig In (Enigma of Combination, Cannoneer Focus, Gunner, 17th level, p.32) - see
// helpers/cannoneer-dig-in.mjs's own doc comment. A same-named but textually distinct Perk from
// Decepticon Directive's own Dig In just above - its own separate flag/toggle, dispatched the
// same way (a Move action, no cost, no gate).
const CANNONEER_DIG_IN_ID = "Compendium.essence20.enigma_of_combination.Item.RQjNiRZxDFwTPHN8";

// Metallikato (Decepticon Directive, General Perk, p.66) - see helpers/metallikato.mjs's own doc
// comment. Only its own Multiple (2) Targets (↓1) benefit needs a dispatch (the others are a
// checkbox, an automatic post-Crit apply, or a bare reroll config) - a plain on/off toggle, same
// shape as Dig In just above.
const METALLIKATO_ID = "Compendium.essence20.decepticon_directive.Item.ouLZnb7j0kAfCrLx";

// Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46) - see
// helpers/two-heads-are-better-than-one.mjs's own doc comment. canUsePerk delegates to
// canUseTwoHeadsAreBetterThanOne (not yet used this scene) - the actual mark only happens once a
// valid target is confirmed inside activateTwoHeadsAreBetterThanOne, same split as Mark Target.
const TWO_HEADS_ARE_BETTER_THAN_ONE_ID = "Compendium.essence20.technorganic_secrets.Item.2SGJ4ezuiZgb7JqX";

// Invisibility (Technorganic Secrets, Mutant Beast Influence Perk, p.47) - see
// helpers/invisibility.mjs's own doc comment. canUsePerk delegates to canUseInvisibility (already
// active, so switching off is always allowed, or not yet used this scene).
const INVISIBILITY_ID = "Compendium.essence20.technorganic_secrets.Item.Ec3PMcI8WsCu2ivp";

// Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47) - see
// helpers/frictionless-movement.mjs's own doc comment.
const FRICTIONLESS_MOVEMENT_ID = "Compendium.essence20.technorganic_secrets.Item.9fOrSAd3brtSBk9C";

// Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44) - see
// helpers/sprinter-boost.mjs's own doc comment.
const SPRINTER_ID = "Compendium.essence20.technorganic_secrets.Item.L5P54Ismw81Lhrbe";

// Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99) - see helpers/bulwark.mjs's own doc comment.
// Same free-toggle-either-direction shape as Dig In above.
const BULWARK_ID = "Compendium.essence20.gi_joe_crb.Item.7758n3XWOzhSjdOk";

// Takedown (GI Joe CRB, Commando base, 5th level, p.72) - see helpers/takedown.mjs's own doc
// comment. No Power/rolePoints cost, and this codebase has no action-economy tracking to gate a
// once-per-Standard-action use against - always usable, same shape as the picker itself deciding
// whether anything actually happens (a cancelled picker just triggers nothing).
const TAKEDOWN_ID = "Compendium.essence20.gi_joe_crb.Item.Yev7VrgEKtsTGdrx";

// I Still Function! (Decepticon Directive, General Perk, p.66) - see
// helpers/i-still-function.mjs's own doc comment. canUsePerk delegates entirely to
// canUseIStillFunction (Defeated + not yet used this encounter + a GM connected + a Story Point
// available - the same self-revive.mjs shape, plus the extra cost/roll checks I Still Function!
// itself layers on).
const I_STILL_FUNCTION_ID = "Compendium.essence20.decepticon_directive.Item.o4HgDxoKWVtieWZJ";

// Self-Revive (GI Joe CRB, Focus: Medic, 10th level, p.82) - see helpers/self-revive.mjs's own
// doc comment. canUsePerk delegates entirely to canUseSelfRevive (Defeated + not yet used this
// combat), since there's no separate Power/rolePoints cost to check here.
const SELF_REVIVE_ID = "Compendium.essence20.gi_joe_crb.Item.ulES8RippJVrGbhj";

// Outwit (GI Joe CRB, Focus: Battlefield Psychologist, 3rd level, p.86) - see
// helpers/outwit.mjs's own doc comment. No Power/rolePoints cost and no action-economy tracking
// to gate a once-per-Standard-action use against, same shape as Takedown above.
const OUTWIT_ID = "Compendium.essence20.gi_joe_crb.Item.DVBrtxa9iiXXhDoS";

// Shoulder To Shoulder (GI Joe CRB, Focus: Frontline Leader, 3rd level, p.87) - see
// helpers/shoulder-to-shoulder.mjs's own doc comment. No Power/rolePoints cost and no action-
// economy tracking to gate a once-per-reaction use against, same shape as Outwit above.
const SHOULDER_TO_SHOULDER_ID = "Compendium.essence20.gi_joe_crb.Item.vZNQBGwiv1hREbyr";

// Fearsome Presence (GI Joe CRB, Renegade base, 14th level, p.97) - see
// helpers/fearsome-presence.mjs's own doc comment. No Power/rolePoints cost, gated on Reckless
// Abandon actually being active (RAW: "while in Reckless Abandon").
const FEARSOME_PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.Jbx3ei70ZsoabVuL";

// Natural Movement (GI Joe CRB, Focus: Predator, 6th level, p.93) - see
// helpers/natural-movement.mjs's own doc comment. No Power/rolePoints cost, always usable (a
// free toggle either direction, same shape as Dig In/Bulwark).
const NATURAL_MOVEMENT_ID = "Compendium.essence20.gi_joe_crb.Item.TLI74oM0tbDtQ298";

// Pointy (Dark Skies Over Equestria, General Perk, p.21) - see helpers/pointy.mjs's own doc
// comment. Same on/off toggle shape as Dig In just above.
const POINTY_ID = "Compendium.essence20.dark_skies_over_equestria.Item.kwkUWzNVdSKDx0jt";

// Real Angels (Welcome to Night Vale: Citizens' Guide, General Perk, p.51): "Once per session, you
// can use your Standard action in combat to call on one of the choir of Erika to provide you with
// cover until the start of your next turn." A one-shot self-status grant (not a toggle like Dig
// In/Pointy above - there's no reason to switch it back off early), gated the same
// hasUsedThisEncounter/markUsedThisEncounter way Curb Your Enthusiasm's own once-per-scene grant
// already is ("once per session" approximated as "once per scene," this project's usual idiom for
// a daily/session-scoped resource). Toggles Foundry's own real "cover" status effect - the same
// one Maximize Cover/the existing ranged-attack downshift check already read - directly on the
// actor; "until the start of your next turn" isn't actively cleared (no such hook exists), the
// same "GM manages the edges" idiom Dig In's own manual toggle-off already established.
const REAL_ANGELS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.i5hL9SSARFDMf6UH";
const REAL_ANGELS_ENCOUNTER_FLAG = 'realAngelsUsedThisEncounter';

// Dig Deep (Welcome to Night Vale: Citizens' Guide, General Perk, p.47): "Once per scene, you can
// ignore 1 damage, but you suffer a Snag on all Skill Tests until the end of your next turn." A
// one-shot self bank of TWO independent flags from the same click (the damage-reduction half
// consumed in helpers/combat.mjs#applyDamage, the Snag half a timed mark on the holder read by
// extensions/fix3-tf/tf-fixes.mjs until the end of their next turn) - doesn't fit BANKABLE_PERKS' single-flagKey shape, so it
// gets its own dedicated dispatch here, same as Real Angels/Dig In above.
const DIG_DEEP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.A2Xay6rHrBK9l8eo";
const DIG_DEEP_ENCOUNTER_FLAG = 'digDeepUsedThisEncounter';

// Dig Deep (Transformers CRB, General Perk, p.108) - a DISTINCT compendium item from WTNV's own
// Dig Deep above. RAW packs in an EXTRA clause WTNV's own item doesn't have: "once per combat,
// repair 1d2 Health by forfeiting your turn" - only the ignore-1-damage-and-Snag half (textually
// identical to WTNV's own clause) is wired into this shared dispatch; the heal-by-forfeiting-turn
// half is NOT included here and stays unbuilt (this codebase has no per-turn action-forfeiture
// concept to key a real cost off of) - flagged rather than silently claimed complete.
const DIG_DEEP_TF_ID = "Compendium.essence20.tf_crb.Item.uPxkVrCLuBdx9kty";

// Dig Deep (GI Joe CRB, General Perk, p.130) / Dig Deep (MLP CRB, General Perk, p.123) - 2 MORE
// distinct compendium items reprinting the exact same 2-clause text (RAW-verified 2026-09-15
// directly against both books' own General Perks chapters) - this Perk is a shared General Perk
// reprinted verbatim across at least 5 books (WTNV/TF/GIJ/MLP/PR CRB all confirmed). Same shape as
// Martial Artist Hang-Up/Green/Giant-Killer/Expertise's own reprint-array idiom - widened into
// this same shared dispatch rather than duplicating it a 3rd/4th time. PR CRB's own Dig Deep
// (DIG_DEEP_PR_CRB_ID below) is deliberately NOT added here - it already has its own separate
// heal-by-forfeiting-turn dispatch via IMMEDIATE_ALLY_PERKS, and a single Perk item can only
// dispatch through one path via this codebase's single-button-per-item sheet UI; merging both of
// its own halves into one picker (the same shape Expanded Mysticism's own multi-benefit Use
// button already established) is flagged as a clean, well-scoped follow-on rather than risking a
// rewrite of PR CRB's own already-working, already-tested heal dispatch in the same pass.
const DIG_DEEP_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.QJkcVXT7K4yNWFoT";
const DIG_DEEP_MLP_ID = "Compendium.essence20.mlp_crb.Item.geBN3DkixaCXvnSO";
// The Transformers printing is "once per combat"; the GI JOE, MLP and Night Vale ones "once per scene".
const digDeepWindow = sourceId => (sourceId == DIG_DEEP_TF_ID ? 'encounter' : 'scene');

// Timeline Anomaly (Welcome to Night Vale: Citizens' Guide, General Perk, p.47, Weird +d8) - see
// helpers/timeline-anomaly.mjs's own doc comment. Once per scene (approximating "once per
// session"), dispatched directly here since it's neither a bankable nor an ally-heal.
const TIMELINE_ANOMALY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.NQXcQL05DLCs75xb";
const TIMELINE_ANOMALY_ENCOUNTER_FLAG = 'timelineAnomalyUsedThisEncounter';

// After You (MLP CRB, Spirit of Generosity, 6th level, p.76): "when you roll for Initiative, you
// can swap places in the Initiative order with a friend who rolled lower than you." Reuses
// Timeline Anomaly's own swapInitiativeWithTarget, just with requireLowerTarget set and no
// once-per-encounter cap (RAW states none, unlike Timeline Anomaly's own once/session limit).
const AFTER_YOU_ID = "Compendium.essence20.mlp_crb.Item.CjNQHWxMjTQfcLTZ";

// Quick Study (Welcome to Night Vale: Citizens' Guide, General Perk, p.50) - see
// helpers/quick-study.mjs's own doc comment. A pure information reveal, dispatched directly here
// since it's neither a bankable nor an ally-heal.
const QUICK_STUDY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.adJm4dpjD04TICkd";
const QUICK_STUDY_ENCOUNTER_FLAG = 'quickStudyUsedThisEncounter';

// Eye for Appraisal (Decepticon Directive Raider, 1st level, p.61) - see
// helpers/eye-for-appraisal.mjs's own doc comment. Marks whichever token is currently targeted
// (like Mark Target), so it's dispatched directly here too rather than through either table below.
const EYE_FOR_APPRAISAL_ID = "Compendium.essence20.decepticon_directive.Item.JlwxiwZDpq7UkYXn";

// Wrestler (PR CRB, General Perk, p.99) - see helpers/wrestler-pin.mjs's own doc comment. Same
// "marks whichever token is currently targeted" shape as Eye for Appraisal just above.
const WRESTLER_PIN_ID = "Compendium.essence20.pr_crb.Item.7QMuaLPZJWNPJHTz";

// Weapon Conversion (Decepticon Directive Raider, Acquisitions Expert Focus, 10th level, p.63) -
// see helpers/weapon-conversion.mjs's own doc comment. A one-time, permanent item.update() (not a
// toggle or a banked bonus), so it's dispatched directly here too.
const WEAPON_CONVERSION_ID = "Compendium.essence20.decepticon_directive.Item.WbXurpieXjFkmS8h";

// Stand Behind Me! (Across the Stars, Gold Ranger, 7th level, p.53): "Spend 1 Personal Power to
// force all enemies within 60 feet to make you the target of their attacks unless they succeed on
// a DIF 14 Alertness Skill Test." Neither a bank-now/consume-later shiftUp nor an ally-heal, so
// it's dispatched directly here too. This system has no NPC-targeting AI to actually force an
// enemy's attack choice (same limitation every other "enemies must..." Perk in this project - Fear
// My Name, Prepare for War, etc. - already accepts), so the only concretely automatable half is
// the Power spend itself plus a round-scoped "taunting" flag (same shape as Team Focus's own
// round flag) recording that this Ranger called it - visible on the actor for a GM to honor
// manually, and available for a future mechanic to read back if one's ever built on top of it.
const STAND_BEHIND_ME_ID = "Compendium.essence20.across_the_stars.Item.PcezfGdjUtNUZHYH";
const STAND_BEHIND_ME_FLAG = 'standBehindMeActive';

// Power Boost (Across the Stars, Silver Ranger, 3rd/10th/17th level, p.57) - see
// helpers/power-boost.mjs's own doc comment. An on/off toggle (not a bank-once, ally-heal, or
// self-grant), dispatched directly here like Dig In, but with an affordability gate on the way IN
// (2 Personal Power) rather than none at all.
const POWER_BOOST_ID = "Compendium.essence20.across_the_stars.Item.m3Kh8PqGf3O1oMmc";

// Lance of Light (A Jump Through Time, General Perk, p.55) - see helpers/lance-of-light.mjs's own
// doc comment. Same on/off toggle shape and affordability gate as Power Boost just above.
const LANCE_OF_LIGHT_ID = "Compendium.essence20.jump_through_time.Item.HUdL1MryICmRmWnP";

// Grid Surge (Across the Stars, Silver Ranger, 2nd level, p.57) - see helpers/grid-surge.mjs's own
// doc comment. Neither bankable nor an ally-heal (and its own resource is a rolePoints spend, not
// Power/Health), so it's dispatched directly here too - spends one use of the actor's own Grid
// Surges resource (found via the same generic actor._getBaseRolePoints() lookup Heart of the Team
// already uses), then prompts for which option to trigger.
const GRID_SURGE_ID = "Compendium.essence20.across_the_stars.Item.PEDHPJkoGvvJed5u";

// Power Adaptation (Across the Stars, Silver Ranger, 9th/18th level, p.57) - see
// helpers/power-adaptation.mjs's own doc comment. Neither bankable nor an ally-heal, and unlike
// Grid Surge/Power Boost above, WHICH option this activates is fixed per-item (this Perk's own
// system.choice, picked once at drop time via the new 'powerAdaptation' choiceType in
// perk-handler.mjs) rather than picked fresh on every use - dispatched directly here too.
const POWER_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.S7Qs6bJOVkVFxlFu";

// Phantom Suite (Across the Stars, Phantom Ranger, 1st/7th/12th/17th level, p.60) - see
// helpers/phantom-suite.mjs's own doc comment. An on/off toggle costing Power only to switch ON
// (same dispatch shape as Power Boost), dispatched directly here too.
const PHANTOM_SUITE_ID = "Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K";

// Ageless Knowledge (Across the Stars, Phantom Ranger, 6th level, p.61) - see
// helpers/ageless-knowledge.mjs's own doc comment. Spends 1 Personal Power, prompts for a Skill,
// and banks the choice - neither bankable's own shiftUp/edge shape nor an ally-heal, so it's
// dispatched directly here too.
const AGELESS_KNOWLEDGE_ID = "Compendium.essence20.across_the_stars.Item.peGPrJKYlx79ybbu";

// Phantom Focus (Across the Stars, Phantom Ranger, 10th/15th level, p.62) - a single permanent
// choice per instance (like Power Adaptation - see its own comment above), recorded as
// system.choice via the new 'phantomFocus' choiceType in perk-handler.mjs. Of its 5 named
// options, only Healing Light has a "Use" button at all (Boosted Vigor/Phase Defense are passive
// - see documents/actor.mjs's onMorph and dice.mjs's own per-target checkEntries construction
// respectively; Multiversal Pocket/Ship Integration are narrative/infra-gapped with nothing to
// click either way) - dispatched here by reading this item's own system.choice rather than by
// sourceId alone, since every Phantom Focus instance shares the same compendium id regardless of
// which option was picked.
const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";

// Through the Arches (Across the Stars, Phantom Ranger, 18th level, p.63) - see
// helpers/through-the-arches.mjs's own doc comment. Spends 2 Personal Power and marks every
// currently-targeted companion without the Perk - neither bankable's own shape nor a single-ally
// heal, so it's dispatched directly here too.
const THROUGH_THE_ARCHES_ID = "Compendium.essence20.across_the_stars.Item.f372LpDqqiO2XoEi";

// Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68) - see helpers/rush-the-line.mjs's
// own doc comment. Same once-per-turn shape as Menacing Laugh above, but a Story Point spend
// (via the GM-relay mechanism Withering Fire/Dependable Tanker/Read The Land already established)
// instead of Terror.
const RUSH_THE_LINE_ID = "Compendium.essence20.intercontinental_adventures.Item.va1HF5CudO4WsguB";
const RUSH_THE_LINE_TURN_FLAG = 'rushTheLineUsedThisTurn';

// Engine Override (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.72) - see
// helpers/engine-override.mjs's own doc comment. A plain "Use" button dispatch, no cost/gate at
// all (RAW names no Personal Power/Story Point spend for this Perk).
const ENGINE_OVERRIDE_ID = "Compendium.essence20.intercontinental_adventures.Item.rouaWvDWhwCB5XEO";

// Jury Rig (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73) - see
// helpers/jury-rig.mjs's own doc comment. A plain "Use" button dispatch (no Power/Story Point
// cost - the cost here is the Technology Skill Test itself) that opens a picker and triggers a
// real roll, rather than a bank-now/consume-later shape.
const JURY_RIG_ID = "Compendium.essence20.intercontinental_adventures.Item.PV4QvqJgT1orMm1D";

// Spot Weld (Decepticon Directive, General Perk, p.67) - see helpers/spot-weld.mjs's own doc
// comment. canUsePerk delegates entirely to canUseSpotWeld (once-per-scene + an Energon Point
// available) - the actual spend happens inside activateSpotWeld itself once a valid target is
// also confirmed, same split self-revive.mjs's own canUseSelfRevive/activateSelfRevive uses.
const SPOT_WELD_ID = "Compendium.essence20.decepticon_directive.Item.4GYOdopDcXS8lgGI";

// Improvise Armor (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.73) - see
// helpers/improvise-armor.mjs's own doc comment. Once per scene, no other cost - the Skill Test
// itself is the "cost."
const IMPROVISE_ARMOR_ID = "Compendium.essence20.intercontinental_adventures.Item.P9JXwQ2991e1Bw1G";

// Martial Leadership (Enigma of Combination, General Perk, p.41) - see
// helpers/martial-leadership.mjs's own doc comment. A plain "Use" button dispatch, no cost/gate
// at all (RAW names no Power/Story Point spend for this Perk, just the Standard action itself).
const MARTIAL_LEADERSHIP_ID = "Compendium.essence20.enigma_of_combination.Item.6dRdxCRjWqjrt8Wc";

// Voice of Primus (Enigma of Combination, General Perk, p.41) - see
// helpers/voice-of-primus.mjs's own doc comment. A plain "Use" button dispatch, no cost/gate at
// all (RAW names no Power/Story Point spend, just the Standard action itself).
const VOICE_OF_PRIMUS_ID = "Compendium.essence20.enigma_of_combination.Item.m8oHzT4BUB79NiVw";

// Words Can Hurt! (Enigma of Combination, Counselor Focus, Scientist, 6th level, p.34) - see
// helpers/words-can-hurt.mjs's own doc comment. A plain "Use" button dispatch, no cost/gate at
// all (RAW names no Power/Story Point spend, just the Standard action itself).
const WORDS_CAN_HURT_ID = "Compendium.essence20.enigma_of_combination.Item.SBoujesTRdI7IpmM";

// Calming Words (Enigma of Combination, Counselor Focus, Scientist, 3rd level, p.34) - see
// helpers/calming-words.mjs's own doc comment. A plain "Use" button dispatch, gated only on
// affording the Energon cost when the player picks the Cure action (checked inside
// activateCalmingWords itself, after the up-front action/Defense picker, since the cost only
// applies to one of its two actions).
const CALMING_WORDS_ID = "Compendium.essence20.enigma_of_combination.Item.r3slLsGwSfXUiD94";

// Powerful Suggestions (Enigma of Combination, Counselor Focus, Scientist, 17th level, p.34) -
// see helpers/powerful-suggestions.mjs's own doc comment. A plain "Use" button dispatch, no
// cost/gate at all (RAW names no Power/Story Point spend, just the conversation itself).
const POWERFUL_SUGGESTIONS_ID = "Compendium.essence20.enigma_of_combination.Item.QRGflsYQcDN16l10";

// Data Bridge (Enigma of Combination, Hub Focus, Analyst, 1st level, p.29) - see
// helpers/data-bridge.mjs's own doc comment. A Free action, once per turn, gated on there
// actually being a Specialization available to borrow.
const DATA_BRIDGE_ID = "Compendium.essence20.enigma_of_combination.Item.uLtZ0zbfx0K4jcSK";
const DATA_BRIDGE_TURN_FLAG = 'dataBridgeUsedThisTurn';

// Misery Loves Company (Enigma of Combination, Hub Focus, Analyst, 17th level, p.29) - see
// helpers/misery-loves-company.mjs's own doc comment. A Free action, 1 Energon Point, gated on
// there being both an afflicted ally to cure and a Data-Bridged ally to receive the Condition.
const MISERY_LOVES_COMPANY_ID = "Compendium.essence20.enigma_of_combination.Item.JJ8ffuxjYeXJ9KJ2";

// Work the Numbers (Transformers CRB, Scout base, Cybertronian Perk, p.58) - see
// helpers/work-the-numbers.mjs's own doc comment. Spends 1 Energon Point, dispatched directly
// here since the combat-tracker reorder itself lives in that file, not a table entry.
const WORK_THE_NUMBERS_ID = "Compendium.essence20.tf_crb.Item.aFgXXk1gMMb4saVf";

// Archkey (A Jump Through Time, Equipment, p.66): "A character can activate an archway with an
// archkey with a simple DIF 10 Technology (Grid Tech) Skill Test." Same "trigger a real flat-DIF
// roll via actor._dice.rollSkill()" shape Humanitarian/I Know A Guy already establish - the
// Specialization parenthetical needs no special handling, since the Roll Options Dialog already
// lets the player declare Specialized themselves. "Being in the same scene as an open Master Arch
// regenerates 1 Personal Power to anything that can store it" is NOT built - this needs a genuinely
// new scene-persistent, ongoing-per-round regen source affecting every actor on the scene (not just
// the activator), a different shape from every existing once-now/consumed-later banked effect in
// this codebase - logged as a follow-up rather than forced into the wrong shape.
const ARCHKEY_ID = "Compendium.essence20.jump_through_time.Item.EEZUFQIGfeLhT2qX";

// Engine Cells (A Jump Through Time, R.P.M. Sidearm Equipment, p.70): "a Power Ranger could drain
// an engine cell directly to regain 2d2 Personal Power as a Standard action." A `gear`-type item,
// same quantity-decrement-then-delete-at-0 idiom as Energon Cube/Energon Snack above, but a rolled
// amount (Healing Light's own rollsHeal shape, just targeting Personal Power instead of Health) -
// dispatched directly here since it's a single-purpose item with no other table to join. The
// item's other two clauses ("transform miniaturized attack Zords into full-size Zords" and
// "power the combined forms of different R.P.M. Sidearms... double Attacks") describe equipping/
// build-time choices, not a Use-button resource spend, and are unbuilt for that reason.
const ENGINE_CELLS_ID = "Compendium.essence20.jump_through_time.Item.Q8TO2TJNncmy6Q6R";

// Energon Cube (Decepticon Directive, Equipment, p.78): "One cube holds 2 Energon Points, which
// can be siphoned at the regular rate of 1 Energon Point per Free action." A `gear`-type item, the
// first consumable equipment item in this project to grant a resource on Use rather than a Perk
// doing so - joins canUsePerk's own type allowlist alongside 'upgrade' (Force Field), safe for the
// same reason: a gear item absent from BANKABLE_PERKS/IMMEDIATE_ALLY_PERKS/this direct-dispatch
// list still falls through to no button. Approximated as one click granting the cube's whole 2
// Energon Points at once and consuming the whole cube, rather than modeling 2 separate per-Free-
// action siphons off one item (this project's usual "flatten a multi-step narrative action into
// one click" idiom, e.g. Magic Baubles' own single-roll-then-consume shape in item.mjs) - same
// quantity-decrement-then-delete-at-0 idiom as a Magic Bauble.
const ENERGON_CUBE_ID = "Compendium.essence20.decepticon_directive.Item.5p3lMU4vT7kUodp5";

// Energon Snack (Decepticon Directive, Equipment, p.79): "One snack holds a single Energon Point,
// which can be consumed as a Free action." Same shape as Energon Cube above, 1 Energon Point
// instead of 2.
const ENERGON_SNACK_ID = "Compendium.essence20.decepticon_directive.Item.y72ZEiWUa3AYxcXl";

// I Got You (Enigma of Combination, Team Leader Focus, 3rd level, p.30): "once each round, you
// can spend 1 Energon Point to give your teammate an upshift 1 on any Skill Test, even when it is
// not your turn." Same plain target:'ally'/fixedShiftUp shape as Plan of Action/Personal
// Sacrifice, just gated on the new energonCost/onceRoundFlag fields instead of powerCost/
// onceTurnFlag. The "always Lend Assistance within 60ft" half isn't automated - this project has
// no full Lend Assistance action, only the narrow Spot-triggered slice built earlier.
const I_GOT_YOU_ID = "Compendium.essence20.enigma_of_combination.Item.h8DuSX4N1buJb6uN";

// Like Water (Factions in Action Vol. 2, General Perk, p.30) - see helpers/like-water.mjs's own
// doc comment. A Standard action, no other cost - available while either of its two built
// once-per-Combat clauses hasn't been used yet.
const LIKE_WATER_ID = "Compendium.essence20.intercontinental_adventures.Item.HSjShnVmoDdzEDT1";

// Impossible Expectations (Cobra Codex, Officer Be Ruthless replacement Perk, p.56): "The turn
// after a Cobra in your unit is Defeated, you can spend a Story Point to give them 1 Health."
// Targets the currently-targeted actor (this project's usual target-resolution idiom); "the turn
// after... is Defeated" is read directly off their current Health (0) rather than tracked
// separately - simpler and equivalent in practice, since nothing else would make their Health
// exactly 0 without them being Defeated.
const IMPOSSIBLE_EXPECTATIONS_ID = "Compendium.essence20.cobra_codex.Item.98rFJyzaoCWrLdbF";

// Smashmouth Offense (Cobra Codex, Vanguard Be Ruthless replacement Perk, p.68): "Once per combat
// when you deal damage to a creature but don't Defeat it, you can spend a Story Point to deal 1
// additional damage." The "dealt damage but didn't Defeat" precondition can't be checked
// automatically after the fact (damage is applied later, via chat.mjs's own Apply Damage button,
// by which point the roll pipeline has already finished) - reframed as a pre-declared bank/
// consume instead (same self-policed idiom as Can't Afford to Miss above): click Use before your
// attack, once per combat, and the +1 damage applies to your next successful damaging hit.
const SMASHMOUTH_OFFENSE_ID = "Compendium.essence20.cobra_codex.Item.3OPswxxHjsYrQggY";
const SMASHMOUTH_OFFENSE_ENCOUNTER_FLAG = 'smashmouthOffenseUsedThisEncounter';
export const SMASHMOUTH_OFFENSE_FLAG = 'pendingSmashmouthOffense';

// Study Weaknesses (Cobra Codex, Technician Be Ruthless replacement Perk, p.66): "As a Free
// action, you can spend a Story Point to learn which of a target's Defenses is their lowest (or
// one of their lowest if tied)." Targets the currently-targeted actor, reveals the answer via a
// chat card (postPerkUseChatCard's own generic notification shape, reused for the actual reveal
// text instead of a bespoke new string).
const STUDY_WEAKNESSES_ID = "Compendium.essence20.cobra_codex.Item.AIkpuWVylCFyuLuX";

// Shadow / Silent Strider (GI Joe CRB, Infiltrator Focus, p.75) - see helpers/infiltrating.mjs's
// own doc comment. Both key off the same shared "Infiltrating" toggle; either Perk's own "Use"
// button flips it. Reused the generic E20.PerkUsedNotification template for the chat
// confirmation rather than a dedicated E20.InfiltratingActivated/Deactivated pair (this pass
// can't add new lang.json strings).
const SHADOW_ID = "Compendium.essence20.gi_joe_crb.Item.PDiRwnTcNCtzJbDn";
const SILENT_STRIDER_ID = "Compendium.essence20.gi_joe_crb.Item.C3KxTD37krYavSgw";

// Absolute Menace (Beneath the Helmet, Dark Ranger, 18th level, p.40) - see
// helpers/absolute-menace.mjs's own doc comment. "When you start your turn" approximated as
// once-per-turn (hasUsedThisTurn/markUsedThisTurn, same idiom as Menacing Laugh above), gated on
// affording 2 Personal Power - dispatched directly here since it triggers a whole roll rather
// than banking a flag or healing an ally.
const ABSOLUTE_MENACE_ID = "Compendium.essence20.beneath_the_helmet.Item.YsoS30FKigTm19CH";
const ABSOLUTE_MENACE_TURN_FLAG = 'absoluteMenaceUsedThisTurn';
const AVALANCHE_STOMP_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.NyK58rUo6jiwX5Aq";

// Frightening Display (Enigma of Combination, Cannoneer Focus, Gunner, 10th level, p.32) - see
// helpers/frightening-display.mjs's own doc comment. No Power cost, just the Standard action
// itself (RAW names no per-scene/per-turn cap either) - dispatched directly here since it triggers
// a whole roll rather than banking a flag or healing an ally.
const FRIGHTENING_DISPLAY_ID = "Compendium.essence20.enigma_of_combination.Item.8NJtMXvcK3YDnwY4";

// Fight Me! (Beneath the Helmet, Graphite Ranger, 2nd level, p.46) - see helpers/fight-me.mjs's
// own doc comment. Marks whichever token is currently targeted (like Mark Target), so it's
// dispatched directly here too rather than through either table below.
const FIGHT_ME_ID = "Compendium.essence20.beneath_the_helmet.Item.7ovAtv0r6UaAsmHE";

// A Logical Explanation (WTNV Citizen's Guide, Scientist Role, University Of What It Is Focus,
// p.46) - see helpers/a-logical-explanation.mjs's own doc comment.
const A_LOGICAL_EXPLANATION_ID = "Compendium.essence20.wtnv_citizens_guide.Item.CiDQxCxgnnosvBDo";

// Bumper Crop (WTNV Citizen's Guide, Farmer Role, Tiller Focus, p.37) - see
// helpers/bumper-crop.mjs's own doc comment.
const BUMPER_CROP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5GDpvzG3x2ZgrrQj";

// Gravity Optional (WTNV Citizen's Guide, Soldier Role, Blood Space War Veteran Focus, p.37) - see
// helpers/gravity-optional.mjs's own doc comment.
const GRAVITY_OPTIONAL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.F5mrzupd6TG2kj3x";

// "Pseudo"-Science (WTNV Citizen's Guide, Scientist Role, Night Vale Community College Focus,
// p.44) - see helpers/pseudo-science.mjs's own doc comment.
const PSEUDO_SCIENCE_ID = "Compendium.essence20.wtnv_citizens_guide.Item.MTo42tKWWtZ15Ist";

// Duty Of The Graphite (Beneath the Helmet, Graphite Ranger, 7th level, p.47) - see
// helpers/duty-of-the-graphite.mjs's own doc comment. Spends 1 Grid Surge (same generic
// actor._getBaseRolePoints() lookup Heart of the Team/Grid Surge itself already use) + 2 Personal
// Power, then triggers a whole roll rather than banking a flag - dispatched directly here.
const DUTY_OF_THE_GRAPHITE_ID = "Compendium.essence20.beneath_the_helmet.Item.Rr7ucZahtHI9yXwA";

// Your Safety's On (Quartermaster's Guide to Gear, General Perk, p.31) - see
// helpers/your-safetys-on.mjs's own doc comment. No resource cost beyond the Standard action
// itself (unenforced, the standing action-economy gap) - always available.
const YOUR_SAFETYS_ON_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.CLwsh2pCwbrgYGru";

// Trigger Reaction (General Hawk's Personnel Files, General Perk, p.174) - see
// helpers/trigger-reaction.mjs's own doc comment. No resource cost, no frequency cap - always
// available, same shape as Your Safety's On.
const TRIGGER_REACTION_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.PItQuRGhxq4lMT3P";

// Uninterrupted Break (Quartermaster's Guide to Gear, General Perk, p.28) - see
// helpers/uninterrupted-break.mjs's own doc comment.
const UNINTERRUPTED_BREAK_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1vrQxY1nzjMjeU7D";

// Tender (MLP CRB, Spirit of Kindness, 6th level, p.85) - see helpers/tender.mjs's own doc
// comment. No Power cost or frequency cap in RAW, so canUsePerk just gates on the actor actually
// having made an Empathy choice to roll with.
const TENDER_ID = "Compendium.essence20.mlp_crb.Item.xR4z6mV7Ab72TyVs";

// Elemental Storm (Beneath the Helmet, Aqua Ranger, 10th level, p.42, replaces Power Burst) - see
// helpers/elemental-storm.mjs's own doc comment. "Once per scene" -> hasUsedThisEncounter/
// markUsedThisEncounter (this codebase's widest no-day/long-rest-scoped gate, same idiom as every
// other "once per scene/day" Perk). Dispatched directly here since it triggers a whole roll (with
// its own up-front Condition-choice picker) rather than banking a flag or healing an ally.
const ELEMENTAL_STORM_ID = "Compendium.essence20.beneath_the_helmet.Item.6IoMpj8pWmP8IpH4";
const ELEMENTAL_STORM_ENCOUNTER_FLAG = 'elementalStormUsedThisEncounter';

// Brute Force (Beneath the Helmet, Graphite Ranger, 3rd/10th/17th level, p.47 - replaces Power
// Boost) - the exact same "spend 2 Power to activate, +N Blunt damage on Power Weapon Attacks
// while active" shape as Power Boost itself (a Role reprint swap, not a new mechanic), so this
// reuses helpers/power-boost.mjs's own shared toggle flag directly rather than duplicating it - a
// Graphite Ranger's Role replaces Power Boost with Brute Force outright, so an actor never holds
// both at once and there's no risk of the shared flag meaning two different things at the same
// time. dice.mjs's own damageBonusValue computation looks up whichever of the two Perks the actor
// actually has. The "forego 1 point of damage for a Snag-vs-others effect" clause isn't built -
// a genuinely separate choice-on-top-of-the-toggle this batch doesn't include.
const BRUTE_FORCE_ID = "Compendium.essence20.beneath_the_helmet.Item.3XP5RgmeyQwE5HH9";

const JUMP_THROUGH_TIME = "Compendium.essence20.jump_through_time.Item.";

// Orange Ranger Prime (A Jump Through Time, 20th level, p.34): "regain 2d2 Personal Power once
// per scene." Self-only (unlike One For All/Power Burst's own team-buffs.mjs broadcast shape), so
// dispatched directly here - once-per-scene via hasUsedThisEncounter/markUsedThisEncounter, same
// idiom as Elemental Storm/Curb Your Enthusiasm above. Its own "+2 all Defenses" bullet is already
// a compendium Active Effect; the reciprocal "Enemies suffer Snag targeting your Cleverness
// Defense" bullet hits the exact same architectural gap already documented for Silver Ranger
// Prime's identical Willpower-Snag bullet and Graphite Ranger Prime's identical Cleverness-Snag
// bullet - _getAutomaticCombatModifiers runs BEFORE the Roll Options Dialog resolves
// skillRollOptions.defenseType, so there's no point to retroactively force a Snag onto it - left
// unbuilt, consistent with that precedent, not a new gap.
const ORANGE_RANGER_PRIME_ID = `${JUMP_THROUGH_TIME}8s9HHpmk633e6PLM`;
const ORANGE_RANGER_PRIME_ENCOUNTER_FLAG = 'orangeRangerPrimeUsedThisEncounter';

// Comic Flair (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32) - see
// helpers/comic-flair.mjs's own doc comment. A plain "Use" button, no cost/gate, acting on
// whichever token is currently targeted - dispatched directly here like Mark Target/Fight Me!.
const COMIC_FLAIR_ID = `${JUMP_THROUGH_TIME}Ux2eueBLxKgzD2Kd`;

// Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32) - see
// helpers/powered-plating.mjs's own doc comment. Morphed-only, gated on actually having Power to
// spend - the picker itself handles the "how much" choice, so canUsePerk only needs to confirm
// there's something to spend at all.
const POWERED_PLATING_ID = `${JUMP_THROUGH_TIME}45WHjwO125zTvuGR`;

// Grid Soldier (A Jump Through Time, General Perk, p.54) - see helpers/grid-soldier.mjs's own doc
// comment. Free action, spend 1 Personal Power, remove Impaired from self or a nearby ally - the
// Threat-Level shiftUp half lives in dice.mjs instead.
const GRID_SOLDIER_ID = "Compendium.essence20.jump_through_time.Item.y9F6PkCIw7g6tiqL";

// Paradox (A Jump Through Time, Influence Perk, p.21) - see helpers/paradox.mjs's own doc comment.
// Once per session (approximated as once per encounter), pick a Skill and bank a shiftUp on it.
const PARADOX_ID = "Compendium.essence20.jump_through_time.Item.TYebczV8RvTTbWnL";
const PARADOX_ENCOUNTER_FLAG = 'paradoxUsedThisEncounter';

// Explosive Morph (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45) - see
// helpers/explosive-morph.mjs's own doc comment. Dispatched directly here (a whole roll, not a
// bank/ally-heal), gated on actually being Morphed - the narrative trigger ("when you activate
// Quantum Morph") is approximated as "any time while Morphed," the same trust-the-player idiom
// Powered Plating's own Morphed-only gate already establishes.
const EXPLOSIVE_MORPH_ID = `${JUMP_THROUGH_TIME}ExplosiveMorphJT`;

const THROUGH_THE_SHATTERED_GRID = "Compendium.essence20.through_the_shattered_grid.Item.";

// Eltarian Mettle (Through the Shattered Grid, Guardian of Eltar, 7th level, p.72) - see
// helpers/eltarian-mettle.mjs's own doc comment. No once-per-X gate (RAW's only limit is the
// Power cost itself).
const ELTARIAN_METTLE_ID = `${THROUGH_THE_SHATTERED_GRID}bDgQ7jyTgisY42kt`;

// Balance and Harmony (Factions in Action Vol. 2, Arashikage Faction Perk, p.9) - see
// helpers/balance-and-harmony.mjs's own doc comment. Dispatched directly here (a self-only
// picker, no Power cost, once per scene), same shape as Eltarian Mettle just above.
const BALANCE_AND_HARMONY_ID = "Compendium.essence20.intercontinental_adventures.Item.YydXnrEdfZpl6DU6";

// Nu, Pogodi!'s own condition-removal clause (Factions in Action Vol. 2, Oktober Guard Faction
// Perk, p.68) - see helpers/nu-pogodi.mjs's own doc comment. No Power cost, once per encounter
// (approximating "once per mission").
const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";

// The Quiet One (Factions in Action Vol. 2, Dreadnok General Perk, p.63) - see
// helpers/quiet-one.mjs's own doc comment. Dispatched directly here (a self-only banked Edge, no
// cost beyond the Free action itself, gated on a nearby noisy ally this round).
const THE_QUIET_ONE_ID = "Compendium.essence20.intercontinental_adventures.Item.eKmiGE7NChwZ2E96";

// Wisdom of the Elders (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72) - see
// helpers/wisdom-of-the-elders.mjs's own doc comment.
const WISDOM_OF_THE_ELDERS_ID = `${THROUGH_THE_SHATTERED_GRID}SB6FAYA0qIqV9F3G`;

// Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72) - see
// helpers/observer.mjs's own doc comment. A single-purpose on/off toggle, the same shape as Power
// Boost.
const OBSERVER_ID = `${THROUGH_THE_SHATTERED_GRID}PTkqeQ8D4x9cstlZ`;

// Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - see
// helpers/supreme-guardian.mjs's own doc comment (bullet 1 only - the AoE Technology-vs-Toughness
// Blind on Morph). No Power cost per RAW's own wording (unlike Absolute Menace/Elemental Storm's
// identical AoE shape, both of which do cost Power) - gated only on being Morphed, since RAW
// frames this as something that happens "when you Morph" rather than a standalone spend. Dispatched
// directly here (triggers a whole roll, not a banked flag or ally heal) - no once-per-turn/scene
// gate either, matching RAW's lack of a stated frequency limit (a player would naturally only
// trigger this once per Morph anyway, the same trust-the-fiction idiom Explosive Morph's own
// Morphed-only gate already established).
const SUPREME_GUARDIAN_ID = `${THROUGH_THE_SHATTERED_GRID}wrBndkBQoKkn3dLy`;

// Combat Stance (Through the Shattered Grid, Magna Defender, 1st level, p.23-24) - see
// helpers/combat-stance.mjs's own doc comment. Dispatched directly here (declares a target-marking
// flag, not a banked shiftUp/edge or ally heal) - canUsePerk gates on canDeclareCombatStance
// (always true with Continuous Stance, otherwise once per scene).
const COMBAT_STANCE_ID = `${THROUGH_THE_SHATTERED_GRID}R2C760BXAI1XKVtm`;

// At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25) - see
// helpers/at-all-cost.mjs's own doc comment. A toggle (once per scene to switch ON, same
// hasUsedThisEncounter idiom as Elemental Storm/Curb Your Enthusiasm above, free to switch back
// OFF or once it auto-deactivates on its own).
const AT_ALL_COST_ID = `${THROUGH_THE_SHATTERED_GRID}TGnqQAWWi1hBGqeh`;

/**
 * "Bank a bonus now, spend it on a Skill Test you haven't rolled yet" Perks - Think On It and
 * Plan of Action share this exact shape (see perks.mjs's own bankPendingBonus/getPendingBonus/
 * clearPendingBonus), but until now nothing on the actor sheet let a player actually trigger
 * one - every other Perk automated in this system either fires off an existing roll/attack
 * automatically, or is a passive always-on check. This file is the one new piece: a "Use"
 * control (wired in essence20.mjs's Handlebars helper + a sheet click listener) for whichever
 * Perks are in the table below, plus the (self or ally) targeting logic for actually banking the
 * bonus once clicked.
 *
 * Alpha Strike (Renegade/Door-Kicker Focus, 3rd level, p.98) was originally scoped alongside
 * these two, but its own text - "you can Alpha Strike IF you are attacking an enemy within your
 * reach or within 20 feet... when you USE Alpha Strike, you gain an Edge..." - ties the choice to
 * the moment of a qualifying attack roll, not a standalone Free/Move action taken independent of
 * one. That's a Roll Options Dialog checkbox (the same shape Quiet as the Grave's own
 * applyDamageDouble toggle already uses), not a sheet "Use" button - a genuinely different UI
 * than the other two, so it's deliberately left out of this file rather than forced into a
 * button click it doesn't fit. Not yet built.
 *
 * Consumption is NOT here - see dice.mjs#_getAutomaticCombatModifiers, which reads these same
 * flagKeys back on the actor's (or the chosen ally's) next roll, the same self-status section
 * Debilitating Strike/Who Dares Wins already use.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const PR_CRB = "Compendium.essence20.pr_crb.Item.";

// Quick Study (GI Joe CRB, Technician, 1st level, p.102): "Once per scene, you may use a Free
// action to learn the Toughness, Evasion, Willpower, or Cleverness score of a target that you can
// see." Reuses WTNV Citizens' Guide's own identically-named, identically-shaped Perk's dispatch
// (see QUICK_STUDY_ID above) - revealTargetDefenses always reveals all four Defenses at once
// rather than building a separate one-of-four picker for this book's slightly narrower "or"
// wording, the same accepted over-granting simplification used throughout this project.
const GIJ_QUICK_STUDY_ID = `${GI_JOE_CRB}IoOFcSJK3sHLAbgR`;

// Fast Learner (GI Joe CRB, Technician/Tinkerer Focus, 1st level, p.106) - see
// helpers/fast-learner.mjs's own doc comment. A standing reallocation, dispatched directly here
// (neither a bankable nor an ally-heal).
const FAST_LEARNER_ID = `${GI_JOE_CRB}u3KK0V30GXDdRPAY`;

// Castling (GI Joe CRB, Grandmaster Focus, 10th level, p.87) - see helpers/castling.mjs's own doc
// comment. Dispatched directly here (an immediate 2-ally effect, not a bank-now/consume-later
// flag, so it doesn't fit BANKABLE_PERKS' single-target shape).
const CASTLING_ID = `${GI_JOE_CRB}eB7jbgbevLVPxW4e`;

// Danger Sense (GI Joe CRB, Bodyguard Focus, 6th level, p.110) - see helpers/danger-sense.mjs's
// own doc comment. The Protected-Target Initiative-sync half only, dispatched directly here.
const DANGER_SENSE_ID = `${GI_JOE_CRB}2hwFRZ67xIGt1XTm`;

// Mysterious Aura (A Jump Through Time, White Spectrum Modification, replaces Follow Me!, p.45) -
// see helpers/mysterious-aura.mjs's own doc comment. Dispatched directly here (a Power-costing
// toggle-with-a-picker, like Grid Surge, not a plain bank-and-consume flag).
const MYSTERIOUS_AURA_ID = `${PR_CRB}hSu10Kgj9g1LSmyv`;

// Electromagnetic Disruption (Technorganic Secrets, Technorganic Influence Perks, p.47) - see
// helpers/electromagnetic-disruption.mjs's own doc comment. Only findPerk's own choice=='pulse'
// case gets a working "Use" button - the 'weaponTrait' option exists on the sheet but has no
// mechanic behind it, same idiom as every other unautomated-but-still-selectable choice.
const ELECTROMAGNETIC_DISRUPTION_ID = "Compendium.essence20.technorganic_secrets.Item.EmJaaHzoEYtWhchj";

// Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76) - see helpers/perfect-disguise.mjs's
// own doc comment. A single-purpose on/off toggle, but gated on a once-per-encounter use (RAW's
// "once per Mission," approximated down) instead of a Power spend, the same shape as Curb Your
// Enthusiasm's own once-per-scene gate.
const PERFECT_DISGUISE_ID = `${GI_JOE_CRB}ELktMVNYsiBPTX2c`;

// At All Costs (PR CRB, Green/White Ranger, 18th level, p.34/63) - textually identical to Magna
// Defender's own "At All Cost" (see AT_ALL_COST_ID's own comment above, confirmed against real
// RAW text for both Roles), and a single shared compendium item between the two Roles
// (`UFwnD2CsWCWXlUyf` in prcrbitems' own system.items maps) - not two separate items. Dispatches
// to the exact same helpers/at-all-cost.mjs toggle, the same "one Role's own Perk reprints
// another's mechanic" reuse Brute Force's own dispatch to Power Boost's toggle already established.
const PR_CRB_AT_ALL_COSTS_ID = `${PR_CRB}UFwnD2CsWCWXlUyf`;
const ACROSS_THE_STARS = "Compendium.essence20.across_the_stars.Item.";
// Omega Enhancement (Form) (Across the Stars, General Perk, p.70) - see
// helpers/omega-enhancement.mjs's own doc comment. A plain "Use" button dispatch, gated on
// affording 1 Personal Power (activateOmegaEnhancement itself re-checks and returns false if not,
// same defensive-recheck idiom as several other Power-costing "Use" buttons).
const OMEGA_ENHANCEMENT_ID = `${ACROSS_THE_STARS}8GtRpU81iPJUCBEw`;
const WTNV_CITIZENS_GUIDE = "Compendium.essence20.wtnv_citizens_guide.Item.";
const GENERAL_HAWKS_PERSONNEL_FILES = "Compendium.essence20.general_hawk_s_personel_files.Item.";

// Skier (General Hawk's Personnel Files, General Perk, p.175) - see helpers/skier.mjs's own doc
// comment for why this is a manual on/off toggle (Dig In's own shape) rather than an unconditional
// compendium Active Effect like Diver/Rock Climber's own superficially-similar Movement bonuses.
const SKIER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}dvmY7UiuKejOPY4N`;
const ITS_TIME_ID = "Compendium.essence20.field_guide_action_adventure.Item.HT4iCNp5WIWXR5bJ";

// Soothe (General Hawk's Personnel Files, General Perk, p.175) - see helpers/soothe.mjs's own doc
// comment. Same "trigger a real dialog roll via actor._dice.rollSkill()" shape A Logical
// Explanation already established - a plain "Use" button with no gate.
const SOOTHE_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}vzTeGdjO3v2oeR19`;

// Manipulate (Field Guide to Action & Adventure, Envoy Role Perk, 1st level, p.65) - see
// helpers/manipulate.mjs's own doc comment. Same plain "Use" button, no gate, shape as Soothe above.
const MANIPULATE_ID = "Compendium.essence20.field_guide_action_adventure.Item.5IfrvMnLOMqfNWko";

// Talk Them Up (Field Guide to Action & Adventure, Envoy Role Perk, 16th level, p.68) - see
// helpers/talk-them-up.mjs's own doc comment.
const TALK_THEM_UP_ID = "Compendium.essence20.field_guide_action_adventure.Item.H6hSIGrG2zCQa6Kr";

// Talk Them Down (Field Guide to Action & Adventure, Envoy Role Perk, 18th level, p.68) - see
// helpers/talk-them-down.mjs's own doc comment.
const TALK_THEM_DOWN_FGTAA_ID = "Compendium.essence20.field_guide_action_adventure.Item.Ht8KDCTIQXLo1YI3";

// Whirlwind Strike (PR CRB, Yellow Ranger, 9th level, p.57) - see
// helpers/whirlwind-strike.mjs's own doc comment.
const WHIRLWIND_STRIKE_ID = `${PR_CRB}SV8nqua9koRB3lvm`;

// Whatever We Need (PR CRB, Black Ranger, 2nd level, p.33) - see helpers/whatever-we-need.mjs's
// own doc comment.
const WHATEVER_WE_NEED_ID = `${PR_CRB}1DphEJt2hPswKDzI`;

// Force Field (Transformers CRB, Armor Upgrade, p.132): "As a Free action once per scene, increase
// your Toughness and Evasion by 2 each until the beginning of your next turn." Self-targeted,
// unlike the ally-facing Perks above/below sharing this same banked-Defense-bonus primitive - the
// first Armor Upgrade to grant an active, clickable Power (see canUsePerk's own widened type
// allowlist above) rather than an always-on passive bonus. "This upgrade can be taken multiple
// times, increasing the number of times it can be used" isn't modeled - like every other
// onceEncounterFlag entry in this file, a second copy of the Upgrade shares the same flag as the
// first, so it grants no extra uses (the same accepted "stacking is unenforced" gap this project's
// own multiple-copies items already carry elsewhere).
const FORCE_FIELD_ID = "Compendium.essence20.tf_crb.Item.j3qkiawQATkksdaC";
export const FORCE_FIELD_DEFENSE_FLAG = 'pendingForceFieldDefense';
const FORCE_FIELD_ENCOUNTER_FLAG = 'forceFieldUsedThisEncounter';

// Stalwart Defense (Transformers CRB, Sentinel Focus, 1st level, p.90): "Shield: On your turn, you
// can choose to gain +2 Toughness, +2 Evasion, or +1 Toughness and Evasion until the beginning of
// your next turn." Only the Shield option's per-turn Defense-allocation choice is built (the same
// "pick a fixed allocation" shape Sword And Board below shares) - the Weapon option (a granted
// weapon plus a permanent ↑1 on offhand attacks, chosen once at Equipment Requisition, not a
// per-turn Defense choice at all) is a different mechanism entirely (an item grant + a shift on a
// different roll type, not a Defense bonus), and this codebase has no concept of "which build-time
// option did this Perk's owner choose" to switch between the two anyway - out of scope for this
// pass, same as Disarming Defenses/Stand Firm (which key off "your Stalwart Defense bonus," a
// value this file now actually produces, but reading it back mid-attack for a disarm/double effect
// is its own separate follow-up).
const STALWART_DEFENSE_ID = "Compendium.essence20.tf_crb.Item.uhp3JOTYZJfHrz7q";
export const STALWART_DEFENSE_FLAG = 'pendingStalwartDefense';
const STALWART_DEFENSE_TURN_FLAG = 'stalwartDefenseUsedThisTurn';

// Stand Firm (Transformers CRB, Sentinel Focus, 10th level, p.91): "As a Move action, you can
// double the bonus granted by your Stalwart Defense until the beginning of your next turn." Reads
// back whatever Stalwart Defense's own picker already banked this turn (STALWART_DEFENSE_FLAG)
// and re-banks it doubled - see canUsePerk/onPerkUse's own dedicated handling below, since
// doubling an EXISTING bank is a different shape than every other BANKABLE_PERKS entry (which
// bank a fresh, fixed amount).
const STAND_FIRM_ID = "Compendium.essence20.tf_crb.Item.rAxKrR4ObFGeH5yP";

// Squad Guardian (General Hawk's Personnel Files, Old Hand Role Perk, 9th level, p.166): "you can
// spend a Moxie Point as a Standard action to give a Defeated ally who you can see 1 Health and
// remove the Defeated Condition." Same IMMEDIATE_ALLY_PERKS shape as Remove & Rebuild/Failure
// Isn't an Option above (a real Health value on an ally at 0), but the first entry to spend a
// NAMED rolePoints resource rather than the actor's own "base" one - Moxie is Old Hand's own
// rolePoints item, and Old Hand's own Role is `isAdditive: true` (confirmed directly against the
// compendium JSON), so `actor._getBaseRolePoints()` (which explicitly EXCLUDES an additive Role's
// own points) would silently resolve to the character's ORIGINAL base Role's resource instead -
// the exact same bug already caught and fixed for Old Reliable/Legendary Dependability. See the
// new `rolePointsName` field on IMMEDIATE_ALLY_PERKS/onImmediateAllyPerkUse/canUsePerk below. Also
// the first entry to filter candidates by the actual Defeated STATUS (`requireDefeatedStatus`)
// rather than a bare Health<=0 check (RAW says "a Defeated ally," and the two could in principle
// diverge - an actor manually kept Defeated after being healed, or vice versa), and the first to
// actually clear that status afterward (`removeDefeated`) - RAW explicitly says so, unlike Remove
// & Rebuild/Failure Isn't an Option, whose own RAW text doesn't name the Condition directly (left
// untouched, out of this Perk's own scope).
const SQUAD_GUARDIAN_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}Li2y6KqFu2OGRkrX`;

// Forward Observation (General Hawk's Personnel Files, General Perk, p.175) - see
// helpers/forward-observation.mjs's own doc comment. Dispatched directly (like Absolute Menace/
// Duty Of The Graphite above) rather than through IMMEDIATE_ALLY_PERKS/TEAM_BUFF_PERKS - this
// triggers a real dialog roll rather than an immediate, unconditional effect, and RAW states no
// resource cost or frequency cap at all (unlike every other direct dispatch in this file), so
// canUsePerk is unconditionally true.
const FORWARD_OBSERVATION_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}wOxrMAMHJWFs1DBN`;

// Hearty Meal (General Hawk's Personnel Files, General Perk, p.174) - see
// helpers/hearty-meal.mjs's own doc comment. Same unconditional-dispatch shape as Forward
// Observation above (a real dialog roll, no resource cost or frequency cap stated in RAW).
const HEARTY_MEAL_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}NULhQcWctFcXXdDH`;

// Heroic Intervention (PR CRB, General Perk, p.96, Level 8+): the Story Point grant clause
// ("Add one additional Story Point to the team pool each session"), dispatched the exact same
// way as Educated's identical clause just above (once/scene approximates "each session"), AND
// the Power-spend move clause ("By spending 1 Power, you can move up to 15 feet in any direction
// if it puts you adjacent to an ally or an enemy currently taking its move") both share this
// Perk's single Use button, since one Item only ever renders one - see canUsePerk/onPerkUse's own
// HEROIC_INTERVENTION_ID blocks below for how the button falls from the first clause to the
// second once the Story Point has already been granted this encounter. The 15ft move itself is
// dispatched the same "spend the cost, narrate the rest" way as Lightning Fast/Wisdom of the
// Elders' Teleportation option - "if it puts you adjacent to..." is left to the player choosing to
// click the button, same as every other unenforced narrative precondition in this codebase. The
// third clause (+1 Defenses while adjacent to an ally) lives in dice.mjs instead - see
// HEROIC_INTERVENTION_ID's own doc comment there.
const HEROIC_INTERVENTION_ID = `${PR_CRB}T95n2lwh3F5OHjnB`;
const HEROIC_INTERVENTION_ENCOUNTER_FLAG = 'heroicInterventionUsedThisEncounter';

// Ninja Power (PR CRB, General Perk, p.97) - see helpers/ninja-power.mjs's own doc comment.
const NINJA_POWER_ID = `${PR_CRB}wN5rjEQIJH68rWCd`;

// Volley (PR CRB, Pink Ranger, 1st level, p.48) - see helpers/volley.mjs's own doc comment.
const VOLLEY_ID = `${PR_CRB}Xi2sHKmBi21c3wbu`;

// Group Strike (PR CRB, Pink Ranger, 5th/10th/15th level, p.49) - see its own doc comment below.
const GROUP_STRIKE_ID = `${PR_CRB}coGMtK50t3Ojeklx`;

// More Heads are Better than One (Dragon Origin, p.30) - see its own BANKABLE_PERKS entry below
// and dice.mjs's own consumption comment (stacked alongside Inspiration's identical bonusDie
// shape).
const MORE_HEADS_ID = `${WTNV_CITIZENS_GUIDE}jsaByB9ui8k1VUfG`;
// "Once per session" - the Scene Clock's mission window (onceMissionFlag).
const MORE_HEADS_MISSION_FLAG = 'moreHeadsUsedThisMission';

const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";

// The rolePoints Item name the Cheer-spending Laugh Tactics below all draw against - see
// helpers/clever-mind.mjs's own identical local constant.
const CHEER_POINTS_NAME = "Cheer Points";

// Horse Around (MLP CRB, Laugh Tactic, p.86): "Spend 1 Cheer to move up to your Movement as a
// Free action." Dispatched directly here (spend the cost, narrate the rest) - the same "the
// button exists to spend the cost, the actual repositioning is a manual GM/player token move"
// idiom Lightning Fast's own Power-spend teleport already established, just spending Cheer
// Points (findRolePointsItem) instead of Personal Power, with no state to bank since it's a
// one-shot instant effect.
const HORSE_AROUND_ID = `${MLP_CRB}6uhfHYeuUkFuGEEN`;

// Crack-Up The 4th Wall (MLP CRB, Laugh Tactic, p.86, 3rd level): "if you make the Game Master
// laugh, gain 1 Cheer Point (but no more than one per scene)." A GM-judged trigger with a
// once/scene cap - the same "click when it actually happened" Use-button idiom as Curb Your
// Enthusiasm's own once/scene grant, spending nothing and granting into the Cheer Points
// rolePoints Item instead of the world Story Point pool.
const CRACK_UP_THE_4TH_WALL_ID = `${MLP_CRB}km6HV50h6XWKTIm1`;
const CRACK_UP_THE_4TH_WALL_ENCOUNTER_FLAG = 'crackUpThe4thWallUsedThisEncounter';

// Honest Assessment (Spirit of Honesty, 14th level, p.79) - see helpers/honest-assessment.mjs's
// own doc comment and the consumption half in dice.mjs's shift-computation block. A free-either-
// way on/off toggle (no Power/Health cost, unlike Power Boost/Phantom Suite/Observer), same
// dispatch shape as Dig In.
const HONEST_ASSESSMENT_ID = `${MLP_CRB}eIDYxShici5rRpg3`;

// Inner Magic (Magic, 2nd level, p.94) - see its own comment in dice.mjs's
// _getAutomaticCombatModifiers, where the Spellcasting-gated consumption half lives. The
// Willpower Defense reduction isn't applied here.
const INNER_MAGIC_ID = `${MLP_CRB}E6GWRHzP9tOAxQP6`;
const TERRIFYING_ID = `${GI_JOE_CRB}tXHd0LBkVCB2QPPO`;

// Hard Target (Pink Ranger, 2nd level, p.50): "As part of a Move action, you are allowed to roll
// your Acrobatics skill die to augment your Evasion score by the result until the beginning of
// your next turn." No Power cost, self-only, and - unlike every other bankable Perk above - the
// bonus is a rolled number decided at bank time, not a fixed amount (see onPerkUse's own
// rollsSkillDie branch). "Until the beginning of your next turn" has no active expiry (same
// documented gap bankPendingBonus's own doc comment already accepts for every "until X" clause in
// this file) - it's consumed like Roll With the Punches, against the next attack compared to
// Evasion, rather than lasting a precise duration.
const HARD_TARGET_ID = `${PR_CRB}9oFOf0qSLJCwCGmZ`;
export const PENDING_HARD_TARGET_FLAG_KEY = 'pendingHardTarget';

// Resilience (Across the Stars, Gold Ranger, 11th level, p.53 - a shared pr_crb item, also
// unbuilt for the base CRB Red Ranger who has the identical Perk): "spend 1 Personal Power and
// roll your Athletics Skill die; add the result to ALL your Defenses until the start of your next
// turn." Near-identical shape to Hard Target above (roll a named skill die now, bank the numeric
// result), but costs Personal Power (see the new generic `powerCost` field this needed on
// BANKABLE_PERKS/canUsePerk/onPerkUse - a small, reusable widening, not a one-off) and applies to
// any Defense the attack ends up compared against, not just Evasion - see consumeResilience's own
// doc comment for why this is a sibling function to consumeHardTarget rather than a generalization
// of it (lower regression risk to already-shipped, tested code).
const RESILIENCE_ID = `${PR_CRB}TomU7e31oHoRsIrT`;
export const PENDING_RESILIENCE_FLAG_KEY = 'pendingResilience';

// Inspiration (White Ranger, 5th/10th/15th level, p.65): "as a Free action, say something
// positive to an ally; they may add [a scaling die] to the result of any d20 roll on their next
// turn." Same bank-now/consume-later shape as Think On It/Plan of Action below, just with a
// bonusDie data payload instead of edge/shiftUp - see dice.mjs's own
// _getAutomaticCombatModifiers/rollSkill for the consuming half (appended straight onto the Roll
// formula, not folded into a shift).
const INSPIRATION_PR_ID = `${PR_CRB}FJSNzVRulj20M0B1`;

// Inspiration (Officer/Battlefield Psychologist Focus, 17th level, p.86): "when you use Plan of
// Action, you can affect one additional ally and grant one upshift 1 above your normal total.
// This is cumulative with the increase to Plan of Action at 18th level." Modifies an EXISTING
// bankable grant rather than being one of its own, so it's detected in onPerkUse() below instead
// of getting a 3rd BANKABLE_PERKS entry - it only ever matters for Plan of Action (Think On It's
// own self-only grant has no analogous "one more target" upgrade).
const INSPIRATION_ID = `${GI_JOE_CRB}j05tN97KZNzl5jTF`;

// Roll With the Punches (Renegade/Tank Focus, 6th level, p.97): "Once per combat, you can double
// your Toughness, Willpower, or Evasion against one attack or effect." Unlike Think On
// It/Plan of Action, this one is limited-use (RAW's own "once per combat," gated at the moment of
// use via hasUsedThisEncounter/markUsedThisEncounter below - not at consumption, since the
// resource being spent is "declaring the double," not "successfully doubling something") and
// needs a choice at bank time (which Defense to protect) - see needsDefenseChoice/onceEncounterFlag
// on its own BANKABLE_PERKS entry below, and pickDefenseType()/consumeRollWithThePunches() further
// down. Consumption happens on someone ELSE's roll (whoever attacks this actor), not this actor's
// own next roll, so it's read directly in dice.mjs's checkEntries construction (where a target's
// Defense difficulty is actually computed) rather than _getAutomaticCombatModifiers's self-status
// section every other banked bonus above uses.
const ROLL_WITH_THE_PUNCHES_ID = `${GI_JOE_CRB}5hBral7hiCPv3GqF`;
const ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG = 'rollWithThePunchesUsedThisEncounter';
export const PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY = 'pendingRollWithThePunches';

// Roll with the Punches (Slammer Focus, Sgt Slaughter Sourcebook p.12): a same-named, textually
// identical reprint of the base Renegade Perk above ("you gain the Renegade's Roll with The
// Punches Role Perk at 3rd level instead of 6th") - the early grant itself needs no code, it's
// already just Slammer's own Focus item map handing this Perk out at a lower level (a data-only
// change, see the Focus's own system.items). What DOES need code is its own escalation: "at 6th
// level, you can use Roll with The Punches twice per combat instead of once" - unlike Legendary
// Dependability's identical-shaped widening (a SEPARATE higher-level Perk raising another Perk's
// cap, approximated via getUsesThisScene/markUsedThisScene since that RAW says "per day"), this
// widening is baked into the SAME Perk's own text and stays combat-scoped ("per combat," not "per
// day"), so it needs the combat-scoped counting siblings (getUsesThisEncounter/
// markUsedThisEncounterCount, helpers/perks.mjs) instead - see perCombatCapFlag below,
// canUsePerk's and onPerkUse's own handling of it further down. Shares the base Perk's own
// 'pendingRollWithThePunches' flagKey/needsDefenseChoice/consumeRollWithThePunches - the banked
// effect itself (doubling a chosen Defense) is identical, only the once/twice-per-combat gate
// differs, so this gets its own dedicated counting flag rather than reusing the base Perk's
// boolean onceEncounterFlag.
const SLAMMER_ROLL_WITH_THE_PUNCHES_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.b1MNR5CPCitDTj4n";
const SLAMMER_ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG = 'slammerRollWithThePunchesUsesThisEncounter';

// Perk -> { flagKey, target }. target 'self' banks the bonus directly on the actor using the
// Perk; target 'ally' prompts for which nearby ally to bank it on instead (see pickAllyTarget
// below) - Plan of Action's own text is "grant an ally", not "grant yourself." needsDefenseChoice/
// onceEncounterFlag are Roll With the Punches-specific, see its own doc comment above.
export const BANKABLE_PERKS = {
  // Plan of Action (Officer base, 1st level, p.85): "as a Move action, you can grant an ally
  // within line of sight [shiftN] to a Skill Test on their next turn." "Line of sight" is
  // approximated as "any ally on the current scene" - this system has no line-of-sight
  // calculation anywhere to check against. The higher-level "split the total across two allies"
  // half isn't automated either - this always grants the Perk's own full current advance value
  // to one chosen ally, a simpler (and more common in play) case of the same grant.
  [`${GI_JOE_CRB}7wsu99k8v620IB2N`]: { flagKey: 'pendingPlanOfAction', target: 'ally' },

  // Plan of Action (Welcome to Night Vale: Citizens' Guide, General Perk, p.52) - verbatim
  // identical text/effect to GI Joe's Plan of Action above, just a different compendium item (a
  // separate book, same mechanic) - shares the same 'pendingPlanOfAction' flagKey so it picks up
  // the exact same consumption/scaling logic below without any new dispatch code.
  [`${WTNV_CITIZENS_GUIDE}D3uXlXL7jNn0eD8T`]: { flagKey: 'pendingPlanOfAction', target: 'ally' },

  // Benefits of Command (Officer base, 1st level, p.84): "You may spend a Story Point during
  // Equipment Assignment And Requisition to give a member of your unit an Edge on a Requisition
  // check." Same target:'ally'/worldStoryPointCost shape Bait and Switch already establishes, and
  // the default `data = { edge: true }` below is exactly what's needed - the phase restriction
  // isn't enforced (this codebase has no separate "which phase are we in" state to gate on, the
  // same accepted simplification every other phase-scoped clause elsewhere already gets), so it's
  // just usable any time. Consumed in helpers/requisition.mjs#rollRequisition, the only place a
  // Requisition Skill Test is actually rolled.
  [`${GI_JOE_CRB}jSmMtJ0YFCEJcXYU`]: { flagKey: 'pendingBenefitsOfCommand', target: 'ally', worldStoryPointCost: 1 },

  // More Heads are Better than One (Dragon Origin, p.30) - see MORE_HEADS_ID's own comment above.
  // fixedBonusDie is a new, generic field (a non-rolled sibling to Hard Target/Resilience's own
  // rollsSkillDie and Inspiration's own scaling bonusDie) - reusable for any future flat-die grant.
  [MORE_HEADS_ID]: {
    flagKey: 'pendingMoreHeads', target: 'self', fixedBonusDie: '2d2', onceMissionFlag: MORE_HEADS_MISSION_FLAG,
  },

  [ROLL_WITH_THE_PUNCHES_ID]: {
    flagKey: PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY,
    target: 'self',
    needsDefenseChoice: true,
    onceEncounterFlag: ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG,
  },

  // Roll with the Punches (Slammer Focus) - see SLAMMER_ROLL_WITH_THE_PUNCHES_ID's own comment
  // above. perCombatCapFlag is checked/incremented via getUsesThisEncounter/
  // markUsedThisEncounterCount instead of onceEncounterFlag's plain boolean - canUsePerk/onPerkUse
  // below cap it at 2 once the actor reaches 6th level, 1 below that.
  [SLAMMER_ROLL_WITH_THE_PUNCHES_ID]: {
    flagKey: PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY,
    target: 'self',
    needsDefenseChoice: true,
    perCombatCapFlag: SLAMMER_ROLL_WITH_THE_PUNCHES_ENCOUNTER_FLAG,
  },

  // Inspiration (Power Ranger White Ranger) - see INSPIRATION_PR_ID's own comment above.
  [INSPIRATION_PR_ID]: { flagKey: 'pendingInspiration', target: 'ally' },

  // Hard Target (Pink Ranger, 2nd level) - see its own comment above.
  [HARD_TARGET_ID]: { flagKey: PENDING_HARD_TARGET_FLAG_KEY, target: 'self', rollsSkillDie: 'acrobatics' },

  // Resilience (Across the Stars, Gold Ranger, 11th level) - see its own comment above.
  [RESILIENCE_ID]: {
    flagKey: PENDING_RESILIENCE_FLAG_KEY, target: 'self', rollsSkillDie: 'athletics', powerCost: 1,
  },

  // Augment Power (Transformers CRB Scientist, 7th level, p.80) - deliberately NOT added here
  // (see AUGMENT_POWER_ID below). Its own 2-tier once-per-turn/once-per-combat shape needs a real
  // benefit picker this generic single-config-per-button table can't express, the same reason
  // Dig Deep (PR CRB) got its own file - see helpers/augment-power.mjs's own doc comment.

  // Inner Magic (Magic, 2nd level) - see its own comment above. Self-target, no cost/gate here
  // beyond the (unautomated) Willpower Defense reduction; the Spellcasting gate lives entirely on
  // the consuming side in dice.mjs.
  [INNER_MAGIC_ID]: { flagKey: 'pendingInnerMagic', target: 'self', fixedShiftUp: 1 },

  // Terrifying (GI Joe CRB, Armor Upgrade, p.156): "As a Free action, the wearer gives themself
  // an Edge... 1 on Intimidation Skill Tests until the end of their turn." Same self-bank/
  // fixedShiftUp shape as Inner Magic just above, scoped to the actor's own next Intimidation
  // roll (see dice.mjs's own pendingTerrifying consumption) as the accepted "until end of turn"
  // approximation - "next roll" instead of a real turn-boundary, same idiom every other banked
  // one-shot bonus in this table already uses.
  [TERRIFYING_ID]: { flagKey: 'pendingTerrifying', target: 'self', fixedShiftUp: 1 },

  // Guidance (GI Joe CRB, Focus: Scout, 10th level, p.94) - see
  // helpers/environmental-expertise.mjs's own GUIDANCE_ID comment. Spends 1 Adaptation Point (the
  // Ranger base's own rolePoints resource, same actor._getBaseRolePoints() lookup Heart of the
  // Team's Quips & Speeches spend already uses) to bank a bare marker flag on a chosen ally - no
  // shiftUp/edge/bonusDie data payload, since dice.mjs's own consuming check just tests the flag's
  // presence (see the isGuidance branch below).
  [GUIDANCE_ID]: { flagKey: PENDING_GUIDANCE_FLAG_KEY, target: 'ally', spendsRolePoint: true },

  // I Got You - see its own comment above.
  // ruleBank: banked through the rules engine's bank (rules/bank.mjs), which every roll reads - its old
  // pendingIGotYou flag had no consumer anywhere, so the ↑1 never landed.
  [I_GOT_YOU_ID]: {
    flagKey: 'pendingIGotYou', target: 'ally', fixedShiftUp: 1, energonCost: 1, onceRoundFlag: 'iGotYouUsedThisRound', ruleBank: true,
  },

  // Force Field - see FORCE_FIELD_ID's own comment above.
  [FORCE_FIELD_ID]: {
    flagKey: FORCE_FIELD_DEFENSE_FLAG, target: 'self', defenseAmounts: { toughness: 2, evasion: 2 },
    onceEncounterFlag: FORCE_FIELD_ENCOUNTER_FLAG,
  },

  // Stalwart Defense - see STALWART_DEFENSE_ID's own comment above. Repeatable every turn
  // (onceTurnFlag, not onceEncounterFlag), unlike every other defenseAmounts entry in this table.
  [STALWART_DEFENSE_ID]: {
    flagKey: STALWART_DEFENSE_FLAG, target: 'self', onceTurnFlag: STALWART_DEFENSE_TURN_FLAG,
    defenseAllocationChoices: [
      { labelKey: 'E20.StalwartDefenseToughnessOption', amounts: { toughness: 2 } },
      { labelKey: 'E20.StalwartDefenseEvasionOption', amounts: { evasion: 2 } },
      { labelKey: 'E20.StalwartDefenseBothOption', amounts: { toughness: 1, evasion: 1 } },
    ],
  },
};

// Healing Light (Across the Stars, Phantom Ranger, Phantom Focus choice, 10th/15th level, p.62):
// "spend 1 Personal Power and 1 Health to heal 2d2 Health to any target." Unlike every other
// IMMEDIATE_ALLY_PERKS entry, this charges BOTH costs at once (see the widened canUsePerk/
// onImmediateAllyPerkUse just below) and rolls its heal amount (rollsHeal) rather than a fixed/
// scaling number. Only the healing half is built - "or remove all current poisons and adverse
// Conditions from the target" would need a genuinely new "clear every active status" sweep this
// codebase has no precedent for, flagged as a gap rather than forced in. Not its own compendium
// item - see PHANTOM_FOCUS_ID's own comment below for why this is dispatched by system.choice
// instead of sourceId like every other entry in this table.
const HEALING_LIGHT_CONFIG = { powerCost: 1, healthCost: 1, rollsHeal: '2d2', radiusFeet: Infinity, requireMorphed: false };

// EMT Crash Course (GI Joe CRB, General Perk, p.132): "Once per scene, as long as you have a
// medicine kit on you, you can spend a Standard action to heal one damage on yourself or an ally
// with no Skill Test. As long as you have a medicine kit, you may restore one Essence to an ally
// with a Standard action. You gain an Edge on Science (Medicine) Skill Tests to learn clues from
// injuries or deceased persons." "Medicine kit" possession is unenforced, the same
// item-possession precondition every other such clause in this project already treats as
// narrative. The Edge clause is the same "match by Specialization name" idiom as Tourniquet Line
// Chef's own identically-worded clause - see dice.mjs's widened TOURNIQUET_LINE_CHEF_ID check.
// The heal half (once per scene, self-or-ally, no cost) is a plain IMMEDIATE_ALLY_PERKS-shaped
// CONFIG object, dispatched directly via onImmediateAllyPerkUse below (same "separate CONFIG
// constant, checked inline, dispatched by something other than a straight sourceId table lookup"
// shape HEALING_LIGHT_CONFIG/PHANTOM_FOCUS_ID already established) rather than registered in the
// table itself - the Essence-restore half has NO frequency cap in RAW (unlike the heal clause), so
// the two can't share one onceEncounterFlag gate or one "Use" button dispatch without conflating
// them. Instead, the button opens a 2-way picker (pickEmtCrashCourseAction below) choosing which
// half to invoke; the Essence-restore half itself lives in helpers/emt-crash-course.mjs.
// Widened to an array (built 2026-09-12) since PR CRB (p.94) reprints this Perk verbatim.
const EMT_CRASH_COURSE_IDS = [`${GI_JOE_CRB}jDAu1zaZpv1IylJ8`, `${PR_CRB}cBezxXDBMpsRwYbP`];
const EMT_CRASH_COURSE_ENCOUNTER_FLAG = 'emtCrashCourseHealUsedThisEncounter';
const EMT_CRASH_COURSE_HEAL_CONFIG = {
  healAmount: 1, includeSelf: true, radiusFeet: Infinity, onceEncounterFlag: EMT_CRASH_COURSE_ENCOUNTER_FLAG,
};

// Perk -> { powerCost, healthCost, healAmount, radiusFeet, requireMorphed, includeSelf,
// rollsHeal, onceEncounterFlag, rolePointCost, rolePointsName, requireDefeatedStatus,
// removeDefeated }. Every entry heals one target - Personal Power (powerCost) and/or the granter's
// own Health (healthCost) are independently checked/paid (Healing Light above charges both at
// once). The target is a chosen nearby ally by default, or the granter alongside the normal ally
// candidates if includeSelf is set (EMT Crash Course's own "yourself or an ally" heal above).
// healAmount is a fixed number, or - if rollsHeal is set - rolled fresh each use (Healing Light's
// 2d2). onceEncounterFlag (EMT Crash Course's heal) gates re-use the same way a bankable Perk's own
// onceEncounterFlag does.
const IMMEDIATE_ALLY_PERKS = {
  // Squad Guardian - see SQUAD_GUARDIAN_ID's own comment above.
  [SQUAD_GUARDIAN_ID]: {
    rolePointCost: true, rolePointsName: "Moxie", healAmount: 1, radiusFeet: Infinity,
    requireMorphed: false, requireDefeatedStatus: true, removeDefeated: true,
  },
};

/**
 * Whether the sheet should show a "Use" control for this Perk item right now - it's one of the
 * table above, and there isn't already an unspent banked bonus from it.
 * @param {Item} item
 * @returns {Boolean}
 */
/**
 * Whether the item has a Use of its own (an action-cost, extension or other registered Use), whether or
 * not it can be used right now. A Power with one is used through it alone - its plain activation would
 * only spend Personal Power, since the Use pays its own cost.
 * @param {Item} item
 * @returns {Boolean}
 */
export function hasItemUse(item) {
  return isActionPerkUse(item);
}

export function canUsePerk(item) {
  const actor = item?.parent;
  if (isActionPerkUse(item)) {
    return canUseActionPerk(item);
  }

  // Despite the name, this (and onPerkUse below) also covers Relic Key - a `feature`-type Zord
  // Feature (helpers/relic-key.mjs), not a `perk` item, but the same "Use" control/button this
  // whole registry already renders generically for any item (collapsible-item-container-label-
  // buttons.hbs's own {{#if (canUsePerk item)}} check isn't type-scoped) - reusing this existing
  // registry instead of building a parallel one just for a single Feature.
  // 'spell' joins them for Help Yourself (helpers/help-yourself.mjs), whose summoned clone needs
  // a control to direct it - the same reuse-the-generic-registry reasoning as Relic Key above,
  // applied to the one spell in this system that grants an ongoing action rather than resolving
  // entirely on its own cast.
  // 'upgrade' joins them for Force Field (Transformers CRB, Armor Upgrade, p.132) - the first
  // Armor Upgrade in this codebase that grants an active, clickable Power rather than an always-on
  // passive bonus. Upgrades not present in BANKABLE_PERKS/IMMEDIATE_ALLY_PERKS below still fall
  // through to `!bankable`/no-immediate-match and correctly get no button, so widening the type
  // allowlist here can't surface a "Use" control on any other, ordinary Upgrade.
  // 'gear' joins them for Energon Cube/Energon Snack (Decepticon Directive Equipment) - see their
  // own comments above. Same "not in any registry means no button" safety as 'upgrade' above.
  // 'hangUp' joins them for Mode Attachment (helpers/mode-attachment.mjs's own comment) - the
  // first Hang-Up in this codebase to need a player-configurable choice of its own, same
  // "not in any registry means no button" safety as 'upgrade'/'gear' above.
  if (!actor || !['perk', 'feature', 'spell', 'upgrade', 'gear', 'hangUp'].includes(item.type)) {
    return false;
  }

  if (isTeamBuffPerk(item)) {
    return canUseTeamBuffPerk(item, actor);
  }

  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

  if (sourceId == MARK_TARGET_ID) {
    return true;
  }

  // Primary Quarry - see helpers/primary-quarry.mjs's own doc comment. Always clickable, same as
  // Mark Target just above - the 1-hour research cost is unenforced narrative.
  if (sourceId == PRIMARY_QUARRY_ID) {
    return true;
  }

  // Known Accomplices - see helpers/known-accomplices.mjs's own doc comment. Same "always
  // clickable" idiom as Primary Quarry just above, but also needs the Energon Point it actually
  // spends (unlike Primary Quarry's own unenforced 1-hour cost).
  if (sourceId == KNOWN_ACCOMPLICES_ID) {
    return (actor.system.energon?.normal?.value ?? 0) >= 1;
  }

  // I Got You - see helpers/lend-assistance.mjs's own I_GOT_YOU_ID comment. Always clickable (the
  // Lend Assistance half has no cost), the choice of which grant to take happens inside onPerkUse.
  if (sourceId == I_GOT_YOU_ASSIST_ID) {
    return true;
  }

  // Studious Measures - see helpers/studious-measures.mjs's own doc comment. No frequency limit in
  // RAW (it triggers each time a new Primary Quarry is designated), so always available.
  if (sourceId == STUDIOUS_MEASURES_ID) {
    return true;
  }

  // Welds, Rivets, and Ideas - see helpers/welds-rivets-and-ideas.mjs's own doc comment. No
  // frequency limit in RAW.
  if (sourceId == WELDS_RIVETS_AND_IDEAS_ID) {
    return true;
  }

  // Psychological Sway - see helpers/psychological-sway.mjs's own doc comment. No frequency limit
  // in RAW.
  if (sourceId == PSYCHOLOGICAL_SWAY_ID) {
    return true;
  }

  // On Target - see helpers/on-target.mjs's own doc comment.
  if (sourceId == ON_TARGET_ID) {
    return canUseOnTarget(actor);
  }

  if (sourceId == MARK_EVERYBOT_ID) {
    return canUseMarkEverybot(actor);
  }

  if (isSkillSubstitutionPerk(sourceId)) {
    return canUseSkillSubstitutionPerk(actor, sourceId);
  }

  // Team Player / Bureaucrat - the Lend Assistance action itself has no cost or frequency cap in
  // RAW, so this is unconditionally available (see helpers/lend-assistance.mjs's own doc comment).
  if (LEND_ASSISTANCE_PERK_IDS.includes(sourceId)) {
    return true;
  }

  // Help Yourself - see helpers/help-yourself.mjs's own doc comment. Offered only while the clone
  // is actually standing and hasn't already helped this round; outside combat there are no rounds
  // to gate on, so hasUsedThisRound correctly never blocks it there.
  if (sourceId == HELP_YOURSELF_ID) {
    return isHelpYourselfCloneActive(actor) && !hasUsedThisRound(actor, HELP_YOURSELF_ROUND_FLAG);
  }

  // Quick and Quiet / Voice of Night Vale - see helpers/surprise.mjs's own doc comment. Both are
  // scoped to the surprise round, which is one of the few timing qualifiers this system can
  // actually check, so the button simply disappears afterward rather than trusting the player.
  if (sourceId == QUICK_AND_QUIET_ID || sourceId == VOICE_OF_NIGHT_VALE_ID) {
    return isSurpriseRound();
  }

  if (sourceId == NEMESIS_ID) {
    return true;
  }

  if (sourceId == NEMESIS_DD_PERK_ID) {
    return true;
  }

  if (sourceId == ENERGON_PARASITE_ID) {
    return canUseEnergonParasite(actor);
  }

  if (sourceId == RELIC_KEY_ID) {
    return canDeclareRelicKeyEdge(actor);
  }

  if (sourceId == EXTRA_ROUGH_TRAINING_ID) {
    return !game.combat;
  }

  if (sourceId == HUP_HUP_HUP_HUP_HUP_ID) {
    return true;
  }

  if (sourceId == TIMELY_TEAMMATE_ID) {
    return canUseTimelyTeammate(actor);
  }

  if (sourceId == ROAR_ID) {
    return canUseRoar(actor);
  }

  if (sourceId == TWO_HEADS_ARE_BETTER_THAN_ONE_ID) {
    return canUseTwoHeadsAreBetterThanOne(actor);
  }

  if (sourceId == PSYCHO_ASSAULT_ID) {
    return !!actor.system.isMorphed && !isMonsterFormActive(actor) && actor.system.powers.personal.value >= 1;
  }

  if (sourceId == NEMESIS_DRAIN_ID) {
    return actor.system.powers.personal.value >= 2 && !hasUsedThisEncounter(actor, NEMESIS_DRAIN_ENCOUNTER_FLAG);
  }

  if (sourceId == RIGHT_BEHIND_YOU_ID) {
    return !!game.combat && game.combat.round == 1 && actor.system.powers.personal.value >= 1;
  }

  if (sourceId == BETTER_YOU_THAN_ME_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == DISTRACTION_ID) {
    // Always usable to switch back OFF; switching ON needs Morphed and not in Monster Form.
    return isDistractionActive(actor) || (!!actor.system.isMorphed && !isMonsterFormActive(actor));
  }

  if (sourceId == POWER_BLEED_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == MAXIMIZE_FLAWS_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == GROWING_SMOLDER_ID) {
    return true;
  }

  if (sourceId == TOXIC_TERROR_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Personal Power.
    return isToxicTerrorActive(actor) || actor.system.powers.personal.value >= 1;
  }

  if (sourceId == VENOM_WARLORD_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == PROTECTED_TARGET_ID) {
    return canDesignateProtectedTarget(actor);
  }

  if (sourceId == ROUSE_ID) {
    return !!game.combat;
  }

  if (sourceId == ROUSING_COMEBACK_ID) {
    return !!game.combat;
  }

  if (sourceId == KNIGHTS_JUMP_ID) {
    return !!game.combat && !hasUsedThisTurn(actor, KNIGHTS_JUMP_TURN_FLAG);
  }

  if (sourceId == DIRTY_TRICK_ID) {
    return true;
  }

  if (sourceId == HONORIFIC_TOKEN_ID) {
    return !hasUsedThisEncounter(actor, HONORIFIC_TOKEN_ENCOUNTER_FLAG);
  }

  if (sourceId == PARTY_POWER_ID) {
    return getUsesThisScene(actor, PARTY_POWER_SCENE_FLAG) < PARTY_POWER_MAX_USES;
  }

  if (sourceId == STAY_IN_FORMATION_ID) {
    return !hasUsedThisEncounter(actor, STAY_IN_FORMATION_ENCOUNTER_FLAG);
  }

  if (sourceId == HUMANITARIAN_ID) {
    return true;
  }

  if (sourceId == ENTROPIC_SPONGE_ID) {
    return !!game.combat && game.combat.round == 1;
  }

  if (sourceId == I_KNOW_A_GUY_ID) {
    return !hasUsedThisEncounter(actor, I_KNOW_A_GUY_ENCOUNTER_FLAG);
  }

  if (sourceId == CONCENTRATE_FIRE_ID) {
    return !hasUsedThisEncounter(actor, CONCENTRATE_FIRE_ENCOUNTER_FLAG)
      && canWriteStoryPoints() && hasStoryPointsAvailable(1);
  }

  if (sourceId == PHANTOM_GIJ_ID) {
    return true;
  }

  if (sourceId == SURFACE_READ_ID) {
    return canWriteStoryPoints() && hasStoryPointsAvailable(1);
  }

  if (sourceId == SUGGESTION_ID) {
    return !hasUsedThisEncounter(actor, SUGGESTION_ENCOUNTER_FLAG) && isPerfectDisguiseActive(actor);
  }

  if (sourceId == TALK_THEM_DOWN_ID) {
    return true;
  }

  if (sourceId == TIME_TRAVELER_PERK_ID) {
    return !!getTimeTravelerActiveSkill(actor) || (canWriteStoryPoints() && hasStoryPointsAvailable(1));
  }

  if (sourceId == INSPIRING_WORDS_ID) {
    return canUseInspiringWords(actor);
  }

  if (sourceId == TRADE_SCHOOL_ID) {
    return canUseTradeSchool(actor);
  }

  if (sourceId == TECH_SPECS_ID) {
    return true;
  }

  if (sourceId == BREAKING_POINT_ID) {
    return true;
  }

  if (sourceId == DEADSTICK_ID) {
    return true;
  }

  if (sourceId == GROUND_SUPPRESSION_ID) {
    return true;
  }

  if (sourceId == SUPERB_SOLOIST_ID) {
    return !hasUsedThisEncounter(actor, SUPERB_SOLOIST_ENCOUNTER_FLAG);
  }

  if (sourceId == DIG_IN_ID || sourceId == MEAT_SHIELD_ID || sourceId == SCRAMBLE_ID
    || sourceId == EXTENDED_ATTACK_ID) {
    return true;
  }

  if (sourceId == UNMOVABLE_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Personal Power.
    return isUnmovableActive(actor) || actor.system.powers.personal.value >= 1;
  }

  // Stand Firm - see STAND_FIRM_ID's own comment above. Only usable while there's an active
  // Stalwart Defense bank this turn to double.
  if (sourceId == STAND_FIRM_ID) {
    const pending = getPendingBonus(actor, STALWART_DEFENSE_FLAG);
    return !!pending && !(game.combat && pending.round != null && pastStartOfNextTurn(actor, pending));
  }

  // Mode Attachment - see helpers/mode-attachment.mjs's own doc comment. Always configurable.
  if (sourceId == MODE_ATTACHMENT_ID) {
    return true;
  }

  // Favorite Weapon - see helpers/favorite-weapon.mjs's own doc comment. Always configurable,
  // same "offer the choice, don't gate WHEN it's set" idiom as Mode Attachment just above.
  if (sourceId == FAVORITE_WEAPON_ID) {
    return true;
  }

  // Mass Shift - see helpers/mass-shift.mjs's own doc comment.
  if (sourceId == MASS_SHIFT_ID) {
    return canUseMassShift(actor);
  }

  // Fly In The Future - see helpers/evasive-maneuvers.mjs. Only usable while actually crewing an
  // Aerial vehicle; there is nothing to fly evasively otherwise.
  if (sourceId == FLY_IN_THE_FUTURE_ID) {
    return !!getPilotedAerialVehicle(actor);
  }

  if (sourceId == RISE_AGAIN_ID) {
    return canUseRiseAgainDefense(actor);
  }

  if (sourceId == EMOTIONAL_MASTERY_ID) {
    return true;
  }

  if (sourceId == TEAM_SPIRIT_ID) {
    return true;
  }

  if (sourceId == BOX_SHOT_ID) {
    return canUseBoxShot(actor);
  }

  if (sourceId == METALLIKATO_ID) {
    return true;
  }

  if (sourceId == INVISIBILITY_ID) {
    return canUseInvisibility(actor);
  }

  if (sourceId == FRICTIONLESS_MOVEMENT_ID) {
    return canUseFrictionlessMovement(actor);
  }

  if (sourceId == SPRINTER_ID) {
    return canUseSprinterBoost(actor);
  }

  if (sourceId == CANNONEER_DIG_IN_ID) {
    return true;
  }

  if (sourceId == ENGINE_OVERRIDE_ID) {
    return true;
  }

  if (sourceId == JURY_RIG_ID) {
    return true;
  }

  if (sourceId == OMEGA_ENHANCEMENT_ID) {
    return (actor.system.powers?.personal?.value ?? 0) >= 1;
  }

  if (sourceId == SPOT_WELD_ID) {
    return canUseSpotWeld(actor);
  }

  if (sourceId == IMPROVISE_ARMOR_ID) {
    return !hasUsedThisEncounter(actor, IMPROVISE_ARMOR_ENCOUNTER_FLAG);
  }

  if (sourceId == AVAST_ID) {
    return !hasUsedThisEncounter(actor, AVAST_ENCOUNTER_FLAG);
  }

  if (sourceId == MARTIAL_LEADERSHIP_ID) {
    return true;
  }

  if (sourceId == VOICE_OF_PRIMUS_ID) {
    return true;
  }

  if (sourceId == REMOTE_OPERATIONS_ID) {
    return true;
  }

  if (sourceId == WORDS_CAN_HURT_ID) {
    return true;
  }

  // Side Splitter - see helpers/side-splitter.mjs's own doc comment. No frequency limit in RAW.
  if (sourceId == SIDE_SPLITTER_ID) {
    return true;
  }

  if (sourceId == CALMING_WORDS_ID) {
    return true;
  }

  if (sourceId == POWERFUL_SUGGESTIONS_ID) {
    return true;
  }

  if (sourceId == DATA_BRIDGE_ID) {
    return !hasUsedThisTurn(actor, DATA_BRIDGE_TURN_FLAG) && getAvailableDataBridgeSpecializations(actor).length > 0;
  }

  if (sourceId == MISERY_LOVES_COMPANY_ID) {
    return actor.system.energon?.normal?.value >= 1
      && getAffectedDataBridgeAllies(actor).length > 0 && getDataBridgedAllyTokens(actor).length > 0;
  }

  // Self-Preservation - see helpers/self-preservation.mjs's own doc comment. Needs an Energon
  // Point up front.
  if (sourceId == SELF_PRESERVATION_ID) {
    return actor.system.energon?.normal?.value >= 1;
  }

  if (sourceId == ARCHKEY_ID) {
    return true;
  }

  if (sourceId == ENERGON_CUBE_ID || sourceId == ENERGON_SNACK_ID || sourceId == ENGINE_CELLS_ID) {
    return (item.system.quantity ?? 1) > 0;
  }

  if (sourceId == WORK_THE_NUMBERS_ID) {
    return canUseWorkTheNumbers() && actor.system.energon?.normal?.value >= 1;
  }

  if (sourceId == LIKE_WATER_ID) {
    return getAvailableLikeWaterOptions(actor).length > 0;
  }

  if (sourceId == IMPOSSIBLE_EXPECTATIONS_ID) {
    return canWriteStoryPoints() && hasStoryPointsAvailable(1);
  }

  if (sourceId == SMASHMOUTH_OFFENSE_ID) {
    return !hasUsedThisEncounter(actor, SMASHMOUTH_OFFENSE_ENCOUNTER_FLAG)
      && canWriteStoryPoints() && hasStoryPointsAvailable(1);
  }

  if (sourceId == STUDY_WEAKNESSES_ID) {
    return canWriteStoryPoints() && hasStoryPointsAvailable(1);
  }

  if (sourceId == SHADOW_ID || sourceId == SILENT_STRIDER_ID) {
    return true;
  }

  if (sourceId == SKIER_ID) {
    return true;
  }

  if (sourceId == ITS_TIME_ID) {
    return true;
  }

  if (sourceId == BULWARK_ID) {
    return true;
  }

  if (sourceId == TAKEDOWN_ID) {
    return true;
  }

  if (sourceId == SELF_REVIVE_ID) {
    return canUseSelfRevive(actor);
  }

  if (sourceId == I_STILL_FUNCTION_ID) {
    return canUseIStillFunction(actor);
  }

  if (sourceId == OUTWIT_ID) {
    return true;
  }

  if (sourceId == SHOULDER_TO_SHOULDER_ID) {
    return true;
  }

  if (sourceId == FEARSOME_PRESENCE_ID) {
    return isRecklessAbandonActive(actor);
  }

  if (sourceId == NATURAL_MOVEMENT_ID) {
    return true;
  }

  if (sourceId == ENVIRONMENTAL_EXPERTISE_ID) {
    return true;
  }

  if (sourceId == READ_THE_LAND_ID) {
    return isEnvironmentalExpertiseActive(actor) || (canWriteStoryPoints() && hasStoryPointsAvailable(1));
  }

  if (sourceId == ADAPTATION_ID) {
    return isEnvironmentalExpertiseActive(actor) || !!actor._getBaseRolePoints?.()?.system.resource.value;
  }

  if (sourceId == HONEST_ASSESSMENT_ID) {
    return true;
  }

  if (sourceId == POINTY_ID) {
    return true;
  }

  if (sourceId == REAL_ANGELS_ID) {
    return !hasUsedThisEncounter(actor, REAL_ANGELS_ENCOUNTER_FLAG);
  }

  if (sourceId == DIG_DEEP_ID || sourceId == DIG_DEEP_TF_ID || sourceId == DIG_DEEP_GIJ_ID || sourceId == DIG_DEEP_MLP_ID) {
    return getUses(actor, DIG_DEEP_ENCOUNTER_FLAG, digDeepWindow(sourceId)) < 1;
  }

  if (sourceId == TIMELINE_ANOMALY_ID) {
    return !hasUsedThisEncounter(actor, TIMELINE_ANOMALY_ENCOUNTER_FLAG);
  }

  if (sourceId == AFTER_YOU_ID) {
    return true;
  }

  if (sourceId == QUICK_STUDY_ID || sourceId == GIJ_QUICK_STUDY_ID) {
    return !hasUsedThisEncounter(actor, QUICK_STUDY_ENCOUNTER_FLAG);
  }

  if (sourceId == FAST_LEARNER_ID) {
    return true;
  }

  if (sourceId == CASTLING_ID) {
    return true;
  }

  if (sourceId == DANGER_SENSE_ID) {
    return true;
  }

  if (sourceId == MYSTERIOUS_AURA_ID) {
    return actor.system.powers?.personal?.value > 0;
  }

  if (sourceId == ELECTROMAGNETIC_DISRUPTION_ID) {
    return item.system.choice == 'pulse' && canUseElectromagneticDisruptionPulse(actor);
  }

  if (sourceId == EYE_FOR_APPRAISAL_ID) {
    return canUseEyeForAppraisal(actor);
  }

  if (sourceId == WRESTLER_PIN_ID) {
    return canUseWrestlerPin(actor);
  }

  if (sourceId == WEAPON_CONVERSION_ID) {
    return hasConvertibleWeapon(actor);
  }

  if (sourceId == STAND_BEHIND_ME_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == WHIRLWIND_STRIKE_ID) {
    return !!actor.system.isMorphed && actor.system.powers.personal.value >= 1;
  }

  if (sourceId == WHATEVER_WE_NEED_ID) {
    return !!actor._getBaseRolePoints?.()?.system.resource.value;
  }

  if (sourceId == HEROIC_INTERVENTION_ID) {
    return !hasUsedThisEncounter(actor, HEROIC_INTERVENTION_ENCOUNTER_FLAG)
      || (actor.system?.powers?.personal?.value ?? 0) >= 1;
  }

  if (sourceId == NINJA_POWER_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Personal Power.
    return isNinjaPowerActive(actor) || actor.system.powers.personal.value >= 1;
  }

  if (sourceId == VOLLEY_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Personal Power.
    return isVolleyActive(actor) || actor.system.powers.personal.value >= 1;
  }

  if (sourceId == GROUP_STRIKE_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == POWER_BOOST_ID || sourceId == BRUTE_FORCE_ID) {
    // Always usable to switch back OFF (free); switching ON needs 2 Personal Power.
    return isPowerBoostActive(actor) || actor.system.powers.personal.value >= 2;
  }

  if (sourceId == LANCE_OF_LIGHT_ID) {
    return isLanceOfLightActive(actor) || actor.system.powers.personal.value >= 2;
  }

  if (sourceId == MONSTER_MORPH_ID) {
    // Always usable to switch back OFF (free); switching ON needs 3 Personal Power.
    return isMonsterFormActive(actor) || actor.system.powers.personal.value >= 3;
  }

  if (sourceId == GROW_ID) {
    // No Power cost at all - the only gate (either direction) is being in Monster Form.
    return isMonsterFormActive(actor);
  }

  if (sourceId == GRID_SURGE_ID) {
    return !!actor._getBaseRolePoints?.()?.system.resource.value;
  }

  if (sourceId == OBSERVER_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Personal Power.
    return isObserverDisguiseActive(actor) || actor.system.powers.personal.value >= 1;
  }

  if (sourceId == PERFECT_DISGUISE_ID) {
    // Always usable to switch back OFF (free); switching ON needs an unused encounter.
    return isPerfectDisguiseActive(actor) || !hasUsedThisEncounter(actor, 'perfectDisguiseUsedThisEncounter');
  }

  if (sourceId == SUPREME_GUARDIAN_ID) {
    return !!actor.system.isMorphed;
  }

  if (sourceId == COMBAT_STANCE_ID) {
    return canDeclareCombatStance(actor);
  }

  if (sourceId == AT_ALL_COST_ID || sourceId == PR_CRB_AT_ALL_COSTS_ID) {
    // Always usable to switch back OFF; switching ON needs Morphed + not already used this scene.
    return isAtAllCostActive(actor) || canActivateAtAllCost(actor);
  }

  if (sourceId == POWER_ADAPTATION_ID) {
    const option = item.system.choice;
    if (!option || !POWER_ADAPTATION_OPTIONS[option]) {
      return false;
    }

    // Always usable to switch back OFF (free); switching ON needs that option's own Power cost.
    return isPowerAdaptationActive(actor, option)
      || actor.system.powers.personal.value >= POWER_ADAPTATION_OPTIONS[option].cost;
  }

  if (sourceId == PHANTOM_SUITE_ID) {
    return isPhantomSuiteActive(actor) || actor.system.powers.personal.value >= 1;
  }

  if (sourceId == AGELESS_KNOWLEDGE_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == PHANTOM_FOCUS_ID) {
    if (item.system.choice != 'healingLight') {
      return false;
    }

    return (!HEALING_LIGHT_CONFIG.healthCost || actor.system.health.value >= HEALING_LIGHT_CONFIG.healthCost)
      && (!HEALING_LIGHT_CONFIG.powerCost || actor.system.powers.personal.value >= HEALING_LIGHT_CONFIG.powerCost);
  }

  if (sourceId == THROUGH_THE_ARCHES_ID) {
    return actor.system.powers.personal.value >= 2;
  }

  if (sourceId == RUSH_THE_LINE_ID) {
    return canWriteStoryPoints() && hasStoryPointsAvailable(1) && !hasUsedThisTurn(actor, RUSH_THE_LINE_TURN_FLAG);
  }

  if (sourceId == ABSOLUTE_MENACE_ID) {
    return actor.system.powers.personal.value >= 2 && !hasUsedThisTurn(actor, ABSOLUTE_MENACE_TURN_FLAG);
  }

  if (sourceId == FRIGHTENING_DISPLAY_ID) {
    return true;
  }

  if (sourceId == AVALANCHE_STOMP_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == FIGHT_ME_ID) {
    return true;
  }

  if (sourceId == A_LOGICAL_EXPLANATION_ID) {
    return true;
  }

  if (sourceId == SOOTHE_ID) {
    return true;
  }

  if (sourceId == MANIPULATE_ID || sourceId == TALK_THEM_UP_ID || sourceId == TALK_THEM_DOWN_FGTAA_ID) {
    return true;
  }

  if (sourceId == BUMPER_CROP_ID) {
    return true;
  }

  if (sourceId == GRAVITY_OPTIONAL_ID) {
    // Always usable to switch back OFF (free); switching ON is gated once per scene inside
    // toggleGravityOptional itself, same "check by attempting" shape as its own canUsePerk peers.
    return isGravityOptionalActive(actor) || !hasUsedThisEncounter(actor, 'gravityOptionalUsedThisEncounter');
  }

  if (sourceId == PSEUDO_SCIENCE_ID) {
    return !isPseudoScienceActive(actor);
  }

  if (sourceId == DUTY_OF_THE_GRAPHITE_ID) {
    return !!actor._getBaseRolePoints?.()?.system.resource.value && actor.system.powers.personal.value >= 2;
  }

  if (sourceId == IVE_GOT_YOU_ID) {
    return true;
  }

  if (sourceId == MIND_OVER_MATTER_ID) {
    return true;
  }

  if (sourceId == PATCH_UP_ID) {
    return canUsePatchUp(actor);
  }

  if (sourceId == PREVENTATIVE_MEASURES_ID) {
    return true;
  }

  if (sourceId == TOUGH_IT_OUT_ID) {
    return canUseToughItOut(actor);
  }

  if (sourceId == STAND_TOGETHER_ID) {
    return canUseStandTogether(actor);
  }

  if (isCostGatedSubstitutionPerk(sourceId)) {
    return canUseCostGatedSubstitutionPerk(actor);
  }

  if (sourceId == CLEVER_MIND_ID) {
    return canUseCleverMind(actor);
  }

  if (sourceId == ROTTEN_TOMATOES_ID) {
    return canUseRottenTomatoes(actor);
  }

  if (sourceId == TOUGH_CROWD_ID) {
    return canUseToughCrowd(actor);
  }

  if (sourceId == HORSE_AROUND_ID) {
    return (findRolePointsItem(actor, CHEER_POINTS_NAME)?.system.resource.value ?? 0) >= 1;
  }

  if (sourceId == CRACK_UP_THE_4TH_WALL_ID) {
    return !hasUsedThisEncounter(actor, CRACK_UP_THE_4TH_WALL_ENCOUNTER_FLAG);
  }

  if (sourceId == SIPHON_ID) {
    return true;
  }

  if (sourceId == FORWARD_OBSERVATION_ID) {
    return true;
  }

  if (sourceId == HEARTY_MEAL_ID) {
    return true;
  }

  if (sourceId == YOUR_SAFETYS_ON_ID) {
    return true;
  }

  if (sourceId == TRIGGER_REACTION_ID) {
    return true;
  }

  if (sourceId == NOT_DEAD_YET_ID) {
    return canUseNotDeadYet(actor);
  }

  if (sourceId == VIBRATING_PALM_ID) {
    return canUseVibratingPalm(actor);
  }

  if (sourceId == CACHE_I_ID) {
    return canUseCache(actor);
  }

  if (sourceId == UNINTERRUPTED_BREAK_ID) {
    return canUseUninterruptedBreak(actor);
  }

  if (sourceId == TENDER_ID) {
    return !!getEmpathyChoice(actor);
  }

  if (sourceId == ELEMENTAL_STORM_ID) {
    return actor.system.powers.personal.value >= 1 && !hasUsedThisEncounter(actor, ELEMENTAL_STORM_ENCOUNTER_FLAG);
  }

  if (sourceId == ORANGE_RANGER_PRIME_ID) {
    return !hasUsedThisEncounter(actor, ORANGE_RANGER_PRIME_ENCOUNTER_FLAG);
  }

  if (sourceId == COMIC_FLAIR_ID) {
    return true;
  }

  if (sourceId == POWERED_PLATING_ID) {
    return actor.system.isMorphed && actor.system.powers.personal.value > 0;
  }

  if (sourceId == GRID_SOLDIER_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == PARADOX_ID) {
    return !hasUsedThisEncounter(actor, PARADOX_ENCOUNTER_FLAG);
  }

  if (sourceId == EXPLOSIVE_MORPH_ID) {
    return actor.system.isMorphed && actor.system.powers.personal.value >= 1;
  }

  if (sourceId == ELTARIAN_METTLE_ID) {
    return actor.system.powers.personal.value >= 1;
  }

  if (sourceId == BALANCE_AND_HARMONY_ID) {
    return canUseBalanceAndHarmony(actor);
  }

  if (sourceId == NU_POGODI_ID) {
    return canUseNuPogodiCondition(actor);
  }

  if (sourceId == THE_QUIET_ONE_ID) {
    return canUseQuietOne(actor);
  }

  if (EMT_CRASH_COURSE_IDS.includes(sourceId)) {
    // Always available - the picker itself drops the heal option once it's used, and the
    // Essence-restore half has no cost or frequency cap to check ahead of time (an ineligible
    // target surfaces a warning at click time instead, same as Comic Flair above).
    return true;
  }

  if (sourceId == WISDOM_OF_THE_ELDERS_ID) {
    const option = item.system.choice;
    if (!option || !WISDOM_OF_THE_ELDERS_OPTIONS[option]) {
      return false;
    }

    // Teleportation is an instant effect (no ON state to switch back to for free); every other
    // option is always usable to switch back OFF, only switching ON needs the option's own cost.
    if (option == 'teleportation') {
      return canAffordWisdomOfTheElders(actor, option);
    }

    return isWisdomOfTheEldersActive(actor, option) || canAffordWisdomOfTheElders(actor, option);
  }

  if (sourceId == MENACE_ID) {
    return canUseMenace(actor);
  }

  if (sourceId == DISTRACTING_OFFER_ID) {
    return canUseDistractingOffer(actor, game.user.targets.first()?.actor);
  }

  if (sourceId == MATURED_ID) {
    return (actor?.items?.filter(i => i.type == 'hangUp').length ?? 0) > 0;
  }

  if (sourceId == GROWL_ID) {
    return canUseGrowl(actor, game.user.targets.first()?.actor?.id);
  }

  // Tear Down (Cobra Codex, Taskmaster Focus, 3rd level, p.59) - see helpers/tear-down.mjs's own
  // doc comment. Always clickable, same as Mark Target/Primary Quarry above (no cost, no once-
  // per-turn gate, unlike Growl above).
  if (sourceId == TEAR_DOWN_ID) {
    return true;
  }

  if (sourceId == BEAST_MODE_ID) {
    // Always usable to switch back OFF (free); switching ON needs 1 Adaptation Point.
    return isBeastModeActive(actor) || !!actor._getBaseRolePoints?.()?.system.resource.value;
  }

  if (sourceId == HARASS_ID) {
    return canUseHarass(actor);
  }

  if (sourceId == ANTAGONISTIC_ID) {
    return true;
  }

  if (sourceId == FLYING_NUISANCE_ID) {
    return true;
  }

  if (sourceId == VERSATILE_PROTECTION_ID) {
    return true;
  }

  if (sourceId == PACK_ATTACK_ID) {
    return canUsePackAttack(actor);
  }

  if (sourceId == ANIMAL_GAIT_ID) {
    return true;
  }

  if (sourceId == HUMAN_BULLET_ID) {
    return true;
  }

  if (sourceId == EXPANDED_MYSTICISM_ID) {
    return canUseExpandedMysticism(actor);
  }

  if (sourceId == MYSTICAL_UNDERSTANDING_ID) {
    return canUseMagicallyFitIn(actor);
  }

  if (sourceId == PERSONAL_HEIRLOOM_ID) {
    return canDesignateHeirloom(actor);
  }

  if (sourceId == FACE_ME_ID) {
    return true;
  }

  if (sourceId == DIG_DEEP_PR_CRB_ID) {
    return canUseDigDeepPrCrb(actor);
  }

  if (sourceId == RIGHTEOUS_HEART_ID) {
    return canUseRighteousHeart(actor);
  }

  if (sourceId == BIO_ENERGY_CONVERSION_ID) {
    return canUseBioEnergyConversion(actor);
  }

  if (sourceId == AUGMENT_POWER_ID) {
    return canUseAugmentPower(actor);
  }

  if (sourceId == CONSULT_MEMORIES_ID) {
    return canUseConsultMemories(actor);
  }

  if (sourceId == RESOURCEFUL_ID) {
    return canUseResourceful(actor);
  }

  if (sourceId == THE_RETURNED_ID) {
    return canUseTheReturned(actor);
  }

  const immediate = IMMEDIATE_ALLY_PERKS[sourceId];
  if (immediate) {
    // Unlike a bankable Perk's own already-pending gate, the only things that could make this
    // unusable right now are a once-per-scene gate (onceEncounterFlag) or not being able to afford
    // it - there's no nearby-ally check here since that's a "nothing to pick" case surfaced via a
    // warning at click time (onImmediateAllyPerkUse below), not a reason to hide the button
    // entirely. Both costs are checked independently (Healing Light charges both at once; every
    // other entry sets only one, and the unset one - defaulting to 0/undefined - trivially passes
    // its own check).
    if (immediate.onceEncounterFlag && hasUsedThisEncounter(actor, immediate.onceEncounterFlag)) {
      return false;
    }

    if (immediate.healthCost && actor.system.health.value < immediate.healthCost) {
      return false;
    }

    // Squad Guardian - a Moxie spend (a rolePoints resource) rather than Power/Health, looked up by
    // name (rolePointsName) instead of assuming the actor's base Role's own points - see
    // SQUAD_GUARDIAN_ID's own comment above for why.
    if (immediate.rolePointCost) {
      const rolePoints = immediate.rolePointsName
        ? findRolePointsItem(actor, immediate.rolePointsName)
        : actor._getBaseRolePoints?.();
      if (!rolePoints?.system.resource.value) {
        return false;
      }
    }

    return !immediate.powerCost || actor.system.powers.personal.value >= immediate.powerCost;
  }

  const bankable = BANKABLE_PERKS[sourceId];
  if (!bankable) {
    return false;
  }

  if (bankable.onceEncounterFlag && hasUsedThisEncounter(actor, bankable.onceEncounterFlag)) {
    return false;
  }

  // "Once per session/day" - the Scene Clock's mission window.
  if (bankable.onceMissionFlag && getUses(actor, bankable.onceMissionFlag, 'mission') >= 1) {
    return false;
  }

  // Roll with the Punches (Slammer) - see SLAMMER_ROLL_WITH_THE_PUNCHES_ID's own comment above.
  if (bankable.perCombatCapFlag) {
    const cap = getEffectiveLevel(actor) >= 6 ? 2 : 1;
    if (getUsesThisEncounter(actor, bankable.perCombatCapFlag) >= cap) {
      return false;
    }
  }

  if (bankable.onceTurnFlag && hasUsedThisTurn(actor, bankable.onceTurnFlag)) {
    return false;
  }

  if (bankable.onceRoundFlag && hasUsedThisRound(actor, bankable.onceRoundFlag)) {
    return false;
  }

  if (bankable.spendsRolePoint && !actor._getBaseRolePoints?.()?.system.resource.value) {
    return false;
  }

  if (bankable.powerCost && actor.system.powers.personal.value < bankable.powerCost) {
    return false;
  }

  // I Got You (Enigma of Combination, Team Leader Focus, 3rd level, p.30) - see its own
  // BANKABLE_PERKS entry below. Same upfront-affordability idiom powerCost's own check uses,
  // just against the Energon pool instead of Personal Power.
  if (bankable.energonCost && !(actor.system.energon?.normal?.value >= bankable.energonCost)) {
    return false;
  }

  // Benefits of Command - see its own BANKABLE_PERKS comment above. Same upfront-affordability
  // idiom hasRerollCost's own worldStoryPoints check already uses.
  if (bankable.worldStoryPointCost && !(canWriteStoryPoints() && hasStoryPointsAvailable(bankable.worldStoryPointCost))) {
    return false;
  }

  const targetActor = bankable.target == 'self' ? actor : null;
  return targetActor ? !getPendingBonus(targetActor, bankable.flagKey) : true;
}

/**
 * Prompts for which of EMT Crash Course's two halves to invoke - see its own EMT_CRASH_COURSE_ID
 * comment above for why these can't share one "Use" button dispatch. The heal option is dropped
 * from the list entirely once it's already been used this scene, the same "hide what's genuinely
 * unusable" idiom canUsePerk normally applies at the whole-button level, just applied here at the
 * sub-choice level since the Essence-restore option must stay available regardless.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   'heal' or 'restoreEssence', or null if cancelled.
 */
async function pickEmtCrashCourseAction(actor) {
  const healAvailable = !hasUsedThisEncounter(actor, EMT_CRASH_COURSE_ENCOUNTER_FLAG);
  const options = [
    healAvailable && `<option value="heal">${game.i18n.localize('E20.EmtCrashCourseHealOption')}</option>`,
    `<option value="restoreEssence">${game.i18n.localize('E20.EmtCrashCourseRestoreEssenceOption')}</option>`,
  ].filter(Boolean).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EmtCrashCoursePickActionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EmtCrashCoursePickActionLabel')
    }</label><select name="action">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.action.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for which Defense (Toughness, Willpower, or Evasion) Roll With the Punches should
 * protect - see its own BANKABLE_PERKS entry above. Cleverness isn't offered; RAW only names
 * these three.
 * @returns {Promise<String|null>}   One of 'toughness'/'willpower'/'evasion', or null if
 *   cancelled.
 */
async function pickDefenseType() {
  const options = ['toughness', 'willpower', 'evasion']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RollWithThePunchesPickDefenseTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RollWithThePunchesPickDefenseLabel')
    }</label><select name="defenseType">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.defenseType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for which of a Perk's own fixed Defense-bonus allocations to bank this turn - Stalwart
 * Defense/Sword And Board's own "choose one of these bonuses to Defense" shape (see their own
 * BANKABLE_PERKS entries above), each choice a small {toughness, evasion, ...} amounts object.
 * @param {String} perkName   The Perk's own display name, shown in the dialog's title.
 * @param {Array<{labelKey: String, amounts: Object}>} choices
 * @returns {Promise<Object|null>}   The chosen `amounts` object, or null if cancelled.
 */
async function pickDefenseAllocation(perkName, choices) {
  const options = choices
    .map((choice, index) => `<option value="${index}">${game.i18n.localize(choice.labelKey)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format('E20.PickDefenseAllocationTitle', { perk: perkName }) },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PickDefenseAllocationLabel')
    }</label><select name="choiceIndex">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.choiceIndex.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (chosen == null || chosen == 'cancel') {
    return null;
  }

  return choices[Number(chosen)]?.amounts ?? null;
}

/**
 * Prompts for which Condition Hobble (Decepticon Directive Raider, Acquisitions Expert Focus,
 * 20th level, p.63) should inflict on a successfully-hit target - "your choice" of Immobilized,
 * Prone, or Restrained. Same DialogV2 shape as pickDefenseType above, called from dice.mjs's own
 * post-hit processing (see checkContext.hobbleAttempt).
 * @returns {Promise<String|null>}   One of 'immobilized'/'prone'/'restrained', or null if
 *   cancelled.
 */
export async function pickHobbleCondition() {
  const options = ['immobilized', 'prone', 'restrained']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.statusEffects.find(s => s.id == key).name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.HobblePickConditionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.HobblePickConditionLabel')
    }</label><select name="condition">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.condition.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for which Condition Guardian Strikes (A Jump Through Time, Grid Power, p.57) should
 * inflict on a successfully-hit target - "your choice" of Impaired, Prone, or Restrained. Same
 * DialogV2 shape as pickHobbleCondition just above, called from dice.mjs's own post-hit processing
 * (see checkContext.guardianStrikesAttempt).
 * @returns {Promise<String|null>}   One of 'impaired'/'prone'/'restrained', or null if cancelled.
 */
export async function pickGuardianStrikesCondition() {
  const options = ['impaired', 'prone', 'restrained']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.statusEffects.find(s => s.id == key).name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.GuardianStrikesPickConditionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.GuardianStrikesPickConditionLabel')
    }</label><select name="condition">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.condition.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Applies Helping Hand-shaped immediate-ally-effect Perks (see IMMEDIATE_ALLY_PERKS' own doc
 * comment above) - unlike onPerkUse's bankable half below, this heals the chosen ally right now,
 * with no flag banked for a later roll to consume.
 * @param {Item} item   The Perk item being used.
 * @param {Actor} actor   The actor using the Perk.
 * @param {Object} config   This Perk's own IMMEDIATE_ALLY_PERKS entry.
 */
async function onImmediateAllyPerkUse(item, actor, config) {
  if (config.onceEncounterFlag && hasUsedThisEncounter(actor, config.onceEncounterFlag)) {
    return;
  }

  if (config.healthCost && actor.system.health.value < config.healthCost) {
    ui.notifications.warn(game.i18n.localize('E20.HealthOverSpent'));
    return;
  }

  if (config.powerCost && actor.system.powers.personal.value < config.powerCost) {
    ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
    return;
  }

  const rolePoints = config.rolePointCost
    ? (config.rolePointsName ? findRolePointsItem(actor, config.rolePointsName) : actor._getBaseRolePoints?.())
    : null;
  if (config.rolePointCost && !rolePoints?.system.resource.value) {
    ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
    return;
  }

  let targetActor;
  const candidateAllies = getNearbyAllyTokens(actor, config.radiusFeet)
    .map(token => token.actor)
    .filter(a => a && (!config.requireMorphed || a.system.isMorphed)
      && (!config.requireDefeatedStatus || a.statuses?.has('defeated')));
  if (config.includeSelf) {
    candidateAllies.unshift(actor);
  }

  [targetActor] = await pickAllyTargets(actor, candidateAllies, item.name);
  if (!targetActor) {
    return;
  }

  if (config.healthCost) {
    await actor.update({ 'system.health.value': actor.system.health.value - config.healthCost });
  }

  if (config.powerCost) {
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - config.powerCost });
  }

  if (config.rolePointCost) {
    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
  }

  // Healing Light (Across the Stars, Phantom Ranger, Phantom Focus choice, p.62) - a rolled
  // amount (2d2), unlike every other entry's fixed/scaling number - see its own comment above.
  const healAmount = config.rollsHeal
    ? (await new Roll(config.rollsHeal, actor.getRollData()).evaluate()).total
    : config.healAmount;

  await targetActor.update({
    'system.health.value': Math.min(targetActor.system.health.max, targetActor.system.health.value + healAmount),
  });

  if (config.removeDefeated) {
    await targetActor.toggleStatusEffect('defeated', { active: false });
  }

  if (config.onceEncounterFlag) {
    await markUsedThisEncounter(actor, config.onceEncounterFlag);
  }

  postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: targetActor.name }));
}

/**
 * Banks whichever bonus the given Perk grants, or applies an immediate-ally effect - called from
 * the sheet's own "Use" click.
 * @param {Item} item   The Perk item being used.
 */
export async function onPerkUse(item) {
  const actor = item?.parent;
  const sourceId = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
  if (!actor) {
    return;
  }

  // Perks that hand out actions - Motivate, Adrenaline Surge, Ready for Action... See
  // helpers/action-perks.mjs#ACTION_PERK_USES.
  if (isActionPerkUse(item)) {
    const message = await useActionPerk(item);
    if (message) {
      postPerkUseChatCard(actor, message);
    }

    return;
  }

  if (isTeamBuffPerk(item)) {
    return onTeamBuffPerkUse(item, actor);
  }

  if (sourceId == RELIC_KEY_ID) {
    await declareRelicKeyEdge(actor);
    return;
  }

  if (sourceId == ENERGY_AFFINITY_ID) {
    await onEnergyAffinityUse(actor);
    return;
  }

  if (sourceId == SELF_PRESERVATION_ID) {
    await activateSelfPreservation(actor);
    return;
  }

  if (sourceId == EXTRA_ROUGH_TRAINING_ID) {
    const result = await activateExtraRoughTraining(actor);
    if (result == null) {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
    }

    return;
  }

  if (sourceId == HUP_HUP_HUP_HUP_HUP_ID) {
    await activateHupHupHupHupHup(actor);
    return;
  }

  if (sourceId == HUMANITARIAN_ID) {
    await activateHumanitarianRoll(actor);
    return;
  }

  if (sourceId == ENTROPIC_SPONGE_ID) {
    await activateEntropicSponge(actor);
    return;
  }

  if (sourceId == I_KNOW_A_GUY_ID) {
    await activateIKnowAGuyRoll(actor);
    await markUsedThisEncounter(actor, I_KNOW_A_GUY_ENCOUNTER_FLAG);
    return;
  }

  if (isSkillSubstitutionPerk(sourceId)) {
    await activateSkillSubstitutionPerk(actor, sourceId);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == STUDIOUS_MEASURES_ID) {
    const content = revealStudiousMeasuresQuarry(actor);
    if (content) {
      postPerkUseChatCard(actor, content);
    }

    return;
  }

  if (sourceId == WELDS_RIVETS_AND_IDEAS_ID) {
    await rollWeldsRivetsAndIdeas(actor);
    return;
  }

  if (sourceId == PSYCHOLOGICAL_SWAY_ID) {
    await activatePsychologicalSway(actor);
    return;
  }

  if (sourceId == ON_TARGET_ID) {
    await activateOnTarget(actor);
    return;
  }

  if (sourceId == MARK_TARGET_ID) {
    const marked = await markTarget(actor);
    if (marked) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == PRIMARY_QUARRY_ID) {
    const designated = await designatePrimaryQuarry(actor);
    if (designated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == KNOWN_ACCOMPLICES_ID) {
    if (!(actor.system.energon?.normal?.value >= 1)) {
      ui.notifications.warn(game.i18n.localize('E20.EnergonOverSpent'));
      return;
    }

    const designated = await designateKnownAccomplice(actor);
    if (designated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == MARK_EVERYBOT_ID) {
    await activateMarkEverybot(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  // I Got You - see helpers/lend-assistance.mjs's own I_GOT_YOU_ID comment. Two independent grants
  // behind one button (unconditional Lend Assistance access, and the pre-existing once/round
  // Energon-for-↑1 bankable entry below) - asks which one before dispatching, rather than letting
  // LEND_ASSISTANCE_PERK_IDS' own check just below silently shadow the bankable path every click.
  // Choosing "energon" falls through (no return) to this function's own generic bankable-perk
  // handling further down, unchanged from before this Perk carried a second grant.
  // Inner Magic - see helpers/inner-magic.mjs's own doc comment. Stacks the Willpower Defense
  // reduction, then falls through (no return) to this function's own generic bankable-perk
  // handling further down, which grants the already-built ↑1 Spellcasting half unchanged.
  if (sourceId == INNER_MAGIC_WILLPOWER_ID) {
    await stackInnerMagicWillpowerReduction(actor);
  }

  if (sourceId == I_GOT_YOU_ASSIST_ID) {
    const chosenAction = await pickIGotYouAction();
    if (chosenAction == 'assist') {
      const result = await activateLendAssistance(actor);
      if (!result.cancelled) {
        postPerkUseChatCard(actor, result.message);
      }

      return;
    } else if (chosenAction != 'energon') {
      return;
    }
  }

  // Team Player / Bureaucrat - see helpers/lend-assistance.mjs's own doc comment. The button takes
  // the whole Lend Assistance action (either half); each Perk's own payoff (Team Player's Story
  // Point, Bureaucrat's added Edge) is applied inside it, only on an assist that actually landed.
  if (LEND_ASSISTANCE_PERK_IDS.includes(sourceId)) {
    const result = await activateLendAssistance(actor);
    if (!result.cancelled) {
      postPerkUseChatCard(actor, result.message);
    }

    return;
  }

  if (sourceId == QUICK_AND_QUIET_ID) {
    const surprised = await activateQuickAndQuiet(actor);
    if (surprised) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  // No chat card here: the roll this kicks off posts its own, and the Surprises land on its
  // results rather than on this click - same as Absolute Menace's own dispatch.
  if (sourceId == VOICE_OF_NIGHT_VALE_ID) {
    await activateVoiceOfNightVale(actor);
    return;
  }

  // Help Yourself - see helpers/help-yourself.mjs's own doc comment. Only the SKILL half: RAW lets
  // the clone "Lend Assistance" with no choice of halves, and the combat half is an Edge on an
  // attack against one target the assister designates - something a clone that "can do nothing
  // except Lend Assistance" has no way to spot for you. So this skips activateLendAssistance's own
  // mode picker (and with it the Team Player payoff, which keys off the caster taking the ACTION -
  // here the clone acts, not them) and calls the skill half directly, at the clone's own 15ft.
  if (sourceId == HELP_YOURSELF_ID) {
    const assisted = await lendAssistanceSkill(actor, { radiusFeet: HELP_YOURSELF_RADIUS_FEET });
    if (assisted) {
      await markUsedThisRound(actor, HELP_YOURSELF_ROUND_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == ENERGON_PARASITE_ID) {
    const drainAmount = await activateEnergonParasite(actor);
    if (drainAmount > 0) {
      postPerkUseChatCard(actor, game.i18n.format('E20.EnergonParasiteNotification', { actor: actor.name, amount: drainAmount }));
    }

    return;
  }

  if (sourceId == NEMESIS_ID) {
    const declared = await declareNemesis(actor);
    if (declared) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == NEMESIS_DD_PERK_ID) {
    const declared = await declareDecepticonNemesis(actor);
    if (declared) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == TIMELY_TEAMMATE_ID) {
    const traded = await activateTimelyTeammate(actor);
    if (traded) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == ROAR_ID) {
    const activated = await activateRoar(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == TWO_HEADS_ARE_BETTER_THAN_ONE_ID) {
    if (!canUseTwoHeadsAreBetterThanOne(actor)) {
      return;
    }

    const marked = await activateTwoHeadsAreBetterThanOne(actor);
    if (marked) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    } else {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
    }

    return;
  }

  if (sourceId == PSYCHO_ASSAULT_ID) {
    const activated = await activatePsychoAssault(actor);
    if (!activated) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == NEMESIS_DRAIN_ID) {
    if (actor.system.powers.personal.value < 2 || hasUsedThisEncounter(actor, NEMESIS_DRAIN_ENCOUNTER_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
    await markUsedThisEncounter(actor, NEMESIS_DRAIN_ENCOUNTER_FLAG);
    await activateNemesisDrain(actor);
    return;
  }

  if (sourceId == RIGHT_BEHIND_YOU_ID) {
    if (!game.combat || game.combat.round != 1 || actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    // Spent only once the ally-Initiative lookup actually succeeds (see
    // activateRightBehindYou's own doc comment) - a missing/invalid target shouldn't burn the
    // Power for nothing.
    const adjusted = await activateRightBehindYou(actor);
    if (!adjusted) {
      ui.notifications.warn(game.i18n.format('E20.PickAllyNoAllies', { perk: item.name }));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == BETTER_YOU_THAN_ME_ID) {
    const activated = await activateBetterYouThanMe(actor);
    if (!activated) {
      ui.notifications.warn(game.i18n.format('E20.PickAllyNoAllies', { perk: item.name }));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == DISTRACTION_ID) {
    const nowActive = await toggleDistraction(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.DistractionRequiresMorphed'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.DistractionActivated' : 'E20.DistractionDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == POWER_BLEED_ID) {
    const activated = await activatePowerBleed(actor);
    if (!activated) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == MAXIMIZE_FLAWS_ID) {
    const activated = await activateMaximizeFlaws(actor);
    if (!activated) {
      ui.notifications.warn(game.i18n.localize('E20.MaximizeFlawsNoTarget'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == GROWING_SMOLDER_ID) {
    const stacks = await activateGrowingSmolder(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.GrowingSmolderActivated', { actor: actor.name, stacks }));
    return;
  }

  if (sourceId == TOXIC_TERROR_ID) {
    const nowActive = await toggleToxicTerror(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.ToxicTerrorActivated' : 'E20.ToxicTerrorDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == VENOM_WARLORD_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    const removed = await applyEltarianMettle(actor);
    if (!removed) {
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PROTECTED_TARGET_ID) {
    const designated = await designateProtectedTarget(actor);
    if (designated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == ROUSE_ID) {
    // "As a Standard action" - Rousing Presence makes it a Move action (helpers/action-perks.mjs).
    const paid = await spend(actor, 'standard', { source: item.name, context: { kind: 'rouse' } });
    if (paid.blocked) {
      return;
    }

    await activateRouse(actor);
    return;
  }

  if (sourceId == ROUSING_COMEBACK_ID) {
    await activateRousingComeback(actor);
    return;
  }

  if (sourceId == KNIGHTS_JUMP_ID) {
    const succeeded = await activateKnightsJump(actor);
    if (succeeded) {
      await markUsedThisTurn(actor, KNIGHTS_JUMP_TURN_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == DIRTY_TRICK_ID) {
    await activateDirtyTrick(actor);
    return;
  }

  if (sourceId == HONORIFIC_TOKEN_ID) {
    if (!canWriteStoryPoints()) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    requestStoryPointGrant(actor);
    await markUsedThisEncounter(actor, HONORIFIC_TOKEN_ENCOUNTER_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PARTY_POWER_ID) {
    if (!canWriteStoryPoints()) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    // Fun Exhaustion - see helpers/fun-exhaustion.mjs's own doc comment. Checked BEFORE marking
    // this use, so it triggers on the SECOND (and later) use this scene, not the first.
    const isRepeatPartyPowerUse = getUsesThisScene(actor, PARTY_POWER_SCENE_FLAG) >= 1;

    requestStoryPointGrant(actor);
    await markUsedThisScene(actor, PARTY_POWER_SCENE_FLAG);
    if (isRepeatPartyPowerUse && hasFunExhaustionHangUp(actor)) {
      await applyFunExhaustionBlock(actor);
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == STAY_IN_FORMATION_ID) {
    const applied = await activateStayInFormation(actor);
    if (applied) {
      await markUsedThisEncounter(actor, STAY_IN_FORMATION_ENCOUNTER_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == CONCENTRATE_FIRE_ID) {
    if (!canWriteStoryPoints()) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    const marked = await markConcentrateFireTarget(actor);
    if (marked) {
      requestStoryPointSpend(actor, 1);
      await markUsedThisEncounter(actor, CONCENTRATE_FIRE_ENCOUNTER_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == PHANTOM_GIJ_ID) {
    await activatePhantom(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SURFACE_READ_ID) {
    if (!canWriteStoryPoints()) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    requestStoryPointSpend(actor, 1);
    const shift = actor.system.skills.alertness.shift;
    const roll = await new Roll(shift, actor.getRollData()).evaluate();
    postPerkUseChatCard(actor, game.i18n.format('E20.SurfaceReadResult', { actor: actor.name, count: roll.total }));
    return;
  }

  if (sourceId == SUGGESTION_ID) {
    await markUsedThisEncounter(actor, SUGGESTION_ENCOUNTER_FLAG);
    await actor._dice.rollSkill({
      skill: 'persuasion',
      essence: 'social',
      shiftUp: 0,
      shiftDown: 0,
      defenseType: 'willpower',
    }, actor);
    return;
  }

  if (sourceId == TALK_THEM_DOWN_ID) {
    const nearbyAllies = getNearbyAllyTokens(actor, Infinity).length;
    const nearbyEnemies = getNearbyEnemyTokens(actor, Infinity).length;
    if (nearbyAllies > nearbyEnemies) {
      ui.notifications.info(game.i18n.localize('E20.TalkThemDownOutnumbering'));
    } else if (nearbyEnemies > nearbyAllies) {
      ui.notifications.info(game.i18n.localize('E20.TalkThemDownOutnumbered'));
    }

    await actor._dice.rollSkill({
      skill: 'persuasion',
      essence: 'social',
      shiftUp: 0,
      shiftDown: 0,
      defenseType: 'willpower',
      isTalkThemDown: true,
    }, actor);
    return;
  }

  if (sourceId == TIME_TRAVELER_PERK_ID) {
    const wasActive = !!getTimeTravelerActiveSkill(actor);
    if (!wasActive && !canWriteStoryPoints()) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    const activeSkill = await toggleTimeTravelerSnagImmunity(actor);
    if (!wasActive && !activeSkill) {
      return; // Picker was cancelled - nothing spent, nothing to announce.
    }

    postPerkUseChatCard(actor, game.i18n.format(
      activeSkill ? 'E20.TimeTravelerActivated' : 'E20.TimeTravelerDeactivated',
      { actor: actor.name, skill: activeSkill ? game.i18n.localize(E20.skills[activeSkill]) : '' },
    ));
    return;
  }

  if (sourceId == INSPIRING_WORDS_ID) {
    if (!canUseInspiringWords(actor)) {
      return;
    }

    const candidateAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
    const [targetActor] = await pickAllyTargets(actor, candidateAllies, item.name);
    if (!targetActor) {
      return;
    }

    const effect = await pickInspiringWordsEffect();
    if (!effect) {
      return;
    }

    if (effect == 'tempHealth') {
      await targetActor.update({ 'system.health.bonus': (targetActor.system.health.bonus || 0) + 1 });
    } else if (effect == 'removeCondition') {
      const condition = await pickInspiringWordsCondition(targetActor);
      if (!condition) {
        return;
      }

      await targetActor.toggleStatusEffect(condition, { active: false });
    } else if (effect == 'shiftUp') {
      await bankPendingBonus(targetActor, 'pendingInspiringWords', { shiftUp: 2 }, { granter: actor });
    }

    await markInspiringWordsUsed(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == TRADE_SCHOOL_ID) {
    if (!canUseTradeSchool(actor)) {
      return;
    }

    const candidateAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
    const [targetActor] = await pickAllyTargets(actor, candidateAllies, item.name);
    if (!targetActor) {
      return;
    }

    await activateTradeSchool(actor, targetActor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == TECH_SPECS_ID) {
    await activateTechSpecs(actor);
    return;
  }

  if (sourceId == BREAKING_POINT_ID) {
    await activateBreakingPoint(actor);
    return;
  }

  if (sourceId == DEADSTICK_ID) {
    await activateDeadstick(actor);
    return;
  }

  if (sourceId == GROUND_SUPPRESSION_ID) {
    await activateGroundSuppression(actor);
    return;
  }

  // Fly In The Future - see helpers/evasive-maneuvers.mjs. A plain on/off toggle like Dig In
  // below, except the flag lands on the VEHICLE rather than the clicker.
  if (sourceId == FLY_IN_THE_FUTURE_ID) {
    const nowEvasive = await toggleEvasiveManeuvers(actor);
    if (nowEvasive === null) {
      ui.notifications.warn(game.i18n.localize('E20.EvasiveManeuversNoVehicle'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(
      nowEvasive ? 'E20.EvasiveManeuversActivated' : 'E20.EvasiveManeuversDeactivated',
      { actor: actor.name },
    ));
    return;
  }

  // Scramble - see helpers/scramble.mjs's own doc comment. Same plain on/off toggle shape as Dig
  // In just below, flag lands on the clicker.
  if (sourceId == SCRAMBLE_ID) {
    const nowActive = await toggleScramble(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.ScrambleActivated' : 'E20.ScrambleDeactivated',
      { actor: actor.name },
    ));
    return;
  }

  // Extended Attack - see helpers/extended-attack.mjs's own doc comment. Same plain on/off toggle
  // shape as Scramble above.
  if (sourceId == EXTENDED_ATTACK_ID) {
    const nowActive = await toggleExtendedAttack(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.ExtendedAttackActivated' : 'E20.ExtendedAttackDeactivated',
      { actor: actor.name },
    ));
    return;
  }

  // Stand Firm - see STAND_FIRM_ID's own comment above. Doubles whichever amounts Stalwart
  // Defense's own picker already banked this turn, in place - canUsePerk already gated the
  // button on there being something to double.
  if (sourceId == STAND_FIRM_ID) {
    const pending = getPendingBonus(actor, STALWART_DEFENSE_FLAG);
    if (!pending) {
      return;
    }

    const doubledAmounts = Object.fromEntries(
      Object.entries(pending.defenseAmounts ?? {}).map(([key, value]) => [key, value * 2]),
    );
    await bankPendingBonus(actor, STALWART_DEFENSE_FLAG, { defenseAmounts: doubledAmounts });
    postPerkUseChatCard(actor, game.i18n.format('E20.StandFirmActivated', { actor: actor.name }));
    return;
  }

  // Mode Attachment - see helpers/mode-attachment.mjs's own doc comment. Stores the choice
  // directly on the Hang-Up item (system.choice), same field every other choice-picker Perk uses.
  if (sourceId == MODE_ATTACHMENT_ID) {
    const choice = await pickModeAttachmentChoice(actor);
    if (choice) {
      await item.update({ 'system.choice': choice });
    }

    return;
  }

  // Favorite Weapon - see helpers/favorite-weapon.mjs's own doc comment. Same
  // store-onto-system.choice shape as Mode Attachment just above.
  if (sourceId == FAVORITE_WEAPON_ID) {
    const choice = await pickFavoriteWeapon(actor);
    if (choice) {
      await item.update({ 'system.choice': choice });
    }

    return;
  }

  // Mass Shift - see helpers/mass-shift.mjs's own doc comment.
  if (sourceId == MASS_SHIFT_ID) {
    const activated = await activateMassShift(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == DIG_IN_ID) {
    const nowDugIn = await toggleDigIn(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowDugIn ? 'E20.DigInActivated' : 'E20.DigInDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == UNMOVABLE_ID) {
    const nowActive = await toggleUnmovable(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.UnmovableActivated' : 'E20.UnmovableDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == RISE_AGAIN_ID) {
    const activated = await activateRiseAgainDefense(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == MEAT_SHIELD_ID) {
    await toggleMeatShield(actor);
    const nowActive = isMeatShieldActive(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.MeatShieldActivated' : 'E20.MeatShieldDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == EMOTIONAL_MASTERY_ID) {
    const activated = await activateEmotionalMastery(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.EmotionalMasteryActivated', { actor: actor.name }));
    }

    return;
  }

  if (sourceId == TEAM_SPIRIT_ID) {
    const activated = await activateTeamSpirit(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.TeamSpiritActivated', { actor: actor.name }));
    }

    return;
  }

  if (sourceId == BOX_SHOT_ID) {
    if (!canUseBoxShot(actor)) {
      return;
    }

    const nowActive = await toggleBoxShot(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.BoxShotActivated' : 'E20.BoxShotDeactivated', { actor: actor.name },
    ));
    return;
  }

  if (sourceId == METALLIKATO_ID) {
    const nowActive = await toggleMetallikatoMultipleTargets(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.MetallikatoMultipleTargetsActivated' : 'E20.MetallikatoMultipleTargetsDeactivated',
      { actor: actor.name },
    ));
    return;
  }

  if (sourceId == INVISIBILITY_ID) {
    if (!canUseInvisibility(actor)) {
      return;
    }

    const nowActive = await toggleInvisibility(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.InvisibilityActivated' : 'E20.InvisibilityDeactivated', { actor: actor.name },
    ));
    return;
  }

  if (sourceId == FRICTIONLESS_MOVEMENT_ID) {
    if (!canUseFrictionlessMovement(actor)) {
      return;
    }

    await activateFrictionlessMovement(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SPRINTER_ID) {
    if (!canUseSprinterBoost(actor)) {
      return;
    }

    await activateSprinterBoost(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == CANNONEER_DIG_IN_ID) {
    const nowDugIn = await toggleCannoneerDigIn(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowDugIn ? 'E20.DigInActivated' : 'E20.DigInDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == SKIER_ID) {
    const nowSkiing = await toggleSkiing(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowSkiing ? 'E20.SkierActivated' : 'E20.SkierDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == ITS_TIME_ID) {
    const nowActive = await toggleItsTime(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.ItsTimeActivated' : 'E20.ItsTimeDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == BULWARK_ID) {
    const nowPlanted = await toggleBulwark(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowPlanted ? 'E20.BulwarkActivated' : 'E20.BulwarkDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == TAKEDOWN_ID) {
    // The Might/Finesse picker runs INSIDE activateTakedown, before anything else happens - a
    // cancelled picker just triggers no roll at all, same "nothing to undo" shape as every other
    // free (no-cost) dispatch in this table.
    await activateTakedown(actor);
    return;
  }

  if (sourceId == SELF_REVIVE_ID) {
    if (!canUseSelfRevive(actor)) {
      return;
    }

    await activateSelfRevive(actor);
    return;
  }

  if (sourceId == I_STILL_FUNCTION_ID) {
    if (!canUseIStillFunction(actor)) {
      return;
    }

    await activateIStillFunction(actor);
    return;
  }

  if (sourceId == OUTWIT_ID) {
    // The Deception/Intimidation picker runs INSIDE activateOutwit, before anything else happens
    // - a cancelled picker just triggers no roll at all, same "nothing to undo" shape as every
    // other free (no-cost) dispatch in this table.
    await activateOutwit(actor);
    return;
  }

  if (sourceId == SHOULDER_TO_SHOULDER_ID) {
    // The target-resolution/skill picker both run INSIDE activateShoulderToShoulder - no target
    // or a cancelled picker just triggers nothing, same "nothing to undo" shape as above.
    await activateShoulderToShoulder(actor);
    return;
  }

  if (sourceId == FEARSOME_PRESENCE_ID) {
    if (!isRecklessAbandonActive(actor)) {
      ui.notifications.warn(game.i18n.localize('E20.FearsomePresenceNotActive'));
      return;
    }

    await activateFearsomePresence(actor);
    return;
  }

  if (sourceId == NATURAL_MOVEMENT_ID) {
    // The Climb/Swim picker runs INSIDE toggleNaturalMovement when switching on - a cancelled
    // picker (result === null) just leaves it off, same "nothing to undo" shape as every other
    // free dispatch here.
    const result = await toggleNaturalMovement(actor);
    if (result === false) {
      postPerkUseChatCard(actor, game.i18n.format('E20.NaturalMovementDeactivated', { actor: actor.name }));
    } else if (result) {
      postPerkUseChatCard(actor, game.i18n.format('E20.NaturalMovementActivated', {
        actor: actor.name, type: game.i18n.localize(E20.movementTypes[result]),
      }));
    }

    return;
  }

  if (sourceId == ENVIRONMENTAL_EXPERTISE_ID) {
    const nowActive = await toggleEnvironmentalExpertise(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.EnvironmentalExpertiseActivated' : 'E20.EnvironmentalExpertiseDeactivated', { actor: actor.name },
    ));
    return;
  }

  if (sourceId == READ_THE_LAND_ID) {
    const wasActive = isEnvironmentalExpertiseActive(actor);
    if (!wasActive) {
      requestStoryPointSpend(actor, 1);
    }

    const nowActive = await toggleEnvironmentalExpertise(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.EnvironmentalExpertiseActivated' : 'E20.EnvironmentalExpertiseDeactivated', { actor: actor.name },
    ));
    return;
  }

  if (sourceId == ADAPTATION_ID) {
    const wasActive = isEnvironmentalExpertiseActive(actor);
    if (!wasActive) {
      const rolePoints = actor._getBaseRolePoints?.();
      if (!rolePoints?.system.resource.value) {
        ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
        return;
      }

      await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
    }

    const nowActive = await toggleEnvironmentalExpertise(actor);
    postPerkUseChatCard(actor, game.i18n.format(
      nowActive ? 'E20.EnvironmentalExpertiseActivated' : 'E20.EnvironmentalExpertiseDeactivated', { actor: actor.name },
    ));
    return;
  }

  if (sourceId == HONEST_ASSESSMENT_ID) {
    const nowActive = await toggleHonestAssessment(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.HonestAssessmentActivated' : 'E20.HonestAssessmentDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == REAL_ANGELS_ID) {
    if (hasUsedThisEncounter(actor, REAL_ANGELS_ENCOUNTER_FLAG)) {
      return;
    }

    await actor.toggleStatusEffect('cover', { active: true });
    await markUsedThisEncounter(actor, REAL_ANGELS_ENCOUNTER_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == DIG_DEEP_ID || sourceId == DIG_DEEP_TF_ID || sourceId == DIG_DEEP_GIJ_ID || sourceId == DIG_DEEP_MLP_ID) {
    if (getUses(actor, DIG_DEEP_ENCOUNTER_FLAG, digDeepWindow(sourceId)) >= 1) {
      return;
    }

    await bankPendingBonus(actor, PENDING_DIG_DEEP_FLAG_KEY, { amount: 1 });
    // "a Snag on all Skill Tests until the end of your next turn" - a timed mark, not one banked Snag.
    const { markDigDeepSnag } = await import("./extensions/fix3-tf/tf-fixes.mjs");
    await markDigDeepSnag(actor, item);
    await markUsed(actor, DIG_DEEP_ENCOUNTER_FLAG, { window: digDeepWindow(sourceId) });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == TIMELINE_ANOMALY_ID) {
    if (hasUsedThisEncounter(actor, TIMELINE_ANOMALY_ENCOUNTER_FLAG)) {
      return;
    }

    const swapped = await swapInitiativeWithTarget(actor);
    if (swapped) {
      await markUsedThisEncounter(actor, TIMELINE_ANOMALY_ENCOUNTER_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == AFTER_YOU_ID) {
    const swapped = await swapInitiativeWithTarget(actor, { requireLowerTarget: true });
    if (swapped) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == QUICK_STUDY_ID || sourceId == GIJ_QUICK_STUDY_ID) {
    if (hasUsedThisEncounter(actor, QUICK_STUDY_ENCOUNTER_FLAG)) {
      return;
    }

    const content = revealTargetDefenses(actor);
    if (content) {
      await markUsedThisEncounter(actor, QUICK_STUDY_ENCOUNTER_FLAG);
      postPerkUseChatCard(actor, content);
    }

    return;
  }

  if (sourceId == FAST_LEARNER_ID) {
    const wasSet = await pickFastLearnerAllocation(actor);
    if (wasSet) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == CASTLING_ID) {
    const candidateAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
    const targetActors = await pickAllyTargets(actor, candidateAllies, item.name, 2);
    if (targetActors.length) {
      await activateCastling(targetActors);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == DANGER_SENSE_ID) {
    const synced = await syncDangerSenseInitiative(actor);
    if (synced) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == MYSTERIOUS_AURA_ID) {
    const activated = await activateMysteriousAura(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == ELECTROMAGNETIC_DISRUPTION_ID) {
    if (item.system.choice != 'pulse') {
      return;
    }

    const activated = await activateElectromagneticDisruptionPulse(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == POINTY_ID) {
    const nowActive = await togglePointy(actor);
    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.PointyActivated' : 'E20.PointyDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == SUPERB_SOLOIST_ID) {
    if (hasUsedThisEncounter(actor, SUPERB_SOLOIST_ENCOUNTER_FLAG)) {
      return;
    }

    const nearbyAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
    for (const ally of nearbyAllies) {
      await bankPendingBonus(ally, 'pendingSuperbSoloist', { edge: true });
    }

    await markUsedThisEncounter(actor, SUPERB_SOLOIST_ENCOUNTER_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == EYE_FOR_APPRAISAL_ID) {
    const marked = await markEyeForAppraisal(actor, item);
    if (marked) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == WRESTLER_PIN_ID) {
    const pinned = await activateWrestlerPin(actor);
    if (pinned) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == WEAPON_CONVERSION_ID) {
    const converted = await convertWeapon(actor);
    if (converted) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == STAND_BEHIND_ME_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await actor.setFlag('essence20', STAND_BEHIND_ME_FLAG, {
      combatId: game.combat?.id ?? null,
      round: game.combat?.round ?? null,
    });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == WHIRLWIND_STRIKE_ID) {
    if (!actor.system.isMorphed || actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await activateWhirlwindStrike(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == HEROIC_INTERVENTION_ID) {
    if (!hasUsedThisEncounter(actor, HEROIC_INTERVENTION_ENCOUNTER_FLAG)) {
      if (!canWriteStoryPoints()) {
        ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
        return;
      }

      requestStoryPointGrant(actor);
      await markUsedThisEncounter(actor, HEROIC_INTERVENTION_ENCOUNTER_FLAG);
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
      return;
    }

    // The Story Point grant is already spent this encounter - see this Perk's own doc comment
    // above for why the same button now falls to its other clause instead.
    if ((actor.system?.powers?.personal?.value ?? 0) < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == NINJA_POWER_ID) {
    const nowActive = await toggleNinjaPower(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == VOLLEY_ID) {
    const nowActive = await toggleVolley(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == GROUP_STRIKE_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    activateGroupStrike(actor, item.system.advances?.currentValue || 10);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == WHATEVER_WE_NEED_ID) {
    const rolePoints = actor._getBaseRolePoints?.();
    if (!rolePoints?.system.resource.value) {
      ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
      return;
    }

    const marked = await markWhateverWeNeed(actor);
    if (marked) {
      await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == POWER_BOOST_ID || sourceId == BRUTE_FORCE_ID) {
    const nowActive = await togglePowerBoost(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.PowerBoostActivated' : 'E20.PowerBoostDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == LANCE_OF_LIGHT_ID) {
    const nowActive = await toggleLanceOfLight(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.LanceOfLightActivated' : 'E20.LanceOfLightDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == MONSTER_MORPH_ID) {
    const nowActive = await toggleMonsterMorph(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.MonsterMorphActivated' : 'E20.MonsterMorphDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == GROW_ID) {
    const nowActive = await toggleGrow(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.MonsterFormRequired'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.GrowActivated' : 'E20.GrowDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == GRID_SURGE_ID) {
    const rolePoints = actor._getBaseRolePoints?.();
    if (!rolePoints?.system.resource.value) {
      ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
      return;
    }

    const choice = await pickGridSurgeOption();
    if (!choice) {
      return;
    }

    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
    await applyGridSurgeOption(actor, choice);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == OBSERVER_ID) {
    const nowActive = await toggleObserverDisguise(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PERFECT_DISGUISE_ID) {
    const nowActive = await togglePerfectDisguise(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PerkUseNoEncounterUsesLeft'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SUPREME_GUARDIAN_ID) {
    await activateSupremeGuardianBlind(actor);
    return;
  }

  if (sourceId == COMBAT_STANCE_ID) {
    const declared = await declareCombatStance(actor);
    if (declared) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == AT_ALL_COST_ID || sourceId == PR_CRB_AT_ALL_COSTS_ID) {
    if (isAtAllCostActive(actor)) {
      await deactivateAtAllCost(actor);
    } else {
      await activateAtAllCost(actor);
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == POWER_ADAPTATION_ID) {
    const option = item.system.choice;
    if (!option || !POWER_ADAPTATION_OPTIONS[option]) {
      return;
    }

    const nowActive = await togglePowerAdaptation(actor, option);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PHANTOM_SUITE_ID) {
    const nowActive = await togglePhantomSuite(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == AGELESS_KNOWLEDGE_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    const skill = await pickAgelessKnowledgeSkill();
    if (!skill) {
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await bankPendingBonus(actor, AGELESS_KNOWLEDGE_FLAG, { skill });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PHANTOM_FOCUS_ID) {
    if (item.system.choice != 'healingLight') {
      return;
    }

    return onImmediateAllyPerkUse(item, actor, HEALING_LIGHT_CONFIG);
  }

  if (sourceId == THROUGH_THE_ARCHES_ID) {
    if (actor.system.powers.personal.value < 2) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
    await applyThroughTheArchesSnag(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == RUSH_THE_LINE_ID) {
    if (!canWriteStoryPoints() || !hasStoryPointsAvailable(1) || hasUsedThisTurn(actor, RUSH_THE_LINE_TURN_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.StoryPointUnavailable'));
      return;
    }

    requestStoryPointSpend(actor, 1);
    await markUsedThisTurn(actor, RUSH_THE_LINE_TURN_FLAG);
    await activateRushTheLine(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == ABSOLUTE_MENACE_ID) {
    if (actor.system.powers.personal.value < 2 || hasUsedThisTurn(actor, ABSOLUTE_MENACE_TURN_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
    await markUsedThisTurn(actor, ABSOLUTE_MENACE_TURN_FLAG);
    await activateAbsoluteMenace(actor);
    return;
  }

  if (sourceId == FRIGHTENING_DISPLAY_ID) {
    await activateFrighteningDisplay(actor);
    return;
  }

  if (sourceId == AVALANCHE_STOMP_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await activateAvalancheStomp(actor);
    return;
  }

  if (sourceId == FIGHT_ME_ID) {
    const marked = await markFightMe(actor);
    if (marked) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == A_LOGICAL_EXPLANATION_ID) {
    await activateALogicalExplanation(actor);
    return;
  }

  if (sourceId == SOOTHE_ID) {
    await activateSoothe(actor);
    return;
  }

  if (sourceId == MANIPULATE_ID) {
    await activateManipulate(actor);
    return;
  }

  if (sourceId == TALK_THEM_UP_ID) {
    await activateTalkThemUp(actor);
    return;
  }

  if (sourceId == TALK_THEM_DOWN_FGTAA_ID) {
    await activateTalkThemDown(actor);
    return;
  }

  if (sourceId == BUMPER_CROP_ID) {
    await activateBumperCrop(actor);
    return;
  }

  if (sourceId == GRAVITY_OPTIONAL_ID) {
    const nowActive = await toggleGravityOptional(actor);
    if (nowActive === null) {
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.GravityOptionalActivated' : 'E20.GravityOptionalDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == PSEUDO_SCIENCE_ID) {
    if (isPseudoScienceActive(actor)) {
      return;
    }

    await activatePseudoScience(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == DUTY_OF_THE_GRAPHITE_ID) {
    const rolePoints = actor._getBaseRolePoints?.();
    if (!rolePoints?.system.resource.value || actor.system.powers.personal.value < 2) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
    await activateDutyOfTheGraphite(actor);
    return;
  }

  if (sourceId == IVE_GOT_YOU_ID) {
    await activateIveGotYou(actor);
    return;
  }

  if (sourceId == EXPANDED_MYSTICISM_ID) {
    await activateExpandedMysticism(actor);
    return;
  }

  if (sourceId == MYSTICAL_UNDERSTANDING_ID) {
    await activateMagicallyFitIn(actor);
    return;
  }

  if (sourceId == PERSONAL_HEIRLOOM_ID) {
    await activateDesignateHeirloom(actor);
    return;
  }

  if (sourceId == FACE_ME_ID) {
    await activateFaceMe(actor);
    return;
  }

  if (sourceId == DIG_DEEP_PR_CRB_ID) {
    await activateDigDeepPrCrb(actor, item);
    return;
  }

  if (sourceId == RIGHTEOUS_HEART_ID) {
    await activateRighteousHeart(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == BIO_ENERGY_CONVERSION_ID) {
    await activateBioEnergyConversion(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == AUGMENT_POWER_ID) {
    await activateAugmentPower(actor, item);
    return;
  }

  if (sourceId == CONSULT_MEMORIES_ID) {
    const activated = await activateConsultMemories(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == RESOURCEFUL_ID) {
    const activated = await activateResourceful(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == THE_RETURNED_ID) {
    await activateTheReturned(actor);
    return;
  }

  if (sourceId == MIND_OVER_MATTER_ID) {
    await activateMindOverMatter(actor);
    return;
  }

  if (sourceId == PATCH_UP_ID) {
    await activatePatchUp(actor);
    return;
  }

  if (sourceId == PREVENTATIVE_MEASURES_ID) {
    await activatePreventativeMeasures(actor);
    return;
  }

  if (sourceId == TOUGH_IT_OUT_ID) {
    await activateToughItOut(actor);
    return;
  }

  if (sourceId == STAND_TOGETHER_ID) {
    await activateStandTogether(actor);
    return;
  }

  if (isCostGatedSubstitutionPerk(sourceId)) {
    const spent = await activateCostGatedSubstitutionPerk(actor);
    if (spent) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == CLEVER_MIND_ID) {
    const spent = await activateCleverMind(actor);
    if (spent) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == ROTTEN_TOMATOES_ID) {
    const spent = await activateRottenTomatoes(actor);
    if (spent) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == TOUGH_CROWD_ID) {
    const spent = await activateToughCrowd(actor);
    if (spent) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == HORSE_AROUND_ID) {
    const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
    if (!rolePoints?.system.resource.value) {
      ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
      return;
    }

    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == CRACK_UP_THE_4TH_WALL_ID) {
    const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
    if (!rolePoints) {
      return;
    }

    const max = rolePoints.system.resource.max ?? Infinity;
    await rolePoints.update({ 'system.resource.value': Math.min(max, rolePoints.system.resource.value + 1) });
    await markUsedThisEncounter(actor, CRACK_UP_THE_4TH_WALL_ENCOUNTER_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SIPHON_ID) {
    await activateSiphon(actor);
    return;
  }

  if (sourceId == MENACE_ID) {
    await activateMenace(actor);
    return;
  }

  if (sourceId == DISTRACTING_OFFER_ID) {
    await activateDistractingOffer(actor);
    return;
  }

  if (sourceId == MATURED_ID) {
    const ignored = await applyMatured(actor);
    if (ignored) {
      postPerkUseChatCard(actor, game.i18n.format('E20.MaturedIgnoredNotification', { actor: actor.name, hangUp: ignored.name }));
    }

    return;
  }

  if (sourceId == GROWL_ID) {
    await activateGrowl(actor);
    return;
  }

  // Tear Down - see helpers/tear-down.mjs's own doc comment.
  if (sourceId == TEAR_DOWN_ID) {
    await activateTearDown(actor);
    return;
  }

  if (sourceId == BEAST_MODE_ID) {
    const nowActive = await toggleBeastMode(actor);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.AdaptationPointOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.BeastModeActivated' : 'E20.BeastModeDeactivated', { actor: actor.name }));
    return;
  }

  if (sourceId == HARASS_ID) {
    await activateHarass(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == ANTAGONISTIC_ID) {
    await activateAntagonistic(actor);
    return;
  }

  if (sourceId == FLYING_NUISANCE_ID) {
    await activateFlyingNuisance(actor);
    return;
  }

  if (sourceId == VERSATILE_PROTECTION_ID) {
    const nowActive = await toggleVersatileProtection(actor);
    if (nowActive === null) {
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format(nowActive ? 'E20.PerkUsedNotification' : 'E20.VersatileProtectionDeactivated', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PACK_ATTACK_ID) {
    const broadcast = await activatePackAttack(actor);
    if (broadcast) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    } else {
      ui.notifications.warn(game.i18n.localize('E20.PackAttackNoAllies'));
    }

    return;
  }

  if (sourceId == ANIMAL_GAIT_ID) {
    const wasActive = !!getAnimalGaitType(actor);
    const nowActive = await toggleAnimalGait(actor);
    if (nowActive === null) {
      return;
    }

    if (nowActive) {
      const movementType = game.i18n.localize(E20.movementTypes[getAnimalGaitType(actor)]);
      postPerkUseChatCard(actor, game.i18n.format('E20.AnimalGaitActivated', { actor: actor.name, movementType }));
    } else if (wasActive) {
      postPerkUseChatCard(actor, game.i18n.format('E20.AnimalGaitDeactivated', { actor: actor.name }));
    }

    return;
  }

  if (sourceId == HUMAN_BULLET_ID) {
    await activateHumanBullet(actor);
    return;
  }

  if (sourceId == FORWARD_OBSERVATION_ID) {
    await activateForwardObservation(actor);
    return;
  }

  if (sourceId == HEARTY_MEAL_ID) {
    await activateHeartyMeal(actor);
    return;
  }

  if (sourceId == YOUR_SAFETYS_ON_ID) {
    await activateYourSafetysOn(actor);
    return;
  }

  if (sourceId == TRIGGER_REACTION_ID) {
    await activateTriggerReaction(actor);
    return;
  }

  if (sourceId == NOT_DEAD_YET_ID) {
    const activated = await activateNotDeadYet(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == VIBRATING_PALM_ID) {
    const activated = await activateVibratingPalm(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == CACHE_I_ID) {
    await activateCache(actor, item.name);
    return;
  }

  if (sourceId == UNINTERRUPTED_BREAK_ID) {
    if (!canUseUninterruptedBreak(actor)) {
      return;
    }

    const benefit = await pickUninterruptedBreakBenefit(actor);
    if (!benefit) {
      return;
    }

    await applyUninterruptedBreakBenefit(actor, benefit);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == TENDER_ID) {
    await activateTender(actor);
    return;
  }

  if (sourceId == ELEMENTAL_STORM_ID) {
    if (actor.system.powers.personal.value < 1 || hasUsedThisEncounter(actor, ELEMENTAL_STORM_ENCOUNTER_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    // The Condition picker runs INSIDE activateElementalStorm, before anything is spent here - see
    // its own doc comment. A cancelled picker returns false, so a declined cast doesn't burn the
    // Power cost or the once-per-scene use, unlike Menacing Glare/Hobble's own post-hit pickers
    // (which run after the cost was already paid via a pre-roll checkbox).
    const activated = await activateElementalStorm(actor);
    if (!activated) {
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await markUsedThisEncounter(actor, ELEMENTAL_STORM_ENCOUNTER_FLAG);
    return;
  }

  if (sourceId == ORANGE_RANGER_PRIME_ID) {
    if (hasUsedThisEncounter(actor, ORANGE_RANGER_PRIME_ENCOUNTER_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.OrangeRangerPrimeUnavailable'));
      return;
    }

    const roll = await new Roll('2d2', actor.getRollData()).evaluate();
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value + roll.total });
    await markUsedThisEncounter(actor, ORANGE_RANGER_PRIME_ENCOUNTER_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == COMIC_FLAIR_ID) {
    const removed = await applyComicFlair(actor);
    if (removed == null) {
      ui.notifications.warn(game.i18n.localize('E20.ComicFlairNoValidTarget'));
      return;
    }

    if (removed.length) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == GRID_SOLDIER_ID) {
    const impairedActor = getGridSoldierImpairedTarget(actor);
    if (!impairedActor) {
      ui.notifications.warn(game.i18n.localize('E20.GridSoldierNoValidTarget'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await impairedActor.toggleStatusEffect('impaired', { active: false });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == PARADOX_ID) {
    if (hasUsedThisEncounter(actor, PARADOX_ENCOUNTER_FLAG)) {
      ui.notifications.warn(game.i18n.localize('E20.ParadoxAlreadyUsed'));
      return;
    }

    const skill = await pickParadoxSkill();
    if (!skill) {
      return;
    }

    await markUsedThisEncounter(actor, PARADOX_ENCOUNTER_FLAG);
    await bankPendingBonus(actor, PARADOX_FLAG, { skill });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == ENGINE_OVERRIDE_ID) {
    const vehicle = await activateEngineOverride(actor);
    if (!vehicle) {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == JURY_RIG_ID) {
    const result = await activateJuryRig(actor);
    if (result == null) {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
    }

    return;
  }

  if (sourceId == OMEGA_ENHANCEMENT_ID) {
    const applied = await activateOmegaEnhancement(actor);
    if (applied) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == SPOT_WELD_ID) {
    if (!canUseSpotWeld(actor)) {
      return;
    }

    const target = await activateSpotWeld(actor);
    if (target == null) {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
    }

    return;
  }

  if (sourceId == IMPROVISE_ARMOR_ID) {
    if (hasUsedThisEncounter(actor, IMPROVISE_ARMOR_ENCOUNTER_FLAG)) {
      return;
    }

    const vehicle = await activateImproviseArmor(actor);
    if (!vehicle) {
      ui.notifications.warn(game.i18n.localize('E20.EngineOverrideNoValidTarget'));
      return;
    }

    await markUsedThisEncounter(actor, IMPROVISE_ARMOR_ENCOUNTER_FLAG);
    return;
  }

  if (sourceId == MARTIAL_LEADERSHIP_ID) {
    const target = await activateMartialLeadership(actor);
    if (!target) {
      ui.notifications.warn(game.i18n.localize('E20.MartialLeadershipNoTarget'));
    }

    return;
  }

  if (sourceId == VOICE_OF_PRIMUS_ID) {
    const target = await activateVoiceOfPrimus(actor);
    if (target === null) {
      ui.notifications.warn(game.i18n.localize('E20.VoiceOfPrimusNoTarget'));
    }

    return;
  }

  if (sourceId == REMOTE_OPERATIONS_ID) {
    await activateRemoteOperations(actor);
    return;
  }

  if (sourceId == AVAST_ID) {
    if (hasUsedThisEncounter(actor, AVAST_ENCOUNTER_FLAG)) {
      return;
    }

    const target = await activateAvast(actor);
    if (target === null) {
      ui.notifications.warn(game.i18n.localize('E20.VoiceOfPrimusNoTarget'));
      return;
    }

    await markUsedThisEncounter(actor, AVAST_ENCOUNTER_FLAG);
    return;
  }

  if (sourceId == WORDS_CAN_HURT_ID) {
    const result = await activateWordsCanHurt(actor);
    if (result === null) {
      ui.notifications.warn(game.i18n.localize('E20.WordsCanHurtNoTarget'));
    } else if (result === 'immune') {
      ui.notifications.warn(game.i18n.localize('E20.WordsCanHurtTargetImmune'));
    }

    return;
  }

  if (sourceId == SIDE_SPLITTER_ID) {
    await activateSideSplitter(actor);
    return;
  }

  if (sourceId == CALMING_WORDS_ID) {
    const result = await activateCalmingWords(actor);
    if (result === null) {
      ui.notifications.warn(game.i18n.localize('E20.CalmingWordsNoTarget'));
    } else if (result === 'noEnergon') {
      ui.notifications.warn(game.i18n.localize('E20.MiseryLovesCompanyNoEnergon'));
    }

    return;
  }

  if (sourceId == POWERFUL_SUGGESTIONS_ID) {
    const target = await activatePowerfulSuggestions(actor);
    if (target === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerfulSuggestionsNoTarget'));
    }

    return;
  }

  if (sourceId == DATA_BRIDGE_ID) {
    if (hasUsedThisTurn(actor, DATA_BRIDGE_TURN_FLAG)) {
      return;
    }

    const choice = await activateDataBridge(actor);
    if (!choice) {
      ui.notifications.warn(game.i18n.localize('E20.DataBridgeNoSpecialization'));
      return;
    }

    await markUsedThisTurn(actor, DATA_BRIDGE_TURN_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == MISERY_LOVES_COMPANY_ID) {
    if (!(actor.system.energon?.normal?.value >= 1)) {
      ui.notifications.warn(game.i18n.localize('E20.MiseryLovesCompanyNoEnergon'));
      return;
    }

    const condition = await applyMiseryLovesCompany(actor);
    if (!condition) {
      return;
    }

    await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == WORK_THE_NUMBERS_ID) {
    if (!(canUseWorkTheNumbers() && actor.system.energon?.normal?.value >= 1)) {
      ui.notifications.warn(game.i18n.localize('E20.EnergonOverSpent'));
      return;
    }

    const moved = await activateWorkTheNumbers();
    if (!moved) {
      ui.notifications.warn(game.i18n.localize('E20.WorkTheNumbersNoValidTarget'));
      return;
    }

    await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == ARCHKEY_ID) {
    await actor._dice.rollSkill({ skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '10' }, actor);
    return;
  }

  if (sourceId == ENERGON_CUBE_ID || sourceId == ENERGON_SNACK_ID) {
    if (!((item.system.quantity ?? 1) > 0)) {
      return;
    }

    const energonGranted = sourceId == ENERGON_CUBE_ID ? 2 : 1;
    await actor.update({ 'system.energon.normal.value': (actor.system.energon?.normal?.value ?? 0) + energonGranted });

    const remaining = (item.system.quantity ?? 1) - 1;
    if (remaining > 0) {
      await item.update({ 'system.quantity': remaining });
      ui.notifications.info(game.i18n.format('E20.MagicBaubleUsed', { actor: actor.name, item: item.name, remaining }));
    } else {
      await item.delete();
      ui.notifications.info(game.i18n.format('E20.MagicBaubleConsumed', { actor: actor.name, item: item.name }));
    }

    return;
  }

  if (sourceId == ENGINE_CELLS_ID) {
    if (!((item.system.quantity ?? 1) > 0)) {
      return;
    }

    const roll = await new Roll('2d2', actor.getRollData()).evaluate();
    await actor.update({
      'system.powers.personal.value': (actor.system.powers?.personal?.value ?? 0) + roll.total,
    });

    const remaining = (item.system.quantity ?? 1) - 1;
    if (remaining > 0) {
      await item.update({ 'system.quantity': remaining });
      ui.notifications.info(game.i18n.format('E20.MagicBaubleUsed', { actor: actor.name, item: item.name, remaining }));
    } else {
      await item.delete();
      ui.notifications.info(game.i18n.format('E20.MagicBaubleConsumed', { actor: actor.name, item: item.name }));
    }

    return;
  }

  if (sourceId == LIKE_WATER_ID) {
    const option = await applyLikeWater(actor);
    if (option) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == IMPOSSIBLE_EXPECTATIONS_ID) {
    const targetActor = game.user.targets.first()?.actor;
    if (!targetActor || targetActor.system.health?.value > 0) {
      ui.notifications.warn(game.i18n.localize('E20.MartialLeadershipNoTarget'));
      return;
    }

    if (!canWriteStoryPoints() || !hasStoryPointsAvailable(1)) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    requestStoryPointSpend(actor, 1);
    await targetActor.update({ 'system.health.value': 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == SMASHMOUTH_OFFENSE_ID) {
    if (hasUsedThisEncounter(actor, SMASHMOUTH_OFFENSE_ENCOUNTER_FLAG)) {
      return;
    }

    if (!canWriteStoryPoints() || !hasStoryPointsAvailable(1)) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    requestStoryPointSpend(actor, 1);
    await markUsedThisEncounter(actor, SMASHMOUTH_OFFENSE_ENCOUNTER_FLAG);
    await bankPendingBonus(actor, SMASHMOUTH_OFFENSE_FLAG);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == STUDY_WEAKNESSES_ID) {
    const targetActor = game.user.targets.first()?.actor;
    if (!targetActor) {
      ui.notifications.warn(game.i18n.localize('E20.MartialLeadershipNoTarget'));
      return;
    }

    if (!canWriteStoryPoints() || !hasStoryPointsAvailable(1)) {
      ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
      return;
    }

    requestStoryPointSpend(actor, 1);
    const defenses = targetActor.system.defenses ?? {};
    const lowestKey = Object.keys(defenses).reduce((lowest, key) => (
      defenses[key]?.total < (defenses[lowest]?.total ?? Infinity) ? key : lowest
    ), Object.keys(defenses)[0]);
    const defenseName = lowestKey ? game.i18n.localize(E20.defenses[lowestKey]) : '?';
    postPerkUseChatCard(
      actor,
      game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name })
      + ` (${targetActor.name}: ${defenseName})`,
    );
    return;
  }

  if (sourceId == SHADOW_ID || sourceId == SILENT_STRIDER_ID) {
    await toggleInfiltrating(actor);
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == POWERED_PLATING_ID) {
    const activated = await activatePoweredPlating(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == EXPLOSIVE_MORPH_ID) {
    if (!actor.system.isMorphed || actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    await activateExplosiveMorph(actor);
    return;
  }

  if (sourceId == ELTARIAN_METTLE_ID) {
    if (actor.system.powers.personal.value < 1) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    const removed = await applyEltarianMettle(actor);
    if (!removed) {
      return;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  if (sourceId == BALANCE_AND_HARMONY_ID) {
    const removed = await applyBalanceAndHarmony(actor);
    if (removed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == NU_POGODI_ID) {
    const removed = await applyNuPogodiCondition(actor);
    if (removed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (sourceId == THE_QUIET_ONE_ID) {
    const activated = await activateQuietOne(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

  if (EMT_CRASH_COURSE_IDS.includes(sourceId)) {
    const action = await pickEmtCrashCourseAction(actor);
    if (!action) {
      return;
    }

    if (action == 'heal') {
      return onImmediateAllyPerkUse(item, actor, EMT_CRASH_COURSE_HEAL_CONFIG);
    }

    const restored = await activateEmtCrashCourseEssenceRestore(actor, item.name);
    if (restored) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: restored.name }));
    }

    return;
  }

  if (sourceId == WISDOM_OF_THE_ELDERS_ID) {
    const option = item.system.choice;
    if (!option || !WISDOM_OF_THE_ELDERS_OPTIONS[option]) {
      return;
    }

    if (option == 'teleportation') {
      const activated = await activateWisdomOfTheEldersTeleportation(actor);
      if (!activated) {
        ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
        return;
      }

      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
      return;
    }

    const nowActive = await toggleWisdomOfTheElders(actor, option);
    if (nowActive === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }

    postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    return;
  }

  const immediate = IMMEDIATE_ALLY_PERKS[sourceId];
  if (immediate) {
    return onImmediateAllyPerkUse(item, actor, immediate);
  }

  const bankable = BANKABLE_PERKS[sourceId];
  if (!bankable) {
    return;
  }

  const isPlanOfAction = bankable.flagKey == 'pendingPlanOfAction';
  const hasInspiration = isPlanOfAction && actorHasPerk(actor, INSPIRATION_ID);
  const baseValue = item.system.advances?.currentValue || 1;
  const grantValue = hasInspiration ? baseValue + 1 : baseValue;

  // Power Ranger White Ranger's own "Inspiration" (pendingInspiration) - a same-named but
  // otherwise unrelated Perk to the GI Joe "Inspiration" (INSPIRATION_ID) checked just above,
  // which only ever modifies Plan of Action. This one grants its OWN bankable bonus - a die
  // added to the target's next roll, not a shiftUp/edge.
  const isInspirationPR = bankable.flagKey == 'pendingInspiration';

  // Guidance's own Adaptation Point cost (spendsRolePoint) - checked before the ally picker even
  // opens, so nobody is picked for a grant that can't be paid.
  if (bankable.spendsRolePoint) {
    const rolePoints = actor._getBaseRolePoints?.();
    if (!rolePoints?.system.resource.value) {
      ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
      return;
    }
  }

  let targetActors = [actor];
  if (bankable.target == 'ally') {
    const candidateAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
    targetActors = await pickAllyTargets(actor, candidateAllies, item.name, hasInspiration ? 2 : 1);
    if (!targetActors.length) {
      return;
    }
  }

  // Guidance - see its own BANKABLE_PERKS comment above. No data payload needed; dice.mjs's own
  // consuming check only tests whether the flag exists at all.
  const isGuidance = bankable.flagKey == PENDING_GUIDANCE_FLAG_KEY;

  let data = { edge: true };
  if (isPlanOfAction) {
    data = { shiftUp: grantValue };
  } else if (isInspirationPR) {
    data = { bonusDie: `1d${baseValue}` };
  } else if (isGuidance) {
    data = {};
  } else if (bankable.fixedShiftUp) {
    data = { shiftUp: bankable.fixedShiftUp };
  } else if (bankable.fixedBonusDie) {
    data = { bonusDie: bankable.fixedBonusDie };
  }

  if (bankable.spendsRolePoint) {
    const rolePoints = actor._getBaseRolePoints();
    await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
  }

  if (bankable.needsDefenseChoice) {
    const defenseType = await pickDefenseType();
    if (!defenseType) {
      return;
    }

    data = { defenseType };
  }

  // Resilience (Across the Stars, Gold Ranger, 11th level, p.53) - see its own BANKABLE_PERKS
  // entry below. Unlike Hard Target's identical rollsSkillDie shape, this one also costs 1
  // Personal Power at bank time - canUsePerk already gated the button on affordability above, so
  // this just performs the actual spend.
  if (bankable.powerCost) {
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - bankable.powerCost });
  }

  // I Got You - see its own BANKABLE_PERKS entry below. canUsePerk already gated the button on
  // affordability above, so this just performs the actual Energon spend.
  if (bankable.energonCost) {
    await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - bankable.energonCost });
  }

  // Benefits of Command - see its own BANKABLE_PERKS comment above. canUsePerk already gated the
  // button on canWriteStoryPoints()/hasStoryPointsAvailable() above, so this just fires the spend.
  if (bankable.worldStoryPointCost) {
    requestStoryPointSpend(actor, bankable.worldStoryPointCost);
  }

  // Hard Target (Pink Ranger, 2nd level) - see its own BANKABLE_PERKS entry below. Rolls the
  // named skill's own die right now (not the full attack formula - no shifts, Edge/Snag, or
  // modifier, just the plain skill die RAW calls for) and banks the numeric result rather than a
  // fixed amount, unlike every other entry in this table.
  if (bankable.rollsSkillDie) {
    const shift = actor.system.skills[bankable.rollsSkillDie].shift;
    const roll = await new Roll(shift, actor.getRollData()).evaluate();
    data = { defenseBonus: roll.total };
  }

  // Force Field/Remove & Rebuild/Stronger Together - a fixed Defense bonus (possibly to more than
  // one Defense at once, or `all: N` for "every Defense") banked on whichever actor this Perk
  // targets - see consumeBankedDefenseBonus's own doc comment near the bottom of this file for the
  // shared primitive every one of these now goes through.
  if (bankable.defenseAmounts) {
    data = { defenseAmounts: bankable.defenseAmounts };
  }

  // Stalwart Defense/Sword And Board - the same defenseAmounts shape just above, but chosen fresh
  // each use from a small fixed menu (see their own BANKABLE_PERKS comments above) rather than a
  // single fixed amount.
  if (bankable.defenseAllocationChoices) {
    const amounts = await pickDefenseAllocation(item.name, bankable.defenseAllocationChoices);
    if (!amounts) {
      return;
    }

    data = { defenseAmounts: amounts };
  }

  for (const targetActor of targetActors) {
    if (bankable.ruleBank) {
      const { bankRollBonus } = await import("../rules/bank.mjs");
      const { needsGmRelay, relayToGm } = await import("./gm-relay.mjs");
      const write = (doc, method, args) => (needsGmRelay(doc) ? relayToGm(doc, method, args) : doc[method](...args));
      await bankRollBonus(targetActor, { label: item.name, shiftUp: data.shiftUp ?? 0, edge: !!data.edge, source: item.id }, write);
      continue;
    }

    await bankPendingBonus(targetActor, bankable.flagKey, data, { granter: actor });
  }

  if (bankable.onceEncounterFlag) {
    await markUsedThisEncounter(actor, bankable.onceEncounterFlag);
  }

  if (bankable.onceMissionFlag) {
    await markUsed(actor, bankable.onceMissionFlag, { window: 'mission' });
  }

  // Roll with the Punches (Slammer) - see SLAMMER_ROLL_WITH_THE_PUNCHES_ID's own comment above.
  if (bankable.perCombatCapFlag) {
    await markUsedThisEncounterCount(actor, bankable.perCombatCapFlag);
  }

  if (bankable.onceTurnFlag) {
    await markUsedThisTurn(actor, bankable.onceTurnFlag);
  }

  if (bankable.onceRoundFlag) {
    await markUsedThisRound(actor, bankable.onceRoundFlag);
  }

  const names = targetActors.map(a => a.name).join(', ');
  postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: names }));
}

/**
 * Reads back a target's own pending Roll With the Punches bank (see its own BANKABLE_PERKS entry
 * above) and, if it matches the Defense actually being compared, consumes it. Called from the
 * ATTACKER's own rollSkill() while building each target's checkEntries difficulty - the one
 * banked effect in this file that's read on someone ELSE's roll rather than the banking actor's
 * own next one.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Boolean>}   True if a matching bank was found and consumed.
 */
export async function consumeRollWithThePunches(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY);
  if (!pending || pending.defenseType != defenseType) {
    return false;
  }

  await clearPendingBonus(targetActor, PENDING_ROLL_WITH_THE_PUNCHES_FLAG_KEY);
  return true;
}

/**
 * Reads back a target's own pending Hard Target roll (see HARD_TARGET_ID's own comment above)
 * and, if this attack is being compared against Evasion, returns the banked bonus and consumes
 * it - same "read on someone ELSE's roll" shape as consumeRollWithThePunches, but adds a flat
 * amount to the difficulty rather than doubling it.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume).
 */
export async function consumeHardTarget(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, PENDING_HARD_TARGET_FLAG_KEY);
  if (!pending || defenseType != 'evasion') {
    return 0;
  }

  await clearPendingBonus(targetActor, PENDING_HARD_TARGET_FLAG_KEY);
  return pending.defenseBonus;
}

/**
 * Reads back a target's own pending Resilience roll (see RESILIENCE_ID's own comment above) and
 * returns/consumes it - a sibling to consumeHardTarget above rather than a generalization of it,
 * since Resilience applies to ANY Defense (not just Evasion), so the same defenseType-restriction
 * guard doesn't belong here.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume).
 */
export async function consumeResilience(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, PENDING_RESILIENCE_FLAG_KEY);
  if (!pending || !defenseType || defenseType == 'none') {
    return 0;
  }

  await clearPendingBonus(targetActor, PENDING_RESILIENCE_FLAG_KEY);
  return pending.defenseBonus;
}

const UNTIL_NEXT_TURN_DEFENSE_FLAGS = [STALWART_DEFENSE_FLAG];

/** Whether combat has reached the holder's next turn since the bonus was banked (on their own turn). */
function pastStartOfNextTurn(actor, pending) {
  const combat = game.combat;
  if (pending.combatId != combat.id || combat.round <= pending.round) {
    return false;
  }

  if (combat.round > pending.round + 1) {
    return true;
  }

  const theirs = combat.turns.findIndex(c => c.actor?.id == actor?.id);
  return theirs < 0 || combat.turn >= theirs;
}

/**
 * Shared "banked Defense bonus, granted to whichever actor is the beneficiary" primitive - Force
 * Field/Stalwart Defense/Sword And Board (self-targeted) and Remove & Rebuild/Stronger Together
 * (ally-targeted) all bank through the ordinary bankPendingBonus(actor, flagKey, { defenseAmounts })
 * shape (actor being whichever actor the Perk actually benefits - bankPendingBonus already accepts
 * any actor, so "granted to someone other than the user" needed no new BANKING primitive, only this
 * one shared CONSUMING function plus each Perk's own ally-picker/BANKABLE_PERKS `target: 'ally'`
 * entry, both of which already existed - see Plan of Action/Inspiration/Heart of the Team etc.
 * above). Read (and, if it matches, consumed) at the same dice.mjs site as consumeHardTarget/
 * consumeResilience/consumeRiseAgainDefense above - the TARGET's own banked
 * effect applying against someone ELSE's attack roll, not the banking actor's own next one.
 *
 * `defenseAmounts` is a plain { toughness, evasion, willpower, cleverness } map, only some of
 * which need be present (Force Field's own {toughness: 2, evasion: 2}, Remove & Rebuild's
 * {toughness: 1, evasion: 1}) - or an `all` key (Stronger Together's {all: 1}, or its own
 * {all: -1} self-penalty) applying uniformly to every Defense type when no more specific key
 * matches, the same "a Defense of your choice"/"all of their Defenses" shape Rise Again/Stronger
 * Together's own RAW text call for, without hardcoding every key by name.
 * @param {Actor} targetActor   The actor being attacked (not the attacker) - the actor the bonus
 *   was banked ON, whether that's the granter themselves or a chosen ally.
 * @param {String} flagKey   This Perk's own distinct flag name.
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume, or nothing
 *   matches this defenseType).
 */
export async function consumeBankedDefenseBonus(targetActor, flagKey, defenseType) {
  const pending = getPendingBonus(targetActor, flagKey);
  if (!pending?.defenseAmounts) {
    return 0;
  }

  // Stalwart Defense lasts "until the beginning of your next turn" - every attack in between gets
  // it, so it stays banked until the holder's next turn comes round.
  if (UNTIL_NEXT_TURN_DEFENSE_FLAGS.includes(flagKey) && game?.combat && pending.round != null) {
    if (pastStartOfNextTurn(targetActor, pending)) {
      await clearPendingBonus(targetActor, flagKey);
      return 0;
    }

    return pending.defenseAmounts[defenseType] ?? pending.defenseAmounts.all ?? 0;
  }

  const amount = pending.defenseAmounts[defenseType] ?? pending.defenseAmounts.all ?? 0;
  if (!amount) {
    return 0;
  }

  await clearPendingBonus(targetActor, flagKey);
  return amount;
}

export { pickAllyTargets };
