import { Dice } from "../dice.mjs";
import { E20 } from "../helpers/config.mjs";

export class Essence20Combat extends Combat {
  constructor(data, context) {
    super(data, context);
    this._dice = new Dice(E20, ChatMessage);
  }

  /**
  * @override
  */
  async rollInitiative(ids, options) {
    const combatants = ids.flatMap(
      (id) => this.combatants.get(id) ?? []
    );

    for (let combatant of combatants) {
      await this._dice.handleInitiativeRoll(combatant.actor);
      await super.rollInitiative([combatant.id], options);
    }
  }
}
