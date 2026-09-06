import { E20 } from "./helpers/config.mjs";
import { _isCritIsFumble, buildCheckChatData, computeMultiplier, getDefenseValue } from "./helpers/combat.mjs";
import {
  checkPredatorSneakAttackEligibility,
  checkSneakAttackEligibility,
  getPredatorSneakAttackDamage,
  hasPredatorSneakAttack,
  isSneakAttackDamageItem,
  markDebilitated,
  markSneakAttackUsed,
  PREDATOR_SNEAK_ATTACK_ROUND_FLAG,
} from "./helpers/sneak-attack.mjs";
import {
  actorHasPerk, clearPendingBonus, findPerk, getPendingBonus, hasUsedThisRound, markUsedThisRound,
} from "./helpers/perks.mjs";
import { consumeRollWithThePunches } from "./helpers/banked-buffs.mjs";
import { getShieldUpgradeBonus, isPersonalShieldActive } from "./helpers/personal-shield.mjs";
import { getShieldModulationDamageType, SHIELD_MODULATION_ID } from "./helpers/shield-modulation.mjs";
import { getRecklessAbandonStrengthShiftUp } from "./helpers/reckless-abandon.mjs";
import { checkEnemyNumberOne, markAttackedEnemyNumberOne } from "./helpers/enemy-number-one.mjs";
import { getInfluentialShiftUp } from "./helpers/influential.mjs";
import { isMultipleTargetsWeapon } from "./helpers/multiple-targets.mjs";
import { applyReroll } from "./helpers/reroll.mjs";

// Every Commando Perk automated below that isn't specific to Sneak Attack itself (those constants
// live in helpers/sneak-attack.mjs instead) - all under GI Joe CRB's own compendium pack.
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const PARANOIA_ID = `${GI_JOE_CRB}HG32BCzrF6Hsz7yR`;
const FIRST_STRIKE_ID = `${GI_JOE_CRB}qxqtfBobduwSkfRM`;
const SECONDS_BETWEEN_CLICK_AND_BOOM_ID = `${GI_JOE_CRB}ofiG5IwlURUwORYV`;
const PIERCING_SHOT_ID = `${GI_JOE_CRB}W4PmkxBW7m3j88oF`;
const DEBILITATING_STRIKE_ID = `${GI_JOE_CRB}dYaTU9IYI3vB5eHs`;
const QUIET_AS_THE_GRAVE_ID = `${GI_JOE_CRB}UJTt3hP5OwQHBcpf`;
const SILVER_TONGUE_ID = `${GI_JOE_CRB}69ijP0SuQ4demwd9`;
const SHOCK_AND_AWE_ID = `${GI_JOE_CRB}a5HptfB7nYFLVHkc`;
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
const IMMOVABLE_OBJECT_ID = `${GI_JOE_CRB}QSHsA1peMncG196r`;
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
    const dataset = {
      shift: actor.system.skills[initSkill].shift,
      shiftUp: actor.system.skills[initSkill].shiftUp + actor.system.essenceShifts.speed.shiftUp,
      shiftDown: actor.system.skills[initSkill].shiftDown + actor.system.essenceShifts.speed.shiftDown,
      skill: initSkill,
    };
    const skillDataset = {
      edge: actor.system.skills[initSkill].edge,
      shift: actor.system.skills[initSkill].shift,
      snag: actor.system.skills[initSkill].snag,
    };
    const skillRollOptions = await this._rollDialog.getSkillRollOptions(dataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return false;
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
    const rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];
    const essenceShifts = actor.system.essenceShifts;
    // The specific Specialization being rolled, if any (essence-skills.hbs sets
    // data-specialization-key to its slug key - see helpers/utils.mjs#slugifySpecializationName).
    // Looked up directly off the actor rather than trusted from the dataset, so a Perk's Active
    // Effect targeting system.skills.<skill>.specializations.<key>.shiftUp/edge/etc (see
    // essence20-specialization-redesign) actually reaches the roll.
    const specialization = dataset.specializationKey
      ? actor.system.skills[rolledSkill]?.specializations?.[dataset.specializationKey]
      : null;
    const combatModifiers = this._getAutomaticCombatModifiers(actor, item, rolledEssence);
    if (combatModifiers.debilitatedConsumed) {
      await actor.unsetFlag('essence20', 'debilitated');
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

    let calculatedShiftUp = 0;
    let calculatedShiftDown = 0;
    if (rolledEssence) {
      calculatedShiftUp = dataset.shiftUp + essenceShifts[rolledEssence].shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts[rolledEssence].shiftDown + essenceShifts.any.shiftDown;
    } else {
      calculatedShiftUp = dataset.shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts.any.shiftDown;
    }

    calculatedShiftUp += combatModifiers.shiftUp + (specialization?.shiftUp || 0);
    calculatedShiftDown += combatModifiers.shiftDown + (specialization?.shiftDown || 0);

    // Expertise cancels one point of downshift out of the fully-stacked total ("the first"),
    // not any one particular source of it - see EXPERTISE_PERK_IDS's own doc comment.
    if (this._hasExpertiseDownshiftImmunity(actor, rolledSkill)) {
      calculatedShiftDown = Math.max(0, calculatedShiftDown - 1);
    }

    const updatedShiftDataset = {
      ...dataset,
      shiftUp: calculatedShiftUp,
      shiftDown: calculatedShiftDown,
    };
    const actorSkillData = actor.getRollData().skills[rolledSkill];
    const initialShift = essenceShifts[rolledEssence]?.untrainedBonus && dataset.shift == "d20"
      ? "d2"
      : dataset.shift || actorSkillData.shift;
    const skillDataset = {
      shift: initialShift,
      edge: actorSkillData.edge || !!essenceShifts[rolledEssence]?.edge || combatModifiers.edge
        || !!specialization?.edge,
      snag: actorSkillData.snag || !!essenceShifts[rolledEssence]?.snag || combatModifiers.snag
        || !!specialization?.snag,
    };

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
    if (isFieldSkillTest && actorHasPerk(actor, EXPERT_IN_YOUR_FIELD_ID)) {
      if (skillDataset.edge) {
        updatedShiftDataset.shiftUp += 3;
      } else {
        skillDataset.edge = true;
      }
    }

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

    // Aiming (p.192) is a Ranged weapon-specific Free action granting a 1 shift on a single
    // ranged attack test, plus an additional 1 shift with an attached Laser Sight (p.148/125).
    // Presented as a toggle in the Roll Options Dialog rather than tracked as standing state -
    // the dialog is a fresh form on every roll, so there's nothing to "consume" or clear on
    // Movement; the player simply only checks it when they actually aimed and haven't moved.
    const isRangedAttack = item?.type == 'weaponEffect' && item.system.classification.style != 'melee';
    updatedShiftDataset.aimBonus = isRangedAttack ? 1 + this._getLaserSightBonus(actor, item) : null;

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

    if (skillRollOptions.isAiming) {
      skillRollOptions.shiftUp += updatedShiftDataset.aimBonus;
    }

    if (skillRollOptions.spendEnergon) {
      skillRollOptions.shiftUp += 1;
      await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
    }

    if (skillRollOptions.akimbo) {
      skillRollOptions.shiftUp += 1;
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
    const modifier = actorSkillData.modifier || 0;

    // Silver Tongue (Spy Focus, 6th level): "whenever you roll a Social Essence Skill Test, you
    // treat a d20 roll of 9 or less as a 10" - floors the d20 term(s) at 10 via Foundry's own
    // `min` dice modifier, applied before Edge/Snag's keep-highest/keep-lowest selection so that
    // selection sees the already-floored values.
    const floorD20At10 = rolledEssence == 'social' && actorHasPerk(actor, SILVER_TONGUE_ID);
    const formula = this._getFormula(isSpecialized, skillRollOptions, finalShift, Number(modifier), floorD20At10);

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

    const targets = Array.from(game.user.targets);
    let checkEntries = null;
    if (skillRollOptions.defenseType && skillRollOptions.defenseType != 'none' && targets.length) {
      checkEntries = await Promise.all(targets.map(async token => {
        const deflectiveReduction = isPenetratingRoundsAttack && skillRollOptions.defenseType == 'toughness'
          ? this._getDeflectiveArmorToughness(token.actor)
          : 0;

        let difficulty = getDefenseValue(token.actor, skillRollOptions.defenseType, { ignoreArmor: drivingStrikeIgnoreArmor })
          + getShieldUpgradeBonus(token.actor, skillRollOptions.defenseType)
          - deflectiveReduction;

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

        return {
          name: token.actor.name,
          targetUuid: token.actor.uuid,
          difficulty,
          willpowerDifficulty: isTriggerHappyAttack ? getDefenseValue(token.actor, 'willpower') : null,
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

    // damageBonus Role Points (e.g. Sneak Attack Damage) - a flat add-on to the weaponEffect's own
    // damageValue, folded in only once there's an actual attack (a real checkEntries) to apply it
    // to, so checking the box on a roll that never ends up targeting anyone doesn't needlessly
    // burn Sneak Attack's once-per-round use for no effect.
    let damageBonusValue = warfighterDamageBonus + (checkEntries && damageRolePoints && skillRollOptions.applyRolePointsDamage
      ? damageRolePoints.value
      : 0);
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
      }

      // Debilitating Strike (16th level) - flagged here, applied per-target once the roll
      // actually resolves and hits (see _rollSkillHelper below).
      debilitatingStrike = actorHasPerk(actor, DEBILITATING_STRIKE_ID);
    } else if (damageBonusValue && damageRolePoints?.isPredatorSneakAttack) {
      await markUsedThisRound(actor, PREDATOR_SNEAK_ATTACK_ROUND_FLAG);
    }

    // Shared by Shock and Awe below and Plate Piercing (_applyPlatePiercingVehicleDamage) -
    // both only care whether this is an explosive-style weaponEffect at all, not any Perk of
    // their own yet.
    const isExplosiveAttack = item?.type == 'weaponEffect' && item.system.classification?.style == 'explosive';

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

    const checkContext = checkEntries
      ? {
        entries: checkEntries,
        damageValue: item?.type == 'weaponEffect' ? item.system.damageValue + damageBonusValue : null,
        damageType: item?.type == 'weaponEffect' ? item.system.damageType : null,
        // Plate Piercing (Artillery Focus, 10th level) - read by _applyPlatePiercingVehicleDamage
        // once the roll resolves, the same "a fact about the attack, threaded through
        // checkContext rather than re-derived from item" shape as effectName/alternateEffects
        // below (checkContext, not a raw item reference, is what actually crosses into
        // _rollSkillHelper - see that function's own doc comment).
        isExplosiveAttack,
        isMultipleTargetsWeapon: isMultipleTargetsWeaponAttack,
        debilitatingStrike,
        shockAndAwe,
        triggerHappy: isTriggerHappyAttack,
        // Empty the Mag - applied a second time, per hit target, once the roll resolves (see
        // _applyEmptyTheMag below) - so only the player's own dialog checkbox matters here, not
        // a re-check of eligibility (already confirmed by emptyTheMagAvailable pre-filling it).
        emptyTheMag: !!skillRollOptions.emptyTheMag,
        // Sudden Death (Blitzer Focus, 20th level, p.98) - "when you successfully hit with a
        // Might melee attack against a target whose Threat Level is equal to or less than your
        // level, you can choose to defeat them instead of dealing damage." Only the weapon-type
        // half of that check (a fact about the attack, not about any specific target) belongs
        // here - the Perk check, once-per-combat gate, and per-target Threat Level compare all
        // happen at apply-damage time instead (chat.mjs#onApplyDamage), once the actual target
        // is known, same division of labor as every other chat.mjs-side Perk check.
        isMightMelee: item?.type == 'weaponEffect'
          && item.system.classification.skill == 'might' && item.system.classification.style == 'melee',
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
   * rather than anything the actor chose. Size and target-Condition effects only apply to
   * weapon attack rolls; Impaired and Momentarily Acting Smaller (p.157 - a Snag on all
   * physical, i.e. Strength/Speed, actions while squeezed into a smaller space) apply to any
   * Skill Test, and a Prone attacker's own melee penalty are Condition effects that come from
   * the roller's own statuses.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   * @param {String} rolledEssence   The Essence tied to the skill being rolled, if any.
   * @returns {Object}   { shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId,
   *   tooCloseForMinimumRange, pendingBonusesToClear }
   * @private
   */
  _getAutomaticCombatModifiers(actor, item, rolledEssence) {
    let shiftUp = 0;
    let shiftDown = 0;
    let edge = false;
    let snag = false;
    let debilitatedConsumed = false;
    let tooCloseForMinimumRange = false;
    const pendingBonusesToClear = [];

    const selfStatuses = actor.statuses;
    if (selfStatuses.has('impaired')) {
      shiftDown += 1;
    }

    if (selfStatuses.has('actingSmaller') && ['strength', 'speed'].includes(rolledEssence)) {
      snag = true;
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
    }

    // Who Dares, Wins (Door-Kicker Focus, 6th level): "you gain an Edge on all of your attacks
    // with a shotgun or submachine gun, and Skill Tests, in the first round of combat." Which
    // clauses "in the first round of combat" scopes over is genuinely ambiguous text - reading
    // both halves as round-1-scoped makes the weapon-specific clause a strict subset of the
    // broader "Skill Tests" one, so this just grants Edge on any roll during round 1, applying to
    // ANY roll rather than only weaponEffect attacks, same reasoning as Debilitating Strike above.
    if (game.combat?.round == 1 && actorHasPerk(actor, WHO_DARES_WINS_ID)) {
      edge = true;
    }

    // Think On It (Technician/Grandmaster Focus, 5th level, p.103) / Plan of Action (Officer
    // base, 1st level, p.85): both banked via the sheet's own new "Use" control
    // (helpers/banked-buffs.mjs) and consumed here, on whichever actor is rolling - applies to
    // ANY roll, same reasoning as Debilitating Strike/Who Dares Wins above. Plan of Action banks
    // its bonus directly on the ALLY the Officer chose, not the Officer themselves, so this is
    // still just an ordinary self-flag check either way - no cross-actor lookup needed here. This
    // function is synchronous and can't clear the flag itself, so - same shape as
    // debilitatedConsumed above - it just reports which keys to clear and rollSkill() does it.
    const pendingThinkOnIt = getPendingBonus(actor, 'pendingThinkOnIt');
    if (pendingThinkOnIt) {
      edge = true;
      pendingBonusesToClear.push('pendingThinkOnIt');
    }

    const pendingPlanOfAction = getPendingBonus(actor, 'pendingPlanOfAction');
    if (pendingPlanOfAction) {
      shiftUp += pendingPlanOfAction.shiftUp;
      pendingBonusesToClear.push('pendingPlanOfAction');
    }

    const isAttack = item?.type == 'weaponEffect';
    if (!isAttack) {
      return {
        shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId: null,
        tooCloseForMinimumRange, pendingBonusesToClear,
      };
    }

    const isMelee = item.system.classification.style == 'melee';

    if (selfStatuses.has('blinded')) {
      snag = true;
    }

    if (isMelee && selfStatuses.has('prone')) {
      shiftDown += 1;
    }

    const targetToken = game.user.targets.first();
    const target = targetToken?.actor;
    let enemyNumberOneTankId = null;
    if (target) {
      shiftUp += this._getSizeShift(actor.system.size, target.system.size);

      const targetStatuses = target.statuses;
      // Alpha Strike (Door-Kicker Focus, 3rd level, p.98) - the reciprocal half: "all attacks
      // against you also have an Edge until the beginning of your next turn," approximated at
      // round granularity (see ALPHA_STRIKE_ROUND_FLAG's own doc comment on _isAlphaStrikeAttack
      // above) via the same hasUsedThisRound-shaped flag Quiet as the Grave/Predator Sneak Attack
      // already use for round tracking, just read here instead of gating a new use.
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

      if (targetStatuses.has('immobilized')) {
        shiftUp += 1;
      }

      if (targetStatuses.has('invisible') || (!isMelee && targetStatuses.has('prone'))) {
        snag = true;
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
      if (!isMelee && (targetStatuses.has('cover') || targetStatuses.has('totalCover'))
        && !this._isPenetratingRoundsAttack(actor, item)) {
        shiftDown += 2;
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
        const normalRange = item.system.range?.value;
        const longRange = item.system.range?.long;
        const minRange = item.system.range?.min;
        if (normalRange && distance > normalRange && (!longRange || distance <= longRange)) {
          snag = true;
        }

        if (minRange && distance < minRange) {
          tooCloseForMinimumRange = true;
        }

        const enemyReach = E20.actorReach[target.system.size];
        if (enemyReach && distance <= enemyReach) {
          shiftDown += 1;
        }
      }

      // Resistance to this attack's damage type always imposes a Snag on the roll to apply it
      // (p.170) - unlike Immunity, it does not reduce the damage itself once the attack lands.
      if (target.system.resistances?.[item.system.damageType]) {
        snag = true;
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
        }
      }

      // Paranoia (18th level): "Attacks against you suffer a Snag" - unconditional, any attack.
      if (actorHasPerk(target, PARANOIA_ID)) {
        snag = true;
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
      }

      // Enemy Number One (Tank Focus, 3rd level) - unlike Paranoia above, the Perk lives on a
      // nearby enemy Tank, not necessarily this roll's own target; see
      // helpers/enemy-number-one.mjs for the full trigger/exemption logic.
      const enemyNumberOne = checkEnemyNumberOne(actor, target);
      if (enemyNumberOne.snag) {
        snag = true;
      }

      enemyNumberOneTankId = enemyNumberOne.attackedTankId;

      // First Strike (7th level): "you gain an Edge on Attacks... against opponents who haven't
      // acted yet in combat." The rule also covers plain Skill Tests against such an opponent,
      // but that's out of scope here - this whole target block only runs for weaponEffect attacks
      // (isAttack above), same documented simplification as Seconds Between Click & Boom below.
      if (game.combat && actorHasPerk(actor, FIRST_STRIKE_ID)) {
        const targetCombatant = game.combat.combatants.find(c => c.actor?.uuid == target.uuid);
        const targetHasNotActedYet = targetCombatant
          && game.combat.turns.indexOf(targetCombatant) > game.combat.turn;
        if (targetHasNotActedYet) {
          edge = true;
        }
      }

      // Heavy Ordnance (Infantry/Mechanized Infantry Focus, 15th level, p.82): "attacks made with
      // the weapons of a vehicle you are piloting gain an Edge when attacking other vehicles or
      // enemies your size or greater." Unlike every other check in this file, the Perk lives on a
      // PC, but the roll being made is the VEHICLE's own (see _isHeavyOrdnanceAttack's own doc
      // comment) - actor here is the vehicle, not the pilot.
      if (this._isHeavyOrdnanceAttack(actor, target)) {
        edge = true;
      }

      // Seconds Between Click & Boom (9th level): "attacks against your Evasion Defense suffer a
      // Snag." (The "if your attacker misses, you suffer no effects" half has no hook to apply
      // automatically - not implemented, a known gap.)
      if (item.system.defenseType == 'evasion' && actorHasPerk(target, SECONDS_BETWEEN_CLICK_AND_BOOM_ID)) {
        snag = true;
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
        }
      }
    }

    return {
      shiftUp, shiftDown, edge, snag, debilitatedConsumed, enemyNumberOneTankId, tooCloseForMinimumRange,
      pendingBonusesToClear,
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
   * @param {Array<Object>} results   The rollSkill()-built per-target result rows (mutated).
   * @private
   */
  async _applyImmovableObjectImmunity(results) {
    for (const result of results) {
      if (result.criticalOptions.length && result.targetUuid) {
        const targetActor = await fromUuid(result.targetUuid);
        if (targetActor && actorHasPerk(targetActor, IMMOVABLE_OBJECT_ID)) {
          result.criticalOptions = [];
        }
      }
    }
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
      roll.toMessage({
        flags: {
          essence20: {
            canCritD2: canCritD2,
            ...rollContext,
          },
        },
        speaker,
        flavor,
        rollMode: game.settings.get('core', 'rollMode'),
      });
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

    const [isCrit] = _isCritIsFumble(roll.dice, canCritD2);

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

    const results = checkContext.entries.map(entry => {
      const multiplier = computeMultiplier(roll.total, entry.difficulty);
      const success = multiplier > 0;
      // Only a resolved target actor (not a flat @Check[dif=...] entry) can take Health damage.
      const canApplyDamage = success && entry.targetUuid && checkContext.damageValue;
      // Trigger Happy - an independent compare against the same roll total, not gated on
      // `success` above (RAW: "...in addition to their Toughness or Evasion").
      const frightened = checkContext.triggerHappy && entry.targetUuid && entry.willpowerDifficulty != null
        && computeMultiplier(roll.total, entry.willpowerDifficulty) > 0;

      return {
        name: entry.name,
        targetUuid: entry.targetUuid,
        difficulty: entry.difficulty,
        showDifficulty: true,
        success,
        multiplier,
        damageValue: canApplyDamage ? checkContext.damageValue * multiplier : null,
        damageType: checkContext.damageType,
        damageTypeLabel: checkContext.damageType ? this._localize(E20.damageTypes[checkContext.damageType]) : null,
        criticalOptions: canApplyDamage ? criticalOptions : [],
        isMightMelee: canApplyDamage ? checkContext.isMightMelee : false,
        frightened,
      };
    });

    await this._applyImmovableObjectImmunity(results);
    await this._applyPlatePiercingVehicleDamage(actor, results, checkContext);
    this._applyEmptyTheMag(results, checkContext);
    await this._applyNowhereIsSafe(actor, results, checkContext);

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
    const fullRollContext = { ...rollContext, rollFailed: results.every(entry => !entry.success) };

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
   * @returns {String}   The d20 portion of skill roll formula.
   * @private
   */
  _getd20Operand(edge, snag, floorAt10=false) {
    const minModifier = floorAt10 ? 'min10' : '';

    // Edge and Snag cancel eachother out
    if (edge == snag) {
      return `d20${minModifier}`;
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
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFormula(isSpecialized, skillRollOptions, finalShift, modifier, floorD20At10=false) {
    const edge = skillRollOptions.edge;
    const snag = skillRollOptions.snag;
    const shiftOperands = [];
    let formula = this._getd20Operand(edge, snag, floorD20At10);

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
