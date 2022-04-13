/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class Essence20Actor extends Actor {

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
    const actorData = this.data;
    const data = actorData.data;
    const flags = actorData.flags.essence20 || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
    this._preparePowerRangerData(actorData);
    this._prepareGiJoeData(actorData);
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
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // // Make modifications to data here. For example:
    // const data = actorData.data;
    // data.xp = (data.cr * data.cr) * 100;
  }

  /**
   * Prepare GI JOE type specific data.
   */
   _prepareGiJoeData(actorData) {
    if (actorData.type !== 'giJoe') return;
    const data = actorData.data;

    const defenses = {
      toughness: CONFIG.E20.defenseBase + data.essences.strength + data.bonuses.toughness, // Armor added in sheet
      evasion: CONFIG.E20.defenseBase + data.essences.speed + data.bonuses.evasion,
      willpower: CONFIG.E20.defenseBase + data.essences.smarts +  data.bonuses.willpower,
      cleverness: CONFIG.E20.defenseBase + data.essences.social +  data.bonuses.cleverness,
    };

    data.defenses = defenses;
  }

  /**
   * Prepare Power Ranger type specific data.
   */
   _preparePowerRangerData(actorData) {
    if (actorData.type !== 'powerRanger') return;

    const data = actorData.data;
    const defenses = {};
    const unmorphed = {
      toughness: CONFIG.E20.defenseBase + data.essences.strength,
      evasion: CONFIG.E20.defenseBase + data.essences.speed,
      willpower: CONFIG.E20.defenseBase + data.essences.smarts,
      cleverness: CONFIG.E20.defenseBase + data.essences.social,
    };
    const morphed = {
      toughness: unmorphed.toughness + data.bonuses.toughness, // Armor added in sheet
      evasion: unmorphed.evasion + data.bonuses.evasion,
      willpower: unmorphed.willpower +  data.bonuses.willpower,
      cleverness: unmorphed.cleverness +  data.bonuses.cleverness,
    };

    data.defenses = {
      morphed,
      unmorphed,
    };
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
    // if (this.data.type !== 'character') return;

    // // Copy the ability scores to the top level, so that rolls can use
    // // formulas like `@str.mod + 4`.
    // if (data.abilities) {
    //   for (let [k, v] of Object.entries(data.abilities)) {
    //     data[k] = foundry.utils.deepClone(v);
    //   }
    // }

    // // Add level for easier access, or fall back to 0.
    // if (data.attributes.level) {
    //   data.lvl = data.attributes.level.value ?? 0;
    // }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.data.type !== 'npc') return;

    // Process additional NPC data here.
  }

}
