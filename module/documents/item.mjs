import { runSpellCost } from "../mechanics/item-hooks.mjs";
import { endOnFumble } from "../mechanics/resources/grants.mjs";
import { ablativeLossOf, pickConcentratedArea, weaponUnusable } from "../mechanics/combat/target-riders.mjs";
import { wipeCoating } from "../items/gear/poison-coating.mjs";
import { usesVehicleTargeting, vehicleWeaponTraits } from "../mechanics/vehicles/vehicle-upgrades.mjs";
import { applyAugur, perkGrantedTraits, TRAIT_UPGRADE, weaponHasUpgrade } from "../mechanics/combat/weapon-traits.mjs";
import { bombKind, plantBomb } from "../items/attacks/planted-bombs.mjs";
import { resolveWeaponChangesAfterAttack } from "../items/attacks/weapon-perk-uses.mjs";
import { affectsGeneratedEffects, applyToWeapon as applyUpgradesToWeapon, chosenElement, ELEMENTS, syncGeneratedEffects } from "../items/attacks/weapon-upgrades.mjs";
import { applyDamage } from "../mechanics/combat/combat.mjs";
import { onPowerUsed } from "../mechanics/actions/action-perks.mjs";
import { Dice } from "../dice.mjs";
import { ensureSourceIndex, inheritedRules, rulesSnapshotToStrip } from "../rules/inherit.mjs";
import { RollDialog } from "../mechanics/rolls/roll-dialog.mjs";
import { consumeForItem, describeCost, refund, setAiming, spend } from "../mechanics/actions/action-economy.mjs";
import { clearWeaponReload, reloadsNeeded, getReloadCost, hasBurstFiredThisRound, markBurstFiredThisRound, requireReload, weaponNeedsReload } from "../mechanics/combat/reload-trait.mjs";
import { isMountedWeaponSetUp } from "../items/attacks/mounted-weapons.mjs";
import { isInactiveMythicForm } from "../items/attacks/mythically-modular.mjs";
import { checkVehicularEligibility } from "../mechanics/combat/vehicular-trait.mjs";
import { addOngoingEffect } from "../mechanics/combat/ongoing-effects.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";
import { betterShift, updateRoleCache } from "../util/utils.mjs";
import { placeAoeTemplate } from "../mechanics/combat/aoe-targeting.mjs";
import { applyShapedCharges } from "../items/attacks/shaped-charges.mjs";
import { pickBringItAllDownEffect } from "../items/attacks/bring-it-all-down.mjs";
import { applyHorseshoesAndHandgrenades } from "../items/attacks/horseshoes-and-handgrenades.mjs";
import { applyMightyStrikes } from "../items/attacks/mighty-strikes.mjs";
import { applyNoNeedToAim } from "../items/attacks/no-need-to-aim.mjs";
import { actorHasPerk } from "../mechanics/characters/perks.mjs";
import { pickEnchantSkill } from "../items/magic/enchant.mjs";
import { importedDescription } from "../importers/book-descriptions-store.mjs";
import { autoTargetBeamVolley } from "../items/magic/beam-volley.mjs";
import { pickBestowExpertise } from "../items/magic/bestow-expertise.mjs";
import { pickMindBeamEffect } from "../items/magic/mind-beam.mjs";
import { pickGetToKnowSkill } from "../items/magic/get-to-know.mjs";
import { isBlockMagicActive } from "../items/magic/block-magic.mjs";
import { consumeMegaWeaponAttack } from "../items/zords/zord-mega-weapon.mjs";
import { isPiledriver, offerPiledriverRoughTerrain } from "../mechanics/world/rough-terrain.mjs";
import {
  canRollLimitedWeaponEffect, isLimitedWeaponEffect, markLimitedWeaponEffectUsed,
} from "../items/attacks/limited-weapon-effects.mjs";

const KNIGHTS_OF_CANTERLOT = "Compendium.essence20.knights_of_canterlot.Item.";
const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";

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

// Obscuring Matrix (Enigma of Combination, Armor Upgrade, p.57) - see _prepareArmorBonuses's own
// comment for the Grappled/Immobilized/Prone/Restrained negation these two ids gate.
const OBSCURING_MATRIX_BASIC_ID = "Compendium.essence20.enigma_of_combination.Item.L8ZXz1h0DlCy85UC";
const OBSCURING_MATRIX_ADVANCED_ID = "Compendium.essence20.enigma_of_combination.Item.HH4q8lx09mV2hhcv";

// Enchant (MLP CRB, Elementary Enchantment spell, p.136) - see items/magic/enchant.mjs's own doc
// comment. The one hardcoded per-spell-id check in this otherwise fully generic spell-cast
// branch below, needed because the skill choice must be picked BEFORE the roll (nothing else in
// this codebase intercepts a spell cast pre-roll the way onPowerUse does for Grid/Sorcerous
// Powers).
const ENCHANT_ID = `${MLP_CRB}afYeCCAX0o2Cwf2I`;

// Beam Volley (MLP CRB, Virtuoso Beam spell, p.138) - see items/magic/beam-volley.mjs's own doc
// comment. Auto-targets the 3 nearest enemies before the roll fires (no picker, so no
// early-return-on-cancel like Enchant). Explosive Beam used to sit alongside it here; its own
// "15ft diameter circle" is a real AoE shape, so it now carries system.shape/radius and goes
// through mechanics/combat/aoe-targeting.mjs like any other area spell. Beam Volley's "3 targets in range"
// is Multiple Targets, not an area, so it stays a bespoke auto-targeter.
const BEAM_VOLLEY_ID = `${MLP_CRB}UhkhFqFDYjub1a8k`;

// Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137) - see
// items/magic/bestow-expertise.mjs's own doc comment. A third per-spell-id pre-roll hook, alongside
// Enchant's own - picks the Skill AND the new Specialization's own free-typed name before rolling.
const BESTOW_EXPERTISE_ID = `${MLP_CRB}stwnP4um6j1xxzIo`;

// Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - see items/magic/mind-beam.mjs's own doc comment.
// A fifth per-spell-id pre-roll hook, alongside Enchant/Bestow Expertise's own - picks which
// Condition this cast applies before the roll fires.
const MIND_BEAM_ID = `${MLP_CRB}gF8otV8Ag9axRp2Z`;

const DARK_SKIES_OVER_EQUESTRIA = "Compendium.essence20.dark_skies_over_equestria.Item.";

// Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21) - see
// items/magic/get-to-know.mjs's own doc comment. A sixth per-spell-id pre-roll hook - picks the
// related Skill before the roll fires.
const GET_TO_KNOW_ID = `${DARK_SKIES_OVER_EQUESTRIA}pyRy1dFwuiJpAKj2`;

// Power Conservationist / Power Mastery (General Perks, p.38): "delay the cost of casting the
// spell until after you have cast it - your Spellcasting Skill Test is made before it is
// reduced." Both read as the same deferral in this codebase's terms (this system has no separate
// "augment cost" distinct from a spell's own system.cost to tell them apart) - see the spell-cast
// branch below.
const POWER_CONSERVATIONIST_ID = `${KNIGHTS_OF_CANTERLOT}75H9N2YqaSDUhiCQ`;
const POWER_MASTERY_ID = `${KNIGHTS_OF_CANTERLOT}qDsWwo5ipmzMMuO4`;

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

    // An upgrade, element or Perk that grants alternate effects arrived - see
    // items/attacks/weapon-upgrades.mjs#syncGeneratedEffects. The client that made the change does it.
    if (userId == game.user?.id && this.actor && affectsGeneratedEffects(this)) {
      syncGeneratedEffects(this.actor);
    }

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

    // A copy of a compendium item reads its automation notes from the original
    // (_prepareAutomation), so it doesn't keep the snapshot the drop brought along.
    const automation = this._source?.system?.automation;
    if (this._stats?.compendiumSource && (automation?.status || automation?.notes)) {
      this.updateSource({ 'system.automation': { status: '', notes: '' } });
    }

    // Its rules too (rules/inherit.mjs) - and the source pack's index is loaded first, so the copy
    // already has them when its add-time rules (choices, grants) run.
    if (rulesSnapshotToStrip(this)) {
      this.updateSource({ 'system.rules': [] });
    }

    await ensureSourceIndex(this._stats?.compendiumSource);

    // A Megaform Trait (Core Body, Move, Core Ability, ...) is identified purely by its
    // system.type enum, which is what Essence20Actor#_prepareMegaformZordData/
    // _prepareMegaformCombinerData actually switches on - Name is separate flavor text a GM
    // remains free to retype afterward. Every one of this system's own compendium entries
    // already names the item exactly after its Type (e.g. "Core Body" for coreBody), so this
    // just fills that in automatically instead of making a GM type the same thing twice - a
    // no-op for a compendium drop (name/type already match), a sensible default in place of
    // "New Megaformtrait" for a blank one created via the sheet's own "+" control.
    if (this.type == 'megaformTrait') {
      this.updateSource({ name: CONFIG.E20.megaformTraitTypes[this.system.type] });
    }
  }

  /**
   * Keeps a Megaform Trait's Name in sync with its Type whenever the Details tab's Type dropdown
   * changes it - see _preCreate's identical reasoning above. Skipped if this same update is ALSO
   * explicitly setting a new name (e.g. a deliberate GM reflavor happening in the same submit),
   * so that doesn't get silently overwritten.
   * @param {Object} change The differential data being updated
   * @param {Object} options The options from the update operation
   * @param {String} userId The user performing the update
   */
  async _preUpdate(change, options, userId) {
    await super._preUpdate(change, options, userId);

    if (
      this.type == 'megaformTrait' && change.system?.type && change.system.type != this.system.type
      && change.name === undefined
    ) {
      change.name = CONFIG.E20.megaformTraitTypes[change.system.type];
    }

    // Vehicular (GI Joe CRB, Weapon Effects and Traits, p.148) - see mechanics/combat/vehicular-trait.mjs's own
    // doc comment. The "equip" half of "can only be mounted on a vehicle": strips the equip
    // toggle back out of this update (rather than throwing, which would abort the whole submit)
    // when checkVehicularEligibility refuses it - a no-op in 'off'/'track'/'warn' mode, where that
    // check always returns true.
    if (
      this.type == 'weapon' && change.system?.equipped === true
      && this.system.traits?.includes('vehicular') && this.actor
      && !checkVehicularEligibility(this.actor, this.name)
    ) {
      delete change.system.equipped;
    }
  }

  /** @override */
  /**
   * An upgrade leaving a weapon takes the alternate effects it granted with it - see
   * items/attacks/weapon-upgrades.mjs#syncGeneratedEffects.
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if (userId == game.user?.id && this.actor && affectsGeneratedEffects(this)) {
      syncGeneratedEffects(this.actor);
    }
  }

  async _onUpdate(change, options, userId) {
    super._onUpdate(change, options, userId);

    if (userId == game.user?.id && this.actor && affectsGeneratedEffects(this, change)) {
      syncGeneratedEffects(this.actor);
    }

    if (this.type == 'role') {
      await updateRoleCache();
    }

    // Update the entry on the parent if this is a child Item. Only on the client that made the
    // change: _onUpdate runs on every connected client, and a player whose client isn't allowed to
    // edit the actor (an NPC's unlinked token) threw "lacks permission to update ActorDelta" once
    // per child item - and even where allowed, every client wrote the same entry again.
    if (userId == game.user?.id && ['weaponEffect', 'upgrade'].includes(this.type)) {
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
    this._prepareDescription();
    this._prepareAutomation();
    // A compendium copy with no rules of its own runs its original's (rules/inherit.mjs).
    if (Array.isArray(this.system.rules)) {
      this.system.rules = inheritedRules(this);
    }

    this._prepareTraits();

    if (this.type == 'weapon' || this.type == 'armor') {
      this._prepareTotalAvailability();
    }

    // Augur's Sharp Flyby/Ram/Bash (mechanics/combat/weapon-traits.mjs).
    applyAugur(this);

    if (this.type == 'armor') {
      this._prepareArmorBonuses();
    } else if (this.type == 'weapon') {
      this._prepareAimShiftBonus();
      this._prepareWeaponHands();
      this._prepareHardpointDerived();
      // Size steps and one-handed wielding from upgrades and Perks (items/attacks/weapon-upgrades.mjs).
      applyUpgradesToWeapon(this);
    } else if (this.type == 'rolePoints') {
      this._prepareRolePoints();
    }
  }

  /**
   * The traits this weapon or armor effectively has: its own, plus every trait its attached
   * upgrades grant, minus every trait they take away.
   *
   * Upgrades that REMOVE a trait are rare but real - Ammo Feeder (GI Joe CRB p.151) is "Weapon
   * with the Reload trait / The weapon loses the Reload trait", and Factions in Action Vol. 2
   * p.96 has one that drops Mounted. Removal is applied last, so an upgrade that takes a trait
   * away beats one that grants it; that is the order the fiction implies (the modification is
   * physical) and it makes the result independent of the order upgrades happen to be attached.
   *
   * The result is written back over `system.traits` as well as to `system.itemAndUpgradeTraits`,
   * and that is deliberate. Roughly twenty-five checks in dice.mjs and the helpers ask a weapon
   * `system.traits.includes(...)` directly, and they have always been answered with the combined
   * list - the previous implementation assigned `this.system.traits` to a local and pushed onto
   * it, mutating the derived array in place. Keeping both names pointing at the same computed
   * list preserves every one of those answers and gives them trait REMOVAL for free, rather than
   * rewriting twenty-five call sites and re-verifying each.
   *
   * What that shared array must never do is reach an editor. The trait selector used to read it
   * back off the derived document, which meant opening it on an upgraded weapon pre-checked the
   * upgrade's traits and saved them onto the weapon itself; with removal in play it would also
   * have silently deleted a removed trait from the base item for good. apps/trait-selector.mjs
   * reads _source instead now, which is the authored list this function starts from.
   */
  /**
   * Fill in a description a GM has imported from their own copy of a rulebook.
   *
   * The compendium ships these empty - this system does not redistribute Renegade's text -
   * so a GM who owns the book can import it into their world instead (see
   * apps/book-description-importer.mjs). Applying it here rather than writing it into the
   * items themselves is what keeps it out of packs/ and out of any release.
   *
   * Only ever fills a blank. An item whose description was written by hand, or edited after
   * an import, keeps what it has.
   */
  /**
   * The automation notes (system.automation) a copy of a compendium item shows are its original's,
   * read live from the compendium index (CONFIG.Item.compendiumIndexFields, essence20.mjs) - so a
   * copy made before the notes were written, or before they were corrected, still shows the current
   * ones. A copy only keeps notes of its own when a GM wrote them on it: _preCreate drops the ones a
   * compendium drop brings along, so anything stored on a sourced copy is deliberate.
   */
  _prepareAutomation() {
    const stored = this._source?.system?.automation;
    if (!this.system.automation || this.pack || stored?.status || stored?.notes?.trim()) {
      return;
    }

    const sourceUuid = this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? this.flags?.essence20?.rulesSource;
    const original = sourceUuid ? globalThis.fromUuidSync?.(sourceUuid, { strict: false }) : null;
    const automation = foundry.utils.getProperty(original ?? {}, 'system.automation');
    if (automation) {
      this.system.automation.status = automation.status ?? '';
      this.system.automation.notes = automation.notes ?? '';
    }
  }

  /**
   * v14 only sends each pack's core index fields at world load - CONFIG.Item.compendiumIndexFields
   * (system.automation) arrive only once something calls pack.getIndex(). So before showing a copy's
   * inherited notes, load its source pack's full index, then read them again.
   */
  async loadAutomationNotes() {
    const stored = this._source?.system?.automation;
    const sourceUuid = this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? this.flags?.essence20?.rulesSource;
    if (!this.system.automation || this.pack || !sourceUuid || stored?.status || stored?.notes?.trim()) {
      return;
    }

    const collection = foundry.utils.parseUuid?.(sourceUuid)?.collection;
    const pack = collection?.metadata ? collection : null;
    if (pack && !pack.indexed) {
      await pack.getIndex();
    }

    this._prepareAutomation();
  }

  _prepareDescription() {
    // Tested against the SOURCE, not the prepared value. description is a stored field rather
    // than a derived one, and Foundry does not roll a data model back to source between
    // preparations - so reading this.system here would see the text a previous preparation
    // already wrote and take it for something the GM had typed. The import would then be stuck:
    // removing a book, or importing a corrected one, would leave the old text in place until a
    // reload.
    const stored = this._source?.system?.description ?? '';
    if (stored.trim()) {
      return;
    }

    // A compendium item is keyed by its own uuid; a copy on an actor or in the world carries
    // the uuid it came from instead, which is the same key its compendium original uses.
    const sourceUuid = this.pack
      ? this.uuid
      : (this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? this.flags?.essence20?.rulesSource);
    if (!sourceUuid) {
      return;
    }

    // Falling back to `stored` rather than leaving it alone is what lets a cleared or re-imported
    // book actually take effect on an item that is already prepared.
    this.system.description = importedDescription(sourceUuid) ?? stored;
  }

  _prepareTraits() {
    if (this.type != 'weapon' && this.type != 'armor') {
      return;
    }

    const own = this.system.traits ?? [];
    const combined = [...own];
    const removed = new Set();

    for (const attached of Object.values(this.system.items ?? {})) {
      /* A null slot is possible - system.items is a free-form object and a write that fails
         validation leaves the key behind with nothing in it. Reading .type off that threw, and
         because this runs inside prepareDerivedData it took the item's WHOLE preparation with it:
         the weapon then had no derived traits, no availability, no aim shift. Skipping is the only
         sane response - one bad slot should not cost the item everything else. */
      if (attached?.type != 'upgrade') {
        continue;
      }

      for (const trait of attached.traits ?? []) {
        if (!combined.includes(trait)) {
          combined.push(trait);
        }
      }

      for (const trait of attached.removedTraits ?? []) {
        removed.add(trait);
      }
    }

    // The element an Element weapon was set to deals that element - so it has that element's trait,
    // which is what the Acid/Fire/Electromagnetic rules read (items/attacks/weapon-upgrades.mjs).
    if (this.type == 'weapon') {
      const element = chosenElement(this);
      if (element && !combined.includes(ELEMENTS[element])) {
        combined.push(ELEMENTS[element]);
      }

      // Double-Barrel / Targeting System vehicle upgrades on the weapon they were set to.
      for (const trait of vehicleWeaponTraits(this)) {
        if (!combined.includes(trait)) {
          combined.push(trait);
        }
      }

      // Traits a Perk gives the wielder's weapons - Demolisher, Big Lobber, Fireball, Weapon
      // Customizer (mechanics/combat/weapon-traits.mjs).
      for (const trait of perkGrantedTraits(this, combined)) {
        if (!combined.includes(trait)) {
          combined.push(trait);
        }
      }

      // Utility Loaders' added trait, while it lasts (items/attacks/weapon-perk-uses.mjs).
      for (const trait of this.flags?.essence20?.mutation?.addTraits ?? []) {
        if (!combined.includes(trait)) {
          combined.push(trait);
        }
      }
    }

    const effective = removed.size ? combined.filter(trait => !removed.has(trait)) : combined;

    // In place, so anything already holding this array sees the same list - see the note above.
    own.length = 0;
    own.push(...effective);
    this.system.traits = own;
    this.system.itemAndUpgradeTraits = own;
  }

  /**
  * Prepares the combined armor bonuses from the armor and any upgrades
  */
  _prepareArmorBonuses() {
    let armorBonusToughness = this.system.bonusToughness;
    let armorBonusEvasion  = this.system.bonusEvasion;

    // Obscuring Matrix (Enigma of Combination, Armor Upgrade, p.57, Basic +2/Advanced +4 Evasion):
    // "this bonus is negated while the wearer has the Grappled, Immobilized, Prone, or Restrained
    // Condition." Checked here, per-upgrade, rather than as a blanket zero on the whole item's
    // Evasion bonus - only THIS upgrade's own contribution is negated, not any other armorBonus
    // Upgrade sharing the same armor.
    const wearerStatuses = this.actor?.statuses;
    const obscuringMatrixNegated = wearerStatuses?.has
      && ['grappled', 'immobilized', 'prone', 'restrained'].some(status => wearerStatuses.has(status));

    for (const [key, item] of Object.entries(this.system.items)) {
      if (item.type == 'upgrade' && item.subtype == 'armor'){
        if (obscuringMatrixNegated
          && (item.uuid == OBSCURING_MATRIX_BASIC_ID || item.uuid == OBSCURING_MATRIX_ADVANCED_ID)) {
          continue;
        }

        // Ablative Matrix loses a point to every Critical Success that hits (mechanics/combat/target-riders.mjs).
        const value = Math.max(0, (item.armorBonus.value ?? 0) - ablativeLossOf(this.actor?.items?.get?.(key)));
        if (item.armorBonus.defense == 'toughness') {
          armorBonusToughness += value;
        } else if (item.armorBonus.defense == 'evasion') {
          armorBonusEvasion += value;
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
  * Resolves how many loadout "hands" this weapon takes to wield (GI Joe CRB p.138 / TF CRB
  * p.116 / PR CRB p.103) into system.derivedHands, for the Actor's six-hand Load Out tally.
  * Uses the weapon's own system.hands when set, otherwise a Size-based default from
  * CONFIG.E20.weaponSizeHands. A two-handed weapon in an Integrated Hardpoint still reports
  * its full hand count here - the Actor tally is what converts that into two Integrated slots.
  */
  _prepareWeaponHands() {
    const explicit = this.system.hands;
    const sizeDefault = CONFIG.E20.weaponSizeHands[this.system.classification?.size];
    this.system.derivedHands = explicit ?? sizeDefault ?? 1;
  }

  /**
  * Prepares the display-only consequences of which Hardpoint a weapon is installed in
  * (TF CRB p.114), for the Gear tab. None of these are enforced anywhere - they surface what
  * the Hardpoint choice implies so the player doesn't have to cross-reference the book.
  * - system.effectiveSize: 'integrated' while in an Integrated Hardpoint ("reduce their size
  *   to Integrated"), otherwise the weapon's own classification.size.
  * - system.effectiveBrawnReq: the requirements.shift lowered one die while Integrated
  *   ("lower their Brawn requirements (if any) by one die"), otherwise unchanged.
  * - system.derivedMode: the legacy Bot/Alt/Any concept re-derived from the Hardpoint, so the
  *   Gear tab can still show a plain-language mode label (External -> Bot Mode; Integrated ->
  *   Alt Mode if hidden, Any Mode if obvious).
  */
  _prepareHardpointDerived() {
    const hardpoint = this.system.hardpoint ?? {};
    const isIntegrated = hardpoint.type == 'integrated';

    this.system.effectiveSize = isIntegrated ? 'integrated' : this.system.classification?.size;

    const shiftLadder = CONFIG.E20.weaponRequirementShiftLadder;
    const req = this.system.requirements?.shift || 'none';
    if (isIntegrated && shiftLadder.includes(req)) {
      const index = shiftLadder.indexOf(req);
      this.system.effectiveBrawnReq = index > 0 ? shiftLadder[index - 1] : 'none';
    } else {
      this.system.effectiveBrawnReq = req;
    }

    if (hardpoint.type == 'external') {
      this.system.derivedMode = 'modeBotMode';
    } else if (isIntegrated) {
      this.system.derivedMode = hardpoint.altModeVisibility == 'hidden' ? 'modeAltMode' : 'modeAny';
    } else {
      this.system.derivedMode = null;
    }
  }

  /**
  * Prepares the combined Availability tier that must be Requisitioned to acquire this
  * weapon or armor as currently upgraded, per Table 8-2: Upgrading Equipment. Starts from
  * the item's own Availability and folds in each attached Upgrade's Availability in turn.
  */
  _prepareTotalAvailability() {
    let totalAvailability = this.system.availability;

    // A null slot skips rather than throws, for the same reason _prepareTraits guards against
    // one: this runs inside prepareDerivedData, so one bad entry used to cost the item every
    // other derived field too.
    for (const attached of Object.values(this.system.items ?? {})) {
      if (attached?.type == 'upgrade') {
        totalAvailability = this._getCombinedAvailability(totalAvailability, attached.availability);
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
  /**
   * Fire a dialog-backed skill roll, and hand back the action it already cost if the player backs
   * out of the roll options dialog.
   *
   * The action economy spends at the TOP of roll(), before any of the pre-roll work (AoE template
   * placement, target pickers, Perk prompts) - which is the only place a single insertion can
   * cover every item type. The roll dialog opens well after that, and cancelling it is an ordinary
   * thing to do, not an edge case; without this the cancelled roll would quietly eat the turn.
   *
   * @param {Object} dataset   The roll dataset to dispatch.
   * @param {Actor} actor      The actor actually rolling.
   * @param {Object} spent     The result of consumeForItem, or null if nothing was spent.
   * @returns {Promise<*>}   Whatever the roll returned.
   */
  async _rollWithRefund(dataset, actor, spent) {
    const result = await this._dice.handleSkillItemRoll(dataset, actor, this);
    if (result?.cancelled && spent?.spendId) {
      await refund(actor, spent.spendId);
    }

    return result;
  }

  async roll(dataset, childRoller=null) {
    /* Action economy. This one insertion covers every weapon, weapon effect, Power and spell in
       the game, because every sheet click funnels through here - see
       mechanics/actions/action-economy.mjs#consumeForItem.

       Placed above the rollType == 'info' branch and skipped for it, so posting an item's details
       to chat stays free; only an actual use spends. In every mode except 'strict' this records
       the spend and reports it without standing in the way, which is what lets it ship while the
       overwhelming majority of compendium items still declare no action cost at all. */
    let spent = null;
    // The weaponEffect's own parent weapon, resolved once here so both the Reload gate just below
    // and the Reload/Consumable consumption further down (this.type == 'weaponEffect' branch) see
    // the same lookup - see mechanics/combat/reload-trait.mjs's own doc comment.
    let parentWeapon = null;
    if (dataset.rollType != 'info') {
      const roller = childRoller || this.actor;
      if (this.type == 'weaponEffect' && roller) {
        parentWeapon = this._dice._getParentWeapon(roller, this);

        // Reload (GI Joe CRB, Weapon Effects and Traits, p.147) / Burst-Fire (Quartermaster's
        // Guide to Gear p.33, "counts as if it had the Reload trait for the turn" after a second
        // shot in the same round - see mechanics/combat/reload-trait.mjs's own doc comment) - gated ahead of the
        // ordinary action-economy spend below: an unreloaded weapon shouldn't cost its own Attack
        // action at all.
        // Fanning weapons join in only once a Fanning Attack has flagged them (see the fanned check
        // below); a High-Density follow-up is the same shot as the Attack it follows, so it never
        // stops to reload (items/attacks/high-density.mjs).
        // Any weapon a "must reload" rule flagged - Empty the Mag can flag one without the trait.
        // Rapid Reload / the Ammo Belt make the reload a Free action (mechanics/combat/reload-trait.mjs).
        if (!dataset.highDensityFollowUp && weaponNeedsReload(parentWeapon)) {
          const reloadCost = await getReloadCost(roller, parentWeapon);
          const reloadSpend = await spend(roller, reloadCost.action, {
            source: reloadCost.source ? `${parentWeapon.name} (${reloadCost.source})` : parentWeapon.name,
            bypass: dataset.bypassEconomy,
          });
          if (reloadSpend.blocked) {
            if (!reloadSpend.cancelled) {
              ui.notifications.warn(game.i18n.format('E20.ActionEconomyUnaffordable', {
                name: roller?.name ?? '',
                action: describeCost(reloadSpend.cost),
              }));
            }

            return;
          }

          const reloadsLeft = reloadsNeeded(parentWeapon) - 1;
          await clearWeaponReload(parentWeapon);

          // Reload ×2 (A Jump Through Time p.78) - one reload done, one still to go.
          if (reloadsLeft > 0) {
            ui.notifications.info(game.i18n.format('E20.ReloadOneMore', { weapon: parentWeapon.name }));
            return;
          }
        }

        // Salvaged (Ferocious Fighters p.36): "The weapon is immediately and permanently destroyed if
        // you fumble an attack." Marked destroyed rather than deleted, so nothing is lost by accident;
        // it can no longer attack.
        if (parentWeapon?.flags?.essence20?.destroyed) {
          ui.notifications.warn(game.i18n.format('E20.WeaponDestroyed', { name: parentWeapon.name }));
          return;
        }

        // Knocked away (Snatch, Disarming Shot) or pulled apart (Dismantle Firearm) - see
        // mechanics/combat/target-riders.mjs#weaponUnusable.
        const unusable = weaponUnusable(parentWeapon);
        if (unusable) {
          ui.notifications.warn(unusable);
          return;
        }

        // Mounted (GI Joe CRB, Weapon Effects and Traits, p.148) - see items/attacks/mounted-weapons.mjs's own
        // doc comment. A hard block, not an action-economy spend of its own: setting the weapon up
        // is its own separate Standard-action spend (the sheet's Set Up/Pick Up control), not
        // something the Attack itself pays for.
        if (parentWeapon?.system.traits?.includes('mounted') && !isMountedWeaponSetUp(parentWeapon)) {
          ui.notifications.warn(game.i18n.format('E20.MountedNotSetUp', { name: parentWeapon.name }));
          return;
        }

        // Mythically Modular (Through the Shattered Grid p.116) - see items/attacks/mythically-modular.mjs.
        // Another form of this combined weapon is the one in use; switch first (a Free action).
        if (isInactiveMythicForm(roller, parentWeapon)) {
          ui.notifications.warn(game.i18n.format('E20.MythicallyModularInactive', { name: parentWeapon.name }));
          return;
        }

        // Vehicular (GI Joe CRB, Weapon Effects and Traits, p.148) - see mechanics/combat/vehicular-trait.mjs's
        // own doc comment for the RAW quote and the strictness-mode shape.
        if (parentWeapon?.system.traits?.includes('vehicular') && !checkVehicularEligibility(roller, parentWeapon.name)) {
          return;
        }
      }

      spent = await consumeForItem(this, { actor: childRoller, bypass: dataset.bypassEconomy });
      if (spent.blocked) {
        // Nothing to say when the player themselves backed out of the 'warn' confirmation - they
        // already know. The notification is for 'strict', where the refusal is the world's.
        if (!spent.cancelled) {
          ui.notifications.warn(game.i18n.format('E20.ActionEconomyUnaffordable', {
            name: (childRoller || this.actor)?.name ?? '',
            action: describeCost(spent.cost),
          }));
        }

        return;
      }

      /* The shot the aim was for. An aim improves the next roll and then it is gone, which is
         what makes Aim once per roll rather than once per turn - see
         mechanics/actions/action-economy.mjs#isAiming. The weapon effect is the attack: a weapon itself
         has no roll button anywhere in the sheet, only its effects do. Cleared after the spend
         rather than after the roll resolves so a blocked or cancelled attack keeps the aim. */
      if (this.type == 'weaponEffect') {
        await setAiming(childRoller || this.actor, false);
      }
    }

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

      // Piledriver - posting it is the gear's only sheet action; see
      // mechanics/world/rough-terrain.mjs#offerPiledriverRoughTerrain (Alt Mode only).
      if (this.type == 'gear' && isPiledriver(this)) {
        await offerPiledriverRoughTerrain(this.actor, this);
      }
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
      // Relentless Blows and the like - a Power that grants attacks (mechanics/actions/action-perks.mjs).
      await onPowerUsed(childRoller || this.actor, this);

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
      // The actual attacker for this roll - almost always this.actor (the weaponEffect's own
      // parent), but childRoller overrides it for a "roll on behalf of" case (e.g. a Vehicle's
      // driver rolling its inherent Ram/Flyby attack). Resolved once, up front, so every helper
      // below consistently sees the real roller instead of this.actor directly - a weaponEffect
      // freshly resolved via fromUuid() off a compendium/unembedded source (as opposed to one
      // already embedded on an actor) has a null this.actor until it's actually rolled, which
      // used to crash several of these (e.g. isMultipleTargetsWeapon's own actor.system read)
      // whenever only childRoller, not this.actor, was actually valid.
      const roller = childRoller || this.actor;

      // Time / Proximity / Detonator Bomb - rolling it plants it rather than attacking; it attacks
      // when it goes off (items/attacks/planted-bombs.mjs). The Standard action was the one paid above.
      const bombWeapon = this._dice._getParentWeapon(roller, this);
      if (!dataset.bombDetonation && bombKind(bombWeapon)) {
        const planted = await plantBomb(roller, this, bombWeapon);
        if (!planted && spent?.spendId) {
          await refund(roller, spent.spendId);
        }

        return;
      }

      // Once-per-encounter weapon effects (Turbo Thunder Cannon's Energy Attack, Wing Missile
      // Salvo) - see items/attacks/limited-weapon-effects.mjs's own doc comment. Checked before any of
      // the pre-roll work below, refunding the action economy spend just like a cancelled roll,
      // so a blocked attack never costs the actor their turn.
      const weaponEffectSourceId = this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? this.flags?.essence20?.rulesSource;
      if (isLimitedWeaponEffect(weaponEffectSourceId) && !canRollLimitedWeaponEffect(roller, weaponEffectSourceId)) {
        if (spent?.spendId) {
          await refund(roller, spent.spendId);
        }

        ui.notifications.warn(game.i18n.format('E20.LimitedWeaponEffectAlreadyUsed', { name: this.name }));
        return;
      }

      // Bring It All Down (Decepticon Directive, Demolitionist Focus, 20th level, p.57) - see
      // items/attacks/bring-it-all-down.mjs's own doc comment. Resolved before AoE placement (rather
      // than as a Roll Options Dialog checkbox like most declared-intent Perks) because its own
      // radius-doubling option has to be known before the shape is even placed. A no-op prompt on
      // a non-explosive attack or without the Perk - see pickBringItAllDownEffect's own gate.
      const bringItAllDownEffect = await pickBringItAllDownEffect(roller, this);

      // Area of Effect (GitHub #824) - see mechanics/combat/aoe-targeting.mjs's own doc comment. Only
      // Blast/AoE-shaped attacks (system.shape set) trigger this; an ordinary single-target or
      // Multiple-Targets attack rolls exactly as it always has, targets chosen by hand as usual.
      // Concentrated Explosion / Concentrated Fire - mechanics/combat/target-riders.mjs#pickConcentratedArea.
      const concentrated = await pickConcentratedArea(roller, this);
      if (concentrated?.single) {
        dataset = { ...dataset, concentratedFire: true };
        const first = game.user.targets.first();
        canvas.tokens?.setTargets?.(first ? [first.id] : []);
      }

      if (this.system.shape && !concentrated?.single) {
        let aoeTokens = await placeAoeTemplate(roller, this, {
          radiusMultiplier: bringItAllDownEffect == 'radius' ? 2 : 1,
          radiusDeltaFeet: concentrated?.radiusDeltaFeet ?? 0,
          shapeOverride: concentrated?.shape ?? null,
        });

        // Shaped Charges (Artillery Focus, 7th level, p.81) - see its own doc comment. Runs
        // before Horseshoes and Handgrenades below so an excluded target dodges that flat-damage
        // tax too, not just the attack roll itself.
        aoeTokens = await applyShapedCharges(roller, this, aoeTokens);

        // Horseshoes and Handgrenades (Artillery Focus, 18th level, p.82) - see its own doc
        // comment. Reuses whatever's left of the AoE shape's own catch (after Shaped Charges'
        // exclusions above), applied unconditionally before the attack roll itself even happens.
        await applyHorseshoesAndHandgrenades(roller, this, aoeTokens);
      }

      // Mighty Strikes (Blitzer Focus, 17th level, p.98) - see its own doc comment. Independent
      // of system.shape entirely (a Might melee weapon never has one set) - targets everyone
      // within the attacker's own reach automatically, no click required.
      await applyMightyStrikes(roller, this);

      // No Need to Aim (Vanguard base, 20th level, p.111) - see its own doc comment. Also
      // independent of system.shape - a Multiple Targets attack targets normally via ordinary
      // Foundry targeting, not a placed shape.
      await applyNoNeedToAim(roller, this);

      let weaponDataset = {};
      // A detonated bomb rolls its planter's Technology (items/attacks/planted-bombs.mjs).
      const baseSkill = dataset.skillOverride ?? parentWeapon?.flags?.essence20?.attackSkill ?? this.system.classification.skill;
      // Brutal Might - see BRUTAL_MIGHT_ID's own comment above.
      const skill = baseSkill == 'might' && actorHasPerk(roller, BRUTAL_MIGHT_ID) ? 'brawn' : baseSkill;
      // Targeting System (GI Joe CRB p.172): the driver fires it "using the vehicle's Targeting for
      // the Skill Test".
      const skillSource = childRoller && usesVehicleTargeting(this.actor, this._dice._getParentWeapon(this.actor, this))
        && this.actor.system.skills?.[skill] ? this.actor : roller;
      const shift = skillSource.system.skills[skill].shift;
      const shiftUp = skillSource.system.skills[skill].shiftUp;
      // The weaponEffect's own printed ↓ - Beastly, Wrestler and One With Your Weapon change it with
      // their ItemModifier rules (rules/adapter.mjs#ruleDerived).
      const shiftDown = roller.system.skills[skill].shiftDown + this.system.shiftDown;
      const isSpecialized = roller.system.skills[skill].isSpecialized;
      // Accurate (Weapon Effects and Traits, p.106) - see WeaponEffectItemData#accurateShiftUp's
      // own comment (data/item/weapon-effect.mjs) for why this weaponEffect-level field is the
      // first real mechanical hook for that trait.
      const totalShiftUp = shiftUp + (this.system.accurateShiftUp ?? 0);
      weaponDataset = {
        ...dataset,
        shift,
        skill,
        shiftUp: totalShiftUp,
        shiftDown,
        isSpecialized,
        // Bring It All Down - see its own comment above. Read back in dice.mjs at the three sites
        // matching RAW's other options (the shift computation, damageBonusValue, and the Armor
        // Piercing/ignoreArmor recompute).
        bringItAllDownEffect,
      };

      const weaponRollResult = await this._rollWithRefund(weaponDataset, roller, spent);
      if (isLimitedWeaponEffect(weaponEffectSourceId) && !weaponRollResult?.cancelled) {
        await markLimitedWeaponEffectUsed(roller, weaponEffectSourceId);
      }

      // Zord Mega-Weapon System (PR CRB, Zord Feature, p.139): "lasts for 1d2+1 attacks (hit or
      // miss)" - counted here, as the attack is rolled, precisely because a miss still spends one.
      await consumeMegaWeaponAttack(roller, this);

      // Salvaged - a Fumble (natural 1 and a failed test) destroys the weapon.
      if (parentWeapon && weaponRollResult && !weaponRollResult.cancelled && weaponHasUpgrade(parentWeapon, TRAIT_UPGRADE.salvaged)
        && (weaponRollResult.outcomes ?? []).some(outcome => outcome?.isFumble)) {
        await parentWeapon.update({ 'system.equipped': false, 'flags.essence20.destroyed': true });
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: roller }),
          content: game.i18n.format('E20.WeaponSalvagedDestroyed', { name: roller.name, weapon: parentWeapon.name }),
        });
      }

      // Weapons changed for a while (items/attacks/weapon-perk-uses.mjs): Backblast's 1 Fire to everyone
      // within 5 feet (or the attacker, on a Fumble), Airburst's Prone/Impaired, one-use traps, and
      // a Fumble ending Explosive Ammo / Utility Loaders.
      if (parentWeapon && weaponRollResult && !weaponRollResult.cancelled) {
        await resolveWeaponChangesAfterAttack(roller, parentWeapon, weaponRollResult);
        // A poison on the weapon is used up by the attack, hit or miss (items/gear/poison-coating.mjs).
        await wipeCoating(parentWeapon);
        // Never Unarmed / Brainstorm items fall apart on a Fumble (mechanics/resources/grants.mjs).
        await endOnFumble(roller, parentWeapon, weaponRollResult);
      }

      // Shoot, You Fools! (Cobra Codex p.57) - "Any ally who attacks and fails suffers 1 Psychic
      // Damage." Carried on the bonus attack it granted (mechanics/actions/action-perks.mjs).
      if (spent?.psychicOnMiss && weaponRollResult && !weaponRollResult.cancelled && !weaponRollResult.success) {
        await applyDamage(roller, spent.psychicOnMiss, 'psychic');
      }

      // Reload - see mechanics/combat/reload-trait.mjs's own doc comment. Flags the weapon for next time
      // regardless of whether this shot hit; "fired" is what matters, "landed" isn't.
      if (!weaponRollResult?.cancelled && parentWeapon?.system.traits?.includes('reload')) {
        await requireReload(roller, parentWeapon);
      }

      // Fanning (A Jump Through Time, p.74): "After a Fanning Attack, the weapon gains the Reload
      // trait" - see items/attacks/fanning.mjs. The gate above already honours the flag on a Fanning weapon.
      if (!weaponRollResult?.cancelled && weaponRollResult?.fanned) {
        await requireReload(roller, parentWeapon);
      }

      // Empty the Mag (GI Joe CRB, Vanguard, p.109): "After using this ability, you must reload your
      // weapon before you can use it again" - whether or not the weapon has the Reload trait.
      if (!weaponRollResult?.cancelled && weaponRollResult?.emptiedMag) {
        await requireReload(roller, parentWeapon);
      }

      // Burst-Fire - see mechanics/combat/reload-trait.mjs's own doc comment. A second shot in the same round
      // (the flag from a first shot already stamped this round) counts as if it had the Reload
      // trait for the turn; either way, this shot itself stamps "fired this round" for next time.
      if (!weaponRollResult?.cancelled && parentWeapon?.system.itemAndUpgradeTraits?.includes('burstFire')) {
        if (hasBurstFiredThisRound(parentWeapon)) {
          await requireReload(roller, parentWeapon);
        }

        await markBurstFiredThisRound(parentWeapon);
      }

      // Ongoing / Poison / Toxin (Cobra Codex, New Weapon Effects and Traits, p.93-94) - see
      // mechanics/combat/ongoing-effects.mjs's own doc comment. Only the repeating-DAMAGE half; per
      // explicit direction this project has no Poisoned status, so Poison/Toxin's own "causes the
      // Poisoned Condition" clause stays narrative. Only a target the attack actually hit (and
      // whose own damageValue for THIS entry is real) gets a pending effect - a pure-Condition
      // Alternate Effect (e.g. Compound Z's own damageValue 0) has nothing to repeat.
      const ongoingTraits = ['ongoing', 'poison', 'toxin'];
      if (!weaponRollResult?.cancelled && parentWeapon?.system.traits?.some(trait => ongoingTraits.includes(trait))) {
        // rollSkill returns one outcome per roll (several for Fanning / Multiple Targets), each
        // holding its own per-target results.
        const hitResults = (weaponRollResult.outcomes ?? []).flatMap(outcome => outcome.results ?? []);
        for (const result of hitResults) {
          if (result.success && result.targetUuid && result.damageValue > 0) {
            const targetActor = await fromUuid(result.targetUuid);
            await addOngoingEffect(targetActor, {
              damageValue: result.damageValue,
              damageType: result.damageType,
              // Potent Poison (Cobra Codex p.97): "Increase the duration of the poison's Ongoing effect
              // by 1 round."
              roundsRemaining: parentWeapon.system.ongoingDuration + (weaponHasUpgrade(parentWeapon, TRAIT_UPGRADE.potentPoison) ? 1 : 0),
              sourceName: parentWeapon.name,
            });
          }
        }
      }

      // Consumable (GI Joe CRB, Weapon Effects and Traits, p.147): "Using this weapon destroys it,
      // even if it misses its target." Same one-potion-can-hold-several shape as the magic bauble
      // consumption path below (spell branch) - a holder can carry more than one of the same
      // Consumable weapon, and only the last one firing actually deletes the Item. isEmbedded
      // guards the source the same way the bauble path does, so rolling straight out of a
      // compendium or the world Items directory can't delete the master copy.
      if (!weaponRollResult?.cancelled && parentWeapon?.system.traits?.includes('consumable')
        && parentWeapon.isEmbedded) {
        const remaining = (parentWeapon.system.quantity ?? 1) - 1;
        if (remaining > 0) {
          await parentWeapon.update({ 'system.quantity': remaining });
        } else {
          await parentWeapon.delete();
        }
      }

      // Decrement class feature, if applicable
      const classFeature = roller.items.get(this.system.classFeatureId);
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

      // Efficient / Master Spellcaster lower system.cost itself (their ItemModifier rules).
      let castingCost = this.system.cost;

      // Block Magic (Knights of Canterlot, Virtuoso Enchantment spell, p.49) - see
      // items/magic/block-magic.mjs's own doc comment. "+1 to the cost of any spell you cast" while a
      // target is under its effect. Applied after the Efficient/Master Spellcaster reduction (a
      // real cost increase, not something those Perks should shrink away).
      if (isBlockMagicActive(this.actor)) {
        castingCost += 1;
      }

      // Extensions - Illusion Casting, Reach Out, Sharpcaster's free second roll (mechanics/item-hooks.mjs).
      castingCost = await runSpellCost(this, castingCost, dataset);
      if (castingCost === null) {
        return;
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
      const sourceId = this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? this.flags?.essence20?.rulesSource;
      const enchantSkill = sourceId == ENCHANT_ID ? await pickEnchantSkill() : null;
      if (sourceId == ENCHANT_ID && !enchantSkill) {
        return;
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

      // Area of Effect - see mechanics/combat/aoe-targeting.mjs. Only an area spell (system.shape set)
      // places a shape; an ordinary single-target spell is targeted by hand as usual. Placed
      // after every cancellable picker above, so backing out of one of those never costs the
      // player a placement gesture, and before the roll, so dice.mjs's own checkEntries sees the
      // targets it caught. Deliberately the same "a cancelled placement still rolls" behavior the
      // weaponEffect branch above already has - placeAoeTemplate can't distinguish "cancelled"
      // from "placed, caught nobody", and a blast that legitimately catches nobody must still
      // resolve.
      if (this.system.shape) {
        await placeAoeTemplate(this.actor, this);
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

      await this._rollWithRefund(spellDataset, this.actor, spent);

      // Unlike a single-roll shift, this cost lingers on the actor's Spellcasting Skill after
      // the roll - only cleared via onRecoverSpellcastingDownshift/onSufferForSpellcastingDownshift
      // (listener-misc-handler.mjs). The cost always ends up applied here eventually, whether or
      // not it affected the roll that just happened.
      await this.actor.update({ 'system.skills.spellcasting.shiftDown': priorDownshift + castingCost });
    } else if (this.type == 'magicBauble') {
      const essence = 'any';
      const skill = 'spellcasting';
      /* "If the spell calls for a Spellcasting Skill Test, you use your own Spellcasting Skill, or
         the Spellcasting Skill noted on the Magic Bauble (whichever is higher)" (MLP CRB p.143).

         This used to take the bauble's own shift unconditionally, which had it backwards for the
         case the rule exists to cover: a trained spellcaster drinking a d2 potion was DOWNGRADED to
         the potion's rank instead of keeping their own. The bauble only ever helps - it is a floor
         under an untrained pony, not a ceiling on a skilled one. */
      const shift = betterShift(this.actor.system.skills.spellcasting.shift, this.system.spellcastingShift);
      // Whichever shift wins, any lingering Casting Cost downshift (MLP CRB p.132) still applies
      // on top - the bauble supplies a rank, not immunity to what earlier casting has cost you.
      const shiftDown = this.actor.system.skills.spellcasting.shiftDown;
      const spellDataset = {
        ...dataset,
        essence,
        shift,
        skill,
        shiftDown,
      };

      const baubleResult = await this._rollWithRefund(spellDataset, this.actor, spent);

      /* "As a consumable item, once any magic bauble is used, it is done. A potion is drunk, a
         scroll is consumed by magic, a statue crumbles to dust... it can only ever be used once"
         (MLP CRB p.143).

         Deleted only once the roll has actually resolved. A cancelled roll refunds the action
         economy just above, and a potion the player decided not to drink after all is still in
         their saddlebag - consuming it there would destroy an item for a dialog they backed out
         of, which is not recoverable from the sheet.

         isEmbedded guards the source: rolling a bauble straight out of a compendium or the world
         Items directory must consume nothing, or a single click would delete the master copy every
         other actor's is made from. */
      if (!baubleResult?.cancelled && this.isEmbedded) {
        const name = this.name;
        const actorName = this.actor?.name ?? '';
        // A holder can carry several of the same potion, so one use spends one of them; the item
        // itself only goes when the last is gone. Treat a missing quantity as 1 rather than 0, so
        // a bauble authored before this field existed still behaves like a single potion.
        const remaining = (this.system.quantity ?? 1) - 1;
        if (remaining > 0) {
          await this.update({ 'system.quantity': remaining });
          ui.notifications.info(game.i18n.format('E20.MagicBaubleUsed', {
            actor: actorName,
            item: name,
            remaining,
          }));
        } else {
          await this.delete();
          ui.notifications.info(game.i18n.format('E20.MagicBaubleConsumed', {
            actor: actorName,
            item: name,
          }));
        }
      }
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
