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
   * Prepare Movement specific data.
   */
  _prepareMovement(system) {
    system.movementIsReadOnly = true
    system.movement.aerial.base = parseFloat(system.movement.aerial.base);
    system.movement.ground.base = parseFloat(system.movement.ground.base);
    system.movement.swim.base = parseFloat(system.movement.swim.base);

    if (system.isMorphed && system.isTransformed) {
      if (system.movement.aerial.altMode) {
        system.movement.aerial.total = system.movement.aerial.altMode + system.movement.aerial.bonus + system.movement.aerial.morphed;
      } else {
        system.movement.aerial.total = 0;
      }
      if (system.movement.ground.altMode){
        system.movement.ground.total = system.movement.ground.altMode + system.movement.ground.bonus + system.movement.ground.morphed;
      } else {
        system.movement.ground.total = 0;
      }
      if (system.movement.swim.altMode){
        system.movement.swim.total = system.movement.swim.altMode + system.movement.swim.bonus + system.movement.swim.morphed;
      } else {
        system.movement.swim.total = 0;
      }
    }else if (system.isMorphed) {
      if (system.movement.aerial.base) {
        system.movement.aerial.total = system.movement.aerial.base + system.movement.aerial.bonus + system.movement.aerial.morphed;
      } else {
        system.movement.aerial.total = 0;
      }
      if (system.movement.ground.base){
        system.movement.ground.total = system.movement.ground.base + system.movement.ground.bonus + system.movement.ground.morphed;
      } else {
        system.movement.ground.total = 0;
      }
      if (system.movement.swim.base){
        system.movement.swim.total = system.movement.swim.base + system.movement.swim.bonus + system.movement.swim.morphed;
      } else {
        system.movement.swim.total = 0;
      }
    }else if (system.isTransformed) {
      if (system.movement.aerial.altMode){
        system.movement.aerial.total = system.movement.aerial.altMode + system.movement.aerial.bonus;
      } else {
        system.movement.aerial.total = 0;
      }
      if (system.movement.ground.altMode){
        system.movement.ground.total = system.movement.ground.altMode + system.movement.ground.bonus;
      } else {
        system.movement.ground.total = 0;
      }
      if (system.movement.swim.altMode){
        system.movement.swim.total = system.movement.swim.altMode + system.movement.swim.bonus;
      } else {
        system.movement.swim.total = 0;
      }
    }else{
      if (system.movement.aerial.base){
        system.movement.aerial.total = system.movement.aerial.base + system.movement.aerial.bonus;
      } else {
        system.movement.aerial.total = 0;
      }
      if (system.movement.ground.base){
        system.movement.ground.total = system.movement.ground.base + system.movement.ground.bonus;
      } else {
        system.movement.ground.total = 0;
      }
      if (system.movement.swim.base){
        system.movement.swim.total = system.movement.swim.base + system.movement.swim.bonus;
      } else {
        system.movement.swim.total = 0;
      }
    }
  }

  /**
   * Prepare GI JOE type specific data.
   */
  _prepareGiJoeData() {
    if (this.type !== 'giJoe') return;

    const system = this.system;

    system.defenses = [
      {
        essence: "strength",
        name: "toughness",
        value: system.base.toughness + system.essences.strength + system.bonuses.toughness,
        bonus: system.bonuses.toughness
      },
      {
        essence: "speed",
        name: "evasion",
        value: system.base.evasion + system.essences.speed + system.bonuses.evasion,
        bonus: system.bonuses.evasion
      },
      {
        essence: "smarts",
        name: "willpower",
        value: system.base.willpower + system.essences.smarts + system.bonuses.willpower,
        bonus: system.bonuses.willpower
      },
      {
        essence: "social",
        name: "cleverness",
        value: system.base.cleverness + system.essences.social + system.bonuses.cleverness,
        bonus: system.bonuses.cleverness
      }
    ];
    this._prepareMovement(system);
  }


  /**
   * Prepare Power Ranger type specific data.
   */
  _preparePowerRangerData() {
    if (this.type !== 'powerRanger') return;

    const system = this.system;

    system.defenses = [
      {
        essence: "strength",
        name: "toughness",
        morphed: {
          value: system.base.toughness + system.essences.strength + system.bonuses.toughness,
          bonus: system.bonuses.toughness
        },
        unmorphed: {
          value: system.base.toughness + system.essences.strength,
        },
      },
      {
        essence: "speed",
        name: "evasion",
        morphed: {
          value: system.base.evasion + system.essences.speed + system.bonuses.evasion,
          bonus: system.bonuses.evasion
        },
        unmorphed: {
          value: system.base.evasion + system.essences.speed,
        },
      },
      {
        essence: "smarts",
        name: "willpower",
        morphed: {
          value: system.base.willpower + system.essences.smarts + system.bonuses.willpower,
          bonus: system.bonuses.willpower
        },
        unmorphed: {
          value: system.base.willpower + system.essences.smarts,
        },
      },
      {
        essence: "social",
        name: "cleverness",
        morphed: {
          value: system.base.cleverness + system.essences.social + system.bonuses.cleverness,
          bonus: system.bonuses.cleverness
        },
        unmorphed: {
          value: system.base.cleverness + system.essences.social,
        },
      },
    ];

    this._prepareMovement(system);
  }

  /**
   * Prepare Transformers type specific data.
   */
  _prepareTransformerData() {
    if (this.type !== 'transformer') return;

    const system = this.system;

    system.defenses = [
      {
        essence: "strength",
        name: "toughness",
        value: system.base.toughness + system.essences.strength + system.bonuses.toughness,
        bonus: system.bonuses.toughness
      },
      {
        essence: "speed",
        name: "evasion",
        value: system.base.evasion + system.essences.speed + system.bonuses.evasion,
        bonus: system.bonuses.evasion
      },
      {
        essence: "smarts",
        name: "willpower",
        value: system.base.willpower + system.essences.smarts + system.bonuses.willpower,
        bonus: system.bonuses.willpower
      },
      {
        essence: "social",
        name: "cleverness",
        value: system.base.cleverness + system.essences.social + system.bonuses.cleverness,
        bonus: system.bonuses.cleverness
      }
    ];

    this._prepareMovement(system);
  }

  _preparePonyData() {
    if (this.type !== 'pony') return;

    const system = this.system;

    system.defenses = [
      {
        essence: "strength",
        name: "toughness",
        value: system.base.toughness + system.essences.strength + system.bonuses.toughness,
        bonus: system.bonuses.toughness
      },
      {
        essence: "speed",
        name: "evasion",
        value: system.base.evasion + system.essences.speed + system.bonuses.evasion,
        bonus: system.bonuses.evasion
      },
      {
        essence: "smarts",
        name: "willpower",
        value: system.base.willpower + system.essences.smarts + system.bonuses.willpower,
        bonus: system.bonuses.willpower
      },
      {
        essence: "social",
        name: "cleverness",
        value: system.base.cleverness + system.essences.social + system.bonuses.cleverness,
        bonus: system.bonuses.cleverness
      }
    ];

    this._prepareMovement(system);
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
