import { E20 } from "./helpers/config.mjs";
import {
  _isCritIsFumble, applyDamage, buildCheckChatData, computeMultiplier, ENERGY_DAMAGE_TYPES, getDefenseValue,
  getEffectiveLevel, getSkillRanks, PENDING_SENSITIVE_SNAG_FLAG_KEY,
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
} from "./helpers/sneak-attack.mjs";
import {
  checkForceReconSneakAttackEligibility, FORCE_RECON_SNEAK_ATTACK_ID, markForceReconSneakAttackUsed,
} from "./helpers/force-recon-sneak-attack.mjs";
import {
  actorHasHangUp, actorHasPerk, bankPendingBonus, clearPendingBonus, findHangUp, findPerk, getPendingBonus,
  getUsesThisEncounter, getUsesThisScene, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisEncounterCount, markUsedThisRound, markUsedThisScene, markUsedThisTurn,
  postPerkUseChatCard,
} from "./helpers/perks.mjs";
import {
  consumeHardTarget, consumeMomentaryBlur, consumeResilience, consumeRollWithThePunches, pickHobbleCondition,
  pickGuardianStrikesCondition,
} from "./helpers/banked-buffs.mjs";
import {
  NANO_MED_MASTERY_EDGE_FLAG, PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY, RALLYING_CRY_EDGE_FLAG, SHINING_LEADER_EDGE_FLAG,
} from "./helpers/team-buffs.mjs";
import { PENDING_GRID_POWER_STRIKE_FLAG_KEY } from "./helpers/grid-power-strike.mjs";
import { checkMarkTarget } from "./helpers/mark-target.mjs";
import { CBRN_DEFENDER_HANG_UP_ID, getCbrnDefenderShiftDown } from "./helpers/cbrn-defender.mjs";
import { checkTwoHeadsAssistance, consumeTwoHeadsAssistance } from "./helpers/two-heads-are-better-than-one.mjs";
import { deactivateInvisibilityOnAttack } from "./helpers/invisibility.mjs";
import { isConcentrateFireTarget } from "./helpers/concentrate-fire.mjs";
import { isProtectedTarget } from "./helpers/protected-target.mjs";
import { isBulwarkActive } from "./helpers/bulwark.mjs";
import { getNearbyAllyTokens } from "./helpers/allies.mjs";
import { getShieldUpgradeBonus, isPersonalShieldActive } from "./helpers/personal-shield.mjs";
import { getShieldModulationDamageType, SHIELD_MODULATION_ID } from "./helpers/shield-modulation.mjs";
import { getRecklessAbandonStrengthShiftUp } from "./helpers/reckless-abandon.mjs";
import { hasStoryPointsAvailable, isGmConnected, requestStoryPointGrant, requestStoryPointSpend } from "./helpers/story-points.mjs";
import { isDugIn } from "./helpers/dig-in.mjs";
import { isCannoneerDugIn } from "./helpers/cannoneer-dig-in.mjs";
import { isSkiing } from "./helpers/skier.mjs";
import { isPointyActive } from "./helpers/pointy.mjs";
import { checkAndMarkSplinterDefense, getHardenedArmorBonus } from "./helpers/splinter-defense.mjs";
import { isPowerBoostActive } from "./helpers/power-boost.mjs";
import { consumeGridSurgeToughness, GRID_SURGE_CONSTRUCT_FLAG } from "./helpers/grid-surge.mjs";
import { isPowerAdaptationActive } from "./helpers/power-adaptation.mjs";
import { deactivatePhantomSuite, getPhantomSuiteEvasionBonus, isPhantomSuiteActive } from "./helpers/phantom-suite.mjs";
import { getPoweredPlatingBonus } from "./helpers/powered-plating.mjs";
import { getMeatShieldBonus } from "./helpers/meat-shield.mjs";
import {
  getGrowDamageBonus, getGrowDefenseBonus, getMonsterFormSkillBonus, getMonsterFormToughnessBonus, GROW_ID,
  isMonsterFormActive,
} from "./helpers/monster-morph.mjs";
import { isPsychoAssaultActive, PSYCHO_ASSAULT_ID } from "./helpers/psycho-assault.mjs";
import { applyNemesisDrainEffect, getNemesisDrainPenalty } from "./helpers/nemesis-drain.mjs";
import { isDistractionActive } from "./helpers/distraction.mjs";
import { getMaximizeFlawsTargetUuid } from "./helpers/maximize-flaws.mjs";
import { isPowerBleedActive, drainPowerBleedTarget } from "./helpers/power-bleed.mjs";
import { consumeGrowingSmolderStacks } from "./helpers/growing-smolder.mjs";
import { addToxicTerrorStack, getToxicTerrorShiftDown, isToxicTerrorActive } from "./helpers/toxic-terror.mjs";

// The 6 Finster's Monster-Matic Cookbook Warlord capstones (20th level) - each already has its
// own flat "+N to all Defenses" compendium Active Effect; the pieces built here are their own
// remaining secondary riders (damage bonuses below; Flame/Frost/Stone's own incoming-damage
// reduction lives in combat.mjs#getWarlordDamageReduction instead).
const WARLORD_FMMC = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.";
const CRUEL_WARLORD_ID = `${WARLORD_FMMC}F3TRKmoaUOtHrlzq`;
const FLAME_WARLORD_ID = `${WARLORD_FMMC}TPrNnDxBKHIajafY`;
const FROST_WARLORD_ID = `${WARLORD_FMMC}iFHlsLgUvmlT8cMK`;
const VENOM_WARLORD_ID = `${WARLORD_FMMC}9tU5tDmpOhChLfdv`;
const THORN_WARLORD_ID = `${WARLORD_FMMC}GKNjCEwhgEbBiKQn`;

// Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level) - see its own
// comment above (rollSkill's own shiftUp computation).
const GROWING_SMOLDER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4XblFV97cS63ueDM";

// Distraction (Finster's Monster-Matic Cookbook, Path of Venom, 5th level) - see its own comment
// in _getAutomaticCombatModifiers below.
const DISTRACTION_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.mJu5IxoVrPjp8dVU";

// Unshakeable Aim (Finster's Monster-Matic Cookbook, Path of Thorns, 2nd level) - see its own
// comment above (rollSkill's own aimBonus computation).
const UNSHAKEABLE_AIM_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.RJ6xBZuDXSELI0rJ";

// Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level) - see its own
// comment in _getAutomaticCombatModifiers below.
const MAXIMIZE_FLAWS_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.jGa15CyuKXhq3IV2";

// Zordbane (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 8th level) - see its own comment
// in _getAutomaticCombatModifiers below.
const ZORDBANE_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.SejEXXGz3edJ734e";
const GOIN_HEELS_ID = "Compendium.essence20.jump_through_time.Item.8QaqczkkaPaUivEC";

// On My Own (Finster's Monster-Matic Cookbook, Path of Stone, 2nd level) - see its own comment
// below.
const ON_MY_OWN_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.WlpzIGEGQEL7B78w";
import { isWisdomOfTheEldersActive } from "./helpers/wisdom-of-the-elders.mjs";
import { getProtectionBoostBonus } from "./helpers/protection.mjs";
import { isAugmentedCombatActive } from "./helpers/augmented-combat.mjs";
import { REPAIR_MACHINE_EDGE_FLAG } from "./helpers/repair-machine.mjs";
import { applyBolsterDefense, getBolsterDefenseBonus } from "./helpers/bolster-defense.mjs";
import { getRoarDefenseBonus } from "./helpers/roar.mjs";
import { applyJuryRigBenefit, getJuryRigDefenseBonus, isJuryRigBenefitActive } from "./helpers/jury-rig.mjs";
import { applyImproviseArmor } from "./helpers/improvise-armor.mjs";
import { markUndoEngineMovementDisabled, triggerUndoEngineCheck } from "./helpers/undo-engine.mjs";
import { applySpotWeldHeal } from "./helpers/spot-weld.mjs";
import { applyMartialLeadershipEffect, PENDING_EDGE_FLAG as MARTIAL_LEADERSHIP_EDGE_FLAG, PENDING_SNAG_FLAG as MARTIAL_LEADERSHIP_SNAG_FLAG } from "./helpers/martial-leadership.mjs";
import { applyVoiceOfPrimusEffect } from "./helpers/voice-of-primus.mjs";
import { applyWordsCanHurtEffect } from "./helpers/words-can-hurt.mjs";
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
import { getLikeWaterDefenseBonus } from "./helpers/like-water.mjs";
import { getNotOnMyWatchDefenseBonus } from "./helpers/not-on-my-watch.mjs";
import { activateTheToughGetGoing } from "./helpers/the-tough-get-going.mjs";
import { applyLuckyCharm } from "./helpers/lucky-charm.mjs";
import { activateIllusoryDisguise, isIllusoryDisguiseActive } from "./helpers/illusory-disguise.mjs";
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
import { applyFoolscarrot, isFoolscarrotActive } from "./helpers/foolscarrot.mjs";
import { applyScarefyingAppearance, isScarefyingAppearanceActive } from "./helpers/scarefying-appearance.mjs";
import { applyBlockMagic } from "./helpers/block-magic.mjs";
import { isExploitWeaknessMarked, markExploitWeakness } from "./helpers/exploit-weakness.mjs";
import { checkWhateverWeNeed } from "./helpers/whatever-we-need.mjs";
import { getVolleyShots, isVolleyActive } from "./helpers/volley.mjs";
import { applyEnchant, ENCHANT_SHIFT_UP_FLAG } from "./helpers/enchant.mjs";
import { applyBestowExpertise } from "./helpers/bestow-expertise.mjs";
import { applyFlutteryWings } from "./helpers/fluttery-wings.mjs";
import { applyLightningSpeed } from "./helpers/lightning-speed.mjs";
import { PENDING_RUSH_THE_LINE_EDGE_FLAG } from "./helpers/rush-the-line.mjs";
import { isObserverDisguiseActive } from "./helpers/observer.mjs";
import { isPerfectDisguiseActive } from "./helpers/perfect-disguise.mjs";
import { getSupremeGuardianTechAvailable, spendSupremeGuardianTech } from "./helpers/supreme-guardian.mjs";
import { checkCombatStance, COMBAT_STANCE_ID, getCombatStanceNumber } from "./helpers/combat-stance.mjs";
import { hasNearbyTacticalMeditation } from "./helpers/tactical-meditation.mjs";
import { AGELESS_KNOWLEDGE_FLAG } from "./helpers/ageless-knowledge.mjs";
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
import { hasActiveEnvironmentalExpertise, PENDING_GUIDANCE_FLAG_KEY } from "./helpers/environmental-expertise.mjs";
import {
  applyExplosiveAftershockEffects, EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG, pickExplosiveAftershockEffects,
} from "./helpers/explosive-aftershock.mjs";
import { hasPhantomFocusOption } from "./helpers/phantom-focus.mjs";
import { THROUGH_THE_ARCHES_SNAG_FLAG } from "./helpers/through-the-arches.mjs";
import { PENDING_WILD_TALES_FLAG_KEY } from "./helpers/wild-tales.mjs";
import { getTerrorAvailable, grantTerrorIfEligible, spendTerror } from "./helpers/terror.mjs";
import { getChargedUpEssence, isMuscleModeActive, isPowerModeActive } from "./helpers/omega-enhancement.mjs";
import { getTimeTravelerActiveSkill } from "./helpers/time-traveler.mjs";
import { pickDirtyTrickCondition } from "./helpers/dirty-trick.mjs";
import { isLanceOfLightActive } from "./helpers/lance-of-light.mjs";
import {
  applyMenacingGlareEffect, MENACING_GLARE_EDGE_FLAG, MENACING_GLARE_SNAG_FLAG, pickMenacingGlareEffect,
} from "./helpers/menacing-glare.mjs";
import { SHATTERED_MEMORIES_EDGE_FLAG, SHATTERED_MEMORIES_SMARTS_FLAG } from "./helpers/shattered-memories.mjs";
import { SPITE_EDGE_FLAG } from "./helpers/spite.mjs";
import { COVERING_FIRE_SNAG_FLAG } from "./helpers/covering-fire.mjs";
import { checkAndMarkUnluckyForYou, UNLUCKY_FOR_YOU_SNAG_FLAG } from "./helpers/unlucky-for-you.mjs";
import { checkFightMeDownshift } from "./helpers/fight-me.mjs";
import { applyBumperCropSnag } from "./helpers/bumper-crop.mjs";
import { isPseudoScienceActive } from "./helpers/pseudo-science.mjs";
import { isHonestAssessmentActive } from "./helpers/honest-assessment.mjs";
import { isAugmentPowerWeaponActive } from "./helpers/augment-power-weapon.mjs";
import { isPenetratingStrikesActive } from "./helpers/penetrating-strikes.mjs";
import { actorHasPower } from "./helpers/powers.mjs";
import { getZeoCrystalBoostOption } from "./helpers/zeo-crystal-boost.mjs";
import { applyBrazenStrike } from "./helpers/brazen-strike.mjs";
import { applyStylishStrike } from "./helpers/stylish-strike.mjs";
import { isBlazingStrikesActive } from "./helpers/blazing-strikes.mjs";
import { isNinjaPowerActive } from "./helpers/ninja-power.mjs";
import { isVoidWarriorActive } from "./helpers/void-warrior.mjs";
import { PENDING_REV_YOUR_ENGINES_FLAG_KEY } from "./helpers/rev-your-engines.mjs";
import { PENDING_MEGAZORD_LINK_FLAG_KEY } from "./helpers/megazord-link.mjs";
import { checkEnemyNumberOne, markAttackedEnemyNumberOne } from "./helpers/enemy-number-one.mjs";
import { checkTeamFocus, markAttackedByAlly } from "./helpers/team-focus.mjs";
import { getQuietOneEdge, markQuietOneNoisyAction } from "./helpers/quiet-one.mjs";
import { getInfluentialShiftUp } from "./helpers/influential.mjs";
import { isMultipleTargetsWeapon } from "./helpers/multiple-targets.mjs";
import { isMetallikatoMultipleTargetsActive } from "./helpers/metallikato.mjs";
import { applyReroll, findRolePointsItem } from "./helpers/reroll.mjs";
import { applySkillEffectBonus, getToggleableSkillEffects } from "./helpers/skill-effects.mjs";
import { applyAngryHangUp } from "./helpers/angry.mjs";
import { recordDistractingOfferResult } from "./helpers/distracting-offer.mjs";
import { HARASS_EDGE_FLAG } from "./helpers/harass.mjs";
import { markIronBravadoAttack } from "./helpers/iron-bravado.mjs";
import {
  ANTAGONISTIC_SHIFT_DOWN_FLAG, ANTAGONISTIC_SNAG_FLAG, applyAntagonisticEffect, pickAntagonisticEffect,
} from "./helpers/antagonistic.mjs";

// Every Commando Perk automated below that isn't specific to Sneak Attack itself (those constants
// live in helpers/sneak-attack.mjs instead) - all under GI Joe CRB's own compendium pack.
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const GENERAL_HAWKS_PERSONNEL_FILES = "Compendium.essence20.general_hawk_s_personel_files.Item.";

// Skier (General Hawk's Personnel Files, General Perk, p.175) - see helpers/skier.mjs's own doc
// comment. "+1 Evasion... while skiing" - a live, non-consumed read in the per-target checkEntries
// construction below, the same shape Phantom Suite's own Evasion bonus already established (this
// system's `_prepareDefenses` is off-limits, the user's own pending Health/Defense-math migration).
const SKIER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}dvmY7UiuKejOPY4N`;

// Ever Vigilant (General Hawk's Personnel Files, General Perk, p.175): "As long as you are not
// Surprised, you can roll Alertness in place of Initiative to determine your place in the
// Initiative Order." RAW pulled fresh from the actual PDF (no cached extraction existed for this
// book). No distinct "Surprised" status exists in this codebase, so offered unconditionally - the
// same accepted simplification Prepare for War/Sirens Blaring already use for their own identical
// qualifier. A single-alternate-skill substitution, the exact shape Cunning Plan/Wire Work already
// established (shift-position-delta between the two dice, since the shown die is already locked
// in by the time this checkbox exists) - but applied inside prepareInitiativeRoll() rather than
// rollSkill(), since Initiative never rolls through that path in practice (see this method's own
// top comment).
const EVER_VIGILANT_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}mvRJqqrgfu5AXOZt`;

// Danger Sense (GI Joe CRB, Bodyguard Focus, 6th level, p.110): "you may use Alertness for
// Initiative, with a +2 bonus." Same shift-position-delta substitution as Ever Vigilant, plus a
// flat +2 on top (Ever Vigilant's own text has no such bonus). "Your Protected Target can choose
// to set their Initiative score equal to yours" and "can't be Surprised" clauses live in
// helpers/danger-sense.mjs (the former) or aren't built at all (the latter - no Surprised status
// exists).
const DANGER_SENSE_ID = `${GI_JOE_CRB}2hwFRZ67xIGt1XTm`;

// Needle Drop (General Hawk's Personnel Files, General Perk, p.174): "As long as you are not
// Surprised, you can roll Performance (Music) in place of Initiative to determine your place in
// the Initiative Order." Textually identical in shape to Ever Vigilant just above (same "not
// Surprised" qualifier dropped, same single-alternate-skill delta substitution), just against
// Performance instead of Alertness - kept as its own dedicated checkbox/consumption block rather
// than generalized into a shared table, matching this project's own existing practice for this
// exact mechanism (Cunning Plan/How Strange!/Wire Work are three separately-coded instances of the
// identical shift-delta substitution, never consolidated into one generic dispatch).
const NEEDLE_DROP_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}eKkAuWHCtHPocK8f`;

// Rapid Deployment Drills (Ferocious Fighters, Force Recon Focus, 3rd level, p.47): "you can use
// Alertness or Infiltration instead of Initiative... you cannot be surprised at the start of
// combat." Textually identical in shape to Ever Vigilant/Needle Drop just above, just offered as
// a 2-skill choice (matching Cobra Battle Cry's own twin-checkbox shape for a 2-skill Edge grant)
// rather than a single alternate skill - two separate checkboxes, each its own shift-position-
// delta substitution. The "cannot be surprised" clause is the same unenforceable qualifier Ever
// Vigilant/Needle Drop already drop (no distinct "Surprised" status exists in this codebase).
const RAPID_DEPLOYMENT_DRILLS_ID = "Compendium.essence20.ferocious_fighters.Item.pQvXMpk7uAvfuGMl";

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

// Explosive Engineer - see updatedShiftDataset.explosiveEngineerScienceAvailable's own comment
// above.
const EXPLOSIVE_ENGINEER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}1MCKcleeXZZf5PQF`;

// Peaceable (Influence Perk, p.166): "↑1 on Attack Skill Tests that deal Stun and no other
// damaging effect. However, you suffer ↓1 [or ↓2 with the Hang-Up] on Attack Skill Tests that deal
// damage." Same shiftUp/shiftDown-pair-by-damageType shape as Martial Weapon Master above - see
// its own check near updatedShiftDataset.shiftUp above. "↑1 on Skill Tests to heal injuries" is
// NOT built - same gap as Hearty Meal's own Science-substitution clause (no "this roll is meant to
// heal" action anywhere in this codebase to condition on - a plain Science roll can't be
// distinguished from any other use of the skill).
const PEACEABLE_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}BHum6Sd6Zz7cra5b`;
const PEACEABLE_HANGUP_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}zm9x8A7AW8o7grQX`;

// Quiet (Influence Perk, p.171) / its own Hang-Up - see their own check near skillRollOptions.snag
// above.
const QUIET_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}oyybOYHfDdGS6dKr`;
const QUIET_HANGUP_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}6RR2OYWSWrhZv02r`;

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

// Your Reputation Precedes You (Factions in Action Vol. 2, Dreadnok General Perk, p.66): "You can
// roll Intimidation in place of Initiative for Skill Tests when you are aware that a Combat is
// about to happen." Textually the same shape as Ever Vigilant/Needle Drop above (a single-
// alternate-skill Initiative substitution) - "when you are aware..." is dropped as the same
// accepted looseness those two already use for their own narrower qualifiers, and this reuses the
// identical shift-position-delta mechanism rather than a fourth independent implementation of the
// same math, just substituting Intimidation.
const YOUR_REPUTATION_PRECEDES_YOU_ID = "Compendium.essence20.intercontinental_adventures.Item.a1DfsvPTypMxIgxA";

// Deceptive Warfare (Transformers One Sourcebook, High Guard Faction Perk, p.18): "When you reset
// your Initiative, you can do so at the cost of two Free actions instead of a Move action and may
// make a Deception or Infiltration Skill Test instead of an Initiative Skill Test." Same shift-
// position-delta substitution as Ever Vigilant/Needle Drop/Your Reputation Precedes You above, but
// offering a CHOICE of 2 alternate skills instead of 1 - two independent checkboxes rather than a
// dropdown, since this codebase has no per-roll (as opposed to permanent chargen) 2-option picker
// UI precedent to reuse. "Reset your Initiative" has no distinct trigger from an initial roll in
// this codebase (Combat#rollInitiative is the one path for both, per Prepare for War/Sirens
// Blaring's own doc comment) - offered unconditionally whenever Initiative is (re-)rolled. The
// Free-action/Move-action cost swap is the standing unenforced action-economy gap.
// Named "Deceptive Warfare" too, an unrelated GI Joe CRB Perk elsewhere in this file (DECEPTIVE_WARFARE_ID,
// Focus: Battlefield Psychologist) already claims that identifier - prefixed TF1S_ to disambiguate,
// the same "same name, different book" pattern this project has hit repeatedly this session.
const TF1S_DECEPTIVE_WARFARE_ID = "Compendium.essence20.transformers_one_sourcebook.Item.OJcHMBA3QYgPp5w0";

// Bear Hug (Factions in Action Vol. 2, General Perk, p.94) - see its own check, next to Warfighter's
// identical damageBonusValue-folding shape above.
const BEAR_HUG_ID = "Compendium.essence20.intercontinental_adventures.Item.id5IVoPuSC03mKfZ";

// Evasive (Factions in Action Vol. 2, Red Ninja Faction Perk, p.10): "If you are aware of an
// Attack, you may always use Evasion for Defense." Same "substitute in whenever it's better" idiom
// as Psychological Warfare's own identical Willpower/Cleverness-scoped clause, just unscoped to
// ANY Defense - see its own check next to that one in rollSkill()'s checkEntries construction.
const EVASIVE_IAF2_ID = "Compendium.essence20.intercontinental_adventures.Item.pa4D7BibxH7jW0BA";

// Randori Master (Factions in Action Vol. 2, Ninja Force Faction Perk, p.11): "You gain ↑2 on
// Unarmed Combat Attacks." Only this half is built - the reactive "Push/Shove any adjacent Threat
// who attacked you" clause needs the still-missing "react to being attacked" hook this project has
// flagged many times before (Fe-BURN!, Defender Step, etc.). "Unarmed" via this project's own
// established "no parent weapon" proxy (Phantom Ranger Prime/Growth Boost's identical shape).
const RANDORI_MASTER_ID = "Compendium.essence20.intercontinental_adventures.Item.6sgDFv3TZjDf07ti";

// Empty Hands (Factions in Action Vol. 2, General Perk, p.30) - see its own check next to Walking
// Weapon Rack's identical unarmed-Edge shape above.
const EMPTY_HANDS_ID = "Compendium.essence20.intercontinental_adventures.Item.t6ACZEOz99JWWHyg";

// Ninpõ JOEs (Factions in Action Vol. 2, Ninja Force Faction Perk, p.11) - see its own check next
// to Adventurer's identical once/scene auto-apply shape above.
const NINPO_JOES_ID = "Compendium.essence20.intercontinental_adventures.Item.8oZYgik001Dxxxa6";

// Student of Divine Manuals (Factions in Action Vol. 2, General Perk, p.33) - see its own check
// next to Adaptable's identical once/scene isSpecialized shape above.
const STUDENT_OF_DIVINE_MANUALS_ID = "Compendium.essence20.intercontinental_adventures.Item.98E2wzIX6LQRu7gD";

// Projectile Dancer (Factions in Action Vol. 2, General Perk, p.33, Speed Essence 4+ prereq):
// "Threats using projectile weapons suffer a Snag the first time they target you [this scene]."
// A reciprocal target-status Snag, gated on the ATTACK's own projectile classification style and
// a once-per-scene gate tracked on the TARGET (the Projectile Dancer holder) - same
// hasUsedThisEncounter/markUsedThisEncounter idiom used throughout this project, just checked
// against the target instead of the actor since the limited resource belongs to whoever's being
// protected, not whoever's attacking.
const PROJECTILE_DANCER_ID = "Compendium.essence20.intercontinental_adventures.Item.gsSxDXrq0xdmkeJp";

// Roaring Engine (Factions in Action Vol. 2, General Perk, p.64): "When driving a vehicle, you can
// use Driving in place of Intimidation for Skill Tests." Gated on actually piloting a vehicle as
// its driver (_getPilotedVehicle(actor, 'driver'), the same pilot-lookup helper Motor Lancer/
// Roadside Assistant already established) - a 7th instance of the shift-position-delta
// substitution checkbox mechanism, against Driving.
const ROARING_ENGINE_ID = "Compendium.essence20.intercontinental_adventures.Item.zzEmLhFcExVXhT5g";

// Aerial Interface (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 1st level, p.27):
// "you gain ↑2 to Driving Skill Tests when interfacing with an air vehicle." Same
// _getPilotedVehicle('driver')-gated shiftUp shape as Vehicle Qualification's own +1, just a
// flat +2 and specific to aerial movement. Only this clause is built - the personal-shield-
// extension half needs a "grant the vehicle itself the driver's own shield benefits" mechanism
// this project's shield-upgrade code has never needed before (a genuinely separate small
// investigation, not attempted this pass), and the "use Long Shot/Trigger Happy fighting styles
// without holding them" half needs a "borrow another Perk's combat effect while piloting" concept
// with no precedent anywhere in this codebase - both left unbuilt rather than guessed at.
const AERIAL_INTERFACE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Etogut0TJjvuKC9J";

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
// Tests when driving land and sea vehicles") is the first downshift half this table has ever
// needed - see its own check further below.
const SKYWARD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.1IlTYXe8k5Aj63Mn";

// Seafarer (Quartermaster's Guide to Gear, Influence Perk, p.12): "You gain Edge on Athletics
// (Swimming) and Driving (Sea) Skill Tests." Only the Driving(Sea) half is built - reuses the same
// _getPilotedVehicle/swim-movement check Vehicle Qualification/Skyward above already established,
// checked directly (not folded into that shared table, since Seafarer's own grant is a flat Edge
// rather than an untrained-Snag-suppression/shiftUp pair). The Athletics(Swimming) half needs an
// actor-environment ("are you currently swimming") concept this codebase doesn't track anywhere -
// left unbuilt rather than approximated as a blanket Athletics Edge, which RAW clearly doesn't
// intend. Its own Hang-Up ("on land, poisons/illness effects gain Edge targeting you and you
// suffer Snag resisting them") needs that same missing "in water vs. on land" state - also unbuilt.
const SEAFARER_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.vZjp9ncpzhgLIzSm";

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

// Reinforced Basics (Quartermaster's Guide to Gear, Militia Member Origin Benefit, p.19): "You
// gain ↑1 on attacks with Standard availability weapons (after factoring upgrades). Additionally,
// you get three uses out of Standard Kits instead of one." (The PDF's own up/down-shift glyph
// didn't survive text extraction here - re-checked the raw text run directly: an icon-font glyph
// sits between "gain" and "1" with no Unicode mapping pdf.js could recover. Read as an upshift, not
// a downshift, both from the surrounding flavor text ("you trusted the MOST RELIABLE equipment" -
// a benefit, not a penalty, for sticking with humble gear) and from this book's own consistent verb
// choice elsewhere - every other downshift/Snag clause already read this session uses "suffer,"
// every upshift/Edge clause uses "gain," and this text uses "gain.") Only the weapon-shiftUp half
// is built - "after factoring upgrades" maps directly onto `item.system.totalAvailability`
// (documents/item.mjs's own `_prepareTotalAvailability`, the exact "combined Availability tier"
// Table 8-2 already computes for every weapon). The "three uses out of Standard Kits" half stays
// unbuilt - grepped the whole codebase for any Kit-item "uses" tracking and found none; Kits
// aren't modeled as their own item type with a charges field anywhere in this system.
const REINFORCED_BASICS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.4HD4ibkT5hTdwlAW";

// Petrolhead (Quartermaster's Guide to Gear, Racer Origin Benefit, p.18): "choose one type of
// vehicle (land, sea, or air). You roll as if Specialized in that vehicle when attempting Driving
// Skill Tests and Technology Skill Tests to repair or improve that type of vehicle." Only the
// Driving half is built - reuses the same _getPilotedVehicle/movement-type check Vehicle
// Qualification/Skyward/Seafarer already establish, matched against the chosen vehicleType choice
// (system.choice, one of E20.movementTypes' own aerial/ground/swim keys - see perk-handler.mjs's
// new 'vehicleType' case). The Technology half ("to repair or improve that type of vehicle") stays
// unbuilt - unlike Driving (which always has a real piloted-vehicle context to check against),
// there's no "which vehicle you're currently repairing" concept for a Technology roll, and
// granting isSpecialized on every Technology roll regardless would be a much bigger overreach than
// this project's usual narrative-qualifier drops (same reasoning as Seafarer's own
// Athletics(Swimming) half).
const PETROLHEAD_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.JlJrEfRcrupprYMC";

// Technically Correct (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 6th level,
// p.22): "once per scene, you can use Technology in place of another Skill for a single Skill
// Test." Same shift-position-delta substitution mechanism as Roaring Engine/Ambush Predator/Hesher
// above, just unscoped (any Skill, not one fixed pair) and gated once/scene via
// hasUsedThisEncounter/markUsedThisEncounter rather than always-available. Excluded when the roll
// IS already Technology (a no-op that would just burn the once/scene use for nothing).
const TECHNICALLY_CORRECT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.HU9eLTJr0aFxiqnd";
const TECHNICALLY_CORRECT_ENCOUNTER_FLAG = 'technicallyCorrectUsedThisEncounter';

// Technical Mastery (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 20th level,
// p.22): "you can now score a Critical Success on a d2 for all Technology Skill Tests." Same
// canCritD2 grant shape Perimeter Defender's identical clause already uses. The rest of this
// Perk's own text (the Tech Specs Edge widening, the Trade School extension) lives in
// helpers/tech-specs.mjs/helpers/trade-school.mjs respectively - see their own doc comments.
const TECHNICAL_MASTERY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QKlXoVgNMq7Kv58L";

// Ripple Effect (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 6th level, p.24) and
// Weak Point (10th level, p.24) - see their own comments next to each check further below.
const RIPPLE_EFFECT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.GY9fkASnSzkQIYKC";
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

// Throw Your Weight Around (Factions in Action Vol. 2, Dreadnok General Perk, p.64): "When you
// target a creature of a smaller Size Class than you with a melee attack, you deal 1 additional
// damage." CORRECTED 2026-09-10 from a stale/wrong ledger note ("no forced-movement/knockback
// mechanism") - the actual RAW text (re-extracted fresh from the PDF) is a plain Size-comparison
// damage bonus, nothing to do with knockback at all.
const THROW_YOUR_WEIGHT_AROUND_ID = "Compendium.essence20.intercontinental_adventures.Item.sXiptCDHSjN0V9W8";

// Roaming the Land (Ferocious Fighters, Mega Monsters Faction Perk, p.75) - see
// E20.roamingTheLandOptions' own doc comment for the RAW text and the choice mechanism.
const ROAMING_THE_LAND_ID = "Compendium.essence20.ferocious_fighters.Item.jdQFjlYUHaRze6as";

// Martial Weapon Master (Factions in Action Vol. 2, General Perk, p.32) - see its own check next to
// Fire Master's identical parent-weapon-trait shape above.
const MARTIAL_WEAPON_MASTER_ID = "Compendium.essence20.intercontinental_adventures.Item.HZiYXNZOeFExJa4K";

// Walking Weapon Rack (Factions in Action Vol. 2, Ninja Focus, 20th level, p.15) - see its own
// check next to Martial Weapon Master's identical parent-weapon-trait shape above.
const WALKING_WEAPON_RACK_ID = "Compendium.essence20.intercontinental_adventures.Item.30iXcdh2zEhC9wVP";

// Two-Handed Assault (Factions in Action Vol. 2, Silent Weapons Expert Focus, 3rd level, p.12) -
// see E20.twoHandedAssaultOptions' own doc comment and its own checkbox below, right alongside
// Akimbo's identical manual-toggle idiom.
const TWO_HANDED_ASSAULT_ID = "Compendium.essence20.intercontinental_adventures.Item.btGfoEaflxAZAw25";

// Brute Force (Factions in Action Vol. 2, General Perk, p.94): "You may use Brawn instead of
// Targeting to Attack with ranged heavy weapons." "Heavy" is a real, existing weapon classification
// (system.classification.size, the parent Weapon item's own field - distinct from each weaponEffect's
// own classification.skill/style) - same parent-weapon-check shape as Martial Weapon Master/Walking
// Weapon Rack above, just checking classification.size instead of traits. A "may" substitution, so
// it's a checkbox (same shape as Ambush Predator/Wire Work's own "may" language), not automatic.
const BRUTE_FORCE_IAF2_ID = "Compendium.essence20.intercontinental_adventures.Item.T75CELkuLUUgmxXZ";

// Big And Scary (Factions in Action Vol. 2, General Perk, p.63): "You count as 1 Size Class larger
// when it is to your advantage. Additionally, you gain ↑1 on Intimidation Skill Tests per Size
// Class you are larger than the target of your Skill Test." Folded into one check: since being
// counted as 1 Size Class larger is always beneficial for THIS specific clause (RAW's own "when
// advantageous" qualifier), the actor's own size index is read as one step up the moment this
// specific Intimidation size-difference is computed - see its own check next to Giant-Killer's
// identical size-difference math in _getAutomaticCombatModifiers.
const BIG_AND_SCARY_ID = "Compendium.essence20.intercontinental_adventures.Item.FZww5MX65plu6kZ8";

// Empathy (MLP CRB, Spirit of Kindness, 1st level, p.82): a choiceType:'skills' pick - "your
// Empathy skill" in every other Kindness Perk's own RAW text (Counselor, Tender, The Bigger The
// Heart, Supportive Friend, Kind But Firm) means "whichever skill you chose here," not a literal
// new skill type (confirmed: no 'empathy' key exists in E20.skills).
const EMPATHY_MLP_ID = "Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ";

// The Bigger The Heart (MLP CRB, Spirit of Kindness, 9th level, p.85): "when making an Empathy
// Skill Test against a larger creature, you get ↑1 for each Size Class the creature is larger
// than you." Same per-target Size-difference math as Big And Scary/Giant-Killer just below, but
// unscoped from Intimidation to whichever skill the actor's own Empathy choice names, and with no
// "count as 1 larger" twist (a plain difference, not Big And Scary's own always-beneficial +1).
const BIGGER_THE_HEART_ID = "Compendium.essence20.mlp_crb.Item.fiyZcC8KRK5TebTk";

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

// Hesher (Factions in Action Vol. 2, General Perk, p.64): "Choose one of the following Skills:
// Deception, Intimidation, or Persuasion. You can roll Performance (Music) in place of the chosen
// Skill for Skill Tests." Uses the existing generic 'skills' choiceType (system.choice) - that
// picker offers every skill, not just the 3 RAW names (this codebase has no "restricted skill
// subset" choiceType, and building one for a single Perk's own 3-option list is disproportionate),
// the same "player self-polices a narrower-than-built qualifier" idiom Bits To Spare/Fear My Name
// already accept elsewhere. The substitution itself is the same shift-position-delta mechanism
// Wire Work/Ambush Predator already established, just against whichever skill was chosen.
const HESHER_ID = "Compendium.essence20.intercontinental_adventures.Item.4PCn3kSSYmPtQOUM";

// Fire Master (Oktober Guard General Perk, p.95) - see its own check next to Barrel Through/
// Electric's identical damageType-check shape above.
const FIRE_MASTER_ID = "Compendium.essence20.intercontinental_adventures.Item.jkqhVz3ahtRGqqya";

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
// "of you" escalation to Edge can't be verified (this system's Frightened status has no notion of
// WHO caused it), so only the base ↑1 half is built - the same "grant the verifiable lesser
// benefit, drop the unenforceable escalation" idiom this project already applies elsewhere. A
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
const PARANOIA_ID = `${GI_JOE_CRB}HG32BCzrF6Hsz7yR`;
const FIRST_STRIKE_ID = `${GI_JOE_CRB}qxqtfBobduwSkfRM`;
const SECONDS_BETWEEN_CLICK_AND_BOOM_ID = `${GI_JOE_CRB}ofiG5IwlURUwORYV`;
const PIERCING_SHOT_ID = `${GI_JOE_CRB}W4PmkxBW7m3j88oF`;
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
const SILVER_TONGUE_ID = `${GI_JOE_CRB}69ijP0SuQ4demwd9`;
const SHOCK_AND_AWE_ID = `${GI_JOE_CRB}a5HptfB7nYFLVHkc`;
// Explosive Aftershock - see its own comment near isExplosiveAftershockAttack below.
const EXPLOSIVE_AFTERSHOCK_ID = `${GI_JOE_CRB}Kvq0MfPqSya2mf5b`;
const WHO_DARES_WINS_ID = `${GI_JOE_CRB}zfyTLiJDNKPHETlv`;
const ASSAULT_PRECISION_ID = `${GI_JOE_CRB}KZAmBNsIW03H6xQh`;
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
const WARFIGHTER_ID = `${GI_JOE_CRB}P0ZTAlcenVw2p4P1`;
const SILENT_WEAPON_EXPERTISE_ID = `${GI_JOE_CRB}JKn8mFG98ZzmiFSd`;
const DUCK_AND_COVER_ID = `${GI_JOE_CRB}2R3saLtDCI1q2QBz`;
const QUIET_AS_THE_GRAVE_ROUND_FLAG = 'quietAsTheGraveLastRound';
const FIELD_ID = `${GI_JOE_CRB}qHLeKSMin2F19O3C`;
const EUREKA_ID = `${GI_JOE_CRB}I8gudNc8gLD63ziL`;
const EXPERT_IN_YOUR_FIELD_ID = `${GI_JOE_CRB}mnLXHQ2TwR3A42fS`;
const PENETRATING_ROUNDS_ID = `${GI_JOE_CRB}JLwbWSlHn5q3rqnH`;
// Kentucky Windage (Sniper Focus, 10th level, p.75): "your attacks with sniper weapons ignore
// cover." Same "ignore cover" idiom as Penetrating Rounds just above, gated on the parent weapon's
// own 'sniper' trait (the same trait check Piercing Shot's identical Edge-crit clause already
// uses) instead of a specific weapon sourceId.
const KENTUCKY_WINDAGE_ID = `${GI_JOE_CRB}0MKcgJ4mUHDotl2k`;

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
  // WTNV Citizen's Guide "Trade Experience" (Engineer Origin, p.31): "ignore the first ↓1
  // applied... and reroll 1s" - verbatim identical shape, scoped to one Smarts/Speed Skill of
  // the player's choice, same choiceType:'skills' mechanism.
  "Compendium.essence20.wtnv_citizens_guide.Item.7PcR6dSWFjFcD7Uv",
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

// Brain Power (GI Joe CRB, Think Tank Focus, 1st level, p.105): "choose one of the following
// skills: Athletics, Might, Finesse, or Targeting. When making Skill Tests of the chosen skill,
// including attacks, you can use Technology instead." Same shift-position-delta substitution
// shape as Cunning Plan/How Strange! above, free (no cost), gated to whichever skill the player
// chose (system.choice via the existing choiceType:'skills' picker, same as Awesome/Cutie Mark
// Perk) rather than a single fixed skill like How Strange!'s own Weird-only scope.
const BRAIN_POWER_ID = `${GI_JOE_CRB}3KaGPbEZp3ZDQrIF`;
// Seeing the Matrix - see its own comment near updatedShiftDataset.seeingTheMatrixAvailable below.
const SEEING_THE_MATRIX_ID = `${GI_JOE_CRB}M8D4FRcfaGm5i2jH`;
const SEEING_THE_MATRIX_ENCOUNTER_FLAG = 'seeingTheMatrixUsedThisEncounter';

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

// Growth Boost (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33) - see its own
// damage-bonus comment below.
const GROWTH_BOOST_ID = "Compendium.essence20.jump_through_time.Item.BVrwQKqvOdyNW0KR";

// Quantum Defender (Sword)/(Blaster) - the Quantum Ranger's own two named starting weapons,
// checked by Quantum Cut/Solo Shot below (same weaponSourceId idiom as Long Range Rifle/Shotgun/
// Submachine Gun elsewhere in this file).
const QUANTUM_DEFENDER_SWORD_ID = "Compendium.essence20.jump_through_time.Item.HNgu1rhXK46RG0bW";
const QUANTUM_DEFENDER_BLASTER_ID = "Compendium.essence20.jump_through_time.Item.gOZtlnZubOZ01ZdF";
const QUANTUM_CUT_ID = "Compendium.essence20.jump_through_time.Item.9DhE4UzSl40c8lW401";
const SOLO_SHOT_ID = "Compendium.essence20.jump_through_time.Item.SS1IgnoreRange10";

// Eltarian Tech (Through the Shattered Grid, Guardian of Eltar, 1st level, p.72): "spend 1
// Eltarian Tech to gain Edge on a Technology Skill Test." Functionally identical in shape to
// Eureka! above ("spend an Idea Point to gain Edge on a Smarts Skill Test") - actor._getBaseRolePoints()
// already resolves generically to whichever rolePoints item is THIS actor's own base one (Idea
// Points for a Blue Ranger, Eltarian Tech for a Guardian of Eltar - see its own doc comment in
// documents/actor.mjs), so the same lookup works unchanged. Scoped to the Technology SKILL
// specifically (not the whole Smarts essence, unlike Eureka!'s own wider scope).
const ELTARIAN_TECH_ID = "Compendium.essence20.through_the_shattered_grid.Item.jaqxs1OPQuaI9KJZ";

// Zeal (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72): "Any mind-affecting or
// mental Attack has a Snag against your Willpower." Same reciprocal target-status Snag shape as
// Indomitable's own Intimidation check - "mind-affecting/mental" has no dedicated flag anywhere in
// this system, so it's proxied by the attack's own Psychic damage type (the closest concrete
// classification this system already tracks for "an attack that targets the mind"), same
// "closest existing concept" judgment call this project makes wherever RAW names something this
// codebase has no matching field for.
const ZEAL_ID = "Compendium.essence20.through_the_shattered_grid.Item.s68pRzqIk5ApctTd";

// "Oh, What Now?" (PR CRB, Cynical Origin benefit, p.24): "Any attack or effect that targets you
// emotionally automatically suffers Snag." Same reciprocal target-status Snag shape as Zeal's own
// mind-affecting check just above, "emotionally" proxied by the same Psychic damage type. The
// "Edge when trying to roll to overcome emotional distress" clause isn't built - no specific Skill
// or Condition-removal action exists for "emotional distress" broadly enough to commit to without
// over-claiming.
const OH_WHAT_NOW_ID = "Compendium.essence20.pr_crb.Item.FauecjTdfhdnz7n9";

// Charge Into Battle (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72) - see its
// own comment near calculatedShiftUp above and multiple-targets.mjs's own widening.
const CHARGE_INTO_BATTLE_ID = "Compendium.essence20.through_the_shattered_grid.Item.34O7Y77lZpuhng3G";

// Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72) - see
// helpers/observer.mjs's own doc comment.
const OBSERVER_ID = "Compendium.essence20.through_the_shattered_grid.Item.PTkqeQ8D4x9cstlZ";

// Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - see
// helpers/supreme-guardian.mjs's own doc comment. Bullet 2 only here ("spend any number of
// Eltarian Tech Points for +1 Energy damage each" after hitting with a Melee Power Weapon) - the
// same Terror-style spend-for-damage numeric field, just scoped to a melee powerWeapon-trait
// Attack instead of any Attack.
const SUPREME_GUARDIAN_ID = "Compendium.essence20.through_the_shattered_grid.Item.wrBndkBQoKkn3dLy";

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

// Transformers CRB Role Perks automated below - Tier 1 of the Transformers Role automation pass
// (see project plan). Same "bare compendium item, code supplies the mechanic" situation as PR.
const TF_CRB = "Compendium.essence20.tf_crb.Item.";

// Long Shot (Sharpshooter Focus, 1st level, p.70) - see its own check, next to the automatic
// long-range Snag it suppresses.
const LONG_SHOT_TF_ID = `${TF_CRB}Q3KK4HYhwjk52kle`;

// Piercing Shot (Sharpshooter Focus, 6th level, p.70) - a same-named but distinct compendium Item
// from GI Joe's own PIERCING_SHOT_ID above; see its own check for the difference.
const PIERCING_SHOT_TF_ID = `${TF_CRB}DEP9LhBOMtC0cSVO`;
const LONG_RANGE_RIFLE_ID = `${TF_CRB}8Hi76APCo9QRnbLE`;

// Just the Facts (Analyst, 16th level, p.62) - see its own check, next to First Strike above (the
// non-combat-targeting infrastructure both of these share).
const JUST_THE_FACTS_ID = `${TF_CRB}v6A7mQwdKQR6J5fR`;

// Transformers Tier 2 Role/Focus automation pass - each constant's own check below carries its
// own RAW quote and reasoning; grouped here just to keep the compendium IDs in one place.
const PREPARE_FOR_WAR_ID = `${TF_CRB}sM2Uk6ZzOS3CPzoW`;
// Ready For Anything (GI Joe CRB, Renegade base, 9th level, p.97): "you gain an Edge on
// Initiative rolls" - only this half is built (see prepareInitiativeRoll's own comment for why
// the other two clauses stay unbuilt). Same unconditional-Initiative-Edge shape as Prepare for
// War/Sirens Blaring just above.
const READY_FOR_ANYTHING_ID = `${GI_JOE_CRB}BEAZ1oLp9XeibJoh`;
const SIRENS_BLARING_ID = `${TF_CRB}WZA3q9BRESFVx6SS`;
const INDOMITABLE_ID = `${TF_CRB}CXnb6i4d7XhkhFNr`;
// Keep Your Cool (A Jump Through Time, General Perk, p.53, built 2026-09-12) - see its own check
// near Indomitable's identical shape.
const KEEP_YOUR_COOL_ID = "Compendium.essence20.jump_through_time.Item.566NsnD5dccg9uVo";

// The Glory of Cobra-La (Ferocious Fighters, Cobra-La Faction Perk, p.73) - see its own reciprocal
// Snag check below, right alongside Indomitable's identical mechanism.
const GLORY_OF_COBRA_LA_ID = "Compendium.essence20.ferocious_fighters.Item.VAhtHpKlv4gsR0OY";
const HOW_I_GOT_THESE_DENTS_ID = `${TF_CRB}FfKkjODcY5N1Rk7G`;
const CHARGE_TF_ID = `${TF_CRB}l5TPdusi8cQJESfp`;
const DRILLING_SHOT_ID = `${TF_CRB}M0aeDLMOUTy7ju90`;
const STRONGER_TOGETHER_ID = `${TF_CRB}ZeOj3mmjnXJ7iXj1`;
// Impenetrable Armor - see its own comment below, in the checkEntries construction.
const IMPENETRABLE_ARMOR_ID = `${GI_JOE_CRB}vanN7kRYUhgHew7q`;
// Environmental Armor - see its own comment below, in the checkEntries construction.
const ENVIRONMENTAL_ARMOR_ID = `${GI_JOE_CRB}Vo5AfbJNfVGf24E0`;
// Recon - see its own comment in rollSkill()'s self-status section and prepareInitiativeRoll().
const RECON_ID = `${GI_JOE_CRB}EDBn8zHJXkRFu2TT`;
const ANALYZE_TARGET_ID = `${TF_CRB}UjzBPz4iUBoi8Kyk`;
const INFORMED_ACCURACY_ID = `${TF_CRB}JtWhjDRI0HDewaKe`;
const PSYCHOANALYST_ID = `${TF_CRB}5X4NOluWwc7fv497`;
const TARGET_VULNERABILITY_ID = `${TF_CRB}SaHjAp42EhhOQr2g`;
const EXPLOIT_TRUST_ID = `${TF_CRB}TpanlsVW9nobDZyy`;
const BARREL_THROUGH_ID = `${TF_CRB}uyhMkYlTF9tfoVGC`;
// Beast of Burden (GI Joe CRB, General Perk, p.96) - see WRESTLER_SLAMMER_ID's own comment below.
const BEAST_OF_BURDEN_ID = `${GI_JOE_CRB}8m5s0JxTNSMU9zcj`;
// Wrestler (Slammer Focus, Sgt Slaughter Sourcebook, 10th level, p.13): "you gain your Beast of
// Burden bonus to Skill Tests to Maneuver." Beast of Burden's own bonus is a flat, unconditional
// +2 Might shiftUp (a plain compendium Active Effect) - already fully applied on its own to any
// Might roll, but Wrestler's own clause is explicitly an ADDITIONAL benefit on top of that, so it
// must matter for a Maneuver-classified attack rolled with a DIFFERENT skill than Might. Read
// directly here as a flat +2 shiftUp on any Maneuver-damageType weaponEffect, the same "checks
// item.system.damageType directly" shape as Barrel Through/Electric just above - hardcoded to
// match Beast of Burden's own fixed value (same "hardcoded copy of another Perk's fixed number"
// idiom Meat Shield's own copy of Personal Shield's table already established), rather than
// re-reading Beast of Burden's own Active Effect at runtime. The other half of Wrestler ("no
// longer suffer downshifts for using the Maneuver alternate effect of Melee weapons") isn't built
// - this system has no automated downshift for a weapon's own Alternate Effects at all (that's a
// build-time customization concept, not yet modeled anywhere), so there's nothing to suppress.
const WRESTLER_SLAMMER_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.ro5hMv4XMhOmANao";
// Superior Athlete - see its own comment near updatedShiftDataset.shiftUp below.
const SUPERIOR_ATHLETE_ID = `${GI_JOE_CRB}C9HN9cz5Yxxb3jBj`;
// Safecracker - see its own comment near updatedShiftDataset.shiftUp below.
const SAFECRACKER_ID = `${GI_JOE_CRB}bmvvsEyoylGTA9Ui`;
const STUNNING_SURPRISE_ID = `${TF_CRB}6KrQp4s1o2ffGHhC`;
const WATCHFUL_EYES_ID = `${TF_CRB}RmHSzuVLnIoqeczy`;
const LOCK_DOWN_ID = `${TF_CRB}NELFIhFMZXPlXaWc`;
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

// Maximize Cover (Raider, 7th level, p.61) - see its own check, next to the base Cover shift-down
// it widens.
const MAXIMIZE_COVER_ID = `${DECEPTICON_DIRECTIVE}lBSdHGBOOVvEYW1t`;

// What Cover? (Enigma of Combination, Cannoneer Focus, 6th level, p.32) - see its own check, next
// to the base Cover shift-down it widens (the opposite direction from Maximize Cover: this reduces
// the penalty the ATTACKER themselves suffers, rather than increasing what a target imposes). The
// "Cover is destroyed after a successful hit" half isn't automated - Cover isn't modeled as a
// destructible object anywhere in this codebase.
const WHAT_COVER_ID = "Compendium.essence20.enigma_of_combination.Item.A2gJlm0YEFlpVNLg";

// Nowhere's Safe / Absolutely Nowhere's Safe (Transformers CRB, Gunner base, 5th/13th level,
// p.68) - see the Cover shift-down computation they widen.
const NOWHERES_SAFE_TF_ID = "Compendium.essence20.tf_crb.Item.A6QkTlG2DQYYwNOb";
const ABSOLUTELY_NOWHERES_SAFE_ID = "Compendium.essence20.tf_crb.Item.ku86uidqAswijlAd";

// Hard Target (Transformers CRB, Gunner base, 16th level, p.69): "when you take cover, attackers
// targeting you suffer ↓3 instead of ↓2" - textually identical to Decepticon Directive's own
// Maximize Cover (a distinct compendium item, same book family), so this just joins that same
// target-side widening rather than duplicating it.
const HARD_TARGET_TF_ID = "Compendium.essence20.tf_crb.Item.rdhSMPSXlcxQUVYj";

// Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - see
// helpers/covering-fire.mjs's own doc comment.
const COVERING_FIRE_ID = "Compendium.essence20.tf_crb.Item.cAm087BkiExKIJrY";

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

// Calculated Attack (Transformers CRB, Gunner base, Sharpshooter Focus, 3rd level, p.70): "when
// you Aim at a target with your Long Range Rifle, you can make a Science Skill Test against their
// Evasion or Cleverness. On a success, Aiming grants ↑2 instead of ↑1." A "Use" button dispatch
// (banked-buffs.mjs) triggers the real Science roll via actor._dice.rollSkill() - the same
// "trigger a full interactive roll from a synthetic dataset" shape Absolute Menace/Duty Of The
// Graphite already established - and, on success, banks a per-target flag consumed by aimBonus's
// own computation the next time this actor Aims at that same target with the Long Range Rifle
// specifically (Aiming itself stays a separate, later action - RAW's own "when you Aim" reads as
// a precondition on the Skill Test, not a combined single action).
const CALCULATED_ATTACK_FLAG = 'pendingCalculatedAttack';

// Machinist (Transformers CRB, Influence Perk, p.37): "Edge on any Skill Test to repair or
// upgrade a Cybertronian or Cybertronian technology." Unlike Inventor's own nearby "technology of
// your own creation" clause (a narrative ownership qualifier this codebase has no hook for),
// "repair or upgrade" IS a first-class concept already referenced by name elsewhere (Field
// Repair/Remove & Rebuild both key off a Repair action) - but no specific skill is named and no
// "this roll is a repair attempt" flag exists on ANY roll type, so this is a Roll Options Dialog
// checkbox offered unconditionally (the player self-polices the fictional trigger, the same idiom
// Aiming/Precision Aim's own checkboxes already use), not gated to a specific skill.
const MACHINIST_ID = "Compendium.essence20.tf_crb.Item.14SqA7pgjDcFyQVd";

// Large And In Charge (Transformers CRB, Origin Perk, Monolith Chassis, p.51) - see its own check
// in _getAutomaticCombatModifiers's per-target block.
const LARGE_AND_IN_CHARGE_ID = "Compendium.essence20.tf_crb.Item.Rj9N6i7Jmkl54ujX";

// The Fiercest Among You (Transformers CRB, Origin Perk, Rainmaker Chassis, p.52) - see its own
// check in _getAutomaticCombatModifiers's self-status section.
const FIERCEST_AMONG_YOU_ID = "Compendium.essence20.tf_crb.Item.LZirSocExL40Ljya";

// Experiment (Transformers CRB, Influence Perk, p.32) - see E20.experimentOptions' own doc
// comment. Only 2 of the 4 named options are built: "shove" (↑1 Shoving or breaking from a
// Grapple, read as any grapple-damageType weaponEffect, the same proxy Wrestler/Kung Fu Grip's own
// checks already use) and "technology" (Edge on Technology Skill Tests, the "unfamiliar to you"
// qualifier dropped unconditionally, same idiom as Bits To Spare/Truthseeker). carryingWeight and
// hardpoint stay unbuilt - confirmed no encumbrance tracking and no Integrated-Hardpoint-slot
// field exist anywhere in this codebase.
const EXPERIMENT_ID = "Compendium.essence20.tf_crb.Item.EcSOADOOb3PZMolz";

// Acute Sense (Transformers CRB, General Perk, p.107) - see its own check near Truthseeker's
// identical Alertness-Edge shape. Widened to an array (built 2026-09-12) since PR CRB's own
// "Acute (Sense)" (p.94, hasChoice:'senses' - which sense is chosen doesn't change this half)
// grants the identical unconditional Alertness Edge; that item's own "+1 on non-Alertness Tests
// where the sense applies" half stays unbuilt, too broad a "where it applies" qualifier to
// flatten safely, same reasoning already documented for this Perk's TF CRB printing.
const ACUTE_SENSE_IDS = ["Compendium.essence20.tf_crb.Item.rl8hs6ezb6VSDahM", "Compendium.essence20.pr_crb.Item.qKoTBo1FKzCq1qTt"];

// Daredevil (Transformers CRB, General Perk, p.108): "Prereq Driving d6 with a specialization.
// While in Alt Mode: Edge on Initiative; ↑2 Driving." The compendium item's own single unconditional
// effect correctly stays disabled (it doesn't gate on being in Alt Mode) - the Initiative-Edge half
// lives in prepareInitiativeRoll() (Initiative never rolls through rollSkill() in practice), the
// Driving-shiftUp half lives here, both gated on actor.system.isTransformed - see its own comment
// in prepareInitiativeRoll() for why this earlier-claimed "no Bot-Mode tracking" gap was wrong.
const DAREDEVIL_ID = "Compendium.essence20.tf_crb.Item.8GgFGdlmri0GyKNI";
const OBJECT_ALT_MODE_ID = "Compendium.essence20.tf_crb.Item.z3qE2fLKzJtsyZ6C";

// Now You Don't (Transformers CRB, General Perk, p.110) - see its own check in
// _getAutomaticCombatModifiers's Cover block.
const NOW_YOU_DONT_ID = "Compendium.essence20.tf_crb.Item.iW9TjN9X6SsYm2Ql";

// Bootlicker (Decepticon Directive, General Perk, p.65): "Gain ↑1 on Skill Tests when interacting
// with superior officers." "Interacting with superior officers" has no trackable game state, so
// this is a Roll Options Dialog checkbox offered unconditionally on any roll, the same
// self-attested "player self-polices the fictional trigger" idiom Machinist just above uses.
const BOOTLICKER_ID = "Compendium.essence20.decepticon_directive.Item.e0nwsw9VKBlZHZJ0";

// Gutter Champion (Decepticon Directive, Influence Perk, p.26): "In any action where you are
// breaking local laws or ignoring government edicts, you gain ↑1 once each turn." Same
// self-attested checkbox idiom as Bootlicker, but with a real once-per-turn frequency cap RAW
// itself states (unlike Bootlicker's own unstated frequency).
const GUTTER_CHAMPION_ID = "Compendium.essence20.decepticon_directive.Item.pByfeAj3iyANNR68";
// Beloved (A Jump Through Time, Influence Perk, p.16, built 2026-09-12): "In any scene where you
// act on behalf of your beloved's desires, safety, or guidance, you may choose to gain +1 or
// remove Snag from one Skill Test per turn." Only the +1 half is built - same self-policed
// once-per-turn checkbox idiom as Gutter Champion just above, narrative qualifier dropped. The
// "or remove Snag" half is a genuinely separate branch (would need its own checkbox or a
// pick-one-of-two dialog for one narrow Influence Perk) - left as a documented gap rather than
// forced into this same single checkbox.
const BELOVED_ID = "Compendium.essence20.jump_through_time.Item.wXbkcyQTziLjCYEC";

// Thrillseeker (GI Joe CRB, Hang-Up, p.55): "Three times per mission, you feel the need to make
// things more difficult just to prove you can overcome. You suffer a Snag on a single Strength or
// Speed Skill Test as you make things more difficult." Unlike every other checkbox above (an
// upside the player opts into), this is a Hang-Up's own downside the player VOLUNTARILY imposes
// on themselves - same self-policed checkbox idiom, but checking it sets Snag rather than granting
// a shiftUp, and the frequency cap is a genuine per-encounter COUNT (up to 3) rather than the usual
// once-per-turn/-scene boolean, using getUsesThisEncounter/markUsedThisEncounterCount (the same
// counting sibling of hasUsedThisEncounter Green's own 3x/day counter already established, just
// exposed to the player as an opt-in choice here instead of a silent suppression).
const THRILLSEEKER_HANGUP_ID = `${GI_JOE_CRB}7ISxvemsGVWGIzna`;
const THRILLSEEKER_ENCOUNTER_FLAG = 'thrillseekerUsedThisEncounter';

// Recruiter (Decepticon Directive, Influence Perk, p.28): "If you have some kind of asset... to
// barter with, you gain Edge on Deception and Persuasion Skill Tests." "Have some asset" is a
// near-universal, unenforceable qualifier (same idiom as Bits To Spare/Truthseeker's own narrower
// wording) - granted unconditionally on either named skill.
const RECRUITER_ID = "Compendium.essence20.decepticon_directive.Item.vx3ZMblF2uv5qHJT";

// Analytical (Decepticon Directive, General Perk, p.64): "Whenever you attempt a Science or
// Technology Skill Test, you do so as if Specialized." A blanket treat-as-Specialized grant across
// BOTH named skills - closer to the existing isSpecialized pre-fill idiom (Warfighter/
// Environmental Expertise/Genius) than to a single named/persisted Specialization write
// (bestow-expertise.mjs's own shape, which grants ONE specific Specialization, not a blanket
// treat-the-whole-skill-as-Specialized).
const ANALYTICAL_ID = "Compendium.essence20.decepticon_directive.Item.dOQdlIDhD9b84Fd2";

// Perimeter Defender (Decepticon Directive, General Perk, p.66): "You're Specialized in all
// Alertness Skill Tests and can critically succeed with a d2 on Alertness Skill Tests." Same
// isSpecialized pre-fill shape as Analytical above, plus the existing canCritD2 pre-fill idiom
// (Piercing Shot's own identical shape) - both scoped to Alertness only.
const PERIMETER_DEFENDER_ID = "Compendium.essence20.decepticon_directive.Item.MXW4BmGWCfuV1Lu9";

// Cruel (Decepticon Directive, General Perk, p.65, prereq 6th level): "Anytime you are attacking a
// target suffering from one or more Conditions, you gain Edge on the attack. If the target is
// Immobilized or Restrained, you inflict 1 additional damage as well." The Edge half checks
// target.statuses.size directly (this system's own live Condition set, so "one or more Conditions"
// maps onto "the set isn't empty"); the damage half is the same "computed in
// _getAutomaticCombatModifiers, folded into damageBonusValue back in rollSkill()" shape Zordbane's
// own identical damage bonus already established (see zordbaneDamageBonus's own comment).
const CRUEL_ID = "Compendium.essence20.decepticon_directive.Item.mAhqrcJNmNAJHjA8";

// Exterminator (Decepticon Directive, General Perk, p.65): "When attacking a target of Common or
// Small size, you gain ↑1 and may reroll any Skill Die results of 1, as long as the target is
// smaller than you." The ↑1 half is a plain size-comparison shiftUp (same sizeOrder idiom Large
// And In Charge already establishes); the reroll half is threaded through as a new
// `smallerTarget` REROLL_CONDITIONS entry (see its own comment below) - the compendium item's own
// `system.reroll` config (mode:"ones", condition:"smallerTarget") does the rest generically.
const EXTERMINATOR_ID = "Compendium.essence20.decepticon_directive.Item.B5HgQeurLyvio1t7";

// Metallikato (Decepticon Directive, General Perk, p.66) - see helpers/metallikato.mjs's own doc
// comment for the full 4-benefit breakdown. This constant covers the armor-ignore checkbox, the
// Multiple Targets toggle's own paired ↓1, and the automatic trip-on-Crit half - the Multiple
// Targets trait grant itself lives in helpers/multiple-targets.mjs, and the reroll benefit is a
// bare compendium config needing no code at all.
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

// Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46) - see
// helpers/two-heads-are-better-than-one.mjs's own doc comment for the self-Lend-Assistance half
// (the ↑1 Alertness half is a plain compendium ActiveEffect, no code needed).

// Big Preds Are My Specialty (Technorganic Secrets, General Perk, p.45): "Gain an Edge to Survival
// Skill Tests to track down an enemy larger than yourself... When attempting to catch a larger
// target by surprise in combat, gain ↑1 to Infiltration Skill Tests for each size category bigger
// the target is than you." The Survival Edge half is a plain compendium ActiveEffect ("to track
// down an enemy larger than yourself" dropped, same narrative-qualifier-flattening idiom Bits To
// Spare/Truthseeker already establish). The Infiltration half is the live check below - "by
// surprise" is similarly dropped (no Surprised status anywhere in this system); the size-scaling
// math is the plain (unmodified) ladder difference, NOT Big And Scary's own "count the actor as 1
// larger" twist - RAW states no such bonus step here.
const BIG_PREDS_ARE_MY_SPECIALTY_ID = "Compendium.essence20.technorganic_secrets.Item.igkuus7jkoqYV5Fr";

// Vicious or Venom (Technorganic Secrets, Saurian Origin Benefit, p.43): "You gain 1 Toughness.
// You may choose one of the following benefits to add to your natural weapon attacks: Acidic
// Saliva (+1 Acid damage) / Razor-Sharp (+1 Sharp damage) / Venomous (+1 Poison damage)." The +1
// Toughness half is a plain compendium ActiveEffect; the damage-choice half is the live check
// below - see its own comment there.
const VICIOUS_OR_VENOM_ID = "Compendium.essence20.technorganic_secrets.Item.zey1cJ2IuWlTsjN2";

// Get Low (Technorganic Secrets, Slitherer Origin Benefit, p.43): "While in your Alt Mode, you
// cannot become Prone and ranged Attacks against you suffer ↓2. You are also able to gain cover
// from shorter obstacles. Finally... ↑1 on Infiltration Skill Tests that relate to moving quietly
// and unseen." The Prone-immunity half lives in condition-immunity.mjs (isActive gated on Alt
// Mode); the ranged-Snag half is the live check below, same "ranged read as not melee" shape
// Distraction already establishes; the Infiltration shiftUp half is a self-status check in
// rollSkill() (Alt Mode gated, same idiom as Crushing Strength), narrative qualifier dropped. The
// "cover from shorter obstacles" clause stays unbuilt - no granular Cover-source classification
// exists, only the existing binary Cover flag.
const GET_LOW_ID = "Compendium.essence20.technorganic_secrets.Item.rEoZEFQR2puQxpIW";

// Prehensile Feet (Technorganic Secrets, Primate Origin Benefit, p.42): "While in your Alt Mode,
// your feet and toes have the same mobility as hands and fingers... you can use your feet to pick
// up items and fire weapons [while your hands are otherwise engaged]. The usefulness of your
// appendages also grants you ↑1 on Acrobatics Skill Tests while in your Alt Mode." The extra-hands
// clause is narrative - no "hands occupied" tracking exists anywhere in this codebase; the ↑1
// Acrobatics half is the live check below, Alt Mode gated (same shape as Get Low's own Infiltration
// clause/Daredevil's Driving clause).
const PREHENSILE_FEET_ID = "Compendium.essence20.technorganic_secrets.Item.OdHMLgny9aqCevAc";

// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38): "you gain ↑1
// on Acrobatics and Infiltration Skill Tests and are unimpeded by rough terrain. Additionally,
// choose one: Agile Reflexes (once/scene, when an attack targets your Toughness, you may use
// Evasion instead) / Innate Climber (+40ft Climb Movement while in your Alt Mode)." The flat
// shiftUp half is a plain compendium ActiveEffect; "unimpeded by rough terrain" stays unbuilt (no
// terrain-classification concept exists anywhere). Innate Climber's movement grant lives in
// documents/actor.mjs#_prepareMovement; Agile Reflexes' defenseType override is the live check
// below, in rollSkill()'s own per-target checkEntries construction (the one place defenseType is
// actually known - see this project's own tracked "defenseType known only after the dialog
// resolves" gap for why _getAutomaticCombatModifiers couldn't do this instead).
const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";
const AGILE_REFLEXES_FLAG = 'agileReflexesUsedThisEncounter';

// Hunter's Prowess (Technorganic Secrets, Quadruped Origin Benefit, p.44): "All Quadruped chassis
// gain ↑1 on Skill Tests that predominantly utilize their senses of hearing or smell." No skill is
// named (unlike a typical narrower-qualifier Perk), so this is a self-attested Roll Options Dialog
// checkbox offered on any roll, same "player self-polices the fictional trigger" idiom Bootlicker/
// Machinist already establish - the choose-one sub-options (Brute/Burrower/Sprinter/Stalker) are
// each their own already-built (or partly-built, see actor.mjs/SPRINTER_ID's own comments) child
// compendium item via the existing generic choiceType:'perks' picker, not handled here.
const HUNTERS_PROWESS_ID = "Compendium.essence20.technorganic_secrets.Item.hUB8IRdRucRToty2";

// Sprinter (Transformers One Sourcebook, General Perk, p.19): "Increase your Bot Mode Ground
// Movement by 5 feet. Additionally, you gain ↑1 on Acrobatics and Athletics Skill Tests in Bot
// Mode." CORRECTED 2026-09-11: same authoring bug as Technorganic Secrets' own identically-named
// Perk - the compendium's own unconditional `system.movement.ground.bonus +5` effect buffed Alt
// Mode too, when RAW scopes it to Bot Mode specifically. Disabled that effect; the live, Bot-Mode-
// gated replacement lives in documents/actor.mjs. The Acrobatics/Athletics shiftUps are the live
// checks below (distinct compendium item from Technorganic Secrets' Sprinter/Hunter's Prowess's
// own Sprinter sub-choice - a third, unrelated "Sprinter" name in this project).
const TF1S_SPRINTER_ID = "Compendium.essence20.transformers_one_sourcebook.Item.gbDY8UiTgSNZHPAo";

// Handy Bot (Transformers One Sourcebook, General Perk, p.16, prereq Miner Influence): "You treat
// Close Combat Blades and Close Combat Bludgeons as though they had the Tool trait. Additionally,
// you gain ↑1 on Attacks with weapons with the Tool trait." The "treat as having the Tool trait"
// half is a requisition-time/Kit-substitution nuance (see the New Weapon Trait's own "treat as a
// Kit of the designated Specialization" text) with no runtime combat effect to automate - only the
// ↑1 Attack shiftUp (the live check below) is a real roll modifier.
const HANDY_BOT_ID = "Compendium.essence20.transformers_one_sourcebook.Item.TTeqM5BORGFuHcj9";

// Powerful Grip (Transformers One Sourcebook, General Perk, p.19): "You gain ↑1 on Skill Tests as
// part of a grapple. Additionally, you gain ↑1 on Brawn Skill Tests in Bot Mode and use this
// increased Brawn Rank to meet weapon requirements." "As part of a grapple" is proxied by the
// attack's own grapple damageType, the same established idiom Wrestler/Kung Fu Grip/When Push
// Comes To Shove already use for identifying a grapple/shove action. "Use this increased Brawn
// Rank to meet weapon requirements" is a chargen/equipment-qualification nuance, not a roll
// modifier - not built.
const POWERFUL_GRIP_ID = "Compendium.essence20.transformers_one_sourcebook.Item.nJ4hF4Oa2m8SvMJX";

// Stand Together (Transformers One Sourcebook, Autonomous Bots Faction Perk, p.15): "Choose one
// Skill when you join this Faction. You gain ↑1 to all Skill Tests OUTSIDE OF COMBAT with that
// Skill." Same hasChoice:'skills' picker + `!game.combat` gate as GI Joe CRB's own Specialist
// (SPECIALIST_ID above), just a flat shiftUp instead of Edge - "once per encounter" isn't stated
// here (unlike Specialist's own unenforceable cap), so no simplification needed. The equipment-
// Qualification/Training half and the disease-immunity half are chargen/narrative, not built.
const STAND_TOGETHER_ID = "Compendium.essence20.transformers_one_sourcebook.Item.kW4yyD9rwhc0JfYp";

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

// Dutiful (Transformers One Sourcebook, Influence Perk, p.9): "Creatures suffer a Snag on Skill
// Tests to convince you to change your mind. Additionally, you gain ↑1 on Social Skill Tests
// outside combat when interacting with others in the line of duty." The first half is proxied by
// Persuasion specifically (the same "convince/change someone's mind" reading Just the Facts'/
// Trustworthy's own reciprocal-Snag checks already use for Deception-flavored manipulation, applied
// here to Persuasion instead) - see the live check in _getAutomaticCombatModifiers. The second half
// is a flat Social-essence shiftUp outside combat (any Social-essence skill, "in the line of duty"
// narrative qualifier dropped, same idiom Stand Together's own outside-combat check just above
// uses) - see the live check in rollSkill()'s self-status section.
const DUTIFUL_ID = "Compendium.essence20.transformers_one_sourcebook.Item.330YD4FFwbHyJOE8";

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
const SHARPSHOOTERS_GRACE_TF_ID = "Compendium.essence20.tf_crb.Item.cVyIxoXOZhwrBBBD";

// Durabyllium Super-Alloy (Transformers CRB, General Perk, p.108) - its own +2 Toughness is
// already a live compendium Active Effect; this is the second, unbuilt clause: "opponents
// attacking you with a Blunt, Cold, or Fire weapon suffer ↓1 to their attack roll" - a reciprocal
// attacker-side Snag-adjacent downshift, keyed off the ATTACK's own damageType against the
// TARGET holding this Perk, same "widen an existing per-target check by a new condition" shape as
// every other damage-type-conditional combat modifier in this file.
const DURABYLLIUM_SUPER_ALLOY_ID = "Compendium.essence20.tf_crb.Item.Q9DWZNwPe66ewBuG";

// Razor Tongue (Transformers CRB, General Perk, p.111) - its own +2 Cleverness is already a live
// compendium Active Effect; this is the second, unbuilt clause: "+1 damage on attacks that
// successfully target an enemy's Cleverness Defense" - a flat damage bonus keyed on the roll's own
// defenseType, same shape as every other defenseType-conditional damage bonus already in this
// file's damageBonusValue computation.
const RAZOR_TONGUE_ID = "Compendium.essence20.tf_crb.Item.jwREkh7fN4FLjDmz";

// Fuel Efficient (Transformers CRB, General Perk, p.109): "Prereq Level 12. When you spend an
// Energon Point, roll a d4; on a 4, regain it." The only confirmed Energon-Point deduction site in
// this codebase is rollSkill()'s own Converting cost (system.energon.normal.value - 1) - layered
// a post-spend d4 regain check directly onto that site. If Energon is spent anywhere else in a
// future pass, that site would need the identical hook added.
const FUEL_EFFICIENT_ID = "Compendium.essence20.tf_crb.Item.hW6ESJ1p7GvIGzBe";


// Lay of the Land (Enigma of Combination, Surveyor Focus, 3rd level, p.36) - see its own check,
// next to the base Cover shift-down it widens (same "-1 instead of -2" shape as What Cover?
// above). The Edge-on-Infiltration/Survival half is a plain compendium Active Effect, no code.
const LAY_OF_THE_LAND_ID = "Compendium.essence20.enigma_of_combination.Item.CTt9gmibpffGC0N4";

// Two Steps to the Right (Enigma of Combination, Surveyor Focus, 10th level, p.36) - shares Lay
// of the Land's own benefits (both halves) with allies within 60ft. See its own checks below and
// next to the Cover shift-down above.
const TWO_STEPS_TO_THE_RIGHT_ID = "Compendium.essence20.enigma_of_combination.Item.a5xcpj3rHW5EW354";

// Dig In (Enigma of Combination, Cannoneer Focus, 17th level, p.32) - see
// helpers/cannoneer-dig-in.mjs's own doc comment (a same-named, textually distinct Perk from
// Decepticon Directive's own Dig In). Checked both here (Cover penalty) and in the Aiming bonus
// computation below.
const CANNONEER_DIG_IN_ID = "Compendium.essence20.enigma_of_combination.Item.RQjNiRZxDFwTPHN8";

// All I Need is One Shot (Enigma of Combination, Cannoneer Focus, 20th level, p.32): "Instead of
// attacking multiple times using Bang Bang or Bang Bang Bang, you make a single ranged attack
// that gains upshift 2 and deals 2 additional damage." Bang Bang/Bang Bang Bang (a core Combat
// Actions multi-attack mechanic) aren't modeled anywhere in this codebase (the recurring action-
// economy gap), so there's no actual multi-attack flow to substitute out of - offered instead as
// an unconditional Roll Options Dialog checkbox on any ranged attack, the same "the player
// self-polices whether the fictional trigger applies" idiom Aiming/Precision Aim already use.
const ALL_I_NEED_IS_ONE_SHOT_ID = "Compendium.essence20.enigma_of_combination.Item.Y1sMUqI3JOYb0QiD";

// Dig In (Raider, Siegemaster Focus, 10th level, p.64) - see helpers/dig-in.mjs's own doc comment
// for the Snag half checked here (the Prone-immunity half lives in condition-immunity.mjs).
const DIG_IN_ID = `${DECEPTICON_DIRECTIVE}9tIkV50YiO3xqxvi`;

// Mega Training Regimen (Ferocious Fighters, Mega Marines Faction Perk, p.74) - see its own
// Snag-vs-Maneuver check below (a one-line, unconditional copy of Dig In's own Maneuver-Snag
// check, just without the toggled-stance gate).
const MEGA_TRAINING_REGIMEN_ID = "Compendium.essence20.ferocious_fighters.Item.nLT8HSCCGWEBiRlq";

// Steady Footing (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see its own
// Maneuver-shiftDown check below, right alongside Mega Training Regimen's identical mechanism.
const STEADY_FOOTING_ID = "Compendium.essence20.intercontinental_adventures.Item.U4bVJU5BpT3BTfSx";

// City Slicker (Factions in Action Vol. 2, Oktober Guard General Perk, p.95; prerequisite:
// Streetwise +d4): "you gain ↑1 when making Alertness Skill Tests among large crowds." "Among
// large crowds" is dropped, same unconditional-shiftUp idiom this project already uses for every
// other un-enforceable narrative qualifier (Bits To Spare/Truthseeker, etc.). "In an urban
// environment, use Streetwise instead of Infiltration for Stealth" is Needs new infrastructure
// (the standing skill-substitution-family gap, compounded by the same unenforceable "which
// environment" trigger already documented for Environmental Expertise).
const CITY_SLICKER_ID = "Compendium.essence20.intercontinental_adventures.Item.xU1p1S5JuVu6XiAI";

// Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99) - see helpers/bulwark.mjs's own doc comment
// and _hasNearbyBulwarkCover's own comment below for the "provide cover to adjacent allies" half.
const BULWARK_ID = `${GI_JOE_CRB}7758n3XWOzhSjdOk`;

// Fear My Name (Raider, 14th level, p.62) - see its own check above.
const FEAR_MY_NAME_ID = `${DECEPTICON_DIRECTIVE}FgKFLD6anmWXFwPU`;

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

// Rifle Tally (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 20th level, p.28) - see
// its own check further below.
const RIFLE_TALLY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.dXCi2IGJnV47wzqe";

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

const HEALING_BANDAGES_ID = `${MLP_CRB}CbEGORrDiBO00Qsb`;
const FLUTTERY_WINGS_ID = `${MLP_CRB}HO82viVmbKgmCAts`;
const LIGHTNING_SPEED_ID = `${MLP_CRB}trENOkDUbjra0BEN`;

// Awesome (Loyalty, 14th level, p.90): "choose a Social Skill; you always gain an upshift 1 to
// that Skill." A permanent shiftUp scoped to a player-chosen skill - same choiceType:'skills' +
// system.choice shape as GI Joe's own Expertise (see _hasExpertiseDownshiftImmunity's own doc
// comment), just an upshift instead of downshift immunity.
const AWESOME_MLP_ID = `${MLP_CRB}3NN8lJZNwu9w6LBR`;
const HONEST_ASSESSMENT_ID = `${MLP_CRB}eIDYxShici5rRpg3`;

// Bits To Spare (Generosity, 2nd level, p.75): "gain Edge on Wealth checks to buy items for
// friends." Truthseeker (Honesty, 5th level, p.78): "gain Edge on Awareness Tests to detect
// lies." Both grant Edge unconditionally on the named skill whenever the actor holds the Perk -
// "to buy for friends"/"to detect lies" is a narrative purpose-qualifier this system has no hook
// to verify (same "player self-polices the fictional trigger, or the DM just says no" reasoning
// already accepted for Long Shot's own unconditional suppression), so it's granted on any use of
// that skill rather than forcing a checkbox for every narrowly-scoped Edge grant in this batch.
const BITS_TO_SPARE_ID = `${MLP_CRB}lGYdVH8RWletaWyB`;
const TRUTHSEEKER_ID = `${MLP_CRB}NtbQt7wwCYdrUxhL`;
// Profiteer (A Jump Through Time, Influence Perk, p.17, built 2026-09-12): "Edge on all Wealth
// Tests and Skill Tests to acquire monetary value or worth" - the same unconditional Wealth-Edge
// shape as Bits To Spare above, "given 6 hours to prepare" dropped the same accepted way.
const PROFITEER_JTT_ID = "Compendium.essence20.jump_through_time.Item.KPAgV7R7zsP6ts5Q";

// Search and Seizure (Ferocious Fighters, Force Recon Focus, 10th level, p.44): "you gain Edge on
// Alertness and Infiltration Skill Tests outside combat scenes." Same `!game.combat`-gated Edge
// shape as Broadcaster/Stand Together above, just against two named skills instead of one. The
// "investigating takes half as long" clause is Not automatable (no Exploration/Time-tracking
// mechanism exists anywhere in this codebase).
const SEARCH_AND_SEIZURE_ID = "Compendium.essence20.ferocious_fighters.Item.qZiv0m6kc4G9HYEn";

// Surgical Operators (Ferocious Fighters, Anti-Venom Task Force Faction Perk, p.72): "You gain
// Edge on Science Skill Tests when treating poisons, toxins, or similar substances." Same
// unconditional-Edge-drop-the-narrative-qualifier idiom as Bits To Spare/Truthseeker above - the
// item's own +1 Willpower half is already a plain compendium Active Effect, confirmed unrelated
// to this check.
const SURGICAL_OPERATORS_ID = "Compendium.essence20.ferocious_fighters.Item.JtRCN6ppDatZVmav";

// Lifelike (Field Guide to Action and Adventure, Pretender Origin, p.64): "When in Bot Mode, you
// gain an Edge on Skill Tests to pass as an organic life-form." RAW pulled fresh from the actual
// PDF (no cached extraction existed for this book). Deception is the natural single-skill reading
// of "passing as" something you're not - a judgment call, same as this project's own established
// idiom for narrower narrative-triggered Edges (Bits To Spare/Truthseeker), but the skill choice
// itself isn't explicitly named in RAW. "Bot Mode" reads directly off the existing
// `actor.system.isTransformed` flag (false = Bot Mode, true = Alt Mode) - already a real,
// long-established field (sheet-handlers/transformer-handler.mjs), not a new concept. This Origin
// Benefit's OTHER clause ("abilities that give benefits for hiding while in Alt Mode... apply to
// your Bot Mode instead," e.g. "For the Allspark!'s Infiltration bonus") isn't built - the
// specific ability it names ("For the Allspark!") isn't itself built anywhere in this codebase
// yet, and the general form ("any Alt-Mode-hiding ability") has no generic redirect mechanism to
// hook - nothing concrete to override without the base ability existing first, the same class of
// gap this project already accepted for Quick Study/Swift Study earlier this session.
// Widened 2026-09-11: byte-identical RAW confirmed as Technorganic Secrets' own Pretender Origin
// Benefit (p.45), a second printing of the same Perk - same "one mechanic, several compendium
// printings" shape GIANT_KILLER_IDS already establishes. Caught before duplicating this whole
// check under a second, divergent implementation (a self-declared any-skill checkbox had already
// been drafted, less precise than this existing Deception-specific reading - reverted in favor of
// widening the existing check instead).
const LIFELIKE_IDS = [
  "Compendium.essence20.field_guide_action_adventure.Item.cqAShkpH0EIYZSDS",
  "Compendium.essence20.technorganic_secrets.Item.XnXghb8MMa8Vm4e1",
];

// Skeptic (Field Guide to Action & Adventure, p.58) - Influence Perk: "You're Resistant to
// Deception Skill Tests" (its own +1 Willpower half is already a plain compendium Active Effect).
// Same reciprocal-target-Snag shape as Just the Facts' own Resistant half just above, just
// unconditional (no level comparison in this Perk's own RAW). Hang-Up: "Persuasion Skill Tests
// targeting you gain an Edge" - the mirror-image reciprocal Edge, checked via actorHasHangUp()
// since this Hang-Up's own mechanical clause lives directly on its hangUp-type Item (findPerk()'s
// strict type=='perk' filter can't see it - see perks.mjs#findHangUp's own doc comment).
const SKEPTIC_INFLUENCE_ID = "Compendium.essence20.field_guide_action_adventure.Item.vb1L2oi4xiWkD5ZF";
const SKEPTIC_HANGUP_ID = "Compendium.essence20.field_guide_action_adventure.Item.gUrBCm0G8ntInUar";

// Animal (GI Joe CRB, pet General Perk, p.165): as a wild/feral pet, Persuasion and Deception
// Skill Tests targeting the holder gain a Snag - same unconditional reciprocal-target-Snag shape
// as Skeptic's own Influence half just above, just covering both Social skills at once.
const ANIMAL_ID = "Compendium.essence20.gi_joe_crb.Item.YeGzq0XETdv7LeBn";

// Martial Artist (PR CRB, Hang-Up, p.70 / GI Joe CRB, Hang-Up, p.50 - same name, identical
// verbatim text, reprinted in both books): "attempts to goad you into action with Social abilities
// gain an Edge against you." A widened Essence-scoped sibling of Skeptic's own single-skill
// reciprocal Edge shape just above - "Social abilities" reads as the whole Social Essence rather
// than one named skill, so this checks rolledEssence directly instead of rolledSkill. A small
// array (like UNTRAINED_SNAG_IMMUNITY_PERKS/GREEN_IDS), not a second hardcoded ID.
const MARTIAL_ARTIST_PR_HANGUP_ID = `${PR_CRB}hXKy7kWGic6wSge9`;
const MARTIAL_ARTIST_GIJ_HANGUP_ID = `${GI_JOE_CRB}rIIL4yvym7KUCUyH`;
const MARTIAL_ARTIST_HANGUP_IDS = [MARTIAL_ARTIST_PR_HANGUP_ID, MARTIAL_ARTIST_GIJ_HANGUP_ID];

// Trustworthy (Honesty, 2nd level, p.78) - see its own check, next to Just the Facts' own
// Immune-half idiom it reuses.
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

// Dinobot (Technorganic Secrets, Influence Perk, p.28): "Choose a Brawn or Survival
// Specialization, whether or not you invested in that Specialization. You gain an Edge on Skill
// Tests when that Specialization comes into play." Same choiceType:'skills' + system.choice shape
// as Specialist/Rocket Scientist above - "whether or not you invested" means the Edge applies
// even without rolling as Specialized, so this checks the chosen skill directly rather than
// skillRollOptions.isSpecialized; "when that Specialization comes into play" (the specific
// flavor, e.g. "Survival (Desert)") is dropped the same unenforceable-narrative-qualifier way
// Specialist's own "must already be Specialized" precondition already is.
const DINOBOT_ID = "Compendium.essence20.technorganic_secrets.Item.tx4mlGvMhiWXA4mp";
const DINOBOT_SKILLS = ['brawn', 'survival'];

// Maximal (Technorganic Secrets, Influence Perk, p.26) - same shape as Dinobot just above,
// restricted to Persuasion/Science/Technology instead.
const MAXIMAL_ID = "Compendium.essence20.technorganic_secrets.Item.z3Ig9tbOEq4erPU5";
const MAXIMAL_SKILLS = ['persuasion', 'science', 'technology'];

// Predacon (Technorganic Secrets, Influence Perk, p.27): same choice-Edge shape as Dinobot/Maximal
// above, restricted to Intimidation only - plus its own second clause: "If you Intimidate a foe
// in a conflict scene, they gain the Frightened Condition until the end of their next turn."
// "Conflict scene" maps onto game.combat existing, the same idiom this project already uses for
// "combat" elsewhere; applied in _rollSkillHelper's post-hit loop, same unconditional
// single-target Frightened shape as Snarl's own identical clause.
const PREDACON_ID = "Compendium.essence20.technorganic_secrets.Item.jRD6G5Z6eblTvxeO";

// Biogenetic (Technorganic Secrets, Influence Perk, p.30): "If your form remains BioGenetic
// [i.e. your Beast Mode is a genuine animal/plant], you gain an Edge on any Skill Tests made to
// hide or blend into a suitable environment and an Edge on Skill Tests when interacting with
// creatures of the same species as you. If you are no longer BioGenetic, you gain 1 on those
// Skill Tests instead." "Remains/no longer BioGenetic" maps onto this project's existing Alt
// Mode/Bot Mode toggle (actor.system.isTransformed, true = Alt Mode = still BioGenetic - see
// Get Low/Sprinter/Powerful Grip's own identical gate just below), not a separate concept.
// "Hide or blend" -> Infiltration (Get Low's own precedent); "interacting with same-species
// creatures" -> Persuasion, the default representative Social-interaction skill this project
// already uses for similarly unscoped "a Social Skill Test" clauses (Duty Of The Graphite).
const BIOGENETIC_ID = "Compendium.essence20.technorganic_secrets.Item.OA6xYj6axivOD38i";

// Animal Friend (General Perk, p.122): "when dealing socially with an animal, you are always
// considered to have a Specialization." Approximated as an unconditional isSpecialized pre-fill on
// Animal Handling (the "dealing socially" qualifier can't be verified, same accepted-simplification
// idiom Bits To Spare/Truthseeker's own narrower RAW wording already uses) - same shape as
// Warfighter's own isSpecialized pre-fill.
const ANIMAL_FRIEND_ID = `${MLP_CRB}Lj2zJKh31VNkuSGP`;

// Adaptable (Earth Pony Origin Perk, p.33) - see its own check, next to Animal Friend's identical
// isSpecialized-pre-fill idiom.
const ADAPTABLE_ID = `${MLP_CRB}tenW0mLLZZTZTDX1`;
// Adventurer - see its own comment near the Adaptable check below.
const ADVENTURER_ID = `${GI_JOE_CRB}T3XgGSGuZsFVifsS`;

// Force (Heavy Hitter Influence, p.51): "If you make a successful unarmed attack using Might, you
// may do an additional point of Health damage. But using this ability is exhausting so you may
// only use it once per scene." Fleeting Energy (its own paired Hang-Up, p.51): "After you use the
// Heavy Hitter Influence's Force Perk, you suffer ↓1 on Strength based Skill Tests until the end
// of your next turn." Once/scene approximated via hasUsedThisEncounter (always available outside
// combat, the same accepted looseness Specialist's own doc comment already establishes) - "unarmed"
// detected via no parent weapon Item, the same proxy Phantom Ranger Prime/Power Adaptation's own
// unarmed clauses already use.
const FORCE_ID = `${MLP_CRB}p4qXDtj2RCJcibCh`;

// Shoots and Scores (Sporty Influence, p.60): "When you achieve Critical Success at an Athletics
// Skill Test, you gain a Friendship point." A reactive trigger flagged onto checkContext and
// applied once the roll actually resolves - same "flag now, act on it once resolved" shape
// Stay Humble's own STAY_HUMBLE_ID already establishes, just on a Critical Success (multiplier >=
// 2) instead of a failure.
const SHOOTS_AND_SCORES_ID = `${MLP_CRB}ciWHdEjMnqAxBkZi`;
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

// Springy (Spring into Action Influence, p.61): "When you roll your first Initiative Skill Test in
// a Conflict, you can do so as if you have a specialty in Initiative." "First... in a Conflict" has
// no boundary this codebase tracks separately from every other Initiative roll - granted
// unconditionally on every Initiative roll, the same accepted simplification as everywhere else in
// this project. Applied directly in prepareInitiativeRoll (the dedicated Initiative path, not
// rollSkill - Enhanced Reflexes' own Initiative half already established this split is required).
const SPRINGY_ID = `${MLP_CRB}Sb0zs5C7ZReiZfpO`;

// Wheel Struggle (Wheel Obsession Hang-Up, p.65): "When you are in a vehicle and you are not the
// driver, you suffer Snag on all Skill Tests." Reuses the already-built vehicle
// crew/pilot-assignment infrastructure (_getPilotedVehicle/_getVehicleDriver) - the actor is
// riding in SOME vehicle (_getPilotedVehicle(actor) is non-null) but isn't that vehicle's own
// driver (_getPilotedVehicle(actor, 'driver') is null).
const WHEEL_STRUGGLE_ID = `${MLP_CRB}veMhcO6X5AHQym5H`;

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
const SMOKE_BEAM_ID = `${DARK_SKIES_OVER_EQUESTRIA}b4UMfiQUFohGIrb4`;

const KNIGHTS_OF_CANTERLOT_SPELLS = "Compendium.essence20.knights_of_canterlot.Item.";
const KOC_FIREBALL_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}zlERIywyKQNBQzs6`;
const KOC_THE_STARE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}SPk4Fxfc4pUV5pDO`;
const KOC_ROPE_TRICK_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}tH1Z3Ou3IET70t4K`;
const KOC_SHOWER_POWER_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}2I9z9FdCqMZFcR2O`;
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
// here to nearby allies too). Checked from the ROLLER's own Initiative prep, same as
// Iconoclast/Two Steps to the Right's own nearby-ally scans.
const ON_YOUR_FEET_ID = `${SGT_SLAUGHTER_SOURCEBOOK}4qibn7JQ1lHTe9gT`;

// Whip Into Shape (Drill Instructor Focus, Officer, 17th level, p.10): "once per scene, you can
// use Intimidation in place of another Strength- or Speed-based Skill for a Skill Test." Same
// shift-position-delta substitution mechanism as Cunning Plan/Roaring Engine/Technically Correct -
// this one substitutes the actor's own Intimidation die into whichever Strength/Speed skill is
// actually being rolled, gated once/scene (hasUsedThisEncounter) via a Roll Options Dialog
// checkbox, same as every other declared (not automatic) substitution in this project.
const WHIP_INTO_SHAPE_ID = `${SGT_SLAUGHTER_SOURCEBOOK}0Vca0OGRVIchK3KU`;

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
const KOC_SUPER_STICKY_CELEBRATION_STRING_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}CbI36ZY491Lf8wwV`;
const KOC_FOOLSCARROT_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}doF1rRuMXaeAPDTl`;
const KOC_SCAREFYING_APPEARANCE_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}110Rq0wQaqFuugUc`;
const KOC_BLOCK_MAGIC_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}J1jUwu4IIuPxQE10`;

// Camouflage Hide (General Perk, p.20): "As a Free action, you can give yourself an Edge on an
// Infiltration Skill Test." No cost/limit stated (a Free action), so this is granted
// unconditionally rather than needing its own checkbox/Use button - same "always available"
// idiom Warfighter's own unconditional grants already use.
const CAMOUFLAGE_HIDE_ID = `${DARK_SKIES_OVER_EQUESTRIA}PuMnUtkl1eZ0HmY7`;

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

const STORY_OF_THE_SEASONS = "Compendium.essence20.story_of_the_seasons.Item.";

// Noble Heritage (Griffon Origin Perk, p.130): "Griffons... come from a Noble Heritage... it works
// just like a Cutie Mark... pick a Skill, Specialization, or abstract area... ↑1 on any action
// that area might apply to." Verbatim the same shape as MLP CRB's own Cutie Mark Perk - only the
// "pick a Skill" branch is built (choiceType:'skills' + a flat +1 shiftUp), same scope limitation.
const NOBLE_HERITAGE_ID = `${STORY_OF_THE_SEASONS}77GZdVfPFDG6P1e6`;

// Sky Warrior (General Perk, p.131): "While fighting in the air, whether your opponent is on the
// ground or not, you get ↑1 to your attack." "While fighting in the air" is dropped (this system
// tracks no "am I currently airborne" state to check), leaving an unconditional ↑1 shiftUp on any
// weaponEffect attack, regardless of skill - same broad "no single skill named" shape Trapsmith's
// own multi-skill grant already established, just one flat bonus across every attack skill here.
const SKY_WARRIOR_ID = `${STORY_OF_THE_SEASONS}rHFtc9mok8t9ZubI`;

const WTNV_CITIZENS_GUIDE = "Compendium.essence20.wtnv_citizens_guide.Item.";

// Merit Badges (Scout Origin, p.33) - see its own check above.
const MERIT_BADGES_ID = `${WTNV_CITIZENS_GUIDE}nTwviKh1ND0jGVvr`;

// Station Management (General Perk, p.51, Intern Origin prereq) - see its own check above.
const STATION_MANAGEMENT_ID = `${WTNV_CITIZENS_GUIDE}b3LfFejkc8dJspCc`;

// The Weather (General Perk, p.52, Smarts 3+ prereq) - see its own check above.
const THE_WEATHER_ID = `${WTNV_CITIZENS_GUIDE}RdxkmVbHZXN5zGa9`;

// Community Martial Arts (General Perk, p.48): "+1 on unarmed melee Attack Skill Tests in
// combat." Same "no parent weapon" unarmed proxy as Iron Hooves, plus a melee-style gate (unlike
// Iron Hooves' own any-skill scope) - the "+1 Social/Smarts about fighting" clause is dropped
// (2 whole Essences, too broad an approximation given RAW itself narrows to a specific topic).
const COMMUNITY_MARTIAL_ARTS_ID = `${WTNV_CITIZENS_GUIDE}uY9wPJH31z5kAtdB`;

// Strex Strikes (General Perk, p.52): "Your unarmed attacks deal +1 damage." Verbatim identical
// shape to Iron Hooves (MLP CRB) - any unarmed attack, no skill restriction.
const STREX_STRIKES_ID = `${WTNV_CITIZENS_GUIDE}4aYIkhmBO77Irq5l`;

// Skepticism (General Perk, p.51): "Weird Skill Tests against you suffer ↓1." A reciprocal
// target-status check - the TARGET (this Perk's holder) suffers a Snag-equivalent downshift
// applied to whoever rolls Weird against them, same shape as Indomitable's own Intimidation-Snag
// reciprocal check.
const SKEPTICISM_ID = `${WTNV_CITIZENS_GUIDE}46O2TMRbIOL6OJq9`;

// Kill Your Double (General Perk, p.49): "Edge on Attack Skill Tests against enemies who have the
// Weird Skill." "Have the Weird Skill" is read as having actually trained it (shift better than
// the untrained d20 default), the same "any real rank at all" proxy used wherever this project
// needs to detect "does the target have skill X" with no dedicated flag to check instead.
const KILL_YOUR_DOUBLE_ID = `${WTNV_CITIZENS_GUIDE}dbknbG5RGOz0VTzO`;

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
// self-or-ally heal half is a pure IMMEDIATE_ALLY_PERKS entry (helpers/banked-buffs.mjs), no code
// needed here.
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

// See Something, Say Nothing (General Perk, p.51): "Edge on Streetwise Skill Tests. Enemies suffer
// ↓1 on Skill Tests to coax or force information from you." See both of its own checks above.
const SEE_SOMETHING_SAY_NOTHING_ID = `${WTNV_CITIZENS_GUIDE}v3EUjzeDcIA9B4FL`;

// Keen Eye (Curious Influence, p.27) - see its own check above.
const KEEN_EYE_ID = `${WTNV_CITIZENS_GUIDE}CoKVBoZljMYhQbCW`;

// Distance Vision (General Perk, p.50) - see distanceVisionApplies' own comment above.
const DISTANCE_VISION_ID = `${WTNV_CITIZENS_GUIDE}cdFa6pHVLWLsWMpL`;

// Academic Studies (Student Origin, p.30) - see its own check above.
const ACADEMIC_STUDIES_ID = `${WTNV_CITIZENS_GUIDE}zKyFqePOc7wElWcL`;

// Mercantile Store (Farmer Role, p.37) - see its own check above.
const MERCANTILE_STORE_ID = `${WTNV_CITIZENS_GUIDE}aP7MMWqiINdM5vlg`;

// How Strange! (Scientist Role, p.44) - see updatedShiftDataset.howStrangeAvailable's own comment
// above.
const HOW_STRANGE_ID = `${WTNV_CITIZENS_GUIDE}zsuQoBsso5SddTAs`;

// Kind, But Firm (MLP CRB, Spirit of Kindness, 17th level, p.86): "you can use your Empathy Skill
// for Intimidation Skill Tests, as long as no harm comes to the creature you're targeting." Same
// shift-position-delta substitution as How Strange!/Wire Work above, but the substituted skill is
// dynamic (whichever the actor chose via the Empathy Perk's own choiceType:'skills' pick, see
// EMPATHY_MLP_ID's own comment) rather than a fixed skill - "no harm comes to the target" is
// dropped as an unenforceable narrative qualifier, same idiom as Aiming/Precision Aim's own
// self-policed checkboxes.
const KIND_BUT_FIRM_ID = "Compendium.essence20.mlp_crb.Item.kh28DVKbBxMcnMmd";

// Stubbornly Loyal (MLP CRB, Spirit of Loyalty, 9th level, p.90) - see its own check in
// _getAutomaticCombatModifiers.
const STUBBORNLY_LOYAL_ID = "Compendium.essence20.mlp_crb.Item.zqsFMIRKaA0Ev62Y";

// Wire Work - see updatedShiftDataset.wireWorkAvailable's own comment above.
const WIRE_WORK_ID = `${GI_JOE_CRB}TGqWGjDUy24SPSGZ`;

const FEROCIOUS_FIGHTERS = "Compendium.essence20.ferocious_fighters.Item.";

// Ambush Predator (Factions in Action Vol 1: Ferocious Fighters, General Perk, p.37): "In a
// natural environment, you use Survival instead of Infiltration for Skill Tests related to
// Stealth. You can use a Free action to gain this benefit in a manufactured environment." Same
// shift-position-delta substitution shape as Wire Work/How Strange! above - "natural environment"
// can't be verified (no environment/terrain classification exists anywhere in this codebase, the
// same gap already flagged for several other Perks), so offered unconditionally, the "Free
// action" qualifier for a manufactured environment becoming moot once the gate itself is dropped.
// A DIFFERENT, unrelated compendium item from Cobra Codex's own same-named "Ambush Predator" (a
// Role Perk with no prerequisite, page 60) - not touched here.
const AMBUSH_PREDATOR_ID = `${FEROCIOUS_FIGHTERS}ht6w4P3AsRze8S68`;

// Saber-Toothed (Factions in Action Vol 1: Ferocious Fighters, General Perk, p.37): "Your Unarmed
// Combat attacks gain a 1 Sharp damage (↓1) Alternate Effect." Read as a checkbox choice at
// attack-declare time (the same "(↓X) Alternate Effect" notation this system's own weapon items
// already use for a downshift-priced damage-type swap) - suffer ↓1, deal Sharp instead of the
// Unarmed Combat attack's own default Blunt damage type. Gated on "no parent weapon" (the same
// proxy Phantom Ranger Prime/Power Adaptation's own unarmed-attack checks already establish, since
// this system has no dedicated "unarmed" trait/flag).
const SABER_TOOTHED_ID = `${FEROCIOUS_FIGHTERS}RVGlDHOKipqZ1e7i`;

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

// Viral News Bloggers (Journalist Role, Print Focus, p.38) - see its own checks above.
const VIRAL_NEWS_BLOGGERS_ID = `${WTNV_CITIZENS_GUIDE}ORyWD8AKRIqo0jdS`;

// Mightier Than the Sword (Journalist Role, Print Focus, p.38) - see its own check above.
const MIGHTIER_THAN_THE_SWORD_ID = `${WTNV_CITIZENS_GUIDE}KPjNit8G842eVCMd`;
const WTNV_DAGGER_ID = `${WTNV_CITIZENS_GUIDE}ZLvRtMySr9GPe4oD`;

// "Pseudo"-Science (Scientist Role, Night Vale Community College Focus, p.44) - see
// helpers/pseudo-science.mjs's own doc comment.
const PSEUDO_SCIENCE_ID = `${WTNV_CITIZENS_GUIDE}MTo42tKWWtZ15Ist`;

// Barista Experience (General Perk, p.47): "↑2 on Smarts and Social Skill Tests when you interact
// with Night Vale's baristas." Narrative qualifier dropped (unenforceable) - same unconditional
// idiom as Keen Eye, just a bigger flat bonus.
const BARISTA_EXPERIENCE_ID = `${WTNV_CITIZENS_GUIDE}jKWyWKHb8iDwQvB4`;

// Cat Training (General Perk, p.47): "You ignore the first ↓1 on Speed Skill Tests." Same
// cancel-one-point-of-downshift shape as Expertise/Eltarian Training above, scoped to the whole
// Speed Essence rather than one skill.
const CAT_TRAINING_ID = `${WTNV_CITIZENS_GUIDE}T0pVW1q1T3n234rl`;

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

// Camper (General Perk, p.13): "As long as you have at least half your Health remaining... you
// gain an Edge on Survival Skill Tests to find a safe place to camp and set up camp." Only this
// half is built - the "↑1 to camping-related Skill Tests" clause names no specific Skill, and the
// "restores 1 Health or 2 Stress" clause needs a Stress resource this codebase doesn't track at
// all (confirmed via a full grep - no "stress" field exists anywhere in this project).
const CAMPER_ID = `${KNIGHTS_OF_CANTERLOT}dMEFcqcain5oS2mJ`;

const COBRA_CODEX = "Compendium.essence20.cobra_codex.Item.";

// Desperate - see its own check below, next to Camper.
const DESPERATE_ID = `${COBRA_CODEX}RfjdqScdCbMgGESR`;

// Street Smarts (Cobra Codex, Criminal Origin Benefit, p.43): "You can use Streetwise in place of
// Persuasion for Skill Tests." Same shift-position-delta substitution mechanism as How Strange!/
// Wire Work/Ambush Predator/Kind But Firm/Explosive Engineer above - despite an earlier
// categorization pass claiming "no skill-substitution mechanism exists anywhere in this
// codebase," this project already has one, established well before Cobra Codex was ever
// investigated. The essence-override half ("Streetwise is a Smarts Essence skill... in addition
// to Social") is a separate, already-existing (if buggy - see the compendium JSON's own fix)
// Active Effect, not touched here.
const STREET_SMARTS_ID = `${COBRA_CODEX}np3oMccakpivWuSQ`;

// Primal Fear (Cobra Codex, Ranger Guerilla Focus, 3rd level, p.59): "you can use Survival in
// place of Intimidation for Skill Tests." Same substitution mechanism as Street Smarts above. The
// skill-rank-reallocation clause is character-build-time bookkeeping (same "not a runtime effect"
// reasoning as General Perk Basic Training), and the separate "target a creature with a Survival
// Skill Test... once per turn" clause is its own distinct ability, not built this pass.
const PRIMAL_FEAR_ID = `${COBRA_CODEX}xoD8fbVVqymTidNJ`;

// Natural Science (Cobra Codex, Ranger Firestarter Focus, 1st level, p.58): "Any time you are
// called on to make a Science Skill Test, you can use the Survival skill instead, and vice
// versa" - the first BIDIRECTIONAL instance of this substitution mechanism (every prior grant
// only ever named one fixed direction), so this needs two checkboxes instead of one. The
// Element-Jets-qualification/free-Weapon-Upgrade clauses need item-grant/qualification
// infrastructure not attempted this pass.
const NATURAL_SCIENCE_ID = `${COBRA_CODEX}AXmmcHK2tSzRZLqB`;

// Science Fixes All (Cobra Codex, Technician Biotechnician Focus, 6th level, p.64): "you can use
// Science in place of Technology for Skill Tests." Same substitution mechanism as Street Smarts
// above. The skill-rank-reallocation clause is the same build-time bookkeeping already flagged
// for Primal Fear.
const SCIENCE_FIXES_ALL_ID = `${COBRA_CODEX}cxTzdLpTblPMMEQk`;

// Urban Jungle (Cobra Codex, Vanguard Citystriker Focus, 3rd level, p.68) - the skill-substitution
// clause only: "inside and outside of an urban environment, you can use Streetwise in place of
// Survival for Skill Tests" - RAW's own "inside AND outside" wording makes this one clause
// explicitly environment-independent, unlike this same Perk's other 3 "in urban environments"
// clauses (ignore Rough Terrain, Edge on non-attack Skill Tests, Specialized attacks), which stay
// unbuilt - no environment-tagging exists anywhere in this codebase, the same gap already flagged
// for several other Perks (Environmental Enforcer, Sewer Tunneler, etc.).
const URBAN_JUNGLE_ID = `${COBRA_CODEX}wIesQd7U5W2azAWY`;

// Fear Is Universal (Cobra Codex, Officer Taskmaster Focus, 10th level, p.57): "you can use
// Intimidation in place of Animal Handling, Deception, and Persuasion for Skill Tests." The first
// grant substituting into 3 different skills at once rather than 1 - one checkbox, offered
// whenever the rolled skill is any of the three, always computing the delta against Intimidation's
// own die. The Story-Point-spend half ("use these skills on a creature normally immune to them")
// has no "creature is immune to a Skill" concept anywhere in this codebase to spend around.
const FEAR_IS_UNIVERSAL_ID = `${COBRA_CODEX}oGVp2hIxNBT8g1QW`;

// Cobra Battle Cry (Cobra Codex, Cobra Corps Perk, p.72): "When called to make an Initiative
// Skill Test, you can instead use Deception or Intimidation." Initiative never rolls through
// rollSkill() in practice (see this method's own top comment) - same
// prepareInitiativeRoll()-side shift-position-delta substitution as Ever Vigilant/Needle Drop/
// Your Reputation Precedes You above, but offering a genuine choice between 2 alternate skills
// (2 checkboxes) rather than one fixed substitute.
const COBRA_BATTLE_CRY_ID = `${COBRA_CODEX}cqOozFDOGiQoV0L7`;

// Angry Influence (Cobra Codex, p.26): "Once per day, you can gain Edge on a Strength-based Skill
// Test." Approximated as once per encounter, the same day-to-encounter idiom this project already
// uses everywhere else. Its own Hang-Up ("suffer Snag on a single Smarts- or Social-based skill
// you've invested at least 1 Skill Point in, for the rest of the scene - the GM chooses the
// skill") is approximated as a player-facing picker offered the moment the Perk is used (a
// GM-adjudicated pick offered to the player instead, the same idiom this project already applies
// wherever a GM-judged choice has no other hook) - see helpers/angry.mjs.
const ANGRY_ID = `${COBRA_CODEX}fHmLPZ3K8AGgzANp`;
const ANGRY_HANGUP_ID = `${COBRA_CODEX}wGMyGbySdNSgPs8B`;

// Indoctrinated Influence (Cobra Codex, p.31): "Any attempt to change your mind about Cobra - such
// as Intimidation or Persuasion Skill Tests - suffers Snag." The "about Cobra" qualifier is
// dropped, same idiom as Bits To Spare/Truthseeker above - unconditional Snag on the actor's own
// Intimidation/Persuasion rolls (see the self-status section below). Hang-Up: "Any attempt to
// improve your attitude toward a speaker that reinforces how you feel about Cobra - such as a
// Deception Skill Test - gains Edge" is a reciprocal target-side grant (the ATTACKER gets Edge
// deceiving an Indoctrinated Hang-Up holder), same shape as Trustworthy's own target-side
// Deception check below.
const INDOCTRINATED_ID = `${COBRA_CODEX}BctKHzpCC1XXoJPg`;
const INDOCTRINATED_HANGUP_ID = `${COBRA_CODEX}ggsVevfXdHhZwlAm`;

// Unscrupulous Influence (Cobra Codex, p.36): "Deception, Intimidation, and Persuasion Skill Tests
// that in any way imply there is good in you suffer Snag." Qualifier dropped, same idiom as
// Indoctrinated above - unconditional Snag on the actor's own Deception/Intimidation/Persuasion
// rolls. Its own Hang-Up text ("suffer Snag on the same 3 skills if the target is particularly
// empathetic or ethical") describes the exact same mechanical effect once ITS qualifier is
// dropped too, so it isn't separately flagged/duplicated here - a second identical Snag source
// would be a no-op against this engine's plain boolean Snag flag.
const UNSCRUPULOUS_ID = `${COBRA_CODEX}QJ1Uw4VZxy3zrxa1`;

// Iconoclast Origin's Disrupter benefit (Cobra Codex, p.45): "You gain Edge on Initiative tests
// for combats where at least one enemy has a Threat Level higher than your character level." A
// whole-combat scan (every combatant, not a nearby-radius one) - see hasIconoclastEdge() below,
// checked in prepareInitiativeRoll().
const ICONOCLAST_ID = `${COBRA_CODEX}BPFc4FQgy9mFgPqG`;

// Silver Medal Syndrome Origin's Consistent benefit (Cobra Codex, p.46): "When you roll a
// Critical Success on a Skill Test with a benefit for Critical Successes, you can choose to treat
// it as a regular success and gain [shiftUp] 1 on your next Skill Test." Reversing an
// already-resolved Critical Success (undoing whatever bonus it triggered) isn't supported by this
// engine - only the consolation "gain shiftUp 1 on your next Skill Test" half is built, granted
// automatically whenever the actor's own roll crits (no interactive choice, since there's nothing
// to actually downgrade) - see its own check in the results.map() below.
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

// Cobra Battle School Graduate (Cobra Codex, General Perk, p.176): "You gain shiftUp 1 on
// Smarts-based Skill Tests in combat other than attacks." See its own check above.
const COBRA_BATTLE_SCHOOL_GRADUATE_ID = `${COBRA_CODEX}sjTaAtlasorkFzPU`;

// Sabotage (Cobra Codex, Commando Saboteur Focus, 1st level, p.83): "Your Technology Skill Tests
// to disable machines gain shiftUp equal to your Sneak Attack damage." "To disable machines"
// dropped, same narrow-qualifier idiom as Bits To Spare/Truthseeker above - unconditional shiftUp
// on the actor's own Technology rolls. See helpers/sneak-attack.mjs#getSneakAttackDamage.
const SABOTAGE_ID = `${COBRA_CODEX}35KMOMI1iPdBPhHl`;

// Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69): "On a success, you gain shiftUp 1
// on your attacks against that target this turn." See helpers/growl.mjs.
const GROWL_ID = `${COBRA_CODEX}OSVtPXBdRmZ2C4PD`;
const GROWL_SHIFT_UP_FLAG = 'pendingGrowlShiftUp';

// Fancy Flier (Cobra Codex, Technician Rocketeer Focus, 20th level, p.66): "you can score a
// critical success on a d2 for Acrobatics and Driving Skill Tests." Same canCritD2 grant shape
// Perimeter Defender's identical clause already uses.
const FANCY_FLIER_ID = `${COBRA_CODEX}xeEHwZBS3atzUCb4`;

// Get The Horns (Cobra Codex, Vanguard Warthog Focus, 10th level, p.69): "when you use Growl
// against a target, then hit that target with a melee weapon, you gain the benefits of Growl
// against that target for an extra turn." Growl's own banked shiftUp (GROWL_SHIFT_UP_FLAG) is
// already cleared the moment the qualifying roll is made (see wasGrowlApplied's own comment
// above) - Get The Horns re-banks the SAME bonus once a melee hit against that target is
// confirmed, so the actor's own next attack against them also benefits. See its own check in
// _rollSkillHelper's post-hit processing below.
const GET_THE_HORNS_ID = `${COBRA_CODEX}gi8vv2ujGBQNLjIq`;

// ID the Outdoors (Witch Influence, p.19): "You always gain Edge when you're identifying an
// animal or plant... In the wilderness, you also gain Edge on any Persuasion or Deception Skill
// Tests that relate to animals or plants." "Identifying" is approximated as Science (this
// system's closest "figure out what something is" skill); "in the wilderness" is dropped, the
// same narrow-qualifier idiom this project already accepts elsewhere - 3 skills unconditionally,
// same scale of approximation as Fear My Name's own 2-skill grant.
const ID_THE_OUTDOORS_ID = `${KNIGHTS_OF_CANTERLOT}O7JuVYJXdMX1V1LI`;

// Superb Soloist (Bard Influence, p.15): "Once per day, you can sing a song that grants your
// allies Edge on their next Skill Test in the current scene." A "Use" button (helpers/banked-
// buffs.mjs) broadcasting an unscoped Edge bank to every nearby ally - "once per day" approximated
// as "once per scene" via hasUsedThisEncounter, this project's usual daily-resource idiom. Not
// dispatched through team-buffs.mjs's own generic 'edge' effect - that one is hardcoded to the
// Morphed-only Power Ranger broadcast shape (SHINING_LEADER_EDGE_FLAG, filtered to
// system.isMorphed allies), which doesn't fit a non-Morphing MLP cast at all.

// Iron Hooves (General Perk, p.126, prereq Strength 3): "Your unarmed attacks deal +1 Damage."
// Unlike Iron Hands (PR CRB)/Phantom Ranger Prime's own unarmed clauses, this isn't scoped to any
// particular Skill or Morphed state - any unarmed attack qualifies. Same "no parent weapon" proxy.
const IRON_HOOVES_ID = `${MLP_CRB}weDVcCpSyZCH5V4M`;

// Puissance (Enigma of Combination, Pugilist Focus, Warrior, 1st level, p.38): "You inflict 1
// additional damage of the appropriate type for attacks that do not require any kind of hardpoint
// or weapon. This includes Unarmed strike, Claw, Bite, Bash, Ram, Fly-By, and any other attack the
// GM agrees should qualify." Every one of RAW's own named examples (natural Alt-Mode attacks
// included) has no backing weapon Item to wield, same as a plain Unarmed Strike - so the exact
// same "no parent weapon" proxy Iron Hooves/Phantom Ranger Prime already use covers all of them at
// once, with no need to enumerate each attack by name.
const PUISSANCE_ID = "Compendium.essence20.enigma_of_combination.Item.N8nkrj2hSrLv9NFP";

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

// Brutal Might (Enigma of Combination, Pugilist Focus, Warrior, 3rd level, p.38) - the skill-
// substitution half lives in documents/item.mjs (the earliest point a weaponEffect's own
// classification skill is read); see this Edge-half's own check in
// _getAutomaticCombatModifiers below.
const BRUTAL_MIGHT_ID = "Compendium.essence20.enigma_of_combination.Item.l0STCEYBuPMYfzSt";

// Bump & Run (Enigma of Combination, Pugilist Focus, Warrior, 6th level, p.38): "if you moved at
// least 15ft before making an Attack Skill Test, you gain an upshift; if that Attack is also a
// Critical Success, the target is also Stunned until the end of their next turn." "Moved 15ft
// first" has no hook to verify (same self-policed-checkbox reasoning as Charge's own identical
// "moved 10ft" drop, see CHARGE_TF_ID's own comment) - a Roll Options Dialog checkbox. The Stun
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

// Cutie Mark Perk (Earth Pony/Pegasus/Unicorn Origin Perk, p.35/37): "Pick a Skill, Specialization
// or abstract area you are especially talented with... You get a ↑1 shift on any action that area
// might apply to." Only the "pick a Skill" branch is built (choiceType:'skills' + a flat +1
// shiftUp, same shape as Awesome) - the Specialization/abstract-area branches are GM-adjudicated
// extensions with no fixed Skill to hook a check onto, left as a documented gap.
const CUTIE_MARK_PERK_ID = `${MLP_CRB}j4U7F2wEqNJzJnI7`;

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

// Ranger Prime capstones (20th level, PR CRB) - each color's own "+1 damage with [X] attacks"
// clause while Morphed, see PRIME_DAMAGE_BONUS_PERKS' own doc comment below. The +2-Defenses and
// Edge-on-an-Essence halves of every Prime are plain compendium Active Effects (system.defenses.
// <type>.morphed, system.essenceShifts.<essence>.edge) - nothing to do here for those. Blue
// Ranger Prime ("attacks from Powers") and Green Ranger Prime ("Unique Weapon attacks") are
// deliberately NOT in this table - the former depends on the not-yet-built Grid Powers subsystem
// (p.99) and the RAW wording doesn't clearly map onto a fixed mechanic; the latter's "Unique
// Weapon" is a randomly-rolled, per-character weapon (Table 4-4) with no fixed compendium item or
// trait to check against. White Ranger Prime's "Zord (non-Megaform) Attacks" clause is handled
// separately below (whiteRangerPrimeDamageBonus), not folded into this shared table, since its
// roller is the Zord itself (checked via its own pilot, not the roller's own items) rather than
// the Prime holder making their own attack.
const BLACK_RANGER_PRIME_ID = `${PR_CRB}nDJbufpNURXmVRJn`;
const PINK_RANGER_PRIME_ID = `${PR_CRB}DHYxJEp1X1BDlm6K`;
const RED_RANGER_PRIME_ID = `${PR_CRB}npFtRjCiJwrkmjyG`;
const WHITE_RANGER_PRIME_ID = `${PR_CRB}RDdg5LWyjHOyqsCp`;
const YELLOW_RANGER_PRIME_ID = `${PR_CRB}4M5y5ZcO5DNlnqwK`;

// Each entry checks the ATTACK's own weaponEffect classification - `skill` matches
// item.system.classification.skill directly (Warfighter's own established pattern above), `trait`
// matches the parent weapon's system.traits (Silent Weapon Expertise/Assault Precision's own
// pattern) - never both, since no Prime's wording needs to combine them.
const PRIME_DAMAGE_BONUS_PERKS = {
  [BLACK_RANGER_PRIME_ID]: { trait: 'martialArts' },
  [PINK_RANGER_PRIME_ID]: { skill: 'targeting' },
  [RED_RANGER_PRIME_ID]: { trait: 'powerWeapon' },
  [YELLOW_RANGER_PRIME_ID]: { skill: 'finesse' },
};

// General/Origin/Influence/Hang-Up Perk pass (2026-09-10) - a handful of "vehicle piloting"
// General Perks that turned out to be genuinely buildable once the pilot-lookup infra above
// (_getVehicleDriver, and its new reverse-direction sibling _getPilotedVehicle below) was
// confirmed already fully built - see White Ranger Prime's own doc comment above for the full
// discovery. Unlike Heavy Ordnance/White Ranger Prime (checked from the VEHICLE's own roll,
// resolving its driver), the Perks below are held by, and checked from, the PILOT's own roll -
// _getPilotedVehicle finds which vehicle (if any) they're currently seated in.
const DOGFIGHTER_ID = "Compendium.essence20.across_the_stars.Item.twl2N01FD8XKO0s1";

// Advanced Anti-Air Training (Quartermaster's Guide to Gear, General Perk, p.28): "You gain Edge
// when targeting air vehicles that are in motion... Additionally, you no longer suffer any
// penalties when using the Point-Defense Reflexes General Perk." "In motion" has no state this
// codebase tracks for any token - dropped as unenforceable, the same "keep the concrete mechanic,
// drop the unverifiable state qualifier" idiom used broadly elsewhere (a flying vehicle in a
// combat scene is rarely genuinely stationary anyway). The Point-Defense Reflexes half is blocked
// entirely - that base Perk isn't automated anywhere in this codebase yet, so there's no penalty
// to remove. Same target-is-an-aerial-vehicle check shape as Dogfighter just above.
const ADVANCED_ANTI_AIR_TRAINING_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.YDv7PPjj6qgqKI9e";
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
const MOTOR_LANCER_ID = "Compendium.essence20.intercontinental_adventures.Item.YaFY9NhcpZPXdvv0";
const SIDESWIPE_ID = "Compendium.essence20.intercontinental_adventures.Item.1THAJ83WAviS14f0";
// Demolition Driver (Factions in Action Vol. 2, General Perk, p.64): "When making a Ram attack,
// you can suffer downshift 1, 2, or 3 on the Skill Test to deal an equal amount of additional
// damage on a successful hit." Ram-only (unlike Sideswipe, which also covers Flyby) - see
// _isSideswipeAttack's own doc comment for why "Ram"/"Flyby" are matched by the item's own name.
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
// Giant-Killer's own PR CRB printing. Technorganic Secrets (p.46) reprints this Perk with
// byte-identical RAW text ("↑1 with attacks on targets at least two Size Classes larger... Edge
// on attacks on targets more than five Size Classes larger") - a distinct compendium item, so
// GIANT_KILLER_IDS below covers both rather than duplicating the check.
const GIANT_KILLER_IDS = [`${PR_CRB}ej3F6z4xU3qfzrKO`, "Compendium.essence20.technorganic_secrets.Item.6dgaHPsHzVhdZkZ9"];

// Spared No Expense (Ferocious Fighters, Dino-Hunters Faction Perk, p.73): "you are Trained with
// medium and heavy armor" (a plain compendium Active Effect, confirmed-real trained.armors schema
// field) - "Edge on attacks that target creatures larger than you" (see its own Size-ladder check
// below, right alongside Giant-Killer's identical mechanism) - "Choose one of Animal Handling,
// Infiltration, or Survival, ↑1 on that Skill's Tests" (a new, narrowly-scoped choiceType, see
// E20.sparedNoExpenseSkills' own doc comment - reusing the generic 'skills' choiceType would
// incorrectly offer every skill in the game, not just RAW's own 3). "Trained with the silent
// Battledress upgrade" and "Qualified with Large/Long-and-smaller Land vehicles" both stay Needs
// new infrastructure (the dead trained.upgrades field; no vehicle-qualification field at all).
const SPARED_NO_EXPENSE_ID = "Compendium.essence20.ferocious_fighters.Item.3ZrBd6FhV6Fep1zq";

// Community Helper (PR CRB, Influence Perk, p.68) - see E20.communityHelperSkills' own comment.
// "Any non-combat tasks related to your chosen service" is approximated as an unconditional Edge
// on whichever Skill the player chose (system.choice, keyed directly by Skill name), the same
// accepted "drop the unenforceable narrative qualifier" idiom Bits To Spare/Truthseeker already
// use - except for the Firefighter/Brawn option, where RAW's own "non-combat Brawn" is concrete
// enough to actually gate on (a Brawn-classified weaponEffect Attack, same isAttack check every
// other "non-combat" clause in this project already gates on). The National Guard/Initiative
// option is checked in prepareInitiativeRoll() instead, since Initiative never rolls through
// rollSkill() - see its own comment there.
const COMMUNITY_HELPER_ID = `${PR_CRB}6CnhyT0WBSFHwVGq`;
const IRON_HANDS_ID = `${PR_CRB}uKGtcgg5cgVibGQ7`;
const SHARPSHOOTERS_GRACE_ID = `${PR_CRB}wgkspIBc4HcOfKDu`;
const WRESTLER_ID = `${PR_CRB}7QMuaLPZJWNPJHTz`;
const CARETAKER_PR_ID = `${PR_CRB}4q2SPRzdbGosL62k`;
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
// Sharpshooter's Grace here is a DISTINCT compendium item from PR CRB's own printing of the exact
// same RAW text (see SHARPSHOOTERS_GRACE_ID above) - both need the identical checks, so this book's
// own id is added alongside that constant wherever it's checked, not a separate code path.
const SHARPSHOOTERS_GRACE_GIJ_ID = `${GI_JOE_CRB}3yBdQyZ0MulUqcsT`;
const KUNG_FU_GRIP_ID = `${GI_JOE_CRB}H23M2NZ4YNRS5xJR`;

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
const SEA_LEGS_GIJ_ID = `${GI_JOE_CRB}9Pp44hFLlC4EvMg8`;
const SPECIALIST_ID = `${GI_JOE_CRB}yOpGmmCvVaIYZf29`;

// Rocket Scientist (Quartermaster's Guide to Gear, Influence Perk, p.11): "Choose a Science or
// Technology Specialization related to building, launching, or piloting a rocket. Once per scene
// when using that Skill outside of combat, you gain Edge." Same choiceType:'skills' + system.choice
// shape as Specialist's own identical-structure Perk just above - "must already be Specialized"
// isn't enforced, and "once per scene... outside of combat" is dropped to "unconditional outside
// combat" the same way, for the same reason (hasUsedThisEncounter reads false with no active
// Combat, the opposite of what a Perk gated on being OUTSIDE combat needs).
const ROCKET_SCIENTIST_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.sxqOocGC7KwHc3kb";
// Rocket Scientist's own Hang-Up: "The first time each session you attempt a Science or
// Technology Skill Test during combat..., you roll with Snag." "Each session" is approximated as
// "each encounter," this project's usual session/day-scoped-resource idiom.
const ROCKET_SCIENTIST_HANGUP_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.ZDdczxlbVPY9leZz";
const ROCKET_SCIENTIST_HANGUP_ENCOUNTER_FLAG = 'rocketScientistHangUpUsedThisEncounter';

// Leadfoot's own Hang-Up (Quartermaster's Guide to Gear, p.10): "When not driving a vehicle, you
// suffer Snag on Alertness Skill Tests." The Perk's own Driving Edge is a plain compendium Active
// Effect; the Alertness untrained-Snag-suppression half lives in roll-dialog.mjs instead.
const LEADFOOT_HANGUP_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.gFYCwicMMwjKQ9fx";

// Technostalgic's own Hang-Up (Quartermaster's Guide to Gear, p.14): "You suffer 1 on all rolls
// involving Prototype or Theoretical gear." (The Perk's own Edge half is a disabled-toggle
// compendium Active Effect, same idiom as the GI Joe CRB Artisan/Athlete/etc. batch; its
// requisition-side clauses - auto-removing the Computerized trait, ignoring upgrade requirements -
// are a GM-adjudicated gear-acquisition process this codebase doesn't model at all, left
// unautomated.) A flat -1 modifier (RAW's own literal "suffer 1," not a Snag), scoped to the
// concretely-checkable case below.
const TECHNOSTALGIC_HANGUP_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Gin9Zn2ASQXSO62K";

// Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76) - see helpers/perfect-disguise.mjs's
// own doc comment for the toggle itself. "All social interactions" is read as the same 4 Social
// Essence skills this book's own Presence Perk already enumerates.
const PERFECT_DISGUISE_ID = `${GI_JOE_CRB}ELktMVNYsiBPTX2c`;
const PERFECT_DISGUISE_SKILLS = ['deception', 'persuasion', 'intimidation', 'streetwise'];

// Coin Toss (GI Joe CRB, Blitzer Focus, 6th level, p.98): "when attacking with a Might weapon, you
// can critically hit on a d2." Same canCritD2 shape as Assault Precision above, gated on the
// attack's own classification.skill being 'might' (the same "Might-classified weaponEffect" check
// Charge/Sneak Attack's own weapon-skill gate already establishes) rather than a weapon trait.
const COIN_TOSS_ID = `${GI_JOE_CRB}NQULhy8KargPMUTX`;

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

// Augment (Skill) (Across the Stars, General Perk, p.68) - see its own check near
// updatedShiftDataset.shiftUp below. Same choiceType:'skills' + flat shiftUp shape as Awesome/
// Cutie Mark Perk/Noble Heritage.
const AUGMENT_SKILL_ID = `${ACROSS_THE_STARS}nVFdInysWe2qMqye`;

// Astro-Sense (Across the Stars, Grid Power, p.72) - see its own check below.
const ASTRO_SENSE_ID = `${ACROSS_THE_STARS}XfWmXOtcIM5snRKL`;

// Rescue Response (Across the Stars, Grid Power, p.73): "While Morphed, you may attempt a Science
// or Technology Skill Test to help, repair, or heal another as a Free action once per turn with a
// upshift 1 bonus." The "Free action once per turn" clause is about the ACTION economy this
// system doesn't track, not a gate on the shift itself - effectively an unconditional upshift 1 on
// either skill while Morphed.
const RESCUE_RESPONSE_ID = `${ACROSS_THE_STARS}ItgDxIGNlVYzjiEe`;
const GOLD_RANGER_PRIME_ID = `${ACROSS_THE_STARS}jVRapLGSt8yVHL9n`;
const SILVER_RANGER_PRIME_ID = `${ACROSS_THE_STARS}Bl9G8fgtd30wENkX`;
const PHANTOM_RANGER_PRIME_ID = `${ACROSS_THE_STARS}PHgWjT0syOOBOOK5`;

// Splinter Defense (Gold Ranger, 18th level, p.53) - see helpers/splinter-defense.mjs's own doc
// comment for the Hardened Armor bonus lookup and the once-per-attacker-per-combat gate; the
// actual post-hit application lives in _rollSkillHelper's own per-target processing below.
const SPLINTER_DEFENSE_ID = `${ACROSS_THE_STARS}YGY0lYvqbsiQcpHs`;
// Revengeful - see its own comment near the post-hit banking in _rollSkillHelper below, and its
// consumption in _getAutomaticCombatModifiers.
const REVENGEFUL_ID = "Compendium.essence20.decepticon_directive.Item.n1CZfponNlZ9I8uN";

// Power Boost (Silver Ranger, 3rd/10th/17th level, p.57) - see helpers/power-boost.mjs's own doc
// comment for the toggle itself; the damage-bonus half (folded into damageBonusValue below) lives
// here, same shape as Red Ranger Prime's identical powerWeapon-trait check.
const POWER_BOOST_ID = `${ACROSS_THE_STARS}m3Kh8PqGf3O1oMmc`;

// Beneath the Helmet Role Perks automated below - the "buildable now" slice of that book's own
// categorization pass (see project plan's own writeup).
const BENEATH_THE_HELMET = "Compendium.essence20.beneath_the_helmet.Item.";

// Terror (Dark Ranger, 1st level, p.39) - see helpers/terror.mjs's own doc comment for the
// accrual/spend logic itself; this constant is only needed here for the damage bonus's own
// source label (damageBonusSources below).
const TERROR_ID = `${BENEATH_THE_HELMET}yBBB0Mi6fr84YcSd`;

// Menacing Glare (Dark Ranger, 2nd level, p.39) - see helpers/menacing-glare.mjs's own doc
// comment.
const MENACING_GLARE_ID = `${BENEATH_THE_HELMET}eWlflRHYAVB9p5Z0`;

// Unlucky (For You) (Dark Ranger, 13th level, p.40) - see helpers/unlucky-for-you.mjs's own doc
// comment.
const UNLUCKY_FOR_YOU_ID = `${BENEATH_THE_HELMET}hSzY2uhu3L9nGP6o`;

// Brute Force (Graphite Ranger, 3rd/10th/17th level, p.47) - see helpers/banked-buffs.mjs's own
// BRUTE_FORCE_ID comment for why this shares Power Boost's exact toggle.
const BRUTE_FORCE_ID = `${BENEATH_THE_HELMET}3XP5RgmeyQwE5HH9`;

// Calm Beast (Aqua Ranger, Grid Science I choice, p.41) - see its own check in rollSkill() above.
const CALM_BEAST_ID = `${BENEATH_THE_HELMET}Ib4BIJKAmuMoWKJP`;

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

// Precision Aim (Pink Ranger, 9th/18th level, p.49): "If you do not move on your turn, your
// ranged combat attacks now inflict an additional point of damage if they hit. At 18th level, the
// bonus is increased to 2 damage." "Haven't moved" has no hook to verify (same "the player
// self-polices" reasoning as Aiming/Empty the Mag's own doc comments above), so this is a Roll
// Options Dialog checkbox rather than an unconditional bonus like Warfighter's - the amount comes
// from the Perk's own advances.currentValue (1 after the first pick, 2 after the second - the
// default baseValue/increaseValue of 1 each, unset in the compendium item, already produce
// exactly this progression).
const PRECISION_AIM_ID = `${PR_CRB}tljdouRqNGgQQDz6`;
const PENETRATING_SHOT_ID = `${PR_CRB}6ay8OIRRwZTnQUV8`;
const FEARSOME_REPUTATION_ID = `${PR_CRB}ofiEt8uFPgovBvLQ`;
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

    // Prepare for War (Field Commander, 1st level, p.65): "When you roll for Initiative and you
    // are not Surprised, you gain an Edge on your Initiative Skill Test." Sirens Blaring (Medical
    // Officer Focus, 3rd level, p.81): "when Resetting Your Initiative, you gain an Edge and +1
    // on your Initiative Skill Test" - this codebase has no distinct "Surprised" status and no
    // separate "reset Initiative" flow (Combat#rollInitiative, above this method's own call site,
    // is the one path for both an initial roll and a manual re-roll), so both Perks are granted
    // unconditionally whenever Initiative is (re-)rolled - the same "narrative trigger, no hook to
    // gate on" simplification every other un-enforceable condition in this codebase already
    // accepts.
    const sirensBlaringShiftUp = actorHasPerk(actor, SIRENS_BLARING_ID) ? 1 : 0;
    // Wisdom of the Elders - Enhanced Reflexes (Through the Shattered Grid, Guardian of Eltar,
    // 9th/18th level, p.72): "↑2 to all Acrobatics and Initiative Skill Tests" while active - the
    // Initiative half has to be added here rather than in rollSkill()'s own rolledSkill=='initiative'
    // check (dead code for the real path - Initiative is always rolled through this dedicated
    // method, never through rollSkill()); the Acrobatics half lives in rollSkill() instead.
    const enhancedReflexesShiftUp = isWisdomOfTheEldersActive(actor, 'enhancedReflexes') ? 2 : 0;
    // Tactical Meditation - see hasNearbyTacticalMeditation's own doc comment. The Initiative half
    // of its aura (Alertness lives in rollSkill() instead, since Initiative never rolls through
    // that path in practice).
    const tacticalMeditationShiftUp = hasNearbyTacticalMeditation(actor) ? 2 : 0;
    // Peerless Pilot (GI Joe CRB, General Perk, p.132): "Edge on Initiative rolls while piloting
    // a vehicle you are Specialized in." Checked via _getPilotedVehicle's own reverse crew-lookup
    // (see its doc comment) - "Specialized in" is approximated as "has taken at least one Driving
    // Specialization at all" (system.skills.driving.specializations, a per-actor keyed object
    // with no stable id a Perk could target a SPECIFIC vehicle's own type with - the same
    // simplification this project's specialization-redesign already accepts elsewhere), not tied
    // to which particular vehicle they're currently in. The Driving Skill Test +2 and
    // auto-succeed-emergency-disembark halves of this Perk live elsewhere/aren't built - see
    // rollSkill()'s own comment for the Driving half; there's no emergency-disembark Skill Test
    // anywhere in this codebase to auto-pass.
    const isPeerlessPilotDriving = actorHasPerk(actor, PEERLESS_PILOT_GIJ_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && Object.keys(actor.system.skills.driving?.specializations ?? {}).length > 0;
    // Peerless Pilot (PR CRB) - Initiative-Edge half; see PEERLESS_PILOT_PR_ID's own comment above
    // for the RAW text and the Driving-specialization-shift check.
    const isPeerlessPilotPrDriving = actorHasPerk(actor, PEERLESS_PILOT_PR_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && this._hasDrivingSpecializationAtOrAboveD6(actor);
    // Springy (MLP Spring into Action Influence, p.61) - see SPRINGY_ID's own comment above.
    const isSpringy = actorHasPerk(actor, SPRINGY_ID);
    // Ready For Anything - see READY_FOR_ANYTHING_ID's own comment above for the Edge grant
    // applied below. The other two clauses aren't built: "may roll Brawn or Might instead of
    // Initiative" would need a genuinely new "pick one of two alternate skills, then recompute
    // this whole dataset against it" shape (unlike Cunning Plan/Wire Work's own single-skill
    // shift-delta substitution, decided AFTER the Roll Options Dialog already resolved); "you may
    // begin to act with Reckless Abandon when you roll Initiative" is deliberately NOT
    // auto-toggled here - Reckless Abandon spends a limited per-day "Uses" resource, and silently
    // activating it on every Initiative roll would spend that resource without the player's own
    // consent, unlike every other unenforced narrative-precondition grant in this codebase (none
    // of which spend a limited resource on the player's behalf) - left as a manual toggle via the
    // existing sheet control, same as normal.
    const dataset = {
      shift: actor.system.skills[initSkill].shift,
      shiftUp: actor.system.skills[initSkill].shiftUp + actor.system.essenceShifts.speed.shiftUp
        + sirensBlaringShiftUp + enhancedReflexesShiftUp + tacticalMeditationShiftUp,
      shiftDown: actor.system.skills[initSkill].shiftDown + actor.system.essenceShifts.speed.shiftDown,
      skill: initSkill,
      isSpecialized: isSpringy || actor.system.skills[initSkill].isSpecialized,
    };
    // We Improvise - see WE_IMPROVISE_ID's own comment above.
    if (game.combat && actorHasPerk(actor, WE_IMPROVISE_ID) && !hasUsedThisEncounter(actor, WE_IMPROVISE_ENCOUNTER_FLAG)
      && isGmConnected()) {
      requestStoryPointGrant(actor);
      await markUsedThisEncounter(actor, WE_IMPROVISE_ENCOUNTER_FLAG);
    }

    // Recon (Focus: Scout, base grant, p.94) - Initiative half; see RECON_ID's own comment in
    // rollSkill()'s self-status section for the Alertness/Survival half and the RAW text.
    const hasReconEdge = actorHasPerk(actor, RECON_ID) && hasActiveEnvironmentalExpertise(actor);
    // Ever Vigilant - see EVER_VIGILANT_ID's own comment above.
    dataset.everVigilantAvailable = actorHasPerk(actor, EVER_VIGILANT_ID) && !!actor.system.skills.alertness;
    // Danger Sense - see DANGER_SENSE_ID's own comment above.
    dataset.dangerSenseAvailable = actorHasPerk(actor, DANGER_SENSE_ID) && !!actor.system.skills.alertness;
    // Needle Drop - see NEEDLE_DROP_ID's own comment above.
    dataset.needleDropAvailable = actorHasPerk(actor, NEEDLE_DROP_ID) && !!actor.system.skills.performance;
    // Rapid Deployment Drills - see RAPID_DEPLOYMENT_DRILLS_ID's own comment above.
    dataset.rapidDeploymentDrillsAlertnessAvailable = actorHasPerk(actor, RAPID_DEPLOYMENT_DRILLS_ID)
      && !!actor.system.skills.alertness;
    dataset.rapidDeploymentDrillsInfiltrationAvailable = actorHasPerk(actor, RAPID_DEPLOYMENT_DRILLS_ID)
      && !!actor.system.skills.infiltration;
    // Your Reputation Precedes You - see YOUR_REPUTATION_PRECEDES_YOU_ID's own comment above.
    dataset.yourReputationPrecedesYouAvailable = actorHasPerk(actor, YOUR_REPUTATION_PRECEDES_YOU_ID)
      && !!actor.system.skills.intimidation;
    // Cobra Battle Cry - see COBRA_BATTLE_CRY_ID's own comment above.
    dataset.cobraBattleCryDeceptionAvailable = actorHasPerk(actor, COBRA_BATTLE_CRY_ID) && !!actor.system.skills.deception;
    dataset.cobraBattleCryIntimidationAvailable = actorHasPerk(actor, COBRA_BATTLE_CRY_ID) && !!actor.system.skills.intimidation;
    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above.
    dataset.tf1sDeceptiveWarfareAvailable = actorHasPerk(actor, TF1S_DECEPTIVE_WARFARE_ID)
      && !!actor.system.skills.deception && !!actor.system.skills.infiltration;
    // Daredevil (Transformers CRB, General Perk, p.108) - Initiative-Edge half; see its own
    // ↑2-Driving half in rollSkill()'s self-status section for the RAW text and why this needed
    // re-verifying a claimed "no Bot-Mode/Alt-Mode current-state tracking" gap first - CORRECTED
    // 2026-09-11, system.isTransformed (character.mjs, live-toggled by transformer-handler.mjs's
    // own onTransform) is exactly that tracking, an earlier categorization pass simply grepped for
    // the wrong field names (isAltMode/currentMode/isBotMode/convertedForm) and never found it.
    const isDaredevilTransformed = actorHasPerk(actor, DAREDEVIL_ID) && actor.system.isTransformed;
    // Iconoclast Origin's Disrupter benefit - see ICONOCLAST_ID's own comment above. A
    // whole-combat scan (every combatant, not a nearby-radius one) - true as soon as any hostile
    // combatant's own Threat Level exceeds the actor's own character level.
    const actorTokenForIconoclast = actor.getActiveTokens?.()?.[0];
    const hasIconoclastEdge = actorHasPerk(actor, ICONOCLAST_ID) && game.combat
      && game.combat.combatants.some(c => c.actor && c.actor.id != actor.id
        && c.token?.disposition !== undefined && c.token.disposition !== actorTokenForIconoclast?.document?.disposition
        && getEffectiveLevel(c.actor) > getEffectiveLevel(actor));
    // On Your Feet - see ON_YOUR_FEET_ID's own comment above. No RAW-stated range - checked
    // against the whole party (self or any nearby ally holding it), same "unscoped when RAW
    // doesn't name a distance" idiom as most of this project's other party-wide grants.
    const hasOnYourFeetEdge = actorHasPerk(actor, ON_YOUR_FEET_ID)
      || getNearbyAllyTokens(actor, Infinity).some(token => actorHasPerk(token.actor, ON_YOUR_FEET_ID));
    // Community Helper (National Guard option) - see COMMUNITY_HELPER_ID's own comment above.
    const hasCommunityHelperInitiativeEdge = findPerk(actor, COMMUNITY_HELPER_ID)?.system.choice == 'initiative';
    const skillDataset = {
      edge: actor.system.skills[initSkill].edge
        || actorHasPerk(actor, PREPARE_FOR_WAR_ID) || actorHasPerk(actor, SIRENS_BLARING_ID)
        || isPeerlessPilotDriving || isPeerlessPilotPrDriving || actorHasPerk(actor, READY_FOR_ANYTHING_ID)
        || hasReconEdge || isDaredevilTransformed || hasIconoclastEdge || hasOnYourFeetEdge
        || hasCommunityHelperInitiativeEdge,
      shift: actor.system.skills[initSkill].shift,
      snag: actor.system.skills[initSkill].snag,
    };
    const skillRollOptions = await this._rollDialog.getSkillRollOptions(dataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return false;
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

    // Ever Vigilant - see EVER_VIGILANT_ID's own comment above. Same shift-position-delta
    // substitution mechanism as Cunning Plan/Wire Work, computed via E20.skillShiftList (both
    // dice appear in the same relative order there as in E20.initiativeShiftList - the extra
    // criticalSuccess/autoSuccess header entries offset both indices equally, so the delta between
    // them comes out the same regardless of which list is used).
    if (skillRollOptions.applyEverVigilant) {
      const alertnessShift = actor.system.skills.alertness.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const alertnessIndex = E20.skillShiftList.indexOf(alertnessShift);
      if (currentIndex >= 0 && alertnessIndex >= 0) {
        const delta = currentIndex - alertnessIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Danger Sense - see DANGER_SENSE_ID's own comment above. Same shift-position-delta mechanism
    // as Ever Vigilant just above, plus a flat +2 RAW grants on top.
    if (skillRollOptions.applyDangerSense) {
      const alertnessShift = actor.system.skills.alertness.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const alertnessIndex = E20.skillShiftList.indexOf(alertnessShift);
      if (currentIndex >= 0 && alertnessIndex >= 0) {
        const delta = currentIndex - alertnessIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      skillRollOptions.shiftUp += 2;
    }

    // Needle Drop - see NEEDLE_DROP_ID's own comment above. Same shift-position-delta mechanism as
    // Ever Vigilant just above, substituting Performance instead of Alertness.
    if (skillRollOptions.applyNeedleDrop) {
      const performanceShift = actor.system.skills.performance.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const performanceIndex = E20.skillShiftList.indexOf(performanceShift);
      if (currentIndex >= 0 && performanceIndex >= 0) {
        const delta = currentIndex - performanceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Rapid Deployment Drills - see RAPID_DEPLOYMENT_DRILLS_ID's own comment above. Same
    // shift-position-delta mechanism as Ever Vigilant/Needle Drop, substituting Alertness or
    // Infiltration - offered as two independent checkboxes since RAW lets the player pick either.
    if (skillRollOptions.applyRapidDeploymentDrillsAlertness) {
      const alertnessShift = actor.system.skills.alertness.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const alertnessIndex = E20.skillShiftList.indexOf(alertnessShift);
      if (currentIndex >= 0 && alertnessIndex >= 0) {
        const delta = currentIndex - alertnessIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    if (skillRollOptions.applyRapidDeploymentDrillsInfiltration) {
      const infiltrationShift = actor.system.skills.infiltration.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const infiltrationIndex = E20.skillShiftList.indexOf(infiltrationShift);
      if (currentIndex >= 0 && infiltrationIndex >= 0) {
        const delta = currentIndex - infiltrationIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Your Reputation Precedes You - see YOUR_REPUTATION_PRECEDES_YOU_ID's own comment above. Same
    // shift-position-delta mechanism as Ever Vigilant/Needle Drop above, substituting Intimidation.
    if (skillRollOptions.applyYourReputationPrecedesYou) {
      const intimidationShift = actor.system.skills.intimidation.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const intimidationIndex = E20.skillShiftList.indexOf(intimidationShift);
      if (currentIndex >= 0 && intimidationIndex >= 0) {
        const delta = currentIndex - intimidationIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Cobra Battle Cry - see COBRA_BATTLE_CRY_ID's own comment above. Same mechanism, substituting
    // Deception or Intimidation - checking both nets whichever delta a player's second checkbox
    // click adds too, the same "checking both nets both benefits" idiom Penetrating Aim's own doc
    // comment already accepts, rather than new UI to enforce picking only one.
    if (skillRollOptions.applyCobraBattleCryDeception) {
      const deceptionShift = actor.system.skills.deception.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const deceptionIndex = E20.skillShiftList.indexOf(deceptionShift);
      if (currentIndex >= 0 && deceptionIndex >= 0) {
        const delta = currentIndex - deceptionIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    if (skillRollOptions.applyCobraBattleCryIntimidation) {
      const intimidationShift = actor.system.skills.intimidation.shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
      const intimidationIndex = E20.skillShiftList.indexOf(intimidationShift);
      if (currentIndex >= 0 && intimidationIndex >= 0) {
        const delta = currentIndex - intimidationIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above. Same shift-position-delta
    // mechanism as Ever Vigilant/Needle Drop/Your Reputation Precedes You above, substituting
    // whichever of Deception/Infiltration the player checked (mutually exclusive in practice).
    const tf1sDeceptiveWarfareSkill = skillRollOptions.applyTf1sDeceptiveWarfareDeception ? 'deception'
      : skillRollOptions.applyTf1sDeceptiveWarfareInfiltration ? 'infiltration' : null;
    if (tf1sDeceptiveWarfareSkill) {
      const substituteShift = actor.system.skills[tf1sDeceptiveWarfareSkill].shift;
      const currentIndex = E20.skillShiftList.indexOf(actor.system.skills[initSkill].shift);
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
    const rolledSkill = dataset.skill;
    let rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];

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
    const combatModifiers = this._getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill);
    if (combatModifiers.debilitatedConsumed) {
      await actor.unsetFlag('essence20', 'debilitated');
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

    // Projectile Dancer - see PROJECTILE_DANCER_ID's own comment above. Marks the TARGET's own
    // once-per-scene flag, the same "reported, not written, by the synchronous function above"
    // shape as spottedTarget just above.
    if (combatModifiers.projectileDancerTargetToMark) {
      await markUsedThisEncounter(combatModifiers.projectileDancerTargetToMark, 'projectileDancerUsedThisEncounter');
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

    // Cobra Battle School Graduate (Cobra Codex, General Perk, p.176): "You gain shiftUp 1 on
    // Smarts-based Skill Tests in combat other than attacks." "Attacks" is read as a weaponEffect
    // roll (this system's own attack-vs-plain-Skill-Test distinction), the same proxy Spot/Ageless
    // Knowledge/etc. already use elsewhere.
    if (game.combat && rolledEssence == 'smarts' && item?.type != 'weaponEffect'
      && actorHasPerk(actor, COBRA_BATTLE_SCHOOL_GRADUATE_ID)) {
      calculatedShiftUp += 1;
    }

    // Sabotage - see SABOTAGE_ID's own comment above.
    if (rolledSkill == 'technology' && actorHasPerk(actor, SABOTAGE_ID)) {
      calculatedShiftUp += getSneakAttackDamage(actor);
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

    // Rescue Response - see RESCUE_RESPONSE_ID's own comment above.
    if ((rolledSkill == 'science' || rolledSkill == 'technology') && actor.system.isMorphed
      && actorHasPower(actor, RESCUE_RESPONSE_ID)) {
      calculatedShiftUp += 1;
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

    // Keen Eye (WTNV Citizen's Guide, Curious Influence, p.27): "When trying to solve a puzzle,
    // you gain ↑1 on Smarts and Social Skill Tests." "When trying to solve a puzzle" is dropped
    // (unenforceable narrative qualifier) - same unconditional idiom Bits To Spare/Truthseeker
    // already use, just across two whole Essences instead of one Skill.
    if ((rolledEssence == 'smarts' || rolledEssence == 'social') && actorHasPerk(actor, KEEN_EYE_ID)) {
      calculatedShiftUp += 1;
    }

    // Barista Experience (WTNV Citizen's Guide, General Perk, p.47) - see its own comment above.
    if ((rolledEssence == 'smarts' || rolledEssence == 'social') && actorHasPerk(actor, BARISTA_EXPERIENCE_ID)) {
      calculatedShiftUp += 2;
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
        && (actorItem.flags.core?.sourceId ?? actorItem._stats?.compendiumSource) == LOW_TECH_PRIORITIES_ID
        && actorItem.system.choice == rolledSkill)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
      await markUsedThisTurn(actor, LOW_TECH_PRIORITIES_FLAG);
    }

    // Cat Training (WTNV Citizen's Guide, General Perk, p.47) - see its own comment above.
    if (rolledEssence == 'speed' && actorHasPerk(actor, CAT_TRAINING_ID)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
    }

    // Mercantile Store (WTNV Citizen's Guide, Farmer Role, p.37): "Ignore the first ↓1 on all
    // Wealth Skill Tests that involve shopping within Night Vale." Narrative qualifier dropped
    // (unenforceable) - same "cancel one point" shape as Expertise/Eltarian Training/Cat Training.
    // Its own "Edge on purchasing food/animal goods" half is a plain compendium Active Effect.
    if (rolledSkill == 'wealth' && actorHasPerk(actor, MERCANTILE_STORE_ID)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
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

    const skillDataset = {
      shift: initialShift,
      edge: actorSkillData.edge || !!essenceShifts[rolledEssence]?.edge || combatModifiers.edge
        || !!specialization?.edge || hasExtraRoughTrainingEdge,
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

    // Pre-select the Roll Options Dialog's Defense dropdown from the weaponEffect's configured
    // Defense (p.168-169). A plain skill roll defaults to 'none' unless the caller already set
    // dataset.defenseType (e.g. a @Check[defense=...] enricher link, see helpers/enrichers.mjs),
    // and the player can always still choose a Defense manually to roll a Skill Test against a
    // targeted actor.
    updatedShiftDataset.defenseType = item?.type == 'weaponEffect'
      ? item.system.defenseType
      : (dataset.defenseType || 'none');

    // Silent Weapon Expertise (Ranger's Environmental Exposure choice, p.91): "you get [1
    // upshift] on attacks with weapons with the Silent trait." (The "trained in Silent weapons"
    // half is a plain system.trained.weapons.silent grant, handled entirely by the Perk's own
    // compendium Active Effect - nothing to do here.) Pre-fills the same shiftUp the dialog's own
    // field already exposes, same "auto-detect, player can still override" shape as every other
    // bonus in this file.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, SILENT_WEAPON_EXPERTISE_ID)) {
      const weapon = this._getParentWeapon(actor, item);
      if (weapon?.system.traits.includes('silent')) {
        updatedShiftDataset.shiftUp += 1;
      }
    }

    // Reckless Abandon (Renegade base, p.94): "Upshift 2 on all Strength Skill Tests" while
    // active and wearing light armor or no armor (Hardened extends this to Medium armor too) -
    // see helpers/reckless-abandon.mjs for why only this half of the Perk needed new code.
    // Unlike Silent Weapon Expertise above, this isn't gated on item?.type - it's any Strength
    // Skill Test, not just weapon attacks.
    if (rolledEssence == 'strength') {
      updatedShiftDataset.shiftUp += getRecklessAbandonStrengthShiftUp(actor);
    }

    // Piercing Shot (Sniper Focus, 6th level): "when making a ranged attack with a weapon with
    // the sniper quality and you have an Edge, you critically hit on the d2." Checked here (using
    // the fully-resolved skillDataset.edge, not just the automatic combatModifiers.edge) so it
    // also picks up Edge from the roller's own skill training or an Essence shift, not just
    // target-status-driven Edge. Feeds into the same canCritD2 field the Roll Options Dialog's own
    // manual checkbox uses, pre-checking it rather than replacing it.
    if (item?.type == 'weaponEffect' && skillDataset.edge && actorHasPerk(actor, PIERCING_SHOT_ID)) {
      const weapon = this._getParentWeapon(actor, item);
      if (weapon?.system.traits.includes('sniper')) {
        updatedShiftDataset.canCritD2 = true;
      }
    }

    // Assault Precision (Door-Kicker Focus, 17th level): "When using a shotgun or submachine gun
    // weapon, you critically hit on a d2." No Edge requirement, unlike Piercing Shot above.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, ASSAULT_PRECISION_ID)) {
      const weapon = this._getParentWeapon(actor, item);
      const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource;
      if (weaponSourceId == SHOTGUN_ID || weaponSourceId == SUBMACHINE_GUN_ID) {
        updatedShiftDataset.canCritD2 = true;
      }
    }

    // Coin Toss - see COIN_TOSS_ID's own comment above.
    if (item?.type == 'weaponEffect' && item.system.classification.skill == 'might'
      && actorHasPerk(actor, COIN_TOSS_ID)) {
      updatedShiftDataset.canCritD2 = true;
    }

    // Ripple Effect (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 6th level, p.24):
    // "when attacking a piece of equipment with a blade or bludgeon, you can score a Critical
    // Success on the d2." "A piece of equipment" is the same `targetActor.type == 'vehicle'`
    // proxy Breaking Point/Raze and Ruin/Plate Piercing already establish; "blade or bludgeon" is
    // this system's own `sharp`/`blunt` damageType keys.
    if (item?.type == 'weaponEffect' && ['blunt', 'sharp'].includes(item.system.damageType)
      && actorHasPerk(actor, RIPPLE_EFFECT_ID) && game.user.targets.first()?.actor?.type == 'vehicle') {
      updatedShiftDataset.canCritD2 = true;
    }

    // Piercing Shot (Transformers CRB, Sharpshooter Focus, 6th level, p.70): "when making a
    // ranged attack with your Long Range Rifle, and you have an Edge, you can critically hit with
    // the d2. You must be Specialized in the Long Range Rifle to gain this benefit." Distinct
    // compendium Item from GI Joe's own identically-named PIERCING_SHOT_ID above - checks the
    // specific named weapon (like Assault Precision's shotgun/submachine gun check) rather than a
    // trait, plus a Specialized requirement neither GI Joe grant above needs. dataset.isSpecialized
    // (not the later-merged isSpecialized const) since this runs before the dialog even opens,
    // same "pre-dialog, auto-detected value" shape as skillDataset.edge just above.
    if (item?.type == 'weaponEffect' && skillDataset.edge && dataset.isSpecialized
      && actorHasPerk(actor, PIERCING_SHOT_TF_ID)) {
      const weapon = this._getParentWeapon(actor, item);
      const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource;
      if (weaponSourceId == LONG_RANGE_RIFLE_ID) {
        updatedShiftDataset.canCritD2 = true;
      }
    }

    // Eureka (Technician/Expert Focus, 17th level, p.104): "you can score a critical success on a
    // d2 for Field Skill Tests." Self-only and skill-only, unlike every canCritD2 grant above -
    // it applies to any Skill Test using whichever skill was chosen as the actor's Field (the
    // Field Perk's own system.choice, same shape Fighting Style already uses), not just
    // weaponEffect attacks, so it's checked here by rolledSkill rather than gated on item?.type.
    const fieldPerk = findPerk(actor, FIELD_ID);
    const isFieldSkillTest = !!fieldPerk?.system.choice && rolledSkill == fieldPerk.system.choice;
    if (isFieldSkillTest && actorHasPerk(actor, EUREKA_ID)) {
      updatedShiftDataset.canCritD2 = true;
    }

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

    // Bits To Spare / Truthseeker / Profiteer - see BITS_TO_SPARE_ID's own comment above.
    if (rolledSkill == 'wealth' && (actorHasPerk(actor, BITS_TO_SPARE_ID) || actorHasPerk(actor, PROFITEER_JTT_ID))) {
      skillDataset.edge = true;
    }

    // Oorah! - see OORAH_ID's own comment above. Edge half only - the +1 damage vs. a Surprised
    // target lives in _getAutomaticCombatModifiers/rollSkill's own damage-bonus computation.
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, OORAH_ID)) {
      skillDataset.edge = true;
    }

    // Community Helper - see COMMUNITY_HELPER_ID's own comment above. Initiative (National Guard)
    // is checked in prepareInitiativeRoll() instead, not here.
    const communityHelperChoice = findPerk(actor, COMMUNITY_HELPER_ID)?.system.choice;
    if (communityHelperChoice && communityHelperChoice == rolledSkill
      && (rolledSkill != 'brawn' || item?.type != 'weaponEffect')) {
      skillDataset.edge = true;
    }

    // Indoctrinated - see INDOCTRINATED_ID's own comment above.
    if ((rolledSkill == 'intimidation' || rolledSkill == 'persuasion') && actorHasPerk(actor, INDOCTRINATED_ID)) {
      skillDataset.snag = true;
    }

    // Unscrupulous - see UNSCRUPULOUS_ID's own comment above.
    if ((rolledSkill == 'deception' || rolledSkill == 'intimidation' || rolledSkill == 'persuasion')
      && actorHasPerk(actor, UNSCRUPULOUS_ID)) {
      skillDataset.snag = true;
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

    // Merit Badges (WTNV Citizen's Guide, Scout Origin, p.33): "Choose one Smarts Skill. You
    // never suffer a Snag on this Skill." Unlike Presence/I'll Make It Work's own actor-wide
    // untrained-Snag-immunity, this is scoped to one specific chosen skill (system.choice, same
    // choiceType:'skills' mechanism as Awesome/Cutie Mark Perk) and cancels Snag from ANY source
    // (not just the untrained-shift base rule) - overriding skillDataset.snag directly here, the
    // last write before the Roll Options Dialog opens, is the only point that sees every prior
    // Snag source (base skill.snag, automatic combat modifiers) already folded together.
    if (findPerk(actor, MERIT_BADGES_ID)?.system.choice == rolledSkill) {
      skillDataset.snag = false;
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

    if (rolledSkill == 'alertness' && actorHasPerk(actor, TRUTHSEEKER_ID)) {
      skillDataset.edge = true;
    }

    // Search and Seizure - see SEARCH_AND_SEIZURE_ID's own comment above.
    if (!game.combat && ['alertness', 'infiltration'].includes(rolledSkill)
      && actorHasPerk(actor, SEARCH_AND_SEIZURE_ID)) {
      skillDataset.edge = true;
    }

    // Surgical Operators - see SURGICAL_OPERATORS_ID's own comment above.
    if (rolledSkill == 'science' && actorHasPerk(actor, SURGICAL_OPERATORS_ID)) {
      skillDataset.edge = true;
    }

    // Seafarer's Driving(Sea) half - see SEAFARER_ID's own comment above.
    if (rolledSkill == 'driving' && actorHasPerk(actor, SEAFARER_ID)
      && this._getPilotedVehicle(actor, 'driver')?.system.movement.swim.base > 0) {
      skillDataset.edge = true;
    }

    // Broadcaster's Technology(Communications) half - see BROADCASTER_ID's own comment above.
    if (rolledSkill == 'technology' && specialization?.name?.toLowerCase() == 'communications'
      && !game.combat && actorHasPerk(actor, BROADCASTER_ID)) {
      skillDataset.edge = true;
    }

    // Acute Sense (Transformers CRB, General Perk, p.107): "Choose 1 of 5 senses. Edge on
    // Alertness Tests when that sense applies; ↑1 on non-Alertness Tests where it applies.
    // Repeatable, once per sense." Only the Alertness-Edge half is built - "when that sense
    // applies" is nearly always true for an Alertness Test specifically (Alertness fundamentally
    // IS your senses), so it's granted unconditionally the same idiom Truthseeker's own narrower
    // qualifier just above already uses, gated only on holding at least one instance (Edge doesn't
    // stack, so which specific sense(s) were chosen doesn't matter for this half). The "↑1 on
    // non-Alertness Tests where it applies" half is deliberately NOT built - unlike a narrow
    // qualifier on ONE named skill (Truthseeker/Sea Legs), "where a sense applies" could touch
    // nearly any skill depending on which sense and which fictional situation, and flattening it
    // to an unconditional grant would massively over-grant a permanent ↑1 across a huge, ill
    // -defined swath of Skill Tests - too broad to safely flatten, genuinely needs its own design
    // (likely a per-instance skill picker, not currently how choiceType:'senses' is shaped).
    if (rolledSkill == 'alertness' && ACUTE_SENSE_IDS.some(id => actorHasPerk(actor, id))) {
      skillDataset.edge = true;
    }

    // Lifelike - see LIFELIKE_IDS' own comment above.
    if (rolledSkill == 'deception' && !actor.system.isTransformed && LIFELIKE_IDS.some(id => actorHasPerk(actor, id))) {
      skillDataset.edge = true;
    }

    // See Something, Say Nothing - see SEE_SOMETHING_SAY_NOTHING_ID's own comment above. Same
    // unconditional-Edge idiom as Bits To Spare/Truthseeker.
    if (rolledSkill == 'streetwise' && actorHasPerk(actor, SEE_SOMETHING_SAY_NOTHING_ID)) {
      skillDataset.edge = true;
    }

    // Animal Friend - see ANIMAL_FRIEND_ID's own comment above.
    if (rolledSkill == 'animalHandling' && actorHasPerk(actor, ANIMAL_FRIEND_ID)) {
      updatedShiftDataset.isSpecialized = true;
    }

    // Environmental Expertise (Ranger base, 1st/9th/18th level, p.90) - see
    // helpers/environmental-expertise.mjs's own doc comment. "Non-combat Skill Tests" is
    // approximated as "not an Attack" (item?.type != 'weaponEffect'), the same proxy Exploit
    // Trust's own "outside of Combat" check already establishes for a similar RAW distinction.
    // Also grants the same benefit to whoever a Guidance-holding ally last granted it to (see
    // helpers/environmental-expertise.mjs's own GUIDANCE_ID comment) - a bare marker flag banked
    // via BANKABLE_PERKS, consumed on the very next roll of any kind.
    const pendingGuidance = getPendingBonus(actor, PENDING_GUIDANCE_FLAG_KEY);
    if (hasActiveEnvironmentalExpertise(actor) || pendingGuidance) {
      if (item?.type == 'weaponEffect') {
        updatedShiftDataset.isSpecialized = true;
      } else {
        skillDataset.edge = true;
      }

      if (pendingGuidance) {
        await clearPendingBonus(actor, PENDING_GUIDANCE_FLAG_KEY);
      }
    }

    // Recon (Focus: Scout, base grant, p.94): "any time you are in your environment of expertise
    // and you can not see your allies, you gain an Edge on Alertness, Initiative, and Survival
    // Skill Tests." The Initiative half lives in prepareInitiativeRoll() instead (Initiative never
    // rolls through here - see RECON_ID's own comment there). "And you can not see your allies" is
    // dropped as an unenforceable narrative qualifier (no line-of-sight/visibility tracking exists
    // anywhere in this codebase) - the same "narrower narrative precondition, unconditional grant
    // instead" idiom Bits To Spare/Truthseeker/Fear My Name already establish.
    if (['alertness', 'survival'].includes(rolledSkill) && actorHasPerk(actor, RECON_ID)
      && hasActiveEnvironmentalExpertise(actor)) {
      skillDataset.edge = true;
    }

    // Genius (Technician, 15th level, p.104): "treat all Skill Tests related to your Role Skills
    // as Specialized." "Role Skills" is a real, per-actor list - the actor's own base Role Item's
    // own system.skills array (see actor.mjs#_getBaseRole's own doc comment) - not a fixed set.
    if (actorHasPerk(actor, GENIUS_ID) && actor._getBaseRole?.()?.system.skills?.includes(rolledSkill)) {
      updatedShiftDataset.isSpecialized = true;
    }

    // Adaptable (MLP Earth Pony Origin Perk, p.33): "Pick one of your Essence Scores for this
    // Perk to apply to. Once per scene, when using a Skill from that Essence, you can make the
    // roll as though you have a Specialization." Which Essence is chosen via the new
    // choiceType:'essence' picker (system.choice) - see perk-handler.mjs's own 'essence' case.
    // Auto-applied and auto-consumed (no dialog checkbox) once/scene via hasUsedThisEncounter,
    // same accepted "always available outside combat" looseness as Force above.
    const adaptablePerk = findPerk(actor, ADAPTABLE_ID);
    if (adaptablePerk?.system.choice == rolledEssence
      && !hasUsedThisEncounter(actor, 'adaptableUsedThisEncounter')) {
      updatedShiftDataset.isSpecialized = true;
      await markUsedThisEncounter(actor, 'adaptableUsedThisEncounter');
    }

    // Adventurer (GI Joe CRB, Influence Perk, p.44): "Once per scene when you draw upon your
    // experiences with a short story of your adventures, you gain an Edge on a Smarts or Social
    // test." Same auto-applied/auto-consumed once/scene shape as Adaptable just above, but
    // unconditional across BOTH Essences (not a single player-chosen one) since RAW itself
    // already names both - "drawing upon a short story" is the same narrative-trigger idiom
    // this project already treats as always-available, not requiring its own button click.
    if ((rolledEssence == 'smarts' || rolledEssence == 'social') && actorHasPerk(actor, ADVENTURER_ID)
      && !hasUsedThisEncounter(actor, 'adventurerUsedThisEncounter')) {
      skillDataset.edge = true;
      await markUsedThisEncounter(actor, 'adventurerUsedThisEncounter');
    }

    // Ninpõ JOEs (Factions in Action Vol. 2, Ninja Force Faction Perk, p.11): "Once per scene, you
    // gain an Edge on any Culture Skill Test related to ninja tactics." Same auto-applied/
    // auto-consumed once/scene shape as Adventurer just above, scoped to Culture specifically
    // instead of an Essence pair - "related to ninja tactics" dropped the same accepted-looseness
    // way this project's other narrower narrative qualifiers already are. The Perk's own +1
    // Willpower half is already a correct, separately-enabled compendium Active Effect.
    if (rolledSkill == 'culture' && actorHasPerk(actor, NINPO_JOES_ID)
      && !hasUsedThisEncounter(actor, 'ninpoJoesUsedThisEncounter')) {
      skillDataset.edge = true;
      await markUsedThisEncounter(actor, 'ninpoJoesUsedThisEncounter');
    }

    // Student of Divine Manuals (Factions in Action Vol. 2, General Perk, p.33): "Once per scene,
    // you may draw inspiration... acting as though you are Specialized in any Skill for one Skill
    // Test." Same once/scene auto-apply shape as Adaptable's own isSpecialized grant, but
    // unconditional across every skill (RAW's own "any Skill") rather than a single player-chosen
    // one.
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

    // Technical Mastery's own direct half - see TECHNICAL_MASTERY_ID's own comment above.
    if (rolledSkill == 'technology' && actorHasPerk(actor, TECHNICAL_MASTERY_ID)) {
      updatedShiftDataset.canCritD2 = true;
    }

    if (actorHasPerk(actor, STUDENT_OF_DIVINE_MANUALS_ID)
      && !hasUsedThisEncounter(actor, 'studentOfDivineManualsUsedThisEncounter')) {
      updatedShiftDataset.isSpecialized = true;
      await markUsedThisEncounter(actor, 'studentOfDivineManualsUsedThisEncounter');
    }

    // Analytical - see ANALYTICAL_ID's own comment above.
    if ((rolledSkill == 'science' || rolledSkill == 'technology') && actorHasPerk(actor, ANALYTICAL_ID)) {
      updatedShiftDataset.isSpecialized = true;
    }

    // Perimeter Defender - see PERIMETER_DEFENDER_ID's own comment above.
    if (rolledSkill == 'alertness' && actorHasPerk(actor, PERIMETER_DEFENDER_ID)) {
      updatedShiftDataset.isSpecialized = true;
      updatedShiftDataset.canCritD2 = true;
    }

    // Fancy Flier - see FANCY_FLIER_ID's own comment above.
    if ((rolledSkill == 'acrobatics' || rolledSkill == 'driving') && actorHasPerk(actor, FANCY_FLIER_ID)) {
      updatedShiftDataset.canCritD2 = true;
    }

    // Fleeting Energy (MLP Heavy Hitter Hang-Up, p.51) - see FORCE_ID's own comment above.
    // Consumed on the actor's own next Strength Skill Test, same "bank now, consume on the next
    // matching roll" idiom as Inner Magic's own scoped shiftUp.
    const pendingFleetingEnergy = getPendingBonus(actor, 'pendingFleetingEnergy');
    if (pendingFleetingEnergy && rolledEssence == 'strength') {
      updatedShiftDataset.shiftDown += pendingFleetingEnergy.shiftDown;
      clearPendingBonus(actor, 'pendingFleetingEnergy');
    }


    // Caretaker (PR CRB, Influence Perk, p.67): "Edge on all Science (Medicine) Skill Tests and
    // Group Skill Tests." "Science (Medicine)" is approximated as any Science roll - this system
    // has no narrower sub-classification within a Skill to check against, the same "narrative
    // purpose can't be verified" simplification Bits To Spare/Truthseeker's own narrower RAW
    // wording already accepts. "Group Skill Tests" isn't a real mechanic anywhere in this
    // codebase (grepped, zero hits) and isn't built.
    if (rolledSkill == 'science' && actorHasPerk(actor, CARETAKER_PR_ID)) {
      skillDataset.edge = true;
    }

    // Peerless Pilot (PR CRB) - Driving Skill Test half; see PEERLESS_PILOT_PR_ID's own comment
    // above for the RAW text and the Driving-specialization-shift check shared with the
    // Initiative-Edge half in prepareInitiativeRoll.
    if (rolledSkill == 'driving' && actorHasPerk(actor, PEERLESS_PILOT_PR_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && this._hasDrivingSpecializationAtOrAboveD6(actor)) {
      skillDataset.edge = true;
    }

    // Wrestler (PR CRB, General Perk, p.99): "Edge on attacks to Grapple." Grapple is a real,
    // existing damageType (E20.damageTypes.grapple) - an ordinary weaponEffect attack, not a
    // separate action - so this checks the rolled item's own damageType directly, the same
    // "core-rule/Perk check against item.system.damageType" shape Barrel Through/Electric already
    // use. The second clause ("Free action to pin a grappled creature - DIF 12 Might Test modified
    // by Size, success Prone") isn't built - a distinct triggered ability with its own DIF math,
    // out of scope for this pass.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple' && actorHasPerk(actor, WRESTLER_ID)) {
      skillDataset.edge = true;
    }

    // Kung Fu Grip (GI Joe CRB, General Perk, p.132): "Edge on Grappling Skill Tests." Same
    // real-existing-damageType shape as Wrestler's identical clause just above.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple' && actorHasPerk(actor, KUNG_FU_GRIP_ID)) {
      skillDataset.edge = true;
    }

    // Experiment - see EXPERIMENT_ID's own comment above. "shove" option: ↑1 Shoving/breaking
    // from a Grapple - same real damageType.grapple proxy as Wrestler/Kung Fu Grip just above, a
    // shiftUp rather than an Edge per RAW's own wording.
    const experimentPerk = findPerk(actor, EXPERIMENT_ID);
    if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
      && experimentPerk?.system.choice == 'shove') {
      updatedShiftDataset.shiftUp = (updatedShiftDataset.shiftUp || 0) + 1;
    }

    // Powerful Grip - see POWERFUL_GRIP_ID's own comment above. ↑1 "as part of a grapple," same
    // real damageType.grapple proxy as Wrestler/Kung Fu Grip/Experiment's shove option above.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple' && actorHasPerk(actor, POWERFUL_GRIP_ID)) {
      updatedShiftDataset.shiftUp = (updatedShiftDataset.shiftUp || 0) + 1;
    }

    // Handy Bot - see HANDY_BOT_ID's own comment above. ↑1 Attacks with Tool-trait weapons, the
    // same itemAndUpgradeTraits check Tactical Gymnastics/Assault Precision already establish.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, HANDY_BOT_ID)
      && this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('tool')) {
      updatedShiftDataset.shiftUp = (updatedShiftDataset.shiftUp || 0) + 1;
    }

    // Reinforced Basics - see REINFORCED_BASICS_ID's own comment above.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, REINFORCED_BASICS_ID)
      && this._getParentWeapon(actor, item)?.system.totalAvailability == 'standard') {
      updatedShiftDataset.shiftUp = (updatedShiftDataset.shiftUp || 0) + 1;
    }

    // Petrolhead's Driving half - see PETROLHEAD_ID's own comment above.
    const petrolheadPerk = findPerk(actor, PETROLHEAD_ID);
    if (rolledSkill == 'driving' && petrolheadPerk
      && this._getPilotedVehicle(actor, 'driver')?.system.movement[petrolheadPerk.system.choice]?.base > 0) {
      updatedShiftDataset.isSpecialized = true;
    }

    // Experiment - "technology" option: Edge on Technology Skill Tests. The "unfamiliar to you"
    // qualifier is dropped unconditionally, same idiom as Sea Legs just below.
    if (rolledSkill == 'technology' && experimentPerk?.system.choice == 'technology') {
      skillDataset.edge = true;
    }

    // Sea Legs (GI Joe CRB, Origin Perk, p.60): "Edge on Athletics Skill Tests when losing your
    // balance." The narrative qualifier ("losing your balance") can't be verified - granted
    // unconditionally on Athletics, the same "player self-polices the fictional trigger" idiom
    // Bits To Spare/Truthseeker's own narrower RAW wording already accepts.
    if (rolledSkill == 'athletics' && actorHasPerk(actor, SEA_LEGS_GIJ_ID)) {
      skillDataset.edge = true;
    }

    // Recruiter - see RECRUITER_ID's own comment above.
    if ((rolledSkill == 'deception' || rolledSkill == 'persuasion') && actorHasPerk(actor, RECRUITER_ID)) {
      skillDataset.edge = true;
    }

    // Daredevil - see DAREDEVIL_ID's own comment above for the Initiative-Edge half (lives in
    // prepareInitiativeRoll() instead). Driving-shiftUp half only, gated on actually being in Alt
    // Mode (system.isTransformed).
    if (rolledSkill == 'driving' && actorHasPerk(actor, DAREDEVIL_ID) && actor.system.isTransformed) {
      updatedShiftDataset.shiftUp = (updatedShiftDataset.shiftUp || 0) + 2;
    }

    // Object Alt Mode (Transformers CRB, General Perk, p.110): "Alt Mode resembles a mundane
    // object... Edge on hiding/blending/eavesdropping Skill Tests." CORRECTED 2026-09-12 from an
    // earlier session's wrong "no Bot/Alt-Mode current-state tracking exists" note - Daredevil's
    // own already-built Driving check just above confirms actor.system.isTransformed is real,
    // live-toggled infrastructure. Infiltration covers hiding/blending, Alertness covers
    // eavesdropping - "in applicable surroundings" is dropped as an unenforceable narrative
    // qualifier, the same idiom this project already uses broadly.
    if ((rolledSkill == 'infiltration' || rolledSkill == 'alertness')
      && actorHasPerk(actor, OBJECT_ALT_MODE_ID) && actor.system.isTransformed) {
      skillDataset.edge = true;
    }

    // Specialist (GI Joe CRB, Influence Perk, p.54): "select a skill you have a Specialization
    // in. Once per encounter when using that skill outside of combat, you gain an Edge." Which
    // skill is chosen the same way Awesome/Cutie-Mark-style Perks already record a player choice
    // (choiceType:'skills', system.choice) - RAW's own "must already be Specialized in it"
    // constraint isn't enforced (the picker doesn't filter by existing Specializations, the same
    // "offer the choice, don't verify the precondition" idiom this project already accepts
    // elsewhere). "Once per encounter... outside of combat" has no boundary this codebase can
    // detect - hasUsedThisEncounter/markUsedThisEncounter are keyed on game.combat's own id and
    // always read false with no active combat, the opposite of what this Perk needs - so the
    // once-per-encounter cap is dropped as unenforceable and the Edge is granted unconditionally
    // whenever outside combat on the chosen skill, the same accepted-simplification idiom Bits To
    // Spare/Truthseeker's own narrower RAW wording already uses.
    if (!game.combat && findPerk(actor, SPECIALIST_ID)?.system.choice == rolledSkill) {
      skillDataset.edge = true;
    }

    // Rocket Scientist - see ROCKET_SCIENTIST_ID's own comment above. Same shape as Specialist
    // just above, additionally gated to Science/Technology (RAW's own narrower skill scope).
    if (!game.combat && (rolledSkill == 'science' || rolledSkill == 'technology')
      && findPerk(actor, ROCKET_SCIENTIST_ID)?.system.choice == rolledSkill) {
      skillDataset.edge = true;
    }

    // Dinobot - see DINOBOT_ID's own comment above. Unlike Specialist/Rocket Scientist, not gated
    // to outside-combat (RAW states no such qualifier here).
    if (DINOBOT_SKILLS.includes(rolledSkill) && findPerk(actor, DINOBOT_ID)?.system.choice == rolledSkill) {
      skillDataset.edge = true;
    }

    // Maximal - see MAXIMAL_ID's own comment above.
    if (MAXIMAL_SKILLS.includes(rolledSkill) && findPerk(actor, MAXIMAL_ID)?.system.choice == rolledSkill) {
      skillDataset.edge = true;
    }

    // Predacon - see PREDACON_ID's own comment above.
    if (rolledSkill == 'intimidation' && findPerk(actor, PREDACON_ID)?.system.choice == rolledSkill) {
      skillDataset.edge = true;
    }

    // Omega Enhancement's own Power Mode - see helpers/omega-enhancement.mjs's own doc comment.
    // "Edge on Might Skill Tests" while active.
    if (rolledSkill == 'might' && isPowerModeActive(actor)) {
      skillDataset.edge = true;
    }

    // Biogenetic - see BIOGENETIC_ID's own comment above. The Edge half (while still BioGenetic,
    // i.e. in Alt Mode); the flat +1 half (no longer BioGenetic, i.e. in Bot Mode) is folded into
    // the roll's own flat modifier instead, alongside technostalgicModifier below.
    if ((rolledSkill == 'infiltration' || rolledSkill == 'persuasion')
      && actorHasPerk(actor, BIOGENETIC_ID) && actor.system?.isTransformed) {
      skillDataset.edge = true;
    }

    // Rocket Scientist's own Hang-Up - see ROCKET_SCIENTIST_HANGUP_ID's own comment above.
    if (game.combat && (rolledSkill == 'science' || rolledSkill == 'technology')
      && actorHasHangUp(actor, ROCKET_SCIENTIST_HANGUP_ID)
      && !hasUsedThisEncounter(actor, ROCKET_SCIENTIST_HANGUP_ENCOUNTER_FLAG)) {
      skillDataset.snag = true;
      await markUsedThisEncounter(actor, ROCKET_SCIENTIST_HANGUP_ENCOUNTER_FLAG);
    }

    // Leadfoot's own Hang-Up - see LEADFOOT_HANGUP_ID's own comment above.
    if (rolledSkill == 'alertness' && actorHasHangUp(actor, LEADFOOT_HANGUP_ID)
      && !this._getPilotedVehicle(actor, 'driver')) {
      skillDataset.snag = true;
    }

    // Fear My Name (Decepticon Directive Raider, 14th level, p.62): "you get Edge on Intimidation
    // and Persuasion Skill Tests against anyone previously targeted by your faction's actions."
    // "Previously targeted by your faction" has no history to check (this system tracks no
    // faction-action log) - same "drop the unenforceable narrative precondition, grant the
    // mechanical half unconditionally" idiom as Bits To Spare/Truthseeker just above.
    if ((rolledSkill == 'intimidation' || rolledSkill == 'persuasion') && actorHasPerk(actor, FEAR_MY_NAME_ID)) {
      skillDataset.edge = true;
    }

    // Camper - see CAMPER_ID's own comment above.
    if (rolledSkill == 'survival' && actorHasPerk(actor, CAMPER_ID)
      && actor.system.health.value >= actor.system.health.max / 2) {
      skillDataset.edge = true;
    }

    // Desperate (Cobra Codex, Influence Perk, p.29): "When you have only 1 Health left, you gain
    // Edge on all Skill Tests." Same health-threshold-gated unconditional Edge shape as Camper
    // above, but unscoped to any particular skill (RAW says "all Skill Tests") and gated on
    // exactly 1 Health rather than "at least half." The Hang-Up's own "Financial Situation for
    // Wealth Tests is one step worse" is NOT built - "Financial Situation" (GI Joe CRB p.111) has
    // no representation anywhere in this codebase (confirmed via grep - not even a plain tracked
    // field), a real, more foundational gap than a simple skill shiftDown would suggest.
    if (actorHasPerk(actor, DESPERATE_ID) && actor.system.health.value == 1) {
      skillDataset.edge = true;
    }

    // ID the Outdoors - see ID_THE_OUTDOORS_ID's own comment above.
    if (['science', 'persuasion', 'deception'].includes(rolledSkill) && actorHasPerk(actor, ID_THE_OUTDOORS_ID)) {
      skillDataset.edge = true;
    }

    // Camouflage Hide - see CAMOUFLAGE_HIDE_ID's own comment above.
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, CAMOUFLAGE_HIDE_ID)) {
      skillDataset.edge = true;
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

    // Gold Ranger Prime (Across the Stars, 20th level, p.53) - "while Morphed, gain Edge on
    // Strength Skill Tests." The "+2 all Defenses" bullet is already a compendium Active Effect;
    // the "extra damage on Megaform Zord Attacks" bullet stays Needs new infrastructure (Zord
    // combat isn't modeled at all) - only this Edge grant is built here.
    if (rolledEssence == 'strength' && actor.system.isMorphed && actorHasPerk(actor, GOLD_RANGER_PRIME_ID)) {
      skillDataset.edge = true;
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

    // How I Got These Dents (Warrior, 14th level, p.92): "you gain an upshift on Intimidation
    // Skill Tests equal to the amount of damage you currently have." Unconditional self-status,
    // like Reckless Abandon's own Strength upshift above - "damage you currently have" is read as
    // max Health minus current Health (Health.bonus already folded into both by the schema).
    if (rolledSkill == 'intimidation' && actorHasPerk(actor, HOW_I_GOT_THESE_DENTS_ID)) {
      updatedShiftDataset.shiftUp += Math.max(0, actor.system.health.max - actor.system.health.value);
    }

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

    // Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272) - see
    // helpers/bolster-defense.mjs's own doc comment. Threaded straight through from the synthetic
    // dataset set at activation, read in post-roll success handling below.
    const isBolsterDefenseAttempt = !!dataset.isBolsterDefenseAttempt;
    const bolsterDefenseMode = dataset.bolsterDefenseMode ?? null;
    const bolsterDefenseType = dataset.bolsterDefenseType ?? null;
    const bolsterDefenseTargetUuid = dataset.bolsterDefenseTargetUuid ?? null;

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

    // Words Can Hurt! (Enigma of Combination, Counselor Focus, 6th level, p.34) - see
    // helpers/words-can-hurt.mjs's own doc comment. Same "threaded through" shape as Voice of
    // Primus just above.
    const isWordsCanHurtAttempt = !!dataset.isWordsCanHurtAttempt;
    const wordsCanHurtTargetUuid = dataset.wordsCanHurtTargetUuid ?? null;

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
    const isIllusoryDisguiseAttempt = !!dataset.isIllusoryDisguiseAttempt;

    // Humanitarian (PR CRB, General Perk, p.96) - see helpers/humanitarian.mjs's own doc comment.
    // Threaded straight through the same way as Lucky Charm/Illusory Disguise just above.
    const isHumanitarianAttempt = !!dataset.isHumanitarianAttempt;

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

    // Warfighter (Infantry base, 17th level): "you are specialized in all Targeting weapons."
    // Pre-fills the same isSpecialized the dialog's own toggle uses, same "auto-detect, player
    // can still override" shape as canCritD2 above - the +2 damage half is unconditional and
    // needs no dialog toggle at all, see damageBonusValue below.
    if (item?.type == 'weaponEffect' && item.system.classification.skill == 'targeting' && actorHasPerk(actor, WARFIGHTER_ID)) {
      updatedShiftDataset.isSpecialized = true;
    }

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
    updatedShiftDataset.heavyForceAvailable = isMeleeWeaponEffect
      && actor.system.isMorphed
      && actorHasPerk(actor, HEAVY_FORCE_ID)
      && actor.system.powers?.personal?.value > 0
      && !hasUsedThisTurn(actor, HEAVY_FORCE_TURN_FLAG);

    // Quantum Cut / Solo Shot (A Jump Through Time, Quantum Ranger, Quantum Power options, p.46) -
    // both gated on attacking with one specific named half of the Quantum Defender weapon pair,
    // same weaponSourceId lookup idiom as Assault Precision/Piercing Shot above.
    const quantumDefenderWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const quantumDefenderWeaponSourceId = quantumDefenderWeapon?.flags?.core?.sourceId
      ?? quantumDefenderWeapon?._stats?.compendiumSource;

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
      && (!game.combat
        || (actorHasPerk(actor, WORTH_ANOTHER_SHOT_ID) && !hasUsedThisEncounter(actor, WORTH_A_SHOT_COMBAT_FLAG)))
      && actor.items?.some(i => i.type == 'weapon' && i.system.traits?.includes('ballistic'));

    // Machinist - see MACHINIST_ID's own comment above.
    updatedShiftDataset.machinistAvailable = actorHasPerk(actor, MACHINIST_ID);

    // Bootlicker - see BOOTLICKER_ID's own comment above.
    updatedShiftDataset.bootlickerAvailable = actorHasPerk(actor, BOOTLICKER_ID);

    // Hunter's Prowess - see HUNTERS_PROWESS_ID's own comment above.
    updatedShiftDataset.huntersProwessAvailable = actorHasPerk(actor, HUNTERS_PROWESS_ID);

    // Ambitious - see AMBITIOUS_ID's own comment above.
    updatedShiftDataset.ambitiousAvailable = actorHasPerk(actor, AMBITIOUS_ID)
      && !hasUsedThisEncounter(actor, AMBITIOUS_ENCOUNTER_FLAG);

    // Isolated - see ISOLATED_ID's own comment above.
    updatedShiftDataset.isolatedAvailable = actorHasPerk(actor, ISOLATED_ID)
      && !hasUsedThisEncounter(actor, ISOLATED_ENCOUNTER_FLAG);

    // Technically Correct - see TECHNICALLY_CORRECT_ID's own comment above.
    updatedShiftDataset.technicallyCorrectAvailable = rolledSkill != 'technology'
      && actorHasPerk(actor, TECHNICALLY_CORRECT_ID)
      && !hasUsedThisEncounter(actor, TECHNICALLY_CORRECT_ENCOUNTER_FLAG);

    // Gutter Champion - see GUTTER_CHAMPION_ID's own comment above.
    updatedShiftDataset.gutterChampionAvailable = actorHasPerk(actor, GUTTER_CHAMPION_ID)
      && !hasUsedThisTurn(actor, 'gutterChampionUsedThisTurn');

    // Beloved - see BELOVED_ID's own comment above.
    updatedShiftDataset.belovedAvailable = actorHasPerk(actor, BELOVED_ID)
      && !hasUsedThisTurn(actor, 'belovedUsedThisTurn');

    // Thrillseeker - see THRILLSEEKER_HANGUP_ID's own comment above.
    updatedShiftDataset.thrillseekerAvailable = (rolledEssence == 'strength' || rolledEssence == 'speed')
      && actorHasHangUp(actor, THRILLSEEKER_HANGUP_ID)
      && getUsesThisEncounter(actor, THRILLSEEKER_ENCOUNTER_FLAG) < 3;

    // Straight Shooter - see STRAIGHT_SHOOTER_TF_ID's own comment above.
    updatedShiftDataset.straightShooterAvailable = item?.type == 'weaponEffect'
      && combatModifiers.shiftDown > 0
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('ballistic')
      && actorHasPerk(actor, STRAIGHT_SHOOTER_TF_ID)
      && !hasUsedThisTurn(actor, 'straightShooterUsedThisTurn');

    // How Strange! (WTNV Citizen's Guide, Scientist Role, p.44): "gain ↑2 on all Weird Skill Tests
    // and may attempt Weird Skill Tests with the Science Skill." The ↑2 half is a plain compendium
    // Active Effect; this checkbox covers the skill-substitution half - same shift-position-delta
    // mechanism Cunning Plan already establishes just above, but free (no Power cost) and gated to
    // Weird only, matching RAW's own narrower scope.
    updatedShiftDataset.howStrangeAvailable = rolledSkill == 'weird' && actorHasPerk(actor, HOW_STRANGE_ID);

    // Kind, But Firm - see KIND_BUT_FIRM_ID's own comment above.
    updatedShiftDataset.kindButFirmAvailable = rolledSkill == 'intimidation'
      && !!findPerk(actor, EMPATHY_MLP_ID)?.system.choice && actorHasPerk(actor, KIND_BUT_FIRM_ID);

    // Wire Work (Commando base, Infiltrator Focus, 6th level, p.73): "You may use Acrobatics in
    // place of Athletics." Same shift-position-delta substitution mechanism as How Strange! above,
    // free (no cost), gated to Athletics only, matching RAW's own narrower scope.
    updatedShiftDataset.wireWorkAvailable = rolledSkill == 'athletics' && actorHasPerk(actor, WIRE_WORK_ID);

    // Ambush Predator - see AMBUSH_PREDATOR_ID's own comment above.
    updatedShiftDataset.ambushPredatorAvailable = rolledSkill == 'infiltration' && actorHasPerk(actor, AMBUSH_PREDATOR_ID);

    // Street Smarts - see STREET_SMARTS_ID's own comment above.
    updatedShiftDataset.streetSmartsAvailable = rolledSkill == 'persuasion' && actorHasPerk(actor, STREET_SMARTS_ID);

    // Primal Fear - see PRIMAL_FEAR_ID's own comment above.
    updatedShiftDataset.primalFearAvailable = rolledSkill == 'intimidation' && actorHasPerk(actor, PRIMAL_FEAR_ID);

    // Natural Science - see NATURAL_SCIENCE_ID's own comment above. Bidirectional - one checkbox
    // per direction, only ever one of the two offered on a given roll.
    updatedShiftDataset.naturalScienceToSurvivalAvailable = rolledSkill == 'science' && actorHasPerk(actor, NATURAL_SCIENCE_ID);
    updatedShiftDataset.naturalScienceToScienceAvailable = rolledSkill == 'survival' && actorHasPerk(actor, NATURAL_SCIENCE_ID);

    // Science Fixes All - see SCIENCE_FIXES_ALL_ID's own comment above.
    updatedShiftDataset.scienceFixesAllAvailable = rolledSkill == 'technology' && actorHasPerk(actor, SCIENCE_FIXES_ALL_ID);

    // Urban Jungle - see URBAN_JUNGLE_ID's own comment above.
    updatedShiftDataset.urbanJungleAvailable = rolledSkill == 'survival' && actorHasPerk(actor, URBAN_JUNGLE_ID);

    // Fear Is Universal - see FEAR_IS_UNIVERSAL_ID's own comment above. One checkbox covering all
    // 3 substituted skills.
    updatedShiftDataset.fearIsUniversalAvailable = ['animalHandling', 'deception', 'persuasion'].includes(rolledSkill)
      && actorHasPerk(actor, FEAR_IS_UNIVERSAL_ID);

    // Hesher - see HESHER_ID's own comment above. Only offered when the current roll matches the
    // actor's own chosen skill.
    updatedShiftDataset.hesherAvailable = findPerk(actor, HESHER_ID)?.system.choice == rolledSkill;

    // Brute Force - see BRUTE_FORCE_IAF2_ID's own comment above.
    updatedShiftDataset.bruteForceIaf2Available = item?.type == 'weaponEffect' && rolledSkill == 'targeting'
      && this._getParentWeapon(actor, item)?.system.classification?.size == 'heavy'
      && actorHasPerk(actor, BRUTE_FORCE_IAF2_ID);

    // Roaring Engine - see ROARING_ENGINE_ID's own comment above.
    updatedShiftDataset.roaringEngineAvailable = rolledSkill == 'intimidation'
      && !!this._getPilotedVehicle(actor, 'driver') && actorHasPerk(actor, ROARING_ENGINE_ID);

    // Whip Into Shape - see WHIP_INTO_SHAPE_ID's own comment above.
    updatedShiftDataset.whipIntoShapeAvailable = rolledSkill != 'intimidation'
      && (rolledEssence == 'strength' || rolledEssence == 'speed')
      && actorHasPerk(actor, WHIP_INTO_SHAPE_ID)
      && !hasUsedThisEncounter(actor, 'whipIntoShapeUsedThisEncounter');

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

    // Aerial Interface - see AERIAL_INTERFACE_ID's own comment above.
    if (rolledSkill == 'driving' && actorHasPerk(actor, AERIAL_INTERFACE_ID)
      && this._getPilotedVehicle(actor, 'driver')?.system.movement.aerial.base > 0) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Skyward's own Hang-Up - see SKYWARD_ID's own comment above.
    if (rolledSkill == 'driving' && actorHasPerk(actor, SKYWARD_ID)) {
      const drivenVehicle = this._getPilotedVehicle(actor, 'driver');
      const isNonAirVehicle = drivenVehicle
        && (drivenVehicle.system.movement.ground.base > 0 || drivenVehicle.system.movement.swim.base > 0);
      if (isNonAirVehicle) {
        updatedShiftDataset.shiftDown += 1;
      }
    }

    // Saber-Toothed - see SABER_TOOTHED_ID's own comment above. Gated the same way the pre-existing
    // cryogenicTouchAvailable pre-fill already is (isUnarmedAttack itself isn't computed until
    // later in this function, so this re-derives the same "no parent weapon" check independently).
    updatedShiftDataset.saberToothedAvailable = item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)
      && actorHasPerk(actor, SABER_TOOTHED_ID);

    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above. Only meaningful on an
    // actual Outwit attempt.
    updatedShiftDataset.deceptiveWarfareAvailable = !!dataset.isOutwit && actorHasPerk(actor, DECEPTIVE_WARFARE_ID);

    // Brain Power - see BRAIN_POWER_ID's own comment above.
    updatedShiftDataset.brainPowerAvailable = findPerk(actor, BRAIN_POWER_ID)?.system.choice == rolledSkill;

    // Seeing the Matrix (Focus: Tinkerer, 6th level, p.105): "once per Scene, you can use the
    // Technology skill in place of another skill for a Skill Test." Same shift-position-delta
    // substitution as Brain Power just above, but unscoped to any skill (not a single
    // choiceType:'skills' pick) and limited to once per encounter instead - approximating "once
    // per Scene", this project's usual idiom for that duration. Not offered on a Technology roll
    // itself (nothing to substitute).
    updatedShiftDataset.seeingTheMatrixAvailable = rolledSkill != 'technology'
      && actorHasPerk(actor, SEEING_THE_MATRIX_ID) && !hasUsedThisEncounter(actor, SEEING_THE_MATRIX_ENCOUNTER_FLAG);

    // "Pseudo"-Science (WTNV Citizen's Guide, Scientist Role, Night Vale Community College Focus,
    // p.44) - see helpers/pseudo-science.mjs's own doc comment. Same shift-position-delta
    // mechanism as How Strange! above, but unscoped to any Skill Test other than Science itself
    // (rather than one fixed skill), gated on the session-long toggle rather than just holding
    // the Perk.
    updatedShiftDataset.pseudoScienceAvailable = rolledSkill != 'science' && actorHasPerk(actor, PSEUDO_SCIENCE_ID)
      && isPseudoScienceActive(actor);

    // Mightier Than the Sword (WTNV Citizen's Guide, Journalist Role, Print Focus, p.38): "You can
    // make physical attacks using Pens with the Streetwise Skill in addition to the Finesse
    // Skill." Same shift-position-delta substitution mechanism as How Strange! above, but scoped
    // to attacks with this Perk's own granted Dagger specifically (its own "use statistics for a
    // Dagger" clause) rather than any Weird roll - same weaponSourceId idiom as Assault Precision/
    // Piercing Shot above. Its own "considered Specialized in attacking with Pens" clause needs no
    // code - already covered by the pre-existing, always-available isSpecialized checkbox (same
    // verify-only finding as Mind Like a Steel Trap/Public Television/Third Eye elsewhere).
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, MIGHTIER_THAN_THE_SWORD_ID)) {
      const mightierThanTheSwordWeapon = this._getParentWeapon(actor, item);
      const mightierThanTheSwordWeaponSourceId = mightierThanTheSwordWeapon?.flags?.core?.sourceId
        ?? mightierThanTheSwordWeapon?._stats?.compendiumSource;
      updatedShiftDataset.mightierThanTheSwordAvailable = mightierThanTheSwordWeaponSourceId == WTNV_DAGGER_ID;
    } else {
      updatedShiftDataset.mightierThanTheSwordAvailable = false;
    }

    // Precision Aim (Pink Ranger, 9th/18th level, p.49) - see PRECISION_AIM_ID's own comment
    // above. Ranged only (RAW: "ranged combat attacks"), the opposite scope from Strike Bonus's
    // melee-only check just above.
    const precisionAimPerk = findPerk(actor, PRECISION_AIM_ID);
    const isRangedWeaponEffect = item?.type == 'weaponEffect' && item.system.classification.style != 'melee';
    updatedShiftDataset.precisionAimAvailable = isRangedWeaponEffect && !!precisionAimPerk
      ? precisionAimPerk.system.advances.currentValue
      : 0;

    // All I Need is One Shot - see ALL_I_NEED_IS_ONE_SHOT_ID's own comment above. Ranged only,
    // same scope as Precision Aim just above.
    updatedShiftDataset.allINeedIsOneShotAvailable = isRangedWeaponEffect && actorHasPerk(actor, ALL_I_NEED_IS_ONE_SHOT_ID);

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

    // Explosive Engineer (General Hawk's Personnel Files, Influence Perk, p.169): "You can use
    // either Science or Technology when making an Attack Skill Test with explosives." An
    // explosive-STYLE weaponEffect (item.system.classification.style == 'explosive', the actual
    // schema value - not a proxy) is exactly "an Attack... with explosives." Two independent
    // checkboxes (same shift-position-delta substitution as How Strange!/Wire Work below), since
    // RAW offers a genuine choice of skill rather than one fixed alternate. The Hang-Up's own
    // "does not apply to grenades" exclusion isn't enforced - unlike a shotgun/submachine gun
    // (Assault Precision's own hardcoded-compendium-ID idiom), there's no small closed set of
    // "grenade" weapon Items to check against, and no structured field distinguishing a grenade
    // from any other explosive weapon (E20.weaponTypes' own "grenades"/"explosives" entries are
    // Role-qualification-list config only, never written onto an individual weapon Item -
    // confirmed via grep, same gap Assault Precision's own doc comment already flags for
    // "shotgun"/"submachineGun").
    const isExplosiveWeaponEffect = item?.type == 'weaponEffect' && item.system.classification.style == 'explosive';
    updatedShiftDataset.explosiveEngineerScienceAvailable = isExplosiveWeaponEffect
      && actorHasPerk(actor, EXPLOSIVE_ENGINEER_ID);
    updatedShiftDataset.explosiveEngineerTechnologyAvailable = isExplosiveWeaponEffect
      && actorHasPerk(actor, EXPLOSIVE_ENGINEER_ID);

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

    // Terror (Beneath the Helmet, Dark Ranger, 1st level, p.39) - see helpers/terror.mjs's own
    // doc comment. "Any amount" of currently-accrued Terror, offered on any Attack (not
    // ranged-only, unlike Hobble/Penetrating Aim above).
    updatedShiftDataset.terrorAvailable = item?.type == 'weaponEffect' ? getTerrorAvailable(actor) : 0;

    // Demolition Driver - see DEMOLITION_DRIVER_ID's own comment above. Capped at a fixed 3
    // (RAW's own "downshift 1, 2, or 3"), not a banked resource's current value like Terror.
    updatedShiftDataset.demolitionDriverAvailable = this._isDemolitionDriverAttack(actor, item) ? 3 : 0;

    // Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73) - see
    // helpers/supreme-guardian.mjs's own doc comment (bullet 2 - "spend any number of Eltarian
    // Tech Points for +1 Energy damage each" after hitting with a Melee Power Weapon). Same
    // "any amount of a banked resource" shape as Terror just above, but scoped to a melee
    // powerWeapon-trait Attack specifically, same trait check Power Boost/Red Ranger Prime's own
    // powerWeapon clauses already use.
    updatedShiftDataset.supremeGuardianTechAvailable = isMeleeWeaponEffect
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('powerWeapon')
      ? getSupremeGuardianTechAvailable(actor)
      : 0;

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

    // Withering Fire (Factions in Action Vol. 2, Infantry Focus, p.68): "If you Attack a target
    // that an ally Attacked since your last turn, you can spend a Story Point to give the target
    // the Frightened Condition if your Attack hits." Reuses Team Focus's own "attacked by an ally
    // this round" marking (helpers/team-focus.mjs) directly - checkTeamFocus() already checks
    // actorHasPerk(actor, WITHERING_FIRE_ID) internally, and RAW here names no melee restriction
    // (unlike Team Focus's own shiftUp, which is melee-only), so it's checked unqualified.
    const witheringFireTarget = item?.type == 'weaponEffect' ? game.user.targets.first()?.actor : null;
    updatedShiftDataset.witheringFireAvailable = !!witheringFireTarget
      && checkTeamFocus(actor, witheringFireTarget, WITHERING_FIRE_ID)
      && isGmConnected() && hasStoryPointsAvailable(1);

    // Menacing Glare (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see
    // helpers/menacing-glare.mjs's own doc comment. A plain Intimidation Skill Test (the player
    // picks Willpower manually from the existing Defense dropdown, same as any other Skill Test
    // vs. Defense) - only the 1-Power cost is a checkbox here, gated on being able to afford it.
    updatedShiftDataset.menacingGlareAvailable = rolledSkill == 'intimidation'
      && actorHasPerk(actor, MENACING_GLARE_ID) && actor.system.powers.personal.value >= 1;

    // Dependable Tanker - see DEPENDABLE_TANKER_ID's own comment above.
    updatedShiftDataset.dependableTankerAvailable = ['driving', 'technology'].includes(rolledSkill)
      && actorHasPerk(actor, DEPENDABLE_TANKER_ID) && isGmConnected() && hasStoryPointsAvailable(1);

    // Hacking Algorithms - see HACKING_ALGORITHMS_ID's own comment above.
    updatedShiftDataset.hackingAlgorithmsAvailable = rolledSkill == 'technology'
      && actorHasPerk(actor, HACKING_ALGORITHMS_ID) && isGmConnected() && hasStoryPointsAvailable(1);

    // Charge (Warrior, 2nd level, p.91): "If you Move at least 10ft away from your past position...
    // and then Attack with a Might weapon immediately after, you gain an upshift on the Might
    // Skill Test." "Moved at least 10ft immediately before" has no hook to verify (same
    // self-policed-checkbox reasoning as Precision Aim's own "haven't moved" clause, just the
    // opposite fictional trigger), so this is a checkbox rather than an automatic grant.
    updatedShiftDataset.chargeAvailable = item?.type == 'weaponEffect' && item.system.classification.skill == 'might'
      && actorHasPerk(actor, CHARGE_TF_ID);

    // Bump & Run - see BUMP_AND_RUN_ID's own comment above. Any Attack Skill Test, not scoped to a
    // specific skill (unlike Charge's own Might-only wording).
    updatedShiftDataset.bumpAndRunAvailable = item?.type == 'weaponEffect' && actorHasPerk(actor, BUMP_AND_RUN_ID);

    // Target Vulnerability (Spec Ops Focus, 3rd level, p.63): "when you Attack with a one-handed
    // weapon, you can also attempt an Alertness Skill Test against a target's Willpower or
    // Cleverness. On a success, your attack deals 1 additional damage." Approximated as a
    // checkbox declaring that secondary Alertness check already succeeded, rather than actually
    // rolling a second, independent Skill Test alongside the attack - simulating two full rolls
    // per action is disproportionate to this Perk's own small payoff. "One-handed weapon" isn't
    // checked either (this system has no per-weapon handedness flag to read) - available on any
    // weaponEffect attack.
    updatedShiftDataset.targetVulnerabilityAvailable = item?.type == 'weaponEffect'
      && actorHasPerk(actor, TARGET_VULNERABILITY_ID);

    // Barrel Through (Outrider Focus, 3rd level, p.87): "you gain an upshift on Maneuver attacks."
    // Unconditional, like Reckless Abandon's own Strength upshift - "Maneuver" is one of this
    // system's own damageType keys (E20.damageTypes), not a Skill or trait, so this checks the
    // weaponEffect's own damageType directly. The second clause ("+1 damage on a Ram attack you
    // moved 20ft before") isn't built - identifying a "Ram" attack specifically and tracking
    // pre-attack movement are both out of scope for this pass.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'maneuver' && actorHasPerk(actor, BARREL_THROUGH_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Wrestler (Slammer Focus) - see WRESTLER_SLAMMER_ID's own comment above. Gated on actually
    // holding Beast of Burden too - RAW's own "your Beast of Burden bonus" presupposes it, and
    // Beast of Burden isn't automatically granted alongside Wrestler (a separate General Perk
    // pick).
    if (item?.type == 'weaponEffect' && item.system.damageType == 'maneuver'
      && actorHasPerk(actor, WRESTLER_SLAMMER_ID) && actorHasPerk(actor, BEAST_OF_BURDEN_ID)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Electric (Damage Types): "Electric weapons gain an upshift on attacks." A core rule of the
    // damage type itself, unconditional and not gated behind any Perk - every Electric-damage
    // weaponEffect gets this, the same "checks item.system.damageType directly" shape as Barrel
    // Through just above.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'electric') {
      updatedShiftDataset.shiftUp += 1;
    }

    // Fire Master (Oktober Guard General Perk, p.95): "You gain Resistance to Fire damage
    // [a plain compendium Active Effect]. Additionally, you gain ↑1 on Skill Tests with Attacks
    // dealing Fire damage." Same "checks item.system.damageType directly" shape as Barrel
    // Through/Electric above.
    if (item?.type == 'weaponEffect' && item.system.damageType == 'fire' && actorHasPerk(actor, FIRE_MASTER_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Randori Master - see RANDORI_MASTER_ID's own comment above.
    if (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item) && actorHasPerk(actor, RANDORI_MASTER_ID)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Martial Weapon Master (Factions in Action Vol. 2, General Perk, p.32): "You gain ↑1 on
    // Attack Skill Tests with Martial Arts weapons but suffer ↓1 on Attacks with all other
    // weapons." Same parent-weapon-trait-check shape Black Ranger Prime/Assault Precision already
    // established. An unarmed Attack (no parent weapon at all, the established proxy) gets neither
    // half - a judgment call, since this system's own Unarmed Combat weapon item does carry the
    // martialArts trait on its base Item, but _getParentWeapon's "no parent weapon" idiom can't see
    // that trait for an unarmed attack the same way it can for a real wielded weapon.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, MARTIAL_WEAPON_MASTER_ID)) {
      const martialWeaponMasterWeapon = this._getParentWeapon(actor, item);
      if (martialWeaponMasterWeapon?.system.traits.includes('martialArts')) {
        updatedShiftDataset.shiftUp += 1;
      } else if (martialWeaponMasterWeapon) {
        updatedShiftDataset.shiftDown += 1;
      }
    }

    // Peaceable - see PEACEABLE_ID's own comment above. Stun-only attacks get the bonus; any OTHER
    // real damage type gets the penalty (widened to ↓2 with the Hang-Up) - an attack dealing no
    // damage at all (a null/falsy damageType, e.g. a pure Maneuver effect) gets neither, since it
    // isn't "dealing damage" in either direction.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, PEACEABLE_ID)) {
      if (item.system.damageType == 'stun') {
        updatedShiftDataset.shiftUp += 1;
      } else if (item.system.damageType) {
        updatedShiftDataset.shiftDown += actorHasHangUp(actor, PEACEABLE_HANGUP_ID) ? 2 : 1;
      }
    }

    // Walking Weapon Rack (Factions in Action Vol. 2, Ninja Focus, 20th level, p.15): "you gain an
    // Edge on all melee Attacks with Silent Martial Arts weapons." Same parent-weapon-trait-check
    // shape as Martial Weapon Master just above, requiring both traits together.
    if (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'
      && actorHasPerk(actor, WALKING_WEAPON_RACK_ID)) {
      const walkingWeaponRackWeapon = this._getParentWeapon(actor, item);
      if (walkingWeaponRackWeapon?.system.traits.includes('silent')
        && walkingWeaponRackWeapon.system.traits.includes('martialArts')) {
        skillDataset.edge = true;
      }
    }

    // Empty Hands (Factions in Action Vol. 2, General Perk, p.30): "If you are wielding no
    // weapons in Combat, your unarmed Attacks gain an Edge." Same "no parent weapon" proxy for
    // unarmed as Randori Master/Phantom Ranger Prime's identical shape.
    if (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item) && actorHasPerk(actor, EMPTY_HANDS_ID)) {
      skillDataset.edge = true;
    }

    // Awesome - see AWESOME_MLP_ID's own comment above.
    if (findPerk(actor, AWESOME_MLP_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Spared No Expense - see SPARED_NO_EXPENSE_ID's own comment above.
    if (findPerk(actor, SPARED_NO_EXPENSE_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // City Slicker - see CITY_SLICKER_ID's own comment above.
    if (rolledSkill == 'alertness' && actorHasPerk(actor, CITY_SLICKER_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

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

    // Augment (Skill) - see AUGMENT_SKILL_ID's own comment above. Same choiceType:'skills' + flat
    // shiftUp shape as Awesome just above.
    if (findPerk(actor, AUGMENT_SKILL_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Cutie Mark Perk - see CUTIE_MARK_PERK_ID's own comment above. Same choiceType:'skills' +
    // flat shiftUp shape as Awesome just above.
    if (findPerk(actor, CUTIE_MARK_PERK_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Noble Heritage - see NOBLE_HERITAGE_ID's own comment above. Same choiceType:'skills' + flat
    // shiftUp shape as Cutie Mark Perk just above (the Griffon-Origin equivalent of it).
    if (findPerk(actor, NOBLE_HERITAGE_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Peerless Pilot (GI Joe CRB, p.132) - Driving Skill Test half; see prepareInitiativeRoll's
    // own comment for the Initiative-Edge half and the "Specialized in" approximation both share.
    if (rolledSkill == 'driving' && actorHasPerk(actor, PEERLESS_PILOT_GIJ_ID)
      && this._getPilotedVehicle(actor, 'driver')
      && Object.keys(actor.system.skills.driving?.specializations ?? {}).length > 0) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Superior Athlete (Focus: Blitzer, 10th level, p.98): "You gain an upshift 2 on Athletics
    // tests to jump or climb." "To jump or climb" is dropped as an unenforceable narrower
    // qualifier (this codebase has no sub-classification of an Athletics roll's own purpose) -
    // the same "narrower narrative precondition, unconditional grant instead" idiom Bits To
    // Spare/Truthseeker/Fear My Name already establish. "Jump distance is doubled" stays infra (no
    // jump-distance mechanic anywhere, same gap already documented on Gravity Optional/Power
    // Quake's identical clauses); "Sprint as a Free action once per turn" is an action-economy gap
    // (no Standard/Move/Free budget tracked anywhere).
    if (rolledSkill == 'athletics' && actorHasPerk(actor, SUPERIOR_ATHLETE_ID)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Safecracker (Commando base, 14th level, p.73): "When you interact with [hidden doors,
    // secret compartments, traps, and other concealed devices] (such as by disarming a trap or
    // opening a safe), you gain an upshift 2 shift bonus and leave no proof of your presence."
    // RAW names no specific skill for "interact with" - Infiltration is this system's own
    // established security/trap/lock-bypass skill (the same skill Commando's own Role Skills list
    // and Think Fast's "Deception or Infiltration" substitution already treat as this Role's
    // stealth/security specialty), a documented judgment call rather than a guess, the same class
    // already made for Duty Of The Graphite's "a Social skill" default. "Automatically detect
    // hidden doors/traps" and "leave no proof of your presence" stay unbuilt - the former is a
    // passive auto-success with no roll to intercept, the latter has nothing to track (no
    // GM-detection/suspicion mechanic exists anywhere in this system).
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, SAFECRACKER_ID)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Motor Lancer (Factions in Action Vol. 2, p.64): "↑1 on attacks with hand-held melee weapons
    // while driving or riding in a vehicle." Any crew role, not just driver - see
    // _getPilotedVehicle's own doc comment. Its second clause (a Free action to wield a 2-handed
    // melee weapon 1-handed until end of turn) isn't built - no precedent anywhere in this
    // codebase for a temporary, reversible weapon-handedness change (Weapon Conversion's own
    // numHands edit is explicitly permanent, a one-time build-time conversion).
    if (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'
      && actorHasPerk(actor, MOTOR_LANCER_ID) && this._getPilotedVehicle(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Power Adaptation - Crushing Strength (Across the Stars, Silver Ranger, 9th/18th level,
    // p.57) - see helpers/power-adaptation.mjs's own doc comment. "↑2 to all Athletics and Brawn
    // Skill Tests" while active.
    if ((rolledSkill == 'athletics' || rolledSkill == 'brawn') && isPowerAdaptationActive(actor, 'crushingStrength')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Get Low - see GET_LOW_ID's own comment above. ↑1 Infiltration while in Alt Mode; "that
    // relate to moving quietly and unseen" dropped, same narrative-qualifier-flattening idiom Bits
    // To Spare/Truthseeker already establish.
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, GET_LOW_ID) && actor.system?.isTransformed) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Sprinter (Transformers One) - see TF1S_SPRINTER_ID's own comment above. ↑1 Acrobatics and
    // Athletics while in Bot Mode (NOT Alt Mode - the opposite gate from Get Low's own Perks above).
    if ((rolledSkill == 'acrobatics' || rolledSkill == 'athletics')
      && actorHasPerk(actor, TF1S_SPRINTER_ID) && !actor.system?.isTransformed) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Powerful Grip - see POWERFUL_GRIP_ID's own comment above. ↑1 Brawn while in Bot Mode.
    if (rolledSkill == 'brawn' && actorHasPerk(actor, POWERFUL_GRIP_ID) && !actor.system?.isTransformed) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Stand Together - see STAND_TOGETHER_ID's own comment above. ↑1 on the chosen Skill outside
    // combat, same shape as Specialist's own Edge grant just above.
    if (!game.combat && findPerk(actor, STAND_TOGETHER_ID)?.system.choice == rolledSkill) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Dutiful - see DUTIFUL_ID's own comment above. ↑1 on any Social-essence Skill Test outside
    // combat.
    if (!game.combat && rolledEssence == 'social' && actorHasPerk(actor, DUTIFUL_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Prehensile Feet - see PREHENSILE_FEET_ID's own comment above. ↑1 Acrobatics while in Alt Mode.
    if (rolledSkill == 'acrobatics' && actorHasPerk(actor, PREHENSILE_FEET_ID) && actor.system?.isTransformed) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Monster Morph (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 3rd level) - see
    // helpers/monster-morph.mjs's own doc comment. ↑1 on that Path's own 2-3 named Skills while in
    // Monster Form.
    updatedShiftDataset.shiftUp += getMonsterFormSkillBonus(actor, rolledSkill);

    // Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level) - see
    // helpers/psycho-assault.mjs's own doc comment. ↑1 on any Attack for the rest of the turn it
    // was activated on; the damage half is folded into damageBonusValue below.
    if (item?.type == 'weaponEffect' && isPsychoAssaultActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // On My Own (Finster's Monster-Matic Cookbook, Path of Stone, 2nd level, p.292): "↑1 when you
    // aren't within 10ft of an ally." The inverse of every other proximity-gated shiftUp this
    // project already checks (Two Steps to the Right, etc.) - granted precisely when
    // getNearbyAllyTokens finds nobody at all.
    if (actorHasPerk(actor, ON_MY_OWN_ID) && getNearbyAllyTokens(actor, 10).length == 0) {
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
    // Acrobatics half; see prepareInitiativeRoll's own comment for the Initiative half (Initiative
    // is never rolled through this rollSkill() path in practice).
    if (rolledSkill == 'acrobatics' && isWisdomOfTheEldersActive(actor, 'enhancedReflexes')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Fearsome Reputation (PR CRB, General Perk, p.95): "When using Intimidation while morphed,
    // you gain a upshift-2 die shift." The compendium's own static Active Effect for this clause
    // was mis-authored (an unconditional shiftUp with no Morphed gate, and an odd 1-round
    // duration that doesn't match "while morphed") - left disabled, built here instead as a live
    // check. The "Intimidation is a Social Essence skill for you" clause is a real, correctly
    // authored, already-enabled compendium Active Effect (system.skills.intimidation.essences.social).
    if (rolledSkill == 'intimidation' && actor.system.isMorphed && actorHasPerk(actor, FEARSOME_REPUTATION_ID)) {
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

    // Illusory Disguise (Finster's Monster-Matic Cookbook, Sorcerous Power, p.273) - see
    // helpers/illusory-disguise.mjs's own doc comment. "Edge on Infiltration and Deception Skill
    // Tests relating to the illusion" while active - RAW grants Edge (not a shiftUp, unlike
    // Observer's own identical-shaped clause just above).
    if ((rolledSkill == 'infiltration' || rolledSkill == 'deception') && isIllusoryDisguiseActive(actor)) {
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

    // Sky Warrior - see SKY_WARRIOR_ID's own comment above. Any weaponEffect attack, not scoped
    // to a specific skill or armed/unarmed state.
    if (item?.type == 'weaponEffect' && actorHasPerk(actor, SKY_WARRIOR_ID)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Community Martial Arts - see COMMUNITY_MARTIAL_ARTS_ID's own comment above. Unarmed AND
    // melee-style, unlike Pointy/Sky Warrior's own broader scopes.
    if (item?.type == 'weaponEffect' && item.system.classification.style == 'melee'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, COMMUNITY_MARTIAL_ARTS_ID)) {
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
          sourceId: baseRolePoints.flags?.core?.sourceId ?? baseRolePoints._stats?.compendiumSource,
        };

        // Sneak Attack Damage (GI Joe CRB p.72) is the one damageBonus grant whose fictional
        // trigger conditions are actually known and automatable - see helpers/sneak-attack.mjs.
        // Any other damageBonus Role Points Item (e.g. Power Rangers' Power Strike, My Little
        // Pony's Hard Hitter) still gets the checkbox below, just always starting unchecked like
        // rolePoints/attackUpshift already does above.
        damageRolePoints.isSneakAttack = isSneakAttackDamageItem(baseRolePoints);
        if (damageRolePoints.isSneakAttack) {
          const { eligible, reason } = checkSneakAttackEligibility(actor, item, skillDataset.edge);
          damageRolePoints.autoEligible = eligible;
          damageRolePoints.autoReason = reason;

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

    // Distance Vision (WTNV Citizen's Guide, General Perk, p.50): "The first time you Aim on each
    // of your turns in combat, you gain 2 instead of 1 on a ranged Attack Skill Test." Bumps the
    // base Aiming bonus itself (not a separate checkbox) - only actually marked used below, once
    // the roll is confirmed with isAiming actually checked (the same "the player self-polices
    // whether they aimed" idiom Aiming's own doc comment already establishes - merely being
    // eligible this turn doesn't consume it).
    const distanceVisionApplies = isRangedAttack && actorHasPerk(actor, DISTANCE_VISION_ID)
      && !hasUsedThisTurn(actor, 'distanceVisionUsedThisTurn');
    // Dig In (Enigma of Combination, Cannoneer Focus, 17th level, p.32) - see
    // helpers/cannoneer-dig-in.mjs's own doc comment: "when you spend a Free action to Aim, you
    // gain +2 instead of +1" while dug in. Same "2 instead of 1" upgrade shape as Distance Vision
    // above - the two aren't summed (both describe the SAME base Aiming bonus, not independent
    // additions), so this just widens the same isRangedAttack ? 2 : 1 base check.
    const cannoneerDigInAimApplies = isRangedAttack && actorHasPerk(actor, CANNONEER_DIG_IN_ID) && isCannoneerDugIn(actor);
    // Calculated Attack - see CALCULATED_ATTACK_ID's own comment above. A successful Science vs.
    // Evasion/Cleverness Skill Test (dispatched from a sheet "Use" button) banks this flag; same
    // "widen the base 1-instead-of-2 Aiming bonus" shape as Distance Vision/Cannoneer Dig In just
    // above, scoped to the Long Range Rifle specifically, only actually consumed once isAiming is
    // checked (see below) - merely being eligible doesn't spend the banked success.
    const calculatedAttackApplies = isRangedAttack
      && this._getParentWeapon(actor, item)?.flags?.core?.sourceId == LONG_RANGE_RIFLE_ID
      && !!getPendingBonus(actor, CALCULATED_ATTACK_FLAG);
    updatedShiftDataset.aimBonus = isRangedAttack
      ? (distanceVisionApplies || cannoneerDigInAimApplies || calculatedAttackApplies ? 2 : 1) + this._getLaserSightBonus(actor, item)
      : null;

    // Unshakeable Aim (Finster's Monster-Matic Cookbook, Path of Thorns, 2nd level, p.296): "Take
    // the Aim action and spend 1 Personal Power to gain ↑2 and add the Ballistic Trait to the
    // attack INSTEAD OF the normal Aim benefits." A separate checkbox from the ordinary Aiming
    // toggle above (mutually exclusive in practice - the player self-polices which one the
    // fiction supports, the same "don't check both" idiom Aiming/Precision Aim's own doc comments
    // already establish), since this replaces rather than stacks with the base Aim bonus. The
    // "adds the Ballistic Trait" half is declarative only - nothing else in this codebase reacts
    // to a per-ROLL synthetic trait addition (every existing Ballistic-trait check, e.g.
    // Ballistics Precision, reads the weapon Item's own permanently-stored traits array) - flagged
    // as a real, minor gap rather than silently dropped.
    updatedShiftDataset.unshakeableAimAvailable = isRangedAttack && actorHasPerk(actor, UNSHAKEABLE_AIM_ID)
      && (actor.system.powers?.personal?.value ?? 0) >= 1;

    // Energon Points (p.104-105): a Cybertronian may spend one to gain a 1 shift on any Skill
    // Test. Like Aiming, presented as a Roll Options Dialog toggle rather than standing state;
    // unlike Aiming, spending one actually consumes a real, persisted resource, so the point is
    // only deducted once the roll is confirmed (not if the dialog is cancelled).
    // Boolean(...) rather than plain && - actor.system.canTransform is undefined for actor
    // types that don't define it at all (e.g. some test/mock actors), and `undefined && x`
    // evaluates to undefined rather than false, leaking a non-boolean into the dataset.
    updatedShiftDataset.energonAvailable = Boolean(actor.system.canTransform && actor.system.energon.normal.value > 0);

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

    const skillRollOptions = await this._rollDialog.getSkillRollOptions(updatedShiftDataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return;
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
      }
    }

    if (skillRollOptions.isAiming) {
      skillRollOptions.shiftUp += updatedShiftDataset.aimBonus;
      if (distanceVisionApplies) {
        await markUsedThisTurn(actor, 'distanceVisionUsedThisTurn');
      }

      if (calculatedAttackApplies) {
        await clearPendingBonus(actor, CALCULATED_ATTACK_FLAG);
      }
    }

    // Machinist - see updatedShiftDataset.machinistAvailable's own comment above.
    if (skillRollOptions.applyMachinist) {
      skillRollOptions.edge = true;
    }

    // Bootlicker - see updatedShiftDataset.bootlickerAvailable's own comment above.
    if (skillRollOptions.applyBootlicker) {
      skillRollOptions.shiftUp += 1;
    }

    // Hunter's Prowess - see updatedShiftDataset.huntersProwessAvailable's own comment above.
    if (skillRollOptions.applyHuntersProwess) {
      skillRollOptions.shiftUp += 1;
    }

    // Gutter Champion - see updatedShiftDataset.gutterChampionAvailable's own comment above.
    if (skillRollOptions.applyGutterChampion) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'gutterChampionUsedThisTurn');
    }

    // Beloved - see updatedShiftDataset.belovedAvailable's own comment above.
    if (skillRollOptions.applyBeloved) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'belovedUsedThisTurn');
    }

    // Thrillseeker - see updatedShiftDataset.thrillseekerAvailable's own comment above. The
    // player is voluntarily imposing a Snag on themselves, so this doesn't clear edge - the same
    // "edge == snag cancels out" rule other Snag grants already rely on applies here too.
    if (skillRollOptions.applyThrillseeker) {
      skillRollOptions.snag = true;
      await markUsedThisEncounterCount(actor, THRILLSEEKER_ENCOUNTER_FLAG);
    }

    // Straight Shooter - see updatedShiftDataset.straightShooterAvailable's own comment above.
    if (skillRollOptions.applyStraightShooter) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisTurn(actor, 'straightShooterUsedThisTurn');
    }

    // Unshakeable Aim - see updatedShiftDataset.unshakeableAimAvailable's own comment above.
    if (skillRollOptions.applyUnshakeableAim) {
      skillRollOptions.shiftUp += 2;
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    if (skillRollOptions.spendEnergon) {
      skillRollOptions.shiftUp += 1;
      let newEnergonValue = actor.system.energon.normal.value - 1;

      // Fuel Efficient - see FUEL_EFFICIENT_ID's own comment above.
      if (actorHasPerk(actor, FUEL_EFFICIENT_ID)) {
        const fuelEfficientRoll = await new Roll('1d4').evaluate();
        if (fuelEfficientRoll.total == 4) {
          newEnergonValue += 1;
        }
      }

      await actor.update({ 'system.energon.normal.value': newEnergonValue });
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

    // All I Need is One Shot - see ALL_I_NEED_IS_ONE_SHOT_ID's own comment above. Only the
    // shiftUp half lives here - the damage half is folded into damageBonusValue below, same split
    // as every other checkbox that grants both (see Precision Aim's own comment).
    if (skillRollOptions.applyAllINeedIsOneShot) {
      skillRollOptions.shiftUp += 2;
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
      }
    }

    // How Strange! - see updatedShiftDataset.howStrangeAvailable's own comment above. Same
    // shift-position-delta mechanism as Cunning Plan just above, substituting the actor's own
    // Science skill die instead of a Role's own Cunning die, and free (no cost to deduct).
    if (skillRollOptions.applyHowStrange) {
      const scienceShift = actor.getRollData().skills.science?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const scienceIndex = E20.skillShiftList.indexOf(scienceShift);
      if (currentIndex >= 0 && scienceIndex >= 0) {
        const delta = currentIndex - scienceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
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

    // Wire Work - see updatedShiftDataset.wireWorkAvailable's own comment above. Same
    // shift-position-delta mechanism as How Strange! above, substituting the actor's own
    // Acrobatics skill die.
    if (skillRollOptions.applyWireWork) {
      const acrobaticsShift = actor.getRollData().skills.acrobatics?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const acrobaticsIndex = E20.skillShiftList.indexOf(acrobaticsShift);
      if (currentIndex >= 0 && acrobaticsIndex >= 0) {
        const delta = currentIndex - acrobaticsIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Ambush Predator - see AMBUSH_PREDATOR_ID's own comment above. Same shift-position-delta
    // mechanism as Wire Work just above, substituting the actor's own Survival skill die.
    if (skillRollOptions.applyAmbushPredator) {
      const survivalShift = actor.getRollData().skills.survival?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const survivalIndex = E20.skillShiftList.indexOf(survivalShift);
      if (currentIndex >= 0 && survivalIndex >= 0) {
        const delta = currentIndex - survivalIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Street Smarts - see STREET_SMARTS_ID's own comment above. Same shift-position-delta
    // mechanism as Ambush Predator above, substituting the actor's own Streetwise skill die.
    if (skillRollOptions.applyStreetSmarts) {
      const streetwiseShift = actor.getRollData().skills.streetwise?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const streetwiseIndex = E20.skillShiftList.indexOf(streetwiseShift);
      if (currentIndex >= 0 && streetwiseIndex >= 0) {
        const delta = currentIndex - streetwiseIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Primal Fear - see PRIMAL_FEAR_ID's own comment above. Same mechanism, substituting the
    // actor's own Survival skill die.
    if (skillRollOptions.applyPrimalFear) {
      const survivalShift = actor.getRollData().skills.survival?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const survivalIndex = E20.skillShiftList.indexOf(survivalShift);
      if (currentIndex >= 0 && survivalIndex >= 0) {
        const delta = currentIndex - survivalIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Natural Science - see NATURAL_SCIENCE_ID's own comment above. Bidirectional - substitutes
    // Survival's die when rolling Science, or Science's die when rolling Survival.
    if (skillRollOptions.applyNaturalScienceToSurvival) {
      const survivalShift = actor.getRollData().skills.survival?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const survivalIndex = E20.skillShiftList.indexOf(survivalShift);
      if (currentIndex >= 0 && survivalIndex >= 0) {
        const delta = currentIndex - survivalIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    if (skillRollOptions.applyNaturalScienceToScience) {
      const scienceShift = actor.getRollData().skills.science?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const scienceIndex = E20.skillShiftList.indexOf(scienceShift);
      if (currentIndex >= 0 && scienceIndex >= 0) {
        const delta = currentIndex - scienceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Science Fixes All - see SCIENCE_FIXES_ALL_ID's own comment above. Substitutes the actor's
    // own Science skill die.
    if (skillRollOptions.applyScienceFixesAll) {
      const scienceShift = actor.getRollData().skills.science?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const scienceIndex = E20.skillShiftList.indexOf(scienceShift);
      if (currentIndex >= 0 && scienceIndex >= 0) {
        const delta = currentIndex - scienceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Urban Jungle - see URBAN_JUNGLE_ID's own comment above. Substitutes the actor's own
    // Streetwise skill die.
    if (skillRollOptions.applyUrbanJungle) {
      const streetwiseShift = actor.getRollData().skills.streetwise?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const streetwiseIndex = E20.skillShiftList.indexOf(streetwiseShift);
      if (currentIndex >= 0 && streetwiseIndex >= 0) {
        const delta = currentIndex - streetwiseIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Fear Is Universal - see FEAR_IS_UNIVERSAL_ID's own comment above. Substitutes the actor's
    // own Intimidation skill die, whichever of the 3 covered skills was actually rolled.
    if (skillRollOptions.applyFearIsUniversal) {
      const intimidationShift = actor.getRollData().skills.intimidation?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const intimidationIndex = E20.skillShiftList.indexOf(intimidationShift);
      if (currentIndex >= 0 && intimidationIndex >= 0) {
        const delta = currentIndex - intimidationIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Explosive Engineer - see updatedShiftDataset.explosiveEngineerScienceAvailable's own comment
    // above. Same shift-position-delta mechanism as Wire Work/Ambush Predator above, substituting
    // the actor's own Science skill die.
    if (skillRollOptions.applyExplosiveEngineerScience) {
      const scienceShift = actor.getRollData().skills.science?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const scienceIndex = E20.skillShiftList.indexOf(scienceShift);
      if (currentIndex >= 0 && scienceIndex >= 0) {
        const delta = currentIndex - scienceIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Explosive Engineer - the Technology half of the same choice, mutually exclusive in practice
    // (the player checks whichever is actually better) but not enforced as such in code, the same
    // "checking both nets both benefits" idiom Penetrating Aim's own doc comment already accepts.
    if (skillRollOptions.applyExplosiveEngineerTechnology) {
      const technologyShift = actor.getRollData().skills.technology?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const technologyIndex = E20.skillShiftList.indexOf(technologyShift);
      if (currentIndex >= 0 && technologyIndex >= 0) {
        const delta = currentIndex - technologyIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Brute Force - see BRUTE_FORCE_IAF2_ID's own comment above. Same shift-position-delta
    // mechanism as Ambush Predator/Hesher above, substituting the actor's own Brawn skill die.
    if (skillRollOptions.applyBruteForceIaf2) {
      const brawnShift = actor.getRollData().skills.brawn?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const brawnIndex = E20.skillShiftList.indexOf(brawnShift);
      if (currentIndex >= 0 && brawnIndex >= 0) {
        const delta = currentIndex - brawnIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Roaring Engine - see ROARING_ENGINE_ID's own comment above. Same shift-position-delta
    // mechanism as Brute Force/Ambush Predator/Hesher above, substituting the actor's own Driving
    // skill die.
    if (skillRollOptions.applyRoaringEngine) {
      const drivingShift = actor.getRollData().skills.driving?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const drivingIndex = E20.skillShiftList.indexOf(drivingShift);
      if (currentIndex >= 0 && drivingIndex >= 0) {
        const delta = currentIndex - drivingIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Hesher - see HESHER_ID's own comment above. Same shift-position-delta mechanism as Ambush
    // Predator just above, substituting Performance instead of Survival.
    if (skillRollOptions.applyHesher) {
      const performanceShift = actor.getRollData().skills.performance?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const performanceIndex = E20.skillShiftList.indexOf(performanceShift);
      if (currentIndex >= 0 && performanceIndex >= 0) {
        const delta = currentIndex - performanceIndex;
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

    // Brain Power - see updatedShiftDataset.brainPowerAvailable's own comment above. Same
    // shift-position-delta mechanism as Cunning Plan/How Strange!, substituting the actor's own
    // Technology skill die, free (no cost to deduct).
    if (skillRollOptions.applyBrainPower) {
      const technologyShift = actor.getRollData().skills.technology?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const technologyIndex = E20.skillShiftList.indexOf(technologyShift);
      if (currentIndex >= 0 && technologyIndex >= 0) {
        const delta = currentIndex - technologyIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
    }

    // Seeing the Matrix - see updatedShiftDataset.seeingTheMatrixAvailable's own comment above.
    // Same shift-position-delta mechanism as Brain Power just above, but marks the once-per-scene
    // use spent instead of deducting a cost.
    if (skillRollOptions.applySeeingTheMatrix) {
      const technologyShift = actor.getRollData().skills.technology?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const technologyIndex = E20.skillShiftList.indexOf(technologyShift);
      if (currentIndex >= 0 && technologyIndex >= 0) {
        const delta = currentIndex - technologyIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      await markUsedThisEncounter(actor, SEEING_THE_MATRIX_ENCOUNTER_FLAG);
    }

    // Mightier Than the Sword - see updatedShiftDataset.mightierThanTheSwordAvailable's own
    // comment above. Same shift-position-delta mechanism, substituting the actor's own Streetwise
    // skill die.
    if (skillRollOptions.applyMightierThanTheSword) {
      const streetwiseShift = actor.getRollData().skills.streetwise?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const streetwiseIndex = E20.skillShiftList.indexOf(streetwiseShift);
      if (currentIndex >= 0 && streetwiseIndex >= 0) {
        const delta = currentIndex - streetwiseIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }
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

    // Ambitious - see AMBITIOUS_ID's own comment above. Zeroes the final Snag/shiftDown outright,
    // the same "checkbox wins" shape as Solo Shot/Observer just above.
    if (skillRollOptions.applyAmbitious) {
      skillRollOptions.snag = false;
      skillRollOptions.shiftDown = 0;
      await markUsedThisEncounter(actor, AMBITIOUS_ENCOUNTER_FLAG);
    }

    // Isolated - see ISOLATED_ID's own comment above.
    if (skillRollOptions.applyIsolated) {
      skillRollOptions.shiftUp += 1;
      await markUsedThisEncounter(actor, ISOLATED_ENCOUNTER_FLAG);
    }

    // Technically Correct - see TECHNICALLY_CORRECT_ID's own comment above. Same shift-position-
    // delta mechanism as Roaring Engine, substituting the actor's own Technology skill die.
    if (skillRollOptions.applyTechnicallyCorrect) {
      const technologyShift = actor.getRollData().skills.technology?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const technologyIndex = E20.skillShiftList.indexOf(technologyShift);
      if (currentIndex >= 0 && technologyIndex >= 0) {
        const delta = currentIndex - technologyIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      await markUsedThisEncounter(actor, TECHNICALLY_CORRECT_ENCOUNTER_FLAG);
    }

    // Whip Into Shape - see WHIP_INTO_SHAPE_ID's own comment above. Same shift-position-delta
    // mechanism as Roaring Engine/Technically Correct, substituting the actor's own Intimidation
    // skill die.
    if (skillRollOptions.applyWhipIntoShape) {
      const intimidationShift = actor.getRollData().skills.intimidation?.shift;
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const intimidationIndex = E20.skillShiftList.indexOf(intimidationShift);
      if (currentIndex >= 0 && intimidationIndex >= 0) {
        const delta = currentIndex - intimidationIndex;
        if (delta > 0) {
          skillRollOptions.shiftUp += delta;
        } else if (delta < 0) {
          skillRollOptions.shiftDown += -delta;
        }
      }

      await markUsedThisEncounter(actor, 'whipIntoShapeUsedThisEncounter');
    }

    // "I remember reading about…." - see I_REMEMBER_READING_ABOUT_ID's own comment above.
    if (skillRollOptions.applyIRememberReadingAbout) {
      skillRollOptions.isSpecialized = true;
      await markUsedThisEncounter(actor, I_REMEMBER_READING_ABOUT_ENCOUNTER_FLAG);
    }

    // Charge - see CHARGE_TF_ID's own comment above.
    if (skillRollOptions.applyCharge) {
      skillRollOptions.shiftUp += 1;
    }

    // Disarming Shot - see updatedShiftDataset.disarmingShotAvailable's own comment above.
    if (skillRollOptions.applyDisarmingShot) {
      skillRollOptions.shiftDown += 3;
    }

    // Bump & Run - see BUMP_AND_RUN_ID's own comment above. The Stun-on-Critical-Success half is
    // read back from this same declared checkbox in checkContext.bumpAndRunAttempt below.
    if (skillRollOptions.applyBumpAndRun) {
      skillRollOptions.shiftUp += 1;
    }

    // Terror - see helpers/terror.mjs's own doc comment. Spent now (capped at what was actually
    // available, so a stale/tampered dialog value can never overspend); the matching damage bonus
    // is folded into damageBonusValue below.
    const spentTerror = Math.min(skillRollOptions.spendTerror || 0, updatedShiftDataset.terrorAvailable || 0);
    if (spentTerror > 0) {
      await spendTerror(actor, spentTerror);
    }

    // Demolition Driver - see DEMOLITION_DRIVER_ID's own comment above. Unlike Terror/Supreme
    // Guardian Tech (drawing down a separate banked resource), the "spend" here IS the downshift
    // itself - applied directly to skillRollOptions.shiftDown (same "mutate the dialog's own
    // returned options before _getFinalShift reads them" idiom Charge's applyCharge check already
    // uses), so it actually makes the roll harder, not just a resource cost. The matching damage
    // bonus is folded into damageBonusValue below.
    const spentDemolitionDriver = Math.min(
      skillRollOptions.spendDemolitionDriver || 0, updatedShiftDataset.demolitionDriverAvailable || 0);
    if (spentDemolitionDriver > 0) {
      skillRollOptions.shiftDown += spentDemolitionDriver;
    }

    // Supreme Guardian - see helpers/supreme-guardian.mjs's own doc comment (bullet 2). Same
    // spend-now shape as Terror just above; the matching Energy damage bonus is folded into
    // damageBonusValue below.
    const spentSupremeGuardianTech = Math.min(
      skillRollOptions.spendSupremeGuardianTech || 0, updatedShiftDataset.supremeGuardianTechAvailable || 0,
    );
    if (spentSupremeGuardianTech > 0) {
      await spendSupremeGuardianTech(actor, spentSupremeGuardianTech);
    }

    // Menacing Glare - see MENACING_GLARE_ID's own comment above. isMenacingGlareAttempt is
    // threaded onto checkContext below for _rollSkillHelper's own post-success prompt; only
    // meaningful once updatedShiftDataset.menacingGlareAvailable already confirmed affordability.
    const isMenacingGlareAttempt = !!skillRollOptions.applyMenacingGlare;
    if (isMenacingGlareAttempt) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
    }

    // Combat Stance - see helpers/combat-stance.mjs's own doc comment. Spent now (only ever
    // offered when updatedShiftDataset.combatStanceAvailable already confirmed affordability); the
    // matching damage bonus is folded into damageBonusValue below.
    const combatStanceDamageBonus = skillRollOptions.applyCombatStance ? updatedShiftDataset.combatStanceAvailable : 0;
    if (combatStanceDamageBonus) {
      await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
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

    // Quiet (General Hawk's Personnel Files, Influence Perk, p.171): "You never suffer a Snag on
    // Infiltration Skill Tests." Unlike Eureka!/Eltarian Tech above (a checkbox-gated spend), this
    // is a blanket, unconditional immunity - forces snag off regardless of source (the base
    // untrained-roll default, an automatic combat modifier, or the player's own dialog choice),
    // the same "override the final Edge/Snag choice" idiom those checkboxes already establish, just
    // with no cost and no checkbox to gate it.
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, QUIET_ID)) {
      skillRollOptions.snag = false;
    }

    // Quiet's own Hang-Up: "You suffer a Snag on Intimidation Skill Tests." The mirror-image
    // unconditional vulnerability - forcing snag on here still correctly cancels out to a plain
    // roll if the actor also has a genuine Edge from elsewhere, via _getd20Operand's own
    // edge == snag resolution rule, so no special-case interaction is needed.
    if (rolledSkill == 'intimidation' && actorHasHangUp(actor, QUIET_HANGUP_ID)) {
      skillRollOptions.snag = true;
    }

    // Time Traveler's own Influence Perk - see TIME_TRAVELER_PERK_ID's own comment above. Same
    // unconditional "override the final Edge/Snag choice" idiom Quiet establishes just above, just
    // scoped to whichever skill the player activated via the toggle (helpers/time-traveler.mjs)
    // rather than a fixed skill.
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

    let finalShift = this._getFinalShift(skillRollOptions, initialShift, E20.skillShiftList, rolePoints);

    if (this._handleAutoFail(finalShift, label, actor)) {
      return;
    }

    // Auto success rules let the player choose to roll, which uses the best dice pool
    if (E20.autoSuccessShifts.includes(finalShift)) {
      finalShift = E20.skillRollableShifts[E20.skillRollableShifts.length - 1];
    }

    const canCritD2 = dataset.canCritD2 || skillRollOptions.canCritD2;
    const isSpecialized = dataset.isSpecialized || skillRollOptions.isSpecialized;

    // Technostalgic's own Hang-Up (Quartermaster's Guide to Gear, p.14) - see
    // TECHNOSTALGIC_HANGUP_ID's own comment above. Scoped to the concretely-checkable case (an
    // Attack rolled with a Prototype/Theoretical-tier weapon) rather than RAW's broader "any roll
    // involving [such] gear," which this system has no general "what gear is this roll using"
    // concept to check for a non-weapon Skill Test.
    const technostalgicModifier = (item?.type == 'weaponEffect'
      && ['prototype', 'theoretical'].includes(this._getParentWeapon(actor, item)?.system.totalAvailability)
      && actorHasHangUp(actor, TECHNOSTALGIC_HANGUP_ID)) ? -1 : 0;
    // Biogenetic's own "no longer BioGenetic" half - see BIOGENETIC_ID's own comment above. The
    // Edge half (still BioGenetic) is a skillDataset.edge grant instead, computed earlier.
    const biogeneticModifier = ((rolledSkill == 'infiltration' || rolledSkill == 'persuasion')
      && actorHasPerk(actor, BIOGENETIC_ID) && actor.system?.isTransformed === false) ? 1 : 0;
    // Omega Enhancement's own Charged-Up Mode - see helpers/omega-enhancement.mjs's own doc
    // comment. "+1 to all Skill Tests for one Essence score" - a flat modifier (RAW's own literal
    // "gain 1"), not a shiftUp/Edge, scoped to the whole chosen Essence rather than one skill.
    const chargedUpEssence = getChargedUpEssence(actor);
    const chargedUpModifier = (chargedUpEssence && rolledEssence == chargedUpEssence) ? 1 : 0;
    // Omega Enhancement's own Muscle Mode - "Gain 3 on Brawn Skill Tests..." - same flat-modifier
    // shape as Charged-Up just above, scoped to Brawn specifically.
    const muscleModeModifier = (rolledSkill == 'brawn' && isMuscleModeActive(actor)) ? 3 : 0;
    // actorSkillData.modifier/skillEffectModifierBonus are sometimes stored as strings (e.g.
    // "0") - Number()'d explicitly here so a genuinely negative technostalgicModifier doesn't
    // silently string-concatenate into an unparseable value like "00-1" instead of numeric -1.
    const modifier = Number(actorSkillData.modifier || 0) + Number(skillRollOptions.skillEffectModifierBonus || 0)
      + technostalgicModifier + biogeneticModifier + chargedUpModifier + muscleModeModifier;

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
    const rollsThreeD20 = item?.type == 'weaponEffect' && item.system.classification.style != 'melee'
      && skillRollOptions.edge && actorHasPerk(actor, KILL_SHOT_ID)
      && this._getParentWeapon(actor, item)?.system.traits.includes('sniper');

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

    let formula = this._getFormula(
      isSpecialized, skillRollOptions, finalShift, Number(modifier), floorD20At10, rollsThreeD20, flatD20Value, flatBothD20s,
    );

    // Inspiration (White Ranger) - see _getAutomaticCombatModifiers's own comment. Appended
    // straight onto the formula string (a whole extra rolled die), not folded into shiftUp/edge
    // like every other combatModifiers field, since it isn't a skill-die-selection change.
    if (combatModifiers.bonusDie) {
      formula += ` + ${combatModifiers.bonusDie}`;
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
    // two clauses (the first, ignoring cover, lives in _getAutomaticCombatModifiers's own shift
    // instead, since that's a roll shift, not target Defense math). Only ever subtracted against
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
        const deflectiveReduction = isPenetratingRoundsAttack && skillRollOptions.defenseType == 'toughness'
          ? this._getDeflectiveArmorToughness(token.actor)
          : 0;

        // Penetrating Aim (Raider, Siegemaster Focus, 1st level, p.63) - see PENETRATING_AIM_ID's
        // own comment above. Only meaningful against Toughness - RAW's own "armor Defense bonus"
        // is this system's Toughness-specific armor component (the same Defense Driving Strike's
        // deflective-armor reduction just above is scoped to, for the identical reason).
        const penetratingAimIgnorePoints = skillRollOptions.applyPenetratingAim
          && skillRollOptions.defenseType == 'toughness' && actorHasPerk(actor, PENETRATING_AIM_ID)
          ? 1 : 0;

        // Metallikato - see METALLIKATO_ID's own comment above. "Up to your Smarts Essence in
        // armor bonuses" - the cap is the actor's own Smarts Essence SCORE (system.essences.smarts),
        // not a shift or a flat point count, same Toughness-only scoping Penetrating Aim's
        // identical "armor Defense bonus" wording already established just above.
        const metallikatoIgnorePoints = skillRollOptions.applyMetallikatoIgnoreArmor
          && skillRollOptions.defenseType == 'toughness' && actorHasPerk(actor, METALLIKATO_ID)
          ? (actor.system.essences?.smarts?.value ?? 0) : 0;

        let difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, {
          ignoreArmor: drivingStrikeIgnoreArmor,
          ignoreArmorPoints: penetratingAimIgnorePoints + metallikatoIgnorePoints,
        })
          + getShieldUpgradeBonus(token.actor, skillRollOptions.defenseType)
          - deflectiveReduction;

        // Ground Suppression - see helpers/ground-suppression.mjs's own doc comment. The first
        // target-difficulty modifier in this project to SUBTRACT rather than add - benefits ANY
        // attacker comparing against the marked target's Toughness/Evasion, not just the caster.
        if (['toughness', 'evasion'].includes(skillRollOptions.defenseType)) {
          difficulty -= getGroundSuppressionReduction(token.actor);
        }

        // Psychological Warfare - see PSYCHOLOGICAL_WARFARE_ID's own comment above.
        if (
          ['willpower', 'cleverness'].includes(skillRollOptions.defenseType)
          && actorHasPerk(token.actor, PSYCHOLOGICAL_WARFARE_ID)
        ) {
          const evasionDifficulty = getDefenseValue(token.actor, 'evasion', {
            ignoreArmor: drivingStrikeIgnoreArmor,
          }) + getShieldUpgradeBonus(token.actor, 'evasion');
          difficulty = Math.max(difficulty, evasionDifficulty);
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

        if (skillRollOptions.defenseType == 'toughness' && !targetHasArmorEquipped
          && actorHasPerk(token.actor, BULKED_UP_FRAME_ID)) {
          difficulty += getSkillRanks(token.actor, 'brawn');
        }

        if (skillRollOptions.defenseType == 'evasion') {
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
          ?? drillingShotWeapon?._stats?.compendiumSource;
        if (drillingShotWeaponSourceId == LONG_RANGE_RIFLE_ID && actorHasPerk(actor, DRILLING_SHOT_ID)) {
          difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, { ignoreArmor: true });
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

        // Omega Enhancement's own Electro Mode - see helpers/omega-enhancement.mjs's own doc
        // comment. "A Targeting Attack that ignores armor" - keeps whatever Defense the dialog's
        // dropdown was set to (Evasion, per activateOmegaEnhancement's own synthetic dataset),
        // unlike Quantum Cut/Drilling Shot above which also force a specific Defense.
        if (dataset.omegaEnhancementMode == 'electro') {
          difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, { ignoreArmor: true });
        }

        // Over the Candlestick - Agile Reflexes (Technorganic Secrets, Climber/Nimble Origin
        // Benefit, p.38) - see OVER_THE_CANDLESTICK_ID's own comment above. "Once per Scene, when
        // an attack targets your Toughness, you may use Evasion instead." No live reaction prompt
        // exists for the TARGET at this point in the flow (the same reaction/interrupt gap this
        // project already tracks broadly), so "you may" is approximated as "you always do, since
        // it can only help" - the same "automatically exercised" idiom Supreme Guardian's own
        // "you may roll" clause already uses - swapping in the target's own Evasion Defense
        // whenever it's actually being compared against Toughness, once per scene.
        if (skillRollOptions.defenseType == 'toughness'
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
          difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, { ignoreArmor: true });
        }

        // Exploit Weakness (PR CRB, Yellow Ranger, 7th level, p.57) - see
        // helpers/exploit-weakness.mjs's own doc comment. "You and your teammates may ignore one
        // of the target's defense bonuses" while marked - team-wide (any roller, not just whoever
        // marked it), same ignoreArmor recompute shape as Drilling Shot/Quantum Cut/Penetrating
        // Strikes above.
        if (isExploitWeaknessMarked(token.actor)) {
          difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, { ignoreArmor: true });
        }

        // Stronger Together (Strategist Focus, 20th level, p.68): "you gain +1 to your Defenses
        // for every ally within 60ft." The target's own passive bonus, added the same way Shield
        // Upgrade's own per-target Defense bonus already is - the Free-action "give 1 to an ally"
        // half isn't built (redistributing the bonus needs its own UI, out of scope for this
        // pass).
        if (actorHasPerk(token.actor, STRONGER_TOGETHER_ID)) {
          difficulty += getNearbyAllyTokens(token.actor, 60).length;
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
        difficulty += getDefensiveFlexibilityDefenseBonus(token.actor, skillRollOptions.defenseType);

        // Mysterious Aura - see helpers/mysterious-aura.mjs's own doc comment. Imposing (a
        // reciprocal enemy-side penalty) and Protective (an ally-side bonus, self included), same
        // "add to the fully-computed difficulty" shape as the checks just above.
        difficulty += getMysteriousAuraImposingPenalty(token.actor, skillRollOptions.defenseType);
        difficulty += getMysteriousAuraProtectiveBonus(token.actor, skillRollOptions.defenseType);

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
        // can't be conditioned on the toggle, so it stays disabled and this live check is the real
        // mechanism. "Whenever you spend an Adaptation Point to gain an environmental benefit
        // outside of your environment of expertise, you gain this bonus until the beginning of
        // your next turn" isn't built - a narrower edge-case clause layered on top of Guidance's
        // own Adaptation Point spend, not the base case this pass covers.
        if (actorHasPerk(token.actor, ENVIRONMENTAL_ARMOR_ID) && hasActiveEnvironmentalExpertise(token.actor)) {
          difficulty += 1;
        }

        // Heroic Intervention - see HEROIC_INTERVENTION_ID's own doc comment above.
        if (actorHasPerk(token.actor, HEROIC_INTERVENTION_ID) && getNearbyAllyTokens(token.actor, 5).length > 0) {
          difficulty += 1;
        }

        // Trustworthy (Honesty, 2nd level, p.78) - the target-side half: "your Cleverness Defense
        // is considered 4 points higher when resisting uses of Deception from others." The other
        // half ("you automatically fail Deception Skill Tests" yourself) lives just below, in this
        // same loop's own difficulty-vs-Infinity idiom Just the Facts already established, since
        // it's about the ROLLER holding the Perk, not the target.
        if (rolledSkill == 'deception' && skillRollOptions.defenseType == 'cleverness'
          && actorHasPerk(token.actor, TRUSTWORTHY_ID)) {
          difficulty += 4;
        }

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
        if (await consumeRollWithThePunches(token.actor, skillRollOptions.defenseType)) {
          difficulty *= 2;
        }

        // Hard Target (Pink Ranger, 2nd level, p.50) - see consumeHardTarget's own doc comment.
        difficulty += await consumeHardTarget(token.actor, skillRollOptions.defenseType);

        // Resilience (Across the Stars, Gold Ranger, 11th level, p.53) - see consumeResilience's
        // own doc comment.
        difficulty += await consumeResilience(token.actor, skillRollOptions.defenseType);

        // Momentary Blur (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45) - see
        // consumeMomentaryBlur's own doc comment.
        difficulty += await consumeMomentaryBlur(token.actor, skillRollOptions.defenseType);

        // Grid Surge - Toughness Boost (Silver Ranger, 2nd level, p.57) - see
        // consumeGridSurgeToughness's own doc comment.
        difficulty += await consumeGridSurgeToughness(token.actor, skillRollOptions.defenseType);

        // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
        // helpers/phantom-suite.mjs's own doc comment for why this is a live, non-consumed read
        // (unlike every other banked bonus in this loop) - it applies to every Evasion-compared
        // attack for as long as the toggle stays on, not just the next one.
        if (isPhantomSuiteActive(token.actor)
          && (skillRollOptions.defenseType == 'evasion'
            || (skillRollOptions.defenseType == 'toughness' && hasPhantomFocusOption(token.actor, 'phaseDefense')))) {
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
        if (skillRollOptions.defenseType == 'toughness') {
          difficulty += getPoweredPlatingBonus(token.actor);
          // Monster Morph (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 3rd level) - see
          // helpers/monster-morph.mjs's own doc comment for why this is a live, non-consumed read
          // rather than a written system.defenses.toughness.bonus.
          difficulty += getMonsterFormToughnessBonus(token.actor);
        }

        // Grow! (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 10th level) - see
        // helpers/monster-morph.mjs's own doc comment. +2 to BOTH Toughness and Evasion while
        // active, the same live, non-consumed shape as Monster Morph's own Toughness bonus above.
        if (skillRollOptions.defenseType == 'toughness' || skillRollOptions.defenseType == 'evasion') {
          difficulty += getGrowDefenseBonus(token.actor);

          // Nemesis Drain - see helpers/nemesis-drain.mjs's own doc comment. -1 to BOTH Toughness
          // and Evasion (approximating "any Defenses that gained a bonus from It's Morphin Time!
          // armor") for a previously-hit target, same live, non-consumed shape as Grow's own bonus
          // just above (negative instead of positive).
          difficulty += getNemesisDrainPenalty(token.actor);

          // Meat Shield - see helpers/meat-shield.mjs's own doc comment. +to BOTH Toughness and
          // Evasion (whichever of the temp/permanent halves is larger), same live, non-consumed
          // shape as Grow's own bonus above.
          difficulty += getMeatShieldBonus(token.actor);
        }

        // Skier - see SKIER_ID's own comment above. Same "flag alone isn't enough" defense-in-depth
        // check documents/actor.mjs's own Ground Movement half already uses.
        if (skillRollOptions.defenseType == 'evasion' && actorHasPerk(token.actor, SKIER_ID) && isSkiing(token.actor)) {
          difficulty += 1;
        }

        // Lightshield Armor (Through the Shattered Grid, Guardian of Eltar, Wisdom of the Elders
        // option, p.72): "+2 to Toughness" while active - same live, non-consumed shape as
        // Powered Plating's own Toughness bonus just above (can't touch _prepareDefenses).
        if (skillRollOptions.defenseType == 'toughness' && isWisdomOfTheEldersActive(token.actor, 'lightshieldArmor')) {
          difficulty += 2;
        }

        // Protection (Quartermaster's Guide to Gear, Grid Power, p.94) - see
        // helpers/protection.mjs's own doc comment. Same live, non-consumed shape as Lightshield
        // Armor/Powered Plating just above - the base +1 is a permanent compendium Active Effect,
        // this is only the optional scene-boost's own extra +1.
        if (skillRollOptions.defenseType == 'toughness') {
          difficulty += getProtectionBoostBonus(token.actor);
        }

        // Zeo Crystal Boost, Morpher option (Across the Stars, Grid Power, p.73) - see
        // helpers/zeo-crystal-boost.mjs's own doc comment. "+1 to all Defenses" - unlike Powered
        // Plating/Lightshield Armor above (Toughness-only), this applies regardless of
        // skillRollOptions.defenseType, same live non-consumed shape otherwise.
        // Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272) - see
        // helpers/bolster-defense.mjs's own doc comment. Same live, non-consumed shape as
        // Zeo Crystal Boost's own "all Defenses" option just below/above, but can also be scoped
        // to one specific Defense instead.
        difficulty += getBolsterDefenseBonus(token.actor, skillRollOptions.defenseType);

        // Roar! (Ferocious Fighters, Tiger Force Faction Perk) - see helpers/roar.mjs's own doc
        // comment. Same live, non-consumed single-Defense shape as Lightshield Armor/Bolster
        // Defense above, self-only.
        difficulty += getRoarDefenseBonus(token.actor, skillRollOptions.defenseType);

        // Jury Rig - Align Suspension / Harden Armor (Factions in Action Vol. 2, Engineer Troop
        // Focus, 17th level, p.73) - see helpers/jury-rig.mjs's own doc comment. Same live,
        // non-consumed Defense-bonus shape as Bolster Defense just above.
        difficulty += getJuryRigDefenseBonus(token.actor, skillRollOptions.defenseType);

        // Like Water (Factions in Action Vol. 2, General Perk, p.30) - see helpers/like-water.mjs's
        // own doc comment. Same live, non-consumed Defense-bonus shape as Bolster Defense/Jury Rig
        // just above, activated once per Combat instead of via a triggered roll.
        difficulty += getLikeWaterDefenseBonus(token.actor, skillRollOptions.defenseType);

        // Not On My Watch (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
        // helpers/not-on-my-watch.mjs's own doc comment. A passive, always-live check (no
        // activation at all) rather than a banked/toggled state like Like Water just above.
        if (actorHasPerk(token.actor, NOT_ON_MY_WATCH_ID)) {
          difficulty += getNotOnMyWatchDefenseBonus(token.actor, skillRollOptions.defenseType);
        }

        if (getZeoCrystalBoostOption(token.actor) == 'morpher') {
          difficulty += 1;
        }

        // Unseen Strike - see UNSEEN_STRIKE_ID's own comment above. Applied last, against the
        // fully-computed difficulty (including the target's own Phantom Suite bonus just above,
        // Shield Upgrade, banked bonuses, etc.) - "the target's Evasion Defense is halved" reads
        // most naturally as the one final number this attack is actually compared against.
        if (isUnseenStrikeAttempt && skillRollOptions.defenseType == 'evasion') {
          difficulty = Math.ceil(difficulty / 2);
        }

        return {
          name: token.actor.name,
          targetUuid: token.actor.uuid,
          difficulty,
          willpowerDifficulty: isTriggerHappyAttack ? getDefenseValue(token.actor, 'willpower') : null,
          toughnessDifficulty: isExplosiveAftershockAttack ? getDefenseValue(token.actor, 'toughness') : null,
        };
      }));
    } else if (dataset.dif) {
      checkEntries = [{ name: actor.name, targetUuid: null, difficulty: parseInt(dataset.dif) }];
    }

    // Warfighter (Infantry base, 17th level): "your attacks with a Targeting weapon deal +2
    // damage." Unconditional - no fictional trigger to confirm like Sneak Attack, so it just
    // folds straight into damageBonusValue below rather than needing its own dialog checkbox.
    const warfighterDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && item.system.classification.skill == 'targeting' && actorHasPerk(actor, WARFIGHTER_ID)
      ? 2 : 0;

    // Weak Point (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 10th level, p.24):
    // "your attacks with a blade or bludgeon deal +1 damage. Your melee attacks also gain both
    // the Anti-Tank and Armor Piercing traits." Only the damage half is built - the trait grants
    // are confirmed infra-blocked (E20.weaponTraits.antiTank/armorPiercing are config labels only,
    // never read by any code anywhere in this system). Same "a piece of equipment"/"blade or
    // bludgeon" proxies as Ripple Effect above.
    const weakPointDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && ['blunt', 'sharp'].includes(item.system.damageType) && actorHasPerk(actor, WEAK_POINT_ID)
      && game.user.targets.first()?.actor?.type == 'vehicle'
      ? 1 : 0;

    // Bear Hug (Factions in Action Vol. 2, General Perk, p.94): "When you Grapple a creature, they
    // suffer 1 Blunt damage." Grapple attacks are a real, existing damageType
    // (E20.damageTypes.grapple, always damageValue 0 - see e.g. Grappling Hook Effect) rather than
    // dealing normal damage, so this both adds +1 to damageBonusValue AND overrides the attack's
    // own damageType to Blunt for this hit specifically (see overriddenDamageType below) - a flat
    // damageBonusValue alone would have landed as 0+1 "grapple" damage, not the Blunt type RAW
    // actually names (which matters for anything Resistant to Blunt specifically).
    const bearHugDamageBonus = item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
      && actorHasPerk(actor, BEAR_HUG_ID)
      ? 1 : 0;

    // Jury Rig - Jacket Ammunition (Factions in Action Vol. 2, Engineer Troop Focus, 17th level,
    // p.73) - see helpers/jury-rig.mjs's own doc comment. "+1 damage on one of the vehicle's
    // Attacks" is simplified to any of the vehicle's Attacks while the benefit is active (see the
    // helper's own comment for why) - checked against `actor` (the vehicle rolling the attack),
    // not the Engineer who granted it.
    const jacketAmmunitionDamageBonus = item?.type == 'weaponEffect'
      && isJuryRigBenefitActive(actor, 'jacketAmmunition')
      ? 1 : 0;

    // Throw Your Weight Around (Factions in Action Vol. 2, Dreadnok General Perk, p.64) - see
    // THROW_YOUR_WEIGHT_AROUND_ID's own comment above. Compares against whichever token is
    // currently targeted (the same "first target" simplification Spite/Menacing Glare's own
    // single-target-scoped effects already use) - a real multi-target attack could hit differently
    // -sized targets, but damageBonusValue is a single number applied uniformly to every hit
    // regardless, the same limitation every other damage-bonus check in this file already has.
    const throwYourWeightAroundTarget = game.user.targets.first()?.actor;
    const throwYourWeightAroundDamageBonus = item?.type == 'weaponEffect'
      && item.system.classification?.style == 'melee' && actorHasPerk(actor, THROW_YOUR_WEIGHT_AROUND_ID)
      && throwYourWeightAroundTarget
      && Object.keys(E20.actorSizes).indexOf(actor.system.size) > Object.keys(E20.actorSizes).indexOf(throwYourWeightAroundTarget.system.size)
      ? 1 : 0;

    // Roaming the Land (Ferocious Fighters, Mega Monsters Faction Perk, p.75) - see
    // E20.roamingTheLandOptions' own doc comment. "Smaller Creatures" damage half only - the
    // "larger creatures" Stun half is applied post-hit instead (see checkContext.roamingTheLandStun
    // below), since Stun isn't expressible as a plain damageValue add for a non-Stun weapon.
    const roamingTheLandTarget = game.user.targets.first()?.actor;
    const roamingTheLandPerk = findPerk(actor, ROAMING_THE_LAND_ID);
    const roamingTheLandDamageBonus = item?.type == 'weaponEffect'
      && item.system.classification?.style == 'melee' && roamingTheLandPerk?.system.choice == 'smallerDamage'
      && roamingTheLandTarget
      && Object.keys(E20.actorSizes).indexOf(actor.system.size) > Object.keys(E20.actorSizes).indexOf(roamingTheLandTarget.system.size)
      ? 1 : 0;

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
      await bankPendingBonus(actor, 'pendingFleetingEnergy', { shiftDown: 1 });
    }

    // Ranger Prime capstones (20th level, PR CRB) - see PRIME_DAMAGE_BONUS_PERKS' own doc comment
    // above for which Primes this covers and why the other 3 aren't here. "Your Morphed form
    // immediately gains" scopes every Prime clause to Morphed, same as the Defense/Edge halves'
    // own .morphed-suffixed Active Effect keys.
    let primeDamageBonusPerkId = null;
    if (checkEntries && item?.type == 'weaponEffect' && actor.system.isMorphed) {
      const weapon = this._getParentWeapon(actor, item);
      for (const [perkId, match] of Object.entries(PRIME_DAMAGE_BONUS_PERKS)) {
        const matches = match.skill
          ? item.system.classification.skill == match.skill
          : !!weapon?.system.traits.includes(match.trait);
        if (matches && actorHasPerk(actor, perkId)) {
          primeDamageBonusPerkId = perkId;
          break;
        }
      }
    }

    const primeDamageBonus = primeDamageBonusPerkId ? 1 : 0;

    // White Ranger Prime (20th level, p.63) - "+1 damage on Zord (non-Megaform) Attacks." Unlike
    // every other Prime capstone above, the roller here is the ZORD itself, not the White Ranger
    // holder - Zords roll their own weaponEffect attacks as their own actor (the same way a
    // Vehicle does; see _isHeavyOrdnanceAttack's own doc comment), so this resolves the Zord's own
    // PILOT via the generic system.actors/vehicleRole crew mechanism (_getVehicleDriver is
    // actor-type-agnostic and already works correctly for a Zord's crew, not just a Vehicle's -
    // confirmed via templates/actor/parts/main/zord-passengers.hbs and drop-handler.mjs's own
    // 'zord' drop case, which already seat a PC into system.actors exactly like a Vehicle does)
    // rather than the roller's own items, and gates on the PILOT's own Morphed state (not the
    // Zord's - Zords have no isMorphed field) to match "Your Morphed form immediately gains" in
    // every other Prime's own wording.
    const whiteRangerPrimePilot = checkEntries && item?.type == 'weaponEffect' && actor?.type == 'zord'
      ? this._getVehicleDriver(actor)
      : null;
    const whiteRangerPrimeDamageBonus = whiteRangerPrimePilot?.system.isMorphed
      && actorHasPerk(whiteRangerPrimePilot, WHITE_RANGER_PRIME_ID)
      ? 1 : 0;

    // Every Perk/Role Points item actually contributing to damageBonusValue below, so the check
    // card can tell the player what's granting the bonus damage they're about to apply - same
    // reasoning as the reroll button's own source label (chat.mjs#addRerollButtons). A Set, not
    // an array, since Warfighter and a damageBonus Role Points item are independent grants that
    // could otherwise land the same name twice (in practice they never share one, but nothing
    // stops it structurally).
    const damageBonusSources = new Set();
    if (warfighterDamageBonus) {
      damageBonusSources.add(findPerk(actor, WARFIGHTER_ID)?.name ?? 'Warfighter');
    }

    // Acid / Fire (Damage Types): "deal an extra point of damage when they hit a target that
    // defended with Toughness/Evasion" respectively - a core rule of each damage type itself, not
    // gated behind any Perk. Checked against skillRollOptions.defenseType (the Defense actually
    // being rolled against - the weaponEffect's own configured default, or a manual override from
    // the Roll Options Dialog), not item.system.defenseType, since RAW cares about which Defense
    // the target actually defended with on THIS attack.
    const acidDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && item.system.damageType == 'acid' && skillRollOptions.defenseType == 'toughness'
      ? 1 : 0;
    if (acidDamageBonus) {
      damageBonusSources.add(this._localize(E20.damageTypes.acid));
    }

    const fireDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && item.system.damageType == 'fire' && skillRollOptions.defenseType == 'evasion'
      ? 1 : 0;
    if (fireDamageBonus) {
      damageBonusSources.add(this._localize(E20.damageTypes.fire));
    }

    // Station Management (WTNV Citizen's Guide, General Perk, p.51, Intern Origin prereq):
    // "+2 Cleverness [already a compendium Active Effect] and deal 1 additional damage on attacks
    // that target an enemy's Cleverness." Same "checked against skillRollOptions.defenseType"
    // shape as Acid/Fire above, just Perk-gated instead of damage-type-gated.
    // Viral News Bloggers (WTNV Citizen's Guide, Journalist Role, Print Focus, p.38): "When you
    // attack a piece of machinery or non-organic opponent, you gain an Edge on the Skill Test and
    // deal 1 additional damage." "Non-organic" is approximated as `targetActor.type == 'vehicle'`,
    // the same proxy Plate Piercing/Raze and Ruin already use for "an object" - this system has no
    // separate "machine"/"non-organic" actor type. The Edge half lives in
    // _getAutomaticCombatModifiers's own reciprocal target-status block (it must be known before
    // the dialog opens); this is just the damage half, same shape as Station Management/The
    // Weather above.
    const viralNewsBloggerTarget = item?.type == 'weaponEffect' ? game.user.targets.first()?.actor : null;
    const viralNewsBloggersDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && viralNewsBloggerTarget?.type == 'vehicle' && actorHasPerk(actor, VIRAL_NEWS_BLOGGERS_ID)
      ? 1 : 0;
    if (viralNewsBloggersDamageBonus) {
      damageBonusSources.add(findPerk(actor, VIRAL_NEWS_BLOGGERS_ID)?.name ?? 'Viral News Bloggers');
    }

    // Razor Tongue (Transformers CRB, General Perk, p.111) - see RAZOR_TONGUE_ID's own comment
    // above. Textually the same "+1 damage on an attack that successfully targets Cleverness"
    // clause as Station Management (a distinct compendium item, different book) - same check,
    // either Perk grants it.
    const stationManagementDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && skillRollOptions.defenseType == 'cleverness'
      && (actorHasPerk(actor, STATION_MANAGEMENT_ID) || actorHasPerk(actor, RAZOR_TONGUE_ID))
      ? 1 : 0;
    if (stationManagementDamageBonus) {
      damageBonusSources.add(
        findPerk(actor, STATION_MANAGEMENT_ID)?.name ?? findPerk(actor, RAZOR_TONGUE_ID)?.name ?? 'Station Management',
      );
    }

    // The Weather (WTNV Citizen's Guide, General Perk, p.52, Smarts 3+ prereq): "+2 Willpower and
    // +1 Health [both already compendium Active Effects], and deal 1 additional damage on attacks
    // that successfully target an enemy's Willpower." Same shape as Station Management above.
    const theWeatherDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && skillRollOptions.defenseType == 'willpower' && actorHasPerk(actor, THE_WEATHER_ID)
      ? 1 : 0;
    if (theWeatherDamageBonus) {
      damageBonusSources.add(findPerk(actor, THE_WEATHER_ID)?.name ?? 'The Weather');
    }

    // Environmental Assist (Beneath the Helmet, Aqua Ranger, Grid Science II choice, p.42) - see
    // team-buffs.mjs's own doc comment. Banked (not a standing Perk check) since it's granted by
    // someone else's "Use" click and applies "until the start of your next turn" - the same
    // bank-now/consume-on-next-matching-roll idiom Ageless Knowledge's own pendingAgelessKnowledge
    // check above already uses, just folded into the damage total instead of the shift.
    const pendingEnvironmentalAssist = getPendingBonus(actor, PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY);
    const environmentalAssistDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && pendingEnvironmentalAssist ? 1 : 0;
    if (environmentalAssistDamageBonus) {
      // The receiving ally rarely holds the Perk item themselves (it's granted by whoever used
      // it), so there's no findPerk(actor, ...) lookup to fall back on here, unlike Warfighter/
      // Terror/etc above - just a plain display name.
      damageBonusSources.add('Environmental Assist');
      await clearPendingBonus(actor, PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY);
    }

    // Power Strike (PR CRB, Grid Power, p.100) - see helpers/grid-power-strike.mjs's own doc
    // comment. Banked at activation (a separate click from the attack itself), consumed on the
    // actor's own next Power-Weapon weaponEffect attack, hit or miss - the weapon-trait check
    // enforces RAW's own "while wielding your summoned Power weapon" gate at consumption time.
    const pendingGridPowerStrike = getPendingBonus(actor, PENDING_GRID_POWER_STRIKE_FLAG_KEY);
    const gridPowerStrikeWeapon = checkEntries && item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const gridPowerStrikeDamageBonus = pendingGridPowerStrike && gridPowerStrikeWeapon?.system.traits.includes('powerWeapon')
      ? pendingGridPowerStrike.damageBonus : 0;
    if (gridPowerStrikeDamageBonus) {
      damageBonusSources.add('Power Strike');
      await clearPendingBonus(actor, PENDING_GRID_POWER_STRIKE_FLAG_KEY);
    }

    if (primeDamageBonusPerkId) {
      damageBonusSources.add(findPerk(actor, primeDamageBonusPerkId)?.name ?? 'Ranger Prime');
    }

    // Silver Ranger Prime (Across the Stars, 20th level, p.57): "deal an additional point of
    // damage on all Attacks in the first round of a combat scene." Its "+2 all Defenses" bullet
    // is already a compendium Active Effect; the reciprocal "enemies suffer Snag attacking your
    // Willpower Defense" bullet lives in _getAutomaticCombatModifiers's own per-target loop
    // instead (a roll modifier, not a damage bonus).
    const silverRangerPrimeDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && game.combat?.round == 1 && actorHasPerk(actor, SILVER_RANGER_PRIME_ID)
      ? 1 : 0;
    if (silverRangerPrimeDamageBonus) {
      damageBonusSources.add(findPerk(actor, SILVER_RANGER_PRIME_ID)?.name ?? 'Silver Ranger Prime');
    }

    // Power Boost (Silver Ranger, 3rd/10th/17th level, p.57) / Brute Force (Beneath the Helmet,
    // Graphite Ranger, 3rd/10th/17th level, p.47 - a Role-reprint swap of Power Boost, sharing its
    // exact toggle - see helpers/power-boost.mjs's own doc comment) - only applies while active
    // and attacking with a powerWeapon-trait weapon, same trait check Red Ranger Prime's identical
    // clause already uses; the bonus amount scales with the Perk's own tracked
    // advances.currentValue (1/2/3 by level). A given actor only ever has one of the two.
    const powerBoostPerk = checkEntries && item?.type == 'weaponEffect' && isPowerBoostActive(actor)
      ? (findPerk(actor, POWER_BOOST_ID) ?? findPerk(actor, BRUTE_FORCE_ID)) : null;
    const powerBoostDamageBonus = powerBoostPerk
      && !!this._getParentWeapon(actor, item)?.system.traits.includes('powerWeapon')
      ? (powerBoostPerk.system.advances?.currentValue || 1) : 0;
    if (powerBoostDamageBonus) {
      damageBonusSources.add(powerBoostPerk.name);
    }

    // Zeo Crystal Boost, Power Weapon option (Across the Stars, Grid Power, p.73): "+1 Energy
    // damage with each strike" - same powerWeapon-trait check as Power Boost/Red Ranger Prime just
    // above.
    const zeoCrystalBoostDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && getZeoCrystalBoostOption(actor) == 'weapon'
      && !!this._getParentWeapon(actor, item)?.system.traits.includes('powerWeapon') ? 1 : 0;
    if (zeoCrystalBoostDamageBonus) {
      damageBonusSources.add('Zeo Crystal Boost');
    }

    if (spentTerror) {
      damageBonusSources.add(findPerk(actor, TERROR_ID)?.name ?? 'Terror');
    }

    // Demolition Driver - the Perk is held by the vehicle's DRIVER, not the vehicle itself (the
    // roller here) - same "re-resolve via _getVehicleDriver" shape _isDemolitionDriverAttack
    // already used to grant this in the first place.
    if (spentDemolitionDriver) {
      const demolitionDriverPilot = this._getVehicleDriver(actor);
      damageBonusSources.add(findPerk(demolitionDriverPilot, DEMOLITION_DRIVER_ID)?.name ?? 'Demolition Driver');
    }

    if (spentSupremeGuardianTech) {
      damageBonusSources.add(findPerk(actor, SUPREME_GUARDIAN_ID)?.name ?? 'Supreme Guardian');
    }

    if (combatStanceDamageBonus) {
      damageBonusSources.add(findPerk(actor, COMBAT_STANCE_ID)?.name ?? 'Combat Stance');
    }

    // Ultimate Magna Defender (Through the Shattered Grid, Magna Defender, 20th level, p.25): "An
    // additional point of damage on all your melee Attacks, including the ones you make in Mega
    // Defender form and while forming the Defender Torozord." Only the base-form case is built -
    // Mega Defender/Defender Torozord don't exist yet (the Zord-piloting gap). Its own "+2 all
    // Defenses" and "Edge on Strength" bullets are already compendium Active Effects.
    const ultimateMagnaDefenderDamageBonus = checkEntries && isMeleeWeaponEffect
      && actorHasPerk(actor, ULTIMATE_MAGNA_DEFENDER_ID) ? 1 : 0;
    if (ultimateMagnaDefenderDamageBonus) {
      damageBonusSources.add(findPerk(actor, ULTIMATE_MAGNA_DEFENDER_ID)?.name ?? 'Ultimate Magna Defender');
    }

    // Grow! (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 10th level) - see
    // helpers/monster-morph.mjs's own doc comment. +1 damage to ALL attacks while active (not
    // scoped to melee, unlike Ultimate Magna Defender above).
    const growDamageBonus = checkEntries ? getGrowDamageBonus(actor) : 0;
    if (growDamageBonus) {
      damageBonusSources.add(findPerk(actor, GROW_ID)?.name ?? 'Grow!');
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

    // Zordbane - see ZORDBANE_ID's own comment in _getAutomaticCombatModifiers above (already
    // gated there on target?.type == 'zord'; reported back via combatModifiers.zordbaneDamageBonus,
    // the same "a fact computed there, folded in here" shape enemyNumberOneTankId already uses).
    const zordbaneDamageBonus = combatModifiers.zordbaneDamageBonus;
    if (zordbaneDamageBonus) {
      damageBonusSources.add(findPerk(actor, ZORDBANE_ID)?.name ?? 'Zordbane');
    }

    // Oorah! - see OORAH_ID's own comment in _getAutomaticCombatModifiers above. Same
    // "computed there, folded in here" shape as Zordbane just above.
    const oorahDamageBonus = combatModifiers.oorahDamageBonus;
    if (oorahDamageBonus) {
      damageBonusSources.add(findPerk(actor, OORAH_ID)?.name ?? 'Oorah!');
    }

    // Cruel - see CRUEL_ID's own comment above. Same "computed in _getAutomaticCombatModifiers,
    // folded in here" shape as Zordbane just above.
    const cruelDamageBonus = combatModifiers.cruelDamageBonus;
    if (cruelDamageBonus) {
      damageBonusSources.add(findPerk(actor, CRUEL_ID)?.name ?? 'Cruel');
    }

    // Phantom Ranger Prime (Across the Stars, 20th level, p.62): "1 additional point of damage on
    // unarmed Attacks." Its "+2 all Defenses" bullet is already a compendium Active Effect; the
    // "Edge on Skill Tests when using a Grid Power" bullet stays Needs new infrastructure (Grid
    // Powers aren't built). "Unarmed" has no dedicated trait/flag anywhere in this system (an
    // unarmed attack's own weaponEffect can use any skill, confirmed against GI Joe's own
    // "Unarmed Combat" item) - detected instead via _getParentWeapon returning null, the same
    // "no weapon Item backs this effect" proxy already used elsewhere in this file (Silent Weapon
    // Expertise/Assault Precision's own `weapon?.system.traits` checks rely on the same lookup).
    const phantomRangerPrimeDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, PHANTOM_RANGER_PRIME_ID)
      ? 1 : 0;
    if (phantomRangerPrimeDamageBonus) {
      damageBonusSources.add(findPerk(actor, PHANTOM_RANGER_PRIME_ID)?.name ?? 'Phantom Ranger Prime');
    }

    // Vicious or Venom (Technorganic Secrets, Saurian Origin Benefit, p.43) - see
    // VICIOUS_OR_VENOM_ID's own comment above. "+1 [Acid/Sharp/Poison] damage" on natural weapon
    // attacks - same "no parent weapon" unarmed proxy as Phantom Ranger Prime just above. This
    // system's own damage pipeline has only one damageType per weaponEffect, so the choice of
    // WHICH damage type is flavor-only here (all 3 grant the same +1 numeric bonus) - the same
    // "closest single-field approximation" idiom already accepted for other multi-type damage
    // additions in this project (e.g. Growing Smolder). Gated on the choice actually being made
    // (findPerk's own system.choice), not just holding the bare Perk unconfigured.
    const viciousOrVenomPerk = findPerk(actor, VICIOUS_OR_VENOM_ID);
    const viciousOrVenomDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && viciousOrVenomPerk?.system.choice
      ? 1 : 0;
    if (viciousOrVenomDamageBonus) {
      damageBonusSources.add(viciousOrVenomPerk.name ?? 'Vicious or Venom');
    }

    // Iron Hands (PR CRB, General Perk, p.96): "+1 damage to your Might-based Unarmed Combat
    // attacks." Same "no parent weapon" unarmed proxy as Phantom Ranger Prime/Growth Boost just
    // above, scoped to Might specifically (unlike those two, which apply to any unarmed attack).
    const ironHandsDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && item.system.classification.skill == 'might' && !this._getParentWeapon(actor, item)
      && actorHasPerk(actor, IRON_HANDS_ID)
      ? 1 : 0;
    if (ironHandsDamageBonus) {
      damageBonusSources.add(findPerk(actor, IRON_HANDS_ID)?.name ?? 'Iron Hands');
    }

    // Iron Hooves (MLP General Perk, p.126) - see IRON_HOOVES_ID's own comment above. Any unarmed
    // attack, not scoped to a specific skill (unlike Iron Hands' own Might-only clause) - same
    // "no parent weapon" proxy as Phantom Ranger Prime just above.
    const ironHoovesDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, IRON_HOOVES_ID)
      ? 1 : 0;
    if (ironHoovesDamageBonus) {
      damageBonusSources.add(findPerk(actor, IRON_HOOVES_ID)?.name ?? 'Iron Hooves');
    }

    // Puissance - see PUISSANCE_ID's own comment above. Same "no parent weapon" shape as Iron
    // Hooves just above.
    const puissanceDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, PUISSANCE_ID)
      ? 1 : 0;
    if (puissanceDamageBonus) {
      damageBonusSources.add(findPerk(actor, PUISSANCE_ID)?.name ?? 'Puissance');
    }

    // Frost/Venom Warlord (Finster's Monster-Matic Cookbook, both 20th level, p.291/300): "+1
    // Cold/Poison damage with any attack made using your natural Reach." Same "no parent weapon"
    // Reach proxy Puissance itself already established, just gated on a specific Warlord instead
    // of Puissance.
    const isReachAttack = checkEntries && item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item);
    const frostWarlordDamageBonus = isReachAttack && actorHasPerk(actor, FROST_WARLORD_ID) ? 1 : 0;
    if (frostWarlordDamageBonus) {
      damageBonusSources.add(findPerk(actor, FROST_WARLORD_ID)?.name ?? 'Frost Warlord');
    }

    const venomWarlordDamageBonus = isReachAttack && actorHasPerk(actor, VENOM_WARLORD_ID) ? 1 : 0;
    if (venomWarlordDamageBonus) {
      damageBonusSources.add(findPerk(actor, VENOM_WARLORD_ID)?.name ?? 'Venom Warlord');
    }

    // Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284): "While in Monster Form,
    // your attacks deal an additional 1 Void damage." RAW also says "against targets within 30
    // feet," dropped as an unenforceable range precondition (the same idiom this project already
    // applies to plenty of other minor range clauses).
    const cruelWarlordDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && isMonsterFormActive(actor) && actorHasPerk(actor, CRUEL_WARLORD_ID) ? 1 : 0;
    if (cruelWarlordDamageBonus) {
      damageBonusSources.add(findPerk(actor, CRUEL_WARLORD_ID)?.name ?? 'Cruel Warlord');
    }

    // Strex Strikes (WTNV General Perk, p.52) - see STREX_STRIKES_ID's own comment above. Same
    // shape as Iron Hooves just above.
    const strexStrikesDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, STREX_STRIKES_ID)
      ? 1 : 0;
    if (strexStrikesDamageBonus) {
      damageBonusSources.add(findPerk(actor, STREX_STRIKES_ID)?.name ?? 'Strex Strikes');
    }

    // Growth Boost (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33): "your
    // Unarmed Strike Attacks inflict one additional damage as a base" - same "no parent weapon"
    // unarmed proxy as Phantom Ranger Prime's identical clause just above. The "double carry
    // weight" clause is Not automatable (no encumbrance subsystem exists anywhere in this
    // codebase); "+2 temporary Health while Morphed" lives in sheet-handlers/power-ranger-handler.mjs
    // #onMorph instead, same shape as Boosted Vigor's own Morph-time toggle.
    const growthBoostDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actorHasPerk(actor, GROWTH_BOOST_ID)
      ? 1 : 0;
    if (growthBoostDamageBonus) {
      damageBonusSources.add(findPerk(actor, GROWTH_BOOST_ID)?.name ?? 'Growth Boost');
    }

    // Ninja Power (PR CRB, General Perk, p.97) - see helpers/ninja-power.mjs's own doc comment.
    // "Your unarmed attacks inflict +1 damage" while Morphed with Ninja Power active - same
    // "no parent weapon" unarmed proxy as Growth Boost/Phantom Ranger Prime above, but any unarmed
    // skill (not Finesse-only, unlike this same Perk's own damage-TYPE override above).
    const ninjaPowerDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && !this._getParentWeapon(actor, item) && actor.system.isMorphed && isNinjaPowerActive(actor)
      && actorHasPerk(actor, NINJA_POWER_ID)
      ? 1 : 0;
    if (ninjaPowerDamageBonus) {
      damageBonusSources.add(findPerk(actor, NINJA_POWER_ID)?.name ?? 'Ninja Power');
    }

    // Precision Aim - the player's own honor-system confirmation (see PRECISION_AIM_ID's own
    // comment) that they didn't move this turn, same "checkbox only, no fictional check" shape as
    // Aiming/Empty the Mag.
    const precisionAimDamageBonus = skillRollOptions.applyPrecisionAim ? updatedShiftDataset.precisionAimAvailable : 0;
    if (precisionAimDamageBonus) {
      damageBonusSources.add(findPerk(actor, PRECISION_AIM_ID)?.name ?? 'Precision Aim');
    }

    // All I Need is One Shot - see ALL_I_NEED_IS_ONE_SHOT_ID's own comment above. The shiftUp
    // half lives just above (in the pre-dialog-close block); this is the damage half.
    const allINeedIsOneShotDamageBonus = skillRollOptions.applyAllINeedIsOneShot ? 2 : 0;
    if (allINeedIsOneShotDamageBonus) {
      damageBonusSources.add(findPerk(actor, ALL_I_NEED_IS_ONE_SHOT_ID)?.name ?? 'All I Need is One Shot');
    }

    // Penetrating Shot - see PENETRATING_SHOT_ID's own comment above. Same checkbox-confirmation
    // shape as Precision Aim just above, reading the live Volley-Shots-minus-1 bonus pre-filled
    // in updatedShiftDataset.penetratingShotAvailable.
    const penetratingShotDamageBonus = skillRollOptions.applyPenetratingShot ? updatedShiftDataset.penetratingShotAvailable : 0;
    if (penetratingShotDamageBonus) {
      damageBonusSources.add(findPerk(actor, PENETRATING_SHOT_ID)?.name ?? 'Penetrating Shot');
    }

    // Target Vulnerability - see TARGET_VULNERABILITY_ID's own comment above.
    const targetVulnerabilityDamageBonus = skillRollOptions.applyTargetVulnerability ? 1 : 0;
    if (targetVulnerabilityDamageBonus) {
      damageBonusSources.add(findPerk(actor, TARGET_VULNERABILITY_ID)?.name ?? 'Target Vulnerability');
    }

    // Exploit Trust (Spec Ops Focus, 10th level, p.63): "when you attack a Surprised character, or
    // if you attack a target outside of Combat, you gain an Edge on the attack and deal 1
    // additional damage." Only the "outside of Combat" half is automated - this system has no
    // "Surprised" status to check the other half against (a known, documented gap, same as
    // Prepare for War/Sirens Blaring's own unenforced "not Surprised" clause).
    const isExploitTrustAttack = item?.type == 'weaponEffect' && !game.combat && actorHasPerk(actor, EXPLOIT_TRUST_ID);
    if (isExploitTrustAttack) {
      skillRollOptions.edge = true;
      damageBonusSources.add(findPerk(actor, EXPLOIT_TRUST_ID)?.name ?? 'Exploit Trust');
    }

    const exploitTrustDamageBonus = isExploitTrustAttack ? 1 : 0;

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
    if (appliesRolePointsDamage && damageRolePoints.sourceId == HARD_HITTER_ID) {
      skillRollOptions.edge = true;
    }

    // damageBonus Role Points (e.g. Sneak Attack Damage) - a flat add-on to the weaponEffect's own
    // damageValue, folded in only once there's an actual attack (a real checkEntries) to apply it
    // to, so checking the box on a roll that never ends up targeting anyone doesn't needlessly
    // burn Sneak Attack's once-per-round use for no effect.
    let damageBonusValue = warfighterDamageBonus + bearHugDamageBonus + jacketAmmunitionDamageBonus + throwYourWeightAroundDamageBonus + primeDamageBonus + whiteRangerPrimeDamageBonus
      + precisionAimDamageBonus + allINeedIsOneShotDamageBonus + penetratingShotDamageBonus
      + targetVulnerabilityDamageBonus + exploitTrustDamageBonus + acidDamageBonus + fireDamageBonus
      + environmentalAssistDamageBonus + silverRangerPrimeDamageBonus + phantomRangerPrimeDamageBonus + viciousOrVenomDamageBonus
      + growthBoostDamageBonus + ninjaPowerDamageBonus + powerBoostDamageBonus + zeoCrystalBoostDamageBonus + spentTerror + spentSupremeGuardianTech + spentDemolitionDriver
      + ironHandsDamageBonus + ironHoovesDamageBonus + puissanceDamageBonus + forceDamageBonus
      + combatStanceDamageBonus + ultimateMagnaDefenderDamageBonus + growDamageBonus + psychoAssaultDamageBonus + zordbaneDamageBonus + oorahDamageBonus + cruelDamageBonus + growingSmolderStacks
      + frostWarlordDamageBonus + venomWarlordDamageBonus + cruelWarlordDamageBonus
      + stationManagementDamageBonus + theWeatherDamageBonus + strexStrikesDamageBonus + viralNewsBloggersDamageBonus
      + gridPowerStrikeDamageBonus + weakPointDamageBonus + roamingTheLandDamageBonus
      + (appliesRolePointsDamage ? damageRolePoints.value : 0);
    if (forceDamageBonus) {
      damageBonusSources.add(findPerk(actor, FORCE_ID)?.name ?? 'Force');
    }

    if (whiteRangerPrimeDamageBonus) {
      damageBonusSources.add(findPerk(whiteRangerPrimePilot, WHITE_RANGER_PRIME_ID)?.name ?? 'White Ranger Prime');
    }

    let debilitatingStrike = false;
    // damageRolePoints?. below - damageBonusValue can now be truthy from Warfighter's flat bonus
    // alone, with no damageRolePoints claim active at all (unlike before Warfighter existed, when
    // a truthy damageBonusValue always implied a truthy damageRolePoints).
    if (damageBonusValue && damageRolePoints?.isSneakAttack) {
      await markSneakAttackUsed(actor);

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
    const isUnarmedAttack = item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item);

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
    } else if (isUnarmedAttack && actorHasPower(actor, CRYOGENIC_TOUCH_ID)) {
      overriddenDamageType = 'cold';
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
    } else if (bearHugDamageBonus) {
      // Bear Hug - see BEAR_HUG_ID's own comment above.
      overriddenDamageType = 'blunt';
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

    // Deceptive Warfare - see DECEPTIVE_WARFARE_ID's own comment above. Same synthetic-damage
    // shape as Psychoanalyst just above.
    const deceptiveWarfareDamage = skillRollOptions.applyDeceptiveWarfare ? { value: 1, type: 'psychic' } : null;

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
    const spellSourceId = item?.type == 'spell'
      ? (item.flags?.core?.sourceId ?? item._stats?.compendiumSource) : null;
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
        // through checkContext" shape effectName/alternateEffects below already use.
        defenseType: skillRollOptions.defenseType,
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
            ? 0 : item.system.damageValue + damageBonusValue)
          : (psychoanalystDamage?.value ?? coaxSurrenderDamage?.value ?? deceptiveWarfareDamage?.value ?? explosiveMorphDamage?.value ?? omegaEnhancementDamage?.value ?? menaceDamage?.value ?? humanBulletDamage?.value ?? electricDischargeDamage?.value ?? disintegrateDamage?.value ?? beamSpellDamage?.value ?? beamVolleyDamage?.value ?? kocFireballDamage?.value ?? powerBlastDamage?.value ?? morphblastDamage?.value ?? null),
        // Read by _rollSkillHelper to build each result's own damageBonusLabel - kept as the raw
        // bonus amount and its source names rather than a pre-built label here, since the actual
        // per-target amount still needs scaling by that target's own Degrees of Success
        // multiplier (see _rollSkillHelper's damageValue: ... * multiplier just below it).
        damageBonusValue: item?.type == 'weaponEffect' ? damageBonusValue : 0,
        damageBonusSources: [...damageBonusSources],
        damageType: item?.type == 'weaponEffect'
          ? (overriddenDamageType ?? item.system.damageType)
          : (psychoanalystDamage?.type ?? coaxSurrenderDamage?.type ?? deceptiveWarfareDamage?.type ?? explosiveMorphDamage?.type ?? omegaEnhancementDamage?.type ?? menaceDamage?.type ?? humanBulletDamage?.type ?? electricDischargeDamage?.type ?? disintegrateDamage?.type ?? beamSpellDamage?.type ?? beamVolleyDamage?.type ?? kocFireballDamage?.type ?? powerBlastDamage?.type ?? morphblastDamage?.type ?? null),
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
        isBolsterDefenseAttempt,
        bolsterDefenseMode,
        bolsterDefenseType,
        bolsterDefenseTargetUuid,
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
        isWordsCanHurtAttempt,
        wordsCanHurtTargetUuid,
        isCalmingWordsAttempt,
        calmingWordsTargetUuid,
        calmingWordsAction,
        isLuckyCharmAttempt,
        luckyCharmItemUuid,
        isIllusoryDisguiseAttempt,
        isHumanitarianAttempt,
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
        // Hobble (Decepticon Directive Raider, Acquisitions Expert Focus, 20th level, p.63) - see
        // HOBBLE_ID's own comment above. The downshift itself already happened via
        // skillRollOptions.applyHobble above; this just carries the declared attempt through to
        // _rollSkillHelper's post-hit Condition-picker.
        hobbleAttempt: !!skillRollOptions.applyHobble,
        // Bump & Run - see BUMP_AND_RUN_ID's own comment above. The upshift itself already
        // happened via skillRollOptions.applyBumpAndRun above; this just carries the declared
        // attempt through to _rollSkillHelper's post-hit Stun-on-Critical-Success check.
        bumpAndRunAttempt: !!skillRollOptions.applyBumpAndRun,
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
        // Lock Down (Strategist Focus, 17th level, p.68): "your Attacks gain Immobilized 1 as an
        // additional effect." Applied per-target alongside a successful hit, same shape as
        // Trigger Happy's own independent Frightened compare - "Immobilized 1" has no active
        // 1-round expiry (same unenforced-duration gap as everywhere else), so this just toggles
        // the Condition on.
        lockDownImmobilize: item?.type == 'weaponEffect' && actorHasPerk(actor, LOCK_DOWN_ID),
        // Stunning Surprise (Prowler Focus, 1st level, p.86): "When you attack a creature who is
        // unaware of your exact location, your attack deals Stun 1 in addition to its normal
        // effect." "Unaware of your exact location" has no hook to verify (same "player
        // self-polices the fictional trigger" reasoning as Aiming/Precision Aim above) - granted
        // whenever the attacker holds the Perk, approximated as always-on rather than a checkbox
        // since it's not something the player would ever want to opt out of.
        stunningSurpriseStun: item?.type == 'weaponEffect' && actorHasPerk(actor, STUNNING_SURPRISE_ID),
        // Roaming the Land - see ROAMING_THE_LAND_ID's own comment above. "Larger Creatures" Stun
        // half only (the "smaller creatures" damage half is folded into damageBonusValue above) -
        // the actual Size comparison against the specific hit target happens per-result below,
        // since a multi-target roll could hit differently-sized creatures.
        roamingTheLandStun: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee'
          && roamingTheLandPerk?.system.choice == 'largerStun',
        // Sideswipe (Factions in Action Vol. 2, General Perk, p.64): "When you successfully target
        // a character on foot with a vehicle's Flyby or Ram attack, you deal both the effect's
        // damage and the Trip alternate effect." Rolled from the VEHICLE's own attack, held by its
        // driver - same "held by the pilot, checked via _getVehicleDriver" shape as Heavy Ordnance/
        // White Ranger Prime. Neither "Ram" nor "Flyby" is a real classification.style/damageType
        // value anywhere in this system's schema - per the GI Joe CRB's own "Vehicle Perks, Powers,
        // and Traits" list (p.172) every vehicle stat block that has one lists it as an ordinarily-
        // named Attack (e.g. "Ram (Might): ...", "Flyby (Might): ..."), always carrying the
        // Drive-By weapon trait but with no OTHER shared classification distinguishing Ram from
        // Flyby from any other Blunt attack - so this matches by the item's own display NAME
        // instead, the only field RAW itself uses to identify these two specific attacks.
        // "The Trip alternate effect" is read as applying the Prone Condition directly (this
        // system's own mechanical translation of being knocked down), applied per-target in this
        // function's own post-hit processing below, gated there on the target NOT being a
        // vehicle/Zord ("a character on foot").
        isSideswipeAttempt: this._isSideswipeAttack(actor, item),
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
        // Withering Fire - see WITHERING_FIRE_ID's own comment above.
        isWitheringFireAttempt,
        // Unlucky (For You) (Dark Ranger, 13th level, p.40) - see
        // helpers/unlucky-for-you.mjs's own doc comment. A plain "was this attack" flag, read in
        // _rollSkillHelper's post-hit processing below.
        isAttack: item?.type == 'weaponEffect',
        // Absolute Menace (Dark Ranger, 18th level, p.40) - see helpers/absolute-menace.mjs's own
        // doc comment. Stamped via a synthetic dataset.isAbsoluteMenace field (the same
        // minimal-dataset shape helpers/consummate-performer.mjs's own activateConsummatePerformer
        // already uses to flag its own roll), read in _rollSkillHelper's post-hit processing below
        // to apply Frightened to every successfully-hit enemy.
        isAbsoluteMenaceAttempt: !!dataset.isAbsoluteMenace,
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
        // Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63) - see
        // helpers/antagonistic.mjs's own doc comment. Read in _rollSkillHelper's post-hit
        // processing to open the 2-way effect picker on a success.
        isAntagonisticAttempt: !!dataset.isAntagonistic,
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
        // Calculated Attack - see CALCULATED_ATTACK_ID's own comment above.
        isCalculatedAttackAttempt: !!dataset.isCalculatedAttack,
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
      }
      : null;

    // Multiple Targets (X, range/area) (p.198) - see isMultipleTargetsWeapon's own doc comment
    // for the Blast/AoE distinction. Only kicks in with 2+ actual targets - a single target (or
    // none) has nothing to roll "independently" against, so it rolls exactly like any other
    // attack below.
    const isMultipleTargetsAttack = checkEntries?.length > 1 && isMultipleTargetsWeaponAttack;

    // Repeat the roll as many times as specified in the skill roll options dialog
    for (let i = 0; i < skillRollOptions.timesToRoll; i++) {
      let repeatText = '';
      if (skillRollOptions.timesToRoll > 1) {
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
        // widening check.
        finalShift,
        snag: skillRollOptions.snag,
        isPowerWeaponAttack: item?.type == 'weaponEffect'
          && !!this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('powerWeapon'),
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
        // Spite (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see helpers/spite.mjs's own
        // doc comment and chat.mjs#addSpiteButton for why this needs to be recognized from the
        // posted message itself (a reactive, post-miss trigger, not a pre-roll checkbox). Only
        // meaningful for a single-target Attack - the same "first entry" simplification other
        // single-target-assuming mechanics in this project already use.
        isAttack: item?.type == 'weaponEffect',
        // Exploit Weakness (PR CRB, Yellow Ranger, 7th/15th level, p.57) - see
        // helpers/exploit-weakness.mjs's own doc comment and chat.mjs#addExploitWeaknessButton.
        // Same reactive-chat-button recognition shape as Spite above, but gated on a melee Attack
        // regardless of hit/miss rather than a miss specifically.
        isMelee: item?.type == 'weaponEffect' && item.system.classification.style == 'melee',
        targetUuid: checkContext?.entries?.[0]?.targetUuid ?? null,
        // Tough Enough (GI Joe CRB, Tank Focus, 6th level, p.99) - see
        // helpers/combat.mjs#grantToughEnoughResistance's own doc comment. Needed alongside
        // isAttack above so chat.mjs's Apply Damage handler can recognize "a non-attack effect
        // against Toughness" from the posted message alone.
        defenseType: checkContext?.defenseType ?? null,
      };

      if (isMultipleTargetsAttack) {
        // One independent roll per target, each its own checkContext carrying just that one
        // target's own entry - _rollSkillHelper's own `new Roll(formula, ...)` gives each call
        // a fresh, independent dice pool, the same mechanism the timesToRoll loop above already
        // relies on for repeats, so no other change is needed to get independent totals.
        for (const entry of checkEntries) {
          const targetText = this._i18n.format("E20.RollMultipleTargetsText", { name: entry.name }) + '<br>';
          this._rollSkillHelper(
            formula, actor, repeatText + targetText + label, canCritD2, { ...checkContext, entries: [entry] },
            rollContext, drivingStrikeReroll,
          );
        }
      } else {
        this._rollSkillHelper(formula, actor, repeatText + label, canCritD2, checkContext, rollContext, drivingStrikeReroll);
      }
    }
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
      && (actorItem.flags.core?.sourceId == perkId || actorItem._stats?.compendiumSource == perkId));
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
  _getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill) {
    let shiftUp = 0;
    let shiftDown = 0;
    let edge = false;
    let snag = false;
    let debilitatedConsumed = false;
    let tooCloseForMinimumRange = false;
    let forcedMiss = false;
    let moveLikeASongTriggered = false;
    let zordbaneDamageBonus = 0;
    let oorahDamageBonus = 0;
    let isCatchOffGuardAttempt = false;
    let cruelDamageBonus = 0;
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
      });
    };

    const selfStatuses = actor.statuses;
    if (selfStatuses.has('impaired')) {
      shiftDown += 1;
      addSource('impaired', this._localize('E20.StatusImpaired'), { shiftDown: 1 });
    }

    if (selfStatuses.has('actingSmaller') && ['strength', 'speed'].includes(rolledEssence)) {
      snag = true;
      addSource('actingSmaller', this._localize('E20.StatusActingSmaller'), { snag: true });
    }

    // The Fiercest Among You (Transformers CRB, Origin Perk, Rainmaker Chassis, p.52) - Snag half
    // only: "you suffer a Snag on Skill Tests to blend in." The extra-Hardpoint and staged
    // weapon-category-training halves stay unbuilt (confirmed no Integrated-Hardpoint-slot-count
    // field and no weapon-category "trained" tracking field exist anywhere in this codebase, same
    // gaps already blocking In Case of Emergency). "Blend in" is read as this system's own
    // Infiltration skill, the established stealth/blend-in concept several other Perks already key
    // off (Camouflage & Hide, Safecracker, Ambush Predator, every disguise Perk).
    if (rolledSkill == 'infiltration' && actorHasPerk(actor, FIERCEST_AMONG_YOU_ID)) {
      snag = true;
      addSource(
        'fiercestAmongYou', findPerk(actor, FIERCEST_AMONG_YOU_ID)?.name ?? 'The Fiercest Among You', { snag: true },
      );
    }

    // Wheel Struggle - see WHEEL_STRUGGLE_ID's own comment above.
    if (actorHasPerk(actor, WHEEL_STRUGGLE_ID) && this._getPilotedVehicle(actor)
      && !this._getPilotedVehicle(actor, 'driver')) {
      snag = true;
      addSource('wheelStruggle', findPerk(actor, WHEEL_STRUGGLE_ID)?.name ?? 'Wheel Struggle', { snag: true });
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
      addSource('debilitatingStrike', findPerk(actor, DEBILITATING_STRIKE_ID)?.name ?? 'Debilitating Strike', { snag: true });
    }

    // Who Dares, Wins (Door-Kicker Focus, 6th level): "you gain an Edge on all of your attacks
    // with a shotgun or submachine gun, and Skill Tests, in the first round of combat." Which
    // clauses "in the first round of combat" scopes over is genuinely ambiguous text - reading
    // both halves as round-1-scoped makes the weapon-specific clause a strict subset of the
    // broader "Skill Tests" one, so this just grants Edge on any roll during round 1, applying to
    // ANY roll rather than only weaponEffect attacks, same reasoning as Debilitating Strike above.
    if (game.combat?.round == 1 && actorHasPerk(actor, WHO_DARES_WINS_ID)) {
      edge = true;
      addSource('whoDaresWins', findPerk(actor, WHO_DARES_WINS_ID)?.name ?? 'Who Dares, Wins', { edge: true });
    }

    // Think On It (Technician/Grandmaster Focus, 5th level, p.103) / Plan of Action (Officer
    // base, 1st level, p.85): both banked via the sheet's own new "Use" control
    // (helpers/banked-buffs.mjs) and consumed here, on whichever actor is rolling - applies to
    // ANY roll, same reasoning as Debilitating Strike/Who Dares Wins above. Plan of Action banks
    // its bonus directly on the ALLY the Officer chose, not the Officer themselves, so this is
    // still just an ordinary self-flag check either way - no cross-actor lookup needed here. This
    // function is synchronous and can't clear the flag itself, so - same shape as
    // debilitatedConsumed above - it just reports which keys to clear and rollSkill() does it.
    const pendingBattleCommander = getPendingBonus(actor, 'pendingBattleCommander');
    if (pendingBattleCommander) {
      edge = true;
      pendingBonusesToClear.push('pendingBattleCommander');
      addSource('battleCommander', 'Battle Commander', { edge: true });
    }

    const pendingThinkOnIt = getPendingBonus(actor, 'pendingThinkOnIt');
    if (pendingThinkOnIt) {
      edge = true;
      pendingBonusesToClear.push('pendingThinkOnIt');
      // These banked ("Use"-button-granted) bonuses have no sourceId handy here to findPerk()
      // against - dice.mjs only ever reads the flag getPendingBonus() left behind, never the
      // granting Perk's own compendium id (that lives in helpers/banked-buffs.mjs instead, which
      // doesn't export it). A plain display-name string is the same fallback
      // Environmental Assist's own damageBonusSources entry already uses for the identical
      // "granted by someone else's click, no local Perk id to look up" situation.
      addSource('thinkOnIt', 'Think On It', { edge: true });
    }

    // Auxiliary Brain (Technician/Expert Focus, 6th level, p.104) - see AUXILIARY_BRAIN_ID's own
    // comment in banked-buffs.mjs. Same unscoped self-Edge shape as Think On It just above, just
    // gated once-per-turn at bank time instead of lasting until the start of the next turn.
    if (getPendingBonus(actor, 'pendingAuxiliaryBrain')) {
      edge = true;
      pendingBonusesToClear.push('pendingAuxiliaryBrain');
      addSource('auxiliaryBrain', 'Auxiliary Brain', { edge: true });
    }

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

    // The Nine Hand Seals - see NINE_HAND_SEALS_ID's own comment in banked-buffs.mjs. Same
    // unscoped-Edge shape as Think On It/Superb Soloist just above ("your next Attack or other
    // Skill Test").
    if (getPendingBonus(actor, 'pendingNineHandSeals')) {
      edge = true;
      pendingBonusesToClear.push('pendingNineHandSeals');
      addSource('nineHandSeals', 'The Nine Hand Seals', { edge: true });
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

    // Harass (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.63) - see
    // helpers/harass.mjs's own doc comment. Scoped to any Attack (not melee-only).
    if (getPendingBonus(actor, HARASS_EDGE_FLAG) && item?.type == 'weaponEffect') {
      edge = true;
      pendingBonusesToClear.push(HARASS_EDGE_FLAG);
      addSource('harass', 'Harass', { edge: true });
    }

    // Calm Hearted (Dark Skies Over Equestria, General Perk, p.43) - see CALM_HEARTED_ID's own
    // comment above. Scoped to the Social Essence broadly (any Social Skill), unlike Think On
    // It/Superb Soloist's own unscoped-to-any-roll Edge.
    if (getPendingBonus(actor, 'pendingCalmHearted') && rolledEssence == 'social') {
      edge = true;
      pendingBonusesToClear.push('pendingCalmHearted');
      addSource('calmHearted', 'Calm Hearted', { edge: true });
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

    // Bait and Switch (MLP Tricky Influence, p.63) - see BAIT_AND_SWITCH_ID's own comment above.
    // Scoped to Deception or Infiltration specifically (unlike Think On It/Time To Think's own
    // any-roll Edge), consumed the same "check rolledSkill inline" shape Inner Magic already uses.
    const pendingBaitAndSwitch = getPendingBonus(actor, 'pendingBaitAndSwitch');
    if (pendingBaitAndSwitch && (rolledSkill == 'deception' || rolledSkill == 'infiltration')) {
      edge = true;
      pendingBonusesToClear.push('pendingBaitAndSwitch');
      addSource('baitAndSwitch', 'Bait and Switch', { edge: true });
    }

    // If I Recall Correctly (Knights of Canterlot, Spell Scribe Influence, p.34) - see
    // IF_I_RECALL_CORRECTLY_ID's own comment above. Scoped to Spellcasting, same inline shape as
    // Bait and Switch just above.
    const pendingIfIRecallCorrectly = getPendingBonus(actor, 'pendingIfIRecallCorrectly');
    if (pendingIfIRecallCorrectly && rolledSkill == 'spellcasting') {
      edge = true;
      pendingBonusesToClear.push('pendingIfIRecallCorrectly');
      addSource('ifIRecallCorrectly', 'If I Recall Correctly', { edge: true });
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

    // Trick Shot (Knights of Canterlot, Archer, p.14) - see TRICK_SHOT_ID's own comment above.
    // Scoped to Targeting, same inline shape as Bait and Switch/If I Recall Correctly above.
    const pendingTrickShot = getPendingBonus(actor, 'pendingTrickShot');
    if (pendingTrickShot && rolledSkill == 'targeting') {
      edge = true;
      pendingBonusesToClear.push('pendingTrickShot');
      addSource('trickShot', 'Trick Shot', { edge: true });
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

    // Heart of the Team (Black Ranger, 1st/5th/10th/15th level, p.33) - same banked-on-an-ally
    // shape as Plan of Action above, just its own flagKey (see HEART_OF_THE_TEAM_ID's own comment
    // in helpers/banked-buffs.mjs for the Quips & Speeches cost paid at bank time).
    const pendingHeartOfTheTeam = getPendingBonus(actor, 'pendingHeartOfTheTeam');
    if (pendingHeartOfTheTeam) {
      shiftUp += pendingHeartOfTheTeam.shiftUp;
      pendingBonusesToClear.push('pendingHeartOfTheTeam');
      addSource('heartOfTheTeam', 'Heart of the Team', { shiftUp: pendingHeartOfTheTeam.shiftUp });
    }

    // Forward Observation - see helpers/forward-observation.mjs's own doc comment. Same
    // banked-shiftUp-on-self-or-an-ally shape as Heart of the Team above.
    const pendingForwardObservation = getPendingBonus(actor, 'pendingForwardObservation');
    if (pendingForwardObservation) {
      shiftUp += pendingForwardObservation.shiftUp;
      pendingBonusesToClear.push('pendingForwardObservation');
      addSource('forwardObservation', 'Forward Observation', { shiftUp: pendingForwardObservation.shiftUp });
    }

    // Augment Power (Transformers CRB Scientist, 7th level, p.80) - same banked-on-an-ally shape
    // as Heart of the Team above, just its own flagKey (see AUGMENT_POWER_ID's own comment in
    // helpers/banked-buffs.mjs for the once-per-turn gate paid at bank time).
    const pendingAugmentPower = getPendingBonus(actor, 'pendingAugmentPower');
    if (pendingAugmentPower) {
      shiftUp += pendingAugmentPower.shiftUp;
      pendingBonusesToClear.push('pendingAugmentPower');
      addSource('augmentPower', 'Augment Power', { shiftUp: pendingAugmentPower.shiftUp });
    }

    // Personal Sacrifice (MLP Generosity, 7th level, p.74) - same banked-on-an-ally shape as
    // Heart of the Team/Augment Power above (see PERSONAL_SACRIFICE_ID's own comment in
    // helpers/banked-buffs.mjs for the unautomated "take the negative effect" half).
    const pendingPersonalSacrifice = getPendingBonus(actor, 'pendingPersonalSacrifice');
    if (pendingPersonalSacrifice) {
      shiftUp += pendingPersonalSacrifice.shiftUp;
      pendingBonusesToClear.push('pendingPersonalSacrifice');
      addSource('personalSacrifice', 'Personal Sacrifice', { shiftUp: pendingPersonalSacrifice.shiftUp });
    }

    // Bird's Eye View (Technorganic Secrets, Origin Perk, p.39) - see BIRD_EYE_VIEW_ID's own
    // comment in helpers/banked-buffs.mjs. Same banked-on-an-ally shape as Personal Sacrifice
    // just above.
    const pendingBirdEyeView = getPendingBonus(actor, 'pendingBirdEyeView');
    if (pendingBirdEyeView) {
      shiftUp += pendingBirdEyeView.shiftUp;
      pendingBonusesToClear.push('pendingBirdEyeView');
      addSource('birdEyeView', "Bird's Eye View", { shiftUp: pendingBirdEyeView.shiftUp });
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

    // Vulnerability (MLP Kindness, 3rd level, p.82) - same self-banked shiftUp shape as Think On
    // It/Augment Power above (see helpers/banked-buffs.mjs's own VULNERABILITY_ID comment for the
    // unautomated Defense-penalty half).
    const pendingVulnerability = getPendingBonus(actor, 'pendingVulnerability');
    if (pendingVulnerability) {
      shiftUp += pendingVulnerability.shiftUp;
      pendingBonusesToClear.push('pendingVulnerability');
      addSource('vulnerability', 'Vulnerability', { shiftUp: pendingVulnerability.shiftUp });
    }

    // Hidden Whispers (WTNV Citizen's Guide, Politician Role, Mayoral Candidate Focus, p.41):
    // "Once per scene, the knowledge that the future of Night Vale remembers you emboldens you and
    // you gain ↑3 on one Skill Test." Same self-banked shiftUp shape as Vulnerability above -
    // unscoped (applies to whichever skill is rolled next, "one Skill Test" of the player's own
    // choosing), a plain BANKABLE_PERKS fixedShiftUp entry with an onceEncounterFlag.
    const pendingHiddenWhispers = getPendingBonus(actor, 'pendingHiddenWhispers');
    if (pendingHiddenWhispers) {
      shiftUp += pendingHiddenWhispers.shiftUp;
      pendingBonusesToClear.push('pendingHiddenWhispers');
      addSource('hiddenWhispers', 'Hidden Whispers', { shiftUp: pendingHiddenWhispers.shiftUp });
    }

    // Inner Magic (MLP Magic, 2nd level, p.94): "as a Standard action, you can reduce your
    // Willpower Defense by 1 until the end of the scene to upshift 1 your Spellcasting for your
    // next action. You may do this multiple times in a scene..." Same self-banked shiftUp shape
    // as Vulnerability above, but gated to Spellcasting specifically (RAW's own "for your next
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

    // Wild Tales (MLP Adventurer Influence, p.42) - see helpers/wild-tales.mjs's own doc comment.
    // Scoped to whichever of the 2 Essences the player picked at use time, unlike Inner Magic's
    // own fixed Spellcasting scope just above.
    // Shattered Memories - Recall Timeline Details (Through the Shattered Grid, Grid Power, p.115)
    // - see helpers/shattered-memories.mjs's own doc comment. A plain unscaled +1, essence-scoped
    // to Smarts rather than any one Skill (RAW's own "↑1 on Smarts Skill Tests" wording), unlike
    // Inner Magic's own single-skill scope just above.
    const pendingShatteredMemoriesSmarts = getPendingBonus(actor, SHATTERED_MEMORIES_SMARTS_FLAG);
    if (pendingShatteredMemoriesSmarts && rolledEssence == 'smarts') {
      shiftUp += 1;
      pendingBonusesToClear.push(SHATTERED_MEMORIES_SMARTS_FLAG);
      addSource('shatteredMemoriesSmarts', 'Shattered Memories', { shiftUp: 1 });
    }

    const pendingWildTales = getPendingBonus(actor, PENDING_WILD_TALES_FLAG_KEY);
    if (pendingWildTales && pendingWildTales.essence == rolledEssence) {
      edge = true;
      pendingBonusesToClear.push(PENDING_WILD_TALES_FLAG_KEY);
      addSource('wildTales', 'Wild Tales', { edge: true });
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

    // Repair Machine (Quartermaster's Guide to Gear, Grid Power, p.94) - see
    // helpers/repair-machine.mjs's own doc comment. Same self-banked, skill-scoped Edge shape as
    // Grid Surge's own Temporary Construct just above, but fixed to Technology.
    const pendingRepairMachineEdge = getPendingBonus(actor, REPAIR_MACHINE_EDGE_FLAG);
    if (pendingRepairMachineEdge && rolledSkill == 'technology') {
      edge = true;
      pendingBonusesToClear.push(REPAIR_MACHINE_EDGE_FLAG);
      addSource('repairMachineEdge', 'Repair Machine', { edge: true });
    }

    // Rev Your Engines! (A Jump Through Time, Grid Power, p.58) - see
    // helpers/rev-your-engines.mjs's own doc comment. Fixed to the Driving skill specifically
    // (unlike Grid Surge's own player-chosen scope just above).
    const pendingRevYourEngines = getPendingBonus(actor, PENDING_REV_YOUR_ENGINES_FLAG_KEY);
    if (pendingRevYourEngines && rolledSkill == 'driving') {
      shiftUp += pendingRevYourEngines.shiftUp;
      pendingBonusesToClear.push(PENDING_REV_YOUR_ENGINES_FLAG_KEY);
      addSource('revYourEngines', 'Rev Your Engines!', { shiftUp: pendingRevYourEngines.shiftUp });
    }

    // Megazord Link - see helpers/megazord-link.mjs's own doc comment. Same Driving-scoped bank
    // shape as Rev Your Engines just above.
    const pendingMegazordLink = getPendingBonus(actor, PENDING_MEGAZORD_LINK_FLAG_KEY);
    if (pendingMegazordLink && rolledSkill == 'driving') {
      shiftUp += pendingMegazordLink.shiftUp;
      pendingBonusesToClear.push(PENDING_MEGAZORD_LINK_FLAG_KEY);
      addSource('megazordLink', 'Megazord Link', { shiftUp: pendingMegazordLink.shiftUp });
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

    // Martial Leadership (Enigma of Combination, General Perk, p.41) - see
    // helpers/martial-leadership.mjs's own doc comment. Applies to ANY Skill Test, same
    // unscoped shape as Through the Arches just above - either the Snag or the Edge half, never
    // both at once (the picker only ever banks one).
    if (getPendingBonus(actor, MARTIAL_LEADERSHIP_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(MARTIAL_LEADERSHIP_SNAG_FLAG);
      addSource('martialLeadership', 'Martial Leadership', { snag: true });
    }

    if (getPendingBonus(actor, MARTIAL_LEADERSHIP_EDGE_FLAG)) {
      edge = true;
      pendingBonusesToClear.push(MARTIAL_LEADERSHIP_EDGE_FLAG);
      addSource('martialLeadership', 'Martial Leadership', { edge: true });
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

    // Tender's own Snag (MLP CRB, Spirit of Kindness, 6th level, p.85) - see
    // helpers/tender.mjs's own doc comment. Same unscoped shape as Menacing Glare just above.
    if (getPendingBonus(actor, 'pendingTenderSnag')) {
      snag = true;
      pendingBonusesToClear.push('pendingTenderSnag');
      addSource('tenderSnag', 'Tender', { snag: true });
    }


    // Unlucky (For You)'s own Snag half (Dark Ranger, 13th level, p.40) - see
    // helpers/unlucky-for-you.mjs's own doc comment. Same unscoped shape as Menacing Glare/Through
    // the Arches just above.
    if (getPendingBonus(actor, UNLUCKY_FOR_YOU_SNAG_FLAG)) {
      snag = true;
      pendingBonusesToClear.push(UNLUCKY_FOR_YOU_SNAG_FLAG);
      addSource('unluckyForYou', 'Unlucky (For You)', { snag: true });
    }

    // Generosity of Spirit (MLP Generosity, 1st level, p.74): the +1 granted to the chosen ally
    // (banked directly on them, same shape as Heart of the Team/Augment Power above) and the
    // granter's own -1 self-penalty (banked as its own shiftDown - see
    // helpers/banked-buffs.mjs's own GENEROSITY_OF_SPIRIT_ID comment for why this is a shiftDown
    // and not a negative shiftUp) are two independent flags on two different actors.
    const pendingGenerosityOfSpirit = getPendingBonus(actor, 'pendingGenerosityOfSpirit');
    if (pendingGenerosityOfSpirit) {
      shiftUp += pendingGenerosityOfSpirit.shiftUp;
      pendingBonusesToClear.push('pendingGenerosityOfSpirit');
      addSource('generosityOfSpirit', 'Generosity of Spirit', { shiftUp: pendingGenerosityOfSpirit.shiftUp });
    }

    const pendingGenerosityOfSpiritPenalty = getPendingBonus(actor, 'pendingGenerosityOfSpiritPenalty');
    if (pendingGenerosityOfSpiritPenalty) {
      shiftDown += pendingGenerosityOfSpiritPenalty.shiftDown;
      pendingBonusesToClear.push('pendingGenerosityOfSpiritPenalty');
      addSource('generosityOfSpiritPenalty', 'Generosity of Spirit', { shiftDown: pendingGenerosityOfSpiritPenalty.shiftDown });
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

    // Resolved for ANY roll, not just weaponEffect attacks - see this function's own doc comment
    // above for why (a plain Skill Test can have a real target too, and First Strike just below
    // needs it regardless of isAttack).
    const targetToken = game.user.targets.first();
    const target = targetToken?.actor;
    let enemyNumberOneTankId = null;
    let projectileDancerTargetToMark = null;
    let spottedTarget = null;
    let eyeForAppraisalTarget = null;
    if (target) {
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

      // Shattered Memories - Recall a Character (Through the Shattered Grid, Grid Power, p.115) -
      // see helpers/shattered-memories.mjs's own doc comment. Same "self-Edge scoped to one
      // specific other actor" shape as Menacing Glare's own identical clause just above, but gated
      // on rolledEssence == 'social' (RAW says "Social Skill Test," not "Attack") rather than
      // isAttack.
      const pendingShatteredMemoriesEdge = getPendingBonus(actor, SHATTERED_MEMORIES_EDGE_FLAG);
      if (pendingShatteredMemoriesEdge && pendingShatteredMemoriesEdge.targetId == target.id
        && rolledEssence == 'social') {
        edge = true;
        pendingBonusesToClear.push(SHATTERED_MEMORIES_EDGE_FLAG);
        addSource('shatteredMemoriesEdge', 'Shattered Memories', { edge: true });
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
      // ranged attacks or melee weapons suffer a Snag" - reciprocal like Glow above, but gated on
      // isAttack (RAW names Attacks specifically, not any Skill Test).
      if (isAttack && isGlittermaneActive(target)) {
        snag = true;
        addSource('glittermane', 'Glittermane', { snag: true });
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

      // Skeptic (Field Guide to Action & Adventure, Influence Perk, p.58) - see
      // SKEPTIC_INFLUENCE_ID's own comment above. Reciprocal like Just the Facts just above, but
      // unconditional (no level comparison).
      if (rolledSkill == 'deception' && actorHasPerk(target, SKEPTIC_INFLUENCE_ID)) {
        snag = true;
        addSource('skepticInfluence', findPerk(target, SKEPTIC_INFLUENCE_ID)?.name ?? 'Skeptic', { snag: true });
      }

      // Skeptic (Field Guide to Action & Adventure, Hang-Up, p.58) - see SKEPTIC_HANGUP_ID's own
      // comment above. The mirror-image reciprocal Edge (helping the roller, not the target).
      if (rolledSkill == 'persuasion' && actorHasHangUp(target, SKEPTIC_HANGUP_ID)) {
        edge = true;
        addSource('skepticHangUp', findHangUp(target, SKEPTIC_HANGUP_ID)?.name ?? 'Skeptic', { edge: true });
      }

      // Animal (GI Joe CRB, pet General Perk, p.165) - see ANIMAL_ID's own comment above.
      if ((rolledSkill == 'persuasion' || rolledSkill == 'deception') && actorHasPerk(target, ANIMAL_ID)) {
        snag = true;
        addSource('animal', findPerk(target, ANIMAL_ID)?.name ?? 'Animal', { snag: true });
      }

      // Martial Artist (PR CRB / GI Joe CRB, Hang-Up) - see MARTIAL_ARTIST_HANGUP_IDS's own
      // comment above. Same mirror-image reciprocal Edge shape as Skeptic's own Hang-Up,
      // Essence-scoped, covering either book's identically-worded reprint.
      const martialArtistHangUpId = MARTIAL_ARTIST_HANGUP_IDS.find(id => actorHasHangUp(target, id));
      if (rolledEssence == 'social' && martialArtistHangUpId) {
        edge = true;
        addSource('martialArtistHangUp', findHangUp(target, martialArtistHangUpId)?.name ?? 'Martial Artist', { edge: true });
      }

      // Indoctrinated - see INDOCTRINATED_ID's own comment above. Same mirror-image reciprocal
      // Edge shape as Skeptic's own Hang-Up just above (helping the roller who's deceiving the
      // Hang-Up holder, not the holder themselves).
      if (rolledSkill == 'deception' && actorHasHangUp(target, INDOCTRINATED_HANGUP_ID)) {
        edge = true;
        addSource('indoctrinatedHangUp', findHangUp(target, INDOCTRINATED_HANGUP_ID)?.name ?? 'Indoctrinated', { edge: true });
      }

      // Skepticism (WTNV Citizen's Guide, General Perk, p.51) - see SKEPTICISM_ID's own comment
      // above. Reciprocal: the TARGET holds the Perk, the ROLLER suffers the downshift. Not
      // gated on isAttack - Weird is a plain Skill, not necessarily a weaponEffect.
      if (rolledSkill == 'weird' && actorHasPerk(target, SKEPTICISM_ID)) {
        shiftDown += 1;
        addSource('skepticism', findPerk(target, SKEPTICISM_ID)?.name ?? 'Skepticism', { shiftDown: 1 });
      }

      // See Something, Say Nothing (WTNV Citizen's Guide, General Perk, p.51) - see
      // SEE_SOMETHING_SAY_NOTHING_ID's own comment above. Reciprocal, same shape as Skepticism -
      // "coax or force information from you" is proxied as Persuasion or Deception targeting the
      // holder (this system has no dedicated "interrogation" skill), not gated on isAttack.
      if ((rolledSkill == 'persuasion' || rolledSkill == 'deception') && actorHasPerk(target, SEE_SOMETHING_SAY_NOTHING_ID)) {
        shiftDown += 1;
        addSource(
          'seeSomethingSayNothing', findPerk(target, SEE_SOMETHING_SAY_NOTHING_ID)?.name ?? 'See Something, Say Nothing',
          { shiftDown: 1 },
        );
      }

      // Dutiful (Transformers One Sourcebook, Influence Perk, p.9) - see DUTIFUL_ID's own comment
      // above. "Convince you to change your mind" is proxied as Persuasion targeting the holder,
      // not gated on isAttack (a plain Skill Test).
      if (rolledSkill == 'persuasion' && actorHasPerk(target, DUTIFUL_ID)) {
        snag = true;
        addSource('dutiful', findPerk(target, DUTIFUL_ID)?.name ?? 'Dutiful', { snag: true });
      }

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

      // Big And Scary - see BIG_AND_SCARY_ID's own comment above. Not gated on isAttack - RAW says
      // "Skill Tests," not "Attacks." "You count as 1 Size Class larger" is folded directly into
      // this Intimidation-only size-difference math (always beneficial for this specific clause),
      // rather than actually mutating actor.system.size.
      if (rolledSkill == 'intimidation' && actorHasPerk(actor, BIG_AND_SCARY_ID)) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        const bigAndScaryDifference = actorIndex != -1 && targetIndex != -1
          ? Math.max(0, (actorIndex + 1) - targetIndex)
          : 0;
        if (bigAndScaryDifference > 0) {
          shiftUp += bigAndScaryDifference;
          addSource(
            'bigAndScary', findPerk(actor, BIG_AND_SCARY_ID)?.name ?? 'Big And Scary', { shiftUp: bigAndScaryDifference },
          );
        }
      }

      // Big Preds Are My Specialty - see BIG_PREDS_ARE_MY_SPECIALTY_ID's own comment above. Not
      // gated on isAttack - RAW says "Infiltration Skill Tests," not "Attacks."
      if (rolledSkill == 'infiltration' && actorHasPerk(actor, BIG_PREDS_ARE_MY_SPECIALTY_ID)) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        const bigPredsDifference = actorIndex != -1 && targetIndex != -1
          ? Math.max(0, targetIndex - actorIndex)
          : 0;
        if (bigPredsDifference > 0) {
          shiftUp += bigPredsDifference;
          addSource(
            'bigPredsAreMySpecialty',
            findPerk(actor, BIG_PREDS_ARE_MY_SPECIALTY_ID)?.name ?? 'Big Preds Are My Specialty',
            { shiftUp: bigPredsDifference },
          );
        }
      }

      // Large And In Charge (Transformers CRB, Origin Perk, Monolith Chassis, p.51) - see its own
      // comment above (choiceType:'skills' picker). "↑1... if the target is smaller than you" - a
      // flat grant (not scaled by the size difference, unlike Big And Scary's own escalating
      // version above), checked against whichever Social skill the player chose.
      const largeAndInChargePerk = findPerk(actor, LARGE_AND_IN_CHARGE_ID);
      if (largeAndInChargePerk?.system.choice && rolledSkill == largeAndInChargePerk.system.choice) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (actorIndex != -1 && targetIndex != -1 && targetIndex < actorIndex) {
          shiftUp += 1;
          addSource('largeAndInCharge', largeAndInChargePerk.name, { shiftUp: 1 });
        }
      }

      // The Bigger The Heart - see BIGGER_THE_HEART_ID's own comment above. Same per-target
      // Size-difference shape as Big And Scary just above, but scoped to the actor's own chosen
      // Empathy skill instead of a hardcoded Intimidation, and a plain difference (no "count as 1
      // larger" beneficial twist - RAW states none here).
      const bigTenderPerk = findPerk(actor, EMPATHY_MLP_ID);
      if (bigTenderPerk?.system.choice && rolledSkill == bigTenderPerk.system.choice
        && actorHasPerk(actor, BIGGER_THE_HEART_ID)) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        const biggerHeartDifference = actorIndex != -1 && targetIndex != -1
          ? Math.max(0, targetIndex - actorIndex)
          : 0;
        if (biggerHeartDifference > 0) {
          shiftUp += biggerHeartDifference;
          addSource(
            'biggerTheHeart', findPerk(actor, BIGGER_THE_HEART_ID)?.name ?? 'The Bigger The Heart',
            { shiftUp: biggerHeartDifference },
          );
        }
      }

      // Brutal Might (Enigma of Combination, Pugilist Focus, 3rd level, p.38) - Edge half: "these
      // tests gain Edge if you are at least one Size Class larger than the target." Checked
      // against the weapon's own ORIGINAL classification skill (still 'might', untouched by the
      // substitution in documents/item.mjs) rather than rolledSkill, so this doesn't false-
      // positive on an unrelated genuine Brawn attack from a Perk holder.
      if (isAttack && item?.system?.classification?.skill == 'might' && actorHasPerk(actor, BRUTAL_MIGHT_ID)) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (actorIndex != -1 && targetIndex != -1 && actorIndex > targetIndex) {
          edge = true;
          addSource('brutalMight', findPerk(actor, BRUTAL_MIGHT_ID)?.name ?? 'Brutal Might', { edge: true });
        }
      }

      // Kill Your Double (WTNV Citizen's Guide, General Perk, p.49) - see KILL_YOUR_DOUBLE_ID's
      // own comment above. Gated on isAttack (RAW: "Attack Skill Tests").
      if (isAttack && actorHasPerk(actor, KILL_YOUR_DOUBLE_ID)
        && target.system.skills?.weird?.shift && target.system.skills.weird.shift != 'd20') {
        edge = true;
        addSource('killYourDouble', findPerk(actor, KILL_YOUR_DOUBLE_ID)?.name ?? 'Kill Your Double', { edge: true });
      }

      // Viral News Bloggers (WTNV Citizen's Guide, Journalist Role, Print Focus, p.38) - see its
      // own comment in rollSkill()'s damage-bonus computation above for the +1 damage half.
      if (isAttack && actorHasPerk(actor, VIRAL_NEWS_BLOGGERS_ID) && target.type == 'vehicle') {
        edge = true;
        addSource('viralNewsBloggers', findPerk(actor, VIRAL_NEWS_BLOGGERS_ID)?.name ?? 'Viral News Bloggers', { edge: true });
      }

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

      // Advanced Anti-Air Training - see ADVANCED_ANTI_AIR_TRAINING_ID's own comment above.
      if (rolledSkill == 'targeting' && target?.type == 'vehicle' && target.system.movement.aerial.base > 0
        && actorHasPerk(actor, ADVANCED_ANTI_AIR_TRAINING_ID)) {
        edge = true;
        addSource('advancedAntiAirTraining', findPerk(actor, ADVANCED_ANTI_AIR_TRAINING_ID)?.name ?? 'Advanced Anti-Air Training', { edge: true });
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

      // Indomitable (Wrecker Focus, 17th level, p.92) - the Snag half; "immune to the Frightened
      // Condition" lives in condition-immunity.mjs instead. Not gated on isAttack - Intimidation
      // is a plain Skill Test, not a weaponEffect.
      if (rolledSkill == 'intimidation' && actorHasPerk(target, INDOMITABLE_ID)) {
        snag = true;
        addSource('indomitable', findPerk(target, INDOMITABLE_ID)?.name ?? 'Indomitable', { snag: true });
      }

      // Keep Your Cool (A Jump Through Time, General Perk, p.53, built 2026-09-12) - the Snag
      // half; "immune to the Frightened Condition" lives in condition-immunity.mjs instead. Same
      // shape as Indomitable's own identical clause just above.
      if (rolledSkill == 'intimidation' && actorHasPerk(target, KEEP_YOUR_COOL_ID)) {
        snag = true;
        addSource('keepYourCool', findPerk(target, KEEP_YOUR_COOL_ID)?.name ?? 'Keep Your Cool', { snag: true });
      }

      // The Glory of Cobra-La (Ferocious Fighters, Cobra-La Faction Perk, p.73): "Effects that
      // cause the Frightened condition suffer Snag when they target you." Same reciprocal
      // target-status Snag shape as Indomitable just above - "effects that cause Frightened" maps
      // onto Intimidation specifically, the only Skill this codebase's own Frightened-imposing
      // mechanisms (Snarl, Absolute Menace, Menacing Glare, Frightening Display, etc.) ever use.
      if (rolledSkill == 'intimidation' && actorHasPerk(target, GLORY_OF_COBRA_LA_ID)) {
        snag = true;
        addSource('gloryOfCobraLa', findPerk(target, GLORY_OF_COBRA_LA_ID)?.name ?? 'The Glory of Cobra-La', { snag: true });
      }

      // Stubbornly Loyal (MLP CRB, Spirit of Loyalty, 9th level, p.90): "if somepony tries to
      // convince you of something bad about one of your BFFs with a Deception Skill Test, they
      // suffer Snag on that Skill Test." Same reciprocal-Snag shape as Indomitable just above -
      // "about one of your BFFs" is narrative context for the deception attempt, not a mechanical
      // BFF-roster lookup (the roll targets the holder's own judgment, not a specific ally), so
      // no BFF-roster infra is actually needed here; the "or tries to get you to turn on them
      // with a spell" half is dropped, no generic "manipulation spell" detection exists.
      if (rolledSkill == 'deception' && actorHasPerk(target, STUBBORNLY_LOYAL_ID)) {
        snag = true;
        addSource('stubbornlyLoyal', findPerk(target, STUBBORNLY_LOYAL_ID)?.name ?? 'Stubbornly Loyal', { snag: true });
      }

      // Durabyllium Super-Alloy - see DURABYLLIUM_SUPER_ALLOY_ID's own comment above. Applies to
      // any Attack (melee or ranged, unlike Sharpshooter's Grace above), keyed on the attack's own
      // damageType against the TARGET holding this Perk.
      if (item?.type == 'weaponEffect' && ['blunt', 'cold', 'fire'].includes(item.system.damageType)
        && actorHasPerk(target, DURABYLLIUM_SUPER_ALLOY_ID)) {
        snag = true;
        addSource(
          'durabylliumSuperAlloy',
          findPerk(target, DURABYLLIUM_SUPER_ALLOY_ID)?.name ?? 'Durabyllium Super-Alloy',
          { snag: true },
        );
      }

      // Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): "If anyone
      // attempts to search or scan for you using any Technology-based Skill Tests, they suffer a
      // Snag when attempting to find or identify you." Same reciprocal target-status Snag shape as
      // Indomitable above, gated on the target's own disguise actually being active - not gated on
      // isAttack (a scan is a plain Skill Test, not a weaponEffect).
      if (rolledSkill == 'technology' && actorHasPerk(target, OBSERVER_ID) && isObserverDisguiseActive(target)) {
        snag = true;
        addSource('observer', findPerk(target, OBSERVER_ID)?.name ?? 'Observer', { snag: true });
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

      if (!isAttack) {
        return {
          shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId,
          tooCloseForMinimumRange, pendingBonusesToClear, bonusDie, forcedMiss, moveLikeASongTriggered,
          spottedTarget, eyeForAppraisalTarget, projectileDancerTargetToMark, sources, zordbaneDamageBonus,
          oorahDamageBonus, isCatchOffGuardAttempt, cruelDamageBonus, exterminatorEligible, twoHeadsAssistanceConsumed,
        };
      }

      // Zeal (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72) - see ZEAL_ID's own
      // comment above. Gated on isAttack (unlike Indomitable's own plain-Skill-Test check above)
      // since "mind-affecting/mental Attack" is proxied by the weaponEffect's own Psychic damage
      // type, which only a real Attack (item) can carry.
      if (item?.system?.damageType == 'psychic' && actorHasPerk(target, ZEAL_ID)) {
        snag = true;
        addSource('zeal', findPerk(target, ZEAL_ID)?.name ?? 'Zeal', { snag: true });
      }

      // "Oh, What Now?" - see OH_WHAT_NOW_ID's own comment above.
      if (item?.system?.damageType == 'psychic' && actorHasPerk(target, OH_WHAT_NOW_ID)) {
        snag = true;
        addSource('ohWhatNow', findPerk(target, OH_WHAT_NOW_ID)?.name ?? '"Oh, What Now?"', { snag: true });
      }

      // Fight Me! (Beneath the Helmet, Graphite Ranger, 2nd level, p.46) - see
      // helpers/fight-me.mjs's own doc comment. Checks the ROLLER's own mark (they may be the
      // Threat someone else marked), downshifting an Attack against anyone but their marker.
      if (checkFightMeDownshift(actor, target)) {
        shiftDown += 1;
        addSource('fightMe', 'Fight Me!', { shiftDown: 1 });
      }

      // Distraction (Finster's Monster-Matic Cookbook, Path of Venom, 5th level, p.299): "ranged
      // Attacks against you suffer a downshift, until the beginning of your next turn." Ranged is
      // read as "not melee" (this function's own `isMelee`, computed above), matching every other
      // melee/ranged split in this codebase.
      if (!isMelee && isDistractionActive(target)) {
        shiftDown += 1;
        addSource('distraction', findPerk(target, DISTRACTION_ID)?.name ?? 'Distraction', { shiftDown: 1 });
      }

      // Mysterious Aura - Resplendent (A Jump Through Time, White Spectrum Modification,
      // replaces Follow Me!, p.45) - see helpers/mysterious-aura.mjs's own doc comment. Same
      // ranged-only reciprocal downshift shape as Distraction just above.
      if (!isMelee && hasNearbyResplendentAura(target)) {
        shiftDown += 1;
        addSource('mysteriousAuraResplendent', 'Mysterious Aura (Resplendent)', { shiftDown: 1 });
      }

      // Get Low - see GET_LOW_ID's own comment above. Alt Mode gated, same isTransformed check
      // Daredevil/Now You Don't already establish for their own Alt-Mode-only clauses.
      if (!isMelee && actorHasPerk(target, GET_LOW_ID) && target.system?.isTransformed) {
        shiftDown += 2;
        addSource('getLow', findPerk(target, GET_LOW_ID)?.name ?? 'Get Low', { shiftDown: 2 });
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

      // Worst Nightmare - see WORST_NIGHTMARE_ID's own comment above.
      if (target.statuses?.has('frightened') && actorHasPerk(actor, WORST_NIGHTMARE_ID)) {
        shiftUp += 1;
        addSource('worstNightmare', findPerk(actor, WORST_NIGHTMARE_ID)?.name ?? 'Worst Nightmare', { shiftUp: 1 });
      }

      // Projectile Dancer - see PROJECTILE_DANCER_ID's own comment above. This function is
      // synchronous and can't mark the TARGET's own once-per-scene flag itself - same reasoning
      // as debilitatedConsumed/enemyNumberOneTankId above - so it just reports which actor to
      // mark, and rollSkill() performs the actual write afterward.
      if (item?.system?.classification?.style == 'projectile' && actorHasPerk(target, PROJECTILE_DANCER_ID)
        && !hasUsedThisEncounter(target, 'projectileDancerUsedThisEncounter')) {
        snag = true;
        addSource('projectileDancer', findPerk(target, PROJECTILE_DANCER_ID)?.name ?? 'Projectile Dancer', { snag: true });
        projectileDancerTargetToMark = target;
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

      // Giant-Killer (PR CRB, General Perk, p.95): "+1 with attacks on targets at least two Size
      // Classes larger than you. Additionally, Edge on attacks on targets more than five Size
      // Classes larger than you." Both thresholds measured on E20.actorSizes' own ordered ladder
      // (the same one _getSizeShift reads), not the derived sizeShift number above - RAW's own
      // "two Size Classes" is a raw ladder-index difference, not that generic table's halved value.
      const giantKillerPerk = GIANT_KILLER_IDS.map(id => findPerk(actor, id)).find(Boolean);
      if (giantKillerPerk) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        const sizeDifference = actorIndex != -1 && targetIndex != -1 ? targetIndex - actorIndex : 0;
        if (sizeDifference >= 2) {
          shiftUp += 1;
          addSource('giantKiller', giantKillerPerk.name ?? 'Giant-Killer', { shiftUp: 1 });
        }

        if (sizeDifference > 5) {
          edge = true;
          addSource('giantKillerEdge', giantKillerPerk.name ?? 'Giant-Killer', { edge: true });
        }
      }

      // Spared No Expense (Ferocious Fighters, Dino-Hunters Faction Perk, p.73): "Edge on attacks
      // that target creatures larger than you." Same Size-ladder comparison idiom as Giant-Killer
      // just above, but any positive size difference qualifies (no minimum threshold).
      if (actorHasPerk(actor, SPARED_NO_EXPENSE_ID)) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (actorIndex != -1 && targetIndex != -1 && targetIndex > actorIndex) {
          edge = true;
          addSource('sparedNoExpense', findPerk(actor, SPARED_NO_EXPENSE_ID)?.name ?? 'Spared No Expense', { edge: true });
        }
      }

      // Team Focus (Red Ranger, 9th/18th level, p.53) - see helpers/team-focus.mjs's own doc
      // comment for the round-granularity approximation of "since your last turn."
      if (isMelee && checkTeamFocus(actor, target, TEAM_FOCUS_ID)) {
        const teamFocusShiftUp = findPerk(actor, TEAM_FOCUS_ID).system.advances.currentValue;
        shiftUp += teamFocusShiftUp;
        addSource('teamFocus', findPerk(actor, TEAM_FOCUS_ID)?.name ?? 'Team Focus', { shiftUp: teamFocusShiftUp });
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

      // Rifle Tally (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 20th level, p.28):
      // "your attacks from air vehicles gain Edge when attacking non-aerial targets." Gated on
      // the actor currently riding ANY air vehicle (_getPilotedVehicle with no role argument -
      // matches either crew/driver, the same "riding in some vehicle" shape Aerial Interface's
      // own driver-only check deliberately narrows from) and the target not itself having any
      // Aerial Movement of its own.
      if (actorHasPerk(actor, RIFLE_TALLY_ID) && target.system.movement?.aerial?.base == 0
        && this._getPilotedVehicle(actor)?.system.movement.aerial.base > 0) {
        edge = true;
        addSource('rifleTally', findPerk(actor, RIFLE_TALLY_ID)?.name ?? 'Rifle Tally', { edge: true });
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
        || targetStatuses.has('unconscious')
        || targetStatuses.has('actingSmaller')
        || (isMelee && targetStatuses.has('prone'))
        || hasUsedThisRound(target, ALPHA_STRIKE_ROUND_FLAG);

      if (targetGrantsEdge) {
        edge = true;
      }

      // Cruel - see CRUEL_ID's own comment above. "One or more Conditions" checked against the
      // target's own live status set directly, independent of targetGrantsEdge's own narrower
      // fixed list above (Cruel's own Edge fires for ANY Condition, not just those 8).
      if (target.statuses?.size > 0 && actorHasPerk(actor, CRUEL_ID)) {
        edge = true;
        addSource('cruel', findPerk(actor, CRUEL_ID)?.name ?? 'Cruel', { edge: true });
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
      // category, since they aren't actually smaller).
      if (actorHasPerk(actor, EXTERMINATOR_ID)
        && (target.system.size == 'common' || target.system.size == 'small')) {
        const sizeOrder = Object.keys(E20.actorSizes);
        const actorIndex = sizeOrder.indexOf(actor.system.size);
        const targetIndex = sizeOrder.indexOf(target.system.size);
        if (actorIndex != -1 && targetIndex != -1 && targetIndex < actorIndex) {
          exterminatorEligible = true;
          shiftUp += 1;
          addSource('exterminator', findPerk(actor, EXTERMINATOR_ID)?.name ?? 'Exterminator', { shiftUp: 1 });
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

      if (targetStatuses.has('unconscious')) {
        addSource('targetUnconscious', this._localize('E20.StatusUnconscious'), { edge: true });
      }

      if (targetStatuses.has('actingSmaller')) {
        addSource('targetActingSmaller', this._localize('E20.StatusActingSmaller'), { edge: true });
      }

      if (isMelee && targetStatuses.has('prone')) {
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

      // Cruel - the damage half, see CRUEL_ID's own comment above. Not its own addSource entry,
      // same as Zordbane's identical damage bonus just below - addSource only models
      // shiftUp/shiftDown/edge/snag, not a flat damage add.
      if ((targetStatuses.has('immobilized') || targetStatuses.has('restrained')) && actorHasPerk(actor, CRUEL_ID)) {
        cruelDamageBonus = 1;
      }

      if (targetStatuses.has('invisible')) {
        snag = true;
        addSource('targetInvisible', this._localize('E20.StatusInvisible'), { snag: true });
      }

      if (!isMelee && targetStatuses.has('prone')) {
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
      // Penetrating Rounds (Door-Kicker Focus, 20th level, p.100): "your attacks with shotguns
      // and submachine guns ignore cover" - the first of its two clauses (the second, ignoring
      // deflective armor bonuses, lives in rollSkill()'s own Defense-comparison step instead,
      // since that's target Defense math, not a roll shift).
      // Maximize Cover (Decepticon Directive Raider, 7th level, p.61): "while you have cover,
      // enemies suffer a downshift 3 on ranged attacks against you (instead of the normal
      // downshift 2)." A one-line widening of the base Cover check right above - gated on the
      // TARGET holding the Perk, same "actorHasPerk(target, ...)" idiom every other reciprocal
      // target-status check in this loop already uses (Trustworthy, Indomitable, etc.).
      // Bulwark (Tank Focus, 17th level, p.99): "provide cover to allies adjacent to you" - a
      // live reciprocal check (the target counts as having Cover whenever a planted Bulwark
      // holder is within 5ft), rather than toggling a real 'cover' status on every nearby ally as
      // the Bulwark holder moves (no movement-completion hook exists to keep that in sync). Same
      // "scan canvas.tokens.placeables for a qualifying nearby granter" shape
      // hasNearbyDefendersOathProtection/_hasNearbyProtectorsShieldImmunity already establish.
      const hasBulwarkCover = !isMelee && targetToken && this._hasNearbyBulwarkCover(targetToken);
      // Now You Don't (Transformers CRB, General Perk, p.110): "as long as you remain in Alt
      // Mode, you are considered to have Cover, even when out in the open." A live reciprocal
      // check, same shape as Bulwark's own "counts as having Cover" grant just above, gated on
      // actor.system.isTransformed (see DAREDEVIL_ID's own comment for why this field exists and
      // is safe to key off). The "+5 on a Hide Skill Test" half isn't built - no "Hide action"
      // concept exists anywhere in this codebase to add a bonus onto.
      const hasNowYouDontCover = actorHasPerk(target, NOW_YOU_DONT_ID) && target.system.isTransformed;
      if (!isMelee && (targetStatuses.has('cover') || targetStatuses.has('totalCover') || hasBulwarkCover || hasNowYouDontCover)
        && !this._isPenetratingRoundsAttack(actor, item) && !this._isKentuckyWindageAttack(actor, item)) {
        // Lay of the Land (Enigma of Combination, Surveyor Focus, 3rd level, p.36): "ignore the
        // -1 penalty imposed on ranged attacks from terrain or environmental-based Cover" - the
        // "in the terrain you scouted for Cartography Suite" precondition is dropped (Cartography
        // Suite's own area-designation concept isn't tracked anywhere), same as What Cover?'s own
        // identical-shaped reduction. Two Steps to the Right (10th level, p.36) shares this (and
        // Lay of the Land's own Infiltration/Survival Edge, a plain compendium Active Effect) with
        // allies within 60ft - "open communication" dropped as unenforceable.
        const hasLayOfTheLandCoverReduction = actorHasPerk(actor, WHAT_COVER_ID) || actorHasPerk(actor, LAY_OF_THE_LAND_ID)
          || getNearbyAllyTokens(actor, 60).some(token => actorHasPerk(token.actor, TWO_STEPS_TO_THE_RIGHT_ID));
        let coverShiftDown = actorHasPerk(target, MAXIMIZE_COVER_ID) || actorHasPerk(target, HARD_TARGET_TF_ID) ? 3 : 2;
        // Nowhere's Safe / Absolutely Nowhere's Safe (Transformers CRB, Gunner base, 5th/13th
        // level, p.68): "you suffer one fewer ↓1" then "two fewer ↓1, to a maximum of ↓0" on
        // Cover when attacking a target in it - an attacker-side reduction (distinct from GI Joe
        // CRB's own same-named Focus: Heavy Ordnance Perk, a different compendium item), same
        // family as What Cover?/Lay of the Land's identical -1 reduction just escalated further.
        if (actorHasPerk(actor, ABSOLUTELY_NOWHERES_SAFE_ID)) {
          coverShiftDown = Math.max(0, coverShiftDown - 2);
        } else if (hasLayOfTheLandCoverReduction || actorHasPerk(actor, NOWHERES_SAFE_TF_ID)) {
          coverShiftDown = Math.max(0, coverShiftDown - 1);
        }

        // Dig In (Enigma of Combination, Cannoneer Focus, 17th level, p.32) - see
        // helpers/cannoneer-dig-in.mjs's own doc comment: "Cover imposes an additional -1 to
        // attacks against you" while dug in, on top of whatever base Cover penalty applies above.
        if (actorHasPerk(target, CANNONEER_DIG_IN_ID) && isCannoneerDugIn(target)) {
          coverShiftDown += 1;
        }

        shiftDown += coverShiftDown;
        addSource('cover', this._localize('E20.StatusCover'), { shiftDown: coverShiftDown });
      }

      // Dig In (Decepticon Directive Raider, Siegemaster Focus, 10th level, p.64): "while dug in,
      // attacks that attempt to grapple, shove, or trip you suffer Snag." Maneuver-damageType
      // attacks are this system's own existing representation of grapple/shove/trip-style attacks
      // (same damageType Barrel Through's own upshift already checks) - gated on the target
      // actually being in the Perk's own toggled stance (helpers/dig-in.mjs), not just holding
      // the Perk (the Prone-immunity half is gated the same way, in condition-immunity.mjs).
      if (item.system.damageType == 'maneuver' && actorHasPerk(target, DIG_IN_ID) && isDugIn(target)) {
        snag = true;
        addSource('digIn', findPerk(target, DIG_IN_ID)?.name ?? 'Dig In', { snag: true });
      }

      // Mega Training Regimen (Ferocious Fighters, Mega Marines Faction Perk, p.74): "Attempts to
      // Grapple, Shove, or Trip you suffer Snag." Same Maneuver-damageType proxy as Dig In just
      // above, but unconditional - this is a permanent Faction benefit, not a toggled stance, so
      // there's no isDugIn()-style gate to also check.
      if (item.system.damageType == 'maneuver' && actorHasPerk(target, MEGA_TRAINING_REGIMEN_ID)) {
        snag = true;
        addSource('megaTrainingRegimen', findPerk(target, MEGA_TRAINING_REGIMEN_ID)?.name ?? 'Mega Training Regimen',
          { snag: true });
      }

      // Steady Footing (Factions in Action Vol. 2, Oktober Guard General Perk, p.95; prerequisite:
      // Acrobatics or Athletics +d6): "Attempts to Grapple, Shove, or Trip you suffer ↓1." Same
      // Maneuver-damageType proxy as Mega Training Regimen just above, but a downshift instead of
      // a full Snag. "If the attempt Fumbles, you can immediately counter-attempt with ↑1" is
      // Needs new infrastructure (the still-missing "react to an enemy's failed/Fumbled attack
      // against you" hook).
      if (item.system.damageType == 'maneuver' && actorHasPerk(target, STEADY_FOOTING_ID)) {
        shiftDown += 1;
        addSource('steadyFooting', findPerk(target, STEADY_FOOTING_ID)?.name ?? 'Steady Footing', { shiftDown: 1 });
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
        if (normalRange && distance > normalRange && (!longRange || distance <= longRange)
          && !actorHasPerk(actor, LONG_SHOT_TF_ID) && !actorHasPerk(actor, SHARPSHOOTERS_GRACE_ID)
          && !actorHasPerk(actor, SHARPSHOOTERS_GRACE_GIJ_ID) && !actorHasPerk(actor, SHARPSHOOTERS_GRACE_TF_ID)
          && !isJuryRigBenefitActive(actor, 'cleanBarrels')) {
          snag = true;
          addSource('longRange', this._localize('E20.CombatModifierLongRange'), { snag: true });
        }

        // Sharpshooter's Grace's own second clause: "+2 on ranged attacks made at targets within
        // 30 feet." Same either-book grant as the suppression above.
        if (distance <= 30
          && (actorHasPerk(actor, SHARPSHOOTERS_GRACE_ID) || actorHasPerk(actor, SHARPSHOOTERS_GRACE_GIJ_ID))) {
          shiftUp += 2;
          const sharpshootersGracePerk = findPerk(actor, SHARPSHOOTERS_GRACE_ID) ?? findPerk(actor, SHARPSHOOTERS_GRACE_GIJ_ID);
          addSource('sharpshootersGrace', sharpshootersGracePerk?.name ?? "Sharpshooter's Grace", { shiftUp: 2 });
        }

        // Transformers CRB's own Sharpshooter's Grace (a distinct item, see
        // SHARPSHOOTERS_GRACE_TF_ID's own comment above) - the OPPOSITE direction: "+2 on ranged
        // attacks made at targets FARTHER than 30 feet away."
        if (distance > 30 && actorHasPerk(actor, SHARPSHOOTERS_GRACE_TF_ID)) {
          shiftUp += 2;
          addSource(
            'sharpshootersGraceTf',
            findPerk(actor, SHARPSHOOTERS_GRACE_TF_ID)?.name ?? "Sharpshooter's Grace",
            { shiftUp: 2 },
          );
        }


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
        const menaceWeaponSourceId = menaceWeapon?.flags?.core?.sourceId ?? menaceWeapon?._stats?.compendiumSource;
        const isMenaceWeapon = actorHasPerk(actor, MENACE_ID)
          && (menaceWeaponSourceId == SHOTGUN_ID || menaceWeaponSourceId == SUBMACHINE_GUN_ID);
        if (enemyReach && distance <= enemyReach && !isMenaceWeapon && !actorHasPerk(actor, CQB_TRAINING_ID)) {
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
          if (attackerElevation - targetElevation >= 30) {
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

      if (target.system.resistances?.[item.system.damageType] || hasLanceOfLightResistance
        || hasDefensiveFlexibilityResistanceToThis) {
        if (!ignoringResistanceViaMaximizeFlaws) {
          snag = true;
          addSource('resistance', this._localize('E20.CombatModifierResistance'), { snag: true });
        }
      } else if (ignoringResistanceViaMaximizeFlaws) {
        edge = true;
        addSource('maximizeFlaws', findPerk(actor, MAXIMIZE_FLAWS_ID)?.name ?? 'Maximize Flaws', { edge: true });
      }

      // Duck & Cover (Infantry/Renegade base, shared compendium Item, p.80): "gain resistance to
      // damage from explosives, traps, and other harmful area of effect attacks" (Infantry's own
      // phrasing) - Renegade's identical Item instead says "suffer a Snag when attacking you,"
      // which is the same thing, since this system's own Resistance rule right above is already
      // defined as "a Snag on the attack roll." "Traps" has no hook anywhere in this system (not
      // modeled as an attacking Item at all); explosive-style weapons and area-trait weapons both
      // do.
      if (actorHasPerk(target, DUCK_AND_COVER_ID)) {
        const weapon = this._getParentWeapon(actor, item);
        const isExplosiveOrAoe = item.system.classification?.style == 'explosive'
          || !!weapon?.system.traits.includes('area');
        if (isExplosiveOrAoe) {
          snag = true;
          addSource('duckAndCover', findPerk(target, DUCK_AND_COVER_ID)?.name ?? 'Duck & Cover', { snag: true });
        }
      }

      // Paranoia (18th level): "Attacks against you suffer a Snag" - unconditional, any attack.
      if (actorHasPerk(target, PARANOIA_ID)) {
        snag = true;
        addSource('paranoia', findPerk(target, PARANOIA_ID)?.name ?? 'Paranoia', { snag: true });
      }

      // Gallantry (Infantry base, 2nd level, p.79): "any effect that would cause the Frightened
      // Condition that targets you suffers a Snag." The only thing in this system that can
      // currently cause Frightened is Trigger Happy's own Willpower compare (see
      // _isTriggerHappyAttack) - this Snags the WHOLE attack roll rather than just that one
      // comparison, since there's no way to Snag one comparison independently of another sharing
      // the same roll total; matches the same "Snag the roll, not the compare" idiom Duck &
      // Cover/Paranoia/Resistance above all already use for target-side effects. The halved-
      // duration clause has no hook (nothing in this system tracks a Condition's remaining
      // duration to halve).
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
      // last activated (helpers/shield-modulation.mjs) instead of unconditional. Same scope as
      // Impenetrable Shield's own check too - only the shield-holder's own Perk/shield, not
      // extended to Shield-Upgraded allies (neither check does that).
      if (
        isPersonalShieldActive(target) && actorHasPerk(target, SHIELD_MODULATION_ID)
        && item.system.damageType == getShieldModulationDamageType(target)
      ) {
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

      // Zordbane (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 8th level, p.284): "Whenever
      // targeting a Zord, gain an upshift to the attack Skill Test and deal +1 additional damage."
      // The damage half is reported back via zordbaneDamageBonus (read in rollSkill's own
      // damageBonusValue accumulator, the same "a fact computed here, folded in there" shape
      // enemyNumberOneTankId's own return field already established).
      if (target?.type == 'zord' && actorHasPerk(actor, ZORDBANE_ID)) {
        shiftUp += 1;
        addSource('zordbane', findPerk(actor, ZORDBANE_ID)?.name ?? 'Zordbane', { shiftUp: 1 });
        zordbaneDamageBonus = 1;
      }

      // Oorah!/Catch Off Guard - see OORAH_ID/CATCH_OFF_GUARD_ID's own comments above. Both key
      // off the same "Surprised" proxy (the target hasn't acted yet this combat, the same First
      // Strike-established check above, re-derived here since First Strike's own version isn't
      // gated on isAttack and this needs to be). Oorah!'s +1 damage is reported back via
      // oorahDamageBonus, the same "computed here, folded into damageBonusValue there" shape
      // Zordbane just above establishes; Catch Off Guard's Stun bonus needs the attack to
      // actually land, so it's only flagged here (isCatchOffGuardAttempt) and applied in
      // _rollSkillHelper's own post-hit processing.
      const targetCombatantForSurprise = game.combat?.combatants?.find(c => c.actor?.uuid == target?.uuid);
      const isSurprisedTarget = !!targetCombatantForSurprise
        && game.combat.turns.indexOf(targetCombatantForSurprise) > game.combat.turn;
      if (isSurprisedTarget && actorHasPerk(actor, OORAH_ID)) {
        oorahDamageBonus = 1;
      }

      isCatchOffGuardAttempt = isSurprisedTarget && actorHasPerk(actor, CATCH_OFF_GUARD_ID);

      // Goin' Heels (A Jump Through Time, General Perk, p.54, built 2026-09-12) - the "against
      // enemies lower in the Initiative order" shiftUp half only, scoped to a one-handed Targeting
      // Sidearm attack (the parent weapon's own classification fields). The "+1 base damage while
      // highest in Initiative" half isn't built - would need its own damageBonus round-trip back
      // through rollSkill()'s own computation (the same "computed here, folded in there" shape
      // Zordbane/Oorah! establish), left as a documented follow-on rather than forced in here.
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
      }

      // Seconds Between Click & Boom (9th level): "attacks against your Evasion Defense suffer a
      // Snag." (The "if your attacker misses, you suffer no effects" half has no hook to apply
      // automatically - not implemented, a known gap.)
      if (item.system.defenseType == 'evasion' && actorHasPerk(target, SECONDS_BETWEEN_CLICK_AND_BOOM_ID)) {
        snag = true;
        addSource(
          'secondsBetweenClickAndBoom',
          findPerk(target, SECONDS_BETWEEN_CLICK_AND_BOOM_ID)?.name ?? 'Seconds Between Click & Boom',
          { snag: true },
        );
      }

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

      // Move Like a Song (Green Ranger, Survival Boon choice, p.44): "The first attack that
      // targets you each round has a Snag. If that attack already has a Snag, it automatically
      // misses instead." Checked last among this function's own Snag-granting checks so it sees
      // the fullest possible already-has-a-Snag state before deciding between the two - doesn't
      // account for a Snag from outside this function (e.g. the actor/essence's own base Snag),
      // the same "close enough" limit every other approximation in this function already accepts.
      // Only the Snag branch gets its own source entry - the forcedMiss branch is a hard outcome
      // (like tooCloseForMinimumRange), not a toggleable shift/edge/snag contribution.
      if (game.combat && actorHasPerk(target, MOVE_LIKE_A_SONG_ID)
        && !hasUsedThisRound(target, MOVE_LIKE_A_SONG_ROUND_FLAG)) {
        if (snag) {
          forcedMiss = true;
        } else {
          snag = true;
          addSource('moveLikeASong', findPerk(target, MOVE_LIKE_A_SONG_ID)?.name ?? 'Move Like a Song', { snag: true });
        }

        moveLikeASongTriggered = true;
      }
    }

    return {
      shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId, tooCloseForMinimumRange,
      pendingBonusesToClear, bonusDie, forcedMiss, moveLikeASongTriggered, spottedTarget, eyeForAppraisalTarget,
      projectileDancerTargetToMark, sources, zordbaneDamageBonus, oorahDamageBonus, isCatchOffGuardAttempt,
      cruelDamageBonus, exterminatorEligible, twoHeadsAssistanceConsumed,
    };
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
      && EXPERTISE_PERK_IDS.includes(actorItem._stats?.compendiumSource)
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
    for (const crewMember of Object.values(vehicleActor.system?.actors ?? {})) {
      if (crewMember.vehicleRole == 'driver') {
        const driver = fromUuidSync(crewMember.uuid);
        if (driver) {
          return driver;
        }
      }
    }

    return null;
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
   * Sideswipe (Factions in Action Vol. 2, p.64) - see its own checkContext.isSideswipeAttempt
   * comment above for the full RAW discussion and the "match by name" reasoning.
   * @param {Actor} actor   The actor performing the roll (the vehicle, not the driver).
   * @param {Item} item   The weaponEffect being rolled.
   * @returns {Boolean}
   * @private
   */
  _isSideswipeAttack(actor, item) {
    if (actor?.type != 'vehicle' || item?.type != 'weaponEffect') {
      return false;
    }

    const name = item.name?.toLowerCase().trim();
    if (name != 'ram' && name != 'flyby' && name != 'fly by') {
      return false;
    }

    const driver = this._getVehicleDriver(actor);
    return !!driver && actorHasPerk(driver, SIDESWIPE_ID);
  }

  /**
   * Demolition Driver (Factions in Action Vol. 2, p.64) - see its own DEMOLITION_DRIVER_ID
   * comment above. Ram-only, otherwise the same "vehicle roller, checked via its driver, matched
   * by the attack's own name" shape as _isSideswipeAttack.
   * @param {Actor} actor   The actor performing the roll (the vehicle, not the driver).
   * @param {Item} item   The weaponEffect being rolled.
   * @returns {Boolean}
   * @private
   */
  _isDemolitionDriverAttack(actor, item) {
    if (actor?.type != 'vehicle' || item?.type != 'weaponEffect' || item.name?.toLowerCase().trim() != 'ram') {
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
    return parentId ? actor.items.get(parentId) : null;
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
  _isPenetratingRoundsAttack(actor, item) {
    if (item?.type != 'weaponEffect' || !actorHasPerk(actor, PENETRATING_ROUNDS_ID)) {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource;
    return weaponSourceId == SHOTGUN_ID || weaponSourceId == SUBMACHINE_GUN_ID;
  }

  /**
   * Kentucky Windage (Sniper Focus, 10th level, p.75) - see KENTUCKY_WINDAGE_ID's own comment.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  _isKentuckyWindageAttack(actor, item) {
    if (item?.type != 'weaponEffect' || !actorHasPerk(actor, KENTUCKY_WINDAGE_ID)) {
      return false;
    }

    const weapon = this._getParentWeapon(actor, item);
    return !!weapon?.system.traits.includes('sniper');
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
    const weaponSourceId = weapon?.flags?.core?.sourceId ?? weapon?._stats?.compendiumSource;
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
      return;
    }

    await roll.evaluate();

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

    // Time Traveler's own Hang-Up - see TIME_TRAVELER_HANGUP_ID's own comment above. Widens the
    // ordinary natural-1-only Fumble with an extra natural-2 case, gated on the actor's own
    // already-resolved skill die size for this roll (d4 or lower).
    if (!isFumble && ['d2', 'd4'].includes(rollContext.finalShift) && actorHasHangUp(actor, TIME_TRAVELER_HANGUP_ID)) {
      const d20Pool = roll.dice.find(pool => pool.faces === 20);
      if (d20Pool?.values.some(value => value === 1 || value === 2)) {
        isFumble = true;
      }
    }

    // Cruel Warlord (Finster's Monster-Matic Cookbook, 20th level, p.284): "Whenever you Fumble a
    // Skill Test... you regain 2 Personal Power." (The "...or suffer Psychic damage" half lives in
    // combat.mjs#applyDamage's own grantCruelWarlordPsychicRegen instead.)
    if (isFumble && actorHasPerk(actor, CRUEL_WARLORD_ID) && actor.system.powers?.personal) {
      await actor.update({
        'system.powers.personal.value': Math.min(actor.system.powers.personal.max, actor.system.powers.personal.value + 2),
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
    }

    let powerfulSuggestionConsumed = false;
    let suckerPunchConsumed = false;
    let silverMedalSyndromeTriggered = false;
    const results = checkContext.entries.map(entry => {
      let multiplier = computeMultiplier(roll.total, entry.difficulty);
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
      if (multiplier >= 2 && actorHasPerk(actor, SILVER_MEDAL_SYNDROME_ID)) {
        silverMedalSyndromeTriggered = true;
      }

      const success = multiplier > 0;
      // Only a resolved target actor (not a flat @Check[dif=...] entry) can take Health damage.
      const canApplyDamage = success && entry.targetUuid && checkContext.damageValue;
      // Trigger Happy - an independent compare against the same roll total, not gated on
      // `success` above (RAW: "...in addition to their Toughness or Evasion").
      const frightened = checkContext.triggerHappy && entry.targetUuid && entry.willpowerDifficulty != null
        && computeMultiplier(roll.total, entry.willpowerDifficulty) > 0;
      // Explosive Aftershock - see isExplosiveAftershockAttack's own comment in rollSkill() above.
      // Same independent-compare shape as Trigger Happy's frightened just above.
      const explosiveAftershock = checkContext.isExplosiveAftershockAttack && entry.targetUuid
        && entry.toughnessDifficulty != null && computeMultiplier(roll.total, entry.toughnessDifficulty) > 0;

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
        criticalOptions: canApplyDamage ? criticalOptions : [],
        isMightMelee: canApplyDamage ? checkContext.isMightMelee : false,
        frightened,
        explosiveAftershock,
      };
    });

    if (powerfulSuggestionConsumed) {
      await clearPendingBonus(actor, POWERFUL_SUGGESTION_FLAG);
    }

    if (suckerPunchConsumed) {
      await markUsedThisEncounter(actor, SUCKER_PUNCH_ENCOUNTER_FLAG);
    }

    if (silverMedalSyndromeTriggered) {
      await bankPendingBonus(actor, 'pendingSilverMedalSyndrome', { shiftUp: 1 });
    }

    await this._applyImmovableObjectImmunity(results);
    await this._applyPlatePiercingVehicleDamage(actor, results, checkContext);
    await this._applyRazeAndRuinDamage(actor, results, checkContext);
    await this._applySmashDamage(actor, results, checkContext);
    this._applyFlameWarlordCritDamage(actor, results);
    this._applyEmptyTheMag(results, checkContext);
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

    // Watchful Eyes (Strategist Focus, 6th level, p.68) - see isWatchfulEyesAttempt's own comment
    // above. Marks every currently-targeted actor of the opposite disposition, on a successful
    // roll against the flat DIF 10 (the roll's only entry, since dataset.dif produces a single
    // targetUuid: null entry rather than one per target).
    if (checkContext.isWatchfulEyesAttempt && results[0]?.success) {
      const attackerToken = actor.getActiveTokens?.()?.[0];
      for (const targetToken of game.user.targets) {
        if (targetToken.actor && targetToken.document.disposition != attackerToken?.document.disposition) {
          await markDebilitated(targetToken.actor);
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

    // Words Can Hurt! (Enigma of Combination, Counselor Focus, 6th level, p.34) - see
    // helpers/words-can-hurt.mjs's own doc comment. Same shape as Voice of Primus just above.
    if (checkContext.isWordsCanHurtAttempt && results[0]?.success && checkContext.wordsCanHurtTargetUuid) {
      const wordsCanHurtTarget = await fromUuid(checkContext.wordsCanHurtTargetUuid);
      if (wordsCanHurtTarget) {
        await applyWordsCanHurtEffect(wordsCanHurtTarget);
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

    // Illusory Disguise (Finster's Monster-Matic Cookbook, Sorcerous Power, p.273) - see
    // helpers/illusory-disguise.mjs's own doc comment. On a successful DIF 12 Culture (Arcane)
    // roll, activate the disguise (a one-way flag, no toggle-off).
    if (checkContext.isIllusoryDisguiseAttempt && results[0]?.success) {
      await activateIllusoryDisguise(actor);
    }

    // Healing Bandages (MLP CRB, Elementary Aid spell, p.136): "Your touch is able to heal
    // wounds... The target creature Heals 2 damage." Not an Attack (Range: Reach, no Defense
    // compared against) - cast against the spell's own flat casting DIF like any non-Attack spell,
    // the player entering it manually the same way every other spell cast already works. On a
    // successful cast, heals whichever token is currently targeted (or the caster themselves with
    // nothing targeted, matching "Reach" including yourself).
    if (checkContext.spellSourceId == HEALING_BANDAGES_ID && results[0]?.success) {
      const healTarget = game.user.targets.first()?.actor ?? actor;
      await healTarget.update({
        'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + 2),
      });
    }

    // Humanitarian - see helpers/humanitarian.mjs's own doc comment. Same "heal whichever token
    // is currently targeted, or self with nothing targeted" shape as Healing Bandages just above.
    if (checkContext.isHumanitarianAttempt && results[0]?.success) {
      const healTarget = game.user.targets.first()?.actor ?? actor;
      await healTarget.update({
        'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + 1),
      });
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

    // Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21) - see
    // helpers/dsoe-disguise.mjs's own doc comment. On a successful cast, activates the disguise on
    // whichever token is currently targeted, or the caster themselves.
    if (checkContext.spellSourceId == DSOE_DISGUISE_ID && results[0]?.success) {
      const disguiseTarget = game.user.targets.first()?.actor ?? actor;
      await applyDsoeDisguise(disguiseTarget);
    }

    // Smoke Beam (Dark Skies Over Equestria, Superior Beam spell, p.22) - "You cloud a creature's
    // vision, temporarily giving them the Blinded Condition." A real Attack (Beam circle), no
    // damage - applies Blinded to a successfully-hit target, same per-result shape Mind Beam's own
    // identical no-damage-Condition application already established.
    if (checkContext.spellSourceId == SMOKE_BEAM_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const smokeBeamTarget = await fromUuid(result.targetUuid);
        if (smokeBeamTarget) {
          await smokeBeamTarget.toggleStatusEffect('blinded', { active: true });
        }
      }
    }

    // The Stare (Knights of Canterlot, Superior Beam spell, p.48) - "Make a Spellcasting Attack
    // Test against a target within range. On a success, the target gains the Frightened
    // condition." Same no-damage-Condition-application shape as Smoke Beam/Mind Beam above.
    if (checkContext.spellSourceId == KOC_THE_STARE_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const theStareTarget = await fromUuid(result.targetUuid);
        if (theStareTarget) {
          await theStareTarget.toggleStatusEffect('frightened', { active: true });
        }
      }
    }

    // Rope Trick (Knights of Canterlot, Elementary Utility spell, p.44) - "A successful attack
    // with the lasso will Immobilize a target." Same shape as The Stare above.
    if (checkContext.spellSourceId == KOC_ROPE_TRICK_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const ropeTrickTarget = await fromUuid(result.targetUuid);
        if (ropeTrickTarget) {
          await ropeTrickTarget.toggleStatusEffect('immobilized', { active: true });
        }
      }
    }

    // Shower Power (Knights of Canterlot, Elementary Beam spell, p.44) - "a powerful stream of
    // water that can knock your target Prone." Same shape as Barreling Beam's own Prone
    // application, but unconditional on any success (RAW names no Critical Success requirement
    // here, unlike Barreling Beam's own identical-sounding clause).
    if (checkContext.spellSourceId == KOC_SHOWER_POWER_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const showerPowerTarget = await fromUuid(result.targetUuid);
        if (showerPowerTarget) {
          await showerPowerTarget.toggleStatusEffect('prone', { active: true });
        }
      }
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
    // against) - cast against the spell's own flat casting DIF like Healing Bandages above. On a
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

    // Super Sticky Celebration String (Knights of Canterlot, Virtuoso Beam spell, p.51) - "the
    // target gets wrapped up...gaining the Grappled, Immobilized and Impaired conditions." Same
    // per-target loop shape as The Stare/Rope Trick/Shower Power above, applying all 3 at once.
    if (checkContext.spellSourceId == KOC_SUPER_STICKY_CELEBRATION_STRING_ID) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const stickyStringTarget = await fromUuid(result.targetUuid);
        if (stickyStringTarget) {
          await stickyStringTarget.toggleStatusEffect('grappled', { active: true });
          await stickyStringTarget.toggleStatusEffect('immobilized', { active: true });
          await stickyStringTarget.toggleStatusEffect('impaired', { active: true });
        }
      }
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

    // Block Magic (Knights of Canterlot, Virtuoso Enchantment spell, p.49) - see
    // helpers/block-magic.mjs's own doc comment. A real Spellcasting Attack Test against the
    // target's Willpower - on a hit, applies the flag to the target (not the caster), same
    // per-target loop shape as The Stare/Rope Trick/Super Sticky Celebration String above.
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

    // Lock Down (Strategist Focus, 17th level, p.68) / Stunning Surprise (Prowler Focus, 1st
    // level, p.86) - both apply an extra effect alongside a normal successful hit, independent of
    // whether the attack's own damageValue is set (an unarmed/no-damage weaponEffect can still
    // carry one of these Perks).
    if (checkContext.lockDownImmobilize || checkContext.stunningSurpriseStun || checkContext.isCatchOffGuardAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (!targetActor) {
          continue;
        }

        if (checkContext.lockDownImmobilize) {
          await targetActor.toggleStatusEffect('immobilized', { active: true });
        }

        if (checkContext.stunningSurpriseStun) {
          await applyDamage(targetActor, 1, 'stun');
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

    // Metallikato - "Shove or trip the target on a Critical Success" - narrowed to trip (Prone)
    // only, see METALLIKATO_ID's own comment above for why shove isn't built. Uses isCrit (this
    // system's own weapon-attack "natural max die" Critical Success, Combat p.205), not the
    // Degrees-of-Success multiplier Barreling Beam's own identical-sounding spell clause uses just
    // below - this is a real melee Attack, not a Spell/flat Skill Test.
    if (isCrit && checkContext.isMelee && actor.system.isTransformed === false && actorHasPerk(actor, METALLIKATO_ID)) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const metallikatoTarget = await fromUuid(result.targetUuid);
        if (metallikatoTarget) {
          await metallikatoTarget.toggleStatusEffect('prone', { active: true });
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

    // Sideswipe - see checkContext.isSideswipeAttempt's own comment above. "A character on foot"
    // excludes vehicle/Zord/Megaform targets - RAW's own damage-plus-Trip clause is about running
    // down a person, not another vehicle.
    if (checkContext.isSideswipeAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && !['vehicle', 'zord', 'megaform'].includes(targetActor.type)) {
          await targetActor.toggleStatusEffect('prone', { active: true });
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

    // Calculated Attack (Transformers CRB, Gunner base, Sharpshooter Focus, 3rd level, p.70) -
    // see CALCULATED_ATTACK_ID's own comment above. Banks the flag consumed by aimBonus's own
    // computation on the ACTOR themselves (not the target) - a successful Science Test widens the
    // Gunner's own next Aim, not something inflicted on the enemy.
    if (checkContext.isCalculatedAttackAttempt && results.some(result => result.success)) {
      await bankPendingBonus(actor, CALCULATED_ATTACK_FLAG, { active: true });
    }

    // Tender (MLP CRB, Spirit of Kindness, 6th level, p.85) - see helpers/tender.mjs's own doc
    // comment. Banks an unscoped Snag on a successfully-hit target, same idiom as Menacing
    // Glare's own Snag half.
    if (checkContext.isTenderAttempt) {
      for (const result of results) {
        if (!result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await bankPendingBonus(targetActor, 'pendingTenderSnag', { snag: true });
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
          if (actorHasPerk(actor, TAKEDOWN_EXPERT_ID)) {
            await targetActor.toggleStatusEffect('immobilized', { active: true });
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
    if (checkContext.isRouseAttempt && results.some(result => result.success) && isGmConnected()) {
      requestStoryPointGrant(actor);
    }

    // Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86) - see
    // helpers/rousing-comeback.mjs's own doc comment. Same success-grants-a-Story-Point shape as
    // Rouse just above.
    if (checkContext.isRousingComebackAttempt && results.some(result => result.success) && isGmConnected()) {
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
    if (checkContext.isStayHumbleAttempt && results.some(result => !result.success) && isGmConnected()) {
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
          await snarlTarget.toggleStatusEffect('frightened', { active: true });
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
    if (checkContext.isEverythingIsInspirationAttempt && results.some(result => !result.success) && isGmConnected()) {
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
        await bankPendingBonus(allyActor, 'pendingSupportiveFriend', bonus);
      }
    }

    // Shoots and Scores (MLP Sporty Influence, p.60) - see SHOOTS_AND_SCORES_ID's own comment
    // above. Any Critical Success (multiplier >= 2) on this Athletics roll counts.
    if (checkContext.isShootsAndScoresAttempt && results.some(result => result.multiplier >= 2)
      && isGmConnected()) {
      requestStoryPointGrant(actor);
    }

    // You Can Do It, Too! - see YOU_CAN_DO_IT_TOO_ID's own comment above. Unscoped to any Skill
    // Test, unlike Shoots and Scores' own Athletics-only gate just above.
    if (actorHasPerk(actor, YOU_CAN_DO_IT_TOO_ID) && results.some(result => result.multiplier >= 2)) {
      for (const token of getNearbyAllyTokens(actor, Infinity)) {
        if (token.actor) {
          await bankPendingBonus(token.actor, 'pendingYouCanDoItToo', { shiftUp: 1 });
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
      && isGmConnected()) {
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
            await markDebilitated(targetActor);
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
              await applyExplosiveAftershockEffects(targetActor, effects);
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

    // Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - see
    // helpers/covering-fire.mjs's own doc comment. A genuine MISS (not a success, the mirror of
    // Unlucky (For You) just above) on this actor's own Attack.
    if (checkContext.isAttack && actorHasPerk(actor, COVERING_FIRE_ID)) {
      for (const result of results) {
        if (result.success || !result.targetUuid) {
          continue;
        }

        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor) {
          await bankPendingBonus(targetActor, COVERING_FIRE_SNAG_FLAG, { snag: true });
        }
      }
    }

    // Try, Try Again - see TRY_TRY_AGAIN_ID's own comment above. Banks itself on ANY failed Skill
    // Test of a given skill (the same "none of the compared entries succeeded" whole-roll failure
    // reading Cheer/Stay Humble's own rollFailed checks already use), scoped to that same skill.
    if (rollContext.skill && results.every(entry => !entry.success) && actorHasPerk(actor, TRY_TRY_AGAIN_ID)) {
      await bankPendingBonus(actor, TRY_TRY_AGAIN_FLAG, { skill: rollContext.skill });
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
    const dealtDamage = results.some(entry => entry.success && entry.damageValue > 0);
    // Clip Check (Quartermaster's Guide to Gear, General Perk, p.28): "You can reroll a Fumble on
    // an Attack Skill Test." - reads the real natural-min-die Fumble (_isCritIsFumble, computed
    // above) rather than the unrelated shift-based "fumble" auto-fail tier - stashed the same way
    // rollFailed/dealtDamage are, for the new REROLL_CONDITIONS.fumble check to read.
    const fullRollContext = {
      ...rollContext,
      rollFailed: results.every(entry => !entry.success),
      dealtDamage,
      isFumble,
    };

    const chatData = await buildCheckChatData(roll, { flavor, results, speaker, canCritD2, rollContext: fullRollContext });
    this._chatMessage.create(chatData);
  }

  /**
   * Create skill roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getSkillRollLabel(dataset, skillRollOptions) {
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
    this.rollSkill(dataset, actor, item);
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
    label += `<b>${effectStr}</b> - ${weaponEffect.system.damageValue || noneStr} ${damageType}<br>`;
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
  _getFormula(isSpecialized, skillRollOptions, finalShift, modifier, floorD20At10=false, rollsThreeD20=false, flatD20Value=0, flatBothD20s=false) {
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

        formula += ` + {${this._arrayToFormula(shiftOperands)}}kh`;
      } else {
        // For non-specialized, just add the single bonus die
        formula += ` + ${finalShift}`;
      }
    }

    return `${formula} + ${modifier}`;
  }
}
