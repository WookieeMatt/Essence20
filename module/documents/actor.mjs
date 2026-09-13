import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { resizeTokens } from "../helpers/actor.mjs";
import { actorHasPerk, findPerk } from "../helpers/perks.mjs";
import { getGravityOptionalHeight, isGravityOptionalActive } from "../helpers/gravity-optional.mjs";
import { roleValueChange } from "../sheet-handlers/role-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransformUuid } from "../sheet-handlers/transformer-handler.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";
import { normalizeSpecializations } from "../sheet-handlers/specialization-handler.mjs";
import { isPowerAdaptationActive } from "../helpers/power-adaptation.mjs";
import { isSkiing } from "../helpers/skier.mjs";
import { isWisdomOfTheEldersActive } from "../helpers/wisdom-of-the-elders.mjs";
import { getMobileModeType } from "../helpers/mobile-mode.mjs";
import { getAnimalGaitType } from "../helpers/animal-gait.mjs";
import { getSwiftnessBonusFeet } from "../helpers/swiftness.mjs";
import { getFlutteryWingsBonus } from "../helpers/fluttery-wings.mjs";
import { isLightningSpeedActive } from "../helpers/lightning-speed.mjs";
import { isRushTheLineActive } from "../helpers/rush-the-line.mjs";
import { isFrictionlessMovementActive } from "../helpers/frictionless-movement.mjs";
import { isSprinterBoostActive } from "../helpers/sprinter-boost.mjs";
import { isHotToTrotActive } from "../helpers/hot-to-trot.mjs";
import { isBulwarkActive } from "../helpers/bulwark.mjs";
import { hasNearbyDefeatedAlly } from "../helpers/field-aid.mjs";
import { isEngineOverrideBoostActive } from "../helpers/engine-override.mjs";
import { getHupHupHupHupHupBonus } from "../helpers/hup-hup-hup-hup-hup.mjs";
import { isJuryRigBenefitActive } from "../helpers/jury-rig.mjs";
import { isTheToughGetGoingActive } from "../helpers/the-tough-get-going.mjs";
import { getNaturalMovementType } from "../helpers/natural-movement.mjs";
import { hasActiveEnvironmentalExpertise } from "../helpers/environmental-expertise.mjs";

// GI Joe CRB Vanguard Perks that grant a flat, condition-gated Toughness/Evasion bonus - computed
// fresh in _prepareDefenses() below (like rolePointsDefense already is) rather than written into
// system.defenses.<type>.bonus, which is the player/GM's own manual catch-all via the Stat Editor
// dialog (module/apps/stat-editor.mjs) AND a legitimate target for a Perk's own compendium Active
// Effect (31 Perks in this pack already use one) - mutating it here would double-count with either
// source, or go stale the moment the condition (e.g. armor equipped) stops being true.
//
// Iron Heart (Think Tank Focus, 10th level, "+1 to Toughness and Evasion... +1 Health") is
// deliberately NOT handled here for exactly that double-count reason: its compendium Item
// (kKPhxxl5NUo7eE8z) already carries an enabled Active Effect adding +1 to
// system.defenses.toughness.bonus, system.defenses.evasion.bonus, AND system.health.bonus - all
// three clauses of the Perk, unconditionally, which is the correct shape for a bonus with no
// fictional trigger to check. An earlier pass here duplicated the Toughness/Evasion half as its
// own perkDefenseBonus (missing that the Active Effect already existed and covered the Health
// clause too, which had been wrongly logged elsewhere as an unbuilt gap) - removed once the
// double-count was found by cross-referencing every automated Perk ID here against the
// compendium's own Active Effects.
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const ARMOR_EXPERT_ID = `${GI_JOE_CRB}0a01vmWtbbYYcNvA`;
const THE_HEAVY_ID = `${GI_JOE_CRB}rlD6YJSr2fgROKHo`;

// Bulwark (Tank Focus, 17th level, p.99) - see helpers/bulwark.mjs's own doc comment. "Your
// movement becomes zero" while planted, checked in _prepareMovement() below alongside Warrior
// Rush's own permitted movement-math touch-point.
const BULWARK_ID = `${GI_JOE_CRB}7758n3XWOzhSjdOk`;
// Wire Work (Commando base, Infiltrator Focus, 6th level, p.73): "you gain a Climb Movement equal
// to your Ground Movement" - unlike Lightfoil Wings' identical-shaped aerial=ground copy, this is
// safe to read system.movement.ground.total directly (movementTypes processes 'climb' AFTER
// 'ground' in the loop below, so ground's own total is already fully finalized by this point).
// "Do not have to roll a Skill Test to climb most surfaces" and the jump-distance clauses are pure
// narrative/GM-adjudicated with no mechanic to hook - not built. The Acrobatics-for-Athletics
// substitution lives in dice.mjs (see WIRE_WORK_ID's own comment there).
const WIRE_WORK_ID = `${GI_JOE_CRB}TGqWGjDUy24SPSGZ`;
const AMPHIBIOUS_ASSAULT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.X2atZm3eoIBJcwF6";
// Field Aid (Focus: Medic, 3rd level, p.82) - see helpers/field-aid.mjs's own doc comment.
const FIELD_AID_ID = `${GI_JOE_CRB}5JUC0fO9hUIJFP6u`;
// Shared by Infantry and Vanguard - a single compendium Perk both Roles grant, whose chosen
// Fighting Style lives on its own system.choice field (see sheet-handlers/perk-handler.mjs's
// 'fightingStyle' choiceType). Only Careful/Defense have a numeric effect built - the other 4
// options (Akimbo, Close Quarters Battle, Long Shot, Trigger Happy) are recorded but not automated.
const FIGHTING_STYLE_ID = `${GI_JOE_CRB}2LtDCHxgg9bMvWQK`;

// Transformers CRB Role Perks automated below - Tier 1 of the Transformers Role automation pass
// (see project plan). Bare `perk` items with no compendium mechanical data of their own, same
// "content is empty, the fix is code" situation as every Power Ranger Tier 1 Perk.
const TF_CRB = "Compendium.essence20.tf_crb.Item.";

// Organic Energon (Field Guide to Action and Adventure, General Perk, p.71): "Whether through
// nature or experimentation, you represent the evolutionary crossing point between organic and
// robotic life... You gain a pool of Energon Points equal to half your lowest Essence score."
// Unlike Energon Battery below, this is meant for a NON-transforming character (prerequisite:
// "You can't have the Robot trait") who would otherwise get no Energon pool at all
// (_prepareEnergon's own early-return below is gated on system.canTransform) - so this Perk
// widens that gate rather than fitting inside the existing canTransform branch.
const ORGANIC_ENERGON_ID = "Compendium.essence20.field_guide_action_adventure.Item.ic1SwixGi3tstr5y";

// Personal Power Supply (Field Guide to Action and Adventure, General Perk, p.71): "You gain a
// Personal Power Point pool, starting with 1 and growing by 1 every 5 levels (for instance, if
// you choose this Perk at 6th level, you begin with a pool of 2). You regenerate 2 Personal Power
// Points per day (up to your maximum)." Only the pool-grant half is built - "you can choose Grid
// Powers as General Perks" depends on the still-unbuilt Grid Powers system (this project's own
// repeatedly-flagged #1 infra gap), left unbuilt. The level-scaling formula (1 + floor(level/5))
// matches RAW's own worked example exactly. `system.powers.personal.max` is otherwise a plain
// Active-Effect-additive field (see Extra Grid Power's own compendium Active Effect, `mode: 2`
// ADD, +1) with no existing derived-data computation of its own - this runs in
// prepareDerivedData(), after Active Effects have already applied, and ADDS on top of whatever
// value already exists, the same "additive, not overriding" shape every other source of Personal
// Power already assumes.
const PERSONAL_POWER_SUPPLY_ID = "Compendium.essence20.field_guide_action_adventure.Item.Uy3t5KLbeGHv08ho";

// Energon Battery (Scientist Role, 1st level, p.79): "you store a number of personal Energon
// Points equal to your highest Essence Score, not your lowest." Overrides the Math.min() every
// other transforming actor uses in _prepareEnergon() below.
const ENERGON_BATTERY_ID = `${TF_CRB}mRwjbhGpqWu7hqDM`;

// Fireproof (Cobra Codex, Ranger Firestarter Focus, 3rd/10th level, p.58): "At 3rd level, you gain
// Fire Resistance. At 10th level, this improves to Fire Immunity." Level-gated, so - unlike a
// static compendium Active Effect - this needs a live level check; runs in prepareDerivedData()
// (after Active Effects have already applied) and only ADDS the Resistance/Immunity on top of
// whatever's already set, the same "additive, not overriding" idiom PERSONAL_POWER_SUPPLY_ID's own
// comment above already establishes - it never clears an existing true value down to false.
const FIREPROOF_ID = "Compendium.essence20.cobra_codex.Item.gaOLMFlImcLRmQV0";

// Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61) - see helpers/animal-gait.mjs's
// own doc comment. Checked in _prepareMovement() below, same permitted movement-math touch-point
// Wisdom of the Elders' Lightfoil Wings/Warrior Rush already use.

// Spark of the Ancients (Enigma of Combination, General Perk, p.41): "Your maximum Energon Pool
// is increased by 2, and you regain a single Energon Point at the beginning of any scene. You do,
// however, always register as having the highest amount of Energon in a scene for the purpose of
// scanners, Insecticon hunger, and other related effects." Only the flat +2 max is built, the
// same additive-on-top-of-whatever-already-exists shape Personal Power Supply's own +1-per-5-
// levels grant already establishes just below. The "regain 1 Energon at the beginning of any
// scene" half has nothing to attach to - unlike Personal Power's own real `regeneration` field,
// Energon has no such field at all, and this project has no scene-boundary hook anywhere (a
// repeatedly-documented gap) to fire a scene-start regen from even if one existed. "Always
// register as highest Energon for scanners" is pure narrative - no scanner/detection mechanic
// exists to hook it to.
const SPARK_OF_THE_ANCIENTS_ID = "Compendium.essence20.enigma_of_combination.Item.zqPSjUwr1Y7OvGfD";

// Warrior Rush (Wrecker Focus, 1st level, p.92) - see its own check in _prepareMovement() below.
const WARRIOR_RUSH_ID = `${TF_CRB}jTNi4jENlLEq8ruS`;
const THUNDEROUS_ADVANCE_ID = "Compendium.essence20.gi_joe_crb.Item.B0yM8ewEoYJb1GBg";

// Keep it Together! (Enigma of Combination, Component Ace Focus, 17th level, p.34) - see its own
// check in _prepareMegaformCombinerData() below.
const KEEP_IT_TOGETHER_ID = "Compendium.essence20.enigma_of_combination.Item.9QdGh6Kfb1EVi4N7";

// Better as One (Enigma of Combination, Component Ace Focus, 10th level, p.34) - see its own
// Specialization-merging check in _prepareMegaformCombinerData() below. Only the Specialization
// half is built - the "spend 1 personal Energon Point to give the combined form the normal +1
// bonus (instead of spending from the combined form's own pool)" half needs a "which component's
// resource to charge" picker this codebase has no precedent for (every existing Energon-spend
// checkbox charges the ROLLING actor's own pool), left as a documented gap.
const BETTER_AS_ONE_ID = "Compendium.essence20.enigma_of_combination.Item.XnmVJF4XNcsaXAKL";

// Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68) - see helpers/rush-the-line.mjs's
// own doc comment, and its own check in _prepareMovement() below.
const RUSH_THE_LINE_ID = "Compendium.essence20.intercontinental_adventures.Item.va1HF5CudO4WsguB";

// Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47) - see
// helpers/frictionless-movement.mjs's own doc comment for the full "double EVERY Movement type"
// reasoning, unlike Rush the Line's own ground-only reading just above.
const FRICTIONLESS_MOVEMENT_ID = "Compendium.essence20.technorganic_secrets.Item.9fOrSAd3brtSBk9C";

// Over the Candlestick (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38) - see
// dice.mjs's own OVER_THE_CANDLESTICK_ID comment for the full Perk text and Agile Reflexes half;
// this file only handles the Innate Climber half's own movement grant, below.
const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";

// Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44): "Add 20 feet to
// your Alt Mode's Ground Movement. Additionally, once per scene, you may double your Movement for
// one round." CORRECTED 2026-09-11: this item's own compendium ActiveEffect
// (`system.movement.ground.bonus +20`) was unconditional - since `.bonus` is added to Ground
// Movement's own total in EITHER Bot or Alt Mode (see _prepareMovement's own base+bonus/
// altMode+bonus formulas below), it wrongly buffed Bot Mode too, when RAW scopes this to Alt Mode
// only. Disabled that static effect and replaced it with the live, Alt-Mode-gated check below -
// same pattern Innate Climber's own fix just established. The once/scene double-Movement half
// lives in helpers/sprinter-boost.mjs, reusing Frictionless Movement's exact toggle +
// combatTurn/combatRound end-of-turn-clear shape, scoped to Ground only (Sprinter's own Alt-Mode-
// Ground focus, the same reading Rush the Line's identical "your Movement" wording already gets).
const SPRINTER_ID = "Compendium.essence20.technorganic_secrets.Item.L5P54Ismw81Lhrbe";

// Sprinter (Transformers One Sourcebook, General Perk, p.19): "Increase your Bot Mode Ground
// Movement by 5 feet." CORRECTED 2026-09-11: the compendium's own unconditional
// system.movement.ground.bonus effect wrongly buffed Alt Mode too - the same overreach bug already
// found and fixed for Technorganic Secrets' own identically-named Sprinter Perk this same session,
// disabled and replaced with this live, Bot-Mode-gated check. A third, unrelated compendium item
// from this project's own "same name, different book" pile - see dice.mjs's own
// TF1S_SPRINTER_ID comment for this Perk's Acrobatics/Athletics shiftUp half.
const TF1S_SPRINTER_ID = "Compendium.essence20.transformers_one_sourcebook.Item.gbDY8UiTgSNZHPAo";

// Prowl (GI Joe CRB, Focus: Predator, 17th level, p.94): "in your environment of expertise, you
// double your Ground Movement." Gated on the same Environmental Expertise toggle Natural
// Movement's own identical precondition already reads (see
// helpers/environmental-expertise.mjs's own doc comment) - see its own check in
// _prepareMovement() below.
const PROWL_ID = "Compendium.essence20.gi_joe_crb.Item.ZCOzxoy7d3P5izBB";

const JUMP_THROUGH_TIME = "Compendium.essence20.jump_through_time.Item.";
const GENERAL_HAWKS_PERSONNEL_FILES = "Compendium.essence20.general_hawk_s_personel_files.Item.";

// Skier (General Hawk's Personnel Files, General Perk, p.175) - see helpers/skier.mjs's own doc
// comment. "+10ft Ground Movement... while skiing."
const SKIER_ID = `${GENERAL_HAWKS_PERSONNEL_FILES}dvmY7UiuKejOPY4N`;

// Quantum Master (A Jump Through Time, Quantum Ranger, 20th level, p.47): "double all Movement
// values while Morphed" - see its own check in _prepareMovement() below, same permanent-while-
// Morphed doubling shape as Warrior Rush's own round-1-only doubling just above (movement math is
// one of the few spots this project's own Active Effects/derived-data hold still permits touching -
// see project_essence20_active_effects's own note on _prepareHealth/_prepareDefenses staying off
// limits pending the user's separate migration).
const QUANTUM_MASTER_ID = `${JUMP_THROUGH_TIME}YlHp7yzbOsytNUjD`;

// Eltarian Training (Through the Shattered Grid, General Perk, p.73) - see its own check just
// below in _prepareMovement(). Not a piloting Perk despite being flagged as one by an earlier,
// mistaken categorization pass - see dice.mjs's own identical constant/comment for the full
// discovery (this Perk's Finesse-downshift-immunity half lives there instead, in rollSkill()).
const ELTARIAN_TRAINING_ID = "Compendium.essence20.through_the_shattered_grid.Item.NXxiyoOB60ems444";

// Air Born (MLP Pegasus Origin Perk, p.37): "Choose one of the following as your starting
// Movement: 15ft ground and 45ft aerial, 30ft/30ft, or 45ft/15ft." Sets the actor's own BASE
// ground/aerial Movement outright - see its own check in _prepareMovement() below, which OVERRIDES
// (not adds to) system.movement.<type>.base before the total is computed, the same permitted
// movement-math touch-point Warrior Rush/Quantum Master/Eltarian Training above already use.
const AIR_BORN_ID = "Compendium.essence20.mlp_crb.Item.ekWiJObUf2BAhevg";
const AIR_BORN_MOVEMENT_OPTIONS = {
  groundHeavy: { ground: 15, aerial: 45 },
  balanced: { ground: 30, aerial: 30 },
  aerialHeavy: { ground: 45, aerial: 15 },
};

// Static Electricity (WTNV Citizen's Guide, General Perk, p.51, Weird +d6 prereq): "your Movement
// speed is 35 feet." Sets ground Movement's own base outright - see its own check in
// _prepareMovement() below, same permitted movement-math touch-point as Air Born just above. The
// "+2 Evasion" half is a compendium Active Effect.
const STATIC_ELECTRICITY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.mF6zMzGIfxQgJF9B";

// Gravity Optional (Soldier Role, Blood Space War Veteran Focus, p.37) - see
// helpers/gravity-optional.mjs's own doc comment.
const GRAVITY_OPTIONAL_ID = "Compendium.essence20.wtnv_citizens_guide.Item.F5mrzupd6TG2kj3x";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class Essence20Actor extends Actor {
  constructor(...args) {
    super(...args);
    this._dice = new Dice(ChatMessage, new RollDialog(), game.i18n);
  }

  /** @override */
  static async create(data, options = {}) {
    const actor = await super.create(data, options);

    return actor;
  }

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    /* Foundry's own raw default for a brand-new actor's prototype token is unlinked, hostile,
       and sightless - fine for a disposable NPC/Vehicle/Zord/Megaform (Foundry's own docs
       recommend NOT linking "generic creatures"), but wrong for a Player Character or Companion:
       both are unique, persistently-tracked individuals, so their token should be Linked (Health/
       Stun/etc. edited on the token or the sheet stay in sync everywhere, matching Foundry's own
       "linked tokens are recommended for unique or named characters" guidance), friendly, and
       able to see. hasProperty guards mirror the width/height default further down this file
       (triggered by a size change, not creation) - never override a value already set explicitly
       (by an importer, a compendium actor, or a GM who configured this in the create dialog). */
    if (this.type == 'playerCharacter' || this.type == 'companion') {
      const tokenDefaults = {};
      if (!foundry.utils.hasProperty(data, "prototypeToken.actorLink")) {
        tokenDefaults.actorLink = true;
      }

      if (!foundry.utils.hasProperty(data, "prototypeToken.disposition")) {
        tokenDefaults.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
      }

      if (!foundry.utils.hasProperty(data, "prototypeToken.sight.enabled")) {
        tokenDefaults.sight = { enabled: true };
      }

      if (!foundry.utils.isEmpty(tokenDefaults)) {
        this.updateSource({ prototypeToken: tokenDefaults });
      }
    }

    const CALL_TO_ACTION_ID = "Compendium.essence20.pr_crb.Item.yjhd6FRLJOsOQqN4";
    const RECALL_FOR_REPAIRS_ID = "Compendium.essence20.pr_crb.Item.r1S0Sc4oq8axDL6C";

    if (this.type == 'zord') {
      const newItems = [];
      const callToActionPerkData = await fromUuid(CALL_TO_ACTION_ID);
      const recallForRepairsPerkData = await fromUuid(RECALL_FOR_REPAIRS_ID);
      newItems.push({
        name: callToActionPerkData.name,
        type: callToActionPerkData.type,
        img: callToActionPerkData.img,
        system: callToActionPerkData.system,
      });
      newItems.push({
        name: recallForRepairsPerkData.name,
        type: recallForRepairsPerkData.type,
        img: recallForRepairsPerkData.img,
        system: recallForRepairsPerkData.system,
      });
      this.updateSource({ items: newItems });
    }
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    const currentSize = this.system?.size;
    if (currentSize) {
      const newSize = foundry.utils.getProperty(changed, "system.size");

      if (newSize && (newSize !== currentSize)) {
        const width = CONFIG.E20.tokenSizes[newSize].width;
        const height = CONFIG.E20.tokenSizes[newSize].height;

        resizeTokens(this, width, height);

        if (!foundry.utils.hasProperty(changed, "prototypeToken.width")) {
          changed.prototypeToken ||= {};
          changed.prototypeToken.height = height;
          changed.prototypeToken.width = width;
        }

        for (let item of this.items) {
          if (item.type == 'weaponEffect' && item.system.classification.style == 'melee') {
            let reachMultiplier = 1;
            const actorReach = CONFIG.E20.actorReach[newSize];
            if (item.system.range.reachMultiplier > 1) {
              reachMultiplier = item.system.range.reachMultiplier;
            }

            const totalReach = actorReach * reachMultiplier;

            item.system.totalReach = totalReach;

            const parentId = item.flags.essence20.parentId;
            const parentItem = await this.items.get(parentId);
            const key = item.flags.essence20.collectionId;

            if (parentItem && key) {
              const entry = await createEntry(item, parentItem);
              const pathPrefix = "system.items";

              await parentItem.update({
                [`${pathPrefix}.${key}`]: entry,
              });
            }
          }
        }
      }
    }
  }

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();

    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareNpcData();
    this._prepareVision();
    this._prepareEnergon();
    this._preparePersonalPowerSupply();
    // Runs after Active Effects have applied (prepareDerivedData is the step after that in
    // Foundry's own document lifecycle) - fills in any field a Specialization-granting effect's
    // OVERRIDE changes left unset (see specialization-handler.mjs#normalizeSpecializations).
    normalizeSpecializations(this);

    if (this.type == 'playerCharacter') {
      this._prepareDefenses();
      this._prepareHealth();
      this._prepareMovement();
      this._prepareSorcerousPower();
      this._prepareResource();
      this._preparePoisonTraining();
      this._prepareFireproofResistance();
    }

    if (this.type == 'megaform') {
      this._prepareMegaformData();
    }
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData() {
    if (this.type !== 'npc') return;

    // // Make modifications to data here. For example:
    // const data = actorData.data;
    // data.xp = (data.cr * data.cr) * 100;
  }

  /**
   * Finds the best active vision grant (from any gear or perk with system.visionGrant.enabled)
   * and stores it on this.system.visionGrant for applyVisionToTokens() to read. If more than
   * one grant is present, the one with the largest range wins - a simple, predictable rule
   * rather than trying to stack or reconcile different vision modes. Gear can be worn/unworn
   * (system.equipped, toggled from the sheet's Gear tab) and only contributes its grant while
   * equipped; Perks have no such toggle and are always active once granted.
   *
   * Also sets this.system.visionSuppressed for the Asleep/Unconscious statuses, so a sleeping
   * actor doesn't get a bonus grant from equipped Night Vision Goggles etc. while unconscious.
   * This does NOT block a token's vision outright - actually blacking out perception for
   * Asleep/Unconscious is handled by syncAutoBlindStatus() (helpers/actor.mjs) applying the
   * real "blinded" status, which reuses Foundry's own CONFIG.specialStatusEffects.BLIND
   * handling (see essence20.mjs) rather than trying to force TokenDocument.sight.enabled off
   * directly, which does not actually block perception.
   */
  _prepareVision() {
    this.system.visionSuppressed = this.statuses?.has('asleep') || this.statuses?.has('unconscious') || false;

    let bestGrant = null;

    if (!this.system.visionSuppressed) {
      for (const item of this.items) {
        const grant = item.system.visionGrant;
        if (!grant?.enabled) {
          continue;
        }

        if (item.type == 'gear' && !item.system.equipped) {
          continue;
        }

        if (!bestGrant || grant.range > bestGrant.range) {
          bestGrant = { mode: grant.mode, range: grant.range };
        }
      }
    }

    this.system.visionGrant = bestGrant;
  }

  /**
   * Fireproof - see FIREPROOF_ID's own comment above. Additive only: never clears an already-true
   * Resistance/Immunity, since some other source (an Alteration, a different Perk) may have
   * granted it independently.
   */
  _prepareFireproofResistance() {
    if (!actorHasPerk(this, FIREPROOF_ID)) {
      return;
    }

    this.system.resistances.fire = true;
    if (this.system.level >= 10) {
      this.system.immunities.fire = true;
    }
  }

  /**
   * Sets system.energon.normal.max to this actor's lowest current Essence Score (p.104-105 -
   * "capable of storing a number of personal Energon Points equal to their lowest Essence
   * Score"), for actors that can transform. Non-transforming actors (vehicles, etc.) keep
   * whatever value was set manually, since they may use system.energon.normal as literal fuel
   * capacity rather than the Cybertronian Energon Points resource.
   */
  _prepareEnergon() {
    const hasOrganicEnergon = actorHasPerk(this, ORGANIC_ENERGON_ID);
    if (!this.system.canTransform && !hasOrganicEnergon) {
      return;
    }

    const essences = this.system.essences;
    const values = [essences.strength.value, essences.speed.value, essences.smarts.value, essences.social.value];
    const lowest = Math.min(...values);

    if (!this.system.canTransform) {
      // Organic Energon - see ORGANIC_ENERGON_ID's own comment above.
      this.system.energon.normal.max = Math.floor(lowest / 2);
    } else {
      // Energon Battery - see ENERGON_BATTERY_ID's own comment above.
      this.system.energon.normal.max = actorHasPerk(this, ENERGON_BATTERY_ID)
        ? Math.max(...values)
        : lowest;
    }

    // Spark of the Ancients - see SPARK_OF_THE_ANCIENTS_ID's own comment above. Applies on top of
    // either branch above - RAW names no restriction to transforming actors specifically.
    if (actorHasPerk(this, SPARK_OF_THE_ANCIENTS_ID)) {
      this.system.energon.normal.max += 2;
    }
  }

  /**
   * Personal Power Supply - see PERSONAL_POWER_SUPPLY_ID's own comment above.
   */
  _preparePersonalPowerSupply() {
    if (!actorHasPerk(this, PERSONAL_POWER_SUPPLY_ID)) {
      return;
    }

    this.system.powers.personal.max += 1 + Math.floor((this.system.level ?? 0) / 5);
    this.system.powers.personal.regeneration += 2;
  }

  /**
  * Prepare Health specific data.
  */
  /**
   * The RolePoints Item belonging to the Actor's base Role specifically, ignoring any
   * RolePoints granted by an additive Role (e.g. Old Hand's own Moxie Points) - defense/health
   * bonuses and the Level 20 unlimited-resource flag are about the base Role's own resource.
   * @returns {Item|undefined}
   */
  _getBaseRolePoints() {
    const rolePointsList = this.items.documentsByType.rolePoints;
    return rolePointsList.find(rolePoints => {
      const parentRole = this.items.get(rolePoints.getFlag('essence20', 'parentId'));
      return !parentRole || !parentRole.system.isAdditive;
    });
  }

  /**
   * The actor's own base Role Item, ignoring any additive Role (e.g. Old Hand) - mirrors
   * _getBaseRolePoints() above, but returns the Role itself rather than its RolePoints. Used by
   * Perks that read the base Role's own data directly, like Genius's own "Role Skills" list
   * (system.skills on a role item).
   * @returns {Item|undefined}
   */
  _getBaseRole() {
    const roleList = this.items.documentsByType.role;
    return roleList.find(role => !role.system.isAdditive);
  }

  _prepareHealth () {
    const system = this.system;
    system.healthIsReadOnly = true;
    const health = system.health;
    let originStartingHealth = 0;
    let rolePointsBonusHealth = 0;
    const conditioning = system.conditioning;
    const bonus = system.health.bonus;
    let originName = game.i18n.localize('E20.Origin');
    let rolePointsName = game.i18n.localize('E20.RolePoints');
    const conditionName = game.i18n.localize('E20.SkillConditioning');
    const bonusName = game.i18n.localize('E20.Bonus');

    // Health from Origin
    const origins = this.items.documentsByType.origin;
    if (origins.length > 0) {
      const origin = origins[0];
      originStartingHealth = origin.system.startingHealth;
      originName = origin.name;
    }

    // Health from Role Points
    const rolePoints = this._getBaseRolePoints();
    if (rolePoints && rolePoints.system.bonus.type == 'healthBonus'
      && (!rolePoints.system.isActivatable || rolePoints.system.isActive)) {
      rolePointsName = rolePoints.name;

      if (this.system.level == 20) {
        rolePointsBonusHealth = rolePoints.system.bonus.level20Value;
      } else {
        rolePointsBonusHealth = rolePoints.system.bonus.startingValue + roleValueChange(this.system.level, rolePoints.system.bonus.increaseLevels);
      }
    }

    health.max = originStartingHealth + rolePointsBonusHealth + conditioning + bonus;
    health.string = `${originStartingHealth} (${originName}) + ${rolePointsBonusHealth} (${rolePointsName}) + ${conditioning} (${conditionName}) + ${bonus} (${bonusName})`;
  }

  /**
  * Prepare Defenses specific data.
  */
  _prepareDefenses() {
    const system = this.system;
    const equippedArmor = this.items.documentsByType.armor.filter(a => a.system.equipped);
    const fightingStyle = findPerk(this, FIGHTING_STYLE_ID)?.system.choice;

    for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
      const defense = system.defenses[defenseType];
      const base = defense.base;
      const armor = defense.armor;
      const bonus = defense.bonus;
      const morphed = defense.morphed;
      const shield = defense.shield;
      let rolePointsDefense = 0;
      let perkDefenseBonus = 0;
      const essence = system.essences[defense.essence].max;
      const essenceName = game.i18n.localize(`E20.Essence${defense.essence.capitalize()}`);
      const baseName = game.i18n.localize('E20.DefenseBase');
      const armorName = game.i18n.localize('E20.DefenseArmor');
      const bonusName = game.i18n.localize('E20.Bonus');
      const morphedName = game.i18n.localize('E20.DefenseMorphed');
      const shieldName = game.i18n.localize('E20.DefenseShield');
      const perkName = game.i18n.localize('E20.DefensePerk');
      let rolePointsName = game.i18n.localize('E20.RolePoints');

      // Armor from Role Points
      const rolePoints = this._getBaseRolePoints();
      if (rolePoints) {
        if (rolePoints.system.bonus.type == 'defenseBonus' && rolePoints.system.bonus.defenseBonus[defenseType]
          && (!rolePoints.system.isActivatable || rolePoints.system.isActive)) {
          rolePointsName = rolePoints.name;

          if (this.system.level == 20) {
            rolePointsDefense = rolePoints.system.bonus.level20Value;
          } else {
            rolePointsDefense = rolePoints.system.bonus.startingValue + roleValueChange(this.system.level, rolePoints.system.bonus.increaseLevels);
          }
        }
      }

      // GI Joe CRB Vanguard Perks - flat, condition-gated Toughness/Evasion bonuses. Computed
      // fresh every prepareData pass off live conditions (armor currently equipped, its
      // classification) rather than written into defense.bonus (the player/GM's own manual
      // catch-all via the Stat Editor dialog), so removing armor or the Perk immediately drops
      // the bonus instead of leaving a stale value behind.
      if (defenseType == 'toughness' && equippedArmor.length) {
        if (actorHasPerk(this, ARMOR_EXPERT_ID)) {
          // Armor Expert (Juggernaut Focus, 1st level): "+2 Toughness defense while wearing armor."
          perkDefenseBonus += 2;
        }

        if (actorHasPerk(this, THE_HEAVY_ID) && equippedArmor.some(a => ['heavy', 'ultraHeavy'].includes(a.system.classification))) {
          // The Heavy (base, 2nd level): "gain 2 additional Toughness when wearing heavy or super
          // heavy armor."
          perkDefenseBonus += 2;
        }
      }

      // Fighting Style (Infantry/Vanguard, shared Perk, p.79/108) - only the 2 options with a
      // clean numeric effect are automated:
      if (['toughness', 'evasion'].includes(defenseType)) {
        if (fightingStyle == 'careful' && this.statuses?.has('cover')) {
          // Careful: "When taking cover, you gain a +2 bonus to your Toughness and Evasion."
          // Reads the actor's own 'cover' status (the same one dice.mjs's automatic combat
          // modifiers already read on a target) - the player/GM toggles it via the token HUD.
          perkDefenseBonus += 2;
        }

        if (fightingStyle == 'defense' && equippedArmor.length) {
          // Defense: "While you are wearing armor, you gain a +1 bonus to your Toughness and
          // Evasion."
          perkDefenseBonus += 1;
        }
      }

      defense.total = base + essence + bonus + rolePointsDefense + perkDefenseBonus;
      defense.total += system.isMorphed ? morphed : armor;
      defense.total += shield;

      defense.string = `${base} (${baseName}) + ${essence} (${essenceName})`;
      defense.string += system.isMorphed ? ` + ${morphed} (${morphedName})` : ` + ${armor} (${armorName})`;
      defense.string += ` + ${shield} (${shieldName})`;
      defense.string += ` + ${bonus} (${bonusName}) + ${rolePointsDefense} (${rolePointsName})`;
      defense.string += ` + ${perkDefenseBonus} (${perkName})`;
    }
  }

  /**
  * Prepare Movement specific data.
  */
  _prepareMovement() {
    let movementTotal = 0;
    const system = this.system;

    // Air Born - see AIR_BORN_ID's own comment above. Resolved once, outside the per-type loop
    // (it sets both ground and aerial in the same pick), then applied to each type's own base
    // inside the loop below.
    const airBornOption = AIR_BORN_MOVEMENT_OPTIONS[findPerk(this, AIR_BORN_ID)?.system.choice];

    // Static Electricity - see STATIC_ELECTRICITY_ID's own comment above. Sets ground Movement's
    // own base to a flat 35ft, same override shape as Air Born just above.
    const hasStaticElectricity = actorHasPerk(this, STATIC_ELECTRICITY_ID);

    // Gravity Optional - see helpers/gravity-optional.mjs's own doc comment. Sets aerial
    // Movement's own base while the toggle is active, same override shape as Static Electricity
    // just above.
    const gravityOptionalActive = actorHasPerk(this, GRAVITY_OPTIONAL_ID) && isGravityOptionalActive(this);

    const movementTypes = ['aerial', 'ground', 'climb', 'swim'];
    for (const movementType of movementTypes) {
      if (airBornOption && (movementType == 'ground' || movementType == 'aerial')) {
        system.movement[movementType].base = airBornOption[movementType];
      }

      if (movementType == 'ground' && hasStaticElectricity) {
        system.movement[movementType].base = 35;
      }

      if (movementType == 'aerial' && gravityOptionalActive) {
        system.movement[movementType].base = getGravityOptionalHeight(this);
      }

      system.movement[movementType].base = parseInt(system.movement[movementType].base);
      system.movement[movementType].total = 0;

      if (system.isMorphed && system.isTransformed) {
        if (system.movement[movementType].altMode) {
          system.movement[movementType].total = system.movement[movementType].altMode + system.movement[movementType].bonus + system.movement[movementType].morphed;
        }
      } else if (system.isMorphed) {
        if (system.movement[movementType].base) {
          system.movement[movementType].total = system.movement[movementType].base + system.movement[movementType].bonus + system.movement[movementType].morphed;
        }
      } else if (system.isTransformed) {
        if (system.movement[movementType].altMode) {
          system.movement[movementType].total = system.movement[movementType].altMode + system.movement[movementType].bonus;
        }
      } else {
        if (system.movement[movementType].base) {
          system.movement[movementType].total = system.movement[movementType].base + system.movement[movementType].bonus;
        }
      }

      movementTotal += system.movement[movementType].total;

      if (system.movement[movementType].total == 0) {
        if (movementType == 'climb' || movementType == 'swim') {
          //This equation gives you half speed round down to the nearest 5 ft for certain movements.
          system.movement[movementType].total = Math.floor(system.movement.ground.total / 5 * .5) * 5;
        }
      }

      // Natural Movement - see helpers/natural-movement.mjs's own doc comment. "Half your Ground
      // Movement" is the same formula the default climb/swim fallback above already computes, but
      // this OVERRIDES regardless of whatever that movement type's total already was (unlike the
      // fallback, which only kicks in when it's still 0) - real value for an actor whose actual
      // permanent Climb/Swim speed is lower than half their Ground Movement.
      if (movementType == getNaturalMovementType(this)) {
        system.movement[movementType].total = Math.floor(system.movement.ground.total / 5 * .5) * 5;
      }

      // Prowl - see PROWL_ID's own comment above.
      if (movementType == 'ground' && actorHasPerk(this, PROWL_ID) && hasActiveEnvironmentalExpertise(this)) {
        system.movement.ground.total *= 2;
      }

      // Wire Work - see WIRE_WORK_ID's own comment above. Overrides the default half-Ground climb
      // speed just computed above, the same "last word on this movement type's own total" shape
      // Bulwark's own zeroing-out already uses.
      if (movementType == 'climb' && actorHasPerk(this, WIRE_WORK_ID)) {
        system.movement.climb.total = system.movement.ground.total;
      }

      // Amphibious Assault (Quartermaster's Guide to Gear, Freebooter Focus, Renegade, 1st level,
      // p.24): "You gain an Aquatic Movement equal to your Ground Movement. If you already have
      // an Aquatic Movement, or gain one from another source, increase the better Aquatic
      // Movement option by 15ft." Same "last word on this movement type's own total" shape as
      // Wire Work just above - "already have Aquatic Movement" is read off the base value (before
      // this Perk's own contribution), the same way Wire Work reads a pre-existing Climb base
      // being nonzero elsewhere in this project. The Initiative Edge half ("while using your
      // Aquatic Movement") needs an "am I currently in the water" concept this codebase doesn't
      // track anywhere - correctly left unbuilt, the same environment-tracking gap Feet Wet's own
      // clause hits.
      if (movementType == 'swim' && actorHasPerk(this, AMPHIBIOUS_ASSAULT_ID)) {
        system.movement.swim.total = system.movement.swim.base > 0
          ? Math.max(system.movement.swim.total, system.movement.ground.total) + 15
          : system.movement.ground.total;
      }

      // Warrior Rush (Wrecker Focus, 1st level, p.92): "On the first turn of combat, double your
      // Movements until the beginning of your next turn." Approximated as "for the whole first
      // round" rather than tracking whose specific turn it is (this system has no per-actor
      // "was it your turn yet this round" check outside dice.mjs's own combat-modifier functions,
      // and derived data like this has no roll/target context to hook one in with) - the same
      // round-granularity simplification Who Dares Wins/Alpha Strike already use for "until my
      // next turn" clauses.
      if (game.combat?.round == 1 && actorHasPerk(this, WARRIOR_RUSH_ID)) {
        system.movement[movementType].total *= 2;
      }

      // Rush the Line - see RUSH_THE_LINE_ID's own comment above. Ground Movement only (this
      // system's own default "Movement" stat), same reading Power Adaptation's own "+20 feet"
      // clause already uses.
      if (movementType == 'ground' && actorHasPerk(this, RUSH_THE_LINE_ID) && isRushTheLineActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // Frictionless Movement - see FRICTIONLESS_MOVEMENT_ID's own comment above. Every Movement
      // type, unlike Rush the Line's own ground-only check just above.
      if (actorHasPerk(this, FRICTIONLESS_MOVEMENT_ID) && isFrictionlessMovementActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // The Tough Get Going (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
      // helpers/the-tough-get-going.mjs's own doc comment. Same round-scoped doubling shape as
      // Warrior Rush/Rush the Line just above.
      if (movementType == 'ground' && isTheToughGetGoingActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // Thunderous Advance (GI Joe CRB, Mechanized Infantry Focus, 7th level, p.81, built
      // 2026-09-12): "While piloting a vehicle, its Movement increases by 15 feet in combat, and
      // 20% out of combat." Held by the DRIVER, applied to the VEHICLE's own movement - checked
      // here on `this` (the vehicle) by resolving its own crew map directly (the same
      // fromUuidSync(entry.uuid) idiom _prepareMegaformZordData already establishes) rather than
      // dice.mjs's private, Dice-class-only _getPilotedVehicle. RAW doesn't scope this to ground
      // only, unlike Power Adaptation's own "+20 feet" - applied to every movement type, the same
      // "every type" reading Frictionless Movement's own unscoped clause already uses.
      if (this.type == 'vehicle') {
        const driverEntry = Object.values(this.system?.actors ?? {}).find(crew => crew.vehicleRole == 'driver');
        const driver = driverEntry ? fromUuidSync(driverEntry.uuid) : null;
        if (driver && actorHasPerk(driver, THUNDEROUS_ADVANCE_ID)) {
          system.movement[movementType].total += game.combat ? 15 : Math.round(system.movement[movementType].total * 0.2);
        }
      }

      // Bulwark - see BULWARK_ID's own comment above. Overrides every movement type to 0 while
      // planted, the last word on this movement type's own total for this pass.
      if (actorHasPerk(this, BULWARK_ID) && isBulwarkActive(this)) {
        system.movement[movementType].total = 0;
      }

      // Power Adaptation - Boost of Speed (Across the Stars, Silver Ranger, 9th/18th level,
      // p.57) - see helpers/power-adaptation.mjs's own doc comment. "Increase Movement by 20
      // feet" is read as the ground Movement specifically (this system's default "Movement"
      // stat), same reasoning Warrior Rush's own doubling above already applies broadly instead.
      if (movementType == 'ground' && isPowerAdaptationActive(this, 'boostOfSpeed')) {
        system.movement[movementType].total += 20;
      }

      // Over the Candlestick - Innate Climber (Technorganic Secrets, Climber/Nimble Origin
      // Benefit, p.38) - see OVER_THE_CANDLESTICK_ID's own comment in dice.mjs. "You gain a 40
      // feet Climb Movement while in your Alt Mode," gated on the actor having actually chosen
      // this option (hasChoice picker, `system.choice`) rather than Agile Reflexes. A flat SET,
      // not an addition - overrides the generic "half of Ground" climb fallback just above, the
      // same "last word on this movement type's own total" shape Wire Work/Natural Movement
      // already use for their own Climb grants.
      if (movementType == 'climb' && this.system.isTransformed
        && findPerk(this, OVER_THE_CANDLESTICK_ID)?.system.choice == 'innateClimber') {
        system.movement[movementType].total = 40;
      }

      // Sprinter - see SPRINTER_ID's own comment above. "+20ft Alt Mode Ground Movement," Alt Mode
      // gated (replacing the item's own now-disabled unconditional compendium effect).
      if (movementType == 'ground' && this.system.isTransformed && actorHasPerk(this, SPRINTER_ID)) {
        system.movement[movementType].total += 20;
      }

      // Sprinter's own once/scene Movement double - see helpers/sprinter-boost.mjs's own doc
      // comment. Ground only, unlike Frictionless Movement's own every-type doubling.
      if (movementType == 'ground' && actorHasPerk(this, SPRINTER_ID) && isSprinterBoostActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // Sprinter (Transformers One) - see TF1S_SPRINTER_ID's own comment above. +5ft Bot Mode
      // Ground Movement only.
      if (movementType == 'ground' && !this.system.isTransformed && actorHasPerk(this, TF1S_SPRINTER_ID)) {
        system.movement[movementType].total += 5;
      }

      // Skier - see SKIER_ID's own comment above. Same "flag alone isn't enough" defense-in-depth
      // check Bulwark's own toggle already uses.
      if (movementType == 'ground' && actorHasPerk(this, SKIER_ID) && isSkiing(this)) {
        system.movement[movementType].total += 10;
      }

      // Field Aid - see helpers/field-aid.mjs's own doc comment.
      if (movementType == 'ground' && actorHasPerk(this, FIELD_AID_ID) && hasNearbyDefeatedAlly(this)) {
        system.movement[movementType].total += 10;
      }

      // Engine Override (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.72) - see
      // helpers/engine-override.mjs's own doc comment. +15ft Ground Movement to whichever vehicle
      // this was activated on - checked on THIS actor directly (not gated on actorHasPerk, since
      // the flag lives on the boosted vehicle, not the Perk holder).
      if (movementType == 'ground' && isEngineOverrideBoostActive(this)) {
        system.movement[movementType].total += 15;
      }

      // Hup! Hup! Hup! Hup! Hup! - see helpers/hup-hup-hup-hup-hup.mjs's own doc comment. Checked
      // directly on THIS actor, not gated on actorHasPerk - the flag lives on the boosted ally,
      // not the Officer who granted it, same shape as Engine Override's own +15ft grant above.
      if (movementType == 'ground') {
        system.movement[movementType].total += getHupHupHupHupHupBonus(this);
      }

      // Jury Rig - Engine Turbo-Boost / Watertight Seals (Factions in Action Vol. 2, Engineer
      // Troop Focus, 17th level, p.73) - see helpers/jury-rig.mjs's own doc comment. Both grant
      // "an Aerial/Aquatic Movement equal to its Ground Movement" - same override shape as Wisdom
      // of the Elders' identical Lightfoil Wings clause, checked on THIS actor directly (the flag
      // lives on the boosted vehicle, not the Engineer who granted it). Read ground's own .base +
      // .bonus rather than .total for the same reason Lightfoil Wings does - movementTypes
      // processes aerial/ground/climb/swim in that order, so ground's own .total isn't finalized
      // yet at this point in the loop.
      if (movementType == 'aerial' && isJuryRigBenefitActive(this, 'engineTurboBoost')) {
        system.movement.aerial.total = system.movement.ground.base + system.movement.ground.bonus;
      }

      if (movementType == 'swim' && isJuryRigBenefitActive(this, 'watertightSeals')) {
        system.movement.swim.total = system.movement.ground.base + system.movement.ground.bonus;
      }

      // Swiftness (Quartermaster's Guide to Gear, Grid Power, p.94) - see
      // helpers/swiftness.mjs's own doc comment. +20ft to whichever of ground/aerial was chosen
      // at activation, same live-override shape as Boost of Speed just above.
      if (movementType == 'ground' || movementType == 'aerial') {
        system.movement[movementType].total += getSwiftnessBonusFeet(this, movementType);
      }

      // Eltarian Training (Through the Shattered Grid, General Perk, p.73): "+10 Ground
      // Movement" - a plain flat bonus, same shape as Boost of Speed's own +20 just above.
      if (movementType == 'ground' && actorHasPerk(this, ELTARIAN_TRAINING_ID)) {
        system.movement[movementType].total += 10;
      }

      // Wisdom of the Elders - Lightfoil Wings (Through the Shattered Grid, Guardian of Eltar,
      // 9th/18th level, p.72): "Gain an Aerial Movement equal to your Ground Movement" while
      // active. movementTypes processes 'aerial' before 'ground' in this same loop, so ground's
      // own .total isn't finalized yet at this point (and reading it after processing 'ground'
      // instead would mean OVERWRITING whatever aerial-specific doubling/bonus this same loop
      // already applied to aerial.total earlier in its own pass) - computed directly from ground's
      // own base/bonus/morphed inputs instead, deliberately not including any other Perk's
      // per-movement-type bonus (Warrior Rush's doubling, Boost of Speed's own +20, etc.), the
      // same "closest deterministic approximation" idiom this project uses wherever true
      // computation order would otherwise conflict.
      if (movementType == 'aerial' && isWisdomOfTheEldersActive(this, 'lightfoilWings')) {
        system.movement.aerial.total = system.movement.ground.base + system.movement.ground.bonus
          + (system.isMorphed ? system.movement.ground.morphed : 0);
      }

      // Animal Gait - see ANIMAL_GAIT_ID's own comment above / helpers/animal-gait.mjs. Same
      // aerial-before-ground ordering wrinkle Lightfoil Wings already hit (computed from ground's
      // own base/bonus/morphed inputs, not .total, when the chosen type is 'aerial'); climb/swim
      // both process after ground in this same loop, so reading ground.total directly is safe for
      // those two, same as Wire Work's own identical Climb-copy-Ground clause.
      if (movementType == getAnimalGaitType(this)) {
        system.movement[movementType].total = movementType == 'aerial'
          ? system.movement.ground.base + system.movement.ground.bonus + (system.isMorphed ? system.movement.ground.morphed : 0)
          : system.movement.ground.total;
      }

      // Mobile Mode (Through the Shattered Grid, Grid Power, p.26): "gain that type of Movement at
      // 30 feet" while active and Morphed - a floor, not a reduction, if the actor already has more
      // of that movement type some other way. See helpers/mobile-mode.mjs's own doc comment for why
      // the movement type is picked fresh at each activation rather than a permanent build-time
      // choice.
      if (system.isMorphed && movementType == getMobileModeType(this)) {
        system.movement[movementType].total = Math.max(system.movement[movementType].total, 30);
      }

      // Fluttery Wings (MLP CRB, Elementary Aid spell, p.136) - see
      // helpers/fluttery-wings.mjs's own doc comment. +15ft Aerial Movement while active.
      if (movementType == 'aerial') {
        system.movement.aerial.total += getFlutteryWingsBonus(this);
      }

      // Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
      // helpers/hot-to-trot.mjs's own doc comment. "Move 15ft further with each Movement action" -
      // read as ground Movement (the spell's own flavor text, "quickly catch up to a friend
      // across town," points at ordinary ground travel, not flight).
      if (movementType == 'ground' && isHotToTrotActive(this)) {
        system.movement.ground.total += 15;
      }

      // Quantum Master - see QUANTUM_MASTER_ID's own comment above. Applied after every other
      // addend above (Warrior Rush's own doubling included, in the unlikely case an actor somehow
      // held both), matching "double all Movement values" as the final multiplier on the total.
      if (system.isMorphed && actorHasPerk(this, QUANTUM_MASTER_ID)) {
        system.movement[movementType].total *= 2;
      }

      // Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139) - see
      // helpers/lightning-speed.mjs's own doc comment. "Doubles all Movement rates" while active -
      // applied last, same final-multiplier shape as Quantum Master just above (not gated on
      // isMorphed, unlike Quantum Master - RAW states no such qualifier here).
      if (isLightningSpeedActive(this)) {
        system.movement[movementType].total *= 2;
      }
    }

    if (!movementTotal) {
      system.movementNotSet = true;
    }
  }

  /**
   * Prepares Sorcerous Power
   */
  _prepareSorcerousPower() {
    const system = this.system;
    const levelMultiplier = system.level - system.powers.sorcerous.levelTaken;
    if (system.powers.sorcerous.levelTaken) {
      system.powers.sorcerous.max = (levelMultiplier * 2) + 4;
    } else {
      system.powers.sorcerous.max = 0;
    }
  }

  /**
   * Prepare Resource (from Role Points) type specific data.
   */
  _prepareResource() {
    const rolePoints = this._getBaseRolePoints();
    if (rolePoints) {
      this.system.useUnlimitedResource = rolePoints.system.resource.level20ValueIsUnlimited && this.system.level == 20;
    }
  }

  /**
  * Prepare Poison and Toxin Training and Qualifications
  */
  _preparePoisonTraining() {
    const system = this.system;
    for (const key of Object.keys(system.trained.poisons)) {
      system.trained.poisons[key] = false;
    }

    for (const key of Object.keys(system.trained.toxins)) {
      system.trained.toxins[key] = false;
    }

    for (const key of Object.keys(system.qualified.poisons)) {
      system.qualified.poisons[key] = false;
    }

    if (system.poisonTraining >= 5) {
      system.trained.toxins.all = true;
      system.trained.toxins.standard = true;
      system.trained.toxins.limited = true;
    }

    if (system.poisonTraining >= 4) {
      system.qualified.poisons.all = true;
    }

    if (system.poisonTraining >= 3) {
      system.qualified.poisons.limited = true;
    }

    if (system.poisonTraining >= 2) {
      system.qualified.poisons.standard = true;
    }

    if (system.poisonTraining >= 1) {
      system.trained.poisons.all = true;
      system.trained.poisons.standard = true;
      system.trained.poisons.limited = true;
    }
  }

  /**
   * A Megaform's combined-stat rules differ by subtype: Power Rangers-style Megazords
   * (subtype "megaformZord") follow the Combiner Feature rules, while Transformers-style
   * Gestalt/Matched Combiners (subtype "megaformCombiner") follow a different set of rules
   * entirely. system.subtype is an ArrayField bound to a single <select>, so treat it as
   * holding at most one value; default to the Zord rules if nothing's been chosen yet, since
   * that's this field's own schema default and existing Megaform actors predate this subtype
   * distinction.
   */
  _prepareMegaformData() {
    if (this.system.subtype.includes('megaformCombiner')) {
      this._prepareMegaformCombinerData();
    } else {
      this._prepareMegaformZordData();
    }
  }

  /**
   * Computes a Power Rangers Megazord's combined stats from its linked Zords (system.actors)
   * and each linked Zord's chosen Megaform Trait items, per the Combiner Feature rules:
   * - Strength/Speed = highest among participants, capped at 15, plus any Core Ability bonuses.
   * - Toughness/Evasion = 10 + the aggregated Essence + a base +3 Armor bonus, plus any
   *   Core Defenses bonuses (which apply to both).
   * - Ground Movement = the slowest participant's, plus whatever a Move trait adds.
   * - Health is NOT combined into one pool; each participant keeps its own, so this instead
   *   prepares a per-participant breakdown (system.participantHealth) and a combined display
   *   total (system.combinedHealthMax/Value, doubling a participant's contribution if it has
   *   Core Body), plus a Defeat flag once more than half the participants are at 0 Health.
   * Only Enhanced Melee/Ranged Attack traits are surfaced as a flag (system.hasEnhancedAttack)
   * rather than fully automated, since synthesizing the resulting attack isn't well-defined
   * without the participants' own weapon data being structured for that.
   */
  _prepareMegaformZordData() {
    const system = this.system;
    const BASE_ARMOR_BONUS = 3;
    const MAX_ESSENCE = 15;

    const participants = Object.values(system.actors)
      .map(entry => fromUuidSync(entry.uuid))
      .filter(actor => actor?.type == 'zord');

    system.participantHealth = participants.map(zord => ({
      name: zord.name,
      value: zord.system.health.value,
      max: zord.system.health.max,
    }));

    if (!participants.length) {
      system.isDefeated = false;
      system.combinedHealthMax = 0;
      system.combinedHealthValue = 0;
      system.hasEnhancedAttack = false;

      return;
    }

    // The Strength/Speed/Defenses/Movement/Armor fields below are all computed from the
    // linked Zords, so the sheet should show them read-only rather than letting a GM edit
    // values that will just be recalculated away on the next render.
    system.movementIsReadOnly = true;

    let strength = Math.max(...participants.map(zord => zord.system.essences.strength.value));
    let speed = Math.max(...participants.map(zord => zord.system.essences.speed.value));

    // The Megaform only has a basic Ground Movement type unless a Move trait grants
    // another; set that baseline now so the Move trait loop below can add to it.
    for (const movementType of Object.keys(system.movement)) {
      system.movement[movementType].base = 0;
    }

    system.movement.ground.base = Math.min(...participants.map(
      zord => zord.system.movement.ground.total || zord.system.movement.ground.base,
    ));

    let toughnessTraitBonus = 0;
    let evasionTraitBonus = 0;
    let hasEnhancedAttack = false;
    let combinedHealthMax = 0;
    let combinedHealthValue = 0;

    for (const zord of participants) {
      const hasCoreBody = zord.items.some(
        item => item.type == 'megaformTrait' && item.system.type == 'coreBody',
      );
      const healthMultiplier = hasCoreBody ? 2 : 1;
      combinedHealthMax += zord.system.health.max * healthMultiplier;
      combinedHealthValue += Math.max(0, zord.system.health.value) * healthMultiplier;

      for (const item of zord.items) {
        if (item.type != 'megaformTrait') {
          continue;
        }

        switch (item.system.type) {
        case 'coreAbility':
          if (item.system.essence == 'strength') {
            strength += item.system.value;
          } else if (item.system.essence == 'speed') {
            speed += item.system.value;
          }

          break;
        case 'coreDefenses':
          toughnessTraitBonus += item.system.value;
          evasionTraitBonus += item.system.value;
          break;
        case 'move':
          system.movement[item.system.movementType].base += item.system.value;
          break;
        case 'enhancedMeleeAttack':
        case 'enhancedRangedAttack':
          hasEnhancedAttack = true;
          break;
        }
      }
    }

    system.essences.strength.value = Math.min(MAX_ESSENCE, strength);
    system.essences.speed.value = Math.min(MAX_ESSENCE, speed);
    system.armor = BASE_ARMOR_BONUS;
    system.defenses.toughness.value = 10 + system.essences.strength.value + BASE_ARMOR_BONUS + toughnessTraitBonus;
    system.defenses.evasion.value = 10 + system.essences.speed.value + evasionTraitBonus;

    for (const movementType of Object.keys(system.movement)) {
      system.movement[movementType].total = system.movement[movementType].base;
    }

    system.hasEnhancedAttack = hasEnhancedAttack;
    system.combinedHealthMax = combinedHealthMax;
    system.combinedHealthValue = combinedHealthValue;

    const defeatedCount = participants.filter(zord => zord.system.health.value <= 0).length;
    system.isDefeated = defeatedCount > participants.length / 2;
  }

  /**
   * Computes a Transformers Gestalt/Matched Combiner's combined stats from its linked
   * component actors (system.actors - full characters, not Zords), per the Combiner rules:
   * - Size Class: a duo/trio (2-3 components) is one Size Class larger than its largest
   *   component; a Gestalt (4+ components) is Towering, or Titanic if any component is
   *   Gigantic or larger.
   * - Health is NOT combined into one pool (system.participantHealth breakdown, same as a
   *   Megazord, but with no Core Body-style doubling - Combiners don't have that feature).
   * - Strength/Speed/Smarts/Social = highest among components, setting base Defenses; for
   *   each Essence, the component that contributed the highest score for it also contributes
   *   its ranks in that Essence's Skills to the combined form.
   * - Toughness/Evasion get the LOWEST armor bonus among components (not highest) - NPC
   *   components without a granular armor bonus field are treated as contributing +0.
   * - Movement uses the slowest rate per type among components' current (Bot Mode) movement.
   * - Combiner Features (reusing the same megaformTrait items/types as a Megazord's Megaform
   *   Traits, since the book doesn't define a distinct set of Combiner Feature types) always
   *   apply. Ordinary Role/General Perks are NOT auto-applied - the book says only "specifically
   *   noted" ones carry over, which isn't a flag this system tracks generically.
   * - The base Energon Point pool is half of system.energonSpentToMerge (rounded up) - a
   *   GM-entered value, since how much was actually spent depends on in-combat choices
   *   (Matched vs. Gestalt cost, Story Point substitutions, NPCs joining) this system doesn't
   *   otherwise track.
   * - Attacks (unarmed strike, ranged Hardpoint attacks) aren't synthesized, for the same
   *   reason a Megazord's Enhanced Attacks aren't: it isn't well-defined without the
   *   components' own weapon data being structured for it.
   */
  _prepareMegaformCombinerData() {
    const system = this.system;
    const MAX_ESSENCE = 15;
    const sizeOrder = Object.keys(CONFIG.E20.actorSizes);
    const giganticIndex = sizeOrder.indexOf('gigantic');

    const participants = Object.values(system.actors)
      .map(entry => fromUuidSync(entry.uuid))
      .filter(actor => actor?.type && actor.type != 'zord' && actor.type != 'vehicle' && actor.type != 'megaform');

    system.participantHealth = participants.map(component => ({
      name: component.name,
      value: component.system.health.value,
      max: component.system.health.max,
    }));

    if (!participants.length) {
      system.isDefeated = false;
      system.combinedHealthMax = 0;
      system.combinedHealthValue = 0;
      system.hasEnhancedAttack = false;

      return;
    }

    system.movementIsReadOnly = true;

    // Size Class: one larger than the largest component for a duo/trio, or Towering/Titanic
    // for a Gestalt (4+ components).
    const largestComponentIndex = Math.max(
      ...participants.map(component => Math.max(0, sizeOrder.indexOf(component.system.size))),
    );
    if (participants.length <= 3) {
      system.size = sizeOrder[Math.min(sizeOrder.length - 1, largestComponentIndex + 1)];
    } else {
      const hasGiganticOrLarger = participants.some(
        component => sizeOrder.indexOf(component.system.size) >= giganticIndex,
      );
      system.size = hasGiganticOrLarger ? 'titanic' : 'towering';
    }

    // Essences + the Skills tied to whichever component contributed each Essence's high score.
    for (const essence of ['strength', 'speed', 'smarts', 'social']) {
      let winner = participants[0];
      for (const component of participants) {
        if (component.system.essences[essence].value > winner.system.essences[essence].value) {
          winner = component;
        }
      }

      system.essences[essence].value = Math.min(MAX_ESSENCE, winner.system.essences[essence].value);

      for (const skill of CONFIG.E20.skillsByEssence[essence] ?? []) {
        if (winner.system.skills[skill] && system.skills[skill]) {
          system.skills[skill] = foundry.utils.deepClone(winner.system.skills[skill]);

          // Better as One (Component Ace Focus, 10th level, p.34): "any Skill Specializations
          // you possess are also applied to the Skills of a Combiner form you are a component
          // of." A holder's own Specializations in this skill are merged in even when they
          // weren't the essence's high-score "winner" above (whose own Specializations were
          // already carried over by the deepClone just above).
          for (const component of participants) {
            if (component === winner || !actorHasPerk(component, BETTER_AS_ONE_ID)) {
              continue;
            }

            const specializations = component.system.skills[skill]?.specializations;
            if (specializations) {
              system.skills[skill].specializations = {
                ...system.skills[skill].specializations,
                ...foundry.utils.deepClone(specializations),
              };
            }
          }
        }
      }
    }

    // Defenses get the LOWEST armor bonus among components, not the highest - NPCs and other
    // actor types without a granular defense.armor field contribute +0.
    for (const defenseType of ['toughness', 'evasion']) {
      const armorBonus = Math.min(
        ...participants.map(component => component.system.defenses?.[defenseType]?.armor ?? 0),
      );
      system.defenses[defenseType].value = 10 + system.essences[
        defenseType == 'toughness' ? 'strength' : 'speed'
      ].value + armorBonus;

      if (defenseType == 'toughness') {
        system.armor = armorBonus;
      }
    }

    // Movement: slowest rate per type among components' current (Bot Mode) movement.
    // .total is only actively (re)computed for playerCharacter actors (_prepareMovement() is
    // gated to that type), so an NPC component's .total can be stale; fall back to .base for
    // those, same as a Megazord falls back to a Zord's .base.
    for (const movementType of Object.keys(system.movement)) {
      const rates = participants
        .map(component => {
          const move = component.system.movement?.[movementType];
          return move?.total || move?.base;
        })
        .filter(rate => rate);
      system.movement[movementType].base = rates.length ? Math.min(...rates) : 0;
      system.movement[movementType].total = system.movement[movementType].base;
    }

    // Combiner Features always apply - reusing the same megaformTrait items as a Megazord's
    // Megaform Traits (see the class comment above for why).
    let toughnessTraitBonus = 0;
    let evasionTraitBonus = 0;
    for (const component of participants) {
      for (const item of component.items) {
        if (item.type != 'megaformTrait') {
          continue;
        }

        switch (item.system.type) {
        case 'coreAbility':
          if (['strength', 'speed', 'smarts', 'social'].includes(item.system.essence)) {
            system.essences[item.system.essence].value = Math.min(
              MAX_ESSENCE, system.essences[item.system.essence].value + item.system.value,
            );
          }

          break;
        case 'coreDefenses':
          toughnessTraitBonus += item.system.value;
          evasionTraitBonus += item.system.value;
          break;
        case 'move':
          system.movement[item.system.movementType].base += item.system.value;
          system.movement[item.system.movementType].total = system.movement[item.system.movementType].base;
          break;
        }
      }
    }

    system.defenses.toughness.value += toughnessTraitBonus;
    system.defenses.evasion.value += evasionTraitBonus;

    // Base Energon Point pool = half the Energon spent to merge, rounded up.
    system.energon.normal.max = Math.ceil(system.energonSpentToMerge / 2);

    system.hasEnhancedAttack = false;
    system.combinedHealthMax = participants.reduce((sum, component) => sum + component.system.health.max, 0);
    system.combinedHealthValue = participants.reduce(
      (sum, component) => sum + Math.max(0, component.system.health.value), 0,
    );

    const defeatedCount = participants.filter(component => component.system.health.value <= 0).length;
    // Keep it Together! (Component Ace Focus, 17th level, p.34): "a combined form you are
    // merged with will not fall apart as long as you still have Health" - overrides the normal
    // majority-defeated rule entirely while ANY component holding the Perk is still above 0
    // Health, regardless of how many other components have fallen.
    const hasKeepItTogetherHolderStanding = participants.some(
      component => component.system.health.value > 0 && actorHasPerk(component, KEEP_IT_TOGETHER_ID),
    );
    system.isDefeated = !hasKeepItTogetherHolderStanding && defeatedCount > participants.length / 2;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    const initSkill = data.initiative.skill;
    const initiativeFormula = data.skills[initSkill].shift == 'd20' ? 'd20' : `d20 + ${data.skills[initSkill].shift}`;
    data.initiativeFormula = `${initiativeFormula} + ${data.skills[initSkill].modifier}`;
  }

  /**
   * Perform a skill roll.
   */
  rollSkill(dataset) {
    this._dice.rollSkill(dataset, this);
  }

  /**
   * Updates the information on the parent Item when a child Item is updated.
   * @override
   */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    // This syncs a child Item's data back into its granting parent Item's system.items map
    // entry (e.g. a weaponEffect/upgrade's name or system fields, mirroring item.mjs's own
    // _onUpdate) - it only makes sense for "items" collection changes, where change._id is an
    // Item id looked up via parent.items.get(...) below. A June 2025 refactor (1034cb88) turned
    // this guard's `if (collection != "effects") { <loop> }` into an early return before the
    // loop, but kept the same `!=` comparison instead of flipping it to `==` - inverting which
    // collection the loop actually ran for. That went unnoticed because collection == "effects"
    // silently no-op'd every time (change._id is an ActiveEffect id, never a real Item id, so
    // fullItem was always undefined) - until parent stopped always being this Actor (e.g. an
    // effect embedded directly on an Item), at which point parent.items is undefined and this
    // throws instead of quietly returning.
    if (collection == "effects") {
      return;
    }

    for (const change of changes) {
      const fullItem = parent.items.get(change._id);
      if (!fullItem) {
        return;
      }

      const parentId = fullItem.getFlag('essence20', 'parentId');
      const parentItem = parent.items.get(parentId);

      if (!parentItem) {
        return;
      }

      const key = fullItem.getFlag('essence20', 'collectionId');
      if (change.system) { // Handle system fields
        for (const [name, value] of Object.entries(change.system)){
          const updateString = `system.items.${key}.${name}`;
          parentItem.update({
            [updateString]: value,
          });
        }
      }

      for (const [name, value] of Object.entries(change)) {
        if (name == "name" || name == "img") {
          const updateString = `system.items.${key}.${name}`;
          parentItem.update({
            [updateString]: value,
          });
        }
      }
    }
  }

  /**
   * Helper for calling onMorph() for TAH
   */
  morph() {
    onMorph(this);
  }

  /**
   * Helper for calling onTransformUuid() for TAH
   */
  transform(altModeUuid=null) {
    onTransformUuid(this, altModeUuid);
  }
}
