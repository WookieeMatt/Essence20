import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";

export class Essence20Combat extends Combat {
  constructor(data, context) {
    super(data, context);
    this._dice = new Dice(ChatMessage, new RollDialog());
  }

  /**
  * @override
  */
  async rollInitiative(ids, options) {
    const combatants = ids.flatMap(
      (id) => this.combatants.get(id) ?? []
    );

    for (let combatant of combatants) {
      if (await this._dice.prepareInitiativeRoll(combatant.actor)) {
        await super.rollInitiative([combatant.id], options);
      }
    }
  }
}
