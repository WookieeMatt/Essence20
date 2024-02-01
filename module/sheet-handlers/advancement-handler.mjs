import {
  getItemsOfType,
  setFocusValues,
  setRoleValues,
} from "../helpers/utils.mjs";

export class AdvancementHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
  * Updates the actor based on a level change from the attached role
  * @param {Actor} actor The actor whose level has changed
  * @param {Number} newLevel The new level that you are changing to.
  */
  async onLevelChange(actor, newLevel) {
    const previousLevel = actor.getFlag('essence20', 'previousLevel');
    if (!previousLevel || previousLevel == newLevel) {
      return;
    }

    const roles = getItemsOfType("role", actor.items);
    if (roles.length == 1) {
      setRoleValues(roles[0], actor, newLevel, previousLevel);
    } else {
      return;
    }

    const focus = getItemsOfType("focus", actor.items);
    if (focus.length == 1) {
      setFocusValues(focus[0], actor, newLevel, previousLevel);
    }

    actor.setFlag('essence20', 'previousLevel', newLevel);
  }
}
