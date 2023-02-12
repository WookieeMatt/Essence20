import { Dice } from "../dice.mjs";

export class Essence20Combatant extends Combatant {
  _getInitiativeFormula() {
    return this.actor.system.initiativeFormula;
  }
}
