/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class Essence20Actor extends Actor {
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
    const defenses = {
      toughness: CONFIG.E20.defenseBase + system.essences.strength + system.bonuses.toughness, // Armor added in sheet
      evasion: CONFIG.E20.defenseBase + system.essences.speed + system.bonuses.evasion,
      willpower: CONFIG.E20.defenseBase + system.essences.smarts +  system.bonuses.willpower,
      cleverness: CONFIG.E20.defenseBase + system.essences.social +  system.bonuses.cleverness,
    };
    system.defenses = defenses;
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
          value: CONFIG.E20.defenseBase + system.essences.strength + system.bonuses.toughness,
          bonus: system.bonuses.toughness
        },
        unmorphed: {
          value: CONFIG.E20.defenseBase + system.essences.strength,
        },
      },
      {
        essence: "speed",
        name: "evasion",
        morphed: {
          value: CONFIG.E20.defenseBase + system.essences.speed + system.bonuses.evasion,
          bonus: system.bonuses.evasion
        },
        unmorphed: {
          value: CONFIG.E20.defenseBase + system.essences.speed,
        },
      },
      {
        essence: "smarts",
        name: "willpower",
        morphed: {
          value: CONFIG.E20.defenseBase + system.essences.smarts + system.bonuses.willpower,
          bonus: system.bonuses.willpower
        },
        unmorphed: {
          value: CONFIG.E20.defenseBase + system.essences.smarts,
        },
      },
      {
        essence: "social",
        name: "cleverness",
        morphed: {
          value: CONFIG.E20.defenseBase + system.essences.social + system.bonuses.cleverness,
          bonus: system.bonuses.cleverness
        },
        unmorphed: {
          value: CONFIG.E20.defenseBase + system.essences.social,
        },
      },
    ];
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
    data.initiativeFormula = data.initiative == 'd20' ? 'd20' : `d20 + ${data.initiative}`;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }

}
