import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class Essence20Actor extends Actor {
  constructor(...args) {
    super(...args);
    this._dice = new Dice(ChatMessage, new RollDialog());
  }

  /** @override */
  static async create(data, options = {}) {
    const actor = await super.create(data, options);

    // Create Personal Power as a default class feature for Power Rangers
    if (data.type == 'powerRanger') {
      Item.create(
        {
          name: game.i18n.localize('E20.PowerRangerPersonalPower'),
          type: 'classFeature',
          data: {},
        },
        { parent: actor }
      );
    }

    // Create Energon as a default class feature for Transformers
    if (data.type == 'transformer') {
      Item.create(
        {
          name: game.i18n.localize('E20.TransformerEnergon'),
          type: 'classFeature',
          data: {},
        },
        { parent: actor }
      );
    }

    return actor;
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
    this._prepareCharacterData();
    this._prepareNpcData();
    this._preparePowerRangerData();
    this._prepareGiJoeData();
    this._prepareTransformerData();
    this._preparePonyData();
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    // if (actorData.type !== 'character') return;

    // // Make modifications to data here. For example:
    // const data = actorData.data;

    // // Loop through ability scores, and add their modifiers to our sheet output.
    // for (let [key, ability] of Object.entries(data.abilities)) {
    //   // Calculate the modifier using d20 rules.
    //   ability.mod = Math.floor((ability.value - 10) / 2);
    // }
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
   * Prepare GI JOE type specific data.
   */
  _prepareGiJoeData() {
    if (this.type !== 'giJoe') return;

    const system = this.system;

    this._prepareDefenses();
    this._prepareMovement();
  }

  /**
   * Prepare Power Ranger type specific data.
   */
  _preparePowerRangerData() {
    if (this.type !== 'powerRanger') return;

    const system = this.system;

    this._prepareDefenses();
    this._prepareMovement();
  }

  /**
   * Prepare Transformers type specific data.
   */
  _prepareTransformerData() {
    if (this.type !== 'transformer') return;

    const system = this.system;
    this._prepareDefenses();
    this._prepareMovement();
  }

  _preparePonyData() {
    if (this.type !== 'pony') return;

    const system = this.system;
    this._prepareDefenses();
    this._prepareMovement();
  }

  _prepareDefenses() {
    const system = this.system;

    const defenseTypes = ['cleverness', 'evasion', 'toughness', 'willpower']
    for (const defenseType of defenseTypes) {
      const defenseName = system.defenses[defenseType];
      const essenceName = game.i18n.localize(`E20.Essence${defenseName.essence.capitalize()}`);
      const baseName = game.i18n.localize('E20.DefenseBase');
      const armorName = game.i18n.localize('E20.DefenseArmor');
      const bonusName = game.i18n.localize('E20.DefenseBonus');
      const morphedName = game.i18n.localize('E20.DefenseMorphed');
      console.log(essenceName)
      if (system.isMorphed) {
        defenseName.total = defenseName.base + system.essences[defenseName.essence] + defenseName.morphed + defenseName.bonus
        defenseName.string = `${defenseName.base} ${baseName} + ${system.essences[defenseName.essence]} ${essenceName} + ${defenseName.morphed} ${morphedName} + ${defenseName.bonus} ${bonusName}`
      } else {
        defenseName.total = defenseName.base + system.essences[defenseName.essence] + defenseName.armor + defenseName.bonus
        defenseName.string = `${defenseName.base} ${baseName} + ${system.essences[defenseName.essence]} ${essenceName} + ${defenseName.armor} ${armorName} + ${defenseName.bonus} ${bonusName}`
      }
    }
  }

  /**
  * Prepare Movement specific data.
  */
  _prepareMovement() {
    let movementTotal = 0;
    const system = this.system;
    system.movementIsReadOnly = true;

    const movementTypes = ['aerial', 'ground', 'swim'];
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
    }

    if (!movementTotal) {
      system.movementNotSet = true;
    }
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    const initiativeFormula = data.initiative.shift == 'd20' ? 'd20' : `d20 + ${data.initiative.shift}`;
    data.initiativeFormula = `${initiativeFormula} + ${data.initiative.modifier}`;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }

  /**
   * Perform a skill roll.
   */
  rollSkill(dataset) {
    this._dice.rollSkill(dataset, this);
  }
}
