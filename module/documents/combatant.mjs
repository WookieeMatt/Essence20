export class Essence20Combatant extends Combatant {
  /**
   * @override
   */
  _getInitiativeFormula() {
    return this.actor.system.initiative.formula;
  }
}
