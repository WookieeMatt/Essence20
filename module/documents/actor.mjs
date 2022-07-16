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
    const unmorphed = {
      toughness: CONFIG.E20.defenseBase + system.essences.strength,
      evasion: CONFIG.E20.defenseBase + system.essences.speed,
      willpower: CONFIG.E20.defenseBase + system.essences.smarts,
      cleverness: CONFIG.E20.defenseBase + system.essences.social,
    };
    const morphed = {
      toughness: unmorphed.toughness + system.bonuses.toughness, // Armor added in sheet
      evasion: unmorphed.evasion + system.bonuses.evasion,
      willpower: unmorphed.willpower +  system.bonuses.willpower,
      cleverness: unmorphed.cleverness +  system.bonuses.cleverness,
    };
    system.defenses = {
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
    data.initiativeFormula = data.initiative == 'd20' ? 'd20' : `d20 + ${data.initiative}`;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.data.type !== 'npc') return;

    // Process additional NPC data here.
  }

}
