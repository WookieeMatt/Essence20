import { sizeClassIndex } from "./mechanics/combat/size-classes.mjs";
import { ruleNaturalTwentyMultiplier } from "./rules/plugins/rolls/natural-twenty.mjs";
import { ruleShiftCap } from "./rules/plugins/rolls/shift-cap.mjs";
import { ruleManeuverOption } from "./rules/plugins/combat/maneuver-option.mjs";
import { ruleIgnoresDrawback, useIgnoredDrawback } from "./rules/plugins/rolls/ignore-drawback.mjs";
// Round 15 (dice part) - rule readers dice.mjs asks (docs/rules-batches/slDice15.md).
import { ruleFumbleStoryPoints } from "./rules/plugins/resources/grant-story-point.mjs";
import { ruleSkillEssence } from "./rules/plugins/rolls/skill-essence.mjs";
import { isUnarmedAttack } from "./items/shared/unarmed-attacks.mjs";
import { earlyDefenseAdjust } from "./rules/plugins/combat/early-defense.mjs";
import { ruleDownshiftCancel } from "./rules/plugins/rolls/downshift-cancel.mjs";
import { ruleMultipliers } from "./rules/plugins/rolls/degree-multiplier.mjs";
import { ruleImmunities } from "./rules/plugins/rolls/immunity-kinds.mjs";
import { ruleWeaponRange } from "./rules/plugins/tags/range-facts.mjs";
import { dataBridgeBonusOf } from "./rules/plugins/combat/data-bridge-bonus.mjs";
import { ruleSizeMatrixSteps } from "./rules/plugins/combat/size-matrix-steps.mjs";
import { ruleBonusPoolDie, ruleDownshiftCap, ruleFumbleUpTo } from "./rules/plugins/rolls/die-facts.mjs";
import { ruleEdgeOrShift } from "./rules/plugins/rolls/edge-or-shift.mjs";
import { fireRollEnergonSpent, ruleEnergonSpendBonus } from "./rules/plugins/rolls/energon-spend-bonus.mjs";
import { ruleDefenseSwap } from "./rules/plugins/combat/defense-swap.mjs";
import { ruleCritImmune } from "./rules/plugins/combat/crit-immune.mjs";
import { ruleDamageFloor } from "./rules/plugins/combat/damage-floor.mjs";
import { ruleSnagOrMiss, spendSnagOrMiss } from "./rules/plugins/combat/snag-or-miss.mjs";
import { askCritDowngrade, runCritDowngrade } from "./rules/plugins/rolls/crit-downgrade.mjs";
import { tradeRuleUpshifts } from "./rules/plugins/rolls/upshift-trade.mjs";
import { ruleClearsPenalties } from "./rules/plugins/dialog/switch-clear-penalties.mjs";
import { extDialogToggles, extSpecializes, runApplyDialog, runConsumer, runPreRoll } from "./mechanics/item-hooks.mjs";
import { battlizerAttackUsedUp, markBattlizerAttack, racerRecklessShifts } from "./mechanics/companions/summons.mjs";
import { energonDonor, payEnergonDonor } from "./rules/plugins/zords/megaform-contributions.mjs";
import { ruleFlatD20 } from "./rules/plugins/rolls/flat-d20.mjs";
import { applySwitchActions, backfires } from "./rules/plugins/dialog/switch-action-cost.mjs";
import { sourceKeys } from "./rules/plugins/rolls/once-per-roll.mjs";
import { ruleMarkedNoArmor } from "./rules/plugins/combat/marked-no-armor.mjs";
import { ruleResistsAttack } from "./rules/plugins/combat/attack-resistance.mjs";
import { applyDialogKits, kitDialogFlags, kitSources, wildAnimalPersuasion } from "./mechanics/resources/kits.mjs";
import { pushActor } from "./mechanics/combat/forced-movement.mjs";
import {
  applyRollRiders, disarm, imperfectionOf, buildRiderContext, isVsPrimaryQuarry,
  noteRoller, riderDefenseAdjust, rollRiderSources,
} from "./mechanics/combat/target-riders.mjs";
import { crewSources, defenderSources, getCrewedVehicle, spendDefenderSources } from "./mechanics/vehicles/vehicle-upgrades.mjs";
import { getSceneEpoch } from "./mechanics/resources/scene-clock.mjs";
import {
  computerizedArmorEvasion, firesAsReinforced, ignoresDefend, isBallisticLongRange, isGrownThreat,
  noisyArmorPenalty,
} from "./mechanics/combat/weapon-traits.mjs";
import { ruleAttackHasTrait } from "./rules/plugins/combat/attack-traits.mjs";
import { E20 } from "./util/config.mjs";
import { getEnvironment, hasEquippedEnviroSealedArmor, isEnviroSealedEdgeActive } from "./mechanics/world/environment.mjs";
import { isImpairedByEnvironment } from "./mechanics/world/environment-hazards.mjs";
import {
  areHardpointWeaponsInoperable, canTargetVesselSystem, getUnstablePenalty, imposeVesselConditionOnCrit,
  resolveVesselRepair, TARGET_VESSEL_SYSTEM_SHIFT_DOWN,
} from "./mechanics/vehicles/vessel-conditions.mjs";
import { isAiming, isBraced, ACT_WHILE_DEFEATED_FLAG } from "./mechanics/actions/action-economy.mjs";
import { DEFENDING_STATUS } from "./mechanics/actions/named-actions.mjs";
import {
  LEND_ASSISTANCE_EDGE_FLAG, LEND_ASSISTANCE_SHIFT_FLAG,
} from "./mechanics/actions/lend-assistance.mjs";
import { chooseDefenderDefense, DEFENSE_BOOST, hasSceneDefenseBoost } from "./mechanics/combat/defense-choice.mjs";
import { CIRCLE_SHIFT_FLAG } from "./items/social/friendship-circle.mjs";
import { allyDefenseOutcome, allyDefenseReactions, fireAllyDefended } from "./rules/plugins/combat/ally-reactions.mjs";
import {
  _isCritIsFumble, applyDamage, buildCheckChatData, computeMultiplier, ENERGY_DAMAGE_TYPES, getDefenseValue,
  getSecondaryDamage, getVehicleDriver,
} from "./mechanics/combat/combat.mjs";
import {
  checkPredatorSneakAttackEligibility,
  checkSneakAttackEligibility,
  getPredatorSneakAttackDamage,
  hasPredatorSneakAttack,
  isSneakAttackDamageItem,
  markSneakAttackUsed,
  paySneakAttackGrant,
  PREDATOR_SNEAK_ATTACK_ROUND_FLAG,
} from "./mechanics/combat/sneak-attack.mjs";
import {
  actorHasPerk, bankPendingBonus, clearPendingBonus,
  findPerk,
  getPendingBonus, hasUsedThisEncounter, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisRound, markUsedThisTurn,
} from "./mechanics/characters/perks.mjs";
import { bankedDefense, bankedDefenseMultiplier } from "./rules/bank.mjs";
import { ruleLabel } from "./rules/index.mjs";
import { ruleAimBonus, ruleCover, ruleCritD2, ruleDamageType, ruleDieSubstitution, ruleRollDice, ruleNoLongRangeSnag, ruleRollSources, ruleScaledDamage } from "./rules/adapter.mjs";
import { applyCardHitMultipliers, applyLateHitMultipliers } from "./rules/plugins/combat/card-hit-multiplier.mjs";
import { checkMarkTarget } from "./items/rolls/mark-target.mjs";
import { checkPrimaryQuarry } from "./items/rolls/primary-quarry.mjs";
import { getNearbyAllyTokens } from "./mechanics/combat/nearby-allies.mjs";
// DefenseAura rules (Shield Upgrade) - an ally's lent Defense bonus, inside each per-attack Defense value. A Personal
// Shield isn't armor (GI JOE CRB p.108), so the ignore-armor recomputes below keep the lent bonus too.
import { ruleDefenseAura } from "./rules/plugins/combat/defense-aura.mjs";
import { isRecklessAbandonActive } from "./items/rolls/reckless-abandon.mjs";
import {
  canSpendForActor, canWriteStoryPoints, poolFor, requestStoryPointGrant, spendForActor,
} from "./mechanics/resources/story-points.mjs";
import { applyHealSkillTestResult } from "./items/healing/heal-skill-test.mjs";
import { isPowerAdaptationActive } from "./items/forms/power-adaptation.mjs";
import { deactivatePhantomSuite, getPhantomSuiteEvasionBonus, isPhantomSuiteActive } from "./items/senses/phantom-suite.mjs";
import { getPoweredPlatingBonus } from "./items/defenses/powered-plating.mjs";
import { getToxicTerrorShiftDown } from "./items/attacks/toxic-terror.mjs";

// ACT_WHILE_DEFEATED_FLAG now lives in mechanics/actions/action-economy.mjs (isUnableToAct's own doc comment
// explains why) - re-exported here so existing importers of it from dice.mjs keep working.
export { ACT_WHILE_DEFEATED_FLAG };

import { isWisdomOfTheEldersActive } from "./items/forms/wisdom-of-the-elders.mjs";
import { getJuryRigDefenseBonus, isJuryRigBenefitActive } from "./items/vehicles/jury-rig.mjs";
import { markedRowOutcomes } from "./rules/plugins/rolls/marked-row-outcome.mjs";
import { bankKeySideCount, hasBankKey } from "./rules/plugins/resources/bank-keys-and-borrowing.mjs";
import { runSuccessToCritSteps, successToCrit } from "./rules/plugins/rolls/success-to-crit.mjs";
import { isDsoeDisguiseActive } from "./items/magic/disguise-spell.mjs";
import { isGreasedLightningActive } from "./items/magic/greased-lightning.mjs";
import { isMysterySenseActive } from "./items/magic/mystery-sense.mjs";
import { isGlittermaneActive } from "./items/magic/glittermane.mjs";
import { isOokieSpookiesActive } from "./items/magic/ookie-spookies.mjs";
import { applyTimedCondition, turnBoundTiming } from "./mechanics/combat/timed-status.mjs";
import { isFoolscarrotActive } from "./items/magic/foolscarrot.mjs";
import { getSummonArmorDefenseBonus } from "./items/magic/summon-armor.mjs";
import { isDontNoticeMeFieldActive } from "./items/magic/dont-notice-me-field.mjs";
import { isObserverDisguiseActive } from "./items/senses/observer.mjs";
import {
  getMysteriousAuraImposingPenalty, getMysteriousAuraProtectiveBonus, hasNearbyResplendentAura,
} from "./items/defenses/mysterious-aura.mjs";
import {
  getEnvironmentOfExpertiseSourceLabel,
} from "./mechanics/world/environmental-expertise.mjs";
import { ruleEnvironmentalExpertise } from "./rules/plugins/effects/environmental-expertise-rule.mjs";
import { applyWreckerOnAutoFail, applyWreckerRoughTerrain } from "./mechanics/world/rough-terrain.mjs";
import { hasPhantomFocusOption } from "./items/healing/phantom-focus.mjs";
import { ruleSnagImmune } from "./rules/plugins/rolls/snag-immunity.mjs";
import { ruleSetDie } from "./rules/plugins/dialog/switch-set-die.mjs";
import { ruleLookupArmorPoints } from "./rules/plugins/combat/lookup-armor-points.mjs";
import { isLanceOfLightActive } from "./items/defenses/lance-of-light.mjs";
import { ruleEvasiveManeuvers } from "./rules/plugins/combat/evasive-maneuvers-rule.mjs";
import { ruleTargetedDefense } from "./rules/plugins/combat/targeted-defense.mjs";
import { COVERING_FIRE_SNAG_FLAG } from "./items/attacks/covering-fire.mjs";
import { isHonestAssessmentActive } from "./items/rolls/honest-assessment.mjs";
import { ruleNoArmor } from "./rules/plugins/combat/no-armor-defense.mjs";
import { isWarriorModeActive } from "./items/zords/warrior-mode.mjs";
import { markAttackedByAlly } from "./items/attacks/team-focus.mjs";
import { markQuietOneNoisyAction } from "./items/rolls/quiet-one.mjs";
import { isMultipleTargetsWeapon } from "./mechanics/combat/multiple-targets.mjs";
import { applyReroll } from "./mechanics/rolls/reroll.mjs";
import { applySkillEffectBonus, getToggleableSkillEffects } from "./mechanics/rolls/skill-effects.mjs";
import {
  deactivateShynessOnAttack, DISGUST_TURN_FLAG, EMOTIONAL_MASTERY_ID, EMOTIONAL_MASTERY_SHAME_FLAG,
  hasContemptResistance, isEmotionalMasteryOptionActive,
} from "./items/resources/emotional-mastery.mjs";
import { hasAquaElementalAdaptation } from "./items/defenses/aqua-elemental-adaptation.mjs";
import {
  adjustFanningShotShift, clampFanningShots, getFanningFirstShotUpshift, getFanningMaxShots, getFanningShotShifts,
} from "./items/attacks/fanning.mjs";
import { HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN, isHighDensityWeapon } from "./items/attacks/high-density.mjs";
import { hasGeneticAlterations, isRetrogenWeapon } from "./items/attacks/retrogen.mjs";
import { creatureTagsOf, isRobotic } from "./mechanics/characters/creature-tags.mjs";
import { hasChosen } from "./rules/choice-read.mjs";

// Every Commando Perk automated below that isn't specific to Sneak Attack itself (those constants
// live in mechanics/combat/sneak-attack.mjs instead) - all under GI Joe CRB's own compendium pack.
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";

// Pressure Cooker (both halves), the vehicle Qualification Perks' ↑1 on Driving with Ranks (Air / Land / Sea Vehicle
// Qualification, Skyward, Nu, Pogodi!, Nothing Personal, The Promise of Riches, Good To Go, For The Syndicate, Oorah!),
// Weak Point's and Penetrating Rounds' Armor Piercing, Roaming the Land's Stun and Cryogenic Touch's Cold damage are
// rules on their items (rules/conv17-Split1.test.js).

// Fighting Style (Infantry / Vanguard) - every option, Trigger Happy's Willpower compare included, is a rule on the
// Perk; Gallantry's Snag on a Trigger Happy attack and its halved Frightened are rules on Gallantry
// (rules/conv18-convA.test.js).


// Mystical Understanding's Spellcialize (spend a Mystical Point to roll a trained, unSpecialized Skill as
// Specialized) is a DialogSwitch rule on the Perk (rules/conv13-slJ13.test.js).

// Ultimate Magna Defender's +1 for the Defender Torozord it forms is a scope formedBy DamageModifier rule on the Perk.

// Limited Articulation (TF CRB, several Alt Mode Chassis, e.g. Champion p.51): no precision Skills
// (Athletics, Finesse) while converted into an Alt Mode with this trait. A hard block, not a
// downshift (the book forbids the roll rather than penalising it) - checked in rollSkill() below against whichever Alt Mode item is currently
// active (system.altModeId, set by sheet-handlers/transformer-handler.mjs#_transformAltMode) and
// its own system.limitedArticulation field (data/item/alt-mode.mjs). Some Origins also carry a
// Limited Articulation drawback of their own (Ch05 Roles' "Helping Hand" Advanced Perk ignores
// that one specifically) - out of scope here, since that Perk doesn't exist as a compendium item
// yet and no Origin-level field carries this flag.
const LIMITED_ARTICULATION_SKILLS = ['athletics', 'finesse'];

// Long Shot (Sharpshooter Focus, 1st level, p.70) - see its own check, next to the automatic
// long-range Snag it suppresses.

// Extension vetoes of the Fumble Story Point grant, fn(actor, skill) => Boolean (Agency -
// helpers/extensions/react).
export const FUMBLE_STORY_POINT_SUPPRESSORS = [];

// Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - rules on its item.

// Exterminator (Decepticon Directive, General Perk, p.65): against a Common- or Small-size target
// smaller than the attacker, ↑1 and rerolls of Skill Die 1s. The ↑1 half is a plain size-comparison shiftUp (same sizeOrder idiom Large
// And In Charge already establishes); the reroll half is threaded through as a new
// `smallerTarget` REROLL_CONDITIONS entry (see its own comment below) - the compendium item's own
// `system.reroll` config (mode:"ones", condition:"smallerTarget") does the rest generically.
const EXTERMINATOR_ID = "Compendium.essence20.decepticon_directive.Item.B5HgQeurLyvio1t7";

// Metallikato is rules on its Perk (its Multiple Targets on / off Uses and grant, the ↓1, the Bot Mode ignore-armor switch,
// the trip on a Critical Success); its reroll is a bare compendium config.

// Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46) - see
// items/rolls/two-heads-are-better-than-one.mjs's own doc comment for the self-Lend-Assistance half
// (the ↑1 Alertness half is a plain compendium ActiveEffect, no code needed).

// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38): ↑1 on Acrobatics
// and Infiltration, rough terrain ignored, plus one pick - Agile Reflexes (once a scene, Evasion in
// place of a targeted Toughness) or Innate Climber (+40ft Climb in Alt Mode). The flat
// shiftUp half is a plain compendium ActiveEffect; ignoring rough terrain is
// mechanics/world/rough-terrain.mjs#ignoresRoughTerrain. Innate Climber's movement grant lives in
// documents/actor.mjs#_prepareMovement; Agile Reflexes' defenseType override is the live check
// below, in rollSkill()'s own per-target checkEntries construction (the one place defenseType is
// actually known - see this project's own tracked "defenseType known only after the dialog
// resolves" gap for why _getAutomaticCombatModifiers couldn't do this instead).
const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";
const AGILE_REFLEXES_FLAG = 'agileReflexesUsedThisEncounter';

// Sharpshooter's Grace (Transformers CRB, General Perk, p.111) - a DISTINCT compendium item from
// PR CRB's/GI Joe CRB's own identically-NAMED Perk (see SHARPSHOOTERS_GRACE_ID's own comment) -
// this book's own RAW is different, not just a third copy: the Snag-suppression half is identical
// (added alongside the other two wherever that's checked), but the +2 clause is the OPPOSITE
// direction - ↑2 on ranged attacks at targets MORE than 30 feet away, not within 30 feet
// - confirmed by direct RAW extraction, not assumed from the shared name. Gets its own separate
// distance check rather than folding into the existing <=30ft block.

// Fuel Efficient (Transformers CRB, General Perk, p.109) is its item's own rule now (a resourceSpent Trigger).

// My Little Pony CRB Role Perks automated below - the "buildable now" slice of the Spirit of
// Generosity/Honesty/Kindness/Loyalty/Magic categorization pass (Spirit of Laughter was already
// fully built in an earlier pass). Same "bare compendium item, code supplies the mechanic"
// situation as every other game line here.
const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";
const ENERGY_BEAM_ID = `${MLP_CRB}tQHr5bWsrkrm1ZHZ`;
const LANCING_BEAM_ID = `${MLP_CRB}MaHixiXm7JuS1tCq`;
const EXPLOSIVE_BEAM_ID = `${MLP_CRB}VLdz7YvUq2AaUFNz`;
const MIND_BEAM_ID = `${MLP_CRB}gF8otV8Ag9axRp2Z`;


// Extension Initiative rules, async fn(actor, skillRollOptions) - mutate the dialog's options
// (rules/plugins/rolls/initiative.mjs's initiativeRolling Triggers).
export const INITIATIVE_EXTENSIONS = [];

// (Surgical Operators - Ferocious Fighters, Anti-Venom Task Force Faction Perk, p.72 - is a DialogSwitch rule on the Perk.)

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

// Dinobot (Technorganic Secrets, Influence Perk, p.28): pick a Brawn or Survival Specialization,
// trained or not, and get Edge on tests where it applies. Same choiceType:'skills' + system.choice shape
// as Specialist/Rocket Scientist above - the pick needn't be trained, so the Edge applies
// even without rolling as Specialized, so this checks the chosen skill directly rather than
// skillRollOptions.isSpecialized; the "where it applies" narrowing (the specific
// flavor, e.g. "Survival (Desert)") is dropped the same unenforceable-narrative-qualifier way
// Specialist's own "must already be Specialized" precondition already is.
// Built as a Roll Options Dialog switch (a rule on its item).

// Maximal (Technorganic Secrets, Influence Perk, p.26) - same shape as Dinobot just above,
// restricted to Persuasion/Science/Technology instead.
// Built as a Roll Options Dialog switch (a rule on its item).

// Predacon (Technorganic Secrets, Influence Perk, p.27): same choice-Edge shape as Dinobot/Maximal
// above, restricted to Intimidation only - plus its own second clause: a foe Intimidated in a
// conflict scene is Frightened until the end of its next turn.
// "Conflict scene" maps onto game.combat existing; the Frightened, and its end, are hit / turnEnd Trigger rules on the Perk.

// Bait and Switch (Tricky Influence, p.63): a Friendship Point buys Edge on Deception and
// Infiltration tests until the holder's next turn. Dispatched as a "Use" button
// (mechanics/resources/banked-buffs.mjs) - spends 1 Story Point (MLP's own Friendship Point relabel) and banks
// an unscoped-by-target Edge, consumed on the actor's own next Deception or Infiltration roll.

const KNIGHTS_OF_CANTERLOT_SPELLS = "Compendium.essence20.knights_of_canterlot.Item.";
const KOC_FIREBALL_ID = `${KNIGHTS_OF_CANTERLOT_SPELLS}zlERIywyKQNBQzs6`;

// On Your Feet (Drill Instructor Focus, Officer, 3rd level, p.10): Edge on Initiative for the holder
// and allies. No RAW-stated range - treated as a passive, unconditional party-wide
// grant (the same "unscoped when RAW doesn't name a distance" idiom Stand Behind Me's own 60ft
// clause is the exception to, not the rule - most of this project's unscoped Perks default to no
// radius restriction at all, e.g. Prepare for War/Ready For Anything's own self-only shape widened
// here to nearby allies too). Both halves are rules on the Perk: the holder's own Edge and an ally aura.

// Oorah! (Slaughter's Marauders Faction Perk, p.15): every Marauder gets Standard-weapon and silent
// battledress Qualification, Land-vehicle Qualification (Driving with no Snag even untrained),
// +1 Toughness and Willpower, Edge on Infiltration and +1 damage against Surprised targets.
// The +1 Toughness/+1 Willpower clause was already a correct, enabled compendium Active Effect
// before this pass - confirmed by reading the JSON directly, nothing to fix there. The Land-
// vehicle-qualification clause is the usual vehicle Qualification shape (no Snag, ↑1 with Ranks) -
// a RollModifier on the Perk, like the other vehicle Qualification Perks.

// Pointy (General Perk, p.21): a Free action grows claws or teeth for the rest of the combat scene -
// ↑1 on attacks with them, Sharp damage. A toggle (see
// items/attacks/pointy.mjs's own doc comment, same on/off shape as Dig In) - only the ↑1 shiftUp half on
// an unarmed attack is built (items/shared/unarmed-attacks.mjs#isUnarmedAttack, like every unarmed reader);
// forcing the attack's own damageType to 'sharp' isn't - no existing Perk in this project
// overrides a weaponEffect's own fixed damageType field, and doing so here would be a new,
// separately-risky precedent rather than a small addition.

// Calm Hearted (General Perk, p.43): once a session, Edge on one Social test about keeping calm.
// The keeping-calm qualifier is dropped (unenforceable narrative qualifier) - a "Use" button (mechanics/resources/banked-buffs.mjs)
// banks an Edge scoped to the Social Essence broadly (not one specific Skill, since the book allows
// any Social test), once per scene via hasUsedThisEncounter.

// University Days (General Perk, p.53): Free actions counted from Smarts rather than Speed. Identical shape to Quick Thinker (MLP CRB) -
// see mechanics/world/token-sync.mjs#getNumActions, extended to also check this Perk.

// Static Electricity (General Perk, p.51, Weird +d6 prereq): +2 Evasion and a flat 35ft Movement.
// The +2 Evasion half is a compendium Active Effect; the flat-35ft Movement half
// needs documents/actor.mjs#_prepareMovement (the one permitted movement-math touch-point).

// Everything is Inspiration (Hobbyist Origin, p.32): +1 Story Point to the player pool at each
// session start, and once a scene on a failed Skill Test. The session-start half isn't automated - this codebase has no "a new game session has
// begun" hook to fire it from at the time). Both halves are Trigger rules on the Origin now (sessionStart, and an
// afterRoll Trigger on a failed Skill Test, once a scene).

// If I Recall Correctly (Spell Scribe Influence, p.34): once a scene, Edge on the next Spellcasting
// test. Dispatched
// as a "Use" button (mechanics/resources/banked-buffs.mjs BANKABLE_PERKS, target:self) - its default
// data={edge:true} is exactly what's needed, same as Bait and Switch above - consumed here scoped
// to Spellcasting specifically, the same inline "check rolledSkill" shape Inner Magic already uses.

// Trick Shot (Archer Influence, p.14 - stored as a General Perk in the compendium's own schema,
// a real mismatch between this item's system.type and its actual RAW placement, though that
// field is purely organizational and doesn't gate the mechanic itself): once a scene, Edge on a
// Targeting test with a bow. No "bow"
// weapon trait exists in this system to check - the "with a bow" qualifier is dropped, same
// "narrow qualifier, apply unconditionally" idiom Bits To Spare/Truthseeker's own narrower RAW
// wording already accepts, leaving a plain once-per-scene Edge on Targeting.

// Superb Soloist (Bard Influence, p.15): once a day, a song gives allies Edge on their next Skill
// Test this scene. A "Use" button (helpers/banked-
// buffs.mjs) broadcasting an unscoped Edge bank to every nearby ally - "once per day" approximated
// as "once per scene" via hasUsedThisEncounter, this project's usual daily-resource idiom.

// (Bump & Run is its Perk's own rules - a keyed DialogSwitch, a hit Trigger for the Stun and turn-end Triggers for
// the Impaired - rules/conv10-slC10.test.js.)

// Air Born (Pegasus Origin Perk, p.37): a choice of starting ground/aerial Movement - 15/45ft,
// 30/30ft or 45/15ft. Sets the actor's own BASE ground/aerial
// Movement outright (not an added bonus) - see AIR_BORN_MOVEMENT_OPTIONS' own doc comment in
// documents/actor.mjs#_prepareMovement, the one other permitted touch-point for movement math.

// (Sensitive's Snag after damage, and its Detail Oriented ignore, are rules on the Hang-Up - rules/conv10-slE10.test.js.)

// Wild Tales (Adventurer Influence, p.42): once a scene, telling a story of past adventures gives
// Edge on a Smarts or Social test. A "Use" button prompting
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
// _getPilotedVehicle finds which vehicle (if any) they're currently seated in. (Dogfighter's Edge and its vehicle's +2
// Evasion are rules on the Perk.)

// Peerless Pilot (PR CRB, General Perk) - its Initiative and Driving Edges (self:specializedAtLeast:driving:d6) and its
// automatic emergency disembark are the Perk's own rules (module/rules/ext/a/).
// Ninja Powered: Stealthy Misdirection (PR CRB, Zord Feature, p.138): a free Defend folded into any
// Move of over 20 feet. Not built - no Defend action exists
// anywhere in this codebase, the same gap Upgraded Zord: Shogun Upgrade's own "Defend as a Free
// action" clause (see SHOGUN_UPGRADE_ID's own comment above) already hits. Left undocumented in
// code beyond this comment (no _ID constant, since there's nothing here to check against yet)
// until a real Defend action mechanic exists to hook into.

// Upgraded Zord: Rescue Upgrade (PR CRB, Zord Feature, p.138): flat Strength, Speed, movement and
// Toughness armor bonuses - entirely static/flat, no live roll hook
// needed (fully covered by the item's own compendium Active Effect).

// Targeting System (GI Joe CRB, Vehicle Trait, p.173): the driver fires the weapon as a Free action,
// rolling their Driving or the vehicle's Targeting. Not built - this codebase has no Free-action-vs-Standard-action cost concept
// anywhere (every roll this file handles is already assumed to cost whatever action the sheet's
// own control implies, never computed or enforced here), so there's nothing for this trait to
// grant an exception to yet. The Skill-substitution half (Driving OR Targeting, better of the
// two) could be built alone, but doing so without the Free-action half would misrepresent RAW's
// actual grant - left undocumented in code beyond this comment until a real action-cost concept
// exists to hook into.

// Armored Cabin / Wearable (GI Joe CRB, Vehicle Traits, p.173): the crew can't be attacked
// (Armored Cabin) / crew or vehicle may be attacked, each on its own Defenses (Wearable, the
// opposite allowance). Not built - neither trait has anything to gate: this codebase has no
// attack-an-embarked-crew-member targeting choice anywhere for either trait to permit or forbid.
// Every existing Vehicle/Zord Willpower-Cleverness redirect (mechanics/combat/combat.mjs#getDefenseValue)
// and driverless-Vehicle-is-an-object rule already only ever resolve TO the vehicle or driver,
// never let an attacker choose a different embarked passenger as the target in the first place.

// Elusive (GI Joe CRB, Vehicle Trait, A.W.E. Striker p.180) / Hard Target (Skystriker p.185,
// Night Raven p.307) / Evasive Maneuvers (F.A.N.G. p.303, Reconnaissance Jet p.309, others): Evasion
// as its Defense after moving 30ft in a round / ranged attacks go against Evasion while it flies /
// the driver halves speed to make attacks target Evasion until its next turn. Confirmed
// ALREADY fully supported, no code needed: mechanics/combat/defense-choice.mjs#chooseDefenderDefense (used
// for every attack resolved in this file) already lets the DEFENDER freely choose Evasion or
// Toughness on any given attack, matching this system's own general RAW (the defender usually picks
// the Defense by how they react - see that file's own doc comment). A vehicle with any of these three traits could already just always choose Evasion
// whenever it's the better defense, with or without moving/flying/spending an action first - their
// specific triggering conditions add nothing the generic system doesn't already grant. The same
// "positive finding, no code needed" category as Megaform Trait's second slot just below.

// Megaform Trait (PR CRB, Zord Feature, p.139, a Zeo Zord's own automatic Feature): the Zord may
// bring a second Megaform Trait to any Megaform it joins. Confirmed
// ALREADY fully supported, no code needed: _prepareMegaformZordData/_prepareMegaformCombinerData
// already iterate every megaformTrait item a participant holds (never limited to one), and the
// Zord Features "+" add control (zord-common.hbs) never enforced a one-trait cap to begin with -
// a GM can already add a second Megaform Trait item to any Zord today. This Feature's real
// function is a chargen-time PERMISSION ("you're now allowed a second one"), not a runtime
// restriction this system enforces anywhere - the same GM-adjudicated-build-rule category as
// Titan Body's own incompatibility list.

// Enhance (Attack) (PR CRB, Zord Feature, p.137): one of the Zord's attacks gets Accurate (↑1),
// +1 damage, or one effect from the Feature's list. Needs no dice.mjs hook of its own - re-checked against the real
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

// Zord Mega-Weapon System (PR CRB, Zord Feature, p.141): 5 Personal Power pooled from the Crew, good
// for 1d2+1 attacks at base 5 damage, usable in a Megaform too. Not built - two genuinely new shapes neither Relic Key
// nor Warrior Mode's own declare/consume idiom cover: spending a cost POOLED ACROSS MULTIPLE
// actors at once (every other Personal-Power spend in this codebase draws from exactly one
// actor), and a multi-use DURATION COUNTER (1d2+1 remaining attacks, decrementing per use) rather
// than a single-roll or on/off-toggle grant. Flagged rather than rushed in half-built.

// Carrier / Extra Attack / Blast Attack / Crew Compartment / Fast Modulation / Additional Attack
// Type (PR CRB, Zord Features, p.137-139): each needs its own new subsystem with no existing
// analog in this codebase - a pocket-dimension actor-container concept (Carrier), a multi-attack
// action-economy concept (Extra Attack), an AoE-shape auto-wire scoped to one specific grant
// (Blast Attack, distinct from the general mechanics/combat/aoe-targeting.mjs an attack with a real
// `shape` already uses), additional crew-slot capacity (Crew Compartment), a Combiner-join-timer
// concept (Fast Modulation), or is purely descriptive (Additional Attack Type just grants access
// to author a new basic attack, nothing to compute). None built - flagged here rather than each
// getting a half-built partial mechanic.
// Eltarian Training (Through the Shattered Grid, General Perk, p.73, Speed 4+): +10 Ground Movement
// and the first ↓1 on Finesse tests ignored. Not a piloting Perk at all
// despite being flagged as one by an earlier, mistaken categorization pass - a plain flat
// movement bonus plus an Expertise-style downshift clamp - a Movement and a DownshiftCancel rule on the Perk.

// General/Origin/Influence Perk pass, PR CRB batch 2 (2026-09-10) - a handful of items an earlier,
// text-free categorization pass flagged "buildable now, low confidence" turned out, once RAW text
// was actually pulled (p.93-99, General Perks; p.66-76, Influence Perks), to be genuinely clean
// builds reusing already-established patterns - see each one's own check for its citation.

// General/Origin/Influence Perk pass, GI Joe CRB batch (2026-09-10) - a further handful of
// "buildable now, low confidence" items RAW text (p.44-134) confirmed are genuinely clean builds.
// Sharpshooter's Grace here is a DISTINCT compendium item from PR CRB's own printing, and the two
// do NOT share RAW text: both suppress the long-range Snag, but GI Joe's +2 is for targets FARTHER
// than 30 feet (p.133), matching the Transformers CRB printing rather than PR's "within 30 feet".

// Robot (GI Joe CRB, pet/drone Perk): the holder is open to anything that affects machines -
// it counts as a robot for Electromagnetic's ↑3.
const ROBOT_PERK_ID = `${GI_JOE_CRB}xV4nnjMxlb4dmyxo`;

// Across the Stars Role Perks automated below - the "buildable now" slice of the categorization
// pass (see project plan's own writeup). Same "bare compendium item, code supplies the mechanic"
// situation as every other game line here. Gold/Silver/Phantom Ranger Prime each already carry
// their shared "+2 all Defenses" bullet as a plain compendium Active Effect (same shape as the 7
// base CRB Primes above) - their remaining bullets are rules on each Perk.

// Savant Skill (A Jump Through Time, General Perk, p.56, RAW-verified 2026-09-15 via a fresh PDF
// pull - this row had sat flagged "not yet individually verified"): pick a Skill from the Perk's
// list; tests with it may be rolled as a flat 1d20+1d4, ignoring Snag, Edge and shifted Ranks.
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
// The second clause (a Story Point spent on a reroll with this Skill comes back if the reroll
// still fails) stays unbuilt: nothing in the reroll engine
// reports a reroll's own outcome back for a refund decision - a real, still-missing hook, not an
// approximation this pass could fudge. (Both halves are rules on the Perk now: a DialogSwitch setDie and a rerolled
// Trigger.)

// The three Ranger Prime capstones whose RAW gives enemies a Snag when they attack ONE named
// Defense of the holder: Silver Ranger Prime (Willpower), Graphite Ranger Prime and Orange Ranger
// Prime (both Cleverness). (Orange Ranger Prime's is a late incoming RollModifier rule on its own item now.)
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
// untouched. Uses the TARGET's own Perk, not the roller's - this is a defensive capstone. All three are late incoming
// RollModifier rules on their own items now.

// (Revengeful is rules on its Perk - a targeted Trigger marking the attacker, ↑1 against them, a
// defeatedEnemy Story Point - rules/conv10-slE10.test.js.)

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

// Beastly (Factions in Action Vol. 1, Influence Perk, p.75) is handled entirely by its own ItemModifier
// rule, which sets the Unarmed Combat Blunt alternate effect's shiftDown to 0 (rules/adapter.mjs#ruleDerived;
// documents/item.mjs reads the result as the effect's printed ↓). A second cancelling ↑1 used to live here
// too and double-counted it (fix pass 3).

// Defensive Flexibility (Blue Spectrum Modification, replaces Grid Tech, p.45) - see
// items/defenses/defensive-flexibility.mjs's own doc comment for both halves' full build note.

// Athletics/Brawn shifts per gravity environment (Across the Stars p.24-25) - see the "Environment"
// block in _getAutomaticCombatModifiers. Negative is a penalty.
const GRAVITY_ATHLETICS_BRAWN_SHIFTS = { highGravity: -2, lowGravity: 1, zeroGravity: 2 };

/**
 * Pistol Whip (Transformers CRB p.66): a Ballistic weapon in an External Hardpoint doubles as a Close
 * Combat Bludgeon, and used that way gets none of its Ballistic benefits. Its Bludgeon attacks are generated effects (the
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
    // items' own rules, read below with the rest of the item rules - so are Tactical Meditation's ↑2 (the
    // holder's and its 10 ft ally aura) and Resourceful's Edge.
    // Light Chassis (PR CRB, Zord Feature, p.137): ↑1 on the Initiative of a Combined Megaform it is
    // part of. A Megaform rolls its own Initiative the same way any
    // other actor does (same reasoning as Enhanced Initiative's hasEnhancedInitiativeEdge below -
    // read directly off the flag Essence20Actor#_prepareMegaformZordData computes from its linked
    // Zords' own Light Chassis Feature), an upshift rather than Enhanced Initiative's Edge since
    // that's what this Feature's own RAW text grants.
    // Warrior Mode (PR CRB, Zord Feature, p.140): "Grants ↑2 to Initiative Skill Tests" while
    // active - see items/zords/warrior-mode.mjs's own doc comment for the full Feature and why this
    // is checked on the Zord itself (unlike Light Chassis just above, Warrior Mode isn't a
    // Megaform-facing effect - it's the Zord's own transformed state).
    const warriorModeShiftUp = isWarriorModeActive(actor) ? 2 : 0;
    const dataset = {
      shift: actor.system.skills[initSkill].shift,
      shiftUp: actor.system.skills[initSkill].shiftUp + actor.system.essenceShifts.speed.shiftUp
        + warriorModeShiftUp,
      shiftDown: actor.system.skills[initSkill].shiftDown + actor.system.essenceShifts.speed.shiftDown,
      skill: initSkill,
      isSpecialized: actor.system.skills[initSkill].isSpecialized,
    };
    // (Iconoclast's Disrupter Edge is a RollModifier rule on its item - combat:enemy:target:levelDiff>=1.)
    // (On Your Feet's Edge for its holder's allies is an aura RollModifier rule on the Perk.)
    // Enhanced Initiative (Transformers Combiner Feature, Enigma of Combination, p.42): Edge on the
    // Combiner form's Initiative. A Combiner rolls its own Initiative
    // (Combat#rollInitiative, same as any other actor), so this reads directly off the flag
    // _prepareMegaformCombinerData computes from its components' own megaformTrait items.
    const hasEnhancedInitiativeEdge = actor.type == 'megaform' && actor.system.hasEnhancedInitiative;
    // (Relic Key's one-roll Edge is a banked Edge from its Feature's Use rule.)
    const skillDataset = {
      edge: actor.system.skills[initSkill].edge
        || hasEnhancedInitiativeEdge,
      shift: actor.system.skills[initSkill].shift,
      snag: actor.system.skills[initSkill].snag,
    };

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
    // (mechanics/item-hooks.mjs).
    await runPreRoll(actor, dataset, item);
    // An extension refused the roll (a jammed weapon, an untargetable crew...) and said why.
    if (dataset.cancelRoll) {
      return;
    }

    const rolledSkill = dataset.skill;
    let rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];

    // Unstable, third stack (Across the Stars p.26): the hardpoint weapons stop working - no
    // hardpoint attacks until the vessel is repaired.
    if (item?.type == 'weaponEffect' && actor?.type == 'vehicle' && areHardpointWeaponsInoperable(actor)) {
      ui.notifications.warn(this._localize('E20.VesselConditionUnstableInoperable', { name: actor.name }));
      return;
    }

    // A "1/scene" Battlizer attack (mechanics/companions/summons.mjs) - Energy Sword Time Strike, Battle Fire Saber.
    // Counted once the roll goes ahead, below the dialog's cancellation check.
    const battlizerWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    if (battlizerAttackUsedUp(actor, battlizerWeapon)) {
      ui.notifications.warn(`${battlizerWeapon.name}: ${this._localize('E20.OncePerScene')}`);
      return;
    }

    // Limited Articulation - see LIMITED_ARTICULATION_SKILLS' own comment above.
    if (LIMITED_ARTICULATION_SKILLS.includes(rolledSkill) && actor.system.altModeId) {
      const activeAltMode = actor.items?.get(actor.system.altModeId);
      // An IgnoreDrawback rule lifts it (Helping Hand Hybridization - rules/plugins/rolls/ignore-drawback.mjs).
      if (activeAltMode?.system.limitedArticulation && !ruleIgnoresDrawback(actor, 'limitedArticulation')) {
        ui.notifications.error(this._localize('E20.LimitedArticulationError', { skill: this._localize(E20.skills[rolledSkill]) }));
        return;
      }
    }

    // A Defeated creature can't act normally, but a player may spend a Story Point to act for a
    // moment as if it weren't (GI Joe CRB p.209; PR p.173 and MLP p.187 say the same - Transformers p.161 charges an Energon Point
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

    // Item rules' SkillEssence (rules/plugins/rolls/skill-essence.mjs - Academic Studies): this roll counts as
    // another Essence's, even over one the dataset named.
    rolledEssence = ruleSkillEssence(actor, { item, rolledSkill, dataset }) ?? rolledEssence;

    const essenceShifts = actor.system.essenceShifts;
    // The specific Specialization being rolled, if any (essence-skills.hbs sets
    // data-specialization-key to its slug key - see util/utils.mjs#slugifySpecializationName).
    // Looked up directly off the actor rather than trusted from the dataset, so a Perk's Active
    // Effect targeting system.skills.<skill>.specializations.<key>.shiftUp/edge/etc (see
    // essence20-specialization-redesign) actually reaches the roll.
    const specialization = dataset.specializationKey
      ? actor.system.skills[rolledSkill]?.specializations?.[dataset.specializationKey]
      : null;
    const combatModifiers = this._getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill, dataset);
    // High-Density - see items/attacks/high-density.mjs's own doc comment. The follow-up Attack's own
    // "(↓1)", folded into the automatic modifiers so it is listed (and toggleable) like any other.
    if (dataset.highDensityFollowUp && item?.type == 'weaponEffect') {
      combatModifiers.shiftDown += HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN;
      combatModifiers.sources.push({
        id: 'highDensityFollowUp', label: this._localize('E20.WeaponTraitHighDensity'),
        shiftUp: 0, shiftDown: HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN, edge: false, snag: false,
      });
    }

    // Kits - mechanics/resources/kits.mjs. What a kit used up still gives, and a carried Restricted kit's
    // Specialization or Edge. Competitive Strength's Brawn crits on the d2.
    // (Bonded Proficiency - a linked partner's Specializations are shared - is a RollModifier specialize rule.)
    if (!dataset.isSpecialized && extSpecializes(actor, rolledSkill, item, { ...dataset, rolledEssence })) {
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

    // Think On It / Plan of Action (see mechanics/resources/banked-buffs.mjs) - same "reported, not cleared,
    // by the synchronous function above" shape.
    for (const flagKey of combatModifiers.pendingBonusesToClear) {
      await clearPendingBonus(actor, flagKey);
    }

    // Bonuses banked by item rules (rules/bank.mjs) are spent here too, at the same point and for
    // the same reason - a plain roll with no target or DIF never reaches applyRollRiders, which
    // skips them for that reason.
    for (const consume of combatModifiers.riderConsumes ?? []) {
      if (['rulesBank', 'rulesLimit', 'rulesMark', 'rulesMarkOwn', 'rulesMarkOne'].includes(consume.ext)) {
        await runConsumer(consume);
      }
    }

    // Spot - see isSpotAttempt's own comment below and spottedTarget's own comment in
    // _getAutomaticCombatModifiers. Clears the TARGET's own flag (not the roller's), since that's
    // whose one-shot mark was just consumed by this attack.
    if (combatModifiers.spottedTarget) {
      await combatModifiers.spottedTarget.unsetFlag('essence20', 'spotted');
    }

    // Team Focus (Red Ranger, 9th/18th level) - marks the target as attacked, for a teammate's
    // later Team Focus check this round to read back - see items/attacks/team-focus.mjs's own doc
    // comment. Any weaponEffect attack marks it, regardless of the roller holding the Perk
    // themselves; the shiftUp itself is granted separately, in _getAutomaticCombatModifiers.
    if (item?.type == 'weaponEffect') {
      const teamFocusTarget = game.user.targets.first()?.actor;
      if (teamFocusTarget) {
        await markAttackedByAlly(actor, teamFocusTarget);
      }
    }

    // The Quiet One - see items/rolls/quiet-one.mjs's own doc comment. Marks any Driving roll, or any
    // weaponEffect attack with a weapon lacking the Silent trait (an attack with no weapon at all
    // also counts - it never carries a Silent trait either), regardless of the roller holding The Quiet
    // One themselves - unconditional on the roll's own outcome, since RAW says "operated" or
    // "attacked with," not "successfully."
    if (rolledSkill == 'driving'
      || (item?.type == 'weaponEffect' && !this._getParentWeapon(actor, item)?.system.traits?.includes('silent'))) {
      await markQuietOneNoisyAction(actor);
    }

    // A SnagOrMiss rule's use (Move Like a Song - rules/plugins/combat/snag-or-miss.mjs) - the function above is
    // synchronous and can't spend it itself.
    if (combatModifiers.snagOrMissSpend) {
      await spendSnagOrMiss(combatModifiers.snagOrMissSpend);
    }

    // Emotional Mastery: Disgust - same synchronous-function-can't-await shape as Move Like a
    // Song just above.
    if (combatModifiers.disgustTriggered) {
      const disgustTarget = game.user.targets.first()?.actor;
      if (disgustTarget) {
        await markUsedThisTurn(disgustTarget, DISGUST_TURN_FLAG);
      }
    }

    // Range for Ranged Attacks (p.201): no attacking inside a weapon's minimum range - the one real hard block anywhere in this file (everything else here
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

    // Every equipped armor this actor is wearing right now - shared by Enhance Skill/Xenotech/
    // Regal (armor traits) just below, the same "filter documentsByType.armor for equipped" idiom
    // _getPlatingArmorToughness/_getDeflectiveArmorToughness already use for combat modifiers.
    const equippedArmor = actor.items?.documentsByType?.armor?.filter(a => a.system.equipped) ?? [];

    // Enhance Skill (Across the Stars, Armor Traits, p.85): ↑1 to the Skill the trait names. Summed across
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

    // Xenotech (Across the Stars, Armor Traits, p.85): alien-built armor - ↓1 on the wearer's
    // Athletics and Acrobatics. Distinct from the weapon trait of the
    // same name (a per-weapon Snag-until-Critical-Success gate - not yet built, see the weapon
    // trait audit's own notes) - armor and weapon Xenotech share a config key but not a rule.
    if (['athletics', 'acrobatics'].includes(rolledSkill)) {
      calculatedShiftDown += equippedArmor.filter(a => a.system.traits?.includes('xenotech')).length;
    }

    // Regal (Across the Stars, Armor Traits, p.82): ↑1 on Persuasion aimed at allies and Intimidation
    // aimed at enemies. Allies/enemies read
    // as the established disposition-equality ally proxy (items/healing/comic-flair.mjs's own doc
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

    // Enviro-Sealed (Across the Stars, Armor Traits, p.85): immune to most environmental conditions,
    // and Edge on tests to resist adverse situations. Which tests resist an adverse situation isn't a concept this
    // codebase can identify in general (the same "no hook to check a fictional qualifier against"
    // gap Environmental Expertise's own doc comment already accepts), so the Edge comes from a Roll
    // Options Dialog checkbox (updatedShiftDataset.enviroSealedAdverseSituationAvailable below). It
    // starts ticked in the one adverse-situation case this CAN check for free - the wearer's own
    // physical environment (mechanics/world/environment.mjs) being anything other than `normal` - and is
    // the player's call otherwise (resisting poison, fear, disease, and the like). The immunity half
    // ("most environmental conditions") isn't built - this system has no generic "environmental
    // condition" category to grant immunity from.
    const hasEnviroSealedEdge = isEnviroSealedEdgeActive(equippedArmor, getEnvironment(actor));

    // Nemesis (Decepticon Directive, Influence Perk and its Hang-Up, p.27) are RollModifier rules on the items
    // (check:decepticonNemesis / check:nemesisInScene - items/rolls/nemesis-decepticon.mjs).

    /* Lend Assistance, skill half (GI Joe CRB p.197): a character with at least the ally's Ranks
       in a Skill can give that ally ↑1 on it. Banked on the ally by
       mechanics/actions/lend-assistance.mjs, which is also where the levels prerequisite is checked -
       by the time it reaches here the grant has already been earned. Same shape as Shoulder To
       Shoulder just below, and cleared the same way: consumed by the first matching roll. */
    const pendingLendAssistanceShift = getPendingBonus(actor, LEND_ASSISTANCE_SHIFT_FLAG);
    // The assister's Perks can add an Edge to the same grant (Bureaucrat, Greenshirt, Teacher,
    // Lesson Plan - see lend-assistance.mjs#getAssistEdge). skillDataset doesn't exist yet at
    // this point, so it is remembered here and applied once it does, further down.
    let lendAssistanceEdge = false;
    // The assister's own uuid (banked alongside the shift by lend-assistance.mjs), kept on checkContext for the post-roll
    // readers (Betrayal; rollSeen's @var.assistedBy - Misled's Trigger).
    let lendAssistanceAssisterUuid = null;
    if (pendingLendAssistanceShift?.skill == rolledSkill && imperfectionOf(actor)?.n != 7) {
      // Defaulted so a flag banked before the Perk upgrades existed still applies its ↑1.
      calculatedShiftUp += pendingLendAssistanceShift.shiftUp ?? 1;
      lendAssistanceEdge = !!pendingLendAssistanceShift.edge;
      lendAssistanceAssisterUuid = pendingLendAssistanceShift.assisterUuid ?? null;
      // Those Who Know, Teach (MLP CRB, Mentor Influence, p.53) - see its own comment in
      // mechanics/actions/lend-assistance.mjs. A persistent grant keeps matching every roll of this same
      // skill for the rest of the encounter instead of being cleared after the first.
      if (!pendingLendAssistanceShift.persistent) {
        await clearPendingBonus(actor, LEND_ASSISTANCE_SHIFT_FLAG);
      }
    }

    // Friendship Circle (MLP CRB, every Spirit Role, 1st level) - see
    // items/social/friendship-circle.mjs. ↑1 per Pony in the Friendship Circle, drawn
    // from the shared pool onto this pony and taken by whichever Skill Test they make next.
    // Added here so the Roll Options Dialog opens showing it, but only CLEARED once the roll is
    // committed (below, after the dialog) - a cancelled dialog must not burn what the pony drew.
    const pendingCircleShift = getPendingBonus(actor, CIRCLE_SHIFT_FLAG);
    if (pendingCircleShift?.shiftUp) {
      calculatedShiftUp += pendingCircleShift.shiftUp;
    }

    // Calm Beast, Chivalrous, Puzzle Solver, Psych 101 and Charge Into Battle (check:multipleTargetsWeapon)
    // are item rules (RollModifier).

    // Item rules' DownshiftCancel (rules/plugins/rolls/downshift-cancel.mjs - Expertise, Low Tech Priorities): "ignore the
    // first ↓1" off the fully-stacked total, before the dialog.
    calculatedShiftDown = await ruleDownshiftCancel(actor, calculatedShiftDown, { item, rolledSkill, rolledEssence, dataset });

    // Honest Assessment (MLP CRB, Spirit of Honesty, 14th level, p.79) - see
    // items/rolls/honest-assessment.mjs's own doc comment. While active: ↓2 on both Deception and
    // Persuasion (RAW's own fixed self-cost, not player-chosen). The ↑2 on the chosen Skill is the
    // item's own rule.
    if (isHonestAssessmentActive(actor) && (rolledSkill == 'deception' || rolledSkill == 'persuasion')) {
      calculatedShiftDown += 2;
    }

    // (Powerful Suggestions' "fail" ↓3 is a RollModifier its suggestFail mark carries onto the target.)

    // (Zeo Crystal Boost's Morpher ↑1 on unarmed attacks is a RollModifier on the Power.)

    const updatedShiftDataset = {
      ...dataset,
      shiftUp: calculatedShiftUp,
      shiftDown: calculatedShiftDown,
    };
    const actorSkillData = actor.getRollData().skills[rolledSkill];
    let initialShift = essenceShifts[rolledEssence]?.untrainedBonus && dataset.shift == "d20"
      ? "d2"
      : dataset.shift || actorSkillData.shift;

    // Item rules' DieSubstitution (rules/adapter.mjs#ruleDieSubstitution): another Skill's die, the best
    // of several, or a floor - after the hand-written substitutions above (Aerial Acrobat, Circuit
    // Breaker, Cultural Connection, Brutal Verbalities and Agency's Wealth die are best-of rules, so
    // their order among themselves and Kill Counter's (a crew one) doesn't matter; Jacket Wrestler's outright swap
    // stays above, ahead of them).
    const dieRules = ruleDieSubstitution(actor, game.user?.targets?.first?.()?.actor ?? null, { item, rolledSkill, rolledEssence, dataset }, initialShift);
    initialShift = dieRules.shift;
    if (dieRules.specialize) {
      updatedShiftDataset.isSpecialized = true;
    }

    // "A" for Effort!'s once-per-session d2 and no Snag on an untrained roll is the Origin's own
    // DieSubstitution floor rule (roll:dataset:shift=d20, limit per session), just above.

    // Basic Intelligence's d2 and no Snag on an untrained roll is a DieSubstitution floor rule on its Perk too.

    // (Ageless Knowledge's d2-to-d4 floor is a DieSubstitution rule on its Perk, consuming its mark - above.)

    // Bio-Energy Conversion's ↑2 (and +2 damage) the round after it's used are rules on the Feature.

    // (Relic Key's declared one-roll Edge is a banked Edge - its Feature's Use rule.)

    // Linked (GI Joe CRB, Vehicle Trait, p.173): "Linked weapons gain an Edge on attacks." A
    // weapon-level trait (same idiom as the existing 'ballistic' checks throughout this file,
    // e.g. Worth a Shot/Straight Shooter above), not scoped to Vehicles specifically - RAW's own
    // example Linked weapons (Rocket Launcher, Twin Cannons, ...) are all ordinary weapon items.
    const hasLinkedEdge = item?.type == 'weaponEffect'
      && !!this._getParentWeapon(actor, item)?.system.traits?.includes('linked');

    const skillDataset = {
      shift: initialShift,
      // dataset.edge: a plain caller-supplied Edge, for non-combat rollSkill() calls a helper
      // makes directly (e.g. mechanics/resources/requisition.mjs#rollRequisition consuming Benefits of
      // Command's own banked Edge) rather than something this method derives itself.
      edge: actorSkillData.edge || !!essenceShifts[rolledEssence]?.edge || combatModifiers.edge
        || !!specialization?.edge || hasLinkedEdge
        || !!dataset.edge,
      snag: actorSkillData.snag || !!essenceShifts[rolledEssence]?.snag || combatModifiers.snag
        || !!specialization?.snag,
    };

    // A DieSubstitution rule that clears the Snag (a floor like "A" for Effort!'s), and its limits.
    if (dieRules.clearSnag) {
      skillDataset.snag = false;
    }

    await dieRules.spend();

    // Spoiled's own Hang-Up (its Snag on one Requisition test a scene) is the item's own rule.

    // Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): a Snag on a Social
    // test about understanding another species may be traded for ↓2. The other-species condition has no hook
    // to verify - the player self-polices the fictional trigger, the same idiom Aiming/Precision
    // Aim's own checkboxes already use. Only offered once skillDataset.snag is already true (this
    // roll's own pre-dialog Snag state), while disguised, on a Social-essence Skill Test -
    // consumption (converting the Snag into an actual ↓2) lives post-dialog below.
    updatedShiftDataset.observerSnagSubstitutionAvailable = skillDataset.snag
      && rolledEssence == 'social' && isObserverDisguiseActive(actor);

    // Any currently-disabled effect (the actor's own, or a Perk's) that would touch this skill if
    // it were on - offered in the Roll Options Dialog as an opt-in-for-this-roll toggle instead of
    // needing to be manually (and persistently) re-enabled on the Effects tab first. See
    // mechanics/rolls/skill-effects.mjs's own doc comment.
    updatedShiftDataset.availableSkillEffects = getToggleableSkillEffects(actor, rolledSkill, rolledEssence);

    // Every automatic combat modifier that actually fired this roll (see
    // _getAutomaticCombatModifiers's own addSource doc comment) - surfaced in the Roll Options
    // Dialog so the player can see where their shiftUp/shiftDown number came from, and toggle an
    // individual shiftUp/shiftDown-granting one off for just this roll (edge/snag entries are
    // informational only - see updatedShiftDataset's own consumption below).
    updatedShiftDataset.combatModifierSources = combatModifiers.sources;

    // Retrogen - see items/attacks/retrogen.mjs's own doc comment. The off-by-default toggle, offered
    // only when the automatic modifier above didn't already fire for this target.
    const attackTraitParentWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    updatedShiftDataset.retrogenAvailable = isRetrogenWeapon(attackTraitParentWeapon)
      && !combatModifiers.sources.some(source => source.id == 'retrogen');

    // Fanning - see items/attacks/fanning.mjs's own doc comment. 0 hides the dialog's shot-count input.
    // Never offered on a High-Density follow-up (that is a single extra Attack, not a new volley).
    updatedShiftDataset.fanningMaxShots = dataset.highDensityFollowUp ? 0 : getFanningMaxShots(actor, attackTraitParentWeapon);

    // Pre-select the Roll Options Dialog's Defense dropdown from the weaponEffect's configured
    // Defense (p.168-169). A plain skill roll defaults to 'none' unless the caller already set
    // dataset.defenseType (e.g. a @Check[defense=...] enricher link, see util/enrichers.mjs),
    // and the player can always still choose a Defense manually to roll a Skill Test against a
    // targeted actor.
    // Keyed on the item actually declaring a Defense rather than on its type, so an attack SPELL
    // (spell.mjs's own system.defenseType, null for the ordinary non-attack majority) pre-selects
    // the dropdown exactly the way a weaponEffect always has. A weaponEffect's own field is
    // non-null by schema default, so it still always wins, and every other item type has no such
    // field at all and falls straight through - this is a widening, not a behavior change.
    updatedShiftDataset.defenseType = item?.system?.defenseType ?? (dataset.defenseType || 'none');

    // (Personal Heirloom's ↑1 with the chosen weapon, and Reckless Abandon's ↑2 on Strength Skill Tests - light or no armor,
    // not while Racer Abandon's driving without Rigged Rider - are RollModifier rules on those items: rules/conv17-split2.test.js.)
    // Racer Abandon (Cobra Codex p.61): the ↑2 moves from Strength tests to Driving tests while driving; Rigged Rider keeps both (mechanics/companions/summons.mjs).
    const racer = racerRecklessShifts(actor);
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

    // Eureka's d2 crit on Field Skill Tests is its CritOnD2 rule (skill:choiceOf:<Field>).
    // Eureka! (Blue Ranger), Eltarian Tech, "I remember reading about..." and Mystical Understanding's
    // Spellcialize are DialogSwitch rules on their own items.

    // Enviro-Sealed - see hasEnviroSealedEdge's own comment above. Shown whenever the actor wears
    // this armor at all (not gated on environment - this is specifically the checkbox for adverse
    // situations OTHER than the physical environment, which is handled automatically instead).
    updatedShiftDataset.enviroSealedAdverseSituationAvailable = hasEquippedEnviroSealedArmor(equippedArmor);
    // In a hostile physical environment the same checkbox starts ticked, rather than the Edge being
    // forced on ahead of the dialog - so the dialog shows why there's an Edge, and the player or GM
    // can untick it for a roll that isn't resisting anything. Ticking moves the dialog's own
    // Snag/Normal/Edge radio with it (mechanics/rolls/edge-toggle-link.mjs), which is what gets rolled.
    updatedShiftDataset.enviroSealedAdverseSituationChecked = hasEnviroSealedEdge;

    // Always Ready is a DialogSwitch rule on its own item (one per function).

    // Item rules' EdgeOrShift (Expert in Your Field - rules/plugins/rolls/edge-or-shift.mjs): an Edge, or ↑N when the roll
    // already has one (skill training, Essence shifts, the automatic modifiers above).
    const edgeOrShift = ruleEdgeOrShift(actor, { item, rolledSkill, rolledEssence, dataset });
    if (edgeOrShift !== null) {
      if (skillDataset.edge) {
        updatedShiftDataset.shiftUp += edgeOrShift;
      } else {
        skillDataset.edge = true;
      }
    }

    // Emotional Mastery: Interest (A Jump Through Time, Purple Ranger, p.37) - Edge on Alertness and
    // Culture while active. See items/resources/emotional-mastery.mjs's
    // own doc comment.
    if ((rolledSkill == 'alertness' || rolledSkill == 'culture') && isEmotionalMasteryOptionActive(actor, 'interest')) {
      skillDataset.edge = true;
    }

    // Emotional Mastery: Joy (A Jump Through Time, Purple Ranger, p.37) - ↑1 on the first Skill Test
    // each turn with an ally within 5ft, while active. Self-status,
    // hasUsedThisTurn-gated - marked immediately here (this section already runs inside an async
    // continuation, unlike the per-target block's own synchronous constraint Disgust/Move Like a
    // Song work around).
    if (game.combat && isEmotionalMasteryOptionActive(actor, 'joy') && !hasUsedThisTurn(actor, 'joyUsedThisTurn')
      && getNearbyAllyTokens(actor, 5).length > 0) {
      updatedShiftDataset.shiftUp += 1;
      await markUsedThisTurn(actor, 'joyUsedThisTurn');
    }

    // Two Steps to the Right's Edge for allies within 60 ft is the Perk's own aura RollModifier.

    // Tourniquet Line Chef / EMT Crash Course (Medicine), Astro-Sense (Space / Astro-Nav) and
    // Broadcaster (Communications) are RollModifier rules on their own items.

    // (Surgical Operators - its Edge only when treating a poison or toxin - is an off-by-default DialogSwitch rule.)

    // EnvironmentalExpertise rules (rules/plugins/effects/environmental-expertise-rule.mjs - Environmental Expertise,
    // Read The Land, In Their Element). "Non-combat Skill Tests" is approximated as "not an Attack" (item?.type !=
    // 'weaponEffect'), the same proxy Exploit Trust's own "outside of Combat" check already establishes for a similar
    // RAW distinction. The Edge is also listed as a Roll Options Dialog source, labelled with the scene's terrain when
    // that (rather than the toggle) is what put the actor in their environment of expertise. (Guidance's one-roll grant
    // is a pair of marked RollModifiers on the Perk.)
    const environmentalExpertise = ruleEnvironmentalExpertise(actor);
    if (environmentalExpertise) {
      if (item?.type == 'weaponEffect') {
        updatedShiftDataset.isSpecialized = true;
      } else {
        skillDataset.edge = true;
        combatModifiers.sources.push({
          id: 'environmentalExpertise',
          label: getEnvironmentOfExpertiseSourceLabel(actor, ruleLabel(environmentalExpertise.rule, environmentalExpertise.item)),
          shiftUp: 0, shiftDown: 0, edge: true, snag: false,
        });
      }
    }

    // Down the Barrel's Edge (check:favoriteWeaponEquipped) is the Perk's own RollModifier.

    // (Data Bridge's borrowed Specialization is a bank {specialize, key: dataBridge} its Use rule leaves.)

    // (Trade School - the coach's die, Specialization and Technical Mastery's d2 crit for the coached ally - is item
    // rules carried by the coach's marks: DieSubstitution / RollModifier / CritOnD2 scope marked, read above.)

    // Technical Mastery's direct half, Perimeter Defender and Fancy Flier are item rules (CritOnD2 above).

    // (Zeo Crystal Boost's Zord Driving ↑1 is a RollModifier on the Power.)

    // Now You Don't (Transformers CRB, General Perk, p.110) - see its own check in
    // Object Alt Mode (Transformers CRB, General Perk, p.110): Edge on hiding/blending/eavesdropping
    // tests - a Roll Options Dialog switch (a rule on its item).

    // Dinobot / Maximal / Predacon: Edge "when that Specialization comes into play" - a Roll Options
    // Dialog switch on the chosen Skill, on by default for a Specialization roll (rules on the items).

    // Takedown Expert's Edge on Takedown attempts and its bonus Condition on a failed one are the item's own rules.


    // Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see items/magic/mind-beam.mjs's own doc
    // comment. Threaded straight through from documents/item.mjs's own pre-roll picker.
    const mindBeamEffect = dataset.mindBeamEffect ?? null;

    // (Influential - a nearby ally's Field - is an ally-aura RollModifier on the Perk.)

    // Strike Bonus and Heavy Force are DialogSwitch rules on their own items (1 Personal Power each).

    // Isolated, Gutter Champion and Thrillseeker are DialogSwitch rules on their own items.

    // Restricted Wild Animal Survival Kit - see mechanics/resources/kits.mjs#wildAnimalPersuasion. A select of
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

    // Intimidating (GI Joe CRB/TF CRB, Weapon Effects and Traits, p.148 etc): the weapon can Intimidate
    // out to its range, rolling the weapon's Skill in place of Intimidation. Same
    // shift-position-delta substitution mechanism as Street Smarts above, but the substitute skill
    // is dynamic (whichever skill the actor's own equipped Intimidating weapon actually uses),
    // hence its own helper rather than a fixed second skill name. The weapon-range
    // qualifier is dropped as unenforceable outside an actual targeted attack roll, the
    // same "closest existing mechanism" idiom this project accepts for similar range/timing
    // qualifiers on non-combat Skill Test substitutions elsewhere (e.g. Reverse Engineer's own
    // "outside a conflict").
    updatedShiftDataset.intimidatingWeaponSkill = rolledSkill == 'intimidation'
      ? this._getIntimidatingWeaponSkill(actor)
      : null;

    // Precision Aim, Sneak Attack (Knights of Canterlot), All I Need is One Shot and Penetrating Shot are DialogSwitch
    // rules on their own items.

    // Hobble is a DialogSwitch (↓2) + hit Trigger rule on the Perk.

    // (Concentrated Fire's d2 is a CritOnD2 rule on the Perk.)

    // "Kit required" - mechanics/resources/kits.mjs.
    Object.assign(updatedShiftDataset, kitDialogFlags(actor));
    // Extension controls, drawn by the dialog's generic extToggles block (mechanics/item-hooks.mjs).
    // autoShiftDown: the automatic modifiers' ↓ (roll:autoDownshift - Straight Shooter).
    const extToggles = extDialogToggles(actor, { item, rolledSkill, rolledEssence, dataset, baseShift: initialShift, autoShiftDown: combatModifiers.shiftDown });
    if (extToggles.length) {
      updatedShiftDataset.extToggles = extToggles;
    }

    // Attacking Space Vessel Systems (Across the Stars p.25): the attacker may take ↓2 for an extra
    // Critical Effect - a Space Vessel Condition of their choice on the target until repaired. Offered only when the checkable requirements hold -
    // see mechanics/vehicles/vessel-conditions.mjs#canTargetVesselSystem. The Critical Effect is applied in
    // _rollSkillHelper's post-roll processing (checkContext.targetVesselSystemAttempt).
    updatedShiftDataset.targetVesselSystemAvailable = canTargetVesselSystem({
      item,
      attackerShift: actorSkillData?.shift,
      targets: item?.type == 'weaponEffect' && game.user?.targets?.size == 1
        ? [game.user.targets.first?.()?.actor].filter(Boolean) : [],
    });

    // An AttackChoice rule's pick (Bring It All Down - rules/plugins/combat/attack-choice.mjs), made once up front in
    // item.mjs: its ↑ here; its radius, damage and Armor-Piercing at aoe-targeting.mjs#placeAoeTemplate,
    // damageBonusValue, and the Armor Piercing/ignoreArmor recompute.
    if (Number(dataset.attackChoiceShiftUp) > 0) {
      updatedShiftDataset.shiftUp += Number(dataset.attackChoiceShiftUp);
    }

    // Cryogenic Touch's Impaired-on-hit checkbox is the Power's own DialogSwitch + hit Trigger. Guardian
    // Strikes, Stick In The Spokes and Interdiction are DialogSwitch (noDamage) + hit Trigger rules too.

    // (Savant Skill's d4 and Metallikato's Bot Mode ignore-armor switch are DialogSwitch rules on their Perks.)


    // Programmable (Field Guide to Action and Adventure, Android Origin Benefit, p.60): each Free
    // action spent gives ↑1 on a Skill Test, up to three on one test. Offered unconditionally (any Skill Test), a fixed cap of 3
    // - same "fixed cap, not a banked resource" shape Demolition Driver just above uses (this is a
    // Free action, not a limited resource spend). Its d12 ceiling (no upshift from any source takes
    // the Rank past d12) is enforced separately, right after
    // _getFinalShift resolves the whole roll (see skillRollOptions.programmableCapD12 below).

    // Military Formality is a DialogSwitch rule on its own item (a 0-3 number box).

    // Dependable Tanker and Hacking Algorithms are DialogSwitch rules on their own items.

    // Electric (Damage Types): Electric attacks get ↑1. A core rule of the
    // damage type itself, unconditional and not gated behind any Perk - every Electric-damage
    // weaponEffect gets this, the same "checks item.system.damageType directly" shape as Barrel
    // Through just above.
    //
    // Tasing / Voltage Tank (PR CRB Weapon Upgrades, p.117-118): the weapon picks up the Electric
    // trait - the upgrade never touches the weaponEffect's own damageType field, only the parent
    // Weapon item's system.traits (merged into itemAndUpgradeTraits by documents/item.mjs's own
    // _prepareTraits). Checking the parent weapon's traits alongside the weaponEffect's own
    // damageType is what actually makes those two upgrades (and any future "gains the Electric
    // trait" grant) do something, rather than remaining a purely cosmetic label.
    if (item?.type == 'weaponEffect' && (item.system.damageType == 'electric'
      || this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('electric'))) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Lend Assistance's Edge - see lendAssistanceEdge where the shift half is consumed above.
    if (lendAssistanceEdge) {
      skillDataset.edge = true;
    }

    // Magically Fit In's ranks - the holder's own (Mystical Understanding) and a friend's (Friendship Is Mystical) - are
    // RollModifier rules on those Perks.

    // Peerless Pilot (GI Joe CRB) - both halves (Driving ↑2, Initiative Edge) are the item's own rules.

    // Tracker (Environmental)'s ↑2 is the item's own rule (check:environmentalExpertise).

    // Martial Zord, Zero-G and Zord Sentience are RollModifier rules on the Zord Features
    // themselves (check:zordHasDriver).

    // Power Adaptation - Crushing Strength (Across the Stars, Silver Ranger, 9th/18th level,
    // p.57) - see items/forms/power-adaptation.mjs's own doc comment. ↑2 on Athletics and Brawn
    // while active.
    if ((rolledSkill == 'athletics' || rolledSkill == 'brawn') && isPowerAdaptationActive(actor, 'crushingStrength')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Pack Mule's ↓2 on Strength / Speed is a marked-scope RollModifier on the spell (its hit Trigger sets the mark).

    // Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level) - see
    // items/attacks/toxic-terror.mjs's own doc comment. A Strength/Speed-scoped downshift, a stacking amount (no
    // round-scoped expiry).
    if (rolledEssence == 'strength' || rolledEssence == 'speed') {
      updatedShiftDataset.shiftDown += getToxicTerrorShiftDown(actor);
    }

    // Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // items/magic/greased-lightning.mjs's own doc comment. "Upshift 1 to Speed-related Skill Tests"
    // while active.
    if (rolledEssence == 'speed' && isGreasedLightningActive(actor)) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Mystery Sense (Knights of Canterlot, Superior Enchantment spell, p.47) - see
    // items/magic/mystery-sense.mjs's own doc comment. "+3 to Alertness, Infiltration, and Streetwise"
    // while active.
    if ((rolledSkill == 'alertness' || rolledSkill == 'infiltration' || rolledSkill == 'streetwise')
      && isMysterySenseActive(actor)) {
      updatedShiftDataset.shiftUp += 3;
    }

    // Foolscarrot (Knights of Canterlot, Elementary Enchantment spell, p.42) - see
    // items/magic/foolscarrot.mjs's own doc comment. "Downshift 3 to all Skill Tests" while active -
    // unconditional, not scoped to any particular skill/essence.
    if (isFoolscarrotActive(actor)) {
      updatedShiftDataset.shiftDown += 3;
    }

    // Wisdom of the Elders - Enhanced Reflexes (Through the Shattered Grid, Guardian of Eltar,
    // 9th/18th level, p.72): ↑2 on Acrobatics and Initiative while active - the
    // Acrobatics half (the Initiative ↑2 is the Wisdom of the Eldars item's own rule, read by
    // prepareInitiativeRoll()).
    if (rolledSkill == 'acrobatics' && isWisdomOfTheEldersActive(actor, 'enhancedReflexes')) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Ninja Power's Speed Edge (while Morphed with it active) is the item's own rule.

    // Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): "↑2 to
    // Deception Skill Tests" while the disguise is active - same shape as Enhanced Reflexes just
    // above.
    if (rolledSkill == 'deception' && isObserverDisguiseActive(actor)) {
      updatedShiftDataset.shiftUp += 2;
    }

    // Perfect Disguise's Edge while the disguise is active is the item's own rule.

    // Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50) - see
    // items/magic/ookie-spookies.mjs's own doc comment. Edge on sneaking while active - read as
    // Infiltration, this system's own sneaking skill.
    if (rolledSkill == 'infiltration' && isOokieSpookiesActive(actor)) {
      skillDataset.edge = true;
    }

    // Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21) - see
    // items/magic/disguise-spell.mjs's own doc comment. Same "Edge on Infiltration/Deception while
    // active" shape as Illusory Disguise/Observer just above.
    if ((rolledSkill == 'infiltration' || rolledSkill == 'deception') && isDsoeDisguiseActive(actor)) {
      skillDataset.edge = true;
    }

    // Power Adaptation - Striking Hands (Across the Stars, Silver Ranger, 9th/18th level, p.57) -
    // see items/forms/power-adaptation.mjs's own doc comment. "↑1 to your unarmed Attacks" while
    // active - "unarmed" is the shared definition (_isUnarmedWeaponEffect: no parent weapon, or a
    // printed unarmed one).
    if (this._isUnarmedWeaponEffect(actor, item)
      && isPowerAdaptationActive(actor, 'strikingHands')) {
      updatedShiftDataset.shiftUp += 1;
    }

    // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
    // items/senses/phantom-suite.mjs's own doc comment. ↑1 and Edge on Infiltration (Stealth)
    // while active - the Evasion Defense bonus half lives in the per-target
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
        // trigger conditions are actually known and automatable - see mechanics/combat/sneak-attack.mjs.
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

    // Aiming (p.192) is a Ranged weapon-specific Free action granting a 1 shift on a single
    // ranged attack test, plus an additional 1 shift with an attached Laser Sight (p.148/125).
    // Presented as a toggle in the Roll Options Dialog rather than tracked as standing state -
    // the dialog is a fresh form on every roll, so there's nothing to "consume" or clear on
    // Movement; the player simply only checks it when they actually aimed and haven't moved.
    const isRangedAttack = item?.type == 'weaponEffect' && item.system.classification.style != 'melee';

    // Item rules' AimBonus (rules/adapter.mjs#ruleAimBonus): Distance Vision's first Aim each turn, Dig
    // In's while dug in and Calculated Attack's primed Long Range Rifle shot give ↑2 instead of ↑1. Their
    // limits are spent (and Calculated Attack's priming cleared) only if the shot is aimed. A Laser
    // Sight's extra ↑1 is its own AimBonus rule (scope host - the weapon it's attached to).
    const aimRules = isRangedAttack ? ruleAimBonus(actor, game.user?.targets?.first?.()?.actor ?? null, { item, rolledSkill }) : { atLeast: 0, extra: 0, spend: async () => {} };
    updatedShiftDataset.aimBonus = isRangedAttack
      ? Math.max(1, aimRules.atLeast) + aimRules.extra
      : null;
    // The Aim action taken this turn (mechanics/actions/action-economy.mjs#isAiming) starts the switch on.
    updatedShiftDataset.aimedByAction = isRangedAttack && isAiming(actor);

    // Unshakeable Aim is the Perk's own DialogSwitch rule (replacesAim, costs 1 Personal Power).

    // In My Sights' Edge instead of the Aim bonus is the Perk's own DialogSwitch rule (replacesAim).

    // Energon Points (p.104-105): a Cybertronian may spend one to gain a 1 shift on any Skill
    // Test. Like Aiming, presented as a Roll Options Dialog toggle rather than standing state;
    // unlike Aiming, spending one actually consumes a real, persisted resource, so the point is
    // only deducted once the roll is confirmed (not if the dialog is cancelled).
    // Boolean(...) rather than plain && - actor.system.canTransform is undefined for actor
    // types that don't define it at all (e.g. some test/mock actors), and `undefined && x`
    // evaluates to undefined rather than false, leaking a non-boolean into the dataset.
    updatedShiftDataset.energonAvailable = Boolean(actor.system.canTransform && actor.system.energon.normal.value > 0)
      || !!energonDonor(actor);

    // "Roll a Skill Test as if Specialized" for a Story Point (GI Joe CRB p.127; every line has
    // it). Same Roll Options Dialog shape as Energon just above - a toggle the player checks,
    // paid only once the roll is confirmed - and only offered when the roll is not already
    // Specialized, since there would be nothing to buy. Draws on whichever pool is this
    // actor's own (mechanics/resources/story-points.mjs#poolFor).
    updatedShiftDataset.storyPointSpecializedAvailable = !updatedShiftDataset.isSpecialized && canSpendForActor(actor);

    // Fighting Style's Akimbo is a DialogSwitch rule on the Perk (per choice).

    // Two-Handed Assault is a DialogSwitch rule on its own item (one per handedness choice). Driving Strike is a
    // DialogSelect rule on its own item (option keys ignoreArmor / rerollSkillDice).

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

    // Prototype / Theoretical Kit - see mechanics/resources/kits.mjs#kitSources. A Snag that would cancel the
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

    // Item rules' DialogSwitch action (Surging's Free action, Analyze Target's Standard - rules/plugins/dialog/switch-action-cost.mjs):
    // paid now; one that can't be paid cancels the roll.
    if (!(await applySwitchActions(actor, skillRollOptions, { item, rolledSkill, rolledEssence, dataset, baseShift: initialShift, autoShiftDown: combatModifiers.shiftDown }))) {
      return { cancelled: true };
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
    // RollModifier key (rules/plugins/rolls/once-per-roll.mjs): a listed modifier's key travels with the roll (roll:switch:<key>).
    if (sourceKeys(updatedShiftDataset.combatModifierSources).length) {
      skillRollOptions.ruleKeys = [...new Set([...(skillRollOptions.ruleKeys ?? []), ...sourceKeys(updatedShiftDataset.combatModifierSources)])];
    }

    for (const source of updatedShiftDataset.combatModifierSources) {
      if (skillRollOptions.disabledModifierSourceIds?.includes(source.id)) {
        skillRollOptions.shiftUp -= source.shiftUp;
        skillRollOptions.shiftDown -= source.shiftDown;
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

    // Fanning - see items/attacks/fanning.mjs's own doc comment. The first shot's own shifts go straight
    // into the roll's totals here; every later shot is re-resolved from these in the repeat loop.
    const fanningShots = clampFanningShots(skillRollOptions.fanningShots, updatedShiftDataset.fanningMaxShots);
    const fanningFirstShotUpshift = fanningShots > 0 ? getFanningFirstShotUpshift(actor) : 0;
    const firstFanningShot = fanningShots > 0 ? getFanningShotShifts(1, fanningFirstShotUpshift) : null;
    if (firstFanningShot) {
      skillRollOptions.shiftUp += firstFanningShot.shiftUp;
      skillRollOptions.shiftDown += firstFanningShot.shiftDown;
    }

    await applyDialogKits(actor, skillRollOptions, { skill: rolledSkill, spec: specialization?.name ?? null, consumes: kitBoosts.consumes });
    // baseShift: a ticked "roll <Skill> instead" switch (DialogSwitch useSkill) is the shift-position
    // difference from the die settled on before the dialog (initialShift), not the Skill's plain shift.
    await runApplyDialog(actor, skillRollOptions, { item, rolledSkill, rolledEssence, dataset, baseShift: initialShift, autoShiftDown: combatModifiers.shiftDown });

    if (skillRollOptions.isAiming) {
      skillRollOptions.shiftUp += updatedShiftDataset.aimBonus;
      await aimRules.spend();
    }

    // As if Specialized for a Story Point - see updatedShiftDataset.storyPointSpecializedAvailable
    // above. Forces the dialog's own Specialized toggle on, the same "checkbox forces an
    // already-resolved field" shape Solo Shot/Eureka! use, and spends once the roll is
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

      // Item rules' EnergonSpendBonus (Imaginative Engineering - rules/plugins/rolls/energon-spend-bonus.mjs).
      skillRollOptions.shiftUp += await ruleEnergonSpendBonus(actor, { item, rolledSkill, rolledEssence, dataset });

      const energonBefore = actor.system.energon.normal.value;
      const newEnergonValue = energonBefore - 1;

      // A component's EnergonDonor rule (Better As One, EoC p.34 - rules/plugins/zords/megaform-contributions.mjs) may pay it
      // from their own pool instead of the combined form's - always when the form has none, and by choice when it has.
      let donor = energonDonor(actor);
      if (donor && actor.system.energon?.normal?.value > 0) {
        const payer = await foundry.applications.api.DialogV2.wait({
          window: { title: actor.name },
          content: `<p>${this._localize('E20.EnergonDonorAsk', { form: actor.name, donor: donor.name })}</p>`,
          buttons: [
            { action: 'form', label: actor.name, default: true },
            { action: 'donor', label: donor.name },
          ],
          rejectClose: false,
        });
        if (payer != 'donor') {
          donor = null;
        }
      }

      if (donor) {
        await payEnergonDonor(donor);
      } else {
        await actor.update({ 'system.energon.normal.value': newEnergonValue });
        // Item rules' rollEnergonSpent Triggers (Energon Efficiency - rules/plugins/rolls/energon-spend-bonus.mjs).
        await fireRollEnergonSpent(actor, energonBefore, { item, rolledSkill, rolledEssence, dataset });
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

    // Observer - see updatedShiftDataset.observerSnagSubstitutionAvailable's own comment above.
    // No cost to spend - just converts the Snag this roll already had into a flat ↓2 instead, the
    // same "checkbox forces the final Edge/Snag choice" shape Solo Shot just above uses.
    if (skillRollOptions.applyObserverSnagSubstitution) {
      skillRollOptions.snag = false;
      skillRollOptions.shiftDown += 2;
    }

    // A ticked clearPenalties switch (Ambitious - rules/plugins/dialog/switch-clear-penalties.mjs) zeroes the final
    // Snag / shiftDown outright, after everything above.
    if (ruleClearsPenalties(actor, skillRollOptions)) {
      skillRollOptions.snag = false;
      skillRollOptions.shiftDown = 0;
    }

    // Attacking Space Vessel Systems - see updatedShiftDataset.targetVesselSystemAvailable above.
    const isTargetVesselSystemAttempt = !!skillRollOptions.applyTargetVesselSystem
      && !!updatedShiftDataset.targetVesselSystemAvailable;
    if (isTargetVesselSystemAttempt) {
      skillRollOptions.shiftDown += TARGET_VESSEL_SYSTEM_SHIFT_DOWN;
    }

    // A ticked rule switch's capDie (Programmable - rules/plugins/rolls/die-facts.mjs): the d12 cap below.
    if (skillRollOptions.ruleCapDie == 'd12') {
      skillRollOptions.programmableCapD12 = true;
    }

    // Item rules' tradeUpshifts switches (Size Matters - rules/plugins/rolls/upshift-trade.mjs): the ↑ entered are traded
    // off the roll's settled ↑ total for damage, folded into damageBonusValue below.
    const upshiftTrade = tradeRuleUpshifts(actor, skillRollOptions, { item, rolledSkill, rolledEssence, dataset, baseShift: initialShift, autoShiftDown: combatModifiers.shiftDown });

    // A ticked rule switch with noDamage (Guardian Strikes, Stick In The Spokes, Interdiction) - the
    // attack forgoes its damage (folded into damageValue / secondaryDamage below); its hit Trigger does the rest.
    const ruleForgoDamage = !!skillRollOptions.ruleNoDamage;

    // Enviro-Sealed's checkbox needs nothing here: the dialog moves its Snag/Normal/Edge radio with
    // the checkbox (mechanics/rolls/edge-toggle-link.mjs), so skillRollOptions.edge/snag already carry it.

    // Item rules' SnagImmunity (rules/plugins/rolls/snag-immunity.mjs - Time Traveler's chosen Skill): the final Snag goes,
    // after every Snag above.
    if (ruleSnagImmune(actor, { item, rolledSkill, rolledEssence, dataset, isAttack: item?.type == 'weaponEffect' })) {
      skillRollOptions.snag = false;
    }

    // Ticked switch / chosen DialogSelect option keys dice.mjs itself understands (Driving Strike's DialogSelect - paid
    // when the dialog closed, once regardless of "times to roll"): ignoreArmor - the attack meets every target's Defense
    // without its armor bonus (each per-attack Defense value below); rerollSkillDice - the Skill dice are rerolled once
    // rolled (_rollSkillHelper).
    const rerollSkillDice = (skillRollOptions.ruleKeys ?? []).includes('rerollSkillDice');
    const keyIgnoresArmor = (skillRollOptions.ruleKeys ?? []).includes('ignoreArmor');

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

    // Item rules' DownshiftCap (Advantageous Fighter - rules/plugins/rolls/die-facts.mjs), on the settled Edge.
    const downshiftCap = ruleDownshiftCap(actor, {
      item, rolledSkill, rolledEssence, dataset, isAttack: item?.type == 'weaponEffect',
      isMelee: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee', edge: !!skillRollOptions.edge,
    });
    if (downshiftCap !== null) {
      skillRollOptions.shiftDown = Math.min(skillRollOptions.shiftDown, downshiftCap);
    }

    // Prototype / Theoretical Kit - see mechanics/resources/kits.mjs#kitSources. Same "right before the shifts
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

    // A d12 ceiling (a capDie switch - Programmable): E20.skillShiftList has tiers above d12 (2d8, 3d6,
    // autoSuccess...) that enough ↑ reach, so the final die is clamped here.
    if (skillRollOptions.programmableCapD12) {
      const d12Index = E20.skillShiftList.indexOf('d12');
      const finalShiftIndex = E20.skillShiftList.indexOf(finalShift);
      if (finalShiftIndex != -1 && finalShiftIndex < d12Index) {
        finalShift = 'd12';
      }
    }

    // A ticked setDie switch (Savant Skill - rules/plugins/dialog/switch-set-die.mjs): ahead of the auto-fail check, so a
    // roll shifted all the way down still gets the die.
    const setDie = ruleSetDie(actor, skillRollOptions);
    if (setDie) {
      finalShift = setDie;
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

    // (Omega Enhancement's Charged-Up / Muscle Modes are RollModifier bonus rules on the Form Perk - in
    // skillEffectModifierBonus.)
    // actorSkillData.modifier/skillEffectModifierBonus are sometimes stored as strings (e.g.
    // "0") - Number()'d explicitly here so they don't string-concatenate into an unparseable
    // value like "00-1" instead of a number.
    const modifier = Number(actorSkillData.modifier || 0) + Number(skillRollOptions.skillEffectModifierBonus || 0);

    // Item rules' RollDice (rules/adapter.mjs#ruleRollDice), once the final die is known: a cap, steps up
    // (Super Specialized), a d20 floor (Silver Tongue) and a third d20 (Kill Shot, Precision is Perfection).
    const diceRules = ruleRollDice(actor, game.user?.targets?.first?.()?.actor ?? null, {
      item, rolledSkill, rolledEssence, edge: !!skillRollOptions.edge, snag: !!skillRollOptions.snag,
      dataset: { ...dataset, isSpecialized },
    });
    if (diceRules.maxDie) {
      const capIndex = E20.skillShiftList.indexOf(diceRules.maxDie);
      if (capIndex >= 0 && E20.skillShiftList.indexOf(finalShift) < capIndex) {
        finalShift = diceRules.maxDie;
      }
    }

    if (diceRules.stepUp) {
      const shiftIndex = E20.skillShiftList.indexOf(finalShift);
      const rollable = E20.skillShiftList.indexOf(E20.skillRollableShifts[E20.skillRollableShifts.length - 1]);
      if (shiftIndex > 0) {
        finalShift = E20.skillShiftList[Math.max(rollable >= 0 ? rollable : 0, shiftIndex - diceRules.stepUp)];
      }
    }

    // See _getd20Operand's own comment for the min10 and 3d20kh mechanics.
    const floorD20At10 = diceRules.d20Floor >= 10;
    const rollsThreeD20 = diceRules.thirdD20;

    // Item rules' FlatD20 boxes (Dependable, Old Reliable, Legendary Dependability - rules/plugins/rolls/flat-d20.mjs): decided
    // now the Edge / Snag is settled; a box that can't apply after all does nothing and costs nothing.
    const { value: flatD20Value, both: flatBothD20s } = await ruleFlatD20(actor, skillRollOptions, { item, rolledSkill, rolledEssence, dataset });

    // Item rules' BonusPoolDie (Rumble in the Jungle - rules/plugins/rolls/die-facts.mjs): a Skill's die into the pool.
    const rumbleBonusDie = ruleBonusPoolDie(actor, {
      item, rolledSkill, rolledEssence, dataset, isAttack: item?.type == 'weaponEffect',
      isMelee: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee',
    }, game.user?.targets?.first?.()?.actor ?? null)
      // Or a bonus Skill Die an extension added from the dialog (Wild Idea -
      // items/rolls/old-hand-do-or-die.mjs).
      ?? skillRollOptions.extBonusPoolDie ?? null;

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

    // Fanning - see items/attacks/fanning.mjs's own doc comment. One entry per shot of the volley: shot 1
    // is the formula just built; each later shot re-resolves the shift with its own larger ↓ (and
    // without Storm of Lead's first-shot ↑1), then gets the same post-shift adjustments shot 1 got.
    // An autoFail shot can't be rolled at all, which ends the volley there.
    const fanningVolley = [];
    if (fanningShots > 1) {
      fanningVolley.push({ formula, shift: finalShift, autoFail: false });
      for (let shotNumber = 2; shotNumber <= fanningShots; shotNumber++) {
        const shot = getFanningShotShifts(shotNumber, fanningFirstShotUpshift);
        const shotShift = this._getFinalShift({
          ...skillRollOptions,
          shiftUp: skillRollOptions.shiftUp - firstFanningShot.shiftUp + shot.shiftUp,
          shiftDown: skillRollOptions.shiftDown - firstFanningShot.shiftDown + shot.shiftDown,
        }, initialShift, E20.skillShiftList, rolePoints);
        const adjusted = adjustFanningShotShift(shotShift, {
          programmableCapD12: !!skillRollOptions.programmableCapD12,
          savant: setDie == 'd4',
          // A RollDice step up (Super Specialized) steps every later shot up once more too.
          superSpecialized: diceRules.stepUp > 0,
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
    // (util/enrichers.mjs) sets a flat Difficulty with no target at all - dataset.dif is only
    // ever present on the roller's own dataset when that roller is the GM, per that enricher's
    // GM-only-visibility design. Either way this produces one or more "entries" to compare the
    // roll total against; with neither, this falls back to a plain roll message below.
    // (Penetrating Rounds' deflective-armor ignore with a shotgun or submachine gun is an AttackTraits rule on the Perk.)

    // (Trigger Happy's second compare against Willpower is an afterRoll Trigger rule on Fighting Style -
    // targetRowsBeating.)

    const targets = Array.from(game.user.targets);
    let checkEntries = null;
    if (skillRollOptions.defenseType && skillRollOptions.defenseType != 'none' && targets.length) {
      checkEntries = await Promise.all(targets.map(async token => {
        // Which Defense this specific target actually uses against this specific attack (Welcome
        // to Night Vale Host Guide's shared Combat Actions chapter, p.33-34, matching every core
        // rulebook's own identical rule): the defender usually picks the Defense by how they react.
        // See mechanics/combat/defense-choice.mjs's own doc comment for the reference and why this used to be backwards (the ATTACKER's own Roll Options
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

        // Fly In The Future - an EvasiveManeuvers rule (rules/plugins/combat/evasive-maneuvers-rule.mjs). RAW forces
        // Evasion "instead of Toughness" specifically, so it overrides the defender's own choice
        // only when that choice was Toughness - any other Defense they pick stands. RollModifier
        // immune: evasiveManeuvers lifts it (Anti-Air Combat Training - rules/plugins/combat/defense-swap.mjs).
        const defenseRoll = { item, rolledSkill, rolledEssence, dataset, switches: skillRollOptions.ruleKeys ?? [] };
        if (resolvedDefenseType == 'toughness' && ruleEvasiveManeuvers(token.actor)
          && !ruleImmunities(actor, token.actor, defenseRoll, 'evasiveManeuvers').length) {
          resolvedDefenseType = 'evasion';
        }

        // TargetedDefense rules on the defender (Scramble - rules/plugins/combat/targeted-defense.mjs). Unconditional,
        // unlike Fly In The Future above - they override ANY resolved choice, not just a Toughness default.
        resolvedDefenseType = ruleTargetedDefense(token.actor, actor, item) ?? resolvedDefenseType;

        // The attacker's DefenseSwap rules (Fast Draw's switch: Evasion becomes Toughness - rules/plugins/combat/defense-swap.mjs).
        resolvedDefenseType = ruleDefenseSwap(actor, token.actor, defenseRoll, resolvedDefenseType);

        // Superstructure (Across the Stars p.87): every Attack on it goes against Toughness.
        if (token.actor?.system?.traits?.superstructure) {
          resolvedDefenseType = 'toughness';
        }

        // Armor Piercing (the weapon trait): "Attacks ignore deflective bonuses to Toughness" - the same
        // reduction Penetrating Rounds already makes. AttackTraits rules grant it too (Ram Cone's Alt Mode rams).
        // (Weak Point's and Penetrating Rounds' are AttackTraits rules too.)
        const traitArmorPiercing = !!traitWeapon?.system?.traits?.includes('armorPiercing') || ruleAttackHasTrait(actor, item, 'armorPiercing');
        const deflectiveReduction = traitArmorPiercing && resolvedDefenseType == 'toughness'
          ? this._getDeflectiveArmorToughness(token.actor)
          : 0;
        // Void (Across the Stars p.79): "always ignores any armor bonuses to Toughness" - unless the target has an incoming
        // immune: ["voidArmorIgnore"] rule (Voidshield - rules/plugins/combat/defense-swap.mjs).
        const voidIgnoresArmor = resolvedDefenseType == 'toughness'
          && (item?.system?.damageType == 'void' || !!traitWeapon?.system?.traits?.includes('void'))
          && !ruleImmunities(actor, token.actor, defenseRoll, 'voidArmorIgnore').length;
        // Computerized battledress: its Evasion bonus doesn't count against Electromagnetic weapons.
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
          && (this._getParentWeapon(actor, item)?.system?.traits?.includes('antiTank') || ruleAttackHasTrait(actor, item, 'antiTank'))
          ? this._getPlatingArmorToughness(token.actor)
          : 0;

        // Titan-Class (The Enigma of Combination, Weapon Traits, p.49): against anything of a smaller
        // Size Class than the wielder, armor-upgrade Toughness bonuses don't count. A third sibling of Anti-Tank/Armor Piercing just
        // above - "armor upgrades" specifically (not an armor's own base bonusToughness) is a
        // narrower carve-out than either, so it reads _getArmorUpgradeToughness rather than one
        // trait-filtered helper. The Energon Point the wielder must spend first (once a round) is
        // items/attacks/titan-class.mjs's pre-roll.
        // Size CLASSES (an Extended target is the Huge class, not a step up) - mechanics/combat/size-classes.mjs.
        const attackerSizeIndex = sizeClassIndex(actor.system.size);
        const targetSizeIndex = sizeClassIndex(token.actor.system.size);
        const titanClassReduction = resolvedDefenseType == 'toughness'
          && attackerSizeIndex != -1 && targetSizeIndex != -1 && targetSizeIndex < attackerSizeIndex
          && this._getParentWeapon(actor, item)?.system?.traits?.includes('titanClass')
          ? this._getArmorUpgradeToughness(token.actor)
          : 0;

        // Defend (Across the Stars, Weapon Traits, p.79): the wielder adds the trait's number to Evasion
        // and Toughness against melee attacks. A bonus to the DEFENDER's own Defenses while
        // they wield the weapon, not the attacker's - the sign is the opposite of every reduction
        // above, so it's added to difficulty rather than subtracted from it. defendMagnitude and
        // its optional defendRangedMagnitude sibling (weapon.mjs) hold the "(listed bonus)" - most
        // Defend weapons only print (1), but at least one (Zeo Power Disc/Shield) prints a split
        // "(2; 1 vs. Ranged Attacks)" value.
        const isMeleeAttack = item?.type == 'weaponEffect' && item.system.classification.style == 'melee';
        const defendBonus = ['evasion', 'toughness'].includes(resolvedDefenseType)
          ? this._getDefendBonus(token.actor, isMeleeAttack)
          : 0;

        // The attacker's Defense ignoreArmor lookup rules (rules/plugins/combat/lookup-armor-points.mjs - Metallikato's "up to
        // your Smarts Essence in armor bonuses"): taken off at the lookup, so a later full armor ignore replaces it.
        const lookupArmorPoints = ruleLookupArmorPoints(actor, token.actor, resolvedDefenseType, {
          item, rolledSkill, rolledEssence, dataset, switches: skillRollOptions.ruleKeys ?? [],
        });

        // Screwball (Cobra Codex, Weapon Upgrade, p.97) / Arched (Cobra Codex, Weapon Upgrade,
        // p.96) - both grant the Bypassing trait: "Attacks ignore shield bonuses to Defenses."
        // Same "read off the parent weapon's own traits array" idiom as Accurate/Inaccurate.
        const hasBypassingWeapon = item?.type == 'weaponEffect'
          && !!this._getParentWeapon(actor, item)?.system.traits?.includes('bypassing');

        // Fighting Style's Careful (+2 in cover) and Defense (+1 in armor) are already in the target's
        // Defense total (documents/actor.mjs#_prepareDefenses), which getDefenseValue reads - not added again here.
        let difficulty = getDefenseValue(token.actor, resolvedDefenseType, {
          ignoreArmor: keyIgnoresArmor || voidIgnoresArmor,
          ignoreArmorPoints: lookupArmorPoints,
          ignoreShield: hasBypassingWeapon,
        })
          + ruleDefenseAura(token.actor, resolvedDefenseType)
          - deflectiveReduction
          - computerizedArmorReduction
          - antiTankReduction
          - titanClassReduction
          + defendBonus;

        // "Add +5 to a Defense before dice are rolled" (GI Joe CRB p.127) - the defender's own
        // Story Point, spent in the Defense prompt just above; or, in My Little Pony, bought
        // earlier this scene and still standing (mechanics/combat/defense-choice.mjs#hasSceneDefenseBoost).
        // One bonus either way: a boost bought this attack is also the one the scene flag holds.
        if (storyPointBoost || hasSceneDefenseBoost(token.actor, resolvedDefenseType)) {
          difficulty += DEFENSE_BOOST;
        }

        // (Ground Suppression's -5 Toughness / Evasion is an early Defense rule its groundSuppressed mark carries.)

        // Item rules' early Defense rules (rules/plugins/combat/early-defense.mjs): "use Evasion when it's better"
        // (Psychological Warfare, Scapegoat, Evasive, Tactical Gymnastics, Split-Second Reaction) and early adds, against
        // the other Defense's per-attack value (this attack's ignore-armor, plus its DefenseAura bonus - Shield Upgrade).
        const earlyDefense = await earlyDefenseAdjust(actor, token.actor, resolvedDefenseType, difficulty, {
          item, rolledSkill, rolledEssence,
          valueOf: key => getDefenseValue(token.actor, key, { ignoreArmor: keyIgnoresArmor }) + ruleDefenseAura(token.actor, key),
        });
        difficulty = earlyDefense.difficulty;
        // Scapegoat's Hang-Up - mechanics/combat/target-riders.mjs#applyRollRiders.
        const scapegoatSwapped = earlyDefense.changed.includes('scapegoat');

        // Just the Facts' Immune half is a Defense rule on the Perk (mode: fail).

        // Move Like a Song (Green Ranger, Survival Boon choice, p.44) - the "automatically
        // misses" half; the Snag half is computed in _getAutomaticCombatModifiers like any other
        // d20 modifier. combatModifiers.forcedMiss is already resolved for the roll's one primary
        // target (game.user.targets.first(), same as First Strike/Just the Facts above), so this
        // applies to whichever single target this loop is currently building - correct for Move
        // Like a Song's own single-target "attack that targets you" wording.
        if (combatModifiers.forcedMiss) {
          difficulty = Infinity;
        }

        // Whether this attack's Defense was already worked out without armor (below, or the key / Void ignore above) -
        // armor is ignored once: the outgoing ignoreArmor Defense rules (Charge It Up!) then take nothing more off.
        let armorIgnored = keyIgnoresArmor || voidIgnoresArmor;

        // Armor Piercing (Weapon Effects and Traits, p.106) - armor's deflective Toughness bonus doesn't
        // count against this weapon. A live property of the weaponEffect
        // ITSELF (item.system.hasArmorPiercing - see that field's own doc comment in
        // data/item/weapon-effect.mjs), unconditional on any Perk, same ignoreArmor recompute
        // shape as the noArmor Defense rules below (Drilling Shot, Quantum Cut) but scoped to whatever Defense this
        // attack is actually being compared against (RAW doesn't force Toughness specifically the
        // way Quantum Cut does - it just ignores the armor component if the attack happens to be
        // Toughness-compared).
        //
        // An AttackChoice pick's armorPiercing (Bring It All Down's "the device gains the Armor-Piercing trait")
        // grants the exact same effect for this one attack, so it ORs straight into the same recompute.
        if (
          resolvedDefenseType == 'toughness' && item?.type == 'weaponEffect'
          && (item.system.hasArmorPiercing || dataset.attackChoiceArmorPiercing)
        ) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true }) + ruleDefenseAura(token.actor, resolvedDefenseType);
          armorIgnored = true;
        }

        // Omega Enhancement's own Electro Mode - its Use rule's rollVsEach carries dataset.omegaEnhancementMode.
        // "A Targeting Attack that ignores armor" - keeps whatever Defense the dialog's dropdown was set to,
        // unlike Quantum Cut, which also forces Toughness.
        if (dataset.omegaEnhancementMode == 'electro') {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true }) + ruleDefenseAura(token.actor, resolvedDefenseType);
          armorIgnored = true;
        }

        // Over the Candlestick - Agile Reflexes (Technorganic Secrets, Climber/Nimble Origin
        // Benefit, p.38) - see OVER_THE_CANDLESTICK_ID's own comment above. Once a scene, Evasion in
        // place of a targeted Toughness. No live reaction prompt
        // exists for the TARGET at this point in the flow (the same reaction/interrupt gap this
        // project already tracks broadly), so "you may" is approximated as "you always do, since
        // it can only help" - the same "automatically exercised" idiom Supreme Guardian's own
        // "you may roll" clause already uses - swapping in the target's own Evasion Defense
        // whenever it's actually being compared against Toughness, once per scene.
        if (resolvedDefenseType == 'toughness'
          && hasChosen(findPerk(token.actor, OVER_THE_CANDLESTICK_ID), 'agileReflexes')
          && !hasUsedThisEncounter(token.actor, AGILE_REFLEXES_FLAG)) {
          difficulty = getDefenseValue(token.actor, 'evasion', { ignoreArmor: keyIgnoresArmor })
            + ruleDefenseAura(token.actor, 'evasion');
          await markUsedThisEncounter(token.actor, AGILE_REFLEXES_FLAG);
        }

        // Item rules' Defense mode noArmor (rules/plugins/combat/no-armor-defense.mjs - Penetrating Strikes, Drilling Shot,
        // Quantum Cut): the target's Defense worked out again without its armor.
        if (ruleNoArmor(actor, token.actor, resolvedDefenseType, { item, rolledSkill, rolledEssence, switches: skillRollOptions.ruleKeys ?? [] })) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true }) + ruleDefenseAura(token.actor, resolvedDefenseType);
          armorIgnored = true;
        }

        // A noArmor Defense rule riding a mark the target carries (scope markedTarget - Exploit Weakness: the marker and
        // their teammates ignore its armor for the scene - rules/plugins/combat/marked-no-armor.mjs).
        if (ruleMarkedNoArmor(actor, token.actor, resolvedDefenseType, { item, rolledSkill, rolledEssence, switches: skillRollOptions.ruleKeys ?? [] })) {
          difficulty = getDefenseValue(token.actor, resolvedDefenseType, { ignoreArmor: true }) + ruleDefenseAura(token.actor, resolvedDefenseType);
          armorIgnored = true;
        }

        // Emotional Mastery: Fear/Sadness (A Jump Through Time, Purple Ranger, p.37) - see
        // items/resources/emotional-mastery.mjs's own doc comment. Fear: +3 Willpower and Cleverness /
        // Sadness: +2 Toughness and +2 Evasion on the Morphin shell - both the target's own passive bonus while active, same
        // "add to the fully-computed difficulty" shape as the per-target bonuses here (can't
        // touch _prepareDefenses directly, the user's own pending migration).
        if ((resolvedDefenseType == 'willpower' || resolvedDefenseType == 'cleverness')
          && isEmotionalMasteryOptionActive(token.actor, 'fear')) {
          difficulty += 3;
        }

        if ((resolvedDefenseType == 'toughness' || resolvedDefenseType == 'evasion')
          && isEmotionalMasteryOptionActive(token.actor, 'sadness')) {
          difficulty += 2;
        }

        // Mysterious Aura - see items/defenses/mysterious-aura.mjs's own doc comment. Imposing (a
        // reciprocal enemy-side penalty) and Protective (an ally-side bonus, self included), same
        // "add to the fully-computed difficulty" shape as the checks just above.
        difficulty += getMysteriousAuraImposingPenalty(token.actor, resolvedDefenseType);
        difficulty += getMysteriousAuraProtectiveBonus(token.actor, resolvedDefenseType);

        // Item rules' banked Defense multipliers (rules/bank.mjs#bankedDefenseMultiplier - Roll With The Punches' "double
        // your Toughness, Willpower, or Evasion against one attack") - used up by this attack. Multiplies the whole combined
        // difficulty so far (base Defense + Shield Upgrade - deflective reduction), before the additions below. (Hard Target
        // and Resilience are banked Defense bonuses - bankedDefense below.)
        difficulty *= await bankedDefenseMultiplier(token.actor, resolvedDefenseType, actor);

        // (Mass Shift, Stalwart Defense, Sword And Board, Remove & Rebuild are rules/bank.mjs#bankedDefense entries now, added below.)

        // (Stand By Me's +1 to every Defense next to its holder is an aura Defense rule on the Perk - riderDefenseAdjust below.)

        // (Grid Surge's Toughness Boost is a rules/bank.mjs#bankedDefense entry now.)

        // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
        // items/senses/phantom-suite.mjs's own doc comment for why this is a live, non-consumed read
        // (unlike every other banked bonus in this loop) - it applies to every Evasion-compared
        // attack for as long as the toggle stays on, not just the next one.
        if (isPhantomSuiteActive(token.actor)
          && (resolvedDefenseType == 'evasion'
            || (resolvedDefenseType == 'toughness' && hasPhantomFocusOption(token.actor, 'phaseDefense')))) {
          // Phase Defense (Phantom Focus choice, p.62): Phantom Suite's Evasion bonus applies to
          // Toughness as well while the Suite is active - the same
          // live, non-consumed bonus as Phantom Suite's own Evasion half above, just also
          // compared against Toughness for a holder of this specific Phantom Focus choice.
          difficulty += getPhantomSuiteEvasionBonus(token.actor);
        }

        // Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32) -
        // see items/defenses/powered-plating.mjs's own doc comment. Same live, non-consumed shape as
        // Phantom Suite's own Evasion bonus above, just Toughness-only and cleared elsewhere
        // (onMorph) instead of by a hit.
        if (resolvedDefenseType == 'toughness') {
          difficulty += getPoweredPlatingBonus(token.actor);
        }

        // Summon Armor / Summon Shield (MLP CRB spells) - see items/magic/summon-armor.mjs's own doc
        // comment. Applies to both Toughness and Evasion, live and non-consumed (no natural
        // end-trigger to clear it on, unlike Phantom Suite's own Evasion bonus above).
        difficulty += getSummonArmorDefenseBonus(token.actor, resolvedDefenseType);

        // (Expanded Mysticism's Fortify +1 and Grow!'s +2 Toughness / Evasion are Defense rules on those items, added in
        // riderDefenseAdjust below - rules/conv17-split2.test.js.)

        // Lightshield Armor (Through the Shattered Grid, Guardian of Eltar, Wisdom of the Elders
        // option, p.72): "+2 to Toughness" while active - same live, non-consumed shape as
        // Powered Plating's own Toughness bonus just above (can't touch _prepareDefenses).
        if (resolvedDefenseType == 'toughness' && isWisdomOfTheEldersActive(token.actor, 'lightshieldArmor')) {
          difficulty += 2;
        }

        // (Zeo Crystal Boost's Morpher +1 to all Defenses is a Defense rule on the Power - on the sheet.)
        // Jury Rig - Align Suspension / Harden Armor (Factions in Action Vol. 2, Engineer Troop
        // Focus, 17th level, p.73) - see items/vehicles/jury-rig.mjs's own doc comment. Same live,
        // non-consumed Defense-bonus shape as Bolster Defense just above.
        difficulty += getJuryRigDefenseBonus(token.actor, resolvedDefenseType);

        // The target's allies' allyTargeted Triggers (Defender Step - rules/plugins/combat/ally-reactions.mjs): a THIRD
        // PARTY's own choice, asked here. The boost and whose it was ride on this target's entry, so _rollSkillHelper's
        // results loop (where the hit or miss is known) can fire that reactor's allyDefended Triggers (Retribution).
        const { bonus: defenderStepBonus, reactorUuid: defenderStepReactorUuid } = await allyDefenseReactions(token.actor, actor);
        difficulty += defenderStepBonus;

        // Suppressing Fire, Energic Shields, Bot-Hunter -
        // mechanics/combat/target-riders.mjs#riderDefenseAdjust.
        // Item rules' banked Defense bonuses (rules/bank.mjs#bankedDefense) - used up by this attack.
        difficulty += await bankedDefense(token.actor, resolvedDefenseType, actor);

        difficulty += riderDefenseAdjust(actor, token.actor, resolvedDefenseType, {
          item, isAttack: item?.type == 'weaponEffect', difficulty,
          ext: skillRollOptions.ext ?? {},
          // Item rules' Defense rules (rules/adapter.mjs#ruleDefenseAdjust) can ask about the rolled Skill, and the
          // ticked switches' keys (roll:switch:<key> - Double Agent).
          rolledSkill, rolledEssence, switches: skillRollOptions.ruleKeys ?? [], armorIgnored,
        });

        // (Unseen Strike's Evasion halving is a Defense mode: halve rule on the Perk.)
        // (Augmented's Hang-Up halving is a Defense mode: halve rule on the Hang-Up - rules/adapter.mjs#ruleDefenseAdjust.)

        return {
          name: token.actor.name,
          targetUuid: token.actor.uuid,
          difficulty,
          defenseType: resolvedDefenseType,
          defenderStepBonus,
          defenderStepReactorUuid,
          // Unconscious (GI Joe CRB, Conditions, p.226): "...a successful attack becomes a
          // critical hit." Asleep implies Unconscious (see impliedUnconscious's own comment in
          // _getAutomaticCombatModifiers above) so it's included here too. Read per-target here
          // (rather than in _getAutomaticCombatModifiers, which only computes a single roll-wide
          // shift) since results.map below already resolves per-target Degrees of Success.
          targetUnconscious: token.actor.statuses?.has('unconscious') || token.actor.statuses?.has('asleep') || false,
          // Scapegoat's Hang-Up - mechanics/combat/target-riders.mjs#applyRollRiders.
          ...(scapegoatSwapped ? { scapegoatSwapped } : {}),
        };
      }));
    } else if (dataset.dif) {
      checkEntries = [{ name: actor.name, targetUuid: null, difficulty: parseInt(dataset.dif) }];
    }

    // Ram (TF CRB, p.49): +1 Blunt damage per full Size Class above Large (the half-step Long /
    // Extended sizes don't count). Matched via
    // weapon-effect.mjs's own isRam flag, same as the GI Joe/PR Ram checks elsewhere in this file
    // - the generic Ram weaponEffect item itself only carries the flat base 1 Blunt, since the
    // size scaling has to be read live off the attacking Vehicle's own current Size. That
    // half-step exclusion is exactly the pattern
    // E20.actorSizes already encodes - every full Size Class sits two list entries above the
    // last one, with a half-step Class in between (Large, Long, Huge, Extended, Gigantic, ...) -
    // so the bonus is simply how many full 2-entry steps past Large the Vehicle's size index is.
    const sizeOrder = Object.keys(E20.actorSizes);
    const ramSizeDamageBonus = item?.type == 'weaponEffect' && item.system.isRam && actor?.type == 'vehicle'
      ? Math.max(0, Math.floor((sizeOrder.indexOf(actor.system.size) - sizeOrder.indexOf('large')) / 2))
      : 0;

    // Jury Rig - Jacket Ammunition (Factions in Action Vol. 2, Engineer Troop Focus, 17th level,
    // p.73) - see items/vehicles/jury-rig.mjs's own doc comment. "+1 damage on one of the vehicle's
    // Attacks" is simplified to any of the vehicle's Attacks while the benefit is active (see the
    // helper's own comment for why) - checked against `actor` (the vehicle rolling the attack),
    // not the Engineer who granted it.
    const jacketAmmunitionDamageBonus = item?.type == 'weaponEffect'
      && isJuryRigBenefitActive(actor, 'jacketAmmunition')
      ? 1 : 0;

    // (Zeo Crystal Boost's Zord +2 and team Megazord +1 are scaled DamageModifiers on the Power - scopes driven /
    // drivenMegaform.)

    // Every Perk/Role Points item actually contributing to damageBonusValue below, so the check
    // card can tell the player what's granting the bonus damage they're about to apply - same
    // reasoning as the reroll button's own source label (chat.mjs#addRerollButtons). A Set, not
    // an array, since Warfighter and a damageBonus Role Points item are independent grants that
    // could otherwise land the same name twice (in practice they never share one, but nothing
    // stops it structurally).
    const damageBonusSources = new Set();

    // Acid / Fire (Damage Types): +1 damage on a hit against Toughness (Acid) or Evasion (Fire) -
    // a core rule of each damage type itself, not
    // gated behind any Perk. Checked against skillRollOptions.defenseType (the Defense actually
    // being rolled against - the weaponEffect's own configured default, or a manual override from
    // the Roll Options Dialog), not item.system.defenseType, since RAW cares about which Defense
    // the target actually defended with on THIS attack.
    //
    // Elemental Adaptation (Beneath the Helmet, Aqua Ranger, p.42) - see
    // items/defenses/aqua-elemental-adaptation.mjs's own doc comment for why Acid/Fire are the only two
    // core damage-type rules this Perk has anything concrete to suppress. Resolved fresh via
    // game.user.targets.first() (the same "no single higher-scoped target variable, just resolve
    // it where needed" idiom this function already uses throughout) rather than threading a new
    // parameter through.
    const elementalAdaptationTarget = checkEntries && item?.type == 'weaponEffect'
      ? game.user.targets.first()?.actor : null;

    // Corrosive Tip / Blazing / Ignition Tank (PR CRB Weapon Upgrades, p.116/118): the weapon picks
    // up the Acid/Fire trait. Like Tasing/Voltage Tank's identical Electric grant just above
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

    // Emotional Mastery: Anger (A Jump Through Time, Purple Ranger, p.37) - +1 on Unarmed and
    // One-Handed weapon Attacks while active. Unarmed is the shared definition
    // (_isUnarmedWeaponEffect); One-Handed read directly off the
    // weaponEffect's own numHands field (the same field Weapon Conversion's own one-time edit
    // targets).
    const angerDamageBonus = checkEntries && item?.type == 'weaponEffect'
      && (this._isUnarmedWeaponEffect(actor, item) || item.system.numHands == 1)
      && isEmotionalMasteryOptionActive(actor, 'anger')
      ? 1 : 0;
    if (angerDamageBonus) {
      damageBonusSources.add(findPerk(actor, EMOTIONAL_MASTERY_ID)?.name ?? 'Anger (Emotional Mastery)');
    }

    // Item rules' DamageFloor (Titan Body - rules/plugins/combat/damage-floor.mjs): a floor, not an additive bonus -
    // folded directly into the base damageValue below (not damageBonusValue), so it isn't a listed damage source.
    const ruleDamageFloorValue = checkEntries && item?.type == 'weaponEffect' ? ruleDamageFloor(actor, { item, rolledSkill, rolledEssence, dataset }) : 0;

    const upshiftTradeDamage = upshiftTrade.damage;
    for (const source of upshiftTrade.sources) {
      damageBonusSources.add(source);
    }

    const appliesRolePointsDamage = !!(checkEntries && damageRolePoints && skillRollOptions.applyRolePointsDamage);
    if (appliesRolePointsDamage) {
      damageBonusSources.add(damageRolePoints.name);
    }

    // (Hard Hitter's Edge with the box ticked is a late RollModifier on its Role Points item - roll:rolePointsDamage:own.)

    // An AttackChoice pick's + damage (Bring It All Down's "+2 damage" option).
    const bringItAllDownDamageBonus = Number(dataset.attackChoiceDamage) || 0;


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
    }) : { amount: 0, sources: [], spend: async () => {} };
    await scaledRules.spend();
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
      + upshiftTradeDamage
      + acidDamageBonus + fireDamageBonus
      + angerDamageBonus
      + ramSizeDamageBonus
      + (appliesRolePointsDamage ? damageRolePoints.value : 0);
    if (ramSizeDamageBonus) {
      damageBonusSources.add('Ram (Size Class)');
    }

    // damageRolePoints?. below - damageBonusValue can now be truthy from Warfighter's flat bonus
    // alone, with no damageRolePoints claim active at all (unlike before Warfighter existed, when
    // a truthy damageBonusValue always implied a truthy damageRolePoints).
    if (damageBonusValue && damageRolePoints?.isSneakAttack) {
      await markSneakAttackUsed(actor);

      // Sudden Strike (a SneakAttackGrant rule - mechanics/combat/sneak-attack.mjs#paySneakAttackGrant). Spends the
      // Story Point and marks the once-per-combat use HERE, at the point Sneak Attack Damage is
      // actually applied - checkSneakAttackEligibility() only decided the checkbox could be
      // offered, it didn't spend anything. Only when Sudden Strike was actually needed to qualify
      // (viaSuddenStrike, set with the eligibility check above) - an attack that met Sneak
      // Attack's ordinary conditions anyway costs nothing.
      if (damageRolePoints.viaSuddenStrike) {
        await paySneakAttackGrant(actor);
      }

      // A ticked rule switch's sneakAttackMultiplier (Quiet as the Grave - rules/plugins/rolls/role-points-damage.mjs).
      if (Number(skillRollOptions.ruleSneakAttackMultiplier) > 1) {
        damageBonusValue *= Number(skillRollOptions.ruleSneakAttackMultiplier);
        damageBonusSources.add(skillRollOptions.ruleSneakAttackSource);
      }

      // The roll's own fact for its hit Triggers: roll:dataset:sneakAttackDamage (Debilitating Strike).
      dataset.sneakAttackDamage = true;
    } else if (damageBonusValue && damageRolePoints?.isPredatorSneakAttack) {
      await markUsedThisRound(actor, PREDATOR_SNEAK_ATTACK_ROUND_FLAG);
    }

    // Damage-type override toggles (Across the Stars' Blazing Strikes/Void Warrior, A Jump Through
    // Time's Cryogenic Touch) - the first Perk/Power-driven overrides of a weaponEffect's own fixed
    // damageType field anywhere in this project (see POINTY_ID's own doc comment on why Pointy
    // itself never attempted this). Void Warrior applies to any Attack, armed or not; Blazing
    // Strikes/Cryogenic Touch are unarmed-only. Checked in this priority order only because an
    // actor realistically never holds more than one at a time - not a meaningful ranking.
    let overriddenDamageType = null;
    if (item?.type == 'weaponEffect') {
      // Item rules' DamageType (rules/adapter.mjs#ruleDamageType), by their priority: Blazing Strikes' Fire first, then
      // Cryogenic Touch's Cold and Ninja Power's chosen element.
      overriddenDamageType = ruleDamageType(actor, game.user?.targets?.first?.()?.actor ?? null, {
        item, rolledSkill, rolledEssence, edge: !!skillRollOptions.edge, snag: !!skillRollOptions.snag,
        switches: skillRollOptions.ruleKeys ?? [], dataset,
      });
    }

    // A fact about the WEAPON (does it carry the real 'multipleTargets' trait at all), not gated
    // on how many targets this particular roll happens to have.
    const isMultipleTargetsWeaponAttack = isMultipleTargetsWeapon(actor, item);

    // A ticked rule switch's syntheticDamage (rules/plugins/dialog/switch-synthetic-damage.mjs - Psychoanalyst, Coax
    // Surrender, Grinder, Deceptive Warfare): a Skill Test that isn't an attack still feeds the ordinary
    // damageValue/damageType -> Apply Damage button pipeline, x Degrees of Success.
    const ruleSyntheticDamage = skillRollOptions.ruleSyntheticDamage ?? null;

    // A rules step's own damage (rules/steps.mjs rollVsEach `damage` - Explosive Morph, Menace, Human Bullet; a BeforeRoll
    // rule's setDataset - Terrifying Presence's damage riders): the card's Apply Damage buttons, x Degrees of Success, the
    // same synthetic-damage shape as Psychoanalyst just above.
    const stepDamage = dataset.stepDamage && typeof dataset.stepDamage == 'object' && Number.isFinite(Number(dataset.stepDamage.value))
      ? { value: Number(dataset.stepDamage.value), type: dataset.stepDamage.type ?? 'blunt' } : null;

    // Energy Beam / Lancing Beam (MLP CRB, Elementary Beam spells, p.136): a Spellcasting attack in
    // range; a hit deals 1 Energy damage. Unlike
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

    // (Beam Volley's 2 Energy damage is the spell's own authored damage.)

    // Fireball (Knights of Canterlot, Superior Beam spell, p.46) - a Spellcasting attack in range;
    // a hit deals 2 Fire damage. Same synthetic-
    // damage shape as the other Beam spells, but its own printed damage type (Fire, not
    // Energy/Element).
    const kocFireballDamage = spellSourceId == KOC_FIREBALL_ID ? { value: 2, type: 'fire' } : null;

    const checkContext = checkEntries
      ? {
        entries: checkEntries,
        // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
        // items/senses/phantom-suite.mjs's own doc comment for why _rollSkillHelper's post-hit
        // processing needs to know which Defense this attack was actually compared against
        // (rather than re-deriving it from the item), the same "a fact about the roll, threaded
        // through checkContext" shape effectName/alternateEffects below already use. Reads the
        // first target's own resolvedDefenseType (see mechanics/combat/defense-choice.mjs) - the actual
        // Defense that target's own owner/GM chose, not just the weapon's suggested default;
        // this is a single roll-level fact, so a multi-target attack whose targets happened to
        // choose different Defenses is represented by whichever target is first, the same
        // "one combined fact per roll" simplification every other entry in this object accepts.
        defenseType: checkEntries[0]?.defenseType ?? skillRollOptions.defenseType,
        // Whether the roll had Edge - the hit / afterRoll Triggers' roll:edge (Terror's accrual).
        wasEdge: skillRollOptions.edge,
        damageValue: item?.type == 'weaponEffect'
          ? (ruleForgoDamage
            ? 0
            : (ruleDamageFloorValue ? Math.max(item.system.damageValue, ruleDamageFloorValue) : item.system.damageValue)
              // A ticked DialogSwitch baseDamageMultiply (Surging doubles the element damage).
              * (skillRollOptions.ruleBaseDamageMultiplier ?? 1)
              + damageBonusValue)
          : (authoredSpellDamage?.value ?? ruleSyntheticDamage?.value ?? stepDamage?.value ?? beamSpellDamage?.value ?? kocFireballDamage?.value ?? null),
        // Read by _rollSkillHelper to build each result's own damageBonusLabel - kept as the raw
        // bonus amount and its source names rather than a pre-built label here, since the actual
        // per-target amount still needs scaling by that target's own Degrees of Success
        // multiplier (see _rollSkillHelper's damageValue: ... * multiplier just below it).
        damageBonusValue: item?.type == 'weaponEffect' ? damageBonusValue : 0,
        damageBonusSources: [...damageBonusSources],
        damageType: item?.type == 'weaponEffect'
          ? (overriddenDamageType ?? item.system.damageType)
          : (authoredSpellDamage?.type ?? ruleSyntheticDamage?.type ?? stepDamage?.type ?? beamSpellDamage?.type ?? kocFireballDamage?.type ?? null),
        // The weaponEffect's own second damage component (weapon-effect.mjs's secondaryDamage),
        // dropped along with the main damage whenever a Perk forgoes it.
        secondaryDamage: getSecondaryDamage(item, ruleForgoDamage),
        // The assister's own uuid, from where the Lend Assistance shift was consumed above (Betrayal, Misled's rollSeen).
        lendAssistanceAssisterUuid,
        mindBeamEffect,
        spellSourceId,
        // Psycho Slinger - see PER_TWO_HITS_EFFECT_IDS' own comment above.
        perTwoHitsEffectId: item?.type == 'weaponEffect' && isPerTwoHitsEffect(item) ? item.id : null,
        // "Critical Effect: Triples base damage instead of double" (Energy Sword Time Strike,
        // mechanics/companions/summons.mjs) - see _applyCritMultiplier below.
        critMultiplier: item?.type == 'weaponEffect' ? (item.flags?.essence20?.critMultiplier ?? null) : null,
        // Attacking Space Vessel Systems - carried through to the Critical Effect picker.
        targetVesselSystemAttempt: isTargetVesselSystemAttempt,
        // Repairing a Space Vessel Condition (mechanics/vehicles/vessel-conditions.mjs#openVesselRepairDialog).
        repairVesselUuid: dataset.repairVesselUuid ?? null,
        repairVesselCondition: dataset.repairVesselCondition ?? null,
        // Sudden Death (Blitzer Focus, 20th level, p.98) - a Might melee hit on a target whose Threat
        // Level is no higher than the attacker's level may Defeat it outright instead of dealing
        // damage. Only the weapon-type
        // half of that check (a fact about the attack, not about any specific target) belongs
        // here - the Perk check, once-per-combat gate, and per-target Threat Level compare all
        // happen at apply-damage time instead (chat.mjs#onApplyDamage), once the actual target
        // is known, same division of labor as every other chat.mjs-side Perk check.
        isMightMelee: item?.type == 'weaponEffect'
          && item.system.classification.skill == 'might' && item.system.classification.style == 'melee',
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
        // A plain "was this attack" flag, read in _rollSkillHelper's post-hit processing below (and by the post-roll slices).
        isAttack: item?.type == 'weaponEffect',
        // Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58) - see
        // items/attacks/frenzied-attack.mjs's own doc comment and chat.mjs#addFrenziedAttackButton. The
        // button has to roll this SAME weaponEffect Item again, so its identity is stamped here
        // the same way isAttack itself is, rather than trying to re-derive it later from the
        // message content.
        itemUuid: item?.uuid ?? null,
        // Patch Up (Transformers CRB, Focus: Medic, 1st level, p.82) - its Use rule's roll carries isPatchUp /
        // patchUpAmount in its dataset (packs/tfcrbitems/_source/Patch_Up_Jlfb8iPvT7JFvcxv.json). Same synthetic-dataset-flag/
        // player-chosen-amount shape as Regeneration above, via the shared items/healing/heal-skill-test.mjs primitive.
        isPatchUpAttempt: !!dataset.isPatchUp,
        patchUpAmount: dataset.patchUpAmount,
        // (Preventative Measures, Tough It Out and Stand Together are their Perks' own Use rules - roll steps whose
        // onSuccess heals; rules/conv15-items2.test.js.)
        // (Tech Specs and Ground Suppression are their Perks' own Use rules - rollVsEach.)
        // (Supreme Guardian's Blind on Morphing is its Perk's own Use rule - rollVsEach, Blinded on a hit.)
        // The weapon's traits, for the on-hit trait riders (_applyTraitRiders).
        weaponTraits: item?.type == 'weaponEffect' ? [...(this._getParentWeapon(actor, item)?.system?.traits ?? [])] : [],
        // Whether the weapon carries its own Blinding alternate effect (damageType 'blindingBlast') -
        // Strobe grants Blinding "as an alternate effect", so the trait then blinds only through it.
        weaponHasBlindingEffect: item?.type == 'weaponEffect' && hasBlindingAlternate(actor, this._getParentWeapon(actor, item)),
        attackStyle: item?.type == 'weaponEffect' ? item.system.classification?.style ?? null : null,
        // What mechanics/combat/target-riders.mjs#applyRollRiders needs once the dice land.
        riderContext: buildRiderContext(actor, item, dataset, skillRollOptions, combatModifiers.riderConsumes),
        // The Defense the attack itself names - Unstoppable Force.
        suggestedDefenseType: item?.system?.defenseType ?? null,
        // A ticked DialogSwitch backfireOn: a d20 showing that number deals the roll's damage to the roller (Surging's 1).
        ruleBackfireOn: skillRollOptions.ruleBackfireOn ?? [],
        // A melee attack, any Skill (unlike isMightMelee above) - item rules' Multiplier `attack:melee`.
        isMelee: item?.type == 'weaponEffect' && item.system.classification.style == 'melee',
        // A ticked noCrit rule switch (Jack Of All Trades). Read in _rollSkillHelper's own isCrit computation.
        suppressCrit: !!skillRollOptions.suppressCrit,
        // Critical Success (p.205): the attacker adds an extra attack effect, or may apply one of the
        // attack's listed alternate effects instead (Table 8-3.1's "Alternate Effects" column). A weapon's
        // Alternate Effects are separate weaponEffect Items sharing this one's parentId flag
        // (see attachment-handler.mjs#createItemCopies, which tags every weaponEffect copied
        // from the same weapon with that weapon's _id).
        effectName: item?.type == 'weaponEffect' ? item.name : null,
        alternateEffects: item?.type == 'weaponEffect' ? this._getAlternateEffects(actor, item) : [],
        // Temperamental (Quartermaster's Guide to Gear p.35; weapon AND weapon-upgrade trait) -
        // see its own check in _rollSkillHelper below for the rule. Resolved here (where
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
        // The already-resolved skill die size for this roll (FumbleRange rules - roll:finalDie:). A Fanning
        // volley's later shots each carry their own.
        finalShift: shotFinalShift,
        snag: skillRollOptions.snag,
        isPowerWeaponAttack: item?.type == 'weaponEffect'
          && !!this._getParentWeapon(actor, item)?.system.itemAndUpgradeTraits?.includes('powerWeapon'),
        // Focused Strike (A Jump Through Time, Quantum Ranger, 9th level, p.46) - see
        // mechanics/rolls/reroll.mjs's own REROLL_CONDITIONS.unarmedAttack doc comment. Unarmed is the
        // shared definition (items/shared/unarmed-attacks.mjs#isUnarmedAttack).
        isUnarmedAttack: this._isUnarmedWeaponEffect(actor, item),
        // Metallikato (Decepticon Directive p.66) - mechanics/rolls/reroll.mjs's REROLL_CONDITIONS.botModeMelee.
        isMeleeAttack: item?.type == 'weaponEffect' && item.system.classification?.style == 'melee',
        // Homing Shots (Decepticon Directive, Cannonade Focus, 10th level, p.46) - see
        // mechanics/rolls/reroll.mjs's own REROLL_CONDITIONS.consumableOrWreckerRangedAttack doc comment.
        isConsumableOrWreckerRangedAttack: !!(item?.type == 'weaponEffect'
          && item.system.classification?.style != 'melee'
          && (this._getParentWeapon(actor, item)?.system.traits?.includes('consumable')
            || this._getParentWeapon(actor, item)?.system.traits?.includes('wrecker'))),
        // MLP CRB "Consummate Performer" (Laugh Tactic, p.86) stamps this via a synthetic
        // {skill: 'performance', dif: <escalating DIF>, consummatePerformer: true} dataset (see
        // items/resources/consummate-performer.mjs#activateConsummatePerformer, same minimal-dataset
        // shape as the @Check[...] enricher's own onCheckLinkClick) so chat.mjs's
        // addConsummatePerformerButton can recognize this specific roll and offer to regain 1
        // Cheer once rollFailed (set below in _rollSkillHelper) comes back false.
        consummatePerformer: !!dataset.consummatePerformer,
        // Exterminator - see EXTERMINATOR_ID's own comment above. Already computed by
        // _getAutomaticCombatModifiers (where the target/actor Size comparison actually lives),
        // just threaded through here so mechanics/rolls/reroll.mjs's own REROLL_CONDITIONS.smallerTarget
        // can read it back off the posted message's flags, the same "computed once, read from
        // context" shape notSnagged/isPowerWeaponAttack/rollFailed already establish.
        smallerTarget: !!combatModifiers.exterminatorEligible,
        // All Too Predictable - mechanics/rolls/reroll.mjs's REROLL_CONDITIONS.vsPrimaryQuarry.
        ...(isVsPrimaryQuarry(actor, game.user.targets.first()?.actor) ? { vsPrimaryQuarry: true } : {}),
        // Spite (Beneath the Helmet, Dark Ranger, 2nd level, p.39) - see items/attacks/spite.mjs's own
        // doc comment and chat.mjs#addSpiteButton for why this needs to be recognized from the
        // posted message itself (a reactive, post-miss trigger, not a pre-roll checkbox). Only
        // meaningful for a single-target Attack - the same "first entry" simplification other
        // single-target-assuming mechanics in this project already use.
        isAttack: item?.type == 'weaponEffect',
        // Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58) - see
        // items/attacks/frenzied-attack.mjs's own doc comment and chat.mjs#addFrenziedAttackButton. The
        // button has to roll this SAME weaponEffect Item again, so its identity is stamped here
        // the same way isAttack itself is, rather than trying to re-derive it later from the
        // message content.
        itemUuid: item?.uuid ?? null,
        // A melee Attack (card:flag:isMelee - Exploit Weakness's CardOffer).
        isMelee: item?.type == 'weaponEffect' && item.system.classification.style == 'melee',
        targetUuid: checkContext?.entries?.[0]?.targetUuid ?? null,
        // The Defense it was against - with isAttack above, CardResistance rules read them off the posted message at Apply
        // Damage (card:flagEquals - Tough Enough's "a non-attack effect against Toughness").
        defenseType: checkContext?.defenseType ?? null,
        // High-Density - see items/attacks/high-density.mjs's own doc comment and
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
            rollContext, rerollSkillDice,
          ));
        }
      } else {
        rollOutcomes.push(
          await this._rollSkillHelper(
            shotFormula, actor, repeatText + label, canCritD2, checkContext, rollContext, rerollSkillDice,
          ),
        );
      }

      // Fanning: a Fumble on any of its Attack Skill Tests ends the Fanning Attack early.
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
      // (Fanning leaves the weapon with the Reload trait).
      fanned: fanningShots > 0,
      // Empty the Mag's switch (key emptyTheMag) was ticked and something was hit - afterwards the weapon must be
      // reloaded (documents/item.mjs#roll). Its doubling is a stage "late" HitMultiplier rule on the Perk.
      emptiedMag: (skillRollOptions.ruleKeys ?? []).includes('emptyTheMag') && outcomes.some(outcome => outcome.results.some(result => result.success)),
    };
  }

  /**
   * Checks whether the actor has a Perk granted from the given compendium source - a flat
   * "do they have it at all" check, for Perks with no further per-instance choice to match against. Checks
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
   * @returns {Object}   { shiftUp, shiftDown, edge, snag,
   *   tooCloseForMinimumRange, pendingBonusesToClear, bonusDie, spottedTarget,
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
    let tooCloseForMinimumRange = false;
    let forcedMiss = false;
    let snagOrMissSpend = null;
    let disgustTriggered = false;
    let exterminatorEligible = false;
    const pendingBonusesToClear = [];

    // Every automatic shiftUp/shiftDown/edge/snag contributor below is ALSO recorded here as its
    // own labeled entry, alongside (never instead of) the shiftUp/shiftDown/edge/snag totals this
    // function has always computed - addSource() never changes what those totals end up being,
    // it just parallels each mutation with a record of where it came from. Surfaced in the Roll
    // Options Dialog (see mechanics/rolls/roll-dialog.mjs's own combatModifierSources handling) so a
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
    // Viewscreens, Stealthy... (mechanics/vehicles/vehicle-upgrades.mjs). A source's `consume` flag is spent here.
    for (const source of crewSources(actor, rolledSkill, item)) {
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

    // Ramshackle (Intercontinental Adventures p.62): a driver not Qualified for Ramshackle vehicles
    // has a Snag on Driving unless a DIF 5 Streetwise test passes first. Qualification isn't tracked, so it's offered - set the radio back
    // to Normal when qualified or after the Streetwise test.
    if (rolledSkill == 'driving' && getCrewedVehicle(actor)?.vehicle?.system?.traits?.ramshackle) {
      snag = true;
      addSource('ramshackle', this._localize('E20.VehicleTraitRamshackle'), { snag: true });
    }

    // Boarder's Edge and My Little Pony's Light / Heavy Armor downshifts are RollModifier rules on those items.
    // Battledress without the Silent trait (weapon-traits.mjs).
    if (rolledSkill == 'infiltration') {
      const noisy = noisyArmorPenalty(actor);
      if (noisy) {
        shiftDown += noisy;
        addSource('noisyArmor', this._localize('E20.ArmorNotSilent'), { shiftDown: noisy });
      }
    }

    // (Ram Cone's Bot Mode unarmed Blunt ↑1 is a RollModifier rule on the gear.)

    // Bracing (GI Joe CRB p.194): ↑1 on a ranged attack at multiple targets. Braced by the Brace action, a bipod, or being Prone.
    if (item?.type == 'weaponEffect' && item.system.classification?.style != 'melee'
      && isMultipleTargetsWeapon(actor, item) && isBraced(actor)) {
      shiftUp += 1;
      addSource('braced', this._localize('E20.ActionBrace'), { shiftUp: 1 });
    }

    if (selfStatuses.has('impaired')) {
      shiftDown += 1;
      addSource('impaired', this._localize('E20.StatusImpaired'), { shiftDown: 1 });
    }

    // Frightened (Conditions, e.g. GI Joe CRB p.226): ↓2 while the source of the fear is in sight. Whether the fear is in sight can't be checked, so this applies to every roll
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
    // separate rule, already built via dice.mjs's own rollSkill calculatedShiftDown check): attacks
    // with it take a Snag until the wielder scores a Critical Success with it. A per-weapon-per-wielder flag on the WEAPON Item itself, same idiom as
    // mechanics/combat/reload-trait.mjs's own needsReload flag - set once isCrit is known, in _rollSkillHelper's
    // own post-roll processing (see its own comment there), and read back here, before the roll.
    const xenotechWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    if (xenotechWeapon?.system.traits?.includes('xenotech') && !xenotechWeapon.getFlag?.('essence20', 'xenotechCritted')) {
      snag = true;
      addSource('xenotech', this._localize('E20.WeaponTraitXenotech'), { snag: true });
    }

    // Xenotech Components - see its own check in _rollSkillHelper's post-roll processing for the
    // rule. ↓1 until the weapon's own componentsSucceeded flag is set, then ↑1 forever after.
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
    // mechanics/world/environment.mjs's own doc comment) - Across the Stars' "Exploring Infinite
    // Environments" (p.24-25) and the GI Joe CRB's own Underwater Combat rules (p.212).
    const environment = getEnvironment(actor);
    const environmentWeapon = item?.type == 'weaponEffect' ? this._getParentWeapon(actor, item) : null;
    const isRangedWeaponEffect = item?.type == 'weaponEffect' && item.system.classification?.style != 'melee';

    // Inertial (Across the Stars, Weapon Traits, p.79): self-propelled or guided projectiles that
    // take none of the low-gravity, zero-gravity or vacuum attack penalties. Checked
    // first so the three penalty blocks just below can simply skip themselves for an Inertial
    // weapon, rather than duplicating this same guard three times.
    const isInertialWeapon = !!environmentWeapon?.system.traits?.includes('inertial');

    if (isRangedWeaponEffect && !isInertialWeapon) {
      // Low Gravity (ATS p.24): a Snag on ranged Ballistic attacks.
      if (environment == 'lowGravity' && environmentWeapon?.system.traits?.includes('ballistic')) {
        snag = true;
        addSource('lowGravity', this._localize('E20.SceneEnvironmentLowGravity'), { snag: true });
      }

      // Zero-G (ATS p.25): a Snag on ranged attacks that aren't normally Energy or Laser damage.
      // This project's damageType schema has no 'energy' value of its own (only the separate
      // 'energy' WEAPON TRAIT and the 'laser' damageType), so "normally Energy damage" reads as
      // the weapon carrying the Energy trait.
      if (environment == 'zeroGravity'
        && !environmentWeapon?.system.traits?.includes('energy') && item.system.damageType != 'laser') {
        snag = true;
        addSource('zeroGravity', this._localize('E20.SceneEnvironmentZeroGravity'), { snag: true });
      }

      // Vacuum or Void (ATS p.24-25): ranged attacks get double Range but a Snag. Only the Snag half is built - this project has no per-roll
      // Range-value display to double.
      if (environment == 'vacuum') {
        snag = true;
        addSource('vacuum', this._localize('E20.SceneEnvironmentVacuum'), { snag: true });
      }
    }

    if (environment == 'underwater' && item?.type == 'weaponEffect') {
      // Underwater Combat (GI Joe CRB p.212): melee attacks by someone with no Aquatic Movement, and
      // all ranged attacks, take a Snag unless the weapon is Amphibious or Aquatic. The ↓3 for
      // ranged attacks past the weapon's normal reach isn't built - this system has no
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

      // Fire attacks on anything fully under water take ↓2. Approximated as "the attacker is underwater," this
      // project having no separate wet/immersed flag on a target.
      if (item.system.damageType == 'fire') {
        shiftDown += 2;
        addSource('underwaterFire', this._localize('E20.SceneEnvironmentUnderwater'), { shiftDown: 2 });
      }
    }

    // Aquatic (GI Joe CRB, Weapon Traits, p.147): no penalty underwater, ↓3 on land. Amphibious (no
    // penalty either way) overrides this
    // when a weapon somehow carries both.
    if (environment != 'underwater' && item?.type == 'weaponEffect'
      && environmentWeapon?.system.traits?.includes('aquatic')
      && !environmentWeapon?.system.traits?.includes('amphibious')) {
      shiftDown += 3;
      addSource('aquaticOnLand', this._localize('E20.WeaponTraitAquatic'), { shiftDown: 3 });
    }

    // Gravity (ATS p.24-25): Athletics and Brawn take ↓2 in High Gravity, ↑1 in Low Gravity and ↑2
    // in Zero-G. High Gravity's halved and Vacuum's doubled Range values
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

    // Extreme Temperature / Thick or Thin Atmosphere (ATS p.23-24): Impaired while unprotected - see mechanics/world/environment-hazards.mjs. Impaired's own ↓1, as its
    // own labelled source so a player who spent the Free action to steady their breathing can untick
    // it; skipped when the Impaired status is already counted above.
    if (!selfStatuses.has('impaired') && isImpairedByEnvironment(actor, environment)) {
      shiftDown += 1;
      addSource('environmentImpaired', `${this._localize(E20.sceneEnvironments[environment])} (${this._localize('E20.StatusImpaired')})`,
        { shiftDown: 1 });
    }

    // Unstable (Across the Stars, Space Vessel Condition, p.26): ↓1 on every hardpoint weapon, ↓2 at
    // the second stack. A Vehicle's
    // weapons are its hardpoint weapons, rolled as the Vehicle itself. The third stack's refusal is
    // in rollSkill.
    const unstablePenalty = item?.type == 'weaponEffect' && actor.type == 'vehicle' ? getUnstablePenalty(actor) : 0;
    if (unstablePenalty) {
      shiftDown += unstablePenalty;
      addSource('vesselUnstable', this._localize('E20.StatusUnstable'), { shiftDown: unstablePenalty });
    }

    // No Fighting?!'s Snag is an item rule on the Hang-Up now; _rollSkillHelper still clears the flag.
    // (Bad Temper's / Something To Prove's next-round ↓1 after a Fumble are their Hang-Ups' own rules.)

    // Don't-Notice-Me-Field (MLP CRB, Superior Enchantment spell, p.137) - self half: see
    // items/magic/dont-notice-me-field.mjs's own doc comment. Edge on Infiltration to stay unseen
    // while the field is active - unconditional on a target being set
    // (unlike the reciprocal Alertness Snag half below, which needs a target to check).
    if (rolledSkill == 'infiltration' && isDontNoticeMeFieldActive(actor)) {
      edge = true;
      addSource('dontNoticeMeFieldSelf', "Don't-Notice-Me-Field", { edge: true });
    }

    // Plan of Action (Officer base, 1st level, p.85) and the other ally banks: banked via the sheet's own new "Use" control
    // (mechanics/resources/banked-buffs.mjs) and consumed here, on whichever actor is rolling - applies to
    // ANY roll, same reasoning as Debilitating Strike/Who Dares Wins above. Plan of Action banks
    // its bonus directly on the ALLY the Officer chose, not the Officer themselves, so this is
    // still just an ordinary self-flag check either way - no cross-actor lookup needed here. This
    // function is synchronous and can't clear the flag itself, so it just reports which keys to clear and
    // rollSkill() does it.

    // (Rush the Line's Edge on the next melee attack is a rule bank - its Use, rules/conv17-split3.test.js.)


    // (Time To Think's Edge on the next roll is a rule bank - its combatStart Trigger, rules/conv15-items2.test.js.)

    // (One-Upping's ↑1 on the Skill an ally failed is a rule bank - its CardOffer, rules/conv15-items2.test.js.)

    // Emotional Mastery: Shame - see EMOTIONAL_MASTERY_SHAME_FLAG's own comment above. Same
    // banked-shiftUp consumption shape as Plan of Action just below.
    const pendingEmotionalMasteryShame = getPendingBonus(actor, EMOTIONAL_MASTERY_SHAME_FLAG);
    if (pendingEmotionalMasteryShame) {
      shiftUp += pendingEmotionalMasteryShame.shiftUp;
      pendingBonusesToClear.push(EMOTIONAL_MASTERY_SHAME_FLAG);
      addSource('emotionalMasteryShame', 'Shame (Emotional Mastery)', { shiftUp: pendingEmotionalMasteryShame.shiftUp });
    }

    // (Plan of Action, Inspiring Words' ↑2 and Forward Observation bank their ↑ through the rules bank - Use rules on
    // their items, rules/conv15-banked.test.js.)

    // Impulsive - see IMPULSIVE_HANGUP_ID's own comment in prepareInitiativeRoll() above. Unscoped
    // (any Skill Test, RAW's own "first Skill Test after you roll Initiative"), unlike Inner
    // Magic/Terrifying's skill-specific consumption just above/below.
    const pendingImpulsive = getPendingBonus(actor, 'pendingImpulsive');
    if (pendingImpulsive) {
      shiftDown += pendingImpulsive.shiftDown;
      pendingBonusesToClear.push('pendingImpulsive');
      addSource('impulsive', 'Impulsive', { shiftDown: pendingImpulsive.shiftDown });
    }

    // (Enchant's ↑1 is a rules bank now - the spell's afterRoll Trigger.)

    // (Psychological Sway's ↓1 on the swayed foe's next Skill Test is a rules bank - its Use rule.)


    // A bonus die added straight to the Roll formula - see rollSkill()'s own use of this returned bonusDie, right after
    // _getFormula(). Banked dice (rules/plugins/rolls/bonus-dice-bank.mjs - Inspiration's, More Heads') arrive in the
    // More Heads slot below.
    let bonusDie = null;

    // More Heads are Better than One (Dragon Origin, p.30): once a session, up to two extra heads
    // each add a d2 Skill Die to one Skill Test. Two is granted as the max (2d2) - no stated reason
    // to use fewer. Same
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

    /* Aim (GI Joe CRB p.193): a ranged-only Free action giving ↑1 on the next ranged attack, as
       long as the attacker doesn't move in between.

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

    // Shining Leader, Rallying Cry and Nano-Med Mastery's two-round Edge are marks their Use rules set, each read by a
    // marked-scope RollModifier on the item.

    if (isAttack && selfStatuses.has('blinded')) {
      snag = true;
      addSource('selfBlinded', this._localize('E20.StatusBlinded'), { snag: true });
    }

    // Invisible (GI Joe CRB, Conditions, p.226) - a CORE RULE, not a Perk: an Invisible character's
    // attacks have Edge, and attacks against them have a Snag.
    //
    // The second half has been implemented for some time (see targetStatuses.has('invisible')
    // further below); this first half never was, so the Condition was only doing half its job.
    // Found 2026-09-15 by reading the Conditions appendix straight through and checking each
    // printed effect against the code, rather than by following up any one Perk - THREE separate
    // places apply this status (Emotional Mastery, items/senses/invisibility.mjs, and a banked-buffs
    // dispatch) and none of their holders were getting the attacker-side benefit RAW promises.
    //
    // Attack-gated exactly as RAW words it (attack tests only), so being unseen grants no Edge on an
    // ordinary Skill Test - and sat here beside the self-Blinded Snag rather than with the other
    // self-status checks further up, because those run before isAttack is declared.
    if (isAttack && selfStatuses.has('invisible')) {
      edge = true;
      addSource('selfInvisible', this._localize('E20.StatusInvisible'), { edge: true });
    }

    // Covering Fire (Transformers CRB, Gunner base, 2nd level, p.68) - see
    // items/attacks/covering-fire.mjs's own doc comment. Unlike every other unscoped Snag bank in this
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
    let spottedTarget = null;
    // The per-target riders, Fanatic and the result - run at the end, or straight away for a plain
    // Skill Test against someone (see the `if (!isAttack)` below).
    const finish = () => {
      // Per-target modifiers, stances, marks and nearby devices - mechanics/combat/target-riders.mjs.
      const riders = rollRiderSources(actor, target, {
        item, rolledSkill, rolledEssence, isAttack, isMelee, isShove: !!rollDataset?.isShove, pendingShiftDown: shiftDown - shiftUp,
        dataset: rollDataset,
      });
      for (const source of riders.sources) {
        shiftUp += source.shiftUp;
        shiftDown += source.shiftDown;
        edge ||= source.edge;
        snag ||= source.snag;
        addSource(source.id, source.label, source);
      }

      // The target's SnagOrMiss rules (Move Like a Song - rules/plugins/combat/snag-or-miss.mjs): a Snag - or, if the roll
      // already has one, a miss outright. Checked here, after the rider and item-rule sources above, so it sees every
      // Snag this roll has.
      const snagOrMiss = target ? ruleSnagOrMiss(actor, target, { item, rolledSkill, rolledEssence, dataset: rollDataset }) : null;
      if (snagOrMiss) {
        if (snag) {
          forcedMiss = true;
        } else {
          snag = true;
          addSource('snagOrMiss', snagOrMiss.label, { snag: true });
        }

        snagOrMissSpend = snagOrMiss.spend;
      }

      // ShiftCap rules (Fanatic's "never worse than ↓2" - rules/plugins/rolls/shift-cap.mjs) - checked last, against everything above.
      const fanatic = ruleShiftCap(actor, shiftUp, shiftDown);
      if (fanatic) {
        shiftUp += fanatic.shiftUp;
        addSource(fanatic.id, fanatic.label, fanatic);
      }

      return {
        ...(riders.consumes.length ? { riderConsumes: riders.consumes } : {}),
        shiftUp, shiftDown, edge, snag, tooCloseForMinimumRange,
        pendingBonusesToClear, bonusDie, forcedMiss, snagOrMissSpend, spottedTarget,
        sources,
        exterminatorEligible,
        disgustTriggered,
      };
    };

    if (target) {
      /* The Defend action (GI Joe CRB p.196): "all attacks against you from adversaries and
         effects you can see suffer a Snag on their Attack Skill Test."

         Read off the target rather than banked on the attacker, because the defender does not
         know who will attack them - that is the whole shape of the action. The Condition is
         applied by mechanics/actions/named-actions.mjs and cleared at the start of the defender's next
         turn by documents/combat.mjs#_onStartTurn.

         Gated on isAttack: RAW says "attacks against you", not any Skill Test, so a Persuasion
         test aimed at someone who is Defending is unaffected.

         The "you can see" qualifier is deliberately NOT enforced - this system has no model of
         which adversaries an actor is aware of, and deriving one from token vision would be
         wrong about darkness, cover and every Perk that grants awareness. The Snag annotates
         the Roll Options Dialog with its own name, so a GM ruling the defender never saw this
         one coming just puts the radio back to Normal. */
      // Vehicle Upgrades and traits against the attacker - Shielded (mechanics/vehicles/vehicle-upgrades.mjs); a Tinted
      // Canopy over an occupant is a crewIncoming rule. Ablative Armor, JAFF, Tricked-Out Hydraulics, Spiked and Energized
      // Plating are incoming item rules now.
      if (isAttack) {
        const defenderMods = defenderSources(actor, item, target, {
          weaponTraits: this._getParentWeapon(actor, item)?.system?.traits ?? [],
        });
        for (const source of defenderMods) {
          shiftDown += source.shiftDown ?? 0;
          snag ||= !!source.snag;
          sources.push({ id: `vehicle-${source.id}`, label: source.label, shiftUp: 0, shiftDown: source.shiftDown ?? 0, edge: false, snag: !!source.snag });
        }

        spendDefenderSources(target, defenderMods);
      }

      if (isAttack && target.statuses?.has(DEFENDING_STATUS) && !ignoresDefend(this._getParentWeapon(actor, item))) {
        snag = true;
        addSource('defending', this._localize('E20.StatusDefending'), { snag: true });
      }

      // Energy (PR CRB): ↑1 for Energy weapons against any grown Threat.
      if (item?.type == 'weaponEffect' && this._getParentWeapon(actor, item)?.system?.traits?.includes('energy')
        && isGrownThreat(target)) {
        shiftUp += 1;
        addSource('energyVsGrown', this._localize('E20.WeaponTraitEnergy'), { shiftUp: 1 });
      }

      // Retrogen - see items/attacks/retrogen.mjs's own doc comment. Automatic only when the target
      // plainly has Genetic Alterations; otherwise rollSkill offers retrogenAvailable's toggle.
      if (isAttack && isRetrogenWeapon(this._getParentWeapon(actor, item)) && hasGeneticAlterations(target)) {
        shiftUp += 1;
        addSource('retrogen', this._localize('E20.WeaponTraitRetrogen'), { shiftUp: 1 });
      }

      // First Strike's Edge against an opponent who hasn't acted yet is an item rule (target:notActed).

      /* Lend Assistance, attack half (GI Joe CRB p.197): the first attack on the named target
         before the assister's next turn has Edge.

         Banked on the ALLY (this roller) scoped to the target the assister named, the same
         shape as Menacing Glare's own Edge just below. "First attack" is what the clear
         implements: it is consumed here whether it hits or misses, which is what "first"
         means.

         Gated on isAttack - the grant is about hitting an enemy in combat, and the
         action's other half already covers helping with a plain Skill Test.

         The until-the-assister's-next-turn limit is not separately enforced, matching
         every other banked bonus here (see perks.mjs#bankPendingBonus). */
      const pendingLendAssistanceEdge = isAttack
        ? getPendingBonus(actor, LEND_ASSISTANCE_EDGE_FLAG) : null;
      if (pendingLendAssistanceEdge && pendingLendAssistanceEdge.targetId == target.id) {
        edge = true;
        pendingBonusesToClear.push(LEND_ASSISTANCE_EDGE_FLAG);
        addSource('lendAssistance', this._localize('E20.ActionLendAssistance'), { edge: true });
      }

      // Face Me!'s ↓2 against anyone but the holder is a marked-scope RollModifier rule on the item.

      // (Get To Know's Edge against its researched target is a rules bank now - the spell's afterRoll Trigger.)

      // Don't-Notice-Me-Field - reciprocal half: see items/magic/dont-notice-me-field.mjs's own doc
      // comment. Anyone trying to spot them has a Snag on Awareness - "Awareness" read as this system's own Alertness Skill, same mirror-image
      // reciprocal shape as Skepticism/See Something Say Nothing below.
      if (rolledSkill == 'alertness' && isDontNoticeMeFieldActive(target)) {
        snag = true;
        addSource('dontNoticeMeFieldReciprocal', "Don't-Notice-Me-Field", { snag: true });
      }

      // Glittermane (Knights of Canterlot, Superior Utility spell, p.46) - see
      // items/magic/glittermane.mjs's own doc comment. ↓1 on any spell, ranged or melee attack aimed
      // at the holder - reciprocal (the target's state counts), but gated on
      // isAttack (RAW names Attacks specifically, not any Skill Test).
      if (isAttack && isGlittermaneActive(target)) {
        shiftDown += 1;
        addSource('glittermane', 'Glittermane', { shiftDown: 1 });
      }

      // Just the Facts (the Snag against a higher-level deceiver, and the Immune half) is item rules on
      // the Perk (self:levelDiff).

      // Emotional Mastery: Disgust (A Jump Through Time, Purple Ranger, p.37) - ↓1 on the first Skill
      // Test each turn that targets the holder. RAW says "Skill Test," not "Attack," so - like
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

      // Hierarchy Rank and Grid Soldier (level comparisons with the target) are item rules (target:levelDiff).

      // Big And Scary, Bend A Knee Or Stand Tall, Big Preds Are My Specialty and The Bigger The
      // Heart (size-difference upshifts against the target) are item rules on each Perk.

      // (Dogfighter's Edge against an aerial vehicle is a RollModifier rule on the Perk.)

      // Mark Target (Scout, 2nd level, p.84): a designated creature gives +1 on Skill Tests about it
      // for the rest of the scene. Marked via items/rolls/mark-target.mjs
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
      // items/rolls/primary-quarry.mjs's own doc comment. Same "any roll against the designated
      // creature" approximation as Mark Target just above, and explicitly RAW-stacks with it (a
      // separate flag/addSource entry, both can fire on the same roll).
      if (checkPrimaryQuarry(actor, target)) {
        shiftUp += 1;
        addSource('primaryQuarry', 'Primary Quarry', { shiftUp: 1 });
      }

      // (Nemesis (Specific Threat)'s ↑2 against the declared Nemesis is a RollModifier rule on the Perk.)

      // A plain Skill Test against someone skips the attack-only checks below, but not the per-target
      // riders and Fanatic at the end (item rules, incoming rules and banked bonuses ride on those).
      if (!isAttack) {
        return finish();
      }

      // Mysterious Aura - Resplendent (A Jump Through Time, White Spectrum Modification,
      // replaces Follow Me!, p.45) - see items/defenses/mysterious-aura.mjs's own doc comment. Same
      // ranged-only reciprocal downshift shape as Distraction just above.
      if (!isMelee && hasNearbyResplendentAura(target)) {
        shiftDown += 1;
        addSource('mysteriousAuraResplendent', 'Mysterious Aura (Resplendent)', { shiftDown: 1 });
      }

      // The roll as item rules read it in the attack checks below (rules/plugins/rolls/immunity-kinds.mjs,
      // combat/size-matrix-steps.mjs).
      const attackRoll = { item, rolledSkill, rolledEssence, isAttack, isMelee, dataset: rollDataset };

      // Item rules' SizeMatrix (When Push Comes To Shove): the attacker counts as bigger for the size shift only.
      let attackerSizeForSizeShift = actor.system.size;
      const sizeMatrixSteps = ruleSizeMatrixSteps(actor, target, attackRoll);
      if (sizeMatrixSteps) {
        const sizeLadder = Object.keys(E20.actorSizes);
        const currentIndex = sizeLadder.indexOf(actor.system.size);
        if (currentIndex != -1) {
          attackerSizeForSizeShift = sizeLadder[Math.min(sizeLadder.length - 1, Math.max(0, currentIndex + sizeMatrixSteps))];
        }
      }

      const sizeShift = this._getSizeShift(attackerSizeForSizeShift, target.system.size);
      shiftUp += sizeShift;
      if (sizeShift) {
        addSource('size', this._localize('E20.CombatModifierSize'), { shiftUp: sizeShift });
      }

      // Grappling's own Size downshift (GI Joe CRB, Chapter 9: Combat, p.200): a ↓1 for each Size class larger
      // the target is, up to two - additive with the generic sizeShift above (a different table entirely). An
      // immune: ["grappleSizeDownshift"] rule lifts it (Jacket Wrestler).
      if (item?.type == 'weaponEffect' && item.system.damageType == 'grapple'
        && !ruleImmunities(actor, target, attackRoll, 'grappleSizeDownshift').length) {
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

      // (Tech Specs' ↑1 and Technical Mastery's Edge are markedTarget RollModifiers its techSpecs mark carries.)

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
      // Each of these conditions is its own labeled source (rather than one combined "Target Condition"
      // bundle) so a player sees exactly which Condition is granting the Edge.
      const targetGrantsEdge = targetStatuses.has('blinded')
        || targetStatuses.has('grappled')
        || targetStatuses.has('restrained')
        || targetStatuses.has('stunned')
        || impliedUnconscious
        || targetStatuses.has('actingSmaller')
        || (isMelee && impliedProne);

      if (targetGrantsEdge) {
        edge = true;
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

      // Spot - see isSpotAttempt's own comment in rollSkill() above for the wider context. RAW
      // gives the first attack on the spotted target Edge - approximated as the very
      // next attack against them from ANYONE (not tracked against the spotting character's own
      // next turn specifically), consumed once. This function is synchronous and can't clear the
      // target's flag itself - reports the target actor back (same "report, rollSkill() clears"
      // shape), just keyed on a different actor
      // (the target, not the roller) since that's whose flag needs clearing here.
      if (target.getFlag?.('essence20', 'spotted')) {
        edge = true;
        spottedTarget = target;
        addSource('spot', this._localize(E20.damageTypes.spot), { edge: true });
      }

      // (Eye for Appraisal's ↑1 is its Perk's own RollModifier, using up one of its counted appraisal mark.)

      if (targetStatuses.has('immobilized')) {
        shiftUp += 1;
        addSource('targetImmobilized', this._localize('E20.StatusImmobilized'), { shiftUp: 1 });
      }

      if (targetStatuses.has('invisible')) {
        snag = true;
        addSource('targetInvisible', this._localize('E20.StatusInvisible'), { snag: true });
      }

      if (!isMelee && impliedProne) {
        snag = true;
        addSource('targetProneRanged', this._localize('E20.StatusProne'), { snag: true });
      }

      // Cover (p.202): ↓2 on ranged attacks against someone in cover. Ranged only - melee attacks
      // reach past cover entirely. Total Cover is described as normally un-targetable outright
      // (though some special attacks get round it) - not enforced as a hard
      // block here (nothing else in this method blocks a roll, and the book itself treats it as
      // overridable), so it just gets the same -2 automatically instead of a bigger number of its
      // own; only the best cover counts per the book anyway, so the two never stack.
      //
      // Penetrating Rounds, Kentucky Windage, Contingency Shot, What Cover?, Lay of the Land,
      // Nowhere's Safe x2, Maximize Cover, Hard Target (TF), Dig In (Cannoneer), Now You Don't and Take Point (in
      // Rough Terrain) are item Cover rules (coverRules below).
      // Bulwark (a planted holder within 5 ft gives the target Cover) and Two Steps to the Right
      // (allies within 60 ft share Lay of the Land's -1) are aura Cover rules.
      // Indirect - see _isIndirectAttack's own doc comment. Unlike the Perk-based bypasses (Cover
      // rules), this one does NOT beat total cover: RAW exempts a target with total cover
      // overhead, and totalCover is exactly that case.
      const indirectIgnoresCover = this._isIndirectAttack(actor, item)
        && !targetStatuses.has('totalCover');
      // Item rules' Cover (rules/adapter.mjs#ruleCover): ignore / reduce on the attacker's side,
      // counts-as-Cover / base / add on the target's.
      const coverRules = ruleCover(isMelee ? null : actor, isMelee ? null : target, { item, rolledSkill, rolledEssence, isAttack, isMelee, dataset: rollDataset });
      if (!isMelee && (targetStatuses.has('cover') || targetStatuses.has('totalCover') || coverRules.grant)
        && !indirectIgnoresCover && !coverRules.ignore) {
        // Only the biggest reduction counts (they don't stack), never below ↓0; the rules' `add`
        // (Dig In while dug in) comes on top.
        const coverShiftDown = Math.max(0, Math.max(2, coverRules.base) - coverRules.reduce) + coverRules.add;

        shiftDown += coverShiftDown;
        addSource('cover', this._localize('E20.StatusCover'), { shiftDown: coverShiftDown });

        // Cover giveBack rules (Thermal Scope / Smart Scope - rules/plugins/combat/cover-give-back.mjs): smoke and a wall
        // are both Cover here, so the scope hands the penalty back as its own source - untick it when the Cover is solid.
        if (coverShiftDown && coverRules.giveBack) {
          shiftUp += coverShiftDown;
          addSource('scopeThroughSmoke', this._localize('E20.UpgradeScopeSmoke'), { shiftUp: coverShiftDown });
        }
      }

      // Dig In, Mega Training Regimen, Steady Footing and Unmovable (Grapple, Shove and Trip attempts
      // against the holder) are incoming item rules on each Perk.

      // Trip (GI Joe CRB, Weapon Effects and Traits, p.148; the WTNV Citizen's Guide, p.59,
      // spells out the actual comparison, sharing this same paragraph with the unbuilt Shove
      // trait there): each side uses the better of Brawn and Finesse; an attacker who comes up short
      // takes ↓ equal to the gap in Ranks. A Trip effect is represented by damageType 'knocProne' (see
      // rules/plugins/tags/violent-tags.mjs#NON_DAMAGE_EFFECT_TYPES for how that value was identified from real
      // compendium data), not the generic 'maneuver' value the checks just above key on. Ranks are
      // compared as E20.skillShiftList positions, the same shift-position-delta idiom every other
      // skill-substitution/comparison check in this function already uses.
      if (item.system.damageType == 'knocProne') {
        // E20.skillShiftList is ordered best-to-worst, so a HIGHER index is a WORSE (lower) Rank -
        // the attacker coming up short is attackerIndex > targetIndex, same direction every
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
      // Range (system.range.min); the book forbids attacking from closer than that - unlike
      // everything else in this method, that's a real hard block, not a shift/Edge/Snag
      // suggestion, so it's reported back as tooCloseForMinimumRange for rollSkill() to refuse
      // the roll outright (before the Roll Options Dialog even opens - see there for why).
      //
      // Ranged Attacks in Close Combat (p.201): a ranged attack made inside an enemy's reach takes ↓1
      // - the TARGET's own natural Reach
      // (E20.actorReach, their Size Class's own unarmed melee range), not the attacker's; a
      // Ranged attack made from within arm's reach of its target is what's being penalized here,
      // regardless of how far the attacker itself could otherwise reach.
      const attackerToken = actor.getActiveTokens?.()?.[0];
      if (!isMelee && attackerToken) {
        const distance = this._getDistanceFeet(attackerToken, targetToken);
        // The roll as item rules read it here (rules/plugins/rolls/immunity-kinds.mjs, tags/range-facts.mjs).
        const rangeRoll = { item, rolledSkill, rolledEssence, isAttack, isMelee, dataset: rollDataset };
        // Item rules' WeaponRange (Trajectory's +30 ft) widen the printed range values before the compares below.
        const rangeBonusFeet = ruleWeaponRange(actor, rangeRoll, target);
        const normalRange = item.system.range?.value ? item.system.range.value + rangeBonusFeet : item.system.range?.value;
        const longRange = item.system.range?.long ? item.system.range.long + rangeBonusFeet : item.system.range?.long;
        const minRange = item.system.range?.min;
        // Jury Rig - Clean Barrels (Factions in Action Vol. 2, Engineer Troop Focus, 17th level,
        // p.73) - see items/vehicles/jury-rig.mjs's own doc comment. No long-range Snag on the vehicle's
        // Attacks, checked against the VEHICLE actually rolling the attack.
        // Long Shot, Sharpshooter's Grace (all three printings), Ballistic Advantage (with a sniper
        // weapon) and Fighting Style's Long Shot are item rules: immune: ["longRangeSnag"].
        const alreadyIgnoresLongRangeSnag = ruleNoLongRangeSnag(actor, targetToken?.actor ?? null, { item })
          || isJuryRigBenefitActive(actor, 'cleanBarrels');
        // An immune: ["longRangeSnagForEdge"] rule (Nowhere to Run): no long-range Snag, and Edge when something else
        // already ignores it.
        const snagForEdge = ruleImmunities(actor, target, rangeRoll, 'longRangeSnagForEdge')[0] ?? null;
        if (normalRange && distance > normalRange && (!longRange || distance <= longRange)
          && !alreadyIgnoresLongRangeSnag && !snagForEdge) {
          snag = true;
          addSource('longRange', this._localize('E20.CombatModifierLongRange'), { snag: true });
        } else if (normalRange && distance > normalRange && (!longRange || distance <= longRange)
          && alreadyIgnoresLongRangeSnag && snagForEdge) {
          edge = true;
          addSource('nowhereToRun', snagForEdge.item?.name ?? 'Nowhere to Run', { edge: true });
        }

        // Sharpshooter's Grace's ↑2 - within 30 feet (PR CRB), or farther (Transformers / GI Joe CRB) - is
        // each printing's own RollModifier rule (target:within:30).

        if (minRange && distance < minRange) {
          tooCloseForMinimumRange = true;
        }

        // What item rules read of this attack's distance (rules/plugins/tags/range-facts.mjs: roll:rangeBand:normal /
        // long - Ballistics Precision -, roll:longRangeSnagIgnored, roll:elevationAbove: - Vantage Point, As Above,
        // So Below).
        rollDataset.rangeFacts = {
          distance, normalRange, longRange, longRangeSnagIgnored: !!alreadyIgnoresLongRangeSnag,
          elevation: (attackerToken.document?.elevation ?? 0) - (targetToken.document?.elevation ?? 0),
        };

        // Item rules' DataBridgeBonus (rules/plugins/combat/data-bridge-bonus.mjs - Tactical Triangulation): a Data
        // Bridged roller (a live bank under key dataBridge - Data Bridge's Use rule), the rule held by the roller or any
        // ally on the canvas.
        const dataBridgeBonus = hasBankKey(actor, 'dataBridge')
          ? dataBridgeBonusOf(actor) ?? getNearbyAllyTokens(actor, Infinity).map(token => dataBridgeBonusOf(token.actor)).find(Boolean) ?? null
          : null;
        if (dataBridgeBonus) {
          const dataBridgeShiftUp = Math.min(dataBridgeBonus.max, bankKeySideCount(actor, 'dataBridge'));
          if (dataBridgeShiftUp > 0) {
            shiftUp += dataBridgeShiftUp;
            addSource('tacticalTriangulation', dataBridgeBonus.label || 'Tactical Triangulation', { shiftUp: dataBridgeShiftUp });
          }
        }

        const enemyReach = E20.actorReach[target.system.size];
        // Injection (Ferocious Fighters: Factions in Action Vol. 1, New Weapon Traits, p.93): no ↓1
        // for use inside an enemy's reach. Read off the attack's own weapon.
        const isInjectionWeapon = !!this._getParentWeapon(actor, item)?.system.traits?.includes('injection');
        // An immune: ["reachDownshift"] rule (Menace with a shotgun / SMG, CQB Training, Fighting Style's Close Quarters
        // Battle) lifts it too.
        if (enemyReach && distance <= enemyReach && !isInjectionWeapon
          && !ruleImmunities(actor, target, rangeRoll, 'reachDownshift').length) {
          shiftDown += 1;
          addSource('reach', this._localize('E20.CombatModifierReach'), { shiftDown: 1 });
        }
      }

      // Lance of Light (A Jump Through Time, General Perk, p.55) - see its own comment above.
      // "Resistance to Energy damage" while active - checked alongside the target's own static
      // system.resistances field just below rather than writing to it directly, since this one
      // needs to turn back off the moment the toggle does (Hardened Armor/Tough Enough's own
      // permanent resistance grants are a one-way ratchet by design, this isn't).
      const hasLanceOfLightResistance = ENERGY_DAMAGE_TYPES.has(item.system.damageType)
        && isLanceOfLightActive(target);

      // Resistance to this attack's damage type always imposes a Snag on the roll to apply it
      // (p.170) - unlike Immunity, it does not reduce the damage itself once the attack lands.
      // Emotional Mastery: Contempt (A Jump Through Time, Purple Ranger, p.37) - Resistance to one
      // chosen damage type while active. Same live-check-parallel-to-the-
      // static-field shape as Lance of Light just above.
      const hasContemptResistanceToThis = hasContemptResistance(target, item.system.damageType);

      // AttackResistance rules (Dispersion; Numbness's Stone Warlord type and Righteous Heart's banked type - its mark goes
      // the moment it is read, so this is asked even when another Resistance already counts - rules/plugins/combat/
      // attack-resistance.mjs): for this Snag only.
      const ruleResists = ruleResistsAttack(target, item.system.damageType, actor);

      // Whether the target resists this attack (any of the above) - item rules read it as roll:dataset:targetResists
      // (Maximize Flaws' Edge when there's nothing to ignore); an immune: ["resistanceSnag"] rule lifts the Snag.
      const targetResists = !!(target.system.resistances?.[item.system.damageType] || hasLanceOfLightResistance
        || hasContemptResistanceToThis || ruleResists);
      rollDataset.targetResists = targetResists;
      if (targetResists && !ruleImmunities(actor, target, attackRoll, 'resistanceSnag').length) {
        snag = true;
        addSource('resistance', this._localize('E20.CombatModifierResistance'), { snag: true });
      }

      // Electromagnetic vs. Computerized (GI Joe CRB, Damage Types, p.207 + Computerized Vehicle
      // Trait, p.173): Electromagnetic attacks get ↑3 against computers, Computerized vehicles and
      // robots, and ↓3 against everything else. The Transformers printing adds
      // Cybertronians. A target counts when it has the Computerized Vehicle Trait, holds the Robot
      // Perk (drones and robotic pets), or reads as robotic through its creature tags (a Cybertronian,
      // a Zord, a drone companion, or an NPC tagged "robot"/"android"/...). Ignoring Computerized
      // Evasion bonuses is the Defense-lookup side (computerizedArmorEvasion, above).
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

      // Fragile (GI Joe CRB, Vehicle Trait, p.301): ↑1 for anyone ramming a Fragile vehicle. Matched
      // via weapon-effect.mjs's own isRam flag - the same this-is-the-vehicle's-own-Ram signal
      // _isSideswipeAttack already uses, since Blunt+Drive-By alone doesn't uniquely identify a Ram.
      // The Fragile vehicle's own inability to ram (a restriction on its actions, not the attacker) is
      // left GM-enforced, matching this codebase's usual treatment of build/action restrictions. The
      // explode-on-Defeat half lives in mechanics/vehicles/vehicle-defeat.mjs instead.
      if (item.system.isRam && target.system.traits?.fragile) {
        shiftUp += 1;
        addSource('rammingFragileVehicle', this._localize('E20.VehicleTraitFragile'), { shiftUp: 1 });
      }

      // (Gallantry's Snag on a Trigger Happy attack is an incoming RollModifier rule on the Perk.)

      // Impenetrable Shield's Resistance-as-Snag (every damage type but EMP, while the Personal
      // Shield is up) is an incoming item rule on the Perk; its EMP immunity half lives in
      // mechanics/combat/combat.mjs#applyDamage.

      // (Shield Modulation's Snag is an incoming / incomingAura RollModifier on the Perk.)

      // Enemy Number One's Snag is an enemy-aura RollModifier rule on the Perk.

      // Oorah!'s +1 damage against a Surprised target and Goin' Heels' Initiative ↑1 / +1 damage are
      // item rules (a scaled DamageModifier, and a RollModifier with combat:aheadOfTarget).

      // Seconds Between Click & Boom's Snag on attacks against the holder's Evasion is an incoming
      // item rule on the Perk.

      // enemyDownshift Role Points (e.g. "Interfering Static"/Static Modifier, Power Rangers'
      // Finster's Monster-Matic Cookbook p.289: a penalty on Power Weapon or Zord attacks against
      // the holder) - unlike attackUpshift/damageBonus above, this is the TARGET's own
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

      // (Ninja Powered: Balance of Justice is a beforeRoll mark + a markedTarget RollModifier on the Zord Feature.)
    }

    return finish();
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
   * Whether a weaponEffect is an unarmed attack - the shared definition (items/shared/unarmed-attacks.mjs#isUnarmedAttack:
   * no parent weapon, or a printed unarmed "weapon" - G.I. JOE/Transformers/Power Rangers Unarmed Combat, Night
   * Vale's Unarmed Strike).
   * @param {Actor} actor
   * @param {Item} item
   * @returns {Boolean}
   * @private
   */
  _isUnarmedWeaponEffect(actor, item) {
    return isUnarmedAttack(item, actor);
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
   * Penetrating Rounds (Door-Kicker Focus, 20th level, p.100): shotgun and SMG attacks built for
   * hard targets - both of its clauses (ignoring cover,
   * ignoring deflective armor bonuses, both below) share this same gate, so it's factored out
   * once rather than duplicating the Perk/weapon check twice.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The weaponEffect being rolled, if any.
   * @returns {Boolean}
   * @private
   */
  /**
   * Indirect (Weapon Effects and Traits, p.147) - a CORE WEAPON TRAIT, not a Perk: no line of sight
   * needed to Acquire, and cover is ignored unless the target has total cover overhead.
   *
   * Built 2026-09-15, second find from the weapon-trait audit (34 of 66 traits are read by no
   * code at all). Seven weapons in the packs carry it - mortars and the like - and it did nothing.
   *
   * Only the cover half is modelled. The line-of-sight clause has nothing to attach to: this
   * system never requires line of sight to target in the first place, so that clause is already
   * true by omission rather than unimplemented. RAW's own exception maps cleanly onto the two
   * distinct statuses this system already has - ordinary Cover is ignored, totalCover is not -
   * which is a closer fit than usual for a geometric qualifier (overhead), since total
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
   * Immunity to Critical hits, per target: a hit row whose target is immune (CritImmune rules - Immovable Object on the
   * target, Protector's Shield's aura from its Bodyguard - rules/plugins/combat/crit-immune.mjs) loses its Critical
   * options. Each row's own targetUuid is resolved and checked individually. Mutates results in place; doesn't touch
   * damageValue/multiplier - Degrees of Success (p.169) and the Critical Success feature (p.205) are two independent
   * systems in this codebase, and only the latter is what "critical hits" means here.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @param {?Actor} actor   The attacker.
   * @private
   */
  async _applyCritImmunity(results, actor = null) {
    for (const result of results) {
      if (result.criticalOptions.length && result.targetUuid) {
        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && ruleCritImmune(targetActor, actor)) {
          result.criticalOptions = [];
        }
      }
    }
  }

  /**
   * Trip (GI Joe CRB, Weapon Effects and Traits, p.148): a hit knocks the target Prone. The Brawn/Finesse-Rank comparison that can shift the attack itself down is
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
    // Grapple (Quartermaster's Guide p.33): a hit leaves the target Grappled. A Grapple effect does
    // the same.
    if (traits.includes('grapple') || checkContext.damageType == 'grapple') {
      for (const target of hits) {
        await target.toggleStatusEffect('grappled', { active: true });
      }
    }

    // Blinding (Quartermaster's Guide p.33): a hit target is Blinded until the end of its next turn.
    // Strobe (p.34) gives a weapon Blinding as an alternate effect -
    // so when the weapon has that alternate (a 'blindingBlast' effect, handled by
    // _applyBlindingBlast), its other effects don't blind. Only a weapon without one falls back to
    // blinding on every hit.
    if (traits.includes('blinding') && checkContext.damageType != 'blindingBlast' && !checkContext.weaponHasBlindingEffect) {
      // Until the end of the target's own next turn (book check 2026-10-06, follow-ups 2); out of combat, or not in
      // the turn order, 1 round.
      for (const target of hits) {
        await applyTimedCondition(target, 'blinded', 1, turnBoundTiming('endOfNextTurn', target));
      }
    }

    // Maneuver (GI Joe CRB p.148): the weapon can grapple, shove or trip. Asked once the attack has hit.
    if (checkContext.damageType == 'maneuver') {
      // Snatch (Ferocious Fighters, General Perk, p.37): disarm joins the Maneuver options; a
      // disarmed weapon lands somewhere random within the target's reach.
      const snatch = ruleManeuverOption(actor, 'disarm');
      const canDisarm = !!snatch;
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

      // A shove pushes the target straight back by the shover's natural Reach
      // (GI Joe CRB p.118) - mechanics/combat/forced-movement.mjs.
      if (choice == 'shove') {
        for (const target of hits) {
          await pushActor(target, actor, 5);
        }
      }

      if (choice == 'disarm') {
        for (const target of hits) {
          await disarm(actor, target, { maxHands: 2, source: snatch?.name ?? '' });
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
   * Blinding (Quartermaster's Guide to Gear p.33): a hit target is Blinded until the end of its
   * next turn. Represented by damageType 'blindingBlast' - the same "measured
   * from real compendium data" idiom rules/plugins/tags/violent-tags.mjs#NON_DAMAGE_EFFECT_TYPES uses for Trip's
   * 'knocProne' - applying the existing 'blinded' status via mechanics/combat/timed-status.mjs's own
   * applyTimedCondition, ending as the target's own next turn ends (book check 2026-10-06, follow-ups 2:
   * the Blinding effect, Irritant Disperser, Molecular Reducer / Strobe; Finster's Flames of Hate, Pollen
   * Cloud and Stinger Spray say the same). A weapon with the Condition trait - the Crowd Dispersal
   * Energy Cannon's "Blinded 1" (Intercontinental Adventures p.92) - blinds for 1 round instead. Out
   * of combat, or a target not in the turn order: 1 round.
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows.
   * @param {Object} checkContext   Its own damageType field, set by rollSkill() above.
   * @private
   */
  async _applyBlindingBlast(results, checkContext) {
    if (checkContext.damageType != 'blindingBlast') {
      return;
    }

    const oneRound = (checkContext.weaponTraits ?? []).includes('condition');
    for (const result of results) {
      if (!result.success || !result.targetUuid) {
        continue;
      }

      const targetActor = await fromUuid(result.targetUuid);
      if (targetActor) {
        await applyTimedCondition(targetActor, 'blinded', 1, oneRound ? null : turnBoundTiming('endOfNextTurn', targetActor));
      }
    }
  }

  /**
   * Deafened (the Crowd Dispersal Energy Cannon's "Deafened 1" alternate effect, Intercontinental
   * Adventures p.92): damageType 'deafened' leaves a hit target Deafened for 1 round (the book's
   * "Deafened 1", read as rounds like its "Stunned 1d2 rounds" stat lines - book check 2026-10-06,
   * follow-ups 2) - applyTimedCondition(..., 1).
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
   * Mode Lock (Enigma of Combination, Weapon Traits/Conditions, p.49): a Condition aimed at
   * Combiners - the character can't convert out of their current Mode. Represented by damageType 'modelock' (same
   * "measured from real compendium data" idiom as Trip/Blinding above), applying the already-
   * registered 'modeLock' status (util/config.mjs's own E20.statusEffects entry, previously
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

  /**
   * "Critical Effect: Triples base damage instead of double" (Quantum Mega Battle Armor's Energy
   * Sword Time Strike, A Jump Through Time p.69 - mechanics/companions/summons.mjs). A Critical Success
   * (multiplier 2, this system's Degrees of Success) scales the damage by checkContext.critMultiplier
   * instead. Runs first, before the flat post-multiplier adds (the rules' CardDamage).
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
   * Measures the distance in scene units (feet, for every book this system covers) between the
   * centers of two placed Tokens - the same canvas.grid.measurePath idiom already used by
   * items/defenses/personal-shield.mjs and mechanics/combat/sneak-attack.mjs, each
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
   * @param {Boolean} [rerollSkillDice]   A rerollSkillDice switch / option key was chosen (Driving Strike's
   *   DialogSelect) - a pre-declared reroll of all skill dice, applied right after evaluation rather than left for a
   *   reactive chat-message button.
   * @private
   */
  async _rollSkillHelper(formula, actor, flavor, canCritD2, checkContext=null, rollContext={}, rerollSkillDice=false) {
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

      // Item rules' afterRoll Triggers still hear about it (rules/triggers.mjs#fireOpenRoll): no outcome, but the
      // total (@var.total) and the Skill - a jump, "any roll of Skill X". Only the rules engine: the hand-written
      // post-roll handlers all expect results to compare.
      const { fireOpenRoll } = await import("./rules/triggers.mjs");
      await fireOpenRoll(actor, roll.total, rollContext?.skill ?? null, rollContext?.itemUuid ?? null);

      // No checkContext means there was nothing to compare against a Difficulty, so there is no
      // success to report - the roll itself is still handed back for a caller that wants it.
      return { results: [], rollFailed: false, isFumble: false, roll };
    }

    await roll.evaluate();

    if (rerollSkillDice) {
      await applyReroll(roll, { mode: 'all', target: 'skillDice', values: [] });
    }

    // A banked reroll charge (the bankReroll step - rules/plugins/rolls/reroll-bank.mjs; Power Infusion) auto-applies to
    // every attack the actor makes while banked - it's only cleared below, once this attack
    // actually succeeds, so a miss (even after the reroll) leaves it banked for next time.
    // effectName is only set for a weaponEffect roll (see checkContext's own construction above)
    // - it only triggers on an attack, never a flat vs-Difficulty Skill Test.
    const bankedReroll = checkContext.effectName ? actor.getFlag('essence20', 'bankedReroll') : null;
    if (bankedReroll) {
      await applyReroll(roll, { mode: 'all', target: 'skillDice', values: bankedReroll.values });
    }

    let [isCrit, isFumble] = _isCritIsFumble(roll.dice, canCritD2);

    // Conditions applied from here on came from this roller - mechanics/combat/target-riders.mjs#noteRoller.
    noteRoller(actor);

    // A ticked noCrit rule switch (Jack Of All Trades) overrides an otherwise-genuine Critical Success.
    if (checkContext.suppressCrit) {
      isCrit = false;
    }

    // Item rules' CritDowngrade (Consistent - rules/plugins/rolls/crit-downgrade.mjs). Asked before anything is built
    // from the Critical Success, so giving it up really does take it away; its steps run once the card is done.
    let consistentDowngrade = false;
    let critDowngrade = null;
    if ((isCrit || (checkContext.entries ?? []).some(entry => entry.difficulty && computeMultiplier(roll.total, entry.difficulty) >= 2))
      && (critDowngrade = await askCritDowngrade(actor, { rolledSkill: rollContext.skill }))) {
      consistentDowngrade = true;
      isCrit = false;
    }

    // Xenotech (weapon trait) - see its own Snag check in _getAutomaticCombatModifiers's own
    // comment above. Stamped the moment a genuine Critical Success lands with the flagged weapon,
    // clearing that Snag for good on every future attack with it.
    if (isCrit && checkContext.xenotechWeaponToMark) {
      await checkContext.xenotechWeaponToMark.setFlag('essence20', 'xenotechCritted', true);
    }

    // Item rules' FumbleRange (Time Traveler's Hang-Up - rules/plugins/rolls/die-facts.mjs): a natural d20 up to N
    // also Fumbles, read against the roll's settled die.
    const fumbleUpTo = isFumble ? 1 : ruleFumbleUpTo(actor, { rolledSkill: rollContext.skill, finalShift: rollContext.finalShift });
    if (fumbleUpTo > 1) {
      const d20Pool = roll.dice.find(pool => pool.faces === 20);
      if (d20Pool?.values.some(value => value >= 1 && value <= fumbleUpTo)) {
        isFumble = true;
      }
    }

    // DialogSwitch backfireOn (Surging - a natural 1 on the d20 turns the attack's effect on the attacker).
    if (backfires(roll, checkContext.ruleBackfireOn) && checkContext.damageValue) {
      await applyDamage(actor, checkContext.damageValue, checkContext.damageType);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: this._localize('E20.SurgingBackfire', { name: actor.name, damage: checkContext.damageValue }),
      });
    }

    // Cruel Warlord's "regain 2 Personal Power on a Fumble" and Cost of Sorcery's Health loss are
    // fumbled Triggers on the items (rules/triggers.mjs).

    // Temperamental (Quartermaster's Guide to Gear p.35; a weapon AND weapon-upgrade trait):
    // a Fumbled Attack hits the attacker with the weapon's effect instead (or, if immune, some
    // other effect of the GM's choosing). Read as re-applying the weapon's own (unscaled, this attack's own
    // checkContext.damageValue/damageType) effect straight to the attacker - RAW gives no
    // indication of a second roll, just that the attacker becomes the target of what would
    // otherwise have hit. The GM's-choice fallback for an immune attacker isn't
    // built (no "pick the next applicable effect" concept exists to fall back to automatically);
    // applyDamage's own Immunity handling already zeroes an immune attacker's own self-hit, which
    // is the closest this codebase gets. See checkContext.temperamentalWeaponName's own comment
    // (rollSkill above) for why the weapon/upgrade-trait lookup itself happens there, not here.
    // IgnoreDrawback temperamentalFumble rules (Field Test Expert: once per combat) - that Temperamental Fumble is only a
    // failure (rules/plugins/rolls/ignore-drawback.mjs#useIgnoredDrawback spends the rule's limit).
    const fieldTested = isFumble && checkContext.temperamentalWeaponName ? await useIgnoredDrawback(actor, 'temperamentalFumble') : null;
    if (fieldTested?.rule?.message) {
      this._chatMessage.create({ speaker, content: this._localize(fieldTested.rule.message, { name: actor.name }) });
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

    // MarkedRowOutcome rules a mark carries onto the roller (rules/plugins/rolls/marked-row-outcome.mjs - Powerful
    // Suggestions: "excel" turns a plain success into a Critical Success, "fail" is used up by a x2 row). "Critical
    // Success" for a plain Skill Test is the Degrees-of-Success x2. Worked out per row in the results.map() below.
    const markedOutcomes = markedRowOutcomes(actor, {
      rolledSkill: rollContext.skill, isAttack: !!checkContext.isAttack, isMelee: !!checkContext.isMelee,
    });

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

      // (Bewildering / Traumatic / Maiming / Surgical's Essence / Defense damage are CriticalOption rules on the upgrades -
      // mechanics/combat/target-riders.mjs#critRiders.)
    }

    let critDowngradeTaken = false;
    // SuccessToCrit rules (No Factor - rules/plugins/rolls/success-to-crit.mjs) that turned a row; their steps run
    // once the rows are worked out.
    const successToCritApplied = [];
    // An ally's Defense boost on a row (allyTargeted - Defender Step): how the row came out, for the reactor's
    // allyDefended Triggers (Retribution) once results.map returns (it can't await).
    const allyDefenseOutcomes = [];
    // Item rules' Multiplier (rules/plugins/rolls/degree-multiplier.mjs): Precision's 10-point margin, Devastating Strike's
    // triple, Sucker Punch's promotion - worked out per row below, limits used up once afterwards.
    const ruleRider = checkContext.riderContext ?? {};
    const multiplierRules = ruleMultipliers(actor, {
      item: ruleRider.itemUuid ? globalThis.fromUuidSync?.(ruleRider.itemUuid) ?? null : null, rolledSkill: ruleRider.skill ?? rollContext.skill,
      isAttack: !!checkContext.isAttack, isMelee: !!checkContext.isMelee, switches: ruleRider.switches ?? [], dataset: ruleRider.dataset,
    });
    const results = checkContext.entries.map(entry => {
      let multiplier = computeMultiplier(roll.total, entry.difficulty);
      multiplier = multiplierRules.adjust(entry, multiplier, 'early', roll.total);

      // A marked roller's MarkedRowOutcome rules - see markedOutcomes above.
      multiplier = markedOutcomes.adjust(multiplier);

      multiplier = multiplierRules.adjust(entry, multiplier, 'promote', roll.total);

      // A taken CritDowngrade (Consistent): its steps run once the card is done (below).
      if (consistentDowngrade) {
        critDowngradeTaken = true;
      }

      // Unconscious - see entry.targetUnconscious's own comment above. "A successful attack
      // becomes a critical hit" - a plain success (multiplier 1) is bumped to this system's own
      // Critical Success threshold (multiplier 2), same as Powerful Suggestions' "Excel" case
      // just above; a roll that already crit outright is left alone.
      if (multiplier == 1 && entry.targetUnconscious) {
        multiplier = 2;
      }

      // SuccessToCrit rules (No Factor) - the same multiplier 1->2 bump as Unconscious just above, against a
      // target their `when` holds for.
      if (multiplier == 1 && successToCrit(actor, entry, checkContext, successToCritApplied)) {
        multiplier = 2;
      }

      // NaturalTwenty rules (Better than the Best - rules/plugins/rolls/natural-twenty.mjs). Before Consistent, so a
      // Critical Success the player gave up stays given up.
      multiplier = ruleNaturalTwentyMultiplier(actor, roll, multiplier, { targetUuid: entry.targetUuid, rolledSkill: rollContext.skill });

      // Consistent - "treat it as a regular success".
      if (consistentDowngrade) {
        multiplier = Math.min(multiplier, 1);
      }

      const success = multiplier > 0;

      // An ally's boost on this row - see allyDefenseOutcomes above.
      const allyDefense = allyDefenseOutcome(entry, roll.total);
      if (allyDefense) {
        allyDefenseOutcomes.push({ reactorUuid: entry.defenderStepReactorUuid, outcome: allyDefense });
      }

      // Only a resolved target actor (not a flat @Check[dif=...] entry) can take Health damage.
      const canApplyDamage = success && entry.targetUuid && checkContext.damageValue;
      return {
        name: entry.name,
        targetUuid: entry.targetUuid,
        difficulty: entry.difficulty,
        showDifficulty: true,
        success,
        multiplier,
        // The roll's total (a defender's targeted Trigger reads the margin: total - difficulty).
        total: roll.total,
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
      };
    });

    await fireAllyDefended(actor, allyDefenseOutcomes);

    await markedOutcomes.spend();
    await multiplierRules.spend();

    if (critDowngradeTaken) {
      await runCritDowngrade(actor, critDowngrade);
    }

    await runSuccessToCritSteps(actor, successToCritApplied);

    this._applyCritMultiplier(results, checkContext);
    await this._applyCritImmunity(results, actor);
    // Item rules' HitMultiplier stage "card" (Plate Piercing, Raze And Ruin) and CardDamage adds (Smash!, Flame Warlord)
    // - rules/plugins/combat/card-hit-multiplier.mjs.
    await applyCardHitMultipliers(actor, results, checkContext);
    await this._applyTripKnockdown(results, checkContext);
    await this._applyTraitRiders(actor, results, checkContext);
    // Wrecker - see mechanics/world/rough-terrain.mjs#applyWreckerRoughTerrain.
    await applyWreckerRoughTerrain(actor, results, checkContext);
    await this._applyBlindingBlast(results, checkContext);
    await this._applyDeafeningEffect(results, checkContext);
    await this._applyModeLock(results, checkContext);
    // Item rules' HitMultiplier stage "late" (Empty the Mag - rules/plugins/combat/card-hit-multiplier.mjs).
    await applyLateHitMultipliers(actor, results, checkContext);
    await this._applyPerTwoHits(actor, results, checkContext);

    // (Misled - the assister's Hang-Up - is a rollSeen Trigger on it: @var.assistedBy, a rules bank on a failure.)

    // Panacea's successful cast is an afterRoll Trigger (cureAll) on the spell.

    // Patch Up (Transformers CRB, Focus: Medic, 1st level, p.82) - its Use rule's flagged roll. Same "currently targeted
    // ally, or the caster themselves" resolution as
    // Regeneration just above.
    if (checkContext.isPatchUpAttempt && results[0]?.success) {
      const patchUpTarget = game.user.targets.first()?.actor ?? actor;
      await applyHealSkillTestResult(patchUpTarget, checkContext.patchUpAmount);
    }

    // (Enchant, Bestow Expertise, Get To Know and Help Yourself's successful casts are afterRoll Triggers on the spells now.)

    // Disguise, Hot To Trot, Greased Lightning, Sparkle Blast, Mystery Sense, Glittermane, Ookie Spookies, Foolscarrot,
    // Block Magic, Fluttery Wings, Lightning Speed, Summon Armor / Shield and Don't-Notice-Me-Field: each spell's own
    // afterRoll / hit Trigger rule (they set the same scene-window flags / marks their readers here and in actor.mjs ask).

    // Glow is an afterRoll Trigger (tokenLight) + incoming RollModifier rule on the spell.

    // Stunning Surprise, Knock Down Drag Out, Catch Off Guard and Lock Down are hit Trigger rules on their items.

    // Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see items/magic/mind-beam.mjs's own doc
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
    // mechanics/vehicles/vessel-conditions.mjs#resolveVesselRepair. A flat-DIF roll, so its one entry decides.
    if (checkContext.repairVesselUuid) {
      await resolveVesselRepair(actor, checkContext, {
        success: !!results[0]?.success, multiplier: results[0]?.multiplier ?? 0, isCrit, isFumble,
      });
    }

    // (Fearsome Presence's Frightened is its Perk's own Use rule: a rollVsEach with the first three hits within 20 ft.)

    // (Laughtracting's and Distraughter's lost actions are hit Trigger rules on those Perks - grantNextTurn block.)

    // Snarl and Might Makes Right are hit Trigger rules on their Perks.

    // (Predacon's Frightened and Everything is Inspiration's failed-test Story Point are Trigger rules on their items.)

    // (Splinter Defense's Initiative penalty on a melee hit is a targeted Trigger on the Perk.)

    // (Revengeful's "who hurt me" mark and Now I'm Angry's banked +1 damage are targeted Triggers on their Perks.)

    // Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - see
    // items/senses/phantom-suite.mjs's own doc comment. The semi-invisibility ends when an Attack
    // against Evasion deals damage - switches itself back off (no Power
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

    // (Terror's 1 Terror for a damaging hit rolled with Edge - or any, with Apex Dark Ranger - is a hit Trigger on the Perk.)

    // (Thorn Warlord's 2 Personal Power on hitting a Frightened or Impaired target is a hit Trigger on the Perk -
    // rules/conv10-slC10.test.js.)

    // Emotional Mastery: Shyness - "...until you make an Attack..." - cleared on the attempt itself (any Attack roll,
    // hit or miss). (Invisibility and Phantom end the same way, through their own afterRoll Trigger rules.)
    if (checkContext.isAttack) {
      await deactivateShynessOnAttack(actor);
    }

    // (Unlucky (For You)'s Snag on a hit target, once per target per combat, is a hit Trigger on the Perk - a rules bank.)

    // Emotional Mastery: Shame (A Jump Through Time, Purple Ranger, p.37) - an enemy's Success against
    // the holder gives ↑1 on their next Skill Test (↑2 on a Critical Success). Same
    // bank-on-the-target-after-a-successful-targeting shape as
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
    // the end of its next turn - a rule on its item.

    if (bankedReroll && results.some(entry => entry.success)) {
      await actor.unsetFlag('essence20', 'bankedReroll');
    }

    // MLP CRB "Cheer": a reroll of a FAILED Performance test. Only meaningful once there's
    // an actual Difficulty to have failed against (checkContext always has at least one entry
    // here) - "failed" means none of the compared entries succeeded, matching how a multi-target
    // attack's own Critical Success handling already treats "success" per-entry rather than as
    // one single true/false for the whole roll.
    // Suffer! (Finster's Monster-Matic Cookbook, Path of Thorns, 15th level) - see
    // items/attacks/suffer.mjs's own doc comment and chat.mjs#addSufferButton. Reactive, so this has to
    // be recognized from the posted message itself, same as rollFailed/Spite above - "successfully
    // inflicting damage" means at least one hit entry actually carries a nonzero damageValue, not
    // just a bare success (a pure-status Alternate Effect with damageValue 0 shouldn't qualify).
    // Per-target riders, spells, saves and Use-button rolls - mechanics/combat/target-riders.mjs.
    await applyRollRiders(actor, results, checkContext, { isCrit, isFumble });

    const dealtDamage = results.some(entry => entry.success && entry.damageValue > 0);

    // Xenotech Components (Across the Stars, Tools of the Trade, p.79): each Component has a Skill;
    // ↓1 on tests with it until the first success, and ↑1 from then on.
    // That success is a plain success (any hit), not a Critical Success like the separate Xenotech
    // WEAPON trait above - same per-item flag idiom, but graduating from a penalty to a bonus
    // rather than just clearing, so componentsSucceeded is read on both sides of the shift in
    // _getAutomaticCombatModifiers's own check.
    if (checkContext.componentsWeaponToMark && results.length && results.some(entry => entry.success)
      && !checkContext.componentsWeaponToMark.getFlag?.('essence20', 'componentsSucceeded')) {
      await checkContext.componentsWeaponToMark.setFlag('essence20', 'componentsSucceeded', true);
    }

    // Clip Check (Quartermaster's Guide to Gear, General Perk, p.28): a Fumbled Attack may be
    // rerolled - reads the real natural-min-die Fumble (_isCritIsFumble, computed
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
      // count against Explosive or non-Element weapons (mechanics/vehicles/vehicle-upgrades.mjs).
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

    // Fumble: a natural 1 on the d20 of a failed Skill Test earns the team a Story Point (GI Joe
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
      // Item rules' FumbleStoryPoints (It's Right There, Academic Studies) make it more than 1
      // (rules/plugins/resources/grant-story-point.mjs).
      await requestStoryPointGrant(actor, ruleFumbleStoryPoints(actor, { rolledSkill: checkContext?.riderContext?.skill }));
    }

    // The GM-side twin: an NPC's Critical Success on a Skill Test adds to the GM's Story Point pool
    // (GI Joe CRB p.128; PR p.92, TF p.107 agree; MLP has no GM pool at all, which
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
    // A Requisition Test (mechanics/resources/requisition.mjs) is a plain Skill Test vs a flat DIF, but
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
   * @param {Boolean} floorAt10   Silver Tongue (Spy Focus, 6th level) - any d20 under 10 counts as
   *   a 10. Applies Foundry's own `min` dice modifier to each d20 die before Edge/Snag's
   *   keep-highest/keep-lowest selection runs, so that selection sees the already-floored values.
   * @param {Boolean} rollsThreeD20   Kill Shot (Sniper Focus, 20th level, p.75): a sniper-weapon
   *   ranged attack with Edge may roll a third d20 and keep the best. Only meaningful together with edge=true - a plain Snag or a
   *   cancelled Edge/Snag pair isn't "having an Edge" and stays the ordinary 2d20/d20 term.
   * @param {Number} flatD20Value   General Hawk's Personnel Files "Dependable"/"Old Reliable"/
   *   "Legendary Dependability": a d20 taken as a flat 10 (or 15) instead of rolled. A
   *   genuine flat SUBSTITUTION rather than a floor (unlike floorAt10 above, which still lets a
   *   naturally-higher roll count) - 0 (the default) means no substitution, matching every other
   *   grant. With an active Edge/Snag, only ONE of the pair becomes flat by default (a real rolled
   *   d20 stays live for the other side, so a genuinely better roll can still win the kh/kl
   *   comparison) - see flatBothD20s below for the "set BOTH d20s" escalation.
   * @param {Boolean} flatBothD20s   Old Reliable's extra-Moxie option (both d20s count as 10) -
   *   replaces the whole Edge/Snag pair with the flat value
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

        // A bonus pool die (BonusPoolDie rules - Rumble in the Jungle) joins the staircase rather than replacing it.
        if (bonusPoolDie) {
          shiftOperands.push(bonusPoolDie);
        }

        formula += ` + {${this._arrayToFormula(shiftOperands)}}kh`;
      } else if (bonusPoolDie) {
        // A bonus pool die on an unspecialized roll makes the single die a two-die kept-highest pool.
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
