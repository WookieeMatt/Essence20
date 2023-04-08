import { Dice } from "../dice.mjs";
import { E20 } from "../helpers/config.mjs";

const DICE = new Dice(E20, ChatMessage);

export class Essence20Combat extends Combat {
  /** Roll initiative for PCs and NPCs using their prepared roll methods */
  async rollInitiative(ids, options) {
    const combatants = ids.flatMap(
      (id) => this.combatants.get(id) ?? []
    );

    for (let combatant of combatants) {
      await DICE.handleInitiativeRoll(combatant.actor);
      await super.rollInitiative([combatant.id], options);
    }
  }
}
