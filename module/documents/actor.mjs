import { Dice } from "../dice.mjs";
import { E20 } from "../helpers/config.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { getNumActions, resizeTokens } from "../helpers/actor.mjs";
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
import { getHissColumnBonus } from "../helpers/allies.mjs";
import { actorHasZordFeature } from "../helpers/zord-features.mjs";

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

const PR_CRB = "Compendium.essence20.pr_crb.Item.";
// Light Chassis (PR CRB, Zord Feature, p.137): "increases the Zord's Speed by 1 and adds 10 feet
// [to] one of the Zord's movement types" (both a static compendium Active Effect already) "...
// While in a Combined Megaform, it grants ↑1 to the Megaform's Initiative Skill Test." That
// second clause is the Megaform's own gain, not the Zord's, so it can't be a static Active Effect
// on the Zord (nothing there could reach the Megaform) - checked per-participant in
// _prepareMegaformZordData/_prepareMegaformCombinerData below, same "Feature on a participant,
// consumed via a Megaform-only flag" shape Enhanced Initiative (a megaformTrait, not a Feature)
// already established for hasEnhancedInitiative; the actual ↑1 is applied in dice.mjs's
// prepareInitiativeRoll, alongside that same flag's own Edge check.
const LIGHT_CHASSIS_ID = `${PR_CRB}rVW7mvnV4MbGuxoq`;
// Hardened Chassis (PR CRB, Zord Feature, p.139): "increases its Strength score by 1, it adds +2
// to its Armor bonus to Toughness as well [both a static Active Effect already] ... While in a
// Combined Megaform, it adds +1 to the Megaform's Armor bonus to Toughness." Same shape as Light
// Chassis above - the Megaform-facing clause folds straight into the existing toughnessTraitBonus
// local variable below, the same aggregate Defender/Core Defenses already feed into
// system.defenses.toughness.armor.
const HARDENED_CHASSIS_ID = `${PR_CRB}7vwrFKj2UAxG4ocf`;
import { createId } from "../helpers/utils.mjs";

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
      // game.items.fromCompendium() is exactly what Foundry's own drag-drop path runs a compendium
      // item through, so an auto-added Feature ends up identical to a hand-dropped one. This used
      // to hand-build the item data from name/type/img/system, which silently dropped two things:
      // the item's own Active Effects, and _stats.compendiumSource - the provenance
      // helpers/zord-features.mjs#actorHasZordFeature matches Features by. Both of these Features
      // were therefore invisible to every sourceId-based check, and would have quietly lost any
      // effect added to them in the compendium later.
      const newItems = [];
      for (const uuid of [CALL_TO_ACTION_ID, RECALL_FOR_REPAIRS_ID]) {
        const source = await fromUuid(uuid);
        // A missing entry must not make Zords uncreatable: with the pack unbuilt or an id renamed,
        // this previously threw "Cannot read properties of null" straight out of _preCreate, which
        // aborts actor creation entirely with no usable explanation.
        if (!source) {
          console.warn(`essence20 | Zord Feature ${uuid} could not be found - skipping auto-add.`);
          continue;
        }

        newItems.push(game.items.fromCompendium(source));
      }

      if (newItems.length) {
        this.updateSource({ items: newItems });
      }
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

    // Megaform's own aggregate Combiner-rules math (Essence values, each Defense's own `base`
    // and trait bonuses, each Movement type's own `base`, and `health.origin`) has to run BEFORE
    // the shared Defenses/Health/Movement pass below, which folds .bonus/armor/shield/Perks on
    // top of whatever base it just computed from the Megaform's linked participants.
    if (this.type == 'megaform') {
      this._prepareMegaformData();
    }

    // Every actor type now shares the same computed Defenses/Health/Movement pipeline a
    // playerCharacter always has - see project_essence20_active_effects memory for why this was
    // held off until now. Each method already degrades gracefully where an actor has no Origin/
    // RolePoints Items or isMorphed/isTransformed fields (every non-PC type).
    this._prepareDefenses();
    this._prepareHealth();
    this._prepareMovement();

    if (this.type == 'playerCharacter') {
      this._prepareSorcerousPower();
      this._prepareResource();
      this._preparePoisonTraining();
      this._prepareFireproofResistance();
    }

    if (this.type == 'vehicle') {
      this._prepareVehicleData();
    }

    // Load Out (hands carried vs the six-hand limit) and Hardpoint allocation. Only the two
    // types that carry equipment personally - a vehicle or Megaform has no hands to fill.
    if (this.type == 'playerCharacter' || this.type == 'npc') {
      this._prepareLoadout();
    }

    // Deliberately last, and deliberately not folded into any of the methods above: action
    // budgets are their own small, self-contained pass with no dependency on the Defenses/Health/
    // Movement math.
    this._prepareActions();
  }

  /**
   * Per-turn action budgets, derived from the Speed Essence exactly as the rules define them
   * (GI Joe CRB p.192-193, and the Combat Flow reference sheet):
   *
   *   Speed 1   Move OR Standard - one or the other, then the turn ends.
   *   Speed 2   Move AND Standard. (The Standard may be traded for two Free actions.)
   *   Speed 3+  Move, one Standard, and Speed - 2 Free actions.
   *
   * So Free actions are NOT unlimited - a Speed 3 character gets exactly one, and a Speed 1 or 2
   * character gets none by default. Speed 1's "one or the other" is carried by `shared`, which
   * helpers/action-economy.mjs#getRemaining reads to zero BOTH categories once either is spent.
   *
   * An actor type with no Essences at all (nothing on the common template guarantees them - see
   * data/actor/templates/character.mjs, machine.mjs and zord-base.mjs, which each declare their
   * own) falls back to the Speed 2 shape, the ordinary one-Move-one-Standard turn.
   *
   * Runs in prepareDerivedData (i.e. after Active Effects have applied), which is what lets
   * "You gain an additional Standard action each turn" (CRB p.81) be a plain AE change on
   * system.actions.standard.bonus instead of needing its own helper file.
   *
   * The clamp is where cantTakeFreeActions and cantTakeMoveActions finally do something. Both have
   * existed in E20.statusEffects since the MLP CRB Laughtracting/Distraughter Perks were built,
   * with their own config.mjs comments noting there was no action economy to gate against; there
   * is now. Only those two purpose-built Conditions and the three incapacitating ones are read
   * here - Immobilized, Grappled and Restrained all restrict MOVEMENT DISTANCE rather than denying
   * the Move action itself, and inventing a rule for them isn't this method's job.
   */
  _prepareActions() {
    const actions = this.system.actions;
    if (!actions) {
      return;
    }

    /* The per-Speed counts come from helpers/actor.mjs#getNumActions, which already existed to
       drive the sheet's own "1M, 1S, 1F" readout. Deriving them a second time here was a mistake:
       it silently disagreed with that readout for any actor whose Speed .max and .value differ,
       and for the Perks that move Free actions off Speed entirely (Quick Thinker and University
       Days source them from Smarts instead). One source of truth, and both displays now agree.

       The one deliberate difference is Speed 1. getNumActions reports it as one Move and zero
       Standards, but the rules say "Move OR Standard action... then ends their turn" (CRB p.193) -
       a choice, not a fixed Move. Both budgets are granted and `shared` makes them mutually
       exclusive, which helpers/action-economy.mjs#getRemaining honours. */
    const speedEssence = this.system.essences?.speed;
    // getNumActions reads system.essences.speed without guarding, which is safe for every actor
    // type the system registers (all six get Essences from character.mjs, machine.mjs or
    // zord-base.mjs) but not for a partially-built actor. Falling back to the ordinary
    // one-Move-one-Standard turn keeps derived data from throwing on one.
    const counts = speedEssence
      ? getNumActions(this)
      : { free: 0, movement: 1, standard: 1 };
    const speed = speedEssence?.max ?? speedEssence?.value ?? 2;
    actions.shared = speed <= 1;

    const base = {
      standard: actions.shared ? 1 : counts.standard,
      move: counts.movement,
      free: counts.free,
    };

    const statuses = this.statuses ?? new Set();
    const incapacitated = ['asleep', 'defeated', 'unconscious'].some(status => statuses.has(status));
    const zeroed = {
      free: incapacitated || statuses.has('cantTakeFreeActions'),
      move: incapacitated || statuses.has('cantTakeMoveActions'),
      standard: incapacitated,
    };

    for (const category of Object.keys(E20.actionCategories)) {
      const budget = actions[category];
      if (!budget) {
        continue;
      }

      budget.base = base[category];
      budget.max = zeroed[category] ? 0 : Math.max(0, budget.base + budget.bonus);
    }
  }

  /**
   * Defeat of a Vehicle (GI Joe CRB, p.214): "The vehicle is considered to have all Movement
   * types reduced to 0 until repaired." Read-only + zeroed the same way _prepareMegaformData()
   * already displays a computed-not-edited Movement (system.movementIsReadOnly) - the real
   * system.movement.<type>.total this Vehicle's sheet directly edits is left untouched
   * underneath, so clearing system.crashed (repairing it) needs nothing further to restore.
   *
   * Crew (GI Joe CRB, p.212): "Drivers must have a d2 or more in the Driving skill and the
   * vehicle needs the full number of drivers in order to move at full Movement; if understaffed
   * or untrained, the vehicle can only use half of its listed Movement per turn." Only runs when
   * not crashed (Movement is already fully zeroed above, a strictly stronger effect) - halves the
   * same in-memory .total each render rather than the real stored value, for the same
   * non-destructive reason as the crashed branch.
   */
  _prepareVehicleData() {
    if (this.system.crashed) {
      this.system.movementIsReadOnly = true;
      for (const movementType of Object.keys(this.system.movement)) {
        this.system.movement[movementType].total = 0;
      }

      return;
    }

    const d2Index = CONFIG.E20.skillShiftList.indexOf('d2');
    const qualifiedDrivers = Object.values(this.system.actors ?? {})
      .filter(entry => entry.vehicleRole == 'driver')
      .map(entry => fromUuidSync(entry.uuid))
      .filter(driver => {
        const shiftIndex = CONFIG.E20.skillShiftList.indexOf(driver?.system.skills?.driving?.shift);
        return shiftIndex >= 0 && shiftIndex <= d2Index;
      }).length;

    // Autopilot (GI Joe CRB, Vehicle Trait, p.173): "As long as this vehicle has 1 driver, it
    // operates at full capacity" - a full exception to the driver-count halving below, not just a
    // softer penalty, as soon as at least 1 qualified driver is seated (regardless of how many
    // more the vehicle's own crew.numDrivers calls for). Autopilot, Advanced's own clause
    // ("operates like a normal vehicle with at least 1 driver but less than its full complement,
    // even with zero drivers") needs no separate code here - this halving branch already treats 0
    // qualified drivers the same as an understaffed-but-present crew (halved, not zeroed), which
    // is exactly that guarantee; nothing currently makes a 0-driver Vehicle fully immobile for
    // Advanced Autopilot to be an exception to.
    const hasAutopilot = this.system.traits?.autopilot;
    if (qualifiedDrivers < this.system.crew.numDrivers && !(hasAutopilot && qualifiedDrivers >= 1)) {
      for (const movementType of Object.keys(this.system.movement)) {
        this.system.movement[movementType].total = Math.floor(this.system.movement[movementType].total / 2);
      }
    }

    if (this.type == 'party') {
      this._preparePartyData();
    }
  }

  /**
   * Party ("Squad") aggregates derived from the roster (system.actors): the Player Character
   * member count and, from it, the default pooled Requisition budget - "3 attempts per PC,
   * pooled" (GI Joe CRB p.137-138 / TF CRB p.115-116 / PR CRB p.103). `requisition.attempts`
   * stays the live spendable counter; `requisitionMax` is only the "Reset" target the sheet
   * shows.
   */
  _preparePartyData() {
    const system = this.system;

    system.memberCount = this.members.length;
    system.requisitionMax = system.requisition.autoFromRoster
      ? 3 * system.memberCount
      : system.requisition.attempts;
  }

  /**
   * This Party's roster (system.actors) resolved to live Player Character Actors. World actors
   * only - entries that no longer resolve, or that aren't Player Characters, are dropped.
   * Empty for every non-Party actor type.
   * @type {Actor[]}
   */
  get members() {
    if (this.type != 'party') {
      return [];
    }

    return Object.values(this.system.actors ?? {})
      .map(entry => fromUuidSync(entry.uuid))
      .filter(actor => actor?.type == 'playerCharacter');
  }

  /**
   * Adds a Player Character to this Party's roster. No-op unless this is a Party, `actor` is a
   * Player Character, and it isn't already on the roster.
   * @param {Actor} actor   The Player Character to add.
   */
  async addMember(actor) {
    if (this.type != 'party' || actor?.type != 'playerCharacter') {
      return;
    }

    if (Object.values(this.system.actors).some(entry => entry.uuid == actor.uuid)) {
      return;
    }

    const key = createId(this.system.actors);
    await this.update({
      [`system.actors.${key}`]: {
        uuid: actor.uuid,
        img: actor.img,
        name: actor.name,
        type: actor.type,
      },
    });
  }

  /**
   * Removes a roster entry from this Party by its member Actor's UUID. No-op if that UUID
   * isn't on the roster.
   * @param {String} uuid   The member Actor's UUID.
   */
  async removeMember(uuid) {
    const key = Object.entries(this.system.actors).find(([, entry]) => entry.uuid == uuid)?.[0];
    if (key) {
      await this.update({ [`system.actors.-=${key}`]: null });
    }
  }

  /**
   * Tallies the six-hand Load Out limit (GI Joe CRB p.138 / TF CRB p.116 / PR CRB p.103) and,
   * for Transformers, External vs Integrated Hardpoint usage (TF CRB p.114) from the actor's
   * equipped Weapons. Writes derived counts back onto system.loadout and system.hardpoints:
   *
   * - system.loadout.handsUsed / .handsOver     - sum of equipped weapon hands vs handsMax.
   *     Integrated-Hardpoint weapons are excluded (TF CRB p.116: they don't count).
   * - system.hardpoints.{external,integrated}.max / .used / .over
   *     max = base + bonus; a two-handed weapon in an Integrated Hardpoint uses two slots.
   *
   * Informational only - nothing here blocks equipping or attacking. Matches the system's
   * existing stance of surfacing Equipment Assignment state rather than enforcing it.
   */
  _prepareLoadout() {
    const system = this.system;
    if (!system.loadout || !system.hardpoints) {
      return;
    }

    const handsMax = system.loadout.handsMax ?? CONFIG.E20.LOADOUT_BASE_HANDS;
    let handsUsed = 0;
    let externalUsed = 0;
    let integratedUsed = 0;

    for (const item of this.items) {
      if (item.type != 'weapon' || !item.system.equipped) {
        continue;
      }

      const hands = item.system.derivedHands ?? 1;
      const hardpointType = item.system.hardpoint?.type ?? 'external';

      if (hardpointType == 'integrated') {
        integratedUsed += Math.max(1, hands);
      } else if (hardpointType == 'external') {
        externalUsed += Math.max(1, hands);
        handsUsed += hands;
      } else { // 'none' - carried but not in a Hardpoint; still counts against the six-hand limit
        handsUsed += hands;
      }
    }

    system.loadout.handsUsed = handsUsed;
    system.loadout.handsOver = handsUsed > handsMax;

    for (const [key, used] of [['external', externalUsed], ['integrated', integratedUsed]]) {
      const slot = system.hardpoints[key];
      slot.max = (slot.base ?? 0) + (slot.bonus ?? 0);
      slot.used = used;
      slot.over = used > slot.max;
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
   *
   * Note the assignment below is `=`, not `+=`: this method OWNS the value, which is why anything
   * wanting to add to the pool has to land after it. Spark of the Ancients (Enigma of
   * Combination, General Perk, p.41 - "Your maximum Energon Pool is increased by 2") used to be a
   * branch at the bottom of this method for exactly that reason; it is now an ordinary Active
   * Effect on the compendium Perk itself (packs/eocitems/_source/Spark_Of_the_Ancients_*.json),
   * applied in the FINAL phase so core runs it after prepareDerivedData rather than before, where
   * this assignment would simply overwrite it. Any future "+N maximum Energon" effect needs that
   * same phase - see docs/ACTIVE_EFFECTS_UI_PLAN.md §13. The Perk's other two halves ("regain 1
   * Energon at the beginning of any scene", "always register as having the highest amount of
   * Energon") remain unbuilt: there is no scene-boundary hook and no scanner mechanic to hang
   * them on.
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
    // Defensive guard, not a real actor-type gate: an invalid/unregistered actor type (e.g. a
    // stray "party" actor left over from unrelated in-progress work, which has no DataModel
    // registered at all - see module/data/actor/index.mjs) still reaches prepareDerivedData()
    // in some Foundry code paths despite failing its own schema validation, with no system.health
    // to compute against. Every real actor type this system registers always has one.
    if (!system.health) {
      return;
    }

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

    // Health from Origin - non-PC actor types (npc/companion/vehicle/zord/megaform) never have
    // an embedded Origin Item (that's a PC chargen artifact), so they fall back to the flat
    // system.health.origin field instead - a GM-entered "starting Health" for those types,
    // parallel to a PC's Origin Item. Megaform overwrites this field itself in
    // _prepareMegaformData() (run before this method - see prepareDerivedData()) with its own
    // aggregate participant math, so it's never GM-typed there either.
    const origins = this.items.documentsByType.origin;
    if (origins.length > 0) {
      const origin = origins[0];
      originStartingHealth = origin.system.startingHealth;
      originName = origin.name;
    } else {
      originStartingHealth = system.health.origin ?? 0;
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
    // Defensive guard - see the identical one in _prepareHealth() above.
    if (!system.defenses) {
      return;
    }

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
      // PC/NPC/Companion Essences are a {max, value} pair; Vehicle/Zord Essences (templates/
      // machine.mjs) are a flat {usesDrivers, value} - .max is undefined there, so this falls
      // back to .value (which for a Vehicle/Zord's own Smarts/Social is null by default, per
      // RAW - see makeDefensesFields's own doc comment on Willpower/Cleverness substitution).
      const essence = system.essences[defense.essence].max ?? system.essences[defense.essence].value;
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

      // H.I.S.S. Column (GI Joe CRB, Vehicle Trait, p.302): "Every H.I.S.S. on a battlefield
      // gains a bonus to Evasion equal to the number of other H.I.S.S. on the battlefield."
      // Recomputed fresh every prepareData pass (getHissColumnBonus scans the live scene), same
      // idiom as every other condition-gated bonus in this loop, so it tracks other H.I.S.S.
      // tokens entering/leaving the scene automatically.
      if (defenseType == 'evasion' && this.type == 'vehicle' && system.traits?.hissColumn) {
        perkDefenseBonus += getHissColumnBonus(this);
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
    // Defensive guard - see the identical one in _prepareHealth() above.
    if (!system.movement) {
      return;
    }

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

    // Order matters here and is not alphabetical: 'climb' is processed AFTER 'ground' so Wire
    // Work's climb-equals-ground clause can read ground's finished total (see WIRE_WORK_ID's own
    // comment above). 'burrow' is appended last because nothing derives from it - unlike climb and
    // swim it has no half-Ground default, since an actor only ever has Burrow Movement because
    // something explicitly granted it (Burrower, tsitems).
    const movementTypes = ['aerial', 'ground', 'climb', 'swim', 'burrow'];
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

      // Each branch sums whichever "innate" value applies in this form (base, or altMode while
      // Transformed) plus the bonus on top. The guard is `innate || bonus`, NOT `innate` alone:
      // granting movement of a type the actor didn't previously have is exactly what a bonus is
      // for - Zero-G's "+60 Aerial", Movement Booster's "creates a NEW kind of movement type",
      // Light Chassis's "+10 feet to one of the Zord's movement types", Upgraded Zord (Rescue)'s
      // "+20 feet to all movement types". Gating on the innate value alone silently discarded
      // every one of those on a movement type sitting at 0, which is precisely the case they
      // exist to fill (a Zord ships with Ground 40 and Aerial/Climb/Swim all 0).
      const movement = system.movement[movementType];
      const innateValue = system.isTransformed ? movement.altMode : movement.base;
      const morphedBonus = system.isMorphed ? movement.morphed : 0;

      if (innateValue || movement.bonus) {
        movement.total = innateValue + movement.bonus + morphedBonus;
      }

      movementTotal += movement.total;

      // Climb/Swim default to half Ground Movement. Applied as a FLOOR rather than an only-if-zero
      // fallback: with the bonus fix above, a small explicit grant (say Light Chassis's +10 Climb)
      // would otherwise REPLACE a larger default (half of Ground 40 = 20), leaving the actor slower
      // for having taken a Feature that adds movement.
      if (movementType == 'climb' || movementType == 'swim') {
        //This equation gives you half speed round down to the nearest 5 ft for certain movements.
        const halfGround = Math.floor(system.movement.ground.total / 5 * .5) * 5;
        movement.total = Math.max(movement.total, halfGround);
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

    system.movementNotSet = !movementTotal;
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

    // Foundry's Actor World Collection initializes every actor in whatever order the DB returns
    // them, with no dependency graph - if this Megaform happens to be prepared before a linked
    // Zord is, fromUuidSync above still resolves the Zord Document, but its own derived Health/
    // Movement/Defenses haven't been computed yet, so reading them below would silently aggregate
    // stale (often zeroed) values until something unrelated later happens to re-trigger this
    // Megaform's own prepareDerivedData(). Forcing each participant's own prepareData() first
    // guarantees this always aggregates current values, regardless of load order.
    for (const zord of participants) {
      zord.prepareData();
    }

    system.participantHealth = participants.map(zord => ({
      name: zord.name,
      value: zord.system.health.value,
      max: zord.system.health.max,
    }));
    system.participantStun = participants.map(zord => ({
      name: zord.name,
      value: zord.system.stun.value,
    }));

    if (!participants.length) {
      system.isDefeated = false;
      system.combinedHealthMax = 0;
      system.combinedHealthValue = 0;
      system.health.origin = 0;
      system.health.value = 0;
      system.stun.value = 0;
      system.hasEnhancedAttack = false;
      system.hasLightChassisInitiativeUpshift = false;
      // Every other field below is normally computed from the linked Zords - with none linked
      // yet, these would otherwise sit at whatever this actor's own zordBase-inherited schema
      // defaults are (e.g. Ground Movement 40, Strength 6, Toughness base 17), showing a
      // fully-unlinked Megaform as having real combat stats it hasn't actually earned from any
      // participant. Zeroed here for the same "0 participants = 0 everything" reason Health/Stun
      // already are above.
      system.armor = 0;
      system.essences.strength.value = 0;
      system.essences.speed.value = 0;
      system.defenses.toughness.base = 0;
      system.defenses.toughness.armor = 0;
      system.defenses.evasion.base = 0;
      system.defenses.evasion.armor = 0;
      for (const movementType of Object.keys(system.movement)) {
        system.movement[movementType].base = 0;
      }

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
    let hasAssaultWeapon = false;
    let hasTenaciousBonds = false;
    let combinedHealthMax = 0;
    let combinedHealthValue = 0;
    let hasLightChassisInitiativeUpshift = false;

    for (const zord of participants) {
      const hasCoreBody = zord.items.some(
        item => item.type == 'megaformTrait' && item.system.type == 'coreBody',
      );
      const healthMultiplier = hasCoreBody ? 2 : 1;
      let layeredSystemsBonus = 0;

      // Light Chassis / Hardened Chassis - see their own LIGHT_CHASSIS_ID/HARDENED_CHASSIS_ID
      // comments above. Zord Features, not megaformTrait items, so checked here rather than in
      // the megaformTrait switch below.
      if (actorHasZordFeature(zord, LIGHT_CHASSIS_ID)) {
        hasLightChassisInitiativeUpshift = true;
      }

      if (actorHasZordFeature(zord, HARDENED_CHASSIS_ID)) {
        toughnessTraitBonus += 1;
      }

      // Not handled below - none are a missing switch case, each needs a mechanic this system
      // doesn't have yet: Accurate Combiner (Across the Stars, p.104) is a per-roll ↑1 that only
      // applies when the Megaform's attack roll actually uses THIS participant's own melee/
      // ranged attack, which would need a dice.mjs hook, not a build-time derived stat;
      // Compensation (A Jump Through Time, p.84) lets the team voluntarily redirect incoming
      // damage onto this Zord at the moment damage is being distributed, which needs the
      // Megaform damage-distribution mechanic itself (dividing an attack's damage across
      // participants) - this system doesn't model that distribution step yet either; and
      // Detachable (Across the Stars, p.104) grants an out-of-turn action (leave the Megaform at
      // end of round, can't rejoin this scene) rather than any stat this pass computes - the
      // "leave the Megaform" half is already fully expressible today by removing the Zord from
      // system.actors via the sheet's existing delete control, so only the "can't reattach this
      // scene" and "incompatible with Core Body" guardrails are actually missing, and both are
      // narrow build/GM-enforced rules in the same class this project leaves unenforced
      // elsewhere rather than building bespoke tracking for.
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
        case 'defender':
          // Across the Stars, p.104: "+1 bonus to the Megaform's adjusted Toughness Defense."
          // The reactive half ("piloting Ranger may spend 1 Personal Power to impose a Snag on
          // an attack targeting the Megaform") needs a "react to an incoming attack" hook this
          // system doesn't have yet - not built.
          toughnessTraitBonus += item.system.value;
          break;
        case 'move':
          system.movement[item.system.movementType].base += item.system.value;
          break;
        case 'enhancedMeleeAttack':
        case 'enhancedRangedAttack':
          hasEnhancedAttack = true;
          break;
        case 'assaultWeapon':
          hasAssaultWeapon = true;
          break;
        case 'tenaciousBonds':
          hasTenaciousBonds = true;
          break;
        case 'layeredSystems':
          // Across the Stars, p.105: "adds 3 to the Health of its specific section (added after
          // any modifiers for the Core Body position)" - a flat bonus to just this Zord's own
          // share, applied after (not doubled by) the Core Body multiplier below.
          layeredSystemsBonus += item.system.value;
          break;
        case 'grounding':
          // A Jump Through Time, p.84: "immune to Electromagnetic damage." The other half
          // ("always reduces Electric damage by 1 before distribution") needs the same
          // damage-distribution mechanic Compensation is blocked on above - not built.
          system.immunities.emp = true;
          break;
        case 'resistant':
          // Across the Stars, p.105: "adds one of its damage Resistances to the entirety of
          // the Megaform."
          system.resistances[item.system.damageType] = true;
          break;
        }
      }

      combinedHealthMax += (zord.system.health.max * healthMultiplier) + layeredSystemsBonus;
      combinedHealthValue += (Math.max(0, zord.system.health.value) * healthMultiplier) + layeredSystemsBonus;
    }

    // Tenacious Bonds (A Jump Through Time, p.84): "this component Zord and all other component
    // Zords gain 1 additional Health, added after any multipliers for the Core Body Megaform
    // Trait... This Megaform Trait may only modify the Megaform once" - a flat, non-stacking +1
    // per participant (not per instance of the trait across multiple holders), so this is a
    // single conditional add after the main loop rather than accumulated inside it.
    if (hasTenaciousBonds) {
      combinedHealthMax += participants.length;
      combinedHealthValue += participants.length;
    }

    system.essences.strength.value = Math.min(MAX_ESSENCE, strength);
    system.essences.speed.value = Math.min(MAX_ESSENCE, speed);
    system.armor = BASE_ARMOR_BONUS;

    // Toughness/Evasion no longer get their .value set directly here - the shared
    // Essence20Actor#_prepareDefenses(), which now runs for every actor type (including
    // Megaform), computes .total = base(10) + essence + bonus + armor + shield afterward. The
    // Combiner rules' own "+3 base starting Armor bonus" and the aggregated Core Defenses/
    // Defender trait bonuses above are folded into .armor here (not .bonus, which stays free
    // for a GM's own manual add-on - see _prepareDefenses's identical perkDefenseBonus pattern
    // for PC/NPC/Vehicle/Zord) so the shared formula reproduces the exact same total this method
    // used to compute directly: 10 + essence + BASE_ARMOR_BONUS + toughnessTraitBonus for
    // Toughness, 10 + essence + evasionTraitBonus for Evasion (no base Armor bonus there).
    system.defenses.toughness.armor = BASE_ARMOR_BONUS + toughnessTraitBonus;
    system.defenses.evasion.armor = evasionTraitBonus;

    // .total is left to the shared Essence20Actor#_prepareMovement() below, which now runs for
    // every actor type - it reads .base (just finished above) and folds in .bonus/Perks the same
    // way it always has for a playerCharacter, rather than this method setting .total = .base
    // directly and skipping that.

    system.hasEnhancedAttack = hasEnhancedAttack;
    system.hasAssaultWeapon = hasAssaultWeapon;
    system.hasLightChassisInitiativeUpshift = hasLightChassisInitiativeUpshift;
    system.combinedHealthMax = combinedHealthMax;
    system.combinedHealthValue = combinedHealthValue;
    // Health is NOT pooled per RAW (see this method's own class comment) - combinedHealthMax/
    // combinedHealthValue above remain the authoritative per-participant-summed display values
    // and are what megaform-damage.mjs actually distributes damage against. system.health here
    // just mirrors them so the shared _prepareHealth() below can add an optional GM .bonus on
    // top for system.health.max, the same "compute a base, let the shared formula finish it"
    // split every other field on this actor now uses.
    system.health.origin = combinedHealthMax;
    system.health.value = combinedHealthValue;

    // Stun (p.170: "shown on the sheet as 'Stun / Health'... every hit that deals Stun damage
    // adds to this instead of subtracting from Health") isn't pooled either, for the same reason
    // Health isn't - each participant tracks its own, and helpers/megaform-damage.mjs's
    // applyMegaformDamage already correctly routes Stun-type damage to each participant's own
    // system.stun.value (it just calls the ordinary applyDamage() per participant, which
    // branches on damageType itself). This is purely the same kind of display mirror as
    // combinedHealthValue above - summed fresh from the participants, not a real separate pool.
    system.stun.value = participants.reduce((sum, zord) => sum + (zord.system.stun?.value || 0), 0);

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

    // See _prepareMegaformZordData's identical call for why this is needed - without it, a
    // Megaform that initializes before a linked component actor would aggregate that
    // component's still-unprepared (often zeroed) Health/Movement/Defenses/Essences.
    for (const component of participants) {
      component.prepareData();
    }

    system.participantHealth = participants.map(component => ({
      name: component.name,
      value: component.system.health.value,
      max: component.system.health.max,
    }));
    system.participantStun = participants.map(component => ({
      name: component.name,
      value: component.system.stun.value,
    }));

    if (!participants.length) {
      system.isDefeated = false;
      system.combinedHealthMax = 0;
      system.combinedHealthValue = 0;
      system.health.origin = 0;
      system.health.value = 0;
      system.stun.value = 0;
      system.hasEnhancedAttack = false;
      system.hasEnhancedInitiative = false;
      system.hasTitanHardpoint = false;
      // Same "0 participants = 0 everything" reasoning as _prepareMegaformZordData's identical
      // early return above - without this, these fields would sit at whatever this actor's own
      // zordBase-inherited schema defaults are.
      system.armor = 0;
      for (const essence of ['strength', 'speed', 'smarts', 'social']) {
        system.essences[essence].value = 0;
      }

      system.defenses.toughness.base = 0;
      system.defenses.toughness.armor = 0;
      system.defenses.evasion.base = 0;
      system.defenses.evasion.armor = 0;
      for (const movementType of Object.keys(system.movement)) {
        system.movement[movementType].base = 0;
      }

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
    // actor types without a granular defense.armor field contribute +0. Written into .armor
    // (not .value/.total directly) so the shared Essence20Actor#_prepareDefenses(), which now
    // runs for every actor type including Megaform, can finish the computation - it reads
    // .armor and adds it into .total = base(10) + essence + bonus + armor + shield, reproducing
    // the same 10 + essence + armorBonus this method used to compute directly.
    for (const defenseType of ['toughness', 'evasion']) {
      const armorBonus = Math.min(
        ...participants.map(component => component.system.defenses?.[defenseType]?.armor ?? 0),
      );
      system.defenses[defenseType].armor = armorBonus;

      if (defenseType == 'toughness') {
        system.armor = armorBonus;
      }
    }

    // Movement: slowest rate per type among components' current (Bot Mode) movement. Every
    // actor type now actively (re)computes its own .total (Essence20Actor#_prepareMovement()
    // runs for all of them), so this always reads a fresh value - no more falling back to .base
    // for a possibly-stale NPC/Vehicle component. .total itself is left to the shared
    // _prepareMovement() below, which reads the .base this sets and folds in .bonus/Perks.
    for (const movementType of Object.keys(system.movement)) {
      const rates = participants
        .map(component => component.system.movement?.[movementType]?.total)
        .filter(rate => rate);
      system.movement[movementType].base = rates.length ? Math.min(...rates) : 0;
    }

    // Combiner Features always apply - reusing the same megaformTrait items as a Megazord's
    // Megaform Traits (see the class comment above for why). Accurate Combiner, Compensation,
    // and Detachable are intentionally not handled here, for the same reasons documented in
    // _prepareMegaformZordData's own identical comment (a per-roll dice.mjs hook, the
    // still-missing Megaform damage-distribution mechanic, and an out-of-turn action this
    // system already supports the core of via the ordinary system.actors remove control,
    // respectively). Safe Release (Enigma of Combination, p.42: "when you are forced to leave a
    // Combiner form... you do so with at least 1 Health") and Universal Receptors (p.43: "spend 1
    // fewer Story Point... merging with Combiner-capable NPCs") are likewise unhandled here -
    // Safe Release needs Phase 4's still-unbuilt Vehicle/Megaform Defeat subsystem to have
    // anything to guard against, and Universal Receptors discounts a Story Point cost this system
    // doesn't charge anywhere yet (no code currently spends one for an NPC joining a Combiner).
    // Both are real, selectable Item types now so a sheet can record who holds them; the
    // mechanical payoff waits on those prerequisite gaps closing.
    let toughnessTraitBonus = 0;
    let evasionTraitBonus = 0;
    let hasTenaciousBonds = false;
    let hasCommander = false;
    let layeredSystemsBonus = 0;
    let hasEnhancedInitiative = false;
    let hasTitanHardpoint = false;
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
        case 'defender':
          toughnessTraitBonus += item.system.value;
          if (item.system.type == 'coreDefenses') {
            evasionTraitBonus += item.system.value;
          }

          break;
        case 'move':
          system.movement[item.system.movementType].base += item.system.value;
          break;
        case 'tenaciousBonds':
          hasTenaciousBonds = true;
          break;
        case 'layeredSystems':
          layeredSystemsBonus += item.system.value;
          break;
        case 'grounding':
          system.immunities.emp = true;
          break;
        case 'resistant':
          system.resistances[item.system.damageType] = true;
          break;
        case 'skillExpertise':
          if (system.skills[item.system.skill]) {
            system.skills[item.system.skill].modifier += item.system.value;
          }

          break;
        case 'enhancedInitiative':
          hasEnhancedInitiative = true;
          break;
        case 'titanHardpoint':
          hasTitanHardpoint = true;
          break;
        case 'commander':
          // Enigma of Combination, p.42: "Note your two highest Essence Scores... and increase
          // each of those Essence Scores of the Combined Form by 1... a Combiner form can only
          // ever benefit from this Combiner feature once" - a flat, non-stacking flag (like
          // Tenacious Bonds above), applied once after every other Essence bonus is tallied so it
          // reads the Combiner's own final scores, not a snapshot from before this loop finishes.
          hasCommander = true;
          break;
        }
      }
    }

    system.defenses.toughness.armor += toughnessTraitBonus;
    system.defenses.evasion.armor += evasionTraitBonus;

    if (hasCommander) {
      // RAW breaks a tie between equal Essence Scores by player choice; this system has no
      // mid-computation player-choice hook, so ties fall back to a fixed Essence order
      // (Strength > Speed > Smarts > Social), the same "narrative choice left to a deterministic
      // default" simplification this codebase already accepts elsewhere.
      const essenceOrder = ['strength', 'speed', 'smarts', 'social'];
      const topTwoEssences = [...essenceOrder]
        .sort((a, b) => system.essences[b].value - system.essences[a].value)
        .slice(0, 2);
      for (const essence of topTwoEssences) {
        system.essences[essence].value = Math.min(MAX_ESSENCE, system.essences[essence].value + 1);
      }
    }

    // Base Energon Point pool = half the Energon spent to merge, rounded up.
    system.energon.normal.max = Math.ceil(system.energonSpentToMerge / 2);

    system.hasEnhancedAttack = false;
    system.hasEnhancedInitiative = hasEnhancedInitiative;
    system.hasTitanHardpoint = hasTitanHardpoint;
    system.hasAssaultWeapon = participants.some(
      component => component.items.some(item => item.type == 'megaformTrait' && item.system.type == 'assaultWeapon'),
    );
    // Layered Systems has no Core Body-style multiplier to apply after in a Combiner (Combiners
    // don't have that Trait), so its bonus is just summed in directly; Tenacious Bonds is the
    // same flat, non-stacking +1 per participant (not per holder) as the Megazord path above.
    const tenaciousBondsBonus = hasTenaciousBonds ? participants.length : 0;
    system.combinedHealthMax = participants.reduce((sum, component) => sum + component.system.health.max, 0)
      + layeredSystemsBonus + tenaciousBondsBonus;
    system.combinedHealthValue = participants.reduce(
      (sum, component) => sum + Math.max(0, component.system.health.value), 0,
    ) + layeredSystemsBonus + tenaciousBondsBonus;
    // Health is NOT pooled per RAW - combinedHealthMax/combinedHealthValue above stay the
    // authoritative per-participant-summed values (what megaform-damage.mjs actually distributes
    // damage against); system.health here just mirrors them so the shared _prepareHealth() below
    // can add an optional GM .bonus on top for system.health.max, same as the Megazord path.
    system.health.origin = system.combinedHealthMax;
    system.health.value = system.combinedHealthValue;

    // Stun isn't pooled either, for the same reason Health isn't - see the identical comment in
    // _prepareMegaformZordData above.
    system.stun.value = participants.reduce((sum, component) => sum + (component.system.stun?.value || 0), 0);

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
    // Forwarded, not swallowed: dice.rollSkill reports whether the roll landed
    // ({ success, outcomes }) or that the dialog was cancelled ({ cancelled: true }), and
    // callers such as Requisition branch on it.
    return this._dice.rollSkill(dataset, this);
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
