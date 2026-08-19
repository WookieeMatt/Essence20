import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { resizeTokens } from "../helpers/actor.mjs";
import { roleValueChange } from "../sheet-handlers/role-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransformUuid } from "../sheet-handlers/transformer-handler.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";

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

    if (this.type == 'playerCharacter') {
      this._prepareDefenses();
      this._prepareHealth();
      this._prepareMovement();
      this._prepareSorcerousPower();
      this._prepareResource();
      this._preparePoisonTraining();
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

    for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
      const defense = system.defenses[defenseType];
      const base = defense.base;
      const armor = defense.armor;
      const bonus = defense.bonus;
      const morphed = defense.morphed;
      const shield = defense.shield;
      let rolePointsDefense = 0;
      const essence = system.essences[defense.essence].max;
      const essenceName = game.i18n.localize(`E20.Essence${defense.essence.capitalize()}`);
      const baseName = game.i18n.localize('E20.DefenseBase');
      const armorName = game.i18n.localize('E20.DefenseArmor');
      const bonusName = game.i18n.localize('E20.Bonus');
      const morphedName = game.i18n.localize('E20.DefenseMorphed');
      const shieldName = game.i18n.localize('E20.DefenseShield');
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

      defense.total = base + essence + bonus + rolePointsDefense;
      defense.total += system.isMorphed ? morphed : armor;
      defense.total += shield;

      defense.string = `${base} (${baseName}) + ${essence} (${essenceName})`;
      defense.string += system.isMorphed ? ` + ${morphed} (${morphedName})` : ` + ${armor} (${armorName})`;
      defense.string += ` + ${shield} (${shieldName})`;
      defense.string += ` + ${bonus} (${bonusName}) + ${rolePointsDefense} (${rolePointsName})`;
    }
  }

  /**
  * Prepare Movement specific data.
  */
  _prepareMovement() {
    let movementTotal = 0;
    const system = this.system;

    const movementTypes = ['aerial', 'ground', 'climb', 'swim'];
    for (const movementType of movementTypes) {
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
    system.isDefeated = defeatedCount > participants.length / 2;
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
    if (collection != "effects") {
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
