import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";
import { updateRoleCache } from "../helpers/utils.mjs";
import { placeAoeTemplate } from "../helpers/aoe-targeting.mjs";
import { applyShapedCharges } from "../helpers/shaped-charges.mjs";
import { applyHorseshoesAndHandgrenades } from "../helpers/horseshoes-and-handgrenades.mjs";
import { applyMightyStrikes } from "../helpers/mighty-strikes.mjs";
import { applyNoNeedToAim } from "../helpers/no-need-to-aim.mjs";
import { actorHasPerk } from "../helpers/perks.mjs";
import { pickEnchantSkill } from "../helpers/enchant.mjs";
import { autoTargetExplosiveBeam } from "../helpers/explosive-beam.mjs";
import { autoTargetBeamVolley } from "../helpers/beam-volley.mjs";
import { pickBestowExpertise } from "../helpers/bestow-expertise.mjs";
import { pickMindBeamEffect } from "../helpers/mind-beam.mjs";
import { pickGetToKnowSkill } from "../helpers/get-to-know.mjs";
import { isBlockMagicActive } from "../helpers/block-magic.mjs";

const KNIGHTS_OF_CANTERLOT = "Compendium.essence20.knights_of_canterlot.Item.";
const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";

// Adaptable (GI Joe CRB, Scout Focus, 3rd level, p.91): "you gain twice the number of Adaptation
// Points as the Ranger Role chart at this level and as you advance in this Role." Doubles the
// computed resource.max specifically for the actor's own Adaptation Points rolePoints item - see
// _prepareRolePoints()'s own doubling check below, gated tightly on ADAPTION_POINTS_ID so no other
// rolePoints item across any book is affected.
const ADAPTION_POINTS_ID = `${GI_JOE_CRB}tqiseYDXnEngUlvd`;
const ADAPTABLE_ID = `${GI_JOE_CRB}98q6O79HKMPEh4aZ`;
const FIELDTEST_ID = `${GI_JOE_CRB}bPMgz1ct8T0kgQ6K`;

// Brutal Might (Enigma of Combination, Pugilist Focus, Warrior, 3rd level, p.38): "any of your
// attacks that normally use the Might Skill can use your Brawn Skill instead." A genuine SKILL
// SUBSTITUTION for the roll itself - not a shift-delta like Cunning Plan/How Strange! (those
// convert a shift-list-position difference into a bonus on the SAME already-chosen skill) - so it
// has to happen here, at the earliest point a weaponEffect's own classification skill is read,
// before shift/shiftUp/shiftDown/isSpecialized are ever looked up. "Can" is read as "always does,
// when held and the weapon's own skill is Might" (same idiom as Psychological Warfare's own
// Evasion-Defense substitution) - not offered as a checkbox, since there's no situation where a
// Pugilist would prefer the worse of the two. this.system.classification.skill itself is left
// untouched (still reads 'might' for anything else that inspects the weaponEffect Item directly,
// e.g. dice.mjs's own Brutal-Might Edge check, which needs to know the ORIGINAL skill to avoid
// matching an unrelated genuine Brawn attack).
const BRUTAL_MIGHT_ID = "Compendium.essence20.enigma_of_combination.Item.l0STCEYBuPMYfzSt";

// Beastly (Ferocious Fighters, New Influence, p.75) / its own Hang-Up (p.78): "Your Unarmed
// Combat attack's Blunt damage Alternate Effect no longer suffers -1" (Perk) / "Your Unarmed
// Combat attack's Stun effect suffers -1" (Hang-Up). Both target one SPECIFIC weaponEffect item's
// own inherent system.shiftDown (confirmed via the real compendium JSON: Unarmed Combat Alternate
// Effect 1 - Blunt - already carries shiftDown:1, matching "no longer suffers -1" meaning it drops
// to 0; Unarmed Combat Effect - the base Stun attack - carries shiftDown:0, and the Hang-Up adds
// the -1 it doesn't otherwise have) rather than any actor-level field, so unlike a plain
// compendium Active Effect this has to be a live check at the exact point below where a
// weaponEffect's own system.shiftDown folds into the roll - gated on the item actually being one
// of these two specific compendium items (same flags.core.sourceId-vs-_stats.compendiumSource
// dual check the weaponSourceId lookups elsewhere in this project already use). Not a one-time
// item.update() (the Weapon Conversion/grant idiom) since the actor may add Unarmed Combat to
// their sheet AFTER taking either the Perk or the Hang-Up - a live check catches that
// automatically, a one-time mutation at grant time would not.
const UNARMED_COMBAT_ALTERNATE_EFFECT_1_ID = `${GI_JOE_CRB}gA0rOFD3lmwzkZq4`;
const UNARMED_COMBAT_EFFECT_ID = `${GI_JOE_CRB}eDjovjfygGq8dlQy`;
const BEASTLY_PERK_ID = "Compendium.essence20.ferocious_fighters.Item.3Y0ETFpJUwdUqgUQ";
const BEASTLY_HANG_UP_ID = "Compendium.essence20.ferocious_fighters.Item.9o0Qbe6lgqNPnm2R";

// Enchant (MLP CRB, Elementary Enchantment spell, p.136) - see helpers/enchant.mjs's own doc
// comment. The one hardcoded per-spell-id check in this otherwise fully generic spell-cast
// branch below, needed because the skill choice must be picked BEFORE the roll (nothing else in
// this codebase intercepts a spell cast pre-roll the way onPowerUse does for Grid/Sorcerous
// Powers).
const ENCHANT_ID = `${MLP_CRB}afYeCCAX0o2Cwf2I`;

// Explosive Beam (MLP CRB, Superior Beam spell, p.137) - see helpers/explosive-beam.mjs's own
// doc comment. A second per-spell-id pre-roll hook, alongside Enchant's own - auto-targets nearby
// enemies before the roll fires (no picker needed, so no early-return-on-cancel like Enchant).
const EXPLOSIVE_BEAM_ID = `${MLP_CRB}VLdz7YvUq2AaUFNz`;

// Beam Volley (MLP CRB, Virtuoso Beam spell, p.138) - see helpers/beam-volley.mjs's own doc
// comment. Same auto-target-before-rolling shape as Explosive Beam.
const BEAM_VOLLEY_ID = `${MLP_CRB}UhkhFqFDYjub1a8k`;

// Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137) - see
// helpers/bestow-expertise.mjs's own doc comment. A third per-spell-id pre-roll hook, alongside
// Enchant's own - picks the Skill AND the new Specialization's own free-typed name before rolling.
const BESTOW_EXPERTISE_ID = `${MLP_CRB}stwnP4um6j1xxzIo`;

// Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see helpers/mind-beam.mjs's own doc comment.
// A fifth per-spell-id pre-roll hook, alongside Enchant/Bestow Expertise's own - picks which
// Condition this cast applies before the roll fires.
const MIND_BEAM_ID = `${MLP_CRB}gF8otV8Ag9axRp2Z`;

const DARK_SKIES_OVER_EQUESTRIA = "Compendium.essence20.dark_skies_over_equestria.Item.";

// Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21) - see
// helpers/get-to-know.mjs's own doc comment. A sixth per-spell-id pre-roll hook - picks the
// related Skill before the roll fires.
const GET_TO_KNOW_ID = `${DARK_SKIES_OVER_EQUESTRIA}pyRy1dFwuiJpAKj2`;

// Efficient Spellcaster / Master Spellcaster (General Perks, p.38): "reduce the total casting
// cost of any Elementary/Superior spell you cast by ↓1, to a minimum of ↓1." Casting cost is
// already a real tracked field (spell.mjs's own system.cost, read below) - no new mastery/rank
// tracking is needed, despite an earlier categorization pass assuming otherwise.
const EFFICIENT_SPELLCASTER_ID = `${KNIGHTS_OF_CANTERLOT}eQDQwKQfRQU8obWF`;
const MASTER_SPELLCASTER_ID = `${KNIGHTS_OF_CANTERLOT}tEOoAvzj42d20QHu`;

// Power Conservationist / Power Mastery (General Perks, p.38): "delay the cost of casting the
// spell until after you have cast it - your Spellcasting Skill Test is made before it is
// reduced." Both read as the same deferral in this codebase's terms (this system has no separate
// "augment cost" distinct from a spell's own system.cost to tell them apart) - see the spell-cast
// branch below.
const POWER_CONSERVATIONIST_ID = `${KNIGHTS_OF_CANTERLOT}75H9N2YqaSDUhiCQ`;
const POWER_MASTERY_ID = `${KNIGHTS_OF_CANTERLOT}qDsWwo5ipmzMMuO4`;

// Block Magic (Knights of Canterlot, Virtuoso Enchantment spell, p.49) - see
// helpers/block-magic.mjs's own doc comment. "+1 to the cost of any spell you cast" while a
// target is under its effect - read directly below, in the one place every spell's own casting
// cost is already computed.
const BLOCK_MAGIC_ID = `${KNIGHTS_OF_CANTERLOT}J1jUwu4IIuPxQE10`;

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class Essence20Item extends Item {
  constructor(item, options) {
    super(item, options);
    this._dice = new Dice(ChatMessage, new RollDialog(), game.i18n);
  }


  /** @override */
  async delete(operation) {
    super.delete(operation);

    if (this.type == 'role' && this.pack) {
      await updateRoleCache();
    }
  }

  /** @override */
  async _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);

    if (this.type == 'role'&& this.pack) {
      await updateRoleCache();
    }
  }

  /**
   * Sets the basic values of an item after creation but before opening its sheet.
   * @param {Object} data The information about the item.
   * @param {Object} options The options from the sheet
   * @param {String} userId The user creating the item
   */
  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);
    if (data.img === undefined) {
      const image = CONFIG.E20.defaultIcon[this.type];
      if (image) this.updateSource({ img: image });
    }
  }

  /** @override */
  async _onUpdate(change, options, userId) {
    super._onUpdate(change, options, userId);

    if (this.type == 'role') {
      await updateRoleCache();
    }

    // Update the entry on the parent if this is a child Item
    if (['weaponEffect', 'upgrade'].includes(this.type)) {
      const parentId = this.flags.essence20?.parentId;
      const parentItem = this.actor?.items?.get(parentId);
      const key = this.flags.essence20?.collectionId;

      if (parentItem && key) {
        const entry = createEntry(this, parentItem);
        const pathPrefix = "system.items";

        await parentItem.update({
          [`${pathPrefix}.${key}`]: entry,
        });
      }
    }
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
  * Extends the preparedDerivedData model to add system specific data.
  */
  prepareDerivedData() {
    super.prepareDerivedData();
    this._prepareTraits();

    if (this.type == 'weapon' || this.type == 'armor') {
      this._prepareTotalAvailability();
    }

    if (this.type == 'armor') {
      this._prepareArmorBonuses();
    } else if (this.type == 'weapon') {
      this._prepareAimShiftBonus();
    } else if (this.type == 'rolePoints') {
      this._prepareRolePoints();
    }
  }

  /**
  * Prepares the item and any upgrade traits currently on the item
  */
  _prepareTraits() {
    let itemAndUpgradeTraits = this.system.traits;
    let upgradeTraits = [];

    if (this.type == 'weapon' || this.type == 'armor') {
      for (const [, item] of Object.entries(this.system.items)) {
        if (item.type == 'upgrade') {
          upgradeTraits.push(item.traits);

          for (const traits of upgradeTraits) {
            if (traits) {
              for (const trait of traits) {
                if (!itemAndUpgradeTraits.includes(trait)) {
                  itemAndUpgradeTraits.push(trait);
                }
              }
            }
          }
        }
      }

      if (itemAndUpgradeTraits) {
        this.system.itemAndUpgradeTraits = itemAndUpgradeTraits;
      }
    }
  }

  /**
  * Prepares the combined armor bonuses from the armor and any upgrades
  */
  _prepareArmorBonuses() {
    let armorBonusToughness = this.system.bonusToughness;
    let armorBonusEvasion  = this.system.bonusEvasion;

    for (const [, item] of Object.entries(this.system.items)) {
      if (item.type == 'upgrade' && item.subtype == 'armor'){
        if (item.armorBonus.defense == 'toughness') {
          armorBonusToughness += item.armorBonus.value;
        } else if (item.armorBonus.defense == 'evasion') {
          armorBonusEvasion += item.armorBonus.value;
        }
      }
    }

    this.system.totalBonusEvasion = armorBonusEvasion;
    this.system.totalBonusToughness = armorBonusToughness;
  }

  /**
  * Prepares the total Aiming shift bonus (p.192) granted by any attached Upgrades (e.g. a
  * Laser Sight, p.148/125) on this weapon
  */
  _prepareAimShiftBonus() {
    let totalAimShiftBonus = 0;

    for (const [, item] of Object.entries(this.system.items)) {
      if (item.type == 'upgrade' && item.subtype == 'weapon') {
        totalAimShiftBonus += item.aimShiftBonus || 0;
      }
    }

    this.system.totalAimShiftBonus = totalAimShiftBonus;
  }

  /**
  * Prepares the combined Availability tier that must be Requisitioned to acquire this
  * weapon or armor as currently upgraded, per Table 8-2: Upgrading Equipment. Starts from
  * the item's own Availability and folds in each attached Upgrade's Availability in turn.
  */
  _prepareTotalAvailability() {
    let totalAvailability = this.system.availability;

    for (const [, item] of Object.entries(this.system.items)) {
      if (item.type == 'upgrade') {
        totalAvailability = this._getCombinedAvailability(totalAvailability, item.availability);
      }
    }

    // Fieldtest (GI Joe CRB, Technician, 13th level, p.104): "you treat the availability of
    // equipment and upgrades as one step more available." "Stacks with the benefits of Secondary
    // Tech" is moot for now - Secondary Tech itself is unbuilt (no item-grant mechanism exists to
    // hand out its own bonus gear yet).
    if (this.actor && actorHasPerk(this.actor, FIELDTEST_ID)) {
      totalAvailability = this._stepAvailability(totalAvailability, -1);
    }

    this.system.totalAvailability = totalAvailability;
  }

  /**
   * Steps an Availability tier toward more (negative steps) or less (positive steps) available,
   * per CONFIG.E20.availabilities' own declared tier order, clamped at both ends.
   * @param {String} tier   A tier key from CONFIG.E20.availabilities.
   * @param {Number} steps   How many tiers to move (negative = more available).
   * @returns {String}
   */
  _stepAvailability(tier, steps) {
    const tierOrder = Object.keys(CONFIG.E20.availabilities);
    const rank = tierOrder.indexOf(tier);
    if (rank == -1) {
      return tier;
    }

    const clamped = Math.max(0, Math.min(tierOrder.length - 1, rank + steps));
    return tierOrder[clamped];
  }

  /**
  * Combines two equipment Availability tiers per Table 8-2: Upgrading Equipment.
  * @param {String} tierA   An Availability tier key from CONFIG.E20.availabilities.
  * @param {String} tierB   Another Availability tier key from CONFIG.E20.availabilities.
  * @returns {String}   The resultant combined Availability tier.
  */
  _getCombinedAvailability(tierA, tierB) {
    const CEILING = 'theoretical';
    if (tierA == CEILING || tierB == CEILING) {
      return CEILING;
    }

    // Table 8-2 doesn't have a row/column for Automatic; treat it as equivalent to
    // Standard, the table's lowest defined tier.
    const normalize = tier => tier == 'automatic' ? 'standard' : tier;
    const normA = normalize(tierA);
    const normB = normalize(tierB);
    const combined = CONFIG.E20.upgradeAvailabilityMatrix[normA]?.[normB];

    if (combined) {
      return combined;
    }

    // "Other" or any tier Table 8-2 doesn't define a combination for: fall back to
    // keeping the higher of the two tiers, with no further escalation.
    const tierOrder = Object.keys(CONFIG.E20.availabilities);
    const rankA = tierOrder.indexOf(tierA);
    const rankB = tierOrder.indexOf(tierB);

    return rankA >= rankB ? tierA : tierB;
  }

  /**
   * Finds the number of Role Points the actor currently has.
   */
  _prepareRolePoints() {
    if (!this.actor) return null;

    // A RolePoints Item granted by an "additive" Role (system.isAdditive, e.g. G.I. Joe's Old
    // Hand - see role-handler.mjs) runs on that Role's own independent level track instead of
    // the Actor's real character level. This method is called implicitly by Foundry's
    // prepareDerivedData() pipeline, not by any level-change handler, so there's no parameter
    // to receive that override through - it has to look it up itself via the same parentId
    // flag deleteAttachmentsForItem() already uses to identify which Role granted an Item.
    let actorLevel = this.actor.system.level;
    const owningRole = this.actor.items.get(this.getFlag('essence20', 'parentId'));
    if (owningRole?.type == 'role' && owningRole.system.isAdditive && this.actor.system.oldHandTransitionLevel) {
      actorLevel = this.actor.system.level - this.actor.system.oldHandTransitionLevel + 1;
    }

    const resourceLevelIncreases = this._getLevelIncreases(this.system.resource.increaseLevels, actorLevel);

    if (this.system.resource.startingMax != null) {
      if (actorLevel == 20 && this.system.resource.level20Value) {
        this.system.resource.max = this.system.resource.level20Value;
      } else {
        this.system.resource.max = this.system.resource.startingMax + (this.system.resource.increase * resourceLevelIncreases);
      }

      // Adaptable - see ADAPTABLE_ID's own comment above.
      const sourceId = this.flags?.core?.sourceId ?? this._stats?.compendiumSource;
      if (sourceId == ADAPTION_POINTS_ID && actorHasPerk(this.actor, ADAPTABLE_ID)) {
        this.system.resource.max *= 2;
      }
    }

    if (this.system.bonus.startingValue != null) {
      if (this.system.bonus.type != 'none') {
        const bonusLevelIncreases = this._getLevelIncreases(this.system.bonus.increaseLevels, actorLevel);

        if (actorLevel == 20 && this.system.bonus.level20Value) {
          this.system.bonus.value = this.system.bonus.level20Value;
        } else {
          this.system.bonus.value = this.system.bonus.startingValue + (this.system.bonus.increase * bonusLevelIncreases);
        }
      }
    }
  }

  /**
   * Determines the number of increases that have occured based on the level of the actor
   * @param {String[]} levels The array of levels that you advance at
   * @param {Number} currentLevel The current level of the actor
   * @returns {Number} The number of increases for the level of the actor
   */
  _getLevelIncreases(levels, currentLevel) {
    let levelIncreases = 0;
    for (const arrayLevel of levels) {

      const level = arrayLevel.replace(/[^0-9]/g, '');
      if (level <= currentLevel) {
        levelIncreases += 1;
      }
    }

    return levelIncreases;
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
  getRollData() {
    // If present, return the actor's roll data.
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} childRoller Optional attached Actor making the roll
   */
  async roll(dataset, childRoller=null) {
    if (dataset.rollType == 'info') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      const template = `systems/essence20/templates/actor/parts/items/${this.type}/details.hbs`;
      let templateData = {};

      if (this.type == 'origin') {
        templateData = {
          config: CONFIG.E20,
          item: {
            ...this,
            skillsString: this.system.skills.map(skill => {
              return CONFIG.E20.originSkills[skill];
            }).join(", "),
            essenceString: this.system.essences.map(essence => {
              return CONFIG.E20.originEssences[essence];
            }).join(", "),
          },
        };
      } else {
        templateData = {
          config: CONFIG.E20,
          item: this,
        };
      }

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: await foundry.applications.handlebars.renderTemplate(template, templateData),
      });
    } else if (this.type == 'perk') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      let content = `Source: ${this.system.source || 'None'} <br>`;
      content += `Prerequisite: ${this.system.prerequisite || 'None'} <br>`;
      content += `Description: ${this.system.description || 'None'}`;

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: content,
      });
    } else if (this.type == 'power') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type.toUpperCase()}] ${this.name}`;
      const descriptionStr = game.i18n.localize('E20.ItemDescription');

      let content = `<b>${descriptionStr}</b> - ${this.system.description}<br>`;

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: content,
      });
    } else if (this.type == 'weaponEffect') {
      // Area of Effect (GitHub #824) - see helpers/aoe-targeting.mjs's own doc comment. Only
      // Blast/AoE-shaped attacks (system.shape set) trigger this; an ordinary single-target or
      // Multiple-Targets attack rolls exactly as it always has, targets chosen by hand as usual.
      if (this.system.shape) {
        let aoeTokens = await placeAoeTemplate(this.actor, this);

        // Shaped Charges (Artillery Focus, 7th level, p.81) - see its own doc comment. Runs
        // before Horseshoes and Handgrenades below so an excluded target dodges that flat-damage
        // tax too, not just the attack roll itself.
        aoeTokens = await applyShapedCharges(this.actor, this, aoeTokens);

        // Horseshoes and Handgrenades (Artillery Focus, 18th level, p.82) - see its own doc
        // comment. Reuses whatever's left of the AoE shape's own catch (after Shaped Charges'
        // exclusions above), applied unconditionally before the attack roll itself even happens.
        await applyHorseshoesAndHandgrenades(this.actor, this, aoeTokens);
      }

      // Mighty Strikes (Blitzer Focus, 17th level, p.98) - see its own doc comment. Independent
      // of system.shape entirely (a Might melee weapon never has one set) - targets everyone
      // within the attacker's own reach automatically, no click required.
      await applyMightyStrikes(this.actor, this);

      // No Need to Aim (Vanguard base, 20th level, p.111) - see its own doc comment. Also
      // independent of system.shape - a Multiple Targets attack targets normally via ordinary
      // Foundry targeting, not a placed shape.
      await applyNoNeedToAim(this.actor, this);

      let weaponDataset = {};
      const roller = childRoller || this.actor;
      const baseSkill = this.system.classification.skill;
      // Brutal Might - see BRUTAL_MIGHT_ID's own comment above.
      const skill = baseSkill == 'might' && actorHasPerk(roller, BRUTAL_MIGHT_ID) ? 'brawn' : baseSkill;
      const shift = roller.system.skills[skill].shift;
      const shiftUp = roller.system.skills[skill].shiftUp;
      // Beastly / its own Hang-Up - see BEASTLY_PERK_ID's own comment above.
      const itemSourceId = this.flags?.core?.sourceId ?? this._stats?.compendiumSource;
      let itemShiftDown = this.system.shiftDown;
      if (itemSourceId == UNARMED_COMBAT_ALTERNATE_EFFECT_1_ID && actorHasPerk(roller, BEASTLY_PERK_ID)) {
        itemShiftDown = 0;
      } else if (itemSourceId == UNARMED_COMBAT_EFFECT_ID && actorHasPerk(roller, BEASTLY_HANG_UP_ID)) {
        itemShiftDown = this.system.shiftDown + 1;
      }
      const shiftDown = roller.system.skills[skill].shiftDown + itemShiftDown;
      const isSpecialized = roller.system.skills[skill].isSpecialized;
      weaponDataset = {
        ...dataset,
        shift,
        skill,
        shiftUp,
        shiftDown,
        isSpecialized,
      };

      this._dice.handleSkillItemRoll(weaponDataset, this.actor, this);

      // Decrement class feature, if applicable
      const classFeature = this.actor.items.get(this.system.classFeatureId);
      if (classFeature) {
        classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - 1) });
      }
    } else if (this.type == 'spell') {
      const essence = 'any';
      const skill = 'spellcasting';
      const shift = this.actor.system.skills.spellcasting.shift;
      // Casting Cost (MLP CRB p.132): a spell downshifts the caster's Spellcasting Skill by its
      // cost, on top of any downshift already lingering from an earlier cast this scene.
      const priorDownshift = this.actor.system.skills.spellcasting.shiftDown;

      // Efficient Spellcaster / Master Spellcaster (Knights of Canterlot, General Perks, p.38) -
      // see EFFICIENT_SPELLCASTER_ID's own comment above. Reduces THIS spell's own cost (never
      // below 1), scoped to Elementary/Superior tier respectively.
      let castingCost = this.system.cost;
      if (this.system.tier == 'elementary' && actorHasPerk(this.actor, EFFICIENT_SPELLCASTER_ID)) {
        castingCost = Math.max(1, castingCost - 1);
      } else if (this.system.tier == 'superior' && actorHasPerk(this.actor, MASTER_SPELLCASTER_ID)) {
        castingCost = Math.max(1, castingCost - 1);
      }

      // Block Magic - see BLOCK_MAGIC_ID's own comment above. Applied after the Efficient/Master
      // Spellcaster reduction (a real cost increase, not something those Perks should shrink away).
      if (isBlockMagicActive(this.actor)) {
        castingCost += 1;
      }

      // Power Conservationist / Power Mastery (Knights of Canterlot, General Perks, p.38) - see
      // POWER_CONSERVATIONIST_ID's own comment above. The roll itself uses only the downshift
      // already lingering from an earlier cast - THIS spell's own cost is applied to
      // system.skills.spellcasting.shiftDown afterward instead (still below), so it doesn't
      // affect the Skill Test being made to cast it.
      const deferCost = actorHasPerk(this.actor, POWER_CONSERVATIONIST_ID)
        || actorHasPerk(this.actor, POWER_MASTERY_ID);
      const shiftDown = deferCost ? priorDownshift : priorDownshift + castingCost;

      // Enchant - see ENCHANT_ID's own comment above. Picked before the roll so a cancelled cast
      // spends nothing.
      const sourceId = this.flags?.core?.sourceId ?? this._stats?.compendiumSource;
      const enchantSkill = sourceId == ENCHANT_ID ? await pickEnchantSkill() : null;
      if (sourceId == ENCHANT_ID && !enchantSkill) {
        return;
      }

      if (sourceId == EXPLOSIVE_BEAM_ID) {
        autoTargetExplosiveBeam(this.actor);
      }

      if (sourceId == BEAM_VOLLEY_ID) {
        autoTargetBeamVolley(this.actor);
      }

      const bestowExpertiseChoice = sourceId == BESTOW_EXPERTISE_ID ? await pickBestowExpertise() : null;
      if (sourceId == BESTOW_EXPERTISE_ID && !bestowExpertiseChoice) {
        return;
      }

      const mindBeamEffect = sourceId == MIND_BEAM_ID ? await pickMindBeamEffect() : null;
      if (sourceId == MIND_BEAM_ID && !mindBeamEffect) {
        return;
      }

      const getToKnowSkill = sourceId == GET_TO_KNOW_ID ? await pickGetToKnowSkill() : null;
      if (sourceId == GET_TO_KNOW_ID && !getToKnowSkill) {
        return;
      }

      const spellDataset = {
        ...dataset,
        essence,
        shift,
        skill,
        shiftDown,
        isEnchantAttempt: !!enchantSkill,
        enchantSkill,
        isBestowExpertiseAttempt: !!bestowExpertiseChoice,
        bestowExpertiseSkill: bestowExpertiseChoice?.skill ?? null,
        bestowExpertiseName: bestowExpertiseChoice?.name ?? null,
        mindBeamEffect,
        isGetToKnowAttempt: !!getToKnowSkill,
        getToKnowSkill,
      };

      this._dice.handleSkillItemRoll(spellDataset, this.actor, this);

      // Unlike a single-roll shift, this cost lingers on the actor's Spellcasting Skill after
      // the roll - only cleared via onRecoverSpellcastingDownshift/onSufferForSpellcastingDownshift
      // (listener-misc-handler.mjs). The cost always ends up applied here eventually, whether or
      // not it affected the roll that just happened.
      await this.actor.update({ 'system.skills.spellcasting.shiftDown': priorDownshift + castingCost });
    } else if (this.type == 'magicBauble') {
      const essence = 'any';
      const skill = 'spellcasting';
      const shift = this.system.spellcastingShift;
      // Magic Baubles override the caster's base Spellcasting shift entirely (their own fixed
      // shift), but any lingering Casting Cost downshift (MLP CRB p.132) still applies on top.
      const shiftDown = this.actor.system.skills.spellcasting.shiftDown;
      const spellDataset = {
        ...dataset,
        essence,
        shift,
        skill,
        shiftDown,
      };

      this._dice.handleSkillItemRoll(spellDataset, this.actor, this);
    } else {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      // If there's no roll data, send a chat message.
      if (!this.system.formula) {
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: this.system.description ?? '',
        });
      } else { // Otherwise, create a roll and send a chat message from it.
        // Retrieve roll data.
        const rollData = this.getRollData();

        // Invoke the roll and submit it to chat.
        const roll = new Roll(rollData.item.formula, rollData);
        // If you need to store the value first, uncomment the next line.
        // let result = await roll.roll({async: true});
        roll.toMessage({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
        });

        return roll;
      }
    }
  }
}
