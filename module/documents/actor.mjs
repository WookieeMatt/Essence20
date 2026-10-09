import { getGameLine } from "../settings.js";
import { runDerived } from "../mechanics/item-hooks.mjs";
import { COMMANDER_SKILLS_FLAG } from "../items/zords/commander-combiner-feature.mjs";
import { ZORD2 } from "../items/zords/combiner-roster-helpers.mjs";
import { addParticipantBonus, finishParticipantHealth, resetParticipantBonuses } from "../mechanics/vehicles/megaform-bonus-health.mjs";
import { getMegaformParticipants, subtypeChangeBlockers } from "../mechanics/vehicles/megaform-participants.mjs";
import { SIZE_CLASSES, sizeClassIndex } from "../mechanics/combat/size-classes.mjs";
import { linkedBonuses } from "../mechanics/companions/companions.mjs";
import { BOND } from "../mechanics/companions/bonded-partners.mjs";
import { vehicleHands } from "../mechanics/companions/summons.mjs";
import { carryPercent, extraCarriedHands } from "../mechanics/resources/kits.mjs";
import { imperfectionOf } from "../mechanics/resources/grants.mjs";
import { rulePartyRequisitionPerMember } from "../rules/plugins/resources/party-requisition.mjs";
import { ablativeLossOf, sourceOf as sourceOfItem } from "../mechanics/combat/target-riders.mjs";
import { defenseDamageOf } from "../mechanics/combat/essence-damage.mjs";
import { hardpointBonus, integratedHardpointsPerWeapon } from "../mechanics/combat/weapon-traits.mjs";
import { applyToVehicle as applyVehicleUpgrades } from "../mechanics/vehicles/vehicle-upgrades.mjs";
import { holdsMegaformTogether, megaformArmorOf, sharesSpecializations, traitReplaced } from "../rules/plugins/zords/megaform-contributions.mjs";
import { isGridShellActive } from "../items/attacks/weapon-perk-uses.mjs";
import { handlePartyDeleted, preventLastPartyDelete, preventPrimaryDeleteByPlayer } from "../mechanics/resources/party.mjs";
import { Dice } from "../dice.mjs";
import { isUnableToAct } from "../mechanics/actions/action-economy.mjs";
import { E20 } from "../util/config.mjs";
import { RollDialog } from "../mechanics/rolls/roll-dialog.mjs";
import { getNumActions } from "../mechanics/actions/action-counts.mjs";
import { resizeTokens } from "../mechanics/world/token-sync.mjs";
import { sceneResistancesOf } from "../mechanics/world/scene-resistances.mjs";
import { syncMorphState } from "../mechanics/characters/morph-state.mjs";
import { getBlindsightRange } from "../items/senses/blindsight.mjs";
import { getBestVisionGrant } from "../mechanics/characters/vision-grant.mjs";
import { roleValueChange } from "../sheet-handlers/role-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransformUuid } from "../sheet-handlers/transformer-handler.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";
import { normalizeSpecializations } from "../sheet-handlers/specialization-handler.mjs";
import { isPowerAdaptationActive } from "../items/forms/power-adaptation.mjs";
import { isWisdomOfTheEldersActive } from "../items/forms/wisdom-of-the-elders.mjs";
import { getFlutteryWingsBonus } from "../items/magic/fluttery-wings.mjs";
import { ruleEvasiveManeuvers } from "../rules/plugins/combat/evasive-maneuvers-rule.mjs";
import { isLightningSpeedActive } from "../items/magic/lightning-speed.mjs";
import { isHotToTrotActive } from "../items/magic/hot-to-trot.mjs";
import { convertEssenceWrites, resetEssencesFromBase, usesEssenceBase } from "../mechanics/vehicles/machine-essences.mjs";
import { currentEssence, tracksEssenceDamage } from "../mechanics/combat/essence-current.mjs";
import { convertCreatureEssenceWrites, finishCurrentEssences, resetScoresFromBase, usesScoreBase } from "../mechanics/characters/creature-essences.mjs";
import { isJuryRigBenefitActive } from "../items/vehicles/jury-rig.mjs";
import { isTheToughGetGoingActive } from "../items/movement/the-tough-get-going.mjs";
import { getHissColumnBonus } from "../mechanics/combat/nearby-allies.mjs";
import { actorHasZordFeature } from "../mechanics/vehicles/zord-features.mjs";
import { getDistressMovementBonus } from "../items/resources/emotional-mastery.mjs";
import { applyModularIntegration } from "../items/defenses/modular-armor.mjs";
import { DEFAULT_ENVIRONMENT, getEnvironment } from "../mechanics/world/environment.mjs";
import { changeVesselConditionStacks, getVesselConditionStacks, isStackingVesselCondition } from "../mechanics/vehicles/vessel-conditions.mjs";
import { needsGmRelay, relayToGm } from "../mechanics/world/gm-relay.mjs";

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
// Colony Changeling's +1 Evasion per adjacent colony changeling and Fighting Style's Careful / Defense bonuses are Defense
// rules on those items (rules/conv17-Split1.test.js); Trigger Happy is dice.mjs#_hasFightingStyle.

// Inner Magic - see items/magic/inner-magic.mjs's own doc comment. The ↑1 Spellcasting half is already
// built (mechanics/resources/banked-buffs.mjs); this constant/method cover the stacking Willpower Defense
// reduction half only.

// Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61) - see items/movement/animal-gait.mjs's
// own doc comment. Checked in _prepareMovement() below, same permitted movement-math touch-point
// Wisdom of the Elders' Lightfoil Wings/Warrior Rush already use.

// (Light Chassis' ↑1 on a Megazord's Initiative is a megaform-scoped RollModifier rule on the Feature.)
// (Hardened Chassis' +1 to a Megazord's Toughness armor and Armored Defense are MegaformArmor rules on their items; Keep IT
// Together! and Better As One are MegaformHold / MegaformSpecializations / EnergonDonor rules -
// rules/plugins/zords/megaform-contributions.mjs.)
import { createId } from "../util/utils.mjs";
import { ruleMovementStages, ruleSurpriseModes } from "../rules/adapter.mjs";
import { earlyDerivedStats } from "../rules/plugins/effects/derived-stages.mjs";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class Essence20Actor extends Actor {
  /**
   * The last Party cannot be deleted, and only a GM can delete the primary: it holds the
   * Story Point pool (see mechanics/resources/party.mjs). Returning false here is the one place a deletion
   * can still be refused.
   * @override
   */
  async _preDelete(options, user) {
    if (preventLastPartyDelete(this) || preventPrimaryDeleteByPlayer(this)) {
      return false;
    }

    return super._preDelete(options, user);
  }

  /**
   * A deleted primary Party hands its pin, and its points, to the next one. Every client
   * hears this; mechanics/resources/party.mjs decides which one acts.
   * @override
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    handlePartyDeleted(this);
  }

  constructor(...args) {
    super(...args);
    this._dice = new Dice(ChatMessage, new RollDialog(), game.i18n);
  }

  /**
   * Writes to an actor this user can't modify - on-hit effects written to a player's NPC target -
   * go to the active GM instead of failing with a permission error. See mechanics/world/gm-relay.mjs.
   * @override
   */
  async update(data = {}, operation = {}) {
    if (needsGmRelay(this)) {
      return relayToGm(this, 'update', [data, operation]);
    }

    return super.update(data, operation);
  }

  /** @override - see update() above. */
  async setFlag(scope, key, value) {
    if (needsGmRelay(this)) {
      return relayToGm(this, 'setFlag', [scope, key, value]);
    }

    return super.setFlag(scope, key, value);
  }

  /** @override - see update() above. */
  async unsetFlag(scope, key) {
    if (needsGmRelay(this)) {
      return relayToGm(this, 'unsetFlag', [scope, key]);
    }

    return super.unsetFlag(scope, key);
  }

  /**
   * Space Vessel Conditions that stack (Across the Stars p.25-26 - see mechanics/vehicles/vessel-conditions.mjs):
   * applying one the actor already has adds a stack rather than doing nothing. Every other status,
   * and every removal or plain toggle, is core's own behavior.
   * @override
   */
  async toggleStatusEffect(statusId, options = {}) {
    // A target this user can't modify (a player hitting an NPC) - the GM applies it. See mechanics/world/gm-relay.mjs.
    if (needsGmRelay(this)) {
      return relayToGm(this, 'toggleStatusEffect', [statusId, options]);
    }

    if (options.active === true && isStackingVesselCondition(statusId) && this.statuses?.has(statusId)) {
      await changeVesselConditionStacks(this, statusId, 1);
      return true;
    }

    return super.toggleStatusEffect(statusId, options);
  }

  /** @override */
  static async create(data, options = {}) {
    const actor = await super.create(data, options);

    return actor;
  }

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // A new Megaform with no type takes the world's game line: a Power Rangers world makes Megazords, any other (All
    // included) Transformers Combiners. The sheet's type select changes it.
    if (this.type == 'megaform' && data?.system?.subtype === undefined) {
      this.updateSource({ 'system.subtype': [defaultMegaformSubtype(getGameLine())] });
    }

    // A new Zord's, Vehicle's or Megaform's token is its Size (a baseline Zord is Huge - 3x3), not Foundry's 1x1. A
    // Megazord is at least Towering (its Size is worked out from its Zords - mechanics/vehicles/megaform-participants.mjs
    // resizes it as they join). A token size the creator gave is kept; later Size changes resize it in _preUpdate.
    if (['zord', 'vehicle', 'megaform'].includes(this.type)
      && data?.prototypeToken?.width === undefined && data?.prototypeToken?.height === undefined) {
      const megazord = this.type == 'megaform' && !this._source.system?.subtype?.includes?.('megaformCombiner');
      const size = CONFIG.E20.tokenSizes?.[megazord && sizeClassIndex(this._source.system?.size) < sizeClassIndex('towering') ? 'towering' : this._source.system?.size];
      if (size) {
        this.updateSource({ 'prototypeToken.width': size.width, 'prototypeToken.height': size.height });
      }
    }

    // A Zord / Vehicle created with only Essence values (an importer, a script) takes them as its base.
    if (usesEssenceBase(this)) {
      for (const [key, essence] of Object.entries(data?.system?.essences ?? {})) {
        if (essence && essence.value !== undefined && essence.base === undefined) {
          this.updateSource({ [`system.essences.${key}.base`]: essence.value });
        }
      }
    }

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
      // mechanics/vehicles/zord-features.mjs#actorHasZordFeature matches Features by. Both of these Features
      // were therefore invisible to every sourceId-based check, and would have quietly lost any
      // effect added to them in the compendium later.
      //
      // Only the Features the new Zord does not already carry. A duplicated Zord (or one imported,
      // or dragged in from a compendium) arrives with both already on it, and adding them again
      // left it with two of each. Matched by compendium source first, then by name, since a copy
      // made outside Foundry's own duplicate may not keep that link.
      const newItems = [];
      for (const uuid of [CALL_TO_ACTION_ID, RECALL_FOR_REPAIRS_ID]) {
        if (actorHasZordFeature(this, uuid)) {
          continue;
        }

        const source = await fromUuid(uuid);
        // A missing entry must not make Zords uncreatable: with the pack unbuilt or an id renamed,
        // this previously threw "Cannot read properties of null" straight out of _preCreate, which
        // aborts actor creation entirely with no usable explanation.
        if (!source) {
          console.warn(`essence20 | Zord Feature ${uuid} could not be found - skipping auto-add.`);
          continue;
        }

        if (this.items.some(item => item.type == 'feature' && item.name == source.name)) {
          continue;
        }

        newItems.push(game.items.fromCompendium(source));
      }

      // The Zord's own items go back in with the new ones: a duplicate arrives with weapons and
      // Features of its own, and the embedded collection is set from this array, not merged into.
      if (newItems.length) {
        this.updateSource({ items: [...this._source.items, ...newItems] });
      }
    }
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    // A Megaform changing between Megazord and Combiner keeps only a roster that still counts: anyone who wouldn't (a
    // mixed Megazord's Zords, a Combiner's non-transforming characters) has to leave first. A change that stands drops the
    // old kind's timers (mechanics/vehicles/megaform-participants.mjs).
    const newSubtype = foundry.utils.getProperty(changed, 'system.subtype');
    if (this.type == 'megaform' && newSubtype !== undefined) {
      const toCombiner = [newSubtype].flat().includes('megaformCombiner');
      if (toCombiner != this.system.subtype.includes('megaformCombiner')) {
        const blockers = subtypeChangeBlockers(this, newSubtype);
        if (blockers.length) {
          ui.notifications.warn(game.i18n.format(toCombiner ? 'E20.MegaformSubtypeBlockedCombiner' : 'E20.MegaformSubtypeBlockedMegazord', {
            form: this.name, names: blockers.map(actor => actor.name).join(', '),
          }));
          // Only the type change is dropped (the rest of the save still lands), and the open sheet is drawn again so its
          // type select goes back to the type it still has.
          delete changed.system.subtype;
          setTimeout(() => this.sheet?.rendered && this.sheet.render(), 0);
          if (!Object.keys(changed.system).length) {
            delete changed.system;
          }
        } else {
          for (const flag of toCombiner ? ['combineReadyRound', 'combineRolled'] : ['zord2HoldTogether', 'zord2Merge', 'zord2Invigorated']) {
            if (this.flags?.essence20?.[flag] !== undefined) {
              foundry.utils.setProperty(changed, `flags.essence20.${flag}`, new foundry.data.operators.ForcedDeletion());
            }
          }
        }
      }
    }

    // A Zord's / Vehicle's Essence value is worked out from its base: a write to the value moves the base.
    if (usesEssenceBase(this)) {
      convertEssenceWrites(this, changed);
    }

    // An NPC's / Companion's score and current amount are worked out from its base: writes are stored in that form.
    if (usesScoreBase(this)) {
      convertCreatureEssenceWrites(this, changed);
    }

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

    // Zord / Vehicle Essences start from the typed base; Active Effects and rules add on top.
    if (usesEssenceBase(this)) {
      resetEssencesFromBase(this.system);
    }

    // NPC / Companion scores likewise start from the typed base.
    if (usesScoreBase(this)) {
      resetScoresFromBase(this.system);
    }

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
    // No Zord / Vehicle Essence goes past 15 (Increase (Essence), PR CRB p.137: "to a maximum of 15") - after Active
    // Effects, before anything reads it.
    if (usesEssenceBase(this)) {
      for (const essence of Object.values(this.system.essences ?? {})) {
        if (Number.isFinite(essence?.value) && essence.value > 15) {
          essence.value = 15;
        }
      }
    }

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareNpcData();
    this._prepareVision();
    this._prepareEnergon();
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

    // Titanspark's Size Class bump is a Size item rule now (rules/plugins/effects/size.mjs, in runDerived below).

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
      // Item rules' DerivedStat at stage early (Metier's poison step), before the training is worked out.
      earlyDerivedStats(this);
      this._preparePoisonTraining();
    }

    this._prepareSceneResistances();

    if (this.type == 'vehicle') {
      this._prepareVehicleData();
    }

    // Party aggregates. This used to sit at the tail of _prepareVehicleData(), which only ever
    // runs for a vehicle - so it never ran at all, and every Party reported memberCount 0 and a
    // requisitionMax of 0 however many Player Characters were on its roster.
    if (this.type == 'party') {
      this._preparePartyData();
    }

    // Modular armor (Across the Stars p.85) - weapons socketed into equipped Modular armor become
    // Integrated (0 hands). Before the Load Out tally below, which reads derivedHands.
    applyModularIntegration(this);

    // Load Out (hands carried vs the six-hand limit) and Hardpoint allocation. The two types that carry equipment
    // personally, and a Transformers Combiner form, which has Hardpoints of its own (EoC p.44).
    if (this.type == 'playerCharacter' || this.type == 'npc' || (this.type == 'megaform' && this.system.subtype?.includes?.('megaformCombiner'))) {
      this._prepareLoadout();
    }

    // Deliberately last, and deliberately not folded into any of the methods above: action
    // budgets are their own small, self-contained pass with no dependency on the Defenses/Health/
    // Movement math.
    this._prepareActions();

    // Extensions' derived data - Health, Defenses and Movement adjustments (mechanics/item-hooks.mjs).
    runDerived(this);

    // A Megaform's Health rows: each participant's own Health plus its Megaform-only extra (Core Body, Layered Systems,
    // Roller Drum...), once every extension has added its part (mechanics/vehicles/megaform-bonus-health.mjs).
    if (this.type == 'megaform') {
      finishParticipantHealth(this, getMegaformParticipants(this));
    }

    // Item rules' Movement at stage afterDerived: after every derived adjustment above (rules/adapter.mjs#ruleMovementStages).
    const lateMovement = ruleMovementStages(this);
    for (const movementType of Object.keys(this.system.movement ?? {})) {
      const movement = this.system.movement[movementType];
      const next = movement && typeof movement == 'object' ? lateMovement('afterDerived', movementType, Number(movement.total) || 0) : null;
      if (next !== null) {
        movement.total = next;
      }
    }

    // NPC / Companion: the current amount follows the score's boosts (mechanics/characters/creature-essences.mjs).
    if (usesScoreBase(this)) {
      finishCurrentEssences(this);
    }

    // Zord / Vehicle / Megaform: what Essence damage leaves of each score, for the sheet (mechanics/combat/essence-current.mjs).
    if (tracksEssenceDamage(this)) {
      for (const key of Object.keys(this.system.essences ?? {})) {
        this.system.essences[key].current = currentEssence(this, key);
      }
    }
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
   * mechanics/actions/action-economy.mjs#getRemaining reads to zero BOTH categories once either is spent.
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

    /* The per-Speed counts come from mechanics/world/token-sync.mjs#getNumActions, which already existed to
       drive the sheet's own "1M, 1S, 1F" readout. Deriving them a second time here was a mistake:
       it silently disagreed with that readout for any actor whose Speed .max and .value differ,
       and for the Perks that move Free actions off Speed entirely (Quick Thinker and University
       Days source them from Smarts instead). One source of truth, and both displays now agree.

       The one deliberate difference is Speed 1. getNumActions reports it as one Move and zero
       Standards, but the rules say "Move OR Standard action... then ends their turn" (CRB p.193) -
       a choice, not a fixed Move. Both budgets are granted and `shared` makes them mutually
       exclusive, which mechanics/actions/action-economy.mjs#getRemaining honours. */
    const speedEssence = this.system.essences?.speed;
    const statuses = this.statuses ?? new Set();

    // Surprise (GI Joe CRB, Combat chapter): no actions of any kind in the surprise round. Item rules carve the exceptions
    // (SurpriseExemption, rules/adapter.mjs#ruleSurpriseModes): "speedAsLevel" (Unsurprising) acts
    // with Speed capped to level, "normal" (Ready For Anything) acts as usual, and "move" (Security)
    // keeps the Move action inside the ordinary zero-out (see zeroed.move, further down).
    const isSurprised = statuses.has('surprised');
    const surpriseModes = isSurprised ? ruleSurpriseModes(this) : new Set();
    const hasUnsurprising = surpriseModes.has('speedAsLevel');
    const hasReadyForAnything = surpriseModes.has('normal');

    // getNumActions reads system.essences.speed without guarding, which is safe for every actor
    // type the system registers (all six get Essences from character.mjs, machine.mjs or
    // zord-base.mjs) but not for a partially-built actor. Falling back to the ordinary
    // one-Move-one-Standard turn keeps derived data from throwing on one.
    let speed = speedEssence?.max ?? speedEssence?.value ?? 2;
    if (hasUnsurprising) {
      speed = Math.min(speed, this.system.level ?? 1);
    }

    const counts = !speedEssence
      ? { free: 0, movement: 1, standard: 1 }
      : hasUnsurprising
        // Same Speed-derived formula getNumActions uses (mechanics/world/token-sync.mjs), against the
        // level-capped speed above rather than the actor's real one.
        ? { free: Math.max(0, speed - 2), movement: speed > 0 ? 1 : 0, standard: speed > 1 ? 1 : 0 }
        : getNumActions(this);
    actions.shared = speed <= 1;

    const base = {
      standard: actions.shared ? 1 : counts.standard,
      move: counts.movement,
      free: counts.free,
    };

    // Asleep/Defeated/Stunned (GI Joe CRB, Conditions, p.226: no actions of any kind while
    // Stunned)/Unconscious all zero out every action budget - see
    // isUnableToAct's own doc comment (mechanics/actions/action-economy.mjs) for the Defeated exception and
    // why this used to be a second, separately-maintained copy of that same list.
    const incapacitated = isUnableToAct(this);
    const surprisedZeroed = isSurprised && !hasUnsurprising && !(hasReadyForAnything && !incapacitated);
    const hasSecurity = surprisedZeroed && surpriseModes.has('move');
    const zeroed = {
      free: incapacitated || statuses.has('cantTakeFreeActions') || surprisedZeroed,
      move: incapacitated || statuses.has('cantTakeMoveActions') || (surprisedZeroed && !hasSecurity),
      standard: incapacitated || surprisedZeroed,
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
   * Defeat of a Vehicle (GI Joe CRB, p.214): every Movement type is 0 until it is repaired. Read-only + zeroed the same way _prepareMegaformData()
   * already displays a computed-not-edited Movement (system.movementIsReadOnly) - the real
   * system.movement.<type>.total this Vehicle's sheet directly edits is left untouched
   * underneath, so clearing system.crashed (repairing it) needs nothing further to restore.
   *
   * Crew (GI Joe CRB, p.212): drivers need d2+ Driving, and a vehicle short of its full count of
   * qualified drivers moves at half its listed Movement. Only runs when
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

    // Autopilot (GI Joe CRB, Vehicle Trait, p.173): one driver is enough for full capacity - a full exception to the driver-count halving below, not just a
    // softer penalty, as soon as at least 1 qualified driver is seated (regardless of how many
    // more the vehicle's own crew.numDrivers calls for). Autopilot, Advanced's own clause (it runs
    // as an understaffed vehicle even with no driver at all) needs no separate code here - this halving branch already treats 0
    // qualified drivers the same as an understaffed-but-present crew (halved, not zeroed), which
    // is exactly that guarantee; nothing currently makes a 0-driver Vehicle fully immobile for
    // Advanced Autopilot to be an exception to.
    // Undo Engine (Intercontinental Adventures p.71): Movement 0 until the driver spends a Standard
    // action restarting the engines - the flag its rules set (and the restart button clears).
    if (this.getFlag?.('essence20', 'undoEngineMovementDisabled')) {
      for (const movementType of Object.keys(this.system.movement)) {
        this.system.movement[movementType].total = 0;
      }

      return;
    }

    const hasAutopilot = this.system.traits?.autopilot;
    if (qualifiedDrivers < this.system.crew.numDrivers && !(hasAutopilot && qualifiedDrivers >= 1)) {
      for (const movementType of Object.keys(this.system.movement)) {
        this.system.movement[movementType].total = Math.floor(this.system.movement[movementType].total / 2);
      }
    }

    // Vehicle Upgrades and switched-on effects - Defenses, Movement, traits (vehicle-upgrades.mjs).
    applyVehicleUpgrades(this);

    // Superstructure (Across the Stars p.87): "It possesses three times the normal amount of Health."
    if (this.system.traits?.superstructure && this.system.health) {
      this.system.health.max *= 3;
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

    // Foundry still preps a document whose own DataModel failed to register/validate, which
    // leaves system.requisition undefined - the same defensive shape _prepareHealth and its
    // neighbours already carry, and the reason the stray-party test exists.
    if (!system?.requisition) {
      return;
    }

    system.memberCount = this.members.length;
    system.requisitionMax = system.requisition.autoFromRoster
      ? 3 * system.memberCount
      : system.requisition.attempts;

    // PartyRequisition rules on members' items (Base Technological Advancements - rules/plugins/resources/party-requisition.mjs).
    if (system.requisition.autoFromRoster) {
      system.requisitionMax += rulePartyRequisitionPerMember(this.members) * system.memberCount;
    }
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
      await this.update({ [`system.actors.${key}`]: new foundry.data.operators.ForcedDeletion() });
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
  /**
   * Whether a weapon is a Ram / Flyby (an Alt Mode Special Attack): its own flag, an effect it lists, or an effect
   * attached to it on this actor.
   * @param {Item} weapon
   * @returns {Boolean}
   */
  _isAltModeAttack(weapon) {
    const flagged = data => !!(data?.isRam || data?.isFlyby || data?.system?.isRam || data?.system?.isFlyby);
    if (flagged(weapon.system)) {
      return true;
    }

    if (Object.values(weapon.system?.items ?? {}).some(flagged)) {
      return true;
    }

    return [...(this.items ?? [])].some(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id && flagged(item));
  }

  _prepareLoadout() {
    const system = this.system;
    if (!system.loadout || !system.hardpoints) {
      return;
    }

    const handsMax = system.loadout.handsMax ?? CONFIG.E20.LOADOUT_BASE_HANDS;
    let handsUsed = 0;
    let externalUsed = 0;
    let integratedUsed = 0;
    const carried = [];

    for (const item of this.items) {
      if (item.type != 'weapon' || !item.system.equipped) {
        continue;
      }

      // Ram and Flyby are the Alt Mode's own Special Attacks (TF CRB p.49), not equipment: no hands, no Hardpoint.
      // The flag sits on the weapon's effect (weaponEffect isRam / isFlyby), listed in system.items and attached as
      // its own item (parentId) - live test 2026-10-07 found the weapon itself never carries it.
      if (this._isAltModeAttack(item)) {
        continue;
      }

      // A Megaform's own attacks built from its parts (items/zords/megaform-attacks.mjs - the Combiner's strike and ranged
      // attack, Titan Hardpoint's weapon in its own Titan Hardpoint) and its participants' mirrored weapons take none of
      // its Hardpoints.
      if (this.type == 'megaform' && (item.flags?.essence20?.zord2Gen || item.flags?.essence20?.zord1MirrorOf)) {
        continue;
      }

      const hands = item.system.derivedHands ?? 1;
      const hardpointType = item.system.hardpoint?.type ?? 'external';

      if (hardpointType == 'integrated') {
        integratedUsed += Math.max(1, hands) + integratedHardpointsPerWeapon(this);
      } else if (hardpointType == 'external') {
        externalUsed += Math.max(1, hands);
        handsUsed += hands;
        carried.push({ item, hands });
      } else { // 'none' - carried but not in a Hardpoint; still counts against the six-hand limit
        handsUsed += hands;
        carried.push({ item, hands });
      }
    }

    // Bomber / Medicine Cabinet: explosives and poisons carried on top of the six hands.
    handsUsed = Math.max(0, handsUsed - extraCarriedHands(this, carried));
    // Skybound: "your Jet Pack counts as 2 hands of equipment."
    handsUsed += vehicleHands(this);
    // Carrying capacity as a share of body weight (PR CRB Table 6-1) - mechanics/resources/kits.mjs.
    system.loadout.carryPercent = carryPercent(this);
    system.loadout.handsUsed = handsUsed;
    system.loadout.handsOver = handsUsed > handsMax;

    // Hardpoints Perks add (mechanics/combat/weapon-traits.mjs#hardpointBonus).
    const perkHardpoints = hardpointBonus(this);
    for (const [key, used] of [['external', externalUsed], ['integrated', integratedUsed]]) {
      const slot = system.hardpoints[key];
      slot.max = (slot.base ?? 0) + (slot.bonus ?? 0) + (perkHardpoints[key] ?? 0);
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
   * Asleep/Unconscious is handled by syncAutoBlindStatus() (mechanics/world/token-sync.mjs) applying the
   * real "blinded" status, which reuses Foundry's own CONFIG.specialStatusEffects.BLIND
   * handling (see essence20.mjs) rather than trying to force TokenDocument.sight.enabled off
   * directly, which does not actually block perception.
   */
  _prepareVision() {
    this.system.visionSuppressed = this.statuses?.has('asleep') || this.statuses?.has('unconscious') || false;

    // Selection (and Used to the Dark's own doubling clause) lives in mechanics/characters/vision-grant.mjs
    // so it can be unit tested directly.
    this.system.visionGrant = this.system.visionSuppressed ? null : getBestVisionGrant(this);

    // Blindsight is deliberately computed OUTSIDE the visionSuppressed guard above - see
    // items/senses/blindsight.mjs#getBlindsightRange's own doc comment for why suppressing it would
    // cancel the only Perk it exists for.
    this.system.blindsightRange = getBlindsightRange(this);
  }

  /**
   * Resistances granted "for the rest of the scene" (Hardened Armor, Elemental Adaptation) - see
   * mechanics/world/token-sync.mjs#grantSceneResistance. Additive only, like Fireproof above.
   */
  _prepareSceneResistances() {
    if (!this.system.resistances) {
      return;
    }

    for (const damageType of sceneResistancesOf(this)) {
      this.system.resistances[damageType] = true;
    }
  }

  /**
   * Sets system.energon.normal.max to this actor's lowest current Essence Score (p.104-105 - the
   * personal Energon pool equals the lowest Essence Score), for actors that can transform. Non-transforming actors (vehicles, etc.) keep
   * whatever value was set manually, since they may use system.energon.normal as literal fuel
   * capacity rather than the Cybertronian Energon Points resource.
   *
   * Note the assignment below is `=`, not `+=`: this method OWNS the value, which is why anything
   * wanting to add to the pool has to land after it. Spark of the Ancients (Enigma of
   * Combination, General Perk, p.41 - +2 maximum Energon) used to be a
   * branch at the bottom of this method for exactly that reason; it is now an ordinary Active
   * Effect on the compendium Perk itself (packs/eocitems/_source/Spark_Of_the_Ancients_*.json),
   * applied in the FINAL phase so core runs it after prepareDerivedData rather than before, where
   * this assignment would simply overwrite it. Any future "+N maximum Energon" effect needs that
   * same phase - see docs/ACTIVE_EFFECTS_UI_PLAN.md §13. The Perk's other two halves (1 Energon
   * back at each scene start, and always reading as the highest Energon on a scan) remain unbuilt: there is no scene-boundary hook and no scanner mechanic to hang
   * them on.
   */
  _prepareEnergon() {
    if (!this.system.canTransform) {
      return;
    }

    // Energon Battery, Cybertroid Catalyst and Organic Energon change this pool through their own
    // item rules (DerivedStat), applied after this method.
    const essences = this.system.essences;
    this.system.energon.normal.max = Math.min(essences.strength.value, essences.speed.value, essences.smarts.value, essences.social.value);

    // Mini-Con Master (Decepticon Directive p.50): Power Conduit Mini-Cons give +1 maximum Energon per
    // two docked.
    this.system.energon.normal.max += linkedBonuses(this).energonMax;

    // A Hint of Independence's Poor Energon Circulation: maximum Energon is the lowest Essence -1.
    if (imperfectionOf(this)?.n == 1) {
      this.system.energon.normal.max = Math.max(0, this.system.energon.normal.max - 1);
    }
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

    // Bulwark (Across the Stars, Armor Traits, p.82) - see armor.mjs's own doc comment for the
    // full RAW quote and the "min 1 Health on removal" gap. Summed across every equipped armor
    // carrying the trait, the same "more than one source can stack" shape Health-from-Origin/
    // Role-Points/Conditioning above already assume.
    const bulwarkArmor = this.items.documentsByType.armor
      ?.filter(armor => armor.system.equipped && armor.system.traits?.includes('bulwark')) ?? [];
    const bulwarkBonusHealth = bulwarkArmor
      .reduce((total, armor) => total + (armor.system.bulwarkHealthBonus ?? 0), 0);

    // A Megaform's origin is already a finished total: _prepareMegaformZordData and
    // _prepareMegaformCombinerData set it to combinedHealthMax, the sum of each participant's
    // own health.max - and each of those already includes that participant's Conditioning.
    // Adding the Megaform's Conditioning again counted it twice, so an undamaged Megazord's
    // token bar never filled. RAW agrees there is nothing on top: the PR CRB's Dino Megazord
    // (16/9/7/7/7) is the Tyrannosaurus's 8 doubled for Core Body plus 9+7+7+7 = 46, no more.
    // Only the GM's .bonus goes on top, which is what those two methods' own comments intend.
    if (this.type == 'megaform') {
      health.max = originStartingHealth + bonus;
      health.string = `${originStartingHealth} (${game.i18n.localize('E20.MegaformCombinedHealth')}) + ${bonus} (${bonusName})`;
      return;
    }

    // Compromised (Across the Stars, Space Vessel Condition, p.25): -1 maximum Health per stack.
    // Defeat at 0 is
    // mechanics/vehicles/vessel-conditions.mjs#syncVesselConditionConsequences.
    const compromised = getVesselConditionStacks(this, 'compromised');

    // Tough Together, a Mini-Con's Linked Health - the companion Perks (mechanics/companions/companions.mjs). Hard
    // Target's and Advanced / Perfect Link's (on the bonded partner) are DerivedStat rules.
    const linkedHealth = linkedBonuses(this).health;
    health.max = Math.max(0, originStartingHealth + rolePointsBonusHealth + conditioning + bonus + bulwarkBonusHealth - compromised + linkedHealth);
    health.string = `${originStartingHealth} (${originName}) + ${rolePointsBonusHealth} (${rolePointsName}) + ${conditioning} (${conditionName}) + ${bonus} (${bonusName})`
      + (bulwarkBonusHealth ? ` + ${bulwarkBonusHealth} (${game.i18n.localize('E20.ArmorTraitBulwark')})` : '')
      + (linkedHealth ? ` + ${linkedHealth} (${game.i18n.localize('E20.CompanionBonds')})` : '')
      + (compromised ? ` - ${compromised} (${game.i18n.localize('E20.StatusCompromised')})` : '');
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

    // Equipped Armor's Toughness/Evasion bonus (item.mjs#_prepareArmorBonuses, which already
    // folds in that Armor's own attached armor Upgrades) plus any unparented alt-mode armor
    // Upgrade (Transform, p.55/47 - a loose Upgrade Item with no parentId, only meaningful for
    // an actor that canTransform). PC-only: every other actor type (npc/companion/vehicle/zord)
    // has no Armor-item UI on its sheet and hand-types system.defenses.<x>.armor directly via
    // the Stat Editor instead (see stat-editor.mjs's own doc comment on this split), exactly as
    // Health/Movement's base fields work for those types. Computed fresh every prepareData pass,
    // purely in derived data (this function never calls actor.update()) - the old sheet-side
    // version of this same computation (base-actor-sheet.mjs _prepareItems) wrote the result
    // into that same system.defenses.<x>.armor stat via an actor.update(), which is why that
    // code is now gone; ADDED here on top of the stored .armor value below rather than replacing
    // it, so a world that already has a hand-typed PC .armor value (a GM workaround for this bug)
    // doesn't lose it - it simply becomes redundant with the equipped item and should be zeroed.
    // (Energy Resistor's immunity is a DerivedStat rule on the upgrade.)
    let itemArmorBonus = null;
    if (this.type == 'playerCharacter') {
      itemArmorBonus = { toughness: 0, evasion: 0 };
      for (const armorItem of equippedArmor) {
        // Power Armor (Table 8-5, p.118) IS the Ranger's Morphed form, not a suit worn alongside
        // it - see armor.mjs#isPowerArmor's own doc comment (USER RULING, 2026-09-24). It never
        // contributes here; while Morphed, defense.total below adds system.defenses.<x>.morphed
        // instead of this loop's total regardless.
        if (armorItem.system.isPowerArmor) {
          continue;
        }

        itemArmorBonus.toughness += parseInt(armorItem.system.totalBonusToughness) || 0;
        itemArmorBonus.evasion += parseInt(armorItem.system.totalBonusEvasion) || 0;
      }

      // Grid Connection (Field Guide p.67): a light Grid armor shell, +1 Toughness, while the
      // summoned Power Weapon lasts (weapon-perk-uses.mjs).
      if (isGridShellActive(this)) {
        itemArmorBonus.toughness += 1;
      }

      // A loose armor upgrade counts when the actor can transform (an alt-mode upgrade), or when an
      // Alteration grants its benefit "whether you're wearing armor or not" (Skin Tempering,
      // mechanics/resources/grants.mjs).
      {
        for (const upgrade of this.items.documentsByType?.upgrade ?? []) {
          if (upgrade.getFlag('essence20', 'parentId') || upgrade.system?.type != 'armor'
            || !(system.canTransform || upgrade.getFlag('essence20', 'alterationWorn')
              || [BOND.transtectorRig, BOND.rigReinforcement].includes(sourceOfItem(upgrade)))) {
            continue;
          }

          const value = Math.max(0, (parseInt(upgrade.system.armorBonus.value) || 0) - ablativeLossOf(upgrade));
          if (upgrade.system.armorBonus.defense == 'toughness') {
            itemArmorBonus.toughness += value;
          } else if (upgrade.system.armorBonus.defense == 'evasion') {
            itemArmorBonus.evasion += value;
          }
        }
      }
    }

    for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
      const defense = system.defenses[defenseType];
      const base = defense.base;
      const armor = defense.armor + (itemArmorBonus?.[defenseType] ?? 0);
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
          && (!rolePoints.system.isActivatable || rolePoints.system.isActive)
          // Hardened Armor (PR ATS Gold Ranger, p.52): "your Toughness Defense increases while
          // Morphed" - most defenseBonus Role Points apply unconditionally, so this is opt-in
          // per item via bonus.whileMorphed, same flag name/shape as an Active Effect's own
          // whileMorphed gate (mechanics/characters/morph-gated-effects.mjs).
          && (!rolePoints.system.bonus.whileMorphed || system.isMorphed)) {
          rolePointsName = rolePoints.name;

          if (this.system.level == 20) {
            rolePointsDefense = rolePoints.system.bonus.level20Value;
          } else {
            rolePointsDefense = rolePoints.system.bonus.startingValue + roleValueChange(this.system.level, rolePoints.system.bonus.increaseLevels);
          }

          // Aerial Interface extends this to the air vehicle being driven (vehicle-upgrades.mjs).
          if (rolePoints.system.isActivatable && rolePoints.system.isActive) {
            system.activeShieldDefense = { ...(system.activeShieldDefense ?? {}), [defenseType]: rolePointsDefense };
          }
        }
      }

      // H.I.S.S. Column (GI Joe CRB, Vehicle Trait, p.302): +1 Evasion per other H.I.S.S. on the
      // battlefield.
      // Recomputed fresh every prepareData pass (getHissColumnBonus scans the live scene), same
      // idiom as every other condition-gated bonus in this loop, so it tracks other H.I.S.S.
      // tokens entering/leaving the scene automatically.
      if (defenseType == 'evasion' && this.type == 'vehicle' && system.traits?.hissColumn) {
        perkDefenseBonus += getHissColumnBonus(this);
      }


      defense.total = base + essence + bonus + rolePointsDefense + perkDefenseBonus;
      defense.total += system.isMorphed ? morphed : armor;
      // The armor share just added (the Morphed shell, or stored + worn + loose-upgrade armor) - read by rules as
      // @actor.system.defenses.<defense>.armorShare (Imperial Machine Mantle's +50%).
      defense.armorShare = system.isMorphed ? morphed : armor;
      defense.total += shield;

      defense.string = `${base} (${baseName}) + ${essence} (${essenceName})`;
      defense.string += system.isMorphed ? ` + ${morphed} (${morphedName})` : ` + ${armor} (${armorName})`;
      defense.string += ` + ${shield} (${shieldName})`;
      defense.string += ` + ${bonus} (${bonusName}) + ${rolePointsDefense} (${rolePointsName})`;
      defense.string += ` + ${perkDefenseBonus} (${perkName})`;

      // (Imperial Machine Mantle is a Defense rule on the upgrade, over armorShare - rules/conv15-items1.test.js.)

      // Companion Perks: Reinforced Bond, Mini-Con Master. (Hard Target's, Armored Connection's and In The Right Hands'
      // Body Armor Segment are Defense rules.)
      const linkedDefense = linkedBonuses(this).defenses[defenseType] ?? 0;
      if (linkedDefense) {
        defense.total += linkedDefense;
        defense.string += ` ${linkedDefense < 0 ? '-' : '+'} ${Math.abs(linkedDefense)} (${game.i18n.localize('E20.CompanionBonds')})`;
      }

      // (Loader used as a shield in Bot Mode is a Defense rule on the Loader.)
      // A Hint of Independence's Fragile Chassis: "You have a -1 penalty to your Toughness Defense".
      if (defenseType == 'toughness' && imperfectionOf(this)?.n == 2) {
        defense.total -= 1;
        defense.string += ` - 1 (${game.i18n.localize('E20.Imperfection.2')})`;
      }

      // Defense damage - the Transformers Bewildering/Maiming/Surgical/Traumatic Critical Effects
      // (mechanics/combat/essence-damage.mjs), until a rest.
      const defenseDamage = defenseDamageOf(this)[defenseType] ?? 0;
      if (defenseDamage) {
        defense.total -= defenseDamage;
        defense.string += ` - ${defenseDamage} (${game.i18n.localize('E20.DefenseDamage')})`;
      }
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

    // Order matters here and is not alphabetical: 'climb' is processed AFTER 'ground' so a
    // climb-equals-ground rule (Wire Work's) can read ground's finished total. 'burrow' is
    // appended last because nothing derives from it - unlike climb and
    // swim it has no half-Ground default, since an actor only ever has Burrow Movement because
    // something explicitly granted it (Burrower, tsitems).
    // Item rules' Movement (rules/adapter.mjs#ruleMovementStages), at four points of the loop below.
    const movementRule = ruleMovementStages(this);
    const applyMovementRule = (stage, movementType, key = 'total') => {
      const next = movementRule(stage, movementType, Number(system.movement[movementType][key]) || 0);
      if (next !== null) {
        system.movement[movementType][key] = next;
      }
    };

    const movementTypes = ['aerial', 'ground', 'climb', 'swim', 'burrow'];
    // Stage bonus (Fast): each type's bonus, all of them first, since the loop below reads ground's
    // base + bonus while it works on aerial and swim (Jury Rig, Lightfoil Wings).
    for (const movementType of movementTypes) {
      applyMovementRule('bonus', movementType, 'bonus');
    }

    for (const movementType of movementTypes) {
      system.movement[movementType].base = parseInt(system.movement[movementType].base);
      applyMovementRule('base', movementType, 'base');
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

      applyMovementRule('total', movementType);

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

      applyMovementRule('adjust', movementType);

      // (High Gear's Ground Movement doubling is a Movement rule on the Feature, stage adjust - just above; a Megaform's
      // aggregate reads each Zord's own .base, so it never sees it.)

      // Emotional Mastery: Distress (A Jump Through Time, Purple Ranger, p.37) - +10ft to every
      // Movement when the turn starts within 10ft of an enemy.
      // Every Movement type, same live-read touch-point as Warrior Rush above (see
      // getDistressMovementBonus's own doc comment for the "whenever you begin your turn"
      // approximation).
      system.movement[movementType].total += getDistressMovementBonus(this);

      // The Tough Get Going (Factions in Action Vol. 2, Oktober Guard General Perk, p.95) - see
      // items/movement/the-tough-get-going.mjs's own doc comment. Ground only.
      if (movementType == 'ground' && isTheToughGetGoingActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // Power Adaptation - Boost of Speed (Across the Stars, Silver Ranger, 9th/18th level,
      // p.57) - see items/forms/power-adaptation.mjs's own doc comment. "Increase Movement by 20
      // feet" is read as the ground Movement specifically (this system's default "Movement"
      // stat), same reasoning Warrior Rush's own doubling above already applies broadly instead.
      if (movementType == 'ground' && isPowerAdaptationActive(this, 'boostOfSpeed')) {
        system.movement[movementType].total += 20;
      }

      // (Engine Override's +15ft Ground Movement is a Movement rule its mark carries - stage final, rules/conv15-banked.test.js.)

      // (Hup! Hup! Hup! Hup! Hup!'s Ground Movement bonus is a Movement rule its mark carries - stage final.)

      // Jury Rig - Engine Turbo-Boost / Watertight Seals (Factions in Action Vol. 2, Engineer
      // Troop Focus, 17th level, p.73) - see items/vehicles/jury-rig.mjs's own doc comment. Both grant
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

      // Fluttery Wings (MLP CRB, Elementary Aid spell, p.136) - see
      // items/magic/fluttery-wings.mjs's own doc comment. +15ft Aerial Movement while active.
      if (movementType == 'aerial') {
        system.movement.aerial.total += getFlutteryWingsBonus(this);
      }

      // Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
      // items/magic/hot-to-trot.mjs's own doc comment. "Move 15ft further with each Movement action" -
      // read as ground Movement (the spell's own flavor text, "quickly catch up to a friend
      // across town," points at ordinary ground travel, not flight).
      if (movementType == 'ground' && isHotToTrotActive(this)) {
        system.movement.ground.total += 15;
      }

      // Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139) - see
      // items/magic/lightning-speed.mjs's own doc comment. "Doubles all Movement rates" while active -
      // applied after the hand-written additions above (not gated on isMorphed).
      if (isLightningSpeedActive(this)) {
        system.movement[movementType].total *= 2;
      }

      // Fly In The Future's evasive maneuvers - an EvasiveManeuvers rule (rules/plugins/combat/evasive-maneuvers-rule.mjs).
      // The COST half of that toggle ("you may halve the speed of your Aerial vehicle"),
      // scoped to aerial movement specifically and applied after Lightning Speed above. Rounded
      // down, this project's standard halving.
      if (movementType == 'aerial' && ruleEvasiveManeuvers(this)) {
        system.movement[movementType].total = Math.floor(system.movement[movementType].total / 2);
      }

      applyMovementRule('final', movementType);
    }

    system.movementNotSet = !movementTotal;
    this._applyGravityMovement();
    // Item rules' Movement at stage afterGravity: on top of Low Gravity / Zero-G too (rules/adapter.mjs#ruleMovementStages).
    for (const movementType of Object.keys(system.movement ?? {})) {
      if (system.movement[movementType] && typeof system.movement[movementType] == 'object') {
        applyMovementRule('afterGravity', movementType);
      }
    }
  }

  /**
   * Low Gravity and Zero-G (Across the Stars, Exploring Infinite Environments, p.24-25), applied on
   * top of every other Movement change. Low Gravity: +10ft to each Movement type the creature
   * already has. Zero-G: all Movement works like Aerospace at 20ft/10ft - Aerial becomes 20 and every other type 0; the 10-foot inertia minimum has
   * no field to live in and stays a table rule. High Gravity's tripled cost is a movement-cost rule
   * instead (mechanics/world/rough-terrain.mjs), so the ruler shows it.
   *
   * Creatures only - vehicles, Zords and Megaforms print their own Aerospace Movement for this.
   * Records the environment it prepared against, so a token walking between Regions re-prepares
   * (mechanics/world/environment.mjs#refreshTerrainDependentActor).
   */
  _applyGravityMovement() {
    if (!['playerCharacter', 'npc', 'companion'].includes(this.type) || this.pack) {
      return;
    }

    const environment = getEnvironment(this, { includeInterior: false }) ?? DEFAULT_ENVIRONMENT;
    this._e20MovementEnvironment = environment;
    const movement = this.system.movement;
    if (environment == 'lowGravity') {
      for (const type of Object.keys(movement)) {
        if (movement[type]?.total > 0) {
          movement[type].total += 10;
        }
      }
    } else if (environment == 'zeroGravity') {
      for (const type of Object.keys(movement)) {
        if (movement[type] && typeof movement[type] == 'object') {
          movement[type].total = type == 'aerial' ? 20 : 0;
        }
      }
    }
  }

  /**
   * Prepares Sorcerous Power - a one-time BUILD budget (Finster's Monster-Matic Cookbook,
   * "Building Sorcerous Powers," p.274: 4 points to build with, +2 per level after taking the
   * Perk, and a built Power is used as often as it says), not a spendable-per-use pool. USER DECISION
   * (2026-09-24): Sorcerous Powers no longer spend `.value` on activation (see
   * sheet-handlers/power-handler.mjs#powerCost) - instead `.committed` tracks how much of the
   * budget is already spoken for by the actor's owned Sorcerous Powers, so the sheet can warn
   * (not block) if it exceeds `.max` rather than silently letting Powers run out mid-scene.
   */
  _prepareSorcerousPower() {
    const system = this.system;
    const levelMultiplier = system.level - system.powers.sorcerous.levelTaken;
    if (system.powers.sorcerous.levelTaken) {
      system.powers.sorcerous.max = (levelMultiplier * 2) + 4;
    } else {
      system.powers.sorcerous.max = 0;
    }

    system.powers.sorcerous.committed = this.items.documentsByType.power
      .filter(power => power.system.type == 'sorcerous')
      .reduce((total, power) => total + (parseInt(power.system.powerCost) || 0), 0);
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
    // Each participant's Megaform-only extra Health is collected again (mechanics/vehicles/megaform-bonus-health.mjs).
    resetParticipantBonuses(this);
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

    // Zords, and any Cybertronian joining them (Field Guide p.134) - mechanics/vehicles/megaform-participants.mjs.
    const participants = getMegaformParticipants(this, 'megazord');

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

    // A Zord at 0 Health no longer contributes in any way to the Megaform's abilities, attacks or features (PR CRB
    // p.140) - it still counts for Health and for Defeat. With every Zord down, the last numbers stand.
    const upZords = participants.filter(zord => !(Number(zord.system.health.max) > 0 && Number(zord.system.health.value) <= 0));
    const active = upZords.length ? upZords : participants;

    // The highest scores among the Combiner components AND their Crew (PR CRB p.140), to a maximum of 15.
    const crew = active.flatMap(zord => Object.values(zord.system.actors ?? {})
      .filter(entry => ['playerCharacter', 'npc'].includes(entry?.type))
      .map(entry => fromUuidSync(entry.uuid)).filter(Boolean));
    const scoreOf = (actor, essence) => {
      const own = actor.system?.essences?.[essence];
      return Number(own?.max ?? own?.value) || 0;
    };

    let strength = Math.max(...[...active, ...crew].map(part => scoreOf(part, 'strength')));
    let speed = Math.max(...[...active, ...crew].map(part => scoreOf(part, 'speed')));
    // Smarts and Social: a Zord has none of its own (its pilot's), so the Megazord's are its Crew's best - what its
    // Willpower / Cleverness use (mechanics/combat/combat.mjs#getDefenseValue).
    for (const essence of ['smarts', 'social']) {
      const best = Math.max(0, ...crew.map(pilot => scoreOf(pilot, essence)));
      if (system.essences[essence]) {
        system.essences[essence].value = crew.length ? Math.min(MAX_ESSENCE, best) : null;
      }
    }

    // Size: Towering, or Titanic if the team chose that (PR CRB p.144's Megazords; Beneath the Helmet p.74 step 10) -
    // never smaller.
    // A Megaform with a Cybertronian in it is one Size Class larger than its largest component, Titanic at most (Field
    // Guide p.134).
    if (participants.some(part => part.type != 'zord')) {
      const largest = Math.max(0, ...participants.map(part => sizeClassIndex(part.system.size)));
      system.size = SIZE_CLASSES[Math.min(SIZE_CLASSES.length - 1, largest + 1)];
    } else if (sizeClassIndex(system.size) < sizeClassIndex('towering')) {
      system.size = 'towering';
    }

    // The Megaform only has a basic Ground Movement type unless a Move trait grants
    // another; set that baseline now so the Move trait loop below can add to it.
    for (const movementType of Object.keys(system.movement)) {
      system.movement[movementType].base = 0;
    }

    system.movement.ground.base = Math.min(...active.map(
      zord => zord.system.movement.ground.total || zord.system.movement.ground.base,
    ));

    let toughnessTraitBonus = 0;
    let evasionTraitBonus = 0;
    let hasEnhancedAttack = false;
    let hasAssaultWeapon = false;
    let hasTenaciousBonds = false;
    let combinedHealthMax = 0;
    let combinedHealthValue = 0;

    for (const zord of active) {
      const hasCoreBody = zord.items.some(
        item => item.type == 'megaformTrait' && item.system.type == 'coreBody',
      );
      let layeredSystemsBonus = 0;

      // The participant's MegaformArmor rules (Hardened Chassis) - the armor part of the Megaform's Defenses.
      const contributed = megaformArmorOf(zord, 'megazord');
      toughnessTraitBonus += contributed.toughness;
      evasionTraitBonus += contributed.evasion;

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
        // A trait whose MegaformArmor rule says what it adds (replacesTrait - Armored Defense) adds nothing by its type.
        if (item.type != 'megaformTrait' || traitReplaced(item)) {
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
          // Across the Stars, p.104: +1 to the Megaform's adjusted Toughness.
          // The reactive half (the pilot spends 1 Personal Power to Snag an attack on the
          // Megaform) needs a "react to an incoming attack" hook this
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
          // Across the Stars, p.105: +3 Health to this Zord's own section, after the Core Body
          // multiplier - a flat bonus to just this Zord's own
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
          // Across the Stars, p.105: one of the Zord's Resistances covers the whole Megaform.
          system.resistances[item.system.damageType] = true;
          break;
        }
      }

      // Core Body doubles this Zord's Health while in the Megaform; Layered Systems adds to it after that. Extra Health
      // that damage through the Megaform uses up first (mechanics/vehicles/megaform-bonus-health.mjs).
      addParticipantBonus(this, zord, (hasCoreBody ? zord.system.health.max : 0) + layeredSystemsBonus);
    }

    // Every Zord's own Health, before the extras above (finishParticipantHealth adds them).
    for (const zord of participants) {
      combinedHealthMax += zord.system.health.max;
      combinedHealthValue += Math.max(0, zord.system.health.value);
    }

    // Tenacious Bonds (A Jump Through Time, p.84): +1 Health to every component Zord, after the
    // Core Body multiplier, counted once per Megaform however many carry it - a flat, non-stacking +1
    // per participant (not per instance of the trait across multiple holders), so this is a
    // single conditional add after the main loop rather than accumulated inside it.
    if (hasTenaciousBonds) {
      for (const zord of participants) {
        addParticipantBonus(this, zord, 1);
      }
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

    // Stun (p.170: tracked as Stun / Health, Stun damage adding to Stun rather than coming off
    // Health) isn't pooled either, for the same reason
    // Health isn't - each participant tracks its own, and mechanics/vehicles/megaform-damage.mjs's
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
    // Size CLASSES only (mechanics/combat/size-classes.mjs): Long and the Extended sizes are the elongated footprints of
    // the class before them, so "one Size Class larger" (EoC p.42) must not land on them - two Large members are Huge,
    // not Long. An elongated member counts as its class.
    const sizeOrder = SIZE_CLASSES;
    const giganticIndex = sizeOrder.indexOf('gigantic');
    const sizeClassOf = sizeClassIndex;

    const participants = getMegaformParticipants(this, 'combiner');

    // Hardpoints (EoC p.44): two External, plus one Integrated per component member.
    if (system.hardpoints) {
      system.hardpoints.external.base = 2;
      system.hardpoints.integrated.base = participants.length;
    }

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
      ...participants.map(component => Math.max(0, sizeClassOf(component.system.size))),
    );
    if (participants.length <= 3) {
      system.size = sizeOrder[Math.min(sizeOrder.length - 1, largestComponentIndex + 1)];
    } else {
      const hasGiganticOrLarger = participants.some(
        component => sizeClassOf(component.system.size) >= giganticIndex,
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

          // Better as One (Component Ace Focus, 10th level, p.34): the component's own Skill
          // Specializations carry over to the Combiner form. A holder's own Specializations in this skill are merged in even when they
          // weren't the essence's high-score "winner" above (whose own Specializations were
          // already carried over by the deepClone just above).
          for (const component of participants) {
            if (component === winner || !sharesSpecializations(component)) {
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

    // A Combiner is one being with its own Smarts and Social (EoC p.42: its highest Essences "set the base Defenses"):
    // Willpower and Cleverness are 10 + the Essence like anyone's, not a Megazord's pilot stand-in (the zordBase schema's
    // null base, which left them at the bare Essence - 9 and 8 for Bruticus instead of 19 and 18).
    for (const defenseType of ['willpower', 'cleverness']) {
      if (system.defenses[defenseType]) {
        system.defenses[defenseType].base = 10;
        system.defenses[defenseType].usesDrivers = false;
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
    // A type only some members have is not the form's (a lone flier doesn't make the form fly - EoC's own stat blocks
    // get Aerial from Additional Movement): the slowest rate counts only when every member has the type.
    // Bot Mode rates (EoC p.42): a member still in an Alt Mode counts its Bot Mode's, not the Alt Mode's movement.
    const botModeRate = (component, movementType) => {
      const movement = component.system.movement?.[movementType];
      return component.system.isTransformed
        ? (Number(movement?.base) || 0) + (Number(movement?.bonus) || 0)
        : Number(movement?.total) || 0;
    };

    for (const movementType of Object.keys(system.movement)) {
      const rates = participants.map(component => botModeRate(component, movementType));
      system.movement[movementType].base = rates.length && rates.every(rate => rate > 0) ? Math.min(...rates) : 0;
    }

    // Combiner Features always apply - reusing the same megaformTrait items as a Megazord's
    // Megaform Traits (see the class comment above for why). Accurate Combiner, Compensation,
    // and Detachable are intentionally not handled here, for the same reasons documented in
    // _prepareMegaformZordData's own identical comment (a per-roll dice.mjs hook, the
    // still-missing Megaform damage-distribution mechanic, and an out-of-turn action this
    // system already supports the core of via the ordinary system.actors remove control,
    // respectively). Safe Release (Enigma of Combination, p.42: a forced exit from a Combiner leaves
    // at least 1 Health) and Universal Receptors (p.43: one fewer Story Point to merge with
    // Combiner-capable NPCs) are likewise unhandled here -
    // Safe Release needs Phase 4's still-unbuilt Vehicle/Megaform Defeat subsystem to have
    // anything to guard against, and Universal Receptors discounts a Story Point cost this system
    // doesn't charge anywhere yet (no code currently spends one for an NPC joining a Combiner).
    // Both are real, selectable Item types now so a sheet can record who holds them; the
    // mechanical payoff waits on those prerequisite gaps closing.
    let toughnessTraitBonus = 0;
    let evasionTraitBonus = 0;
    let hasTenaciousBonds = false;
    let hasCommander = false;
    let commanderSkills = null;
    let commanderHolder = null;
    let commanderEssences = null;
    let layeredSystemsBonus = 0;
    let hasEnhancedInitiative = false;
    let hasTitanHardpoint = false;
    for (const component of participants) {
      // The component's MegaformArmor rules (Armored Defense) - the armor part of the Combiner form's Defenses.
      const contributed = megaformArmorOf(component, 'combiner');
      toughnessTraitBonus += contributed.toughness;
      evasionTraitBonus += contributed.evasion;
      for (const item of component.items) {
        if (item.type != 'megaformTrait' || traitReplaced(item)) {
          continue;
        }

        switch (item.system.type) {
        case 'coreAbility':
          if (['strength', 'speed', 'smarts', 'social'].includes(item.system.essence)) {
            system.essences[item.system.essence].value = Math.min(
              MAX_ESSENCE, system.essences[item.system.essence].value + item.system.value,
            );
          }

          // Core Essence (Enigma of Combination, p.42): "increasing one associated Skill accordingly"
          // - the Skill named on the feature gets the matching upshift, same shape as Skill Expertise.
          if (item.system.skill && system.skills[item.system.skill]) {
            system.skills[item.system.skill].shiftUp += item.system.value;
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
          // Additional Movement (EoC p.42) GIVES the form a second Movement Type (its Alt Mode's, at the speed set on the
          // item); Enhanced Move adds +10 feet to one the form already has.
          if (sourceOfItem(item) == ZORD2.additionalMovement) {
            system.movement[item.system.movementType].base = Math.max(system.movement[item.system.movementType].base, Number(item.system.value) || 0);
          } else if (system.movement[item.system.movementType].base > 0) {
            system.movement[item.system.movementType].base += item.system.value;
          }

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
          // Enigma of Combination, p.42: ↑1 on each chosen Skill for the Combiner form
          // - an upshift, not a flat modifier (the shift glyph drops in this book's own text
          // extraction, the same lossy-glyph gotcha already documented for Weak Point/
          // Technostalgic elsewhere in this project). "Choose TWO Skills" is modeled as two
          // separate megaformTrait items (this file's own doc comment on the schema explains
          // why), so this case only ever needs to add one skill's worth per item.
          if (system.skills[item.system.skill]) {
            system.skills[item.system.skill].shiftUp += item.system.value;
          }

          break;
        case 'enhancedInitiative':
          hasEnhancedInitiative = true;
          break;
        case 'titanHardpoint':
          hasTitanHardpoint = true;
          break;
        case 'commander':
          // Enigma of Combination, p.42: the HOLDER notes their own two highest Essence Scores and the
          // Combined Form's scores in those two Essences go up by 1 - once per Combiner however many hold it
          // (the first holder's), applied after every other Essence bonus is tallied.
          // The holder's per-Essence Skill picks (the item's Use button, extensions/r2misc/
          // commander.mjs) ride along - the first holder with picks wins, since it applies once.
          hasCommander = true;
          commanderHolder ??= component;
          commanderSkills ??= item.flags?.essence20?.[COMMANDER_SKILLS_FLAG] ?? null;
          // The two Essences a stat block names ("Commander [Strength, Speed]" - stat block import) - RAW's "choose in
          // the case of equal values", made ahead of time.
          commanderEssences ??= item.flags?.essence20?.commanderEssences ?? null;
          break;
        }
      }
    }

    system.defenses.toughness.armor += toughnessTraitBonus;
    system.defenses.evasion.armor += evasionTraitBonus;

    // Only for Combiner forms of Gigantic Size or bigger - reuses
    // this same function's own sizeOrder/giganticIndex (already computed above for the
    // Titanic/Towering Titanspark-adjacent check), read AFTER system.size was finalized just above.
    if (hasCommander && sizeOrder.indexOf(system.size) >= giganticIndex) {
      // RAW breaks a tie between equal Essence Scores by player choice; this system has no
      // mid-computation player-choice hook, so ties fall back to a fixed Essence order
      // (Strength > Speed > Smarts > Social), the same "narrative choice left to a deterministic
      // default" simplification this codebase already accepts elsewhere. "Increasing two
      // associated Skills accordingly": an Essence maps to 3-4 Skills, so the holder picks one
      // Skill per Essence ahead of time (the Commander's Use button) and whichever two Essences
      // are raised here give their picked Skill ↑1 - the same upshift Core Essence gives its one
      // Skill above. An Essence with no pick (or a pick that isn't one of its Skills) raises none.
      const essenceOrder = ['strength', 'speed', 'smarts', 'social'];
      const holderScore = essence => {
        const own = commanderHolder?.system?.essences?.[essence];
        return Number(own?.max ?? own?.value) || 0;
      };

      const named = (commanderEssences ?? []).filter(essence => essenceOrder.includes(essence));
      const topTwoEssences = named.length == 2 ? named : [...essenceOrder]
        .sort((a, b) => holderScore(b) - holderScore(a))
        .slice(0, 2);
      for (const essence of topTwoEssences) {
        system.essences[essence].value = Math.min(MAX_ESSENCE, system.essences[essence].value + 1);

        const skill = commanderSkills?.[essence];
        if (skill && (CONFIG.E20.skillsByEssence[essence] ?? []).includes(skill) && system.skills[skill]) {
          system.skills[skill].shiftUp = (Number(system.skills[skill].shiftUp) || 0) + 1;
        }
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
    // Keep it Together! (Component Ace Focus, 17th level, p.34): the combined form holds together
    // while the holder has Health left - overrides the normal
    // majority-defeated rule entirely while ANY component holding the Perk is still above 0
    // Health, regardless of how many other components have fallen.
    const hasKeepItTogetherHolderStanding = participants.some(
      component => component.system.health.value > 0 && holdsMegaformTogether(component),
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
   * Every visible sign of being Morphed or in an Alt Mode - status effect, ring tint, chat line -
   * follows the two flags from here, so it does not matter which path flipped them (the sheet
   * buttons, the TAH helpers below, or a Perk toggling the flag directly). See
   * mechanics/characters/morph-state.mjs.
   * @override
   */
  _onUpdate(changed, options, userId) {
    super._onUpdate?.(changed, options, userId);
    syncMorphState(this, changed, options, userId).catch(err => {
      console.error("essence20 | Failed to sync Morphed / Alt Mode state", err);
    });
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

/**
 * The Megaform type a new one starts as, by the world's game line (settings.js#getGameLine): Power Rangers - a Megazord;
 * anything else, All included - a Transformers Combiner.
 * @param {String} gameLine
 * @returns {String}
 */
export function defaultMegaformSubtype(gameLine) {
  return gameLine == 'powerRangers' ? 'megaformZord' : 'megaformCombiner';
}
