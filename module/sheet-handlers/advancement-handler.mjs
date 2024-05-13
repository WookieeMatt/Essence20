import {
  setFocusValues,
  setRoleValues,
} from "../helpers/advancement.mjs";
import { getItemsOfType } from "../helpers/utils.mjs";

/**
* Updates the Actor based on a level change from the attached Role
* @param {Actor}  actor    The Actor whose level has changed
* @param {Number} newLevel The new level that you are changing to
*/
export async function onLevelChange(actor, newLevel) {
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
